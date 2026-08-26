<?php
// backend/test_task_permissions.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

if (!class_exists('RespondException')) {
    class RespondException extends Exception {
        public function __construct(int $code, string $message) {
            parent::__construct($message, $code);
        }
    }
}

if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        echo "[DEBUG] respond() function CALLED with code: $code, message: $message\n";
        throw new RespondException($code, $message);
    }
} else {
    echo "[DEBUG] respond() function ALREADY exists before definition!\n";
}

if (!function_exists('logActivity')) {
    function logActivity(...$args) {
        // Mock activity logging to prevent undefined function error during test
    }
}

require_once __DIR__ . '/controllers/ActivityController.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ KHÉP KÍN PHÂN QUYỀN CÔNG VIỆC (TASK PERMISSIONS AUDIT)\n";
echo "========================================================================\n\n";

$ctrl = new ActivityController($pdo);

// 1. Tạo các tài khoản test tạm thời để phục vụ kiểm thử
echo "--- 1. KHỞI TẠO TÀI KHOẢN VÀ CÔNG VIỆC THỬ NGHIỆM ---\n";

// Dọn dẹp dữ liệu cũ nếu có sót lại
$conn->query("DELETE FROM activities WHERE subject = 'TEST_TASK_PERMISSIONS_IDEAS'");
$conn->query("DELETE FROM users WHERE username IN ('test_perm_admin', 'test_perm_sale', 'test_perm_viewer')");

// Tạo Admin
$pwd = password_hash('testpwd123', PASSWORD_BCRYPT);
$conn->query("INSERT INTO users (tenant_id, username, password_hash, email, role, full_name, status) VALUES (1, 'test_perm_admin', '$pwd', 'test_perm_admin@ideas.vn', 'admin', 'Test Admin Perm', 'active')");
$adminId = $conn->insert_id;

// Tạo Sale
$conn->query("INSERT INTO users (tenant_id, username, password_hash, email, role, full_name, status) VALUES (1, 'test_perm_sale', '$pwd', 'test_perm_sale@ideas.vn', 'sales', 'Test Sale Perm', 'active')");
$saleId = $conn->insert_id;

// Tạo Viewer
$conn->query("INSERT INTO users (tenant_id, username, password_hash, email, role, full_name, status) VALUES (1, 'test_perm_viewer', '$pwd', 'test_perm_viewer@ideas.vn', 'viewer', 'Test Viewer Perm', 'active')");
$viewerId = $conn->insert_id;

if (!$adminId || !$saleId || !$viewerId) {
    echo "❌ LỖI KHÔNG THỂ KHỞI TẠO TÀI KHOẢN TEST: " . $conn->error . "\n";
    exit(1);
}

// Tạo Task
$stmt = $conn->prepare("
    INSERT INTO activities (tenant_id, subject, type, user_id, created_by, progress, require_approval, approver_id, approval_status)
    VALUES (1, 'TEST_TASK_PERMISSIONS_IDEAS', 'task', ?, ?, 0, 1, ?, 'none')
");
$stmt->bind_param("iii", $saleId, $saleId, $adminId);
$stmt->execute();
$taskId = $stmt->insert_id;
$stmt->close();

assertTest("Khởi tạo công việc thử nghiệm ID: $taskId", $taskId > 0);

// Helper function to mock request body
if (!function_exists('getBody')) {
    function getBody() {
        return $GLOBALS['mock_body_data'] ?? [];
    }
}

// 2. Thử nghiệm cập nhật từ tài khoản Viewer (Phải bị chặn 403)
echo "\n--- 2. KIỂM TRA QUYỀN VIEWER (BỊ CHẶN CẬP NHẬT) ---\n";
$viewerAuth = [
    'user_id' => $viewerId,
    'tenant_id' => 1,
    'role' => 'viewer'
];

$GLOBALS['mock_body_data'] = ['progress' => 50];

$threwViewer = false;
$codeViewer = 0;
try {
    $ctrl->update($viewerAuth, $taskId);
} catch (RespondException $e) {
    $threwViewer = true;
    $codeViewer = $e->getCode();
} catch (\Throwable $t) {
    echo "Lỗi không xác định: " . $t->getMessage() . "\n";
}

assertTest("Tài khoản Viewer bị chặn cập nhật (HTTP 403)", $threwViewer && $codeViewer === 403);

// 3. Thử nghiệm duyệt công việc từ tài khoản không được ủy quyền (Sale tự duyệt)
echo "\n--- 3. KIỂM TRA QUYỀN PHÊ DUYỆT (CHỈ CHO PHÉP NGƯỜI DUYỆT ĐƯỢC CHỈ ĐỊNH) ---\n";
$saleAuth = [
    'user_id' => $saleId,
    'tenant_id' => 1,
    'role' => 'sales'
];

$GLOBALS['mock_body_data'] = [
    'progress' => 100,
    'approval_status' => 'approved' // Sale tự duyệt
];

$threwSale = false;
$codeSale = 0;
try {
    $ctrl->update($saleAuth, $taskId);
} catch (RespondException $e) {
    $threwSale = true;
    $codeSale = $e->getCode();
} catch (\Throwable $t) {
    echo "Lỗi không xác định: " . $t->getMessage() . "\n";
}

assertTest("Nhân viên thực hiện không thể tự duyệt công việc (HTTP 403)", $threwSale && $codeSale === 403);

// 4. Thử nghiệm người duyệt được chỉ định duyệt công việc
echo "\n--- 4. KIỂM TRA PHÊ DUYỆT HỢP LỆ ---\n";
$adminAuth = [
    'user_id' => $adminId,
    'tenant_id' => 1,
    'role' => 'admin'
];

$GLOBALS['mock_body_data'] = [
    'progress' => 100,
    'approval_status' => 'approved'
];

$threwAdmin = false;
$codeAdmin = 0;
try {
    $ctrl->update($adminAuth, $taskId);
} catch (RespondException $e) {
    $threwAdmin = true;
    $codeAdmin = $e->getCode();
} catch (\Throwable $t) {
    echo "Lỗi không xác định: " . $t->getMessage() . "\n";
}

assertTest("Người duyệt hợp lệ phê duyệt thành công công việc (HTTP 200)", $threwAdmin && $codeAdmin === 200);

// 5. Dọn dẹp dữ liệu test
$conn->query("DELETE FROM activities WHERE id = $taskId");
$conn->query("DELETE FROM users WHERE id IN ($adminId, $saleId, $viewerId)");
echo "\n🧹 Đã dọn dẹp dữ liệu công việc và tài khoản kiểm thử.\n";

echo "\n--- KẾT THÚC KIỂM THỬ PHÂN QUYỀN CÔNG VIỆC ---\n";
printTestSummary();
