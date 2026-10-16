<?php
/**
 * api/worker_maintenance.php
 * High-Performance System Maintenance & Self-Healing Service
 * Running: Daily (Recommended 3:00 AM)
 */

require_once __DIR__ . '/db_connect.php';

function runMaintenance($pdo) {
    echo "[" . date('Y-m-d H:i:s') . "] Starting System Maintenance...\n";
    
    // 1. Auto-Partitioning for raw_event_buffer (2027+ Preparation)
    try {
        echo " - Checking Partitions...\n";
        $currentPartitions = $pdo->query("SELECT PARTITION_NAME FROM information_schema.PARTITIONS WHERE TABLE_NAME = 'raw_event_buffer' AND TABLE_SCHEMA = DATABASE()")->fetchAll(PDO::FETCH_COLUMN);
        
        $nextYear = date('Y', strtotime('+1 year'));
        $targetPartition = "p{$nextYear}_01";
        
        if (!in_array($targetPartition, $currentPartitions)) {
            echo "   -> Creating partitions for $nextYear...\n";
            $sql = "ALTER TABLE `raw_event_buffer` REORGANIZE PARTITION p_future INTO (";
            for ($m = 1; $m <= 12; $m++) {
                $pName = sprintf("p%s_%02d", $nextYear, $m);
                $lessThan = strtotime(sprintf("%s-%02d-01 00:00:00", ($m == 12 ? $nextYear + 1 : $nextYear), ($m == 12 ? 1 : $m + 1)));
                $sql .= "\n      PARTITION $pName VALUES LESS THAN ($lessThan) ENGINE=InnoDB,";
            }
            $sql .= "\n      PARTITION p_future VALUES LESS THAN MAXVALUE\n);";
            $pdo->exec($sql);
            echo "   -> [OK] $nextYear partitions added.\n";
        }
    } catch (Exception $e) {
        echo "   -> [FAIL] Partition check failed: " . $e->getMessage() . "\n";
    }

    // 2. Capping Zalo Message History (Keep last 20 per user)
    try {
        echo " - Capping Zalo Message History...\n";
        // Optimized cleanup using a single mass-delete
        $pdo->exec("
            DELETE FROM zalo_user_messages 
            WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER(PARTITION BY zalo_user_id ORDER BY created_at DESC) as rn 
                    FROM zalo_user_messages
                ) as t 
                WHERE rn <= 20
            )
        ");
        echo "   -> [OK] History capped.\n";
    } catch (Exception $e) {
        echo "   -> [FAIL] History cap failed: " . $e->getMessage() . "\n";
    }

    // 3. Strategic Index Healing (Moved from tracking worker)
    try {
        echo " - Checking Strategic Indexes...\n";
        $indexes = [
            'activity_buffer' => ['idx_workspace_batch' => 'workspace_id, processed, created_at'],
            'zalo_activity_buffer' => ['idx_workspace_batch' => 'workspace_id, processed, created_at'],
            'subscribers' => ['idx_perf_search' => 'workspace_id, status, id']
        ];
        
        foreach ($indexes as $table => $idxs) {
            foreach ($idxs as $name => $cols) {
                try {
                    $pdo->exec("ALTER TABLE `$table` ADD INDEX IF NOT EXISTS `$name` ($cols)");
                } catch (Exception $ex) {}
            }
        }
        echo "   -> [OK] Indexes verified.\n";
    } catch (Exception $e) {
        echo "   -> [FAIL] Index check failed: " . $e->getMessage() . "\n";
    }

    // 4. Queue Pruning & GC
    try {
        echo " - Pruning Queues...\n";
        $pdo->exec("DELETE FROM queue_jobs WHERE status = 'completed' AND created_at < NOW() - INTERVAL 7 DAY");
        $pdo->exec("DELETE FROM system_audit_logs WHERE created_at < NOW() - INTERVAL 90 DAY");
        echo "   -> [OK] Old logs pruned.\n";
    } catch (Exception $e) {
        echo "   -> [FAIL] Pruning failed: " . $e->getMessage() . "\n";
    }

    echo "[" . date('Y-m-d H:i:s') . "] Maintenance Finished.\n";
}

// Support for CLI and background trigger
$isCli = php_sapi_name() === 'cli';
$adminToken = $_GET['admin_token'] ?? '';
$validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : 'autoflow-admin-001';

if ($isCli || (isset($_GET['action']) && $_GET['action'] === 'maintenance_cleanup' && $adminToken === $validBypassToken)) {
    runMaintenance($pdo);
} else if (!$isCli && isset($_GET['action'])) {
    http_response_code(403);
    die("Unauthorized maintenance execution.");
}
