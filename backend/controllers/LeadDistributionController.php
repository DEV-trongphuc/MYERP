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
            WHERE c.tenant_id = ? AND c.pipeline_status IN ('held', 'holding', 'pending_distribution')
            ORDER BY c.id DESC
            LIMIT 100
        ");
        $stmt->execute([$tid]);
        $held = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $held, 'Lấy danh sách lead đang tạm giữ thành công');
    }

    public function assignLead(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $contactId = (int)($body['contact_id'] ?? $body['lead_id'] ?? 0);
        $consultantId = (int)($body['consultant_id'] ?? $body['user_id'] ?? $body['owner_id'] ?? 0);

        if ($contactId <= 0 || $consultantId <= 0) {
            respond(422, null, 'Vui lòng cung cấp contact_id và consultant_id', false);
        }

        $stmt = $this->db->prepare("
            UPDATE contacts 
            SET owner_id = ?, updated_at = NOW() 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$consultantId, $contactId, $tid]);

        respond(200, [
            'contact_id' => $contactId,
            'owner_id' => $consultantId,
            'assigned_at' => date('Y-m-d H:i:s')
        ], 'Phân bổ lead thành công');
    }

    public function releaseHeldLeads(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $leadIds = $body['lead_ids'] ?? [];

        if (!empty($leadIds) && is_array($leadIds)) {
            $inClause = implode(',', array_map('intval', $leadIds));
            $this->db->prepare("UPDATE contacts SET pipeline_status = 'new', owner_id = NULL, updated_at = NOW() WHERE id IN ($inClause) AND tenant_id = ?")
                ->execute([$tid]);
        } else {
            // Release all expired holding leads
            $this->db->prepare("UPDATE contacts SET pipeline_status = 'new', owner_id = NULL, updated_at = NOW() WHERE pipeline_status = 'held' AND tenant_id = ?")
                ->execute([$tid]);
        }

        respond(200, null, 'Đã thu hồi lead về kho chung thành công');
    }

    public function updateConfig(array $auth): void {
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
