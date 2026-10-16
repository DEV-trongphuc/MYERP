<?php
/**
 * PUBLIC API for OTP Generation and Verification
 * Usage: curl -X POST https://yourdomain.com/api/otp.php -d '{"action":"generate", "profile_id":"otp_xxx", "receiver_email":"xxx"}'
 */

require_once 'config.php';
require_once 'Mailer.php';

header('Content-Type: application/json');
// [FIX H-03] Removed CORS wildcard * — db_connect.php (via config.php) handles CORS correctly
// with origin reflection. Wildcard here was overriding it and conflicting with Allow-Credentials: true.

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['action'])) {
    echo json_encode(['success' => false, 'error' => 'Missing action']);
    exit;
}

$action = $input['action'];

// -------------------------------------------------------------
// ACTION: GENERATE
// -------------------------------------------------------------
if ($action === 'generate') {
    $profileId = $input['profile_id'] ?? '';
    $email = $input['receiver_email'] ?? '';

    if (!$profileId || !$email) {
        echo json_encode(['success' => false, 'error' => 'Require profile_id and receiver_email']);
        exit;
    }

    // Fetch Profile
    $stmt = $pdo->prepare("SELECT * FROM otp_profiles WHERE id = ?");
    $stmt->execute([$profileId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        echo json_encode(['success' => false, 'error' => 'Profile not found']);
        exit;
    }

    // Rate Limiting Check (60 seconds cooldown)
    $stmtRL = $pdo->prepare("SELECT created_at FROM otp_codes WHERE profile_id = ? AND receiver_email = ? ORDER BY created_at DESC LIMIT 1");
    $stmtRL->execute([$profileId, $email]);
    $lastTime = $stmtRL->fetchColumn();

    if ($lastTime && time() - strtotime($lastTime) < 60) {
        echo json_encode(['success' => false, 'error' => 'Vui lòng đợi 60 giây trước khi yêu cầu lại.']);
        exit;
    }

    // Generate Code
    $length = (int)$profile['token_length'];
    $type = $profile['token_type'];
    $code = '';
    
    if ($type === 'numeric') {
        // [FIX C-03] Use random_int() (CSPRNG) instead of rand() (non-secure Mersenne Twister)
        for ($i = 0; $i < $length; $i++) $code .= (string)random_int(0, 9);
    } else if ($type === 'alpha') {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for ($i = 0; $i < $length; $i++) $code .= $chars[random_int(0, strlen($chars)-1)];
    } else {
        $chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for ($i = 0; $i < $length; $i++) $code .= $chars[random_int(0, strlen($chars)-1)];
    }

    $ttl = (int)$profile['ttl_minutes'];
    $expiresAt = date('Y-m-d H:i:s', strtotime("+$ttl minutes"));
    $codeId = uniqid('otpc_');
    
    // Check if there's already an active code to invalidate it (optional security step)
    $stmt = $pdo->prepare("UPDATE otp_codes SET status = 'expired' WHERE profile_id = ? AND receiver_email = ? AND status = 'pending'");
    $stmt->execute([$profileId, $email]);

    // Insert new pending token
    // [FIX M-01] Hash OTP before storing — column name 'code_hash' now correctly stores a hash.
    // Prevents plaintext OTP exposure if database is breached.
    $codeHash = hash('sha256', $code);
    $stmtInsert = $pdo->prepare("INSERT INTO otp_codes (id, profile_id, receiver_email, code_hash, status, expires_at) VALUES (?, ?, ?, ?, 'pending', ?)");
    $stmtInsert->execute([$codeId, $profileId, $email, $codeHash, $expiresAt]);

    // Send Email
    $subject = 'Mã xác nhận OTP của bạn';
    $html = '';

    if ($profile['email_template_id']) {
        $tsStmt = $pdo->prepare("SELECT subject, html_content FROM templates WHERE id = ?");
        $tsStmt->execute([$profile['email_template_id']]);
        $template = $tsStmt->fetch(PDO::FETCH_ASSOC);

        if ($template && trim($template['html_content'])) {
            // Simply replace [short_code] with $code to preserve the exact UI/UX
            // styles designed in the EmailBuilder OTP block (which already applies 
            // letter-spacing, font-size, colors, and paddings).
            $html = str_replace(['[short_code]', '{{short_code}}'], $code, $template['html_content']);
            $subject = str_replace(['[short_code]', '{{short_code}}'], $code, $template['subject'] ?? 'Mã xác nhận OTP của bạn');

            // Failsafe: If user forgot to add the OTP block, the email would be useless. 
            // We append the code at the bottom as a fallback.
            if (strpos($html, $code) === false) {
                $fallbackHtml = "<div style='text-align:center; padding: 20px; background: #f8fafc; margin-top: 20px; border-top: 2px dashed #e2e8f0; font-family: sans-serif;'><p style='color: #64748b; font-size: 14px; margin-bottom: 8px;'>Mã xác thực của bạn là:</p><strong style='font-size:32px; letter-spacing: 8px; color:#166534;'>$code</strong></div>";
                if (strpos($html, '</body>') !== false) {
                    $html = str_replace('</body>', $fallbackHtml . '</body>', $html);
                } else {
                    $html .= $fallbackHtml;
                }
            }
        }
    }

    if (!$html) {
        $subject = "Mã xác thực OTP: $code";
        $html = "
        <div style='font-family: Inter, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 50px 20px;'>
            <div style='max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px 32px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9;'>
                <h2 style='color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700;'>Mã xác thực của bạn</h2>
                <p style='color: #64748b; font-size: 15px; margin-bottom: 32px; line-height: 1.5;'>
                    Bạn đang yêu cầu một tác vụ cần xác thực. Vui lòng sử dụng mã dưới đây để tiếp tục:
                </p>
                <div style='background-color: #f0fdf4; border: 1px dashed #86efac; border-radius: 12px; padding: 24px; margin-bottom: 32px;'>
                    <span style='font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #166534; display: inline-block; transform: translateX(6px);'>$code</span>
                </div>
                <p style='color: #94a3b8; font-size: 13px; margin-bottom: 0; line-height: 1.6;'>
                    Mã này có hiệu lực trong <b>$ttl phút</b>.<br>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
                </p>
            </div>
        </div>
        ";
    }

    $workspaceId = isset($profile['workspace_id']) ? (int)$profile['workspace_id'] : 0;
    $mailer = new Mailer($pdo, API_BASE_URL, 'marketing@ka-en.com.vn', $workspaceId);
    $err = '';
    if (!$mailer->dispatchRaw($email, $subject, $html, [], $err, [], $workspaceId)) {
        // Even if email fails, we might still want to return success but log it?
        // Let's return error so frontend knows it failed
        $stmtDel = $pdo->prepare("DELETE FROM otp_codes WHERE id = ?");
        $stmtDel->execute([$codeId]);
        echo json_encode(['success' => false, 'error' => 'Không thể gửi email OTP: ' . $err]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'OTP generated and sent', 'expires_at' => $expiresAt]);
    exit;
}

// -------------------------------------------------------------
// ACTION: VERIFY
// -------------------------------------------------------------
if ($action === 'verify') {
    $email = $input['receiver_email'] ?? '';
    $code = $input['code'] ?? '';
    $profileId = $input['profile_id'] ?? ''; // optional strict checking

    if (!$email || !$code) {
        echo json_encode(['success' => false, 'error' => 'Require receiver_email and code']);
        exit;
    }

    // [FIX C-04] Rate limiting for OTP verify — max 10 attempts per IP per 15 minutes.
    // Without this, attacker can brute-force all 1,000,000 possible 6-digit codes.
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rateLimitKey = 'otp_verify_' . md5($email . ($profileId ?: ''));
    $maxAttempts = 10;
    $blockMinutes = 15;
    try {
        $stmtRL = $pdo->prepare(
            "SELECT attempts, blocked_until FROM api_rate_limits 
             WHERE ip_address = ? AND action = ? LIMIT 1"
        );
        $stmtRL->execute([$clientIp, $rateLimitKey]);
        $rateRow = $stmtRL->fetch(PDO::FETCH_ASSOC);
        if ($rateRow && !empty($rateRow['blocked_until']) && strtotime($rateRow['blocked_until']) > time()) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Quá nhiều lần thử. Vui lòng thử lại sau ' . $blockMinutes . ' phút.']);
            exit;
        }
    } catch (Exception $e) { /* fail open — don't block users if rate limit table missing */ }

    // [FIX M-01] Hash the input code to compare against stored hash
    $codeHash = hash('sha256', $code);

    $query = "SELECT id, expires_at FROM otp_codes WHERE receiver_email = ? AND code_hash = ? AND status = 'pending'";
    $params = [$email, $codeHash];
    if ($profileId) {
        $query .= " AND profile_id = ?";
        $params[] = $profileId;
    }
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        // [FIX C-04] Record failed attempt for rate limiting
        try {
            $pdo->prepare(
                "INSERT INTO api_rate_limits (ip_address, action, attempts, last_attempt_at)
                 VALUES (?, ?, 1, NOW())
                 ON DUPLICATE KEY UPDATE
                     attempts = attempts + 1,
                     last_attempt_at = NOW(),
                     blocked_until = IF(attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL)"
            )->execute([$clientIp, $rateLimitKey, $maxAttempts, $blockMinutes]);
        } catch (Exception $e) { /* fail silently */ }
        echo json_encode(['success' => false, 'error' => 'Mã xác thực không hợp lệ hoặc đã hết hạn.']);
        exit;
    }

    if (strtotime($record['expires_at']) < time()) {
        $stmt = $pdo->prepare("UPDATE otp_codes SET status = 'expired' WHERE id = ?");
        $stmt->execute([$record['id']]);
        echo json_encode(['success' => false, 'error' => 'Mã xác thực đã hết hạn. Vui lòng gửi lại.']);
        exit;
    }

    // Success! Mark as verified
    $stmt = $pdo->prepare("UPDATE otp_codes SET status = 'verified', verified_at = NOW() WHERE id = ?");
    $stmt->execute([$record['id']]);

    // [BUG-FSV-11] Log OTP_VERIFIED activity into subscriber_activity
    try {
        $stmtSub = $pdo->prepare("SELECT id, workspace_id FROM subscribers WHERE email = ? ORDER BY updated_at DESC LIMIT 1");
        $stmtSub->execute([$email]);
        $subRow = $stmtSub->fetch(PDO::FETCH_ASSOC);
        if ($subRow) {
            require_once __DIR__ . '/flow_helpers.php';
            logActivity(
                $pdo,
                $subRow['id'],
                'OTP_VERIFIED',
                $profileId,
                'OTP Verification',
                "Đã xác thực mã OTP thành công ($email)",
                null,
                null,
                ['profile_id' => $profileId, 'email' => $email, 'ip' => $clientIp],
                (int)($subRow['workspace_id'] ?? 1)
            );
        }
    } catch (Exception $eOtpLog) {
        error_log("OTP activity log warning: " . $eOtpLog->getMessage());
    }

    // [FIX C-04] Clear rate limit on success
    try {
        $pdo->prepare("DELETE FROM api_rate_limits WHERE ip_address = ? AND action = ?")
            ->execute([$clientIp, $rateLimitKey]);
    } catch (Exception $e) { /* fail silently */ }

    echo json_encode(['success' => true, 'message' => 'Xác nhận OTP thành công!']);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Unknown action']);
