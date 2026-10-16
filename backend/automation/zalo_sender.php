<?php
/**
 * Zalo ZNS Sender - Core sending logic
 * Handles phone validation, quota management, and ZNS API calls
 */

require_once 'db_connect.php';

/**
 * Validate and normalize Vietnam phone number
 * Accepts: +84xxxxxxxxx or 0xxxxxxxxx
 * Returns: normalized format (+84xxxxxxxxx) or false
 */
function validatePhoneNumber($phone)
{
    // Remove all spaces, dashes, and parentheses
    $phone = preg_replace('/[\s\-\(\)]/', '', $phone);

    // Check if starts with +840 or 840 (e.g. 840912345678 -> 84912345678)
    if (preg_match('/^\+?840(\d{9})$/', $phone, $matches)) {
        return '84' . $matches[1];
    }

    // Check if starts with +84
    if (preg_match('/^\+84(\d{9,10})$/', $phone, $matches)) {
        return '84' . $matches[1];
    }

    // Check if starts with 0 (standard Vietnamese format: 0xxxxxxxxx)
    if (preg_match('/^0(\d{9})$/', $phone, $matches)) {
        return '84' . $matches[1];
    }

    // Check if starts with 84 (without +)
    if (preg_match('/^84(\d{9,10})$/', $phone, $matches)) {
        return '84' . $matches[1];
    }

    // [FIX] 9-digit numbers missing leading 0 (e.g. 378859736 from Excel import)
    // Valid Vietnamese prefixes: 3x, 5x, 7x, 8x, 9x (Viettel/Mobi/Vina/GTel)
    if (preg_match('/^([35789]\d{8})$/', $phone, $matches)) {
        return '84' . $matches[1];
    }

    return false;
}

/**
 * Check if quota is available for sending
 * Also checks time restrictions (6 AM - 10 PM)
 */
