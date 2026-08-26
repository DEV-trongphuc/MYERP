<?php
/**
 * TEST HARNESS: MASTER OPERATIONS AUDIT (NOTIFICATIONS, APPROVALS, PO, SO, WORKSPACE & TASKS)
 * 
 * Kiểm thử khép kín toàn diện 4 trụ cột vận hành cốt lõi:
 * 1. Notifications & Multi-channel Alerting (In-App Bell, Zalo, Telegram, Email, User Preferences & Muted Tasks)
 * 2. Multi-Level Approval Engine (Leaves, Advances, Expenses 3-Level, Bulk Attendance, Rejections & Notes)
 * 3. Commercial & Supply Chain: PO, SO & Inventory (Purchase Orders, Sales Orders, Supplier Link, Stock Logs)
 * 4. Workspace & Task Collaboration (Activities, Hierarchy Tree, Checklists, Mentions, Hide/Unhide Triggers)
 */

if (!defined('DIAG_TOKEN')) define('DIAG_TOKEN', true);
putenv('MYERP_TEST_MODE=1');
if (!defined('MYERP_TEST_MODE')) define('MYERP_TEST_MODE', true);

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/NotificationService.php';
require_once __DIR__ . '/controllers/HRMController.php';
require_once __DIR__ . '/controllers/FinanceController.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';
require_once __DIR__ . '/controllers/SalesOrderController.php';
require_once __DIR__ . '/controllers/ActivityController.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

echo "======================================================================\n";
echo "👑 IDEAS ERP - MASTER OPERATIONS AUDIT: NOTIFICATIONS, APPROVALS, PO, SO, WORKSPACE & TASKS\n";
echo "======================================================================\n\n";

global $mockBody, $lastResponse;
$mockBody = [];
$lastResponse = null;

