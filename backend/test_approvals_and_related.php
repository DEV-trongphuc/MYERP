<?php
// backend/test_approvals_and_related.php
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';

echo "=== KIỂM THỬ TỰ ĐỘNG: TỰ ĐỘNG ĐIỀN TRƯỞNG PHÒNG & GẮN NGƯỜI LIÊN QUAN ===\n\n";

// 1. Schema check: Ensure related_user_ids column exists in all relevant approval tables
$tables = ['hrm_leave_requests', 'hrm_salary_advances', 'expenses', 'attendance_bulk_requests', 'check_ins'];
foreach ($tables as $t) {
    $stmt = $pdo->query("SHOW COLUMNS FROM $t LIKE 'related_user_ids'");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);
    assertTest("Cột related_user_ids tồn tại trong bảng $t", !empty($col));
}

// 2. Leader lookup test: Verify manager / team leader resolution for marketing team member
$stmtLeader = $pdo->query("
    SELECT u.id as user_id, u.full_name, u.team_id, t.leader_id, t.name as team_name, lead.full_name as leader_name
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users lead ON t.leader_id = lead.id
    WHERE u.team_id = 3
    LIMIT 5
");
$members = $stmtLeader->fetchAll(PDO::FETCH_ASSOC);
assertTest("Tìm thấy thành viên phòng Marketing (team_id = 3)", count($members) > 0);
if (!empty($members)) {
    echo "  -> Thành viên mẫu: " . $members[0]['full_name'] . " (ID: " . $members[0]['user_id'] . ")\n";
    echo "  -> Trưởng phòng được gán tự động: " . ($members[0]['leader_name'] ?: 'N/A') . " (ID: " . ($members[0]['leader_id'] ?: 'N/A') . ")\n";
}

// 3. Test insertion with related_user_ids and auto-approver for leave request
$testUserId = $members[0]['user_id'] ?? 100069;
$testLeaderId = $members[0]['leader_id'] ?? 100069;
$relatedIds = json_encode([100069, 1003]);

$stmtLeave = $pdo->prepare("
    INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status, approver_id, status_level_1, status_level_2, related_user_ids)
    VALUES (?, 'annual', CURDATE(), CURDATE(), 1.0, 'Test nghỉ phép tự động gắn trưởng phòng', 'pending', ?, 'pending', 'none', ?)
");
$resLeave = $stmtLeave->execute([$testUserId, $testLeaderId, $relatedIds]);
$insertedLeaveId = $pdo->lastInsertId();
assertTest("Tạo đơn nghỉ phép có related_user_ids và approver_id thành công (ID: $insertedLeaveId)", $resLeave && $insertedLeaveId > 0);

// Verify inserted record
$stmtCheck = $pdo->prepare("SELECT approver_id, related_user_ids FROM hrm_leave_requests WHERE id = ?");
$stmtCheck->execute([$insertedLeaveId]);
$leaveRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);
assertTest("approver_id được lưu chính xác", (int)$leaveRow['approver_id'] === (int)$testLeaderId);
assertTest("related_user_ids được lưu dạng JSON hợp lệ", strpos($leaveRow['related_user_ids'], '100069') !== false);

// Clean up test record
$pdo->prepare("DELETE FROM hrm_leave_requests WHERE id = ?")->execute([$insertedLeaveId]);
echo "  -> Đã dọn dẹp bản ghi kiểm thử leave #$insertedLeaveId\n";

printTestSummary();
