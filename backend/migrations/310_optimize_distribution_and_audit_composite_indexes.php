<?php
/**
 * Migration 310: Bổ sung composite covering indexes để tối ưu hóa truy vấn
 * distribution_logs, audit_logs, notes, activities
 */

if (!isset($conn) || !($conn instanceof mysqli)) {
    if (isset($db) && ($db instanceof PDO)) {
        // PDO instance available
    } else {
        require_once __DIR__ . '/../db_connect.php';
    }
}

$addIndexSafe = function($tableName, $indexName, $columnsSql) use (&$conn, &$db, &$logMsg) {
    try {
        $exists = false;
        if (isset($conn) && $conn instanceof mysqli) {
            $check = $conn->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$tableName}' AND INDEX_NAME = '{$indexName}' LIMIT 1");
            if ($check && $check->num_rows > 0) {
                $exists = true;
            }
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$tableName}' AND INDEX_NAME = '{$indexName}' LIMIT 1");
            if ($stmt && $stmt->fetchColumn()) {
                $exists = true;
            }
        }

        if (!$exists) {
            $sql = "ALTER TABLE `{$tableName}` ADD INDEX `{$indexName}` ({$columnsSql})";
            if (isset($conn) && $conn instanceof mysqli) {
                $conn->query($sql);
            } elseif (isset($db) && $db instanceof PDO) {
                $db->exec($sql);
            }
            if (is_callable($logMsg)) {
                $logMsg("Đã tạo index {$indexName} trên bảng {$tableName}", "success");
            }
        } else {
            if (is_callable($logMsg)) {
                $logMsg("Index {$indexName} trên bảng {$tableName} đã tồn tại, bỏ qua.", "info");
            }
        }
    } catch (Throwable $e) {
        if (is_callable($logMsg)) {
            $logMsg("Lỗi khi thêm index {$indexName} trên bảng {$tableName}: " . $e->getMessage(), "error");
        }
    }
};

// 1. distribution_logs status & date grouping optimization (triệt tiêu Using filesort/temporary trong get_logs)
$addIndexSafe('distribution_logs', 'idx_dist_logs_perf_status_recv', '`status`, `received_at`, `lead_id`, `assigned_to`');

// 2. audit_logs stage change lookup optimization (tối ưu subquery closed_date trong ContactController)
$addIndexSafe('audit_logs', 'idx_audit_logs_res_act_created', '`resource`, `action`, `resource_id`, `created_at`');

// 3. notes entity fast lookup optimization (tối ưu subquery last_interaction)
$addIndexSafe('notes', 'idx_notes_perf_entity_id', '`tenant_id`, `entity_type`, `entity_id`, `id`');

// 4. activities related entity fast lookup optimization (tối ưu subquery timeline và badges)
$addIndexSafe('activities', 'idx_act_perf_related_del', '`tenant_id`, `deleted_at`, `related_type`, `related_id`, `id`');

// 5. leads covering index for fast latest reads (khắc phục DEF-PERF-01, tăng tốc đọc leads mới nhất)
$addIndexSafe('leads', 'idx_leads_perf_id_status', '`id`, `status`');

