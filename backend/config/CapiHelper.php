<?php
/**
 * backend/config/CapiHelper.php
 *
 * Enterprise Meta Conversions API (CAPI) Engine for MYERP:
 * - Uses Dashboard Meta Ads Token via MetaAdsController::resolveMetaCredentials($db) by default.
 * - Dual-Pixel routing: CRM Lead Ads / Offline Quality -> Pixel 583807401361847 (`system_generated`),
 *   Web attribution (`fbc`/`fbp`) -> Pixel 661260709828887 (`website` / `system_generated`).
 * - Quality Funnel Gate: Only fires conversion signals from `04 - Needed` (`order_index >= 3`) upward;
 *   never pollutes Pixel with New Lead / Connected / Lost / Junk / BAD events.
 * - Strict EMQ PII normalization & SHA-256 hashing (`ph`, `em`, `fn`, `ln`, `ct`, `ge`, `db`, `country`, `external_id`)
 *   + valid 15-17 digit `meta_lead_id` + stored landing `_fbc`/`_fbp`/customer IP+UA (NEVER CRM sales rep IP/UA).
 * - Value-aware Purchase deduplication (`dep_{deposit_id}` / upgraded non-zero VNĐ value).
 * - 7-day Meta-compliant historical CAPI Backfill engine.
 */

require_once __DIR__ . '/Database.php';

class CapiHelper
{
    public const GRAPH_API_VERSION = 'v21.0';
    public const DEFAULT_CRM_PIXEL_ID = '583807401361847';
    public const DEFAULT_WEB_PIXEL_ID = '661260709828887';
    public const DEFAULT_AD_ACCOUNT_ID = '1852318231510577';
    public const DEFAULT_PAGE_ID = '860714080649450';
    public const MAX_CAPI_BACKFILL_SECONDS = 604200; // 7 days minus 10 min safety buffer

    public const DEFAULT_STAGE_TRIGGERS = [
        'new_lead'                => 'Skip',
        'contact_attempted'       => 'Skip',
        'connected'               => 'Skip',
        'needed'                  => 'Lead',
        'discovery_completed'     => 'Schedule',
        'program_matched'         => 'ViewContent',
        'proposal_sent'           => 'Schedule',
        'evaluation_objection'    => 'Skip',
        'application_started'     => 'SubmitApplication',
        'application_completed'   => 'SubmitApplication',
        'admission_approved'      => 'SubmitApplication',
        'offer_accepted'          => 'SubmitApplication',
        'deposit_tuition_payment' => 'Purchase',
        'enrolled'                => 'Purchase',
        'lost'                    => 'Skip',
        'not_lead'                => 'Skip',
        'spam'                    => 'Skip',
        'churned'                 => 'Skip',
    ];

    private static ?array $capiLogsColumnsCache = null;
    private static ?array $cmaColumnsCache = null;
    private static bool $phoneFarmTableEnsured = false;

    /**
     * Resolve active PDO connection cleanly whether caller passed PDO or null.
     */
    public static function ensureDb(?PDO $db = null): PDO
    {
        if ($db instanceof PDO) {
            return $db;
        }
        $rawConn = Database::getInstance();
        $conn = ($rawConn instanceof PDO)
            ? $rawConn
            : (method_exists($rawConn, 'getConnection') ? $rawConn->getConnection() : null);
        if (!($conn instanceof PDO)) {
            throw new \RuntimeException('Database connection unavailable in CapiHelper');
        }
        return $conn;
    }

    /**
     * Load normalized CAPI settings & Dashboard Meta Ads Token.
     */
    public static function getSettings(?PDO $db = null): array
    {
        $db = self::ensureDb($db);
        $raw = [];
        try {
            $keys = [
                'meta_pixel_id',
                'meta_web_pixel_id',
                'meta_ad_account_id',
                'meta_access_token',
                'capi_access_token',
                'capi_event_triggers',
                'capi_source_mode',
                'capi_quality_min_stage',
                'capi_dual_pixel_enabled',
                'capi_test_event_code',
            ];
            require_once __DIR__ . '/TenantConfigService.php';
            $tid = (int)($GLOBALS['current_tenant_id'] ?? 1);
            $allTenantSettings = TenantConfigService::getSettings($db, $tid);
            foreach ($keys as $k) {
                $raw[$k] = (string)($allTenantSettings[$k] ?? '');
            }
        } catch (\Throwable $e) {
            error_log('CapiHelper::getSettings read error: ' . $e->getMessage());
        }

        // Resolve Dashboard Meta Ads Token (`vhvxoigh_meta.saas_tenants slug='ideas'` first)
        $dashboardToken = '';
        $dashboardAccountId = self::DEFAULT_AD_ACCOUNT_ID;
        try {
            if (!class_exists('MetaAdsController')) {
                $ctrlFile = __DIR__ . '/../controllers/MetaAdsController.php';
                if (is_file($ctrlFile)) {
                    require_once $ctrlFile;
                }
            }
            if (class_exists('MetaAdsController')) {
                $creds = MetaAdsController::resolveMetaCredentials($db);
                $dashboardToken = trim((string)($creds['token'] ?? ''));
                if (!empty($creds['account_id'])) {
                    $dashboardAccountId = preg_replace('/[^0-9]/', '', (string)$creds['account_id']);
                }
            }
        } catch (\Throwable $e) {
            error_log('CapiHelper::getSettings MetaAdsController token error: ' . $e->getMessage());
        }

        $capiOverrideToken = trim((string)($raw['capi_access_token'] ?? ''));
        $settingsMetaToken = trim((string)($raw['meta_access_token'] ?? ''));
        $tokenSource = 'dashboard_meta_ads';
        $activeToken = $dashboardToken;

        if (strlen($capiOverrideToken) > 30 && strpos($capiOverrideToken, '***') === false) {
            $activeToken = $capiOverrideToken;
            $tokenSource = 'custom_capi_token';
        } elseif ($activeToken === '' && strlen($settingsMetaToken) > 30 && strpos($settingsMetaToken, '***') === false) {
            $activeToken = $settingsMetaToken;
            $tokenSource = 'system_settings';
        }

        $crmPixel = preg_replace('/[^0-9]/', '', (string)($raw['meta_pixel_id'] ?? ''));
        if ($crmPixel === '') {
            $crmPixel = self::DEFAULT_CRM_PIXEL_ID;
        }
        $webPixel = preg_replace('/[^0-9]/', '', (string)($raw['meta_web_pixel_id'] ?? ''));
        if ($webPixel === '') {
            $webPixel = self::DEFAULT_WEB_PIXEL_ID;
        }
        $adAccount = preg_replace('/[^0-9]/', '', (string)($raw['meta_ad_account_id'] ?? ''));
        if ($adAccount === '' || $adAccount === '2263916290803530') {
            $adAccount = $dashboardAccountId ?: self::DEFAULT_AD_ACCOUNT_ID;
        }

        $triggers = self::normalizeTriggersJson($raw['capi_event_triggers'] ?? '');
        $sourceMode = trim((string)($raw['capi_source_mode'] ?? 'all_quality'));
        if (!in_array($sourceMode, ['all_quality', 'meta_only'], true)) {
            $sourceMode = 'all_quality';
        }
        $minStage = trim((string)($raw['capi_quality_min_stage'] ?? 'needed'));
        if ($minStage === '') {
            $minStage = 'needed';
        }
        $dualPixelRaw = (string)($raw['capi_dual_pixel_enabled'] ?? '1');
        $dualPixel = !in_array(strtolower($dualPixelRaw), ['0', 'false', 'off', 'no'], true);

        return [
            'meta_pixel_id'           => $crmPixel,
            'meta_web_pixel_id'       => $webPixel,
            'meta_ad_account_id'      => $adAccount,
            'access_token'            => $activeToken,
            'token_source'            => $tokenSource,
            'capi_access_token'       => $capiOverrideToken,
            'capi_event_triggers'     => $triggers,
            'capi_source_mode'        => $sourceMode,
            'capi_quality_min_stage'  => $minStage,
            'capi_dual_pixel_enabled' => $dualPixel,
            'capi_test_event_code'    => trim((string)($raw['capi_test_event_code'] ?? '')),
        ];
    }

