<?php
/**
 * Zalo Automation Stats API
 * Returns Summary and Logs for a specific Scenario
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';

header('Content-Type: application/json');

$scenarioId = $_GET['id'] ?? '';
$route = $_GET['route'] ?? 'summary';

if (!$scenarioId) {
    echo json_encode(['success' => false, 'message' => 'Scenario ID required']);
    exit;
}

try {
    if ($route === 'summary') {
        // Count Sent (automation_trigger)
        $stmtSent = $pdo->prepare("SELECT COUNT(*) FROM zalo_subscriber_activity WHERE reference_id = ? AND type = 'automation_trigger'");
        $stmtSent->execute([$scenarioId]);
        $sentCount = $stmtSent->fetchColumn();

        // Count Clicks (click_link)
        $stmtClicks = $pdo->prepare("SELECT COUNT(*) FROM zalo_subscriber_activity WHERE reference_id = ? AND type = 'click_link'");
        $stmtClicks->execute([$scenarioId]);
        $clickCount = $stmtClicks->fetchColumn();

        // Aggregation by Button (details)
        $stmtBtns = $pdo->prepare("SELECT details, COUNT(*) as count FROM zalo_subscriber_activity WHERE reference_id = ? AND type = 'click_link' GROUP BY details ORDER BY count DESC");
        $stmtBtns->execute([$scenarioId]);
        $btnStats = $stmtBtns->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => [
                'sent' => $sentCount,
                'clicks' => $clickCount,
                'ctr' => $sentCount > 0 ? round(($clickCount / $sentCount) * 100, 1) . '%' : '0%',
                'button_stats' => $btnStats
            ]
        ]);
    } elseif ($route === 'logs') {
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $search = $_GET['q'] ?? '';
        $btnFilter = $_GET['btn'] ?? '';
        $limit = 20;
        $offset = ($page - 1) * $limit;

        $where = "WHERE za.reference_id = ? AND za.type IN ('automation_trigger', 'click_link')";
        $params = [$scenarioId];

        if ($search) {
            $where .= " AND (zs.display_name LIKE ? OR zs.zalo_user_id LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($btnFilter) {
            // Filter by the raw label stored in 'details' of activity
            $where .= " AND za.details = ?";
            $params[] = $btnFilter;
        }

        $stmtLogs = $pdo->prepare("
            SELECT za.created_at, za.type, za.details, zs.display_name, zs.avatar
            FROM zalo_subscriber_activity za
            LEFT JOIN zalo_subscribers zs ON za.subscriber_id = zs.id
            $where
            ORDER BY za.created_at DESC
            LIMIT " . (int) $limit . " OFFSET " . (int) $offset . "
        ");

        $stmtLogs->execute($params);
        $logs = $stmtLogs->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $logs]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
