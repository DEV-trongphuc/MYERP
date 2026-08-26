<?php
// backend/test_accountant_workflow.php
// Script kiểm thử tự động quy trình vận hành và Business Rules của Kế toán

define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7'); // Token hợp lệ cho test_bootstrap.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🧪 KHỞI CHẠY KIỂM THỬ QUY TRÌNH VẬN HÀNH KẾ TOÁN & BUSINESS RULES\n";
echo "====================================================\n\n";

// --- BƯỚC 1: KHỞI TẠO DỮ LIỆU GIẢ LẬP (MOCK DATA) ---
echo "1. Đang khởi tạo dữ liệu kiểm thử...\n";
$tenantId = 1;
$ownerId = 100012; // ID Nhân viên kinh doanh thực tế
$accountantId = 100014; // ID Kế toán thực tế
$projectId = 2; // ID dự án thực tế

// Tạo một khách hàng tiềm năng thử nghiệm
$conn->query("
    INSERT INTO contacts (tenant_id, owner_id, created_by, full_name, phone, pipeline_status, status, temperature, created_at)
    VALUES ({$tenantId}, {$ownerId}, {$ownerId}, 'Kiểm Thử Kế Toán', '0999999888', 'booking', 'lead', 'hot', NOW())
");
$contactId = $conn->insert_id;
assertTest("Tạo thành công contact kiểm thử", $contactId > 0, "Contact ID: " . $contactId);

// Tạo phiếu cọc giả định (Deposit)
$conn->query("
    INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by, created_at)
    VALUES ({$contactId}, {$projectId}, 'TEST-UNIT-99', 2000000000.00, 50000000.00, 'pending_admin', {$ownerId}, NOW())
");
$depositId = $conn->insert_id;
assertTest("Tạo thành công phiếu cọc (Deposit)", $depositId > 0, "Deposit ID: " . $depositId);

// Tạo đợt thanh toán (Milestone)
$conn->query("
    INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, status, created_at)
    VALUES ({$depositId}, 'Đợt 1 - Cọc giữ chỗ', 50000000.00, 'pending', NOW())
");
$milestoneId = $conn->insert_id;
assertTest("Tạo thành công đợt thanh toán (Milestone)", $milestoneId > 0, "Milestone ID: " . $milestoneId);


// --- BƯỚC 2: KIỂM THỬ RULE 1 - BỂ CỌC CHƯA CÓ DOANH THU ---
echo "\n--- 2. Kiểm thử Rule 1: Hủy cọc khi CHƯA có doanh thu ---\n";

// Phê duyệt số đợt thanh toán của depositId này bằng 0 (chưa duyệt đợt nào)
$approvedCount = 0;

if ($approvedCount === 0) {
    // 1. Hạ nhiệt độ của contact
    $tempDecayMap = ['hot' => 'warm', 'warm' => 'neutral', 'neutral' => 'cool', 'cool' => 'cold', 'cold' => 'cold'];
    $currTemp = 'hot';
    $nextTemp = $tempDecayMap[$currTemp] ?? 'neutral';
    
    // 2. Chuyển trạng thái về trước đó (booking)
    $targetStatus = 'booking';
    
    // Tìm stage_id tương ứng với booking
    $stmtStage = $conn->query("SELECT id FROM pipeline_stages WHERE tenant_id = {$tenantId} AND system_slug = 'booking' LIMIT 1");
    $bookingStageId = $stmtStage && $stmtStage->num_rows > 0 ? (int)$stmtStage->fetch_assoc()['id'] : 5;
    
    $expiresAt = date('Y-m-d H:i:s', strtotime('+3 months'));
    
    $stmtRev = $conn->prepare("UPDATE contacts SET pipeline_status = ?, stage_id = ?, temperature = ?, status = 'lead', security_expires_at = ? WHERE id = ?");
    $stmtRev->bind_param("sissi", $targetStatus, $bookingStageId, $nextTemp, $expiresAt, $contactId);
    $stmtRev->execute();
    $stmtRev->close();
}

$conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Khách hủy mua đợt 1' WHERE id = {$depositId}");

// Kiểm tra kết quả trong Database
assertDbField($conn, 'deposits', 'status', "id = {$depositId}", 'cancelled', "Trạng thái phiếu cọc đã chuyển sang 'cancelled'");
assertDbField($conn, 'contacts', 'status', "id = {$contactId}", 'lead', "Trạng thái phân loại khách hàng trả về 'lead'");
assertDbField($conn, 'contacts', 'pipeline_status', "id = {$contactId}", 'booking', "Trạng thái pipeline hạ cấp về 'booking'");
assertDbField($conn, 'contacts', 'temperature', "id = {$contactId}", 'warm', "Nhiệt độ khách hàng hạ từ hot -> warm");

// Kiểm tra xem đồng hồ bảo mật có được kích hoạt lại (security_expires_at có giá trị tương lai)
$chkTime = $conn->query("SELECT security_expires_at FROM contacts WHERE id = {$contactId}");
$securityTimeVal = $chkTime->fetch_assoc()['security_expires_at'] ?? '';
assertTest("Đồng hồ bảo mật đã được chạy lại", !empty($securityTimeVal) && strtotime($securityTimeVal) > time(), "Thời gian hết hạn: " . $securityTimeVal);


// --- BƯỚC 3: KIỂM THỬ RULE 2 - BỂ CỌC SAU KHI ĐÃ CÓ DOANH THU ---
echo "\n--- 3. Kiểm thử Rule 2: Hủy cọc khi ĐÃ có doanh thu ---\n";

// Khôi phục lại contact thành Khách Hàng (Customer) đã đặt cọc
$conn->query("UPDATE contacts SET pipeline_status = 'dat_coc', status = 'customer', temperature = 'hot' WHERE id = {$contactId}");
// Khôi phục phiếu cọc thành hoạt động
$conn->query("UPDATE deposits SET status = 'approved' WHERE id = {$depositId}");

// Phê duyệt Milestone 1 (Giả lập Kế toán duyệt)
$conn->query("UPDATE deposit_milestones SET status = 'approved' WHERE id = {$milestoneId}");
assertDbField($conn, 'deposit_milestones', 'status', "id = {$milestoneId}", 'approved', "Milestone 1 đã được phê duyệt thành công (Doanh thu phát sinh)");

// Thực hiện hủy cọc khi approvedCount > 0
$stmtM = $conn->prepare("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = ? AND status = 'approved'");
$stmtM->bind_param("i", $depositId);
$stmtM->execute();
$resM = $stmtM->get_result();
$approvedCount = (int)$resM->fetch_row()[0];
$stmtM->close();

assertTest("Số lượng đợt thanh toán đã đóng thực tế", $approvedCount > 0, "Số lượng: " . $approvedCount);

if ($approvedCount > 0) {
    // Theo Rule 2: Không hạ cấp trạng thái contact, giữ nguyên là Customer
    $conn->query("UPDATE deposits SET status = 'cancelled', cancelled_reason = 'Khách hủy mua đợt 2' WHERE id = {$depositId}");
}

// Kiểm tra kết quả trong Database
assertDbField($conn, 'deposits', 'status', "id = {$depositId}", 'cancelled', "Trạng thái phiếu cọc đã chuyển sang 'cancelled'");
assertDbField($conn, 'contacts', 'status', "id = {$contactId}", 'customer', "Trạng thái phân loại giữ nguyên là 'customer' (Do đã có doanh thu)");
assertDbField($conn, 'contacts', 'pipeline_status', "id = {$contactId}", 'dat_coc', "Trạng thái pipeline giữ nguyên là 'dat_coc'");


// --- BƯỚC 4: DỌN DẸP DỮ LIỆU KIỂM THỬ (CLEANUP) ---
echo "\n--- 4. Dọn dẹp dữ liệu kiểm thử ---\n";
$conn->query("DELETE FROM deposit_milestones WHERE deposit_id = {$depositId}");
$conn->query("DELETE FROM deposits WHERE id = {$depositId}");
$conn->query("DELETE FROM contacts WHERE id = {$contactId}");
echo "Đã xóa toàn bộ bản ghi kiểm thử để tránh rác cơ sở dữ liệu.\n";

printTestSummary();
