<?php
/**
 * Meta Growth Report API
 * Mirrors Zalo Growth Report Logic
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'meta_helpers.php';

header('Content-Type: application/json');

try {
    $period = $_GET['period'] ?? 'month';
    $configId = $_GET['meta_config_id'] ?? null;
    $startDateInput = $_GET['start_date'] ?? null;
    $endDateInput = $_GET['end_date'] ?? null;

    // Resolve Page ID from Config ID
    $pageId = null;
    if ($configId) {
        $stmt = $pdo->prepare("SELECT page_id FROM meta_app_configs WHERE id = ?");
        $stmt->execute([$configId]);
        $pageId = $stmt->fetchColumn();
    }

    // Determine Date Range
    if ($period === 'month' && !$startDateInput) {
        $year = $_GET['year'] ?? date('Y');
        $startDate = "$year-01-01 00:00:00";
        $endDate = "$year-12-31 23:59:59";
    } elseif ($period === 'day' && !$startDateInput) {
        $startDate = date('Y-m-d 00:00:00', strtotime('-30 days'));
        $endDate = date('Y-m-d 23:59:59');
    } else {
        $startDate = $startDateInput . " 00:00:00";
        $endDate = $endDateInput . " 23:59:59";
    }

    $wherePage = "";
    $params = [$startDate, $endDate];
    $params_total = [$endDate];

    if ($pageId) {
        $wherePage = " AND page_id = ?";
        $params[] = $pageId;
        $params_total[] = $pageId;
    }

    // 1. New Followers (Subscribers joined in period)
    $sqlNewFollowers = "SELECT DATE_FORMAT(created_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(*) as count 
                        FROM meta_subscribers 
                        WHERE created_at BETWEEN ? AND ? $wherePage
                        GROUP BY date_key";
    $stmt = $pdo->prepare($sqlNewFollowers);
    $stmt->execute($params);
    $newFollowersData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 2. Total Followers (Cumulative as of End Date)
    $sqlTotalFollowersEnd = "SELECT COUNT(*) FROM meta_subscribers WHERE created_at <= ? $wherePage";
    $stmt = $pdo->prepare($sqlTotalFollowersEnd);
    $stmt->execute($params_total);
    $totalFollowersEnd = (int) $stmt->fetchColumn();

    // 3. Interactions (Unique Senders who are NOT in subscribers table? Or just general interactions?)
    // For Meta, we'll count unique senders of INBOUND messages who are NOT subscribers yet.
    // However, logic might be complex. Let's simplfy to "Non-Subscriber Interactions" 
    // or just "Active Users" like Zalo's "Tương tác khách lạ" (Users who messaged but aren't followers).
    // For simplicity and performance, Zalo's logic is "is_follower = 0".
    // In Meta, we treat all who message as subscribers usually? 
    // Let's count inbound messages from people NOT in meta_subscribers (if possible) or just ALL inbound interactions.
    // Matching Zalo: "Tương tác (Chưa quan tâm)"
    // 3. Interactions (Unique Senders of Inbound Messages)
    $sqlInteractions = "SELECT DATE_FORMAT(created_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(DISTINCT psid) as count 
                        FROM meta_message_logs 
                        WHERE direction = 'inbound' AND created_at BETWEEN ? AND ? $wherePage
                        GROUP BY date_key";
    $stmt = $pdo->prepare($sqlInteractions);
    $stmt->execute($params);
    $interactionsData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 4. Automation Triggers (e.g. AI Replies, Keywords)
    // We need to log automation triggers to count this accurately. 
    // For now, let's count OUTBOUND messages that are AI or Keyword based?
    // Let's count rows in meta_message_logs where direction='outbound' and potentially type is automation?
    // meta_message_logs doesn't have 'type'. 
    // Let's assume all outbound from bot are automation for now.
    $sqlAutomation = "SELECT DATE_FORMAT(created_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(*) as count 
                      FROM meta_message_logs 
                      WHERE direction = 'outbound' AND created_at BETWEEN ? AND ? $wherePage
                      GROUP BY date_key";
    $stmt = $pdo->prepare($sqlAutomation);
    $stmt->execute($params);
    $automationData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $finalData = [];
    if ($period === 'month') {
        $startDt = new DateTime($startDate);
        $endDt = new DateTime($endDate);
        $current = clone $startDt;
        $current->modify('first day of this month');
        while ($current <= $endDt) {
            $key = $current->format('Y-m');
            $finalData[] = [
                'date' => $key,
                'label' => "T" . $current->format('m/Y'),
                'new_followers' => (int) ($newFollowersData[$key] ?? 0),
                'non_follower_interactions' => (int) ($interactionsData[$key] ?? 0), // Mapping 'Interactions' to Zalo's 'Non-follower interactions' slot
                'total_followers' => $totalFollowersEnd, // Constant for now or recalculate? Zalo sends total at end.
                'automation' => (int) ($automationData[$key] ?? 0)
            ];
            $current->modify('+1 month');
        }
    } else {
        $currentTs = strtotime($startDate);
        $endTs = strtotime($endDate);
        while ($currentTs <= $endTs) {
            $key = date('Y-m-d', $currentTs);
            $finalData[] = [
                'date' => $key,
                'label' => date('d/m', $currentTs),
                'new_followers' => (int) ($newFollowersData[$key] ?? 0),
                'non_follower_interactions' => (int) ($interactionsData[$key] ?? 0),
                'total_followers' => $totalFollowersEnd,
                'automation' => (int) ($automationData[$key] ?? 0)
            ];
            $currentTs = strtotime('+1 day', $currentTs);
        }
    }

    // --- NEW: Summary Metrics (Active Users Breakdown) ---
    // 1. Total Chat (Unique Active Users in period)
    $sqlTotalChat = "SELECT COUNT(DISTINCT psid) FROM meta_message_logs 
                     WHERE direction = 'inbound' AND created_at BETWEEN ? AND ? $wherePage";
    $stmt = $pdo->prepare($sqlTotalChat);
    $stmt->execute($params);
    $totalChat = (int) $stmt->fetchColumn();

    // 2. Has Lead Info (Active Users who have Email OR Phone)
    // We utilize meta_subscribers directly as it stores captured email/phone per page scope
    $wherePageJoined = $pageId ? " AND m.page_id = ?" : "";
    $sqlHasLead = "SELECT COUNT(DISTINCT m.psid) 
                   FROM meta_message_logs m
                   INNER JOIN meta_subscribers ms ON m.psid = ms.psid AND m.page_id = ms.page_id
                   WHERE m.direction = 'inbound' 
                   AND m.created_at BETWEEN ? AND ? $wherePageJoined
                   AND (ms.email IS NOT NULL AND ms.email != '' OR ms.phone IS NOT NULL AND ms.phone != '')";
    $stmt = $pdo->prepare($sqlHasLead);
    $stmt->execute($params);
    $hasLead = (int) $stmt->fetchColumn();

    // 3. No Lead Info
    $noLead = $totalChat - $hasLead;

    // 4. Automation (Total triggers) - Already queried as $automationData sum, but let's do a quick total count query for accuracy
    $sqlAutoTotal = "SELECT COUNT(*) FROM meta_message_logs 
                     WHERE direction = 'outbound' AND created_at BETWEEN ? AND ? $wherePage";
    $stmt = $pdo->prepare($sqlAutoTotal);
    $stmt->execute($params);
    $totalAutomation = (int) $stmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'data' => $finalData,
        'summary' => [
            'total_chat' => $totalChat,
            'has_lead' => $hasLead,
            'no_lead' => $noLead,
            'automation' => $totalAutomation
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
?>
