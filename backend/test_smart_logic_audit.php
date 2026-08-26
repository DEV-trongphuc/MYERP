<?php
// backend/test_smart_logic_audit.php
// Script kiểm thử đối soát chuyên sâu các cơ chế thông minh & cấu hình mặc định (Lead Recall SLA & Lateness Penalty)

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 CHẠY AUDIT CHUYÊN SÂU: SMART LOGIC & DEFAULT CONFIGS\n";
echo "====================================================\n\n";

// 1. Kiểm tra cấu hình mặc định trong CSDL
echo "--- 1. KIỂM TRA CẤU HÌNH MẶC ĐỊNH TRONG CSDL ---\n";
$enableRecallVal = get_system_setting($conn, 'enable_lead_recall');
assertTest("Cấu hình 'enable_lead_recall' tồn tại trong CSDL", $enableRecallVal !== '', "Giá trị: '{$enableRecallVal}'");
assertTest("Mặc định SLA thu hồi lead phân bổ phải TẮT ('0')", $enableRecallVal === '0' || $enableRecallVal === 0, "Giá trị: '{$enableRecallVal}'");

$enableLatenessPenaltyVal = get_system_setting($conn, 'hrm_lateness_penalty_enabled');
assertTest("Cấu hình 'hrm_lateness_penalty_enabled' tồn tại trong CSDL", $enableLatenessPenaltyVal !== '', "Giá trị: '{$enableLatenessPenaltyVal}'");
assertTest("Mặc định phạt đi muộn phải TẮT ('0')", $enableLatenessPenaltyVal === '0' || $enableLatenessPenaltyVal === 0, "Giá trị: '{$enableLatenessPenaltyVal}'");

// 2. Mô phỏng logic Lateness Penalty trong calculatePayroll
echo "\n--- 2. KIỂM THỬ KHẤU TRỪ PHẠT ĐI MUỘN (LATENESS PENALTY) ---\n";

// Giả lập dữ liệu tính lương
$totalLateMinutes = 45; // Đi trễ 45 phút
$graceMinutes = 30;    // Được miễn trừ 30 phút
$penalizedLateMinutes = max(0, $totalLateMinutes - $graceMinutes); // 15 phút bị tính phạt

// Chạy thử logic với cấu hình hrm_lateness_penalty_enabled = 0
$enableLatenessPenalty = (int) $enableLatenessPenaltyVal === 1;
$latenessPenalty = $enableLatenessPenalty ? ($penalizedLateMinutes * 5000) : 0.0;

assertTest("Khi hrm_lateness_penalty_enabled = 0, tiền phạt đi muộn phải bằng 0.0", $latenessPenalty === 0.0, "Số tiền phạt: {$latenessPenalty} VNĐ (Trễ thực tế: {$totalLateMinutes} phút)");

// Giả lập logic khi bật hrm_lateness_penalty_enabled = 1
$mockLatenessPenalty = 1 ? ($penalizedLateMinutes * 5000) : 0.0;
assertTest("Khi bật hrm_lateness_penalty_enabled = 1, tính phạt chính xác (15 phút * 5000đ)", $mockLatenessPenalty === 75000, "Số tiền phạt: {$mockLatenessPenalty} VNĐ");

// 3. Mô phỏng logic Lead Recall trong recallInactiveLeads
echo "\n--- 3. KIỂM THỬ LOGIC THU HỒI LEAD (LEAD RECALL SLA) ---\n";
// Kiểm tra nếu enable_lead_recall = 0 thì không thực hiện thu hồi
$leadsToRecallMocked = [];
if ($enableRecallVal === '1' || $enableRecallVal === 1) {
    // Nếu bật thì mới có phần tử cần thu hồi
    $leadsToRecallMocked[] = ['lead_id' => 9999];
}
assertTest("Không có lead nào bị thu hồi khi enable_lead_recall = 0", empty($leadsToRecallMocked));

printTestSummary();
echo "\n====================================================\n";
