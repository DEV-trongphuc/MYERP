<?php
require_once 'db_connect.php';

// Đã kiểm tra xong - Khóa cứng script chỉ cho phép chạy từ CLI (Phase 8 Security)
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Unauthorized: This script can only be run from the command line (CLI).");
}

try {
    echo "<h2>PHÂN TÍCH DỮ LIỆU RÁC (SUBSCRIBER_LISTS)</h2>";
    
    // 1. Phân tích Dữ liệu Trùng Lặp (Duplicates)
    $dupCount = $pdo->query("
        SELECT COUNT(*) FROM (
            SELECT subscriber_id, list_id, COUNT(*) as cnt 
            FROM subscriber_lists 
            GROUP BY subscriber_id, list_id 
            HAVING cnt > 1
        ) as subq
    ")->fetchColumn();
    
    // 2. Phân tích Dữ liệu Mồ Côi (Orphans - Không tồn tại User)
    $orphanUserCount = $pdo->query("
        SELECT COUNT(*) 
        FROM subscriber_lists sl 
        LEFT JOIN subscribers s ON sl.subscriber_id = s.id 
        WHERE s.id IS NULL
    ")->fetchColumn();

    // 3. Phân tích Dữ liệu Mồ Côi (Orphans - Không tồn tại List)
    $orphanListCount = $pdo->query("
        SELECT COUNT(*) 
        FROM subscriber_lists sl 
        LEFT JOIN lists l ON sl.list_id = l.id 
        WHERE l.id IS NULL
    ")->fetchColumn();

    echo "<ul>";
    echo "<li>Số lượng cặp dữ liệu bị <b>trùng lặp</b> (Duplicates): <b style='color:orange'>$dupCount</b></li>";
    echo "<li>Số lượng dữ liệu mồ côi (Do <b>User</b> đã bị xóa): <b style='color:red'>$orphanUserCount</b></li>";
    echo "<li>Số lượng dữ liệu mồ côi (Do <b>Danh sách</b> đã bị xóa): <b style='color:red'>$orphanListCount</b></li>";
    echo "</ul>";

    $totalTrash = $dupCount + $orphanUserCount + $orphanListCount;

    if (isset($_GET['confirm']) && $_GET['confirm'] === 'yes') {
        echo "<hr><h3>ĐANG TIẾN HÀNH DỌN DẸP...</h3>";
        
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
        
        // Tạo bảng tạm chỉ chứa các dữ liệu SACH (KHÔNG TRÙNG + KHÔNG MỒ CÔI)
        $pdo->exec("DROP TABLE IF EXISTS tmp_sl;");
        $pdo->exec("
            CREATE TABLE tmp_sl AS 
            SELECT DISTINCT sl.subscriber_id, sl.list_id 
            FROM subscriber_lists sl
            INNER JOIN subscribers s ON sl.subscriber_id = s.id
            INNER JOIN lists l ON sl.list_id = l.id
        ");
        
        // Xóa bảng gốc và chèn lại dữ liệu sạch
        $pdo->exec("TRUNCATE TABLE subscriber_lists;");
        $pdo->exec("INSERT IGNORE INTO subscriber_lists SELECT * FROM tmp_sl;");
        $pdo->exec("DROP TABLE tmp_sl;");
        
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
        
        echo "<b style='color:green'>✔ Đã dọn sạch toàn bộ Rác và Dữ liệu mồ côi!</b><br>";
        
        // Cập nhật lại đếm số lượng list (Reconcile)
        echo "Đang tính toán lại sĩ số của các Danh sách...<br>";
        $lists = $pdo->query("SELECT id FROM lists")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($lists as $list) {
            $actualCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ?");
            $actualCount->execute([$list['id']]);
            $count = (int)$actualCount->fetchColumn();
            
            $pdo->prepare("UPDATE lists SET subscriber_count = ? WHERE id = ?")->execute([$count, $list['id']]);
        }
        
        echo "<b style='color:green'>✔ Tính toán sĩ số hoàn tất! Hệ thống đã hoàn hảo 100%.</b>";
        
    } else {
        if ($totalTrash > 0) {
            echo "<br><a href='?run_token=DOMATION2026&confirm=yes' style='padding:10px 20px; background:red; color:white; text-decoration:none; font-weight:bold; border-radius:5px;'>CHẤP NHẬN XÓA TOÀN BỘ RÁC NÀY</a>";
        } else {
            echo "<br><b style='color:green'>Hệ thống đã sạch bóng dữ liệu rác! Không cần phải chạy dọn dẹp.</b>";
        }
    }

} catch (Exception $e) {
    echo "<b>LỖI:</b> " . $e->getMessage();
}
