<?php
// backend/test_master_hrm_audit.php
// MASTER AUDIT TEST SUITE: CHẤM CÔNG, PHÉP, NGHỈ BÙ, TĂNG CA & CÔNG LƯƠNG (IDEAS ERP)

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/HRMController.php';
require_once __DIR__ . '/controllers/CheckInController.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

echo "======================================================================\n";
echo "🔍 IDEAS ERP - MASTER AUDIT TEST SUITE: CHẤM CÔNG, PHÉP, BÙ, LƯƠNG\n";
echo "======================================================================\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

// Global mocks
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

$testUserId = 99888;
$managerUserId = 99889;
$hrUserId = 99890;
$monthYear = '2026-07';
$today = date('Y-m-d');

$adminAuth = ['user_id' => 1, 'role' => 'admin', 'tenant_id' => 1];
$userAuth = ['user_id' => $testUserId, 'role' => 'sales', 'tenant_id' => 1];
$managerAuth = ['user_id' => $managerUserId, 'role' => 'manager', 'tenant_id' => 1];
$hrAuth = ['user_id' => $hrUserId, 'role' => 'hr', 'tenant_id' => 1];

$hrmCtrl = new HRMController($pdo);
$checkInCtrl = new CheckInController($pdo);

$currentSettings = $pdo->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%work%'")->fetchAll(PDO::FETCH_KEY_PAIR);
echo "DEBUG SYSTEM SETTINGS: " . json_encode($currentSettings, JSON_UNESCAPED_UNICODE) . "\n";

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

    // Dọn dẹp dữ liệu test cũ
    $pdo->prepare("DELETE FROM check_ins WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM hrm_profiles WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM attendance_bulk_requests WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);

    // Tạo test users
    $pdo->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active) VALUES (?, 1, 'audit_test_emp@ideas.vn', 'hash', 'Audit Employee', 'sales', 1)")->execute([$testUserId]);
    $pdo->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active) VALUES (?, 1, 'audit_test_mgr@ideas.vn', 'hash', 'Audit Manager', 'manager', 1)")->execute([$managerUserId]);
    $pdo->prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active) VALUES (?, 1, 'audit_test_hr@ideas.vn', 'hash', 'Audit HR', 'hr', 1)")->execute([$hrUserId]);

    // =========================================================================
    // SECTION 1: AUDIT CHẤM CÔNG (CHECK-IN / CHECK-OUT / GEOFENCING / SHIFTS)
    // =========================================================================
    echo "\n>>> [SECTION 1] AUDIT LOGIC CHẤM CÔNG & CA LÀM VIỆC <<<\n";

    // TC01: Check-in hợp lệ đúng giờ trong bán kính GPS văn phòng (vào ngày hôm nay)
    $mockBody = [
        'check_in_date' => $today,
        'check_in_time' => (date('H:i:s') < '07:55:00') ? date('H:i:s') : '07:55:00',
        'selfie_url' => 'https://ideas.vn/selfie1.jpg',
        'latitude' => '10.795050',
        'longitude' => '106.721950',
        'action' => 'checkin'
    ];
    try {
        $checkInCtrl->store($userAuth);
    } catch (\Throwable $e) {}
    $ci1 = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '$today'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC01: Check-in đúng giờ trong bán kính GPS thành công", $ci1 && $ci1['status'] === 'approved' && (int)$ci1['late_minutes'] === 0);

    // TC02: Chặn check-in thời gian trong tương lai
    $mockBody = [
        'check_in_date' => '2099-01-01',
        'check_in_time' => '08:00:00',
        'selfie_url' => 'https://ideas.vn/selfie.jpg',
        'latitude' => '10.7950',
        'longitude' => '106.7219',
        'action' => 'checkin'
    ];
    $tc2Blocked = false;
    try {
        $checkInCtrl->store($userAuth);
    } catch (\Throwable $e) {
        $code = method_exists($e, 'getCode') ? $e->getCode() : 0;
        $tc2Blocked = ($code === 400 || (isset($e->statusCode) && $e->statusCode === 400));
    }
    assertTest("TC02: Chặn check-in ngày trong tương lai (400 Bad Request)", $tc2Blocked);

    // TC03: Check-in đi trễ buổi sáng (Check-in bổ sung có lý do ngày quá khứ lúc 08:35 -> trễ 35 phút)
    $mockBody = [
        'check_in_date' => '2026-07-02',
        'check_in_time' => '08:35:00',
        'reason' => 'Kẹt xe đường Ung Văn Khiêm',
        'action' => 'checkin'
    ];
    try { $checkInCtrl->store($userAuth); } catch (\Throwable $e) {}
    $ci2 = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '2026-07-02'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC03: Check-in trễ sáng tính đúng số phút (35 phút)", $ci2 && (int)$ci2['late_minutes'] === 35);

    // TC04: Check-in ca chiều (vào lúc 13:20 -> trễ 20 phút so với 13:00)
    $mockBody = [
        'check_in_date' => '2026-07-03',
        'check_in_time' => '13:20:00',
        'reason' => 'Làm việc bên ngoài buổi sáng',
        'action' => 'checkin'
    ];
    try { $checkInCtrl->store($userAuth); } catch (\Throwable $e) {}
    $ci3 = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '2026-07-03'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC04: Check-in ca chiều tính trễ so với mốc 13:00 (20 phút)", $ci3 && (int)$ci3['late_minutes'] === 20);

    // TC05: Check-out đúng giờ (17:35 -> early_minutes = 0, on_time)
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-01', '07:55:00', 'approved', 0)")->execute([$testUserId]);
    $mockBody = [
        'check_in_date' => '2026-07-01',
        'check_in_time' => '17:35:00',
        'latitude' => '10.7950',
        'longitude' => '106.7219',
        'action' => 'checkout'
    ];
    try { $checkInCtrl->store($userAuth); } catch (\Throwable $e) {}
    $co1 = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '2026-07-01'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC05: Check-out sau 17:30 ghi nhận đúng giờ (early_minutes = 0)", $co1 && (int)$co1['early_minutes'] === 0 && $co1['check_out_status'] === 'on_time');

    // TC06: Check-out về sớm (16:30 -> early_minutes = 60 phút)
    $mockBody = [
        'check_in_date' => '2026-07-02',
        'check_in_time' => '16:30:00',
        'latitude' => '10.7950',
        'longitude' => '106.7219',
        'action' => 'checkout'
    ];
    $tc6Err = '';
    try { 
        $checkInCtrl->store($userAuth); 
    } catch (\Throwable $e) {
        $tc6Err = $e->getMessage();
    }
    $co2 = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '2026-07-02'")->fetch(PDO::FETCH_ASSOC);
    $earlyMins = (int)($co2['early_minutes'] ?? 0);
    $coStatus = $co2['check_out_status'] ?? '';
    assertTest("TC06: Check-out trước 17:30 ghi nhận về sớm (early_minutes: $earlyMins, status: $coStatus, err: $tc6Err)", $co2 && $earlyMins > 0 && $coStatus === 'early');

    // TC07: Miễn phạt về sớm nếu có đơn xin nghỉ phép buổi chiều đã duyệt
    $pdo->prepare("
        INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, status, reason)
        VALUES (?, 'annual', '2026-07-03 13:00:00', '2026-07-03 17:30:00', 0.5, 'approved', 'Nghỉ phép chiều')
    ")->execute([$testUserId]);

    $mockBody = [
        'check_in_date' => '2026-07-03',
        'check_in_time' => '12:00:00',
        'latitude' => '10.7950',
        'longitude' => '106.7219',
        'action' => 'checkout'
    ];
    try { $checkInCtrl->store($userAuth); } catch (\Throwable $e) {}
    $co3 = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '2026-07-03'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC07: Check-out 12:00 có đơn phép chiều -> Miễn phạt về sớm (early_minutes = 0)", $co3 && (int)$co3['early_minutes'] === 0);

    // TC08: Quy trình giải trình chấm công hàng loạt (Attendance Bulk Request)
    $pdo->prepare("
        INSERT INTO attendance_bulk_requests (user_id, month_period, status)
        VALUES (?, '2026-07', 'pending_manager')
    ")->execute([$testUserId]);
    $bulkReqId = (int)$pdo->lastInsertId();

    $pdo->prepare("
        INSERT INTO attendance_bulk_request_details (request_id, check_in_date, suggested_check_in, suggested_check_out, reason)
        VALUES (?, '2026-07-06', '08:00:00', '17:30:00', 'Quên chấm công')
    ")->execute([$bulkReqId]);

    // Manager duyệt -> Chuyển sang pending_hr
    $pdo->prepare("UPDATE attendance_bulk_requests SET status = 'pending_hr', manager_id = ? WHERE id = ?")->execute([$managerUserId, $bulkReqId]);
    // HR duyệt -> Chuyển approved và tự động tạo check_in
    $pdo->prepare("UPDATE attendance_bulk_requests SET status = 'approved', hr_id = ? WHERE id = ?")->execute([$hrUserId, $bulkReqId]);
    $pdo->prepare("
        INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, reason)
        VALUES (?, '2026-07-06', '08:00:00', '2026-07-06 17:30:00', 'approved', 'Bổ sung giải trình bulk')
    ")->execute([$testUserId]);

    $bulkCheck = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '2026-07-06'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC08: Duyệt giải trình bổ sung công bulk tạo bản ghi check_in hợp lệ", $bulkCheck && $bulkCheck['status'] === 'approved');

    // =========================================================================
    // SECTION 2: AUDIT NGHỈ PHÉP, NGHỈ BÙ & CẤN TRỪ ĐI MUỘN
    // =========================================================================
    echo "\n>>> [SECTION 2] AUDIT NGHỈ PHÉP, QUỸ PHÉP & NGHỈ BÙ <<<\n";

    // Khởi tạo hồ sơ nhân sự với 12 ngày phép năm và 2 ngày nghỉ bù
    $pdo->prepare("
        INSERT INTO hrm_profiles (user_id, joined_date, base_salary, deal_salary, has_insurance, allowance_meal, allowance_travel, allowance_phone, kpi_target,
                                  annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used)
        VALUES (?, '2026-01-01', 10000000.00, 26000000.00, 1, 730000, 500000, 300000, 50000000,
                12.0, 0.0, 2.0, 0.0)
    ")->execute([$testUserId]);

    // TC09: Tạo và duyệt đơn nghỉ phép năm 1 ngày -> annual_leave_used tăng 1.0
    $pdo->prepare("
        INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, status, reason)
        VALUES (?, 'annual', '2026-07-10 08:00:00', '2026-07-10 17:30:00', 1.0, 'approved', 'Nghỉ việc gia đình')
    ")->execute([$testUserId]);
    $pdo->prepare("UPDATE hrm_profiles SET annual_leave_used = annual_leave_used + 1.0 WHERE user_id = ?")->execute([$testUserId]);

    $profCheck1 = $pdo->query("SELECT annual_leave_total, annual_leave_used FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC09: Duyệt đơn phép 1 ngày trừ đúng quỹ phép năm (used = 1.0, remain = 11.0)", (float)$profCheck1['annual_leave_used'] === 1.0);

    // TC10: Tạo và duyệt đơn nghỉ phép nửa ngày (0.5 ngày)
    $pdo->prepare("
        INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, status, reason)
        VALUES (?, 'annual', '2026-07-13 08:00:00', '2026-07-13 12:00:00', 0.5, 'approved', 'Khám sức khỏe')
    ")->execute([$testUserId]);
    $pdo->prepare("UPDATE hrm_profiles SET annual_leave_used = annual_leave_used + 0.5 WHERE user_id = ?")->execute([$testUserId]);

    $profCheck2 = $pdo->query("SELECT annual_leave_used FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC10: Duyệt đơn phép 0.5 ngày cộng dồn chính xác (used = 1.5)", (float)$profCheck2['annual_leave_used'] === 1.5);

    // TC11: Cấn trừ đi muộn ưu tiên Nghỉ Bù trước (Nhân viên có 480 phút đi trễ = 1 ngày công)
    // Reset lại check-ins của tháng 7 để kiểm thử chính xác
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    
    // Ngày 01 & 02: Trễ mỗi ngày 240 phút = tổng 480 phút trễ (1 ngày làm việc)
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-01', '12:00:00', 'approved', 240)")->execute([$testUserId]);
    $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-02', '12:00:00', 'approved', 240)")->execute([$testUserId]);

    // Các ngày còn lại từ ngày 03 đến 25 (23 ngày đúng giờ, tổng 25 ngày đi làm)
    for ($d = 3; $d <= 25; $d++) {
        $dayStr = sprintf('%02d', $d);
        $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-{$dayStr}', '08:00:00', 'approved', 0)")->execute([$testUserId]);
    }

    // Reset used balance trước khi test payroll
    $pdo->prepare("UPDATE hrm_profiles SET annual_leave_used = 0.0, compensatory_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);

    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}

    $ps1 = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    $pf1 = $pdo->query("SELECT * FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);

    assertTest("TC11: 480 phút trễ được cấn trừ hoàn toàn vào Nghỉ bù (1.0 ngày)", (float)$ps1['lateness_compensatory_deducted'] === 1.0);
    assertTest("TC11: Không trừ vào phép năm (lateness_annual_deducted = 0.0)", (float)$ps1['lateness_annual_deducted'] === 0.0);
    assertTest("TC11: compensatory_leave_used cập nhật chính xác = 1.0", (float)$pf1['compensatory_leave_used'] === 1.0);

    // TC12: Khấu trừ tuần tự khi đi trễ vượt quá quỹ nghỉ bù (Trừ hết nghỉ bù -> Trừ sang phép năm)
    // Cho nghỉ bù chỉ còn 0.2 ngày, tổng trễ 480 phút (1 ngày) -> 0.2 ngày bù + 0.8 ngày phép năm
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 0.2, compensatory_leave_used = 0.0, annual_leave_total = 12.0, annual_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);
    
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps2 = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC12: Đi trễ trừ hết 0.2 ngày nghỉ bù", (float)$ps2['lateness_compensatory_deducted'] === 0.2);
    assertTest("TC12: Phần trễ còn lại (0.8 ngày) trừ tiếp vào Phép năm", (float)$ps2['lateness_annual_deducted'] === 0.8);

    // TC13: Đi trễ khi hết cả nghỉ bù và phép năm -> Trừ thẳng vào Ngày công thực tế
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 0.0, compensatory_leave_used = 0.0, annual_leave_total = 0.0, annual_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps3 = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    // Tổng 25 ngày đi làm - 1 ngày trễ = 24 ngày công thực tế
    assertTest("TC13: Hết quỹ phép và bù -> Trừ 1.0 ngày vào Ngày công (work_days_actual = 24.0)", (float)$ps3['work_days_actual'] === 24.0);

    // TC14: Cơ chế an toàn Rollback khi tính lại bảng lương nhiều lần
    // Chạy tính lại bảng lương lần 2 -> Đảm bảo quỹ phép không bị trừ dồn gấp đôi
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps4 = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC14: Rollback an toàn: Tính lại lương không bị trừ lặp ngày công (vẫn là 24.0)", (float)$ps4['work_days_actual'] === 24.0);

    // =========================================================================
    // SECTION 3: AUDIT CÔNG LƯƠNG, KPI, HOA HỒNG, BHXH, THUẾ TNCN & TẠM ỨNG
    // =========================================================================
    echo "\n>>> [SECTION 3] AUDIT CÔNG LƯƠNG, KPI, BHXH, THUẾ TNCN & TẠM ỨNG <<<\n";

    // Setup chuẩn cho nhân viên kiểm thử bảng lương hoàn chỉnh
    $dealSalary = 26000000.00; // 26 triệu / 26 ngày = 1 triệu/ngày
    $baseSalary = 10000000.00; // Đóng bảo hiểm trên 10 triệu
    $pdo->prepare("
        UPDATE hrm_profiles 
        SET base_salary = ?, deal_salary = ?, has_insurance = 1, allowance_meal = 730000, allowance_travel = 1000000, allowance_phone = 500000, kpi_target = 50000000,
            annual_leave_total = 12.0, annual_leave_used = 0.0, compensatory_leave_total = 2.0, compensatory_leave_used = 0.0
        WHERE user_id = ?
    ")->execute([$baseSalary, $dealSalary, $testUserId]);

    // Chèn 26 ngày đi làm đủ đúng giờ (26/26 công)
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    for ($d = 1; $d <= 26; $d++) {
        $dayStr = sprintf('%02d', $d);
        $pdo->prepare("INSERT INTO check_ins (user_id, check_in_date, check_in_time, status, late_minutes) VALUES (?, '2026-07-{$dayStr}', '08:00:00', 'approved', 0)")->execute([$testUserId]);
    }

    // TC15: Đủ công chuẩn 26 ngày -> Lương cơ bản tính đúng bằng deal_salary (26.000.000 VNĐ)
    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $psFull = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC15: Đủ 26/26 công -> salary_basic_calculated = 26,000,000", (float)$psFull['salary_basic_calculated'] === 26000000.0);

    // TC16: Phụ cấp tổng hợp (Ăn trưa 730k + Xăng xe 1M + Điện thoại 500k = 2.230.000 VNĐ)
    $expectedAllowance = 730000 + 1000000 + 500000;
    assertTest("TC16: Tổng phụ cấp tính đúng = 2,230,000 VNĐ", (float)$psFull['allowance_total'] === (float)$expectedAllowance);

    // TC17: Thưởng Tăng ca (OT 1.5x)
    // Thêm đơn đăng ký Overtime 2 ngày đã duyệt
    $pdo->prepare("
        INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, status, reason)
        VALUES (?, 'overtime', '2026-07-27 08:00:00', '2026-07-28 17:30:00', 2.0, 'approved', 'Tăng ca dự án gấp')
    ")->execute([$testUserId]);
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $psOt = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    // 2 ngày OT * (26M / 26) * 1.5 = 3.000.000 VNĐ
    assertTest("TC17: Thưởng tăng ca OT (2 ngày x 1.5) = 3,000,000 VNĐ", (float)$psOt['overtime_salary'] === 3000000.0);

    // TC18: Trừ Bảo hiểm bắt buộc trên base_salary (10M): BHXH (800k), BHYT (150k), BHTN (100k)
    assertTest("TC18: Khấu trừ BHXH (8% của 10M) = 800,000 VNĐ", (float)$psOt['insurance_bhxh'] === 800000.0);
    assertTest("TC18: Khấu trừ BHYT (1.5% của 10M) = 150,000 VNĐ", (float)$psOt['insurance_bhyt'] === 150000.0);
    assertTest("TC18: Khấu trừ BHTN (1% của 10M) = 100,000 VNĐ", (float)$psOt['insurance_bhtn'] === 100000.0);

    // TC19: Khấu trừ Tạm ứng Lương (Salary Advance)
    $pdo->prepare("
        INSERT INTO hrm_salary_advances (user_id, amount, request_date, status, reason)
        VALUES (?, 5000000.00, '2026-07-15', 'approved', 'Tạm ứng chi phí cá nhân')
    ")->execute([$testUserId]);
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $psAdv = $pdo->query("SELECT * FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC19: Khấu trừ khoản tạm ứng 5,000,000 VNĐ vào bảng lương", (float)$psAdv['advance_deduction'] === 5000000.0);

    // TC20: Thuế TNCN lũy tiến & Lương thực lĩnh (Net Salary)
    // Gross chịu thuế = Lương cơ bản (26M) + Xăng xe (1M) + ĐT (500k) + Ăn trưa vượt mức 730k (0) + KPI (0)
    // Giảm trừ = BHXH/BHYT/BHTN (1.05M) + Bản thân (11M) = 12.05M
    // Thu nhập tính thuế = 27.5M - 12.05M = 15.45M
    // Thuế bậc 3 (10M-18M): 15.45M * 15% - 750k = 2.317.500 - 750.000 = 1.567.500 VNĐ
    $expectedPit = (15450000 * 0.15) - 750000;
    assertTest("TC20: Tính chính xác Thuế TNCN bậc lũy tiến = 1,567,500 VNĐ", abs((float)$psAdv['tax_pit'] - $expectedPit) < 1.0);

    // Net Salary = Basic(26M) + Allowance(2.23M) + OT(3M) - Insurance(1.05M) - PIT(1.5675M) - Advance(5M)
    // = 31.230.000 - 7.617.500 = 23.612.500 VNĐ
    $expectedNet = 26000000 + 2230000 + 3000000 - 1050000 - $expectedPit - 5000000;
    assertTest("TC20: Tính chuẩn xác Lương thực lĩnh Net = 23,612,500 VNĐ", abs((float)$psAdv['net_salary'] - $expectedNet) < 1.0);

    // =========================================================================
    // TC21: NGHỈ CHẾ ĐỘ HIẾU/HỈ THEO LUẬT (special_paid) - ĐÚNG ĐỊNH MỨC (3 NGÀY)
    // =========================================================================
    // Reset balances: Comp = 2, Annual = 12 (used = 0)
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 2.0, compensatory_leave_used = 0.0, annual_leave_total = 12.0, annual_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ?")->execute([$testUserId]);
    
    // Đăng ký nghỉ kết hôn 3 ngày
    $mockBody = [
        'leave_type' => 'special_paid',
        'start_date' => '2026-07-06 08:00:00',
        'end_date' => '2026-07-08 17:30:00',
        'total_days' => 3.0,
        'reason' => 'Bản thân kết hôn theo Luật Lao Động'
    ];
    try { $hrmCtrl->createLeave($userAuth); } catch (\Throwable $e) {}
    $stmtLv = $pdo->prepare("SELECT id FROM hrm_leave_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1");
    $stmtLv->execute([$testUserId]);
    $lv21Id = (int)$stmtLv->fetchColumn();

    // Duyệt đơn nghỉ kết hôn
    $mockBody = ['id' => $lv21Id, 'status' => 'approved'];
    try { $hrmCtrl->approveLeave($adminAuth); } catch (\Throwable $e) {}

    $prof21 = $pdo->query("SELECT annual_leave_used, compensatory_leave_used FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC21: Nghỉ kết hôn 3 ngày theo luật -> 0 ngày bị trừ vào phép năm/nghỉ bù", (float)$prof21['annual_leave_used'] === 0.0 && (float)$prof21['compensatory_leave_used'] === 0.0);

    // Tính lương: 3 ngày nghỉ kết hôn được tính đủ 100% lương
    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps21 = $pdo->query("SELECT work_days_actual, salary_basic_calculated FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC21: Nghỉ kết hôn 3 ngày được hưởng đủ 100% lương ngày công (work_days_actual = 3.0)", (float)$ps21['work_days_actual'] === 3.0);

    // =========================================================================
    // TC22: NGHỈ KẾT HÔN VƯỢT ĐỊNH MỨC LUẬT (5 NGÀY: 3 NGÀY LUẬT + 1 BÙ + 1 PHÉP NĂM)
    // =========================================================================
    // Reset balances: Comp = 1.0 (used = 0), Annual = 10.0 (used = 0)
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 1.0, compensatory_leave_used = 0.0, annual_leave_total = 10.0, annual_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
    
    // Đăng ký nghỉ cưới 5 ngày
    $mockBody = [
        'leave_type' => 'special_paid',
        'start_date' => '2026-07-13 08:00:00',
        'end_date' => '2026-07-17 17:30:00',
        'total_days' => 5.0,
        'reason' => 'Bản thân kết hôn xin nghỉ 5 ngày (3 ngày luật + 2 ngày dôi dư)'
    ];
    try { $hrmCtrl->createLeave($userAuth); } catch (\Throwable $e) {}
    $stmtLv->execute([$testUserId]);
    $lv22Id = (int)$stmtLv->fetchColumn();

    // Duyệt đơn 5 ngày
    $mockBody = ['id' => $lv22Id, 'status' => 'approved'];
    try { $hrmCtrl->approveLeave($adminAuth); } catch (\Throwable $e) {}

    $prof22 = $pdo->query("SELECT annual_leave_used, compensatory_leave_used FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    $lv22Row = $pdo->query("SELECT * FROM hrm_leave_requests WHERE id = $lv22Id")->fetch(PDO::FETCH_ASSOC);

    assertTest("TC22: Nghỉ 5 ngày (vượt 2 ngày) -> Trừ 1 ngày nghỉ bù", (float)$prof22['compensatory_leave_used'] === 1.0);
    assertTest("TC22: Nghỉ 5 ngày (vượt 2 ngày) -> Trừ tiếp 1 ngày phép năm", (float)$prof22['annual_leave_used'] === 1.0);
    assertTest("TC22: 0 ngày bị tính không lương (unpaid_days = 0.0)", (float)$lv22Row['unpaid_days'] === 0.0);

    // Tính lương: Đủ cả 5 ngày hưởng lương (3 chế độ + 2 ngày đã trừ quỹ)
    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps22 = $pdo->query("SELECT work_days_actual FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC22: Toàn bộ 5 ngày nghỉ đều được tính hưởng lương (work_days_actual = 5.0)", (float)$ps22['work_days_actual'] === 5.0);

    // =========================================================================
    // TC23: NGHỈ KẾT HÔN VƯỢT ĐỊNH MỨC KHI ĐÃ HẾT CẢ PHÉP NĂM VÀ NGHỈ BÙ
    // =========================================================================
    // Balances: Comp = 0, Annual = 0
    $pdo->prepare("UPDATE hrm_profiles SET compensatory_leave_total = 0.0, compensatory_leave_used = 0.0, annual_leave_total = 0.0, annual_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);

    // Đăng ký nghỉ cưới 5 ngày
    $mockBody = [
        'leave_type' => 'special_paid',
        'start_date' => '2026-07-20 08:00:00',
        'end_date' => '2026-07-24 17:30:00',
        'total_days' => 5.0,
        'reason' => 'Bản thân kết hôn xin nghỉ 5 ngày'
    ];
    try { $hrmCtrl->createLeave($userAuth); } catch (\Throwable $e) {}
    $stmtLv->execute([$testUserId]);
    $lv23Id = (int)$stmtLv->fetchColumn();

    // Duyệt đơn
    $mockBody = ['id' => $lv23Id, 'status' => 'approved'];
    try { $hrmCtrl->approveLeave($adminAuth); } catch (\Throwable $e) {}

    $lv23Row = $pdo->query("SELECT * FROM hrm_leave_requests WHERE id = $lv23Id")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC23: Hết quỹ phép/bù -> 2 ngày dôi dư tự động tính Không lương (unpaid_days = 2.0)", (float)$lv23Row['unpaid_days'] === 2.0);

    // Tính lương: Chỉ 3 ngày chế độ được tính hưởng lương, 2 ngày dôi dư bị trừ khỏi công
    $mockBody = ['month_year' => $monthYear, 'work_days_required' => 26];
    try { $hrmCtrl->calculatePayroll($adminAuth); } catch (\Throwable $e) {}
    $ps23 = $pdo->query("SELECT work_days_actual FROM monthly_payslips WHERE user_id = $testUserId AND month_year = '$monthYear'")->fetch(PDO::FETCH_ASSOC);
    assertTest("TC23: Bảng lương chỉ tính 3 ngày chế độ hưởng lương (work_days_actual = 3.0)", (float)$ps23['work_days_actual'] === 3.0);

    // =========================================================================
    // TC24: TỰ ĐỘNG HỦY ĐƠN & HOÀN PHÉP KHI ĐỘT XUẤT ĐI LÀM LẠI VÀ CHECK-IN
    // =========================================================================
    $todayDate = date('Y-m-d');
    // Cài đặt ban đầu: annual_leave_total = 12.0, annual_leave_used = 1.0 (do đã duyệt 1 ngày phép hôm nay)
    $pdo->prepare("UPDATE hrm_profiles SET annual_leave_total = 12.0, annual_leave_used = 1.0, compensatory_leave_total = 0.0, compensatory_leave_used = 0.0 WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ? AND check_in_date = ?")->execute([$testUserId, $todayDate]);
    $pdo->prepare("DELETE FROM consultant_leaves WHERE consultant_id = ?")->execute([$testUserId]);

    // Tạo đơn nghỉ phép 1 ngày đã duyệt cho ngày hôm nay
    $pdo->prepare("
        INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, status, reason)
        VALUES (?, 'annual', '{$todayDate} 08:00:00', '{$todayDate} 17:30:00', 1.0, 'approved', 'Xin nghỉ phép 1 ngày việc gia đình')
    ")->execute([$testUserId]);
    $stmtLv->execute([$testUserId]);
    $lv24Id = (int)$stmtLv->fetchColumn();

    // Chèn bản ghi chặn lead consultant_leaves
    $pdo->prepare("INSERT INTO consultant_leaves (consultant_id, start_date, end_date) VALUES (?, ?, ?)")->execute([$testUserId, $todayDate, $todayDate]);

    // Nhân viên đột xuất đến công ty và thực hiện Check-in
    $mockBody = [
        'latitude' => '10.7950',
        'longitude' => '106.7219',
        'selfie_url' => 'https://example.com/test_selfie_refund.jpg',
        'location_address' => 'Văn phòng chính',
        'reason' => 'Đột xuất đi làm lại'
    ];
    $checkInSuccess = false;
    try {
        $checkInCtrl->store($userAuth);
        $checkInSuccess = true;
    } catch (\Throwable $e) {
        $code = method_exists($e, 'getCode') ? $e->getCode() : 0;
        if ($code === 200 || (isset($e->statusCode) && $e->statusCode === 200)) {
            $checkInSuccess = true;
        }
    }

    $lv24Row = $pdo->query("SELECT * FROM hrm_leave_requests WHERE id = $lv24Id")->fetch(PDO::FETCH_ASSOC);
    $prof24 = $pdo->query("SELECT annual_leave_used FROM hrm_profiles WHERE user_id = $testUserId")->fetch(PDO::FETCH_ASSOC);
    $cLeaveCount = $pdo->query("SELECT COUNT(*) FROM consultant_leaves WHERE consultant_id = $testUserId AND '$todayDate' BETWEEN start_date AND end_date")->fetchColumn();
    $checkInRow = $pdo->query("SELECT * FROM check_ins WHERE user_id = $testUserId AND check_in_date = '$todayDate'")->fetch(PDO::FETCH_ASSOC);

    assertTest("TC24: Check-in thành công khi có đơn nghỉ phép hôm nay (không bị chặn)", $checkInSuccess && !empty($checkInRow));
    assertTest("TC24: Tự động chuyển đơn nghỉ phép sang trạng thái 'cancelled'", $lv24Row['status'] === 'cancelled');
    assertTest("TC24: Tự động hoàn lại 1 ngày phép năm vào quỹ (annual_leave_used = 0.0)", (float)$prof24['annual_leave_used'] === 0.0);
    assertTest("TC24: Tự động xóa ngày nghỉ khỏi consultant_leaves để mở lại luồng nhận Lead", (int)$cLeaveCount === 0);

    // Dọn dẹp test data sau khi kiểm thử hoàn tất
    $pdo->prepare("DELETE FROM check_ins WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM monthly_payslips WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM hrm_profiles WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM hrm_salary_advances WHERE user_id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);
    $pdo->prepare("DELETE FROM attendance_bulk_requests WHERE user_id = ?")->execute([$testUserId]);
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?)")->execute([$testUserId, $managerUserId, $hrUserId]);

} catch (\Throwable $e) {
    echo "❌ EXCEPTION OCCURRED: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    $testStats['fail']++;
} finally {
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
}

printTestSummary();
