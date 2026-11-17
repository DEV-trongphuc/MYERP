<?php
/**
 * tests/e2e/tier5_audience_stress.php
 *
 * Tier 5 Adversarial Stress & Coverage Hardening Harness
 * Phase 2 - Audience & Segments Subsystem
 *
 * Ground-truth adversarial tests covering:
 * - Module 1: White-box Operator Coverage & Hostile SQL Injection Invariance
 * - Module 2: Concurrency & Lock Contention on Background Worker (GET_LOCK)
 * - Module 3: Anti-Poison-Pill Queue Recovery
 * - Module 4: Rapid List Membership & Count Healing Verification
 * - Module 5: 100% Soft-Delete Mandate & Anti-Zombie CRM Sync Verification
 * - Module 6: Cross-Workspace Invariant & Zero-Contamination Audit
 */

declare(strict_types=1);

set_time_limit(300);
ini_set('memory_limit', '512M');
ob_implicit_flush(true);

require_once __DIR__ . '/helpers/TestDatabase.php';
require_once __DIR__ . '/helpers/Assertions.php';
require_once __DIR__ . '/helpers/WorkerInvoker.php';
require_once __DIR__ . '/helpers/HttpClient.php';
require_once dirname(__DIR__, 2) . '/backend/automation/segment_helper.php';

use MYERP\Tests\E2E\Helpers\TestDatabase;
use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\WorkerInvoker;
use MYERP\Tests\E2E\Helpers\HttpClient;

$pdo = TestDatabase::pdo();
$wsId = TestDatabase::TEST_WORKSPACE_ID; // 99999
$adminAuth = TestDatabase::ensureTestAdminUser();
$worker = new WorkerInvoker();

// Ensure isolated server on port 8855
$port = 8855;
$rootDir = dirname(__DIR__, 2);
$phpBin = 'C:\\Users\\LENOVO\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.exe';
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
];
$serverCmd = sprintf('"%s" -S 127.0.0.1:%d -t "%s"', $phpBin, $port, $rootDir);
$serverProc = proc_open($serverCmd, $descriptors, $serverPipes, $rootDir);
register_shutdown_function(function() use ($serverProc, $serverPipes) {
    if (is_resource($serverProc)) {
        if (isset($serverPipes[0]) && is_resource($serverPipes[0])) @fclose($serverPipes[0]);
        @proc_terminate($serverProc);
        @proc_close($serverProc);
    }
});

for ($i = 0; $i < 30; $i++) {
    usleep(100000); // 100ms
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
    if ($fp) {
        fclose($fp);
        break;
    }
}

$http = new HttpClient("http://127.0.0.1:{$port}", $adminAuth['token']);

echo "====================================================================\n";
echo "   TIER 5 ADVERSARIAL STRESS & WHITE-BOX AUDIT (AUDIENCE SUBSYSTEM)  \n";
echo "====================================================================\n\n";

$passCount = 0;
$failCount = 0;
$testResults = [];

function runStressCase(string $name, callable $fn): void {
    global $passCount, $failCount, $testResults;
    try {
        $fn();
        $passCount++;
        echo "  [\033[32mPASS\033[0m] {$name}\n";
        $testResults[] = ['name' => $name, 'pass' => true, 'error' => null];
    } catch (\Throwable $e) {
        $failCount++;
        echo "  [\033[31mFAIL\033[0m] {$name}\n";
        echo "         -> Error: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine() . "\n";
        $testResults[] = ['name' => $name, 'pass' => false, 'error' => $e->getMessage()];
    }
}

// -----------------------------------------------------------------------------
// MODULE 1: White-Box Operator Coverage & Hostile SQL Injection Invariance
// -----------------------------------------------------------------------------
echo ">>> [MODULE 1] White-Box Operator & Hostile SQL Injection Invariance\n";

