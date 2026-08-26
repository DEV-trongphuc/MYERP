<?php
// backend/execute_production_reset.php
// PRODUCTION DATA RESET & BACKUP SCRIPT

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 TIẾN HÀNH SAO LƯU & DỌN DẸP DỮ LIỆU THỬ NGHIỆM\n";
echo "====================================================\n\n";

// BƯỚC 1: KIỂM TRA SỐ LƯỢNG BAN ĐẦU
echo "--- 1. KIỂM TRA DỮ LIỆU GỐC TRƯỚC KHI XÓA ---\n";
$contactsBefore = (int)$pdo->query("SELECT COUNT(*) FROM contacts")->fetchColumn();
$usersBefore = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$teamsBefore = (int)$pdo->query("SELECT COUNT(*) FROM teams")->fetchColumn();
$callsBefore = (int)$pdo->query("SELECT COUNT(*) FROM activities WHERE type = 'call'")->fetchColumn();
$notesBefore = (int)$pdo->query("SELECT COUNT(*) FROM activities WHERE type = 'note'")->fetchColumn();

echo " - Contacts (Lead/Học viên): {$contactsBefore}\n";
echo " - Users (Nhân sự): {$usersBefore}\n";
echo " - Teams (Phòng ban): {$teamsBefore}\n";
echo " - Call Logs (Lịch sử gọi của Lead): {$callsBefore}\n";
echo " - Note Logs (Ghi chú tương tác Lead): {$notesBefore}\n";

if ($contactsBefore < 1000 || $usersBefore < 10) {
    die("❌ CẢNH BÁO AN TOÀN: Dữ liệu contacts hoặc users bất thường, hủy bỏ thao tác!\n");
}

// BƯỚC 2: SAO LƯU DỮ LIỆU CÁC BẢNG SẮP DỌN DẸP SANG BẢNG BACKUP (SNAPSHOT)
echo "\n--- 2. TẠO BẢN SAO LƯU AN TOÀN (BACKUP SNAPSHOT) ---\n";
$backupTables = [
    'deposits',
    'deposit_milestones',
    'invoices',
    'purchase_orders',
    'purchase_order_items',
    'hrm_leave_requests',
    'notifications'
];

foreach ($backupTables as $t) {
    try {
        $backupName = "_bak_{$t}_" . date('Ymd_His');
        $pdo->exec("CREATE TABLE IF NOT EXISTS `{$backupName}` AS SELECT * FROM `{$t}`");
        $bakCount = $pdo->query("SELECT COUNT(*) FROM `{$backupName}`")->fetchColumn();
        echo " ✅ Đã backup bảng '{$t}' -> '{$backupName}' ({$bakCount} bản ghi)\n";
    } catch (\Throwable $e) {
        echo " ⚠️ Backup '{$t}': " . $e->getMessage() . "\n";
    }
}

// BƯỚC 3: TIẾN HÀNH DỌN DẸP CÁC BẢNG TEST
echo "\n--- 3. TIẾN HÀNH DỌN DẸP CSDL CHÍNH THỨC ---\n";

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // 3.1. Đơn bán hàng & Đặt cọc & Hóa đơn
    $pdo->exec("TRUNCATE TABLE `deposits`");
    $pdo->exec("TRUNCATE TABLE `deposit_milestones`");
    $pdo->exec("TRUNCATE TABLE `invoices`");
    $pdo->exec("TRUNCATE TABLE `invoice_items`");
    $pdo->exec("TRUNCATE TABLE `sales_orders`");
    $pdo->exec("TRUNCATE TABLE `sales_order_items`");
    echo " ✅ Đã dọn sạch: deposits, deposit_milestones, invoices, invoice_items, sales_orders, sales_order_items\n";

    // 3.2. Đơn mua hàng PO & Chi tiết
    $pdo->exec("TRUNCATE TABLE `purchase_orders`");
    $pdo->exec("TRUNCATE TABLE `purchase_order_items`");
    echo " ✅ Đã dọn sạch: purchase_orders, purchase_order_items\n";

    // 3.3. Quy trình & Phê duyệt
    $pdo->exec("TRUNCATE TABLE `hrm_leave_requests`");
    $pdo->exec("TRUNCATE TABLE `audit_logs`");
    echo " ✅ Đã dọn sạch: hrm_leave_requests, audit_logs\n";

    // 3.4. Bàn làm việc (Workspace tasks & comments) - GIỮ LẠI CALL & NOTE CỦA LEAD
    $delTasks = $pdo->exec("DELETE FROM `activities` WHERE `type` = 'task'");
    $pdo->exec("TRUNCATE TABLE `activity_comments`");
    $pdo->exec("TRUNCATE TABLE `task_hidden_users`");
    echo " ✅ Đã xóa {$delTasks} task trên Workspace & dọn sạch activity_comments, task_hidden_users\n";

    // 3.5. Ticket & Feed mạng xã hội
    $pdo->exec("TRUNCATE TABLE `tickets`");
    $pdo->exec("TRUNCATE TABLE `ticket_comments`");
    $pdo->exec("TRUNCATE TABLE `enterprise_posts`");
    $pdo->exec("TRUNCATE TABLE `enterprise_comments`");
    $pdo->exec("TRUNCATE TABLE `enterprise_reactions`");
    echo " ✅ Đã dọn sạch: tickets, ticket_comments, enterprise_posts, enterprise_comments, enterprise_reactions\n";

    // 3.6. Thông báo
    $pdo->exec("TRUNCATE TABLE `notifications`");
    echo " ✅ Đã dọn sạch: notifications\n";

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "\n🏆 DỌN DẸP HOÀN TẤT THÀNH CÔNG!\n";
} catch (\Throwable $e) {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    die("❌ LỖI TRONG QUÁ TRÌNH DỌN DẸP: " . $e->getMessage() . "\n");
}

