<?php
// backend/controllers/PresenceController.php

class PresenceController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureTables();
    }

    public function getOnlineUsers(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT p.user_id, p.last_seen_at, p.device_info, p.current_page,
                   u.full_name, u.email, u.role, u.avatar_url
            FROM user_presence p
            JOIN users u ON p.user_id = u.id
            WHERE p.tenant_id = ? AND p.last_seen_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            ORDER BY p.last_seen_at DESC
        ");
        $stmt->execute([$tid]);
        $online = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $online, 'Lấy danh sách người dùng đang online thành công');
    }

    public function ping(array $auth): void {
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $body = getBody();
        $page = trim($body['current_page'] ?? $body['page'] ?? '/dashboard');
        $device = $_SERVER['HTTP_USER_AGENT'] ?? 'Web Browser';

        $stmt = $this->db->prepare("
            INSERT INTO user_presence (tenant_id, user_id, last_seen_at, current_page, device_info)
            VALUES (?, ?, NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE 
                last_seen_at = NOW(),
                current_page = VALUES(current_page),
                device_info = VALUES(device_info)
        ");
        $stmt->execute([$tid, $uid, $page, substr($device, 0, 255)]);

        respond(200, [
            'status' => 'online',
            'server_time' => date('Y-m-d H:i:s')
        ], 'Heartbeat ping thành công');
    }

    public function broadcast(array $auth): void {
        $body = getBody();
        $message = trim($body['message'] ?? $body['content'] ?? '');
        $level = trim($body['level'] ?? 'info');

        if (!$message) respond(422, null, 'Nội dung thông báo không được để trống', false);

        // Record broadcast notification
        try {
            $stmt = $this->db->prepare("
                INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                SELECT u.id, u.tenant_id, 'Thông Báo Khẩn Cấp', ?, 'system', '/notifications', 0, NOW()
                FROM users u
                WHERE (u.tenant_id = ? OR u.tenant_id IS NULL) AND u.is_active = 1
            ");
            $stmt->execute([$message, $auth['tenant_id'] ?? 1]);
        } catch (\Throwable $e) {
            error_log("Broadcast notification error: " . $e->getMessage());
        }

        respond(200, [
            'message' => $message,
            'level' => $level,
            'broadcasted_at' => date('Y-m-d H:i:s')
        ], 'Phát sóng thông báo toàn hệ thống thành công');
    }

    public function forceLogout(array $auth, int $targetUserId): void {
        $tid = $auth['tenant_id'];
        
        // Invalidate all refresh tokens for target user
        $this->db->prepare("DELETE FROM refresh_tokens WHERE user_id = ?")->execute([$targetUserId]);
        
        // Remove from active presence
        $this->db->prepare("DELETE FROM user_presence WHERE user_id = ? AND tenant_id = ?")->execute([$targetUserId, $tid]);

        respond(200, ['target_user_id' => $targetUserId], "Đã buộc đăng xuất tài khoản ID #{$targetUserId}");
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS user_presence (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    user_id INT NOT NULL,
                    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    current_page VARCHAR(255) NULL,
                    device_info VARCHAR(255) NULL,
                    UNIQUE KEY uk_tenant_user (tenant_id, user_id),
                    INDEX idx_tenant_seen (tenant_id, last_seen_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure Presence Error: " . $e->getMessage());
        }
    }
}
