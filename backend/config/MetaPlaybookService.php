<?php
/**
 * backend/config/MetaPlaybookService.php
 *
 * Implements MASTER_PLAYBOOK_META_ADS_HIGH_TICKET_BDS_GIAODUC_OTO:
 * 1. Historical CRM -> Meta Custom Audience Sync:
 *    - VIP Enrolled / Approved Deposits Seed (Value-Based with VNĐ LTV weights)
 *    - Historical FB/IG Quality Leads Seed (`04 - Needed`+)
 *    - Historical All-Channel Quality Leads Seed (`04 - Needed`+)
 *    - Exclusion: CRM Junk / Lost / Spam Leads
 *    - Exclusion: Enrolled Students (avoid wasting prospecting budget)
 *    - Exclusion: Page Post Savers 365d (`page_post_save` on Page 860714080649450)
 * 2. Lookalike Generation (`LAL 1%` & `LAL 1%-3%` VN).
 * 3. Education Section 02B (MBA / DBA / CEO 26-50) 2-Layer AND Targeting Optimizer
 *    with anti-clone device tenure signals & Advantage+ Audience compliance.
 */

require_once __DIR__ . '/CapiHelper.php';

class MetaPlaybookService
{
    public const AUD_VIP_VALUE_SEED      = 'MYERP - VIP Hoc Vien Da Dong Phi (Value-Based)';
    public const AUD_VIP_STANDARD_SEED   = 'MYERP - VIP Hoc Vien Da Dong Phi (Standard Seed)';
    public const AUD_FB_QUALITY_SEED     = 'MYERP - Seed Lead FB Chat Luong (Needed+)';
    public const AUD_ALL_QUALITY_SEED    = 'MYERP - Seed All-Channel Chat Luong (Needed+)';
    public const AUD_EXCL_JUNK_LOST      = 'MYERP - Loai Tru Lead Rac / Lost CRM';
    public const AUD_EXCL_ENROLLED       = 'MYERP - Loai Tru Hoc Vien Da Nhap Hoc';
    public const AUD_EXCL_PAGE_SAVE_365D = 'Loai_Tru_Luu_Bai_Viet_Page_365d';
    public const AUD_EXCL_PHONE_FARM     = 'MYERP - Loai Tru Phone Farm / Rac';
    public const AUD_LAL_1PCT            = 'LAL 1% - HV VIP Da Dong Phi (MBA 577)';
    public const AUD_LAL_1_3PCT          = 'LAL 1%-3% - HV VIP Da Dong Phi (MBA 577)';
    public const AUD_LAL_QUALITY_1PCT    = 'LAL 1% - Lead FB Chat Luong Needed+ (MBA 577)';
    public const AUD_LAL_QUALITY_1_3PCT  = 'LAL 1%-3% - Lead FB Chat Luong Needed+ (MBA 577)';

    /**
     * Summarize eligible CRM audience pools & inspect live Meta Custom Audiences on the Ad Account.
     */
    public static function previewAudiences(PDO $db, int $tenantId = 1): array
    {
        $settings = CapiHelper::getSettings($db);
        $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
        $token = $settings['access_token'];
        $minOrder = self::getMinOrderIndex($db, $tenantId, (string)$settings['capi_quality_min_stage']);

        $vipRows = self::queryAudienceSegment($db, 'vip_enrolled', $minOrder);
        $fbQualityRows = self::queryAudienceSegment($db, 'fb_quality', $minOrder);
        $allQualityRows = self::queryAudienceSegment($db, 'all_quality', $minOrder);
        $junkLostRows = self::queryAudienceSegment($db, 'junk_lost', $minOrder);
        $phoneFarmStats = CapiHelper::getPhoneFarmStats($db, $tenantId);

        $liveAudiences = [];
        $liveErr = null;
        if ($token !== '') {
            $res = self::graphGet("act_{$adAccountId}/customaudiences", [
                'fields' => 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,is_value_based,time_created,time_updated',
                'limit'  => 100,
            ], $token);
            if (!empty($res['data']) && is_array($res['data'])) {
                $liveAudiences = $res['data'];
            } elseif (!empty($res['error']['message'])) {
                $liveErr = $res['error']['message'];
            }
        }

        return [
            'ad_account_id' => $adAccountId,
            'page_id'       => CapiHelper::DEFAULT_PAGE_ID,
            'crm_pools'     => [
                'vip_enrolled' => ['name' => self::AUD_VIP_VALUE_SEED, 'count' => count($vipRows), 'total_value_vnd' => self::sumSegmentValue($vipRows)],
                'fb_quality'   => ['name' => self::AUD_FB_QUALITY_SEED, 'count' => count($fbQualityRows)],
                'all_quality'  => ['name' => self::AUD_ALL_QUALITY_SEED, 'count' => count($allQualityRows)],
                'junk_lost'    => ['name' => self::AUD_EXCL_JUNK_LOST, 'count' => count($junkLostRows)],
                'enrolled'     => ['name' => self::AUD_EXCL_ENROLLED, 'count' => count($vipRows)],
                'phone_farm'   => [
                    'name'             => self::AUD_EXCL_PHONE_FARM,
                    'count'            => (int)($phoneFarmStats['total_blocked'] ?? 0),
                    'meta_audience_id' => $phoneFarmStats['meta_audience_id'] ?? null,
                    'last_synced_at'   => $phoneFarmStats['last_synced_at'] ?? null,
                ],
            ],
            'live_audiences' => $liveAudiences,
            'live_error'     => $liveErr,
        ];
    }

