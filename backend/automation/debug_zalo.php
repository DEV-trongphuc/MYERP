<?php
// api/debug_zalo.php
require_once 'db_connect.php';
require_once 'zalo_helpers.php';
require_once 'zalo_config.php';

header('Content-Type: text/html; charset=utf-8');
echo "<h2>🔍 HỆ THỐNG KIỂM TRA LỖI ZALO AI</h2>";

$targetOaId = '3857867121882640296';

// 1. Kiểm tra Database
try {
    $pdo->query("SELECT 1");
    echo "<p style='color:green'>✅ Kết nối Database: OK</p>";
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Lỗi Database: " . $e->getMessage() . "</p>";
}

// 2. Kiểm tra Cấu hình OA
$stmt = $pdo->prepare("SELECT id, oa_id, name, app_id, app_secret, status FROM zalo_oa_configs WHERE oa_id = ?");
$stmt->execute([$targetOaId]);
$oa = $stmt->fetch();

if (!$oa) {
    echo "<p style='color:red'>❌ KHÔNG tìm thấy OA ID: $targetOaId trong database.</p>";
    echo "Danh sách OA đang có: <pre>";
    print_r($pdo->query("SELECT oa_id, name FROM zalo_oa_configs")->fetchAll());
    echo "</pre>";
} else {
    echo "<p style='color:green'>✅ Tìm thấy OA: <b>" . $oa['name'] . "</b></p>";
    echo "<ul>
            <li>App ID: " . $oa['app_id'] . "</li>
            <li>App Secret: " . (empty($oa['app_secret']) ? 'TRỐNG' : 'Đã điền') . "</li>
            <li>Status: " . $oa['status'] . "</li>
          </ul>";
}

// 3. Kiểm tra Kịch bản AI
if ($oa) {
    $stmtS = $pdo->prepare("SELECT id, title, status, ai_chatbot_id FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' AND status = 'active'");
    $stmtS->execute([$oa['id']]);
    $scenario = $stmtS->fetch();
    
    if ($scenario) {
        echo "<p style='color:green'>✅ Kịch bản AI đang hoạt động: <b>" . $scenario['title'] . "</b> (Chatbot ID: " . $scenario['ai_chatbot_id'] . ")</p>";
    } else {
        echo "<p style='color:red'>❌ LỖI: Không tìm thấy kịch bản AI_REPLY nào đang 'active' cho OA này.</p>";
    }
}

// 4. Kiểm tra quyền ghi Log
$logFile = __DIR__ . '/zalo_debug.log';
if (file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "DEBUG CHECK\n", FILE_APPEND)) {
    echo "<p style='color:green'>✅ Quyền ghi file log: OK (Đã ghi nháp vào zalo_debug.log)</p>";
} else {
    echo "<p style='color:red'>❌ LỖI: Server không có quyền ghi file log tại " . $logFile . "</p>";
}

// 5. Kiểm tra thuật toán Signature (Quan trọng)
$testPayload = '{"event_name":"user_send_text"}';
$testTs = time();
$testSecret = $oa['app_secret'] ?? ZALO_APP_SECRET;
$testAppId = $oa['app_id'] ?? ZALO_APP_ID;
$calculated = hash('sha256', $testAppId . $testPayload . $testTs . $testSecret);

echo "<h4>🧪 Kiểm tra thuật toán Chữ ký (Signature)</h4>";
echo "Cấu trúc hash: AppID + Payload + Timestamp + SecretKey<br>";
echo "Mẫu thử: $calculated <br>";
echo "Nếu Zalo gửi về mã khác, AI sẽ không bao giờ phản hồi.";

echo "<h3>Hành động tiếp theo:</h3>";
echo "1. Nếu báo thiếu kịch bản -> Hãy vào phần Zalo Automation tạo/bật kịch bản AI.<br>";
echo "2. Nếu báo lỗi Log -> Hãy CHMOD 777 cho thư mục api.<br>";
echo "3. Hãy thử nhắn tin lại và theo dõi file zalo_debug.log.";
?>
