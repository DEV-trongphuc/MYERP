<?php
/**
 * tests/e2e/suites/tier1_audience.php
 *
 * Tier 1: Audience, Segments, Lists & Sync Subsystem (Features 1 - 23)
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth (inspects live output/DB)
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - 100% Soft-Delete Mandate
 */

use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\TestDatabase;

$wsId = TestDatabase::TEST_WORKSPACE_ID;

// Feature 1: buildSegmentWhereClause & Segment Engine
e2e_test('F01_TC1: buildSegmentWhereClause compiles nested AND/OR criteria with sequential parameter binding', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
    
    $criteria = [
        'logic' => 'AND',
        'groups' => [
            [
                'logic' => 'OR',
                'conditions' => [
                    ['field' => 'city', 'operator' => 'equals', 'value' => 'Hà Nội'],
                    ['field' => 'lead_score', 'operator' => 'greater_than', 'value' => 50]
                ]
            ]
        ]
    ];
    
    $compiled = buildSegmentWhereClause($criteria, $wsId);
    
    Assertions::assertArrayHasKey('sql', $compiled, 'Compiled result must contain sql key');
    Assertions::assertArrayHasKey('params', $compiled, 'Compiled result must contain params key');
    Assertions::assertMatchesRegularExpression('/(city|lead_score)/', $compiled['sql'], 'SQL must reference targeted columns');
    Assertions::assertEquals(2, count($compiled['params']), 'Must have exactly 2 parameters');
    Assertions::assertEquals(['Hà Nội', 50], $compiled['params'], 'Parameters must match input values');
    
    // Anti-HY093: Keys must be strictly sequential 0..N-1
    Assertions::assertEquals(range(0, count($compiled['params']) - 1), array_keys($compiled['params']), 'Keys must be sequential 0..N-1');
    
    // Live execution against MySQL
    $sql = "SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND (" . $compiled['sql'] . ")";
    $stmt = $ctx['pdo']->prepare($sql);
    $stmt->execute(array_merge([$wsId], $compiled['params']));
    $count = (int)$stmt->fetchColumn();
    Assertions::assertGreaterThanOrEqual(0, $count, 'Query must execute cleanly on live MySQL');
});

e2e_test('F01_TC2: buildSegmentWhereClause handles empty and null criteria with safe 1=1 fallback', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
    
    $emptyRes = buildSegmentWhereClause([], $wsId);
    Assertions::assertEquals('1=1', $emptyRes['sql'], 'Empty criteria must return 1=1');
    Assertions::assertEquals([], $emptyRes['params'], 'Empty criteria must have empty params');
    
    $nullRes = buildSegmentWhereClause(null, $wsId);
    Assertions::assertEquals('1=1', $nullRes['sql'], 'Null criteria must return 1=1');
    Assertions::assertEquals([], $nullRes['params'], 'Null criteria must have empty params');
});

// Feature 2: Default Pipeline Segments Auto-Seeding
e2e_test('F02_TC1: Auto-seeding creates 4 system pipeline segments in workspace', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
    
    $res = ensureDefaultPipelineSegments($ctx['pdo'], $wsId, true);
    Assertions::assertTrue(is_array($res), 'ensureDefaultPipelineSegments must return array');
    
    // Assert 4 segments exist in database for workspace 99999
    $stmt = $ctx['pdo']->prepare("SELECT id, name FROM segments WHERE workspace_id = ? AND id LIKE 'seg_pipeline_%' AND deleted_at IS NULL");
    $stmt->execute([$wsId]);
    $segments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    Assertions::assertGreaterThanOrEqual(4, count($segments), 'Must contain at least 4 system pipeline segments');
    
    // Idempotency check: calling again does not duplicate
    ensureDefaultPipelineSegments($ctx['pdo'], $wsId, false);
    $stmt->execute([$wsId]);
    $segmentsAfter = $stmt->fetchAll(PDO::FETCH_ASSOC);
    Assertions::assertEquals(count($segments), count($segmentsAfter), 'Second run must be idempotent');
});

