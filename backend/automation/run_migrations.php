<?php
/**
 * api/run_migrations.php
 * ============================================================
 * Safe and Unified database migration check and execution script.
 * 
 * Target Database Version: 44
 * 
 * Features:
 *   - Idempotent: wraps updates sequentially and handles duplicates gracefully.
 *   - Advisory lock: db_migration_lock ensures singular execution.
 *   - Multi-tenant Isolation index rebuilds for 1B scale.
 *   - Log files written to api/logs/migration_YYYYMMDD_HHMMSS.log.
 * ============================================================
 */

require_once __DIR__ . '/db_connect.php';

$silent = isset($GLOBALS['AUTOFLOW_MIGRATE_SILENT']) && $GLOBALS['AUTOFLOW_MIGRATE_SILENT'] === true;

// Safe check: Allow CLI or check session authorization
$isCli = (php_sapi_name() === 'cli');
$hasAccess = $isCli || $silent;

if (!$isCli && !$silent) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $userId = $_SESSION['user_id'] ?? null;
    $role = $_SESSION['role'] ?? null;
    $isSuper = ($userId == 1 || $role === 'admin' || $role === 'superadmin' || $role === 'super_admin');
    
    $secret = $_GET['secret'] ?? $_POST['secret'] ?? '';
    if ($isSuper || $secret === 'autoflow_migrate_2026') {
        $hasAccess = true;
    }
}

if (!$hasAccess) {
    http_response_code(403);
    echo "403 Forbidden: Pass ?secret=autoflow_migrate_2026 or login as admin.\n";
    exit(1);
}

$apply = $silent
      || (isset($_GET['apply']) && $_GET['apply'] === 'true')
      || (isset($_GET['run']) && $_GET['run'] === '1')
      || (isset($_POST['execute_migration']) && $_POST['execute_migration'] === '1')
      || ($isCli && in_array('--apply', $argv));

/**
 * Safely get a setting from mkt_system_settings table, checking if workspace_id column exists.
 */
function getSystemSettingSafely($pdo, $key) {
    try {
        $checkCol = $pdo->query("SHOW COLUMNS FROM mkt_system_settings LIKE 'workspace_id'")->fetch();
        if ($checkCol) {
            $stmt = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
        } else {
            $stmt = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE `key` = ? LIMIT 1");
        }
        $stmt->execute([$key]);
        return $stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Safely add a column if it does not already exist.
 */
function safeAddColumn($pdo, $table, $column, $definition, $execSql, $logMsg) {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE '$table'")->fetch();
        if (!$checkTable) {
            $logMsg("Table '$table' does not exist, skipping column '$column' addition.", "info");
            return;
        }
        $check = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'")->fetch();
        if (!$check) {
            $execSql($pdo, "ALTER TABLE `$table` ADD COLUMN `$column` $definition");
        }
    } catch (Throwable $e) {
        $logMsg("Error adding column '$column' to '$table': " . $e->getMessage(), "error");
    }
}

/**
 * Safely drop an index if it exists.
 */
function safeDropIndex($pdo, $table, $indexName, $execSql, $logMsg) {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE '$table'")->fetch();
        if (!$checkTable) return;
        
        $check = $pdo->query("SHOW INDEX FROM `$table` WHERE Key_name = '$indexName'")->fetch();
        if ($check) {
            $execSql($pdo, "ALTER TABLE `$table` DROP INDEX `$indexName`");
        }
    } catch (Throwable $e) {
        $logMsg("Error dropping index '$indexName' from '$table': " . $e->getMessage(), "error");
    }
}

/**
 * Safely add an index if it does not exist.
 */
function safeAddIndex($pdo, $table, $indexName, $columnsDefinition, $execSql, $logMsg) {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE '$table'")->fetch();
        if (!$checkTable) {
            $logMsg("Table '$table' does not exist, skipping index '$indexName' addition.", "info");
            return;
        }
        $check = $pdo->query("SHOW INDEX FROM `$table` WHERE Key_name = '$indexName'")->fetch();
        if (!$check) {
            $execSql($pdo, "ALTER TABLE `$table` ADD INDEX `$indexName` ($columnsDefinition)");
        }
    } catch (Throwable $e) {
        $logMsg("Error adding index '$indexName' to '$table': " . $e->getMessage(), "error");
    }
}

/**
 * Safely rebuild a primary key to match target columns.
 */
function safeRebuildPK($pdo, $table, $columnsArray, $execSql, $logMsg) {
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE '$table'")->fetch();
        if (!$checkTable) return;

        // Get current primary key columns
        $stmt = $pdo->prepare("SHOW KEYS FROM `$table` WHERE Key_name = 'PRIMARY'");
        $stmt->execute();
        $keys = $stmt->fetchAll();
        
        $currentPKCols = [];
        foreach ($keys as $k) {
            $currentPKCols[] = $k['Column_name'];
        }
        
        // If current primary key does not match target, rebuild it
        if (empty($currentPKCols) || count(array_diff($columnsArray, $currentPKCols)) > 0 || count(array_diff($currentPKCols, $columnsArray)) > 0) {
            // Drop PK if exists
            if (!empty($currentPKCols)) {
                $execSql($pdo, "ALTER TABLE `$table` DROP PRIMARY KEY");
            }
            $colsStr = implode(', ', $columnsArray);
            $execSql($pdo, "ALTER TABLE `$table` ADD PRIMARY KEY ($colsStr)");
        }
    } catch (Throwable $e) {
        $logMsg("Error rebuilding primary key on '$table': " . $e->getMessage(), "error");
    }
}

$targetVersion = 44;
$currentVersion = 0;