    /**
     * Create/update all Playbook CRM Seed Audiences, Exclusions, Page Save Exclusion & Lookalikes on Meta.
     */
    public static function syncAllPlaybookAudiences(PDO $db, int $tenantId = 1, string $pageId = CapiHelper::DEFAULT_PAGE_ID): array
    {
        $settings = CapiHelper::getSettings($db);
        $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
        $token = $settings['access_token'];
        if ($token === '') {
            throw new \RuntimeException('Không tìm thấy Meta Access Token hợp lệ để đồng bộ Custom Audience.');
        }

        $minOrder = self::getMinOrderIndex($db, $tenantId, (string)$settings['capi_quality_min_stage']);
        $existingRes = self::graphGet("act_{$adAccountId}/customaudiences", [
            'fields' => 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,is_value_based',
            'limit'  => 200,
        ], $token);
        if (!empty($existingRes['error']['message'])) {
            throw new \RuntimeException('Meta API Error listing audiences: ' . $existingRes['error']['message']);
        }
        $byName = [];
        foreach (($existingRes['data'] ?? []) as $aud) {
            if (!empty($aud['name']) && !empty($aud['id'])) {
                $byName[(string)$aud['name']] = $aud;
            }
        }

        $report = ['ad_account_id' => $adAccountId, 'audiences' => [], 'lookalikes' => [], 'warnings' => []];

        // 1. VIP Seed (try Value-Based first; fallback to Standard Seed if BM/AdAccount lacks value-based permissions)
        $vipRows = self::queryAudienceSegment($db, 'vip_enrolled', $minOrder);
        if (!empty($byName[self::AUD_VIP_VALUE_SEED]['id'])) {
            $vipAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_VIP_VALUE_SEED, $vipRows, true, 'MYERP VIP Enrolled & Approved Deposits (Value-Based VNĐ)');
        } elseif (!empty($byName[self::AUD_VIP_STANDARD_SEED]['id'])) {
            $vipAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_VIP_STANDARD_SEED, $vipRows, false, 'MYERP VIP Enrolled & Approved Deposits (Standard Seed)');
        } else {
            $vipAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_VIP_VALUE_SEED, $vipRows, true, 'MYERP VIP Enrolled & Approved Deposits (Value-Based VNĐ)');
            if (empty($vipAud['id'])) {
                $report['warnings'][] = 'Value-Based seed skipped (' . ($vipAud['error'] ?? 'permission error') . '); falling back to Standard VIP Seed.';
                $vipAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_VIP_STANDARD_SEED, $vipRows, false, 'MYERP VIP Enrolled & Approved Deposits (Standard Seed)');
            }
        }
        $report['audiences']['vip_enrolled'] = $vipAud;

        // 2. FB Quality Seed
        $fbRows = self::queryAudienceSegment($db, 'fb_quality', $minOrder);
        $fbAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_FB_QUALITY_SEED, $fbRows, false, 'MYERP Historical Facebook/IG Leads stage Needed+');
        $report['audiences']['fb_quality'] = $fbAud;

        // 3. All-Channel Quality Seed
        $allRows = self::queryAudienceSegment($db, 'all_quality', $minOrder);
        $allAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_ALL_QUALITY_SEED, $allRows, false, 'MYERP All-Channel Quality Leads stage Needed+');
        $report['audiences']['all_quality'] = $allAud;

        // 4. Exclusion: Junk & Lost CRM
        $junkRows = self::queryAudienceSegment($db, 'junk_lost', $minOrder);
        $junkAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_EXCL_JUNK_LOST, $junkRows, false, 'Exclusion: MYERP Lost, Not-Lead, Spam & Junk Leads');
        $report['audiences']['excl_junk_lost'] = $junkAud;

        // 5. Exclusion: Enrolled Students (non-value standard file for clean exclusion)
        $enrolledAud = self::ensureAndUploadCustomAudience($adAccountId, $token, $byName, self::AUD_EXCL_ENROLLED, $vipRows, false, 'Exclusion: Enrolled Students & Approved Deposits');
        $report['audiences']['excl_enrolled'] = $enrolledAud;

        // 6. Exclusion: Page Post Save 365d (Playbook Section IV)
        $pageSaveAud = self::ensurePagePostSaveAudience($adAccountId, $token, $byName, $pageId, self::AUD_EXCL_PAGE_SAVE_365D);
        $report['audiences']['excl_page_save_365d'] = $pageSaveAud;

        // 6b. Exclusion: Phone Farm / Click-Fraud Blacklist (`capi_blocked_phones`)
        $phoneFarmAud = self::syncPhoneFarmAudience($db, $tenantId, false);
        $report['audiences']['excl_phone_farm'] = $phoneFarmAud;

        // 7. Create Lookalikes (1% & 1%-3% VN) from VIP Value-Based Seed; fallback to FB Quality Seed if VIP seed still populating
        $vipId = $vipAud['id'] ?? '';
        $lal1 = null;
        $lal13 = null;
        if ($vipId !== '') {
            $lal1 = self::ensureLookalikeAudience($adAccountId, $token, $byName, self::AUD_LAL_1PCT, $vipId, 'VN', 0.01, null);
            $lal13 = self::ensureLookalikeAudience($adAccountId, $token, $byName, self::AUD_LAL_1_3PCT, $vipId, 'VN', 0.03, 0.01);
        }
        if (empty($lal1['id']) && !empty($fbAud['id'])) {
            if (!empty($lal1['error'])) {
                $report['warnings'][] = 'VIP LAL 1% deferred (' . $lal1['error'] . '), falling back to FB Quality Seed.';
            }
            $lal1 = self::ensureLookalikeAudience($adAccountId, $token, $byName, self::AUD_LAL_QUALITY_1PCT, (string)$fbAud['id'], 'VN', 0.01, null);
        }
        if (empty($lal13['id']) && !empty($fbAud['id'])) {
            if (!empty($lal13['error'])) {
                $report['warnings'][] = 'VIP LAL 1%-3% deferred (' . $lal13['error'] . '), falling back to FB Quality Seed.';
            }
            $lal13 = self::ensureLookalikeAudience($adAccountId, $token, $byName, self::AUD_LAL_QUALITY_1_3PCT, (string)$fbAud['id'], 'VN', 0.03, 0.01);
        }
        $report['lookalikes']['lal_1pct'] = $lal1;
        $report['lookalikes']['lal_1_3pct'] = $lal13;

        return $report;
    }

    /**
     * Build Playbook Section 02B (MBA / DBA / CEO 26-50) 2-Layer AND Targeting JSON.
     * Preserves Advantage+ `individual_setting` & `brand_safety_content_filter_levels`, NO `end_time`, NO `exclusions`.
     */
    public static function buildEducationPlaybookTargeting(
        array $customAudienceRefs = [],
        array $excludedAudienceRefs = [],
        array $baseGeo = [],
        array $existingAutomation = [],
        array $brandSafetyLevels = []
    ): array {
        if (empty($baseGeo)) {
            $baseGeo = [
                'countries'      => ['VN'],
                'location_types' => ['home', 'recent'],
            ];
        }

        // Layer 1 (OR): Senior Roles, B2B Decision Makers, Business Travel, Anti-Clone Long Device Tenure
        $layer1 = [
            'behaviors' => [
                ['id' => '6022788483583', 'name' => 'Frequent international travelers'],
                ['id' => '6091658651583', 'name' => 'Uses a mobile device (19-24 months)'],
                ['id' => '6091658683183', 'name' => 'Uses a mobile device (25 months+)'],
                ['id' => '6002714898572', 'name' => 'Small business owners'],
                ['id' => '6002764392172', 'name' => 'Facebook Payments users (90 days)'],
                ['id' => '6004384041172', 'name' => 'Apple iOS devices'],
            ],
            'work_positions' => [
                ['id' => '133337610036491', 'name' => 'Founder, Director, CEO'],
                ['id' => '117677474946712', 'name' => 'Owner/Manager/CEO'],
                ['id' => '874842615892965', 'name' => 'Managing Director'],
                ['id' => '149598488387016', 'name' => 'Owner and CEO'],
                ['id' => '149657818421934', 'name' => 'Director (business)'],
                ['id' => '108595432498170', 'name' => 'Senior management'],
                ['id' => '1550295271909640', 'name' => 'Sales Manager'],
                ['id' => '662527803859073', 'name' => 'Sales and Marketing Manager'],
            ],
            'industries' => [
                ['id' => '6262428231783', 'name' => 'Business Decision Makers'],
                ['id' => '6009003311983', 'name' => 'Management'],
                ['id' => '6009003307783', 'name' => 'Business and Finance'],
                ['id' => '6075565069783', 'name' => 'Large B2B (500+ employees)'],
                ['id' => '6080792228383', 'name' => 'Medium B2B (200-500 employees)'],
            ],
            'interests' => [
                ['id' => '6003147505126', 'name' => 'Leadership'],
                ['id' => '6004037932409', 'name' => 'Quản lý'],
                ['id' => '6003371567474', 'name' => 'Entrepreneurship'],
                ['id' => '6003246495067', 'name' => 'LinkedIn'],
                ['id' => '6003257861969', 'name' => 'Business travel'],
                ['id' => '6003352779232', 'name' => 'Business class'],
                ['id' => '6003484864669', 'name' => 'Wealth management'],
            ],
        ];

        // Layer 2 (AND): Postgraduate / MBA / International Higher Education Demand
        $layer2 = [
            'interests' => [
                ['id' => '6003230008188', 'name' => 'Master of Business Administration (MBA)'],
                ['id' => '6003714873062', 'name' => "Master's degree"],
                ['id' => '6003232454885', 'name' => 'Postgraduate education'],
                ['id' => '6003270811593', 'name' => 'Higher education'],
                ['id' => '6003659424716', 'name' => 'International education'],
            ],
        ];

        $automation = !empty($existingAutomation) && isset($existingAutomation['advantage_audience'])
            ? $existingAutomation
            : ['advantage_audience' => 1];

        $targeting = [
            'age_min'              => 18,
            'age_max'              => 65,
            'age_range'            => [26, 50],
            'geo_locations'        => $baseGeo,
            'flexible_spec'        => [$layer1, $layer2],
            'targeting_automation' => $automation,
        ];

        if (!empty($brandSafetyLevels)) {
            $targeting['brand_safety_content_filter_levels'] = array_values($brandSafetyLevels);
        }
        if (!empty($customAudienceRefs)) {
            $targeting['custom_audiences'] = array_values($customAudienceRefs);
        }
        if (!empty($excludedAudienceRefs)) {
            $targeting['excluded_custom_audiences'] = array_values($excludedAudienceRefs);
        }

        return $targeting;
    }

    /**
     * Optimize a live Meta AdSet with Playbook 2-Layer targeting, Lookalikes, Exclusions & optional CRM pixel binding.
     */
    public static function optimizeAdSet(PDO $db, string $adsetId, array $syncReport = [], bool $tryCrmPromotedObject = false): array
    {
        $adsetId = preg_replace('/[^0-9]/', '', $adsetId);
        if ($adsetId === '') {
            throw new \InvalidArgumentException('AdSet ID không hợp lệ.');
        }

        $settings = CapiHelper::getSettings($db);
        $token = $settings['access_token'];
        if ($token === '') {
            throw new \RuntimeException('Thiếu Meta Access Token.');
        }

        // 1. Read current state for audit backup
        $before = self::graphGet($adsetId, [
            'fields' => 'id,name,status,effective_status,campaign_id,optimization_goal,promoted_object,targeting,bid_strategy',
        ], $token);
        if (!empty($before['error']['message'])) {
            throw new \RuntimeException("Không đọc được AdSet {$adsetId}: " . $before['error']['message']);
        }

        // 2. Collect Custom Audiences (LAL include + Junk/Enrolled/PageSave/Form90d exclude)
        $includeAuds = [];
        $excludeAuds = [];

        foreach (['lal_1pct', 'lal_1_3pct'] as $lkKey) {
            if (!empty($syncReport['lookalikes'][$lkKey]['id'])) {
                $includeAuds[] = [
                    'id'   => (string)$syncReport['lookalikes'][$lkKey]['id'],
                    'name' => (string)($syncReport['lookalikes'][$lkKey]['name'] ?? $lkKey),
                ];
            }
        }
        foreach (['excl_page_save_365d', 'excl_junk_lost', 'excl_enrolled', 'excl_phone_farm'] as $exKey) {
            if (!empty($syncReport['audiences'][$exKey]['id'])) {
                $excludeAuds[] = [
                    'id'   => (string)$syncReport['audiences'][$exKey]['id'],
                    'name' => (string)($syncReport['audiences'][$exKey]['name'] ?? $exKey),
                ];
            }
        }

        // Preserve any existing valid custom_audiences / excluded_custom_audiences not duplicating ours
        $existingExclIds = array_column($excludeAuds, 'id');
        foreach (($before['targeting']['excluded_custom_audiences'] ?? []) as $oldEx) {
            $oldExId = (string)($oldEx['id'] ?? '');
            if ($oldExId !== '' && !in_array($oldExId, $existingExclIds, true)) {
                $excludeAuds[] = ['id' => $oldExId, 'name' => (string)($oldEx['name'] ?? '')];
                $existingExclIds[] = $oldExId;
            }
        }

        // Ensure "Submit form 90days left" (`120235454948850636`) is also excluded if on MBA 577 & missing
        $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
        if ($adAccountId === CapiHelper::DEFAULT_AD_ACCOUNT_ID && !in_array('120235454948850636', $existingExclIds, true)) {
            $excludeAuds[] = ['id' => '120235454948850636', 'name' => 'Submit form 90days left'];
        }

        $baseGeo = $before['targeting']['geo_locations'] ?? ['countries' => ['VN'], 'location_types' => ['home', 'recent']];
        $existingAutomation = is_array($before['targeting']['targeting_automation'] ?? null) ? $before['targeting']['targeting_automation'] : [];
        $brandSafetyLevels = is_array($before['targeting']['brand_safety_content_filter_levels'] ?? null) ? $before['targeting']['brand_safety_content_filter_levels'] : [];

        $newTargeting = self::buildEducationPlaybookTargeting($includeAuds, $excludeAuds, $baseGeo, $existingAutomation, $brandSafetyLevels);
        $targetingMode = !empty($includeAuds) ? 'full_playbook_with_lookalikes' : 'playbook_2layer_with_exclusions';
        $advisory = null;

        // 3. Apply Targeting update:
        //    - If `#1359202` fires while preserving legacy `individual_setting` (`age:1, gender:1`), retry ONCE normalizing `individual_setting` to `['geo' => 0]` (unlocking Lookalike custom_audiences cleanly).
        //    - If `#1359202` still rejects `custom_audiences` on Advantage+ Leads, fallback cleanly preserving 2-Layer + Age 26-50 + All Exclusions.
        $updateRes = self::graphPost($adsetId, [
            'targeting' => json_encode($newTargeting, JSON_UNESCAPED_UNICODE),
        ], $token);

        if (!empty($updateRes['error']) && (int)($updateRes['error']['error_subcode'] ?? 0) === 1359202 && !empty($newTargeting['custom_audiences'])) {
            $normTargeting = $newTargeting;
            $normTargeting['targeting_automation'] = [
                'advantage_audience' => 1,
                'individual_setting' => ['geo' => 0],
            ];
            $updateRes = self::graphPost($adsetId, [
                'targeting' => json_encode($normTargeting, JSON_UNESCAPED_UNICODE),
            ], $token);
            if (empty($updateRes['error'])) {
                $newTargeting = $normTargeting;
            } elseif ((int)($updateRes['error']['error_subcode'] ?? 0) === 1359202) {
                unset($newTargeting['custom_audiences']);
                $updateRes = self::graphPost($adsetId, [
                    'targeting' => json_encode($newTargeting, JSON_UNESCAPED_UNICODE),
                ], $token);
                if (empty($updateRes['error'])) {
                    $targetingMode = 'advantage_plus_2layer_with_exclusions';
                    $advisory = 'Campaign sử dụng Advantage+ Audience (#1359202): đã áp dụng đầy đủ 2-Layer AND + Độ tuổi 26-50 + Toàn bộ Exclusion (Page Save 365d, Junk/Lost, Enrolled, Form 90d). Meta khóa gắn Lookalike include in-place trên Advantage+ Leads; để chạy Lookalike làm hard control cần nhân bản sang Campaign Manual Leads.';
                }
            }
        }

        // 4. Optionally try binding CRM pixel (`583807401361847`) on Lead AdSet promoted_object (`onsite_crm`) if requested
        $promotedObjectRes = null;
        if ($tryCrmPromotedObject) {
            $crmPixel = $settings['meta_pixel_id'] ?: CapiHelper::DEFAULT_CRM_PIXEL_ID;
            $curPromo = is_array($before['promoted_object'] ?? null) ? $before['promoted_object'] : ['page_id' => CapiHelper::DEFAULT_PAGE_ID];
            $newPromo = array_merge($curPromo, [
                'pixel_id'                        => $crmPixel,
                'lead_ads_form_event_source_type' => 'onsite_crm',
                'smart_pse_enabled'               => false,
            ]);
            unset($newPromo['custom_event_type']);
            $promotedObjectRes = self::graphPost($adsetId, [
                'promoted_object' => json_encode($newPromo, JSON_UNESCAPED_UNICODE),
            ], $token);
        }

        $after = self::graphGet($adsetId, [
            'fields' => 'id,name,status,effective_status,campaign_id,optimization_goal,promoted_object,targeting',
        ], $token);

        return [
            'adset_id'               => $adsetId,
            'before'                 => $before,
            'targeting_mode'         => $targetingMode,
            'advisory'               => $advisory,
            'targeting_update'       => $updateRes,
            'promoted_object_update' => $promotedObjectRes,
            'after'                  => $after,
            'success'                => empty($updateRes['error']),
        ];
    }

    /**
     * Sync `capi_blocked_phones` into Meta Custom Audience (`MYERP - Loai Tru Phone Farm / Rac`).
     * Uses SHA-256 `PHONE` schema & 10,000-row Meta resumable session chunks for fast 128k+ uploads.
     */
    public static function syncPhoneFarmAudience(PDO $db, int $tenantId = 1, bool $forceReupload = false): array
    {
        CapiHelper::ensurePhoneFarmTable($db);
        $settings = CapiHelper::getSettings($db);
        $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
        $token = $settings['access_token'];
        if ($token === '') {
            throw new \RuntimeException('Không tìm thấy Meta Access Token hợp lệ để đồng bộ Phone Farm.');
        }

        $stmt = $db->prepare('SELECT phone_normalized FROM `capi_blocked_phones` WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY id ASC');
        $stmt->execute([$tenantId]);
        $phones = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $totalPhones = count($phones);

        $existingRes = self::graphGet("act_{$adAccountId}/customaudiences", [
            'fields' => 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound',
            'limit'  => 200,
        ], $token);
        if (!empty($existingRes['error']['message'])) {
            throw new \RuntimeException('Meta API Error: ' . $existingRes['error']['message']);
        }
        $audienceId = '';
        $createdNow = false;
        foreach (($existingRes['data'] ?? []) as $aud) {
            if (($aud['name'] ?? '') === self::AUD_EXCL_PHONE_FARM && !empty($aud['id'])) {
                $audienceId = (string)$aud['id'];
                break;
            }
        }

        if ($totalPhones === 0) {
            return [
                'name'           => self::AUD_EXCL_PHONE_FARM,
                'id'             => $audienceId !== '' ? $audienceId : null,
                'eligible_rows'  => 0,
                'uploaded_rows'  => 0,
                'skipped'        => true,
            ];
        }

        if ($audienceId === '') {
            $cRes = self::graphPost("act_{$adAccountId}/customaudiences", [
                'name'                 => self::AUD_EXCL_PHONE_FARM,
                'subtype'              => 'CUSTOM',
                'description'          => 'Exclusion: Phone Farm / Click-Fraud Blacklist (L1ABC rac & MYERP)',
                'customer_file_source' => 'PARTNER_PROVIDED_ONLY',
            ], $token);
            if (empty($cRes['id'])) {
                throw new \RuntimeException('Không tạo được Custom Audience Phone Farm: ' . ($cRes['error']['message'] ?? json_encode($cRes)));
            }
            $audienceId = (string)$cRes['id'];
            $createdNow = true;
        }

        $sig = hash('sha256', $adAccountId . ':' . $audienceId . ':' . $totalPhones . ':' . $phones[0] . ':' . $phones[$totalPhones - 1]);
        $cachedSig = '';
        $tidPf = max(1, (int)($GLOBALS['current_tenant_id'] ?? 1));
        try {
            require_once __DIR__ . '/TenantConfigService.php';
            $cachedSig = (string)TenantConfigService::getSetting($db, $tidPf, 'capi_phone_farm_sync_sig', '');
        } catch (\Throwable $e) {
            // Optional setting check
        }

        if (!$forceReupload && !$createdNow && $cachedSig !== '' && hash_equals($cachedSig, $sig)) {
            return [
                'name'          => self::AUD_EXCL_PHONE_FARM,
                'id'            => $audienceId,
                'created'       => false,
                'cached'        => true,
                'eligible_rows' => $totalPhones,
                'uploaded_rows' => 0,
            ];
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(300);
        }

        $hashedRows = [];
        foreach ($phones as $p) {
            $clean = trim((string)$p);
            if ($clean !== '') {
                $hashedRows[] = [hash('sha256', $clean)];
            }
        }

        $totalUploaded = 0;
        $totalReceived = 0;
        $totalInvalid = 0;
        $uploadErr = null;
        $sessionId = random_int(100000000, 2147483647);
        $chunks = array_chunk($hashedRows, 10000);
        $numBatches = count($chunks);

        foreach ($chunks as $idx => $chunk) {
            $postBody = [
                'payload' => json_encode([
                    'schema' => ['PHONE'],
                    'data'   => $chunk,
                ]),
            ];
            if ($numBatches > 1) {
                $postBody['session'] = json_encode([
                    'session_id'          => $sessionId,
                    'batch_seq'           => $idx + 1,
                    'last_batch_flag'     => ($idx === $numBatches - 1),
                    'estimated_num_total' => count($hashedRows),
                ]);
            }
            $uRes = self::graphPost("{$audienceId}/users", $postBody, $token, 60);
            if (!empty($uRes['error']['message'])) {
                $uploadErr = $uRes['error']['message'];
                break;
            }
            $totalUploaded += count($chunk);
            $totalReceived += (int)($uRes['num_received'] ?? 0);
            $totalInvalid += (int)($uRes['num_invalid_entries'] ?? 0);
        }

        if ($uploadErr === null) {
            try {
                require_once __DIR__ . '/TenantConfigService.php';
                $nowIso = date('Y-m-d H:i:s');
                TenantConfigService::saveSettings($db, $tidPf, [
                    'capi_phone_farm_audience_id'    => $audienceId,
                    'capi_phone_farm_sync_sig'       => $sig,
                    'capi_phone_farm_last_synced_at' => $nowIso,
                ]);
            } catch (\Throwable $e) {
                error_log('MetaPlaybookService::syncPhoneFarmAudience cache save error: ' . $e->getMessage());
            }
        }

        return [
            'name'                => self::AUD_EXCL_PHONE_FARM,
            'id'                  => $audienceId,
            'created'             => $createdNow,
            'cached'              => false,
            'batches'             => $numBatches,
            'eligible_rows'       => count($hashedRows),
            'uploaded_rows'       => $totalUploaded,
            'num_received'        => $totalReceived,
            'num_invalid_entries' => $totalInvalid,
            'error'               => $uploadErr,
        ];
    }

    /**
     * Append Exclusion Custom Audiences onto an AdSet without altering its existing positive targeting.
     */
    public static function attachExclusionsPreservingTargeting(PDO $db, string $adsetId, array $exclusionAuds): array
    {
        $adsetId = preg_replace('/[^0-9]/', '', $adsetId);
        if ($adsetId === '') {
            throw new \InvalidArgumentException('AdSet ID không hợp lệ.');
        }

        $settings = CapiHelper::getSettings($db);
        $token = $settings['access_token'];
        if ($token === '') {
            throw new \RuntimeException('Thiếu Meta Access Token.');
        }

        $before = self::graphGet($adsetId, [
            'fields' => 'id,name,status,effective_status,targeting',
        ], $token);
        if (!empty($before['error']['message'])) {
            throw new \RuntimeException("Không đọc được AdSet {$adsetId}: " . $before['error']['message']);
        }

        $newTargeting = is_array($before['targeting'] ?? null) ? $before['targeting'] : [];
        $mergedExcl = [];
        $seen = [];

        foreach (($newTargeting['excluded_custom_audiences'] ?? []) as $oldEx) {
            $id = trim((string)($oldEx['id'] ?? ''));
            if ($id !== '' && !isset($seen[$id])) {
                $seen[$id] = true;
                $mergedExcl[] = ['id' => $id, 'name' => (string)($oldEx['name'] ?? '')];
            }
        }
        foreach ($exclusionAuds as $addEx) {
            $id = trim((string)($addEx['id'] ?? ''));
            if ($id !== '' && !isset($seen[$id])) {
                $seen[$id] = true;
                $mergedExcl[] = ['id' => $id, 'name' => (string)($addEx['name'] ?? '')];
            }
        }

        $newTargeting['excluded_custom_audiences'] = array_values($mergedExcl);

        $updateRes = self::graphPost($adsetId, [
            'targeting' => json_encode($newTargeting, JSON_UNESCAPED_UNICODE),
        ], $token);

        if (!empty($updateRes['error']) && (int)($updateRes['error']['error_subcode'] ?? 0) === 1359202) {
            $normTargeting = $newTargeting;
            if (!empty($normTargeting['targeting_automation']['advantage_audience'])) {
                $normTargeting['targeting_automation'] = [
                    'advantage_audience' => 1,
                    'individual_setting' => ['geo' => 0],
                ];
            }
            $updateRes = self::graphPost($adsetId, [
                'targeting' => json_encode($normTargeting, JSON_UNESCAPED_UNICODE),
            ], $token);
        }

        $after = self::graphGet($adsetId, [
            'fields' => 'id,name,status,effective_status,targeting',
        ], $token);

        return [
            'adset_id'         => $adsetId,
            'targeting_update' => $updateRes,
            'before_excl'      => count($before['targeting']['excluded_custom_audiences'] ?? []),
            'after_excl'       => count($after['targeting']['excluded_custom_audiences'] ?? []),
            'after'            => $after,
            'success'          => empty($updateRes['error']),
        ];
    }

    /**
     * Query CRM contacts + approved deposit LTV values for a given Playbook segment.
     */
    private static function queryAudienceSegment(PDO $db, string $segment, int $minOrder): array
    {
        $baseWhere = "c.deleted_at IS NULL AND COALESCE(c.is_error_ticket, 0) = 0";
        $havingNonEmptyContact = "(
            (c.phone IS NOT NULL AND TRIM(c.phone) != '')
            OR (c.email IS NOT NULL AND TRIM(c.email) != '')
        )";

        switch ($segment) {
            case 'vip_enrolled':
                $sql = "
                    SELECT c.id, c.full_name, c.phone, c.phone2, c.zalo_phone, c.email, c.city,
                           GREATEST(
                               COALESCE((SELECT SUM(d.price) FROM deposits d WHERE d.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'approved' AND d.price > 0), 0),
                               COALESCE(NULLIF(c.total_spent, 0), 0),
                               COALESCE(NULLIF(c.expected_revenue, 0), 0)
                           ) AS ltv_value
                    FROM contacts c
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    WHERE {$baseWhere} AND {$havingNonEmptyContact}
                      AND (
                          ps.is_won = 1
                          OR ps.system_slug IN ('deposit_tuition_payment', 'enrolled')
                          OR EXISTS (SELECT 1 FROM deposits d2 WHERE d2.contact_id = c.id AND d2.deleted_at IS NULL AND d2.status = 'approved' AND d2.price > 0)
                      )
                    ORDER BY ltv_value DESC, c.id DESC
                ";
                return $db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

            case 'fb_quality':
                $sql = "
                    SELECT c.id, c.full_name, c.phone, c.phone2, c.zalo_phone, c.email, c.city, 0 AS ltv_value
                    FROM contacts c
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    WHERE {$baseWhere} AND {$havingNonEmptyContact}
                      AND COALESCE(c.lead_status, 'active') != 'lost'
                      AND COALESCE(ps.is_lost, 0) = 0
                      AND ps.order_index >= ?
                      AND (
                          (c.meta_lead_id IS NOT NULL AND TRIM(c.meta_lead_id) != '')
                          OR LOWER(COALESCE(c.source, '')) LIKE '%facebook%'
                          OR LOWER(COALESCE(c.source, '')) LIKE '%meta%'
                          OR LOWER(COALESCE(c.source, '')) LIKE '%fb%'
                          OR LOWER(COALESCE(c.source, '')) LIKE '%ig%'
                          OR EXISTS (SELECT 1 FROM contact_meta_attribution cma WHERE cma.contact_id = c.id AND cma.deleted_at IS NULL)
                      )
                    ORDER BY c.id DESC
                ";
                $stmt = $db->prepare($sql);
                $stmt->execute([$minOrder]);
                return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            case 'all_quality':
                $sql = "
                    SELECT c.id, c.full_name, c.phone, c.phone2, c.zalo_phone, c.email, c.city, 0 AS ltv_value
                    FROM contacts c
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    WHERE {$baseWhere} AND {$havingNonEmptyContact}
                      AND COALESCE(c.lead_status, 'active') != 'lost'
                      AND COALESCE(ps.is_lost, 0) = 0
                      AND ps.order_index >= ?
                    ORDER BY c.id DESC
                ";
                $stmt = $db->prepare($sql);
                $stmt->execute([$minOrder]);
                return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            case 'junk_lost':
                $sql = "
                    SELECT c.id, c.full_name, c.phone, c.phone2, c.zalo_phone, c.email, c.city, 0 AS ltv_value
                    FROM contacts c
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    WHERE c.deleted_at IS NULL AND {$havingNonEmptyContact}
                      AND (
                          c.lead_status = 'lost'
                          OR COALESCE(c.is_error_ticket, 0) = 1
                          OR COALESCE(ps.is_lost, 0) = 1
                          OR COALESCE(ps.system_slug, '') IN ('lost', 'not_lead', 'spam', 'churned')
                      )
                    ORDER BY c.id DESC
                ";
                return $db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
        return [];
    }

    /**
     * Find or create a Customer File Custom Audience, then upload hashed rows in 5,000-row batches.
     */
    private static function ensureAndUploadCustomAudience(
        string $adAccountId,
        string $token,
        array &$byName,
        string $name,
        array $rows,
        bool $isValueBased,
        string $description
    ): array {
        $existing = $byName[$name] ?? null;
        $audienceId = $existing ? (string)$existing['id'] : '';
        $createdNow = false;

        if ($audienceId === '') {
            $createParams = [
                'name'                 => $name,
                'subtype'              => 'CUSTOM',
                'description'          => $description,
                'customer_file_source' => 'PARTNER_PROVIDED_ONLY',
            ];
            if ($isValueBased) {
                $createParams['is_value_based'] = '1';
            }
            $cRes = self::graphPost("act_{$adAccountId}/customaudiences", $createParams, $token);
            if (!empty($cRes['id'])) {
                $audienceId = (string)$cRes['id'];
                $createdNow = true;
                $byName[$name] = ['id' => $audienceId, 'name' => $name];
            } else {
                return [
                    'name'   => $name,
                    'id'     => null,
                    'error'  => $cRes['error']['message'] ?? json_encode($cRes),
                ];
            }
        }

        // Format rows strictly per Meta schema
        $schema = $isValueBased
            ? ['EMAIL', 'PHONE', 'FN', 'LN', 'CT', 'COUNTRY', 'EXTERN_ID', 'LOOKALIKE_VALUE']
            : ['EMAIL', 'PHONE', 'FN', 'LN', 'CT', 'COUNTRY', 'EXTERN_ID'];

        $formattedData = [];
        $countryHash = hash('sha256', 'vn');

        foreach ($rows as $r) {
            $normEmail = CapiHelper::normalizeEmail($r['email'] ?? '');
            $normPhone = CapiHelper::normalizePhone($r['phone'] ?? '')
                ?? CapiHelper::normalizePhone($r['phone2'] ?? '')
                ?? CapiHelper::normalizePhone($r['zalo_phone'] ?? '');
            if ($normEmail === null && $normPhone === null) {
                continue;
            }
            $nameParts = CapiHelper::splitFullName($r['full_name'] ?? '');
            $normCity = CapiHelper::normalizeCity($r['city'] ?? '');

            $rowTuple = [
                $normEmail !== null ? hash('sha256', $normEmail) : '',
                $normPhone !== null ? hash('sha256', $normPhone) : '',
                $nameParts['fn'] !== null ? hash('sha256', $nameParts['fn']) : '',
                $nameParts['ln'] !== null ? hash('sha256', $nameParts['ln']) : '',
                $normCity !== null ? hash('sha256', $normCity) : '',
                $countryHash,
                'myerp_c_' . (int)$r['id'],
            ];
            if ($isValueBased) {
                $ltv = (float)($r['ltv_value'] ?? 0);
                // Meta Value-Based needs non-negative numeric values; give base weight 1000000 for enrolled w/o deposit row
                $rowTuple[] = $ltv > 0 ? round($ltv, 2) : 1000000.0;
            }
            $formattedData[] = $rowTuple;
        }

        $totalUploaded = 0;
        $totalReceived = 0;
        $totalInvalid = 0;
        $uploadErr = null;
        $sessionId = random_int(100000000, 99999999999);
        $chunks = array_chunk($formattedData, 5000);
        $numBatches = count($chunks);

        foreach ($chunks as $idx => $chunk) {
            $payload = [
                'schema' => $schema,
                'data'   => $chunk,
            ];
            $postBody = [
                'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            ];
            if ($numBatches > 1) {
                $postBody['session'] = json_encode([
                    'session_id'       => $sessionId,
                    'batch_seq'        => $idx + 1,
                    'last_batch_flag'  => ($idx === $numBatches - 1),
                    'estimated_num_total' => count($formattedData),
                ]);
            }
            $uRes = self::graphPost("{$audienceId}/users", $postBody, $token);
            if (!empty($uRes['error']['message'])) {
                $uploadErr = $uRes['error']['message'];
                break;
            }
            $totalUploaded += count($chunk);
            $totalReceived += (int)($uRes['num_received'] ?? 0);
            $totalInvalid += (int)($uRes['num_invalid_entries'] ?? 0);
        }

        return [
            'name'                => $name,
            'id'                  => $audienceId,
            'created'             => $createdNow,
            'is_value_based'      => $isValueBased,
            'eligible_rows'       => count($formattedData),
            'uploaded_rows'       => $totalUploaded,
            'num_received'        => $totalReceived,
            'num_invalid_entries' => $totalInvalid,
            'error'               => $uploadErr,
        ];
    }

    /**
     * Create Page Post Saver 365d engagement audience (`page_post_save`).
     */
    private static function ensurePagePostSaveAudience(string $adAccountId, string $token, array &$byName, string $pageId, string $name): array
    {
        if (!empty($byName[$name]['id'])) {
            return ['name' => $name, 'id' => (string)$byName[$name]['id'], 'created' => false];
        }
        $rule = [
            'inclusions' => [
                'operator' => 'or',
                'rules'    => [
                    [
                        'event_sources' => [
                            ['id' => $pageId, 'type' => 'page'],
                        ],
                        'retention_seconds' => 31536000,
                        'filter'            => [
                            'operator' => 'and',
                            'filters'  => [
                                [
                                    'field'    => 'event',
                                    'operator' => 'eq',
                                    'value'    => 'page_post_save',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
        $res = self::graphPost("act_{$adAccountId}/customaudiences", [
            'name'        => $name,
            'description' => "Exclusion: Users who saved posts on Page {$pageId} in last 365 days (Playbook Sect IV)",
            'rule'        => json_encode($rule),
            'prefill'     => 'true',
        ], $token);

        if (!empty($res['id'])) {
            $byName[$name] = ['id' => (string)$res['id'], 'name' => $name];
            return ['name' => $name, 'id' => (string)$res['id'], 'created' => true];
        }
        return ['name' => $name, 'id' => null, 'error' => $res['error']['message'] ?? json_encode($res)];
    }

    /**
     * Create Lookalike Audience (`ratio: 0.01` OR `custom_ratio` `[0.01 .. 0.03]`).
     */
    private static function ensureLookalikeAudience(
        string $adAccountId,
        string $token,
        array &$byName,
        string $name,
        string $originAudienceId,
        string $country,
        float $ratio,
        ?float $startingRatio = null
    ): array {
        if (!empty($byName[$name]['id'])) {
            return ['name' => $name, 'id' => (string)$byName[$name]['id'], 'created' => false];
        }

        $spec = $startingRatio !== null
            ? ['type' => 'custom_ratio', 'country' => $country, 'starting_ratio' => $startingRatio, 'ratio' => $ratio]
            : ['type' => 'similarity', 'country' => $country, 'ratio' => $ratio];

        $res = self::graphPost("act_{$adAccountId}/customaudiences", [
            'name'               => $name,
            'subtype'            => 'LOOKALIKE',
            'origin_audience_id' => $originAudienceId,
            'lookalike_spec'     => json_encode($spec),
        ], $token);

        if (!empty($res['id'])) {
            $byName[$name] = ['id' => (string)$res['id'], 'name' => $name];
            return ['name' => $name, 'id' => (string)$res['id'], 'created' => true, 'origin_audience_id' => $originAudienceId];
        }
        return [
            'name'               => $name,
            'id'                 => null,
            'origin_audience_id' => $originAudienceId,
            'error'              => $res['error']['message'] ?? json_encode($res),
        ];
    }

    private static function getMinOrderIndex(PDO $db, int $tenantId, string $minSlug): int
    {
        foreach (CapiHelper::getPipelineStages($db, $tenantId) as $s) {
            if (trim((string)($s['system_slug'] ?? '')) === $minSlug) {
                return (int)$s['order_index'];
            }
        }
        return 3;
    }

    private static function sumSegmentValue(array $rows): float
    {
        $sum = 0.0;
        foreach ($rows as $r) {
            $sum += (float)($r['ltv_value'] ?? 0);
        }
        return round($sum, 2);
    }

    public static function graphGet(string $path, array $query, string $token): array
    {
        $query['access_token'] = $token;
        $url = 'https://graph.facebook.com/' . CapiHelper::GRAPH_API_VERSION . '/' . ltrim($path, '/') . '?' . http_build_query($query);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : ['error' => ['message' => $err ?: 'Empty Graph GET response']];
    }

    public static function graphPost(string $path, array $params, string $token, int $timeout = 30): array
    {
        $params['access_token'] = $token;
        $url = 'https://graph.facebook.com/' . CapiHelper::GRAPH_API_VERSION . '/' . ltrim($path, '/');
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($params),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => max(10, $timeout),
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : ['error' => ['message' => $err ?: 'Empty Graph POST response']];
    }
}
