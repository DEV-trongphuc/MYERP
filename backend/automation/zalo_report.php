<?php
/**
 * Zalo Growth Report API - Refined Metrics
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit(0);

// [SECURITY] Require authenticated workspace session
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $period = $_GET['period'] ?? 'month';
    $oaId = $_GET['oa_id'] ?? '';
    $startDateInput = $_GET['start_date'] ?? null;
    $endDateInput = $_GET['end_date'] ?? null;

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

    $whereOA = "";
    $whereOA_sub = "";
    $params = [$startDate, $endDate];
    $params_total = [$endDate];

    if ($oaId) {
        $whereOA = " AND s.zalo_list_id IN (SELECT id FROM zalo_lists WHERE oa_config_id = ?)";
        $whereOA_sub = " AND zs.zalo_list_id IN (SELECT id FROM zalo_lists WHERE oa_config_id = ?)";
        $params[] = $oaId;
        $params_total[] = $oaId;
    }

    // 1. New Followers
    $sqlNewFollowers = "SELECT DATE_FORMAT(joined_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(*) as count 
                        FROM zalo_subscribers s
                        WHERE joined_at BETWEEN ? AND ? AND is_follower = 1 $whereOA
                        GROUP BY date_key";
    $stmt = $pdo->prepare($sqlNewFollowers);
    $stmt->execute($params);
    $newFollowersData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 2. Total Followers (Cumulative as of End Date)
    $sqlTotalFollowersEnd = "SELECT COUNT(*) FROM zalo_subscribers s WHERE joined_at <= ? AND is_follower = 1 $whereOA";
    $stmt = $pdo->prepare($sqlTotalFollowersEnd);
    $stmt->execute($params_total);
    $totalFollowersEnd = (int) $stmt->fetchColumn();

    // 3. New Visitors (Strictly Non-followers Growth)
    // Users who JOINED in this period but are NOT followers (is_follower = 0)
    $sqlNewVisitors = "SELECT DATE_FORMAT(joined_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(*) as count 
                       FROM zalo_subscribers s
                       WHERE joined_at BETWEEN ? AND ? AND is_follower = 0 $whereOA
                       GROUP BY date_key";

    $stmt = $pdo->prepare($sqlNewVisitors);
    $stmt->execute($params); // Use standard params (start, end, optional OA)
    $newVisitorsData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 4. Automation Triggers
    $sqlAutomation = "SELECT DATE_FORMAT(za.created_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(*) as count 
                      FROM zalo_subscriber_activity za
                      WHERE za.type = 'automation_trigger' AND za.created_at BETWEEN ? AND ?
                      " . ($oaId ? " AND za.subscriber_id IN (SELECT zs.id FROM zalo_subscribers zs JOIN zalo_lists zl ON zs.zalo_list_id = zl.id WHERE zl.oa_config_id = ?)" : "") . "
                      GROUP BY date_key";
    $stmt = $pdo->prepare($sqlAutomation);
    $stmt->execute($params);
    $automationData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 5. ZNS/ZBS Sent Success
    $sqlSent = "SELECT DATE_FORMAT(created_at, '" . ($period === 'month' ? '%Y-%m' : '%Y-%m-%d') . "') as date_key, COUNT(*) as count 
                FROM zalo_delivery_logs 
                WHERE status = 'sent' AND created_at BETWEEN ? AND ?
                " . ($oaId ? " AND oa_config_id = ?" : "") . "
                GROUP BY date_key";
    $stmt = $pdo->prepare($sqlSent);
    $stmt->execute($params);
    $sentData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

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
                'non_follower_interactions' => (int) ($newVisitorsData[$key] ?? 0),
                'total_followers' => $totalFollowersEnd,
                'automation' => (int) ($automationData[$key] ?? 0),
                'sent_zns' => (int) ($sentData[$key] ?? 0)
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
                'non_follower_interactions' => (int) ($newVisitorsData[$key] ?? 0),
                'total_followers' => $totalFollowersEnd,
                'automation' => (int) ($automationData[$key] ?? 0),
                'sent_zns' => (int) ($sentData[$key] ?? 0)
            ];
            $currentTs = strtotime('+1 day', $currentTs);
        }
    }

    echo json_encode(['success' => true, 'data' => $finalData]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
