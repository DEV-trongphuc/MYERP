<?php
// api/test_ai_flow.php
require_once 'db_connect.php';
require_once 'zalo_helpers.php';
require_once 'zalo_inbound_processor.php';

header('Content-Type: text/html; charset=utf-8');
echo "<h2>🧪 CHƯƠNG TRÌNH KIỂM THỬ LUỒNG AI CHI TIẾT</h2>";

$zaloUserId = '7052207665078724814';
$oaIdFromLog = '3857867121882640296';
$testMsg = 'aloo';

echo "<b>Thông tin thử nghiệm:</b><br>";
echo "- User ID: $zaloUserId<br>";
echo "- Tin nhắn: $testMsg<br><br>";

// 1. Tìm OA Config
echo "<b>[BƯỚC 1] Tìm cấu hình OA...</b><br>";
$stmtOa = $pdo->prepare("SELECT id, name, access_token, workspace_id FROM zalo_oa_configs WHERE oa_id = ?");
$stmtOa->execute([$oaIdFromLog]);
$oa = $stmtOa->fetch(PDO::FETCH_ASSOC);
if (!$oa) {
    echo "❌ LỖI: Không tìm thấy OA ID $oaIdFromLog trong Database.<br>";
    exit;
}
echo "✅ OK: Tìm thấy OA: " . $oa['name'] . "<br><br>";

// 2. Tìm thông tin Subscriber
echo "<b>[BƯỚC 2] Tìm thông tin khách hàng...</b><br>";
$stmtSub = $pdo->prepare("SELECT id, ai_paused_until FROM zalo_subscribers WHERE zalo_user_id = ? AND oa_id = ?");
$stmtSub->execute([$zaloUserId, $oaIdFromLog]);
$sub = $stmtSub->fetch(PDO::FETCH_ASSOC);
if (!$sub) {
    echo "⚠️ CẢNH BÁO: Khách hàng chưa có trong hệ thống (Sẽ được tạo mới khi có tin nhắn thực).<br>";
} else {
    echo "✅ OK: Tìm thấy khách hàng (ID: " . $sub['id'] . ")<br>";
}
echo "<br>";

// 3. Tìm kịch bản
echo "<b>[BƯỚC 3] Tìm kịch bản AI phù hợp...</b><br>";
$scenario = findZaloScenario($pdo, $oa, $zaloUserId, $sub['id'] ?? null, 'user_send_text', $testMsg);
if (!$scenario) {
    echo "❌ LỖI: Không tìm thấy kịch bản AI phù hợp cho tin nhắn này.<br>";
    echo "--- Kiểm tra kịch bản đang có trong DB cho OA ID: " . $oa['id'] . " ---<br>";
    $stmtCheck = $pdo->prepare("SELECT id, title, type, trigger_text, status, schedule_type, start_time, end_time FROM zalo_automation_scenarios WHERE oa_config_id = ?");
    $stmtCheck->execute([$oa['id']]);
    $allScenarios = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);
    echo "<pre>";
    print_r($allScenarios);
    echo "</pre>";
} else {
    echo "✅ OK: Đã khớp kịch bản: <b>" . $scenario['title'] . "</b> (Type: " . $scenario['type'] . ")<br>";
}
echo "<br>";

// 4. Kiểm tra khóa AI
echo "<b>[BƯỚC 4] Kiểm tra trạng thái Khóa AI (Cooldown)...</b><br>";
$isPaused = isAiPaused($pdo, $sub['id'] ?? null, $zaloUserId);
if ($isPaused) {
    echo "❌ LỖI: AI đang bị KHÓA cho khách hàng này. (Lý do: Nhân viên vừa trả lời hoặc vừa chạy lệnh Clear không thành công).<br>";
    echo "Paused Until: " . ($sub['ai_paused_until'] ?? 'N/A') . "<br>";
} else {
    echo "✅ OK: AI không bị khóa. Sẵn sàng trả lời.<br>";
}
echo "<br>";

// 5. Gọi AI Chatbot (Trái tim của hệ thống)
echo "<b>[BƯỚC 5] Thử nghiệm gọi bộ não AI (ai_chatbot.php)...</b><br>";
if ($scenario && !$isPaused) {
    $postData = [
        'message' => $testMsg,
        'property_id' => $scenario['ai_chatbot_id'],
        'visitor_id' => "zalo_" . $zaloUserId,
        'is_test' => true
    ];
    
    // Gọi Public URL nhưng bỏ qua SSL để tránh Loopback
    $url = "https://automation.ideas.edu.vn/mail_api/ai_chatbot.php";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    
    $resRaw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    
    echo "HTTP Status: $httpCode<br>";
    if ($httpCode === 200) {
        $res = json_decode($resRaw, true);
        if ($res && isset($res['success']) && $res['success']) {
            $reply = $res['reply'] ?? $res['message'] ?? $res['data']['message'] ?? 'Trống';
            echo "✅ AI PHẢN HỒI: <i style='color:blue'>\"" . $reply . "\"</i><br>";
        } else {
            echo "❌ LỖI AI: " . ($res['message'] ?? 'Phản hồi không hợp lệ') . " | Raw: $resRaw<br>";
        }
    } else {
        echo "❌ LỖI KẾT NỐI: $curlErr (Mã lỗi: $httpCode)<br>";
        echo "Hãy kiểm tra xem server có chặn Loopback cURL không.<br>";
    }
} else {
    echo "⏭️ BỎ QUA: Không gọi AI vì các bước trước thất bại.<br>";
}

echo "<h3>HƯỚNG GIẢI QUYẾT:</h3>";
echo "1. Nếu Bước 3 báo lỗi -> Kiểm tra lại phần Zalo Automation trên dashboard.<br>";
echo "2. Nếu Bước 4 báo lỗi -> Chạy lại file clear_ai_pause.php.<br>";
echo "3. Nếu Bước 5 báo lỗi -> Liên hệ tôi để kiểm tra khóa API Gemini hoặc lỗi Loopback server.<br>";
?>
