<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
header('Content-Type: application/json');

$propertyId = $_GET['property_id'] ?? null;
$apiKey = null;

if ($propertyId) {
    $stmt = $pdo->prepare("SELECT gemini_api_key FROM ai_chatbot_settings WHERE property_id = ? LIMIT 1");
    $stmt->execute([$propertyId]);
    $apiKey = $stmt->fetchColumn();
}

if (empty($apiKey)) {
    $apiKey = getenv('GEMINI_API_KEY');
}

$url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . $apiKey;
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo json_encode([
    'http_code' => $httpCode,
    'response' => json_decode($response, true)
], JSON_PRETTY_PRINT);
