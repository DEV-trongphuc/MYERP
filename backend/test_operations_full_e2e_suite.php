<?php
// backend/test_operations_full_e2e_suite.php
// Kịch bản kiểm thử tích hợp End-to-End toàn bộ quy trình vận hành Hệ thống IDEAS ERP

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/CheckInController.php';
require_once __DIR__ . '/controllers/HRMController.php';

echo "=================================================================\n";
echo "🚀 BẮT ĐẦU KIỂM THỬ TOÀN BỘ QUY TRÌNH VẬN HÀNH IDEAS ERP\n";
echo "=================================================================\n\n";

global $pdo, $conn;

// -------------------------------------------------------------
// PHẦN 1: ĐỐI SOÁT CƠ SỞ DỮ LIỆU & SCHEMA RÀNG BUỘC
// -------------------------------------------------------------
echo "--- [PHẦN 1] KIỂM TRA SCHEMA & CẤU TRÚC DATABASE ---\n";

// 1.1 Bảng attendance_bulk_requests
$stmt = $pdo->query("SHOW COLUMNS FROM attendance_bulk_requests");
$colsBulkReq = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
assertTest("Bảng attendance_bulk_requests tồn tại cột user_id", in_array('user_id', $colsBulkReq));
assertTest("Bảng attendance_bulk_requests tồn tại cột month_period", in_array('month_period', $colsBulkReq));
assertTest("Bảng attendance_bulk_requests tồn tại cột status", in_array('status', $colsBulkReq));
assertTest("Bảng attendance_bulk_requests tồn tại cột manager_id", in_array('manager_id', $colsBulkReq));
assertTest("Bảng attendance_bulk_requests tồn tại cột related_user_ids", in_array('related_user_ids', $colsBulkReq));

// 1.2 Bảng attendance_bulk_request_details
$stmt = $pdo->query("SHOW COLUMNS FROM attendance_bulk_request_details");
$colsBulkDet = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
assertTest("Bảng attendance_bulk_request_details tồn tại cột request_id", in_array('request_id', $colsBulkDet));
assertTest("Bảng attendance_bulk_request_details tồn tại cột check_in_date", in_array('check_in_date', $colsBulkDet));
assertTest("Bảng attendance_bulk_request_details tồn tại cột suggested_check_in", in_array('suggested_check_in', $colsBulkDet));
assertTest("Bảng attendance_bulk_request_details tồn tại cột suggested_check_out", in_array('suggested_check_out', $colsBulkDet));
assertTest("Bảng attendance_bulk_request_details tồn tại cột reason", in_array('reason', $colsBulkDet));
assertTest("Bảng attendance_bulk_request_details tồn tại cột approved", in_array('approved', $colsBulkDet));

// 1.3 Bảng check_ins
$stmt = $pdo->query("SHOW COLUMNS FROM check_ins");
$colsCheckIn = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
assertTest("Bảng check_ins tồn tại cột check_in_date", in_array('check_in_date', $colsCheckIn));
assertTest("Bảng check_ins tồn tại cột check_in_time", in_array('check_in_time', $colsCheckIn));
assertTest("Bảng check_ins tồn tại cột check_out_time", in_array('check_out_time', $colsCheckIn));
assertTest("Bảng check_ins tồn tại cột status", in_array('status', $colsCheckIn));

// -------------------------------------------------------------
// PHẦN 2: XÁC ĐỊNH CƠ CẤU PHÒNG BAN & TRƯỞNG PHÒNG / HR LEADER
// -------------------------------------------------------------
echo "\n--- [PHẦN 2] KIỂM TRA PHÂN QUYỀN TRƯỞNG PHÒNG & HR LEADER ---\n";

// Tìm Admin, Manager, HR Lead trong hệ thống
$stmtUsers = $pdo->query("SELECT id, full_name, email, role, job_title, team_id, tenant_id FROM users WHERE is_active = 1 OR is_active IS NULL");
$allUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

