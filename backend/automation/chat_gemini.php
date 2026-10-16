<?php
// api/chat_gemini.php
require_once 'chat_helpers.php';

function generateResponse($contents, $systemInst, $apiKey, $model = 'gemini-3.5-flash-lite', $temperature = 0.9, $maxOutputTokens = 16384)
{
    if (empty(trim($apiKey ?? ''))) {
        return "Lỗi: Chưa cấu hình API Key.";
    }

    // OPTIMIZATION: Close session early to prevent locking other requests from same user
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . $apiKey;
    $payload = [
        "contents" => $contents,
        "systemInstruction" => ["parts" => [["text" => $systemInst]]],
        "generationConfig" => [
            "temperature" => (float) $temperature,
            "maxOutputTokens" => (int) $maxOutputTokens
        ]
    ];

    $maxRetries = 2;
    $retryCount = 0;
    $result = null;
    $httpCode = 0;

    do {
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
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [SECURITY] Enforce TLS for Gemini API // Increased Timeout for reasoning/retries

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $result = json_decode($response, true);

        if ($httpCode === 200)
            break;

        // Exponential Backoff for 429 (Too Many Requests) or 503 (Service Unavailable)
        if ($httpCode === 429 || $httpCode === 503) {
            $retryCount++;
            if ($retryCount <= $maxRetries) {
                $wait = pow(2, $retryCount); // 2s, 4s
                sleep($wait);
                continue;
            }
        }

        // Other errors, break immediately
        break;

    } while ($retryCount < $maxRetries);

    // Log for monitoring
    $usage = "";
    if (isset($result['usageMetadata'])) {
        $u = $result['usageMetadata'];
        $usage = " | Tokens: {$u['totalTokenCount']}";
    }
    logGeminiCall('RESPONSE_GEN', $httpCode, ($httpCode !== 200 ? ($result['error']['message'] ?? $curlError ?? 'Error') : 'Success') . $usage);

    if ($httpCode !== 200) {
        // THROW EXCEPTION so caller knows it failed and doesn't save this as a bot message
        $errMsg = $result['error']['message'] ?? $curlError ?? "API Error $httpCode";
        throw new Exception("Gemini API Error: " . $errMsg);
    }

    if (isset($result['candidates'][0]['content']['parts'])) {
        $fullText = "";
        foreach ($result['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['text'])) {
                $fullText .= $part['text'];
            }
            if (isset($part['inlineData'])) {
                // If Gemini returns an image directly
                $mime = $part['inlineData']['mimeType'] ?? 'image/png';
                $data = $part['inlineData']['data'];

                // We'll use a placeholder that the caller can later process if needed, 
                // or just convert to markdown if we have saveAIImage available.
                // Since this is a low-level helper, let's try to convert to markdown data URI for now
                // or check if saveAIImage is available.
                if (function_exists('saveAIImage')) {
                    $url = saveAIImage($data, $mime);
                    if ($url) {
                        $fullText .= "\n\n![Generated Image]($url)\n\n";
                    } else {
                        $fullText .= "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                    }
                } else {
                    $fullText .= "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                }
            }
        }
        return $fullText ?: "Dạ, em chưa tìm thấy câu trả lời phù hợp nhất lúc này.";
    }

    return "Dạ, em chưa tìm thấy câu trả lời phù hợp nhất lúc này. Anh/Chị có thể hỏi cụ thể hơn không ạ?";
}

/**
 * OPTIMIZED: Initialize an asynchronous Gemini request
 */
function generateResponseAsyncInit($contents, $systemInst, $apiKey, $model = 'gemini-3.5-flash-lite', $temperature = 1.0, $maxOutputTokens = 16384)
{
    if (empty($apiKey))
        return null;

    // OPTIMIZATION: Close session early to prevent locking other requests
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . $apiKey;
    $payload = [
        "contents" => $contents,
        "systemInstruction" => ["parts" => [["text" => $systemInst]]],
        "generationConfig" => [
            "temperature" => (float) $temperature,
            "maxOutputTokens" => (int) $maxOutputTokens
        ]
    ];

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
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [SECURITY] Enforce TLS for Gemini API

    $mh = curl_multi_init();
    curl_multi_add_handle($mh, $ch);

    // Start the request
    $active = null;
    do {
        $status = curl_multi_exec($mh, $active);
    } while ($status === CURLM_CALL_MULTI_PERFORM);

    return ['mh' => $mh, 'ch' => $ch];
}

/**
 * OPTIMIZED: Wait for and collect the result of an asynchronous Gemini request
 */
function generateResponseAsyncWait($asyncHandle)
{
    if (!$asyncHandle)
        return "Lỗi: Handle không hợp lệ.";

    $mh = $asyncHandle['mh'];
    $ch = $asyncHandle['ch'];

    $active = null;
    do {
        $status = curl_multi_exec($mh, $active);
        if ($active > 0) {
            curl_multi_select($mh);
        }
    } while ($active > 0 && $status === CURLM_OK);

    $response = curl_multi_getcontent($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_multi_remove_handle($mh, $ch);
    curl_close($ch);
    curl_multi_close($mh);

    $result = json_decode($response, true);

    if ($httpCode !== 200) {
        $errMsg = $result['error']['message'] ?? "API Error $httpCode";
        throw new Exception("Gemini API Error: " . $errMsg);
    }

    if (isset($result['candidates'][0]['content']['parts'])) {
        $fullText = "";
        foreach ($result['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['text'])) {
                $fullText .= $part['text'];
            }
            if (isset($part['inlineData'])) {
                $mime = $part['inlineData']['mimeType'] ?? 'image/png';
                $data = $part['inlineData']['data'];
                if (function_exists('saveAIImage')) {
                    $url = saveAIImage($data, $mime);
                    if ($url) {
                        $fullText .= "\n\n![Generated Image]($url)\n\n";
                    } else {
                        $fullText .= "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                    }
                } else {
                    $fullText .= "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                }
            }
        }
        return $fullText ?: "Dạ, em chưa tìm thấy câu trả lời phù hợp nhất lúc này.";
    }

    return "Dạ, em chưa tìm thấy câu trả lời phù hợp nhất lúc này.";
}
function streamResponse($contents, $systemInst, $apiKey, $onChunk, $model = 'gemini-3.5-flash-lite', $temperature = 0.9, $maxOutputTokens = 2048)
{
    if (empty($apiKey)) {
        $onChunk(["error" => "No API Key"]);
        return;
    }

    // OPTIMIZATION: Close session early to prevent locking other requests
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse&key=" . $apiKey;
    logAIChat('SYSTEM', 'GEMINI', 'STREAM_START', 'URL', "Calling: " . str_replace($apiKey, 'REDACTED', $url));
    $payload = [
        "contents" => $contents,
        "systemInstruction" => ["parts" => [["text" => $systemInst]]],
        "generationConfig" => [
            "temperature" => (float) $temperature,
            "maxOutputTokens" => (int) $maxOutputTokens
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Connection: keep-alive',
        'Accept-Encoding: gzip' // OPTIMIZED: Enable gzip compression
    ]);
    curl_setopt($ch, CURLOPT_ENCODING, 'gzip'); // OPTIMIZED: Decompress gzip response
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0); // OPTIMIZED: Use HTTP/2
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [SECURITY] Enforce TLS for Gemini API
    curl_setopt($ch, CURLOPT_TCP_NODELAY, true);
    curl_setopt($ch, CURLOPT_BUFFERSIZE, 1024); // Small buffer for low-latency streaming

    // This is the key for streaming
    $buffer = "";
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $data) use ($onChunk, &$buffer) {
        $buffer .= $data;
        while (($pos = strpos($buffer, "\n")) !== false) {
            $line = substr($buffer, 0, $pos);
            $buffer = substr($buffer, $pos + 1);
            $line = trim($line);
            if (empty($line))
                continue;

            if (strpos($line, 'data: ') === 0) {
                $json = substr($line, 6);
                $chunk = json_decode($json, true);
                if ($chunk) {
                    $onChunk($chunk);
                    if (ob_get_level() > 0)
                        ob_flush(); // Flush immediately
                    flush();
                }
            } else {
                // If it's not SSE data, it might be a direct error JSON
                $chunk = json_decode($line, true);
                if ($chunk && (isset($chunk['error']) || isset($chunk['candidates']))) {
                    $onChunk($chunk);
                    if (ob_get_level() > 0)
                        ob_flush();
                    flush();
                }
            }
        }
        return strlen($data);
    });

    // Ensure no output buffering is active � buffering kills streaming.
    // [FIX] Disable zlib.output_compression FIRST: even after all ob_* levels are cleared,
    // PHP's zlib handler keeps an invisible compression buffer that prevents real-time
    // SSE streaming until the request ends. Must be disabled at runtime before flushing.
    @ini_set('zlib.output_compression', '0');
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    ob_implicit_flush(true);

    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    logAIChat('SYSTEM', 'GEMINI', 'STREAM_END', $httpCode == 200 ? 'SUCCESS' : 'ERROR', "HTTP $httpCode" . ($curlErr ? " | cURL: $curlErr" : ""));

    if ($httpCode !== 200) {
        $onChunk(["error" => "HTTP $httpCode" . ($curlErr ? ": $curlErr" : "")]);
    }

    if (ob_get_level() > 0)
        ob_end_flush(); // Final flush
}
