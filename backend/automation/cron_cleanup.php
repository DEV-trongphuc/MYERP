<?php
/**
 * api/cron_cleanup.php
 * ============================================================
 * Thay thế MySQL Event Scheduler (không khả dụng trên shared hosting)
 * Chạy qua cPanel Cron Jobs: mỗi giờ 1 lần
 *
 * cPanel Cron Setup:
 *   Schedule : 0 * * * *   (every hour)
 *   Command  : php /home/vhvxoigh/automation.ideas.edu.vn/mail_api/cron_cleanup.php
 *
 * Hoặc via URL (cron service như cron-job.org):
 *   URL: https://automation.ideas.edu.vn/api/cron_cleanup.php?secret=autoflow_cron_2026
 * ============================================================
 */

define('CRON_SECRET', getenv('CRON_SECRET') ?: 'autoflow_cron_2026');

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    $secret = $_GET['secret'] ?? '';
    if ($secret !== CRON_SECRET) {
        http_response_code(403);
        exit("403 Forbidden\n");
    }
    header('Content-Type: text/plain; charset=utf-8');
}

require_once __DIR__ . '/db_connect.php';

if (!isset($pdo)) {
    exit("ERROR: DB connection failed\n");
}

$start   = microtime(true);
$results = [];

function runCleanup(PDO $pdo, string $label, string $sql): array
{
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $rows = $stmt->rowCount();
        return ['label' => $label, 'rows' => $rows, 'status' => 'OK'];
    } catch (PDOException $e) {
        return ['label' => $label, 'rows' => 0, 'status' => 'ERROR: ' . $e->getMessage()];
    }
}

function runPartitionCleanup(PDO $pdo, string $table, string $fallbackSql, int $retentionDays): array
{
    try {
        // Automatically determine the partition expression format to calculate the correct threshold
        $stmtExpr = $pdo->prepare("SELECT PARTITION_EXPRESSION FROM information_schema.partitions WHERE table_schema = DATABASE() AND table_name = ? AND PARTITION_EXPRESSION IS NOT NULL LIMIT 1");
        $stmtExpr->execute([$table]);
        $expr = strtolower((string)$stmtExpr->fetchColumn());
        
        $threshold = null;
        if (strpos($expr, 'unix_timestamp') !== false) {
            $stmtTh = $pdo->query("SELECT UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL $retentionDays DAY))");
            $threshold = (int)$stmtTh->fetchColumn();
        } elseif (strpos($expr, 'to_days') !== false) {
            $stmtTh = $pdo->query("SELECT TO_DAYS(DATE_SUB(NOW(), INTERVAL $retentionDays DAY))");
            $threshold = (int)$stmtTh->fetchColumn();
        } elseif (strpos($expr, 'year') !== false && strpos($expr, 'month') !== false) {
            $retentionMonths = ceil($retentionDays / 30);
            $threshold = (int)date('Ym', strtotime("-$retentionMonths months"));
        }

        if ($threshold !== null && $threshold > 0) {
            $stmt = $pdo->prepare("SELECT PARTITION_NAME FROM information_schema.partitions WHERE table_schema = DATABASE() AND table_name = ? AND partition_name IS NOT NULL AND partition_name != 'p_future' AND partition_description != 'MAXVALUE' AND CAST(partition_description AS UNSIGNED) < ?");
            $stmt->execute([$table, $threshold]);
            $partitions = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            if (!empty($partitions)) {
                $partitionList = implode(',', $partitions);
                $pdo->exec("ALTER TABLE `$table` DROP PARTITION $partitionList");
                return ['label' => $table . ' (Partitions)', 'rows' => count($partitions), 'status' => 'DROPPED'];
            }
        }
        
        // Fallback to traditional DELETE if not partitioned or no matching partitions found
        $stmt = $pdo->prepare($fallbackSql);
        $stmt->execute();
        $rows = $stmt->rowCount();
        return ['label' => $table, 'rows' => $rows, 'status' => 'OK'];
    } catch (PDOException $e) {
        return ['label' => $table, 'rows' => 0, 'status' => 'ERROR: ' . $e->getMessage()];
    }
}

// ── [EVT-1] raw_event_buffer: purge processed rows older than 24h ─────────
$results[] = runPartitionCleanup($pdo, 'raw_event_buffer',
    "DELETE FROM `raw_event_buffer`
     WHERE `processed` = 1
       AND `created_at` < DATE_SUB(NOW(), INTERVAL 24 HOUR)
     LIMIT 5000",
    1 // 1 day retention
);

// ── [EVT-2] login_attempts: purge entries older than 1h ───────────────────
$results[] = runPartitionCleanup($pdo, 'login_attempts',
    "DELETE FROM `login_attempts`
     WHERE `attempted_at` < DATE_SUB(NOW(), INTERVAL 1 HOUR)
     LIMIT 10000",
    1 // Fallback to 1 day if partitioned
);

// ── [EVT-3] ai_vector_cache: purge vectors older than 30 days ────────────
$results[] = runCleanup($pdo, 'ai_vector_cache',
    "DELETE FROM `ai_vector_cache`
     WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 30 DAY)
     LIMIT 1000"
);

// ── [EVT-4] web_sessions: purge old bot sessions to save space ────────────
$results[] = runCleanup($pdo, 'web_sessions_bot',
    "DELETE FROM `web_sessions`
     WHERE `device_type` = 'bot'
       AND `id` < (
           SELECT `id` FROM (
               SELECT `id`
               FROM `web_sessions`
               WHERE `device_type` = 'bot'
               ORDER BY `id` DESC
               LIMIT 1 OFFSET 1000
           ) AS subquery
       )"
);

// ── [EVT-5] ai_rag_search_cache: purge cache older than 7 days ───────────
$results[] = runCleanup($pdo, 'ai_rag_search_cache',
    "DELETE FROM `ai_rag_search_cache`
     WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 7 DAY)
     LIMIT 5000"
);

// ── [EVT-5] activity_buffer: purge old processed rows ────────────────────
$results[] = runCleanup($pdo, 'activity_buffer',
    "DELETE FROM `activity_buffer`
     WHERE `processed` = 1
       AND `created_at` < DATE_SUB(NOW(), INTERVAL 30 DAY)
     LIMIT 5000"
);

// ── [EVT-6] zalo_message_queue: purge processed messages older than 24h ──
$results[] = runCleanup($pdo, 'zalo_message_queue',
    "DELETE FROM `zalo_message_queue`
     WHERE `processed` = 1
       AND `created_at` < DATE_SUB(NOW(), INTERVAL 24 HOUR)
     LIMIT 5000"
);

// ── Output ────────────────────────────────────────────────────────────────
$elapsed  = round((microtime(true) - $start) * 1000);
$totalRows = array_sum(array_column($results, 'rows'));
$timestamp = date('Y-m-d H:i:s');

echo "[cron_cleanup] $timestamp ({$elapsed}ms)\n";
foreach ($results as $r) {
    $pad = str_pad($r['label'], 24);
    echo "  $pad {$r['status']} — {$r['rows']} rows deleted\n";
}
echo "  Total: $totalRows rows purged\n";

// ── Optional: log to file ─────────────────────────────────────────────────
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
$logLine = "[$timestamp] cleanup: $totalRows rows, {$elapsed}ms | "
    . implode(', ', array_map(fn($r) => "{$r['label']}={$r['rows']}", $results))
    . "\n";
@file_put_contents($logDir . '/cron_cleanup.log', $logLine, FILE_APPEND | LOCK_EX);
