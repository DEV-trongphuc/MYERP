<?php
// backend/test_master_notification_audit.php
// Master Test Suite for Notification System and Email Dispatch across IDEAS ERP

define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/NotificationService.php';
require_once __DIR__ . '/mailer.php';

echo "================================================================================\n";
echo "🚀 BẮT ĐẦU AUDIT TOÀN DIỆN HỆ THỐNG THÔNG BÁO & EMAIL (MASTER NOTIFICATION SUITE)\n";
echo "================================================================================\n\n";

// 1. Fetch test user
$userQuery = $conn->query("SELECT id, email, full_name, role FROM users WHERE is_active = 1 LIMIT 1");
$userRow = $userQuery->fetch_assoc();
$userId = $userRow ? (int)$userRow['id'] : 1;
$userEmail = $userRow ? $userRow['email'] : 'test@ideas.com.vn';
$userName = $userRow ? $userRow['full_name'] : 'Nhân Viên Kiểm Thử';

echo "👤 Người dùng thực thi kiểm thử: [ID: $userId] {$userName} ({$userEmail}) - Role: {$userRow['role']}\n\n";

// Clear test user's notifications before run
$conn->query("DELETE FROM notifications WHERE user_id = $userId");
$conn->query("DELETE FROM mail_queue WHERE to_email = '{$userEmail}' OR to_email = 'audit_test@ideas.com.vn'");

// Generic audit function for NotificationService events
function auditEvent($pdo, $conn, $userId, $userRow, $eventType, $payload, $expectedInAppKeywords, $expectedEmailKeywords = []) {
    echo "\n--------------------------------------------------------------------------------\n";
    echo "📌 SỰ KIỆN: {$eventType}\n";
    echo "--------------------------------------------------------------------------------\n";

    if (!isset($payload['user_id'])) {
        $payload['user_id'] = $userId;
    }
    if (!isset($payload['user_name'])) {
        $payload['user_name'] = $userRow['full_name'];
    }

    // Force recipient to test user
    $payload['recipients'] = [
        [
            'id' => $userId,
            'email' => $userRow['email'],
            'full_name' => $userRow['full_name'],
            'zalo_chat_id' => 'test_zalo_123',
            'telegram_chat_id' => 'test_tg_123'
        ]
    ];

    // Trigger NotificationService
    $sendSuccess = false;
    try {
        NotificationService::send($pdo, 1, $eventType, $payload);
        $sendSuccess = true;
        assertTest("1. NotificationService::send({$eventType}) thực thi thành công không có exception", true);
    } catch (\Throwable $e) {
        assertTest("1. NotificationService::send({$eventType}) thực thi thành công", false, $e->getMessage());
        return;
    }

    // Check In-App Notification (Database table: notifications)
    $resNotif = $conn->query("SELECT * FROM notifications WHERE user_id = $userId ORDER BY id DESC LIMIT 1");
    $notif = $resNotif ? $resNotif->fetch_assoc() : null;

    if (assertTest("2. Bản ghi In-App Bell được lưu vào bảng notifications", $notif !== null)) {
        echo "   • Tiêu đề: {$notif['title']}\n";
        echo "   • Nội dung: {$notif['body']}\n";
        echo "   • Link: {$notif['link']}\n";
        echo "   • Phân loại (type): {$notif['type']}\n";

        $matchedKeywords = true;
        foreach ($expectedInAppKeywords as $kw) {
            if (mb_strpos($notif['title'], $kw) === false && mb_strpos($notif['body'], $kw) === false && mb_strpos($notif['link'], $kw) === false) {
                $matchedKeywords = false;
                echo "   ⚠️ Thiếu từ khóa In-App: '{$kw}'\n";
            }
        }
        assertTest("3. Nội dung In-App Bell chứa đầy đủ thông tin nhận diện", $matchedKeywords);
    }

    // Check Email Template Resolution via private reflection or simulated direct check
    $refMethod = new ReflectionMethod('NotificationService', 'resolveEventData');
    $refMethod->setAccessible(true);
    $resolved = $refMethod->invoke(null, $pdo, 1, $eventType, $payload);

    if (assertTest("4. resolveEventData trả về cấu trúc Email hợp lệ", $resolved !== null && !empty($resolved['email_subject']))) {
        echo "   • Email Subject: {$resolved['email_subject']}\n";
        echo "   • Email Title: {$resolved['email_title']}\n";
        echo "   • Email Content length: " . strlen($resolved['email_content']) . " bytes\n";

        $matchedEmailKeywords = true;
        foreach ($expectedEmailKeywords as $ekw) {
            if (mb_strpos($resolved['email_subject'], $ekw) === false && mb_strpos($resolved['email_content'], $ekw) === false) {
                $matchedEmailKeywords = false;
                echo "   ⚠️ Thiếu từ khóa Email: '{$ekw}'\n";
            }
        }
        assertTest("5. Nội dung Email chứa đúng từ khóa chuyên biệt", $matchedEmailKeywords);
    }

    // Clean up test in-app notification
    $conn->query("DELETE FROM notifications WHERE user_id = $userId");
}

