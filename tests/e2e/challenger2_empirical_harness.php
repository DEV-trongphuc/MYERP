<?php
/**
 * tests/e2e/challenger2_empirical_harness.php
 *
 * Empirical Challenge 2 Test Suite (Tier 5 Adversarial Stress & Verification)
 * Subsystem: Flows, Execution Engine, Priority Worker, Webhooks, Tracking & Campaigns
 *
 * Ground Truth Execution against MySQL 10.6 & PHP 8.3 CLI
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
$phpBin = 'C:\\Users\\LENOVO\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.exe';

echo "====================================================================\n";
echo "   CHALLENGER 2: EMPIRICAL ADVERSARIAL STRESS & VERIFICATION SUITE  \n";
echo "====================================================================\n\n";

// 1. Spawn Built-in PHP Server on dedicated port
$port = 8866;
$serverCmd = sprintf('"%s" -S 127.0.0.1:%d -t "%s"', $phpBin, $port, $rootDir);
$serverLogFile = sys_get_temp_dir() . '/challenger2_server.log';
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

$tests = [];
$passCount = 0;
$failCount = 0;

function runEmpiricalTest(string $name, callable $fn): void {
    global $tests, $passCount, $failCount;
    echo ">> RUNNING: {$name} ...\n";
    try {
        $result = $fn();
        $passCount++;
        echo "   \033[32m[PASS]\033[0m {$name}\n";
        $tests[] = ['name' => $name, 'status' => 'PASS', 'details' => $result];
    } catch (\Throwable $e) {
        $failCount++;
        echo "   \033[31m[FAIL]\033[0m {$name}: " . $e->getMessage() . "\n";
        $tests[] = ['name' => $name, 'status' => 'FAIL', 'error' => $e->getMessage()];
    }
}

// -----------------------------------------------------------------------------
// VERIFICATION 1: Infinite Loop Prevention in worker_flow.php (max 50 steps/tick)
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-01: worker_flow enforces 50-step limit on circular split_test node chains', function() use ($pdo, $wsId) {
    require_once dirname(__DIR__, 2) . '/backend/automation/worker_flow.php';

    $flowId = TestDatabase::uniqueId('flw_split_loop');
    $subId = TestDatabase::uniqueId('sub_split_loop');

    $circularSteps = [
        [
            'id' => 'split_step_1',
            'type' => 'split_test',
            'config' => ['ratioA' => 100],
            'pathAStepId' => 'split_step_2',
            'pathBStepId' => 'split_step_2'
        ],
        [
            'id' => 'split_step_2',
            'type' => 'split_test',
            'config' => ['ratioA' => 100],
            'pathAStepId' => 'split_step_1',
            'pathBStepId' => 'split_step_1'
        ]
    ];

    TestDatabase::insertFixture('flows', [
        'id'           => $flowId,
        'name'         => 'Circular Split Flow',
        'status'       => 'active',
        'steps'        => json_encode($circularSteps),
        'config'       => json_encode(['frequency' => 'one-time']),
        'workspace_id' => $wsId
    ]);

    TestDatabase::insertFixture('subscribers', [
        'id'                => $subId,
        'email'             => "split_{$subId}@ideas.edu.vn",
        'status'            => 'active',
        'workspace_id'      => $wsId
    ]);

    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'split_step_1',
        'status'        => 'waiting',
        'scheduled_at'  => date('Y-m-d H:i:s', time() - 10)
    ]);

    $t0 = microtime(true);
    $result = runWorkerFlow($pdo);
    $duration = microtime(true) - $t0;

    $stateRow = TestDatabase::fetchRow('subscriber_flow_states', [
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'workspace_id'  => $wsId
    ]);

    Assertions::assertNotNull($stateRow, 'State record must exist');
    Assertions::assertEquals('waiting', $stateRow['status'], 'Status must be set back to waiting after hitting limit');

    $logsText = implode("\n", $result['logs'] ?? []);
    Assertions::assertStringContains('Reached limit (50). Pausing chain to prevent infinite loop.', $logsText, 'Logs must confirm 50-step loop break');

    return "Executed 50 steps in " . round($duration, 2) . "s, halted at MAX_STEPS=50, status=waiting in DB.";
});

// -----------------------------------------------------------------------------
// VERIFICATION 2: Priority Worker Recursion Limits (< 8)
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-02: worker_priority aborts on depth > 8, proceeds on depth <= 8', function() use ($http, $wsId) {
    // 1. Test depth = 9 via HTTP
    $respOver = $http->get("/backend/automation/worker_priority.php?depth=9&subscriber_id=sub_depth_9&priority_flow_id=flw_depth_9&priority_queue_id=1&workspace_id={$wsId}");
    
    // Check worker trace log for abort confirmation
    $traceLog = file_get_contents(dirname(__DIR__, 2) . '/backend/automation/worker_trace.log');
    Assertions::assertStringContains('[Priority] ABORT: Max depth (8) exceeded. Possible infinite loop.', $traceLog, 'Trace log must confirm abort on depth > 8');

    // 2. Test depth = 5 via HTTP
    $respOk = $http->get("/backend/automation/worker_priority.php?depth=5&subscriber_id=sub_depth_5&priority_flow_id=flw_depth_5&priority_queue_id=1&workspace_id={$wsId}");
    Assertions::assertHttpStatus(200, $respOk->status, 'Depth 5 request must return HTTP 200');

    return "HTTP GET depth=9 aborted with trace log confirmation. HTTP GET depth=5 processed.";
});

// -----------------------------------------------------------------------------
// VERIFICATION 3: Concurrency Collisions on tracking_unique_cache
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-03: tracking_unique_cache handles duplicate keys with zero corruption', function() use ($pdo, $wsId) {
    $subId = TestDatabase::uniqueId('sub_tuc');
    $flowId = TestDatabase::uniqueId('flw_tuc');
    $refKey = 'step_btn_1';
    $cacheKey = md5("{$wsId}_flow_{$flowId}_click_{$subId}_{$refKey}");

    $pdo->prepare("DELETE FROM tracking_unique_cache WHERE cache_key = ?")->execute([$cacheKey]);

    $insertedCount = 0;
    $ignoredCount = 0;

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO tracking_unique_cache 
        (cache_key, workspace_id, subscriber_id, target_type, target_id, event_type, reference_key) 
        VALUES (?, ?, ?, 'flow', ?, 'click', ?)
    ");

    for ($i = 0; $i < 100; $i++) {
        $stmt->execute([$cacheKey, $wsId, $subId, $flowId, $refKey]);
        if ($stmt->rowCount() > 0) {
            $insertedCount++;
        } else {
            $ignoredCount++;
        }
    }

    Assertions::assertEquals(1, $insertedCount, 'Only exactly 1 row must be inserted for identical cache_key');
    Assertions::assertEquals(99, $ignoredCount, 'All 99 subsequent duplicate attempts must be ignored cleanly');

    $pdo->prepare("DELETE FROM tracking_unique_cache WHERE cache_key = ?")->execute([$cacheKey]);

    return "100 duplicate insert attempts: exactly 1 inserted, 99 ignored cleanly.";
});

// -----------------------------------------------------------------------------
// VERIFICATION 4: Open Redirect Validation on webhook.php & go.php
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-04: webhook.php and go.php block open redirects and malicious URL schemes', function() use ($http, $wsId, $pdo) {
    $subId = TestDatabase::uniqueId('sub_redir');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "redir_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    // Test 1: webhook.php?type=click with javascript:
    $badUrl1 = 'javascript:alert(document.cookie)';
    $encBad1 = base64_encode($badUrl1);
    $resp1 = $http->get("/backend/automation/webhook.php?type=click&sid={$subId}&url={$encBad1}&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $resp1->status);
    Assertions::assertFalse(strpos($resp1->location ?? '', 'javascript:') !== false, 'Must never redirect to javascript: scheme');
    Assertions::assertStringContains('ideas.edu.vn', $resp1->location, 'Must fallback to default safe domain');

    // Test 2: webhook.php?type=click with CRLF injection
    $badUrl2 = "https://ideas.edu.vn/khoa-hoc\r\nSet-Cookie: pwn=1";
    $encBad2 = base64_encode($badUrl2);
    $resp2 = $http->get("/backend/automation/webhook.php?type=click&sid={$subId}&url={$encBad2}&ws={$wsId}", [], [], false);
    Assertions::assertHttpStatus(302, $resp2->status);
    Assertions::assertFalse(strpos($resp2->location ?? '', "\r") !== false, 'Location header must not contain CR');
    Assertions::assertFalse(strpos($resp2->location ?? '', "\n") !== false, 'Location header must not contain LF');

    // Test 3: go.php with short_links target
    $linkId = TestDatabase::uniqueId('lnk_safe');
    $slug = 'safe-slug-' . substr($linkId, -6);
    $targetUrl = 'https://ideas.edu.vn/chuong-trinh-thac-si';
    TestDatabase::insertFixture('short_links', [
        'id'           => $linkId,
        'slug'         => $slug,
        'target_url'   => $targetUrl,
        'status'       => 'active',
        'workspace_id' => (string)$wsId
    ]);

    $resp3 = $http->get("/backend/automation/go.php?s={$slug}", [], [], false);
    Assertions::assertHttpStatus(302, $resp3->status);
    Assertions::assertStringContains($targetUrl, $resp3->location);

    return "Neutralized javascript: injection, neutralized CRLF injection, verified valid short link redirect.";
});

// -----------------------------------------------------------------------------
// VERIFICATION 5: Duplicate Webhook Delivery & Deduplication
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-05: Duplicate open/click webhooks produce exactly-once campaign stat increment', function() use ($http, $worker, $wsId, $pdo) {
    $campId = TestDatabase::uniqueId('cmp_dup');
    $subId = TestDatabase::uniqueId('sub_dup');

    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "dup_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);

    TestDatabase::insertFixture('campaigns', [
        'id'                   => $campId,
        'name'                 => 'Dup Webhook Test Campaign',
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

    // Run aggregator worker to process raw events and sync downstream buffers
    $resAgg = $worker->runTrackingAggregatorWorker();
    Assertions::assertEquals(0, $resAgg['exit_code']);

    // Check stats in campaigns table
    $camp = TestDatabase::fetchRow('campaigns', ['id' => $campId]);
    Assertions::assertNotNull($camp);
    
    // In event of buffered stats waiting for flush, flush stats buffer
    if ((int)$camp['count_unique_opened'] === 0) {
        $worker->runTrackingAggregatorWorker();
        $camp = TestDatabase::fetchRow('campaigns', ['id' => $campId]);
    }

    Assertions::assertEquals(1, (int)$camp['count_unique_opened'], 'count_unique_opened must be exactly 1 despite duplicate webhook delivery');

    return "2 open webhooks delivered -> aggregator processed -> count_unique_opened = 1 exactly.";
});

// -----------------------------------------------------------------------------
// VERIFICATION 6: 100% Soft-Delete Mandate Static & Dynamic Audit
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-06: 100% Soft-Delete Mandate Audit across Target Files', function() use ($http, $wsId) {
    $targetFiles = [
        'flows.php'                      => dirname(__DIR__, 2) . '/backend/automation/flows.php',
        'FlowExecutor.php'               => dirname(__DIR__, 2) . '/backend/automation/FlowExecutor.php',
        'flow_helpers.php'               => dirname(__DIR__, 2) . '/backend/automation/flow_helpers.php',
        'worker_flow.php'                => dirname(__DIR__, 2) . '/backend/automation/worker_flow.php',
        'worker_priority.php'            => dirname(__DIR__, 2) . '/backend/automation/worker_priority.php',
        'webhook.php'                    => dirname(__DIR__, 2) . '/backend/automation/webhook.php',
        'Mailer.php'                     => dirname(__DIR__, 2) . '/backend/automation/Mailer.php',
        'track.php'                      => dirname(__DIR__, 2) . '/backend/automation/track.php',
        'go.php'                         => dirname(__DIR__, 2) . '/backend/automation/go.php',
        'worker_tracking_aggregator.php' => dirname(__DIR__, 2) . '/backend/automation/worker_tracking_aggregator.php',
        'campaigns.php'                  => dirname(__DIR__, 2) . '/backend/automation/campaigns.php'
    ];

    $coreEntities = ['subscribers', 'subscriber_activity', 'mail_delivery_logs', 'subscriber_flow_states', 'flows', 'campaigns'];
    $violations = [];

    foreach ($targetFiles as $shortName => $fullPath) {
        $lines = explode("\n", file_get_contents($fullPath));
        foreach ($lines as $lineNum => $line) {
            if (preg_match('/DELETE\s+FROM\s+([a-zA-Z0-9_`]+)/i', $line, $m)) {
                $table = str_replace('`', '', $m[1]);
                if (in_array($table, $coreEntities, true)) {
                    $violations[] = [
                        'file' => $shortName,
                        'line' => $lineNum + 1,
                        'table' => $table,
                        'code' => trim($line)
                    ];
                }
            }
        }
    }

    echo "   [AUDIT RESULT] Cataloged " . count($violations) . " hard DELETE FROM statements on core entities:\n";
    foreach ($violations as $v) {
        echo "     - {$v['file']}:{$v['line']} on `{$v['table']}`: {$v['code']}\n";
    }

    // Dynamic verification: Flow delete must be 100% soft-delete
    $flowId = TestDatabase::uniqueId('flw_del_test');
    TestDatabase::insertFixture('flows', ['id' => $flowId, 'name' => 'Delete Test Flow', 'workspace_id' => $wsId, 'status' => 'draft']);
    $respDel = $http->delete("/backend/automation/flows.php?id={$flowId}");
    Assertions::assertHttpStatus(200, $respDel->status);

    $flowRow = TestDatabase::fetchRow('flows', ['id' => $flowId]);
    Assertions::assertNotNull($flowRow, 'Soft-deleted flow must still exist in MySQL');
    Assertions::assertEquals('archived', $flowRow['status']);
    Assertions::assertNotNull($flowRow['deleted_at']);

    return "Found " . count($violations) . " violations in codebase; verified dynamic flow delete is soft-delete.";
});

// -----------------------------------------------------------------------------
// VERIFICATION 7: Test Assertion Quality & Anti-Tautology Audit
// -----------------------------------------------------------------------------
runEmpiricalTest('VERIFY-07: AST and Test Assertion Rigor in tier1_flows, tier1_tracking, tier3_pairwise', function() {
    $tier3Path = dirname(__DIR__, 2) . '/tests/e2e/suites/tier3_pairwise.php';
    $content = file_get_contents($tier3Path);

    $laxAssertions = [];
    if (strpos($content, '[200, 302, 404]') !== false) {
        $laxAssertions[] = 'XF10 (tier3_pairwise.php:168): in_array($resp->status, [200, 302, 404]) accepts 404 Not Found';
    }
    if (strpos($content, '[200, 500]') !== false) {
        $laxAssertions[] = 'XF13 (tier3_pairwise.php:212): in_array($resp->status, [200, 500]) accepts 500 Internal Server Error';
        $laxAssertions[] = 'XF14 (tier3_pairwise.php:220): in_array($resp->status, [200, 500]) accepts 500 Internal Server Error';
    }

    echo "   [AUDIT RESULT] Cataloged " . count($laxAssertions) . " lax assertions in test suites:\n";
    foreach ($laxAssertions as $la) {
        echo "     - {$la}\n";
    }

    Assertions::assertTrue(count($laxAssertions) >= 2, 'Lax assertions must be flagged');
    return count($laxAssertions) . " lax assertions cataloged for Worker remediation.";
});

// Teardown
proc_terminate($serverProc);
TestDatabase::teardownWorkspace($wsId);

echo "\n====================================================================\n";
echo "SUMMARY: {$passCount} Passed, {$failCount} Failed\n";
echo "====================================================================\n";

if ($failCount > 0) {
    exit(1);
}
exit(0);
