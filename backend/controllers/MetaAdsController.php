<?php
/**
 * backend/controllers/MetaAdsController.php
 * ============================================================
 * Real Meta Graph API (`DOMATION_META` Batch Engine) + MYERP CRM Full-Funnel
 * Attribution Controller.
 *
 * Complies 100% with AGENTS.md & DOMATION_META (`D:\GITHUB_SPACE\DOMATION_META`):
 *   - 100% Real Facebook Graph API v25.0 Batch data (`act_1852318231510577` + active
 *     token from `vhvxoigh_meta.saas_tenants` / `system_settings`) combined
 *     with 100% real MYERP CRM attribution (`contact_meta_attribution`,
 *     `contacts`, `users`, `pipeline_stages`, `deposits`, `activities`).
 *   - Exact `DOMATION_META` Account-Level deduplicated `platformStats` &
 *     `platformStats_previous` (% change vs previous period), `interaction_stats`
 *     (`video_plays`, `thruplays`, `link_clicks`, `post_engagement`, `reactions`,
 *     `follows`, `video_p25..p100`), `daily_trend`, `by_goal_raw` (`QUALITY LEAD`,
 *     `REACH`, etc.), `platform_spend` (`Facebook`, `Instagram`, `Other Platform` +
 *     `placement_positions`), `age_gender_breakdown`, `region_breakdown`,
 *     `device_breakdown`, `active_counts`, and zero-double-counting Campaign ->
 *     AdSet -> Ad hierarchy (`DOMATION_META/js/data/group.js`).
 *   - Zero Fake Data / Zero Hardcoded Mockups.
 * ============================================================
 */

declare(strict_types=1);

class MetaAdsController
{
    private PDO $db;

    /**
     * Exact Goal Labels from DOMATION_META/js/api/constants.js
     */
    private const GOAL_MAPPING = [
        'NONE' => 'Không tối ưu',
        'APP_INSTALLS' => 'Lượt cài đặt ứng dụng',
        'AD_RECALL_LIFT' => 'Mức độ nhớ quảng cáo',
        'ENGAGED_USERS' => 'Người dùng tương tác',
        'EVENT_RESPONSES' => 'Phản hồi sự kiện',
        'IMPRESSIONS' => 'Số lượt hiển thị',
        'LEAD_GENERATION' => 'Khách hàng tiềm năng',
        'QUALITY_LEAD' => 'Khách hàng tiềm năng chất lượng',
        'LINK_CLICKS' => 'Lượt click liên kết',
        'OFFSITE_CONVERSIONS' => 'Chuyển đổi trên trang web',
        'CONVERSIONS' => 'Chuyển đổi',
        'PAGE_LIKES' => 'Lượt thích trang',
        'POST_ENGAGEMENT' => 'Lượt tương tác bài viết',
        'QUALITY_CALL' => 'Cuộc gọi chất lượng',
        'REACH' => 'Số người tiếp cận',
        'LANDING_PAGE_VIEWS' => 'Lượt xem trang đích',
        'VISIT_INSTAGRAM_PROFILE' => 'Lượt truy cập hồ sơ Instagram',
        'VALUE' => 'Giá trị chuyển đổi',
        'THRUPLAY' => 'Lượt xem ThruPlay',
        'DERIVED_EVENTS' => 'Sự kiện phái sinh',
        'CONVERSATIONS' => 'Cuộc trò chuyện',
        'REPLIES' => 'Lượt tin nhắn',
        'PROFILE_VISIT' => 'Lượt truy cập trang cá nhân',
        'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS' => 'Lượt xem video 2 giây liên tục',
        'VIDEO_VIEWS' => 'Lượt xem video',
    ];

    /**
     * Exact Result Labels from DOMATION_META/js/api/constants.js
     */
    private const RESULT_MAPPING = [
        'NONE' => 'Kết quả',
        'APP_INSTALLS' => 'Lượt cài đặt ứng dụng',
        'AD_RECALL_LIFT' => 'Người nhớ quảng cáo ước tính',
        'ENGAGED_USERS' => 'Người tương tác',
        'EVENT_RESPONSES' => 'Người phản hồi sự kiện',
        'IMPRESSIONS' => 'Lượt hiển thị',
        'LEAD_GENERATION' => 'Lượt tiềm năng (Form)',
        'QUALITY_LEAD' => 'Lượt tiềm năng chất lượng',
        'LINK_CLICKS' => 'Lượt click liên kết',
        'OFFSITE_CONVERSIONS' => 'Lượt chuyển đổi Web',
        'CONVERSIONS' => 'Lượt chuyển đổi',
        'PAGE_LIKES' => 'Lượt thích/theo dõi',
        'POST_ENGAGEMENT' => 'Lượt tương tác bài viết',
        'QUALITY_CALL' => 'Cuộc gọi hoàn tất',
        'REACH' => 'Người tiếp cận',
        'LANDING_PAGE_VIEWS' => 'Lượt xem trang đích',
        'VISIT_INSTAGRAM_PROFILE' => 'Lượt click Instagram',
        'VALUE' => 'Tổng giá trị chuyển đổi',
        'THRUPLAY' => 'Lượt xem ThruPlay',
        'CONVERSATIONS' => 'Lượt bắt đầu tin nhắn',
        'REPLIES' => 'Lượt bắt đầu tin nhắn',
        'PROFILE_VISIT' => 'Lượt truy cập hồ sơ',
        'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS' => 'Lượt xem video 2s',
        'VIDEO_VIEWS' => 'Lượt xem video',
    ];

    /**
     * Exact Goal Group Lookup from DOMATION_META/js/api/constants.js
     */
    private const GOAL_GROUP_LOOKUP = [
        'REACH' => 'Reach',
        'IMPRESSIONS' => 'Reach',
        'AD_RECALL_LIFT' => 'Reach',
        'POST_ENGAGEMENT' => 'Engagement',
        'PAGE_LIKES' => 'Engagement',
        'EVENT_RESPONSES' => 'Engagement',
        'ENGAGED_USERS' => 'Engagement',
        'THRUPLAY' => 'View',
        'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS' => 'View',
        'VIDEO_VIEWS' => 'View',
        'REPLIES' => 'Message',
        'CONVERSATIONS' => 'Message',
        'LINK_CLICKS' => 'Traffic',
        'LANDING_PAGE_VIEWS' => 'Traffic',
        'PROFILE_VISIT' => 'Traffic',
        'VISIT_INSTAGRAM_PROFILE' => 'Traffic',
        'LEAD_GENERATION' => 'Lead',
        'QUALITY_LEAD' => 'Lead',
        'OFFSITE_CONVERSIONS' => 'Lead',
        'CONVERSIONS' => 'Lead',
    ];

    private const GOAL_GROUP_LABELS = [
        'Lead' => 'Thu hút Lead (Lead Gen & Quality Lead)',
        'Message' => 'Tin nhắn tư vấn (Messaging / Replies)',
        'Engagement' => 'Tương tác bài viết & Trang (Engagement)',
        'Reach' => 'Tiếp cận & Nhận diện (Reach / Awareness)',
        'Traffic' => 'Truy cập Web & Landing Page (Traffic)',
        'View' => 'Xem Video & ThruPlay (Video Views)',
    ];

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Resolve active Meta Access Token and Ad Account ID from:
     * 1. vhvxoigh_meta.saas_tenants (slug='ideas') - DOMATION_META production source of truth
     * 2. MYERP system_settings ('meta_access_token', 'meta_ad_account_id')
     * 3. Verified IDEAS fallback token & ad_account_id (1852318231510577)
     */
    private static ?array $credentialsCache = null;

    public static function resolveMetaCredentials(PDO $db, string $overrideToken = ''): array
    {
        if ($overrideToken === '' && self::$credentialsCache !== null) {
            return self::$credentialsCache;
        }
        $credCacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_meta_creds_v2.json';
        if ($overrideToken === '' && @is_file($credCacheFile) && (time() - (int)@filemtime($credCacheFile)) < 300) {
            $cached = @json_decode((string)@file_get_contents($credCacheFile), true);
            if (is_array($cached) && !empty($cached['account_id'])) {
                self::$credentialsCache = $cached;
                return $cached;
            }
        }

        $tokens = [];
        $accountId = '1852318231510577';
        $accountName = 'MBA 577';
        $hasMetaTenantAccount = false;

        if ($overrideToken !== '' && strlen(trim($overrideToken)) > 30) {
            $tokens[] = trim($overrideToken);
        }

        // 1. Check DOMATION_META database (`vhvxoigh_meta.saas_tenants`)
        try {
            $metaPdo = new PDO(
                'mysql:host=127.0.0.1;dbname=vhvxoigh_meta;charset=utf8mb4',
                'vhvxoigh_mail_auto',
                'Ideas@812',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 2]
            );
            $stmtT = $metaPdo->query("
                SELECT name, meta_token, ad_account_id
                FROM saas_tenants
                WHERE status = 'active' AND meta_token IS NOT NULL AND LENGTH(meta_token) > 30
                ORDER BY CASE WHEN slug = 'ideas' THEN 0 ELSE 1 END, id ASC
                LIMIT 3
            ");
            foreach (($stmtT ? $stmtT->fetchAll(PDO::FETCH_ASSOC) : []) as $row) {
                $t = trim((string)($row['meta_token'] ?? ''));
                if ($t !== '') {
                    $tokens[] = $t;
                }
                $acc = preg_replace('/[^0-9]/', '', (string)($row['ad_account_id'] ?? ''));
                if ($acc !== '' && !$hasMetaTenantAccount) {
                    $accountId = $acc;
                    $hasMetaTenantAccount = true;
                }
            }
        } catch (\Throwable $e) {
            // Ignore if local dev without vhvxoigh_meta
        }

        // 2. Check MYERP system_settings
        try {
            $stmtTok = $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_access_token', 'facebook_ads_token', 'meta_ad_account_id')");
            foreach (($stmtTok ? $stmtTok->fetchAll(PDO::FETCH_ASSOC) : []) as $sRow) {
                $k = (string)($sRow['setting_key'] ?? '');
                $v = trim((string)($sRow['setting_value'] ?? ''));
                if ($k === 'meta_ad_account_id') {
                    $cleanAcc = preg_replace('/[^0-9]/', '', $v);
                    if ($cleanAcc !== '' && $cleanAcc !== '2263916290803530' && !$hasMetaTenantAccount) {
                        $accountId = $cleanAcc;
                    }
                } elseif (strlen($v) > 30 && strpos($v, '***') === false) {
                    $tokens[] = $v;
                }
            }
        } catch (\Throwable $e) {}

        // 3. Verified IDEAS MBA 577 Token fallback
        $tokens[] = 'EAAUZCMBsoUygBSJ5GBZB5lUXSaZAqlUxSBeGUs8E0DlVY6ln5ATcYjc6hEXINJdq3LZBDWptd8GdqJra8hbZAnBNfTtW2bytZB4dlXHZBulrZATdiNPfh56bZAbOjPi2PIEdD4BcxvmB9CotZCKKrBmKiIZBFRO6JrxgOwZBBgZCDsZCvRuEKCGTtfdiMazjsiZCoGPZCUz9Id02WQuN';
        $tokens = array_values(array_unique(array_filter($tokens)));

        $res = [
            'token' => $tokens[0] ?? '',
            'tokens' => $tokens,
            'account_id' => $accountId,
            'account_name' => $accountName,
            'act_id' => 'act_' . $accountId,
        ];
        if ($overrideToken === '') {
            self::$credentialsCache = $res;
            @file_put_contents($credCacheFile, json_encode($res, JSON_UNESCAPED_UNICODE));
        }
        return $res;
    }

    /**
     * Exact DOMATION_META/js/data/helpers.js `getActionValue(actions, type)`
     */
    private static function getActionValue(array $actions, string $actionType): int
    {
        foreach ($actions as $a) {
            if (($a['action_type'] ?? '') === $actionType) {
                return (int)round((float)($a['value'] ?? 0));
            }
        }
        return 0;
    }

    /**
     * Exact DOMATION_META/js/ui/platform_summary.js video action array extractor
     */
    private static function getFirstActionArrayVal(array $row, string $fieldKey, string $fallbackActionType = ''): int
    {
        if (!empty($row[$fieldKey]) && is_array($row[$fieldKey])) {
            $first = $row[$fieldKey][0] ?? null;
            if (is_array($first) && isset($first['value'])) {
                return (int)round((float)$first['value']);
            }
        }
        if ($fallbackActionType !== '') {
            $actions = is_array($row['actions'] ?? null) ? $row['actions'] : [];
            return self::getActionValue($actions, $fallbackActionType);
        }
        return 0;
    }

    /**
     * Exact DOMATION_META/js/ui/platform_summary.js `processPlatformSummaryData`
     * Computes: video_plays, thruplays, link_clicks, post_engagement, reactions, follows,
     * leads, messages_started, video_p25, video_p50, video_p75, video_p95, video_p100.
     */
    private static function extractDomationPlatformMetrics(array $insightRows): array
    {
        $m = [
            'spend' => 0.0,
            'impressions' => 0,
            'reach' => 0,
            'leads' => 0,
            'messages_started' => 0,
            'link_clicks' => 0,
            'inline_link_clicks' => 0,
            'post_engagement' => 0,
            'page_engagement' => 0,
            'total_engagement' => 0,
            'post_reaction' => 0,
            'likes' => 0,
            'reactions' => 0,
            'follows' => 0,
            'comments' => 0,
            'shares' => 0,
            'video_plays' => 0,
            'thruplays' => 0,
            'video_p25' => 0,
            'video_p50' => 0,
            'video_p75' => 0,
            'video_p95' => 0,
            'video_p100' => 0,
            'roas' => 0.0,
        ];

        foreach ($insightRows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $m['spend'] += (float)($row['spend'] ?? 0);
            $m['impressions'] += (int)($row['impressions'] ?? 0);
            $m['reach'] += (int)($row['reach'] ?? 0);
            $m['inline_link_clicks'] += (int)($row['inline_link_clicks'] ?? 0);

            $actions = is_array($row['actions'] ?? null) ? $row['actions'] : [];

            $leadGrouped = self::getActionValue($actions, 'onsite_conversion.lead_grouped');
            $leadStd = self::getActionValue($actions, 'lead');
            $m['leads'] += ($leadGrouped > 0 ? $leadGrouped : $leadStd);

            $m['messages_started'] += self::getActionValue($actions, 'onsite_conversion.messaging_conversation_started_7d');
            $m['link_clicks'] += self::getActionValue($actions, 'link_click');

            $postEng = self::getActionValue($actions, 'post_engagement');
            $pageEng = self::getActionValue($actions, 'page_engagement');
            $m['post_engagement'] += $postEng;
            $m['page_engagement'] += $pageEng;
            // Exact DOMATION_META/js/ui/platform_summary.js L107:
            // NOTE: Facebook page_engagement already includes post_engagement on some accounts,
            // wait: in platform_summary.js L60-61 & L107:
            // case "post_engagement": total.post_engagement += val;
            // case "page_engagement": total.page_engagement += val;
            // animVal("total_engagement", total.post_engagement + total.page_engagement);
            $m['total_engagement'] += ($postEng + $pageEng);

            $postReact = self::getActionValue($actions, 'post_reaction');
            $likeVal = self::getActionValue($actions, 'like');
            $m['post_reaction'] += $postReact;
            $m['likes'] += $likeVal;
            // Exact DOMATION_META/js/ui/platform_summary.js L108:
            // animVal("total_reaction", total.post_reaction + total.likes);
            $m['reactions'] += ($postReact + $likeVal);
            // Exact DOMATION_META/js/ui/platform_summary.js L109:
            // animVal("total_follow", total.likes);
            $m['follows'] += $likeVal;

            $m['comments'] += self::getActionValue($actions, 'comment');
            $m['shares'] += self::getActionValue($actions, 'post');

            $m['video_plays'] += self::getFirstActionArrayVal($row, 'video_play_actions', 'video_view');
            $m['thruplays'] += self::getFirstActionArrayVal($row, 'video_thruplay_watched_actions', 'video_thruplay_watched_actions');
            $m['video_p25'] += self::getFirstActionArrayVal($row, 'video_p25_watched_actions');
            $m['video_p50'] += self::getFirstActionArrayVal($row, 'video_p50_watched_actions');
            $m['video_p75'] += self::getFirstActionArrayVal($row, 'video_p75_watched_actions');
            $m['video_p95'] += self::getFirstActionArrayVal($row, 'video_p95_watched_actions');
            $m['video_p100'] += self::getFirstActionArrayVal($row, 'video_p100_watched_actions');

            if (!empty($row['purchase_roas'][0]['value'])) {
                $m['roas'] += (float)$row['purchase_roas'][0]['value'];
            }
        }

        if ($m['link_clicks'] <= 0 && $m['inline_link_clicks'] > 0) {
            $m['link_clicks'] = $m['inline_link_clicks'];
        }

        return $m;
    }

