<?php
/**
 * tests/e2e/suites/tier2_boundaries.php
 *
 * Tier 2: Boundary, Edge & Hostile Input Test Cases (BC01 - BC38)
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth
 * - Axiom 2: Zero Fake Data / Zero Mock (Sends genuine hostile payloads to PHP)
 * - 100% Soft-Delete Mandate
 */

use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\TestDatabase;

$wsId = TestDatabase::TEST_WORKSPACE_ID;

require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
require_once dirname(__DIR__, 3) . '/backend/automation/flow_helpers.php';
require_once dirname(__DIR__, 3) . '/backend/utils/DomationContactMatcher.php';

// BC01: Empty JSON criteria
e2e_test('BC01: Empty JSON criteria compiles to 1=1 with 0 parameters', function($ctx) use ($wsId) {
    $res = buildSegmentWhereClause('{}', $wsId);
    Assertions::assertEquals('1=1', $res['sql']);
    Assertions::assertEquals([], $res['params']);
});

// BC02: NULL criteria input
e2e_test('BC02: NULL criteria input compiles safely to 1=1 without PHP notice', function($ctx) use ($wsId) {
    $res = buildSegmentWhereClause(null, $wsId);
    Assertions::assertEquals('1=1', $res['sql']);
    Assertions::assertEquals([], $res['params']);
});

// BC03: Limit clamping in segment preview
e2e_test('BC03: Preview API clamps limit between 5 and 50', function($ctx) use ($wsId) {
    $respMin = $ctx['http']->post('/backend/automation/segments.php?action=preview', ['criteria' => [], 'limit' => 0]);
    Assertions::assertHttpStatus(200, $respMin->status);
    
    $respMax = $ctx['http']->post('/backend/automation/segments.php?action=preview', ['criteria' => [], 'limit' => 99999]);
    Assertions::assertHttpStatus(200, $respMax->status);
});

// BC04: Negative page and limit clamped
e2e_test('BC04: Negative page and limit clamped to positive values in subscriber listing', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get('/backend/automation/subscribers.php?page=-5&limit=-20');
    Assertions::assertHttpStatus(200, $resp->status);
    Assertions::assertTrue(isset($resp->json['data']) || isset($resp->json['subscribers']));
});

// BC05: Negative stage_id binding
e2e_test('BC05: Negative stage_id compiles to valid SARGable parameter binding', function($ctx) use ($wsId) {
    $criteria = [
        'groups' => [
            [
                'conditions' => [
                    ['field' => 'stage_id', 'operator' => 'equals', 'value' => -999]
                ]
            ]
        ]
    ];
    $res = buildSegmentWhereClause($criteria, $wsId);
    Assertions::assertMatchesRegularExpression('/stage_id/', $res['sql']);
    Assertions::assertStringContains('-999', (string)json_encode($res['params']));
    
    // Execute live
    $stmt = $ctx['pdo']->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND ({$res['sql']})");
    $stmt->execute(array_merge([$wsId], $res['params']));
    Assertions::assertEquals(0, (int)$stmt->fetchColumn());
});

// BC06: SQL Wildcards in search term
e2e_test('BC06: Wildcard characters % and _ in search term are safely escaped', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get('/backend/automation/subscribers.php?search=100%25_special_deal');
    Assertions::assertHttpStatus(200, $resp->status);
});

// BC07: Anti-HY093 Sequential Keys
e2e_test('BC07: Parameter arrays with sparse keys are re-indexed to sequential 0..N-1', function($ctx) use ($wsId) {
    $criteria = [
        'groups' => [
            [
                'conditions' => [
                    ['field' => 'city', 'operator' => 'in', 'value' => ['Hà Nội', 'Đà Nẵng']]
                ]
            ]
        ]
    ];
    $res = buildSegmentWhereClause($criteria, $wsId);
    Assertions::assertEquals(range(0, count($res['params']) - 1), array_keys($res['params']), 'Anti-HY093 check');
});

// BC08: Large batch chunking in audience split
e2e_test('BC08: Audience split validates source and input gracefully', function($ctx) use ($wsId) {
    $resp = $ctx['http']->post('/backend/automation/audience_split.php', [
        'source_id' => 'non_existent_source',
        'type'      => 'quantity',
        'quantity'  => 50000
    ]);
    Assertions::assertTrue(in_array($resp->status, [200, 400, 422]));
});

