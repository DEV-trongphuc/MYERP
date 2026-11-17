<?php
/**
 * Migration 336: Atomic Campaign Send Deduplication & Fast Delivery Indexes
 * 1. Creates `campaign_send_claims` with UNIQUE KEY (campaign_id, channel, recipient_key)
 *    to guarantee zero duplicate sends across duplicate subscriber rows & parallel shard workers.
 * 2. Adds composite indexes `idx_mdl_camp_del_sent` & `idx_mdl_camp_del_rec` on `mail_delivery_logs`.
 * 3. Normalizes `subscribers.email_norm` for rows missing normalized email.
 * 4. Backfills `campaign_send_claims` from `mail_delivery_logs` for paused/sending campaigns.
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
        } catch (\Throwable $e) {}
    }
}

try {
    if (isset($db) && !($db instanceof PDO) && method_exists($db, 'getConnection')) {
        $db = $db->getConnection();
    }
    if (!($db instanceof PDO)) return;
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $hasIdx = function (PDO $pdo, string $tbl, string $idx): bool {
        $stmt = $pdo->prepare("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1");
        $stmt->execute([$tbl, $idx]);
        return (bool)$stmt->fetchColumn();
    };

    // 1. Atomic Claim Table (Safe across concurrent shards + retries)
    $db->exec("
        CREATE TABLE IF NOT EXISTS `campaign_send_claims` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `campaign_id` CHAR(36) NOT NULL,
            `workspace_id` INT(11) NOT NULL DEFAULT 1,
            `recipient_key` VARCHAR(191) NOT NULL,
            `channel` VARCHAR(20) NOT NULL DEFAULT 'email',
            `subscriber_id` CHAR(36) DEFAULT NULL,
            `status` ENUM('processing','sent','failed','skipped') NOT NULL DEFAULT 'processing',
            `claimed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_camp_chan_key` (`campaign_id`, `channel`, `recipient_key`),
            KEY `idx_csc_camp_status` (`campaign_id`, `status`),
            KEY `idx_csc_ws` (`workspace_id`, `campaign_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // 2. Fast composite indexes on mail_delivery_logs (eliminates slow scans on history tab + dedup checks)
    if (!$hasIdx($db, 'mail_delivery_logs', 'idx_mdl_camp_del_sent')) {
        $db->exec("ALTER TABLE `mail_delivery_logs` ADD INDEX `idx_mdl_camp_del_sent` (`campaign_id`, `deleted_at`, `sent_at`, `id`)");
    }
    if (!$hasIdx($db, 'mail_delivery_logs', 'idx_mdl_camp_del_rec')) {
        $db->exec("ALTER TABLE `mail_delivery_logs` ADD INDEX `idx_mdl_camp_del_rec` (`campaign_id`, `deleted_at`, `recipient`)");
    }

    // 3. Backfill missing subscribers.email_norm cleanly
    $db->exec("
        UPDATE `subscribers`
        SET `email_norm` = LOWER(TRIM(`email`))
        WHERE `deleted_at` IS NULL
          AND `email` IS NOT NULL
          AND TRIM(`email`) != ''
          AND (`email_norm` IS NULL OR `email_norm` = '' OR `email_norm` != LOWER(TRIM(`email`)))
    ");

    // 4. Backfill claims for currently active/paused/scheduled campaigns from mail_delivery_logs
    $db->exec("
        INSERT IGNORE INTO `campaign_send_claims`
            (`campaign_id`, `workspace_id`, `recipient_key`, `channel`, `subscriber_id`, `status`, `claimed_at`)
        SELECT
            l.`campaign_id`,
            COALESCE(l.`workspace_id`, c.`workspace_id`, 1),
            LOWER(TRIM(l.`recipient`)),
            CASE WHEN c.`type` = 'zalo_zns' THEN 'zns' ELSE 'email' END,
            l.`subscriber_id`,
            'sent',
            COALESCE(l.`sent_at`, NOW())
        FROM `mail_delivery_logs` l
        INNER JOIN `campaigns` c ON c.`id` = l.`campaign_id`
        WHERE l.`deleted_at` IS NULL
          AND l.`status` = 'success'
          AND l.`campaign_id` IS NOT NULL
          AND l.`recipient` IS NOT NULL
          AND TRIM(l.`recipient`) != ''
          AND c.`status` IN ('paused', 'sending', 'scheduled')
    ");
} catch (\Throwable $e) {
    error_log("Migration 336 failed: " . $e->getMessage());
}
