<?php
// api/audit_system.php - SYSTEM SECURITY, CONCURRENCY & BOTTLENECK AUDITOR
// Securely audits the backend system for performance issues, locks, indexing, and vulnerabilities.

error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', 1);

require_once 'db_connect.php';
require_once 'ai_org_middleware.php';

// --- SECURITY & AUTHORIZATION CHECK ---
$isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1', 'localhost']) 
    || (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'localhost') !== false);

if (php_sapi_name() !== 'cli' && !$isLocal) {
    // Enforce admin login check
    $isAdmin = false;
    if (!empty($GLOBALS['current_admin_id']) && $GLOBALS['current_admin_id'] === 'admin-001') {
        $isAdmin = true;
    }
    
    // Support bypass token check
    $token = $_GET['token'] ?? '';
    if ($token === ADMIN_BYPASS_TOKEN) {
        $isAdmin = true;
    }

    if (!$isAdmin) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Truy cập bị từ chối. Vui lòng đăng nhập quyền Admin Master.'
        ]);
        exit;
    }
}

// Clear output buffers to output our custom HTML structure
while (ob_get_level() > 0) {
    ob_end_clean();
}

// --- HELPER FUNCTION: Static Scan of PHP Source Code ---
function runStaticAnalysis($apiDir) {
    $results = [
        'nPlusOne' => [],
        'unboundFetch' => [],
        'unsafeSql' => [],
        'missingSessionClose' => []
    ];

    if (!is_dir($apiDir)) return $results;

    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($apiDir));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $filePath = $file->getRealPath();
            $basename = basename($filePath);
            
            // Skip PHPMailer or debugging logs/archives
            if (strpos($filePath, 'PHPMailer') !== false || 
                strpos($filePath, '_debug') !== false || 
                strpos($filePath, '_dev_archive') !== false ||
                strpos($filePath, 'audit_system.php') !== false) {
                continue;
            }

            $content = file_get_contents($filePath);

            // 1. N+1 Loops Check (Query inside loops)
            // Pattern: loop construct followed by database execution within curly braces
            if (preg_match('/(?:foreach|while|for)\s*\(.*?\)\s*\{[^}]*->(?:query|prepare|execute|fetch|fetchAll)\(/s', $content)) {
                $results['nPlusOne'][] = [
                    'file' => $basename,
                    'path' => $filePath,
                    'reason' => 'Phát hiện câu lệnh truy cập DB (query/prepare/execute) nằm trực tiếp bên trong vòng lặp foreach/while/for.'
                ];
            }

            // 2. Unbound fetchAll() Check (Fetching large tables without LIMIT)
            if (strpos($content, 'fetchAll(') !== false) {
                // If it queries subquery or contains subscribers/subscriber_activity but lacks LIMIT keyword
                if (preg_match('/FROM\s+(subscribers|subscriber_activity|queue_jobs|zalo_subscriber_activity)/i', $content) && 
                    !preg_match('/LIMIT\s+/i', $content) && !preg_match('/\$limit/i', $content)) {
                    $results['unboundFetch'][] = [
                        'file' => $basename,
                        'path' => $filePath,
                        'reason' => 'Sử dụng fetchAll() trên các bảng dữ liệu lớn (subscribers, activity, queue) mà không phát hiện mệnh đề LIMIT.'
                    ];
                }
            }

            // 3. Unsafe SQL Concatenation / Variable Interpolation
            // Pattern: direct variable interpolation "$var" inside query() or prepare()
            if (preg_match('/->(?:query|prepare)\s*\(\s*["\'].*?\$[a-zA-Z_].*?["\']\s*\)/s', $content)) {
                // Verify if it is not false positive (e.g. only placeholders or safe system table names)
                // Filter out simple parameter binds like "?" or ":id"
                if (!preg_match('/->(?:query|prepare)\s*\(\s*["\'][^"\']*\?[^"\']*["\']\s*\)/s', $content)) {
                    $results['unsafeSql'][] = [
                        'file' => $basename,
                        'path' => $filePath,
                        'reason' => 'Nhúng trực tiếp biến PHP ($...) vào trong chuỗi truy vấn ->query() hoặc ->prepare() thay vì dùng Prepared Statement Bindings.'
                    ];
                }
            }

            // 4. Missing Session Close on high traffic / read-only requests
            // If session_start is called, but session_write_close is not called, and it's a GET or tracking file
            if (strpos($content, 'session_start(') !== false && 
                strpos($content, 'session_write_close(') === false && 
                (strpos($basename, 'track') !== false || strpos($basename, 'webhook') !== false)) {
                $results['missingSessionClose'][] = [
                    'file' => $basename,
                    'path' => $filePath,
                    'reason' => 'File chứa session_start() nhưng không gọi session_write_close() giải phóng Session Lock trên endpoint lưu lượng cao.'
                ];
            }
        }
    }

    return $results;
}