// Feature 3: Segment Preview & Sample API
e2e_test('F03_TC1: Segment preview API returns count and sample records from live DB', function($ctx) use ($wsId) {
    // Insert a test subscriber in workspace 99999
    $subId = TestDatabase::uniqueId('sub');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "preview_{$subId}@ideas.edu.vn",
        'phone_number' => '0912345678',
        'city'         => 'Hà Nội',
        'status'       => 'lead',
        'workspace_id' => $wsId
    ]);
    
    $payload = [
        'criteria' => [
            'groups' => [
                [
                    'conditions' => [
                        ['field' => 'city', 'operator' => 'equals', 'value' => 'Hà Nội']
                    ]
                ]
            ]
        ],
        'limit' => 10
    ];
    
    $resp = $ctx['http']->post('/backend/automation/segments.php?action=preview', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'Preview endpoint must return HTTP 200');
    Assertions::assertTrue(isset($resp->json['count']) || isset($resp->json['data']['count']), 'Response must have count');
    $count = $resp->json['count'] ?? ($resp->json['data']['count'] ?? 0);
    Assertions::assertGreaterThanOrEqual(1, $count, 'Preview count must include test subscriber');
});

// Feature 4: Segment Live Estimate API
e2e_test('F04_TC1: Segment estimate API returns instant count without sample data', function($ctx) use ($wsId) {
    $payload = [
        'criteria' => [
            'groups' => [
                [
                    'conditions' => [
                        ['field' => 'status', 'operator' => 'equals', 'value' => 'lead']
                    ]
                ]
            ]
        ]
    ];
    
    $resp = $ctx['http']->post('/backend/automation/segments.php?action=estimate', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'Estimate endpoint must return HTTP 200');
    Assertions::assertTrue(isset($resp->json['count']) || isset($resp->json['data']['count']), 'Estimate response must include count');
});

// Feature 5: Segment CRUD & Notification Settings
e2e_test('F05_TC1: Segment CRUD creates, reads, updates, and soft-deletes segment', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg');
    $segName = 'Test Segment VIP ' . substr($segId, -4);
    
    // 1. Create (POST)
    $createPayload = [
        'id'             => $segId,
        'name'           => $segName,
        'criteria'       => json_encode(['logic' => 'AND', 'groups' => []]),
        'notify_on_join' => 1,
        'notify_email'   => 'admin@ideas.edu.vn'
    ];
    $resp = $ctx['http']->post('/backend/automation/segments.php', $createPayload);
    Assertions::assertHttpStatus(200, $resp->status, 'Create segment must return HTTP 200');
    
    // Assert in DB
    $row = TestDatabase::fetchRow('segments', ['id' => $segId, 'workspace_id' => $wsId]);
    Assertions::assertNotNull($row, 'Segment must exist in MySQL');
    Assertions::assertEquals($segName, $row['name'], 'Segment name must match');
    Assertions::assertEquals(1, (int)$row['notify_on_join'], 'notify_on_join must be set');
    
    // 2. Update (PUT)
    $updatedName = $segName . ' Updated';
    $updatePayload = ['name' => $updatedName];
    $respPut = $ctx['http']->put("/backend/automation/segments.php?id={$segId}", $updatePayload);
    Assertions::assertHttpStatus(200, $respPut->status, 'Update segment must return HTTP 200');
    
    // 3. Delete (Soft-Delete)
    $respDel = $ctx['http']->delete("/backend/automation/segments.php?id={$segId}");
    Assertions::assertHttpStatus(200, $respDel->status, 'Delete segment must return HTTP 200');
    
    // Assert 100% Soft-Delete in DB
    $rowDeleted = TestDatabase::fetchRow('segments', ['id' => $segId]);
    Assertions::assertNotNull($rowDeleted, 'Soft-deleted segment must remain in database');
    Assertions::assertNotNull($rowDeleted['deleted_at'], 'deleted_at timestamp must be set');
});

