<?php
/**
 * Zalo Link Tracking
 * Logs clicks and redirects user
 */

require_once 'db_connect.php';
require_once 'zalo_helpers.php';
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

$rawUrl = $_GET['u'] ?? '';
$scenarioId = $_GET['sid'] ?? '';
$zaloUserId = $_GET['uid'] ?? '';
$label = $_GET['lbl'] ?? '';

if (empty($rawUrl)) {
    header("Location: " . sanitize_redirect_url(''));
    exit;
}

// Decode URL (It will be urlencoded/base64 encoded)
$decodedUrl = base64_decode($rawUrl, true);
if ($decodedUrl === false) {
    $decodedUrl = $rawUrl; // Fallback
}
$targetUrl = sanitize_redirect_url($decodedUrl);

// Log Click
if ($zaloUserId) {
    try {
        // Find Subscriber ID
        $stmtS = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
        $stmtS->execute([$zaloUserId]);
        $subId = $stmtS->fetchColumn();

        if ($subId) {
            // Use processTrackingEvent to handle activity logging, scoring, AND stats updates (Campaigns/Flows)
            require_once 'tracking_processor.php';

            // Find Main Subscriber ID from zalo_subscribers record
            $stmtMain = $pdo->prepare("SELECT subscriber_id, zalo_user_id FROM zalo_subscribers WHERE id = ?");
            $stmtMain->execute([$subId]);
            $subRow = $stmtMain->fetch(PDO::FETCH_ASSOC);
            $mainSubId = $subRow['subscriber_id'] ?? null;

            if ($mainSubId) {
                // Fetch workspace_id securely using prepared statement
                $stmtWs = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
                $stmtWs->execute([$mainSubId]);
                $workspace_id = $stmtWs->fetchColumn();

                // Determine Campaign/Flow context from scenarioId if possible
                $flowId = null;
                $campaignId = null;

                // Try to resolve if it's a flow or campaign
                $stmtFlow = $pdo->prepare("SELECT id FROM flows WHERE id = ?");
                $stmtFlow->execute([$scenarioId]);
                if ($stmtFlow->fetchColumn()) {
                    $flowId = $scenarioId;
                } else {
                    $stmtCamp = $pdo->prepare("SELECT id FROM campaigns WHERE id = ?");
                    $stmtCamp->execute([$scenarioId]);
                    if ($stmtCamp->fetchColumn())
                        $campaignId = $scenarioId;
                }

                processTrackingEvent($pdo, 'stat_update', [
                    'type' => 'zalo_clicked',
                    'subscriber_id' => $mainSubId,
                    'reference_id' => $scenarioId,
                    'flow_id' => $flowId,
                    'campaign_id' => $campaignId,
                    'workspace_id' => $workspace_id ?: 1,
                    'extra_data' => [
                        'url' => $targetUrl,
                        'label' => $label,
                        'zalo_sub_id' => $subId
                    ]
                ]);

                // Also keep legacy Zalo-specific activity for backward compatibility with Zalo logs
                logZaloSubscriberActivity($pdo, $subId, 'zalo_clicked', $scenarioId, $label ? "Click Button: $label" : "Click Link: " . $targetUrl, null, null, $workspace_id ?: 1);

                updateZaloLeadScore($pdo, $zaloUserId, 'click', $scenarioId);
            }
        }
    } catch (\Throwable $e) {
        // Silent fail for logging, prioritize redirect
        error_log("Zalo Track Error: " . $e->getMessage());
    }
}

// Redirect
$targetUrl = str_replace(["\r", "\n"], '', $targetUrl);
header("Location: " . $targetUrl, true, 302);
header("Connection: close");
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}
exit;
