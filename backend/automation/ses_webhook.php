<?php
// api/ses_webhook.php - Amazon SES Bounce & Complaint Handler (v2)
// Receives SNS notifications from Amazon SES via HTTP/HTTPS POST
// IMPORTANT: Configure SNS topic → this endpoint in AWS Console → SES → Notifications

header('Content-Type: application/json');
require_once 'db_connect.php';

// Get raw POST data
$rawPost = file_get_contents('php://input');
$data    = json_decode($rawPost, true);

// Log for debugging (auto-rotate if > 5MB)
$logFile = __DIR__ . '/ses_webhook.log';
if (file_exists($logFile) && filesize($logFile) > 5 * 1024 * 1024) {
    rename($logFile, $logFile . '.' . date('YmdHis') . '.bak');
}
file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $rawPost . "\n", FILE_APPEND);

if (!$data || !isset($data['Type'])) {
    http_response_code(400);
    echo json_encode(['status' => 'invalid_payload']);
    exit;
}

// ─── SNS Origin Validation ────────────────────────────────────────────────────
// Prevents spoofed SNS notifications from injecting false bounce/complaint data.
if (isset($data['SigningCertURL'])) {
    $certUrl = $data['SigningCertURL'];
    if (!preg_match('/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//', $certUrl)) {
        http_response_code(403);
        echo json_encode(['status' => 'invalid_cert_origin']);
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "[SECURITY] Rejected: cert URL not amazonaws.com: $certUrl\n", FILE_APPEND);
        exit;
    }
}

// [FIX F-8] Full cryptographic SNS signature verification.
// AWS SNS signs each message with a private key; the cert is accessible via SigningCertURL.
// Without this, an attacker who knows this endpoint URL can POST fake bounce/complaint
// notifications (e.g., set status='bounced' for any subscriber's email address).
// Verification downloads + caches the cert (1h TTL) and checks with openssl_verify().
if (!function_exists('verifySnsSignature')) {
    function verifySnsSignature(array $data): bool
    {
        $certUrl = $data['SigningCertURL'] ?? '';
        if (empty($certUrl)) return false;

        // Build the canonical message string per AWS SNS documentation.
        // Fields differ by message type (Notification vs SubscriptionConfirmation).
        $type = $data['Type'] ?? '';
        if ($type === 'Notification') {
            $fields = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
        } else {
            $fields = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
        }
        $stringToSign = '';
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $stringToSign .= $field . "\n" . $data[$field] . "\n";
            }
        }

        // Download + cache PEM certificate (1-hour TTL, keyed by cert URL hash).
        $cacheFile = __DIR__ . '/_locks/sns_cert_' . md5($certUrl) . '.pem';
        if (!file_exists($cacheFile) || (time() - filemtime($cacheFile)) > 3600) {
            $ctx = stream_context_create(['http' => ['timeout' => 5, 'user_agent' => 'AutoFlow/1.0']]);
            $cert = @file_get_contents($certUrl, false, $ctx);
            if (!$cert) {
                error_log('[ses_webhook] Failed to download SNS cert from: ' . $certUrl);
                return false;
            }
            file_put_contents($cacheFile, $cert, LOCK_EX);
        } else {
            $cert = file_get_contents($cacheFile);
        }

        $pubKey = openssl_pkey_get_public($cert);
        if (!$pubKey) return false;

        $signature  = base64_decode($data['Signature'] ?? '');
        // SNS uses SHA1 for SignatureVersion 1 (default), SHA256 for version 2.
        $sigVersion = (int)($data['SignatureVersion'] ?? 1);
        $algo = ($sigVersion === 2) ? OPENSSL_ALGO_SHA256 : OPENSSL_ALGO_SHA1;

        $result = openssl_verify($stringToSign, $signature, $pubKey, $algo);
        return $result === 1;
    }
}