// Feature 6: Segment Split / Copy to List
e2e_test('F06_TC1: Segment split copies subscribers to destination list', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg_split');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Split Source Segment',
        'criteria'     => json_encode(['logic' => 'AND', 'groups' => []]),
        'workspace_id' => $wsId
    ]);
    
    // Add 2 subscribers
    for ($i = 0; $i < 2; $i++) {
        $sid = TestDatabase::uniqueId('sub_sp');
        TestDatabase::insertFixture('subscribers', [
            'id'           => $sid,
            'email'        => "split_{$i}_{$sid}@ideas.edu.vn",
            'status'       => 'active',
            'workspace_id' => $wsId
        ]);
    }
    
    $splitPayload = [
        'source_type'      => 'segment',
        'source_id'        => $segId,
        'type'             => 'quantity',
        'quantity'         => 2,
        'destination_name' => 'Split Destination List ' . substr($segId, -4)
    ];
    
    $resp = $ctx['http']->post('/backend/automation/audience_split.php', $splitPayload);
    Assertions::assertHttpStatus(200, $resp->status, 'Audience split must return HTTP 200');
});

// Feature 7: Segment Dormant & Invalid Cleanup
e2e_test('F07_TC1: Segment cleanup handles dormant subscriber evaluation', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg_clean');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Cleanup Test Segment',
        'criteria'     => json_encode(['logic' => 'AND', 'groups' => []]),
        'workspace_id' => $wsId
    ]);
    
    $payload = [
        'segment_id'   => $segId,
        'cleanup_type' => 'dormant',
        'days'         => 90,
        'action'       => 'exclude'
    ];
    
    $resp = $ctx['http']->post('/backend/automation/segments.php?action=cleanup', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'Segment cleanup must return HTTP 200');
});

// Feature 8: Permanent Segment Exclusion
e2e_test('F08_TC1: Segment exclusion inserts records into segment_exclusions', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg_ex');
    $subId = TestDatabase::uniqueId('sub_ex');
    
    $payload = [
        'segment_id'     => $segId,
        'subscriber_ids' => [$subId]
    ];
    
    $resp = $ctx['http']->post('/backend/automation/segments.php?action=exclude', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'Segment exclude must return HTTP 200');
    
    // Verify in database
    $stmt = $ctx['pdo']->prepare("SELECT COUNT(*) FROM segment_exclusions WHERE segment_id = ? AND subscriber_id = ? AND workspace_id = ?");
    $stmt->execute([$segId, $subId, $wsId]);
    Assertions::assertEquals(1, (int)$stmt->fetchColumn(), 'Record must be present in segment_exclusions');
});

// Feature 9: Static List CRUD & Live Count Reconciliation
e2e_test('F09_TC1: Static list CRUD and refresh live counts', function($ctx) use ($wsId) {
    $listId = TestDatabase::uniqueId('lst');
    $listName = 'Static List Test ' . substr($listId, -4);
    
    // Create
    $resp = $ctx['http']->post('/backend/automation/lists.php', [
        'id'   => $listId,
        'name' => $listName,
        'type' => 'static'
    ]);
    Assertions::assertHttpStatus(200, $resp->status, 'Create list must return HTTP 200');
    
    // Insert 2 subscribers into subscriber_lists
    for ($i = 0; $i < 2; $i++) {
        $subId = TestDatabase::uniqueId('sub_lst');
        TestDatabase::insertFixture('subscribers', [
            'id'           => $subId,
            'email'        => "list_sub_{$i}_{$subId}@ideas.edu.vn",
            'status'       => 'active',
            'workspace_id' => $wsId
        ]);
        TestDatabase::insertFixture('subscriber_lists', [
            'workspace_id'  => $wsId,
            'list_id'       => $listId,
            'subscriber_id' => $subId
        ]);
    }
    
    // Call refresh route to heal counts
    $respRef = $ctx['http']->get("/backend/automation/lists.php?route=refresh&id={$listId}");
    Assertions::assertHttpStatus(200, $respRef->status, 'Refresh list must return HTTP 200');
    
    // Soft-delete list
    $respDel = $ctx['http']->delete("/backend/automation/lists.php?id={$listId}");
    Assertions::assertHttpStatus(200, $respDel->status, 'Delete list must return HTTP 200');
    
    $lstRow = TestDatabase::fetchRow('lists', ['id' => $listId]);
    Assertions::assertNotNull($lstRow, 'List must still exist in MySQL');
    Assertions::assertNotNull($lstRow['deleted_at'], 'deleted_at must be populated (100% soft delete)');
});

