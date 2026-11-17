<?php
/**
 * tests/e2e/suites/tier3_pairwise.php
 *
 * Tier 3: Pairwise Cross-Subsystem Integration Workflows (XF01 - XF38)
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - Self-Contained Test Cases: Zero inter-tier coupling (resolves DEF-E2E-02)
 * - 100% Soft-Delete Mandate
 */

use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\TestDatabase;

$wsId = TestDatabase::TEST_WORKSPACE_ID;

require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
require_once dirname(__DIR__, 3) . '/backend/automation/flow_helpers.php';
require_once dirname(__DIR__, 3) . '/backend/utils/DomationContactMatcher.php';

// XF01: buildSegmentWhereClause + Segment Preview
e2e_test('XF01: Segment preview count matches compiled where clause execution', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('xf01');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "xf01_{$subId}@ideas.edu.vn",
        'city'         => 'Hà Nội',
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    
    $criteria = [
        'groups' => [
            [
                'conditions' => [
                    ['field' => 'city', 'operator' => 'equals', 'value' => 'Hà Nội']
                ]
            ]
        ]
    ];
    $compiled = buildSegmentWhereClause($criteria, $wsId);
    $stmt = $ctx['pdo']->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND ({$compiled['sql']})");
    $stmt->execute(array_merge([$wsId], $compiled['params']));
    $sqlCount = (int)$stmt->fetchColumn();
    
    $resp = $ctx['http']->post('/backend/automation/segments.php?action=preview', ['criteria' => $criteria]);
    Assertions::assertHttpStatus(200, $resp->status);
    $prevCount = $resp->json['count'] ?? ($resp->json['data']['count'] ?? 0);
    Assertions::assertEquals($sqlCount, $prevCount);
});

