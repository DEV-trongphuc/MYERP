<?php
trait ChatAgentContextTrait {
    private function resolveCollaboratingAgents(string $query): array {
        $q = mb_strtolower(trim($query));
        
        $agentsMap = [
            'tasks' => [
                'id' => 'tasks',
                'name' => 'Agent Task',
                'roleTitle' => 'Kế hoạch & Việc con',
                'category' => 'tasks',
                'avatar' => '/stickers/ideas/ideas_16.webp',
                'badge' => 'Kế hoạch',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Phân rã việc con (WBS), checklist, phân bổ phòng ban, theo dõi deadline.',
                'statusText' => 'Đang lập kế hoạch & phân rã việc con...'
            ],
            'finance' => [
                'id' => 'finance',
                'name' => 'Agent Thu Chi',
                'roleTitle' => 'Kế toán & PO / SO',
                'category' => 'finance',
                'avatar' => '/stickers/ideas/ideas_25.webp',
                'badge' => 'Tài chính',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Phiếu chi PO, phiếu thu SO, tiền cọc học phí, tạm ứng và dòng tiền.',
                'statusText' => 'Đang đối soát số liệu PO / SO & thu chi...'
            ],
            'hrm' => [
                'id' => 'hrm',
                'name' => 'Agent Nhân Sự',
                'roleTitle' => 'Chấm công & Nhân sự',
                'category' => 'hrm',
                'avatar' => '/stickers/ideas/ideas_15.webp',
                'badge' => 'Nhân sự',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Sơ đồ phòng ban, ai quản lý, nhân sự nghỉ việc, chấm công, nay ai nghỉ & phép.',
                'statusText' => 'Đang tra cứu sơ đồ phòng ban, nhân sự & lịch nghỉ...'
            ],
            'sales' => [
                'id' => 'sales',
                'name' => 'Agent Sales',
                'roleTitle' => 'Tư vấn & CRM',
                'category' => 'sales',
                'avatar' => '/stickers/ideas/ideas_10.webp',
                'badge' => 'Tư vấn CRM',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Tiềm năng Lead, kịch bản tư vấn, 12 tình huống chốt sale & chăm sóc khách hàng.',
                'statusText' => 'Đang phân tích kịch bản tư vấn CRM...'
            ],
            'academic' => [
                'id' => 'academic',
                'name' => 'Agent Đào Tạo',
                'roleTitle' => 'Học vụ & Tuyển sinh',
                'category' => 'academic',
                'avatar' => '/stickers/ideas/ideas_12.webp',
                'badge' => 'Học vụ',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Chương trình quốc tế: EMBA, MBA, MSc AI, DBA ISTEC Paris, tín chỉ và luận văn.',
                'statusText' => 'Đang tra cứu khung chương trình & điều kiện...'
            ],
            'master' => [
                'id' => 'master',
                'name' => 'SI IDEAS',
                'roleTitle' => 'Chỉ huy & Tri thức',
                'category' => 'master',
                'avatar' => '/stickers/ideas/ideas_3.webp',
                'badge' => 'Chỉ huy',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Điều phối chung, tri thức kiểm định quốc tế Swiss UMEF & ISTEC Paris.',
                'statusText' => 'Đang tổng hợp câu trả lời...'
            ],
            'records_legal' => [
                'id' => 'records_legal',
                'name' => 'Agent Hồ Sơ & Pháp Lý',
                'roleTitle' => 'Thẩm định & Hồ sơ',
                'category' => 'records_legal',
                'avatar' => '/stickers/ideas/ideas_18.webp',
                'badge' => 'Thẩm định',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Thẩm định CCCD, bằng Đại học, bảng điểm, dịch thuật công chứng, hợp đồng đào tạo & cam kết.',
                'statusText' => 'Đang thẩm định danh mục hồ sơ & hợp đồng...'
            ],
            'assets_inventory' => [
                'id' => 'assets_inventory',
                'name' => 'Agent Tài Sản & Kho',
                'roleTitle' => 'Kho & Cấp phát TS',
                'category' => 'assets_inventory',
                'avatar' => '/stickers/ideas/ideas_32.webp',
                'badge' => 'Vật tư & TS',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Quản lý kho ấn phẩm, balo, áo polo, quà tặng tuyển sinh, giáo trình và tài sản công ty.',
                'statusText' => 'Đang tra cứu tồn kho ấn phẩm & cấp phát tài sản...'
            ],
            'marketing_campaigns' => [
                'id' => 'marketing_campaigns',
                'name' => 'Agent Marketing',
                'roleTitle' => 'Chiến dịch & Tăng trưởng',
                'category' => 'marketing_campaigns',
                'avatar' => '/stickers/ideas/ideas_20.webp',
                'badge' => 'Marketing',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Chiến dịch tuyển sinh, nguồn Lead, CPL, CAC, broadcast Zalo ZNS / SMS / Email và sự kiện.',
                'statusText' => 'Đang phân tích hiệu quả chiến dịch & nguồn Lead...'
            ],
            'executive_bi' => [
                'id' => 'executive_bi',
                'name' => 'Agent Trợ Lý Giám Đốc',
                'roleTitle' => 'Điều hành & Báo cáo BI',
                'category' => 'executive_bi',
                'avatar' => '/stickers/ideas/ideas_31.webp',
                'badge' => 'Điều hành BI',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Báo cáo P&L thời gian thực, dòng tiền ròng, phát hiện bất thường thu chi dành cho Ban Giám đốc.',
                'statusText' => 'Đang tổng hợp báo cáo điều hành & phân tích P&L...'
            ],
            'system_it' => [
                'id' => 'system_it',
                'name' => 'Agent Kỹ Thuật & Vận Hành',
                'roleTitle' => 'Hỗ trợ IT & Hệ thống',
                'category' => 'system_it',
                'avatar' => '/stickers/ideas/ideas_11.webp',
                'badge' => 'Kỹ thuật IT',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fef2f2',
                'description' => 'Giám sát đồng bộ Google Sheets, webhook, cronjob, tra cứu audit log và hỗ trợ lỗi hệ thống.',
                'statusText' => 'Đang kiểm tra trạng thái hệ thống & nhật ký vận hành...'
            ]
        ];

        $matchedKeys = [];

        // 1. Executive BI domain
        if (preg_match('/(p&l|doanh thu tổng|dòng tiền ròng|báo cáo ban giám đốc|báo cáo giám đốc|sức khỏe tài chính|bất thường thu chi)/iu', $q)) {
            $matchedKeys[] = 'executive_bi';
        }
        // 2. Records & Legal domain
        if (preg_match('/(hồ sơ|bằng cấp|bằng đại học|bảng điểm|dịch thuật|công chứng|cccd|hộ chiếu|cv tiếng anh|chứng chỉ ngoại ngữ|hợp đồng đào tạo|phụ lục hợp đồng|cam kết chuẩn)/iu', $q)) {
            $matchedKeys[] = 'records_legal';
        }
        // 3. Asset & Inventory domain
        if (preg_match('/(tồn kho|ấn phẩm|quà tặng|túi quà|balo|áo polo|sổ tay|bút ký|giáo trình|tài sản|cấp phát|bàn giao laptop|thu hồi tài sản|thiết bị văn phòng|hrm_assets)/iu', $q)) {
            $matchedKeys[] = 'assets_inventory';
        }
        // 4. Marketing domain
        if (preg_match('/(marketing|chiến dịch|nguồn lead|\bcpl\b|\bcac\b|facebook ads|google ads|tiktok|edufair|workshop|hội thảo tuyển sinh|sự kiện tuyển sinh|broadcast|zalo zns|email marketing)/iu', $q)) {
            $matchedKeys[] = 'marketing_campaigns';
        }
        // 5. IT System domain
        if (preg_match('/(lỗi app|webhook|sync sheet|đồng bộ sheet|cronjob|audit log|ai_query_audit_logs|kỹ thuật|sự cố hệ thống|kết nối csdl)/iu', $q)) {
            $matchedKeys[] = 'system_it';
        }
        // 6. Task domain
        if (preg_match('/(task|công việc|kế hoạch|việc con|subtask|deadline|giao việc|phân bổ|checklist|tiến độ)/iu', $q)) {
            $matchedKeys[] = 'tasks';
        }
        // 7. Finance domain
        if (preg_match('/(chi phí|phiếu chi|\bpo\b|phiếu thu|\bso\b|cọc|đặt cọc|học phí|tiền|tạm ứng|ngân sách|hóa đơn)/iu', $q)) {
            $matchedKeys[] = 'finance';
        }
        // 8. HRM domain
        if (preg_match('/(chấm công|nghỉ phép|phép năm|giải trình|quên chấm|đi trễ|bổ sung công|đổi ca|duyệt đơn|lương|phiếu lương|bảng lương|công ty có ai|phòng ban|quản lý|trưởng phòng|trưởng nhóm|leader|nhân sự|nhân viên|nghỉ việc|nay ai nghỉ|hôm nay ai nghỉ|sắp tới ai nghỉ|ai nghỉ|ai off|vắng mặt|wfh|công tác)/iu', $q)) {
            $matchedKeys[] = 'hrm';
        }
        // 9. Sales domain
        if (preg_match('/(lead|leads|\bdata\b|tiềm năng|khách hàng|crm|tư vấn|chốt sale|từ chối|học viên|chăm sóc|pipeline|pipieline|pipe line|phễu|giai đoạn|\bstage\b|phụ trách|chia số|chia vòng|vòng xoay|vòng mess|vòng hot\s*line|vòng form|vòng bba|vòng dba|bù số|bù data|\bsđt\b|(?:\+?84|0)\d[\d\.\-\s]{7,11}\d)/iu', $q)) {
            $matchedKeys[] = 'sales';
        }
        // 10. Academic domain
        if (preg_match('/(emba|mba|msc ai|dba|topup|istec|umef|thụy sĩ|pháp|tín chỉ|luận văn|đào tạo|tuyển sinh)/iu', $q)) {
            $matchedKeys[] = 'academic';
        }

        // De-duplicate matched keys
        $matchedKeys = array_unique($matchedKeys);

        if (empty($matchedKeys)) {
            return [
                'primaryAgent' => $agentsMap['master'],
                'collaborators' => [$agentsMap['master']],
                'is_multi_agent' => false,
                'synergySummary' => 'SI IDEAS điều phối trực tiếp.'
            ];
        }

        // Primary agent is first matched
        $primaryKey = $matchedKeys[0];
        $primaryAgent = $agentsMap[$primaryKey];

        $collaboratingList = [];
        foreach ($matchedKeys as $k) {
            $collaboratingList[] = $agentsMap[$k];
        }

        $isMultiAgent = count($collaboratingList) > 1;
        $agentNames = implode(' ➔ ', array_column($collaboratingList, 'name'));
        $synergySummary = $isMultiAgent 
            ? "Phối hợp liên chuyên môn giữa {$agentNames} để giải quyết toàn diện vấn đề." 
            : "Chuyên môn phụ trách: {$primaryAgent['roleTitle']}";

        return [
            'primaryAgent' => $primaryAgent,
            'collaborators' => $collaboratingList,
            'is_multi_agent' => $isMultiAgent,
            'synergySummary' => $synergySummary
        ];
    }

