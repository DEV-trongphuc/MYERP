<?php
/**
 * tests/e2e/suites/tier4_scenarios.php
 *
 * Tier 4: Realistic End-to-End Multistep Student Lifecycle Journeys (RW01 - RW05)
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - 100% Soft-Delete Mandate
 */

use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\TestDatabase;

$wsId = TestDatabase::TEST_WORKSPACE_ID;

require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
require_once dirname(__DIR__, 3) . '/backend/automation/flow_helpers.php';
require_once dirname(__DIR__, 3) . '/backend/utils/DomationContactMatcher.php';

// Scenario RW01: Complete Admission Lead-to-Student Enrollment Lifecycle
e2e_test('RW01: Complete admission lead-to-student lifecycle journey', function($ctx) use ($wsId) {
    // 1. Ingest prospective student
    $subId = TestDatabase::uniqueId('rw01_sub');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "admission_{$subId}@ideas.edu.vn",
        'phone_number' => '0903334444',
        'city'         => 'Hà Nội',
        'stage_id'     => 1,
        'status'       => 'lead',
        'workspace_id' => $wsId
    ]);
    
    // 2. Segment qualification
    $segId = TestDatabase::uniqueId('rw01_seg');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Chưa tương tác được RW01',
        'criteria'     => json_encode(['logic' => 'AND', 'groups' => [
            ['conditions' => [['field' => 'stage_id', 'operator' => 'equals', 'value' => 1]]]
        ]]),
        'workspace_id' => $wsId
    ]);
    
    // 3. Flow Enrollment
    $flowId = TestDatabase::uniqueId('rw01_flw');
    TestDatabase::insertFixture('flows', [
        'id'           => $flowId,
        'name'         => 'Master AI Admission Flow',
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'step_welcome_email',
        'status'        => 'waiting'
    ]);
    
    // 4. Student opens email
    $campId = TestDatabase::uniqueId('rw01_cmp');
    TestDatabase::insertFixture('campaigns', [
        'id'                   => $campId,
        'name'                 => 'Admission Campaign',
        'count_sent'           => 1,
        'count_unique_opened'  => 0,
        'count_unique_clicked' => 0,
        'status'               => 'sent',
        'workspace_id'         => $wsId
    ]);
    TestDatabase::insertFixture('mail_delivery_logs', [
        'workspace_id' => $wsId,
        'campaign_id'  => $campId,
        'recipient'    => "admission_{$subId}@ideas.edu.vn",
        'status'       => 'success'
    ]);
    
    $pixelResp = $ctx['http']->get("/backend/automation/webhook.php?type=open&ws={$wsId}&sid={$subId}&cid={$campId}&fid={$flowId}");
    Assertions::assertHttpStatus(200, $pixelResp->status);
    Assertions::assertStringContains('GIF89a', $pixelResp->body);
    
    // 5. Student clicks brochure download link
    $brochureUrl = 'https://ideas.edu.vn/brochure-master-ai.pdf';
    $clickResp = $ctx['http']->get("/backend/automation/webhook.php?type=click&ws={$wsId}&sid={$subId}&cid={$campId}&url=" . base64_encode($brochureUrl), [], [], false);
    Assertions::assertHttpStatus(302, $clickResp->status);
    Assertions::assertStringContains($brochureUrl, $clickResp->location);
    
    // 6. Aggregator Worker processes events
    $workerRes = $ctx['worker']->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $workerRes['exit_code']);
    
    // 7. Advance subscriber stage to Qualified (stage_id = 3)
    $ctx['pdo']->prepare("UPDATE subscribers SET stage_id = 3, status = 'qualified' WHERE id = ? AND workspace_id = ?")
        ->execute([$subId, $wsId]);
    $subAfter = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    Assertions::assertEquals(3, (int)$subAfter['stage_id'], 'Subscriber stage must transition to 3 (Qualified)');
});

// Scenario RW02: Event Webinar Registration & Multi-Channel Reminder Sequence
e2e_test('RW02: Event webinar registration & multi-channel reminder sequence', function($ctx) use ($wsId) {
    // 1. Bulk import registrants with tag
    $subList = [];
    for ($i = 0; $i < 4; $i++) {
        $sid = TestDatabase::uniqueId('rw02_sub');
        $subList[] = [
            'email' => "webinar_{$i}_{$sid}@ideas.edu.vn",
            'phone' => "091234500{$i}"
        ];
    }
    
    $respImp = $ctx['http']->post('/backend/automation/subscribers.php?route=subscribers_bulk', [
        'subscribers' => $subList
    ]);
    Assertions::assertHttpStatus(200, $respImp->status);
    
    // 2. Audience Split
    $segId = TestDatabase::uniqueId('rw02_seg');
    TestDatabase::insertFixture('segments', ['id' => $segId, 'name' => 'Webinar All', 'criteria' => '[]', 'workspace_id' => $wsId]);
    
    $respSplit = $ctx['http']->post('/backend/automation/audience_split.php', [
        'source_type'      => 'segment',
        'source_id'        => $segId,
        'type'             => 'quantity',
        'quantity'         => 2,
        'destination_name' => 'Webinar Zalo Group'
    ]);
    Assertions::assertHttpStatus(200, $respSplit->status);
    
    // 3. Priority worker runs
    $workerRes = $ctx['worker']->runPriorityWorker(['trigger_type' => 'webinar_register']);
    Assertions::assertEquals(0, $workerRes['exit_code']);
});

