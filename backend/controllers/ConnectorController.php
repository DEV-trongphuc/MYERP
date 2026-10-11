<?php
// backend/controllers/ConnectorController.php

class ConnectorController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureTables();
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT * FROM integration_connectors 
            WHERE tenant_id = ? 
            ORDER BY id DESC
        ");
        $stmt->execute([$tid]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($items as &$it) {
            $it['config'] = !empty($it['config_json']) ? json_decode($it['config_json'], true) : [];
            unset($it['config_json']);
        }
        respond(200, $items, 'Lấy danh sách connectors thành công');
    }

    public function show(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM integration_connectors WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tid]);
        $it = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$it) respond(404, null, 'Không tìm thấy connector', false);
        $it['config'] = !empty($it['config_json']) ? json_decode($it['config_json'], true) : [];
        unset($it['config_json']);
        respond(200, $it, 'Lấy chi tiết connector thành công');
    }

    public function store(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $name = trim($body['name'] ?? 'Google Sheet Connector');
        $type = trim($body['type'] ?? 'google_sheet'); // google_sheet, webhook, zapier
        $config = $body['config'] ?? [];

        $stmt = $this->db->prepare("
            INSERT INTO integration_connectors (tenant_id, name, type, config_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
        ");
        $stmt->execute([$tid, $name, $type, json_encode($config)]);
        $id = (int)$this->db->lastInsertId();

        respond(201, ['id' => $id, 'name' => $name, 'type' => $type, 'status' => 'active'], 'Tạo connector thành công');
    }

    public function update(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $updates = [];
        $params = [];

        if (isset($body['name'])) {
            $updates[] = "name = ?";
            $params[] = trim($body['name']);
        }
        if (isset($body['status'])) {
            $updates[] = "status = ?";
            $params[] = trim($body['status']);
        }
        if (isset($body['config'])) {
            $updates[] = "config_json = ?";
            $params[] = json_encode($body['config']);
        }

        if (empty($updates)) respond(422, null, 'Không có thông tin cần cập nhật', false);

        $params[] = $id;
        $params[] = $tid;
        $this->db->prepare("UPDATE integration_connectors SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ? AND tenant_id = ?")
            ->execute($params);

        respond(200, ['id' => $id], 'Cập nhật connector thành công');
    }

    public function destroy(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("DELETE FROM integration_connectors WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        respond(200, null, 'Xóa connector thành công');
    }

    public function sync(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM integration_connectors WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tid]);
        $conn = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$conn) respond(404, null, 'Không tìm thấy connector', false);

        // Update last synced at
        $this->db->prepare("UPDATE integration_connectors SET last_sync_at = NOW() WHERE id = ?")->execute([$id]);

        respond(200, [
            'id' => $id,
            'synced_at' => date('Y-m-d H:i:s'),
            'records_synced' => 0,
            'status' => 'success'
        ], 'Kích hoạt đồng bộ connector thành công');
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS integration_connectors (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL DEFAULT 'google_sheet',
                    config_json TEXT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'active',
                    last_sync_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tenant_type (tenant_id, type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure Connectors Error: " . $e->getMessage());
        }
    }
}