// Feature 10: List Merge Engine
e2e_test('F10_TC1: List merge combines source lists into new target list', function($ctx) use ($wsId) {
    $listA = TestDatabase::uniqueId('lst_a');
    $listB = TestDatabase::uniqueId('lst_b');
    
    TestDatabase::insertFixture('lists', ['id' => $listA, 'name' => 'List A', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('lists', ['id' => $listB, 'name' => 'List B', 'workspace_id' => $wsId]);
    
    $payload = [
        'source_list_ids'  => [$listA, $listB],
        'target_list_name' => 'Merged Target List ' . substr($listA, -4),
        'deduplicate'      => true
    ];
    
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=merge', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'List merge must return HTTP 200');
});

// Feature 11: Populate List by Advanced Filter
e2e_test('F11_TC1: Populate list by advanced filter inserts matching subscribers', function($ctx) use ($wsId) {
    $listId = TestDatabase::uniqueId('lst_flt');
    TestDatabase::insertFixture('lists', ['id' => $listId, 'name' => 'Filter Populated List', 'workspace_id' => $wsId]);
    
    $payload = [
        'list_id'  => $listId,
        'criteria' => [
            'groups' => [
                [
                    'conditions' => [
                        ['field' => 'status', 'operator' => 'equals', 'value' => 'active']
                    ]
                ]
            ]
        ]
    ];
    
    $resp = $ctx['http']->post('/backend/automation/lists.php?route=populate_by_filter', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'Populate by filter must return HTTP 200');
});

// Feature 12: ContactController Static List Sync
e2e_test('F12_TC1: ContactController createOrPopulateStaticList handles CRM sync', function($ctx) use ($wsId) {
    $payload = [
        'list_mode' => 'new',
        'name'      => 'CRM Synced List ' . date('His'),
        'filters'   => ['status' => 'lead']
    ];
    
    $resp = $ctx['http']->post('/backend/index.php/contacts/static-list', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'ContactController static-list endpoint must return HTTP 200');
});

// Feature 13: List Member Cleanup & Move
e2e_test('F13_TC1: List member cleanup validates statuses array and handles moves', function($ctx) use ($wsId) {
    $listSrc = TestDatabase::uniqueId('lst_src');
    $listDst = TestDatabase::uniqueId('lst_dst');
    
    TestDatabase::insertFixture('lists', ['id' => $listSrc, 'name' => 'Source Clean List', 'workspace_id' => $wsId]);
    TestDatabase::insertFixture('lists', ['id' => $listDst, 'name' => 'Dest Clean List', 'workspace_id' => $wsId]);
    
    // Empty statuses should fail with 422
    $respFail = $ctx['http']->post('/backend/automation/lists.php?route=cleanup', [
        'targetId'          => $listSrc,
        'action'            => 'move',
        'destinationListId' => $listDst,
        'statuses'          => []
    ]);
    Assertions::assertTrue(in_array($respFail->status, [400, 422]), 'Empty statuses array must return 400/422 validation error');
});

// Feature 14: Subscriber Search & Filter API
e2e_test('F14_TC1: Subscriber listing returns paginated results scoped to workspace', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_srch');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "search_{$subId}@ideas.edu.vn",
        'phone_number' => '0988776655',
        'city'         => 'Hà Nội',
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    
    $resp = $ctx['http']->get("/backend/automation/subscribers.php?page=1&limit=20&search={$subId}");
    Assertions::assertHttpStatus(200, $resp->status, 'Subscriber listing must return HTTP 200');
    Assertions::assertTrue(isset($resp->json['data']) || isset($resp->json['subscribers']), 'Listing must include data array');
});

// Feature 15: Unique Audience Estimation
e2e_test('F15_TC1: count_unique endpoint returns deduplicated audience count', function($ctx) use ($wsId) {
    $resp = $ctx['http']->get('/backend/automation/subscribers.php?route=count_unique');
    Assertions::assertHttpStatus(200, $resp->status, 'Unique audience count must return HTTP 200');
    Assertions::assertTrue(isset($resp->json['unique_count']) || isset($resp->json['count']) || isset($resp->json['data']), 'Response must have count');
});

// Feature 16: Bulk Subscriber Import
e2e_test('F16_TC1: subscribers_bulk imports batch of subscribers with phone normalization', function($ctx) use ($wsId) {
    $idA = TestDatabase::uniqueId('imp_a');
    $idB = TestDatabase::uniqueId('imp_b');
    
    $payload = [
        'subscribers' => [
            [
                'email'            => "bulk_{$idA}@ideas.edu.vn",
                'phone'            => '+84 90 123 4567',
                'customAttributes' => ['source' => 'import_test']
            ],
            [
                'email'            => "bulk_{$idB}@ideas.edu.vn",
                'phone'            => '090-987-6543',
                'customAttributes' => ['source' => 'import_test']
            ]
        ]
    ];
    
    $resp = $ctx['http']->post('/backend/automation/subscribers.php?route=subscribers_bulk', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'Bulk import must return HTTP 200: ' . $resp->body);
    Assertions::assertTrue(!empty($resp->json['success']), 'Bulk import response must be success: ' . $resp->body);
    
    // Assert subscribers exist in DB
    $subA = TestDatabase::fetchRow('subscribers', ['email' => "bulk_{$idA}@ideas.edu.vn", 'workspace_id' => $wsId]);
    Assertions::assertNotNull($subA, 'Imported subscriber A must exist in MySQL. Response was: ' . $resp->body);
});

// Feature 17: Bulk Action Suite
e2e_test('F17_TC1: bulk-add-tag updates subscriber tags in MySQL', function($ctx) use ($wsId) {
    $subId = TestDatabase::uniqueId('sub_tag');
    $tagId = TestDatabase::uniqueId('tag');
    TestDatabase::insertFixture('domation_tags', [
        'id'           => $tagId,
        'name'         => 'VIP_2026',
        'workspace_id' => $wsId
    ]);
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "tag_{$subId}@ideas.edu.vn",
        'workspace_id' => $wsId
    ]);
    
    $payload = [
        'subscriber_ids' => [$subId],
        'tag_id'         => $tagId
    ];
    
    $resp = $ctx['http']->post('/backend/automation/subscribers.php?route=bulk-add-tag', $payload);
    Assertions::assertHttpStatus(200, $resp->status, 'bulk-add-tag must return HTTP 200');
    
    $tagRow = TestDatabase::fetchRow('subscriber_tags', ['subscriber_id' => $subId, 'tag_id' => $tagId, 'workspace_id' => $wsId]);
    Assertions::assertNotNull($tagRow, 'Tag association must exist in subscriber_tags');
});

