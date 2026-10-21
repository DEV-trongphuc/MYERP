<?php

/**
 * AgentAutomationMarketingTools — Pillar 6: 360° Omnichannel Marketing, Automation Flows,
 * Campaigns, Vouchers, Surveys, Website Tracking, Zalo OA/ZNS, Meta & Match-Only Lead Footprint AI Engine.
 *
 * STRICT MANDATE ("3 KHÔNG"):
 * - Any synchronization between Automation (`subscribers`) and CRM (`contacts`) is strictly MATCH-ONLY
 *   by Email or 9-digit normalized Phone suffix on existing `contacts` (`deleted_at IS NULL`).
 * - NEVER insert/create new contacts in `MYERP.contacts` from Automation sync.
 * - NEVER trigger lead round-robin distribution.
 * - NEVER send notifications during silent match sync.
 */
class AgentAutomationMarketingTools
{
    private static array $tableCache = [];
    private static array $columnCache = [];

    /**
     * Check if a table exists in the current MySQL database (cached per request)
     */
    private static function tableExists(PDO $db, string $table): bool
    {
        if (isset(self::$tableCache[$table])) {
            return self::$tableCache[$table];
        }
        try {
            $stmt = $db->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1");
            $stmt->execute([$table]);
            self::$tableCache[$table] = (bool)$stmt->fetchColumn();
        } catch (\Throwable $e) {
            self::$tableCache[$table] = false;
        }
        return self::$tableCache[$table];
    }

    /**
     * Check if a column exists on a table in the current MySQL database (cached per request)
     */
    private static function columnExists(PDO $db, string $table, string $column): bool
    {
        $key = "{$table}.{$column}";
        if (isset(self::$columnCache[$key])) {
            return self::$columnCache[$key];
        }
        try {
            $stmt = $db->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1");
            $stmt->execute([$table, $column]);
            self::$columnCache[$key] = (bool)$stmt->fetchColumn();
        } catch (\Throwable $e) {
            self::$columnCache[$key] = false;
        }
        return self::$columnCache[$key];
    }

