<?php
// backend/test_reminders_payload.php
define('DIAG_TOKEN', true);
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== KIỂM THỬ PAYLOAD VÀ HÀM NHẮC NHỞ THANH TOÁN ===\n\n";

// 1. Lấy thông tin contact, project, user ngẫu nhiên để làm mẫu test
$stmtUser = $conn->query("SELECT id, tenant_id FROM users LIMIT 1");
$user = $stmtUser->fetch_assoc();

$stmtContact = $conn->query("SELECT id FROM contacts WHERE tenant_id = '{$user['tenant_id']}' LIMIT 1");
$contact = $stmtContact->fetch_assoc();

$stmtProj = $conn->query("SELECT id FROM projects WHERE tenant_id = '{$user['tenant_id']}' LIMIT 1");
$proj = $stmtProj->fetch_assoc();

if (!$user || !$contact || !$proj) {
    echo "❌ Không đủ dữ liệu mẫu để chạy test (Cần ít nhất 1 user, 1 contact, 1 project)\n";
    exit;
}

// 2. Chèn dữ liệu cọc mẫu test
$tempUnitCode = 'TEST_UNIT_' . rand(100, 999);
$insertSql = "INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by, auto_remind, remind_days_before, remind_at_hour, remind_target) 
              VALUES (?, ?, ?, 50000000.00, 5000000.00, 'pending_admin', ?, 1, 3, 8, 1)";
$stmt = $conn->prepare($insertSql);
$stmt->bind_param("iisi", $contact['id'], $proj['id'], $tempUnitCode, $user['id']);
$stmt->execute();
$depositId = $stmt->insert_id;
$stmt->close();

assertTest("Tạo cọc mẫu thành công", $depositId > 0, "ID cọc: " . $depositId);

// 3. Chèn đợt thanh toán mẫu test
$expectedDate = date('Y-m-d', strtotime('+3 days'));
$insertMilestoneSql = "INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, expected_pay_date, status) 
                       VALUES (?, 'Đợt Test 1', 10000000.00, ?, 'pending')";
$stmtM = $conn->prepare($insertMilestoneSql);
$stmtM->bind_param("is", $depositId, $expectedDate);
$stmtM->execute();
$milestoneId = $stmtM->insert_id;
$stmtM->close();

assertTest("Tạo đợt thanh toán mẫu thành công", $milestoneId > 0, "ID đợt: " . $milestoneId);

// 4. Đối soát cấu trúc database thực tế
assertDbField($conn, 'deposits', 'auto_remind', "id = $depositId", 1, "auto_remind lưu chính xác");
assertDbField($conn, 'deposits', 'remind_days_before', "id = $depositId", 3, "remind_days_before lưu chính xác");
assertDbField($conn, 'deposits', 'remind_at_hour', "id = $depositId", 8, "remind_at_hour lưu chính xác");

// 5. Cleanup dữ liệu test
$conn->query("DELETE FROM deposit_milestones WHERE id = $milestoneId");
$conn->query("DELETE FROM deposits WHERE id = $depositId");

echo "\n=== KẾT THÚC KIỂM THỬ ===\n";
printTestSummary();