    /**
     * Merge saved trigger map cleanly with Education 14-stage defaults (migrating legacy real-estate keys).
     */
    public static function normalizeTriggersJson(?string $rawJson): array
    {
        $decoded = is_string($rawJson) && trim($rawJson) !== '' ? json_decode($rawJson, true) : null;
        if (!is_array($decoded)) {
            return self::DEFAULT_STAGE_TRIGGERS;
        }

        // Detect legacy real-estate keys without any Education slug -> return clean Education defaults
        $hasEduSlug = isset($decoded['needed']) || isset($decoded['new_lead']) || isset($decoded['enrolled']);
        if (!$hasEduSlug) {
            return self::DEFAULT_STAGE_TRIGGERS;
        }

        $merged = self::DEFAULT_STAGE_TRIGGERS;
        foreach ($decoded as $k => $v) {
            $cleanKey = trim((string)$k);
            $cleanVal = trim((string)$v);
            if ($cleanKey === '') {
                continue;
            }
            // Never permit legacy 'BAD' event to be sent to Meta Pixel
            $merged[$cleanKey] = ($cleanVal === '' || strtoupper($cleanVal) === 'BAD') ? 'Skip' : $cleanVal;
        }
        return $merged;
    }

    /**
     * Load tenant pipeline stages ordered by order_index ASC for accurate quality gating.
     */
    public static function getPipelineStages(PDO $db, int $tenantId = 1): array
    {
        $stmt = $db->prepare("
            SELECT id, tenant_id, name, color, order_index, is_won, is_lost, system_slug
            FROM pipeline_stages
            WHERE tenant_id = ?
            ORDER BY order_index ASC, id ASC
        ");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (empty($rows) && $tenantId !== 1) {
            $stmt->execute([1]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
        return $rows;
    }

    /**
     * Resolve exact Meta CAPI event name for a stage slug / stage_id while enforcing min quality stage guardrail.
     */
    public static function resolveEventForStage(
        PDO $db,
        ?string $stageSlug,
        ?int $stageId = null,
        int $tenantId = 1,
        ?array $settings = null
    ): array {
        $settings = $settings ?? self::getSettings($db);
        $stages = self::getPipelineStages($db, $tenantId);
        $minStageSlug = (string)($settings['capi_quality_min_stage'] ?? 'needed');

        $minOrderIndex = 3; // Default `04 - Needed`
        $matchedStage = null;
        foreach ($stages as $st) {
            $stSlug = trim((string)($st['system_slug'] ?? ''));
            if ($stSlug === $minStageSlug) {
                $minOrderIndex = (int)$st['order_index'];
            }
            if ($stageId !== null && (int)$st['id'] === $stageId) {
                $matchedStage = $st;
            } elseif ($matchedStage === null && $stageSlug !== null && $stageSlug !== '' && $stSlug === $stageSlug) {
                $matchedStage = $st;
            }
        }

        $effectiveSlug = $matchedStage
            ? trim((string)($matchedStage['system_slug'] ?? $stageSlug ?? ''))
            : trim((string)$stageSlug);

        if (in_array($effectiveSlug, ['lost', 'not_lead', 'spam', 'churned'], true)) {
            return ['event_name' => 'Skip', 'stage_slug' => $effectiveSlug, 'order_index' => -1, 'reason' => 'excluded_lost_stage'];
        }
        if ($matchedStage && (int)($matchedStage['is_lost'] ?? 0) === 1) {
            return ['event_name' => 'Skip', 'stage_slug' => $effectiveSlug, 'order_index' => (int)$matchedStage['order_index'], 'reason' => 'stage_is_lost'];
        }
        if ($matchedStage && (int)$matchedStage['order_index'] < $minOrderIndex) {
            return [
                'event_name'  => 'Skip',
                'stage_slug'  => $effectiveSlug,
                'order_index' => (int)$matchedStage['order_index'],
                'reason'      => "below_min_quality_stage ({$effectiveSlug} < {$minStageSlug})",
            ];
        }

        $triggers = $settings['capi_event_triggers'] ?? self::DEFAULT_STAGE_TRIGGERS;
        $eventName = trim((string)($triggers[$effectiveSlug] ?? 'Skip'));
        if ($eventName === '' || strtoupper($eventName) === 'BAD' || strcasecmp($eventName, 'Skip') === 0) {
            $eventName = 'Skip';
        }

        return [
            'event_name'  => $eventName,
            'stage_slug'  => $effectiveSlug,
            'order_index' => $matchedStage ? (int)$matchedStage['order_index'] : null,
            'reason'      => $eventName === 'Skip' ? 'configured_skip' : 'qualified',
        ];
    }

    /**
     * Resolve total approved deposit / tuition value (VNĐ) for Purchase events.
     */
    public static function resolveBestPurchaseValue(PDO $db, int $contactId, float $explicitValue = 0.0): float
    {
        if ($explicitValue > 0) {
            return round($explicitValue, 2);
        }
        try {
            $stmt = $db->prepare("
                SELECT COALESCE(SUM(price), 0)
                FROM deposits
                WHERE contact_id = ? AND deleted_at IS NULL AND status = 'approved' AND price > 0
            ");
            $stmt->execute([$contactId]);
            $approvedTotal = (float)$stmt->fetchColumn();
            if ($approvedTotal > 0) {
                return round($approvedTotal, 2);
            }

            $stmtLatest = $db->prepare("
                SELECT price
                FROM deposits
                WHERE contact_id = ? AND deleted_at IS NULL AND status != 'cancelled' AND price > 0
                ORDER BY id DESC LIMIT 1
            ");
            $stmtLatest->execute([$contactId]);
            $latest = (float)$stmtLatest->fetchColumn();
            if ($latest > 0) {
                return round($latest, 2);
            }

            $stmtContact = $db->prepare("SELECT total_spent, expected_revenue FROM contacts WHERE id = ? LIMIT 1");
            $stmtContact->execute([$contactId]);
            $cRow = $stmtContact->fetch(PDO::FETCH_ASSOC);
            if ($cRow) {
                if ((float)($cRow['total_spent'] ?? 0) > 0) {
                    return round((float)$cRow['total_spent'], 2);
                }
                if ((float)($cRow['expected_revenue'] ?? 0) > 0) {
                    return round((float)$cRow['expected_revenue'], 2);
                }
            }
        } catch (\Throwable $e) {
            error_log('CapiHelper::resolveBestPurchaseValue error: ' . $e->getMessage());
        }
        return 0.0;
    }

    /**
     * Normalize Vietnamese / international phone to digits-only E.164 (`84...`), returning null if invalid.
     */
    public static function normalizePhone(?string $raw): ?string
    {
        $digits = preg_replace('/[^0-9]/', '', (string)$raw);
        if ($digits === '' || strlen($digits) < 9 || strlen($digits) > 15) {
            return null;
        }
        // Recover doubled Vietnam prefix (`+84` + `84xxxxxxxxx`, 13-14 digits) without touching 11-digit Vinaphone `8484xxxxxxx`
        if (strpos($digits, '8484') === 0 && strlen($digits) >= 13 && strlen($digits) <= 14) {
            $digits = '84' . substr($digits, 4);
        }
        if (strpos($digits, '840') === 0 && strlen($digits) >= 11) {
            $digits = '84' . substr($digits, 3);
        } elseif ($digits[0] === '0' && strlen($digits) >= 9 && strlen($digits) <= 11) {
            $digits = '84' . substr($digits, 1);
        } elseif ($digits[0] !== '0' && strpos($digits, '84') !== 0 && strlen($digits) === 9) {
            $digits = '84' . $digits;
        }
        if (strlen($digits) < 10 || strlen($digits) > 15) {
            return null;
        }
        return $digits;
    }

    /**
     * Ensure `capi_blocked_phones` table exists idempotently once per request.
     */
    public static function ensurePhoneFarmTable(PDO $db): void
    {
        if (self::$phoneFarmTableEnsured) {
            return;
        }
        try {
            $db->exec("
                CREATE TABLE IF NOT EXISTS `capi_blocked_phones` (
                    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    `tenant_id` INT NOT NULL DEFAULT 1,
                    `phone_normalized` VARCHAR(20) NOT NULL COMMENT 'Digits-only E.164 (e.g. 84943316797)',
                    `source_label` VARCHAR(120) NOT NULL DEFAULT 'L1ABC_rac',
                    `reason` VARCHAR(255) NOT NULL DEFAULT 'phone_farm_fraud',
                    `created_by` INT DEFAULT NULL,
                    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
                    UNIQUE KEY `uk_tenant_phone` (`tenant_id`, `phone_normalized`),
                    KEY `idx_capi_bp_tenant_del` (`tenant_id`, `deleted_at`, `source_label`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            self::$phoneFarmTableEnsured = true;
        } catch (\Throwable $e) {
            error_log('CapiHelper::ensurePhoneFarmTable error: ' . $e->getMessage());
        }
    }

    /**
     * Fast indexed lookup whether any phone on the contact is listed in `capi_blocked_phones`.
     */
    public static function isBlockedPhoneFarm(PDO $db, int $tenantId, array $contact): bool
    {
        $candidates = [];
        foreach (['phone', 'phone2', 'zalo_phone', 'mobile'] as $f) {
            $norm = self::normalizePhone((string)($contact[$f] ?? ''));
            if ($norm !== null) {
                $candidates[] = $norm;
            }
        }
        $candidates = array_values(array_unique($candidates));
        if (empty($candidates)) {
            return false;
        }
        try {
            self::ensurePhoneFarmTable($db);
            $placeholders = implode(',', array_fill(0, count($candidates), '?'));
            $stmt = $db->prepare("
                SELECT 1 FROM `capi_blocked_phones`
                WHERE tenant_id = ? AND deleted_at IS NULL AND phone_normalized IN ($placeholders)
                LIMIT 1
            ");
            $stmt->execute(array_merge([$tenantId], $candidates));
            return (bool)$stmt->fetchColumn();
        } catch (\Throwable $e) {
            error_log('CapiHelper::isBlockedPhoneFarm error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Batch-import normalized phone farm numbers into `capi_blocked_phones` (zero N+1, ACID transaction).
     */
    public static function importPhoneFarmBatch(
        PDO $db,
        int $tenantId,
        array $rawPhones,
        string $sourceLabel = 'L1ABC_rac',
        string $reason = 'phone_farm_fraud',
        ?int $createdBy = null
    ): array {
        self::ensurePhoneFarmTable($db);
        $sourceLabel = substr(trim($sourceLabel) !== '' ? trim($sourceLabel) : 'L1ABC_rac', 0, 120);
        $reason = substr(trim($reason) !== '' ? trim($reason) : 'phone_farm_fraud', 0, 255);

        $unique = [];
        foreach ($rawPhones as $rawItem) {
            $str = trim((string)$rawItem);
            if ($str === '') {
                continue;
            }
            $tokens = preg_split('/[,;\s\/]+/', $str) ?: [$str];
            foreach ($tokens as $tok) {
                $norm = self::normalizePhone($tok);
                if ($norm !== null) {
                    $unique[$norm] = true;
                }
            }
        }

        $phones = array_keys($unique);
        $validCount = count($phones);
        if ($validCount === 0) {
            return [
                'received'         => count($rawPhones),
                'valid_normalized' => 0,
                'affected'         => 0,
                'stats'            => self::getPhoneFarmStats($db, $tenantId),
            ];
        }

        $affected = 0;
        $startedTx = !$db->inTransaction();
        if ($startedTx) {
            $db->beginTransaction();
        }
        try {
            foreach (array_chunk($phones, 2000) as $chunk) {
                $rowSql = [];
                $params = [];
                foreach ($chunk as $p) {
                    $rowSql[] = '(?, ?, ?, ?, ?)';
                    $params[] = $tenantId;
                    $params[] = $p;
                    $params[] = $sourceLabel;
                    $params[] = $reason;
                    $params[] = $createdBy;
                }
                $sql = 'INSERT INTO `capi_blocked_phones` (tenant_id, phone_normalized, source_label, reason, created_by) VALUES '
                    . implode(',', $rowSql)
                    . ' ON DUPLICATE KEY UPDATE deleted_at = NULL, source_label = VALUES(source_label), reason = VALUES(reason)';
                $stmt = $db->prepare($sql);
                $stmt->execute(array_values($params));
                $affected += $stmt->rowCount();
            }
            if ($startedTx && $db->inTransaction()) {
                $db->commit();
            }
        } catch (\Throwable $e) {
            if ($startedTx && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }

        return [
            'received'         => count($rawPhones),
            'valid_normalized' => $validCount,
            'affected'         => $affected,
            'stats'            => self::getPhoneFarmStats($db, $tenantId),
        ];
    }

    /**
     * Summarize blocked Phone Farm stats & live Meta audience sync state.
     */
    public static function getPhoneFarmStats(PDO $db, int $tenantId = 1): array
    {
        self::ensurePhoneFarmTable($db);
        $total = 0;
        $bySource = [];
        $lastImportedAt = null;
        try {
            $stmtTotal = $db->prepare('SELECT COUNT(*) FROM `capi_blocked_phones` WHERE tenant_id = ? AND deleted_at IS NULL');
            $stmtTotal->execute([$tenantId]);
            $total = (int)$stmtTotal->fetchColumn();

            $stmtSources = $db->prepare("
                SELECT source_label, COUNT(*) AS cnt, MAX(created_at) AS latest_at
                FROM `capi_blocked_phones`
                WHERE tenant_id = ? AND deleted_at IS NULL
                GROUP BY source_label
                ORDER BY cnt DESC
                LIMIT 20
            ");
            $stmtSources->execute([$tenantId]);
            foreach (($stmtSources->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
                $bySource[] = [
                    'source_label' => (string)$row['source_label'],
                    'count'        => (int)$row['cnt'],
                    'latest_at'    => (string)$row['latest_at'],
                ];
                if ($lastImportedAt === null || (string)$row['latest_at'] > $lastImportedAt) {
                    $lastImportedAt = (string)$row['latest_at'];
                }
            }
        } catch (\Throwable $e) {
            error_log('CapiHelper::getPhoneFarmStats error: ' . $e->getMessage());
        }

        $metaAudienceId = '';
        $lastSyncedAt = null;
        try {
            require_once __DIR__ . '/TenantConfigService.php';
            $tidMeta = max(1, $tenantId);
            $metaAudienceId = trim((string)TenantConfigService::getSetting($db, $tidMeta, 'capi_phone_farm_audience_id', ''));
            $lastSyncedAt = trim((string)TenantConfigService::getSetting($db, $tidMeta, 'capi_phone_farm_last_synced_at', '')) ?: null;
        } catch (\Throwable $e) {
            // Optional telemetry keys
        }

        return [
            'total_blocked'    => $total,
            'by_source'        => $bySource,
            'last_imported_at' => $lastImportedAt,
            'meta_audience_id' => $metaAudienceId !== '' ? $metaAudienceId : null,
            'last_synced_at'   => $lastSyncedAt,
        ];
    }

    /**
     * Normalize email for SHA-256 hashing.
     */
    public static function normalizeEmail(?string $raw): ?string
    {
        $em = strtolower(trim((string)$raw));
        if ($em === '' || !filter_var($em, FILTER_VALIDATE_EMAIL)) {
            return null;
        }
        return $em;
    }

    /**
     * Split Vietnamese full_name cleanly into ['ln' => first-word surname, 'fn' => given/middle name].
     */
    public static function splitFullName(?string $fullName): array
    {
        $clean = preg_replace('/\s+/u', ' ', trim((string)$fullName));
        if ($clean === '') {
            return ['ln' => null, 'fn' => null];
        }
        $parts = explode(' ', mb_strtolower($clean, 'UTF-8'));
        if (count($parts) === 1) {
            return ['ln' => null, 'fn' => $parts[0]];
        }
        $surname = array_shift($parts);
        $given = implode(' ', $parts);
        return ['ln' => $surname !== '' ? $surname : null, 'fn' => $given !== '' ? $given : null];
    }

    /**
     * Normalize city name per Meta lowercase format without prefixes (`tp.`, `tỉnh`).
     */
    public static function normalizeCity(?string $rawCity): ?string
    {
        $ct = mb_strtolower(trim((string)$rawCity), 'UTF-8');
        if ($ct === '') {
            return null;
        }
        $ct = preg_replace('/^(tp\.?|thành phố|tỉnh)\s+/u', '', $ct);
        $ct = preg_replace('/[^\p{L}\p{N}]/u', '', $ct);
        return $ct !== '' ? $ct : null;
    }

    /**
     * Normalize gender to 'm' / 'f'.
     */
    public static function normalizeGender(?string $rawGender): ?string
    {
        $g = mb_strtolower(trim((string)$rawGender), 'UTF-8');
        if ($g === '') {
            return null;
        }
        if (in_array($g, ['m', 'male', 'nam', '1'], true)) {
            return 'm';
        }
        if (in_array($g, ['f', 'female', 'nữ', 'nu', '0', '2'], true)) {
            return 'f';
        }
        return null;
    }

    /**
     * Validate authentic 15-17 digit Meta Leadgen ID (never send CRM numeric leads.id).
     */
    public static function sanitizeMetaLeadId($rawId): ?string
    {
        $s = trim((string)$rawId);
        if ($s === '') {
            return null;
        }
        // Strip accidental `l:` prefix if any
        if (stripos($s, 'l:') === 0) {
            $s = substr($s, 2);
        }
        if (preg_match('/^\d{13,22}$/', $s)) {
            return $s;
        }
        return null;
    }

    /**
     * Fetch full contact + latest attribution row for CAPI matching.
     */
    public static function fetchContactWithAttribution(PDO $db, int $contactId): ?array
    {
        $hasCmaCols = self::getTableColumns($db, 'contact_meta_attribution');
        $cmaSelects = [
            'cma.meta_lead_id AS cma_meta_lead_id',
            'cma.ad_id AS cma_ad_id',
            'cma.adset_id AS cma_adset_id',
            'cma.campaign_id AS cma_campaign_id',
            'cma.platform AS cma_platform',
        ];
        foreach (['fbc', 'fbp', 'client_ip_address', 'client_user_agent', 'event_source_url', 'fb_pixel_id'] as $optCol) {
            $cmaSelects[] = isset($hasCmaCols[$optCol]) ? "cma.`$optCol` AS cma_{$optCol}" : "NULL AS cma_{$optCol}";
        }

        $sql = "
            SELECT
                c.*,
                ps.system_slug AS stage_slug,
                ps.name AS stage_name,
                ps.order_index AS stage_order_index,
                ps.is_lost AS stage_is_lost,
                " . implode(",\n                ", $cmaSelects) . "
            FROM contacts c
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            LEFT JOIN contact_meta_attribution cma ON cma.id = (
                SELECT cma2.id FROM contact_meta_attribution cma2
                WHERE cma2.contact_id = c.id AND cma2.deleted_at IS NULL
                ORDER BY cma2.id DESC LIMIT 1
            )
            WHERE c.id = ?
            LIMIT 1
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([$contactId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        // Also check `leads` table raw_payload if meta_lead_id still empty
        $metaLeadId = self::sanitizeMetaLeadId($row['meta_lead_id'] ?? '')
            ?? self::sanitizeMetaLeadId($row['cma_meta_lead_id'] ?? '');
        if ($metaLeadId === null) {
            try {
                $stmtLead = $db->prepare("
                    SELECT raw_payload FROM leads
                    WHERE deleted_at IS NULL
                      AND (person_id = ? OR (phone IS NOT NULL AND phone != '' AND phone = ?) OR (email IS NOT NULL AND email != '' AND email = ?))
                    ORDER BY id DESC LIMIT 1
                ");
                $stmtLead->execute([
                    (int)($row['person_id'] ?? 0),
                    (string)($row['phone'] ?? ''),
                    (string)($row['email'] ?? ''),
                ]);
                $rawPayload = (string)($stmtLead->fetchColumn() ?: '');
                if ($rawPayload !== '') {
                    $decoded = json_decode($rawPayload, true);
                    if (is_array($decoded)) {
                        $metaLeadId = self::sanitizeMetaLeadId($decoded['meta_lead_id'] ?? $decoded['leadgen_id'] ?? $decoded['id'] ?? '');
                    }
                }
            } catch (\Throwable $e) {
                // Ignore if optional lookup fails
            }
        }
        $row['_resolved_meta_lead_id'] = $metaLeadId;
        return $row;
    }

    /**
     * Build Meta CAPI `user_data` array with SHA-256 PII, valid meta_lead_id, and stored customer web cookies.
     */
    public static function buildUserData(array $contact): array
    {
        $signals = [];
        $userData = [];

        // Phones (primary + secondary + zalo)
        $phoneHashes = [];
        foreach (['phone', 'phone2', 'zalo_phone', 'mobile'] as $pField) {
            $norm = self::normalizePhone($contact[$pField] ?? '');
            if ($norm !== null) {
                $h = hash('sha256', $norm);
                if (!in_array($h, $phoneHashes, true)) {
                    $phoneHashes[] = $h;
                }
            }
        }
        if (!empty($phoneHashes)) {
            $userData['ph'] = count($phoneHashes) === 1 ? [$phoneHashes[0]] : array_slice($phoneHashes, 0, 2);
            $signals[] = 'ph';
        }

        // Email
        $normEmail = self::normalizeEmail($contact['email'] ?? '');
        if ($normEmail !== null) {
            $userData['em'] = [hash('sha256', $normEmail)];
            $signals[] = 'em';
        }

        // Name (ln / fn)
        $nameParts = self::splitFullName($contact['full_name'] ?? '');
        if ($nameParts['fn'] !== null) {
            $userData['fn'] = [hash('sha256', $nameParts['fn'])];
            $signals[] = 'fn';
        }
        if ($nameParts['ln'] !== null) {
            $userData['ln'] = [hash('sha256', $nameParts['ln'])];
            $signals[] = 'ln';
        }

        // City
        $normCity = self::normalizeCity($contact['city'] ?? '');
        if ($normCity !== null) {
            $userData['ct'] = [hash('sha256', $normCity)];
            $signals[] = 'ct';
        }

        // Gender
        $normGender = self::normalizeGender($contact['gender'] ?? '');
        if ($normGender !== null) {
            $userData['ge'] = [hash('sha256', $normGender)];
            $signals[] = 'ge';
        }

        // DOB (YYYYMMDD)
        $dobRaw = (string)($contact['dob'] ?? $contact['birthday'] ?? $contact['birth_date'] ?? '');
        if ($dobRaw !== '' && strtotime($dobRaw) !== false) {
            $userData['db'] = [hash('sha256', date('Ymd', strtotime($dobRaw)))];
            $signals[] = 'db';
        }

        // Country (VN) & deterministic CRM external_id
        $userData['country'] = [hash('sha256', 'vn')];
        $userData['external_id'] = [hash('sha256', 'myerp_c_' . (int)$contact['id'])];
        $signals[] = 'external_id';

        // Meta Leadgen ID (strictly validated 13-22 digit Facebook ID)
        $metaLeadId = $contact['_resolved_meta_lead_id'] ?? null;
        $hasPrimaryMatchKey = !empty($phoneHashes) || $normEmail !== null;
        if ($metaLeadId !== null) {
            $userData['lead_id'] = $metaLeadId;
            $signals[] = 'lead_id';
            $hasPrimaryMatchKey = true;
        }

        // Stored Web Attribution ONLY (never rep's browser headers!)
        $fbc = trim((string)($contact['cma_fbc'] ?? ''));
        $fbp = trim((string)($contact['cma_fbp'] ?? ''));
        $clientIp = trim((string)($contact['cma_client_ip_address'] ?? ''));
        $clientUa = trim((string)($contact['cma_client_user_agent'] ?? ''));

        if ($fbc !== '') {
            $userData['fbc'] = $fbc;
            $signals[] = 'fbc';
            $hasPrimaryMatchKey = true;
        }
        if ($fbp !== '') {
            $userData['fbp'] = $fbp;
            $signals[] = 'fbp';
            $hasPrimaryMatchKey = true;
        }
        if ($clientIp !== '' && filter_var($clientIp, FILTER_VALIDATE_IP)) {
            $userData['client_ip_address'] = $clientIp;
        }
        if ($clientUa !== '') {
            $userData['client_user_agent'] = $clientUa;
        }

        return [
            'user_data'             => $userData,
            'signals'               => $signals,
            'emq_score'             => count($signals),
            'has_primary_match_key' => $hasPrimaryMatchKey,
            'meta_lead_id'          => $metaLeadId,
            'fbc'                   => $fbc,
            'fbp'                   => $fbp,
            'fb_pixel_id'           => preg_replace('/[^0-9]/', '', (string)($contact['cma_fb_pixel_id'] ?? '')),
            'event_source_url'      => trim((string)($contact['cma_event_source_url'] ?? '')),
        ];
    }

    /**
     * Route event to CRM Pixel (583807401361847) or Web Pixel (661260709828887) based on attribution.
     */
    public static function resolvePixelAndActionSource(array $settings, array $matchInfo, array $options = []): array
    {
        if (!empty($options['pixel_id'])) {
            $px = preg_replace('/[^0-9]/', '', (string)$options['pixel_id']);
            return [
                'pixel_id'      => $px !== '' ? $px : $settings['meta_pixel_id'],
                'action_source' => $matchInfo['meta_lead_id'] ? 'system_generated' : (!empty($matchInfo['event_source_url']) ? 'website' : 'system_generated'),
            ];
        }

        $crmPixel = $settings['meta_pixel_id'] ?: self::DEFAULT_CRM_PIXEL_ID;
        $webPixel = $settings['meta_web_pixel_id'] ?: self::DEFAULT_WEB_PIXEL_ID;

        // Instant Form Leadgen or direct CRM lead -> always CRM Pixel `system_generated`
        if (!empty($matchInfo['meta_lead_id'])) {
            return ['pixel_id' => $crmPixel, 'action_source' => 'system_generated'];
        }

        // Pure Web lead with _fbc / _fbp / tracked URL -> Web Pixel if dual-pixel enabled
        $hasWebSignals = !empty($matchInfo['fbc']) || !empty($matchInfo['fbp']) || !empty($matchInfo['fb_pixel_id']);
        if (!empty($settings['capi_dual_pixel_enabled']) && $hasWebSignals && $webPixel !== '') {
            $chosenWebPixel = !empty($matchInfo['fb_pixel_id']) ? $matchInfo['fb_pixel_id'] : $webPixel;
            $actSource = !empty($matchInfo['event_source_url']) ? 'website' : 'system_generated';
            return ['pixel_id' => $chosenWebPixel, 'action_source' => $actSource];
        }

        // Offline / Zalo / Hotline / Multi-channel quality lead -> CRM Pixel (`all_quality`)
        return ['pixel_id' => $crmPixel, 'action_source' => 'system_generated'];
    }

    /**
     * Core CAPI Dispatcher. Maintains backward-compatible signature while applying Quality Gates,
     * Dashboard Token, Dual-Pixel Routing, Deterministic Dedup, and Schema-Safe Telemetry Logging.
     */
    public static function sendEvent(?PDO $db, int $contactId, string $eventName, float $value = 0.0, array $options = []): array
    {
        $eventName = trim($eventName);
        if ($eventName === '' || strcasecmp($eventName, 'Skip') === 0 || strtoupper($eventName) === 'BAD') {
            return ['sent' => false, 'skipped' => true, 'reason' => 'event_skipped_or_bad'];
        }

        try {
            $db = self::ensureDb($db);
            $settings = self::getSettings($db);
            $contact = self::fetchContactWithAttribution($db, $contactId);

            if (!$contact) {
                return ['sent' => false, 'skipped' => true, 'reason' => 'contact_not_found'];
            }
            if (!empty($contact['deleted_at']) || !empty($contact['is_error_ticket'])) {
                return ['sent' => false, 'skipped' => true, 'reason' => 'deleted_or_error_ticket'];
            }

            $triggerMode = (string)($options['trigger_mode'] ?? 'realtime');
            $isTestMode = ($triggerMode === 'test' || !empty($options['test_event_code']));

            // Reject lost / spam / junk / Phone Farm contacts unless explicitly running synthetic test event
            if (!$isTestMode) {
                $stageSlug = trim((string)($options['stage_slug'] ?? $contact['stage_slug'] ?? $contact['pipeline_status'] ?? ''));
                $leadStatus = strtolower(trim((string)($contact['lead_status'] ?? 'active')));
                if ($leadStatus === 'lost' || (int)($contact['stage_is_lost'] ?? 0) === 1 || in_array($stageSlug, ['lost', 'not_lead', 'spam', 'churned'], true)) {
                    return ['sent' => false, 'skipped' => true, 'reason' => 'excluded_lost_or_spam'];
                }

                $isVerifiedPurchase = ($eventName === 'Purchase' && ($value > 0 || self::resolveBestPurchaseValue($db, $contactId, 0.0) > 0));
                if (!$isVerifiedPurchase && $stageSlug !== 'enrolled' && self::isBlockedPhoneFarm($db, (int)($contact['tenant_id'] ?? 1), $contact)) {
                    return ['sent' => false, 'skipped' => true, 'reason' => 'blocked_phone_farm'];
                }

                // Enforce Minimum Quality Stage (`needed`, order_index >= 3) except priced real Purchase > 0
                if ($eventName !== 'Purchase' || $value <= 0) {
                    $minOrderIndex = self::resolveMinStageOrder($db, (int)($contact['tenant_id'] ?? 1), (string)$settings['capi_quality_min_stage']);
                    $stageOrder = isset($contact['stage_order_index']) && $contact['stage_order_index'] !== null
                        ? (int)$contact['stage_order_index']
                        : self::inferOrderFromSlug($stageSlug);
                    if ($stageOrder !== null && $stageOrder < $minOrderIndex) {
                        return ['sent' => false, 'skipped' => true, 'reason' => "below_min_stage_order ({$stageOrder} < {$minOrderIndex})"];
                    }
                }
            } else {
                $stageSlug = trim((string)($options['stage_slug'] ?? $contact['stage_slug'] ?? 'test'));
            }

            $matchInfo = self::buildUserData($contact);

            // Source Mode Check (`all_quality` vs `meta_only`)
            if (!$isTestMode && $settings['capi_source_mode'] === 'meta_only') {
                $isMetaOrigin = !empty($matchInfo['meta_lead_id'])
                    || !empty($matchInfo['fbc'])
                    || !empty($matchInfo['fbp'])
                    || stripos((string)($contact['source'] ?? ''), 'facebook') !== false
                    || stripos((string)($contact['source'] ?? ''), 'meta') !== false
                    || stripos((string)($contact['source'] ?? ''), 'fb') !== false
                    || stripos((string)($contact['source'] ?? ''), 'ig') !== false;
                if (!$isMetaOrigin) {
                    return ['sent' => false, 'skipped' => true, 'reason' => 'source_mode_meta_only'];
                }
            }

            if (!$matchInfo['has_primary_match_key']) {
                return ['sent' => false, 'skipped' => true, 'reason' => 'insufficient_match_keys'];
            }

            $route = self::resolvePixelAndActionSource($settings, $matchInfo, $options);
            $pixelId = $route['pixel_id'];
            $actionSource = $route['action_source'];
            $accessToken = $settings['access_token'];

            if ($pixelId === '' || $accessToken === '') {
                return ['sent' => false, 'skipped' => true, 'reason' => 'missing_pixel_or_token'];
            }

            // Compute Purchase value cleanly (VNĐ)
            $effectiveValue = $value;
            if ($eventName === 'Purchase' && $effectiveValue <= 0) {
                $effectiveValue = self::resolveBestPurchaseValue($db, $contactId, 0.0);
            }

            // Deterministic event_id & Dedup
            $depositId = isset($options['deposit_id']) ? (int)$options['deposit_id'] : 0;
            $eventId = trim((string)($options['event_id'] ?? ''));
            if ($eventId === '') {
                if ($eventName === 'Purchase') {
                    $eventId = $depositId > 0
                        ? "myerp_purchase_c_{$contactId}_dep_{$depositId}"
                        : ($effectiveValue > 0 ? "myerp_purchase_c_{$contactId}_v" . (int)round($effectiveValue) : "myerp_purchase_c_{$contactId}");
                } else {
                    $suffix = $stageSlug !== '' ? '_' . preg_replace('/[^a-z0-9_]/i', '_', strtolower($stageSlug)) : '';
                    $eventId = 'myerp_' . strtolower($eventName) . '_c_' . $contactId . $suffix;
                }
            }

            if (!$isTestMode && self::isAlreadySentSuccessfully($db, $contactId, $eventName, $eventId, $effectiveValue)) {
                return ['sent' => false, 'skipped' => true, 'reason' => 'already_sent_successfully', 'event_id' => $eventId];
            }

            // Validate / clamp event_time (Meta requires <= 7 days ago)
            $eventTime = isset($options['event_time']) && (int)$options['event_time'] > 0
                ? (int)$options['event_time']
                : time();
            if ($eventTime > time()) {
                $eventTime = time();
            }
            if ((time() - $eventTime) > self::MAX_CAPI_BACKFILL_SECONDS && !$isTestMode) {
                return ['sent' => false, 'skipped' => true, 'reason' => 'event_time_older_than_7d'];
            }

            // Custom Data
            $customData = [
                'event_source' => ($actionSource === 'system_generated') ? 'crm' : 'website',
            ];
            if ($actionSource === 'system_generated') {
                $customData['lead_event_source'] = 'MYERP CRM';
            }
            if (!empty($contact['program'])) {
                $customData['content_name'] = (string)$contact['program'];
            }
            if ($stageSlug !== '') {
                $customData['crm_stage'] = $stageSlug;
            }
            if ($eventName === 'Purchase' && $effectiveValue > 0) {
                $customData['currency'] = 'VND';
                $customData['value'] = round($effectiveValue, 2);
                $customData['content_type'] = 'product';
                if ($depositId > 0) {
                    $customData['order_id'] = 'DEP_' . $depositId;
                }
            }

            $eventObj = [
                'event_name'    => $eventName,
                'event_time'    => $eventTime,
                'action_source' => $actionSource,
                'event_id'      => $eventId,
                'user_data'     => $matchInfo['user_data'],
                'custom_data'   => $customData,
            ];
            if ($actionSource === 'website' && !empty($matchInfo['event_source_url'])) {
                $eventObj['event_source_url'] = $matchInfo['event_source_url'];
            }

            $payload = ['data' => [$eventObj]];
            $testCode = trim((string)($options['test_event_code'] ?? $settings['capi_test_event_code'] ?? ''));
            if ($testCode !== '') {
                $payload['test_event_code'] = $testCode;
            }

            $dispatchRes = self::dispatchGraphEventsPayload($pixelId, $accessToken, $payload, $isTestMode ? 12 : 6);
            $sentJson = $dispatchRes['sent_json'];

            self::insertCapiLog($db, [
                'lead_id'         => null,
                'contact_id'      => $contactId,
                'pixel_id'        => $pixelId,
                'event_name'      => $eventName,
                'action_source'   => $actionSource,
                'meta_lead_id'    => $matchInfo['meta_lead_id'],
                'payload_hash'    => hash('sha256', $sentJson),
                'event_id'        => $eventId,
                'trigger_stage'   => $stageSlug !== '' ? $stageSlug : null,
                'trigger_mode'    => $triggerMode,
                'event_value'     => $effectiveValue > 0 ? $effectiveValue : null,
                'emq_signals'     => (int)$matchInfo['emq_score'],
                'sent_payload'    => $sentJson,
                'response_status' => $dispatchRes['http_code'],
                'response_body'   => $dispatchRes['response_body'],
                'full_name'       => (string)($contact['full_name'] ?? ''),
            ]);

            return [
                'sent'            => true,
                'success'         => ($dispatchRes['http_code'] >= 200 && $dispatchRes['http_code'] < 300),
                'pixel_id'        => $pixelId,
                'event_name'      => $eventName,
                'event_id'        => $eventId,
                'action_source'   => $actionSource,
                'emq_signals'     => (int)$matchInfo['emq_score'],
                'http_code'       => $dispatchRes['http_code'],
                'response_body'   => $dispatchRes['response_body'],
            ];
        } catch (\Throwable $e) {
            error_log('CapiHelper::sendEvent Fatal Error: ' . $e->getMessage());
            return ['sent' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send a pre-built raw payload to Meta Graph API `/v21.0/{pixel_id}/events` (used by Retry & Test).
     */
    public static function dispatchGraphEventsPayload(string $pixelId, string $accessToken, array $payload, int $timeoutSec = 8): array
    {
        $sentJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $url = 'https://graph.facebook.com/' . self::GRAPH_API_VERSION . "/{$pixelId}/events?access_token=" . urlencode($accessToken);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $sentJson,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => $timeoutSec,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $responseBody = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($responseBody === false && $curlErr !== '') {
            $responseBody = json_encode(['error' => ['message' => $curlErr]]);
        }

        return [
            'http_code'     => $httpCode,
            'response_body' => (string)$responseBody,
            'sent_json'     => (string)$sentJson,
        ];
    }

    /**
     * Dedup check: Only skip if a PREVIOUS 2xx SUCCESS exists for the exact event_id or (same event_name & value >= new).
     */
    private static function isAlreadySentSuccessfully(PDO $db, int $contactId, string $eventName, string $eventId, float $newValue): bool
    {
        $cols = self::getTableColumns($db, 'capi_logs');
        $hasEventId = isset($cols['event_id']);
        $hasEventVal = isset($cols['event_value']);

        if ($hasEventId) {
            $stmtEid = $db->prepare("
                SELECT id FROM capi_logs
                WHERE contact_id = ? AND event_id = ? AND response_status >= 200 AND response_status < 300
                LIMIT 1
            ");
            $stmtEid->execute([$contactId, $eventId]);
            if ($stmtEid->fetchColumn()) {
                return true;
            }
        }

        if ($eventName === 'Purchase') {
            // If specific deposit `dep_` eventId wasn't found above, check whether general Purchase already sent WITH >= value
            if ($newValue > 0 && $hasEventVal) {
                $stmtP = $db->prepare("
                    SELECT COALESCE(MAX(event_value), 0)
                    FROM capi_logs
                    WHERE contact_id = ? AND event_name = 'Purchase' AND response_status >= 200 AND response_status < 300
                ");
                $stmtP->execute([$contactId]);
                $maxSentVal = (float)$stmtP->fetchColumn();
                // Allow upgrade if previous Purchase was 0 VNĐ!
                return ($maxSentVal >= $newValue && strpos($eventId, '_dep_') === false);
            }
            if ($newValue <= 0) {
                $stmtP = $db->prepare("
                    SELECT id FROM capi_logs
                    WHERE contact_id = ? AND event_name = 'Purchase' AND response_status >= 200 AND response_status < 300
                    LIMIT 1
                ");
                $stmtP->execute([$contactId]);
                return (bool)$stmtP->fetchColumn();
            }
            return false;
        }

        $stmtChk = $db->prepare("
            SELECT id FROM capi_logs
            WHERE contact_id = ? AND event_name = ? AND response_status >= 200 AND response_status < 300
            LIMIT 1
        ");
        $stmtChk->execute([$contactId, $eventName]);
        return (bool)$stmtChk->fetchColumn();
    }

    /**
     * Schema-safe insert into `capi_logs` (handles both pre- and post-Migration 330 schemas cleanly).
     */
    public static function insertCapiLog(PDO $db, array $data): void
    {
        try {
            $cols = self::getTableColumns($db, 'capi_logs');
            $candidateFields = [
                'lead_id', 'contact_id', 'pixel_id', 'event_name', 'action_source',
                'meta_lead_id', 'payload_hash', 'event_id', 'trigger_stage',
                'trigger_mode', 'event_value', 'emq_signals', 'sent_payload',
                'response_status', 'response_body', 'full_name',
            ];
            $insertCols = [];
            $params = [];
            foreach ($candidateFields as $f) {
                if (isset($cols[$f]) && array_key_exists($f, $data)) {
                    $insertCols[] = "`$f`";
                    $params[] = $data[$f];
                }
            }
            if (empty($insertCols)) {
                return;
            }
            $placeholders = implode(', ', array_fill(0, count($insertCols), '?'));
            $sql = 'INSERT INTO `capi_logs` (' . implode(', ', $insertCols) . ') VALUES (' . $placeholders . ')';
            $stmt = $db->prepare($sql);
            $stmt->execute(array_values($params));
        } catch (\Throwable $e) {
            error_log('CapiHelper::insertCapiLog error: ' . $e->getMessage());
        }
    }

    /**
     * Enrich or upsert web tracking (`_fbc`, `_fbp`, IP, UA, URL, fb_pixel_id) into `contact_meta_attribution`.
     */
    public static function upsertWebAttribution(PDO $db, int $contactId, int $tenantId, array $webData): void
    {
        if ($contactId <= 0) {
            return;
        }
        $fbc = trim((string)($webData['fbc'] ?? ''));
        $fbp = trim((string)($webData['fbp'] ?? ''));
        $ip  = trim((string)($webData['client_ip_address'] ?? ''));
        $ua  = trim((string)($webData['client_user_agent'] ?? ''));
        $url = trim((string)($webData['event_source_url'] ?? ''));
        $px  = preg_replace('/[^0-9]/', '', (string)($webData['fb_pixel_id'] ?? ''));
        if ($fbc === '' && $fbp === '' && $url === '' && $px === '') {
            return;
        }

        try {
            $cols = self::getTableColumns($db, 'contact_meta_attribution');
            if (!isset($cols['fbc']) || !isset($cols['fbp'])) {
                return; // Pre-migration 330 safety guard
            }

            $chk = $db->prepare("SELECT id FROM contact_meta_attribution WHERE contact_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1");
            $chk->execute([$contactId]);
            $existingId = $chk->fetchColumn();

            if ($existingId) {
                $up = $db->prepare("
                    UPDATE contact_meta_attribution
                    SET fbc = COALESCE(NULLIF(fbc, ''), NULLIF(?, '')),
                        fbp = COALESCE(NULLIF(fbp, ''), NULLIF(?, '')),
                        client_ip_address = COALESCE(NULLIF(client_ip_address, ''), NULLIF(?, '')),
                        client_user_agent = COALESCE(NULLIF(client_user_agent, ''), NULLIF(?, '')),
                        event_source_url = COALESCE(NULLIF(event_source_url, ''), NULLIF(?, '')),
                        fb_pixel_id = COALESCE(NULLIF(fb_pixel_id, ''), NULLIF(?, ''))
                    WHERE id = ?
                ");
                $up->execute([
                    $fbc ?: null,
                    $fbp ?: null,
                    $ip ? substr($ip, 0, 64) : null,
                    $ua ? substr($ua, 0, 500) : null,
                    $url ? substr($url, 0, 500) : null,
                    $px ?: null,
                    (int)$existingId,
                ]);
            } else {
                $ins = $db->prepare("
                    INSERT INTO contact_meta_attribution
                        (contact_id, tenant_id, platform, fbc, fbp, client_ip_address, client_user_agent, event_source_url, fb_pixel_id, raw_lead_status)
                    VALUES (?, ?, 'web', ?, ?, ?, ?, ?, ?, 'WEB_TRACKED')
                ");
                $ins->execute([
                    $contactId,
                    $tenantId > 0 ? $tenantId : 1,
                    $fbc ?: null,
                    $fbp ?: null,
                    $ip ? substr($ip, 0, 64) : null,
                    $ua ? substr($ua, 0, 500) : null,
                    $url ? substr($url, 0, 500) : null,
                    $px ?: null,
                ]);
            }
        } catch (\Throwable $e) {
            error_log('CapiHelper::upsertWebAttribution error: ' . $e->getMessage());
        }
    }

    /**
     * Preview historical CAPI Backfill candidates strictly inside Meta's 7-day compliance window.
     */
    public static function previewBackfillCandidates(PDO $db, int $tenantId = 1, int $days = 7, int $limit = 100): array
    {
        $days = max(1, min(7, $days));
        $limit = max(1, min(500, $limit));
        $settings = self::getSettings($db);
        $stages = self::getPipelineStages($db, $tenantId);
        $minOrder = self::resolveMinStageOrder($db, $tenantId, (string)$settings['capi_quality_min_stage']);

        $stageMap = [];
        foreach ($stages as $s) {
            $stageMap[(int)$s['id']] = $s;
        }

        // Only look at leads/contacts updated/created within the last $days days (max 7d per Meta spec)
        $cutoffExpr = "DATE_SUB(NOW(), INTERVAL {$days} DAY)";
        $sql = "
            SELECT
                c.id, c.full_name, c.phone, c.email, c.source, c.stage_id, c.pipeline_status, c.lead_status,
                c.meta_lead_id, c.created_at, c.updated_at,
                ps.system_slug AS stage_slug, ps.name AS stage_name, ps.order_index AS stage_order_index, ps.is_lost,
                cma.meta_lead_id AS cma_meta_lead_id,
                " . (isset(self::getTableColumns($db, 'contact_meta_attribution')['fbc']) ? "cma.fbc AS cma_fbc, cma.fbp AS cma_fbp" : "NULL AS cma_fbc, NULL AS cma_fbp") . ",
                COALESCE((SELECT SUM(d.price) FROM deposits d WHERE d.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'approved'), 0) AS approved_deposit_total
            FROM contacts c
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            LEFT JOIN contact_meta_attribution cma ON cma.id = (
                SELECT cma2.id FROM contact_meta_attribution cma2
                WHERE cma2.contact_id = c.id AND cma2.deleted_at IS NULL
                ORDER BY cma2.id DESC LIMIT 1
            )
            WHERE c.deleted_at IS NULL
              AND COALESCE(c.is_error_ticket, 0) = 0
              AND COALESCE(c.lead_status, 'active') != 'lost'
              AND (ps.order_index >= ? OR EXISTS (
                  SELECT 1 FROM deposits dep WHERE dep.contact_id = c.id AND dep.deleted_at IS NULL AND dep.status = 'approved' AND dep.price > 0
              ))
              AND COALESCE(ps.is_lost, 0) = 0
              AND COALESCE(c.updated_at, c.created_at) >= {$cutoffExpr}
              AND NOT EXISTS (
                  SELECT 1 FROM capi_logs cl
                  WHERE cl.contact_id = c.id AND cl.response_status BETWEEN 200 AND 299
              )
            ORDER BY c.updated_at DESC, c.id DESC
            LIMIT {$limit}
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([$minOrder]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Batch pre-fetch blocked Phone Farm phones across candidates (zero N+1)
        $blockedSet = [];
        try {
            $candPhones = [];
            foreach ($rows as $rCheck) {
                $np = self::normalizePhone($rCheck['phone'] ?? '');
                if ($np !== null) {
                    $candPhones[] = $np;
                }
            }
            $candPhones = array_values(array_unique($candPhones));
            if (!empty($candPhones)) {
                self::ensurePhoneFarmTable($db);
                $phPlaceholders = implode(',', array_fill(0, count($candPhones), '?'));
                $stmtBlk = $db->prepare("SELECT phone_normalized FROM `capi_blocked_phones` WHERE tenant_id = ? AND deleted_at IS NULL AND phone_normalized IN ($phPlaceholders)");
                $stmtBlk->execute(array_merge([$tenantId], $candPhones));
                foreach (($stmtBlk->fetchAll(PDO::FETCH_COLUMN) ?: []) as $bp) {
                    $blockedSet[(string)$bp] = true;
                }
            }
        } catch (\Throwable $e) {
            error_log('CapiHelper::previewBackfillCandidates blocked check error: ' . $e->getMessage());
        }

        $candidates = [];
        $byEvent = [];
        foreach ($rows as $r) {
            $resolvedMetaId = self::sanitizeMetaLeadId($r['meta_lead_id'] ?? '') ?? self::sanitizeMetaLeadId($r['cma_meta_lead_id'] ?? '');
            $normPhone = self::normalizePhone($r['phone'] ?? '');
            $hasPhone = $normPhone !== null;
            $hasEmail = self::normalizeEmail($r['email'] ?? '') !== null;
            $hasWeb = !empty($r['cma_fbc']) || !empty($r['cma_fbp']);
            if (!$hasPhone && !$hasEmail && $resolvedMetaId === null && !$hasWeb) {
                continue;
            }
            if ($settings['capi_source_mode'] === 'meta_only' && $resolvedMetaId === null && !$hasWeb && stripos((string)$r['source'], 'facebook') === false) {
                continue;
            }

            $depTotal = (float)$r['approved_deposit_total'];
            if ($depTotal <= 0 && (string)($r['stage_slug'] ?? '') !== 'enrolled' && $normPhone !== null && isset($blockedSet[$normPhone])) {
                continue;
            }
            if ($depTotal > 0) {
                $eventName = 'Purchase';
                $stageSlug = (string)($r['stage_slug'] ?: 'deposit_tuition_payment');
            } else {
                $evRes = self::resolveEventForStage($db, $r['stage_slug'] ?? $r['pipeline_status'], $r['stage_id'] ? (int)$r['stage_id'] : null, $tenantId, $settings);
                $eventName = $evRes['event_name'];
                $stageSlug = $evRes['stage_slug'];
            }
            if ($eventName === 'Skip') {
                continue;
            }

            $eventTs = strtotime((string)($r['updated_at'] ?: $r['created_at'])) ?: time();
            if ((time() - $eventTs) > self::MAX_CAPI_BACKFILL_SECONDS) {
                $eventTs = time() - 3600;
            }

            $candidates[] = [
                'contact_id'      => (int)$r['id'],
                'full_name'       => (string)$r['full_name'],
                'source'          => (string)$r['source'],
                'stage_name'      => (string)($r['stage_name'] ?: $stageSlug),
                'stage_slug'      => $stageSlug,
                'target_event'    => $eventName,
                'event_value'     => $depTotal,
                'has_meta_lead'   => $resolvedMetaId !== null,
                'event_time'      => $eventTs,
                'updated_at'      => (string)$r['updated_at'],
            ];
            $byEvent[$eventName] = ($byEvent[$eventName] ?? 0) + 1;
        }

        // Also compute total >7d historical counts so user clearly sees why older leads go to Custom Audience
        $olderQualityCount = (int)$db->query("
            SELECT COUNT(*) FROM contacts c
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            WHERE c.deleted_at IS NULL AND COALESCE(c.is_error_ticket, 0) = 0 AND COALESCE(c.lead_status, 'active') != 'lost'
              AND COALESCE(ps.is_lost, 0) = 0
              AND ps.order_index >= {$minOrder}
              AND COALESCE(c.updated_at, c.created_at) < {$cutoffExpr}
        ")->fetchColumn();

        return [
            'window_days'         => $days,
            'source_mode'         => $settings['capi_source_mode'],
            'min_quality_stage'   => $settings['capi_quality_min_stage'],
            'eligible_7d_count'   => count($candidates),
            'older_than_7d_count' => $olderQualityCount,
            'by_event'            => $byEvent,
            'candidates'          => $candidates,
        ];
    }

    /**
     * Execute 7-day compliant CAPI Backfill across eligible quality contacts.
     */
    public static function runBackfill(PDO $db, int $tenantId = 1, int $days = 7, int $limit = 100): array
    {
        $preview = self::previewBackfillCandidates($db, $tenantId, $days, $limit);
        $sent = 0;
        $success = 0;
        $failed = 0;
        $skipped = 0;
        $details = [];

        foreach ($preview['candidates'] as $cand) {
            $res = self::sendEvent($db, (int)$cand['contact_id'], (string)$cand['target_event'], (float)$cand['event_value'], [
                'stage_slug'   => (string)$cand['stage_slug'],
                'event_time'   => (int)$cand['event_time'],
                'trigger_mode' => 'backfill',
            ]);
            if (!empty($res['sent'])) {
                $sent++;
                if (!empty($res['success'])) {
                    $success++;
                } else {
                    $failed++;
                }
            } else {
                $skipped++;
            }
            $details[] = [
                'contact_id' => $cand['contact_id'],
                'full_name'  => $cand['full_name'],
                'event_name' => $cand['target_event'],
                'result'     => $res,
            ];
        }

        return [
            'processed' => count($preview['candidates']),
            'sent'      => $sent,
            'success'   => $success,
            'failed'    => $failed,
            'skipped'   => $skipped,
            'details'   => array_slice($details, 0, 50),
        ];
    }

    private static function resolveMinStageOrder(PDO $db, int $tenantId, string $minSlug): int
    {
        $stages = self::getPipelineStages($db, $tenantId);
        foreach ($stages as $s) {
            if (trim((string)($s['system_slug'] ?? '')) === $minSlug) {
                return (int)$s['order_index'];
            }
        }
        return self::inferOrderFromSlug($minSlug) ?? 3;
    }

    private static function inferOrderFromSlug(string $slug): ?int
    {
        static $map = [
            'new_lead'                => 0,
            'contact_attempted'       => 1,
            'connected'               => 2,
            'needed'                  => 3,
            'discovery_completed'     => 4,
            'program_matched'         => 5,
            'proposal_sent'           => 6,
            'evaluation_objection'    => 7,
            'application_started'     => 8,
            'application_completed'   => 9,
            'admission_approved'      => 10,
            'offer_accepted'          => 11,
            'deposit_tuition_payment' => 12,
            'enrolled'                => 13,
        ];
        return $map[$slug] ?? null;
    }

    private static function getTableColumns(PDO $db, string $table): array
    {
        if ($table === 'capi_logs' && self::$capiLogsColumnsCache !== null) {
            return self::$capiLogsColumnsCache;
        }
        if ($table === 'contact_meta_attribution' && self::$cmaColumnsCache !== null) {
            return self::$cmaColumnsCache;
        }
        $cols = [];
        try {
            $stmt = $db->query("SHOW COLUMNS FROM `{$table}`");
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $cols[(string)$r['Field']] = true;
            }
        } catch (\Throwable $e) {
            // Table might not exist in minimal unit tests
        }
        if ($table === 'capi_logs') {
            self::$capiLogsColumnsCache = $cols;
        } elseif ($table === 'contact_meta_attribution') {
            self::$cmaColumnsCache = $cols;
        }
        return $cols;
    }
}
