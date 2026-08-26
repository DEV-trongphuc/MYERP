<?php
// backend/test_e2e_all_approvals.php
// IDEAS ERP - Kịch bản Giả lập & Kiểm thử End-to-End toàn bộ 4 quy trình Phê duyệt nhiều cấp lớn

// Mock getBody trước khi require các file khác để tránh lỗi duplicate function
$mockBody = [];
if (!function_exists('getBody')) {
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

// Mock logActivity
if (!function_exists('logActivity')) {
    function logActivity($db, $tenantId, $userId, $action, $resourceType, $resourceId, $details = ''): void {
        // Mock logActivity
    }
}

// Mock logInteraction
if (!function_exists('logInteraction')) {
    function logInteraction($db, $tenantId, $userId, $type, $title, $body, $entityType, $entityId): void {
        // Mock logInteraction
    }
}

// Mock requireRole
if (!function_exists('requireRole')) {
    function requireRole(array $payload, array $roles): void {
        // Mock requireRole
    }
}

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/HRMController.php';
require_once __DIR__ . '/controllers/FinanceController.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';

// Dọn dẹp dữ liệu nháp của test debug trước đó
$pdo->prepare("DELETE FROM hrm_leave_requests WHERE reason = 'Test E2E Approvals'")->execute();

echo "====================================================\n";
echo "🚀 BẮT ĐẦU GIẢ LẬP E2E TOÀN BỘ CÁC QUY TRÌNH PHÊ DUYỆT\n";
echo "====================================================\n\n";

$tenantId = 1;
// Lấy danh sách users hoạt động làm dữ liệu kiểm thử
$userRes = $conn->query("SELECT id, role FROM users WHERE is_active = 1 LIMIT 3");
$users = [];
while ($row = $userRes->fetch_assoc()) {
    $users[] = [
        'id' => (int)$row['id'],
        'role' => $row['role']
    ];
}

$user1 = $users[0]['id'] ?? 100009;
$user2 = $users[1]['id'] ?? 100010;
$user3 = $users[2]['id'] ?? 100011;

$authCreator = ['user_id' => $user1, 'tenant_id' => $tenantId, 'role' => 'staff'];
$authAppr1 = ['user_id' => $user1, 'tenant_id' => $tenantId, 'role' => 'manager'];
$authAppr2 = ['user_id' => $user2, 'tenant_id' => $tenantId, 'role' => 'accountant'];
$authAppr3 = ['user_id' => $user3, 'tenant_id' => $tenantId, 'role' => 'director'];

echo "[SETUP] Người đề xuất: {$user1} | Duyệt C1: {$user1} | Duyệt C2: {$user2} | Duyệt C3: {$user3}\n\n";

$hrmCtrl = new HRMController($pdo);
$finCtrl = new FinanceController($pdo);
$poCtrl = new PurchaseOrderController($pdo);

// =====================================================================
// QUY TRÌNH 1: ĐƠN NGHỈ PHÉP (LEAVE REQUEST) - 2 CẤP DUYỆT
// =====================================================================
echo "----------------------------------------------------\n";
echo "☘️ QUY TRÌNH 1: GIẢ LẬP ĐƠN NGHỈ PHÉP 2 CẤP DUYỆT\n";
echo "----------------------------------------------------\n";

global $mockBody, $throwOnRespond, $lastResponse;
$mockBody = [
    'leave_type' => 'annual',
    'start_date' => date('Y-m-d') . ' 08:00:00',
    'end_date' => date('Y-m-d') . ' 17:30:00',
    'from_date' => date('Y-m-d') . ' 08:00:00',
    'to_date' => date('Y-m-d') . ' 17:30:00',
    'total_days' => 1.0,
    'reason' => 'Nghỉ giải quyết việc gia đình E2E',
    'approver_id' => $user1,
    'approver_id_2' => $user2
];

$throwOnRespond = false;
$lastResponse = null;
try {
    $hrmCtrl->createLeave($authCreator);
} catch (\Throwable $e) {
    echo "LỖI HỆ THỐNG LEAVE: " . $e->getMessage() . "\n";
}

$leaveId = (int)$pdo->query("SELECT id FROM hrm_leave_requests WHERE user_id = {$user1} AND reason = 'Nghỉ giải quyết việc gia đình E2E' ORDER BY id DESC LIMIT 1")->fetchColumn();
assertTest("Tạo đơn nghỉ phép thành công (Code 200)", ($lastResponse['code'] ?? 0) === 200 && $leaveId > 0, "Leave ID: " . $leaveId);
if ($leaveId > 0) {
    assertDbField($conn, 'hrm_leave_requests', 'status', "id = {$leaveId}", 'pending', 'Trạng thái ban đầu');
    assertDbField($conn, 'hrm_leave_requests', 'status_level_1', "id = {$leaveId}", 'pending', 'Cấp 1 trạng thái pending');
    assertDbField($conn, 'hrm_leave_requests', 'status_level_2', "id = {$leaveId}", 'pending', 'Cấp 2 trạng thái pending');

    // Cấp 1 Duyệt
    $mockBody = ['id' => $leaveId, 'status' => 'approved'];
    $lastResponse = null;
    try {
        $hrmCtrl->approveLeave($authAppr1);
    } catch (\Throwable $e) {
        echo "LỖI C1 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 1 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'hrm_leave_requests', 'status_level_1', "id = {$leaveId}", 'approved', 'Cấp 1 phê duyệt thành công');
    assertDbField($conn, 'hrm_leave_requests', 'status', "id = {$leaveId}", 'pending', 'Tổng duyệt vẫn pending chờ cấp 2');

    // Cấp 2 Duyệt -> Hoàn tất
    $mockBody = ['id' => $leaveId, 'status' => 'approved'];
    $lastResponse = null;
    try {
        $hrmCtrl->approveLeave($authAppr2);
    } catch (\Throwable $e) {
        echo "LỖI C2 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 2 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'hrm_leave_requests', 'status_level_2', "id = {$leaveId}", 'approved', 'Cấp 2 phê duyệt thành công');
    assertDbField($conn, 'hrm_leave_requests', 'status', "id = {$leaveId}", 'approved', 'Tổng duyệt đã hoàn tất thành công');

    // Dọn dẹp
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE id = ?")->execute([$leaveId]);
}


// =====================================================================
// QUY TRÌNH 2: TẠM ỨNG LƯƠNG (SALARY ADVANCE) - 2 CẤP DUYỆT
// =====================================================================
echo "\n----------------------------------------------------\n";
echo "💰 QUY TRÌNH 2: GIẢ LẬP ĐƠN TẠM ỨNG LƯƠNG 2 CẤP DUYỆT\n";
echo "----------------------------------------------------\n";

$mockBody = [
    'amount' => 5000000.00,
    'reason' => 'Tạm ứng chi phí văn phòng E2E',
    'approver_id' => $user1,
    'approver_id_2' => $user2
];

$lastResponse = null;
try {
    $hrmCtrl->createAdvance($authCreator);
} catch (\Throwable $e) {
    echo "LỖI HỆ THỐNG ADVANCE: " . $e->getMessage() . "\n";
}

$advId = (int)$pdo->query("SELECT id FROM hrm_salary_advances WHERE user_id = {$user1} AND reason = 'Tạm ứng chi phí văn phòng E2E' ORDER BY id DESC LIMIT 1")->fetchColumn();
assertTest("Tạo đề nghị tạm ứng thành công (Code 200)", ($lastResponse['code'] ?? 0) === 200 && $advId > 0, "Advance ID: " . $advId);
if ($advId > 0) {
    assertDbField($conn, 'hrm_salary_advances', 'status', "id = {$advId}", 'pending', 'Trạng thái ban đầu');
    assertDbField($conn, 'hrm_salary_advances', 'status_level_1', "id = {$advId}", 'pending', 'Cấp 1 trạng thái pending');
    assertDbField($conn, 'hrm_salary_advances', 'status_level_2', "id = {$advId}", 'pending', 'Cấp 2 trạng thái pending');

    // Cấp 1 Duyệt
    $mockBody = ['id' => $advId, 'status' => 'approved'];
    $lastResponse = null;
    try {
        $hrmCtrl->approveAdvance($authAppr1);
    } catch (\Throwable $e) {
        echo "LỖI C1 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 1 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'hrm_salary_advances', 'status_level_1', "id = {$advId}", 'approved', 'Cấp 1 phê duyệt thành công');
    assertDbField($conn, 'hrm_salary_advances', 'status', "id = {$advId}", 'pending', 'Tổng duyệt vẫn pending chờ cấp 2');

    // Cấp 2 Duyệt -> Hoàn tất
    $mockBody = ['id' => $advId, 'status' => 'approved'];
    $lastResponse = null;
    try {
        $hrmCtrl->approveAdvance($authAppr2);
    } catch (\Throwable $e) {
        echo "LỖI C2 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 2 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'hrm_salary_advances', 'status_level_2', "id = {$advId}", 'approved', 'Cấp 2 phê duyệt thành công');
    assertDbField($conn, 'hrm_salary_advances', 'status', "id = {$advId}", 'approved', 'Tổng duyệt đã hoàn tất thành công');

    // Dọn dẹp
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE id = ?")->execute([$advId]);
}


// =====================================================================
// QUY TRÌNH 3: ĐỀ XUẤT CHI PHÍ / THANH TOÁN (EXPENSES) - 3 CẤP DUYỆT
// =====================================================================
echo "\n----------------------------------------------------\n";
echo "📊 QUY TRÌNH 3: GIẢ LẬP ĐỀ XUẤT THANH TOÁN 3 CẤP DUYỆT\n";
echo "----------------------------------------------------\n";

$mockBody = [
    'title' => 'Đề xuất thanh toán Hosting E2E',
    'amount' => 15000000.00, // 15 triệu (lớn hơn threshold 5M)
    'approver_id' => $user1,
    'approver_id_2' => $user2,
    'approver_id_3' => $user3,
    'category' => 'Vận hành',
    'status' => 'pending'
];

$lastResponse = null;
try {
    $finCtrl->createExpense($authCreator);
} catch (\Throwable $e) {
    echo "LỖI HỆ THỐNG EXPENSE: " . $e->getMessage() . "\n";
}

$expId = (int)$pdo->query("SELECT id FROM expenses WHERE created_by = {$user1} AND title = 'Đề xuất thanh toán Hosting E2E' ORDER BY id DESC LIMIT 1")->fetchColumn();
assertTest("Tạo đề xuất thanh toán hosting thành công (Code 200)", ($lastResponse['code'] ?? 0) === 200 && $expId > 0, "Expense ID: " . $expId);
if ($expId > 0) {
    assertDbField($conn, 'expenses', 'status', "id = {$expId}", 'pending', 'Trạng thái ban đầu');
    assertDbField($conn, 'expenses', 'status_level_1', "id = {$expId}", 'pending', 'Cấp 1 trạng thái pending');
    assertDbField($conn, 'expenses', 'status_level_2', "id = {$expId}", 'pending', 'Cấp 2 trạng thái pending');
    assertDbField($conn, 'expenses', 'status_level_3', "id = {$expId}", 'pending', 'Cấp 3 trạng thái pending');

    // Cấp 1 Duyệt
    $mockBody = ['status' => 'approved'];
    $lastResponse = null;
    try {
        $finCtrl->approveExpense($authAppr1, $expId);
    } catch (\Throwable $e) {
        echo "LỖI C1 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 1 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'expenses', 'status_level_1', "id = {$expId}", 'approved', 'Cấp 1 phê duyệt thành công');
    assertDbField($conn, 'expenses', 'approval_status', "id = {$expId}", 'pending', 'Tổng duyệt vẫn pending chờ cấp 2');

    // Cấp 2 Duyệt
    $lastResponse = null;
    try {
        $finCtrl->approveExpense($authAppr2, $expId);
    } catch (\Throwable $e) {
        echo "LỖI C2 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 2 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'expenses', 'status_level_2', "id = {$expId}", 'approved', 'Cấp 2 phê duyệt thành công');
    assertDbField($conn, 'expenses', 'approval_status', "id = {$expId}", 'pending', 'Tổng duyệt vẫn pending chờ cấp 3');

    // Cấp 3 Duyệt -> Hoàn tất
    $lastResponse = null;
    try {
        $finCtrl->approveExpense($authAppr3, $expId);
    } catch (\Throwable $e) {
        echo "LỖI C3 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 3 duyệt trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'expenses', 'status_level_3', "id = {$expId}", 'approved', 'Cấp 3 phê duyệt thành công');
    assertDbField($conn, 'expenses', 'status', "id = {$expId}", 'approved', 'Tổng trạng thái đã approved thành công');
    assertDbField($conn, 'expenses', 'approval_status', "id = {$expId}", 'approved', 'Tổng duyệt đã hoàn tất thành công');

    // Dọn dẹp
    $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$expId]);
}


// =====================================================================
// QUY TRÌNH 4: ĐƠN NHẬP HÀNG (PURCHASE ORDERS) - 2 CẤP DUYỆT + NHẬP KHO
// =====================================================================
echo "\n----------------------------------------------------\n";
echo "🛒 QUY TRÌNH 4: GIẢ LẬP ĐƠN NHẬP HÀNG (PO) 2 CẤP DUYỆT & NHẬP KHO\n";
echo "----------------------------------------------------\n";

// Lấy hoặc tạo Supplier hợp lệ
$supRes = $conn->query("SELECT id FROM suppliers LIMIT 1");
if ($supRes && $supRes->num_rows > 0) {
    $supplierId = (int)$supRes->fetch_assoc()['id'];
} else {
    $conn->query("INSERT INTO suppliers (tenant_id, name, created_by) VALUES ({$tenantId}, 'Supplier Test PO Multi', {$user1})");
    $supplierId = $conn->insert_id;
}

$mockBody = [
    'supplier_id' => $supplierId,
    'order_date' => date('Y-m-d'),
    'notes' => 'E2E Test PO Multi levels approvals',
    'subtotal' => 6000000.00,
    'tax_rate' => 10,
    'tax' => 600000.00,
    'total' => 6600000.00, // 6.6M (lớn hơn threshold 5M)
    'approver_id' => $user1,
    'approver_id_2' => $user2,
    'items' => [
        [
            'product_id' => null,
            'name' => 'Sản phẩm E2E Test',
            'quantity' => 1,
            'unit_cost' => 6000000.00,
            'subtotal' => 6000000.00
        ]
    ]
];

$lastResponse = null;
try {
    $poCtrl->store($authCreator);
} catch (\Throwable $e) {
    echo "LỖI HỆ THỐNG PO: " . $e->getMessage() . "\n";
}

$poId = (int)$pdo->query("SELECT id FROM purchase_orders WHERE created_by = {$user1} AND notes = 'E2E Test PO Multi levels approvals' ORDER BY id DESC LIMIT 1")->fetchColumn();
assertTest("Tạo đơn mua sắm PO thành công (Code 200)", ($lastResponse['code'] ?? 0) === 200 && $poId > 0, "PO ID: " . $poId);
if ($poId > 0) {
    assertDbField($conn, 'purchase_orders', 'status', "id = {$poId}", 'pending_approval', 'Trạng thái PO ban đầu');
    assertDbField($conn, 'purchase_orders', 'status_level_1', "id = {$poId}", 'pending', 'Cấp 1 trạng thái pending');
    assertDbField($conn, 'purchase_orders', 'status_level_2', "id = {$poId}", 'pending', 'Cấp 2 trạng thái pending');

    // Cấp 1 Duyệt
    $mockBody = ['status' => 'approved'];
    $lastResponse = null;
    try {
        $poCtrl->approve($authAppr1, $poId);
    } catch (\Throwable $e) {
        echo "LỖI C1 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 1 duyệt PO trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'purchase_orders', 'status_level_1', "id = {$poId}", 'approved', 'Cấp 1 phê duyệt thành công');
    assertDbField($conn, 'purchase_orders', 'approval_status', "id = {$poId}", 'pending', 'Tổng duyệt PO vẫn pending chờ cấp 2');

    // Cấp 2 Duyệt -> Chuyển sang trạng thái ordered
    $lastResponse = null;
    try {
        $poCtrl->approve($authAppr2, $poId);
    } catch (\Throwable $e) {
        echo "LỖI C2 APPROVE: " . $e->getMessage() . "\n";
    }
    assertTest("Cấp 2 duyệt PO trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'purchase_orders', 'status_level_2', "id = {$poId}", 'approved', 'Cấp 2 phê duyệt thành công');
    assertDbField($conn, 'purchase_orders', 'status', "id = {$poId}", 'ordered', 'Trạng thái PO đã chuyển sang ordered');

    // Giả lập nhập kho
    $lastResponse = null;
    try {
        $poCtrl->receive($authAppr1, $poId);
    } catch (\Throwable $e) {
        echo "LỖI RECEIVE: " . $e->getMessage() . "\n";
    }
    assertTest("Nhập kho trả về Code 200", ($lastResponse['code'] ?? 0) === 200);
    assertDbField($conn, 'purchase_orders', 'status', "id = {$poId}", 'received', 'Đơn PO nhập kho thành công');

    // Dọn dẹp
    $pdo->prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?")->execute([$poId]);
    $pdo->prepare("DELETE FROM purchase_orders WHERE id = ?")->execute([$poId]);
}

// Khôi phục lại trạng thái mặc định
$throwOnRespond = true;

echo "\n";
printTestSummary();
echo "====================================================\n";
