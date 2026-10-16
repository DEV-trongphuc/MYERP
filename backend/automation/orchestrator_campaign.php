<?php
// api/orchestrator_campaign.php
// FILE ĐIỀU PHỐI (ORCHESTRATOR) - GỬI LUỒNG WORKER CAMPAIGN
// Mục đích: Ép xung tốc độ gửi Campaign lên hàng chục mail/giây bằng multi-curl

ini_set('display_errors', 0);

// [SECURITY] Chỉ cho phép gửi từ localhost/same-server (cron) hoặc có admin token hợp lệ.
// Prevents unauthorized parties from spawning 10 campaign workers on demand (SMTP abuse).
$callerIp = $_SERVER['REMOTE_ADDR'] ?? '';
$serverIp = $_SERVER['SERVER_ADDR'] ?? '';
// [FIX] Check both 127.0.0.1 AND SERVER_ADDR.
// On some cPanel setups, cron curl calls route via the server's public IP (not loopback),
// causing REMOTE_ADDR to equal SERVER_ADDR instead of 127.0.0.1.
$isLocalhost = in_array($callerIp, ['127.0.0.1', '::1', 'localhost'])
    || ($serverIp && $callerIp === $serverIp);
$adminToken = null ?? '';
if (!defined('ADMIN_BYPASS_TOKEN')) require_once __DIR__ . '/db_connect.php';
$isAuthorized = $isLocalhost || ($adminToken === ADMIN_BYPASS_TOKEN);
if (!$isAuthorized) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'forbidden', 'message' => 'Orchestrator requires localhost or admin token.']);
    exit;
}

// [RATE STRATEGY] SES limit = 14/s account-wide (shared across ALL workers).
// 2 workers × 5 emails/s each (enforced by per-worker rate limiter in worker_campaign.php)
// = 10/s total — safely under 14/s, zero throttle errors.
// Previously 10 workers competed for 14/s ? throttling ? 454 errors ? retry delays ? ~8-10/s actual.
$NUM_WORKERS = 2;

// URL gốc trỏ tới worker campaign
// Tự động nhận diện http hay https và domain đang chạy
$domain = $_SERVER['HTTP_HOST'] ?? 'automation.ideas.edu.vn';
$path = $_SERVER['REQUEST_URI'] ?? '/mail_api/orchestrator_campaign.php';

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['SERVER_PORT'] ?? 80) == 443) ? "https://" : "http://";
$workerUrl = $protocol . $domain . str_replace("orchestrator_campaign.php", "worker_campaign.php", $path);
// Loại bỏ query string nếu có
$workerUrl = explode('?', $workerUrl)[0];

$multiHandle = curl_multi_init();
$curlHandles = [];

// Khởi tạo các luồng gửi HTTP độc lập
for ($i = 0; $i < $NUM_WORKERS; $i++) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $workerUrl . "?thread=" . $i);
    // Timeout cực ngắn (1 giây) để kích hoạt script ngầm rồi ngắt kết nối ngay (Fire-and-Forget)
    // Không bắt PHP phải chờ vòng lặp worker 60 giây hoàn tất
    curl_setopt($ch, CURLOPT_TIMEOUT, 1);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    // Bỏ qua SSL peer cert check để tránh lỗi ở môi trường dev/local
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    // [FIX P10-M2] CURLOPT_SSL_VERIFYHOST must be 2 (verify CN + hostname), not false/0 (disabled).
    // false silently disables hostname verification entirely — bad practice even for internal calls.
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    
    curl_multi_add_handle($multiHandle, $ch);
    $curlHandles[] = $ch;
}

// Bắn đồng loạt (Async) -> Fire-and-forget với 0.1s yield để tránh CPU spin loop
// Mỗi handle có CURLOPT_TIMEOUT=1s nên vòng lặp kết thúc sau ~1s tối đa
$running = null;
do {
    $status = curl_multi_exec($multiHandle, $running);
    if ($running) {
        curl_multi_select($multiHandle, 0.1); // Yield CPU, không spin tiêu thụ 100% core
    }
} while ($running > 0 && $status == CURLM_OK);

// Dọn dẹp cURL
foreach ($curlHandles as $ch) {
    curl_multi_remove_handle($multiHandle, $ch);
    curl_close($ch);
}
curl_multi_close($multiHandle);

// Phản hồi cho Web-Cron biết
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'status' => 'success',
    'message' => 'Đã kích hoạt ' . $NUM_WORKERS . ' luồng Worker Campaign chạy ngầm.',
    'target_url' => $workerUrl
]);
exit;
?>
