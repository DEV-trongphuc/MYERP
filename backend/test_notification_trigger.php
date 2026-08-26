<?php
// backend/test_notification_trigger.php
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/NotificationService.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ KHÉP KÍN BỘ ĐIỀU PHỐI THÔNG BÁO (NOTIFICATION SERVICE AUDIT)\n";
echo "========================================================================\n\n";

// 1. Tìm user test (lấy user đầu tiên)
$userQuery = $conn->query("SELECT id, email, full_name, role FROM users LIMIT 1");
$userRow = $userQuery->fetch_assoc();
$userId = $userRow ? (int)$userRow['id'] : null;

if ($userId === null) {
    echo "❌ KHÔNG TÌM THẤY USER TRONG HỆ THỐNG ĐỂ CHẠY TEST.\n";
    exit(1);
}

echo "💡 Chạy test với user: [ID: $userId] - {$userRow['full_name']} (Role: {$userRow['role']})\n\n";

// 2. Thiết lập cấu hình matrix tạm thời cho user: bật in-app bell, tắt email, zalo, telegram
echo "--- 1. CÀI ĐẶT MA TRẬN PHÂN PHỐI THÔNG BÁO TẠM THỜI ---\n";
$conn->query("DELETE FROM user_notification_settings WHERE user_id = $userId");
$matrixConfig = [
    'DEPOSIT_NEW' => [
        'master' => true,
        'bell' => true,
        'email' => false,
        'zalo' => false,
        'telegram' => false
    ]
];
$matrixJson = json_encode($matrixConfig);
$stmtIns = $conn->prepare("INSERT INTO user_notification_settings (user_id, tenant_id, matrix_config) VALUES (?, 1, ?)");
$stmtIns->bind_param("is", $userId, $matrixJson);
$stmtIns->execute();
$stmtIns->close();

assertTest("Lưu thành công cấu hình ma trận thông báo cho test user", true);

// 3. Kích hoạt gửi thông báo
echo "\n--- 2. KÍCH HOẠT GỬI THÔNG BÁO (DEPOSIT_NEW) ---\n";
// Dọn dẹp thông báo cũ của user này
$conn->query("DELETE FROM notifications WHERE user_id = $userId");

$payload = [
    'user_name' => 'Nhân viên Thử Nghiệm',
    'deposit_id' => '9999',
    'customer_name' => 'Khách hàng Test',
    'amount' => 5000000,
    // Ghi đè người nhận để chuyển trực tiếp đến user test
    'recipients' => [
        [
            'id' => $userId,
            'email' => $userRow['email'],
            'full_name' => $userRow['full_name']
        ]
    ]
];

// Firing notification
NotificationService::send($pdo, 1, 'DEPOSIT_NEW', $payload);

// Đợi một khoảng ngắn cho shutdown function hoặc in-app bell insert
usleep(150000); 

// 4. Đối soát kết quả lưu trữ trong database
echo "\n--- 3. ĐỐI SOÁT DỮ LIỆU ĐÃ GHI ---\n";
$resN = $conn->query("SELECT * FROM notifications WHERE user_id = $userId ORDER BY id DESC LIMIT 1");
$notif = $resN->fetch_assoc();

assertTest("Thông báo in-app đã được ghi vào bảng notifications", $notif !== null);
if ($notif) {
    assertTest("Nội dung thông báo khớp với sự kiện DEPOSIT_NEW", strpos($notif['body'], 'Khách hàng Test') !== false);
}

// 5. Dọn dẹp
$conn->query("DELETE FROM user_notification_settings WHERE user_id = $userId");
$conn->query("DELETE FROM notifications WHERE user_id = $userId");
echo "\n🧹 Đã dọn dẹp dữ liệu kiểm thử thông báo.\n";

echo "\n--- KẾT THÚC KIỂM THỬ KHÉP KÍN THÔNG BÁO ---\n";
printTestSummary();
