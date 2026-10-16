<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php'; // [FIX P43-K] Add auth + workspace isolation
apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$startDate = $_GET['startDate'] ?? date('Y-m-01');
$endDate = $_GET['endDate'] ?? date('Y-m-d');

if ($method !== 'GET') {
    jsonResponse(false, null, 'Method not allowed');
}

try {
    $startDateFull = $startDate . " 00:00:00";
    $endDateFull = $endDate . " 23:59:59";
    $campaignId = $_GET['campaignId'] ?? null;

    if ($campaignId) {
        // [FIX P43-K1] Verify campaign belongs to workspace before returning A/B breakdown
        $stmtOwn = $pdo->prepare("SELECT id FROM campaigns WHERE id = ? AND workspace_id = ?");
        $stmtOwn->execute([$campaignId, $workspace_id]);
        if (!$stmtOwn->fetchColumn())
            jsonResponse(false, null, 'Campaign không tồn tại hoặc không có quyền truy cập');

        $sqlAB = "SELECT 
            variation,
            SUM(CASE WHEN type IN ('sent_email', 'receive_email', 'sent_zns', 'zns_sent', 'zalo_sent') THEN 1 ELSE 0 END) as sent,
            COUNT(DISTINCT CASE WHEN type = 'open_email' THEN subscriber_id END) as opened,
            COUNT(DISTINCT CASE WHEN type IN ('click_link', 'zalo_clicked', 'zns_clicked', 'click_zns') THEN subscriber_id END) as clicked,
            SUM(CASE WHEN type IN ('sent_zns', 'zns_sent', 'zalo_sent') THEN 1 ELSE 0 END) as zalo_sent,
            COUNT(DISTINCT CASE WHEN type IN ('zalo_clicked', 'zns_clicked', 'click_zns') THEN subscriber_id END) as zalo_clicked
        FROM subscriber_activity 
        WHERE campaign_id = ?
        GROUP BY variation";
        $stmtAB = $pdo->prepare($sqlAB);
        $stmtAB->execute([$campaignId]);
        $abBreakdown = $stmtAB->fetchAll(PDO::FETCH_ASSOC);

        foreach ($abBreakdown as &$row) {
            foreach ($row as $k => $v) {
                if ($k !== 'variation')
                    $row[$k] = (int) $v;
            }
        }

        jsonResponse(true, ['campaignId' => $campaignId, 'breakdown' => $abBreakdown]);
        exit;
    }

    // --- CACHE LAYER (File Based) ---
    // [CRITICAL FIX] Added $workspace_id to cache key. 
    // Previously, users from different workspaces shared the same cache if they picked the same dates!
    $cacheKey = md5("report_v2_" . $workspace_id . "_" . $startDateFull . "_" . $endDateFull); 
    $cacheFile = __DIR__ . '/../cache/' . $cacheKey . '.json';
    $cacheTTL = 3600; // 1 hour

    // Ensure cache dir exists
    if (!file_exists(__DIR__ . '/../cache')) {
        @mkdir(__DIR__ . '/../cache', 0777, true);
    }

    // Serve from cache if fresh
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTTL)) {
        $cachedData = json_decode(file_get_contents($cacheFile), true);
        if ($cachedData) {
            $cachedData['cached'] = true; // Debug flag
            jsonResponse(true, $cachedData);
            exit;
        }
    }

    // ... Original Data Fetching ...

    // 1. Tổng hợp số liệu Metrics (Optimized with index-friendly ranges)
    // [FIX P43-K2] Scope metrics to workspace via subscriber activity JOIN
    $sqlMetrics = "SELECT 
        SUM(CASE WHEN sa.type IN ('sent_email', 'receive_email') THEN 1 ELSE 0 END) as sent,
        COUNT(DISTINCT CASE WHEN sa.type = 'open_email' THEN sa.subscriber_id END) as opened,
        COUNT(DISTINCT CASE WHEN sa.type = 'click_link' THEN sa.subscriber_id END) as clicked,
        COUNT(DISTINCT CASE WHEN sa.type = 'unsubscribe' THEN sa.subscriber_id END) as unsubscribed,
        SUM(CASE WHEN sa.type IN ('sent_zns', 'zns_sent', 'zalo_sent') THEN 1 ELSE 0 END) as zalo_sent,
        SUM(CASE WHEN sa.type = 'zns_delivered' THEN 1 ELSE 0 END) as zalo_delivered,
        COUNT(DISTINCT CASE WHEN sa.type IN ('zalo_clicked', 'zns_clicked', 'click_zns') THEN sa.subscriber_id END) as zalo_clicked
    FROM subscriber_activity sa
    JOIN subscribers s ON sa.subscriber_id = s.id
    WHERE s.workspace_id = ? AND sa.created_at >= ? AND sa.created_at <= ?";

    $stmtMetrics = $pdo->prepare($sqlMetrics);
    $stmtMetrics->execute([$workspace_id, $startDateFull, $endDateFull]);
    $metrics = $stmtMetrics->fetch(PDO::FETCH_ASSOC);

    foreach ($metrics as $key => $val) {
        $metrics[$key] = (int) $val;
    }

    // 2. Xu hướng hàng ngày (Daily Trend) - Optimized: Avoid DATE(created_at) in WHERE if possible
    // (Still need DATE() in SELECT for grouping, but created_at range in WHERE ensures index usage)
    // [FIX P43-K3] Scope trend to workspace
    $sqlTrend = "SELECT 
        DATE(sa.created_at) as date,
        SUM(CASE WHEN sa.type IN ('sent_email', 'receive_email') THEN 1 ELSE 0 END) as sent,
        COUNT(DISTINCT CASE WHEN sa.type = 'open_email' THEN sa.subscriber_id END) as opened,
        COUNT(DISTINCT CASE WHEN sa.type = 'click_link' THEN sa.subscriber_id END) as clicked,
        SUM(CASE WHEN sa.type IN ('sent_zns', 'zns_sent', 'zalo_sent') THEN 1 ELSE 0 END) as zalo_sent,
        SUM(CASE WHEN sa.type = 'zns_delivered' THEN 1 ELSE 0 END) as zalo_delivered,
        COUNT(DISTINCT CASE WHEN sa.type IN ('zalo_clicked', 'zns_clicked', 'click_zns') THEN sa.subscriber_id END) as zalo_clicked
    FROM subscriber_activity sa
    JOIN subscribers s ON sa.subscriber_id = s.id
    WHERE s.workspace_id = ? AND sa.created_at >= ? AND sa.created_at <= ?
    GROUP BY DATE(sa.created_at)
    ORDER BY date ASC";

    $stmtTrend = $pdo->prepare($sqlTrend);
    $stmtTrend->execute([$workspace_id, $startDateFull, $endDateFull]);
    $trend = $stmtTrend->fetchAll(PDO::FETCH_ASSOC);

    // [FIX P43-K4] Scope campaigns list to workspace
    $sqlTopCampaigns = "SELECT id, name, count_sent as sent, count_unique_opened as opened, count_unique_clicked as clicked, count_bounced as bounced, count_spam as spam, created_at, status
                        FROM campaigns 
                        WHERE workspace_id = ? AND status != 'draft' AND ((sent_at >= ? AND sent_at <= ?) OR (created_at >= ? AND created_at <= ?))
                        ORDER BY count_unique_opened DESC";
    $stmtTopCampaigns = $pdo->prepare($sqlTopCampaigns);
    $stmtTopCampaigns->execute([$workspace_id, $startDateFull, $endDateFull, $startDateFull, $endDateFull]);
    $topCampaigns = $stmtTopCampaigns->fetchAll(PDO::FETCH_ASSOC);

    // [FIX P43-K5] Scope flows list to workspace
    $sqlTopFlows = "SELECT id, name, stat_total_sent as sent, stat_unique_opened as opened, stat_unique_clicked as clicked, stat_total_failed as failed, created_at, status
                    FROM flows 
                    WHERE workspace_id = ?
                    ORDER BY stat_unique_opened DESC";
    $stmtTopFlows = $pdo->prepare($sqlTopFlows);
    $stmtTopFlows->execute([$workspace_id]);
    $topFlows = $stmtTopFlows->fetchAll(PDO::FETCH_ASSOC);

    $responsePayload = [
        'metrics' => $metrics,
        'trend' => $trend,
        'topCampaigns' => $topCampaigns,
        'topFlows' => $topFlows,
        'range' => ['start' => $startDate, 'end' => $endDate]
    ];

    // Save to cache
    file_put_contents($cacheFile, json_encode($responsePayload));

    jsonResponse(true, $responsePayload);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
