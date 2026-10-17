<?php
// api/voucher_helper.php

/**
 * Perform an atomic claim of a voucher code for a subscriber
 *
 * @param PDO $pdo
 * @param string $campaignId
 * @param string $subscriberId
 * @param string|null $rewardItemId Optional specific reward item ID to claim
 * @param string|null $sourceChannel e.g., 'survey', 'api', 'direct'
 * @param string|null $sourceId e.g., survey_id
 * @param string $eventName Custom event to log
 * @return array ['success' => bool, 'code' => string, 'message' => string]
 */
function claimVoucherAtomic($pdo, $campaignId, $subscriberId, $rewardItemId = null, $sourceChannel = null, $sourceId = null, $eventName = 'voucher_claimed') {
    // 1. Validate Campaign
    $stmtCamp = $pdo->prepare("SELECT * FROM voucher_campaigns WHERE id = ? AND status = 'active'");
    $stmtCamp->execute([$campaignId]);
    $camp = $stmtCamp->fetch(PDO::FETCH_ASSOC);

    if (!$camp) {
        return ['success' => false, 'message' => 'Chiến dịch không tồn tại hoặc đã bị tắt.'];
    }

    if (!empty($camp['end_date']) && strtotime($camp['end_date']) < time()) {
        return ['success' => false, 'message' => 'Chiến dịch đã kết thúc.'];
    }

    // Lock subscriber globally to prevent concurrent claims for the same user
    $lockTarget = "sub_claim_" . md5($subscriberId . $campaignId);
    if (!db_get_lock($pdo, $lockTarget, 5)) {
        return ['success' => false, 'message' => 'Hệ thống đang bận, vui lòng thử lại sau giây lát.'];
    }

    $codeAssigned = null;

    try {
        $alreadyInTx = $pdo->inTransaction();
        if (!$alreadyInTx) $pdo->beginTransaction();

        // Check if already claimed from this campaign
        $stmtExist = $pdo->prepare("SELECT id, code FROM voucher_codes WHERE campaign_id = ? AND subscriber_id = ? LIMIT 1");
        $stmtExist->execute([$campaignId, $subscriberId]);
        $existing = $stmtExist->fetch(PDO::FETCH_ASSOC);

        $codeId = null;
        if ($existing) {
            $codeAssigned = $existing['code'];
            $codeId = $existing['id'];
        } else {
            if ($camp['code_type'] === 'static') {
                $codeAssigned = $camp['static_code'];
                $codeId = null;
            } else {
                // Dynamic code assignment with atomic locking
                $vcSkipLocked = isDatabaseSkipLockedSupported($pdo) ? 'SKIP LOCKED' : '';
                
                $rewardCondition = "";
                $params = [$campaignId];
                if ($rewardItemId !== null) {
                    $rewardCondition = " AND reward_item_id = ?";
                    $params[] = $rewardItemId;
                }

                $stmtClaim = $pdo->prepare("SELECT id, code FROM voucher_codes WHERE campaign_id = ? AND status = 'unused' AND subscriber_id IS NULL $rewardCondition ORDER BY id ASC LIMIT 1 FOR UPDATE $vcSkipLocked");
                $stmtClaim->execute($params);
                $row = $stmtClaim->fetch(PDO::FETCH_ASSOC);

                if ($row) {
                    $expiresAt = null;
                    if (!empty($camp['expiration_days'])) {
                        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$camp['expiration_days']} days"));
                    }
                    
                    // Keep status as 'unused' during distribution/claiming (it only becomes 'used' on redemption)
                    $pdo->prepare("UPDATE voucher_codes SET subscriber_id = ?, claimed_at = NOW(), expires_at = ?, claimed_source = ?, claimed_source_id = ? WHERE id = ?")
                        ->execute([$subscriberId, $expiresAt, $sourceChannel, $sourceId, $row['id']]);
                    $codeAssigned = $row['code'];
                    $codeId = $row['id'];
                }
            }
        }

        if ($codeAssigned) {
            // Record to voucher_claims INSIDE transaction for atomicity
            $stmtSub = $pdo->prepare("SELECT email, phone_number, first_name, contact_id FROM subscribers WHERE id = ?");
            $stmtSub->execute([$subscriberId]);
            $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);
            
            $email = $sub['email'] ?? 'unknown@email.com';
            $phone = $sub['phone_number'] ?? null;
            $name = $sub['first_name'] ?? null;
            $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
            if (strpos($clientIp, ',') !== false) $clientIp = trim(explode(',', $clientIp)[0]);
            
            // Generate a unique ID for the claim
            $claimId = bin2hex(random_bytes(18));
            
            try {
                $stmtInsertClaim = $pdo->prepare("INSERT INTO voucher_claims (id, voucher_id, subscriber_id, email, name, phone, status, source_channel, source_id, assigned_code_id) 
                    VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
                    ON DUPLICATE KEY UPDATE status = 'approved', source_channel = VALUES(source_channel), source_id = VALUES(source_id)");
                $stmtInsertClaim->execute([$claimId, $campaignId, $subscriberId, $email, $name, $phone, $sourceChannel, $sourceId, $codeId]);
            } catch (\Throwable $eClaimCol) {
                // [BUG-FSV-07] Support campaign_id column if schema uses campaign_id instead of voucher_id
                try {
                    $stmtInsertClaim2 = $pdo->prepare("INSERT INTO voucher_claims (id, campaign_id, subscriber_id, email, name, phone, status, ip_address) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)");
                    $stmtInsertClaim2->execute([$claimId, $campaignId, $subscriberId, $email, $name, $phone, $clientIp]);
                } catch (\Throwable $e2) {}
            }
        }

        if (!$alreadyInTx) $pdo->commit();
    } catch (Exception $e) {
        if (!$alreadyInTx && $pdo->inTransaction()) $pdo->rollBack();
        db_release_lock($pdo, $lockTarget);
        error_log("Voucher Atomic Claim Error: " . $e->getMessage());
        return ['success' => false, 'message' => 'Hệ thống quá tải, vui lòng thử lại.'];
    }

    db_release_lock($pdo, $lockTarget);

    if (!$codeAssigned) {
        return ['success' => false, 'message' => 'Hết mã! Số lượng Voucher của chương trình đã cạn.'];
    }

    $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (strpos($clientIp, ',') !== false) $clientIp = trim(explode(',', $clientIp)[0]);

    // Trigger Automations via WorkerTriggerService
    if (!function_exists('logActivity')) {
        @include_once 'tracking_helper.php';
    }
    if (function_exists('logActivity')) {
        logActivity($pdo, $subscriberId, 'custom_event', $eventName, null, "Nhận mã Voucher: $codeAssigned (Campaign: {$camp['name']}) | IP: $clientIp", null, null, ['campaign_id' => $campaignId, 'code' => $codeAssigned, 'ip' => $clientIp], $camp['workspace_id']);
    }

    // [BUG-FSV-07 & MATCH-ONLY] Refresh matched MYERP.contacts stats
    if (function_exists('domationSyncSubscriberMatchOnly')) {
        domationSyncSubscriberMatchOnly($pdo, $subscriberId);
    }

    try {
        require_once 'WorkerTriggerService.php';
        $apiUrl = (defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api');
        $workerService = new WorkerTriggerService($pdo, $apiUrl);
        
        $workerService->trigger('/worker_priority.php?' . http_build_query([
            'trigger_type' => 'custom_event', 
            'target_id' => $eventName, 
            'subscriber_id' => $subscriberId
        ]));
        
        $workerService->trigger('/worker_priority.php?' . http_build_query([
            'trigger_type' => 'voucher', 
            'target_id' => $campaignId, 
            'subscriber_id' => $subscriberId
        ]));
    } catch (Exception $e) {
        error_log("Voucher Automation Trigger Error: " . $e->getMessage());
    }

    return ['success' => true, 'code' => $codeAssigned, 'message' => 'Lấy mã thành công!'];
}
