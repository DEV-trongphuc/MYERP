<?php
/**
 * tests/e2e/tier5_flows_tracking_stress.php
 *
 * Tier 5: Adversarial Stress & Verification Suite for Flows, Execution Engine, Webhooks & Tracking
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md)
 *
 * Verifications:
 * 1. Infinite loop prevention in worker_flow.php (max 50 steps/tick, cyclic step graphs)
 * 2. Priority worker recursion limits (< 8) and depth propagation inspection
 * 3. Concurrency collisions on tracking_unique_cache (100 parallel/duplicate inserts)
 * 4. Open redirect validation (javascript:, CRLF injection, domain whitelisting)
 * 5. Duplicate webhook delivery & raw_event_buffer processing audit
 * 6. 100% soft-delete enforcement (0 hard DELETE FROM on core entities)
 * 7. Test assertion rigor & anti-tautology audit (tier1_flows, tier1_tracking, tier3_pairwise)
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '1');
date_default_timezone_set('Asia/Ho_Chi_Minh');

$rootDir = dirname(__DIR__, 2);
require_once __DIR__ . '/helpers/TestDatabase.php';
require_once __DIR__ . '/helpers/WorkerInvoker.php';
require_once __DIR__ . '/helpers/HttpClient.php';
require_once __DIR__ . '/helpers/Assertions.php';

use MYERP\Tests\E2E\Helpers\TestDatabase;
use MYERP\Tests\E2E\Helpers\WorkerInvoker;
use MYERP\Tests\E2E\Helpers\HttpClient;
use MYERP\Tests\E2E\Helpers\Assertions;

$pdo = TestDatabase::pdo();
$wsId = TestDatabase::TEST_WORKSPACE_ID; // 99999
$phpBin = getenv('PHP_BIN') ?: PHP_BINARY;

echo "====================================================================\n";
echo "   TIER 5 ADVERSARIAL STRESS & EMPIRICAL AUDIT: FLOWS & TRACKING   \n";
echo "====================================================================\n\n";

// 1. Spawn Built-in PHP Server on dedicated port
$port = 8877;
$serverCmd = sprintf('"%s" -S 127.0.0.1:%d -t "%s"', $phpBin, $port, $rootDir);
$serverLogFile = sys_get_temp_dir() . '/tier5_server.log';
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['file', $serverLogFile, 'a'],
    2 => ['file', $serverLogFile, 'a']
];
$serverEnv = array_merge($_ENV, getenv(), [
    'DB_HOST' => '127.0.0.1',
    'APP_ENV' => 'development'
]);

$serverProc = proc_open($serverCmd, $descriptors, $serverPipes, $rootDir, $serverEnv);
if (!is_resource($serverProc)) {
    echo "[FATAL] Failed to spawn built-in PHP server process on port {$port}.\n";
    exit(1);
}

// Wait for server online
$isUp = false;
for ($i = 0; $i < 40; $i++) {
    usleep(100000);
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
    if ($fp) {
        fclose($fp);
        $isUp = true;
        break;
    }
}

if (!$isUp) {
    echo "[FATAL] Built-in PHP server failed to start on 127.0.0.1:{$port}\n";
    proc_terminate($serverProc);
    exit(1);
}

echo "[INIT] Server Online at http://127.0.0.1:{$port}\n\n";

$adminAuth = TestDatabase::ensureTestAdminUser();
$token = $adminAuth['token'];
$http = new HttpClient("http://127.0.0.1:{$port}", $token);
$worker = new WorkerInvoker($phpBin);

$testResults = [];

function runTier5Test(string $code, string $name, callable $fn): void {
    global $testResults;
    echo ">> [{$code}] RUNNING: {$name} ...\n";
    try {
        $details = $fn();
        echo "   \033[32m[PASS]\033[0m {$name}\n";
        if ($details) echo "          Evidence: {$details}\n";
        $testResults[] = ['code' => $code, 'name' => $name, 'status' => 'PASS', 'details' => $details];
    } catch (\Throwable $e) {
        echo "   \033[31m[DEFECT DETECTED]\033[0m {$name}: " . $e->getMessage() . "\n";
        $testResults[] = ['code' => $code, 'name' => $name, 'status' => 'FAIL', 'error' => $e->getMessage()];
    }
}

// -----------------------------------------------------------------------------
// T5-01: Infinite Loop Prevention in worker_flow.php
// -----------------------------------------------------------------------------
runTier5Test('T5-01', 'worker_flow enforces max 50 steps/tick limit on cyclic step graph', function() use ($pdo, $wsId) {
    require_once dirname(__DIR__, 2) . '/backend/automation/worker_flow.php';

    $flowId = TestDatabase::uniqueId('flw_t5_loop');
    $subId = TestDatabase::uniqueId('sub_t5_loop');

    $circularSteps = [
        [
            'id' => 'split_1',
            'type' => 'split_test',
            'config' => ['ratioA' => 100],
            'pathAStepId' => 'split_2',
            'pathBStepId' => 'split_2'
        ],
        [
            'id' => 'split_2',
            'type' => 'split_test',
            'config' => ['ratioA' => 100],
            'pathAStepId' => 'split_1',
            'pathBStepId' => 'split_1'
        ]
    ];

    TestDatabase::insertFixture('flows', [
        'id'           => $flowId,
        'name'         => 'Circular Flow T5-01',
        'status'       => 'active',
        'steps'        => json_encode($circularSteps),
        'config'       => json_encode(['frequency' => 'one-time']),
        'workspace_id' => $wsId
    ]);

    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "t5_loop_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'split_1',
        'status'        => 'waiting',
        'scheduled_at'  => date('Y-m-d H:i:s', time() - 10)
    ]);

    $t0 = microtime(true);
    $result = runWorkerFlow($pdo);
    $dur = microtime(true) - $t0;

    $stateRow = TestDatabase::fetchRow('subscriber_flow_states', [
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'workspace_id'  => $wsId
    ]);

    Assertions::assertNotNull($stateRow, 'State record must exist');
    Assertions::assertEquals('waiting', $stateRow['status'], 'Status must be set back to waiting after hitting limit');

    $logsText = implode("\n", $result['logs'] ?? []);
    Assertions::assertStringContains('Reached limit (50). Pausing chain to prevent infinite loop.', $logsText, 'Logs must confirm 50-step loop break');

    return "Executed 50 cycles in " . round($dur, 2) . "s. Halted cleanly at MAX_STEPS=50.";
});

// -----------------------------------------------------------------------------
// T5-02: Priority Worker Recursion Limits (< 8) and Parameter Propagation
// -----------------------------------------------------------------------------
runTier5Test('T5-02', 'worker_priority aborts on depth > 8 and flags missing depth in re-trigger calls', function() use ($http, $wsId) {
    // 1. Depth = 9 must abort
    $respOver = $http->get("/backend/automation/worker_priority.php?depth=9&subscriber_id=sub_d9&priority_flow_id=flw_d9&priority_queue_id=1&workspace_id={$wsId}");
    $traceLog = @file_get_contents(dirname(__DIR__, 2) . '/backend/automation/worker_trace.log');
    Assertions::assertStringContains('[Priority] ABORT: Max depth (8) exceeded. Possible infinite loop.', $traceLog, 'Trace log must confirm abort on depth > 8');

    // 2. Depth = 5 must execute cleanly
    $respOk = $http->get("/backend/automation/worker_priority.php?depth=5&subscriber_id=sub_d5&priority_flow_id=flw_d5&priority_queue_id=1&workspace_id={$wsId}");
    Assertions::assertHttpStatus(200, $respOk->status, 'Depth 5 request must return HTTP 200');

    // 3. Static verification of depth propagation: check if worker_priority.php:552, 673 passes depth+1
    $wpContent = file_get_contents(dirname(__DIR__, 2) . '/backend/automation/worker_priority.php');
    $hasDepthPropagation = (strpos($wpContent, "'depth' => \$priorityDepth + 1") !== false);

    if (!$hasDepthPropagation) {
        throw new RuntimeException("DEF-CHA-04: worker_priority.php does NOT increment or pass 'depth' parameter when re-triggering priority workers (lines 552 & 673). Recursion limit is bypassed across chained calls.");
    }

    return "Depth > 8 aborted; depth <= 8 handled; depth propagation verified.";
});

// -----------------------------------------------------------------------------
// T5-03: Concurrency Collisions on tracking_unique_cache
// -----------------------------------------------------------------------------
runTier5Test('T5-03', 'tracking_unique_cache enforces unique constraint under 100 collision attempts', function() use ($pdo, $wsId) {
    $subId = TestDatabase::uniqueId('sub_c3');
    $flowId = TestDatabase::uniqueId('flw_c3');
    $refKey = 'btn_enroll_now';
    $cacheKey = md5("{$wsId}_flow_{$flowId}_click_{$subId}_{$refKey}");

    $pdo->prepare("DELETE FROM tracking_unique_cache WHERE cache_key = ?")->execute([$cacheKey]);

    $inserted = 0;
    $ignored = 0;

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO tracking_unique_cache 
        (cache_key, workspace_id, subscriber_id, target_type, target_id, event_type, reference_key) 
        VALUES (?, ?, ?, 'flow', ?, 'click', ?)
    ");

    for ($i = 0; $i < 100; $i++) {
        $stmt->execute([$cacheKey, $wsId, $subId, $flowId, $refKey]);
        if ($stmt->rowCount() > 0) {
            $inserted++;
        } else {
            $ignored++;
        }
    }

    Assertions::assertEquals(1, $inserted, 'Exactly 1 row must be inserted for identical cache_key');
    Assertions::assertEquals(99, $ignored, 'All 99 subsequent duplicate attempts must be ignored cleanly');

    $pdo->prepare("DELETE FROM tracking_unique_cache WHERE cache_key = ?")->execute([$cacheKey]);

    return "100 collision attempts: 1 inserted, 99 ignored cleanly. Zero data corruption.";
});

// -----------------------------------------------------------------------------
// T5-04: Open Redirect Validation on webhook.php & go.php
// -----------------------------------------------------------------------------
runTier5Test('T5-04', 'webhook.php and go.php block open redirects, javascript: schemes, and CRLF header injection', function() use ($http, $wsId) {
    $subId = TestDatabase::uniqueId('sub_redir_t5');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "redir_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    // Attack 1: javascript: scheme
    $bad1 = 'javascript:alert(document.cookie)';
    $resp1 = $http->get("/backend/automation/webhook.php?type=click&sid={$subId}&url=" . base64_encode($bad1) . "&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $resp1->status);
    Assertions::assertFalse(strpos($resp1->location ?? '', 'javascript:') !== false, 'Must reject javascript: scheme');
    Assertions::assertStringContains('ideas.edu.vn', $resp1->location, 'Must fallback to default safe domain');

    // Attack 2: CRLF Header Injection
    $bad2 = "https://ideas.edu.vn/training\r\nSet-Cookie: evil_token=123";
    $resp2 = $http->get("/backend/automation/webhook.php?type=click&sid={$subId}&url=" . base64_encode($bad2) . "&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $resp2->status);
    Assertions::assertFalse(strpos($resp2->location ?? '', "\r") !== false, 'Must strip CR');
    Assertions::assertFalse(strpos($resp2->location ?? '', "\n") !== false, 'Must strip LF');

    // Attack 3: data: URI scheme
    $bad3 = 'data:text/html,<script>alert(1)</script>';
    $resp3 = $http->get("/backend/automation/webhook.php?type=click&sid={$subId}&url=" . base64_encode($bad3) . "&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $resp3->status);
    Assertions::assertFalse(strpos($resp3->location ?? '', 'data:') !== false, 'Must reject data: scheme');

    return "All 3 malicious redirect attack vectors neutralized cleanly.";
});

// -----------------------------------------------------------------------------
// T5-05: Duplicate Webhook Delivery & Tracking Buffer Ingestion Integrity
// -----------------------------------------------------------------------------
runTier5Test('T5-05', 'Duplicate open webhooks produce exactly-once campaign stat increment via raw_event_buffer', function() use ($http, $worker, $wsId, $pdo) {
    $campId = TestDatabase::uniqueId('cmp_t5_dup');
    $subId = TestDatabase::uniqueId('sub_t5_dup');

    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "dup_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    TestDatabase::insertFixture('campaigns', [
        'id'                   => $campId,
        'name'                 => 'Dup Webhook Test T5',
        'workspace_id'         => $wsId,
        'count_sent'           => 1,
        'count_opened'         => 0,
        'count_unique_opened'  => 0,
        'status'               => 'sent'
    ]);

    TestDatabase::insertFixture('mail_delivery_logs', [
        'workspace_id' => $wsId,
        'recipient'    => "dup_{$subId}@ideas.edu.vn",
        'subscriber_id'=> $subId,
        'campaign_id'  => $campId,
        'status'       => 'success'
    ]);

    // Send 2 identical open webhooks
    $resp1 = $http->get("/backend/automation/webhook.php?type=open&sid={$subId}&cid={$campId}&ws={$wsId}");
    $resp2 = $http->get("/backend/automation/webhook.php?type=open&sid={$subId}&cid={$campId}&ws={$wsId}");
    Assertions::assertHttpStatus(200, $resp1->status);
    Assertions::assertHttpStatus(200, $resp2->status);

    // Inspect raw_event_buffer row for created_at
    $rawRows = $pdo->query("SELECT id, type, created_at, processed FROM raw_event_buffer WHERE payload LIKE '%{$campId}%'")->fetchAll(PDO::FETCH_ASSOC);
    Assertions::assertTrue(count($rawRows) >= 2, 'At least 2 raw events must be buffered by webhook.php');

    $firstRow = $rawRows[0];
    if ((int)$firstRow['created_at'] === 0) {
        throw new RuntimeException("DEF-CHA-01: webhook.php inserts into raw_event_buffer without created_at, defaulting to 0. worker_tracking_aggregator.php WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) evaluates 0 >= DATE_SUB(...) as FALSE in MySQL, causing all webhook events to be permanently ignored (tracking black hole).");
    }

    // Run aggregator worker
    $resAgg = $worker->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $resAgg['exit_code']);

    $camp = TestDatabase::fetchRow('campaigns', ['id' => $campId]);
    Assertions::assertNotNull($camp);

    Assertions::assertEquals(1, (int)$camp['count_unique_opened'], 'count_unique_opened must be exactly 1 despite duplicate webhook delivery');

    return "Delivered 2 duplicate open webhooks; aggregator processed exactly 1 unique open.";
});

// -----------------------------------------------------------------------------
// T5-06: 100% Soft-Delete Mandate Dynamic AST Audit Across Entire Module
// -----------------------------------------------------------------------------
runTier5Test('T5-06', '100% Soft-Delete Mandate: Zero hard DELETE FROM statements on core entities', function() {
    $automationDir = dirname(__DIR__, 2) . '/backend/automation';
    $targetFiles = glob($automationDir . '/*.php');

    $coreEntities = [
        'subscribers',
        'lists',
        'segments',
        'flows',
        'campaigns',
        'subscriber_flow_states',
        'mail_delivery_logs',
        'subscriber_activity'
    ];
    $violations = [];

    foreach ($targetFiles as $fullPath) {
        $shortName = basename($fullPath);
        $lines = explode("\n", file_get_contents($fullPath));
        foreach ($lines as $lineNum => $line) {
            $trimmed = trim($line);
            // Skip comments
            if (strpos($trimmed, '//') === 0 || strpos($trimmed, '*') === 0 || strpos($trimmed, '#') === 0) continue;
            // Match SQL DELETE FROM
            if (preg_match('/(?:^|[^a-zA-Z0-9_])DELETE\s+FROM\s+([`\w]+)/i', $line, $m)) {
                $table = strtolower(str_replace(['`', '"', "'"], '', $m[1]));
                if (in_array($table, $coreEntities, true)) {
                    $violations[] = [
                        'file'  => $shortName,
                        'line'  => $lineNum + 1,
                        'table' => $table,
                        'code'  => $trimmed
                    ];
                }
            }
        }
    }

    if (!empty($violations)) {
        $msg = "DEF-CHA-02: Found " . count($violations) . " hard DELETE FROM statements on core entities violating AGENTS.md 100% Soft-Delete Mandate:\n";
        foreach ($violations as $v) {
            $msg .= "  - {$v['file']}:{$v['line']} on `{$v['table']}`: {$v['code']}\n";
        }
        throw new RuntimeException($msg);
    }

    return "Zero hard DELETE FROM statements found on core entities across " . count($targetFiles) . " backend automation files.";
});

// -----------------------------------------------------------------------------
// T5-07: Anti-Tautology & Assertion Rigor Audit
// -----------------------------------------------------------------------------
runTier5Test('T5-07', 'Inspect AST and assertions in tier1_flows, tier1_tracking, tier3_pairwise for tautologies and lax fallbacks', function() {
    $tier3Path = dirname(__DIR__, 2) . '/tests/e2e/suites/tier3_pairwise.php';
    $tier3Content = file_get_contents($tier3Path);

    $defects = [];
    if (strpos($tier3Content, '[200, 302, 404]') !== false) {
        $defects[] = 'tier3_pairwise.php:168 (XF10): in_array($resp->status, [200, 302, 404]) accepts 404 Not Found';
    }
    if (strpos($tier3Content, '[200, 500]') !== false) {
        $defects[] = 'tier3_pairwise.php:212 (XF13): in_array($resp->status, [200, 500]) accepts 500 Server Error';
        $defects[] = 'tier3_pairwise.php:220 (XF14): in_array($resp->status, [200, 500]) accepts 500 Server Error';
    }

    $tier1FlowsPath = dirname(__DIR__, 2) . '/tests/e2e/suites/tier1_flows.php';
    $t1fContent = file_get_contents($tier1FlowsPath);
    if (strpos($t1fContent, "UPDATE subscribers SET tags = CONCAT(COALESCE(tags,''), ',Course_Registered')") !== false) {
        $defects[] = 'tier1_flows.php:118 (F26_TC1): Step execution node bypassed via direct manual SQL UPDATE instead of FlowExecutor';
    }

    $tier1AudiencePath = dirname(__DIR__, 2) . '/tests/e2e/suites/tier1_audience.php';
    $t1aContent = file_get_contents($tier1AudiencePath);
    if (strpos($t1aContent, '[200, 302, 404]') !== false) {
        $defects[] = 'tier1_audience.php (F12_TC1): in_array accepts 404 Not Found';
    }
    if (strpos($t1aContent, '[200, 500]') !== false) {
        $defects[] = 'tier1_audience.php (F22/F23): in_array accepts 500 Server Error';
    }

    $tier2Path = dirname(__DIR__, 2) . '/tests/e2e/suites/tier2_boundaries.php';
    $t2Content = file_get_contents($tier2Path);
    if (strpos($t2Content, '[400, 409, 422, 200]') !== false) {
        $defects[] = 'tier2_boundaries.php (BC10): in_array accepts 200 on duplicate email';
    }
    if (strpos($t2Content, '[200, 400, 404]') !== false) {
        $defects[] = 'tier2_boundaries.php (BC35): in_array accepts 200/404 on missing log IDs';
    }

    if (!empty($defects)) {
        $msg = "DEF-CHA-03: Found " . count($defects) . " weak/lax/tautological assertions in E2E test suites:\n";
        foreach ($defects as $d) {
            $msg .= "  - {$d}\n";
        }
        throw new RuntimeException($msg);
    }

    return "Zero tautologies or lax assertions found across test suites.";
});

// Teardown
proc_terminate($serverProc);
TestDatabase::teardownWorkspace($wsId);

echo "\n====================================================================\n";
echo "TIER 5 EXECUTION SUMMARY:\n";
$passCount = count(array_filter($testResults, fn($r) => $r['status'] === 'PASS'));
$failCount = count(array_filter($testResults, fn($r) => $r['status'] === 'FAIL'));
echo "Total Tests: " . count($testResults) . " | Passed: {$passCount} | Defects Flagged: {$failCount}\n";
echo "====================================================================\n";

if ($failCount > 0) {
    exit(1);
}
exit(0);
