<?php
// api/zalo_trace.php - SIÊU CHẨN ĐOÁN WEBHOOK ZALO
require_once 'db_connect.php';
header('Content-Type: text/html; charset=utf-8');

echo "<style>
    body { font-family: sans-serif; line-height: 1.6; background: #f4f7f6; color: #333; padding: 20px; }
    .card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); mb: 20px; margin-bottom: 20px; }
    .status-ok { color: green; font-weight: bold; }
    .status-err { color: red; font-weight: bold; }
    pre { background: #2d2d2d; color: #ccc; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 13px; }
    .highlight { background: #fff3cd; padding: 2px 5px; border-radius: 3px; border: 1px solid #ffeeba; }
    h2, h3 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
</style>";

echo "<h2>🚀 HỆ THỐNG GIÁM SÁT WEBHOOK ZALO (REAL-TIME)</h2>";

// 1. KIỂM TRA BẢN VÁ LOGIC (Surgical Audit)
echo "<div class='card'><h3>🛠️ KIỂM TRA TRẠNG THÁI BẢN VÁ (PATCH STATUS)</h3>";
$webhookContent = file_get_contents('webhook.php');
$helperContent = file_get_contents('zalo_helpers.php');

$hasAIRoute = strpos($webhookContent, 'sendZaloAIReply') !== false;
$hasSSLFix = strpos($helperContent, 'CURLOPT_SSL_VERIFYPEER, false') !== false;
$hasReplyKey = strpos($helperContent, "res['reply']") !== false;

echo "<ul>";
echo "<li>Lộ trình gọi AI (webhook.php): " . ($hasAIRoute ? "<span class='status-ok'>✅ ĐÃ SỬA</span>" : "<span class='status-err'>❌ CHƯA SỬA (Vẫn gọi hàm cũ)</span>") . "</li>";
echo "<li>Bỏ qua SSL Loopback (zalo_helpers.php): " . ($hasSSLFix ? "<span class='status-ok'>✅ ĐÃ SỬA</span>" : "<span class='status-err'>❌ CHƯA SỬA (Dễ bị 404/Connection Refused)</span>") . "</li>";
echo "<li>Khóa dữ liệu 'reply' (zalo_helpers.php): " . ($hasReplyKey ? "<span class='status-ok'>✅ ĐÃ SỬA</span>" : "<span class='status-err'>❌ CHƯA SỬA (Dễ bị im lặng do sai key)</span>") . "</li>";
echo "</ul>";
echo "</div>";

// 2. NHẬT KÝ WEBHOOK MỚI NHẤT
echo "<div class='card'><h3>📜 NHẬT KÝ HOẠT ĐỘNG (50 DÒNG GẦN NHẤT)</h3>";
$logFile = 'zalo_debug.log';
if (file_exists($logFile)) {
    $lines = file($logFile);
    $lastLines = array_slice($lines, -50);
    echo "<pre>";
    foreach ($lastLines as $line) {
        $line = htmlspecialchars($line);
        // Highlight quan trọng
        $line = str_replace('[TRACE]', '<b style="color:#007bff">[TRACE]</b>', $line);
        $line = str_replace('❌', '<span style="color:#ff4d4d">❌</span>', $line);
        $line = str_replace('✅', '<span style="color:#28a745">✅</span>', $line);
        echo $line;
    }
    echo "</pre>";
} else {
    echo "<p class='status-err'>Chưa tìm thấy file zalo_debug.log.</p>";
}

echo "<h3>🛡️ NHẬT KÝ BẢO MẬT (WEBHOOK ERRORS)</h3>";
$secLogFile = 'webhook_debug.log';
if (file_exists($secLogFile)) {
    $secLines = file($secLogFile);
    $lastSecLines = array_slice($secLines, -20);
    echo "<pre style='background: #3a0000; color: #ff9999;'>";
    foreach ($lastSecLines as $sline) {
        echo htmlspecialchars($sline);
    }
    echo "</pre>";
} else {
    echo "<p>Không có lỗi bảo mật nào được ghi nhận.</p>";
}
echo "</div>";

// 3. KIỂM TRA KỊCH BẢN AI
echo "<div class='card'><h3>🤖 KIỂM TRA CẤU HÌNH KỊCH BẢN AI</h3>";
$stmt = $pdo->query("
    SELECT c.name, s.title, s.trigger_text, s.status, s.type, s.ai_chatbot_id 
    FROM zalo_automation_scenarios s
    JOIN zalo_oa_configs c ON s.oa_config_id = c.id
    WHERE s.type = 'ai_reply'
");
$aiScenarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($aiScenarios)) {
    echo "<p class='status-err'>CẢNH BÁO: Không có bất kỳ kịch bản AI nào được thiết lập!</p>";
} else {
    echo "<table border='1' cellpadding='10' style='width:100%; border-collapse: collapse;'>
            <tr style='background:#eee'><td>OA</td><td>Kịch bản</td><td>Trigger</td><td>Trạng thái</td><td>Chatbot ID</td></tr>";
    foreach ($aiScenarios as $s) {
        echo "<tr>
                <td>{$s['name']}</td>
                <td>{$s['title']}</td>
                <td><span class='highlight'>" . ($s['trigger_text'] ?: '*') . "</span></td>
                <td>" . ($s['status'] === 'active' ? "<span class='status-ok'>Active</span>" : "<span class='status-err'>Inactive</span>") . "</td>
                <td>{$s['ai_chatbot_id']}</td>
              </tr>";
    }
    echo "</table>";
}
echo "</div>";

echo "<div class='card' style='background: #e3f2fd;'>
        <b>💡 Hướng dẫn:</b> Nếu bạn vừa nhắn tin mà không thấy dòng log mới xuất hiện trong bảng trên, chứng tỏ 
        Zalo Webhook chưa gửi được tin nhắn về server của bạn (Hãy kiểm tra lại Webhook URL trên Zalo Dev).
      </div>";
?>
