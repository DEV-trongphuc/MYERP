<?php
/**
 * zalo_scoring_helper.php - Lead Scoring Logic for Zalo
 */

require_once 'flow_helpers.php'; // For logActivity

/**
 * Update Lead Score for Zalo/Main Subscriber
 * 
 * @param PDO $pdo
 * @param string|null $zaloUserId
 * @param string $type Event type: follow, message, click, zns_interaction, click_zns
 * @param string|null $refId Optional reference ID
 * @param string|null $mainSubId Optional main subscriber ID
 */
function updateZaloLeadScore($pdo, $zaloUserId, $type, $refId = null, $mainSubId = null)
{
    // Load centralized points config
    require_once __DIR__ . '/db_connect.php';
    $config = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
    $baseZalo = (int)($config['leadscore_zalo_interact'] ?? 3);

    // Map internal types to config keys 
    $pointsMap = [
        'follow' => $baseZalo + 5,
        'message' => $baseZalo,
        'click' => max(1, $baseZalo - 1),
        'zns_interaction' => $baseZalo,
        'click_zns' => $baseZalo + 2,
        'reaction' => max(1, floor($baseZalo / 2)),
        'feedback' => $baseZalo + 2
    ];

    $points = $pointsMap[$type] ?? 0;
    if ($points === 0)
        return;

    $zaloSubId = null;
    $mainId = $mainSubId;
    $workspace_id = null;

    // 1. Resolve Zalo User ID if only Main ID provided
    if (!$zaloUserId && $mainId) {
        $stmt = $pdo->prepare("SELECT zalo_user_id FROM subscribers WHERE id = ? LIMIT 1");
        $stmt->execute([$mainId]);
        $zaloUserId = $stmt->fetchColumn();
    }

    // 2. Resolve Main ID if only Zalo User ID provided
    if (!$mainId && $zaloUserId) {
        $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
        $stmt->execute([$zaloUserId]);
        $mainId = $stmt->fetchColumn();
    }

    // 3. Update Zalo Subscriber Table if exists
    if ($zaloUserId) {
        $stmt = $pdo->prepare("SELECT id, lead_score FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
        $stmt->execute([$zaloUserId]);
        $zaloSub = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($zaloSub) {
            $zaloSubId = $zaloSub['id'];

            // Messaging Rate Limit: 1 per day
            $canScore = true;
            if ($type === 'message') {
                $stmtCheck = $pdo->prepare("
                    SELECT id FROM zalo_subscriber_activity 
                    WHERE subscriber_id = ? AND type = 'lead_score_reward' AND reference_name = 'message' AND created_at >= CURDATE()
                    LIMIT 1
                ");
                $stmtCheck->execute([$zaloSubId]);
                if ($stmtCheck->fetchColumn()) {
                    $canScore = false;
                }
            }

            if ($canScore) {
                // [OPTIMIZATION] Buffer Zalo Lead Score increment
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('zalo_subscribers', ?, 'lead_score', ?)")
                    ->execute([$zaloSubId, $points]);

                // Log Zalo Activity
                $details = "Cộng $points điểm lead score cho sự kiện: $type";
                if (!$workspace_id && $mainId) {
                    $stmtWs = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
                    $stmtWs->execute([$mainId]);
                    $workspace_id = $stmtWs->fetchColumn();
                }
                logZaloSubscriberActivity($pdo, $zaloSubId, 'lead_score_reward', $refId, $details, $type, null, $workspace_id);
            } else {
                // If Zalo score capped, we might still want to update Main score? 
                // Usually they should be in sync, so if capped for Zalo, cap for Main too.
                $points = 0;
            }
        }
    }

    // 4. Update Main Subscriber Score (Cumulative)
    if ($mainId && $points > 0) {
        // [OPTIMIZATION] Buffer Main Lead Score increment
        $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('subscribers', ?, 'lead_score', ?)")
            ->execute([$mainId, $points]);

        // [OPTIMIZATION] Buffer Activity Timestamp
        $ts = date('Y-m-d H:i:s');
        $pdo->prepare("INSERT INTO timestamp_buffer (subscriber_id, column_name, timestamp_value) VALUES (?, 'last_activity_at', ?)")
            ->execute([$mainId, $ts]);

        // Log Main Activity (Hành trình tương tác)
        $typeLabel = '';
        switch ($type) {
            case 'follow':
                $typeLabel = 'Quan tâm OA';
                break;
            case 'message':
                $typeLabel = 'Nhắn tin cho OA';
                break;
            case 'click':
                $typeLabel = 'Click Button/Link Zalo';
                break;
            case 'zns_interaction':
                $typeLabel = 'Tương tác ZNS';
                break;
            case 'click_zns':
                $typeLabel = 'Click Link ZNS';
                break;
            case 'reaction':
                $typeLabel = 'Thả cảm xúc tin nhắn';
                break;
            case 'feedback':
                $typeLabel = 'Gửi feedback';
                break;
        }

        if (!$workspace_id && $mainId) {
            $stmtWs = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
            $stmtWs->execute([$mainId]);
            $workspace_id = $stmtWs->fetchColumn();
        }
        logActivity($pdo, $mainId, 'lead_score_sync', $refId, 'Zalo Scoring', "$typeLabel (+$points điểm)", $refId, null, [], $workspace_id);

        // [REAL-TIME] Trigger Dynamic Triggers (Segment Entry)
        require_once 'trigger_helper.php';
        checkDynamicTriggers($pdo, $mainId);
    }
}
