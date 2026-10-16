<?php
/**
 * Migration 324: Integrate DOMATION Marketing Automation Schema & Match-Only Identity Sync
 * ========================================================================================
 * 1. Creates all DOMATION Marketing Automation tables (`CREATE TABLE IF NOT EXISTS`)
 *    with the 7 collision resolutions:
 *      - `users`: Keep `MYERP.users` untouched.
 *      - `system_settings` -> `mkt_system_settings`
 *      - `tags` -> `domation_tags`
 *      - `ai_conversations` -> `domation_ai_conversations`
 *      - `ai_messages` -> `domation_ai_messages`
 *      - `ai_training_docs` -> `domation_ai_training_docs`
 *      - `ai_training_chunks` -> `domation_ai_training_chunks`
 * 2. Ensures all compatibility columns & composite indexes exist on `subscribers`,
 *    `subscriber_activity`, `subscriber_flow_states`, `web_visitors`, `survey_responses`,
 *    `voucher_campaigns`, `voucher_codes`, `voucher_claims`, `zalo_subscribers`,
 *    `meta_subscribers`, `meta_conversations`, `domation_ai_conversations`, `forms`, `segments`.
 * 3. Idempotently adds the 17 denormalized fast-read omnichannel columns on `MYERP.contacts`.
 * 4. Runs `DomationContactMatcher::runBulkMatchAndRefresh()` enforcing the strict "3 KHÔNG"
 *    mandate (Match-Only: never create new `contacts` rows, never change `owner_id`/`stage`/`updated_at`,
 *    never create `notifications` rows).
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

$emitMigration324Log = function (string $msg, string $type = 'info') {
    if (isset($GLOBALS['logMsg']) && is_callable($GLOBALS['logMsg'])) {
        ($GLOBALS['logMsg'])($msg, $type);
    } elseif (php_sapi_name() === 'cli') {
        echo "[" . strtoupper($type) . "] " . $msg . PHP_EOL;
    }
};

$execSql324 = function (string $sql) use (&$conn, &$db, $emitMigration324Log): bool {
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
            $emitMigration324Log("SQL warning: " . $errMsg, 'info');
        }
    }
    return false;
};

$tableExists324 = function (string $table) use (&$conn, &$db): bool {
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

$getColumnType324 = function (string $table, string $col) use (&$conn, &$db): ?string {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $colEsc = $conn->real_escape_string($col);
            $res    = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE '{$colEsc}'");
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                return strtolower((string)($row['Type'] ?? 'varchar'));
            }
            return null;
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->query("SHOW COLUMNS FROM `{$table}` LIKE " . $db->quote($col));
            if ($stmt && ($row = $stmt->fetch(PDO::FETCH_ASSOC))) {
                return strtolower((string)($row['Type'] ?? 'varchar'));
            }
            return null;
        }
    } catch (\Throwable $e) {
    }
    return null;
};

$ensureColumn324 = function (string $table, string $col, string $definition) use ($tableExists324, $getColumnType324, $execSql324, $emitMigration324Log): void {
    if (!$tableExists324($table)) {
        return;
    }
    if ($getColumnType324($table, $col) === null) {
        if ($execSql324("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$definition}")) {
            $emitMigration324Log("Added column `{$col}` to `{$table}`.", 'success');
        }
    }
};

$ensureIndex324 = function (string $table, string $indexName, string $colsSql) use (&$conn, &$db, $tableExists324, $execSql324, $emitMigration324Log): void {
    if (!$tableExists324($table)) {
        return;
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
            if ($execSql324("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$colsSql})")) {
                $emitMigration324Log("Added index `{$indexName}` on `{$table}` ({$colsSql}).", 'success');
            }
        }
    } catch (\Throwable $e) {
    }
};

// ============================================================================
// 1. CREATE ALL DOMATION TABLES (WITH 7 COLLISION RESOLUTIONS)
// ============================================================================
$domationDdlStatements = [
    // Workspaces & Workspace Users
    'workspaces' => "
        CREATE TABLE IF NOT EXISTS `workspaces` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `name` VARCHAR(255) NOT NULL,
            `description` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'workspace_users' => "
        CREATE TABLE IF NOT EXISTS `workspace_users` (
            `workspace_id` INT(11) NOT NULL,
            `user_id` INT(11) NOT NULL,
            `role` VARCHAR(50) DEFAULT 'member',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`workspace_id`, `user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Collision #2: system_settings -> mkt_system_settings
    'mkt_system_settings' => "
        CREATE TABLE IF NOT EXISTS `mkt_system_settings` (
            `workspace_id` INT NOT NULL DEFAULT 1,
            `key` VARCHAR(100) NOT NULL,
            `value` LONGTEXT NULL,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`workspace_id`, `key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Collision #3: tags -> domation_tags
    'domation_tags' => "
        CREATE TABLE IF NOT EXISTS `domation_tags` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT DEFAULT 1,
            `name` VARCHAR(100) DEFAULT NULL,
            `color` VARCHAR(30) DEFAULT NULL,
            `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
            `description` TEXT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_domation_tags_ws_name` (`workspace_id`, `name`),
            KEY `idx_domation_tags_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Subscribers & Audience
    'subscribers' => "
        CREATE TABLE IF NOT EXISTS `subscribers` (
            `id` CHAR(36) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `person_id` CHAR(36) NULL DEFAULT NULL,
            `phone_norm9` VARCHAR(15) NULL DEFAULT NULL,
            `email_norm` VARCHAR(191) NULL DEFAULT NULL,
            `email` VARCHAR(191) NOT NULL,
            `first_name` VARCHAR(100) NULL DEFAULT NULL,
            `last_name` VARCHAR(100) NULL DEFAULT NULL,
            `gender` VARCHAR(20) NULL DEFAULT NULL,
            `status` VARCHAR(50) NULL DEFAULT 'active',
            `source` VARCHAR(100) NULL DEFAULT 'Manual',
            `salesperson` VARCHAR(255) NULL DEFAULT NULL,
            `phone_number` VARCHAR(50) NULL DEFAULT NULL,
            `phone` VARCHAR(20) NULL DEFAULT NULL,
            `job_title` VARCHAR(100) NULL DEFAULT NULL,
            `company_name` VARCHAR(100) NULL DEFAULT NULL,
            `country` VARCHAR(100) NULL DEFAULT NULL,
            `city` VARCHAR(100) NULL DEFAULT NULL,
            `timezone` VARCHAR(50) NULL DEFAULT NULL,
            `address` TEXT NULL,
            `date_of_birth` DATE NULL DEFAULT NULL,
            `anniversary_date` DATE NULL DEFAULT NULL,
            `notes` LONGTEXT NULL,
            `last_activity_at` DATETIME NULL DEFAULT NULL,
            `tags` LONGTEXT NULL,
            `custom_attributes` LONGTEXT NULL,
            `stats_sent` INT(11) NULL DEFAULT 0,
            `stats_opened` INT(11) NULL DEFAULT 0,
            `stats_clicked` INT(11) NULL DEFAULT 0,
            `last_open_at` DATETIME NULL DEFAULT NULL,
            `last_click_at` DATETIME NULL DEFAULT NULL,
            `joined_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `zalo_user_id` VARCHAR(100) NULL DEFAULT NULL,
            `is_zalo_follower` TINYINT(1) NULL DEFAULT 0,
            `meta_psid` VARCHAR(100) NULL DEFAULT NULL,
            `lead_score` INT(11) NULL DEFAULT 0,
            `verified` TINYINT(1) NULL DEFAULT 0,
            `avatar` VARCHAR(500) NULL DEFAULT NULL,
            `last_os` VARCHAR(50) NULL DEFAULT NULL,
            `last_device` VARCHAR(50) NULL DEFAULT NULL,
            `last_browser` VARCHAR(50) NULL DEFAULT NULL,
            `last_city` VARCHAR(100) NULL DEFAULT NULL,
            `last_country` VARCHAR(100) NULL DEFAULT NULL,
            `property_id` CHAR(36) NULL DEFAULT NULL,
            `last_ip` VARCHAR(64) NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sub_contact_id` (`contact_id`),
            KEY `idx_sub_phone_norm9` (`phone_norm9`),
            KEY `idx_sub_email_norm` (`email_norm`),
            KEY `idx_sub_ws_status_id` (`workspace_id`, `status`, `id`),
            KEY `idx_sub_ws_email` (`workspace_id`, `email`),
            KEY `idx_sub_phone` (`phone_number`),
            KEY `idx_sub_zalo` (`zalo_user_id`),
            KEY `idx_sub_meta` (`meta_psid`),
            KEY `idx_sub_lead_score` (`lead_score`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'subscriber_activity' => "
        CREATE TABLE IF NOT EXISTS `subscriber_activity` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `contact_id` INT NULL DEFAULT NULL,
            `subscriber_id` CHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL,
            `reference_id` CHAR(36) NULL DEFAULT NULL,
            `step_id` VARCHAR(100) NULL DEFAULT NULL,
            `flow_id` VARCHAR(100) NULL DEFAULT NULL,
            `campaign_id` VARCHAR(100) NULL DEFAULT NULL,
            `reminder_id` CHAR(36) NULL DEFAULT NULL,
            `reference_name` VARCHAR(255) NULL DEFAULT NULL,
            `details` TEXT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `ip_address` VARCHAR(45) NULL DEFAULT NULL,
            `user_agent` TEXT NULL,
            `device_type` VARCHAR(50) NULL DEFAULT 'desktop',
            `os` VARCHAR(50) NULL DEFAULT NULL,
            `browser` VARCHAR(50) NULL DEFAULT NULL,
            `location` VARCHAR(255) NULL DEFAULT NULL,
            `points_awarded` INT(11) NULL DEFAULT 0,
            `variation` VARCHAR(10) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_sa_contact_created` (`contact_id`, `created_at`),
            KEY `idx_act_ws_flow_type` (`workspace_id`, `flow_id`, `type`, `created_at`),
            KEY `idx_act_ws_camp_type` (`workspace_id`, `campaign_id`, `type`, `created_at`),
            KEY `idx_act_ws_sub_type` (`workspace_id`, `subscriber_id`, `type`, `created_at`),
            KEY `idx_spam_debounce` (`subscriber_id`, `type`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'subscriber_flow_states' => "
        CREATE TABLE IF NOT EXISTS `subscriber_flow_states` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `contact_id` INT NULL DEFAULT NULL,
            `subscriber_id` CHAR(36) NOT NULL,
            `flow_id` CHAR(36) NOT NULL,
            `step_id` CHAR(36) NOT NULL,
            `step_type` VARCHAR(50) NULL DEFAULT NULL,
            `status` ENUM('waiting','processing','completed','failed','unsubscribed','cancelled') NULL DEFAULT 'waiting',
            `scheduled_at` DATETIME NOT NULL,
            `waiting_until` DATETIME NULL DEFAULT NULL,
            `branch_taken` VARCHAR(50) NULL DEFAULT NULL,
            `last_error` TEXT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `last_step_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`workspace_id`, `flow_id`, `subscriber_id`),
            KEY `idx_sfs_id` (`id`),
            KEY `idx_sfs_contact_status` (`contact_id`, `status`),
            KEY `idx_sfs_ws_status_sched` (`workspace_id`, `status`, `scheduled_at`),
            KEY `idx_sfs_ws_sub` (`workspace_id`, `subscriber_id`),
            KEY `idx_flow_status_step` (`flow_id`, `status`, `step_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'flows' => "
        CREATE TABLE IF NOT EXISTS `flows` (
            `id` CHAR(36) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `description` TEXT NULL,
            `status` ENUM('active','paused','draft','archived') NULL DEFAULT 'draft',
            `steps` LONGTEXT NULL,
            `config` LONGTEXT NULL,
            `stat_enrolled` INT(11) NULL DEFAULT 0,
            `stat_completed` INT(11) NULL DEFAULT 0,
            `stat_open_rate` FLOAT NULL DEFAULT 0,
            `stat_click_rate` FLOAT NULL DEFAULT 0,
            `stat_total_sent` INT(11) NULL DEFAULT 0,
            `stat_total_opened` INT(11) NULL DEFAULT 0,
            `stat_unique_opened` INT(11) NULL DEFAULT 0,
            `stat_total_clicked` INT(11) NULL DEFAULT 0,
            `stat_unique_clicked` INT(11) NULL DEFAULT 0,
            `stat_total_zalo_clicked` INT(11) NOT NULL DEFAULT 0,
            `stat_unique_zalo_clicked` INT(11) NOT NULL DEFAULT 0,
            `stat_total_failed` INT(11) NULL DEFAULT 0,
            `stat_total_unsubscribed` INT(11) NULL DEFAULT 0,
            `archived_at` DATETIME NULL DEFAULT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `stat_zns_sent` INT(11) NULL DEFAULT 0,
            `stat_zns_failed` INT(11) NULL DEFAULT 0,
            `trigger_type` VARCHAR(50) NULL DEFAULT NULL,
            `stat_zalo_sent` INT(11) NOT NULL DEFAULT 0,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `stat_meta_sent` INT(11) NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`),
            KEY `idx_flows_ws_status` (`workspace_id`, `status`),
            KEY `idx_flows_trigger` (`trigger_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'flow_snapshots' => "
        CREATE TABLE IF NOT EXISTS `flow_snapshots` (
            `id` VARCHAR(36) NOT NULL,
            `flow_id` VARCHAR(255) NOT NULL,
            `label` VARCHAR(500) NOT NULL,
            `flow_data` LONGTEXT NOT NULL,
            `created_by` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_fs_flow_id` (`flow_id`),
            KEY `idx_fs_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'flow_enrollments' => "
        CREATE TABLE IF NOT EXISTS `flow_enrollments` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `flow_id` CHAR(36) NOT NULL,
            `subscriber_id` CHAR(36) NOT NULL,
            `enrolled_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_flow_sub` (`flow_id`, `subscriber_id`),
            KEY `idx_fe_ws_flow` (`workspace_id`, `flow_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'flow_event_queue' => "
        CREATE TABLE IF NOT EXISTS `flow_event_queue` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `subscriber_id` CHAR(36) NOT NULL,
            `event_type` VARCHAR(50) NOT NULL,
            `payload` LONGTEXT NULL,
            `status` ENUM('pending','processing','done','failed') DEFAULT 'pending',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_feq_status_created` (`status`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Campaigns, Templates & Email Delivery
    'campaigns' => "
        CREATE TABLE IF NOT EXISTS `campaigns` (
            `id` CHAR(36) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `subject` VARCHAR(255) NULL DEFAULT NULL,
            `preheader_text` VARCHAR(255) NULL DEFAULT NULL,
            `sender_email` VARCHAR(191) NULL DEFAULT NULL,
            `sender_name` VARCHAR(255) NULL DEFAULT NULL,
            `reply_to` VARCHAR(191) NULL DEFAULT NULL,
            `status` ENUM('draft','scheduled','sending','sent','archived','waiting_flow','paused') NULL DEFAULT 'draft',
            `type` ENUM('regular','email','zalo_zns','ab_testing','autoresponder') NULL DEFAULT 'email',
            `config` LONGTEXT NULL,
            `template_id` CHAR(36) NULL DEFAULT NULL,
            `content_body` LONGTEXT NULL,
            `target_config` LONGTEXT NULL,
            `scheduled_at` DATETIME NULL DEFAULT NULL,
            `timezone` VARCHAR(50) NULL DEFAULT 'UTC',
            `sent_at` DATETIME NULL DEFAULT NULL,
            `tracking_enabled` TINYINT(1) NULL DEFAULT 1,
            `count_sent` INT(11) NULL DEFAULT 0,
            `count_opened` INT(11) NULL DEFAULT 0,
            `count_unique_opened` INT(11) NULL DEFAULT 0,
            `count_clicked` INT(11) NULL DEFAULT 0,
            `count_unique_clicked` INT(11) NULL DEFAULT 0,
            `count_bounced` INT(11) NULL DEFAULT 0,
            `count_spam` INT(11) NULL DEFAULT 0,
            `count_unsubscribed` INT(11) NULL DEFAULT 0,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `is_deleted` TINYINT(1) NULL DEFAULT 0,
            `attachments` LONGTEXT NULL,
            `total_target_audience` INT(11) NULL DEFAULT 0,
            `stat_opens` INT(11) NULL DEFAULT 0,
            `stat_clicks` INT(11) NULL DEFAULT 0,
            `stat_device_mobile` INT(11) NULL DEFAULT 0,
            `stat_device_desktop` INT(11) NULL DEFAULT 0,
            `stats` LONGTEXT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_camp_ws_status` (`workspace_id`, `status`),
            KEY `idx_camp_scheduled` (`scheduled_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'campaign_reminders' => "
        CREATE TABLE IF NOT EXISTS `campaign_reminders` (
            `id` CHAR(36) NOT NULL,
            `campaign_id` CHAR(36) NOT NULL,
            `type` ENUM('no_open','no_click','always') NULL DEFAULT NULL,
            `trigger_mode` ENUM('delay','date') NULL DEFAULT NULL,
            `delay_days` INT(11) NULL DEFAULT 0,
            `delay_hours` INT(11) NULL DEFAULT 0,
            `scheduled_at` DATETIME NULL DEFAULT NULL,
            `subject` VARCHAR(255) NULL DEFAULT NULL,
            `template_id` CHAR(36) NULL DEFAULT NULL,
            `sender_email` VARCHAR(191) NULL DEFAULT NULL,
            `sender_name` VARCHAR(255) NULL DEFAULT NULL,
            `html_content` MEDIUMTEXT NULL,
            `config` LONGTEXT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_cr_campaign` (`campaign_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'templates' => "
        CREATE TABLE IF NOT EXISTS `templates` (
            `id` CHAR(36) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `thumbnail` VARCHAR(500) NULL DEFAULT NULL,
            `category` VARCHAR(50) NULL DEFAULT 'promotional',
            `group_id` CHAR(36) NULL DEFAULT NULL,
            `blocks` LONGTEXT NULL,
            `body_style` LONGTEXT NULL,
            `html_content` LONGTEXT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `type` VARCHAR(255) NULL DEFAULT NULL,
            `subject` VARCHAR(255) NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_tpl_ws_type` (`workspace_id`, `type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'template_groups' => "
        CREATE TABLE IF NOT EXISTS `template_groups` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` VARCHAR(36) NULL DEFAULT '1',
            `name` VARCHAR(255) NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'email_sections' => "
        CREATE TABLE IF NOT EXISTS `email_sections` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `data_json` LONGTEXT NOT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_es_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'mail_delivery_logs' => "
        CREATE TABLE IF NOT EXISTS `mail_delivery_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `recipient` VARCHAR(191) NULL DEFAULT NULL,
            `subject` VARCHAR(255) NULL DEFAULT NULL,
            `campaign_id` CHAR(36) NULL DEFAULT NULL,
            `flow_id` CHAR(36) NULL DEFAULT NULL,
            `reminder_id` CHAR(36) NULL DEFAULT NULL,
            `status` ENUM('success','failed') NULL DEFAULT NULL,
            `error_message` TEXT NULL,
            `sent_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `subscriber_id` CHAR(36) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_mdl_recipient` (`recipient`),
            KEY `idx_mdl_campaign` (`campaign_id`),
            KEY `idx_mdl_flow` (`flow_id`),
            KEY `idx_mdl_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Lists, Segments, Tags & Forms
    'lists' => "
        CREATE TABLE IF NOT EXISTS `lists` (
            `id` CHAR(36) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `source` VARCHAR(100) NULL DEFAULT 'Manual',
            `type` ENUM('static','sync') NULL DEFAULT 'static',
            `subscriber_count` INT(11) NULL DEFAULT 0,
            `phone_count` INT(11) NULL DEFAULT 0,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_lists_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'subscriber_lists' => "
        CREATE TABLE IF NOT EXISTS `subscriber_lists` (
            `subscriber_id` CHAR(36) NOT NULL,
            `list_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            PRIMARY KEY (`workspace_id`, `list_id`, `subscriber_id`),
            KEY `idx_sub_lists_ws_sub` (`workspace_id`, `subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'subscriber_tags' => "
        CREATE TABLE IF NOT EXISTS `subscriber_tags` (
            `subscriber_id` CHAR(36) NOT NULL,
            `tag_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            PRIMARY KEY (`workspace_id`, `tag_id`, `subscriber_id`),
            KEY `idx_sub_tags_ws_sub` (`workspace_id`, `subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'subscriber_notes' => "
        CREATE TABLE IF NOT EXISTS `subscriber_notes` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `subscriber_id` CHAR(36) NOT NULL,
            `author_name` VARCHAR(100) NULL DEFAULT 'Admin',
            `content` TEXT NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sn_subscriber` (`subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'segments' => "
        CREATE TABLE IF NOT EXISTS `segments` (
            `id` CHAR(36) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `description` MEDIUMTEXT NULL,
            `criteria` LONGTEXT NULL,
            `subscriber_count` INT(11) NULL DEFAULT 0,
            `phone_count` INT(11) NULL DEFAULT 0,
            `auto_cleanup_days` INT(11) NULL DEFAULT 0,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `ai_analysis` LONGTEXT NULL,
            `ai_analysis_at` TIMESTAMP NULL DEFAULT NULL,
            `synced_at` TIMESTAMP NULL DEFAULT NULL,
            `notify_on_join` TINYINT(1) NULL DEFAULT 0,
            `notify_subject` VARCHAR(255) NULL DEFAULT NULL,
            `notify_email` VARCHAR(255) NULL DEFAULT NULL,
            `notify_cc` VARCHAR(255) NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_segments_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'segment_exclusions' => "
        CREATE TABLE IF NOT EXISTS `segment_exclusions` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `segment_id` VARCHAR(50) NOT NULL,
            `subscriber_id` CHAR(36) NOT NULL,
            `excluded_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_se_ws_seg_sub` (`workspace_id`, `segment_id`, `subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'segment_count_update_queue' => "
        CREATE TABLE IF NOT EXISTS `segment_count_update_queue` (
            `segment_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `queued_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`segment_id`),
            KEY `idx_scuq_ws_seg` (`workspace_id`, `segment_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'forms' => "
        CREATE TABLE IF NOT EXISTS `forms` (
            `id` CHAR(36) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
            `target_list_id` CHAR(36) NULL DEFAULT NULL,
            `fields_json` LONGTEXT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `notification_enabled` TINYINT(1) NULL DEFAULT 0,
            `notification_emails` TEXT NULL,
            `notification_cc_emails` TEXT NULL,
            `notification_subject` VARCHAR(255) NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_forms_status` (`status`),
            KEY `idx_forms_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Surveys
    'surveys' => "
        CREATE TABLE IF NOT EXISTS `surveys` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `slug` VARCHAR(128) NOT NULL,
            `status` ENUM('draft','active','paused','closed') NULL DEFAULT 'draft',
            `cover_style` LONGTEXT NULL,
            `blocks_json` LONGTEXT NULL,
            `settings_json` LONGTEXT NULL,
            `thank_you_page` LONGTEXT NULL,
            `target_list_id` CHAR(36) NULL DEFAULT NULL,
            `flow_trigger_id` CHAR(36) NULL DEFAULT NULL,
            `response_limit` INT(11) NULL DEFAULT NULL,
            `close_at` DATETIME NULL DEFAULT NULL,
            `require_login` TINYINT(1) NULL DEFAULT 0,
            `allow_anonymous` TINYINT(1) NULL DEFAULT 1,
            `one_per_email` TINYINT(1) NULL DEFAULT 0,
            `created_by` CHAR(36) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_surveys_slug` (`slug`),
            KEY `idx_surveys_ws_status` (`workspace_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'survey_questions' => "
        CREATE TABLE IF NOT EXISTS `survey_questions` (
            `id` CHAR(36) NOT NULL,
            `survey_id` CHAR(36) NOT NULL,
            `block_id` CHAR(36) NOT NULL,
            `type` VARCHAR(64) NOT NULL,
            `label` TEXT NOT NULL,
            `options_json` LONGTEXT NULL,
            `required` TINYINT(1) NULL DEFAULT 0,
            `order_index` INT(11) NULL DEFAULT 0,
            `target_attribute` VARCHAR(100) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_sq_survey` (`survey_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'survey_responses' => "
        CREATE TABLE IF NOT EXISTS `survey_responses` (
            `id` CHAR(36) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `survey_id` CHAR(36) NOT NULL,
            `subscriber_id` CHAR(36) NULL DEFAULT NULL,
            `session_token` CHAR(64) NOT NULL,
            `answers_json` LONGTEXT NOT NULL,
            `completion_rate` TINYINT(3) NULL DEFAULT 100,
            `time_spent_sec` INT(11) NULL DEFAULT NULL,
            `claimed_voucher_code` VARCHAR(50) NULL DEFAULT NULL,
            `voucher_code` VARCHAR(100) NULL DEFAULT NULL,
            `source_channel` ENUM('direct_link','qr_code','email_embed','widget','api') NULL DEFAULT 'direct_link',
            `utm_source` VARCHAR(255) NULL DEFAULT NULL,
            `utm_medium` VARCHAR(255) NULL DEFAULT NULL,
            `utm_campaign` VARCHAR(255) NULL DEFAULT NULL,
            `ip_hash` CHAR(64) NULL DEFAULT NULL,
            `user_agent` VARCHAR(512) NULL DEFAULT NULL,
            `device_type` ENUM('desktop','tablet','mobile','unknown') NULL DEFAULT 'unknown',
            `referrer_url` VARCHAR(1024) NULL DEFAULT NULL,
            `geo_country` VARCHAR(64) NULL DEFAULT NULL,
            `geo_city` VARCHAR(128) NULL DEFAULT NULL,
            `score` INT DEFAULT 0,
            `total_score` FLOAT NULL DEFAULT NULL,
            `max_score` INT DEFAULT 0,
            `end_screen_id` VARCHAR(100) NULL DEFAULT 'default',
            `submitted_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_sr_session_token` (`session_token`),
            KEY `idx_sr_contact` (`contact_id`),
            KEY `idx_sr_survey` (`survey_id`),
            KEY `idx_sr_subscriber` (`subscriber_id`),
            KEY `idx_sr_submitted_at` (`submitted_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'survey_answer_details' => "
        CREATE TABLE IF NOT EXISTS `survey_answer_details` (
            `id` CHAR(36) NOT NULL,
            `response_id` CHAR(36) NOT NULL,
            `survey_id` CHAR(36) NOT NULL,
            `question_id` CHAR(36) NOT NULL,
            `answer_text` TEXT NULL,
            `answer_num` DECIMAL(10,2) NULL DEFAULT NULL,
            `answer_json` LONGTEXT NULL,
            `submitted_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sad_response` (`response_id`),
            KEY `idx_sad_survey` (`survey_id`),
            KEY `idx_sad_question` (`question_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Vouchers, Short Links & OTP
    'voucher_campaigns' => "
        CREATE TABLE IF NOT EXISTS `voucher_campaigns` (
            `id` VARCHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `description` TEXT NULL,
            `thumbnail_url` VARCHAR(500) NULL DEFAULT NULL,
            `rewards` LONGTEXT NULL,
            `code_type` ENUM('dynamic','static') NULL DEFAULT 'dynamic',
            `static_code` VARCHAR(100) NULL DEFAULT NULL,
            `start_date` DATETIME NULL DEFAULT NULL,
            `end_date` DATETIME NULL DEFAULT NULL,
            `status` ENUM('draft','active','expired') NULL DEFAULT 'draft',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `expiration_days` INT NULL DEFAULT NULL,
            `is_claimable` TINYINT(1) DEFAULT 0,
            `claim_approval_required` TINYINT(1) DEFAULT 0,
            `claim_approval_type` VARCHAR(20) NULL DEFAULT 'auto',
            `claim_email_template_id` VARCHAR(100) NULL DEFAULT NULL,
            `claim_target_form_id` VARCHAR(100) NULL DEFAULT NULL,
            `flow_trigger_id` VARCHAR(36) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_vcamp_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'voucher_codes' => "
        CREATE TABLE IF NOT EXISTS `voucher_codes` (
            `id` VARCHAR(36) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `campaign_id` VARCHAR(36) NOT NULL,
            `code` VARCHAR(100) NOT NULL,
            `reward_item_id` VARCHAR(100) NULL DEFAULT NULL,
            `subscriber_id` VARCHAR(100) NULL DEFAULT NULL,
            `status` ENUM('unused','used') NULL DEFAULT 'unused',
            `sent_at` DATETIME NULL DEFAULT NULL,
            `used_at` DATETIME NULL DEFAULT NULL,
            `claimed_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `expires_at` DATETIME NULL DEFAULT NULL,
            `claimed_source` VARCHAR(50) NULL DEFAULT NULL,
            `claimed_source_id` VARCHAR(36) NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_vc_contact` (`contact_id`),
            KEY `idx_vc_ws_camp_sub` (`workspace_id`, `campaign_id`, `subscriber_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'voucher_claims' => "
        CREATE TABLE IF NOT EXISTS `voucher_claims` (
            `id` VARCHAR(36) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `campaign_id` VARCHAR(100) NULL DEFAULT NULL,
            `voucher_id` VARCHAR(100) NULL DEFAULT NULL,
            `subscriber_id` VARCHAR(100) NULL DEFAULT NULL,
            `email` VARCHAR(255) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `phone` VARCHAR(50) NULL DEFAULT NULL,
            `ip_address` VARCHAR(64) NULL DEFAULT NULL,
            `status` ENUM('pending','approved','rejected') NULL DEFAULT 'pending',
            `source_channel` VARCHAR(50) NULL DEFAULT NULL,
            `source_id` VARCHAR(36) NULL DEFAULT NULL,
            `assigned_code_id` VARCHAR(36) NULL DEFAULT NULL,
            `claimed_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `resolved_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_vcl_contact` (`contact_id`),
            KEY `idx_vcl_voucher` (`voucher_id`),
            KEY `idx_vcl_subscriber` (`subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'short_links' => "
        CREATE TABLE IF NOT EXISTS `short_links` (
            `id` VARCHAR(36) NOT NULL,
            `workspace_id` VARCHAR(36) NOT NULL DEFAULT '1',
            `name` VARCHAR(255) NOT NULL,
            `slug` VARCHAR(100) NOT NULL,
            `target_url` TEXT NULL,
            `is_survey_checkin` TINYINT(1) NULL DEFAULT 0,
            `survey_id` VARCHAR(36) NULL DEFAULT NULL,
            `status` ENUM('active','paused') NOT NULL DEFAULT 'active',
            `access_pin` VARCHAR(10) NULL DEFAULT NULL,
            `submit_count` INT(11) NOT NULL DEFAULT 0,
            `qr_config_json` TEXT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_short_links_slug` (`slug`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'link_clicks' => "
        CREATE TABLE IF NOT EXISTS `link_clicks` (
            `id` VARCHAR(36) NOT NULL,
            `short_link_id` VARCHAR(36) NOT NULL,
            `ip_hash` VARCHAR(100) NULL DEFAULT NULL,
            `user_agent` TEXT NULL,
            `device_type` VARCHAR(50) NULL DEFAULT NULL,
            `os` VARCHAR(50) NULL DEFAULT NULL,
            `country` VARCHAR(50) NULL DEFAULT NULL,
            `city` VARCHAR(100) NULL DEFAULT NULL,
            `clicked_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_lc_short_link` (`short_link_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'otp_profiles' => "
        CREATE TABLE IF NOT EXISTS `otp_profiles` (
            `id` VARCHAR(36) NOT NULL,
            `workspace_id` VARCHAR(36) NOT NULL DEFAULT '1',
            `name` VARCHAR(255) NOT NULL,
            `token_length` INT(11) NULL DEFAULT 6,
            `token_type` ENUM('numeric','alpha','alphanumeric') NULL DEFAULT 'numeric',
            `ttl_minutes` INT(11) NULL DEFAULT 5,
            `email_template_id` VARCHAR(36) NULL DEFAULT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'otp_codes' => "
        CREATE TABLE IF NOT EXISTS `otp_codes` (
            `id` VARCHAR(36) NOT NULL,
            `profile_id` VARCHAR(36) NOT NULL,
            `receiver_email` VARCHAR(255) NOT NULL,
            `code_hash` VARCHAR(255) NOT NULL,
            `status` ENUM('pending','verified','expired') NULL DEFAULT 'pending',
            `expires_at` DATETIME NOT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `verified_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_otp_profile` (`profile_id`),
            KEY `idx_otp_expires` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Web Analytics & Tracking
    'web_properties' => "
        CREATE TABLE IF NOT EXISTS `web_properties` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(10) UNSIGNED NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `domain` VARCHAR(255) NOT NULL,
            `settings` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `status` VARCHAR(255) NULL DEFAULT NULL,
            `api_key` VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_wp_api_key` (`api_key`),
            KEY `idx_wp_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_tracking_sites' => "
        CREATE TABLE IF NOT EXISTS `web_tracking_sites` (
            `id` VARCHAR(50) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `domain` VARCHAR(255) NOT NULL,
            `tracking_code` VARCHAR(50) NOT NULL,
            `description` TEXT NULL,
            `status` ENUM('active','inactive') DEFAULT 'active',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_tracking_code` (`tracking_code`),
            KEY `idx_wts_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_visitors' => "
        CREATE TABLE IF NOT EXISTS `web_visitors` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `contact_id` INT NULL DEFAULT NULL,
            `visitor_id` VARCHAR(100) NULL DEFAULT NULL,
            `property_id` CHAR(36) NOT NULL,
            `subscriber_id` CHAR(36) NULL DEFAULT NULL,
            `zalo_user_id` VARCHAR(255) NULL DEFAULT NULL,
            `email` VARCHAR(255) NULL DEFAULT NULL,
            `phone` VARCHAR(50) NULL DEFAULT NULL,
            `first_visit_at` DATETIME NULL DEFAULT NULL,
            `last_visit_at` DATETIME NULL DEFAULT NULL,
            `visit_count` INT(10) UNSIGNED NULL DEFAULT 0,
            `device_fingerprint` VARCHAR(64) NULL DEFAULT NULL,
            `ip_address` VARCHAR(64) NULL DEFAULT NULL,
            `country` VARCHAR(100) NULL DEFAULT NULL,
            `city` VARCHAR(100) NULL DEFAULT NULL,
            `address` TEXT NULL,
            `data` LONGTEXT NULL,
            `last_seen_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_wv_visitor_id` (`visitor_id`),
            KEY `idx_wv_contact_visit` (`contact_id`, `last_visit_at`),
            KEY `idx_wv_property` (`property_id`),
            KEY `idx_wv_subscriber` (`subscriber_id`),
            KEY `idx_wv_email` (`email`),
            KEY `idx_wv_phone` (`phone`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_sessions' => "
        CREATE TABLE IF NOT EXISTS `web_sessions` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `visitor_id` CHAR(36) NOT NULL,
            `property_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `started_at` DATETIME NOT NULL,
            `last_active_at` DATETIME NOT NULL,
            `ended_at` DATETIME NULL DEFAULT NULL,
            `entry_url` VARCHAR(768) NULL DEFAULT NULL,
            `referrer_source` VARCHAR(100) NULL DEFAULT NULL,
            `utm_source` VARCHAR(100) NULL DEFAULT NULL,
            `utm_medium` VARCHAR(100) NULL DEFAULT NULL,
            `utm_campaign` VARCHAR(255) NULL DEFAULT NULL,
            `utm_content` VARCHAR(255) NULL DEFAULT NULL,
            `utm_term` VARCHAR(255) NULL DEFAULT NULL,
            `page_count` SMALLINT(5) UNSIGNED NULL DEFAULT 0,
            `duration_seconds` INT(10) UNSIGNED NULL DEFAULT 0,
            `is_bounce` TINYINT(1) NULL DEFAULT 1,
            `device_type` ENUM('mobile','desktop','tablet','bot') NULL DEFAULT 'desktop',
            `browser` VARCHAR(50) NULL DEFAULT NULL,
            `os` VARCHAR(50) NULL DEFAULT NULL,
            `country` VARCHAR(100) NULL DEFAULT NULL,
            `city` VARCHAR(100) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ws_visitor` (`visitor_id`),
            KEY `idx_ws_property` (`property_id`),
            KEY `idx_ws_workspace` (`workspace_id`),
            KEY `idx_ws_started` (`started_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_page_views' => "
        CREATE TABLE IF NOT EXISTS `web_page_views` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `session_id` BIGINT(20) UNSIGNED NOT NULL,
            `property_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `visitor_id` CHAR(36) NOT NULL,
            `url_hash` VARCHAR(32) NOT NULL,
            `url` VARCHAR(768) NULL DEFAULT NULL,
            `title` VARCHAR(500) NULL DEFAULT NULL,
            `referrer` VARCHAR(500) NULL DEFAULT NULL,
            `loaded_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `load_time_ms` INT(10) UNSIGNED NULL DEFAULT 0,
            `is_entrance` TINYINT(1) NULL DEFAULT 0,
            `time_on_page` INT(10) UNSIGNED NULL DEFAULT 0,
            `scroll_depth` TINYINT(3) UNSIGNED NULL DEFAULT 0,
            `clean_url` VARCHAR(2048) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_wpv_session_visitor` (`session_id`, `visitor_id`),
            KEY `idx_wpv_visitor` (`visitor_id`),
            KEY `idx_wpv_property` (`property_id`),
            KEY `idx_wpv_url_hash` (`url_hash`),
            KEY `idx_wpv_loaded_at` (`loaded_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_events' => "
        CREATE TABLE IF NOT EXISTS `web_events` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `session_id` BIGINT(20) UNSIGNED NOT NULL,
            `page_view_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
            `visitor_id` CHAR(36) NOT NULL,
            `property_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `event_type` VARCHAR(50) NOT NULL,
            `target_selector` VARCHAR(255) NULL DEFAULT NULL,
            `target_text` VARCHAR(255) NULL DEFAULT NULL,
            `meta_data` LONGTEXT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`, `created_at`),
            KEY `idx_we_session_type` (`session_id`, `event_type`),
            KEY `idx_we_visitor` (`visitor_id`),
            KEY `idx_we_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_form_submissions' => "
        CREATE TABLE IF NOT EXISTS `web_form_submissions` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `session_id` VARCHAR(36) NOT NULL,
            `visitor_id` VARCHAR(36) NOT NULL,
            `subscriber_id` VARCHAR(36) NOT NULL,
            `form_url` VARCHAR(768) NOT NULL,
            `form_data` LONGTEXT NOT NULL,
            `points_awarded` INT(11) NULL DEFAULT 10,
            `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_wfs_session` (`session_id`),
            KEY `idx_wfs_visitor` (`visitor_id`),
            KEY `idx_wfs_subscriber` (`subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_heatmap_data' => "
        CREATE TABLE IF NOT EXISTS `web_heatmap_data` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `page_url` VARCHAR(768) NOT NULL,
            `x_position` INT(11) NOT NULL,
            `y_position` INT(11) NOT NULL,
            `viewport_width` INT(11) NOT NULL,
            `viewport_height` INT(11) NOT NULL,
            `element_text` VARCHAR(255) NULL DEFAULT NULL,
            `clicked_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_whd_page_url` (`page_url`(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_daily_stats' => "
        CREATE TABLE IF NOT EXISTS `web_daily_stats` (
            `date` DATE NOT NULL,
            `property_id` CHAR(36) NOT NULL,
            `url_hash` VARCHAR(32) NOT NULL,
            `device_type` ENUM('mobile','desktop','tablet','bot') NOT NULL DEFAULT 'desktop',
            `page_views` INT(10) UNSIGNED NULL DEFAULT 0,
            `visitors` INT(10) UNSIGNED NULL DEFAULT 0,
            `sessions` INT(10) UNSIGNED NULL DEFAULT 0,
            `bounces` INT(10) UNSIGNED NULL DEFAULT 0,
            `total_duration` BIGINT(20) UNSIGNED NULL DEFAULT 0,
            `total_scroll` BIGINT(20) UNSIGNED NULL DEFAULT 0,
            `scroll_samples` INT(10) UNSIGNED NULL DEFAULT 0,
            `id` VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (`date`, `property_id`, `url_hash`, `device_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_analytics_summary' => "
        CREATE TABLE IF NOT EXISTS `web_analytics_summary` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `date` DATE NOT NULL,
            `page_url` VARCHAR(768) NOT NULL,
            `total_views` INT(11) DEFAULT 0,
            `unique_visitors` INT(11) DEFAULT 0,
            `avg_duration` FLOAT DEFAULT 0,
            `avg_scroll_depth` FLOAT DEFAULT 0,
            `bounce_count` INT(11) DEFAULT 0,
            `total_events` INT(11) DEFAULT 0,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_date_page` (`date`, `page_url`(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'web_blacklist' => "
        CREATE TABLE IF NOT EXISTS `web_blacklist` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `ip_address` VARCHAR(64) NOT NULL,
            `reason` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_wb_ip` (`ip_address`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Custom Events, Purchase Events, Lead Scoring, Senders & QA
    'custom_events' => "
        CREATE TABLE IF NOT EXISTS `custom_events` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `notification_enabled` TINYINT(1) NULL DEFAULT 0,
            `notification_emails` TEXT NULL,
            `notification_subject` VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_ce_workspace` (`workspace_id`),
            KEY `idx_ce_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'purchase_events' => "
        CREATE TABLE IF NOT EXISTS `purchase_events` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `notification_enabled` TINYINT(1) NULL DEFAULT 0,
            `notification_emails` TEXT NULL,
            `notification_subject` VARCHAR(255) NULL DEFAULT NULL,
            `revenue` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            PRIMARY KEY (`id`),
            KEY `idx_pe_workspace` (`workspace_id`),
            KEY `idx_pe_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'lead_scoring_rules' => "
        CREATE TABLE IF NOT EXISTS `lead_scoring_rules` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `event_type` VARCHAR(100) NOT NULL,
            `points` INT(11) NOT NULL DEFAULT 0,
            `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            `conditions_json` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_lsr_workspace_event` (`workspace_id`, `event_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'verified_senders' => "
        CREATE TABLE IF NOT EXISTS `verified_senders` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `email` VARCHAR(191) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `reply_to` VARCHAR(191) NULL DEFAULT NULL,
            `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
            `is_default` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_vs_ws_email` (`workspace_id`, `email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'qa_emails' => "
        CREATE TABLE IF NOT EXISTS `qa_emails` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `email` VARCHAR(191) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_qa_ws_email` (`workspace_id`, `email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Zalo OA & ZNS Integration
    'zalo_oa_configs' => "
        CREATE TABLE IF NOT EXISTS `zalo_oa_configs` (
            `id` VARCHAR(36) NOT NULL,
            `workspace_id` VARCHAR(50) NULL DEFAULT '1',
            `name` VARCHAR(255) NOT NULL,
            `avatar` VARCHAR(255) NULL DEFAULT NULL,
            `oa_id` VARCHAR(255) NULL DEFAULT NULL,
            `app_id` VARCHAR(255) NOT NULL,
            `app_secret` TEXT NOT NULL,
            `pkce_verifier` VARCHAR(255) NULL DEFAULT NULL,
            `access_token` TEXT NULL,
            `refresh_token` TEXT NULL,
            `token_expires_at` DATETIME NULL DEFAULT NULL,
            `token_status` VARCHAR(20) NULL DEFAULT 'unknown',
            `last_token_check` DATETIME NULL DEFAULT NULL,
            `daily_quota` INT(11) NULL DEFAULT 5000,
            `quota_used_today` INT(11) NULL DEFAULT 0,
            `quota_reset_date` DATE NULL DEFAULT NULL,
            `status` ENUM('active','inactive','suspended') NULL DEFAULT 'active',
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `remaining_quota` INT(11) NULL DEFAULT 0,
            `quality_48h` VARCHAR(50) NULL DEFAULT 'UNDEFINED',
            `quality_7d` VARCHAR(50) NULL DEFAULT 'UNDEFINED',
            `updated_at_quota` TIMESTAMP NULL DEFAULT NULL,
            `monthly_promo_quota` INT(11) NULL DEFAULT 0,
            `remaining_promo_quota` INT(11) NULL DEFAULT 0,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_zalo_oa_id` (`oa_id`),
            KEY `idx_zoc_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_templates' => "
        CREATE TABLE IF NOT EXISTS `zalo_templates` (
            `id` VARCHAR(36) NOT NULL,
            `oa_config_id` VARCHAR(36) NOT NULL,
            `template_id` VARCHAR(255) NOT NULL,
            `template_name` VARCHAR(255) NOT NULL,
            `template_type` ENUM('transaction','promotion','customer_care') NULL DEFAULT 'transaction',
            `template_data` LONGTEXT NULL,
            `preview_data` LONGTEXT NULL,
            `status` ENUM('pending','approved','rejected','disabled') NULL DEFAULT 'pending',
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zt_oa_config` (`oa_config_id`),
            KEY `idx_zt_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_lists' => "
        CREATE TABLE IF NOT EXISTS `zalo_lists` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `oa_id` VARCHAR(100) NULL DEFAULT NULL,
            `subscriber_count` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zl_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_subscribers' => "
        CREATE TABLE IF NOT EXISTS `zalo_subscribers` (
            `id` CHAR(36) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `zalo_list_id` CHAR(36) NOT NULL,
            `zalo_user_id` VARCHAR(100) NOT NULL,
            `oa_id` VARCHAR(100) NULL DEFAULT NULL,
            `subscriber_id` CHAR(36) NULL DEFAULT NULL,
            `display_name` VARCHAR(100) NULL DEFAULT 'Zalo User',
            `avatar` VARCHAR(500) NULL DEFAULT NULL,
            `phone_number` VARCHAR(20) NULL DEFAULT NULL,
            `gender` VARCHAR(20) NULL DEFAULT NULL,
            `birthday` VARCHAR(20) NULL DEFAULT NULL,
            `special_day` VARCHAR(50) NULL DEFAULT NULL,
            `manual_email` VARCHAR(255) NULL DEFAULT NULL,
            `notes` TEXT NULL,
            `status` VARCHAR(20) NULL DEFAULT 'active',
            `lead_score` INT(11) NULL DEFAULT 0,
            `is_follower` TINYINT(1) NULL DEFAULT 0,
            `last_interaction_at` DATETIME NULL DEFAULT NULL,
            `joined_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `ai_paused_until` DATETIME NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_zs_contact` (`contact_id`),
            KEY `idx_zs_ws_uid` (`workspace_id`, `zalo_user_id`),
            KEY `idx_zs_ws_list` (`workspace_id`, `zalo_list_id`),
            KEY `idx_zs_subscriber` (`subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_subscriber_activity' => "
        CREATE TABLE IF NOT EXISTS `zalo_subscriber_activity` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `subscriber_id` CHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL,
            `reference_id` VARCHAR(100) NULL DEFAULT NULL,
            `reference_name` VARCHAR(255) NULL DEFAULT NULL,
            `zalo_msg_id` VARCHAR(100) NULL DEFAULT NULL,
            `event_id` VARCHAR(100) NULL DEFAULT NULL,
            `details` TEXT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_zsa_ws_sub` (`workspace_id`, `subscriber_id`),
            KEY `idx_zsa_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_user_messages' => "
        CREATE TABLE IF NOT EXISTS `zalo_user_messages` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `zalo_user_id` VARCHAR(100) NOT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `direction` ENUM('inbound','outbound') NOT NULL,
            `message_text` TEXT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zum_user` (`zalo_user_id`),
            KEY `idx_zum_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_broadcasts' => "
        CREATE TABLE IF NOT EXISTS `zalo_broadcasts` (
            `id` VARCHAR(32) NOT NULL,
            `oa_config_id` VARCHAR(36) NOT NULL,
            `title` VARCHAR(255) NULL DEFAULT NULL,
            `content` TEXT NULL,
            `image_url` TEXT NULL,
            `message_type` ENUM('text','image') NULL DEFAULT 'text',
            `attachment_id` VARCHAR(255) NULL DEFAULT NULL,
            `buttons` LONGTEXT NULL,
            `target_group` VARCHAR(50) NULL DEFAULT 'all',
            `target_filter` LONGTEXT NULL,
            `schedule_time` DATETIME NULL DEFAULT NULL,
            `status` ENUM('draft','scheduled','sending','sent','failed') NULL DEFAULT 'draft',
            `stats_sent` INT(11) NULL DEFAULT 0,
            `stats_delivered` INT(11) NULL DEFAULT 0,
            `stats_seen` INT(11) NULL DEFAULT 0,
            `stats_reacted` INT(11) NULL DEFAULT 0,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `scheduled_at` VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_zb_oa_config` (`oa_config_id`),
            KEY `idx_zb_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_broadcast_tracking' => "
        CREATE TABLE IF NOT EXISTS `zalo_broadcast_tracking` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `broadcast_id` VARCHAR(32) NOT NULL,
            `zalo_user_id` VARCHAR(100) NOT NULL,
            `msg_id` VARCHAR(100) NULL DEFAULT NULL,
            `status` VARCHAR(30) DEFAULT 'sent',
            `sent_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zbt_broadcast` (`broadcast_id`),
            KEY `idx_zbt_msg` (`msg_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_delivery_logs' => "
        CREATE TABLE IF NOT EXISTS `zalo_delivery_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `flow_id` CHAR(36) NULL DEFAULT NULL,
            `step_id` VARCHAR(50) NULL DEFAULT NULL,
            `subscriber_id` CHAR(36) NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `oa_config_id` VARCHAR(50) NULL DEFAULT NULL,
            `template_id` VARCHAR(100) NULL DEFAULT NULL,
            `phone_number` VARCHAR(20) NULL DEFAULT NULL,
            `template_data` LONGTEXT NULL,
            `status` VARCHAR(50) NULL DEFAULT NULL,
            `msg_id` VARCHAR(100) NULL DEFAULT NULL,
            `error_code` INT(11) NULL DEFAULT 0,
            `error_message` TEXT NULL,
            `sent_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zdl_workspace` (`workspace_id`),
            KEY `idx_zdl_subscriber` (`subscriber_id`),
            KEY `idx_zdl_flow` (`flow_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_automation_scenarios' => "
        CREATE TABLE IF NOT EXISTS `zalo_automation_scenarios` (
            `id` VARCHAR(50) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `oa_id` VARCHAR(100) NULL DEFAULT NULL,
            `name` VARCHAR(255) NOT NULL,
            `trigger_type` VARCHAR(50) DEFAULT 'keyword',
            `keywords` TEXT NULL,
            `match_type` VARCHAR(20) DEFAULT 'contains',
            `response_type` VARCHAR(50) DEFAULT 'text',
            `response_content` LONGTEXT NULL,
            `is_active` TINYINT(1) DEFAULT 1,
            `priority` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zas_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_activity_buffer' => "
        CREATE TABLE IF NOT EXISTS `zalo_activity_buffer` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `subscriber_id` CHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL,
            `reference_id` VARCHAR(100) NULL DEFAULT NULL,
            `reference_name` VARCHAR(255) NULL DEFAULT NULL,
            `zalo_msg_id` VARCHAR(100) NULL DEFAULT NULL,
            `event_id` VARCHAR(100) NULL DEFAULT NULL,
            `details` TEXT NULL,
            `processed` TINYINT(1) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zab_workspace_batch` (`workspace_id`, `id`),
            KEY `idx_zab_processed` (`processed`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'zalo_message_queue' => "
        CREATE TABLE IF NOT EXISTS `zalo_message_queue` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `oa_config_id` VARCHAR(50) NOT NULL,
            `zalo_user_id` VARCHAR(100) NOT NULL,
            `payload` LONGTEXT NOT NULL,
            `status` ENUM('pending','processing','sent','failed') DEFAULT 'pending',
            `attempts` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_zmq_status` (`status`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Meta / Facebook Messenger Integration
    'meta_app_configs' => "
        CREATE TABLE IF NOT EXISTS `meta_app_configs` (
            `id` VARCHAR(64) NOT NULL,
            `page_name` VARCHAR(255) NOT NULL,
            `page_id` VARCHAR(100) NOT NULL,
            `app_id` VARCHAR(255) NULL DEFAULT NULL,
            `page_access_token` TEXT NOT NULL,
            `app_secret` VARCHAR(255) NULL DEFAULT NULL,
            `verify_token` VARCHAR(255) NULL DEFAULT NULL,
            `avatar_url` TEXT NULL,
            `status` ENUM('active','inactive','disconnected') NULL DEFAULT 'active',
            `mode` ENUM('live','dev') NULL DEFAULT 'live',
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `token_expires_at` DATETIME NULL DEFAULT NULL,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_mac_page_id` (`page_id`),
            KEY `idx_mac_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'meta_subscribers' => "
        CREATE TABLE IF NOT EXISTS `meta_subscribers` (
            `id` VARCHAR(64) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `page_id` VARCHAR(100) NOT NULL,
            `psid` VARCHAR(100) NOT NULL,
            `name` VARCHAR(255) NULL DEFAULT NULL,
            `avatar_url` TEXT NULL,
            `gender` VARCHAR(20) NULL DEFAULT NULL,
            `locale` VARCHAR(20) NULL DEFAULT NULL,
            `timezone` VARCHAR(10) NULL DEFAULT NULL,
            `email` VARCHAR(255) NULL DEFAULT NULL,
            `phone` VARCHAR(50) NULL DEFAULT NULL,
            `tags` LONGTEXT NULL,
            `custom_fields` LONGTEXT NULL,
            `is_subscribed` TINYINT(1) NULL DEFAULT 1,
            `last_active_at` DATETIME NULL DEFAULT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `first_name` VARCHAR(100) NULL DEFAULT NULL,
            `last_name` VARCHAR(100) NULL DEFAULT NULL,
            `profile_pic` TEXT NULL,
            `lead_score` INT(11) NULL DEFAULT 0,
            `notes` TEXT NULL,
            `token_expires_at` BIGINT(20) NULL DEFAULT NULL,
            `ai_paused_until` DATETIME NULL DEFAULT NULL,
            `profile_link` VARCHAR(512) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_ms_contact` (`contact_id`),
            KEY `idx_ms_page_psid` (`page_id`, `psid`),
            KEY `idx_ms_email` (`email`),
            KEY `idx_ms_phone` (`phone`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'meta_conversations' => "
        CREATE TABLE IF NOT EXISTS `meta_conversations` (
            `id` VARCHAR(64) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `page_id` VARCHAR(100) NOT NULL,
            `psid` VARCHAR(100) NOT NULL,
            `last_message_id` VARCHAR(100) NULL DEFAULT NULL,
            `last_message_snippet` TEXT NULL,
            `last_message_time` DATETIME NULL DEFAULT NULL,
            `unread_count` INT(11) NULL DEFAULT 0,
            `status` ENUM('open','done','spam') NULL DEFAULT 'open',
            `assigned_to` VARCHAR(64) NULL DEFAULT NULL,
            `ai_enabled` TINYINT(1) NULL DEFAULT 1,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_mc_contact` (`contact_id`),
            KEY `idx_mc_page_psid` (`page_id`, `psid`),
            KEY `idx_mc_last_msg_time` (`last_message_time`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'meta_message_logs' => "
        CREATE TABLE IF NOT EXISTS `meta_message_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `mid` VARCHAR(100) NULL DEFAULT NULL,
            `page_id` VARCHAR(100) NOT NULL,
            `psid` VARCHAR(100) NOT NULL,
            `direction` ENUM('inbound','outbound') NOT NULL,
            `message_type` ENUM('text','image','video','audio','file','template','fallback') NULL DEFAULT 'text',
            `content` MEDIUMTEXT NULL,
            `attachments` LONGTEXT NULL,
            `metadata` LONGTEXT NULL,
            `status` ENUM('sent','delivered','read','failed') NULL DEFAULT 'sent',
            `error_message` TEXT NULL,
            `timestamp` BIGINT(20) NULL DEFAULT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_mml_mid` (`mid`),
            KEY `idx_mml_page_psid` (`page_id`, `psid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'meta_customer_journey' => "
        CREATE TABLE IF NOT EXISTS `meta_customer_journey` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `page_id` VARCHAR(100) NOT NULL,
            `psid` VARCHAR(100) NOT NULL,
            `event_type` ENUM('message_sent','message_received','postback','read','delivery','regex_matched','tag_added','form_submit') NOT NULL,
            `event_name` VARCHAR(255) NULL DEFAULT NULL,
            `event_data` LONGTEXT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `workspace_id` INT(11) NULL DEFAULT 1,
            PRIMARY KEY (`id`),
            KEY `idx_mcj_page_psid` (`page_id`, `psid`),
            KEY `idx_mcj_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'meta_automation_scenarios' => "
        CREATE TABLE IF NOT EXISTS `meta_automation_scenarios` (
            `id` VARCHAR(64) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `page_id` VARCHAR(100) NULL DEFAULT NULL,
            `name` VARCHAR(255) NOT NULL,
            `trigger_type` VARCHAR(50) DEFAULT 'keyword',
            `keywords` TEXT NULL,
            `match_type` VARCHAR(20) DEFAULT 'contains',
            `response_type` VARCHAR(50) DEFAULT 'text',
            `response_content` LONGTEXT NULL,
            `is_active` TINYINT(1) DEFAULT 1,
            `priority` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_mas_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // AI Chatbots & Collision #4, #5, #6, #7 (`domation_ai_*`)
    'ai_chatbots' => "
        CREATE TABLE IF NOT EXISTS `ai_chatbots` (
            `id` VARCHAR(100) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `description` TEXT NULL,
            `category_id` VARCHAR(100) NULL DEFAULT NULL,
            `slug` VARCHAR(100) NULL DEFAULT NULL,
            `is_enabled` TINYINT(1) NULL DEFAULT 0,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `status` VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_ai_chatbots_slug` (`slug`),
            KEY `idx_ai_chatbots_category` (`category_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_chatbot_categories' => "
        CREATE TABLE IF NOT EXISTS `ai_chatbot_categories` (
            `id` VARCHAR(100) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `slug` VARCHAR(100) NULL DEFAULT NULL,
            `admin_id` VARCHAR(100) NULL DEFAULT NULL,
            `owner_email` VARCHAR(191) NULL DEFAULT NULL,
            `description` TEXT NULL,
            `brand_color` VARCHAR(50) NULL DEFAULT '#ffa900',
            `gemini_api_key` VARCHAR(255) NULL DEFAULT '',
            `bot_avatar` TEXT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_acc_slug` (`slug`),
            KEY `idx_acc_owner_email` (`owner_email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_chatbot_settings' => "
        CREATE TABLE IF NOT EXISTS `ai_chatbot_settings` (
            `property_id` VARCHAR(100) NOT NULL,
            `is_enabled` TINYINT(1) NULL DEFAULT 1,
            `bot_name` VARCHAR(255) NULL DEFAULT 'AI Assistant',
            `company_name` VARCHAR(255) NULL DEFAULT '',
            `brand_color` VARCHAR(50) NULL DEFAULT '#ffa900',
            `bot_avatar` TEXT NULL,
            `welcome_msg` TEXT NULL,
            `teaser_msg` TEXT NULL,
            `persona_prompt` TEXT NULL,
            `gemini_api_key` VARCHAR(255) NULL DEFAULT NULL,
            `model_id` VARCHAR(100) NULL DEFAULT 'gemini-2.0-flash',
            `quick_actions` LONGTEXT NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `gemini_cache_name` VARCHAR(255) NULL DEFAULT NULL,
            `gemini_cache_expires_at` DATETIME NULL DEFAULT NULL,
            `chunk_size` INT(11) NULL DEFAULT 1000,
            `chunk_overlap` INT(11) NULL DEFAULT 120,
            `system_instruction` LONGTEXT NULL,
            `fast_replies` LONGTEXT NULL,
            `similarity_threshold` FLOAT NULL DEFAULT 0.55,
            `top_k` INT(11) NULL DEFAULT 12,
            `history_limit` INT(11) NULL DEFAULT 15,
            `temperature` FLOAT NULL DEFAULT 1,
            `max_output_tokens` INT(11) NULL DEFAULT 4096,
            `widget_position` VARCHAR(50) NULL DEFAULT 'bottom-right',
            `excluded_pages` LONGTEXT NULL,
            `excluded_paths` LONGTEXT NULL,
            `auto_open_excluded_pages` LONGTEXT NULL,
            `auto_open_excluded_paths` LONGTEXT NULL,
            `auto_open` TINYINT(1) NULL DEFAULT 0,
            `notification_enabled` TINYINT(1) NULL DEFAULT 0,
            `notification_emails` TEXT NULL,
            `notification_cc_emails` TEXT NULL,
            `notification_subject` VARCHAR(255) NULL DEFAULT NULL,
            `ai_version` INT(11) NULL DEFAULT 1,
            `intent_configs` LONGTEXT NULL,
            `webhook_url` VARCHAR(500) NULL DEFAULT NULL,
            `webhook_secret` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_chatbot_scenarios' => "
        CREATE TABLE IF NOT EXISTS `ai_chatbot_scenarios` (
            `id` VARCHAR(60) NOT NULL,
            `property_id` VARCHAR(100) NOT NULL,
            `title` VARCHAR(255) NOT NULL DEFAULT '',
            `trigger_keywords` TEXT NOT NULL,
            `match_mode` ENUM('contains','exact','regex') NOT NULL DEFAULT 'contains',
            `reply_text` MEDIUMTEXT NOT NULL,
            `buttons` LONGTEXT NULL,
            `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            `priority` INT(11) NOT NULL DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `flow_data` LONGTEXT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_acs_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_chatbot_meta_settings' => "
        CREATE TABLE IF NOT EXISTS `ai_chatbot_meta_settings` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `property_id` VARCHAR(100) NOT NULL,
            `settings_key` VARCHAR(100) NOT NULL,
            `settings_value` TEXT NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_acms_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'domation_ai_conversations' => "
        CREATE TABLE IF NOT EXISTS `domation_ai_conversations` (
            `id` VARCHAR(100) NOT NULL,
            `contact_id` INT NULL DEFAULT NULL,
            `visitor_id` VARCHAR(100) NULL DEFAULT NULL,
            `property_id` VARCHAR(100) NULL DEFAULT NULL,
            `status` ENUM('ai','human','closed') NULL DEFAULT 'ai',
            `metadata` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `last_message` TEXT NULL,
            `last_message_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `active_scenario_id` VARCHAR(60) NULL DEFAULT NULL,
            `active_node_id` VARCHAR(100) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_dac_contact` (`contact_id`),
            KEY `idx_dac_visitor` (`visitor_id`),
            KEY `idx_dac_property` (`property_id`),
            KEY `idx_dac_last_msg_at` (`last_message_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'domation_ai_messages' => "
        CREATE TABLE IF NOT EXISTS `domation_ai_messages` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `conversation_id` VARCHAR(100) NULL DEFAULT NULL,
            `sender` ENUM('visitor','ai','human','system') NOT NULL DEFAULT 'visitor',
            `message` TEXT NULL,
            `metadata` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_dam_conversation` (`conversation_id`),
            KEY `idx_dam_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'domation_ai_training_docs' => "
        CREATE TABLE IF NOT EXISTS `domation_ai_training_docs` (
            `id` VARCHAR(100) NOT NULL,
            `parent_id` VARCHAR(100) NULL DEFAULT '0',
            `property_id` VARCHAR(100) NULL DEFAULT NULL,
            `name` VARCHAR(255) NOT NULL,
            `source_type` VARCHAR(50) NULL DEFAULT 'manual',
            `version` INT(11) NULL DEFAULT 1,
            `is_active` TINYINT(1) NULL DEFAULT 1,
            `status` ENUM('pending','processing','trained','error') NOT NULL DEFAULT 'pending',
            `priority` INT(11) NULL DEFAULT 0,
            `content` LONGTEXT NULL,
            `tags` LONGTEXT NULL,
            `metadata` LONGTEXT NULL,
            `batch_id_virtual` VARCHAR(100) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `chatbot_id` VARCHAR(100) NULL DEFAULT NULL,
            `filename` VARCHAR(255) NULL DEFAULT NULL,
            `error_message` TEXT NULL,
            `type` ENUM('url','text','file','folder','sitemap') NULL DEFAULT 'text',
            `book_title` VARCHAR(500) NULL DEFAULT NULL,
            `book_author` VARCHAR(255) NULL DEFAULT NULL,
            `total_pages` INT(11) NULL DEFAULT NULL,
            `is_global_workspace` TINYINT(1) NOT NULL DEFAULT 0,
            `uploaded_by` VARCHAR(100) NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_datd_property` (`property_id`),
            KEY `idx_datd_chatbot` (`chatbot_id`),
            KEY `idx_datd_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'domation_ai_training_chunks' => "
        CREATE TABLE IF NOT EXISTS `domation_ai_training_chunks` (
            `id` VARCHAR(100) NOT NULL,
            `property_id` VARCHAR(100) NULL DEFAULT NULL,
            `doc_id` VARCHAR(100) NOT NULL,
            `content` LONGTEXT NULL,
            `metadata_text` LONGTEXT NULL,
            `embedding` LONGTEXT NULL,
            `embedding_binary` LONGBLOB NULL,
            `section_name` VARCHAR(255) NULL DEFAULT NULL,
            `sub_section_name` VARCHAR(255) NULL DEFAULT NULL,
            `tags` LONGTEXT NULL,
            `priority_level` INT(11) NULL DEFAULT 0,
            `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            `vector_norm` DOUBLE NULL DEFAULT 0,
            `relevance_boost` INT(11) NULL DEFAULT 0,
            `token_count` INT(11) NULL DEFAULT 0,
            `page_start` INT(11) NULL DEFAULT NULL,
            `page_end` INT(11) NULL DEFAULT NULL,
            `chapter_index` INT(11) NULL DEFAULT NULL,
            `chapter_title` VARCHAR(500) NULL DEFAULT NULL,
            `section_title` VARCHAR(500) NULL DEFAULT NULL,
            `chunk_index` INT(11) NULL DEFAULT 0,
            `total_chunks` INT(11) NULL DEFAULT 1,
            `status` VARCHAR(50) NULL DEFAULT 'pending',
            PRIMARY KEY (`id`),
            KEY `idx_datc_doc` (`doc_id`),
            KEY `idx_datc_property` (`property_id`),
            FULLTEXT KEY `ft_datc_content` (`content`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_chat_queries' => "
        CREATE TABLE IF NOT EXISTS `ai_chat_queries` (
            `id` VARCHAR(100) NOT NULL,
            `property_id` VARCHAR(100) NOT NULL,
            `session_id` VARCHAR(100) NULL DEFAULT NULL,
            `query_text` TEXT NULL,
            `response_text` TEXT NULL,
            `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_acq_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_feedback' => "
        CREATE TABLE IF NOT EXISTS `ai_feedback` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `property_id` VARCHAR(100) NOT NULL,
            `conversation_id` VARCHAR(100) NULL DEFAULT NULL,
            `message_id` INT(11) NULL DEFAULT NULL,
            `rating` VARCHAR(20) NOT NULL,
            `comment` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_aif_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_pdf_chunk_results' => "
        CREATE TABLE IF NOT EXISTS `ai_pdf_chunk_results` (
            `id` VARCHAR(100) NOT NULL,
            `doc_id` VARCHAR(100) NOT NULL,
            `chunk_index` INT(11) NOT NULL DEFAULT 0,
            `status` VARCHAR(30) DEFAULT 'pending',
            `content` LONGTEXT NULL,
            `error_message` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_apcr_doc` (`doc_id`),
            KEY `idx_status_updated` (`status`, `updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_suggested_links' => "
        CREATE TABLE IF NOT EXISTS `ai_suggested_links` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `property_id` VARCHAR(100) NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `url` VARCHAR(500) NOT NULL,
            `keywords` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_asl_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_term_stats' => "
        CREATE TABLE IF NOT EXISTS `ai_term_stats` (
            `property_id` VARCHAR(100) NOT NULL,
            `term` VARCHAR(100) NOT NULL,
            `doc_freq` INT(11) NOT NULL DEFAULT 1,
            PRIMARY KEY (`property_id`, `term`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_usage_analytics' => "
        CREATE TABLE IF NOT EXISTS `ai_usage_analytics` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `group_id` VARCHAR(50) NOT NULL,
            `ai_id` VARCHAR(50) NOT NULL,
            `user_email` VARCHAR(191) NOT NULL,
            `conversation_id` VARCHAR(100) NULL DEFAULT NULL,
            `message_count` INT(11) DEFAULT 1,
            `tokens_used` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_aua_group` (`group_id`),
            KEY `idx_aua_ai` (`ai_id`),
            KEY `idx_aua_email` (`user_email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_usage_logs' => "
        CREATE TABLE IF NOT EXISTS `ai_usage_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `property_id` VARCHAR(100) NULL DEFAULT NULL,
            `model_id` VARCHAR(100) NULL DEFAULT NULL,
            `prompt_tokens` INT(11) DEFAULT 0,
            `completion_tokens` INT(11) DEFAULT 0,
            `total_tokens` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_aul_property` (`property_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_allowed_emails' => "
        CREATE TABLE IF NOT EXISTS `ai_allowed_emails` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `email` VARCHAR(191) NOT NULL,
            `group_id` VARCHAR(100) NULL DEFAULT 'default',
            `role` ENUM('admin','user') NULL DEFAULT 'user',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_aae_email` (`email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_group_members' => "
        CREATE TABLE IF NOT EXISTS `ai_group_members` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `group_id` VARCHAR(100) NOT NULL,
            `user_email` VARCHAR(191) NOT NULL,
            `role` ENUM('admin','editor','viewer') DEFAULT 'viewer',
            `invited_by` VARCHAR(191) NOT NULL,
            `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_group_user` (`group_id`, `user_email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_group_permissions' => "
        CREATE TABLE IF NOT EXISTS `ai_group_permissions` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `group_id` VARCHAR(100) NOT NULL,
            `user_email` VARCHAR(191) NOT NULL,
            `resource_type` VARCHAR(50) NOT NULL,
            `resource_id` VARCHAR(100) NOT NULL,
            `permission` VARCHAR(30) DEFAULT 'view',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_agp_group_user` (`group_id`, `user_email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_group_audit_logs' => "
        CREATE TABLE IF NOT EXISTS `ai_group_audit_logs` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `group_id` VARCHAR(100) NOT NULL,
            `user_email` VARCHAR(191) NOT NULL,
            `action` VARCHAR(50) NOT NULL,
            `target_email` VARCHAR(191) NULL DEFAULT NULL,
            `details` TEXT NULL,
            `ip_address` VARCHAR(45) NULL DEFAULT NULL,
            `user_agent` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_agal_group` (`group_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_users' => "
        CREATE TABLE IF NOT EXISTS `ai_org_users` (
            `id` VARCHAR(100) NOT NULL,
            `email` VARCHAR(191) NOT NULL,
            `password_hash` VARCHAR(255) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `role` VARCHAR(50) DEFAULT 'user',
            `status` VARCHAR(30) DEFAULT 'active',
            `avatar` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_aou_email` (`email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_user_categories' => "
        CREATE TABLE IF NOT EXISTS `ai_org_user_categories` (
            `user_id` VARCHAR(100) NOT NULL,
            `category_id` VARCHAR(100) NOT NULL,
            `role` VARCHAR(30) DEFAULT 'viewer',
            PRIMARY KEY (`user_id`, `category_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_conversations' => "
        CREATE TABLE IF NOT EXISTS `ai_org_conversations` (
            `id` VARCHAR(100) NOT NULL,
            `user_id` VARCHAR(100) NOT NULL,
            `chatbot_id` VARCHAR(100) NOT NULL,
            `title` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_aoc_user_bot` (`user_id`, `chatbot_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_messages' => "
        CREATE TABLE IF NOT EXISTS `ai_org_messages` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `conversation_id` VARCHAR(100) NOT NULL,
            `sender` VARCHAR(30) NOT NULL DEFAULT 'user',
            `message` LONGTEXT NULL,
            `metadata` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_aom_conv` (`conversation_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_access_tokens' => "
        CREATE TABLE IF NOT EXISTS `ai_org_access_tokens` (
            `token` VARCHAR(128) NOT NULL,
            `user_id` VARCHAR(100) NOT NULL,
            `expires_at` DATETIME NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`token`),
            KEY `idx_aoat_user` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_refresh_tokens' => "
        CREATE TABLE IF NOT EXISTS `ai_org_refresh_tokens` (
            `token` VARCHAR(128) NOT NULL,
            `user_id` VARCHAR(100) NOT NULL,
            `expires_at` DATETIME NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`token`),
            KEY `idx_aort_user` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_org_user_activity_logs' => "
        CREATE TABLE IF NOT EXISTS `ai_org_user_activity_logs` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `user_id` VARCHAR(100) NOT NULL,
            `action` VARCHAR(100) NOT NULL,
            `details` TEXT NULL,
            `ip_address` VARCHAR(45) NULL DEFAULT NULL,
            `user_agent` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_aoual_user_action` (`user_id`, `action`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_user_drive_permissions' => "
        CREATE TABLE IF NOT EXISTS `ai_user_drive_permissions` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `user_email` VARCHAR(191) NOT NULL,
            `folder_id` VARCHAR(100) NOT NULL,
            `permission` VARCHAR(30) DEFAULT 'read',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_audp_email` (`user_email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_workspace_files' => "
        CREATE TABLE IF NOT EXISTS `ai_workspace_files` (
            `id` VARCHAR(100) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `content` LONGTEXT NULL,
            `created_by` VARCHAR(100) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'ai_workspace_versions' => "
        CREATE TABLE IF NOT EXISTS `ai_workspace_versions` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `file_id` VARCHAR(100) NOT NULL,
            `content` LONGTEXT NULL,
            `created_by` VARCHAR(100) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_awv_file` (`file_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",

    // Webhooks, Automation Logs, Custom Fields, Import Jobs, Sheet Sync & Buffers
    'webhooks' => "
        CREATE TABLE IF NOT EXISTS `webhooks` (
            `id` VARCHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `url` VARCHAR(500) NOT NULL,
            `events` TEXT NULL,
            `secret` VARCHAR(255) NULL DEFAULT NULL,
            `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_webhooks_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'webhook_logs' => "
        CREATE TABLE IF NOT EXISTS `webhook_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `webhook_id` VARCHAR(36) NULL DEFAULT NULL,
            `event_type` VARCHAR(100) NULL DEFAULT NULL,
            `payload` LONGTEXT NULL,
            `response_code` INT(11) NULL DEFAULT NULL,
            `response_body` TEXT NULL,
            `status` VARCHAR(30) DEFAULT 'sent',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_whl_webhook` (`webhook_id`),
            KEY `idx_whl_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'automation_logs' => "
        CREATE TABLE IF NOT EXISTS `automation_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `flow_id` CHAR(36) NULL DEFAULT NULL,
            `subscriber_id` CHAR(36) NULL DEFAULT NULL,
            `step_id` VARCHAR(100) NULL DEFAULT NULL,
            `action_type` VARCHAR(50) NULL DEFAULT NULL,
            `status` VARCHAR(30) DEFAULT 'info',
            `message` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_al_ws_flow` (`workspace_id`, `flow_id`),
            KEY `idx_al_subscriber` (`subscriber_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'custom_fields' => "
        CREATE TABLE IF NOT EXISTS `custom_fields` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `tenant_id` INT(11) NOT NULL DEFAULT 1,
            `entity_type` ENUM('contact','company','deal') NOT NULL DEFAULT 'contact',
            `field_key` VARCHAR(100) NOT NULL,
            `label` VARCHAR(200) NOT NULL,
            `field_type` ENUM('text','number','date','dropdown','multiselect','checkbox','url','email','phone') NOT NULL DEFAULT 'text',
            `options` LONGTEXT NULL,
            `is_required` TINYINT(1) DEFAULT 0,
            `is_filterable` TINYINT(1) DEFAULT 1,
            `order_index` SMALLINT(6) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_field_key` (`tenant_id`, `entity_type`, `field_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'import_jobs' => "
        CREATE TABLE IF NOT EXISTS `import_jobs` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `tenant_id` INT(11) NOT NULL DEFAULT 1,
            `user_id` INT(11) NOT NULL DEFAULT 1,
            `entity_type` ENUM('contact','company','deal') NOT NULL DEFAULT 'contact',
            `file_name` VARCHAR(255) NOT NULL,
            `mapping` LONGTEXT NULL,
            `status` ENUM('pending','processing','done','failed') DEFAULT 'pending',
            `total_rows` INT(11) DEFAULT 0,
            `imported` INT(11) DEFAULT 0,
            `duplicates` INT(11) DEFAULT 0,
            `errors` INT(11) DEFAULT 0,
            `error_log` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `completed_at` TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_ij_tenant` (`tenant_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'sheet_sync_configs' => "
        CREATE TABLE IF NOT EXISTS `sheet_sync_configs` (
            `id` VARCHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `sheet_url` VARCHAR(500) NULL DEFAULT NULL,
            `sheet_id` VARCHAR(255) NULL DEFAULT NULL,
            `target_list_id` CHAR(36) NULL DEFAULT NULL,
            `mapping_json` LONGTEXT NULL,
            `sync_interval_minutes` INT(11) DEFAULT 15,
            `last_synced_at` DATETIME NULL DEFAULT NULL,
            `status` ENUM('active','paused','error') DEFAULT 'active',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ssc_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'activity_buffer' => "
        CREATE TABLE IF NOT EXISTS `activity_buffer` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NULL DEFAULT 1,
            `subscriber_id` CHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL,
            `details` TEXT NULL,
            `reference_id` VARCHAR(100) NULL DEFAULT NULL,
            `flow_id` VARCHAR(50) NULL DEFAULT NULL,
            `campaign_id` VARCHAR(50) NULL DEFAULT NULL,
            `extra_data` LONGTEXT NULL,
            `processed` TINYINT(1) NULL DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ab_workspace_batch` (`workspace_id`, `id`),
            KEY `idx_ab_processed_created` (`processed`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'stats_update_buffer' => "
        CREATE TABLE IF NOT EXISTS `stats_update_buffer` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `target_table` VARCHAR(50) NOT NULL,
            `target_id` CHAR(36) NOT NULL,
            `column_name` VARCHAR(50) NOT NULL,
            `increment_by` INT(11) DEFAULT 1,
            `processed` TINYINT(1) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sub_processed` (`processed`),
            KEY `idx_sub_target_lookup` (`target_table`, `target_id`, `column_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'timestamp_buffer' => "
        CREATE TABLE IF NOT EXISTS `timestamp_buffer` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `subscriber_id` CHAR(36) NOT NULL,
            `column_name` VARCHAR(50) NOT NULL,
            `timestamp_value` DATETIME NOT NULL,
            `processed` TINYINT(1) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_tb_processed` (`processed`),
            KEY `idx_tb_sub_col` (`subscriber_id`, `column_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'tracking_unique_cache' => "
        CREATE TABLE IF NOT EXISTS `tracking_unique_cache` (
            `cache_key` VARCHAR(128) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `reference_key` VARCHAR(255) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`cache_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'raw_event_buffer' => "
        CREATE TABLE IF NOT EXISTS `raw_event_buffer` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `event_type` VARCHAR(50) NOT NULL,
            `payload` LONGTEXT NOT NULL,
            `processed` TINYINT(1) DEFAULT 0,
            `created_at` INT(10) UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`, `created_at`),
            KEY `idx_reb_processed` (`processed`, `id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'global_assets' => "
        CREATE TABLE IF NOT EXISTS `global_assets` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `url` TEXT NOT NULL,
            `type` VARCHAR(50) DEFAULT 'image',
            `size` INT(11) DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ga_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'integrations' => "
        CREATE TABLE IF NOT EXISTS `integrations` (
            `id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) DEFAULT 1,
            `name` VARCHAR(255) NOT NULL,
            `provider` VARCHAR(100) NOT NULL,
            `config` LONGTEXT NULL,
            `status` VARCHAR(30) DEFAULT 'active',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_int_workspace` (`workspace_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'queue_jobs' => "
        CREATE TABLE IF NOT EXISTS `queue_jobs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `job_type` VARCHAR(50) NOT NULL,
            `payload` LONGTEXT NOT NULL,
            `status` ENUM('pending','processing','completed','failed') DEFAULT 'pending',
            `attempts` TINYINT(3) UNSIGNED DEFAULT 0,
            `available_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_qj_status_avail` (`status`, `available_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'queue_throttle' => "
        CREATE TABLE IF NOT EXISTS `queue_throttle` (
            `provider` VARCHAR(50) NOT NULL,
            `window_start` INT(10) UNSIGNED NOT NULL,
            `sent_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (`provider`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'spam_cooldown' => "
        CREATE TABLE IF NOT EXISTS `spam_cooldown` (
            `lock_key` VARCHAR(128) NOT NULL,
            `expires_at` INT(10) UNSIGNED NOT NULL,
            PRIMARY KEY (`lock_key`),
            KEY `idx_sc_expires` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'geoip_blocks' => "
        CREATE TABLE IF NOT EXISTS `geoip_blocks` (
            `ip_start` INT(10) UNSIGNED NOT NULL,
            `ip_end` INT(10) UNSIGNED NOT NULL,
            `country` VARCHAR(64) NULL DEFAULT NULL,
            `city` VARCHAR(128) NULL DEFAULT NULL,
            PRIMARY KEY (`ip_start`, `ip_end`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'system_audit_logs' => "
        CREATE TABLE IF NOT EXISTS `system_audit_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `user_id` VARCHAR(100) NULL DEFAULT NULL,
            `user_email` VARCHAR(191) NULL DEFAULT NULL,
            `action` VARCHAR(100) NOT NULL,
            `entity_type` VARCHAR(50) NULL DEFAULT NULL,
            `entity_id` VARCHAR(100) NULL DEFAULT NULL,
            `details` LONGTEXT NULL,
            `ip_address` VARCHAR(45) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sal_workspace` (`workspace_id`),
            KEY `idx_sal_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'system_logs' => "
        CREATE TABLE IF NOT EXISTS `system_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `level` VARCHAR(20) DEFAULT 'info',
            `message` TEXT NOT NULL,
            `context` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_sl_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'approval_requests' => "
        CREATE TABLE IF NOT EXISTS `approval_requests` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `target_type` VARCHAR(50) NOT NULL,
            `target_id` VARCHAR(100) NOT NULL,
            `request_user_id` VARCHAR(100) NOT NULL,
            `status` ENUM('pending','approved','rejected') DEFAULT 'pending',
            `reason` TEXT NULL,
            `approver_id` VARCHAR(100) NULL DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ar_workspace_target` (`workspace_id`, `target_type`, `target_id`),
            KEY `idx_ar_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'api_rate_limits' => "
        CREATE TABLE IF NOT EXISTS `api_rate_limits` (
            `ip_address` VARCHAR(64) NOT NULL,
            `endpoint` VARCHAR(100) NOT NULL,
            `requests` INT(11) NOT NULL DEFAULT 1,
            `window_start` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`ip_address`, `endpoint`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'api_tokens' => "
        CREATE TABLE IF NOT EXISTS `api_tokens` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `workspace_id` INT(11) DEFAULT 1,
            `name` VARCHAR(100) NOT NULL,
            `token` VARCHAR(128) NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `last_used_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_api_token` (`token`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    'user_access_logs' => "
        CREATE TABLE IF NOT EXISTS `user_access_logs` (
            `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` VARCHAR(100) NULL DEFAULT NULL,
            `email` VARCHAR(191) NULL DEFAULT NULL,
            `action` VARCHAR(50) NOT NULL,
            `ip_address` VARCHAR(45) NULL DEFAULT NULL,
            `user_agent` TEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ual_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
];

foreach ($domationDdlStatements as $tableName => $ddl) {
    $execSql324($ddl);
}
$emitMigration324Log("Ensured all DOMATION tables exist (with 7 collision resolutions).", 'success');

// Seed default workspace id = 1 if empty
$execSql324("INSERT IGNORE INTO `workspaces` (`id`, `name`, `description`) VALUES (1, 'IDEAS Workspace', 'Default unified MYERP + DOMATION workspace')");

// ============================================================================
// 2. ENSURE COMPATIBILITY COLUMNS & INDEXES ON EXISTING TABLES
// ============================================================================

// If legacy `forms` or `segments` existed from unified_schema.sql with INT PK, upgrade them safely
$formsIdType = $getColumnType324('forms', 'id');
if ($formsIdType !== null && strpos($formsIdType, 'int') !== false) {
    try {
        $execSql324("ALTER TABLE `form_submissions` DROP FOREIGN KEY `form_submissions_ibfk_1`");
    } catch (\Throwable $e) {
    }
    $execSql324("ALTER TABLE `forms` MODIFY COLUMN `id` CHAR(36) NOT NULL");
    if ($getColumnType324('forms', 'tenant_id') !== null) {
        $execSql324("ALTER TABLE `forms` MODIFY COLUMN `tenant_id` INT(11) NULL DEFAULT 1");
    }
    if ($getColumnType324('forms', 'schema') !== null) {
        $execSql324("ALTER TABLE `forms` MODIFY COLUMN `schema` LONGTEXT NULL");
    }
    if ($getColumnType324('forms', 'embed_token') !== null) {
        $execSql324("ALTER TABLE `forms` MODIFY COLUMN `embed_token` VARCHAR(64) NULL DEFAULT NULL");
    }
    if ($getColumnType324('forms', 'created_by') !== null) {
        $execSql324("ALTER TABLE `forms` MODIFY COLUMN `created_by` INT(11) NULL DEFAULT 1");
    }
}
$ensureColumn324('forms', 'status', "ENUM('active','inactive') NOT NULL DEFAULT 'active'");
$ensureColumn324('forms', 'target_list_id', "CHAR(36) NULL DEFAULT NULL");
$ensureColumn324('forms', 'fields_json', "LONGTEXT NULL");
$ensureColumn324('forms', 'notification_enabled', "TINYINT(1) NULL DEFAULT 0");
$ensureColumn324('forms', 'notification_emails', "TEXT NULL");
$ensureColumn324('forms', 'notification_cc_emails', "TEXT NULL");
$ensureColumn324('forms', 'notification_subject', "VARCHAR(255) NULL DEFAULT NULL");
$ensureColumn324('forms', 'workspace_id', "INT(11) NULL DEFAULT 1");

$segmentsIdType = $getColumnType324('segments', 'id');
if ($segmentsIdType !== null && strpos($segmentsIdType, 'int') !== false) {
    $execSql324("ALTER TABLE `segments` MODIFY COLUMN `id` CHAR(36) NOT NULL");
    if ($getColumnType324('segments', 'tenant_id') !== null) {
        $execSql324("ALTER TABLE `segments` MODIFY COLUMN `tenant_id` INT(11) NULL DEFAULT 1");
    }
    if ($getColumnType324('segments', 'created_by') !== null) {
        $execSql324("ALTER TABLE `segments` MODIFY COLUMN `created_by` INT(11) NULL DEFAULT 1");
    }
    if ($getColumnType324('segments', 'entity_type') !== null) {
        $execSql324("ALTER TABLE `segments` MODIFY COLUMN `entity_type` VARCHAR(50) NULL DEFAULT 'contact'");
    }
    if ($getColumnType324('segments', 'filters') !== null) {
        $execSql324("ALTER TABLE `segments` MODIFY COLUMN `filters` LONGTEXT NULL");
    }
}
$ensureColumn324('segments', 'description', "MEDIUMTEXT NULL");
$ensureColumn324('segments', 'criteria', "LONGTEXT NULL");
$ensureColumn324('segments', 'subscriber_count', "INT(11) NULL DEFAULT 0");
$ensureColumn324('segments', 'phone_count', "INT(11) NULL DEFAULT 0");
$ensureColumn324('segments', 'auto_cleanup_days', "INT(11) NULL DEFAULT 0");
$ensureColumn324('segments', 'updated_at', "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
$ensureColumn324('segments', 'ai_analysis', "LONGTEXT NULL");
$ensureColumn324('segments', 'ai_analysis_at', "TIMESTAMP NULL DEFAULT NULL");
$ensureColumn324('segments', 'synced_at', "TIMESTAMP NULL DEFAULT NULL");
$ensureColumn324('segments', 'notify_on_join', "TINYINT(1) NULL DEFAULT 0");
$ensureColumn324('segments', 'notify_subject', "VARCHAR(255) NULL DEFAULT NULL");
$ensureColumn324('segments', 'notify_email', "VARCHAR(255) NULL DEFAULT NULL");
$ensureColumn324('segments', 'notify_cc', "VARCHAR(255) NULL DEFAULT NULL");
$ensureColumn324('segments', 'workspace_id', "INT(11) NULL DEFAULT 1");

// Required compatibility columns on DOMATION tables:
// - subscribers
$ensureColumn324('subscribers', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn324('subscribers', 'person_id', "CHAR(36) NULL DEFAULT NULL");
$ensureColumn324('subscribers', 'phone_norm9', "VARCHAR(15) NULL DEFAULT NULL");
$ensureColumn324('subscribers', 'email_norm', "VARCHAR(191) NULL DEFAULT NULL");
$ensureColumn324('subscribers', 'lead_score', "INT DEFAULT 0");
$ensureColumn324('subscribers', 'zalo_user_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('subscribers', 'custom_attributes', "LONGTEXT NULL");
$ensureIndex324('subscribers', 'idx_sub_contact_id', '`contact_id`');
$ensureIndex324('subscribers', 'idx_sub_phone_norm9', '`phone_norm9`');
$ensureIndex324('subscribers', 'idx_sub_email_norm', '`email_norm`');

// - subscriber_activity
$ensureColumn324('subscriber_activity', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn324('subscriber_activity', 'step_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('subscriber_activity', 'campaign_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('subscriber_activity', 'flow_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureIndex324('subscriber_activity', 'idx_sa_contact_created', '`contact_id`, `created_at`');

// - subscriber_flow_states
$ensureColumn324('subscriber_flow_states', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn324('subscriber_flow_states', 'waiting_until', "DATETIME NULL DEFAULT NULL");
$ensureColumn324('subscriber_flow_states', 'branch_taken', "VARCHAR(50) NULL DEFAULT NULL");
$ensureIndex324('subscriber_flow_states', 'idx_sfs_contact_status', '`contact_id`, `status`');

// - web_visitors
$ensureColumn324('web_visitors', 'contact_id', "INT NULL DEFAULT NULL");
$ensureIndex324('web_visitors', 'idx_wv_contact_visit', '`contact_id`, `last_visit_at`');

// - survey_responses
$ensureColumn324('survey_responses', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn324('survey_responses', 'score', "INT DEFAULT 0");
$ensureColumn324('survey_responses', 'max_score', "INT DEFAULT 0");
$ensureColumn324('survey_responses', 'voucher_code', "VARCHAR(100) NULL DEFAULT NULL");
$ensureIndex324('survey_responses', 'idx_sr_contact', '`contact_id`');

// - voucher_campaigns
$ensureColumn324('voucher_campaigns', 'is_claimable', "TINYINT(1) DEFAULT 0");
$ensureColumn324('voucher_campaigns', 'claim_approval_required', "TINYINT(1) DEFAULT 0");
$ensureColumn324('voucher_campaigns', 'claim_target_form_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('voucher_campaigns', 'claim_email_template_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('voucher_campaigns', 'expiration_days', "INT NULL DEFAULT NULL");

// - voucher_codes
$ensureColumn324('voucher_codes', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn324('voucher_codes', 'subscriber_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureIndex324('voucher_codes', 'idx_vc_contact', '`contact_id`');

// - voucher_claims
$ensureColumn324('voucher_claims', 'contact_id', "INT NULL DEFAULT NULL");
$ensureColumn324('voucher_claims', 'campaign_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('voucher_claims', 'voucher_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('voucher_claims', 'subscriber_id', "VARCHAR(100) NULL DEFAULT NULL");
$ensureColumn324('voucher_claims', 'ip_address', "VARCHAR(64) NULL DEFAULT NULL");
$ensureIndex324('voucher_claims', 'idx_vcl_contact', '`contact_id`');

// - zalo_subscribers, meta_subscribers, meta_conversations, domation_ai_conversations
$ensureColumn324('zalo_subscribers', 'contact_id', "INT NULL DEFAULT NULL");
$ensureIndex324('zalo_subscribers', 'idx_zs_contact', '`contact_id`');

$ensureColumn324('meta_subscribers', 'contact_id', "INT NULL DEFAULT NULL");
$ensureIndex324('meta_subscribers', 'idx_ms_contact', '`contact_id`');

$ensureColumn324('meta_conversations', 'contact_id', "INT NULL DEFAULT NULL");
$ensureIndex324('meta_conversations', 'idx_mc_contact', '`contact_id`');

$ensureColumn324('domation_ai_conversations', 'contact_id', "INT NULL DEFAULT NULL");
$ensureIndex324('domation_ai_conversations', 'idx_dac_contact', '`contact_id`');

// ============================================================================
// 3. ADD DENORMALIZED FAST-READ OMNICHANNEL COLUMNS ON `MYERP.contacts`
// ============================================================================
$contactOmnichannelColumns = [
    'domation_subscriber_id' => "VARCHAR(64) NULL DEFAULT NULL",
    'marketing_status'       => "VARCHAR(32) NOT NULL DEFAULT 'subscribed'",
    'engagement_score'       => "INT NOT NULL DEFAULT 0",
    'stats_email_sent'       => "INT NOT NULL DEFAULT 0",
    'stats_email_opened'     => "INT NOT NULL DEFAULT 0",
    'stats_email_clicked'    => "INT NOT NULL DEFAULT 0",
    'last_email_open_at'     => "DATETIME NULL DEFAULT NULL",
    'last_email_click_at'    => "DATETIME NULL DEFAULT NULL",
    'last_web_visit_at'      => "DATETIME NULL DEFAULT NULL",
    'web_pageviews_count'    => "INT NOT NULL DEFAULT 0",
    'max_scroll_depth'       => "TINYINT UNSIGNED NOT NULL DEFAULT 0",
    'active_flow_count'      => "SMALLINT UNSIGNED NOT NULL DEFAULT 0",
    'active_flow_names'      => "VARCHAR(500) NULL DEFAULT NULL",
    'active_voucher_code'    => "VARCHAR(100) NULL DEFAULT NULL",
    'survey_completed_count' => "SMALLINT UNSIGNED NOT NULL DEFAULT 0",
    'zalo_user_id'           => "VARCHAR(100) NULL DEFAULT NULL",
    'meta_psid'              => "VARCHAR(100) NULL DEFAULT NULL",
];

foreach ($contactOmnichannelColumns as $colName => $colDef) {
    $ensureColumn324('contacts', $colName, $colDef);
}

$ensureIndex324('contacts', 'idx_contacts_domation_sub_id', '`domation_subscriber_id`');
$ensureIndex324('contacts', 'idx_contacts_tenant_del_engagement', '`tenant_id`, `deleted_at`, `engagement_score`');
$ensureIndex324('contacts', 'idx_contacts_tenant_del_mkt_status', '`tenant_id`, `deleted_at`, `marketing_status`');

// ============================================================================
// 4. RUN BULK MATCH-ONLY IDENTITY RESOLUTION & DENORMALIZED STATS REFRESH
// ============================================================================
require_once __DIR__ . '/../utils/DomationContactMatcher.php';

try {
    $pdoForSync = null;
    if (isset($db) && $db instanceof PDO) {
        $pdoForSync = $db;
    } elseif (class_exists('Database')) {
        $pdoForSync = Database::getInstance();
    } else {
        $configPath  = __DIR__ . '/../config.php';
        $dbClassPath = __DIR__ . '/../config/Database.php';
        if (file_exists($configPath) && file_exists($dbClassPath)) {
            require_once $configPath;
            require_once $dbClassPath;
            $pdoForSync = Database::getInstance();
        } elseif (isset($servername, $username, $password, $dbname)) {
            $dsn = "mysql:host={$servername};dbname={$dbname};charset=utf8mb4";
            $pdoForSync = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }
    }

    if ($pdoForSync instanceof PDO) {
        $syncStats = DomationContactMatcher::runBulkMatchAndRefresh($pdoForSync, 'vhvxoigh_mail_auto');
        $emitMigration324Log(
            sprintf(
                "DOMATION Match-Only Sync completed: source_db_found=%s, copied_tables=%d, matched_subscribers=%d, matched_contacts=%d",
                !empty($syncStats['source_db_found']) ? 'true' : 'false',
                (int)($syncStats['copied_tables'] ?? 0),
                (int)($syncStats['matched_subscribers'] ?? 0),
                (int)($syncStats['matched_contacts'] ?? 0)
            ),
            'success'
        );
    }
} catch (\Throwable $eSync) {
    $emitMigration324Log("Warning during DomationContactMatcher::runBulkMatchAndRefresh: " . $eSync->getMessage(), 'info');
}
