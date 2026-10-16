<?php
// api/chat_logic_fast.php

/**
 * checkScenario — Kiểm tra tin nhắn user có khớp với kịch bản nào không.
 *
 * Returns an associative array with:
 *   [matched => true, reply_text => '...', buttons => [...]]
 * or null if no scenario matched.
 *
 * Priority order: scenarios sorted by priority DESC (already sorted from DB).
 */
function checkScenario($pdo, $propertyId, $visitorUuid, $userMsg, $convId = null)
{
    if (empty($propertyId) || empty($userMsg)) return null;

    try {
        // Auto-migrate to support stateful scenarios
        try {
            $pdo->exec("ALTER TABLE domation_ai_conversations ADD COLUMN active_scenario_id VARCHAR(60) DEFAULT NULL, ADD COLUMN active_node_id VARCHAR(100) DEFAULT NULL");
        } catch (Exception $e) {}

        // Global toggle check
        try {
            $stmtToggle = $pdo->prepare("SELECT settings_value FROM ai_chatbot_meta_settings WHERE property_id = ? AND settings_key = 'scenarios_enabled' LIMIT 1");
            $stmtToggle->execute([$propertyId]);
            $toggleRow = $stmtToggle->fetch(PDO::FETCH_ASSOC);
            if ($toggleRow && (int)$toggleRow['settings_value'] === 0) {
                return null; // Scenarios globally disabled
            }
        } catch (Exception $e) {}

        $msgLower = mb_strtolower(trim($userMsg));

        // 1. STATEFUL MATCHING (Are we in a flow?)
        $conv = null;
        if ($convId) {
            $stmtConv = $pdo->prepare("SELECT id, active_scenario_id, active_node_id FROM domation_ai_conversations WHERE id = ? AND property_id = ? LIMIT 1");
            $stmtConv->execute([$convId, $propertyId]);
            $conv = $stmtConv->fetch(PDO::FETCH_ASSOC);
        } else {
            $stmtConv = $pdo->prepare("SELECT id, active_scenario_id, active_node_id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? ORDER BY last_message_at DESC LIMIT 1");
            $stmtConv->execute([$visitorUuid, $propertyId]);
            $conv = $stmtConv->fetch(PDO::FETCH_ASSOC);
        }

        if ($conv && !empty($conv['active_scenario_id']) && !empty($conv['active_node_id'])) {
            $scenarioId = $conv['active_scenario_id'];
            $nodeId = $conv['active_node_id'];

            $stmtFlow = $pdo->prepare("SELECT flow_data FROM ai_chatbot_scenarios WHERE id = ? AND property_id = ? AND is_active = 1");
            $stmtFlow->execute([$scenarioId, $propertyId]);
            $flowRow = $stmtFlow->fetch(PDO::FETCH_ASSOC);

            if ($flowRow && !empty($flowRow['flow_data'])) {
                $flowData = json_decode($flowRow['flow_data'], true);
                $nodes = $flowData['nodes'] ?? [];

                $currentNode = null;
                foreach ($nodes as $n) {
                    if (($n['id'] ?? '') === $nodeId) { $currentNode = $n; break; }
                }

                if ($currentNode) {
                    $matchedNextNodeId = null;
                    $buttons = $currentNode['buttons'] ?? [];
                    foreach ($buttons as $btn) {
                        if (mb_strtolower(trim($btn['label'] ?? '')) === $msgLower && !empty($btn['next_node'])) {
                            $matchedNextNodeId = $btn['next_node'];
                            break;
                        }
                    }
                    
                    // Priority 2: Wildcard fallback (*)
                    if (!$matchedNextNodeId) {
                        foreach ($buttons as $btn) {
                            if (trim($btn['label'] ?? '') === '*' && !empty($btn['next_node'])) {
                                $matchedNextNodeId = $btn['next_node'];
                                break;
                            }
                        }
                    }

                    if ($matchedNextNodeId) {
                        // Find next node
                        $nextNode = null;
                        foreach ($nodes as $n) {
                            if (($n['id'] ?? '') === $matchedNextNodeId) { $nextNode = $n; break; }
                        }
                        if ($nextNode) {
                            $pdo->prepare("UPDATE domation_ai_conversations SET active_node_id = ?, last_message_at = NOW() WHERE id = ?")->execute([$matchedNextNodeId, $conv['id']]);
                            return [
                                'matched'       => true,
                                'scenario_id'   => $scenarioId,
                                'scenario_title'=> 'Flow Step (Node: ' . $matchedNextNodeId . ')',
                                'reply_text'    => $nextNode['text'] ?? '',
                                'buttons'       => $nextNode['buttons'] ?? [],
                            ];
                        }
                    }
                    
                    // Break flow if user typed something else
                    $pdo->prepare("UPDATE domation_ai_conversations SET active_scenario_id = NULL, active_node_id = NULL WHERE id = ?")->execute([$conv['id']]);
                }
            } else {
                $pdo->prepare("UPDATE domation_ai_conversations SET active_scenario_id = NULL, active_node_id = NULL WHERE id = ?")->execute([$conv['id']]);
            }
        }

        // 2. ROOT MATCHING (Stateless entry point)
        $stmt = $pdo->prepare("
            SELECT id, title, trigger_keywords, match_mode, reply_text, buttons, flow_data
            FROM ai_chatbot_scenarios
            WHERE property_id = ? AND is_active = 1
            ORDER BY priority DESC
            LIMIT 50
        ");
        $stmt->execute([$propertyId]);
        $scenarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($scenarios)) return null;

        foreach ($scenarios as $scenario) {
            $keywords = array_filter(array_map('trim', explode(',', $scenario['trigger_keywords'] ?? '')), function($k){return mb_strlen($k)>=1;});
            if (empty($keywords)) continue;

            $matched = false;
            $mode = $scenario['match_mode'] ?? 'contains';

            if ($mode === 'contains') {
                foreach ($keywords as $kw) {
                    if (mb_stripos($msgLower, mb_strtolower($kw)) !== false) { $matched = true; break; }
                }
            } elseif ($mode === 'exact') {
                foreach ($keywords as $kw) {
                    if (mb_strtolower(trim($kw)) === $msgLower) { $matched = true; break; }
                }
            } elseif ($mode === 'regex') {
                foreach ($keywords as $pattern) {
                    $pattern = trim($pattern);
                    if (empty($pattern)) continue;
                    if ($pattern[0] !== '/') $pattern = '/' . $pattern . '/iu';
                    try { if (@preg_match($pattern, $userMsg)) { $matched = true; break; } } catch (Exception $e) {}
                }
            }

            if ($matched) {
                $buttons = [];
                if (!empty($scenario['buttons'])) {
                    $decoded = json_decode($scenario['buttons'], true);
                    if (is_array($decoded)) $buttons = $decoded;
                }
                
                $replyText = $scenario['reply_text'];
                $hasFlow = false;

                if (!empty($scenario['flow_data'])) {
                    $flowData = json_decode($scenario['flow_data'], true);
                    if (!empty($flowData['nodes']) && is_array($flowData['nodes'])) {
                        foreach ($flowData['nodes'] as $n) {
                            if (($n['id'] ?? '') === 'root') {
                                $replyText = $n['text'] ?? $replyText;
                                $buttons = $n['buttons'] ?? $buttons;
                                $hasFlow = true;
                                break;
                            }
                        }
                    }
                }

                if ($hasFlow) {
                    return [
                        'matched'       => true,
                        'scenario_id'   => $scenario['id'],
                        'scenario_title'=> $scenario['title'],
                        'reply_text'    => $replyText,
                        'buttons'       => $buttons,
                        'start_node'    => 'root'
                    ];
                }

                return [
                    'matched'       => true,
                    'scenario_id'   => $scenario['id'],
                    'scenario_title'=> $scenario['title'],
                    'reply_text'    => $replyText,
                    'buttons'       => $buttons,
                ];
            }
        }
    } catch (Exception $e) {
        error_log('[chat_logic_fast] checkScenario error: ' . $e->getMessage());
    }

    return null;
}

