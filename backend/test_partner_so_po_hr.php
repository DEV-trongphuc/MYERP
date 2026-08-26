<?php
// backend/test_partner_so_po_hr.php
// IDEAS ERP - Script Kiểm thử Phân quyền Role Nhân sự (HR) & SO/PO cho Đối tác

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';
require_once __DIR__ . '/controllers/SalesOrderController.php';

echo "====================================================\n";
echo "🚀 BẮT ĐẦU TEST SUITE: ROLE NHÂN SỰ & SO/PO ĐỐI TÁC\n";
echo "====================================================\n\n";

$tenantId = 1;
$uRes = $conn->query("SELECT id FROM users WHERE is_active = 1 LIMIT 1");
$adminUserId = ($uRes && $uRes->num_rows > 0) ? (int)$uRes->fetch_assoc()['id'] : 100009;

// Lấy hoặc tạo Supplier / Đối tác
$supRes = $conn->query("SELECT id FROM suppliers LIMIT 1");
if ($supRes && $supRes->num_rows > 0) {
    $supplierId = (int)$supRes->fetch_assoc()['id'];
} else {
    $conn->query("INSERT INTO suppliers (tenant_id, name, created_by) VALUES ({$tenantId}, 'Đối Tác / Giảng Viên Test', {$adminUserId})");
    $supplierId = $conn->insert_id;
}

// Lấy hoặc tạo Company / Đối tác
$compRes = $conn->query("SELECT id FROM companies LIMIT 1");
if ($compRes && $compRes->num_rows > 0) {
    $companyId = (int)$compRes->fetch_assoc()['id'];
} else {
    $conn->query("INSERT INTO companies (tenant_id, name, created_by) VALUES ({$tenantId}, 'Công ty Đối Tác Đào Tạo', {$adminUserId})");
    $companyId = $conn->insert_id;
}

// Auth mock cho Role HR (Nhân sự)
$hrAuth = [
    'user_id' => $adminUserId,
    'tenant_id' => $tenantId,
    'role' => 'hr',
    'full_name' => 'Test HR Partner Audit'
];

// Auth mock cho Role Kế toán
$accountantAuth = [
    'user_id' => $adminUserId,
    'tenant_id' => $tenantId,
    'role' => 'accountant',
    'full_name' => 'Test Accountant Audit'
];

$poController = new PurchaseOrderController($pdo);
$soController = new SalesOrderController();

// --------------------------------------------------
// TEST 1: Role Nhân sự (HR) Tạo PO Cho Đối Tác (Phí giảng viên)
// --------------------------------------------------
echo "📌 1. Kiểm thử Role Nhân sự (HR) lên PO cho Đối tác (Phí Giảng viên)...\n";

$poNumber = 'PO-HR-' . date('Ymd-His');
$poSql = "INSERT INTO purchase_orders (tenant_id, supplier_id, created_by, po_number, order_date, status, subtotal, tax, total, notes)
          VALUES ({$tenantId}, {$supplierId}, {$adminUserId}, '{$poNumber}', CURDATE(), 'ordered', 5000000.00, 0.00, 5000000.00, 'PO Trả Phí Giảng Viên Đào Tạo')";
$conn->query($poSql);
$poId = $conn->insert_id;

assertTest("Role HR tạo thành công PO trả phí giảng viên cho Đối tác #{$supplierId}", $poId > 0, "PO ID: {$poId}");
assertDbField($conn, 'purchase_orders', 'supplier_id', "id = {$poId}", $supplierId, "PO gán đúng đối tác supplier_id = {$supplierId}");

// --------------------------------------------------
// TEST 2: Kế Toán Tạo SO Dịch Vụ Cho Đối Tác Công Ty
// --------------------------------------------------
echo "\n📌 2. Kiểm thử Kế toán tạo SO dịch vụ cho Đối tác Công ty...\n";

$soNumber = 'SO-ACC-' . date('Ymd-His');
$soSql = "INSERT INTO sales_orders (tenant_id, company_id, created_by, so_number, order_date, status, payment_status, subtotal, tax, total, notes)
          VALUES ({$tenantId}, {$companyId}, {$adminUserId}, '{$soNumber}', CURDATE(), 'draft', 'unpaid', 10000000.00, 1000000.00, 11000000.00, 'SO Cung Cấp Dịch Vụ Khác Cho Đối Tác')";
$conn->query($soSql);
$soId = $conn->insert_id;

assertTest("Kế toán tạo thành công SO cho Công ty Đối tác #{$companyId}", $soId > 0, "SO ID: {$soId}");
assertDbField($conn, 'sales_orders', 'company_id', "id = {$soId}", $companyId, "SO gán đúng company_id = {$companyId}");

// --------------------------------------------------
// TEST 3: Đọc Danh Sách Chứng Từ Theo Đối Tác
// --------------------------------------------------
echo "\n📌 3. Kiểm thử Truy xuất Chứng từ SO, PO theo ID Đối tác...\n";

$soRes = $conn->query("SELECT * FROM sales_orders WHERE company_id = {$companyId}");
assertTest("Truy xuất được danh sách SO của Công ty Đối tác", $soRes && $soRes->num_rows > 0);

$poRes = $conn->query("SELECT * FROM purchase_orders WHERE supplier_id = {$supplierId}");
assertTest("Truy xuất được danh sách PO / Phí giảng viên của Đối tác", $poRes && $poRes->num_rows > 0);

// Dọn dẹp dữ liệu kiểm thử
echo "\n📌 4. Dọn dẹp dữ liệu rác kiểm thử...\n";
if ($poId) $conn->query("DELETE FROM purchase_orders WHERE id = {$poId}");
if ($soId) $conn->query("DELETE FROM sales_orders WHERE id = {$soId}");
assertTest("Hoàn tất dọn dẹp dữ liệu test", true);

printTestSummary();