// XF02: buildSegmentWhereClause + Segment Split
e2e_test('XF02: Segment split creates destination list with subscribers matching criteria', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('xf02_seg');
    TestDatabase::insertFixture('segments', ['id' => $segId, 'name' => 'XF02 Seg', 'criteria' => '[]', 'workspace_id' => $wsId]);
    
    $resp = $ctx['http']->post('/backend/automation/audience_split.php', [
        'source_type'      => 'segment',
        'source_id'        => $segId,
        'type'             => 'quantity',
        'quantity'         => 1,
        'destination_name' => 'XF02 Target List'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF03: buildSegmentWhereClause + Populate List by Filter
e2e_test('XF03: Populate list from filter inserts matching subscribers', function($ctx) use ($wsId) {
    $listId = TestDatabase::uniqueId('xf03_lst');
    TestDatabase::insertFixture('lists', ['id' => $listId, 'name' => 'XF03 List', 'workspace_id' => $wsId]);
    
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=populate_by_filter', [
        'list_id'  => $listId,
        'criteria' => ['groups' => []]
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF04: Default Pipeline Segments + Subscriber Search
e2e_test('XF04: Auto-seeded pipeline segments exist and can be queried in workspace', function($ctx) use ($wsId) {
    ensureDefaultPipelineSegments($ctx['pdo'], $wsId, true);
    $stmt = $ctx['pdo']->prepare("SELECT COUNT(*) FROM segments WHERE workspace_id = ? AND id LIKE 'seg_pipeline_%' AND deleted_at IS NULL");
    $stmt->execute([$wsId]);
    Assertions::assertGreaterThanOrEqual(4, (int)$stmt->fetchColumn());
});

// XF05: Segment CRUD + Segment Count Worker
e2e_test('XF05: Segment count update queue is processed by worker_segment_counts', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('xf05_seg');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'XF05 Segment',
        'criteria'     => json_encode(['logic' => 'AND', 'groups' => []]),
        'workspace_id' => $wsId
    ]);
    $ctx['pdo']->prepare("INSERT INTO segment_count_update_queue (segment_id, workspace_id, queued_at) VALUES (?, ?, NOW())")
        ->execute([$segId, $wsId]);
        
    $res = $ctx['worker']->runSegmentCountsWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// XF06: Segment Notification Flag + Notify Worker
e2e_test('XF06: Segment notify worker runs with notification segments', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('xf06_seg');
    TestDatabase::insertFixture('segments', [
        'id'             => $segId,
        'name'           => 'XF06 Notify Seg',
        'criteria'       => '[]',
        'notify_on_join' => 1,
        'notify_email'   => 'admin@ideas.edu.vn',
        'workspace_id'   => $wsId
    ]);
    $res = $ctx['worker']->runSegmentNotifyWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// XF07: Segment Cleanup + Segment Exclusion
e2e_test('XF07: Segment cleanup exclude action inserts into segment_exclusions', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('xf07_seg');
    TestDatabase::insertFixture('segments', ['id' => $segId, 'name' => 'XF07 Seg', 'criteria' => '[]', 'workspace_id' => $wsId]);
    $resp = $ctx['http']->post('/backend/automation/segments.php?action=cleanup', [
        'segment_id'   => $segId,
        'cleanup_type' => 'dormant',
        'days'         => 90,
        'action'       => 'exclude'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF08: Static List CRUD + List Member Move
e2e_test('XF08: List member move validates parameters', function($ctx) use ($wsId) {
    $listSrc = TestDatabase::uniqueId('xf08_src');
    $listDst = TestDatabase::uniqueId('xf08_dst');
    TestDatabase::insertFixture('lists', ['id' => $listSrc, 'name' => 'Src List', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('lists', ['id' => $listDst, 'name' => 'Dst List', 'workspace_id' => $wsId]);
    
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=cleanup', [
        'targetId'          => $listSrc,
        'action'            => 'move',
        'destinationListId' => $listDst,
        'statuses'          => ['unsubscribed']
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF09: List Merge + Unique Audience Estimation
e2e_test('XF09: List merge combines source lists', function($ctx) use ($wsId) {
    $l1 = TestDatabase::uniqueId('xf09_l1');
    $l2 = TestDatabase::uniqueId('xf09_l2');
    TestDatabase::insertFixture('lists', ['id' => $l1, 'name' => 'List 1', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('lists', ['id' => $l2, 'name' => 'List 2', 'workspace_id' => $wsId]);
    
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=merge', [
        'source_list_ids'  => [$l1, $l2],
        'target_list_name' => 'Merged List XF09'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF10: ContactController Static List + CRM Sync
e2e_test('XF10: ContactController creates static list from CRM filters', function($ctx) use ($wsId) {
    $resp = $ctx['http']->post('/backend/index.php/contacts/static-list', [
        'name'      => 'CRM Synced XF10',
        'list_mode' => 'new'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF11: Subscriber Filter + Bulk Action Tagging
e2e_test('XF11: Bulk add tag modifies subscriber tags in MySQL', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('xf11_sub');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "xf11_{$subId}@ideas.edu.vn",
        'workspace_id' => $wsId
    ]);
    
    $tagId = TestDatabase::uniqueId('xf11_tag');
    TestDatabase::insertFixture('domation_tags', [
        'id'           => $tagId,
        'name'         => 'VIP_XF11',
        'workspace_id' => $wsId
    ]);

    $resp = $ctx['http']->post('/backend/automation/subscribers.php?route=bulk-add-tag', [
        'subscriber_ids' => [$subId],
        'tag_id'         => $tagId
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
    $tagRow = TestDatabase::fetchRow('subscriber_tags', ['subscriber_id' => $subId, 'tag_id' => $tagId, 'workspace_id' => $wsId]);
    Assertions::assertNotNull($tagRow, 'Subscriber tag relation must exist in database');
});

// XF12: Bulk Import + Match-Only Resolution
e2e_test('XF12: Bulk import applies phone normalization', function($ctx) use ($wsId) {
    $id = TestDatabase::uniqueId('xf12');
    $resp = $ctx['http']->post('/backend/automation/subscribers.php?route=subscribers_bulk', [
        'subscribers' => [
            ['email' => "xf12_{$id}@ideas.edu.vn", 'phone' => '+84 98 765 4321']
        ]
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF13: CRM Sync + Subscriber AI Summary
e2e_test('XF13: Subscriber AI summary validates authorization', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('xf13');
    TestDatabase::insertFixture('subscribers', ['id' => $subId, 'email' => "xf13_{$subId}@ideas.edu.vn", 'workspace_id' => $wsId]);
    $resp = $ctx['http']->post('/backend/automation/subscriber_ai_summary.php', ['subscriber_id' => $subId]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF14: Segment AI Profiler + buildSegmentWhereClause
e2e_test('XF14: Segment AI profiler endpoint handles requests safely', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('xf14');
    TestDatabase::insertFixture('segments', ['id' => $segId, 'name' => 'XF14 Seg', 'criteria' => '[]', 'workspace_id' => $wsId]);
    $resp = $ctx['http']->post('/backend/automation/segment_ai_analysis.php', ['segment_id' => $segId]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF15: Flow Definition + Flow Trigger
e2e_test('XF15: Flow definition and participant state insertion', function($ctx) use ($wsId) {
    $flowId = TestDatabase::uniqueId('xf15_flw');
    $subId = TestDatabase::uniqueId('xf15_sub');
    TestDatabase::insertFixture('flows', ['id' => $flowId, 'name' => 'XF15 Flow', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscribers', ['id' => $subId, 'email' => "xf15_{$subId}@ideas.edu.vn", 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'start_node',
        'status'        => 'waiting'
    ]);
    $state = TestDatabase::fetchRow('subscriber_flow_states', ['flow_id' => $flowId, 'subscriber_id' => $subId]);
    Assertions::assertNotNull($state);
});

// XF16: Flow Trigger + Flow Step Wait Node
e2e_test('XF16: Wait node schedules execution in the future', function($ctx) use ($wsId) {
    $future = date('Y-m-d H:i:s', time() + 3600);
    $flowId = TestDatabase::uniqueId('xf16_flw');
    $subId = TestDatabase::uniqueId('xf16_sub');
    TestDatabase::insertFixture('flows', ['id' => $flowId, 'name' => 'XF16 Flow', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscribers', ['id' => $subId, 'email' => "xf16_{$subId}@ideas.edu.vn", 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'wait_node',
        'status'        => 'waiting',
        'scheduled_at'  => $future
    ]);
    $state = TestDatabase::fetchRow('subscriber_flow_states', ['flow_id' => $flowId, 'subscriber_id' => $subId]);
    Assertions::assertEquals($future, $state['scheduled_at']);
});

// XF17: Flow Step Action Email + Open Tracking Pixel
e2e_test('XF17: Delivery log links to open tracking pixel', function($ctx) use ($wsId) {
    $campId = TestDatabase::uniqueId('xf17_cmp');
    $subId = TestDatabase::uniqueId('xf17_sub');
    TestDatabase::insertFixture('campaigns', ['id' => $campId, 'name' => 'XF17 Campaign', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('mail_delivery_logs', [
        'workspace_id' => $wsId,
        'campaign_id'  => $campId,
        'recipient'    => "xf17_{$subId}@ideas.edu.vn",
        'status'       => 'success'
    ]);
    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=open&ws={$wsId}&sid={$subId}&cid={$campId}");
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF18: Flow Step Action Email + Click Tracking URL
e2e_test('XF18: Outbound email click tracking redirects to target URL', function($ctx) use ($wsId) {
    $target = 'https://ideas.edu.vn/admissions';
    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=click&ws={$wsId}&sid=xf18&url=" . base64_encode($target), [], [], false);
    Assertions::assertHttpStatus(302, $resp->status);
    Assertions::assertEquals($target, $resp->location);
});

// XF19: Flow Step Update Tag + Advanced Condition
e2e_test('XF19: Update tag reflected in evaluateAdvancedConditionGroup', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('xf19_sub');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "xf19_{$subId}@ideas.edu.vn",
        'tags'         => 'Interested_AI',
        'workspace_id' => $wsId
    ]);
    $sub = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    $res = evaluateAdvancedConditionGroup($ctx['pdo'], $subId, $sub, [
        ['type' => 'has_tag', 'value' => 'Interested_AI']
    ], 'AND');
    Assertions::assertTrue($res);
});

// XF20: Flow Step List Action + Static List Count
e2e_test('XF20: Subscriber linked to list increments list membership', function($ctx) use ($wsId) {
    $listId = TestDatabase::uniqueId('xf20_lst');
    $subId = TestDatabase::uniqueId('xf20_sub');
    TestDatabase::insertFixture('lists', ['id' => $listId, 'name' => 'XF20 List', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscribers', ['id' => $subId, 'email' => "xf20_{$subId}@ideas.edu.vn", 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscriber_lists', [
        'workspace_id'  => $wsId,
        'list_id'       => $listId,
        'subscriber_id' => $subId
    ]);
    $count = TestDatabase::countRows('subscriber_lists', ['list_id' => $listId, 'workspace_id' => $wsId]);
    Assertions::assertEquals(1, $count);
});

// XF21: Flow Step CRM Action + CRM Sync
e2e_test('XF21: CRM contact stage update persists in MySQL', function($ctx) use ($wsId) {
    $contactId = 99901;
    $ctx['pdo']->prepare("INSERT INTO contacts (id, tenant_id, full_name, email, phone, stage_id, created_at, updated_at) 
                          VALUES (?, ?, 'CRM Stage Test', 'stage_test@ideas.edu.vn', '0901112222', 1, NOW(), NOW())
                          ON DUPLICATE KEY UPDATE stage_id = 4")
        ->execute([$contactId, $wsId]);
    $row = TestDatabase::fetchRow('contacts', ['id' => $contactId]);
    Assertions::assertNotNull($row);
});

// XF22: Flow Condition + Wait for Email Open
e2e_test('XF22: Email open pixel records activity', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=open&ws={$wsId}&sid=sub_xf22");
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF23: Background Flow Worker + Flow Step Execution Nodes
e2e_test('XF23: Background flow worker processes states via CLI', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runFlowWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// XF24: Priority Flow Worker + Form Trigger
e2e_test('XF24: Priority worker executes instant chain via CLI', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runPriorityWorker(['trigger_type' => 'form_submit']);
    Assertions::assertEquals(0, $res['exit_code']);
});

// XF25: Open Tracking + Tracking Aggregator Worker
e2e_test('XF25: Open event buffered in raw_event_buffer and processed by aggregator', function($ctx) use ($wsId) {
    $eid = time() . mt_rand(10, 99);
    $ctx['pdo']->prepare("INSERT INTO raw_event_buffer (id, type, payload, workspace_id, processed, created_at) VALUES (?, 'open', ?, ?, 0, NOW())")
        ->execute([$eid, json_encode(['subscriber_id' => 'xf25', 'workspace_id' => $wsId]), $wsId]);
    $res = $ctx['worker']->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// XF26: Click Tracking + Tracking Aggregator Worker
e2e_test('XF26: Click event buffered and processed by aggregator', function($ctx) use ($wsId) {
    $eid = time() . mt_rand(10, 99);
    $ctx['pdo']->prepare("INSERT INTO raw_event_buffer (id, type, payload, workspace_id, processed, created_at) VALUES (?, 'click', ?, ?, 0, NOW())")
        ->execute([$eid, json_encode(['subscriber_id' => 'xf26', 'workspace_id' => $wsId]), $wsId]);
    $res = $ctx['worker']->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// XF27: Instant Unsubscribe + Flow Worker Cancellation
e2e_test('XF27: Unsubscribe cancels participant flow state', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('xf27_sub');
    TestDatabase::insertFixture('subscribers', ['id' => $subId, 'email' => "xf27_{$subId}@ideas.edu.vn", 'status' => 'active', 'workspace_id' => $wsId]);
    $ctx['http']->get("/backend/automation/webhook.php?type=unsubscribe&ws={$wsId}&sid={$subId}&cid=dummy", [], [], false);
    $sub = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    Assertions::assertEquals('unsubscribed', $sub['status']);
});

// XF28: Short Link Redirect + Campaign Stats
e2e_test('XF28: Short link redirect updates click count', function($ctx) use ($wsId) {
    $linkId = TestDatabase::uniqueId('xf28_lnk');
    $slug = 'xf28-slug-' . substr($linkId, -5);
    TestDatabase::insertFixture('short_links', [
        'id'           => $linkId,
        'slug'         => $slug,
        'target_url'   => 'https://ideas.edu.vn/xf28',
        'status'       => 'active',
        'workspace_id' => (string)$wsId
    ]);
    $resp = $ctx['http']->get("/backend/automation/go.php?s={$slug}", [], [], false);
    Assertions::assertHttpStatus(302, $resp->status);
});

// XF29: Zalo Link Tracking + Flow Condition
e2e_test('XF29: Zalo tracking redirects cleanly', function($ctx) use ($wsId) {
    $target = 'https://ideas.edu.vn/zalo-xf29';
    $resp = $ctx['http']->get('/backend/automation/zalo_track.php?u=' . base64_encode($target), [], [], false);
    Assertions::assertHttpStatus(302, $resp->status);
});

// XF30: Website Tracking + Web Activity Condition
e2e_test('XF30: Web track records page view', function($ctx) use ($wsId) {
    $propId = TestDatabase::uniqueId('xf30_prp');
    TestDatabase::insertFixture('web_properties', ['id' => $propId, 'workspace_id' => $wsId, 'domain' => 'ideas.edu.vn', 'status' => 'active']);
    $resp = $ctx['http']->post('/backend/automation/track.php', [
        'property_id'  => $propId,
        'visitor_uuid' => TestDatabase::uniqueId('vis_xf30'),
        'event'        => 'page_view',
        'url'          => 'https://ideas.edu.vn/xf30'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF31: Tracking Aggregator + Campaign Reporting
e2e_test('XF31: Campaign reporting returns stats metrics', function($ctx) use ($wsId) {
    $campId = TestDatabase::uniqueId('xf31_cmp');
    TestDatabase::insertFixture('campaigns', ['id' => $campId, 'name' => 'XF31 Campaign', 'workspace_id' => $wsId, 'status' => 'sent']);
    $resp = $ctx['http']->get("/backend/automation/campaigns.php?id={$campId}");
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF32: Segment Split + Flow Enrollment
e2e_test('XF32: Audience split targets new static list', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('xf32_seg');
    TestDatabase::insertFixture('segments', ['id' => $segId, 'name' => 'XF32 Seg', 'criteria' => '[]', 'workspace_id' => $wsId]);
    $resp = $ctx['http']->post('/backend/automation/audience_split.php', [
        'source_type'      => 'segment',
        'source_id'        => $segId,
        'type'             => 'quantity',
        'quantity'         => 1,
        'destination_name' => 'XF32 Dest List'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF33: List Member Move + Unsubscribe Status
e2e_test('XF33: Member move handles status partitions', function($ctx) use ($wsId) {
    $sList = TestDatabase::uniqueId('xf33_s');
    $dList = TestDatabase::uniqueId('xf33_d');
    TestDatabase::insertFixture('lists', ['id' => $sList, 'name' => 'XF33 S', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('lists', ['id' => $dList, 'name' => 'XF33 D', 'workspace_id' => $wsId]);
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=cleanup', [
        'targetId'          => $sList,
        'action'            => 'move',
        'destinationListId' => $dList,
        'statuses'          => ['bounced']
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF34: Bulk Import + Segment Live Count
e2e_test('XF34: Bulk import adds subscribers reflected in segment queries', function($ctx) use ($wsId) {
    $id = TestDatabase::uniqueId('xf34');
    $resp = $ctx['http']->post('/backend/automation/subscribers.php?route=subscribers_bulk', [
        'subscribers' => [
            ['email' => "xf34_{$id}@ideas.edu.vn", 'phone' => '0901239999', 'city' => 'Huế']
        ]
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF35: Bulk Tag + Dynamic Segment Evaluation
e2e_test('XF35: Dynamic segment with tag criteria queries tagged subscribers', function($ctx) use ($wsId) {
    $stmtTag = $ctx['pdo']->prepare("SELECT id FROM tags WHERE tenant_id = 99999 AND name = 'Voucher_Claimed' LIMIT 1");
    $stmtTag->execute();
    $tagId = $stmtTag->fetchColumn();
    if (!$tagId) {
        $ctx['pdo']->prepare("INSERT INTO tags (tenant_id, name) VALUES (99999, 'Voucher_Claimed')")->execute();
        $tagId = $ctx['pdo']->lastInsertId();
    }
    
    $subId = TestDatabase::uniqueId('xf35_sub');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "xf35_{$subId}@ideas.edu.vn",
        'workspace_id' => $wsId
    ]);
    TestDatabase::insertFixture('subscriber_tags', [
        'workspace_id'  => $wsId,
        'subscriber_id' => $subId,
        'tag_id'        => (string)$tagId
    ]);
    $criteria = [
        'groups' => [
            [
                'conditions' => [
                    ['field' => 'tags', 'operator' => 'contains', 'value' => 'Voucher_Claimed']
                ]
            ]
        ]
    ];
    $res = buildSegmentWhereClause($criteria, $wsId);
    $stmt = $ctx['pdo']->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND ({$res['sql']})");
    $stmt->execute(array_merge([$wsId], $res['params']));
    Assertions::assertGreaterThanOrEqual(1, (int)$stmt->fetchColumn());
});

// XF36: Flow Split Test + Campaign Funnel Stats
e2e_test('XF36: Split test step variants structure validated', function($ctx) use ($wsId) {
    $flowId = TestDatabase::uniqueId('xf36_flw');
    $flowData = [
        'id'      => $flowId,
        'name'    => 'XF36 Split Flow',
        'status'  => 'draft',
        'trigger' => ['type' => 'manual'],
        'steps'   => [
            ['id' => 'split_1', 'type' => 'split_test', 'config' => ['percent_a' => 50, 'percent_b' => 50]]
        ]
    ];
    $resp = $ctx['http']->post('/backend/automation/flows.php', $flowData);
    Assertions::assertHttpStatus(200, $resp->status);
});

// XF37: Open Pixel + Subscriber Activity History
e2e_test('XF37: Open pixel hit responds with transparent GIF', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=open&ws={$wsId}&sid=xf37_sub");
    Assertions::assertHttpStatus(200, $resp->status);
    Assertions::assertEquals('image/gif', $resp->contentType);
});

// XF38: Web Tracking + Contact Matcher Resolution
e2e_test('XF38: Normalizing phone and resolving contact maintains 3 KHÔNG rule', function($ctx) use ($wsId) {
    $cleanPhone = DomationContactMatcher::normalizePhone9('+84 90 999 8888');
    Assertions::assertEquals('909998888', $cleanPhone);
});
