<?php
// backend/run_migrations.php

// Safe check: Allow CLI, inclusion by diagnostic script, or token validation
$isCli = (php_sapi_name() === 'cli');
$hasValidToken = (($_GET['token'] ?? '') === 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7') || defined('DIAG_TOKEN');
if (!$isCli && !$hasValidToken) {
    http_response_code(403);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Forbidden: Direct access to database migrations is not allowed']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$apply = (isset($_GET['apply']) && $_GET['apply'] === 'true')
      || (isset($_GET['run']) && $_GET['run'] === '1')
      || (isset($_POST['execute_migration']) && $_POST['execute_migration'] === '1')
      || ($isCli && in_array('--apply', $argv));

$targetVersion = 232;
$currentVersion = 186;

// Query current DB version
$checkSettings = $conn->query("SHOW TABLES LIKE 'system_settings'");
if ($checkSettings && $checkSettings->num_rows > 0) {
    $vStmt = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'db_version' LIMIT 1");
    if ($vStmt && $vStmt->num_rows > 0) {
        $currentVersion = (int)$vStmt->fetch_assoc()['setting_value'];
    }
}

if (!$isCli) {
    header("Content-Type: text/html; charset=utf-8");
    echo "<html><head><title>Hệ thống Cập nhật Cơ sở dữ liệu</title>";
    echo "<style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; color: #334155; background-color: #f8fafc; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 10px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .badge { display: inline-block; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
        .badge-success { background: #dcfce7; color: #15803d; }
        .step-log { font-family: monospace; font-size: 0.8125rem; background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 8px; overflow-x: auto; max-height: 400px; }
        .step-log .success { color: #4ade80; }
        .step-log .error { color: #f87171; font-weight: bold; }
    </style></head><body>";
    echo "<h1>⚙️ Hệ thống Cập nhật Cơ sở dữ liệu</h1>";
} else {
    echo "=== HỆ THỐNG CẬP NHẬT CƠ SỞ DỮ LIỆU ===\n";
    echo "Phiên bản hiện tại: " . $currentVersion . "\n";
    echo "Phiên bản mục tiêu: " . $targetVersion . "\n\n";
}

$logMsg = function($msg, $type = 'info') use ($isCli) {
    if ($isCli) {
        if ($type === 'success') echo "[SUCCESS] " . $msg . "\n";
        else if ($type === 'error') echo "[ERROR] " . $msg . "\n";
        else echo "[INFO] " . $msg . "\n";
    } else {
        $class = $type === 'success' ? 'class="success"' : ($type === 'error' ? 'class="error"' : '');
        echo "<div {$class}>" . htmlspecialchars($msg) . "</div>";
        @ob_flush();
        flush();
    }
};

// Advisory Lock
$lockStmt = $conn->prepare("SELECT GET_LOCK('db_migration_lock', 30) as get_lock");
if ($lockStmt) {
    $lockStmt->execute();
    $lockRes = $lockStmt->get_result()->fetch_assoc();
    $lockStmt->close();
}

// Re-synchronize Views (accounts & consultants) with complete columns on every deployment
try {
    $conn->query("
        CREATE OR REPLACE VIEW `accounts` AS 
        SELECT 
          `id`, 
          `tenant_id`,
          `username`, 
          `password_hash`,
          `password_hash` AS `password`, 
          `full_name` AS `name`,
          `job_title`,
          `email`, 
          `role`, 
          `status`, 
          `is_confirmed`, 
          `confirm_token`, 
          `last_login_at` AS `last_login`, 
          `avatar_url` AS `avatar`,
          `signature_url`,
          `zalo_chat_id`,
          `telegram_chat_id`,
          `created_at`,
          `dob`,
          `gender`,
          `citizen_id`,
          `address`,
          `bank_name`,
          `bank_account`,
          `phone`,
          `is_active`,
          `team_id`
        FROM `users`
    ");

    $conn->query("
        CREATE OR REPLACE VIEW `consultants` AS 
        SELECT 
          `id`, 
          `tenant_id`,
          `full_name` AS `name`, 
          `job_title`,
          `email`, 
          `role`, 
          `status`, 
          `leave_start`, 
          `leave_end`, 
          `work_start_time`, 
          `work_end_time`, 
          `work_schedule`, 
          `avatar_url` AS `avatar`, 
          `signature_url`,
          `zalo_chat_id`,
          `telegram_chat_id`,
          `vacation_mode`, 
          `overtime_mode`,
          `team_id`,
          `dob`,
          `gender`,
          `citizen_id`,
          `address`,
          `bank_name`,
          `bank_account`,
          `extra_fields_json`,
          `use_custom_work_hours`,
          `created_at`,
          `phone`,
          `is_active`
        FROM `users`
    ");
} catch (\Throwable $e) {
    $logMsg("Lỗi khi đồng bộ view: " . $e->getMessage(), "error");
}

$isForce = isset($_GET['force']) || (isset($_GET['run']) && $_GET['run'] === 'force') || ($isCli && in_array('--force', $argv));

if ($currentVersion >= $targetVersion && !$isForce) {
    $logMsg("Cơ sở dữ liệu đã ở phiên bản mới nhất (v{$currentVersion}). Đã bỏ qua các nhiệm vụ nâng cấp cũ.", "success");
    if (!$isCli) echo "</body></html>";
    return;
}

$logMsg("Bắt đầu tự đồng bộ cấu trúc cơ sở dữ liệu (Version $currentVersion -> $targetVersion)...", "info");

try {
    // 2. Ensure task_muted_notifications table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `task_muted_notifications` (
          `task_id` INT(11) NOT NULL,
          `user_id` INT(11) NOT NULL,
          `muted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`task_id`, `user_id`),
          KEY `idx_task_muted_user` (`user_id`, `task_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Ensure task_hidden_users table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `task_hidden_users` (
          `task_id` INT(11) NOT NULL,
          `user_id` INT(11) NOT NULL,
          `hidden_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`task_id`, `user_id`),
          KEY `idx_task_hidden_user` (`user_id`, `task_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 3. Ensure check_ins table has all necessary columns (late_minutes, selfie_url, reason, check_out_time, early_minutes, check_out_status)
    $chkColLM = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'late_minutes'");
    if (!$chkColLM || $chkColLM->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN late_minutes INT DEFAULT 0 COMMENT 'Số phút đi trễ' AFTER check_in_time");
        $logMsg("Đã bổ sung cột late_minutes vào bảng check_ins.", "success");
    }
    $chkColSelfie = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'selfie_url'");
    if (!$chkColSelfie || $chkColSelfie->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN selfie_url TEXT NULL COMMENT 'Ảnh selfie chấm công' AFTER late_minutes");
        $logMsg("Đã bổ sung cột selfie_url vào bảng check_ins.", "success");
    }
    $chkColReason = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'reason'");
    if (!$chkColReason || $chkColReason->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN reason TEXT NULL COMMENT 'Lý do đi trễ / bổ sung' AFTER status");
        $logMsg("Đã bổ sung cột reason vào bảng check_ins.", "success");
    }
    $chkColCO = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'check_out_time'");
    if (!$chkColCO || $chkColCO->num_rows == 0) {
        $conn->query("ALTER TABLE check_ins ADD COLUMN check_out_time DATETIME NULL COMMENT 'Thời gian chấm công ra ca' AFTER check_in_time");
        $conn->query("ALTER TABLE check_ins ADD COLUMN early_minutes INT DEFAULT 0 COMMENT 'Số phút về sớm' AFTER late_minutes");
        $conn->query("ALTER TABLE check_ins ADD COLUMN check_out_status VARCHAR(50) DEFAULT NULL COMMENT 'Trạng thái ra ca (on_time, early)' AFTER status");
        $logMsg("Đã bổ sung các cột chấm công ra ca (check_out_time, early_minutes, check_out_status) vào bảng check_ins.", "success");
    }

    // Ensure signature_url in users table is LONGTEXT to support Base64 images or long URLs safely
    $chkSigCol = $conn->query("SHOW COLUMNS FROM users LIKE 'signature_url'");
    if (!$chkSigCol || $chkSigCol->num_rows == 0) {
        $conn->query("ALTER TABLE users ADD COLUMN signature_url LONGTEXT NULL COMMENT 'Chữ ký mẫu cá nhân'");
        $logMsg("Đã bổ sung cột signature_url vào bảng users.", "success");
    } else {
        $conn->query("ALTER TABLE users MODIFY COLUMN signature_url LONGTEXT NULL COMMENT 'Chữ ký mẫu cá nhân'");
    }

    // 4. Ensure default system settings exist for advanced features
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_enabled', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_trigger_day', '1')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_date_mode', 'previous_month')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('require_checkout', '1')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('auto_approve_checkin', '1')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('golden_hours_max_leads_per_consultant', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('require_lead_claim', '0')");
    $conn->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('require_checkin_lead', '1')");
    $conn->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('frontend_url', 'https://myerp.ideas.edu.vn')");
    $conn->query("UPDATE users SET is_active = 1, status = 'active' WHERE email IS NOT NULL AND email != '' AND (is_active = 0 OR status IS NULL OR status != 'active')");

    // 5. Ensure 2FA columns exist in users table
    $chk2FA = $conn->query("SHOW COLUMNS FROM users LIKE 'two_factor_enabled'");
    if (!$chk2FA || $chk2FA->num_rows == 0) {
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0 AFTER is_active");
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_type VARCHAR(20) DEFAULT 'email' AFTER two_factor_enabled");
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL AFTER two_factor_type");
        $conn->query("ALTER TABLE users ADD COLUMN two_factor_backup_codes TEXT NULL AFTER two_factor_secret");
        $logMsg("Đã bổ sung các cột 2FA (two_factor_enabled, two_factor_type, two_factor_secret, two_factor_backup_codes) vào bảng users.", "success");
    }

    // 6. Ensure extended CRM columns exist in contacts and leads tables
    $extendedCols = [
        'phone2' => "VARCHAR(50) NULL COMMENT 'Số điện thoại 2 / phụ'",
        'gender' => "VARCHAR(20) NULL COMMENT 'Giới tính'",
        'dob' => "DATE NULL COMMENT 'Ngày sinh'",
        'citizen_id' => "VARCHAR(50) NULL COMMENT 'Số CCCD / CMND'",
        'district' => "VARCHAR(100) NULL COMMENT 'Quận / Huyện'",
        'company' => "VARCHAR(200) NULL COMMENT 'Công ty làm việc'",
        'tax_code' => "VARCHAR(50) NULL COMMENT 'Mã số thuế'",
        'budget' => "DECIMAL(15,2) NULL DEFAULT 0.00 COMMENT 'Ngân sách tài chính'",
        'demand_type' => "VARCHAR(100) NULL COMMENT 'Mục đích nhu cầu (Ở/Đầu tư/Cho thuê)'",
        'property_type' => "VARCHAR(100) NULL COMMENT 'Loại BĐS quan tâm'",
        'bedroom_count' => "VARCHAR(50) NULL COMMENT 'Số phòng ngủ mong muốn'",
        'preferred_location' => "VARCHAR(255) NULL COMMENT 'Khu vực / Dự án quan tâm'",
        'utm_campaign' => "VARCHAR(255) NULL COMMENT 'Tên chiến dịch Ads (UTM Campaign)'",
        'utm_medium' => "VARCHAR(255) NULL COMMENT 'Hình thức Ads (UTM Medium)'",
        'utm_content' => "VARCHAR(255) NULL COMMENT 'Mẫu QC / Adset (UTM Content)'",
        'utm_term' => "VARCHAR(255) NULL COMMENT 'Từ khóa Ads (UTM Term)'",
        'platform' => "VARCHAR(100) NULL COMMENT 'Nền tảng Data (Meta/Google/TikTok/Zalo)'",
        'form_name' => "VARCHAR(255) NULL COMMENT 'Tên Form / Landing Page'",
        'zalo_phone' => "VARCHAR(50) NULL COMMENT 'Số Zalo / Link Zalo'",
        'facebook_link' => "VARCHAR(255) NULL COMMENT 'Link Facebook cá nhân'"
    ];

    foreach (['contacts', 'leads'] as $tbl) {
        $tblCheck = $conn->query("SHOW TABLES LIKE '$tbl'");
        if ($tblCheck && $tblCheck->num_rows > 0) {
            foreach ($extendedCols as $colName => $colDef) {
                $colCheck = $conn->query("SHOW COLUMNS FROM `$tbl` LIKE '$colName'");
                if (!$colCheck || $colCheck->num_rows == 0) {
                    $conn->query("ALTER TABLE `$tbl` ADD COLUMN `$colName` $colDef");
                    $logMsg("Đã tự động bổ sung cột $colName vào bảng $tbl.", "success");
                }
            }
        }
    }

    // 7. Ensure email_otps table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `email_otps` (
          `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT(11) NOT NULL,
          `email` VARCHAR(255) NOT NULL,
          `otp_code` VARCHAR(10) NOT NULL,
          `type` VARCHAR(50) NOT NULL DEFAULT '2fa',
          `expires_at` DATETIME NOT NULL,
          `is_used` TINYINT(1) NOT NULL DEFAULT 0,
          `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
          KEY `idx_email_otp_lookup` (`email`, `otp_code`, `type`, `is_used`),
          KEY `idx_user_otp` (`user_id`, `type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Ensure teams table has avatar_url column
    $teamTblCheck = $conn->query("SHOW TABLES LIKE 'teams'");
    if ($teamTblCheck && $teamTblCheck->num_rows > 0) {
        $colCheck = $conn->query("SHOW COLUMNS FROM `teams` LIKE 'avatar_url'");
        if (!$colCheck || $colCheck->num_rows == 0) {
            $conn->query("ALTER TABLE `teams` ADD COLUMN `avatar_url` TEXT NULL AFTER `name`");
            $logMsg("Đã tự động bổ sung cột avatar_url vào bảng teams.", "success");
        }
    }

    // Ensure ticket_comments table has parent_id column
    $ticketCommentsCheck = $conn->query("SHOW TABLES LIKE 'ticket_comments'");
    if ($ticketCommentsCheck && $ticketCommentsCheck->num_rows > 0) {
        $colCheck = $conn->query("SHOW COLUMNS FROM `ticket_comments` LIKE 'parent_id'");
        if (!$colCheck || $colCheck->num_rows == 0) {
            $conn->query("ALTER TABLE `ticket_comments` ADD COLUMN `parent_id` INT(11) NULL DEFAULT NULL AFTER `user_id`");
            $logMsg("Đã tự động bổ sung cột parent_id vào bảng ticket_comments.", "success");
        }
    }

    // 8. Ensure blocked_leads table exists
    $conn->query("
        CREATE TABLE IF NOT EXISTS `blocked_leads` (
          `id` INT(11) AUTO_INCREMENT PRIMARY KEY,
          `tenant_id` INT(11) DEFAULT 1,
          `phone` VARCHAR(50) DEFAULT NULL,
          `email` VARCHAR(255) DEFAULT NULL,
          `reason` VARCHAR(255) DEFAULT NULL,
          `created_by` INT(11) DEFAULT NULL,
          `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          KEY `idx_blocked_phone` (`phone`),
          KEY `idx_blocked_email` (`email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    $logMsg("Đã kiểm tra và đảm bảo bảng blocked_leads tồn tại.", "success");

    // 8.5. Add performance indexes for Scale 1M+ (Version 188)
    $chkIdxCF = $conn->query("SHOW INDEX FROM `cloud_files` WHERE Key_name = 'idx_tenant_contact'");
    if (!$chkIdxCF || $chkIdxCF->num_rows == 0) {
        $conn->query("ALTER TABLE `cloud_files` ADD INDEX `idx_tenant_contact` (`tenant_id`, `contact_id`)");
        $logMsg("Đã bổ sung index idx_tenant_contact vào bảng cloud_files.", "success");
    }
    
    $chkIdxDep = $conn->query("SHOW INDEX FROM `deposits` WHERE Key_name = 'idx_contact'");
    if (!$chkIdxDep || $chkIdxDep->num_rows == 0) {
        $conn->query("ALTER TABLE `deposits` ADD INDEX `idx_contact` (`contact_id`)");
        $logMsg("Đã bổ sung index idx_contact vào bảng deposits.", "success");
    }

    $chkIdxDM = $conn->query("SHOW INDEX FROM `deposit_milestones` WHERE Key_name = 'idx_deposit'");
    if (!$chkIdxDM || $chkIdxDM->num_rows == 0) {
        $conn->query("ALTER TABLE `deposit_milestones` ADD INDEX `idx_deposit` (`deposit_id`)");
        $logMsg("Đã bổ sung index idx_deposit vào bảng deposit_milestones.", "success");
    }

    $chkIdxCont = $conn->query("SHOW INDEX FROM `contacts` WHERE Key_name = 'idx_tenant_status_owner'");
    if (!$chkIdxCont || $chkIdxCont->num_rows == 0) {
        $conn->query("ALTER TABLE `contacts` ADD INDEX `idx_tenant_status_owner` (`tenant_id`, `status`, `owner_id`, `created_at`)");
        $logMsg("Đã bổ sung index idx_tenant_status_owner vào bảng contacts.", "success");
    }

    // 8.6. Add location columns for Check-in / Check-out (Version 189)
    $chkLat = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'latitude'");
    if (!$chkLat || $chkLat->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `latitude` VARCHAR(50) NULL COMMENT 'Vĩ độ check-in', ADD COLUMN `longitude` VARCHAR(50) NULL COMMENT 'Kinh độ check-in'");
        $logMsg("Đã bổ sung cột latitude, longitude vào bảng check_ins.", "success");
    }
    $chkAddr = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'location_address'");
    if (!$chkAddr || $chkAddr->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `location_address` VARCHAR(500) NULL COMMENT 'Địa chỉ check-in'");
        $logMsg("Đã bổ sung cột location_address vào bảng check_ins.", "success");
    }
    $chkCOLat = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'checkout_latitude'");
    if (!$chkCOLat || $chkCOLat->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `checkout_latitude` VARCHAR(50) NULL COMMENT 'Vĩ độ check-out', ADD COLUMN `checkout_longitude` VARCHAR(50) NULL COMMENT 'Kinh độ check-out'");
        $logMsg("Đã bổ sung cột checkout_latitude, checkout_longitude vào bảng check_ins.", "success");
    }
    $chkCOAddr = $conn->query("SHOW COLUMNS FROM `check_ins` LIKE 'checkout_location_address'");
    if (!$chkCOAddr || $chkCOAddr->num_rows == 0) {
        $conn->query("ALTER TABLE `check_ins` ADD COLUMN `checkout_location_address` VARCHAR(500) NULL COMMENT 'Địa chỉ check-out'");
        $logMsg("Đã bổ sung cột checkout_location_address vào bảng check_ins.", "success");
    }

    // 8.7. Add next_attempt_date column to leads (Version 190)
    $chkNAD = $conn->query("SHOW COLUMNS FROM `leads` LIKE 'next_attempt_date'");
    if (!$chkNAD || $chkNAD->num_rows == 0) {
        $conn->query("ALTER TABLE `leads` ADD COLUMN `next_attempt_date` DATETIME NULL COMMENT 'Thời gian thử phân bổ lại tiếp theo'");
        $logMsg("Đã bổ sung cột next_attempt_date vào bảng leads.", "success");
    }

    // Add default setting for lead_max_recall_attempts
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('lead_max_recall_attempts', '2') ON DUPLICATE KEY UPDATE setting_value = IFNULL(setting_value, '2')");

    // Add default setting for lead_recall_cooldown_minutes
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('lead_recall_cooldown_minutes', '30') ON DUPLICATE KEY UPDATE setting_value = IFNULL(setting_value, '30')");

    // Add default setting for enable_lead_recall
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('enable_lead_recall', '0') ON DUPLICATE KEY UPDATE setting_value = IFNULL(setting_value, '0')");

    // Add default setting for hrm_lateness_penalty_enabled
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('hrm_lateness_penalty_enabled', '0') ON DUPLICATE KEY UPDATE setting_value = IFNULL(setting_value, '0')");

    // Add default setting for parallel_assignment_trigger_status
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('parallel_assignment_trigger_status', 'chua_xac_dinh') ON DUPLICATE KEY UPDATE setting_value = IFNULL(setting_value, 'chua_xac_dinh')");

    // 8.8. Add partner distribution network columns to companies (Version 191)
    $chkTier = $conn->query("SHOW COLUMNS FROM `companies` LIKE 'tier'");
    if (!$chkTier || $chkTier->num_rows == 0) {
        $conn->query("ALTER TABLE `companies` 
            ADD COLUMN `tier` VARCHAR(50) DEFAULT 'f1' COMMENT 'Cấp đại lý: f1, f2, f3, ctv', 
            ADD COLUMN `parent_id` INT NULL COMMENT 'Đại lý cấp trên trực tiếp', 
            ADD COLUMN `commission_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Tỷ lệ hoa hồng liên kết %', 
            ADD COLUMN `focus_markets` TEXT NULL COMMENT 'Phân khúc/Thị trường thế mạnh', 
            ADD COLUMN `agent_count` INT DEFAULT 0 COMMENT 'Số lượng sales'");
        $logMsg("Đã bổ sung các cột phân cấp đại lý (tier, parent_id, commission_rate, focus_markets, agent_count) vào bảng companies.", "success");
    }

    $conn->query("CREATE TABLE IF NOT EXISTS `hrm_profiles` (
        `user_id` INT PRIMARY KEY,
        `joined_date` DATE NOT NULL,
        `base_salary` DECIMAL(15,2) DEFAULT 0.00,
        `deal_salary` DECIMAL(15,2) DEFAULT 0.00,
        `has_insurance` TINYINT(1) DEFAULT 1,
        `allowance_meal` DECIMAL(15,2) DEFAULT 0.00,
        `allowance_travel` DECIMAL(15,2) DEFAULT 0.00,
        `allowance_phone` DECIMAL(15,2) DEFAULT 0.00,
        `kpi_target` DECIMAL(15,2) DEFAULT 0.00,
        `kpi_multiplier_rules` TEXT NULL,
        `custom_fields_json` TEXT NULL,
        `insurance_rate_bhxh` DECIMAL(5,2) DEFAULT 8.00,
        `insurance_rate_bhyt` DECIMAL(5,2) DEFAULT 1.50,
        `insurance_rate_bhtn` DECIMAL(5,2) DEFAULT 1.00,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS `hrm_contracts` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `contract_code` VARCHAR(50) NOT NULL,
        `contract_type` VARCHAR(30) DEFAULT 'probation',
        `salary_base` DECIMAL(15,2) DEFAULT 0.00,
        `salary_deal` DECIMAL(15,2) DEFAULT 0.00,
        `salary_type` VARCHAR(10) DEFAULT 'net',
        `probation_rate` DECIMAL(5,2) DEFAULT 85.00,
        `start_date` DATE NOT NULL,
        `end_date` DATE NULL,
        `status` VARCHAR(20) DEFAULT 'active',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_hrm_contracts_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS `hrm_salary_advances` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `amount` DECIMAL(15,2) DEFAULT 0.00,
        `request_date` DATE NOT NULL,
        `reason` TEXT NULL,
        `status` VARCHAR(20) DEFAULT 'pending',
        `deducted_payslip_id` INT NULL,
        `approver_id` INT NULL,
        `approver_id_2` INT NULL,
        `approved_by_2` INT NULL,
        `status_level_1` VARCHAR(20) DEFAULT 'pending',
        `status_level_2` VARCHAR(20) DEFAULT 'pending',
        `related_user_ids` TEXT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_hrm_advances_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS `hrm_leave_requests` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `leave_type` VARCHAR(30) DEFAULT 'annual',
        `start_date` DATETIME NOT NULL,
        `end_date` DATETIME NOT NULL,
        `total_days` DECIMAL(3,1) DEFAULT 1.0,
        `unpaid_days` DECIMAL(3,1) DEFAULT 0.0,
        `reason` TEXT NULL,
        `status` VARCHAR(20) DEFAULT 'pending',
        `approved_by` INT NULL,
        `approver_id` INT NULL,
        `approver_id_2` INT NULL,
        `approved_by_2` INT NULL,
        `status_level_1` VARCHAR(20) DEFAULT 'pending',
        `status_level_2` VARCHAR(20) DEFAULT 'pending',
        `related_user_ids` TEXT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_hrm_leaves_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS `hrm_assets` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `asset_name` VARCHAR(255) NOT NULL,
        `asset_code` VARCHAR(100) NOT NULL,
        `given_date` DATE NOT NULL,
        `returned_date` DATE NULL,
        `condition_note` TEXT NULL,
        `status` VARCHAR(20) DEFAULT 'assigned',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_hrm_assets_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS `monthly_payslips` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `month_year` VARCHAR(7) NOT NULL,
        `work_days_required` INT DEFAULT 26,
        `work_days_actual` DECIMAL(4,1) DEFAULT 0.0,
        `lateness_minutes` INT DEFAULT 0,
        `lateness_penalty` DECIMAL(15,2) DEFAULT 0.00,
        `salary_basic_calculated` DECIMAL(15,2) DEFAULT 0.00,
        `allowance_total` DECIMAL(15,2) DEFAULT 0.00,
        `kpi_bonus` DECIMAL(15,2) DEFAULT 0.00,
        `insurance_bhxh` DECIMAL(15,2) DEFAULT 0.00,
        `insurance_bhyt` DECIMAL(15,2) DEFAULT 0.00,
        `insurance_bhtn` DECIMAL(15,2) DEFAULT 0.00,
        `tax_pit` DECIMAL(15,2) DEFAULT 0.00,
        `advance_deduction` DECIMAL(15,2) DEFAULT 0.00,
        `net_salary` DECIMAL(15,2) DEFAULT 0.00,
        `status` VARCHAR(20) DEFAULT 'draft',
        `signature_url` TEXT NULL,
        `confirmed_at` DATETIME NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uk_user_month` (`user_id`, `month_year`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 9.6. Add roles 'hr', 'accountant', 'marketing' (Version 193)
    if ($currentVersion < 193 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 193 (Cấu hình Role mới và chèn tài khoản)...", "info");
        
        // Update users table enum
        $conn->query("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin','admin','manager','assistant','sales','viewer','superadmin','director','hr','accountant','marketing') NOT NULL DEFAULT 'sales'");
        $logMsg("Đã cập nhật ENUM role của bảng users.", "success");

        // Insert test accounts if they do not exist
        $testUsers = [
            [
                'email' => 'hr@Ideas.test',
                'role' => 'hr',
                'full_name' => 'Nhân sự Demo',
                'username' => 'hr_demo',
                'password' => 'hr123'
            ],
            [
                'email' => 'accountant@Ideas.test',
                'role' => 'accountant',
                'full_name' => 'Kế toán Demo',
                'username' => 'accountant_demo',
                'password' => 'accountant123'
            ],
            [
                'email' => 'marketing@Ideas.test',
                'role' => 'marketing',
                'full_name' => 'Marketing Demo',
                'username' => 'marketing_demo',
                'password' => 'marketing123'
            ]
        ];

        foreach ($testUsers as $tu) {
            $chk = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $chk->execute([$tu['email']]);
            $res = $chk->get_result();
            $exists = $res ? $res->fetch_assoc() : null;
            $chk->close();

            if (!$exists) {
                $hash = password_hash($tu['password'], PASSWORD_BCRYPT);
                $ins = $conn->prepare("
                    INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, is_active, status) 
                    VALUES (1, ?, ?, ?, ?, ?, 1, 'active')
                ");
                $ins->execute([$tu['username'], $tu['email'], $hash, $tu['full_name'], $tu['role']]);
                $ins->close();
                $logMsg("Đã chèn tài khoản thử nghiệm: " . $tu['email'], "success");
            }
        }
        $logMsg("Nâng cấp lên phiên bản 193 hoàn tất.", "success");
    }

    // 9.7. Add custom_fields_json to hrm_profiles (Version 194)
    if ($currentVersion < 194 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 194 (Thêm cột custom_fields_json vào hrm_profiles)...", "info");
        
        $checkCol = $conn->query("SHOW COLUMNS FROM `hrm_profiles` LIKE 'custom_fields_json'");
        if (!$checkCol || $checkCol->num_rows === 0) {
            $conn->query("ALTER TABLE `hrm_profiles` ADD COLUMN `custom_fields_json` TEXT NULL AFTER `kpi_multiplier_rules`");
            $logMsg("Đã thêm cột custom_fields_json vào bảng hrm_profiles.", "success");
        } else {
            $logMsg("Cột custom_fields_json đã tồn tại trong bảng hrm_profiles.", "warning");
        }
        
        $logMsg("Nâng cấp lên phiên bản 194 hoàn tất.", "success");
    }

    // 9.8. Seed default departments and assign users (Version 195)
    if ($currentVersion < 195 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 195 (Khởi tạo các phòng ban mặc định và gán nhân sự)...", "info");

        // Seed default departments if they don't exist
        $defaultTeams = [
            'Phòng Nhân sự' => 'Phòng ban chịu trách nhiệm quản lý hồ sơ nhân sự, bảng lương và trực ca.',
            'Phòng Kế toán' => 'Phòng ban chịu trách nhiệm quản lý dòng tiền, hóa đơn, cọc và chi phí.',
            'Phòng Marketing' => 'Phòng ban chịu trách nhiệm chạy chiến dịch quảng cáo và điều phối data lead.',
            'Phòng Kinh doanh' => 'Phòng ban tư vấn và bán hàng, quản lý chăm sóc leads và giao dịch.'
        ];

        // We find the first admin user to set as default leader
        $admQ = $conn->query("SELECT id FROM users WHERE role IN ('admin', 'superadmin', 'super_admin') LIMIT 1");
        $admRow = $admQ ? $admQ->fetch_assoc() : null;
        $leaderId = $admRow ? (int)$admRow['id'] : 1;

        foreach ($defaultTeams as $name => $desc) {
            $chk = $conn->prepare("SELECT id FROM teams WHERE name = ? LIMIT 1");
            $chk->execute([$name]);
            $res = $chk->get_result();
            $exists = $res ? $res->fetch_assoc() : null;
            $chk->close();

            if (!$exists) {
                $ins = $conn->prepare("INSERT INTO teams (name, description, leader_id) VALUES (?, ?, ?)");
                $ins->execute([$name, $desc, $leaderId]);
                $ins->close();
                $logMsg("Đã khởi tạo phòng ban: " . $name, "success");
            }
        }

        // Link default roles to their departments
        $roleDepts = [
            'hr' => 'Phòng Nhân sự',
            'accountant' => 'Phòng Kế toán',
            'marketing' => 'Phòng Marketing',
            'sales' => 'Phòng Kinh doanh',
            'sale' => 'Phòng Kinh doanh'
        ];

        foreach ($roleDepts as $role => $deptName) {
            // Find team ID
            $tQ = $conn->prepare("SELECT id FROM teams WHERE name = ? LIMIT 1");
            $tQ->execute([$deptName]);
            $tRes = $tQ->get_result();
            $tRow = $tRes ? $tRes->fetch_assoc() : null;
            $tQ->close();

            if ($tRow) {
                $teamId = (int)$tRow['id'];
                // Update users with this role to belong to this team/department
                $upd = $conn->prepare("UPDATE users SET team_id = ? WHERE role = ?");
                $upd->execute([$teamId, $role]);
                $upd->close();
                $logMsg("Đã gán nhân sự vai trò '" . $role . "' vào " . $deptName, "success");
            }
        }

        $logMsg("Nâng cấp lên phiên bản 195 hoàn tất.", "success");
    }

    // 9.9. Performance indexes & data cleanup (Version 196)
    if ($currentVersion < 196 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 196 (Tạo 9 chỉ mục hiệu năng và dọn dẹp dữ liệu)...", "info");

        // 1. Clean up corrupted dates in main tables
        $tables = [
            'users' => ['dob'],
            'hrm_profiles' => ['joined_date'],
            'check_ins' => ['check_in_date'],
            'hrm_leave_requests' => ['start_date', 'end_date']
        ];
        foreach ($tables as $table => $cols) {
            foreach ($cols as $col) {
                $conn->query("UPDATE `$table` SET `$col` = NULL WHERE `$col` = '0000-00-00' OR `$col` = '1970-01-01'");
            }
        }
        $logMsg("Đã dọn dẹp các giá trị ngày tháng lỗi (0000-00-00, 1970-01-01) về NULL.", "success");

        // 2. Add BTREE indexes for high-frequency queries
        $indexes = [
            'users' => ['idx_users_team' => 'team_id'],
            'contacts' => ['idx_contacts_tenant_owner' => 'tenant_id, owner_id'],
            'deals' => ['idx_deals_contact_tenant' => 'contact_id, tenant_id'],
            'deposits' => ['idx_deposits_contact_creator' => 'contact_id, created_by'],
            'deposit_milestones' => ['idx_milestones_deposit_status' => 'deposit_id, status'],
            'invoices' => ['idx_invoices_contact_status' => 'contact_id, status'],
            'expenses' => ['idx_expenses_tenant_status' => 'tenant_id, status'],
            'activities' => ['idx_activities_contact_user' => 'contact_id, user_id'],
            'comments' => ['idx_comments_entity' => 'entity_type(50), entity_id']
        ];

        foreach ($indexes as $table => $idxList) {
            foreach ($idxList as $idxName => $columns) {
                // Check if index already exists
                $chk = $conn->query("SHOW INDEX FROM `$table` WHERE Key_name = '$idxName'");
                if (!$chk || $chk->num_rows === 0) {
                    $conn->query("ALTER TABLE `$table` ADD INDEX `$idxName` ($columns)");
                    $logMsg("Đã tạo chỉ mục $idxName trên bảng $table.", "success");
                } else {
                    $logMsg("Chỉ mục $idxName đã tồn tại trên bảng $table.", "warning");
                }
            }
        }

        $logMsg("Nâng cấp lên phiên bản 196 hoàn tất.", "success");
    }

    // 9.10. Seed cohesive relational demo data (Version 197)
    if ($currentVersion < 197 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 197 (Khởi tạo chuỗi dữ liệu Demo liên kết chặt chẽ)...", "info");

        // 1. Projects & Units
        $conn->query("DELETE FROM `projects` WHERE name = 'Vinhomes Grand Park'");
        
        // Ensure we have sale_agent and sale_manager users
        $chkAgent = $conn->query("SELECT id FROM users WHERE email = 'agent@ideas.test' LIMIT 1");
        $agentRow = $chkAgent ? $chkAgent->fetch_assoc() : null;
        if (!$agentRow) {
            $hash = password_hash('agent123', PASSWORD_BCRYPT);
            $conn->query("INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, is_active, status) VALUES (1, 'sale_agent_demo', 'agent@ideas.test', '$hash', 'Sale Agent Demo', 'sale', 1, 'active')");
            $agentId = (int)$conn->insert_id;
        } else {
            $agentId = (int)$agentRow['id'];
        }

        $chkMgr = $conn->query("SELECT id FROM users WHERE email = 'manager@ideas.test' LIMIT 1");
        $mgrRow = $chkMgr ? $chkMgr->fetch_assoc() : null;
        if (!$mgrRow) {
            $hash = password_hash('manager123', PASSWORD_BCRYPT);
            $conn->query("INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, is_active, status) VALUES (1, 'sale_manager_demo', 'manager@ideas.test', '$hash', 'Sale Manager Demo', 'manager', 1, 'active')");
            $managerId = (int)$conn->insert_id;
        } else {
            $managerId = (int)$mgrRow['id'];
        }

        // Link them to 'Phòng Kinh doanh'
        $tQ = $conn->query("SELECT id FROM teams WHERE name = 'Phòng Kinh doanh' LIMIT 1");
        $tRow = $tQ ? $tQ->fetch_assoc() : null;
        if ($tRow) {
            $teamId = (int)$tRow['id'];
            $conn->query("UPDATE users SET team_id = $teamId WHERE id IN ($agentId, $managerId)");
        }

        $conn->query("INSERT INTO `projects` (tenant_id, name, code, status, description, created_by) VALUES (1, 'Vinhomes Grand Park', 'VHGP', 'active', 'Dự án căn hộ mẫu', $managerId)");
        $projectId = (int)$conn->insert_id;
        $logMsg("Đã khởi tạo dự án Vinhomes Grand Park (ID: $projectId).", "success");

        // 2. Marketing Campaign & Leads
        $conn->query("DELETE FROM `marketing_campaigns` WHERE name = 'Mở bán phân khu The Beverly'");
        $conn->query("INSERT INTO `marketing_campaigns` (tenant_id, name, status) VALUES (1, 'Mở bán phân khu The Beverly', 'active')");
        $campaignId = (int)$conn->insert_id;

        // Get first stage ID from pipeline_stages
        $stQ = $conn->query("SELECT id FROM pipeline_stages WHERE tenant_id = 1 ORDER BY order_index LIMIT 1");
        $stRow = $stQ ? $stQ->fetch_assoc() : null;
        $stageId = $stRow ? (int)$stRow['id'] : 1;

        // Create Lead Nguyễn Văn A
        $conn->query("DELETE FROM `contacts` WHERE phone = '0909123456'");
        $conn->query("INSERT INTO `contacts` (tenant_id, full_name, phone, mobile, email, source, status, owner_id, created_by, stage_id) VALUES (1, 'Nguyễn Văn A', '0909123456', '0909123456', 'nguyenvana@ideas.test', 'Mở bán phân khu The Beverly', 'customer', $agentId, $agentId, $stageId)");
        $contactId = (int)$conn->insert_id;
        $logMsg("Đã khởi tạo Lead Nguyễn Văn A (ID: $contactId) thuộc chiến dịch The Beverly.", "success");

        // 3. CRM Activity & Deal
        $conn->query("DELETE FROM `deals` WHERE contact_id = $contactId");
        $conn->query("INSERT INTO `deals` (tenant_id, stage_id, contact_id, owner_id, created_by, title, description, value) VALUES (1, $stageId, $contactId, $agentId, $agentId, 'Mua căn hộ S10.05-201', 'Khách hàng quan tâm căn 2PN', 3500000000.00)");
        $dealId = (int)$conn->insert_id;

        $conn->query("DELETE FROM `activities` WHERE contact_id = $contactId");
        $conn->query("INSERT INTO `activities` (tenant_id, contact_id, user_id, type, subject, body, status) VALUES (1, $contactId, $agentId, 'call', 'Cuộc gọi tư vấn', 'Gọi điện tư vấn căn hộ mẫu S10.05-201', 'completed')");

        // 4. Deposits, Cooperation Slips, Invoices & Expenses
        $conn->query("DELETE FROM `deposits` WHERE contact_id = $contactId");
        $conn->query("INSERT INTO `deposits` (contact_id, project_id, unit_code, price, expected_commission, status, created_by) VALUES ($contactId, $projectId, 'S10.05-201', 3500000000.00, 105000000.00, 'approved', $agentId)");
        $depositId = (int)$conn->insert_id;

        $conn->query("DELETE FROM `deposit_milestones` WHERE deposit_id = $depositId");
        $conn->query("INSERT INTO `deposit_milestones` (deposit_id, milestone_name, expected_amount, status) VALUES ($depositId, 'Đợt 1', 50000000.00, 'approved')");
        $milestoneId = (int)$conn->insert_id;

        $conn->query("DELETE FROM `cooperation_slips` WHERE contact_id = $contactId");
        $sharesJson = json_encode([$agentId => 80, $managerId => 20]);
        $conn->query("INSERT INTO `cooperation_slips` (contact_id, deposit_slip_id, version, total_percentage, shares_json, status, created_by) VALUES ($contactId, $depositId, 1, 100, '$sharesJson', 'approved', $agentId)");

        $conn->query("DELETE FROM `invoices` WHERE contact_id = $contactId");
        $conn->query("INSERT INTO `invoices` (tenant_id, contact_id, created_by, invoice_number, title, status, subtotal, total, paid_at) VALUES (1, $contactId, $agentId, 'INV-2026-0001', 'Hóa đơn đặt cọc căn hộ S10.05-201', 'paid', 50000000.00, 50000000.00, NOW())");

        // Marketing Campaign Expense
        $conn->query("DELETE FROM `expenses` WHERE title LIKE '%quảng cáo Facebook%'");
        $conn->query("INSERT INTO `expenses` (tenant_id, created_by, title, category, amount, date, status, notes) VALUES (1, $managerId, 'Chi phí chạy quảng cáo Facebook tháng 7', 'Marketing', 15000000.00, CURDATE(), 'approved', 'Chi phí được phê duyệt bởi Kế toán')");

        $logMsg("Đã khởi tạo phiếu cọc, phân chia hoa hồng 80-20, hóa đơn đã đóng và chi phí marketing.", "success");

        // 5. HRM Profiles for Agent
        $conn->query("DELETE FROM `hrm_profiles` WHERE user_id = $agentId");
        $customAllowancesJson = json_encode([
            ['name' => 'Phụ cấp đi lại', 'value' => 500000.00],
            ['name' => 'Thưởng dự án mẫu', 'value' => 1000000.00]
        ]);
        $conn->query("INSERT INTO `hrm_profiles` (user_id, joined_date, base_salary, deal_salary, has_insurance, allowance_meal, custom_fields_json) VALUES ($agentId, '2026-01-01', 10000000.00, 8000000.00, 1, 650000.00, '$customAllowancesJson')");

        $logMsg("Đã khởi tạo hồ sơ lương và phụ cấp động cho nhân viên Sale Agent.", "success");
        $logMsg("Nâng cấp lên phiên bản 197 hoàn tất.", "success");
    }

    // 9.7. Version 198: Add hrm leave balance and overtime payslip columns
    if ($currentVersion < 198 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 198 (Trường phép năm, nghỉ bù, tăng ca và chuyên cần)...", "info");
        
        try {
            $conn->query("ALTER TABLE `hrm_profiles` 
                ADD COLUMN `annual_leave_total` DECIMAL(4,1) DEFAULT 12.0 COMMENT 'Tổng ngày phép năm được hưởng',
                ADD COLUMN `annual_leave_used` DECIMAL(4,1) DEFAULT 0.0 COMMENT 'Số ngày phép năm đã sử dụng',
                ADD COLUMN `compensatory_leave_total` DECIMAL(4,1) DEFAULT 0.0 COMMENT 'Tổng ngày nghỉ bù tích lũy',
                ADD COLUMN `compensatory_leave_used` DECIMAL(4,1) DEFAULT 0.0 COMMENT 'Số ngày nghỉ bù đã sử dụng'");
            $logMsg("Đã bổ sung các cột phép năm và nghỉ bù vào bảng hrm_profiles.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột phép năm/nghỉ bù đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }

        try {
            $conn->query("ALTER TABLE `monthly_payslips`
                ADD COLUMN `overtime_days` DECIMAL(4,1) DEFAULT 0.0 COMMENT 'Số ngày tăng ca',
                ADD COLUMN `overtime_salary` DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Lương tăng ca',
                ADD COLUMN `diligence_bonus` DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Thưởng chuyên cần'");
            $logMsg("Đã bổ sung các cột overtime và chuyên cần vào bảng monthly_payslips.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột overtime/chuyên cần đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }

        $logMsg("Nâng cấp lên phiên bản 198 hoàn tất.", "success");
    }

    // 9.8. Version 199: Add expected_pay_date column to deposit_milestones table
    if ($currentVersion < 199 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 199 (Thêm cột expected_pay_date)...", "info");
        
        try {
            $conn->query("ALTER TABLE `deposit_milestones` ADD COLUMN `expected_pay_date` DATE NULL COMMENT 'Ngày thanh toán dự kiến' AFTER `expected_amount`");
            $logMsg("Đã bổ sung cột expected_pay_date vào bảng deposit_milestones.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột expected_pay_date đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }

        $logMsg("Nâng cấp lên phiên bản 199 hoàn tất.", "success");
    }

    // 9.9. Version 200: Add notes column to deposits table
    if ($currentVersion < 200 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 200 (Thêm cột notes)...", "info");
        
        try {
            $conn->query("ALTER TABLE `deposits` ADD COLUMN `notes` TEXT NULL COMMENT 'Ghi chú phiếu cọc'");
            $logMsg("Đã bổ sung cột notes vào bảng deposits.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột notes đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }

        $logMsg("Nâng cấp lên phiên bản 200 hoàn tất.", "success");
    }

    // 9.10. Version 201: Add accountant_id column to deposits table
    if ($currentVersion < 201 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 201 (Thêm cột accountant_id)...", "info");
        
        try {
            $conn->query("ALTER TABLE `deposits` ADD COLUMN `accountant_id` INT NULL DEFAULT NULL COMMENT 'Kế toán duyệt', ADD INDEX (`accountant_id`)");
            $logMsg("Đã bổ sung cột accountant_id vào bảng deposits.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột accountant_id đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }

        $logMsg("Nâng cấp lên phiên bản 201 hoàn tất.", "success");
    }

    // 9.11. Version 202: Add sales_orders, sales_order_items tables and performance composite indexes
    if ($currentVersion < 202 || $isForce) {
        $logMsg("Đang nâng cấp CSDL lên phiên bản 202 (Chuẩn hóa SO, PO, Invoice & Indexing)...", "info");

        try {
            $conn->query("
                CREATE TABLE IF NOT EXISTS `sales_orders` (
                  `id` int(11) NOT NULL AUTO_INCREMENT,
                  `tenant_id` int(11) NOT NULL,
                  `contact_id` int(11) DEFAULT NULL,
                  `company_id` int(11) DEFAULT NULL,
                  `deal_id` int(11) DEFAULT NULL,
                  `quote_id` int(11) DEFAULT NULL,
                  `created_by` int(11) NOT NULL,
                  `so_number` varchar(50) NOT NULL,
                  `order_date` date NOT NULL,
                  `delivery_date` date DEFAULT NULL,
                  `status` enum('draft','pending_approval','approved','processing','completed','cancelled') NOT NULL DEFAULT 'draft',
                  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
                  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `notes` text DEFAULT NULL,
                  `terms` text DEFAULT NULL,
                  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
                  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                  PRIMARY KEY (`id`),
                  KEY `tenant_id` (`tenant_id`),
                  KEY `contact_id` (`contact_id`),
                  KEY `company_id` (`company_id`),
                  KEY `deal_id` (`deal_id`),
                  KEY `quote_id` (`quote_id`),
                  KEY `created_by` (`created_by`),
                  KEY `idx_so_tenant_status_date` (`tenant_id`, `status`, `order_date`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $conn->query("
                CREATE TABLE IF NOT EXISTS `sales_order_items` (
                  `id` int(11) NOT NULL AUTO_INCREMENT,
                  `so_id` int(11) NOT NULL,
                  `product_id` int(11) DEFAULT NULL,
                  `name` varchar(255) NOT NULL,
                  `description` text DEFAULT NULL,
                  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
                  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `discount` decimal(5,2) NOT NULL DEFAULT 0.00,
                  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
                  `sort_order` smallint(6) NOT NULL DEFAULT 0,
                  PRIMARY KEY (`id`),
                  KEY `so_id` (`so_id`),
                  KEY `product_id` (`product_id`),
                  CONSTRAINT `sales_order_items_ibfk_1` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $logMsg("Đã tạo thành công bảng sales_orders và sales_order_items.", "success");
        } catch (Throwable $e) {
            $logMsg("Bảng sales_orders đã tồn tại hoặc thông báo: " . $e->getMessage(), "info");
        }

        // Composite Indexes
        $indexes = [
            "ALTER TABLE purchase_orders ADD INDEX idx_po_tenant_status_date (tenant_id, status, order_date)",
            "ALTER TABLE purchase_orders ADD INDEX idx_po_tenant_supplier (tenant_id, supplier_id)",
            "ALTER TABLE invoices ADD INDEX idx_inv_tenant_status_due (tenant_id, status, due_date)",
            "ALTER TABLE expenses ADD INDEX idx_exp_tenant_status_date (tenant_id, status, expense_date)",
            "ALTER TABLE cooperation_slips ADD INDEX idx_slip_status_created (status, created_at)",
            "ALTER TABLE activities ADD INDEX idx_activities_active_user (tenant_id, deleted_at, user_id, status, due_date)",
            "ALTER TABLE activities ADD INDEX idx_activities_active_created (tenant_id, deleted_at, created_by)",
            "ALTER TABLE activities ADD INDEX idx_activities_active_approver (tenant_id, deleted_at, approver_id)",
            "ALTER TABLE hrm_leave_requests ADD INDEX idx_hrm_leave_requests_perf (user_id, status, leave_type, start_date)",
            "ALTER TABLE check_ins ADD INDEX idx_check_ins_perf (user_id, status, check_in_date, late_minutes)",
            "ALTER TABLE hrm_salary_advances ADD INDEX idx_hrm_salary_advances_perf (user_id, status)"
        ];

        foreach ($indexes as $sqlIdx) {
            try {
                $conn->query($sqlIdx);
            } catch (Throwable $e) {
                // Index already exists
            }
        }

        // 9b. Create Enterprise Social Feed tables
        try {
            $conn->query("
                CREATE TABLE IF NOT EXISTS `enterprise_posts` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `tenant_id` INT NOT NULL,
                  `user_id` INT NOT NULL,
                  `content` TEXT NOT NULL,
                  `attachments_json` LONGTEXT NULL COMMENT 'JSON array of media files (URLs, type: image/video/file)',
                  `visibility` VARCHAR(50) DEFAULT 'global',
                  `tags_json` VARCHAR(255) DEFAULT '[]' COMMENT 'JSON array of hashtags',
                  `link_metadata_json` LONGTEXT NULL COMMENT 'Parsed URL metadata (url, title, desc, image)',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
                  KEY `idx_post_tenant_user` (`tenant_id`, `deleted_at`, `user_id`),
                  KEY `idx_post_created` (`created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $conn->query("
                CREATE TABLE IF NOT EXISTS `enterprise_comments` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `tenant_id` INT NOT NULL,
                  `post_id` INT NOT NULL,
                  `user_id` INT NOT NULL,
                  `parent_id` INT NULL DEFAULT NULL COMMENT 'ID of parent comment for nested replies',
                  `content` TEXT NOT NULL,
                  `attachments_json` LONGTEXT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
                  KEY `idx_comment_post` (`post_id`, `parent_id`),
                  KEY `idx_comment_user` (`user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $conn->query("
                CREATE TABLE IF NOT EXISTS `enterprise_reactions` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `tenant_id` INT NOT NULL,
                  `ref_type` VARCHAR(20) NOT NULL COMMENT 'post or comment',
                  `ref_id` INT NOT NULL,
                  `user_id` INT NOT NULL,
                  `reaction_type` VARCHAR(20) NOT NULL COMMENT 'like, love, haha, wow, sad, angry',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  UNIQUE KEY `uniq_user_reaction` (`ref_type`, `ref_id`, `user_id`),
                  KEY `idx_reaction_lookup` (`ref_type`, `ref_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $logMsg("Đã tạo thành công các bảng cho mạng xã hội nội bộ (enterprise_posts, enterprise_comments, enterprise_reactions).", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi tạo bảng mạng xã hội: " . $e->getMessage(), "error");
        }

        $logMsg("Nâng cấp lên phiên bản 203 hoàn tất.", "success");
    }

    // 10. Upgrade to 204: Create enterprise_honors table
    if ($currentVersion < 204) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 204...", "info");
        try {
            $conn->query("
                CREATE TABLE IF NOT EXISTS `enterprise_honors` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `tenant_id` INT NOT NULL,
                  `user_id` INT NOT NULL,
                  `title` VARCHAR(255) NOT NULL,
                  `badge` VARCHAR(255) NOT NULL,
                  `reason` TEXT NOT NULL,
                  `hearts_count` INT DEFAULT 0,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  KEY `idx_honors_tenant_user` (`tenant_id`, `user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $logMsg("Đã tạo thành công bảng enterprise_honors.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi tạo bảng enterprise_honors: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 204 hoàn tất.", "success");
    }

    // 11. Upgrade to 205: Create enterprise_honors_reactions table to cap hearts to 10 per user per card
    if ($currentVersion < 205) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 205...", "info");
        try {
            $conn->query("
                CREATE TABLE IF NOT EXISTS `enterprise_honors_reactions` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `honor_id` INT NOT NULL,
                  `user_id` INT NOT NULL,
                  `reaction_count` INT DEFAULT 0,
                  UNIQUE KEY `uniq_honor_user` (`honor_id`, `user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $logMsg("Đã tạo thành công bảng enterprise_honors_reactions.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi tạo bảng enterprise_honors_reactions: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 205 hoàn tất.", "success");
    }

    // 12. Upgrade to 206: Add currency, exchange_rate, original_amount, actual_amount columns
    if ($currentVersion < 206) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 206...", "info");
        try {
            $conn->query("ALTER TABLE `deposits` 
                ADD COLUMN `currency` VARCHAR(10) DEFAULT 'VND' AFTER `notes`,
                ADD COLUMN `exchange_rate` DECIMAL(15,4) DEFAULT 1.0000 AFTER `currency`");
            $logMsg("Đã bổ sung cột currency và exchange_rate vào bảng deposits.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột currency/exchange_rate đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }
        
        try {
            $conn->query("ALTER TABLE `deposit_milestones` 
                ADD COLUMN `original_amount` DECIMAL(15,2) DEFAULT NULL AFTER `expected_pay_date`,
                ADD COLUMN `actual_amount` DECIMAL(15,2) DEFAULT NULL AFTER `original_amount`");
            $logMsg("Đã bổ sung cột original_amount và actual_amount vào bảng deposit_milestones.", "success");
        } catch (Throwable $e) {
            $logMsg("Cột original_amount/actual_amount đã tồn tại hoặc lỗi: " . $e->getMessage(), "info");
        }

        $logMsg("Nâng cấp lên phiên bản 206 hoàn tất.", "success");
    }

    // 13. Upgrade to 207: Migrate first_name & last_name to unified full_name across tables
    if ($currentVersion < 207) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 207...", "info");
        
        $tablesToMigrate = ['contacts', 'leads', 'capi_logs', 'cooperation_slips', 'deposits'];
        foreach ($tablesToMigrate as $table) {
            $logMsg("Kiểm tra và di trú cột họ tên trong bảng `{$table}`...", "info");
            try {
                // Check if full_name exists
                $res = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE 'full_name'");
                $hasFullName = ($res && $res->num_rows > 0);
                
                $chkFirst = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE 'first_name'");
                $chkLast = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE 'last_name'");
                $hasFirst = ($chkFirst && $chkFirst->num_rows > 0);
                $hasLast = ($chkLast && $chkLast->num_rows > 0);
                
                if (!$hasFullName) {
                    $conn->query("ALTER TABLE `{$table}` ADD COLUMN `full_name` VARCHAR(255) DEFAULT NULL");
                    $logMsg("Đã bổ sung cột full_name vào bảng `{$table}`.", "success");
                    
                    if ($hasFirst || $hasLast) {
                        $conn->query("UPDATE `{$table}` SET `full_name` = TRIM(CONCAT(COALESCE(last_name, ''), ' ', COALESCE(first_name, '')))");
                        $logMsg("Đã chuyển đổi dữ liệu họ tên sang full_name trong bảng `{$table}`.", "success");
                    }
                } else {
                    $logMsg("Cột full_name đã tồn tại trong bảng `{$table}`.", "info");
                }
                
                // Drop first_name & last_name if they exist
                if ($hasFirst) {
                    $conn->query("ALTER TABLE `{$table}` DROP COLUMN `first_name`");
                    $logMsg("Đã xóa cột first_name trong bảng `{$table}`.", "success");
                }
                if ($hasLast) {
                    $conn->query("ALTER TABLE `{$table}` DROP COLUMN `last_name`");
                    $logMsg("Đã xóa cột last_name trong bảng `{$table}`.", "success");
                }
            } catch (Throwable $e) {
                $logMsg("Lỗi di trú dữ liệu bảng `{$table}`: " . $e->getMessage(), "error");
            }
        }
        
        $logMsg("Nâng cấp lên phiên bản 207 hoàn tất.", "success");
    }

    // 14. Upgrade to 208: Add unpaid_days column to hrm_leave_requests
    if ($currentVersion < 208) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 208...", "info");
        try {
            $chkCol = $conn->query("SHOW COLUMNS FROM `hrm_leave_requests` LIKE 'unpaid_days'");
            if (!$chkCol || $chkCol->num_rows === 0) {
                $conn->query("ALTER TABLE hrm_leave_requests ADD COLUMN unpaid_days DECIMAL(3,1) DEFAULT 0.0 AFTER total_days");
                $logMsg("Đã bổ sung cột unpaid_days vào bảng hrm_leave_requests.", "success");
            } else {
                $logMsg("Cột unpaid_days đã tồn tại.", "info");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi di trú cột unpaid_days: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 208 hoàn tất.", "success");
    }

    // 15. Upgrade to 209: Add composite index for timeline queries in enterprise_posts
    if ($currentVersion < 209) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 209...", "info");
        try {
            $chkIdx = $conn->query("SHOW INDEX FROM `enterprise_posts` WHERE Key_name = 'idx_post_feed_list'");
            if (!$chkIdx || $chkIdx->num_rows === 0) {
                $conn->query("ALTER TABLE `enterprise_posts` ADD INDEX `idx_post_feed_list` (`tenant_id`, `deleted_at`, `created_at` DESC)");
                $logMsg("Đã bổ sung chỉ mục idx_post_feed_list vào bảng enterprise_posts.", "success");
            } else {
                $logMsg("Chỉ mục idx_post_feed_list đã tồn tại.", "info");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi tạo chỉ mục idx_post_feed_list: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 209 hoàn tất.", "success");
    }

    // 16. Upgrade to 210: Add subjects_json and thesis_milestones_json to marketing_campaigns
    if ($currentVersion < 210) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 210...", "info");
        try {
            $chk1 = $conn->query("SHOW COLUMNS FROM `marketing_campaigns` LIKE 'subjects_json'");
            if (!$chk1 || $chk1->num_rows === 0) {
                $conn->query("ALTER TABLE `marketing_campaigns` ADD COLUMN `subjects_json` LONGTEXT NULL AFTER `description`");
                $logMsg("Đã bổ sung cột subjects_json vào bảng marketing_campaigns.", "success");
            }
            $chk2 = $conn->query("SHOW COLUMNS FROM `marketing_campaigns` LIKE 'thesis_milestones_json'");
            if (!$chk2 || $chk2->num_rows === 0) {
                $conn->query("ALTER TABLE `marketing_campaigns` ADD COLUMN `thesis_milestones_json` LONGTEXT NULL AFTER `subjects_json`");
                $logMsg("Đã bổ sung cột thesis_milestones_json vào bảng marketing_campaigns.", "success");
            }
            
            // Cập nhật dự án MBA
            $conn->query("UPDATE `projects` SET `name` = 'MBA High Quality', `campaign_sharing_mode` = 'public' WHERE `id` = 9 OR `code` = 'MBA'");
            $logMsg("Đã đồng bộ chương trình MBA High Quality sang dạng công khai.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 210: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 210 hoàn tất.", "success");
    }

    // 17. Upgrade to 211: Add reminders_json to marketing_campaigns
    if ($currentVersion < 211) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 211...", "info");
        try {
            $chk1 = $conn->query("SHOW COLUMNS FROM `marketing_campaigns` LIKE 'reminders_json'");
            if (!$chk1 || $chk1->num_rows === 0) {
                $conn->query("ALTER TABLE `marketing_campaigns` ADD COLUMN `reminders_json` LONGTEXT NULL AFTER `thesis_milestones_json`");
                $logMsg("Đã bổ sung cột reminders_json vào bảng marketing_campaigns.", "success");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 211: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 211 hoàn tất.", "success");
    }

    // 18. Upgrade to 212: Fix legacy mismatched Sales Orders totals
    if ($currentVersion < 212) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 212 (Sửa các dòng SO legacy bị lệch tổng tiền)...", "info");
        try {
            $conn->query("UPDATE `sales_orders` SET `total` = `subtotal` + `tax` - `discount` WHERE `id` IN (3, 6)");
            $logMsg("Đã sửa lệch tổng tiền cho các SO legacy thành công.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 212: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 212 hoàn tất.", "success");
    }

    // 19. Upgrade to 213: Add composite index for admin_logs account pagination
    if ($currentVersion < 213) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 213...", "info");
        try {
            $chkIdx = $conn->query("SHOW INDEX FROM `admin_logs` WHERE Key_name = 'idx_admin_logs_account_created'");
            if (!$chkIdx || $chkIdx->num_rows === 0) {
                $conn->query("ALTER TABLE `admin_logs` ADD INDEX `idx_admin_logs_account_created` (`account_id`, `created_at` DESC)");
                $logMsg("Đã bổ sung chỉ mục idx_admin_logs_account_created vào bảng admin_logs.", "success");
            } else {
                $logMsg("Chỉ mục idx_admin_logs_account_created đã tồn tại.", "info");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi tạo chỉ mục idx_admin_logs_account_created: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 213 hoàn tất.", "success");
    }

    // 20. Upgrade to 214: Add lateness_compensatory_deducted and lateness_annual_deducted to monthly_payslips
    if ($currentVersion < 214) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 214...", "info");
        try {
            $chk1 = $conn->query("SHOW COLUMNS FROM `monthly_payslips` LIKE 'lateness_compensatory_deducted'");
            if (!$chk1 || $chk1->num_rows === 0) {
                $conn->query("ALTER TABLE `monthly_payslips` ADD COLUMN `lateness_compensatory_deducted` DECIMAL(5,2) DEFAULT 0.00 AFTER lateness_penalty");
                $logMsg("Đã bổ sung cột lateness_compensatory_deducted vào bảng monthly_payslips.", "success");
            }
            $chk2 = $conn->query("SHOW COLUMNS FROM `monthly_payslips` LIKE 'lateness_annual_deducted'");
            if (!$chk2 || $chk2->num_rows === 0) {
                $conn->query("ALTER TABLE `monthly_payslips` ADD COLUMN `lateness_annual_deducted` DECIMAL(5,2) DEFAULT 0.00 AFTER lateness_compensatory_deducted");
                $logMsg("Đã bổ sung cột lateness_annual_deducted vào bảng monthly_payslips.", "success");
            }
            $chk3 = $conn->query("SHOW COLUMNS FROM `monthly_payslips` LIKE 'note'");
            if (!$chk3 || $chk3->num_rows === 0) {
                $conn->query("ALTER TABLE `monthly_payslips` ADD COLUMN `note` TEXT NULL AFTER diligence_bonus");
                $logMsg("Đã bổ sung cột note vào bảng monthly_payslips.", "success");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 214: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 214 hoàn tất.", "success");
    }

    // 21. Upgrade to 215: Add start_date to activities and create activity_dependencies table for Gantt Dependency
    if ($currentVersion < 215) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 215...", "info");
        try {
            // Thêm start_date vào bảng activities
            $chkCol = $conn->query("SHOW COLUMNS FROM `activities` LIKE 'start_date'");
            if (!$chkCol || $chkCol->num_rows === 0) {
                $conn->query("ALTER TABLE `activities` ADD COLUMN `start_date` DATETIME NULL AFTER `priority`");
                $logMsg("Đã bổ sung cột start_date vào bảng activities.", "success");
            } else {
                $logMsg("Cột start_date đã tồn tại trong bảng activities.", "info");
            }

            // Tạo bảng activity_dependencies
            $chkTable = $conn->query("SHOW TABLES LIKE 'activity_dependencies'");
            if (!$chkTable || $chkTable->num_rows === 0) {
                $conn->query("
                    CREATE TABLE `activity_dependencies` (
                      `id` INT(11) NOT NULL AUTO_INCREMENT,
                      `activity_id` INT(11) NOT NULL,
                      `predecessor_id` INT(11) NOT NULL,
                      `dependency_type` VARCHAR(10) NOT NULL DEFAULT 'FS',
                      `lag_days` INT(11) NOT NULL DEFAULT 0,
                      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
                      PRIMARY KEY (`id`),
                      KEY `idx_act_dep_activity` (`activity_id`),
                      KEY `idx_act_dep_predecessor` (`predecessor_id`),
                      UNIQUE KEY `uq_activity_predecessor` (`activity_id`, `predecessor_id`),
                      CONSTRAINT `fk_act_dep_activity` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
                      CONSTRAINT `fk_act_dep_predecessor` FOREIGN KEY (`predecessor_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");
                $logMsg("Đã tạo bảng activity_dependencies thành công.", "success");
            } else {
                $logMsg("Bảng activity_dependencies đã tồn tại.", "info");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 215: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 215 hoàn tất.", "success");
    }

    // 22. Upgrade to 216: Create task_focus_logs table for Pomodoro Focus Tracker
    if ($currentVersion < 216) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 216...", "info");
        try {
            $chkTable = $conn->query("SHOW TABLES LIKE 'task_focus_logs'");
            if (!$chkTable || $chkTable->num_rows === 0) {
                $conn->query("
                    CREATE TABLE `task_focus_logs` (
                      `id` INT(11) NOT NULL AUTO_INCREMENT,
                      `tenant_id` INT(11) NOT NULL,
                      `task_id` INT(11) NOT NULL,
                      `user_id` INT(11) NOT NULL,
                      `duration_minutes` INT(11) NOT NULL DEFAULT 25,
                      `completed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
                      PRIMARY KEY (`id`),
                      KEY `idx_focus_logs_tenant` (`tenant_id`),
                      KEY `idx_focus_logs_task` (`task_id`),
                      KEY `idx_focus_logs_user` (`user_id`),
                      CONSTRAINT `fk_focus_logs_task` FOREIGN KEY (`task_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
                      CONSTRAINT `fk_focus_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");
                $logMsg("Đã tạo bảng task_focus_logs thành công.", "success");
            } else {
                $logMsg("Bảng task_focus_logs đã tồn tại.", "info");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 216: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 216 hoàn tất.", "success");
    }

    // 23. Upgrade to 217: Standardize Tenant ID across all missing tables (suppliers, distribution_rounds, active_compensation_logs)
    if ($currentVersion < 217) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 217...", "info");
        try {
            // 1. suppliers
            $chkCol = $conn->query("SHOW COLUMNS FROM `suppliers` LIKE 'tenant_id'");
            if (!$chkCol || $chkCol->num_rows === 0) {
                $conn->query("ALTER TABLE `suppliers` ADD COLUMN `tenant_id` INT(11) NOT NULL DEFAULT 1 AFTER `id`");
                $conn->query("ALTER TABLE `suppliers` ADD CONSTRAINT `fk_suppliers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE");
                $logMsg("Đã bổ sung cột tenant_id và khóa ngoại vào bảng suppliers.", "success");
            } else {
                $logMsg("Cột tenant_id đã tồn tại trong bảng suppliers.", "info");
            }

            // 2. distribution_rounds
            $chkColDist = $conn->query("SHOW COLUMNS FROM `distribution_rounds` LIKE 'tenant_id'");
            if (!$chkColDist || $chkColDist->num_rows === 0) {
                $conn->query("ALTER TABLE `distribution_rounds` ADD COLUMN `tenant_id` INT(11) NOT NULL DEFAULT 1 AFTER `id`");
                $conn->query("ALTER TABLE `distribution_rounds` ADD CONSTRAINT `fk_dist_rounds_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE");
                $logMsg("Đã bổ sung cột tenant_id và khóa ngoại vào bảng distribution_rounds.", "success");
            } else {
                $logMsg("Cột tenant_id đã tồn tại trong bảng distribution_rounds.", "info");
            }

            // 3. active_compensation_logs
            $chkColComp = $conn->query("SHOW COLUMNS FROM `active_compensation_logs` LIKE 'tenant_id'");
            if (!$chkColComp || $chkColComp->num_rows === 0) {
                $conn->query("ALTER TABLE `active_compensation_logs` ADD COLUMN `tenant_id` INT(11) NOT NULL DEFAULT 1 AFTER `id`");
                $conn->query("ALTER TABLE `active_compensation_logs` ADD CONSTRAINT `fk_compensation_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE");
                $logMsg("Đã bổ sung cột tenant_id và khóa ngoại vào bảng active_compensation_logs.", "success");
            } else {
                $logMsg("Cột tenant_id đã tồn tại trong bảng active_compensation_logs.", "info");
            }

        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 217: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 217 hoàn tất.", "success");
    }

    // 24. Upgrade to 218: Optimize Index coverage for Multi-tenant (tenant_id) columns & Foreign key relation columns
    if ($currentVersion < 218) {
        $logMsg("Bắt đầu nâng cấp lên phiên bản 218...", "info");
        try {
            $addIndexIfMissing = function($conn, $table, $column, $indexName) use ($logMsg) {
                $chkIndex = $conn->query("
                    SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.STATISTICS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = '" . $table . "' 
                      AND INDEX_NAME = '" . $indexName . "'
                ");
                if ($chkIndex) {
                    $row = $chkIndex->fetch_row();
                    if ((int)$row[0] === 0) {
                        $conn->query("ALTER TABLE `" . $table . "` ADD INDEX `" . $indexName . "` (`" . $column . "`)");
                        $logMsg("Đã thêm chỉ mục " . $indexName . " cho bảng " . $table . ".", "success");
                    } else {
                        $logMsg("Chỉ mục " . $indexName . " đã tồn tại trên bảng " . $table . ".", "info");
                    }
                }
            };

            // 1. tenant_id indexes (15 tables)
            $tenantTables = [
                'absent_reasons' => 'idx_absent_reasons_tenant',
                'academic_lecturers' => 'idx_academic_lecturers_tenant',
                'checks' => 'idx_checks_tenant',
                'contact_tags' => 'idx_contact_tags_tenant',
                'defaults' => 'idx_defaults_tenant',
                'departments' => 'idx_departments_tenant',
                'deposit_milestones' => 'idx_deposit_milestones_tenant',
                'honors' => 'idx_honors_tenant',
                'inventory' => 'idx_inventory_tenant',
                'list_views' => 'idx_list_views_tenant',
                'lms_campaign_lecturer_allocations' => 'idx_lms_camp_lect_alloc_tenant',
                'lms_lecturer_schedule_details' => 'idx_lms_lect_sched_det_tenant',
                'lms_student_campaign_allocations' => 'idx_lms_stud_camp_alloc_tenant',
                'monthly_payslips' => 'idx_monthly_payslips_tenant',
                'quyen_truy_cap' => 'idx_quyen_truy_cap_tenant'
            ];

            foreach ($tenantTables as $table => $indexName) {
                $addIndexIfMissing($conn, $table, 'tenant_id', $indexName);
            }

            // 2. foreign key indexes (12 columns)
            $relationColumns = [
                ['table' => 'check_ins', 'col' => 'created_by', 'idx' => 'idx_check_ins_created_by'],
                ['table' => 'contact_tags', 'col' => 'contact_id', 'idx' => 'idx_contact_tags_contact'],
                ['table' => 'contact_tags', 'col' => 'tag_id', 'idx' => 'idx_contact_tags_tag'],
                ['table' => 'deposit_milestones', 'col' => 'deposit_id', 'idx' => 'idx_deposit_milestones_deposit'],
                ['table' => 'deposit_milestones', 'col' => 'approved_by', 'idx' => 'idx_deposit_milestones_approved_by'],
                ['table' => 'lms_campaign_lecturer_allocations', 'col' => 'campaign_id', 'idx' => 'idx_lms_camp_lect_alloc_campaign'],
                ['table' => 'lms_campaign_lecturer_allocations', 'col' => 'lecturer_id', 'idx' => 'idx_lms_camp_lect_alloc_lecturer'],
                ['table' => 'lms_lecturer_schedule_details', 'col' => 'lecturer_id', 'idx' => 'idx_lms_lect_sched_det_lecturer'],
                ['table' => 'lms_lecturer_schedule_details', 'col' => 'campaign_id', 'idx' => 'idx_lms_lect_sched_det_campaign'],
                ['table' => 'lms_student_campaign_allocations', 'col' => 'student_id', 'idx' => 'idx_lms_stud_camp_alloc_student'],
                ['table' => 'lms_student_campaign_allocations', 'col' => 'campaign_id', 'idx' => 'idx_lms_stud_camp_alloc_campaign'],
                ['table' => 'quyen_truy_cap', 'col' => 'invited_by', 'idx' => 'idx_quyen_truy_cap_invited_by']
            ];

            foreach ($relationColumns as $rc) {
                $addIndexIfMissing($conn, $rc['table'], $rc['col'], $rc['idx']);
            }

        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 218: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 218 hoàn tất.", "success");
    }

    // MIGRATION 219: Standardize all default user passwords to Ideas@812
    if ($currentVersion < 219) {
        $logMsg("Đang thực hiện nâng cấp CSDL lên phiên bản 219 (Đồng bộ mật khẩu người dùng mặc định: Ideas@812)...", "info");
        try {
            $defaultHash = password_hash('Ideas@812', PASSWORD_BCRYPT);
            $stmt = $conn->prepare("UPDATE users SET password_hash = ?");
            if ($stmt) {
                $stmt->bind_param('s', $defaultHash);
                $stmt->execute();
                $stmt->close();
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 219: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 219 hoàn tất.", "success");
    }

    // MIGRATION 220: Create or update account info@ideas.edu.vn with admin role, avatar, and password Ideas@812
    if ($currentVersion < 220) {
        $logMsg("Đang thực hiện nâng cấp CSDL lên phiên bản 220 (Tạo/Cập nhật tài khoản info@ideas.edu.vn)...", "info");
        try {
            $email = 'info@ideas.edu.vn';
            $fullName = 'IDEAS Admin';
            $avatarUrl = 'https://ideas.edu.vn/wp-content/uploads/2023/04/cropped-logofavicon-1.webp';
            $role = 'admin';
            $passwordHash = password_hash('Ideas@812', PASSWORD_BCRYPT);
            
            // Check if user exists
            $checkStmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $checkStmt->bind_param('s', $email);
            $checkStmt->execute();
            $res = $checkStmt->get_result();
            $existing = $res ? $res->fetch_assoc() : null;
            $checkStmt->close();

            if ($existing) {
                $updateStmt = $conn->prepare("UPDATE users SET full_name = ?, avatar_url = ?, role = ?, password_hash = ?, is_active = 1, is_confirmed = 1, two_factor_enabled = 0 WHERE email = ?");
                $updateStmt->bind_param('sssss', $fullName, $avatarUrl, $role, $passwordHash, $email);
                $updateStmt->execute();
                $updateStmt->close();
                $logMsg("Đã cập nhật thông tin tài khoản $email.", "success");
            } else {
                $tenantId = 1;
                $username = 'info';
                $insertStmt = $conn->prepare("INSERT INTO users (tenant_id, username, email, full_name, role, password_hash, avatar_url, is_active, is_confirmed, two_factor_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0)");
                $insertStmt->bind_param('issssss', $tenantId, $username, $email, $fullName, $role, $passwordHash, $avatarUrl);
                $insertStmt->execute();
                $insertStmt->close();
                $logMsg("Đã tạo mới tài khoản $email.", "success");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 220: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 220 hoàn tất.", "success");
    }

    // MIGRATION 222: Update turniodev to Tunrio - Super admin (role superadmin) and remove 3 test accounts
    if ($currentVersion < 222) {
        $logMsg("Đang thực hiện nâng cấp CSDL lên phiên bản 222 (Cập nhật turniodev & dọn dẹp tài khoản test)...", "info");
        try {
            // 1. Update turniodev@gmail.com
            $updateStmt = $conn->prepare("UPDATE users SET full_name = 'Tunrio - Super admin', role = 'superadmin' WHERE email = 'turniodev@gmail.com'");
            if ($updateStmt) {
                $updateStmt->execute();
                $updateStmt->close();
                $logMsg("Đã đổi tên thành 'Tunrio - Super admin' và nâng quyền superadmin cho turniodev@gmail.com", "success");
            }

            // 2. Remove 3 test accounts: dev_director@test.com, dev_manager@test.com, dev_sale@test.com
            $testEmails = ['dev_director@test.com', 'dev_manager@test.com', 'dev_sale@test.com'];
            foreach ($testEmails as $testEmail) {
                // Find user id
                $uStmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
                $uStmt->bind_param('s', $testEmail);
                $uStmt->execute();
                $res = $uStmt->get_result();
                $uRow = $res ? $res->fetch_assoc() : null;
                $uStmt->close();

                if ($uRow) {
                    $uId = (int)$uRow['id'];
                    $conn->query("DELETE FROM login_attempts WHERE email = '$testEmail'");
                    $conn->query("DELETE FROM notifications WHERE user_id = $uId");
                    $conn->query("DELETE FROM email_otps WHERE user_id = $uId");
                    $conn->query("DELETE FROM check_ins WHERE user_id = $uId");
                    $conn->query("DELETE FROM users WHERE id = $uId");
                    $logMsg("Đã xóa tài khoản test: $testEmail (ID: $uId)", "success");
                }
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 222: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 222 hoàn tất.", "success");
    }

    // 25. Migration 223: Migrate thaing to admin role
    if ($currentVersion < 223) {
        $logMsg("Bắt đầu nâng cấp CSDL lên phiên bản 223 (Migrate thaing sang admin)...", "info");
        try {
            $conn->query("UPDATE users SET role = 'admin' WHERE username = 'thaing' OR email = 'thaing@ideas.edu.vn' OR id = 100075");
            $conn->query("UPDATE consultants SET role = 'admin', job_title = 'Quản trị viên' WHERE email = 'thaing@ideas.edu.vn' OR id = 100075");
            $logMsg("Đã cập nhật vai trò thaing sang admin thành công.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 223: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 223 hoàn tất.", "success");
    }

    // 26. Migration 224: Add approved_at, approved_by, updated_at to attendance_bulk_requests
    if ($currentVersion < 224) {
        $logMsg("Bắt đầu nâng cấp CSDL lên phiên bản 224 (Bổ sung approved_at, approved_by, updated_at cho attendance_bulk_requests)...", "info");
        try {
            $colRes = $conn->query("SHOW COLUMNS FROM attendance_bulk_requests LIKE 'approved_at'");
            if ($colRes && $colRes->num_rows === 0) {
                $conn->query("ALTER TABLE attendance_bulk_requests ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL AFTER admin_note");
            }
            $colRes2 = $conn->query("SHOW COLUMNS FROM attendance_bulk_requests LIKE 'approved_by'");
            if ($colRes2 && $colRes2->num_rows === 0) {
                $conn->query("ALTER TABLE attendance_bulk_requests ADD COLUMN approved_by INT NULL DEFAULT NULL AFTER approved_at");
            }
            $colRes3 = $conn->query("SHOW COLUMNS FROM attendance_bulk_requests LIKE 'updated_at'");
            if ($colRes3 && $colRes3->num_rows === 0) {
                $conn->query("ALTER TABLE attendance_bulk_requests ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
            }

            // Backfill existing approved requests
            $conn->query("UPDATE attendance_bulk_requests SET approved_at = created_at, approved_by = COALESCE(manager_id, user_id) WHERE status = 'approved' AND approved_at IS NULL");

            $logMsg("Đã cập nhật cấu trúc bảng attendance_bulk_requests thành công.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 224: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 224 hoàn tất.", "success");
    }

    // --- MIGRATION 225: BACKFILL PENDING EXPENSE NOTIFICATIONS FOR ASSIGNED APPROVERS ---
    if ($currentVersion < 225) {
        $logMsg("Bắt đầu nâng cấp CSDL phiên bản 225...", "info");
        try {
            $pendingExpenses = $conn->query("
                SELECT e.id, e.title, e.amount, e.tenant_id, e.approver_id, u.full_name as creator_name
                FROM expenses e
                JOIN users u ON e.created_by = u.id
                WHERE e.status = 'pending' AND e.approver_id > 0 AND e.deleted_at IS NULL
            ");
            if ($pendingExpenses) {
                while ($pe = $pendingExpenses->fetch_assoc()) {
                    $appId = (int)$pe['approver_id'];
                    $expId = (int)$pe['id'];
                    $tId = (int)($pe['tenant_id'] ?? 1);
                    $link = "/approvals?open_id=" . $expId . "&open_type=expense";
                    $title = "Yêu cầu phê duyệt đề xuất: " . $pe['title'];
                    $body = "Nhân viên " . $pe['creator_name'] . " vừa gửi đề xuất: " . $pe['title'];
                    
                    // Check if notification already exists
                    $chk = $conn->prepare("SELECT id FROM notifications WHERE user_id = ? AND link = ? LIMIT 1");
                    $chk->bind_param("is", $appId, $link);
                    $chk->execute();
                    $hasNotif = (bool)$chk->get_result()->fetch_assoc();
                    $chk->close();

                    if (!$hasNotif) {
                        $ins = $conn->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at) VALUES (?, ?, ?, ?, 'expense', ?, 0, NOW())");
                        $ins->bind_param("iisss", $appId, $tId, $title, $body, $link);
                        $ins->execute();
                        $ins->close();
                    }
                }
            }
            $logMsg("Đã đồng bộ thông báo đề xuất chờ duyệt cho người duyệt được chỉ định.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 225: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 225 hoàn tất.", "success");
    }

    // --- MIGRATION 226: SET DIRECTOR ROLE FOR VINHPQ AND LANPTP + ENSURE HRM PROFILES ---
    if ($currentVersion < 226) {
        $logMsg("Bắt đầu nâng cấp CSDL phiên bản 226...", "info");
        try {
            $directors = [
                [
                    'email' => 'vinhpq@ideas.edu.vn',
                    'username' => 'vinhpq',
                    'full_name' => 'Phan Quang Vinh',
                    'job_title' => 'Director'
                ],
                [
                    'email' => 'lanptp@ideas.edu.vn',
                    'username' => 'lanptp',
                    'full_name' => 'Phan Thị Phương Lan',
                    'job_title' => 'Director'
                ]
            ];

            $defaultPwdHash = password_hash('Ideas@2026', PASSWORD_DEFAULT);

            foreach ($directors as $dir) {
                $email = $dir['email'];
                $uname = $dir['username'];
                $fname = $dir['full_name'];
                $jtitle = $dir['job_title'];

                // Check if user exists
                $chkUser = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
                $chkUser->bind_param("s", $email);
                $chkUser->execute();
                $userRow = $chkUser->get_result()->fetch_assoc();
                $chkUser->close();

                if ($userRow) {
                    $uId = (int)$userRow['id'];
                    $upd = $conn->prepare("UPDATE users SET role = 'director', full_name = COALESCE(NULLIF(full_name, ''), ?), job_title = 'Director', is_active = 1, status = 'active' WHERE id = ?");
                    $upd->bind_param("si", $fname, $uId);
                    $upd->execute();
                    $upd->close();
                    $logMsg("Đã cập nhật role 'director' cho tài khoản: {$email} (ID: {$uId})", "success");
                } else {
                    $ins = $conn->prepare("INSERT INTO users (tenant_id, full_name, username, email, password_hash, role, job_title, status, is_active, is_confirmed, created_at) VALUES (1, ?, ?, ?, ?, 'director', 'Director', 'active', 1, 1, NOW())");
                    $ins->bind_param("ssss", $fname, $uname, $email, $defaultPwdHash);
                    $ins->execute();
                    $uId = (int)$conn->insert_id;
                    $ins->close();
                    $logMsg("Đã tạo mới tài khoản Director: {$email} (ID: {$uId})", "success");
                }

                // Ensure HRM profile exists for Director
                $chkHrm = $conn->prepare("SELECT user_id FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                $chkHrm->bind_param("i", $uId);
                $chkHrm->execute();
                $hrmRow = $chkHrm->get_result()->fetch_assoc();
                $chkHrm->close();

                if (!$hrmRow) {
                    $insHrm = $conn->prepare("INSERT INTO hrm_profiles (user_id, joined_date, base_salary, deal_salary, has_insurance, annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used) VALUES (?, '2024-01-01', 0, 0, 1, 12, 0, 0, 0)");
                    $insHrm->bind_param("i", $uId);
                    $insHrm->execute();
                    $insHrm->close();
                    $logMsg("Đã khởi tạo hồ sơ HRM Profile cho Director ID: {$uId}", "success");
                }
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 226: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 226 hoàn tất.", "success");
    }

    // Update DB version in system_settings
    
    // --- MIGRATION 227: SET PASSWORD Ideas@812 FOR DIRECTORS ---
    if ($currentVersion < 227) {
        $logMsg("Bắt đầu nâng cấp CSDL phiên bản 227...", "info");
        try {
            $pwd812Hash = password_hash('Ideas@812', PASSWORD_DEFAULT);
            $emails = ['vinhpq@ideas.edu.vn', 'lanptp@ideas.edu.vn'];

            foreach ($emails as $email) {
                $updPwd = $conn->prepare("UPDATE users SET password_hash = ?, role = 'director', is_active = 1, status = 'active' WHERE email = ?");
                $updPwd->bind_param("ss", $pwd812Hash, $email);
                $updPwd->execute();
                $updPwd->close();
                $logMsg("Đã cập nhật mật khẩu 'Ideas@812' và role director cho: {$email}", "success");
            }
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 227: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 227 hoàn tất.", "success");
    }

    // --- MIGRATION 228: ENSURE ALL COMPANY EMAILS ARE ACTIVE & SYSTEM SETTINGS CONFIGURED ---
    if ($currentVersion < 228) {
        $logMsg("Bắt đầu nâng cấp CSDL phiên bản 228...", "info");
        try {
            $conn->query("UPDATE users SET is_active = 1, status = 'active' WHERE email IS NOT NULL AND email != '' AND (is_active = 0 OR status IS NULL OR status != 'active')");
            $conn->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('frontend_url', 'https://myerp.ideas.edu.vn')");
            $conn->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('ses_sender_email', 'systemnoti@ideas.edu.vn')");
            $conn->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('ses_sender_name', 'IDEAS NOTIFICATION')");
            $logMsg("Đã kích hoạt toàn bộ email công ty và cấu hình frontend_url, ses_sender_email (systemnoti@ideas.edu.vn).", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 228: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 228 hoàn tất.", "success");
    }

    // --- MIGRATION 229: DROP LEGACY NOTIFICATION TRIGGER AND STANDARDIZE IDEAS ERP BRAND ---
    if ($currentVersion < 229) {
        $logMsg("Bắt đầu nâng cấp CSDL phiên bản 229...", "info");
        try {
            $conn->query("DROP TRIGGER IF EXISTS trg_after_notification_insert");
            $conn->query("UPDATE system_settings SET setting_value = 'systemnoti@ideas.edu.vn' WHERE setting_key = 'ses_sender_email'");
            $conn->query("UPDATE system_settings SET setting_value = 'IDEAS NOTIFICATION' WHERE setting_key = 'ses_sender_name'");
            $conn->query("UPDATE system_settings SET setting_value = 'IDEAS ERP' WHERE setting_key = 'company_name' OR setting_key = 'brand_name'");
            $logMsg("Đã xóa hoàn toàn Trigger cũ và chuẩn hóa thương hiệu IDEAS ERP.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 229: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 229 hoàn tất.", "success");
    }

    // --- MIGRATION 230: ADD CHECKOUT_SELFIE_URL COLUMN TO CHECK_INS ---
    if ($currentVersion < 230) {
        $logMsg("Bắt đầu nâng cấp CSDL phiên bản 230...", "info");
        try {
            $chkCol = $conn->query("SHOW COLUMNS FROM check_ins LIKE 'checkout_selfie_url'");
            $hasCol = $chkCol && (($chkCol instanceof PDOStatement) ? $chkCol->rowCount() > 0 : ($chkCol->num_rows > 0));
            if (!$hasCol) {
                $conn->query("ALTER TABLE check_ins ADD COLUMN checkout_selfie_url TEXT NULL AFTER check_out_time");
            }
            $conn->query("ALTER TABLE check_ins MODIFY COLUMN selfie_url TEXT NULL");
            $logMsg("Đã bổ sung cột checkout_selfie_url vào bảng check_ins.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 230: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 230 hoàn tất.", "success");
    }

    // ==========================================
    // VERSION 231: Configure National Day Holiday 2026 (29/08/2026 to 02/09/2026)
    // ==========================================
    if ($currentVersion < 231) {
        $logMsg("Bắt đầu nâng cấp CSDL lên phiên bản 231 (Cấu hình Nghỉ lễ Quốc Khánh 2/9 từ 29/08 đến 02/09/2026)...", "info");
        try {
            $holidayJson = json_encode([[
                'id' => 'quoc_khanh_2026',
                'name' => 'Nghỉ lễ Quốc Khánh 2/9',
                'start_date' => '2026-08-29',
                'end_date' => '2026-09-02',
                'start' => '2026-08-29',
                'end' => '2026-09-02',
                'description' => 'Nghỉ lễ Quốc khánh từ 29/08 đến hết 02/09/2026. Bắt đầu làm việc lại ngày 03/09/2026.',
                'is_paid' => 1,
                'require_checkin' => 0
            ]], JSON_UNESCAPED_UNICODE);

            $stmtH = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('holiday_schedules', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
            $stmtH->bind_param("ss", $holidayJson, $holidayJson);
            $stmtH->execute();
            $stmtH->close();
            $logMsg("Đã cập nhật lịch nghỉ lễ Quốc khánh 2/9 vào system_settings.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 231: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 231 hoàn tất.", "success");
    }

    // -------------------------------------------------------------
    // Migration 232: Normalize Task Due Dates to 23:59:59 & Clean Bogus Overdue Alerts
    // -------------------------------------------------------------
    if ($currentVersion < 232) {
        $logMsg("Bắt đầu nâng cấp CSDL lên phiên bản 232 (Chuẩn hóa hạn hoàn thành công việc 23:59:59)...", "info");
        try {
            // Chuẩn hóa tất cả các công việc có giờ 00:00:00 thành 23:59:59
            $conn->query("UPDATE activities SET due_date = CONCAT(DATE(due_date), ' 23:59:59') WHERE TIME(due_date) = '00:00:00'");
            $logMsg("Đã chuẩn hóa hạn công việc sang 23:59:59.", "success");

            // Dọn dẹp các thông báo lỗi nhắc nhở nghỉ lễ gửi sớm hoặc SLA quá hạn sai
            $conn->query("DELETE FROM notifications WHERE title LIKE '%Nhắc nhở: Ngày mai bắt đầu làm việc trở lại%'");
            $conn->query("DELETE FROM notifications WHERE type = 'task_overdue' AND title LIKE '%CẢNH BÁO SLA%' AND (body LIKE '%26/08/2026%' OR body LIKE '%00:00%')");
            $logMsg("Đã dọn dẹp các thông báo thử nghiệm và cảnh báo SLA không chính xác.", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi nâng cấp CSDL phiên bản 232: " . $e->getMessage(), "error");
        }
        $logMsg("Nâng cấp lên phiên bản 232 hoàn tất.", "success");
    }

    // Update DB version in system_settings
    $conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '232') ON DUPLICATE KEY UPDATE setting_value = '232'");


    $logMsg("Hệ thống đã duy trì cấu trúc Cơ sở dữ liệu ở phiên bản mới nhất: " . $targetVersion, "success");

} catch (Throwable $e) {
    $logMsg("Lỗi trong quá trình đồng bộ: " . $e->getMessage(), "error");
} finally {
    $relStmt = $conn->prepare("SELECT RELEASE_LOCK('db_migration_lock')");
    if ($relStmt) {
        $relStmt->execute();
        $relStmt->close();
    }
    $logMsg("Đã giải phóng khóa Advisory Lock.", "info");
}

if (!$isCli) {
    echo "</body></html>";
} else {
    echo "Hoàn tất kiểm tra cơ sở dữ liệu.\n";
}
