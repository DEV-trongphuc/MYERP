<?php
/**
 * tests/e2e/marketing_e2e_runner.php
 *
 * Master Standalone PHP CLI E2E Test Runner for MYERP Marketing Automation
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth (real PHP CLI & real MySQL execution)
 * - Axiom 2: Zero Fake Data / Zero Mock (built-in server, cURL, proc_open)
 * - Axiom 4: 100% Soft-Delete Mandate
 * - Workspace 1 Invariant Guarantee (0 rows touched in operational workspace 1)
 */

declare(strict_types=1);

use MYERP\Tests\E2E\Helpers\TestDatabase;
use MYERP\Tests\E2E\Helpers\HttpClient;
use MYERP\Tests\E2E\Helpers\WorkerInvoker;
use MYERP\Tests\E2E\Helpers\Assertions;

// Set error reporting & timezone
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '1');
date_default_timezone_set('Asia/Ho_Chi_Minh');

$rootDir = dirname(__DIR__, 2);
require_once __DIR__ . '/helpers/TestDatabase.php';
require_once __DIR__ . '/helpers/HttpClient.php';
require_once __DIR__ . '/helpers/WorkerInvoker.php';
require_once __DIR__ . '/helpers/Assertions.php';

// Global test registry
$REGISTERED_TESTS = [];

/**
 * Register an E2E test case.
 */
function e2e_test(string $name, callable $fn): void {
    global $REGISTERED_TESTS;
    $REGISTERED_TESTS[] = ['name' => $name, 'fn' => $fn];
}

// 1. Parse CLI Options
$options = getopt('v', ['all', 'tier:', 'verbose', 'bail', 'port:']);
$isVerbose = isset($options['v']) || isset($options['verbose']);
$isBail = isset($options['bail']);
$tierFilter = isset($options['tier']) ? (string)$options['tier'] : null;
$overridePort = isset($options['port']) ? (int)$options['port'] : null;

echo "\n\033[1;36m====================================================================\033[0m\n";
echo "\033[1;36m       MYERP MARKETING AUTOMATION E2E TEST RUNNER (PHP 8.3 CLI)     \033[0m\n";
echo "\033[1;36m====================================================================\033[0m\n\n";

// 2. Pre-flight Checks & Connection
$phpBin = detectPhpBinary();
echo "[\033[32mINIT\033[0m] PHP Binary       : {$phpBin}\n";

$pdo = TestDatabase::pdo();
$dbVersion = $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION);
echo "[\033[32mINIT\033[0m] MariaDB Version  : {$dbVersion} on 127.0.0.1:3306\n";

// Ensure Migration 331 is applied
TestDatabase::ensureMigration331Applied();
echo "[\033[32mINIT\033[0m] Migration 331    : Verified & Ready (deleted_at columns)\n";

// Ensure test admin user & JWT token
$adminAuth = TestDatabase::ensureTestAdminUser();
$token = $adminAuth['token'];
echo "[\033[32mINIT\033[0m] Test Workspace   : " . TestDatabase::TEST_WORKSPACE_ID . " (Isolated Guard Enabled)\n";
echo "[\033[32mINIT\033[0m] Test Admin User  : {$adminAuth['user_id']} with verified JWT\n";

// Snapshot Workspace 1 (Production Invariant Guard)
$ws1Before = TestDatabase::snapshotWorkspace(TestDatabase::PROD_WORKSPACE_ID);
echo "[\033[32mINIT\033[0m] Workspace 1 Snap : Recorded ({$ws1Before['subscribers']} subscribers, {$ws1Before['flows']} flows)\n";

// Clean Workspace 99999 before test run (100% Soft-Delete)
TestDatabase::teardownWorkspace(TestDatabase::TEST_WORKSPACE_ID);
echo "[\033[32mINIT\033[0m] Teardown Pre-run : Workspace 99999 sanitized via soft-delete\n";

// 3. Spawn Built-in PHP HTTP Server
$port = $overridePort ?: findAvailablePort(8850, 8950);
echo "[\033[32mINIT\033[0m] Spawning Server  : 127.0.0.1:{$port} ...\n";

$serverCmd = sprintf('"%s" -S 127.0.0.1:%d -t "%s"', $phpBin, $port, $rootDir);
$serverLogFile = sys_get_temp_dir() . '/myerp_builtin_server.log';
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
    echo "\033[1;31m[FATAL] Failed to spawn built-in PHP server process.\033[0m\n";
    exit(1);
}

// Register shutdown function to ensure server process is always terminated
register_shutdown_function(function() use ($serverProc, $serverPipes) {
    if (is_resource($serverProc)) {
        if (isset($serverPipes[0]) && is_resource($serverPipes[0])) @fclose($serverPipes[0]);
        @proc_terminate($serverProc);
        @proc_close($serverProc);
    }
});