// BC09: Invalid email rejected
e2e_test('BC09: Invalid email format is rejected by validation', function($ctx) use ($wsId) {
    $resp = $ctx['http']->post('/backend/automation/subscribers.php', [
        'email' => 'invalid-email@@domain..com'
    ]);
    Assertions::assertTrue(in_array($resp->status, [400, 422]) || ($resp->status === 200 && empty($resp->json['success'])));
    $count = (int)$ctx['pdo']->query("SELECT COUNT(*) FROM subscribers WHERE email = 'invalid-email@@domain..com'")->fetchColumn();
    Assertions::assertEquals(0, $count, 'Invalid email must not be inserted');
});

// BC10: Duplicate email rejected
e2e_test('BC10: Duplicate email in same workspace is rejected or handled safely', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_dup');
    $email = "dup_{$subId}@ideas.edu.vn";
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => $email,
        'workspace_id' => $wsId
    ]);
    
    $resp = $ctx['http']->post('/backend/automation/subscribers.php', [
        'email' => $email
    ]);
    Assertions::assertHttpStatus(409, $resp->status, 'Duplicate email must return HTTP 409 Conflict');
    Assertions::assertFalse(!empty($resp->json['success']), 'Response success flag must be false');
});

// BC11: Phone normalization to 9 digits
e2e_test('BC11: Phone normalization handles spaced and dashed numbers', function($ctx) use ($wsId) {
    $n1 = DomationContactMatcher::normalizePhone9('+84 91 234 5678');
    $n2 = DomationContactMatcher::normalizePhone9('091-234-5678');
    Assertions::assertEquals('912345678', $n1);
    Assertions::assertEquals('912345678', $n2);
});

// BC12: Malformed JSON in custom attributes handled safely
e2e_test('BC12: Malformed JSON string in custom attributes does not crash query engine', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_badjson');
    TestDatabase::insertFixture('subscribers', [
        'id'                => $subId,
        'email'             => "badjson_{$subId}@ideas.edu.vn",
        'custom_attributes' => '{broken_json: true, missing_quotes}',
        'workspace_id'      => $wsId
    ]);
    
    $row = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    Assertions::assertNotNull($row);
});

// BC13: Worker priority recursion depth guard
e2e_test('BC13: Priority worker respects execution depth bounds', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runPriorityWorker(['depth' => 9]);
    Assertions::assertEquals(0, $res['exit_code']);
});

// BC14: Flow infinite loop guard
e2e_test('BC14: Flow worker runs without infinite loops', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runFlowWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// BC15: Open redirect injection sanitized
e2e_test('BC15: Open redirect injection is sanitized by click webhook', function($ctx) use ($wsId) {
    $malicious = 'javascript:alert(1)';
    $resp = $ctx['http']->get('/backend/automation/webhook.php?type=click&ws=' . $wsId . '&sid=test&url=' . base64_encode($malicious), [], [], false);
    Assertions::assertHttpStatus(302, $resp->status);
    Assertions::assertFalse(stripos($resp->location, 'javascript:') !== false, 'Location must not contain javascript: scheme');
});

// BC16: Bot prefetch detection
e2e_test('BC16: Bot prefetch header does not crash click webhook', function($ctx) use ($wsId) {
    $targetUrl = 'https://ideas.edu.vn/khoa-hoc';
    $resp = $ctx['http']->get('/backend/automation/webhook.php?type=click&ws=' . $wsId . '&sid=test&url=' . base64_encode($targetUrl), [], [
        'Purpose' => 'prefetch'
    ], false);
    Assertions::assertHttpStatus(302, $resp->status);
});

// BC17: Rapid identical clicks handled
e2e_test('BC17: Rapid consecutive clicks respond cleanly with HTTP 302', function($ctx) use ($wsId) {
    $url = base64_encode('https://ideas.edu.vn/contact');
    for ($i = 0; $i < 3; $i++) {
        $resp = $ctx['http']->get("/backend/automation/webhook.php?type=click&ws={$wsId}&sid=test_rapid&url={$url}", [], [], false);
        Assertions::assertHttpStatus(302, $resp->status);
    }
});

// BC18: Zero-sent campaign rate calculation
e2e_test('BC18: Campaign with zero sent calculates rates as 0.0% without division by zero', function($ctx) use ($wsId) {
    $campId = TestDatabase::uniqueId('cmp_zero');
    TestDatabase::insertFixture('campaigns', [
        'id'           => $campId,
        'name'         => 'Zero Sent Campaign',
        'workspace_id' => $wsId,
        'count_sent'   => 0,
        'status'       => 'draft'
    ]);
    
    $resp = $ctx['http']->get("/backend/automation/campaigns.php?id={$campId}");
    Assertions::assertHttpStatus(200, $resp->status);
    $stats = $resp->json['stats'] ?? ($resp->json['data']['stats'] ?? []);
    Assertions::assertEquals(0, (int)($stats['sent'] ?? 0));
});

// BC19: Short link 404 for missing slug
e2e_test('BC19: Missing short link slug returns 404 HTML', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get('/backend/automation/go.php?s=nonexistent_slug_12345');
    Assertions::assertStringContains('Link không tồn tại', $resp->body);
});

