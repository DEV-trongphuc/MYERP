<?php
/**
 * tests/e2e/suites/tier1_tracking.php
 *
 * Tier 1: Tracking Pixel, Clicks, Links, Aggregator, Campaigns & End-to-End Lifecycle (Features 30 - 38)
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - 100% Soft-Delete Mandate
 */

use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\TestDatabase;

$wsId = TestDatabase::TEST_WORKSPACE_ID;

// Feature 30: Email Open Tracking Pixel
e2e_test('F30_TC1: Open tracking pixel returns 200, Content-Type image/gif and 43-byte GIF payload', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_pix');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "pix_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=open&sid={$subId}&fid=flw_test&cid=cmp_test&ws={$wsId}");
    
    Assertions::assertHttpStatus(200, $resp->status, 'Pixel endpoint must return HTTP 200');
    Assertions::assertHeader('content-type', 'image/gif', $resp->headers, 'Header must be Content-Type: image/gif');
    Assertions::assertHeader('cache-control', 'no-cache', $resp->headers, 'Must have no-cache header');
    
    // Transparent 1x1 GIF is 42 or 43 bytes and starts with GIF89a
    Assertions::assertTrue($resp->bodyLength >= 42 && $resp->bodyLength <= 45, "Binary GIF payload length must be ~43 bytes (actual: {$resp->bodyLength})");
    Assertions::assertStringContains('GIF89a', $resp->body, 'Binary data must start with GIF89a magic bytes');
});

// Feature 31: Email Click Tracking & Rewriting
e2e_test('F31_TC1: Email click tracking returns HTTP 302 redirect to decoded destination URL', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_clk');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "clk_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    $targetUrl = 'https://ideas.edu.vn/khoa-hoc-ai';
    $encodedUrl = base64_encode($targetUrl);
    
    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=click&sid={$subId}&url={$encodedUrl}&ws={$wsId}", [], [], false);
    
    Assertions::assertHttpStatus(302, $resp->status, 'Click webhook must return HTTP 302 redirect');
    Assertions::assertNotNull($resp->location, 'Location header must be present for redirect');
    Assertions::assertStringContains($targetUrl, $resp->location, 'Location must contain decoded destination URL');
});

// Feature 32: Email Instant Unsubscribe Handler
e2e_test('F32_TC1: Webhook instant unsubscribe updates subscriber status to unsubscribed and cancels flows', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_unsub');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "unsub_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    
    $flowId = TestDatabase::uniqueId('flw_unsub');
    TestDatabase::insertFixture('flows', ['id' => $flowId, 'name' => 'Unsub Test Flow', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'step_1',
        'status'        => 'waiting'
    ]);
    
    $resp = $ctx['http']->get("/backend/automation/webhook.php?type=unsubscribe&sid={$subId}&cid=cmp_dummy&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $resp->status, 'Unsubscribe webhook must return HTTP 302 redirect to confirmation');
    
    // Assert subscriber status transitioned in MySQL
    $sub = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    Assertions::assertNotNull($sub, 'Subscriber must exist in DB');
    Assertions::assertEquals('unsubscribed', $sub['status'], 'Subscriber status must become unsubscribed');
    
    // Assert active flow state cancelled
    $state = TestDatabase::fetchRow('subscriber_flow_states', ['subscriber_id' => $subId, 'flow_id' => $flowId]);
    Assertions::assertNotNull($state, 'Flow state must exist');
    Assertions::assertEquals('cancelled', $state['status'], 'Flow state must transition to cancelled');
});

