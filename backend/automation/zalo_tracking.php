<?php
// api/zalo_tracking.php - ZNS Link Tracking Handler

error_reporting(E_ALL);
ini_set('display_errors', 0); // Hide errors on production
require_once 'db_connect.php';
require_once 'zalo_scoring_helper.php';

/**
 * Strict Redirect URL Sanitizer & Protocol Whitelist Guard
 */
if (!function_exists('sanitize_redirect_url')) {
    function sanitize_redirect_url(?string $rawUrl, ?string $fallbackUrl = null): string {
        $fallback = $fallbackUrl ?: (rtrim(function_exists('resolve_automation_app_base_url') ? resolve_automation_app_base_url() : (getenv('APP_BASE_URL') ?: 'http://localhost'), '/') . '/');
        if ($rawUrl === null || trim($rawUrl) === '') {
            return $fallback;
        }

        // 1. HTML entity decode and strip control characters / CRLF
        $url = html_entity_decode(trim($rawUrl), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $url = preg_replace('/[\x00-\x1F\x7F]+/', '', $url);
        if (trim($url) === '') {
            return $fallback;
        }

        // 2. Reject dangerous schemes
        if (preg_match('/^(?:javascript|data|vbscript|file|about|blob):/i', $url)) {
            return $fallback;
        }

        // 3. Protocol-relative normalization
        if (strpos($url, '//') === 0) {
            $url = 'https:' . $url;
        } elseif (!preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $url)) {
            $url = 'https://' . ltrim($url, '/');
        }

        // 4. Encode non-ASCII for validation
        $encodedUrl = preg_replace_callback('/[^\x21-\x7E]/', function ($m) {
            return rawurlencode($m[0]);
        }, $url);

        $parsed = @parse_url($encodedUrl);
        if (!$parsed || !is_array($parsed)) {
            return $fallback;
        }

        $scheme = strtolower($parsed['scheme'] ?? '');
        $host   = $parsed['host'] ?? '';

        if (!in_array($scheme, ['http', 'https'], true) || empty($host)) {
            return $fallback;
        }

        if (!filter_var($encodedUrl, FILTER_VALIDATE_URL)) {
            return $fallback;
        }

        return str_replace(["\r", "\n"], '', $encodedUrl);
    }
}

// Helper to get IP
function get_client_ip()
{
    // [FIX AUDIT-12] Use Cloudflare header for secure IP detection
    return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
}

$subId = $_GET['sub_id'] ?? null;
$flowId = $_GET['flow_id'] ?? null;
$stepId = $_GET['step_id'] ?? null;
$rawUrl = $_GET['url'] ?? '';

// Decode & Sanitize URL
$url = sanitize_redirect_url(urldecode($rawUrl));

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
        $ip = get_client_ip(); // Store raw IP for admin visibility
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

        // Prepare Details String
        $details = "Clicked link (+3 điểm): " . $url;

        // Resolve workspace_id from subscriber
        $wId = 1;
        try {
            $stmtSub = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ?");
            $stmtSub->execute([$subId]);
            $wId = $stmtSub->fetchColumn() ?: 1;
        } catch (\Throwable $e) {}

        // [FIX AUDIT-13 & DEF-TRK-01] Atomic deduplication using tracking_unique_cache
        $isUnique = true;
        if ($subId && ($flowId || $stepId)) {
            $targetId = $flowId ?: $stepId;
            $refKey = $url; // Unique per URL
            $effectiveWid = (int)($wId ?: 1);
            $cacheKey = md5("{$effectiveWid}_zalo_{$targetId}_click_{$subId}_{$refKey}");

            $stmtUnique = null;
            try {
                $stmtUnique = $pdo->prepare("
                    INSERT IGNORE INTO tracking_unique_cache 
                    (cache_key, workspace_id, subscriber_id, target_type, target_id, event_type, reference_key) 
                    VALUES (?, ?, ?, 'zalo', ?, 'click', ?)
                ");
                $stmtUnique->execute([$cacheKey, $effectiveWid, $subId, $targetId, $refKey]);
                $isUnique = ($stmtUnique->rowCount() > 0);
            } catch (\Throwable $eUniq) {
                // Fallback for legacy schema variants where cache_key column is absent
                try {
                    $stmtUnique = $pdo->prepare("
                        INSERT IGNORE INTO tracking_unique_cache 
                        (workspace_id, subscriber_id, target_type, target_id, event_type, reference_key) 
                        VALUES (?, ?, 'zalo', ?, 'click', ?)
                    ");
                    $stmtUnique->execute([$effectiveWid, $subId, $targetId, $refKey]);
                    $isUnique = ($stmtUnique->rowCount() > 0);
                } catch (\Throwable $eAlt) {
                    // Safe check without assuming non-existent 'id' column
                    try {
                        $stmtCheck = $pdo->prepare("SELECT cache_key FROM tracking_unique_cache WHERE subscriber_id = ? AND target_type = 'zalo' AND target_id = ? AND reference_key = ? LIMIT 1");
                        $stmtCheck->execute([$subId, $targetId, $refKey]);
                        $isUnique = !$stmtCheck->fetchColumn();
                    } catch (\Throwable $eFallback) {
                        $isUnique = true;
                    }
                }
            }
        }

        $pdo->prepare("
            INSERT INTO subscriber_activity (id, subscriber_id, workspace_id, type, reference_id, flow_id, campaign_id, details, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, 'click_zns', ?, ?, NULL, ?, ?, ?, NOW())
        ")->execute([$logId, $subId, $wId, $stepId, $flowId, $details, $ip, $userAgent]);

        // Always update total clicks on flow
        if ($flowId) {
            $pdo->prepare("UPDATE flows SET stat_total_zalo_clicked = COALESCE(stat_total_zalo_clicked, 0) + 1 WHERE id = ?")->execute([$flowId]);
        }

        // Only update stats if it's a unique click
        if ($isUnique) {
            // 2. Update Subscriber Stats
            $pdo->prepare("
                UPDATE subscribers 
                SET stats_clicked = COALESCE(stats_clicked, 0) + 1, 
                    last_click_at = NOW(), 
                    last_activity_at = NOW() 
                WHERE id = ?
            ")->execute([$subId]);

            // 2.5. Update Lead Score
            updateZaloLeadScore($pdo, null, 'click_zns', $stepId, $subId);

            // 3. Mark Flow Interaction — Unique ZNS clicks
            if ($flowId) {
                try {
                    $pdo->prepare("UPDATE flows SET stat_unique_zalo_clicked = COALESCE(stat_unique_zalo_clicked, 0) + 1 WHERE id = ?")->execute([$flowId]);
                } catch (\Throwable $eCol) {}
            }
        }

        if (function_exists('domationSyncSubscriberMatchOnly')) {
            domationSyncSubscriberMatchOnly($pdo, (string)$subId);
        }

        // [FIX P14-C1] Dispatch a priority queue job so Condition steps waiting for a
        // ZNS click ('zns_clicked' conditionType → 'click_zns' activity) are evaluated immediately.
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
            } catch (\Throwable $ePoke) {
                // Silent fail — poke is best-effort; worker cron remains the safety net
            }
        }

    } catch (\Throwable $e) {
        // Silent fail to ensure redirect always happens
    }
}

// 4. Redirect
$url = str_replace(["\r", "\n"], '', $url);
header("Location: " . $url, true, 302);
header("Connection: close");
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}
exit;
