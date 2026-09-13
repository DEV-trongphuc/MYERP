<?php
/**
 * Migration 277: Thêm cột is_pinned và tối ưu chỉ mục sắp xếp cho bảng task_groups
 * Hỗ trợ ghim nhóm công việc (Pin Star ⭐) và sắp xếp thứ tự ưu tiên
 */

if (!isset($conn) || !($conn instanceof mysqli)) {
    if (isset($db) && ($db instanceof PDO)) {
        // PDO instance available
    } else {
        require_once __DIR__ . '/../db_connect.php';
    }
}

// 1. Thêm cột is_pinned vào bảng task_groups nếu chưa có
try {
    $colExists = false;
    if (isset($conn) && $conn instanceof mysqli) {
        $checkCol = $conn->query("SHOW COLUMNS FROM `task_groups` LIKE 'is_pinned'");
        if ($checkCol && $checkCol->num_rows > 0) {
            $colExists = true;
        }
    } elseif (isset($db) && $db instanceof PDO) {
        $stmt = $db->query("SHOW COLUMNS FROM `task_groups` LIKE 'is_pinned'");
        if ($stmt && $stmt->fetchColumn()) {
            $colExists = true;
        }
    }

    if (!$colExists) {
        $alterSql = "ALTER TABLE `task_groups` ADD COLUMN `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 AFTER `order_index`";
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($alterSql);
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($alterSql);
        }
        if (is_callable($logMsg)) {
            $logMsg("Đã thêm cột is_pinned vào bảng task_groups thành công.", "success");
        }
    } else {
        if (is_callable($logMsg)) {
            $logMsg("Cột is_pinned đã tồn tại trong bảng task_groups.", "info");
        }
    }
} catch (Throwable $e) {
    if (is_callable($logMsg)) {
        $logMsg("Lỗi khi thêm cột is_pinned: " . $e->getMessage(), "error");
    }
}

// 2. Thêm chỉ mục idx_tg_pin_order nếu chưa có
try {
    $idxExists = false;
    if (isset($conn) && $conn instanceof mysqli) {
        $checkIdx = $conn->query("SHOW INDEX FROM `task_groups` WHERE Key_name = 'idx_tg_pin_order'");
        if ($checkIdx && $checkIdx->num_rows > 0) {
            $idxExists = true;
        }
    } elseif (isset($db) && $db instanceof PDO) {
        $stmt = $db->query("SHOW INDEX FROM `task_groups` WHERE Key_name = 'idx_tg_pin_order'");
        if ($stmt && $stmt->fetch()) {
            $idxExists = true;
        }
    }

    if (!$idxExists) {
        $indexSql = "ALTER TABLE `task_groups` ADD INDEX `idx_tg_pin_order` (`tenant_id`, `user_id`, `is_pinned`, `order_index`)";
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($indexSql);
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($indexSql);
        }
        if (is_callable($logMsg)) {
            $logMsg("Đã tạo chỉ mục idx_tg_pin_order trên bảng task_groups.", "success");
        }
    }
} catch (Throwable $e) {
    if (is_callable($logMsg)) {
        $logMsg("Lỗi khi tạo chỉ mục idx_tg_pin_order: " . $e->getMessage(), "warning");
    }
}