// ==============================================================================
// 1. KIỂM THỬ PHÂN HỆ: BÀN LÀM VIỆC (WORKSPACE / TASKS / MENTIONS)
// ==============================================================================
echo "\n================================================================================\n";
echo "📋 PHÂN HỆ 1: BÀN LÀM VIỆC & NHIỆM VỤ (WORKSPACE, TASKS, MENTIONS)\n";
echo "================================================================================\n";

auditEvent($pdo, $conn, $userId, $userRow, 'WORKFLOW_TASK_ASSIGNED', [
    'task_title' => 'Gửi báo giá dự án Alpha cho khách hàng VIP',
    'due_date' => '2026-08-25',
    'reason' => 'Khách hàng yêu cầu phản hồi trước 17h'
], ['Gửi báo giá dự án Alpha', '2026-08-25'], ['Gửi báo giá dự án Alpha', '2026-08-25']);

auditEvent($pdo, $conn, $userId, $userRow, 'MENTION_TAGGED', [
    'author_name' => 'Trần Thị B',
    'comment' => '@' . $userName . ' Vui lòng kiểm tra lại tiến độ thanh toán đợt 2',
    'link' => '/deals?id=505'
], ['Trần Thị B', 'nhắc tên bạn', '/deals?id=505'], ['Trần Thị B', 'tiến độ thanh toán']);

auditEvent($pdo, $conn, $userId, $userRow, 'SECURITY_DEADLINE_WARNING', [
    'customer_name' => 'Công ty TNHH Đầu Tư Địa Ốc Phú Quý',
    'deadline' => '12h'
], ['Địa Ốc Phú Quý', 'bảo mật', '12h'], ['Địa Ốc Phú Quý', '12h']);

auditEvent($pdo, $conn, $userId, $userRow, 'TICKET_NEW', [
    'ticket_id' => '1042',
    'subject' => 'Lỗi không hiển thị bản đồ dự án',
    'priority' => 'Cao',
    'reason' => 'Bản đồ vệ tinh không load được'
], ['Ticket #1042', 'Lỗi không hiển thị bản đồ dự án', '/support-tickets'], ['Ticket #1042', 'Bản đồ']);

auditEvent($pdo, $conn, $userId, $userRow, 'LEAD_ASSIGNMENT', [
    'customer_name' => 'Nguyễn Hoàng Nam',
    'phone' => '0988123456'
], ['Khách hàng mới được phân bổ', '/sale-portal'], ['phân bổ khách hàng mới', 'Sale Portal']);


// ==============================================================================
// 2. KIỂM THỬ PHÂN HỆ: QUY TRÌNH & PHÊ DUYỆT (APPROVALS & MULTI-LEVEL WORKFLOWS)
// ==============================================================================
echo "\n================================================================================\n";
echo "📋 PHÂN HỆ 2: QUY TRÌNH & PHÊ DUYỆT (APPROVALS & WORKFLOWS)\n";
echo "================================================================================\n";

auditEvent($pdo, $conn, $userId, $userRow, 'APPROVAL_REMINDER', [
    'sender_name' => 'Lê Văn C',
    'item_title' => 'Đề nghị thanh toán chi phí tiếp khách #889',
    'item_id' => 889,
    'item_type' => 'expense',
    'message' => 'Nhờ anh duyệt gấp để kế toán kịp chi trong ngày'
], ['Đề nghị thanh toán chi phí tiếp khách #889', 'Lê Văn C', '/approvals?open_id=889'], ['Đề nghị thanh toán', 'Lê Văn C']);

auditEvent($pdo, $conn, $userId, $userRow, 'COOPERATION_PENDING_APPROVAL', [
    'slip_id' => '301',
], ['Phiếu hợp tác #301', 'chờ phê duyệt', '/cooperation-slips'], ['Phiếu hợp tác #301', 'chữ ký']);

auditEvent($pdo, $conn, $userId, $userRow, 'COOP_INVITATION', [
    'customer_name' => 'Phạm Băng Băng',
    'slip_id' => 305,
    'share_pct' => '35',
    'inviter_name' => 'Hoàng Thùy Linh'
], ['Phiếu hợp tác #305', 'Phạm Băng Băng', '/sale-portal'], ['Phiếu hợp tác #305', 'Phạm Băng Băng']);


