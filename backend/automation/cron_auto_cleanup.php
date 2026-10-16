<?php
/**
 * AUTO CLEANUP CRON JOB
 * Tự động dọn dẹp dữ liệu rác định kỳ
 * 
 * Crontab entry (chạy mỗi ngày lúc 2 giờ sáng):
 * 0 2 * * * /usr/local/bin/php /home/vhvxoigh/automation.ideas.edu.vn/mail_api/cron_auto_cleanup.php > /dev/null 2>&1
 * 
 * Hoặc chạy mỗi tuần (Chủ nhật 2 giờ sáng):
 * 0 2 * * 0 /usr/local/bin/php /home/vhvxoigh/automation.ideas.edu.vn/mail_api/cron_auto_cleanup.php > /dev/null 2>&1
 */

ini_set('display_errors', 0); // [FIX H-4] Tắt display_errors trong production — lỗi vẫn được ghi vào error_log
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
set_time_limit(600);

// [SECURITY FIX] Chỉ cho phép chạy từ CLI (cron server-side).
// Block HTTP access vì file này không cần auth và expose thông tin DB nội bộ.
if (isset($_SERVER['HTTP_HOST']) && php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo 'This script is for server-side cron execution only.';
    exit;
}

require __DIR__ . '/db_connect.php';

$logPrefix = "[" . date('Y-m-d H:i:s') . "]";

echo "$logPrefix ========================================\n";
echo "$logPrefix AUTO CLEANUP STARTED\n";
echo "$logPrefix ========================================\n\n";

$totalCleaned = 0;
$totalFreed = 0; // MB

