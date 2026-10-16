<?php
require_once 'auth_middleware.php';
/**
 * COMPREHENSIVE SYSTEM DEBUG & HEALTH CHECK
 * Kiểm tra toàn bộ hệ thống flow automation để phát hiện lỗi
 */

ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);
header('Content-Type: text/plain; charset=utf-8');

echo "+----------------------------------------------------------------+\n";
echo "¦  MAILFLOW PRO - COMPREHENSIVE SYSTEM HEALTH CHECK              ¦\n";
echo "¦  " . date('Y-m-d H:i:s') . "                                          ¦\n";
echo "+----------------------------------------------------------------+\n\n";

$errors = [];
$warnings = [];
$info = [];

// ============================================
// 1. DATABASE CONNECTION
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "1. DATABASE CONNECTION\n";
echo "????????????????????????????????????????????????????????????????\n";

try {
    require __DIR__ . '/db_connect.php';
    echo "? Database connection: OK\n";

    // Test query
    $stmt = $pdo->query("SELECT VERSION()");
    $version = $stmt->fetchColumn();
    echo "? MySQL Version: $version\n";

} catch (Exception $e) {
    $errors[] = "Database connection failed: " . $e->getMessage();
    echo "? Database connection: FAILED\n";
    echo "   Error: " . $e->getMessage() . "\n";
    die("\n⚠️ Cannot proceed without database connection.\n");
}

echo "\n";

// ============================================
// 2. TABLE STRUCTURE CHECK
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "2. TABLE STRUCTURE CHECK\n";
echo "????????????????????????????????????????????????????????????????\n";

$requiredTables = [
    'flows',
    'subscriber_flow_states',
    'subscriber_activity',
    'activity_buffer',
    'stats_update_buffer',
    'subscribers',
    'campaigns'
];

foreach ($requiredTables as $table) {
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->query("SELECT COUNT(*) FROM $table");
            $count = $stmt->fetchColumn();
            echo "? Table '$table': EXISTS ($count rows)\n";
        } else {
            $errors[] = "Table '$table' does not exist";
            echo "? Table '$table': MISSING\n";
        }
    } catch (Exception $e) {
        $errors[] = "Error checking table '$table': " . $e->getMessage();
        echo "? Table '$table': ERROR - " . $e->getMessage() . "\n";
    }
}

echo "\n";

// ============================================
// 3. FLOW DATA INTEGRITY
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "3. FLOW DATA INTEGRITY\n";
echo "????????????????????????????????????????????????????????????????\n";

