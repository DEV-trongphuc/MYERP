<?php
/**
 * Migration 334: CAPI Phone Farm & Click-Fraud Blacklist Table (`capi_blocked_phones`)
 *
 * Stores normalized E.164 phone numbers (`84...`) from imported Phone Farm blacklists
 * (e.g. `L1ABC rac.xlsx`) so:
 *   1. CAPI Quality Gate automatically skips spamming Meta Pixel with fake farm leads.
 *   2. MetaPlaybookService syncs & attaches `MYERP - Loai Tru Phone Farm / Rac` cleanly.
 */

if (!isset($conn) && !isset($db)) {
    $configPath  = __DIR__ . '/../config.php';
    $dbClassPath = __DIR__ . '/../config/Database.php';
    if (file_exists($configPath) && file_exists($dbClassPath)) {
        require_once $configPath;
        require_once $dbClassPath;
        try {
            $dbInstance = Database::getInstance();
            $db = ($dbInstance instanceof PDO) ? $dbInstance : (method_exists($dbInstance, 'getConnection') ? $dbInstance->getConnection() : null);
        } catch (\Throwable $e) {
            if (php_sapi_name() === 'cli') {
                echo "[WARN] Local DB connection skipped in CLI (" . $e->getMessage() . ").\n";
                return;
            }
        }
    }
}

try {
    if (isset($db) && !($db instanceof PDO) && method_exists($db, 'getConnection')) {
        $db = $db->getConnection();
    }
    if (!($db instanceof PDO)) {
        if (isset($conn) && $conn instanceof mysqli) {
            require_once __DIR__ . '/../config.php';
            $db = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } else {
            return;
        }
    }
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $db->exec("
        CREATE TABLE IF NOT EXISTS `capi_blocked_phones` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `tenant_id` INT NOT NULL DEFAULT 1,
            `phone_normalized` VARCHAR(20) NOT NULL COMMENT 'Digits-only E.164 (e.g. 84943316797)',
            `source_label` VARCHAR(120) NOT NULL DEFAULT 'L1ABC_rac',
            `reason` VARCHAR(255) NOT NULL DEFAULT 'phone_farm_fraud',
            `created_by` INT DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `deleted_at` TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY `uk_tenant_phone` (`tenant_id`, `phone_normalized`),
            KEY `idx_capi_bp_tenant_del` (`tenant_id`, `deleted_at`, `source_label`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (\Throwable $e) {
    error_log('Migration 334 failed: ' . $e->getMessage());
}