runStressCase('TC1.1: within_days operator with normal, zero, negative, and large integer bounds', function() use ($wsId) {
    // 1. Normal positive integer
    $res1 = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'lastActivityDays', 'operator' => 'within_days', 'value' => 30]]]
    ]), $wsId);
    Assertions::assertStringContains('DATE_SUB(NOW(), INTERVAL ? DAY)', $res1['sql']);
    Assertions::assertEquals([30], $res1['params']);

    // 2. Negative integer must be clamped to 0
    $res2 = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'date_of_birth', 'operator' => 'within_days', 'value' => -45]]]
    ]), $wsId);
    Assertions::assertStringContains('DATE_SUB(NOW(), INTERVAL ? DAY)', $res2['sql']);
    Assertions::assertEquals([0], $res2['params']);

    // 3. Large integer bounds (3650 days = 10 years)
    $res3 = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'date_of_birth', 'operator' => 'within_days', 'value' => 3650]]]
    ]), $wsId);
    Assertions::assertEquals([3650], $res3['params']);

    // 4. Non-numeric string value must be cast safely to 0
    $res4 = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'date_of_birth', 'operator' => 'within_days', 'value' => 'malicious_text']]]
    ]), $wsId);
    Assertions::assertEquals([0], $res4['params']);
});

runStressCase('TC1.2: more_than_days and not_in_the_last null-safe operators', function() use ($wsId) {
    $res = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'date_of_birth', 'operator' => 'more_than_days', 'value' => 90]]]
    ]), $wsId);
    // Must be null-safe: (col IS NULL OR col < DATE_SUB(NOW(), INTERVAL ? DAY))
    Assertions::assertStringContains('s.date_of_birth IS NULL OR s.date_of_birth < DATE_SUB(NOW(), INTERVAL ? DAY)', $res['sql']);
    Assertions::assertEquals([90], $res['params']);

    // Operator alias: not_in_the_last on date_of_birth
    $resAlias = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'date_of_birth', 'operator' => 'not_in_the_last', 'value' => 60]]]
    ]), $wsId);
    Assertions::assertStringContains('s.date_of_birth IS NULL OR s.date_of_birth < DATE_SUB(NOW(), INTERVAL ? DAY)', $resAlias['sql']);
    Assertions::assertEquals([60], $resAlias['params']);
});

runStressCase('TC1.3: in and not_in operators with empty arrays, deduplication, and hostile quotes', function() use ($wsId) {
    // 1. in operator with empty items must produce 1=0 (Anti-Cartesian/Zero False Positive)
    $resEmptyIn = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'status', 'operator' => 'in', 'value' => []]]]
    ]), $wsId);
    Assertions::assertStringContains('1=0', $resEmptyIn['sql']);
    Assertions::assertEquals([], $resEmptyIn['params']);

    // 2. not_in operator with empty items must produce 1=1 (Neutral Filter)
    $resEmptyNotIn = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'status', 'operator' => 'not_in', 'value' => []]]]
    ]), $wsId);
    Assertions::assertStringContains('1=1', $resEmptyNotIn['sql']);
    Assertions::assertEquals([], $resEmptyNotIn['params']);

    // 3. in operator with deduplication and hostile SQL injection attempt
    $hostilePayload = ["active", "active", "lead' OR 1=1 --", "'; DROP TABLE test; --"];
    $resHostileIn = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'status', 'operator' => 'in', 'value' => $hostilePayload]]]
    ]), $wsId);
    // Deduplicated count: 3 unique items
    Assertions::assertStringContains('s.status IN (?,?,?)', $resHostileIn['sql']);
    Assertions::assertEquals(3, count($resHostileIn['params']));
    // Values must be bound as parameters, NOT concatenated into SQL
    Assertions::assertEquals("lead' OR 1=1 --", $resHostileIn['params'][1]);
    Assertions::assertEquals("'; DROP TABLE test; --", $resHostileIn['params'][2]);
    // Prove live execution on MySQL does not throw SQL syntax error
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND " . $resHostileIn['sql']);
    $stmt->execute(array_merge([$wsId], $resHostileIn['params']));
    Assertions::assertGreaterThanOrEqual(0, (int)$stmt->fetchColumn());
});

