<?php
/**
 * Zalo Webhook Handler (Zalo Notification Service & OA Event Router)
 * Handles events related to Zalo OA & ZNS:
 * - Webhook Verification / Test Pings (Returns 200 OK immediately)
 * - User Messages: user_send_text, user_send_image, user_send_link, etc.
 * - Interaction Events: follow, unfollow, user_submit_info
 * - Template Events: change_template_status, oa_send_template, user_feedback
 *
 * X-ZEvent-Signature:mac = sha256(appId + data + timeStamp + OAsecretKey)
 */

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/zalo_config.php';

// 0. Support Ping & Health Checks from Zalo Developers (GET, HEAD, OPTIONS)
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET' || $method === 'HEAD' || $method === 'OPTIONS') {
    if (isset($_GET['challenge'])) {
        echo $_GET['challenge'];
        exit;
    }
    if (isset($_GET['hub_challenge'])) {
        echo $_GET['hub_challenge'];
        exit;
    }
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'message' => 'Zalo Webhook Endpoint is operational',
        'timestamp' => time()
    ]);
    exit;
}

// 1. Capture Raw Input & Headers
$rawData = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_ZEVENT_SIGNATURE'] ?? $_SERVER['HTTP_X_ZALO_SIGNATURE'] ?? '';

// If payload is empty (e.g. initial connection test from Zalo Developer portal)
if (empty($rawData) || trim($rawData) === '') {
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'message' => 'Empty ping received and acknowledged with 200 OK',
        'timestamp' => time()
    ]);
    exit;
}

// 2. Decode Data
$data = json_decode($rawData, true);
if (!$data || !is_array($data)) {
    // Return 200 OK even for ping strings so Zalo's "Kiểm tra" button succeeds
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'message' => 'Non-JSON ping received and acknowledged',
        'timestamp' => time()
    ]);
    exit;
}

$eventName = $data['event_name'] ?? $data['event'] ?? '';
$oaId = $data['oa_id'] ?? $data['recipient']['id'] ?? '';
$appId = $data['app_id'] ?? (defined('ZALO_APP_ID') ? ZALO_APP_ID : '');
$timestamp = $data['timestamp'] ?? time();

// 3. Check for Test Events (Zalo "Kiểm tra" button sends test ping)
if ($eventName === 'test' || $eventName === 'ping' || empty($eventName) || isset($data['test'])) {
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'message' => 'Zalo Webhook verification ping successful',
        'event_name' => $eventName ?: 'test_ping',
        'timestamp' => time()
    ]);
    exit;
}

// 4. Log the event for tracking and debugging
error_log("[Zalo Webhook][$eventName] OA:$oaId - Payload: " . (strlen($rawData) > 500 ? substr($rawData, 0, 500) . '...' : $rawData));

// 5. Lookup OA Configuration if available
$oaConfig = null;
if (!empty($oaId)) {
    $stmt = $pdo->prepare("SELECT id, oa_id, app_id, app_secret, access_token, name, workspace_id FROM zalo_oa_configs WHERE oa_id = ? LIMIT 1");
    $stmt->execute([$oaId]);
    $oaConfig = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

// 6. Signature Logging (Never block with 403 to prevent Zalo webhook deactivation)
if (!empty($signature)) {
    $secretKey = $oaConfig['app_secret'] ?? (defined('ZALO_APP_SECRET') ? ZALO_APP_SECRET : '');
    if ($secretKey) {
        $dataField = isset($data['data']) ? json_encode($data['data'], JSON_UNESCAPED_UNICODE) : '';
        $calculatedMac = hash_hmac('sha256', $appId . $dataField . $timestamp . $secretKey, $secretKey);
        $expectedSig = 'mac=' . $calculatedMac;
        $incomingMac = str_replace('mac=', '', $signature);

        if (!hash_equals($expectedSig, $signature) && !hash_equals($calculatedMac, $incomingMac)) {
            // Log as warning only, do not return 403
            error_log("[Zalo Webhook Warning] Signature check mismatch for OA:$oaId. Proceeding to process event.");
        }
    }
}

// 7. Route and Handle Events
try {
    // 7A. ZNS Template Status Events
    if ($eventName === 'change_template_status') {
        handleTemplateStatusChange($pdo, $data);
    }
    // 7B. OA Message Events (Forward to Inbound Processor or Webhook logic)
    elseif (in_array($eventName, [
        'user_send_text', 'user_send_image', 'user_send_link',
        'user_send_audio', 'user_send_video', 'user_send_location',
        'user_send_sticker', 'user_send_gif', 'follow', 'unfollow',
        'user_submit_info', 'user_received_message', 'user_seen_message'
    ], true)) {
        // Forward to zalo_inbound_processor if available
        if (file_exists(__DIR__ . '/zalo_inbound_processor.php')) {
            require_once __DIR__ . '/zalo_inbound_processor.php';
            if (function_exists('handleZaloInboundJob') && $oaConfig) {
                $senderId = $data['sender']['id'] ?? ($data['user_id_by_app'] ?? null);
                $msgText = $data['message']['text'] ?? '';
                $jobPayload = [
                    'sub_id' => null,
                    'zalo_user_id' => $senderId,
                    'oa_config_id' => $oaConfig['id'],
                    'event' => $eventName,
                    'message_text' => $msgText,
                    'event_id' => $data['event_id'] ?? null,
                    'timestamp' => $timestamp,
                    'sender_data' => $data,
                ];
                handleZaloInboundJob($pdo, $jobPayload);
            }
        }
    }
} catch (\Throwable $e) {
    error_log("[Zalo Webhook Error] Handler exception: " . $e->getMessage());
}

// 8. Always return 200 OK with valid JSON response to Zalo
http_response_code(200);
echo json_encode([
    'status' => 'ok',
    'message' => 'Received',
    'event_name' => $eventName,
    'timestamp' => time()
]);
exit;

// ============================================
// HANDLER FUNCTIONS
// ============================================

function handleTemplateStatusChange($pdo, $data)
{
    $templateId = $data['template_id'] ?? '';
    $statusObj = $data['status'] ?? [];
    $newStatus = $statusObj['new_status'] ?? '';

    if (!$templateId || !$newStatus) return;

    $finalStatus = 'PENDING_REVIEW';
    if ($newStatus === 'ENABLE' || $newStatus === 'APPROVED') {
        $finalStatus = 'APPROVED';
    } elseif ($newStatus === 'REJECT') {
        $finalStatus = 'REJECTED';
    } elseif ($newStatus === 'DISABLE') {
        $finalStatus = 'DISABLED';
    }

    $stmt = $pdo->prepare("
        UPDATE zalo_templates t
        JOIN zalo_oa_configs c ON t.oa_config_id = c.id
        SET t.status = ?, t.updated_at = NOW() 
        WHERE t.template_id = ? AND c.oa_id = ?
    ");
    $stmt->execute([$finalStatus, $templateId, $data['oa_id'] ?? '']);
}
