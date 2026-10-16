<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
// api/gemini_tts.php

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS')
    exit;

// Enable error logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
if (!is_dir(__DIR__ . '/logs'))
    @mkdir(__DIR__ . '/logs', 0777, true);
ini_set('error_log', __DIR__ . '/logs/tts_errors.log');

// Headers
header('Content-Type: audio/ogg');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); // Disable Nginx buffering

// Clear any buffered output from db_connect.php
if (ob_get_level())
    ob_end_clean();

// 1. Get Params
$propertyId = $_POST['property_id'] ?? $_GET['property_id'] ?? '';
$text = $_POST['text'] ?? $_GET['text'] ?? '';

if (!$text || !$propertyId) {
    http_response_code(400);
    exit('Missing parameters');
}

// 2. Settings
$voiceName = "vi-VN-Standard-A"; // Standard is MUCH faster to synthesize than Chirp3-HD
$rate = 1.1;
// [SECURITY FIX] Load Google Cloud API key from mkt_system_settings DB
try {
    $stmtKey = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE `key` = 'google_cloud_api_key' LIMIT 1");
    $stmtKey->execute();
    $cloudApiKey = $stmtKey->fetchColumn() ?: getenv('GEMINI_API_KEY');
} catch (Exception $e) {
    $cloudApiKey = getenv('GEMINI_API_KEY'); // fallback
}

try {
    $url = "https://texttospeech.googleapis.com/v1/text:synthesize?key={$cloudApiKey}";

    $payload = [
        "input" => ["text" => $text],
        "voice" => ["languageCode" => "vi-VN", "name" => $voiceName],
        "audioConfig" => [
            "audioEncoding" => "OGG_OPUS",
            "speakingRate" => $rate,
            "sampleRateHertz" => 24000, // Lower sample rate = faster download/decode
            "volumeGainDb" => 6.0 // Increase volume by 6dB
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Connection: Keep-Alive', // Request persistent connection
    ]);

    // OPTIMIZATION: Enable TCP Keep-Alive
    curl_setopt($ch, CURLOPT_TCP_KEEPALIVE, 1);
    curl_setopt($ch, CURLOPT_TCP_KEEPIDLE, 120);
    curl_setopt($ch, CURLOPT_TCP_KEEPINTVL, 60);

    // EXTREME SPEED: Enable HTTP/2 for Google API
    if (defined('CURL_HTTP_VERSION_2_0')) {
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);
    }

    // Faster connection
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        throw new Exception(curl_error($ch));
    }
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Google API Error: $httpCode | Body: $response");
    }

    $data = json_decode($response, true);
    if (!empty($data['audioContent'])) {
        $audioBinary = base64_decode($data['audioContent']);
        echo $audioBinary;
        flush();
    } else {
        throw new Exception("No audio content found");
    }

} catch (Exception $e) {
    error_log("TTS Error: " . $e->getMessage()); // Keep error logging for server-side issues
    http_response_code(500);
    header('Content-Type: application/json'); // Set content type for JSON error response
    echo json_encode(['error' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
?>