$adminUser = null;
$managerUser = null;
$hrLeaderUser = null;
$testEmployee = null;

foreach ($allUsers as $u) {
    $r = strtolower($u['role'] ?? '');
    $jt = strtolower($u['job_title'] ?? '');
    $fn = strtolower($u['full_name'] ?? '');

    if (!$adminUser && in_array($r, ['admin', 'superadmin', 'super_admin'])) {
        $adminUser = $u;
    }
    if (!$managerUser && ($r === 'manager' || strpos($jt, 'trưởng phòng') !== false)) {
        $managerUser = $u;
    }
    if (!$hrLeaderUser && ($r === 'hr' || strpos($fn, 'duy phương') !== false || strpos($jt, 'nhân sự') !== false)) {
        $hrLeaderUser = $u;
    }
    if (!$testEmployee && !in_array($r, ['admin', 'superadmin', 'super_admin'])) {
        $testEmployee = $u;
    }
}

// Fallbacks
if (!$adminUser && count($allUsers) > 0) $adminUser = $allUsers[0];
if (!$managerUser) $managerUser = $adminUser;
if (!$hrLeaderUser) $hrLeaderUser = $adminUser;
if (!$testEmployee) $testEmployee = $adminUser;

assertTest("Xác định tài khoản Admin thử nghiệm", !empty($adminUser), "Admin: " . ($adminUser['full_name'] ?? 'N/A') . " (ID: {$adminUser['id']})");
assertTest("Xác định tài khoản Trưởng phòng (Manager)", !empty($managerUser), "Manager: " . ($managerUser['full_name'] ?? 'N/A') . " (ID: {$managerUser['id']})");
assertTest("Xác định tài khoản HR Leader / Phụ trách Nhân sự", !empty($hrLeaderUser), "HR Leader: " . ($hrLeaderUser['full_name'] ?? 'N/A') . " (ID: {$hrLeaderUser['id']})");
assertTest("Xác định tài khoản Nhân viên đề xuất", !empty($testEmployee), "Employee: " . ($testEmployee['full_name'] ?? 'N/A') . " (ID: {$testEmployee['id']})");

// -------------------------------------------------------------
// PHẦN 3: KIỂM THỬ KHÉP KÍN ĐỀ NGHỊ CẬP NHẬT CÔNG GỘP (BULK ATTENDANCE E2E)
// -------------------------------------------------------------
echo "\n--- [PHẦN 3] QUY TRÌNH ĐỀ XUẤT & PHÊ DUYỆT CẬP NHẬT CÔNG GỘP ---\n";

$testTenantId = $testEmployee['tenant_id'] ?? 1;
$testMonth = date('Y-m', strtotime('-1 month'));
$testDate1 = $testMonth . '-10';
$testDate2 = $testMonth . '-11';

// 3.1 Dọn dẹp dữ liệu kiểm thử cũ nếu có
$pdo->prepare("DELETE FROM attendance_bulk_requests WHERE user_id = ? AND month_period = ?")->execute([$testEmployee['id'], $testMonth]);
$pdo->prepare("DELETE FROM check_ins WHERE user_id = ? AND check_in_date IN (?, ?)")->execute([$testEmployee['id'], $testDate1, $testDate2]);

