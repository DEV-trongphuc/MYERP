<?php
// backend/controllers/DepositController.php

class DepositController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];

        $sql = "
            SELECT d.*, c.full_name, c.phone, c.avatar_url, c.email, p.name as project_name, u.full_name as creator_name, u.avatar_url as creator_avatar,
                   owner.full_name as owner_name, owner.avatar_url as owner_avatar,
                   c.owner_id as contact_owner_id, c.pipeline_status
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            JOIN projects p ON d.project_id = p.id
            JOIN users u ON d.created_by = u.id
            LEFT JOIN users owner ON c.owner_id = owner.id
            WHERE c.tenant_id = ?
        ";
        $params = [$tid];

        $isAdminOrDirectorOrAccountant = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director', 'accountant'], true);

        if (!$isAdminOrDirectorOrAccountant) {
            if ($auth['role'] === 'manager') {
                $sql .= " AND (
                    d.created_by = ? 
                    OR c.owner_id = ? 
                    OR d.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)) 
                    OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?))
                    OR FIND_IN_SET(?, d.participant_ids)
                )";
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = (string)$auth['user_id'];
            } else {
                $sql .= " AND (
                    d.created_by = ? 
                    OR c.owner_id = ? 
                    OR FIND_IN_SET(?, c.collaborator_ids) 
                    OR d.contact_id IN (SELECT contact_id FROM quyen_truy_cap WHERE user_id = ?)
                    OR FIND_IN_SET(?, d.participant_ids)
                )";
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = (string)$auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = (string)$auth['user_id'];
            }
        }

        if (isset($_GET['contact_id'])) {
            $sql .= " AND d.contact_id = ?";
            $params[] = (int)$_GET['contact_id'];
        }

        if (isset($_GET['id'])) {
            $sql .= " AND d.id = ?";
            $params[] = (int)$_GET['id'];
        }

        $sql .= " ORDER BY d.created_at DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $deposits = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Attach milestones using Eager Loading (prevent N+1 queries)
        if (!empty($deposits)) {
            $depositIds = array_column($deposits, 'id');
            $inClause = implode(',', array_fill(0, count($depositIds), '?'));
            $stmtM = $this->db->prepare("SELECT * FROM deposit_milestones WHERE deposit_id IN ($inClause) ORDER BY id ASC");
            $stmtM->execute($depositIds);
            $allMilestones = $stmtM->fetchAll(PDO::FETCH_ASSOC);
            
            // Map milestones to deposits
            $milestonesMap = [];
            foreach ($allMilestones as $m) {
                $milestonesMap[$m['deposit_id']][] = $m;
            }

            // Fetch cooperation slips for these contacts to resolve shareholders
            $contactIds = array_column($deposits, 'contact_id');
            $inContacts = implode(',', array_fill(0, count($contactIds), '?'));
            $stmtCslips = $this->db->prepare("SELECT * FROM cooperation_slips WHERE contact_id IN ($inContacts)");
            $stmtCslips->execute($contactIds);
            $cSlips = $stmtCslips->fetchAll(PDO::FETCH_ASSOC);

            // Load users map for details
            $allUids = [];
            foreach ($cSlips as $cs) {
                $shares = json_decode($cs['shares_json'] ?? '[]', true) ?: [];
                foreach (array_keys($shares) as $uid) {
                    $allUids[] = (int)$uid;
                }
            }
            $userMap = [];
            $uniqueUids = array_values(array_unique(array_filter($allUids)));
            if (!empty($uniqueUids)) {
                $inUsers = implode(',', array_fill(0, count($uniqueUids), '?'));
                $stmtU = $this->db->prepare("SELECT id, full_name, email, avatar_url FROM users WHERE id IN ($inUsers)");
                $stmtU->execute($uniqueUids);
                $users = $stmtU->fetchAll(PDO::FETCH_ASSOC);
                foreach ($users as $u) {
                    $userMap[(int)$u['id']] = $u;
                }
            }

            $slipsMap = [];
            foreach ($cSlips as $cs) {
                $shares = json_decode($cs['shares_json'] ?? '[]', true) ?: [];
                $shareholdersDetails = [];
                foreach ($shares as $uid => $percent) {
                    $u = $userMap[(int)$uid] ?? null;
                    if ($u) {
                        $shareholdersDetails[] = [
                            'user_id' => (int)$uid,
                            'name' => $u['full_name'],
                            'email' => $u['email'],
                            'avatar' => $u['avatar_url'] ?? null,
                            'percentage' => (int)$percent
                        ];
                    }
                }
                $slipsMap[(int)$cs['contact_id']] = $shareholdersDetails;
            }

            foreach ($deposits as &$d) {
                $d['milestones'] = $milestonesMap[$d['id']] ?? [];
                $d['shareholders'] = $slipsMap[(int)$d['contact_id']] ?? [];
            }
        }

        respond(200, $deposits, 'Lấy danh sách đơn đặt hàng thành công');
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $b = getBody();
        $contactId = (int)($b['contact_id'] ?? 0);
        $projectId = (int)($b['project_id'] ?? 0);
        $unitCode  = trim($b['unit_code'] ?? '') ?: '—';
        $price     = (float)($b['price'] ?? 0);
        $expectedCommission = (float)($b['expected_commission'] ?? 0);
        $notes     = trim($b['notes'] ?? '');
        $milestones = $b['milestones'] ?? []; // Array of { name, amount }

        if (!$contactId || !$projectId || $price <= 0) {
            respond(422, null, 'Thiếu thông tin bắt buộc để tạo đơn đặt hàng (khách hàng, chiến dịch, giá bán)', false);
        }

        $this->db->beginTransaction();
        try {
            // Check contact existence and ownership
            $stmtC = $this->db->prepare("SELECT id, owner_id, pipeline_status, full_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
            $stmtC->execute([$contactId, $auth['tenant_id']]);
            $contact = $stmtC->fetch();
            if (!$contact) {
                $this->db->rollBack();
                respond(404, null, 'Khách hàng không tồn tại', false);
            }

            if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
                if ($contact['owner_id'] != $auth['user_id']) {
                    $this->db->rollBack();
                    respond(403, null, 'Bạn không thể tạo đơn hàng cho khách hàng của người khác', false);
                }
            } else if ($auth['role'] === 'manager') {
                $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $stmtUserTeam->execute([$contact['owner_id']]);
                $targetUserTeamId = $stmtUserTeam->fetchColumn();

                $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
                $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
                $isTeamMember = $stmtLead->fetch();

                if ($contact['owner_id'] != $auth['user_id'] && !$isTeamMember) {
                    $this->db->rollBack();
                    respond(403, null, 'Bạn không thể tạo đơn hàng cho khách hàng thuộc quản lý của nhóm khác', false);
                }
            }

            // Check if unit is already deposit-locked (not rejected/cancelled)
            if ($unitCode !== '—') {
                $stmtCheckUnit = $this->db->prepare("
                    SELECT id 
                    FROM deposits 
                    WHERE project_id = ? 
                      AND unit_code = ? 
                      AND status NOT IN ('rejected', 'cancelled')
                    LIMIT 1
                ");
                $stmtCheckUnit->execute([$projectId, $unitCode]);
                $existingDeposit = $stmtCheckUnit->fetch();
                if ($existingDeposit) {
                    $this->db->rollBack();
                    respond(409, null, "Sản phẩm/căn hộ {$unitCode} đã được giữ chỗ hoặc đặt cọc bởi phiếu cọc khác. Vui lòng chọn sản phẩm khác.", false);
                }
            }

            $autoRemind = isset($b['auto_remind']) ? (int)$b['auto_remind'] : 1;
            $remindDaysBefore = isset($b['remind_days_before']) ? (int)$b['remind_days_before'] : 3;
            $remindAtHour = isset($b['remind_at_hour']) ? (int)$b['remind_at_hour'] : 8;

            $accountantId = isset($b['accountant_id']) ? (int)$b['accountant_id'] : null;

            $participantIdsRaw = $b['participant_ids'] ?? '';
            $participantIds = [];
            if (is_array($participantIdsRaw)) {
                $participantIds = array_filter(array_map('intval', $participantIdsRaw));
            } else if (is_string($participantIdsRaw)) {
                $parts = explode(',', $participantIdsRaw);
                $participantIds = array_filter(array_map('intval', $parts));
            }
            $participantIdsStr = !empty($participantIds) ? implode(',', $participantIds) : null;

            $currency = trim($b['currency'] ?? 'VND') ?: 'VND';
            $exchangeRate = (float)($b['exchange_rate'] ?? 1.0);
            if ($exchangeRate <= 0) $exchangeRate = 1.0;

            // Insert deposit record
            $stmt = $this->db->prepare("
                INSERT INTO deposits (contact_id, project_id, unit_code, price, expected_commission, status, created_by, auto_remind, remind_days_before, remind_at_hour, notes, accountant_id, participant_ids, currency, exchange_rate)
                VALUES (?, ?, ?, ?, ?, 'pending_admin', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$contactId, $projectId, $unitCode, $price, $expectedCommission, $auth['user_id'], $autoRemind, $remindDaysBefore, $remindAtHour, $notes, $accountantId, $participantIdsStr, $currency, $exchangeRate]);
            $depositId = $this->db->lastInsertId();

            // Grant access to contact for each participant
            if (!empty($participantIds)) {
                $stmtGrant = $this->db->prepare("
                    INSERT IGNORE INTO quyen_truy_cap (contact_id, user_id, invited_by)
                    VALUES (?, ?, ?)
                ");
                foreach ($participantIds as $pId) {
                    $stmtGrant->execute([$contactId, $pId, $auth['user_id']]);
                }
            }

            // Tag accountant & create notification if assigned
            if ($accountantId > 0) {
                try {
                    $stmtU = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                    $stmtU->execute([$auth['user_id']]);
                    $creatorName = $stmtU->fetchColumn() ?: 'Nhân viên';

                    $stmtAcct = $this->db->prepare("SELECT full_name, username FROM users WHERE id = ?");
                    $stmtAcct->execute([$accountantId]);
                    $acctUser = $stmtAcct->fetch();

                    if ($acctUser) {
                        $acctName = $acctUser['full_name'] ?: $acctUser['username'];
                        $acctTag = '@' . str_replace(' ', '_', $acctName);
                        $bodyText = "Đã tạo phiếu thanh toán mới, chỉ định Kế toán $acctTag phê duyệt.";

                        // Insert note
                        $stmtNote = $this->db->prepare("
                            INSERT INTO notes (tenant_id, entity_type, entity_id, user_id, body)
                            VALUES (?, 'contact', ?, ?, ?)
                        ");
                        $stmtNote->execute([$auth['tenant_id'], $contactId, $auth['user_id'], $bodyText]);
                        $noteId = $this->db->lastInsertId();

                        // Log interaction for contact's timeline
                        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Phiếu Thu', $bodyText, 'contact', $contactId);

                        // Add note mention
                        $stmtMention = $this->db->prepare("
                            INSERT INTO note_mentions (note_id, user_id)
                            VALUES (?, ?)
                        ");
                        $stmtMention->execute([$noteId, $accountantId]);

                        // Send notification
                        $stmtNotif = $this->db->prepare("
                            INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                            VALUES (?, ?, 'Yêu cầu phê duyệt phiếu thanh toán', ?, 'mention', ?)
                        ");
                        $stmtNotif->execute([
                            $accountantId,
                            $auth['tenant_id'],
                            "Nhân viên $creatorName đã tạo phiếu thanh toán mới và chỉ định bạn phê duyệt.",
                            "/contacts/$contactId"
                        ]);
                    }
                } catch (Throwable $notifErr) {
                    // Suppress notification errors to avoid failing the deposit creation
                    error_log("Failed to send accountant notification: " . $notifErr->getMessage());
                }
            }

            // Tag participants & send notification
            if (!empty($participantIds)) {
                try {
                    $stmtU = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                    $stmtU->execute([$auth['user_id']]);
                    $creatorName = $stmtU->fetchColumn() ?: 'Nhân viên';

                    $stmtNotif = $this->db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                        VALUES (?, ?, 'Bạn được gắn thẻ liên quan trong phiếu thanh toán', ?, 'mention', ?)
                    ");
                    foreach ($participantIds as $pId) {
                        if ($pId !== (int)$auth['user_id']) {
                            $stmtNotif->execute([
                                $pId,
                                $auth['tenant_id'],
                                "Nhân viên $creatorName đã thêm bạn làm người liên quan trong phiếu thanh toán mới.",
                                "/contacts/$contactId"
                            ]);
                        }
                    }
                } catch (Throwable $notifErr) {
                    error_log("Failed to send participant notifications: " . $notifErr->getMessage());
                }
            }

            // Insert milestones (default to Đợt 1 if empty)
            if (empty($milestones)) {
                $milestones = [['name' => 'Thanh toán đợt 1', 'amount' => $price]];
            }

            $stmtM = $this->db->prepare("
                INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, expected_pay_date, status, original_amount)
                VALUES (?, ?, ?, ?, 'pending', ?)
            ");
            foreach ($milestones as $m) {
                $payDate = !empty($m['expected_pay_date']) ? $m['expected_pay_date'] : null;
                $originalAmount = isset($m['original_amount']) ? (float)$m['original_amount'] : null;
                $stmtM->execute([$depositId, trim($m['name'] ?? $m['milestone_name']), (float)$m['amount'], $payDate, $originalAmount]);
            }

            // Update contact pipeline stage to deal won status and set temperature to 'hot' (Sôi = xuống tiền)
            // Also sync the contact's expected_revenue with the actual deposit price
            $stmtWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
            $dealWonStatus = $stmtWon ? $stmtWon->fetchColumn() : 'dat_coc';
            if (empty($dealWonStatus)) $dealWonStatus = 'dat_coc';

            $stmtUpC = $this->db->prepare("UPDATE contacts SET pipeline_status = ?, status = 'customer', temperature = 'hot', suggested_temperature = 'hot', expected_revenue = ? WHERE id = ? AND tenant_id = ?");
            $stmtUpC->execute([$dealWonStatus, $price, $contactId, $auth['tenant_id']]);

            // Withdraw from databank and terminate other parallel contacts
            require_once __DIR__ . '/../config/ParallelHelper.php';
            ParallelHelper::lockPersonForWinningContact($this->db, (int)$contactId);

            // Retrieve all caregivers from quyen_truy_cap to check for co-op sales
            $stmtQ = $this->db->prepare("SELECT DISTINCT user_id FROM quyen_truy_cap WHERE contact_id = ?");
            $stmtQ->execute([$contactId]);
            $validHelpers = $stmtQ->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $validHelpers = array_map('intval', $validHelpers);

            // Also check contact's collaborator_ids column
            $collabStr = trim($contact['collaborator_ids'] ?? '');
            if (!empty($collabStr)) {
                $cIds = array_map('intval', array_filter(explode(',', $collabStr)));
                $validHelpers = array_values(array_unique(array_merge($validHelpers, $cIds)));
            }

            // Extract custom shares and request collaborators passed from frontend
            $customShares = [];
            if (!empty($b['shares']) && (is_array($b['shares']) || is_object($b['shares']))) {
                foreach ($b['shares'] as $uid => $pct) {
                    $uInt = (int)$uid;
                    $pInt = (int)$pct;
                    if ($uInt > 0 && $pInt >= 0) {
                        $customShares[$uInt] = $pInt;
                        $validHelpers[] = $uInt;
                    }
                }
            }

            if (!empty($b['collaborators']) && is_array($b['collaborators'])) {
                foreach ($b['collaborators'] as $cid) {
                    $validHelpers[] = (int)$cid;
                }
            }

            $ownerUid = (int)($contact['owner_id'] ?: $auth['user_id']);
            $coopSales = array_values(array_unique(array_filter($validHelpers, function($uid) use ($ownerUid) {
                return $uid > 0 && $uid !== $ownerUid;
            })));

            $createCoopSlip = isset($b['create_coop_slip']) ? (bool)$b['create_coop_slip'] : false;

            // Trigger cooperation slip creation if createCoopSlip is true OR customShares has multiple shareholders OR coopSales is not empty!
            $shouldCreateCoop = ($createCoopSlip || !empty($coopSales) || count($customShares) > 1);

            if ($shouldCreateCoop) {
                // Build shares distribution using custom shares if provided by frontend
                if (empty($customShares)) {
                    $totalCount = 1 + count($coopSales);
                    $basePercent = floor(100 / $totalCount);
                    $remainder = 100 - ($basePercent * $totalCount);

                    $customShares = [$ownerUid => (int)($basePercent + $remainder)];
                    foreach ($coopSales as $cid) {
                        $customShares[$cid] = (int)$basePercent;
                    }
                }

                // Check if there is an existing cooperation slip for this contact
                $stmtCheckCoop = $this->db->prepare("SELECT id FROM cooperation_slips WHERE contact_id = ? ORDER BY id DESC LIMIT 1");
                $stmtCheckCoop->execute([$contactId]);
                $existingCoop = $stmtCheckCoop->fetch();

                require_once __DIR__ . '/CooperationController.php';
                $coopCtrl = new CooperationController($this->db);

                if ($existingCoop) {
                    // Link pre-existing cooperation slip and update its shares
                    $sharesJson = json_encode($customShares);
                    $stmtLink = $this->db->prepare("UPDATE cooperation_slips SET deposit_slip_id = ?, shares_json = ? WHERE id = ?");
                    $stmtLink->execute([$depositId, $sharesJson, (int)$existingCoop['id']]);

                    $status = 'pending_signatures';
                    $signaturesJson = json_encode([]);

                    $stmtUpdateStatus = $this->db->prepare("UPDATE cooperation_slips SET status = ?, signatures_json = ? WHERE id = ?");
                    $stmtUpdateStatus->execute([$status, $signaturesJson, (int)$existingCoop['id']]);

                    $coopCtrl->syncCollaboratorsToContact((int)$contactId, $sharesJson);
                } else {
                    $coopCtrl->autoGenerateSlip($contactId, $depositId, $auth['user_id'], $customShares);
                }
            } else {
                // Solo sale (làm 1 mình) or user opted out of creating a coop slip.
                // Absolutely NO new cooperation slip is created!
                // If an unlinked existing coop slip was already in DB, just link it to deposit if present.
                $stmtCheckCoop = $this->db->prepare("SELECT id FROM cooperation_slips WHERE contact_id = ? AND deposit_slip_id IS NULL ORDER BY created_at DESC LIMIT 1");
                $stmtCheckCoop->execute([$contactId]);
                $existingCoop = $stmtCheckCoop->fetch();
                if ($existingCoop) {
                    $stmtLink = $this->db->prepare("UPDATE cooperation_slips SET deposit_slip_id = ? WHERE id = ?");
                    $stmtLink->execute([$depositId, (int)$existingCoop['id']]);
                }
            }

            // Fetch the created milestones to return their IDs to the frontend
            $stmtGetM = $this->db->prepare("SELECT id, milestone_name, expected_amount, status FROM deposit_milestones WHERE deposit_id = ? ORDER BY id ASC");
            $stmtGetM->execute([$depositId]);
            $createdMilestones = $stmtGetM->fetchAll(PDO::FETCH_ASSOC);

            $this->db->commit();
            
            // Trigger Meta CAPI Purchase event (Pending state)
            require_once __DIR__ . '/../config/CapiHelper.php';
            CapiHelper::sendEvent($this->db, $contactId, 'Purchase', $price);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_DEPOSIT', 'deposit', $depositId, "Tạo đơn hàng sản phẩm $unitCode cho khách hàng " . ($contact['full_name'] ?? ''));
            respond(200, [
                'id' => $depositId,
                'milestones' => $createdMilestones
            ], 'Tạo đơn đặt hàng và khởi tạo lịch thanh toán thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi lưu đơn đặt hàng: ' . $e->getMessage(), false);
        }
    }

    public function uploadUnc(array $auth, int $id, int $milestoneId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        if (empty($_FILES['file'])) {
            respond(400, null, 'Không tìm thấy file ủy nhiệm chi (UNC) tải lên', false);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(400, null, 'Lỗi tải file: ' . $file['error'], false);
        }

        // Check ownership of deposit
        $stmtDep = $this->db->prepare("
            SELECT d.id, d.contact_id, d.created_by, c.tenant_id, c.owner_id 
            FROM deposits d 
            JOIN contacts c ON d.contact_id = c.id 
            WHERE d.id = ? AND c.tenant_id = ?
        ");
        $stmtDep->execute([$id, $auth['tenant_id']]);
        $dep = $stmtDep->fetch();
        if (!$dep) respond(404, null, 'Đơn hàng không tồn tại', false);

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $stmtCoop = $this->db->prepare("
                SELECT COUNT(*) 
                FROM quyen_truy_cap 
                WHERE contact_id = ? AND user_id = ?
            ");
            $stmtCoop->execute([$dep['contact_id'], $auth['user_id']]);
            $isCollaborator = ((int)$stmtCoop->fetchColumn()) > 0;

            $stmtParticipant = $this->db->prepare("
                SELECT COUNT(*)
                FROM deposits
                WHERE id = ? AND FIND_IN_SET(?, participant_ids)
            ");
            $stmtParticipant->execute([$id, (string)$auth['user_id']]);
            $isParticipant = ((int)$stmtParticipant->fetchColumn()) > 0;

            if ($dep['owner_id'] != $auth['user_id'] && $dep['created_by'] != $auth['user_id'] && !$isCollaborator && !$isParticipant) {
                respond(403, null, 'Bạn không có quyền cập nhật đơn hàng của người khác', false);
            }
        } else if ($auth['role'] === 'manager') {
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$dep['owner_id']]);
            $targetUserTeamId = $stmtUserTeam->fetchColumn();

            $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
            $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
            $isTeamMember = $stmtLead->fetch();

            if ($dep['owner_id'] != $auth['user_id'] && !$isTeamMember) {
                $stmtCreatorTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $stmtCreatorTeam->execute([$dep['created_by']]);
                $creatorTeamId = $stmtCreatorTeam->fetchColumn();

                $stmtLeadCreator = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
                $stmtLeadCreator->execute([$creatorTeamId, $auth['user_id']]);
                $isCreatorTeamMember = $stmtLeadCreator->fetch();

                if (!$isCreatorTeamMember) {
                    respond(403, null, 'Bạn không có quyền cập nhật đơn hàng thuộc quản lý của nhóm khác', false);
                }
            }
        }

        $fileName = basename($file['name']);
        $uploadDir = UPLOAD_DIR . '/deposits/' . $id;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $safeName = $milestoneId . '_' . time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $fileName);
        $destPath = $uploadDir . '/' . $safeName;

        require_once __DIR__ . '/../config/ImageHelper.php';
        $res = ImageHelper::saveUploadedFile($file['tmp_name'], $destPath, $file['name']);

        if ($res['success']) {
            $savedName = $res['filename'];
            $relPath = 'deposits/' . $id . '/' . $savedName;

            $stmt = $this->db->prepare("
                UPDATE deposit_milestones 
                SET unc_file_path = ?, status = 'paid' 
                WHERE id = ? AND deposit_id = ?
            ");
            $stmt->execute([$relPath, $milestoneId, $id]);

            // Automatically save UNC deposit proof file into Customer Documents ("Hồ sơ & Tài liệu") under folder "Đơn hàng"
            try {
                $fileSize = file_exists($destPath) ? filesize($destPath) : ($file['size'] ?? 0);
                $fileExt = strtolower(pathinfo($savedName, PATHINFO_EXTENSION));
                $mimeType = mime_content_type($destPath) ?: ($file['type'] ?? ('image/' . $fileExt));

                // Check if UNC file already recorded in cloud_files for this contact to prevent duplicates
                $stmtCheckCF = $this->db->prepare("SELECT id FROM cloud_files WHERE contact_id = ? AND file_path = ? LIMIT 1");
                $stmtCheckCF->execute([$dep['contact_id'], $relPath]);
                if (!$stmtCheckCF->fetch()) {
                    $stmtInsCloud = $this->db->prepare("
                        INSERT INTO cloud_files (tenant_id, contact_id, name, file_path, file_size, mime_type, category, visibility, uploaded_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'Đơn hàng', 'shared', ?, NOW())
                    ");
                    $stmtInsCloud->execute([
                        $auth['tenant_id'] ?? 1,
                        $dep['contact_id'],
                        'UNC_DonHang_' . $milestoneId . '_' . $fileName,
                        $relPath,
                        $fileSize,
                        $mimeType,
                        $auth['user_id'] ?? 1
                    ]);
                }
            } catch (\Throwable $cfEx) {
                error_log("Error auto-saving UNC deposit file to cloud_files: " . $cfEx->getMessage());
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPLOAD_DEPOSIT_UNC', 'deposit_milestone', $milestoneId, "Tải lên UNC cho đợt thanh toán ID: $milestoneId");
            respond(200, [
                'unc_file_path' => $relPath
            ], 'Đã tải lên ủy nhiệm chi thành công, vui lòng chờ Admin duyệt');
        } else {
            respond(500, null, 'Không thể lưu file trên máy chủ', false);
        }
    }

    public function approveMilestone(array $auth, int $id, int $milestoneId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'accountant']);
        
        $this->db->beginTransaction();

        // Fetch deposit details to link the invoice and notify owner WITH row-level lock (FOR UPDATE)
        $stmtDep = $this->db->prepare("
            SELECT d.*, c.company_id, c.full_name, p.name as project_name,
                   u.email as owner_email, u.full_name as owner_name, u.zalo_chat_id as owner_zalo_chat_id,
                   c.owner_id as contact_owner_id, c.created_by as contact_created_by
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN projects p ON d.project_id = p.id
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE d.id = ? FOR UPDATE
        ");
        $stmtDep->execute([$id]);
        $depositData = $stmtDep->fetch();

        if (!$depositData) {
            $this->db->rollBack();
            respond(404, null, 'Không tìm thấy phiếu đặt cọc', false);
            return;
        }

        $stmtMile = $this->db->prepare("SELECT milestone_name, expected_amount, original_amount, status FROM deposit_milestones WHERE id = ? AND deposit_id = ? FOR UPDATE");
        $stmtMile->execute([$milestoneId, $id]);
        $mileData = $stmtMile->fetch();

        if (!$mileData) {
            $this->db->rollBack();
            respond(404, null, 'Không tìm thấy đợt thanh toán', false);
            return;
        }

        if ($mileData['status'] === 'approved') {
            $this->db->rollBack();
            respond(422, null, 'Đợt thanh toán này đã được duyệt từ trước', false);
            return;
        }

        // Read actual_amount from request body
        $b = getBody();
        $actualAmount = isset($b['actual_amount']) ? (float)$b['actual_amount'] : null;

        if (!empty($depositData['currency']) && $depositData['currency'] !== 'VND') {
            if ($actualAmount === null || $actualAmount <= 0) {
                $this->db->rollBack();
                respond(400, null, 'Vui lòng cung cấp số tiền thực tế nhận được bằng VND', false);
                return;
            }
        } else {
            if ($actualAmount === null || $actualAmount <= 0) {
                $actualAmount = (float)$mileData['expected_amount'];
            }
        }
        try {
            // Update milestone status and actual_amount
            $stmt = $this->db->prepare("
                UPDATE deposit_milestones 
                SET status = 'approved', approval_date = NOW(), approved_by = ?, actual_amount = ? 
                WHERE id = ? AND deposit_id = ?
            ");
            $stmt->execute([$auth['user_id'], $actualAmount, $milestoneId, $id]);

            $invoiceNum = 'INV-' . strtoupper(uniqid());
            $title = "Hóa đơn đợt thanh toán: " . $mileData['milestone_name'] . " - Dự án " . ($depositData['project_name'] ?? 'BĐS');
            $total = $actualAmount;
            
            $stmtInv = $this->db->prepare("
                INSERT INTO invoices (tenant_id, contact_id, company_id, created_by, invoice_number, title, status, issue_date, due_date, paid_at, subtotal, total, notes)
                VALUES (?, ?, ?, ?, ?, ?, 'paid', CURDATE(), CURDATE(), NOW(), ?, ?, ?)
            ");
            $stmtInv->execute([
                $auth['tenant_id'],
                $depositData['contact_id'],
                $depositData['company_id'],
                $auth['user_id'],
                $invoiceNum,
                $title,
                $total,
                $total,
                "Tự động tạo từ đợt UNC đơn hàng được duyệt. Mã đơn hàng: #" . $id
            ]);

            // Check if all milestones are approved. If so, approve the deposit slip as well
            $stmtCheck = $this->db->prepare("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = ? AND status != 'approved'");
            $stmtCheck->execute([$id]);
            $remaining = (int)$stmtCheck->fetchColumn();

            if ($remaining === 0) {
                $stmtAppDep = $this->db->prepare("UPDATE deposits SET status = 'approved' WHERE id = ?");
                $stmtAppDep->execute([$id]);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'APPROVE_DEPOSIT_MILESTONE', 'deposit_milestone', $milestoneId, "Duyệt đóng tiền đợt ID: $milestoneId, thực nhận: " . number_format($total, 0, ',', '.') . " VND");
             
             // Log interaction for contact's timeline
             logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Duyệt Đợt Thanh Toán', "UNC/Đợt thanh toán ID: $milestoneId đã được phê duyệt. Số tiền thực nhận: " . number_format($total, 0, ',', '.') . " VND", 'contact', $depositData['contact_id']);

            // Notify all related users (owner, creator, co-op sales)
            $uIdsToNotify = [];
            if (!empty($depositData['contact_owner_id'])) $uIdsToNotify[(int)$depositData['contact_owner_id']] = true;
            if (!empty($depositData['contact_created_by'])) $uIdsToNotify[(int)$depositData['contact_created_by']] = true;
            if (!empty($depositData['created_by'])) $uIdsToNotify[(int)$depositData['created_by']] = true;

            $stmtCoop = $this->db->prepare("
                SELECT shares_json 
                FROM cooperation_slips 
                WHERE deposit_slip_id = ? OR (deposit_slip_id IS NULL AND contact_id = ?) 
                LIMIT 1
            ");
            $stmtCoop->execute([$id, $depositData['contact_id']]);
            $coopRow = $stmtCoop->fetch();
            if ($coopRow && !empty($coopRow['shares_json'])) {
                $shares = json_decode($coopRow['shares_json'], true);
                if (is_array($shares)) {
                     foreach ($shares as $uId => $pct) {
                         $uIdsToNotify[(int)$uId] = true;
                     }
                }
            }

            $uIdsToNotify = array_keys($uIdsToNotify);
            if (!empty($uIdsToNotify)) {
                $inUsers = implode(',', array_fill(0, count($uIdsToNotify), '?'));
                $stmtUsers = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inUsers)");
                $stmtUsers->execute($uIdsToNotify);
                $usersList = $stmtUsers->fetchAll();

                require_once __DIR__ . '/../NotificationService.php';

                foreach ($usersList as $u) {
                    NotificationService::send($this->db, $auth['tenant_id'], 'MY_DEPOSIT_UPDATE', [
                        'user_id' => (int)$u['id'],
                        'deposit_id' => $id,
                        'customer_name' => trim($depositData['full_name'] ?? ''),
                        'status_text' => 'được duyệt đợt thanh toán ' . ($mileData['milestone_name'] ?? ''),
                        'reason' => 'Đợt thanh toán ' . number_format($total, 0, ',', '.') . ' VND đã được phê duyệt thành công'
                    ]);
                }
            }

            respond(200, null, 'Phê duyệt đợt thanh toán đơn hàng thành công');
        } catch (Exception $e) {
            error_log("Error in approveMilestone: " . $e->getMessage());
            try {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
            } catch (Throwable $rollbackEx) {
                error_log("Rollback failed: " . $rollbackEx->getMessage());
            }
            respond(500, null, 'Lỗi duyệt đợt tiền: ' . $e->getMessage(), false);
        }
    }

    public function rejectMilestone(array $auth, int $id, int $milestoneId): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'accountant']);
        
        $b = getBody();
        $reason = trim($b['reason'] ?? 'Không rõ lý do');

        $stmt = $this->db->prepare("
            UPDATE deposit_milestones 
            SET status = 'failed', unc_file_path = NULL 
            WHERE id = ? AND deposit_id = ?
        ");
        $stmt->execute([$milestoneId, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REJECT_DEPOSIT_MILESTONE', 'deposit_milestone', $milestoneId, "Từ chối đóng tiền đợt ID: $milestoneId. Lý do: $reason");

        // Notify all related users
        $stmtDep = $this->db->prepare("
            SELECT d.*, c.full_name, c.created_by as contact_created_by, c.owner_id as contact_owner_id,
                   u.email as owner_email, u.full_name as owner_name, u.zalo_chat_id as owner_zalo_chat_id
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE d.id = ?
        ");
        $stmtDep->execute([$id]);
        $depositData = $stmtDep->fetch();

        $stmtMile = $this->db->prepare("SELECT milestone_name, expected_amount FROM deposit_milestones WHERE id = ?");
        $stmtMile->execute([$milestoneId]);
        $mileData = $stmtMile->fetch();

        if ($depositData && $mileData) {
            $uIdsToNotify = [];
            if (!empty($depositData['contact_owner_id'])) $uIdsToNotify[(int)$depositData['contact_owner_id']] = true;
            if (!empty($depositData['contact_created_by'])) $uIdsToNotify[(int)$depositData['contact_created_by']] = true;
            if (!empty($depositData['created_by'])) $uIdsToNotify[(int)$depositData['created_by']] = true;

            $stmtCoop = $this->db->prepare("
                SELECT shares_json 
                FROM cooperation_slips 
                WHERE deposit_slip_id = ? OR (deposit_slip_id IS NULL AND contact_id = ?) 
                LIMIT 1
            ");
            $stmtCoop->execute([$id, $depositData['contact_id']]);
            $coopRow = $stmtCoop->fetch();
            if ($coopRow && !empty($coopRow['shares_json'])) {
                $shares = json_decode($coopRow['shares_json'], true);
                if (is_array($shares)) {
                    foreach ($shares as $uId => $pct) {
                        $uIdsToNotify[(int)$uId] = true;
                    }
                }
            }

            $uIdsToNotify = array_keys($uIdsToNotify);
            if (!empty($uIdsToNotify)) {
                $inUsers = implode(',', array_fill(0, count($uIdsToNotify), '?'));
                $stmtUsers = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inUsers)");
                $stmtUsers->execute($uIdsToNotify);
                $usersList = $stmtUsers->fetchAll();

                    require_once __DIR__ . '/../NotificationService.php';

                    foreach ($usersList as $u) {
                        NotificationService::send($this->db, $auth['tenant_id'], 'MY_DEPOSIT_UPDATE', [
                            'user_id' => (int)$u['id'],
                            'deposit_id' => $id,
                            'customer_name' => trim($depositData['full_name'] ?? ''),
                            'status_text' => 'bị từ chối đợt thanh toán ' . ($mileData['milestone_name'] ?? ''),
                            'reason' => $reason
                        ]);
                    }
            }


        }

        respond(200, null, 'Đã từ chối và yêu cầu tải lại UNC');
    }

    public function cancelDeposit(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'accountant']);
        $b = getBody();
        $reason = trim($b['reason'] ?? 'Khách hủy mua');

        $this->db->beginTransaction();
        try {
            // Fetch deposit info and check access
            $stmtDep = $this->db->prepare("
                SELECT d.contact_id, d.status, c.owner_id, c.tenant_id 
                FROM deposits d 
                JOIN contacts c ON d.contact_id = c.id
                WHERE d.id = ? AND c.tenant_id = ?
            ");
            $stmtDep->execute([$id, $auth['tenant_id']]);
            $dep = $stmtDep->fetch();
            if (!$dep) respond(404, null, 'Đơn đặt hàng không tồn tại hoặc bạn không có quyền', false);

            if ($auth['role'] === 'manager') {
                $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $stmtUserTeam->execute([$dep['owner_id']]);
                $targetUserTeamId = $stmtUserTeam->fetchColumn();

                $stmtLead = $this->db->prepare("SELECT 1 FROM teams WHERE id = ? AND leader_id = ?");
                $stmtLead->execute([$targetUserTeamId, $auth['user_id']]);
                $isTeamMember = $stmtLead->fetch();

                if ($dep['owner_id'] != $auth['user_id'] && !$isTeamMember) {
                    respond(403, null, 'Bạn không thể hủy đơn hàng cho khách hàng thuộc quản lý của nhóm khác', false);
                }
            }

            $contactId = $dep['contact_id'];

            // Check if any milestone has been approved (paid & verified)
            $stmtM = $this->db->prepare("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = ? AND status = 'approved'");
            $stmtM->execute([$id]);
            $approvedCount = (int)$stmtM->fetchColumn();

            if ($approvedCount === 0) {
                // REDUCE KHTN TEMPERATURE BY 1 LEVEL (Decay rule)
                $stmtC = $this->db->prepare("SELECT temperature, pipeline_status FROM contacts WHERE id = ?");
                $stmtC->execute([$contactId]);
                $contact = $stmtC->fetch();

                $currTemp = $contact['temperature'];
                $tempDecayMap = [
                    'hot' => 'warm',
                    'warm' => 'neutral',
                    'neutral' => 'cool',
                    'cool' => 'cold',
                    'cold' => 'cold'
                ];
                $nextTemp = $tempDecayMap[$currTemp] ?? 'neutral';

                // Dynamically resolve target demoted statuses from system settings
                $demotedBookingStatus = $this->getSetting('deposit_cancel_demoted_booking_status', 'booking');
                $demotedStatus = $this->getSetting('deposit_cancel_demoted_status', 'da_gap');

                // Resolve stage_ids for dynamic targets
                $stmtStages = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index");
                $stmtStages->execute([$auth['tenant_id']]);
                $stages = $stmtStages->fetchAll(PDO::FETCH_COLUMN);

                $stmtBooking = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND system_slug = ? LIMIT 1");
                $stmtBooking->execute([$auth['tenant_id'], $demotedBookingStatus]);
                $bookingStageId = (int)$stmtBooking->fetchColumn();

                $stmtDaGap = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND system_slug = ? LIMIT 1");
                $stmtDaGap->execute([$auth['tenant_id'], $demotedStatus]);
                $daGapStageId = (int)$stmtDaGap->fetchColumn();

                // Check if the contact ever had an active booking/target status in their audit logs
                $stmtHasBooking = $this->db->prepare("
                    SELECT 1 FROM audit_logs 
                    WHERE tenant_id = ? 
                      AND resource = 'contact' 
                      AND resource_id = ? 
                      AND action = 'MOVE_STAGE'
                      AND (new_data LIKE ? OR new_data LIKE ?)
                    LIMIT 1
                ");
                $likeBooking1 = '%"pipeline_status":"' . $demotedBookingStatus . '"%';
                $likeBooking2 = '%"to_stage":"' . $demotedBookingStatus . '"%';
                $stmtHasBooking->execute([$auth['tenant_id'], $contactId, $likeBooking1, $likeBooking2]);
                $hadBooking = (bool)$stmtHasBooking->fetchColumn();

                $targetStatus = $demotedStatus;
                $targetStageId = $daGapStageId ?: ($stages[3] ?? ($stages[0] ?? 0));
                
                // Get security timer durations dynamically
                $timerKey = 'security_timer_' . $demotedStatus;
                $duration = $this->getSetting($timerKey, '+5 days');
                $expiresAt = date('Y-m-d H:i:s', strtotime($duration));

                if ($hadBooking && $bookingStageId > 0) {
                    $targetStatus = $demotedBookingStatus;
                    $targetStageId = $bookingStageId;
                    
                    $timerBookingKey = 'security_timer_' . $demotedBookingStatus;
                    $bookingDuration = $this->getSetting($timerBookingKey, '+3 months');
                    $expiresAt = date('Y-m-d H:i:s', strtotime($bookingDuration));
                }

                // Revert status dynamically and save security_expires_at datetime
                $stmtRev = $this->db->prepare("UPDATE contacts SET pipeline_status = ?, stage_id = ?, temperature = ?, status = 'lead', security_expires_at = ? WHERE id = ?");
                $stmtRev->execute([$targetStatus, $targetStageId, $nextTemp, $expiresAt, $contactId]);
            } else {
                // If paid, keep in Dat Coc but mark deposit cancelled (Bể cọc, tiền thu hoặc chuyển đợt)
                // In this case, contact remains in Customer status
            }

            // Update deposit status
            $stmtCancel = $this->db->prepare("UPDATE deposits SET status = 'cancelled', cancelled_reason = ? WHERE id = ?");
            $stmtCancel->execute([$reason, $id]);

            // Email owner about cancellation
            $stmtOwner = $this->db->prepare("
                SELECT u.email, u.full_name, c.full_name as contact_name 
                FROM contacts c
                JOIN users u ON c.owner_id = u.id
                WHERE c.id = ?
            ");
            $stmtOwner->execute([$contactId]);
            $ownerRow = $stmtOwner->fetch();
            
            require_once __DIR__ . '/../mailer.php';
            if ($ownerRow && !empty($ownerRow['email'])) {
                $emailSubject = "[IDEAS] Báo cáo hủy đơn hàng / Bể giao dịch khách hàng: " . $ownerRow['contact_name'];
                $emailTitle = "BÁO CÁO HỦY ĐƠN HÀNG / BỂ GIAO DỊCH";
                $emailContent = "Chào <strong>" . htmlspecialchars($ownerRow['full_name']) . "</strong>,<br/><br/>" .
                                "Đơn hàng của khách hàng <strong>" . htmlspecialchars($ownerRow['contact_name']) . "</strong> (Đơn hàng #" . $id . ") đã bị hủy.<br/>" .
                                "Lý do: <em>" . htmlspecialchars($reason) . "</em>.<br/>" .
                                "Trạng thái khách hàng đã được " . ($approvedCount === 0 ? "hạ về <strong>Đăng ký dịch vụ (Booking)</strong>" : "giữ nguyên <strong>Hợp đồng (Customer)</strong> do đã phát sinh doanh thu thực tế") . ".<br/>" .
                                "Vui lòng kiểm tra trên IDEAS CRM.";
                sendEmailNotification($ownerRow['email'], $emailSubject, $emailTitle, $emailContent, '', false);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CANCEL_DEPOSIT', 'deposit', $id, "Hủy đơn hàng/Bể giao dịch. Lý do: $reason");
            respond(200, null, 'Báo cáo hủy đơn hàng và cập nhật trạng thái khách hàng thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi báo hủy cọc: ' . $e->getMessage(), false);
        }
    }

    public function updateMilestones(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $input = getBody();
        $milestones = $input['milestones'] ?? [];

        // 1. Verify deposit ownership/permissions
        $stmtDep = $this->db->prepare("
            SELECT d.id, d.created_by, c.owner_id, d.contact_id, d.currency, d.exchange_rate, c.full_name 
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            WHERE d.id = ? AND c.tenant_id = ?
        ");
        $stmtDep->execute([$id, $tid]);
        $dep = $stmtDep->fetch();
        if (!$dep) respond(404, null, 'Phiếu cọc không tồn tại', false);

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $stmtCoop = $this->db->prepare("
                SELECT COUNT(*) 
                FROM quyen_truy_cap 
                WHERE contact_id = ? AND user_id = ?
            ");
            $stmtCoop->execute([$dep['contact_id'], $auth['user_id']]);
            $isCollaborator = ((int)$stmtCoop->fetchColumn()) > 0;

            if ($dep['created_by'] != $auth['user_id'] && $dep['owner_id'] != $auth['user_id'] && !$isCollaborator) {
                respond(403, null, 'Bạn không có quyền sửa đổi lịch trình thanh toán của phiếu cọc này', false);
            }
        }

        $this->db->beginTransaction();
        try {
            if (isset($input['auto_remind'])) {
                $autoRem = (int)$input['auto_remind'];
                $stmtRem = $this->db->prepare("UPDATE deposits SET auto_remind = ? WHERE id = ?");
                $stmtRem->execute([$autoRem, $id]);
            }
            if (isset($input['remind_days_before'])) {
                $remDays = (int)$input['remind_days_before'];
                $stmtRemDays = $this->db->prepare("UPDATE deposits SET remind_days_before = ? WHERE id = ?");
                $stmtRemDays->execute([$remDays, $id]);
            }
            if (isset($input['remind_at_hour'])) {
                $remHour = (int)$input['remind_at_hour'];
                $stmtRemHour = $this->db->prepare("UPDATE deposits SET remind_at_hour = ? WHERE id = ?");
                $stmtRemHour->execute([$remHour, $id]);
            }

            $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant', 'accountant'], true);
            if ($isAdmin) {
                if (isset($input['expected_commission'])) {
                    $expComm = (float)$input['expected_commission'];
                    
                    $stmtGetComm = $this->db->prepare("SELECT expected_commission FROM deposits WHERE id = ?");
                    $stmtGetComm->execute([$id]);
                    $oldExpComm = (float)($stmtGetComm->fetchColumn() ?: 0);
                    
                    if (abs($oldExpComm - $expComm) > 0.01) {
                        $stmtComm = $this->db->prepare("UPDATE deposits SET expected_commission = ? WHERE id = ?");
                        $stmtComm->execute([$expComm, $id]);
                        logActivity($this->db, $tid, $auth['user_id'], 'UPDATE_COMMISSION', 'deposit', $id, "Cập nhật hoa hồng dự kiến: " . number_format($expComm) . " VND");
                    }
                }
                
                if (isset($input['shares'])) {
                    $newSharesInput = $input['shares'];
                    $sharesMap = [];
                    $totalPercent = 0;
                    foreach ($newSharesInput as $sInput) {
                        $uId = (int)$sInput['user_id'];
                        $pct = (int)$sInput['percentage'];
                        if ($uId > 0 && $pct > 0) {
                            $sharesMap[$uId] = $pct;
                            $totalPercent += $pct;
                        }
                    }
                    
                    if ($totalPercent === 100 && !empty($sharesMap)) {
                        $newSharesJson = json_encode($sharesMap);
                        
                        $stmtCs = $this->db->prepare("SELECT id, shares_json, contact_id FROM cooperation_slips WHERE deposit_slip_id = ? OR (deposit_slip_id IS NULL AND contact_id = ?) LIMIT 1");
                        $stmtCs->execute([$id, $dep['contact_id']]);
                        $coopRow = $stmtCs->fetch();
                        
                        if ($coopRow) {
                            $coopId = (int)$coopRow['id'];
                            $oldSharesJson = $coopRow['shares_json'];
                            
                            $oldSharesDecoded = json_decode($oldSharesJson, true) ?: [];
                            $newSharesDecoded = json_decode($newSharesJson, true) ?: [];
                            ksort($oldSharesDecoded);
                            ksort($newSharesDecoded);
                            
                            if ($oldSharesDecoded !== $newSharesDecoded) {
                                $stmtUpdCs = $this->db->prepare("UPDATE cooperation_slips SET shares_json = ?, deposit_slip_id = ? WHERE id = ?");
                                $stmtUpdCs->execute([$newSharesJson, $id, $coopId]);
                                
                                logActivity($this->db, $tid, $auth['user_id'], 'ADMIN_UPDATE_COOP_SHARES', 'cooperation_slip', $coopId, "Admin đã cập nhật lại tỷ lệ hoa hồng cho phiếu cọc #$id");
                                logActivity($this->db, $tid, $auth['user_id'], 'UPDATE_SHARES', 'deposit', $id, "Cập nhật lại tỷ lệ chia sẻ hoa hồng: " . json_encode($sharesMap, JSON_UNESCAPED_UNICODE));

                            $stmtCust = $this->db->prepare("SELECT full_name FROM contacts WHERE id = ?");
                            $stmtCust->execute([$dep['contact_id']]);
                            $custName = $stmtCust->fetchColumn() ?: "Khách hàng";

                            $notifySubject = "[IDEAS] Admin cập nhật tỷ lệ phân chia hoa hồng";
                            $notifyTitle = "CẬP NHẬT TỶ LỆ PHÂN CHIA HOA HỒNG";
                            
                            $notifyContent = "Chào bạn,<br/><br/>" .
                                             "Admin đã cập nhật tỷ lệ phân chia hoa hồng cho giao dịch đặt cọc của khách hàng <strong>" . htmlspecialchars($custName) . "</strong>.<br/>" .
                                             "Hoa hồng giao dịch dự kiến: <strong>" . number_format(isset($expComm) ? $expComm : ($dep['expected_commission'] ?? 0)) . " VND</strong>.<br/><br/>" .
                                             "<strong>Tỷ lệ phân chia mới:</strong><br/>";
                                             
                            $uIdsToNotify = array_keys($sharesMap);
                            if (!empty($uIdsToNotify)) {
                                $inUsers = implode(',', array_fill(0, count($uIdsToNotify), '?'));
                                $stmtUsers = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inUsers)");
                                $stmtUsers->execute($uIdsToNotify);
                                $usersList = $stmtUsers->fetchAll();
                                
                                foreach ($usersList as $u) {
                                    $uPercent = $sharesMap[$u['id']] ?? 0;
                                    $uAmt = ((isset($expComm) ? $expComm : ($dep['expected_commission'] ?? 0)) * $uPercent) / 100;
                                    $notifyContent .= "- " . htmlspecialchars($u['full_name']) . ": <strong>" . $uPercent . "%</strong> (~ " . number_format($uAmt) . " VND)<br/>";
                                }
                                
                                require_once __DIR__ . '/../NotificationService.php';
                                foreach ($usersList as $u) {
                                    NotificationService::send($this->db, $tid, 'MY_DEPOSIT_UPDATE', [
                                        'user_id' => (int)$u['id'],
                                        'deposit_id' => $id,
                                        'customer_name' => trim($dep['full_name'] ?? ''),
                                        'status_text' => 'duyệt phiếu hợp tác chia sẻ hoa hồng',
                                        'reason' => 'Phiếu hợp tác đã được phê duyệt thành công'
                                    ]);
                                }
                            }
                        }
                    }
                }
            }
        }

            // Get current milestones in database
            $stmtM = $this->db->prepare("SELECT id, milestone_name, expected_amount, original_amount, expected_pay_date, status FROM deposit_milestones WHERE deposit_id = ?");
            $stmtM->execute([$id]);
            $currentDbMilestones = $stmtM->fetchAll(PDO::FETCH_ASSOC);
            $currentDbIds = array_map('intval', array_column($currentDbMilestones, 'id'));

            $payloadIds = [];
            foreach ($milestones as $m) {
                if (isset($m['id']) && !empty($m['id'])) {
                    $payloadIds[] = (int)$m['id'];
                }
            }

            // Check if milestones count or IDs changed (deletes or inserts)
            $toDeleteIds = array_diff($currentDbIds, $payloadIds);
            
            $hasChanges = !empty($toDeleteIds);
            
            if (!$hasChanges) {
                // If any milestone has no ID, it's an insert
                foreach ($milestones as $m) {
                    if (!isset($m['id']) || empty($m['id'])) {
                        $hasChanges = true;
                        break;
                    }
                }
            }

            if (!$hasChanges) {
                // Check if any existing milestone details changed
                $currency = $dep['currency'] ?? 'VND';
                $rate = (float)($dep['exchange_rate'] ?? 1);
                if ($rate <= 0) $rate = 1;

                foreach ($milestones as $m) {
                    if (isset($m['id']) && !empty($m['id'])) {
                        $mId = (int)$m['id'];
                        $dbMilestone = null;
                        foreach ($currentDbMilestones as $cdm) {
                            if ((int)$cdm['id'] === $mId) {
                                $dbMilestone = $cdm;
                                break;
                            }
                        }

                        if ($dbMilestone) {
                            $mName = trim($m['milestone_name'] ?? $m['name'] ?? '');
                            $mAmount = (float)($m['expected_amount'] ?? $m['amount'] ?? 0);
                            $origAmount = isset($m['original_amount']) ? (float)$m['original_amount'] : null;
                            $payDate = !empty($m['expected_pay_date']) ? $m['expected_pay_date'] : null;

                            if ($currency !== 'VND') {
                                if ($origAmount === null || $origAmount <= 0) {
                                    $origAmount = round($mAmount / $rate, 2);
                                } else {
                                    $mAmount = round($origAmount * $rate);
                                }
                            } else {
                                $origAmount = null;
                            }

                            // Normalize dates (YYYY-MM-DD)
                            $dbPayDate = !empty($dbMilestone['expected_pay_date']) ? substr($dbMilestone['expected_pay_date'], 0, 10) : null;
                            $newPayDate = !empty($payDate) ? substr($payDate, 0, 10) : null;

                            if (trim($dbMilestone['milestone_name']) !== $mName) {
                                $hasChanges = true;
                                break;
                            }
                            if ($dbPayDate !== $newPayDate) {
                                $hasChanges = true;
                                break;
                            }

                            if ($dbMilestone['status'] !== 'approved' && $dbMilestone['status'] !== 'paid') {
                                if (abs((float)$dbMilestone['expected_amount'] - $mAmount) > 0.01) {
                                    $hasChanges = true;
                                    break;
                                }
                                if ($origAmount !== null && abs((float)$dbMilestone['original_amount'] - $origAmount) > 0.01) {
                                    $hasChanges = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if ($hasChanges) {
                // Delete milestones not in payload (only if they are not approved or paid)
                foreach ($toDeleteIds as $delId) {
                    $dbMilestone = null;
                    foreach ($currentDbMilestones as $cdm) {
                        if ((int)$cdm['id'] === $delId) {
                            $dbMilestone = $cdm;
                            break;
                        }
                    }
                    if ($dbMilestone && ($dbMilestone['status'] === 'approved' || $dbMilestone['status'] === 'paid')) {
                        throw new Exception("Không thể xóa đợt thanh toán đã đóng tiền hoặc đã được duyệt.");
                    }
                    $stmtDel = $this->db->prepare("DELETE FROM deposit_milestones WHERE id = ?");
                    $stmtDel->execute([$delId]);
                }

                // Update or Insert milestones
                $currency = $dep['currency'] ?? 'VND';
                $rate = (float)($dep['exchange_rate'] ?? 1);
                if ($rate <= 0) $rate = 1;

                foreach ($milestones as $m) {
                    $mName = trim($m['milestone_name'] ?? $m['name'] ?? '');
                    $mAmount = (float)($m['expected_amount'] ?? $m['amount'] ?? 0);
                    $origAmount = isset($m['original_amount']) ? (float)$m['original_amount'] : null;
                    $payDate = !empty($m['expected_pay_date']) ? $m['expected_pay_date'] : null;
                    if (empty($mName)) continue;

                    if ($currency !== 'VND') {
                        if ($origAmount === null || $origAmount <= 0) {
                            $origAmount = round($mAmount / $rate, 2);
                        } else {
                            $mAmount = round($origAmount * $rate);
                        }
                    } else {
                        $origAmount = null;
                    }

                    if (isset($m['id']) && !empty($m['id'])) {
                        $mId = (int)$m['id'];
                        // Update existing
                        $dbMilestone = null;
                        foreach ($currentDbMilestones as $cdm) {
                            if ((int)$cdm['id'] === $mId) {
                                $dbMilestone = $cdm;
                                break;
                            }
                        }
                        if ($dbMilestone && ($dbMilestone['status'] === 'approved' || $dbMilestone['status'] === 'paid')) {
                            // Allow updating name and pay date, but prevent changing amount
                            $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET milestone_name = ?, expected_pay_date = ? WHERE id = ?");
                            $stmtUpd->execute([$mName, $payDate, $mId]);
                        } else {
                            $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET milestone_name = ?, expected_amount = ?, original_amount = ?, expected_pay_date = ? WHERE id = ?");
                            $stmtUpd->execute([$mName, $mAmount, $origAmount, $payDate, $mId]);
                        }
                    } else {
                        // Insert new
                        $stmtIns = $this->db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, original_amount, expected_pay_date, status) VALUES (?, ?, ?, ?, ?, 'pending')");
                        $stmtIns->execute([$id, $mName, $mAmount, $origAmount, $payDate]);
                    }
                }

                logActivity($this->db, $tid, $auth['user_id'], 'UPDATE_MILESTONES', 'deposit', $id, "Cập nhật danh sách các đợt thanh toán");
            }

            $this->db->commit();
            respond(200, null, 'Cập nhật lịch trình thanh toán thành công');
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function triggerRemind(array $auth, int $id, int $milestoneId): void {
        // Fetch deposit and contact details
        $stmt = $this->db->prepare("
            SELECT d.*, m.milestone_name, m.expected_amount, m.expected_pay_date, m.status as milestone_status,
                   c.full_name, c.email as contact_email, c.phone as contact_phone,
                   u.email as creator_email, u.full_name as creator_name,
                   o.email as owner_email, o.full_name as owner_name,
                   p.name as project_name
            FROM deposits d
            JOIN deposit_milestones m ON d.id = m.deposit_id
            JOIN contacts c ON d.contact_id = c.id
            JOIN projects p ON d.project_id = p.id
            JOIN users u ON d.created_by = u.id
            LEFT JOIN users o ON c.owner_id = o.id
            WHERE d.id = ? AND m.id = ? AND c.tenant_id = ?
        ");
        $stmt->execute([$id, $milestoneId, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            respond(404, null, 'Không tìm thấy đợt thanh toán tương ứng', false);
        }

        if ($row['milestone_status'] === 'approved' || $row['milestone_status'] === 'paid') {
            respond(400, null, 'Đợt thanh toán này đã đóng tiền hoặc đã được duyệt', false);
        }

        $custName = trim($row['full_name'] ?? '');
        $payDateStr = !empty($row['expected_pay_date']) 
            ? date('d/m/Y', strtotime($row['expected_pay_date'])) 
            : 'Chưa thiết lập';
        $amountStr = number_format($row['expected_amount']) . ' VND';

        require_once __DIR__ . '/../mailer.php';

        $remindTarget = (int)($row['remind_target'] ?? 1);
        $saleEmail = !empty($row['owner_email']) ? $row['owner_email'] : $row['creator_email'];
        $saleName = !empty($row['owner_name']) ? $row['owner_name'] : $row['creator_name'];

        if ($remindTarget === 2) {
            // Option 2: Remind caretaker sale directly
            if (empty($saleEmail)) {
                respond(400, null, 'Không tìm thấy email của Sale chăm sóc để gửi nhắc nhở', false);
            }

            $emailSubject = "[IDEAS] Nhắc lịch thanh toán của học viên: " . $custName;
            $emailTitle = "NHẮC NHỞ TƯ VẤN VIÊN CHĂM SÓC";
            $emailContent = "Chào <strong>" . htmlspecialchars($saleName) . "</strong>,<br/><br/>" .
                            "Hệ thống gửi thông báo nhắc lịch thanh toán của học viên <strong>" . htmlspecialchars($custName) . "</strong> (SĐT: " . htmlspecialchars($row['contact_phone'] ?? '—') . ").<br/>" .
                            "Vui lòng chủ động liên hệ nhắc nhở khách hàng thanh toán đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/>" .
                            "Số tiền cần thanh toán: <strong>" . $amountStr . "</strong>.<br/>" .
                            "Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/>" .
                            "Chương trình: <strong>" . htmlspecialchars($row['project_name']) . "</strong> (Căn " . htmlspecialchars($row['unit_code']) . ").";

            sendEmailNotification($saleEmail, $emailSubject, $emailTitle, $emailContent, '', false);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REMIND_SALE_DIRECT', 'deposit', $id, "Gửi email nhắc nhở trực tiếp cho Sale $saleName về hạn của khách $custName");

            $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET last_reminded_at = CURRENT_TIMESTAMP WHERE id = ?");
            $stmtUpd->execute([$milestoneId]);

            respond(200, null, 'Đã gửi email nhắc nhở tới Sale chăm sóc thành công');
        } else {
            // Option 1: Remind student (fallback to sale if no email)
            $hasEmail = !empty(trim($row['contact_email'] ?? ''));
            if ($hasEmail) {
                // Remind the customer directly
                $emailSubject = "[IDEAS] Nhắc nhở thanh toán đợt cọc: " . $row['milestone_name'];
                $emailTitle = "NHẮC NHỞ THANH TOÁN";
                $emailContent = "Chào <strong>" . htmlspecialchars($custName) . "</strong>,<br/><br/>" .
                                "Đây là thông báo nhắc lịch thanh toán cho đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/>" .
                                "Chương trình: <strong>" . htmlspecialchars($row['project_name']) . "</strong> (Căn " . htmlspecialchars($row['unit_code']) . ").<br/>" .
                                "Số tiền cần đóng: <strong>" . $amountStr . "</strong>.<br/>" .
                                "Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/><br/>" .
                                "Vui lòng hoàn tất thanh toán và tải hình ảnh Ủy nhiệm chi (UNC) lên hệ thống. Xin cảm ơn!";
                
                sendEmailNotification($row['contact_email'], $emailSubject, $emailTitle, $emailContent, '', false);
                
                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REMIND_CUSTOMER_PAYMENT', 'deposit', $id, "Gửi email nhắc nhở thanh toán đợt " . $row['milestone_name'] . " cho khách hàng $custName");
                
                $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET last_reminded_at = CURRENT_TIMESTAMP WHERE id = ?");
                $stmtUpd->execute([$milestoneId]);
                
                respond(200, null, 'Đã gửi email nhắc thanh toán thành công tới học viên');
            } else {
                // Fallback: Remind caretaker sale instead
                if (empty($saleEmail)) {
                    respond(400, null, 'Khách hàng không có email và không tìm thấy email của Sale chăm sóc để gửi nhắc nhở', false);
                }

                $emailSubject = "[IDEAS] [Fallback] Nhắc nhở chăm sóc khách hàng thanh toán: " . $custName;
                $emailTitle = "FALLBACK: NHẮC NHỞ TƯ VẤN VIÊN CHĂM SÓC";
                $emailContent = "Chào <strong>" . htmlspecialchars($saleName) . "</strong>,<br/><br/>" .
                                "Hệ thống ghi nhận học viên/khách hàng <strong>" . htmlspecialchars($custName) . "</strong> (SĐT: " . htmlspecialchars($row['contact_phone'] ?? '—') . ") <strong>không có địa chỉ email</strong>.<br/>" .
                                "Vui lòng chủ động liên hệ nhắc nhở khách hàng thanh toán đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/>" .
                                "Số tiền cần thanh toán: <strong>" . $amountStr . "</strong>.<br/>" .
                                "Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/>" .
                                "Chương trình: <strong>" . htmlspecialchars($row['project_name']) . "</strong> (Căn " . htmlspecialchars($row['unit_code']) . ").";

                sendEmailNotification($saleEmail, $emailSubject, $emailTitle, $emailContent, '', false);

                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'REMIND_SALE_FALLBACK', 'deposit', $id, "Gửi email nhắc nhở fallback cho Sale $saleName chăm sóc khách hàng $custName do khách không có email");
                
                $stmtUpd = $this->db->prepare("UPDATE deposit_milestones SET last_reminded_at = CURRENT_TIMESTAMP WHERE id = ?");
                $stmtUpd->execute([$milestoneId]);
                
                respond(200, null, 'Khách hàng không có email. Đã gửi email nhắc nhở cho Sale chăm sóc thay thế');
            }
        }
    }

    public function getComments(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'deposit' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $comments = array_map(function($row) {
            if (!empty($row['attachments'])) {
                $decoded = json_decode($row['attachments'], true);
                $row['attachments'] = is_array($decoded) ? $decoded : [];
            } else {
                $row['attachments'] = [];
            }
            return $row;
        }, $rows);
        respond(200, $comments, 'Lấy danh sách bình luận thành công');
    }

    public function addComment(array $auth, int $id): void {
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'deposit', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $id, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();

        // Parse mentions in comment body
        $mentions = [];
        // 1. data-user-id
        if (preg_match_all('/data-user-id=(?:&quot;|["\']|\\\\+["\'])?(\d+)/i', (string)$body, $matches)) {
            $uids = array_filter(array_map('intval', $matches[1]));
            foreach ($uids as $uid) {
                if ($uid !== (int)$auth['user_id']) {
                    $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE id=?");
                    $stmtUser->execute([$uid]);
                    $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                    if ($userRow) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }
        // 2. @name
        $matches = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()\s]+?)(?:<\/span>|<br|\n|$)/u', (string)$body, $matches);
        $names = is_array($matches[1] ?? null) ? $matches[1] : [];
        if (!empty($names)) {
            foreach ($names as $nameWithUnderscores) {
                $nameWithUnderscores = trim(strip_tags($nameWithUnderscores));
                if (empty($nameWithUnderscores)) continue;
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE (full_name=? OR REPLACE(full_name, ' ', '_')=?)");
                $stmtUser->execute([$fullName, $nameWithUnderscores]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $uid = (int)$userRow['id'];
                    if ($uid !== (int)$auth['user_id']) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        // Get contact details for deposit
        $stmtDep = $this->db->prepare("SELECT contact_id FROM deposits WHERE id = ?");
        $stmtDep->execute([$id]);
        $contactId = $stmtDep->fetchColumn();

        if (!empty($mentions) && $contactId) {
            try {
                require_once __DIR__ . '/../NotificationService.php';
                $targetLink = "/contacts?open_contact_id={$contactId}&highlight_activity_id=0&highlight_comment_id={$newId}";
                foreach ($mentions as $uid => $userRow) {
                    NotificationService::send($this->db, $auth['tenant_id'], 'MENTION_TAGGED', [
                        'user_id' => $uid,
                        'author_name' => $auth['full_name'] ?? 'Đồng nghiệp',
                        'comment' => $body,
                        'link' => $targetLink
                    ]);
                }
            } catch (Throwable $e) {
                error_log("Failed to send comment mention notification: " . $e->getMessage());
            }
        }

        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    public function getHistory(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT a.id, a.action, a.new_data, a.created_at, u.full_name as user_name, u.avatar_url
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.tenant_id = ? AND (
                (a.resource = 'deposit' AND a.resource_id = ?)
                OR (a.resource = 'deposit_milestone' AND a.resource_id IN (SELECT id FROM deposit_milestones WHERE deposit_id = ?))
            )
            ORDER BY a.created_at DESC
        ");
        $stmt->execute([$auth['tenant_id'], $id, $id]);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $logs, 'Lấy lịch sử chỉnh sửa thành công');
    }

    private function getSetting(string $key, string $default): string {
        $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : $default;
    }
}
