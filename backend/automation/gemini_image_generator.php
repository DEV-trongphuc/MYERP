<?php
// api/gemini_image_generator.php
// Gemini Nano Banana Image Generation Handler

/**
 * Generate image using Gemini Native Image Generation API
 * @param string $prompt - English prompt for image generation
 * @param string $apiKey - Gemini API key
 * @param string $model - gemini-3.5-flash-lite-image or gemini-3-pro-image-preview
 * @param array $config - Image configuration (aspectRatio, imageSize)
 * @return array - ['success' => bool, 'image_data' => base64, 'mime_type' => string, 'error' => string]
 */
function generateGeminiImage($prompt, $apiKey, $model = 'gemini-3.5-flash-lite-image', $config = [], $referenceImages = [])
{
    // Use the exact model names from the Gemini Nano Banana documentation provided by user
    $realModel = $model;

    // Normalize if needed
    if (strpos($model, 'gemini-3-pro') !== false) {
        $realModel = 'gemini-3-pro-image-preview';
    } elseif (strpos($model, 'gemini-3.5-flash-lite') !== false || strpos($model, 'gemini-2.5-flash-lite') !== false) {
        $realModel = 'gemini-3.5-flash-lite-image';
    }

    if (empty($apiKey)) {
        return ['success' => false, 'error' => 'Missing API Key'];
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$realModel}:generateContent?key=" . $apiKey;

    // Build parts for the request
    $parts = [['text' => $prompt]];

    // Add reference images (Gemini supports up to 14 for Pro, 3 for Flash as per documentation)
    if (!empty($referenceImages)) {
        $maxImages = ($realModel === 'gemini-3-pro-image-preview') ? 14 : 3;
        $count = 0;
        foreach ($referenceImages as $img) {
            if ($count >= $maxImages)
                break;

            // Expected format: ['mimeType' => '...', 'data' => '<base64>']
            if (isset($img['inlineData'])) {
                $parts[] = ['inlineData' => $img['inlineData']];
            } elseif (isset($img['base64'])) {
                // Handle raw base64 from our internal format
                $base64Clean = preg_replace('#^data:[^;]+;base64,#i', '', $img['base64']);
                $parts[] = [
                    'inlineData' => [
                        'mimeType' => $img['type'] ?? 'image/jpeg',
                        'data' => $base64Clean
                    ]
                ];
            }
            $count++;
        }
    }

    // Build generation config
    $generationConfig = [
        'responseModalities' => ['TEXT', 'IMAGE'] // Enabled both for thinking and precise output
    ];

    // Add tools (Google Search for grounding) - Only for Pro
    $tools = [];
    if ($realModel === 'gemini-3-pro-image-preview') {
        $tools[] = ['google_search' => (object) []];
    }

    // Add image config if provided
    if (!empty($config)) {
        $imageConfig = [];

        if (isset($config['aspectRatio'])) {
            $imageConfig['aspectRatio'] = $config['aspectRatio'];
        }

        if (isset($config['imageSize']) && $realModel === 'gemini-3-pro-image-preview') {
            // Document strict rule: Must use uppercase 'K'
            $imageConfig['imageSize'] = strtoupper($config['imageSize']);
        }

        if (!empty($imageConfig)) {
            $generationConfig['imageConfig'] = $imageConfig;
        }
    }

    $payload = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => $parts
            ]
        ],
        'generationConfig' => $generationConfig
    ];

    if (!empty($tools)) {
        $payload['tools'] = $tools;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept-Encoding: gzip'
    ]);
    curl_setopt($ch, CURLOPT_ENCODING, 'gzip');
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [SECURITY] Enforce TLS

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        $result = json_decode($response, true);
        $errMsg = $result['error']['message'] ?? $curlError ?? "HTTP Error $httpCode";

        // AUTO-RETRY: If Pro fails with internal error, fallback to Flash immediately
        if ($realModel === 'gemini-3-pro-image-preview' && (strpos($errMsg, 'Internal error') !== false || $httpCode == 500)) {
            error_log("Nano Banana Pro failed, falling back to Flash: " . $errMsg);
            return generateGeminiImage($prompt, $apiKey, 'gemini-3.5-flash-lite-image', $config, $referenceImages);
        }

        return ['success' => false, 'error' => $errMsg];
    }

    $result = json_decode($response, true);

    // Extract image data and potential text/thoughts
    $imageData = null;
    $mimeType = 'image/png';
    $thought = "";

    if (isset($result['candidates'][0]['content']['parts'])) {
        foreach ($result['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['inlineData'])) {
                $imageData = $part['inlineData']['data'];
                $mimeType = $part['inlineData']['mimeType'] ?? 'image/png';
            }
            if (isset($part['text'])) {
                // If it's a thought part (Pro model)
                if (isset($part['thought']) && $part['thought']) {
                    $thought .= $part['text'];
                }
            }
        }
    }

    if ($imageData) {
        return [
            'success' => true,
            'image_data' => $imageData,
            'mime_type' => $mimeType,
            'thought' => $thought
        ];
    }

    return ['success' => false, 'error' => 'No image data in response'];
}

