<?php
/**
 * Migration 325: DOMATION Omnichannel Performance Composite Indexes & Pre-Baked Schema
 * ====================================================================================
 * Idempotently adds composite B-Tree indexes across all DOMATION Marketing Automation
 * tables to eliminate full-table scans on large datasets (9,549+ contacts/subscribers,
 * 41+ flows, campaigns, delivery logs, web sessions/pageviews, surveys, vouchers, QR links)
 * and pre-bakes runtime self-healing schema columns so endpoints run with zero DDL lock overhead.
 */

if (!isset($conn) && !isset($db)) {
    $configPath    = __DIR__ . '/../config.php';
    $dbClassPath   = __DIR__ . '/../config/Database.php';
    $dbConnectPath = __DIR__ . '/../db_connect.php';
    if (file_exists($configPath) && file_exists($dbClassPath)) {
        require_once $configPath;
        require_once $dbClassPath;
        $db = Database::getInstance();
    } elseif (file_exists($dbConnectPath)) {
        require_once $dbConnectPath;
    }
}

$emitMigration325Log = function (string $msg, string $type = 'info') {
    if (isset($GLOBALS['logMsg']) && is_callable($GLOBALS['logMsg'])) {
        ($GLOBALS['logMsg'])($msg, $type);
    } elseif (php_sapi_name() === 'cli') {
        echo "[" . strtoupper($type) . "] " . $msg . PHP_EOL;
    }
};

$execSql325 = function (string $sql) use (&$conn, &$db, $emitMigration325Log): bool {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($sql);
            return true;
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($sql);
            return true;
        }
    } catch (\Throwable $e) {
        $errMsg = $e->getMessage();
        if (
            strpos($errMsg, 'already exists') === false &&
            strpos($errMsg, 'Duplicate') === false
        ) {
            $emitMigration325Log("SQL warning: " . $errMsg, 'info');
        }
    }
    return false;
};

$tableExists325 = function (string $table) use (&$conn, &$db): bool {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $tEsc = $conn->real_escape_string($table);
            $res  = $conn->query("SHOW TABLES LIKE '{$tEsc}'");
            return ($res && $res->num_rows > 0);
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->query("SHOW TABLES LIKE " . $db->quote($table));
            return ($stmt && (bool)$stmt->fetchColumn());
        }
    } catch (\Throwable $e) {
    }
    return false;
};

$columnExists325 = function (string $table, string $col) use (&$conn, &$db): bool {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $colEsc = $conn->real_escape_string($col);
            $res    = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE '{$colEsc}'");
            return ($res && $res->num_rows > 0);
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->query("SHOW COLUMNS FROM `{$table}` LIKE " . $db->quote($col));
            return ($stmt && (bool)$stmt->fetch(PDO::FETCH_ASSOC));
        }
    } catch (\Throwable $e) {
    }
    return false;
};

$ensureColumn325 = function (string $table, string $col, string $definition) use ($tableExists325, $columnExists325, $execSql325, $emitMigration325Log): void {
    if (!$tableExists325($table)) {
        return;
    }
    if (!$columnExists325($table, $col)) {
        if ($execSql325("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$definition}")) {
            $emitMigration325Log("Added column `{$col}` to `{$table}`.", 'success');
        }
    }
};

$ensureIndex325 = function (string $table, string $indexName, array $columns, string $customColsSql = '') use (&$conn, &$db, $tableExists325, $columnExists325, $execSql325, $emitMigration325Log): void {
    if (!$tableExists325($table)) {
        return;
    }
    foreach ($columns as $colName) {
        if (!$columnExists325($table, $colName)) {
            return;
        }
    }
    try {
        $exists = false;
        if (isset($conn) && $conn instanceof mysqli) {
            $idxEsc = $conn->real_escape_string($indexName);
            $res    = $conn->query("SHOW INDEX FROM `{$table}` WHERE Key_name = '{$idxEsc}'");
            $exists = ($res && $res->num_rows > 0);
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->prepare("SHOW INDEX FROM `{$table}` WHERE Key_name = ?");
            $stmt->execute([$indexName]);
            $exists = (bool)$stmt->fetch();
        }
        if (!$exists) {
            $colsSql = $customColsSql !== ''
                ? $customColsSql
                : implode(', ', array_map(fn($c) => "`{$c}`", $columns));
            if ($execSql325("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$colsSql})")) {
                $emitMigration325Log("Added index `{$indexName}` on `{$table}` ({$colsSql}).", 'success');
            }
        }
    } catch (\Throwable $e) {
    }
};