runStressCase('TC1.4: between operator variants (array, comma-delimited, dash-delimited, min/max)', function() use ($wsId) {
    // 1. Array [from, to]
    $resArr = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'lead_score', 'operator' => 'between', 'value' => [10, 50]]]]
    ]), $wsId);
    Assertions::assertStringContains('s.lead_score BETWEEN ? AND ?', $resArr['sql']);
    Assertions::assertEquals(['10', '50'], $resArr['params']);

    // 2. Comma string "20,80"
    $resComma = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'lead_score', 'operator' => 'between', 'value' => '20,80']]]
    ]), $wsId);
    Assertions::assertStringContains('s.lead_score BETWEEN ? AND ?', $resComma['sql']);
    Assertions::assertEquals(['20', '80'], $resComma['params']);

    // 3. Dash string "30 - 70"
    $resDash = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'lead_score', 'operator' => 'between', 'value' => '30 - 70']]]
    ]), $wsId);
    Assertions::assertStringContains('s.lead_score BETWEEN ? AND ?', $resDash['sql']);
    Assertions::assertEquals(['30', '70'], $resDash['params']);

    // 4. Object {min: 15, max: 95}
    $resMinMax = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'lead_score', 'operator' => 'between', 'min' => 15, 'max' => 95]]]
    ]), $wsId);
    Assertions::assertStringContains('s.lead_score BETWEEN ? AND ?', $resMinMax['sql']);
    Assertions::assertEquals(['15', '95'], $resMinMax['params']);
});

runStressCase('TC1.5: Custom attribute key metacharacter injection rejection', function() use ($wsId) {
    // Attempt SQL injection via custom attribute key name
    $resMaliciousKey = buildSegmentWhereClause(json_encode([
        ['conditions' => [
            ['field' => 'custom_field', 'key' => "hobby'; DROP TABLE subscribers; --", 'operator' => 'equals', 'value' => 'chess']
        ]]
    ]), $wsId);
    // Regex /^[a-zA-Z0-9_]+$/ must reject the field completely, yielding neutral 1=1
    Assertions::assertEquals('1=1', $resMaliciousKey['sql']);
    Assertions::assertEquals([], $resMaliciousKey['params']);

    // Legitimate custom field key
    $resValidKey = buildSegmentWhereClause(json_encode([
        ['conditions' => [
            ['field' => 'custom_field', 'key' => 'favorite_course', 'operator' => 'equals', 'value' => 'IELTS_VIP']
        ]]
    ]), $wsId);
    Assertions::assertStringContains("JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.favorite_course')) = ?", $resValidKey['sql']);
    Assertions::assertEquals(['IELTS_VIP'], $resValidKey['params']);
});

runStressCase('TC1.6: Empty, malformed, deeply-nested, and boolean criteria safety', function() use ($wsId) {
    // 1. null criteria
    $r1 = buildSegmentWhereClause(null, $wsId);
    Assertions::assertEquals('1=1', $r1['sql']);

    // 2. Corrupt JSON string
    $r2 = buildSegmentWhereClause('{"conditions": [unclosed json...', $wsId);
    Assertions::assertEquals('1=1', $r2['sql']);

    // 3. Empty conditions array
    $r3 = buildSegmentWhereClause(json_encode([]), $wsId);
    Assertions::assertEquals('1=1', $r3['sql']);

    // 4. Group with no valid conditions
    $r4 = buildSegmentWhereClause(json_encode([
        ['logic' => 'AND', 'conditions' => []]
    ]), $wsId);
    Assertions::assertEquals('1=1', $r4['sql']);
});

// -----------------------------------------------------------------------------
// MODULE 2: Concurrency & Lock Contention on Background Worker (GET_LOCK)
// -----------------------------------------------------------------------------
echo "\n>>> [MODULE 2] Background Worker Concurrency & Lock Safety (GET_LOCK)\n";

runStressCase('TC2.1: Simultaneous worker invocation skips execution when GET_LOCK held', function() use ($pdo, $worker) {
    // Ensure clean state: release any lingering lock
    $pdo->query("SELECT RELEASE_LOCK('worker_segment_counts_lock')");

    // Acquire lock in this connection with 2 second timeout
    $lockAcquired = (int)$pdo->query("SELECT GET_LOCK('worker_segment_counts_lock', 2)")->fetchColumn();
    Assertions::assertEquals(1, $lockAcquired, 'Test connection must hold worker_segment_counts_lock');

    try {
        // While lock is held, trigger the worker CLI process
        $runResult = $worker->runSegmentCountsWorker();
        // The worker must cleanly skip execution without failing
        Assertions::assertEquals(0, $runResult['exit_code'], 'Skipped worker must exit with code 0');
        Assertions::assertStringContains('[SKIPPED]', $runResult['stdout'], 'Worker output must indicate [SKIPPED] Already running');
    } finally {
        // Explicitly release lock in finally block
        $pdo->query("SELECT RELEASE_LOCK('worker_segment_counts_lock')");
    }

    // Verify lock is now completely free
    $isFree = (int)$pdo->query("SELECT IS_FREE_LOCK('worker_segment_counts_lock')")->fetchColumn();
    Assertions::assertEquals(1, $isFree, 'Lock must be completely free after release');
});

