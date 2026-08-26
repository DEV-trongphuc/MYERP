<?php
// backend/test_approvals_rejection_audit.php
// Script kiểm thử đối soát tính năng lưu lý do từ chối đơn nghỉ phép và tạm ứng

// Mock getBody trước khi require các file khác để tránh lỗi duplicate function
$mockBody = [];
if (!function_exists('getBody')) {
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/HRMController.php';

echo "====================================================\n";
echo "🔍 CHẠY AUDIT PHÊ DUYỆT: LƯU LÝ DO TỪ CHỐI (REJECTION REASON)\n";
echo "====================================================\n\n";

// Khởi tạo Controller
$hrmCtrl = new HRMController($pdo);

// Lấy thông tin user hoạt động để làm dữ liệu kiểm thử
$uRow = $pdo->query("SELECT id, tenant_id FROM users WHERE is_active = 1 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$userId = (int)$uRow['id'];
$tenantId = (int)$uRow['tenant_id'];

echo "[SETUP] Sử dụng User ID: {$userId}, Tenant ID: {$tenantId}\n";

// --- TEST CASE 1: LƯU LÝ DO TỪ CHỐI NGHỈ PHÉP (LEAVE REQUEST) ---
echo "\n--- 1. KIỂM THỬ TỪ CHỐI ĐƠN NGHỈ PHÉP ---\n";

// Tạo đơn xin nghỉ phép nháp
$pdo->prepare("
    INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status, approver_id)
    VALUES (?, 'annual', '2026-08-10 08:00:00', '2026-08-10 17:30:00', 1.0, 'Nghỉ giải quyết việc cá nhân', 'pending', ?)
")->execute([$userId, $userId]);
$leaveId = (int)$pdo->lastInsertId();
echo "[SETUP] Đã tạo đơn nghỉ phép ID: {$leaveId}\n";

// Thiết lập mock payload cho API approveLeave
$mockBody = [
    'id' => $leaveId,
    'status' => 'rejected',
    'reason' => 'Không được duyệt do trùng lịch trực dự án'
];

$authMock = [
    'user_id' => $userId,
    'tenant_id' => $tenantId,
    'role' => 'admin'
];

// Chạy thử hàm phê duyệt (sẽ từ chối đơn)
try {
    // Để tránh việc hàm respond() gọi exit trong test runner, ta bao bọc trong try catch
    // Lưu ý: respond() có thể ném RespondException hoặc exit. Trong test_bootstrap của hệ thống, respond ném ngoại lệ nếu được cấu hình.
    $hrmCtrl->approveLeave($authMock);
} catch (\Throwable $e) {
    // Bỏ qua lỗi respond để kiểm tra database
}

// Kiểm tra trong CSDL xem lý do từ chối có được CONCAT vào reason không
$leaveCheck = $pdo->prepare("SELECT reason, status FROM hrm_leave_requests WHERE id = ?");
$leaveCheck->execute([$leaveId]);
$leaveData = $leaveCheck->fetch(PDO::FETCH_ASSOC);

assertTest("Trạng thái đơn nghỉ phép đã chuyển thành 'rejected'", $leaveData['status'] === 'rejected', "Status: " . $leaveData['status']);
assertTest("Lý do từ chối đã được đính kèm vào trường reason của đơn nghỉ phép", strpos($leaveData['reason'], 'Không được duyệt do trùng lịch trực dự án') !== false, "Reason thực tế: " . $leaveData['reason']);

// Dọn dẹp đơn nghỉ phép
$pdo->prepare("DELETE FROM hrm_leave_requests WHERE id = ?")->execute([$leaveId]);


// --- TEST CASE 2: LƯU LÝ DO TỪ CHỐI TẠM ỨNG (SALARY ADVANCE) ---
echo "\n--- 2. KIỂM THỬ TỪ CHỐI ĐỀ NGHỊ TẠM ỨNG ---\n";

// Tạo đề nghị tạm ứng nháp
$pdo->prepare("
    INSERT INTO hrm_salary_advances (user_id, amount, request_date, reason, status, approver_id)
    VALUES (?, 5000000.00, CURDATE(), 'Tạm ứng mua sắm vật tư', 'pending', ?)
")->execute([$userId, $userId]);
$advanceId = (int)$pdo->lastInsertId();
echo "[SETUP] Đã tạo đề nghị tạm ứng ID: {$advanceId}\n";

// Thiết lập mock payload cho API approveAdvance
$mockBody = [
    'id' => $advanceId,
    'status' => 'rejected',
    'reason' => 'Vượt quá hạn mức tạm ứng tháng này'
];

// Chạy thử hàm phê duyệt (sẽ từ chối đơn)
try {
    $hrmCtrl->approveAdvance($authMock);
} catch (\Throwable $e) {
    // Bỏ qua lỗi respond để kiểm tra database
}

// Kiểm tra trong CSDL xem lý do từ chối có được CONCAT vào reason không
$advCheck = $pdo->prepare("SELECT reason, status FROM hrm_salary_advances WHERE id = ?");
$advCheck->execute([$advanceId]);
$advData = $advCheck->fetch(PDO::FETCH_ASSOC);

assertTest("Trạng thái đề nghị tạm ứng đã chuyển thành 'rejected'", $advData['status'] === 'rejected', "Status: " . $advData['status']);
assertTest("Lý do từ chối đã được đính kèm vào trường reason của đề nghị tạm ứng", strpos($advData['reason'], 'Vượt quá hạn mức tạm ứng tháng này') !== false, "Reason thực tế: " . $advData['reason']);

// Dọn dẹp đề nghị tạm ứng
$pdo->prepare("DELETE FROM hrm_salary_advances WHERE id = ?")->execute([$advanceId]);

printTestSummary();
echo "\n====================================================\n";
