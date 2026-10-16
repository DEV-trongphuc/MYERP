<?php
/**
 * CRON JOB: Auto-sync Flow States (ENHANCED VERSION)
 * Chạy định kỳ mỗi giờ để tự động fix các vấn đề đồng bộ
 * 
 * Crontab entry (chạy mỗi giờ):
 * 0 * * * * /usr/local/bin/php /home/vhvxoigh/automation.ideas.edu.vn/mail_api/cron_auto_sync_flows.php > /dev/null 2>&1
 * 
 * Hoặc chạy mỗi 30 phút (thay dấu * đầu tiên bằng dấu sao-gạch-30):
 * 0,30 * * * * /usr/local/bin/php /home/vhvxoigh/automation.ideas.edu.vn/mail_api/cron_auto_sync_flows.php > /dev/null 2>&1
 */

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
// [SECURITY] Prevent web browsers from triggering this cron job (it has no auth).
// It is safe to run via CLI cron (no HTTP_HOST), or direct CLI invocation.
// Any HTTP request to this file is rejected — cron must be server-side only.
if (isset($_SERVER['HTTP_HOST']) && php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'This script is for server-side cron execution only.';
    exit;
}
header('Content-Type: text/plain; charset=utf-8');

// [FIX P13-H1] Non-blocking exclusive file lock to prevent concurrent cron overlaps.
// If a previous run is still executing (heavy DB), flock() returns false ? exit immediately.
// Lock is automatically released when the process ends (file handle closed on exit).
$_cronLockFile = __DIR__ . '/autoflow_cron_sync.lock';
$_cronLockFp   = @fopen($_cronLockFile, 'c');
if (!$_cronLockFp || !flock($_cronLockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another cron_auto_sync_flows instance is still running. Skipping this invocation.\n";
    if ($_cronLockFp) fclose($_cronLockFp);
    exit;
}
register_shutdown_function(function () use ($_cronLockFp) {
    @flock($_cronLockFp, LOCK_UN);
    @fclose($_cronLockFp);
});

try {
    require __DIR__ . '/db_connect.php';
} catch (Exception $e) {
    die("Database connection failed: " . $e->getMessage());

}

$logPrefix = "[" . date('Y-m-d H:i:s') . "]";
$criticalErrors = [];

echo "$logPrefix ========================================\n";
echo "$logPrefix Starting auto-sync cron job (ENHANCED)\n";
echo "$logPrefix ========================================\n\n";

try {
    // ============================================
    // 1. Fix mismatched completed states (có log nhung chua mark completed)
    // ============================================
    echo "$logPrefix [1/6] Checking for mismatched completed states...\n";

    $stmt = $pdo->query("SELECT id, name FROM flows WHERE status IN ('active', 'paused')");
    $activeFlows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalFixed = 0;

    foreach ($activeFlows as $flow) {
        $flowId = $flow['id'];

        // Find subscribers with complete_flow log AFTER current enrollment but not marked completed (BUG-FLOW-15)
        $stmt = $pdo->prepare("
            SELECT DISTINCT sa.subscriber_id, sfs.status
            FROM subscriber_activity sa
            LEFT JOIN subscriber_flow_states sfs ON sa.subscriber_id = sfs.subscriber_id AND sa.flow_id = sfs.flow_id
            WHERE sa.flow_id = ? AND sa.type = 'complete_flow'
            AND (sfs.status IS NULL OR (sfs.status != 'completed' AND sa.created_at >= sfs.created_at))
        ");
        $stmt->execute([$flowId]);
        $mismatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($mismatches as $m) {
            if ($m['status'] === null) {
                // Insert missing record
                $pdo->prepare("
                    INSERT INTO subscriber_flow_states (flow_id, subscriber_id, status, step_id, updated_at)
                    VALUES (?, ?, 'completed', 'final', NOW())
                ")->execute([$flowId, $m['subscriber_id']]);
                echo "$logPrefix   INSERTED completed state for subscriber {$m['subscriber_id']} in flow '{$flow['name']}'\n";
            } else {
                // Update existing record
                $pdo->prepare("
                    UPDATE subscriber_flow_states 
                    SET status = 'completed', updated_at = NOW()
                    WHERE flow_id = ? AND subscriber_id = ?
                ")->execute([$flowId, $m['subscriber_id']]);
                echo "$logPrefix   UPDATED status to completed for subscriber {$m['subscriber_id']} in flow '{$flow['name']}'\n";
            }
            $totalFixed++;
        }
    }

    echo "$logPrefix   Result: Fixed $totalFixed mismatches.\n\n";

    // ============================================
    // 2. REVERSE CHECK: Mark completed nhung KHÔNG có complete_flow log
    // ============================================
    echo "$logPrefix [2/6] Checking for false completed states...\n";

    $falseCompletedCount = 0;

    foreach ($activeFlows as $flow) {
        $flowId = $flow['id'];

        $stmt = $pdo->prepare("
            SELECT sfs.subscriber_id, sfs.step_id
            FROM subscriber_flow_states sfs
            LEFT JOIN subscriber_activity sa ON sfs.subscriber_id = sa.subscriber_id 
                AND sfs.flow_id = sa.flow_id 
                AND sa.type = 'complete_flow'
            WHERE sfs.flow_id = ? AND sfs.status = 'completed'
            AND sa.id IS NULL
        ");
        $stmt->execute([$flowId]);
        $falseCompleted = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($falseCompleted)) {
            echo "$logPrefix   WARNING: Flow '{$flow['name']}' has " . count($falseCompleted) . " false completed states.\n";

            // Check if they have ANY activity logs
            foreach ($falseCompleted as $fc) {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity WHERE flow_id = ? AND subscriber_id = ?");
                $stmt->execute([$flowId, $fc['subscriber_id']]);
                $hasActivity = $stmt->fetchColumn() > 0;

                if (!$hasActivity) {
                    // No activity at all -> likely garbage data, remove it
                    $pdo->prepare("DELETE FROM subscriber_flow_states WHERE flow_id = ? AND subscriber_id = ?")
                        ->execute([$flowId, $fc['subscriber_id']]);
                    echo "$logPrefix   DELETED garbage state for subscriber {$fc['subscriber_id']} (no activity logs)\n";
                    $falseCompletedCount++;
                } else {
                    // Has activity -> add complete_flow log
                    try {
                        $pdo->prepare("
                            INSERT INTO subscriber_activity (flow_id, subscriber_id, type, reference_id, created_at)
                            VALUES (?, ?, 'complete_flow', ?, NOW())
                        ")->execute([$flowId, $fc['subscriber_id'], $fc['step_id']]);
                        echo "$logPrefix   ADDED complete_flow log for subscriber {$fc['subscriber_id']}\n";
                        $falseCompletedCount++;
                    } catch (PDOException $e) {
                        if ($e->getCode() != 23000) { // Ignore duplicates
                            echo "$logPrefix   ERROR adding log for {$fc['subscriber_id']}: {$e->getMessage()}\n";
                        }
                    }
                }
            }
        }
    }

    echo "$logPrefix   Result: Fixed $falseCompletedCount false completed states.\n\n";

    // ============================================
    // 3. Process pending buffers
    // ============================================
    echo "$logPrefix [3/6] Checking buffer tables...\n";

    $stmt = $pdo->query("SELECT COUNT(*) FROM activity_buffer WHERE processed = 0");
    $activityPending = $stmt->fetchColumn();

    $stmt = $pdo->query("SELECT COUNT(*) FROM stats_update_buffer WHERE processed = 0");
    $statsPending = $stmt->fetchColumn();

    echo "$logPrefix   Activity buffer: $activityPending pending\n";
    echo "$logPrefix   Stats buffer: $statsPending pending\n";

    if ($activityPending > 0 || $statsPending > 0) {
        echo "$logPrefix   Triggering worker_tracking_aggregator...\n";

        // Trigger the aggregator worker
        $workerUrl = API_BASE_URL . '/worker_tracking_aggregator.php';
        $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
        $ch = curl_init($workerUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-Cron-Secret: ' . $cronSecret]);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode == 200) {
            echo "$logPrefix   Worker triggered successfully.\n";
        } else {
            echo "$logPrefix   WARNING: Worker returned HTTP $httpCode\n";
            $criticalErrors[] = "Buffer worker failed with HTTP $httpCode";
        }
    }

    echo "\n";

    // ============================================
    // 4. Update flow statistics (global + step-level)
    // ============================================
    echo "$logPrefix [4/6] Updating flow statistics...\n";

    foreach ($activeFlows as $flow) {
        $flowId = $flow['id'];

        // Global stats
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT CASE WHEN status != 'cancelled' THEN subscriber_id END) as enrolled,
                COUNT(DISTINCT CASE WHEN status = 'completed' THEN subscriber_id END) as completed
            FROM subscriber_flow_states 
            WHERE flow_id = ?
        ");
        $stmt->execute([$flowId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        $pdo->prepare("UPDATE flows SET stat_enrolled = ?, stat_completed = ? WHERE id = ?")
            ->execute([$stats['enrolled'], $stats['completed'], $flowId]);
    }

    echo "$logPrefix   Updated statistics for " . count($activeFlows) . " flows.\n\n";

    // ============================================
    // 5. Cleanup stuck users (>30 days in waiting)
    // ============================================
    echo "$logPrefix [5/6] Checking for stuck users (>30 days)...\n";

    $stmt = $pdo->query("
        SELECT flow_id, COUNT(*) as stuck_count
        FROM subscriber_flow_states
        WHERE status = 'waiting'
        AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY flow_id
    ");
    $stuckByFlow = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($stuckByFlow)) {
        foreach ($stuckByFlow as $s) {
            echo "$logPrefix   WARNING: Flow {$s['flow_id']} has {$s['stuck_count']} users stuck >30 days\n";
            $criticalErrors[] = "Flow {$s['flow_id']} has {$s['stuck_count']} users stuck >30 days";
        }
    } else {
        echo "$logPrefix   No stuck users found.\n";
    }

    echo "\n";

    // ============================================
    // 6. Health check summary
    // ============================================
    echo "$logPrefix [6/6] Health check summary...\n";

    $stmt = $pdo->query("SELECT COUNT(*) FROM subscriber_flow_states WHERE status = 'failed'");
    $failedCount = $stmt->fetchColumn();

    echo "$logPrefix   Total failed states: $failedCount\n";

    if ($failedCount > 100) {
        $criticalErrors[] = "High number of failed states: $failedCount";
    }

    echo "\n";

    // ============================================
    // Summary
    // ============================================
    echo "$logPrefix ========================================\n";
    echo "$logPrefix SUMMARY\n";
    echo "$logPrefix ========================================\n";
    echo "$logPrefix Flows checked: " . count($activeFlows) . "\n";
    echo "$logPrefix Mismatches fixed: $totalFixed\n";
    echo "$logPrefix False completed fixed: $falseCompletedCount\n";
    echo "$logPrefix Critical errors: " . count($criticalErrors) . "\n";

    if (!empty($criticalErrors)) {
        echo "$logPrefix \n";
        echo "$logPrefix CRITICAL ERRORS:\n";
        foreach ($criticalErrors as $err) {
            echo "$logPrefix   - $err\n";
        }

        // TODO: Send email notification to admin
        // mail('admin@ideas.edu.vn', 'Flow Sync Critical Errors', implode("\n", $criticalErrors));
    }

    echo "$logPrefix ========================================\n";

} catch (Exception $e) {
    echo "$logPrefix FATAL ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";

    // TODO: Send critical error notification
    // mail('admin@ideas.edu.vn', 'Flow Sync FATAL ERROR', $e->getMessage() . "\n\n" . $e->getTraceAsString());
}

echo "$logPrefix Auto-sync cron job finished.\n\n";


