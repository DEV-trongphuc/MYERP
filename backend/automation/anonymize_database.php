<?php
// api/anonymize_database.php - Secure script to anonymize/mask sensitive data in the demo database.
// This script MUST only be executed on the clone database (vhvxoigh_mail_demo) to prevent production data loss.

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'db_connect.php';
apiHeaders();

// 1. Strict Security Safeguard
if ($db === 'vhvxoigh_mail_auto') {
    http_response_code(403);
    die(json_encode([
        'success' => false,
        'error' => 'FATAL ERROR: Bất kỳ nỗ lực chạy ẩn dữ liệu nào trên cơ sở dữ liệu production (vhvxoigh_mail_auto) đều bị chặn để bảo vệ an toàn dữ liệu!'
    ], JSON_UNESCAPED_UNICODE));
}

// 2. Token authorization
$token = $_GET['token'] ?? '';
if ($token !== ADMIN_BYPASS_TOKEN && empty($GLOBALS['current_admin_id'])) {
    http_response_code(403);
    die(json_encode([
        'success' => false,
        'error' => 'Unauthorized access. Vui lòng cung cấp token bảo mật hợp lệ.'
    ], JSON_UNESCAPED_UNICODE));
}

try {
    echo "Bắt đầu chạy ẩn cứng dữ liệu nhạy cảm trên database [{$db}]...\n\n";

    // 1. Anonymize `subscribers` table
    // Mask email: john.doe@gmail.com -> jo***@gmail.com
    $pdo->exec("
        UPDATE subscribers 
        SET email = CONCAT(SUBSTRING(email, 1, 2), '***', SUBSTRING(email, LOCATE('@', email)))
        WHERE email LIKE '%@%'
    ");
    echo "✔ Đã ẩn thành công email trong bảng 'subscribers'.\n";

    // Mask phone number: 0912345678 -> 091***678
    $pdo->exec("
        UPDATE subscribers 
        SET phone_number = CONCAT(SUBSTRING(phone_number, 1, 3), '***', SUBSTRING(phone_number, -3))
        WHERE LENGTH(phone_number) >= 8
    ");
    echo "✔ Đã ẩn thành công số điện thoại trong bảng 'subscribers'.\n";

    // Mask Zalo User ID: zalo_12345678 -> zalo_demo_5678
    $pdo->exec("
        UPDATE subscribers 
        SET zalo_user_id = CONCAT('zalo_demo_', SUBSTRING(zalo_user_id, -4))
        WHERE zalo_user_id IS NOT NULL AND zalo_user_id != ''
    ");
    echo "✔ Đã ẩn thành công Zalo User ID trong bảng 'subscribers'.\n";

    // Mask Facebook PSID
    $pdo->exec("
        UPDATE subscribers 
        SET meta_psid = CONCAT('fb_demo_', SUBSTRING(meta_psid, -4))
        WHERE meta_psid IS NOT NULL AND meta_psid != ''
    ");
    echo "✔ Đã ẩn thành công Facebook PSID trong bảng 'subscribers'.\n";


    // 2. Anonymize `web_visitors` table
    $pdo->exec("
        UPDATE web_visitors 
        SET email = CONCAT(SUBSTRING(email, 1, 2), '***', SUBSTRING(email, LOCATE('@', email)))
        WHERE email LIKE '%@%'
    ");
    $pdo->exec("
        UPDATE web_visitors 
        SET phone = CONCAT(SUBSTRING(phone, 1, 3), '***', SUBSTRING(phone, -3))
        WHERE LENGTH(phone) >= 8
    ");
    echo "✔ Đã ẩn thành công thông tin email/phone trong bảng 'web_visitors'.\n";


    // 3. Anonymize non-admin `users` and `ai_org_users`
    $pdo->exec("
        UPDATE users 
        SET email = CONCAT('demo_user_', id, '@domation.net'), 
            phone = '098***1234'
        WHERE role != 'admin' AND username != 'admin'
    ");
    $pdo->exec("
        UPDATE ai_org_users 
        SET email = CONCAT('demo_org_', id, '@domation.net'), 
            phone = '098***1234'
        WHERE role != 'admin' AND email NOT LIKE 'admin%'
    ");
    echo "✔ Đã ẩn thành công email/phone của người dùng phụ (giữ lại tài khoản Admin).\n";


    // 4. Anonymize email delivery logs
    $pdo->exec("
        UPDATE mail_delivery_logs 
        SET recipient = CONCAT('***', SUBSTRING(recipient, LOCATE('@', recipient)))
        WHERE recipient LIKE '%@%'
    ");
    echo "✔ Đã ẩn thành công email người nhận trong bảng 'mail_delivery_logs'.\n";


    // 5. Mask activity logs containing phone numbers/emails
    try {
        $pdo->exec("
            UPDATE subscriber_activity 
            SET details = REGEXP_REPLACE(details, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}', '***@domain.com')
        ");
        $pdo->exec("
            UPDATE subscriber_activity 
            SET details = REGEXP_REPLACE(details, '0[0-9]{8,11}', '0******')
        ");
        echo "✔ Đã ẩn thành công email/SĐT trong nhật ký hoạt động (subscriber_activity).\n";
    } catch (Exception $eRegex) {
        // Fallback if REGEXP_REPLACE is not supported
        $pdo->exec("
            UPDATE subscriber_activity 
            SET details = 'Activity data sanitized for demo.'
            WHERE details LIKE '%@%' OR details REGEXP '0[0-9]{8,11}'
        ");
        echo "✔ (Fallback) Đã làm sạch nhật ký hoạt động có chứa Email/SĐT.\n";
    }

    echo "\n✔ Hoàn thành ẩn dữ liệu thành công! Cơ sở dữ liệu demo [{$db}] đã sẵn sàng hoạt động an toàn.";

} catch (Exception $e) {
    http_response_code(500);
    echo "\n❌ LỖI THỰC THI: " . $e->getMessage() . "\n";
}
?>
