<?php
// backend/controllers/ConsultantShiftController.php

class ConsultantShiftController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureTables();
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT s.*, u.full_name as consultant_name, u.email as consultant_email, u.avatar_url
            FROM consultant_shifts s
            JOIN users u ON s.user_id = u.id
            WHERE s.tenant_id = ?
            ORDER BY s.shift_date DESC, s.id DESC
            LIMIT 100
        ");
        $stmt->execute([$tid]);
        $shifts = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $shifts, 'Lấy danh sách ca trực tư vấn thành công');
    }

    public function show(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT s.*, u.full_name as consultant_name, u.email as consultant_email, u.avatar_url
            FROM consultant_shifts s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ? AND s.tenant_id = ?
            LIMIT 1
        ");
        $stmt->execute([$id, $tid]);
        $shift = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$shift) respond(404, null, 'Không tìm thấy ca trực', false);
        respond(200, $shift, 'Lấy chi tiết ca trực thành công');
    }

    public function register(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $userId = (int)($body['user_id'] ?? $auth['user_id']);
        $shiftType = trim($body['shift_type'] ?? 'regular'); // regular, night, weekend, holiday
        $shiftDate = trim($body['shift_date'] ?? date('Y-m-d'));
        $note = trim($body['notes'] ?? $body['note'] ?? '');

        if (!$shiftDate) {
            respond(422, null, 'Ngày trực là bắt buộc', false);
        }

        $stmt = $this->db->prepare("
            INSERT INTO consultant_shifts (tenant_id, user_id, shift_type, shift_date, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, NOW(), NOW())
        ");
        $stmt->execute([$tid, $userId, $shiftType, $shiftDate, $note]);
        $id = (int)$this->db->lastInsertId();

        respond(201, ['id' => $id, 'user_id' => $userId, 'shift_date' => $shiftDate, 'status' => 'pending'], 'Đăng ký ca trực thành công');
    }

    public function update(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $status = trim($body['status'] ?? '');
        $note = trim($body['notes'] ?? '');

        $updates = [];
        $params = [];
        if ($status) {
            $updates[] = "status = ?";
            $params[] = $status;
        }
        if ($note) {
            $updates[] = "notes = ?";
            $params[] = $note;
        }

        if (empty($updates)) {
            respond(422, null, 'Không có thông tin cần cập nhật', false);
        }

        $params[] = $id;
        $params[] = $tid;
        $this->db->prepare("UPDATE consultant_shifts SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ? AND tenant_id = ?")
            ->execute($params);

        respond(200, ['id' => $id, 'status' => $status], 'Cập nhật ca trực thành công');
    }

    public function destroy(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("DELETE FROM consultant_shifts WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        respond(200, null, 'Hủy đăng ký ca trực thành công');
    }

    public function toggleVacation(array $auth): void {
        $body = getBody();
        $userId = (int)($body['user_id'] ?? $auth['user_id']);
        
        $stmt = $this->db->prepare("SELECT vacation_mode FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $current = (int)$stmt->fetchColumn();
        $newMode = $current === 1 ? 0 : 1;

        $this->db->prepare("UPDATE users SET vacation_mode = ?, updated_at = NOW() WHERE id = ?")
            ->execute([$newMode, $userId]);

        respond(200, [
            'user_id' => $userId,
            'vacation_mode' => (bool)$newMode
        ], $newMode ? 'Đã bật chế độ nghỉ phép (tạm ngưng nhận lead)' : 'Đã tắt chế độ nghỉ phép (sẵn sàng nhận lead)');
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS consultant_shifts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    user_id INT NOT NULL,
                    shift_type VARCHAR(50) NOT NULL DEFAULT 'regular',
                    shift_date DATE NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'pending',
                    notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tenant_date (tenant_id, shift_date),
                    INDEX idx_user_shift (user_id, shift_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure Consultant Shifts Error: " . $e->getMessage());
        }
    }
}
