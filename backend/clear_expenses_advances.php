<?php
// backend/clear_expenses_advances.php
// PRODUCTION DATA RESET - CLEAR EXPENSES & SALARY ADVANCES & APPROVAL COMMENTS

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 DỌN DẸP CHI PHÍ (EXPENSES) & TẠM ỨNG (SALARY ADVANCES)\n";
echo "====================================================\n\n";

// 1. Snapshot Backup
echo "--- 1. TẠO BẢN SAO LƯU AN TOÀN ---\n";
try {
    $bakExp = "_bak_expenses_" . date('Ymd_His');
    $pdo->exec("CREATE TABLE IF NOT EXISTS `{$bakExp}` AS SELECT * FROM `expenses`");
    $cntExp = $pdo->query("SELECT COUNT(*) FROM `{$bakExp}`")->fetchColumn();
    echo " ✅ Đã backup bảng 'expenses' -> '{$bakExp}' ({$cntExp} bản ghi)\n";
} catch (\Throwable $e) {
    echo " ⚠️ Backup 'expenses': " . $e->getMessage() . "\n";
}

try {
    $bakAdv = "_bak_hrm_salary_advances_" . date('Ymd_His');
    $pdo->exec("CREATE TABLE IF NOT EXISTS `{$bakAdv}` AS SELECT * FROM `hrm_salary_advances`");
    $cntAdv = $pdo->query("SELECT COUNT(*) FROM `{$bakAdv}`")->fetchColumn();
    echo " ✅ Đã backup bảng 'hrm_salary_advances' -> '{$bakAdv}' ({$cntAdv} bản ghi)\n";
} catch (\Throwable $e) {
    echo " ⚠️ Backup 'hrm_salary_advances': " . $e->getMessage() . "\n";
}

// 2. Clear / Truncate Tables
echo "\n--- 2. TIẾN HÀNH XÓA SẠCH DỮ LIỆU ---\n";
try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    $pdo->exec("TRUNCATE TABLE `expenses`");
    echo " ✅ Đã dọn sạch: expenses (về 0 bản ghi)\n";

    $pdo->exec("TRUNCATE TABLE `hrm_salary_advances`");
    echo " ✅ Đã dọn sạch: hrm_salary_advances (về 0 bản ghi)\n";

    $pdo->exec("DELETE FROM `comments` WHERE entity_type IN ('expense', 'hrm_advance', 'hrm_leave')");
    echo " ✅ Đã dọn sạch bình luận quy trình trong bảng comments\n";

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "\n🏆 DỌN DẸP HOÀN TẤT THÀNH CÔNG!\n";
} catch (\Throwable $e) {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    die("❌ LỖI TRONG QUÁ TRÌNH DỌN DẸP: " . $e->getMessage() . "\n");
}

// 3. Đối soát lại
echo "\n--- 3. ĐỐI SOÁT KẾT QUẢ CUỐI CÙNG ---\n";
$expAfter = (int)$pdo->query("SELECT COUNT(*) FROM expenses")->fetchColumn();
$advAfter = (int)$pdo->query("SELECT COUNT(*) FROM hrm_salary_advances")->fetchColumn();
$leaveAfter = (int)$pdo->query("SELECT COUNT(*) FROM hrm_leave_requests")->fetchColumn();

assertTest("Bảng expenses (Chi phí / PO) đã về 0", $expAfter === 0, "Số lượng: {$expAfter}");
assertTest("Bảng hrm_salary_advances (Tạm ứng lương) đã về 0", $advAfter === 0, "Số lượng: {$advAfter}");
assertTest("Bảng hrm_leave_requests (Nghỉ phép) đã về 0", $leaveAfter === 0, "Số lượng: {$leaveAfter}");

printTestSummary();
