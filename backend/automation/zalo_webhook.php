<?php
/**
 * Zalo Webhook Handler (Zalo Notification Service)
 * Handles events related to ZNS Templates: status changes, user feedback, etc.
 *
 * X-ZEvent-Signature:mac = sha256(appId + data + timeStamp + OAsecretKey)
 */

require_once 'db_connect.php';
require_once 'zalo_config.php';

// 1. Capture Raw Input
$rawData = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_ZEVENT_SIGNATURE'] ?? '';

// 2. Decode Data (for access to app_id, oa_id to find key)
$data = json_decode($rawData, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$eventName = $data['event_name'] ?? '';
$oaId = $data['oa_id'] ?? '';
$appId = $data['app_id'] ?? '';
$timestamp = $data['timestamp'] ?? '';

// 3. Security Check (Signature Verification)
// Note: In a real multi-tenant system, we need to find the specific OA Secret Key based on $oaId.
// For now, we try to use the globally defined secret or fetch from DB.

// Attempt to find OA config
$stmt = $pdo->prepare("SELECT app_id, app_secret FROM zalo_oa_configs WHERE oa_id = ?");
$stmt->execute([$oaId]);
$oaConfig = $stmt->fetch(PDO::FETCH_ASSOC);

$secretKey = '';
if ($oaConfig) {
    $secretKey = $oaConfig['app_secret'];
} elseif (defined('ZALO_APP_SECRET')) {
    $secretKey = ZALO_APP_SECRET;
}

// Reconstruct & VERIFY signature: sha256(appId + data['data'] + timestamp + secretKey)
// Zalo docs: X-ZEvent-Signature = "mac=" + sha256(appId + json(data.data) + timestamp + secretKey)
if ($secretKey) {
    $dataField = isset($data['data']) ? json_encode($data['data'], JSON_UNESCAPED_UNICODE) : '';
    $calculatedMac = hash_hmac('sha256', $appId . $dataField . $timestamp . $secretKey, $secretKey);
    $expectedSig = 'mac=' . $calculatedMac;

    // Also support format without 'mac=' prefix
    $incomingMac = str_replace('mac=', '', $signature);
    $calculatedRaw = hash('sha256', $appId . $dataField . $timestamp . $secretKey);

    if (!hash_equals($expectedSig, $signature) && !hash_equals($calculatedRaw, $incomingMac)) {
        error_log("[Zalo Webhook] INVALID SIGNATURE for OA:$oaId. Got: $signature");
        http_response_code(403);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
} else {
    // [FIX AUDIT-15] Strictly block if no secretKey configured
    error_log("[Zalo Webhook] ERROR: No secretKey found for OA:$oaId. Access Denied.");
    http_response_code(403);
    echo json_encode(['error' => 'OA not configured']);
    exit;
}

// 4. Log the event (Crucial for debugging and audit)
logWebhook($pdo, $eventName, $rawData, $oaId);

// 5. Handle Specific Events
/*
Supported Events:
- change_template_status: Update template status in DB
- oa_send_template: Log sent history (optional, if tracking delivery)
- user_feedback: Log feedback
*/

switch ($eventName) {
    case 'change_template_status':
        handleTemplateStatusChange($pdo, $data);
        break;

    case 'oa_send_template':
        // Handle delivery reports if needed
        break;

    default:
        // Just log (already done)
        break;
}

// Always return 200 OK to Zalo
http_response_code(200);
echo json_encode(['message' => 'Received']);

// ============================================
// HANDLERS
// ============================================

function handleTemplateStatusChange($pdo, $data)
{
    $templateId = $data['template_id'] ?? '';
    $statusObj = $data['status'] ?? [];
    $newStatus = $statusObj['new_status'] ?? '';
    // $reason = $data['reason'] ?? '';

    if (!$templateId || !$newStatus)
        return;

    // Normalize status
    $finalStatus = 'PENDING_REVIEW';
    if ($newStatus == 'ENABLE' || $newStatus == 'APPROVED')
        $finalStatus = 'APPROVED';
    elseif ($newStatus == 'REJECT')
        $finalStatus = 'REJECTED';
    elseif ($newStatus == 'DISABLE')
        $finalStatus = 'DISABLED';

    // Update DB
    // [FIX] Scope by both template_id AND oa_id (from webhook) to prevent accidental 
    // cross-OA status updates if template IDs are reused across different apps.
    $stmt = $pdo->prepare("
        UPDATE zalo_templates t
        JOIN zalo_oa_configs c ON t.oa_config_id = c.id
        SET t.status = ?, t.updated_at = NOW() 
        WHERE t.template_id = ? AND c.oa_id = ?
    ");
    $stmt->execute([$finalStatus, $templateId, $data['oa_id'] ?? '']);
}

function logWebhook($pdo, $event, $payload, $oaId)
{
    // Ensure table exists or just dump to a file/generic log table
    // For now, let's assuming we might want a simple log table or just rely on file logging
    error_log("[Zalo Webhook][$event] OA:$oaId - Payload: $payload");
}