function getFastReply($userMsg, $settingsArr)
{
    $botName = $settingsArr['bot_name'] ?? 'Trợ lý ảo';
    $companyName = $settingsArr['company_name'] ?? 'MailFlow Pro';
    // ⚡ OPTIMIZATION: Loại bỏ các chỉ dẫn trong ngoặc để Fast Reply chính xác hơn (VD: [Trả lời ngắn gọn])
    $cleanMsgForMatch = preg_replace('/\(.*?\)|\[.*?\]/u', '', $userMsg);
    $cleanMsg = mb_strtolower(trim($cleanMsgForMatch)) ?: mb_strtolower(trim($userMsg));
    $msgLength = mb_strlen($cleanMsg);

    // Chỉ thực hiện reply nhanh nếu tin nhắn ngắn (< 8 ký tự) 
    // HOẶC khớp chính xác một từ khóa cụ thể (tránh bắt nhầm trong câu dài)

    // 1. Kiểm tra Fast Replies người dùng tự định nghĩa trong Settings
    $customFastReplies = !empty($settingsArr['fast_replies']) ? json_decode($settingsArr['fast_replies'], true) : [];
    if (is_array($customFastReplies)) {
        foreach ($customFastReplies as $cfr) {
            $pattern = trim($cfr['pattern'] ?? '');
            $reply = $cfr['reply'] ?? '';
            if (!$pattern || !$reply)
                continue;

            // Nếu người dùng nhập danh sách từ khóa
            $keywords = array_map('mb_strtolower', array_map('trim', explode(',', $pattern)));

            // Nếu khớp chính xác hoàn toàn (Exact Match)
            if (in_array($cleanMsg, $keywords)) {
                return str_replace(['{companyName}', '{botName}'], [$companyName, $botName], $reply);
            }

            // Nếu tin nhắn dài >= 8 ký tự, bỏ qua các bước kiểm tra Regex lỏng lẻo tiếp theo
            if ($msgLength >= 8)
                continue;

            // Kiểm tra Regex nếu tin nhắn ngắn
            try {
                if (strpos($pattern, ',') !== false || !preg_match('/^[\^|\/]/', $pattern)) {
                    $escKeywords = array_map('preg_quote', $keywords);
                    $regex = '/(?<!\p{L})(' . implode('|', $escKeywords) . ')(?!\p{L})/iu';
                } else {
                    $regex = '/' . str_replace('/', '\/', $pattern) . '/iu';
                }

                if (preg_match($regex, $userMsg)) {
                    return str_replace(['{companyName}', '{botName}'], [$companyName, $botName], $reply);
                }
            } catch (Exception $e) {
            }
        }
    }

    // 2. Các câu trả lời mặc định hệ thống ( Greetings, Thanks, Jokes...)
    // Áp dụng điều kiện độ dài < 8 cho các câu chào mặc định
    if ($msgLength >= 8)
        return null;

    // Pattern chào hỏi cực rộng nhưng chỉ áp dụng cho tin ngắn
    if (preg_match('/^(\s)*(chào|hi|hello|xin chào|hé lô|chào bạn|hello ad|hi ad|alo|alô)(\s+(em|bạn|ad|shop|mày|anh|chị|admin|bot|ai))?[\.!?]*$/iu', $userMsg)) {
        return "Chào bạn! Mình là trợ lý của $companyName. Mình có thể giúp gì cho bạn hôm nay ạ?";
    }

    // Cảm ơn hoặc tạm biệt
    if (preg_match('/(?<!\p{L})(tạm biệt|bye|cám ơn|cảm ơn|thanks|kêu|iu|yêu)(?!\p{L})/iu', $userMsg)) {
        if (preg_match('/(?<!\p{L})(yêu|iu)(?!\p{L})/iu', $userMsg))
            return "😊";
        return "Dạ, cảm ơn Anh Chị đã quan tâm! Chúc Anh Chị một ngày tốt lành ạ.";
    }

    // Đồng ý / OK
    if (preg_match('/^(\s)*(ok|oke|dạ|vâng|đúng|ok nhé|oke nhé)[\.!?]*$/iu', $userMsg)) {
        return "Dạ vâng ạ. Anh Chị cần hỗ trợ thêm thông tin gì không ạ?";
    }

    return null; // Không tìm thấy câu trả lời nhanh
}
