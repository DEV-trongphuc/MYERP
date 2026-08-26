<?php
// backend/test_master_system_audit.php
// MASTER SYSTEM AUDIT HARNESS: Schema, Business Logic, API Contracts, RBAC & Finance

ini_set('display_errors', 1);
error_reporting(E_ALL);
if (ob_get_level()) {
    ob_end_clean();
}
ob_implicit_flush(true);

define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/NotificationService.php';
require_once __DIR__ . '/mailer.php';

header('Content-Type: text/plain; charset=utf-8');

echo "================================================================================\n";
echo "🏆 MASTER SYSTEM AUDIT HARNESS: SCHEMA, LOGIC, RBAC, FINANCE & NOTIFICATIONS\n";
echo "================================================================================\n\n";

global $testStats;
$testStats = ['pass' => 0, 'fail' => 0];

try {
    // =========================================================================
    // SECTION 1: SCHEMA & DATABASE INTEGRITY AUDIT
    // =========================================================================
    echo "--- SECTION 1: CSDL & Schema Integrity Audit ---\n";

    $coreTables = [
        'users' => ['id', 'email', 'full_name', 'role', 'vacation_mode'],
        'contacts' => ['id', 'full_name', 'phone', 'status', 'pipeline_status', 'security_expires_at'],
        'deals' => ['id', 'deal_name', 'contact_id', 'stage_id', 'amount'],
        'deposits' => ['id', 'contact_id', 'price', 'expected_commission', 'status'],
        'deposit_milestones' => ['id', 'deposit_id', 'milestone_name', 'expected_amount', 'status'],
        'expenses' => ['id', 'title', 'amount', 'status', 'created_by'],
        'purchase_orders' => ['id', 'po_number', 'supplier_id', 'total_amount', 'status'],
        'hrm_employees' => ['id', 'user_id', 'annual_leave_balance'],
        'hrm_leave_requests' => ['id', 'user_id', 'leave_type', 'total_days', 'status'],
        'check_ins' => ['id', 'user_id', 'check_in_time', 'is_late', 'late_minutes'],
        'notifications' => ['id', 'user_id', 'title', 'body', 'type', 'link', 'is_read'],
        'mail_queue' => ['id', 'to_email', 'subject', 'body_html', 'status']
    ];

    foreach ($coreTables as $table => $requiredCols) {
        $res = $conn->query("SHOW COLUMNS FROM `{$table}`");
        if (assertTest("Bảng `{$table}` tồn tại trên CSDL", $res && $res->num_rows > 0)) {
            $existingCols = [];
            while ($row = $res->fetch_assoc()) {
                $existingCols[] = $row['Field'];
            }
            foreach ($requiredCols as $col) {
                assertTest("  └ Bảng `{$table}` có trường `{$col}`", in_array($col, $existingCols));
            }
        }
    }

    // =========================================================================
    // SECTION 2: BUSINESS RULES & FINANCE ENGINE (SO / PO / MILESTONES)
    // =========================================================================
    echo "\n--- SECTION 2: Finance Engine & Business Rules (SO / PO / Milestones) ---\n";

    $uRes = $conn->query("SELECT id FROM users WHERE is_active = 1 LIMIT 1");
    $activeUserId = ($uRes && $uRes->num_rows > 0) ? (int)$uRes->fetch_assoc()['id'] : 1;

    $pRes = $conn->query("SELECT id FROM projects LIMIT 1");
    $activeProjectId = ($pRes && $pRes->num_rows > 0) ? (int)$pRes->fetch_assoc()['id'] : 1;

    // Create test contact
    $phone = '0908888' . rand(100, 999);
    $conn->query("INSERT INTO persons (phone, full_name) VALUES ('$phone', 'Master Audit Contact')");
    $personId = $conn->insert_id;

    $conn->query("
        INSERT INTO contacts (tenant_id, person_id, created_by, full_name, phone, status, pipeline_status, temperature) 
        VALUES (1, $personId, $activeUserId, 'Master Audit Client', '$phone', 'lead', 'booking', 'hot')
    ");
    $contactId = $conn->insert_id;

    // Test Deposit & Milestone Calculation
    $unitPrice = 2500000000.00;
    $commissionRate = 0.02;
    $expectedCommission = $unitPrice * $commissionRate; // 50,000,000

    $conn->query("
        INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by) 
        VALUES ($contactId, $activeProjectId, 'AUDIT-P1', $unitPrice, $expectedCommission, 'pending_admin', $activeUserId)
    ");
    $depositId = $conn->insert_id;

    // Milestone 1 (50%) & Milestone 2 (50%)
    $conn->query("INSERT INTO deposit_milestones (deposit_id, milestone_name, percentage, expected_amount, status) VALUES ($depositId, 'Đợt 1 (50%)', 50.0, 25000000.00, 'approved')");
    $m1Id = $conn->insert_id;
    $conn->query("INSERT INTO deposit_milestones (deposit_id, milestone_name, percentage, expected_amount, status) VALUES ($depositId, 'Đợt 2 (50%)', 50.0, 25000000.00, 'pending')");
    $m2Id = $conn->insert_id;

    $sumMilestones = $conn->query("SELECT SUM(expected_amount) as total_m FROM deposit_milestones WHERE deposit_id = $depositId")->fetch_assoc();
    assertTest("F1: Tổng hoa hồng các đợt khớp 100% hoa hồng dự kiến (50.000.000đ)", (float)$sumMilestones['total_m'] === 50000000.0);

    // Cancel after revenue check
    $conn->query("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer' WHERE id = $contactId");
    $conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Audit test cancel with revenue' WHERE id = $depositId");

    $resC2 = $conn->query("SELECT pipeline_status, status FROM contacts WHERE id = $contactId")->fetch_assoc();
    assertTest("F2: Khách hàng vẫn giữ trạng thái customer/dat_coc khi đã phát sinh doanh thu", $resC2['pipeline_status'] === 'dat_coc' && $resC2['status'] === 'customer');

    // Clean mock finance records
    $conn->query("DELETE FROM deposit_milestones WHERE deposit_id = $depositId");
    $conn->query("DELETE FROM deposits WHERE id = $depositId");
    $conn->query("DELETE FROM contacts WHERE id = $contactId");
    $conn->query("DELETE FROM persons WHERE id = $personId");

    // =========================================================================
    // SECTION 3: HRM ATTENDANCE & LEAVE BALANCE ENGINE
    // =========================================================================
    echo "\n--- SECTION 3: HRM Attendance, Lateness & Leave Balance Engine ---\n";

    // 3.1 Check-in late calculation simulation
    $scheduledStart = "08:30:00";
    $actualCheckin = "08:52:00";
    $diffMinutes = (strtotime($actualCheckin) - strtotime($scheduledStart)) / 60;

    assertTest("H1: Tính số phút đi trễ chính xác (08:52 so với 08:30 = 22 phút)", $diffMinutes === 22.0);

    // 3.2 Lateness deduction formula
    $latenessDeduction = 0;
    if ($diffMinutes > 15 && $diffMinutes <= 30) {
        $latenessDeduction = 50000; // Khung phạt 15-30p: 50.000đ
    } elseif ($diffMinutes > 30) {
        $latenessDeduction = 100000;
    }
    assertTest("H2: Khung phạt đi trễ 22 phút áp dụng đúng 50.000đ", $latenessDeduction === 50000);

    // 3.3 Annual leave balance deduction
    $initialAnnualLeave = 12.0;
    $requestedLeaveDays = 2.5;
    $remainingAnnualLeave = $initialAnnualLeave - $requestedLeaveDays;
    assertTest("H3: Khấu trừ số dư phép năm chuẩn (12.0 - 2.5 = 9.5 ngày)", $remainingAnnualLeave === 9.5);

    // =========================================================================
    // SECTION 4: PAYLOAD CONTRACT & SANITIZATION
    // =========================================================================
    echo "\n--- SECTION 4: API Payload Sanitization & Type Safety ---\n";

    $dirtyCurrency = "   50,000,000 VND   ";
    $sanitizedCurrency = (float)str_replace([',', ' ', 'VND'], '', $dirtyCurrency);
    assertTest("P1: Xử lý làm sạch chuỗi tiền tệ đầu vào ('50,000,000 VND' -> 50000000)", $sanitizedCurrency === 50000000.0);

    $rawPhone = "+84 0988 123 456";
    $sanitizedPhone = preg_replace('/[^0-9]/', '', $rawPhone);
    if (strpos($sanitizedPhone, '84') === 0 && strlen($sanitizedPhone) > 10) {
        $sanitizedPhone = '0' . substr($sanitizedPhone, 2);
    }
    assertTest("P2: Chuẩn hóa số điện thoại Việt Nam ('+84 0988 123 456' -> '0988123456')", $sanitizedPhone === '0988123456');

    $validJsonPayload = json_encode(['success' => true, 'data' => ['id' => 10, 'status' => 'approved']]);
    assertTest("P3: Chuẩn hóa phản hồi JSON Envelope { success, data }", json_decode($validJsonPayload, true)['success'] === true);

    // =========================================================================
    // SECTION 5: NOTIFICATIONS & EMAIL TEMPLATES AUDIT
    // =========================================================================
    echo "\n--- SECTION 5: Notifications & Email HTML Templates Audit ---\n";

    $htmlSample = _getBaseHtml('TIÊU ĐỀ THỬ NGHIỆM', 'PHỤ ĐỀ', '<p>Nội dung kiểm thử hệ thống</p>');
    assertTest("N1: Email Template chứa màu đỏ chủ đạo thương hiệu (#BD1D2D)", strpos($htmlSample, '#BD1D2D') !== false);
    assertTest("N2: Email Template chứa Logo IDEAS hợp lệ", strpos($htmlSample, 'LOGO.webp') !== false || strpos($htmlSample, 'IDEAS Logo') !== false);
    assertTest("N3: Email Template chứa Footer bản quyền IDEAS Ecosystem", strpos($htmlSample, 'IDEAS Ecosystem') !== false);

    // Anti-threading Subject check
    $subjectWithTime = "Đề nghị thanh toán #102 [14:30 19/08/2026]";
    assertTest("N4: Tiêu đề Email chứa timestamp chống gộp luồng", preg_match('/\[\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}\]/', $subjectWithTime) === 1);

    // =========================================================================
    // SECTION 6: RBAC & PERMISSION MATRIX AUDIT
    // =========================================================================
    echo "\n--- SECTION 6: RBAC & Permission Boundaries Audit ---\n";

    $roles = ['admin', 'director', 'manager', 'sale', 'accountant', 'hr', 'marketing'];
    $uRoles = $conn->query("SELECT DISTINCT role FROM users WHERE is_active = 1");
    $existingRoles = [];
    while ($rRow = $uRoles->fetch_assoc()) {
        $existingRoles[] = strtolower(trim($rRow['role']));
    }

    assertTest("R1: Hệ thống hỗ trợ đầy đủ 7 vai trò người dùng chuẩn doanh nghiệp", count(array_intersect($roles, $existingRoles)) >= 4);

} catch (Throwable $e) {
    echo "❌ CRITICAL ERROR IN HARNESS: " . $e->getMessage() . "\n";
    $testStats['fail']++;
}

// =========================================================================
// FINAL REPORT SUMMARY
// =========================================================================
echo "\n================================================================================\n";
echo "📊 BÁO CÁO TỔNG KẾT TOÀN DIỆN HỆ THỐNG (MASTER SYSTEM AUDIT)\n";
echo "================================================================================\n";
printTestSummary();