// ─── Handle SNS Subscription Confirmation ────────────────────────────────────
if ($data['Type'] === 'SubscriptionConfirmation') {
    // Note: Verify signature on confirmation too to prevent unauthorized subscriptions.
    if (!verifySnsSignature($data)) {
        http_response_code(403);
        echo json_encode(['status' => 'invalid_signature']);
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "[SECURITY] Rejected SubscriptionConfirmation: signature invalid\n", FILE_APPEND);
        exit;
    }
    $subscribeUrl = $data['SubscribeURL'] ?? '';
    if ($subscribeUrl && preg_match('/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//', $subscribeUrl)) {
        // Auto-confirm: AWS requires hitting this URL within 3 days
        $ctx = stream_context_create(['http' => ['timeout' => 10]]);
        @file_get_contents($subscribeUrl, false, $ctx);
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "[SNS] Subscription confirmed\n", FILE_APPEND);
    }
    echo json_encode(['status' => 'subscription_confirmed']);
    exit;
}

// ─── Handle SNS Notification ──────────────────────────────────────────────────
if ($data['Type'] === 'Notification') {
    // [FIX F-8] Verify cryptographic signature BEFORE processing any bounce/complaint data.
    if (!verifySnsSignature($data)) {
        http_response_code(403);
        echo json_encode(['status' => 'invalid_signature']);
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "[SECURITY] Rejected Notification: signature invalid\n", FILE_APPEND);
        exit;
    }
    $message          = json_decode($data['Message'] ?? '{}', true);
    $notificationType = $message['notificationType'] ?? '';

    if ($notificationType === 'Bounce') {
        handleBounce($pdo, $message);
    } elseif ($notificationType === 'Complaint') {
        handleComplaint($pdo, $message);
    }
    // 'Delivery' notifications — no action needed

    echo json_encode(['status' => 'processed', 'type' => $notificationType]);
    exit;
}

echo json_encode(['status' => 'unknown_type', 'received' => $data['Type']]);

// ===== HANDLERS =====

function handleBounce($pdo, $message)
{
    // bounceType: Permanent | Transient | Undetermined
    // bounceSubType: General | NoEmail | Suppressed | MailboxFull | MessageTooLarge | ContentRejected | AttachmentRejected
    $bounceType    = $message['bounce']['bounceType']    ?? 'Unknown';
    $bounceSubtype = $message['bounce']['bounceSubType'] ?? '';
    $recipients    = $message['bounce']['bouncedRecipients'] ?? [];

    foreach ($recipients as $recipient) {
        $email          = $recipient['emailAddress'] ?? '';
        $diagnosticCode = $recipient['diagnosticCode'] ?? '';
        $smtpStatus     = $recipient['status'] ?? '';
        try {

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
            continue;

        $detail = "Bounce ({$bounceType}/{$bounceSubtype}) via SES" .
                  ($smtpStatus     ? " [SMTP: $smtpStatus]" : '') .
                  ($diagnosticCode ? " \u2014 $diagnosticCode"   : '');

        if ($bounceType === 'Permanent') {
            // [FIX P12-H3] UPDATE all workspace subscribers with this email (no LIMIT).
            // The same email can exist in multiple workspaces. A hard bounce is email-level
            // (the address is physically undeliverable) so ALL records must be marked.
            // Old: SELECT id ... LIMIT 1 → only one random workspace record got marked.
            $pdo->prepare("UPDATE subscribers SET status = 'bounced', updated_at = NOW() WHERE email = ?")
                ->execute([$email]);

            // Log activity for the first subscriber found (audit trail — workspace-independent)
            $firstSub = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? LIMIT 1");
            $firstSub->execute([$email]);
            $subId = $firstSub->fetchColumn();
            if ($subId) {
                // [REAL-TIME STATS] Find campaigns sent to this recipient that succeeded,
                // mark them as failed in mail_delivery_logs, and update campaign stats.
                $stmtLogs = $pdo->prepare("SELECT DISTINCT campaign_id FROM mail_delivery_logs WHERE recipient = ? AND status = 'success'");
                $stmtLogs->execute([$email]);
                $campaignIds = $stmtLogs->fetchAll(PDO::FETCH_COLUMN);

                if (!empty($campaignIds)) {
                    $pdo->prepare("UPDATE mail_delivery_logs SET status = 'failed', error_message = ? WHERE recipient = ? AND status = 'success'")
                        ->execute([$detail, $email]);

                    foreach ($campaignIds as $campaignId) {
                        if ($campaignId) {
                            $pdo->prepare("UPDATE campaigns SET count_bounced = count_bounced + 1, count_sent = GREATEST(0, count_sent - 1) WHERE id = ?")
                                ->execute([$campaignId]);
                        }
                    }
                }

                $recentCampaignId = !empty($campaignIds) ? $campaignIds[0] : null;
                $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, details, campaign_id, created_at) VALUES (?, 'bounce', ?, ?, NOW())")
                    ->execute([$subId, $detail, $recentCampaignId]);
            }

        } elseif ($bounceType === 'Transient') {
            // Soft bounce: log only, do NOT change subscriber status
            $firstSub = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? LIMIT 1");
            $firstSub->execute([$email]);
            if ($subId = $firstSub->fetchColumn()) {
                $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, details, created_at) VALUES (?, 'soft_bounce', ?, NOW())")
                    ->execute([$subId, $detail]);
            }
        }
        // Undetermined: no action
        } catch (Exception $e) {
            error_log('[ses_webhook] handleBounce error for ' . $email . ': ' . $e->getMessage());
        }
    }
}

