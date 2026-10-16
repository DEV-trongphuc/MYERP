<?php
// api/debug_signature_all.php - TÌM THUẬT TOÁN CHỮ KÝ ĐÚNG
require_once 'db_connect.php';
require_once 'zalo_helpers.php';

header('Content-Type: text/html; charset=utf-8');
echo "<h2>🧪 PHÂN TÍCH THUẬT TOÁN CHỮ KÝ ZALO</h2>";

// 1. Lấy tin nhắn POST cuối cùng từ log
$logFile = 'zalo_debug.log';
$lines = file_exists($logFile) ? file($logFile) : [];
$lastPayload = '';
$lastSig = '';
$lastTs = '';

foreach (array_reverse($lines) as $line) {
    if (strpos($line, 'POST | Payload:') !== false) {
        $parts = explode('POST | Payload: ', $line);
        $lastPayload = trim($parts[1] ?? '');
        break;
    }
}

// Lấy signature cuối từ Sec Log
$secLines = file_exists('webhook_debug.log') ? file('webhook_debug.log') : [];
foreach (array_reverse($secLines) as $line) {
    if (strpos($line, "Signature: 'mac=") !== false) {
        preg_match("/Signature: 'mac=(.*?)'/", $line, $matches);
        $lastSig = $matches[1] ?? '';
        preg_match("/Timestamp: '(.*?)'/", $line, $tsMatches);
        $lastTs = $tsMatches[1] ?? '';
        break;
    }
}

if (!$lastPayload || !$lastSig) {
    die("❌ Không tìm thấy payload hoặc signature gần đây để phân tích. Hãy nhắn tin lại.");
}

// [FIX] Nếu không có Timestamp từ Header, lấy từ Payload
if (empty($lastTs)) {
    $data = json_decode($lastPayload, true);
    $lastTs = $data['timestamp'] ?? '';
}

echo "<p><b>Payload nhận được:</b> <pre>" . htmlspecialchars($lastPayload) . "</pre></p>";
echo "<p><b>Signature mục tiêu:</b> <code>$lastSig</code></p>";
echo "<p><b>Timestamp:</b> <code>$lastTs</code></p>";

// 2. Thử các tổ hợp
$oaId = '3857867121882640296';
$oa = $pdo->query("SELECT app_id, app_secret FROM zalo_oa_configs WHERE oa_id = '$oaId'")->fetch();
$appId = $oa['app_id'];
$secret = 'R4wXNK1dN6T8BPBThkY5'; // TEST NEW SECRET
echo "<p><b>Thử nghiệm với Secret mới:</b> <code>" . substr($secret, 0, 4) . "********</code></p>";

$tests = [
    'V3 Standard: appId + raw + ts + secret' => hash('sha256', $appId . $lastPayload . $lastTs . $secret),
    'V3 No TS: appId + raw + secret' => hash('sha256', $appId . $lastPayload . $secret),
    'V3 Swapped: raw + appId + ts + secret' => hash('sha256', $lastPayload . $appId . $lastTs . $secret),
    'V2 Fallback: raw + secret' => hash('sha256', $lastPayload . $secret),
    'V2 Alternative: secret + raw' => hash('sha256', $secret . $lastPayload),
    'HMAC SHA256 (raw, secret)' => hash_hmac('sha256', $lastPayload, $secret),
    'HMAC SHA256 (appId+raw+ts, secret)' => hash_hmac('sha256', $appId . $lastPayload . $lastTs, $secret),
    'HMAC SHA256 (raw+secret, secret)' => hash_hmac('sha256', $lastPayload . $secret, $secret),
    'V3 JSON Trimmed: appId + trimmedRaw + ts + secret' => hash('sha256', $appId . trim($lastPayload) . $lastTs . $secret),
];

echo "<h3>📊 KẾT QUẢ THỬ NGHIỆM:</h3><ul>";
foreach ($tests as $name => $calc) {
    $isMatch = hash_equals($calc, $lastSig);
    $color = $isMatch ? 'green' : 'red';
    $status = $isMatch ? '✅ KHỚP!' : '❌ Sai';
    echo "<li style='color:$color'><b>$name:</b> <code>$calc</code> ($status)</li>";
    if ($isMatch) {
        echo "<script>alert('Tìm thấy thuật toán đúng: $name');</script>";
    }
}
echo "</ul>";

if (strpos($lastSig, $tests['V3 Standard: appId + raw + ts + secret']) === false) {
    echo "<div style='background:#fff3cd; padding:15px; border:1px solid #ffeeba'>
            <b>💡 Gợi ý:</b> Nếu tất cả đều sai, có thể App Secret trong DB đang bị cũ. Hãy copy App Secret mới nhất từ trang Zalo Developer dán vào cấu hình OA IDEAS.
          </div>";
}
?>
