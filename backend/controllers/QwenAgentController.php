<?php
// backend/controllers/QwenAgentController.php
// Standalone Multi-Agent Orchestrator powered 100% by Qwen 3.8 27B on Groq Cloud (Zero Gemini API calls)

if (!function_exists('mb_strtolower')) {
    function mb_strtolower(string $str, ?string $encoding = null): string {
        return strtolower($str);
    }
}
if (!function_exists('mb_substr')) {
    function mb_substr(string $str, int $start, ?int $length = null, ?string $encoding = null): string {
        if ($str === '') return '';
        if (preg_match_all('/./us', $str, $m)) {
            $chars = array_slice($m[0], $start, $length);
            return implode('', $chars);
        }
        return $length === null ? substr($str, $start) : substr($str, $start, $length);
    }
}
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $str, ?string $encoding = null): int {
        if ($str === '') return 0;
        $cnt = preg_match_all('/./us', $str, $m);
        return $cnt !== false ? $cnt : strlen($str);
    }
}
if (!function_exists('mb_strpos')) {
    function mb_strpos(string $haystack, string $needle, int $offset = 0, ?string $encoding = null): int|false {
        return strpos($haystack, $needle, $offset);
    }
}

require_once __DIR__ . '/AgentToolRegistry.php';

class QwenAgentController {
    private PDO $db;
    private const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
    private const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * Resolve Groq API Key securely from environment (.env.local / .env) or system_settings table.
     * Never exposes the raw key to the frontend.
     */
    private function getGroqApiKey(): string {
        $envKey = trim((string)($_ENV['GROQ_API_KEY'] ?? getenv('GROQ_API_KEY') ?: ''));
        $dbKey = '';
        try {
            $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'groq_api_key' LIMIT 1");
            $stmt->execute();
            $dbKey = trim((string)($stmt->fetchColumn() ?: ''));
        } catch (\Throwable $e) {
            // Ignore DB read error
        }

        if ($dbKey !== '') {
            return $dbKey;
        }

        if ($envKey !== '') {
            // Auto-seed into system_settings so remote/local DB persists it safely
            try {
                $stmtUpsert = $this->db->prepare("
                    INSERT INTO system_settings (setting_key, setting_value)
                    VALUES ('groq_api_key', ?)
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                ");
                $stmtUpsert->execute([$envKey]);
            } catch (\Throwable $e) {
                // Ignore if read-only
            }
            return $envKey;
        }

        return '';
    }

    private function getActiveModel(?string $requestedModel = null): string {
        $allowedModels = [
            'qwen/qwen3.8-27b',
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'allam-2-7b',
        ];
        if ($requestedModel && in_array($requestedModel, $allowedModels, true)) {
            return $requestedModel;
        }
        try {
            $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'groq_model' LIMIT 1");
            $stmt->execute();
            $saved = trim((string)($stmt->fetchColumn() ?: ''));
            if ($saved !== '' && in_array($saved, $allowedModels, true)) {
                return $saved;
            }
        } catch (\Throwable $e) {
            // Ignore
        }
        $envModel = trim((string)($_ENV['GROQ_MODEL'] ?? getenv('GROQ_MODEL') ?: ''));
        if ($envModel !== '' && in_array($envModel, $allowedModels, true)) {
            return $envModel;
        }
        return self::DEFAULT_MODEL;
    }

    private function maskApiKey(string $key): string {
        $len = strlen($key);
        if ($len <= 12) {
            return $len > 0 ? 'gsk_••••••••' : 'Chưa cấu hình';
        }
        return substr($key, 0, 8) . '••••••••••••' . substr($key, -6);
    }

    /**
     * GET /qwen-agent/status
     */
    public function status(array $auth): void {
        $apiKey = $this->getGroqApiKey();
        $activeModel = $this->getActiveModel($_GET['model'] ?? null);

        $allToolsDecl = AgentToolRegistry::getGeminiToolsDeclaration(null);
        $declarations = $allToolsDecl[0]['functionDeclarations'] ?? [];

        respond(200, [
            'has_key' => $apiKey !== '',
            'masked_key' => $this->maskApiKey($apiKey),
            'active_model' => $activeModel,
            'engine' => 'Turnio 3.8 27B • Groq Cloud LPU (Zero Gemini)',
            'available_models' => [
                [
                    'id' => 'qwen/qwen3.8-27b',
                    'name' => 'Turnio 3.8 27B (LPU Engine)',
                    'context_window' => 131072,
                    'badge' => 'Mặc định • Tối ưu Tiếng Việt & Tool Calling',
                ],
                [
                    'id' => 'openai/gpt-oss-120b',
                    'name' => 'Turnio 120B Pro (Deep Reasoning)',
                    'context_window' => 131072,
                    'badge' => '120B • Suy luận sâu đa bước',
                ],
                [
                    'id' => 'openai/gpt-oss-20b',
                    'name' => 'Turnio 20B Lite (Fast Light)',
                    'context_window' => 131072,
                    'badge' => '20B • Tốc độ siêu thanh',
                ],
            ],
            'total_tools' => count($declarations),
            'tool_names' => array_values(array_map(fn($d) => $d['name'] ?? '', $declarations)),
        ], 'Trạng thái Turnio 3.8 27B Agent Lab');
    }

    /**
     * POST /qwen-agent/settings
     */
    public function updateSettings(array $auth): void {
        $body = getBody();
        $newKey = isset($body['groq_api_key']) ? trim((string)$body['groq_api_key']) : null;
        $newModel = isset($body['groq_model']) ? trim((string)$body['groq_model']) : null;

        try {
            if ($newKey !== null && $newKey !== '') {
                $stmt = $this->db->prepare("
                    INSERT INTO system_settings (setting_key, setting_value)
                    VALUES ('groq_api_key', ?)
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                ");
                $stmt->execute([$newKey]);
            }
            if ($newModel !== null && $newModel !== '') {
                $stmt = $this->db->prepare("
                    INSERT INTO system_settings (setting_key, setting_value)
                    VALUES ('groq_model', ?)
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                ");
                $stmt->execute([$newModel]);
            }
            $currentKey = $this->getGroqApiKey();
            respond(200, [
                'has_key' => $currentKey !== '',
                'masked_key' => $this->maskApiKey($currentKey),
                'active_model' => $this->getActiveModel($newModel),
            ], 'Đã lưu cấu hình Turnio 3.8 27B thành công');
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi lưu cấu hình: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /qwen-agent/chat
     * Clones the complete SI IDEAS Multi-Agent Orchestrator + AgentToolRegistry using 100% Turnio 3.8 27B on Groq Cloud.
     */
    public function chat(array $auth): void {
        $startWallMs = microtime(true);
        $body = getBody();
        $userMessage = trim((string)($body['message'] ?? $body['prompt'] ?? ''));
        if ($userMessage === '') {
            respond(422, null, 'Nội dung câu hỏi không được để trống', false);
            return;
        }

        $apiKey = $this->getGroqApiKey();
        if ($apiKey === '') {
            respond(422, null, 'Chưa cấu hình GROQ_API_KEY trên hệ thống.', false);
            return;
        }

        $model = $this->getActiveModel($body['model'] ?? null);
        $temperature = isset($body['temperature']) ? max(0.0, min(1.0, (float)$body['temperature'])) : 0.15;
        $pinnedAgentId = isset($body['pinned_agent_id']) ? trim((string)$body['pinned_agent_id']) : 'auto';
        $historyInput = isset($body['history']) && is_array($body['history']) ? $body['history'] : [];
        $attachedEntity = isset($body['attached_entity']) && is_array($body['attached_entity']) ? $body['attached_entity'] : null;

        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? $auth['id'] ?? 1);
        $userName = (string)($auth['full_name'] ?? $auth['name'] ?? 'Anh/Chị');
        $userRole = (string)($auth['role'] ?? 'superadmin');
        // Grant full omniscient tool permissions on the dedicated Turnio 3.8 Lab page
        $labAuth = array_merge($auth, [
            'user_id' => $uid,
            'id' => $uid,
            'tenant_id' => $tid,
            'role' => 'superadmin',
            'full_name' => $userName,
        ]);
        $curDate = date('Y-m-d H:i:s');
        $curDayOfWeek = date('l');

        // If an ERP Entity Card was attached in the composer, record it into Working Entity Context & enrich message
        $attachedEntityContextBlock = '';
        $attachedId = (int)($attachedEntity['entity_id'] ?? $attachedEntity['id'] ?? 0);
        if ($attachedEntity && $attachedId > 0) {
            $eType = (string)($attachedEntity['entity_type'] ?? $attachedEntity['type'] ?? 'contact');
            $eId = $attachedId;
            $eTitle = (string)($attachedEntity['title'] ?? "Hồ sơ #$eId");
            $eSub = (string)($attachedEntity['subtitle'] ?? '');
            $this->recordEntityContext($uid, $tid, $eType, $eId, $eTitle, ['subtitle' => $eSub]);
            $attachedEntityContextBlock = "\n--- [HỒ SƠ ERP ĐƯỢC ĐÍNH KÈM TRỰC TIẾP TRONG TIN NHẮN NÀY] ---\n"
                . "• Loại thực thể: `{$eType}` | ID: `#{$eId}` | Tên: **{$eTitle}** | Chi tiết: {$eSub}\n"
                . "• Hãy ưu tiên gọi công cụ tra cứu chi tiết 360 hoặc xử lý trực tiếp trên ID `#{$eId}` này!\n";
        }

        // 1. Retrieve RAG Knowledge Context (Pure MySQL — Zero Gemini)
        $ragData = $this->retrieveRagContext($tid, $userMessage);
        $knowledgeText = $ragData['context_text'];
        $matchedArticles = $ragData['matched_articles'];

        // 2. Multi-Agent Swarm Resolution (with Turnio Micro-Router when ambiguous)
        $collaboratingAgents = $this->resolveCollaboratingAgents($userMessage, $apiKey, $model, $pinnedAgentId);
        $primaryAgent = $collaboratingAgents[0];

        $swarmRosterLines = [];
        $allowedToolNames = [];
        foreach ($collaboratingAgents as $idx => $ag) {
            $roleTag = ($idx === 0) ? "TRƯỞNG NHÓM ĐIỀU PHỐI CHÍNH (Lead Agent)" : "CHUYÊN GIA PHỐI HỢP (Collaborating Specialist)";
            $swarmRosterLines[] = "   - **[{$ag['badge']}]** ({$roleTag}): {$ag['focus']}";
            if (!empty($ag['allowed_tools']) && is_array($ag['allowed_tools'])) {
                $allowedToolNames = array_merge($allowedToolNames, $ag['allowed_tools']);
            }
        }
        $allowedToolNames = array_values(array_unique($allowedToolNames));
        $swarmRosterText = implode("\n", $swarmRosterLines);

        // 3. Full Agent Chat Context Blocks: Ambient State + Episodic Memories + 48h Working Entity Context + Proactive Risks
        $ambientStateBlock = $this->getAmbientUserStateSnapshot($tid, $uid, 'superadmin');
        $episodicMemoriesBlock = $this->loadUserMemories($uid, $tid);
        $recentEntitiesBlock = $this->loadRecentEntityContext($uid, $tid);
        $proactiveRisksBlock = $this->detectProactiveOperationalRisks($uid, $tid, 'superadmin');

        // 4. Build Compact Conversation History for Groq LPU (Keep last 4 turns, max 500 chars each to preserve 7,000 ITPM budget)
        $historyMessages = [];
        $recentHistory = array_slice($historyInput, -4);
        foreach ($recentHistory as $hItem) {
            if (!is_array($hItem)) continue;
            $hRole = ($hItem['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $hContent = trim((string)($hItem['content'] ?? ''));
            if ($hContent === '') continue;
            $hContent = trim((string)preg_replace('/<think>[\s\S]*?<\/think>/i', '', $hContent));
            $hContent = trim((string)preg_replace('/<<<[\s\S]*?>>>/', '', $hContent));
            if ($hContent !== '') {
                $historyMessages[] = [
                    'role' => $hRole,
                    'content' => mb_substr($hContent, 0, 500),
                ];
            }
        }

        // 5. System Instruction (Compact & Token-Efficient for Groq 7,000 ITPM Free Tier)
        $ragBlock = $knowledgeText !== ''
            ? "\n4. **TRI THỨC NỘI BỘ (RAG)**:\n" . mb_substr($knowledgeText, 0, 900) . "\n"
            : "";

        $systemPrompt = "Bạn là **SI IDEAS (Turnio 3.8 27B)** — Hệ thống Quản trị Đa Tác Tử của **MYERP (IDEAS Institute)**.\n" .
            "1. **CHUYÊN GIA ĐANG PHỐI HỢP**:\n" . $swarmRosterText . "\n" .
            "2. **NGỮ CẢNH PHIÊN LÀM VIỆC**:\n" .
            "   - Thời gian: $curDate ($curDayOfWeek, GMT+7) | Người dùng: **$userName** (ID: `$uid`, Toàn quyền `Full Access`, Tenant: `$tid`)\n" .
            $ambientStateBlock .
            $episodicMemoriesBlock .
            $recentEntitiesBlock .
            $proactiveRisksBlock .
            $attachedEntityContextBlock .
            "3. **KỶ LUẬT TOOL & TRÌNH BÀY**:\n" .
            "   - BẮT BUỘC GỌI TOOL trong `tools` khi người dùng hỏi số liệu thực tế (Lead, Học viên, Doanh thu, Đặt cọc, Phiếu chi, Nhân sự, Chấm công, Lương, Task, Dự án, Marketing). Cấm bịa số liệu.\n" .
            "   - Khi tạo/sửa/duyệt dữ liệu, gọi `draft_action_proposal` để sinh thẻ xác nhận `<<<ACTION_PROPOSAL: {...}>>>`.\n" .
            "   - GIỮ NGUYÊN 100% link `[📥 Tải danh sách ...](/export?...)`, thẻ `<<<DYNAMIC_CHART: {...}>>>`, `<<<ACTION_PROPOSAL: {...}>>>`, `<<<ERP_CARD: {...}>>>` từ kết quả Tool.\n" .
            "   - Từ 2 bản ghi trở lên: trình bày **Bảng Markdown** rõ ràng, KHÔNG chèn `<<<ERP_CARD:...>>>` lẻ dưới bảng. Nếu chỉ có 1 hồ sơ: đính kèm `<<<ERP_CARD: {\"type\":\"contact|deal|expense|deposit|project|employee|task\",\"id\":123,\"code\":\"#123\",\"title\":\"Tên\",\"subtitle\":\"Chi tiết\",\"status\":\"Trạng thái\"}>>>`.\n" .
            "   - Cuối câu trả lời, đính kèm 2-3 gợi ý tiếp theo: `<<<NEXT_BEST_ACTIONS: [{\"label\":\"Tên ngắn\",\"prompt\":\"Câu lệnh đầy đủ\",\"icon\":\"chart|check|alert|user|file\"}]>>>`." .
            $ragBlock;

        // 6. Execute Multi-Turn Tool Loop on Groq Cloud (Turnio 3.8 27B)
        $result = $this->callGroqQwenWithTools(
            $apiKey,
            $model,
            $systemPrompt,
            $historyMessages,
            $userMessage,
            $labAuth,
            $allowedToolNames,
            $temperature
        );

        $totalWallMs = (int)round((microtime(true) - $startWallMs) * 1000);

        if (!$result['ok']) {
            respond(502, [
                'error_detail' => $result['error'] ?? 'Turnio Engine Error',
                'telemetry' => $result['telemetry'] ?? [],
                'collaborating_agents' => $collaboratingAgents,
            ], 'Lỗi kết nối Turnio 3.8 27B (' . $model . '): ' . ($result['error'] ?? 'Không xác định'), false);
            return;
        }

        // Log audit entry safely into ai_query_audit_logs if table exists
        try {
            $hasActionProposal = strpos($result['reply'], '<<<ACTION_PROPOSAL:') !== false ? 1 : 0;
            $toolsCalledNames = array_values(array_map(fn($s) => $s['tool'] ?? '', $result['executed_steps'] ?? []));
            $stmtAudit = $this->db->prepare("
                INSERT INTO ai_query_audit_logs 
                (tenant_id, user_id, channel_id, user_role, query_text, detected_agents, tools_called, rag_articles_count, has_action_proposal, fallback_triggered, needs_training, gap_reason, response_preview, latency_ms)
                VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)
            ");
            $stmtAudit->execute([
                $tid,
                $uid,
                $userRole,
                mb_substr($userMessage, 0, 2000),
                json_encode(array_map(fn($a) => '[TURNIO-LAB] ' . $a['badge'], $collaboratingAgents), JSON_UNESCAPED_UNICODE),
                json_encode($toolsCalledNames, JSON_UNESCAPED_UNICODE),
                count($matchedArticles),
                $hasActionProposal,
                mb_substr($result['reply'], 0, 500),
                $totalWallMs
            ]);
        } catch (\Throwable $e) {
            // Non-blocking audit log
        }

        $telemetry = $result['telemetry'] ?? [];
        $telemetry['total_wall_ms'] = $totalWallMs;
        $telemetry['rag_matched_count'] = count($matchedArticles);

        respond(200, [
            'reply' => $result['reply'],
            'reasoning_trace' => $result['reasoning_trace'] ?? '',
            'model' => $model,
            'engine' => 'Turnio 3.8 27B • LPU Engine',
            'primary_agent' => $primaryAgent,
            'collaborating_agents' => $collaboratingAgents,
            'executed_steps' => $result['executed_steps'] ?? [],
            'matched_articles' => $matchedArticles,
            'telemetry' => $telemetry,
            'created_at' => date('Y-m-d H:i:s'),
        ], 'Phản hồi từ Turnio 3.8 27B thành công');
    }

    /**
     * Convert AgentToolRegistry Gemini Function Declarations into a compact OpenAI/Groq Tools JSON Schema
     * optimized for Groq Cloud's 7,000 ITPM budget (~900 tokens total for top 6 precision-matched tools).
     */
    private function convertGeminiToolsToGroqTools(?array $allowedToolNames = null, string $userMessage = ''): array {
        $geminiTools = AgentToolRegistry::getGeminiToolsDeclaration(null);
        $declarations = $geminiTools[0]['functionDeclarations'] ?? [];
        if (empty($declarations)) {
            return [];
        }

        $qLower = mb_strtolower($userMessage, 'UTF-8');

        // Fast keyword-to-tool boost rules so the exact needed tools are always ranked #1
        $keywordToolBoosts = [
            '/(lead|tiềm năng|khách hàng|học viên|tuyển sinh|nguồn|source|mba|dba|emba|msc|nóng|ấm|lạnh|chưa tương tác|ngủ đông)/u' => [
                'query_crm_leads_multitier', 'search_contacts', 'get_contact_360_profile', 'get_sales_leaderboard', 'analyze_leads_demographics_and_job_titles'
            ],
            '/(doanh thu|đặt cọc|tiền cọc|sales order|\bso\b|thực thu|học phí|công nợ)/u' => [
                'query_deposits_and_revenue_multitier', 'get_financial_overview', 'lookup_recent_cash_receipts_and_deposits', 'get_upcoming_tuition_receivables'
            ],
            '/(chi phí|phiếu chi|purchase order|\bpo\b|tạm ứng|duyệt chi|nhà cung cấp|hóa đơn|thu chi|tài chính|dòng tiền|p&l)/u' => [
                'query_finance_multitier_analytics', 'filter_expenses_advanced', 'get_financial_overview', 'get_executive_financial_pulse', 'smart_manage_po_so_and_approvals'
            ],
            '/(nhân sự|nhân viên|chấm công|đi trễ|nghỉ phép|vắng mặt|ai nghỉ|ai off|bảng lương|phiếu lương|phòng ban|danh bạ)/u' => [
                'query_hrm_workforce_and_payroll_multitier', 'query_company_attendance_and_work_hours', 'get_company_leave_and_absence', 'get_company_staff_directory', 'get_my_attendance_summary', 'get_my_payslip'
            ],
            '/(task|công việc|việc cần làm|deadline|quá hạn|việc con|checklist|dự án|project|bàn làm việc)/u' => [
                'get_my_tasks', 'query_tasks_and_projects_multitier', 'get_task_detail', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects'
            ],
            '/(marketing|email|automation|flow|kịch bản|khảo sát|survey|voucher|qr|zalo|meta|web tracking|visitor|đa kênh)/u' => [
                'query_omnichannel_journey_and_automation_analytics', 'get_lead_digital_footprint_360', 'get_campaign_marketing_stats', 'smart_manage_automation_flows_and_campaigns'
            ],
            '/(deal|cơ hội|b2b|đối tác|doanh nghiệp|hợp đồng)/u' => [
                'query_deals_and_b2b_multitier', 'get_b2b_partner_and_contract_summary'
            ],
            '/(tồn kho|kho|ấn phẩm|quà tặng|balo|áo polo|tài sản|laptop)/u' => [
                'query_inventory_and_assets_multitier', 'get_inventory_and_asset_status', 'get_inventory_health_check'
            ],
            '/(ticket|sla|báo lỗi|sự cố|helpdesk|hệ thống)/u' => [
                'query_tickets_and_sla_multitier', 'get_ticket_status_and_sla_breaches', 'get_system_health_status'
            ],
            '/(phê duyệt|duyệt đơn|chờ duyệt|kẹt đơn|approval)/u' => [
                'get_pending_approvals', 'trace_approval_blocker', 'approve_or_reject_erp_ticket'
            ],
            '/(tổng quan|toàn viện|ban giám đốc|ceo|báo cáo tổng|sức khỏe|buổi sáng|brief)/u' => [
                'query_cross_domain_executive_synthesis', 'get_executive_morning_brief', 'get_executive_financial_pulse', 'get_sales_leaderboard'
            ],
            '/(tạo|thêm|giao|chuyển|cập nhật|đổi|duyệt|từ chối|đặt lịch|ghi chú)/u' => [
                'draft_action_proposal', 'smart_create_or_assign_leads', 'quick_log_crm_activity', 'schedule_contact_activity'
            ],
        ];

        $boostedTools = [];
        foreach ($keywordToolBoosts as $regex => $tNames) {
            if ($qLower !== '' && preg_match($regex, $qLower)) {
                foreach ($tNames as $idx => $tn) {
                    $boostedTools[$tn] = ($boostedTools[$tn] ?? 0) + (20 - $idx * 2);
                }
            }
        }

        if (empty($boostedTools)) {
            // Default core tools when query is general
            foreach (['query_cross_domain_executive_synthesis', 'query_crm_leads_multitier', 'get_financial_overview', 'get_my_tasks', 'get_pending_approvals', 'search_contacts'] as $idx => $tn) {
                $boostedTools[$tn] = 15 - $idx;
            }
        }

        $allowedSet = !empty($allowedToolNames) ? array_flip($allowedToolNames) : null;
        $scoredDecls = [];
        foreach ($declarations as $decl) {
            $name = $decl['name'] ?? '';
            if ($name === '') continue;
            $score = $boostedTools[$name] ?? 0;
            if ($allowedSet !== null && isset($allowedSet[$name])) {
                $score += 5;
            }
            if ($score > 0) {
                $scoredDecls[] = ['score' => $score, 'decl' => $decl];
            }
        }

        usort($scoredDecls, fn($a, $b) => $b['score'] <=> $a['score']);
        $topDecls = array_slice(array_column($scoredDecls, 'decl'), 0, 4);

        $groqTools = [];
        foreach ($topDecls as $decl) {
            $name = $decl['name'] ?? '';
            $desc = mb_substr(trim((string)($decl['description'] ?? '')), 0, 110);
            $params = isset($decl['parameters']) && is_array($decl['parameters'])
                ? $this->normalizeJsonSchema($decl['parameters'], 10)
                : ['type' => 'object', 'properties' => (object)[]];

            $groqTools[] = [
                'type' => 'function',
                'function' => [
                    'name' => $name,
                    'description' => $desc,
                    'parameters' => $params,
                ],
            ];
        }

        return $groqTools;
    }

    /**
     * Recursively normalize uppercase Gemini Schema types (OBJECT, STRING, INTEGER, NUMBER, BOOLEAN, ARRAY)
     * into compact lowercase OpenAI JSON Schema types required by Groq Cloud.
     */
    private function normalizeJsonSchema(array $schema, int $maxProps = 10): array {
        $priorityProps = [
            'action', 'analysis_type', 'query', 'search_query', 'programs', 'program', 'program_code',
            'stages', 'stage_name', 'sources', 'source', 'owners', 'owner_name', 'record_type',
            'lead_status', 'temperature', 'financial_filter', 'stale_days', 'interaction_status',
            'departments', 'department', 'categories', 'statuses', 'status', 'period', 'date_field',
            'from_date', 'to_date', 'month', 'year', 'group_by', 'scope', 'filter', 'contact_id',
            'contact_query', 'task_id', 'task_title', 'employee_id', 'employee_name', 'user_query',
            'approval_type', 'ticket_type', 'ticket_id', 'decision', 'leads', 'limit'
        ];

        $out = [];
        foreach ($schema as $k => $v) {
            if ($k === 'type' && is_string($v)) {
                $out['type'] = strtolower($v);
            } elseif ($k === 'description' && is_string($v)) {
                $out['description'] = mb_substr(trim($v), 0, 45);
            } elseif ($k === 'properties' && is_array($v)) {
                if (empty($v)) {
                    $out['properties'] = (object)[];
                } else {
                    // Sort properties so priority properties always come first
                    $orderedKeys = array_keys($v);
                    if (count($orderedKeys) > $maxProps) {
                        $prioFlip = array_flip($priorityProps);
                        usort($orderedKeys, function($a, $b) use ($prioFlip) {
                            $pa = $prioFlip[$a] ?? 999;
                            $pb = $prioFlip[$b] ?? 999;
                            return $pa <=> $pb;
                        });
                        $orderedKeys = array_slice($orderedKeys, 0, $maxProps);
                    }
                    $props = [];
                    foreach ($orderedKeys as $propName) {
                        $propSchema = $v[$propName];
                        $props[$propName] = is_array($propSchema)
                            ? $this->normalizeJsonSchema($propSchema, 6)
                            : $propSchema;
                    }
                    $out['properties'] = $props;
                }
            } elseif ($k === 'items' && is_array($v)) {
                $out['items'] = $this->normalizeJsonSchema($v, 6);
            } elseif ($k === 'required' && is_array($v)) {
                $out['required'] = $v;
            } else {
                $out[$k] = $v;
            }
        }
        if (($out['type'] ?? '') === 'object' && !isset($out['properties'])) {
            $out['properties'] = (object)[];
        }
        if (isset($out['required']) && is_array($out['required']) && isset($out['properties']) && is_array($out['properties'])) {
            $out['required'] = array_values(array_intersect($out['required'], array_keys($out['properties'])));
            if (empty($out['required'])) {
                unset($out['required']);
            }
        }
        return $out;
    }

    /**
     * Execute multi-turn OpenAI-compatible function calling against Groq Cloud (`qwen/qwen3.8-27b`)
     * with Slim Turn-2 Synthesis, Smart 429 Cooldown Retry, and Multi-Bucket LPU Pool Failover.
     */
    private function callGroqQwenWithTools(
        string $apiKey,
        string $model,
        string $systemPrompt,
        array $historyMessages,
        string $userMessage,
        array $auth,
        ?array $allowedToolNames = null,
        float $temperature = 0.15
    ): array {
        $groqTools = $this->convertGeminiToolsToGroqTools($allowedToolNames, $userMessage);

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
        ];
        foreach ($historyMessages as $hm) {
            $messages[] = $hm;
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        // Slim Synthesis System Prompt used on Turn 1+ after tools have returned real MySQL data (saves ~900 tokens!)
        $synthesisSystemPrompt = "Bạn là **SI IDEAS (Turnio 3.8 27B)** của MYERP. Hãy tổng hợp dữ liệu thực tế từ `tool` vừa thực thi thành câu trả lời tiếng Việt chuyên nghiệp, rõ ràng.\n" .
            "- Nếu có >= 2 bản ghi: trình bày **Bảng Markdown** đầy đủ cột quan trọng (ID `#ID`, Họ tên, SĐT, Chương trình/Phòng ban, Trạng thái, Người phụ trách), KHÔNG chèn thẻ `<<<ERP_CARD:...>>>` lẻ dưới bảng.\n" .
            "- Nếu chỉ có 1 hồ sơ: có thể đính kèm `<<<ERP_CARD: {\"type\":\"contact|deal|expense|deposit|project|employee|task\",\"id\":123,\"code\":\"#123\",\"title\":\"Tên\",\"subtitle\":\"Chi tiết\",\"status\":\"Trạng thái\"}>>>`.\n" .
            "- Cuối câu trả lời, đính kèm 2-3 gợi ý tiếp theo: `<<<NEXT_BEST_ACTIONS: [{\"label\":\"Tên ngắn\",\"prompt\":\"Câu lệnh đầy đủ\",\"icon\":\"chart|check|alert|user|file\"}]>>>`.";

        // Multi-Bucket LPU Failover Pool (Each model on Groq has its own independent 7,000-30,000 TPM quota bucket)
        $lpuFallbackPool = array_values(array_unique([
            $model,
            'openai/gpt-oss-120b',
            'llama-3.3-70b-versatile',
            'openai/gpt-oss-20b',
        ]));
        $activeModel = $model;

        $maxTurns = 5;
        $executedSteps = [];
        $deterministicExports = [];
        $deterministicTags = [];
        $hasMultiRowResult = false;
        $reasoningTraces = [];

        $totalPromptTokens = 0;
        $totalCompletionTokens = 0;
        $totalGroqTimeSec = 0.0;
        $turnsUsed = 0;
        $lastError = '';

        for ($turn = 0; $turn < $maxTurns; $turn++) {
            $turnsUsed++;

            // On Turn 1+ (after tool execution), trim old history and swap in the compact Synthesis System Prompt
            // so Turn 1 uses ~850 input tokens instead of ~3,530 input tokens!
            $turnMessages = $messages;
            if (!empty($executedSteps)) {
                $turnMessages = [
                    ['role' => 'system', 'content' => $synthesisSystemPrompt],
                    ['role' => 'user', 'content' => $userMessage],
                ];
                foreach ($messages as $mItem) {
                    $mRole = $mItem['role'] ?? '';
                    if (($mRole === 'assistant' && !empty($mItem['tool_calls'])) || $mRole === 'tool') {
                        $turnMessages[] = $mItem;
                    }
                }
            }

            $payload = [
                'model' => $activeModel,
                'messages' => $turnMessages,
                'temperature' => $temperature,
                'max_tokens' => 2048,
            ];
            // Only attach tools on Turn 0 (or if no tool has executed yet) so Turn 2 synthesis saves ~1,000 tokens
            if (!empty($groqTools) && empty($executedSteps)) {
                $payload['tools'] = $groqTools;
                $payload['tool_choice'] = 'auto';
            }

            [$httpCode, $rawResp, $curlErr] = $this->httpPostGroq($apiKey, $payload, 45);

            // Smart Anti-Rate-Limit Recovery on HTTP 429 (ITPM/RPM limit) or HTTP 413 (Payload too large)
            if ($httpCode === 429 || $httpCode === 413) {
                $errJson = is_string($rawResp) ? json_decode($rawResp, true) : null;
                $errMsg = (string)($errJson['error']['message'] ?? '');

                // 1) If Groq tells us "Please try again in X.XXs" and X <= 5.2s, wait and retry on the primary model!
                if ($httpCode === 429 && preg_match('/try again in\s+([0-9.]+)s/i', $errMsg, $waitMatch)) {
                    $waitSec = (float)$waitMatch[1];
                    if ($waitSec > 0 && $waitSec <= 5.2) {
                        usleep((int)(($waitSec + 0.35) * 1000000));
                        [$httpCode, $rawResp, $curlErr] = $this->httpPostGroq($apiKey, $payload, 45);
                    }
                }

                // 2) If still 429 or 413, failover immediately to the next independent LPU quota bucket!
                if ($httpCode === 429 || $httpCode === 413) {
                    foreach ($lpuFallbackPool as $candidateModel) {
                        if ($candidateModel === $activeModel) continue;
                        $payload['model'] = $candidateModel;
                        [$httpCode, $rawResp, $curlErr] = $this->httpPostGroq($apiKey, $payload, 45);
                        if ($rawResp !== false && $httpCode >= 200 && $httpCode < 300) {
                            $activeModel = $candidateModel;
                            break;
                        }
                    }
                }
            }

            if ($rawResp === false || $httpCode >= 400) {
                $errJson = is_string($rawResp) ? json_decode($rawResp, true) : null;
                $errMsg = $errJson['error']['message'] ?? ($curlErr ?: "HTTP $httpCode");
                $failedGen = $errJson['error']['failed_generation'] ?? '';

                // Graceful recovery if Qwen emitted a raw XML tool call that triggered Groq's tool_use_failed 400
                if ($httpCode === 400 && is_string($failedGen) && $failedGen !== '') {
                    $recoveredCalls = $this->parseFallbackXmlToolCalls($failedGen);
                    if (!empty($recoveredCalls)) {
                        $assistantMsg = [
                            'role' => 'assistant',
                            'content' => '',
                            'tool_calls' => $recoveredCalls,
                        ];
                        $messages[] = $assistantMsg;
                        $this->executeAndAppendToolCalls(
                            $recoveredCalls,
                            $auth,
                            $messages,
                            $executedSteps,
                            $deterministicExports,
                            $deterministicTags,
                            $hasMultiRowResult
                        );
                        continue;
                    }
                }

                $lastError = $errMsg;
                break;
            }

            $data = json_decode((string)$rawResp, true);
            $usage = $data['usage'] ?? [];
            $totalPromptTokens += (int)($usage['prompt_tokens'] ?? 0);
            $totalCompletionTokens += (int)($usage['completion_tokens'] ?? 0);
            $totalGroqTimeSec += (float)($usage['total_time'] ?? 0.0);

            $choice = $data['choices'][0] ?? null;
            if (!$choice || !isset($choice['message'])) {
                $lastError = 'Phản hồi từ Groq không có choices[0].message';
                break;
            }

            $msg = $choice['message'];
            $rawContent = (string)($msg['content'] ?? '');
            $toolCalls = $msg['tool_calls'] ?? [];

            // Extract <think>...</think> reasoning trace if present
            if (preg_match_all('/<think>([\s\S]*?)<\/think>/i', $rawContent, $thinkMatches)) {
                foreach ($thinkMatches[1] as $tm) {
                    $trimmedThink = trim($tm);
                    if ($trimmedThink !== '') {
                        $reasoningTraces[] = $trimmedThink;
                    }
                }
            }
            if (!empty($msg['reasoning']) && is_string($msg['reasoning'])) {
                $reasoningTraces[] = trim($msg['reasoning']);
            }

            // Fallback: check if model wrote <tool_call>{...}</tool_call> inside content without native tool_calls
            if (empty($toolCalls) && strpos($rawContent, '<tool_call>') !== false) {
                $toolCalls = $this->parseFallbackXmlToolCalls($rawContent);
            }

            if (!empty($toolCalls) && is_array($toolCalls)) {
                $assistantTurnMsg = [
                    'role' => 'assistant',
                    'content' => $rawContent !== '' ? $rawContent : null,
                    'tool_calls' => $toolCalls,
                ];
                $messages[] = $assistantTurnMsg;

                $this->executeAndAppendToolCalls(
                    $toolCalls,
                    $auth,
                    $messages,
                    $executedSteps,
                    $deterministicExports,
                    $deterministicTags,
                    $hasMultiRowResult
                );
                continue;
            }

            // Final natural language answer reached
            $cleanText = trim((string)preg_replace('/<think>[\s\S]*?<\/think>/i', '', $rawContent));
            if (strpos($cleanText, '<think>') !== false) {
                $cleanText = trim((string)preg_replace('/<think>[\s\S]*$/i', '', $cleanText));
            }

            if ($cleanText !== '') {
                $finalText = $this->appendMissingDeterministicArtifacts(
                    $cleanText,
                    $deterministicExports,
                    $deterministicTags,
                    $hasMultiRowResult
                );
                $tokensPerSec = $totalGroqTimeSec > 0
                    ? round($totalCompletionTokens / $totalGroqTimeSec, 1)
                    : 0.0;

                return [
                    'ok' => true,
                    'reply' => $finalText,
                    'reasoning_trace' => implode("\n\n---\n\n", array_unique(array_filter($reasoningTraces))),
                    'executed_steps' => $executedSteps,
                    'telemetry' => [
                        'model' => $model,
                        'provider' => 'Groq Cloud LPU (Zero Gemini)',
                        'turns_used' => $turnsUsed,
                        'tools_loaded_count' => count($groqTools),
                        'tools_called_count' => count($executedSteps),
                        'prompt_tokens' => $totalPromptTokens,
                        'completion_tokens' => $totalCompletionTokens,
                        'total_tokens' => $totalPromptTokens + $totalCompletionTokens,
                        'groq_time_ms' => (int)round($totalGroqTimeSec * 1000),
                        'tokens_per_second' => $tokensPerSec,
                    ],
                ];
            }
        }

        // If loop ended after tool calls without a final synthesis turn, synthesize deterministically
        if (!empty($executedSteps)) {
            $fallbackLines = ["Đã thực thi **" . count($executedSteps) . " công cụ MYERP** trên Qwen 3.8 27B:"];
            foreach ($executedSteps as $step) {
                $fallbackLines[] = "- **`{$step['tool']}`**: " . ($step['summary'] ?? 'Hoàn tất');
            }
            $fallbackReply = $this->appendMissingDeterministicArtifacts(
                implode("\n", $fallbackLines),
                $deterministicExports,
                $deterministicTags,
                $hasMultiRowResult
            );
            return [
                'ok' => true,
                'reply' => $fallbackReply,
                'reasoning_trace' => implode("\n\n---\n\n", array_unique(array_filter($reasoningTraces))),
                'executed_steps' => $executedSteps,
                'telemetry' => [
                    'model' => $model,
                    'provider' => 'Groq Cloud LPU (Zero Gemini)',
                    'turns_used' => $turnsUsed,
                    'tools_loaded_count' => count($groqTools),
                    'tools_called_count' => count($executedSteps),
                    'prompt_tokens' => $totalPromptTokens,
                    'completion_tokens' => $totalCompletionTokens,
                    'total_tokens' => $totalPromptTokens + $totalCompletionTokens,
                    'groq_time_ms' => (int)round($totalGroqTimeSec * 1000),
                    'tokens_per_second' => $totalGroqTimeSec > 0 ? round($totalCompletionTokens / $totalGroqTimeSec, 1) : 0.0,
                ],
            ];
        }

        return [
            'ok' => false,
            'error' => $lastError ?: 'Không nhận được phản hồi hợp lệ từ Groq Cloud',
            'telemetry' => [
                'model' => $model,
                'turns_used' => $turnsUsed,
                'prompt_tokens' => $totalPromptTokens,
                'completion_tokens' => $totalCompletionTokens,
            ],
        ];
    }

    /**
     * Execute each tool call via AgentToolRegistry and append `role: "tool"` messages.
     */
    private function executeAndAppendToolCalls(
        array $toolCalls,
        array $auth,
        array &$messages,
        array &$executedSteps,
        array &$deterministicExports,
        array &$deterministicTags,
        bool &$hasMultiRowResult
    ): void {
        foreach ($toolCalls as $tc) {
            $callId = (string)($tc['id'] ?? ('call_' . bin2hex(random_bytes(4))));
            $fnName = (string)($tc['function']['name'] ?? '');
            $rawArgs = $tc['function']['arguments'] ?? '{}';
            $fnArgs = is_string($rawArgs) ? (json_decode($rawArgs, true) ?: []) : (is_array($rawArgs) ? $rawArgs : []);

            $t0 = microtime(true);
            $toolResult = AgentToolRegistry::executeTool($this->db, $fnName, $fnArgs, $auth);
            $toolLatencyMs = (int)round((microtime(true) - $t0) * 1000);

            $ctxUid = (int)($auth['user_id'] ?? $auth['id'] ?? 1);
            $ctxTid = (int)($auth['tenant_id'] ?? 1);
            if ($ctxUid > 0 && is_array($toolResult)) {
                $this->autoRecordEntityFromTool($ctxUid, $ctxTid, $fnName, $fnArgs, $toolResult);
            }

            if (is_array($toolResult)) {
                $rowCount = (int)($toolResult['total_matching'] ?? $toolResult['total_matching_records'] ?? $toolResult['total_processed'] ?? $toolResult['matched_count'] ?? $toolResult['total'] ?? (isset($toolResult['data']) && is_array($toolResult['data']) ? count($toolResult['data']) : 0));
                if ($rowCount > 1) {
                    $hasMultiRowResult = true;
                }
                foreach (['export_link_markdown', 'export_markdown'] as $expField) {
                    if (!empty($toolResult[$expField]) && is_string($toolResult[$expField])) {
                        $deterministicExports[] = trim($toolResult[$expField]);
                    }
                }
                if (!empty($toolResult['export_url']) && is_string($toolResult['export_url'])) {
                    $deterministicExports[] = "[📥 Tải danh sách Excel/CSV (Đầy đủ bộ lọc)](" . trim($toolResult['export_url']) . ")";
                }
                if (!empty($toolResult['dynamic_chart']) && is_array($toolResult['dynamic_chart'])) {
                    $deterministicTags[] = '<<<DYNAMIC_CHART: ' . json_encode($toolResult['dynamic_chart'], JSON_UNESCAPED_UNICODE) . '>>>';
                }
                foreach (['chart_tag', 'erp_card_tag', 'action_proposal_tag', 'proposal_tag', 'proposal_block'] as $tagKey) {
                    if (!empty($toolResult[$tagKey]) && is_string($toolResult[$tagKey])) {
                        $deterministicTags[] = trim($toolResult[$tagKey]);
                    }
                }
                $serializedResult = json_encode($toolResult, JSON_UNESCAPED_UNICODE);
                if (is_string($serializedResult)) {
                    if (preg_match_all('/<<<(?:DYNAMIC_CHART|ACTION_PROPOSAL|ERP_CARD):\s*[\s\S]*?>>>/', $serializedResult, $tagMatches)) {
                        foreach ($tagMatches[0] as $matchedTag) {
                            $deterministicTags[] = trim($matchedTag);
                        }
                    }
                }
            }

            $summaryText = 'Đã thực thi thành công';
            if (is_array($toolResult)) {
                if (isset($toolResult['error'])) {
                    $summaryText = 'Lỗi: ' . (string)$toolResult['error'];
                } elseif (isset($toolResult['total_matching'])) {
                    $summaryText = 'Tìm thấy ' . (int)$toolResult['total_matching'] . ' bản ghi';
                } elseif (isset($toolResult['total_matching_records'])) {
                    $summaryText = 'Tìm thấy ' . (int)$toolResult['total_matching_records'] . ' bản ghi';
                } elseif (isset($toolResult['message']) && is_string($toolResult['message'])) {
                    $summaryText = mb_substr($toolResult['message'], 0, 120);
                }
            }

            $executedSteps[] = [
                'tool' => $fnName,
                'args' => $fnArgs,
                'latency_ms' => $toolLatencyMs,
                'summary' => $summaryText,
                'has_error' => isset($toolResult['error']),
            ];

            // Strip heavy widget tags from LLM context (already captured in $deterministicTags for deterministic injection)
            $compactJson = json_encode($toolResult, JSON_UNESCAPED_UNICODE) ?: '{}';
            $compactJson = (string)preg_replace('/<<<(?:DYNAMIC_CHART|ACTION_PROPOSAL|ERP_CARD):\s*[\s\S]*?>>>/', '[Widget đã được hệ thống đính kèm tự động]', $compactJson);
            if (mb_strlen($compactJson, 'UTF-8') > 3200) {
                $compactJson = mb_substr($compactJson, 0, 3200, 'UTF-8') . '... [Đã rút gọn bớt để tối ưu tốc độ Groq LPU]';
            }

            $messages[] = [
                'role' => 'tool',
                'tool_call_id' => $callId,
                'name' => $fnName,
                'content' => $compactJson,
            ];
        }
    }

    /**
     * Parse fallback `<tool_call>{"name": "...", "arguments": {...}}</tool_call>` if emitted in text/failed_generation.
     */
    private function parseFallbackXmlToolCalls(string $rawText): array {
        $calls = [];
        if (preg_match_all('/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/i', $rawText, $matches)) {
            foreach ($matches[1] as $jsonCandidate) {
                $decoded = json_decode(trim($jsonCandidate), true);
                if (is_array($decoded) && !empty($decoded['name'])) {
                    $args = $decoded['arguments'] ?? $decoded['parameters'] ?? [];
                    $calls[] = [
                        'id' => 'call_' . bin2hex(random_bytes(4)),
                        'type' => 'function',
                        'function' => [
                            'name' => (string)$decoded['name'],
                            'arguments' => is_string($args) ? $args : json_encode($args ?: (object)[], JSON_UNESCAPED_UNICODE),
                        ],
                    ];
                }
            }
        }
        return $calls;
    }

    /**
     * Deterministically preserve /export links and <<<DYNAMIC_CHART:...>>> / <<<ACTION_PROPOSAL:...>>> / <<<ERP_CARD:...>>> tags
     */
    private function appendMissingDeterministicArtifacts(string $text, array $exportMarkdowns, array $structuredTags, bool $suppressSingleErpCard = false): string {
        if ($text === '') {
            return $text;
        }
        if ($suppressSingleErpCard && strpos($text, '<<<ERP_CARD:') !== false) {
            $text = trim((string)preg_replace('/<<<ERP_CARD:\s*[\s\S]*?>>>/', '', $text));
        }

        $appendParts = [];
        $uniqueExports = array_values(array_unique(array_filter($exportMarkdowns)));
        if (!empty($uniqueExports) && strpos($text, '/export?') === false) {
            foreach ($uniqueExports as $expMd) {
                $appendParts[] = $expMd;
            }
        }
        $uniqueTags = array_values(array_unique(array_filter($structuredTags)));
        foreach ($uniqueTags as $tagBlock) {
            if (strpos($tagBlock, '<<<DYNAMIC_CHART:') === 0) {
                if (strpos($text, '<<<DYNAMIC_CHART:') === false) {
                    $appendParts[] = $tagBlock;
                } elseif (strpos($tagBlock, '"datasets"') !== false && strpos($text, '"datasets"') === false) {
                    $text = (string)preg_replace('/<<<DYNAMIC_CHART:\s*[\s\S]*?>>>/', $tagBlock, $text, 1);
                }
            } elseif (strpos($tagBlock, '<<<ACTION_PROPOSAL:') === 0 && strpos($text, '<<<ACTION_PROPOSAL:') === false) {
                $appendParts[] = $tagBlock;
            } elseif (!$suppressSingleErpCard && strpos($tagBlock, '<<<ERP_CARD:') === 0 && strpos($text, '<<<ERP_CARD:') === false) {
                $appendParts[] = $tagBlock;
            }
        }
        if (!empty($appendParts)) {
            $text = rtrim($text) . "\n\n" . implode("\n\n", $appendParts);
        }
        return $text;
    }

    /**
     * Multi-Agent Swarm Router (Regex + Qwen 3.8 Micro-Router, Zero Gemini).
     */
    private function resolveCollaboratingAgents(string $query, string $apiKey = '', string $model = self::DEFAULT_MODEL, string $pinnedAgentId = 'auto'): array {
        $q = mb_strtolower($query, 'UTF-8');

        $agentToolMap = [
            'sales' => ['query_crm_leads_multitier', 'query_deposits_and_revenue_multitier', 'query_deals_and_b2b_multitier', 'query_cross_domain_executive_synthesis', 'smart_create_or_assign_leads', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'smart_manage_po_so_and_approvals', 'get_contact_360_profile', 'search_contacts', 'export_crm_leads_advanced', 'analyze_leads_demographics_and_job_titles', 'get_sales_leaderboard', 'check_lead_duplicate_and_fairshare_status', 'schedule_contact_activity', 'get_my_crm_inbox', 'get_sales_performance_and_stale_leads', 'get_consultant_shift_and_fairshare_audit', 'manage_lead_round_distribution', 'lookup_recent_cash_receipts_and_deposits', 'update_contact_pipeline', 'add_contact_consultation_note', 'update_contact_profile', 'quick_log_crm_activity', 'reassign_lead_owner', 'get_company_staff_directory', 'draft_action_proposal', 'get_system_navigation'],
            'finance' => ['query_finance_multitier_analytics', 'query_deposits_and_revenue_multitier', 'query_cross_domain_executive_synthesis', 'smart_manage_po_so_and_approvals', 'smart_manage_hrm_and_payroll', 'manage_my_hr_profile_and_requests', 'smart_manage_tasks_and_subtasks', 'filter_expenses_advanced', 'get_sales_leaderboard', 'get_contact_financial_summary', 'lookup_recent_cash_receipts_and_deposits', 'get_my_payment_proposals', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'approve_or_reject_erp_ticket', 'draft_action_proposal', 'get_system_navigation'],
            'hrm' => ['query_hrm_workforce_and_payroll_multitier', 'manage_my_hr_profile_and_requests', 'smart_manage_hrm_and_payroll', 'smart_manage_tasks_and_subtasks', 'get_staff_directory_advanced', 'query_company_attendance_and_work_hours', 'get_company_staff_directory', 'get_company_leave_and_absence', 'get_my_attendance_summary', 'get_my_payslip', 'get_pending_approvals', 'trace_approval_blocker', 'approve_or_reject_erp_ticket', 'update_task_progress_and_status', 'draft_action_proposal', 'get_system_navigation'],
            'tasks' => ['query_tasks_and_projects_multitier', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'smart_manage_po_so_and_approvals', 'get_my_tasks', 'get_task_detail', 'get_company_staff_directory', 'schedule_contact_activity', 'update_task_progress_and_status', 'complete_task_checklist_item', 'draft_action_proposal', 'get_system_navigation'],
            'academic' => ['query_crm_leads_multitier', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'get_academic_students_filter', 'get_program_details', 'get_academic_schedule_and_intakes', 'get_active_projects_and_campaigns', 'search_contacts', 'export_crm_leads_advanced', 'search_ideas_knowledge', 'draft_action_proposal', 'get_system_navigation'],
            'records_legal' => ['check_student_admission_records', 'get_academic_students_filter', 'get_contact_360_profile', 'attach_files_to_contact', 'draft_action_proposal', 'get_system_navigation'],
            'assets_inventory' => ['query_inventory_and_assets_multitier', 'get_inventory_health_check', 'get_inventory_and_asset_status', 'draft_action_proposal', 'get_system_navigation'],
            'marketing_campaigns' => ['query_omnichannel_journey_and_automation_analytics', 'get_lead_digital_footprint_360', 'smart_manage_automation_flows_and_campaigns', 'query_crm_leads_multitier', 'query_deposits_and_revenue_multitier', 'query_deals_and_b2b_multitier', 'query_cross_domain_executive_synthesis', 'smart_create_or_assign_leads', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'get_contact_360_profile', 'search_contacts', 'export_crm_leads_advanced', 'analyze_leads_demographics_and_job_titles', 'get_sales_leaderboard', 'get_sales_performance_and_stale_leads', 'get_consultant_shift_and_fairshare_audit', 'check_lead_duplicate_and_fairshare_status', 'get_campaign_marketing_stats', 'get_active_projects_and_campaigns', 'get_company_staff_directory', 'draft_action_proposal', 'get_system_navigation'],
            'executive_bi' => ['query_cross_domain_executive_synthesis', 'query_crm_leads_multitier', 'query_finance_multitier_analytics', 'query_deposits_and_revenue_multitier', 'query_tasks_and_projects_multitier', 'query_deals_and_b2b_multitier', 'query_tickets_and_sla_multitier', 'query_hrm_workforce_and_payroll_multitier', 'query_inventory_and_assets_multitier', 'query_omnichannel_journey_and_automation_analytics', 'smart_create_or_assign_leads', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'smart_manage_hrm_and_payroll', 'smart_manage_po_so_and_approvals', 'get_executive_morning_brief', 'get_sales_leaderboard', 'filter_expenses_advanced', 'get_staff_directory_advanced', 'get_inventory_health_check', 'export_crm_leads_advanced', 'analyze_leads_demographics_and_job_titles', 'query_company_attendance_and_work_hours', 'get_executive_financial_pulse', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'lookup_recent_cash_receipts_and_deposits', 'get_my_tasks', 'get_system_health_status', 'manage_lead_round_distribution', 'approve_or_reject_erp_ticket', 'update_task_progress_and_status', 'reassign_lead_owner', 'draft_action_proposal', 'get_system_navigation'],
            'system_it' => ['query_tickets_and_sla_multitier', 'get_system_health_status', 'get_ticket_status_and_sla_breaches', 'draft_action_proposal', 'get_system_navigation']
        ];

        $catalog = [
            'executive_bi' => [
                'id' => 'executive_bi',
                'badge' => 'Agent Trợ Lý Giám Đốc',
                'focus' => 'Tổng hợp báo cáo điều hành vĩ mô đa chiều (Cross-Module Executive Summary), phân tích P&L, dòng tiền ròng, tỷ lệ chuyển đổi toàn hệ thống và tham mưu chiến lược.',
                'pattern' => '/(tổng quan|toàn hệ thống|báo cáo tổng|sức khỏe doanh nghiệp|executive|ceo|ban giám đốc|tình hình chung|điểm nghẽn|phân tích vĩ mô|chiến lược|tổng kết|toàn công ty|p&l|dòng tiền ròng|toàn viện)/u',
                'allowed_tools' => $agentToolMap['executive_bi']
            ],
            'marketing_campaigns' => [
                'id' => 'marketing_campaigns',
                'badge' => 'Agent Marketing & Đa Kênh',
                'focus' => 'Quản trị Chiến dịch Email Marketing, Luồng tự động hóa (Automation Flows), Tệp đối tượng (Subscribers/Segments), Khảo sát (Surveys), Voucher & QR, Web Tracking, Zalo OA & Meta Bot.',
                'pattern' => '/(marketing|email marketing|chiến dịch|automation|flow|kịch bản tự động|khảo sát|survey|voucher|mã giảm giá|qr code|web tracking|visitor|zalo|zns|meta bot|fanpage|subscriber|phân khúc|segment|open rate|click rate|tỷ lệ mở|cpl|cac|ads|hội thảo|workshop)/u',
                'allowed_tools' => $agentToolMap['marketing_campaigns']
            ],
            'sales' => [
                'id' => 'sales',
                'badge' => 'Agent Sales & Tuyển Sinh',
                'focus' => 'Phân tích chuyên sâu dữ liệu Khách hàng tiềm năng (Leads/Contacts), cơ hội bán hàng (Deals), phễu chuyển đổi (Pipeline), nguồn lead, tỷ lệ chốt, lịch sử tương tác/chăm sóc và phân bổ Fair-Share.',
                'pattern' => '/(lead|khách hàng|học viên|tuyển sinh|deal|cơ hội|chốt|pipeline|phễu|tư vấn|sale|nguồn|source|fair[\s_-]?share|chia số|chăm sóc|gọi điện|tương tác|tiềm năng|hợp đồng|báo giá|quote|nóng|ấm|lạnh|hot|warm|cold)/u',
                'allowed_tools' => $agentToolMap['sales']
            ],
            'finance' => [
                'id' => 'finance',
                'badge' => 'Agent Thu Chi & Công Nợ',
                'focus' => 'Kiểm soát chặt chẽ Doanh thu, Hóa đơn (Invoices), Phiếu đặt cọc (Deposits/Sales Orders), Phiếu chi (Expenses/Purchase Orders), dòng tiền thực thu, công nợ học phí và đối soát tài chính.',
                'pattern' => '/(doanh thu|thu chi|tài chính|tiền|công nợ|hóa đơn|invoice|phiếu chi|expense|đặt cọc|deposit|thanh toán|ngân sách|lợi nhuận|chi phí|dòng tiền|cash\s*flow|purchase order|sales order|\bpo\b|\bso\b|nhà cung cấp|supplier|vendor|đối tác|duyệt chi|duyệt cọc|tạm ứng|hoàn ứng|học phí)/u',
                'allowed_tools' => $agentToolMap['finance']
            ],
            'hrm' => [
                'id' => 'hrm',
                'badge' => 'Agent Nhân Sự & Chấm Công',
                'focus' => 'Quản trị Hồ sơ Nhân sự (Employees), Chấm công (Attendance), Đi trễ/Về sớm, Đơn nghỉ phép (Leave Requests), Giải trình công, KPI, Hoa hồng và Bảng lương (Payroll/Payslips).',
                'pattern' => '/(nhân sự|nhân viên|chấm công|điểm danh|nghỉ phép|bảng lương|lương|payslip|payroll|đi trễ|về sớm|tăng ca|ot|hrm|phòng ban|hợp đồng lao động|bảo hiểm|giải trình công|check[\s_-]?in|check[\s_-]?out|ca làm|ai nghỉ|ai off|vắng mặt|wfh)/u',
                'allowed_tools' => $agentToolMap['hrm']
            ],
            'tasks' => [
                'id' => 'tasks',
                'badge' => 'Agent Quản Lý Task & Việc Cần Làm',
                'focus' => 'Theo dõi Công việc (Tasks/Activities), Lịch hẹn (Schedules/Calendar), nhắc việc quá hạn (Overdue), phân công nhiệm vụ và khởi tạo đề xuất giao việc tự động.',
                'pattern' => '/(task|công việc|nhiệm vụ|deadline|quá hạn|lịch hẹn|lịch trình|nhắc việc|giao việc|to[\s_-]?do|việc cần làm|hoạt động|activity|agenda|hôm nay làm gì|việc của tôi|việc con|subtask|checklist)/u',
                'allowed_tools' => $agentToolMap['tasks']
            ],
            'academic' => [
                'id' => 'academic',
                'badge' => 'Agent Học Vụ & Đào Tạo',
                'focus' => 'Quản lý Chương trình đào tạo (EMBA, MBA, MSc AI, DBA, Swiss UMEF, ISTEC Paris), Khóa học/Đợt tuyển sinh (Campaigns), Lịch học (Schedules), Tiến độ học viên và Giảng viên.',
                'pattern' => '/(lịch học|lớp học|giảng viên|trợ giảng|học vụ|chương trình học|đào tạo|khai giảng|môn học|buổi học|điểm thi|chứng chỉ|tốt nghiệp|bảo lưu|emba|mba|msc|dba|istec|umef|tín chỉ|luận văn)/u',
                'allowed_tools' => $agentToolMap['academic']
            ],
            'records_legal' => [
                'id' => 'records_legal',
                'badge' => 'Agent Hồ Sơ & Pháp Lý',
                'focus' => 'Thẩm định danh mục hồ sơ nhập học (CCCD, bằng Đại học, bảng điểm, dịch thuật công chứng, CV tiếng Anh), hợp đồng đào tạo và quy trình phê duyệt.',
                'pattern' => '/(hồ sơ|bằng cấp|bằng đại học|bảng điểm|dịch thuật|công chứng|cccd|hộ chiếu|cv tiếng anh|tài liệu|quy trình|biểu mẫu|chính sách|nội quy|phê duyệt|duyệt đơn|approval)/u',
                'allowed_tools' => $agentToolMap['records_legal']
            ],
            'assets_inventory' => [
                'id' => 'assets_inventory',
                'badge' => 'Agent Kho & Tài Sản',
                'focus' => 'Quản lý Danh mục Sản phẩm/Khóa học (Products), Tồn kho ấn phẩm, quà tặng (balo, áo polo, sổ tay, giáo trình) và Tài sản cấp phát cho nhân sự.',
                'pattern' => '/(tồn kho|kho hàng|sản phẩm|vật tư|ấn phẩm|nhập kho|xuất kho|kiểm kê|lô hàng|batch|product|inventory|hàng hóa|balo|áo polo|quà tặng|tài sản|cấp phát)/u',
                'allowed_tools' => $agentToolMap['assets_inventory']
            ],
            'system_it' => [
                'id' => 'system_it',
                'badge' => 'Agent Kỹ Thuật & Helpdesk',
                'focus' => 'Xử lý Ticket hỗ trợ kỹ thuật (Support Tickets), Ticket báo lỗi dữ liệu (Data Tickets), SLA, đồng bộ Google Sheets, Webhook và sức khỏe hệ thống.',
                'pattern' => '/(ticket|báo lỗi|helpdesk|hỗ trợ|khiếu nại|data lỗi|bảng tin|thông báo nội bộ|feed|sự cố|sla|webhook|cronjob|sync sheet|audit log)/u',
                'allowed_tools' => $agentToolMap['system_it']
            ],
        ];

        // Aliases for UI compatibility
        $aliasMap = [
            'executive' => 'executive_bi',
            'marketing' => 'marketing_campaigns',
            'hr' => 'hrm',
            'task' => 'tasks',
            'docs' => 'records_legal',
            'inventory' => 'assets_inventory',
            'operations' => 'system_it',
        ];
        if (isset($aliasMap[$pinnedAgentId])) {
            $pinnedAgentId = $aliasMap[$pinnedAgentId];
        }

        // If user explicitly pinned an agent in the Lab UI
        if ($pinnedAgentId !== '' && $pinnedAgentId !== 'auto' && isset($catalog[$pinnedAgentId])) {
            return [$catalog[$pinnedAgentId]];
        }

        $matched = [];
        foreach ($catalog as $key => $agentDef) {
            if (preg_match($agentDef['pattern'], $q)) {
                $matched[$key] = [
                    'id' => $agentDef['id'],
                    'badge' => $agentDef['badge'],
                    'focus' => $agentDef['focus'],
                    'allowed_tools' => $agentDef['allowed_tools'] ?? []
                ];
            }
        }

        if (isset($matched['executive_bi']) && count($matched) === 1) {
            $matched['sales'] = $catalog['sales'];
            $matched['finance'] = $catalog['finance'];
        }

        if (empty($matched) || count($matched) > 3) {
            $aiRoutedIds = $this->routeQueryWithQwenMicroRouter($query, $apiKey, $model);
            if (!empty($aiRoutedIds)) {
                $aiMatched = [];
                foreach ($aiRoutedIds as $aid) {
                    $resolvedAid = $aliasMap[$aid] ?? $aid;
                    if (isset($catalog[$resolvedAid])) {
                        $aiMatched[$resolvedAid] = $catalog[$resolvedAid];
                    }
                }
                if (!empty($aiMatched)) {
                    return array_slice(array_values($aiMatched), 0, 3);
                }
            }
        }

        if (empty($matched)) {
            return [[
                'id' => 'master',
                'badge' => 'SI IDEAS (Chỉ Huy Trung Tâm)',
                'focus' => 'Trợ lý điều phối trung tâm giải đáp đa lĩnh vực, tự động kết nối dữ liệu toàn hệ thống ERP (CRM, Tài chính, Nhân sự, Học vụ, Marketing, Kho và Vận hành).',
                'allowed_tools' => $agentToolMap['executive_bi']
            ]];
        }

        return array_slice(array_values($matched), 0, 3);
    }

    /**
     * Fast AI Micro-Router using a separate lightweight LPU bucket (`openai/gpt-oss-20b`) so it consumes 0 tokens from `qwen/qwen3.8-27b`.
     */
    private function routeQueryWithQwenMicroRouter(string $query, string $apiKey, string $model): array {
        if ($apiKey === '' || mb_strlen(trim($query)) < 4) {
            return [];
        }

        try {
            $payload = [
                'model' => 'openai/gpt-oss-20b',
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => "Bạn là AI Micro-Router của MYERP. Phân tích câu hỏi và trả về JSON {\"agents\": [\"sales\"]} gồm tối đa 3 mã Agent phù hợp nhất trong danh sách: executive, marketing, sales, finance, hr, task, academic, docs, inventory, operations. Chỉ trả về JSON hợp lệ."
                    ],
                    [
                        'role' => 'user',
                        'content' => $query
                    ]
                ],
                'temperature' => 0.0,
                'max_tokens' => 150,
            ];

            [$httpCode, $response, $err] = $this->httpPostGroq($apiKey, $payload, 4);

            if ($response && $httpCode >= 200 && $httpCode < 300) {
                $data = json_decode((string)$response, true);
                $rawText = (string)($data['choices'][0]['message']['content'] ?? '');
                $rawText = trim((string)preg_replace('/<think>[\s\S]*?<\/think>/i', '', $rawText));
                if (preg_match('/\{[\s\S]*\}/', $rawText, $m)) {
                    $parsed = json_decode($m[0], true);
                    if (is_array($parsed) && !empty($parsed['agents']) && is_array($parsed['agents'])) {
                        return array_values(array_unique(array_filter($parsed['agents'], 'is_string')));
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignore router timeout
        }

        return [];
    }

    /**
     * Resilient HTTP POST to Groq Cloud supporting both cURL and PHP Stream Context fallback.
     * @return array{0:int, 1:string|false, 2:string}
     */
    private function httpPostGroq(string $apiKey, array $payload, int $timeoutSec = 45): array {
        $jsonBody = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if (function_exists('curl_init')) {
            $ch = curl_init(self::GROQ_API_URL);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey,
                ],
                CURLOPT_POSTFIELDS => $jsonBody,
                CURLOPT_TIMEOUT => $timeoutSec,
                CURLOPT_CONNECTTIMEOUT => min(10, $timeoutSec),
                CURLOPT_SSL_VERIFYPEER => false,
            ]);
            $rawResp = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);
            return [$httpCode, $rawResp, $curlErr];
        }

        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nAuthorization: Bearer {$apiKey}\r\nUser-Agent: MYERP-QwenAgentLab/1.0\r\n",
                'content' => $jsonBody,
                'timeout' => $timeoutSec,
                'ignore_errors' => true,
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
        $rawResp = @file_get_contents(self::GROQ_API_URL, false, $ctx);
        $httpCode = 0;
        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $hdr) {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#i', $hdr, $m)) {
                    $httpCode = (int)$m[1];
                }
            }
        }
        return [$httpCode, $rawResp, $rawResp === false ? 'Stream request failed' : ''];
    }