// 3.1 Check for mismatched completed states
$stmt = $pdo->query("
    SELECT COUNT(DISTINCT sa.subscriber_id) as mismatch_count
    FROM subscriber_activity sa
    LEFT JOIN subscriber_flow_states sfs ON sa.subscriber_id = sfs.subscriber_id AND sa.flow_id = sfs.flow_id
    WHERE sa.type = 'complete_flow'
    AND (sfs.status IS NULL OR sfs.status != 'completed')
");
$mismatchCount = $stmt->fetchColumn();

if ($mismatchCount > 0) {
    $warnings[] = "$mismatchCount subscribers have complete_flow log but not marked completed";
    echo "??  Mismatched completed states: $mismatchCount\n";
} else {
    echo "? Mismatched completed states: 0\n";
}

// 3.2 Check for false completed states
$stmt = $pdo->query("
    SELECT COUNT(DISTINCT sfs.subscriber_id) as false_count
    FROM subscriber_flow_states sfs
    LEFT JOIN subscriber_activity sa ON sfs.subscriber_id = sa.subscriber_id 
        AND sfs.flow_id = sa.flow_id 
        AND sa.type = 'complete_flow'
    WHERE sfs.status = 'completed'
    AND sa.id IS NULL
");
$falseCount = $stmt->fetchColumn();

if ($falseCount > 0) {
    $warnings[] = "$falseCount subscribers marked completed but no complete_flow log";
    echo "??  False completed states: $falseCount\n";
} else {
    echo "? False completed states: 0\n";
}

// 3.3 Check for stuck users
$stmt = $pdo->query("
    SELECT COUNT(*) as stuck_count
    FROM subscriber_flow_states
    WHERE status = 'waiting'
    AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
");
$stuckCount = $stmt->fetchColumn();

if ($stuckCount > 0) {
    $warnings[] = "$stuckCount users stuck in waiting state >30 days";
    echo "??  Stuck users (>30 days): $stuckCount\n";
} else {
    echo "? Stuck users (>30 days): 0\n";
}

// 3.4 Check for failed states
$stmt = $pdo->query("SELECT COUNT(*) FROM subscriber_flow_states WHERE status = 'failed'");
$failedCount = $stmt->fetchColumn();

if ($failedCount > 100) {
    $warnings[] = "High number of failed states: $failedCount";
    echo "??  Failed states: $failedCount (HIGH)\n";
} else if ($failedCount > 0) {
    echo "??  Failed states: $failedCount\n";
} else {
    echo "? Failed states: 0\n";
}

echo "\n";

// ============================================
// 4. BUFFER STATUS
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "4. BUFFER STATUS\n";
echo "????????????????????????????????????????????????????????????????\n";

$stmt = $pdo->query("SELECT COUNT(*) FROM activity_buffer WHERE processed = 0");
$activityPending = $stmt->fetchColumn();

$stmt = $pdo->query("SELECT COUNT(*) FROM stats_update_buffer WHERE processed = 0");
$statsPending = $stmt->fetchColumn();

if ($activityPending > 1000) {
    $warnings[] = "High activity buffer backlog: $activityPending";
    echo "??  Activity buffer (pending): $activityPending (HIGH)\n";
} else if ($activityPending > 0) {
    echo "??  Activity buffer (pending): $activityPending\n";
} else {
    echo "? Activity buffer (pending): 0\n";
}

if ($statsPending > 1000) {
    $warnings[] = "High stats buffer backlog: $statsPending";
    echo "??  Stats buffer (pending): $statsPending (HIGH)\n";
} else if ($statsPending > 0) {
    echo "??  Stats buffer (pending): $statsPending\n";
} else {
    echo "? Stats buffer (pending): 0\n";
}

echo "\n";

// ============================================
// 5. FLOW STATISTICS VALIDATION
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "5. FLOW STATISTICS VALIDATION\n";
echo "????????????????????????????????????????????????????????????????\n";

$stmt = $pdo->query("
    SELECT f.id, f.name, f.stat_enrolled, f.stat_completed,
           COUNT(DISTINCT sfs.subscriber_id) as actual_enrolled,
           COUNT(DISTINCT CASE WHEN sfs.status = 'completed' THEN sfs.subscriber_id END) as actual_completed
    FROM flows f
    LEFT JOIN subscriber_flow_states sfs ON f.id = sfs.flow_id
    WHERE f.status IN ('active', 'paused')
    GROUP BY f.id
");

$statsIssues = 0;
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $enrolledMatch = $row['stat_enrolled'] == $row['actual_enrolled'];
    $completedMatch = $row['stat_completed'] == $row['actual_completed'];

    if (!$enrolledMatch || !$completedMatch) {
        $statsIssues++;
        echo "??  Flow '{$row['name']}':\n";
        if (!$enrolledMatch) {
            echo "     Enrolled: {$row['stat_enrolled']} (stored) vs {$row['actual_enrolled']} (actual)\n";
        }
        if (!$completedMatch) {
            echo "     Completed: {$row['stat_completed']} (stored) vs {$row['actual_completed']} (actual)\n";
        }
        $warnings[] = "Flow '{$row['name']}' has mismatched statistics";
    }
}

if ($statsIssues == 0) {
    echo "? All flow statistics are accurate\n";
} else {
    echo "\n📊  Total flows with stat issues: $statsIssues\n";
}

echo "\n";

// ============================================
// 6. WORKER HEALTH CHECK
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "6. WORKER HEALTH CHECK\n";
echo "????????????????????????????????????????????????????????????????\n";

$workers = [
    'worker_flow.php',
    'worker_tracking_aggregator.php',
    'worker_campaign.php',
    'worker_priority.php'
];

foreach ($workers as $worker) {
    $path = __DIR__ . '/' . $worker;
    if (file_exists($path)) {
        echo "? $worker: EXISTS\n";
    } else {
        $errors[] = "Worker file missing: $worker";
        echo "? $worker: MISSING\n";
    }
}

echo "\n";

// ============================================
// 7. API ENDPOINTS CHECK
// ============================================
echo "????????????????????????????????????????????????????????????????\n";
echo "7. API ENDPOINTS CHECK\n";
echo "????????????????????????????????????????????????????????????????\n";

$endpoints = [
    'flows.php',
    'campaigns.php',
    'subscribers.php',
    'webhook.php'
];

foreach ($endpoints as $endpoint) {
    $path = __DIR__ . '/' . $endpoint;
    if (file_exists($path)) {
        // Check for syntax errors
        $output = [];
        $return = 0;
        exec("php -l " . escapeshellarg($path) . " 2>&1", $output, $return);

        if ($return === 0) {
            echo "? $endpoint: OK\n";
        } else {
            $errors[] = "Syntax error in $endpoint";
            echo "? $endpoint: SYNTAX ERROR\n";
            echo "   " . implode("\n   ", $output) . "\n";
        }
    } else {
        $errors[] = "API endpoint missing: $endpoint";
        echo "? $endpoint: MISSING\n";
    }
}

echo "\n";

// ============================================
// SUMMARY
// ============================================
echo "+----------------------------------------------------------------+\n";
echo "¦  SUMMARY                                                       ¦\n";
echo "+----------------------------------------------------------------+\n\n";

echo "?? Critical Errors: " . count($errors) . "\n";
if (!empty($errors)) {
    foreach ($errors as $i => $err) {
        echo "   " . ($i + 1) . ". $err\n";
    }
}

echo "\n⚠️ Warnings: " . count($warnings) . "\n";
if (!empty($warnings)) {
    foreach ($warnings as $i => $warn) {
        echo "   " . ($i + 1) . ". $warn\n";
    }
}

echo "\n";

if (count($errors) == 0 && count($warnings) == 0) {
    echo "+----------------------------------------------------------------+\n";
    echo "¦  ? SYSTEM HEALTH: EXCELLENT                                   ¦\n";
    echo "¦  All checks passed. System is operating normally.             ¦\n";
    echo "+----------------------------------------------------------------+\n";
} else if (count($errors) == 0) {
    echo "+----------------------------------------------------------------+\n";
    echo "¦  ??  SYSTEM HEALTH: GOOD (with warnings)                       ¦\n";
    echo "¦  No critical errors, but some issues need attention.          ¦\n";
    echo "+----------------------------------------------------------------+\n";
} else {
    echo "+----------------------------------------------------------------+\n";
    echo "¦  ? SYSTEM HEALTH: CRITICAL                                    ¦\n";
    echo "¦  Critical errors detected. Immediate action required.         ¦\n";
    echo "+----------------------------------------------------------------+\n";
}

echo "\n";
echo "Report generated at: " . date('Y-m-d H:i:s') . "\n";
