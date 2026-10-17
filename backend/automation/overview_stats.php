<?php
require_once 'bootstrap.php';
require_once 'auth_middleware.php'; // [FIX] Dashboard stats must be workspace-scoped

header('Content-Type: application/json');

$workspace_id = get_current_workspace_id();
// [SECURITY FIX] Enforce that the user actually has access to this workspace
require_permission($pdo, 'view_dashboard', $workspace_id);

// ─── NEW: Email Sent Chart Route ──────────────────────────────────────────────
if (isset($_GET['route']) && $_GET['route'] === 'email_sent_chart') {
    $mode  = $_GET['mode']  ?? 'yearly';  // 'yearly' = by month, 'monthly' = by day
    $year  = (int)($_GET['year']  ?? date('Y'));
    $month = (int)($_GET['month'] ?? date('n'));

    try {
        if ($mode === 'yearly') {
            // Group by month in given year
            $sql = "
                SELECT
                    MONTH(a.created_at)       AS period,
                    COUNT(*)                AS sent
                FROM subscriber_activity a
                JOIN subscribers s ON a.subscriber_id = s.id
                WHERE s.workspace_id = ?
                  AND a.type IN ('receive_email', 'sent_email', 'zns_sent', 'send_zns', 'sent_zns', 'email_sent', 'send_email', 'sent')
                  AND YEAR(a.created_at) = ?
                GROUP BY MONTH(a.created_at)
                ORDER BY period
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$workspace_id, $year]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Build full 12-month series
            $map = [];
            foreach ($rows as $r) $map[(int)$r['period']] = (int)$r['sent'];

            $viMonths = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
            $data = [];
            for ($m = 1; $m <= 12; $m++) {
                $data[] = [
                    'label' => $viMonths[$m - 1],
                    'sent'  => $map[$m] ?? 0,
                ];
            }

            // Total and peak
            $total = array_sum(array_column($data, 'sent'));
            $peak  = !empty($data) ? max(array_column($data, 'sent')) : 0;

        } else {
            // mode = monthly → group by day in given month/year
            $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
            $startDate   = sprintf('%04d-%02d-01 00:00:00', $year, $month);
            $endDate     = sprintf('%04d-%02d-%02d 23:59:59', $year, $month, $daysInMonth);

            $sql = "
                SELECT
                    DAY(a.created_at)     AS period,
                    COUNT(*)            AS sent
                FROM subscriber_activity a
                JOIN subscribers s ON a.subscriber_id = s.id
                WHERE s.workspace_id = ?
                  AND a.type IN ('receive_email', 'sent_email', 'email_sent', 'send_email', 'sent', 'zns_sent', 'send_zns', 'sent_zns')
                  AND a.created_at BETWEEN ? AND ?
                GROUP BY DAY(a.created_at)
                ORDER BY period
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$workspace_id, $startDate, $endDate]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $map = [];
            foreach ($rows as $r) $map[(int)$r['period']] = (int)$r['sent'];

            $data = [];
            for ($d = 1; $d <= $daysInMonth; $d++) {
                $data[] = [
                    'label' => (string)$d,
                    'sent'  => $map[$d] ?? 0,
                ];
            }

            $total = array_sum(array_column($data, 'sent'));
            $peak  = !empty($data) ? max(array_column($data, 'sent')) : 0;
        }

        // Available years (for year picker)
        $stmtYears = $pdo->prepare("
            SELECT DISTINCT YEAR(a.created_at) as y
            FROM subscriber_activity a
            JOIN subscribers s ON a.subscriber_id = s.id
            WHERE s.workspace_id = ?
              AND a.type IN ('receive_email', 'sent_email', 'email_sent', 'send_email', 'sent', 'zns_sent', 'send_zns', 'sent_zns')
            ORDER BY y DESC
            LIMIT 5
        ");
        $stmtYears->execute([$workspace_id]);
        $years = array_column($stmtYears->fetchAll(PDO::FETCH_ASSOC), 'y') ?: [date('Y')];

        echo json_encode([
            'success' => true,
            'data'    => $data,
            'summary' => ['total' => $total, 'peak' => $peak],
            'years'   => array_values(array_unique($years)),
        ], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}
// ─────────────────────────────────────────────────────────────────────────────

// Get the days explicitly
$days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
if ($days < 1 || $days > 90) {
    $days = 7;
}

$startDate = date('Y-m-d 00:00:00', strtotime("-$days days"));
$endDate = date('Y-m-d 23:59:59');

// [PERF] APCu cache — Dashboard stats are expensive (6 JOIN queries).
// Cache per workspace+days for 5 minutes. Invalidated on page refresh (F5) by passing ?bust=1.
$cacheKey = "dashboard_stats_{$workspace_id}_{$days}";
$forceRefresh = isset($_GET['bust']) && $_GET['bust'] === '1';
if (!$forceRefresh && function_exists('apcu_fetch')) {
    $cached = apcu_fetch($cacheKey);
    if ($cached !== false) {
        echo $cached;
        exit;
    }
}

try {
    // 1. Web Traffic Analytics — leverages idx_wv_prop_last_visit on web_visitors (property_id, last_visit_at)
    $stmtWeb = $pdo->prepare("
        SELECT DATE(v.last_visit_at) as date, COUNT(*) as count 
        FROM web_visitors v
        JOIN web_properties wp ON v.property_id = wp.id
        WHERE wp.workspace_id = ? AND v.last_visit_at BETWEEN ? AND ? 
        GROUP BY DATE(v.last_visit_at)
    ");
    $stmtWeb->execute([$workspace_id, $startDate, $endDate]);
    $rawWebStats = $stmtWeb->fetchAll(PDO::FETCH_KEY_PAIR);

    // Fallback to web_page_views if web_visitors has no records for the range
    if (empty($rawWebStats)) {
        $stmtWpv = $pdo->prepare("
            SELECT DATE(pv.loaded_at) as date, COUNT(*) as count 
            FROM web_page_views pv
            JOIN web_properties wp ON pv.property_id = wp.id
            WHERE wp.workspace_id = ? AND pv.loaded_at BETWEEN ? AND ? 
            GROUP BY DATE(pv.loaded_at)
        ");
        $stmtWpv->execute([$workspace_id, $startDate, $endDate]);
        $rawWebStats = $stmtWpv->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    // 2. AI Messages — scoped by JOINing domation_ai_conversations -> web_properties
    $stmtAi = $pdo->prepare("
        SELECT DATE(m.created_at) as date, COUNT(*) as count 
        FROM domation_ai_messages m
        JOIN domation_ai_conversations c ON m.conversation_id = c.id
        JOIN web_properties wp ON c.property_id = wp.id
        WHERE wp.workspace_id = ? 
        AND m.sender IN ('ai', 'bot', 'model') 
        AND m.created_at BETWEEN ? AND ? 
        GROUP BY DATE(m.created_at)
    ");
    $stmtAi->execute([$workspace_id, $startDate, $endDate]);
    $rawAiStats = $stmtAi->fetchAll(PDO::FETCH_KEY_PAIR);

    // 3. New Leads (subscribers) — leverages idx_sub_ws_status_created (workspace_id, status, created_at)
    $stmtLead = $pdo->prepare("
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM subscribers 
        WHERE workspace_id = ? AND created_at BETWEEN ? AND ? 
        GROUP BY DATE(created_at)
    ");
    $stmtLead->execute([$workspace_id, $startDate, $endDate]);
    $rawLeadStats = $stmtLead->fetchAll(PDO::FETCH_KEY_PAIR);

    // Fallback if legacy rows only have joined_at populated
    if (empty($rawLeadStats)) {
        $stmtLeadJoined = $pdo->prepare("
            SELECT DATE(joined_at) as date, COUNT(*) as count 
            FROM subscribers 
            WHERE workspace_id = ? AND joined_at BETWEEN ? AND ? 
            GROUP BY DATE(joined_at)
        ");
        $stmtLeadJoined->execute([$workspace_id, $startDate, $endDate]);
        $rawLeadStats = $stmtLeadJoined->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    // Prepare Date Range Series with { date, value, label, web, ai, leads }
    $chartData = [];
    $totalWeb = 0;
    $totalAi = 0;
    $totalLeads = 0;

    for ($i = $days - 1; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $w = (int)($rawWebStats[$d] ?? 0);
        $a = (int)($rawAiStats[$d] ?? 0);
        $l = (int)($rawLeadStats[$d] ?? 0);

        $totalWeb += $w;
        $totalAi += $a;
        $totalLeads += $l;

        $dateLabel = date('d/m', strtotime($d));
        $chartData[] = [
            'date'      => $dateLabel,
            'label'     => $dateLabel,
            'full_date' => $d,
            'value'     => $w + $a + $l,
            'web'       => $w,
            'ai'        => $a,
            'leads'     => $l,
        ];
    }

    // 4. Top Campaigns — scoped by workspace_id, leverages idx_camp_ws_status_created (workspace_id, status, created_at)
    $stmtCamp = $pdo->prepare("
        SELECT id, name, type, status, count_opened as stat_total_opened, count_sent as stat_total_sent, count_clicked as stat_total_clicked, config, sender_name, sender_email, created_at, sent_at 
        FROM campaigns 
        WHERE workspace_id = ? AND status IN ('sent', 'sending', 'scheduled') 
        ORDER BY created_at DESC 
        LIMIT 5
    ");
    $stmtCamp->execute([$workspace_id]);
    $topCampaigns = [];
    while ($row = $stmtCamp->fetch(PDO::FETCH_ASSOC)) {
        if (!empty($row['config'])) {
            $row['config'] = json_decode($row['config'], true);
        } else {
            $row['config'] = null;
        }
        $row['stat_total_opened'] = (int)($row['stat_total_opened'] ?? 0);
        $row['stat_total_sent'] = (int)($row['stat_total_sent'] ?? 0);
        $row['stat_total_clicked'] = (int)($row['stat_total_clicked'] ?? 0);
        $topCampaigns[] = $row;
    }

    // 5. Top Flows — scoped by workspace_id, leverages idx_flows_ws_status_upd (workspace_id, status, updated_at)
    $stmtFlow = $pdo->prepare("
        SELECT id, name, trigger_type, stat_enrolled, stat_completed, updated_at 
        FROM flows 
        WHERE workspace_id = ? AND status = 'active' 
        ORDER BY stat_enrolled DESC, updated_at DESC 
        LIMIT 5
    ");
    $stmtFlow->execute([$workspace_id]);
    $topFlows = [];
    while ($row = $stmtFlow->fetch(PDO::FETCH_ASSOC)) {
        $row['stat_enrolled'] = (int)($row['stat_enrolled'] ?? 0);
        $row['stat_completed'] = (int)($row['stat_completed'] ?? 0);
        $topFlows[] = $row;
    }

    // --- ADVANCED: Calculate "Percentage Growth" vs Previous Period ---
    $prevStart = date('Y-m-d 00:00:00', strtotime("-" . ($days * 2) . " days"));
    $prevEnd = date('Y-m-d 23:59:59', strtotime("-" . ($days + 1) . " days"));

    $stmtWebPrev = $pdo->prepare("
        SELECT COUNT(*) 
        FROM web_visitors v
        JOIN web_properties wp ON v.property_id = wp.id
        WHERE wp.workspace_id = ? AND v.last_visit_at BETWEEN ? AND ?
    ");
    $stmtWebPrev->execute([$workspace_id, $prevStart, $prevEnd]);
    $prevWeb = (int)$stmtWebPrev->fetchColumn();
    if ($prevWeb === 0) {
        $stmtWpvPrev = $pdo->prepare("
            SELECT COUNT(*) 
            FROM web_page_views pv
            JOIN web_properties wp ON pv.property_id = wp.id
            WHERE wp.workspace_id = ? AND pv.loaded_at BETWEEN ? AND ?
        ");
        $stmtWpvPrev->execute([$workspace_id, $prevStart, $prevEnd]);
        $prevWeb = (int)$stmtWpvPrev->fetchColumn();
    }

    $stmtAiPrev = $pdo->prepare("
        SELECT COUNT(*) 
        FROM domation_ai_messages m
        JOIN domation_ai_conversations c ON m.conversation_id = c.id
        JOIN web_properties wp ON c.property_id = wp.id
        WHERE wp.workspace_id = ? 
        AND m.sender IN ('ai', 'bot', 'model') 
        AND m.created_at BETWEEN ? AND ?
    ");
    $stmtAiPrev->execute([$workspace_id, $prevStart, $prevEnd]);
    $prevAi = (int)$stmtAiPrev->fetchColumn();

    $stmtLeadPrev = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE workspace_id = ? AND created_at BETWEEN ? AND ?");
    $stmtLeadPrev->execute([$workspace_id, $prevStart, $prevEnd]);
    $prevLead = (int)$stmtLeadPrev->fetchColumn();
    if ($prevLead === 0) {
        $stmtLeadPrevJoined = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE workspace_id = ? AND joined_at BETWEEN ? AND ?");
        $stmtLeadPrevJoined->execute([$workspace_id, $prevStart, $prevEnd]);
        $prevLead = (int)$stmtLeadPrevJoined->fetchColumn();
    }

    $calcGrowth = function($current, $prev) {
        if ($prev == 0) return $current > 0 ? 100 : 0;
        return round((($current - $prev) / $prev) * 100, 1);
    };

    $growthWeb = $calcGrowth($totalWeb, $prevWeb);
    $growthAi = $calcGrowth($totalAi, $prevAi);
    $growthLeads = $calcGrowth($totalLeads, $prevLead);

    http_response_code(200);
    $responseJson = json_encode([
        'success' => true,
        'summary' => [
            'total_web'    => (int)$totalWeb,
            'growth_web'   => (float)$growthWeb,
            'total_ai'     => (int)$totalAi,
            'growth_ai'    => (float)$growthAi,
            'total_leads'  => (int)$totalLeads,
            'growth_leads' => (float)$growthLeads,
        ],
        'chart_data'    => $chartData,
        'top_campaigns' => $topCampaigns,
        'top_flows'     => $topFlows
    ], JSON_UNESCAPED_UNICODE);

    // [PERF] Store in APCu for 5 minutes
    if (function_exists('apcu_store')) {
        apcu_store($cacheKey, $responseJson, 300);
    }

    echo $responseJson;

} catch (\Throwable $e) {
    http_response_code(200);
    echo json_encode([
        'success'       => false,
        'message'       => 'Lỗi hệ thống, vui lòng thử lại.',
        'summary'       => [
            'total_web'    => 0,
            'growth_web'   => 0,
            'total_ai'     => 0,
            'growth_ai'    => 0,
            'total_leads'  => 0,
            'growth_leads' => 0,
        ],
        'chart_data'    => [],
        'top_campaigns' => [],
        'top_flows'     => []
    ], JSON_UNESCAPED_UNICODE);
}

