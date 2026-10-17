<?php
// zalo_inbound_processor.php - 10M Scale Optimized Zalo Logic
// MISSION-CRITICAL ASYNC HANDLER

require_once 'zalo_helpers.php';
require_once 'zalo_scoring_helper.php';
require_once 'flow_helpers.php';
require_once 'trigger_helper.php';

function handleZaloInboundJob($pdo, $payload)
{
    if (empty($payload))
        return false;

    $subId = $payload['sub_id'] ?? null;
    $zaloUserId = $payload['zalo_user_id'] ?? null;
    $oaConfigId = $payload['oa_config_id'] ?? null;
    $event = $payload['event'] ?? '';
    $msgText = $payload['message_text'] ?? '';
    $email = $payload['email'] ?? null;
    $phone = $payload['phone'] ?? null;
    $eventId = $payload['event_id'] ?? null;
    $timestamp = $payload['timestamp'] ?? time();
    $senderData = $payload['sender_data'] ?? [];

    if (!$zaloUserId || !$oaConfigId)
        return false;

    // [FIX AUDIT-16] IDEMPOTENCY CHECK
    // Check if this specific Zalo event_id has already been processed to prevent duplicates
    if ($eventId) {
        $stmtCheck = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE event_id = ? LIMIT 1");
        $stmtCheck->execute([$eventId]);
        if ($stmtCheck->fetch()) {
            return true; // Already processed
        }
    }

    // 0. FETCH OA CONFIG
    $stmtOa = $pdo->prepare("SELECT id, access_token, name, workspace_id FROM zalo_oa_configs WHERE id = ? LIMIT 1");
    $stmtOa->execute([$oaConfigId]);
    $oaConfig = $stmtOa->fetch(PDO::FETCH_ASSOC);
    if (!$oaConfig)
        return false;

    $accessToken = $oaConfig['access_token'];

    // 1. DATA EXTRACTION & PROFILE SYNC
    // [10M UPGRADE] Async Profile Sync (Moved from webhook.php to here)
    $msgEvents = ['user_send_text', 'user_send_image', 'user_send_link', 'user_send_audio', 'user_send_video', 'user_send_location', 'user_send_sticker', 'user_send_gif'];
    $interactionEvents = ['follow', 'user_submit_info', 'user_reacted_message', 'user_feedback'];

    if (in_array($event, array_merge($interactionEvents, $msgEvents))) {
        $accessToken = ensureZaloToken($pdo, $oaConfigId);
        if ($accessToken) {
            $profile = getZaloUserProfile($accessToken, $zaloUserId);
            if ($profile) {
                // [REAL-TIME SYNC] Sync to Main Subscribers (Standard fields)
                $mainId = upsertZaloSubscriber($pdo, $zaloUserId, $profile, $oaConfigId);
                if ($mainId) {
                    checkDynamicTriggers($pdo, $mainId);
                }
            }
        }
    }

    if ($email || $phone) {
        // [10M] Update Zalo specific profile
        $stmtZ = $pdo->prepare("UPDATE zalo_subscribers SET manual_email = COALESCE(manual_email, ?), phone_number = COALESCE(phone_number, ?) WHERE id = ?");
        $stmtZ->execute([$email, $phone, $subId]);
    }

    if ($subId) {
        // Link/Sync to Main Subscriber & MYERP Contact
        require_once __DIR__ . '/zalo_sync_helpers.php';
        syncZaloToMain($pdo, $subId);
    }

    // 2. BROADCAST & ZNS TRACKING (user_received_message, user_seen_message)
    if ($event === 'user_received_message' || $event === 'user_seen_message' || $event === 'user_reacted_message') {
        processZaloTrackingEvent($pdo, $event, $payload, $subId, $zaloUserId);
        return true;
    }

    // 3. STAFF REPLY TRACKING & AI PAUSE (oa_send_*)
    if ($event === 'oa_send_text') {
        processStaffReply($pdo, $event, $payload, $subId, $zaloUserId, $oaConfig);
        return true;
    }

    // --- PRE-CALCULATE SCENARIO ---
    // We must find the scenario BEFORE creating the AI conversation so we can use the EXACT same ai_chatbot_id.
    // This prevents visitor messages and AI replies from splitting into different conversations.
    $scenario = null;
    if ($event === 'follow' || in_array($event, $msgEvents)) {
        $scenario = findZaloScenario($pdo, $oaConfig, $zaloUserId, $subId, $event, $msgText);
    }

    // 4. INBOUND ACTIVITY & SCORING
    if (in_array($event, $msgEvents)) {
        logZaloMsg($pdo, $zaloUserId, 'inbound', $msgText);

        // [NEW FIX] Ensure AI Conversation exists and log visitor message to Unified Chat
        try {
            $aiPropId = null;
            if ($scenario && !empty($scenario['ai_chatbot_id'])) {
                $aiPropId = $scenario['ai_chatbot_id'];
            } else {
                $stmtProp = $pdo->prepare("SELECT ai_chatbot_id FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' AND ai_chatbot_id IS NOT NULL AND status = 'active' ORDER BY priority_override DESC, created_at DESC LIMIT 1");
                $stmtProp->execute([$oaConfigId]);
                $aiPropId = $stmtProp->fetchColumn();
            }

            // [CRITICAL FIX] If no AI reply scenario is found, fallback to any chatbot in the workspace
            // so that Unified Chat can still load and display the customer's message to human staff.
            $hasActiveAiScenario = (bool)$aiPropId;
            if (!$aiPropId) {
                $stmtFallback = $pdo->prepare("
                    SELECT c.id 
                    FROM ai_chatbots c
                    JOIN ai_chatbot_categories cat ON c.category_id = cat.id
                    JOIN workspace_users wu ON wu.user_id = cat.admin_id
                    WHERE wu.workspace_id = ? 
                    LIMIT 1
                ");
                $stmtFallback->execute([$oaConfig['workspace_id']]);
                $aiPropId = $stmtFallback->fetchColumn() ?: 'fallback_zalo_' . $oaConfigId;
            }

            if ($aiPropId) {
                $zaloVid = "zalo_" . $zaloUserId;
                $stmtConv = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1");
                $stmtConv->execute([$zaloVid, $aiPropId]);
                $convId = $stmtConv->fetchColumn();

                if (!$convId) {
                    $convId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                    // Always set to 'ai' to allow AI to reply normally. processStaffReply will handle 'human' takeover.
                    $pdo->prepare("INSERT INTO domation_ai_conversations (id, property_id, visitor_id, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, 'ai', NOW(), NOW(), NOW())")->execute([$convId, $aiPropId, $zaloVid]);
                }

                $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message, created_at) VALUES (?, 'visitor', ?, NOW())")->execute([$convId, $msgText]);
                $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$msgText, $convId]);
            }
        } catch (Exception $e) { /* silent fail */ }

        // Marker Extraction (Button Clicks captured in text)
        if ($event === 'user_send_text') {
            processMarkers($pdo, $msgText, $subId, $zaloUserId, $eventId, $oaConfig);
        }

        if ($event !== 'user_send_text') {
            updateZaloLeadScore($pdo, $zaloUserId, 'message');
            // [FIX AUDIT-16/17] Pass event_id correctly as 9th parameter
            logZaloSubscriberActivity($pdo, $subId, $event, null, "KH gửi tin nhắn (+5 điểm): $msgText", "Zalo Webhook", null, $oaConfig['workspace_id'], $eventId);
        }
    } elseif (in_array($event, $interactionEvents)) {
        $points = ($event === 'follow') ? 2 : (($event === 'user_reacted_message') ? 3 : 5);
        $scoreType = ($event === 'follow') ? 'follow' : (($event === 'user_reacted_message') ? 'reaction' : 'feedback');

        updateZaloLeadScore($pdo, $zaloUserId, $scoreType);
        // [FIX AUDIT-16/17] Pass event_id correctly
        logZaloSubscriberActivity($pdo, $subId, $event, null, "Sự kiện Zalo $event (+$points điểm)", "Zalo Webhook", null, $oaConfig['workspace_id'], $eventId);

        // Log to Main Timeline
        $stmtMain = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
        $stmtMain->execute([$zaloUserId]);
        $mainId = $stmtMain->fetchColumn();
        if ($mainId) {
            $evLabel = $event === 'follow' ? 'Follow OA' : ($event === 'user_reacted_message' ? 'Reaction' : 'Feedback');
            // [FIX AUDIT-17] Include workspace_id in logActivity call
            logActivity($pdo, $mainId, $event, null, $evLabel, "Sự kiện Zalo $event (+$points điểm)", null, null, [], $oaConfig['workspace_id']);
            if ($event === 'follow')
                triggerFlows($pdo, $mainId, 'zalo_follow', null);
        }
    }

    // 5. AUTOMATION FLOW TRIGGERS (Inbound Message Flow)
    if ($event === 'user_send_text') {
        $stmtMain = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
        $stmtMain->execute([$zaloUserId]);
        $mainId = $stmtMain->fetchColumn();
        if ($mainId) {
            triggerFlows($pdo, $mainId, 'inbound_message', $msgText);

            // Contextual ZNS Reply Check
            checkZnsReplyContext($pdo, $mainId, $zaloUserId, $msgText);
        }
    }

    // 6. SCENARIO AUTO-REPLY (Keyword, Holiday, AI)
    if ($scenario) {
        // [FIX AUDIT-16/17] Pass event_id correctly
        logZaloSubscriberActivity($pdo, $subId, 'automation_trigger', $scenario['id'], "Kích hoạt kịch bản: " . ($scenario['title'] ?? 'Auto'), $msgText, null, $oaConfig['workspace_id'], $eventId);
        sendZaloScenarioReply($pdo, $zaloUserId, $accessToken, $scenario, $msgText);
    }

    return true;
}

