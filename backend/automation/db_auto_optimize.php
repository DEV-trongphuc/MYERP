<?php
/**
 * api/db_auto_optimize.php
 * Automated database maintenance, optimization, and indexing tool.
 * Triggers OPTIMIZE TABLE, dọn dẹp các bản ghi mồ côi (Orphans),
 * and audits index efficiency.
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);
set_time_limit(300); // 5 minutes execution time limit

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

// Output helper
function printLog($message, $type = 'info') {
    global $isCli;
    if ($isCli) {
        $color = COLOR_WHITE;
        if ($type === 'success') $color = COLOR_GREEN;
        if ($type === 'warning') $color = COLOR_YELLOW;
        if ($type === 'error') $color = COLOR_RED;
        
        echo $color . $message . COLOR_RESET . PHP_EOL;
    }
}

printLog("=== KHỞI ĐỘNG HỆ THỐNG BẢO TRÌ DATABASE AUTOFLOW v1.0.7 ===", 'info');

// 1. Connection
$pdo = null;
try {
    ob_start();
    require_once __DIR__ . '/db_connect.php';
    ob_end_clean();
    
    if (!isset($pdo) || !$pdo) {
        throw new Exception("Không thể khởi tạo thực thể PDO.");
    }
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
    $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
} catch (Exception $e) {
    if (ob_get_level() > 0) ob_end_clean();
    printLog("LỖI KẾT NỐI DATABASE: " . $e->getMessage(), 'error');
    if (!$isCli) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    }
    exit(1);
}

$dbType = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
if ($dbType !== 'mysql') {
    printLog("Script bảo trì này chỉ tương thích hoàn toàn với MySQL/MariaDB.", 'warning');
}

$report = [
    'timestamp' => date('Y-m-d H:i:s'),
    'orphans_deleted' => [],
    'optimized_tables' => [],
    'index_changes' => [],
    'execution_time_ms' => 0
];

$totalStart = microtime(true);

// 2. Clear Orphan Records (Toàn vẹn dữ liệu)
printLog("\n[1/3] ĐANG DỌN DẸP BẢN GHI MỒ CÔI (ORPHAN RECORDS)...", 'info');
$orphanChecks = [
    'subscriber_flow_states' => [
        'label' => 'Trạng thái Flow mồ côi (không có Subscriber)',
        'check_query' => "SELECT COUNT(*) FROM subscriber_flow_states sfs LEFT JOIN subscribers s ON sfs.subscriber_id = s.id WHERE s.id IS NULL",
        'delete_query' => "DELETE sfs FROM subscriber_flow_states sfs LEFT JOIN subscribers s ON sfs.subscriber_id = s.id WHERE s.id IS NULL"
    ],
    'subscriber_activity' => [
        'label' => 'Hoạt động mồ côi (không có Subscriber)',
        'check_query' => "SELECT COUNT(*) FROM subscriber_activity sa LEFT JOIN subscribers s ON sa.subscriber_id = s.id WHERE s.id IS NULL",
        'delete_query' => "DELETE sa FROM subscriber_activity sa LEFT JOIN subscribers s ON sa.subscriber_id = s.id WHERE s.id IS NULL"
    ],
    'activity_buffer' => [
        'label' => 'Bộ đệm xử lý mồ côi (không có Subscriber)',
        'check_query' => "SELECT COUNT(*) FROM activity_buffer ab LEFT JOIN subscribers s ON ab.subscriber_id = s.id WHERE s.id IS NULL",
        'delete_query' => "DELETE ab FROM activity_buffer ab LEFT JOIN subscribers s ON ab.subscriber_id = s.id WHERE s.id IS NULL"
    ]
];

foreach ($orphanChecks as $table => $queries) {
    if ($dbType !== 'mysql') continue; // Skip on non-mysql for safety
    try {
        $start = microtime(true);
        $stmtCount = $pdo->prepare($queries['check_query']);
        $stmtCount->execute();
        $count = (int)$stmtCount->fetchColumn();
        $stmtCount->closeCursor();
        $deleted = 0;
        
        if ($count > 0) {
            $deleted = $pdo->exec($queries['delete_query']);
            printLog(" -> Đã xóa $deleted bản ghi mồ côi khỏi $table.", 'success');
        } else {
            printLog(" -> Bảng $table sạch. Không phát hiện bản ghi mồ côi.", 'success');
        }
        
        $report['orphans_deleted'][] = [
            'table' => $table,
            'description' => $queries['label'],
            'orphans_found' => $count,
            'orphans_deleted' => $deleted,
            'time_ms' => round((microtime(true) - $start) * 1000, 2)
        ];
    } catch (Exception $e) {
        printLog(" -> Lỗi xử lý dọn dẹp bảng $table: " . $e->getMessage(), 'error');
        $report['orphans_deleted'][] = [
            'table' => $table,
            'description' => $queries['label'],
            'orphans_found' => 0,
            'orphans_deleted' => 0,
            'error' => $e->getMessage()
        ];
    }
}

// 3. Dynamic Index Audit & Fix
printLog("\n[2/3] ĐANG KIỂM TRA & TỐI ƯU HÓA CHỈ MỤC (INDEX AUDIT)...", 'info');
if ($dbType === 'mysql') {
    try {
        // Helper to check if index exists on table
        if (!function_exists('indexExists')) {
            function indexExists($pdo, $table, $indexName) {
                $stmt = $pdo->prepare("SHOW INDEX FROM `$table` WHERE Key_name = ?");
                $stmt->execute([$indexName]);
                $rows = $stmt->fetchAll();
                return !empty($rows);
            }
        }
        
        // 3.1 Composite index on subscriber_flow_states (status, scheduled_at)
        // Extremely critical for worker performance
        $start = microtime(true);
        if (!indexExists($pdo, 'subscriber_flow_states', 'idx_sfs_status_sched')) {
            printLog(" -> Thêm chỉ mục idx_sfs_status_sched vào subscriber_flow_states...", 'info');
            $pdo->exec("ALTER TABLE subscriber_flow_states ADD INDEX idx_sfs_status_sched (status, scheduled_at)");
            printLog(" -> THÀNH CÔNG: Đã thêm chỉ mục idx_sfs_status_sched.", 'success');
            $report['index_changes'][] = ['action' => 'ADD', 'table' => 'subscriber_flow_states', 'index' => 'idx_sfs_status_sched', 'status' => 'SUCCESS'];
        } else {
            printLog(" -> Chỉ mục idx_sfs_status_sched đã tồn tại.", 'success');
            $report['index_changes'][] = ['action' => 'NONE', 'table' => 'subscriber_flow_states', 'index' => 'idx_sfs_status_sched', 'status' => 'ALREADY_EXISTS'];
        }
        
        // 3.2 Composite index on subscribers (workspace_id, status)
        if (!indexExists($pdo, 'subscribers', 'idx_sub_workspace_status')) {
            printLog(" -> Thêm chỉ mục idx_sub_workspace_status vào subscribers...", 'info');
            $pdo->exec("ALTER TABLE subscribers ADD INDEX idx_sub_workspace_status (workspace_id, status)");
            printLog(" -> THÀNH CÔNG: Đã thêm chỉ mục idx_sub_workspace_status.", 'success');
            $report['index_changes'][] = ['action' => 'ADD', 'table' => 'subscribers', 'index' => 'idx_sub_workspace_status', 'status' => 'SUCCESS'];
        } else {
            printLog(" -> Chỉ mục idx_sub_workspace_status đã tồn tại.", 'success');
        }

        // 3.3 Composite index on subscriber_activity (subscriber_id, created_at DESC)
        if (!indexExists($pdo, 'subscriber_activity', 'idx_subact_feed')) {
            printLog(" -> Thêm chỉ mục idx_subact_feed vào subscriber_activity...", 'info');
            $pdo->exec("ALTER TABLE subscriber_activity ADD INDEX idx_subact_feed (subscriber_id, created_at)");
            printLog(" -> THÀNH CÔNG: Đã thêm chỉ mục idx_subact_feed.", 'success');
            $report['index_changes'][] = ['action' => 'ADD', 'table' => 'subscriber_activity', 'index' => 'idx_subact_feed', 'status' => 'SUCCESS'];
        } else {
            printLog(" -> Chỉ mục idx_subact_feed đã tồn tại.", 'success');
        }
        
        // 3.4 Redundant index cleanup: Drop single-column index on subscriber_activity(subscriber_id) 
        // because the composite index covers it.
        if (indexExists($pdo, 'subscriber_activity', 'idx_sub') && indexExists($pdo, 'subscriber_activity', 'idx_subact_feed')) {
            printLog(" -> Dọn dẹp chỉ mục trùng lặp: Xóa idx_sub khỏi subscriber_activity...", 'info');
            $pdo->exec("ALTER TABLE subscriber_activity DROP INDEX idx_sub");
            printLog(" -> THÀNH CÔNG: Đã xóa chỉ mục trùng lặp idx_sub.", 'success');
            $report['index_changes'][] = ['action' => 'DROP', 'table' => 'subscriber_activity', 'index' => 'idx_sub', 'status' => 'SUCCESS'];
        }
        
    } catch (Exception $e) {
        printLog(" -> Lỗi tối ưu chỉ mục: " . $e->getMessage(), 'error');
        $report['index_changes'][] = ['action' => 'ERROR', 'error' => $e->getMessage()];
    }
}

// 4. Run Table Defragmentation & Stats Update (ANALYZE / OPTIMIZE)
printLog("\n[3/3] ĐANG CHẠY CHẨN ĐOÁN & TỐI ƯU HÓA DUNG LƯỢNG BẢNG (ANALYZE & OPTIMIZE)...", 'info');
$tablesToOptimize = [
    'subscribers', 
    'subscriber_flow_states', 
    'subscriber_activity', 
    'activity_buffer', 
    'campaigns', 
    'admin_logs',
    'stats_update_buffer'
];

foreach ($tablesToOptimize as $table) {
    if ($dbType !== 'mysql') continue;
    try {
        $start = microtime(true);
        
        // Determine table size before optimization
        global $db;
        $dbName = $db;
        if (empty($dbName) && preg_match('/dbname=([^;]+)/', $dsn, $matches)) {
            $dbName = $matches[1];
        }
        
        $sizeBefore = 0.0;
        if (!empty($dbName)) {
            $stmtSize = $pdo->prepare("
                SELECT round(((data_length + index_length) / 1024 / 1024), 3) AS size_mb 
                FROM information_schema.TABLES 
                WHERE table_schema = ? AND table_name = ?
            ");
            $stmtSize->execute([$dbName, $table]);
            $sizeBefore = (float)$stmtSize->fetchColumn();
            $stmtSize->closeCursor();
        }
        
        // Run ANALYZE TABLE to recalculate key statistics
        $stmtAnalyze = $pdo->query("ANALYZE TABLE `$table`");
        if ($stmtAnalyze) {
            $stmtAnalyze->fetchAll();
            $stmtAnalyze->closeCursor();
        }
        
        // Run OPTIMIZE TABLE to rebuild table, indexes and release free space
        // Note: In InnoDB, OPTIMIZE TABLE is mapped to ALTER TABLE ... FORCE which rebuilds the table.
        // This is safe but holds a lock for some time. We use try/catch to log any timeouts.
        $stmtOptimize = $pdo->query("OPTIMIZE TABLE `$table`");
        if ($stmtOptimize) {
            $stmtOptimize->fetchAll();
            $stmtOptimize->closeCursor();
        }
        
        // Get size after optimization
        $sizeAfter = $sizeBefore;
        if (!empty($dbName)) {
            $stmtSize->execute([$dbName, $table]);
            $sizeAfter = (float)$stmtSize->fetchColumn();
            $stmtSize->closeCursor();
        }
        
        $reclaimed = max(0, $sizeBefore - $sizeAfter);
        $timeMs = round((microtime(true) - $start) * 1000, 2);
        
        printLog(" -> Tối ưu hóa bảng `$table` thành công. Reclaimed: " . number_format($reclaimed, 3) . " MB", 'success');
        
        $report['optimized_tables'][] = [
            'table' => $table,
            'size_before_mb' => $sizeBefore,
            'size_after_mb' => $sizeAfter,
            'reclaimed_mb' => $reclaimed,
            'time_ms' => $timeMs,
            'status' => 'SUCCESS'
        ];
    } catch (Exception $e) {
        printLog(" -> Lỗi tối ưu hóa bảng `$table`: " . $e->getMessage(), 'error');
        $report['optimized_tables'][] = [
            'table' => $table,
            'size_before_mb' => 0,
            'size_after_mb' => 0,
            'reclaimed_mb' => 0,
            'time_ms' => 0,
            'status' => 'ERROR',
            'error' => $e->getMessage()
        ];
    }
}

$totalDuration = (microtime(true) - $totalStart) * 1000;
$report['execution_time_ms'] = $totalDuration;

printLog("\n=== HOÀN THÀNH QUÁ TRÌNH BẢO TRÌ BẢNG TRONG " . number_format($totalDuration, 2) . " MS ===", 'success');

if ($isCli) {
    exit(0);
}

// HTML Dashboard Render
$totalReclaimed = array_sum(array_column($report['optimized_tables'], 'reclaimed_mb'));
$totalOrphans = array_sum(array_column($report['orphans_deleted'], 'orphans_deleted'));
?>
<!DOCTYPE html>
<html lang="vi" class="h-full bg-slate-950">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Optimize Dashboard - AutoFlow</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            accent: '#8b5cf6',
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
                    Database Optimization Center
                </div>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-450 bg-clip-text text-transparent">
                    Bảo Trì & Tối Ưu Hóa Database
                </h1>
                <p class="text-sm font-medium text-slate-400 max-w-xl">
                    Giải phóng dung lượng dư thừa, chống phân mảnh chỉ mục (Indexes), dọn dẹp các bản ghi mồ côi (Orphans) để tăng hiệu suất truy vấn.
                </p>
            </div>
            
            <div class="flex items-center gap-6 shrink-0 z-10">
                <button onclick="window.location.reload();" class="active:scale-95 transition-transform inline-flex items-center justify-center font-bold px-6 py-4 text-xs text-white rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 transition-all">
                    Tối Ưu Hóa Ngay
                </button>
            </div>
        </div>

        <!-- Metrics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl font-bold">
                    ⏱️
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Thời gian tối ưu</div>
                    <div class="text-xl font-bold text-slate-200"><?= number_format($report['execution_time_ms'], 2) ?> ms</div>
                </div>
            </div>
            
            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
                    📦
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Giải phóng bộ nhớ</div>
                    <div class="text-xl font-bold text-slate-200"><?= number_format($totalReclaimed, 3) ?> MB</div>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl font-bold">
                    🧹
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Xóa bản ghi mồ côi</div>
                    <div class="text-xl font-bold text-slate-200"><?= $totalOrphans ?> dòng</div>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-2xl flex items-center gap-5">
                <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold">
                    ⚡
                </div>
                <div>
                    <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Thay đổi chỉ mục</div>
                    <div class="text-xl font-bold text-slate-200"><?= count($report['index_changes']) ?> thay đổi</div>
                </div>
            </div>
        </div>

        <!-- Orphan Records Clean Report -->
        <div class="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
            <h3 class="text-lg font-bold text-slate-200 border-b border-slate-800 pb-4">
                1. Báo cáo dọn dẹp bản ghi mồ côi (Orphan Clean Up)
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <?php foreach ($report['orphans_deleted'] as $orphan): ?>
                    <div class="p-5 rounded-2xl bg-slate-900/30 border border-slate-800 flex flex-col justify-between space-y-3">
                        <div>
                            <span class="text-xs font-semibold text-purple-400 tracking-wider uppercase"><?= htmlspecialchars($orphan['table']) ?></span>
                            <h4 class="font-bold text-slate-200 mt-1"><?= htmlspecialchars($orphan['description']) ?></h4>
                        </div>
                        <div class="flex justify-between items-end">
                            <div>
                                <span class="text-[10px] text-slate-500 block">Số dòng đã dọn dẹp</span>
                                <span class="text-xl font-extrabold text-slate-200"><?= $orphan['orphans_deleted'] ?></span>
                            </div>
                            <span class="text-xs text-slate-500 font-mono"><?= number_format($orphan['time_ms'], 1) ?> ms</span>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Indexes Audit & Performance Check -->
        <div class="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
            <h3 class="text-lg font-bold text-slate-200 border-b border-slate-800 pb-4">
                2. Tình trạng chỉ mục và tối ưu cấu trúc Indexes
            </h3>
            <div class="space-y-4">
                <?php if (empty($report['index_changes'])): ?>
                    <p class="text-sm text-slate-400">Không có chỉ mục nào cần sửa đổi. Mọi cấu trúc chỉ mục composite đều hoạt động tối ưu.</p>
                <?php else: ?>
                    <?php foreach ($report['index_changes'] as $change): ?>
                        <?php if (isset($change['error'])): ?>
                            <div class="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs">
                                <strong>Lỗi:</strong> <?= htmlspecialchars($change['error']) ?>
                            </div>
                        <?php else: ?>
                            <div class="p-4 rounded-xl border border-slate-800 bg-slate-900/10 flex items-center justify-between">
                                <div class="space-y-1">
                                    <div class="flex items-center gap-3">
                                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider <?= $change['action'] === 'ADD' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : ($change['action'] === 'DROP' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400') ?>">
                                            <?= $change['action'] ?>
                                        </span>
                                        <h4 class="text-sm font-bold text-slate-200">Chỉ mục `<?= htmlspecialchars($change['index']) ?>`</h4>
                                    </div>
                                    <p class="text-xs text-slate-500">Bảng: `<?= htmlspecialchars($change['table']) ?>`</p>
                                </div>
                                <span class="text-xs font-semibold px-2.5 py-1 rounded-lg <?= $change['status'] === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400' ?>">
                                    <?= htmlspecialchars($change['status']) ?>
                                </span>
                            </div>
                        <?php endif; ?>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <!-- Tables Optimize Detail List -->
        <div class="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
            <h3 class="text-lg font-bold text-slate-200 border-b border-slate-800 pb-4">
                3. Chi tiết tối ưu hóa dung lượng bảng (OPTIMIZE & ANALYZE)
            </h3>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-slate-800 text-xs text-slate-400 font-semibold">
                            <th class="py-3 px-4">TÊN BẢNG</th>
                            <th class="py-3 px-4 text-right">DUNG LƯỢNG BAN ĐẦU</th>
                            <th class="py-3 px-4 text-right">DUNG LƯỢNG SAU TỐI ƯU</th>
                            <th class="py-3 px-4 text-right">DUNG LƯỢNG GIẢI PHÓNG</th>
                            <th class="py-3 px-4 text-right">THỜI GIAN CHẠY</th>
                            <th class="py-3 px-4 text-right">TRẠNG THÁI</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/50 text-sm">
                        <?php foreach ($report['optimized_tables'] as $t): ?>
                            <tr class="hover:bg-slate-900/20 transition-colors">
                                <td class="py-4 px-4 font-bold text-slate-200">`<?= htmlspecialchars($t['table']) ?>`</td>
                                <td class="py-4 px-4 text-right font-mono text-slate-400"><?= number_format($t['size_before_mb'], 3) ?> MB</td>
                                <td class="py-4 px-4 text-right font-mono text-slate-300"><?= number_format($t['size_after_mb'], 3) ?> MB</td>
                                <td class="py-4 px-4 text-right font-mono font-bold <?= $t['reclaimed_mb'] > 0 ? 'text-emerald-400' : 'text-slate-500' ?>">
                                    <?= $t['reclaimed_mb'] > 0 ? '-' . number_format($t['reclaimed_mb'], 3) . ' MB' : '0.000 MB' ?>
                                </td>
                                <td class="py-4 px-4 text-right font-mono text-slate-400"><?= number_format($t['time_ms'], 1) ?> ms</td>
                                <td class="py-4 px-4 text-right">
                                    <span class="inline-flex items-center justify-center font-bold px-2 py-0.5 text-[9px] rounded tracking-wider uppercase <?= $t['status'] === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400' ?>">
                                        <?= htmlspecialchars($t['status']) ?>
                                    </span>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div class="text-center text-xs text-slate-600 font-medium">
            DOMATION Autoflow Database Maintenance Center &bull; Developed by Antigravity
        </div>
    </div>
</body>
</html>