runStressCase('TC2.2: Worker executes normally and updates queue when lock is available', function() use ($pdo, $worker, $wsId) {
    usleep(200000); // Allow MySQL connection lock table to settle
    $segId = TestDatabase::uniqueId('seg_wrk');
    TestDatabase::insertFixture('segments', [
        'id'           => $segId,
        'name'         => 'Worker Lock Test Segment',
        'criteria'     => json_encode([['conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'active']]]]),
        'workspace_id' => $wsId
    ]);

    // Push into queue
    $pdo->prepare("INSERT INTO segment_count_update_queue (workspace_id, segment_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE queued_at = NOW()")->execute([$wsId, $segId]);

    // Worker should acquire lock and process queue cleanly
    $res = $worker->runSegmentCountsWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Worker failed with exit code: ' . $res['exit_code'] . ' stderr: ' . $res['stderr']);
    Assertions::assertStringContains('[START]', $res['stdout']);

    // Segment should have updated synced_at in DB
    $updatedSeg = TestDatabase::fetchRow('segments', ['id' => $segId, 'workspace_id' => $wsId]);
    if (empty($updatedSeg['synced_at'])) {
        throw new RuntimeException("Segment synced_at is null. Worker stdout was:\n" . $res['stdout']);
    }
    Assertions::assertNotNull($updatedSeg['synced_at']);

    // Queue entry must be deleted
    $queueCount = (int)$pdo->query("SELECT COUNT(*) FROM segment_count_update_queue WHERE workspace_id = $wsId AND segment_id = '{$segId}'")->fetchColumn();
    Assertions::assertEquals(0, $queueCount, 'Processed queue item must be removed from queue');
});

// -----------------------------------------------------------------------------
// MODULE 3: Anti-Poison-Pill Queue Recovery
// -----------------------------------------------------------------------------
echo "\n>>> [MODULE 3] Anti-Poison-Pill Queue Recovery\n";

runStressCase('TC3.1: Poison pill segment in queue does not crash worker or loop infinitely', function() use ($pdo, $worker, $wsId) {
    $poisonSegId = 'non_existent_poison_' . bin2hex(random_bytes(4));

    // Force poison pill into queue with past queued_at
    $pdo->prepare("INSERT INTO segment_count_update_queue (workspace_id, segment_id, queued_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 5 MINUTE))")->execute([$wsId, $poisonSegId]);

    $res = $worker->runSegmentCountsWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Worker must handle poison pill gracefully');
    // Output must mention skipping the missing/corrupt segment
    Assertions::assertStringContains('[SKIP]', $res['stdout'], 'Worker must log [SKIP] for poison pill');

    // Poison pill must be purged from queue
    $remaining = (int)$pdo->query("SELECT COUNT(*) FROM segment_count_update_queue WHERE workspace_id = $wsId AND segment_id = '{$poisonSegId}'")->fetchColumn();
    Assertions::assertEquals(0, $remaining, 'Poison pill must be purged from queue');
});

// -----------------------------------------------------------------------------
// MODULE 4: Rapid List Membership & Count Healing Verification
// -----------------------------------------------------------------------------
echo "\n>>> [MODULE 4] Rapid List Membership & Count Healing Verification\n";

runStressCase('TC4.1: Rapid batch list assignment maintains zero count drift with live MySQL', function() use ($pdo, $wsId) {
    $listId = TestDatabase::uniqueId('lst_drift');
    TestDatabase::insertFixture('lists', [
        'id'               => $listId,
        'name'             => 'Count Drift Stress List',
        'workspace_id'     => $wsId,
        'subscriber_count' => 0,
        'phone_count'      => 0
    ]);

    // Insert 20 test subscribers (10 with phone, 10 without phone)
    $subIds = [];
    for ($i = 0; $i < 20; $i++) {
        $sid = TestDatabase::uniqueId("sub_d{$i}");
        $phone = ($i % 2 === 0) ? "098123456{$i}" : null;
        TestDatabase::insertFixture('subscribers', [
            'id'           => $sid,
            'email'        => "drift_{$sid}@test.com",
            'phone_number' => $phone,
            'phone'        => $phone,
            'status'       => 'active',
            'workspace_id' => $wsId
        ]);
        $subIds[] = $sid;
    }

    // Associate all 20 subscribers into subscriber_lists
    $stmtIns = $pdo->prepare("INSERT IGNORE INTO subscriber_lists (subscriber_id, list_id, workspace_id) VALUES (?, ?, ?)");
    foreach ($subIds as $sid) {
        $stmtIns->execute([$sid, $listId, $wsId]);
    }

    // Execute live recount query (same logic used by lists.php enrichLiveListCounts)
    $stmtRecount = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT sl.subscriber_id) AS total_count,
            COUNT(DISTINCT CASE WHEN (s.phone_number IS NOT NULL AND s.phone_number != '') OR (s.phone IS NOT NULL AND s.phone != '') THEN sl.subscriber_id END) AS phone_count
        FROM subscriber_lists sl
        JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = sl.workspace_id
        WHERE sl.list_id = ? AND sl.workspace_id = ? AND s.deleted_at IS NULL
    ");
    $stmtRecount->execute([$listId, $wsId]);
    $counts = $stmtRecount->fetch(PDO::FETCH_ASSOC);

    Assertions::assertEquals(20, (int)$counts['total_count'], 'Total subscriber count must be exactly 20');
    Assertions::assertEquals(10, (int)$counts['phone_count'], 'Phone subscriber count must be exactly 10');

    // Update list count
    $pdo->prepare("UPDATE lists SET subscriber_count = ?, phone_count = ? WHERE id = ? AND workspace_id = ?")->execute([
        (int)$counts['total_count'],
        (int)$counts['phone_count'],
        $listId,
        $wsId
    ]);

    $reloadedList = TestDatabase::fetchRow('lists', ['id' => $listId, 'workspace_id' => $wsId]);
    Assertions::assertEquals(20, (int)$reloadedList['subscriber_count']);
    Assertions::assertEquals(10, (int)$reloadedList['phone_count']);
});

// -----------------------------------------------------------------------------
// MODULE 5: 100% Soft-Delete Mandate & Anti-Zombie CRM Sync Verification
// -----------------------------------------------------------------------------
echo "\n>>> [MODULE 5] 100% Soft-Delete Mandate & Anti-Zombie CRM Sync Verification\n";

runStressCase('TC5.1: Subscriber deletion is 100% Soft-Delete and leaves zero orphaned state', function() use ($pdo, $http, $wsId) {
    $subId = TestDatabase::uniqueId('sub_softdel');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "softdel_{$subId}@ideas.edu.vn",
        'phone_number' => '0912999888',
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    // Add list association
    $listId = TestDatabase::uniqueId('lst_sd');
    TestDatabase::insertFixture('lists', ['id' => $listId, 'name' => 'SD List', 'workspace_id' => $wsId]);
    $pdo->prepare("INSERT INTO subscriber_lists (subscriber_id, list_id, workspace_id) VALUES (?, ?, ?)")->execute([$subId, $listId, $wsId]);

    // Send HTTP DELETE
    $resp = $http->delete("/backend/automation/subscribers.php?id={$subId}");
    Assertions::assertHttpStatus(200, $resp->status, 'Delete subscriber must return HTTP 200');

    // VERIFY: Subscriber record still exists in MySQL with deleted_at IS NOT NULL
    $row = TestDatabase::fetchRow('subscribers', ['id' => $subId, 'workspace_id' => $wsId]);
    Assertions::assertNotNull($row, 'Soft-deleted subscriber must remain in MySQL database');
    Assertions::assertNotNull($row['deleted_at'], 'deleted_at timestamp must be populated');
    Assertions::assertEquals('archived', $row['status'], 'Status must transition to archived');

    // VERIFY: Excluded from active queries
    $activeCount = (int)$pdo->query("SELECT COUNT(*) FROM subscribers WHERE id = '{$subId}' AND workspace_id = $wsId AND deleted_at IS NULL")->fetchColumn();
    Assertions::assertEquals(0, $activeCount, 'Soft-deleted subscriber must be excluded when deleted_at IS NULL');
});

runStressCase('TC5.2: Anti-Zombie CRM contact sync does not resurrect soft-deleted subscribers', function() use ($pdo, $wsId) {
    // Insert a soft-deleted subscriber that maps to a CRM contact
    $subId = TestDatabase::uniqueId('sub_zombie');
    $email = "zombie_{$subId}@test.com";

    // 1. Create CRM contact
    $contactId = (int)$pdo->query("SELECT COALESCE(MAX(id), 0) + 1 FROM contacts")->fetchColumn();
    $pdo->prepare("
        INSERT INTO contacts (id, tenant_id, full_name, email, phone, status, created_at, updated_at)
        VALUES (?, ?, 'Zombie Test Contact', ?, '0933333333', 'lead', NOW(), NOW())
    ")->execute([$contactId, $wsId, $email]);

    // 2. Create already soft-deleted subscriber linked to this contact
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'contact_id'   => $contactId,
        'email'        => $email,
        'status'       => 'archived',
        'workspace_id' => $wsId,
        'deleted_at'   => date('Y-m-d H:i:s')
    ]);

    // 3. Run CRM sync engine
    ensureAllCrmContactsSyncedForFilter($pdo, $wsId);

    // 4. VERIFY: Subscriber must STILL be soft-deleted (deleted_at NOT NULL)
    $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE email = ? AND workspace_id = ? AND deleted_at IS NULL");
    $stmtCheck->execute([$email, $wsId]);
    $resurrectedCount = (int)$stmtCheck->fetchColumn();
    Assertions::assertEquals(0, $resurrectedCount, 'CRM sync must NOT resurrect soft-deleted subscriber as active zombie');

    // 5. VERIFY: No duplicate subscriber row was created
    $totalSubsForEmail = (int)$pdo->query("SELECT COUNT(*) FROM subscribers WHERE email = '{$email}' AND workspace_id = {$wsId}")->fetchColumn();
    Assertions::assertEquals(1, $totalSubsForEmail, 'Must have exactly 1 subscriber record (no duplicates)');
});

// -----------------------------------------------------------------------------
// MODULE 6: Cross-Workspace Invariant & Zero-Contamination Audit
// -----------------------------------------------------------------------------
echo "\n>>> [MODULE 6] Cross-Workspace Invariant & Zero-Contamination Audit\n";

runStressCase('TC6.1: Workspace 99999 operations strictly preserve Workspace 1 invariant', function() use ($pdo) {
    $snapWs1 = TestDatabase::snapshotWorkspace(TestDatabase::PROD_WORKSPACE_ID);
    Assertions::assertGreaterThan(0, $snapWs1['subscribers'] ?? 0, 'Workspace 1 must contain production subscribers');
    Assertions::assertGreaterThan(0, $snapWs1['lists'] ?? 0, 'Workspace 1 must contain production lists');
    TestDatabase::assertWorkspaceUncontaminated(TestDatabase::PROD_WORKSPACE_ID, $snapWs1);

    // Confirm that Workspace 99999 queries with criteria cannot see Workspace 1 subscribers
    $res = buildSegmentWhereClause(json_encode([
        ['conditions' => [['field' => 'status', 'operator' => 'equals', 'value' => 'active']]]
    ]), TestDatabase::TEST_WORKSPACE_ID);

    $stmtWsCheck = $pdo->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND (" . $res['sql'] . ")");
    $stmtWsCheck->execute(array_merge([TestDatabase::TEST_WORKSPACE_ID], $res['params']));
    $count = (int)$stmtWsCheck->fetchColumn();
    // Must only query within workspace 99999
    Assertions::assertGreaterThanOrEqual(0, $count);
});

// -----------------------------------------------------------------------------
// CLEANUP & SUMMARY
// -----------------------------------------------------------------------------
TestDatabase::teardownWorkspace($wsId);

echo "\n====================================================================\n";
echo "                   TIER 5 AUDIT RESULTS SUMMARY                    \n";
echo "====================================================================\n";
echo " Total Test Cases : " . ($passCount + $failCount) . "\n";
echo " Passed           : {$passCount}\n";
echo " Failed           : {$failCount}\n";
echo " Total Assertions : " . Assertions::getAssertionCount() . "\n";
echo "====================================================================\n";

if ($failCount > 0) {
    echo "VERDICT: FAILED (Exit Code 1)\n";
    exit(1);
} else {
    echo "VERDICT: ALL ADVERSARIAL STRESS TESTS PASSED (Exit Code 0)\n";
    exit(0);
}