    /**
     * Build lightweight Ambient User State Snapshot (Pure MySQL — Zero Gemini).
     */
    private function getAmbientUserStateSnapshot(int $tid, int $uid, string $userRole): string {
        try {
            $lines = [];
            $stmtTask = $this->db->prepare("
                SELECT 
                    SUM(CASE WHEN due_date < NOW() THEN 1 ELSE 0 END) AS overdue_cnt,
                    SUM(CASE WHEN DATE(due_date) = CURDATE() THEN 1 ELSE 0 END) AS today_cnt
                FROM activities
                WHERE tenant_id = ? AND (user_id = ? OR created_by = ?)
                  AND status NOT IN ('done', 'completed', 'cancelled')
            ");
            $stmtTask->execute([$tid, $uid, $uid]);
            $tRow = $stmtTask->fetch(PDO::FETCH_ASSOC);
            $overdueCnt = (int)($tRow['overdue_cnt'] ?? 0);
            $todayCnt = (int)($tRow['today_cnt'] ?? 0);
            $lines[] = "   - Công việc cá nhân của người dùng: **$todayCnt** việc đến hạn hôm nay, **$overdueCnt** việc đang quá hạn.";

            if (in_array(strtolower($userRole), ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'accountant', 'hr'], true)) {
                $stmtExp = $this->db->prepare("SELECT COUNT(*) FROM expenses WHERE tenant_id = ? AND status = 'pending' AND deleted_at IS NULL");
                $stmtExp->execute([$tid]);
                $pendingExp = (int)$stmtExp->fetchColumn();

                $stmtDep = $this->db->prepare("SELECT COUNT(*) FROM deposits WHERE tenant_id = ? AND status = 'pending' AND deleted_at IS NULL");
                $stmtDep->execute([$tid]);
                $pendingDep = (int)$stmtDep->fetchColumn();

                $lines[] = "   - Hàng đợi phê duyệt toàn hệ thống: **$pendingExp** phiếu chi (PO) chờ duyệt, **$pendingDep** phiếu đặt cọc (SO) chờ xác nhận.";
            }

            return implode("\n", $lines) . "\n";
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Retrieve top relevant articles from `ai_knowledge_base` (Pure MySQL — Zero Gemini).
     */
    private function retrieveRagContext(int $tid, string $query): array {
        try {
            $stmt = $this->db->prepare("SELECT id, title, content, category FROM ai_knowledge_base WHERE tenant_id = ? AND status = 'indexed' ORDER BY id DESC LIMIT 100");
            $stmt->execute([$tid]);
            $articles = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (empty($articles)) {
                return ['context_text' => '', 'matched_articles' => []];
            }

            $qLower = mb_strtolower($query, 'UTF-8');
            $words = preg_split('/[\s,.;?!()\[\]"\'-]+/u', $qLower, -1, PREG_SPLIT_NO_EMPTY);
            $stopWords = ['là', 'gì', 'có', 'không', 'cho', 'tôi', 'hỏi', 'về', 'của', 'và', 'các', 'những', 'trong', 'như', 'thế', 'nào', 'bao', 'nhiêu', 'khi', 'cần', 'làm', 'sao', 'để', 'với', 'tại', 'theo', 'anh', 'chị', 'em', 'ơi'];
            $keywords = array_values(array_filter($words, function($w) use ($stopWords) {
                return mb_strlen($w, 'UTF-8') >= 2 && !in_array($w, $stopWords, true);
            }));

            $scored = [];
            foreach ($articles as $art) {
                $titleLower = mb_strtolower($art['title'] ?? '', 'UTF-8');
                $contentLower = mb_strtolower($art['content'] ?? '', 'UTF-8');
                $catLower = mb_strtolower($art['category'] ?? '', 'UTF-8');
                $score = 0;

                foreach ($keywords as $kw) {
                    if (mb_strpos($titleLower, $kw) !== false) $score += 5;
                    if (mb_strpos($catLower, $kw) !== false) $score += 2;
                    if (mb_strpos($contentLower, $kw) !== false) $score += 2;
                }

                if ($score > 0) {
                    $art['relevance_score'] = $score;
                    $scored[] = $art;
                }
            }

            usort($scored, fn($a, $b) => $b['relevance_score'] <=> $a['relevance_score']);
            $topArticles = array_slice($scored, 0, 5);
            if (empty($topArticles)) {
                return ['context_text' => '', 'matched_articles' => []];
            }

            $lines = [];
            $matchedMeta = [];
            foreach ($topArticles as $idx => $art) {
                $num = $idx + 1;
                $cat = strtoupper($art['category'] ?? 'GENERAL');
                $title = $art['title'] ?? 'Tài liệu';
                $content = mb_substr(trim($art['content'] ?? ''), 0, 1200);
                $lines[] = "--- [TÀI LIỆU #$num | Danh mục: $cat | Tiêu đề: $title] ---\n$content";
                $matchedMeta[] = [
                    'id' => (int)$art['id'],
                    'title' => $title,
                    'category' => $art['category'] ?? 'general',
                    'score' => $art['relevance_score']
                ];
            }

            return [
                'context_text' => implode("\n\n", $lines),
                'matched_articles' => $matchedMeta
            ];
        } catch (\Throwable $e) {
            return ['context_text' => '', 'matched_articles' => []];
        }
    }

    private function loadUserMemories(int $userId, int $tenantId): string {
        try {
            $stmt = $this->db->prepare("
                SELECT memory_key, memory_value, category
                FROM ai_user_memories
                WHERE user_id = ? AND tenant_id = ?
                ORDER BY importance DESC, updated_at DESC
                LIMIT 10
            ");
            $stmt->execute([$userId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) return "";
            $out = "\n--- [TRÍ NHỚ DÀI HẠN CỦA NGƯỜI DÙNG] ---\n";
            foreach ($rows as $r) {
                $out .= "• [{$r['category']}] {$r['memory_key']}: {$r['memory_value']}\n";
            }
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    private function loadRecentEntityContext(int $userId, int $tenantId): string {
        try {
            $stmt = $this->db->prepare("
                SELECT entity_type, entity_id, entity_name, metadata_json
                FROM ai_entity_context
                WHERE user_id = ? AND tenant_id = ? AND last_referenced_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                ORDER BY last_referenced_at DESC
                LIMIT 6
            ");
            $stmt->execute([$userId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) return "";
            $out = "\n--- [NGỮ CẢNH THỰC THỂ GẦN ĐÂY (48H QUA - DÙNG KHI XƯNG HÔ 'KHÁCH NÀY', 'TASK ĐÓ', 'PHIẾU VỪA RỒI')] ---\n";
            foreach ($rows as $r) {
                $out .= "• [{$r['entity_type']}] ID #{$r['entity_id']} — {$r['entity_name']}\n";
            }
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    private function recordEntityContext(int $userId, int $tenantId, string $entityType, int $entityId, string $entityName, array $metadata = []): void {
        try {
            if ($entityId <= 0 || $entityName === '' || $userId <= 0) return;
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
        } catch (\Throwable $e) {
            // Ignore
        }
    }

    private function autoRecordEntityFromTool(int $uid, int $tid, string $toolName, array $toolArgs, array $toolResult): void {
        try {
            if ($uid <= 0) return;
            if ($toolName === 'get_contact_360_profile') {
                $cId = (int)($toolResult['contact_id'] ?? ($toolResult['profile']['id'] ?? ($toolArgs['contact_id'] ?? 0)));
                $cName = (string)($toolResult['profile']['full_name'] ?? ($toolResult['contact']['full_name'] ?? ($toolResult['profile']['name'] ?? '')));
                if ($cId > 0 && $cName !== '') {
                    $this->recordEntityContext($uid, $tid, 'contact', $cId, $cName);
                }
            } elseif ($toolName === 'search_contacts') {
                $contacts = $toolResult['contacts'] ?? [];
                if (is_array($contacts) && count($contacts) === 1) {
                    $top = $contacts[0];
                    $cId = (int)($top['id'] ?? 0);
                    $cName = (string)($top['full_name'] ?? ($top['name'] ?? ''));
                    if ($cId > 0 && $cName !== '') {
                        $this->recordEntityContext($uid, $tid, 'contact', $cId, $cName);
                    }
                }
            } elseif ($toolName === 'get_task_detail') {
                $t = $toolResult['task'] ?? ($toolResult['data'] ?? []);
                $tId = (int)($t['id'] ?? ($toolArgs['task_id'] ?? 0));
                $tTitle = (string)($t['subject'] ?? ($t['title'] ?? ''));
                if ($tId > 0 && $tTitle !== '') {
                    $this->recordEntityContext($uid, $tid, 'task', $tId, $tTitle);
                }
            }
        } catch (\Throwable $e) {
            // Ignore
        }
    }

    private function detectProactiveOperationalRisks(int $userId, int $tenantId, string $userRole): string {
        try {
            $risks = [];
            $stmtLead = $this->db->prepare("
                SELECT COUNT(1) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL
                  AND created_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
                  AND (last_contact IS NULL OR last_contact <= DATE_SUB(NOW(), INTERVAL 3 DAY))
            ");
            $stmtLead->execute([$tenantId]);
            $staleCount = (int)$stmtLead->fetchColumn();
            if ($staleCount > 0) {
                $risks[] = "Có {$staleCount} học viên/lead chưa được tương tác lại trên 3 ngày.";
            }

            $stmtTuition = $this->db->prepare("
                SELECT COUNT(1) FROM sales_orders
                WHERE tenant_id = ? AND payment_status IN ('unpaid', 'partial')
                  AND (status IS NULL OR status NOT IN ('cancelled', 'draft'))
                  AND (total - COALESCE(paid_amount, 0)) > 0
            ");
            $stmtTuition->execute([$tenantId]);
            $overdueTuition = (int)$stmtTuition->fetchColumn();
            if ($overdueTuition > 0) {
                $risks[] = "Có {$overdueTuition} đơn hàng/học phí còn tồn đọng chưa thanh toán đủ.";
            }

            if (empty($risks)) return "";
            $out = "\n--- [CẢNH BÁO RỦI RO VẬN HÀNH TỰ ĐỘNG (PROACTIVE RISKS)] ---\n";
            foreach ($risks as $r) {
                $out .= "• {$r}\n";
            }
            $out .= "Nếu phù hợp với câu hỏi, bạn có thể xuất khối <<<PROACTIVE_INSIGHT: {\"type\":\"warning\",\"title\":\"...\",\"description\":\"...\",\"action_label\":\"...\",\"action_prompt\":\"...\"}>>> ở cuối câu trả lời.\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }
}