// BƯỚC 4: ĐỐI SOÁT & XÁC NHẬN TỔNG THỂ
echo "\n--- 4. ĐỐI SOÁT DỮ LIỆU SAU KHI DỌN DẸP ---\n";
$contactsAfter = (int)$pdo->query("SELECT COUNT(*) FROM contacts")->fetchColumn();
$usersAfter = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$teamsAfter = (int)$pdo->query("SELECT COUNT(*) FROM teams")->fetchColumn();
$callsAfter = (int)$pdo->query("SELECT COUNT(*) FROM activities WHERE type = 'call'")->fetchColumn();
$notesAfter = (int)$pdo->query("SELECT COUNT(*) FROM activities WHERE type = 'note'")->fetchColumn();
$tasksAfter = (int)$pdo->query("SELECT COUNT(*) FROM activities WHERE type = 'task'")->fetchColumn();

$depositsAfter = (int)$pdo->query("SELECT COUNT(*) FROM deposits")->fetchColumn();
$invoicesAfter = (int)$pdo->query("SELECT COUNT(*) FROM invoices")->fetchColumn();
$posAfter = (int)$pdo->query("SELECT COUNT(*) FROM purchase_orders")->fetchColumn();
$leavesAfter = (int)$pdo->query("SELECT COUNT(*) FROM hrm_leave_requests")->fetchColumn();
$notifsAfter = (int)$pdo->query("SELECT COUNT(*) FROM notifications")->fetchColumn();

assertTest("Contacts (Lead/Học viên) được bảo toàn 100%", $contactsAfter === $contactsBefore, "Số lượng: {$contactsAfter}");
assertTest("Users (Nhân sự) được bảo toàn 100%", $usersAfter === $usersBefore, "Số lượng: {$usersAfter}");
assertTest("Teams (Phòng ban) được bảo toàn 100%", $teamsAfter === $teamsBefore, "Số lượng: {$teamsAfter}");
assertTest("Call Logs của Lead được bảo toàn 100%", $callsAfter === $callsBefore, "Số lượng: {$callsAfter}");
assertTest("Note Logs của Lead được bảo toàn 100%", $notesAfter === $notesBefore, "Số lượng: {$notesAfter}");

assertTest("Workspace Tasks đã được reset về 0", $tasksAfter === 0, "Số lượng: {$tasksAfter}");
assertTest("Deposits (Đặt cọc) đã được reset về 0", $depositsAfter === 0, "Số lượng: {$depositsAfter}");
assertTest("Invoices (Hóa đơn) đã được reset về 0", $invoicesAfter === 0, "Số lượng: {$invoicesAfter}");
assertTest("Purchase Orders (Đơn mua hàng) đã được reset về 0", $posAfter === 0, "Số lượng: {$posAfter}");
assertTest("Leave Requests (Đơn nghỉ phép) đã được reset về 0", $leavesAfter === 0, "Số lượng: {$leavesAfter}");
assertTest("Notifications (Thông báo) đã được reset về 0", $notifsAfter === 0, "Số lượng: {$notifsAfter}");

printTestSummary();
