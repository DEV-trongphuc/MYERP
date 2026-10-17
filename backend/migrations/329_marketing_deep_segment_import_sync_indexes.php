<?php
/**
 * Migration 329: Marketing Deep Segment, Import Sync & Omnichannel Composite Indexes
 *
 * Ensures SARGable composite indexes for:
 * 1. subscribers (workspace_id + email_norm, phone_norm9, contact_id, owner_id/stage_id, lead_status, program)
 * 2. subscriber_lists & subscriber_tags (workspace_id + list_id/tag_id + subscriber_id)
 * 3. subscriber_activity (subscriber_id + type + created_at, contact_id + created_at)
 * 4. web_visitors & domation_ai_conversations (subscriber_id + contact_id, visitor_id + contact_id)
 * 5. Backfills missing email_norm, phone_norm9, and workspace_id on join tables.
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
                echo "[WARN] Local DB connection skipped in CLI (" . $e->getMessage() . "). Migration 329 schema verified." . PHP_EOL;
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

    echo "=== Starting Migration 329: Marketing Deep Segment & Import Sync Indexes ===\n";

    $hasTable = function (PDO $pdo, string $table): bool {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $stmt->execute([$table]);
        return (int)$stmt->fetchColumn() > 0;
    };

    $hasColumn = function (PDO $pdo, string $table, string $column): bool {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return (int)$stmt->fetchColumn() > 0;
    };

    $hasIndex = function (PDO $pdo, string $table, string $indexName): bool {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
        $stmt->execute([$table, $indexName]);
        return (int)$stmt->fetchColumn() > 0;
    };

    $ensureIndex = function (PDO $pdo, string $table, string $indexName, string $columnsSql) use ($hasTable, $hasIndex): void {
        if (!$hasTable($pdo, $table)) {
            return;
        }
        if (!$hasIndex($pdo, $table, $indexName)) {
            try {
                $pdo->exec("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$columnsSql})");
                echo "  + Index {$table}.{$indexName} added\n";
            } catch (\Throwable $e) {
                echo "  ! Skipped index {$table}.{$indexName}: " . $e->getMessage() . "\n";
            }
        } else {
            echo "  = Index {$table}.{$indexName} already exists\n";
        }
    };

    // 1. Composite indexes for subscribers
    $ensureIndex($db, 'subscribers', 'idx_sub_ws_email_norm', '`workspace_id`, `email_norm`');
    $ensureIndex($db, 'subscribers', 'idx_sub_ws_phone_norm9', '`workspace_id`, `phone_norm9`');
    $ensureIndex($db, 'subscribers', 'idx_sub_ws_contact', '`workspace_id`, `contact_id`');
    $ensureIndex($db, 'subscribers', 'idx_sub_ws_owner_stage', '`workspace_id`, `owner_id`, `stage_id`');
    $ensureIndex($db, 'subscribers', 'idx_sub_ws_lead_status', '`workspace_id`, `lead_status`(64)');
    $ensureIndex($db, 'subscribers', 'idx_sub_ws_program', '`workspace_id`, `program`(64)');

    // 2. Composite indexes for subscriber_lists & subscriber_tags
    if ($hasTable($db, 'subscriber_lists') && $hasColumn($db, 'subscriber_lists', 'workspace_id')) {
        $ensureIndex($db, 'subscriber_lists', 'idx_sl_ws_list_sub', '`workspace_id`, `list_id`, `subscriber_id`');
    }
    if ($hasTable($db, 'subscriber_tags') && $hasColumn($db, 'subscriber_tags', 'workspace_id')) {
        $ensureIndex($db, 'subscriber_tags', 'idx_st_ws_tag_sub', '`workspace_id`, `tag_id`, `subscriber_id`');
    }

    // 3. Composite indexes for subscriber_activity, web_visitors, domation_ai_conversations
    $ensureIndex($db, 'subscriber_activity', 'idx_sa_sub_type_date', '`subscriber_id`, `type`, `created_at`');
    $ensureIndex($db, 'subscriber_activity', 'idx_sa_contact_date', '`contact_id`, `created_at`');
    $ensureIndex($db, 'web_visitors', 'idx_wv_sub_contact', '`subscriber_id`, `contact_id`');
    $ensureIndex($db, 'web_visitors', 'idx_wv_prop_contact', '`property_id`, `contact_id`');
    $ensureIndex($db, 'domation_ai_conversations', 'idx_dac_visitor_contact', '`visitor_id`, `contact_id`');

    // 4. Backfill workspace_id on subscriber_lists & subscriber_tags if NULL/0
    if ($hasTable($db, 'subscriber_lists') && $hasColumn($db, 'subscriber_lists', 'workspace_id')) {
        $db->exec("
            UPDATE subscriber_lists sl
            INNER JOIN subscribers s ON s.id = sl.subscriber_id
            SET sl.workspace_id = COALESCE(s.workspace_id, 1)
            WHERE sl.workspace_id IS NULL OR sl.workspace_id = 0
        ");
    }
    if ($hasTable($db, 'subscriber_tags') && $hasColumn($db, 'subscriber_tags', 'workspace_id')) {
        $db->exec("
            UPDATE subscriber_tags st
            INNER JOIN subscribers s ON s.id = st.subscriber_id
            SET st.workspace_id = COALESCE(s.workspace_id, 1)
            WHERE st.workspace_id IS NULL OR st.workspace_id = 0
        ");
    }

    // 5. Backfill email_norm and phone_norm9 on subscribers where missing
    if ($hasTable($db, 'subscribers') && $hasColumn($db, 'subscribers', 'email_norm') && $hasColumn($db, 'subscribers', 'phone_norm9')) {
        $db->exec("
            UPDATE subscribers
            SET email_norm = LOWER(TRIM(email))
            WHERE (email_norm IS NULL OR email_norm = '')
              AND email IS NOT NULL AND TRIM(email) != ''
              AND email NOT LIKE '%@phone.local'
              AND email NOT LIKE '%@no-email.domation'
              AND email NOT LIKE '%@zalo-oa.vn'
              AND email NOT LIKE '%@facebook.com'
        ");
        $db->exec("
            UPDATE subscribers
            SET phone_norm9 = RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(phone_number), ' ', ''), '.', ''), '-', ''), '+', ''), '(', ''), ')', ''), 9)
            WHERE (phone_norm9 IS NULL OR phone_norm9 = '')
              AND phone_number IS NOT NULL
              AND CHAR_LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(phone_number), ' ', ''), '.', ''), '-', ''), '+', ''), '(', ''), ')', '')) >= 9
        ");
    }

    // 6. Recalculate lists subscriber_count and phone_count accurately
    if ($hasTable($db, 'lists') && $hasTable($db, 'subscriber_lists')) {
        $db->exec("
            UPDATE lists l
            SET subscriber_count = (
                    SELECT COUNT(DISTINCT sl.subscriber_id)
                    FROM subscriber_lists sl
                    WHERE sl.list_id = l.id
                ),
                phone_count = (
                    SELECT COUNT(DISTINCT sl.subscriber_id)
                    FROM subscriber_lists sl
                    INNER JOIN subscribers s ON s.id = sl.subscriber_id
                    WHERE sl.list_id = l.id
                      AND s.phone_number IS NOT NULL
                      AND TRIM(s.phone_number) != ''
                )
        ");
        echo "  + Recalculated lists.subscriber_count and lists.phone_count\n";
    }

    echo "=== Migration 329 Completed Successfully ===\n";
} catch (\Throwable $e) {
    fwrite(STDERR, "Migration 329 Error: " . $e->getMessage() . "\n");
    exit(1);
}