    /**
     * Normalize phone to last 9 digits for Vietnam phone matching (0901234567 == +84901234567 == 84901234567)
     */
    public static function normalizePhone9Digits(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '';
        }
        $digits = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($digits) < 9) {
            return '';
        }
        return substr($digits, -9);
    }

    /**
     * 1. Return Gemini Function Declarations for Omnichannel Marketing & Automation Tools
     */
    public static function getToolDeclarations(): array
    {
        return [
            [
                'name' => 'query_omnichannel_journey_and_automation_analytics',
                'description' => 'Truy vấn phân tích chuyên sâu 360° về Marketing Automation & Hành trình Đa kênh (Email, Zalo OA/ZNS, Facebook Meta, Website Tracking): Tổng quan phễu đa kênh (`overview`), Hiệu quả kịch bản chăm sóc tự động (`flows_performance`), Điểm nghẽn kịch bản nơi khách đang chờ hoặc lỗi (`flow_bottlenecks`), Hiệu quả chiến dịch gửi tin Email/ZNS (`campaigns_performance`), Báo cáo chiến dịch Voucher & Mã khuyến mãi (`vouchers_report`), Báo cáo Khảo sát & Câu trả lời (`surveys_report`), Lưu lượng Website & Nguồn UTM (`web_traffic_and_utm`), Hội thoại Đa kênh Zalo/Meta/AI Web Widget (`omnichannel_conversations`), và Danh sách Lead Nóng tương tác cao (`hot_engaged_leads`). Trả về số liệu thống kê thực tế từ Database kèm biểu đồ trực quan và danh sách chi tiết.',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'analysis_type' => [
                            'type' => 'STRING',
                            'enum' => [
                                'overview',
                                'flows_performance',
                                'flow_bottlenecks',
                                'campaigns_performance',
                                'vouchers_report',
                                'surveys_report',
                                'web_traffic_and_utm',
                                'omnichannel_conversations',
                                'hot_engaged_leads'
                            ],
                            'description' => "Loại báo cáo phân tích cần truy vấn (mặc định: 'overview')."
                        ],
                        'flow_query' => [
                            'type' => 'STRING',
                            'description' => 'Tên hoặc ID kịch bản Automation Flow cần phân tích sâu (ví dụ: Nuôi dưỡng MBA, Follow-up Workshop).'
                        ],
                        'campaign_query' => [
                            'type' => 'STRING',
                            'description' => 'Tên hoặc ID chiến dịch Email/ZNS hoặc chiến dịch Voucher cần tra cứu.'
                        ],
                        'survey_query' => [
                            'type' => 'STRING',
                            'description' => 'Tên, slug hoặc ID bài khảo sát (Survey) cần phân tích.'
                        ],
                        'channel' => [
                            'type' => 'STRING',
                            'enum' => ['all', 'email', 'zalo', 'meta', 'web'],
                            'description' => 'Lọc theo kênh tương tác (mặc định: all).'
                        ],
                        'status' => [
                            'type' => 'STRING',
                            'description' => 'Lọc theo trạng thái kịch bản/chiến dịch/voucher (ví dụ: active, paused, draft, sent, waiting, failed, unused, used).'
                        ],
                        'from_date' => [
                            'type' => 'STRING',
                            'description' => 'Từ ngày (YYYY-MM-DD).'
                        ],
                        'to_date' => [
                            'type' => 'STRING',
                            'description' => 'Đến ngày (YYYY-MM-DD).'
                        ],
                        'min_engagement_score' => [
                            'type' => 'INTEGER',
                            'description' => 'Điểm tương tác (engagement_score) tối thiểu khi lọc danh sách Hot Engaged Leads (mặc định: 30).'
                        ],
                        'limit' => [
                            'type' => 'INTEGER',
                            'description' => 'Số lượng bản ghi tối đa trả về (mặc định: 15, tối đa: 50).'
                        ]
                    ]
                ]
            ],
            [
                'name' => 'get_lead_digital_footprint_360',
                'description' => 'Tra cứu Hồ sơ Dấu chân Số 360° (360° Digital Footprint) của một Khách hàng / Học viên / Lead cụ thể. Kết hợp thông tin CRM (`contacts`: người phụ trách, giai đoạn pipeline, tiền đặt cọc) với toàn bộ lịch sử hành vi đa kênh từ hệ thống Marketing Automation (`subscribers` khớp qua `subscriber_id`, Email hoặc 9 số cuối SĐT): Điểm tương tác (`engagement_score`), Thống kê gửi/mở/click Email, Kịch bản Automation Flow đang chạy (`subscriber_flow_states`, `flow_enrollments`), Lịch sử truy cập Website & UTM (`web_visitors`, `web_sessions`, `web_page_views` - trang đã xem, thời gian đọc, độ sâu cuộn trang `%`), Câu trả lời Khảo sát (`survey_responses`), Mã Voucher đang sở hữu/đã dùng (`voucher_codes`, `voucher_claims`), và tương tác Zalo OA / Facebook Meta (`zalo_subscribers`, `meta_conversations`). Tự động sinh gợi ý kịch bản tư vấn cá nhân hóa cho Sale.',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'contact_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID khách hàng/học viên trong CRM (`contacts.id`) nếu đã biết.'
                        ],
                        'subscriber_id' => [
                            'type' => 'STRING',
                            'description' => 'UUID của subscriber trong hệ thống Automation (`subscribers.id`) nếu đã biết.'
                        ],
                        'query' => [
                            'type' => 'STRING',
                            'description' => 'Từ khóa tìm kiếm khách hàng: Họ tên, Số điện thoại, Email hoặc Mã học viên.'
                        ]
                    ]
                ]
            ],
            [
                'name' => 'smart_manage_automation_flows_and_campaigns',
                'description' => "Công cụ quản trị và thực thi tác vụ Marketing Automation & Đa kênh thông minh:
- 'enroll_contact_in_flow': Đưa một khách hàng/lead vào kịch bản chăm sóc tự động (Automation Flow).
- 'pause_or_resume_contact_flow': Tạm dừng ('paused'/'cancelled') hoặc tiếp tục ('waiting'/'active') kịch bản tự động cho một khách hàng cụ thể (ví dụ khi khách đã đặt cọc để dừng gửi tin làm phiền).
- 'toggle_flow_status': Bật ('active') hoặc tạm dừng ('paused') toàn bộ một kịch bản Automation Flow.
- 'issue_or_redeem_voucher': Cấp mã voucher khuyến mãi cho khách hàng hoặc đánh dấu đã sử dụng ('used').
- 'run_silent_match_sync': Đồng bộ ngầm đối sánh (Match-Only) dữ liệu hành vi Marketing vào các hồ sơ `contacts` hiện có qua Email/SĐT theo nguyên tắc 3 KHÔNG (KHÔNG tạo mới contact/lead vào CRM, KHÔNG tự động chia lead, KHÔNG bắn thông báo).",
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'action' => [
                            'type' => 'STRING',
                            'enum' => [
                                'enroll_contact_in_flow',
                                'pause_or_resume_contact_flow',
                                'toggle_flow_status',
                                'issue_or_redeem_voucher',
                                'run_silent_match_sync'
                            ],
                            'description' => 'Hành động cần thực thi.'
                        ],
                        'contact_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID khách hàng/học viên trong CRM (`contacts.id`).'
                        ],
                        'contact_query' => [
                            'type' => 'STRING',
                            'description' => 'Tên, SĐT hoặc Email của khách hàng cần thao tác.'
                        ],
                        'flow_id' => [
                            'type' => 'STRING',
                            'description' => 'ID kịch bản Automation Flow.'
                        ],
                        'flow_query' => [
                            'type' => 'STRING',
                            'description' => 'Tên kịch bản Automation Flow.'
                        ],
                        'target_status' => [
                            'type' => 'STRING',
                            'description' => "Trạng thái đích: 'active' | 'paused' | 'cancelled' | 'waiting' | 'used'."
                        ],
                        'voucher_campaign_query' => [
                            'type' => 'STRING',
                            'description' => 'Tên hoặc ID chiến dịch Voucher khi cấp mã mới.'
                        ],
                        'voucher_code' => [
                            'type' => 'STRING',
                            'description' => 'Mã Voucher cụ thể khi kiểm tra hoặc đánh dấu đã sử dụng (redeem).'
                        ],
                        'confirmed' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Xác nhận thực thi ngay vào Database (mặc định: true).'
                        ]
                    ],
                    'required' => ['action']
                ]
            ]
        ];
    }

    /**
     * 2. Execute Omnichannel Journey & Automation Analytics (`query_omnichannel_journey_and_automation_analytics`)
     */
    public static function executeQueryOmnichannelAnalytics(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $leadRbac = AgentToolRegistry::evaluateLeadReadScope($db, $auth);
        $rbacInfo = AgentToolRegistry::getContactRbacClause('c', $leadRbac, $uid, false);
        $rbacClause = $rbacInfo['clause'];
        $rbacParams = $rbacInfo['params'];

        $analysisType = strtolower(trim((string)($args['analysis_type'] ?? 'overview')));
        $flowQuery = trim((string)($args['flow_query'] ?? ''));
        $campaignQuery = trim((string)($args['campaign_query'] ?? ''));
        $surveyQuery = trim((string)($args['survey_query'] ?? ''));
        $channel = strtolower(trim((string)($args['channel'] ?? 'all')));
        $statusFilter = strtolower(trim((string)($args['status'] ?? '')));
        $fromDate = trim((string)($args['from_date'] ?? ''));
        $toDate = trim((string)($args['to_date'] ?? ''));
        $minEngagementScore = isset($args['min_engagement_score']) ? (int)$args['min_engagement_score'] : 30;
        $limit = min(50, max(5, (int)($args['limit'] ?? 15)));

        $hasOmnichannelCols = self::columnExists($db, 'contacts', 'engagement_score');

        switch ($analysisType) {
            case 'flows_performance':
                return self::analyzeFlowsPerformance($db, $flowQuery, $statusFilter, $fromDate, $toDate, $limit);

            case 'flow_bottlenecks':
                return self::analyzeFlowBottlenecks($db, $flowQuery, $statusFilter, $limit);

            case 'campaigns_performance':
                return self::analyzeCampaignsPerformance($db, $campaignQuery, $channel, $statusFilter, $fromDate, $toDate, $limit);

            case 'vouchers_report':
                return self::analyzeVouchersReport($db, $tid, $campaignQuery, $statusFilter, $rbacClause, $rbacParams, $limit);

            case 'surveys_report':
                return self::analyzeSurveysReport($db, $tid, $surveyQuery, $statusFilter, $rbacClause, $rbacParams, $limit);

            case 'web_traffic_and_utm':
                return self::analyzeWebTrafficAndUtm($db, $fromDate, $toDate, $limit);

            case 'omnichannel_conversations':
                return self::analyzeOmnichannelConversations($db, $channel, $statusFilter, $limit);

            case 'hot_engaged_leads':
                return self::analyzeHotEngagedLeads($db, $tid, $rbacClause, $rbacParams, $minEngagementScore, $flowQuery, $channel, $fromDate, $toDate, $limit, $hasOmnichannelCols);

            case 'overview':
            default:
                return self::analyzeOmnichannelOverview($db, $tid, $rbacClause, $rbacParams, $fromDate, $toDate, $hasOmnichannelCols);
        }
    }

    /**
     * Mode 1: Overview across CRM Contacts + Subscribers + Flows + Campaigns + Vouchers + Surveys + Web Tracking
     */
    private static function analyzeOmnichannelOverview(
        PDO $db,
        int $tid,
        string $rbacClause,
        array $rbacParams,
        string $fromDate,
        string $toDate,
        bool $hasOmnichannelCols
    ): array {
        $crmSummary = [
            'total_contacts_in_scope' => 0,
            'matched_with_automation' => 0,
            'hot_engaged_leads_50plus' => 0,
            'warm_engaged_leads_20_to_49' => 0,
            'email_opened_contacts' => 0,
            'email_clicked_contacts' => 0,
            'web_visited_contacts' => 0,
            'active_flow_contacts' => 0,
            'voucher_holders' => 0,
            'survey_completed_contacts' => 0,
            'unsubscribed_or_bounced_contacts' => 0,
        ];

        try {
            if ($hasOmnichannelCols) {
                $sqlCrm = "
                    SELECT
                        COUNT(*) AS total_contacts,
                        SUM(CASE WHEN c.domation_subscriber_id IS NOT NULL AND c.domation_subscriber_id != '' THEN 1 ELSE 0 END) AS matched_with_automation,
                        SUM(CASE WHEN COALESCE(c.engagement_score, 0) >= 50 THEN 1 ELSE 0 END) AS hot_engaged_leads_50plus,
                        SUM(CASE WHEN COALESCE(c.engagement_score, 0) BETWEEN 20 AND 49 THEN 1 ELSE 0 END) AS warm_engaged_leads_20_to_49,
                        SUM(CASE WHEN COALESCE(c.stats_email_opened, 0) > 0 THEN 1 ELSE 0 END) AS email_opened_contacts,
                        SUM(CASE WHEN COALESCE(c.stats_email_clicked, 0) > 0 THEN 1 ELSE 0 END) AS email_clicked_contacts,
                        SUM(CASE WHEN COALESCE(c.web_pageviews_count, 0) > 0 OR c.last_web_visit_at IS NOT NULL THEN 1 ELSE 0 END) AS web_visited_contacts,
                        SUM(CASE WHEN COALESCE(c.active_flow_count, 0) > 0 THEN 1 ELSE 0 END) AS active_flow_contacts,
                        SUM(CASE WHEN c.active_voucher_code IS NOT NULL AND c.active_voucher_code != '' THEN 1 ELSE 0 END) AS voucher_holders,
                        SUM(CASE WHEN COALESCE(c.survey_completed_count, 0) > 0 THEN 1 ELSE 0 END) AS survey_completed_contacts,
                        SUM(CASE WHEN c.marketing_status IN ('unsubscribed', 'bounced') THEN 1 ELSE 0 END) AS unsubscribed_or_bounced_contacts
                    FROM contacts c
                    WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND {$rbacClause}
                ";
                $stmtCrm = $db->prepare($sqlCrm);
                $stmtCrm->execute(array_merge([$tid], $rbacParams));
                $rowCrm = $stmtCrm->fetch(PDO::FETCH_ASSOC);
                if ($rowCrm) {
                    foreach ($crmSummary as $k => $_) {
                        if (isset($rowCrm[$k])) {
                            $crmSummary[$k] = (int)$rowCrm[$k];
                        }
                    }
                    $crmSummary['total_contacts_in_scope'] = (int)($rowCrm['total_contacts'] ?? 0);
                }
            }
        } catch (\Throwable $e) {}

        $subscribersSummary = [
            'total_subscribers' => 0,
            'active_subscribers' => 0,
            'unsubscribed' => 0,
            'bounced' => 0,
            'zalo_connected' => 0,
            'meta_connected' => 0,
            'total_emails_sent' => 0,
            'total_emails_opened' => 0,
            'total_emails_clicked' => 0,
        ];
        if (self::tableExists($db, 'subscribers')) {
            try {
                $stmtSub = $db->query("
                    SELECT
                        COUNT(*) AS total_subscribers,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_subscribers,
                        SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) AS unsubscribed,
                        SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) AS bounced,
                        SUM(CASE WHEN (zalo_user_id IS NOT NULL AND zalo_user_id != '') OR COALESCE(is_zalo_follower, 0) = 1 THEN 1 ELSE 0 END) AS zalo_connected,
                        SUM(CASE WHEN meta_psid IS NOT NULL AND meta_psid != '' THEN 1 ELSE 0 END) AS meta_connected,
                        COALESCE(SUM(stats_sent), 0) AS total_emails_sent,
                        COALESCE(SUM(stats_opened), 0) AS total_emails_opened,
                        COALESCE(SUM(stats_clicked), 0) AS total_emails_clicked
                    FROM subscribers
                ");
                $rowSub = $stmtSub->fetch(PDO::FETCH_ASSOC);
                if ($rowSub) {
                    foreach ($subscribersSummary as $k => $_) {
                        $subscribersSummary[$k] = (int)($rowSub[$k] ?? 0);
                    }
                }
            } catch (\Throwable $e) {}
        }

        $flowsSummary = [
            'total_flows' => 0,
            'active_flows' => 0,
            'paused_flows' => 0,
            'draft_flows' => 0,
            'total_enrolled' => 0,
            'total_completed' => 0,
            'total_email_sent' => 0,
            'total_email_opened' => 0,
            'total_email_clicked' => 0,
            'total_zns_sent' => 0,
            'total_zalo_sent' => 0,
            'total_meta_sent' => 0,
        ];
        $topFlows = [];
        if (self::tableExists($db, 'flows')) {
            try {
                $stmtFl = $db->query("
                    SELECT
                        COUNT(*) AS total_flows,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_flows,
                        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_flows,
                        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_flows,
                        COALESCE(SUM(stat_enrolled), 0) AS total_enrolled,
                        COALESCE(SUM(stat_completed), 0) AS total_completed,
                        COALESCE(SUM(stat_total_sent), 0) AS total_email_sent,
                        COALESCE(SUM(stat_total_opened), 0) AS total_email_opened,
                        COALESCE(SUM(stat_total_clicked), 0) AS total_email_clicked,
                        COALESCE(SUM(stat_zns_sent), 0) AS total_zns_sent,
                        COALESCE(SUM(stat_zalo_sent), 0) AS total_zalo_sent,
                        COALESCE(SUM(stat_meta_sent), 0) AS total_meta_sent
                    FROM flows
                ");
                $rowFl = $stmtFl->fetch(PDO::FETCH_ASSOC);
                if ($rowFl) {
                    foreach ($flowsSummary as $k => $_) {
                        $flowsSummary[$k] = (int)($rowFl[$k] ?? 0);
                    }
                }

                $stmtTopFl = $db->query("
                    SELECT id, name, status, trigger_type,
                           COALESCE(stat_enrolled, 0) AS stat_enrolled,
                           COALESCE(stat_completed, 0) AS stat_completed,
                           COALESCE(stat_total_sent, 0) AS stat_total_sent,
                           COALESCE(stat_total_opened, 0) AS stat_total_opened,
                           COALESCE(stat_total_clicked, 0) AS stat_total_clicked,
                           COALESCE(stat_zns_sent, 0) AS stat_zns_sent,
                           COALESCE(stat_zalo_sent, 0) AS stat_zalo_sent,
                           COALESCE(stat_meta_sent, 0) AS stat_meta_sent
                    FROM flows
                    ORDER BY COALESCE(stat_enrolled, 0) DESC, updated_at DESC
                    LIMIT 6
                ");
                $topFlows = $stmtTopFl->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        $campaignsSummary = [
            'total_campaigns' => 0,
            'sent_campaigns' => 0,
            'scheduled_or_sending' => 0,
            'total_sent' => 0,
            'unique_opened' => 0,
            'unique_clicked' => 0,
            'bounced' => 0,
            'unsubscribed' => 0,
        ];
        if (self::tableExists($db, 'campaigns')) {
            try {
                $stmtCamp = $db->query("
                    SELECT
                        COUNT(*) AS total_campaigns,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_campaigns,
                        SUM(CASE WHEN status IN ('scheduled', 'sending', 'waiting_flow') THEN 1 ELSE 0 END) AS scheduled_or_sending,
                        COALESCE(SUM(count_sent), 0) AS total_sent,
                        COALESCE(SUM(COALESCE(NULLIF(count_unique_opened, 0), count_opened, stat_opens, 0)), 0) AS unique_opened,
                        COALESCE(SUM(COALESCE(NULLIF(count_unique_clicked, 0), count_clicked, stat_clicks, 0)), 0) AS unique_clicked,
                        COALESCE(SUM(count_bounced), 0) AS bounced,
                        COALESCE(SUM(count_unsubscribed), 0) AS unsubscribed
                    FROM campaigns
                ");
                $rowCamp = $stmtCamp->fetch(PDO::FETCH_ASSOC);
                if ($rowCamp) {
                    foreach ($campaignsSummary as $k => $_) {
                        $campaignsSummary[$k] = (int)($rowCamp[$k] ?? 0);
                    }
                }
            } catch (\Throwable $e) {}
        }

        $vouchersSummary = [
            'total_voucher_campaigns' => 0,
            'active_voucher_campaigns' => 0,
            'total_codes' => 0,
            'assigned_codes' => 0,
            'used_codes' => 0,
            'unused_codes' => 0,
        ];
        if (self::tableExists($db, 'voucher_campaigns')) {
            try {
                $stmtVc = $db->query("
                    SELECT
                        COUNT(*) AS total_voucher_campaigns,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_voucher_campaigns
                    FROM voucher_campaigns
                ");
                $rowVc = $stmtVc->fetch(PDO::FETCH_ASSOC);
                if ($rowVc) {
                    $vouchersSummary['total_voucher_campaigns'] = (int)($rowVc['total_voucher_campaigns'] ?? 0);
                    $vouchersSummary['active_voucher_campaigns'] = (int)($rowVc['active_voucher_campaigns'] ?? 0);
                }
                if (self::tableExists($db, 'voucher_codes')) {
                    $stmtCodes = $db->query("
                        SELECT
                            COUNT(*) AS total_codes,
                            SUM(CASE WHEN subscriber_id IS NOT NULL AND subscriber_id != '' THEN 1 ELSE 0 END) AS assigned_codes,
                            SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS used_codes,
                            SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) AS unused_codes
                        FROM voucher_codes
                    ");
                    $rowCodes = $stmtCodes->fetch(PDO::FETCH_ASSOC);
                    if ($rowCodes) {
                        $vouchersSummary['total_codes'] = (int)($rowCodes['total_codes'] ?? 0);
                        $vouchersSummary['assigned_codes'] = (int)($rowCodes['assigned_codes'] ?? 0);
                        $vouchersSummary['used_codes'] = (int)($rowCodes['used_codes'] ?? 0);
                        $vouchersSummary['unused_codes'] = (int)($rowCodes['unused_codes'] ?? 0);
                    }
                }
            } catch (\Throwable $e) {}
        }

        $surveysSummary = [
            'total_surveys' => 0,
            'active_surveys' => 0,
            'total_responses' => 0,
            'avg_completion_rate' => 0,
        ];
        if (self::tableExists($db, 'surveys')) {
            try {
                $stmtSv = $db->query("
                    SELECT COUNT(*) AS total_surveys,
                           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_surveys
                    FROM surveys
                ");
                $rowSv = $stmtSv->fetch(PDO::FETCH_ASSOC);
                if ($rowSv) {
                    $surveysSummary['total_surveys'] = (int)($rowSv['total_surveys'] ?? 0);
                    $surveysSummary['active_surveys'] = (int)($rowSv['active_surveys'] ?? 0);
                }
                if (self::tableExists($db, 'survey_responses')) {
                    $stmtSr = $db->query("
                        SELECT COUNT(*) AS total_responses,
                               ROUND(COALESCE(AVG(completion_rate), 0), 1) AS avg_completion_rate
                        FROM survey_responses
                    ");
                    $rowSr = $stmtSr->fetch(PDO::FETCH_ASSOC);
                    if ($rowSr) {
                        $surveysSummary['total_responses'] = (int)($rowSr['total_responses'] ?? 0);
                        $surveysSummary['avg_completion_rate'] = (float)($rowSr['avg_completion_rate'] ?? 0);
                    }
                }
            } catch (\Throwable $e) {}
        }

        $webSummary = [
            'total_visitors' => 0,
            'total_sessions' => 0,
            'total_pageviews' => 0,
            'avg_session_duration_sec' => 0,
        ];
        if (self::tableExists($db, 'web_visitors')) {
            try {
                $webSummary['total_visitors'] = (int)$db->query("SELECT COUNT(*) FROM web_visitors")->fetchColumn();
                if (self::tableExists($db, 'web_sessions')) {
                    $rowWs = $db->query("SELECT COUNT(*) AS cnt, ROUND(COALESCE(AVG(duration_seconds), 0), 1) AS avg_dur FROM web_sessions")->fetch(PDO::FETCH_ASSOC);
                    $webSummary['total_sessions'] = (int)($rowWs['cnt'] ?? 0);
                    $webSummary['avg_session_duration_sec'] = (float)($rowWs['avg_dur'] ?? 0);
                }
                if (self::tableExists($db, 'web_page_views')) {
                    $webSummary['total_pageviews'] = (int)$db->query("SELECT COUNT(*) FROM web_page_views")->fetchColumn();
                }
            } catch (\Throwable $e) {}
        }

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Phễu Tương Tác Đa Kênh & Đồng Bộ CRM (Omnichannel Funnel)',
            'xAxisKey' => 'name',
            'data' => [
                ['name' => 'Khớp CRM', 'SoLuong' => $crmSummary['matched_with_automation']],
                ['name' => 'Đang chạy Flow', 'SoLuong' => $crmSummary['active_flow_contacts']],
                ['name' => 'Đã mở Email', 'SoLuong' => $crmSummary['email_opened_contacts']],
                ['name' => 'Đã click Link', 'SoLuong' => $crmSummary['email_clicked_contacts']],
                ['name' => 'Truy cập Web', 'SoLuong' => $crmSummary['web_visited_contacts']],
                ['name' => 'Làm Khảo sát', 'SoLuong' => $crmSummary['survey_completed_contacts']],
                ['name' => 'Có Voucher', 'SoLuong' => $crmSummary['voucher_holders']],
                ['name' => 'Lead Nóng (>=50đ)', 'SoLuong' => $crmSummary['hot_engaged_leads_50plus']],
            ],
            'series' => [
                ['dataKey' => 'SoLuong', 'name' => 'Số lượng Hồ sơ CRM', 'color' => '#4f46e5']
            ]
        ];

        $nba = [
            'Danh sách Lead Nóng tương tác cao (>= 50 điểm)',
            'Phân tích hiệu quả và điểm nghẽn các Automation Flow',
            'Báo cáo chiến dịch Voucher & Khảo sát'
        ];

        return [
            'success' => true,
            'analysis_type' => 'overview',
            'crm_omnichannel_summary' => $crmSummary,
            'automation_subscribers_summary' => $subscribersSummary,
            'flows_summary' => $flowsSummary,
            'top_flows' => $topFlows,
            'campaigns_summary' => $campaignsSummary,
            'vouchers_summary' => $vouchersSummary,
            'surveys_summary' => $surveysSummary,
            'web_tracking_summary' => $webSummary,
            'export_hot_leads_url' => '/export?type=contact&engagement_status=hot_engaged',
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ' . json_encode($nba, JSON_UNESCAPED_UNICODE) . '>>>',
            'ai_rendering_directive' => 'Trình bày báo cáo Tổng quan Hành trình Đa kênh & Marketing Automation theo đúng chuẩn 5 phần điều hành (Executive Summary, Bảng Ma trận Đa kênh Email/Zalo/Meta/Web/Voucher/Survey, Bảng Top Automation Flows hiệu quả nhất, đính kèm nguyên vẹn thẻ <<<DYNAMIC_CHART:...>>> và <<<NEXT_BEST_ACTIONS:...>>>). Tuyệt đối không dùng icon/emoji.'
        ];
    }

    /**
     * Mode 2: Automation Flows Performance (`flows_performance`)
     */
    private static function analyzeFlowsPerformance(
        PDO $db,
        string $flowQuery,
        string $statusFilter,
        string $fromDate,
        string $toDate,
        int $limit
    ): array {
        if (!self::tableExists($db, 'flows')) {
            return [
                'success' => false,
                'error' => 'Bảng dữ liệu kịch bản tự động (flows) chưa được khởi tạo trên hệ thống.'
            ];
        }

        $where = ['1=1'];
        $params = [];

        if ($flowQuery !== '') {
            $where[] = '(f.id = ? OR f.name LIKE ? OR f.description LIKE ?)';
            $params[] = $flowQuery;
            $params[] = '%' . $flowQuery . '%';
            $params[] = '%' . $flowQuery . '%';
        }
        if ($statusFilter !== '' && $statusFilter !== 'all') {
            $where[] = 'f.status = ?';
            $params[] = $statusFilter;
        }
        if ($fromDate !== '') {
            $where[] = 'f.created_at >= ?';
            $params[] = $fromDate . ' 00:00:00';
        }
        if ($toDate !== '') {
            $where[] = 'f.created_at <= ?';
            $params[] = $toDate . ' 23:59:59';
        }

        $whereSql = implode(' AND ', $where);
        $sql = "
            SELECT
                f.id, f.name, f.description, f.status, f.trigger_type,
                COALESCE(f.stat_enrolled, 0) AS stat_enrolled,
                COALESCE(f.stat_completed, 0) AS stat_completed,
                COALESCE(f.stat_total_sent, 0) AS stat_total_sent,
                COALESCE(f.stat_total_opened, 0) AS stat_total_opened,
                COALESCE(f.stat_unique_opened, 0) AS stat_unique_opened,
                COALESCE(f.stat_total_clicked, 0) AS stat_total_clicked,
                COALESCE(f.stat_unique_clicked, 0) AS stat_unique_clicked,
                COALESCE(f.stat_total_failed, 0) AS stat_total_failed,
                COALESCE(f.stat_total_unsubscribed, 0) AS stat_total_unsubscribed,
                COALESCE(f.stat_zns_sent, 0) AS stat_zns_sent,
                COALESCE(f.stat_zns_failed, 0) AS stat_zns_failed,
                COALESCE(f.stat_zalo_sent, 0) AS stat_zalo_sent,
                COALESCE(f.stat_meta_sent, 0) AS stat_meta_sent,
                f.created_at, f.updated_at
            FROM flows f
            WHERE {$whereSql}
            ORDER BY COALESCE(f.stat_enrolled, 0) DESC, f.updated_at DESC
            LIMIT {$limit}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $flows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Batch aggregate live states from subscriber_flow_states (Anti-N+1)
        $liveStatesByFlow = [];
        if (!empty($flows) && self::tableExists($db, 'subscriber_flow_states')) {
            try {
                $flowIds = array_column($flows, 'id');
                $placeholders = implode(',', array_fill(0, count($flowIds), '?'));
                $stmtStates = $db->prepare("
                    SELECT
                        flow_id,
                        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting_count,
                        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_state_count,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_state_count,
                        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_state_count
                    FROM subscriber_flow_states
                    WHERE flow_id IN ({$placeholders})
                    GROUP BY flow_id
                ");
                $stmtStates->execute($flowIds);
                while ($stRow = $stmtStates->fetch(PDO::FETCH_ASSOC)) {
                    $liveStatesByFlow[$stRow['flow_id']] = $stRow;
                }
            } catch (\Throwable $e) {}
        }

        $chartData = [];
        foreach ($flows as &$fl) {
            $fid = $fl['id'];
            $live = $liveStatesByFlow[$fid] ?? [];
            $fl['live_waiting_count'] = (int)($live['waiting_count'] ?? 0);
            $fl['live_processing_count'] = (int)($live['processing_count'] ?? 0);
            $fl['live_failed_count'] = (int)($live['failed_state_count'] ?? 0);
            $fl['live_paused_count'] = (int)($live['paused_state_count'] ?? 0);

            $sent = max(1, (int)$fl['stat_total_sent']);
            $enrolled = max(1, (int)$fl['stat_enrolled']);
            $fl['computed_open_rate_pct'] = (int)$fl['stat_total_sent'] > 0
                ? round(((int)$fl['stat_total_opened'] / $sent) * 100, 1)
                : 0.0;
            $fl['computed_click_rate_pct'] = (int)$fl['stat_total_sent'] > 0
                ? round(((int)$fl['stat_total_clicked'] / $sent) * 100, 1)
                : 0.0;
            $fl['computed_completion_rate_pct'] = (int)$fl['stat_enrolled'] > 0
                ? round(((int)$fl['stat_completed'] / $enrolled) * 100, 1)
                : 0.0;

            if (count($chartData) < 8) {
                $chartData[] = [
                    'name' => mb_substr((string)$fl['name'], 0, 24),
                    'ThamGia' => (int)$fl['stat_enrolled'],
                    'DaMo' => (int)$fl['stat_total_opened'],
                    'DaClick' => (int)$fl['stat_total_clicked'],
                    'HoanThanh' => (int)$fl['stat_completed'],
                ];
            }
        }
        unset($fl);

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Hiệu Quả Chuyển Đổi Các Kịch Bản Automation Flow',
            'xAxisKey' => 'name',
            'data' => $chartData,
            'series' => [
                ['dataKey' => 'ThamGia', 'name' => 'Đã tham gia', 'color' => '#6366f1'],
                ['dataKey' => 'DaMo', 'name' => 'Lượt mở Email', 'color' => '#3b82f6'],
                ['dataKey' => 'DaClick', 'name' => 'Lượt Click', 'color' => '#10b981'],
                ['dataKey' => 'HoanThanh', 'name' => 'Hoàn thành Flow', 'color' => '#f59e0b'],
            ]
        ];

        return [
            'success' => true,
            'analysis_type' => 'flows_performance',
            'total_flows_returned' => count($flows),
            'flows' => $flows,
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Kiểm tra điểm nghẽn (Flow Bottlenecks)", "Xem danh sách Lead đang chạy Automation Flow", "Đồng bộ Match-Only dữ liệu Marketing vào CRM"]>>>'
        ];
    }

    /**
     * Mode 3: Flow Bottlenecks (`flow_bottlenecks`)
     */
    private static function analyzeFlowBottlenecks(
        PDO $db,
        string $flowQuery,
        string $statusFilter,
        int $limit
    ): array {
        if (!self::tableExists($db, 'subscriber_flow_states') || !self::tableExists($db, 'flows')) {
            return [
                'success' => false,
                'error' => 'Bảng trạng thái kịch bản (subscriber_flow_states / flows) chưa tồn tại.'
            ];
        }

        $where = ['1=1'];
        $params = [];
        if ($flowQuery !== '') {
            $where[] = '(f.id = ? OR f.name LIKE ?)';
            $params[] = $flowQuery;
            $params[] = '%' . $flowQuery . '%';
        }
        if ($statusFilter !== '' && $statusFilter !== 'all') {
            $where[] = 'sfs.status = ?';
            $params[] = $statusFilter;
        } else {
            $where[] = "sfs.status IN ('waiting', 'processing', 'failed', 'paused')";
        }

        $whereSql = implode(' AND ', $where);
        $sql = "
            SELECT
                sfs.flow_id,
                f.name AS flow_name,
                f.status AS flow_status,
                f.steps AS flow_steps_json,
                sfs.step_id,
                sfs.step_type,
                sfs.status AS state_status,
                COUNT(*) AS subscriber_count,
                MIN(sfs.scheduled_at) AS earliest_scheduled_at,
                MAX(sfs.updated_at) AS latest_updated_at,
                MAX(sfs.last_error) AS sample_error
            FROM subscriber_flow_states sfs
            INNER JOIN flows f ON f.id = sfs.flow_id
            WHERE {$whereSql}
            GROUP BY sfs.flow_id, f.name, f.status, f.steps, sfs.step_id, sfs.step_type, sfs.status
            ORDER BY
                CASE WHEN sfs.status = 'failed' THEN 0 WHEN sfs.status = 'waiting' THEN 1 ELSE 2 END ASC,
                subscriber_count DESC
            LIMIT {$limit}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $bottlenecks = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $chartData = [];
        foreach ($bottlenecks as &$b) {
            $stepLabel = (string)($b['step_id'] ?? '');
            if (!empty($b['flow_steps_json'])) {
                $stepsArr = json_decode((string)$b['flow_steps_json'], true);
                if (is_array($stepsArr)) {
                    foreach ($stepsArr as $stNode) {
                        if (is_array($stNode) && (string)($stNode['id'] ?? '') === $stepLabel) {
                            $stepLabel = (string)($stNode['label'] ?? $stNode['name'] ?? $stNode['title'] ?? $stNode['type'] ?? $stepLabel);
                            break;
                        }
                    }
                }
            }
            unset($b['flow_steps_json']);
            $b['step_label'] = $stepLabel;

            if (count($chartData) < 8) {
                $chartData[] = [
                    'name' => mb_substr($b['flow_name'] . ' - ' . $stepLabel, 0, 26),
                    'SoKhach' => (int)$b['subscriber_count'],
                ];
            }
        }
        unset($b);

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Các Bước Kịch Bản Đang Có Nhiều Khách Chờ / Lỗi Nhất (Flow Bottlenecks)',
            'xAxisKey' => 'name',
            'data' => $chartData,
            'series' => [
                ['dataKey' => 'SoKhach', 'name' => 'Số lượng khách hàng', 'color' => '#ef4444']
            ]
        ];

        return [
            'success' => true,
            'analysis_type' => 'flow_bottlenecks',
            'bottleneck_steps' => $bottlenecks,
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Xem tổng quan hiệu quả các Automation Flow", "Xem danh sách Lead đang chạy trong Flow"]>>>'
        ];
    }

    /**
     * Mode 4: Campaigns Performance (`campaigns_performance`)
     */
    private static function analyzeCampaignsPerformance(
        PDO $db,
        string $campaignQuery,
        string $channel,
        string $statusFilter,
        string $fromDate,
        string $toDate,
        int $limit
    ): array {
        if (!self::tableExists($db, 'campaigns')) {
            return [
                'success' => false,
                'error' => 'Bảng chiến dịch (campaigns) chưa tồn tại.'
            ];
        }

        $where = ['1=1'];
        $params = [];
        if ($campaignQuery !== '') {
            $where[] = '(c.id = ? OR c.name LIKE ? OR c.subject LIKE ?)';
            $params[] = $campaignQuery;
            $params[] = '%' . $campaignQuery . '%';
            $params[] = '%' . $campaignQuery . '%';
        }
        if ($channel !== '' && $channel !== 'all') {
            if ($channel === 'zalo') {
                $where[] = "c.type LIKE '%zalo%'";
            } elseif ($channel === 'email') {
                $where[] = "c.type IN ('regular', 'email', 'ab_testing', 'autoresponder')";
            }
        }
        if ($statusFilter !== '' && $statusFilter !== 'all') {
            $where[] = 'c.status = ?';
            $params[] = $statusFilter;
        }
        if ($fromDate !== '') {
            $where[] = 'COALESCE(c.sent_at, c.created_at) >= ?';
            $params[] = $fromDate . ' 00:00:00';
        }
        if ($toDate !== '') {
            $where[] = 'COALESCE(c.sent_at, c.created_at) <= ?';
            $params[] = $toDate . ' 23:59:59';
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $db->prepare("
            SELECT
                c.id, c.name, c.subject, c.type, c.status,
                c.sender_name, c.sender_email,
                COALESCE(c.total_target_audience, 0) AS total_target_audience,
                COALESCE(c.count_sent, 0) AS count_sent,
                COALESCE(NULLIF(c.count_unique_opened, 0), c.count_opened, c.stat_opens, 0) AS unique_opened,
                COALESCE(NULLIF(c.count_unique_clicked, 0), c.count_clicked, c.stat_clicks, 0) AS unique_clicked,
                COALESCE(c.count_bounced, 0) AS count_bounced,
                COALESCE(c.count_unsubscribed, 0) AS count_unsubscribed,
                c.scheduled_at, c.sent_at, c.created_at
            FROM campaigns c
            WHERE {$whereSql}
            ORDER BY COALESCE(c.sent_at, c.created_at) DESC
            LIMIT {$limit}
        ");
        $stmt->execute($params);
        $campaigns = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $chartData = [];
        foreach ($campaigns as &$cp) {
            $sent = max(1, (int)$cp['count_sent']);
            $cp['open_rate_pct'] = (int)$cp['count_sent'] > 0 ? round(((int)$cp['unique_opened'] / $sent) * 100, 1) : 0.0;
            $cp['click_rate_pct'] = (int)$cp['count_sent'] > 0 ? round(((int)$cp['unique_clicked'] / $sent) * 100, 1) : 0.0;
            $cp['bounce_rate_pct'] = (int)$cp['count_sent'] > 0 ? round(((int)$cp['count_bounced'] / $sent) * 100, 1) : 0.0;

            if (count($chartData) < 8) {
                $chartData[] = [
                    'name' => mb_substr((string)$cp['name'], 0, 22),
                    'DaGui' => (int)$cp['count_sent'],
                    'DaMo' => (int)$cp['unique_opened'],
                    'DaClick' => (int)$cp['unique_clicked'],
                ];
            }
        }
        unset($cp);

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Thống Kê Gửi / Mở / Click Theo Chiến Dịch (Campaigns)',
            'xAxisKey' => 'name',
            'data' => $chartData,
            'series' => [
                ['dataKey' => 'DaGui', 'name' => 'Đã gửi', 'color' => '#6366f1'],
                ['dataKey' => 'DaMo', 'name' => 'Đã mở', 'color' => '#10b981'],
                ['dataKey' => 'DaClick', 'name' => 'Đã click', 'color' => '#f59e0b'],
            ]
        ];

        return [
            'success' => true,
            'analysis_type' => 'campaigns_performance',
            'total_campaigns_returned' => count($campaigns),
            'campaigns' => $campaigns,
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Xem các Lead đã mở và click Email", "So sánh hiệu quả với Automation Flows"]>>>'
        ];
    }

    /**
     * Mode 5: Vouchers Report (`vouchers_report`)
     */
    private static function analyzeVouchersReport(
        PDO $db,
        int $tid,
        string $campaignQuery,
        string $statusFilter,
        string $rbacClause,
        array $rbacParams,
        int $limit
    ): array {
        if (!self::tableExists($db, 'voucher_campaigns')) {
            return [
                'success' => false,
                'error' => 'Bảng chiến dịch Voucher (voucher_campaigns) chưa được khởi tạo.'
            ];
        }

        $where = ['1=1'];
        $params = [];
        if ($campaignQuery !== '') {
            $where[] = '(vcamp.id = ? OR vcamp.name LIKE ? OR vcamp.static_code LIKE ?)';
            $params[] = $campaignQuery;
            $params[] = '%' . $campaignQuery . '%';
            $params[] = '%' . $campaignQuery . '%';
        }
        if ($statusFilter !== '' && $statusFilter !== 'all' && in_array($statusFilter, ['active', 'draft', 'expired'], true)) {
            $where[] = 'vcamp.status = ?';
            $params[] = $statusFilter;
        }
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
                vcamp.id, vcamp.name, vcamp.description, vcamp.code_type, vcamp.static_code,
                vcamp.start_date, vcamp.end_date, vcamp.status, vcamp.is_claimable,
                COALESCE(code_agg.total_codes, 0) AS total_codes,
                COALESCE(code_agg.assigned_codes, 0) AS assigned_codes,
                COALESCE(code_agg.used_codes, 0) AS used_codes,
                COALESCE(code_agg.unused_codes, 0) AS unused_codes
            FROM voucher_campaigns vcamp
            LEFT JOIN (
                SELECT
                    campaign_id,
                    COUNT(*) AS total_codes,
                    SUM(CASE WHEN subscriber_id IS NOT NULL AND subscriber_id != '' THEN 1 ELSE 0 END) AS assigned_codes,
                    SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS used_codes,
                    SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) AS unused_codes
                FROM voucher_codes
                GROUP BY campaign_id
            ) code_agg ON code_agg.campaign_id = vcamp.id
            WHERE {$whereSql}
            ORDER BY vcamp.created_at DESC
            LIMIT {$limit}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $voucherCampaigns = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Also query CRM contacts currently holding voucher codes (RBAC enforced)
        $contactsWithVouchers = [];
        if (self::columnExists($db, 'contacts', 'active_voucher_code')) {
            try {
                $stmtHolders = $db->prepare("
                    SELECT c.id, c.full_name, c.phone, c.email, c.program,
                           c.active_voucher_code, c.engagement_score,
                           ps.name AS stage_name, u.full_name AS owner_name
                    FROM contacts c
                    LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                    LEFT JOIN users u ON c.owner_id = u.id
                    WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                      AND c.active_voucher_code IS NOT NULL AND c.active_voucher_code != ''
                      AND {$rbacClause}
                    ORDER BY COALESCE(c.engagement_score, 0) DESC, c.id DESC
                    LIMIT 15
                ");
                $stmtHolders->execute(array_merge([$tid], $rbacParams));
                $contactsWithVouchers = $stmtHolders->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        $chartData = [];
        foreach (array_slice($voucherCampaigns, 0, 8) as $vcItem) {
            $chartData[] = [
                'name' => mb_substr((string)$vcItem['name'], 0, 22),
                'DaCap' => (int)$vcItem['assigned_codes'],
                'DaDung' => (int)$vcItem['used_codes'],
                'ConTrong' => (int)$vcItem['unused_codes'],
            ];
        }

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Tình Trạng Cấp Phát & Sử Dụng Voucher Theo Chiến Dịch',
            'xAxisKey' => 'name',
            'data' => $chartData,
            'series' => [
                ['dataKey' => 'DaCap', 'name' => 'Đã cấp cho khách', 'color' => '#6366f1'],
                ['dataKey' => 'DaDung', 'name' => 'Đã sử dụng', 'color' => '#10b981'],
                ['dataKey' => 'ConTrong', 'name' => 'Chưa dùng', 'color' => '#94a3b8'],
            ]
        ];

        return [
            'success' => true,
            'analysis_type' => 'vouchers_report',
            'voucher_campaigns' => $voucherCampaigns,
            'crm_contacts_with_vouchers' => $contactsWithVouchers,
            'export_url' => '/export?type=contact&voucher_status=has_voucher',
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Xem danh sách Lead có Voucher nhưng chưa đặt cọc", "Cấp mã Voucher cho khách hàng tiềm năng"]>>>'
        ];
    }

    /**
     * Mode 6: Surveys Report (`surveys_report`)
     */
    private static function analyzeSurveysReport(
        PDO $db,
        int $tid,
        string $surveyQuery,
        string $statusFilter,
        string $rbacClause,
        array $rbacParams,
        int $limit
    ): array {
        if (!self::tableExists($db, 'surveys')) {
            return [
                'success' => false,
                'error' => 'Bảng khảo sát (surveys) chưa được khởi tạo.'
            ];
        }

        $where = ['1=1'];
        $params = [];
        if ($surveyQuery !== '') {
            $where[] = '(s.id = ? OR s.name LIKE ? OR s.slug LIKE ?)';
            $params[] = $surveyQuery;
            $params[] = '%' . $surveyQuery . '%';
            $params[] = '%' . $surveyQuery . '%';
        }
        if ($statusFilter !== '' && $statusFilter !== 'all') {
            $where[] = 's.status = ?';
            $params[] = $statusFilter;
        }
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
                s.id, s.name, s.slug, s.status, s.response_limit, s.close_at, s.created_at,
                COALESCE(sr_agg.response_count, 0) AS response_count,
                COALESCE(sr_agg.avg_completion_rate, 0) AS avg_completion_rate,
                COALESCE(sr_agg.avg_time_spent_sec, 0) AS avg_time_spent_sec,
                COALESCE(sr_agg.vouchers_claimed, 0) AS vouchers_claimed
            FROM surveys s
            LEFT JOIN (
                SELECT
                    survey_id,
                    COUNT(*) AS response_count,
                    ROUND(AVG(completion_rate), 1) AS avg_completion_rate,
                    ROUND(AVG(time_spent_sec), 1) AS avg_time_spent_sec,
                    SUM(CASE WHEN claimed_voucher_code IS NOT NULL AND claimed_voucher_code != '' THEN 1 ELSE 0 END) AS vouchers_claimed
                FROM survey_responses
                GROUP BY survey_id
            ) sr_agg ON sr_agg.survey_id = s.id
            WHERE {$whereSql}
            ORDER BY COALESCE(sr_agg.response_count, 0) DESC, s.created_at DESC
            LIMIT {$limit}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $surveys = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $recentResponses = [];
        if (self::tableExists($db, 'survey_responses')) {
            try {
                $stmtRec = $db->query("
                    SELECT sr.id, sr.survey_id, sv.name AS survey_name, sr.subscriber_id,
                           sub.email AS subscriber_email, sub.first_name, sub.last_name,
                           COALESCE(NULLIF(sub.phone_number, ''), sub.phone) AS subscriber_phone,
                           sr.completion_rate, sr.time_spent_sec, sr.claimed_voucher_code,
                           sr.source_channel, sr.utm_source, sr.geo_city, sr.submitted_at
                    FROM survey_responses sr
                    LEFT JOIN surveys sv ON sv.id = sr.survey_id
                    LEFT JOIN subscribers sub ON sub.id = sr.subscriber_id
                    ORDER BY sr.submitted_at DESC
                    LIMIT 12
                ");
                $recentResponses = $stmtRec->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        $chartData = [];
        foreach (array_slice($surveys, 0, 8) as $sv) {
            $chartData[] = [
                'name' => mb_substr((string)$sv['name'], 0, 24),
                'LuotTraLoi' => (int)$sv['response_count'],
                'NhanVoucher' => (int)$sv['vouchers_claimed'],
            ];
        }

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Số Lượt Phản Hồi & Nhận Voucher Theo Bài Khảo Sát',
            'xAxisKey' => 'name',
            'data' => $chartData,
            'series' => [
                ['dataKey' => 'LuotTraLoi', 'name' => 'Lượt hoàn thành khảo sát', 'color' => '#4f46e5'],
                ['dataKey' => 'NhanVoucher', 'name' => 'Lượt nhận Voucher', 'color' => '#10b981'],
            ]
        ];

        return [
            'success' => true,
            'analysis_type' => 'surveys_report',
            'surveys' => $surveys,
            'recent_responses' => $recentResponses,
            'export_url' => '/export?type=contact&engagement_status=survey_completed',
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Lọc danh sách Lead đã hoàn thành khảo sát trong CRM", "Xem chi tiết câu trả lời khảo sát của 1 học viên"]>>>'
        ];
    }

    /**
     * Mode 7: Website Traffic, UTM Attribution & Top Viewed Pages (`web_traffic_and_utm`)
     */
    private static function analyzeWebTrafficAndUtm(
        PDO $db,
        string $fromDate,
        string $toDate,
        int $limit
    ): array {
        $utmBreakdown = [];
        $topPages = [];

        if (self::tableExists($db, 'web_sessions')) {
            try {
                $where = ['1=1'];
                $params = [];
                if ($fromDate !== '') {
                    $where[] = 'started_at >= ?';
                    $params[] = $fromDate . ' 00:00:00';
                }
                if ($toDate !== '') {
                    $where[] = 'started_at <= ?';
                    $params[] = $toDate . ' 23:59:59';
                }
                $wSql = implode(' AND ', $where);
                $stmtUtm = $db->prepare("
                    SELECT
                        COALESCE(NULLIF(utm_source, ''), NULLIF(referrer_source, ''), 'Direct / Trực tiếp') AS source_name,
                        COALESCE(NULLIF(utm_campaign, ''), 'Không có UTM Campaign') AS campaign_name,
                        COUNT(*) AS session_count,
                        COUNT(DISTINCT visitor_id) AS unique_visitors,
                        COALESCE(SUM(page_count), 0) AS total_pageviews,
                        ROUND(COALESCE(AVG(duration_seconds), 0), 1) AS avg_duration_sec
                    FROM web_sessions
                    WHERE {$wSql}
                    GROUP BY source_name, campaign_name
                    ORDER BY session_count DESC
                    LIMIT {$limit}
                ");
                $stmtUtm->execute($params);
                $utmBreakdown = $stmtUtm->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        if (self::tableExists($db, 'web_page_views')) {
            try {
                $stmtPages = $db->query("
                    SELECT
                        url,
                        MAX(title) AS page_title,
                        COUNT(*) AS view_count,
                        COUNT(DISTINCT visitor_id) AS unique_visitors,
                        ROUND(COALESCE(AVG(time_on_page), 0), 1) AS avg_time_on_page_sec,
                        ROUND(COALESCE(AVG(scroll_depth), 0), 1) AS avg_scroll_depth_pct
                    FROM web_page_views
                    GROUP BY url
                    ORDER BY view_count DESC
                    LIMIT {$limit}
                ");
                $topPages = $stmtPages->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        $chartData = [];
        foreach (array_slice($utmBreakdown, 0, 8) as $uRow) {
            $chartData[] = [
                'name' => mb_substr($uRow['source_name'] . ' (' . $uRow['campaign_name'] . ')', 0, 25),
                'PhienTruyCap' => (int)$uRow['session_count'],
                'LuotXemTrang' => (int)$uRow['total_pageviews'],
            ];
        }

        $chartPayload = [
            'type' => 'bar',
            'title' => 'Lưu Lượng Truy Cập Website Theo Nguồn & Chiến Dịch UTM',
            'xAxisKey' => 'name',
            'data' => $chartData,
            'series' => [
                ['dataKey' => 'PhienTruyCap', 'name' => 'Phiên truy cập (Sessions)', 'color' => '#3b82f6'],
                ['dataKey' => 'LuotXemTrang', 'name' => 'Lượt xem trang (Pageviews)', 'color' => '#10b981'],
            ]
        ];

        return [
            'success' => true,
            'analysis_type' => 'web_traffic_and_utm',
            'utm_traffic_breakdown' => $utmBreakdown,
            'top_viewed_pages' => $topPages,
            'export_url' => '/export?type=contact&engagement_status=web_visited',
            'dynamic_chart_block' => '<<<DYNAMIC_CHART: ' . json_encode($chartPayload, JSON_UNESCAPED_UNICODE) . '>>>',
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Xem danh sách Lead đã truy cập Website nhưng chưa đặt cọc", "Xem dấu chân số 360 của khách truy cập nhiều nhất"]>>>'
        ];
    }

    /**
     * Mode 8: Omnichannel Conversations across Zalo OA, Meta Fanpage & AI Web Widget (`omnichannel_conversations`)
     */
    private static function analyzeOmnichannelConversations(
        PDO $db,
        string $channel,
        string $statusFilter,
        int $limit
    ): array {
        $zaloStats = ['total_zalo_subscribers' => 0, 'followers' => 0];
        $recentZalo = [];
        if (self::tableExists($db, 'zalo_subscribers')) {
            try {
                $rowZ = $db->query("
                    SELECT COUNT(*) AS total_zalo_subscribers,
                           SUM(CASE WHEN COALESCE(is_follower, 0) = 1 THEN 1 ELSE 0 END) AS followers
                    FROM zalo_subscribers
                ")->fetch(PDO::FETCH_ASSOC);
                if ($rowZ) {
                    $zaloStats['total_zalo_subscribers'] = (int)($rowZ['total_zalo_subscribers'] ?? 0);
                    $zaloStats['followers'] = (int)($rowZ['followers'] ?? 0);
                }
                $recentZalo = $db->query("
                    SELECT id, zalo_user_id, display_name, phone_number, manual_email, status, lead_score, is_follower, last_interaction_at
                    FROM zalo_subscribers
                    ORDER BY COALESCE(last_interaction_at, joined_at) DESC
                    LIMIT 10
                ")->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        $metaStats = ['total_conversations' => 0, 'open_conversations' => 0, 'unread_conversations' => 0];
        $recentMeta = [];
        if (self::tableExists($db, 'meta_conversations')) {
            try {
                $rowM = $db->query("
                    SELECT COUNT(*) AS total_conversations,
                           SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_conversations,
                           SUM(CASE WHEN COALESCE(unread_count, 0) > 0 THEN 1 ELSE 0 END) AS unread_conversations
                    FROM meta_conversations
                ")->fetch(PDO::FETCH_ASSOC);
                if ($rowM) {
                    $metaStats['total_conversations'] = (int)($rowM['total_conversations'] ?? 0);
                    $metaStats['open_conversations'] = (int)($rowM['open_conversations'] ?? 0);
                    $metaStats['unread_conversations'] = (int)($rowM['unread_conversations'] ?? 0);
                }
                $recentMeta = $db->query("
                    SELECT id, page_id, psid, last_message_snippet, last_message_time, unread_count, status, ai_enabled
                    FROM meta_conversations
                    ORDER BY COALESCE(last_message_time, updated_at) DESC
                    LIMIT 10
                ")->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        $aiWidgetStats = ['total_conversations' => 0, 'ai_active' => 0, 'human_handoff' => 0, 'closed' => 0];
        $aiTable = self::tableExists($db, 'domation_ai_conversations')
            ? 'domation_ai_conversations'
            : (self::tableExists($db, 'ai_conversations') ? 'ai_conversations' : '');
        if ($aiTable !== '') {
            try {
                $rowAi = $db->query("
                    SELECT COUNT(*) AS total_conversations,
                           SUM(CASE WHEN status = 'ai' THEN 1 ELSE 0 END) AS ai_active,
                           SUM(CASE WHEN status = 'human' THEN 1 ELSE 0 END) AS human_handoff,
                           SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed
                    FROM {$aiTable}
                ")->fetch(PDO::FETCH_ASSOC);
                if ($rowAi) {
                    foreach ($aiWidgetStats as $k => $_) {
                        $aiWidgetStats[$k] = (int)($rowAi[$k] ?? 0);
                    }
                }
            } catch (\Throwable $e) {}
        }

        return [
            'success' => true,
            'analysis_type' => 'omnichannel_conversations',
            'zalo_oa_summary' => $zaloStats,
            'recent_zalo_subscribers' => $recentZalo,
            'meta_fanpage_summary' => $metaStats,
            'recent_meta_conversations' => $recentMeta,
            'web_ai_widget_summary' => $aiWidgetStats,
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Xem danh sách Lead đã kết nối Zalo OA hoặc Facebook Meta", "Xem tổng quan phễu Marketing Automation"]>>>'
        ];
    }

    /**
     * Mode 9: Hot Engaged Leads in CRM (`hot_engaged_leads`) with strict RBAC
     */
    private static function analyzeHotEngagedLeads(
        PDO $db,
        int $tid,
        string $rbacClause,
        array $rbacParams,
        int $minEngagementScore,
        string $flowQuery,
        string $channel,
        string $fromDate,
        string $toDate,
        int $limit,
        bool $hasOmnichannelCols
    ): array {
        if (!$hasOmnichannelCols) {
            return [
                'success' => false,
                'error' => 'Các cột Omnichannel trên bảng contacts chưa được khởi tạo.'
            ];
        }

        $where = ["c.tenant_id = ?", "c.deleted_at IS NULL", $rbacClause];
        $params = array_merge([$tid], $rbacParams);

        if ($minEngagementScore > 0) {
            $where[] = "(COALESCE(c.engagement_score, 0) >= ? OR COALESCE(c.stats_email_clicked, 0) > 0 OR COALESCE(c.web_pageviews_count, 0) >= 3 OR (c.active_voucher_code IS NOT NULL AND c.active_voucher_code != ''))";
            $params[] = $minEngagementScore;
        }
        if ($flowQuery !== '') {
            $where[] = "c.active_flow_names LIKE ?";
            $params[] = '%' . $flowQuery . '%';
        }
        if ($channel === 'email') {
            $where[] = "(COALESCE(c.stats_email_opened, 0) > 0 OR COALESCE(c.stats_email_clicked, 0) > 0)";
        } elseif ($channel === 'web') {
            $where[] = "(COALESCE(c.web_pageviews_count, 0) > 0 OR c.last_web_visit_at IS NOT NULL)";
        } elseif ($channel === 'zalo') {
            $where[] = "(c.zalo_user_id IS NOT NULL AND c.zalo_user_id != '')";
        } elseif ($channel === 'meta') {
            $where[] = "(c.meta_psid IS NOT NULL AND c.meta_psid != '')";
        }

        $whereSql = implode(' AND ', $where);
        $sql = "
            SELECT
                c.id, c.full_name, c.phone, c.email, c.program, c.city, c.source,
                c.stage_id, ps.name AS stage_name,
                c.owner_id, COALESCE(u.full_name, 'Chưa phân bổ') AS owner_name,
                COALESCE(c.engagement_score, 0) AS engagement_score,
                COALESCE(c.stats_email_sent, 0) AS stats_email_sent,
                COALESCE(c.stats_email_opened, 0) AS stats_email_opened,
                COALESCE(c.stats_email_clicked, 0) AS stats_email_clicked,
                c.last_email_open_at, c.last_email_click_at,
                c.last_web_visit_at,
                COALESCE(c.web_pageviews_count, 0) AS web_pageviews_count,
                COALESCE(c.max_scroll_depth, 0) AS max_scroll_depth,
                COALESCE(c.active_flow_count, 0) AS active_flow_count,
                c.active_flow_names,
                c.active_voucher_code,
                COALESCE(c.survey_completed_count, 0) AS survey_completed_count,
                c.marketing_status,
                COALESCE(dep_agg.total_deposit, 0) AS total_deposit_amount
            FROM contacts c
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN (
                SELECT contact_id, SUM(price) AS total_deposit
                FROM deposits
                WHERE deleted_at IS NULL AND status IN ('approved', 'completed', 'paid', 'pending')
                GROUP BY contact_id
            ) dep_agg ON dep_agg.contact_id = c.id
            WHERE {$whereSql}
            ORDER BY COALESCE(c.engagement_score, 0) DESC,
                     COALESCE(c.stats_email_clicked, 0) DESC,
                     COALESCE(c.web_pageviews_count, 0) DESC,
                     c.id DESC
            LIMIT {$limit}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $leads = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $exportQuery = http_build_query(array_filter([
            'type' => 'contact',
            'engagement_status' => 'hot_engaged',
            'min_engagement_score' => $minEngagementScore > 0 ? $minEngagementScore : null,
            'automation_flow' => $flowQuery !== '' ? $flowQuery : null,
        ], fn($v) => $v !== null && $v !== ''));

        return [
            'success' => true,
            'analysis_type' => 'hot_engaged_leads',
            'total_returned' => count($leads),
            'min_engagement_score_applied' => $minEngagementScore,
            'hot_leads' => $leads,
            'export_url' => '/export?' . $exportQuery,
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ["Xem dấu chân số 360° của Lead điểm cao nhất", "Lọc riêng các Lead Nóng chưa đặt cọc", "Tải danh sách Lead Nóng ra Excel"]>>>',
            'ai_rendering_directive' => 'Hiển thị bảng danh sách Lead Nóng với đầy đủ thông tin CRM + Tín hiệu số (Điểm tương tác, Mở/Click Email, Lượt xem Web, Flow đang chạy, Mã Voucher) kèm link [Họ tên](/contacts?id=ID) và link tải Excel.'
        ];
    }

    /**
     * 3. Execute 360° Lead Digital Footprint Lookup (`get_lead_digital_footprint_360`)
     */
    public static function executeGetLeadDigitalFootprint360(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $contactId = (int)($args['contact_id'] ?? 0);
        $subscriberIdArg = trim((string)($args['subscriber_id'] ?? ''));
        $query = trim((string)($args['query'] ?? ''));

        $contact = null;
        if ($contactId > 0 || $query !== '') {
            $res = AgentToolRegistry::resolveContactWithDisambiguation(
                $db,
                $tid,
                $auth,
                $query,
                $contactId,
                'xem dấu chân số 360° (Digital Footprint)',
                true
            );
            if (($res['status'] ?? '') === 'ambiguous') {
                return $res['disambiguation_payload'];
            }
            if (($res['status'] ?? '') === 'resolved') {
                $contact = $res['contact'];
            } elseif ($subscriberIdArg === '') {
                return $res['error_payload'];
            }
        }

        // If subscriber_id was passed without contact_id, try finding matching CRM contact with RBAC
        if (!$contact && $subscriberIdArg !== '') {
            $leadRbac = AgentToolRegistry::evaluateLeadReadScope($db, $auth);
            $rbacInfo = AgentToolRegistry::getContactRbacClause('c', $leadRbac, $uid, true);
            $stmtC = $db->prepare("
                SELECT c.*, ps.name AS stage_name, u.full_name AS owner_name
                FROM contacts c
                LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                LEFT JOIN users u ON c.owner_id = u.id
                WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                  AND c.domation_subscriber_id = ?
                  AND {$rbacInfo['clause']}
                LIMIT 1
            ");
            $stmtC->execute(array_merge([$tid, $subscriberIdArg], $rbacInfo['params']));
            $contact = $stmtC->fetch(PDO::FETCH_ASSOC) ?: null;
        }

        if (!$contact) {
            return [
                'success' => false,
                'error' => 'Không tìm thấy hồ sơ khách hàng/học viên trong CRM hoặc bạn không có quyền xem hồ sơ này.'
            ];
        }

        $cid = (int)$contact['id'];
        $contactEmail = strtolower(trim((string)($contact['email'] ?? '')));
        $contactPhone9 = self::normalizePhone9Digits((string)($contact['phone'] ?? ''));
        $linkedSubId = trim((string)($contact['domation_subscriber_id'] ?? $contact['subscriber_id'] ?? $subscriberIdArg));

        // 1. Resolve matching Subscriber in `subscribers` (by subscriber_id, email, or 9-digit phone)
        $subscriber = null;
        if (self::tableExists($db, 'subscribers')) {
            try {
                if ($linkedSubId !== '') {
                    $stmtS = $db->prepare("SELECT * FROM subscribers WHERE id = ? LIMIT 1");
                    $stmtS->execute([$linkedSubId]);
                    $subscriber = $stmtS->fetch(PDO::FETCH_ASSOC) ?: null;
                }
                if (!$subscriber && ($contactEmail !== '' || $contactPhone9 !== '')) {
                    $subWhere = [];
                    $subParams = [];
                    if ($contactEmail !== '') {
                        $subWhere[] = "LOWER(TRIM(email)) = ?";
                        $subParams[] = $contactEmail;
                    }
                    if ($contactPhone9 !== '') {
                        $subWhere[] = "RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(phone_number, ''), phone, ''), '[^0-9]', ''), 9) = ?";
                        $subParams[] = $contactPhone9;
                    }
                    $stmtS2 = $db->prepare("SELECT * FROM subscribers WHERE " . implode(' OR ', $subWhere) . " ORDER BY COALESCE(lead_score, 0) DESC, created_at DESC LIMIT 1");
                    $stmtS2->execute($subParams);
                    $subscriber = $stmtS2->fetch(PDO::FETCH_ASSOC) ?: null;
                    if ($subscriber && empty($contact['domation_subscriber_id']) && self::columnExists($db, 'contacts', 'domation_subscriber_id')) {
                        $linkedSubId = (string)$subscriber['id'];
                        $db->prepare("UPDATE contacts SET domation_subscriber_id = ? WHERE id = ?")->execute([$linkedSubId, $cid]);
                        $contact['domation_subscriber_id'] = $linkedSubId;
                    }
                }
            } catch (\Throwable $e) {}
        }

        $subId = (string)($subscriber['id'] ?? $linkedSubId);

        // 2. Fetch Automation Flow States & Enrollments
        $flowStates = [];
        $flowEnrollments = [];
        if ($subId !== '') {
            if (self::tableExists($db, 'subscriber_flow_states') && self::tableExists($db, 'flows')) {
                try {
                    $stmtFs = $db->prepare("
                        SELECT sfs.id, sfs.flow_id, f.name AS flow_name, f.status AS flow_status,
                               sfs.step_id, sfs.step_type, sfs.status AS state_status,
                               sfs.scheduled_at, sfs.last_error, sfs.last_step_at, sfs.updated_at
                        FROM subscriber_flow_states sfs
                        LEFT JOIN flows f ON f.id = sfs.flow_id
                        WHERE sfs.subscriber_id = ?
                        ORDER BY sfs.updated_at DESC
                        LIMIT 15
                    ");
                    $stmtFs->execute([$subId]);
                    $flowStates = $stmtFs->fetchAll(PDO::FETCH_ASSOC) ?: [];
                } catch (\Throwable $e) {}
            }
            if (self::tableExists($db, 'flow_enrollments') && self::tableExists($db, 'flows')) {
                try {
                    $stmtFe = $db->prepare("
                        SELECT fe.id, fe.flow_id, f.name AS flow_name, fe.enrolled_at
                        FROM flow_enrollments fe
                        LEFT JOIN flows f ON f.id = fe.flow_id
                        WHERE fe.subscriber_id = ?
                        ORDER BY fe.enrolled_at DESC
                        LIMIT 15
                    ");
                    $stmtFe->execute([$subId]);
                    $flowEnrollments = $stmtFe->fetchAll(PDO::FETCH_ASSOC) ?: [];
                } catch (\Throwable $e) {}
            }
        }

        // 3. Fetch Website Sessions & Pageviews (`web_visitors`, `web_sessions`, `web_page_views`)
        $webSessions = [];
        $webPageViews = [];
        if (self::tableExists($db, 'web_visitors')) {
            try {
                $vWhere = [];
                $vParams = [];
                if ($subId !== '') {
                    $vWhere[] = "subscriber_id = ?";
                    $vParams[] = $subId;
                }
                if ($contactEmail !== '') {
                    $vWhere[] = "LOWER(TRIM(email)) = ?";
                    $vParams[] = $contactEmail;
                }
                if ($contactPhone9 !== '') {
                    $vWhere[] = "RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', ''), 9) = ?";
                    $vParams[] = $contactPhone9;
                }
                if (!empty($vWhere)) {
                    $stmtVis = $db->prepare("SELECT visitor_id FROM web_visitors WHERE " . implode(' OR ', $vWhere) . " LIMIT 10");
                    $stmtVis->execute($vParams);
                    $visitorIds = $stmtVis->fetchAll(PDO::FETCH_COLUMN) ?: [];

                    if (!empty($visitorIds)) {
                        $vPlaceholders = implode(',', array_fill(0, count($visitorIds), '?'));
                        if (self::tableExists($db, 'web_sessions')) {
                            $stmtWs = $db->prepare("
                                SELECT id, visitor_id, started_at, last_active_at, entry_url,
                                       referrer_source, utm_source, utm_medium, utm_campaign,
                                       page_count, duration_seconds, device_type, browser, os
                                FROM web_sessions
                                WHERE visitor_id IN ({$vPlaceholders})
                                ORDER BY started_at DESC
                                LIMIT 10
                            ");
                            $stmtWs->execute($visitorIds);
                            $webSessions = $stmtWs->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        }
                        if (self::tableExists($db, 'web_page_views')) {
                            $stmtPv = $db->prepare("
                                SELECT id, url, title, referrer, loaded_at, time_on_page, scroll_depth
                                FROM web_page_views
                                WHERE visitor_id IN ({$vPlaceholders})
                                ORDER BY loaded_at DESC
                                LIMIT 15
                            ");
                            $stmtPv->execute($visitorIds);
                            $webPageViews = $stmtPv->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        // 4. Fetch Survey Responses (`survey_responses` + `surveys`)
        $surveyResponses = [];
        if ($subId !== '' && self::tableExists($db, 'survey_responses')) {
            try {
                $stmtSr = $db->prepare("
                    SELECT sr.id, sr.survey_id, sv.name AS survey_name,
                           sr.answers_json, sr.completion_rate, sr.time_spent_sec,
                           sr.claimed_voucher_code, sr.source_channel, sr.utm_source,
                           sr.utm_campaign, sr.geo_city, sr.total_score, sr.max_score, sr.submitted_at
                    FROM survey_responses sr
                    LEFT JOIN surveys sv ON sv.id = sr.survey_id
                    WHERE sr.subscriber_id = ?
                    ORDER BY sr.submitted_at DESC
                    LIMIT 10
                ");
                $stmtSr->execute([$subId]);
                $rawSr = $stmtSr->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($rawSr as $srRow) {
                    $srRow['answers_decoded'] = !empty($srRow['answers_json'])
                        ? (json_decode((string)$srRow['answers_json'], true) ?: $srRow['answers_json'])
                        : [];
                    unset($srRow['answers_json']);
                    $surveyResponses[] = $srRow;
                }
            } catch (\Throwable $e) {}
        }

        // 5. Fetch Vouchers (`voucher_codes` + `voucher_claims`)
        $voucherCodes = [];
        $voucherClaims = [];
        if (self::tableExists($db, 'voucher_codes') && $subId !== '') {
            try {
                $stmtVc = $db->prepare("
                    SELECT vc.id, vc.code, vc.status, vc.sent_at, vc.claimed_at, vc.used_at, vc.expires_at,
                           vc.claimed_source, vcamp.name AS campaign_name, vcamp.rewards
                    FROM voucher_codes vc
                    LEFT JOIN voucher_campaigns vcamp ON vcamp.id = vc.campaign_id
                    WHERE vc.subscriber_id = ?
                    ORDER BY vc.created_at DESC
                    LIMIT 10
                ");
                $stmtVc->execute([$subId]);
                $voucherCodes = $stmtVc->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }
        if (self::tableExists($db, 'voucher_claims')) {
            try {
                $clWhere = [];
                $clParams = [];
                if ($subId !== '') {
                    $clWhere[] = "vcl.subscriber_id = ?";
                    $clParams[] = $subId;
                }
                if ($contactEmail !== '') {
                    $clWhere[] = "LOWER(TRIM(vcl.email)) = ?";
                    $clParams[] = $contactEmail;
                }
                if ($contactPhone9 !== '') {
                    $clWhere[] = "RIGHT(REGEXP_REPLACE(COALESCE(vcl.phone, ''), '[^0-9]', ''), 9) = ?";
                    $clParams[] = $contactPhone9;
                }
                if (!empty($clWhere)) {
                    $stmtCl = $db->prepare("
                        SELECT vcl.id, vcl.voucher_id, vcamp.name AS campaign_name,
                               vcl.status, vcl.source_channel, vcl.claimed_at, vcl.resolved_at
                        FROM voucher_claims vcl
                        LEFT JOIN voucher_campaigns vcamp ON vcamp.id = vcl.voucher_id
                        WHERE " . implode(' OR ', $clWhere) . "
                        ORDER BY vcl.claimed_at DESC
                        LIMIT 10
                    ");
                    $stmtCl->execute($clParams);
                    $voucherClaims = $stmtCl->fetchAll(PDO::FETCH_ASSOC) ?: [];
                }
            } catch (\Throwable $e) {}
        }

        // 6. Fetch Zalo & Meta Footprint
        $zaloProfile = null;
        if (self::tableExists($db, 'zalo_subscribers')) {
            try {
                $zWhere = [];
                $zParams = [];
                if ($subId !== '') {
                    $zWhere[] = "subscriber_id = ?";
                    $zParams[] = $subId;
                }
                if (!empty($contact['zalo_user_id'])) {
                    $zWhere[] = "zalo_user_id = ?";
                    $zParams[] = $contact['zalo_user_id'];
                }
                if ($contactPhone9 !== '') {
                    $zWhere[] = "RIGHT(REGEXP_REPLACE(COALESCE(phone_number, ''), '[^0-9]', ''), 9) = ?";
                    $zParams[] = $contactPhone9;
                }
                if (!empty($zWhere)) {
                    $stmtZ = $db->prepare("SELECT * FROM zalo_subscribers WHERE " . implode(' OR ', $zWhere) . " LIMIT 1");
                    $stmtZ->execute($zParams);
                    $zaloProfile = $stmtZ->fetch(PDO::FETCH_ASSOC) ?: null;
                }
            } catch (\Throwable $e) {}
        }

        $metaConversations = [];
        $metaPsid = trim((string)($contact['meta_psid'] ?? ($subscriber['meta_psid'] ?? '')));
        if ($metaPsid !== '' && self::tableExists($db, 'meta_conversations')) {
            try {
                $stmtM = $db->prepare("SELECT * FROM meta_conversations WHERE psid = ? ORDER BY updated_at DESC LIMIT 5");
                $stmtM->execute([$metaPsid]);
                $metaConversations = $stmtM->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {}
        }

        // 7. Fetch Recent CRM Activities & Deposits on this Contact
        $crmActivities = [];
        $crmDeposits = [];
        try {
            $stmtAct = $db->prepare("
                SELECT id, type, subject AS title, body AS description, status, created_at
                FROM activities
                WHERE contact_id = ? AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 8
            ");
            $stmtAct->execute([$cid]);
            $crmActivities = $stmtAct->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {}

        try {
            $stmtDep = $db->prepare("
                SELECT id, price AS amount, unit_code AS program, status, created_at AS deposit_date, created_at
                FROM deposits
                WHERE contact_id = ? AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 5
            ");
            $stmtDep->execute([$cid]);
            $crmDeposits = $stmtDep->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {}

        // 8. Synthesize Personalized Sales Pitch / Next Best Action Recommendations
        $engagementScore = (int)($contact['engagement_score'] ?? ($subscriber['lead_score'] ?? 0));
        $emailsOpened = (int)($contact['stats_email_opened'] ?? ($subscriber['stats_opened'] ?? 0));
        $emailsClicked = (int)($contact['stats_email_clicked'] ?? ($subscriber['stats_clicked'] ?? 0));
        $pageviewsCount = max((int)($contact['web_pageviews_count'] ?? 0), count($webPageViews));
        $maxScroll = (int)($contact['max_scroll_depth'] ?? 0);
        $activeVoucher = (string)($contact['active_voucher_code'] ?? ($voucherCodes[0]['code'] ?? ''));

        $salesRecommendations = [];
        if ($engagementScore >= 50 || $emailsClicked > 0 || $pageviewsCount >= 3) {
            $salesRecommendations[] = "TÍN HIỆU MUA HÀNG NÓNG (Điểm tương tác {$engagementScore}): Khách đã mở {$emailsOpened} email, click {$emailsClicked} lần và xem {$pageviewsCount} trang web (cuộn trang tối đa {$maxScroll}%). Sale nên gọi điện tư vấn ngay trong 2 giờ tới khi khách đang quan tâm cao.";
        }
        if ($activeVoucher !== '') {
            $salesRecommendations[] = "ĐÒN BẨY CHỐT DEAL BẰNG VOUCHER: Khách đang sở hữu mã ưu đãi '{$activeVoucher}'. Hãy nhắc khách về quyền lợi và thời hạn áp dụng của mã này để thúc đẩy quyết định đặt cọc (#SO).";
        }
        if (!empty($surveyResponses)) {
            $latestSurveyName = (string)($surveyResponses[0]['survey_name'] ?? 'Khảo sát');
            $salesRecommendations[] = "KHAI THÁC NHU CẦU TỪ KHẢO SÁT: Khách đã hoàn thành bài khảo sát '{$latestSurveyName}'. Hãy dựa trực tiếp vào nội dung câu trả lời của khách để cá nhân hóa lộ trình học và học phí.";
        }
        if (!empty($crmDeposits) && !empty($flowStates)) {
            $hasActiveFlow = false;
            foreach ($flowStates as $fs) {
                if (in_array($fs['state_status'] ?? '', ['waiting', 'processing'], true)) {
                    $hasActiveFlow = true;
                    break;
                }
            }
            if ($hasActiveFlow) {
                $salesRecommendations[] = "KHUYẾN NGHỊ TẠM DỪNG FLOW TỰ ĐỘNG: Khách đã có phiếu đặt cọc trong CRM nhưng vẫn đang ở trạng thái chờ gửi tin trong Automation Flow. Nên tạm dừng Flow nuôi dưỡng để tránh gửi email quảng cáo làm phiền học viên đã chốt.";
            }
        }
        if (empty($salesRecommendations)) {
            $salesRecommendations[] = "Khách hàng hiện có mức tương tác số thấp hoặc chưa khớp lịch sử mở mail/truy cập web. Đề xuất đưa khách vào kịch bản Automation Flow nuôi dưỡng tự động hoặc gửi khảo sát kèm Voucher để kích hoạt tương tác.";
        }

        $erpCardBlock = '<<<ERP_CARD: ' . json_encode([
            'entity_type' => 'contact',
            'id' => $cid,
            'title' => (string)($contact['full_name'] ?? 'Khách hàng'),
            'subtitle' => trim(($contact['program'] ?? 'Chưa chọn CT') . ' • ' . ($contact['stage_name'] ?? 'Mới')),
            'status' => 'Điểm tương tác: ' . $engagementScore,
            'metadata' => [
                'phone' => (string)($contact['phone'] ?? ''),
                'email' => (string)($contact['email'] ?? ''),
                'owner' => (string)($contact['owner_name'] ?? 'Chưa phân bổ'),
                'voucher' => $activeVoucher !== '' ? $activeVoucher : 'Chưa có'
            ],
            'url' => "/contacts?id={$cid}"
        ], JSON_UNESCAPED_UNICODE) . '>>>';

        $nba = [
            "Đưa khách {$contact['full_name']} vào kịch bản Automation Flow",
            "Cấp mã Voucher ưu đãi cho {$contact['full_name']}",
            "Ghi nhận cuộc gọi tư vấn cho {$contact['full_name']}"
        ];

        return [
            'success' => true,
            'contact_crm_profile' => [
                'id' => $cid,
                'full_name' => $contact['full_name'] ?? '',
                'phone' => $contact['phone'] ?? '',
                'email' => $contact['email'] ?? '',
                'program' => $contact['program'] ?? '',
                'stage_id' => $contact['stage_id'] ?? null,
                'stage_name' => $contact['stage_name'] ?? '',
                'owner_id' => $contact['owner_id'] ?? null,
                'owner_name' => $contact['owner_name'] ?? '',
                'city' => $contact['city'] ?? '',
                'source' => $contact['source'] ?? '',
                'job_title' => $contact['job_title'] ?? '',
                'company' => $contact['company'] ?? '',
                'engagement_score' => $engagementScore,
                'marketing_status' => $contact['marketing_status'] ?? ($subscriber['status'] ?? 'active'),
                'active_flow_count' => (int)($contact['active_flow_count'] ?? 0),
                'active_flow_names' => $contact['active_flow_names'] ?? '',
                'active_voucher_code' => $activeVoucher,
                'survey_completed_count' => max((int)($contact['survey_completed_count'] ?? 0), count($surveyResponses)),
                'profile_url' => "/contacts?id={$cid}"
            ],
            'automation_subscriber_profile' => $subscriber ? [
                'subscriber_id' => $subscriber['id'],
                'email' => $subscriber['email'] ?? '',
                'phone' => $subscriber['phone_number'] ?? ($subscriber['phone'] ?? ''),
                'status' => $subscriber['status'] ?? '',
                'lead_score' => (int)($subscriber['lead_score'] ?? 0),
                'stats_sent' => (int)($subscriber['stats_sent'] ?? 0),
                'stats_opened' => (int)($subscriber['stats_opened'] ?? 0),
                'stats_clicked' => (int)($subscriber['stats_clicked'] ?? 0),
                'last_open_at' => $subscriber['last_open_at'] ?? null,
                'last_click_at' => $subscriber['last_click_at'] ?? null,
                'last_activity_at' => $subscriber['last_activity_at'] ?? null,
                'zalo_user_id' => $subscriber['zalo_user_id'] ?? null,
                'is_zalo_follower' => (bool)($subscriber['is_zalo_follower'] ?? false),
                'meta_psid' => $subscriber['meta_psid'] ?? null,
                'tags' => $subscriber['tags'] ?? null,
            ] : null,
            'omnichannel_journey' => [
                'automation_flow_states' => $flowStates,
                'flow_enrollments' => $flowEnrollments,
                'web_sessions' => $webSessions,
                'web_page_views' => $webPageViews,
                'survey_responses' => $surveyResponses,
                'voucher_codes' => $voucherCodes,
                'voucher_claims' => $voucherClaims,
                'zalo_profile' => $zaloProfile,
                'meta_conversations' => $metaConversations,
            ],
            'crm_history' => [
                'recent_activities' => $crmActivities,
                'deposits' => $crmDeposits,
            ],
            'sales_approach_recommendations' => $salesRecommendations,
            'erp_card_block' => $erpCardBlock,
            'next_best_actions_block' => '<<<NEXT_BEST_ACTIONS: ' . json_encode($nba, JSON_UNESCAPED_UNICODE) . '>>>'
        ];
    }

    /**
     * 4. Execute Smart Manage Automation Flows, Vouchers & Silent Match-Only Sync (`smart_manage_automation_flows_and_campaigns`)
     */
    public static function executeSmartManageAutomation(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $action = strtolower(trim((string)($args['action'] ?? '')));

        switch ($action) {
            case 'run_silent_match_sync':
                return self::executeSilentMatchOnlySync($db, $tid, $auth);

            case 'toggle_flow_status':
                return self::executeToggleFlowStatus($db, $args, $auth);

            case 'enroll_contact_in_flow':
                return self::executeEnrollContactInFlow($db, $tid, $args, $auth);

            case 'pause_or_resume_contact_flow':
                return self::executePauseOrResumeContactFlow($db, $tid, $args, $auth);

            case 'issue_or_redeem_voucher':
                return self::executeIssueOrRedeemVoucher($db, $tid, $args, $auth);

            default:
                return [
                    'success' => false,
                    'error' => "Hành động '{$action}' không hợp lệ. Các hành động hỗ trợ: enroll_contact_in_flow, pause_or_resume_contact_flow, toggle_flow_status, issue_or_redeem_voucher, run_silent_match_sync."
                ];
        }
    }

    /**
     * Action 4A: Silent Match-Only Sync ("3 KHÔNG": Match-Only on existing `contacts`, ZERO new contacts, ZERO lead distribution, ZERO notifications)
     */
    public static function executeSilentMatchOnlySync(PDO $db, int $tid, array $auth): array
    {
        // Check if external DomationContactMatcher helper exists and invoke it if available
        $matcherPaths = [
            __DIR__ . '/../../utils/DomationContactMatcher.php',
            __DIR__ . '/../../services/DomationContactMatcher.php',
            __DIR__ . '/../../automation/DomationContactMatcher.php',
            __DIR__ . '/../DomationContactMatcher.php',
        ];
        foreach ($matcherPaths as $mp) {
            if (file_exists($mp)) {
                require_once $mp;
                break;
            }
        }

        $externalSyncResult = null;
        if (class_exists('DomationContactMatcher')) {
            try {
                if (method_exists('DomationContactMatcher', 'runBulkMatchAndRefresh')) {
                    $externalSyncResult = \DomationContactMatcher::runBulkMatchAndRefresh($db);
                } elseif (method_exists('DomationContactMatcher', 'syncAllMatchedContacts')) {
                    $externalSyncResult = \DomationContactMatcher::syncAllMatchedContacts($db);
                }
            } catch (\Throwable $e) {
                $externalSyncResult = ['warning' => $e->getMessage()];
            }
        }

        if (!self::tableExists($db, 'subscribers') || !self::columnExists($db, 'contacts', 'domation_subscriber_id')) {
            return [
                'success' => false,
                'error' => 'Bảng subscribers hoặc các cột Omnichannel trên bảng contacts chưa được khởi tạo.'
            ];
        }

        $matchedByEmail = 0;
        $matchedByPhone = 0;
        $refreshedContacts = 0;

        try {
            // 1. Match existing contacts (deleted_at IS NULL) by exact lowercase Email — UPDATE ONLY
            $stmtMatchEmail = $db->prepare("
                UPDATE contacts c
                INNER JOIN subscribers s
                    ON c.email IS NOT NULL AND c.email != ''
                   AND s.email IS NOT NULL AND s.email != ''
                   AND LOWER(TRIM(c.email)) = LOWER(TRIM(s.email))
                SET c.domation_subscriber_id = s.id
                WHERE c.tenant_id = ?
                  AND c.deleted_at IS NULL
                  AND (c.domation_subscriber_id IS NULL OR c.domation_subscriber_id = '')
            ");
            $stmtMatchEmail->execute([$tid]);
            $matchedByEmail = $stmtMatchEmail->rowCount();

            // 2. Match existing contacts (deleted_at IS NULL) by 9-digit normalized Phone suffix — UPDATE ONLY
            $stmtMatchPhone = $db->prepare("
                UPDATE contacts c
                INNER JOIN subscribers s
                    ON c.phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '')) >= 9
                   AND LENGTH(REGEXP_REPLACE(COALESCE(NULLIF(s.phone_number, ''), s.phone, ''), '[^0-9]', '')) >= 9
                   AND RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(s.phone_number, ''), s.phone, ''), '[^0-9]', ''), 9)
                SET c.domation_subscriber_id = s.id
                WHERE c.tenant_id = ?
                  AND c.deleted_at IS NULL
                  AND (c.domation_subscriber_id IS NULL OR c.domation_subscriber_id = '')
            ");
            $stmtMatchPhone->execute([$tid]);
            $matchedByPhone = $stmtMatchPhone->rowCount();

            // If subscribers has contact_id column, link back without creating any contact
            if (self::columnExists($db, 'subscribers', 'contact_id')) {
                $db->prepare("
                    UPDATE subscribers s
                    INNER JOIN contacts c ON c.domation_subscriber_id = s.id AND c.deleted_at IS NULL
                    SET s.contact_id = c.id
                    WHERE s.contact_id IS NULL OR s.contact_id = 0
                ")->execute();
            }

            // 3. Refresh denormalized engagement metrics on matched contacts
            $sqlRefresh = "
                UPDATE contacts c
                INNER JOIN subscribers s ON s.id = c.domation_subscriber_id
                LEFT JOIN (
                    SELECT sfs.subscriber_id,
                           COUNT(DISTINCT sfs.flow_id) AS active_flows,
                           GROUP_CONCAT(DISTINCT f.name SEPARATOR ', ') AS flow_names
                    FROM subscriber_flow_states sfs
                    INNER JOIN flows f ON f.id = sfs.flow_id
                    WHERE sfs.status IN ('waiting', 'processing')
                    GROUP BY sfs.subscriber_id
                ) fl_agg ON fl_agg.subscriber_id = s.id
                LEFT JOIN (
                    SELECT subscriber_id,
                           MAX(code) AS latest_code
                    FROM voucher_codes
                    WHERE status = 'unused'
                    GROUP BY subscriber_id
                ) vc_agg ON vc_agg.subscriber_id = s.id
                LEFT JOIN (
                    SELECT subscriber_id,
                           COUNT(*) AS survey_cnt
                    FROM survey_responses
                    GROUP BY subscriber_id
                ) sr_agg ON sr_agg.subscriber_id = s.id
                LEFT JOIN (
                    SELECT wv.subscriber_id,
                           MAX(wv.last_visit_at) AS last_visit,
                           COUNT(wpv.id) AS pv_cnt,
                           COALESCE(MAX(wpv.scroll_depth), 0) AS max_scroll
                    FROM web_visitors wv
                    LEFT JOIN web_page_views wpv ON wpv.visitor_id = wv.visitor_id
                    WHERE wv.subscriber_id IS NOT NULL AND wv.subscriber_id != ''
                    GROUP BY wv.subscriber_id
                ) web_agg ON web_agg.subscriber_id = s.id
                SET
                    c.stats_email_sent = COALESCE(s.stats_sent, 0),
                    c.stats_email_opened = COALESCE(s.stats_opened, 0),
                    c.stats_email_clicked = COALESCE(s.stats_clicked, 0),
                    c.last_email_open_at = s.last_open_at,
                    c.last_email_click_at = s.last_click_at,
                    c.zalo_user_id = COALESCE(NULLIF(s.zalo_user_id, ''), c.zalo_user_id),
                    c.meta_psid = COALESCE(NULLIF(s.meta_psid, ''), c.meta_psid),
                    c.marketing_status = COALESCE(NULLIF(s.status, ''), 'active'),
                    c.active_flow_count = COALESCE(fl_agg.active_flows, 0),
                    c.active_flow_names = fl_agg.flow_names,
                    c.active_voucher_code = COALESCE(vc_agg.latest_code, c.active_voucher_code),
                    c.survey_completed_count = COALESCE(sr_agg.survey_cnt, 0),
                    c.last_web_visit_at = COALESCE(web_agg.last_visit, c.last_web_visit_at),
                    c.web_pageviews_count = COALESCE(web_agg.pv_cnt, c.web_pageviews_count, 0),
                    c.max_scroll_depth = GREATEST(COALESCE(c.max_scroll_depth, 0), COALESCE(web_agg.max_scroll, 0)),
                    c.engagement_score = GREATEST(
                        COALESCE(s.lead_score, 0),
                        LEAST(100,
                            (COALESCE(s.stats_opened, 0) * 5) +
                            (COALESCE(s.stats_clicked, 0) * 15) +
                            (COALESCE(web_agg.pv_cnt, 0) * 4) +
                            (COALESCE(sr_agg.survey_cnt, 0) * 20) +
                            (CASE WHEN vc_agg.latest_code IS NOT NULL THEN 15 ELSE 0 END)
                        )
                    )
                WHERE c.tenant_id = ? AND c.deleted_at IS NULL
            ";
            $stmtRef = $db->prepare($sqlRefresh);
            $stmtRef->execute([$tid]);
            $refreshedContacts = $stmtRef->rowCount();
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => 'Lỗi khi đồng bộ đối sánh dữ liệu Marketing: ' . $e->getMessage()
            ];
        }

        $totalMatchedNow = (int)$db->query("SELECT COUNT(*) FROM contacts WHERE tenant_id = {$tid} AND deleted_at IS NULL AND domation_subscriber_id IS NOT NULL AND domation_subscriber_id != ''")->fetchColumn();

        return [
            'success' => true,
            'action' => 'run_silent_match_sync',
            'sync_policy' => 'MATCH_ONLY_3_KHONG (Không tạo mới Contact/Lead, Không tự động chia Lead, Không gửi thông báo)',
            'newly_matched_by_email' => $matchedByEmail,
            'newly_matched_by_phone_9digits' => $matchedByPhone,
            'contacts_metrics_refreshed' => $refreshedContacts,
            'total_matched_contacts_in_crm' => $totalMatchedNow,
            'external_matcher_result' => $externalSyncResult,
            'message' => "Đã hoàn tất đồng bộ đối sánh ngầm (Match-Only): Khớp mới {$matchedByEmail} hồ sơ qua Email, {$matchedByPhone} hồ sơ qua 9 số cuối SĐT, cập nhật chỉ số tương tác cho {$refreshedContacts} hồ sơ (Tổng cộng {$totalMatchedNow} hồ sơ CRM đã gắn kết dữ liệu Marketing). Tuân thủ tuyệt đối nguyên tắc 3 KHÔNG: 0 contact mới được tạo, 0 chia lead, 0 thông báo."
        ];
    }

    /**
     * Action 4B: Toggle Automation Flow Status (`active` <-> `paused`)
     */
    private static function executeToggleFlowStatus(PDO $db, array $args, array $auth): array
    {
        $leadRbac = AgentToolRegistry::evaluateLeadReadScope($db, $auth);
        if (!$leadRbac['is_global_admin'] && !$leadRbac['is_marketing'] && !$leadRbac['is_manager'] && !$leadRbac['is_sale_admin']) {
            return [
                'success' => false,
                'error' => 'Chỉ Quản trị viên, Bộ phận Marketing hoặc Quản lý mới có quyền bật/tạm dừng toàn bộ một kịch bản Automation Flow.'
            ];
        }

        if (!self::tableExists($db, 'flows')) {
            return ['success' => false, 'error' => 'Bảng flows chưa tồn tại.'];
        }

        $flowId = trim((string)($args['flow_id'] ?? ''));
        $flowQuery = trim((string)($args['flow_query'] ?? ''));
        $targetStatus = strtolower(trim((string)($args['target_status'] ?? 'paused')));
        if (!in_array($targetStatus, ['active', 'paused', 'draft', 'archived'], true)) {
            $targetStatus = 'paused';
        }

        $flow = self::resolveFlow($db, $flowId, $flowQuery);
        if (isset($flow['error'])) {
            return $flow;
        }

        $stmtUpd = $db->prepare("UPDATE flows SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmtUpd->execute([$targetStatus, $flow['id']]);

        return [
            'success' => true,
            'action' => 'toggle_flow_status',
            'flow_id' => $flow['id'],
            'flow_name' => $flow['name'],
            'previous_status' => $flow['status'],
            'new_status' => $targetStatus,
            'message' => "Đã chuyển trạng thái kịch bản Automation Flow '{$flow['name']}' từ '{$flow['status']}' sang '{$targetStatus}'."
        ];
    }

    /**
     * Action 4C: Enroll a CRM Contact into an Automation Flow (`enroll_contact_in_flow`)
     */
    private static function executeEnrollContactInFlow(PDO $db, int $tid, array $args, array $auth): array
    {
        $contactId = (int)($args['contact_id'] ?? 0);
        $contactQuery = trim((string)($args['contact_query'] ?? ''));
        $flowId = trim((string)($args['flow_id'] ?? ''));
        $flowQuery = trim((string)($args['flow_query'] ?? ''));

        $resContact = AgentToolRegistry::resolveContactWithDisambiguation(
            $db,
            $tid,
            $auth,
            $contactQuery,
            $contactId,
            'đưa vào kịch bản chăm sóc tự động (Automation Flow)',
            false
        );
        if (($resContact['status'] ?? '') === 'ambiguous') {
            return $resContact['disambiguation_payload'];
        }
        if (($resContact['status'] ?? '') !== 'resolved') {
            return $resContact['error_payload'];
        }
        $contact = $resContact['contact'];

        $flow = self::resolveFlow($db, $flowId, $flowQuery);
        if (isset($flow['error'])) {
            return $flow;
        }

        // Ensure subscriber record exists in `subscribers` for this CRM contact (Note: creating/linking a subscriber in Domation for an EXISTING CRM contact is allowed; we never create new contacts in MYERP.contacts)
        $subId = self::ensureSubscriberForExistingContact($db, $contact);
        if ($subId === '') {
            return [
                'success' => false,
                'error' => "Không thể khởi tạo/liên kết Subscriber cho khách hàng {$contact['full_name']} (Vui lòng kiểm tra khách đã có Email hoặc SĐT hợp lệ chưa)."
            ];
        }

        // Find first step_id from flow steps JSON if available
        $firstStepId = 'step_1';
        $firstStepType = 'email';
        if (!empty($flow['steps'])) {
            $stepsArr = json_decode((string)$flow['steps'], true);
            if (is_array($stepsArr) && !empty($stepsArr[0]) && is_array($stepsArr[0])) {
                $firstStepId = (string)($stepsArr[0]['id'] ?? 'step_1');
                $firstStepType = (string)($stepsArr[0]['type'] ?? 'email');
            }
        }

        if (self::tableExists($db, 'flow_enrollments')) {
            $enrollId = sprintf('enr_%s_%s', substr(md5($flow['id'] . '_' . $subId), 0, 12), time());
            $stmtEnr = $db->prepare("
                INSERT INTO flow_enrollments (id, flow_id, subscriber_id, current_step_id, status, next_run_at, enrolled_at, created_at)
                VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), NOW())
            ");
            try {
                $stmtEnr->execute([$enrollId, $flow['id'], $subId, $firstStepId]);
            } catch (\Throwable $e) {}
        }

        if (self::tableExists($db, 'subscriber_flow_states')) {
            $stmtCheck = $db->prepare("SELECT id, status FROM subscriber_flow_states WHERE flow_id = ? AND subscriber_id = ? LIMIT 1");
            $stmtCheck->execute([$flow['id'], $subId]);
            $existingState = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            if ($existingState) {
                $db->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = NOW(), updated_at = NOW() WHERE id = ?")
                   ->execute([$existingState['id']]);
            } else {
                $db->prepare("
                    INSERT INTO subscriber_flow_states (subscriber_id, flow_id, step_id, step_type, status, scheduled_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())
                ")->execute([$subId, $flow['id'], $firstStepId, $firstStepType]);
            }
        }

        // Update flow enrolled count and contact's active_flow_names
        try {
            $db->prepare("UPDATE flows SET stat_enrolled = COALESCE(stat_enrolled, 0) + 1, updated_at = NOW() WHERE id = ?")
               ->execute([$flow['id']]);
            self::refreshSingleContactEngagement($db, (int)$contact['id'], $subId);
        } catch (\Throwable $e) {}

        return [
            'success' => true,
            'action' => 'enroll_contact_in_flow',
            'contact_id' => (int)$contact['id'],
            'contact_name' => $contact['full_name'],
            'subscriber_id' => $subId,
            'flow_id' => $flow['id'],
            'flow_name' => $flow['name'],
            'message' => "Đã đưa khách hàng {$contact['full_name']} (#{$contact['id']}) vào kịch bản Automation Flow '{$flow['name']}'."
        ];
    }

    /**
     * Action 4D: Pause or Resume Automation Flow for a Specific Contact (`pause_or_resume_contact_flow`)
     */
    private static function executePauseOrResumeContactFlow(PDO $db, int $tid, array $args, array $auth): array
    {
        $contactId = (int)($args['contact_id'] ?? 0);
        $contactQuery = trim((string)($args['contact_query'] ?? ''));
        $flowId = trim((string)($args['flow_id'] ?? ''));
        $flowQuery = trim((string)($args['flow_query'] ?? ''));
        $targetStatus = strtolower(trim((string)($args['target_status'] ?? 'paused')));

        $resContact = AgentToolRegistry::resolveContactWithDisambiguation(
            $db,
            $tid,
            $auth,
            $contactQuery,
            $contactId,
            'tạm dừng/tiếp tục kịch bản Automation Flow',
            false
        );
        if (($resContact['status'] ?? '') === 'ambiguous') {
            return $resContact['disambiguation_payload'];
        }
        if (($resContact['status'] ?? '') !== 'resolved') {
            return $resContact['error_payload'];
        }
        $contact = $resContact['contact'];
        $subId = trim((string)($contact['domation_subscriber_id'] ?? $contact['subscriber_id'] ?? ''));

        if ($subId === '') {
            return [
                'success' => false,
                'error' => "Khách hàng {$contact['full_name']} (#{$contact['id']}) hiện chưa liên kết với bất kỳ kịch bản Automation Flow nào."
            ];
        }

        $stateStatus = in_array($targetStatus, ['active', 'resume', 'waiting'], true) ? 'waiting' : 'paused';
        $whereFlow = '';
        $params = [$stateStatus, $subId];
        if ($flowId !== '' || $flowQuery !== '') {
            $flow = self::resolveFlow($db, $flowId, $flowQuery);
            if (isset($flow['error'])) {
                return $flow;
            }
            $whereFlow = ' AND flow_id = ?';
            $params[] = $flow['id'];
        }

        $affected = 0;
        if (self::tableExists($db, 'subscriber_flow_states')) {
            $stmt = $db->prepare("UPDATE subscriber_flow_states SET status = ?, updated_at = NOW() WHERE subscriber_id = ?{$whereFlow}");
            $stmt->execute($params);
            $affected += $stmt->rowCount();
        }
        if (self::tableExists($db, 'flow_enrollments')) {
            $enrollStatus = ($stateStatus === 'waiting') ? 'active' : 'paused';
            $eParams = [$enrollStatus, $subId];
            if (!empty($whereFlow)) {
                $eParams[] = end($params);
            }
            $stmtE = $db->prepare("UPDATE flow_enrollments SET status = ? WHERE subscriber_id = ?{$whereFlow}");
            $stmtE->execute($eParams);
            $affected += $stmtE->rowCount();
        }

        self::refreshSingleContactEngagement($db, (int)$contact['id'], $subId);

        $statusLabel = ($stateStatus === 'waiting') ? 'Tiếp tục chạy (Active/Waiting)' : 'Tạm dừng (Paused)';
        return [
            'success' => true,
            'action' => 'pause_or_resume_contact_flow',
            'contact_id' => (int)$contact['id'],
            'contact_name' => $contact['full_name'],
            'new_state_status' => $stateStatus,
            'records_updated' => $affected,
            'message' => "Đã cập nhật trạng thái kịch bản Automation Flow của khách hàng {$contact['full_name']} sang: {$statusLabel}."
        ];
    }

    /**
     * Action 4E: Issue or Redeem a Voucher Code for a Contact (`issue_or_redeem_voucher`)
     */
    private static function executeIssueOrRedeemVoucher(PDO $db, int $tid, array $args, array $auth): array
    {
        $contactId = (int)($args['contact_id'] ?? 0);
        $contactQuery = trim((string)($args['contact_query'] ?? ''));
        $voucherCampaignQuery = trim((string)($args['voucher_campaign_query'] ?? ''));
        $voucherCodeArg = trim((string)($args['voucher_code'] ?? ''));
        $targetStatus = strtolower(trim((string)($args['target_status'] ?? '')));

        $resContact = AgentToolRegistry::resolveContactWithDisambiguation(
            $db,
            $tid,
            $auth,
            $contactQuery,
            $contactId,
            'cấp phát hoặc đánh dấu sử dụng Voucher',
            false
        );
        if (($resContact['status'] ?? '') === 'ambiguous') {
            return $resContact['disambiguation_payload'];
        }
        if (($resContact['status'] ?? '') !== 'resolved') {
            return $resContact['error_payload'];
        }
        $contact = $resContact['contact'];
        $subId = self::ensureSubscriberForExistingContact($db, $contact);

        // Case 1: Redeem an existing voucher code (`target_status === 'used'` or `voucher_code` provided)
        if ($targetStatus === 'used' || ($voucherCodeArg !== '' && $voucherCampaignQuery === '')) {
            $codeToUse = $voucherCodeArg !== '' ? $voucherCodeArg : trim((string)($contact['active_voucher_code'] ?? ''));
            if ($codeToUse === '') {
                return [
                    'success' => false,
                    'error' => "Vui lòng cung cấp mã Voucher cần đánh dấu đã sử dụng (Khách hàng {$contact['full_name']} hiện không có mã Voucher đang chờ)."
                ];
            }
            if (self::tableExists($db, 'voucher_codes')) {
                $stmtUpd = $db->prepare("UPDATE voucher_codes SET status = 'used', used_at = NOW() WHERE code = ?");
                $stmtUpd->execute([$codeToUse]);
            }
            self::refreshSingleContactEngagement($db, (int)$contact['id'], $subId);
            return [
                'success' => true,
                'action' => 'issue_or_redeem_voucher',
                'operation' => 'redeem',
                'contact_id' => (int)$contact['id'],
                'contact_name' => $contact['full_name'],
                'voucher_code' => $codeToUse,
                'message' => "Đã đánh dấu mã Voucher '{$codeToUse}' của khách hàng {$contact['full_name']} là ĐÃ SỬ DỤNG (used)."
            ];
        }

        // Case 2: Issue a voucher from a campaign
        if (!self::tableExists($db, 'voucher_campaigns') || !self::tableExists($db, 'voucher_codes')) {
            return ['success' => false, 'error' => 'Bảng chiến dịch Voucher chưa được khởi tạo.'];
        }

        $vcWhere = "status = 'active'";
        $vcParams = [];
        if ($voucherCampaignQuery !== '') {
            $vcWhere = "(id = ? OR name LIKE ? OR static_code LIKE ?)";
            $vcParams = [$voucherCampaignQuery, '%' . $voucherCampaignQuery . '%', '%' . $voucherCampaignQuery . '%'];
        }
        $stmtCamp = $db->prepare("SELECT * FROM voucher_campaigns WHERE {$vcWhere} ORDER BY created_at DESC LIMIT 1");
        $stmtCamp->execute($vcParams);
        $vCamp = $stmtCamp->fetch(PDO::FETCH_ASSOC);
        if (!$vCamp) {
            return [
                'success' => false,
                'error' => $voucherCampaignQuery !== ''
                    ? "Không tìm thấy chiến dịch Voucher nào khớp với '{$voucherCampaignQuery}'."
                    : "Hiện không có chiến dịch Voucher nào đang hoạt động (active)."
            ];
        }

        // Try to assign an unused code in `voucher_codes` or generate one
        $stmtCode = $db->prepare("
            SELECT id, code FROM voucher_codes
            WHERE campaign_id = ? AND status = 'unused' AND (subscriber_id IS NULL OR subscriber_id = '')
            LIMIT 1
        ");
        $stmtCode->execute([$vCamp['id']]);
        $freeCode = $stmtCode->fetch(PDO::FETCH_ASSOC);

        if ($freeCode) {
            $issuedCode = (string)$freeCode['code'];
            $db->prepare("UPDATE voucher_codes SET subscriber_id = ?, claimed_at = NOW(), sent_at = NOW(), claimed_source = 'crm_ai' WHERE id = ?")
               ->execute([$subId, $freeCode['id']]);
        } else {
            $prefix = !empty($vCamp['static_code']) ? strtoupper((string)$vCamp['static_code']) : 'VIP';
            $issuedCode = $prefix . '-' . strtoupper(substr(md5($contact['id'] . '_' . microtime(true)), 0, 6));
            $newId = sprintf('vc_%s', substr(md5($issuedCode . microtime(true)), 0, 16));
            $db->prepare("
                INSERT INTO voucher_codes (id, campaign_id, code, subscriber_id, status, sent_at, claimed_at, claimed_source, created_at)
                VALUES (?, ?, ?, ?, 'unused', NOW(), NOW(), 'crm_ai', NOW())
            ")->execute([$newId, $vCamp['id'], $issuedCode, $subId]);
        }

        if (self::columnExists($db, 'contacts', 'active_voucher_code')) {
            $db->prepare("UPDATE contacts SET active_voucher_code = ? WHERE id = ?")
               ->execute([$issuedCode, (int)$contact['id']]);
        }
        self::refreshSingleContactEngagement($db, (int)$contact['id'], $subId);

        return [
            'success' => true,
            'action' => 'issue_or_redeem_voucher',
            'operation' => 'issue',
            'contact_id' => (int)$contact['id'],
            'contact_name' => $contact['full_name'],
            'voucher_campaign_id' => $vCamp['id'],
            'voucher_campaign_name' => $vCamp['name'],
            'issued_voucher_code' => $issuedCode,
            'message' => "Đã cấp mã Voucher '{$issuedCode}' (Chiến dịch: {$vCamp['name']}) cho khách hàng {$contact['full_name']} (#{$contact['id']})."
        ];
    }

    /**
     * Helper: Resolve a Flow by ID or Name
     */
    private static function resolveFlow(PDO $db, string $flowId, string $flowQuery): array
    {
        if ($flowId !== '') {
            $stmt = $db->prepare("SELECT * FROM flows WHERE id = ? LIMIT 1");
            $stmt->execute([$flowId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return $row;
            }
        }
        if ($flowQuery === '') {
            return [
                'success' => false,
                'error' => 'Vui lòng cung cấp tên hoặc ID của kịch bản Automation Flow.'
            ];
        }
        $stmt = $db->prepare("SELECT * FROM flows WHERE id = ? OR name LIKE ? ORDER BY status = 'active' DESC, updated_at DESC LIMIT 5");
        $stmt->execute([$flowQuery, '%' . $flowQuery . '%']);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (empty($rows)) {
            return [
                'success' => false,
                'error' => "Không tìm thấy kịch bản Automation Flow nào khớp với '{$flowQuery}'."
            ];
        }
        return $rows[0];
    }

    /**
     * Helper: Ensure an existing CRM contact has a linked subscriber_id in `subscribers`
     * (Never creates any contact in `contacts` — only links or creates subscriber record for an already-existing CRM contact)
     */
    private static function ensureSubscriberForExistingContact(PDO $db, array $contact): string
    {
        $cid = (int)($contact['id'] ?? 0);
        $subId = trim((string)($contact['domation_subscriber_id'] ?? $contact['subscriber_id'] ?? ''));
        if ($subId !== '' && self::tableExists($db, 'subscribers')) {
            $stmt = $db->prepare("SELECT id FROM subscribers WHERE id = ? LIMIT 1");
            $stmt->execute([$subId]);
            if ($stmt->fetchColumn()) {
                return $subId;
            }
        }

        if (!self::tableExists($db, 'subscribers')) {
            return '';
        }

        $email = strtolower(trim((string)($contact['email'] ?? '')));
        $phone = trim((string)($contact['phone'] ?? ''));
        $phone9 = self::normalizePhone9Digits($phone);

        $where = [];
        $params = [];
        if ($email !== '') {
            $where[] = "LOWER(TRIM(email)) = ?";
            $params[] = $email;
        }
        if ($phone9 !== '') {
            $where[] = "RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(phone_number, ''), phone, ''), '[^0-9]', ''), 9) = ?";
            $params[] = $phone9;
        }
        if (!empty($where)) {
            $stmt = $db->prepare("SELECT id FROM subscribers WHERE " . implode(' OR ', $where) . " LIMIT 1");
            $stmt->execute($params);
            $foundId = $stmt->fetchColumn();
            if ($foundId) {
                $subId = (string)$foundId;
                if ($cid > 0 && self::columnExists($db, 'contacts', 'domation_subscriber_id')) {
                    $db->prepare("UPDATE contacts SET domation_subscriber_id = ? WHERE id = ?")->execute([$subId, $cid]);
                }
                return $subId;
            }
        }

        // Create subscriber record for this existing CRM contact
        $newSubId = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $fullName = trim((string)($contact['full_name'] ?? 'Khách hàng'));
        $parts = preg_split('/\s+/u', $fullName);
        $lastName = count($parts) > 1 ? array_pop($parts) : $fullName;
        $firstName = count($parts) > 0 ? implode(' ', $parts) : '';
        $safeEmail = $email !== '' ? $email : ("lead_{$cid}@crm.local");

        try {
            $stmtIns = $db->prepare("
                INSERT INTO subscribers (id, email, first_name, last_name, status, source, phone_number, phone, city, joined_at, created_at)
                VALUES (?, ?, ?, ?, 'active', 'CRM', ?, ?, ?, NOW(), NOW())
            ");
            $stmtIns->execute([$newSubId, $safeEmail, $firstName, $lastName, $phone, $phone, $contact['city'] ?? null]);
            if ($cid > 0 && self::columnExists($db, 'contacts', 'domation_subscriber_id')) {
                $db->prepare("UPDATE contacts SET domation_subscriber_id = ? WHERE id = ?")->execute([$newSubId, $cid]);
            }
            return $newSubId;
        } catch (\Throwable $e) {
            return '';
        }
    }

    /**
     * Helper: Refresh denormalized Omnichannel columns on a single `contacts` record
     */
    private static function refreshSingleContactEngagement(PDO $db, int $contactId, string $subId): void
    {
        if ($contactId <= 0 || $subId === '' || !self::columnExists($db, 'contacts', 'engagement_score')) {
            return;
        }
        try {
            $activeFlows = 0;
            $flowNames = null;
            if (self::tableExists($db, 'subscriber_flow_states') && self::tableExists($db, 'flows')) {
                $stmtFl = $db->prepare("
                    SELECT COUNT(DISTINCT sfs.flow_id) AS cnt,
                           GROUP_CONCAT(DISTINCT f.name SEPARATOR ', ') AS names
                    FROM subscriber_flow_states sfs
                    INNER JOIN flows f ON f.id = sfs.flow_id
                    WHERE sfs.subscriber_id = ? AND sfs.status IN ('waiting', 'processing')
                ");
                $stmtFl->execute([$subId]);
                $rowFl = $stmtFl->fetch(PDO::FETCH_ASSOC);
                if ($rowFl) {
                    $activeFlows = (int)($rowFl['cnt'] ?? 0);
                    $flowNames = $rowFl['names'] ?? null;
                }
            }

            $latestVoucher = null;
            if (self::tableExists($db, 'voucher_codes')) {
                $stmtVc = $db->prepare("SELECT code FROM voucher_codes WHERE subscriber_id = ? AND status = 'unused' ORDER BY created_at DESC LIMIT 1");
                $stmtVc->execute([$subId]);
                $latestVoucher = $stmtVc->fetchColumn() ?: null;
            }

            $db->prepare("
                UPDATE contacts
                SET active_flow_count = ?,
                    active_flow_names = ?,
                    active_voucher_code = ?
                WHERE id = ?
            ")->execute([$activeFlows, $flowNames, $latestVoucher, $contactId]);
        } catch (\Throwable $e) {}
    }
}
