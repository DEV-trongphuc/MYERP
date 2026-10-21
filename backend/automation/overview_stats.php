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

    // --- 6. Pipeline 4-Stage Breakdown & Audience Data Completeness (Single-Pass SQL) ---
    $catalog = function_exists('getCrmPipelineStageCatalog') ? getCrmPipelineStageCatalog($pdo) : [];
    
    $stagesUncontacted = [];
    $stagesQualified = [];
    $stagesWon = [];
    $stagesEnrolled = [];
    if (!empty($catalog)) {
        foreach ($catalog as $cs) {
            $step = (int)($cs['step_number'] ?? 0);
            $sid = (int)($cs['id'] ?? 0);
            if ($step >= 1 && $step <= 2) $stagesUncontacted[] = $sid;
            if ($step >= 3 && $step <= 12) $stagesQualified[] = $sid;
            if ($step >= 13 && $step <= 14) $stagesWon[] = $sid;
            if ($step === 14) $stagesEnrolled[] = $sid;
        }
    }
    if (empty($stagesUncontacted)) $stagesUncontacted = [1, 2];
    if (empty($stagesQualified)) $stagesQualified = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (empty($stagesWon)) $stagesWon = [13, 14];
    if (empty($stagesEnrolled)) $stagesEnrolled = [14];

    $inUncontacted = implode(',', array_map('intval', array_values($stagesUncontacted)));
    $inQualified = implode(',', array_map('intval', array_values($stagesQualified)));
    $inWon = implode(',', array_map('intval', array_values($stagesWon)));
    $inEnrolled = implode(',', array_map('intval', array_values($stagesEnrolled)));

    $stmtAudience = $pdo->prepare("
        SELECT 
            COUNT(*) as total_audience,
            SUM(CASE WHEN stage_id IN ($inUncontacted) OR pipeline_status IN ('new_lead', 'contact_attempted', 'chua_xac_dinh', '1', '2') THEN 1 ELSE 0 END) as count_uncontacted,
            SUM(CASE WHEN stage_id IN ($inQualified) OR pipeline_status IN ('connected', 'needs_identified', 'evaluation', 'proposal', 'deliberation', 'hesitant', 'committed', 'approved', 'scholarship_offered', 'scholarship_accepted') THEN 1 ELSE 0 END) as count_qualified,
            SUM(CASE WHEN stage_id IN ($inWon) OR pipeline_status IN ('deposit_paid', 'tuition_paid', 'enrolled', 'won', 'hoc_vien') OR status = 'customer' THEN 1 ELSE 0 END) as count_won,
            SUM(CASE WHEN stage_id IN ($inEnrolled) OR pipeline_status IN ('enrolled', 'hoc_vien') THEN 1 ELSE 0 END) as count_enrolled,
            SUM(CASE WHEN email IS NOT NULL AND email != '' AND email LIKE '%@%' THEN 1 ELSE 0 END) as with_valid_email,
            SUM(CASE WHEN phone_number IS NOT NULL AND TRIM(phone_number) != '' THEN 1 ELSE 0 END) as with_phone,
            SUM(CASE WHEN id LIKE 'crm_%' THEN 1 ELSE 0 END) as synced_crm,
            SUM(CASE WHEN (tags IS NOT NULL AND TRIM(tags) != '' AND tags != '[]' AND tags != 'null') OR (custom_attributes IS NOT NULL AND TRIM(custom_attributes) != '' AND custom_attributes != '{}') THEN 1 ELSE 0 END) as with_tags
        FROM subscribers
        WHERE workspace_id = ?
    ");
    $stmtAudience->execute([$workspace_id]);
    $audRow = $stmtAudience->fetch(PDO::FETCH_ASSOC) ?: [];

    $totalAud = (int)($audRow['total_audience'] ?? 0);
    $countUncontacted = (int)($audRow['count_uncontacted'] ?? 0);
    $countQualified = (int)($audRow['count_qualified'] ?? 0);
    $countWon = (int)($audRow['count_won'] ?? 0);
    $countEnrolled = (int)($audRow['count_enrolled'] ?? 0);

    $pipelineSegments = [
        [
            'id' => 'seg_pipeline_uncontacted_01_02',
            'name' => 'Chưa tương tác được',
            'stage_label' => 'Pipeline 1-2',
            'count' => $countUncontacted,
            'pct' => $totalAud > 0 ? round(($countUncontacted / $totalAud) * 100, 1) : 0,
            'color' => '#f59e0b',
        ],
        [
            'id' => 'seg_pipeline_qualified_03_12',
            'name' => 'Qualified',
            'stage_label' => 'Pipeline 3-12',
            'count' => $countQualified,
            'pct' => $totalAud > 0 ? round(($countQualified / $totalAud) * 100, 1) : 0,
            'color' => '#3b82f6',
        ],
        [
            'id' => 'seg_pipeline_won_13_14',
            'name' => 'Won',
            'stage_label' => 'Pipeline 13-14',
            'count' => $countWon,
            'pct' => $totalAud > 0 ? round(($countWon / $totalAud) * 100, 1) : 0,
            'color' => '#10b981',
        ],
        [
            'id' => 'seg_pipeline_enrolled_14',
            'name' => 'Học viên chính thức',
            'stage_label' => 'Pipeline 14',
            'count' => $countEnrolled,
            'pct' => $totalAud > 0 ? round(($countEnrolled / $totalAud) * 100, 1) : 0,
            'color' => '#8b5cf6',
        ],
    ];

    $dataCompleteness = [
        [
            'field' => 'email',
            'label' => 'Email hợp lệ',
            'filled' => (int)($audRow['with_valid_email'] ?? 0),
            'total' => $totalAud,
            'pct' => $totalAud > 0 ? round(((int)($audRow['with_valid_email'] ?? 0) / $totalAud) * 100, 1) : 0,
        ],
        [
            'field' => 'phone',
            'label' => 'Số điện thoại',
            'filled' => (int)($audRow['with_phone'] ?? 0),
            'total' => $totalAud,
            'pct' => $totalAud > 0 ? round(((int)($audRow['with_phone'] ?? 0) / $totalAud) * 100, 1) : 0,
        ],
        [
            'field' => 'crm_sync',
            'label' => 'Đã đồng bộ CRM',
            'filled' => (int)($audRow['synced_crm'] ?? 0),
            'total' => $totalAud,
            'pct' => $totalAud > 0 ? round(((int)($audRow['synced_crm'] ?? 0) / $totalAud) * 100, 1) : 0,
        ],
        [
            'field' => 'tags',
            'label' => 'Đã gắn phân khúc / Tag',
            'filled' => (int)($audRow['with_tags'] ?? 0),
            'total' => $totalAud,
            'pct' => $totalAud > 0 ? round(((int)($audRow['with_tags'] ?? 0) / $totalAud) * 100, 1) : 0,
        ],
    ];

    // --- 7. Top Sources Breakdown ---
    $stmtSources = $pdo->prepare("
        SELECT 
            COALESCE(NULLIF(TRIM(source), ''), 'Trực tiếp / Chưa gắn nguồn') as source_name, 
            COUNT(*) as count 
        FROM subscribers 
        WHERE workspace_id = ? 
        GROUP BY source_name 
        ORDER BY count DESC 
        LIMIT 6
    ");
    $stmtSources->execute([$workspace_id]);
    $sourcesRaw = $stmtSources->fetchAll(PDO::FETCH_ASSOC);
    $sourcesBreakdown = [];
    foreach ($sourcesRaw as $sRow) {
        $cnt = (int)$sRow['count'];
        $sourcesBreakdown[] = [
            'label' => (string)$sRow['source_name'],
            'count' => $cnt,
            'pct' => $totalAud > 0 ? round(($cnt / $totalAud) * 100, 1) : 0,
        ];
    }

    // --- 8. Omnichannel Channel Aggregation ---
    $stmtOmni = $pdo->prepare("
        SELECT 
            COUNT(CASE WHEN type IN ('email', 'regular') THEN 1 END) as email_campaigns,
            SUM(CASE WHEN type IN ('email', 'regular') THEN count_sent ELSE 0 END) as email_sent,
            SUM(CASE WHEN type IN ('email', 'regular') THEN count_opened ELSE 0 END) as email_opened,
            SUM(CASE WHEN type IN ('email', 'regular') THEN count_clicked ELSE 0 END) as email_clicked,
            COUNT(CASE WHEN type IN ('zalo', 'zalo_zns') THEN 1 END) as zalo_campaigns,
            SUM(CASE WHEN type IN ('zalo', 'zalo_zns') THEN count_sent ELSE 0 END) as zalo_sent,
            SUM(CASE WHEN type IN ('zalo', 'zalo_zns') THEN count_opened ELSE 0 END) as zalo_delivered
        FROM campaigns
        WHERE workspace_id = ?
    ");
    $stmtOmni->execute([$workspace_id]);
    $omniRow = $stmtOmni->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmtFlowAgg = $pdo->prepare("
        SELECT 
            COUNT(*) as active_count,
            SUM(stat_enrolled) as total_enrolled,
            SUM(stat_completed) as total_completed
        FROM flows
        WHERE workspace_id = ? AND status = 'active'
    ");
    $stmtFlowAgg->execute([$workspace_id]);
    $flowAggRow = $stmtFlowAgg->fetch(PDO::FETCH_ASSOC) ?: [];

    $omnichannelPerformance = [
        'email' => [
            'campaigns' => (int)($omniRow['email_campaigns'] ?? 0),
            'sent' => (int)($omniRow['email_sent'] ?? 0),
            'opened' => (int)($omniRow['email_opened'] ?? 0),
            'clicked' => (int)($omniRow['email_clicked'] ?? 0),
            'open_rate' => (int)($omniRow['email_sent'] ?? 0) > 0 ? round(((int)($omniRow['email_opened'] ?? 0) / (int)$omniRow['email_sent']) * 100, 1) : 0,
            'click_rate' => (int)($omniRow['email_sent'] ?? 0) > 0 ? round(((int)($omniRow['email_clicked'] ?? 0) / (int)$omniRow['email_sent']) * 100, 1) : 0,
        ],
        'zalo' => [
            'campaigns' => (int)($omniRow['zalo_campaigns'] ?? 0),
            'sent' => (int)($omniRow['zalo_sent'] ?? 0),
            'delivered' => (int)($omniRow['zalo_delivered'] ?? 0),
            'delivery_rate' => (int)($omniRow['zalo_sent'] ?? 0) > 0 ? round(((int)($omniRow['zalo_delivered'] ?? 0) / (int)$omniRow['zalo_sent']) * 100, 1) : 0,
        ],
        'flows' => [
            'active_flows' => (int)($flowAggRow['active_count'] ?? 0),
            'enrolled' => (int)($flowAggRow['total_enrolled'] ?? 0),
            'completed' => (int)($flowAggRow['total_completed'] ?? 0),
            'completion_rate' => (int)($flowAggRow['total_enrolled'] ?? 0) > 0 ? round(((int)($flowAggRow['total_completed'] ?? 0) / (int)$flowAggRow['total_enrolled']) * 100, 1) : 0,
        ]
    ];

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
        'top_flows'     => $topFlows,
        'pipeline_segments' => $pipelineSegments,
        'sources_breakdown' => $sourcesBreakdown,
        'data_completeness' => $dataCompleteness,
        'omnichannel_performance' => $omnichannelPerformance,
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
        'top_flows'     => [],
        'pipeline_segments' => [],
        'sources_breakdown' => [],
        'data_completeness' => [],
        'omnichannel_performance' => [
            'email' => ['campaigns' => 0, 'sent' => 0, 'opened' => 0, 'clicked' => 0, 'open_rate' => 0, 'click_rate' => 0],
            'zalo' => ['campaigns' => 0, 'sent' => 0, 'delivered' => 0, 'delivery_rate' => 0],
            'flows' => ['active_flows' => 0, 'enrolled' => 0, 'completed' => 0, 'completion_rate' => 0],
        ]
    ], JSON_UNESCAPED_UNICODE);
}

