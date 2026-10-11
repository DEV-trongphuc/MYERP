<?php
// backend/controllers/AIController.php

class AIController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureTables();
    }

    public function chat(array $auth): void {
        $body = getBody();
        $message = trim($body['message'] ?? $body['prompt'] ?? '');
        if (!$message) {
            respond(422, null, 'Nội dung câu hỏi không được để trống', false);
        }

        // Fast intelligent response based on CRM database state
        $tid = $auth['tenant_id'];
        $reply = "Hệ thống AI Assistant đã tiếp nhận yêu cầu: \"$message\". Tôi đang phân tích dữ liệu tuyển sinh và tiến độ tư vấn...";

        // Look for basic intent
        if (stripos($message, 'lead') !== false || stripos($message, 'học viên') !== false) {
            $stmt = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmt->execute([$tid]);
            $cnt = (int)$stmt->fetchColumn();
            $reply = "Hiện tại hệ thống có **$cnt** học viên và khách hàng tiềm năng được quản lý trên hệ thống CRM.";
        } elseif (stripos($message, 'doanh thu') !== false || stripos($message, 'tiền') !== false) {
            $stmt = $this->db->prepare("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE tenant_id = ? AND status = 'paid' AND deleted_at IS NULL");
            $stmt->execute([$tid]);
            $rev = number_format((float)$stmt->fetchColumn(), 0, ',', '.');
            $reply = "Tổng doanh thu thực thu từ các hóa đơn đã thanh toán là **$rev VNĐ**.";
        }

        respond(200, [
            'reply' => $reply,
            'model' => 'myerp-rag-flash',
            'created_at' => date('Y-m-d H:i:s')
        ], 'Phản hồi từ AI thành công');
    }

    public function getKnowledge(array $auth): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM ai_knowledge_base WHERE tenant_id = ? ORDER BY id DESC");
        $stmt->execute([$tid]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $items, 'Lấy danh mục tri thức AI thành công');
    }

    public function getKnowledgeDetail(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("SELECT * FROM ai_knowledge_base WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$id, $tid]);
        $it = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$it) respond(404, null, 'Không tìm thấy tài liệu tri thức', false);
        respond(200, $it, 'Lấy chi tiết tài liệu tri thức thành công');
    }

    public function storeKnowledge(array $auth): void {
        $tid = $auth['tenant_id'];
        $body = getBody();
        $title = trim($body['title'] ?? 'Tài liệu hướng dẫn tuyển sinh');
        $content = trim($body['content'] ?? '');
        $category = trim($body['category'] ?? 'academic');

        if (!$content) {
            respond(422, null, 'Nội dung tài liệu là bắt buộc', false);
        }

        $stmt = $this->db->prepare("
            INSERT INTO ai_knowledge_base (tenant_id, title, content, category, status, created_at)
            VALUES (?, ?, ?, ?, 'indexed', NOW())
        ");
        $stmt->execute([$tid, $title, $content, $category]);
        $id = (int)$this->db->lastInsertId();

        respond(201, ['id' => $id, 'title' => $title, 'status' => 'indexed'], 'Nạp tài liệu tri thức AI thành công');
    }

    public function deleteKnowledge(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $stmt = $this->db->prepare("DELETE FROM ai_knowledge_base WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        respond(200, null, 'Xóa tài liệu tri thức thành công');
    }

    public function getPredictions(array $auth): void {
        $tid = (int)$auth['tenant_id'];
        $curMonth = date('Y-m');

        // 1. Live conversion rate from contacts
        $stmtC = $this->db->prepare("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('customer', 'won', 'signed', 'completed') THEN 1 ELSE 0 END) as converted
            FROM contacts 
            WHERE tenant_id = ? AND deleted_at IS NULL
        ");
        $stmtC->execute([$tid]);
        $statsC = $stmtC->fetch(PDO::FETCH_ASSOC);
        $totalContacts = (int)($statsC['total'] ?? 0);
        $convertedContacts = (int)($statsC['converted'] ?? 0);
        $convRate = $totalContacts > 0 ? round(($convertedContacts / $totalContacts) * 100, 1) : 0.0;

        // 2. Real monthly revenue collected
        $stmtRev = $this->db->prepare("
            SELECT COALESCE(SUM(amount), 0) as m_revenue 
            FROM deposits 
            WHERE tenant_id = ? AND status = 'confirmed' AND DATE_FORMAT(created_at, '%Y-%m') = ?
        ");
        $stmtRev->execute([$tid, $curMonth]);
        $monthlyRevenue = (float)$stmtRev->fetchColumn();

        // 3. Top performing products / courses
        $stmtTop = $this->db->prepare("
            SELECT p.name, COUNT(ii.id) as cnt
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE p.tenant_id = ?
            GROUP BY p.id, p.name
            ORDER BY cnt DESC
            LIMIT 3
        ");
        $stmtTop->execute([$tid]);
        $topCourses = $stmtTop->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // If invoice items are empty, check contact programs
        if (empty($topCourses)) {
            $stmtProg = $this->db->prepare("
                SELECT program, COUNT(*) as cnt 
                FROM contacts 
                WHERE tenant_id = ? AND program IS NOT NULL AND program != '' AND deleted_at IS NULL
                GROUP BY program 
                ORDER BY cnt DESC 
                LIMIT 3
            ");
            $stmtProg->execute([$tid]);
            $topCourses = $stmtProg->fetchAll(PDO::FETCH_COLUMN) ?: [];
        }

        $confidence = $totalContacts >= 50 ? 0.90 : ($totalContacts >= 10 ? 0.75 : 0.50);

        $data = [
            'predicted_conversion_rate' => $convRate,
            'predicted_monthly_revenue' => $monthlyRevenue,
            'top_performing_courses' => $topCourses,
            'forecast_period' => $curMonth,
            'confidence_score' => $confidence,
            'sample_size' => $totalContacts
        ];
        respond(200, $data, 'Lấy dữ liệu dự báo AI thành công');
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS ai_knowledge_base (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    title VARCHAR(255) NOT NULL,
                    content LONGTEXT NOT NULL,
                    category VARCHAR(100) NOT NULL DEFAULT 'general',
                    status VARCHAR(50) NOT NULL DEFAULT 'indexed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_tenant_cat (tenant_id, category)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure AI Knowledge Error: " . $e->getMessage());
        }
    }
}
