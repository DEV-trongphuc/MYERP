<?php
/**
 * Migration 312: Bổ sung composite covering indexes cho check_ins và expenses
 * Đồng thời dọn sạch triệt để các ký tự &nbsp; trong notifications một lần duy nhất
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

// 1. check_ins date range and user attendance query optimization
$addIndexSafe('check_ins', 'idx_checkins_perf_date_user', '`check_in_date`, `user_id`, `status`');

// 2. expenses composite covering index - Leftmost Prefix: tenant_id -> status -> date -> deleted_at
// Dropping legacy definition if needed to guarantee exact column ordering for dashboard range scans
try {
    $dropLegacy = "ALTER TABLE `expenses` DROP INDEX `idx_expenses_perf_tenant_status_date`";
    if (isset($conn) && $conn instanceof mysqli) {
        @$conn->query($dropLegacy);
    } elseif (isset($db) && $db instanceof PDO) {
        try { $db->exec($dropLegacy); } catch (Throwable $ignore) {}
    }
} catch (Throwable $e) {}

$addIndexSafe('expenses', 'idx_expenses_perf_tenant_status_date', '`tenant_id`, `status`, `date`, `deleted_at`');

// 3. One-time clean of legacy &nbsp; in notifications table
try {
    $cleanSql = "UPDATE notifications SET body = REPLACE(body, '&nbsp;', ' ') WHERE body LIKE '%&nbsp;%'";
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->query($cleanSql);
    } elseif (isset($db) && $db instanceof PDO) {
        $db->exec($cleanSql);
    }
    if (is_callable($logMsg)) {
        $logMsg("Đã dọn dẹp các ký tự &nbsp; trong notifications", "success");
    }
} catch (Throwable $e) {
    // silent
}
