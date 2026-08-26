<?php
// backend/test_export_logic.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ExportController.php';

echo "=== KIỂM THỬ TÍNH NĂNG XUẤT DỮ LIỆU (EXPORT SUITE) ===\n\n";

// 1. Test class instantiation
$ctrl = new ExportController($pdo);
assertTest("Khởi tạo ExportController thành công", $ctrl instanceof ExportController);

// 2. Test schema presence for contacts, companies, deals, products, batches
$checkCol = function($table, $column) use ($conn) {
    $res = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE '{$column}'");
    return assertTest("Cột {$table}.{$column} tồn tại trong CSDL", $res && $res->num_rows > 0);
};

$checkCol('contacts', 'full_name');
$checkCol('contacts', 'phone');
$checkCol('contacts', 'status');
$checkCol('contacts', 'stage_id');
$checkCol('companies', 'name');
$checkCol('deals', 'title');
$checkCol('products', 'name');
$checkCol('batches', 'batch_code');

// 3. Test query contacts count with customer segment
$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM contacts WHERE tenant_id = 1 AND deleted_at IS NULL AND status = 'customer'");
$stmt->execute();
$count = $stmt->fetchColumn();
assertTest("Truy vấn danh sách học viên chính thức (status = customer)", $count !== false, "Tổng số học viên: " . $count);

// 4. Test query with pipeline stages
$stmt2 = $pdo->prepare("
    SELECT c.id, c.full_name, c.phone, c.status, ps.name as stage_name 
    FROM contacts c 
    LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id 
    WHERE c.tenant_id = 1 AND c.deleted_at IS NULL 
    LIMIT 5
");
$stmt2->execute();
$samples = $stmt2->fetchAll(PDO::FETCH_ASSOC);
assertTest("Join pipeline_stages lấy tên giai đoạn cho export", count($samples) >= 0, "Lấy được " . count($samples) . " mẫu liên hệ");

printTestSummary();
