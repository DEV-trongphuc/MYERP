<?php
// api/clear_ai_pause.php
require_once 'db_connect.php';

echo "<h2>🚀 ĐANG GIẢI PHÓNG AI...</h2>";

try {
    $stmt = $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = NULL");
    $stmt->execute();
    echo "<p style='color:green'>✅ Đã xóa tất cả lệnh tạm dừng AI cho toàn bộ khách hàng.</p>";
    
    $stmt2 = $pdo->prepare("UPDATE domation_ai_conversations SET status = 'ai' WHERE status = 'human'");
    $stmt2->execute();
    echo "<p style='color:green'>✅ Đã chuyển tất cả cuộc hội thoại từ chế độ Nhân viên sang AI.</p>";
    
    echo "<h3>Bây giờ bạn hãy thử nhắn tin lại cho OA. AI sẽ phản hồi ngay lập tức!</h3>";
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Lỗi: " . $e->getMessage() . "</p>";
}
?>