function checkQuotaAvailable($pdo, $oaConfigId, $count = 1)
{
    // Check time restriction
    $hour = (int) date('H');
    if ($hour < 6 || $hour >= 22) {
        return [
            'available' => false,
            'reason' => 'time_restricted',
            'message' => 'ZNS can only be sent between 6 AM and 10 PM'
        ];
    }

    // Get OA config
    $stmt = $pdo->prepare("
        SELECT id, daily_quota, quota_used_today, quota_reset_date, status
        FROM zalo_oa_configs
        WHERE id = ?
    ");
    $stmt->execute([$oaConfigId]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    // [ROBUST] Fallback search by oa_id if id fetch fails (Handles cases where Zalo OA ID was saved instead of hash)
    if (!$oa && ctype_digit($oaConfigId)) {
        $stmtFallback = $pdo->prepare("
            SELECT id, daily_quota, quota_used_today, quota_reset_date, status
            FROM zalo_oa_configs
            WHERE oa_id = ?
        ");
        $stmtFallback->execute([$oaConfigId]);
        $oa = $stmtFallback->fetch(PDO::FETCH_ASSOC);

        if ($oa) {
            error_log("ZNS: Found OA by oa_id fallback ($oaConfigId -> {$oa['id']})");
        }
    }

    if (!$oa) {
        return [
            'available' => false,
            'reason' => 'oa_not_found',
            'message' => 'OA configuration not found'
        ];
    }

    if ($oa['status'] !== 'active') {
        return [
            'available' => false,
            'reason' => 'oa_inactive',
            'message' => 'OA is not active'
        ];
    }

    // Check and reset quota if new day
    $today = date('Y-m-d');
    if ($oa['quota_reset_date'] !== $today) {
        $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs
            SET quota_used_today = 0, quota_reset_date = ?
            WHERE id = ?
        ");
        // [BUG-I2 FIX] Use $oa['id'] (PK) instead of $oaConfigId which may be an oa_id lookup value
        $stmt->execute([$today, $oa['id']]);
        $oa['quota_used_today'] = 0;
    }

    $remaining = $oa['daily_quota'] - $oa['quota_used_today'];

    // [FIX] daily_quota = 0 means "not configured" ? treat as unlimited (skip check)
    // This prevents false quota_exceeded errors when quota hasn't been synced from Zalo yet
    if ($oa['daily_quota'] <= 0) {
        return ['available' => true, 'remaining' => 9999];
    }

    if ($remaining < $count) {
        return [
            'available' => false,
            'reason' => 'quota_exceeded',
            'message' => "Insufficient quota. Remaining: $remaining, Requested: $count"
        ];
    }

    return [
        'available' => true,
        'remaining' => $remaining
    ];
}

/**
 * Get access token for OA (refresh if expired)
 */
function getAccessToken($pdo, $oaConfigId)
{
    require_once __DIR__ . '/zalo_helpers.php';

    $accessToken = ensureZaloToken($pdo, $oaConfigId);

    if (!$accessToken) {
        return ['success' => false, 'message' => 'Failed to get or refresh access token'];
    }

    return ['success' => true, 'access_token' => $accessToken];
}

/**
 * Internal function to refresh access token
 */
function refreshAccessTokenInternal($pdo, $oaConfigId, $oa)
{
    if (empty($oa['refresh_token'])) {
        return ['success' => false, 'message' => 'No refresh token available'];
    }

    $app_secret = base64_decode($oa['app_secret']);

    $url = 'https://oauth.zaloapp.com/v4/oa/access_token';
    $params = [
        'app_id' => $oa['app_id'],
        'grant_type' => 'refresh_token',
        'refresh_token' => $oa['refresh_token']
    ];

    $secret_key = hash('sha256', $app_secret);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded',
        'secret_key: ' . $secret_key
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $result = json_decode($response, true);

    if (isset($result['access_token'])) {
        $expires_at = date('Y-m-d H:i:s', time() + ($result['expires_in'] ?? 86400));

        $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs
            SET access_token = ?, 
                refresh_token = ?,
                token_expires_at = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $result['access_token'],
            $result['refresh_token'] ?? $oa['refresh_token'],
            $expires_at,
            $oaConfigId
        ]);

        return ['success' => true, 'access_token' => $result['access_token']];
    }

    return ['success' => false, 'message' => 'Failed to refresh token'];
}

/**
 * Send single ZNS message
 * @param string|null $preloadedToken If provided, skips the getAccessToken() DB call.
 *        Used by batchSendZNS to avoid N DB queries for token per message.
 */
function sendZNSMessage($pdo, $oaConfigId, $templateId, $phoneNumber, $templateData, $flowId = null, $stepId = null, $subscriberId = null, $mode = null, $preloadedToken = null, $workspaceId = null)
{
    // Validate phone number
    $normalizedPhone = validatePhoneNumber($phoneNumber);
    if (!$normalizedPhone) {
        return [
            'success' => false,
            'status' => 'invalid_phone',
            'message' => 'Invalid phone number format'
        ];
    }

    // [SEC-FIX] Normalize and VERIFY oaConfigId ownership
    // This prevents attackers from using another tenant's OA by spoofing the ID in flow JSON.
    $sqlOa = "SELECT id FROM zalo_oa_configs WHERE (id = ? OR oa_id = ?)";
    $paramsOa = [$oaConfigId, $oaConfigId];

    if ($workspaceId) {
        $sqlOa .= " AND workspace_id = ?";
        $paramsOa[] = $workspaceId;
    }

    $stmtOa = $pdo->prepare($sqlOa . " LIMIT 1");
    $stmtOa->execute($paramsOa);
    $resolvedId = $stmtOa->fetchColumn();
    if (!$resolvedId) {
        return [
            'success' => false,
            'status' => 'access_denied',
            'message' => 'Zalo OA not found or access denied (Multi-tenant guard)'
        ];
    }
    $oaConfigId = $resolvedId; // Use the verified DB PK

    // Check quota (Skip if Development Mode or pre-checked by batchSendZNS)
    if ($mode !== 'development' && $preloadedToken === null) {
        // Only run per-message quota check when NOT in batch mode.
        // batchSendZNS does a single pre-check for the whole batch to avoid N DB queries.
        $quotaCheck = checkQuotaAvailable($pdo, $oaConfigId, 1);
        if (!$quotaCheck['available']) {
            return [
                'success' => false,
                'status' => $quotaCheck['reason'],
                'message' => $quotaCheck['message']
            ];
        }
    }

    // Get access token  use preloaded token from batch caller if available
    if ($preloadedToken !== null) {
        $accessToken = $preloadedToken;
    } else {
        $tokenResult = getAccessToken($pdo, $oaConfigId);
        if (!$tokenResult['success']) {
            return [
                'success' => false,
                'status' => 'auth_failed',
                'message' => $tokenResult['message']
            ];
        }
        $accessToken = $tokenResult['access_token'];
    }

    // Prepare ZNS API request
    $url = 'https://business.openapi.zalo.me/message/template';

    // [FIX] Zalo ZNS tracking_id max length = 50 chars
    $rawTrackingId = $subscriberId ?? ('zns_' . time() . rand(1000, 9999));
    $trackingId = substr((string) $rawTrackingId, 0, 50);

    $payload = [
        'phone' => $normalizedPhone,
        'template_id' => $templateId,
        'template_data' => (object) $templateData,
        'tracking_id' => $trackingId
    ];

    if ($mode === 'development') {
        $payload['mode'] = 'development';
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);           // [FIX] 20s max  prevents worker hang causing infinite 'processing' loop
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);    // [FIX] 10s connect timeout
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'access_token: ' . $accessToken
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    // Log delivery
    $logId = bin2hex(random_bytes(16));
    $status = 'failed';
    $zaloMsgId = null;
    $errorCode = null;
    $errorMessage = null;
    $responseData = []; // Store full data

    if ($http_code === 200 && isset($result['error']) && $result['error'] == 0) {
        $status = 'sent';
        $zaloMsgId = $result['data']['msg_id'] ?? null;
        $responseData = $result['data'] ?? [];

        // Update Quota from Zalo Response (SSOT)
        if (isset($result['data']['quota']['remainingQuota'])) {
            $remaining = (int) $result['data']['quota']['remainingQuota'];
            $daily = (int) ($result['data']['quota']['dailyQuota'] ?? 0);

            // Calculate used
            $used = $daily - $remaining;

            $stmt = $pdo->prepare("
                UPDATE zalo_oa_configs
                SET quota_used_today = ?, daily_quota = ?
                WHERE id = ?
            ");
            $stmt->execute([$used, $daily, $oaConfigId]);
        } else {
            // Fallback: Increment quota manually
            $stmt = $pdo->prepare("
                UPDATE zalo_oa_configs
                SET quota_used_today = quota_used_today + 1
                WHERE id = ?
            ");
            $stmt->execute([$oaConfigId]);
        }
    } else {
        $errorCode = $result['error'] ?? $http_code;
        $errorMessage = $result['message'] ?? 'Unknown error';
        // [FIX] Log rotation: cap zns_error.log at 50MB to prevent disk exhaustion at 10M scale.
        // Rotate before write so we never exceed ~50MB + one entry.
        $logFile = __DIR__ . '/zns_error.log';
        if (file_exists($logFile) && filesize($logFile) > 50 * 1024 * 1024) {
            @rename($logFile, $logFile . '.old');
        }
        file_put_contents(
            $logFile,
            date('Y-m-d H:i:s') . " [API_FAIL]" .
            " HTTP:{$http_code}" .
            " ErrCode:{$errorCode}" .
            " Msg:{$errorMessage}" .
            " Phone:{$normalizedPhone}" .
            " Template:{$templateId}" .
            " SubId:" . ($subscriberId ?? 'NULL') .
            " | Payload:" . json_encode($payload, JSON_UNESCAPED_UNICODE) .
            " | RawResp:{$response}" . "\n",
            FILE_APPEND | LOCK_EX
        );
    }

    // Try to find subscriber if missing (for logging integrity)
    if (!$subscriberId && $normalizedPhone) {
        // Try common formats: +84, 0, 84
        $p1 = $normalizedPhone; // 84...
        $p2 = '0' . substr($normalizedPhone, 2); // 0...
        $p3 = '+' . $normalizedPhone; // +84...

        // Check Zalo Subscribers first (Most likely)
        $stmtChk = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE phone_number IN (?, ?, ?) LIMIT 1");
        $stmtChk->execute([$p1, $p2, $p3]);
        $subscriberId = $stmtChk->fetchColumn();

        if (!$subscriberId) {
            // Check Main Subscribers
            $stmtChk = $pdo->prepare("SELECT id FROM subscribers WHERE phone_number IN (?, ?, ?) LIMIT 1");
            $stmtChk->execute([$p1, $p2, $p3]);
            $subscriberId = $stmtChk->fetchColumn();
        }
    }

    // Insert log ONLY if subscriberId exists (Due to FK Constraint)
    if ($subscriberId) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO zalo_delivery_logs
                (id, flow_id, step_id, subscriber_id, oa_config_id, template_id, phone_number, template_data, status, zalo_msg_id, error_code, error_message, sent_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $logId,
                $flowId,
                $stepId,
                $subscriberId,
                $oaConfigId,
                $templateId,
                $normalizedPhone,
                json_encode($templateData),
                $status,
                $zaloMsgId,
                $errorCode,
                $errorMessage,
                $status === 'sent' ? date('Y-m-d H:i:s') : null
            ]);
        } catch (Exception $e) {
            // Log failed silently to avoid stopping the flow
            error_log("ZNS Logging Failed: " . $e->getMessage());
        }
    }

    return [
        'success' => $status === 'sent',
        'status' => $status,
        'zalo_msg_id' => $zaloMsgId,
        'error_code' => $errorCode,
        'error_message' => $errorMessage,
        'log_id' => $logId,
        'data' => $responseData // Return full data for price info
    ];
}

