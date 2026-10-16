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
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
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
    // 1. Web Analytics (web_page_views) — scoped by JOINing web_properties
    $stmtWeb = $pdo->prepare("
        SELECT DATE(pv.loaded_at) as date, COUNT(*) as count 
        FROM web_page_views pv
        JOIN web_properties wp ON pv.property_id = wp.id
        WHERE wp.workspace_id = ? AND pv.loaded_at BETWEEN ? AND ? 
        GROUP BY DATE(pv.loaded_at)
    ");
    $stmtWeb->execute([$workspace_id, $startDate, $endDate]);
    $rawWebStats = $stmtWeb->fetchAll(PDO::FETCH_KEY_PAIR);

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

    // 3. New Leads (subscribers) — scoped by workspace_id
    $stmtLead = $pdo->prepare("
        SELECT DATE(joined_at) as date, COUNT(*) as count 
        FROM subscribers 
        WHERE workspace_id = ? AND joined_at BETWEEN ? AND ? 
        GROUP BY DATE(joined_at)
    ");
    $stmtLead->execute([$workspace_id, $startDate, $endDate]);
    $rawLeadStats = $stmtLead->fetchAll(PDO::FETCH_KEY_PAIR);

    // Prepare Date Range Series
    $chartData = [];
    $totalWeb = 0;
    $totalAi = 0;
    $totalLeads = 0;

    for ($i = $days - 1; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $w = $rawWebStats[$d] ?? 0;
        $a = $rawAiStats[$d] ?? 0;
        $l = $rawLeadStats[$d] ?? 0;

        $totalWeb += $w;
        $totalAi += $a;
        $totalLeads += $l;

        $chartData[] = [
            'date' => date('d/m', strtotime($d)),
            'web' => $w,
            'ai' => $a,
            'leads' => $l
        ];
    }

    // 4. Top Campaigns — scoped by workspace_id
    $stmtCamp = $pdo->prepare("
        SELECT name, type, status, count_opened as stat_total_opened, count_sent as stat_total_sent, count_clicked as stat_total_clicked, config, sender_name, sender_email 
        FROM campaigns 
        WHERE workspace_id = ? AND status IN ('sent', 'sending', 'scheduled') 
        ORDER BY sent_at DESC, created_at DESC 
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
        $topCampaigns[] = $row;
    }

    // 5. Top Flows — scoped by workspace_id
    $stmtFlow = $pdo->prepare("
        SELECT name, trigger_type, stat_enrolled, stat_completed 
        FROM flows 
        WHERE workspace_id = ? AND status = 'active' 
        ORDER BY stat_enrolled DESC 
        LIMIT 5
    ");
    $stmtFlow->execute([$workspace_id]);
    $topFlows = $stmtFlow->fetchAll(PDO::FETCH_ASSOC);

    // --- ADVANCED: Calculate "Percentage Growth" vs Previous Period ---
    $prevStart = date('Y-m-d 00:00:00', strtotime("-" . ($days * 2) . " days"));
    $prevEnd = date('Y-m-d 23:59:59', strtotime("-" . ($days + 1) . " days"));

    $stmtWebPrev = $pdo->prepare("
        SELECT COUNT(*) 
        FROM web_page_views pv
        JOIN web_properties wp ON pv.property_id = wp.id
        WHERE wp.workspace_id = ? AND pv.loaded_at BETWEEN ? AND ?
    ");
    $stmtWebPrev->execute([$workspace_id, $prevStart, $prevEnd]);
    $prevWeb = $stmtWebPrev->fetchColumn();

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
    $prevAi = $stmtAiPrev->fetchColumn();

    $stmtLeadPrev = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE workspace_id = ? AND joined_at BETWEEN ? AND ?");
    $stmtLeadPrev->execute([$workspace_id, $prevStart, $prevEnd]);
    $prevLead = $stmtLeadPrev->fetchColumn();

    $calcGrowth = function($current, $prev) {
        if ($prev == 0) return $current > 0 ? 100 : 0;
        return round((($current - $prev) / $prev) * 100, 1);
    };

    $growthWeb = $calcGrowth($totalWeb, $prevWeb);
    $growthAi = $calcGrowth($totalAi, $prevAi);
    $growthLeads = $calcGrowth($totalLeads, $prevLead);

    $responseJson = json_encode([
        'success' => true,
        'summary' => [
            'total_web' => $totalWeb,
            'growth_web' => $growthWeb,
            'total_ai' => $totalAi,
            'growth_ai' => $growthAi,
            'total_leads' => $totalLeads,
            'growth_leads' => $growthLeads,
        ],
        'chart_data' => $chartData,
        'top_campaigns' => $topCampaigns,
        'top_flows' => $topFlows
    ]);

    // [PERF] Store in APCu for 5 minutes
    if (function_exists('apcu_store')) {
        apcu_store($cacheKey, $responseJson, 300);
    }

    echo $responseJson;

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}

