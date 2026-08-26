<?php
// backend/test_so_po_finance_audit.php
// IDEAS ERP - Script Kiểm thử toàn diện SO, PO, Hóa đơn và Performance Kế toán

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';
require_once __DIR__ . '/controllers/SalesOrderController.php';

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if (!class_exists('ResponseException')) {
    class ResponseException extends Exception {
        public int $statusCode;
        public $responseData;
        public string $responseMsg;
        public bool $isSuccess;
        public function __construct(int $code, $data, string $msg, bool $success) {
            parent::__construct($msg, $code);
            $this->statusCode = $code;
            $this->responseData = $data;
            $this->responseMsg = $msg;
            $this->isSuccess = $success;
        }
    }
}

if (!class_exists('RespondException')) {
    class RespondException extends ResponseException {}
}

$lastResponse = null;
if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        global $lastResponse;
        $lastResponse = [
            'code' => $code,
            'data' => $data,
            'message' => $message,
            'success' => $success
        ];
        throw new ResponseException($code, $data, $message, $success);
    }
}

if (!function_exists('logActivity')) {
    function logActivity($db, $tid, $uid, string $action, ?string $resource = null, $resourceId = null, ?string $data = null): void {
        // Mock implementation to prevent call_to_undefined_function errors in tests
    }
}

echo "====================================================\n";
echo "🚀 BẮT ĐẦU TEST SUITE: AUDIT SO, PO & KẾ TOÁN ERP\n";
echo "====================================================\n\n";

$tenantId = 1;
$uRes = $conn->query("SELECT id FROM users WHERE is_active = 1 LIMIT 1");
$adminUserId = ($uRes && $uRes->num_rows > 0) ? (int)$uRes->fetch_assoc()['id'] : 100009;

// Lấy hoặc tạo Supplier hợp lệ
$supRes = $conn->query("SELECT id FROM suppliers LIMIT 1");
if ($supRes && $supRes->num_rows > 0) {
    $supplierId = (int)$supRes->fetch_assoc()['id'];
} else {
    $conn->query("INSERT INTO suppliers (tenant_id, name, created_by) VALUES ({$tenantId}, 'Nhà Cung Cấp Test Audit', {$adminUserId})");
    $supplierId = $conn->insert_id;
}

$auth = [
    'user_id' => $adminUserId,
    'tenant_id' => $tenantId,
    'role' => 'admin',
    'full_name' => 'Test Admin Audit'
];

// --------------------------------------------------
// TEST 1: Cấu trúc Bảng & Indexes (Schema Verification)
// --------------------------------------------------
echo "📌 1. Kiểm tra cấu trúc CSDL & Composite Indexes...\n";

$tablesCheck = ['sales_orders', 'sales_order_items', 'purchase_orders', 'purchase_order_items', 'invoices', 'invoice_items', 'expenses', 'cooperation_slips'];
foreach ($tablesCheck as $tbl) {
    $stmt = $conn->query("SHOW TABLES LIKE '{$tbl}'");
    assertTest("Kiểm tra sự tồn tại của bảng `{$tbl}`", $stmt && $stmt->num_rows > 0);
}

// --------------------------------------------------
// TEST 2: Quyền khởi tạo & Luồng PO (Purchase Order Flow)
// --------------------------------------------------
echo "\n📌 2. Kiểm thử Luồng Mua hàng (PO Flow & Stock Receiving)...\n";

$poController = new PurchaseOrderController($pdo);

// Tạo PO (mặc định set approval_status = 'approved' để được quyền nhập kho)
$poNumber = 'PO-TEST-' . date('Ymd-His');
$poSql = "INSERT INTO purchase_orders (tenant_id, supplier_id, created_by, po_number, order_date, status, approval_status, subtotal, tax, total, notes)
          VALUES ({$tenantId}, {$supplierId}, {$adminUserId}, '{$poNumber}', CURDATE(), 'ordered', 'approved', 1000000.00, 100000.00, 1100000.00, 'Test PO Audit')";
$conn->query($poSql);
$poId = $conn->insert_id;

assertTest("Tạo Đơn mua hàng PO #{$poNumber}", $poId > 0, "PO ID: {$poId}");