// ============================================================================
// 1. PRE-BAKE AUXILIARY TABLES & SELF-HEALING COLUMNS
// ============================================================================
$execSql325("
    CREATE TABLE IF NOT EXISTS `flow_snapshots` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `flow_id` VARCHAR(36) NOT NULL,
        `workspace_id` INT NOT NULL DEFAULT 1,
        `flow_name` VARCHAR(255) NOT NULL DEFAULT '',
        `snapshot_json` LONGTEXT NOT NULL,
        `step_count` INT NOT NULL DEFAULT 0,
        `saved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_flow_snap` (`flow_id`, `workspace_id`, `saved_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$execSql325("
    CREATE TABLE IF NOT EXISTS `segment_exclusions` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `workspace_id` INT DEFAULT 1,
        `segment_id` VARCHAR(50) NOT NULL,
        `subscriber_id` CHAR(36) NOT NULL,
        `excluded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY `unique_exclusion` (`workspace_id`, `segment_id`, `subscriber_id`),
        INDEX `idx_seg_exclusions_seg` (`workspace_id`, `segment_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$ensureColumn325('short_links', 'utm_source', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn325('short_links', 'utm_medium', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn325('short_links', 'utm_campaign', "VARCHAR(100) NULL DEFAULT NULL");

$ensureColumn325('web_sessions', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn325('web_page_views', 'is_entrance', "TINYINT(1) DEFAULT 0");

// ============================================================================
// 2. COMPOSITE PERFORMANCE INDEXES FOR DOMATION TABLES
// ============================================================================

// - subscribers
$ensureIndex325('subscribers', 'idx_sub_ws_status_created', ['workspace_id', 'status', 'created_at']);
$ensureIndex325('subscribers', 'idx_sub_contact_id', ['contact_id']);
$ensureIndex325('subscribers', 'idx_sub_email', ['email']);
$ensureIndex325('subscribers', 'idx_sub_phone', ['phone_number']);

// - subscriber_activity
$ensureIndex325('subscriber_activity', 'idx_sa_sub_created', ['subscriber_id', 'created_at']);
$ensureIndex325('subscriber_activity', 'idx_sa_contact_created', ['contact_id', 'created_at']);
$ensureIndex325('subscriber_activity', 'idx_sa_camp_type', ['campaign_id', 'type']);
$ensureIndex325('subscriber_activity', 'idx_sa_flow_type', ['flow_id', 'type']);

// - subscriber_flow_states
$ensureIndex325('subscriber_flow_states', 'idx_sfs_flow_status', ['flow_id', 'status']);
$ensureIndex325('subscriber_flow_states', 'idx_sfs_sub_flow', ['subscriber_id', 'flow_id']);
$ensureIndex325('subscriber_flow_states', 'idx_sfs_contact_status', ['contact_id', 'status']);

// - flows
$ensureIndex325('flows', 'idx_flows_ws_status_upd', ['workspace_id', 'status', 'updated_at']);

// - campaigns
$ensureIndex325('campaigns', 'idx_camp_ws_status_created', ['workspace_id', 'status', 'created_at']);

// - mail_delivery_logs
$ensureIndex325('mail_delivery_logs', 'idx_mdl_camp_status', ['campaign_id', 'status']);
$ensureIndex325('mail_delivery_logs', 'idx_mdl_sub_sent', ['subscriber_id', 'sent_at']);

// - web_visitors
$ensureIndex325('web_visitors', 'idx_wv_prop_last_visit', ['property_id', 'last_visit_at']);
$ensureIndex325('web_visitors', 'idx_wv_sub_id', ['subscriber_id']);
$ensureIndex325('web_visitors', 'idx_wv_contact_id', ['contact_id']);

// - web_sessions
$ensureIndex325('web_sessions', 'idx_ws_visitor_started', ['visitor_id', 'started_at']);
$ensureIndex325('web_sessions', 'idx_ws_contact_started', ['contact_id', 'started_at']);

// - web_page_views
$ensureIndex325('web_page_views', 'idx_wpv_session_loaded', ['session_id', 'loaded_at']);
$ensureIndex325('web_page_views', 'idx_wpv_visitor_loaded', ['visitor_id', 'loaded_at']);
$ensureIndex325('web_page_views', 'idx_entrance', ['property_id', 'is_entrance']);

// - survey_responses
$ensureIndex325('survey_responses', 'idx_sr_survey_sub', ['survey_id', 'submitted_at']);
$ensureIndex325('survey_responses', 'idx_sr_subscriber', ['subscriber_id']);
$ensureIndex325('survey_responses', 'idx_sr_contact', ['contact_id']);

// - voucher_codes
$ensureIndex325('voucher_codes', 'idx_vc_camp_status', ['campaign_id', 'status']);
$ensureIndex325('voucher_codes', 'idx_vc_subscriber', ['subscriber_id']);
$ensureIndex325('voucher_codes', 'idx_vc_contact', ['contact_id']);

// - link_clicks
$ensureIndex325('link_clicks', 'idx_lc_link_clicked', ['short_link_id', 'clicked_at']);

// - email_templates
$ensureIndex325('email_templates', 'idx_et_workspace', ['workspace_id', 'created_at'], '`workspace_id`, `created_at` DESC');
$ensureIndex325('email_templates', 'idx_et_ws_cat', ['workspace_id', 'category', 'created_at'], '`workspace_id`, `category`, `created_at` DESC');

$emitMigration325Log("Migration 325 (DOMATION Performance Composite Indexes) completed.", 'success');
