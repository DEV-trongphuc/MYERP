<?php
/**
 * Migration 330: Meta Conversions API (CAPI) Quality Funnel, Dual-Pixel & Attribution Upgrade
 *
 * 1. Widens `capi_logs.event_name` from legacy real-estate ENUM to VARCHAR(100) so all Meta Standard/Custom events work.
 * 2. Adds observability & dedup columns on `capi_logs`: pixel_id, action_source, meta_lead_id, event_id, trigger_stage, trigger_mode, event_value, emq_signals.
 * 3. Adds web attribution columns on `contact_meta_attribution`: fbc, fbp, client_ip_address, client_user_agent, event_source_url, fb_pixel_id.
 * 4. Seeds IDEAS CRM Pixel (583807401361847), Web Pixel (661260709828887), Ad Account (1852318231510577),
 *    and upgrades legacy real-estate `capi_event_triggers` to 14-stage Education pipeline starting at `04 - Needed` (`needed`).
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
                echo "[WARN] Local DB connection skipped in CLI (" . $e->getMessage() . ").\n";
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

    $hasColumn = function (PDO $pdo, string $table, string $column): bool {
        $stmt = $pdo->prepare("
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
            LIMIT 1
        ");
        $stmt->execute([$table, $column]);
        return (bool)$stmt->fetchColumn();
    };

    $hasIndex = function (PDO $pdo, string $table, string $index): bool {
        $stmt = $pdo->prepare("
            SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
            LIMIT 1
        ");
        $stmt->execute([$table, $index]);
        return (bool)$stmt->fetchColumn();
    };

    // 1. Expand capi_logs.event_name from ENUM -> VARCHAR(100)
    $stmtType = $db->prepare("
        SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'capi_logs' AND COLUMN_NAME = 'event_name'
        LIMIT 1
    ");
    $stmtType->execute();
    $colType = strtolower((string)$stmtType->fetchColumn());
    if ($colType === 'enum') {
        $db->exec("ALTER TABLE `capi_logs` MODIFY COLUMN `event_name` VARCHAR(100) NOT NULL");
    }

    // 2. Add telemetry columns & indexes to capi_logs
    $capiLogCols = [
        'pixel_id'      => "ALTER TABLE `capi_logs` ADD COLUMN `pixel_id` VARCHAR(64) DEFAULT NULL AFTER `contact_id`",
        'action_source' => "ALTER TABLE `capi_logs` ADD COLUMN `action_source` VARCHAR(40) DEFAULT NULL AFTER `event_name`",
        'meta_lead_id'  => "ALTER TABLE `capi_logs` ADD COLUMN `meta_lead_id` VARCHAR(64) DEFAULT NULL AFTER `lead_id`",
        'event_id'      => "ALTER TABLE `capi_logs` ADD COLUMN `event_id` VARCHAR(120) DEFAULT NULL AFTER `payload_hash`",
        'trigger_stage' => "ALTER TABLE `capi_logs` ADD COLUMN `trigger_stage` VARCHAR(80) DEFAULT NULL AFTER `event_id`",
        'trigger_mode'  => "ALTER TABLE `capi_logs` ADD COLUMN `trigger_mode` VARCHAR(32) NOT NULL DEFAULT 'realtime' AFTER `trigger_stage`",
        'event_value'   => "ALTER TABLE `capi_logs` ADD COLUMN `event_value` DECIMAL(15,2) DEFAULT NULL AFTER `trigger_mode`",
        'emq_signals'   => "ALTER TABLE `capi_logs` ADD COLUMN `emq_signals` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `event_value`",
    ];
    foreach ($capiLogCols as $col => $ddl) {
        if (!$hasColumn($db, 'capi_logs', $col)) {
            $db->exec($ddl);
        }
    }

    if (!$hasIndex($db, 'capi_logs', 'idx_capi_event_id')) {
        $db->exec("CREATE INDEX `idx_capi_event_id` ON `capi_logs` (`event_id`)");
    }
    if (!$hasIndex($db, 'capi_logs', 'idx_capi_pixel_sent')) {
        $db->exec("CREATE INDEX `idx_capi_pixel_sent` ON `capi_logs` (`pixel_id`, `sent_at`)");
    }
    if (!$hasIndex($db, 'capi_logs', 'idx_capi_contact_stage')) {
        $db->exec("CREATE INDEX `idx_capi_contact_stage` ON `capi_logs` (`contact_id`, `trigger_stage`, `response_status`)");
    }

    // 3. Add web attribution columns to contact_meta_attribution
    $cmaCols = [
        'fbc'                => "ALTER TABLE `contact_meta_attribution` ADD COLUMN `fbc` VARCHAR(255) DEFAULT NULL AFTER `platform`",
        'fbp'                => "ALTER TABLE `contact_meta_attribution` ADD COLUMN `fbp` VARCHAR(255) DEFAULT NULL AFTER `fbc`",
        'client_ip_address'  => "ALTER TABLE `contact_meta_attribution` ADD COLUMN `client_ip_address` VARCHAR(64) DEFAULT NULL AFTER `fbp`",
        'client_user_agent'  => "ALTER TABLE `contact_meta_attribution` ADD COLUMN `client_user_agent` VARCHAR(512) DEFAULT NULL AFTER `client_ip_address`",
        'event_source_url'   => "ALTER TABLE `contact_meta_attribution` ADD COLUMN `event_source_url` VARCHAR(512) DEFAULT NULL AFTER `client_user_agent`",
        'fb_pixel_id'        => "ALTER TABLE `contact_meta_attribution` ADD COLUMN `fb_pixel_id` VARCHAR(64) DEFAULT NULL AFTER `event_source_url`",
    ];
    foreach ($cmaCols as $col => $ddl) {
        if (!$hasColumn($db, 'contact_meta_attribution', $col)) {
            $db->exec($ddl);
        }
    }
    if (!$hasIndex($db, 'contact_meta_attribution', 'idx_cma_fbc')) {
        $db->exec("CREATE INDEX `idx_cma_fbc` ON `contact_meta_attribution` (`fbc`(64))");
    }

    // 4. Seed / upgrade CAPI settings safely without clobbering custom values
    $upsertIfEmpty = function (PDO $pdo, string $key, string $value, array $replaceLegacyValues = []): void {
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1");
        $stmt->execute([$key]);
        $curr = $stmt->fetchColumn();
        if ($curr === false || trim((string)$curr) === '' || in_array(trim((string)$curr), $replaceLegacyValues, true)) {
            $ins = $pdo->prepare("
                INSERT INTO system_settings (setting_key, setting_value)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $ins->execute([$key, $value]);
        }
    };

    $upsertIfEmpty($db, 'meta_pixel_id', '583807401361847');
    $upsertIfEmpty($db, 'meta_web_pixel_id', '661260709828887');
    $upsertIfEmpty($db, 'meta_ad_account_id', '1852318231510577', ['2263916290803530']);
    $upsertIfEmpty($db, 'capi_source_mode', 'all_quality');
    $upsertIfEmpty($db, 'capi_quality_min_stage', 'needed');
    $upsertIfEmpty($db, 'capi_dual_pixel_enabled', '1');

    // Upgrade legacy real-estate capi_event_triggers -> Education 14-stage triggers (from 04 - Needed+)
    $stmtTrig = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'capi_event_triggers' LIMIT 1");
    $stmtTrig->execute();
    $currTrigRaw = (string)($stmtTrig->fetchColumn() ?: '');
    $currTrig = json_decode($currTrigRaw, true);
    $hasEduKey = is_array($currTrig) && (
        isset($currTrig['needed']) || isset($currTrig['enrolled']) || isset($currTrig['new_lead'])
    );
    if (!$hasEduKey) {
        $eduDefaultTriggers = [
            'new_lead'                => 'Skip',
            'contact_attempted'       => 'Skip',
            'connected'               => 'Skip',
            'needed'                  => 'Lead',
            'discovery_completed'     => 'Schedule',
            'program_matched'         => 'ViewContent',
            'proposal_sent'           => 'Schedule',
            'evaluation_objection'    => 'Skip',
            'application_started'     => 'SubmitApplication',
            'application_completed'   => 'SubmitApplication',
            'admission_approved'      => 'SubmitApplication',
            'offer_accepted'          => 'SubmitApplication',
            'deposit_tuition_payment' => 'Purchase',
            'enrolled'                => 'Purchase',
            'lost'                    => 'Skip',
            'not_lead'                => 'Skip',
            'spam'                    => 'Skip',
        ];
        $insTrig = $db->prepare("
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES ('capi_event_triggers', ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $insTrig->execute([json_encode($eduDefaultTriggers, JSON_UNESCAPED_UNICODE)]);
    }

    @unlink(sys_get_temp_dir() . '/ideas_system_settings.json');
} catch (\Throwable $e) {
    error_log("Migration 330 error: " . $e->getMessage());
    throw $e;
}
