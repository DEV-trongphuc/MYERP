<?php
// api/zalo_tracking.php - ZNS Link Tracking Handler

error_reporting(E_ALL);
ini_set('display_errors', 0); // Hide errors on production
require_once 'db_connect.php';
require_once 'zalo_scoring_helper.php';

// Helper to get IP
function get_client_ip()
{
    // [FIX AUDIT-12] Use Cloudflare header for secure IP detection
    return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
}

$subId = $_GET['sub_id'] ?? null;
$flowId = $_GET['flow_id'] ?? null;
$stepId = $_GET['step_id'] ?? null;
$url = $_GET['url'] ?? '';

// Decode URL if encoded
$url = urldecode($url);

// Fallback if URL is empty
if (empty($url)) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Lỗi: Không tìm thấy liên kết đích.']);
    exit;
}

if ($subId && $url) {
    try {
        // 1. Log Activity
        $logId = bin2hex(random_bytes(16));
        $ip = get_client_ip(); // [FIX AUDIT-12] Store raw IP for admin visibility (don't MD5)
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

        // Prepare Details String
        // We log the destination URL as details so we can match it in Condition checks
        $details = "Clicked link (+3 điểm): " . $url;

        // Resolve workspace_id from subscriber
        $wId = 1;
        try {
            $stmtSub = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ?");
            $stmtSub->execute([$subId]);
            $wId = $stmtSub->fetchColumn() ?: 1;
        } catch (Exception $e) {}

        // [FIX AUDIT-13] Deduplication: Check if this subscriber already clicked this specific link in this flow
        $isUnique = true;
        if ($subId && ($flowId || $stepId)) {
            $refKey = $url; // Unique per URL
            $stmtCheck = $pdo->prepare("SELECT id FROM tracking_unique_cache WHERE subscriber_id = ? AND target_type = 'zalo' AND target_id = ? AND reference_key = ?");
            $stmtCheck->execute([$subId, $flowId ?: $stepId, $refKey]);
            if ($stmtCheck->fetch()) {
                $isUnique = false;
            } else {
                $pdo->prepare("INSERT INTO tracking_unique_cache (subscriber_id, target_type, target_id, event_type, reference_key) VALUES (?, 'zalo', ?, 'click', ?)")
                    ->execute([$subId, $flowId ?: $stepId, $refKey]);
            }
        }

        $pdo->prepare("
            INSERT INTO subscriber_activity (id, subscriber_id, workspace_id, type, reference_id, flow_id, campaign_id, details, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, 'click_zns', ?, ?, NULL, ?, ?, ?, NOW())
        ")->execute([$logId, $subId, $wId, $stepId, $flowId, $details, $ip, $userAgent]);

        // Only update stats if it's a unique click
        if ($isUnique) {
            // 2. Update Subscriber Stats
            $pdo->prepare("
                UPDATE subscribers 
                SET stats_clicked = stats_clicked + 1, 
                    last_click_at = NOW(), 
                    last_activity_at = NOW() 
                WHERE id = ?
            ")->execute([$subId]);

            // 2.5. Update Lead Score
            updateZaloLeadScore($pdo, null, 'click_zns', $stepId, $subId);

            // 3. Mark Flow Interaction — ZNS clicks
            if ($flowId) {
                $pdo->prepare("UPDATE flows SET stat_total_zalo_clicked = stat_total_zalo_clicked + 1 WHERE id = ?")->execute([$flowId]);
            }
        }

        // [FIX P14-C1] Dispatch a priority queue job so Condition steps waiting for a
        // ZNS click ('zns_clicked' conditionType → 'click_zns' activity) are evaluated
        // immediately instead of waiting up to 15 minutes for the next cron cycle.
        // Mirrors the email click poke in tracking_processor.php (Case A).
        if ($subId && $flowId) {
            try {
                require_once __DIR__ . '/trigger_helper.php';
                $checkWait = $pdo->prepare("
                    SELECT sfs.id, sfs.step_type
                    FROM subscriber_flow_states sfs
                    WHERE sfs.subscriber_id = ? AND sfs.flow_id = ? AND sfs.status = 'waiting'
                ");
                $checkWait->execute([$subId, $flowId]);
                foreach ($checkWait->fetchAll(PDO::FETCH_ASSOC) as $state) {
                    if (($state['step_type'] ?? '') === 'condition') {
                        dispatchQueueJob($pdo, 'flows', [
                            'priority_queue_id' => $state['id'],
                            'subscriber_id'     => $subId,
                            'priority_flow_id'  => $flowId
                        ]);
                    }
                }
            } catch (Exception $ePoke) {
                // Silent fail — poke is best-effort; worker cron remains the safety net
            }
        }

    } catch (Exception $e) {
        // Silent fail to ensure redirect always happens
        // error_log($e->getMessage()); 
    }
}

// 4. Redirect
header("Location: " . $url);
exit;
