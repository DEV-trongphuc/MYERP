<?php
/**
 * Zalo Helper Functions
 * Shared logic for OAuth and PKCE
 */

require_once __DIR__ . '/zalo_formatter.php';

// checkZaloAutomationSchema REMOVED - Logic moved to central migration scripts.

/**
 * Verify Zalo Webhook Signature (V3)
 * @param string $appId
 * @param string $rawData Raw JSON body
 * @param string $timestamp X-Zalo-Timestamp header
 * @param string $signature X-Zalo-Signature header
 * @param string $secretKey OA Secret Key (from zalo_oa_configs)
 * @return bool
 */
function verifyZaloSignature($appId, $rawData, $timestamp, $signature, $secretKey) {
    if (!$secretKey || !$signature) return false;
    
    // Zalo V3 logic: sha256(appId + rawData + timestamp + secretKey)
    $calculated = hash('sha256', $appId . $rawData . $timestamp . $secretKey);
    
    // Support both raw hex and mac= prefix
    $incoming = str_replace('mac=', '', $signature);
    
    return hash_equals($calculated, $incoming);
}

/**
 * Generate secure random code verifier
 */
function generateCodeVerifier()
{
    // Generate strictly 43 characters (Alphanumeric) as per Zalo docs
    $chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $len = 43;
    $verifier = '';
    for ($i = 0; $i < $len; $i++) {
        $verifier .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $verifier;
}

/**
 * Base64 URL Encode
 */
function base64UrlEncode($bytes)
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

/**
 * Generate code challenge from verifier using SHA256
 */
function generateCodeChallenge($verifier)
{
    $hash = hash('sha256', $verifier, true);
    return rtrim(strtr(base64_encode($hash), '+/', '-_'), '=');
}

/**
 * Store code verifier in database
 */
function storeCodeVerifier($pdo, $oa_id, $verifier)
{
    try {
        $stmt = $pdo->prepare("UPDATE zalo_oa_configs SET pkce_verifier = ? WHERE id = ?");
        $stmt->execute([$verifier, $oa_id]);
    } catch (Exception $e) {
        error_log("Failed to store PKCE verifier: " . $e->getMessage());
    }
}

/**
 * Retrieve stored code verifier from database
 */
function getCodeVerifier($pdo, $oa_id)
{
    try {
        $stmt = $pdo->prepare("SELECT pkce_verifier FROM zalo_oa_configs WHERE id = ?");
        $stmt->execute([$oa_id]);
        return $stmt->fetchColumn();
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Log a Zalo message (Inbound/Outbound)
 */
function logZaloMsg($pdo, $zaloUserId, $direction, $text, $workspaceId = null)
{
    try {
        $stmt = $pdo->prepare("INSERT INTO zalo_user_messages (zalo_user_id, workspace_id, direction, message_text) VALUES (?, ?, ?, ?)");
        $stmt->execute([$zaloUserId, $workspaceId ?: 1, $direction, $text]);
    } catch (Exception $e) {
    }
}

/**
 * Log a Zalo subscriber's timeline activity
 * Includes optional msgId for de-duplication
 */
function logZaloSubscriberActivity($pdo, $subscriberId, $type, $refId = null, $details = null, $refName = null, $msgId = null, $workspaceId = null, $eventId = null)
{
    try {
        // [DE-DUP] Prevent duplicate 'automation_trigger' logs
        if ($type === 'automation_trigger') {
            $stmtCheck = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = ? AND reference_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1");
            $stmtCheck->execute([$subscriberId, $type, $refId]);
            if ($stmtCheck->fetch()) {
                return;
            }
        }

        // [FIX AUDIT-16/17] Zalo Activity Buffering with event_id and workspace_id
        $stmtBuf = $pdo->prepare("INSERT INTO zalo_activity_buffer (subscriber_id, workspace_id, type, reference_id, reference_name, details, zalo_msg_id, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmtBuf->execute([$subscriberId, $workspaceId ?: 1, $type, $refId, $refName, $details, $msgId, $eventId]);
    } catch (Exception $e) {
        error_log("Failed to log Zalo activity for sub $subscriberId: " . $e->getMessage());
    }
}

/**
 * Send Zalo Automation Reply (CS API)
 */
function sendZaloScenarioReply($pdo, $zaloUserId, $accessToken, $scenario, $userMsg = '', $workspaceId = null)
{
    // Handle AI Reply Type
    if ($scenario['type'] === 'ai_reply' && !empty($scenario['ai_chatbot_id'])) {
        sendZaloAIReply($pdo, $zaloUserId, $accessToken, $scenario, $userMsg);
        return;
    }

    $buttons = json_decode($scenario['buttons'] ?? '[]', true);
    $zaloButtons = [];

    foreach ($buttons as $btn) {
        if (!empty($btn['title'])) {
            $zaloBtn = [
                'title' => $btn['title'],
                'type' => $btn['type'] ?? 'oa.query.show',
            ];

            if (!empty($btn['image_icon'])) {
                $zaloBtn['image_icon'] = $btn['image_icon'];
            }

            $rawPayload = $btn['payload'] ?? '';

            if ($zaloBtn['type'] === 'oa.open.url') {
                // Tracking Injection for Links
                $encodedUrl = base64_encode($rawPayload);
                $encodedLabel = urlencode($zaloBtn['title']);
                $trackUrl = API_BASE_URL . "/zalo_track.php?u=$encodedUrl&sid={$scenario['id']}&uid=$zaloUserId&lbl=$encodedLabel";
                $zaloBtn['payload'] = ['url' => $trackUrl];
            } elseif ($zaloBtn['type'] === 'oa.open.phone') {
                // [NEW] Tracking for Phone - Convert to tracked URL with tel:
                $encodedUrl = base64_encode("tel:$rawPayload");
                $encodedLabel = urlencode($zaloBtn['title'] . " (Call)");
                $trackUrl = API_BASE_URL . "/zalo_track.php?u=$encodedUrl&sid={$scenario['id']}&uid=$zaloUserId&lbl=$encodedLabel";
                $zaloBtn['type'] = 'oa.open.url';
                $zaloBtn['payload'] = ['url' => $trackUrl];
            } else {
                // oa.query.show - No tracking marker to keep UI clean as requested
                $zaloBtn['payload'] = $rawPayload ?: $btn['title'];
            }

            $zaloButtons[] = $zaloBtn;
        }
    }

    $payload = ['recipient' => ['user_id' => $zaloUserId]];

    if ($scenario['message_type'] === 'image' && !empty($scenario['attachment_id'])) {
        // Media Template
        $payload['message'] = [
            'text' => $scenario['content'],
            'attachment' => [
                'type' => 'template',
                'payload' => [
                    'template_type' => 'media',
                    'elements' => [
                        [
                            'media_type' => 'image',
                            'attachment_id' => $scenario['attachment_id'],
                            'title' => $scenario['title'] ?? '',
                            'subtitle' => ''
                        ]
                    ]
                ]
            ]
        ];
        if (!empty($zaloButtons)) {
            $payload['message']['attachment']['payload']['buttons'] = $zaloButtons;
        }
        // Format & send single image message
        if (isset($payload['message']['text'])) {
            $payload['message']['text'] = formatZaloMessage($payload['message']['text']);
        }
        _sendZaloPayload($pdo, $zaloUserId, $accessToken, $payload, $scenario['content'] ?? '', $workspaceId);
        return;
    }

    // Text Template: strip markdown trước
    $textContent = $scenario['content'] ?? '';
    if (!empty($scenario['title'])) {
        $textContent = $scenario['title'] . "\n\n" . $textContent;
    }
    $textContent = formatZaloMessage($textContent);

    // Chia tin nhắn dài thành nhiều đoạn (Zalo giới hạn ~1000 ký tự)
    $parts = splitLongMessage($textContent, 900);

    // Gửi từng đoạn; chỉ đoạn cuối mới gắn buttons
    foreach ($parts as $i => $part) {
        $isLastPart = ($i === count($parts) - 1);
        $partPayload = ['recipient' => ['user_id' => $zaloUserId]];

        if ($isLastPart && !empty($zaloButtons)) {
            $partPayload['message'] = [
                'text' => $part,
                'attachment' => [
                    'type' => 'template',
                    'payload' => [
                        'buttons' => array_slice($zaloButtons, 0, 4)
                    ]
                ]
            ];
        } else {
            $partPayload['message'] = ['text' => $part];
        }

        _sendZaloPayload($pdo, $zaloUserId, $accessToken, $partPayload, $part, $workspaceId);

        // Delay nhỏ giữa các tin để tránh rate limit
        if (!$isLastPart) {
            usleep(300000); // 0.3 giây
        }
    }
}

/**
 * Internal helper: Gửi Zalo CS API và log kết quả
 */
function _sendZaloPayload($pdo, $zaloUserId, $accessToken, $payload, $logText, $workspaceId = null)
{
    $ch = curl_init("https://openapi.zalo.me/v3.0/oa/message/cs");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'access_token: ' . $accessToken]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);  // [FIX P38-ZH] Enforce TLS verification
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);     // [FIX P38-ZH] Hostname verification
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);           // [FIX P38-ZH] Prevent indefinite hang on Zalo API slowness
    $resRaw = curl_exec($ch);
    curl_close($ch);

    $res = json_decode($resRaw, true);
    if (isset($res['error']) && $res['error'] == 0) {
        $logged = (strpos($logText, '[Automation]') === 0) ? $logText : "[Automation] " . $logText;
        logZaloMsg($pdo, $zaloUserId, 'outbound', $logged, $workspaceId);
    } else {
        file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "Send Scenario Failed: " . $resRaw . "\n", FILE_APPEND);
    }
}

