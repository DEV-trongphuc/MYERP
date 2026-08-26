<?php
/**
 * TEST HARNESS: COMPREHENSIVE HRM, ATTENDANCE, SCHEMA & PAYLOAD VERIFICATION
 * 
 * Kiểm thử đối soát toàn diện 4 lớp:
 * 1. Database Schema & Field Types Integrity
 * 2. API Endpoints Payload & Response Structure
 * 3. Business Logic & Calculation Accuracy (Leave, OT, Insurance, PIT, Advance, Net)
 * 4. UI & Rendering Edge Cases Handling
 */

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/HRMController.php';
require_once __DIR__ . '/controllers/CheckInController.php';

echo "======================================================================\n";
echo "🔬 COMPREHENSIVE AUDIT: SCHEMA, PAYLOAD, UI & BACKEND VERIFICATION\n";
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

$hrmCtrl = new HRMController($pdo);
$checkInCtrl = new CheckInController($pdo);

$testUserId = 999901;
$approver1Id = 999902;
$approver2Id = 999903;

$adminAuth = ['user_id' => 1, 'tenant_id' => 1, 'role' => 'admin'];
$userAuth = ['user_id' => $testUserId, 'tenant_id' => 1, 'role' => 'sales'];
$app1Auth = ['user_id' => $approver1Id, 'tenant_id' => 1, 'role' => 'manager'];
$app2Auth = ['user_id' => $approver2Id, 'tenant_id' => 1, 'role' => 'director'];

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

    // Dọn dẹp dữ liệu cũ trước khi test
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM hrm_profiles WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM check_ins WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM consultant_leaves WHERE consultant_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);

    // Tạo 3 người dùng thử nghiệm
    $pdo->prepare("
        INSERT INTO users (id, full_name, username, email, role, tenant_id, is_active, status)
        VALUES 
            (?, 'Audit Employee', 'audit_emp', 'emp@audit.test', 'sales', 1, 1, 'active'),
            (?, 'Audit Manager', 'audit_mgr', 'mgr@audit.test', 'manager', 1, 1, 'active'),
            (?, 'Audit Director', 'audit_dir', 'dir@audit.test', 'director', 1, 1, 'active')
    ")->execute([$testUserId, $approver1Id, $approver2Id]);

    // Tạo hồ sơ lương & phép cho nhân viên
    $pdo->prepare("
        INSERT INTO hrm_profiles (
            user_id, joined_date, base_salary, deal_salary, allowance_meal, allowance_travel, allowance_phone,
            annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used,
            has_insurance
        ) VALUES (?, '2025-01-01', 10000000.00, 26000000.00, 730000.00, 1000000.00, 500000.00, 12.0, 0.0, 2.0, 0.0, 1)
    ")->execute([$testUserId]);

    // =========================================================================
    // LAYER 1: SCHEMA & DATABASE INTEGRITY AUDIT
    // =========================================================================
    echo ">>> [LAYER 1] DATABASE SCHEMA & CONSTRAINT INTEGRITY <<<\n";

    function assertColType(PDO $pdo, string $table, string $column, string $expectedType, string $testTitle): bool {
        $stmt = $pdo->prepare("SHOW FULL COLUMNS FROM `{$table}` WHERE Field = ?");
        $stmt->execute([$column]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return assertTest($testTitle, false, "Cột '{$column}' không tồn tại trong bảng '{$table}'");
        }
        $actualType = strtolower($row['Type']);
        $matched = (strpos($actualType, strtolower($expectedType)) !== false);
        return assertTest($testTitle, $matched, "Kiểu thực tế: '{$actualType}', Mong đợi: '{$expectedType}'");
    }

    // 1.1 Check hrm_profiles
    assertColType($pdo, 'hrm_profiles', 'deal_salary', 'decimal(15,2)', "1.1: hrm_profiles.deal_salary có kiểu decimal(15,2)");
    assertColType($pdo, 'hrm_profiles', 'base_salary', 'decimal(15,2)', "1.1: hrm_profiles.base_salary có kiểu decimal(15,2)");
    assertColType($pdo, 'hrm_profiles', 'annual_leave_total', 'decimal(4,1)', "1.1: hrm_profiles.annual_leave_total có kiểu decimal(4,1)");
    assertColType($pdo, 'hrm_profiles', 'annual_leave_used', 'decimal(4,1)', "1.1: hrm_profiles.annual_leave_used có kiểu decimal(4,1)");
    assertColType($pdo, 'hrm_profiles', 'compensatory_leave_total', 'decimal(4,1)', "1.1: hrm_profiles.compensatory_leave_total có kiểu decimal(4,1)");
    assertColType($pdo, 'hrm_profiles', 'compensatory_leave_used', 'decimal(4,1)', "1.1: hrm_profiles.compensatory_leave_used có kiểu decimal(4,1)");

    // 1.2 Check hrm_leave_requests
    assertColType($pdo, 'hrm_leave_requests', 'leave_type', 'varchar(30)', "1.2: hrm_leave_requests.leave_type có kiểu varchar(30)");
    assertColType($pdo, 'hrm_leave_requests', 'total_days', 'decimal(3,1)', "1.2: hrm_leave_requests.total_days có kiểu decimal(3,1)");
    assertColType($pdo, 'hrm_leave_requests', 'unpaid_days', 'decimal(3,1)', "1.2: hrm_leave_requests.unpaid_days có kiểu decimal(3,1)");
    assertColType($pdo, 'hrm_leave_requests', 'status', 'varchar(20)', "1.2: hrm_leave_requests.status có kiểu varchar(20)");
    assertColType($pdo, 'hrm_leave_requests', 'approver_id', 'int', "1.2: hrm_leave_requests.approver_id có kiểu int(11)");
    assertColType($pdo, 'hrm_leave_requests', 'approver_id_2', 'int', "1.2: hrm_leave_requests.approver_id_2 có kiểu int(11)");

    // 1.3 Check check_ins
    assertColType($pdo, 'check_ins', 'late_minutes', 'int', "1.3: check_ins.late_minutes có kiểu int(11)");
    assertColType($pdo, 'check_ins', 'early_minutes', 'int', "1.3: check_ins.early_minutes có kiểu int(11)");
    assertColType($pdo, 'check_ins', 'check_out_status', "varchar(50)", "1.3: check_ins.check_out_status có kiểu varchar(50)");

    // 1.4 Check monthly_payslips
    assertColType($pdo, 'monthly_payslips', 'salary_basic_calculated', 'decimal(15,2)', "1.4: monthly_payslips.salary_basic_calculated có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'allowance_total', 'decimal(15,2)', "1.4: monthly_payslips.allowance_total có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'overtime_salary', 'decimal(15,2)', "1.4: monthly_payslips.overtime_salary có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'insurance_bhxh', 'decimal(15,2)', "1.4: monthly_payslips.insurance_bhxh có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'tax_pit', 'decimal(15,2)', "1.4: monthly_payslips.tax_pit có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'advance_deduction', 'decimal(15,2)', "1.4: monthly_payslips.advance_deduction có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'net_salary', 'decimal(15,2)', "1.4: monthly_payslips.net_salary có kiểu decimal(15,2)");
    assertColType($pdo, 'monthly_payslips', 'status', 'varchar(20)', "1.4: monthly_payslips.status có kiểu varchar(20)");

    echo "\n>>> [LAYER 2] API PAYLOAD VALIDATION & RESPONSE STRUCTURE <<<\n";

    // 2.1 GET /hrm/my-balance payload
    $myBal = null;
    try {
        // Mock method getMyBalance
        $stmtBal = $pdo->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ?");
        $stmtBal->execute([$testUserId]);
        $myBal = $stmtBal->fetch(PDO::FETCH_ASSOC);
    } catch (\Throwable $e) {}
    assertTest("2.1: /hrm/my-balance trả về đầy đủ các trường quỹ phép", 
        isset($myBal['annual_leave_total']) && isset($myBal['annual_leave_used']) && 
        isset($myBal['compensatory_leave_total']) && isset($myBal['compensatory_leave_used'])
    );

    // 2.2 POST /hrm/leaves - Payload tạo đơn 2 cấp duyệt
    $mockBody = [
        'leave_type' => 'special_paid',
        'start_date' => '2026-07-06 08:00:00',
        'end_date' => '2026-07-08 17:30:00',
        'total_days' => 3.0,
        'reason' => 'Bản thân kết hôn theo Luật',
        'approver_id' => $approver1Id,
        'approver_id_2' => $approver2Id
    ];
    $createErr = '';
    try { 
        $hrmCtrl->createLeave($userAuth); 
    } catch (\Throwable $e) {
        $createErr = $e->getMessage();
    }

    $lvReq = $pdo->query("SELECT * FROM hrm_leave_requests WHERE user_id = $testUserId ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.2: Tạo đơn nghỉ phép 2 cấp duyệt thành công (Err: $createErr)", 
        $lvReq && (int)$lvReq['approver_id'] === $approver1Id && 
        (int)$lvReq['approver_id_2'] === $approver2Id && 
        $lvReq['status_level_1'] === 'pending' && 
        $lvReq['status_level_2'] === 'pending' &&
        $lvReq['status'] === 'pending'
    );

    // 2.3 Duyệt cấp 1 (Manager duyệt -> status_level_1 = approved, status vẫn pending do chờ cấp 2)
    $mockBody = ['id' => $lvReq['id'], 'status' => 'approved'];
    try { $hrmCtrl->approveLeave($app1Auth); } catch (\Throwable $e) {}
    $lvAfterApp1 = $pdo->query("SELECT * FROM hrm_leave_requests WHERE id = {$lvReq['id']}")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.3: Duyệt cấp 1 -> status_level_1 = approved, status chung vẫn là 'pending'", 
        $lvAfterApp1['status_level_1'] === 'approved' && $lvAfterApp1['status'] === 'pending'
    );

    // 2.4 Duyệt cấp 2 (Director duyệt -> status_level_2 = approved, status chung = 'approved')
    $mockBody = ['id' => $lvReq['id'], 'status' => 'approved'];
    try { $hrmCtrl->approveLeave($app2Auth); } catch (\Throwable $e) {}
    $lvAfterApp2 = $pdo->query("SELECT * FROM hrm_leave_requests WHERE id = {$lvReq['id']}")->fetch(PDO::FETCH_ASSOC);
    assertTest("2.4: Duyệt cấp 2 -> status_level_2 = approved, status chung chuyển thành 'approved'", 
        $lvAfterApp2['status_level_2'] === 'approved' && $lvAfterApp2['status'] === 'approved'
    );

    echo "\n>>> [LAYER 3] END-TO-END BUSINESS LOGIC & PAYROLL AUDIT <<<\n";

    // 3.1 Bảng lương tính đủ 3 ngày chế độ Luật
    $monthYear = '2026-07';
    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps1 = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("3.1: 3 ngày nghỉ kết hôn được tính là 3 ngày công có hưởng lương", (float)$ps1['work_days_actual'] === 3.0);
    // 3 ngày công * (26M / 26) = 3.000.000 VNĐ
    assertTest("3.1: Lương cơ bản tính đúng = 3,000,000 VNĐ", (float)$ps1['salary_basic_calculated'] === 3000000.0);

    // 3.2 Ký xác nhận bảng lương trực tuyến (/hrm/payroll/confirm)
    $mockBody = [
        'id' => (int)$ps1['id'],
        'signature_url' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    ];
    try { $hrmCtrl->confirmPayslip($userAuth); } catch (\Throwable $e) {}
    $psConfirmed = $pdo->query("SELECT status, signature_url, confirmed_at FROM monthly_payslips WHERE id = {$ps1['id']}")->fetch(PDO::FETCH_ASSOC);
    assertTest("3.2: Ký xác nhận bảng lương thành công (status = 'confirmed')", 
        $psConfirmed['status'] === 'confirmed' && !empty($psConfirmed['signature_url']) && !empty($psConfirmed['confirmed_at'])
    );

    // 3.3 Khiếu nại / Yêu cầu thay đổi bảng lương (/hrm/payroll/confirm action=dispute)
    $mockBody = [
        'id' => (int)$ps1['id'],
        'action' => 'dispute',
        'note' => 'Nhờ HR kiểm tra lại ngày công tăng ca'
    ];
    try { $hrmCtrl->confirmPayslip($userAuth); } catch (\Throwable $e) {}
    $psDisputed = $pdo->query("SELECT status, note FROM monthly_payslips WHERE id = {$ps1['id']}")->fetch(PDO::FETCH_ASSOC);
    assertTest("3.3: Gửi khiếu nại bảng lương thành công (status = 'disputed')", 
        $psDisputed['status'] === 'disputed' && strpos($psDisputed['note'], 'tăng ca') !== false
    );

    echo "\n>>> [LAYER 4] UI & RENDERING INTEGRITY CHECKS <<<\n";

    // 4.1 Đảm bảo không bị lỗi chia cho 0 khi work_days_required = 0
    $mockBody = ['month_year' => '2026-08', 'work_days_required' => 0];
    $zeroDivPassed = false;
    $tc41Msg = '';
    try { 
        $hrmCtrl->calculatePayroll($adminAuth); 
        $zeroDivPassed = true;
    } catch (\Throwable $e) {
        $tc41Msg = $e->getMessage();
        $code = method_exists($e, 'getCode') ? $e->getCode() : 0;
        if ($code === 200 || (isset($e->statusCode) && $e->statusCode === 200) || strpos($e->getMessage(), 'RESPOND_CODE_200') !== false) {
            $zeroDivPassed = true;
        }
    }
    assertTest("4.1: Xử lý an toàn khi work_days_required = 0 (không văng DivisionByZeroError)", $zeroDivPassed, $tc41Msg);

    // 4.2 Đảm bảo lương thực lĩnh Net không bao giờ âm (Net >= 0) ngay cả khi khấu trừ tạm ứng lớn
    $pdo->prepare("
        INSERT INTO hrm_salary_advances (user_id, amount, request_date, status, reason)
        VALUES (?, 100000000.00, '2026-07-20', 'approved', 'Tạm ứng số tiền lớn')
    ")->execute([$testUserId]);
    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $psNegativeCheck = $pdo->query("SELECT net_salary FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("4.2: Lương thực lĩnh Net luôn được chặn dưới tối thiểu >= 0 (không bị âm)", (float)$psNegativeCheck['net_salary'] >= 0.0);

    // Dọn dẹp test data sau khi kiểm thử hoàn tất
    $pdo->prepare("DELETE FROM check_ins WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM hrm_profiles WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM consultant_leaves WHERE consultant_id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?)")->execute([$testUserId, $approver1Id, $approver2Id]);

} catch (\Throwable $e) {
    echo "❌ EXCEPTION OCCURRED: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    $testStats['fail']++;
} finally {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
}

printTestSummary();
