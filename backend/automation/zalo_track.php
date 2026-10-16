<?php
/**
 * Zalo Link Tracking
 * Logs clicks and redirects user
 */

require_once 'db_connect.php';
require_once 'zalo_helpers.php';
require_once 'zalo_scoring_helper.php';

$url = $_GET['u'] ?? '';
$scenarioId = $_GET['sid'] ?? '';
$zaloUserId = $_GET['uid'] ?? '';
$label = $_GET['lbl'] ?? '';

if (empty($url)) {
    die("Invalid URL");
}

// Decode URL (It will be urlencoded/base64 encoded)
// We will use base64 for cleaner URLs in helper
$targetUrl = base64_decode($url, true);
if ($targetUrl === false) {
    $targetUrl = $url; // Fallback
}

// Log Click
if ($zaloUserId) {
    try {
        // Find Subscriber ID
        $stmtS = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
        $stmtS->execute([$zaloUserId]);
        $subId = $stmtS->fetchColumn();

        if ($subId) {
            // [SYNCED] Use processTrackingEvent to handle activity logging, scoring, AND stats updates (Campaigns/Flows)
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
                    'extra_data' => [
                        'url' => $targetUrl,
                        'label' => $label,
                        'zalo_sub_id' => $subId
                    ]
                ]);

                // Also keep legacy Zalo-specific activity for backward compatibility with Zalo logs
                logZaloSubscriberActivity($pdo, $subId, 'zalo_clicked', $scenarioId, $label ? "Click Button: $label" : "Click Link: " . $targetUrl, null, $workspace_id);

                updateZaloLeadScore($pdo, $zaloUserId, 'click', $scenarioId);
            }
        }
    } catch (Exception $e) {
        // Silent fail for logging, prioritize redirect
        error_log("Zalo Track Error: " . $e->getMessage());
    }
}

// Redirect
header("Location: " . $targetUrl);
exit;