// Wait for server to listen
$serverReady = false;
for ($i = 0; $i < 30; $i++) {
    usleep(100000); // 100ms
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.2);
    if ($fp) {
        fclose($fp);
        $serverReady = true;
        break;
    }
}

if (!$serverReady) {
    echo "\033[1;31m[FATAL] Built-in PHP server failed to start on 127.0.0.1:{$port} within 3s.\033[0m\n";
    exit(1);
}

echo "[\033[32mINIT\033[0m] Server Online    : http://127.0.0.1:{$port}\n\n";

// Initialize helpers
$httpClient = new HttpClient("http://127.0.0.1:{$port}", $token);
$workerInvoker = new WorkerInvoker($phpBin);

$ctx = [
    'http'   => $httpClient,
    'db'     => TestDatabase::class,
    'pdo'    => $pdo,
    'worker' => $workerInvoker,
    'token'  => $token,
    'wsId'   => TestDatabase::TEST_WORKSPACE_ID,
    'port'   => $port
];

// 4. Select Suites
$allSuites = [
    'tier1_audience'   => ['tier' => 1, 'file' => __DIR__ . '/suites/tier1_audience.php', 'name' => 'Tier 1: Audience & Segments (Features 1-23)'],
    'tier1_flows'      => ['tier' => 1, 'file' => __DIR__ . '/suites/tier1_flows.php', 'name' => 'Tier 1: Automation Flows (Features 24-29)'],
    'tier1_tracking'   => ['tier' => 1, 'file' => __DIR__ . '/suites/tier1_tracking.php', 'name' => 'Tier 1: Tracking & Campaigns (Features 30-38)'],
    'tier2_boundaries' => ['tier' => 2, 'file' => __DIR__ . '/suites/tier2_boundaries.php', 'name' => 'Tier 2: Boundary & Hostile Inputs (BC01-BC38)'],
    'tier3_pairwise'   => ['tier' => 3, 'file' => __DIR__ . '/suites/tier3_pairwise.php', 'name' => 'Tier 3: Pairwise Cross-Feature Workflows (XF01-XF38)'],
    'tier4_scenarios'  => ['tier' => 4, 'file' => __DIR__ . '/suites/tier4_scenarios.php', 'name' => 'Tier 4: Realistic Lifecycle Scenarios (RW01-RW05)']
];

$suitesToRun = [];
foreach ($allSuites as $key => $suite) {
    if ($tierFilter !== null && (string)$suite['tier'] !== $tierFilter) {
        continue;
    }
    $suitesToRun[$key] = $suite;
}

if (empty($suitesToRun)) {
    echo "\033[1;33m[WARN] No test suites selected for tier '{$tierFilter}'.\033[0m\n";
    exit(0);
}

// 5. Execute Test Suites
$totalTests = 0;
$passedTests = 0;
$failedTests = 0;
$failures = [];
$suiteStats = [];
$suiteStartTime = microtime(true);

foreach ($suitesToRun as $suiteKey => $suiteInfo) {
    echo "\033[1;35m>>> RUNNING SUITE: {$suiteInfo['name']}\033[0m\n";
    
    // Clear registry for this suite
    $REGISTERED_TESTS = [];
    $suiteAssertionsBefore = Assertions::getAssertionCount();
    $suiteStart = microtime(true);
    
    // Load suite definitions
    require $suiteInfo['file'];
    
    $suiteTotal = count($REGISTERED_TESTS);
    $suitePassed = 0;
    $suiteFailed = 0;
    
    foreach ($REGISTERED_TESTS as $t) {
        $testName = $t['name'];
        $testFn = $t['fn'];
        $totalTests++;
        
        $t0 = microtime(true);
        try {
            $testFn($ctx);
            $durationMs = round((microtime(true) - $t0) * 1000, 1);
            $passedTests++;
            $suitePassed++;
            if ($isVerbose) {
                echo "  \033[32m✔\033[0m {$testName} \033[90m({$durationMs}ms)\033[0m\n";
            } else {
                echo "\033[32m.\033[0m";
            }
        } catch (Throwable $e) {
            $durationMs = round((microtime(true) - $t0) * 1000, 1);
            $failedTests++;
            $suiteFailed++;
            $failures[] = [
                'suite'       => $suiteInfo['name'],
                'test'        => $testName,
                'message'     => $e->getMessage(),
                'file'        => $e->getFile(),
                'line'        => $e->getLine(),
                'duration_ms' => $durationMs
            ];
            if ($isVerbose) {
                echo "  \033[31m✖\033[0m {$testName} \033[90m({$durationMs}ms)\033[0m\n";
                echo "    \033[31mError: {$e->getMessage()}\033[0m\n";
            } else {
                echo "\033[31mF\033[0m";
            }
            if ($isBail) {
                echo "\n\033[1;31m[BAIL] Halting execution on first failure.\033[0m\n";
                break 2;
            }
        }
    }
    
    $suiteDuration = round(microtime(true) - $suiteStart, 2);
    $suiteAssertions = Assertions::getAssertionCount() - $suiteAssertionsBefore;
    $suiteStats[$suiteKey] = [
        'name'       => $suiteInfo['name'],
        'total'      => $suiteTotal,
        'passed'     => $suitePassed,
        'failed'     => $suiteFailed,
        'assertions' => $suiteAssertions,
        'duration'   => $suiteDuration
    ];
    
    if (!$isVerbose) {
        echo "  [\033[32m{$suitePassed}/{$suiteTotal} PASS\033[0m - {$suiteDuration}s]\n";
    }
}

