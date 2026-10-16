<?php
// api/approvals.php
require_once 'auth_middleware.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST' && $action === 'request') {
    $input = json_decode(file_get_contents('php://input'), true);
    $target_type = $input['target_type'] ?? ''; // 'campaign' or 'flow'
    $target_id = $input['target_id'] ?? null;
    
    if (!$target_type || !$target_id) {
        jsonResponse(false, null, 'Target type and ID are required');
    }

    $workspace_id = get_current_workspace_id();
    $user_id = $_SESSION['user_id'] ?? $GLOBALS['current_admin_id'];

    if ($target_type === 'campaign') {
        require_permission($pdo, 'edit_campaigns', $workspace_id);
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO approval_requests (workspace_id, target_type, target_id, request_user_id, status) VALUES (?, ?, ?, ?, 'pending')");
        $stmt->execute([$workspace_id, $target_type, $target_id, $user_id]);
        
        // Also update the target's internal status if it exists
        if ($target_type === 'campaign') {
            $pdo->prepare("UPDATE campaigns SET status = 'pending_approval' WHERE id = ? AND workspace_id = ?")->execute([$target_id, $workspace_id]);
        }

        jsonResponse(true, null, 'Approval requested successfully');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'POST' && $action === 'review') {
    $input = json_decode(file_get_contents('php://input'), true);
    $request_id = $input['request_id'] ?? null;
    $status = $input['status'] ?? ''; // 'approved' or 'rejected'
    $reason = $input['reason'] ?? '';

    if (!$request_id || !in_array($status, ['approved', 'rejected'])) {
        jsonResponse(false, null, 'Invalid request parameters');
    }

    $workspace_id = get_current_workspace_id();
    $user_id = $_SESSION['user_id'] ?? $GLOBALS['current_admin_id'];

    // Ensure they have right to approve
    require_permission($pdo, 'approve_campaigns', $workspace_id);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM approval_requests WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$request_id, $workspace_id]);
        $req = $stmt->fetch();

        if (!$req) {
            throw new Exception("Approval request not found");
        }

        // Update the request
        $update = $pdo->prepare("UPDATE approval_requests SET status = ?, reason = ?, approver_id = ? WHERE id = ?");
        $update->execute([$status, $reason, $user_id, $request_id]);

        // Update the target
        if ($req['target_type'] === 'campaign') {
            $newStatus = ($status === 'approved') ? 'ready' : 'draft'; 
            // If approved, maybe 'draft' but the frontend knows it can be scheduled now.
            // Or 'scheduled' if it has a date. We'll set to 'draft'.
            $pdo->prepare("UPDATE campaigns SET status = ? WHERE id = ?")->execute([$newStatus, $req['target_id']]);
        }

        $pdo->commit();
        jsonResponse(true, null, "Request successfully {$status}");

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'GET' && $action === 'list') {
    $workspace_id = get_current_workspace_id();
    require_permission($pdo, 'view_campaigns', $workspace_id);

    try {
        $stmt = $pdo->prepare("
            SELECT a.*, u.full_name as requester_name 
            FROM approval_requests a
            LEFT JOIN users u ON u.id COLLATE utf8mb4_unicode_ci = a.request_user_id COLLATE utf8mb4_unicode_ci
            WHERE a.workspace_id = ? 
            ORDER BY a.created_at DESC
            LIMIT 150
        ");
        $stmt->execute([$workspace_id]);
        jsonResponse(true, $stmt->fetchAll());
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid action');
?>
