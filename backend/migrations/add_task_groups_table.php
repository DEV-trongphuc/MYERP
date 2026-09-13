<?php
/**
 * Migration 276: Tạo bảng task_groups và liên kết task_group_id trong activities
 * Hỗ trợ tính năng gom nhóm công việc cá nhân trên Bàn làm việc
 */

if (!isset($conn) || !($conn instanceof mysqli)) {
    if (isset($db) && ($db instanceof PDO)) {
        // PDO instance available
    } else {
        require_once __DIR__ . '/../db_connect.php';
    }
}

// 1. Tạo bảng task_groups
try {
    $createTableSql = "
        CREATE TABLE IF NOT EXISTS `task_groups` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `tenant_id` INT NOT NULL DEFAULT 1,
            `user_id` INT NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `color` VARCHAR(50) DEFAULT '#BD1D2D',
            `icon` VARCHAR(50) DEFAULT 'Folder',
            `order_index` INT DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_tg_tenant_user` (`tenant_id`, `user_id`, `order_index`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->query($createTableSql);
    } elseif (isset($db) && $db instanceof PDO) {
        $db->exec($createTableSql);
    }
    if (is_callable($logMsg)) {
        $logMsg("Bảng task_groups đã được tạo hoặc đã tồn tại sẵn.", "success");
    }
} catch (Throwable $e) {
    if (is_callable($logMsg)) {
        $logMsg("Lỗi khi tạo bảng task_groups: " . $e->getMessage(), "error");
    }
}

// 2. Thêm cột task_group_id vào bảng activities nếu chưa có
try {
    $colExists = false;
    if (isset($conn) && $conn instanceof mysqli) {
        $checkCol = $conn->query("SHOW COLUMNS FROM `activities` LIKE 'task_group_id'");
        if ($checkCol && $checkCol->num_rows > 0) {
            $colExists = true;
        }
    } elseif (isset($db) && $db instanceof PDO) {
        $stmt = $db->query("SHOW COLUMNS FROM `activities` LIKE 'task_group_id'");
        if ($stmt && $stmt->fetchColumn()) {
            $colExists = true;
        }
    }

    if (!$colExists) {
        $alterSql = "ALTER TABLE `activities` ADD COLUMN `task_group_id` INT NULL DEFAULT NULL AFTER `user_id`";
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($alterSql);
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($alterSql);
        }
        if (is_callable($logMsg)) {
            $logMsg("Đã thêm cột task_group_id vào bảng activities.", "success");
        }
    } else {
        if (is_callable($logMsg)) {
            $logMsg("Cột task_group_id đã tồn tại trong bảng activities, bỏ qua.", "info");
        }
    }
} catch (Throwable $e) {
    if (is_callable($logMsg)) {
        $logMsg("Lỗi khi thêm cột task_group_id vào bảng activities: " . $e->getMessage(), "error");
    }
}

// 3. Thêm index idx_act_task_group vào bảng activities
try {
    $idxExists = false;
    if (isset($conn) && $conn instanceof mysqli) {
        $checkIdx = $conn->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities' AND INDEX_NAME = 'idx_act_task_group' LIMIT 1");
        if ($checkIdx && $checkIdx->num_rows > 0) {
            $idxExists = true;
        }
    } elseif (isset($db) && $db instanceof PDO) {
        $stmtIdx = $db->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities' AND INDEX_NAME = 'idx_act_task_group' LIMIT 1");
        if ($stmtIdx && $stmtIdx->fetchColumn()) {
            $idxExists = true;
        }
    }

    if (!$idxExists) {
        $addIdxSql = "ALTER TABLE `activities` ADD INDEX `idx_act_task_group` (`tenant_id`, `task_group_id`)";
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($addIdxSql);
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($addIdxSql);
        }
        if (is_callable($logMsg)) {
            $logMsg("Đã tạo index idx_act_task_group trên bảng activities.", "success");
        }
    } else {
        if (is_callable($logMsg)) {
            $logMsg("Index idx_act_task_group đã tồn tại, bỏ qua.", "info");
        }
    }
} catch (Throwable $e) {
    if (is_callable($logMsg)) {
        $logMsg("Lỗi khi thêm index idx_act_task_group: " . $e->getMessage(), "error");
    }
}
