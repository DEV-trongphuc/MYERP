<?php
/**
 * backend/controllers/DomationOmnichannelController.php
 * ============================================================
 * Unified Omnichannel Customer 360 & Automation Controller for MYERP Contacts.
 *
 * STRICT "3 KHÔNG" MANDATE:
 *   1. KHÔNG TẠO CONTACT MỚI: Never INSERT into `contacts`.
 *   2. KHÔNG CHIA LEAD / KHÔNG ĐỔI OWNER / STAGE / UPDATED_AT: Never modify
 *      `owner_id`, `collaborator_ids`, `team_id`, `status`, `lead_status`,
 *      `pipeline_status`, `stage_id`, or `updated_at` on `contacts`.
 *   3. KHÔNG GỬI THÔNG BÁO: Never INSERT into `notifications` or send alerts to Sales.
 * ============================================================
 */

require_once __DIR__ . '/../utils/DomationContactMatcher.php';

class DomationOmnichannelController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Fetch and verify access to an existing MYERP contact (`deleted_at IS NULL`).
     */
    private function getAuthorizedContact(array $auth, int $contactId): array
    {
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("
            SELECT
                c.id,
                c.tenant_id,
                c.full_name,
                c.email,
                c.phone,
                c.mobile,
                c.phone2,
                c.zalo_phone,
                c.owner_id,
                c.collaborator_ids,
                c.domation_subscriber_id,
                c.marketing_status,
                c.engagement_score,
                c.stats_email_sent,
                c.stats_email_opened,
                c.stats_email_clicked,
                c.last_email_open_at,
                c.last_email_click_at,
                c.last_web_visit_at,
                c.web_pageviews_count,
                c.max_scroll_depth,
                c.active_flow_count,
                c.active_flow_names,
                c.active_voucher_code,
                c.survey_completed_count,
                c.zalo_user_id,
                c.meta_psid
            FROM contacts c
            WHERE c.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
            LIMIT 1
        ");
        $stmt->execute([$contactId, $tenantId]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Không tìm thấy liên hệ', false);
        }
        return $contact;
    }

    /**
     * Find all linked subscriber IDs for a contact (Match-Only).
     */
    private function getSubscriberIdsForContact(array $contact): array
    {
        $contactId = (int)$contact['id'];
        $subIds = [];
        if (!empty($contact['domation_subscriber_id'])) {
            $subIds[] = (string)$contact['domation_subscriber_id'];
        }
        try {
            $emailNorm = DomationContactMatcher::normalizeEmail((string)($contact['email'] ?? ''));
            $rawPhone  = (string)($contact['phone'] ?: ($contact['mobile'] ?: ($contact['phone2'] ?? '')));
            $phone9    = DomationContactMatcher::normalizePhone9($rawPhone);

            $conds  = ["contact_id = ?"];
            $params = [$contactId];
            if ($emailNorm !== '') {
                $conds[]  = "(email_norm = ? OR LOWER(TRIM(email)) = ?)";
                $params[] = $emailNorm;
                $params[] = $emailNorm;
            }
            if ($phone9 !== '') {
                $conds[]  = "phone_norm9 = ?";
                $params[] = $phone9;
            }

            $stmt = $this->db->prepare("SELECT id FROM subscribers WHERE (" . implode(' OR ', $conds) . ") ORDER BY updated_at DESC, joined_at DESC LIMIT 20");
            $stmt->execute($params);
            while ($id = $stmt->fetchColumn()) {
                $idStr = (string)$id;
                if ($idStr !== '' && !in_array($idStr, $subIds, true)) {
                    $subIds[] = $idStr;
                }
            }
        } catch (\Throwable $e) {
        }
        return $subIds;
    }

    /**
     * Ensure a DOMATION `subscribers` record exists for an existing MYERP contact
     * when a user explicitly enrolls the contact into a Flow or issues a Voucher.
     * NOTE: Only creates a row in `subscribers` if needed — NEVER creates a row in `contacts`!
     */
    private function ensureSubscriberForContact(array &$contact, int $workspaceId = 1): ?string
    {
        $contactId = (int)$contact['id'];
        $syncRes = DomationContactMatcher::syncContactMatchOnly($this->db, $contactId);
        if (!empty($syncRes['subscriber_id'])) {
            $contact['domation_subscriber_id'] = (string)$syncRes['subscriber_id'];
            return (string)$syncRes['subscriber_id'];
        }

        if (!empty($contact['domation_subscriber_id'])) {
            $stmtChk = $this->db->prepare("SELECT id FROM subscribers WHERE id = ? LIMIT 1");
            $stmtChk->execute([(string)$contact['domation_subscriber_id']]);
            if ($stmtChk->fetchColumn()) {
                return (string)$contact['domation_subscriber_id'];
            }
        }

        // Create a subscriber row in `subscribers` linked to this existing contactId
        $rawPhone = !empty($contact['phone']) ? (string)$contact['phone'] : (!empty($contact['mobile']) ? (string)$contact['mobile'] : '');
        $phone9   = DomationContactMatcher::normalizePhone9($rawPhone);
        $rawEmail = trim((string)($contact['email'] ?? ''));
        $emailNorm = DomationContactMatcher::normalizeEmail($rawEmail);
        if ($rawEmail === '') {
            $rawEmail = ($phone9 !== '' ? $phone9 : ('contact_' . $contactId)) . '@no-email.domation';
        }

        $fullName = trim((string)($contact['full_name'] ?? ''));
        $parts = preg_split('/\s+/', $fullName);
        $lastName = $parts ? array_pop($parts) : '';
        $firstName = $parts ? implode(' ', $parts) : $lastName;
        if ($firstName !== '' && $lastName === $firstName) {
            $lastName = '';
        }

        $subId = (string)(int)(microtime(true) * 1000) . (string)random_int(10, 99);
        try {
            $stmtIns = $this->db->prepare("
                INSERT INTO subscribers (
                    id, workspace_id, email, first_name, last_name, phone_number,
                    status, source, contact_id, phone_norm9, email_norm, joined_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'CRM Manual Action', ?, ?, ?, NOW(), NOW())
            ");
            $stmtIns->execute([
                $subId,
                $workspaceId,
                $rawEmail,
                $firstName,
                $lastName,
                $rawPhone !== '' ? $rawPhone : null,
                $contactId,
                $phone9 !== '' ? $phone9 : null,
                $emailNorm !== '' ? $emailNorm : null,
            ]);
            DomationContactMatcher::refreshContactOmnichannelStats($this->db, $contactId);
            $contact['domation_subscriber_id'] = $subId;
            return $subId;
        } catch (\Throwable $e) {
            error_log("[DomationOmnichannelController::ensureSubscriberForContact] " . $e->getMessage());
            return null;
        }
    }

    /**
     * GET /api/contacts/:id/omnichannel-journey
     * Returns unified Omnichannel 360 summary, chronological timeline, active flows,
     * vouchers, surveys, web sessions, and chat transcripts for an existing contact.
     */
    public function getOmnichannelJourney(array $auth, int $contactId): void
    {
        $contact = $this->getAuthorizedContact($auth, $contactId);

        // Silently run Match-Only sync for this contact so any matching subscriber by 9-digit phone or email is linked
        DomationContactMatcher::syncContactMatchOnly($this->db, $contactId);

        // Re-fetch updated omnichannel columns on contact
        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        $primarySubId = $subIds[0] ?? null;

        // 1. Primary subscriber details, tags, and lists
        $subscriberRow   = null;
        $subscriberTags  = [];
        $subscriberLists = [];

        if (!empty($subIds)) {
            $inSub = implode(',', array_fill(0, count($subIds), '?'));
            try {
                $stmtSub = $this->db->prepare("SELECT * FROM subscribers WHERE id IN ($inSub) ORDER BY updated_at DESC, joined_at DESC LIMIT 1");
                $stmtSub->execute($subIds);
                $subscriberRow = $stmtSub->fetch(PDO::FETCH_ASSOC) ?: null;
            } catch (\Throwable $e) {
            }

            try {
                $stmtTags = $this->db->prepare("
                    SELECT DISTINCT dt.name AS tag
                    FROM subscriber_tags st
                    INNER JOIN domation_tags dt ON dt.id = st.tag_id
                    WHERE st.subscriber_id IN ($inSub) AND dt.name IS NOT NULL AND dt.name != ''
                    ORDER BY dt.name ASC
                ");
                $stmtTags->execute($subIds);
                $subscriberTags = $stmtTags->fetchAll(PDO::FETCH_COLUMN) ?: [];
            } catch (\Throwable $e) {
            }

            try {
                $stmtLists = $this->db->prepare("
                    SELECT DISTINCT l.id, l.name
                    FROM subscriber_lists sl
                    JOIN lists l ON l.id = sl.list_id
                    WHERE sl.subscriber_id IN ($inSub)
                    ORDER BY l.name ASC
                ");
                $stmtLists->execute($subIds);
                $subscriberLists = $stmtLists->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {
            }
        }

        $activeFlowsData = $this->fetchContactFlowsData($contactId, $subIds);
        $vouchersData    = $this->fetchContactVouchersData($contactId, $subIds);
        $surveysData     = $this->fetchContactSurveysData($contactId, $subIds);
        $webSessionsData = $this->fetchContactWebSessionsData($contactId, $subIds, $contact);
        $chatMessages    = $this->fetchContactChatMessages($contactId, $subIds, $contact);
        $timeline        = $this->buildUnifiedTimeline(
            $contactId,
            $subIds,
            $surveysData,
            $vouchersData['vouchers'],
            $webSessionsData,
            $chatMessages,
            $activeFlowsData,
            $contact,
            $subscriberRow
        );

        $summary = [
            'contact_id'             => (int)$contact['id'],
            'subscriber_id'          => $primarySubId,
            'subscriber_ids'         => $subIds,
            'marketing_status'       => $contact['marketing_status'] ?? 'subscribed',
            'engagement_score'       => (int)($contact['engagement_score'] ?? 0),
            'stats_email_sent'       => max((int)($contact['stats_email_sent'] ?? 0), (int)($subscriberRow['stats_sent'] ?? 0)),
            'stats_email_opened'     => max((int)($contact['stats_email_opened'] ?? 0), (int)($subscriberRow['stats_opened'] ?? 0)),
            'stats_email_clicked'    => max((int)($contact['stats_email_clicked'] ?? 0), (int)($subscriberRow['stats_clicked'] ?? 0)),
            'last_email_open_at'     => $contact['last_email_open_at'] ?? ($subscriberRow['last_open_at'] ?? null),
            'last_email_click_at'    => $contact['last_email_click_at'] ?? ($subscriberRow['last_click_at'] ?? null),
            'last_web_visit_at'      => $contact['last_web_visit_at'] ?? null,
            'web_sessions_count'     => count($webSessionsData['sessions'] ?? []),
            'web_pageviews_count'    => max((int)($contact['web_pageviews_count'] ?? 0), count($webSessionsData['page_views'] ?? [])),
            'max_scroll_depth'       => (int)($contact['max_scroll_depth'] ?? 0),
            'active_flow_count'      => max((int)($contact['active_flow_count'] ?? 0), count($activeFlowsData['active_flows'])),
            'completed_flow_count'   => count($activeFlowsData['flow_history']),
            'active_flow_names'      => $contact['active_flow_names'] ?? null,
            'active_voucher_code'    => $contact['active_voucher_code'] ?? null,
            'survey_completed_count' => max((int)($contact['survey_completed_count'] ?? 0), count($surveysData)),
            'zalo_user_id'           => $contact['zalo_user_id'] ?? ($subscriberRow['zalo_user_id'] ?? null),
            'meta_psid'              => $contact['meta_psid'] ?? ($subscriberRow['meta_psid'] ?? null),
            'subscriber_tags'        => $subscriberTags,
            'subscriber_lists'       => $subscriberLists,
            'subscriber'             => $subscriberRow,
        ];

        respond(200, [
            'summary'             => $summary,
            'timeline'            => $timeline,
            'unified_timeline'    => $timeline,
            'active_flows'        => $activeFlowsData['active_flows'],
            'completed_flows'     => $activeFlowsData['flow_history'],
            'flow_history'        => $activeFlowsData['flow_history'],
            'available_flows'     => $activeFlowsData['available_flows'],
            'vouchers'            => $vouchersData['vouchers'],
            'available_campaigns' => $vouchersData['available_campaigns'],
            'surveys'             => $surveysData,
            'survey_responses'    => $surveysData,
            'web_sessions'        => $webSessionsData['sessions'],
            'web_page_views'      => $webSessionsData['page_views'],
            'web_visitors'        => $webSessionsData['visitors'],
            'chat_messages'       => $chatMessages,
        ]);
    }

    // Aliases for flexible routing
    public function journey(array $auth, int $contactId): void
    {
        $this->getOmnichannelJourney($auth, $contactId);
    }

    public function show(array $auth, int $contactId): void
    {
        $this->getOmnichannelJourney($auth, $contactId);
    }

    /**
     * GET /api/contacts/:id/omnichannel-flows
     */
    public function getContactFlows(array $auth, int $contactId): void
    {
        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        respond(200, $this->fetchContactFlowsData($contactId, $subIds));
    }

    public function flows(array $auth, int $contactId): void
    {
        $this->getContactFlows($auth, $contactId);
    }

    /**
     * POST /api/contacts/:id/omnichannel-flows/enroll
     * Body: { "flow_id": "...", "step_id": optional }
     */
    public function enrollContactInFlow(array $auth, int $contactId): void
    {
        if (strtolower($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        }

        $contact = $this->getAuthorizedContact($auth, $contactId);
        $b = getBody();
        $flowId = trim((string)($b['flow_id'] ?? ''));
        $flowNameInput = trim((string)($b['flow_name'] ?? ''));
        if ($flowId === '' && $flowNameInput === '') {
            respond(422, null, 'Vui lòng chọn kịch bản Automation Flow (flow_id)', false);
        }

        // Verify flow exists by id or fuzzy name
        $flow = null;
        if ($flowId !== '') {
            $stmtFlow = $this->db->prepare("SELECT id, name, status, steps, nodes, workspace_id FROM flows WHERE id = ? LIMIT 1");
            $stmtFlow->execute([$flowId]);
            $flow = $stmtFlow->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        if (!$flow && $flowNameInput !== '') {
            $stmtFlow = $this->db->prepare("SELECT id, name, status, steps, nodes, workspace_id FROM flows WHERE name LIKE ? ORDER BY updated_at DESC LIMIT 1");
            $stmtFlow->execute(['%' . $flowNameInput . '%']);
            $flow = $stmtFlow->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($flow) {
                $flowId = (string)$flow['id'];
            }
        }
        if (!$flow) {
            respond(404, null, 'Không tìm thấy kịch bản Flow', false);
        }

        $workspaceId = (int)($flow['workspace_id'] ?? $auth['tenant_id'] ?? 1);
        $subId = $this->ensureSubscriberForContact($contact, $workspaceId);
        if (!$subId) {
            respond(500, null, 'Không thể khởi tạo hồ sơ Subscriber cho liên hệ này', false);
        }

        // Determine starting step_id
        $requestedStepId = trim((string)($b['step_id'] ?? ''));
        $startStepId = $requestedStepId;
        $steps = json_decode((string)($flow['steps'] ?? '[]'), true) ?: [];
        if ($startStepId === '' && !empty($steps)) {
            // Find trigger node or first step
            $triggerNodeId = null;
            foreach ($steps as $st) {
                if (($st['type'] ?? '') === 'trigger') {
                    $triggerNodeId = (string)($st['id'] ?? '');
                    if (!empty($st['nextStepId'])) {
                        $startStepId = (string)$st['nextStepId'];
                        break;
                    }
                }
            }
            if ($startStepId === '' && $triggerNodeId !== null) {
                foreach ($steps as $st) {
                    if (($st['parentId'] ?? '') === $triggerNodeId && !empty($st['id'])) {
                        $startStepId = (string)$st['id'];
                        break;
                    }
                }
            }
            if ($startStepId === '' && !empty($steps[0]['id'])) {
                $startStepId = (string)$steps[0]['id'];
            }
        }
        if ($startStepId === '') {
            $startStepId = 'start';
        }

        // Check if already active in this flow
        $stmtChk = $this->db->prepare("
            SELECT id FROM subscriber_flow_states
            WHERE (subscriber_id = ? OR contact_id = ?)
              AND flow_id = ?
              AND status IN ('waiting', 'processing')
            LIMIT 1
        ");
        $stmtChk->execute([$subId, $contactId, $flowId]);
        $existingStateId = $stmtChk->fetchColumn();
        if ($existingStateId) {
            respond(409, null, 'Liên hệ này đang ở trong kịch bản "' . ($flow['name'] ?? $flowId) . '" rồi', false);
        }

        try {
            $stmtIns = $this->db->prepare("
                INSERT INTO subscriber_flow_states (
                    workspace_id, subscriber_id, contact_id, flow_id, step_id,
                    scheduled_at, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, NOW(), 'waiting', NOW(), NOW())
            ");
            $stmtIns->execute([$workspaceId, $subId, $contactId, $flowId, $startStepId]);
            $newStateId = (int)$this->db->lastInsertId();

            // Increment flow stat_enrolled
            try {
                $this->db->prepare("UPDATE flows SET stat_enrolled = COALESCE(stat_enrolled, 0) + 1 WHERE id = ?")
                         ->execute([$flowId]);
            } catch (\Throwable $eStat) {
            }

            // Log activity in subscriber_activity
            try {
                $this->db->prepare("
                    INSERT INTO subscriber_activity (
                        workspace_id, subscriber_id, contact_id, type, reference_id, reference_name, details, created_at
                    ) VALUES (?, ?, ?, 'enter_flow', ?, ?, ?, NOW())
                ")->execute([
                    $workspaceId,
                    $subId,
                    $contactId,
                    $flowId,
                    'Tham gia kịch bản: ' . ($flow['name'] ?? $flowId),
                    json_encode([
                        'flow_id'     => $flowId,
                        'flow_name'   => $flow['name'] ?? '',
                        'enrolled_by' => $auth['user_id'] ?? null,
                    ], JSON_UNESCAPED_UNICODE),
                ]);
            } catch (\Throwable $eAct) {
            }

            DomationContactMatcher::refreshContactOmnichannelStats($this->db, $contactId);

            $subIds = $this->getSubscriberIdsForContact($contact);
            respond(200, [
                'state_id' => $newStateId,
                'flow_id'  => $flowId,
                'flows'    => $this->fetchContactFlowsData($contactId, $subIds),
            ], 'Đã thêm liên hệ vào kịch bản "' . ($flow['name'] ?? $flowId) . '"');
        } catch (\Throwable $e) {
            respond(500, null, 'Không thể thêm vào kịch bản: ' . $e->getMessage(), false);
        }
    }

    public function enrollFlow(array $auth, int $contactId): void
    {
        $this->enrollContactInFlow($auth, $contactId);
    }

    /**
     * PUT/PATCH/DELETE /api/contacts/:id/omnichannel-flows/:stateId
     * Body: { "action": "pause" | "resume" | "cancel", "state_id": optional }
     */
    public function updateContactFlowState(array $auth, int $contactId, int $stateId = 0): void
    {
        if (strtolower($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        }

        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        $b       = getBody();

        if ($stateId <= 0 && !empty($b['state_id'])) {
            $stateId = (int)$b['state_id'];
        }
        if ($stateId <= 0 && !empty($b['enrollment_id'])) {
            $stateId = (int)$b['enrollment_id'];
        }
        if ($stateId <= 0 && !empty($b['flow_id'])) {
            $stmtFindState = $this->db->prepare("SELECT id FROM subscriber_flow_states WHERE contact_id = ? AND flow_id = ? ORDER BY id DESC LIMIT 1");
            $stmtFindState->execute([$contactId, (string)$b['flow_id']]);
            $stateId = (int)($stmtFindState->fetchColumn() ?: 0);
        }
        $action = strtolower(trim((string)($b['action'] ?? ($_SERVER['REQUEST_METHOD'] === 'DELETE' ? 'cancel' : 'cancel'))));

        if ($stateId <= 0) {
            respond(422, null, 'Thiếu ID trạng thái kịch bản (state_id)', false);
        }

        // Verify ownership of flow state by contact_id or subscriber_id
        $stmtChk = $this->db->prepare("SELECT * FROM subscriber_flow_states WHERE id = ? LIMIT 1");
        $stmtChk->execute([$stateId]);
        $stateRow = $stmtChk->fetch(PDO::FETCH_ASSOC);
        if (!$stateRow) {
            respond(404, null, 'Không tìm thấy trạng thái kịch bản', false);
        }

        $belongsToContact = ((int)($stateRow['contact_id'] ?? 0) === $contactId)
            || (!empty($stateRow['subscriber_id']) && in_array((string)$stateRow['subscriber_id'], $subIds, true));
        if (!$belongsToContact) {
            respond(403, null, 'Trạng thái kịch bản không thuộc về liên hệ này', false);
        }

        if ($action === 'pause' || $action === 'paused') {
            $newStatus = 'paused';
            $stmtUpd = $this->db->prepare("UPDATE subscriber_flow_states SET status = 'paused', updated_at = NOW() WHERE id = ?");
            $stmtUpd->execute([$stateId]);
            $msg = 'Đã tạm dừng kịch bản cho liên hệ này';
        } elseif ($action === 'resume' || $action === 'waiting') {
            $newStatus = 'waiting';
            $stmtUpd = $this->db->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = NOW(), updated_at = NOW() WHERE id = ?");
            $stmtUpd->execute([$stateId]);
            $msg = 'Đã tiếp tục chạy kịch bản cho liên hệ này';
        } else {
            $newStatus = 'cancelled';
            $stmtUpd = $this->db->prepare("UPDATE subscriber_flow_states SET status = 'cancelled', updated_at = NOW() WHERE id = ?");
            $stmtUpd->execute([$stateId]);
            $msg = 'Đã dừng và gỡ liên hệ khỏi kịch bản';
        }

        DomationContactMatcher::refreshContactOmnichannelStats($this->db, $contactId);

        respond(200, [
            'state_id'   => $stateId,
            'new_status' => $newStatus,
            'flows'      => $this->fetchContactFlowsData($contactId, $subIds),
        ], $msg);
    }

    public function updateFlowState(array $auth, int $contactId, int $stateId = 0): void
    {
        $this->updateContactFlowState($auth, $contactId, $stateId);
    }

    /**
     * GET /api/contacts/:id/omnichannel-vouchers
     */
    public function getContactVouchers(array $auth, int $contactId): void
    {
        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        respond(200, $this->fetchContactVouchersData($contactId, $subIds));
    }

    public function vouchers(array $auth, int $contactId): void
    {
        $this->getContactVouchers($auth, $contactId);
    }

    /**
     * POST /api/contacts/:id/omnichannel-vouchers/issue
     * Body: { "campaign_id": 123 }
     */
    public function issueContactVoucher(array $auth, int $contactId): void
    {
        if (strtolower($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền cấp mã voucher', false);
        }

        $contact = $this->getAuthorizedContact($auth, $contactId);
        $b = getBody();
        $campaignId = (int)($b['campaign_id'] ?? $b['voucher_id'] ?? 0);
        if ($campaignId <= 0) {
            $stmtFirstCamp = $this->db->query("SELECT id FROM voucher_campaigns ORDER BY id DESC LIMIT 1");
            $campaignId = (int)($stmtFirstCamp ? $stmtFirstCamp->fetchColumn() : 0);
        }
        if ($campaignId <= 0) {
            respond(422, null, 'Vui lòng chọn chiến dịch Voucher (campaign_id)', false);
        }

        $stmtCamp = $this->db->prepare("SELECT * FROM voucher_campaigns WHERE id = ? LIMIT 1");
        $stmtCamp->execute([$campaignId]);
        $campaign = $stmtCamp->fetch(PDO::FETCH_ASSOC);
        if (!$campaign) {
            respond(404, null, 'Không tìm thấy chiến dịch Voucher', false);
        }

        $workspaceId = (int)($campaign['workspace_id'] ?? $auth['tenant_id'] ?? 1);
        $subId = $this->ensureSubscriberForContact($contact, $workspaceId);
        if (!$subId) {
            respond(500, null, 'Không thể khởi tạo Subscriber để cấp Voucher', false);
        }

        require_once __DIR__ . '/../automation/voucher_helper.php';
        $result = assignVoucherToSubscriber($this->db, $campaignId, $subId, $workspaceId);

        if (empty($result['success'])) {
            // Fallback: generate a new voucher code if pool is empty and campaign is active
            $prefix = strtoupper(trim((string)($campaign['prefix'] ?? 'VIP')));
            if ($prefix === '') {
                $prefix = 'VIP';
            }
            $randomSuffix = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $generatedCode = $prefix . '-' . $randomSuffix;

            $expiresAt = null;
            if (!empty($campaign['expires_at'])) {
                $expiresAt = $campaign['expires_at'];
            } elseif (!empty($campaign['validity_days']) && (int)$campaign['validity_days'] > 0) {
                $expiresAt = date('Y-m-d H:i:s', strtotime('+' . (int)$campaign['validity_days'] . ' days'));
            }

            try {
                $this->db->beginTransaction();
                $stmtIns = $this->db->prepare("
                    INSERT INTO voucher_codes (
                        workspace_id, campaign_id, code, status, subscriber_id, contact_id,
                        sent_at, claimed_at, expires_at, created_at
                    ) VALUES (?, ?, ?, 'unused', ?, ?, NOW(), NOW(), ?, NOW())
                ");
                $stmtIns->execute([
                    $workspaceId,
                    $campaignId,
                    $generatedCode,
                    $subId,
                    $contactId,
                    $expiresAt,
                ]);
                $voucherId = (int)$this->db->lastInsertId();

                $this->db->prepare("
                    UPDATE voucher_campaigns
                    SET total_codes = COALESCE(total_codes, 0) + 1,
                        claimed_count = COALESCE(claimed_count, 0) + 1
                    WHERE id = ?
                ")->execute([$campaignId]);

                $this->db->prepare("
                    INSERT INTO subscriber_activity (
                        workspace_id, subscriber_id, contact_id, type, reference_id, reference_name, details, created_at
                    ) VALUES (?, ?, ?, 'voucher_sent', ?, ?, ?, NOW())
                ")->execute([
                    $workspaceId,
                    $subId,
                    $contactId,
                    (string)$campaignId,
                    'Cấp mã Voucher: ' . $generatedCode,
                    json_encode([
                        'voucher_code'  => $generatedCode,
                        'campaign_id'   => $campaignId,
                        'campaign_name' => $campaign['name'] ?? '',
                        'issued_by'     => $auth['user_id'] ?? null,
                    ], JSON_UNESCAPED_UNICODE),
                ]);

                $this->db->commit();
                $result = [
                    'success'       => true,
                    'code'          => $generatedCode,
                    'voucher_id'    => $voucherId,
                    'campaign_name' => $campaign['name'] ?? '',
                ];
            } catch (\Throwable $eGen) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                respond(422, null, $result['message'] ?? ('Không thể cấp mã Voucher: ' . $eGen->getMessage()), false);
            }
        } else {
            // Ensure contact_id is stamped on the assigned voucher_codes row
            if (!empty($result['voucher_id'])) {
                try {
                    $this->db->prepare("UPDATE voucher_codes SET contact_id = ? WHERE id = ?")
                             ->execute([$contactId, (int)$result['voucher_id']]);
                } catch (\Throwable $eUpdVc) {
                }
            }
        }

        DomationContactMatcher::refreshContactOmnichannelStats($this->db, $contactId);
        $subIds = $this->getSubscriberIdsForContact($contact);

        respond(200, [
            'issued_voucher' => $result,
            'vouchers_data'  => $this->fetchContactVouchersData($contactId, $subIds),
        ], 'Đã cấp mã Voucher ' . ($result['code'] ?? '') . ' thành công');
    }

    public function issueVoucher(array $auth, int $contactId): void
    {
        $this->issueContactVoucher($auth, $contactId);
    }

    /**
     * POST /api/contacts/:id/omnichannel-vouchers/redeem
     * Body: { "code": "VIP-XXXX" }
     */
    public function redeemContactVoucher(array $auth, int $contactId): void
    {
        if (strtolower($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền gạch nợ voucher', false);
        }

        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        $b       = getBody();
        $code    = strtoupper(trim((string)($b['code'] ?? '')));

        if ($code === '') {
            respond(422, null, 'Vui lòng cung cấp mã Voucher (code)', false);
        }

        try {
            $this->db->beginTransaction();

            $stmtVc = $this->db->prepare("
                SELECT vc.*, vcamp.name AS campaign_name
                FROM voucher_codes vc
                LEFT JOIN voucher_campaigns vcamp ON vcamp.id = vc.campaign_id
                WHERE vc.code = ?
                FOR UPDATE
            ");
            $stmtVc->execute([$code]);
            $voucher = $stmtVc->fetch(PDO::FETCH_ASSOC);

            if (!$voucher) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy mã Voucher "' . $code . '"', false);
            }

            if (($voucher['status'] ?? '') === 'used') {
                $this->db->rollBack();
                respond(409, null, 'Mã Voucher "' . $code . '" đã được sử dụng trước đó', false);
            }

            if (!empty($voucher['expires_at']) && strtotime((string)$voucher['expires_at']) < time()) {
                $this->db->rollBack();
                respond(422, null, 'Mã Voucher "' . $code . '" đã hết hạn sử dụng', false);
            }

            $subId = !empty($voucher['subscriber_id']) ? (string)$voucher['subscriber_id'] : ($subIds[0] ?? null);

            $stmtUpd = $this->db->prepare("
                UPDATE voucher_codes
                SET status = 'used',
                    used_at = NOW(),
                    contact_id = COALESCE(contact_id, ?)
                WHERE id = ? AND status != 'used'
            ");
            $stmtUpd->execute([$contactId, (int)$voucher['id']]);
            if ($stmtUpd->rowCount() === 0) {
                $this->db->rollBack();
                respond(409, null, 'Mã Voucher đã được sử dụng ở phiên giao dịch khác', false);
            }

            if ($subId) {
                $this->db->prepare("
                    INSERT INTO subscriber_activity (
                        workspace_id, subscriber_id, contact_id, type, reference_id, reference_name, details, created_at
                    ) VALUES (?, ?, ?, 'voucher_redeem', ?, ?, ?, NOW())
                ")->execute([
                    (int)($voucher['workspace_id'] ?? 1),
                    $subId,
                    $contactId,
                    (string)($voucher['campaign_id'] ?? ''),
                    'Đã sử dụng mã ưu đãi: ' . $code,
                    json_encode([
                        'voucher_code'  => $code,
                        'campaign_id'   => $voucher['campaign_id'] ?? null,
                        'campaign_name' => $voucher['campaign_name'] ?? '',
                        'redeemed_by'   => $auth['user_id'] ?? null,
                    ], JSON_UNESCAPED_UNICODE),
                ]);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi gạch nợ Voucher: ' . $e->getMessage(), false);
        }

        DomationContactMatcher::refreshContactOmnichannelStats($this->db, $contactId);

        respond(200, [
            'code'          => $code,
            'vouchers_data' => $this->fetchContactVouchersData($contactId, $subIds),
        ], 'Đã xác nhận sử dụng mã Voucher "' . $code . '"');
    }

    public function redeemVoucher(array $auth, int $contactId): void
    {
        $this->redeemContactVoucher($auth, $contactId);
    }

    /**
     * GET /api/contacts/:id/omnichannel-surveys
     */
    public function getContactSurveys(array $auth, int $contactId): void
    {
        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        respond(200, $this->fetchContactSurveysData($contactId, $subIds));
    }

    public function surveys(array $auth, int $contactId): void
    {
        $this->getContactSurveys($auth, $contactId);
    }

    /**
     * GET /api/contacts/:id/omnichannel-web-sessions
     */
    public function getContactWebSessions(array $auth, int $contactId): void
    {
        $contact = $this->getAuthorizedContact($auth, $contactId);
        $subIds  = $this->getSubscriberIdsForContact($contact);
        respond(200, $this->fetchContactWebSessionsData($contactId, $subIds, $contact));
    }

    public function webSessions(array $auth, int $contactId): void
    {
        $this->getContactWebSessions($auth, $contactId);
    }

    /**
     * POST /api/contacts/:id/omnichannel-sync
     * Runs Match-Only identity resolution for a single contact and returns updated journey.
     */
    public function syncContactMatchOnly(array $auth, int $contactId): void
    {
        $this->getAuthorizedContact($auth, $contactId);
        DomationContactMatcher::syncContactMatchOnly($this->db, $contactId);
        $this->getOmnichannelJourney($auth, $contactId);
    }

    public function syncContact(array $auth, int $contactId): void
    {
        $this->syncContactMatchOnly($auth, $contactId);
    }

    /**
     * POST /api/automation/match-sync
     * Admin / Manager / Marketing endpoint to run bulk silent Match-Only sync.
     */
    public function triggerSilentMatchSync(array $auth): void
    {
        $role = strtolower($auth['role'] ?? '');
        if (!in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'marketing'], true)) {
            respond(403, null, 'Chỉ Admin, Quản lý hoặc Marketing mới có quyền chạy đồng bộ đối sánh dữ liệu', false);
        }

        $b = getBody();
        $sourceDb = isset($b['source_db']) && is_string($b['source_db']) ? trim($b['source_db']) : 'vhvxoigh_mail_auto';
        $summary  = DomationContactMatcher::runBulkMatchAndRefresh($this->db, $sourceDb !== '' ? $sourceDb : null);

        respond(200, $summary, 'Đã chạy đồng bộ đối sánh Match-Only thành công');
    }

    public function bulkMatchSync(array $auth): void
    {
        $this->triggerSilentMatchSync($auth);
    }

    /**
     * Dispatch `/api/domation/{resource}/{subId}` requests to `backend/automation/{script}.php`
     * with clean `$_GET['action']` normalization and `_method` override support.
     */
    public function dispatchAutomationEndpoint(array $auth, string $resource, ?string $subId = null): void
    {
        $GLOBALS['domation_auth'] = $auth;
        $GLOBALS['pdo'] = $this->db;
        $pdo = $this->db;

        // Normalize _method override
        $overrideMethod = $_GET['_method'] ?? $_POST['_method'] ?? $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? null;
        if (is_string($overrideMethod) && $overrideMethod !== '') {
            $upperOverride = strtoupper(trim($overrideMethod));
            if (in_array($upperOverride, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                $_SERVER['REQUEST_METHOD'] = $upperOverride;
            }
        }

        // Prevent routed ?action=domation/... from polluting endpoint $_GET['action']
        if (isset($_GET['action']) && is_string($_GET['action']) && strpos($_GET['action'], 'domation/') === 0) {
            if (isset($_GET['domation_action']) && $_GET['domation_action'] !== '') {
                $_GET['action'] = $_GET['domation_action'];
            } else {
                unset($_GET['action']);
            }
        }

        $cleanResource = preg_replace('/[^a-zA-Z0-9_-]/', '', str_replace('.php', '', $resource));
        $aliasMap = [
            'vouchers'       => 'voucher_campaigns',
            'web_properties' => 'web_tracking',
            'visitors'       => 'web_tracking',
        ];
        if ($cleanResource === 'subscribers_bulk') {
            $cleanResource = 'subscribers';
            if (!isset($_GET['route'])) {
                $_GET['route'] = 'subscribers_bulk';
            }
        } elseif (isset($aliasMap[$cleanResource])) {
            $cleanResource = $aliasMap[$cleanResource];
        }

        if ($subId !== null && $subId !== '') {
            if (!isset($_GET['id'])) {
                $_GET['id'] = $subId;
            }
            if (!isset($_GET['route'])) {
                $_GET['route'] = $subId;
            }
        }

        $targetScript = __DIR__ . '/../automation/' . $cleanResource . '.php';
        if (!is_file($targetScript)) {
            respond(404, null, 'Automation endpoint not found: ' . $cleanResource, false);
        }

        require $targetScript;
        exit;
    }

    // =========================================================================
    // INTERNAL DATA AGGREGATORS
    // =========================================================================

    private function fetchContactFlowsData(int $contactId, array $subIds): array
    {
        $activeFlows    = [];
        $flowHistory    = [];
        $availableFlows = [];

        try {
            $conds  = ["sfs.contact_id = ?"];
            $params = [$contactId];
            if (!empty($subIds)) {
                $inSub  = implode(',', array_fill(0, count($subIds), '?'));
                $conds[] = "sfs.subscriber_id IN ($inSub)";
                $params  = array_merge($params, $subIds);
            }

            $stmt = $this->db->prepare("
                SELECT
                    sfs.id,
                    sfs.subscriber_id,
                    sfs.contact_id,
                    sfs.flow_id,
                    sfs.step_id,
                    sfs.scheduled_at,
                    sfs.status,
                    sfs.created_at,
                    sfs.updated_at,
                    f.name AS flow_name,
                    f.status AS flow_status,
                    f.trigger_type,
                    f.steps,
                    f.nodes
                FROM subscriber_flow_states sfs
                LEFT JOIN flows f ON f.id = sfs.flow_id
                WHERE (" . implode(' OR ', $conds) . ")
                ORDER BY sfs.updated_at DESC, sfs.id DESC
                LIMIT 50
            ");
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($rows as $r) {
                $stepLabel = (string)($r['step_id'] ?? '');
                $stepType  = '';
                $stepsArr  = json_decode((string)($r['steps'] ?? '[]'), true) ?: [];
                foreach ($stepsArr as $st) {
                    if ((string)($st['id'] ?? '') === $stepLabel) {
                        $stepLabel = (string)($st['label'] ?? $st['title'] ?? $st['type'] ?? $stepLabel);
                        $stepType  = (string)($st['type'] ?? '');
                        break;
                    }
                }
                unset($r['steps'], $r['nodes']);
                $r['step_label'] = $stepLabel;
                $r['step_type']  = $stepType;

                if (in_array($r['status'] ?? '', ['waiting', 'processing', 'paused'], true)) {
                    $activeFlows[] = $r;
                } else {
                    $flowHistory[] = $r;
                }
            }
        } catch (\Throwable $e) {
        }

        try {
            $stmtAvail = $this->db->query("
                SELECT id, name, description, status, trigger_type, stat_enrolled, stat_completed
                FROM flows
                WHERE status IN ('active', 'draft')
                ORDER BY (status = 'active') DESC, updated_at DESC
                LIMIT 100
            ");
            if ($stmtAvail) {
                $availableFlows = $stmtAvail->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
        } catch (\Throwable $e) {
        }

        return [
            'active_flows'    => $activeFlows,
            'flow_history'    => $flowHistory,
            'available_flows' => $availableFlows,
        ];
    }

    private function fetchContactVouchersData(int $contactId, array $subIds): array
    {
        $vouchers           = [];
        $availableCampaigns = [];

        try {
            $conds  = ["vc.contact_id = ?"];
            $params = [$contactId];
            if (!empty($subIds)) {
                $inSub   = implode(',', array_fill(0, count($subIds), '?'));
                $conds[] = "vc.subscriber_id IN ($inSub)";
                $params  = array_merge($params, $subIds);
            }

            $stmt = $this->db->prepare("
                SELECT
                    vc.id,
                    vc.campaign_id,
                    vc.code,
                    vc.status,
                    vc.subscriber_id,
                    vc.contact_id,
                    vc.sent_at,
                    vc.claimed_at,
                    vc.used_at,
                    vc.expires_at,
                    vc.created_at,
                    vcamp.name AS campaign_name,
                    vcamp.prefix AS campaign_prefix,
                    vcamp.discount_type,
                    vcamp.discount_value,
                    vcamp.min_order_value,
                    vcamp.description AS campaign_description
                FROM voucher_codes vc
                LEFT JOIN voucher_campaigns vcamp ON vcamp.id = vc.campaign_id
                WHERE (" . implode(' OR ', $conds) . ")
                ORDER BY COALESCE(vc.claimed_at, vc.sent_at, vc.created_at) DESC, vc.id DESC
                LIMIT 50
            ");
            $stmt->execute($params);
            $vouchers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
        }

        try {
            $stmtCamp = $this->db->query("
                SELECT
                    id, name, prefix, discount_type, discount_value, min_order_value,
                    total_codes, claimed_count, used_count, expires_at, status
                FROM voucher_campaigns
                WHERE status = 'active'
                ORDER BY id DESC
                LIMIT 50
            ");
            if ($stmtCamp) {
                $availableCampaigns = $stmtCamp->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
        } catch (\Throwable $e) {
        }

        return [
            'vouchers'            => $vouchers,
            'available_campaigns' => $availableCampaigns,
        ];
    }

    private function fetchContactSurveysData(int $contactId, array $subIds): array
    {
        $surveys = [];
        try {
            $conds  = ["sr.contact_id = ?"];
            $params = [$contactId];
            if (!empty($subIds)) {
                $inSub   = implode(',', array_fill(0, count($subIds), '?'));
                $conds[] = "sr.subscriber_id IN ($inSub)";
                $params  = array_merge($params, $subIds);
            }

            $stmt = $this->db->prepare("
                SELECT
                    sr.id,
                    sr.survey_id,
                    sr.subscriber_id,
                    sr.contact_id,
                    sr.respondent_name,
                    sr.respondent_email,
                    sr.respondent_phone,
                    sr.answers,
                    sr.score,
                    sr.submitted_at,
                    s.title AS survey_title,
                    s.description AS survey_description
                FROM survey_responses sr
                LEFT JOIN surveys s ON s.id = sr.survey_id
                WHERE (" . implode(' OR ', $conds) . ")
                ORDER BY sr.submitted_at DESC, sr.id DESC
                LIMIT 50
            ");
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if (!empty($rows)) {
                $respIds = array_map(static fn($r) => (int)$r['id'], $rows);
                $inResp  = implode(',', array_fill(0, count($respIds), '?'));

                $detailsByResp = [];
                try {
                    $stmtDet = $this->db->prepare("
                        SELECT
                            sad.response_id,
                            sad.question_id,
                            sad.answer_value,
                            sq.question_text,
                            sq.question_type
                        FROM survey_answer_details sad
                        LEFT JOIN survey_questions sq ON sq.id = sad.question_id
                        WHERE sad.response_id IN ($inResp)
                        ORDER BY sad.id ASC
                    ");
                    $stmtDet->execute($respIds);
                    while ($dRow = $stmtDet->fetch(PDO::FETCH_ASSOC)) {
                        $rid = (int)$dRow['response_id'];
                        $detailsByResp[$rid][] = $dRow;
                    }
                } catch (\Throwable $eDet) {
                }

                foreach ($rows as &$r) {
                    $rid = (int)$r['id'];
                    $r['parsed_answers'] = json_decode((string)($r['answers'] ?? '{}'), true) ?: [];
                    $r['answer_details'] = $detailsByResp[$rid] ?? [];
                }
                unset($r);
            }

            $surveys = $rows;
        } catch (\Throwable $e) {
        }

        return $surveys;
    }

    private function fetchContactWebSessionsData(int $contactId, array $subIds, array $contact = []): array
    {
        $visitors  = [];
        $sessions  = [];
        $pageViews = [];
        $webEvents = [];

        try {
            $conds  = ["wv.contact_id = ?"];
            $params = [$contactId];
            if (!empty($subIds)) {
                $inSub   = implode(',', array_fill(0, count($subIds), '?'));
                $conds[] = "wv.subscriber_id IN ($inSub)";
                $params  = array_merge($params, $subIds);
            }
            $emailNorm = DomationContactMatcher::normalizeEmail((string)($contact['email'] ?? ''));
            if ($emailNorm !== '') {
                $conds[]  = "LOWER(TRIM(wv.email)) = ?";
                $params[] = $emailNorm;
            }

            $stmtVis = $this->db->prepare("
                SELECT *
                FROM web_visitors wv
                WHERE (" . implode(' OR ', $conds) . ")
                ORDER BY wv.last_visit_at DESC
                LIMIT 20
            ");
            $stmtVis->execute($params);
            $visitors = $stmtVis->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if (!empty($visitors)) {
                $visitorUuids = [];
                $visitorDbIds = [];
                foreach ($visitors as $v) {
                    if (!empty($v['visitor_id'])) {
                        $visitorUuids[] = (string)$v['visitor_id'];
                    }
                    if (!empty($v['id'])) {
                        $visitorDbIds[] = (string)$v['id'];
                    }
                }
                $allVisitorKeys = array_values(array_unique(array_merge($visitorUuids, $visitorDbIds)));

                if (!empty($allVisitorKeys)) {
                    $inVis = implode(',', array_fill(0, count($allVisitorKeys), '?'));

                    try {
                        $stmtSess = $this->db->prepare("
                            SELECT *
                            FROM web_sessions
                            WHERE visitor_id IN ($inVis)
                            ORDER BY started_at DESC
                            LIMIT 50
                        ");
                        $stmtSess->execute($allVisitorKeys);
                        $sessions = $stmtSess->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    } catch (\Throwable $eSess) {
                    }

                    try {
                        $stmtPv = $this->db->prepare("
                            SELECT *
                            FROM web_page_views
                            WHERE visitor_id IN ($inVis)
                            ORDER BY loaded_at DESC
                            LIMIT 100
                        ");
                        $stmtPv->execute($allVisitorKeys);
                        $rawPvs = $stmtPv->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        foreach ($rawPvs as $pv) {
                            $pv['url']          = $pv['url'] ?? ($pv['page_url'] ?? '');
                            $pv['page_url']     = $pv['page_url'] ?? $pv['url'];
                            $pv['title']        = $pv['title'] ?? ($pv['page_title'] ?? '');
                            $pv['page_title']   = $pv['page_title'] ?? $pv['title'];
                            $pv['scroll_depth'] = (int)($pv['scroll_depth'] ?? 0);
                            $pv['time_on_page'] = (int)($pv['time_on_page'] ?? 0);
                            $pageViews[]        = $pv;
                        }
                    } catch (\Throwable $ePv) {
                    }

                    try {
                        $stmtWe = $this->db->prepare("
                            SELECT *
                            FROM web_events
                            WHERE visitor_id IN ($inVis) AND event_type != 'ping'
                            ORDER BY created_at DESC
                            LIMIT 50
                        ");
                        $stmtWe->execute($allVisitorKeys);
                        $webEvents = $stmtWe->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    } catch (\Throwable $eWe) {
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        // Attach page_views to sessions so Frontend can expand each session
        if (!empty($sessions)) {
            $pvBySession = [];
            $unassignedPvs = [];
            foreach ($pageViews as $pv) {
                $sid = (string)($pv['session_id'] ?? '');
                if ($sid !== '' && $sid !== '0') {
                    $pvBySession[$sid][] = $pv;
                } else {
                    $unassignedPvs[] = $pv;
                }
            }
            foreach ($sessions as $idx => &$sess) {
                $sid = (string)($sess['id'] ?? $sess['session_id'] ?? '');
                $attached = $pvBySession[$sid] ?? [];
                if ($idx === 0 && empty($attached) && !empty($unassignedPvs)) {
                    $attached = $unassignedPvs;
                }
                $sess['page_views'] = $attached;
                $sess['pageviews_count'] = max((int)($sess['page_count'] ?? 0), count($attached));
                $maxScroll = 0;
                foreach ($attached as $apv) {
                    $maxScroll = max($maxScroll, (int)($apv['scroll_depth'] ?? 0));
                }
                $sess['max_scroll_depth'] = max((int)($sess['max_scroll_depth'] ?? 0), $maxScroll, (int)($contact['max_scroll_depth'] ?? 0));
                if (empty($sess['landing_page']) && !empty($attached)) {
                    $lastAttached = end($attached);
                    $sess['landing_page'] = $lastAttached['url'] ?? ($lastAttached['title'] ?? '');
                }
            }
            unset($sess);
        } elseif (!empty($visitors) || !empty($pageViews)) {
            // Synthesize sessions from visitors or pageViews when web_sessions rows are absent
            $firstVisitor = $visitors[0] ?? [];
            $maxScroll = (int)($contact['max_scroll_depth'] ?? 0);
            foreach ($pageViews as $apv) {
                $maxScroll = max($maxScroll, (int)($apv['scroll_depth'] ?? 0));
            }
            $sessions[] = [
                'id'               => 'vis_' . ($firstVisitor['id'] ?? $contactId),
                'visitor_id'       => $firstVisitor['id'] ?? null,
                'started_at'       => $firstVisitor['last_visit_at'] ?? ($pageViews[0]['loaded_at'] ?? ($contact['last_web_visit_at'] ?? null)),
                'last_active_at'   => $firstVisitor['last_visit_at'] ?? ($contact['last_web_visit_at'] ?? null),
                'device_type'      => 'desktop',
                'country'          => $firstVisitor['country'] ?? null,
                'city'             => $firstVisitor['city'] ?? null,
                'pageviews_count'  => max(count($pageViews), (int)($firstVisitor['visit_count'] ?? 0), (int)($contact['web_pageviews_count'] ?? 0)),
                'max_scroll_depth' => $maxScroll,
                'landing_page'     => $pageViews[0]['url'] ?? ($pageViews[0]['title'] ?? 'Website'),
                'page_views'       => $pageViews,
            ];
        } elseif ((int)($contact['web_pageviews_count'] ?? 0) > 0 || !empty($contact['last_web_visit_at'])) {
            $pvCount   = max(1, (int)($contact['web_pageviews_count'] ?? 1));
            $maxScroll = (int)($contact['max_scroll_depth'] ?? 0);
            $visitTime = $contact['last_web_visit_at'] ?? null;
            $synthPv   = [
                'id'           => 'pv_summary_' . $contactId,
                'url'          => 'Website (Tổng hợp ' . $pvCount . ' lượt xem trang)',
                'page_url'     => 'Website (Tổng hợp ' . $pvCount . ' lượt xem trang)',
                'title'        => 'Truy cập & xem nội dung Website (' . $pvCount . ' trang)',
                'page_title'   => 'Truy cập & xem nội dung Website (' . $pvCount . ' trang)',
                'scroll_depth' => $maxScroll,
                'time_on_page' => 0,
                'loaded_at'    => $visitTime,
            ];
            $pageViews[] = $synthPv;
            $sessions[] = [
                'id'               => 'sess_summary_' . $contactId,
                'started_at'       => $visitTime,
                'last_active_at'   => $visitTime,
                'device_type'      => 'web',
                'utm_source'       => 'Direct / Website',
                'pageviews_count'  => $pvCount,
                'max_scroll_depth' => $maxScroll,
                'landing_page'     => 'Truy cập Website (' . $pvCount . ' trang • Cuộn ' . $maxScroll . '%)',
                'page_views'       => [$synthPv],
            ];
        }

        return [
            'visitors'   => $visitors,
            'sessions'   => $sessions,
            'page_views' => $pageViews,
            'web_events' => $webEvents,
        ];
    }

    private function fetchContactChatMessages(int $contactId, array $subIds, array $contact): array
    {
        $messages = [];

        // 1. Zalo messages (`zalo_user_messages` & `zalo_delivery_logs`)
        $zaloUid = trim((string)($contact['zalo_user_id'] ?? ''));
        if ($zaloUid !== '' || !empty($subIds)) {
            try {
                if ($zaloUid !== '') {
                    $stmtZm = $this->db->prepare("
                        SELECT id, zalo_user_id, event_name, message_text, message_id, attachment_type, attachment_url, received_at
                        FROM zalo_user_messages
                        WHERE zalo_user_id = ?
                        ORDER BY received_at DESC
                        LIMIT 30
                    ");
                    $stmtZm->execute([$zaloUid]);
                    while ($zm = $stmtZm->fetch(PDO::FETCH_ASSOC)) {
                        $messages[] = [
                            'channel'     => 'zalo',
                            'direction'   => strpos((string)($zm['event_name'] ?? ''), 'oa_send') !== false ? 'outbound' : 'inbound',
                            'sender_name' => $contact['full_name'] ?? 'Zalo User',
                            'content'     => $zm['message_text'] ?? ('[' . ($zm['attachment_type'] ?? 'Tin nhắn Zalo') . ']'),
                            'occurred_at' => $zm['received_at'] ?? null,
                            'raw'         => $zm,
                        ];
                    }
                }
            } catch (\Throwable $eZm) {
            }
        }

        // 2. Meta Messenger messages (`meta_message_logs`)
        $metaPsid = trim((string)($contact['meta_psid'] ?? ''));
        if ($metaPsid !== '') {
            try {
                $stmtMm = $this->db->prepare("
                    SELECT id, psid, direction, message_type, message_content, status, sent_at
                    FROM meta_message_logs
                    WHERE psid = ?
                    ORDER BY sent_at DESC
                    LIMIT 30
                ");
                $stmtMm->execute([$metaPsid]);
                while ($mm = $stmtMm->fetch(PDO::FETCH_ASSOC)) {
                    $messages[] = [
                        'channel'     => 'meta',
                        'direction'   => ($mm['direction'] ?? 'outbound') === 'inbound' ? 'inbound' : 'outbound',
                        'sender_name' => ($mm['direction'] ?? '') === 'inbound' ? ($contact['full_name'] ?? 'Facebook User') : 'Fanpage',
                        'content'     => $mm['message_content'] ?? '',
                        'occurred_at' => $mm['sent_at'] ?? null,
                        'raw'         => $mm,
                    ];
                }
            } catch (\Throwable $eMm) {
            }
        }

        // 3. AI Chatbot transcripts (`domation_ai_conversations` & `domation_ai_messages`)
        try {
            $stmtAi = $this->db->prepare("
                SELECT
                    dam.id,
                    dam.conversation_id,
                    dam.role,
                    dam.content,
                    dam.created_at,
                    dac.visitor_name,
                    dac.platform
                FROM domation_ai_messages dam
                JOIN domation_ai_conversations dac ON dac.id = dam.conversation_id
                WHERE dac.contact_id = ?
                ORDER BY dam.created_at DESC
                LIMIT 40
            ");
            $stmtAi->execute([$contactId]);
            while ($am = $stmtAi->fetch(PDO::FETCH_ASSOC)) {
                $messages[] = [
                    'channel'     => 'ai_chatbot',
                    'direction'   => ($am['role'] ?? '') === 'user' ? 'inbound' : 'outbound',
                    'sender_name' => ($am['role'] ?? '') === 'user' ? ($am['visitor_name'] ?: ($contact['full_name'] ?? 'Khách hàng')) : 'AI Chatbot',
                    'content'     => $am['content'] ?? '',
                    'occurred_at' => $am['created_at'] ?? null,
                    'raw'         => $am,
                ];
            }
        } catch (\Throwable $eAi) {
        }

        usort($messages, static function (array $a, array $b): int {
            return strcmp((string)($b['occurred_at'] ?? ''), (string)($a['occurred_at'] ?? ''));
        });

        return array_slice($messages, 0, 60);
    }

    /**
     * Build a unified, chronological Omnichannel 360 timeline across all channels.
     */
    private function buildUnifiedTimeline(
        int $contactId,
        array $subIds,
        array $surveysData,
        array $vouchersList,
        array $webSessionsData,
        array $chatMessages,
        array $activeFlowsData = [],
        array $contact = [],
        ?array $subscriberRow = null
    ): array {
        $events = [];
        $emailEventsFound = 0;
        $webEventsFound   = 0;

        $mapActivityRow = static function (array $sa, string $prefix = 'sa_') use (&$emailEventsFound, &$webEventsFound): array {
            $type      = strtolower(trim((string)($sa['type'] ?? 'activity')));
            $refName   = trim((string)($sa['reference_name'] ?? ($sa['label'] ?? '')));
            $rawDetail = (string)($sa['details'] ?? '');
            $parsedDet = json_decode($rawDetail, true);
            $detText   = '';
            if (is_array($parsedDet)) {
                $detText = trim((string)(
                    $parsedDet['subject']
                    ?? $parsedDet['url']
                    ?? $parsedDet['target_url']
                    ?? $parsedDet['link']
                    ?? $parsedDet['campaign_name']
                    ?? $parsedDet['flow_name']
                    ?? $parsedDet['voucher_code']
                    ?? $parsedDet['note']
                    ?? ''
                ));
            } elseif ($rawDetail !== '' && $rawDetail !== '{}') {
                $detText = trim($rawDetail);
            }
            if ($detText !== '') {
                $detText = trim((string)preg_replace('/\s*\([+-]?\d+\s*(?:điểm|diem|pts|points)\)/iu', '', $detText));
            }
            if ($refName !== '') {
                $refName = trim((string)preg_replace('/\s*\([+-]?\d+\s*(?:điểm|diem|pts|points)\)/iu', '', $refName));
            }

            $channel = 'flow';
            $title   = $refName !== '' ? $refName : $type;

            if (in_array($type, ['receive_email', 'email_sent', 'sent'], true)) {
                $channel = 'email';
                $title   = 'Đã gửi Email' . ($refName !== '' ? ': ' . $refName : '');
                $emailEventsFound++;
            } elseif (in_array($type, ['open_email', 'open'], true)) {
                $channel = 'email';
                $title   = 'Mở đọc Email' . ($refName !== '' ? ': ' . $refName : '');
                $emailEventsFound++;
            } elseif (in_array($type, ['click_link', 'click'], true)) {
                $channel = 'email';
                $title   = 'Click liên kết trong Email' . ($refName !== '' ? ': ' . $refName : '');
                $emailEventsFound++;
            } elseif (in_array($type, ['reply_email', 'reply'], true)) {
                $channel = 'email';
                $title   = 'Phản hồi Email' . ($refName !== '' ? ': ' . $refName : '');
                $emailEventsFound++;
            } elseif (in_array($type, ['bounce', 'bounced'], true)) {
                $channel = 'email';
                $title   = 'Email bị trả lại (Bounce)';
                $emailEventsFound++;
            } elseif (in_array($type, ['unsubscribe', 'unsubscribed'], true)) {
                $channel = 'email';
                $title   = 'Hủy đăng ký nhận Email';
                $emailEventsFound++;
            } elseif (in_array($type, ['zns_sent', 'zalo_sent'], true)) {
                $channel = 'email';
                $title   = 'Đã gửi tin nhắn Zalo ZNS' . ($refName !== '' ? ': ' . $refName : '');
                $emailEventsFound++;
            } elseif (in_array($type, ['click_zns', 'zns_clicked', 'zalo_clicked'], true)) {
                $channel = 'email';
                $title   = 'Click liên kết Zalo ZNS' . ($refName !== '' ? ': ' . $refName : '');
                $emailEventsFound++;
            } elseif (strpos($type, 'zalo') !== false || strpos($type, 'zns') !== false) {
                $channel = 'email';
                $title   = $refName !== '' ? $refName : 'Tương tác Zalo / ZNS';
                $emailEventsFound++;
            } elseif (in_array($type, ['enter_flow', 'entered_flow'], true)) {
                $channel = 'flow';
                $title   = $refName !== '' ? $refName : 'Tham gia kịch bản Automation';
            } elseif (in_array($type, ['complete_flow', 'completed_flow'], true)) {
                $channel = 'flow';
                $title   = $refName !== '' ? $refName : 'Hoàn tất kịch bản Automation';
            } elseif (strpos($type, 'flow') !== false) {
                $channel = 'flow';
                $title   = $refName !== '' ? $refName : 'Cập nhật kịch bản Automation';
            } elseif (strpos($type, 'survey') !== false || strpos($type, 'quiz') !== false) {
                $channel = 'survey';
                $title   = $refName !== '' ? $refName : 'Hoàn thành Khảo sát / Quiz';
            } elseif (strpos($type, 'voucher') !== false) {
                $channel = 'voucher';
                $title   = $refName !== '' ? $refName : 'Hoạt động mã ưu đãi Voucher';
            } elseif (in_array($type, ['form_submit', 'submit_form'], true)) {
                $channel = 'web';
                $title   = 'Điền biểu mẫu (Form)' . ($refName !== '' ? ': ' . $refName : '');
                $webEventsFound++;
            } elseif ($type === 'purchase') {
                $channel = 'web';
                $title   = 'Đơn hàng / Giao dịch' . ($refName !== '' ? ': ' . $refName : '');
                $webEventsFound++;
            } elseif (strpos($type, 'web') !== false || strpos($type, 'page') !== false) {
                $channel = 'web';
                $title   = $refName !== '' ? $refName : 'Tương tác Website';
                $webEventsFound++;
            }

            $ts = $sa['created_at'] ?? null;
            return [
                'id'          => $prefix . ($sa['id'] ?? uniqid()),
                'channel'     => $channel,
                'event_type'  => $type,
                'title'       => $title,
                'description' => $detText !== '' ? $detText : ($sa['reference_id'] ?? null),
                'subtitle'    => $detText !== '' ? $detText : ($sa['reference_id'] ?? null),
                'details'     => $parsedDet ?: $rawDetail,
                'occurred_at' => $ts,
                'created_at'  => $ts,
            ];
        };

        // 1. Subscriber Activity (`subscriber_activity`)
        try {
            $conds  = ["sa.contact_id = ?"];
            $params = [$contactId];
            if (!empty($subIds)) {
                $inSub   = implode(',', array_fill(0, count($subIds), '?'));
                $conds[] = "sa.subscriber_id IN ($inSub)";
                $params  = array_merge($params, $subIds);
            }

            $stmtSa = $this->db->prepare("
                SELECT
                    sa.id,
                    sa.subscriber_id,
                    sa.type,
                    sa.campaign_id,
                    sa.flow_id,
                    sa.reference_id,
                    sa.reference_name,
                    sa.details,
                    sa.created_at
                FROM subscriber_activity sa
                WHERE (" . implode(' OR ', $conds) . ")
                ORDER BY sa.created_at DESC, sa.id DESC
                LIMIT 120
            ");
            $stmtSa->execute($params);
            while ($sa = $stmtSa->fetch(PDO::FETCH_ASSOC)) {
                $events[] = $mapActivityRow($sa, 'sa_');
            }
        } catch (\Throwable $eSa) {
        }

        // 1b. Buffered Activity (`activity_buffer`) not yet flushed by cron
        if (!empty($subIds)) {
            try {
                $inSub = implode(',', array_fill(0, count($subIds), '?'));
                $stmtBuf = $this->db->prepare("
                    SELECT
                        id,
                        subscriber_id,
                        type,
                        campaign_id,
                        flow_id,
                        reference_id,
                        reference_name,
                        details,
                        created_at
                    FROM activity_buffer
                    WHERE subscriber_id IN ($inSub)
                    ORDER BY created_at DESC
                    LIMIT 40
                ");
                $stmtBuf->execute($subIds);
                while ($ab = $stmtBuf->fetch(PDO::FETCH_ASSOC)) {
                    $events[] = $mapActivityRow($ab, 'ab_');
                }
            } catch (\Throwable $eBuf) {
            }
        }

        // 2. Website Page Views (`web_page_views`) & Web Events (`web_events`)
        foreach (array_slice($webSessionsData['page_views'] ?? [], 0, 40) as $pv) {
            $scroll     = (int)($pv['scroll_depth'] ?? 0);
            $timeOnPage = (int)($pv['time_on_page'] ?? 0);
            $pageUrl    = trim((string)($pv['page_url'] ?? ($pv['url'] ?? '')));
            $pageTitle  = trim((string)($pv['page_title'] ?? ($pv['title'] ?? '')));
            $ts         = $pv['loaded_at'] ?? null;
            $descParts  = [];
            if ($pageUrl !== '') {
                $descParts[] = $pageUrl;
            }
            if ($scroll > 0) {
                $descParts[] = 'Cuộn ' . $scroll . '%';
            }
            if ($timeOnPage > 0) {
                $descParts[] = $timeOnPage . ' giây';
            }
            $descStr = implode(' • ', $descParts);
            $webEventsFound++;

            $events[] = [
                'id'          => 'pv_' . ($pv['id'] ?? uniqid()),
                'channel'     => 'web',
                'event_type'  => 'page_view',
                'title'       => 'Xem trang: ' . ($pageTitle !== '' ? $pageTitle : ($pageUrl !== '' ? $pageUrl : 'Website')),
                'description' => $descStr !== '' ? $descStr : null,
                'subtitle'    => $descStr !== '' ? $descStr : $pageUrl,
                'details'     => [
                    'page_url'     => $pageUrl,
                    'page_title'   => $pageTitle,
                    'scroll_depth' => $scroll,
                    'time_on_page' => $timeOnPage,
                ],
                'occurred_at' => $ts,
                'created_at'  => $ts,
            ];
        }

        foreach (array_slice($webSessionsData['web_events'] ?? [], 0, 20) as $we) {
            $evType = strtolower((string)($we['event_type'] ?? 'event'));
            if ($evType === 'pageview' || $evType === 'ping') {
                continue;
            }
            $ts = $we['created_at'] ?? null;
            $webEventsFound++;
            $events[] = [
                'id'          => 'we_' . ($we['id'] ?? uniqid()),
                'channel'     => 'web',
                'event_type'  => $evType,
                'title'       => 'Sự kiện Web: ' . ($we['event_name'] ?? $evType),
                'description' => $we['url'] ?? ($we['page_url'] ?? null),
                'subtitle'    => $we['url'] ?? ($we['page_url'] ?? null),
                'details'     => $we,
                'occurred_at' => $ts,
                'created_at'  => $ts,
            ];
        }

        // 3. Automation Flows (`active_flows` & `flow_history`)
        $allFlows = array_merge($activeFlowsData['active_flows'] ?? [], $activeFlowsData['flow_history'] ?? []);
        foreach ($allFlows as $fl) {
            $flTime = $fl['updated_at'] ?? ($fl['created_at'] ?? null);
            $isAct  = in_array($fl['status'] ?? '', ['waiting', 'processing', 'paused', 'active'], true);
            $stepDesc = !empty($fl['step_label']) ? ('Bước: ' . $fl['step_label']) : ('Trạng thái: ' . ($fl['status'] ?? 'active'));
            $events[] = [
                'id'          => 'fl_' . ($fl['id'] ?? uniqid()),
                'channel'     => 'flow',
                'event_type'  => $isAct ? 'flow_active' : 'flow_completed',
                'title'       => ($isAct ? 'Đang chạy kịch bản: ' : 'Hoàn tất kịch bản: ') . ($fl['flow_name'] ?: ('Flow #' . ($fl['flow_id'] ?? ''))),
                'description' => $stepDesc,
                'subtitle'    => $stepDesc,
                'details'     => $fl,
                'occurred_at' => $flTime,
                'created_at'  => $flTime,
            ];
        }

        // 4. Surveys (`survey_responses`)
        foreach ($surveysData as $sr) {
            $ts = $sr['submitted_at'] ?? ($sr['created_at'] ?? null);
            $subTxt = isset($sr['score']) && $sr['score'] !== null ? ('Đã nộp khảo sát') : 'Đã gửi câu trả lời khảo sát';
            $svTitle = trim((string)($sr['survey_title'] ?? ($sr['title'] ?? '')));
            $events[] = [
                'id'          => 'sr_' . ($sr['id'] ?? uniqid()),
                'channel'     => 'survey',
                'event_type'  => 'survey_response',
                'title'       => 'Hoàn thành khảo sát: ' . ($svTitle !== '' ? $svTitle : ('Khảo sát #' . ($sr['survey_id'] ?? ''))),
                'description' => $subTxt,
                'subtitle'    => $subTxt,
                'details'     => [
                    'survey_id'      => $sr['survey_id'] ?? null,
                    'survey_title'   => $svTitle !== '' ? $svTitle : null,
                    'answer_details' => $sr['answer_details'] ?? [],
                    'parsed_answers' => $sr['parsed_answers'] ?? [],
                ],
                'occurred_at' => $ts,
                'created_at'  => $ts,
            ];
        }

        // 5. Vouchers (`voucher_codes`)
        foreach ($vouchersList as $vc) {
            $vcTime   = $vc['used_at'] ?: ($vc['claimed_at'] ?: ($vc['sent_at'] ?: ($vc['created_at'] ?? null)));
            $vcStatus = strtolower((string)($vc['status'] ?? 'unused'));
            $campName = $vc['campaign_name'] ?? null;
            $events[] = [
                'id'          => 'vc_' . ($vc['id'] ?? uniqid()),
                'channel'     => 'voucher',
                'event_type'  => $vcStatus === 'used' ? 'voucher_used' : 'voucher_issued',
                'title'       => ($vcStatus === 'used' ? 'Đã sử dụng Voucher: ' : 'Cấp mã Voucher: ') . ($vc['code'] ?? ''),
                'description' => $campName,
                'subtitle'    => $campName,
                'details'     => $vc,
                'occurred_at' => $vcTime,
                'created_at'  => $vcTime,
            ];
        }

        // 6. Chat messages (Zalo, Meta, AI Chatbot)
        foreach (array_slice($chatMessages, 0, 30) as $idx => $cm) {
            $ts = $cm['occurred_at'] ?? null;
            $chLabel = strtoupper((string)($cm['channel'] ?? 'CHAT'));
            $events[] = [
                'id'          => 'chat_' . $idx . '_' . ($cm['raw']['id'] ?? uniqid()),
                'channel'     => $cm['channel'] ?? 'chat',
                'event_type'  => ($cm['direction'] ?? 'inbound') === 'inbound' ? 'message_inbound' : 'message_outbound',
                'title'       => ($cm['sender_name'] ?? 'Tin nhắn') . ': ' . mb_substr((string)($cm['content'] ?? ''), 0, 120),
                'description' => 'Kênh: ' . $chLabel,
                'subtitle'    => $chLabel,
                'details'     => $cm,
                'occurred_at' => $ts,
                'created_at'  => $ts,
            ];
        }

        // 7. Historical Aggregate Fallback (if contact/subscriber has recorded Email/Web stats not present as individual rows)
        $emailSent    = max((int)($contact['stats_email_sent'] ?? 0), (int)($subscriberRow['stats_sent'] ?? 0));
        $emailOpened  = max((int)($contact['stats_email_opened'] ?? 0), (int)($subscriberRow['stats_opened'] ?? 0));
        $emailClicked = max((int)($contact['stats_email_clicked'] ?? 0), (int)($subscriberRow['stats_clicked'] ?? 0));
        $lastOpenAt   = $contact['last_email_open_at'] ?? ($subscriberRow['last_open_at'] ?? ($subscriberRow['updated_at'] ?? null));
        $lastClickAt  = $contact['last_email_click_at'] ?? ($subscriberRow['last_click_at'] ?? $lastOpenAt);
        $lastSendAt   = $subscriberRow['last_send_at'] ?? $lastOpenAt;

        if ($emailEventsFound === 0 && ($emailSent > 0 || $emailOpened > 0 || $emailClicked > 0)) {
            if ($emailClicked > 0) {
                $events[] = [
                    'id'          => 'agg_email_click_' . $contactId,
                    'channel'     => 'email',
                    'event_type'  => 'click_link',
                    'title'       => 'Click liên kết trong Email (' . $emailClicked . ' lượt click)',
                    'description' => 'Ghi nhận tương tác click liên kết từ chiến dịch Email Marketing',
                    'subtitle'    => 'Click: ' . $emailClicked,
                    'occurred_at' => $lastClickAt,
                    'created_at'  => $lastClickAt,
                ];
            }
            if ($emailOpened > 0) {
                $events[] = [
                    'id'          => 'agg_email_open_' . $contactId,
                    'channel'     => 'email',
                    'event_type'  => 'open_email',
                    'title'       => 'Mở đọc Email (' . $emailOpened . ' lượt mở)',
                    'description' => 'Đã gửi ' . $emailSent . ' email • Mở đọc ' . $emailOpened . ' lần' . ($emailClicked > 0 ? (' • Click ' . $emailClicked . ' lần') : ''),
                    'subtitle'    => 'Mở: ' . $emailOpened,
                    'occurred_at' => $lastOpenAt,
                    'created_at'  => $lastOpenAt,
                ];
            }
            if ($emailSent > 0) {
                $events[] = [
                    'id'          => 'agg_email_sent_' . $contactId,
                    'channel'     => 'email',
                    'event_type'  => 'receive_email',
                    'title'       => 'Đã gửi Email chăm sóc (' . $emailSent . ' email)',
                    'description' => 'Tổng hợp lịch sử gửi Email Marketing & ZNS',
                    'subtitle'    => 'Đã gửi: ' . $emailSent,
                    'occurred_at' => $lastSendAt,
                    'created_at'  => $lastSendAt,
                ];
            }
        }

        // Sort descending by occurred_at
        usort($events, static function (array $a, array $b): int {
            return strcmp((string)($b['occurred_at'] ?? ''), (string)($a['occurred_at'] ?? ''));
        });

        return array_slice($events, 0, 200);
    }
}
