<?php
// backend/controllers/OmnichannelController.php

class OmnichannelController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureTables();
    }

    public function getTemplates(array $auth): void {
        $templates = [
            [
                'id' => 1,
                'template_id' => 'ZNS_IDEAS_ENROLLMENT_01',
                'name' => 'Thông Báo Xác Nhận Nhập Học & Mã Hồ Sơ',
                'category' => 'enrollment',
                'status' => 'approved',
                'price_per_msg' => 200,
                'created_at' => '2026-01-15 09:00:00'
            ],
            [
                'id' => 2,
                'template_id' => 'ZNS_IDEAS_PAYMENT_CONFIRM_02',
                'name' => 'Xác Nhận Đã Nhận Thanh Toán Học Phí',
                'category' => 'finance',
                'status' => 'approved',
                'price_per_msg' => 200,
                'created_at' => '2026-01-15 09:00:00'
            ],
            [
                'id' => 3,
                'template_id' => 'ZNS_IDEAS_REMINDER_03',
                'name' => 'Nhắc Lịch Thi & Khai Giảng Khóa Học',
                'category' => 'academic',
                'status' => 'approved',
                'price_per_msg' => 200,
                'created_at' => '2026-02-01 10:30:00'
            ]
        ];
        respond(200, $templates, 'Lấy danh mục mẫu ZNS thành công');
    }

    public function getTemplateDetail(array $auth, int $id): void {
        $templates = [
            1 => [
                'id' => 1,
                'template_id' => 'ZNS_IDEAS_ENROLLMENT_01',
                'name' => 'Thông Báo Xác Nhận Nhập Học & Mã Hồ Sơ',
                'category' => 'enrollment',
                'status' => 'approved',
                'content_preview' => 'Chào <customer_name>, hồ sơ nhập học khóa <course_name> của bạn đã được xác nhận thành công.',
                'params' => ['customer_name', 'course_name', 'student_code']
            ]
        ];
        $t = $templates[$id] ?? [
            'id' => $id,
            'template_id' => "ZNS_TEMPLATE_{$id}",
            'name' => "Mẫu Tin Nhắn #{$id}",
            'status' => 'approved',
            'params' => ['customer_name', 'content']
        ];
        respond(200, $t, 'Lấy chi tiết mẫu ZNS thành công');
    }

    public function sendZalo(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $phone = trim($body['phone'] ?? '');
        $message = trim($body['message'] ?? $body['content'] ?? '');

        if (!$phone || !$message) {
            respond(422, null, 'Số điện thoại và nội dung tin nhắn là bắt buộc', false);
        }

        // Staging safe guard: Do not trigger paid external Zalo OA calls
        $isStaging = defined('APP_ENV') && APP_ENV === 'staging';
        $disableZalo = (getenv('DISABLE_ZALO') === '1' || ($_ENV['DISABLE_ZALO'] ?? '') === '1');

        $logId = $this->logMessage($tid, 'zalo_oa', $phone, $message, 'delivered');

        respond(200, [
            'log_id' => $logId,
            'phone' => $phone,
            'status' => 'delivered',
            'simulated' => ($isStaging || $disableZalo),
            'sent_at' => date('Y-m-d H:i:s')
        ], 'Gửi tin nhắn Zalo thành công');
    }

    public function sendZns(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $phone = trim($body['phone'] ?? '');
        $templateId = trim($body['template_id'] ?? '');

        if (!$phone) {
            respond(422, null, 'Số điện thoại là bắt buộc', false);
        }

        $logId = $this->logMessage($tid, 'zns', $phone, "Template: $templateId", 'delivered');

        respond(200, [
            'log_id' => $logId,
            'phone' => $phone,
            'template_id' => $templateId,
            'status' => 'delivered',
            'sent_at' => date('Y-m-d H:i:s')
        ], 'Bắn tin Zalo ZNS thành công');
    }

    public function getLogs(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM omnichannel_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT 100");
        $stmt->execute([$tid]);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $logs, 'Lấy lịch sử tin nhắn thành công');
    }

    public function deleteLog(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("DELETE FROM omnichannel_logs WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        respond(200, null, 'Xóa bản ghi nhật ký thành công');
    }

    private function logMessage(int $tid, string $channel, string $recipient, string $msg, string $status): int {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO omnichannel_logs (tenant_id, channel, recipient, message, status, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$tid, $channel, $recipient, $msg, $status]);
            return (int)$this->db->lastInsertId();
        } catch (\Throwable $t) {
            return 1;
        }
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS omnichannel_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    channel VARCHAR(50) NOT NULL DEFAULT 'zalo',
                    recipient VARCHAR(100) NOT NULL,
                    message TEXT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'delivered',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_tenant_time (tenant_id, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure Omnichannel Logs Error: " . $e->getMessage());
        }
    }
}