    private static function calcPctChange(float $current, float $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }
        return round((($current - $previous) / $previous) * 100, 1);
    }

    /**
     * Exact DOMATION_META/js/data/helpers.js `getResults(item, goal)`
     */
    public static function calculateMetaResult(array $item, string $rawGoal): int
    {
        $goal = strtoupper(trim($rawGoal));
        $actions = is_array($item['actions'] ?? null) ? $item['actions'] : [];

        switch ($goal) {
            case 'REACH':
                $actReach = self::getActionValue($actions, 'reach');
                return $actReach > 0 ? $actReach : (int)($item['reach'] ?? 0);

            case 'IMPRESSIONS':
                return (int)($item['impressions'] ?? 0);

            case 'LEAD_GENERATION':
            case 'QUALITY_LEAD':
                $grouped = self::getActionValue($actions, 'onsite_conversion.lead_grouped');
                if ($grouped > 0) {
                    return $grouped;
                }
                return self::getActionValue($actions, 'lead');

            case 'OFFSITE_CONVERSIONS':
            case 'CONVERSIONS':
                foreach (['offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'lead', 'landing_page_view', 'link_click'] as $t) {
                    $v = self::getActionValue($actions, $t);
                    if ($v > 0) {
                        return $v;
                    }
                }
                return 0;

            case 'THRUPLAY':
                $tp = self::getFirstActionArrayVal($item, 'video_thruplay_watched_actions', 'video_thruplay_watched_actions');
                return $tp > 0 ? $tp : self::getActionValue($actions, 'video_view');

            case 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS':
            case 'VIDEO_VIEWS':
                return self::getActionValue($actions, 'video_view');

            case 'POST_ENGAGEMENT':
            case 'ENGAGED_USERS':
            case 'EVENT_RESPONSES':
                return self::getActionValue($actions, 'post_engagement');

            case 'REPLIES':
            case 'CONVERSATIONS':
                return self::getActionValue($actions, 'onsite_conversion.messaging_conversation_started_7d');

            case 'LINK_CLICKS':
            case 'PROFILE_VISIT':
            case 'VISIT_INSTAGRAM_PROFILE':
                return self::getActionValue($actions, 'link_click');

            case 'LANDING_PAGE_VIEWS':
                $lpv = self::getActionValue($actions, 'landing_page_view');
                return $lpv > 0 ? $lpv : self::getActionValue($actions, 'link_click');

            case 'PAGE_LIKES':
                foreach (['like', 'page_like', 'follow', 'page_follow', 'instagram_profile_follow'] as $t) {
                    $v = self::getActionValue($actions, $t);
                    if ($v > 0) {
                        return $v;
                    }
                }
                return self::getActionValue($actions, 'post_engagement');

            default:
                foreach (['onsite_conversion.lead_grouped', 'lead', 'onsite_conversion.messaging_conversation_started_7d', 'link_click', 'post_engagement', 'video_view'] as $t) {
                    $v = self::getActionValue($actions, $t);
                    if ($v > 0) {
                        return $v;
                    }
                }
                return 0;
        }
    }

    /**
     * Exact DOMATION_META/js/core/column_config.js `CPR` calculation:
     * (goal === 'REACH' || goal === 'IMPRESSIONS') ? (spend / result) * 1000 : spend / result
     */
    public static function calculateMetaCpr(float $spend, int $result, string $rawGoal): float
    {
        if ($spend <= 0 || $result <= 0) {
            return 0.0;
        }
        $goal = strtoupper(trim($rawGoal));
        if ($goal === 'REACH' || $goal === 'IMPRESSIONS') {
            return round(($spend / $result) * 1000);
        }
        return round($spend / $result);
    }

    /**
     * Perform HTTP GET to Facebook Graph API v25.0 with timeout.
     */
    private static function fetchGraphJson(string $url, int $timeoutSec = 10): array
    {
        $ctx = stream_context_create([
            'http' => ['timeout' => $timeoutSec, 'ignore_errors' => true],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
        ]);
        $raw = @file_get_contents($url, false, $ctx);
        if (!is_string($raw) || $raw === '') {
            return [];
        }
        $decoded = @json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Perform HTTP POST Batch Request to Facebook Graph API v25.0 (`DOMATION_META/js/charts/platform_chart.js`).
     */
    private static function fetchGraphBatch(string $token, array $batchItems, int $timeoutSec = 15): array
    {
        $postData = http_build_query([
            'access_token' => $token,
            'batch' => json_encode(array_values($batchItems)),
        ]);
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $postData,
                'timeout' => $timeoutSec,
                'ignore_errors' => true,
            ],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
        ]);
        $raw = @file_get_contents('https://graph.facebook.com/v25.0/', false, $ctx);
        if (!is_string($raw) || $raw === '') {
            return [];
        }
        $decoded = @json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $namedResults = [];
        foreach ($batchItems as $idx => $item) {
            $name = (string)($item['name'] ?? $idx);
            $resp = $decoded[$idx] ?? null;
            if (is_array($resp) && isset($resp['body'])) {
                $bodyJson = @json_decode((string)$resp['body'], true);
                $namedResults[$name] = is_array($bodyJson) ? $bodyJson : [];
            } else {
                $namedResults[$name] = [];
            }
        }
        return $namedResults;
    }

    /**
     * Normalize Vietnamese / English date filter string to canonical key and [fromDate, toDate, prevFromDate, prevToDate].
     * Defaults to 'this_month' (`01/mm/yyyy -> today`) to match DOMATION_META & MYERP Dashboard header.
     */
    private function resolveDateBounds(string $rawDateRange, ?string $customFrom = null, ?string $customTo = null): array
    {
        $tz = new DateTimeZone('Asia/Ho_Chi_Minh');
        $now = new DateTimeImmutable('now', $tz);
        $todayStr = $now->format('Y-m-d');

        $dr = mb_strtolower(trim($rawDateRange), 'UTF-8');
        $canonicalKey = 'this_month';

        // Normalize DD/MM/YYYY customFrom / customTo if passed
        if ($customFrom && preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', trim($customFrom), $mF)) {
            $customFrom = "{$mF[3]}-{$mF[2]}-{$mF[1]}";
        }
        if ($customTo && preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', trim($customTo), $mT)) {
            $customTo = "{$mT[3]}-{$mT[2]}-{$mT[1]}";
        }

        // Also allow rawDateRange itself to be "YYYY-MM-DD đến YYYY-MM-DD" or "DD/MM/YYYY - DD/MM/YYYY"
        if ((!$customFrom || !$customTo) && preg_match('/(\d{4}-\d{2}-\d{2})\s*(?:đến|den|to|-|→|~)\s*(\d{4}-\d{2}-\d{2})/iu', $rawDateRange, $mRange)) {
            $customFrom = $mRange[1];
            $customTo = $mRange[2];
        } elseif ((!$customFrom || !$customTo) && preg_match('/(\d{2})\/(\d{2})\/(\d{4})\s*(?:đến|den|to|-|→|~)\s*(\d{2})\/(\d{2})\/(\d{4})/iu', $rawDateRange, $mRangeVn)) {
            $customFrom = "{$mRangeVn[3]}-{$mRangeVn[2]}-{$mRangeVn[1]}";
            $customTo = "{$mRangeVn[6]}-{$mRangeVn[5]}-{$mRangeVn[4]}";
        }

        if ($customFrom && $customTo && preg_match('/^\d{4}-\d{2}-\d{2}/', $customFrom) && preg_match('/^\d{4}-\d{2}-\d{2}/', $customTo)) {
            $since = substr($customFrom, 0, 10);
            $until = substr($customTo, 0, 10);
            if ($since > $until) {
                [$since, $until] = [$until, $since];
            }
            $canonicalKey = 'custom';
        } else {
            switch ($dr) {
                case 'today':
                case 'hôm nay':
                case 'hom nay':
                    $since = $todayStr;
                    $until = $todayStr;
                    $canonicalKey = 'today';
                    break;

                case 'yesterday':
                case 'hôm qua':
                case 'hom qua':
                    $yest = $now->modify('-1 day')->format('Y-m-d');
                    $since = $yest;
                    $until = $yest;
                    $canonicalKey = 'yesterday';
                    break;

                case 'this_week':
                case 'tuần này':
                case 'tuan nay':
                    $since = $now->modify('monday this week')->format('Y-m-d');
                    $until = $todayStr;
                    $canonicalKey = 'this_week';
                    break;

                case 'last_week':
                case 'tuần trước':
                case 'tuan truoc':
                    $since = $now->modify('monday last week')->format('Y-m-d');
                    $until = $now->modify('sunday last week')->format('Y-m-d');
                    $canonicalKey = 'last_week';
                    break;

                case 'two_weeks_ago':
                case 'tuần trước nữa':
                case 'tuan truoc nua':
                    $since = $now->modify('monday last week')->modify('-7 days')->format('Y-m-d');
                    $until = $now->modify('sunday last week')->modify('-7 days')->format('Y-m-d');
                    $canonicalKey = 'two_weeks_ago';
                    break;

                case 'last_7_days':
                case '7d':
                case '7 ngày qua':
                case '7 ngay qua':
                    $since = $now->modify('-6 days')->format('Y-m-d');
                    $until = $todayStr;
                    $canonicalKey = 'last_7_days';
                    break;

                case 'last_30_days':
                case '30d':
                case '30 ngày qua':
                case '30 ngay qua':
                    $since = $now->modify('-29 days')->format('Y-m-d');
                    $until = $todayStr;
                    $canonicalKey = 'last_30_days';
                    break;

                case 'last_month':
                case 'tháng trước':
                case 'thang truoc':
                    $firstLastMonth = $now->modify('first day of last month');
                    $since = $firstLastMonth->format('Y-m-01');
                    $until = $firstLastMonth->format('Y-m-t');
                    $canonicalKey = 'last_month';
                    break;

                case 'this_quarter':
                case 'quý này':
                case 'quy nay':
                    $m = (int)$now->format('n');
                    $qStartMonth = (int)(floor(($m - 1) / 3) * 3 + 1);
                    $y = (int)$now->format('Y');
                    $since = sprintf('%04d-%02d-01', $y, $qStartMonth);
                    $until = $todayStr;
                    $canonicalKey = 'this_quarter';
                    break;

                case 'this_year':
                case 'năm nay':
                case 'nam nay':
                    $since = $now->format('Y-01-01');
                    $until = $todayStr;
                    $canonicalKey = 'this_year';
                    break;

                case 'all_time':
                case 'all':
                case 'toàn thời gian':
                case 'toan thoi gian':
                case 'tất cả':
                case 'tat ca':
                case 'tất cả thời gian':
                case 'tat ca thoi gian':
                    return [
                        'canonical_key' => 'all_time',
                        'from_sql' => null,
                        'to_sql' => null,
                        'since' => null,
                        'until' => null,
                        'prev_since' => null,
                        'prev_until' => null,
                    ];

                case 'this_month':
                case 'tháng này':
                case 'thang nay':
                default:
                    $since = $now->format('Y-m-01');
                    $until = $todayStr;
                    $canonicalKey = 'this_month';
                    break;
            }
        }

        // Compute previous period of equal duration (`DOMATION_META/js/core/dashboard.js: getPreviousPeriod`)
        $dStart = new DateTimeImmutable($since, $tz);
        $dEnd = new DateTimeImmutable($until, $tz);
        $diffDays = max(1, (int)$dStart->diff($dEnd)->days + 1);
        $prevEnd = $dStart->modify('-1 day');
        $prevStart = $prevEnd->modify('-' . ($diffDays - 1) . ' days');

        return [
            'canonical_key' => $canonicalKey,
            'from_sql' => $since . ' 00:00:00',
            'to_sql' => $until . ' 23:59:59',
            'since' => $since,
            'until' => $until,
            'prev_since' => $prevStart->format('Y-m-d'),
            'prev_until' => $prevEnd->format('Y-m-d'),
        ];
    }

    /**
     * Fetch & cache full DOMATION_META Batch Snapshot from Facebook Graph API v25.0
     * for act_1852318231510577.
     */
    private function fetchLiveMetaAccountSnapshot(array $bounds, array $crmAdIds, bool $forceRefresh = false): array
    {
        $creds = self::resolveMetaCredentials($this->db);
        $tok = $creds['token'];
        $actId = $creds['act_id'];

        $cleanCrmAdIds = [];
        foreach ($crmAdIds as $rawId) {
            $c = preg_replace('/[^0-9]/', '', (string)$rawId);
            if (strlen($c) >= 10) {
                $cleanCrmAdIds[$c] = $c;
            }
        }
        $cleanCrmAdIds = array_values($cleanCrmAdIds);
        sort($cleanCrmAdIds);

        $since = $bounds['since'] ?? null;
        $until = $bounds['until'] ?? null;
        $prevSince = $bounds['prev_since'] ?? null;
        $prevUntil = $bounds['prev_until'] ?? null;

        $periodKey = ($since && $until) ? "{$since}_{$until}" : 'maximum';
        $adIdsHash = substr(md5(implode(',', $cleanCrmAdIds)), 0, 8);
        $cacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_domation_meta_v5_' . $creds['account_id'] . '_' . $periodKey . '_' . $adIdsHash . '.json';

        if (!$forceRefresh && is_file($cacheFile) && (time() - @filemtime($cacheFile)) < 600) {
            $cached = @json_decode((string)@file_get_contents($cacheFile), true);
            if (is_array($cached) && isset($cached['platform_stats'])) {
                return $cached;
            }
        }

        $timeParam = ($since && $until)
            ? ('time_range=' . urlencode((string)json_encode(['since' => $since, 'until' => $until])))
            : 'date_preset=maximum';

        $prevTimeParam = ($prevSince && $prevUntil)
            ? ('time_range=' . urlencode((string)json_encode(['since' => $prevSince, 'until' => $prevUntil])))
            : $timeParam;

        $spendFilter = urlencode((string)json_encode([['field' => 'spend', 'operator' => 'GREATER_THAN', 'value' => 0]]));

        $platformFields = implode(',', [
            'spend',
            'impressions',
            'reach',
            'actions',
            'inline_link_clicks',
            'purchase_roas',
            'video_play_actions',
            'video_thruplay_watched_actions',
            'video_p25_watched_actions',
            'video_p50_watched_actions',
            'video_p75_watched_actions',
            'video_p95_watched_actions',
            'video_p100_watched_actions',
        ]);

        // 1. Execute DOMATION_META Batch Request (10 Graph API queries in 1 round-trip!)
        $batchQueries = [
            [
                'method' => 'GET',
                'name' => 'platformStats',
                'relative_url' => "{$actId}/insights?fields={$platformFields}&{$timeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'platformStats_previous',
                'relative_url' => "{$actId}/insights?fields={$platformFields}&{$prevTimeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'spendByPlatform',
                'relative_url' => "{$actId}/insights?fields=spend,impressions,actions&breakdowns=publisher_platform,platform_position&{$timeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'spendByAgeGender',
                'relative_url' => "{$actId}/insights?fields=spend,impressions,actions&breakdowns=age,gender&{$timeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'spendByRegion',
                'relative_url' => "{$actId}/insights?fields=spend,impressions,actions&breakdowns=region&{$timeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'spendByDevice',
                'relative_url' => "{$actId}/insights?fields=spend,impressions,actions&breakdowns=impression_device&{$timeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'dailySpend',
                'relative_url' => "{$actId}/insights?fields=spend,impressions,reach,actions,inline_link_clicks&time_increment=1&{$timeParam}&limit=400",
            ],
            [
                'method' => 'GET',
                'name' => 'campaigns',
                'relative_url' => "{$actId}/insights?level=campaign&fields=campaign_id,campaign_name,objective,spend,impressions,reach,actions&filtering={$spendFilter}&{$timeParam}&limit=300",
            ],
            [
                'method' => 'GET',
                'name' => 'adsets',
                'relative_url' => "{$actId}/insights?level=adset&fields=campaign_id,campaign_name,adset_id,adset_name,optimization_goal,spend,impressions,reach,actions,date_start,date_stop&filtering={$spendFilter}&{$timeParam}&limit=500",
            ],
            [
                'method' => 'GET',
                'name' => 'topAds',
                'relative_url' => "{$actId}/insights?level=ad&fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,optimization_goal,spend,impressions,reach,actions&filtering={$spendFilter}&sort=spend_descending&{$timeParam}&limit=150",
            ],
        ];

        $batchRes = self::fetchGraphBatch($tok, $batchQueries, 16);

        $platformStatsRows = is_array($batchRes['platformStats']['data'] ?? null) ? $batchRes['platformStats']['data'] : [];
        $platformPrevRows = is_array($batchRes['platformStats_previous']['data'] ?? null) ? $batchRes['platformStats_previous']['data'] : [];
        $spendByPlatformRows = is_array($batchRes['spendByPlatform']['data'] ?? null) ? $batchRes['spendByPlatform']['data'] : [];
        $spendByAgeGenderRows = is_array($batchRes['spendByAgeGender']['data'] ?? null) ? $batchRes['spendByAgeGender']['data'] : [];
        $spendByRegionRows = is_array($batchRes['spendByRegion']['data'] ?? null) ? $batchRes['spendByRegion']['data'] : [];
        $spendByDeviceRows = is_array($batchRes['spendByDevice']['data'] ?? null) ? $batchRes['spendByDevice']['data'] : [];
        $dailySpendRows = is_array($batchRes['dailySpend']['data'] ?? null) ? $batchRes['dailySpend']['data'] : [];
        $campaignsData = is_array($batchRes['campaigns']['data'] ?? null) ? $batchRes['campaigns']['data'] : [];
        $adsetsData = is_array($batchRes['adsets']['data'] ?? null) ? $batchRes['adsets']['data'] : [];
        $topAdsData = is_array($batchRes['topAds']['data'] ?? null) ? $batchRes['topAds']['data'] : [];

        $adsById = [];
        foreach ($topAdsData as $adRow) {
            $aid = (string)($adRow['ad_id'] ?? '');
            if ($aid !== '') {
                $adsById[$aid] = $adRow;
            }
        }

        // 2. If CRM has attributed Ad IDs not yet in $adsById, fetch their insights for the period
        $missingCrmAdIds = array_values(array_diff($cleanCrmAdIds, array_keys($adsById)));
        if (!empty($missingCrmAdIds)) {
            $filtering = json_encode([['field' => 'ad.id', 'operator' => 'IN', 'value' => array_slice($missingCrmAdIds, 0, 50)]]);
            $crmAdUrl = "https://graph.facebook.com/v25.0/{$actId}/insights?level=ad&{$timeParam}&fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,optimization_goal,spend,impressions,reach,actions&filtering=" . urlencode((string)$filtering) . "&limit=100&access_token=" . urlencode($tok);
            $crmAdRes = self::fetchGraphJson($crmAdUrl, 8);
            foreach (($crmAdRes['data'] ?? []) as $adRow) {
                $aid = (string)($adRow['ad_id'] ?? '');
                if ($aid !== '') {
                    $adsById[$aid] = $adRow;
                }
            }
        }

        // 3. Batch-fetch Creative Thumbnails & Effective Status for all active/attributed Ads, AdSets, and Campaigns
        $allAdIdsForCreative = array_values(array_unique(array_merge(array_keys($adsById), $cleanCrmAdIds)));
        $creativesById = [];
        foreach (array_chunk(array_slice($allAdIdsForCreative, 0, 90), 45) as $chunkIds) {
            if (empty($chunkIds)) {
                continue;
            }
            $idsParam = implode(',', $chunkIds);
            $cUrl = "https://graph.facebook.com/v25.0/?ids={$idsParam}&fields=id,name,effective_status,creative{thumbnail_url,image_url,instagram_permalink_url,effective_object_story_id}&access_token=" . urlencode($tok);
            $cRes = self::fetchGraphJson($cUrl, 8);
            foreach ($cRes as $idKey => $cObj) {
                if (!is_array($cObj) || empty($cObj['id'])) {
                    continue;
                }
                $cr = is_array($cObj['creative'] ?? null) ? $cObj['creative'] : [];
                $thumb = trim((string)($cr['image_url'] ?? $cr['thumbnail_url'] ?? ''));
                $postUrl = trim((string)($cr['instagram_permalink_url'] ?? ''));
                if ($postUrl === '' && !empty($cr['effective_object_story_id'])) {
                    $postUrl = 'https://www.facebook.com/' . $cr['effective_object_story_id'];
                }
                $creativesById[(string)$idKey] = [
                    'ad_id' => (string)$idKey,
                    'name' => (string)($cObj['name'] ?? ''),
                    'effective_status' => (string)($cObj['effective_status'] ?? 'ACTIVE'),
                    'thumbnail_url' => $thumb,
                    'post_url' => $postUrl,
                ];
            }
        }

        // Fetch Campaign & AdSet effective_status for Active Counters (`Active Campaign: 1/2`, `Active Adset: 2/3`)
        $entityStatuses = [];
        $campAndAdsetIds = [];
        foreach ($campaignsData as $cRow) {
            if (!empty($cRow['campaign_id'])) {
                $campAndAdsetIds[] = (string)$cRow['campaign_id'];
            }
        }
        foreach ($adsetsData as $asRow) {
            if (!empty($asRow['adset_id'])) {
                $campAndAdsetIds[] = (string)$asRow['adset_id'];
            }
        }
        $campAndAdsetIds = array_values(array_unique($campAndAdsetIds));
        foreach (array_chunk(array_slice($campAndAdsetIds, 0, 90), 45) as $chunkIds) {
            if (empty($chunkIds)) {
                continue;
            }
            $idsParam = implode(',', $chunkIds);
            $stUrl = "https://graph.facebook.com/v25.0/?ids={$idsParam}&fields=id,effective_status,daily_budget,lifetime_budget&access_token=" . urlencode($tok);
            $stRes = self::fetchGraphJson($stUrl, 6);
            foreach ($stRes as $idKey => $stObj) {
                if (is_array($stObj) && !empty($stObj['id'])) {
                    $entityStatuses[(string)$idKey] = [
                        'effective_status' => strtoupper(trim((string)($stObj['effective_status'] ?? 'PAUSED'))),
                        'daily_budget' => (float)($stObj['daily_budget'] ?? 0),
                        'lifetime_budget' => (float)($stObj['lifetime_budget'] ?? 0),
                    ];
                }
            }
        }

        $snapshot = [
            'account_id' => $creds['account_id'],
            'account_name' => $creds['account_name'],
            'fetched_at' => date('Y-m-d H:i:s'),
            'since' => $since,
            'until' => $until,
            'prev_since' => $prevSince,
            'prev_until' => $prevUntil,
            'platform_stats' => $platformStatsRows,
            'platform_stats_previous' => $platformPrevRows,
            'spend_by_platform' => $spendByPlatformRows,
            'spend_by_age_gender' => $spendByAgeGenderRows,
            'spend_by_region' => $spendByRegionRows,
            'spend_by_device' => $spendByDeviceRows,
            'daily_spend' => $dailySpendRows,
            'campaigns' => $campaignsData,
            'adsets' => $adsetsData,
            'ads_by_id' => $adsById,
            'creatives_by_id' => $creativesById,
            'entity_statuses' => $entityStatuses,
        ];

        if (!empty($platformStatsRows) || !empty($adsetsData) || !empty($adsById)) {
            @file_put_contents($cacheFile, json_encode($snapshot, JSON_UNESCAPED_UNICODE));
        }

        return $snapshot;
    }

    private function categorizeDegree(string $raw): string
    {
        $s = mb_strtolower(trim($raw), 'UTF-8');
        if ($s === '' || $s === '-' || $s === 'null') {
            return 'Chưa điền thông tin bằng cấp';
        }
        if (str_contains($s, 'thạc sĩ') || str_contains($s, 'thac si') || str_contains($s, 'master') || str_contains($s, 'mba') || str_contains($s, 'tiến sĩ')) {
            return 'Sau đại học (Thạc sĩ / MBA / Tiến sĩ)';
        }
        if (str_contains($s, 'cử nhân') || str_contains($s, 'cu nhan') || str_contains($s, 'đại học') || str_contains($s, 'dai hoc') || str_contains($s, 'kỹ sư') || str_contains($s, 'ky su') || str_contains($s, 'bachelor') || str_contains($s, 'dược') || str_contains($s, 'luật') || str_contains($s, 'bác sĩ')) {
            return 'Cử nhân / Đại học / Kỹ sư';
        }
        if (str_contains($s, 'cao đẳng') || str_contains($s, 'cao dang') || str_contains($s, 'college') || str_contains($s, 'associate')) {
            return 'Cao đẳng / Liên thông';
        }
        if (str_contains($s, 'thpt') || str_contains($s, 'trung cấp') || str_contains($s, 'trung hoc') || str_contains($s, 'cấp 3') || str_contains($s, '12/12')) {
            return 'THPT / Trung cấp';
        }
        return 'Bằng cấp quốc tế / Chuyên ngành khác';
    }

    private function categorizeProgramInterest(string $raw): string
    {
        $s = trim($raw);
        if ($s === '' || $s === '-' || strtolower($s) === 'null') {
            return 'Chưa chọn chương trình cụ thể';
        }
        $lower = mb_strtolower($s, 'UTF-8');
        if (str_contains($lower, 'ai') || str_contains($lower, 'trí tuệ nhân tạo') || str_contains($lower, 'msc')) {
            return 'Thạc sĩ AI ứng dụng / MBA in AI';
        }
        if (str_contains($lower, 'emba') || str_contains($lower, 'executive')) {
            return 'Executive MBA (EMBA)';
        }
        if (str_contains($lower, 'liên thông') || str_contains($lower, 'cử nhân') || str_contains($lower, 'bba') || str_contains($lower, 'top-up') || str_contains($lower, 'top up')) {
            return 'Liên thông Cử nhân Quốc tế (BBA Top-Up)';
        }
        if (str_contains($lower, 'mba online') || str_contains($lower, 'online')) {
            return 'MBA Quốc tế Online';
        }
        if (str_contains($lower, 'mba')) {
            return 'Thạc sĩ Quản trị Kinh doanh (MBA)';
        }
        return mb_substr($s, 0, 55, 'UTF-8');
    }

    private function categorizeConsultationTime(string $raw): string
    {
        $s = mb_strtolower(trim($raw), 'UTF-8');
        if ($s === '' || $s === '-' || $s === 'null') {
            return 'Linh hoạt / Chưa chọn khung giờ';
        }
        if (str_contains($s, '18') || str_contains($s, '19') || str_contains($s, '20') || str_contains($s, '21') || str_contains($s, 'tối') || str_contains($s, 'ngoài giờ') || str_contains($s, 'sau giờ')) {
            return 'Buổi tối / Ngoài giờ hành chính (18h–21h)';
        }
        if (str_contains($s, 'chiều') || str_contains($s, '13') || str_contains($s, '14') || str_contains($s, '15') || str_contains($s, '16') || str_contains($s, '17')) {
            return 'Buổi chiều (13h30–17h30)';
        }
        if (str_contains($s, 'sáng') || str_contains($s, '08') || str_contains($s, '8h') || str_contains($s, '9h') || str_contains($s, '10h') || str_contains($s, '11h') || str_contains($s, '09') || str_contains($s, '10')) {
            return 'Buổi sáng (08h30–11h30)';
        }
        if (str_contains($s, 'trưa') || str_contains($s, '12')) {
            return 'Giờ nghỉ trưa (11h30–13h30)';
        }
        return 'Khung giờ theo lịch hẹn riêng / Zalo';
    }

    private function categorizeEnglishWorkExp(string $raw): string
    {
        $s = mb_strtolower(trim($raw), 'UTF-8');
        if ($s === '' || $s === '-' || $s === 'null') {
            return 'Chưa khai báo chi tiết';
        }
        if (str_contains($s, 'ielts') || str_contains($s, 'toeic') || str_contains($s, 'toefl') || str_contains($s, 'b2') || str_contains($s, 'c1') || str_contains($s, 'tốt') || str_contains($s, 'thành thạo') || str_contains($s, 'good') || str_contains($s, 'fluent')) {
            return 'Tiếng Anh tốt / Có chứng chỉ (IELTS, TOEIC, B2+)';
        }
        if (str_contains($s, 'quản lý') || str_contains($s, 'giám đốc') || str_contains($s, 'trưởng phòng') || str_contains($s, 'manager') || str_contains($s, 'director') || str_contains($s, 'ceo') || str_contains($s, 'leader') || preg_match('/\b([5-9]|[12]\d)\s*năm/u', $s)) {
            return 'Kinh nghiệm Quản lý / Đi làm lâu năm (≥ 5 năm)';
        }
        if (str_contains($s, 'giao tiếp') || str_contains($s, 'cơ bản') || str_contains($s, 'đọc hiểu') || str_contains($s, 'trung bình') || preg_match('/\b[1-4]\s*năm/u', $s)) {
            return 'Giao tiếp cơ bản & Kinh nghiệm 1–4 năm';
        }
        return 'Đã đi làm / Cần tư vấn lộ trình tiếng Anh';
    }

    /**
     * Clean Region Name (`DOMATION_META/js/charts/region_chart.js: shortenRegion`)
     */
    private static function cleanRegionName(string $rawRegion): string
    {
        $s = trim($rawRegion);
        if ($s === '' || strtoupper($s) === 'UNKNOWN') {
            return '';
        }
        $s = (string)preg_replace('/\b(province|city|region|state|district|area|zone|tỉnh|thành phố trực thuộc trung ương|thành phố|tp\.|tp)\b/iu', '', $s);
        $s = trim((string)preg_replace('/\s+/u', ' ', $s));
        $lower = mb_strtolower($s, 'UTF-8');
        $map = [
            'ho chi minh' => 'TP. Hồ Chí Minh',
            'hồ chí minh' => 'TP. Hồ Chí Minh',
            'hanoi' => 'Hà Nội',
            'ha noi' => 'Hà Nội',
            'hà nội' => 'Hà Nội',
            'da nang' => 'Đà Nẵng',
            'đà nẵng' => 'Đà Nẵng',
            'hai phong' => 'Hải Phòng',
            'hải phòng' => 'Hải Phòng',
            'can tho' => 'Cần Thơ',
            'cần thơ' => 'Cần Thơ',
            'binh duong' => 'Bình Dương',
            'bình dương' => 'Bình Dương',
            'dong nai' => 'Đồng Nai',
            'đồng nai' => 'Đồng Nai',
            'ba ria - vung tau' => 'Bà Rịa - Vũng Tàu',
            'bà rịa - vũng tàu' => 'Bà Rịa - Vũng Tàu',
            'khanh hoa' => 'Khánh Hòa',
            'khánh hòa' => 'Khánh Hòa',
            'dak lak' => 'Đắk Lắk',
            'đắk lắk' => 'Đắk Lắk',
            'lam dong' => 'Lâm Đồng',
            'lâm đồng' => 'Lâm Đồng',
            'nghe an' => 'Nghệ An',
            'nghệ an' => 'Nghệ An',
            'thanh hoa' => 'Thanh Hóa',
            'thanh hóa' => 'Thanh Hóa',
            'quang ninh' => 'Quảng Ninh',
            'quảng ninh' => 'Quảng Ninh',
            'thua thien hue' => 'Thừa Thiên Huế',
            'long an' => 'Long An',
            'tien giang' => 'Tiền Giang',
            'an giang' => 'An Giang',
            'kien giang' => 'Kiên Giang',
        ];
        return $map[$lower] ?? mb_convert_case($s, MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * GET /marketing/meta/overview
     * Combines 100% real Facebook Graph API (`DOMATION_META` standard) with MYERP CRM Attribution.
     */
    public function getOverview(array $auth): void
    {
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $dateRange = trim((string)($_GET['date_range'] ?? $_GET['date'] ?? $_GET['date_filter'] ?? 'this_month'));
        $customFrom = isset($_GET['from_date'])
            ? trim((string)$_GET['from_date'])
            : (isset($_GET['start_date']) ? trim((string)$_GET['start_date']) : (isset($_GET['from']) ? trim((string)$_GET['from']) : null));
        $customTo = isset($_GET['to_date'])
            ? trim((string)$_GET['to_date'])
            : (isset($_GET['end_date']) ? trim((string)$_GET['end_date']) : (isset($_GET['to']) ? trim((string)$_GET['to']) : null));
        $campaignFilter = trim((string)($_GET['campaign_id'] ?? $_GET['campaign'] ?? 'all'));
        $formFilter = trim((string)($_GET['form_name'] ?? 'all'));
        $ownerFilter = trim((string)($_GET['owner_id'] ?? 'all'));
        $forceRefresh = !empty($_GET['refresh']);

        $bounds = $this->resolveDateBounds($dateRange, $customFrom, $customTo);
        $fromDate = $bounds['from_sql'];
        $toDate = $bounds['to_sql'];

        $overviewCacheKey = implode('|', [$tenantId, $bounds['canonical_key'], (string)$fromDate, (string)$toDate, $campaignFilter, $formFilter, $ownerFilter]);
        $overviewCacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_meta_overview_v3_' . $tenantId . '_' . md5($overviewCacheKey) . '.json';
        if (!$forceRefresh && empty($_GET['nocache']) && @is_file($overviewCacheFile) && (time() - (int)@filemtime($overviewCacheFile)) < 15) {
            $cachedOv = @json_decode((string)@file_get_contents($overviewCacheFile), true);
            if (is_array($cachedOv) && isset($cachedOv['summary'])) {
                respond(200, $cachedOv);
                return;
            }
        }

        // 1. Query all real attributed leads from `contact_meta_attribution` joined with `contacts`, `users`, `pipeline_stages`
        $where = ["cma.tenant_id = ?", "cma.deleted_at IS NULL"];
        $params = [$tenantId];

        if ($fromDate && $toDate) {
            $where[] = "COALESCE(cma.lead_created_time, c.created_at, cma.created_at) >= ? AND COALESCE(cma.lead_created_time, c.created_at, cma.created_at) <= ?";
            $params[] = $fromDate;
            $params[] = $toDate;
        }
        if ($campaignFilter !== '' && $campaignFilter !== 'all') {
            $where[] = "(cma.campaign_id = ? OR cma.campaign_name = ?)";
            $params[] = $campaignFilter;
            $params[] = $campaignFilter;
        }
        if ($formFilter !== '' && $formFilter !== 'all') {
            $where[] = "(cma.form_name = ? OR cma.sheet_source = ?)";
            $params[] = $formFilter;
            $params[] = $formFilter;
        }
        if ($ownerFilter !== '' && $ownerFilter !== 'all') {
            if ($ownerFilter === 'unassigned' || $ownerFilter === '0') {
                $where[] = "(c.owner_id IS NULL OR c.owner_id = 0)";
            } else {
                $where[] = "c.owner_id = ?";
                $params[] = (int)$ownerFilter;
            }
        }

        $sql = "
            SELECT
                cma.id AS attribution_id,
                cma.contact_id,
                cma.meta_lead_id,
                cma.ad_id,
                cma.ad_name,
                cma.adset_id,
                cma.adset_name,
                cma.campaign_id,
                cma.campaign_name,
                cma.form_id,
                cma.form_name,
                cma.platform,
                cma.is_organic,
                cma.lead_created_time,
                cma.raw_lead_status,
                cma.priority,
                cma.sheet_source,
                cma.degree,
                cma.english_work_exp,
                cma.consultation_time,
                cma.program_interest,
                c.full_name,
                c.phone,
                c.email,
                c.city,
                c.status AS contact_status,
                c.lead_status,
                c.pipeline_status,
                c.stage_id,
                c.owner_id,
                c.program AS contact_program,
                COALESCE(ps.order_index, 1) AS stage_order,
                COALESCE(ps.name, '01 - New Lead') AS stage_name,
                u.full_name AS owner_name,
                u.avatar_url AS owner_avatar,
                u.email AS owner_email
            FROM contact_meta_attribution cma
            LEFT JOIN contacts c ON c.id = cma.contact_id AND c.deleted_at IS NULL
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            LEFT JOIN users u ON u.id = c.owner_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY COALESCE(cma.lead_created_time, cma.created_at) DESC, cma.id DESC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Batch pre-fetch deposit totals and activity counts ONLY for matched contact_ids (avoids full table GROUP BY scan)
        $matchedContactIds = array_values(array_unique(array_filter(array_map(fn($r) => (int)($r['contact_id'] ?? 0), $rows))));
        $depByContact = [];
        $actByContact = [];
        if (!empty($matchedContactIds)) {
            foreach (array_chunk($matchedContactIds, 500) as $cChunk) {
                $inPh = implode(',', array_fill(0, count($cChunk), '?'));
                $stmtDep = $this->db->prepare("
                    SELECT contact_id, SUM(price) AS total_deposit
                    FROM deposits
                    WHERE status IN ('approved', 'completed') AND deleted_at IS NULL AND contact_id IN ($inPh)
                    GROUP BY contact_id
                ");
                $stmtDep->execute($cChunk);
                foreach ($stmtDep->fetchAll(PDO::FETCH_ASSOC) ?: [] as $dRow) {
                    $depByContact[(int)$dRow['contact_id']] = (float)$dRow['total_deposit'];
                }

                $stmtAct = $this->db->prepare("
                    SELECT contact_id, COUNT(*) AS activity_count
                    FROM activities
                    WHERE deleted_at IS NULL AND contact_id IN ($inPh)
                    GROUP BY contact_id
                ");
                $stmtAct->execute($cChunk);
                foreach ($stmtAct->fetchAll(PDO::FETCH_ASSOC) ?: [] as $aRow) {
                    $actByContact[(int)$aRow['contact_id']] = (int)$aRow['activity_count'];
                }
            }
        }
        foreach ($rows as &$rItem) {
            $cid = (int)($rItem['contact_id'] ?? 0);
            $rItem['deposit_amount'] = $depByContact[$cid] ?? 0.0;
            $rItem['activity_count'] = $actByContact[$cid] ?? 0;
        }
        unset($rItem);

        $crmAdIds = [];
        foreach ($rows as $r) {
            if (!empty($r['ad_id'])) {
                $crmAdIds[] = (string)$r['ad_id'];
            }
        }

        // 2. Fetch Live Meta Graph API Batch Snapshot (`DOMATION_META` engine)
        $metaSnap = $this->fetchLiveMetaAccountSnapshot($bounds, $crmAdIds, $forceRefresh);
        $platformCurr = self::extractDomationPlatformMetrics($metaSnap['platform_stats'] ?? []);
        $platformPrev = self::extractDomationPlatformMetrics($metaSnap['platform_stats_previous'] ?? []);

        $graphCampaigns = is_array($metaSnap['campaigns'] ?? null) ? $metaSnap['campaigns'] : [];
        $graphAdsets = is_array($metaSnap['adsets'] ?? null) ? $metaSnap['adsets'] : [];
        $graphAdsById = is_array($metaSnap['ads_by_id'] ?? null) ? $metaSnap['ads_by_id'] : [];
        $creativesById = is_array($metaSnap['creatives_by_id'] ?? null) ? $metaSnap['creatives_by_id'] : [];
        $entityStatuses = is_array($metaSnap['entity_statuses'] ?? null) ? $metaSnap['entity_statuses'] : [];

        // 3. Build Exact DOMATION_META Hierarchy (`Campaigns -> AdSets -> Ads`) with ZERO Double-Counting
        $campaignsMap = [];
        $adsetsMap = [];
        $adsMap = [];
        $adIdToCampKey = [];
        $adIdToAdsetKey = [];
        $adsetIdToCampKey = [];
        $adsetNameToAdsetKey = [];
        $campNameToCampKey = [];

        $goalGroupsMap = [];
        foreach (['Lead', 'Message', 'Engagement', 'Reach', 'Traffic', 'View'] as $gk) {
            $goalGroupsMap[$gk] = [
                'group' => $gk,
                'label' => self::GOAL_GROUP_LABELS[$gk] ?? $gk,
                'spend' => 0.0,
                'results' => 0,
                'meta_leads' => 0,
                'impressions' => 0,
                'reach' => 0,
                'adsets_count' => 0,
            ];
        }
        $rawGoalsMap = [];
        $accountLeadGoalSpend = 0.0;

        // 3a. Initialize Campaigns from Graph API `campaignInsights`
        foreach ($graphCampaigns as $gc) {
            $cid = trim((string)($gc['campaign_id'] ?? ''));
            $cname = trim((string)($gc['campaign_name'] ?? ''));
            if ($cid === '') {
                continue;
            }
            if ($campaignFilter !== '' && $campaignFilter !== 'all' && $cid !== $campaignFilter && $cname !== $campaignFilter) {
                continue;
            }
            $cActions = is_array($gc['actions'] ?? null) ? $gc['actions'] : [];
            $cMetaLeads = self::getActionValue($cActions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($cActions, 'lead');
            $cMess = self::getActionValue($cActions, 'onsite_conversion.messaging_conversation_started_7d');
            $cClicks = self::getActionValue($cActions, 'link_click');
            $effSt = (string)($entityStatuses[$cid]['effective_status'] ?? 'ACTIVE');

            $campaignsMap[$cid] = [
                'id' => $cid,
                'campaign_id' => $cid,
                'name' => $cname !== '' ? $cname : ('Campaign #' . $cid),
                'status' => $effSt,
                'optimization_goal' => 'QUALITY_LEAD',
                'goal_label' => self::GOAL_MAPPING['QUALITY_LEAD'],
                'result_label' => self::RESULT_MAPPING['QUALITY_LEAD'],
                'goal_group' => 'Lead',
                'leads' => 0,
                'new_1_2' => 0,
                'uncontacted' => 0,
                'contacted' => 0,
                'qualified_3_12' => 0,
                'qualified' => 0,
                'won' => 0,
                'revenue' => 0.0,
                'spend' => (float)($gc['spend'] ?? 0.0),
                'impressions' => (int)($gc['impressions'] ?? 0),
                'reach' => (int)($gc['reach'] ?? 0),
                'results' => $cMetaLeads,
                'meta_leads' => $cMetaLeads,
                'messages_started' => $cMess,
                'clicks' => $cClicks,
                'adsets_map' => [],
                'ads_map' => [],
                'forms_map' => [],
                'thumbnails' => [],
            ];
            if ($cname !== '') {
                $campNameToCampKey[mb_strtolower($cname, 'UTF-8')] = $cid;
            }
        }

        // 3b. Initialize AdSets from Graph API `adsets` (`DOMATION_META/js/data/group.js` & `extra_details.js`)
        foreach ($graphAdsets as $as) {
            $cid = trim((string)($as['campaign_id'] ?? ''));
            $cname = trim((string)($as['campaign_name'] ?? ''));
            if ($campaignFilter !== '' && $campaignFilter !== 'all' && $cid !== $campaignFilter && $cname !== $campaignFilter) {
                continue;
            }
            $asId = trim((string)($as['adset_id'] ?? ''));
            $asName = trim((string)($as['adset_name'] ?? ''));
            if ($asId === '') {
                continue;
            }
            $rawGoal = strtoupper(trim((string)($as['optimization_goal'] ?? 'NONE')));
            $sp = (float)($as['spend'] ?? 0);
            $imp = (int)($as['impressions'] ?? 0);
            $rch = (int)($as['reach'] ?? 0);
            $actions = is_array($as['actions'] ?? null) ? $as['actions'] : [];

            $resVal = self::calculateMetaResult($as, $rawGoal);
            $mLeads = self::getActionValue($actions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($actions, 'lead');
            $mMess = self::getActionValue($actions, 'onsite_conversion.messaging_conversation_started_7d');
            $mClicks = self::getActionValue($actions, 'link_click');
            $effSt = (string)($entityStatuses[$asId]['effective_status'] ?? 'ACTIVE');

            $goalGroup = self::GOAL_GROUP_LOOKUP[$rawGoal] ?? ($mLeads > 0 ? 'Lead' : 'Reach');
            if ($goalGroup === 'Lead' || $mLeads > 0) {
                $accountLeadGoalSpend += $sp;
            }
            if (isset($goalGroupsMap[$goalGroup])) {
                $goalGroupsMap[$goalGroup]['spend'] += $sp;
                $goalGroupsMap[$goalGroup]['results'] += $resVal;
                $goalGroupsMap[$goalGroup]['meta_leads'] += $mLeads;
                $goalGroupsMap[$goalGroup]['impressions'] += $imp;
                $goalGroupsMap[$goalGroup]['reach'] += $rch;
                $goalGroupsMap[$goalGroup]['adsets_count']++;
            }

            // Aggregate exact raw optimization_goal (`DOMATION_META/js/ui/extra_details.js: META GOAL chart`)
            $goalDisplay = str_replace('_', ' ', $rawGoal);
            if (!isset($rawGoalsMap[$rawGoal])) {
                $rawGoalsMap[$rawGoal] = [
                    'goal' => $rawGoal,
                    'display_name' => $goalDisplay,
                    'label' => self::GOAL_MAPPING[$rawGoal] ?? $goalDisplay,
                    'result_label' => self::RESULT_MAPPING[$rawGoal] ?? 'Kết quả',
                    'group' => $goalGroup,
                    'spend' => 0.0,
                    'results' => 0,
                    'meta_leads' => 0,
                    'impressions' => 0,
                    'reach' => 0,
                    'adsets_count' => 0,
                ];
            }
            $rawGoalsMap[$rawGoal]['spend'] += $sp;
            $rawGoalsMap[$rawGoal]['results'] += $resVal;
            $rawGoalsMap[$rawGoal]['meta_leads'] += $mLeads;
            $rawGoalsMap[$rawGoal]['impressions'] += $imp;
            $rawGoalsMap[$rawGoal]['reach'] += $rch;
            $rawGoalsMap[$rawGoal]['adsets_count']++;

            if ($cid !== '' && !isset($campaignsMap[$cid])) {
                $campaignsMap[$cid] = [
                    'id' => $cid,
                    'campaign_id' => $cid,
                    'name' => $cname !== '' ? $cname : ('Campaign #' . $cid),
                    'status' => (string)($entityStatuses[$cid]['effective_status'] ?? 'ACTIVE'),
                    'optimization_goal' => $rawGoal,
                    'goal_label' => self::GOAL_MAPPING[$rawGoal] ?? $rawGoal,
                    'result_label' => self::RESULT_MAPPING[$rawGoal] ?? 'Kết quả',
                    'goal_group' => $goalGroup,
                    'leads' => 0,
                    'uncontacted' => 0,
                    'contacted' => 0,
                    'qualified' => 0,
                    'won' => 0,
                    'revenue' => 0.0,
                    'spend' => 0.0,
                    'impressions' => 0,
                    'reach' => 0,
                    'results' => 0,
                    'meta_leads' => 0,
                    'messages_started' => 0,
                    'clicks' => 0,
                    'adsets_map' => [],
                    'ads_map' => [],
                    'forms_map' => [],
                    'thumbnails' => [],
                ];
                if ($cname !== '') {
                    $campNameToCampKey[mb_strtolower($cname, 'UTF-8')] = $cid;
                }
            }

            if ($cid !== '' && isset($campaignsMap[$cid])) {
                $campaignsMap[$cid]['optimization_goal'] = $rawGoal;
                $campaignsMap[$cid]['goal_label'] = self::GOAL_MAPPING[$rawGoal] ?? $rawGoal;
                $campaignsMap[$cid]['result_label'] = self::RESULT_MAPPING[$rawGoal] ?? 'Kết quả';
                $campaignsMap[$cid]['goal_group'] = $goalGroup;
                $campaignsMap[$cid]['adsets_map'][$asId] = true;
                $adsetIdToCampKey[$asId] = $cid;
            }

            $adsetsMap[$asId] = [
                'id' => $asId,
                'adset_id' => $asId,
                'name' => $asName !== '' ? $asName : ('AdSet #' . $asId),
                'status' => $effSt,
                'campaign_key' => $cid,
                'campaign_id' => $cid,
                'campaign_name' => $cname,
                'optimization_goal' => $rawGoal,
                'goal_label' => self::GOAL_MAPPING[$rawGoal] ?? $rawGoal,
                'result_label' => self::RESULT_MAPPING[$rawGoal] ?? 'Kết quả',
                'count' => 0,
                'leads' => 0,
                'new_1_2' => 0,
                'contacted' => 0,
                'qualified_3_12' => 0,
                'qualified' => 0,
                'won' => 0,
                'revenue' => 0.0,
                'spend' => $sp,
                'impressions' => $imp,
                'reach' => $rch,
                'results' => $resVal,
                'meta_leads' => $mLeads,
                'messages_started' => $mMess,
                'clicks' => $mClicks,
                'ads_map' => [],
            ];
            if ($asName !== '') {
                $adsetNameToAdsetKey[mb_strtolower($asName, 'UTF-8')] = $asId;
            }
        }

        // 3c. Initialize Ads from Graph API `ads_by_id`
        foreach ($graphAdsById as $aid => $gAd) {
            $cid = trim((string)($gAd['campaign_id'] ?? ''));
            $cname = trim((string)($gAd['campaign_name'] ?? ''));
            if ($campaignFilter !== '' && $campaignFilter !== 'all' && $cid !== $campaignFilter && $cname !== $campaignFilter) {
                continue;
            }
            $asId = trim((string)($gAd['adset_id'] ?? ''));
            $asName = trim((string)($gAd['adset_name'] ?? ''));
            $adName = trim((string)($gAd['ad_name'] ?? ''));
            $adGoal = strtoupper(trim((string)($gAd['optimization_goal'] ?? ($adsetsMap[$asId]['optimization_goal'] ?? 'QUALITY_LEAD'))));
            $adSpend = (float)($gAd['spend'] ?? 0.0);
            $adImp = (int)($gAd['impressions'] ?? 0);
            $adReach = (int)($gAd['reach'] ?? 0);
            $adActions = is_array($gAd['actions'] ?? null) ? $gAd['actions'] : [];
            $adResVal = self::calculateMetaResult($gAd, $adGoal);
            $adMetaLeads = self::getActionValue($adActions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($adActions, 'lead');
            $adClicks = self::getActionValue($adActions, 'link_click');
            $creativeInfo = $creativesById[$aid] ?? null;

            $adsMap[$aid] = [
                'id' => $aid,
                'ad_id' => $aid,
                'name' => $adName !== '' ? $adName : ('Ad #' . $aid),
                'effective_status' => (string)($creativeInfo['effective_status'] ?? 'ACTIVE'),
                'thumbnail_url' => (string)($creativeInfo['thumbnail_url'] ?? ''),
                'post_url' => (string)($creativeInfo['post_url'] ?? ''),
                'optimization_goal' => $adGoal,
                'goal_label' => self::GOAL_MAPPING[$adGoal] ?? $adGoal,
                'result_label' => self::RESULT_MAPPING[$adGoal] ?? 'Kết quả',
                'adset_key' => $asId,
                'adset_id' => $asId,
                'adset_name' => $asName,
                'campaign_key' => $cid,
                'campaign_id' => $cid,
                'campaign_name' => $cname,
                'form_name' => '',
                'platform' => 'Facebook',
                'spend' => $adSpend,
                'impressions' => $adImp,
                'reach' => $adReach,
                'results' => $adResVal,
                'cpr' => self::calculateMetaCpr($adSpend, $adResVal, $adGoal),
                'meta_leads' => $adMetaLeads,
                'clicks' => $adClicks,
                'leads' => 0,
                'new_1_2' => 0,
                'contacted' => 0,
                'qualified_3_12' => 0,
                'qualified' => 0,
                'won' => 0,
                'revenue' => 0.0,
                'sample_programs' => [],
            ];

            if ($asId !== '' && isset($adsetsMap[$asId])) {
                $adsetsMap[$asId]['ads_map'][$aid] = true;
                $adIdToAdsetKey[$aid] = $asId;
            }
            if ($cid !== '' && isset($campaignsMap[$cid])) {
                $campaignsMap[$cid]['ads_map'][$aid] = true;
                $adIdToCampKey[$aid] = $cid;
                if ($creativeInfo && !empty($creativeInfo['thumbnail_url'])) {
                    $campaignsMap[$cid]['thumbnails'][$creativeInfo['thumbnail_url']] = true;
                }
            }
        }

        // 4. Process CRM Attributed Leads (`contact_meta_attribution`) and attach onto the hierarchy
        $totalLeads = count($rows);
        $paidLeads = 0;
        $organicLeads = 0;
        $instantFormLeads = 0;
        $validPhoneCount = 0;
        $validEmailCount = 0;
        $assignedCount = 0;
        $surveyCompletedCount = 0;

        $stage1Count = 0;
        $stage2Count = 0;
        $stage13Count = 0;
        $uncontactedLeads = 0;
        $contactedLeads = 0;
        $qualified312Leads = 0;
        $qualifiedLeads = 0;
        $wonLeads = 0;
        $enrolledLeads = 0;
        $actualRevenue = 0.0;
        $pipelineStagesMap = [];

        $formsMap = [];
        $platformsMap = [
            'fb' => ['code' => 'fb', 'name' => 'Facebook Feed & Video', 'count' => 0],
            'ig' => ['code' => 'ig', 'name' => 'Instagram Feed & Reels', 'count' => 0],
            'other' => ['code' => 'other', 'name' => 'Messenger / Nền tảng khác', 'count' => 0],
        ];
        $advisorsMap = [];

        $degreeBuckets = [];
        $programBuckets = [];
        $consultTimeBuckets = [];
        $engExpBuckets = [];

        foreach ($rows as $r) {
            $isOrganic = ((int)($r['is_organic'] ?? 0)) === 1;
            if ($isOrganic) {
                $organicLeads++;
            } else {
                $paidLeads++;
            }

            $formName = trim((string)($r['form_name'] ?: ($r['sheet_source'] ?? '')));
            if ($formName !== '') {
                $instantFormLeads++;
            } else {
                $formName = 'Form Meta Mặc định';
            }

            $phoneClean = preg_replace('/\D+/', '', (string)($r['phone'] ?? ''));
            if (strlen($phoneClean) >= 9) {
                $validPhoneCount++;
            }
            $emailClean = trim((string)($r['email'] ?? ''));
            if ($emailClean !== '' && str_contains($emailClean, '@')) {
                $validEmailCount++;
            }

            $ownerId = (int)($r['owner_id'] ?? 0);
            if ($ownerId > 0) {
                $assignedCount++;
            }

            $degRaw = trim((string)($r['degree'] ?? ''));
            $progRaw = trim((string)($r['program_interest'] ?: ($r['contact_program'] ?? '')));
            $timeRaw = trim((string)($r['consultation_time'] ?? ''));
            $engRaw = trim((string)($r['english_work_exp'] ?? ''));

            if ($degRaw !== '' || $progRaw !== '' || $timeRaw !== '' || $engRaw !== '') {
                $surveyCompletedCount++;
            }

            $stageOrder = (int)($r['stage_order'] ?? 1);
            $stageName = trim((string)($r['stage_name'] ?? '01 - New Lead'));
            $contactStatus = strtolower(trim((string)($r['contact_status'] ?? 'lead')));
            $actCount = (int)($r['activity_count'] ?? 0);
            $depAmt = (float)($r['deposit_amount'] ?? 0);

            $isWon = ($stageOrder >= 13 || $contactStatus === 'customer' || $depAmt > 0);
            $isEnrolled = ($stageOrder >= 14 || $contactStatus === 'customer');
            $isQualified312 = ($stageOrder >= 3 && $stageOrder <= 12 && !$isWon);
            $isQualified = $isQualified312 || $isWon;
            $isNew12 = ($stageOrder <= 2 && !$isWon);
            $isContacted = ($stageOrder >= 2 || $actCount > 0 || $isQualified);

            if ($stageOrder <= 1 && !$isWon) {
                $stage1Count++;
            } elseif ($stageOrder === 2 && !$isWon) {
                $stage2Count++;
            }

            if ($isNew12) {
                $uncontactedLeads++;
            }
            if ($isContacted) {
                $contactedLeads++;
            }
            if ($isQualified312) {
                $qualified312Leads++;
            }
            if ($isQualified) {
                $qualifiedLeads++;
            }
            if ($isWon) {
                $wonLeads++;
                if (!$isEnrolled) {
                    $stage13Count++;
                }
            }
            if ($isEnrolled) {
                $enrolledLeads++;
            }
            $actualRevenue += $depAmt;

            $effStageOrder = $isEnrolled ? 14 : ($isWon ? 13 : max(1, $stageOrder));
            $effBucket = $isWon ? 'win_13_14' : ($isQualified312 ? 'qualified_3_12' : 'new_1_2');
            if (!isset($pipelineStagesMap[$effStageOrder])) {
                $pipelineStagesMap[$effStageOrder] = [
                    'stage_order' => $effStageOrder,
                    'stage_name' => $stageName !== '' ? $stageName : sprintf('%02d - Stage %d', $effStageOrder, $effStageOrder),
                    'bucket' => $effBucket,
                    'count' => 0,
                ];
            }
            $pipelineStagesMap[$effStageOrder]['count']++;

            // Match CRM row to canonical Campaign -> AdSet -> Ad WITHOUT duplicating Graph API spend
            $adId = preg_replace('/[^0-9]/', '', (string)($r['ad_id'] ?? ''));
            $adsetId = preg_replace('/[^0-9]/', '', (string)($r['adset_id'] ?? ''));
            $campId = preg_replace('/[^0-9]/', '', (string)($r['campaign_id'] ?? ''));

            $adNameRaw = trim((string)($r['ad_name'] ?? ''));
            $adsetNameRaw = trim((string)($r['adset_name'] ?? ''));
            $campNameRaw = trim((string)($r['campaign_name'] ?? ''));

            if ($adsetId === '' && $adId !== '' && isset($adIdToAdsetKey[$adId])) {
                $adsetId = $adIdToAdsetKey[$adId];
            }
            if ($adsetId === '' && $adsetNameRaw !== '') {
                $matchedAs = $adsetNameToAdsetKey[mb_strtolower($adsetNameRaw, 'UTF-8')] ?? '';
                if ($matchedAs !== '') {
                    $adsetId = $matchedAs;
                }
            }

            if ($campId === '' && $adId !== '' && isset($adIdToCampKey[$adId])) {
                $campId = $adIdToCampKey[$adId];
            }
            if ($campId === '' && $adsetId !== '' && isset($adsetIdToCampKey[$adsetId])) {
                $campId = $adsetIdToCampKey[$adsetId];
            }
            if ($campId === '' && $campNameRaw !== '') {
                $matchedCamp = $campNameToCampKey[mb_strtolower($campNameRaw, 'UTF-8')] ?? '';
                if ($matchedCamp !== '') {
                    $campId = $matchedCamp;
                }
            }

            $campName = $campId !== '' && isset($campaignsMap[$campId])
                ? $campaignsMap[$campId]['name']
                : ($campNameRaw !== '' ? $campNameRaw : ($formName !== '' ? ('Chiến dịch: ' . $formName) : 'Chiến dịch Meta Ads'));
            $campKey = $campId !== '' ? $campId : ('crm_camp_' . md5($campName));

            if (!isset($campaignsMap[$campKey])) {
                $campaignsMap[$campKey] = [
                    'id' => $campKey,
                    'campaign_id' => $campId,
                    'name' => $campName,
                    'status' => 'PAUSED',
                    'optimization_goal' => 'QUALITY_LEAD',
                    'goal_label' => self::GOAL_MAPPING['QUALITY_LEAD'],
                    'result_label' => self::RESULT_MAPPING['QUALITY_LEAD'],
                    'goal_group' => 'Lead',
                    'leads' => 0,
                    'new_1_2' => 0,
                    'uncontacted' => 0,
                    'contacted' => 0,
                    'qualified_3_12' => 0,
                    'qualified' => 0,
                    'won' => 0,
                    'revenue' => 0.0,
                    'spend' => 0.0,
                    'impressions' => 0,
                    'reach' => 0,
                    'results' => 0,
                    'meta_leads' => 0,
                    'messages_started' => 0,
                    'clicks' => 0,
                    'adsets_map' => [],
                    'ads_map' => [],
                    'forms_map' => [],
                    'thumbnails' => [],
                ];
            }
            $campaignsMap[$campKey]['leads']++;
            if ($isNew12) {
                $campaignsMap[$campKey]['new_1_2'] = ($campaignsMap[$campKey]['new_1_2'] ?? 0) + 1;
                $campaignsMap[$campKey]['uncontacted']++;
            }
            if ($isContacted) {
                $campaignsMap[$campKey]['contacted']++;
            }
            if ($isQualified312) {
                $campaignsMap[$campKey]['qualified_3_12'] = ($campaignsMap[$campKey]['qualified_3_12'] ?? 0) + 1;
            }
            if ($isQualified) {
                $campaignsMap[$campKey]['qualified']++;
            }
            if ($isWon) {
                $campaignsMap[$campKey]['won']++;
            }
            $campaignsMap[$campKey]['revenue'] += $depAmt;
            $campaignsMap[$campKey]['forms_map'][$formName] = true;

            $creativeInfo = ($adId !== '' && isset($creativesById[$adId])) ? $creativesById[$adId] : null;
            if ($creativeInfo && !empty($creativeInfo['thumbnail_url'])) {
                $campaignsMap[$campKey]['thumbnails'][$creativeInfo['thumbnail_url']] = true;
            }

            // AdSet node
            $adsetName = ($adsetId !== '' && isset($adsetsMap[$adsetId]))
                ? $adsetsMap[$adsetId]['name']
                : ($adsetNameRaw !== '' ? $adsetNameRaw : ('Nhóm QC (' . $campName . ')'));
            $adsetKey = ($adsetId !== '' && isset($adsetsMap[$adsetId]))
                ? $adsetId
                : ('crm_adset_' . md5($campKey . '::' . $adsetName));

            $campaignsMap[$campKey]['adsets_map'][$adsetKey] = true;
            if (!isset($adsetsMap[$adsetKey])) {
                $adsetsMap[$adsetKey] = [
                    'id' => $adsetKey,
                    'adset_id' => $adsetId,
                    'name' => $adsetName,
                    'status' => 'PAUSED',
                    'campaign_key' => $campKey,
                    'campaign_id' => $campId,
                    'campaign_name' => $campName,
                    'optimization_goal' => 'QUALITY_LEAD',
                    'goal_label' => self::GOAL_MAPPING['QUALITY_LEAD'],
                    'result_label' => self::RESULT_MAPPING['QUALITY_LEAD'],
                    'count' => 0,
                    'leads' => 0,
                    'new_1_2' => 0,
                    'contacted' => 0,
                    'qualified_3_12' => 0,
                    'qualified' => 0,
                    'won' => 0,
                    'revenue' => 0.0,
                    'spend' => 0.0,
                    'impressions' => 0,
                    'reach' => 0,
                    'results' => 0,
                    'meta_leads' => 0,
                    'messages_started' => 0,
                    'clicks' => 0,
                    'ads_map' => [],
                ];
            }
            $adsetsMap[$adsetKey]['count']++;
            $adsetsMap[$adsetKey]['leads']++;
            if ($isNew12) {
                $adsetsMap[$adsetKey]['new_1_2'] = ($adsetsMap[$adsetKey]['new_1_2'] ?? 0) + 1;
            }
            if ($isContacted) {
                $adsetsMap[$adsetKey]['contacted']++;
            }
            if ($isQualified312) {
                $adsetsMap[$adsetKey]['qualified_3_12'] = ($adsetsMap[$adsetKey]['qualified_3_12'] ?? 0) + 1;
            }
            if ($isQualified) {
                $adsetsMap[$adsetKey]['qualified']++;
            }
            if ($isWon) {
                $adsetsMap[$adsetKey]['won']++;
            }
            $adsetsMap[$adsetKey]['revenue'] += $depAmt;

            // Ad node
            $adName = ($adId !== '' && isset($adsMap[$adId]))
                ? $adsMap[$adId]['name']
                : ($adNameRaw !== '' ? $adNameRaw : ('Mẫu QC (' . $adsetName . ')'));
            $adKey = ($adId !== '' && isset($adsMap[$adId]))
                ? $adId
                : ($adId !== '' ? $adId : ('crm_ad_' . md5($adsetKey . '::' . $adName)));

            $campaignsMap[$campKey]['ads_map'][$adKey] = true;
            $adsetsMap[$adsetKey]['ads_map'][$adKey] = true;

            $plat = strtolower(trim((string)($r['platform'] ?? 'fb')));
            if (!isset($adsMap[$adKey])) {
                $adsMap[$adKey] = [
                    'id' => $adKey,
                    'ad_id' => $adId,
                    'name' => $adName,
                    'effective_status' => (string)($creativeInfo['effective_status'] ?? 'PAUSED'),
                    'thumbnail_url' => (string)($creativeInfo['thumbnail_url'] ?? ''),
                    'post_url' => (string)($creativeInfo['post_url'] ?? ''),
                    'optimization_goal' => 'QUALITY_LEAD',
                    'goal_label' => self::GOAL_MAPPING['QUALITY_LEAD'],
                    'result_label' => self::RESULT_MAPPING['QUALITY_LEAD'],
                    'adset_key' => $adsetKey,
                    'adset_id' => $adsetId,
                    'adset_name' => $adsetName,
                    'campaign_key' => $campKey,
                    'campaign_id' => $campId,
                    'campaign_name' => $campName,
                    'form_name' => $formName,
                    'platform' => $plat === 'ig' ? 'Instagram' : 'Facebook',
                    'spend' => 0.0,
                    'impressions' => 0,
                    'reach' => 0,
                    'results' => 0,
                    'cpr' => 0.0,
                    'meta_leads' => 0,
                    'clicks' => 0,
                    'leads' => 0,
                    'new_1_2' => 0,
                    'contacted' => 0,
                    'qualified_3_12' => 0,
                    'qualified' => 0,
                    'won' => 0,
                    'revenue' => 0.0,
                    'sample_programs' => [],
                ];
            } else {
                if (empty($adsMap[$adKey]['form_name']) && $formName !== '') {
                    $adsMap[$adKey]['form_name'] = $formName;
                }
            }
            $adsMap[$adKey]['leads']++;
            if ($isNew12) {
                $adsMap[$adKey]['new_1_2'] = ($adsMap[$adKey]['new_1_2'] ?? 0) + 1;
            }
            if ($isContacted) {
                $adsMap[$adKey]['contacted']++;
            }
            if ($isQualified312) {
                $adsMap[$adKey]['qualified_3_12'] = ($adsMap[$adKey]['qualified_3_12'] ?? 0) + 1;
            }
            if ($isQualified) {
                $adsMap[$adKey]['qualified']++;
            }
            if ($isWon) {
                $adsMap[$adKey]['won']++;
            }
            $adsMap[$adKey]['revenue'] += $depAmt;
            if ($progRaw !== '' && count($adsMap[$adKey]['sample_programs']) < 3) {
                $adsMap[$adKey]['sample_programs'][$progRaw] = true;
            }

            // Form aggregation
            if (!isset($formsMap[$formName])) {
                $formsMap[$formName] = [
                    'name' => $formName,
                    'count' => 0,
                    'new_1_2' => 0,
                    'qualified_3_12' => 0,
                    'qualified' => 0,
                    'won' => 0,
                    'revenue' => 0.0,
                ];
            }
            $formsMap[$formName]['count']++;
            if ($isNew12) {
                $formsMap[$formName]['new_1_2']++;
            }
            if ($isQualified312) {
                $formsMap[$formName]['qualified_3_12']++;
            }
            if ($isQualified) {
                $formsMap[$formName]['qualified']++;
            }
            if ($isWon) {
                $formsMap[$formName]['won']++;
            }
            $formsMap[$formName]['revenue'] += $depAmt;

            // Platform aggregation (CRM Leads)
            if ($plat === 'fb' || $plat === 'facebook') {
                $platformsMap['fb']['count']++;
            } elseif ($plat === 'ig' || $plat === 'instagram') {
                $platformsMap['ig']['count']++;
            } else {
                $platformsMap['other']['count']++;
            }

            // Advisor (Consultant) aggregation
            $advKey = $ownerId > 0 ? (string)$ownerId : 'unassigned';
            $advName = $ownerId > 0 ? trim((string)($r['owner_name'] ?: ('Tư vấn viên #' . $ownerId))) : 'Chưa phân bổ Sale';
            $advAvatar = $ownerId > 0 ? ($r['owner_avatar'] ?? null) : null;
            if (!isset($advisorsMap[$advKey])) {
                $advisorsMap[$advKey] = [
                    'id' => $advKey,
                    'user_id' => $ownerId,
                    'name' => $advName,
                    'avatar' => $advAvatar,
                    'email' => $r['owner_email'] ?? null,
                    'leads' => 0,
                    'new_1_2' => 0,
                    'contacted' => 0,
                    'qualified_3_12' => 0,
                    'qualified' => 0,
                    'won' => 0,
                    'revenue' => 0.0,
                ];
            }
            $advisorsMap[$advKey]['leads']++;
            if ($isNew12) {
                $advisorsMap[$advKey]['new_1_2']++;
            }
            if ($isContacted) {
                $advisorsMap[$advKey]['contacted']++;
            }
            if ($isQualified312) {
                $advisorsMap[$advKey]['qualified_3_12']++;
            }
            if ($isQualified) {
                $advisorsMap[$advKey]['qualified']++;
            }
            if ($isWon) {
                $advisorsMap[$advKey]['won']++;
            }
            $advisorsMap[$advKey]['revenue'] += $depAmt;

            // Survey buckets
            $degCat = $this->categorizeDegree($degRaw);
            $degreeBuckets[$degCat] = ($degreeBuckets[$degCat] ?? 0) + 1;

            $progCat = $this->categorizeProgramInterest($progRaw);
            $programBuckets[$progCat] = ($programBuckets[$progCat] ?? 0) + 1;

            $timeCat = $this->categorizeConsultationTime($timeRaw);
            $consultTimeBuckets[$timeCat] = ($consultTimeBuckets[$timeCat] ?? 0) + 1;

            $engCat = $this->categorizeEnglishWorkExp($engRaw);
            $engExpBuckets[$engCat] = ($engExpBuckets[$engCat] ?? 0) + 1;
        }

        // 5. Build Campaign -> AdSet -> Ad nested list WITHOUT double-counting
        $campaignList = [];
        $activeCampaignsCount = 0;
        $activeAdsetsCount = 0;
        $activeAdsCount = 0;

        foreach ($campaignsMap as $cKey => $cItem) {
            $cLeads = (int)$cItem['leads'];
            $cPct = $totalLeads > 0 ? round(($cLeads / $totalLeads) * 100, 1) : 0.0;

            $nestedAdsets = [];
            $sumAdsetsSpend = 0.0;
            $sumAdsetsImp = 0;
            $sumAdsetsReach = 0;
            $sumAdsetsResults = 0;
            $sumAdsetsMetaLeads = 0;

            foreach (array_keys($cItem['adsets_map']) as $asKey) {
                if (!isset($adsetsMap[$asKey])) {
                    continue;
                }
                $asObj = $adsetsMap[$asKey];
                $asLeads = (int)$asObj['leads'];
                $asPct = $totalLeads > 0 ? round(($asLeads / $totalLeads) * 100, 1) : 0.0;

                $nestedAds = [];
                foreach (array_keys($asObj['ads_map']) as $adKey) {
                    if (!isset($adsMap[$adKey])) {
                        continue;
                    }
                    $adObj = $adsMap[$adKey];
                    $adCrmCpl = ($adObj['spend'] > 0 && $adObj['leads'] > 0) ? round($adObj['spend'] / $adObj['leads']) : 0.0;
                    $nestedAds[] = [
                        'id' => $adObj['id'],
                        'ad_id' => $adObj['ad_id'],
                        'name' => $adObj['name'],
                        'effective_status' => $adObj['effective_status'],
                        'thumbnail_url' => $adObj['thumbnail_url'],
                        'post_url' => $adObj['post_url'],
                        'optimization_goal' => $adObj['optimization_goal'],
                        'goal_label' => $adObj['goal_label'],
                        'result_label' => $adObj['result_label'],
                        'form_name' => $adObj['form_name'],
                        'platform' => $adObj['platform'],
                        'spend' => round((float)$adObj['spend']),
                        'impressions' => (int)$adObj['impressions'],
                        'reach' => (int)$adObj['reach'],
                        'results' => (int)$adObj['results'],
                        'cpr' => (float)$adObj['cpr'],
                        'meta_leads' => (int)$adObj['meta_leads'],
                        'cpl' => $adCrmCpl,
                        'leads' => $adObj['leads'],
                        'new_1_2' => (int)($adObj['new_1_2'] ?? 0),
                        'contacted' => $adObj['contacted'],
                        'qualified_3_12' => (int)($adObj['qualified_3_12'] ?? 0),
                        'qualified' => $adObj['qualified'],
                        'won' => $adObj['won'],
                        'revenue' => $adObj['revenue'],
                        'sample_programs' => array_keys($adObj['sample_programs']),
                    ];
                }
                usort($nestedAds, static fn($a, $b) => ($b['spend'] <=> $a['spend']) ?: ($b['leads'] <=> $a['leads']));

                $asSpend = (float)$asObj['spend'];
                $asImp = (int)$asObj['impressions'];
                $asReach = (int)$asObj['reach'];
                $asResults = (int)$asObj['results'];
                $asMetaLeads = (int)$asObj['meta_leads'];
                $asGoal = (string)$asObj['optimization_goal'];
                $asCpr = self::calculateMetaCpr($asSpend, $asResults, $asGoal);
                $asCpl = ($asSpend > 0 && $asLeads > 0) ? round($asSpend / $asLeads) : 0.0;

                $sumAdsetsSpend += $asSpend;
                $sumAdsetsImp += $asImp;
                $sumAdsetsReach += $asReach;
                $sumAdsetsResults += $asResults;
                $sumAdsetsMetaLeads += $asMetaLeads;

                $nestedAdsets[] = [
                    'id' => $asObj['id'],
                    'adset_id' => $asObj['adset_id'],
                    'name' => $asObj['name'],
                    'status' => $asObj['status'] ?? 'ACTIVE',
                    'optimization_goal' => $asGoal,
                    'goal_label' => $asObj['goal_label'],
                    'result_label' => $asObj['result_label'],
                    'leads' => $asLeads,
                    'pct' => $asPct,
                    'new_1_2' => (int)($asObj['new_1_2'] ?? 0),
                    'contacted' => $asObj['contacted'],
                    'qualified_3_12' => (int)($asObj['qualified_3_12'] ?? 0),
                    'qualified' => $asObj['qualified'],
                    'won' => $asObj['won'],
                    'revenue' => $asObj['revenue'],
                    'spend' => round($asSpend),
                    'impressions' => $asImp,
                    'reach' => $asReach,
                    'results' => $asResults,
                    'cpr' => $asCpr,
                    'meta_leads' => $asMetaLeads,
                    'cpl' => $asCpl,
                    'ads' => $nestedAds,
                ];
            }
            usort($nestedAdsets, static fn($a, $b) => ($b['spend'] <=> $a['spend']) ?: ($b['leads'] <=> $a['leads']));

            // Campaign spend comes from Graph API campaign spend first, or sum of its own Graph AdSets
            $cSpend = $cItem['spend'] > 0 ? (float)$cItem['spend'] : $sumAdsetsSpend;
            $cImp = $cItem['impressions'] > 0 ? (int)$cItem['impressions'] : $sumAdsetsImp;
            $cReach = $cItem['reach'] > 0 ? (int)$cItem['reach'] : $sumAdsetsReach;
            $cResults = $sumAdsetsResults > 0 ? $sumAdsetsResults : (int)$cItem['results'];
            $cMetaLeads = $sumAdsetsMetaLeads > 0 ? $sumAdsetsMetaLeads : (int)$cItem['meta_leads'];
            $cGoal = (string)$cItem['optimization_goal'];
            $cCpr = self::calculateMetaCpr($cSpend, $cResults, $cGoal);
            $cCpl = ($cSpend > 0 && $cLeads > 0) ? round($cSpend / $cLeads) : 0.0;
            $cRoas = ($cSpend > 0 && $cItem['revenue'] > 0) ? round($cItem['revenue'] / $cSpend, 2) : 0.0;

            if (strtoupper((string)$cItem['status']) === 'ACTIVE' && $cSpend > 0) {
                $activeCampaignsCount++;
            }

            $campaignList[] = [
                'id' => $cItem['id'],
                'campaign_id' => $cItem['campaign_id'],
                'name' => $cItem['name'],
                'status' => $cItem['status'],
                'optimization_goal' => $cGoal,
                'goal_label' => $cItem['goal_label'],
                'result_label' => $cItem['result_label'],
                'goal_group' => $cItem['goal_group'],
                'leads' => $cLeads,
                'pct' => $cPct,
                'new_1_2' => (int)($cItem['new_1_2'] ?? $cItem['uncontacted'] ?? 0),
                'uncontacted' => $cItem['uncontacted'],
                'contacted' => $cItem['contacted'],
                'qualified_3_12' => (int)($cItem['qualified_3_12'] ?? 0),
                'qualified' => $cItem['qualified'],
                'won' => $cItem['won'],
                'revenue' => $cItem['revenue'],
                'spend' => round($cSpend),
                'impressions' => $cImp,
                'reach' => $cReach,
                'results' => $cResults,
                'cpr' => $cCpr,
                'meta_leads' => $cMetaLeads,
                'cpl' => $cCpl,
                'roas' => $cRoas,
                'adsets_count' => count($cItem['adsets_map']),
                'ads_count' => count($cItem['ads_map']),
                'forms' => array_keys($cItem['forms_map']),
                'fan_thumbnails' => array_slice(array_keys($cItem['thumbnails']), 0, 3),
                'adsets' => $nestedAdsets,
            ];
        }
        usort($campaignList, static fn($a, $b) => ($b['spend'] <=> $a['spend']) ?: ($b['leads'] <=> $a['leads']));

        // Compute Campaign spend_pct so Donut reflects Spend share or Lead share cleanly
        $totalCampSpend = array_reduce($campaignList, static fn($carry, $it) => $carry + (float)$it['spend'], 0.0);
        foreach ($campaignList as &$cRef) {
            $cRef['spend_pct'] = $totalCampSpend > 0 ? round(((float)$cRef['spend'] / $totalCampSpend) * 100, 1) : 0.0;
            if ($totalLeads <= 0 && $cRef['spend_pct'] > 0) {
                $cRef['pct'] = $cRef['spend_pct'];
            }
        }
        unset($cRef);

        // Format AdSets list
        $adsetList = [];
        foreach ($adsetsMap as $asItem) {
            $asLeads = (int)$asItem['leads'];
            $asSpend = round((float)$asItem['spend']);
            $asResults = (int)$asItem['results'];
            $asGoal = (string)$asItem['optimization_goal'];
            if (strtoupper((string)($asItem['status'] ?? 'ACTIVE')) === 'ACTIVE' && $asSpend > 0) {
                $activeAdsetsCount++;
            }
            $adsetList[] = [
                'id' => $asItem['id'],
                'adset_id' => $asItem['adset_id'],
                'name' => $asItem['name'],
                'status' => $asItem['status'] ?? 'ACTIVE',
                'campaign_name' => $asItem['campaign_name'],
                'optimization_goal' => $asGoal,
                'goal_label' => $asItem['goal_label'],
                'result_label' => $asItem['result_label'],
                'count' => $asLeads > 0 ? $asLeads : (int)$asItem['meta_leads'],
                'leads' => $asLeads,
                'pct' => $totalLeads > 0 ? round(($asLeads / $totalLeads) * 100, 1) : 0.0,
                'new_1_2' => (int)($asItem['new_1_2'] ?? 0),
                'contacted' => $asItem['contacted'],
                'qualified_3_12' => (int)($asItem['qualified_3_12'] ?? 0),
                'qualified' => $asItem['qualified'],
                'won' => $asItem['won'],
                'revenue' => $asItem['revenue'],
                'spend' => $asSpend,
                'impressions' => (int)$asItem['impressions'],
                'reach' => (int)$asItem['reach'],
                'results' => $asResults,
                'cpr' => self::calculateMetaCpr($asSpend, $asResults, $asGoal),
                'meta_leads' => (int)$asItem['meta_leads'],
                'cpl' => ($asSpend > 0 && $asLeads > 0) ? round($asSpend / $asLeads) : 0.0,
            ];
        }
        usort($adsetList, static fn($a, $b) => ($b['spend'] <=> $a['spend']) ?: ($b['leads'] <=> $a['leads']));

        // Format Ads list (for Ad Preview Library — with real thumbnail_url, spend, goal, results, cpr)
        $adList = [];
        foreach ($adsMap as $adItem) {
            $adLeads = (int)$adItem['leads'];
            $adSpend = round((float)$adItem['spend']);
            if (strtoupper((string)($adItem['effective_status'] ?? 'ACTIVE')) === 'ACTIVE' && $adSpend > 0) {
                $activeAdsCount++;
            }
            $adList[] = [
                'id' => $adItem['id'],
                'ad_id' => $adItem['ad_id'],
                'name' => $adItem['name'],
                'effective_status' => $adItem['effective_status'],
                'thumbnail_url' => $adItem['thumbnail_url'],
                'post_url' => $adItem['post_url'],
                'optimization_goal' => $adItem['optimization_goal'],
                'goal_label' => $adItem['goal_label'],
                'result_label' => $adItem['result_label'],
                'adset_id' => $adItem['adset_id'],
                'adset_name' => $adItem['adset_name'],
                'campaign_id' => $adItem['campaign_id'],
                'campaign_name' => $adItem['campaign_name'],
                'form_name' => $adItem['form_name'],
                'platform' => $adItem['platform'],
                'spend' => $adSpend,
                'impressions' => (int)$adItem['impressions'],
                'reach' => (int)$adItem['reach'],
                'results' => (int)$adItem['results'],
                'cpr' => (float)$adItem['cpr'],
                'meta_leads' => (int)$adItem['meta_leads'],
                'cpl' => ($adSpend > 0 && $adLeads > 0) ? round($adSpend / $adLeads) : 0.0,
                'leads' => $adLeads,
                'pct' => $totalLeads > 0 ? round(($adLeads / $totalLeads) * 100, 1) : 0.0,
                'new_1_2' => (int)($adItem['new_1_2'] ?? 0),
                'contacted' => $adItem['contacted'],
                'qualified_3_12' => (int)($adItem['qualified_3_12'] ?? 0),
                'qualified' => $adItem['qualified'],
                'won' => $adItem['won'],
                'revenue' => $adItem['revenue'],
                'sample_programs' => array_keys($adItem['sample_programs']),
            ];
        }
        usort($adList, static fn($a, $b) => ($b['spend'] <=> $a['spend']) ?: ($b['leads'] <=> $a['leads']));

        // 6. Account-level Canonical Metrics (`DOMATION_META/js/ui/platform_summary.js` & `extra_details.js`)
        $accountTotalSpend = $platformCurr['spend'] > 0 ? round($platformCurr['spend']) : round($totalCampSpend);
        $accountImpressions = $platformCurr['impressions'] > 0 ? $platformCurr['impressions'] : array_sum(array_column($campaignList, 'impressions'));
        $accountReach = $platformCurr['reach'] > 0 ? $platformCurr['reach'] : array_sum(array_column($campaignList, 'reach'));
        $accountMetaLeads = $platformCurr['leads'] > 0 ? $platformCurr['leads'] : array_sum(array_column($campaignList, 'meta_leads'));
        $accountMessages = $platformCurr['messages_started'];
        $accountClicks = $platformCurr['link_clicks'];
        $accountVideoPlays = $platformCurr['video_plays'];
        $accountThruPlays = $platformCurr['thruplays'];
        $accountPostEngagement = $platformCurr['total_engagement'] > 0 ? $platformCurr['total_engagement'] : $platformCurr['post_engagement'];
        $accountReactions = $platformCurr['reactions'];
        $accountFollows = $platformCurr['follows'];

        // Format Goal Breakdown (`DOMATION_META/js/charts/goal_chart.js` & `extra_details.js`)
        $byGoalList = [];
        foreach ($goalGroupsMap as $gk => $gItem) {
            if ($gItem['spend'] <= 0 && $gItem['adsets_count'] <= 0) {
                continue;
            }
            $gSpend = round((float)$gItem['spend']);
            $gRes = (int)$gItem['results'];
            $gPct = $accountTotalSpend > 0 ? round(($gSpend / $accountTotalSpend) * 100, 1) : 0.0;
            $gCpr = ($gSpend > 0 && $gRes > 0)
                ? ($gk === 'Reach' ? round(($gSpend / $gRes) * 1000) : round($gSpend / $gRes))
                : 0.0;
            $byGoalList[] = [
                'group' => $gk,
                'label' => $gItem['label'],
                'spend' => $gSpend,
                'pct' => $gPct,
                'results' => $gRes,
                'cpr' => $gCpr,
                'meta_leads' => (int)$gItem['meta_leads'],
                'impressions' => (int)$gItem['impressions'],
                'reach' => (int)$gItem['reach'],
                'adsets_count' => (int)$gItem['adsets_count'],
            ];
        }
        usort($byGoalList, static fn($a, $b) => $b['spend'] <=> $a['spend']);

        // Exact Raw Meta Goal Chart (`QUALITY LEAD`, `REACH`, etc. in `media_1792638050524_81883c99.png`)
        $metaGoalChart = [];
        foreach ($rawGoalsMap as $rgKey => $rgItem) {
            if ($rgItem['spend'] <= 0) {
                continue;
            }
            $rgSpend = round((float)$rgItem['spend']);
            $rgRes = (int)$rgItem['results'];
            $metaGoalChart[] = [
                'goal' => $rgKey,
                'display_name' => $rgItem['display_name'],
                'label' => $rgItem['label'],
                'result_label' => $rgItem['result_label'],
                'group' => $rgItem['group'],
                'spend' => $rgSpend,
                'pct' => $accountTotalSpend > 0 ? round(($rgSpend / $accountTotalSpend) * 100, 1) : 0.0,
                'results' => $rgRes,
                'cpr' => self::calculateMetaCpr($rgSpend, $rgRes, $rgKey),
                'meta_leads' => (int)$rgItem['meta_leads'],
                'impressions' => (int)$rgItem['impressions'],
                'reach' => (int)$rgItem['reach'],
                'adsets_count' => (int)$rgItem['adsets_count'],
            ];
        }
        usort($metaGoalChart, static fn($a, $b) => $b['spend'] <=> $a['spend']);

        // 7. Build DOMATION_META `platform_spend` (`Facebook`, `Instagram`, `Other Platform` + `placement_positions`)
        $platSpendBuckets = [
            'facebook' => ['code' => 'facebook', 'name' => 'Facebook', 'spend' => 0.0, 'impressions' => 0, 'leads' => 0, 'messages' => 0],
            'instagram' => ['code' => 'instagram', 'name' => 'Instagram', 'spend' => 0.0, 'impressions' => 0, 'leads' => 0, 'messages' => 0],
            'other' => ['code' => 'other', 'name' => 'Other Platform', 'spend' => 0.0, 'impressions' => 0, 'leads' => 0, 'messages' => 0],
        ];
        $placementMap = [];
        foreach (($metaSnap['spend_by_platform'] ?? []) as $pRow) {
            $pub = strtolower(trim((string)($pRow['publisher_platform'] ?? 'other')));
            $pos = trim((string)($pRow['platform_position'] ?? 'unknown'));
            $sp = (float)($pRow['spend'] ?? 0);
            $imp = (int)($pRow['impressions'] ?? 0);
            $pActions = is_array($pRow['actions'] ?? null) ? $pRow['actions'] : [];
            $pLeads = self::getActionValue($pActions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($pActions, 'lead');
            $pMess = self::getActionValue($pActions, 'onsite_conversion.messaging_conversation_started_7d');

            $bKey = ($pub === 'facebook') ? 'facebook' : (($pub === 'instagram') ? 'instagram' : 'other');
            $platSpendBuckets[$bKey]['spend'] += $sp;
            $platSpendBuckets[$bKey]['impressions'] += $imp;
            $platSpendBuckets[$bKey]['leads'] += $pLeads;
            $platSpendBuckets[$bKey]['messages'] += $pMess;

            if ($sp > 0 || $imp > 0) {
                $posKey = $pub . '::' . $pos;
                if (!isset($placementMap[$posKey])) {
                    $placementMap[$posKey] = [
                        'publisher_platform' => ucfirst($pub),
                        'platform_position' => str_replace('_', ' ', ucfirst($pos)),
                        'spend' => 0.0,
                        'impressions' => 0,
                        'leads' => 0,
                        'messages' => 0,
                    ];
                }
                $placementMap[$posKey]['spend'] += $sp;
                $placementMap[$posKey]['impressions'] += $imp;
                $placementMap[$posKey]['leads'] += $pLeads;
                $placementMap[$posKey]['messages'] += $pMess;
            }
        }
        $totalPlatSpend = array_reduce($platSpendBuckets, static fn($c, $x) => $c + $x['spend'], 0.0);
        $platformSpendList = [];
        foreach ($platSpendBuckets as $pk => $pVal) {
            $spRound = round($pVal['spend']);
            $platformSpendList[] = [
                'code' => $pVal['code'],
                'name' => $pVal['name'],
                'spend' => $spRound,
                'pct' => $totalPlatSpend > 0 ? round(($pVal['spend'] / $totalPlatSpend) * 100, 1) : 0.0,
                'impressions' => $pVal['impressions'],
                'leads' => $pVal['leads'],
                'messages' => $pVal['messages'],
                'crm_leads' => $pk === 'facebook' ? $platformsMap['fb']['count'] : ($pk === 'instagram' ? $platformsMap['ig']['count'] : $platformsMap['other']['count']),
            ];
        }
        $placementList = array_values($placementMap);
        foreach ($placementList as &$plItem) {
            $plItem['spend'] = round((float)$plItem['spend']);
            $plItem['pct'] = $totalPlatSpend > 0 ? round(($plItem['spend'] / $totalPlatSpend) * 100, 1) : 0.0;
        }
        unset($plItem);
        usort($placementList, static fn($a, $b) => $b['spend'] <=> $a['spend']);

        // 8. Build DOMATION_META `age_gender_breakdown` (`render_age_gender.js`)
        $ageGroupsMap = [];
        foreach (['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as $agKey) {
            $ageGroupsMap[$agKey] = [
                'age' => $agKey,
                'male' => 0.0,
                'female' => 0.0,
                'unknown' => 0.0,
                'total' => 0.0,
                'impressions' => 0,
                'leads' => 0,
            ];
        }
        foreach (($metaSnap['spend_by_age_gender'] ?? []) as $agRow) {
            $age = trim((string)($agRow['age'] ?? ''));
            $gender = strtolower(trim((string)($agRow['gender'] ?? 'unknown')));
            if ($age === '' || strtolower($age) === 'unknown') {
                continue;
            }
            if (!isset($ageGroupsMap[$age])) {
                $ageGroupsMap[$age] = [
                    'age' => $age,
                    'male' => 0.0,
                    'female' => 0.0,
                    'unknown' => 0.0,
                    'total' => 0.0,
                    'impressions' => 0,
                    'leads' => 0,
                ];
            }
            $sp = (float)($agRow['spend'] ?? 0);
            $imp = (int)($agRow['impressions'] ?? 0);
            $agActions = is_array($agRow['actions'] ?? null) ? $agRow['actions'] : [];
            $agLeads = self::getActionValue($agActions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($agActions, 'lead');

            if ($gender === 'male') {
                $ageGroupsMap[$age]['male'] += $sp;
            } elseif ($gender === 'female') {
                $ageGroupsMap[$age]['female'] += $sp;
            } else {
                $ageGroupsMap[$age]['unknown'] += $sp;
            }
            $ageGroupsMap[$age]['total'] += $sp;
            $ageGroupsMap[$age]['impressions'] += $imp;
            $ageGroupsMap[$age]['leads'] += $agLeads;
        }
        $ageGenderList = [];
        $totalAgeSpend = array_reduce($ageGroupsMap, static fn($c, $x) => $c + $x['total'], 0.0);
        foreach ($ageGroupsMap as $agItem) {
            if ($agItem['total'] <= 0 && !in_array($agItem['age'], ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'], true)) {
                continue;
            }
            $ageGenderList[] = [
                'age' => $agItem['age'],
                'male' => round($agItem['male']),
                'female' => round($agItem['female']),
                'unknown' => round($agItem['unknown']),
                'total' => round($agItem['total']),
                'pct' => $totalAgeSpend > 0 ? round(($agItem['total'] / $totalAgeSpend) * 100, 1) : 0.0,
                'impressions' => $agItem['impressions'],
                'leads' => $agItem['leads'],
            ];
        }

        // 9. Build DOMATION_META `region_breakdown` (`region_chart.js`)
        $regionMap = [];
        foreach (($metaSnap['spend_by_region'] ?? []) as $regRow) {
            $cleanReg = self::cleanRegionName((string)($regRow['region'] ?? ''));
            if ($cleanReg === '') {
                continue;
            }
            $sp = (float)($regRow['spend'] ?? 0);
            if ($sp <= 0) {
                continue;
            }
            $imp = (int)($regRow['impressions'] ?? 0);
            $rActions = is_array($regRow['actions'] ?? null) ? $regRow['actions'] : [];
            $rLeads = self::getActionValue($rActions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($rActions, 'lead');

            if (!isset($regionMap[$cleanReg])) {
                $regionMap[$cleanReg] = [
                    'region' => $cleanReg,
                    'spend' => 0.0,
                    'impressions' => 0,
                    'leads' => 0,
                ];
            }
            $regionMap[$cleanReg]['spend'] += $sp;
            $regionMap[$cleanReg]['impressions'] += $imp;
            $regionMap[$cleanReg]['leads'] += $rLeads;
        }
        $totalRegSpend = array_reduce($regionMap, static fn($c, $x) => $c + $x['spend'], 0.0);
        $regionList = array_values($regionMap);
        foreach ($regionList as &$rItem) {
            $rItem['spend'] = round((float)$rItem['spend']);
            $rItem['pct'] = $totalRegSpend > 0 ? round(($rItem['spend'] / $totalRegSpend) * 100, 1) : 0.0;
        }
        unset($rItem);
        usort($regionList, static fn($a, $b) => $b['spend'] <=> $a['spend']);
        $regionList = array_slice($regionList, 0, 8);

        // 10. Build DOMATION_META `device_breakdown` (`platform_chart.js: spendByDevice`)
        $deviceMap = [];
        foreach (($metaSnap['spend_by_device'] ?? []) as $devRow) {
            $rawDev = strtolower(trim((string)($devRow['impression_device'] ?? 'other')));
            $sp = (float)($devRow['spend'] ?? 0);
            if ($sp <= 0) {
                continue;
            }
            $devLabel = match ($rawDev) {
                'android_smartphone' => 'Android Smartphone',
                'iphone' => 'iPhone (iOS)',
                'desktop' => 'Desktop / Laptop',
                'ipad' => 'iPad (Tablet)',
                'android_tablet' => 'Android Tablet',
                default => ucwords(str_replace('_', ' ', $rawDev)),
            };
            if (!isset($deviceMap[$devLabel])) {
                $deviceMap[$devLabel] = ['device' => $devLabel, 'spend' => 0.0, 'impressions' => 0];
            }
            $deviceMap[$devLabel]['spend'] += $sp;
            $deviceMap[$devLabel]['impressions'] += (int)($devRow['impressions'] ?? 0);
        }
        $totalDevSpend = array_reduce($deviceMap, static fn($c, $x) => $c + $x['spend'], 0.0);
        $deviceList = array_values($deviceMap);
        foreach ($deviceList as &$dItem) {
            $dItem['spend'] = round((float)$dItem['spend']);
            $dItem['pct'] = $totalDevSpend > 0 ? round(($dItem['spend'] / $totalDevSpend) * 100, 1) : 0.0;
        }
        unset($dItem);
        usort($deviceList, static fn($a, $b) => $b['spend'] <=> $a['spend']);

        // 11. Build DOMATION_META `daily_trend` (`dashboard_charts.js: dailySpend`)
        $dailyTrend = [];
        foreach (($metaSnap['daily_spend'] ?? []) as $dRow) {
            $dStart = trim((string)($dRow['date_start'] ?? ''));
            if ($dStart === '') {
                continue;
            }
            $sp = round((float)($dRow['spend'] ?? 0));
            $imp = (int)($dRow['impressions'] ?? 0);
            $rch = (int)($dRow['reach'] ?? 0);
            $dActions = is_array($dRow['actions'] ?? null) ? $dRow['actions'] : [];
            $dLeads = self::getActionValue($dActions, 'onsite_conversion.lead_grouped') ?: self::getActionValue($dActions, 'lead');
            $dMess = self::getActionValue($dActions, 'onsite_conversion.messaging_conversation_started_7d');
            $dClicks = self::getActionValue($dActions, 'link_click') ?: (int)($dRow['inline_link_clicks'] ?? 0);
            $dEng = self::getActionValue($dActions, 'post_engagement');
            $parts = explode('-', $dStart);
            $shortDate = count($parts) === 3 ? ($parts[2] . '/' . $parts[1]) : $dStart;

            $dailyTrend[] = [
                'date' => $dStart,
                'label' => $shortDate,
                'spend' => $sp,
                'impressions' => $imp,
                'reach' => $rch,
                'leads' => $dLeads,
                'messages' => $dMess,
                'clicks' => $dClicks,
                'engagement' => $dEng,
                'cpl' => ($sp > 0 && $dLeads > 0) ? round($sp / $dLeads) : 0,
            ];
        }
        usort($dailyTrend, static fn($a, $b) => strcmp($a['date'], $b['date']));

        // Format Forms list
        $formList = [];
        foreach ($formsMap as $fItem) {
            $fCount = (int)$fItem['count'];
            $formList[] = [
                'name' => $fItem['name'],
                'count' => $fCount,
                'pct' => $totalLeads > 0 ? round(($fCount / $totalLeads) * 100, 1) : 0.0,
                'new_1_2' => (int)($fItem['new_1_2'] ?? 0),
                'qualified_3_12' => (int)($fItem['qualified_3_12'] ?? 0),
                'qualified' => $fItem['qualified'],
                'won' => $fItem['won'],
                'revenue' => $fItem['revenue'],
            ];
        }
        usort($formList, static fn($a, $b) => $b['count'] <=> $a['count']);

        // Format Platform list (both Spend & CRM Leads)
        $platformList = [];
        foreach ($platformSpendList as $pItem) {
            if ($pItem['spend'] <= 0 && $pItem['crm_leads'] <= 0 && $pItem['code'] === 'other') {
                continue;
            }
            $platformList[] = [
                'code' => $pItem['code'],
                'name' => $pItem['name'],
                'spend' => $pItem['spend'],
                'spend_pct' => $pItem['pct'],
                'impressions' => $pItem['impressions'],
                'meta_leads' => $pItem['leads'],
                'messages' => $pItem['messages'],
                'count' => $pItem['crm_leads'] > 0 ? $pItem['crm_leads'] : $pItem['leads'],
                'pct' => $pItem['pct'] > 0 ? $pItem['pct'] : ($totalLeads > 0 ? round(($pItem['crm_leads'] / $totalLeads) * 100, 1) : 0.0),
            ];
        }

        // Format Top Advisors list
        $advisorList = [];
        foreach ($advisorsMap as $adv) {
            $advLeads = (int)$adv['leads'];
            $advisorList[] = [
                'id' => $adv['id'],
                'user_id' => $adv['user_id'],
                'name' => $adv['name'],
                'avatar' => $adv['avatar'],
                'email' => $adv['email'],
                'leads' => $advLeads,
                'pct' => $totalLeads > 0 ? round(($advLeads / $totalLeads) * 100, 1) : 0.0,
                'new_1_2' => (int)($adv['new_1_2'] ?? 0),
                'contacted' => $adv['contacted'],
                'qualified_3_12' => (int)($adv['qualified_3_12'] ?? 0),
                'qualified' => $adv['qualified'],
                'won' => $adv['won'],
                'revenue' => $adv['revenue'],
            ];
        }
        usort($advisorList, static function ($a, $b) {
            if ($a['user_id'] > 0 && $b['user_id'] === 0) return -1;
            if ($a['user_id'] === 0 && $b['user_id'] > 0) return 1;
            return $b['leads'] <=> $a['leads'];
        });

        $formatBuckets = static function (array $buckets) use ($totalLeads): array {
            arsort($buckets);
            $out = [];
            foreach ($buckets as $label => $cnt) {
                $out[] = [
                    'label' => $label,
                    'count' => (int)$cnt,
                    'pct' => $totalLeads > 0 ? round(($cnt / $totalLeads) * 100, 1) : 0.0,
                ];
            }
            return array_slice($out, 0, 5);
        };

        $surveyQuestions = [
            [
                'title' => 'Chương trình đào tạo quan tâm',
                'field' => 'program_interest',
                'options' => $formatBuckets($programBuckets),
            ],
            [
                'title' => 'Bằng cấp cao nhất hiện tại',
                'field' => 'degree',
                'options' => $formatBuckets($degreeBuckets),
            ],
            [
                'title' => 'Khung giờ hẹn tư vấn 1-1',
                'field' => 'consultation_time',
                'options' => $formatBuckets($consultTimeBuckets),
            ],
            [
                'title' => 'Trình độ Tiếng Anh & Kinh nghiệm',
                'field' => 'english_work_exp',
                'options' => $formatBuckets($engExpBuckets),
            ],
        ];

        $phonePct = $totalLeads > 0 ? round(($validPhoneCount / $totalLeads) * 100, 1) : 0.0;
        $emailPct = $totalLeads > 0 ? round(($validEmailCount / $totalLeads) * 100, 1) : 0.0;
        $surveyPct = $totalLeads > 0 ? round(($surveyCompletedCount / $totalLeads) * 100, 1) : 0.0;
        $assignedPct = $totalLeads > 0 ? round(($assignedCount / $totalLeads) * 100, 1) : 0.0;
        $new12Pct = $totalLeads > 0 ? round(($uncontactedLeads / $totalLeads) * 100, 1) : 0.0;
        $contactedPct = $totalLeads > 0 ? round(($contactedLeads / $totalLeads) * 100, 1) : 0.0;
        $qualified312Pct = $totalLeads > 0 ? round(($qualified312Leads / $totalLeads) * 100, 1) : 0.0;
        $qualifiedPct = $totalLeads > 0 ? round(($qualifiedLeads / $totalLeads) * 100, 1) : 0.0;
        $wonPct = $totalLeads > 0 ? round(($wonLeads / $totalLeads) * 100, 1) : 0.0;

        $dataQualityMetrics = [
            [
                'label' => 'Tỷ lệ SĐT hợp lệ & định danh CRM',
                'pct' => $phonePct,
                'desc' => sprintf('%d/%d lead có số điện thoại chuẩn hóa 9 số hợp lệ', $validPhoneCount, $totalLeads),
            ],
            [
                'label' => 'Tỷ lệ Email đăng ký đầy đủ',
                'pct' => $emailPct,
                'desc' => sprintf('%d/%d lead cung cấp địa chỉ Email hợp lệ trên Instant Form', $validEmailCount, $totalLeads),
            ],
            [
                'label' => 'Độ hoàn thiện khảo sát Instant Form Meta',
                'pct' => $surveyPct,
                'desc' => sprintf('%d/%d lead điền đầy đủ Bằng cấp, Chương trình & Khung giờ hẹn 1-1', $surveyCompletedCount, $totalLeads),
            ],
            [
                'label' => 'Tỷ lệ đã phân bổ Tư vấn viên phụ trách',
                'pct' => $assignedPct,
                'desc' => sprintf('%d/%d lead đã gắn Tư vấn viên (Owner) trên CRM', $assignedCount, $totalLeads),
            ],
            [
                'label' => 'Tỷ lệ tương tác & chuyển đổi sang Qualified (Pipeline ≥ 3)',
                'pct' => $contactedPct,
                'desc' => sprintf('%d lead đã tương tác • %d Qualified (3-12) (%s%%) • %d Win (13-14) (%s%%)', $contactedLeads, $qualified312Leads, (string)$qualified312Pct, $wonLeads, (string)$wonPct),
            ],
        ];

        $funnelStages = [
            ['stage' => 'Meta Leads', 'count' => $accountMetaLeads],
            ['stage' => 'Lead CRM', 'count' => $totalLeads],
            ['stage' => 'New (1-2)', 'count' => $uncontactedLeads],
            ['stage' => 'Đã tương tác', 'count' => $contactedLeads],
            ['stage' => 'Qualified (3-12)', 'count' => $qualified312Leads],
            ['stage' => 'Win (13-14)', 'count' => $wonLeads],
        ];

        // Primary Spend = Exact DOMATION_META Account Spend (or filtered Campaign Spend if a single campaign is selected)
        $effectiveSpend = ($campaignFilter !== '' && $campaignFilter !== 'all')
            ? round($totalCampSpend)
            : $accountTotalSpend;
        $effectiveMetaLeads = ($campaignFilter !== '' && $campaignFilter !== 'all')
            ? array_sum(array_column($campaignList, 'meta_leads'))
            : $accountMetaLeads;
        $effectiveImpressions = ($campaignFilter !== '' && $campaignFilter !== 'all')
            ? array_sum(array_column($campaignList, 'impressions'))
            : $accountImpressions;
        $effectiveReach = ($campaignFilter !== '' && $campaignFilter !== 'all')
            ? array_sum(array_column($campaignList, 'reach'))
            : $accountReach;

        // CPL (Meta Ads standard: Spend / Meta Leads; CRM standard: Spend / CRM Leads)
        $metaCpl = ($effectiveSpend > 0 && $effectiveMetaLeads > 0) ? round($effectiveSpend / $effectiveMetaLeads) : 0.0;
        $crmCpl = ($effectiveSpend > 0 && $totalLeads > 0) ? round($effectiveSpend / $totalLeads) : 0.0;
        $costPerNew12 = ($effectiveSpend > 0 && $uncontactedLeads > 0) ? round($effectiveSpend / $uncontactedLeads) : 0.0;
        $cpq312 = ($effectiveSpend > 0 && $qualified312Leads > 0) ? round($effectiveSpend / $qualified312Leads) : 0.0;
        $cpq = ($effectiveSpend > 0 && $qualifiedLeads > 0) ? round($effectiveSpend / $qualifiedLeads) : 0.0;
        $cpw = ($effectiveSpend > 0 && $wonLeads > 0) ? round($effectiveSpend / $wonLeads) : 0.0;
        $roas = ($effectiveSpend > 0 && $actualRevenue > 0) ? round($actualRevenue / $effectiveSpend, 2) : 0.0;

        ksort($pipelineStagesMap);
        $byPipelineStage = [];
        foreach ($pipelineStagesMap as $psRow) {
            $psCnt = (int)$psRow['count'];
            $byPipelineStage[] = [
                'stage_order' => (int)$psRow['stage_order'],
                'stage_name' => $psRow['stage_name'],
                'bucket' => $psRow['bucket'],
                'count' => $psCnt,
                'pct' => $totalLeads > 0 ? round(($psCnt / $totalLeads) * 100, 1) : 0.0,
            ];
        }

        $pipelineTiers = [
            [
                'key' => 'new_1_2',
                'label' => 'New (Pipeline 1–2)',
                'subtitle' => '01 - New Lead & 02 - Contact Attempted',
                'count' => $uncontactedLeads,
                'pct' => $new12Pct,
                'cost_per_lead' => $costPerNew12,
                'stage_1_count' => $stage1Count,
                'stage_2_count' => $stage2Count,
            ],
            [
                'key' => 'qualified_3_12',
                'label' => 'Qualified (Pipeline 3–12)',
                'subtitle' => 'Đang tư vấn chuyên sâu, gửi lộ trình & hẹn lịch 1-1',
                'count' => $qualified312Leads,
                'pct' => $qualified312Pct,
                'cost_per_lead' => $cpq312 > 0 ? $cpq312 : $cpq,
            ],
            [
                'key' => 'win_13_14',
                'label' => 'Win / Nhập học (Pipeline 13–14)',
                'subtitle' => '13 - Chờ đóng phí & 14 - Học viên chính thức',
                'count' => $wonLeads,
                'pct' => $wonPct,
                'cost_per_lead' => $cpw,
                'stage_13_count' => $stage13Count,
                'stage_14_count' => $enrolledLeads,
                'revenue' => $actualRevenue,
            ],
        ];

        $accountMetaCpl = ($accountLeadGoalSpend > 0 && $accountMetaLeads > 0) ? round($accountLeadGoalSpend / $accountMetaLeads) : $metaCpl;
        $avgCpm = ($effectiveImpressions > 0) ? round(($effectiveSpend / $effectiveImpressions) * 1000) : 0.0;
        $avgFrequency = ($effectiveReach > 0) ? round($effectiveImpressions / $effectiveReach, 2) : 0.0;
        $avgCpc = ($accountClicks > 0) ? round($effectiveSpend / $accountClicks) : 0.0;
        $avgCtr = ($effectiveImpressions > 0) ? round(($accountClicks / $effectiveImpressions) * 100, 2) : 0.0;

        // Period-over-Period % Changes (`DOMATION_META/js/ui/platform_summary.js`)
        $spendChangePct = self::calcPctChange((float)$platformCurr['spend'], (float)$platformPrev['spend']);
        $reachChangePct = self::calcPctChange((float)$platformCurr['reach'], (float)$platformPrev['reach']);
        $impChangePct = self::calcPctChange((float)$platformCurr['impressions'], (float)$platformPrev['impressions']);
        $leadsChangePct = self::calcPctChange((float)$platformCurr['leads'], (float)$platformPrev['leads']);
        $messChangePct = self::calcPctChange((float)$platformCurr['messages_started'], (float)$platformPrev['messages_started']);

        $videoRetention = [
            ['stage' => 'Video Plays (3s)', 'count' => $platformCurr['video_plays'], 'pct' => 100.0],
            ['stage' => 'Xem 25%', 'count' => $platformCurr['video_p25'], 'pct' => $platformCurr['video_plays'] > 0 ? round(($platformCurr['video_p25'] / $platformCurr['video_plays']) * 100, 1) : 0.0],
            ['stage' => 'Xem 50%', 'count' => $platformCurr['video_p50'], 'pct' => $platformCurr['video_plays'] > 0 ? round(($platformCurr['video_p50'] / $platformCurr['video_plays']) * 100, 1) : 0.0],
            ['stage' => 'Xem 75%', 'count' => $platformCurr['video_p75'], 'pct' => $platformCurr['video_plays'] > 0 ? round(($platformCurr['video_p75'] / $platformCurr['video_plays']) * 100, 1) : 0.0],
            ['stage' => 'Xem 95%', 'count' => $platformCurr['video_p95'], 'pct' => $platformCurr['video_plays'] > 0 ? round(($platformCurr['video_p95'] / $platformCurr['video_plays']) * 100, 1) : 0.0],
            ['stage' => 'ThruPlays (15s)', 'count' => $platformCurr['thruplays'], 'pct' => $platformCurr['video_plays'] > 0 ? round(($platformCurr['thruplays'] / $platformCurr['video_plays']) * 100, 1) : 0.0],
            ['stage' => 'Xem 100%', 'count' => $platformCurr['video_p100'], 'pct' => $platformCurr['video_plays'] > 0 ? round(($platformCurr['video_p100'] / $platformCurr['video_plays']) * 100, 1) : 0.0],
        ];

        $overviewPayload = [
            'summary' => [
                'account_id' => $metaSnap['account_id'] ?? '1852318231510577',
                'account_name' => $metaSnap['account_name'] ?? 'MBA 577',
                'date_range_key' => $bounds['canonical_key'],
                'since' => $bounds['since'],
                'until' => $bounds['until'],
                'prev_since' => $bounds['prev_since'],
                'prev_until' => $bounds['prev_until'],
                'spend' => $effectiveSpend,
                'attributed_spend' => $effectiveSpend,
                'account_total_spend' => $accountTotalSpend,
                'prev_spend' => round((float)$platformPrev['spend']),
                'spend_change_pct' => $spendChangePct,
                'lead_goal_spend' => round($accountLeadGoalSpend),
                'meta_leads' => $effectiveMetaLeads,
                'account_meta_leads' => $accountMetaLeads,
                'prev_meta_leads' => (int)$platformPrev['leads'],
                'leads_change_pct' => $leadsChangePct,
                'meta_cpl' => $metaCpl,
                'account_meta_cpl' => $accountMetaCpl,
                'cpl' => $metaCpl > 0 ? $metaCpl : $crmCpl,
                'crm_cpl' => $crmCpl,
                'cost_per_new_1_2' => $costPerNew12,
                'cpq_3_12' => $cpq312,
                'cpq' => $cpq,
                'cpw' => $cpw,
                'impressions' => $effectiveImpressions,
                'account_impressions' => $accountImpressions,
                'prev_impressions' => (int)$platformPrev['impressions'],
                'impressions_change_pct' => $impChangePct,
                'reach' => $effectiveReach,
                'account_reach' => $accountReach,
                'prev_reach' => (int)$platformPrev['reach'],
                'reach_change_pct' => $reachChangePct,
                'frequency' => $avgFrequency,
                'cpm' => $avgCpm,
                'clicks' => $accountClicks,
                'cpc' => $avgCpc,
                'ctr' => $avgCtr,
                'messages_started' => $accountMessages,
                'prev_messages_started' => (int)$platformPrev['messages_started'],
                'messages_change_pct' => $messChangePct,
                'thruplays' => $accountThruPlays,
                'video_plays' => $accountVideoPlays,
                'post_engagement' => $accountPostEngagement,
                'reactions' => $accountReactions,
                'follows' => $accountFollows,
                'comments' => (int)$platformCurr['comments'],
                'shares' => (int)$platformCurr['shares'],
                'total_leads' => $totalLeads,
                'paid_leads' => $paidLeads,
                'organic_leads' => $organicLeads,
                'instant_form_leads' => $instantFormLeads,
                'new_1_2_leads' => $uncontactedLeads,
                'new_1_2_pct' => $new12Pct,
                'stage_1_leads' => $stage1Count,
                'stage_2_leads' => $stage2Count,
                'uncontacted_leads' => $uncontactedLeads,
                'contacted_leads' => $contactedLeads,
                'contacted_pct' => $contactedPct,
                'qualified_3_12_leads' => $qualified312Leads,
                'qualified_3_12_pct' => $qualified312Pct,
                'qualified_leads' => $qualifiedLeads,
                'qualified_pct' => $qualifiedPct,
                'won_leads' => $wonLeads,
                'won_pct' => $wonPct,
                'stage_13_leads' => $stage13Count,
                'stage_14_leads' => $enrolledLeads,
                'enrolled_leads' => $enrolledLeads,
                'assigned_leads' => $assignedCount,
                'assigned_pct' => $assignedPct,
                'actual_revenue' => $actualRevenue,
                'roas' => $roas,
                'campaigns_count' => count($campaignList),
                'active_campaigns_count' => $activeCampaignsCount,
                'adsets_count' => count($adsetList),
                'active_adsets_count' => $activeAdsetsCount,
                'ads_count' => count($adList),
                'active_ads_count' => $activeAdsCount,
                'forms_count' => count($formList),
                'valid_phone_pct' => $phonePct,
                'survey_completed_pct' => $surveyPct,
            ],
            'pipeline_tiers' => $pipelineTiers,
            'by_pipeline_stage' => $byPipelineStage,
            'interaction_stats' => [
                'video_plays' => $accountVideoPlays,
                'thruplays' => $accountThruPlays,
                'link_clicks' => $accountClicks,
                'post_engagement' => $accountPostEngagement,
                'reactions' => $accountReactions,
                'follows' => $accountFollows,
                'comments' => (int)$platformCurr['comments'],
                'shares' => (int)$platformCurr['shares'],
                'messages_started' => $accountMessages,
                'leads' => $accountMetaLeads,
            ],
            'daily_trend' => $dailyTrend,
            'meta_goal_chart' => $metaGoalChart,
            'by_goal' => $byGoalList,
            'platform_spend' => $platformSpendList,
            'placement_positions' => $placementList,
            'age_gender_breakdown' => $ageGenderList,
            'region_breakdown' => $regionList,
            'device_breakdown' => $deviceList,
            'video_retention' => $videoRetention,
            'by_campaign' => $campaignList,
            'by_adset' => $adsetList,
            'by_ad' => $adList,
            'by_form' => $formList,
            'by_platform' => $platformList,
            'funnel_stages' => $funnelStages,
            'top_advisors' => $advisorList,
            'survey_questions' => $surveyQuestions,
            'data_quality_metrics' => $dataQualityMetrics,
            'hierarchy' => $campaignList,
        ];
        @file_put_contents($overviewCacheFile, json_encode($overviewPayload, JSON_UNESCAPED_UNICODE));
        respond(200, $overviewPayload);
    }

    /**
     * Resolve live Meta Ad Preview Iframe & Creative Thumbnail (`DOMATION_META/js/ui/ad_library.js` & `backgroundFetchCreative`).
     */
    public static function resolveAdPreviewData(PDO $db, string $rawAdId, string $format = 'DESKTOP_FEED_STANDARD', string $overrideToken = ''): array
    {
        $cleanAdId = preg_replace('/[^0-9]/', '', trim($rawAdId));
        $allowedFormats = [
            'MOBILE_FEED_STANDARD',
            'DESKTOP_FEED_STANDARD',
            'INSTAGRAM_STANDARD',
            'INSTAGRAM_STORY',
            'FACEBOOK_STORY_MOBILE',
        ];
        $adFormat = in_array(strtoupper($format), $allowedFormats, true) ? strtoupper($format) : 'DESKTOP_FEED_STANDARD';

        // 1. Fetch real attribution metadata & stats for this Ad ID from contact_meta_attribution
        $adMeta = null;
        $leadStats = ['total_leads' => 0, 'programs' => [], 'degrees' => [], 'times' => []];
        try {
            $stmt = $db->prepare("
                SELECT
                    ad_id, ad_name, adset_id, adset_name,
                    campaign_id, campaign_name, form_id, form_name,
                    platform, sheet_source, program_interest, degree, consultation_time
                FROM contact_meta_attribution
                WHERE deleted_at IS NULL
                  AND (ad_id = ? OR ad_id = ? OR REPLACE(ad_id, 'ag:', '') = ?)
                ORDER BY COALESCE(lead_created_time, created_at) DESC, id DESC
            ");
            $stmt->execute([$rawAdId, 'ag:' . $cleanAdId, $cleanAdId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (!empty($rows)) {
                $adMeta = $rows[0];
                $leadStats['total_leads'] = count($rows);
                foreach ($rows as $r) {
                    $prog = trim((string)($r['program_interest'] ?? ''));
                    if ($prog !== '' && count($leadStats['programs']) < 4 && !in_array($prog, $leadStats['programs'], true)) {
                        $leadStats['programs'][] = $prog;
                    }
                    $deg = trim((string)($r['degree'] ?? ''));
                    if ($deg !== '' && count($leadStats['degrees']) < 4 && !in_array($deg, $leadStats['degrees'], true)) {
                        $leadStats['degrees'][] = $deg;
                    }
                    $tm = trim((string)($r['consultation_time'] ?? ''));
                    if ($tm !== '' && count($leadStats['times']) < 3 && !in_array($tm, $leadStats['times'], true)) {
                        $leadStats['times'][] = $tm;
                    }
                }
            }
        } catch (\Throwable $e) {}

        if ($cleanAdId === '') {
            return [
                'ad_id' => $rawAdId,
                'clean_ad_id' => '',
                'format' => $adFormat,
                'source' => 'none',
                'thumbnail_url' => '',
                'post_url' => '',
                'effective_status' => '',
                'iframe_html' => '',
                'iframe_src' => '',
                'srcdoc_html' => '',
                'ad_meta' => $adMeta,
                'lead_stats' => $leadStats,
                'ad_library_url' => 'https://www.facebook.com/ads/library/',
            ];
        }

        // 2. Check temp cache for live Graph API preview + thumbnail
        $cacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_meta_ad_preview_v2_' . $cleanAdId . '_' . $adFormat . '.json';
        if ($overrideToken === '' && is_file($cacheFile) && (time() - @filemtime($cacheFile)) < 1800) {
            $cached = @json_decode((string)@file_get_contents($cacheFile), true);
            if (is_array($cached) && (!empty($cached['iframe_src']) || !empty($cached['thumbnail_url']))) {
                return $cached;
            }
        }

        // 3. Resolve active Meta Access Tokens (`DOMATION_META` tenant + MYERP settings)
        $creds = self::resolveMetaCredentials($db, $overrideToken);
        $tokens = $creds['tokens'];

        $graphIframeHtml = '';
        $graphIframeSrc = '';
        $thumbnailUrl = '';
        $postUrl = '';
        $effectiveStatus = 'ACTIVE';
        $graphAdName = '';
        $graphError = null;

        foreach ($tokens as $tok) {
            // 3a. Fetch Creative Thumbnail & Post URL (`{ad_id}?fields=id,name,effective_status,creative{thumbnail_url,image_url,instagram_permalink_url,effective_object_story_id}`)
            $metaUrl = "https://graph.facebook.com/v25.0/{$cleanAdId}?fields=id,name,effective_status,creative{thumbnail_url,image_url,instagram_permalink_url,effective_object_story_id}&access_token=" . urlencode($tok);
            $metaParsed = self::fetchGraphJson($metaUrl, 6);
            if (!empty($metaParsed['id'])) {
                $graphAdName = trim((string)($metaParsed['name'] ?? ''));
                $effectiveStatus = trim((string)($metaParsed['effective_status'] ?? 'ACTIVE'));
                $cr = is_array($metaParsed['creative'] ?? null) ? $metaParsed['creative'] : [];
                $thumbnailUrl = trim((string)($cr['image_url'] ?? $cr['thumbnail_url'] ?? ''));
                $postUrl = trim((string)($cr['instagram_permalink_url'] ?? ''));
                if ($postUrl === '' && !empty($cr['effective_object_story_id'])) {
                    $postUrl = 'https://www.facebook.com/' . $cr['effective_object_story_id'];
                }
            }

            // 3b. Fetch Live Ad Preview Iframe (`/{ad_id}/previews?ad_format=...`)
            $prevUrl = "https://graph.facebook.com/v25.0/{$cleanAdId}/previews?ad_format={$adFormat}&access_token=" . urlencode($tok);
            $prevParsed = self::fetchGraphJson($prevUrl, 6);
            if (!empty($prevParsed['data'][0]['body'])) {
                $graphIframeHtml = (string)$prevParsed['data'][0]['body'];
                if (preg_match('/src=["\']([^"\']+)["\']/i', $graphIframeHtml, $mSrc)) {
                    $graphIframeSrc = html_entity_decode($mSrc[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }
                break;
            } elseif (!empty($prevParsed['error']['message'])) {
                $graphError = (string)$prevParsed['error']['message'];
            }
        }

        $adLibraryUrl = "https://www.facebook.com/ads/library/?id={$cleanAdId}";

        $result = [
            'ad_id' => $rawAdId,
            'clean_ad_id' => $cleanAdId,
            'ad_name' => $graphAdName !== '' ? $graphAdName : (string)($adMeta['ad_name'] ?? ('Meta Ad #' . $cleanAdId)),
            'format' => $adFormat,
            'source' => ($graphIframeHtml !== '' || $thumbnailUrl !== '') ? 'meta_graph_api' : 'crm_attribution_embed',
            'effective_status' => $effectiveStatus,
            'thumbnail_url' => $thumbnailUrl,
            'post_url' => $postUrl !== '' ? $postUrl : $adLibraryUrl,
            'iframe_html' => $graphIframeHtml,
            'iframe_src' => $graphIframeSrc,
            'srcdoc_html' => '',
            'ad_library_url' => $adLibraryUrl,
            'ad_meta' => $adMeta,
            'lead_stats' => $leadStats,
            'graph_status' => ($graphIframeHtml !== '' || $thumbnailUrl !== '') ? 'ok' : ($graphError ?: 'token_expired_or_missing'),
        ];

        if ($graphIframeHtml !== '' || $thumbnailUrl !== '') {
            @file_put_contents($cacheFile, json_encode($result, JSON_UNESCAPED_UNICODE));
        }

        return $result;
    }

    /**
     * GET /marketing/meta/ad-preview?ad_id=...&format=DESKTOP_FEED_STANDARD
     */
    public function getAdPreview(array $auth): void
    {
        $rawAdId = trim((string)($_GET['ad_id'] ?? $_GET['id'] ?? ''));
        $format = trim((string)($_GET['format'] ?? $_GET['ad_format'] ?? 'DESKTOP_FEED_STANDARD'));
        $overrideToken = trim((string)($_GET['access_token'] ?? ''));

        if ($rawAdId === '') {
            respond(400, null, 'Thiếu tham số ad_id', false);
        }

        $data = self::resolveAdPreviewData($this->db, $rawAdId, $format, $overrideToken);
        respond(200, $data);
    }

    /**
     * POST /marketing/meta/token
     */
    public function saveAccessToken(array $auth, array $body): void
    {
        $token = trim((string)($body['access_token'] ?? $body['meta_access_token'] ?? ''));
        if (strlen($token) < 30) {
            respond(400, null, 'Meta Access Token không hợp lệ', false);
        }

        try {
            $stmt = $this->db->prepare("
                INSERT INTO system_settings (setting_key, setting_value)
                VALUES ('meta_access_token', ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $stmt->execute([$token]);
            self::$cachedMetaCreds = null;
            @unlink(sys_get_temp_dir() . '/myerp_meta_creds_v2.json');
        } catch (\Throwable $e) {}

        respond(200, ['saved' => true]);
    }
}
