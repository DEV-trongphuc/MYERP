<?php
// api/trigger_flow_now.php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');

try {
    // Gọi worker_flow.php qua URL để nó chạy ngầm
    $url = API_BASE_URL . '/worker_flow.php';

    $parts = parse_url($url);
    $host = $parts['host'];
    $fp = @fsockopen($parts['scheme'] === 'https' ? "ssl://$host" : $host, $parts['port'] ?? ($parts['scheme'] === 'https' ? 443 : 80), $errno, $errstr, 1);

    if ($fp) {
        $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
        $out = "GET {$parts['path']} HTTP/1.1\r\n";
        $out .= "Host: $host\r\n";
        $out .= "X-Cron-Secret: $cronSecret\r\n";
        $out .= "Connection: Close\r\n\r\n";
        fwrite($fp, $out);
        fclose($fp);
        echo "[ACTION] Flow Worker triggered successfully.\n";
    } else {
        echo "[ERROR] Could not connect to host: $errstr ($errno)\n";
    }

    echo "\nWait a few seconds, then F5 your Flow Journey to see the movement!";

} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
}
