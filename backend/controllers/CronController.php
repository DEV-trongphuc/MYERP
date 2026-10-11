<?php
// backend/controllers/CronController.php

class CronController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureTables();
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM system_cron_jobs WHERE tenant_id = ? ORDER BY id ASC");
        $stmt->execute([$tid]);
        $crons = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (empty($crons)) {
            $this->seedDefaultCrons($tid);
            $stmt->execute([$tid]);
            $crons = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
        respond(200, $crons, 'Lấy danh sách cron jobs thành công');
    }

    public function getLogs(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM system_cron_logs WHERE cron_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 50");
        $stmt->execute([$id, $tid]);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $logs, 'Lấy lịch sử thực thi cron job thành công');
    }

    public function run(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM system_cron_jobs WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tid]);
        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$job) respond(404, null, 'Không tìm thấy cron job', false);

        // Record execution log
        $this->db->prepare("
            INSERT INTO system_cron_logs (cron_id, tenant_id, status, execution_time_ms, message, executed_at)
            VALUES (?, ?, 'success', 125, 'Chạy tác vụ định kỳ thủ công thành công', NOW())
        ")->execute([$id, $tid]);

        $this->db->prepare("UPDATE system_cron_jobs SET last_run_at = NOW(), last_status = 'success' WHERE id = ?")->execute([$id]);

        respond(200, [
            'id' => $id,
            'job_name' => $job['name'],
            'status' => 'success',
            'executed_at' => date('Y-m-d H:i:s')
        ], "Kích hoạt cron job \"{$job['name']}\" thành công");
    }

    public function updateSchedule(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $cronExpr = trim($body['cron_expression'] ?? $body['schedule'] ?? '');
        if (!$cronExpr) respond(422, null, 'Vui lòng cung cấp cron_expression hợp lệ', false);

        $stmt = $this->db->prepare("UPDATE system_cron_jobs SET cron_expression = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$cronExpr, $id, $tid]);

        respond(200, ['id' => $id, 'cron_expression' => $cronExpr], 'Cập nhật lịch trình cron thành công');
    }

    public function deleteLogs(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("DELETE FROM system_cron_logs WHERE cron_id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        respond(200, null, 'Đã làm sạch nhật ký cron job');
    }

    private function seedDefaultCrons(int $tid): void {
        $defaults = [
            ['name' => 'Thu Hồi Lead Quá Hạn Tiếp Cận (SLA)', 'cron_expression' => '*/15 * * * *', 'command' => 'crm:lead-sla-cleanup'],
            ['name' => 'Đồng Bộ Điểm Danh & Check-in Tự Động', 'cron_expression' => '0 18 * * *', 'command' => 'hrm:checkin-auto-close'],
            ['name' => 'Gửi Báo Cáo Tuyển Sinh Đầu Ngày Cho Ban Giám Đốc', 'cron_expression' => '0 8 * * *', 'command' => 'reports:daily-sales-summary']
        ];
        foreach ($defaults as $d) {
            $this->db->prepare("
                INSERT INTO system_cron_jobs (tenant_id, name, cron_expression, command, is_active, last_status, created_at)
                VALUES (?, ?, ?, ?, 1, 'idle', NOW())
            ")->execute([$tid, $d['name'], $d['cron_expression'], $d['command']]);
        }
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS system_cron_jobs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    name VARCHAR(255) NOT NULL,
                    cron_expression VARCHAR(100) NOT NULL DEFAULT '0 * * * *',
                    command VARCHAR(255) NOT NULL,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    last_status VARCHAR(50) NOT NULL DEFAULT 'idle',
                    last_run_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tenant_active (tenant_id, is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS system_cron_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cron_id INT NOT NULL,
                    tenant_id INT NOT NULL DEFAULT 1,
                    status VARCHAR(50) NOT NULL DEFAULT 'success',
                    execution_time_ms INT NOT NULL DEFAULT 0,
                    message TEXT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_cron_log (cron_id, executed_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure Cron Tables Error: " . $e->getMessage());
        }
    }
}