/**
 * AI Reply Logic for Zalo
 */
function sendZaloAIReply($pdo, $zaloUserId, $accessToken, $scenario, $userMsg, $workspaceId = null)
{
    if (empty($userMsg))
        return;

    // 1. Call AI Chatbot API
    $url = API_BASE_URL . "/ai_chatbot.php";
    $postData = [
        'message' => $userMsg,
        'property_id' => $scenario['ai_chatbot_id'],
        'visitor_id' => "zalo_" . $zaloUserId,
        'is_test' => false
    ];

    // [FINAL RELIABILITY FIX] Call via Public URL directly but skip SSL to avoid Loopback/404 issues
    $url = API_BASE_URL . "/ai_chatbot.php";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60); 
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    
    $resRaw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($resRaw === false) {
        file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "AI API cURL Error ($httpCode): " . $curlErr . "\n", FILE_APPEND);
        return;
    }

    $res = json_decode($resRaw, true);
    if (!$res || !($res['success'] ?? false)) {
        file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "AI API Response Fail (HTTP $httpCode): " . $resRaw . " | Err: " . json_last_error_msg() . "\n", FILE_APPEND);
        return;
    }

    $aiText = $res['reply'] ?? $res['message'] ?? $res['data']['message'] ?? null;
    $quickActions = $res['data']['quick_actions'] ?? [];

    if (!$aiText) {
        file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "AI API Empty Message, resRaw: " . $resRaw . "\n", FILE_APPEND);
        return;
    }

    // [FIX] Race condition check: Verify if AI is paused AGAIN right before sending.
    // A human agent might have replied while Gemini was generating this response.
    $stmtCheckPause = $pdo->prepare("SELECT ai_paused_until FROM zalo_subscribers WHERE zalo_user_id = ?");
    $stmtCheckPause->execute([$zaloUserId]);
    $pausedUntil = $stmtCheckPause->fetchColumn();
    if ($pausedUntil && strtotime($pausedUntil) > time()) {
        file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "AI Aborted! Human agent replied during generation. Paused until $pausedUntil\n", FILE_APPEND);
        return;
    }

    // 2. Parse AI Response for Zalo elements (URL, phone, links) BEFORE stripping Markdown
    // This ensures we capture [text](url) format if Gemini uses it.
    $parsed = parseAIResponseForZalo($aiText);

    // 3. Strip all Markdown and special tags AFTER parsing elements
    $aiText = formatZaloMessage($aiText);
    $cleanText = $aiText; // Define cleanText for later use

    // Merge Dynamic Quick Actions from AI with parsed buttons
    $finalButtons = $parsed['buttons'];
    foreach ($quickActions as $action) {
        if (count($finalButtons) >= 4)
            break;
        $exists = false;
        
        // Zalo OA API strictly limits button titles to 20 characters.
        $safeTitle = mb_strlen($action, 'UTF-8') > 20 ? mb_substr($action, 0, 17, 'UTF-8') . '...' : $action;
        
        foreach ($finalButtons as $fb) {
            if ($fb['title'] === $safeTitle) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            $finalButtons[] = ['title' => $safeTitle, 'type' => 'oa.query.show', 'payload' => $action];
        }
    }

    $cleanText = formatZaloMessage($parsed['text']);

    // 4. Nếu có image, xử lý riêng
    if ($parsed['image_url']) {
        $attachmentId = uploadZaloImageFromUrl($accessToken, $parsed['image_url']);
        if ($attachmentId) {
            $textOnly = trim(str_replace($parsed['image_url'], '', $cleanText));
            $textOnly = preg_replace('/!?\[[^\]]*\]\(\s*\)/', '', $textOnly);
            $textOnly = trim($textOnly);

            if (!empty($textOnly)) {
                $textParts = splitLongMessage($textOnly, 900);
                foreach ($textParts as $part) {
                    _sendZaloPayload($pdo, $zaloUserId, $accessToken, [
                        'recipient' => ['user_id' => $zaloUserId],
                        'message' => ['text' => $part]
                    ], $part, $workspaceId);
                    usleep(300000);
                }
            }

            // Gửi image kèm buttons
            $imgScenario = [
                'id' => ($scenario['id'] ?? 'ai') . '_img',
                'title' => '',
                'content' => '',
                'message_type' => 'image',
                'attachment_id' => $attachmentId,
                'buttons' => json_encode($finalButtons),
                'type' => 'ai_processed'
            ];
            sendZaloScenarioReply($pdo, $zaloUserId, $accessToken, $imgScenario, '', $workspaceId);
            return;
        }
        // Upload fail -> dùng text với URL giữ nguyên
    }

    // 5. Chia tin nhắn dài thành nhiều đoạn (Zalo giới hạn ~900 ký tự)
    $parts = splitLongMessage($cleanText, 900);

    foreach ($parts as $i => $part) {
        $isLastPart = ($i === count($parts) - 1);
        $partPayload = ['recipient' => ['user_id' => $zaloUserId]];

        if ($isLastPart && !empty($finalButtons)) {
            $partPayload['message'] = [
                'text' => $part,
                'attachment' => [
                    'type' => 'template',
                    'payload' => [
                        'buttons' => array_slice($finalButtons, 0, 4)
                    ]
                ]
            ];
        } else {
            $partPayload['message'] = ['text' => $part];
        }

        _sendZaloPayload($pdo, $zaloUserId, $accessToken, $partPayload, $part, $workspaceId);

        if (!$isLastPart) {
            usleep(300000); // 0.3 giây
        }
    }
}

