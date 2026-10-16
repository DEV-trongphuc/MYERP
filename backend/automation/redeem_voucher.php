<?php
// api/redeem_voucher.php
require_once 'bootstrap.php';
initializeSystem($pdo);
require_once 'auth_middleware.php';
require_once 'WorkerTriggerService.php';

// [SECURITY] Require authenticated workspace session
$admin_workspace_id = get_current_workspace_id();
if (empty($admin_workspace_id)) {
    http_response_code(401);
    jsonResponse(false, null, 'Unauthorized');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

$input = json_decode(file_get_contents("php://input"), true) ?: [];
$ids = $input['ids'] ?? [];

$apiUrl = (defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api');
$workerService = new WorkerTriggerService($pdo, $apiUrl);

// --- BATCH REDEMPTION ---
if (!empty($ids) && is_array($ids)) {
    try {
        $pdo->beginTransaction();
        
        // 1. Get subscriber_ids and campaign_ids for valid codes in THIS workspace
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmtFind = $pdo->prepare("
            SELECT vc.id, vc.code, vc.subscriber_id, vc.campaign_id, c.name as campaign_name
            FROM voucher_codes vc 
            JOIN voucher_campaigns c ON vc.campaign_id = c.id
            WHERE vc.id IN ($placeholders) 
              AND c.workspace_id = ?
              AND vc.status = 'unused' 
              AND vc.subscriber_id IS NOT NULL
            FOR UPDATE
        ");
        $stmtFind->execute(array_merge($ids, [$admin_workspace_id]));
        $toRedeem = $stmtFind->fetchAll(PDO::FETCH_ASSOC);

        if (empty($toRedeem)) {
            $pdo->rollBack();
            jsonResponse(false, null, 'Không có mã hợp lệ nào được chọn để gạch.');
        }

        $validIds = array_column($toRedeem, 'id');
        $validPlaceholders = implode(',', array_fill(0, count($validIds), '?'));
        
        // 2. Batch update
        $stmtUpd = $pdo->prepare("UPDATE voucher_codes SET status = 'used', used_at = NOW() WHERE id IN ($validPlaceholders)");
        $stmtUpd->execute($validIds);
        
        $pdo->commit();

        if (!function_exists('logActivity')) {
            @include_once 'flow_helpers.php';
        }
        $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        if (strpos($clientIp, ',') !== false) $clientIp = trim(explode(',', $clientIp)[0]);

        // 3. Log activity, refresh matched contact stats & trigger automations
        foreach ($toRedeem as $row) {
            if (!empty($row['subscriber_id'])) {
                if (function_exists('logActivity')) {
                    logActivity($pdo, $row['subscriber_id'], 'voucher_redeem', $row['campaign_id'], $row['campaign_name'] ?? null, "Sử dụng Voucher: {$row['code']} | IP: $clientIp", null, null, ['campaign_id' => $row['campaign_id'], 'code' => $row['code'], 'ip' => $clientIp], $admin_workspace_id);
                }
                if (function_exists('domationSyncSubscriberMatchOnly')) {
                    domationSyncSubscriberMatchOnly($pdo, $row['subscriber_id']);
                }
                $workerService->trigger('/worker_priority.php?' . http_build_query([
                    'trigger_type' => 'voucher_redeem', 
                    'target_id' => $row['campaign_id'],
                    'subscriber_id' => $row['subscriber_id']
                ]));
            }
        }

        jsonResponse(true, null, 'Gạch mã hàng loạt thành công (' . count($validIds) . ' mã)!');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log("[redeem_voucher] Batch Error: " . $e->getMessage());
        jsonResponse(false, null, 'Lỗi hệ thống khi gạch mã hàng loạt.');
    }
}

// --- SINGLE CODE REDEMPTION ---
$code = trim((string)($input['code'] ?? ''));
// [BUG-FSV-07] Support both campaign_id and voucher_id
$campaignId = $input['campaign_id'] ?? $input['voucher_id'] ?? null;

if (!$code) {
    jsonResponse(false, null, 'Vui lòng nhập mã Voucher');
}

try {
    // 1. Check if it is a static code from an active campaign in THIS workspace
    $stmtStatic = $pdo->prepare("SELECT * FROM voucher_campaigns WHERE static_code = ? AND status = 'active' AND workspace_id = ?");
    $stmtStatic->execute([$code, $admin_workspace_id]);
    $staticCamp = $stmtStatic->fetch(PDO::FETCH_ASSOC);

    if ($staticCamp) {
        if (!empty($staticCamp['end_date']) && strtotime($staticCamp['end_date']) < time()) {
            jsonResponse(false, null, 'Chương trình ưu đãi này đã kết thúc.');
        }
        // Static codes don't have individual tracking in voucher_codes table
        jsonResponse(true, null, 'Áp dụng mã tĩnh thành công!');
    }

    // 2. Find and Lock the dynamic code
    $pdo->beginTransaction();
    
    $sql = "SELECT vc.*, c.name as campaign_name, c.end_date as campaign_end_date 
            FROM voucher_codes vc 
            JOIN voucher_campaigns c ON vc.campaign_id = c.id 
            WHERE vc.code = ? AND c.workspace_id = ? FOR UPDATE";
    $params = [$code, $admin_workspace_id];

    if ($campaignId) {
        $sql .= " AND vc.campaign_id = ?";
        $params[] = $campaignId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $voucher = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$voucher) {
        $pdo->rollBack();
        jsonResponse(false, null, 'Mã Voucher không tồn tại hoặc không hợp lệ.');
    }

    // 3. Validate state
    if ($voucher['status'] === 'used') {
        $pdo->rollBack();
        jsonResponse(false, null, 'Mã Voucher này đã được sử dụng vào ' . date('d/m/Y H:i:s', strtotime($voucher['used_at'])));
    }

    if (!empty($voucher['expires_at']) && strtotime($voucher['expires_at']) < time()) {
        $pdo->rollBack();
        jsonResponse(false, null, 'Mã Voucher này đã hết hạn sử dụng.');
    }

    if (!empty($voucher['campaign_end_date']) && strtotime($voucher['campaign_end_date']) < time()) {
        $pdo->rollBack();
        jsonResponse(false, null, 'Chương trình ưu đãi này đã kết thúc!');
    }

    // 4. Mark as used
    $stmtUpdate = $pdo->prepare("UPDATE voucher_codes SET status = 'used', used_at = NOW() WHERE id = ?");
    $stmtUpdate->execute([$voucher['id']]);
    
    $pdo->commit();

    // 5. [BUG-FSV-07] Log 'voucher_redeem' in subscriber_activity, refresh MYERP.contacts stats, and dispatch Automation Trigger
    $subId = $voucher['subscriber_id'] ?? $voucher['assigned_to_subscriber_id'] ?? null;
    if (!empty($subId)) {
        if (!function_exists('logActivity')) {
            @include_once 'flow_helpers.php';
        }
        $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        if (strpos($clientIp, ',') !== false) $clientIp = trim(explode(',', $clientIp)[0]);
        if (function_exists('logActivity')) {
            logActivity($pdo, $subId, 'voucher_redeem', $voucher['campaign_id'], $voucher['campaign_name'] ?? null, "Sử dụng Voucher: $code | IP: $clientIp", null, null, ['campaign_id' => $voucher['campaign_id'], 'code' => $code, 'ip' => $clientIp], $admin_workspace_id);
        }
        if (function_exists('domationSyncSubscriberMatchOnly')) {
            domationSyncSubscriberMatchOnly($pdo, $subId);
        }
        $workerService->trigger('/worker_priority.php?' . http_build_query([
            'trigger_type' => 'voucher_redeem', 
            'target_id' => $voucher['campaign_id'], 
            'subscriber_id' => $subId
        ]));
    } elseif (!empty($voucher['myerp_contact_id']) && class_exists('DomationContactMatcher')) {
        DomationContactMatcher::refreshContactStats($pdo, (int)$voucher['myerp_contact_id']);
    }

    jsonResponse(true, [
        'message' => 'Sử dụng Voucher thành công!',
        'campaign_name' => $voucher['campaign_name'],
        'code' => $code
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[redeem_voucher] Error: ' . $e->getMessage());
    jsonResponse(false, null, 'Lỗi hệ thống khi xử lý voucher.');
}