function handleComplaint($pdo, $message)
{
    // feedbackType: abuse | auth-failure | fraud | not-spam | other | virus
    $recipients   = $message['complaint']['complainedRecipients'] ?? [];
    $feedbackType = $message['complaint']['complaintFeedbackType'] ?? 'abuse';

    foreach ($recipients as $recipient) {
        $email = $recipient['emailAddress'] ?? '';

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
            continue;
        try {
        // [FIX P12-H3] UPDATE all workspace subscribers with this email (no LIMIT).
        // Same rationale as handleBounce: spam complaint is address-level from SES.
        $pdo->prepare("UPDATE subscribers SET status = 'unsubscribed', updated_at = NOW() WHERE email = ?")
            ->execute([$email]);

        // Find first subscriber for flow state cancellation and activity log
        $firstSub = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? LIMIT 1");
        $firstSub->execute([$email]);
        $subId = $firstSub->fetchColumn();

        if ($subId) {
            // [M-3 FIX] Cancel any active flow states to prevent further automated sends.
            $pdo->prepare("UPDATE subscriber_flow_states SET status = 'cancelled', updated_at = NOW() WHERE subscriber_id = ? AND status IN ('waiting', 'processing')")
                ->execute([$subId]);

            // [REAL-TIME STATS] Find campaigns sent to this recipient and increment count_spam
            $stmtLogs = $pdo->prepare("SELECT DISTINCT campaign_id FROM mail_delivery_logs WHERE recipient = ? AND status = 'success'");
            $stmtLogs->execute([$email]);
            $campaignIds = $stmtLogs->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($campaignIds)) {
                foreach ($campaignIds as $campaignId) {
                    if ($campaignId) {
                        $pdo->prepare("UPDATE campaigns SET count_spam = count_spam + 1 WHERE id = ?")
                            ->execute([$campaignId]);
                    }
                }
            }

            $recentCampaignId = !empty($campaignIds) ? $campaignIds[0] : null;
            $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, details, campaign_id, created_at) VALUES (?, 'complaint', ?, ?, NOW())")
                ->execute([$subId, "Spam Complaint via SES (feedback: $feedbackType)", $recentCampaignId]);
        }
        } catch (Exception $e) {
            error_log('[ses_webhook] handleComplaint error for ' . $email . ': ' . $e->getMessage());
        }
    }
}
?>
