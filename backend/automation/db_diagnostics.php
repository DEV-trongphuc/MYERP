<?php
// api/db_diagnostics.php
/**
 * DOMATION DATABASE DIAGNOSTICS & SELF-TEST TOOL
 * A high-fidelity tool to check database status, table structures, 
 * read/write permissions, data integrity, and performance metrics.
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);

// Retrieve JSON response format flag
$format = $_GET['format'] ?? '';
$isJson = ($format === 'json' || (isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false));

$report = [
    'timestamp' => date('Y-m-d H:i:s'),
    'status' => 'OK', // OK, WARNING, ERROR
    'score' => 100,
    'environment' => [],
    'permissions' => [],
    'tables' => [],
    'integrity' => [],
    'warnings' => [],
    'errors' => []
];

// Helper to add error
function addDiagError(&$report, $message) {
    $report['errors'][] = $message;
    $report['status'] = 'ERROR';
    $report['score'] = max(0, $report['score'] - 20);
}

// Helper to add warning
function addDiagWarning(&$report, $message) {
    $report['warnings'][] = $message;
    if ($report['status'] !== 'ERROR') {
        $report['status'] = 'WARNING';
    }
    $report['score'] = max(0, $report['score'] - 5);
}

// 1. Connection & Config Check
try {
    // Prevent ob_start issues by buffering output
    ob_start();
    require_once __DIR__ . '/db_connect.php';
    ob_end_clean();
    
    if (!isset($pdo) || !$pdo) {
        throw new Exception("PDO connection object (\$pdo) not initialized.");
    }
    
    // Test basic connection
    $stmt = $pdo->query("SELECT VERSION() as version, @@time_zone as tz, @@character_set_database as charset");
    $dbMeta = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $report['environment'] = [
        'php_version' => PHP_VERSION,
        'mysql_version' => $dbMeta['version'] ?? 'Unknown',
        'database_charset' => $dbMeta['charset'] ?? 'Unknown',
        'database_timezone' => $dbMeta['tz'] ?? 'Unknown',
        'server_timezone' => date_default_timezone_get(),
        'skip_locked_supported' => isDatabaseSkipLockedSupported($pdo) ? 'Yes' : 'No'
    ];
} catch (Exception $e) {
    if (ob_get_level() > 0) ob_end_clean();
    addDiagError($report, "Kết nối cơ sở dữ liệu thất bại: " . $e->getMessage());
    $report['environment'] = [
        'php_version' => PHP_VERSION,
        'mysql_version' => 'N/A',
        'error' => $e->getMessage()
    ];
}

// Proceed with tests only if connection is OK
if ($report['status'] !== 'ERROR' && isset($pdo)) {
    
    // 2. Read / Write / Schema Permissions Test
    try {
        $tempTableName = 'temp_domation_diagnostics_' . rand(100, 999);
        
        // Test Create
        $pdo->exec("CREATE TEMPORARY TABLE `$tempTableName` (id INT PRIMARY KEY, val VARCHAR(50))");
        $report['permissions']['create_table'] = 'PASSED';
        
        // Test Insert
        $ins = $pdo->prepare("INSERT INTO `$tempTableName` VALUES (1, 'Test Diagnostics')");
        $ins->execute();
        $report['permissions']['insert_row'] = 'PASSED';
        
        // Test Select
        $sel = $pdo->query("SELECT val FROM `$tempTableName` WHERE id = 1");
        $val = $sel->fetchColumn();
        if ($val === 'Test Diagnostics') {
            $report['permissions']['select_row'] = 'PASSED';
        } else {
            $report['permissions']['select_row'] = 'FAILED (Value mismatch)';
            addDiagError($report, "Select test: giá trị trả về không khớp.");
        }
        
        // Test Drop
        $pdo->exec("DROP TABLE `$tempTableName`");
        $report['permissions']['drop_table'] = 'PASSED';
        
    } catch (PDOException $e) {
        addDiagError($report, "Kiểm thử quyền SQL thất bại: " . $e->getMessage());
        $report['permissions']['error'] = $e->getMessage();
    }
    
    // 3. Database size and individual tables status
    try {
        global $db; // From db_connect.php
        
        // Get database name from DSN if $db variable isn't set globally
        $dbName = $db;
        if (empty($dbName)) {
            // Extract from DSN (mysql:host=...;dbname=...)
            if (preg_match('/dbname=([^;]+)/', $dsn, $matches)) {
                $dbName = $matches[1];
            }
        }
        
        // Fetch Table Sizes from Information Schema
        $sizesStmt = $pdo->prepare("
            SELECT table_name AS 'table', 
                   table_rows AS 'rows',
                   round(((data_length + index_length) / 1024 / 1024), 2) AS 'size_mb' 
            FROM information_schema.TABLES 
            WHERE table_schema = :db_name
        ");
        $sizesStmt->execute(['db_name' => $dbName]);
        $tableMeta = $sizesStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $tableInfoMap = [];
        foreach ($tableMeta as $t) {
            $tableInfoMap[$t['table']] = [
                'rows' => (int)$t['rows'],
                'size_mb' => (float)$t['size_mb']
            ];
        }
        
        // Core tables to verify
        $criticalTables = [
            'subscribers' => 'Danh sách người đăng ký',
            'flows' => 'Chuỗi luồng tự động',
            'subscriber_flow_states' => 'Trạng thái người dùng trong luồng',
            'subscriber_activity' => 'Nhật ký hoạt động khách hàng',
            'activity_buffer' => 'Bộ đệm xử lý hoạt động',
            'campaigns' => 'Các chiến dịch gửi mail',
            'settings' => 'Cấu hình hệ thống',
            'zalo_oa' => 'Liên kết Zalo OA',
            'admin_logs' => 'Nhật ký quản trị viên'
        ];
        
        $totalDbSize = 0;
        foreach ($criticalTables as $table => $desc) {
            $exists = isset($tableInfoMap[$table]);
            if ($exists) {
                $rows = $tableInfoMap[$table]['rows'];
                $size = $tableInfoMap[$table]['size_mb'];
                $totalDbSize += $size;
                
                // Do a quick test select to verify schema compatibility
                $startTime = microtime(true);
                try {
                    $pdo->query("SELECT * FROM `$table` LIMIT 1")->fetchAll();
                    $queryTimeMs = round((microtime(true) - $startTime) * 1000, 2);
                    $status = 'OK';
                    $msg = 'Bảng tồn tại, cấu trúc chuẩn.';
                } catch (PDOException $ex) {
                    $status = 'ERROR';
                    $msg = 'Lỗi truy vấn: ' . $ex->getMessage();
                    $queryTimeMs = 0;
                    addDiagError($report, "Lỗi truy vấn trên bảng `$table`: " . $ex->getMessage());
                }
                
                $report['tables'][$table] = [
                    'description' => $desc,
                    'status' => $status,
                    'rows' => $rows,
                    'size_mb' => $size,
                    'query_time_ms' => $queryTimeMs,
                    'message' => $msg
                ];
            } else {
                addDiagWarning($report, "Bảng quan trọng bị thiếu: `$table` ($desc)");
                $report['tables'][$table] = [
                    'description' => $desc,
                    'status' => 'MISSING',
                    'rows' => 0,
                    'size_mb' => 0,
                    'query_time_ms' => 0,
                    'message' => 'Bảng không tồn tại trong cơ sở dữ liệu.'
                ];
            }
        }
        $report['environment']['total_database_size_mb'] = $totalDbSize;
        
    } catch (PDOException $e) {
        addDiagError($report, "Lỗi khi nạp dữ liệu thống kê bảng: " . $e->getMessage());
    }
    
    // 4. Data Integrity Tests (Orphan Checks)
    try {
        $integrityChecks = [
            'orphaned_flow_states_subscribers' => [
                'name' => 'Trạng thái luồng mồ côi (không có Subscriber)',
                'query' => "SELECT COUNT(*) FROM subscriber_flow_states sfs LEFT JOIN subscribers s ON sfs.subscriber_id = s.id WHERE s.id IS NULL",
                'advice' => 'Khuyên dùng: Xóa các bản ghi mồ côi bằng lệnh DELETE sfs FROM subscriber_flow_states sfs LEFT JOIN subscribers s ON sfs.subscriber_id = s.id WHERE s.id IS NULL'
            ],
            'orphaned_flow_states_flows' => [
                'name' => 'Trạng thái luồng mồ côi (không có Flow)',
                'query' => "SELECT COUNT(*) FROM subscriber_flow_states sfs LEFT JOIN flows f ON sfs.flow_id = f.id WHERE f.id IS NULL",
                'advice' => 'Khuyên dùng: Xóa các bản ghi mồ côi khi flow bị xóa.'
            ],
            'orphaned_activities' => [
                'name' => 'Nhật ký hoạt động mồ côi (không có Subscriber)',
                'query' => "SELECT COUNT(*) FROM subscriber_activity sa LEFT JOIN subscribers s ON sa.subscriber_id = s.id WHERE s.id IS NULL",
                'advice' => 'Có thể xảy ra khi xóa subscriber mà không xóa cascaded logs.'
            ]
        ];
        
        foreach ($integrityChecks as $key => $check) {
            $startTime = microtime(true);
            try {
                $count = (int)$pdo->query($check['query'])->fetchColumn();
                $queryTime = round((microtime(true) - $startTime) * 1000, 2);
                
                $status = ($count > 0) ? 'WARNING' : 'OK';
                if ($count > 0) {
                    addDiagWarning($report, "Phát hiện {$count} bản ghi: {$check['name']}");
                }
                
                $report['integrity'][$key] = [
                    'name' => $check['name'],
                    'status' => $status,
                    'count' => $count,
                    'query_time_ms' => $queryTime,
                    'advice' => $count > 0 ? $check['advice'] : 'Hoàn hảo. Không phát hiện vấn đề.'
                ];
            } catch (PDOException $ex) {
                $report['integrity'][$key] = [
                    'name' => $check['name'],
                    'status' => 'ERROR',
                    'count' => 0,
                    'query_time_ms' => 0,
                    'advice' => 'Lỗi kiểm tra: ' . $ex->getMessage()
                ];
                addDiagError($report, "Kiểm tra toàn vẹn {$check['name']} lỗi: " . $ex->getMessage());
            }
        }
        
    } catch (Exception $e) {
        addDiagError($report, "Kiểm tra tính toàn vẹn dữ liệu thất bại: " . $e->getMessage());
    }
}

// Output JSON
if ($isJson) {
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Otherwise, render HTML
?>
<!DOCTYPE html>
<html lang="vi" class="h-full bg-slate-50">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Diagnostics - DOMATION</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            accent: '#8b5cf6', // Violet
                            primary: '#561dd0',
                            bg: '#f8fafc',
                        }
                    },
                    borderRadius: {
                        '3xl': '24px',
                        '2xl': '18px',
                        'xl': '14px',
                    }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
        }
        .active-scale {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .active-scale:active {
            transform: scale(0.96);
        }
    </style>
</head>
<body class="flex flex-col min-h-full text-slate-800 antialiased p-4 md:p-8">
    
    <div class="max-w-[1200px] w-full mx-auto space-y-8">
        
        <!-- Header Banner -->
        <div class="bg-white rounded-3xl border border-slate-100/70 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.015)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div class="space-y-2">
                <div class="flex items-center gap-2 text-violet-600 font-extrabold text-xs uppercase tracking-widest">
                    <span class="flex h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse"></span>
                    DOMATION Database Engine
                </div>
                <h1 class="text-3xl font-black tracking-tight text-slate-800">
                    Trình Tự Kiểm Thử & Chẩn Đoán Cấu Trúc Database
                </h1>
                <p class="text-sm font-medium text-slate-400">
                    Chạy kiểm định quyền ghi chép, thống kê dung lượng bảng, tìm bản ghi mồ côi và phân tích môi trường thực thi PHP/MySQL.
                </p>
            </div>
            
            <div class="flex items-center gap-4 shrink-0">
                <div class="text-right">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Điểm Sức Khỏe</span>
                    <span class="text-3xl font-black font-mono tracking-tighter text-slate-850"><?= $report['score'] ?></span>
                    <span class="text-sm font-bold text-slate-400">/ 100</span>
                </div>
                <div class="h-12 w-px bg-slate-100"></div>
                <a href="?format=json" target="_blank" class="active-scale inline-flex items-center justify-center font-bold px-5 py-2.5 text-xs rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/50 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-colors">
                    Xuất JSON
                </a>
                <a href="" class="active-scale inline-flex items-center justify-center font-bold px-5 py-2.5 text-xs text-white rounded-2xl bg-gradient-to-b from-violet-500 to-violet-600 hover:brightness-[1.03] shadow-[0_6px_18px_-4px_rgba(104,61,242,0.22),inset_0_1.5px_0_rgba(255,255,255,0.3)] transition-all">
                    Chạy Lại
                </a>
            </div>
        </div>

        <!-- Warning & Error Lists -->
        <?php if (!empty($report['errors']) || !empty($report['warnings'])): ?>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Errors -->
                <?php if (!empty($report['errors'])): ?>
                    <div class="bg-rose-50 border border-rose-100 rounded-3xl p-6 space-y-3">
                        <h3 class="font-black text-rose-800 text-sm uppercase tracking-wider flex items-center gap-2">
                            ⚠️ Lỗi Hệ Thống (<?= count($report['errors']) ?>)
                        </h3>
                        <ul class="space-y-2 text-xs font-semibold text-rose-700 list-disc list-inside">
                            <?php foreach ($report['errors'] as $error): ?>
                                <li><?= htmlspecialchars($error) ?></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                <?php endif; ?>

                <!-- Warnings -->
                <?php if (!empty($report['warnings'])): ?>
                    <div class="bg-amber-50/50 border border-amber-100 rounded-3xl p-6 space-y-3">
                        <h3 class="font-black text-amber-800 text-sm uppercase tracking-wider flex items-center gap-2">
                            ⚡ Cảnh báo & Khuyên dùng (<?= count($report['warnings']) ?>)
                        </h3>
                        <ul class="space-y-2 text-xs font-semibold text-amber-700 list-disc list-inside">
                            <?php foreach ($report['warnings'] as $warning): ?>
                                <li><?= htmlspecialchars($warning) ?></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <!-- Environment & Write Permissions Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <!-- Connection Info Card (5 cols) -->
            <div class="lg:col-span-5 bg-white rounded-3xl border border-slate-100/70 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-5">
                <h3 class="text-base font-extrabold text-slate-800 border-b border-slate-50 pb-3">
                    Môi Trường & Kết Nối
                </h3>
                <div class="space-y-3 text-xs">
                    <?php foreach ($report['environment'] as $k => $v): ?>
                        <?php if ($k === 'total_database_size_mb') $v = $v . ' MB'; ?>
                        <div class="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <span class="font-semibold text-slate-400 capitalize"><?= str_replace('_', ' ', $k) ?></span>
                            <span class="font-bold text-slate-700"><?= htmlspecialchars($v) ?></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Permission checks (7 cols) -->
            <div class="lg:col-span-7 bg-white rounded-3xl border border-slate-100/70 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-5">
                <h3 class="text-base font-extrabold text-slate-800 border-b border-slate-50 pb-3">
                    Kiểm Tra Quyền Thao Tác SQL (Read / Write / Schema)
                </h3>
                
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <?php 
                    $permKeys = ['create_table' => 'Tạo bảng tạm', 'insert_row' => 'Ghi dữ liệu', 'select_row' => 'Đọc dữ liệu', 'drop_table' => 'Xóa bảng tạm'];
                    foreach ($permKeys as $key => $title):
                        $status = $report['permissions'][$key] ?? 'FAILED';
                        $passed = ($status === 'PASSED');
                    ?>
                        <div class="p-4 rounded-2xl border <?= $passed ? 'border-emerald-100 bg-emerald-50/20' : 'border-rose-100 bg-rose-50/20' ?> flex flex-col items-center justify-between text-center min-h-[92px]">
                            <span class="text-[10px] font-bold text-slate-500 block leading-tight"><?= $title ?></span>
                            <span class="text-xs font-black uppercase tracking-wider block mt-2 <?= $passed ? 'text-emerald-600' : 'text-rose-600' ?>">
                                <?= $status ?>
                            </span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <!-- Table Diagnostics -->
        <div class="bg-white rounded-3xl border border-slate-100/70 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-5">
            <h3 class="text-base font-extrabold text-slate-800 border-b border-slate-50 pb-3">
                Thông Số Các Bảng Cơ Sở Dữ Liệu
            </h3>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs font-semibold">
                    <thead>
                        <tr class="border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-widest">
                            <th class="pb-3 pl-2">Tên Bảng</th>
                            <th class="pb-3">Mô Tả</th>
                            <th class="pb-3 text-center">Trạng Thái</th>
                            <th class="pb-3 text-right">Số Dòng</th>
                            <th class="pb-3 text-right">Kích Thước</th>
                            <th class="pb-3 text-right pr-2">Thời Gian Query</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50 text-slate-700">
                        <?php foreach ($report['tables'] as $name => $meta): 
                            $isError = ($meta['status'] === 'ERROR' || $meta['status'] === 'MISSING');
                        ?>
                            <tr class="hover:bg-slate-50/60 transition-colors">
                                <td class="py-3.5 pl-2 font-bold text-slate-800 font-mono"><?= htmlspecialchars($name) ?></td>
                                <td class="py-3.5 text-slate-400 font-medium"><?= htmlspecialchars($meta['description']) ?></td>
                                <td class="py-3.5 text-center">
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider <?= $isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100' ?>">
                                        <?= htmlspecialchars($meta['status']) ?>
                                    </span>
                                </td>
                                <td class="py-3.5 text-right font-mono"><?= number_format($meta['rows']) ?></td>
                                <td class="py-3.5 text-right font-mono"><?= number_format($meta['size_mb'], 2) ?> MB</td>
                                <td class="py-3.5 text-right font-mono pr-2 <?= $meta['query_time_ms'] > 100 ? 'text-amber-500' : 'text-slate-500' ?>">
                                    <?= $meta['query_time_ms'] ?> ms
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Data Integrity Analysis -->
        <div class="bg-white rounded-3xl border border-slate-100/70 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.015)] space-y-5">
            <h3 class="text-base font-extrabold text-slate-800 border-b border-slate-50 pb-3">
                Phân Tích Tính Toàn Vẹn & Bản Ghi Mồ Côi (Data Integrity)
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <?php foreach ($report['integrity'] as $key => $check): 
                    $hasOrphans = ($check['count'] > 0);
                    $isError = ($check['status'] === 'ERROR');
                ?>
                    <div class="p-5 rounded-2xl border flex flex-col justify-between space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all <?= $isError ? 'border-rose-100 bg-rose-50/10' : ($hasOrphans ? 'border-amber-100 bg-amber-50/10' : 'border-slate-100 bg-white hover:border-slate-200') ?>">
                        <div class="space-y-1">
                            <span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider <?= $isError ? 'bg-rose-50 text-rose-600' : ($hasOrphans ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600') ?>">
                                <?= $check['status'] ?>
                            </span>
                            <h4 class="font-extrabold text-slate-800 text-xs mt-2 block leading-tight"><?= htmlspecialchars($check['name']) ?></h4>
                        </div>
                        
                        <div class="flex items-baseline justify-between border-t border-slate-50 pt-3">
                            <div class="font-mono">
                                <span class="text-2xl font-black text-slate-800"><?= $check['count'] ?></span>
                                <span class="text-[10px] text-slate-400 font-bold block mt-0.5">Bản ghi phát hiện</span>
                            </div>
                            <span class="text-[10px] font-mono text-slate-400"><?= $check['query_time_ms'] ?> ms</span>
                        </div>
                        
                        <p class="text-[10px] text-slate-400 font-semibold leading-relaxed border-t border-slate-50 pt-3 block italic">
                            <?= htmlspecialchars($check['advice']) ?>
                        </p>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

    </div>

</body>
</html>