try {
    // ============================================
    // 1. CLEAN QUEUE JOBS
    // ============================================
    echo "$logPrefix [1/6] Cleaning queue jobs...\n";

    // 1a. Clean ALL completed jobs (no retention needed)
    $stmt = $pdo->query("
        SELECT COUNT(*), 
               ROUND(SUM(LENGTH(payload))/1024/1024, 2) as size_mb
        FROM queue_jobs 
        WHERE status = 'completed'
    ");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $completedCount = $result['COUNT(*)'];
    $completedSizeMb = $result['size_mb'] ?? 0;

    if ($completedCount > 0) {
        $deleted = $pdo->exec("DELETE FROM queue_jobs WHERE status = 'completed'");
        echo "$logPrefix   Deleted $deleted completed jobs (~{$completedSizeMb}MB)\n";
        $totalCleaned += $deleted;
        $totalFreed += $completedSizeMb;
    } else {
        echo "$logPrefix   No completed jobs to clean\n";
    }

    // 1b. Clean old failed jobs (>7 days, keep recent for debugging)
    $stmt = $pdo->query("
        SELECT COUNT(*) 
        FROM queue_jobs 
        WHERE status = 'failed' 
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    $failedCount = $stmt->fetchColumn();

    if ($failedCount > 0) {
        $deleted = $pdo->exec("
            DELETE FROM queue_jobs 
            WHERE status = 'failed' 
            AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        ");
        echo "$logPrefix   Deleted $deleted old failed jobs\n";
        $totalCleaned += $deleted;
    }

    // 1c. Handle stuck jobs (processing >24h)
    $stmt = $pdo->query("
        SELECT COUNT(*) 
        FROM queue_jobs 
        WHERE status = 'processing' 
        AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ");
    $stuckCount = $stmt->fetchColumn();

    if ($stuckCount > 0) {
        $pdo->exec("
            UPDATE queue_jobs 
            SET status = 'failed', 
                finished_at = NOW(),
                error_message = 'Auto-failed: Stuck in processing for >24 hours'
            WHERE status = 'processing' 
            AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ");
        $deleted = $pdo->exec("
            DELETE FROM queue_jobs 
            WHERE status = 'failed' 
            AND error_message = 'Auto-failed: Stuck in processing for >24 hours'
        ");
        echo "$logPrefix   Cleaned $deleted stuck jobs\n";
        $totalCleaned += $deleted;
    }

    // ============================================
    // 2. ACTIVITY LOGS - DISABLED
    // ============================================
    // Per user request: Keep ALL activity logs permanently
    echo "$logPrefix [2/6] Activity log cleanup: DISABLED (keeping all records)\n";

    // ============================================
    // 3. CLEAN OLD WEB TRACKING (>90 days)
    // ============================================
    echo "$logPrefix [3/6] Cleaning old web tracking data...\n";

    $trackingTables = [
        'web_events' => 'created_at',
        'raw_event_buffer' => 'created_at'
    ];

    $trackingCleaned = 0;
    foreach ($trackingTables as $table => $dateCol) {
        try {
            $stmt = $pdo->query("
                SELECT COUNT(*) 
                FROM `$table` 
                WHERE `$dateCol` < DATE_SUB(NOW(), INTERVAL 90 DAY)
            ");
            $oldCount = $stmt->fetchColumn();

            if ($oldCount > 0) {
                // Delete in batches to avoid locking
                $deleted = $pdo->exec("
                    DELETE FROM `$table` 
                    WHERE `$dateCol` < DATE_SUB(NOW(), INTERVAL 90 DAY)
                    LIMIT 10000
                ");
                echo "$logPrefix   $table: Deleted $deleted records\n";
                $trackingCleaned += $deleted;
            }
        } catch (Exception $e) {
            echo "$logPrefix   $table: Skipped (column not found)\n";
        }
    }

    if ($trackingCleaned > 0) {
        $totalCleaned += $trackingCleaned;
    } else {
        echo "$logPrefix   No old tracking data to clean\n";
    }

    // ============================================
    // 4. CLEAN OLD PROCESSED BUFFERS (>30 days)
    // ============================================
    echo "$logPrefix [4/6] Cleaning old processed buffers...\n";

    $bufferCleaned = 0;

    // Activity buffer
    $stmt = $pdo->query("
        SELECT COUNT(*) 
        FROM activity_buffer 
        WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    ");
    $oldBufferCount = $stmt->fetchColumn();

    if ($oldBufferCount > 0) {
        $deleted = $pdo->exec("
            DELETE FROM activity_buffer 
            WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        echo "$logPrefix   activity_buffer: Deleted $deleted records\n";
        $bufferCleaned += $deleted;
    }

    // Stats buffer
    $stmt = $pdo->query("
        SELECT COUNT(*) 
        FROM stats_update_buffer 
        WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    ");
    $oldStatsCount = $stmt->fetchColumn();

    if ($oldStatsCount > 0) {
        $deleted = $pdo->exec("
            DELETE FROM stats_update_buffer 
            WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        echo "$logPrefix   stats_update_buffer: Deleted $deleted records\n";
        $bufferCleaned += $deleted;
    }

    // Timestamp buffer cleanup
    try {
        $stmt = $pdo->query("SELECT COUNT(*) FROM timestamp_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        $oldTsCount = $stmt->fetchColumn();
        if ($oldTsCount > 0) {
            $deleted = $pdo->exec("DELETE FROM timestamp_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            echo "$logPrefix   timestamp_buffer: Deleted $deleted records\n";
            $bufferCleaned += $deleted;
        }
    } catch (Exception $e) {
    }

    // Zalo activity buffer cleanup
    try {
        $stmt = $pdo->query("SELECT COUNT(*) FROM zalo_activity_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        $oldZaCount = $stmt->fetchColumn();
        if ($oldZaCount > 0) {
            $deleted = $pdo->exec("DELETE FROM zalo_activity_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            echo "$logPrefix   zalo_activity_buffer: Deleted $deleted records\n";
            $bufferCleaned += $deleted;
        }
    } catch (Exception $e) {
    }

    if ($bufferCleaned > 0) {
        $totalCleaned += $bufferCleaned;
    } else {
        echo "$logPrefix   No old buffers to clean\n";
    }

    // ============================================
    // 5. OPTIMIZE FRAGMENTED TABLES (if needed)
    // ============================================
    echo "$logPrefix [5/6] Checking for fragmentation...\n";

    $stmt = $pdo->query("
        SELECT TABLE_NAME, ROUND((DATA_FREE / 1024 / 1024), 2) AS free_mb
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND DATA_FREE > 10485760
        ORDER BY DATA_FREE DESC
        LIMIT 5
    ");

    $fragmentedTables = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($fragmentedTables)) {
        echo "$logPrefix   Found " . count($fragmentedTables) . " fragmented tables, optimizing...\n";

        foreach ($fragmentedTables as $table) {
            try {
                $optimizePdo = new PDO(
                    "mysql:host=$host;dbname=$db;charset=$charset",
                    $user,
                    $pass,
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                $optimizePdo->exec("OPTIMIZE TABLE `{$table['TABLE_NAME']}`");
                $optimizePdo = null;
                echo "$logPrefix   Optimized {$table['TABLE_NAME']} ({$table['free_mb']}MB freed)\n";
                $totalFreed += $table['free_mb'];
            } catch (Exception $e) {
                echo "$logPrefix   Failed to optimize {$table['TABLE_NAME']}\n";
            }
        }
    } else {
        echo "$logPrefix   No fragmentation detected\n";
    }

    // ============================================
    // 6. LOG ROTATION (Prevent Disk Full)
    // [FIX] Reduced threshold from 20MB → 5MB, added backup cleanup.
    // Original 20MB threshold too large — individual logs hit 24MB+ before rotating.
    // ============================================
    echo "$logPrefix [6/6] Rotating large log files...\n";
    $logRotated = 0;
    $logDirs = [__DIR__, __DIR__ . '/_debug', __DIR__ . '/logs'];
    $maxLogSize = 5 * 1024 * 1024; // [FIX] 5MB threshold (was 20MB)
    foreach ($logDirs as $ldir) {
        if (!is_dir($ldir)) continue;
        $files = glob($ldir . '/*.log');
        foreach ($files as $file) {
            if (!file_exists($file)) continue;
            $size = filesize($file);
            if ($size > $maxLogSize) {
                $backup = $file . '.' . date('Ymd_His') . '.bak';
                if (@rename($file, $backup)) {
                    touch($file); // Create fresh empty log
                    echo "$logPrefix   Rotated: " . basename($file) . " (" . round($size/1024/1024, 1) . "MB)\n";
                    $logRotated++;
                    $totalFreed += round($size/1024/1024, 2);
                }
            }
        }
        // [FIX] Delete old backups — keep 2 most recent per log file
        $allLogs = glob($ldir . '/*.log');
        foreach ($allLogs as $baseLog) {
            $backups = glob($baseLog . '.*.bak');
            if ($backups && count($backups) > 2) {
                sort($backups);
                $toDelete = array_slice($backups, 0, count($backups) - 2);
                foreach ($toDelete as $old) {
                    @unlink($old);
                    $logRotated++;
                }
            }
        }
    }

    // [FIX] Also clean orphaned lock files (>10 min old)
    $lockFiles = glob(__DIR__ . '/*.lock');
    foreach ($lockFiles ?? [] as $lock) {
        if (file_exists($lock) && (time() - filemtime($lock)) > 600) {
            @unlink($lock);
        }
    }

    echo "$logPrefix   Rotated/cleaned $logRotated log files.\n";

    // ============================================
    // SUMMARY
    // ============================================
    echo "\n$logPrefix ========================================\n";
    echo "$logPrefix CLEANUP SUMMARY\n";
    echo "$logPrefix ========================================\n";
    echo "$logPrefix Total records cleaned: " . number_format($totalCleaned) . "\n";
    echo "$logPrefix Total space freed: ~" . number_format($totalFreed, 2) . " MB\n";
    echo "$logPrefix Status: SUCCESS\n";
    echo "$logPrefix ========================================\n\n";

} catch (Exception $e) {
    error_log("[cron_auto_cleanup] FATAL: " . $e->getMessage());
    echo "$logPrefix ERROR: " . $e->getMessage() . "\n";
    echo "$logPrefix Status: FAILED\n\n";
}

echo "$logPrefix Auto cleanup finished.\n";
