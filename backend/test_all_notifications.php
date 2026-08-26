<?php
// backend/test_all_notifications.php
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/NotificationService.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ KHÉP KÍN HỆ THỐNG THÔNG BÁO (COMPREHENSIVE NOTIFICATION SUITE)\n";
echo "==================================================================================\n\n";

// 1. Lấy user chạy test
$userQuery = $conn->query("SELECT id, email, full_name, role FROM users LIMIT 1");
$userRow = $userQuery->fetch_assoc();
$userId = $userRow ? (int)$userRow['id'] : null;

if ($userId === null) {
    echo "❌ KHÔNG TÌM THẤY USER TRONG HỆ THỐNG ĐỂ CHẠY TEST.\n";
    exit(1);
}

echo "💡 Chạy test với user: [ID: $userId] - {$userRow['full_name']} (Role: {$userRow['role']})\n\n";

// Dọn dẹp các thông báo cũ trước khi test
$conn->query("DELETE FROM notifications WHERE user_id = $userId");

// Hàm chạy kiểm thử cho từng event type
function testNotificationEvent($pdo, $conn, $userId, $userRow, $eventType, $payload, $expectedKeywords) {
    echo "\n--- KIỂM THỬ SỰ KIỆN: $eventType ---\n";
    
    // Đặt mặc định user_id vào payload cho các event cần nó
    if (!isset($payload['user_id'])) {
        $payload['user_id'] = $userId;
    }
    
    // Ghi đè người nhận để hướng về test user
    $payload['recipients'] = [
        [
            'id' => $userId,
            'email' => $userRow['email'],
            'full_name' => $userRow['full_name'],
            'zalo_chat_id' => 'test_zalo_id',
            'telegram_chat_id' => 'test_tg_id'
        ]
    ];
    $payload['user_name'] = $userRow['full_name'];
    
    // Fire event
    try {
        NotificationService::send($pdo, 1, $eventType, $payload);
        assertTest("Gửi sự kiện $eventType không ném lỗi", true);
    } catch (\Throwable $e) {
        assertTest("Gửi sự kiện $eventType không ném lỗi", false, $e->getMessage());
        return;
    }
    
    // Đọc bản ghi mới nhất vừa insert vào database
    $res = $conn->query("SELECT * FROM notifications WHERE user_id = $userId ORDER BY id DESC LIMIT 1");
    $notif = $res ? $res->fetch_assoc() : null;
    
    if (assertTest("Bản ghi in-app cho $eventType được lưu vào CSDL", $notif !== null)) {
        echo "   • Tiêu đề: {$notif['title']}\n";
        echo "   • Nội dung: {$notif['body']}\n";
        echo "   • Đường dẫn: {$notif['link']}\n";
        
        $match = true;
        foreach ($expectedKeywords as $kw) {
            if (mb_strpos($notif['body'], $kw) === false && mb_strpos($notif['title'], $kw) === false) {
                $match = false;
                echo "   ❌ Thiếu từ khóa: '$kw'\n";
            }
        }
        assertTest("Nội dung/Tiêu đề của thông báo chứa các từ khóa cần thiết", $match);
    }
    
    // Dọn dẹp bản ghi test vừa tạo để tránh rác
    $conn->query("DELETE FROM notifications WHERE user_id = $userId");
}

// 2. Chạy loạt test cases
// Case A: Công việc, Deadline, Hạn hoàn thành
testNotificationEvent($pdo, $conn, $userId, $userRow, 'WORKFLOW_TASK_ASSIGNED', [
    'user_id' => $userId,
    'task_title' => 'Hoàn thiện hồ sơ giảng viên',
    'due_date' => '2026-08-01',
], ['giao công việc', 'Hoàn thiện hồ sơ giảng viên', '2026-08-01']);

testNotificationEvent($pdo, $conn, $userId, $userRow, 'SECURITY_DEADLINE_WARNING', [
    'user_id' => $userId,
    'customer_name' => 'Nguyễn Văn A',
    'deadline' => '3 ngày',
], ['bảo mật', 'Nguyễn Văn A', '3 ngày']);

// Case B: Phê duyệt quy trình, SO, PO
testNotificationEvent($pdo, $conn, $userId, $userRow, 'EXPENSE_REQUEST', [
    'amount' => 15000000,
    'title' => 'thuê giảng đường',
], ['yêu cầu chi phí', 'thuê giảng đường', '15.000.000']);

testNotificationEvent($pdo, $conn, $userId, $userRow, 'DEPOSIT_NEW', [
    'customer_name' => 'Nguyễn Văn A',
    'amount' => 5000000,
], ['Sale Order', 'Nguyễn Văn A', '5.000.000']);

testNotificationEvent($pdo, $conn, $userId, $userRow, 'COOPERATION_PENDING_APPROVAL', [
    'slip_id' => '12345',
], ['phê duyệt phiếu hợp tác', '12345']);

// Case C: Bình luận, mentions, phản hồi, trả lời
testNotificationEvent($pdo, $conn, $userId, $userRow, 'MENTION_TAGGED', [
    'user_id' => $userId,
    'author_name' => 'Nguyễn Thị B',
    'comment' => 'báo giá này nhé',
], ['nhắc tên bạn', 'Nguyễn Thị B', 'báo giá này nhé']);

// Case D: Đi trễ, Tan ca, Xin nghỉ phép
testNotificationEvent($pdo, $conn, $userId, $userRow, 'CHECKOUT_REMINDER', [
    'work_end' => '18:00',
], ['tan làm', '18:00']);

testNotificationEvent($pdo, $conn, $userId, $userRow, 'CHECKIN_LATE', [
    'time' => '08:45',
    'reason' => 'Kẹt xe ngã tư bảy hiền',
], ['đi trễ', '08:45', 'Kẹt xe ngã tư bảy hiền']);

testNotificationEvent($pdo, $conn, $userId, $userRow, 'HRM_LEAVE_REQUEST', [
    'leave_type_text' => 'Nghỉ phép năm',
    'total_days' => 2,
    'start_date' => '2026-08-01',
    'end_date' => '2026-08-02',
], ['Nghỉ phép năm', '2 ngày', '2026-08-01']);

testNotificationEvent($pdo, $conn, $userId, $userRow, 'HRM_PAYSLIP_PUBLISHED', [
    'user_id' => $userId,
    'month_year' => '07/2026',
], ['Phiếu lương', '07/2026']);

echo "\n====================================================\n";
echo "🧹 Đã dọn dẹp toàn bộ dữ liệu kiểm thử thông báo.\n";
echo "====================================================\n";

printTestSummary();