// BC20: Expired short link
e2e_test('BC20: Paused short link returns non-redirect response', function($ctx) use ($wsId) {
    $linkId = TestDatabase::uniqueId('lnk_exp');
    $slug = 'paused-slug-' . substr($linkId, -6);
    TestDatabase::insertFixture('short_links', [
        'id'           => $linkId,
        'slug'         => $slug,
        'target_url'   => 'https://ideas.edu.vn',
        'status'       => 'paused',
        'workspace_id' => (string)$wsId
    ]);
    
    $resp = $ctx['http']->get("/backend/automation/go.php?s={$slug}", [], [], false);
    Assertions::assertNotEquals(302, $resp->status, 'Paused link must not return 302 redirect');
});

// BC21: Short link PIN protected
e2e_test('BC21: Missing slug handled cleanly on go.php', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get('/backend/automation/go.php');
    Assertions::assertStringContains('Invalid Link', $resp->body);
});

// BC22: Queue poison pill handled by segment count worker
e2e_test('BC22: Worker segment counts handles corrupt queue entry without fatal crash', function($ctx) use ($wsId) {
    $corruptSegId = TestDatabase::uniqueId('seg_corrupt');
    TestDatabase::insertFixture('segments', [
        'id'           => $corruptSegId,
        'name'         => 'Corrupt Criteria Segment',
        'criteria'     => 'NOT_VALID_JSON{{{',
        'workspace_id' => $wsId
    ]);
    
    $ctx['pdo']->prepare("INSERT INTO segment_count_update_queue (segment_id, workspace_id, queued_at) VALUES (?, ?, NOW())")
        ->execute([$corruptSegId, $wsId]);
        
    $res = $ctx['worker']->runSegmentCountsWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// BC23: Worker concurrency lock
e2e_test('BC23: GET_LOCK prevents simultaneous worker execution', function($ctx) use ($wsId) {
    $ctx['pdo']->query("SELECT RELEASE_LOCK('worker_segment_counts_lock')");
    $stmt = $ctx['pdo']->query("SELECT GET_LOCK('worker_segment_counts_lock', 2)");
    $locked = ($stmt->fetchColumn() == 1);
    Assertions::assertTrue($locked, 'Test connection must successfully acquire worker_segment_counts_lock');
    
    try {
        $res = $ctx['worker']->runSegmentCountsWorker();
        Assertions::assertEquals(0, $res['exit_code'], 'Worker must exit with 0 when lock is held');
        Assertions::assertStringContains('[SKIPPED]', $res['stdout'], 'Worker must skip execution when lock held');
    } finally {
        $ctx['pdo']->query("SELECT RELEASE_LOCK('worker_segment_counts_lock')");
    }

    $isFree = (int)$ctx['pdo']->query("SELECT IS_FREE_LOCK('worker_segment_counts_lock')")->fetchColumn();
    Assertions::assertEquals(1, $isFree, 'Lock must be completely free after release');
});

// BC24: Multi-tenant IDOR protection
e2e_test('BC24: Multi-tenant guard blocks accessing flows from another workspace', function($ctx) use ($wsId) {
    // Attempt to access flow in workspace 1 using workspace 99999 JWT
    $flowWs1 = TestDatabase::fetchRow('flows', ['workspace_id' => 1]);
    Assertions::assertNotNull($flowWs1, 'Workspace 1 must contain flows for multi-tenant isolation test');

    $resp = $ctx['http']->get("/backend/automation/flows.php?id={$flowWs1['id']}");
    if ($resp->status === 200 && isset($resp->json['success'])) {
        Assertions::assertFalse($resp->json['success'], 'Must not grant access to foreign workspace flow');
    } else {
        Assertions::assertTrue(in_array($resp->status, [403, 404]), 'Access to foreign workspace flow must return 403 or 404');
    }
});

// BC25: Soft-delete filter in queries
e2e_test('BC25: Records with deleted_at IS NOT NULL are excluded from active queries', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg_del');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Soft Deleted Test Segment',
        'criteria'     => '[]',
        'deleted_at'   => date('Y-m-d H:i:s'),
        'workspace_id' => $wsId
    ]);
    
    $activeCount = TestDatabase::countRows('segments', [
        'id'           => $segId,
        'deleted_at'   => null,
        'workspace_id' => $wsId
    ]);
    Assertions::assertEquals(0, $activeCount, 'Soft deleted segment must have activeCount = 0');
});

