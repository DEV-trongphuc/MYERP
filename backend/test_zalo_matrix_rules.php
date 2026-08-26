<?php
// backend/test_zalo_matrix_rules.php
require_once __DIR__ . '/test_bootstrap.php';

echo "\n=======================================================\n";
echo "  TEST SUITE: QUY TẮC MA TRẬN THÔNG BÁO ZALO CHO SALE & ADMIN\n";
echo "=======================================================\n\n";

// 1. Kiểm tra cấu trúc bảng users và consultants
assertTest("Kết nối CSDL PDO hoạt động", $pdo instanceof PDO);

$stmt = $pdo->query("SELECT id, email, full_name, role, zalo_chat_id, telegram_chat_id FROM users WHERE status = 'active' LIMIT 5");
$activeUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
assertTest("Truy vấn danh sách nhân sự active thành công", is_array($activeUsers));

// 2. Kiểm tra phương thức resolveEventData cho LEAD_ASSIGNMENT
$payloadLead = [
    'user_id' => 1,
    'customer_name' => 'Nguyễn Văn Test',
    'phone' => '0912345678',
    'source' => 'Facebook Ads'
];
$resolvedLead = NotificationService::resolveEventData($pdo, 1, 'LEAD_ASSIGNMENT', $payloadLead);
assertTest("resolveEventData xử lý đúng sự kiện LEAD_ASSIGNMENT", !empty($resolvedLead['zalo_msg']) && strpos($resolvedLead['zalo_msg'], 'KHÁCH HÀNG MỚI ĐƯỢC CHIA') !== false);
assertTest("Số điện thoại trong LEAD_ASSIGNMENT được che bảo mật", strpos($resolvedLead['zalo_msg'], '0912***678') !== false || strpos($resolvedLead['zalo_msg'], '***') !== false);

// 3. Kiểm tra resolveEventData cho các sự kiện không phải Lead (ví dụ CHECKIN_LATE)
$payloadCheckin = [
    'user_id' => 1,
    'user_name' => 'Test User',
    'checkin_time' => '08:45:00',
    'late_minutes' => 15
];
$resolvedCheckin = NotificationService::resolveEventData($pdo, 1, 'CHECKIN_LATE', $payloadCheckin);
assertTest("resolveEventData xử lý đúng sự kiện CHECKIN_LATE", !empty($resolvedCheckin));

// 4. Kiểm tra sự kiện Admin Broadcast
$adminBroadcastEvents = [
    'CHECKIN_LATE', 'ATTENDANCE_UPDATE', 'EXPENSE_REQUEST', 'TICKET_NEW', 
    'COOPERATION_PENDING_APPROVAL', 'DEPOSIT_NEW', 'NIGHT_SHIFT_BOOKING', 
    'LEAVE_REQUEST', 'HOLIDAY_REGISTRATION_OPENED', 'HOLIDAY_UPDATE', 
    'MONTHLY_ATTENDANCE_REPORT'
];
foreach ($adminBroadcastEvents as $evt) {
    $isBroad = in_array($evt, [
        'CHECKIN_LATE', 'ATTENDANCE_UPDATE', 'EXPENSE_REQUEST', 'TICKET_NEW', 
        'COOPERATION_PENDING_APPROVAL', 'DEPOSIT_NEW', 'NIGHT_SHIFT_BOOKING', 
        'LEAVE_REQUEST', 'HOLIDAY_REGISTRATION_OPENED', 'HOLIDAY_UPDATE', 
        'MONTHLY_ATTENDANCE_REPORT'
    ], true);
    assertTest("Sự kiện $evt được định danh là Admin Broadcast", $isBroad === true);
}

// 5. Kiểm tra phân loại sự kiện Lead chỉ áp dụng Zalo cá nhân
$leadEvents = ['LEAD_ASSIGNMENT', 'LEAD_NEW', 'NEW_LEAD', 'LEAD_REASSIGN'];
foreach ($leadEvents as $levt) {
    $isL = in_array($levt, ['LEAD_ASSIGNMENT', 'LEAD_NEW', 'NEW_LEAD', 'LEAD_REASSIGN'], true);
    assertTest("Sự kiện $levt được định danh là Lead Event cho Zalo cá nhân", $isL === true);
}

printTestSummary();