// Query current DB version
$checkSettings = $pdo->query("SHOW TABLES LIKE 'mkt_system_settings'");
if ($checkSettings && $checkSettings->rowCount() > 0) {
    $dbVerVal = getSystemSettingSafely($pdo, 'db_version');
    if ($dbVerVal !== false) {
        $currentVersion = (int)$dbVerVal;
    } else {
        // Check for legacy schema_version
        $legacyVal = getSystemSettingSafely($pdo, 'schema_version');
        if ($legacyVal === '29.8') {
            $currentVersion = 30; // Baseline version
        }
    }
}

// ----------------------------------------------------
// UI Styles & Header
// ----------------------------------------------------
if (!$isCli && !$silent) {
    header("Content-Type: text/html; charset=utf-8");
    echo "<html><head><title>Hệ thống Cập nhật Cơ sở dữ liệu</title>";
    echo "<style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; color: #334155; background-color: #f8fafc; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 10px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .badge { display: inline-block; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
        .badge-info { background: #e0f2fe; color: #0369a1; }
        .badge-success { background: #dcfce7; color: #15803d; }
        .badge-warning { background: #fef9c3; color: #a16207; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.875rem; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; }
        .btn { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 0.625rem 1.25rem; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; transition: all 0.2s; }
        .btn:hover { background: #4338ca; transform: translateY(-1px); }
        .btn-warn { background: #ea580c; }
        .btn-warn:hover { background: #c2410c; }
        .step-log { font-family: monospace; font-size: 0.8125rem; background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: 8px; overflow-x: auto; max-height: 400px; }
        .step-log .success { color: #4ade80; }
        .step-log .error { color: #f87171; font-weight: bold; }
        .version-box { display: flex; gap: 2rem; margin-bottom: 1rem; }
        .version-num { font-size: 2.25rem; font-weight: 800; color: #0f172a; }
        .version-label { font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: bold; }
    </style></head><body>";
    echo "<h1>⚙️ Hệ thống Cập nhật Cơ sở dữ liệu</h1>";
} elseif (!$silent) {
    echo "=== HỆ THỐNG CẬP NHẬT CƠ SỞ DỮ LIỆU ===\n";
    echo "Phiên bản hiện tại: " . $currentVersion . "\n";
    echo "Phiên bản mục tiêu: " . $targetVersion . "\n\n";
}

// ----------------------------------------------------
// Mode: Dry Run (Check pending updates)
// ----------------------------------------------------
if (!$apply) {
    if (!$isCli) {
        echo "<div class='card'>";
        echo "<div class='version-box'>";
        echo "<div><div class='version-label'>Phiên bản Hiện tại</div><div class='version-num'>" . $currentVersion . "</div></div>";
        echo "<div style='border-left: 1px solid #e2e8f0; padding-left: 2rem;'><div class='version-label'>Phiên bản Mục tiêu</div><div class='version-num' style='color: #4f46e5;'>" . $targetVersion . "</div></div>";
        echo "</div>";
        
        if ($currentVersion >= $targetVersion) {
            echo "<p><span class='badge badge-success'>✓ Hệ thống đã cập nhật</span> Cơ sở dữ liệu đang ở phiên bản mới nhất. Không cần thực hiện migration.</p>";
        } else {
            echo "<p><span class='badge badge-warning'>⚠️ Phát hiện bản cập nhật mới</span> Cần thực hiện cập nhật cấu trúc cơ sở dữ liệu lên phiên bản " . $targetVersion . ".</p>";
        }
        echo "</div>";

        if ($currentVersion < $targetVersion) {
            echo "<div class='card'>";
            echo "<h3>📋 Chi tiết các bước cập nhật dự kiến</h3>";
            echo "<table>";
            echo "<thead><tr><th>Phiên bản</th><th>Mô tả hoạt động</th><th>Trạng thái</th></tr></thead>";
            echo "<tbody>";
            
            echo "<tr><td>v30</td><td>Đồng bộ cấu trúc cột và index nền tảng (chuyển đổi từ logic 29.8 cũ).</td><td>" . ($currentVersion >= 30 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            echo "<tr><td>v31</td><td>Thay đổi cột stats_update_buffer, bổ sung cột doanh thu (revenue) cho purchase_events và tự động backfill.</td><td>" . ($currentVersion >= 31 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            echo "<tr><td>v32</td><td>Tối ưu bảo mật multi-tenant & indexes hiệu năng cao quy mô 1 tỷ dòng (Hardening v2).</td><td>" . ($currentVersion >= 32 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            echo "<tr><td>v33</td><td>Harden các bảng liên kết trung gian (subscriber_lists, tags, flow_states) & composite PK (Hardening v3).</td><td>" . ($currentVersion >= 33 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            echo "<tr><td>v34</td><td>Chuẩn hóa cột workspace_id cho tất cả các bảng log/buffer, phân vùng raw_event_buffer hàng tuần.</td><td>" . ($currentVersion >= 34 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";
            echo "<tr><td>v35</td><td>Bổ sung index tăng tốc kiểm tra trùng lặp cho survey_responses.</td><td>" . ($currentVersion >= 35 ? "<span class='badge badge-success'>Đã áp dụng</span>" : "<span class='badge badge-info'>Đang chờ</span>") . "</td></tr>";

            echo "</tbody></table>";
            echo "</div>";

            echo "<div class='card' style='background: #fffbeb; border-color: #fef3c7;'>";
            echo "<h4>⚠️ Xác nhận chạy cập nhật thực tế (Live Migration)</h4>";
            echo "<p>Quá trình này sẽ trực tiếp cập nhật cấu trúc cơ sở dữ liệu MySQL trên hệ thống. Vui lòng đảm bảo bạn đã backup dữ liệu trước khi chạy thực tế.</p>";
            echo "<div style='margin-top: 1rem;'>";
            echo "<form method='POST' action='run_migrations.php' style='margin: 0;'>";
            echo "<input type='hidden' name='execute_migration' value='1'>";
            echo "<button type='submit' class='btn btn-warn'>Xác nhận và Áp dụng Migration 🚀</button>";
            echo "</form>";
            echo "</div>";
            echo "</div>";
        }
        echo "</body></html>";
    } else {
        if ($currentVersion >= $targetVersion) {
            echo "Hệ thống đã ở phiên bản mới nhất. Không cần cập nhật.\n";
        } else {
            echo "Có bản cập nhật mới. Phiên bản hiện tại: $currentVersion. Phiên bản mục tiêu: $targetVersion.\n";
            echo "Chạy lệnh sau để áp dụng cập nhật: php api/run_migrations.php --apply\n";
        }
    }
    exit();
}

// ----------------------------------------------------
// Mode: Live Run (Execute updates)
// ----------------------------------------------------
if (!$isCli && !$silent) {
    echo "<div class='card'>";
    echo "<h3>🚀 Tiến trình chạy Migration thực tế</h3>";
    echo "<div class='step-log'>";
}

$logs = [];
$logMsg = function($msg, $type = 'info') use ($isCli, $silent, &$logs) {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . ($type === 'success' ? '[OK] ' : ($type === 'error' ? '[FAIL] ' : '[INFO] ')) . $msg;
    $logs[] = $line;
    if ($silent) {
        return;
    }
    if ($isCli) {
        echo $line . "\n";
    } else {
        $class = $type === 'success' ? 'class="success"' : ($type === 'error' ? 'class="error"' : '');
        echo "<div {$class}>" . htmlspecialchars($line) . "</div>";
        @ob_flush();
        flush();
    }
};

// Advisory Lock
$lockStmt = $pdo->prepare("SELECT GET_LOCK('db_migration_lock', 30) as get_lock");
$lockStmt->execute();
$lockRes = $lockStmt->fetch();

if (!$lockRes || (int)$lockRes['get_lock'] !== 1) {
    $logMsg("Không thể lấy khóa Advisory Lock (tiến trình khác đang chạy migration). Vui lòng thử lại sau.", "error");
    if (!$isCli && !$silent) echo "</div></div></body></html>";
    if ($silent) return;
    exit();
}

$logMsg("Đã lấy khóa Advisory Lock thành công. Bắt đầu chạy migrations...", "info");

// Re-verify current version under lock
$dbVerVal = getSystemSettingSafely($pdo, 'db_version');
if ($dbVerVal !== false) {
    $currentVersion = (int)$dbVerVal;
} else {
    $legacyVal = getSystemSettingSafely($pdo, 'schema_version');
    if ($legacyVal === '29.8') {
        $currentVersion = 30;
    }
}

$ok = 0;
$skipped = 0;
$errors = 0;

$execSql = function($pdo, $stmt) use (&$ok, &$skipped, &$errors, $logMsg) {
    $stmt = trim($stmt);
    if (empty($stmt)) return;
    
    $preview = substr(preg_replace('/\s+/', ' ', $stmt), 0, 80);
    try {
        $pdo->exec($stmt);
        $ok++;
        $logMsg($preview, 'success');
    } catch (PDOException $e) {
        $errMsg = $e->getMessage();
        $sqlErrCode = 0;
        if (preg_match('/SQLSTATE\[[\dA-Z]+\].*?(\d{4})/', $errMsg, $m)) {
            $sqlErrCode = (int)$m[1];
        }
        
        $ignoreCodes = [
            1050, // Table already exists
            1060, // Duplicate column
            1061, // Duplicate key name
            1091, // Can't DROP; check that column/key exists
            1068, // Multiple primary key defined
            1062, // Duplicate entry
        ];
        
        if (in_array($sqlErrCode, $ignoreCodes, true) || strpos($errMsg, 'already exists') !== false || strpos($errMsg, 'Duplicate') !== false) {
            $skipped++;
            $logMsg($preview . " (already applied)", 'info');
        } else {
            $errors++;
            $logMsg($preview . " | Error: " . $errMsg, 'error');
        }
    }
};

try {
    // --------------------------------------------------
    // Version 30: Baseline Migration (from migrate_system_logic.php)
    // --------------------------------------------------
    if ($currentVersion < 30) {
        $logMsg("Đang chạy cập nhật Baseline v30...", "info");
        
        $columns = [
            'flows' => [
                'stat_unique_opened' => "INT DEFAULT 0 AFTER `stat_total_opened`",
                'stat_total_clicked' => "INT DEFAULT 0 AFTER `stat_unique_opened` ",
                'stat_unique_clicked' => "INT DEFAULT 0 AFTER `stat_total_clicked`",
                'stat_total_failed' => "INT DEFAULT 0 AFTER `stat_unique_clicked`",
                'stat_total_unsubscribed' => "INT DEFAULT 0 AFTER `stat_total_failed`"
            ],
            'mail_delivery_logs' => [
                'flow_id' => "CHAR(36) DEFAULT NULL AFTER `campaign_id` ",
                'reminder_id' => "CHAR(36) DEFAULT NULL AFTER `flow_id` ",
                'recipient' => "VARCHAR(255) DEFAULT NULL AFTER `id` ",
                'subject' => "VARCHAR(255) DEFAULT NULL AFTER `recipient` ",
                'error_message' => "TEXT DEFAULT NULL AFTER `status` "
            ],
            'zalo_delivery_logs' => [
                'flow_id' => "CHAR(36) DEFAULT NULL AFTER `id` ",
                'step_id' => "VARCHAR(50) DEFAULT NULL AFTER `flow_id` ",
                'oa_config_id' => "VARCHAR(50) DEFAULT NULL AFTER `subscriber_id` ",
                'template_id' => "VARCHAR(100) DEFAULT NULL AFTER `oa_config_id` ",
                'phone_number' => "VARCHAR(20) DEFAULT NULL AFTER `template_id` ",
                'template_data' => "JSON DEFAULT NULL AFTER `phone_number` ",
                'error_message' => "TEXT DEFAULT NULL AFTER `error_code` ",
                'created_at' => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `sent_at` "
            ],
            'campaigns' => [
                'count_unique_opened' => "INT DEFAULT 0 AFTER `count_opened` ",
                'count_unique_clicked' => "INT DEFAULT 0 AFTER `count_clicked` "
            ],
            'subscribers' => [
                'is_zalo_follower' => "TINYINT(1) DEFAULT 0 AFTER `is_follower` "
            ],
            'lists' => [
                'phone_count' => "INT DEFAULT 0 AFTER `subscriber_count` "
            ]
        ];
        
        foreach ($columns as $table => $cols) {
            foreach ($cols as $colName => $definition) {
                $check = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$colName'")->fetch();
                if (!$check) {
                    $execSql($pdo, "ALTER TABLE `$table` ADD COLUMN `$colName` $definition");
                }
            }
        }
        
        $indices = [
            'subscriber_activity' => [
                'idx_activity_flow_ref_type' => 'flow_id, reference_id, type',
                'idx_activity_flow_time' => 'flow_id, created_at',
                'idx_activity_sub_camp_type' => 'subscriber_id, campaign_id, type'
            ],
            'subscriber_flow_states' => [
                'idx_flow_status_step' => 'flow_id, status, step_id'
            ],
            'subscribers' => [
                'idx_sub_phone' => 'phone_number',
                'idx_sub_email' => 'email'
            ],
            'subscriber_lists' => [
                'idx_list_sub' => 'list_id, subscriber_id'
            ]
        ];
        
        foreach ($indices as $table => $idxs) {
            foreach ($idxs as $name => $cols) {
                $checkIdx = $pdo->query("SHOW INDEX FROM `$table` WHERE Key_name = '$name'")->fetch();
                if (!$checkIdx) {
                    $execSql($pdo, "ALTER TABLE `$table` ADD INDEX `$name` ($cols)");
                }
            }
        }
        
        $execSql($pdo, "CREATE TABLE IF NOT EXISTS mkt_system_settings (
            `workspace_id` int(11) NOT NULL DEFAULT 0,
            `key` VARCHAR(255) NOT NULL,
            `value` MEDIUMTEXT,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`workspace_id`, `key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // Migrate mkt_system_settings PK
        try {
            $colCheck = $pdo->query("SHOW COLUMNS FROM mkt_system_settings LIKE 'workspace_id'")->fetch();
            if (!$colCheck) {
                $execSql($pdo, "ALTER TABLE mkt_system_settings ADD COLUMN `workspace_id` int(11) NOT NULL DEFAULT 0 FIRST");
                $execSql($pdo, "ALTER TABLE mkt_system_settings DROP PRIMARY KEY, ADD PRIMARY KEY (`workspace_id`, `key`)");
            }
        } catch (Exception $e) {}

        // Populate phone_count
        $execSql($pdo, "UPDATE lists l SET l.phone_count = (
            SELECT COUNT(*) FROM subscriber_lists sl 
            JOIN subscribers s ON sl.subscriber_id = s.id 
            WHERE sl.list_id = l.id AND (s.phone_number IS NOT NULL AND s.phone_number != '')
        ) WHERE l.phone_count = 0");
        
        $currentVersion = 30;
    }

    // --------------------------------------------------
    // Version 31: stats_update_buffer & purchase_events alteration + backfill
    // --------------------------------------------------
    if ($currentVersion < 31) {
        $logMsg("Đang chạy cập nhật v31...", "info");
        
        $execSql($pdo, "ALTER TABLE stats_update_buffer MODIFY COLUMN target_table VARCHAR(50) NOT NULL");
        $execSql($pdo, "ALTER TABLE purchase_events ADD COLUMN revenue DECIMAL(15,2) NOT NULL DEFAULT 0");

        // Backfill revenue
        try {
            $events = $pdo->query("SELECT id FROM purchase_events")->fetchAll(PDO::FETCH_COLUMN);
            $updatedCount = 0;
            foreach ($events as $id) {
                $stmt = $pdo->prepare("SELECT SUM(CAST(REGEXP_REPLACE(SUBSTRING_INDEX(details, 'Order value: ', -1), '[^0-9]', '') AS UNSIGNED)) FROM subscriber_activity WHERE type = 'purchase' AND reference_id = ?");
                $stmt->execute([$id]);
                $total = (float)$stmt->fetchColumn();
                if ($total > 0) {
                    $pdo->prepare("UPDATE purchase_events SET revenue = ? WHERE id = ?")->execute([$total, $id]);
                    $updatedCount++;
                }
            }
            $logMsg("Đã backfill doanh thu cho $updatedCount purchase events", "success");
        } catch (Exception $e) {
            $logMsg("Lỗi backfill doanh thu: " . $e->getMessage(), "error");
        }

        $currentVersion = 31;
    }

    // --------------------------------------------------
    // Version 32: Hardening v2
    // --------------------------------------------------
    if ($currentVersion < 32) {
        $logMsg("Đang chạy cập nhật v32 (Hardening v2)...", "info");
        
        safeAddColumn($pdo, 'meta_automation_scenarios', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'meta_conversations', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'zalo_subscribers', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'zalo_subscriber_activity', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'zalo_lists', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'subscriber_tags', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'survey_responses', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'voucher_codes', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'tracking_unique_cache', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);

        // Rebuild Indexes for 1B scale
        safeDropIndex($pdo, 'subscribers', 'idx_subscribers_workspace', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscribers', 'idx_sub_ws_status_id', 'workspace_id, status, id', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscribers', 'idx_sub_ws_email', 'workspace_id, email', $execSql, $logMsg);

        safeDropIndex($pdo, 'subscriber_activity', 'idx_activity_workspace', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_activity', 'idx_act_ws_flow_type', 'workspace_id, flow_id, type, created_at', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_activity', 'idx_act_ws_camp_type', 'workspace_id, campaign_id, type, created_at', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_activity', 'idx_act_ws_sub_type', 'workspace_id, subscriber_id, type, created_at', $execSql, $logMsg);

        safeAddIndex($pdo, 'subscriber_tags', 'idx_st_ws_sub_tag', 'workspace_id, subscriber_id, tag_id', $execSql, $logMsg);
        safeAddIndex($pdo, 'tags', 'idx_tags_ws_name', 'workspace_id, name', $execSql, $logMsg);

        safeAddIndex($pdo, 'zalo_subscribers', 'idx_zs_ws_uid', 'workspace_id, zalo_user_id', $execSql, $logMsg);
        safeAddIndex($pdo, 'zalo_subscribers', 'idx_zs_ws_list', 'workspace_id, zalo_list_id', $execSql, $logMsg);

        safeAddIndex($pdo, 'voucher_codes', 'idx_vc_ws_camp_sub', 'workspace_id, campaign_id, subscriber_id, status', $execSql, $logMsg);

        $currentVersion = 32;
    }

    // --------------------------------------------------
    // Version 33: Hardening v3 (Phase 2)
    // --------------------------------------------------
    if ($currentVersion < 33) {
        $logMsg("Đang chạy cập nhật v33 (Hardening v3)...", "info");

        safeAddColumn($pdo, 'subscriber_lists', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'segment_exclusions', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'segment_count_update_queue', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'subscriber_flow_states', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);
        safeAddColumn($pdo, 'zalo_subscriber_activity', 'workspace_id', 'INT DEFAULT 1', $execSql, $logMsg);

        // Primary keys & indexes
        safeRebuildPK($pdo, 'subscriber_lists', ['workspace_id', 'list_id', 'subscriber_id'], $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_lists', 'idx_sub_lists_ws_sub', 'workspace_id, subscriber_id', $execSql, $logMsg);

        safeRebuildPK($pdo, 'subscriber_tags', ['workspace_id', 'tag_id', 'subscriber_id'], $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_tags', 'idx_sub_tags_ws_sub', 'workspace_id, subscriber_id', $execSql, $logMsg);

        safeRebuildPK($pdo, 'subscriber_flow_states', ['workspace_id', 'flow_id', 'subscriber_id'], $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_flow_states', 'idx_sfs_ws_status_sched', 'workspace_id, status, scheduled_at', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_flow_states', 'idx_sfs_ws_sub', 'workspace_id, subscriber_id', $execSql, $logMsg);

        safeDropIndex($pdo, 'segment_exclusions', 'idx_seg_exclusions_seg', $execSql, $logMsg);
        safeAddIndex($pdo, 'segment_exclusions', 'idx_se_ws_seg_sub', 'workspace_id, segment_id, subscriber_id', $execSql, $logMsg);
        safeAddIndex($pdo, 'segment_count_update_queue', 'idx_scuq_ws_seg', 'workspace_id, segment_id', $execSql, $logMsg);

        safeAddIndex($pdo, 'zalo_subscriber_activity', 'idx_zsa_ws_sub', 'workspace_id, subscriber_id', $execSql, $logMsg);

        $currentVersion = 33;
    }

    // --------------------------------------------------
    // Version 34: Audit & Performance Optimizations
    // --------------------------------------------------
    if ($currentVersion < 34) {
        $logMsg("Đang chạy cập nhật v34 (Audit & Partitions)...", "info");

        safeAddColumn($pdo, 'stats_update_buffer', 'workspace_id', 'INT(11) DEFAULT 1 AFTER `id`', $execSql, $logMsg);
        safeAddIndex($pdo, 'stats_update_buffer', 'idx_workspace_id', 'workspace_id', $execSql, $logMsg);
        safeAddIndex($pdo, 'stats_update_buffer', 'idx_target_lookup', 'target_table, target_id, column_name', $execSql, $logMsg);

        safeAddColumn($pdo, 'subscriber_flow_states', 'workspace_id', 'INT(11) DEFAULT 1 AFTER `id`', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_flow_states', 'idx_workspace_id', 'workspace_id', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscriber_flow_states', 'idx_flow_worker_v2', 'workspace_id, status, scheduled_at', $execSql, $logMsg);

        safeAddColumn($pdo, 'system_audit_logs', 'workspace_id', 'INT(11) DEFAULT 1 AFTER `id`', $execSql, $logMsg);
        safeAddIndex($pdo, 'system_audit_logs', 'idx_workspace_id', 'workspace_id', $execSql, $logMsg);

        $execSql($pdo, "ALTER TABLE `mail_delivery_logs` MODIFY COLUMN `workspace_id` INT(11) DEFAULT 1");
        $execSql($pdo, "ALTER TABLE `mkt_system_settings` MODIFY COLUMN `workspace_id` INT(11) DEFAULT 1");

        safeAddIndex($pdo, 'activity_buffer', 'idx_workspace_batch', 'workspace_id, id', $execSql, $logMsg);
        safeAddIndex($pdo, 'zalo_activity_buffer', 'idx_workspace_batch', 'workspace_id, id', $execSql, $logMsg);

        safeAddIndex($pdo, 'subscriber_flow_states', 'idx_perf_wakeup', 'status, scheduled_at, workspace_id', $execSql, $logMsg);
        safeAddIndex($pdo, 'subscribers', 'idx_perf_search', 'workspace_id, status, id', $execSql, $logMsg);

        // Weekly Partitioning
        try {
            $execSql($pdo, "ALTER TABLE `raw_event_buffer` REORGANIZE PARTITION p_future INTO (
                PARTITION p2026_05 VALUES LESS THAN (unix_timestamp('2026-06-01 00:00:00')),
                PARTITION p2026_06 VALUES LESS THAN (unix_timestamp('2026-07-01 00:00:00')),
                PARTITION p2026_07 VALUES LESS THAN (unix_timestamp('2026-08-01 00:00:00')),
                PARTITION p2026_08 VALUES LESS THAN (unix_timestamp('2026-09-01 00:00:00')),
                PARTITION p2026_09 VALUES LESS THAN (unix_timestamp('2026-10-01 00:00:00')),
                PARTITION p2026_10 VALUES LESS THAN (unix_timestamp('2026-11-01 00:00:00')),
                PARTITION p2026_11 VALUES LESS THAN (unix_timestamp('2026-12-01 00:00:00')),
                PARTITION p2026_12 VALUES LESS THAN (unix_timestamp('2027-01-01 00:00:00')),
                PARTITION p_future VALUES LESS THAN MAXVALUE
            )");
        } catch (Exception $e) {
            $logMsg("Bỏ qua phân vùng raw_event_buffer (có thể bảng không phân vùng sẵn): " . $e->getMessage(), "info");
        }

        safeAddIndex($pdo, 'activity_buffer', 'idx_processed_created', 'processed, created_at', $execSql, $logMsg);

        $currentVersion = 34;
    }

    // --------------------------------------------------
    // Version 35: Survey session token duplicate index
    // --------------------------------------------------
    if ($currentVersion < 35) {
        $logMsg("Đang chạy cập nhật v35 (Survey session token index)...", "info");

        safeAddIndex($pdo, 'survey_responses', 'idx_survey_responses_session_token', 'session_token', $execSql, $logMsg);

        $currentVersion = 35;
    }

    // --------------------------------------------------
    // Version 36: Standardize workspace_id across tracking tables
    // --------------------------------------------------
    if ($currentVersion < 36) {
        $logMsg("Đang chạy cập nhật v36 (Chuẩn hóa workspace_id)...", "info");

        // Web Page Views
        try {
            $execSql($pdo, "ALTER TABLE `web_page_views` MODIFY COLUMN `workspace_id` INT(11) DEFAULT 1");
        } catch (Throwable $e) {
            $logMsg("Lỗi thay đổi cột workspace_id trong web_page_views: " . $e->getMessage(), "error");
        }

        // Web Sessions
        try {
            $execSql($pdo, "ALTER TABLE `web_sessions` MODIFY COLUMN `workspace_id` INT(11) DEFAULT 1");
        } catch (Throwable $e) {
            $logMsg("Lỗi thay đổi cột workspace_id trong web_sessions: " . $e->getMessage(), "error");
        }

        // Web Events
        try {
            $execSql($pdo, "ALTER TABLE `web_events` MODIFY COLUMN `workspace_id` INT(11) DEFAULT 1");
        } catch (Throwable $e) {
            $logMsg("Lỗi thay đổi cột workspace_id trong web_events: " . $e->getMessage(), "error");
        }

        $currentVersion = 36;
    }

    // --------------------------------------------------
    // Version 37: Performance, Index & Concurrency Hadenings
    // --------------------------------------------------
    if ($currentVersion < 37) {
        $logMsg("Đang chạy cập nhật v37 (Tối ưu hóa Index & Hợp nhất Schema)...", "info");

        // 1. timestamp_buffer table
        $execSql($pdo, "CREATE TABLE IF NOT EXISTS timestamp_buffer (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            subscriber_id char(36) NOT NULL,
            column_name VARCHAR(50) NOT NULL,
            timestamp_value DATETIME NOT NULL,
            processed TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_processed (processed),
            INDEX idx_sub_col (subscriber_id, column_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // 2. reference_key in tracking_unique_cache
        safeAddColumn($pdo, 'tracking_unique_cache', 'reference_key', 'VARCHAR(255) DEFAULT NULL', $execSql, $logMsg);

        // 3. Spam Debounce Index
        safeAddIndex($pdo, 'subscriber_activity', 'idx_spam_debounce', 'subscriber_id, type, created_at', $execSql, $logMsg);

        // 4. Anti-join Index for Campaigns
        safeAddIndex($pdo, 'subscriber_activity', 'idx_activity_sub_camp_type', 'subscriber_id, campaign_id, type', $execSql, $logMsg);

        // 5. Worker queue status/updated index
        safeAddIndex($pdo, 'ai_pdf_chunk_results', 'idx_status_updated', 'status, updated_at', $execSql, $logMsg);

        // 6. ZNS Click stats
        safeAddColumn($pdo, 'flows', 'stat_total_zalo_clicked', "INT(11) NOT NULL DEFAULT 0 COMMENT 'ZNS click stat'", $execSql, $logMsg);
        safeAddColumn($pdo, 'flows', 'stat_unique_zalo_clicked', "INT(11) NOT NULL DEFAULT 0 COMMENT 'ZNS click stat'", $execSql, $logMsg);

        // 7. html_content in campaign_reminders
        safeAddColumn($pdo, 'campaign_reminders', 'html_content', "MEDIUMTEXT DEFAULT NULL COMMENT 'Cached HTML build for reminder'", $execSql, $logMsg);

        // 8. Clean up redundant/duplicate indexes
        safeDropIndex($pdo, 'subscribers', 'email_2', $execSql, $logMsg);
        safeDropIndex($pdo, 'subscriber_lists', 'list_id_2', $execSql, $logMsg);

        $currentVersion = 37;
    }

    // --------------------------------------------------
    // Version 38: Subscriber Activity workspace_id repair & trigger
    // --------------------------------------------------
    if ($currentVersion < 38) {
        $logMsg("Đang chạy cập nhật v38 (Sửa và tự động duy trì workspace_id cho activity)...", "info");

        // 1. Repair NULL workspace_id in subscriber_activity
        try {
            $sqlRepair = "UPDATE subscriber_activity sa
                          JOIN subscribers s ON sa.subscriber_id = s.id
                          SET sa.workspace_id = s.workspace_id
                          WHERE sa.workspace_id IS NULL";
            $execSql($pdo, $sqlRepair);
            $logMsg("Đã sửa các hoạt động có workspace_id trống", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi sửa workspace_id trống: " . $e->getMessage(), "error");
        }

        // 2. Drop trigger if exists
        try {
            $pdo->exec("DROP TRIGGER IF EXISTS before_insert_subscriber_activity");
        } catch (Throwable $e) {}

        // 3. Create BEFORE INSERT trigger
        try {
            $sqlTrigger = "
                CREATE TRIGGER before_insert_subscriber_activity
                BEFORE INSERT ON subscriber_activity
                FOR EACH ROW
                BEGIN
                    IF NEW.workspace_id IS NULL AND NEW.subscriber_id IS NOT NULL THEN
                        SET NEW.workspace_id = (SELECT workspace_id FROM subscribers WHERE id = NEW.subscriber_id LIMIT 1);
                    END IF;
                END;
            ";
            $pdo->exec($sqlTrigger);
            $logMsg("Đã tạo trigger before_insert_subscriber_activity thành công!", "success");
        } catch (Throwable $e) {
            $logMsg("Lỗi tạo trigger database: " . $e->getMessage(), "error");
        }

        $currentVersion = 38;
    }

    // --------------------------------------------------
    // Version 39: Add workspace_id column to zalo_user_messages
    // --------------------------------------------------
    if ($currentVersion < 39) {
        $logMsg("Đang chạy cập nhật v39 (Thêm cột workspace_id vào zalo_user_messages)...", "info");
        safeAddColumn($pdo, 'zalo_user_messages', 'workspace_id', "INT(11) NULL DEFAULT 1 AFTER zalo_user_id", $execSql, $logMsg);
        safeAddIndex($pdo, 'zalo_user_messages', 'idx_workspace_id', 'workspace_id', $execSql, $logMsg);
        $currentVersion = 39;
    }

    // --------------------------------------------------
    // Version 40: Add AI group tables and owner_email column
    // --------------------------------------------------
    if ($currentVersion < 40) {
        $logMsg("Đang chạy cập nhật v40 (Tạo các bảng AI group và thêm owner_email)...", "info");
        
        // 1. Create ai_usage_analytics
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `ai_usage_analytics` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `group_id` VARCHAR(50) NOT NULL,
              `ai_id` VARCHAR(50) NOT NULL,
              `user_email` VARCHAR(191) NOT NULL,
              `conversation_id` VARCHAR(100) NULL,
              `message_count` INT(11) DEFAULT 1,
              `tokens_used` INT(11) DEFAULT 0,
              `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              INDEX `idx_group_id` (`group_id`),
              INDEX `idx_ai_id` (`ai_id`),
              INDEX `idx_user_email` (`user_email`),
              INDEX `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng ai_usage_analytics", "success");

        // 2. Create ai_group_members
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `ai_group_members` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `group_id` VARCHAR(100) NOT NULL,
              `user_email` VARCHAR(191) NOT NULL,
              `role` ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
              `invited_by` VARCHAR(191) NOT NULL,
              `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_group_user` (`group_id`, `user_email`),
              INDEX `idx_group_id` (`group_id`),
              INDEX `idx_user_email` (`user_email`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng ai_group_members", "success");

        // 3. Create ai_group_audit_logs
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `ai_group_audit_logs` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `group_id` VARCHAR(100) NOT NULL,
              `user_email` VARCHAR(191) NOT NULL,
              `action` VARCHAR(50) NOT NULL,
              `target_email` VARCHAR(191) NULL,
              `details` TEXT NULL,
              `ip_address` VARCHAR(45) NULL,
              `user_agent` VARCHAR(255) NULL,
              `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              INDEX `idx_group_id` (`group_id`),
              INDEX `idx_user_email` (`user_email`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng ai_group_audit_logs", "success");

        // 4. Add owner_email column to ai_chatbot_categories
        safeAddColumn($pdo, 'ai_chatbot_categories', 'owner_email', "VARCHAR(191) NULL AFTER admin_id", $execSql, $logMsg);
        safeAddIndex($pdo, 'ai_chatbot_categories', 'idx_owner_email', 'owner_email', $execSql, $logMsg);
        
        $currentVersion = 40;
    }

    // --------------------------------------------------
    // Version 41: Add approval_requests and ai_org_user_activity_logs tables
    // --------------------------------------------------
    if ($currentVersion < 41) {
        $logMsg("Đang chạy cập nhật v41 (Tạo bảng approval_requests và ai_org_user_activity_logs)...", "info");
        
        // 1. Create approval_requests
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `approval_requests` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `workspace_id` INT(11) NOT NULL,
              `target_type` VARCHAR(50) NOT NULL,
              `target_id` VARCHAR(100) NOT NULL,
              `request_user_id` VARCHAR(100) NOT NULL,
              `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
              `reason` TEXT NULL,
              `approver_id` VARCHAR(100) NULL,
              `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              INDEX `idx_workspace_target` (`workspace_id`, `target_type`, `target_id`),
              INDEX `idx_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng approval_requests", "success");

        // 2. Create ai_org_user_activity_logs
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `ai_org_user_activity_logs` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `user_id` VARCHAR(100) NOT NULL,
              `action` VARCHAR(100) NOT NULL,
              `details` TEXT NULL,
              `ip_address` VARCHAR(45) NULL,
              `user_agent` VARCHAR(255) NULL,
              `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              INDEX `idx_user_action` (`user_id`, `action`),
              INDEX `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng ai_org_user_activity_logs", "success");
        
        $currentVersion = 41;
    }

    // --------------------------------------------------
    // Version 42: Add missing web tracking tables and columns
    // --------------------------------------------------
    if ($currentVersion < 42) {
        $logMsg("Đang chạy cập nhật v42 (Tạo các bảng web tracking và thêm cột thiếu)...", "info");
        
        // 1. Create web_heatmap_data
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `web_heatmap_data` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `page_url` VARCHAR(768) NOT NULL,
              `x_position` INT(11) NOT NULL,
              `y_position` INT(11) NOT NULL,
              `viewport_width` INT(11) NOT NULL,
              `viewport_height` INT(11) NOT NULL,
              `element_text` VARCHAR(255) NULL,
              `clicked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              INDEX `idx_page_url` (`page_url`(255))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng web_heatmap_data", "success");

        // 2. Create web_form_submissions
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `web_form_submissions` (
              `id` INT(11) NOT NULL AUTO_INCREMENT,
              `session_id` VARCHAR(36) NOT NULL,
              `visitor_id` VARCHAR(36) NOT NULL,
              `subscriber_id` VARCHAR(36) NOT NULL,
              `form_url` VARCHAR(768) NOT NULL,
              `form_data` LONGTEXT NOT NULL,
              `points_awarded` INT(11) DEFAULT 10,
              `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              INDEX `idx_session` (`session_id`),
              INDEX `idx_visitor` (`visitor_id`),
              INDEX `idx_subscriber` (`subscriber_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng web_form_submissions", "success");

        // 3. Create web_tracking_sites
        $execSql($pdo, "
            CREATE TABLE IF NOT EXISTS `web_tracking_sites` (
              `id` VARCHAR(50) NOT NULL,
              `workspace_id` INT(11) NOT NULL,
              `name` VARCHAR(255) NOT NULL,
              `domain` VARCHAR(255) NOT NULL,
              `tracking_code` VARCHAR(50) NOT NULL,
              `description` TEXT NULL,
              `status` ENUM('active', 'inactive') DEFAULT 'active',
              `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_tracking_code` (`tracking_code`),
              INDEX `idx_workspace` (`workspace_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng web_tracking_sites", "success");

        // 4. Add workspace_id column to zalo_delivery_logs
        safeAddColumn($pdo, 'zalo_delivery_logs', 'workspace_id', "INT(11) NULL DEFAULT 1 AFTER subscriber_id", $execSql, $logMsg);
        safeAddIndex($pdo, 'zalo_delivery_logs', 'idx_workspace_id', 'workspace_id', $execSql, $logMsg);

        // 5. Add country, city columns to web_sessions
        safeAddColumn($pdo, 'web_sessions', 'country', "VARCHAR(100) NULL AFTER os", $execSql, $logMsg);
        safeAddColumn($pdo, 'web_sessions', 'city', "VARCHAR(100) NULL AFTER country", $execSql, $logMsg);
        
        $currentVersion = 42;
    }

    // --------------------------------------------------
    // Version 43: Add phone_count column to segments table
    // --------------------------------------------------
    if ($currentVersion < 43) {
        $logMsg("Đang chạy cập nhật v43 (Thêm cột phone_count và tạo bảng web_analytics_summary)...", "info");
        safeAddColumn($pdo, 'segments', 'phone_count', "INT(11) NULL DEFAULT 0 AFTER subscriber_count", $execSql, $logMsg);
        
        // Create web_analytics_summary
        $execSql($pdo, "
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $logMsg("Đã tạo bảng web_analytics_summary", "success");

        $currentVersion = 43;
    }

    // --------------------------------------------------
    // Version 44: Add ledaovuphuong@gmail.com as root admin
    // --------------------------------------------------
    if ($currentVersion < 44) {
        $logMsg("Đang chạy cập nhật v44 (Thêm ledaovuphuong@gmail.com làm Admin)...", "info");
        $execSql($pdo, "INSERT INTO users (email, name, role, status) 
                        VALUES ('ledaovuphuong@gmail.com', 'Admin Phuong', 'admin', 'approved')
                        ON DUPLICATE KEY UPDATE role='admin', status='approved'");
        $currentVersion = 44;
    }

    // Update settings table with new db_version
    $stmtVer = $pdo->prepare("INSERT INTO mkt_system_settings (`workspace_id`, `key`, `value`) VALUES (0, 'db_version', ?) 
                              ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    $stmtVer->execute([$targetVersion]);
    
    // Also sync old schema_version legacy config
    $stmtLeg = $pdo->prepare("INSERT INTO mkt_system_settings (`workspace_id`, `key`, `value`) VALUES (0, 'schema_version', '29.8') 
                              ON DUPLICATE KEY UPDATE `value` = '29.8'");
    $stmtLeg->execute();

    $logMsg("Migration hoàn tất lên phiên bản " . $targetVersion, "success");

} catch (Throwable $e) {
    $logMsg("Lỗi nghiêm trọng trong quá trình chạy migration: " . $e->getMessage(), "error");
}

// Release lock
$pdo->prepare("SELECT RELEASE_LOCK('db_migration_lock')")->execute();

// ── Write detailed migration log ─────────────────────
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
$logFile = $logDir . '/migration_' . date('Ymd_His') . '.log';
file_put_contents($logFile, implode("\n", $logs));
$logMsg("Đã ghi log chi tiết vào " . $logFile, "info");

if ($silent) {
    return;
}

if (!$isCli) {
    echo "</div>";
    echo "<p style='margin-top: 1rem;'><a href='/' class='btn'>← Quay về Trang chủ</a></p>";
    echo "</div></body></html>";
}
exit($errors > 0 ? 1 : 0);
?>