/**
 * Process Staff Replies, pause AI, and sync to chat history.
 */
function processStaffReply($pdo, $event, $payload, $subId, $zaloUserId, $oaConfig)
{
    if (!$subId)
        return;

    $msgText = $payload['message_text'] ?? '';
    $eventId = $payload['event_id'] ?? null;

    // Detect System/Automated Replies
    $isAutomated = (strpos($msgText, '[Automation]') === 0) || (strpos($msgText, '[System Message]') === 0);

    if (!$isAutomated) {
        // [ULTIMATE FIX] Kiểm tra đối soát với kịch bản (Scenario)
        $stmtCheckS = $pdo->prepare("SELECT id FROM zalo_automation_scenarios WHERE (content = ? OR title = ?) AND status = 'active' LIMIT 1");
        $stmtCheckS->execute([$msgText, $msgText]);
        if ($stmtCheckS->fetch()) {
            $isAutomated = true;
        }

        // [ULTIMATE FIX] Kiểm tra đối soát với Log tin nhắn hệ thống vừa gửi trong 5 phút qua
        if (!$isAutomated) {
            $stmtCheckLog = $pdo->prepare("SELECT id FROM zalo_user_messages WHERE zalo_user_id = ? AND direction = 'outbound' AND (message_text = ? OR message_text LIKE ?) AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) LIMIT 1");
            $stmtCheckLog->execute([$zaloUserId, $msgText, "%Automation%"]);
            if ($stmtCheckLog->fetch()) {
                $isAutomated = true;
            }
        }
    }

    if (!$isAutomated) {
        // Kiểm tra xem khách hàng có vừa mới Follow xong không (Trong 2 phút đầu ưu tiên kịch bảnChào mừng)
        $stmtFollow = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'follow' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) LIMIT 1");
        $stmtFollow->execute([$subId]);
        if ($stmtFollow->fetch())
            $isAutomated = true;
    }

    if (!$isAutomated) {
        $stmtFollow = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'follow' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE) LIMIT 1");
        $stmtFollow->execute([$subId]);
        if ($stmtFollow->fetch())
            $isAutomated = true;
    }

    if ($isAutomated) {
        logZaloMsg($pdo, $zaloUserId, 'outbound', "[System Message] " . $msgText);
        // [FIX AUDIT-16/17] Pass event_id correctly
        logZaloSubscriberActivity($pdo, $subId, 'system_reply', null, "System/Greeting: $msgText", "Zalo OA", null, $oaConfig['workspace_id'], $eventId);
    } else {
        logZaloMsg($pdo, $zaloUserId, 'outbound', $msgText);
        // [FIX AUDIT-16/17] Pass event_id correctly
        logZaloSubscriberActivity($pdo, $subId, 'staff_reply', null, "Tư vấn viên trả lời: $msgText", "Zalo OA", null, $oaConfig['workspace_id'], $eventId);

        // Pause AI
        $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?")->execute([$subId]);

        // Sync to Chat History UI
        syncStaffReplyToChatHistory($pdo, $zaloUserId, $msgText);
    }
}