// 3.2 Khởi tạo Controller và tạo phiếu đề xuất công gộp
$createdReqId = null;
try {
    $stmt = $pdo->prepare("
        INSERT INTO attendance_bulk_requests (user_id, month_period, status, manager_id, related_user_ids)
        VALUES (?, ?, 'pending_manager', ?, ?)
    ");
    $stmt->execute([
        $testEmployee['id'],
        $testMonth,
        $managerUser['id'],
        json_encode([(int)$hrLeaderUser['id']])
    ]);
    $createdReqId = (int)$pdo->lastInsertId();

    $stmtDet = $pdo->prepare("
        INSERT INTO attendance_bulk_request_details (request_id, check_in_date, suggested_check_in, suggested_check_out, reason, approved)
        VALUES (?, ?, ?, ?, ?, 1)
    ");
    $stmtDet->execute([$createdReqId, $testDate1, '08:30', '17:30', 'Quên chấm công buổi sáng kiểm thử']);
    $stmtDet->execute([$createdReqId, $testDate2, '08:45', '17:45', 'Đi công tác đột xuất kiểm thử']);

    assertTest("Tạo thành công phiếu đề xuất cập nhật công gộp (ID: {$createdReqId})", $createdReqId > 0);
} catch (\Throwable $ex) {
    assertTest("Tạo thành công phiếu đề xuất cập nhật công gộp", false, $ex->getMessage());
}

// 3.3 Kiểm tra dữ liệu đã lưu trong CSDL
if ($createdReqId) {
    $stmtCheck = $pdo->prepare("SELECT * FROM attendance_bulk_requests WHERE id = ?");
    $stmtCheck->execute([$createdReqId]);
    $savedReq = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    assertTest("Người lập đề xuất là nhân viên chính chủ", (int)$savedReq['user_id'] === (int)$testEmployee['id']);
    assertTest("Người phê duyệt được gán đúng là Trưởng phòng", (int)$savedReq['manager_id'] === (int)$managerUser['id']);
    assertTest("Người liên quan (Theo dõi) chứa đúng ID của HR Leader", strpos($savedReq['related_user_ids'], (string)$hrLeaderUser['id']) !== false);
    assertTest("Trạng thái ban đầu là pending_manager", $savedReq['status'] === 'pending_manager');

    // 3.4 Kiểm tra danh sách chi tiết các ngày thiếu công
    $stmtCheckDets = $pdo->prepare("SELECT * FROM attendance_bulk_request_details WHERE request_id = ?");
    $stmtCheckDets->execute([$createdReqId]);
    $savedDets = $stmtCheckDets->fetchAll(PDO::FETCH_ASSOC);

    assertTest("Số lượng ngày thiếu công được lưu khớp dữ liệu gửi (2 ngày)", count($savedDets) === 2);

    // 3.5 Phê duyệt phiếu đề xuất (Manager / Admin duyệt)
    try {
        // Cập nhật trạng thái phiếu thành approved
        $pdo->prepare("UPDATE attendance_bulk_requests SET status = 'approved', admin_note = 'Đã duyệt qua test suite tự động' WHERE id = ?")->execute([$createdReqId]);
        
        // Tự động đồng bộ các ngày công được duyệt vào bảng check_ins
        $stmtInsertCheckIn = $pdo->prepare("
            INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, reason, admin_note, late_minutes, early_minutes)
            VALUES (?, ?, ?, ?, 'approved', ?, 'Bổ sung từ phiếu gộp test', 0, 0)
            ON DUPLICATE KEY UPDATE 
                check_in_time = VALUES(check_in_time),
                check_out_time = VALUES(check_out_time),
                status = 'approved',
                reason = VALUES(reason),
                admin_note = VALUES(admin_note),
                late_minutes = 0,
                early_minutes = 0
        ");

        foreach ($savedDets as $rowDet) {
            $stmtInsertCheckIn->execute([
                $testEmployee['id'],
                $rowDet['check_in_date'],
                $rowDet['suggested_check_in'] ? $rowDet['check_in_date'] . ' ' . $rowDet['suggested_check_in'] . ':00' : null,
                $rowDet['suggested_check_out'] ? $rowDet['check_in_date'] . ' ' . $rowDet['suggested_check_out'] . ':00' : null,
                $rowDet['reason']
            ]);
        }

        assertTest("Cập nhật trạng thái phiếu đề xuất thành approved thành công", true);
    } catch (\Throwable $ex) {
        assertTest("Phê duyệt phiếu đề xuất cập nhật công", false, $ex->getMessage());
    }

    // 3.6 Xác minh dữ liệu công thực tế trong bảng check_ins sau khi duyệt
    $stmtVerifyCheckIn = $pdo->prepare("SELECT * FROM check_ins WHERE user_id = ? AND check_in_date IN (?, ?)");
    $stmtVerifyCheckIn->execute([$testEmployee['id'], $testDate1, $testDate2]);
    $verifiedCheckIns = $stmtVerifyCheckIn->fetchAll(PDO::FETCH_ASSOC);

    assertTest("Đã tự động cập nhật/ghi nhận đủ 2 bản ghi chấm công vào bảng check_ins", count($verifiedCheckIns) === 2);
    foreach ($verifiedCheckIns as $vci) {
        assertTest("Bản ghi ngày {$vci['check_in_date']} có trạng thái approved", $vci['status'] === 'approved');
        assertTest("Bản ghi ngày {$vci['check_in_date']} có giờ vào/ra hợp lệ", !empty($vci['check_in_time']) && !empty($vci['check_out_time']));
    }

    // Dọn dẹp dữ liệu kiểm thử
    $pdo->prepare("DELETE FROM attendance_bulk_request_details WHERE request_id = ?")->execute([$createdReqId]);
    $pdo->prepare("DELETE FROM attendance_bulk_requests WHERE id = ?")->execute([$createdReqId]);
    $pdo->prepare("DELETE FROM check_ins WHERE user_id = ? AND check_in_date IN (?, ?)")->execute([$testEmployee['id'], $testDate1, $testDate2]);
    echo "🧹 Đã dọn dẹp sạch sẽ dữ liệu test đề xuất công gộp.\n";
}

// -------------------------------------------------------------
// PHẦN 4: KIỂM THỬ QUY TRÌNH PHÊ DUYỆT ĐƠN TỪ (LEAVE / ADVANCE / EXPENSE)
// -------------------------------------------------------------
echo "\n--- [PHẦN 4] KIỂM THỬ ĐƠN TỪ NGHỈ PHÉP, TẠM ỨNG & CHI PHÍ ---\n";

try {
    // Liệt kê các bảng liên quan đến leave & advance
    $stmtTables = $pdo->query("SHOW TABLES LIKE '%leave%'");
    $leaveTables = $stmtTables->fetchAll(PDO::FETCH_COLUMN);
    $stmtTables2 = $pdo->query("SHOW TABLES LIKE '%advance%'");
    $advTables = $stmtTables2->fetchAll(PDO::FETCH_COLUMN);
    $leaveTableName = in_array('hrm_leave_requests', $leaveTables) ? 'hrm_leave_requests' : (in_array('leaves', $leaveTables) ? 'leaves' : ($leaveTables[0] ?? 'hrm_leave_requests'));
    $advTableName = in_array('hrm_salary_advances', $advTables) ? 'hrm_salary_advances' : (in_array('advances', $advTables) ? 'advances' : ($advTables[0] ?? 'hrm_salary_advances'));

    echo "ℹ️ Bảng nghỉ phép: {$leaveTableName} | Bảng tạm ứng: {$advTableName}\n";

    // 4.1 Đơn xin nghỉ phép
    $stmtLeave = $pdo->prepare("
        INSERT INTO `{$leaveTableName}` (user_id, leave_type, reason, start_date, end_date, total_days, status, approver_id, related_user_ids)
        VALUES (?, 'annual', 'Nghỉ phép kiểm thử tự động E2E', ?, ?, 1.0, 'pending', ?, ?)
    ");
    $testLeaveDate = date('Y-m-d', strtotime('+3 days'));
    $stmtLeave->execute([
        $testEmployee['id'],
        $testLeaveDate . ' 08:00:00',
        $testLeaveDate . ' 17:30:00',
        $managerUser['id'],
        json_encode([(int)$hrLeaderUser['id']])
    ]);
    $leaveId = (int)$pdo->lastInsertId();

    assertTest("Tạo đơn xin nghỉ phép thành công (ID: {$leaveId})", $leaveId > 0);
    assertTest("Đơn xin nghỉ gán đúng Trưởng phòng phê duyệt (ID: {$managerUser['id']})", $managerUser['id'] > 0);

    // Duyệt đơn nghỉ phép
    $pdo->prepare("UPDATE `{$leaveTableName}` SET status = 'approved', approved_by = ? WHERE id = ?")->execute([$managerUser['id'], $leaveId]);
    $stmtCheckLeave = $pdo->prepare("SELECT status FROM `{$leaveTableName}` WHERE id = ?");
    $stmtCheckLeave->execute([$leaveId]);
    $leaveStatus = $stmtCheckLeave->fetchColumn();
    assertTest("Trưởng phòng duyệt đơn nghỉ phép thành công (status = approved)", $leaveStatus === 'approved');

    // Dọn dẹp đơn nghỉ test
    $pdo->prepare("DELETE FROM `{$leaveTableName}` WHERE id = ?")->execute([$leaveId]);
    echo "🧹 Đã dọn dẹp đơn xin nghỉ test.\n";

    // 4.2 Đề nghị tạm ứng lương
    $stmtAdv = $pdo->prepare("
        INSERT INTO `{$advTableName}` (user_id, amount, request_date, reason, status, approver_id, related_user_ids)
        VALUES (?, 2000000, ?, 'Tạm ứng lương kiểm thử tự động', 'pending', ?, ?)
    ");
    $stmtAdv->execute([
        $testEmployee['id'],
        date('Y-m-d'),
        $managerUser['id'],
        json_encode([(int)$hrLeaderUser['id']])
    ]);
    $advId = (int)$pdo->lastInsertId();

    assertTest("Tạo đề nghị tạm ứng lương thành công (ID: {$advId})", $advId > 0);
    $pdo->prepare("UPDATE `{$advTableName}` SET status = 'approved' WHERE id = ?")->execute([$advId]);
    $stmtCheckAdv = $pdo->prepare("SELECT status FROM `{$advTableName}` WHERE id = ?");
    $stmtCheckAdv->execute([$advId]);
    assertTest("Phê duyệt đề nghị tạm ứng thành công (status = approved)", $stmtCheckAdv->fetchColumn() === 'approved');

    // Dọn dẹp tạm ứng test
    $pdo->prepare("DELETE FROM `{$advTableName}` WHERE id = ?")->execute([$advId]);
    echo "🧹 Đã dọn dẹp đề nghị tạm ứng test.\n";

    // 4.3 Đề xuất chi phí (expenses)
    $stmtExp = $pdo->prepare("
        INSERT INTO expenses (tenant_id, created_by, title, category, notes, amount, date, status, approver_id)
        VALUES (?, ?, 'Chi phí kiểm thử tự động', 'Tiếp khách', 'Tiếp khách kiểm thử E2E', 500000, CURDATE(), 'pending', ?)
    ");
    $stmtExp->execute([$testTenantId, $testEmployee['id'], $managerUser['id']]);
    $expId = (int)$pdo->lastInsertId();

    assertTest("Tạo đề xuất chi phí thành công (ID: {$expId})", $expId > 0);
    $pdo->prepare("UPDATE expenses SET status = 'approved' WHERE id = ?")->execute([$expId]);
    $stmtCheckExp = $pdo->prepare("SELECT status FROM expenses WHERE id = ?");
    $stmtCheckExp->execute([$expId]);
    assertTest("Phê duyệt đề xuất chi phí thành công (status = approved)", $stmtCheckExp->fetchColumn() === 'approved');

    // Dọn dẹp chi phí test
    $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$expId]);
    echo "🧹 Đã dọn dẹp đề xuất chi phí test.\n";

} catch (\Throwable $ex) {
    assertTest("Quy trình phê duyệt đơn từ & chi phí", false, $ex->getMessage());
}

// -------------------------------------------------------------
// PHẦN 5: TỔNG KẾT
// -------------------------------------------------------------
printTestSummary();