/**
 * Parse AI Text into Zalo friendly elements
 */
function parseAIResponseForZalo($text)
{
    $buttons = [];
    $imageUrl = null;

    // Detect Image (Exclude Markdown and punctuation boundaries)
    if (preg_match('/(https?:\/\/[^\s\(\)\[\]]+?\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s\(\)\[\]]+)?)/i', $text, $matches)) {
        $imageUrl = $matches[1];
    }

    // Detect Phone
    if (preg_match('/(0|\+84)[3|5|7|8|9][0-9]{8}/', $text, $matches)) {
        $phone = $matches[0];
        $buttons[] = ['title' => 'Gọi điện tư vấn', 'type' => 'oa.open.phone', 'payload' => $phone];
    }

    // Detect Links (Exclude the one already picked as image)
    if (preg_match_all('/(https?:\/\/[^\s\(\)\[\]]+)/i', $text, $matches)) {
        foreach ($matches[0] as $url) {
            // Clean URL from trailing conversational punctuation
            $cleanUrl = rtrim($url, '.,;?!)]');

            if ($cleanUrl === $imageUrl)
                continue;

            // Check for uniqueness
            $isDuplicate = false;
            foreach ($buttons as $b)
                if (($b['payload'] ?? '') === $cleanUrl) {
                    $isDuplicate = true;
                    break;
                }
            if ($isDuplicate)
                continue;

            // Tailor the label
            $label = 'Xem trên Website';
            if (strpos($cleanUrl, 'zalo.me/s/') !== false) {
                $label = 'Mở Form đăng ký';
            } else if (preg_match('/\.(pdf|docx|doc|xlsx|xls|pptx|ppt|zip|rar)$/i', $cleanUrl)) {
                $label = 'Tải tài liệu';
            }

            $buttons[] = ['title' => $label, 'type' => 'oa.open.url', 'payload' => $cleanUrl];
        }
    }

    // Parse [ACTIONS: ...] tags
    $actionRegex = '/\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?\s*([^\]]+)\]/iu';
    if (preg_match_all($actionRegex, $text, $matches)) {
        foreach ($matches[1] as $rawActions) {
            if (empty(trim($rawActions))) continue;
            $separator = strpos($rawActions, '|') !== false ? '|' : ',';
            $items = explode($separator, $rawActions);
            foreach ($items as $item) {
                $item = trim($item);
                if (empty($item)) continue;
                
                // Zalo OA API strictly limits button titles to 20 characters.
                $safeTitle = mb_strlen($item, 'UTF-8') > 20 ? mb_substr($item, 0, 17, 'UTF-8') . '...' : $item;
                
                // Check if button title or payload already exists
                $exists = false;
                foreach ($buttons as $b) {
                    if ($b['title'] === $safeTitle || ($b['payload'] ?? '') === $item) {
                        $exists = true;
                        break;
                    }
                }
                if (!$exists) {
                    $buttons[] = [
                        'title' => $safeTitle,
                        'type' => 'oa.query.show',
                        'payload' => $item
                    ];
                }
            }
        }
        $text = preg_replace($actionRegex, '', $text);
    }

    return [
        'text' => trim($text),
        'image_url' => $imageUrl,
        'buttons' => array_slice($buttons, 0, 4)
    ];
}

