<?php
// backend/test_marketing_dashboard.php
// PHP test harness script to verify marketing dashboard statistics and database queries

require_once __DIR__ . '/test_bootstrap.php';
header('Content-Type: text/plain; charset=utf-8');

echo "🚀 BẮT ĐẦU CHẠY KIỂM THỬ MARKETING DASHBOARD & DATABASE:\n\n";

// 1. Kiểm tra cấu trúc các bảng SQL liên quan
$tablesToCheck = ['leads', 'contacts', 'deals', 'invoices', 'pipeline_stages'];
foreach ($tablesToCheck as $table) {
    $res = $conn->query("SHOW TABLES LIKE '{$table}'");
    assertTest("Bảng CSDL '{$table}' tồn tại", $res && $res->num_rows > 0, "Bảng '{$table}' được phát hiện trong CSDL");
}

// 2. Kiểm tra sự tồn tại của Pipeline Stage chốt won deal (id = 7 hoặc is_won = 1)
$stageRes = $conn->query("SELECT id, name FROM pipeline_stages WHERE is_won = 1 LIMIT 1");
$stageExists = ($stageRes && $stageRes->num_rows > 0);
assertTest("Pipeline Stage 'Đóng deal' (is_won = 1) tồn tại", $stageExists, $stageExists ? "Tìm thấy Stage chốt thành công" : "Vui lòng chạy seeder để khởi tạo các Stage");

// 3. Thực thi thử nghiệm truy vấn Cohort Conversion Speed
$cohortSql = "
    SELECT 
        DATE_FORMAT(l.created_at, '%m/%Y') as cohort_month,
        COUNT(l.id) as total_leads,
        SUM(CASE WHEN ps.is_won = 1 AND DATEDIFF(d.actual_close_date, l.created_at) <= 30 THEN 1 ELSE 0 END) as converted_1_month
    FROM leads l
    LEFT JOIN contacts c ON l.person_id = c.person_id AND c.deleted_at IS NULL
    LEFT JOIN deals d ON c.id = d.contact_id AND d.deleted_at IS NULL
    LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
    GROUP BY cohort_month
    ORDER BY MIN(l.created_at) ASC
    LIMIT 5
";
$cohortQueryRes = $conn->query($cohortSql);
assertTest("Truy vấn Cohort Conversion Speed chạy thành công", $cohortQueryRes !== false, $cohortQueryRes ? "Query trả về kết quả thành công" : $conn->error);

// 4. Thực thi thử nghiệm truy vấn Doanh thu thực tế vs Doanh thu dự kiến
$revProjSql = "
    SELECT 
        dates.month,
        COALESCE(realized_tbl.realized, 0) as realized_revenue,
        COALESCE(projected_tbl.projected, 0) as projected_revenue
    FROM (
        SELECT DISTINCT DATE_FORMAT(paid_at, '%m/%Y') as month, MIN(paid_at) as min_date FROM invoices WHERE status = 'paid' AND paid_at IS NOT NULL GROUP BY month
        UNION
        SELECT DISTINCT DATE_FORMAT(due_date, '%m/%Y') as month, MIN(due_date) as min_date FROM invoices WHERE status IN ('pending', 'draft', 'overdue') AND due_date IS NOT NULL GROUP BY month
    ) dates
    LEFT JOIN (
        SELECT DATE_FORMAT(paid_at, '%m/%Y') as month, SUM(total) as realized
        FROM invoices
        WHERE status = 'paid' AND paid_at IS NOT NULL AND deleted_at IS NULL
        GROUP BY month
    ) realized_tbl ON dates.month = realized_tbl.month
    LEFT JOIN (
        SELECT DATE_FORMAT(due_date, '%m/%Y') as month, SUM(total) as projected
        FROM invoices
        WHERE status IN ('pending', 'draft', 'overdue') AND due_date IS NOT NULL AND deleted_at IS NULL
        GROUP BY month
    ) projected_tbl ON dates.month = projected_tbl.month
    WHERE dates.month IS NOT NULL
    GROUP BY dates.month
    ORDER BY MIN(dates.min_date) ASC
    LIMIT 5
";
$revQueryRes = $conn->query($revProjSql);
assertTest("Truy vấn Doanh thu Thực tế vs Doanh thu Dự kiến chạy thành công", $revQueryRes !== false, $revQueryRes ? "Query trả về kết quả thành công" : $conn->error);

// 5. Kiểm tra tính toàn vẹn của Dữ liệu (chạy thử kiểm tra một lead demo)
$leadDemoCheck = $conn->query("SELECT id, name FROM leads WHERE email LIKE '%@demo.marketing.test' LIMIT 1");
if ($leadDemoCheck && $leadDemoCheck->num_rows > 0) {
    $lead = $leadDemoCheck->fetch_assoc();
    echo "ℹ️  Phát hiện lead demo đã được nạp: ID = {$lead['id']}, Name = {$lead['name']}\n";
    assertTest("Dữ liệu demo Marketing tồn tại", true, "Database đã có dữ liệu demo cho việc đối soát");
} else {
    echo "⚠️  Chưa phát hiện dữ liệu demo Marketing. Hãy bấm 'Nạp dữ liệu mẫu Marketing' trên Dashboard Admin/Director.\n";
    assertTest("Dữ liệu demo Marketing tồn tại", false, "Chưa nạp dữ liệu mẫu");
}

printTestSummary();
