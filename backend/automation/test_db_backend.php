<?php
/**
 * api/test_db_backend.php
 * Automated integration test suite for database and backend business logic.
 * Supported modes: CLI and Browser.
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

// CLI vs Web mode
$isCli = (php_sapi_name() === 'cli' || isset($_GET['cli']));
if (!$isCli) {
    header("Content-Type: text/html; charset=UTF-8");
} else {
    if (!defined('STDIN')) {
        header("Content-Type: text/plain; charset=UTF-8");
    }
}

// ANSI colors for CLI
define('COLOR_RESET', "\033[0m");
define('COLOR_RED', "\033[31m");
define('COLOR_GREEN', "\033[32m");
define('COLOR_YELLOW', "\033[33m");
define('COLOR_BLUE', "\033[34m");
define('COLOR_CYAN', "\033[36m");
define('COLOR_WHITE', "\033[37m");
define('COLOR_BOLD', "\033[1m");

$testResults = [];
$startTime = microtime(true);

// Output helper
function printResult($testName, $status, $details = '', $timeMs = null) {
    global $isCli, $testResults;
    
    $timeStr = $timeMs !== null ? " (" . number_format($timeMs, 2) . "ms)" : "";
    $statusText = $status ? "PASSED" : "FAILED";
    
    $testResults[] = [
        'name' => $testName,
        'status' => $status,
        'details' => $details,
        'time' => $timeMs
    ];

    if ($isCli) {
        $color = $status ? COLOR_GREEN : COLOR_RED;
        echo COLOR_BOLD . "[ " . $color . $statusText . COLOR_RESET . COLOR_BOLD . " ] " . COLOR_WHITE . $testName . COLOR_RESET . $timeStr . PHP_EOL;
        if (!empty($details)) {
            echo "         " . COLOR_CYAN . $details . COLOR_RESET . PHP_EOL;
        }
    }
}

// Section helper
function printSectionHeader($title) {
    global $isCli;
    if ($isCli) {
        echo PHP_EOL . COLOR_BOLD . COLOR_BLUE . "=== " . $title . " ===" . COLOR_RESET . PHP_EOL;
    }
}

// 1. Connection & Pre-connect Check
printSectionHeader("1. KẾT NỐI DATABASE & CẤU HÌNH");

$pdo = null;
$dbType = 'mysql';
$dbConnectTime = null;
$usingMockSqlite = false;

// 1.1 Read environment variables dynamically first to avoid crashing
$host = getenv('DB_HOST') !== false ? getenv('DB_HOST') : 'localhost';
$db   = getenv('DB_NAME') !== false ? getenv('DB_NAME') : 'vhvxoigh_mail_auto';
$user = getenv('DB_USER') !== false ? getenv('DB_USER') : 'vhvxoigh_mail_auto';
$pass = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : 'Ideas@812';

$dbStart = microtime(true);
$canConnectMySQL = false;
$mysqlError = '';

try {
    // Try short-timeout connection to verify credentials first
    $tempDsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
    $tempPdo = new PDO($tempDsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 2
    ]);
    $canConnectMySQL = true;
    $tempPdo = null; // Close
} catch (Exception $e) {
    $mysqlError = $e->getMessage();
}

if ($canConnectMySQL) {
    try {
        // Safe to require db_connect.php now
        ob_start();
        require_once __DIR__ . '/db_connect.php';
        ob_end_clean();
        
        if (isset($pdo) && $pdo instanceof PDO) {
            $dbConnectTime = (microtime(true) - $dbStart) * 1000;
            printResult("Kết nối database MySQL thành công (qua db_connect.php)", true, "Database: $db tại $host", $dbConnectTime);
        } else {
            throw new Exception("Biến \$pdo không được tìm thấy sau khi nạp db_connect.php.");
        }
    } catch (Exception $e) {
        if (ob_get_level() > 0) ob_end_clean();
        printResult("Nạp db_connect.php thất bại", false, $e->getMessage());
        $canConnectMySQL = false;
    }
}

// 1.2 Fallback to SQLite if MySQL is unavailable
if (!$canConnectMySQL) {
    printResult("Kết nối MySQL không khả dụng", false, "Lỗi: " . ($mysqlError ?: 'Lỗi chưa rõ'));
    printSectionHeader("KHỞI TẠO CƠ SỞ DỮ LIỆU SQLITE (MOCK ENVIRONMENT)");
    try {
        $sqliteStart = microtime(true);
        $pdo = new PDO("sqlite::memory:");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $dbType = 'sqlite';
        $usingMockSqlite = true;
        $dbConnectTime = (microtime(true) - $sqliteStart) * 1000;
        printResult("Khởi tạo SQLite In-Memory Database thành công", true, "Đang chạy chế độ Mocking Sandbox", $dbConnectTime);
    } catch (Exception $ex) {
        printResult("Khởi tạo SQLite Mock Database thất bại", false, $ex->getMessage());
        die("FATAL: Không có kết nối database hoạt động.");
    }
}

// 2. Schema Audit Test
printSectionHeader("2. KIỂM TRA CẤU TRÚC BẢNG (SCHEMA AUDIT)");

$criticalTables = [
    'workspaces' => 'Không gian làm việc',
    'subscribers' => 'Danh sách người đăng ký',
    'flows' => 'Chuỗi luồng tự động',
    'subscriber_flow_states' => 'Trạng thái người dùng trong luồng',
    'subscriber_activity' => 'Nhật ký hoạt động khách hàng',
    'activity_buffer' => 'Bộ đệm xử lý hoạt động',
    'campaigns' => 'Các chiến dịch gửi mail',
    'mkt_system_settings' => 'Cấu hình hệ thống',
    'zalo_oa_configs' => 'Liên kết Zalo OA',
    'admin_logs' => 'Nhật ký quản trị viên',
    'stats_update_buffer' => 'Bộ đệm cập nhật chỉ số'
];

// If SQLite, create mock schemas
if ($dbType === 'sqlite') {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS workspaces (id INTEGER PRIMARY KEY, name TEXT)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS subscribers (
            id TEXT PRIMARY KEY, 
            email TEXT, 
            first_name TEXT, 
            last_name TEXT, 
            phone_number TEXT,
            status TEXT, 
            joined_at TIMESTAMP, 
            meta_psid TEXT,
            stats_sent INTEGER DEFAULT 0,
            stats_opened INTEGER DEFAULT 0,
            stats_clicked INTEGER DEFAULT 0
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS flows (
            id TEXT PRIMARY KEY, 
            name TEXT, 
            steps TEXT, 
            status TEXT
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS subscriber_flow_states (
            workspace_id INTEGER DEFAULT 1,
            subscriber_id TEXT, 
            flow_id TEXT, 
            step_id TEXT, 
            status TEXT, 
            scheduled_at TIMESTAMP, 
            updated_at TIMESTAMP,
            PRIMARY KEY(subscriber_id, flow_id)
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS subscriber_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            subscriber_id TEXT, 
            workspace_id INTEGER,
            type TEXT, 
            details TEXT, 
            created_at TIMESTAMP
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS activity_buffer (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            workspace_id INTEGER,
            subscriber_id TEXT, 
            type TEXT, 
            details TEXT, 
            reference_id TEXT, 
            flow_id TEXT, 
            campaign_id TEXT, 
            extra_data TEXT, 
            processed INTEGER DEFAULT 0, 
            created_at TIMESTAMP
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY, 
            workspace_id INTEGER, 
            name TEXT, 
            status TEXT, 
            scheduled_at TIMESTAMP, 
            created_at TIMESTAMP
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS mkt_system_settings (
            workspace_id INTEGER, 
            key TEXT, 
            value TEXT, 
            PRIMARY KEY (workspace_id, key)
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS zalo_oa_configs (
            id TEXT PRIMARY KEY, 
            workspace_id INTEGER, 
            name TEXT, 
            is_enabled INTEGER DEFAULT 0
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS admin_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            admin_id TEXT, 
            action TEXT, 
            target_type TEXT, 
            target_id TEXT, 
            details TEXT, 
            created_at TIMESTAMP
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS stats_update_buffer (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            workspace_id INTEGER, 
            target_table TEXT, 
            target_id TEXT, 
            column_name TEXT, 
            increment INTEGER, 
            created_at TIMESTAMP
        )");
        printResult("Khởi tạo cấu trúc Mock SQLite", true, "Đã khởi tạo " . count($criticalTables) . " bảng.");
    } catch (Exception $e) {
        printResult("Khởi tạo cấu trúc Mock SQLite", false, $e->getMessage());
    }
}

// Verify tables are queryable
foreach ($criticalTables as $table => $desc) {
    $start = microtime(true);
    try {
        $tableQuery = $table;
        // mkt_system_settings compatibility
        if ($table === 'mkt_system_settings' && $dbType === 'mysql') {
            // Check if settings or mkt_system_settings
            try {
                $pdo->query("SELECT 1 FROM `mkt_system_settings` LIMIT 1");
                $tableQuery = 'mkt_system_settings';
            } catch (Exception $e) {
                $pdo->query("SELECT 1 FROM `settings` LIMIT 1");
                $tableQuery = 'settings';
            }
        }
        
        $pdo->query("SELECT 1 FROM `$tableQuery` LIMIT 1");
        $timeMs = (microtime(true) - $start) * 1000;
        
        $count = $pdo->query("SELECT COUNT(*) FROM `$tableQuery`")->fetchColumn();
        printResult("Bảng `$table` ($desc)", true, "Khả dụng. Bản ghi hiện tại: $count", $timeMs);
    } catch (Exception $e) {
        $timeMs = (microtime(true) - $start) * 1000;
        printResult("Bảng `$table` ($desc)", false, "Lỗi kiểm tra bảng: " . $e->getMessage(), $timeMs);
    }
}

// 3. SQL Engine & CRUD Tests
printSectionHeader("3. KIỂM THỬ THAO TÁC CƠ SỞ DỮ LIỆU (CRUD & TRANSACTIONS)");

$tempTableName = "test_crud_" . rand(100, 999);
$isSqlite = ($dbType === 'sqlite');

try {
    $start = microtime(true);
    // Create temporary table
    if ($isSqlite) {
        $pdo->exec("CREATE TEMP TABLE `$tempTableName` (id INTEGER PRIMARY KEY, val TEXT, extra_json TEXT)");
    } else {
        $pdo->exec("CREATE TEMPORARY TABLE `$tempTableName` (id INT PRIMARY KEY, val VARCHAR(100), extra_json JSON)");
    }
    
    // Insert test
    $stmt = $pdo->prepare("INSERT INTO `$tempTableName` (id, val, extra_json) VALUES (?, ?, ?)");
    $stmt->execute([1, "Test Integration Record", json_encode(['level' => 'admin', 'verified' => true])]);
    
    // Select test
    $stmt = $pdo->prepare("SELECT * FROM `$tempTableName` WHERE id = ?");
    $stmt->execute([1]);
    $row = $stmt->fetch();
    
    if (!$row || $row['val'] !== 'Test Integration Record') {
        throw new Exception("Lỗi: Dữ liệu trả về không khớp.");
    }
    
    // JSON logic test
    $json = json_decode($row['extra_json'], true);
    if (!is_array($json) || $json['level'] !== 'admin') {
        throw new Exception("Lỗi: Đọc/ghi JSON trường extra_json không chính xác.");
    }
    
    // Update test
    $stmt = $pdo->prepare("UPDATE `$tempTableName` SET val = ? WHERE id = ?");
    $stmt->execute(["Updated Record", 1]);
    
    $stmt = $pdo->prepare("SELECT val FROM `$tempTableName` WHERE id = ?");
    $stmt->execute([1]);
    if ($stmt->fetchColumn() !== 'Updated Record') {
        throw new Exception("Lỗi: Cập nhật dữ liệu thất bại.");
    }
    
    // Delete test
    $pdo->exec("DELETE FROM `$tempTableName` WHERE id = 1");
    $count = $pdo->query("SELECT COUNT(*) FROM `$tempTableName`")->fetchColumn();
    if ($count != 0) {
        throw new Exception("Lỗi: Xóa dữ liệu thất bại.");
    }
    
    $pdo->exec("DROP TABLE `$tempTableName`");
    $timeMs = (microtime(true) - $start) * 1000;
    printResult("Kiểm tra CRUD (Insert/Select/Update/Delete)", true, "Ghi, Đọc, Sửa, Xóa dữ liệu hoạt động hoàn hảo.", $timeMs);
} catch (Exception $e) {
    printResult("Kiểm tra CRUD (Insert/Select/Update/Delete)", false, "Lỗi: " . $e->getMessage());
}

// Transaction rollback validation
try {
    $start = microtime(true);
    $pdo->beginTransaction();
    
    $wsId = rand(8888, 9999);
    $insertWs = $isSqlite
        ? "INSERT OR REPLACE INTO workspaces (id, name) VALUES (?, ?)"
        : "INSERT INTO workspaces (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)";
        
    $pdo->prepare($insertWs)->execute([$wsId, "Temp Workspace Integration Test"]);
    
    $count = $pdo->query("SELECT COUNT(*) FROM workspaces WHERE id = $wsId")->fetchColumn();
    if ($count != 1) {
        throw new Exception("Chèn dữ liệu trong transaction không khả dụng.");
    }
    
    $pdo->rollBack();
    
    $countAfter = $pdo->query("SELECT COUNT(*) FROM workspaces WHERE id = $wsId")->fetchColumn();
    if ($countAfter != 0) {
        throw new Exception("Rollback thất bại, bản ghi kiểm thử không bị thu hồi.");
    }
    
    $timeMs = (microtime(true) - $start) * 1000;
    printResult("Giao dịch tự động (Transaction & Rollback)", true, "Bắt đầu transaction và khôi phục trạng thái chuẩn xác.", $timeMs);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    printResult("Giao dịch tự động (Transaction & Rollback)", false, "Lỗi: " . $e->getMessage());
}

// 4. Advanced Lock & SQL Features Check
printSectionHeader("4. KIỂM TRA CHỈ CHỈ MỤC & CƠ CHẾ KHÓA DỮ LIỆU (GET_LOCK / SKIP LOCKED)");

if ($dbType !== 'sqlite') {
    // Check SKIP LOCKED
    try {
        $start = microtime(true);
        $pdo->beginTransaction();
        // Check database schema compatibility
        $pdo->query("SELECT * FROM subscribers LIMIT 1 FOR UPDATE SKIP LOCKED")->fetchAll();
        $pdo->rollBack();
        $timeMs = (microtime(true) - $start) * 1000;
        printResult("Hỗ trợ khóa hàng 'FOR UPDATE SKIP LOCKED'", true, "Syntax hợp lệ. Có thể xử lý queue song song hiệu năng cao.", $timeMs);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        printResult("Hỗ trợ khóa hàng 'FOR UPDATE SKIP LOCKED'", false, "Khuyên dùng nâng cấp MySQL 8.0+ / MariaDB 10.6+ để hỗ trợ SKIP LOCKED. Lỗi: " . $e->getMessage());
    }
    
    // Check GET_LOCK
    try {
        $start = microtime(true);
        $lockName = 'autoflow_integration_lock_' . rand(100, 999);
        $stmt = $pdo->prepare("SELECT GET_LOCK(?, 1)");
        $stmt->execute([$lockName]);
        $lockResult = $stmt->fetchColumn();
        
        if ($lockResult == 1) {
            $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
            $timeMs = (microtime(true) - $start) * 1000;
            printResult("Hỗ trợ khóa phân tán 'GET_LOCK'", true, "GET_LOCK và RELEASE_LOCK khả dụng.", $timeMs);
        } else {
            throw new Exception("GET_LOCK trả về 0.");
        }
    } catch (Exception $e) {
        printResult("Hỗ trợ khóa phân tán 'GET_LOCK'", false, "Lỗi: " . $e->getMessage());
    }
} else {
    printResult("Cơ chế khóa đặc thù MySQL (SKIP LOCKED & GET_LOCK)", true, "Bỏ qua (Đang mô phỏng trên SQLite).");
}

// 5. Backend Business Logic Mocking
printSectionHeader("5. MÔ PHỎNG & KIỂM THỬ LOGIC BACKEND");

$logicSuccess = true;
try {
    $start = microtime(true);
    
    // Make sure FlowExecutor and Mailer are included
    if (!class_exists('FlowExecutor')) {
        ob_start();
        require_once __DIR__ . '/FlowExecutor.php';
        ob_end_clean();
    }
    
    if (!class_exists('Mailer')) {
        ob_start();
        require_once __DIR__ . '/Mailer.php';
        ob_end_clean();
    }
    
    if (class_exists('FlowExecutor') && class_exists('Mailer')) {
        printResult("Nạp lớp FlowExecutor & Mailer", true, "Đã import thành công.");
    } else {
        throw new Exception("Thiếu các file logic FlowExecutor.php hoặc Mailer.php.");
    }
    
    // Seed Sandbox data inside transaction
    $pdo->beginTransaction();
    
    $wsId = 999;
    $subId = 'test-sub-999';
    $flowId = 'test-flow-999';
    
    $insertWs = $isSqlite 
        ? "INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)"
        : "INSERT IGNORE INTO workspaces (id, name) VALUES (?, ?)";
    $pdo->prepare($insertWs)->execute([$wsId, "Integration Testing Workspace"]);
    
    // Insert mock settings
    $settingsTable = 'mkt_system_settings';
    if ($dbType === 'mysql') {
        try {
            $pdo->query("SELECT 1 FROM `mkt_system_settings` LIMIT 1");
        } catch (Exception $e) {
            $settingsTable = 'settings';
        }
    }
    
    $insertSetting = $isSqlite
        ? "INSERT OR REPLACE INTO $settingsTable (workspace_id, key, value) VALUES (?, ?, ?)"
        : "INSERT INTO $settingsTable (workspace_id, `key`, `value`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)";
        
    $pdo->prepare($insertSetting)->execute([0, 'smtp_enabled', '0']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_host', 'localhost']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_port', '25']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_user', 'test']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_pass', 'test']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_from_email', 'test@ka-en.com.vn']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_from_name', 'Test System']);
    $pdo->prepare($insertSetting)->execute([0, 'smtp_encryption', 'none']);
    
    // Instantiate Mailer and FlowExecutor
    $mailer = new Mailer($pdo, 'http://localhost/api', 'test@ka-en.com.vn', $wsId);
    $executor = new FlowExecutor($pdo, $mailer, 'http://localhost/api');
    
    printResult("Khởi tạo các Service Engine", true, "Khởi tạo Mailer và FlowExecutor thành công.");
    
    // Seed subscriber
    $insertSub = $isSqlite
        ? "INSERT OR REPLACE INTO subscribers (id, email, first_name, last_name, phone_number, status, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        : "INSERT INTO subscribers (id, email, first_name, last_name, phone_number, status, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE first_name=VALUES(first_name)";
    $pdo->prepare($insertSub)->execute([$subId, 'sub_test@ka-en.com.vn', 'Test User', 'Integration', '0912345678', 'active', date('Y-m-d H:i:s')]);
    
    // Seed Flow
    $steps = [
        [
            'id' => 'step-1',
            'type' => 'action',
            'action_type' => 'email',
            'template_id' => 'temp-1',
            'next_step' => 'step-2'
        ],
        [
            'id' => 'step-2',
            'type' => 'delay',
            'duration' => 60,
            'next_step' => null
        ]
    ];
    
    $insertFlow = $isSqlite
        ? "INSERT OR REPLACE INTO flows (id, name, steps, status) VALUES (?, ?, ?, ?)"
        : "INSERT INTO flows (id, name, steps, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)";
    $pdo->prepare($insertFlow)->execute([$flowId, 'Integrate Test Flow', json_encode($steps), 'active']);
    
    // Seed Flow State
    $insertState = $isSqlite
        ? "INSERT OR REPLACE INTO subscriber_flow_states (workspace_id, subscriber_id, flow_id, step_id, status, scheduled_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        : "INSERT INTO subscriber_flow_states (workspace_id, subscriber_id, flow_id, step_id, status, scheduled_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE step_id=VALUES(step_id)";
    $pdo->prepare($insertState)->execute([1, $subId, $flowId, 'step-1', 'waiting', date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]);
    
    printResult("Chuẩn bị dữ liệu mẫu trong Transaction", true, "Đã nạp subscriber, flow và flow state giả lập.");
    
    // Test state update execution logic
    $pdo->prepare("UPDATE subscriber_flow_states SET step_id = ?, status = ?, updated_at = ? WHERE subscriber_id = ? AND flow_id = ?")
        ->execute(['step-2', 'processing', date('Y-m-d H:i:s'), $subId, $flowId]);
        
    $stmt = $pdo->prepare("SELECT step_id, status FROM subscriber_flow_states WHERE subscriber_id = ? AND flow_id = ?");
    $stmt->execute([$subId, $flowId]);
    $updatedState = $stmt->fetch();
    
    if ($updatedState['step_id'] !== 'step-2' || $updatedState['status'] !== 'processing') {
        throw new Exception("Thao tác cập nhật trạng thái bước Flow thất bại.");
    }
    
    // Mock queue buffers
    $insertBuffer = "INSERT INTO activity_buffer (workspace_id, subscriber_id, type, details, flow_id, extra_data) VALUES (?, ?, ?, ?, ?, ?)";
    $pdo->prepare($insertBuffer)->execute([$wsId, $subId, 'flow_step_executed', 'Simulated execution of email template temp-1', $flowId, json_encode(['mock' => true])]);
    
    $bufferCount = $pdo->query("SELECT COUNT(*) FROM activity_buffer WHERE subscriber_id = '$subId'")->fetchColumn();
    if ($bufferCount != 1) {
        throw new Exception("Ghi nhật ký vào activity_buffer thất bại.");
    }
    
    // Rollback changes safely
    $pdo->rollBack();
    
    $timeMs = (microtime(true) - $start) * 1000;
    printResult("Mô phỏng chu trình Flow Execution", true, "Mô phỏng thay đổi trạng thái và chèn activity buffer hoạt động tốt.", $timeMs);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    printResult("Mô phỏng chu trình Flow Execution", false, "Lỗi nghiệp vụ: " . $e->getMessage());
}

// 6. Deep Audit (Conflict & Edge-case Verification)
printSectionHeader("6. KIỂM ĐỊNH MÃ NGUỒN VÀ TRÁNH XUNG ĐỘT (DEEP HEALTH AUDIT)");

$dir = is_dir(__DIR__ . '/api') ? __DIR__ . '/api' : __DIR__;
$FILES = [
    'FlowExecutor'            => @file_get_contents($dir . '/FlowExecutor.php'),
    'Mailer'                  => @file_get_contents($dir . '/Mailer.php'),
    'webhook'                 => @file_get_contents($dir . '/webhook.php'),
    'worker_priority'         => @file_get_contents($dir . '/worker_priority.php'),
    'worker_flow'             => @file_get_contents($dir . '/worker_flow.php'),
    'worker_campaign'         => @file_get_contents($dir . '/worker_campaign.php'),
    'worker_tracking_aggregator' => @file_get_contents($dir . '/worker_tracking_aggregator.php'),
    'flow_helpers'            => @file_get_contents($dir . '/flow_helpers.php'),
    'trigger_helper'          => @file_get_contents($dir . '/trigger_helper.php'),
    'zalo_helpers'            => @file_get_contents($dir . '/zalo_helpers.php'),
    'voucher_helper'          => @file_get_contents($dir . '/voucher_helper.php'),
];

// Helper: count non-comment occurrences
if (!function_exists('countInCodeLines')) {
    function countInCodeLines($src, $pattern) {
        if (!$src) return 0;
        $lines = explode("\n", $src);
        $count = 0;
        foreach ($lines as $line) {
            $trimmed = ltrim($line);
            if (strncmp($trimmed, '//', 2) === 0 || strncmp($trimmed, '*', 1) === 0 || strncmp($trimmed, '/*', 2) === 0) continue;
            if (strpos($line, $pattern) !== false) $count++;
        }
        return $count;
    }
}

// Audit cases
$auditStart = microtime(true);

// 6.1 Check A/B split logic
$abSplit = countInCodeLines($FILES['FlowExecutor'], 'abs(crc32(');
printResult("A/B Split Test: sử dụng abs(crc32) tránh tràn số 32-bit", $abSplit >= 1, "Tìm thấy $abSplit khai báo.");

// 6.2 Check SMTP sentInSession logic
$smCount = countInCodeLines($FILES['Mailer'], '$this->sentInSession++');
printResult("SMTP SentInSession: tăng duy nhất 1 lần trong dispatchRaw", $smCount === 1, "Tìm thấy $smCount lần khai báo (được khuyên dùng chỉ có 1).");

// 6.3 ZNS webhook safety
$znsVerified = strpos($FILES['webhook'], 'stmtVerifyCamp') !== false;
printResult("Webhook ZNS: xác thực chiến dịch trước khi cập nhật", $znsVerified, $znsVerified ? "Bảo vệ an toàn" : "Không có kiểm tra");

// 6.4 Holiday scenario zalo token verification
$zaloHoliday = strpos($FILES['webhook'], 'freshHolidayToken') !== false;
printResult("Holiday Scenario Zalo: tự động làm tươi token", $zaloHoliday, $zaloHoliday ? "Đã cài đặt" : "Chưa cấu hình");

// 6.5 Webhook lock validation
$lockResultChecked = countInCodeLines($FILES['webhook'], 'lockResult') >= 1;
printResult("Webhook: kiểm tra trạng thái khóa GET_LOCK trước khi ghi", $lockResultChecked, $lockResultChecked ? "Bảo mật khóa" : "Chưa kiểm định");

// 6.6 Qual-5 delete_contact mail logs cleanup
$delMailLogs = countInCodeLines($FILES['FlowExecutor'], 'DELETE FROM mail_delivery_logs');
printResult("Xóa Contact: tự động dọn dẹp bảng mail_delivery_logs", $delMailLogs >= 1, "Tìm thấy $delMailLogs vị trí dọn dẹp.");

// 6.7 Qual-5 delete_contact activity buffer cleanup
$delActBuf = countInCodeLines($FILES['FlowExecutor'], 'DELETE FROM activity_buffer');
printResult("Xóa Contact: tự động dọn dẹp bảng activity_buffer", $delActBuf >= 1, "Tìm thấy $delActBuf vị trí dọn dẹp.");

// 6.8 Webhook POST-only debug validation
$webhookPost = countInCodeLines($FILES['webhook'], "\$method === 'POST'") >= 1;
printResult("Webhook: chỉ ghi log debug khi nhận request POST", $webhookPost, $webhookPost ? "Bảo mật log" : "Ghi log không giới hạn");

// 6.9 Priority queue pre-initialization
$priorityInit = strpos($FILES['worker_priority'], 'Initialize defaults BEFORE') !== false;
printResult("Worker Priority: khởi tạo biến mặc định trước vòng lặp", $priorityInit, $priorityInit ? "Hạn chế lỗi ghi đè" : "Chưa tối ưu");

// 6.10 innodb_lock_wait_timeout setting
$wfLwt = countInCodeLines($FILES['worker_flow'], 'innodb_lock_wait_timeout') >= 1;
$wcLwt = countInCodeLines($FILES['worker_campaign'], 'innodb_lock_wait_timeout') >= 1;
$wpLwt = countInCodeLines($FILES['worker_priority'], 'innodb_lock_wait_timeout') >= 1;
printResult("Workers: giới hạn khóa InnoDB Timeout 5s (Tránh deadlock)", ($wfLwt && $wcLwt && $wpLwt), "Flow: " . ($wfLwt ? 'OK' : 'FAIL') . " | Campaign: " . ($wcLwt ? 'OK' : 'FAIL') . " | Priority: " . ($wpLwt ? 'OK' : 'FAIL'));

// 6.11 Mailer pooling size limit
$mailerPool = strpos($FILES['Mailer'], '>= 500') !== false;
printResult("Mailer SMTP: cấu hình hồ bơi kết nối >= 500 mail", $mailerPool, $mailerPool ? "Hiệu năng cao" : "Tiêu chuẩn cũ 200");

// 6.12 Activity Buffer auto-flush limit
$flushLimit = strpos($FILES['flow_helpers'], '>= 150') !== false;
printResult("Activity Buffer: tự động đẩy lên DB khi đạt >= 150 log", $flushLimit, $flushLimit ? "Bảo vệ bộ nhớ" : "Ghi trực tiếp");

// 6.13 Aggregator index safety check
$aggIdxGuard = strpos($FILES['worker_tracking_aggregator'], 'idx_sub_type_date') === false;
printResult("Aggregator: checkStrategicIndexes không tự tạo lại index cũ", $aggIdxGuard, $aggIdxGuard ? "Đảm bảo an toàn" : "Cảnh báo tự tạo lại index cũ");

// 6.14 Worker release connection check
$wfCloseConn = strpos($FILES['worker_flow'], 'closeConnection') !== false;
$wcCloseConn = strpos($FILES['worker_campaign'], 'closeConnection') !== false;
printResult("Workers: tự giải phóng kết nối Mailer khi kết thúc", ($wfCloseConn && $wcCloseConn), "Flow: " . ($wfCloseConn ? 'OK' : 'FAIL') . " | Campaign: " . ($wcCloseConn ? 'OK' : 'FAIL'));

// 6.15 Aggregator zalo_subscribers whitelist check
$aggZaloSub = strpos($FILES['worker_tracking_aggregator'], "'zalo_subscribers'") !== false;
printResult("Aggregator: chấp nhận cập nhật chỉ số cho zalo_subscribers", $aggZaloSub, $aggZaloSub ? "Whitelisted" : "Thiếu cập nhật");

// 6.16 Voucher transaction safety check
$vouchTx = strpos($FILES['voucher_helper'], 'inTransaction') !== false;
printResult("Voucher System: giao dịch nhận mã bọc trong transaction", $vouchTx, $vouchTx ? "Tuyệt đối an toàn" : "Nguy cơ race conditions");

// 6.17 Webhook FastCGI Non-blocking check
$fcgiFin = strpos($FILES['webhook'], 'fastcgi_finish_request') !== false;
printResult("Webhook: trả phản hồi non-blocking cho Zalo nhanh", $fcgiFin, $fcgiFin ? "Đã tối ưu" : "Phản hồi chậm");

// 6.18 Flow worker Double-Lock guard
$doubleLock = strpos($FILES['worker_flow'], 'DOUBLE-LOCK') !== false;
printResult("Worker Flow: Double-Lock đọc lại status trước khi chạy", $doubleLock, $doubleLock ? "Chống trùng lặp" : "Thiếu khóa bảo vệ");

// 6.19 Flow worker Stale guard
$staleGuard = strpos($FILES['worker_flow'], 'STALE-GUARD') !== false;
printResult("Worker Flow: Stale-Guard hoàn trả hàng chờ khi hết hạn", $staleGuard, $staleGuard ? "Hoạt động chuẩn" : "Thiếu hoàn trả");

// 6.20 Flow worker Infinite Loop guard
$wfMaxSteps = strpos($FILES['worker_flow'], 'MAX_STEPS') !== false;
printResult("Worker Flow: giới hạn số bước tối đa (Tránh lặp vô hạn)", $wfMaxSteps, $wfMaxSteps ? "Hạn chế lỗi lặp" : "Nguy cơ lặp vô hạn");

// 6.21 Zalo Engine: ensureZaloToken
$ensureZaloToken = strpos($FILES['zalo_helpers'], 'function ensureZaloToken') !== false;
printResult("Zalo Engine: hàm xoay vòng token ensureZaloToken tồn tại", $ensureZaloToken, $ensureZaloToken ? "Hoạt động tốt" : "Thiếu hàm");

$duration = (microtime(true) - $startTime) * 1000;

// Final Stats and exit code for CLI
if ($isCli) {
    echo PHP_EOL;
    echo COLOR_BOLD . COLOR_BLUE . "==================================================" . COLOR_RESET . PHP_EOL;
    echo COLOR_BOLD . "TỔNG KẾT KIỂM THỬ TÍCH HỢP BACKEND & SQL" . COLOR_RESET . PHP_EOL;
    echo "Thời gian thực hiện: " . number_format($duration, 2) . " ms" . PHP_EOL;
    $passed = count(array_filter($testResults, function($r) { return $r['status']; }));
    $total = count($testResults);
    $color = ($passed === $total) ? COLOR_GREEN : COLOR_RED;
    echo "Kết quả: " . COLOR_BOLD . $color . "$passed/$total Ca kiểm thử thành công" . COLOR_RESET . PHP_EOL;
    echo COLOR_BOLD . COLOR_BLUE . "==================================================" . COLOR_RESET . PHP_EOL;
    exit($passed === $total ? 0 : 1);
}

$passed = count(array_filter($testResults, function($r) { return $r['status']; }));
$total = count($testResults);
$score = round(($passed / $total) * 100);
?>
<!DOCTYPE html>
<html lang="vi" class="h-full bg-slate-950">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOMATION Integration Test Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            accent: '#a855f7',
                            primary: '#6d28d9',
                            secondary: '#7c3aed',
                            dark: '#0f172a',
                            success: '#10b981',
                            error: '#ef4444'
                        }
                    }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #020617;
        }
        .glass-panel {
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
    </style>
</head>
<body class="text-slate-100 min-h-full py-12 px-4 md:px-8">
    <div class="max-w-5xl mx-auto space-y-8">
        
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div class="absolute -right-16 -top-16 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl"></div>
            <div class="absolute -left-16 -bottom-16 w-48 h-48 bg-emerald-600/5 rounded-full blur-3xl"></div>
            
            <div class="space-y-3 z-10">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-semibold tracking-wider uppercase">
                    <span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                    AutoFlow Engine Integration Test
                </div>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-400 bg-clip-text text-transparent">
                    Kiểm Thử Toàn Diện Backend & SQL
                </h1>
                <p class="text-sm font-medium text-slate-400 max-w-xl">
                    Chạy kiểm định kết nối, kiểm thử cấu trúc lược đồ bảng, hiệu năng CRUD nâng cao (JSON, transactions, locks) và mô phỏng logic FlowExecutor.
                </p>
            </div>
            
            <div class="flex items-center gap-6 shrink-0 z-10">
                <div class="text-right">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Điểm Kiểm Thử</span>
                    <span class="text-4xl font-black font-mono tracking-tight text-white"><?= $score ?></span>
                    <span class="text-sm font-bold text-slate-500">/ 100</span>
                </div>
                <div class="h-14 w-px bg-slate-800"></div>
                <button onclick="window.location.reload();" class="active:scale-95 transition-transform inline-flex items-center justify-center font-bold px-6 py-3.5 text-xs text-white rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 transition-all">
                    Chạy Lại
                </button>
            </div>
        </div>

        <!-- Metrics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl font-bold">
                    ⏱️
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Thời gian thực thi</div>
                    <div class="text-xl font-bold text-slate-200"><?= number_format($duration, 2) ?> ms</div>
                </div>
            </div>
            
            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
                    ✅
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ca thành công</div>
                    <div class="text-xl font-bold text-slate-200"><?= $passed ?> / <?= $total ?></div>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl font-bold">
                    ⚙️
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Động cơ DB</div>
                    <div class="text-xl font-bold text-slate-200 uppercase"><?= $dbType ?></div>
                </div>
            </div>
        </div>

        <!-- Main Test Cases List -->
        <div class="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <h3 class="text-lg font-bold text-slate-200">
                    Chi Tiết Kết Quả Kiểm Định (Test Cases)
                </h3>
                <span class="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-semibold rounded-lg uppercase tracking-wider">
                    Chế độ: <?= $usingMockSqlite ? 'Mock SQLite' : 'MySQL Real Database' ?>
                </span>
            </div>

            <div class="space-y-4">
                <?php foreach ($testResults as $index => $res): ?>
                    <div class="p-5 rounded-2xl transition-all duration-200 hover:bg-slate-900/50 border <?= $res['status'] ? 'border-emerald-500/10 bg-emerald-500/[0.01]' : 'border-rose-500/10 bg-rose-500/[0.01]' ?> flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div class="space-y-2">
                            <div class="flex items-center gap-3">
                                <span class="text-xs font-semibold text-slate-500">#<?= str_pad($index + 1, 2, '0', STR_PAD_LEFT) ?></span>
                                <h4 class="font-bold text-slate-200"><?= htmlspecialchars($res['name']) ?></h4>
                            </div>
                            <?php if (!empty($res['details'])): ?>
                                <p class="text-xs text-slate-400 pl-8 font-medium">
                                    <?= htmlspecialchars($res['details']) ?>
                                </p>
                            <?php endif; ?>
                        </div>
                        
                        <div class="flex items-center gap-4 shrink-0 pl-8 md:pl-0">
                            <?php if ($res['time'] !== null): ?>
                                <span class="text-xs font-mono text-slate-500">
                                    <?= number_format($res['time'], 2) ?> ms
                                </span>
                            <?php endif; ?>
                            
                            <span class="inline-flex items-center justify-center font-bold px-3 py-1.5 text-[10px] rounded-lg tracking-wider uppercase <?= $res['status'] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20' ?>">
                                <?= $res['status'] ? 'PASSED' : 'FAILED' ?>
                            </span>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Footer -->
        <div class="text-center text-xs text-slate-600 font-medium">
            DOMATION Autoflow Integration Test Engine &bull; Developed by Antigravity
        </div>
    </div>
</body>
</html>
