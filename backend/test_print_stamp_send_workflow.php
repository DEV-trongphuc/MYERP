<?php
// backend/test_print_stamp_send_workflow.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 KIỂM THỬ KHÉP KÍN (E2E) QUY TRÌNH: IN, ĐÓNG DẤU & GỬI HỒ SƠ\n";
echo "   Mô phỏng toàn bộ vòng đời nghiệp vụ & đối soát dữ liệu\n";
echo "====================================================\n\n";

$tenantId = 1;
$creatorUserId = 100009; // Dev Admin
$executorUserId = 100013; // Nhân sự Demo (Giả lập Nguyễn Thị Duy Phương)

// 1. Tạo dữ liệu mô tả dạng cấu trúc chuỗi
$reqEmployeeName = "Huỳnh Trọng Phúc";
$reqDate = date('Y-m-d');
$executorName = "Nguyễn Thị Duy Phương";
$sendMethod = "Chuyển phát nhanh";
$sendTimeFrame = "Chiều (13:00 - 17:00)";
$recipientName = "Nguyễn Văn A";
$recipientAddress = "123 Đường ABC, Quận 1, TP. HCM";
$recipientPhone = "0987654321";
$requiredSendDate = date('Y-m-d', strtotime('+1 day'));

$generalDesc = "Quy trình: In, đóng dấu và gửi hồ sơ\n" .
              "Nhân viên yêu cầu: {$reqEmployeeName}\n" .
              "Ngày yêu cầu: {$reqDate}\n" .
              "Người thực hiện: {$executorName}\n" .
              "Hình thức gửi: {$sendMethod}\n" .
              "Khung giờ gửi: {$sendTimeFrame}\n" .
              "Tên người nhận: {$recipientName}\n" .
              "Địa chỉ người nhận: {$recipientAddress}\n" .
              "SĐT người nhận: {$recipientPhone}\n" .
              "Ngày cần gửi hồ sơ: {$requiredSendDate}";

// 2. Chạy Bước 1: Khởi tạo đề xuất gửi lên hệ thống
echo "[BƯỚC 1] Khởi tạo đề xuất & lưu trữ vào CSDL...\n";
try {
    $stmt = $pdo->prepare("INSERT INTO expenses (
        tenant_id, created_by, title, description, notes, amount, status, approver_id, currency, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, 'VND', NOW())");
    
    $stmt->execute([
        $tenantId,
        $creatorUserId,
        "Đăng ký: In, đóng dấu và gửi hồ sơ của Huỳnh Trọng Phúc",
        $generalDesc,
        $generalDesc,
        $executorUserId
    ]);
    
    $expenseId = $pdo->lastInsertId();
    assertTest("Khởi tạo đề xuất trong bảng expenses thành công (ID: {$expenseId})", $expenseId > 0);
    
} catch (\Throwable $e) {
    assertTest("Khởi tạo đề xuất thất bại", false, $e->getMessage());
    exit(1);
}

// 3. Chạy Bước 2: Đối soát dữ liệu và phân tích cấu trúc chuỗi mô tả
echo "\n[BƯỚC 2] Đối soát cấu trúc lưu trữ và giải mã các trường thông tin...\n";
try {
    $checkStmt = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $checkStmt->execute([$expenseId]);
    $expense = $checkStmt->fetch();
    
    assertTest("Dữ liệu tồn tại trong CSDL", !empty($expense));
    assertTest("Trạng thái ban đầu là 'pending'", $expense['status'] === 'pending');
    assertTest("Gán người thực hiện (approver_id = {$executorUserId}) chính xác", (int)$expense['approver_id'] === $executorUserId);
    
    // Giả lập bộ parser trên React: Bóc tách các trường từ notes
    $rawDesc = $expense['notes'];
    $fields = [];
    $lines = explode("\n", $rawDesc);
    foreach ($lines as $line) {
        $parts = explode(": ", $line, 2);
        if (count($parts) === 2) {
            $fields[trim($parts[0])] = trim($parts[1]);
        }
    }
    
    assertTest("Parser bóc tách 'Nhân viên yêu cầu' khớp", ($fields['Nhân viên yêu cầu'] ?? '') === $reqEmployeeName);
    assertTest("Parser bóc tách 'Người thực hiện' khớp", ($fields['Người thực hiện'] ?? '') === $executorName);
    assertTest("Parser bóc tách 'Hình thức gửi' khớp", ($fields['Hình thức gửi'] ?? '') === $sendMethod);
    assertTest("Parser bóc tách 'Địa chỉ người nhận' khớp", ($fields['Địa chỉ người nhận'] ?? '') === $recipientAddress);
    assertTest("Parser bóc tách 'SĐT người nhận' khớp", ($fields['SĐT người nhận'] ?? '') === $recipientPhone);
    
} catch (\Throwable $e) {
    assertTest("Đối soát cấu trúc lưu trữ thất bại", false, $e->getMessage());
}

// 4. Chạy Bước 3: Giả lập người thực hiện bấm "Xác nhận hoàn thành"
echo "\n[BƯỚC 3] Giả lập Người thực hiện bấm 'Xác nhận hoàn thành'...\n";
try {
    $updateStmt = $pdo->prepare("UPDATE expenses SET status = 'approved', approved_at = NOW() WHERE id = ?");
    $updateStmt->execute([$expenseId]);
    
    $checkStmt->execute([$expenseId]);
    $updatedExpense = $checkStmt->fetch();
    
    assertTest("Cập nhật trạng thái thành 'approved' (hoàn thành) thành công", $updatedExpense['status'] === 'approved');
    assertTest("Thời gian duyệt (approved_at) được ghi nhận", !empty($updatedExpense['approved_at']));
    
} catch (\Throwable $e) {
    assertTest("Xác nhận hoàn thành thất bại", false, $e->getMessage());
}

// 5. Chạy Bước 4: Dọn dẹp dữ liệu kiểm thử
echo "\n[BƯỚC 4] Dọn dẹp dữ liệu kiểm thử, khôi phục CSDL sạch...\n";
try {
    $deleteStmt = $pdo->prepare("DELETE FROM expenses WHERE id = ?");
    $deleteStmt->execute([$expenseId]);
    
    $checkStmt->execute([$expenseId]);
    $deletedExpense = $checkStmt->fetch();
    
    assertTest("Đã xóa dữ liệu kiểm thử để giải phóng bộ nhớ", empty($deletedExpense));
    
} catch (\Throwable $e) {
    assertTest("Dọn dẹp thất bại", false, $e->getMessage());
}

echo "\n====================================================\n";
echo "🏆 KẾT QUẢ RUNNER HỒ SƠ QUY TRÌNH:\n";
printTestSummary();
echo "====================================================\n";
?>