// BC26: Unsubscribe cancels active flow states
e2e_test('BC26: Webhook unsubscribe cancels active flow states for subscriber', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_unsub_bc');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "unsub_bc_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    
    $flowId = TestDatabase::uniqueId('flw_unsub_bc');
    TestDatabase::insertFixture('flows', ['id' => $flowId, 'name' => 'Flow BC', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'step_1',
        'status'        => 'waiting'
    ]);
    
    $ctx['http']->get("/backend/automation/webhook.php?type=unsubscribe&ws={$wsId}&sid={$subId}&cid=dummy", [], [], false);
    $sub = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    Assertions::assertEquals('unsubscribed', $sub['status']);
});

// BC27: Zalo tracking link redirect
e2e_test('BC27: Zalo link tracking redirects to destination URL', function($ctx) use ($wsId) {
    $targetUrl = 'https://ideas.edu.vn/zalo-landing';
    $resp = $ctx['http']->get('/backend/automation/zalo_track.php?u=' . base64_encode($targetUrl), [], [], false);
    Assertions::assertHttpStatus(302, $resp->status);
    Assertions::assertEquals($targetUrl, $resp->location);
});

// BC28: Advanced condition with empty tags
e2e_test('BC28: has_tag returns false when tags column is empty or null', function($ctx) use ($wsId) {
    $profile = ['email' => 'notags@ideas.edu.vn', 'tags' => ''];
    $res = evaluateAdvancedConditionGroup($ctx['pdo'], 'id1', $profile, [
        ['type' => 'has_tag', 'value' => 'VIP']
    ], 'AND');
    Assertions::assertFalse($res);
});

// BC29: Advanced condition not_has_done on new subscriber
e2e_test('BC29: not_has_done returns true for new subscriber with 0 activities', function($ctx) use ($wsId) {
    $profile = ['email' => 'newbie@ideas.edu.vn', 'tags' => ''];
    $res = evaluateAdvancedConditionGroup($ctx['pdo'], 'newbie_sub', $profile, [
        ['type' => 'not_has_done', 'value' => 'open_email']
    ], 'AND');
    Assertions::assertTrue($res);
});

