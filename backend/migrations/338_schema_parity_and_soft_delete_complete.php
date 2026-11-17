<?php
/**
 * Migration 338: Complete Multi-Tenant SaaS Schema Parity, Soft-Delete Mandate & Academic/HRM/Marketing Tables
 *
 * 100% Idempotent & Non-Destructive Schema Evolution (supports both MySQL & SQLite):
 * 1. Ensures Tenant SaaS tables & columns via TenantConfigService::ensureSchema().
 * 2. Upgrades users.role from legacy ENUM to VARCHAR(64) if needed so custom roles never fail strict mode.
 * 3. Ensures Academic Affairs & HRM Accounting tables:
 *    - student_subject_grades
 *    - student_postpone_records
 *    - mentoring_1on1_configs
 *    - mentoring_1on1_bookings
 *    - hrm_accounting_az_workspace
 *    - campaign_send_claims
 * 4. Ensures 100% Soft-Delete (`deleted_at`) & missing schema columns across all operational & marketing tables:
 *    - hrm_profiles.misa_comp_carryover
 *    - hrm_leave_requests.deleted_at
 *    - hrm_salary_advances.deleted_at
 *    - attendance_bulk_requests.deleted_at
 *    - attendance_bulk_request_details.deleted_at
 *    - data_reports.deleted_at
 *    - subscribers.deleted_at
 *    - lists.deleted_at
 *    - segments.deleted_at
 *    - campaigns.is_deleted, campaigns.deleted_at
 *    - flows.deleted_at
 *    - forms.deleted_at
 *    - surveys.deleted_at
 *    - short_links.is_deleted, short_links.deleted_at
 *    - web_properties.is_deleted, web_properties.deleted_at
 *    - mail_delivery_logs.deleted_at
 */

require_once __DIR__ . '/../config/TenantConfigService.php';

