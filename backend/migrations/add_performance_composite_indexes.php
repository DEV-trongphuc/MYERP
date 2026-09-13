<?php
/**
 * Migration 275: Thêm composite covering indexes để tối ưu hóa cực mạnh truy vấn
 * Badges, Leads, Tasks, Approvals, PO, SO
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

// 1. Activities workspace & badge query optimization
$addIndexSafe('activities', 'idx_act_perf_workspace', '`tenant_id`, `deleted_at`, `status`, `type`');

// 2. Contacts pipeline & owner pagination optimization
$addIndexSafe('contacts', 'idx_contacts_perf_pipeline', '`tenant_id`, `deleted_at`, `lead_status`, `pipeline_status`');
$addIndexSafe('contacts', 'idx_contacts_perf_owner', '`tenant_id`, `owner_id`, `deleted_at`, `created_at`');
$addIndexSafe('contacts', 'idx_contacts_tenant_del_id', '`tenant_id`, `deleted_at`, `id`');

// 3. Expenses status filter optimization
$addIndexSafe('expenses', 'idx_exp_perf_status', '`tenant_id`, `deleted_at`, `status`');