// ==============================================================================
// 3. KIỂM THỬ PHÂN HỆ: PURCHASE ORDERS (PO - CHI PHÍ, MUA SẮM)
// ==============================================================================
echo "\n================================================================================\n";
echo "📋 PHÂN HỆ 3: PURCHASE ORDERS (PO - CHI PHÍ, MUA SẮM)\n";
echo "================================================================================\n";

auditEvent($pdo, $conn, $userId, $userRow, 'EXPENSE_REQUEST', [
    'title' => 'Mua thiết bị máy in văn phòng',
    'amount' => 12500000,
    'ref_id' => 450,
    'reason' => 'Máy in cũ bị hỏng đầu kim'
], ['yêu cầu chi phí', '12.500.000', '/approvals?open_id=450'], ['Mua thiết bị máy in', '12.500.000']);

auditEvent($pdo, $conn, $userId, $userRow, 'PO_WAITING_APPROVAL', [
    'po_number' => 'PO-2026-0801',
    'current_level' => 2,
    'po_id' => 120
], ['PO-2026-0801', 'Cấp 2', '/purchase-orders?open_id=120'], ['PO-2026-0801', 'Cấp 2']);

auditEvent($pdo, $conn, $userId, $userRow, 'PO_APPROVED', [
    'po_number' => 'PO-2026-0801',
    'po_id' => 120
], ['PO-2026-0801', 'phê duyệt hoàn tất', '/purchase-orders?open_id=120'], ['PO-2026-0801', 'phê duyệt hoàn tất']);

auditEvent($pdo, $conn, $userId, $userRow, 'PO_REJECTED', [
    'po_number' => 'PO-2026-0801',
    'po_id' => 120
], ['PO-2026-0801', 'từ chối', '/purchase-orders?open_id=120'], ['PO-2026-0801', 'từ chối']);


// ==============================================================================
// 4. KIỂM THỬ PHÂN HỆ: SALES ORDERS (SO - ĐẶT CỌC, THANH TOÁN)
// ==============================================================================
echo "\n================================================================================\n";
echo "📋 PHÂN HỆ 4: SALES ORDERS (SO - ĐẶT CỌC, THANH TOÁN)\n";
echo "================================================================================\n";

auditEvent($pdo, $conn, $userId, $userRow, 'DEPOSIT_NEW', [
    'deposit_id' => 789,
    'customer_name' => 'Bà Trương Mỹ Hoa',
    'amount' => 50000000
], ['Sale Order', 'Bà Trương Mỹ Hoa', '50.000.000', '/deposits'], ['Sale Order', 'Bà Trương Mỹ Hoa', '50.000.000']);

auditEvent($pdo, $conn, $userId, $userRow, 'MY_DEPOSIT_UPDATE', [
    'deposit_id' => 789,
    'customer_name' => 'Bà Trương Mỹ Hoa',
    'status_text' => 'đã được Kế toán xác nhận nhận đủ tiền đợt 1',
    'reason' => 'Ủy nhiệm chi số UNC-9921'
], ['Sale Order #789', 'Trương Mỹ Hoa', 'Kế toán xác nhận', '/deposits'], ['Sale Order #789', 'Trương Mỹ Hoa']);


// ==============================================================================
// 5. KIỂM THỬ PHÂN HỆ: LƯƠNG & PHÚC LỢI (HRM PAYROLL & MY PAYSLIPS)
// ==============================================================================
echo "\n================================================================================\n";
echo "📋 PHÂN HỆ 5: LƯƠNG & PHÚC LỢI (HRM PAYROLL & PAYSLIPS)\n";
echo "================================================================================\n";

auditEvent($pdo, $conn, $userId, $userRow, 'HRM_PAYSLIP_PUBLISHED', [
    'month_year' => '08/2026'
], ['08/2026', 'phát hành', '/my-payslips'], ['08/2026', 'Phiếu lương', 'My HR']);

auditEvent($pdo, $conn, $userId, $userRow, 'HRM_PAYSLIP_CONFIRMED', [
    'month_year' => '08/2026'
], ['08/2026', 'ký xác nhận', '/hrm?tab=payroll'], ['08/2026', 'ký nhận']);

auditEvent($pdo, $conn, $userId, $userRow, 'HRM_ADVANCE_REQUEST', [
    'amount' => 5000000,
    'reason' => 'Tạm ứng chi phí công tác Hà Nội',
    'ref_id' => 88
], ['tạm ứng', '5.000.000', '/approvals?open_id=88'], ['tạm ứng', '5.000.000']);