    /**
     * Resolve Active Specialized Agent (Backwards compatible proxy)
     */
    private function resolveActiveSpecializedAgent(string $query): array {
        return $this->resolveCollaboratingAgents($query)['primaryAgent'];
    }

    /**
     * Lightweight Ambient State Snapshot: Injects live stats (~2ms) into prompt
     * Informs Gemini about total pending tasks (e.g. 127) and pending approvals (e.g. 25)
     * so Gemini has immediate awareness without any hardcoded keywords!
     */
    private function getAmbientUserStateSnapshot(int $uid, int $tid, string $role): string {
        try {
            $isGlobalAdmin = in_array(strtolower($role), ['admin', 'superadmin', 'super_admin', 'director'], true);
            $leaveAdminOr = $isGlobalAdmin ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "";
            $expAdminOr = $isGlobalAdmin ? "OR (e.approver_id IS NULL OR e.approver_id = 0)" : "";

            // Consolidated Single-Pass Query (1 round-trip instead of 3)
            $stmtCombined = $this->db->prepare("
                SELECT 
                    COUNT(1) as total_undone,
                    COALESCE(SUM(CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() THEN 1 ELSE 0 END), 0) as overdue_count,
                    COALESCE(SUM(CASE WHEN a.priority IN ('urgent', 'high') THEN 1 ELSE 0 END), 0) as urgent_count,
                    COALESCE(SUM(CASE WHEN a.due_date IS NOT NULL AND a.due_date >= CURDATE() AND a.due_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END), 0) as today_count,
                    (
                        SELECT COUNT(1) 
                        FROM hrm_leave_requests l
                        JOIN users u ON l.user_id = u.id
                        WHERE u.tenant_id = ? AND l.status = 'pending' 
                          AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? {$leaveAdminOr})
                    ) as pending_leaves,
                    (
                        SELECT COUNT(1) 
                        FROM expenses e 
                        WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND e.status = 'pending' 
                          AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? {$expAdminOr})
                    ) as pending_expenses
                FROM activities a
                WHERE a.tenant_id = ? AND a.deleted_at IS NULL
                  AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')))
                  AND (a.status IS NULL OR a.status NOT IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong'))
            ");
            $stmtCombined->execute([
                $tid, $uid, $uid, $uid,
                $tid, $uid, $uid, $uid, $uid,
                $tid, $uid, $uid, $uid, (string)$uid
            ]);
            $tStats = $stmtCombined->fetch(PDO::FETCH_ASSOC) ?: [];
            $totalTasks = (int)($tStats['total_undone'] ?? 0);
            $overdueTasks = (int)($tStats['overdue_count'] ?? 0);
            $urgentTasks = (int)($tStats['urgent_count'] ?? 0);
            $todayTasks = (int)($tStats['today_count'] ?? 0);
            $pendingLeaves = (int)($tStats['pending_leaves'] ?? 0);
            $pendingExpenses = (int)($tStats['pending_expenses'] ?? 0);
            $totalApprovals = $pendingLeaves + $pendingExpenses;

            return "\n\n--- [TRẠNG THÁI TỔNG QUAN THỰC TẾ TRÊN HỆ THỐNG CỦA NGƯỜI DÙNG] ---\n"
                 . "• Bàn làm việc (Workspace): Đang có tổng cộng {$totalTasks} công việc chưa hoàn thành "
                 . "({$overdueTasks} việc quá hạn, {$urgentTasks} việc khẩn cấp/ưu tiên cao, {$todayTasks} việc đến hạn hôm nay).\n"
                 . "• Quy trình & Phê duyệt (Approvals): Đang có {$totalApprovals} phiếu đang chờ bạn duyệt ({$pendingExpenses} phiếu chi/PO, {$pendingLeaves} đơn nghỉ phép).\n"
                 . "• NGUYÊN TẮC TRẢ LỜI: Khi người dùng hỏi về công việc, tiến độ, phê duyệt, tài chính học viên, hãy dùng công cụ (Tool Calling) để trích xuất dữ liệu chi tiết. Vì số lượng việc/phiếu có thể rất nhiều (ví dụ 127 việc, 25 phiếu), HÃY THỐNG KÊ TỔNG SỐ VÀ CHỈ ĐƯA RA TOP 3-5 VIỆC QUAN TRỌNG/GẤP NHẤT TRƯỚC, rồi hỏi nhẹ nhàng người dùng có muốn xem tiếp nhóm nào không ('hỏi tới đâu trả lời tới đó')!\n"
                 . "--- [HẾT TRẠNG THÁI TỔNG QUAN] ---\n";
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Load Long-Term Episodic User Memories from ai_user_memories table
     */
    private function loadUserMemories(int $userId, int $tenantId): string {
        try {
            $stmt = $this->db->prepare("
                SELECT memory_key, memory_value, category, importance 
                FROM ai_user_memories 
                WHERE user_id = ? AND tenant_id = ? 
                ORDER BY importance DESC, updated_at DESC 
                LIMIT 15
            ");
            $stmt->execute([$userId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) return "";

            $out = "\n--- [TRÍ NHỚ DÀI HẠN & THÓI QUEN LÀM VIỆC CỦA NGƯỜI DÙNG (EPISODIC MEMORY)] ---\n";
            foreach ($rows as $r) {
                $out .= "• [{$r['category']}] {$r['memory_key']}: {$r['memory_value']}\n";
            }
            $out .= "--- [HẾT TRÍ NHỚ DÀI HẠN] ---\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Save Episodic User Memory into ai_user_memories table
     */
    private function saveUserMemory(int $userId, int $tenantId, string $key, string $value, string $category = 'preference', int $importance = 1): void {
        try {
            if ($userId <= 0 || empty($key) || empty($value)) return;
            $stmt = $this->db->prepare("
                INSERT INTO ai_user_memories (tenant_id, user_id, memory_key, memory_value, category, importance, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    memory_value = VALUES(memory_value),
                    category = VALUES(category),
                    importance = VALUES(importance),
                    updated_at = NOW()
            ");
            $stmt->execute([$tenantId, $userId, mb_substr(trim($key), 0, 100), trim($value), $category, $importance]);
        } catch (\Throwable $e) {
            // Safe ignore
        }
    }

    /**
     * Load Working Context Entities (Recent 48h) from ai_entity_context table
     * Seamlessly resolves pronouns like 'bạn ấy', 'học viên đó', 'task này', 'phiếu vừa rồi'
     */
    private function loadRecentEntityContext(int $userId, int $tenantId): string {
        try {
            $stmt = $this->db->prepare("
                SELECT entity_type, entity_id, entity_name, metadata_json, last_referenced_at 
                FROM ai_entity_context 
                WHERE user_id = ? AND tenant_id = ? AND last_referenced_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                ORDER BY last_referenced_at DESC 
                LIMIT 8
            ");
            $stmt->execute([$userId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) return "";

            $out = "\n--- [NGỮ CẢNH CÔNG VIỆC GẦN ĐÂY (ENTITY WORKING CONTEXT - 48 GIỜ QUA)] ---\n";
            $out .= "Nếu người dùng xưng hô hoặc nhắc đến các đại từ 'bạn ấy', 'học viên đó', 'task này', 'phiếu vừa rồi', hãy ưu tiên tham chiếu tới các thực thể gần nhất sau:\n";
            foreach ($rows as $r) {
                $metaStr = "";
                if (!empty($r['metadata_json'])) {
                    $m = json_decode($r['metadata_json'], true);
                    if (is_array($m)) {
                        $metaParts = [];
                        foreach ($m as $k => $v) {
                            if (is_scalar($v) && !empty($v)) $metaParts[] = "$k: $v";
                        }
                        if (!empty($metaParts)) $metaStr = " (" . implode(', ', array_slice($metaParts, 0, 3)) . ")";
                    }
                }
                $out .= "• [Thực thể: {$r['entity_type']}] ID #{$r['entity_id']} - {$r['entity_name']}{$metaStr}\n";
            }
            $out .= "--- [HẾT NGỮ CẢNH CÔNG VIỆC GẦN ĐÂY] ---\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Record or Update Working Context Entity in ai_entity_context table
     */
    private function recordEntityContext(int $userId, int $tenantId, string $entityType, int $entityId, string $entityName, array $metadata = []): void {
        try {
            if ($entityId <= 0 || empty($entityName) || $userId <= 0) return;
            $json = !empty($metadata) ? json_encode($metadata, JSON_UNESCAPED_UNICODE) : null;
            $stmt = $this->db->prepare("
                INSERT INTO ai_entity_context (tenant_id, user_id, entity_type, entity_id, entity_name, metadata_json, last_referenced_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    entity_name = VALUES(entity_name),
                    metadata_json = VALUES(metadata_json),
                    last_referenced_at = NOW()
            ");
            $stmt->execute([$tenantId, $userId, $entityType, $entityId, mb_substr(trim($entityName), 0, 255), $json]);

            // Lightweight Garbage Collector: Purge stale entity contexts older than 30 days (1% probability)
            if (mt_rand(1, 100) === 1) {
                $this->db->exec("DELETE FROM ai_entity_context WHERE last_referenced_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            }
        } catch (\Throwable $e) {
            // Safe ignore
        }
    }

    /**
     * Proactive Operational Risk & Bottleneck Detection Engine (Zero-Mock Real SQL)
     */
    private function detectProactiveOperationalRisks(int $userId, int $tenantId, string $userRole): string {
        try {
            $risks = [];
            $roleLower = strtolower($userRole);
            $isPrivileged = in_array($roleLower, ['admin', 'superadmin', 'director', 'manager', 'accountant'], true);

            // 1. Stale leads for sales/consultants (uncontacted > 3 days)
            $stmtLead = $this->db->prepare("
                SELECT COUNT(1) FROM contacts 
                WHERE tenant_id = ? AND deleted_at IS NULL 
                  AND (" . ($isPrivileged ? "1=1" : "owner_id = ?") . ")
                  AND stage_id IN (SELECT id FROM pipeline_stages WHERE name NOT LIKE '%Đã đóng%' AND name NOT LIKE '%Lost%' AND name NOT LIKE '%Won%')
                  AND created_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
                  AND (last_contact IS NULL OR last_contact <= DATE_SUB(NOW(), INTERVAL 3 DAY))
            ");
            $stmtLead->execute($isPrivileged ? [$tenantId] : [$tenantId, $userId]);
            $staleCount = (int)$stmtLead->fetchColumn();
            if ($staleCount > 0) {
                $risks[] = "Có {$staleCount} học viên/lead chưa được tương tác lại trên 3 ngày (nguy cơ bỏ quên học viên).";
            }

            // 2. Pending approvals waiting > 48h
            $stmtAppr = $this->db->prepare("
                SELECT 
                    (SELECT COUNT(1) FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE u.tenant_id = ? AND l.status = 'pending' AND l.created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR) AND (l.approver_id = ? OR l.approver_id_2 = ? " . ($isPrivileged ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "") . ")) as pending_leave,
                    (SELECT COUNT(1) FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending' AND created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR) AND (approver_id = ? OR approver_id_2 = ? OR approver_id_3 = ? " . ($isPrivileged ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . ")) as pending_expense
            ");
            $stmtAppr->execute([$tenantId, $userId, $userId, $tenantId, $userId, $userId, $userId]);
            $apprRow = $stmtAppr->fetch(PDO::FETCH_ASSOC);
            $overdueApprs = ((int)($apprRow['pending_leave'] ?? 0)) + ((int)($apprRow['pending_expense'] ?? 0));
            if ($overdueApprs > 0) {
                $risks[] = "Có {$overdueApprs} phiếu đề xuất/nghỉ phép đang chờ bạn phê duyệt quá 48 giờ.";
            }

            // 3. Overdue tasks
            $stmtTasks = $this->db->prepare("
                SELECT COUNT(1) FROM activities 
                WHERE tenant_id = ? AND deleted_at IS NULL 
                  AND type IN ('task', 'meeting')
                  AND (user_id = ? OR created_by = ?)
                  AND (status IS NULL OR status NOT IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong'))
                  AND (progress < 100 OR progress IS NULL)
                  AND due_date IS NOT NULL AND due_date < NOW()
            ");
            $stmtTasks->execute([$tenantId, $userId, $userId]);
            $overdueTasks = (int)$stmtTasks->fetchColumn();
            if ($overdueTasks > 0) {
                $risks[] = "Có {$overdueTasks} công việc của bạn đã quá hạn chót (Deadline) cần xử lý hoặc gia hạn.";
            }

            // 4. Overdue tuition orders with outstanding balances (for accountant/admin/manager)
            if ($isPrivileged) {
                $stmtTuition = $this->db->prepare("
                    SELECT COUNT(1) FROM sales_orders 
                    WHERE tenant_id = ? AND payment_status IN ('unpaid', 'partial') 
                      AND (status IS NULL OR status NOT IN ('cancelled', 'draft')) 
                      AND (total - COALESCE(paid_amount, 0)) > 0
                ");
                $stmtTuition->execute([$tenantId]);
                $overdueTuition = (int)$stmtTuition->fetchColumn();
                if ($overdueTuition > 0) {
                    $risks[] = "Có {$overdueTuition} đơn hàng/học phí còn tồn đọng chưa thanh toán đủ hoặc đang chờ đối soát.";
                }
            }

            if (empty($risks)) return "";

            $out = "\n--- [CẢNH BÁO RỦI RO VẬN HÀNH & NÚT THẮT (PROACTIVE OPERATIONAL RISKS)] ---\n";
            foreach ($risks as $r) {
                $out .= "• CẢNH BÁO: {$r}\n";
            }
            $out .= "HƯỚNG DẪN PROACTIVE: Nếu câu hỏi của người dùng có liên quan hoặc ở cuối câu trả lời tổng hợp, bạn hãy nhắc nhở khéo léo hoặc xuất khối <<<PROACTIVE_INSIGHT: {...}>>> để hỗ trợ xử lý kịp thời!\n";
            $out .= "--- [HẾT CẢNH BÁO RỦI RO] ---\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Auto-record Entity Context from Tool execution results
     */
    private function autoRecordEntityFromTool(int $uid, int $tid, string $toolName, array $toolArgs, array $toolResult): void {
        try {
            if ($uid <= 0) return;
            if (!empty($toolResult['requires_disambiguation']) || ($toolResult['status'] ?? '') === 'DISAMBIGUATION_REQUIRED') {
                return;
            }

            if ($toolName === 'get_contact_360_profile') {
                $cId = (int)($toolResult['contact_id'] ?? ($toolResult['profile']['id'] ?? ($toolArgs['contact_id'] ?? 0)));
                $cName = $toolResult['profile']['full_name'] ?? ($toolResult['contact']['full_name'] ?? ($toolResult['profile']['name'] ?? ''));
                if ($cId > 0 && !empty($cName)) {
                    $meta = [
                        'phone' => $toolResult['profile']['phone'] ?? '',
                        'email' => $toolResult['profile']['email'] ?? '',
                        'stage' => $toolResult['profile']['stage_name'] ?? ''
                    ];
                    $this->recordEntityContext($uid, $tid, 'contact', $cId, $cName, $meta);
                }
            } elseif ($toolName === 'search_contacts') {
                $contacts = $toolResult['contacts'] ?? [];
                if (!empty($contacts) && is_array($contacts) && count($contacts) === 1) {
                    $top = $contacts[0];
                    $cId = (int)($top['id'] ?? 0);
                    $cName = $top['full_name'] ?? ($top['name'] ?? '');
                    if ($cId > 0 && !empty($cName)) {
                        $this->recordEntityContext($uid, $tid, 'contact', $cId, $cName, ['phone' => $top['phone'] ?? '']);
                    }
                }
            } elseif ($toolName === 'get_task_detail') {
                $t = $toolResult['task'] ?? ($toolResult['data'] ?? []);
                $tId = (int)($t['id'] ?? ($toolArgs['task_id'] ?? 0));
                $tTitle = $t['subject'] ?? ($t['title'] ?? '');
                if ($tId > 0 && !empty($tTitle)) {
                    $this->recordEntityContext($uid, $tid, 'task', $tId, $tTitle, ['due_date' => $t['due_date'] ?? '']);
                }
            } elseif ($toolName === 'draft_action_proposal') {
                $type = $toolArgs['action_type'] ?? 'proposal';
                $title = $toolArgs['title'] ?? 'Đề xuất ERP';
                $p = $toolArgs['params'] ?? [];
                if (is_string($p)) $p = json_decode($p, true) ?: [];
                $cId = (int)($p['contact_id'] ?? ($p['user_id'] ?? 0));
                if ($cId > 0) {
                    $name = $p['customer_name'] ?? ($p['student_name'] ?? ($p['recipient_name'] ?? ($p['assignee_name'] ?? $title)));
                    $this->recordEntityContext($uid, $tid, $type, $cId, $name);
                }
            }
        } catch (\Throwable $e) {
            // Safe ignore
        }
    }

    /**
     * Smart Real-time Lookup across ERP Database (Fallback Entity Extractor for Phone, Email, #ID)
     * Anti-hallucination & Token Optimization: Returns max 3-5 ground-truth records
     */
    private function executeSmartErpLookup(string $query, int $uid, int $tid, string $role): string {
        try {
            $cleanQ = trim($query);
            if (mb_strlen($cleanQ) < 2) return '';

            // Detect patterns
            $isSearchIntent = false;
            $searchKeywords = ['tìm', 'tra cứu', 'kiểm tra', 'xem đơn', 'thông tin', 'khách hàng', 'học viên', 'sđt', 'email', 'task', 'công việc', 'đề xuất', 'chi phí', 'po', 'so', 'đơn', 'đóng tiền', 'tiền', 'học phí', 'cọc', 'đóng cọc', 'nộp tiền', 'công ty', 'nhân sự', 'nhân viên', 'phòng ban', 'quản lý', 'trưởng phòng', 'leader', 'nghỉ việc', 'nghỉ', 'vắng mặt', 'wfh', 'công tác', 'lịch nghỉ', 'ai nghỉ'];
            foreach ($searchKeywords as $kw) {
                if (mb_stripos($cleanQ, $kw) !== false) {
                    $isSearchIntent = true;
                    break;
                }
            }

            // Extract phone number (e.g. 0901234567)
            $phoneMatch = [];
            if (preg_match('/(0[3|5|7|8|9][0-9]{8})/u', $cleanQ, $phoneMatch)) {
                $isSearchIntent = true;
            }

            // Extract email
            $emailMatch = [];
            if (preg_match('/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/u', $cleanQ, $emailMatch)) {
                $isSearchIntent = true;
            }

            // Extract numeric ID (#123 or task 123 or đơn 123)
            $idMatch = [];
            $searchId = 0;
            if (preg_match('/(?:#|task|đơn|công việc|po|so|id)\s*([0-9]{1,8})/iu', $cleanQ, $idMatch)) {
                $searchId = (int)$idMatch[1];
                $isSearchIntent = true;
            }

            if (!$isSearchIntent) {
                return '';
            }

            $extractedPhone = $phoneMatch[1] ?? '';
            $extractedEmail = $emailMatch[1] ?? '';

            // Extract clean search term (strip intent prefixes and payment question suffixes)
            $cleanTerm = trim(preg_replace('/^(?:tìm|tra\s*cứu|kiểm\s*tra|xem|cho\s*tôi\s*biết\s*thông\s*tin\s*về|hãy\s*tìm|học\s*viên|khách\s*hàng)\s+/iu', '', $cleanQ));
            $cleanTerm = trim(preg_replace('/(?:\s*(?:đã\s*)?(?:đóng\s*tiền|nộp\s*tiền|đóng\s*cọc|nộp\s*học\s*phí|chưa|đóng\s*chưa))\??$/iu', '', $cleanTerm));
            $like = '%' . $cleanTerm . '%';

            $cleanRole = strtolower($role);
            require_once __DIR__ . '/AgentToolRegistry.php';
            $leadRbac = AgentToolRegistry::evaluateLeadReadScope($this->db, [
                'user_id' => $uid,
                'tenant_id' => $tid,
                'role' => $cleanRole
            ]);
            $isGlobalAdmin = in_array($cleanRole, ['admin', 'superadmin', 'super_admin', 'director'], true);
            $isAccountant = in_array($cleanRole, ['accountant', 'ke_toan'], true);
            $isManager = in_array($cleanRole, ['manager', 'truong_phong'], true);
            $isHR = in_array($cleanRole, ['hr', 'nhan_su'], true);
            $isSale = in_array($cleanRole, ['sales', 'sale', 'kinh_doanh'], true);

            $results = [];

            // 1. Lookup Contacts / Leads & Tuition Deposits (Enforce Sales RBAC Isolation synced with ContactController::getScope)
            if (!empty($extractedPhone) || !empty($extractedEmail) || $searchId > 0 || mb_stripos($cleanQ, 'khách') !== false || mb_stripos($cleanQ, 'học viên') !== false || mb_stripos($cleanQ, 'lead') !== false || mb_stripos($cleanQ, 'hợp đồng') !== false || mb_stripos($cleanQ, 'đóng tiền') !== false || mb_stripos($cleanQ, 'học phí') !== false || mb_stripos($cleanQ, 'cọc') !== false) {
                $cWhere = [];
                $cParams = [$tid];
                if (!empty($extractedPhone)) {
                    $cWhere[] = "c.phone LIKE ?";
                    $cParams[] = '%' . $extractedPhone . '%';
                }
                if (!empty($extractedEmail)) {
                    $cWhere[] = "c.email LIKE ?";
                    $cParams[] = '%' . $extractedEmail . '%';
                }
                if ($searchId > 0) {
                    $cWhere[] = "c.id = ?";
                    $cParams[] = $searchId;
                }
                if (empty($cWhere) && mb_strlen($cleanTerm) >= 2) {
                    $fzLookupName = AgentToolRegistry::buildVietnameseFuzzyNameWhere('c.full_name', $cleanTerm, $cParams);
                    $cWhere[] = "({$fzLookupName} OR c.phone LIKE ? OR c.email LIKE ?)";
                    $cParams[] = $like;
                    $cParams[] = $like;
                }

                if (!empty($cWhere)) {
                    $sqlC = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.stage_id, ps.name as stage_name, ps.order_index as stage_order, u.full_name as owner_name
                             FROM contacts c
                             LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                             LEFT JOIN users u ON c.owner_id = u.id
                             WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $cWhere) . ")";
                    
                    // Sales & Staff Zero-Trust Isolation: synced 100% with ContactController::getScope
                    if (!$leadRbac['can_view_all_leads'] && !$leadRbac['can_view_team_leads']) {
                        $sqlC .= " AND (c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR c.id IN (
                            SELECT contact_id FROM cooperation_slips 
                            WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                        ))";
                        $cParams[] = $uid;
                        $cParams[] = (string)$uid;
                        $cParams[] = (string)$uid;
                    } elseif (!$leadRbac['can_view_all_leads'] && $leadRbac['can_view_team_leads']) {
                        $teamIdLookup = (int)($leadRbac['team_id'] ?? 0);
                        $sqlC .= " AND (c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (? > 0 AND team_id = ?)))";
                        $cParams[] = $uid;
                        $cParams[] = (string)$uid;
                        $cParams[] = $uid;
                        $cParams[] = $teamIdLookup;
                        $cParams[] = $teamIdLookup;
                    }

                    $sqlC .= " ORDER BY c.id DESC LIMIT 3";
                    $stmtC = $this->db->prepare($sqlC);
                    $stmtC->execute($cParams);
                    $contacts = $stmtC->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($contacts as $c) {
                        $stage = $c['stage_name'] ?: ($c['status'] ?: 'Mới');
                        $stageOrder = !empty($c['stage_order']) ? (int)$c['stage_order'] : 1;
                        $soReadiness = ($stageOrder >= 13) 
                            ? "✅ Đã đến bước Tạo SO / Đóng cọc (Giai đoạn {$stageOrder}/14)" 
                            : "⚠️ CHƯA đến bước Tạo SO / Đóng cọc (Hiện tại bước {$stageOrder}/14 - Cần đề xuất chuyển sang Giai đoạn 13 – Deposit / Tuition Payment)";
                        $owner = $c['owner_name'] ? " | Phụ trách: {$c['owner_name']}" : "";
                        $results[] = "👤 [Khách hàng/Học viên #{$c['id']}]: {$c['full_name']} | SĐT: {$c['phone']} | Email: {$c['email']} | Giai đoạn: {$stage} [{$soReadiness}]{$owner}";
                    }

                    // Query Deposits / Tuition Fees linked to these contacts
                    $cIds = array_column($contacts, 'id');
                    if (!empty($cIds)) {
                        $inCids = implode(',', array_fill(0, count($cIds), '?'));
                        $stmtDep = $this->db->prepare("
                            SELECT d.id, d.unit_code, d.price as amount, d.status, d.contact_id, d.created_at,
                                   c.full_name as contact_name
                            FROM deposits d
                            JOIN contacts c ON d.contact_id = c.id
                            WHERE d.contact_id IN ($inCids)
                            ORDER BY d.id DESC LIMIT 4
                        ");
                        $stmtDep->execute($cIds);
                        $depList = $stmtDep->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        if (!empty($depList)) {
                            foreach ($depList as $dep) {
                                $depAmt = number_format((float)$dep['amount'], 0, ',', '.') . ' VND';
                                $depDate = $dep['created_at'] ? date('d/m/Y', strtotime($dep['created_at'])) : '';
                                $unit = $dep['unit_code'] ? " (Mã: {$dep['unit_code']})" : "";
                                $depStatus = $dep['status'] === 'approved' ? 'ĐÃ DUYỆT (ĐÃ THU)' : ($dep['status'] === 'pending' ? 'CHỜ KẾ TOÁN DUYỆT' : $dep['status']);
                                $results[] = "💵 [Phiếu thu/cọc #{$dep['id']}]: Thu: {$depAmt} | Trạng thái: {$depStatus}{$unit} | Ngày: {$depDate} | Học viên: {$dep['contact_name']} (#{$dep['contact_id']})";
                            }
                        } elseif (mb_stripos($cleanQ, 'tiền') !== false || mb_stripos($cleanQ, 'cọc') !== false || mb_stripos($cleanQ, 'học phí') !== false) {
                            $results[] = "ℹ️ [Thông tin tài chính]: Học viên này hiện CHƯA có bất kỳ phiếu đặt cọc hoặc đóng tiền nào trên hệ thống ERP.";
                        }
                    }
                }
            }

            // 2. Specific Task by ID
            if ($searchId > 0) {
                $sqlT = "SELECT a.id, a.subject, a.status, a.priority, a.due_date, u.full_name as assignee_name
                         FROM activities a
                         LEFT JOIN users u ON a.user_id = u.id
                         WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND a.id = ?";
                $tParams = [$tid, $searchId];
                if (!$isGlobalAdmin && !$isManager) {
                    $sqlT .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ?)";
                    $tParams[] = $uid;
                    $tParams[] = $uid;
                    $tParams[] = $uid;
                }
                $stmtT = $this->db->prepare($sqlT);
                $stmtT->execute($tParams);
                $taskRow = $stmtT->fetch(PDO::FETCH_ASSOC);
                if ($taskRow) {
                    $due = $taskRow['due_date'] ? date('d/m/Y', strtotime($taskRow['due_date'])) : 'Không đặt hạn';
                    $results[] = "📋 [Chi tiết Công việc #{$taskRow['id']}]: {$taskRow['subject']} | Trạng thái: {$taskRow['status']} | Ưu tiên: {$taskRow['priority']} | Hạn: {$due}";
                }
            }

            // 3. Lookup Expenses / Payment Proposals (Enforce Finance RBAC Isolation)
            if ($searchId > 0 || mb_stripos($cleanQ, 'chi') !== false || mb_stripos($cleanQ, 'thanh toán') !== false || mb_stripos($cleanQ, 'expense') !== false) {
                $eWhere = [];
                $eParams = [$tid];
                if ($searchId > 0) {
                    $eWhere[] = "e.id = ?";
                    $eParams[] = $searchId;
                }
                if (mb_strlen($cleanTerm) >= 2) {
                    $eWhere[] = "(e.title LIKE ? OR e.vendor_name LIKE ?)";
                    $eParams[] = $like;
                    $eParams[] = $like;
                }

                if (!empty($eWhere)) {
                    $sqlE = "SELECT e.id, e.title, e.amount, e.vendor_name, e.status, u.full_name as creator_name
                             FROM expenses e
                             LEFT JOIN users u ON e.created_by = u.id
                             WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND (" . implode(" OR ", $eWhere) . ")";

                    if (!$isGlobalAdmin && !$isAccountant) {
                        $sqlE .= " AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ?)";
                        $eParams[] = $uid;
                        $eParams[] = $uid;
                        $eParams[] = $uid;
                    }

                    $sqlE .= " ORDER BY e.id DESC LIMIT 3";
                    $stmtE = $this->db->prepare($sqlE);
                    $stmtE->execute($eParams);
                    $expenses = $stmtE->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($expenses as $e) {
                        $amt = number_format((float)$e['amount'], 0, ',', '.') . ' VND';
                        $vendor = $e['vendor_name'] ? " | Đơn vị thụ hưởng: {$e['vendor_name']}" : "";
                        $creator = $e['creator_name'] ? " | Người tạo: {$e['creator_name']}" : "";
                        $results[] = "💰 [Đề xuất chi #{$e['id']}]: {$e['title']} | Số tiền: {$amt} | Trạng thái: {$e['status']}{$vendor}{$creator}";
                    }
                }
            }

            // 4. Lookup Leave Requests (Enforce HR RBAC Isolation)
            if ($searchId > 0 || mb_stripos($cleanQ, 'nghỉ') !== false || mb_stripos($cleanQ, 'phép') !== false || mb_stripos($cleanQ, 'wfh') !== false || mb_stripos($cleanQ, 'ot') !== false) {
                $lWhere = [];
                $lParams = [$tid];
                if ($searchId > 0) {
                    $lWhere[] = "l.id = ?";
                    $lParams[] = $searchId;
                }
                if (mb_strlen($cleanTerm) >= 2) {
                    $lWhere[] = "(l.reason LIKE ? OR u.full_name LIKE ?)";
                    $lParams[] = $like;
                    $lParams[] = $like;
                }

                if (!empty($lWhere)) {
                    $sqlL = "SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.status, l.reason, u.full_name as emp_name
                             FROM hrm_leave_requests l
                             LEFT JOIN users u ON l.user_id = u.id
                             WHERE u.tenant_id = ? AND (" . implode(" OR ", $lWhere) . ")";

                    if (!$isGlobalAdmin && !$isHR && !$isManager) {
                        $sqlL .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ?)";
                        $lParams[] = $uid;
                        $lParams[] = $uid;
                        $lParams[] = $uid;
                    }

                    $sqlL .= " ORDER BY l.id DESC LIMIT 3";
                    $stmtL = $this->db->prepare($sqlL);
                    $stmtL->execute($lParams);
                    $leaves = $stmtL->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($leaves as $l) {
                        $reason = $l['reason'] ? " | Lý do: {$l['reason']}" : "";
                        $emp = $l['emp_name'] ? " | Nhân sự: {$l['emp_name']}" : "";
                        $results[] = "🏖️ [Đơn nghỉ #{$l['id']}]: Loại: {$l['leave_type']} ({$l['total_days']} ngày: {$l['start_date']} đến {$l['end_date']}) | Trạng thái: {$l['status']}{$emp}{$reason}";
                    }
                }
            }

            // 5. Lookup Purchase Orders (PO) & Sales Orders (SO)
            if ($searchId > 0 || mb_stripos($cleanQ, 'po') !== false || mb_stripos($cleanQ, 'so') !== false || mb_stripos($cleanQ, 'đơn mua') !== false || mb_stripos($cleanQ, 'đơn bán') !== false || mb_stripos($cleanQ, 'hợp đồng') !== false) {
                // PO
                if ($isGlobalAdmin || $isAccountant || $isManager) {
                    $stmtPo = $this->db->prepare("
                        SELECT po.id, po.po_number, po.total, po.status, s.name as supplier_name
                        FROM purchase_orders po
                        LEFT JOIN suppliers s ON po.supplier_id = s.id
                        WHERE po.tenant_id = ? AND (po.id = ? OR po.po_number LIKE ? OR s.name LIKE ?)
                        ORDER BY po.id DESC LIMIT 2
                    ");
                    $stmtPo->execute([$tid, $searchId, $like, $like]);
                    foreach ($stmtPo->fetchAll(PDO::FETCH_ASSOC) as $po) {
                        $sup = $po['supplier_name'] ? " | NCC: {$po['supplier_name']}" : "";
                        $amt = number_format((float)$po['total'], 0, ',', '.') . ' VND';
                        $results[] = "📦 [Đơn mua PO #{$po['id']} - {$po['po_number']}]: Tổng: {$amt} | Trạng thái: {$po['status']}{$sup}";
                    }
                }

                // SO
                $soSql = "
                    SELECT so.id, so.so_number, so.total, so.status, so.terms, c.full_name as cust_name, c.phone as cust_phone
                    FROM sales_orders so
                    LEFT JOIN contacts c ON so.contact_id = c.id
                    WHERE so.tenant_id = ? AND (so.id = ? OR so.so_number LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?)
                ";
                $soParams = [$tid, $searchId, $like, $like, $like];
                if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                    $soSql .= " AND (so.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                    $soParams[] = $uid;
                    $soParams[] = $uid;
                    $soParams[] = (string)$uid;
                }
                $soSql .= " ORDER BY so.id DESC LIMIT 2";
                $stmtSo = $this->db->prepare($soSql);
                $stmtSo->execute($soParams);
                foreach ($stmtSo->fetchAll(PDO::FETCH_ASSOC) as $so) {
                    $cust = $so['cust_name'] ? " | Khách hàng: {$so['cust_name']} ({$so['cust_phone']})" : "";
                    $amt = number_format((float)$so['total'], 0, ',', '.') . ' VND';
                    $terms = !empty($so['terms']) ? " | Điều khoản: " . mb_substr($so['terms'], 0, 40) . "..." : "";
                    $results[] = "📑 [Đơn bán SO #{$so['id']} - {$so['so_number']}]: Tổng: {$amt} | Trạng thái: {$so['status']}{$cust}{$terms}";
                }
            }

            // 6. Lookup Company Staff Directory & Org Leaders (When user asks about who is in company, dept leaders, or resignations)
            if (mb_stripos($cleanQ, 'công ty có ai') !== false || mb_stripos($cleanQ, 'ai phòng ban') !== false || mb_stripos($cleanQ, 'ai quản lý') !== false || mb_stripos($cleanQ, 'nghỉ việc') !== false || mb_stripos($cleanQ, 'danh bạ') !== false || mb_stripos($cleanQ, 'sơ đồ') !== false || (mb_stripos($cleanQ, 'nhân sự') !== false && mb_stripos($cleanQ, 'ai') !== false) || (mb_stripos($cleanQ, 'nhân viên') !== false && (mb_stripos($cleanQ, 'ai') !== false || mb_stripos($cleanQ, 'danh sách') !== false))) {
                // Total counts
                $cntStmt = $this->db->prepare("SELECT 
                                                    SUM(CASE WHEN (is_active = 1 OR is_active IS NULL) AND (status = 'active' OR status IS NULL) THEN 1 ELSE 0 END) as active_count,
                                                    SUM(CASE WHEN is_active = 0 OR status IN ('inactive', 'leave') THEN 1 ELSE 0 END) as inactive_count
                                               FROM users WHERE tenant_id = ?");
                $cntStmt->execute([$tid]);
                $userCounts = $cntStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                $actCount = (int)($userCounts['active_count'] ?? 0);
                $inactCount = (int)($userCounts['inactive_count'] ?? 0);

                // Departments & leaders
                $deptStmt = $this->db->prepare("SELECT t.name as team_name, u.full_name as leader_name, COUNT(u2.id) as member_count
                                                FROM teams t
                                                LEFT JOIN users u ON t.leader_id = u.id
                                                LEFT JOIN users u2 ON (u2.team_id = t.id AND (u2.is_active = 1 OR u2.is_active IS NULL))
                                                WHERE t.tenant_id = ?
                                                GROUP BY t.id
                                                ORDER BY t.name ASC");
                $deptStmt->execute([$tid]);
                $deptList = $deptStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $deptSummaries = [];
                foreach ($deptList as $d) {
                    $lName = $d['leader_name'] ?: 'Chưa bổ nhiệm';
                    $deptSummaries[] = "{$d['team_name']} ({$d['member_count']} người, Leader: {$lName})";
                }

                $results[] = "🏢 [Tổ chức Công ty]: Tổng số {$actCount} nhân sự đang hoạt động. Các phòng ban/nhóm: " . implode(' | ', $deptSummaries);

                // If asked about resigned/off staff and has permission
                if (($isGlobalAdmin || $isHR || $isManager) && (mb_stripos($cleanQ, 'nghỉ việc') !== false || mb_stripos($cleanQ, 'off') !== false)) {
                    $offStmt = $this->db->prepare("SELECT u.full_name, u.job_title, u.role, u.department, u.status
                                                   FROM users u
                                                   WHERE u.tenant_id = ? AND (u.is_active = 0 OR u.status IN ('inactive', 'leave'))
                                                   ORDER BY u.updated_at DESC LIMIT 5");
                    $offStmt->execute([$tid]);
                    $offUsers = $offStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    if (!empty($offUsers)) {
                        $offNames = array_map(function($o) {
                            $title = !empty($o['job_title']) ? $o['job_title'] : ($o['role'] ?? 'Nhân sự');
                            $st = $o['status'] ?? 'inactive';
                            return "{$o['full_name']} ({$title} - {$st})";
                        }, $offUsers);
                        $results[] = "🛑 [Nhân sự đã nghỉ việc/Inactive]: Tổng {$inactCount} người. Gần đây gồm: " . implode(', ', $offNames);
                    }
                }
            }

            // 7. Lookup Company Absences & Leaves (Nay ai nghỉ, sắp tới ai nghỉ, ai WFH, ai công tác)
            if (mb_stripos($cleanQ, 'nay ai nghỉ') !== false || mb_stripos($cleanQ, 'hôm nay ai nghỉ') !== false || mb_stripos($cleanQ, 'sắp tới ai nghỉ') !== false || mb_stripos($cleanQ, 'ai đang nghỉ') !== false || mb_stripos($cleanQ, 'ai vắng mặt') !== false || mb_stripos($cleanQ, 'ai wfh') !== false || (mb_stripos($cleanQ, 'ai') !== false && mb_stripos($cleanQ, 'nghỉ') !== false)) {
                // Today off
                $todayStmt = $this->db->prepare("SELECT l.leave_type, l.start_date, l.end_date, u.full_name, u.job_title, COALESCE(t.name, 'Phòng ban khác') as dept_name
                                                 FROM hrm_leave_requests l
                                                 JOIN users u ON l.user_id = u.id
                                                 LEFT JOIN teams t ON u.team_id = t.id
                                                 WHERE u.tenant_id = ? AND l.status = 'approved' AND CURDATE() BETWEEN DATE(l.start_date) AND DATE(l.end_date)");
                $todayStmt->execute([$tid]);
                $todayOff = $todayStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                // Check vacation mode in users
                $vacStmt = $this->db->prepare("SELECT u.full_name, u.job_title, COALESCE(t.name, 'Phòng ban khác') as dept_name
                                               FROM users u
                                               LEFT JOIN teams t ON u.team_id = t.id
                                               WHERE u.tenant_id = ? AND (u.is_active = 1 OR u.is_active IS NULL) AND u.vacation_mode = 1");
                $vacStmt->execute([$tid]);
                $vacOff = $vacStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $allTodayOff = [];
                foreach ($todayOff as $o) {
                    $tLabel = ($o['leave_type'] === 'remote_work') ? 'WFH' : (($o['leave_type'] === 'business_trip') ? 'Công tác' : 'Nghỉ phép');
                    $allTodayOff[] = "{$o['full_name']} ({$o['dept_name']} - {$tLabel})";
                }
                foreach ($vacOff as $v) {
                    $allTodayOff[] = "{$v['full_name']} ({$v['dept_name']} - Vacation mode)";
                }

                if (!empty($allTodayOff)) {
                    $results[] = "🏖️ [Hôm nay ai vắng mặt/nghỉ]: Có " . count($allTodayOff) . " người gồm: " . implode(', ', array_unique($allTodayOff));
                } else {
                    $results[] = "✅ [Hôm nay ai nghỉ]: Toàn bộ nhân sự công ty đi làm đầy đủ, không có ai vắng mặt hoặc đăng ký nghỉ phép/WFH hôm nay.";
                }

                // Upcoming approved leaves (next 14 days)
                $upStmt = $this->db->prepare("SELECT l.leave_type, l.start_date, l.end_date, l.total_days, u.full_name, COALESCE(t.name, 'Phòng ban khác') as dept_name
                                              FROM hrm_leave_requests l
                                              JOIN users u ON l.user_id = u.id
                                              LEFT JOIN teams t ON u.team_id = t.id
                                              WHERE u.tenant_id = ? AND l.status = 'approved' AND DATE(l.start_date) > CURDATE() AND DATE(l.start_date) <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
                                              ORDER BY l.start_date ASC LIMIT 5");
                $upStmt->execute([$tid]);
                $upOff = $upStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (!empty($upOff)) {
                    $upList = [];
                    foreach ($upOff as $uo) {
                        $sDate = date('d/m', strtotime($uo['start_date']));
                        $eDate = date('d/m', strtotime($uo['end_date']));
                        $dStr = ($sDate === $eDate) ? $sDate : "{$sDate}-{$eDate}";
                        $upList[] = "{$uo['full_name']} ({$uo['dept_name']}: nghỉ {$uo['total_days']} ngày từ {$dStr})";
                    }
                    $results[] = "📅 [Sắp tới ai nghỉ (14 ngày tới)]: " . implode('; ', $upList);
                }
            }

            if (empty($results)) {
                return '';
            }

            $output = "\n\n--- [DỮ LIỆU THỰC TẾ TRA CỨU TỪ HỆ THỐNG ERP (GROUND TRUTH)] ---\n";
            $output .= implode("\n", array_slice($results, 0, 5)) . "\n";
            $output .= "--- [HẾT DỮ LIỆU TRA CỨU (HÃY SỬ DỤNG SỐ LIỆU NÀY ĐỂ TRẢ LỜI CHUẨN XÁC)] ---\n";
            return $output;
        } catch (\Throwable $e) {
            error_log("Smart ERP Lookup Error: " . $e->getMessage());
            return '';
        }
    }

    /**
     * Retrieve RAG context from ai_training_chunks / ai_training_docs
     */
    private function retrieveRagContext(string $query, int $tid): array {
        try {
            $cleanQuery = trim($query);
            if (mb_strlen($cleanQuery) < 3) return [];

            // Boundary check: if 0 trained docs exist, return early without error
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM ai_training_docs d WHERE d.is_active = 1 AND d.status = 'trained' AND d.tenant_id = ?");
            $stmtCount->execute([$tid]);
            $count = (int)$stmtCount->fetchColumn();
            if ($count === 0) return [];

            // 1. Natural Language Full-Text Search (up to 12 chunks)
            $stmt = $this->db->prepare("
                SELECT c.id, c.content, d.name AS doc_name, d.tags
                FROM ai_training_chunks c
                JOIN ai_training_docs d ON c.doc_id = d.id
                WHERE d.is_active = 1 AND d.status = 'trained' AND d.tenant_id = ?
                  AND MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE)
                ORDER BY MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) DESC
                LIMIT 12
            ");
            $stmt->execute([$tid, $cleanQuery, $cleanQuery]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // 2. Complement with Keyword LIKE search if fewer than 12 chunks found
            $needed = 12 - count($results);
            if ($needed > 0) {
                $cleanTerms = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $cleanQuery);
                $words = array_values(array_filter(explode(' ', mb_strtolower($cleanTerms)), function($w) {
                    return mb_strlen($w) >= 2;
                }));

                $stopwords = [
                    'cho', 'hoi', 'hỏi', 've', 'về', 'cua', 'của', 'la', 'là', 'co', 'có',
                    'khong', 'không', 'thi', 'thì', 'nhu', 'như', 'the', 'thế', 'nao', 'nào',
                    'bao', 'nhieu', 'nhiêu', 'em', 'anh', 'chi', 'chị', 'toi', 'tôi', 'minh', 'mình',
                    'tai', 'tại', 'trong', 'theo', 'quy', 'dinh', 'định'
                ];
                $meaningfulWords = array_values(array_unique(array_filter($words, function($w) use ($stopwords) {
                    return !in_array($w, $stopwords, true);
                })));
                if (empty($meaningfulWords)) {
                    $meaningfulWords = array_values(array_unique($words));
                }

                $searchTerms = [];
                if (count($meaningfulWords) >= 2) {
                    $searchTerms[] = $meaningfulWords[0] . ' ' . $meaningfulWords[1];
                }
                foreach ($meaningfulWords as $mw) {
                    if (count($searchTerms) >= 4) break;
                    if (!in_array($mw, $searchTerms, true)) {
                        $searchTerms[] = $mw;
                    }
                }

                if (!empty($searchTerms)) {
                    $existingIds = array_column($results, 'id') ?: [0];
                    $inPlaceholders = implode(',', array_fill(0, count($existingIds), '?'));

                    $orClauses = [];
                    $scoreClauses = [];
                    $likeParams = [];
                    $scoreParams = [];

                    foreach ($searchTerms as $term) {
                        $likeVal = '%' . $term . '%';
                        $orClauses[] = "(c.content LIKE ? OR d.name LIKE ? OR d.tags LIKE ?)";
                        $likeParams[] = $likeVal;
                        $likeParams[] = $likeVal;
                        $likeParams[] = $likeVal;

                        $scoreClauses[] = "(CASE WHEN c.content LIKE ? OR d.name LIKE ? OR d.tags LIKE ? THEN 1 ELSE 0 END)";
                        $scoreParams[] = $likeVal;
                        $scoreParams[] = $likeVal;
                        $scoreParams[] = $likeVal;
                    }

                    $orSql = implode(' OR ', $orClauses);
                    $scoreSql = implode(' + ', $scoreClauses);

                    $stmtLike = $this->db->prepare("
                        SELECT c.id, c.content, d.name AS doc_name, d.tags
                        FROM ai_training_chunks c
                        JOIN ai_training_docs d ON c.doc_id = d.id
                        WHERE d.is_active = 1 AND d.status = 'trained' AND d.tenant_id = ?
                          AND c.id NOT IN ($inPlaceholders)
                          AND ($orSql)
                        ORDER BY ($scoreSql) DESC, c.id DESC
                        LIMIT " . (int)$needed
                    );
                    $params = array_merge([$tid], $existingIds, $likeParams, $scoreParams);
                    $stmtLike->execute($params);
                    $likeResults = $stmtLike->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    $results = array_merge($results, $likeResults);
                }
            }

            return $results;
        } catch (\Throwable $e) {
            error_log("RAG Retrieval Error: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Extract plain text from Word (.docx) file
     */
    private function extractDocxText(string $filePath): string {
        if (!class_exists('ZipArchive')) return '';
        $zip = new \ZipArchive();
        if ($zip->open($filePath) !== true) return '';
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if (!$xml) return '';
        $xml = preg_replace('/<\/w:p>/', "\n", $xml);
        $xml = preg_replace('/<w:br[^>]*\/>/', "\n", $xml);
        $text = strip_tags($xml);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
        return trim(preg_replace("/\n{3,}/", "\n\n", $text));
    }

    /**
     * Extract structured table from Excel (.xlsx) file
     */
    private function extractXlsxText(string $filePath): string {
        if (!class_exists('ZipArchive')) return '';
        $zip = new \ZipArchive();
        if ($zip->open($filePath) !== true) return '';

        $sharedStrings = [];
        $stringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($stringsXml) {
            $xmlObj = @simplexml_load_string($stringsXml);
            if ($xmlObj && isset($xmlObj->si)) {
                foreach ($xmlObj->si as $si) {
                    $sharedStrings[] = (string)($si->t ?? (isset($si->r) ? implode('', (array)$si->r) : ''));
                }
            }
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        if (!$sheetXml) return '';

        $xmlObj = @simplexml_load_string($sheetXml);
        if (!$xmlObj || !isset($xmlObj->sheetData->row)) return '';

        $rows = [];
        $rowCount = 0;
        foreach ($xmlObj->sheetData->row as $r) {
            if ($rowCount >= 100) {
                $rows[] = ['... (dữ liệu còn tiếp, đã giới hạn 100 dòng đầu) ...'];
                break;
            }
            $rowCells = [];
            foreach ($r->c as $c) {
                $type = (string)($c['t'] ?? '');
                $val = (string)($c->v ?? '');
                if ($type === 's' && isset($sharedStrings[(int)$val])) {
                    $val = $sharedStrings[(int)$val];
                }
                $rowCells[] = trim($val);
            }
            if (!empty(array_filter($rowCells))) {
                $rows[] = $rowCells;
                $rowCount++;
            }
        }

        if (empty($rows)) return '';

        $output = "";
        foreach ($rows as $idx => $cells) {
            $output .= "| " . implode(" | ", array_map(function($c) { return str_replace('|', '/', $c); }, $cells)) . " |\n";
            if ($idx === 0) {
                $output .= "| " . implode(" | ", array_fill(0, count($cells), '---')) . " |\n";
            }
        }
        return $output;
    }

    /**
     * DTO Slimming & Context Compacting for Gemini ReAct Loop
     * Strips redundant metadata, nulls, oversized strings, and limits oversized arrays to save tokens.
     */
    private function compactToolResultForModel(mixed $data, int $depth = 0): mixed {
        if ($depth > 6) {
            return $data;
        }

        if (is_array($data)) {
            $isAssoc = array_keys($data) !== range(0, count($data) - 1);

            // If it's a huge sequential array at top/second level (e.g. > 35 items list), keep top 35
            if (!$isAssoc && count($data) > 35) {
                $totalCount = count($data);
                $sliced = array_slice($data, 0, 35);
                $compactedList = [];
                foreach ($sliced as $item) {
                    $compactedList[] = $this->compactToolResultForModel($item, $depth + 1);
                }
                if ($depth <= 1) {
                    $compactedList[] = [
                        '_summary' => "Đã hiển thị 35 bản ghi tiêu biểu nhất trong tổng số {$totalCount} bản ghi thực tế."
                    ];
                }
                return $compactedList;
            }

            $cleaned = [];
            $ignoredKeys = [
                'avatar', 'avatar_url', 'deleted_at', 'password', 'password_hash', 
                'token', 'access_token', 'refresh_token', 'secret', 'system_token',
                'raw_query', 'system_logs'
            ];

            foreach ($data as $k => $v) {
                if (is_string($k) && in_array(strtolower($k), $ignoredKeys, true)) {
                    continue;
                }

                // Remove null or empty string values in associative arrays to cut token footprint
                if ($isAssoc && ($v === null || $v === '')) {
                    continue;
                }

                $cleaned[$k] = $this->compactToolResultForModel($v, $depth + 1);
            }
            return $cleaned;
        }

        if (is_string($data)) {
            // Never truncate smart UI tags or export markdown/URLs
            if (strpos($data, '<<<') !== false || strpos($data, '[[') !== false || strpos($data, '/api/export') !== false) {
                return $data;
            }
            // Trim excessive text length (over 2500 chars) in plain text tool returns to prevent token bloat
            if (mb_strlen($data) > 2500) {
                return mb_substr($data, 0, 2500) . '... [Dữ liệu tiếp theo đã được rút gọn để tối ưu token]';
            }
            return $data;
        }

        return $data;
    }

    /**
     * AI Semantic Micro-Router for Multi-Agent Swarm (Zero Regex / Pure Agentic Prompt Analyzer)
     * Ultra-fast AI classifier that analyzes user prompt intent and active browser context into domain and exact tool requirements.
     * Uses Groq Cloud LPU (`openai/gpt-oss-20b` -> `qwen/qwen3.8-27b`) first and seamlessly falls back to Gemini Flash Lite.
     */
    private function routeQueryWithAiMicroRouter(
        string $userQuery,
        string $apiKey,
        string $model,
        ?array $currentContext = null,
        string $groqKey = '',
        string $groqModel = 'qwen/qwen3.8-27b'
    ): array {
        $safeFallback = [
            'intent_type' => 'database_action',
            'primary_domain' => null,
            'matched_domains' => [],
            'selected_tools' => [],
            'requires_tools' => true,
            'is_multi_domain' => true,
            'is_mutation_or_proposal' => false,
            'reasoning' => 'Fallback safe default'
        ];

        $trimmed = trim($userQuery);
        if ($trimmed === '' || (empty($groqKey) && empty($apiKey))) {
            return $safeFallback;
        }

        $contextHint = "";
        if (!empty($currentContext) && is_array($currentContext)) {
            $hints = [];
            $path = trim((string)($currentContext['pathname'] ?? ''));
            $pageTitle = trim((string)($currentContext['page_title'] ?? ''));
            if ($path !== '') {
                $hints[] = "Màn hình đang mở: {$path}" . ($pageTitle !== '' ? " ({$pageTitle})" : "");
            }
            $activeEntity = $currentContext['active_entity'] ?? null;
            if (!empty($activeEntity) && is_array($activeEntity) && !empty($activeEntity['id'])) {
                $eType = $activeEntity['type'] ?? 'thực thể';
                $eId = (int)$activeEntity['id'];
                $eName = trim((string)($activeEntity['name'] ?? ''));
                $hints[] = "Drawer hồ sơ đang mở: {$eType} ID #{$eId}" . ($eName !== '' ? " ({$eName})" : "");
            }
            if (!empty($hints)) {
                $contextHint = "\n[NGỮ CẢNH TRÌNH DUYỆT]: " . implode(' | ', $hints);
            }
        }

        $routerSystemPrompt = "Bạn là AI Semantic Router tối cao của hệ thống MYERP (Viện IDEAS).\n"
            . "Nhiệm vụ: Phân tích ngữ nghĩa câu hỏi của người dùng để phân loại Ý định (Intent), Phân hệ nghiệp vụ (Domain) và chọn ra danh sách công cụ (selected_tools) phù hợp nhất.\n"
            . "11 Phân hệ & Công cụ chủ lực:\n"
            . "- 'sales': Quản lý Lead, CRM, học viên theo giai đoạn (pipeline/stage), tổng quan data học viên/khách hàng, hiệu suất lead, phân bổ lead, vòng xoay chia số, trùng lead, lịch hẹn, xuất file lead, nhân khẩu học.\n"
            . "  Tools: query_customer_student_persona_overview, query_sales_lead_performance_deck, query_crm_leads_multitier, search_contacts, get_contact_360_profile, export_crm_leads_advanced, analyze_leads_demographics_and_job_titles, get_sales_leaderboard, smart_create_or_assign_leads, reassign_lead_owner, manage_lead_round_distribution, get_consultant_shift_and_fairshare_audit, check_lead_duplicate_and_fairshare_status, get_sales_performance_and_stale_leads, schedule_contact_activity, update_contact_pipeline, add_contact_consultation_note, update_contact_profile, quick_log_crm_activity, get_my_crm_inbox, draft_action_proposal.\n"
            . "- 'finance': Thu chi, học phí, công nợ, phiếu thu SO, phiếu chi PO, đặt cọc, tạm ứng, dòng tiền, ngân sách phòng ban.\n"
            . "  Tools: query_finance_multitier_analytics, query_deposits_and_revenue_multitier, filter_expenses_advanced, get_financial_overview, get_executive_financial_pulse, lookup_recent_cash_receipts_and_deposits, get_upcoming_tuition_receivables, get_contact_financial_summary, get_my_payment_proposals, smart_manage_po_so_and_approvals, approve_or_reject_erp_ticket, draft_action_proposal.\n"
            . "- 'hrm': Nhân sự, chấm công hôm nay/theo tháng, đi trễ, về sớm, OT, WFH, nghỉ phép, ai nghỉ hôm nay, giải trình công, bảng lương, phiếu lương, danh bạ nhân sự, duyệt đơn.\n"
            . "  Tools: query_hrm_workforce_and_payroll_multitier, query_company_attendance_and_work_hours, get_company_leave_and_absence, get_staff_directory_advanced, get_company_staff_directory, get_my_attendance_summary, get_my_payslip, manage_my_hr_profile_and_requests, smart_manage_hrm_and_payroll, get_pending_approvals, trace_approval_blocker, approve_or_reject_erp_ticket, draft_action_proposal.\n"
            . "- 'tasks': Công việc cá nhân/team, tiến độ, deadline, việc con (subtask/checklist), giao việc, dự án.\n"
            . "  Tools: query_tasks_and_projects_multitier, get_my_tasks, get_task_detail, smart_manage_tasks_and_subtasks, query_and_manage_projects, update_task_progress_and_status, complete_task_checklist_item, draft_action_proposal.\n"
            . "- 'academic': Chương trình đào tạo (EMBA, MBA, MSc AI, DBA, UBIS, Swiss UMEF, ASC, Apollos, SBS), đợt nhập học (Intake 01..47), môn học, lịch khai giảng, danh sách & chân dung học viên học vụ, học viên học nhiều khóa.\n"
            . "  Tools: query_customer_student_persona_overview, get_academic_students_filter, get_program_details, get_academic_schedule_and_intakes, search_ideas_knowledge, query_crm_leads_multitier.\n"
            . "- 'records_legal': Hồ sơ nhập học (CCCD, bằng cấp, bảng điểm), tính hợp lệ, hợp đồng đào tạo.\n"
            . "  Tools: check_student_admission_records, get_academic_students_filter, get_contact_360_profile, attach_files_to_contact.\n"
            . "- 'assets_inventory': Tồn kho, ấn phẩm, quà tặng, balo, áo polo, tài sản, laptop thiết bị.\n"
            . "  Tools: query_inventory_and_assets_multitier, get_inventory_health_check, get_inventory_and_asset_status.\n"
            . "- 'b2b_partner': Khách hàng doanh nghiệp, đối tác B2B, cơ hội hợp tác (deals).\n"
            . "  Tools: query_deals_and_b2b_multitier, get_b2b_partner_and_contract_summary.\n"
            . "- 'marketing_campaigns': Chiến dịch Marketing, Automation Flow, Voucher, Khảo sát, Website Tracking, Zalo/Meta đa kênh, dấu chân số 360, hiệu quả nguồn marketing, chân dung học viên/khách hàng.\n"
            . "  Tools: query_customer_student_persona_overview, query_sales_lead_performance_deck, query_omnichannel_journey_and_automation_analytics, get_lead_digital_footprint_360, smart_manage_automation_flows_and_campaigns, get_campaign_marketing_stats, query_crm_leads_multitier.\n"
            . "- 'executive_bi': Báo cáo tổng hợp P&L, dòng tiền ròng, tổng quan data khách hàng & học viên, hiệu suất lead, KPI toàn viện, tóm tắt đầu ngày cho Ban Giám Đốc.\n"
            . "  Tools: query_customer_student_persona_overview, query_sales_lead_performance_deck, query_cross_domain_executive_synthesis, get_executive_morning_brief, get_executive_financial_pulse, get_sales_leaderboard, query_crm_leads_multitier, query_finance_multitier_analytics, query_deposits_and_revenue_multitier.\n"
            . "- 'system_it': Lỗi phần mềm, ticket CNTT, giám sát SLA vi phạm, sức khỏe hệ thống.\n"
            . "  Tools: query_tickets_and_sla_multitier, get_ticket_status_and_sla_breaches, get_system_health_status.\n\n"
            . "QUY TẮC:\n"
            . "- Khi người dùng yêu cầu lọc, tìm kiếm, thống kê hoặc bóc tách dữ liệu theo bất kỳ điều kiện nào: BẮT BUỘC chọn intent_type='database_action' hoặc 'cross_domain', requires_tools=true, và chọn từ 2 đến 5 tên công cụ phù hợp nhất vào mảng `selected_tools`.\n"
            . "- Nếu có [NGỮ CẢNH TRÌNH DUYỆT] đi kèm và câu hỏi ngắn/dùng đại từ ('tóm tắt', 'kiểm tra bạn này', 'xem hồ sơ', 'đã cọc chưa', 'phiếu này', 'task này'): BẮT BUỘC gán primary_domain và selected_tools tương ứng với đối tượng đang mở (contact -> get_contact_360_profile, query_crm_leads_multitier; expense/deposit -> query_finance_multitier_analytics, query_deposits_and_revenue_multitier; task -> get_task_detail, query_tasks_and_projects_multitier).\n"
            . "- is_mutation_or_proposal: true nếu người dùng yêu cầu tạo mới, thêm, sửa, cập nhật, giao việc, chuyển/chia lead, duyệt/từ chối đơn, ghi chú, đặt lịch hẹn, hoặc lập thẻ đề xuất hành động (luôn thêm 'draft_action_proposal' vào selected_tools).\n"
            . "Trả về duy nhất 1 JSON object chuẩn, không kèm markdown:\n"
            . "{\"intent_type\": \"conversational\"|\"knowledge_qa\"|\"database_action\"|\"cross_domain\", \"primary_domain\": \"sales\"|\"finance\"|\"hrm\"|\"tasks\"|\"academic\"|\"records_legal\"|\"assets_inventory\"|\"b2b_partner\"|\"marketing_campaigns\"|\"executive_bi\"|\"system_it\"|\"none\", \"matched_domains\": [\"sales\"], \"selected_tools\": [\"query_crm_leads_multitier\"], \"requires_tools\": boolean, \"is_multi_domain\": boolean, \"is_mutation_or_proposal\": boolean, \"reasoning\": \"lý do ngắn gọn\"}";

        $userPrompt = "Yêu cầu cần phân loại: \"" . mb_substr($trimmed, 0, 500) . "\"" . $contextHint;

        // 1. Primary AI Micro-Router on Groq Cloud LPU (`openai/gpt-oss-20b` independent quota bucket -> `$groqModel` `qwen/qwen3.8-27b`)
        /* [COMMENTED OUT FREE MODEL - USE GEMINI 3.5 FLASH LITE AS PRIMARY]
        if ($groqKey !== '') {
            $routerModels = array_values(array_unique(['openai/gpt-oss-20b', $groqModel, 'openai/gpt-oss-120b']));
            foreach ($routerModels as $rm) {
                if ($this->isGroqModelInCooldown($groqKey, $rm)) {
                    continue;
                }
                $groqPayload = [
                    'model' => $rm,
                    'messages' => [
                        ['role' => 'system', 'content' => $routerSystemPrompt],
                        ['role' => 'user', 'content' => $userPrompt]
                    ],
                    'temperature' => 0.1,
                    'max_tokens' => 300,
                    'response_format' => ['type' => 'json_object']
                ];

                $chGr = curl_init('https://api.groq.com/openai/v1/chat/completions');
                curl_setopt($chGr, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chGr, CURLOPT_POST, true);
                curl_setopt($chGr, CURLOPT_POSTFIELDS, json_encode($groqPayload, JSON_UNESCAPED_UNICODE));
                curl_setopt($chGr, CURLOPT_HTTPHEADER, [
                    'Authorization: Bearer ' . $groqKey,
                    'Content-Type: application/json'
                ]);
                curl_setopt($chGr, CURLOPT_TIMEOUT, 6);
                curl_setopt($chGr, CURLOPT_CONNECTTIMEOUT, 3);
                curl_setopt($chGr, CURLOPT_SSL_VERIFYPEER, true);

                $respGr = curl_exec($chGr);
                $httpGr = (int)curl_getinfo($chGr, CURLINFO_HTTP_CODE);
                curl_close($chGr);

                if ($httpGr === 200 && $respGr) {
                    $decodedGr = json_decode((string)$respGr, true);
                    $rawGrText = $this->stripReasoningTags((string)($decodedGr['choices'][0]['message']['content'] ?? ''));
                    if ($rawGrText !== '') {
                        $cleanGrJson = trim((string)preg_replace('/^```(?:json)?|```$/m', '', $rawGrText));
                        if (preg_match('/\{[\s\S]*\}/', $cleanGrJson, $jsonMatch)) {
                            $cleanGrJson = $jsonMatch[0];
                        }
                        $parsedGr = json_decode($cleanGrJson, true);
                        if (is_array($parsedGr) && isset($parsedGr['intent_type'])) {
                            if (empty($parsedGr['matched_domains']) && !empty($parsedGr['primary_domain']) && $parsedGr['primary_domain'] !== 'none') {
                                $parsedGr['matched_domains'] = [$parsedGr['primary_domain']];
                            }
                            if (!isset($parsedGr['selected_tools']) || !is_array($parsedGr['selected_tools'])) {
                                $parsedGr['selected_tools'] = [];
                            }
                            return $parsedGr;
                        }
                    }
                } elseif ($httpGr === 429) {
                    $this->markGroqModelCooldown($groqKey, $rm, 45);
                }
            }
        }
        */

        // 2. Gemini 3.5 Flash Lite Micro-Router
        if ($apiKey !== '') {
            $payload = [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $routerSystemPrompt]
                    ]
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $userPrompt]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'temperature' => 0.1,
                    'maxOutputTokens' => 300,
                    'responseMimeType' => 'application/json'
                ]
            ];

            $routerUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
            $ch = curl_init($routerUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

            $resp = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && $resp) {
                $json = json_decode((string)$resp, true);
                $rawText = (string)($json['candidates'][0]['content']['parts'][0]['text'] ?? '');
                if ($rawText !== '') {
                    $cleanJson = trim((string)preg_replace('/^```(?:json)?|```$/m', '', $rawText));
                    $parsed = json_decode($cleanJson, true);
                    if (is_array($parsed) && isset($parsed['intent_type'])) {
                        if (empty($parsed['matched_domains']) && !empty($parsed['primary_domain']) && $parsed['primary_domain'] !== 'none') {
                            $parsed['matched_domains'] = [$parsed['primary_domain']];
                        }
                        if (!isset($parsed['selected_tools']) || !is_array($parsed['selected_tools'])) {
                            $parsed['selected_tools'] = [];
                        }
                        return $parsed;
                    }
                }
            }
        }

        return $safeFallback;
    }

    /**
     * Call AI Engine (Gemini 3.5 Flash Lite Primary Engine; Free Groq/Qwen models commented out)
     * Supports Autonomous Two-Way Tool Loop (Function Calling) with Zero-Trust RBAC & 2-Tier Working Memory
     */
}
