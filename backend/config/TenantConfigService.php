<?php

class TenantConfigService
{
    private static array $memCache = [];
    private static array $schemaEnsured = [];

    public const MODULES = [
        'dashboard', 'workspace', 'contacts', 'students', 'deals', 'leads',
        'projects', 'campaigns', 'schedules', 'companies', 'suppliers',
        'products', 'inventory', 'quotes', 'invoices', 'sales_orders',
        'purchase_orders', 'deposits', 'expenses', 'finance', 'cooperations',
        'hrm', 'attendance', 'approvals', 'tickets', 'gatekeeper',
        'marketing', 'files', 'reports', 'users', 'teams', 'settings', 'ai'
    ];

    public static function isSqlite(PDO $db): bool
    {
        return strtolower((string)$db->getAttribute(PDO::ATTR_DRIVER_NAME)) === 'sqlite';
    }

    private static function cacheFile(int $tenantId, string $bucket): string
    {
        return rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . "myerp_tcfg_{$bucket}_t{$tenantId}.json";
    }

    public static function invalidateCache(int $tenantId = 0): void
    {
        $tmpDir = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR;
        if ($tenantId > 0) {
            unset(self::$memCache[$tenantId]);
            unset($GLOBALS['__system_settings_cache'][$tenantId]);
            foreach (glob($tmpDir . "myerp_tcfg_*_t{$tenantId}.json") ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($tmpDir . "myerp_auth_u_*_{$tenantId}.json") ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($tmpDir . "myerp_users_list_t{$tenantId}_*.json") ?: [] as $f) {
                @unlink($f);
            }
            @unlink($tmpDir . "myerp_meta_creds_v3_t{$tenantId}.json");
            @unlink($tmpDir . "ideas_system_settings_t{$tenantId}.json");
        } else {
            self::$memCache = [];
            $GLOBALS['__system_settings_cache'] = [];
            foreach (glob($tmpDir . "myerp_tcfg_*.json") ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($tmpDir . "myerp_auth_u_*.json") ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($tmpDir . "myerp_users_list_*.json") ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($tmpDir . "myerp_meta_creds_v3_t*.json") ?: [] as $f) {
                @unlink($f);
            }
            foreach (glob($tmpDir . "ideas_system_settings_t*.json") ?: [] as $f) {
                @unlink($f);
            }
        }
        @unlink($tmpDir . "ideas_system_settings.json");
        @unlink($tmpDir . "ideas_fe_url.txt");
        @unlink($tmpDir . "myerp_tenant_origins_v2.json");
    }

    public static function ensureSchema(PDO $db, int $tenantId = 1): void
    {
        $drv = self::isSqlite($db) ? 'sqlite' : 'mysql';
        $lockKey = $drv . ':' . spl_object_id($db);
        if (empty(self::$schemaEnsured[$lockKey])) {
            self::$schemaEnsured[$lockKey] = true;
            if ($drv === 'sqlite') {
                self::ensureSqliteSchema($db);
            } else {
                self::ensureMysqlSchema($db);
            }
        }
        if ($tenantId > 0 && empty(self::$schemaEnsured[$lockKey . ':seed:' . $tenantId])) {
            self::$schemaEnsured[$lockKey . ':seed:' . $tenantId] = true;
            self::seedTenantDefaultsIfNeeded($db, $tenantId);
        }
    }

    private static function mysqlColumnExists(PDO $db, string $table, string $column): bool
    {
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return (int)$stmt->fetchColumn() > 0;
    }

