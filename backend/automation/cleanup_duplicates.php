<?php
// api/cleanup_duplicates.php
require_once 'db_connect.php';

$listId = '695c1d36e803f';
echo "Bắt đầu dọn dẹp các liên hệ bị trùng lặp...\n";

// B1: Lấy danh sách các số điện thoại bị trùng
$stmt = $pdo->query("
    SELECT phone_number 
    FROM subscribers 
    WHERE id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id = '$listId') 
      AND phone_number IS NOT NULL AND phone_number != ''
    GROUP BY phone_number 
    HAVING count(*) > 1
");
$dupsPhone = $stmt->fetchAll(PDO::FETCH_COLUMN);

$deletedCount = 0;
foreach ($dupsPhone as $phone) {
    // Lấy tất cả ID của số điện thoại này (sắp xếp theo thời gian tạo, giữ lại cái đầu tiên hoặc cuối cùng)
    // Giữ lại 1 ID duy nhất (ví dụ: ID mới nhất)
    $stmtIds = $pdo->prepare("SELECT id FROM subscribers WHERE phone_number = ? ORDER BY joined_at DESC");
    $stmtIds->execute([$phone]);
    $ids = $stmtIds->fetchAll(PDO::FETCH_COLUMN);
    
    if (count($ids) > 1) {
        // Giữ lại phần tử đầu tiên
        $keepId = array_shift($ids);
        
        // Xóa các ID còn lại
        $placeholders = str_repeat('?,', count($ids) - 1) . '?';
        
        // Xóa khỏi list
        $stmtDelList = $pdo->prepare("DELETE FROM subscriber_lists WHERE subscriber_id IN ($placeholders)");
        $stmtDelList->execute($ids);
        
        // Xóa khỏi subscribers
        $stmtDelSub = $pdo->prepare("DELETE FROM subscribers WHERE id IN ($placeholders)");
        $stmtDelSub->execute($ids);
        
        $deletedCount += count($ids);
        echo "Đã gộp số $phone (Xóa " . count($ids) . " bản ghi trùng).\n";
    }
}

// Cập nhật lại tổng số
$stmtCount = $pdo->query("SELECT COUNT(*) FROM subscriber_lists WHERE list_id = '$listId'");
$total = $stmtCount->fetchColumn();
$pdo->query("UPDATE lists SET subscriber_count = $total WHERE id = '$listId'");

echo "Hoàn tất! Đã xóa $deletedCount bản ghi bị trùng. Tổng số liên hệ hiện tại: $total\n";
?>
