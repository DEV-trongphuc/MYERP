<?php
// backend/test_po_multi_level_approval.php
// IDEAS ERP - Script Kiểm thử luồng Duyệt PO nhiều cấp

if (!class_exists('ResponseException')) {
    class ResponseException extends Exception {
        public $code;
        public $data;
        public $msg;
        public $success;
        public function __construct(int $code, $data, string $message, bool $success) {
            $this->code = $code;
            $this->data = $data;
            $this->msg = $message;
            $this->success = $success;
            parent::__construct($message, $code);
        }
    }
}

global $lastResponse;
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

if (!function_exists('getBody')) {
    function getBody(): array {
        global $mockBody;
        return $mockBody ?? [];
    }
}

if (!function_exists('logActivity')) {
    function logActivity($db, $tenantId, $userId, $action, $resourceType, $resourceId, $details = ''): void {
        // Mock logActivity
    }
}

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';

echo "====================================================\n";
echo "🚀 BẮT ĐẦU KIỂM THỬ: DUYỆT PO NHIỀU CẤP (UP TO 3 LEVELS)\n";
echo "====================================================\n\n";

$tenantId = 1;
// Lấy danh sách users để test
$userRes = $conn->query("SELECT id FROM users WHERE is_active = 1 LIMIT 3");
$users = [];
while ($row = $userRes->fetch_assoc()) {
    $users[] = (int)$row['id'];
}

// Nếu không đủ 3 user, lấy mặc định
$user1 = $users[0] ?? 100009;
$user2 = $users[1] ?? 100010;
$user3 = $users[2] ?? 100011;

echo "Dùng các tài khoản duyệt: Cấp 1 = {$user1}, Cấp 2 = {$user2}, Cấp 3 = {$user3}\n\n";

// Lấy hoặc tạo Supplier hợp lệ
$supRes = $conn->query("SELECT id FROM suppliers LIMIT 1");
if ($supRes && $supRes->num_rows > 0) {
    $supplierId = (int)$supRes->fetch_assoc()['id'];
} else {
    $conn->query("INSERT INTO suppliers (tenant_id, name, created_by) VALUES ({$tenantId}, 'Supplier Test PO Multi', {$user1})");
    $supplierId = $conn->insert_id;
}

$authCreator = [
    'user_id' => $user1,
    'tenant_id' => $tenantId,
    'role' => 'staff'
];

$poController = new PurchaseOrderController($pdo);

// ---------------------------------------------------------------------
// TEST 1: Tạo PO trên 5 triệu có 2 cấp duyệt (Cấp 1 & Cấp 2 bắt buộc)
// ---------------------------------------------------------------------
echo "📌 1. Tạo PO mới với tổng tiền trên 5 triệu (cần 2 cấp phê duyệt)...\n";
global $mockBody;
$mockBody = [
    'supplier_id' => $supplierId,
    'order_date' => date('Y-m-d'),
    'notes' => 'Test PO >= 5M (2 levels required)',
    'subtotal' => 5000000.00,
    'tax_rate' => 10,
    'tax' => 500000.00,
    'total' => 5500000.00,
    'approver_id' => $user1,
    'approver_id_2' => $user2,
    'approver_id_3' => null,
    'items' => [
        [
            'product_id' => null,
            'name' => 'Sản phẩm Test Cấp Duyệt trên 5tr',
            'quantity' => 1,
            'unit_cost' => 5000000.00,
            'subtotal' => 5000000.00
        ]
    ]
];

$poId1 = 0;
try {
    $poController->store($authCreator);
} catch (ResponseException $e) {
    echo "Tạo PO trả về Code: {$e->code}, Message: {$e->msg}\n";
    $poData = $e->data;
    $poId1 = $poData['id'] ?? 0;
}

assertTest("Khởi tạo PO trên 5M thành công", $poId1 > 0, "PO ID: " . $poId1);
assertDbField($conn, 'purchase_orders', 'status', "id = {$poId1}", 'pending_approval', 'Trạng thái PO ban đầu');
assertDbField($conn, 'purchase_orders', 'approval_status', "id = {$poId1}", 'pending', 'Trạng thái duyệt PO ban đầu');
assertDbField($conn, 'purchase_orders', 'status_level_1', "id = {$poId1}", 'pending', 'Trạng thái Cấp 1 ban đầu');
assertDbField($conn, 'purchase_orders', 'status_level_2', "id = {$poId1}", 'pending', 'Trạng thái Cấp 2 ban đầu');

// Thử nhập kho đơn hàng khi chưa được duyệt đầy đủ
$authWarehouse = [
    'user_id' => $user1,
    'tenant_id' => $tenantId,
    'role' => 'admin'
];

$receivedCode = 0;
try {
    $poController->receive($authWarehouse, $poId1);
} catch (ResponseException $e) {
    $receivedCode = $e->code;
}
assertTest("Chặn nhập kho khi chưa duyệt đủ 2 cấp (Trạng thái lỗi 422)", $receivedCode === 422, "Code: " . $receivedCode);

// Phê duyệt Cấp 1
$mockBody = ['status' => 'approved'];
$authAppr1 = ['user_id' => $user1, 'tenant_id' => $tenantId, 'role' => 'manager'];
try {
    $poController->approve($authAppr1, $poId1);
} catch (ResponseException $e) {}
assertDbField($conn, 'purchase_orders', 'status_level_1', "id = {$poId1}", 'approved', 'Cấp 1 phê duyệt thành công');
assertDbField($conn, 'purchase_orders', 'approval_status', "id = {$poId1}", 'pending', 'Tổng duyệt vẫn pending chờ Cấp 2');

