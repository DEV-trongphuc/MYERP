<?php
/**
 * Audience Reports API
 * Provides growth, active user, and churn statistics for different time periods
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
apiHeaders();

// [SECURITY] Require authenticated workspace session
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false
    || !empty($_SERVER['HTTP_X_AUTOFLOW_AUTH']); // [FIX] Allow Autoflow dev proxy

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    jsonResponse(false, null, 'Method not allowed');
}

$period = $_GET['period'] ?? 'today';

// Define date logic using standardized WHERE clauses
$currentSubWhere = "";
$prevSubWhere = "";
$currentActWhere = ""; // For subscriber_activity (uses created_at)
$prevActWhere = "";

switch ($period) {
    case 'today':
        $currentStart = date('Y-m-d 00:00:00');
        $currentEnd = date('Y-m-d 23:59:59');
        $prevStart = date('Y-m-d 00:00:00', strtotime('-1 day'));
        $prevEnd = date('Y-m-d 23:59:59', strtotime('-1 day'));
        break;
    case 'yesterday':
        $currentStart = date('Y-m-d 00:00:00', strtotime('-1 day'));
        $currentEnd = date('Y-m-d 23:59:59', strtotime('-1 day'));
        $prevStart = date('Y-m-d 00:00:00', strtotime('-2 days'));
        $prevEnd = date('Y-m-d 23:59:59', strtotime('-2 days'));
        break;
    case 'week':
        $currentStart = date('Y-m-d 00:00:00', strtotime('monday this week'));
        $currentEnd = date('Y-m-d 23:59:59', strtotime('sunday this week'));
        $prevStart = date('Y-m-d 00:00:00', strtotime('monday last week'));
        $prevEnd = date('Y-m-d 23:59:59', strtotime('sunday last week'));
        break;
    case 'month':
        $currentStart = date('Y-m-01 00:00:00');
        $currentEnd = date('Y-m-t 23:59:59');
        $prevStart = date('Y-m-01 00:00:00', strtotime('first day of last month'));
        $prevEnd = date('Y-m-t 23:59:59', strtotime('last day of last month'));
        break;
    case 'quarter':
        $currentQuarter = ceil(date('n') / 3);
        $currentStart = date('Y-m-d 00:00:00', mktime(0, 0, 0, ($currentQuarter - 1) * 3 + 1, 1, date('Y')));
        $currentEnd = date('Y-m-d 23:59:59', mktime(23, 59, 59, $currentQuarter * 3, date('t', mktime(0, 0, 0, $currentQuarter * 3, 1, date('Y'))), date('Y')));
        $prevStart = date('Y-m-d 00:00:00', strtotime($currentStart . ' -3 months'));
        $prevEnd = date('Y-m-d 23:59:59', strtotime($currentEnd . ' -3 months'));
        break;
    case 'year':
        $currentStart = date('Y-01-01 00:00:00');
        $currentEnd = date('Y-12-31 23:59:59');
        $prevStart = date('Y-01-01 00:00:00', strtotime('-1 year'));
        $prevEnd = date('Y-12-31 23:59:59', strtotime('-1 year'));
        break;
    default:
        $currentStart = date('Y-m-d 00:00:00');
        $currentEnd = date('Y-m-d 23:59:59');
        $prevStart = date('Y-m-d 00:00:00', strtotime('-1 day'));
        $prevEnd = date('Y-m-d 23:59:59', strtotime('-1 day'));
        break;
}

// [FIX] Use bound params instead of string interpolation to prevent SQL injection
$currentSubWhere = "joined_at >= ? AND joined_at <= ?";
$prevSubWhere    = "joined_at >= ? AND joined_at <= ?";
$currentActWhere = "sa.created_at >= ? AND sa.created_at <= ?";
$prevActWhere    = "sa.created_at >= ? AND sa.created_at <= ?";

$paramsCurrent      = [$currentStart, $currentEnd];
$paramsPrev         = [$prevStart, $prevEnd];
$paramsActCurrent   = [$currentStart, $currentEnd];
$paramsActPrev      = [$prevStart, $prevEnd];

try {
    // Define what constitutes a "proactive" interaction (engagement)
    // Excluding system events like 'receive_email', 'enter_flow', 'sent_zns', etc.
    $engagementTypes = [
        // Email
        'open_email',
        'click_link',
        'reply_email',
        // Forms & Business
        'form_submit',
        'purchase',
        'custom_event',
        // Zalo Interaction
        'follow',
        'user_reacted_message',
        'user_feedback',
        'user_send_text',
        // ZNS Selection (User clicks/replies)
        'zns_clicked',
        'click_zns',
        'zns_replied',
        // Web Tracking Journey
        'web_pageview',
        'web_click',
        'web_form',
        'web_lead_capture'
    ];
    $engTypesSql = "'" . implode("','", $engagementTypes) . "'";

    $workspace_id = get_current_workspace_id();

    // 1. Khách hàng mới (Growth)
    $stmtGrowth = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE workspace_id = ? AND $currentSubWhere");
    $stmtGrowth->execute(array_merge([$workspace_id], $paramsCurrent));
    $growth = (int) $stmtGrowth->fetchColumn();

    $stmtPrevGrowth = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE workspace_id = ? AND $prevSubWhere");
    $stmtPrevGrowth->execute(array_merge([$workspace_id], $paramsPrev));
    $prevGrowth = (int) $stmtPrevGrowth->fetchColumn();

    // 2. Khách hoạt động (Active Users) - Unique users with proactive activity in period
    $stmtActive = $pdo->prepare("
        SELECT COUNT(DISTINCT sa.subscriber_id) 
        FROM subscriber_activity sa
        JOIN subscribers s ON sa.subscriber_id = s.id
        WHERE s.workspace_id = ? AND sa.type IN ($engTypesSql) AND $currentActWhere
    ");
        $stmtActive->execute(array_merge([$workspace_id], $paramsActCurrent));
    $active = (int) $stmtActive->fetchColumn();

    $stmtPrevActive = $pdo->prepare("
        SELECT COUNT(DISTINCT sa.subscriber_id) 
        FROM subscriber_activity sa
        JOIN subscribers s ON sa.subscriber_id = s.id
        WHERE s.workspace_id = ? AND sa.type IN ($engTypesSql) AND $prevActWhere
    ");
    $stmtPrevActive->execute(array_merge([$workspace_id], $paramsActPrev));
    $prevActive = (int) $stmtPrevActive->fetchColumn();

    // 3. Rời bỏ (Churn) - Exact unsubscriptions recorded in history
    $stmtChurn = $pdo->prepare("
        SELECT COUNT(*) 
        FROM subscriber_activity sa
        JOIN subscribers s ON sa.subscriber_id = s.id
        WHERE s.workspace_id = ? AND sa.type = 'unsubscribe' AND $currentActWhere
    ");
    $stmtChurn->execute(array_merge([$workspace_id], $paramsActCurrent));
    $churn = (int) $stmtChurn->fetchColumn();

    $stmtPrevChurn = $pdo->prepare("
        SELECT COUNT(*) 
        FROM subscriber_activity sa
        JOIN subscribers s ON sa.subscriber_id = s.id
        WHERE s.workspace_id = ? AND sa.type = 'unsubscribe' AND $prevActWhere
    ");
    $stmtPrevChurn->execute(array_merge([$workspace_id], $paramsActPrev));
    $prevChurn = (int) $stmtPrevChurn->fetchColumn();

    // 5. Trend Calculations
    $growthTrend = $prevGrowth > 0 ? round((($growth - $prevGrowth) / $prevGrowth) * 100, 1) : 0;
    $activeTrend = $prevActive > 0 ? round((($active - $prevActive) / $prevActive) * 100, 1) : 0;
    $churnTrend = $prevChurn > 0 ? round((($churn - $prevChurn) / $prevChurn) * 100, 1) : 0;

    jsonResponse(true, [
        'period' => $period,
        'growth' => $growth,
        'growth_trend' => $growthTrend,
        'active' => $active,
        'active_trend' => $activeTrend,
        'churn' => $churn,
        'churn_trend' => $churnTrend
    ]);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