function syncStaffReplyToChatHistory($pdo, $zaloUserId, $msgText)
{
    try {
        $zaloVid = "zalo_" . $zaloUserId;
        $stmtC = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND status != 'closed' ORDER BY last_message_at DESC LIMIT 1");
        $stmtC->execute([$zaloVid]);
        $convId = $stmtC->fetchColumn();
        if ($convId) {
            $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'human', ?)")->execute([$convId, $msgText]);
            $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$msgText, $convId]);
        }
    } catch (Exception $e) {
    }
}

/**
 * Handle Delivered/Seen events for Zalo Messages and Broadcasts.
 */
function processZaloTrackingEvent($pdo, $event, $payload, $subId, $zaloUserId)
{
    $msgId = $payload['zalo_msg_id'] ?? null;
    if (!$msgId)
        return;

    // 1. ZNS Delivery Logs
    if ($event === 'user_received_message' || $event === 'user_seen_message') {
        $newStatus = ($event === 'user_received_message') ? 'delivered' : 'seen';

        // Update ZNS Log
        $stmtUpd = $pdo->prepare("UPDATE zalo_delivery_logs SET status = ? WHERE zalo_msg_id = ? AND status != 'seen' AND status != ?");
        $stmtUpd->execute([$newStatus, $msgId, $newStatus]);

        if ($stmtUpd->rowCount() > 0) {
            // Find linked main subscriber and flow/step
            $stmtLog = $pdo->prepare("SELECT flow_id, step_id FROM zalo_delivery_logs WHERE zalo_msg_id = ? LIMIT 1");
            $stmtLog->execute([$msgId]);
            $logEntry = $stmtLog->fetch();

            if ($logEntry) {
                $stmtMain = $pdo->prepare("SELECT subscriber_id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
                $stmtMain->execute([$zaloUserId]);
                $mainId = $stmtMain->fetchColumn();

                if ($mainId) {
                    require_once __DIR__ . '/db_connect.php';
                    $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
                    $basePoints = $LSC['leadscore_zalo_interact'] ?? 3;
                    $points = ($event === 'user_received_message') ? max(1, floor($basePoints / 2)) : $basePoints;
                    $label = ($event === 'user_received_message') ? 'ZNS Delivered' : 'ZNS Seen';

                    // [FIX AUDIT-17] Include workspace_id in logActivity call
                    logActivity($pdo, $mainId, "zns_" . $newStatus, $logEntry['step_id'], 'ZNS Automation', "$label (+$points điểm)", $logEntry['flow_id'], $logEntry['flow_id'], [], $oaConfig['workspace_id']);
                    $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")->execute([$points, $mainId]);

                    if ($event === 'user_seen_message' && $logEntry['flow_id']) {
                        $pdo->prepare("UPDATE campaigns SET count_unique_opened = count_unique_opened + 1 WHERE id = ?")->execute([$logEntry['flow_id']]);
                    }
                }
            }
        }
    }

    // 2. Broadcast Tracking
    $stmtT = $pdo->prepare("SELECT id, broadcast_id, status FROM zalo_broadcast_tracking WHERE zalo_msg_id = ?");
    $stmtT->execute([$msgId]);
    $track = $stmtT->fetch();
    if ($track) {
        if ($event === 'user_seen_message' && !in_array($track['status'], ['seen', 'reacted'])) {
            $pdo->prepare("UPDATE zalo_broadcast_tracking SET status = 'seen', seen_at = NOW() WHERE id = ?")->execute([$track['id']]);
            $pdo->prepare("UPDATE zalo_broadcasts SET stats_seen = stats_seen + 1 WHERE id = ?")->execute([$track['broadcast_id']]);
            if ($subId)
                // [FIX AUDIT-17] Include workspace_id in logZaloSubscriberActivity call
                logZaloSubscriberActivity($pdo, $subId, 'seen_broadcast', $track['broadcast_id'], "Đã xem Broadcast", "Broadcast", null, $oaConfig['workspace_id']);
        } elseif ($event === 'user_reacted_message' && $track['status'] !== 'reacted') {
            $pdo->prepare("UPDATE zalo_broadcast_tracking SET status = 'reacted', reacted_at = NOW() WHERE id = ?")->execute([$track['id']]);
            $pdo->prepare("UPDATE zalo_broadcasts SET stats_reacted = stats_reacted + 1 WHERE id = ?")->execute([$track['broadcast_id']]);
            if ($subId)
                // [FIX AUDIT-17] Include workspace_id in logZaloSubscriberActivity call
                logZaloSubscriberActivity($pdo, $subId, 'reacted_broadcast', $track['broadcast_id'], "Đã tương tác Broadcast", "Broadcast", null, $oaConfig['workspace_id']);
        }
    }
}

function processMarkers($pdo, &$msgText, $subId, $zaloUserId, $eventId, $oaConfig)
{
    if (preg_match_all('/\s*\|\s*([a-zA-Z0-9_]+):([A-Za-z0-9+\/]+={0,2})/', $msgText, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $fullMarker = $match[0];
            $markerSid = $match[1];
            $markerLabel = base64_decode($match[2]);

            $msgText = trim(str_replace($fullMarker, '', $msgText));

            if ($subId) {
                // Anti-Spam: Block click if < 2 seconds
                $stmtDebounce = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'click_link' AND reference_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 2 SECOND) LIMIT 1");
                $stmtDebounce->execute([$subId, $markerSid]);
                if ($stmtDebounce->fetch())
                    continue;

                // [FIX AUDIT-16/17] Pass event_id and workspace_id correctly
                logZaloSubscriberActivity($pdo, $subId, 'click_link', $markerSid, "Click Button (+2 điểm): $markerLabel", $markerLabel, null, $oaConfig['workspace_id'], $eventId . "_click_" . $markerSid);

                $stmtMain = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                $stmtMain->execute([$zaloUserId]);
                $mainId = $stmtMain->fetchColumn();
                if ($mainId) {
                    // [FIX AUDIT-17] Include workspace_id in logActivity call
                    logActivity($pdo, $mainId, 'click_link', $markerSid, 'Zalo Button', "Click Button (+2 điểm): $markerLabel", null, null, [], $oaConfig['workspace_id']);
                    updateZaloLeadScore($pdo, $zaloUserId, 'click', $markerSid);
                }
            }
        }
    }
}