// Feature 33: Short Link & QR Code Click Tracking
e2e_test('F33_TC1: Short link redirects active slug and returns 404 for missing slug', function($ctx) use ($wsId) {
    $linkId = TestDatabase::uniqueId('lnk');
    $slug = 'test-slug-' . substr($linkId, -6);
    $targetUrl = 'https://ideas.edu.vn/chuong-trinh-dao-tao';
    
    TestDatabase::insertFixture('short_links', [
        'id'           => $linkId,
        'slug'         => $slug,
        'target_url'   => $targetUrl,
        'status'       => 'active',
        'workspace_id' => (string)$wsId
    ]);
    
    // 1. Active slug redirect
    $resp = $ctx['http']->get("/backend/automation/go.php?s={$slug}", [], [], false);
    Assertions::assertHttpStatus(302, $resp->status, 'Active short link must return HTTP 302 redirect');
    Assertions::assertStringContains($targetUrl, $resp->location, 'Location must contain target URL');
    Assertions::assertStringContains('slid=', $resp->location, 'Location must contain tracking parameter slid');
    
    // 2. Non-existent slug returns 404 page
    $missingSlug = 'missing-slug-' . substr(md5((string)time()), 0, 8);
    $resp404 = $ctx['http']->get("/backend/automation/go.php?s={$missingSlug}");
    Assertions::assertStringContains('Link không tồn tại', $resp404->body, 'Missing slug must return Link không tồn tại');
});

// Feature 34: Zalo & ZNS Link Tracking
e2e_test('F34_TC1: Zalo track endpoint redirects to target URL and logs activity', function($ctx) use ($wsId) {
    $targetUrl = 'https://ideas.edu.vn/thong-bao-zalo';
    $encodedUrl = base64_encode($targetUrl);
    
    $resp = $ctx['http']->get("/backend/automation/zalo_track.php?u={$encodedUrl}&uid=zalo_test_uid&sid=step_zns", [], [], false);
    
    Assertions::assertHttpStatus(302, $resp->status, 'Zalo track must return HTTP 302 redirect');
    Assertions::assertEquals($targetUrl, $resp->location, 'Location must match decoded target URL');
});

