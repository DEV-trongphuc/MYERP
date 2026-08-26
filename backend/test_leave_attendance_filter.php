<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';
require_once __DIR__ . '/NotificationService.php';

$pdo = Database::getInstance();
$today = date('Y-m-d');

echo "=== TEST: USER ON LEAVE ATTENDANCE REMINDER FILTERING ===\n\n";

// Create a temporary mock user ID 999991
$testUserId = 999991;

// Clean up
$pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);

// Insert test user
$stmtU = $pdo->prepare("INSERT INTO users (id, tenant_id, username, full_name, email, role, status) VALUES (?, 1, 'test_leave_user', 'Test Leave User', 'testleave@ideas.edu.vn', 'sales', 'active')");
$stmtU->execute([$testUserId]);

// Test 1: Normal active user with no leave -> should receive reminder
$resNormal = NotificationService::send($pdo, 1, 'CHECKIN_MISSING_REMINDER', [
    'user_id' => $testUserId,
    'user_name' => 'Test Leave User',
    'work_start' => '08:00'
]);
$pass1 = ($resNormal !== null);
echo "1. Normal user without leave: " . ($pass1 ? "✅ [PASS - Nhận nhắc nhở]" : "❌ [FAIL]") . "\n";

// Test 2: User has a PENDING leave request today -> should NOT receive reminder
$stmtLv = $pdo->prepare("INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, status, reason) VALUES (?, 'annual', ?, ?, 1.0, 'pending', 'Test nghỉ phép')");
$stmtLv->execute([$testUserId, $today . ' 08:00:00', $today . ' 17:30:00']);

$resPending = NotificationService::send($pdo, 1, 'CHECKIN_MISSING_REMINDER', [
    'user_id' => $testUserId,
    'user_name' => 'Test Leave User',
    'work_start' => '08:00'
]);
$pass2 = ($resPending === null);
echo "2. User has PENDING leave request: " . ($pass2 ? "✅ [PASS - Tự động chặn, KHÔNG gửi nhắc nhở]" : "❌ [FAIL]") . "\n";

// Test 3: User has APPROVED leave request today -> should NOT receive checkout reminder
$pdo->prepare("UPDATE hrm_leave_requests SET status = 'approved' WHERE user_id = ?")->execute([$testUserId]);
$resApproved = NotificationService::send($pdo, 1, 'CHECKOUT_MISSING_REMINDER', [
    'user_id' => $testUserId,
    'user_name' => 'Test Leave User',
    'work_end' => '17:30'
]);
$pass3 = ($resApproved === null);
echo "3. User has APPROVED leave request: " . ($pass3 ? "✅ [PASS - Tự động chặn, KHÔNG gửi nhắc ra ca]" : "❌ [FAIL]") . "\n";

// Test 4: User has vacation_mode = 1 -> should NOT receive reminder
$pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("UPDATE users SET vacation_mode = 1 WHERE id = ?")->execute([$testUserId]);

$resVacation = NotificationService::send($pdo, 1, 'CHECKIN_MISSING_REMINDER', [
    'user_id' => $testUserId,
    'user_name' => 'Test Leave User',
    'work_start' => '08:00'
]);
$pass4 = ($resVacation === null);
echo "4. User has vacation_mode = 1: " . ($pass4 ? "✅ [PASS - Tự động chặn, KHÔNG gửi nhắc nhở]" : "❌ [FAIL]") . "\n";

// Clean up
$pdo->prepare("DELETE FROM hrm_leave_requests WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);

echo "\nAll leave filter tests completed!\n";