// Run scans
$staticFindings = runStaticAnalysis(__DIR__);

// --- SYSTEM ENV DIAGNOSTICS ---
$envData = [
    'php_version' => PHP_VERSION,
    'sapi' => php_sapi_name(),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'post_max_size' => ini_get('post_max_size'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'disk_free' => disk_free_space(__DIR__),
    'disk_total' => disk_total_space(__DIR__),
];
$diskUsagePercent = round((1 - ($envData['disk_free'] / $envData['disk_total'])) * 100, 2);

// --- DATABASE DIAGNOSTICS & INDEX OVERLAP AUDIT ---
$dbStatus = 'OK';
$dbMessage = 'Kết nối cơ sở dữ liệu thành công.';
$tablesInfo = [];
$redundantIndexes = [];
$skipLockedSupported = false;

try {
    $skipLockedSupported = isDatabaseSkipLockedSupported($pdo);

    // Get all tables size and engine
    $stmtTables = $pdo->query("
        SELECT 
            TABLE_NAME, 
            ENGINE, 
            TABLE_ROWS, 
            DATA_LENGTH + INDEX_LENGTH as total_size,
            DATA_LENGTH,
            INDEX_LENGTH
        FROM 
            information_schema.TABLES 
        WHERE 
            TABLE_SCHEMA = DATABASE()
    ");
    $tablesInfo = $stmtTables->fetchAll();

    // Redundant Index Audit
    $stmtIdx = $pdo->query("
        SELECT 
            TABLE_NAME, 
            INDEX_NAME, 
            NON_UNIQUE, 
            SEQ_IN_INDEX, 
            COLUMN_NAME 
        FROM 
            INFORMATION_SCHEMA.STATISTICS 
        WHERE 
            TABLE_SCHEMA = DATABASE() 
        ORDER BY 
            TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    ");
    
    $indexes = [];
    while ($row = $stmtIdx->fetch()) {
        $t = $row['TABLE_NAME'];
        $idx = $row['INDEX_NAME'];
        if ($idx === 'PRIMARY') continue;
        if (!isset($indexes[$t])) $indexes[$t] = [];
        if (!isset($indexes[$t][$idx])) {
            $indexes[$t][$idx] = [
                'non_unique' => $row['NON_UNIQUE'],
                'columns' => []
            ];
        }
        $indexes[$t][$idx]['columns'][] = $row['COLUMN_NAME'];
    }

    foreach ($indexes as $table => $tableIndexes) {
        foreach ($tableIndexes as $idxName1 => $idxInfo1) {
            $cols1 = $idxInfo1['columns'];
            foreach ($tableIndexes as $idxName2 => $idxInfo2) {
                if ($idxName1 === $idxName2) continue;
                $cols2 = $idxInfo2['columns'];
                
                // Compare if cols1 is a prefix of cols2
                $isPrefix = true;
                if (count($cols1) > count($cols2)) {
                    $isPrefix = false;
                } else {
                    for ($i = 0; $i < count($cols1); $i++) {
                        if ($cols1[$i] !== $cols2[$i]) {
                            $isPrefix = false;
                            break;
                        }
                    }
                }
                
                if ($isPrefix) {
                    // Non-unique index 1 is redundant if fully covered by index 2
                    if ($idxInfo1['non_unique'] == 1) {
                        $redundantIndexes[$table][] = [
                            'redundant_index' => $idxName1,
                            'redundant_cols' => implode(', ', $cols1),
                            'covered_by' => $idxName2,
                            'covered_cols' => implode(', ', $cols2)
                        ];
                    }
                }
            }
        }
    }

} catch (Exception $e) {
    $dbStatus = 'ERROR';
    $dbMessage = 'Lỗi truy cập DB: ' . $e->getMessage();
}

// --- QUEUE JOBS PULSE ---
$queueStats = [];
try {
    $stmtQ = $pdo->query("SELECT status, COUNT(*) as count FROM queue_jobs GROUP BY status");
    $queueStats = $stmtQ->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) {}

// --- LOG FILES PULSE ---
$logFiles = [
    'worker_error.log' => __DIR__ . '/worker_error.log',
    'webhook_error.log' => __DIR__ . '/webhook_error.log',
    'worker_debug.log' => __DIR__ . '/worker_debug.log',
    'webhook_debug.log' => __DIR__ . '/webhook_debug.log',
    'zalo_debug.log' => __DIR__ . '/zalo_debug.log',
];
$logStates = [];
foreach ($logFiles as $name => $path) {
    if (file_exists($path)) {
        $size = filesize($path);
        // Read last 15 lines of error logs
        $lastLines = '';
        if ($size > 0 && strpos($name, 'error') !== false) {
            $fp = fopen($path, 'r');
            $lines = [];
            while (($line = fgets($fp)) !== false) {
                $lines[] = $line;
                if (count($lines) > 15) array_shift($lines);
            }
            fclose($fp);
            $lastLines = implode('', $lines);
        }
        $logStates[$name] = [
            'exists' => true,
            'size' => $size,
            'mtime' => filemtime($path),
            'last_lines' => $lastLines
        ];
    } else {
        $logStates[$name] = ['exists' => false];
    }
}

// HTML OUTPUT WITH PREMIUM DESIGN SYSTEM
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Omni-Engine Deep Audit Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #f97316;
            --primary-hover: #ea580c;
            --primary-light: #ffedd5;
            --background: #0b0f19;
            --surface: #111827;
            --surface-card: #1f2937;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --border: #374151;
            --success: #10b981;
            --error: #ef4444;
            --warning: #f59e0b;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--background);
            color: var(--text-main);
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            padding-bottom: 24px;
            margin-bottom: 40px;
        }

        h1 {
            font-size: 28px;
            font-weight: 800;
            margin: 0;
            background: linear-gradient(135deg, #fff 0%, #9ca3af 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .badge-audit {
            background-color: var(--primary-light);
            color: var(--primary);
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 700;
            border: 1px solid var(--primary);
        }

        .grid-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
            transition: transform 0.2s, border-color 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            border-color: var(--primary);
        }

        .stat-card h3 {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-muted);
            margin-top: 0;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .stat-card .value {
            font-size: 24px;
            font-weight: 800;
            margin: 0;
        }

        .stat-card .desc {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 8px;
            margin-bottom: 0;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            margin-bottom: 30px;
            gap: 12px;
        }

        .tab-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .tab-btn:hover {
            color: var(--text-main);
        }

        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .card-main {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            margin-bottom: 30px;
        }

        .card-main h2 {
            font-size: 20px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        th, td {
            text-align: left;
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
        }

        th {
            font-weight: 600;
            color: var(--text-muted);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        td {
            font-size: 15px;
        }

        tr:hover td {
            background-color: rgba(255, 255, 255, 0.02);
        }

        .alert {
            display: flex;
            gap: 16px;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
            border: 1px solid transparent;
        }

        .alert-error {
            background-color: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }

        .alert-warning {
            background-color: rgba(245, 158, 11, 0.1);
            border-color: rgba(245, 158, 11, 0.3);
            color: #fde047;
        }

        .alert-success {
            background-color: rgba(16, 185, 129, 0.1);
            border-color: rgba(16, 185, 129, 0.3);
            color: #a7f3d0;
        }

        .alert-title {
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 4px;
        }

        .alert-desc {
            margin: 0;
            font-size: 14px;
        }

        .finding-item {
            border-bottom: 1px solid var(--border);
            padding: 20px 0;
        }

        .finding-item:last-child {
            border-bottom: none;
        }

        .finding-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .file-name {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            color: var(--primary);
            font-size: 16px;
        }

        .badge-tag {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 4px 10px;
            border-radius: 6px;
            letter-spacing: 0.05em;
        }

        .badge-error {
            background-color: rgba(239, 68, 68, 0.2);
            color: var(--error);
            border: 1px solid rgba(239, 68, 68, 0.4);
        }

        .badge-warn {
            background-color: rgba(245, 158, 11, 0.2);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .finding-desc {
            color: var(--text-muted);
            font-size: 14px;
            margin-bottom: 10px;
        }

        .finding-path {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #6b7280;
        }

        pre {
            background-color: #030712;
            border: 1px solid var(--border);
            padding: 16px;
            border-radius: 12px;
            overflow-x: auto;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
            color: #d1d5db;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background-color: var(--border);
            border-radius: 9999px;
            overflow: hidden;
            margin-top: 10px;
        }

        .progress-fill {
            height: 100%;
            background-color: var(--primary);
            border-radius: 9999px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Omni-Engine Deep Audit Report</h1>
                <p style="margin: 6px 0 0 0; color: var(--text-muted); font-size: 14px;">Báo cáo phân tích sâu bảo mật, xung đột khóa & nghẽn cổ chai</p>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <span class="badge-audit">V1.0 Stable</span>
                <?php if ($isLocal): ?>
                    <span class="badge-tag" style="background: rgba(16,185,129,0.2); color: var(--success); border: 1px solid var(--success)">Local Server</span>
                <?php endif; ?>
            </div>
        </header>

        <!-- GRID METRICS -->
        <div class="grid-stats">
            <div class="stat-card">
                <h3>Kết nối CSDL</h3>
                <p class="value" style="color: <?php echo $dbStatus === 'OK' ? 'var(--success)' : 'var(--error)'; ?>">
                    <?php echo $dbStatus; ?>
                </p>
                <p class="desc"><?php echo htmlspecialchars($dbMessage); ?></p>
            </div>
            <div class="stat-card">
                <h3>Tính Năng SKIP LOCKED</h3>
                <p class="value" style="color: <?php echo $skipLockedSupported ? 'var(--success)' : 'var(--warning)'; ?>">
                    <?php echo $skipLockedSupported ? 'Được Hỗ Trợ' : 'Không Hỗ Trợ'; ?>
                </p>
                <p class="desc"><?php echo $skipLockedSupported ? 'MySQL 8.0+ / MariaDB 10.6+ được kích hoạt' : 'Hệ thống dùng FOR UPDATE cơ bản'; ?></p>
            </div>
            <div class="stat-card">
                <h3>Bộ Nhớ Cực Đại</h3>
                <p class="value"><?php echo $envData['memory_limit']; ?></p>
                <p class="desc">Execution Time: <?php echo $envData['max_execution_time']; ?>s</p>
            </div>
            <div class="stat-card">
                <h3>Dung lượng đĩa cứng</h3>
                <p class="value"><?php echo round($envData['disk_free'] / 1024 / 1024 / 1024, 2); ?> GB</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: <?php echo $diskUsagePercent; ?>%; background-color: <?php echo $diskUsagePercent > 90 ? 'var(--error)' : 'var(--primary)'; ?>"></div>
                </div>
                <p class="desc">Đã sử dụng: <?php echo $diskUsagePercent; ?>%</p>
            </div>
        </div>

        <!-- TABS BAR -->
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('tab-static')">Phân tích Tĩnh (Static Code)</button>
            <button class="tab-btn" onclick="switchTab('tab-db')">Cơ sở dữ liệu & Indexes</button>
            <button class="tab-btn" onclick="switchTab('tab-logs')">Quản lý Logs Lỗi</button>
            <button class="tab-btn" onclick="switchTab('tab-queue')">Trạng thái Queue</button>
        </div>

        <!-- TAB CONTENT: STATIC ANALYSIS -->
        <div id="tab-static" class="tab-content active">
            <div class="card-main">
                <h2>🔍 Kết quả phân tích tĩnh mã nguồn PHP</h2>
                <p style="color: var(--text-muted); margin-bottom: 24px;">Phân tích toàn bộ các file tại `/api` để tìm lỗ hổng bảo mật, lỗi N+1 queries, unbuffered loads và các điểm session locking.</p>

                <!-- 1. UNBOUND FETCHES -->
                <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 30px;">
                    ⚠️ Unbound fetchAll() Check (Cực kỳ nguy hiểm cho RAM)
                </h3>
                <?php if (empty($staticFindings['unboundFetch'])): ?>
                    <div class="alert alert-success">
                        <p class="alert-title">Tuyệt vời!</p>
                        <p class="alert-desc">Không phát hiện câu lệnh fetchAll() tải dữ liệu lớn không giới hạn.</p>
                    </div>
                <?php else: ?>
                    <div class="alert alert-error">
                        <p class="alert-title">Cảnh báo!</p>
                        <p class="alert-desc">Phát hiện <?php echo count($staticFindings['unboundFetch']); ?> tệp tin gọi fetchAll() từ các bảng quy mô lớn mà không có LIMIT. Có khả năng gây lỗi Out of Memory.</p>
                    </div>
                    <?php foreach ($staticFindings['unboundFetch'] as $item): ?>
                        <div class="finding-item">
                            <div class="finding-header">
                                <span class="file-name"><?php echo $item['file']; ?></span>
                                <span class="badge-tag badge-error">OOM Risk</span>
                            </div>
                            <p class="finding-desc"><?php echo $item['reason']; ?></p>
                            <p class="finding-path"><?php echo $item['path']; ?></p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>

                <!-- 2. N+1 QUERIES -->
                <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 40px;">
                    ⚡ Truy vấn cơ sở dữ liệu trong vòng lặp (N+1 queries)
                </h3>
                <?php if (empty($staticFindings['nPlusOne'])): ?>
                    <div class="alert alert-success">
                        <p class="alert-title">Tuyệt vời!</p>
                        <p class="alert-desc">Không tìm thấy truy vấn CSDL nào nằm trực tiếp bên trong vòng lặp.</p>
                    </div>
                <?php else: ?>
                    <div class="alert alert-warning">
                        <p class="alert-title">Phát hiện lỗi hiệu năng!</p>
                        <p class="alert-desc">Tìm thấy <?php echo count($staticFindings['nPlusOne']); ?> tệp tin có truy vấn CSDL trong vòng lặp. Điều này gây tốn CPU và mạng khi kích thước mảng tăng cao.</p>
                    </div>
                    <?php foreach ($staticFindings['nPlusOne'] as $item): ?>
                        <div class="finding-item">
                            <div class="finding-header">
                                <span class="file-name"><?php echo $item['file']; ?></span>
                                <span class="badge-tag badge-warn">N+1 Query</span>
                            </div>
                            <p class="finding-desc"><?php echo $item['reason']; ?></p>
                            <p class="finding-path"><?php echo $item['path']; ?></p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>

                <!-- 3. UNSAFE SQL -->
                <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 40px;">
                    🛡️ Lỗ hổng nhúng biến trực tiếp vào chuỗi SQL (SQL Injection Risk)
                </h3>
                <?php if (empty($staticFindings['unsafeSql'])): ?>
                    <div class="alert alert-success">
                        <p class="alert-title">An toàn!</p>
                        <p class="alert-desc">Không phát hiện việc nội suy biến PHP trực tiếp vào câu lệnh CSDL.</p>
                    </div>
                <?php else: ?>
                    <div class="alert alert-error">
                        <p class="alert-title">Nguy cơ bảo mật cao!</p>
                        <p class="alert-desc">Phát hiện <?php echo count($staticFindings['unsafeSql']); ?> tệp tin thực hiện nội suy biến PHP thay vì dùng Prepared Statement Bindings.</p>
                    </div>
                    <?php foreach ($staticFindings['unsafeSql'] as $item): ?>
                        <div class="finding-item">
                            <div class="finding-header">
                                <span class="file-name"><?php echo $item['file']; ?></span>
                                <span class="badge-tag badge-error">SQL Injection</span>
                            </div>
                            <p class="finding-desc"><?php echo $item['reason']; ?></p>
                            <p class="finding-path"><?php echo $item['path']; ?></p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>

                <!-- 4. MISSING SESSION CLOSE -->
                <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 40px;">
                    ⏳ Session Lock Blocking (Nghẽn AJAX đồng thời)
                </h3>
                <?php if (empty($staticFindings['missingSessionClose'])): ?>
                    <div class="alert alert-success">
                        <p class="alert-title">Tối ưu!</p>
                        <p class="alert-desc">Toàn bộ các endpoint lưu lượng cao đều xử lý session đóng sớm chuẩn xác.</p>
                    </div>
                <?php else: ?>
                    <div class="alert alert-warning">
                        <p class="alert-title">Có thể gây nghẽn kết nối AJAX!</p>
                        <p class="alert-desc">Phát hiện <?php echo count($staticFindings['missingSessionClose']); ?> file chạy tác vụ nhiều hoặc tracking pixel giữ session mở lâu không đóng.</p>
                    </div>
                    <?php foreach ($staticFindings['missingSessionClose'] as $item): ?>
                        <div class="finding-item">
                            <div class="finding-header">
                                <span class="file-name"><?php echo $item['file']; ?></span>
                                <span class="badge-tag badge-warn">Session Lock</span>
                            </div>
                            <p class="finding-desc"><?php echo $item['reason']; ?></p>
                            <p class="finding-path"><?php echo $item['path']; ?></p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <!-- TAB CONTENT: DB INDEXES -->
        <div id="tab-db" class="tab-content">
            <div class="card-main">
                <h2>🗄️ Đánh giá Cơ sở dữ liệu & Chỉ mục (Indexes)</h2>
                
                <!-- REDUNDANT INDEX ALERT -->
                <?php if (empty($redundantIndexes)): ?>
                    <div class="alert alert-success">
                        <p class="alert-title">Chỉ mục tối ưu!</p>
                        <p class="alert-desc">Không phát hiện chỉ mục (Index) trùng lặp hoặc chồng chéo nào trong cơ sở dữ liệu.</p>
                    </div>
                <?php else: ?>
                    <div class="alert alert-warning">
                        <p class="alert-title">Phát hiện Index trùng lặp / chồng chéo!</p>
                        <p class="alert-desc">MySQL phải ghi và cập nhật chỉ mục trùng lặp vô ích trên mỗi câu lệnh INSERT/UPDATE, làm giảm hiệu năng ghi bản ghi nặng.</p>
                    </div>

                    <h3 style="margin-top: 30px;">Danh sách các Index trùng lặp cần xóa:</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Tên Bảng</th>
                                <th>Chỉ mục trùng lặp</th>
                                <th>Cột chỉ mục</th>
                                <th>Được bao phủ bởi Index</th>
                                <th>Hành động gợi ý</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($redundantIndexes as $table => $list): ?>
                                <?php foreach ($list as $info): ?>
                                    <tr>
                                        <td><strong><?php echo htmlspecialchars($table); ?></strong></td>
                                        <td style="color: var(--error); font-family: 'JetBrains Mono', monospace;"><?php echo htmlspecialchars($info['redundant_index']); ?></td>
                                        <td style="font-family: 'JetBrains Mono', monospace;"><?php echo htmlspecialchars($info['redundant_cols']); ?></td>
                                        <td style="color: var(--success); font-family: 'JetBrains Mono', monospace;"><?php echo htmlspecialchars($info['covered_by']); ?></td>
                                        <td>
                                            <code>ALTER TABLE `<?php echo htmlspecialchars($table); ?>` DROP INDEX `<?php echo htmlspecialchars($info['redundant_index']); ?>`;</code>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>

                <h3 style="margin-top: 40px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    Chi tiết dung lượng bảng vật lý (Database Tables size)
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th>Tên Bảng</th>
                            <th>Storage Engine</th>
                            <th>Số dòng dữ liệu</th>
                            <th>Kích thước dữ liệu</th>
                            <th>Kích thước Indexes</th>
                            <th>Tổng kích thước</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($tablesInfo as $tbl): ?>
                            <tr>
                                <td><strong><?php echo htmlspecialchars($tbl['TABLE_NAME']); ?></strong></td>
                                <td><?php echo htmlspecialchars($tbl['ENGINE']); ?></td>
                                <td style="font-family: 'JetBrains Mono', monospace;"><?php echo number_format($tbl['TABLE_ROWS']); ?></td>
                                <td style="font-family: 'JetBrains Mono', monospace;"><?php echo round($tbl['DATA_LENGTH'] / 1024 / 1024, 2); ?> MB</td>
                                <td style="font-family: 'JetBrains Mono', monospace;"><?php echo round($tbl['INDEX_LENGTH'] / 1024 / 1024, 2); ?> MB</td>
                                <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--primary);">
                                    <?php echo round($tbl['total_size'] / 1024 / 1024, 2); ?> MB
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TAB CONTENT: ERROR LOGS -->
        <div id="tab-logs" class="tab-content">
            <div class="card-main">
                <h2>📋 Nhật ký ghi nhận lỗi của hệ thống (Logs)</h2>
                
                <?php foreach ($logStates as $name => $state): ?>
                    <div style="margin-bottom: 32px; border-bottom: 1px solid var(--border); padding-bottom: 24px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="margin: 0; font-family: 'JetBrains Mono', monospace;"><?php echo htmlspecialchars($name); ?></h3>
                            <div>
                                <?php if ($state['exists']): ?>
                                    <span class="badge-tag" style="background: rgba(16,185,129,0.2); color: var(--success); border: 1px solid var(--success)">
                                        Kích thước: <?php echo round($state['size'] / 1024, 2); ?> KB
                                    </span>
                                    <span class="badge-tag" style="background: rgba(245,158,11,0.2); color: var(--warning); border: 1px solid var(--warning); margin-left: 8px;">
                                        Cập nhật: <?php echo date('H:i:s d/m/Y', $state['mtime']); ?>
                                    </span>
                                <?php else: ?>
                                    <span class="badge-tag" style="background: rgba(107,114,128,0.2); color: var(--text-muted); border: 1px solid var(--border)">
                                        Không tồn tại tệp tin
                                    </span>
                                <?php endif; ?>
                            </div>
                        </div>

                        <?php if ($state['exists'] && !empty($state['last_lines'])): ?>
                            <pre><?php echo htmlspecialchars($state['last_lines']); ?></pre>
                        <?php elseif ($state['exists']): ?>
                            <p style="color: var(--text-muted); font-size: 14px; font-style: italic;">Tệp tin tồn tại nhưng trống không có lỗi.</p>
                        <?php else: ?>
                            <p style="color: var(--text-muted); font-size: 14px; font-style: italic;">Chưa phát sinh ghi log lỗi nào cho tệp tin này.</p>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- TAB CONTENT: QUEUE -->
        <div id="tab-queue" class="tab-content">
            <div class="card-main">
                <h2>⏳ Trạng thái hàng đợi chạy ngầm (Queue Jobs Status)</h2>
                
                <div class="grid-stats" style="margin-top: 24px; margin-bottom: 30px;">
                    <div class="stat-card">
                        <h3>Đang Chờ Xử Lý (Pending)</h3>
                        <p class="value" style="color: var(--warning);"><?php echo (int)$queueStats['pending']; ?></p>
                        <p class="desc">Các tác vụ đang chuẩn bị chạy.</p>
                    </div>
                    <div class="stat-card">
                        <h3>Đang Chạy (Processing)</h3>
                        <p class="value" style="color: var(--primary);"><?php echo (int)$queueStats['processing']; ?></p>
                        <p class="desc">Tác vụ đang giữ locks xử lý.</p>
                    </div>
                    <div class="stat-card">
                        <h3>Thất Bại (Failed)</h3>
                        <p class="value" style="color: var(--error);"><?php echo (int)$queueStats['failed']; ?></p>
                        <p class="desc">Tác vụ gặp lỗi quá 3 lần.</p>
                    </div>
                    <div class="stat-card">
                        <h3>Hoàn Thành (Completed)</h3>
                        <p class="value" style="color: var(--success);"><?php echo (int)$queueStats['completed']; ?></p>
                        <p class="desc">Chờ tự động dọn dẹp sau 1 giờ.</p>
                    </div>
                </div>

                <h3>Kiểm tra Worker Concurrency lock:</h3>
                <?php
                $lockFile = __DIR__ . '/worker_running.lock';
                if (file_exists($lockFile)) {
                    $age = time() - filemtime($lockFile);
                    echo "<div class='alert alert-warning'>";
                    echo "<p class='alert-title'>Tồn tại Worker Lock</p>";
                    echo "<p class='alert-desc'>Worker Lock được khởi tạo từ " . $age . " giây trước. Nếu worker chạy quá 300 giây, lock sẽ tự động coi là hết hạn và giải phóng.</p>";
                    echo "</div>";
                } else {
                    echo "<div class='alert alert-success'>";
                    echo "<p class='alert-title'>Không có Worker Lock</p>";
                    echo "<p class='alert-desc'>Worker đang ở trạng thái rảnh rỗi và sẵn sàng tiếp nhận luồng công việc mới.</p>";
                    echo "</div>";
                }
                ?>
            </div>
        </div>
    </div>

    <script>
        function switchTab(tabId) {
            // Hide all tab contents
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(el => el.classList.remove('active'));

            // Remove active style from all tab buttons
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(el => el.classList.remove('active'));

            // Show target content and button active state
            document.getElementById(tabId).classList.add('active');
            
            // Find clicking button
            event.currentTarget.classList.add('active');
        }
    </script>
</body>
</html>