/**
 * Upload Image from URL to Zalo OA
 */
function uploadZaloImageFromUrl($accessToken, $imageUrl)
{
    // [FIX BUG-ZH-2] Validate URL scheme to prevent SSRF.
    // If AI hallucinates a non-http URL (e.g. file:///etc/passwd, ftp://...), 
    // @file_get_contents would follow it and expose server internals.
    $parsedUrl = parse_url($imageUrl);
    if (!$parsedUrl || !in_array(strtolower($parsedUrl['scheme'] ?? ''), ['http', 'https'])) {
        error_log('[zalo_helpers] Rejected image URL (invalid scheme): ' . $imageUrl);
        return null;
    }

    // Use cURL instead of file_get_contents for safer, timeout-controlled download
    $chDl = curl_init($imageUrl);
    curl_setopt($chDl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chDl, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($chDl, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($chDl, CURLOPT_TIMEOUT, 10);
    curl_setopt($chDl, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($chDl, CURLOPT_MAXREDIRS, 3);
    $imgData = curl_exec($chDl);
    $contentType = curl_getinfo($chDl, CURLINFO_CONTENT_TYPE);
    curl_close($chDl);

    // [FIX BUG-ZH-2] Validate Content-Type is an image before uploading
    if (!$imgData || !preg_match('#^image/(jpeg|png|gif|webp)#i', $contentType)) {
        error_log('[zalo_helpers] Rejected image URL (non-image content-type: ' . $contentType . '): ' . $imageUrl);
        return null;
    }

    $tmpFile = tempnam(sys_get_temp_dir(), 'zalo_img');
    file_put_contents($tmpFile, $imgData);

    $ch = curl_init("https://openapi.zalo.me/v2.0/oa/upload/image");
    $cfile = new CURLFile($tmpFile, 'image/jpeg', 'image.jpg');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

    $resRaw = curl_exec($ch);
    curl_close($ch);
    @unlink($tmpFile);

    $res = json_decode($resRaw, true);
    if (!isset($res['data']['attachment_id'])) {
        file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "Image Upload Failed for URL ($imageUrl): " . $resRaw . "\n", FILE_APPEND);
    }
    return $res['data']['attachment_id'] ?? null;
}

/**
 * Get Zalo User Profile (Name, Avatar)
 */
function getZaloUserProfile($accessToken, $userId)
{
    $url = "https://openapi.zalo.me/v3.0/oa/user/detail";
    $params = http_build_query(['data' => json_encode(['user_id' => $userId])]);

    $ch = curl_init("$url?$params");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

    $res = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($res, true);
    if (isset($data['error']) && $data['error'] == 0 && isset($data['data'])) {
        return $data['data']; // Returns user_id, display_name, avatar, etc.
    }

    // [FALLBACK] V2.0
    $url2 = "https://openapi.zalo.me/v2.0/oa/getprofile";
    $ch2 = curl_init("$url2?$params");
    curl_setopt($ch2, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    $res2 = curl_exec($ch2);
    curl_close($ch2);

    $data2 = json_decode($res2, true);
    if (isset($data2['error']) && $data2['error'] == 0 && isset($data2['data'])) {
        return $data2['data'];
    }

    return null;
}

/**
 * Ensures access token is valid, refreshes if needed.
 * returns the valid access_token or null on failure.
 */
function ensureZaloToken($pdo, $oaId)
{
    // Try finding by internal ID or real OA ID
    $stmt = $pdo->prepare("SELECT id, app_id, app_secret, access_token, refresh_token, token_expires_at FROM zalo_oa_configs WHERE id = ? OR oa_id = ? LIMIT 1");
    $stmt->execute([$oaId, $oaId]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$oa)
        return null;

    $now = date('Y-m-d H:i:s');
    // Buffer of 5 minutes
    $expiresAt = $oa['token_expires_at'] ? date('Y-m-d H:i:s', strtotime($oa['token_expires_at']) - 300) : null;

    if ($oa['access_token'] && ($expiresAt && $expiresAt > $now)) {
        return $oa['access_token'];
    }

    // [SCALING] ATOMIC REFRESH LOCK
    // Prevent multiple concurrent webhooks from refreshing the same token
    $lockName = "zalo_refresh_" . $oa['id'];
    db_get_lock($pdo, $lockName, 10); // Wait up to 10s using global manager

    try {
        // RE-FETCH: Check if another process already refreshed it while we waited for lock
        $stmtReload = $pdo->prepare("SELECT access_token, refresh_token, token_expires_at FROM zalo_oa_configs WHERE id = ?");
        $stmtReload->execute([$oa['id']]);
        $oa = array_merge($oa, $stmtReload->fetch(PDO::FETCH_ASSOC));

        if ($oa['access_token'] && ($expiresAt && $expiresAt > $now)) {
            db_release_lock($pdo, $lockName);
            return $oa['access_token'];
        }

        // Need refresh
        if (empty($oa['refresh_token'])) {
            db_release_lock($pdo, $lockName);
            return null;
        }

        $url = 'https://oauth.zaloapp.com/v4/oa/access_token';
        $params = [
            'app_id' => $oa['app_id'],
            'grant_type' => 'refresh_token',
            'refresh_token' => $oa['refresh_token']
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded',
            'secret_key: ' . $oa['app_secret']
        ]);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code === 200) {
            $result = json_decode($response, true);
            if (isset($result['access_token'])) {
                $new_access_token = $result['access_token'];
                $new_refresh_token = $result['refresh_token'] ?? $oa['refresh_token'];
                $expires_at = date('Y-m-d H:i:s', time() + ($result['expires_in'] ?? 86400));

                $stmtU = $pdo->prepare("UPDATE zalo_oa_configs SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = NOW() WHERE id = ?");
                $stmtU->execute([$new_access_token, $new_refresh_token, $expires_at, $oa['id']]);

                db_release_lock($pdo, $lockName);
                return $new_access_token;
            } elseif (isset($result['error']) && $result['error'] != 0) {
                // [Vòng 33 FIX] Suspend dead token to prevent API hammering
                try {
                    $pdo->prepare("UPDATE zalo_oa_configs SET status = 'error_refresh', updated_at = NOW() WHERE id = ?")->execute([$oa['id']]);
                    error_log("Zalo OA Refresh Failed. Status set to error_refresh. OA: {$oa['id']}");
                } catch (Exception $e) {}
            }
        }
    } catch (Exception $e) {
        // Fallback log
    }

    db_release_lock($pdo, $lockName);
    return null;
}


/**
 * Upsert Zalo Subscriber (Centralized Logic)
 */

function upsertZaloSubscriber($pdo, $zaloUserId, $profile, $oaConfigId = null)
{
    $email = "zalo_{$zaloUserId}@zalo-oa.vn";
    $name = $profile['display_name'] ?? 'Unknown Zalo User';
    $zaloTag = "Zalo Follower";
    $avatar = $profile['avatar'] ?? null;

    // Map Zalo Gender: 1=Male, 2=Female, other=Unknown
    $genderRaw = $profile['user_gender'] ?? 0;
    $gender = ($genderRaw == 1) ? 'male' : (($genderRaw == 2) ? 'female' : 'unknown');

    // [FIX BUG-ZH-1] Resolve workspace_id from oaConfigId.
    // Previously missing → subscribers created from Zalo webhook had NULL workspace_id
    // → they were invisible in the CRM and could not trigger automations.
    $workspace_id = null;
    if ($oaConfigId) {
        try {
            $stmtWs = $pdo->prepare("SELECT workspace_id FROM zalo_oa_configs WHERE id = ? LIMIT 1");
            $stmtWs->execute([$oaConfigId]);
            $workspace_id = $stmtWs->fetchColumn() ?: null;
        } catch (Exception $e) {}
    }
    // Fallback: try to find existing subscriber's workspace_id by zalo_user_id
    if (!$workspace_id) {
        try {
            $stmtFb = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE zalo_user_id = ? AND workspace_id IS NOT NULL LIMIT 1");
            $stmtFb->execute([$zaloUserId]);
            $workspace_id = $stmtFb->fetchColumn() ?: null;
        } catch (Exception $e) {}
    }
    // Last resort: default workspace
    if (!$workspace_id) {
        $workspace_id = '1';
    }

    $mainSubId = null;

    try {
        // [CONCURRENCY] Attempt atomic insert first
        $newId = bin2hex(random_bytes(16));
        $tags = json_encode([$zaloTag]);

        $stmtInsert = $pdo->prepare("
            INSERT IGNORE INTO subscribers 
            (workspace_id, id, email, first_name, source, status, zalo_user_id, tags, joined_at, avatar, gender, is_zalo_follower)
            VALUES (?, ?, ?, ?, 'Zalo OA', 'active', ?, ?, NOW(), ?, ?, 1)
        ");
        $stmtInsert->execute([$workspace_id, $newId, $email, $name, $zaloUserId, $tags, $avatar, $gender]);

        if ($stmtInsert->rowCount() > 0) {
            $mainSubId = $newId;
        } else {
            // Already exists, update details (Scoped by workspace_id to prevent cross-tenant merging)
            $stmt = $pdo->prepare("SELECT id, tags, avatar, gender, is_zalo_follower FROM subscribers WHERE (zalo_user_id = ? OR email = ?) AND workspace_id = ?");
            $stmt->execute([$zaloUserId, $email, $workspace_id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $mainSubId = $existing['id'];

                // Update missing fields
                $updateCols = [];
                $params = [];

                $currentTags = json_decode($existing['tags'] ?? '[]', true);
                if (!in_array($zaloTag, $currentTags)) {
                    $currentTags[] = $zaloTag;
                    $updateCols[] = "tags = ?";
                    $params[] = json_encode($currentTags);
                }
                if (empty($existing['avatar']) && $avatar) {
                    $updateCols[] = "avatar = ?";
                    $params[] = $avatar;
                }
                if (empty($existing['zalo_user_id'])) {
                    $updateCols[] = "zalo_user_id = ?";
                    $params[] = $zaloUserId;
                }
                if (empty($existing['is_zalo_follower'])) {
                    $updateCols[] = "is_zalo_follower = 1";
                }

                if (!empty($updateCols)) {
                    $sql = "UPDATE subscribers SET " . implode(', ', $updateCols) . " WHERE id = ?";
                    $params[] = $mainSubId;
                    $pdo->prepare($sql)->execute($params);
                }
            }
        }
    } catch (Exception $e) {
        // Fallback
    }

    // 2. Sync to ZALO_SUBSCRIBERS table (Audience Tab)
    if ($oaConfigId) {
        try {
            // Find List for this OA CONFIG (using oa_config_id)
            $listId = null;
            $stmtL = $pdo->prepare("SELECT id FROM zalo_lists WHERE workspace_id = ? AND oa_config_id = ? LIMIT 1");
            $stmtL->execute([$workspace_id, $oaConfigId]);
            $listId = $stmtL->fetchColumn();

            if (!$listId) {
                // Create Default List for OA
                // Get OA Name
                $stmtOA = $pdo->prepare("SELECT name, oa_id FROM zalo_oa_configs WHERE id = ?");
                $stmtOA->execute([$oaConfigId]);
                $oaData = $stmtOA->fetch(PDO::FETCH_ASSOC);
                $oaName = $oaData['name'] ?? 'Zalo OA';

                $listId = bin2hex(random_bytes(16));
                $pdo->prepare("INSERT INTO zalo_lists (id, workspace_id, name, oa_config_id, created_at) VALUES (?, ?, ?, ?, NOW())")
                    ->execute([$listId, $workspace_id, $oaName, $oaConfigId]);
            }

            // Upsert into zalo_subscribers
            $stmtZ = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE workspace_id = ? AND zalo_user_id = ?");
            $stmtZ->execute([$workspace_id, $zaloUserId]);
            $existingZId = $stmtZ->fetchColumn();

            // Status: 'active'. Is Follower: 1.
            // Using schema: status=active, is_follower=1, oa_id (real ID)
            $stmtOAReal = $pdo->prepare("SELECT oa_id FROM zalo_oa_configs WHERE workspace_id = ? AND id = ?");
            $stmtOAReal->execute([$workspace_id, $oaConfigId]);
            $oaRealId = $stmtOAReal->fetchColumn();

            if ($existingZId) {
                $pdo->prepare("UPDATE zalo_subscribers SET is_follower = 1, status = 'active', last_interaction_at = NOW(), display_name = ?, avatar = ?, zalo_list_id = ?, oa_id = ? WHERE id = ? AND workspace_id = ?")
                    ->execute([$name, $avatar, $listId, $oaRealId, $existingZId, $workspace_id]);
            } else {
                $newZId = bin2hex(random_bytes(16));
                $pdo->prepare("
                    INSERT INTO zalo_subscribers 
                    (id, workspace_id, zalo_list_id, zalo_user_id, display_name, avatar, status, is_follower, oa_id, joined_at, last_interaction_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, NOW(), NOW())
                ")->execute([$newZId, $workspace_id, $listId, $zaloUserId, $name, $avatar, $oaRealId]);
            }

        } catch (Exception $ex) {
            error_log("Zalo Sync Sub Error: " . $ex->getMessage());
        }
    } else {
        // Fallback if no oaConfigId: Try to just update is_follower if exists
        try {
            $pdo->prepare("UPDATE zalo_subscribers SET is_follower = 1 WHERE zalo_user_id = ?")->execute([$zaloUserId]);
        } catch (Exception $e) {
        }
    }

    if (!$mainSubId) {
        $stmtFallback = $pdo->prepare("SELECT id FROM subscribers WHERE workspace_id = ? AND (zalo_user_id = ? OR email = ?) LIMIT 1");
        $stmtFallback->execute([$workspace_id, $zaloUserId, $email]);
        $mainSubId = $stmtFallback->fetchColumn();
    }

    return $mainSubId;
}

/**
 * Check if a Zalo scenario is active based on schedule
 */
function isScenarioActive($scenario, $nowTime, $nowDay)
{
    if ($scenario['schedule_type'] === 'full')
        return true;

    // [NEW] Support per-day schedule in active_days (JSON)
    if (strpos($scenario['active_days'] ?? '', '{') === 0) {
        $custom = json_decode($scenario['active_days'], true);
        if (isset($custom[$nowDay])) {
            $s = $custom[$nowDay]['start'] ?? '00:00';
            $e = $custom[$nowDay]['end'] ?? '23:59';
            if ($s > $e) {
                // Overnight (e.g. 22:00 - 08:00)
                return ($nowTime >= $s || $nowTime <= $e);
            } else {
                // Normal (e.g. 08:00 - 17:00)
                return ($nowTime >= $s && $nowTime <= $e);
            }
        }
        return false;
    }

    $days = explode(',', $scenario['active_days'] ?? '');
    if (!in_array((string) $nowDay, $days))
        return false;

    $s = $scenario['start_time'] ?? '00:00';
    $e = $scenario['end_time'] ?? '23:59';

    if ($s > $e) {
        // Overnight (e.g. 22:00 - 08:00)
        return ($nowTime >= $s || $nowTime <= $e);
    } else {
        // Normal (e.g. 08:00 - 17:00)
        return ($nowTime >= $s && $nowTime <= $e);
    }
}
