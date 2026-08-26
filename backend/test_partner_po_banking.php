<?php
// backend/test_partner_po_banking.php
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ KHÉP KÍN THÔNG TIN NGÂN HÀNG ĐỐI TÁC & LIÊN KẾT PO\n";
echo "==================================================================\n\n";

// 1. Kiểm tra cấu trúc bảng `companies` (Schema Audit)
echo "--- 1. KIỂM TRA SCHEMA BẢNG companies ---\n";
$resBankName = $conn->query("SHOW COLUMNS FROM `companies` LIKE 'bank_name'");
assertTest("Cột 'bank_name' tồn tại trong bảng 'companies'", $resBankName && $resBankName->num_rows > 0);

$resBankAccNum = $conn->query("SHOW COLUMNS FROM `companies` LIKE 'bank_account_number'");
assertTest("Cột 'bank_account_number' tồn tại trong bảng 'companies'", $resBankAccNum && $resBankAccNum->num_rows > 0);

$resBankAccName = $conn->query("SHOW COLUMNS FROM `companies` LIKE 'bank_account_name'");
assertTest("Cột 'bank_account_name' tồn tại trong bảng 'companies'", $resBankAccName && $resBankAccName->num_rows > 0);

// 2. Chạy thử nghiệm CRUD đối tác và cập nhật thông tin ngân hàng
echo "\n--- 2. CHẠY THỬ NGHIỆM CRUD THÔNG TIN TÀI KHOẢN ---\n";

try {
    // Tìm một user hợp lệ trong DB để tránh lỗi khóa ngoại (Foreign Key)
    $userQuery = $conn->query("SELECT id FROM users LIMIT 1");
    $userRow = $userQuery->fetch_assoc();
    $userId = $userRow ? (int)$userRow['id'] : null;

    if ($userId === null) {
        echo "❌ KHÔNG TÌM THẤY USER TRONG HỆ THỐNG ĐỂ CHẠY TEST.\n";
        exit(1);
    }
    
    // Dọn dẹp dữ liệu cũ nếu trùng
    $conn->query("DELETE FROM `companies` WHERE `name` = 'Test Partner AutoPO'");

    // Thêm mới đối tác có đủ tài khoản ngân hàng
    $insertSql = "INSERT INTO `companies` (tenant_id, created_by, name, tier, bank_name, bank_account_number, bank_account_name, status) 
                  VALUES (1, $userId, 'Test Partner AutoPO', 'f1', 'Vietcombank', '19034567890', 'CONG TY DOI TAC VIET', 'active')";
    $res = $conn->query($insertSql);

    if (!$res) {
        echo "❌ LỖI TRUY VẤN INSERT: " . $conn->error . "\n";
        exit(1);
    }

    $insertedId = $conn->insert_id;
    assertTest("Thêm thành công đối tác test có ID: " . $insertedId, $insertedId > 0);

    if ($insertedId > 0) {
        // Truy vấn đối soát
        $stmt = $conn->prepare("SELECT bank_name, bank_account_number, bank_account_name FROM `companies` WHERE `id` = ?");
        if (!$stmt) {
            echo "❌ LỖI PREPARE SELECT: " . $conn->error . "\n";
            exit(1);
        }
        $stmt->bind_param("i", $insertedId);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        assertTest("Truy xuất đúng Tên ngân hàng: " . ($result['bank_name'] ?? ''), ($result['bank_name'] ?? '') === 'Vietcombank');
        assertTest("Truy xuất đúng Số tài khoản: " . ($result['bank_account_number'] ?? ''), ($result['bank_account_number'] ?? '') === '19034567890');
        assertTest("Truy xuất đúng Chủ tài khoản: " . ($result['bank_account_name'] ?? ''), ($result['bank_account_name'] ?? '') === 'CONG TY DOI TAC VIET');
        
        // Cập nhật thông tin tài khoản
        $updateSql = "UPDATE `companies` SET `bank_name` = 'Techcombank', `bank_account_number` = '19012345678' WHERE `id` = " . $insertedId;
        $resUpdate = $conn->query($updateSql);
        if (!$resUpdate) {
            echo "❌ LỖI TRUY VẤN UPDATE: " . $conn->error . "\n";
            exit(1);
        }
        
        $stmt2 = $conn->prepare("SELECT bank_name, bank_account_number FROM `companies` WHERE `id` = ?");
        if (!$stmt2) {
            echo "❌ LỖI PREPARE SELECT 2: " . $conn->error . "\n";
            exit(1);
        }
        $stmt2->bind_param("i", $insertedId);
        $stmt2->execute();
        $result2 = $stmt2->get_result()->fetch_assoc();
        $stmt2->close();
        
        assertTest("Cập nhật và truy xuất lại thông tin ngân hàng thành công", ($result2['bank_name'] ?? '') === 'Techcombank' && ($result2['bank_account_number'] ?? '') === '19012345678');
        
        // Dọn dẹp dữ liệu test
        $conn->query("DELETE FROM `companies` WHERE `id` = " . $insertedId);
        echo "🧹 Đã dọn dẹp đối tác thử nghiệm.\n";
    }
} catch (Throwable $e) {
    echo "❌ BẮT ĐƯỢC EXCEPTION: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

echo "\n--- KẾT THÚC KIỂM THỬ KHÉP KÍN ---\n";
printTestSummary();