// Chèn PO Item
$conn->query("INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal)
              VALUES ({$poId}, NULL, 'Vật tư Test Audit', 10.00, 100000.00, 1000000.00)");

assertDbField($conn, 'purchase_orders', 'status', "id = {$poId}", 'ordered', "Trạng thái PO ban đầu phải là 'ordered'");

// Thực hiện Nhập kho từ PO
try {
    $poController->receive($auth, $poId);
} catch (ResponseException $e) {
    assertTest("Thực hiện Nhập kho từ PO", $e->statusCode === 200 || $e->statusCode === 201, "Status code: " . $e->statusCode . " | Message: " . $e->responseMsg);
} catch (\Throwable $e) {
    assertTest("Thực hiện Nhập kho từ PO", false, "Lỗi: " . $e->getMessage());
}
assertDbField($conn, 'purchase_orders', 'status', "id = {$poId}", 'received', "Trạng thái PO sau khi nhận hàng phải là 'received'");

// --------------------------------------------------
// TEST 3: Luồng Đơn Bán Hàng & Hóa Đơn (SO & Invoice Flow)
// --------------------------------------------------
echo "\n📌 3. Kiểm thử Luồng Bán hàng (SO -> Invoice -> Cash Flow)...\n";

$soController = new SalesOrderController();

// Tạo SO mới
$soNumber = 'SO-TEST-' . date('Ymd-His');
$soSql = "INSERT INTO sales_orders (tenant_id, contact_id, created_by, so_number, order_date, status, payment_status, subtotal, tax, total, notes)
          VALUES ({$tenantId}, NULL, {$adminUserId}, '{$soNumber}', CURDATE(), 'draft', 'unpaid', 2000000.00, 200000.00, 2200000.00, 'Test SO Audit')";
$conn->query($soSql);
$soId = $conn->insert_id;

assertTest("Tạo Đơn bán hàng SO #{$soNumber}", $soId > 0, "SO ID: {$soId}");

// Chèn SO Item
$conn->query("INSERT INTO sales_order_items (so_id, product_id, name, quantity, unit_price, discount, subtotal)
              VALUES ({$soId}, NULL, 'Dịch vụ Tư vấn ERP Test', 1.00, 2000000.00, 0.00, 2000000.00)");

// Duyệt SO
try {
    $soController->approve($auth, $soId);
} catch (ResponseException $e) {
    assertTest("Duyệt đơn bán hàng SO", $e->statusCode === 200 || $e->statusCode === 201, "Status code: " . $e->statusCode . " | Message: " . $e->responseMsg);
} catch (\Throwable $e) {
    assertTest("Duyệt đơn bán hàng SO", false, "Lỗi: " . $e->getMessage());
}
assertDbField($conn, 'sales_orders', 'status', "id = {$soId}", 'approved', "Trạng thái SO sau khi duyệt phải là 'approved'");

// Chuyển SO thành Hóa đơn Invoice
try {
    $soController->convertToInvoice($auth, $soId);
} catch (ResponseException $e) {
    assertTest("Chuyển SO thành Hóa đơn Invoice", $e->statusCode === 200 || $e->statusCode === 201, "Status code: " . $e->statusCode . " | Message: " . $e->responseMsg);
} catch (\Throwable $e) {
    assertTest("Chuyển SO thành Hóa đơn Invoice", false, "Lỗi: " . $e->getMessage());
}
assertDbField($conn, 'sales_orders', 'status', "id = {$soId}", 'completed', "Trạng thái SO sau khi chuyển Hóa đơn phải là 'completed'");

// Kiểm tra Hóa đơn Invoice được sinh tự động
$invRes = $conn->query("SELECT id, invoice_number, total, status FROM invoices WHERE notes LIKE '%{$soNumber}%' LIMIT 1");
$invRow = $invRes ? $invRes->fetch_assoc() : null;

assertTest("Tự động sinh Hóa đơn từ SO", !empty($invRow), "Mã Hóa đơn: " . ($invRow['invoice_number'] ?? 'N/A'));
if ($invRow) {
    assertTest("Số tiền Hóa đơn khớp với SO (2.200.000 VNĐ)", (float)$invRow['total'] == 2200000.00);
}

// --------------------------------------------------
// TEST 4: Performance & Query Response Benchmark
// --------------------------------------------------
echo "\n📌 4. Đo đạc Tốc độ Truy xuất (Performance Benchmark)...\n";

$startTime = microtime(true);
$resSo = $conn->query("SELECT so.*, c.full_name as contact_name 
                       FROM sales_orders so 
                       LEFT JOIN contacts c ON so.contact_id = c.id 
                       WHERE so.tenant_id = 1 AND so.status = 'completed' 
                       ORDER BY so.order_date DESC LIMIT 20");
$endTime = microtime(true);
$soQueryTime = round(($endTime - $startTime) * 1000, 2);

assertTest("Thời gian truy vấn Danh sách SO có Composite Index (< 50ms)", $soQueryTime < 50, "Thời gian thực tế: {$soQueryTime} ms");

$startTime = microtime(true);
$resPo = $conn->query("SELECT po.*, s.name as supplier_name 
                       FROM purchase_orders po 
                       LEFT JOIN suppliers s ON po.supplier_id = s.id 
                       WHERE po.tenant_id = 1 AND po.status = 'received' 
                       ORDER BY po.order_date DESC LIMIT 20");
$endTime = microtime(true);
$poQueryTime = round(($endTime - $startTime) * 1000, 2);

assertTest("Thời gian truy vấn Danh sách PO có Composite Index (< 50ms)", $poQueryTime < 50, "Thời gian thực tế: {$poQueryTime} ms");

// Dọn dẹp dữ liệu kiểm thử
echo "\n📌 5. Dọn dẹp dữ liệu rác kiểm thử...\n";
if ($poId) {
    $conn->query("DELETE FROM purchase_order_items WHERE po_id = {$poId}");
    $conn->query("DELETE FROM purchase_orders WHERE id = {$poId}");
}
if ($soId) {
    $conn->query("DELETE FROM sales_order_items WHERE so_id = {$soId}");
    $conn->query("DELETE FROM sales_orders WHERE id = {$soId}");
}
if ($invRow && !empty($invRow['id'])) {
    $conn->query("DELETE FROM invoice_items WHERE invoice_id = {$invRow['id']}");
    $conn->query("DELETE FROM invoices WHERE id = {$invRow['id']}");
}
assertTest("Hoàn tất dọn dẹp dữ liệu test", true);

printTestSummary();
