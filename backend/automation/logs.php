<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
apiHeaders();

// [SECURITY] Require authenticated workspace session
$_logWorkspaceId = get_current_workspace_id();
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$type = $_GET['type'] ?? 'worker_flow'; // Default to worker_flow for general log
$campaignId = $_GET['campaign_id'] ?? null;
$statusFilter = $_GET['status'] ?? null; // 'success', 'failed'

// --- ROUTE: Delete specific delivery log ---
if (isset($_GET['route']) && $_GET['route'] === 'delete_delivery_log') {
    $logId = $_GET['log_id'] ?? null;
    if (!$logId) {
        jsonResponse(false, null, 'Log ID required for deletion.');
    }
    
    $action = $_GET['action'] ?? null; 
    $subscriberId = $_GET['subscriber_id'] ?? null; // Subscriber ID, not email for direct DB update

    $pdo->beginTransaction();
    try {
        // Delete the delivery log
        $stmtDeleteLog = $pdo->prepare("DELETE FROM mail_delivery_logs WHERE id = ? AND workspace_id = ?");
        $stmtDeleteLog->execute([$logId, $_logWorkspaceId]);
        
        // If action is 'remove_failed', unsubscribe the subscriber
        if ($action === 'remove_failed' && $subscriberId) {
            $stmtUnsubscribe = $pdo->prepare("UPDATE subscribers SET status = 'unsubscribed' WHERE id = ?");
            $stmtUnsubscribe->execute([$subscriberId]);
            // Log this activity, ensuring flow_id and campaign_id are handled as null if not applicable
            if (function_exists('logActivity')) {
                logActivity($pdo, $subscriberId, 'unsubscribe', null, 'Campaign Delivery Action', "Unsubscribed due to failed email delivery log deletion", null, $campaignId);
            }
        }

        $pdo->commit();
        jsonResponse(true, ['id' => $logId], 'Delivery log deleted successfully.');
    } catch (PDOException $e) { // FIX: Catch PDOException
        $pdo->rollBack();
        error_log("Database Error in delete_delivery_log: " . $e->getMessage()); // Log to PHP error log
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("General Error in delete_delivery_log: " . $e->getMessage()); // Log to PHP error log
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- ROUTE: Fetch logs ---
if ($type === 'delivery') {
    $sql = "SELECT id, recipient, subject, status, error_message, sent_at FROM mail_delivery_logs WHERE workspace_id = ?";
    $params = [$_logWorkspaceId];

    // FIX: The campaign_id column is assumed to exist after db.txt migration
    if ($campaignId) {
        $sql .= " AND campaign_id = ?";
        $params[] = $campaignId;
    }

    if ($statusFilter && in_array($statusFilter, ['success', 'failed'])) {
        $sql .= " AND status = ?";
        $params[] = $statusFilter;
    }
    
    $sql .= " ORDER BY sent_at DESC LIMIT 100"; // Limit to 100 recent logs for performance
    
    try { // FIX: Add try-catch for fetching delivery logs
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(true, $stmt->fetchAll());
    } catch (PDOException $e) {
        error_log("Database Error fetching delivery logs: " . $e->getMessage()); // Log to PHP error log
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    } catch (Exception $e) {
        error_log("General Error fetching delivery logs: " . $e->getMessage()); // Log to PHP error log
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }

} else {
    // [SECURITY FIX] Whitelist allowed log types to prevent Path Traversal attacks.
    $allowedLogs = [
        'worker_flow', 'worker_campaign', 'worker_enroll', 'worker_integrations',
        'worker_maintenance', 'worker_notify', 'worker_priority', 'worker_queue',
        'worker_reminder', 'worker_sync', 'worker_trigger', 'webhook', 'zalo_debug',
        'meta_debug', 'mail_debug', 'tracking', 'training_debug'
    ];

    if (!in_array($type, $allowedLogs)) {
        jsonResponse(false, null, 'Invalid log type');
    }

    // Original worker log file logic
    $logFile = __DIR__ . '/' . $type . '.log';
    if (file_exists($logFile)) {
        $content = file_get_contents($logFile);
        if (strlen($content) > 50000) $content = "...\n" . substr($content, -50000);
        jsonResponse(true, ['content' => $content]);
    } else {
        jsonResponse(true, ['content' => ucfirst(str_replace('_', ' ', $type)) . ' log file not found.']);
    }
}
?>