if (!function_exists('run_migration_338_schema_parity_and_soft_delete')) {
    function run_migration_338_schema_parity_and_soft_delete(PDO $pdo): array
    {
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $isSqlite = TenantConfigService::isSqlite($pdo);
        $applied = [];

        // 1. Ensure SaaS core tables & columns
        TenantConfigService::ensureSchema($pdo, 1);
        $applied[] = 'tenant_config_schema_ensured';

        if ($isSqlite) {
            $pdo->exec("CREATE TABLE IF NOT EXISTS student_subject_grades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1,
                contact_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL DEFAULT 0,
                subject_code TEXT NOT NULL DEFAULT '',
                subject_name TEXT NOT NULL DEFAULT '',
                attendance_score TEXT,
                assignment_score TEXT,
                final_score TEXT,
                letter_grade TEXT,
                status TEXT NOT NULL DEFAULT 'studying',
                note TEXT,
                updated_by INTEGER,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )");
            $pdo->exec("CREATE TABLE IF NOT EXISTS student_postpone_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1,
                contact_id INTEGER NOT NULL,
                form_file_id INTEGER,
                form_file_url TEXT,
                form_file_name TEXT,
                postpone_reason TEXT,
                postpone_from_date TEXT,
                postpone_to_date TEXT,
                duration_months INTEGER NOT NULL DEFAULT 6,
                remind_days_before INTEGER NOT NULL DEFAULT 14,
                postpone_remind_date TEXT,
                deferred_subjects TEXT,
                remind_status TEXT NOT NULL DEFAULT 'pending',
                reminded_at TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )");
            $pdo->exec("CREATE TABLE IF NOT EXISTS mentoring_1on1_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1,
                booking_code TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                campaign_id INTEGER,
                subject_name TEXT,
                lecturer_id INTEGER NOT NULL DEFAULT 0,
                lecturer_name TEXT,
                lecturer_email TEXT,
                week_start_date TEXT NOT NULL,
                week_end_date TEXT NOT NULL,
                slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
                min_advance_hours INTEGER NOT NULL DEFAULT 24,
                zoom_link TEXT,
                zoom_id TEXT,
                zoom_pass TEXT,
                available_slots_json TEXT,
                notes TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )");
            $pdo->exec("CREATE TABLE IF NOT EXISTS mentoring_1on1_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL DEFAULT 1,
                config_id INTEGER NOT NULL,
                contact_id INTEGER,
                student_name TEXT NOT NULL,
                student_code TEXT,
                student_email TEXT NOT NULL,
                student_phone TEXT,
                program_name TEXT,
                topic TEXT,
                questions TEXT,
                slot_date TEXT NOT NULL,
                slot_time_start TEXT NOT NULL,
                slot_time_end TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed',
                activity_id INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )");
            $pdo->exec("CREATE TABLE IF NOT EXISTS hrm_accounting_az_workspace (
                tenant_id INTEGER NOT NULL PRIMARY KEY,
                state_json TEXT,
                updated_by INTEGER,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )");
            $pdo->exec("CREATE TABLE IF NOT EXISTS campaign_send_claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id TEXT NOT NULL,
                workspace_id INTEGER NOT NULL DEFAULT 1,
                recipient_key TEXT NOT NULL,
                channel TEXT NOT NULL DEFAULT 'email',
                subscriber_id TEXT,
                status TEXT NOT NULL DEFAULT 'processing',
                claimed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaign_id, channel, recipient_key)
            )");
            $sqliteColumnSpecs = [
                'hrm_profiles' => ['misa_comp_carryover' => ' REAL NOT NULL DEFAULT 0'],
                'hrm_leave_requests' => ['deleted_at' => ' TEXT'],
                'hrm_salary_advances' => ['deleted_at' => ' TEXT'],
                'attendance_bulk_requests' => ['deleted_at' => ' TEXT'],
                'attendance_bulk_request_details' => ['deleted_at' => ' TEXT'],
                'data_reports' => ['deleted_at' => ' TEXT'],
                'subscribers' => ['deleted_at' => ' TEXT'],
                'lists' => ['deleted_at' => ' TEXT'],
                'segments' => ['deleted_at' => ' TEXT'],
                'campaigns' => ['is_deleted' => ' INTEGER NOT NULL DEFAULT 0', 'deleted_at' => ' TEXT'],
                'flows' => ['deleted_at' => ' TEXT'],
                'forms' => ['deleted_at' => ' TEXT'],
                'surveys' => ['deleted_at' => ' TEXT'],
                'short_links' => ['is_deleted' => ' INTEGER NOT NULL DEFAULT 0', 'deleted_at' => ' TEXT'],
                'web_properties' => ['is_deleted' => ' INTEGER NOT NULL DEFAULT 0', 'deleted_at' => ' TEXT'],
                'mail_delivery_logs' => ['deleted_at' => ' TEXT'],
            ];
            foreach ($sqliteColumnSpecs as $sqTbl => $sqCols) {
                $stmtSqTbl = $pdo->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1");
                $stmtSqTbl->execute([$sqTbl]);
                if (!$stmtSqTbl->fetchColumn()) {
                    continue;
                }
                $existingSqCols = [];
                foreach ($pdo->query("PRAGMA table_info({$sqTbl})")->fetchAll(PDO::FETCH_ASSOC) ?: [] as $ci) {
                    $existingSqCols[strtolower((string)($ci['name'] ?? ''))] = true;
                }
                foreach ($sqCols as $sqCol => $sqDdl) {
                    if (empty($existingSqCols[strtolower($sqCol)])) {
                        $pdo->exec("ALTER TABLE {$sqTbl} ADD COLUMN {$sqCol}{$sqDdl}");
                        $applied[] = "{$sqTbl}.{$sqCol}";
                    }
                }
            }
            return ['migration' => '338_schema_parity_and_soft_delete_complete', 'driver' => 'sqlite', 'applied' => $applied];
        }

        $hasTable = static function (PDO $db, string $table): bool {
            $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE'");
            $stmt->execute([$table]);
            return (int)$stmt->fetchColumn() > 0;
        };

        $hasCol = static function (PDO $db, string $table, string $col): bool {
            $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $stmt->execute([$table, $col]);
            return (int)$stmt->fetchColumn() > 0;
        };

        $hasIdx = static function (PDO $db, string $table, string $idx): bool {
            $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
            $stmt->execute([$table, $idx]);
            return (int)$stmt->fetchColumn() > 0;
        };

        // 2. Ensure users.role is VARCHAR(64) (not legacy ENUM) so custom roles work seamlessly
        if ($hasTable($pdo, 'users') && $hasCol($pdo, 'users', 'role')) {
            $stmtRoleType = $pdo->prepare("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role' LIMIT 1");
            $stmtRoleType->execute();
            $roleDataType = strtolower((string)$stmtRoleType->fetchColumn());
            if ($roleDataType === 'enum') {
                $pdo->exec("ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(64) NOT NULL DEFAULT 'sales'");
                $applied[] = 'users.role_upgraded_to_varchar';
            }
        }

        // 3. Ensure Academic Affairs, HRM Accounting & Campaign Dedup tables
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `student_subject_grades` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL DEFAULT 1,
                `contact_id` INT NOT NULL,
                `campaign_id` INT NOT NULL DEFAULT 0,
                `subject_code` VARCHAR(100) NOT NULL DEFAULT '',
                `subject_name` VARCHAR(255) NOT NULL DEFAULT '',
                `attendance_score` VARCHAR(32) NULL DEFAULT NULL,
                `assignment_score` VARCHAR(32) NULL DEFAULT NULL,
                `final_score` VARCHAR(50) NULL DEFAULT NULL,
                `letter_grade` VARCHAR(32) NULL DEFAULT NULL,
                `status` VARCHAR(32) NOT NULL DEFAULT 'studying',
                `note` TEXT NULL,
                `updated_by` INT NULL DEFAULT NULL,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_ssg_contact` (`tenant_id`, `contact_id`),
                INDEX `idx_ssg_campaign` (`tenant_id`, `campaign_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `student_postpone_records` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL DEFAULT 1,
                `contact_id` INT NOT NULL,
                `form_file_id` INT NULL DEFAULT NULL,
                `form_file_url` VARCHAR(500) NULL DEFAULT NULL,
                `form_file_name` VARCHAR(255) NULL DEFAULT NULL,
                `postpone_reason` TEXT NULL,
                `postpone_from_date` DATE NULL DEFAULT NULL,
                `postpone_to_date` DATE NULL DEFAULT NULL,
                `duration_months` INT NOT NULL DEFAULT 6,
                `remind_days_before` INT NOT NULL DEFAULT 14,
                `postpone_remind_date` DATE NULL DEFAULT NULL,
                `deferred_subjects` TEXT NULL,
                `remind_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
                `reminded_at` DATETIME NULL DEFAULT NULL,
                `created_by` INT NULL DEFAULT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_spr_contact` (`tenant_id`, `contact_id`),
                INDEX `idx_spr_remind` (`postpone_remind_date`, `remind_status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `mentoring_1on1_configs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL DEFAULT 1,
                `booking_code` VARCHAR(64) NOT NULL UNIQUE,
                `title` VARCHAR(255) NOT NULL,
                `campaign_id` INT NULL DEFAULT NULL,
                `subject_name` VARCHAR(255) NULL DEFAULT NULL,
                `lecturer_id` INT NOT NULL DEFAULT 0,
                `lecturer_name` VARCHAR(255) NULL DEFAULT NULL,
                `lecturer_email` VARCHAR(255) NULL DEFAULT NULL,
                `week_start_date` DATE NOT NULL,
                `week_end_date` DATE NOT NULL,
                `slot_duration_minutes` INT NOT NULL DEFAULT 30,
                `min_advance_hours` INT NOT NULL DEFAULT 24,
                `zoom_link` VARCHAR(500) NULL DEFAULT NULL,
                `zoom_id` VARCHAR(100) NULL DEFAULT NULL,
                `zoom_pass` VARCHAR(100) NULL DEFAULT NULL,
                `available_slots_json` LONGTEXT NULL,
                `notes` TEXT NULL,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_by` INT NULL DEFAULT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_m1c_lecturer` (`tenant_id`, `lecturer_id`),
                INDEX `idx_m1c_campaign` (`tenant_id`, `campaign_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `mentoring_1on1_bookings` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tenant_id` INT NOT NULL DEFAULT 1,
                `config_id` INT NOT NULL,
                `contact_id` INT NULL DEFAULT NULL,
                `student_name` VARCHAR(255) NOT NULL,
                `student_code` VARCHAR(100) NULL DEFAULT NULL,
                `student_email` VARCHAR(255) NOT NULL,
                `student_phone` VARCHAR(50) NULL DEFAULT NULL,
                `program_name` VARCHAR(255) NULL DEFAULT NULL,
                `topic` TEXT NULL,
                `questions` TEXT NULL,
                `slot_date` DATE NOT NULL,
                `slot_time_start` VARCHAR(16) NOT NULL,
                `slot_time_end` VARCHAR(16) NOT NULL,
                `status` VARCHAR(32) NOT NULL DEFAULT 'confirmed',
                `activity_id` INT NULL DEFAULT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_m1b_slot` (`config_id`, `slot_date`, `slot_time_start`, `status`),
                INDEX `idx_m1b_contact` (`contact_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `hrm_accounting_az_workspace` (
                `tenant_id` INT NOT NULL PRIMARY KEY,
                `state_json` LONGTEXT NULL,
                `updated_by` INT NULL DEFAULT NULL,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
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

        // 4. Idempotent column additions across operational & marketing tables
        $columnSpecs = [
            'hrm_profiles' => [
                'misa_comp_carryover' => "DECIMAL(6,2) NOT NULL DEFAULT 0.00",
            ],
            'hrm_leave_requests' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'hrm_salary_advances' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'attendance_bulk_requests' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'attendance_bulk_request_details' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'data_reports' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'subscribers' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'lists' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'segments' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'campaigns' => [
                'is_deleted' => "TINYINT(1) NOT NULL DEFAULT 0",
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'flows' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'forms' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'surveys' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'short_links' => [
                'is_deleted' => "TINYINT(1) NOT NULL DEFAULT 0",
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'web_properties' => [
                'is_deleted' => "TINYINT(1) NOT NULL DEFAULT 0",
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
            'mail_delivery_logs' => [
                'deleted_at' => "TIMESTAMP NULL DEFAULT NULL",
            ],
        ];

        foreach ($columnSpecs as $table => $cols) {
            if (!$hasTable($pdo, $table)) {
                continue;
            }
            foreach ($cols as $col => $ddl) {
                if (!$hasCol($pdo, $table, $col)) {
                    $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$ddl}");
                    $applied[] = "{$table}.{$col}";
                }
            }
        }

        // 5. Composite SARGable soft-delete indexes on newly soft-deleted tables
        $indexSpecs = [
            'flows' => ['idx_flows_ws_del' => '(`workspace_id`, `deleted_at`, `status`)'],
            'forms' => ['idx_forms_ws_del' => '(`workspace_id`, `deleted_at`, `status`)'],
            'surveys' => ['idx_surveys_ws_del' => '(`workspace_id`, `deleted_at`, `status`)'],
            'data_reports' => ['idx_dr_consultant_del' => '(`consultant_id`, `deleted_at`)'],
        ];
        foreach ($indexSpecs as $table => $indexes) {
            if (!$hasTable($pdo, $table)) {
                continue;
            }
            foreach ($indexes as $idxName => $idxCols) {
                if (!$hasIdx($pdo, $table, $idxName)) {
                    try {
                        $pdo->exec("ALTER TABLE `{$table}` ADD INDEX `{$idxName}` {$idxCols}");
                        $applied[] = "{$table}#{$idxName}";
                    } catch (\Throwable $eIdx) {
                    }
                }
            }
        }

        return [
            'migration' => '338_schema_parity_and_soft_delete_complete',
            'driver' => 'mysql',
            'applied' => $applied,
        ];
    }
}

$activeMigrationPdo338 = ($pdo ?? $db ?? null);
if ($activeMigrationPdo338 instanceof PDO) {
    run_migration_338_schema_parity_and_soft_delete($activeMigrationPdo338);
} elseif (php_sapi_name() === 'cli' && isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../config/Database.php';
    try {
        $db = Database::getInstance();
        $res = run_migration_338_schema_parity_and_soft_delete($db);
        echo json_encode(['success' => true, 'data' => $res], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    } catch (\PDOException $eCli) {
        if ((int)$eCli->getCode() === 2002 || strpos($eCli->getMessage(), '[2002]') !== false) {
            fwrite(STDERR, 'Live MySQL socket unavailable in CLI: ' . $eCli->getMessage() . PHP_EOL);
            exit(2);
        }
        fwrite(STDERR, 'Migration 338 error: ' . $eCli->getMessage() . PHP_EOL);
        echo json_encode(['success' => false, 'error' => $eCli->getMessage()], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        exit(1);
    } catch (\Throwable $eCli) {
        fwrite(STDERR, 'Migration 338 error: ' . $eCli->getMessage() . PHP_EOL);
        echo json_encode(['success' => false, 'error' => $eCli->getMessage()], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        exit(1);
    }
}

return static function (PDO $targetPdo): array {
    return run_migration_338_schema_parity_and_soft_delete($targetPdo);
};
