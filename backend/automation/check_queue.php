<?php
// api/check_queue.php
require_once 'db_connect.php';

echo "<h2>📊 KIỂM TRA TRẠNG THÁI HÀNG ĐỢI (QUEUE)</h2>";

try {
    // Kiểm tra các task Zalo đang đợi
    $stmt = $pdo->prepare("SELECT status, COUNT(*) as total FROM queue_jobs WHERE queue = 'zalo_inbound' GROUP BY status");
    $stmt->execute();
    $rows = $stmt->fetchAll();

    if (empty($rows)) {
        echo "<p style='color:blue'>ℹ️ Hiện không có tin nhắn Zalo nào trong hàng đợi.</p>";
    } else {
        echo "<h4>Trạng thái tin nhắn Zalo:</h4><ul>";
        foreach ($rows as $row) {
            $color = ($row['status'] === 'pending') ? 'orange' : (($row['status'] === 'processing') ? 'blue' : 'red');
            echo "<li><b style='color:$color'>" . strtoupper($row['status']) . "</b>: " . $row['total'] . " tin nhắn</li>";
        }
        echo "</ul>";
    }

    // Kiểm tra lỗi gần nhất của Worker
    echo "<h4>Nhật ký lỗi Worker (Gần nhất):</h4>";
    $stmt2 = $pdo->query("SELECT id, payload, status, available_at FROM queue_jobs WHERE status = 'failed' OR (status = 'pending' AND attempts > 0) ORDER BY available_at DESC LIMIT 5");
    $failed = $stmt2->fetchAll();
    
    if (empty($failed)) {
        echo "<p style='color:green'>✅ Không thấy lỗi nghiêm trọng trong hàng đợi.</p>";
    } else {
        echo "<pre>";
        print_r($failed);
        echo "</pre>";
    }

    echo "<h3>Hành động tiếp theo:</h3>";
    echo "Nếu thấy nhiều tin nhắn ở trạng thái <b>PENDING</b>, hãy thử chạy Worker thủ công tại đây: <br>";
    echo "<a href='https://automation.ideas.edu.vn/mail_api/worker_queue.php' target='_blank'>Kích hoạt Worker thủ công</a>";

} catch (Exception $e) {
    echo "<p style='color:red'>❌ Lỗi: " . $e->getMessage() . "</p>";
}
?>