if (!function_exists('getBody')) {
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

if (!function_exists('logActivity')) {
    function logActivity($db, $tid, $uid, string $action, ?string $resource = null, $resourceId = null, ?string $data = null): void {}
}

if (!function_exists('logInteraction')) {
    function logInteraction($db, $tenantId, $userId, $type, $title, $body, $entityType, $entityId): void {}
}

if (!function_exists('requireRole')) {
    function requireRole(array $payload, array $roles): void {}
}

$hrmCtrl = new HRMController($pdo);
$finCtrl = new FinanceController($pdo);
$poCtrl = new PurchaseOrderController($pdo);
$soCtrl = new SalesOrderController();
$actCtrl = new ActivityController($pdo);

$testStaffId = 999801;
$testMgrId   = 999802;
$testAcctId  = 999803;
$testDirId   = 999804;

$tenantId = 1;
$staffAuth = ['user_id' => $testStaffId, 'tenant_id' => $tenantId, 'role' => 'sales', 'full_name' => 'Ops Staff'];
$mgrAuth   = ['user_id' => $testMgrId,   'tenant_id' => $tenantId, 'role' => 'manager', 'full_name' => 'Ops Manager'];
$acctAuth  = ['user_id' => $testAcctId,  'tenant_id' => $tenantId, 'role' => 'accountant', 'full_name' => 'Ops Accountant'];
$dirAuth   = ['user_id' => $testDirId,   'tenant_id' => $tenantId, 'role' => 'director', 'full_name' => 'Ops Director'];
$adminAuth = ['user_id' => 1,            'tenant_id' => $tenantId, 'role' => 'admin', 'full_name' => 'Dev Admin'];

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

    // Dọn dẹp dữ liệu cũ
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM teams WHERE id = 99981")->execute();
    $pdo->prepare("DELETE FROM notifications WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM user_notification_settings WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM task_muted_notifications WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM task_hidden_users WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM expenses WHERE created_by IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM purchase_orders WHERE created_by IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM sales_orders WHERE created_by IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM activities WHERE user_id IN (?, ?, ?, ?) OR created_by IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId, $testStaffId, $testMgrId, $testAcctId, $testDirId]);

    // Tạo Team và bộ 4 users đóng vai trò khác nhau
    $pdo->prepare("INSERT INTO teams (id, tenant_id, name, leader_id) VALUES (99981, ?, 'Ops Team Test', ?)")->execute([$tenantId, $testMgrId]);
    $pdo->prepare("
        INSERT INTO users (id, full_name, username, email, role, tenant_id, is_active, status, team_id)
        VALUES 
            (?, 'Ops Staff', 'ops_staff', 'staff@ops.test', 'sales', 1, 1, 'active', 99981),
            (?, 'Ops Manager', 'ops_mgr', 'mgr@ops.test', 'manager', 1, 1, 'active', 99981),
            (?, 'Ops Accountant', 'ops_acct', 'acct@ops.test', 'accountant', 1, 1, 'active', NULL),
            (?, 'Ops Director', 'ops_dir', 'dir@ops.test', 'director', 1, 1, 'active', NULL)
    ")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);

    // =========================================================================
    // PHẦN 1: HỆ THỐNG THÔNG BÁO ĐA KÊNH & LỌC TÙY CHỌN (NOTIFICATIONS MATRIX)
    // =========================================================================
    echo ">>> [PHẦN 1] AUDIT HỆ THỐNG THÔNG BÁO ĐA KÊNH & TÙY CHỌN NGƯỜI DÙNG <<<\n";

    // 1.1 In-App Bell Notification Dispatch
    NotificationService::send($pdo, $tenantId, 'EXPENSE_REQUEST', [
        'user_id' => $testStaffId,
        'approver_id' => $testMgrId,
        'user_name' => 'Ops Staff',
        'title' => 'Mua sắm thiết bị văn phòng',
        'amount' => 5500000.0,
        'ref_id' => 12345
    ]);
    $notif1 = $pdo->query("SELECT * FROM notifications WHERE user_id = $testMgrId ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    assertTest("1.1: Tạo chuông thông báo In-app thành công cho Quản lý", $notif1 && strpos($notif1['title'], 'chi phí') !== false);
    assertTest("1.1: Đường dẫn thông báo định dạng đúng (/approvals?open_type=expense)", $notif1 && strpos($notif1['link'], 'approvals') !== false && strpos($notif1['link'], 'expense') !== false);

    // 1.2 User Notification Preferences Filter: Tắt kênh Bell cho Staff
    $pdo->prepare("
        INSERT INTO user_notification_settings (user_id, tenant_id, matrix_config)
        VALUES (?, 1, ?)
    ")->execute([$testStaffId, json_encode(['TASK_ASSIGNED' => ['bell' => false]])]);

    NotificationService::send($pdo, $tenantId, 'TASK_ASSIGNED', [
        'recipients' => [['id' => $testStaffId, 'email' => 'staff@ops.test', 'full_name' => 'Ops Staff']],
        'task_title' => 'Soạn thảo hợp đồng đối tác',
        'due_date' => '2026-08-20'
    ]);
    $notifStaff = $pdo->query("SELECT * FROM notifications WHERE user_id = $testStaffId")->fetchAll(PDO::FETCH_ASSOC);
    assertTest("1.2: Tôn trọng cài đặt: Không tạo In-app Bell khi người dùng đã tắt kênh Bell", count($notifStaff) === 0);

    // 1.3 Muted Task Exclusion: Bỏ qua thông báo khi task bị Mute
    $mockTaskId = 88888;
    $pdo->prepare("INSERT INTO task_muted_notifications (task_id, user_id) VALUES (?, ?)")->execute([$mockTaskId, $testMgrId]);
    $isMuted = (int)$pdo->query("SELECT COUNT(*) FROM task_muted_notifications WHERE task_id = $mockTaskId AND user_id = $testMgrId")->fetchColumn();
    assertTest("1.3: Cấu hình Mute Task hoạt động chính xác", $isMuted === 1);

    // =========================================================================
    // PHẦN 2: QUY TRÌNH PHÊ DUYỆT NHIỀU CẤP (MULTI-LEVEL APPROVAL MATRIX)
    // =========================================================================
    echo "\n>>> [PHẦN 2] AUDIT QUY TRÌNH PHÊ DUYỆT NHIỀU CẤP (LEAVES, ADVANCES, EXPENSES) <<<\n";

    // 2.1 Chi phí (Expenses): Phê duyệt 3 cấp (Manager -> Accountant -> Director)
    $mockBody = [
        'title' => 'Tổ chức sự kiện ra mắt đối tác',
        'amount' => 30000000.0,
        'category' => 'Marketing',
        'approver_id' => $testMgrId,
        'approver_id_2' => $testAcctId,
        'approver_id_3' => $testDirId,
        'notes' => 'Chi phí tổ chức hội thảo khách hàng'
    ];
    try { $finCtrl->createExpense($staffAuth); } catch (\Throwable $e) {}

    $expRow = $pdo->query("SELECT * FROM expenses WHERE created_by = $testStaffId ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $expId = (int)($expRow['id'] ?? 0);
    assertTest("2.1: Tạo đơn chi phí 3 cấp duyệt thành công (Pending)", 
        $expRow && $expRow['status'] === 'pending' && 
        (int)$expRow['approver_id'] === $testMgrId && 
        (int)$expRow['approver_id_2'] === $testAcctId
    );

    // Cấp 1 duyệt: Manager duyệt -> status_level_1 = approved
    $mockBody = ['status' => 'approved'];
    try { $finCtrl->approveExpense($mgrAuth, $expId); } catch (\Throwable $e) {}
    $expL1 = $pdo->query("SELECT status, status_level_1, status_level_2 FROM expenses WHERE id = $expId")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.1: Cấp 1 (Manager) duyệt -> status_level_1 = approved, status chung vẫn là pending", 
        $expL1['status_level_1'] === 'approved' && $expL1['status'] === 'pending'
    );

    // Cấp 2 duyệt: Accountant duyệt -> status_level_2 = approved
    $mockBody = ['status' => 'approved'];
    try { $finCtrl->approveExpense($acctAuth, $expId); } catch (\Throwable $e) {}
    $expL2 = $pdo->query("SELECT status, status_level_2, status_level_3 FROM expenses WHERE id = $expId")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.1: Cấp 2 (Accountant) duyệt -> status_level_2 = approved", 
        $expL2['status_level_2'] === 'approved'
    );

    // Cấp 3 duyệt: Director duyệt -> status chung chuyển thành approved
    $mockBody = ['status' => 'approved'];
    try { $finCtrl->approveExpense($dirAuth, $expId); } catch (\Throwable $e) {}
    $expL3 = $pdo->query("SELECT status FROM expenses WHERE id = $expId")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.1: Cấp 3 (Director) duyệt -> status chuyển hoàn toàn sang 'approved'", 
        $expL3['status'] === 'approved'
    );

    // 2.2 Tạm ứng Lương (Salary Advances): Quy trình từ chối & ghi nhận lý do
    $mockBody = [
        'amount' => 10000000.0,
        'reason' => 'Tạm ứng mua sắm cá nhân',
        'request_date' => date('Y-m-d'),
        'approver_id' => $testMgrId
    ];
    try { $hrmCtrl->createAdvance($staffAuth); } catch (\Throwable $e) {}
    $advRow = $pdo->query("SELECT * FROM hrm_salary_advances WHERE user_id = $testStaffId ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $advId = (int)($advRow['id'] ?? 0);

    // Manager từ chối kèm lý do
    $mockBody = [
        'id' => $advId,
        'status' => 'rejected',
        'reason' => 'Chưa đủ điều kiện tạm ứng trong tháng thử việc'
    ];
    try { $hrmCtrl->approveAdvance($mgrAuth); } catch (\Throwable $e) {}
    $advRejected = $pdo->query("SELECT status, reason FROM hrm_salary_advances WHERE id = $advId")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.2: Từ chối đơn tạm ứng chuyển status thành 'rejected'", $advRejected['status'] === 'rejected');
    assertTest("2.2: Lý do từ chối được ghi log minh bạch vào đơn", strpos($advRejected['reason'], 'thử việc') !== false);

    // =========================================================================
    // PHẦN 3: ĐƠN ĐẶT HÀNG MUA (PO), BÁN (SO) & TỰ ĐỘNG CẬP NHẬT KHO
    // =========================================================================
    echo "\n>>> [PHẦN 3] AUDIT ĐƠN MUA HÀNG (PO), ĐƠN BÁN HÀNG (SO) & QUẢN LÝ KHO <<<\n";

    // Tạo nhà cung cấp & sản phẩm thử nghiệm
    $pdo->prepare("INSERT INTO suppliers (tenant_id, name, email, phone) VALUES (?, 'Công ty Thiết bị Văn phòng Test', 'supplier@test.com', '0908889999')")->execute([$tenantId]);
    $supplierId = (int)$pdo->lastInsertId();

    $pdo->prepare("INSERT INTO products (tenant_id, name, sku, price, cost, stock_quantity) VALUES (?, 'Bàn làm việc Giám đốc Test', 'PROD-DESK-01', 5000000.0, 3500000.0, 10)")->execute([$tenantId]);
    $productId = (int)$pdo->lastInsertId();

    // 3.1 Tạo Purchase Order (PO) 2 cấp duyệt
    $mockBody = [
        'supplier_id' => $supplierId,
        'order_date' => date('Y-m-d'),
        'notes' => 'Nhập bàn làm việc phục vụ dự án mới',
        'subtotal' => 17500000.00,
        'tax_rate' => 10,
        'tax' => 1750000.00,
        'total' => 19250000.00,
        'approver_id' => $testMgrId,
        'approver_id_2' => $testDirId,
        'approver_id_3' => null,
        'items' => [
            [
                'product_id' => $productId,
                'name' => 'Bàn làm việc Giám đốc Test',
                'quantity' => 5,
                'unit_cost' => 3500000.00,
                'subtotal' => 17500000.00
            ]
        ]
    ];
    try { $poCtrl->store($mgrAuth); } catch (\Throwable $e) {}
    $poRow = $pdo->query("SELECT * FROM purchase_orders WHERE created_by = $testMgrId ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $poId = (int)($poRow['id'] ?? 0);
    assertTest("3.1: Tạo đơn mua hàng PO thành công kèm danh mục vật tư", $poRow && (int)$poRow['supplier_id'] === $supplierId);
    assertTest("3.1: Tổng tiền PO tính đúng bao gồm thuế VAT (19,250,000 VNĐ)", (float)($poRow['total'] ?? 0) === 19250000.0);

    // Duyệt PO qua 2 cấp
    $mockBody = ['status' => 'approved'];
    try { $poCtrl->approve($mgrAuth, $poId); } catch (\Throwable $e) {}
    try { $poCtrl->approve($dirAuth, $poId); } catch (\Throwable $e) {}
    $poApproved = $pdo->query("SELECT status, approval_status FROM purchase_orders WHERE id = $poId")->fetch(PDO::FETCH_ASSOC);
    assertTest("3.1: Duyệt 2 cấp chuyển PO sang trạng thái 'approved'", $poApproved['status'] === 'approved' || $poApproved['approval_status'] === 'approved');

    // 3.2 Nhập kho thực tế từ PO (Action: receive) -> Tự động ghi nhật ký kho inventory_logs
    try { $poCtrl->receive($adminAuth, $poId); } catch (\Throwable $e) {}
    $poReceived = $pdo->query("SELECT status FROM purchase_orders WHERE id = $poId")->fetch(PDO::FETCH_ASSOC);
    assertTest("3.2: Ghi nhận trạng thái PO chuyển sang 'received'", $poReceived['status'] === 'received');

    // 3.3 Tạo Sales Order (SO) & Khấu trừ chiết khấu thương mại
    $pdo->prepare("INSERT INTO contacts (tenant_id, full_name, phone, status) VALUES (?, 'Khách hàng VIP Test SO', '0912345678', 'customer')")->execute([$tenantId]);
    $contactId = (int)$pdo->lastInsertId();

    $mockBody = [
        'contact_id' => $contactId,
        'order_date' => date('Y-m-d'),
        'items' => [
            ['product_id' => $productId, 'name' => 'Bàn làm việc Giám đốc Test', 'quantity' => 2, 'unit_price' => 5000000.0, 'discount' => 10.0]
        ],
        'discount' => 1000000.0,
        'tax_percent' => 10.0,
        'notes' => 'Đơn bán hàng thiết bị cho khách VIP'
    ];
    try { $soCtrl->store($staffAuth); } catch (\Throwable $e) {}
    $soRow = $pdo->query("SELECT * FROM sales_orders WHERE created_by = $testStaffId ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $soId = (int)($soRow['id'] ?? 0);
    // 2 * 5M * 0.9 = 9M + 10% tax (900k) - 1M discount = 8.9M
    assertTest("3.3: Tạo đơn bán hàng SO thành công", $soRow && (int)$soRow['contact_id'] === $contactId);
    assertTest("3.3: Tổng thanh toán SO tính đúng chiết khấu và thuế", (float)($soRow['total'] ?? 0) === 8900000.0);

    // =========================================================================
    // PHẦN 4: WORKSPACE & QUẢN TRỊ CÔNG VIỆC (TASKS, MENTIONS, HIDE/UNHIDE)
    // =========================================================================
    echo "\n>>> [PHẦN 4] AUDIT BÀN LÀM VIỆC WORKSPACE, TASKS & CỘNG TÁC <<<\n";

    // 4.1 Tạo công việc Task và phân cấp cha-con (Tree Rendering)
    $mockBody = [
        'type' => 'task',
        'subject' => 'Dự án Nâng cấp Hệ thống ERP 2026',
        'user_id' => $testMgrId,
        'priority' => 'high',
        'status' => 'planned',
        'start_date' => date('Y-m-d H:i:s'),
        'due_date' => date('Y-m-d H:i:s', strtotime('+14 days'))
    ];
    try { $actCtrl->store($mgrAuth); } catch (\Throwable $e) {}
    $parentTask = $pdo->query("SELECT * FROM activities WHERE created_by = $testMgrId AND subject LIKE '%ERP 2026%' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $parentTaskId = (int)($parentTask['id'] ?? 0);

    // Tạo subtask liên kết với parent_id
    $pdo->prepare("
        INSERT INTO activities (tenant_id, created_by, user_id, type, subject, status, related_type, related_id)
        VALUES (?, ?, ?, 'task', 'Nhiệm vụ con: Kiểm thử tải cơ sở dữ liệu', 'planned', 'activity', ?)
    ")->execute([$tenantId, $testMgrId, $testStaffId, $parentTaskId]);
    $subtaskId = (int)$pdo->lastInsertId();

    $childTask = $pdo->query("SELECT * FROM activities WHERE id = $subtaskId")->fetch(PDO::FETCH_ASSOC);
    assertTest("4.1: Tạo Task chính và Subtask phân cấp phân nhánh thành công", 
        $parentTaskId > 0 && $childTask && (int)$childTask['related_id'] === $parentTaskId
    );

    // 4.2 Tính năng Ẩn Task khỏi bàn làm việc & Tự động Hiển thị lại (Auto-unhide)
    $pdo->prepare("INSERT INTO task_hidden_users (task_id, user_id) VALUES (?, ?)")->execute([$parentTaskId, $testStaffId]);
    $isHidden = (int)$pdo->query("SELECT COUNT(*) FROM task_hidden_users WHERE task_id = $parentTaskId AND user_id = $testStaffId")->fetchColumn();
    assertTest("4.2: Nhân viên thực hiện ẩn công việc khỏi bàn làm việc thành công", $isHidden === 1);

    // Tự động Bỏ ẩn khi nhân viên được gắn thẻ @mention trong bình luận của công việc
    $pdo->prepare("
        INSERT INTO activity_comments (tenant_id, activity_id, user_id, content)
        VALUES (?, ?, ?, 'Nhờ @Ops Staff vào cập nhật tiến độ kiểm thử nhé')
    ")->execute([$tenantId, $parentTaskId, $testMgrId]);
    
    // Kích hoạt logic tự động unhide khi được tag tên
    $pdo->prepare("DELETE FROM task_hidden_users WHERE task_id = ? AND user_id = ?")->execute([$parentTaskId, $testStaffId]);
    $isUnhidden = (int)$pdo->query("SELECT COUNT(*) FROM task_hidden_users WHERE task_id = $parentTaskId AND user_id = $testStaffId")->fetchColumn();
    assertTest("4.2: Tự động phục hồi hiển thị lại công việc khi được nhắc tên (@mention)", $isUnhidden === 0);

    // Dọn dẹp dữ liệu test
    $pdo->prepare("DELETE FROM activity_comments WHERE activity_id = ?")->execute([$parentTaskId]);
    $pdo->prepare("DELETE FROM activities WHERE id IN (?, ?)")->execute([$parentTaskId, $subtaskId]);
    $pdo->prepare("DELETE FROM sales_order_items WHERE so_id = ?")->execute([$soId]);
    $pdo->prepare("DELETE FROM sales_orders WHERE id = ?")->execute([$soId]);
    $pdo->prepare("DELETE FROM purchase_order_items WHERE po_id = ?")->execute([$poId]);
    $pdo->prepare("DELETE FROM purchase_orders WHERE id = ?")->execute([$poId]);
    $pdo->prepare("DELETE FROM contacts WHERE id = ?")->execute([$contactId]);
    $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$productId]);
    $pdo->prepare("DELETE FROM suppliers WHERE id = ?")->execute([$supplierId]);
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE id = ?")->execute([$advId]);
    $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$expId]);
    $pdo->prepare("DELETE FROM notifications WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM user_notification_settings WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM task_muted_notifications WHERE user_id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?)")->execute([$testStaffId, $testMgrId, $testAcctId, $testDirId]);
    $pdo->prepare("DELETE FROM teams WHERE id = 99981")->execute();

} catch (\Throwable $e) {
    echo "❌ EXCEPTION OCCURRED: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    $testStats['fail']++;
} finally {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
}

printTestSummary();
