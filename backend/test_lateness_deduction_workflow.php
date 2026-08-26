<?php
// backend/test_lateness_deduction_workflow.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/HRMController.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

echo "=== STARTING LATENESS DEDUCTION SYSTEM INTEGRATION TEST ===\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

// Mock getBody and respond functions
global $mockBody;
$mockBody = [];
if (!function_exists('getBody')) {
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

if (!class_exists('RespondException')) {
    class RespondException extends Exception {
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

if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        throw new RespondException($code, $data, $message, $success);
    }
}

$testUserId = 99888;
$monthYear = '2026-07';

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");
    
    // 1. Dọn dẹp dữ liệu cũ
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_profiles WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);

    // 2. Chèn dummy user và profile
    $pdo->prepare("
        INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
        VALUES (?, 1, 'test_lateness_employee@ideas.vn', 'no_hash', 'Test Lateness Employee', 'sales', 1)
    ")->execute([$testUserId]);

    // 3. Khởi tạo controller
    $hrmCtrl = new HRMController($pdo);
    $adminAuth = ['user_id' => 1, 'role' => 'admin', 'tenant_id' => 1];

    // ==========================================
    // CASE 1: Khấu trừ toàn bộ vào ngày nghỉ bù
    // ==========================================
    echo "\n--- RUNNING CASE 1: Khấu trừ toàn bộ vào ngày nghỉ bù ---\n";
    
    // Cài đặt quỹ phép: Nghỉ bù = 2.0, Phép năm = 10.0 (đã dùng = 0.0)
    $pdo->prepare("
        INSERT INTO hrm_profiles (user_id, joined_date, base_salary, deal_salary, compensatory_leave_total, compensatory_leave_used, annual_leave_total, annual_leave_used)
        VALUES (?, '2026-01-15', 10000000.00, 20000000.00, 2.00, 0.00, 10.00, 0.00)
    ")->execute([$testUserId]);

    // Chèn check-ins đi trễ tổng cộng 480 phút (1 ngày)
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-01', '08:30:00', 'approved', 240)")->execute([$testUserId]);
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-02', '08:30:00', 'approved', 240)")->execute([$testUserId]);

    // Chèn 21 ngày đi làm đúng giờ (tổng cộng 23 ngày làm việc)
    for ($d = 3; $d <= 23; $d++) {
        $dayStr = sprintf('%02d', $d);
        $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-{$dayStr}', '08:00:00', 'approved', 0)")->execute([$testUserId]);
    }

    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (RespondException $e) {}

    // Kiểm tra kết quả
    $payslip = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    $profile = $pdo->query("SELECT * FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);

    assertTest("Case 1: Khấu trừ đúng 1.0 ngày nghỉ bù", (float)$payslip['lateness_compensatory_deducted'] === 1.0);
    assertTest("Case 1: Không khấu trừ phép năm", (float)$payslip['lateness_annual_deducted'] === 0.0);
    assertTest("Case 1: Ngày công thực tế giữ nguyên (23.0)", (float)$payslip['work_days_actual'] === 23.0);
    assertTest("Case 1: Profile cập nhật compensatory_leave_used = 1.0", (float)$profile['compensatory_leave_used'] === 1.0);

    // ==========================================
    // CASE 2: Khấu trừ nối tiếp từ nghỉ bù sang phép năm
    // ==========================================
    echo "\n--- RUNNING CASE 2: Khấu trừ nối tiếp từ nghỉ bù sang phép năm ---\n";
    
    // Reset dữ liệu check_ins và profile để test case 2
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 0.50, compensatory_leave_used = 0.00, annual_leave_total = 10.00, annual_leave_used = 0.00 WHERE user_id = ?")->execute([$testUserId]);

    // Chèn check-ins đi trễ tổng cộng 720 phút (1.5 ngày)
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-01', '08:30:00', 'approved', 240)")->execute([$testUserId]);
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-02', '08:30:00', 'approved', 240)")->execute([$testUserId]);
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-03', '08:30:00', 'approved', 240)")->execute([$testUserId]);

    // Chèn 20 ngày đi làm đúng giờ (tổng cộng 23 ngày làm việc)
    for ($d = 4; $d <= 23; $d++) {
        $dayStr = sprintf('%02d', $d);
        $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-{$dayStr}', '08:00:00', 'approved', 0)")->execute([$testUserId]);
    }

    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (RespondException $e) {}

    $payslip = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    $profile = $pdo->query("SELECT * FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);

    assertTest("Case 2: Khấu trừ hết 0.5 ngày nghỉ bù còn dư", (float)$payslip['lateness_compensatory_deducted'] === 0.5);
    assertTest("Case 2: Khấu trừ nốt 1.0 ngày vào phép năm", (float)$payslip['lateness_annual_deducted'] === 1.0);
    assertTest("Case 2: Ngày công thực tế giữ nguyên (23.0)", (float)$payslip['work_days_actual'] === 23.0);
    assertTest("Case 2: Profile cập nhật compensatory_leave_used = 0.5", (float)$profile['compensatory_leave_used'] === 0.5);
    assertTest("Case 2: Profile cập nhật annual_leave_used = 1.0", (float)$profile['annual_leave_used'] === 1.0);

    // ==========================================
    // CASE 3: Khấu trừ trực tiếp vào ngày công tính lương
    // ==========================================
    echo "\n--- RUNNING CASE 3: Khấu trừ trực tiếp vào ngày công tính lương ---\n";
    
    // Reset và set quỹ phép = 0
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 0.00, compensatory_leave_used = 0.00, annual_leave_total = 0.00, annual_leave_used = 0.00 WHERE user_id = ?")->execute([$testUserId]);

    // Chèn đi trễ 240 phút (0.5 ngày)
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-01', '08:30:00', 'approved', 240)")->execute([$testUserId]);

    // Chèn 22 ngày đi làm đúng giờ (tổng cộng 23 ngày làm việc)
    for ($d = 2; $d <= 23; $d++) {
        $dayStr = sprintf('%02d', $d);
        $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-{$dayStr}', '08:00:00', 'approved', 0)")->execute([$testUserId]);
    }

    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (RespondException $e) {}

    $payslip = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    $profile = $pdo->query("SELECT * FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);

    assertTest("Case 3: Không khấu trừ nghỉ bù (đã hết)", (float)$payslip['lateness_compensatory_deducted'] === 0.0);
    assertTest("Case 3: Không khấu trừ phép năm (đã hết)", (float)$payslip['lateness_annual_deducted'] === 0.0);
    assertTest("Case 3: Trừ trực tiếp vào ngày công tính lương (23.0 - 0.5 = 22.5)", (float)$payslip['work_days_actual'] === 22.5);

    // ==========================================
    // CASE 4: Tính toán lại bảng lương an toàn (không lũy kế)
    // ==========================================
    echo "\n--- RUNNING CASE 4: Tính toán lại bảng lương an toàn (hoàn trả phép cũ) ---\n";
    
    // Set lại quỹ phép: nghỉ bù = 2.0, phép = 10.0 (đã dùng = 0)
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 2.00, compensatory_leave_used = 0.00, annual_leave_total = 10.00, annual_leave_used = 0.00 WHERE user_id = ?")->execute([$testUserId]);

    // Chèn đi trễ 480 phút (1.0 ngày)
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-01', '08:30:00', 'approved', 480)")->execute([$testUserId]);
    for ($d = 2; $d <= 23; $d++) {
        $dayStr = sprintf('%02d', $d);
        $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-{$dayStr}', '08:00:00', 'approved', 0)")->execute([$testUserId]);
    }

    // Chạy tính lương lần 1
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (RespondException $e) {}
    $profile1 = $pdo->query("SELECT * FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    assertTest("Lần 1: Nghỉ bù đã dùng tăng lên 1.0", (float)$profile1['compensatory_leave_used'] === 1.0);

    // Chạy tính lương lần 2 (tính toán lại)
    // LƯU Ý: Phải load lại employee profiles từ CSDL để cập nhật thông tin trong memory khi chạy lần 2
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (RespondException $e) {}
    $profile2 = $pdo->query("SELECT * FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    assertTest("Lần 2: Nghỉ bù đã dùng vẫn giữ nguyên là 1.0 (không bị tăng luỹ kế thành 2.0!)", (float)$profile2['compensatory_leave_used'] === 1.0);

    // ==========================================
    // DỌN DẸP DỮ LIỆU
    // ==========================================
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_profiles WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
    
    assertTest("Dọn dẹp dữ liệu kiểm thử an toàn", true);

} catch (Throwable $e) {
    try { $pdo->exec("SET FOREIGN_KEY_CHECKS=1;"); } catch (Throwable $ex) {}
    echo "❌ LỖI KIỂM THỬ: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

printTestSummary();