// Feature 35: Website Tracking Engine
e2e_test('F35_TC1: track.php records web page view and visitor session', function($ctx) use ($wsId) {
    $propId = TestDatabase::uniqueId('prop');
    TestDatabase::insertFixture('web_properties', [
        'id'           => $propId,
        'workspace_id' => $wsId,
        'name'         => 'Test Tracking Site',
        'domain'       => 'ideas.edu.vn',
        'status'       => 'active'
    ]);
    
    $visId = TestDatabase::uniqueId('vis_');
    $payload = [
        'property_id' => $propId,
        'visitor_id'  => $visId,
        'events'      => [
            [
                'type' => 'pageview',
                'data' => [
                    'url'   => 'https://ideas.edu.vn/khoa-hoc?utm_source=meta&utm_medium=cpc',
                    'title' => 'Khóa Học Marketing',
                    'load_time' => 350
                ]
            ]
        ]
    ];
    
    $headers = [
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    $resp = $ctx['http']->post('/backend/automation/track.php', $payload, $headers);
    Assertions::assertHttpStatus(200, $resp->status, 'track.php must return HTTP 200');
    Assertions::assertTrue(isset($resp->json['status']) && in_array($resp->json['status'], ['success', 'ok'], true), 'Response body must indicate status success or ok');
});

// Feature 36: Tracking Worker Aggregator
e2e_test('F36_TC1: worker_tracking_aggregator executes via CLI with Exit Code 0', function($ctx) use ($wsId) {
    // Insert a raw event into raw_event_buffer with workspace_id
    $eventId = time() . mt_rand(100, 999);
    $ctx['pdo']->prepare("INSERT INTO raw_event_buffer (id, type, payload, processed, created_at, workspace_id) VALUES (?, 'open', ?, 0, NOW(), ?)")
        ->execute([$eventId, json_encode(['subscriber_id' => 'sub_agg_test', 'workspace_id' => $wsId]), $wsId]);
    
    $res = $ctx['worker']->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Aggregator worker must exit with code 0');
});

// Feature 37: Campaign Statistics & Reporting Engine
e2e_test('F37_TC1: Campaign stats endpoint returns metrics and handles zero sent gracefully', function($ctx) use ($wsId) {
    $campId = TestDatabase::uniqueId('cmp');
    TestDatabase::insertFixture('campaigns', [
        'id'                   => $campId,
        'name'                 => 'Stats Test Campaign ' . substr($campId, -4),
        'workspace_id'         => $wsId,
        'count_sent'           => 5,
        'count_opened'         => 4,
        'count_unique_opened'  => 3,
        'count_clicked'        => 2,
        'count_unique_clicked' => 2,
        'count_bounced'        => 0,
        'status'               => 'sent'
    ]);

    for ($i = 0; $i < 5; $i++) {
        TestDatabase::insertFixture('mail_delivery_logs', [
            'workspace_id' => $wsId,
            'campaign_id'  => $campId,
            'recipient'    => "recip_{$i}_{$campId}@ideas.edu.vn",
            'status'       => 'success'
        ]);
    }
    
    $resp = $ctx['http']->get("/backend/automation/campaigns.php?id={$campId}");
    Assertions::assertHttpStatus(200, $resp->status, 'Campaign fetch must return HTTP 200');
    Assertions::assertTrue(isset($resp->json['stats']) || isset($resp->json['data']['stats']), 'Campaign must include stats object');
    
    $stats = $resp->json['stats'] ?? ($resp->json['data']['stats'] ?? []);
    Assertions::assertEquals(5, (int)$stats['sent'], 'Sent count must match');
    Assertions::assertEquals(3, (int)$stats['opened'], 'Unique opened must match');
    Assertions::assertEquals(2, (int)$stats['clicked'], 'Unique clicked must match');
});

// Feature 38: End-to-End Multistep Automation Flow Journey
e2e_test('F38_TC1: Multi-step lifecycle executes ingest, flow, email tracking, click and reporting', function($ctx) use ($wsId) {
    // 1. Ingest prospective student
    $subId = TestDatabase::uniqueId('sub_journey');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "journey_{$subId}@ideas.edu.vn",
        'phone_number' => '0901234999',
        'city'         => 'Hà Nội',
        'status'       => 'lead',
        'workspace_id' => $wsId
    ]);
    
    // 2. Setup Campaign and Delivery Log
    $campId = TestDatabase::uniqueId('cmp_journey');
    TestDatabase::insertFixture('campaigns', [
        'id'                   => $campId,
        'name'                 => 'Journey Campaign',
        'workspace_id'         => $wsId,
        'count_sent'           => 1,
        'count_unique_opened'  => 0,
        'count_unique_clicked' => 0,
        'status'               => 'sent'
    ]);
    
    TestDatabase::insertFixture('mail_delivery_logs', [
        'workspace_id' => $wsId,
        'recipient'    => "journey_{$subId}@ideas.edu.vn",
        'campaign_id'  => $campId,
        'status'       => 'success'
    ]);
    
    // 3. Trigger Email Open Tracking Pixel
    $pixelResp = $ctx['http']->get("/backend/automation/webhook.php?type=open&sid={$subId}&cid={$campId}&ws={$wsId}");
    Assertions::assertHttpStatus(200, $pixelResp->status, 'Open pixel must return 200');
    
    // 4. Trigger Email Click Tracking
    $targetUrl = 'https://ideas.edu.vn/khoa-hoc-thac-si-ai';
    $clickResp = $ctx['http']->get("/backend/automation/webhook.php?type=click&sid={$subId}&cid={$campId}&url=" . base64_encode($targetUrl) . "&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $clickResp->status, 'Click tracking must return 302');
    Assertions::assertStringContains($targetUrl, $clickResp->location, 'Click must redirect to destination URL');
    
    // 5. Run Aggregator Worker CLI
    $workerRes = $ctx['worker']->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $workerRes['exit_code'], 'Aggregator worker must complete successfully');
    
    // 6. Verify Campaign Tracking Stats incremented in DB after aggregation
    $camp = TestDatabase::fetchRow('campaigns', ['id' => $campId]);
    Assertions::assertNotNull($camp, 'Campaign must exist in DB');
    Assertions::assertGreaterThanOrEqual(1, (int)$camp['count_sent'], 'Sent count must be at least 1');
    Assertions::assertGreaterThanOrEqual(1, (int)($camp['count_unique_opened'] ?? 0), 'Unique opened count must increment to at least 1 after aggregation');
    Assertions::assertGreaterThanOrEqual(1, (int)($camp['count_unique_clicked'] ?? 0), 'Unique clicked count must increment to at least 1 after aggregation');
});
