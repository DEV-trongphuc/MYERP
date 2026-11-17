<?php
/**
 * verify_wait_set_time_fix.php
 *
 * Independent Empirical Adversarial Verification Suite for Wait / Set-Time Hotfix
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth (connects directly to live MariaDB)
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - Axiom 4: 100% Soft-Delete Mandate
 * - Workspace 1 Invariant Guarantee (ws=99999 isolated execution)
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '1');
date_default_timezone_set('Asia/Ho_Chi_Minh');

$rootDir = __DIR__;
require_once $rootDir . '/backend/automation/db_connect.php';
require_once $rootDir . '/backend/automation/flow_helpers.php';
require_once $rootDir . '/tests/e2e/helpers/TestDatabase.php';
require_once $rootDir . '/tests/e2e/helpers/Assertions.php';

use MYERP\Tests\E2E\Helpers\TestDatabase;
use MYERP\Tests\E2E\Helpers\Assertions;

$pdo = TestDatabase::pdo();
$wsId = TestDatabase::TEST_WORKSPACE_ID; // 99999

echo "\n====================================================================\n";
echo "    VERIFY WAIT / SET-TIME PRODUCTION HOTFIX (15 ADVERSARIAL CHECKS) \n";
echo "====================================================================\n\n";

// Snapshot Workspace 1 Invariant
$ws1SnapBefore = TestDatabase::snapshotWorkspace(TestDatabase::PROD_WORKSPACE_ID);
echo "[INIT] Workspace 1 Snapshot Before: {$ws1SnapBefore['subscribers']} subs, {$ws1SnapBefore['flows']} flows\n";

// Sanitize Workspace 99999 test data
TestDatabase::teardownWorkspace($wsId);

$passCount = 0;
$failCount = 0;

function assertCheck(string $desc, bool $condition, string $detail = ''): void {
    global $passCount, $failCount;
    if ($condition) {
        $passCount++;
        echo "  \033[32m[PASS]\033[0m {$desc}\n";
        if ($detail !== '') echo "         Evidence: {$detail}\n";
    } else {
        $failCount++;
        echo "  \033[31m[FAIL]\033[0m {$desc}\n";
        if ($detail !== '') echo "         Error: {$detail}\n";
    }
}

// --- Check 1: normalizeWaitTimeString single digit hour/minute ---
$norm1 = normalizeWaitTimeString('8:5');
assertCheck(
    "Assertion 1: normalizeWaitTimeString('8:5') formats into '08:05:00'",
    $norm1 === '08:05:00',
    "Result: {$norm1}"
);

// --- Check 2: normalizeWaitTimeString 3-part and 2-part time ---
$norm2a = normalizeWaitTimeString('20:00:00');
$norm2b = normalizeWaitTimeString('20:00');
assertCheck(
    "Assertion 2: normalizeWaitTimeString preserves 3-part and normalizes 2-part times",
    $norm2a === '20:00:00' && $norm2b === '20:00:00',
    "norm2a: {$norm2a}, norm2b: {$norm2b}"
);

// --- Check 3: normalizeWaitTimeString handles empty/malformed safely ---
$norm3a = normalizeWaitTimeString('');
$norm3b = normalizeWaitTimeString('invalid_time');
$norm3c = normalizeWaitTimeString(null);
assertCheck(
    "Assertion 3: normalizeWaitTimeString safely falls back to default on empty/invalid/null",
    $norm3a === '09:00:00' && $norm3b === '09:00:00' && $norm3c === '09:00:00',
    "empty: {$norm3a}, invalid: {$norm3b}, null: {$norm3c}"
);

// --- Check 4: calculateWaitStepScheduledAt mode 'duration' ---
$baseTs = strtotime('2026-11-14 10:00:00');
$stepDuration = [
    'type' => 'wait',
    'config' => [
        'mode' => 'duration',
        'duration' => 2,
        'unit' => 'hours'
    ]
];
$calc4 = calculateWaitStepScheduledAt($stepDuration, $baseTs);
$expected4 = '2026-11-14 12:00:00';
assertCheck(
    "Assertion 4: calculateWaitStepScheduledAt duration mode calculates exact future schedule",
    $calc4['scheduled_at'] === $expected4 && $calc4['is_wait_over'] === false,
    "Expected: {$expected4}, Got: {$calc4['scheduled_at']}"
);

// --- Check 5: calculateWaitStepScheduledAt mode 'until' with specificTime ---
$baseTs5 = strtotime('2026-11-14 08:00:00');
$stepUntil = [
    'type' => 'wait',
    'config' => [
        'mode' => 'until',
        'untilTime' => '14:30'
    ]
];
$calc5 = calculateWaitStepScheduledAt($stepUntil, $baseTs5);
$expected5 = '2026-11-14 14:30:00';
assertCheck(
    "Assertion 5: calculateWaitStepScheduledAt mode 'until' schedules target time on current day",
    $calc5['scheduled_at'] === $expected5,
    "Expected: {$expected5}, Got: {$calc5['scheduled_at']}"
);

// --- Check 6: calculateWaitStepScheduledAt mode 'until_date' future date ---
$stepUntilDateFuture = [
    'type' => 'wait',
    'config' => [
        'mode' => 'until_date',
        'specificDate' => '2026-12-01',
        'untilTime' => '10:00'
    ]
];
$calc6 = calculateWaitStepScheduledAt($stepUntilDateFuture, $baseTs);
$expected6 = '2026-12-01 10:00:00';
assertCheck(
    "Assertion 6: calculateWaitStepScheduledAt mode 'until_date' with future date returns exact target and is_wait_over=false",
    $calc6['scheduled_at'] === $expected6 && $calc6['is_wait_over'] === false,
    "Expected: {$expected6}, Got: {$calc6['scheduled_at']}"
);

// --- Check 7: calculateWaitStepScheduledAt mode 'until_date' past date ---
$stepUntilDatePast = [
    'type' => 'wait',
    'config' => [
        'mode' => 'until_date',
        'specificDate' => '2026-01-01',
        'untilTime' => '10:00'
    ]
];
$calc7 = calculateWaitStepScheduledAt($stepUntilDatePast, $baseTs, ['for_enrollment' => false]);
assertCheck(
    "Assertion 7: calculateWaitStepScheduledAt mode 'until_date' past date flags is_wait_over=true",
    $calc7['is_wait_over'] === true,
    "is_wait_over: " . ($calc7['is_wait_over'] ? 'true' : 'false')
);

// --- Check 8: calculateWaitStepScheduledAt with empty untilTime does not fail ---
$stepEmptyUntilTime = [
    'type' => 'wait',
    'config' => [
        'mode' => 'until_date',
        'specificDate' => '2026-12-25',
        'untilTime' => ''
    ]
];
$calc8 = calculateWaitStepScheduledAt($stepEmptyUntilTime, $baseTs);
$expected8 = '2026-12-25 09:00:00'; // Default normalized time
assertCheck(
    "Assertion 8: calculateWaitStepScheduledAt with empty untilTime normalizes to default without strtotime failure",
    $calc8['scheduled_at'] === $expected8 && $calc8['is_wait_over'] === false,
    "Expected: {$expected8}, Got: {$calc8['scheduled_at']}"
);

// --- Check 9: extractFlowStepMeta extracts type and config accurately ---
$sampleSteps = [
    ['id' => 'step_1', 'type' => 'trigger', 'config' => ['event' => 'form_submit']],
    ['id' => 'step_wait_1', 'type' => 'wait', 'config' => ['mode' => 'duration', 'duration' => 5, 'unit' => 'days']],
    ['id' => 'step_cond_1', 'type' => 'condition', 'config' => ['field' => 'city', 'operator' => 'equals', 'value' => 'Hanoi']]
];
$metaWait = extractFlowStepMeta($sampleSteps, 'step_wait_1');
$metaCond = extractFlowStepMeta($sampleSteps, 'step_cond_1');
assertCheck(
    "Assertion 9: extractFlowStepMeta resolves step type and configuration from flow step graph",
    $metaWait['type'] === 'wait' && $metaCond['type'] === 'condition' && ($metaWait['step']['config']['duration'] ?? null) === 5,
    "metaWait type: {$metaWait['type']}, metaCond type: {$metaCond['type']}"
);

// Setup test database fixtures in Workspace 99999
$subId1 = 9999901;
$subId2 = 9999902;
$subId3 = 9999903;
$pdo->prepare("INSERT INTO subscribers (id, workspace_id, email, status, created_at, updated_at) 
               VALUES (?, ?, 'wait_test1@ideas.edu.vn', 'active', NOW(), NOW()),
                      (?, ?, 'wait_test2@ideas.edu.vn', 'active', NOW(), NOW()),
                      (?, ?, 'wait_test3@ideas.edu.vn', 'active', NOW(), NOW())
               ON DUPLICATE KEY UPDATE status = 'active', deleted_at = NULL")->execute([
    $subId1, $wsId,
    $subId2, $wsId,
    $subId3, $wsId
]);

$flowId = 'flow_wait_test_' . time();
$flowStepsJson = json_encode([
    ['id' => 'step_cond_test', 'type' => 'condition', 'config' => ['field' => 'open_email']],
    ['id' => 'step_wait_test', 'type' => 'wait', 'config' => ['mode' => 'duration', 'duration' => 3, 'unit' => 'days']]
]);
$pdo->prepare("INSERT INTO flows (id, workspace_id, name, status, trigger_type, steps, created_at, updated_at)
               VALUES (?, ?, 'Test Wait/Condition Flow', 'active', 'manual', ?, NOW(), NOW())")->execute([$flowId, $wsId, $flowStepsJson]);

// Sub 1: Condition step in waiting status with future schedule (1 hour later)
$futureSchedCond = date('Y-m-d H:i:s', time() + 3600);
$pdo->prepare("INSERT INTO subscriber_flow_states (workspace_id, flow_id, subscriber_id, step_id, step_type, status, scheduled_at, created_at, updated_at)
               VALUES (?, ?, ?, 'step_cond_test', 'condition', 'waiting', ?, NOW(), NOW())")->execute([$wsId, $flowId, $subId1, $futureSchedCond]);
$condStateId = (int)$pdo->lastInsertId();

// Sub 2: Wait step in waiting status with future schedule (3 days later)
$futureSchedWait = date('Y-m-d H:i:s', time() + 259200);
$pdo->prepare("INSERT INTO subscriber_flow_states (workspace_id, flow_id, subscriber_id, step_id, step_type, status, scheduled_at, created_at, updated_at)
               VALUES (?, ?, ?, 'step_wait_test', 'wait', 'waiting', ?, NOW(), NOW())")->execute([$wsId, $flowId, $subId2, $futureSchedWait]);
$waitStateId = (int)$pdo->lastInsertId();

// Sub 3: Legacy row with NULL step_type on a wait step (2 hours later)
$futureSchedLegacy = date('Y-m-d H:i:s', time() + 7200);
$pdo->prepare("INSERT INTO subscriber_flow_states (workspace_id, flow_id, subscriber_id, step_id, step_type, status, scheduled_at, created_at, updated_at)
               VALUES (?, ?, ?, 'step_wait_test', NULL, 'waiting', ?, NOW(), NOW())")->execute([$wsId, $flowId, $subId3, $futureSchedLegacy]);
$legacyWaitId = (int)$pdo->lastInsertId();

// --- Check 10: logActivity wake-up for condition step ---
// Trigger an open_email activity event for subId1
logActivity($pdo, $subId1, 'open_email', 'cmp_test_1', 'Campaign Test 1', 'Opened Test Email Campaign', $flowId, 'cmp_test_1', [], $wsId);

$stmtCondAfter = $pdo->prepare("SELECT status, scheduled_at FROM subscriber_flow_states WHERE id = ?");
$stmtCondAfter->execute([$condStateId]);
$condAfter = $stmtCondAfter->fetch(PDO::FETCH_ASSOC);

$condWoken = strtotime($condAfter['scheduled_at']) <= time() + 5;
assertCheck(
    "Assertion 10: logActivity wakes up waiting condition step by setting scheduled_at = NOW()",
    $condWoken && $condAfter['status'] === 'waiting',
    "Condition step scheduled_at after logActivity: {$condAfter['scheduled_at']}"
);

// --- Check 11: CRITICAL HOTFIX VERIFICATION: logActivity on subId2 does NOT wake wait step ---
// Trigger activity on subId2 (e.g. from an unrelated campaign or concurrent event)
logActivity($pdo, $subId2, 'open_email', 'cmp_test_2', 'Campaign Test 2', 'Opened Another Email Campaign', $flowId, 'cmp_test_2', [], $wsId);

$stmtWaitAfter = $pdo->prepare("SELECT status, scheduled_at FROM subscriber_flow_states WHERE id = ?");
$stmtWaitAfter->execute([$waitStateId]);
$waitAfter = $stmtWaitAfter->fetch(PDO::FETCH_ASSOC);

$waitDiff = abs(strtotime($waitAfter['scheduled_at']) - strtotime($futureSchedWait));
$waitUntouched = ($waitDiff <= 2);
assertCheck(
    "Assertion 11: [CRITICAL HOTFIX] logActivity preserves future schedule on 'wait' steps (NOT overwritten)",
    $waitUntouched && $waitAfter['status'] === 'waiting',
    "Wait step original schedule: {$futureSchedWait}, After logActivity: {$waitAfter['scheduled_at']} (Diff: {$waitDiff}s)"
);

// --- Check 12: Self-healing of legacy queue rows with empty/null step_type ---
// Trigger activity on subId3 to invoke self-heal
logActivity($pdo, $subId3, 'click_link', 'cmp_test_1', 'Campaign Test 1', 'Clicked Test Link', $flowId, 'cmp_test_1', [], $wsId);

$stmtLegacyAfter = $pdo->prepare("SELECT step_type, scheduled_at FROM subscriber_flow_states WHERE id = ?");
$stmtLegacyAfter->execute([$legacyWaitId]);
$legacyAfter = $stmtLegacyAfter->fetch(PDO::FETCH_ASSOC);

assertCheck(
    "Assertion 12: Self-heals legacy NULL step_type to 'wait' from flow definition and protects schedule",
    $legacyAfter['step_type'] === 'wait' && abs(strtotime($legacyAfter['scheduled_at']) - strtotime($futureSchedLegacy)) <= 2,
    "Self-healed step_type: {$legacyAfter['step_type']}, schedule preserved: {$legacyAfter['scheduled_at']}"
);

// --- Check 13: AST verification of worker_flow.php priority guard ---
$workerFlowContent = file_get_contents($rootDir . '/backend/automation/worker_flow.php');
$hasPriorityGuard = strpos($workerFlowContent, "AND (q.scheduled_at <= NOW() OR q.step_type = 'condition' OR q.status = 'processing')") !== false;
assertCheck(
    "Assertion 13: worker_flow.php priority query contains scheduled_at <= NOW() guard preventing premature wait execution",
    $hasPriorityGuard,
    "Found guard: " . ($hasPriorityGuard ? 'YES' : 'NO')
);

// --- Check 14: AST verification of flows.php INSERT subscriber_flow_states ---
$flowsContent = file_get_contents($rootDir . '/backend/automation/flows.php');
$hasStepTypeCol = preg_match('/INSERT\s+INTO\s+subscriber_flow_states\s*\([^\)]*step_type[^\)]*\)/i', $flowsContent);
assertCheck(
    "Assertion 14: flows.php explicitly includes step_type column in INSERT INTO subscriber_flow_states",
    $hasStepTypeCol === 1,
    "Matched step_type in column list: " . ($hasStepTypeCol ? 'YES' : 'NO')
);

// Teardown test fixtures from Workspace 99999
TestDatabase::teardownWorkspace($wsId);

// --- Check 15: Workspace 1 Invariant Guarantee ---
$ws1SnapAfter = TestDatabase::snapshotWorkspace(TestDatabase::PROD_WORKSPACE_ID);
$ws1Uncontaminated = ($ws1SnapAfter['subscribers'] === $ws1SnapBefore['subscribers']) && ($ws1SnapAfter['flows'] === $ws1SnapBefore['flows']);
assertCheck(
    "Assertion 15: Workspace 1 Invariant Guarantee (0 production rows contaminated: {$ws1SnapAfter['subscribers']} subs, {$ws1SnapAfter['flows']} flows)",
    $ws1Uncontaminated,
    "Before: {$ws1SnapBefore['subscribers']} subs / {$ws1SnapBefore['flows']} flows, After: {$ws1SnapAfter['subscribers']} subs / {$ws1SnapAfter['flows']} flows"
);

echo "\n====================================================================\n";
echo "    VERIFICATION SUMMARY: {$passCount} / " . ($passCount + $failCount) . " ASSERTIONS PASSED\n";
echo "====================================================================\n";

if ($failCount > 0) {
    echo "\033[1;31m[VERDICT] WAIT/SET-TIME HOTFIX VERIFICATION FAILED\033[0m\n\n";
    exit(1);
} else {
    echo "\033[1;32m[VERDICT] ALL 15 ASSERTIONS PASSED (EXIT CODE 0)\033[0m\n\n";
    exit(0);
}