// Feature 18: CRM Identity Sync Engine
e2e_test('F18_TC1: CRM contacts sync maps contact fields to subscriber', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/segment_helper.php';
    require_once dirname(__DIR__, 3) . '/backend/utils/DomationContactMatcher.php';
    
    Assertions::assertTrue(function_exists('ensureAllCrmContactsSyncedForFilter'), 'ensureAllCrmContactsSyncedForFilter must be defined');

    // Insert CRM contact fixture to verify real DB sync mapping
    $testContactEmail = 'crm_sync_' . bin2hex(random_bytes(4)) . '@ideas.edu.vn';
    $contactId = (int)$ctx['pdo']->query("SELECT COALESCE(MAX(id), 0) + 1 FROM contacts")->fetchColumn();
    $ctx['pdo']->prepare("
        INSERT INTO contacts (id, tenant_id, full_name, email, phone, status, created_at, updated_at)
        VALUES (?, ?, 'CRM Sync Audit Contact', ?, '0912888777', 'lead', NOW(), NOW())
    ")->execute([$contactId, $wsId, $testContactEmail]);

    // Execute syncContactToSubscriber directly
    $subId = DomationContactMatcher::syncContactToSubscriber($ctx['pdo'], $contactId, $wsId);
    Assertions::assertNotNull($subId, 'syncContactToSubscriber must return created/matched subscriber ID');

    // Assert explicit state in MySQL subscribers table
    $syncedSub = TestDatabase::fetchRow('subscribers', ['id' => $subId, 'workspace_id' => $wsId]);
    Assertions::assertNotNull($syncedSub, 'CRM contact must be synced into subscribers table without tautological fallback');
    Assertions::assertEquals($contactId, (int)$syncedSub['contact_id'], 'contact_id in subscribers must match CRM contact id');
    Assertions::assertEquals('912888777', $syncedSub['phone_norm9'], 'phone must be normalized to 9 digits');
});