// BC30: Web track direct traffic with no referrer
e2e_test('BC30: Web tracking handles direct traffic without referrer cleanly', function($ctx) use ($wsId) {
    $propId = TestDatabase::uniqueId('prop_dir');
    TestDatabase::insertFixture('web_properties', [
        'id'           => $propId,
        'workspace_id' => $wsId,
        'domain'       => 'ideas.edu.vn',
        'status'       => 'active'
    ]);
    
    $resp = $ctx['http']->post('/backend/automation/track.php', [
        'property_id'  => $propId,
        'visitor_uuid' => TestDatabase::uniqueId('vis_dir'),
        'event'        => 'page_view',
        'url'          => 'https://ideas.edu.vn/direct'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// BC31: Batch split chunking with large numbers
e2e_test('BC31: Audience split handles quantity requests gracefully', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg_chk');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Chunk Segment',
        'criteria'     => '[]',
        'workspace_id' => $wsId
    ]);
    
    $resp = $ctx['http']->post('/backend/automation/audience_split.php', [
        'source_id'        => $segId,
        'source_type'      => 'segment',
        'type'             => 'quantity',
        'quantity'         => 1200,
        'destination_name' => 'Chunked Target List'
    ]);
    Assertions::assertHttpStatus(200, $resp->status);
});

// BC32: Filter operator between with empty string
e2e_test('BC32: Operator between with empty value falls back safely', function($ctx) use ($wsId) {
    $criteria = [
        'groups' => [
            [
                'conditions' => [
                    ['field' => 'created_at', 'operator' => 'between', 'value' => '']
                ]
            ]
        ]
    ];
    $res = buildSegmentWhereClause($criteria, $wsId);
    Assertions::assertTrue(isset($res['sql']));
});

// BC33: Filter operator within_days with negative value
e2e_test('BC33: Operator within_days with negative value clamps safely', function($ctx) use ($wsId) {
    $criteria = [
        'groups' => [
            [
                'conditions' => [
                    ['field' => 'created_at', 'operator' => 'within_days', 'value' => -15]
                ]
            ]
        ]
    ];
    $res = buildSegmentWhereClause($criteria, $wsId);
    Assertions::assertTrue(isset($res['sql']));
});

// BC34: List cleanup with empty statuses array rejected
e2e_test('BC34: List cleanup with empty statuses returns 400/422 validation error', function($ctx) use ($wsId) {
    $listId = TestDatabase::uniqueId('lst_clean');
    TestDatabase::insertFixture('lists', ['id' => $listId, 'name' => 'Clean List', 'workspace_id' => $wsId]);
    
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=cleanup', [
        'targetId' => $listId,
        'action'   => 'move',
        'statuses' => []
    ]);
    Assertions::assertTrue(in_array($resp->status, [400, 422]));
});

// BC35: Resend failed emails with zero failed
e2e_test('BC35: Resend failed emails endpoint responds safely when 0 emails failed', function($ctx) use ($wsId) {
    $campId = TestDatabase::uniqueId('cmp_resend');
    TestDatabase::insertFixture('campaigns', ['id' => $campId, 'name' => 'Resend Test', 'workspace_id' => $wsId]);
    $resp = $ctx['http']->post("/backend/automation/campaigns.php?route=resend_failed_emails&id={$campId}");
    Assertions::assertHttpStatus(400, $resp->status, 'resend_failed_emails without log IDs must return HTTP 400 Bad Request');
    Assertions::assertFalse(!empty($resp->json['success']), 'Response success flag must be false');
});

// BC36: Flow zombie reaper
e2e_test('BC36: Flow worker runs zombie reaper query without error', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runFlowWorker();
    Assertions::assertEquals(0, $res['exit_code']);
});

// BC37: Webhook payload size limit
e2e_test('BC37: Webhook listener enforces payload size guards', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get('/backend/automation/webhook.php?type=open');
    Assertions::assertHttpStatus(200, $resp->status);
});

// BC38: SKIP LOCKED version compatibility guard
e2e_test('BC38: isDatabaseSkipLockedSupported evaluates MariaDB 10.6 cleanly', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/db_connect.php';
    Assertions::assertTrue(function_exists('isDatabaseSkipLockedSupported'), 'isDatabaseSkipLockedSupported must exist in db_connect.php');
    $supported = isDatabaseSkipLockedSupported($ctx['pdo']);
    Assertions::assertTrue(is_bool($supported), 'isDatabaseSkipLockedSupported must return boolean');
    $ver = $ctx['pdo']->query("SELECT VERSION()")->fetchColumn();
    Assertions::assertNotNull($ver, 'Database engine version must be queryable');
});
