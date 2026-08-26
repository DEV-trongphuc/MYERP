<?php
// backend/controllers/CapiController.php

class CapiController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);

        $stmt = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token', 'capi_event_triggers', 'pipeline_status_hierarchy', 'pipeline_status_labels')");
        $settings = [];
        if ($stmt) {
            while ($row = $stmt->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }

        // Parse status lists and triggers
        $hierarchy = [];
        if (!empty($settings['pipeline_status_hierarchy'])) {
            $hierarchy = json_decode($settings['pipeline_status_hierarchy'], true) ?: [];
        }
        if (empty($hierarchy)) {
            $hierarchy = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal', 'not_lead'];
        }

        $labels = [];
        if (!empty($settings['pipeline_status_labels'])) {
            $labels = json_decode($settings['pipeline_status_labels'], true) ?: [];
        }
        if (empty($labels)) {
            $labels = [
                'chua_xac_dinh' => 'Chưa xác định',
                'quan_tam' => 'Quan tâm',
                'dong_y_gap' => 'Đồng ý gặp',
                'da_gap' => 'Đã gặp',
                'booking' => 'Booking',
                'dat_coc' => 'Đặt cọc',
                'dong_deal' => 'Đóng deal',
                'not_lead' => 'Không phải lead'
            ];
        }

        $triggers = [];
        if (!empty($settings['capi_event_triggers'])) {
            $triggers = json_decode($settings['capi_event_triggers'], true) ?: [];
        }
        if (empty($triggers)) {
            $triggers = [
                'dong_y_gap' => 'Schedule',
                'da_gap' => 'Schedule',
                'not_lead' => 'Skip',
                'dat_coc' => 'Purchase'
            ];
        }

        respond(200, [
            'meta_pixel_id' => $settings['meta_pixel_id'] ?? '',
            'meta_access_token' => $settings['meta_access_token'] ?? '',
            'capi_event_triggers' => $triggers,
            'pipeline_statuses' => $hierarchy,
            'pipeline_status_labels' => $labels
        ], 'Lấy cấu hình Meta CAPI thành công');
    }

    public function saveSettings(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);
        $b = getBody();
        $pixelId = trim($b['meta_pixel_id'] ?? '');
        $token = trim($b['meta_access_token'] ?? '');
        
        $triggersRaw = $b['capi_event_triggers'] ?? [];
        $triggersJson = json_encode($triggersRaw, JSON_UNESCAPED_UNICODE);

        // Save settings dynamically to system_settings table
        $stmt = $this->db->prepare("
            INSERT INTO system_settings (setting_key, setting_value) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        $stmt->execute(['meta_pixel_id', $pixelId]);
        $stmt->execute(['meta_access_token', $token]);
        $stmt->execute(['capi_event_triggers', $triggersJson]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CAPI_SETTINGS', 'system', null, "Cập nhật cấu hình Meta CAPI (Pixel: $pixelId)");
        respond(200, null, 'Cấu hình Meta CAPI thành công');
    }

    public function getLogs(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);
        $tid = (int)$auth['tenant_id'];

        // Auto-cleanup logs older than 90 days to prevent database bloating
        try {
            $this->db->exec("DELETE FROM capi_logs WHERE sent_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        } catch (Throwable $e) {
            error_log("Failed to clean old capi logs: " . $e->getMessage());
        }

        $stmt = $this->db->prepare("
            SELECT cl.*, c.full_name, c.phone 
            FROM capi_logs cl
            JOIN contacts c ON cl.contact_id = c.id
            WHERE c.tenant_id = ?
            ORDER BY cl.sent_at DESC 
            LIMIT 100
        ");
        $stmt->execute([$tid]);
        $logs = $stmt->fetchAll() ?: [];
        respond(200, $logs, 'Lấy lịch sử CAPI logs thành công');
    }

    public function retry(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director']);
        
        $stmt = $this->db->prepare("SELECT * FROM capi_logs WHERE id = ?");
        $stmt->execute([$id]);
        $log = $stmt->fetch();
        if (!$log) {
            respond(404, null, 'Không tìm thấy nhật ký sự kiện', false);
        }

        // Get credentials from system_settings
        $stmtSet = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meta_pixel_id', 'meta_access_token')");
        $settings = [];
        if ($stmtSet) {
            while ($row = $stmtSet->fetch()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }

        $pixelId = trim($settings['meta_pixel_id'] ?? '');
        $token = trim($settings['meta_access_token'] ?? '');

        if (empty($pixelId) || empty($token)) {
            respond(422, null, 'Meta Pixel ID hoặc Access Token chưa được cấu hình', false);
        }

        $payloadJson = $log['sent_payload'];
        $url = "https://graph.facebook.com/v19.0/$pixelId/events?access_token=$token";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // Update the capi_logs entry with the retry result
        $up = $this->db->prepare("UPDATE capi_logs SET response_status = ?, response_body = ?, sent_at = NOW() WHERE id = ?");
        $up->execute([$httpCode, $response, $id]);

        if ($httpCode === 200) {
            respond(200, null, 'Gửi lại sự kiện CAPI thành công');
        } else {
            respond(400, null, 'Gửi lại sự kiện thất bại: ' . $response, false);
        }
    }
}
