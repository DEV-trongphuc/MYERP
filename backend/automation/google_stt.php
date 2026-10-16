<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit;
}

// 1. Params
// [SECURITY FIX] Load Google Cloud API key from mkt_system_settings DB
try {
    $stmtKey = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE `key` = 'google_cloud_api_key' LIMIT 1");
    $stmtKey->execute();
    $apiKey = $stmtKey->fetchColumn() ?: getenv('GEMINI_API_KEY');
} catch (Exception $e) {
    $apiKey = getenv('GEMINI_API_KEY'); // fallback
}
$audioData = file_get_contents('php://input');

if (!$audioData) {
    http_response_code(400);
    echo json_encode(['error' => 'No audio data received']);
    exit;
}

// 2. Google STT V1 Request
// Support for OGG_OPUS or WEBM_OPUS (depends on browser)
$payload = [
    "config" => [
        "encoding" => "WEBM_OPUS", // Most modern browsers output WebM/Opus
        "sampleRateHertz" => 48000,
        "languageCode" => "vi-VN",
        "enableAutomaticPunctuation" => true,
        "model" => "command_and_search" // OPTIMIZED: Faster for short commands
    ],
    "audio" => [
        "content" => base64_encode($audioData)
    ]
];

$url = "https://speech.googleapis.com/v1/speech:recognize?key={$apiKey}";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept-Encoding: gzip' // OPTIMIZED: Enable gzip compression
]);
curl_setopt($ch, CURLOPT_ENCODING, 'gzip'); // OPTIMIZED: Decompress gzip response
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0); // OPTIMIZED: Use HTTP/2
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['error' => curl_error($ch)]);
    exit;
}
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo $response;
    exit;
}

$data = json_decode($response, true);
$transcript = "";
if (!empty($data['results'])) {
    foreach ($data['results'] as $result) {
        $transcript .= $result['alternatives'][0]['transcript'];
    }
}

echo json_encode(['transcript' => $transcript]);
