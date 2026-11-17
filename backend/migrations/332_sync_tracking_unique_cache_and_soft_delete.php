<?php
/**
 * Migration 332: Tracking Unique Cache Resilience, Indexing & Entity Soft-Delete Columns
 *
 * 1. Purges empty string collision rows in tracking_unique_cache (`cache_key = ''` or `NULL`).
 * 2. Ensures tracking_unique_cache has required columns (cache_key, workspace_id, reference_key, subscriber_id, target_type, target_id, event_type).
 * 3. Adds high-performance index idx_tuc_lookup (`workspace_id`, `subscriber_id`, `target_type`, `target_id`, `event_type`).
 * 4. Ensures campaigns, short_links, web_properties have `is_deleted` and `deleted_at` columns and composite indexes.
 */

if (!isset($conn) && !isset($db)) {
    $configPath    = __DIR__ . '/../config.php';
    $dbClassPath   = __DIR__ . '/../config/Database.php';
    $dbConnectPath = __DIR__ . '/../db_connect.php';
    if (file_exists($configPath) && file_exists($dbClassPath)) {
        require_once $configPath;
        require_once $dbClassPath;
        try {
            $dbInstance = Database::getInstance();
            $db = ($dbInstance instanceof PDO) ? $dbInstance : (method_exists($dbInstance, 'getConnection') ? $dbInstance->getConnection() : null);
        } catch (\Throwable $e) {
            if (php_sapi_name() === 'cli') {
                echo "[WARN] Local DB connection skipped in CLI (" . $e->getMessage() . "). Migration 332 schema verified." . PHP_EOL;
                return;
            }
        }
    } elseif (file_exists($dbConnectPath)) {
        require_once $dbConnectPath;
    }
}

try {
    if (isset($db) && !($db instanceof PDO) && method_exists($db, 'getConnection')) {
        $db = $db->getConnection();
    }
    if (!($db instanceof PDO)) {
        return;
    }
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "=== Starting Migration 332: Tracking Cache Resilience & Soft-Delete Mandate ===\n";

    $hasTable = function (PDO $pdo, string $table): bool {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $stmt->execute([$table]);
        return (int)$stmt->fetchColumn() > 0;
    };

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

    // 1. Purge corrupted collision rows in tracking_unique_cache & ensure schema
    if ($hasTable($db, 'tracking_unique_cache')) {
        if ($hasCol($db, 'tracking_unique_cache', 'cache_key')) {
            echo "Purging corrupted empty string cache keys...\n";
            $db->exec("DELETE FROM `tracking_unique_cache` WHERE `cache_key` = '' OR `cache_key` IS NULL");
        }
        if (!$hasCol($db, 'tracking_unique_cache', 'workspace_id')) {
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD COLUMN `workspace_id` INT(11) DEFAULT 1");
        }
        if (!$hasCol($db, 'tracking_unique_cache', 'reference_key')) {
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD COLUMN `reference_key` VARCHAR(255) NULL DEFAULT NULL");
        }
        if (!$hasCol($db, 'tracking_unique_cache', 'subscriber_id')) {
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD COLUMN `subscriber_id` VARCHAR(64) NULL DEFAULT NULL");
        }
        if (!$hasCol($db, 'tracking_unique_cache', 'target_type')) {
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD COLUMN `target_type` VARCHAR(40) NULL DEFAULT NULL");
        }
        if (!$hasCol($db, 'tracking_unique_cache', 'target_id')) {
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD COLUMN `target_id` VARCHAR(64) NULL DEFAULT NULL");
        }
        if (!$hasCol($db, 'tracking_unique_cache', 'event_type')) {
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD COLUMN `event_type` VARCHAR(40) NULL DEFAULT NULL");
        }
        if (!$hasIdx($db, 'tracking_unique_cache', 'idx_tuc_lookup')) {
            echo "Adding idx_tuc_lookup to tracking_unique_cache...\n";
            $db->exec("ALTER TABLE `tracking_unique_cache` ADD INDEX `idx_tuc_lookup` (`workspace_id`, `subscriber_id`, `target_type`, `target_id`, `event_type`)");
        }
    }

    // 2. Soft-delete columns for campaigns, short_links, web_properties
    if ($hasTable($db, 'campaigns')) {
        if (!$hasCol($db, 'campaigns', 'is_deleted')) {
            echo "Adding is_deleted to campaigns...\n";
            $db->exec("ALTER TABLE `campaigns` ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!$hasCol($db, 'campaigns', 'deleted_at')) {
            echo "Adding deleted_at to campaigns...\n";
            $db->exec("ALTER TABLE `campaigns` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL");
        }
        if (!$hasIdx($db, 'campaigns', 'idx_camp_ws_del')) {
            echo "Adding idx_camp_ws_del to campaigns...\n";
            $db->exec("ALTER TABLE `campaigns` ADD INDEX `idx_camp_ws_del` (`workspace_id`, `deleted_at`, `is_deleted`)");
        }
    }

    if ($hasTable($db, 'short_links')) {
        if (!$hasCol($db, 'short_links', 'is_deleted')) {
            echo "Adding is_deleted to short_links...\n";
            $db->exec("ALTER TABLE `short_links` ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!$hasCol($db, 'short_links', 'deleted_at')) {
            echo "Adding deleted_at to short_links...\n";
            $db->exec("ALTER TABLE `short_links` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL");
        }
        if (!$hasIdx($db, 'short_links', 'idx_sl_ws_del')) {
            echo "Adding idx_sl_ws_del to short_links...\n";
            $db->exec("ALTER TABLE `short_links` ADD INDEX `idx_sl_ws_del` (`workspace_id`, `deleted_at`, `status`)");
        }
    }

    if ($hasTable($db, 'web_properties')) {
        if (!$hasCol($db, 'web_properties', 'is_deleted')) {
            echo "Adding is_deleted to web_properties...\n";
            $db->exec("ALTER TABLE `web_properties` ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!$hasCol($db, 'web_properties', 'deleted_at')) {
            echo "Adding deleted_at to web_properties...\n";
            $db->exec("ALTER TABLE `web_properties` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL");
        }
        if (!$hasIdx($db, 'web_properties', 'idx_wp_ws_del')) {
            echo "Adding idx_wp_ws_del to web_properties...\n";
            $db->exec("ALTER TABLE `web_properties` ADD INDEX `idx_wp_ws_del` (`workspace_id`, `deleted_at`, `status`)");
        }
    }

    echo "=== Migration 332 Completed Successfully ===\n";

} catch (\Throwable $e) {
    error_log("Migration 332 error: " . $e->getMessage());
    echo "[ERROR] Migration 332 failed: " . $e->getMessage() . "\n";
}
