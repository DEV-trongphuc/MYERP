<?php
// backend/controllers/AssetController.php

class AssetController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        $stmt = $this->db->prepare("
            SELECT a.id, a.user_id, a.asset_name, a.asset_code, a.given_date, a.returned_date, a.condition_note, a.status, a.created_at, a.updated_at,
                   a.asset_name as name, a.asset_code as code,
                   u.full_name as assigned_to_name, u.avatar_url as assigned_to_avatar
            FROM hrm_assets a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
        ");
        $stmt->execute();
        $assets = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $assets, 'Lấy danh mục tài sản thành công');
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT a.id, a.user_id, a.asset_name, a.asset_code, a.given_date, a.returned_date, a.condition_note, a.status, a.created_at, a.updated_at,
                   a.asset_name as name, a.asset_code as code,
                   u.full_name as assigned_to_name, u.avatar_url as assigned_to_avatar
            FROM hrm_assets a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.id = ?
            LIMIT 1
        ");
        $stmt->execute([$id]);
        $asset = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$asset) respond(404, null, 'Không tìm thấy tài sản', false);
        respond(200, $asset, 'Lấy chi tiết tài sản thành công');
    }

    public function store(array $auth): void {
        $body = getBody();
        $name = trim($body['asset_name'] ?? $body['name'] ?? 'Thiết bị làm việc');
        $code = trim($body['asset_code'] ?? $body['code'] ?? 'TS-' . time());
        $status = trim($body['status'] ?? 'assigned');
        $givenDate = !empty($body['given_date']) ? $body['given_date'] : date('Y-m-d');
        $userId = (int)($body['user_id'] ?? $body['employee_id'] ?? $auth['user_id']);
        $note = trim($body['condition_note'] ?? $body['notes'] ?? '');

        $stmt = $this->db->prepare("
            INSERT INTO hrm_assets (user_id, asset_name, asset_code, given_date, condition_note, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$userId, $name, $code, $givenDate, $note, $status]);
        $id = (int)$this->db->lastInsertId();

        respond(201, ['id' => $id, 'name' => $name, 'code' => $code, 'status' => $status], 'Khai báo tài sản mới thành công');
    }

    public function update(array $auth, int $id): void {
        $body = getBody();
        $updates = [];
        $params = [];

        if (isset($body['asset_name']) || isset($body['name'])) {
            $updates[] = "asset_name = ?";
            $params[] = trim($body['asset_name'] ?? $body['name']);
        }
        if (isset($body['asset_code']) || isset($body['code'])) {
            $updates[] = "asset_code = ?";
            $params[] = trim($body['asset_code'] ?? $body['code']);
        }
        if (isset($body['status'])) {
            $updates[] = "status = ?";
            $params[] = trim($body['status']);
        }
        if (isset($body['condition_note']) || isset($body['notes'])) {
            $updates[] = "condition_note = ?";
            $params[] = trim($body['condition_note'] ?? $body['notes']);
        }
        if (isset($body['user_id']) || isset($body['employee_id'])) {
            $updates[] = "user_id = ?";
            $params[] = (int)($body['user_id'] ?? $body['employee_id']);
        }

        if (empty($updates)) respond(422, null, 'Không có thông tin cần cập nhật', false);

        $params[] = $id;
        $this->db->prepare("UPDATE hrm_assets SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ?")
            ->execute($params);

        respond(200, ['id' => $id], 'Cập nhật tài sản thành công');
    }

    public function destroy(array $auth, int $id): void {
        $stmt = $this->db->prepare("DELETE FROM hrm_assets WHERE id = ?");
        $stmt->execute([$id]);
        respond(200, null, 'Thanh lý tài sản thành công');
    }

    public function handover(array $auth, int $id): void {
        $body = getBody();
        $userId = (int)($body['user_id'] ?? $body['employee_id'] ?? 0);
        if ($userId <= 0) respond(422, null, 'Vui lòng chỉ định nhân viên tiếp nhận', false);

        $stmt = $this->db->prepare("UPDATE hrm_assets SET user_id = ?, status = 'assigned', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$userId, $id]);

        respond(200, ['id' => $id, 'assigned_to' => $userId, 'status' => 'assigned'], 'Bàn giao thiết bị cho nhân viên thành công');
    }

    public function recall(array $auth, int $id): void {
        $stmt = $this->db->prepare("UPDATE hrm_assets SET status = 'returned', returned_date = CURDATE(), updated_at = NOW() WHERE id = ?");
        $stmt->execute([$id]);

        respond(200, ['id' => $id, 'status' => 'returned'], 'Thu hồi tài sản về kho thành công');
    }
}
