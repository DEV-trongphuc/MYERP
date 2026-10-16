<?php
// api/migrate_v10M.php
// Script tự động chạy toàn bộ Migration (Tối ưu cấu trúc Database)
require_once __DIR__ . '/db_connect.php';

set_time_limit(0);
ini_set('memory_limit', '1024M');

echo "<h1>HỆ THỐNG CẬP NHẬT DATABASE TỰ ĐỘNG (V10M SCALING)</h1>";
echo "<pre>";

function runSql($pdo, $sql, $description) {
    echo "▶ Đang chạy: $description...\n";
    try {
        $pdo->exec($sql);
        echo "<span style='color:green'>✔ Thành công.</span>\n\n";
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'Duplicate column name') !== false || strpos($msg, 'Duplicate key name') !== false || strpos($msg, 'Can\'t DROP') !== false) {
            echo "<span style='color:orange'>⚠ Bỏ qua: Đã được áp dụng từ trước.</span>\n\n";
        } else {
            echo "<span style='color:red'>✖ Lỗi: $msg</span>\n\n";
        }
    }
}

// ---------------------------------------------------------
// 1. Tối ưu hóa Index cho API Tracking
// ---------------------------------------------------------
$sql1_drop = "ALTER TABLE `web_sessions` DROP INDEX `idx_live_traffic`";
$sql1_add = "ALTER TABLE `web_sessions` ADD INDEX `idx_live_traffic` (`property_id`, `visitor_id`, `last_active_at`)";

echo "▶ Đang chạy: Tối ưu Index cho web_sessions...\n";
try {
    $pdo->exec($sql1_drop);
    $pdo->exec($sql1_add);
    echo "<span style='color:green'>✔ Thành công.</span>\n\n";
} catch (Exception $e) {
    $msg = $e->getMessage();
    if (strpos($msg, 'Can\'t DROP') !== false) {
        // Có thể index không tồn tại, cứ thử add
        try {
            $pdo->exec($sql1_add);
            echo "<span style='color:green'>✔ Thành công (Tạo mới).</span>\n\n";
        } catch (Exception $e2) {
            echo "<span style='color:orange'>⚠ Bỏ qua: Index có thể đã đúng chuẩn.</span>\n\n";
        }
    } elseif (strpos($msg, 'Duplicate key') !== false) {
        echo "<span style='color:orange'>⚠ Bỏ qua: Index đã được áp dụng.</span>\n\n";
    } else {
        echo "<span style='color:red'>✖ Lỗi: $msg</span>\n\n";
    }
}

// ---------------------------------------------------------
// 2. Tối ưu hóa Trích xuất JSON bằng Cột Ảo
// ---------------------------------------------------------
$sql2 = "ALTER TABLE `domation_ai_training_docs`
         ADD COLUMN `batch_id_virtual` VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.batch_id'))) VIRTUAL AFTER `metadata`,
         ADD INDEX `idx_batch_id_virtual` (`batch_id_virtual`)";
runSql($pdo, $sql2, "Tạo Virtual Column batch_id_virtual cho domation_ai_training_docs");

// ---------------------------------------------------------
// 3. Phân mảnh (Partitioning) Bảng Log khổng lồ
// LƯU Ý: Các lệnh dưới đây có thể mất từ 5-10 phút để chạy trên các bảng chục triệu dòng.
// ---------------------------------------------------------
$sql3 = "ALTER TABLE `web_events` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`, `created_at`);
         ALTER TABLE `web_events` PARTITION BY RANGE (TO_DAYS(created_at)) (
             PARTITION p2026_04_25 VALUES LESS THAN (TO_DAYS('2026-04-26')),
             PARTITION p2026_04_26 VALUES LESS THAN (TO_DAYS('2026-04-27')),
             PARTITION p2026_04_27 VALUES LESS THAN (TO_DAYS('2026-04-28')),
             PARTITION p_future VALUES LESS THAN MAXVALUE
         );";
runSql($pdo, $sql3, "Phân mảnh bảng web_events (Partitioning)");

$sql4 = "ALTER TABLE `system_audit_logs` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`, `created_at`);
         ALTER TABLE `system_audit_logs` PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
             PARTITION p_old VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01 00:00:00')),
             PARTITION p2026_04_01 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-02 00:00:00')),
             PARTITION p_future VALUES LESS THAN MAXVALUE
         );";
runSql($pdo, $sql4, "Phân mảnh bảng system_audit_logs (Partitioning)");

$sql5 = "ALTER TABLE `raw_event_buffer` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`, `created_at`);
         ALTER TABLE `raw_event_buffer` PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
             PARTITION p_old VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01 00:00:00')),
             PARTITION p2026_04_01 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-02 00:00:00')),
             PARTITION p_future VALUES LESS THAN MAXVALUE
         );";
runSql($pdo, $sql5, "Phân mảnh bảng raw_event_buffer (Partitioning)");

echo "<b>HOÀN TẤT QUÁ TRÌNH MIGRATE!</b>\n";
echo "Lưu ý: Nếu bị Timeout (504), hãy load lại trang này, script sẽ tự động bỏ qua các bước đã làm và chạy tiếp phần còn lại.";
echo "</pre>";
?>