auditEvent($pdo, $conn, $userId, $userRow, 'HRM_ADVANCE_APPROVAL', [
    'amount' => 5000000,
    'status_text' => 'được Giám đốc phê duyệt',
    'reason' => 'Đã duyệt chi qua tài khoản Techcombank',
    'ref_id' => 88
], ['5.000.000', 'Giám đốc phê duyệt', '/approvals?open_id=88'], ['5.000.000', 'Giám đốc phê duyệt']);


// ==============================================================================
// 6. KIỂM THỬ PHÂN HỆ: CÔNG & CHẤM CÔNG (ATTENDANCE & TIMESHEET)
// ==============================================================================
echo "\n================================================================================\n";
echo "📋 PHÂN HỆ 6: CÔNG & CHẤM CÔNG (ATTENDANCE & TIMESHEET)\n";
echo "================================================================================\n";

auditEvent($pdo, $conn, $userId, $userRow, 'CHECKIN_LATE', [
    'date' => '2026-08-19',
    'time' => '08:45',
    'reason' => 'Kẹt xe đường Nguyễn Hữu Thọ'
], ['đi trễ', '08:45', 'Kẹt xe đường Nguyễn Hữu Thọ', '/attendance'], ['đi trễ', '08:45']);

auditEvent($pdo, $conn, $userId, $userRow, 'ATTENDANCE_UPDATE', [
    'date' => '2026-08-18',
    'time' => '08:30',
    'reason' => 'Quên chấm công buổi sáng do vào họp gấp'
], ['cập nhật công', '2026-08-18', 'Quên chấm công', '/attendance'], ['cập nhật công', '2026-08-18']);

auditEvent($pdo, $conn, $userId, $userRow, 'ATTENDANCE_APPROVAL_RESULT', [
    'date' => '2026-08-18',
    'status' => 'approved',
    'is_supplementary' => true,
    'reason' => 'Duyệt đủ 1 công làm việc'
], ['Cập nhật công của bạn đã được duyệt', 'chấp thuận', '/sale-portal'], ['cập nhật công', 'chấp thuận']);

auditEvent($pdo, $conn, $userId, $userRow, 'HRM_LEAVE_REQUEST', [
    'leave_type_text' => 'Nghỉ phép năm',
    'start_date' => '2026-08-28',
    'end_date' => '2026-08-29',
    'total_days' => 2,
    'reason' => 'Giải quyết việc gia đình',
    'ref_id' => 991
], ['Nghỉ phép năm', '2026-08-28 -> 2026-08-29', '2 ngày', '/approvals?open_id=991'], ['Nghỉ phép năm', '2 ngày']);

auditEvent($pdo, $conn, $userId, $userRow, 'HRM_LEAVE_APPROVAL', [
    'leave_type_text' => 'Nghỉ phép năm',
    'start_date' => '2026-08-28',
    'end_date' => '2026-08-29',
    'status_text' => 'chấp thuận',
    'reason' => 'Đã bàn giao công việc đầy đủ',
    'remaining_annual_leave' => 8.5,
    'remaining_compensatory_leave' => 1.0,
    'ref_id' => 991
], ['Nghỉ phép năm', 'chấp thuận', '8.5 ngày', '/approvals?open_id=991'], ['Nghỉ phép năm', 'chấp thuận', '8.5 ngày']);

auditEvent($pdo, $conn, $userId, $userRow, 'NIGHT_SHIFT_BOOKING', [
    'shift_date' => '2026-08-20'
], ['Đăng ký trực đêm', '2026-08-20', '/roster'], ['trực ca đêm', '2026-08-20']);

auditEvent($pdo, $conn, $userId, $userRow, 'CHECKOUT_REMINDER', [
    'work_end' => '17:30'
], ['Nhắc nhở chấm công Ra ca', '17:30', '/attendance'], ['tan làm', '17:30']);

auditEvent($pdo, $conn, $userId, $userRow, 'MONTHLY_ATTENDANCE_REPORT', [
    'period_str' => '07/2026',
    'summary_text' => "• Ngày chấm công: 22 ngày\n• Đi trễ: 0 lần\n• Trực đêm: 4 ca"
], ['Báo cáo Chấm công & Trực ca (07/2026)', '/attendance'], ['Chấm công & Trực ca (07/2026)', '22 ngày']);


// ==============================================================================
// 7. KIỂM THỬ ĐẶC BIỆT: KÊNH EMAIL (SMTP, QUEUE, TEMPLATE FORMAT)
// ==============================================================================
echo "\n================================================================================\n";
echo "📧 PHÂN HỆ 7: KIỂM THỬ TOÀN DIỆN KÊNH EMAIL (SMTP, QUEUE, TEMPLATES)\n";
echo "================================================================================\n";