$totalDuration = round(microtime(true) - $suiteStartTime, 2);

// 6. Post-Run Invariant Verification & Teardown
echo "\n[\033[34mPOST\033[0m] Verifying Workspace 1 Invariant Protection ...\n";
try {
    TestDatabase::assertWorkspaceUncontaminated(TestDatabase::PROD_WORKSPACE_ID, $ws1Before);
    echo "[\033[32mPOST\033[0m] Workspace 1 Invariant Guarantee : \033[1;32mPASSED (0 production rows contaminated)\033[0m\n";
} catch (Throwable $eContam) {
    echo "\033[1;31m[CRITICAL INVARIANT VIOLATION] " . $eContam->getMessage() . "\033[0m\n";
    $failedTests++;
}

echo "[\033[34mPOST\033[0m] Cleaning Workspace 99999 via 100% Soft-Delete Teardown ...\n";
TestDatabase::teardownWorkspace(TestDatabase::TEST_WORKSPACE_ID);
echo "[\033[32mPOST\033[0m] Teardown Completed Successfully (Zero hard DELETE FROM executed)\n";

// 7. Render ANSI Summary Report
echo "\n\033[1;36m====================================================================\033[0m\n";
echo "\033[1;36m                      TEST SUITE EXECUTION SUMMARY                  \033[0m\n";
echo "\033[1;36m====================================================================\033[0m\n";

printf("%-46s | %-6s | %-6s | %-6s | %-8s\n", "Suite Name", "Total", "Pass", "Fail", "Time");
echo str_repeat("-", 80) . "\n";

foreach ($suiteStats as $st) {
    $statusColor = ($st['failed'] === 0) ? "\033[32m" : "\033[31m";
    printf("%-46s | %-6d | {$statusColor}%-6d\033[0m | {$statusColor}%-6d\033[0m | %6.2fs\n",
        substr($st['name'], 0, 46),
        $st['total'],
        $st['passed'],
        $st['failed'],
        $st['duration']
    );
}

echo str_repeat("-", 80) . "\n";
$totalAssertions = Assertions::getAssertionCount();
echo "Total Suites Run : " . count($suiteStats) . "\n";
echo "Total Test Cases : " . $totalTests . "\n";
echo "Total Assertions : " . $totalAssertions . " (Anti-Tautology Ground Truth)\n";
echo "Passed           : \033[1;32m{$passedTests}\033[0m\n";
echo "Failed           : " . ($failedTests > 0 ? "\033[1;31m{$failedTests}\033[0m" : "\033[1;32m0\033[0m") . "\n";
echo "Total Duration   : " . $totalDuration . "s\n";

if (!empty($failures)) {
    echo "\n\033[1;31m======================== FAILURE DETAILS ========================\033[0m\n";
    foreach ($failures as $idx => $fail) {
        $num = $idx + 1;
        echo "\033[1;31m[#{$num}] {$fail['suite']} -> {$fail['test']}\033[0m\n";
        echo "     File: {$fail['file']}:{$fail['line']}\n";
        echo "     Message: {$fail['message']}\n\n";
    }
}

echo "\033[1;36m====================================================================\033[0m\n";

if ($failedTests === 0) {
    echo "\033[1;32mVERDICT: ALL TESTS PASSED WITH 100% SUCCESS (EXIT CODE 0)\033[0m\n\n";
    exit(0);
} else {
    echo "\033[1;31mVERDICT: {$failedTests} TEST(S) FAILED (EXIT CODE 1)\033[0m\n\n";
    exit(1);
}

// -------------------------------------------------------------------------
// Helper functions
// -------------------------------------------------------------------------

function detectPhpBinary(): string {
    if (defined('PHP_BINARY') && is_executable(PHP_BINARY)) {
        return PHP_BINARY;
    }
    $candidates = array_filter([
        getenv('PHP_BIN') ?: null,
        'php.exe',
        'php'
    ]);
    foreach ($candidates as $cand) {
        if (is_executable($cand)) {
            return $cand;
        }
    }
    return 'php';
}

function findAvailablePort(int $start, int $end): int {
    for ($p = $start; $p <= $end; $p++) {
        $fp = @fsockopen('127.0.0.1', $p, $errno, $errstr, 0.1);
        if (!$fp) {
            return $p;
        }
        fclose($fp);
    }
    return $start;
}
