<?php
/**
 * Meta Messenger Helper Functions
 * Only Meta-specific helpers (common functions are in db_connect.php)
 */

/**
 * Set Standard API Headers (CORS)
 */
function metaApiHeaders()
{

    header('Content-Type: application/json');

}

/**
 * Get JSON Input from Request Body
 */
function getJsonInput()
{
    $input = json_decode(file_get_contents('php://input'), true);
    return $input ?? [];
}

/**
 * Generate a random Verify Token if not provided
 */
function generateVerifyToken()
{
    return bin2hex(random_bytes(32));
}

/**
 * Call Meta Graph API
 */
function callMetaApi($url, $method = 'GET', $data = [])
{
    $ch = curl_init();
    $params = '';

    if ($method === 'GET' && !empty($data)) {
        $params = '?' . http_build_query($data);
    }

    curl_setopt($ch, CURLOPT_URL, $url . $params);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P36-MH] hostname verification
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);        // [FIX P36-MH] prevent infinite hang on slow Meta API
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        error_log('Curl Error: ' . curl_error($ch));
        return ['error' => curl_error($ch)];
    }

    curl_close($ch);

    return json_decode($response, true);
}

/**
 * Fetch Meta User Profile
 */
function fetchMetaUserProfile($psid, $pageAccessToken)
{
    // According to docs: name, first_name, last_name, profile_pic don't need extra permissions
    // locale, timezone, gender NEED specific pages_user_... permissions
    $fields = "id,name,first_name,last_name,profile_pic,locale,timezone,gender,link";
    $res = callMetaApi("https://graph.facebook.com/v24.0/$psid", 'GET', [
        'fields' => $fields,
        'access_token' => $pageAccessToken
    ]);

    if ($res && !isset($res['error'])) {
        return [
            'first_name' => $res['first_name'] ?? '',
            'last_name' => $res['last_name'] ?? '',
            'profile_pic' => $res['profile_pic'] ?? '',
            'locale' => $res['locale'] ?? 'vi_VN',
            'timezone' => $res['timezone'] ?? 7,
            'gender' => $res['gender'] ?? 'unknown',
            'name' => $res['name'] ?? (($res['first_name'] ?? '') . ' ' . ($res['last_name'] ?? '')),
            'profile_link' => $res['link'] ?? ''
        ];
    }

    if (isset($res['error'])) {
        $errorCode = $res['error']['code'] ?? 0;
        $errorSubcode = $res['error']['error_subcode'] ?? 0;
        $msg = $res['error']['message'] ?? 'Unknown Error';

        if ($errorCode == 2018218) {
            $msg = "Tài khoản đăng ký bằng SĐT (Không có trang cá nhân)";
        }

        error_log("Meta API Error [$errorCode]: $msg for PSID $psid");
        return ['error' => $msg, 'code' => $errorCode];
    }

    return null;
}

/**
 * Log Customer Journey Event
 */
function logMetaJourney($pdo, $pageId, $psid, $eventType, $eventName, $eventData = [])
{
    try {
        $stmt = $pdo->prepare("INSERT INTO meta_customer_journey 
                              (page_id, psid, event_type, event_name, event_data, created_at)
                              VALUES (?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            $pageId,
            $psid,
            $eventType,
            $eventName,
            json_encode($eventData)
        ]);
    } catch (Exception $e) {
        error_log("Failed to log journey: " . $e->getMessage());
    }
}
/**
 * Update Conversation State
 */
function updateConversationState($pdo, $pageId, $psid, $lastMessage, $timestamp)
{
    try {
        if (is_numeric($timestamp)) {
            if ($timestamp > 20000000000)
                $timestamp = $timestamp / 1000;
            $ts = date('Y-m-d H:i:s', $timestamp);
        } else {
            $ts = $timestamp;
        }

        $pdo->prepare("UPDATE meta_subscribers SET last_active_at = ? WHERE page_id = ? AND psid = ?")->execute([$ts, $pageId, $psid]);
    } catch (Exception $e) {
        error_log("Error in updateConversationState: " . $e->getMessage());
    }
}
?>