function checkZnsReplyContext($pdo, $mainId, $zaloUserId, $msgText)
{
    $stmtZns = $pdo->prepare("SELECT flow_id FROM subscriber_activity WHERE subscriber_id = ? AND type = 'zns_sent' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY created_at DESC LIMIT 1");
    $stmtZns->execute([$mainId]);
    $lastZns = $stmtZns->fetch();

    if ($lastZns) {
        require_once __DIR__ . '/db_connect.php';
        $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
        $znsRepScore = ($LSC['leadscore_zalo_interact'] ?? 3) + 2; 

        // [FIX AUDIT-17] Include workspace_id in logActivity call
        logActivity($pdo, $mainId, 'reply_zns', $lastZns['flow_id'], 'Zalo Reply', "Replied to ZNS (+$znsRepScore điểm): $msgText", $lastZns['flow_id'], null, [], $oaConfig['workspace_id']);
        $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")->execute([$znsRepScore, $mainId]);
    }
}

function findZaloScenario($pdo, $oaConfig, $zId, $subId, $event, $msgLower)
{
    $nowTime = date('H:i:s');
    $nowDay = date('w');
    $oaId = $oaConfig['id'];
    $msgLower = mb_strtolower($msgLower, "UTF-8");

    // Cooldown check for AI
    $skipAI = isAiPaused($pdo, $subId, $zId);

    // 1. Holiday
    $stmtH = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, schedule_type, active_days, start_time, end_time, holiday_start_at, holiday_end_at, priority_override, trigger_text FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'holiday' AND status = 'active'"); // [FIX P38-ZIP]
    $stmtH->execute([$oaId]);
    while ($h = $stmtH->fetch()) {
        if (isScenarioActive($h, $nowTime, $nowDay)) {
            $stmtFreq = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'automation_reply' AND reference_id = ? AND created_at >= CURDATE()");
            $stmtFreq->execute([$subId, $h['id']]);
            if (!$stmtFreq->fetch())
                return $h;
            if ($h['priority_override'])
                return null; // Block others
        }
    }

    // 2. Exact Keywords / Contains
    if ($event === 'user_send_text') {
        $stmtS = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, trigger_text, match_type, schedule_type, active_days, start_time, end_time, priority_override FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type IN ('keyword', 'ai_reply') AND status = 'active' ORDER BY created_at DESC"); // [FIX P38-ZIP]
        $stmtS->execute([$oaId]);
        $scenarios = $stmtS->fetchAll();

        foreach ($scenarios as $s) {
            if (!isScenarioActive($s, $nowTime, $nowDay))
                continue;
            if ($s['type'] === 'ai_reply' && (empty($s['trigger_text']) || $s['trigger_text'] === '*' || $s['trigger_text'] === 'default'))
                continue;

            $keywords = array_map('trim', explode(',', mb_strtolower($s['trigger_text'] ?? '', "UTF-8")));
            foreach ($keywords as $kw) {
                if ($s['match_type'] === 'contains' && mb_strpos($msgLower, $kw) !== false)
                    return $s;
                if ($s['match_type'] === 'exact' && $msgLower === $kw)
                    return $s;
            }
        }
    }

    // 3. Fallback AI / Welcome
    if ($event === 'follow') {
        $stmtW = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, schedule_type, active_days, start_time, end_time, priority_override, trigger_text FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'welcome' AND status = 'active' LIMIT 1"); // [FIX P38-ZIP]
        $stmtW->execute([$oaId]);
        $row = $stmtW->fetch();
        if ($row && isScenarioActive($row, $nowTime, $nowDay))
            return $row;
    }

    if ($event === 'user_send_text' && !$skipAI) {
        $stmtAI = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, trigger_text, schedule_type, active_days, start_time, end_time FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' AND (trigger_text IS NULL OR trigger_text = '' OR trigger_text = '*' OR trigger_text = 'default') AND status = 'active' LIMIT 1"); // [FIX] Added 'default' and missing schedule fields
        $stmtAI->execute([$oaId]);
        $rowAI = $stmtAI->fetch();
        if ($rowAI) {
            if (isScenarioActive($rowAI, $nowTime, $nowDay)) {
                return $rowAI;
            } else {
                // Log for debugging: Scenario found but inactive due to time
                file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "AI Scenario found but INACTIVE due to schedule: " . $rowAI['title'] . " (Schedule: " . $rowAI['schedule_type'] . ")\n", FILE_APPEND);
            }
        }
    }

    return null;
}

function isAiPaused($pdo, $subId, $ziloUserId)
{
    if (!$subId)
        return false;

    // Check pause timer
    $stmtP = $pdo->prepare("SELECT ai_paused_until FROM zalo_subscribers WHERE id = ?");
    $stmtP->execute([$subId]);
    $until = $stmtP->fetchColumn();
    if ($until && strtotime($until) > time())
        return true;

    // Check staff reply (2 min cooldown)
    $stmtCool = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'staff_reply' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) LIMIT 1");
    $stmtCool->execute([$subId]);
    if ($stmtCool->fetch())
        return true;

    // Check human mode
    $vid = "zalo_" . $ziloUserId;
    $stmtH = $pdo->prepare("SELECT status FROM domation_ai_conversations WHERE visitor_id = ? AND status = 'human' LIMIT 1");
    $stmtH->execute([$vid]);
    if ($stmtH->fetchColumn() === 'human')
        return true;

    return false;
}
