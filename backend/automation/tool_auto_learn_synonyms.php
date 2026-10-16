<?php
// api/tool_auto_learn_synonyms.php
// AI Tool to analyze training data and generate Domain Synonyms automatically

ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=UTF-8');
require_once 'db_connect.php';
require_once 'auth_middleware.php';

$propertyId = $_GET['property_id'] ?? null;
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
$apiKey = $_GET['api_key'] ?? ''; // Optional: pass key or use from DB if implemented

if (!$propertyId) {
    echo json_encode(['error' => 'Missing property_id']);
    exit;
}

// 1. Fetch Training Data (Sample)
try {
    $stmt = $pdo->prepare("SELECT content FROM domation_ai_training_chunks WHERE property_id = ? ORDER BY RAND() LIMIT ?");
    $stmt->execute([$propertyId, $limit]);
    $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($rows)) {
        echo json_encode(['error' => 'No training data found for this property']);
        exit;
    }

    $allText = implode("\n", $rows);
    // Truncate if too long (max ~30k chars for safety with Gemini Flash)
    if (strlen($allText) > 30000) {
        $allText = substr($allText, 0, 30000) . "...";
    }

} catch (Exception $e) {
    echo json_encode(['error' => 'Lỗi hệ thống, vui lòng thử lại.']);
    exit;
}

// 2. Prepare Prompt
$prompt = "
You are a linguistic expert analyzing a domain-specific knowledge base. 
Analyze the following text content and identify groups of SYNONYMS (words with similar meanings in this specific context).
Focus on:
1. Pricing terms (cost, fee, price...)
2. Action verbs (buy, register, sign up...)
3. Locations (address, where...)
4. Contact methods (phone, email, zale...)
5. Quality/Review terms
6. Domain-specific jargon found in the text.

Return ONLY a valid JSON object where keys are the main keyword and values are arrays of synonyms.
Example format:
{
  \"giá\": [\"chi phí\", \"học phí\", \"bao nhiêu\"],
  \"dang k\": [\"ghi danh\", \"mua\", \"tham gia\"]
}

Text to analyze:
$allText
";

// 3. Call Gemini API
// Use a simple cURL wrapper. Ideally reuse a shared function but for a tool script, standalone is fine.
// We need an API Key. If not passed, we can't run.
// For now, let's try to grab one from settings if possible, or fail.
$geminiKey = $apiKey;
if (empty($geminiKey)) {
    // Try to find one in system settings or hardcoded (not recommended but for demo tool ok)
    // Or ask user to provide it in URL
    echo json_encode(['error' => 'Missing Gemini API Key. Please provide ?api_key=XYZ']);
    exit;
}

$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" . $geminiKey;
$payload = [
    "contents" => [
        ["parts" => [["text" => $prompt]]]
    ],
    "generationConfig" => [
        "response_mime_type" => "application/json"
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo json_encode(['error' => 'Gemini API Error', 'details' => $response]);
    exit;
}

$resData = json_decode($response, true);
$rawJson = $resData['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
$synonyms = json_decode($rawJson, true);

echo json_encode([
    'status' => 'success',
    'source_docs' => count($rows),
    'generated_synonyms' => $synonyms
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
