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
        $monthlyRevenue = 0.0;
        try {
            $stmtRev = $this->db->prepare("
                SELECT COALESCE(SUM(d.price), 0) as m_revenue 
                FROM deposits d
                LEFT JOIN contacts c ON d.contact_id = c.id
                LEFT JOIN projects p ON d.project_id = p.id
                WHERE (c.tenant_id = ? OR p.tenant_id = ?) AND d.status IN ('approved', 'confirmed') AND DATE_FORMAT(d.created_at, '%Y-%m') = ?
            ");
            $stmtRev->execute([$tid, $tid, $curMonth]);
            $monthlyRevenue = (float)$stmtRev->fetchColumn();
        } catch (\Throwable $eRev) {
            $monthlyRevenue = 0.0;
        }

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

    public function getCustomerJourneySummary(array $auth): void {
        $tid = (int)$auth['tenant_id'];
        $uid = (int)$auth['user_id'];
        $contactId = (int)($_GET['contact_id'] ?? $_GET['id'] ?? 0);
        $force = !empty($_GET['force']) && in_array(strtolower((string)$_GET['force']), ['1', 'true', 'yes'], true);
        $analyze = !empty($_GET['analyze']) && in_array(strtolower((string)$_GET['analyze']), ['1', 'true', 'yes'], true);

        if ($contactId <= 0) {
            respond(422, null, 'ID khách hàng không hợp lệ', false);
        }

        // 1. Fetch Contact info with tenant isolation
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as owner_name, ps.name as stage_name
            FROM contacts c
            LEFT JOIN users u ON u.id = c.owner_id
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            WHERE c.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
            LIMIT 1
        ");
        $stmt->execute([$contactId, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$contact) {
            respond(404, null, 'Khách hàng không tồn tại hoặc đã bị xóa', false);
        }

        // 2. Check Cache in customer_ai_insights if not explicitly requesting fresh analysis
        if (!$force && !$analyze) {
            $stmtCache = $this->db->prepare("
                SELECT * FROM customer_ai_insights 
                WHERE tenant_id = ? AND contact_id = ?
                LIMIT 1
            ");
            $stmtCache->execute([$tid, $contactId]);
            $cached = $stmtCache->fetch(PDO::FETCH_ASSOC);

            if ($cached && !empty($cached['summary'])) {
                $keyNeeds = json_decode($cached['key_needs_json'] ?? '[]', true);
                $nextActions = json_decode($cached['next_best_actions_json'] ?? '[]', true);
                $metrics = json_decode($cached['metrics_json'] ?? '{}', true);

                respond(200, [
                    'summary' => $cached['summary'],
                    'key_needs' => is_array($keyNeeds) ? $keyNeeds : [],
                    'financial_status' => $cached['financial_status'] ?? '',
                    'potential_level' => $cached['potential_level'] ?: 'Trung bình',
                    'potential_score' => (int)($cached['potential_score'] ?? 50),
                    'next_best_actions' => is_array($nextActions) ? $nextActions : [],
                    'analyzed_at' => $cached['updated_at'] ?: $cached['created_at'],
                    'source' => 'database_cached',
                    'metrics' => is_array($metrics) ? $metrics : []
                ], 'Lấy phân tích hành trình từ bộ nhớ đệm thành công');
                return;
            }

            // Not yet analyzed and user hasn't requested analysis: return empty state
            respond(200, null, 'Chưa có dữ liệu phân tích hành trình cho khách hàng này');
            return;
        }

        // 3. Aggregate real CRM data from MySQL
        // Find linked contacts for the same customer (e.g. multi-program / cloned profiles sharing phone/email)
        $allContactIds = [$contactId];
        $phone = trim($contact['phone'] ?? '');
        $email = trim($contact['email'] ?? '');
        if (!empty($phone) || !empty($email)) {
            $sqlLinked = "SELECT id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND id != ? AND (1=0";
            $paramsLinked = [$tid, $contactId];
            if (!empty($phone)) {
                $sqlLinked .= " OR phone = ?";
                $paramsLinked[] = $phone;
            }
            if (!empty($email)) {
                $sqlLinked .= " OR email = ?";
                $paramsLinked[] = $email;
            }
            $sqlLinked .= ")";
            $stmtLinked = $this->db->prepare($sqlLinked);
            $stmtLinked->execute($paramsLinked);
            $linkedIds = $stmtLinked->fetchAll(PDO::FETCH_COLUMN) ?: [];
            foreach ($linkedIds as $lid) {
                $allContactIds[] = (int)$lid;
            }
            $allContactIds = array_values(array_unique(array_filter($allContactIds, fn($id) => $id > 0)));
        }
        $contactIn = implode(',', array_fill(0, count($allContactIds), '?'));

        // Query up to 50 activities with author details across all linked profiles
        $actParams = array_merge([$tid], $allContactIds, $allContactIds);
        $stmtAct = $this->db->prepare("
            SELECT a.id, a.contact_id, a.related_id, a.related_type, a.type, a.subject, a.body, 
                   a.status, a.priority, a.created_at, a.done_at, a.due_date, a.tags,
                   u.full_name as author_name
            FROM activities a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.tenant_id = ? 
              AND (a.contact_id IN ($contactIn) OR (a.related_type = 'contact' AND a.related_id IN ($contactIn))) 
              AND a.deleted_at IS NULL
            ORDER BY a.created_at DESC 
            LIMIT 50
        ");
        $stmtAct->execute($actParams);
        $activities = $stmtAct->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch all comments from activity_comments table for these activities
        $commentsByActivity = [];
        if (!empty($activities)) {
            $actIds = array_column($activities, 'id');
            $actIn = implode(',', array_fill(0, count($actIds), '?'));
            $stmtComments = $this->db->prepare("
                SELECT ac.id, ac.activity_id, ac.content, ac.created_at, u.full_name as author_name
                FROM activity_comments ac
                LEFT JOIN users u ON u.id = ac.user_id
                WHERE ac.activity_id IN ($actIn)
                ORDER BY ac.created_at ASC
            ");
            $stmtComments->execute($actIds);
            $allComments = $stmtComments->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($allComments as $c) {
                $commentsByActivity[$c['activity_id']][] = $c;
            }
        }

        // Query notes table with author details across all linked profiles
        $notesParams = array_merge([$tid], $allContactIds);
        $stmtNotes = $this->db->prepare("
            SELECT n.id, n.body, n.type, n.client_feedback, n.stuck_tag, n.sale_temperature, n.created_at,
                   u.full_name as author_name
            FROM notes n
            LEFT JOIN users u ON u.id = n.user_id
            WHERE n.tenant_id = ? AND n.entity_type = 'contact' AND n.entity_id IN ($contactIn)
            ORDER BY n.created_at DESC 
            LIMIT 30
        ");
        $stmtNotes->execute($notesParams);
        $notes = $stmtNotes->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Query replies in notes table if any
        if (!empty($notes)) {
            $noteIds = array_column($notes, 'id');
            $noteIn = implode(',', array_fill(0, count($noteIds), '?'));
            $stmtReplies = $this->db->prepare("
                SELECT n.id, n.parent_id, n.body, n.created_at, u.full_name as author_name
                FROM notes n
                LEFT JOIN users u ON u.id = n.user_id
                WHERE n.tenant_id = ? AND n.parent_id IN ($noteIn)
                ORDER BY n.created_at ASC
            ");
            $stmtReplies->execute(array_merge([$tid], $noteIds));
            $allReplies = $stmtReplies->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $repliesByParent = [];
            foreach ($allReplies as $r) {
                $repliesByParent[$r['parent_id']][] = $r;
            }
            foreach ($notes as &$n) {
                $n['replies'] = $repliesByParent[$n['id']] ?? [];
            }
            unset($n);
        }

        // Deals
        $dealParams = array_merge([$tid], $allContactIds);
        $stmtDeals = $this->db->prepare("
            SELECT title, value, currency, probability, expected_close_date, created_at, stage_id
            FROM deals
            WHERE tenant_id = ? AND contact_id IN ($contactIn) AND deleted_at IS NULL
            ORDER BY created_at DESC
        ");
        $stmtDeals->execute($dealParams);
        $deals = $stmtDeals->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Deposits
        $stmtDep = $this->db->prepare("
            SELECT price, status, notes, currency, created_at
            FROM deposits
            WHERE contact_id IN ($contactIn)
            ORDER BY created_at DESC
        ");
        $stmtDep->execute($allContactIds);
        $deposits = $stmtDep->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Invoices
        $invParams = array_merge([$tid], $allContactIds);
        $stmtInv = $this->db->prepare("
            SELECT invoice_number, title, status, total, created_at
            FROM invoices
            WHERE tenant_id = ? AND contact_id IN ($contactIn) AND deleted_at IS NULL
            ORDER BY created_at DESC
        ");
        $stmtInv->execute($invParams);
        $invoices = $stmtInv->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 4. Calculate accurate metrics from actual records
        $totalSpent = 0.0;
        foreach ($deposits as $dep) {
            if (in_array(strtolower($dep['status'] ?? ''), ['confirmed', 'paid', 'approved', 'completed'], true)) {
                $totalSpent += (float)($dep['price'] ?? 0);
            }
        }
        foreach ($invoices as $inv) {
            if (in_array(strtolower($inv['status'] ?? ''), ['paid', 'completed'], true)) {
                $totalSpent += (float)($inv['total'] ?? 0);
            }
        }

        $expectedRevenue = (float)($contact['expected_revenue'] ?? 0);
        if ($expectedRevenue <= 0 && !empty($deals)) {
            foreach ($deals as $dl) {
                $expectedRevenue += (float)($dl['value'] ?? 0);
            }
        }

        // Accurately count note records across both notes table and activities (type = 'note')
        $noteActivities = array_filter($activities, fn($a) => ($a['type'] ?? '') === 'note');
        $totalNotesCount = count($notes) + count($noteActivities);

        $metrics = [
            'total_spent' => $totalSpent,
            'expected_revenue' => $expectedRevenue,
            'deals_count' => count($deals),
            'activities_count' => count($activities),
            'notes_count' => $totalNotesCount
        ];

        // 5. Construct Prompt from MySQL Ground Truth
        $contactName = trim(($contact['full_name'] ?? '') ?: ($contact['first_name'] . ' ' . $contact['last_name']));
        $phone = $contact['phone'] ?? '';
        $stageName = $contact['stage_name'] ?? $contact['pipeline_status'] ?? 'Chưa xác định';
        $demand = $contact['demand_type'] ?? $contact['program'] ?? 'Chưa ghi nhận';
        $contactNotes = trim($contact['notes'] ?? '');

        // Helper to clean HTML text and preserve plain mention names
        $cleanContent = function(?string $html): string {
            if (!$html) return '';
            $text = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $text = preg_replace('/<span class="mention"[^>]*>(?:<img[^>]*>)?<span>(@[^<]+)<\/span><\/span>/iu', '$1', $text);
            $text = strip_tags($text);
            $text = preg_replace('/\s+/', ' ', $text);
            return trim($text);
        };

        // Activity type labels in Vietnamese
        $typeLabels = [
            'call' => 'Cuộc gọi',
            'meeting' => 'Gặp gỡ',
            'note' => 'Ghi chú',
            'task' => 'Công việc',
            'email' => 'Email',
            'zalo_connect' => 'Kết nối Zalo',
            'pipeline_stage_change' => 'Cập nhật giai đoạn',
            'system' => 'Hệ thống'
        ];

        $actSummary = [];
        foreach ($activities as $act) {
            $actType = $typeLabels[$act['type'] ?? ''] ?? ($act['type'] ?: 'Tương tác');
            $timeStr = !empty($act['created_at']) ? date('d/m/Y H:i', strtotime($act['created_at'])) : '';
            $author = $act['author_name'] ? "bởi {$act['author_name']}" : '';
            $subject = $cleanContent($act['subject'] ?? '');
            $body = $cleanContent($act['body'] ?? '');

            $line = "- [$timeStr] $actType $author: $subject";
            if (!empty($body) && $body !== $subject) {
                $line .= " | Nội dung: $body";
            }

            // Append attached comments from activity_comments
            $actId = $act['id'];
            if (!empty($commentsByActivity[$actId])) {
                foreach ($commentsByActivity[$actId] as $comm) {
                    $commTime = !empty($comm['created_at']) ? date('d/m/Y H:i', strtotime($comm['created_at'])) : '';
                    $commAuthor = $comm['author_name'] ?: 'Nhân viên';
                    $commContent = $cleanContent($comm['content'] ?? '');
                    if (!empty($commContent)) {
                        $line .= "\n   └─ [Bình luận $commAuthor $commTime]: $commContent";
                    }
                }
            }
            $actSummary[] = $line;
        }
        $actText = !empty($actSummary) ? implode("\n", $actSummary) : "Chưa có tương tác nào.";

        $noteSummary = [];
        foreach ($notes as $n) {
            $nTime = !empty($n['created_at']) ? date('d/m/Y H:i', strtotime($n['created_at'])) : '';
            $nAuthor = $n['author_name'] ? "bởi {$n['author_name']}" : '';
            $cleanedBody = $cleanContent($n['body'] ?? '');
            if ($cleanedBody) {
                $line = "- [$nTime] Ghi chú $nAuthor: $cleanedBody";
                if (!empty($n['replies'])) {
                    foreach ($n['replies'] as $rep) {
                        $repTime = !empty($rep['created_at']) ? date('d/m/Y H:i', strtotime($rep['created_at'])) : '';
                        $repAuthor = $rep['author_name'] ?: 'Nhân viên';
                        $repBody = $cleanContent($rep['body'] ?? '');
                        if ($repBody) {
                            $line .= "\n   └─ [Phản hồi $repAuthor $repTime]: $repBody";
                        }
                    }
                }
                $noteSummary[] = $line;
            }
        }
        $notesText = !empty($noteSummary) ? implode("\n", $noteSummary) : "Không có ghi chú thêm từ bảng notes.";

        $depositSummary = [];
        foreach ($deposits as $d) {
            $depositSummary[] = "- Đặt cọc: " . number_format((float)($d['price'] ?? 0), 0, ',', '.') . " " . ($d['currency'] ?? 'VND') . " (Trạng thái: " . ($d['status'] ?? '') . ", ghi chú: " . $cleanContent($d['notes'] ?? '') . ")";
        }
        $depText = !empty($depositSummary) ? implode("\n", $depositSummary) : "Chưa phát sinh giao dịch đặt cọc.";

        $prompt = "Hãy đóng vai Chuyên gia CRM/ERP phân tích toàn diện hành trình khách hàng sau và xuất JSON chuẩn:\n\n" .
                  "THÔNG TIN KHÁCH HÀNG:\n" .
                  "- Họ và tên: $contactName\n" .
                  "- Số điện thoại: $phone\n" .
                  "- Nhu cầu/Khóa học quan tâm: $demand\n" .
                  "- Giai đoạn hiện tại (Stage): $stageName\n" .
                  "- Ghi chú hồ sơ: $contactNotes\n\n" .
                  "LỊCH SỬ TẤT CẢ TƯƠNG TÁC & BÌNH LUẬN NỘI BỘ GẦN ĐÂY:\n$actText\n\n" .
                  "GHI CHÚ BỔ SUNG TỪ TƯ VẤN VIÊN:\n$notesText\n\n" .
                  "LỊCH SỬ ĐẶT CỌC & TÀI CHÍNH:\n$depText\n" .
                  "- Tổng số tiền đã thanh toán/đặt cọc: " . number_format($totalSpent, 0, ',', '.') . " VNĐ\n" .
                  "- Doanh thu dự kiến: " . number_format($expectedRevenue, 0, ',', '.') . " VNĐ\n\n" .
                  "QUY TẮC PHÂN TÍCH:\n" .
                  "1. ĐỌC KỸ TOÀN BỘ các tương tác, ghi chú và thảo luận nội bộ (đặc biệt các @mention phân công, thông báo học viên, tháng dự kiến nhập học, khóa học cụ thể, các cuộc gọi và phản hồi).\n" .
                  "2. Tóm tắt chính xác, đầy đủ tình trạng thực tế của khách hàng/học viên, không bỏ sót các thông tin mấu chốt.\n" .
                  "3. Nêu rõ các hành động tiếp theo thiết thực nhất cho đội ngũ tư vấn/tuyển sinh.\n\n" .
                  "YÊU CẦU ĐẦU RA:\n" .
                  "Trả về đúng định dạng JSON thuần không bọc markdown block với các trường sau:\n" .
                  "{\n" .
                  "  \"summary\": \"Tóm tắt 2-3 câu ngắn gọn, súc tích về hành trình tương tác, mức độ quan tâm và tiến độ tư vấn hiện tại.\",\n" .
                  "  \"key_needs\": [\"Nhu cầu 1\", \"Nhu cầu 2\"],\n" .
                  "  \"financial_status\": \"Tóm tắt ngắn gọn năng lực tài chính, khoản đã đóng/cọc và khả năng chốt.\",\n" .
                  "  \"potential_level\": \"Rất cao\" hoặc \"Cao\" hoặc \"Trung bình\" hoặc \"Thấp\",\n" .
                  "  \"potential_score\": 85 (số nguyên từ 0 đến 100 dựa trên hành vi tương tác và tài chính),\n" .
                  "  \"next_best_actions\": [\"Hành động đề xuất 1 cho Sale\", \"Hành động đề xuất 2\"]\n" .
                  "}";

        // 6. Invoke Ideas AI Partner Gateway
        $partnerUrl = 'https://api-ai-staging.ideas.edu.vn/api/partner/invoke';
        $partnerKey = 'sk_f4f35f7b9db0c07311e94ce2c725f54a5d6c73ffdc4bd1d6f14a6a300b7000b2';

        $payload = [
            'content' => [
                ['type' => 'text', 'text' => $prompt]
            ],
            'agent_config' => [
                'instructions' => 'Bạn là trợ lý AI thông minh phân tích và tóm tắt hành trình khách hàng trong hệ thống CRM/ERP. Trả về đúng JSON thuần không bọc markdown block.',
                'model' => 'google/gemini-3.6-flash',
                'temperature' => 0.1,
                'max_tokens' => 1500,
                'response_format' => ['type' => 'json_object']
            ]
        ];

        $aiResult = null;
        $ch = curl_init($partnerUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-api-key: ' . $partnerKey
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && $response) {
            $parsedRes = json_decode($response, true);
            $rawContent = $parsedRes['data']['content'] ?? '';
            if (is_string($rawContent) && trim($rawContent) !== '') {
                // Strip markdown code block if present
                $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', trim($rawContent));
                $aiResult = json_decode($cleanJson, true);
            } elseif (is_array($rawContent)) {
                $aiResult = $rawContent;
            }
        }

        // 7. Deterministic Fallback if AI Gateway fails or unparseable
        if (!$aiResult || empty($aiResult['summary'])) {
            $baseScore = 50;
            if ($totalSpent > 0) $baseScore += 30;
            if (count($activities) >= 3) $baseScore += 10;
            if (!empty($deals)) $baseScore += 10;
            $potentialScore = min(98, max(20, $baseScore));

            $potentialLevel = $potentialScore >= 80 ? 'Rất cao' : ($potentialScore >= 60 ? 'Cao' : ($potentialScore >= 40 ? 'Trung bình' : 'Thấp'));

            // Look for latest meaningful interaction/note snippet
            $latestSnippet = '';
            foreach ($activities as $a) {
                $b = $cleanContent($a['body'] ?? '');
                if (!empty($b)) {
                    $latestSnippet = $b;
                    break;
                }
            }
            if (empty($latestSnippet) && !empty($notes)) {
                $latestSnippet = $cleanContent($notes[0]['body'] ?? '');
            }

            $summaryFallback = "Khách hàng $contactName hiện đang ở giai đoạn '$stageName'. Đã có " . count($activities) . " lượt tương tác ghi nhận" . ($totalNotesCount > 0 ? " và $totalNotesCount ghi chú từ tư vấn viên." : ".");
            if (!empty($latestSnippet)) {
                $summaryFallback .= " Ghi nhận gần nhất: \"" . mb_substr($latestSnippet, 0, 100) . "...\"";
            }

            $aiResult = [
                'summary' => $summaryFallback,
                'key_needs' => [$demand ?: 'Quan tâm chương trình đào tạo/tư vấn'],
                'financial_status' => $totalSpent > 0 ? "Đã thanh toán/đặt cọc " . number_format($totalSpent, 0, ',', '.') . " VNĐ" : "Chưa phát sinh giao dịch đặt cọc",
                'potential_level' => $potentialLevel,
                'potential_score' => $potentialScore,
                'next_best_actions' => [
                    "Liên hệ khách hàng để cập nhật tiến độ tư vấn giai đoạn $stageName",
                    "Gửi thông tin chi tiết chương trình $demand và chính sách ưu đãi"
                ]
            ];
            $source = 'fallback_heuristic';
        } else {
            $source = 'ai_generated';
        }

        // Normalize fields
        $summary = trim((string)($aiResult['summary'] ?? ''));
        $keyNeeds = is_array($aiResult['key_needs'] ?? null) ? $aiResult['key_needs'] : [ (string)($aiResult['key_needs'] ?? '') ];
        $financialStatus = trim((string)($aiResult['financial_status'] ?? ''));
        $potentialLevel = trim((string)($aiResult['potential_level'] ?? 'Trung bình'));
        $potentialScore = (int)($aiResult['potential_score'] ?? 50);
        $nextActions = is_array($aiResult['next_best_actions'] ?? null) ? $aiResult['next_best_actions'] : [];

        // 8. Upsert into customer_ai_insights cache
        try {
            $stmtUpsert = $this->db->prepare("
                INSERT INTO customer_ai_insights (
                    tenant_id, contact_id, summary, key_needs_json, financial_status,
                    potential_level, potential_score, next_best_actions_json, metrics_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    summary = VALUES(summary),
                    key_needs_json = VALUES(key_needs_json),
                    financial_status = VALUES(financial_status),
                    potential_level = VALUES(potential_level),
                    potential_score = VALUES(potential_score),
                    next_best_actions_json = VALUES(next_best_actions_json),
                    metrics_json = VALUES(metrics_json),
                    updated_at = NOW()
            ");
            $stmtUpsert->execute([
                $tid,
                $contactId,
                $summary,
                json_encode($keyNeeds, JSON_UNESCAPED_UNICODE),
                $financialStatus,
                $potentialLevel,
                $potentialScore,
                json_encode($nextActions, JSON_UNESCAPED_UNICODE),
                json_encode($metrics, JSON_UNESCAPED_UNICODE)
            ]);
        } catch (\Throwable $e) {
            error_log("Error saving customer_ai_insights cache: " . $e->getMessage());
        }

        $nowStr = date('Y-m-d H:i:s');
        respond(200, [
            'summary' => $summary,
            'key_needs' => $keyNeeds,
            'financial_status' => $financialStatus,
            'potential_level' => $potentialLevel,
            'potential_score' => $potentialScore,
            'next_best_actions' => $nextActions,
            'analyzed_at' => $nowStr,
            'source' => $source,
            'metrics' => $metrics
        ], 'Phân tích hành trình khách hàng thành công');
    }

    private function ensureTables(): void {
        static $checked = false;
        if ($checked) return;
        try {
            if (!$this->db->inTransaction()) {
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

                $this->db->exec("
                    CREATE TABLE IF NOT EXISTS customer_ai_insights (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        tenant_id INT NOT NULL DEFAULT 1,
                        contact_id INT NOT NULL,
                        summary TEXT NOT NULL,
                        key_needs_json LONGTEXT NULL,
                        financial_status TEXT NULL,
                        potential_level VARCHAR(50) NOT NULL DEFAULT 'Trung bình',
                        potential_score INT NOT NULL DEFAULT 50,
                        next_best_actions_json LONGTEXT NULL,
                        metrics_json LONGTEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY uk_tenant_contact (tenant_id, contact_id),
                        INDEX idx_contact (contact_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                $checked = true;
            }
        } catch (\Throwable $e) {
            error_log("Ensure AI Knowledge Error: " . $e->getMessage());
        }
    }
}
