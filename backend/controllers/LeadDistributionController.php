<?php
// backend/controllers/LeadDistributionController.php

class LeadDistributionController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getRounds(array $auth): void {
        $tid = $auth['tenant_id'];
        // Fetch teams that are distribution rounds / sales teams
        $stmt = $this->db->prepare("
            SELECT t.id, t.name, t.description, t.leader_id, u.full_name as leader_name,
                   (SELECT COUNT(*) FROM users u2 WHERE u2.team_id = t.id AND u2.is_active = 1) as member_count
            FROM teams t
            LEFT JOIN users u ON t.leader_id = u.id
            WHERE t.tenant_id = ?
            ORDER BY t.id ASC
        ");
        $stmt->execute([$tid]);
        $rounds = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $rounds, 'Lấy danh sách vòng chia lead thành công');
    }

    public function getHeldLeads(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT c.id, c.full_name, c.phone, c.email, c.pipeline_status, c.created_at, c.owner_id,
                   u.full_name as owner_name
            FROM contacts c
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND c.pipeline_status IN ('held', 'holding', 'pending_distribution')
            ORDER BY c.id DESC
            LIMIT 100
        ");
        $stmt->execute([$tid]);
        $held = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $held, 'Lấy danh sách lead đang tạm giữ thành công');
    }

    public function assignLead(array $auth): void {
        $role = strtolower($auth['role'] ?? '');
        $canAssign = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'lead_admin', 'sale_admin', 'saleadmin', 'team_lead', 'teamlead', 'leader'], true);
        if (!$canAssign) {
            respond(403, null, 'Bạn không có quyền phân bổ hoặc bàn giao lead cho nhân sự khác', false);
        }

        $tid = $auth['tenant_id'];
        $body = getBody();
        $contactId = (int)($body['contact_id'] ?? $body['lead_id'] ?? 0);
        $consultantId = (int)($body['consultant_id'] ?? $body['user_id'] ?? $body['owner_id'] ?? 0);

        if ($contactId <= 0 || $consultantId <= 0) {
            respond(422, null, 'Vui lòng cung cấp contact_id và consultant_id', false);
        }

        // Validate consultant exists and is active
        $stmtUser = $this->db->prepare("SELECT id, full_name, email, is_active FROM users WHERE id = ? AND tenant_id = ?");
        $stmtUser->execute([$consultantId, $tid]);
        $consultant = $stmtUser->fetch();
        if (!$consultant) {
            respond(404, null, 'Không tìm thấy tư vấn viên được chỉ định', false);
        }
        if (isset($consultant['is_active']) && (int)$consultant['is_active'] === 0) {
            respond(422, null, 'Không thể phân bổ lead cho nhân sự đã bị vô hiệu hóa hoặc nghỉ việc', false);
        }

        $this->db->beginTransaction();
        try {
            $stmtLead = $this->db->prepare("SELECT id, full_name, phone, status, pipeline_status, owner_id FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL FOR UPDATE");
            $stmtLead->execute([$contactId, $tid]);
            $lead = $stmtLead->fetch();
            if (!$lead) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy thông tin khách hàng / lead', false);
            }

            $stmt = $this->db->prepare("
                UPDATE contacts 
                SET owner_id = ?, pipeline_status = 'assigned', assigned_at = NOW(), updated_at = NOW() 
                WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
            ");
            $stmt->execute([$consultantId, $contactId, $tid]);

            // Audit Trail
            logInteraction($this->db, $tid, $auth['user_id'], 'system', 'Phân bổ Lead thủ công', "Bàn giao lead '{$lead['full_name']}' cho tư vấn viên {$consultant['full_name']}.", 'contact', $contactId);
            logActivity($this->db, $tid, $auth['user_id'], 'ASSIGN_LEAD', 'contact', $contactId, json_encode([
                'consultant_id' => $consultantId,
                'consultant_name' => $consultant['full_name']
            ]));

            // Insert into distribution_logs for rotation / assignment tracking (DEF-CRM-03)
            try {
                $logDist = $this->db->prepare("
                    INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message, received_at)
                    VALUES (?, ?, 0, 'assigned', ?, NOW())
                ");
                $assignerName = $auth['name'] ?? $auth['full_name'] ?? 'Quản trị viên';
                $msg = "Phân bổ thủ công cho {$consultant['full_name']} bởi {$assignerName}";
                $logDist->execute([$contactId, $consultantId, $msg]);
            } catch (\Throwable $eDist) {
                try {
                    $logDistFallback = $this->db->prepare("
                        INSERT INTO distribution_logs (lead_id, assigned_to, status, message)
                        VALUES (?, ?, 'assigned', ?)
                    ");
                    $logDistFallback->execute([$contactId, $consultantId, "Phân bổ thủ công cho {$consultant['full_name']}"]);
                } catch (\Throwable $ex) {}
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi phân bổ lead: ' . $e->getMessage(), false);
        }

        // Dispatch Notification to consultant (after commit)
        try {
            require_once __DIR__ . '/../NotificationService.php';
            NotificationService::send($this->db, $tid, 'LEAD_HANDOVER_NEW_SALE', [
                'user_id' => $consultantId,
                'contact_id' => $contactId,
                'customer_name' => $lead['full_name'] ?? 'Khách hàng',
                'phone' => $lead['phone'] ?? '',
                'actor_name' => $auth['name'] ?? $auth['full_name'] ?? 'Quản trị viên'
            ]);
        } catch (\Throwable $notifEx) {
            error_log("AssignLead Notification Error: " . $notifEx->getMessage());
        }

        respond(200, [
            'contact_id' => $contactId,
            'owner_id' => $consultantId,
            'consultant_name' => $consultant['full_name'],
            'assigned_at' => date('Y-m-d H:i:s')
        ], 'Phân bổ lead thành công');
    }

    public function releaseHeldLeads(array $auth): void {
        $role = strtolower($auth['role'] ?? '');
        $canRelease = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'lead_admin'], true);
        if (!$canRelease) {
            respond(403, null, 'Bạn không có quyền thu hồi lead về kho chung', false);
        }

        $tid = $auth['tenant_id'];
        $body = getBody();
        $leadIds = $body['lead_ids'] ?? [];

        if (!empty($leadIds) && is_array($leadIds)) {
            $inClause = implode(',', array_map('intval', $leadIds));
            $this->db->prepare("UPDATE contacts SET pipeline_status = 'new', owner_id = NULL, updated_at = NOW() WHERE id IN ($inClause) AND tenant_id = ? AND deleted_at IS NULL")
                ->execute([$tid]);
        } else {
            // Release holding leads
            $this->db->prepare("UPDATE contacts SET pipeline_status = 'new', owner_id = NULL, updated_at = NOW() WHERE pipeline_status = 'held' AND tenant_id = ? AND deleted_at IS NULL")
                ->execute([$tid]);
        }

        respond(200, null, 'Đã thu hồi lead về kho chung thành công');
    }

    public function updateConfig(array $auth): void {
        $role = strtolower($auth['role'] ?? '');
        $canConfig = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$canConfig) {
            respond(403, null, 'Chỉ Ban Giám đốc hoặc Quản trị viên cấp cao mới có quyền thay đổi cấu hình phân bổ lead', false);
        }

        $tid = $auth['tenant_id'];
        $body = getBody();

        if (isset($body['fallback_round_id'])) {
            $this->saveSetting('fallback_round_id', (string)$body['fallback_round_id'], $tid);
        }
        if (isset($body['sla_minutes'])) {
            $this->saveSetting('lead_sla_minutes', (string)$body['sla_minutes'], $tid);
        }
        if (isset($body['distribution_mode'])) {
            $this->saveSetting('lead_distribution_mode', (string)$body['distribution_mode'], $tid);
        }

        respond(200, null, 'Cập nhật cấu hình phân bổ lead thành công');
    }

    public function deleteQueueItem(array $auth, int $id): void {
        $role = strtolower($auth['role'] ?? '');
        $canDelete = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'lead_admin'], true);
        if (!$canDelete) {
            respond(403, null, 'Bạn không có quyền xóa lead khỏi hàng đợi phân bổ', false);
        }

        $tid = $auth['tenant_id'];
        // Remove from holding queue or reset lead
        $stmt = $this->db->prepare("UPDATE contacts SET pipeline_status = 'new', owner_id = NULL WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        respond(200, null, 'Xóa khỏi hàng đợi thành công');
    }

    private function saveSetting(string $key, string $val, int $tid): void {
        $stmt = $this->db->prepare("
            INSERT INTO system_settings (setting_key, setting_value, tenant_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $stmt->execute([$key, $val, $tid]);
    }
}
