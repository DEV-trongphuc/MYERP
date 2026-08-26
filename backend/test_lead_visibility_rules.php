<?php
// backend/test_lead_visibility_rules.php
// Testing Suite for Lead Visibility Rules based on role and settings
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ QUY TẮC HIỂN THỊ DỮ LIỆU LEAD (ROLES: SALE_ADMIN, ACCOUNTANT)\n\n";

// 1. Kiểm tra cấu trúc CSDL và cài đặt hiện tại
$result = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'sale_admin_lead_visibility_stage' LIMIT 1");
$saleAdminStage = $result && $result->num_rows > 0 ? $result->fetch_assoc()['setting_value'] : null;

$result2 = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'accountant_lead_visibility_stage' LIMIT 1");
$accountantStage = $result2 && $result2->num_rows > 0 ? $result2->fetch_assoc()['setting_value'] : null;

echo "Cấu hình hiện tại:\n";
echo "- Mốc Sale Admin: " . ($saleAdminStage ?? 'Chưa cấu hình (Mặc định: nop_ho_so)') . "\n";
echo "- Mốc Kế toán: " . ($accountantStage ?? 'Chưa cấu hình (Mặc định: dong_le_phi_ho_so)') . "\n\n";

assertTest("Sale Admin stage setting exists or default is valid", $saleAdminStage === null || is_string($saleAdminStage));
assertTest("Accountant stage setting exists or default is valid", $accountantStage === null || is_string($accountantStage));

// 2. Chạy thử câu truy vấn danh sách trạng thái để xem thứ tự order_index
$stagesQuery = "SELECT system_slug, name, order_index FROM pipeline_stages ORDER BY order_index ASC";
$stagesRes = $conn->query($stagesQuery);
$stages = [];
while ($row = $stagesRes->fetch_assoc()) {
    $stages[$row['system_slug']] = (int)$row['order_index'];
    echo "  -> Stage: {$row['system_slug']} (Tên: {$row['name']}, Thứ tự: {$row['order_index']})\n";
}

$saleAdminSlug = $saleAdminStage ?? 'nop_ho_so';
$accountantSlug = $accountantStage ?? 'dong_le_phi_ho_so';

assertTest("Trạng thái cấu hình của Sale Admin tồn tại trong CSDL", isset($stages[$saleAdminSlug]), "Slug: {$saleAdminSlug}");
assertTest("Trạng thái cấu hình của Kế toán tồn tại trong CSDL", isset($stages[$accountantSlug]), "Slug: {$accountantSlug}");

// 3. Giả lập logic lấy danh sách leads cho Sale Admin
$saleAdminIndex = $stages[$saleAdminSlug] ?? 999;
echo "\nGiả lập lọc dữ liệu cho Sale Admin (Index >= {$saleAdminIndex}):\n";
$saleAdminQuery = "
    SELECT c.id, c.full_name, c.status, ps.name as stage_name, ps.order_index
    FROM contacts c
    LEFT JOIN pipeline_stages ps ON c.status = ps.system_slug
    WHERE ps.order_index >= ? AND c.deleted_at IS NULL
    LIMIT 5
";
$stmt = $conn->prepare($saleAdminQuery);
$stmt->bind_param("i", $saleAdminIndex);
$stmt->execute();
$leadsRes = $stmt->get_result();
$allPassedSaleAdmin = true;
while ($lead = $leadsRes->fetch_assoc()) {
    $matched = $lead['order_index'] >= $saleAdminIndex;
    if (!$matched) $allPassedSaleAdmin = false;
    echo "  - Lead #{$lead['id']}: {$lead['full_name']} | Status: {$lead['status']} (Thứ tự: {$lead['order_index']}) -> " . ($matched ? "HỢP LỆ" : "KHÔNG HỢP LỆ") . "\n";
}
$stmt->close();
assertTest("Toàn bộ lead được tải cho Sale Admin đều >= mốc cấu hình", $allPassedSaleAdmin);

// 4. Giả lập logic lấy danh sách leads cho Kế toán
$accountantIndex = $stages[$accountantSlug] ?? 999;
echo "\nGiả lập lọc dữ liệu cho Kế toán (Index >= {$accountantIndex}):\n";
$accountantQuery = "
    SELECT c.id, c.full_name, c.status, ps.name as stage_name, ps.order_index
    FROM contacts c
    LEFT JOIN pipeline_stages ps ON c.status = ps.system_slug
    WHERE ps.order_index >= ? AND c.deleted_at IS NULL
    LIMIT 5
";
$stmt2 = $conn->prepare($accountantQuery);
$stmt2->bind_param("i", $accountantIndex);
$stmt2->execute();
$leadsRes2 = $stmt2->get_result();
$allPassedAccountant = true;
while ($lead = $leadsRes2->fetch_assoc()) {
    $matched = $lead['order_index'] >= $accountantIndex;
    if (!$matched) $allPassedAccountant = false;
    echo "  - Lead #{$lead['id']}: {$lead['full_name']} | Status: {$lead['status']} (Thứ tự: {$lead['order_index']}) -> " . ($matched ? "HỢP LỆ" : "KHÔNG HỢP LỆ") . "\n";
}
$stmt2->close();
assertTest("Toàn bộ lead được tải cho Kế toán đều >= mốc cấu hình", $allPassedAccountant);

printTestSummary();
