<?php
/**
 * Migration 311: Tạo bảng task_whiteboards và task_whiteboard_snapshots
 * Hỗ trợ tính năng Bảng trắng sơ đồ tư duy (Embedded Infinite Whiteboard Canvas) trong công việc
 */

if (!isset($conn) || !($conn instanceof mysqli)) {
    if (isset($db) && ($db instanceof PDO)) {
        // PDO instance available
    } else {
        require_once __DIR__ . '/../db_connect.php';
    }
}

$execSql = function($sql, $msg = '') use (&$conn, &$db, &$logMsg) {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($sql);
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($sql);
        }
        if (is_callable($logMsg) && $msg) {
            $logMsg($msg, "success");
        }
    } catch (Throwable $e) {
        if (is_callable($logMsg)) {
            $logMsg("Lỗi SQL Migration 311: " . $e->getMessage(), "error");
        }
    }
};

// 1. Tạo bảng task_whiteboards
$execSql("
CREATE TABLE IF NOT EXISTS `task_whiteboards` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL,
  `task_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL DEFAULT 'Bản vẽ sơ đồ',
  `canvas_data` LONGTEXT NOT NULL COMMENT 'JSON vector {viewport, nodes, edges, freehand, frames}',
  `thumbnail_url` VARCHAR(1000) NULL COMMENT 'Ảnh snapshot WebP đại diện (320x180)',
  `version` INT NOT NULL DEFAULT 1 COMMENT 'Optimistic concurrency version lock',
  `node_count` INT NOT NULL DEFAULT 0 COMMENT 'Số lượng đối tượng trên canvas',
  `last_edited_by` INT NOT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_twb_tenant_task` (`tenant_id`, `task_id`),
  INDEX `idx_twb_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
", "Đã tạo hoặc kiểm tra bảng task_whiteboards");

// 2. Tạo bảng task_whiteboard_snapshots
$execSql("
CREATE TABLE IF NOT EXISTS `task_whiteboard_snapshots` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `whiteboard_id` BIGINT NOT NULL,
  `task_id` INT NOT NULL,
  `snapshot_name` VARCHAR(255) NOT NULL DEFAULT 'Bản lưu tự động',
  `canvas_data` LONGTEXT NOT NULL,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_twb_snap` (`whiteboard_id`, `created_at`),
  INDEX `idx_twb_snap_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
", "Đã tạo hoặc kiểm tra bảng task_whiteboard_snapshots");