/**
 * Send ZNS via Zalo User ID (UID)
 * Endpoint: https://openapi.zalo.me/v3.0/oa/message/template
 */
function sendZNSMessageByUID($pdo, $oaId, $templateId, $uid, $templateData, $flowId = null, $stepId = null, $subscriberId = null)
{
    // [SMART-ROUTING] ZNS Templates (Standard) are strictly Phone-Based.
    // If we have the Phone Number for this UID, switch to Phone-Based Sending immediately.
    // This fixes "Template does not support sending by UID" errors.

    $phone = null;

    // 1. Try finding in zalo_subscribers directly
    $stmt = $pdo->prepare("SELECT phone_number, subscriber_id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
    $stmt->execute([$uid]);
    $zSub = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($zSub && !empty($zSub['phone_number'])) {
        $phone = $zSub['phone_number'];
    } elseif ($zSub && !empty($zSub['subscriber_id'])) {
        // 2. Try finding in main subscribers via linkage
        $stmtS = $pdo->prepare("SELECT phone_number FROM subscribers WHERE id = ? LIMIT 1");
        $stmtS->execute([$zSub['subscriber_id']]);
        $subPhone = $stmtS->fetchColumn();
        if ($subPhone)
            $phone = $subPhone;
    }

    // 3. If phone found, Proxy to Standard ZNS Sender
    if ($phone) {
        $finalSubId = $subscriberId ?? ($zSub['subscriber_id'] ?? null);
        $res = sendZNSMessage($pdo, $oaId, $templateId, $phone, $templateData, $flowId, $stepId, $finalSubId);

        // Enrich message with conversion info & price
        if ($res['success']) {
            $price = $res['data']['price'] ?? $res['data']['quota']['price'] ?? 'Standard';
            $res['message'] = "ℹ Auto-switched to Phone ($phone). Cost: $price quota.";
        } else {
            $res['message'] = "⚠ Failed via Phone ($phone): " . ($res['error_message'] ?? 'Unknown');
        }
        return $res;
    }

    // Fallback: Proceed with original UID sending (For Transaction/Promotion templates that might support UID)
    // [BUG-I1 FIX] Check quota before sending via UID path (same as sendZNSMessage)
    $quotaCheck = checkQuotaAvailable($pdo, $oaId, 1);
    if (!$quotaCheck['available']) {
        return [
            'success' => false,
            'status' => $quotaCheck['reason'],
            'message' => $quotaCheck['message']
        ];
    }

    // Get access token
    $tokenResult = getAccessToken($pdo, $oaId);
    if (!$tokenResult['success']) {
        return [
            'success' => false,
            'status' => 'auth_failed',
            'message' => $tokenResult['message']
        ];
    }
    $accessToken = $tokenResult['access_token'];

    $url = 'https://openapi.zalo.me/v3.0/oa/message/template';

    $payload = [
        'user_id' => $uid,
        'template_id' => $templateId,
        'template_data' => $templateData
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'access_token: ' . $accessToken
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    // Logging
    $status = 'failed';
    $errorMsg = null;
    $zaloMsgId = null;
    $errorCode = null;

    if ($http_code === 200 && isset($result['error']) && $result['error'] == 0) {
        $status = 'sent';
        $zaloMsgId = $result['data']['message_id'] ?? null;
    } else {
        $errorCode = $result['error'] ?? $http_code;
        $errorMsg = $result['message'] ?? 'Unknown Error';
    }

    // Insert into logs
    try {
        $logId = bin2hex(random_bytes(16));
        $stmt = $pdo->prepare("
            INSERT INTO zalo_delivery_logs 
            (id, oa_config_id, subscriber_id, status, error_message, zalo_msg_id, created_at, flow_id, step_id, template_id, template_data) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
        ");
        $stmt->execute([
            $logId,
            $oaId,
            $subscriberId,
            $status,
            $errorMsg,
            $zaloMsgId,
            $flowId,
            $stepId,
            $templateId,
            json_encode($templateData)
        ]);
    } catch (Exception $e) { /* Ignore log error */
    }

    return [
        'success' => $status === 'sent',
        'status' => $status,
        'zalo_msg_id' => $zaloMsgId,
        'data' => $result['data'] ?? [],
        'message' => $errorMsg,
        'full_response' => $result
    ];
}

/**
 * Send batch ZNS messages with rate limiting
 * Max 4000 requests per minute
 */
function batchSendZNS($pdo, $oaConfigId, $messages)
{
    $results = [];
    $sent_count = 0;
    $start_time = microtime(true);
    $max_per_minute = 4000;

    // [FIX] Pre-fetch token and quota ONCE before loop.
    // Old behavior: sendZNSMessage called checkQuotaAvailable() + getAccessToken() per message.
    // At 4,000 msg/min that was 12,000—16,000 DB queries just for config lookups.
    // New behavior: 2 DB calls total for the whole batch.
    $quotaCheck = checkQuotaAvailable($pdo, $oaConfigId, count($messages));
    if (!$quotaCheck['available']) {
        return [
            'total' => count($messages),
            'sent' => 0,
            'failed' => count($messages),
            'error' => $quotaCheck['reason'],
            'results' => []
        ];
    }

    $tokenResult = getAccessToken($pdo, $oaConfigId);
    if (!$tokenResult['success']) {
        return [
            'total' => count($messages),
            'sent' => 0,
            'failed' => count($messages),
            'error' => 'auth_failed',
            'results' => []
        ];
    }
    $preloadedToken = $tokenResult['access_token'];

    foreach ($messages as $index => $msg) {
        // Rate limiting: max 4000 per minute
        if ($sent_count > 0 && $sent_count % $max_per_minute === 0) {
            $elapsed = microtime(true) - $start_time;
            if ($elapsed < 60) {
                $sleep_time = (60 - $elapsed) * 1000000; // microseconds
                usleep($sleep_time);
                $start_time = microtime(true);
            }
        }

        $result = sendZNSMessage(
            $pdo,
            $oaConfigId,
            $msg['template_id'],
            $msg['phone_number'],
            $msg['template_data'],
            $msg['flow_id'] ?? null,
            $msg['step_id'] ?? null,
            $msg['subscriber_id'] ?? null,
            null,           // $mode
            $preloadedToken // Skip per-message token DB fetch
        );

        $results[] = array_merge(['index' => $index], $result);

        // [FIX] Circuit breaker: if token is rejected by Zalo API (expired mid-batch),
        // stop immediately instead of burning through all remaining messages.
        if (($result['status'] ?? '') === 'auth_failed') {
            error_log("[batchSendZNS] auth_failed at index $index — aborting batch. OA: $oaConfigId");
            break;
        }

        if ($result['success']) {
            $sent_count++;
        }
    }

    return [
        'total' => count($messages),
        'sent' => $sent_count,
        'failed' => count($messages) - $sent_count,
        'results' => $results
    ];
}

/**
 * Send Consultation Message (Free form text to Follower)
 * Requires Zalo User ID (Not Phone Number)
 */
function sendConsultationMessage($pdo, $oaConfigId, $zaloUserId, $text, $attachment = null, $workspaceId = null)
{
    // [SEC-FIX] VERIFY oaConfigId ownership
    $sqlOa = "SELECT id FROM zalo_oa_configs WHERE (id = ? OR oa_id = ?)";
    $paramsOa = [$oaConfigId, $oaConfigId];

    if ($workspaceId) {
        $sqlOa .= " AND workspace_id = ?";
        $paramsOa[] = $workspaceId;
    }

    $stmtOa = $pdo->prepare($sqlOa . " LIMIT 1");
    $stmtOa->execute($paramsOa);
    $resolvedId = $stmtOa->fetchColumn();
    if (!$resolvedId) {
        return [
            'success' => false,
            'message' => 'Zalo OA not found or access denied (Multi-tenant guard)'
        ];
    }
    $oaConfigId = $resolvedId;

    // Get Token
    $tokenResult = getAccessToken($pdo, $oaConfigId);
    if (!$tokenResult['success']) {
        return [
            'success' => false,
            'message' => $tokenResult['message']
        ];
    }
    $accessToken = $tokenResult['access_token'];

    $url = 'https://openapi.zalo.me/v3.0/oa/message/cs';

    $payload = [
        'recipient' => [
            'user_id' => $zaloUserId
        ],
        'message' => [
            'text' => $text
        ]
    ];

    if ($attachment) {
        $payload['message']['attachment'] = $attachment;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'access_token: ' . $accessToken
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($http_code === 200 && isset($result['error']) && $result['error'] == 0) {
        $msgId = $result['data']['message_id'] ?? null;

        // [CRITICAL] Log for AI Cooldown & Timeline
        try {
            // Find subscriber ID
            $stmtSub = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
            $stmtSub->execute([$zaloUserId]);
            $subId = $stmtSub->fetchColumn();

            if ($subId) {
                require_once 'zalo_helpers.php';
                logZaloMsg($pdo, $zaloUserId, 'outbound', $text);
                logZaloSubscriberActivity($pdo, $subId, 'staff_reply', null, "Tư vấn viên trả lời (Dashboard): $text", "Zalo Dashboard", $msgId);
            }
        } catch (Exception $e) {
            // Log error but don't fail the response
        }

        return [
            'success' => true,
            'zalo_msg_id' => $msgId
        ];
    } else {
        return [
            'success' => false,
            'error_code' => $result['error'] ?? $http_code,
            'message' => $result['message'] ?? 'Unknown Error'
        ];
    }
}