    private static function ensureMysqlSchema(PDO $db): void
    {
        if ($db->inTransaction()) {
            return;
        }
        try {
            if (self::mysqlColumnExists($db, 'system_settings', 'setting_key')) {
                if (!self::mysqlColumnExists($db, 'system_settings', 'tenant_id')) {
                    $db->exec("ALTER TABLE system_settings ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 FIRST");
                }
                $stmtPk = $db->prepare("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX ASC");
                $stmtPk->execute();
                $pkCols = array_map('strtolower', $stmtPk->fetchAll(PDO::FETCH_COLUMN) ?: []);
                if ($pkCols !== ['tenant_id', 'setting_key']) {
                    try {
                        $db->exec("UPDATE system_settings SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id <= 0");
                    } catch (\Throwable $eNorm) {
                    }
                    try {
                        $stmtUniq = $db->prepare("
                            SELECT INDEX_NAME
                            FROM information_schema.STATISTICS
                            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings'
                              AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY'
                            GROUP BY INDEX_NAME
                            HAVING COUNT(*) = 1 AND MAX(LOWER(COLUMN_NAME)) = 'setting_key'
                        ");
                        $stmtUniq->execute();
                        foreach ($stmtUniq->fetchAll(PDO::FETCH_COLUMN) ?: [] as $uIdx) {
                            $safeIdx = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$uIdx);
                            if ($safeIdx !== '') {
                                $db->exec("ALTER TABLE system_settings DROP INDEX `{$safeIdx}`");
                            }
                        }
                    } catch (\Throwable $eUniq) {
                    }
                    try {
                        $stmtDup = $db->query("SELECT COUNT(*) FROM (SELECT tenant_id, setting_key FROM system_settings GROUP BY tenant_id, setting_key HAVING COUNT(*) > 1) dup_chk");
                        if ($stmtDup && (int)$stmtDup->fetchColumn() > 0) {
                            $db->exec("CREATE TEMPORARY TABLE tmp_ss_dedup AS SELECT tenant_id, setting_key, MAX(setting_value) AS setting_value FROM system_settings GROUP BY tenant_id, setting_key");
                            $db->exec("DELETE FROM system_settings");
                            $db->exec("INSERT INTO system_settings (tenant_id, setting_key, setting_value) SELECT tenant_id, setting_key, setting_value FROM tmp_ss_dedup");
                            $db->exec("DROP TEMPORARY TABLE IF EXISTS tmp_ss_dedup");
                        }
                    } catch (\Throwable $eDup) {
                    }
                    try {
                        $dropClause = !empty($pkCols) ? "DROP PRIMARY KEY, " : "";
                        $stmtHasLookup = $db->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'setting_key' AND SEQ_IN_INDEX = 1 AND INDEX_NAME != 'PRIMARY'");
                        $stmtHasLookup->execute();
                        $addIdxClause = ((int)$stmtHasLookup->fetchColumn() === 0) ? ", ADD INDEX idx_ss_key (setting_key)" : "";
                        $db->exec("ALTER TABLE system_settings MODIFY COLUMN tenant_id INT NOT NULL DEFAULT 1, {$dropClause}ADD PRIMARY KEY (tenant_id, setting_key){$addIdxClause}");
                    } catch (\Throwable $ePk) {
                        error_log('TenantConfigService::ensureMysqlSchema system_settings PK upgrade error: ' . $ePk->getMessage());
                    }
                }
            }

            if (self::mysqlColumnExists($db, 'teams', 'id')) {
                if (!self::mysqlColumnExists($db, 'teams', 'department_code')) {
                    $db->exec("ALTER TABLE teams ADD COLUMN department_code VARCHAR(50) NOT NULL DEFAULT 'sales' AFTER name");
                }
                if (!self::mysqlColumnExists($db, 'teams', 'is_sales_team')) {
                    $db->exec("ALTER TABLE teams ADD COLUMN is_sales_team TINYINT(1) NOT NULL DEFAULT 1 AFTER department_code");
                }
                if (!self::mysqlColumnExists($db, 'teams', 'default_approver_id')) {
                    $db->exec("ALTER TABLE teams ADD COLUMN default_approver_id INT NULL DEFAULT NULL AFTER co_leader_ids");
                }
                if (!self::mysqlColumnExists($db, 'teams', 'deleted_at')) {
                    $db->exec("ALTER TABLE teams ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
                }
            }

            if (self::mysqlColumnExists($db, 'pipeline_stages', 'id')) {
                if (!self::mysqlColumnExists($db, 'pipeline_stages', 'notify_config_json')) {
                    $db->exec("ALTER TABLE pipeline_stages ADD COLUMN notify_config_json LONGTEXT NULL DEFAULT NULL");
                }
                if (!self::mysqlColumnExists($db, 'pipeline_stages', 'deleted_at')) {
                    $db->exec("ALTER TABLE pipeline_stages ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
                }
            }

            if (self::mysqlColumnExists($db, 'tenants', 'id')) {
                $tenantExtraCols = [
                    'domain' => "VARCHAR(255) NULL DEFAULT NULL",
                    'support_email' => "VARCHAR(255) NULL DEFAULT NULL",
                    'support_hotline' => "VARCHAR(100) NULL DEFAULT NULL",
                    'academic_cc_emails' => "TEXT NULL DEFAULT NULL",
                    'lms_url' => "VARCHAR(500) NULL DEFAULT NULL",
                    'ai_platform_url' => "VARCHAR(500) NULL DEFAULT NULL",
                    'address' => "TEXT NULL DEFAULT NULL",
                    'tax_id' => "VARCHAR(100) NULL DEFAULT NULL",
                ];
                foreach ($tenantExtraCols as $col => $ddl) {
                    if (!self::mysqlColumnExists($db, 'tenants', $col)) {
                        $db->exec("ALTER TABLE tenants ADD COLUMN {$col} {$ddl}");
                    }
                }
            }

            $db->exec("CREATE TABLE IF NOT EXISTS tenant_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                role_slug VARCHAR(50) NOT NULL,
                name VARCHAR(120) NOT NULL,
                description VARCHAR(255) NULL DEFAULT NULL,
                role_group VARCHAR(50) NOT NULL DEFAULT 'staff',
                default_route VARCHAR(120) NOT NULL DEFAULT '/',
                can_self_approve TINYINT(1) NOT NULL DEFAULT 0,
                is_system TINYINT(1) NOT NULL DEFAULT 0,
                permissions_json LONGTEXT NULL DEFAULT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_tenant_role (tenant_id, role_slug),
                INDEX idx_tr_tenant (tenant_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS tenant_approval_workflows (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                module_key VARCHAR(60) NOT NULL,
                name VARCHAR(150) NOT NULL,
                description VARCHAR(255) NULL DEFAULT NULL,
                levels_config LONGTEXT NOT NULL,
                allow_creator_self_approve TINYINT(1) NOT NULL DEFAULT 0,
                auto_approve_for_executives TINYINT(1) NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_tenant_approval_wf (tenant_id, module_key),
                INDEX idx_taw_tenant (tenant_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS tenant_notification_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                event_key VARCHAR(80) NOT NULL,
                name VARCHAR(150) NOT NULL,
                description VARCHAR(255) NULL DEFAULT NULL,
                recipient_strategy VARCHAR(50) NOT NULL DEFAULT 'combined',
                target_roles_json TEXT NULL DEFAULT NULL,
                target_departments_json TEXT NULL DEFAULT NULL,
                target_user_ids_json TEXT NULL DEFAULT NULL,
                include_owner TINYINT(1) NOT NULL DEFAULT 0,
                include_team_leader TINYINT(1) NOT NULL DEFAULT 0,
                cc_emails TEXT NULL DEFAULT NULL,
                channels_json TEXT NULL DEFAULT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_tenant_notif_rule (tenant_id, event_key),
                INDEX idx_tnr_tenant (tenant_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS tenant_student_tabs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                tab_key VARCHAR(60) NOT NULL,
                label VARCHAR(120) NOT NULL,
                badge_key VARCHAR(60) NULL DEFAULT NULL,
                stage_slugs_json TEXT NULL DEFAULT NULL,
                include_customer_status TINYINT(1) NOT NULL DEFAULT 0,
                order_index INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_tenant_student_tab (tenant_id, tab_key),
                INDEX idx_tst_tenant (tenant_id, order_index)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS tenant_academic_programs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                program_code VARCHAR(80) NOT NULL,
                name VARCHAR(200) NOT NULL,
                school_name VARCHAR(150) NULL DEFAULT NULL,
                template_key VARCHAR(80) NULL DEFAULT NULL,
                match_keywords_json TEXT NULL DEFAULT NULL,
                doc_folder_url VARCHAR(500) NULL DEFAULT NULL,
                lms_url VARCHAR(500) NULL DEFAULT NULL,
                partner_portal_url VARCHAR(500) NULL DEFAULT NULL,
                ai_platform_url VARCHAR(500) NULL DEFAULT NULL,
                curriculum_json LONGTEXT NULL DEFAULT NULL,
                order_index INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_tenant_acad_prog (tenant_id, program_code),
                INDEX idx_tap_tenant (tenant_id, order_index)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS tenant_email_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                template_key VARCHAR(80) NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT 'academic',
                name VARCHAR(200) NOT NULL,
                subject VARCHAR(500) NOT NULL DEFAULT '',
                body_html LONGTEXT NULL DEFAULT NULL,
                body_text LONGTEXT NULL DEFAULT NULL,
                cc_emails TEXT NULL DEFAULT NULL,
                variables_json TEXT NULL DEFAULT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_tenant_email_tpl (tenant_id, template_key),
                INDEX idx_tet_tenant (tenant_id, category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } catch (\Throwable $e) {
            error_log('TenantConfigService::ensureMysqlSchema error: ' . $e->getMessage());
        }
    }

    private static function ensureSqliteSchema(PDO $db): void
    {
        $db->exec("CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE,
            plan TEXT DEFAULT 'enterprise',
            logo_url TEXT,
            primary_color TEXT DEFAULT '#BD1D2D',
            currency TEXT DEFAULT 'VND',
            timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
            domain TEXT,
            support_email TEXT,
            support_hotline TEXT,
            academic_cc_emails TEXT,
            lms_url TEXT,
            ai_platform_url TEXT,
            address TEXT,
            tax_id TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS system_settings (
            tenant_id INTEGER NOT NULL DEFAULT 1,
            setting_key TEXT NOT NULL,
            setting_value TEXT,
            PRIMARY KEY (tenant_id, setting_key)
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            username TEXT,
            email TEXT,
            password_hash TEXT,
            full_name TEXT,
            phone TEXT,
            avatar_url TEXT,
            signature_url TEXT,
            dob TEXT,
            gender TEXT,
            citizen_id TEXT,
            address TEXT,
            bank_name TEXT,
            bank_account TEXT,
            job_title TEXT,
            role TEXT DEFAULT 'sales',
            department TEXT,
            team_id INTEGER,
            permissions_json TEXT,
            manager_behavior_mode TEXT DEFAULT 'combined',
            two_factor_enabled INTEGER DEFAULT 0,
            two_factor_type TEXT DEFAULT 'email',
            bio TEXT,
            extra_fields_json TEXT,
            work_start_time TEXT,
            work_end_time TEXT,
            work_schedule TEXT,
            vacation_mode INTEGER DEFAULT 0,
            overtime_mode INTEGER DEFAULT 0,
            use_custom_work_hours INTEGER DEFAULT 0,
            leave_start TEXT,
            leave_end TEXT,
            zalo_chat_id TEXT,
            telegram_chat_id TEXT,
            is_active INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active',
            last_login_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT
        )");
        $sqliteUserExtraCols = [
            'phone' => 'TEXT',
            'avatar_url' => 'TEXT',
            'signature_url' => 'TEXT',
            'dob' => 'TEXT',
            'gender' => 'TEXT',
            'citizen_id' => 'TEXT',
            'address' => 'TEXT',
            'bank_name' => 'TEXT',
            'bank_account' => 'TEXT',
            'two_factor_enabled' => 'INTEGER DEFAULT 0',
            'two_factor_type' => "TEXT DEFAULT 'email'",
            'bio' => 'TEXT',
            'extra_fields_json' => 'TEXT',
            'work_start_time' => 'TEXT',
            'work_end_time' => 'TEXT',
            'work_schedule' => 'TEXT',
            'vacation_mode' => 'INTEGER DEFAULT 0',
            'overtime_mode' => 'INTEGER DEFAULT 0',
            'use_custom_work_hours' => 'INTEGER DEFAULT 0',
            'leave_start' => 'TEXT',
            'leave_end' => 'TEXT',
            'last_login_at' => 'TEXT',
            'created_at' => 'TEXT DEFAULT CURRENT_TIMESTAMP',
            'deleted_at' => 'TEXT',
        ];
        try {
            $existingUserCols = [];
            foreach ($db->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC) ?: [] as $ci) {
                $existingUserCols[strtolower((string)$ci['name'])] = true;
            }
            foreach ($sqliteUserExtraCols as $uCol => $uDdl) {
                if (empty($existingUserCols[$uCol])) {
                    $db->exec("ALTER TABLE users ADD COLUMN {$uCol} {$uDdl}");
                }
            }
        } catch (\Throwable $e) {
        }
        $db->exec("CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            name TEXT NOT NULL,
            department_code TEXT NOT NULL DEFAULT 'sales',
            is_sales_team INTEGER NOT NULL DEFAULT 1,
            avatar_url TEXT,
            leader_id INTEGER,
            co_leader_ids TEXT,
            default_approver_id INTEGER,
            branch TEXT,
            description TEXT,
            kpi_target REAL,
            max_members INTEGER,
            focus_project TEXT,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS pipeline_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            order_index INTEGER DEFAULT 0,
            is_won INTEGER DEFAULT 0,
            is_lost INTEGER DEFAULT 0,
            system_slug TEXT,
            definition TEXT,
            target_goal TEXT,
            sales_actions TEXT,
            exit_criteria TEXT,
            notify_config_json TEXT,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS tenant_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            role_slug TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            role_group TEXT NOT NULL DEFAULT 'staff',
            default_route TEXT NOT NULL DEFAULT '/',
            can_self_approve INTEGER NOT NULL DEFAULT 0,
            is_system INTEGER NOT NULL DEFAULT 0,
            permissions_json TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, role_slug)
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS tenant_approval_workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            module_key TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            levels_config TEXT NOT NULL,
            allow_creator_self_approve INTEGER NOT NULL DEFAULT 0,
            auto_approve_for_executives INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, module_key)
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS tenant_notification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            event_key TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            recipient_strategy TEXT NOT NULL DEFAULT 'combined',
            target_roles_json TEXT,
            target_departments_json TEXT,
            target_user_ids_json TEXT,
            include_owner INTEGER NOT NULL DEFAULT 0,
            include_team_leader INTEGER NOT NULL DEFAULT 0,
            cc_emails TEXT,
            channels_json TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, event_key)
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS tenant_student_tabs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            tab_key TEXT NOT NULL,
            label TEXT NOT NULL,
            badge_key TEXT,
            stage_slugs_json TEXT,
            include_customer_status INTEGER NOT NULL DEFAULT 0,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, tab_key)
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS tenant_academic_programs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            program_code TEXT NOT NULL,
            name TEXT NOT NULL,
            school_name TEXT,
            template_key TEXT,
            match_keywords_json TEXT,
            doc_folder_url TEXT,
            lms_url TEXT,
            partner_portal_url TEXT,
            ai_platform_url TEXT,
            curriculum_json TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, program_code)
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS tenant_email_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            template_key TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'academic',
            name TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT '',
            body_html TEXT,
            body_text TEXT,
            cc_emails TEXT,
            variables_json TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, template_key)
        )");
    }

    public static function classifyDepartmentCode(string $name, int $teamId = 0, int $tenantId = 1): array
    {
        $n = mb_strtolower(trim($name), 'UTF-8');
        $isLegacyTenant = ($tenantId === 1);
        if (($isLegacyTenant && $teamId === 1) || str_contains($n, 'nhân sự') || str_contains($n, 'hành chính') || str_contains($n, 'hcns') || $n === 'hr') {
            return ['hr', 0];
        }
        if (($isLegacyTenant && $teamId === 2) || str_contains($n, 'kế toán') || str_contains($n, 'tài chính') || str_contains($n, 'finance')) {
            return ['finance', 0];
        }
        if (($isLegacyTenant && $teamId === 3) || str_contains($n, 'marketing') || str_contains($n, 'truyền thông') || $n === 'mkt') {
            return ['marketing', 0];
        }
        if (($isLegacyTenant && $teamId === 5) || str_contains($n, 'học vụ') || str_contains($n, 'học thuật') || str_contains($n, 'đào tạo') || str_contains($n, 'academic') || str_contains($n, 'giảng viên')) {
            return ['academic', 0];
        }
        if (($isLegacyTenant && $teamId === 99983) || str_contains($n, 'giám đốc') || str_contains($n, 'ban lãnh đạo') || str_contains($n, 'executive') || str_contains($n, 'board')) {
            return ['executive', 0];
        }
        if (str_contains($n, 'cskh') || str_contains($n, 'support') || str_contains($n, 'chăm sóc')) {
            return ['support', 0];
        }
        return ['sales', 1];
    }

    private static function buildScopeMap(string $defaultRead, string $defaultWrite, string $defaultDelete, string $defaultApprove, array $overrides = []): array
    {
        $matrix = [];
        foreach (self::MODULES as $mod) {
            $matrix[$mod] = [
                'read' => $defaultRead,
                'write' => $defaultWrite,
                'delete' => $defaultDelete,
                'approve' => $defaultApprove,
            ];
        }
        $matrix['users']['read'] = $overrides['users']['read'] ?? 'all';
        foreach ($overrides as $mod => $ops) {
            if (!isset($matrix[$mod])) {
                $matrix[$mod] = ['read' => 'none', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'];
            }
            foreach ($ops as $k => $v) {
                $matrix[$mod][$k] = $v;
            }
        }
        return $matrix;
    }

    public static function defaultRoleDefinitions(): array
    {
        return [
            [
                'role_slug' => 'superadmin',
                'name' => 'Super Admin',
                'description' => 'Toàn quyền quản trị hệ thống và cấu hình Tenant',
                'role_group' => 'system_admin',
                'default_route' => '/',
                'can_self_approve' => 1,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('all', 'all', 'all', 'all'),
            ],
            [
                'role_slug' => 'admin',
                'name' => 'Quản trị viên (Admin)',
                'description' => 'Quản trị toàn diện các phân hệ của doanh nghiệp',
                'role_group' => 'system_admin',
                'default_route' => '/',
                'can_self_approve' => 1,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('all', 'all', 'all', 'all'),
            ],
            [
                'role_slug' => 'director',
                'name' => 'Ban Giám đốc (Director)',
                'description' => 'Điều hành toàn công ty và phê duyệt cấp cao',
                'role_group' => 'executive',
                'default_route' => '/',
                'can_self_approve' => 1,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('all', 'all', 'all', 'all', [
                    'settings' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                ]),
            ],
            [
                'role_slug' => 'manager',
                'name' => 'Trưởng phòng / Quản lý (Manager)',
                'description' => 'Quản lý dữ liệu và phê duyệt trong phạm vi phòng ban/nhóm',
                'role_group' => 'management',
                'default_route' => '/',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('team', 'team', 'none', 'team', [
                    'users' => ['read' => 'team', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'settings' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'marketing' => ['read' => 'none', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'sale_admin',
                'name' => 'Sale Admin',
                'description' => 'Điều phối hồ sơ, hợp đồng, đối soát sales và hỗ trợ vận hành',
                'role_group' => 'sales',
                'default_route' => '/',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'team'],
                    'contacts' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'all'],
                    'students' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'team'],
                    'deals' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'team'],
                    'leads' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'team'],
                    'projects' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'campaigns' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'schedules' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'companies' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'products' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'quotes' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'team'],
                    'invoices' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'sales_orders' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'all'],
                    'deposits' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'expenses' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'cooperations' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'all'],
                    'attendance' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'approvals' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'team'],
                    'tickets' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'team'],
                    'gatekeeper' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'files' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'reports' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'teams' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'ai' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'sales',
                'name' => 'Chuyên viên Tư vấn (Sales)',
                'description' => 'Chăm sóc Lead, cơ hội bán hàng và học viên phụ trách',
                'role_group' => 'sales',
                'default_route' => '/',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'contacts' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'students' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'deals' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'leads' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'projects' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'schedules' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'companies' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'products' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'quotes' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'sales_orders' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'deposits' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'expenses' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'cooperations' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'attendance' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'approvals' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'tickets' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'files' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'reports' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'ai' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'marketing',
                'name' => 'Chuyên viên Marketing',
                'description' => 'Quản lý chiến dịch, Automation, CAPI, phân khúc và nguồn Lead',
                'role_group' => 'marketing',
                'default_route' => '/marketing',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'leads' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'contacts' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'students' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'deals' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'campaigns' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'projects' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'schedules' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'companies' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'products' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'expenses' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'attendance' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'approvals' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'tickets' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'gatekeeper' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'marketing' => ['read' => 'all', 'write' => 'all', 'delete' => 'all', 'approve' => 'all'],
                    'files' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'reports' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'teams' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'settings' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'ai' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'accountant',
                'name' => 'Kế toán & Tài chính (Accountant)',
                'description' => 'Quản lý thu chi, đặt cọc, hóa đơn, PO/SO, dòng tiền và thuế',
                'role_group' => 'finance',
                'default_route' => '/financial-dashboard',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'contacts' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'students' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'deals' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'projects' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'campaigns' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'schedules' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'companies' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'suppliers' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'products' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'inventory' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'quotes' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'invoices' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'sales_orders' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'purchase_orders' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'deposits' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'expenses' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'finance' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'cooperations' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'hrm' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'attendance' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'approvals' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'tickets' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'files' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'reports' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'ai' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'hr',
                'name' => 'Hành chính - Nhân sự (HR)',
                'description' => 'Quản lý hồ sơ nhân sự, chấm công, nghỉ phép, bảng lương và tài sản',
                'role_group' => 'hr',
                'default_route' => '/hrm',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'projects' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'schedules' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'companies' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'suppliers' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'inventory' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'expenses' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'team'],
                    'hrm' => ['read' => 'all', 'write' => 'all', 'delete' => 'all', 'approve' => 'all'],
                    'attendance' => ['read' => 'all', 'write' => 'all', 'delete' => 'all', 'approve' => 'all'],
                    'approvals' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'tickets' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'files' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'none'],
                    'reports' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all'],
                    'teams' => ['read' => 'all', 'write' => 'all', 'delete' => 'all', 'approve' => 'none'],
                    'ai' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'academic',
                'name' => 'Học vụ & Đào tạo (Academic)',
                'description' => 'Quản lý học viên, lớp học, lịch giảng, điểm số và bảo lưu',
                'role_group' => 'academic',
                'default_route' => '/workspace',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'contacts' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'students' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'leads' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'deals' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'projects' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'campaigns' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'schedules' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'companies' => ['read' => 'all', 'write' => 'all', 'delete' => 'all', 'approve' => 'none'],
                    'files' => ['read' => 'all', 'write' => 'all', 'delete' => 'own', 'approve' => 'none'],
                    'expenses' => ['read' => 'own', 'write' => 'own', 'delete' => 'own', 'approve' => 'none'],
                    'attendance' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'approvals' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'tickets' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'reports' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'ai' => ['read' => 'own', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'assistant',
                'name' => 'Trợ lý Ban Giám đốc (Assistant)',
                'description' => 'Hỗ trợ điều phối vận hành liên phòng ban',
                'role_group' => 'management',
                'default_route' => '/',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('all', 'all', 'none', 'team', [
                    'users' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'teams' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'hrm' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'finance' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'invoices' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'purchase_orders' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'none'],
                    'settings' => ['read' => 'none', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'marketing' => ['read' => 'none', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
            [
                'role_slug' => 'viewer',
                'name' => 'Người xem (Viewer)',
                'description' => 'Chỉ xem dữ liệu được cấp quyền, không chỉnh sửa hoặc xóa',
                'role_group' => 'viewer',
                'default_route' => '/workspace',
                'can_self_approve' => 0,
                'is_system' => 1,
                'permissions' => self::buildScopeMap('none', 'none', 'none', 'none', [
                    'dashboard' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'workspace' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'students' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'projects' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'schedules' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'companies' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'files' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'attendance' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'approvals' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                    'users' => ['read' => 'own', 'write' => 'none', 'delete' => 'none', 'approve' => 'none'],
                ]),
            ],
        ];
    }

    public static function defaultApprovalWorkflows(): array
    {
        return [
            [
                'module_key' => 'leave',
                'name' => 'Nghỉ phép & Công tác',
                'description' => 'Cấp 1: Trưởng bộ phận trực tiếp -> Fallback: Trưởng phòng HC-NS / Giám đốc',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 1,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'team_leader', 'fallback_department' => 'hr', 'fallback_roles' => ['hr', 'director']],
                    'level_2' => ['enabled' => false, 'type' => 'role', 'roles' => ['hr']],
                    'watcher_roles' => ['hr'],
                ],
            ],
            [
                'module_key' => 'attendance',
                'name' => 'Giải trình Chấm công & Bổ sung công',
                'description' => 'Cấp 1: Trưởng bộ phận trực tiếp -> Cấp 2 (nếu bật): HC-NS',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 1,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'team_leader', 'fallback_department' => 'hr', 'fallback_roles' => ['hr', 'director']],
                    'level_2' => ['enabled' => false, 'type' => 'department_head', 'department' => 'hr', 'roles' => ['hr']],
                    'watcher_roles' => ['hr'],
                ],
            ],
            [
                'module_key' => 'advance',
                'name' => 'Tạm ứng lương',
                'description' => 'Cấp 1: Trưởng bộ phận -> Cấp 2: Kế toán -> Cấp 3: Giám đốc',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'team_leader', 'fallback_roles' => ['hr', 'manager']],
                    'level_2' => ['enabled' => true, 'type' => 'department_head', 'department' => 'finance', 'roles' => ['accountant']],
                    'level_3' => ['enabled' => false, 'type' => 'role', 'roles' => ['director']],
                    'watcher_roles' => ['hr', 'accountant'],
                ],
            ],
            [
                'module_key' => 'expense',
                'name' => 'Đề nghị Thanh toán / Chi phí',
                'description' => 'Phê duyệt đa cấp theo hạn mức số tiền: Trưởng bộ phận -> Kế toán -> Ban Giám đốc',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'team_leader', 'fallback_roles' => ['manager', 'accountant']],
                    'level_2' => ['enabled' => true, 'type' => 'department_head', 'department' => 'finance', 'roles' => ['accountant']],
                    'level_3' => ['enabled' => true, 'type' => 'role', 'roles' => ['director', 'admin'], 'min_amount' => 10000000],
                    'money_tiers' => [
                        ['max_amount' => 5000000, 'approver_type' => 'team_leader', 'roles' => ['manager', 'accountant']],
                        ['max_amount' => 20000000, 'approver_type' => 'role', 'roles' => ['accountant', 'director']],
                        ['max_amount' => null, 'approver_type' => 'role', 'roles' => ['director', 'admin']],
                    ],
                    'watcher_roles' => ['accountant'],
                ],
            ],
            [
                'module_key' => 'deposit',
                'name' => 'Xác nhận Đặt cọc & Đợt thu học phí',
                'description' => 'Kế toán đối soát UNC và xác nhận thu tiền (Chặn tự duyệt phiếu của chính mình)',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => false,
                    'level_1' => ['type' => 'department_head', 'department' => 'finance', 'roles' => ['accountant']],
                    'watcher_roles' => ['director', 'sale_admin'],
                ],
            ],
            [
                'module_key' => 'purchase_order',
                'name' => 'Đơn Mua hàng (Purchase Order - PO)',
                'description' => 'Trưởng bộ phận -> Kế toán -> Ban Giám đốc theo ngưỡng giá trị PO',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'team_leader', 'fallback_roles' => ['manager']],
                    'level_2' => ['enabled' => true, 'type' => 'department_head', 'department' => 'finance', 'roles' => ['accountant']],
                    'level_3' => ['enabled' => true, 'type' => 'role', 'roles' => ['director']],
                    'watcher_roles' => ['accountant'],
                ],
            ],
            [
                'module_key' => 'sales_order',
                'name' => 'Đơn Bán hàng (Sales Order - SO)',
                'description' => 'Quản lý kinh doanh / Kế toán xác nhận đơn hàng',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'role', 'roles' => ['accountant', 'director', 'sale_admin']],
                    'watcher_roles' => ['director'],
                ],
            ],
            [
                'module_key' => 'cooperation',
                'name' => 'Phiếu Đồng chia Doanh số (Cooperation Slip)',
                'description' => 'Các thành viên ký xác nhận tỷ lệ và Quản lý / Giám đốc phê duyệt',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => true,
                    'level_1' => ['type' => 'role', 'roles' => ['director', 'sale_admin', 'manager']],
                    'watcher_roles' => ['sale_admin'],
                ],
            ],
            [
                'module_key' => 'commission',
                'name' => 'Quyết toán Hoa hồng',
                'description' => 'Sale Admin / Kế toán kiểm tra và Ban Giám đốc duyệt chi',
                'allow_creator_self_approve' => 1,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => false,
                    'level_1' => ['type' => 'department_head', 'department' => 'finance', 'roles' => ['accountant']],
                    'level_2' => ['enabled' => true, 'type' => 'role', 'roles' => ['director']],
                    'watcher_roles' => ['sale_admin', 'accountant'],
                ],
            ],
            [
                'module_key' => 'payroll',
                'name' => 'Chốt Bảng lương Tháng',
                'description' => 'HC-NS lập bảng lương -> Kế toán kiểm tra -> Ban Giám đốc khóa sổ',
                'allow_creator_self_approve' => 0,
                'auto_approve_for_executives' => 0,
                'levels_config' => [
                    'enable_team_leader' => false,
                    'level_1' => ['type' => 'role', 'roles' => ['hr', 'accountant']],
                    'level_2' => ['enabled' => true, 'type' => 'role', 'roles' => ['director', 'admin']],
                    'watcher_roles' => ['hr', 'accountant'],
                ],
            ],
        ];
    }

    public static function defaultNotificationRules(): array
    {
        return [
            [
                'event_key' => 'PIPELINE_STAGE_APPLICATION_STARTED',
                'name' => 'Chuyển giai đoạn: Nộp hồ sơ (Application Started)',
                'description' => 'Thông báo tiếp nhận kiểm tra hồ sơ đăng ký xét tuyển',
                'recipient_strategy' => 'roles',
                'target_roles' => ['sale_admin'],
                'target_departments' => [],
                'include_owner' => 0,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => false, 'zalo' => true, 'telegram' => false],
            ],
            [
                'event_key' => 'PIPELINE_STAGE_APPLICATION_COMPLETED',
                'name' => 'Chuyển giai đoạn: Hoàn tất hồ sơ (Application Completed)',
                'description' => 'Thông báo hồ sơ đã đầy đủ sẵn sàng xét duyệt học thuật',
                'recipient_strategy' => 'roles',
                'target_roles' => ['director'],
                'target_departments' => [],
                'include_owner' => 0,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => false, 'zalo' => true, 'telegram' => false],
            ],
            [
                'event_key' => 'PIPELINE_STAGE_DEPOSIT_PAYMENT',
                'name' => 'Chuyển giai đoạn: Đóng lệ phí / Học phí (Deposit & Tuition)',
                'description' => 'Thông báo đối soát lệ phí hồ sơ & học phí đầu khóa',
                'recipient_strategy' => 'combined',
                'target_roles' => ['director', 'sale_admin', 'accountant'],
                'target_departments' => ['finance'],
                'include_owner' => 0,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => true, 'zalo' => true, 'telegram' => false],
            ],
            [
                'event_key' => 'PIPELINE_STAGE_ENROLLED',
                'name' => 'Bàn giao Học viên Chính thức (Enrolled Handover)',
                'description' => 'Thông báo bàn giao tân học viên cho bộ phận Học vụ & Ban Giám đốc',
                'recipient_strategy' => 'combined',
                'target_roles' => ['director', 'academic'],
                'target_departments' => ['academic'],
                'include_owner' => 0,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => true, 'zalo' => true, 'telegram' => false],
            ],
            [
                'event_key' => 'STUDENT_STUDY_STATUS_CHANGED',
                'name' => 'Thay đổi Trạng thái Học tập (Bảo lưu / Học lại / Tốt nghiệp)',
                'description' => 'Thông báo cho TVV phụ trách và Ban Giám đốc khi học viên đổi trạng thái học tập',
                'recipient_strategy' => 'combined',
                'target_roles' => ['director'],
                'target_departments' => ['academic'],
                'include_owner' => 1,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => true, 'zalo' => false, 'telegram' => false],
            ],
            [
                'event_key' => 'ACADEMIC_1ON1_BOOKED',
                'name' => 'Học viên Đặt lịch Hướng dẫn 1:1 với Giảng viên',
                'description' => 'Thông báo cho Học vụ phụ trách và Ban Giám đốc khi học viên đặt ca 1:1',
                'recipient_strategy' => 'combined',
                'target_roles' => ['director', 'academic'],
                'target_departments' => ['academic'],
                'include_owner' => 1,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => true, 'zalo' => false, 'telegram' => false],
            ],
            [
                'event_key' => 'DEPOSIT_CREATED',
                'name' => 'Tạo Phiếu Đặt cọc / Đợt thu mới',
                'description' => 'Thông báo cho Kế toán duyệt và người liên quan theo dõi',
                'recipient_strategy' => 'combined',
                'target_roles' => ['accountant'],
                'target_departments' => ['finance'],
                'include_owner' => 1,
                'include_team_leader' => 0,
                'channels' => ['bell' => true, 'email' => true, 'zalo' => true, 'telegram' => false],
            ],
            [
                'event_key' => 'DATA_ERROR_REPORTED',
                'name' => 'Báo lỗi Data Lead (Data Error Report)',
                'description' => 'Thông báo cho Marketing / Admin kiểm duyệt báo lỗi data',
                'recipient_strategy' => 'roles',
                'target_roles' => ['admin', 'marketing', 'sale_admin'],
                'target_departments' => ['marketing'],
                'include_owner' => 0,
                'include_team_leader' => 1,
                'channels' => ['bell' => true, 'email' => false, 'zalo' => true, 'telegram' => false],
            ],
        ];
    }

    public static function defaultStudentTabs(): array
    {
        return [
            [
                'tab_key' => 'chinh_thuc',
                'label' => 'Học viên chính thức',
                'badge_key' => 'chinhThuc',
                'stage_slugs' => ['enrolled', 'hoc_vien', 'won'],
                'include_customer_status' => 1,
                'order_index' => 1,
            ],
            [
                'tab_key' => 'le_phi',
                'label' => 'Lệ phí hồ sơ',
                'badge_key' => 'lePhi',
                'stage_slugs' => ['deposit_tuition_payment', 'dong_le_phi_ho_so', 'dong_le_phi'],
                'include_customer_status' => 0,
                'order_index' => 2,
            ],
            [
                'tab_key' => 'nop_ho_so',
                'label' => 'Nộp hồ sơ',
                'badge_key' => 'nopHoSo',
                'stage_slugs' => ['application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'],
                'include_customer_status' => 0,
                'order_index' => 3,
            ],
        ];
    }

    public static function defaultPipelineStages(): array
    {
        return [
            ['name' => '01 – New Lead', 'system_slug' => 'new_lead', 'color' => '#dc2626', 'order_index' => 1, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '02 – Contacting', 'system_slug' => 'contacting', 'color' => '#f97316', 'order_index' => 2, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '03 – Connected', 'system_slug' => 'connected', 'color' => '#eab308', 'order_index' => 3, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '04 – Needed', 'system_slug' => 'needed', 'color' => '#84cc16', 'order_index' => 4, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '05 – Qualified', 'system_slug' => 'qualified', 'color' => '#10b981', 'order_index' => 5, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '06 – Consulting', 'system_slug' => 'consulting', 'color' => '#06b6d4', 'order_index' => 6, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '07 – Proposal Sent', 'system_slug' => 'proposal_sent', 'color' => '#0ea5e9', 'order_index' => 7, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '08 – Follow-up / Considering', 'system_slug' => 'considering', 'color' => '#3b82f6', 'order_index' => 8, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '09 – Application Started', 'system_slug' => 'application_started', 'color' => '#6366f1', 'order_index' => 9, 'is_won' => 0, 'is_lost' => 0, 'notify' => ['roles' => ['sale_admin']]],
            ['name' => '10 – Application Completed', 'system_slug' => 'application_completed', 'color' => '#8b5cf6', 'order_index' => 10, 'is_won' => 0, 'is_lost' => 0, 'notify' => ['roles' => ['director']]],
            ['name' => '11 – Admission Approved', 'system_slug' => 'admission_approved', 'color' => '#a855f7', 'order_index' => 11, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '12 – Offer Accepted', 'system_slug' => 'offer_accepted', 'color' => '#d946ef', 'order_index' => 12, 'is_won' => 0, 'is_lost' => 0],
            ['name' => '13 – Deposit / Tuition Payment', 'system_slug' => 'deposit_tuition_payment', 'color' => '#ec4899', 'order_index' => 13, 'is_won' => 0, 'is_lost' => 0, 'notify' => ['roles' => ['director', 'sale_admin']]],
            ['name' => '14 – Enrolled', 'system_slug' => 'enrolled', 'color' => '#db2777', 'order_index' => 14, 'is_won' => 1, 'is_lost' => 0, 'notify' => ['roles' => ['director'], 'departments' => ['academic']]],
        ];
    }

    public static function defaultAcademicPrograms(int $tenantId = 1): array
    {
        if ($tenantId > 1) {
            return [
                [
                    'program_code' => 'standard_program',
                    'name' => 'Chương trình Đào tạo Chuẩn',
                    'school_name' => '',
                    'template_key' => 'student_onboarding_standard',
                    'match_keywords' => ['standard', 'chương trình chuẩn'],
                    'doc_folder_url' => '',
                    'partner_portal_url' => '',
                    'order_index' => 1,
                    'curriculum' => [],
                ],
            ];
        }
        return [
            [
                'program_code' => 'mba_standard',
                'name' => 'MBA (HIGH _ STAND)',
                'school_name' => 'Đại học Swiss UMEF',
                'template_key' => 'student_onboarding_standard',
                'match_keywords' => ['mba', 'mba standard', 'mba (high _ stand)'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1dvILnySA3MWKR-LutdrdXyrJPqL6ppcy',
                'partner_portal_url' => 'https://portal.swiss-umef.ch/',
                'order_index' => 1,
                'curriculum' => [
                    ['code' => 'MBA-HS-01', 'name' => 'Accounting for Managers course', 'credits' => 3],
                    ['code' => 'MBA-HS-02', 'name' => 'Project management', 'credits' => 3],
                    ['code' => 'MBA-HS-03', 'name' => 'Marketing management', 'credits' => 3],
                    ['code' => 'MBA-HS-04', 'name' => 'Corporate finance', 'credits' => 3],
                    ['code' => 'MBA-HS-05', 'name' => 'Strategy Management', 'credits' => 3],
                    ['code' => 'MBA-HS-06', 'name' => 'Entrepreneurship and innovation', 'credits' => 3],
                    ['code' => 'MBA-HS-07', 'name' => 'Human capital and talent management', 'credits' => 3],
                    ['code' => 'MBA-HS-08', 'name' => 'Digital transformation', 'credits' => 3],
                    ['code' => 'MBA-HS-09', 'name' => 'Organizational Behavior', 'credits' => 3],
                    ['code' => 'MBA-HS-10', 'name' => 'Leadership Development', 'credits' => 3],
                    ['code' => 'MBA-HS-11', 'name' => 'AI in Business Decision Making', 'credits' => 3],
                    ['code' => 'MBA-HS-12', 'name' => 'Research Methodology', 'credits' => 3],
                    ['code' => 'MBA-HS-13', 'name' => 'MBA THESIS', 'credits' => 6],
                ],
            ],
            [
                'program_code' => 'mba_high',
                'name' => 'EMBA (HIGH _ STAND)',
                'school_name' => 'Đại học Swiss UMEF',
                'template_key' => 'student_onboarding_standard',
                'match_keywords' => ['emba', 'high', 'nâng cao', 'hq'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1FAJL1opSbPEOx9CL1L1QMiug3mfRdRWX',
                'partner_portal_url' => 'https://portal.swiss-umef.ch/',
                'order_index' => 2,
                'curriculum' => [
                    ['code' => 'EMBA-HS-01', 'name' => 'Accounting for Managers course', 'credits' => 3],
                    ['code' => 'EMBA-HS-02', 'name' => 'Project management', 'credits' => 3],
                    ['code' => 'EMBA-HS-03', 'name' => 'Marketing management', 'credits' => 3],
                    ['code' => 'EMBA-HS-04', 'name' => 'Corporate finance', 'credits' => 3],
                    ['code' => 'EMBA-HS-05', 'name' => 'Strategy Management', 'credits' => 3],
                    ['code' => 'EMBA-HS-06', 'name' => 'Entrepreneurship and innovation', 'credits' => 3],
                    ['code' => 'EMBA-HS-07', 'name' => 'Human capital and talent management', 'credits' => 3],
                    ['code' => 'EMBA-HS-08', 'name' => 'Digital transformation', 'credits' => 3],
                    ['code' => 'EMBA-HS-09', 'name' => 'Organizational Behavior', 'credits' => 3],
                    ['code' => 'EMBA-HS-10', 'name' => 'Leadership Development', 'credits' => 3],
                ],
            ],
            [
                'program_code' => 'msc_ai',
                'name' => 'MSC - AI',
                'school_name' => 'Đại học Swiss UMEF',
                'template_key' => 'student_onboarding_standard',
                'match_keywords' => ['msc', 'ai', 'trí tuệ nhân tạo'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1Byi7lmVQsm9sSD-OGKSHli1FfsnsvkXr',
                'partner_portal_url' => 'https://portal.swiss-umef.ch/',
                'order_index' => 3,
                'curriculum' => [
                    ['code' => 'MSC-AI-01', 'name' => 'Artificial Intelligence and Machine Learning', 'credits' => 3],
                    ['code' => 'MSC-AI-02', 'name' => 'Big Data Analytics', 'credits' => 3],
                    ['code' => 'MSC-AI-03', 'name' => 'Digital and Computer Vision', 'credits' => 3],
                    ['code' => 'MSC-AI-04', 'name' => 'Cyber-Physical Systems and IoT', 'credits' => 3],
                    ['code' => 'MSC-AI-05', 'name' => 'Reinforcement Learning and AI Optimization', 'credits' => 3],
                    ['code' => 'MSC-AI-06', 'name' => 'AI in Business Decision Making', 'credits' => 3],
                    ['code' => 'MSC-AI-07', 'name' => 'Economic Forecasting and AI-Driven Market Dynamics', 'credits' => 3],
                    ['code' => 'MSC-AI-08', 'name' => 'Research Methodology', 'credits' => 3],
                    ['code' => 'MSC-AI-09', 'name' => 'AI Innovation and Entrepreneurship', 'credits' => 3],
                    ['code' => 'MSC-AI-10', 'name' => 'Advanced Project Management in AI', 'credits' => 3],
                    ['code' => 'MSC-AI-11', 'name' => 'Change management strategies for AI transition', 'credits' => 3],
                    ['code' => 'MSC-AI-12', 'name' => 'Global AI policies and regulatory frameworks', 'credits' => 3],
                    ['code' => 'MSC-AI-13', 'name' => 'CAPSTONE PROJECT', 'credits' => 6],
                ],
            ],
            [
                'program_code' => 'mba_in_ai',
                'name' => 'MBA IN AI',
                'school_name' => 'Đại học Swiss UMEF',
                'template_key' => 'student_onboarding_standard',
                'match_keywords' => ['mba in ai', 'mbainai'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1Byi7lmVQsm9sSD-OGKSHli1FfsnsvkXr',
                'partner_portal_url' => 'https://portal.swiss-umef.ch/',
                'order_index' => 4,
                'curriculum' => [
                    ['code' => 'MBA-AI-01', 'name' => 'Marketing Management', 'credits' => 3],
                    ['code' => 'MBA-AI-02', 'name' => 'Human Capital and Talent Management', 'credits' => 3],
                    ['code' => 'MBA-AI-03', 'name' => 'Entrepreneurship and Innovation', 'credits' => 3],
                    ['code' => 'MBA-AI-04', 'name' => 'Corporate Finance', 'credits' => 3],
                    ['code' => 'MBA-AI-05', 'name' => 'Accounting for Managers', 'credits' => 3],
                    ['code' => 'MBA-AI-06', 'name' => 'Digital Transformation', 'credits' => 3],
                    ['code' => 'MBA-AI-07', 'name' => 'Global Strategy', 'credits' => 3],
                    ['code' => 'MBA-AI-08', 'name' => 'Organizational Behaviour', 'credits' => 3],
                    ['code' => 'MBA-AI-09', 'name' => 'Leadership Development', 'credits' => 3],
                    ['code' => 'MBA-AI-10', 'name' => 'AI in Business Decision making', 'credits' => 3],
                    ['code' => 'MBA-AI-11', 'name' => 'Big Data Analysis', 'credits' => 3],
                    ['code' => 'MBA-AI-12', 'name' => 'Project Management', 'credits' => 3],
                    ['code' => 'MBA-AI-13', 'name' => 'Thesis (Luận văn) - 18 ECTS', 'credits' => 18],
                ],
            ],
            [
                'program_code' => 'bba',
                'name' => 'BBA',
                'school_name' => 'Đại học Swiss UMEF',
                'template_key' => 'student_onboarding_standard',
                'match_keywords' => ['bba', 'top up', 'topup', 'cử nhân', 'bachelor'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1E1TZMRz5w05xv4wsNvP5vht3ojHeviAw',
                'partner_portal_url' => 'https://portal.swiss-umef.ch/',
                'order_index' => 5,
                'curriculum' => [
                    ['code' => 'BBA-01', 'name' => 'Introduction to Management', 'credits' => 3],
                    ['code' => 'BBA-02', 'name' => 'Introduction to Finance', 'credits' => 3],
                    ['code' => 'BBA-03', 'name' => 'Organisational Behaviour', 'credits' => 3],
                    ['code' => 'BBA-04', 'name' => 'Global Marketing', 'credits' => 3],
                    ['code' => 'BBA-05', 'name' => 'AI in Business', 'credits' => 3],
                    ['code' => 'BBA-06', 'name' => 'Project Management', 'credits' => 3],
                    ['code' => 'BBA-07', 'name' => 'Innovation & Design Thinking', 'credits' => 3],
                    ['code' => 'BBA-08', 'name' => 'Total Quality Management', 'credits' => 3],
                    ['code' => 'BBA-09', 'name' => 'Change Management', 'credits' => 3],
                    ['code' => 'BBA-10', 'name' => 'Management Information Systems', 'credits' => 3],
                    ['code' => 'BBA-11', 'name' => 'Capstone Project', 'credits' => 6],
                ],
            ],
            [
                'program_code' => 'istec',
                'name' => 'ISTEC',
                'school_name' => 'Istec Business School',
                'template_key' => 'student_onboarding_istec',
                'match_keywords' => ['istec'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1ZNcaYWUSd79CbLRDpV0LjbRAPeTCnumO?usp=drive_link',
                'partner_portal_url' => 'https://istec.education',
                'order_index' => 6,
                'curriculum' => [
                    ['code' => 'ISTEC-01', 'name' => 'Strategic Management', 'credits' => 3],
                    ['code' => 'ISTEC-02', 'name' => 'Leadership & Organizational Behavior', 'credits' => 3],
                    ['code' => 'ISTEC-03', 'name' => 'Financial Management for Executives', 'credits' => 3],
                    ['code' => 'ISTEC-04', 'name' => 'Marketing Strategy & Brand Management', 'credits' => 3],
                    ['code' => 'ISTEC-05', 'name' => 'Business Ethics & Sustainable Development', 'credits' => 3],
                    ['code' => 'ISTEC-06', 'name' => 'Business Analytics & Decision Making', 'credits' => 3],
                    ['code' => 'ISTEC-07', 'name' => 'Digital Transformation & AI Strategy', 'credits' => 3],
                    ['code' => 'ISTEC-08', 'name' => 'Operations & Supply Chain Management', 'credits' => 3],
                    ['code' => 'ISTEC-09', 'name' => 'Entrepreneurship & Innovation Management', 'credits' => 3],
                    ['code' => 'ISTEC-10', 'name' => 'Luxury & Premium Brand Management', 'credits' => 3],
                    ['code' => 'ISTEC-11', 'name' => 'International Business Management', 'credits' => 3],
                    ['code' => 'ISTEC-12', 'name' => 'Cross-Cultural Management', 'credits' => 3],
                    ['code' => 'ISTEC-13', 'name' => 'Strategic Marketing in Emerging Markets', 'credits' => 3],
                    ['code' => 'ISTEC-14', 'name' => 'International Negotiation & Business Development', 'credits' => 3],
                    ['code' => 'ISTEC-15', 'name' => 'Consulting Project Management', 'credits' => 3],
                    ['code' => 'ISTEC-16', 'name' => 'MBA THESIS / APPLIED BUSINESS PROJECT', 'credits' => 6],
                ],
            ],
            [
                'program_code' => 'estiam',
                'name' => 'DBA ESTIAM (PHASE & SEMINARS)',
                'school_name' => 'Paris Education/ESTIAM',
                'template_key' => 'student_onboarding_estiam',
                'match_keywords' => ['estiam', 'paris education', 'dual dba', 'dba estiam'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1tBzBTLL9WPT-OOjKWRNz5qFx8YGSptKG?usp=drive_link',
                'partner_portal_url' => 'https://pariseducation-global.org/',
                'order_index' => 7,
                'curriculum' => [
                    ['code' => 'PHASE-1-SEM-01', 'name' => 'Phase 1 — Seminar 1: Doctoral Research Orientation & Thesis Topic Development', 'credits' => 6],
                    ['code' => 'PHASE-1-SEM-02', 'name' => 'Phase 1 — Seminar 2: Literature Review & Conceptual Framework Development', 'credits' => 6],
                    ['code' => 'PHASE-1-SEM-03', 'name' => 'Phase 1 — Seminar 3: Advanced Research Methodology & Qualitative Design', 'credits' => 6],
                    ['code' => 'PHASE-1-SEM-04', 'name' => 'Phase 1 — Seminar 4: Quantitative Research Methods & Statistical Analysis', 'credits' => 6],
                    ['code' => 'PHASE-1-PROPOSAL', 'name' => 'Phase 1 — Doctoral Research Proposal Defense (Bảo vệ Đề cương Tiến sĩ)', 'credits' => 6],
                    ['code' => 'PHASE-2-SEM-05', 'name' => 'Phase 2 — Seminar 5: Advanced Epistemology & Epistemological Frameworks', 'credits' => 6],
                    ['code' => 'PHASE-2-SEM-06', 'name' => 'Phase 2 — Seminar 6: Field Data Collection & Empirical Analysis', 'credits' => 6],
                    ['code' => 'PHASE-2-PUB', 'name' => 'Phase 2 — International Working Paper / Scientific Publication (Bài báo khoa học)', 'credits' => 6],
                    ['code' => 'PHASE-3-SEM-07', 'name' => 'Phase 3 — Seminar 7: Doctoral Thesis Writing & Scientific Synthesis', 'credits' => 6],
                    ['code' => 'PHASE-3-PREDEFENSE', 'name' => 'Phase 3 — Pre-Defense (Bảo vệ Luận án Tiến sĩ cấp cơ sở)', 'credits' => 6],
                    ['code' => 'PHASE-3-DEFENSE', 'name' => 'Phase 3 — Doctoral Thesis Defense (Bảo vệ Luận án Tiến sĩ chính thức)', 'credits' => 24],
                ],
            ],
            [
                'program_code' => 'dba_istec',
                'name' => 'DBA ISTEC (PHASE & SEMINARS)',
                'school_name' => 'Istec Business School',
                'template_key' => 'student_onboarding_istec',
                'match_keywords' => ['dba istec'],
                'doc_folder_url' => 'https://drive.google.com/drive/folders/1ZNcaYWUSd79CbLRDpV0LjbRAPeTCnumO?usp=drive_link',
                'partner_portal_url' => 'https://istec.education',
                'order_index' => 8,
                'curriculum' => [
                    ['code' => 'PHASE-1-SEM-01', 'name' => 'Phase 1 — Seminar 1: Doctoral Research Orientation & Thesis Topic Development', 'credits' => 6],
                    ['code' => 'PHASE-1-SEM-02', 'name' => 'Phase 1 — Seminar 2: Literature Review & Conceptual Framework Development', 'credits' => 6],
                    ['code' => 'PHASE-1-SEM-03', 'name' => 'Phase 1 — Seminar 3: Advanced Research Methodology & Qualitative Design', 'credits' => 6],
                    ['code' => 'PHASE-1-SEM-04', 'name' => 'Phase 1 — Seminar 4: Quantitative Research Methods & Statistical Analysis', 'credits' => 6],
                    ['code' => 'PHASE-1-PROPOSAL', 'name' => 'Phase 1 — Doctoral Research Proposal Defense (Bảo vệ Đề cương Tiến sĩ)', 'credits' => 6],
                    ['code' => 'PHASE-2-SEM-05', 'name' => 'Phase 2 — Seminar 5: Advanced Epistemology & Epistemological Frameworks', 'credits' => 6],
                    ['code' => 'PHASE-2-SEM-06', 'name' => 'Phase 2 — Seminar 6: Field Data Collection & Empirical Analysis', 'credits' => 6],
                    ['code' => 'PHASE-2-PUB', 'name' => 'Phase 2 — International Working Paper / Scientific Publication (Bài báo khoa học)', 'credits' => 6],
                    ['code' => 'PHASE-3-SEM-07', 'name' => 'Phase 3 — Seminar 7: Doctoral Thesis Writing & Scientific Synthesis', 'credits' => 6],
                    ['code' => 'PHASE-3-PREDEFENSE', 'name' => 'Phase 3 — Pre-Defense (Bảo vệ Luận án Tiến sĩ cấp cơ sở)', 'credits' => 6],
                    ['code' => 'PHASE-3-DEFENSE', 'name' => 'Phase 3 — Doctoral Thesis Defense (Bảo vệ Luận án Tiến sĩ chính thức)', 'credits' => 24],
                ],
            ],
        ];
    }

    public static function defaultEmailTemplates(array $org, int $tenantId = 1): array
    {
        $orgName = $org['name'] ?? 'Học viện Đào tạo';
        $cc = $org['academic_cc_emails'] ?? '';
        $vars = ['{{student_name}}', '{{organization_name}}', '{{school_name}}', '{{support_hotline}}', '{{support_email}}', '{{cc_emails}}', '{{lms_url}}', '{{partner_portal_url}}', '{{ai_platform_url}}', '{{doc_folder_url}}', '{{staff_name}}'];

        $buildOnboardingHtml = function (string $schoolLabel, string $portalLabel) {
            return '<p>{{greeting}}</p>
<p>Lời đầu tiên, Ban Công tác Sinh viên {{organization_name}} xin gửi lời chúc mừng và trân trọng cảm ơn Anh/Chị đã tin chọn {{organization_name}} làm người bạn đồng hành trên chặng đường chinh phục tấm bằng từ <strong>' . $schoolLabel . '</strong>. Chúng tôi cam kết đồng hành và hỗ trợ Anh/Chị xuyên suốt quá trình học tập.</p>
<p><strong style="color: #BD1D2D; font-size: 15px;">A. KÊNH LIÊN LẠC CHÍNH THỨC</strong></p>
<p>1. <strong>Kênh Hỗ trợ Nhanh (Zalo/Hotline):</strong> {{support_hotline}}<br/>
2. <strong>Kênh Hỗ trợ Học vụ (Email):</strong><br/>
&nbsp;&nbsp;&bull; Tiếp nhận yêu cầu: <a href="mailto:{{support_email}}" style="color: #BD1D2D; font-weight: 600;">{{support_email}}</a><br/>
&nbsp;&nbsp;&bull; CC (Đồng gửi): <strong>{{cc_emails}}</strong> <em>(Vui lòng luôn CC các địa chỉ này để hệ thống ghi nhận và xử lý nhanh nhất)</em></p>
<p><strong style="color: #BD1D2D; font-size: 15px;">B. TÀI KHOẢN HỌC TẬP</strong></p>
<p>Anh/Chị sẽ được cấp các tài khoản học tập sử dụng xuyên suốt chương trình:</p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li><strong>1. Tài khoản LMS {{organization_name}}</strong> (xem tài liệu, video buổi học, hỗ trợ học thuật): <a href="{{lms_url}}" target="_blank" rel="noreferrer" style="color: #BD1D2D;">{{lms_url}}</a></li>
  <li><strong>2. ' . $portalLabel . '</strong> (làm bài, nộp bài, tính điểm chính thức): <a href="{{partner_portal_url}}" target="_blank" rel="noreferrer" style="color: #BD1D2D;">{{partner_portal_url}}</a></li>
  <li><strong>3. Platform AI Học thuật</strong> (công cụ bổ trợ học tập): <a href="{{ai_platform_url}}" target="_blank" rel="noreferrer" style="color: #BD1D2D;">{{ai_platform_url}}</a></li>
</ul>
<p><em>(Thông tin tài khoản sẽ được gửi trực tiếp đến email cá nhân của học viên đã đăng ký học tập)</em></p>
<p><strong style="color: #BD1D2D; font-size: 15px;">C. TÀI LIỆU ĐÍNH KÈM</strong></p>
<p>Link tổng hợp tài liệu hướng dẫn học tập: <a href="{{doc_folder_url}}" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></p>
<p>Nếu có bất kỳ vướng mắc nào, Anh/Chị vui lòng liên hệ CTSV để được hỗ trợ kịp thời. Chúc Anh/Chị có hành trình học tập thật thuận lợi và thành công!</p>
<p style="margin-top: 20px;">Trân trọng,<br/><strong>Ban Công tác Sinh viên {{organization_name}}</strong></p>';
        };

        $templates = [
            [
                'template_key' => 'student_onboarding_standard',
                'category' => 'academic',
                'name' => $tenantId === 1 ? 'Email Tiếp nhận Học viên - Chương trình Chuẩn / Swiss UMEF' : 'Email Tiếp nhận Học viên - Chương trình Chuẩn',
                'subject' => "[{$orgName}] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - {{school_name}}",
                'body_html' => $buildOnboardingHtml('{{school_name}}', 'Tài khoản Portal Trường đối tác'),
                'body_text' => "Chào {{student_name}}, Em là {{staff_name}} từ Bộ phận Công tác Sinh viên (CTSV) của {{organization_name}}.\nChào mừng Anh/Chị chính thức trở thành Tân Học viên tại {{organization_name}}.\n1. Kênh tiếp nhận hỗ trợ học vụ: {{support_email}} (CC: {{cc_emails}}).\n2. Tài khoản học tập và link tài liệu chi tiết đã được gửi tới email cá nhân của Anh/Chị.\nHotline hỗ trợ nhanh: {{support_hotline}}.",
                'cc_emails' => $cc,
                'variables' => $vars,
            ],
        ];

        if ($tenantId === 1) {
            $templates[] = [
                'template_key' => 'student_onboarding_istec',
                'category' => 'academic',
                'name' => 'Email Tiếp nhận Học viên - Istec Business School',
                'subject' => "[{$orgName}] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - Istec Business School",
                'body_html' => $buildOnboardingHtml('Istec Business School', 'Tài khoản LMS ISTEC'),
                'body_text' => '',
                'cc_emails' => $cc,
                'variables' => $vars,
            ];
            $templates[] = [
                'template_key' => 'student_onboarding_estiam',
                'category' => 'academic',
                'name' => 'Email Tiếp nhận Học viên - Paris Education / ESTIAM',
                'subject' => "[{$orgName}] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - Paris Education/ESTIAM",
                'body_html' => $buildOnboardingHtml('Paris Education/ESTIAM', 'Tài khoản học tập Paris Education'),
                'body_text' => '',
                'cc_emails' => $cc,
                'variables' => $vars,
            ];
        }

        $templates[] = [
            'template_key' => 'lecturer_invitation',
            'category' => 'academic',
            'name' => 'Email Thư mời Giảng dạy & Lịch Hướng dẫn 1:1',
            'subject' => "[{$orgName}] Thư mời giảng dạy học phần {{subject_name}}",
            'body_html' => '<p>Kính gửi Thầy/Cô <strong>{{lecturer_name}}</strong>,</p><p>Phòng Học vụ <strong>{{organization_name}}</strong> trân trọng gửi lời mời Thầy/Cô phụ trách giảng dạy học phần <strong>{{subject_name}}</strong>.</p><p>Mọi thông tin hỗ trợ kỹ thuật và lớp học xin liên hệ: {{support_email}} (CC: {{cc_emails}}) | Hotline: {{support_hotline}}.</p><p>Trân trọng,<br/><strong>Phòng Học vụ {{organization_name}}</strong></p>',
            'body_text' => '',
            'cc_emails' => $cc,
            'variables' => array_merge($vars, ['{{lecturer_name}}', '{{subject_name}}']),
        ];
        $templates[] = [
            'template_key' => 'subject_announcement',
            'category' => 'academic',
            'name' => 'Email Thông báo Lịch học Môn mới cho Học viên',
            'subject' => "[{$orgName}] Thông báo lịch học môn {{subject_name}}",
            'body_html' => '<p>Kính gửi Quý Anh/Chị Học viên,</p><p>Phòng Học vụ <strong>{{organization_name}}</strong> trân trọng thông báo lịch học môn <strong>{{subject_name}}</strong>.</p><p>Kênh hỗ trợ học vụ: {{support_email}} | Hotline: {{support_hotline}}.</p>',
            'body_text' => '',
            'cc_emails' => $cc,
            'variables' => array_merge($vars, ['{{subject_name}}']),
        ];

        return $templates;
    }

    public static function seedTenantDefaultsIfNeeded(PDO $db, int $tenantId): void
    {
        try {
            $stmtRoleCnt = $db->prepare("SELECT COUNT(*) FROM tenant_roles WHERE tenant_id = ?");
            $stmtRoleCnt->execute([$tenantId]);
            $hasSeededRoles = (int)$stmtRoleCnt->fetchColumn() > 0;

            if (!$hasSeededRoles) {
                $insRole = $db->prepare("INSERT INTO tenant_roles (tenant_id, role_slug, name, description, role_group, default_route, can_self_approve, is_system, permissions_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
                foreach (self::defaultRoleDefinitions() as $r) {
                    try {
                        $insRole->execute([
                            $tenantId,
                            $r['role_slug'],
                            $r['name'],
                            $r['description'],
                            $r['role_group'],
                            $r['default_route'],
                            $r['can_self_approve'],
                            $r['is_system'],
                            json_encode($r['permissions'], JSON_UNESCAPED_UNICODE),
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            // Classify existing teams that still have default department_code
            try {
                $stmtTeams = $db->prepare("SELECT id, name, department_code FROM teams WHERE tenant_id = ? AND deleted_at IS NULL");
                $stmtTeams->execute([$tenantId]);
                $updTeam = $db->prepare("UPDATE teams SET department_code = ?, is_sales_team = ? WHERE id = ? AND tenant_id = ?");
                foreach ($stmtTeams->fetchAll(PDO::FETCH_ASSOC) ?: [] as $tm) {
                    [$code, $isSales] = self::classifyDepartmentCode((string)$tm['name'], (int)$tm['id'], $tenantId);
                    if (($tm['department_code'] ?? 'sales') === 'sales' && $code !== 'sales') {
                        $updTeam->execute([$code, $isSales, (int)$tm['id'], $tenantId]);
                    }
                }
            } catch (\Throwable $e) {
            }

            $stmtWfCnt = $db->prepare("SELECT COUNT(*) FROM tenant_approval_workflows WHERE tenant_id = ?");
            $stmtWfCnt->execute([$tenantId]);
            if ((int)$stmtWfCnt->fetchColumn() === 0) {
                $insWf = $db->prepare("INSERT INTO tenant_approval_workflows (tenant_id, module_key, name, description, levels_config, allow_creator_self_approve, auto_approve_for_executives, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
                foreach (self::defaultApprovalWorkflows() as $wf) {
                    try {
                        $insWf->execute([
                            $tenantId,
                            $wf['module_key'],
                            $wf['name'],
                            $wf['description'],
                            json_encode($wf['levels_config'], JSON_UNESCAPED_UNICODE),
                            $wf['allow_creator_self_approve'],
                            $wf['auto_approve_for_executives'],
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            $stmtNrCnt = $db->prepare("SELECT COUNT(*) FROM tenant_notification_rules WHERE tenant_id = ?");
            $stmtNrCnt->execute([$tenantId]);
            if ((int)$stmtNrCnt->fetchColumn() === 0) {
                $insNr = $db->prepare("INSERT INTO tenant_notification_rules (tenant_id, event_key, name, description, recipient_strategy, target_roles_json, target_departments_json, target_user_ids_json, include_owner, include_team_leader, cc_emails, channels_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, '', ?, 1)");
                foreach (self::defaultNotificationRules() as $nr) {
                    try {
                        $insNr->execute([
                            $tenantId,
                            $nr['event_key'],
                            $nr['name'],
                            $nr['description'],
                            $nr['recipient_strategy'],
                            json_encode($nr['target_roles'], JSON_UNESCAPED_UNICODE),
                            json_encode($nr['target_departments'], JSON_UNESCAPED_UNICODE),
                            $nr['include_owner'],
                            $nr['include_team_leader'],
                            json_encode($nr['channels'], JSON_UNESCAPED_UNICODE),
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            $stmtTabCnt = $db->prepare("SELECT COUNT(*) FROM tenant_student_tabs WHERE tenant_id = ?");
            $stmtTabCnt->execute([$tenantId]);
            if ((int)$stmtTabCnt->fetchColumn() === 0) {
                $insTab = $db->prepare("INSERT INTO tenant_student_tabs (tenant_id, tab_key, label, badge_key, stage_slugs_json, include_customer_status, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
                foreach (self::defaultStudentTabs() as $st) {
                    try {
                        $insTab->execute([
                            $tenantId,
                            $st['tab_key'],
                            $st['label'],
                            $st['badge_key'],
                            json_encode($st['stage_slugs'], JSON_UNESCAPED_UNICODE),
                            $st['include_customer_status'],
                            $st['order_index'],
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            $stmtStageCnt = $db->prepare("SELECT COUNT(*) FROM pipeline_stages WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmtStageCnt->execute([$tenantId]);
            if ((int)$stmtStageCnt->fetchColumn() === 0) {
                $insStage = $db->prepare("INSERT INTO pipeline_stages (tenant_id, name, color, order_index, is_won, is_lost, system_slug, notify_config_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                foreach (self::defaultPipelineStages() as $ps) {
                    try {
                        $insStage->execute([
                            $tenantId,
                            $ps['name'],
                            $ps['color'],
                            $ps['order_index'],
                            $ps['is_won'],
                            $ps['is_lost'],
                            $ps['system_slug'],
                            isset($ps['notify']) ? json_encode($ps['notify'], JSON_UNESCAPED_UNICODE) : null,
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            } else {
                // Backfill notify_config_json on existing stages where null
                $defaultBySlug = [];
                foreach (self::defaultPipelineStages() as $ps) {
                    if (!empty($ps['notify'])) {
                        $defaultBySlug[$ps['system_slug']] = json_encode($ps['notify'], JSON_UNESCAPED_UNICODE);
                    }
                }
                if (!empty($defaultBySlug)) {
                    $updStageNotify = $db->prepare("UPDATE pipeline_stages SET notify_config_json = ? WHERE tenant_id = ? AND system_slug = ? AND (notify_config_json IS NULL OR notify_config_json = '')");
                    foreach ($defaultBySlug as $slug => $cfgJson) {
                        $updStageNotify->execute([$cfgJson, $tenantId, $slug]);
                    }
                }
            }

            $org = self::getOrganizationProfile($db, $tenantId, false);

            $stmtProgCnt = $db->prepare("SELECT COUNT(*) FROM tenant_academic_programs WHERE tenant_id = ?");
            $stmtProgCnt->execute([$tenantId]);
            if ((int)$stmtProgCnt->fetchColumn() === 0) {
                $insProg = $db->prepare("INSERT INTO tenant_academic_programs (tenant_id, program_code, name, school_name, template_key, match_keywords_json, doc_folder_url, lms_url, partner_portal_url, ai_platform_url, curriculum_json, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
                foreach (self::defaultAcademicPrograms($tenantId) as $pg) {
                    try {
                        $insProg->execute([
                            $tenantId,
                            $pg['program_code'],
                            $pg['name'],
                            $pg['school_name'],
                            $pg['template_key'],
                            json_encode($pg['match_keywords'], JSON_UNESCAPED_UNICODE),
                            $pg['doc_folder_url'],
                            $org['lms_url'] ?? '',
                            $pg['partner_portal_url'],
                            $org['ai_platform_url'] ?? '',
                            json_encode($pg['curriculum'], JSON_UNESCAPED_UNICODE),
                            $pg['order_index'],
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            $stmtTplCnt = $db->prepare("SELECT COUNT(*) FROM tenant_email_templates WHERE tenant_id = ?");
            $stmtTplCnt->execute([$tenantId]);
            if ((int)$stmtTplCnt->fetchColumn() === 0) {
                $insTpl = $db->prepare("INSERT INTO tenant_email_templates (tenant_id, template_key, category, name, subject, body_html, body_text, cc_emails, variables_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
                foreach (self::defaultEmailTemplates($org, $tenantId) as $tpl) {
                    try {
                        $insTpl->execute([
                            $tenantId,
                            $tpl['template_key'],
                            $tpl['category'],
                            $tpl['name'],
                            $tpl['subject'],
                            $tpl['body_html'],
                            $tpl['body_text'],
                            $tpl['cc_emails'],
                            json_encode($tpl['variables'], JSON_UNESCAPED_UNICODE),
                        ]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            try {
                $stmtMigFlag = $db->prepare("SELECT setting_value FROM system_settings WHERE tenant_id = ? AND setting_key = 'legacy_stage_notify_migrated_v2' LIMIT 1");
                $stmtMigFlag->execute([$tenantId]);
                if ((string)$stmtMigFlag->fetchColumn() !== '1') {
                    self::syncLegacyTenantNotificationSettings($db, $tenantId, false);
                }
            } catch (\Throwable $eMig) {
            }
        } catch (\Throwable $e) {
            error_log('TenantConfigService::seedTenantDefaultsIfNeeded error: ' . $e->getMessage());
        }
    }

    /**
     * Dynamically migrate notification settings (pipeline stages, notification rules,
     * deposit approval workflow, HR team approver) to preserve exact legacy per-person
     * defaults when those users exist in the tenant's active roster.
     */
    public static function syncLegacyTenantNotificationSettings(PDO $db, int $tenantId, bool $overwriteSeededDefaults = false): array
    {
        $summary = [
            'tenant_id' => $tenantId,
            'updated_stages' => 0,
            'updated_rules' => 0,
            'updated_workflows' => 0,
            'updated_teams' => 0,
            'deactivated_users' => 0,
            'skipped' => false,
        ];

        try {
            $stmtU = $db->prepare("SELECT id, username, email, full_name, role, is_active, status FROM users WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmtU->execute([$tenantId]);
            $allTenantUsers = $stmtU->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
            $summary['skipped'] = true;
            return $summary;
        }

        if (empty($allTenantUsers)) {
            $summary['skipped'] = true;
            return $summary;
        }

        // Deactivate Phan Hiếu Ngân (nganph@ideas.edu.vn / 100076) as resigned staff if present
        $deactivatedIds = [];
        foreach ($allTenantUsers as $uRow) {
            $uid = (int)($uRow['id'] ?? 0);
            $em = strtolower(trim((string)($uRow['email'] ?? '')));
            $un = strtolower(trim((string)($uRow['username'] ?? '')));
            if ($uid === 100076 || $em === 'nganph@ideas.edu.vn' || $un === 'nganph') {
                $deactivatedIds[] = $uid;
                $isActive = (int)($uRow['is_active'] ?? 1);
                $stStr = strtolower(trim((string)($uRow['status'] ?? 'active')));
                if ($isActive !== 0 || $stStr !== 'inactive') {
                    try {
                        $db->prepare("UPDATE users SET is_active = 0, status = 'inactive' WHERE id = ? AND tenant_id = ?")
                            ->execute([$uid, $tenantId]);
                        $summary['deactivated_users']++;
                    } catch (\Throwable $eDeact) {
                    }
                }
            }
        }

        $tenantUsers = array_values(array_filter($allTenantUsers, static function ($u) use ($deactivatedIds): bool {
            $uid = (int)($u['id'] ?? 0);
            if ($uid <= 0 || in_array($uid, $deactivatedIds, true)) {
                return false;
            }
            return (int)($u['is_active'] ?? 1) === 1;
        }));

        if (empty($tenantUsers)) {
            $summary['skipped'] = true;
            return $summary;
        }

        $resolveUid = static function (int $legacyId, array $emails, array $usernames) use ($tenantUsers): int {
            $normEmails = array_map('strtolower', $emails);
            $normUsers = array_map('strtolower', $usernames);
            foreach ($tenantUsers as $u) {
                $uid = (int)($u['id'] ?? 0);
                $em = strtolower(trim((string)($u['email'] ?? '')));
                $un = strtolower(trim((string)($u['username'] ?? '')));
                if (
                    $uid === $legacyId ||
                    ($em !== '' && in_array($em, $normEmails, true)) ||
                    ($un !== '' && in_array($un, $normUsers, true))
                ) {
                    return $uid;
                }
            }
            return 0;
        };

        $saleAdminId  = $resolveUid(100066, ['linhdk@ideas.edu.vn'], ['linhdk']);
        $maiThiNuId   = $resolveUid(100062, ['numt@ideas.edu.vn'], ['numt']);
        $huyenTramId  = $resolveUid(100073, ['tramlth@ideas.edu.vn'], ['tramlth']);
        $hienThuongId = $resolveUid(1000007, ['thuongnh@ideas.edu.vn'], ['thuongnh']);
        $thuThaoId    = $resolveUid(100064, ['thaont@ideas.edu.vn'], ['thaont']);
        $duyPhuongId  = $resolveUid(100065, ['phuongntd@ideas.edu.vn'], ['phuongntd']);

        if (
            $saleAdminId === 0 && $maiThiNuId === 0 && $huyenTramId === 0 &&
            $hienThuongId === 0 && $thuThaoId === 0 && $duyPhuongId === 0
        ) {
            $summary['skipped'] = true;
            return $summary;
        }

        // 1. Migrate pipeline_stages.notify_config_json
        $stageTargets = [];
        if ($saleAdminId > 0) {
            $cfg09 = ['user_ids' => [$saleAdminId], 'roles' => [], 'departments' => []];
            $stageTargets['application_started'] = $cfg09;
            $stageTargets['nop_ho_so'] = $cfg09;
        }
        if ($maiThiNuId > 0) {
            $stageTargets['application_completed'] = ['user_ids' => [$maiThiNuId], 'roles' => [], 'departments' => []];
        }
        $s13Ids = array_values(array_unique(array_filter([$maiThiNuId, $saleAdminId])));
        if (!empty($s13Ids)) {
            $cfg13 = ['user_ids' => $s13Ids, 'roles' => [], 'departments' => []];
            $stageTargets['deposit_tuition_payment'] = $cfg13;
            $stageTargets['dong_le_phi_ho_so'] = $cfg13;
            $stageTargets['dat_coc'] = $cfg13;
        }
        $s14Ids = array_values(array_unique(array_filter([$maiThiNuId, $huyenTramId, $hienThuongId])));
        if (!empty($s14Ids)) {
            $cfg14 = ['user_ids' => $s14Ids, 'roles' => [], 'departments' => []];
            $stageTargets['enrolled'] = $cfg14;
            $stageTargets['hoc_vien'] = $cfg14;
        }

        if (!empty($stageTargets)) {
            $stmtSt = $db->prepare("SELECT id, system_slug, notify_config_json FROM pipeline_stages WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmtSt->execute([$tenantId]);
            $updSt = $db->prepare("UPDATE pipeline_stages SET notify_config_json = ? WHERE id = ? AND tenant_id = ?");
            foreach ($stmtSt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $stRow) {
                $slug = strtolower(trim((string)($stRow['system_slug'] ?? '')));
                if (!isset($stageTargets[$slug])) {
                    continue;
                }
                $currDecoded = !empty($stRow['notify_config_json']) ? json_decode((string)$stRow['notify_config_json'], true) : null;
                $currUsers = is_array($currDecoded['user_ids'] ?? null) ? array_map('intval', $currDecoded['user_ids']) : [];
                $hasCurrUsers = !empty($currUsers);
                $hasDeactivatedUser = !empty(array_intersect($currUsers, $deactivatedIds));
                if ($overwriteSeededDefaults || empty($stRow['notify_config_json']) || !$hasCurrUsers || $hasDeactivatedUser) {
                    $newJson = json_encode($stageTargets[$slug], JSON_UNESCAPED_UNICODE);
                    if ((string)($stRow['notify_config_json'] ?? '') !== $newJson) {
                        $updSt->execute([$newJson, (int)$stRow['id'], $tenantId]);
                        $summary['updated_stages']++;
                    }
                }
            }
        }

        // 2. Migrate tenant_notification_rules
        $ruleTargets = [];
        if ($saleAdminId > 0) {
            $ruleTargets['PIPELINE_STAGE_APPLICATION_STARTED'] = ['user_ids' => [$saleAdminId], 'include_owner' => 0];
        }
        if ($maiThiNuId > 0) {
            $ruleTargets['PIPELINE_STAGE_APPLICATION_COMPLETED'] = ['user_ids' => [$maiThiNuId], 'include_owner' => 0];
            $ruleTargets['STUDENT_STUDY_STATUS_CHANGED'] = ['user_ids' => [$maiThiNuId], 'include_owner' => 1];
        }
        if (!empty($s13Ids)) {
            $ruleTargets['PIPELINE_STAGE_DEPOSIT_PAYMENT'] = ['user_ids' => $s13Ids, 'include_owner' => 0];
        }
        if (!empty($s14Ids)) {
            $ruleTargets['PIPELINE_STAGE_ENROLLED'] = ['user_ids' => $s14Ids, 'include_owner' => 0];
        }

        if (!empty($ruleTargets)) {
            $stmtNr = $db->prepare("SELECT id, event_key, target_user_ids_json FROM tenant_notification_rules WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmtNr->execute([$tenantId]);
            $updNr = $db->prepare("UPDATE tenant_notification_rules SET recipient_strategy = 'users', target_roles_json = '[]', target_departments_json = '[]', target_user_ids_json = ?, include_owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?");
            foreach ($stmtNr->fetchAll(PDO::FETCH_ASSOC) ?: [] as $nrRow) {
                $eKey = strtoupper(trim((string)($nrRow['event_key'] ?? '')));
                if (!isset($ruleTargets[$eKey])) {
                    continue;
                }
                $currUids = !empty($nrRow['target_user_ids_json']) ? array_map('intval', json_decode((string)$nrRow['target_user_ids_json'], true) ?: []) : [];
                $hasDeactivatedUser = !empty(array_intersect($currUids, $deactivatedIds));
                if ($overwriteSeededDefaults || empty($currUids) || $hasDeactivatedUser) {
                    $newUidsJson = json_encode($ruleTargets[$eKey]['user_ids'], JSON_UNESCAPED_UNICODE);
                    $updNr->execute([$newUidsJson, $ruleTargets[$eKey]['include_owner'], (int)$nrRow['id'], $tenantId]);
                    $summary['updated_rules']++;
                }
            }
        }

        // 3. Migrate deposit approval workflow defaults (Approver: Thu Thảo, Watcher: Mai Thị Nữ)
        if ($thuThaoId > 0 || $maiThiNuId > 0) {
            $stmtWf = $db->prepare("SELECT id, levels_config FROM tenant_approval_workflows WHERE tenant_id = ? AND module_key = 'deposit' AND deleted_at IS NULL LIMIT 1");
            $stmtWf->execute([$tenantId]);
            $wfRow = $stmtWf->fetch(PDO::FETCH_ASSOC);
            if ($wfRow) {
                $lvlCfg = !empty($wfRow['levels_config']) ? (json_decode((string)$wfRow['levels_config'], true) ?: []) : [];
                if (!is_array($lvlCfg)) {
                    $lvlCfg = [];
                }
                $changedWf = false;
                if ($thuThaoId > 0 && ($overwriteSeededDefaults || empty($lvlCfg['level_1']['user_ids']))) {
                    if (!isset($lvlCfg['level_1']) || !is_array($lvlCfg['level_1'])) {
                        $lvlCfg['level_1'] = ['type' => 'department_head', 'department' => 'finance', 'roles' => ['accountant']];
                    }
                    $lvlCfg['level_1']['user_ids'] = [$thuThaoId];
                    $changedWf = true;
                }
                if ($maiThiNuId > 0 && ($overwriteSeededDefaults || empty($lvlCfg['watcher_user_ids']))) {
                    $lvlCfg['watcher_user_ids'] = [$maiThiNuId];
                    $lvlCfg['watcher_roles'] = [];
                    $changedWf = true;
                }
                if ($changedWf) {
                    $updWf = $db->prepare("UPDATE tenant_approval_workflows SET levels_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?");
                    $updWf->execute([json_encode($lvlCfg, JSON_UNESCAPED_UNICODE), (int)$wfRow['id'], $tenantId]);
                    $summary['updated_workflows']++;
                }
            }
        }

        // 4. Migrate HR team default_approver_id (Duy Phương) when unset
        if ($duyPhuongId > 0) {
            $updTeam = $db->prepare("UPDATE teams SET default_approver_id = ? WHERE tenant_id = ? AND department_code = 'hr' AND deleted_at IS NULL AND (default_approver_id IS NULL OR default_approver_id = 0)");
            $updTeam->execute([$duyPhuongId, $tenantId]);
            $summary['updated_teams'] += $updTeam->rowCount();
        }

        // 5. Mark migration completed for this tenant so future admin edits in UI are never overwritten
        try {
            $isSqlite = self::isSqlite($db);
            $sqlFlag = $isSqlite
                ? "INSERT INTO system_settings (tenant_id, setting_key, setting_value) VALUES (?, 'legacy_stage_notify_migrated_v2', '1') ON CONFLICT(tenant_id, setting_key) DO UPDATE SET setting_value = '1'"
                : "INSERT INTO system_settings (tenant_id, setting_key, setting_value) VALUES (?, 'legacy_stage_notify_migrated_v2', '1') ON DUPLICATE KEY UPDATE setting_value = '1'";
            $db->prepare($sqlFlag)->execute([$tenantId]);
        } catch (\Throwable $eFlag) {
        }

        self::invalidateCache($tenantId);
        return $summary;
    }

    public static function getSettings(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['settings'])) {
            return self::$memCache[$tenantId]['settings'];
        }
        $cachePath = self::cacheFile($tenantId, 'settings');
        if (is_file($cachePath) && (time() - filemtime($cachePath) < 180)) {
            $cached = json_decode((string)@file_get_contents($cachePath), true);
            if (is_array($cached)) {
                self::$memCache[$tenantId]['settings'] = $cached;
                return $cached;
            }
        }
        $settings = [];
        try {
            $stmt = $db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE tenant_id = ?");
            $stmt->execute([$tenantId]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
                $settings[(string)$r['setting_key']] = $r['setting_value'];
            }
        } catch (\Throwable $e) {
            try {
                $stmt = $db->query("SELECT setting_key, setting_value FROM system_settings");
                foreach ($stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [] as $r) {
                    $settings[(string)$r['setting_key']] = $r['setting_value'];
                }
            } catch (\Throwable $e2) {
            }
        }
        self::$memCache[$tenantId]['settings'] = $settings;
        @file_put_contents($cachePath, json_encode($settings, JSON_UNESCAPED_UNICODE));
        return $settings;
    }

    public static function getSetting(PDO $db, int $tenantId, string $key, $default = '')
    {
        $all = self::getSettings($db, $tenantId);
        return array_key_exists($key, $all) && $all[$key] !== null && $all[$key] !== '' ? $all[$key] : $default;
    }

    public static function saveSettings(PDO $db, int $tenantId, array $kv): void
    {
        self::ensureSchema($db, $tenantId);
        $isSqlite = self::isSqlite($db);
        $sql = $isSqlite
            ? "INSERT INTO system_settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(tenant_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value"
            : "INSERT INTO system_settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)";
        $stmt = $db->prepare($sql);
        foreach ($kv as $k => $v) {
            if (!is_string($k) || trim($k) === '') {
                continue;
            }
            $valStr = is_array($v) || is_object($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : (string)($v ?? '');
            $stmt->execute([$tenantId, trim($k), $valStr]);
        }
        self::invalidateCache($tenantId);
    }

    public static function getOrganizationProfile(PDO $db, int $tenantId = 1, bool $ensure = true): array
    {
        if ($ensure) {
            self::ensureSchema($db, $tenantId);
        }
        $tenantRow = [];
        try {
            $stmt = $db->prepare("SELECT * FROM tenants WHERE id = ? LIMIT 1");
            $stmt->execute([$tenantId]);
            $tenantRow = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
        }

        $settings = [];
        try {
            $stmtS = $db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE tenant_id = ?");
            $stmtS->execute([$tenantId]);
            foreach ($stmtS->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
                $settings[(string)$r['setting_key']] = $r['setting_value'];
            }
        } catch (\Throwable $e) {
        }

        $isLegacyPrimaryTenant = ($tenantId === 1);
        $envDomain = trim((string)(getenv('INTERNAL_EMAIL_DOMAIN') ?: ($_ENV['INTERNAL_EMAIL_DOMAIN'] ?? '')));
        $envSender = trim((string)(getenv('DEFAULT_SENDER_EMAIL') ?: ($_ENV['DEFAULT_SENDER_EMAIL'] ?? '')));
        $name = trim((string)($settings['company_name'] ?? $settings['organization_name'] ?? $tenantRow['name'] ?? ($isLegacyPrimaryTenant ? 'IDEAS' : 'Workspace')));
        $shortName = trim((string)($settings['organization_short_name'] ?? $settings['brand_prefix'] ?? ($isLegacyPrimaryTenant && stripos($name, 'ideas') !== false ? 'IDEAS' : '')));
        $frontendUrl = trim((string)($settings['frontend_url'] ?? $tenantRow['domain'] ?? (getenv('APP_BASE_URL') ?: ($_ENV['APP_BASE_URL'] ?? ''))));
        if ($frontendUrl === '' && !empty($_SERVER['HTTP_HOST'])) {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $frontendUrl = $scheme . '://' . $_SERVER['HTTP_HOST'];
        }
        if ($frontendUrl !== '' && !preg_match('#^https?://#i', $frontendUrl)) {
            $frontendUrl = 'https://' . ltrim($frontendUrl, '/');
        }
        $domainHost = $frontendUrl ? (parse_url($frontendUrl, PHP_URL_HOST) ?: '') : '';
        $derivedDomain = $domainHost ? preg_replace('/^(myerp|crm|app|automation)\./i', '', $domainHost) : '';
        $internalDomain = trim((string)($settings['internal_email_domain'] ?? $settings['organization_internal_domain'] ?? ($derivedDomain ?: $envDomain)));
        $defaultSender = trim((string)($settings['ses_sender_email'] ?? ($envSender ?: ($internalDomain !== '' ? ('noreply@' . $internalDomain) : ''))));

        return [
            'tenant_id' => $tenantId,
            'name' => $name,
            'short_name' => $shortName,
            'slug' => $tenantRow['slug'] ?? ('tenant-' . $tenantId),
            'logo_url' => $settings['company_logo_url'] ?? $tenantRow['logo_url'] ?? '/LOGO.webp',
            'primary_color' => $tenantRow['primary_color'] ?? '#BD1D2D',
            'currency' => $tenantRow['currency'] ?? 'VND',
            'timezone' => $tenantRow['timezone'] ?? 'Asia/Ho_Chi_Minh',
            'frontend_url' => $frontendUrl,
            'internal_email_domain' => $internalDomain,
            'sender_email' => $defaultSender,
            'verified_senders' => array_values(array_filter(array_map('trim', explode(',', (string)($settings['verified_from_senders'] ?? $defaultSender))))),
            'support_email' => $tenantRow['support_email'] ?? $settings['support_email'] ?? $settings['organization_support_email'] ?? ($internalDomain !== '' ? ('support@' . $internalDomain) : ''),
            'support_hotline' => $tenantRow['support_hotline'] ?? $settings['company_phone'] ?? $settings['organization_support_hotline'] ?? '',
            'academic_cc_emails' => $tenantRow['academic_cc_emails'] ?? $settings['academic_cc_emails'] ?? $settings['organization_academic_cc_emails'] ?? '',
            'lms_url' => $tenantRow['lms_url'] ?? $settings['lms_url'] ?? $settings['organization_lms_url'] ?? '',
            'ai_platform_url' => $tenantRow['ai_platform_url'] ?? $settings['ai_platform_url'] ?? '',
            'address' => $settings['company_address'] ?? $tenantRow['address'] ?? '',
            'tax_id' => $settings['company_tax_id'] ?? $tenantRow['tax_id'] ?? '',
            'excluded_system_emails' => array_values(array_filter(array_map('strtolower', array_map('trim', explode(',', (string)($settings['excluded_system_emails'] ?? ($internalDomain !== '' ? ("ai@{$internalDomain},info@{$internalDomain}") : ''))))))),
        ];
    }

    public static function getBrandName(?PDO $db, int $tenantId = 1): string
    {
        if ($db instanceof PDO) {
            $org = self::getOrganizationProfile($db, $tenantId);
            $name = trim((string)($org['name'] ?? ''));
            if ($name !== '') {
                return $name;
            }
        }
        return 'ERP';
    }

    public static function getBrandPrefix(PDO $db, int $tenantId = 1): string
    {
        $org = self::getOrganizationProfile($db, $tenantId);
        $label = trim((string)($org['short_name'] ?? '')) ?: trim((string)($org['name'] ?? '')) ?: 'ERP';
        return '[' . trim($label, '[] ') . ']';
    }

    public static function getFrontendUrl(?PDO $db, int $tenantId = 1): string
    {
        if ($db instanceof PDO) {
            $org = self::getOrganizationProfile($db, $tenantId);
            $fe = rtrim(trim((string)($org['frontend_url'] ?? '')), '/');
            if ($fe !== '') {
                return $fe;
            }
        }
        $envUrl = rtrim(trim((string)(getenv('APP_BASE_URL') ?: ($_ENV['APP_BASE_URL'] ?? ''))), '/');
        if ($envUrl !== '') {
            return $envUrl;
        }
        if (!empty($_SERVER['HTTP_HOST'])) {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            return $scheme . '://' . $_SERVER['HTTP_HOST'];
        }
        return '';
    }

    public static function getDefaultSenderEmail(?PDO $db, int $tenantId = 1): string
    {
        if ($db instanceof PDO) {
            $org = self::getOrganizationProfile($db, $tenantId);
            if (!empty($org['sender_email'])) {
                return (string)$org['sender_email'];
            }
            if (!empty($org['verified_senders'][0])) {
                return (string)$org['verified_senders'][0];
            }
            if (!empty($org['internal_email_domain'])) {
                return 'noreply@' . ltrim((string)$org['internal_email_domain'], '@');
            }
        }
        return 'noreply@myerp.local';
    }

    public static function getExcludedSystemEmails(PDO $db, int $tenantId = 1): array
    {
        $org = self::getOrganizationProfile($db, $tenantId);
        return array_values(array_unique(array_filter(array_map('strtolower', $org['excluded_system_emails'] ?? []))));
    }

    public static function buildExcludedEmailSqlCondition(PDO $db, int $tenantId, string $colExpr = 'u.email'): string
    {
        $emails = self::getExcludedSystemEmails($db, $tenantId);
        if (empty($emails)) {
            return '1=1';
        }
        $quoted = array_map(fn($em) => $db->quote(strtolower(trim($em))), $emails);
        return "({$colExpr} IS NULL OR LOWER(TRIM({$colExpr})) NOT IN (" . implode(',', $quoted) . "))";
    }

    public static function roleGroupToCanonicalRole(string $roleGroup): string
    {
        $map = [
            'system_admin' => 'admin',
            'admin' => 'admin',
            'superadmin' => 'admin',
            'super_admin' => 'admin',
            'executive' => 'director',
            'director' => 'director',
            'management' => 'manager',
            'manager' => 'manager',
            'sale_admin' => 'sale_admin',
            'sales' => 'sales',
            'sale' => 'sales',
            'marketing' => 'marketing',
            'finance' => 'accountant',
            'accountant' => 'accountant',
            'hr' => 'hr',
            'academic' => 'academic',
            'specialist' => 'viewer',
            'viewer' => 'viewer',
            'staff' => 'sales',
        ];
        return $map[strtolower(trim($roleGroup))] ?? 'sales';
    }

    public static function normalizeRoleSlug(string $role): string
    {
        $r = strtolower(trim($role));
        $aliases = [
            'super_admin' => 'superadmin',
            'sale' => 'sales',
            'telesale' => 'sales',
            'consultant' => 'sales',
            'saleadmin' => 'sale_admin',
            'mkt' => 'marketing',
            'ke_toan' => 'accountant',
            'ketoan' => 'accountant',
            'finance' => 'accountant',
            'nhan_su' => 'hr',
            'human_resources' => 'hr',
            'hoc_vu' => 'academic',
            'hoc_thuat' => 'academic',
            'tro_giang' => 'academic',
            'teacher' => 'academic',
            'giang_vien' => 'academic',
            'giao_vien' => 'academic',
            'tutor' => 'academic',
            'tro_ly' => 'assistant',
        ];
        return $aliases[$r] ?? $r;
    }

    public static function getRoles(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['roles'])) {
            return self::$memCache[$tenantId]['roles'];
        }
        $stmt = $db->prepare("SELECT * FROM tenant_roles WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY is_system DESC, id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['tenant_id'] = (int)$r['tenant_id'];
            $r['can_self_approve'] = (int)$r['can_self_approve'];
            $r['is_system'] = (int)$r['is_system'];
            $r['permissions'] = !empty($r['permissions_json']) ? (json_decode($r['permissions_json'], true) ?: []) : [];
        }
        unset($r);
        self::$memCache[$tenantId]['roles'] = $rows;
        return $rows;
    }

    public static function normalizeModuleKey(string $module): string
    {
        $m = strtolower(trim($module));
        $aliases = [
            'tasks' => 'workspace',
            'task' => 'workspace',
            'activities' => 'workspace',
            'activity' => 'workspace',
            'cooperation' => 'cooperations',
            'cooperation_slips' => 'cooperations',
            'documents' => 'files',
            'cloud_files' => 'files',
            'payroll' => 'hrm',
            'academic' => 'students',
            'quote_invoice' => 'invoices',
        ];
        return $aliases[$m] ?? $m;
    }

    public static function moduleKeyCandidates(string $module): array
    {
        $raw = strtolower(trim($module));
        $norm = self::normalizeModuleKey($raw);
        $reverseMap = [
            'workspace' => ['workspace', 'tasks', 'activities'],
            'cooperations' => ['cooperations', 'cooperation', 'cooperation_slips'],
            'files' => ['files', 'documents', 'cloud_files'],
            'hrm' => ['hrm', 'payroll'],
            'students' => ['students', 'academic'],
            'invoices' => ['invoices', 'quote_invoice'],
        ];
        $cands = $reverseMap[$norm] ?? [$norm];
        if ($raw !== '' && !in_array($raw, $cands, true)) {
            $cands[] = $raw;
        }
        return $cands;
    }

    public static function doesUserSatisfyRoles(PDO $db, array $auth, array $allowedRoles, ?string $module = null, string $action = 'read', ?array $requiredScopes = null): bool
    {
        $rawRole = strtolower(trim((string)($auth['role'] ?? '')));
        if ($rawRole === '') {
            return false;
        }
        if (in_array($rawRole, ['superadmin', 'super_admin', 'admin'], true)) {
            return true;
        }

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $canonRole = self::normalizeRoleSlug($rawRole);
        $normMod = ($module !== null && trim($module) !== '') ? self::normalizeModuleKey($module) : null;

        // 1. Inspect explicit user-level override first (revocation always wins)
        $userOverrideScope = null;
        if ($normMod !== null) {
            $userPerms = $auth['permissions'] ?? $auth['permissions_json'] ?? null;
            if (is_string($userPerms) && $userPerms !== '') {
                $userPerms = json_decode($userPerms, true);
            }
            if (is_array($userPerms)) {
                foreach (self::moduleKeyCandidates((string)$module) as $ck) {
                    $cand = $userPerms[$ck][$action] ?? null;
                    if (in_array($cand, ['all', 'team', 'own', 'none'], true)) {
                        $userOverrideScope = (string)$cand;
                        if ($userOverrideScope === 'none') {
                            return false;
                        }
                        break;
                    }
                }
            }
        }

        // 2. Inspect tenant role record (system vs custom, role_group, and admin edits)
        $matchedRoleDef = null;
        $isCustomRole = false;
        $groupCanon = null;
        try {
            foreach (self::getRoles($db, $tenantId) as $rDef) {
                if ($rDef['role_slug'] === $rawRole || $rDef['role_slug'] === $canonRole) {
                    $matchedRoleDef = $rDef;
                    $isCustomRole = empty($rDef['is_system']);
                    $groupCanon = self::roleGroupToCanonicalRole((string)($rDef['role_group'] ?? 'staff'));
                    break;
                }
            }
        } catch (\Throwable $e) {
        }

        $defaultScopeForSystemRole = null;
        if (!$isCustomRole && $normMod !== null) {
            foreach (self::defaultRoleDefinitions() as $defR) {
                if ($defR['role_slug'] === $canonRole) {
                    $defaultScopeForSystemRole = $defR['permissions'][$normMod][$action] ?? 'none';
                    break;
                }
            }
        }

        $effScope = null;
        $hasAdminEditedRolePerm = false;
        if ($normMod !== null) {
            $effScope = self::resolvePermissionScope($db, $auth, $normMod, $action);
            if ($matchedRoleDef && !$isCustomRole && $userOverrideScope === null) {
                $dbVal = $matchedRoleDef['permissions'][$normMod][$action] ?? null;
                if (in_array($dbVal, ['all', 'team', 'own', 'none'], true) && $defaultScopeForSystemRole !== null && $dbVal !== $defaultScopeForSystemRole) {
                    $hasAdminEditedRolePerm = true;
                    if ($dbVal === 'none') {
                        return false;
                    }
                }
            }
            if ($isCustomRole && $effScope === 'none') {
                return false;
            }
            if ($requiredScopes !== null && !in_array($effScope, $requiredScopes, true)) {
                return false;
            }
        }

        $rawAllowed = array_values(array_filter(array_map(fn($r) => strtolower(trim((string)$r)), $allowedRoles)));
        $canonAllowed = array_values(array_unique(array_map([self::class, 'normalizeRoleSlug'], $rawAllowed)));

        // 3. Direct canonical/raw role match
        if (in_array($rawRole, $rawAllowed, true) || in_array($canonRole, $canonAllowed, true)) {
            return true;
        }

        // 4. Custom role matching via role_group
        if ($isCustomRole && $groupCanon !== null) {
            if ($groupCanon === 'admin' || in_array($groupCanon, $canonAllowed, true)) {
                return true;
            }
        }

        // 5. Dynamic permission grant (for custom roles, explicit user overrides, or admin-customized role matrices)
        if ($effScope !== null && $effScope !== 'none' && ($isCustomRole || $userOverrideScope !== null || $hasAdminEditedRolePerm)) {
            if ($requiredScopes !== null) {
                return in_array($effScope, $requiredScopes, true);
            }
            $nonExecRoles = array_diff($canonAllowed, ['admin', 'superadmin', 'director']);
            if (empty($nonExecRoles)) {
                return $effScope === 'all';
            }
            $nonExecManagerRoles = array_diff($canonAllowed, ['admin', 'superadmin', 'director', 'manager']);
            if (empty($nonExecManagerRoles)) {
                return in_array($effScope, ['all', 'team'], true);
            }
            return in_array($effScope, ['all', 'team', 'own'], true);
        }

        return false;
    }

    public static function hasPermission(PDO $db, array $auth, string $module, string $action = 'read', array $allowedScopes = ['all', 'team', 'own']): bool
    {
        $scope = self::resolvePermissionScope($db, $auth, $module, $action);
        return in_array($scope, $allowedScopes, true);
    }

    public static function hasGlobalScope(PDO $db, array $auth, string $module, string $action = 'read'): bool
    {
        return self::resolvePermissionScope($db, $auth, $module, $action) === 'all';
    }

    public static function canUserSelfApprove(PDO $db, array $auth, string $workflowModuleKey = ''): bool
    {
        $rawRole = strtolower(trim((string)($auth['role'] ?? '')));
        if (in_array($rawRole, ['superadmin', 'super_admin', 'admin'], true)) {
            return true;
        }
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $canonRole = self::normalizeRoleSlug($rawRole);

        // 1. Check workflow-specific allow_creator_self_approve or auto_approve_for_executives
        if ($workflowModuleKey !== '') {
            try {
                foreach (self::getApprovalWorkflows($db, $tenantId) as $wf) {
                    if ($wf['module_key'] === $workflowModuleKey) {
                        if (!empty($wf['allow_creator_self_approve'])) {
                            return true;
                        }
                        break;
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        // 2. Check role-specific can_self_approve in tenant_roles
        try {
            foreach (self::getRoles($db, $tenantId) as $rDef) {
                if ($rDef['role_slug'] === $rawRole || $rDef['role_slug'] === $canonRole) {
                    return !empty($rDef['can_self_approve']);
                }
            }
        } catch (\Throwable $e) {
        }

        return $canonRole === 'director';
    }

    public static function isUserInManagerTeam(PDO $db, int $tenantId, int $managerUserId, int $targetUserId): bool
    {
        if ($managerUserId <= 0 || $targetUserId <= 0) {
            return false;
        }
        if ($managerUserId === $targetUserId) {
            return true;
        }
        try {
            $stmt = $db->prepare("
                SELECT t.id, t.leader_id, t.default_approver_id, t.co_leader_ids
                FROM users u
                JOIN teams t ON u.team_id = t.id AND t.tenant_id = u.tenant_id
                WHERE u.id = ? AND u.tenant_id = ? AND t.deleted_at IS NULL
                LIMIT 1
            ");
            $stmt->execute([$targetUserId, $tenantId]);
            $tRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($tRow) {
                if ((int)($tRow['leader_id'] ?? 0) === $managerUserId || (int)($tRow['default_approver_id'] ?? 0) === $managerUserId) {
                    return true;
                }
                if (!empty($tRow['co_leader_ids'])) {
                    $coIds = is_string($tRow['co_leader_ids'])
                        ? (json_decode($tRow['co_leader_ids'], true) ?: array_map('intval', explode(',', $tRow['co_leader_ids'])))
                        : [];
                    if (in_array($managerUserId, array_map('intval', (array)$coIds), true)) {
                        return true;
                    }
                }
            }
        } catch (\Throwable $e) {
        }
        return false;
    }

    public static function canUserApproveWorkflowLevel(PDO $db, array $auth, string $workflowModuleKey, string $permModule, ?int $creatorUserId = null, ?int $designatedApproverId = null, int $level = 1, ?float $amount = null): array
    {
        $uid = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $rawRole = strtolower(trim((string)($auth['role'] ?? '')));
        $canonRole = self::normalizeRoleSlug($rawRole);

        // 1. Anti-Self-Approval enforcement
        if ($creatorUserId !== null && $creatorUserId > 0 && $creatorUserId === $uid) {
            if (!self::canUserSelfApprove($db, $auth, $workflowModuleKey)) {
                return ['allowed' => false, 'reason' => 'self_approval_forbidden'];
            }
        }

        // 2. Super Admin / Admin always allowed
        if (in_array($rawRole, ['superadmin', 'super_admin', 'admin'], true)) {
            return ['allowed' => true, 'scope' => 'all'];
        }

        // 3. Explicitly designated approver on the record
        if ($designatedApproverId !== null && $designatedApproverId > 0 && $designatedApproverId === $uid) {
            return ['allowed' => true, 'scope' => 'designated'];
        }

        // 4. Check workflow configuration in tenant_approval_workflows
        $wfMatched = null;
        try {
            foreach (self::getApprovalWorkflows($db, $tid) as $wf) {
                if ($wf['module_key'] === $workflowModuleKey) {
                    $wfMatched = $wf;
                    break;
                }
            }
        } catch (\Throwable $e) {
        }

        if ($wfMatched) {
            $lvlCfg = $wfMatched['levels_config']["level_{$level}"] ?? [];
            $wfUserIds = array_map('intval', (array)($lvlCfg['user_ids'] ?? []));
            if (in_array($uid, $wfUserIds, true)) {
                return ['allowed' => true, 'scope' => 'workflow_user'];
            }
            $wfRoles = array_map([self::class, 'normalizeRoleSlug'], (array)($lvlCfg['roles'] ?? []));
            if ($amount !== null && !empty($wfMatched['levels_config']['money_tiers']) && is_array($wfMatched['levels_config']['money_tiers'])) {
                foreach ($wfMatched['levels_config']['money_tiers'] as $tier) {
                    $maxAmt = isset($tier['max_amount']) && $tier['max_amount'] !== null && $tier['max_amount'] !== '' ? (float)$tier['max_amount'] : null;
                    if ($maxAmt === null || $amount <= $maxAmt) {
                        $tierRoles = array_map([self::class, 'normalizeRoleSlug'], (array)($tier['roles'] ?? []));
                        if (!empty($tierRoles)) {
                            $wfRoles = array_values(array_unique(array_merge($wfRoles, $tierRoles)));
                        }
                        break;
                    }
                }
            }
            if (!empty($wfRoles) && self::doesUserSatisfyRoles($db, $auth, $wfRoles, $permModule, 'approve')) {
                $scope = self::resolvePermissionScope($db, $auth, $permModule, 'approve');
                if ($scope === 'team' && $creatorUserId !== null && $creatorUserId > 0) {
                    if (!self::isUserInManagerTeam($db, $tid, $uid, $creatorUserId)) {
                        return ['allowed' => false, 'reason' => 'outside_team_scope'];
                    }
                }
                return ['allowed' => true, 'scope' => $scope !== 'none' ? $scope : 'workflow_role'];
            }
        }

        // 5. Check RBAC module approve scope ('all' or 'team')
        $approveScope = self::resolvePermissionScope($db, $auth, $permModule, 'approve');
        if ($approveScope === 'all') {
            return ['allowed' => true, 'scope' => 'all'];
        }
        if ($approveScope === 'team') {
            if ($creatorUserId === null || $creatorUserId <= 0 || self::isUserInManagerTeam($db, $tid, $uid, $creatorUserId)) {
                return ['allowed' => true, 'scope' => 'team'];
            }
            return ['allowed' => false, 'reason' => 'outside_team_scope'];
        }

        return ['allowed' => false, 'reason' => 'insufficient_approve_permission'];
    }

    public static function resolvePermissionScope(PDO $db, array $auth, string $module, string $action): string
    {
        $rawRole = strtolower(trim((string)($auth['role'] ?? 'viewer')));
        if (in_array($rawRole, ['superadmin', 'super_admin', 'admin'], true)) {
            return 'all';
        }
        $candKeys = self::moduleKeyCandidates($module);
        $module = self::normalizeModuleKey($module);
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $canonRole = self::normalizeRoleSlug($rawRole);

        // 1. User-level explicit override in permissions_json
        $userPerms = $auth['permissions'] ?? $auth['permissions_json'] ?? null;
        if (is_string($userPerms) && $userPerms !== '') {
            $userPerms = json_decode($userPerms, true);
        }
        if (is_array($userPerms)) {
            foreach ($candKeys as $ck) {
                $uCand = $userPerms[$ck][$action] ?? null;
                if (in_array($uCand, ['all', 'team', 'own', 'none'], true)) {
                    return (string)$uCand;
                }
            }
        }

        // 2. Tenant Role Matrix in DB
        $matchedInTenant = false;
        try {
            $roles = self::getRoles($db, $tenantId);
            foreach ($roles as $rDef) {
                if ($rDef['role_slug'] === $rawRole || $rDef['role_slug'] === $canonRole) {
                    $matchedInTenant = true;
                    foreach ($candKeys as $ck) {
                        $val = $rDef['permissions'][$ck][$action] ?? null;
                        if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                            return (string)$val;
                        }
                    }
                    if (empty($rDef['is_system'])) {
                        return 'none';
                    }
                    $canonRole = self::roleGroupToCanonicalRole((string)($rDef['role_group'] ?? 'staff'));
                    break;
                }
            }
        } catch (\Throwable $e) {
        }

        // 3. Zero-Trust Fallback: only built-in system roles (or matched custom role's role_group) get default matrix; unknown/deleted/foreign custom roles get 'none'
        foreach (self::defaultRoleDefinitions() as $defRole) {
            if ($defRole['role_slug'] === $canonRole) {
                $defVal = $defRole['permissions'][$module][$action] ?? null;
                if (in_array($defVal, ['all', 'team', 'own', 'none'], true)) {
                    return $defVal;
                }
                break;
            }
        }
        if (!$matchedInTenant) {
            return 'none';
        }
        if ($canonRole === 'admin') {
            return 'all';
        }
        if ($canonRole === 'director') {
            return $module === 'settings' && $action === 'delete' ? 'none' : 'all';
        }
        if ($canonRole === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        if ($canonRole === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }
        return 'none';
    }

    public static function getNonSalesTeamIds(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['non_sales_teams'])) {
            return self::$memCache[$tenantId]['non_sales_teams'];
        }
        $ids = [];
        try {
            $stmt = $db->prepare("SELECT id, name, department_code, is_sales_team FROM teams WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmt->execute([$tenantId]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $t) {
                $dept = strtolower((string)($t['department_code'] ?? 'sales'));
                $isSales = (int)($t['is_sales_team'] ?? 1);
                if ($isSales === 0 || $dept !== 'sales') {
                    $ids[] = (int)$t['id'];
                }
            }
        } catch (\Throwable $e) {
        }
        $ids = array_values(array_unique($ids));
        self::$memCache[$tenantId]['non_sales_teams'] = $ids;
        return $ids;
    }

    public static function getPipelineStages(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['stages'])) {
            return self::$memCache[$tenantId]['stages'];
        }
        $stmt = $db->prepare("SELECT * FROM pipeline_stages WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY order_index ASC, id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['order_index'] = (int)$r['order_index'];
            $r['is_won'] = (int)$r['is_won'];
            $r['is_lost'] = (int)$r['is_lost'];
            $r['notify_config'] = !empty($r['notify_config_json']) ? (json_decode($r['notify_config_json'], true) ?: null) : null;
        }
        unset($r);
        self::$memCache[$tenantId]['stages'] = $rows;
        return $rows;
    }

    public static function getStageIdsBySlugs(PDO $db, int $tenantId, array $slugs): array
    {
        $stages = self::getPipelineStages($db, $tenantId);
        $ids = [];
        $normSlugs = array_map('strtolower', $slugs);
        foreach ($stages as $st) {
            $s = strtolower((string)($st['system_slug'] ?? ''));
            if ($s !== '' && in_array($s, $normSlugs, true)) {
                $ids[] = (int)$st['id'];
            }
        }
        return array_values(array_unique($ids));
    }

    public static function getStudentTabs(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['student_tabs'])) {
            return self::$memCache[$tenantId]['student_tabs'];
        }
        $stmt = $db->prepare("SELECT * FROM tenant_student_tabs WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY order_index ASC, id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['order_index'] = (int)$r['order_index'];
            $r['include_customer_status'] = (int)$r['include_customer_status'];
            $r['stage_slugs'] = !empty($r['stage_slugs_json']) ? (json_decode($r['stage_slugs_json'], true) ?: []) : [];
        }
        unset($r);
        self::$memCache[$tenantId]['student_tabs'] = $rows;
        return $rows;
    }

    public static function buildStudentSubTabClause(PDO $db, int $tenantId, string $tabKey, string $alias = 'c'): ?string
    {
        $tabs = self::getStudentTabs($db, $tenantId);
        $matched = null;
        foreach ($tabs as $tb) {
            if ($tb['tab_key'] === $tabKey) {
                $matched = $tb;
                break;
            }
        }
        if (!$matched) {
            return null;
        }
        $slugs = array_values(array_filter(array_map(fn($s) => preg_replace('/[^a-z0-9_-]/i', '', (string)$s), $matched['stage_slugs'] ?? [])));
        $parts = [];
        if (!empty($slugs)) {
            $quoted = implode(',', array_map(fn($s) => "'" . addslashes($s) . "'", $slugs));
            $winCond = !empty($matched['include_customer_status']) ? " OR ps.is_won = 1" : "";
            $parts[] = "EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = {$alias}.stage_id AND ps.tenant_id = {$alias}.tenant_id AND ps.deleted_at IS NULL AND (ps.system_slug IN ({$quoted}){$winCond}))";
            $parts[] = "{$alias}.pipeline_status IN ({$quoted})";
        }
        if (!empty($matched['include_customer_status'])) {
            $parts[] = "{$alias}.status = 'customer'";
        }
        return !empty($parts) ? '(' . implode(' OR ', $parts) . ')' : null;
    }

    public static function getAcademicPrograms(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['academic_programs'])) {
            return self::$memCache[$tenantId]['academic_programs'];
        }
        $stmt = $db->prepare("SELECT * FROM tenant_academic_programs WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY order_index ASC, id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['order_index'] = (int)$r['order_index'];
            $r['match_keywords'] = !empty($r['match_keywords_json']) ? (json_decode($r['match_keywords_json'], true) ?: []) : [];
            $r['curriculum'] = !empty($r['curriculum_json']) ? (json_decode($r['curriculum_json'], true) ?: []) : [];
        }
        unset($r);
        self::$memCache[$tenantId]['academic_programs'] = $rows;
        return $rows;
    }

    public static function getEmailTemplates(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['email_templates'])) {
            return self::$memCache[$tenantId]['email_templates'];
        }
        $stmt = $db->prepare("SELECT * FROM tenant_email_templates WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['variables'] = !empty($r['variables_json']) ? (json_decode($r['variables_json'], true) ?: []) : [];
        }
        unset($r);
        self::$memCache[$tenantId]['email_templates'] = $rows;
        return $rows;
    }

    public static function getApprovalWorkflows(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['approval_workflows'])) {
            return self::$memCache[$tenantId]['approval_workflows'];
        }
        $stmt = $db->prepare("SELECT * FROM tenant_approval_workflows WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['allow_creator_self_approve'] = (int)$r['allow_creator_self_approve'];
            $r['auto_approve_for_executives'] = (int)$r['auto_approve_for_executives'];
            $r['levels_config'] = !empty($r['levels_config']) ? (json_decode($r['levels_config'], true) ?: []) : [];
        }
        unset($r);
        self::$memCache[$tenantId]['approval_workflows'] = $rows;
        return $rows;
    }

    public static function getNotificationRules(PDO $db, int $tenantId = 1): array
    {
        self::ensureSchema($db, $tenantId);
        if (isset(self::$memCache[$tenantId]['notification_rules'])) {
            return self::$memCache[$tenantId]['notification_rules'];
        }
        $stmt = $db->prepare("SELECT * FROM tenant_notification_rules WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY id ASC");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['include_owner'] = (int)$r['include_owner'];
            $r['include_team_leader'] = (int)$r['include_team_leader'];
            $r['target_roles'] = !empty($r['target_roles_json']) ? (json_decode($r['target_roles_json'], true) ?: []) : [];
            $r['target_departments'] = !empty($r['target_departments_json']) ? (json_decode($r['target_departments_json'], true) ?: []) : [];
            $r['target_user_ids'] = !empty($r['target_user_ids_json']) ? array_values(array_map('intval', json_decode($r['target_user_ids_json'], true) ?: [])) : [];
            $r['channels'] = !empty($r['channels_json']) ? (json_decode($r['channels_json'], true) ?: []) : [];
        }
        unset($r);
        self::$memCache[$tenantId]['notification_rules'] = $rows;
        return $rows;
    }

    public static function expandRoleSlugsForTenant(PDO $db, int $tenantId, array $targetRoles): array
    {
        $raw = array_values(array_filter(array_map(fn($r) => strtolower(trim((string)$r)), $targetRoles)));
        if (empty($raw)) {
            return [];
        }
        $canonTargets = array_values(array_unique(array_map([self::class, 'normalizeRoleSlug'], $raw)));
        $expanded = array_merge($raw, $canonTargets);

        $legacyMap = [
            'superadmin' => ['super_admin'],
            'sales' => ['sale', 'telesale', 'consultant'],
            'sale_admin' => ['saleadmin'],
            'marketing' => ['mkt'],
            'accountant' => ['ke_toan', 'ketoan', 'finance'],
            'hr' => ['nhan_su', 'human_resources'],
            'academic' => ['hoc_vu', 'hoc_thuat', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor'],
            'assistant' => ['tro_ly'],
        ];
        foreach ($canonTargets as $ct) {
            if (!empty($legacyMap[$ct])) {
                $expanded = array_merge($expanded, $legacyMap[$ct]);
            }
        }

        try {
            foreach (self::getRoles($db, $tenantId) as $rDef) {
                $slug = strtolower(trim((string)($rDef['role_slug'] ?? '')));
                if ($slug === '') {
                    continue;
                }
                $grpCanon = self::roleGroupToCanonicalRole((string)($rDef['role_group'] ?? 'staff'));
                if (in_array($slug, $expanded, true) || in_array($grpCanon, $canonTargets, true)) {
                    $expanded[] = $slug;
                }
            }
        } catch (\Throwable $e) {
        }

        return array_values(array_unique(array_filter($expanded)));
    }

    public static function resolveUserApprover(PDO $db, int $tenantId, int $submitterUserId, string $moduleKey = 'leave'): ?int
    {
        self::ensureSchema($db, $tenantId);
        // 1. Submitter's assigned team leader / default_approver_id
        $stmtU = $db->prepare("SELECT u.id, u.role, u.department, u.team_id, t.leader_id, t.default_approver_id, t.department_code
                               FROM users u
                               LEFT JOIN teams t ON u.team_id = t.id AND t.tenant_id = u.tenant_id AND t.deleted_at IS NULL
                               WHERE u.id = ? AND u.tenant_id = ? LIMIT 1");
        $stmtU->execute([$submitterUserId, $tenantId]);
        $uRow = $stmtU->fetch(PDO::FETCH_ASSOC);

        if ($uRow) {
            $teamApprover = (int)($uRow['default_approver_id'] ?: $uRow['leader_id'] ?: 0);
            if ($teamApprover > 0 && $teamApprover !== $submitterUserId) {
                return $teamApprover;
            }

            // 2. Match department_code by user's department text or role
            $deptCode = $uRow['department_code'] ?? '';
            if ($deptCode === '' && !empty($uRow['department'])) {
                [$deptCode] = self::classifyDepartmentCode((string)$uRow['department'], 0, $tenantId);
            }
            if ($deptCode !== '') {
                $stmtDept = $db->prepare("SELECT COALESCE(default_approver_id, leader_id) FROM teams WHERE tenant_id = ? AND department_code = ? AND deleted_at IS NULL AND COALESCE(default_approver_id, leader_id) IS NOT NULL AND COALESCE(default_approver_id, leader_id) != ? ORDER BY id ASC LIMIT 1");
                $stmtDept->execute([$tenantId, $deptCode, $submitterUserId]);
                $deptLeader = (int)$stmtDept->fetchColumn();
                if ($deptLeader > 0) {
                    return $deptLeader;
                }
            }
        }

        // 3. Module workflow fallback roles / department
        $workflows = self::getApprovalWorkflows($db, $tenantId);
        foreach ($workflows as $wf) {
            if ($wf['module_key'] === $moduleKey) {
                $lvl1 = $wf['levels_config']['level_1'] ?? [];
                if (!empty($lvl1['user_ids']) && is_array($lvl1['user_ids'])) {
                    foreach ($lvl1['user_ids'] as $uid) {
                        if ((int)$uid > 0 && (int)$uid !== $submitterUserId) {
                            return (int)$uid;
                        }
                    }
                }
                $fbDept = $lvl1['department'] ?? $lvl1['fallback_department'] ?? '';
                if ($fbDept !== '') {
                    $stmtFb = $db->prepare("SELECT COALESCE(default_approver_id, leader_id) FROM teams WHERE tenant_id = ? AND department_code = ? AND deleted_at IS NULL AND COALESCE(default_approver_id, leader_id) != ? LIMIT 1");
                    $stmtFb->execute([$tenantId, $fbDept, $submitterUserId]);
                    $fbLeader = (int)$stmtFb->fetchColumn();
                    if ($fbLeader > 0) {
                        return $fbLeader;
                    }
                }
                $roles = self::expandRoleSlugsForTenant($db, $tenantId, array_merge($lvl1['roles'] ?? [], $lvl1['fallback_roles'] ?? []));
                if (!empty($roles)) {
                    $ph = implode(',', array_fill(0, count($roles), '?'));
                    $params = array_values(array_merge([$tenantId, $submitterUserId], $roles));
                    $stmtR = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL AND id != ? AND LOWER(role) IN ($ph) ORDER BY id ASC LIMIT 1");
                    $stmtR->execute($params);
                    $rUid = (int)$stmtR->fetchColumn();
                    if ($rUid > 0) {
                        return $rUid;
                    }
                }
                break;
            }
        }

        // 4. Tenant Director / Admin fallback (including custom executive/system_admin roles)
        $execRoles = self::expandRoleSlugsForTenant($db, $tenantId, ['director', 'admin', 'superadmin']);
        $phExec = implode(',', array_fill(0, count($execRoles), '?'));
        $stmtExec = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL AND id != ? AND LOWER(role) IN ($phExec) ORDER BY CASE WHEN LOWER(role) = 'director' THEN 0 ELSE 1 END, id ASC LIMIT 1");
        $stmtExec->execute(array_values(array_merge([$tenantId, $submitterUserId], $execRoles)));
        $execId = (int)$stmtExec->fetchColumn();
        return $execId > 0 ? $execId : null;
    }

    public static function resolveHrRepresentative(PDO $db, int $tenantId, int $excludeUserId = 0): ?array
    {
        self::ensureSchema($db, $tenantId);
        // 1. Leader of HR team in this tenant
        $stmt = $db->prepare("
            SELECT u.id, u.full_name, u.avatar_url, u.role, u.email
            FROM teams t
            JOIN users u ON u.id = COALESCE(t.default_approver_id, t.leader_id) AND u.tenant_id = t.tenant_id
            WHERE t.tenant_id = ? AND t.department_code = 'hr' AND t.deleted_at IS NULL
              AND u.is_active = 1 AND u.deleted_at IS NULL AND u.id != ?
            ORDER BY t.id ASC LIMIT 1
        ");
        $stmt->execute([$tenantId, $excludeUserId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            return $row;
        }
        // 2. Active user with HR role (including custom HR roles) in this tenant
        $hrRoles = self::expandRoleSlugsForTenant($db, $tenantId, ['hr']);
        $phHr = implode(',', array_fill(0, count($hrRoles), '?'));
        $stmt2 = $db->prepare("
            SELECT id, full_name, avatar_url, role, email
            FROM users
            WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL AND id != ?
              AND LOWER(role) IN ($phHr)
            ORDER BY id ASC LIMIT 1
        ");
        $stmt2->execute(array_values(array_merge([$tenantId, $excludeUserId], $hrRoles)));
        $row2 = $stmt2->fetch(PDO::FETCH_ASSOC);
        return $row2 ?: null;
    }

    public static function resolveNotificationRecipients(PDO $db, int $tenantId, string $eventKey, array $context = []): array
    {
        self::ensureSchema($db, $tenantId);
        $actorId = (int)($context['actor_id'] ?? $context['exclude_user_id'] ?? 0);
        $ownerId = (int)($context['owner_id'] ?? 0);
        $submitterId = (int)($context['submitter_id'] ?? $ownerId ?: $actorId);

        $rules = self::getNotificationRules($db, $tenantId);
        $matched = null;
        foreach ($rules as $r) {
            if ($r['event_key'] === $eventKey) {
                $matched = $r;
                break;
            }
        }
        if (!$matched) {
            return [];
        }

        $candidateIds = [];
        foreach ($matched['target_user_ids'] as $uid) {
            if ((int)$uid > 0) {
                $candidateIds[] = (int)$uid;
            }
        }
        if (!empty($matched['include_owner']) && $ownerId > 0) {
            $candidateIds[] = $ownerId;
        }
        if (!empty($matched['include_team_leader']) && $submitterId > 0) {
            $stmtTl = $db->prepare("SELECT t.leader_id FROM users u JOIN teams t ON u.team_id = t.id AND t.tenant_id = u.tenant_id WHERE u.id = ? AND u.tenant_id = ? AND t.deleted_at IS NULL LIMIT 1");
            $stmtTl->execute([$submitterId, $tenantId]);
            $tlId = (int)$stmtTl->fetchColumn();
            if ($tlId > 0) {
                $candidateIds[] = $tlId;
            }
        }

        $roles = self::expandRoleSlugsForTenant($db, $tenantId, $matched['target_roles'] ?? []);
        if (!empty($roles)) {
            $ph = implode(',', array_fill(0, count($roles), '?'));
            $stmtR = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL AND LOWER(role) IN ($ph)");
            $stmtR->execute(array_values(array_merge([$tenantId], $roles)));
            foreach ($stmtR->fetchAll(PDO::FETCH_COLUMN) ?: [] as $rid) {
                $candidateIds[] = (int)$rid;
            }
        }

        $depts = array_values(array_filter(array_map('strtolower', $matched['target_departments'] ?? [])));
        if (!empty($depts)) {
            $phD = implode(',', array_fill(0, count($depts), '?'));
            $stmtD = $db->prepare("
                SELECT u.id
                FROM users u
                JOIN teams t ON (u.team_id = t.id OR u.id = t.leader_id) AND t.tenant_id = u.tenant_id
                WHERE u.tenant_id = ? AND u.is_active = 1 AND u.deleted_at IS NULL
                  AND t.deleted_at IS NULL AND LOWER(t.department_code) IN ($phD)
            ");
            $stmtD->execute(array_merge([$tenantId], $depts));
            foreach ($stmtD->fetchAll(PDO::FETCH_COLUMN) ?: [] as $did) {
                $candidateIds[] = (int)$did;
            }
        }

        $candidateIds = array_values(array_unique(array_filter($candidateIds, fn($id) => $id > 0 && $id !== $actorId)));
        if (empty($candidateIds)) {
            return [];
        }

        $phU = implode(',', array_fill(0, count($candidateIds), '?'));
        $stmtUsers = $db->prepare("SELECT id, full_name, email, role, zalo_chat_id, telegram_chat_id FROM users WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL AND id IN ($phU)");
        $stmtUsers->execute(array_merge([$tenantId], $candidateIds));
        return $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public static function getBootstrapPayload(PDO $db, array $auth): array
    {
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        self::ensureSchema($db, $tenantId);

        $org = self::getOrganizationProfile($db, $tenantId, false);
        $roles = self::getRoles($db, $tenantId);
        $stages = self::getPipelineStages($db, $tenantId);
        $studentTabs = self::getStudentTabs($db, $tenantId);
        $programs = self::getAcademicPrograms($db, $tenantId);
        $templates = self::getEmailTemplates($db, $tenantId);
        $workflows = self::getApprovalWorkflows($db, $tenantId);
        $notifRules = self::getNotificationRules($db, $tenantId);

        $teams = [];
        try {
            $stmtT = $db->prepare("SELECT id, name, department_code, is_sales_team, leader_id, co_leader_ids, default_approver_id, branch FROM teams WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name ASC");
            $stmtT->execute([$tenantId]);
            $teams = $stmtT->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
        }

        $effectivePermissions = [];
        foreach (self::MODULES as $mod) {
            $effectivePermissions[$mod] = [
                'read' => self::resolvePermissionScope($db, $auth, $mod, 'read'),
                'write' => self::resolvePermissionScope($db, $auth, $mod, 'write'),
                'delete' => self::resolvePermissionScope($db, $auth, $mod, 'delete'),
                'approve' => self::resolvePermissionScope($db, $auth, $mod, 'approve'),
            ];
        }

        return [
            'tenant_id' => $tenantId,
            'organization' => $org,
            'effective_permissions' => $effectivePermissions,
            'roles' => $roles,
            'teams' => $teams,
            'non_sales_team_ids' => self::getNonSalesTeamIds($db, $tenantId),
            'pipeline_stages' => $stages,
            'student_tabs' => $studentTabs,
            'academic_programs' => $programs,
            'email_templates' => $templates,
            'approval_workflows' => $workflows,
            'notification_rules' => $notifRules,
        ];
    }
}