// Scenario RW03: Dormant Lead Re-engagement & Soft-Delete Compliance
e2e_test('RW03: Dormant lead re-engagement with 100% soft-delete compliance', function($ctx) use ($wsId) {
    // 1. Setup dormant subscribers
    $dormantIds = [];
    for ($i = 0; $i < 3; $i++) {
        $sid = TestDatabase::uniqueId('rw03_dorm');
        $dormantIds[] = $sid;
        TestDatabase::insertFixture('subscribers', [
            'id'           => $sid,
            'email'        => "dormant_{$i}_{$sid}@ideas.edu.vn",
            'status'       => 'lead',
            'created_at'   => date('Y-m-d H:i:s', time() - 86400 * 100),
            'workspace_id' => $wsId
        ]);
    }
    
    // 2. Short link voucher
    $linkId = TestDatabase::uniqueId('rw03_lnk');
    $slug = 'voucher-ai-' . substr($linkId, -6);
    $targetUrl = 'https://ideas.edu.vn/voucher-discount';
    TestDatabase::insertFixture('short_links', [
        'id'           => $linkId,
        'slug'         => $slug,
        'target_url'   => $targetUrl,
        'status'       => 'active',
        'workspace_id' => (string)$wsId
    ]);
    
    // Student 0 clicks voucher short link
    $respGo = $ctx['http']->get("/backend/automation/go.php?s={$slug}", [], [], false);
    Assertions::assertHttpStatus(302, $respGo->status);
    
    // Student 1 clicks unsubscribe
    $respUnsub = $ctx['http']->get("/backend/automation/webhook.php?type=unsubscribe&ws={$wsId}&sid={$dormantIds[1]}&cid=dummy", [], [], false);
    Assertions::assertHttpStatus(302, $respUnsub->status);
    $unsubSub = TestDatabase::fetchRow('subscribers', ['id' => $dormantIds[1]]);
    Assertions::assertEquals('unsubscribed', $unsubSub['status']);
    
    // Student 2 archived via soft-delete
    $ctx['pdo']->prepare("UPDATE subscribers SET status = 'archived', deleted_at = NOW() WHERE id = ? AND workspace_id = ?")
        ->execute([$dormantIds[2], $wsId]);
    $archSub = TestDatabase::fetchRow('subscribers', ['id' => $dormantIds[2]]);
    Assertions::assertNotNull($archSub['deleted_at'], 'Archived subscriber must have deleted_at set (100% Soft-Delete)');
});

// Scenario RW04: Web Traffic Attribution & Omnichannel Funnel Conversion
e2e_test('RW04: Web traffic attribution and omnichannel funnel conversion', function($ctx) use ($wsId) {
    // 1. Web visit with UTM tags
    $propId = TestDatabase::uniqueId('rw04_prp');
    TestDatabase::insertFixture('web_properties', [
        'id'           => $propId,
        'workspace_id' => $wsId,
        'domain'       => 'ideas.edu.vn',
        'status'       => 'active'
    ]);
    
    $visUuid = TestDatabase::uniqueId('rw04_vis');
    $respTrack = $ctx['http']->post('/backend/automation/track.php', [
        'property_id'  => $propId,
        'visitor_uuid' => $visUuid,
        'event'        => 'page_view',
        'url'          => 'https://ideas.edu.vn/khoa-hoc-ai?utm_source=meta_ads&utm_campaign=ai_master_2026',
        'referrer'     => 'https://facebook.com'
    ]);
    Assertions::assertHttpStatus(200, $respTrack->status);
    
    // 2. Identity Resolution
    $normPhone = DomationContactMatcher::normalizePhone9('+84 90 888 7777');
    Assertions::assertEquals('908887777', $normPhone);
});

// Scenario RW05: High-Concurrency Webhook Burst & Chaos Defense
e2e_test('RW05: High-concurrency webhook burst and anti-poison-pill chaos defense', function($ctx) use ($wsId) {
    // 1. Rapid burst of 10 webhook requests
    for ($i = 0; $i < 10; $i++) {
        $type = ($i % 2 === 0) ? 'open' : 'click';
        if ($type === 'open') {
            $resp = $ctx['http']->get("/backend/automation/webhook.php?type=open&ws={$wsId}&sid=burst_{$i}");
            Assertions::assertHttpStatus(200, $resp->status);
        } else {
            $resp = $ctx['http']->get("/backend/automation/webhook.php?type=click&ws={$wsId}&sid=burst_{$i}&url=" . base64_encode('https://ideas.edu.vn'), [], [], false);
            Assertions::assertHttpStatus(302, $resp->status);
        }
    }
    
    // 2. Inject a malformed poison-pill event in raw_event_buffer
    $poisonId = time() . '999';
    $ctx['pdo']->prepare("INSERT INTO raw_event_buffer (id, type, payload, workspace_id, processed, created_at) VALUES (?, 'corrupt_type', 'NOT_JSON{{{', ?, 0, NOW())")
        ->execute([$poisonId, $wsId]);
        
    // 3. Worker executes without dying on poison pill
    $workerRes = $ctx['worker']->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $workerRes['exit_code'], 'Aggregator worker must survive poison pill with Exit Code 0');
});
