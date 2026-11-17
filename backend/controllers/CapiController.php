<?php
/**
 * backend/controllers/CapiController.php
 *
 * Enterprise Meta Conversions API (CAPI) & Playbook Audience Controller:
 * - Dynamic 14-stage Education pipeline trigger matrix (`04 - Needed`+ quality gate)
 * - Dual-Pixel settings (`583807401361847` CRM & `661260709828887` Web) using Dashboard Meta Ads token
 * - Live Test Event verification (`test_event_code`)
 * - 7-day Meta-compliant CAPI Backfill preview & execution
 * - Historical Custom Audience & Value-Based Lookalike sync + Education Playbook AdSet optimizer
 * - Multi-tenant isolated Telemetry Logs (`capi_logs`) with safe Retry
 */

require_once __DIR__ . '/../config/CapiHelper.php';
require_once __DIR__ . '/../config/MetaPlaybookService.php';

class CapiController
{
    private PDO $db;
    private const ALLOWED_ROLES = ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'marketing_manager', 'marketing_lead'];

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * GET /capi/settings
     */
    public function getSettings(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));

        $settings = CapiHelper::getSettings($this->db);
        $stages = CapiHelper::getPipelineStages($this->db, $tid);

        // Normalize pipeline stages into both array and legacy key-value maps for 100% FE backward compat
        $stageItems = [];
        $hierarchy = [];
        $labels = [];
        foreach ($stages as $s) {
            $slug = trim((string)($s['system_slug'] ?? ''));
            if ($slug === '') {
                continue;
            }
            $stageItems[] = [
                'id'          => (int)$s['id'],
                'system_slug' => $slug,
                'name'        => (string)$s['name'],
                'color'       => (string)($s['color'] ?? '#64748b'),
                'order_index' => (int)$s['order_index'],
                'is_won'      => (int)($s['is_won'] ?? 0),
                'is_lost'     => (int)($s['is_lost'] ?? 0),
            ];
            $hierarchy[] = $slug;
            $labels[$slug] = (string)$s['name'];
        }
        foreach (['lost' => 'Mất / Thất bại (Lost)', 'not_lead' => 'Không phải Lead / Junk'] as $extraSlug => $extraLabel) {
            if (!isset($labels[$extraSlug])) {
                $labels[$extraSlug] = $extraLabel;
                $stageItems[] = [
                    'id'          => 0,
                    'system_slug' => $extraSlug,
                    'name'        => $extraLabel,
                    'color'       => '#ef4444',
                    'order_index' => -1,
                    'is_won'      => 0,
                    'is_lost'     => 1,
                ];
            }
        }

        $tok = (string)$settings['access_token'];
        $maskedToken = $tok !== ''
            ? (strlen($tok) > 16 ? substr($tok, 0, 8) . '••••••••' . substr($tok, -6) : '••••••••')
            : '';

        respond(200, [
            'meta_pixel_id'           => $settings['meta_pixel_id'],
            'meta_web_pixel_id'       => $settings['meta_web_pixel_id'],
            'meta_ad_account_id'      => $settings['meta_ad_account_id'],
            'has_access_token'        => $tok !== '',
            'token_preview'           => $maskedToken,
            'token_source'            => $settings['token_source'],
            'has_custom_capi_token'   => $settings['capi_access_token'] !== '',
            'meta_access_token'       => $maskedToken, // Legacy masked display field (never expose raw token)
            'capi_event_triggers'     => $settings['capi_event_triggers'],
            'capi_source_mode'        => $settings['capi_source_mode'],
            'capi_quality_min_stage'  => $settings['capi_quality_min_stage'],
            'capi_dual_pixel_enabled' => $settings['capi_dual_pixel_enabled'],
            'capi_test_event_code'    => $settings['capi_test_event_code'],
            'pipeline_stages'         => $stageItems,
            'pipeline_hierarchy'      => $hierarchy,
            'pipeline_labels'         => $labels,
        ]);
    }

    /**
     * POST /capi/settings
     */
    public function saveSettings(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $b = getBody();

        $pixelId = preg_replace('/[^0-9]/', '', (string)($b['meta_pixel_id'] ?? $b['pixel_id'] ?? ''));
        $webPixelId = preg_replace('/[^0-9]/', '', (string)($b['meta_web_pixel_id'] ?? $b['web_pixel_id'] ?? ''));
        $adAccountId = preg_replace('/[^0-9]/', '', (string)($b['meta_ad_account_id'] ?? $b['ad_account_id'] ?? ''));
        $sourceMode = trim((string)($b['capi_source_mode'] ?? 'all_quality'));
        if (!in_array($sourceMode, ['all_quality', 'meta_only'], true)) {
            $sourceMode = 'all_quality';
        }
        $minStage = trim((string)($b['capi_quality_min_stage'] ?? 'needed'));
        if ($minStage === '') {
            $minStage = 'needed';
        }
        $dualPixel = isset($b['capi_dual_pixel_enabled'])
            ? (!empty($b['capi_dual_pixel_enabled']) && $b['capi_dual_pixel_enabled'] !== '0' ? '1' : '0')
            : '1';
        $testEventCode = trim((string)($b['capi_test_event_code'] ?? ''));

        $tid = (int)($auth['tenant_id'] ?? 1);
        require_once __DIR__ . '/../config/TenantConfigService.php';
        $kv = [
            'capi_source_mode' => $sourceMode,
            'capi_quality_min_stage' => $minStage,
            'capi_dual_pixel_enabled' => $dualPixel,
            'capi_test_event_code' => $testEventCode,
        ];
        if ($pixelId !== '') {
            $kv['meta_pixel_id'] = $pixelId;
        }
        if ($webPixelId !== '') {
            $kv['meta_web_pixel_id'] = $webPixelId;
        }
        if ($adAccountId !== '') {
            $kv['meta_ad_account_id'] = $adAccountId;
        }

        // Handle optional custom override token cleanly (never overwrite with masked dots, allow explicit clear)
        if (array_key_exists('capi_access_token', $b)) {
            $customTok = trim((string)$b['capi_access_token']);
            if ($customTok === '') {
                $kv['capi_access_token'] = '';
            } elseif (strpos($customTok, '••••') === false && strpos($customTok, '***') === false && strlen($customTok) > 30) {
                $kv['capi_access_token'] = $customTok;
            }
        } elseif (!empty($b['meta_access_token'])) {
            $legacyTok = trim((string)$b['meta_access_token']);
            if (strpos($legacyTok, '••••') === false && strpos($legacyTok, '***') === false && strlen($legacyTok) > 30) {
                $kv['meta_access_token'] = $legacyTok;
            }
        }

        if (isset($b['capi_event_triggers'])) {
            $triggersRaw = $b['capi_event_triggers'];
            if (is_string($triggersRaw)) {
                $triggersArr = CapiHelper::normalizeTriggersJson($triggersRaw);
            } elseif (is_array($triggersRaw)) {
                $triggersArr = CapiHelper::normalizeTriggersJson(json_encode($triggersRaw, JSON_UNESCAPED_UNICODE));
            } else {
                $triggersArr = CapiHelper::DEFAULT_STAGE_TRIGGERS;
            }
            $kv['capi_event_triggers'] = json_encode($triggersArr, JSON_UNESCAPED_UNICODE);
        }

        TenantConfigService::saveSettings($this->db, $tid, $kv);
        @unlink(sys_get_temp_dir() . '/myerp_meta_creds_v2.json');

        respond(200, null, 'Cấu hình Meta CAPI & Quality Gate đã được lưu thành công');
    }

    /**
     * GET /capi/logs
     */
    public function getLogs(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $limit = max(10, min(300, (int)($_GET['limit'] ?? 100)));
        $statusFilter = trim((string)($_GET['status'] ?? 'all'));
        $eventFilter = trim((string)($_GET['event_name'] ?? ''));

        // Clean logs older than 90 days safely
        try {
            $this->db->exec("DELETE FROM capi_logs WHERE sent_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        } catch (\Throwable $e) {}

        $colsStmt = $this->db->query("SHOW COLUMNS FROM capi_logs");
        $colSet = [];
        foreach ($colsStmt->fetchAll(PDO::FETCH_ASSOC) as $cr) {
            $colSet[(string)$cr['Field']] = true;
        }

        $where = ['(c.tenant_id = ? OR cl.contact_id IS NULL)'];
        $params = [$tid];
        if ($statusFilter === 'success') {
            $where[] = 'cl.response_status BETWEEN 200 AND 299';
        } elseif ($statusFilter === 'failed') {
            $where[] = '(cl.response_status < 200 OR cl.response_status >= 300)';
        }
        if ($eventFilter !== '') {
            $where[] = 'cl.event_name = ?';
            $params[] = $eventFilter;
        }
        $whereSql = implode(' AND ', $where);

        $optCols = [
            isset($colSet['pixel_id']) ? 'cl.pixel_id' : 'NULL AS pixel_id',
            isset($colSet['action_source']) ? 'cl.action_source' : 'NULL AS action_source',
            isset($colSet['meta_lead_id']) ? 'cl.meta_lead_id' : 'NULL AS meta_lead_id',
            isset($colSet['event_id']) ? 'cl.event_id' : 'NULL AS event_id',
            isset($colSet['trigger_stage']) ? 'cl.trigger_stage' : 'NULL AS trigger_stage',
            isset($colSet['trigger_mode']) ? 'cl.trigger_mode' : "'realtime' AS trigger_mode",
            isset($colSet['event_value']) ? 'cl.event_value' : 'NULL AS event_value',
            isset($colSet['emq_signals']) ? 'cl.emq_signals' : '0 AS emq_signals',
        ];

        $stmt = $this->db->prepare("
            SELECT cl.id, cl.lead_id, cl.contact_id, cl.event_name, cl.payload_hash,
                   cl.sent_payload, cl.response_status, cl.response_body, cl.sent_at,
                   " . implode(', ', $optCols) . ",
                   COALESCE(c.full_name, cl.full_name) AS contact_name,
                   c.phone AS contact_phone,
                   c.source AS contact_source,
                   ps.name AS stage_name
            FROM capi_logs cl
            LEFT JOIN contacts c ON c.id = cl.contact_id
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            WHERE {$whereSql}
            ORDER BY cl.id DESC
            LIMIT {$limit}
        ");
        $stmt->execute(array_values($params));
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Aggregate KPI summary for the tenant
        $valExpr = isset($colSet['event_value'])
            ? "COALESCE(SUM(CASE WHEN cl.event_name = 'Purchase' AND cl.response_status BETWEEN 200 AND 299 THEN COALESCE(cl.event_value, 0) ELSE 0 END), 0)"
            : "0";
        $emqExpr = isset($colSet['emq_signals'])
            ? "COALESCE(AVG(CASE WHEN cl.response_status BETWEEN 200 AND 299 AND cl.emq_signals > 0 THEN cl.emq_signals END), 0)"
            : "0";

        $stmtStats = $this->db->prepare("
            SELECT
                COUNT(*) AS total_events,
                SUM(CASE WHEN cl.response_status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success_events,
                SUM(CASE WHEN cl.response_status < 200 OR cl.response_status >= 300 THEN 1 ELSE 0 END) AS failed_events,
                {$valExpr} AS purchase_value_vnd,
                ROUND({$emqExpr}, 1) AS avg_emq_signals
            FROM capi_logs cl
            LEFT JOIN contacts c ON c.id = cl.contact_id
            WHERE (c.tenant_id = ? OR cl.contact_id IS NULL)
        ");
        $stmtStats->execute([$tid]);
        $summary = $stmtStats->fetch(PDO::FETCH_ASSOC) ?: [];

        respond(200, [
            'logs'    => $logs,
            'summary' => [
                'total_events'       => (int)($summary['total_events'] ?? 0),
                'success_events'     => (int)($summary['success_events'] ?? 0),
                'failed_events'      => (int)($summary['failed_events'] ?? 0),
                'purchase_value_vnd' => (float)($summary['purchase_value_vnd'] ?? 0),
                'avg_emq_signals'    => (float)($summary['avg_emq_signals'] ?? 0),
            ],
        ], 'Lấy lịch sử CAPI logs thành công');
    }

    /**
     * POST /capi/retry/{id}
     */
    public function retry(array $auth, int $id): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));

        $stmt = $this->db->prepare("
            SELECT cl.*
            FROM capi_logs cl
            LEFT JOIN contacts c ON c.id = cl.contact_id
            WHERE cl.id = ? AND (c.tenant_id = ? OR cl.contact_id IS NULL)
            LIMIT 1
        ");
        $stmt->execute([$id, $tid]);
        $log = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$log) {
            respond(404, null, 'Không tìm thấy nhật ký sự kiện', false);
        }

        $settings = CapiHelper::getSettings($this->db);
        $pixelId = preg_replace('/[^0-9]/', '', (string)($log['pixel_id'] ?? ''));
        if ($pixelId === '') {
            $pixelId = (string)$settings['meta_pixel_id'];
        }
        $token = (string)$settings['access_token'];
        if ($pixelId === '' || $token === '') {
            respond(422, null, 'Meta Pixel ID hoặc Access Token chưa được cấu hình', false);
        }

        // If contact exists & payload was empty/outdated, prefer fresh regeneration via sendEvent
        $payload = json_decode((string)$log['sent_payload'], true);
        if (!is_array($payload) || empty($payload['data'][0])) {
            if (!empty($log['contact_id'])) {
                $res = CapiHelper::sendEvent($this->db, (int)$log['contact_id'], (string)$log['event_name'], (float)($log['event_value'] ?? 0), [
                    'trigger_mode' => 'retry',
                    'pixel_id'     => $pixelId,
                ]);
                if (!empty($res['success'])) {
                    respond(200, $res, 'Gửi lại sự kiện CAPI thành công');
                }
                respond(400, $res, 'Gửi lại sự kiện thất bại: ' . ($res['response_body'] ?? $res['reason'] ?? 'Error'), false);
            }
            respond(400, null, 'Payload không hợp lệ để retry', false);
        }

        // Refresh event_time inside 7d window if original timestamp expired
        if (isset($payload['data'][0]['event_time'])) {
            $origTs = (int)$payload['data'][0]['event_time'];
            if ((time() - $origTs) > CapiHelper::MAX_CAPI_BACKFILL_SECONDS) {
                $payload['data'][0]['event_time'] = time();
            }
        }

        $dispatchRes = CapiHelper::dispatchGraphEventsPayload($pixelId, $token, $payload, 10);
        $up = $this->db->prepare("UPDATE capi_logs SET response_status = ?, response_body = ?, sent_at = NOW() WHERE id = ?");
        $up->execute([$dispatchRes['http_code'], $dispatchRes['response_body'], $id]);

        if ($dispatchRes['http_code'] >= 200 && $dispatchRes['http_code'] < 300) {
            respond(200, ['http_code' => $dispatchRes['http_code'], 'response_body' => $dispatchRes['response_body']], 'Gửi lại sự kiện CAPI thành công');
        }
        respond(400, ['http_code' => $dispatchRes['http_code']], 'Gửi lại sự kiện thất bại: ' . $dispatchRes['response_body'], false);
    }

    /**
     * POST /capi/events
     */
    public function sendEvent(array $auth): void
    {
        if (($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền gửi sự kiện CAPI', false);
        }
        $b = getBody();
        $contactId = (int)($b['contact_id'] ?? 0);
        $eventName = trim((string)($b['event_name'] ?? 'Lead'));
        $value = (float)($b['value'] ?? 0);

        if ($contactId <= 0) {
            respond(400, null, 'Thiếu contact_id', false);
        }

        $res = CapiHelper::sendEvent($this->db, $contactId, $eventName, $value, [
            'stage_slug'   => trim((string)($b['stage_slug'] ?? '')),
            'trigger_mode' => 'manual',
            'pixel_id'     => preg_replace('/[^0-9]/', '', (string)($b['pixel_id'] ?? '')),
        ]);
        respond(200, $res, !empty($res['success']) ? 'Đã gửi sự kiện CAPI' : 'Đã xử lý yêu cầu CAPI');
    }

    /**
     * POST /capi/test — Send synthetic or existing-contact dry-run event with Meta `test_event_code`
     */
    public function testPixel(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $b = getBody();
        $settings = CapiHelper::getSettings($this->db);

        $pixelType = trim((string)($b['pixel_type'] ?? 'crm'));
        $pixelId = preg_replace('/[^0-9]/', '', (string)($b['pixel_id'] ?? ''));
        if ($pixelId === '') {
            $pixelId = ($pixelType === 'web') ? $settings['meta_web_pixel_id'] : $settings['meta_pixel_id'];
        }
        $token = (string)$settings['access_token'];
        if ($pixelId === '' || $token === '') {
            respond(422, null, 'Thiếu Pixel ID hoặc Meta Access Token', false);
        }

        $testCode = trim((string)($b['test_event_code'] ?? $settings['capi_test_event_code'] ?? ''));
        $contactId = (int)($b['contact_id'] ?? 0);
        $eventName = trim((string)($b['event_name'] ?? 'Lead'));
        if ($eventName === '' || $eventName === 'Skip' || strtoupper($eventName) === 'BAD') {
            $eventName = 'Lead';
        }

        if ($contactId > 0) {
            $res = CapiHelper::sendEvent($this->db, $contactId, $eventName, (float)($b['value'] ?? 0), [
                'trigger_mode'    => 'test',
                'pixel_id'        => $pixelId,
                'test_event_code' => $testCode !== '' ? $testCode : 'MYERP_TEST',
            ]);
            respond(!empty($res['success']) ? 200 : 400, $res, !empty($res['success']) ? 'Test Pixel thành công' : 'Test Pixel thất bại');
        }

        $payload = [
            'data' => [[
                'event_name'    => $eventName,
                'event_time'    => time(),
                'action_source' => ($pixelType === 'web') ? 'website' : 'system_generated',
                'event_id'      => 'myerp_test_' . time() . '_' . random_int(100, 999),
                'user_data'     => [
                    'em'          => [hash('sha256', 'capi-healthcheck@myerp.local')],
                    'ph'          => [hash('sha256', '84900000001')],
                    'country'     => [hash('sha256', 'vn')],
                    'external_id' => [hash('sha256', 'myerp_healthcheck')],
                ],
                'custom_data'   => [
                    'event_source'      => 'crm',
                    'lead_event_source' => 'MYERP CAPI Diagnostics',
                ],
            ]],
            'test_event_code' => $testCode !== '' ? $testCode : 'MYERP_HEALTHCHECK',
        ];

        $dispatch = CapiHelper::dispatchGraphEventsPayload($pixelId, $token, $payload, 10);
        $decoded = json_decode($dispatch['response_body'], true);
        $ok = ($dispatch['http_code'] >= 200 && $dispatch['http_code'] < 300);

        CapiHelper::insertCapiLog($this->db, [
            'lead_id'         => null,
            'contact_id'      => null,
            'pixel_id'        => $pixelId,
            'event_name'      => $eventName,
            'action_source'   => ($pixelType === 'web') ? 'website' : 'system_generated',
            'meta_lead_id'    => null,
            'payload_hash'    => hash('sha256', $dispatch['sent_json']),
            'event_id'        => $payload['data'][0]['event_id'],
            'trigger_stage'   => 'test',
            'trigger_mode'    => 'test',
            'event_value'     => null,
            'emq_signals'     => 4,
            'sent_payload'    => $dispatch['sent_json'],
            'response_status' => $dispatch['http_code'],
            'response_body'   => $dispatch['response_body'],
            'full_name'       => 'CAPI Pixel Diagnostics',
        ]);

        respond($ok ? 200 : 400, [
            'pixel_id'        => $pixelId,
            'http_code'       => $dispatch['http_code'],
            'response'        => $decoded ?: $dispatch['response_body'],
            'test_event_code' => $payload['test_event_code'],
        ], $ok ? "Pixel {$pixelId} phản hồi HTTP {$dispatch['http_code']} OK" : "Pixel {$pixelId} lỗi HTTP {$dispatch['http_code']}", $ok);
    }

    /**
     * GET /capi/backfill/preview
     */
    public function previewBackfill(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $days = max(1, min(7, (int)($_GET['days'] ?? 7)));
        $limit = max(10, min(500, (int)($_GET['limit'] ?? 150)));

        $data = CapiHelper::previewBackfillCandidates($this->db, $tid, $days, $limit);
        respond(200, $data);
    }

    /**
     * POST /capi/backfill/run
     */
    public function runBackfill(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $b = getBody();
        $days = max(1, min(7, (int)($b['days'] ?? 7)));
        $limit = max(1, min(300, (int)($b['limit'] ?? 100)));

        $data = CapiHelper::runBackfill($this->db, $tid, $days, $limit);
        respond(200, $data, "Hoàn tất CAPI Backfill {$days} ngày: {$data['success']}/{$data['processed']} thành công");
    }

    /**
     * GET /capi/audiences/preview
     */
    public function previewAudiences(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $data = MetaPlaybookService::previewAudiences($this->db, $tid);
        respond(200, $data);
    }

    /**
     * POST /capi/audiences/sync
     */
    public function syncAudiences(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $b = getBody();
        $pageId = preg_replace('/[^0-9]/', '', (string)($b['page_id'] ?? CapiHelper::DEFAULT_PAGE_ID)) ?: CapiHelper::DEFAULT_PAGE_ID;

        try {
            $data = MetaPlaybookService::syncAllPlaybookAudiences($this->db, $tid, $pageId);
            respond(200, $data, 'Đồng bộ Playbook Custom Audiences & Lookalike thành công');
        } catch (\Throwable $e) {
            respond(400, null, $e->getMessage(), false);
        }
    }

    /**
     * GET /capi/adsets — Inspect live Lead/Prospecting AdSets on MBA 577 (`act_{id}`) for Playbook Readiness
     */
    public function listTargetAdSets(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $settings = CapiHelper::getSettings($this->db);
        $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
        $token = $settings['access_token'];
        if ($token === '') {
            respond(422, null, 'Thiếu Meta Access Token', false);
        }

        $res = MetaPlaybookService::graphGet("act_{$adAccountId}/adsets", [
            'fields' => 'id,name,status,effective_status,campaign{id,name,objective,status},optimization_goal,promoted_object,targeting,daily_budget',
            'filtering' => json_encode([
                ['field' => 'effective_status', 'operator' => 'IN', 'value' => ['ACTIVE', 'PAUSED', 'WITH_ISSUES']],
            ]),
            'limit' => 50,
        ], $token);

        if (!empty($res['error']['message'])) {
            respond(400, null, 'Meta API Error: ' . $res['error']['message'], false);
        }

        $rows = [];
        foreach (($res['data'] ?? []) as $as) {
            $tgt = is_array($as['targeting'] ?? null) ? $as['targeting'] : [];
            $flexCount = count($tgt['flexible_spec'] ?? []);
            $custCount = count($tgt['custom_audiences'] ?? []);
            $exclList = is_array($tgt['excluded_custom_audiences'] ?? null) ? $tgt['excluded_custom_audiences'] : [];
            $exclCount = count($exclList);
            $hasPhoneFarmExcl = false;
            foreach ($exclList as $exItem) {
                $exName = (string)($exItem['name'] ?? '');
                if ($exName === MetaPlaybookService::AUD_EXCL_PHONE_FARM || stripos($exName, 'Phone Farm') !== false) {
                    $hasPhoneFarmExcl = true;
                    break;
                }
            }
            $hasAdv = !empty($tgt['targeting_automation']['advantage_audience']);
            $hasGeoBug = !empty($tgt['targeting_automation']['individual_setting']['geo']);
            $hasPixel = !empty($as['promoted_object']['pixel_id']);

            $rows[] = [
                'id'                        => (string)$as['id'],
                'name'                      => (string)($as['name'] ?? ''),
                'status'                    => (string)($as['status'] ?? ''),
                'effective_status'          => (string)($as['effective_status'] ?? ''),
                'campaign_id'               => (string)($as['campaign']['id'] ?? ''),
                'campaign_name'             => (string)($as['campaign']['name'] ?? ''),
                'optimization_goal'         => (string)($as['optimization_goal'] ?? ''),
                'daily_budget'              => (float)($as['daily_budget'] ?? 0),
                'flexible_layers'           => $flexCount,
                'custom_audiences_count'    => $custCount,
                'excluded_audiences_count'  => $exclCount,
                'phone_farm_excluded'       => $hasPhoneFarmExcl,
                'advantage_audience'        => $hasAdv,
                'geo_conflict_bug'          => $hasGeoBug,
                'has_pixel_promoted_object' => $hasPixel,
                'playbook_compliant'        => ($flexCount >= 2 && $exclCount >= 1 && $hasAdv && !$hasGeoBug),
                'promoted_object'           => $as['promoted_object'] ?? null,
                'targeting_summary'         => [
                    'age_min'                   => $tgt['age_min'] ?? null,
                    'age_max'                   => $tgt['age_max'] ?? null,
                    'age_range'                 => $tgt['age_range'] ?? null,
                    'custom_audiences'          => $tgt['custom_audiences'] ?? [],
                    'excluded_custom_audiences' => $exclList,
                ],
            ];
        }

        respond(200, ['ad_account_id' => $adAccountId, 'adsets' => $rows]);
    }

    /**
     * GET /capi/phone-farm/stats
     */
    public function getPhoneFarmStats(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $stats = CapiHelper::getPhoneFarmStats($this->db, $tid);
        respond(200, $stats);
    }

    /**
     * POST /capi/phone-farm/import — Batch insert Phone Farm blacklist phones (e.g. parsed from Excel/CSV)
     */
    public function importPhoneFarm(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $b = getBody();
        $rawPhones = $b['phones'] ?? [];
        if (is_string($rawPhones)) {
            $rawPhones = preg_split('/[\r\n,;]+/', $rawPhones) ?: [];
        }
        if (!is_array($rawPhones)) {
            respond(422, null, 'Danh sách phones không hợp lệ', false);
        }
        $sourceLabel = trim((string)($b['source_label'] ?? 'L1ABC_rac'));
        $reason = trim((string)($b['reason'] ?? 'phone_farm_fraud'));
        $userId = isset($auth['user_id']) ? (int)$auth['user_id'] : null;

        try {
            $res = CapiHelper::importPhoneFarmBatch($this->db, $tid, $rawPhones, $sourceLabel, $reason, $userId);
            if (!empty($b['sync_to_meta'])) {
                $res['meta_sync'] = MetaPlaybookService::syncPhoneFarmAudience($this->db, $tid, !empty($b['force_reupload']));
            }
            respond(200, $res, 'Đã nạp tệp Phone Farm vào khiên chặn thành công');
        } catch (\Throwable $e) {
            respond(400, null, 'Lỗi import Phone Farm: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /capi/phone-farm/sync-meta — Sync `capi_blocked_phones` -> Meta Audience & optionally shield Active AdSets
     */
    public function syncPhoneFarmToMeta(array $auth): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $b = getBody();
        $forceReupload = !empty($b['force_reupload']);
        $applyToActive = !array_key_exists('apply_to_active_adsets', $b) || !empty($b['apply_to_active_adsets']);

        try {
            $syncRes = MetaPlaybookService::syncPhoneFarmAudience($this->db, $tid, $forceReupload);
            $adsetResults = [];
            if ($applyToActive && !empty($syncRes['id'])) {
                $settings = CapiHelper::getSettings($this->db);
                $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
                $token = $settings['access_token'];
                if ($token !== '') {
                    $exclList = [
                        ['id' => (string)$syncRes['id'], 'name' => (string)($syncRes['name'] ?? MetaPlaybookService::AUD_EXCL_PHONE_FARM)],
                    ];
                    $activeRes = MetaPlaybookService::graphGet("act_{$adAccountId}/adsets", [
                        'fields'    => 'id,name',
                        'filtering' => json_encode([['field' => 'effective_status', 'operator' => 'IN', 'value' => ['ACTIVE']]]),
                        'limit'     => 50,
                    ], $token);
                    foreach (($activeRes['data'] ?? []) as $asRow) {
                        $asId = (string)($asRow['id'] ?? '');
                        if ($asId !== '') {
                            $adsetResults[$asId] = MetaPlaybookService::attachExclusionsPreservingTargeting($this->db, $asId, $exclList);
                        }
                    }
                }
            }
            respond(200, [
                'audience'      => $syncRes,
                'adset_updates' => $adsetResults,
            ], 'Đã đồng bộ tệp loại trừ Phone Farm lên Meta & gắn khiên bảo vệ AdSet Active');
        } catch (\Throwable $e) {
            respond(400, null, $e->getMessage(), false);
        }
    }

    /**
     * POST /capi/adsets/{id}/exclude-phone-farm — Attach Phone Farm Exclusion preserving existing AdSet targeting
     */
    public function excludePhoneFarmOnAdSet(array $auth, string $adsetId): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        try {
            $syncRes = MetaPlaybookService::syncPhoneFarmAudience($this->db, $tid, false);
            $acctAuds = self::lookupPlaybookAudiencesFromAccount($this->db);
            $exclList = [];
            if (!empty($syncRes['id'])) {
                $exclList[] = ['id' => (string)$syncRes['id'], 'name' => (string)($syncRes['name'] ?? MetaPlaybookService::AUD_EXCL_PHONE_FARM)];
            } elseif (!empty($acctAuds['audiences']['excl_phone_farm']['id'])) {
                $exclList[] = $acctAuds['audiences']['excl_phone_farm'];
            }
            if (empty($exclList)) {
                respond(422, null, 'Chưa có tệp MYERP - Loai Tru Phone Farm / Rac trên tài khoản Meta hoặc DB.', false);
            }
            $res = MetaPlaybookService::attachExclusionsPreservingTargeting($this->db, $adsetId, $exclList);
            if (!empty($res['success'])) {
                respond(200, $res, "Đã gắn khiên loại trừ Phone Farm cho AdSet {$adsetId}");
            }
            $err = $res['targeting_update']['error']['message'] ?? 'Meta API từ chối cập nhật exclusion trên AdSet';
            respond(400, $res, $err, false);
        } catch (\Throwable $e) {
            respond(400, null, $e->getMessage(), false);
        }
    }

    /**
     * POST /capi/adsets/{id}/optimize — Apply Playbook 02B 2-Layer Targeting + LAL + Exclusions to an AdSet
     */
    public function optimizeAdSet(array $auth, string $adsetId): void
    {
        requireRole($auth, self::ALLOWED_ROLES);
        $tid = max(1, (int)($auth['tenant_id'] ?? 1));
        $b = getBody();
        $syncFirst = !empty($b['sync_audiences_first']);
        $tryCrmPromo = !empty($b['try_crm_promoted_object']);

        try {
            $syncReport = $syncFirst
                ? MetaPlaybookService::syncAllPlaybookAudiences($this->db, $tid, CapiHelper::DEFAULT_PAGE_ID)
                : self::lookupPlaybookAudiencesFromAccount($this->db);
            $res = MetaPlaybookService::optimizeAdSet($this->db, $adsetId, $syncReport, $tryCrmPromo);
            if (!empty($res['success'])) {
                respond(200, $res, "Đã tối ưu AdSet {$adsetId} theo Playbook 2-Layer Thành Công");
            }
            $err = $res['targeting_update']['error']['message'] ?? 'Meta Graph API rejected targeting update';
            respond(400, $res, $err, false);
        } catch (\Throwable $e) {
            respond(400, null, $e->getMessage(), false);
        }
    }

    private static function lookupPlaybookAudiencesFromAccount(PDO $db): array
    {
        $settings = CapiHelper::getSettings($db);
        $adAccountId = $settings['meta_ad_account_id'] ?: CapiHelper::DEFAULT_AD_ACCOUNT_ID;
        $token = $settings['access_token'];
        $res = MetaPlaybookService::graphGet("act_{$adAccountId}/customaudiences", ['fields' => 'id,name,subtype', 'limit' => 200], $token);
        $byName = [];
        foreach (($res['data'] ?? []) as $aud) {
            if (!empty($aud['name']) && !empty($aud['id'])) {
                $byName[(string)$aud['name']] = ['id' => (string)$aud['id'], 'name' => (string)$aud['name']];
            }
        }
        return [
            'lookalikes' => [
                'lal_1pct'   => $byName[MetaPlaybookService::AUD_LAL_1PCT] ?? $byName[MetaPlaybookService::AUD_LAL_QUALITY_1PCT] ?? null,
                'lal_1_3pct' => $byName[MetaPlaybookService::AUD_LAL_1_3PCT] ?? $byName[MetaPlaybookService::AUD_LAL_QUALITY_1_3PCT] ?? null,
            ],
            'audiences' => [
                'excl_page_save_365d' => $byName[MetaPlaybookService::AUD_EXCL_PAGE_SAVE_365D] ?? null,
                'excl_junk_lost'      => $byName[MetaPlaybookService::AUD_EXCL_JUNK_LOST] ?? null,
                'excl_enrolled'       => $byName[MetaPlaybookService::AUD_EXCL_ENROLLED] ?? null,
                'excl_phone_farm'     => $byName[MetaPlaybookService::AUD_EXCL_PHONE_FARM] ?? null,
            ],
        ];
    }
}