/**
 * Save base64 image data to a file on the server
 * @param string $base64Data - Base64 encoded image data
 * @param string $mimeType - Image MIME type
 * @param string $propertyId - User/Bot property ID for association
 * @param string $conversationId - Optional conversation ID
 * @return string|false - Public URL of the saved image or false on failure
 */
function saveAIImage($base64Data, $mimeType, $propertyId = null, $conversationId = null, $adminId = null)
{
    $uploadDir = __DIR__ . '/../uploadss/ai_generated/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    // Determine extension
    $ext = 'png';
    if ($mimeType === 'image/jpeg' || $mimeType === 'image/jpg')
        $ext = 'jpg';
    elseif ($mimeType === 'image/webp')
        $ext = 'webp';

    $fileName = 'ai_gen_' . uniqid() . '.' . $ext;
    $filePath = $uploadDir . $fileName;

    $decodedData = base64_decode($base64Data);
    if ($decodedData === false)
        return false;

    if (file_put_contents($filePath, $decodedData)) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'] ?? 'automation.ideas.edu.vn';
        $publicUrl = "$scheme://$host/uploadss/ai_generated/" . $fileName;
        $size = strlen($decodedData);

        // Sync to global_assets
        global $pdo;
        if (isset($pdo)) {
            $assetId = 'ga_' . bin2hex(random_bytes(12));
            $stmt = $pdo->prepare("INSERT IGNORE INTO global_assets (id, name, unique_name, url, type, extension, size, source, property_id, conversation_id, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'chat_assistant', ?, ?, ?)");
            $stmt->execute([
                $assetId,
                $fileName,
                $fileName,
                $publicUrl,
                $mimeType,
                $ext,
                $size,
                $propertyId,
                $conversationId,
                $adminId
            ]);
        }

        return $publicUrl;
    }

    return false;
}

/**
 * Parse [IMAGE_REQUEST: prompt] from AI response and generate image
 * @param string $text - AI response text
 * @param string $apiKey - Gemini API key
 * @param string $model - Image generation model
 * @param array $config - Image configuration
 * @param array $referenceImages - Attached images from user to use as context
 * @param string $propertyId - User context identifier
 * @param string $conversationId - Conversation context identifier
 * @param string $adminId - Owner identifier
 * @return string - Modified text with image URL embedded
 */
function processImageRequests($text, $apiKey, $model, $config = [], $referenceImages = [], $propertyId = null, $conversationId = null, $adminId = null)
{
    // Pattern to match [IMAGE_REQUEST: prompt] - Added /s to match newlines
    $pattern = '/\[IMAGE_REQUEST:\s*([^\]]+)\]/s';

    preg_match_all($pattern, $text, $matches, PREG_SET_ORDER);

    foreach ($matches as $match) {
        $fullMatch = $match[0];
        $prompt = trim($match[1]);

        // Generate image with context images
        $result = generateGeminiImage($prompt, $apiKey, $model, $config, $referenceImages);

        if ($result['success']) {
            // Save to file on server instead of embedding base64
            $publicUrl = saveAIImage($result['image_data'], $result['mime_type'], $propertyId, $conversationId, $adminId);

            $replacement = "";
            // Include thoughts if available (Gemini 3 Pro)
            if (!empty($result['thought'])) {
                $replacement .= "\n\n> **Gemini Thinking:** " . trim($result['thought']) . "\n\n";
            }

            if ($publicUrl) {
                // Replace with markdown image using the public URL and a separate link for access/CORS workaround
                $replacement .= "![Generated Image]($publicUrl)";
            } else {
                // Fallback to base64 if saving fails (e.g. permission issues on localhost)
                $dataUrl = "data:{$result['mime_type']};base64,{$result['image_data']}";
                $replacement .= "![Generated Image]($dataUrl)";
            }
            $text = str_replace($fullMatch, $replacement, $text);
        } else {
            // Replace with error message
            $replacement = "\n\n*[Image generation failed: {$result['error']}]*\n\n";
            $text = str_replace($fullMatch, $replacement, $text);
        }
    }

    return $text;
}
