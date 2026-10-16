<?php
// api/voucher_claim.php
require_once 'db_connect.php';
require_once 'flow_helpers.php';
require_once 'voucher_helper.php';

/** @var \PDO $pdo */

$method = $_SERVER['REQUEST_METHOD'];

// Accept GET or POST (JSON or Application/X-WWW-FORM-URLENCODED)
$data = [];
if ($method === 'POST') {
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);
    if (!$data) $data = $_POST;
} else if ($method === 'GET') {
    $data = $_GET;
}

$campaignId = trim((string)($data['campaign_id'] ?? $data['voucher_id'] ?? $_GET['id'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$phone = trim((string)($data['phone'] ?? $data['phone_number'] ?? ''));
$eventName = trim((string)($data['event'] ?? 'voucher_claimed'));

$redirectSuccess = trim((string)($data['redirect_success'] ?? ''));
$redirectEmpty = trim((string)($data['redirect_empty'] ?? ''));

// [BUG-FSV-05] Support GET action=info returning campaign details by id
if ($method === 'GET' && (($_GET['action'] ?? '') === 'info')) {
    $infoId = trim((string)($_GET['id'] ?? $_GET['campaign_id'] ?? $_GET['voucher_id'] ?? ''));
    if (!$infoId) {
        jsonResponse(false, null, 'Thiếu ID chiến dịch voucher', [], 400);
    }
    $stmtInfo = $pdo->prepare("SELECT id, name, description, thumbnail_url, rewards, code_type, start_date, end_date, expiration_days, is_claimable, claim_approval_required, claim_target_form_id, status FROM voucher_campaigns WHERE id = ? LIMIT 1");
    $stmtInfo->execute([$infoId]);
    $campInfo = $stmtInfo->fetch(PDO::FETCH_ASSOC);
    if (!$campInfo) {
        jsonResponse(false, null, 'Không tìm thấy chiến dịch voucher', [], 404);
    }
    $campInfo['rewards'] = json_decode($campInfo['rewards'] ?? '[]', true) ?: [];
    jsonResponse(true, $campInfo);
}

$isAjax = (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) 
          || (!empty($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false)
          || (isset($_GET['ajax']) && $_GET['ajax'] == '1');

function sanitizeRedirectUrl($url) {
    $url = trim((string)$url);
    if ($url === '') return '';
    // [SEC-07] Restrict redirect URLs strictly to http:// or https://
    if (!preg_match('#^https?://#i', $url)) {
        return '';
    }
    return $url;
}

function doResponse($isAjax, $success, $message, $httpRedirect, $extraData = []) {
    $safeRedirect = sanitizeRedirectUrl($httpRedirect);
    if ($isAjax) {
        $extraData['success'] = $success;
        $extraData['message'] = $message;
        $extraData['redirect'] = $safeRedirect;
        if (!function_exists('apiHeaders')) {
            function apiHeaders() {
                header('Content-Type: application/json; charset=utf-8');
            }
        }
        apiHeaders();
        echo json_encode($extraData, JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        if ($safeRedirect !== '') {
            header("Location: " . $safeRedirect);
            exit;
        } else {
            // Fallback display with Premium Orange Theme
            header("Content-Type: text/html; charset=UTF-8");
            $isSuccess = (bool)$success;
            $accentColor = $isSuccess ? '#f97316' : '#ef4444';
            $icon = $isSuccess 
                ? '<svg style="width:40px;height:40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                : '<svg style="width:40px;height:40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
            $safeMessage = htmlspecialchars((string)$message, ENT_QUOTES, 'UTF-8');
            echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Voucher System</title><style>
            body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0;padding:20px;box-sizing:border-box;} 
            .card{background:#fff;padding:3rem 2rem;border-radius:24px;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);text-align:center;max-width:400px;width:100%;box-sizing:border-box;} 
            h2{color:#0f172a;margin-top:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.025em;line-height:1.3;} 
            .icon-box{width:80px;height:80px;background:'.($isSuccess?'#fff7ed':'#fef2f2').';border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;color:'.$accentColor.';}
            .btn{display:inline-block;margin-top:1.5rem;background:'.$accentColor.';color:white;text-decoration:none;padding:1rem 2rem;border-radius:16px;font-weight:800;font-size:1rem;transition:all 0.2s;}
            .btn:hover{transform:translateY(-1px);box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);}
            </style></head><body><div class="card"><div class="icon-box">'.$icon.'</div><h2>' . $safeMessage . '</h2><a href="javascript:history.back()" class="btn">Quay lại</a></div></body></html>';
            exit;
        }
    }
}

if (!$campaignId) {
    doResponse($isAjax, false, "Thiếu tham số chiến dịch (campaign_id)", $redirectEmpty);
}

if (!$email && !$phone) {
    doResponse($isAjax, false, "Cần cung cấp Email hoặc Số điện thoại để nhận mã", $redirectEmpty);
}

// [SEC] Rate Limiting by IP
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (strpos($clientIp, ',') !== false) $clientIp = trim(explode(',', $clientIp)[0]);

$ipHash = hash('sha256', $clientIp);
$rateLimitStmt = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity WHERE details LIKE ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)");
$rateLimitStmt->execute(['%IP: ' . $clientIp . '%']);
if ((int)$rateLimitStmt->fetchColumn() >= 10) {
    doResponse($isAjax, false, "Bạn đã thực hiện quá nhiều yêu cầu, vui lòng thử lại sau.", $redirectEmpty);
}

// 2. Check Campaign
$stmtCamp = $pdo->prepare("SELECT * FROM voucher_campaigns WHERE id = ? AND status = 'active'");
$stmtCamp->execute([$campaignId]);
$camp = $stmtCamp->fetch(PDO::FETCH_ASSOC);

if (!$camp) {
    doResponse($isAjax, false, "Chiến dịch không tồn tại hoặc đã bị tắt.", $redirectEmpty);
}

// Check Date
if (!empty($camp['end_date']) && strtotime($camp['end_date']) < time()) {
    doResponse($isAjax, false, "Chiến dịch đã kết thúc.", $redirectEmpty);
}

// 1. Identity / Upsert Subscriber
$lockTarget = $email ? "sub_email_" . md5($email) : "sub_phone_" . md5($phone);
if (!db_get_lock($pdo, $lockTarget, 5)) {
    doResponse($isAjax, false, "Hệ thống đang bận, vui lòng thử lại.", $redirectEmpty);
}

try {
    $sid = null;
    if ($email) {
        $stmtCheck = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? AND workspace_id = ? LIMIT 1");
        $stmtCheck->execute([$email, $camp['workspace_id']]);
        $sid = $stmtCheck->fetchColumn();
    } 
    if (!$sid && $phone) {
        $normPhone9 = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($phone) : preg_replace('/[^0-9]/', '', $phone);
        if ($normPhone9 !== '') {
            $stmtCheck = $pdo->prepare("SELECT id FROM subscribers WHERE phone_number LIKE ? AND workspace_id = ? LIMIT 1");
            $stmtCheck->execute(['%' . $normPhone9, $camp['workspace_id']]);
            $sid = $stmtCheck->fetchColumn();
        }
        if (!$sid) {
            $stmtCheck = $pdo->prepare("SELECT id FROM subscribers WHERE phone_number = ? AND workspace_id = ? LIMIT 1");
            $stmtCheck->execute([$phone, $camp['workspace_id']]);
            $sid = $stmtCheck->fetchColumn();
        }
    }

    if (!$sid) {
        // Create new
        $sid = bin2hex(random_bytes(16));
        $effectiveEmail = $email ?: (preg_replace('/[^0-9]/', '', $phone) . '@no-email.domation');
        $upsertFields = [
            'id' => $sid, 
            'email' => $effectiveEmail,
            'status' => 'active', 
            'source' => 'Voucher Claim: ' . $campaignId, 
            'workspace_id' => $camp['workspace_id']
        ];
        
        if ($phone) { $upsertFields['phone_number'] = $phone; }
        
        // [BUG-FSV-05] Accept both first_name and name
        $first = trim((string)($data['first_name'] ?? $data['name'] ?? ''));
        $last = trim((string)($data['last_name'] ?? ''));
        if ($first || $last) {
            $upsertFields['first_name'] = trim($first . ' ' . $last);
        }
        
        $cols = implode(', ', array_keys($upsertFields));
        $ph = implode(', ', array_fill(0, count($upsertFields), '?'));
        
        $pdo->prepare("INSERT INTO subscribers ($cols) VALUES ($ph) ON DUPLICATE KEY UPDATE status = 'active'")
            ->execute(array_values($upsertFields));

        // Add to Target List if configured (explicitly set workspace_id for isolation and update counts idempotently)
        if (!empty($camp['claim_target_list_id'])) {
            $stmtListIns = $pdo->prepare("INSERT IGNORE INTO subscriber_lists (subscriber_id, list_id, workspace_id) VALUES (?, ?, ?)");
            $stmtListIns->execute([$sid, $camp['claim_target_list_id'], $camp['workspace_id']]);
            if ($stmtListIns->rowCount() > 0) {
                $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")
                    ->execute([$camp['claim_target_list_id'], $camp['workspace_id'], $camp['claim_target_list_id'], $camp['workspace_id']]);
            }
        }
    }

    // [MATCH-ONLY ("3 KHÔNG")] Match subscriber with MYERP.contacts without creating new contacts or notifications
    if ($sid && function_exists('domationSyncSubscriberMatchOnly')) {
        domationSyncSubscriberMatchOnly($pdo, $sid);
    }

    db_release_lock($pdo, $lockTarget);

    // 3. Atomic Claim via Helper
    $claimRes = claimVoucherAtomic($pdo, $campaignId, $sid, null, 'api', $campaignId, $eventName);
    
    if (!$claimRes['success']) {
        doResponse($isAjax, false, $claimRes['message'], $redirectEmpty);
    }

    $codeAssigned = $claimRes['code'];

    // Custom success redirect processing
    $finalRedirect = sanitizeRedirectUrl($redirectSuccess);
    if ($finalRedirect !== '') {
        $sep = (strpos($finalRedirect, '?') === false) ? '?' : '&';
        $finalRedirect .= $sep . 'voucher=' . urlencode($codeAssigned);
    }

    doResponse($isAjax, true, "Lấy mã thành công! Mã của bạn là: " . $codeAssigned, $finalRedirect, [
        'code' => $codeAssigned,
        'event_triggered' => $eventName
    ]);

} catch (Exception $e) {
    db_release_lock($pdo, $lockTarget);
    error_log("Voucher Claim API Error: " . $e->getMessage());
    doResponse($isAjax, false, "Lỗi hệ thống khi xử lý hồ sơ.", $redirectEmpty);
}