// 7.1 Kiểm tra cấu trúc HTML Base Template
$sampleHtml = _getBaseHtml('THÔNG BÁO THỬ NGHIỆM', '', '<p>Nội dung thử nghiệm kiểm tra tính chuẩn xác của Template</p>');

assertTest("7.1 Template chứa Header gradient màu đỏ nhận diện thương hiệu", strpos($sampleHtml, '#BD1D2D') !== false);
assertTest("7.2 Template chứa Logo IDEAS hợp lệ", strpos($sampleHtml, 'LOGO.webp') !== false || strpos($sampleHtml, 'IDEAS Logo') !== false);
assertTest("7.3 Template chứa Footer bản quyền IDEAS", strpos($sampleHtml, 'IDEAS Ecosystem') !== false);

// 7.2 Kiểm tra chức năng gửi email qua hàng đợi (mail_queue)
$testSubject = "Kiểm tra hệ thống gửi Mail tự động IDEAS ERP";
$testContent = "<p>Đây là nội dung thử nghiệm gửi qua hàng đợi mail_queue.</p>";
$queueResult = sendEmailNotification("audit_test@ideas.com.vn", $testSubject, "THỬ NGHIỆM EMAIL", $testContent, "audit_cc@ideas.com.vn", false, 0);

assertTest("7.4 sendEmailNotification(sync=false) thực thi thành công", $queueResult === true);

// Kiểm tra bản ghi trong bảng mail_queue
$resQueue = $conn->query("SELECT * FROM mail_queue WHERE to_email = 'audit_test@ideas.com.vn' ORDER BY id DESC LIMIT 1");
$qRow = $resQueue ? $resQueue->fetch_assoc() : null;

if (assertTest("7.5 Bản ghi email được lưu vào bảng mail_queue với status = 'pending'", $qRow !== null && $qRow['status'] === 'pending')) {
    echo "   • To: {$qRow['to_email']}\n";
    echo "   • CC: {$qRow['cc_email']}\n";
    echo "   • Subject: {$qRow['subject']}\n";
    echo "   • Body length: " . strlen($qRow['body_html']) . " bytes\n";

    assertTest("7.6 Email Subject tự động chứa timestamp chống gộp luồng", preg_match('/\[\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}\]/', $qRow['subject']) === 1);
    assertTest("7.7 Email Body tự động chứa nút CTA 'Truy cập Hệ thống CRM'", strpos($qRow['body_html'], 'Truy cập Hệ thống CRM') !== false);
    assertTest("7.8 Email CC được lưu đúng danh sách", $qRow['cc_email'] === 'audit_cc@ideas.com.vn');
}

// 7.3 Kiểm tra cấu hình SMTP trong system_settings
echo "\n--- KIỂM TRA THÔNG SỐ SMTP HỆ THỐNG ---\n";
$stmtSmtp = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%smtp%' OR setting_key LIKE '%email%'");
$smtpSettings = [];
while ($row = $stmtSmtp->fetch_assoc()) {
    $smtpSettings[$row['setting_key']] = $row['setting_value'];
}

$hasSmtpHost = !empty($smtpSettings['smtp_host']);
$hasSmtpUser = !empty($smtpSettings['smtp_user']);
$hasSmtpPass = !empty($smtpSettings['smtp_pass']);

echo "   • SMTP Host: " . ($smtpSettings['smtp_host'] ?? 'Chưa cấu hình') . "\n";
echo "   • SMTP Port: " . ($smtpSettings['smtp_port'] ?? '587') . "\n";
echo "   • SMTP Secure: " . ($smtpSettings['smtp_secure'] ?? 'tls') . "\n";
echo "   • SMTP User: " . ($smtpSettings['smtp_user'] ?? 'Chưa cấu hình') . "\n";
echo "   • From Email: " . ($smtpSettings['smtp_from_email'] ?? 'Chưa cấu hình') . "\n";

assertTest("7.9 Cấu hình SMTP Host và Tài khoản đã được khai báo trong system_settings", $hasSmtpHost && $hasSmtpUser && $hasSmtpPass);

// Clean up queue test records
$conn->query("DELETE FROM mail_queue WHERE to_email = 'audit_test@ideas.com.vn'");

// ==============================================================================
// 8. TỔNG KẾT VÀ BÁO CÁO
// ==============================================================================
echo "\n================================================================================\n";
echo "📊 BÁO CÁO TỔNG KẾT KIỂM THỬ THÔNG BÁO & EMAIL\n";
echo "================================================================================\n";

printTestSummary();
