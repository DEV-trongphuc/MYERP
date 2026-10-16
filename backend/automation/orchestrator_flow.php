<?php
// api/orchestrator_flow.php
// FILE ĐIỀU PHỐI (ORCHESTRATOR) - GỌI LUỒNG WORKER FLOW 
// Mục đích: Ép xung tốc độ xử lý hàng chờ Flow (Auto-responder) lên 10x tốc độ gốc bằng multi-curl

ini_set('display_errors', 0);

// [SECURITY] Chỉ cho phép gọi từ localhost/same-server (cron) hoặc có admin token hợp lệ.
// Prevents unauthorized parties from spawning 10 flow workers on demand.
$callerIp = $_SERVER['REMOTE_ADDR'] ?? '';
$serverIp = $_SERVER['SERVER_ADDR'] ?? '';
// [FIX] Check both 127.0.0.1 AND SERVER_ADDR.
// On some cPanel setups, cron curl calls route via the server's public IP (not loopback).
$isLocalhost = in_array($callerIp, ['127.0.0.1', '::1', 'localhost'])
    || ($serverIp && $callerIp === $serverIp);
$adminToken = null ?? '';
$validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
$isAuthorized = $isLocalhost || ($validBypassToken && $adminToken === $validBypassToken);
if (!$isAuthorized) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'forbidden', 'message' => 'Orchestrator requires localhost or admin token.']);
    exit;
}

$NUM_WORKERS = 10; 

// URL gốc trỏ tới worker flow 
$domain = $_SERVER['HTTP_HOST'] ?? 'automation.ideas.edu.vn';
$path = $_SERVER['REQUEST_URI'] ?? '/mail_api/orchestrator_flow.php';

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['SERVER_PORT'] ?? 80) == 443) ? "https://" : "http://";
$workerUrl = $protocol . $domain . str_replace("orchestrator_flow.php", "worker_flow.php", $path);
// Loại bỏ query string nếu có
$workerUrl = explode('?', $workerUrl)[0];

$multiHandle = curl_multi_init();
$curlHandles = [];

// Khởi tạo các luồng gọi HTTP độc lập
for ($i = 0; $i < $NUM_WORKERS; $i++) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $workerUrl . "?thread=" . $i);
    // Timeout cực ngắn (1 giây) để kích hoạt script ngầm rồi ngắt kết nối ngay (Fire-and-Forget)
    curl_setopt($ch, CURLOPT_TIMEOUT, 1);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    // [FIX] SSL: VERIFYPEER=true validates server cert, VERIFYHOST=2 validates hostname CN/SAN
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    
    curl_multi_add_handle($multiHandle, $ch);
    $curlHandles[] = $ch;
}

// Bắn đồng loạt (Async) — Fire-and-forget với 0.1s yield để tránh CPU spin loop
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
    'message' => 'Đã kích hoạt ' . $NUM_WORKERS . ' luồng Worker Flow chạy ngầm.',
    'target_url' => $workerUrl
]);
exit;
?>