// Phê duyệt Cấp 2
$authAppr2 = ['user_id' => $user2, 'tenant_id' => $tenantId, 'role' => 'manager'];
try {
    $poController->approve($authAppr2, $poId1);
} catch (ResponseException $e) {}
assertDbField($conn, 'purchase_orders', 'status_level_2', "id = {$poId1}", 'approved', 'Cấp 2 phê duyệt thành công');
assertDbField($conn, 'purchase_orders', 'approval_status', "id = {$poId1}", 'approved', 'Tổng duyệt đã approved thành công sau 2 cấp');
assertDbField($conn, 'purchase_orders', 'status', "id = {$poId1}", 'ordered', 'Trạng thái PO đã cập nhật thành ordered');

// Thực hiện nhập kho sau khi đã duyệt đầy đủ
$receiveSuccessCode = 0;
try {
    $poController->receive($authWarehouse, $poId1);
} catch (ResponseException $e) {
    $receiveSuccessCode = $e->code;
}
assertTest("Nhập kho thành công (Trạng thái code 200)", $receiveSuccessCode === 200, "Code: " . $receiveSuccessCode);


// ---------------------------------------------------------------------
// TEST 2: Tạo PO dưới 5 triệu chỉ có 1 cấp duyệt (Cấp 1 bắt buộc)
// ---------------------------------------------------------------------
echo "\n📌 2. Tạo PO dưới 5 triệu (chỉ cần 1 cấp phê duyệt)...\n";
$mockBody = [
    'supplier_id' => $supplierId,
    'order_date' => date('Y-m-d'),
    'notes' => 'Test PO < 5M (1 level required)',
    'subtotal' => 1000000.00,
    'tax_rate' => 10,
    'tax' => 100000.00,
    'total' => 1100000.00,
    'approver_id' => $user1,
    'approver_id_2' => null,
    'approver_id_3' => null,
    'items' => [
        [
            'product_id' => null,
            'name' => 'Sản phẩm Test Cấp Duyệt dưới 5tr',
            'quantity' => 1,
            'unit_cost' => 1000000.00,
            'subtotal' => 1000000.00
        ]
    ]
];

$poId2 = 0;
try {
    $poController->store($authCreator);
} catch (ResponseException $e) {
    $poData = $e->data;
    $poId2 = $poData['id'] ?? 0;
}

assertTest("Khởi tạo PO dưới 5M thành công", $poId2 > 0, "PO ID: " . $poId2);
assertDbField($conn, 'purchase_orders', 'status', "id = {$poId2}", 'pending_approval', 'Trạng thái PO ban đầu');
assertDbField($conn, 'purchase_orders', 'approval_status', "id = {$poId2}", 'pending', 'Trạng thái duyệt PO ban đầu');

// Phê duyệt Cấp 1 và tự động hoàn tất
$mockBody = ['status' => 'approved'];
try {
    $poController->approve($authAppr1, $poId2);
} catch (ResponseException $e) {}
assertDbField($conn, 'purchase_orders', 'status_level_1', "id = {$poId2}", 'approved', 'Cấp 1 phê duyệt thành công');
assertDbField($conn, 'purchase_orders', 'approval_status', "id = {$poId2}", 'approved', 'Tổng duyệt đã approved thành công chỉ sau 1 cấp');
assertDbField($conn, 'purchase_orders', 'status', "id = {$poId2}", 'ordered', 'Trạng thái PO đã cập nhật thành ordered');


// ---------------------------------------------------------------------
// TEST 3: Kiểm tra các case validation chặn lỗi
// ---------------------------------------------------------------------
echo "\n📌 3. Kiểm tra các trường hợp chặn lỗi (Validation block)...\n";

// A. PO trên 5 triệu nhưng thiếu Cấp 2
$mockBody = [
    'supplier_id' => $supplierId,
    'order_date' => date('Y-m-d'),
    'notes' => 'Test PO > 5M thiếu cấp 2',
    'subtotal' => 5000000.00,
    'tax_rate' => 10,
    'tax' => 500000.00,
    'total' => 5500000.00,
    'approver_id' => $user1,
    'approver_id_2' => null, // Thiếu cấp 2
    'items' => [
        [
            'product_id' => null,
            'name' => 'Sản phẩm Test Cấp Duyệt lỗi',
            'quantity' => 1,
            'unit_cost' => 5000000.00,
            'subtotal' => 5000000.00
        ]
    ]
];

$storeErrorCode1 = 0;
try {
    $poController->store($authCreator);
} catch (ResponseException $e) {
    $storeErrorCode1 = $e->code;
}
assertTest("Chặn tạo PO >= 5tr khi thiếu Cấp 2 thành công (Code 422)", $storeErrorCode1 === 422, "Code: " . $storeErrorCode1);

// B. PO dưới 5 triệu nhưng thiếu Cấp 1
$mockBody = [
    'supplier_id' => $supplierId,
    'order_date' => date('Y-m-d'),
    'notes' => 'Test PO < 5M thiếu cấp 1',
    'subtotal' => 1000000.00,
    'tax_rate' => 10,
    'tax' => 100000.00,
    'total' => 1100000.00,
    'approver_id' => null, // Thiếu cấp 1
    'items' => [
        [
            'product_id' => null,
            'name' => 'Sản phẩm Test Cấp Duyệt lỗi 2',
            'quantity' => 1,
            'unit_cost' => 1000000.00,
            'subtotal' => 1000000.00
        ]
    ]
];

$storeErrorCode2 = 0;
try {
    $poController->store($authCreator);
} catch (ResponseException $e) {
    $storeErrorCode2 = $e->code;
}
assertTest("Chặn tạo PO khi thiếu Cấp 1 thành công (Code 422)", $storeErrorCode2 === 422, "Code: " . $storeErrorCode2);

echo "\n";
printTestSummary();

