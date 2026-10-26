<?php
trait ChatGeminiEngineTrait {
    private function callGeminiFlashLite(array $conversationHistory, string $systemPrompt, ?array $attachedFile = null, ?callable $onChunk = null, ?array $authContext = null, ?callable $onStep = null, array &$executedAgentSteps = []): ?string {
        try {
            $this->db = Database::ensureConnected($this->db);
            $stmtKey = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('groq_api_key', 'groq_model', 'gemini_api_key', 'gemini_model')");
            $stmtKey->execute();
            $settings = $stmtKey->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

            $groqKey = '';
            $groqModel = 'qwen/qwen3.8-27b';
            /* [COMMENTED OUT FREE MODEL - USE GEMINI 3.5 FLASH LITE AS PRIMARY]
            $envGroqKey = trim((string)($_ENV['GROQ_API_KEY'] ?? getenv('GROQ_API_KEY') ?: ''));
            $dbGroqKey = trim((string)($settings['groq_api_key'] ?? ''));
            $groqKey = $dbGroqKey !== '' ? $dbGroqKey : $envGroqKey;
            if ($dbGroqKey === '' && $envGroqKey !== '') {
                try {
                    $stmtSeedGr = $this->db->prepare("
                        INSERT INTO system_settings (setting_key, setting_value)
                        VALUES ('groq_api_key', ?)
                        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                    ");
                    $stmtSeedGr->execute([$envGroqKey]);
                } catch (\Throwable $eSeed) {
                    // Ignore DB write error
                }
            }
            $groqModel = trim((string)($settings['groq_model'] ?? ($_ENV['GROQ_MODEL'] ?? getenv('GROQ_MODEL') ?: 'qwen/qwen3.8-27b')));
            if ($groqModel === '' || !in_array($groqModel, ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'], true)) {
                $groqModel = 'qwen/qwen3.8-27b';
            }
            */

            $apiKey = trim($settings['gemini_api_key'] ?? '') ?: ($_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: '');
            $envGeminiModel = trim((string)($_ENV['GEMINI_MODEL'] ?? getenv('GEMINI_MODEL') ?: 'gemini-3.5-flash-lite'));
            $model = trim($settings['gemini_model'] ?? '') ?: $envGeminiModel;
            if (empty($apiKey)) {
                error_log("callGeminiFlashLite: gemini_api_key chưa được cấu hình.");
                $errorMsg = "Hệ thống chưa được cấu hình Gemini API Key. Vui lòng liên hệ Quản trị viên để thiết lập API Key trong Cài đặt hệ thống.";
                if (is_callable($onChunk)) {
                    $onChunk($errorMsg);
                }
                return $errorMsg;
            }
            if (empty($model)) {
                $model = 'gemini-3.5-flash-lite';
            }

            $isStream = is_callable($onChunk);

            $contents = [];
            $historyCount = count($conversationHistory);
            foreach ($conversationHistory as $idx => $msg) {
                $role = ((int)$msg['sender_id'] === 9000001) ? 'model' : 'user';
                $parts = [];

                if ($idx === $historyCount - 1 && !empty($attachedFile)) {
                    if (!empty($attachedFile['inlineData'])) {
                        $parts[] = ['inlineData' => $attachedFile['inlineData']];
                    }
                    if (!empty($attachedFile['extractedText'])) {
                        $parts[] = ['text' => "--- [NỘI DUNG TÀI LIỆU ĐÍNH KÈM: " . ($attachedFile['fileName'] ?? 'Tài liệu') . "] ---\n" . $attachedFile['extractedText'] . "\n--- [HẾT TÀI LIỆU] ---"];
                    }
                }

                $msgText = trim($msg['content'] ?? '');

                // Historical Context Compaction: For previous messages, strip giant UI widget JSON blocks,
                // compress large markdown tables, and append compact working_memory state if present
                if ($idx < $historyCount - 1 && !empty($msgText)) {
                    $msgText = $this->compactHistoryMessageForPrompt($msgText, isset($msg['metadata']) ? (string)$msg['metadata'] : null, $role);
                }

                if (!empty($msgText)) {
                    $parts[] = ['text' => $msgText];
                } elseif (empty($parts)) {
                    $parts[] = ['text' => '(Tài liệu đính kèm)'];
                }

                $contents[] = [
                    'role' => $role,
                    'parts' => $parts
                ];
            }

            if (empty($contents)) {
                return null;
            }

            // ==========================================
            // HUB & SPOKE DYNAMIC TOOL SCOPING (ENTERPRISE MULTI-AGENT SWARM)
            // ==========================================
            require_once __DIR__ . '/AgentToolRegistry.php';

            $agentToolMap = [
                'sales' => ['query_customer_student_persona_overview', 'query_sales_lead_performance_deck', 'query_crm_leads_multitier', 'query_deposits_and_revenue_multitier', 'query_deals_and_b2b_multitier', 'query_cross_domain_executive_synthesis', 'smart_create_or_assign_leads', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'smart_manage_po_so_and_approvals', 'get_contact_360_profile', 'search_contacts', 'export_crm_leads_advanced', 'analyze_leads_demographics_and_job_titles', 'get_sales_leaderboard', 'check_lead_duplicate_and_fairshare_status', 'schedule_contact_activity', 'get_my_crm_inbox', 'get_sales_performance_and_stale_leads', 'get_consultant_shift_and_fairshare_audit', 'manage_lead_round_distribution', 'lookup_recent_cash_receipts_and_deposits', 'update_contact_pipeline', 'add_contact_consultation_note', 'update_contact_profile', 'quick_log_crm_activity', 'reassign_lead_owner', 'get_company_staff_directory', 'draft_action_proposal', 'get_system_navigation'],
                'finance' => ['query_finance_multitier_analytics', 'query_deposits_and_revenue_multitier', 'query_cross_domain_executive_synthesis', 'smart_manage_po_so_and_approvals', 'smart_manage_hrm_and_payroll', 'manage_my_hr_profile_and_requests', 'smart_manage_tasks_and_subtasks', 'filter_expenses_advanced', 'get_sales_leaderboard', 'get_contact_financial_summary', 'lookup_recent_cash_receipts_and_deposits', 'get_my_payment_proposals', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'approve_or_reject_erp_ticket', 'draft_action_proposal', 'get_system_navigation'],
                'hrm' => ['query_hrm_workforce_and_payroll_multitier', 'manage_my_hr_profile_and_requests', 'smart_manage_hrm_and_payroll', 'smart_manage_tasks_and_subtasks', 'get_staff_directory_advanced', 'query_company_attendance_and_work_hours', 'get_company_staff_directory', 'get_company_leave_and_absence', 'get_my_attendance_summary', 'get_my_payslip', 'get_pending_approvals', 'trace_approval_blocker', 'approve_or_reject_erp_ticket', 'update_task_progress_and_status', 'draft_action_proposal', 'get_system_navigation'],
                'tasks' => ['query_tasks_and_projects_multitier', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'smart_manage_po_so_and_approvals', 'get_my_tasks', 'get_task_detail', 'get_company_staff_directory', 'schedule_contact_activity', 'update_task_progress_and_status', 'complete_task_checklist_item', 'draft_action_proposal', 'get_system_navigation'],
                'academic' => ['query_customer_student_persona_overview', 'query_crm_leads_multitier', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'get_academic_students_filter', 'get_program_details', 'get_academic_schedule_and_intakes', 'get_active_projects_and_campaigns', 'search_contacts', 'export_crm_leads_advanced', 'search_ideas_knowledge', 'draft_action_proposal', 'get_system_navigation'],
                'records_legal' => ['query_customer_student_persona_overview', 'check_student_admission_records', 'get_academic_students_filter', 'get_contact_360_profile', 'attach_files_to_contact', 'draft_action_proposal', 'get_system_navigation'],
                'assets_inventory' => ['query_inventory_and_assets_multitier', 'get_inventory_health_check', 'get_inventory_and_asset_status', 'draft_action_proposal', 'get_system_navigation'],
                'b2b_partner' => ['query_deals_and_b2b_multitier', 'get_b2b_partner_and_contract_summary', 'draft_action_proposal', 'get_system_navigation'],
                'marketing_campaigns' => ['query_customer_student_persona_overview', 'query_sales_lead_performance_deck', 'query_omnichannel_journey_and_automation_analytics', 'get_lead_digital_footprint_360', 'smart_manage_automation_flows_and_campaigns', 'query_crm_leads_multitier', 'query_deposits_and_revenue_multitier', 'query_deals_and_b2b_multitier', 'query_cross_domain_executive_synthesis', 'smart_create_or_assign_leads', 'manage_lead_round_distribution', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'get_contact_360_profile', 'search_contacts', 'export_crm_leads_advanced', 'analyze_leads_demographics_and_job_titles', 'get_sales_leaderboard', 'get_sales_performance_and_stale_leads', 'get_consultant_shift_and_fairshare_audit', 'check_lead_duplicate_and_fairshare_status', 'get_campaign_marketing_stats', 'get_active_projects_and_campaigns', 'get_company_staff_directory', 'draft_action_proposal', 'get_system_navigation'],
                'executive_bi' => ['query_customer_student_persona_overview', 'query_sales_lead_performance_deck', 'query_cross_domain_executive_synthesis', 'query_crm_leads_multitier', 'query_finance_multitier_analytics', 'query_deposits_and_revenue_multitier', 'query_tasks_and_projects_multitier', 'query_deals_and_b2b_multitier', 'query_tickets_and_sla_multitier', 'query_hrm_workforce_and_payroll_multitier', 'query_inventory_and_assets_multitier', 'smart_create_or_assign_leads', 'smart_manage_tasks_and_subtasks', 'query_and_manage_projects', 'manage_my_hr_profile_and_requests', 'smart_manage_hrm_and_payroll', 'smart_manage_po_so_and_approvals', 'get_executive_morning_brief', 'get_sales_leaderboard', 'filter_expenses_advanced', 'get_staff_directory_advanced', 'get_inventory_health_check', 'export_crm_leads_advanced', 'analyze_leads_demographics_and_job_titles', 'query_company_attendance_and_work_hours', 'get_executive_financial_pulse', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'lookup_recent_cash_receipts_and_deposits', 'get_my_tasks', 'get_system_health_status', 'manage_lead_round_distribution', 'approve_or_reject_erp_ticket', 'update_task_progress_and_status', 'reassign_lead_owner', 'draft_action_proposal', 'get_system_navigation'],
                'system_it' => ['query_tickets_and_sla_multitier', 'get_system_health_status', 'get_ticket_status_and_sla_breaches', 'draft_action_proposal', 'get_system_navigation']
            ];
            // Domain key aliases for seamless compatibility across UI and router conventions
            $agentToolMap['operations_tasks'] = $agentToolMap['tasks'];
            $agentToolMap['academic_Admissions'] = $agentToolMap['academic'];
            $agentToolMap['hr_admin'] = $agentToolMap['hrm'];
            $agentToolMap['finance_accounting'] = $agentToolMap['finance'];

            // Extract last user message
            $lastMsgText = '';
            foreach ($contents as $c) {
                if (($c['role'] ?? '') === 'user') {
                    foreach ($c['parts'] ?? [] as $p) {
                        if (!empty($p['text'])) $lastMsgText = $p['text'];
                    }
                }
            }

            // 1. Gated Routing: Reuse deterministic Swarm + Working Memory routing if already resolved;
            // only invoke AI Micro-Router HTTP call when query domain is ambiguous/general
            $explicitAgentId = $authContext['metadata']['active_agent_id'] ?? null;
            $preRouting = is_array($authContext['pre_routing'] ?? null) ? $authContext['pre_routing'] : [];
            $preMatchedDomains = is_array($preRouting['matched_domains'] ?? null) ? $preRouting['matched_domains'] : [];
            $tools = null;
            $groqScopedTools = null;
            $isPureConversational = false;
            $isMutationOrProposalIntent = false;

            $currentContext = $authContext['metadata']['current_context'] ?? null;
            if (!empty($explicitAgentId) && isset($agentToolMap[$explicitAgentId])) {
                $intentType = 'database_action';
                $primaryDomain = $explicitAgentId;
                $matchedDomains = array_values(array_unique(array_merge([$explicitAgentId], $preMatchedDomains)));
                $aiSelectedTools = !empty($preRouting['last_tool']) ? [(string)$preRouting['last_tool']] : [];
                $isMultiDomain = count($matchedDomains) > 1;
                $requiresTools = true;
                $isMutationOrProposalIntent = (bool)preg_match('/(tạo|thêm|sửa|cập nhật|xóa|giao|chuyển|chia|bù|duyệt|từ chối|đặt lịch|ghi chú|đề xuất|xuất file|tải file|export)/iu', $lastMsgText);
            } elseif (!empty($preMatchedDomains)) {
                $intentType = count($preMatchedDomains) > 1 ? 'cross_domain' : 'database_action';
                $primaryDomain = $preRouting['primary_domain'] ?? $preMatchedDomains[0];
                $matchedDomains = $preMatchedDomains;
                $aiSelectedTools = !empty($preRouting['last_tool']) ? [(string)$preRouting['last_tool']] : [];
                $isMultiDomain = count($matchedDomains) > 1;
                $requiresTools = true;
                $isMutationOrProposalIntent = (bool)preg_match('/(tạo|thêm|sửa|cập nhật|xóa|giao|chuyển|chia|bù|duyệt|từ chối|đặt lịch|ghi chú|đề xuất|xuất file|tải file|export)/iu', $lastMsgText);
            } elseif (mb_strlen(trim($lastMsgText), 'UTF-8') <= 15 && preg_match('/^(xin chào|chào|hi|hello|alo|ok|cảm ơn|thanks|dạ|vâng|tốt quá|tuyệt vời)[!.\s]*$/iu', trim($lastMsgText))) {
                $intentType = 'conversational';
                $primaryDomain = 'none';
                $matchedDomains = [];
                $aiSelectedTools = [];
                $isMultiDomain = false;
                $requiresTools = false;
                $isMutationOrProposalIntent = false;
            } else {
                $routeDecision = $this->routeQueryWithAiMicroRouter(
                    $lastMsgText,
                    $apiKey,
                    $model,
                    $currentContext,
                    $groqKey,
                    $groqModel
                );
                $intentType = $routeDecision['intent_type'] ?? 'database_action';
                $primaryDomain = $routeDecision['primary_domain'] ?? null;
                $matchedDomains = is_array($routeDecision['matched_domains'] ?? null) ? $routeDecision['matched_domains'] : [];
                $aiSelectedTools = is_array($routeDecision['selected_tools'] ?? null) ? $routeDecision['selected_tools'] : [];
                $isMultiDomain = (bool)($routeDecision['is_multi_domain'] ?? false);
                $requiresTools = (bool)($routeDecision['requires_tools'] ?? true);
                $isMutationOrProposalIntent = (bool)($routeDecision['is_mutation_or_proposal'] ?? false);
            }

            if (!empty($explicitAgentId) && isset($agentToolMap[$explicitAgentId])) {
                $scopedToolNames = $agentToolMap[$explicitAgentId];
                if (!empty($aiSelectedTools)) {
                    $scopedToolNames = array_values(array_unique(array_merge($scopedToolNames, $aiSelectedTools)));
                }
                $tools = AgentToolRegistry::getGeminiToolsDeclaration($scopedToolNames);
            } elseif ($intentType === 'conversational' || !$requiresTools) {
                $isPureConversational = ($intentType === 'conversational');
                $tools = null;
            } elseif ($isMultiDomain || $intentType === 'cross_domain' || empty($primaryDomain) || $primaryDomain === 'none') {
                if (!empty($matchedDomains)) {
                    $scopedToolNames = [];
                    foreach ($matchedDomains as $dom) {
                        if (isset($agentToolMap[$dom])) {
                            $scopedToolNames = array_merge($scopedToolNames, $agentToolMap[$dom]);
                        }
                    }
                    if (!empty($aiSelectedTools)) {
                        $scopedToolNames = array_merge($scopedToolNames, $aiSelectedTools);
                    }
                    $scopedToolNames[] = 'query_cross_domain_executive_synthesis';
                    $scopedToolNames = array_values(array_unique($scopedToolNames));
                    $tools = AgentToolRegistry::getGeminiToolsDeclaration($scopedToolNames);
                } else {
                    $tools = AgentToolRegistry::getGeminiToolsDeclaration(null);
                }
            } elseif (isset($agentToolMap[$primaryDomain])) {
                $scopedToolNames = $agentToolMap[$primaryDomain];
                foreach ($matchedDomains as $dom) {
                    if (isset($agentToolMap[$dom])) {
                        $scopedToolNames = array_merge($scopedToolNames, $agentToolMap[$dom]);
                    }
                }
                if (!empty($aiSelectedTools)) {
                    $scopedToolNames = array_merge($scopedToolNames, $aiSelectedTools);
                }
                $scopedToolNames = array_values(array_unique($scopedToolNames));
                $tools = AgentToolRegistry::getGeminiToolsDeclaration($scopedToolNames);
            } else {
                $tools = AgentToolRegistry::getGeminiToolsDeclaration(null);
            }

            // Build Dynamic Domain-Scoped System Prompt for Turn 1 (saves ~60% system prompt tokens while keeping 100% domain rules & working memory)
            $turn1SystemPrompt = $this->buildGroqFocusedSystemPrompt(
                $systemPrompt,
                (string)($primaryDomain && $primaryDomain !== 'none' ? $primaryDomain : 'executive_bi'),
                $matchedDomains,
                false
            );

            $payload = [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $turn1SystemPrompt]
                    ]
                ],
                'contents' => $contents,
                'generationConfig' => [
                    'temperature' => 0.2,
                    'maxOutputTokens' => 15000,
                    'topP' => 0.95
                ]
            ];

            if (!$isPureConversational && !empty($tools)) {
                $payload['tools'] = $tools;
                $payload['toolConfig'] = [
                    'functionCallingConfig' => [
                        'mode' => 'AUTO'
                    ]
                ];
            }

            /* [COMMENTED OUT FREE MODEL - USE GEMINI 3.5 FLASH LITE AS PRIMARY]
            $hasUnsupportedInlineBinary = !empty($attachedFile['inlineData']['mimeType'])
                && strpos((string)$attachedFile['inlineData']['mimeType'], 'image/') !== 0;

            if ($groqKey !== '' && !$hasUnsupportedInlineBinary) {
                $groqReply = $this->callGroqQwenPrimary(
                    $conversationHistory,
                    $systemPrompt,
                    $attachedFile,
                    $groqScopedTools,
                    $isPureConversational,
                    $isMutationOrProposalIntent,
                    $groqKey,
                    $groqModel,
                    $primaryDomain,
                    $matchedDomains,
                    $onChunk,
                    $authContext,
                    $onStep,
                    $executedAgentSteps
                );
                if ($groqReply !== null && trim($groqReply) !== '') {
                    return trim($groqReply);
                }
                error_log("Groq Qwen 3.8 27B primary pool unavailable for this turn, falling back to Gemini ({$model})...");
            }
            */

            // ==========================================
            // PRIMARY ENGINE: GEMINI 3.5 FLASH LITE AUTONOMOUS MULTI-TURN TOOL LOOP
            // ==========================================
            $maxToolTurns = 6;
            $toolTurn = 0;
            $generateUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
            $collectedExportMarkdowns = [];
            $collectedStructuredTags = [];
            $suppressSingleErpCard = false;

            while ($toolTurn < $maxToolTurns) {
                $toolTurn++;

                // 1. Non-streaming call to evaluate function calling
                $ch = curl_init($generateUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                curl_setopt($ch, CURLOPT_TIMEOUT, 35);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

                $resp = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlErr = curl_error($ch);
                curl_close($ch);

                if ($curlErr || $httpCode !== 200 || !$resp) {
                    error_log("Gemini Turn {$toolTurn} Error: HTTP $httpCode, Curl: $curlErr, Resp: " . substr((string)$resp, 0, 500));
                    // Fallback on Turn 1 if Bad Request
                    if ($httpCode === 400 && $toolTurn === 1) {
                        unset($payload['tools'], $payload['toolConfig']);
                        $chRetry = curl_init($generateUrl);
                        curl_setopt($chRetry, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($chRetry, CURLOPT_POST, true);
                        curl_setopt($chRetry, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                        curl_setopt($chRetry, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                        curl_setopt($chRetry, CURLOPT_TIMEOUT, 30);
                        $respRetry = curl_exec($chRetry);
                        curl_close($chRetry);
                        if ($respRetry) {
                            $jRet = json_decode($respRetry, true);
                            $txt = $jRet['candidates'][0]['content']['parts'][0]['text'] ?? null;
                            if ($txt) {
                                if ($isStream && is_callable($onChunk)) $onChunk($txt);
                                return trim($txt);
                            }
                        }
                    }
                    return "Tôi đã nhận được yêu cầu của bạn, tuy nhiên kết nối đến hệ thống AI đang bị gián đoạn (HTTP {$httpCode}). Vui lòng thử lại sau giây lát.";
                }

                $resJson = json_decode($resp, true);
                $candidate = $resJson['candidates'][0] ?? null;
                $parts = $candidate['content']['parts'] ?? [];

                $functionCalls = [];
                $directText = '';
                foreach ($parts as $p) {
                    if (isset($p['functionCall'])) {
                        $functionCalls[] = $p['functionCall'];
                    }
                    if (isset($p['text'])) {
                        $directText .= $p['text'];
                    }
                }

                // If Gemini didn't call any tool, we have our final text answer!
                if (empty($functionCalls)) {
                    $finalText = trim($directText);
                    $finalText = $this->appendMissingDeterministicArtifacts($finalText, $collectedExportMarkdowns, $collectedStructuredTags, $suppressSingleErpCard);
                    if ($isStream && is_callable($onChunk)) {
                        $onChunk($finalText);
                    }
                    return $finalText;
                }

                // Append Model Function Call Turn once (containing all parallel functionCalls)
                $contents[] = $candidate['content'];

                $functionResponseParts = [];
                $hasTerminalActionSuccess = false;
                $allToolsInTurnAreTerminalOrReadOnly = true;
                $requiresDisambiguationSynthesis = false;
                $ctxUid = (int)($authContext['user_id'] ?? 0);
                $ctxTid = (int)($authContext['tenant_id'] ?? 1);

                foreach ($functionCalls as $fcIdx => $functionCallPart) {
                    $toolName = $functionCallPart['name'] ?? '';
                    $toolArgs = $functionCallPart['args'] ?? [];
                    $stepId = "step_{$toolTurn}_{$fcIdx}_" . substr(md5($toolName . microtime(true)), 0, 6);

                    if (is_callable($onStep)) {
                        $onStep([
                            'type' => 'agent_step',
                            'step' => [
                                'id' => $stepId,
                                'turn' => $toolTurn,
                                'tool_name' => $toolName,
                                'status' => 'running',
                                'label' => "Đang thực thi công cụ: {$toolName}"
                            ]
                        ]);
                    }

                    $t0 = microtime(true);
                    $this->db = Database::ensureConnected($this->db);
                    $toolResult = AgentToolRegistry::executeTool($this->db, $toolName, $toolArgs, $authContext ?? []);
                    if (is_array($toolResult) && !empty($toolResult['error']) && (stripos((string)$toolResult['error'], 'gone away') !== false || stripos((string)$toolResult['error'], 'Lost connection') !== false)) {
                        $this->db = Database::reconnect();
                        $toolResult = AgentToolRegistry::executeTool($this->db, $toolName, $toolArgs, $authContext ?? []);
                    }
                    $durationMs = (int)round((microtime(true) - $t0) * 1000);

                    if ($ctxUid > 0 && is_array($toolResult)) {
                        $this->autoRecordEntityFromTool($ctxUid, $ctxTid, $toolName, $toolArgs, $toolResult);
                    }

                    $isDisambig = is_array($toolResult) && (
                        !empty($toolResult['requires_disambiguation']) ||
                        !empty($toolResult['disambiguation_required']) ||
                        ($toolResult['status'] ?? '') === 'DISAMBIGUATION_REQUIRED' ||
                        ($toolResult['status'] ?? '') === 'MISSING_INFO_REQUIRED'
                    );
                    if ($isDisambig) {
                        $requiresDisambiguationSynthesis = true;
                    }

                    // Collect deterministic export markdown links & structured widget tags from tool result
                    if (is_array($toolResult)) {
                        foreach (['export_link_markdown', 'export_markdown'] as $expField) {
                            if (!empty($toolResult[$expField]) && is_string($toolResult[$expField])) {
                                $collectedExportMarkdowns[] = trim($toolResult[$expField]);
                            }
                        }
                        if (!empty($toolResult['dynamic_chart']) && is_array($toolResult['dynamic_chart'])) {
                            $collectedStructuredTags[] = '<<<DYNAMIC_CHART: ' . json_encode($toolResult['dynamic_chart'], JSON_UNESCAPED_UNICODE) . '>>>';
                        }
                        $rowCountReturned = (int)($toolResult['total_matching'] ?? $toolResult['total_processed'] ?? $toolResult['matched_count'] ?? 0);
                        if ($rowCountReturned > 1 && !$isDisambig) {
                            $suppressSingleErpCard = true;
                        }
                        foreach (['voice_summary_hint', 'instruction_for_ai', 'message', 'proposal_block'] as $strField) {
                            if (!empty($toolResult[$strField]) && is_string($toolResult[$strField])) {
                                if (preg_match_all('/<<<(?:DYNAMIC_CHART|ACTION_PROPOSAL|ERP_CARD):\s*[\s\S]*?>>>/', $toolResult[$strField], $tagMatches)) {
                                    foreach ($tagMatches[0] as $tagBlock) {
                                        $collectedStructuredTags[] = trim($tagBlock);
                                    }
                                }
                            }
                        }
                    }

                    $stepStatus = 'completed';
                    if ($isDisambig) {
                        $stepStatus = 'disambiguation';
                    } elseif (is_array($toolResult) && isset($toolResult['success']) && $toolResult['success'] === false) {
                        $stepStatus = 'error';
                    } elseif (is_array($toolResult) && isset($toolResult['total_matching']) && (int)$toolResult['total_matching'] === 0) {
                        $stepStatus = 'empty';
                    }

                    $sseStepEntry = [
                        'id' => $stepId,
                        'turn' => $toolTurn,
                        'tool_name' => $toolName,
                        'status' => $stepStatus,
                        'duration_ms' => $durationMs,
                        'label' => $isDisambig ? "Phát hiện nhiều lựa chọn cần xác nhận ({$toolName})" : "Hoàn tất tra cứu {$toolName} ({$durationMs}ms)"
                    ];

                    if (is_callable($onStep)) {
                        $onStep([
                            'type' => 'agent_step',
                            'step' => $sseStepEntry
                        ]);
                    }

                    $compactResult = $this->compactToolResultForModel($toolResult);
                    $stepEntry = $sseStepEntry;
                    $stepEntry['args'] = is_array($toolArgs) ? $toolArgs : [];
                    $stepEntry['working_state'] = $this->buildStepWorkingState(
                        $toolName,
                        is_array($toolArgs) ? $toolArgs : [],
                        is_array($compactResult) ? $compactResult : []
                    );
                    $executedAgentSteps[] = $stepEntry;

                    if (is_array($compactResult)) {
                        $lockFacts = [];
                        foreach (['total_matching', 'total_leads', 'total_Filtered_Records', 'total_records', 'total_expenses_vnd', 'total_deposit_vnd', 'net_cashflow_vnd', 'total_headcount', 'created_count', 'reassigned_count'] as $k) {
                            if (isset($compactResult[$k])) {
                                $lockFacts[$k] = $compactResult[$k];
                            }
                        }
                        if (isset($compactResult['summary']) && is_array($compactResult['summary'])) {
                            foreach (['total_matching', 'total_leads', 'total_deposit_revenue_vnd', 'total_approved_expense_vnd', 'net_operating_cashflow_vnd', 'leads_with_deposit_count', 'active_headcount'] as $sk) {
                                if (isset($compactResult['summary'][$sk])) {
                                    $lockFacts[$sk] = $compactResult['summary'][$sk];
                                }
                            }
                        }
                        $compactResult['_ground_truth_lock'] = [
                            'mandate' => 'STRICT_DATABASE_GROUND_TRUTH: Bắt buộc dùng chính xác 100% con số từ kết quả SQL này. Tuyệt đối không tự cộng nhẩm lại từ preview_top_15 hay bịa số liệu. Giữ nguyên link [Tải file Excel...](/export?...) và các thẻ <<<DYNAMIC_CHART:...>>> / <<<ACTION_PROPOSAL:...>>>. Không dùng emoji trong tiêu đề ###. Nếu kết quả có > 1 bản ghi, cấm sinh thẻ <<<ERP_CARD:...>>> đơn lẻ dưới bảng.',
                            'verified_metrics' => $lockFacts
                        ];
                    }

                    $functionResponseData = [
                        'name' => $toolName,
                        'response' => (object)$compactResult
                    ];
                    if (!empty($functionCallPart['id'])) {
                        $functionResponseData['id'] = $functionCallPart['id'];
                    }
                    $functionResponseParts[] = [
                        'functionResponse' => $functionResponseData
                    ];

                    $isActionTerminalTool = in_array($toolName, [
                        'draft_action_proposal',
                        'smart_create_or_assign_leads',
                        'smart_manage_tasks_and_subtasks',
                        'query_and_manage_projects',
                        'manage_my_hr_profile_and_requests',
                        'smart_manage_hrm_and_payroll',
                        'smart_manage_po_so_and_approvals',
                        'approve_or_reject_erp_ticket',
                        'update_task_progress_and_status',
                        'complete_task_checklist_item',
                        'quick_log_crm_activity',
                        'reassign_lead_owner',
                        'distribute_lead',
                        'compensate_consultant',
                        'toggle_consultant_shift',
                        'manage_lead_round_distribution',
                        'update_contact_pipeline',
                        'add_contact_consultation_note',
                        'attach_files_to_contact',
                        'update_contact_profile',
                        'schedule_contact_activity'
                    ], true);

                    $isReadOnlyAnalyticsTerminalTool = !$isMutationOrProposalIntent && in_array($toolName, [
                        'query_customer_student_persona_overview',
                        'query_sales_lead_performance_deck',
                        'query_crm_leads_multitier',
                        'query_finance_multitier_analytics',
                        'query_deposits_and_revenue_multitier',
                        'query_tasks_and_projects_multitier',
                        'query_and_manage_projects',
                        'query_deals_and_b2b_multitier',
                        'query_tickets_and_sla_multitier',
                        'query_hrm_workforce_and_payroll_multitier',
                        'query_inventory_and_assets_multitier',
                        'query_cross_domain_executive_synthesis',
                        'get_executive_morning_brief',
                        'get_executive_financial_pulse',
                        'get_sales_leaderboard',
                        'get_sales_performance_and_stale_leads',
                        'filter_expenses_advanced',
                        'export_crm_leads_advanced',
                        'analyze_leads_demographics_and_job_titles',
                        'get_staff_directory_advanced',
                        'query_company_attendance_and_work_hours',
                        'get_contact_360_profile',
                        'get_financial_overview',
                        'get_my_attendance_summary',
                        'get_my_payslip',
                        'get_pending_approvals',
                        'trace_approval_blocker',
                        'get_my_tasks',
                        'get_inventory_health_check',
                        'get_system_health_status',
                        'search_ideas_knowledge',
                        'get_program_details'
                    ], true);

                    $isTerminalTool = $isActionTerminalTool || $isReadOnlyAnalyticsTerminalTool;
                    if (!$isTerminalTool) {
                        $allToolsInTurnAreTerminalOrReadOnly = false;
                    }

                    if ($isTerminalTool && !$isDisambig && (!is_array($toolResult) || ($toolResult['success'] ?? true) !== false)) {
                        $hasTerminalActionSuccess = true;
                    }
                }

                if (!$allToolsInTurnAreTerminalOrReadOnly) {
                    $hasTerminalActionSuccess = false;
                }

                $contents[] = [
                    'role' => 'user',
                    'parts' => $functionResponseParts
                ];

                $payload['contents'] = $contents;

                // Force final synthesis (with real-time SSE streaming) when:
                // 1) All tools in this turn are terminal action or read-only analytics tools that succeeded cleanly, OR
                // 2) A tool returned requires_disambiguation (so the AI asks the clarifying question right away), OR
                // 3) We reached the max turns limit ($maxToolTurns - 1)
                if ($hasTerminalActionSuccess || $requiresDisambiguationSynthesis || $toolTurn >= ($maxToolTurns - 1)) {
                    // Turn-2 Synthesis Token Optimization: Slim systemInstruction to synthesis rules & scope tools to called functions only
                    $synthesisPrompt = $this->buildGroqFocusedSystemPrompt(
                        $systemPrompt,
                        (string)($primaryDomain && $primaryDomain !== 'none' ? $primaryDomain : 'executive_bi'),
                        $matchedDomains,
                        true
                    );
                    $payload['systemInstruction'] = [
                        'parts' => [
                            ['text' => $synthesisPrompt]
                        ]
                    ];
                    $calledToolNames = array_values(array_unique(array_filter(array_map(fn($st) => $st['tool_name'] ?? '', $executedAgentSteps))));
                    if (!empty($calledToolNames) && !empty($payload['tools'][0]['functionDeclarations'])) {
                        $slimDecls = array_values(array_filter(
                            $payload['tools'][0]['functionDeclarations'],
                            fn($d) => in_array($d['name'] ?? '', $calledToolNames, true)
                        ));
                        if (!empty($slimDecls)) {
                            $payload['tools'] = [['functionDeclarations' => $slimDecls]];
                        }
                    }
                    $payload['toolConfig'] = [
                        'functionCallingConfig' => [
                            'mode' => 'NONE'
                        ]
                    ];

                    // Final Turn: If streaming requested, use SSE Stream
                    if ($isStream) {
                        $streamUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse&key=" . urlencode($apiKey);
                        $streamBuffer = '';
                        $accumulatedText = '';
                        $chStream = curl_init($streamUrl);
                        curl_setopt($chStream, CURLOPT_RETURNTRANSFER, false);
                        curl_setopt($chStream, CURLOPT_POST, true);
                        curl_setopt($chStream, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                        curl_setopt($chStream, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                        curl_setopt($chStream, CURLOPT_TIMEOUT, 60);
                        curl_setopt($chStream, CURLOPT_CONNECTTIMEOUT, 10);
                        curl_setopt($chStream, CURLOPT_SSL_VERIFYPEER, true);
                        curl_setopt($chStream, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$streamBuffer, &$accumulatedText, $onChunk) {
                            $streamBuffer .= $data;
                            while (true) {
                                $pos = false;
                                $delimiterLen = 0;
                                $posCrlf = strpos($streamBuffer, "\r\n\r\n");
                                $posLf = strpos($streamBuffer, "\n\n");
                                if ($posCrlf !== false && ($posLf === false || $posCrlf <= $posLf)) {
                                    $pos = $posCrlf;
                                    $delimiterLen = 4;
                                } elseif ($posLf !== false) {
                                    $pos = $posLf;
                                    $delimiterLen = 2;
                                }

                                if ($pos === false) break;

                                $event = substr($streamBuffer, 0, $pos);
                                $streamBuffer = substr($streamBuffer, $pos + $delimiterLen);
                                $lines = preg_split('/\r?\n/', $event);
                                foreach ($lines as $line) {
                                    $line = trim($line);
                                    if (strpos($line, 'data: ') === 0) {
                                        $jsonStr = substr($line, 6);
                                        $json = json_decode($jsonStr, true);
                                        $candParts = $json['candidates'][0]['content']['parts'] ?? [];
                                        if (is_array($candParts)) {
                                            foreach ($candParts as $part) {
                                                if (!empty($part['text'])) {
                                                    $delta = $part['text'];
                                                    $accumulatedText .= $delta;
                                                    $onChunk($delta);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            return strlen($data);
                        });
                        curl_exec($chStream);
                        $streamHttpCode = curl_getinfo($chStream, CURLINFO_HTTP_CODE);
                        $streamCurlErr = curl_error($chStream);
                        curl_close($chStream);

                        if (!empty($streamBuffer)) {
                            $lines = preg_split('/\r?\n/', $streamBuffer);
                            foreach ($lines as $line) {
                                $line = trim($line);
                                if (strpos($line, 'data: ') === 0) {
                                    $jsonStr = substr($line, 6);
                                    $json = json_decode($jsonStr, true);
                                    $candParts = $json['candidates'][0]['content']['parts'] ?? [];
                                    if (is_array($candParts)) {
                                        foreach ($candParts as $part) {
                                            if (!empty($part['text'])) {
                                                $delta = $part['text'];
                                                $accumulatedText .= $delta;
                                                $onChunk($delta);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if ($streamCurlErr || $streamHttpCode !== 200 || empty($accumulatedText)) {
                            error_log("Gemini Final Stream Error: HTTP $streamHttpCode, Curl: $streamCurlErr");
                            if (empty($accumulatedText)) {
                                $fallback = "Dạ em đã hoàn thành tra cứu và tạo đề xuất cho bạn, tuy nhiên kết nối hiển thị gặp trục trặc (HTTP {$streamHttpCode}). Vui lòng thử lại sau giây lát nhé.";
                                $onChunk($fallback);
                                return $fallback;
                            }
                        }

                        $withArtifacts = $this->appendMissingDeterministicArtifacts($accumulatedText, $collectedExportMarkdowns, $collectedStructuredTags, $suppressSingleErpCard);
                        if ($withArtifacts !== $accumulatedText && strpos($withArtifacts, $accumulatedText) === 0) {
                            $suffix = substr($withArtifacts, strlen($accumulatedText));
                            if ($suffix !== '') {
                                $onChunk($suffix);
                            }
                        }
                        return trim($withArtifacts);
                    }

                    // Non-stream final synthesis
                    $chFinal = curl_init($generateUrl);
                    curl_setopt($chFinal, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chFinal, CURLOPT_POST, true);
                    curl_setopt($chFinal, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                    curl_setopt($chFinal, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                    curl_setopt($chFinal, CURLOPT_TIMEOUT, 30);
                    curl_setopt($chFinal, CURLOPT_CONNECTTIMEOUT, 10);
                    curl_setopt($chFinal, CURLOPT_SSL_VERIFYPEER, true);

                    $respFinal = curl_exec($chFinal);
                    $httpFinal = curl_getinfo($chFinal, CURLINFO_HTTP_CODE);
                    $errFinal = curl_error($chFinal);
                    curl_close($chFinal);

                    if ($errFinal || $httpFinal !== 200 || !$respFinal) {
                        error_log("Gemini Final Non-stream Error: HTTP $httpFinal, Curl: $errFinal");
                        return "Dạ em đã kiểm tra dữ liệu từ hệ thống, tuy nhiên kết nối trả lời đang bị gián đoạn (HTTP {$httpFinal}).";
                    }

                    $resFinalJson = json_decode($respFinal, true);
                    $textFinal = $resFinalJson['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if (!$textFinal) {
                        return null;
                    }
                    $textFinal = $this->appendMissingDeterministicArtifacts(trim($textFinal), $collectedExportMarkdowns, $collectedStructuredTags, $suppressSingleErpCard);
                    return trim($textFinal);
                }
            }

            return null;
        } catch (\Throwable $e) {
            error_log("Call Gemini Exception: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Primary Engine: Call Groq Cloud `qwen/qwen3.8-27b` with Full Autonomous Multi-Turn Tool Calling
     * Uses AI-routed domain context & tool schemas to stay within Groq Free Tier 7,000 ITPM / 8,000 TPM while preserving 100% intelligence, Smart UI Tags & Export Parity.
     * Automatically fails over across Groq's independent model buckets (`qwen/qwen3.8-27b` -> `openai/gpt-oss-120b` -> `openai/gpt-oss-20b`) before falling back to Gemini.
     */
    private function callGroqQwenPrimary(
        array $conversationHistory,
        string $systemPrompt,
        ?array $attachedFile,
        ?array $geminiTools,
        bool $isPureConversational,
        bool $isMutationOrProposalIntent,
        string $groqKey,
        string $preferredModel,
        string $primaryDomain = 'executive_bi',
        array $matchedDomains = [],
        ?callable $onChunk = null,
        ?array $authContext = null,
        ?callable $onStep = null,
        array &$executedAgentSteps = []
    ): ?string {
        $localSteps = [];
        try {
            $isStream = is_callable($onChunk);
            $focusedSystemPrompt = $this->buildGroqFocusedSystemPrompt($systemPrompt, $primaryDomain, $matchedDomains, false);

            $messages = [
                [
                    'role' => 'system',
                    'content' => $focusedSystemPrompt
                ]
            ];

            $recentHistory = count($conversationHistory) > 4
                ? array_slice($conversationHistory, -4)
                : $conversationHistory;
            $historyCount = count($recentHistory);

            foreach ($recentHistory as $idx => $msg) {
                $isAssistant = ((int)($msg['sender_id'] ?? 0) === 9000001);
                $role = $isAssistant ? 'assistant' : 'user';
                $msgText = trim((string)($msg['content'] ?? ''));

                if ($isAssistant && $idx < $historyCount - 1 && $msgText !== '') {
                    $msgText = preg_replace('/<<<DYNAMIC_CHART:\s*[\s\S]*?>>>/', '[Đã hiển thị biểu đồ trực quan]', $msgText);
                    $msgText = preg_replace('/<<<ACTION_PROPOSAL:\s*[\s\S]*?>>>/', '[Đã xuất thẻ hành động điền sẵn]', $msgText);
                    $msgText = preg_replace('/<<<ERP_CARD:\s*[\s\S]*?>>>/', '[Đã hiển thị thẻ hồ sơ ERP]', $msgText);
                    $msgText = preg_replace('/<<<CLARIFY_OPTIONS:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = preg_replace('/<<<PROACTIVE_INSIGHT:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = preg_replace('/<<<NEXT_BEST_ACTIONS:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = preg_replace('/<<<SAVE_MEMORY:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = trim((string)preg_replace('/\n{3,}/', "\n\n", $msgText));
                    if (mb_strlen($msgText, 'UTF-8') > 700) {
                        $msgText = mb_substr($msgText, 0, 700, 'UTF-8') . '...';
                    }
                }

                if ($idx === $historyCount - 1 && !empty($attachedFile)) {
                    if (!empty($attachedFile['extractedText'])) {
                        $clippedDoc = mb_substr((string)$attachedFile['extractedText'], 0, 4500, 'UTF-8');
                        $docHeader = "--- [NỘI DUNG TÀI LIỆU ĐÍNH KÈM: " . ($attachedFile['fileName'] ?? 'Tài liệu') . "] ---\n"
                            . $clippedDoc . "\n--- [HẾT TÀI LIỆU] ---\n\n";
                        $msgText = $docHeader . $msgText;
                    }
                    // If an image is attached, Groq `qwen/qwen3.8-27b` is text-only so delegate vision turn to Gemini fallback
                    if (!empty($attachedFile['inlineData']['data']) && strpos((string)($attachedFile['inlineData']['mimeType'] ?? ''), 'image/') === 0) {
                        return null;
                    }
                }

                if ($msgText === '') {
                    $msgText = '(Tài liệu đính kèm)';
                }

                $messages[] = [
                    'role' => $role,
                    'content' => $msgText
                ];
            }

            if (count($messages) <= 1) {
                return null;
            }

            $openAiTools = (!$isPureConversational && !empty($geminiTools))
                ? $this->convertGeminiToolsToGroq($geminiTools)
                : [];

            $maxToolTurns = 4;
            $toolTurn = 0;
            $collectedExportMarkdowns = [];
            $collectedStructuredTags = [];
            $suppressSingleErpCard = false;

            while ($toolTurn < $maxToolTurns) {
                $toolTurn++;

                if (empty($openAiTools) && $toolTurn === 1 && $isStream && is_callable($onChunk)) {
                    $streamedDirect = $this->streamGroqSynthesisWithPool(
                        $groqKey,
                        $preferredModel,
                        $messages,
                        $onChunk
                    );
                    if ($streamedDirect !== null && trim($streamedDirect) !== '') {
                        return trim($streamedDirect);
                    }
                }

                $resJson = $this->executeGroqRequestWithPool(
                    $groqKey,
                    $preferredModel,
                    $messages,
                    $openAiTools,
                    !empty($openAiTools) ? 'auto' : null
                );

                if (!is_array($resJson) || empty($resJson['choices'][0]['message'])) {
                    return null;
                }

                $choiceMsg = $resJson['choices'][0]['message'];
                $directText = $this->stripReasoningTags((string)($choiceMsg['content'] ?? ''));
                $toolCalls = $choiceMsg['tool_calls'] ?? [];

                // Fallback parser if a model emitted <function=name>{...}</function> or <tool_call> in text
                if (empty($toolCalls)) {
                    if (preg_match('/<function=([a-zA-Z0-9_]+)>\s*(\{[\s\S]*?\})\s*<\/function>/', $directText, $fnMatch)) {
                        $toolCalls = [[
                            'id' => 'call_' . substr(md5(uniqid('', true)), 0, 8),
                            'type' => 'function',
                            'function' => [
                                'name' => trim($fnMatch[1]),
                                'arguments' => trim($fnMatch[2])
                            ]
                        ]];
                        $directText = trim(str_replace($fnMatch[0], '', $directText));
                    } elseif (preg_match('/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/', $directText, $tcMatch)) {
                        $tcParsed = json_decode($tcMatch[1], true);
                        if (is_array($tcParsed) && !empty($tcParsed['name'])) {
                            $toolCalls = [[
                                'id' => 'call_' . substr(md5(uniqid('', true)), 0, 8),
                                'type' => 'function',
                                'function' => [
                                    'name' => trim((string)$tcParsed['name']),
                                    'arguments' => json_encode($tcParsed['arguments'] ?? (object)[], JSON_UNESCAPED_UNICODE)
                                ]
                            ]];
                            $directText = trim(str_replace($tcMatch[0], '', $directText));
                        }
                    }
                }

                if (empty($toolCalls)) {
                    if ($directText === '') {
                        return null;
                    }
                    $executedAgentSteps = array_merge($executedAgentSteps, $localSteps);
                    $finalText = $this->appendMissingDeterministicArtifacts($directText, $collectedExportMarkdowns, $collectedStructuredTags, $suppressSingleErpCard);
                    if ($isStream && is_callable($onChunk)) {
                        $onChunk($finalText);
                    }
                    return $finalText;
                }

                // Normalize assistant tool_calls turn
                $normalizedToolCalls = [];
                foreach ($toolCalls as $tcIdx => $tc) {
                    $tcId = !empty($tc['id']) ? (string)$tc['id'] : ('call_' . $toolTurn . '_' . $tcIdx);
                    $fnName = trim((string)($tc['function']['name'] ?? ''));
                    $fnArgsRaw = $tc['function']['arguments'] ?? '{}';
                    if (is_array($fnArgsRaw)) {
                        $fnArgsRaw = json_encode($fnArgsRaw, JSON_UNESCAPED_UNICODE);
                    }
                    $normalizedToolCalls[] = [
                        'id' => $tcId,
                        'type' => 'function',
                        'function' => [
                            'name' => $fnName,
                            'arguments' => (string)$fnArgsRaw
                        ]
                    ];
                }

                $messages[] = [
                    'role' => 'assistant',
                    'content' => $directText !== '' ? $directText : '',
                    'tool_calls' => $normalizedToolCalls
                ];

                $hasTerminalActionSuccess = false;
                $allToolsInTurnAreTerminalOrReadOnly = true;
                $requiresDisambiguationSynthesis = false;
                $ctxUid = (int)($authContext['user_id'] ?? 0);
                $ctxTid = (int)($authContext['tenant_id'] ?? 1);

                foreach ($normalizedToolCalls as $fcIdx => $tcItem) {
                    $callId = $tcItem['id'];
                    $toolName = $tcItem['function']['name'];
                    $rawArgs = $tcItem['function']['arguments'];
                    $toolArgs = json_decode($rawArgs, true);
                    if (!is_array($toolArgs)) {
                        $toolArgs = [];
                    }

                    $stepId = "step_{$toolTurn}_{$fcIdx}_" . substr(md5($toolName . microtime(true)), 0, 6);
                    if (is_callable($onStep)) {
                        $onStep([
                            'type' => 'agent_step',
                            'step' => [
                                'id' => $stepId,
                                'turn' => $toolTurn,
                                'tool_name' => $toolName,
                                'status' => 'running',
                                'label' => "Đang thực thi công cụ: {$toolName}"
                            ]
                        ]);
                    }

                    $t0 = microtime(true);
                    $this->db = Database::ensureConnected($this->db);
                    $toolResult = AgentToolRegistry::executeTool($this->db, $toolName, $toolArgs, $authContext ?? []);
                    if (is_array($toolResult) && !empty($toolResult['error']) && (stripos((string)$toolResult['error'], 'gone away') !== false || stripos((string)$toolResult['error'], 'Lost connection') !== false)) {
                        $this->db = Database::reconnect();
                        $toolResult = AgentToolRegistry::executeTool($this->db, $toolName, $toolArgs, $authContext ?? []);
                    }
                    $durationMs = (int)round((microtime(true) - $t0) * 1000);

                    if ($ctxUid > 0 && is_array($toolResult)) {
                        $this->autoRecordEntityFromTool($ctxUid, $ctxTid, $toolName, $toolArgs, $toolResult);
                    }

                    $isDisambig = is_array($toolResult) && (
                        !empty($toolResult['requires_disambiguation']) ||
                        !empty($toolResult['disambiguation_required']) ||
                        ($toolResult['status'] ?? '') === 'DISAMBIGUATION_REQUIRED' ||
                        ($toolResult['status'] ?? '') === 'MISSING_INFO_REQUIRED'
                    );
                    if ($isDisambig) {
                        $requiresDisambiguationSynthesis = true;
                    }

                    if (is_array($toolResult)) {
                        foreach (['export_link_markdown', 'export_markdown'] as $expField) {
                            if (!empty($toolResult[$expField]) && is_string($toolResult[$expField])) {
                                $collectedExportMarkdowns[] = trim($toolResult[$expField]);
                            }
                        }
                        if (!empty($toolResult['dynamic_chart']) && is_array($toolResult['dynamic_chart'])) {
                            $collectedStructuredTags[] = '<<<DYNAMIC_CHART: ' . json_encode($toolResult['dynamic_chart'], JSON_UNESCAPED_UNICODE) . '>>>';
                        }
                        $rowCountReturned = (int)($toolResult['total_matching'] ?? $toolResult['total_processed'] ?? $toolResult['matched_count'] ?? 0);
                        if ($rowCountReturned > 1 && !$isDisambig) {
                            $suppressSingleErpCard = true;
                        }
                        foreach (['voice_summary_hint', 'instruction_for_ai', 'message', 'proposal_block'] as $strField) {
                            if (!empty($toolResult[$strField]) && is_string($toolResult[$strField])) {
                                if (preg_match_all('/<<<(?:DYNAMIC_CHART|ACTION_PROPOSAL|ERP_CARD):\s*[\s\S]*?>>>/', $toolResult[$strField], $tagMatches)) {
                                    foreach ($tagMatches[0] as $tagBlock) {
                                        $collectedStructuredTags[] = trim($tagBlock);
                                    }
                                }
                            }
                        }
                    }

                    $stepStatus = 'completed';
                    if ($isDisambig) {
                        $stepStatus = 'disambiguation';
                    } elseif (is_array($toolResult) && isset($toolResult['success']) && $toolResult['success'] === false) {
                        $stepStatus = 'error';
                    } elseif (is_array($toolResult) && isset($toolResult['total_matching']) && (int)$toolResult['total_matching'] === 0) {
                        $stepStatus = 'empty';
                    }

                    $stepEntry = [
                        'id' => $stepId,
                        'turn' => $toolTurn,
                        'tool_name' => $toolName,
                        'status' => $stepStatus,
                        'duration_ms' => $durationMs,
                        'label' => $isDisambig ? "Phát hiện nhiều lựa chọn cần xác nhận ({$toolName})" : "Hoàn tất tra cứu {$toolName} ({$durationMs}ms)"
                    ];
                    $localSteps[] = $stepEntry;

                    if (is_callable($onStep)) {
                        $onStep([
                            'type' => 'agent_step',
                            'step' => $stepEntry
                        ]);
                    }

                    $compactResult = $this->compactToolResultForModel($toolResult);
                    if (is_array($compactResult)) {
                        // Trim large preview arrays slightly for Groq 7K ITPM synthesis turn while preserving all summary metrics & top 10 rows
                        foreach (['preview_top_15', 'records', 'items', 'leads', 'students', 'tasks', 'expenses'] as $listKey) {
                            if (isset($compactResult[$listKey]) && is_array($compactResult[$listKey]) && count($compactResult[$listKey]) > 10) {
                                $compactResult[$listKey] = array_slice($compactResult[$listKey], 0, 10);
                            }
                        }
                        // Strip heavy dynamic_chart JSON from tool message since $collectedStructuredTags already preserves 100% of <<<DYNAMIC_CHART:...>>> deterministically
                        if (isset($compactResult['dynamic_chart'])) {
                            $compactResult['dynamic_chart'] = '[Đã tự động đính kèm biểu đồ DYNAMIC_CHART]';
                        }

                        $lockFacts = [];
                        foreach (['total_matching', 'total_leads', 'total_Filtered_Records', 'total_records', 'total_expenses_vnd', 'total_deposit_vnd', 'net_cashflow_vnd', 'total_headcount', 'created_count', 'reassigned_count'] as $k) {
                            if (isset($compactResult[$k])) {
                                $lockFacts[$k] = $compactResult[$k];
                            }
                        }
                        if (isset($compactResult['summary']) && is_array($compactResult['summary'])) {
                            foreach (['total_matching', 'total_leads', 'total_deposit_revenue_vnd', 'total_approved_expense_vnd', 'net_operating_cashflow_vnd', 'leads_with_deposit_count', 'active_headcount'] as $sk) {
                                if (isset($compactResult['summary'][$sk])) {
                                    $lockFacts[$sk] = $compactResult['summary'][$sk];
                                }
                            }
                        }
                        $compactResult['_ground_truth_lock'] = [
                            'mandate' => 'STRICT_DATABASE_GROUND_TRUTH: Bắt buộc dùng chính xác 100% con số từ kết quả SQL này. Tuyệt đối không tự cộng nhẩm lại từ preview hay bịa số liệu. Giữ nguyên link [Tải file Excel...](/export?...) và các thẻ <<<ACTION_PROPOSAL:...>>>. Không dùng emoji trong tiêu đề ###. Nếu kết quả có > 1 bản ghi, cấm sinh thẻ <<<ERP_CARD:...>>> đơn lẻ dưới bảng.',
                            'verified_metrics' => $lockFacts
                        ];
                    }

                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $callId,
                        'name' => $toolName,
                        'content' => json_encode($compactResult, JSON_UNESCAPED_UNICODE)
                    ];

                    $isActionTerminalTool = in_array($toolName, [
                        'draft_action_proposal',
                        'smart_create_or_assign_leads',
                        'smart_manage_tasks_and_subtasks',
                        'query_and_manage_projects',
                        'manage_my_hr_profile_and_requests',
                        'smart_manage_hrm_and_payroll',
                        'smart_manage_po_so_and_approvals',
                        'approve_or_reject_erp_ticket',
                        'update_task_progress_and_status',
                        'complete_task_checklist_item',
                        'quick_log_crm_activity',
                        'reassign_lead_owner',
                        'distribute_lead',
                        'compensate_consultant',
                        'toggle_consultant_shift',
                        'manage_lead_round_distribution',
                        'update_contact_pipeline',
                        'add_contact_consultation_note',
                        'attach_files_to_contact',
                        'update_contact_profile',
                        'schedule_contact_activity'
                    ], true);

                    $isReadOnlyAnalyticsTerminalTool = !$isMutationOrProposalIntent && in_array($toolName, [
                        'query_customer_student_persona_overview',
                        'query_sales_lead_performance_deck',
                        'query_crm_leads_multitier',
                        'query_finance_multitier_analytics',
                        'query_deposits_and_revenue_multitier',
                        'query_tasks_and_projects_multitier',
                        'query_and_manage_projects',
                        'query_deals_and_b2b_multitier',
                        'query_tickets_and_sla_multitier',
                        'query_hrm_workforce_and_payroll_multitier',
                        'query_inventory_and_assets_multitier',
                        'query_cross_domain_executive_synthesis',
                        'get_executive_morning_brief',
                        'get_executive_financial_pulse',
                        'get_sales_leaderboard',
                        'get_sales_performance_and_stale_leads',
                        'filter_expenses_advanced',
                        'export_crm_leads_advanced',
                        'analyze_leads_demographics_and_job_titles',
                        'get_staff_directory_advanced',
                        'query_company_attendance_and_work_hours',
                        'get_contact_360_profile',
                        'get_financial_overview',
                        'get_my_attendance_summary',
                        'get_my_payslip',
                        'get_pending_approvals',
                        'trace_approval_blocker',
                        'get_my_tasks',
                        'get_inventory_health_check',
                        'get_system_health_status',
                        'search_ideas_knowledge',
                        'get_program_details'
                    ], true);

                    $isTerminalTool = $isActionTerminalTool || $isReadOnlyAnalyticsTerminalTool;
                    if (!$isTerminalTool) {
                        $allToolsInTurnAreTerminalOrReadOnly = false;
                    }
                    if ($isTerminalTool && !$isDisambig && (!is_array($toolResult) || ($toolResult['success'] ?? true) !== false)) {
                        $hasTerminalActionSuccess = true;
                    }
                }

                if (!$allToolsInTurnAreTerminalOrReadOnly) {
                    $hasTerminalActionSuccess = false;
                }

                if ($hasTerminalActionSuccess || $requiresDisambiguationSynthesis || $toolTurn >= ($maxToolTurns - 1)) {
                    // Use compact synthesis system prompt on Turn 2 so Turn 1 + Turn 2 stay under Groq's 7,000 ITPM limit
                    $synthesisMessages = $messages;
                    $synthesisMessages[0] = [
                        'role' => 'system',
                        'content' => $this->buildGroqFocusedSystemPrompt($systemPrompt, $primaryDomain, $matchedDomains, true)
                    ];

                    $textFinal = '';
                    $alreadyStreamed = false;

                    if ($isStream && is_callable($onChunk)) {
                        $streamedText = $this->streamGroqSynthesisWithPool(
                            $groqKey,
                            $preferredModel,
                            $synthesisMessages,
                            $onChunk
                        );
                        if ($streamedText !== null && trim($streamedText) !== '') {
                            $textFinal = $this->stripReasoningTags($streamedText);
                            $alreadyStreamed = true;
                        }
                    }

                    if ($textFinal === '') {
                        $finalResJson = $this->executeGroqRequestWithPool(
                            $groqKey,
                            $preferredModel,
                            $synthesisMessages,
                            [],
                            null
                        );

                        if (!is_array($finalResJson) || empty($finalResJson['choices'][0]['message'])) {
                            return null;
                        }

                        $textFinal = $this->stripReasoningTags((string)($finalResJson['choices'][0]['message']['content'] ?? ''));
                        if ($textFinal === '') {
                            return null;
                        }
                    }

                    $executedAgentSteps = array_merge($executedAgentSteps, $localSteps);
                    $beforeArtifacts = $textFinal;
                    $textFinal = $this->appendMissingDeterministicArtifacts($textFinal, $collectedExportMarkdowns, $collectedStructuredTags, $suppressSingleErpCard);

                    if ($isStream && is_callable($onChunk)) {
                        if (!$alreadyStreamed) {
                            $onChunk($textFinal);
                        } elseif (strlen($textFinal) > strlen($beforeArtifacts)) {
                            $suffix = substr($textFinal, strlen($beforeArtifacts));
                            if ($suffix !== false && $suffix !== '') {
                                $onChunk($suffix);
                            }
                        }
                    }
                    return trim($textFinal);
                }
            }

            return null;
        } catch (\Throwable $e) {
            error_log("callGroqQwenPrimary Exception: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Build a focused, high-intelligence Domain-Scoped System Prompt (Turn 1) & Synthesis System Prompt (Turn 2)
     * Preserves 100% of Persona, Salutation, RBAC, 2-Tier Working Memory, Dynamic Runtime Context (RAG, Screen Awareness, Ambient Snapshot, ERP Lookup, Memories, Risks),
     * Active Domain Tool Rules, and Smart UI Tags while cutting redundant cross-domain prompt bloat by ~60-70%.
     */
}