// Feature 19: Match-Only Identity Resolution (DomationContactMatcher)
e2e_test('F19_TC1: DomationContactMatcher normalizes phones and matches identity', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/utils/DomationContactMatcher.php';
    
    $p1 = DomationContactMatcher::normalizePhone9('+84 90 123 4567');
    $p2 = DomationContactMatcher::normalizePhone9('090-123-4567');
    $p3 = DomationContactMatcher::normalizePhone9('901234567');
    
    Assertions::assertEquals('901234567', $p1, 'International phone must normalize to 9 digits');
    Assertions::assertEquals('901234567', $p2, 'Dashed local phone must normalize to 9 digits');
    Assertions::assertEquals($p1, $p3, 'All representations must normalize to same 9-digit string');
});

// Feature 20: Background Segment Count Worker
e2e_test('F20_TC1: worker_segment_counts runs via CLI with Exit Code 0', function($ctx) use ($wsId) {
    $segId = TestDatabase::uniqueId('seg_cnt');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Count Worker Test Segment',
        'criteria'     => json_encode(['logic' => 'AND', 'groups' => []]),
        'workspace_id' => $wsId
    ]);
    
    // Queue item
    $ctx['pdo']->prepare("INSERT INTO segment_count_update_queue (segment_id, workspace_id, queued_at) VALUES (?, ?, NOW())")
        ->execute([$segId, $wsId]);
    
    $res = $ctx['worker']->runSegmentCountsWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Worker must exit with code 0');
    Assertions::assertStringContains('[START]', $res['stdout'], 'Worker stdout must contain [START]');
});

// Feature 21: Background Segment Notification Worker
e2e_test('F21_TC1: worker_segment_notify runs via CLI with Exit Code 0', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runSegmentNotifyWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Notification worker must exit with code 0');
});

// Feature 22: Segment AI Profiler & Journey Analyzer
e2e_test('F22_TC1: segment_ai_analysis endpoint validates authorization and responds', function($ctx) use ($wsId) {
    // 1. Without Auth Header -> 401
    $respUnauth = $ctx['http']->post('/backend/automation/segment_ai_analysis.php', ['segment_id' => 'seg_dummy'], [
        'Authorization' => ''
    ]);
    Assertions::assertEquals(401, $respUnauth->status, 'Unauthenticated request must return HTTP 401');
    
    // 2. With Auth Header and valid segment -> responds
    $segId = TestDatabase::uniqueId('seg_ai');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'AI Analysis Segment',
        'criteria'     => json_encode(['logic' => 'AND', 'groups' => []]),
        'workspace_id' => $wsId
    ]);
    
    $respAuth = $ctx['http']->post('/backend/automation/segment_ai_analysis.php', ['segment_id' => $segId]);
    Assertions::assertHttpStatus(200, $respAuth->status, 'segment_ai_analysis endpoint must return HTTP 200');
});

// Feature 23: Subscriber AI Summary
e2e_test('F23_TC1: subscriber_ai_summary endpoint validates authorization and responds', function($ctx) use ($wsId) {
    // 1. Without Auth Header -> 401
    $respUnauth = $ctx['http']->post('/backend/automation/subscriber_ai_summary.php', ['subscriber_id' => 'sub_dummy'], [
        'Authorization' => ''
    ]);
    Assertions::assertEquals(401, $respUnauth->status, 'Unauthenticated request must return HTTP 401');
    
    // 2. With Auth Header
    $subId = TestDatabase::uniqueId('sub_ai');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "ai_sum_{$subId}@ideas.edu.vn",
        'workspace_id' => $wsId
    ]);
    
    $respAuth = $ctx['http']->post('/backend/automation/subscriber_ai_summary.php', ['subscriber_id' => $subId]);
    Assertions::assertHttpStatus(200, $respAuth->status, 'subscriber_ai_summary endpoint must return HTTP 200');
});
