<?php
// api/worker_web_geo.php
// Geolocates web visitors using IP address
// Rate Limit: 45 req/min (ip-api.com)

set_time_limit(300);
require_once 'db_connect.php';
require_once __DIR__ . '/worker_guard.php';

echo "Starting Geo Worker...\n";

$lockStmt = $pdo->query("SELECT GET_LOCK('worker_web_geo_lock', 0)");
if ($lockStmt->fetchColumn() !== 1) {
    die("Skipped. Already running.\n");
}

// 1. Select visitors with IP but no Country (Limit 40 to stay within 1 min limit roughly)
$stmt = $pdo->prepare("SELECT id, ip_address FROM web_visitors WHERE ip_address IS NOT NULL AND ip_address != '' AND country IS NULL LIMIT 40");
$stmt->execute();
$visitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($visitors)) {
    echo "No visitors to process.\n";
    $pdo->query("DO RELEASE_LOCK('worker_web_geo_lock')");
    exit;
}

echo "Found " . count($visitors) . " visitors to process.\n";

$updated = 0;
foreach ($visitors as $v) {
    if ($v['ip_address'] === '::1' || $v['ip_address'] === '127.0.0.1') {
        // Localhost
        $pdo->prepare("UPDATE web_visitors SET country = 'Local', city = 'Host' WHERE id = ?")->execute([$v['id']]);
        continue;
    }

    $url = "http://ip-api.com/json/" . $v['ip_address'];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if ($data && $data['status'] === 'success') {
            $country = $data['country'] ?? 'Unknown';
            $city = $data['city'] ?? 'Unknown';

            $pdo->prepare("UPDATE web_visitors SET country = ?, city = ? WHERE id = ?")->execute([$country, $city, $v['id']]);
            echo "Updated {$v['id']} ({$v['ip_address']}) -> $city, $country\n";
            $updated++;
        } else {
            // Failed or private IP
            echo "Failed lookup for {$v['ip_address']}: " . ($data['message'] ?? 'Unknown error') . "\n";
            // Mark as processed/unknown so we don't retry forever? 
            // For now set as 'Unknown'
            $pdo->prepare("UPDATE web_visitors SET country = 'Unknown', city = 'Unknown' WHERE id = ?")->execute([$v['id']]);
        }
    }

    // Rate limit sleep
    usleep(1500000); // 1.5 seconds
}

$pdo->query("DO RELEASE_LOCK('worker_web_geo_lock')");
echo "Done. Updated $updated visitors.\n";
?>
