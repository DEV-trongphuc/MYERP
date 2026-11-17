<?php
/**
 * Migration 333: Soft-Delete Mandate for mail_delivery_logs
 * Adds `deleted_at` TIMESTAMP NULL DEFAULT NULL to `mail_delivery_logs`
 * and creates index `idx_mdl_ws_del` on (workspace_id, deleted_at, id).
 */

if (!isset($conn) && !isset($db)) {
    $configPath    = __DIR__ . '/../config.php';
    $dbClassPath   = __DIR__ . '/../config/Database.php';
    if (file_exists($configPath) && file_exists($dbClassPath)) {
        require_once $configPath;
        require_once $dbClassPath;
        try {
            $dbInstance = Database::getInstance();
            $db = ($dbInstance instanceof PDO) ? $dbInstance : (method_exists($dbInstance, 'getConnection') ? $dbInstance->getConnection() : null);
        } catch (\Throwable $e) {}
    }
}

try {
    if (isset($db) && !($db instanceof PDO) && method_exists($db, 'getConnection')) {
        $db = $db->getConnection();
    }
    if (!($db instanceof PDO)) return;
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $hasCol = function (PDO $pdo, string $tbl, string $col): bool {
        $stmt = $pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1");
        $stmt->execute([$tbl, $col]);
        return (bool)$stmt->fetchColumn();
    };

    $hasIdx = function (PDO $pdo, string $tbl, string $idx): bool {
        $stmt = $pdo->prepare("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1");
        $stmt->execute([$tbl, $idx]);
        return (bool)$stmt->fetchColumn();
    };

    if (!$hasCol($db, 'mail_delivery_logs', 'deleted_at')) {
        $db->exec("ALTER TABLE `mail_delivery_logs` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `sent_at`");
    }

    if (!$hasIdx($db, 'mail_delivery_logs', 'idx_mdl_ws_del')) {
        $db->exec("ALTER TABLE `mail_delivery_logs` ADD INDEX `idx_mdl_ws_del` (`workspace_id`, `deleted_at`, `id`)");
    }
} catch (\Throwable $e) {
    error_log("Migration 333 failed: " . $e->getMessage());
}
