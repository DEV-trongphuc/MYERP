<?php
// api/webhook.php - TRACKING CORE V30.0 (ADVANCED ZALO AUTOMATION & DATA EXTRACTION)

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header('Content-Type: application/json; charset=utf-8');

$webhookLogFile = __DIR__ . '/webhook_debug.log';
require_once 'db_connect.php';

// [PRODUCTION SCALING FIX] db_connect.php unconditionally calls session_start().
// Since webhooks do not use sessions, this creates 1 empty session file per webhook hit,
// causing massive disk I/O and inode exhaustion under high load (millions of events).
// Destroying the session immediately cleans up the file.
if (session_status() === PHP_SESSION_ACTIVE) {
    session_destroy();
}

require_once 'zalo_helpers.php';
require_once 'zalo_scoring_helper.php';
require_once 'flow_helpers.php'; // [FIX] Moved to top — logActivity() used in Zalo webhook section before any branch-specific require

// [TIMEZONE FIX] Must be set BEFORE any date()/strtotime()/NOW() calls.
// Without this, PHP date() uses server timezone (often UTC) while MySQL NOW() uses
// its own @@global.time_zone. This mismatch causes AI Cooldown (INTERVAL 2 MINUTE)
// to compare timestamps across different timezones => silent over/under-trigger.
// Setting both sides to the same timezone guarantees consistent comparisons.
date_default_timezone_set('Asia/Ho_Chi_Minh');

mb_internal_encoding("UTF-8");

// --- ADVANCED TRACKING HELPERS ---
require_once 'tracking_helper.php';
require_once 'tracking_processor.php'; // [FIX] Required for synchronous processing
$LSC = getGlobalLeadScoreConfig($pdo);

// ---------------------------------

// [BUG-1 FIX] Self-healing Garbage Collection: register BEFORE any exit() calls.
// Previously placed at the very end of file — unreachable because exit() is called
// in multiple branches (GET handler, POST Zalo event handler, tracking redirect).
// Using register_shutdown_function() guarantees it runs on script termination
// regardless of how/where execution ends.
// [BUG-1 FIX] Background Maintenance: dispatch to worker instead of synchronous execution.
// Previously used register_shutdown_function which still blocks the PHP process.
// Now: only 1% chance to trigger, and it fires an async worker job.
if (mt_rand(1, 100) === 1) {
    try {
        dispatchQueueJob($pdo, 'low', ['action' => 'maintenance_cleanup']);
    } catch (Exception $e) {
    }
}

// --- DEBUG LOGGING ---
$input = file_get_contents('php://input');
$method = $_SERVER['REQUEST_METHOD'];
$zaloLogFile = __DIR__ . '/zalo_debug.log';
// [FIX QUAL-4] Only log POST events (Zalo webhook messages) to zalo_debug.log.
// Previously ALL requests were logged — including GET tracking pixels (open/click).
// With high email volume, this caused zalo_debug.log to grow hundreds of MB/hour.
// GET tracking requests have their own webhook_debug.log — no need to double-log here.
if ($method === 'POST') {
    file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "POST | Payload: " . (strlen($input) > 2048 ? substr($input, 0, 2048) . '...[truncated]' : ($input ?: 'EMPTY')) . "\n", FILE_APPEND);
}

if ($method === 'GET' && !isset($_GET['type'])) {
    // checkZaloAutomationSchema($pdo); // REMOVED: High-overhead redundant ALTER TABLE
    echo "<h1>MailFlow Pro - Zalo Webhook Listener</h1>";
    echo "<p>Status: <b style='color:green;'>ACTIVE</b></p>";
    echo "<p>Time: " . date('Y-m-d H:i:s') . "</p>";
    echo "<p>Log status: " . (file_exists($zaloLogFile) ? "✅ Logged" : "❌ Log Fail") . "</p>";
    exit;
}
// checkZaloAutomationSchema($pdo); // REMOVED: High-overhead redundant ALTER TABLE

if ($method === 'POST') {
    // [EARLY ABORT / DDOS MITIGATION] Vòng 98: Reject requests > 1MB or malformed before touching DB
    if (strlen($input) > 1048576) {
        http_response_code(413);
        exit('Payload Too Large');
    }

    $data = json_decode($input, true);
    if (!$data) {
        http_response_code(400);
        exit('Invalid JSON');
    }

    // [SECURITY AUDIT] Zalo V3 Signature Verification
    // [ULTIMATE ROBUST HEADER FETCH]
    $allHeaders = function_exists('getallheaders') ? getallheaders() : $_SERVER;
    foreach ($allHeaders as $name => $value) {
        $nameLower = strtolower($name);
        if ($nameLower === 'x-zevent-signature' || $nameLower === 'x-zalo-signature' || $nameLower === 'http_x_zevent_signature' || $nameLower === 'http_x_zalo_signature') {
            $signature = $value;
        }
        if ($nameLower === 'x-zalo-timestamp' || $nameLower === 'http_x_zalo_timestamp') {
            $timestamp = $value;
        }
    }
    if (empty($timestamp)) $timestamp = $data['timestamp'] ?? '';
    
    $zaloOaId = $data['oa_id'] ?? $data['recipient']['id'] ?? null;

    if ($zaloOaId) {
        // Fetch config early for signature check
        $stmtConfig = $pdo->prepare("SELECT id, oa_id, app_id, app_secret, access_token, name, workspace_id FROM zalo_oa_configs WHERE oa_id = ? LIMIT 1");
        $stmtConfig->execute([$zaloOaId]);
        $oaConfig = $stmtConfig->fetch(PDO::FETCH_ASSOC);

        if ($oaConfig) {
            // [SECURITY-BYPASS] Signature verification disabled as per user request to ensure reliability.
            $isValid = true; 

            if ($isValid) {
                // Continue processing...
            }
        } else {
            // [FIX NM-03] Unknown OA ID — reject instead of silently continuing.
            // Previously: logged warning and continued processing unsigned payload.
            // Now: reject with 400 to prevent forged events with non-existent oa_id.
            $warnMsg = "[SECURITY] Rejected webhook — No OA Config for ID: $zaloOaId. Possible forged event.";
            file_put_contents($webhookLogFile, date('[Y-m-d H:i:s] ') . $warnMsg . "\n", FILE_APPEND);
            http_response_code(400);
            exit(json_encode(['status' => 'error', 'reason' => 'unknown_oa_id']));
        }
    }

    if (isset($data['event_name']) || isset($data['sender']['id'])) {
        // Advanced ID Resolution
        $zaloOaId = $data['oa_id'] ?? $data['recipient']['id'] ?? null;
        $timestamp = $data['timestamp'] ?? time();
        $event = $data['event_name'] ?? '';

        // [FIX] Correct ID Resolution for Outbound (Staff) Events
        if (strpos($event, 'oa_send_') === 0) {
            $zaloUserId = $data['recipient']['id'] ?? null;
            $zaloOaId = $data['sender']['id'] ?? $zaloOaId;
        } else {
            $zaloUserId = $data['sender']['id'] ?? ($data['follower']['id'] ?? ($data['user_id'] ?? ($data['fromuid'] ?? null)));
        }

        $eventId = $data['message']['msg_id'] ?? ($event . "_" . $timestamp . "_" . $zaloUserId);

        if ($zaloUserId && $zaloOaId) {
            $msgEvents = ['user_send_text', 'user_send_image', 'user_send_link', 'user_send_audio', 'user_send_video', 'user_send_location', 'user_send_sticker', 'user_send_gif'];
            $interactionEvents = ['follow', 'unfollow', 'user_submit_info', 'user_reacted_message', 'user_feedback', 'user_seen_message', 'user_received_message'];
            $staffEvents = ['oa_send_text', 'oa_send_image', 'oa_send_list', 'oa_send_gif'];
            $allowedEvents = array_merge($msgEvents, $interactionEvents, $staffEvents);

            if (in_array($event, $allowedEvents)) {
                try {
                    // Re-use fetched config if already loaded during signature check
                    if (!isset($oaConfig) || !$oaConfig || !isset($oaConfig['id'])) {
                        $stmt = $pdo->prepare("SELECT id, oa_id, app_id, app_secret, access_token, name, workspace_id FROM zalo_oa_configs WHERE oa_id = ? LIMIT 1");
                        $stmt->execute([$zaloOaId]);
                        $oaConfig = $stmt->fetch(PDO::FETCH_ASSOC);
                    }

                    // [TRACE] OA lookup result
                    file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] Event=$event OA_ID=$zaloOaId User=$zaloUserId MsgID=$eventId OAFound=" . ($oaConfig ? $oaConfig['name'] : 'NULL') . "\n", FILE_APPEND);

                    if ($oaConfig) {
                        // [SECURE FIX] Add Idempotency Lock for Zalo Events to prevent duplicate AI triggers
                        $lockName = "zalo_msg_" . md5($eventId);
                        $lockResult = db_get_lock($pdo, $lockName, 3);
                        if (!$lockResult) {
                            file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ⛔ Lock timeout — concurrent processing\n", FILE_APPEND);
                            echo json_encode(['status' => 'lock_timeout', 'reason' => 'concurrent_processing']);
                            exit;
                        }

                        $stmtCheck = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE zalo_msg_id = ? LIMIT 1");
                        $stmtCheck->execute([$eventId]);
                        if ($stmtCheck->fetchColumn()) {
                            file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ⛔ Duplicate event, skipping\n", FILE_APPEND);
                            db_release_lock($pdo, $lockName);
                            echo json_encode(['status' => 'ignored', 'reason' => 'duplicate']);
                            exit;
                        }  // end idempotency check

                        if (in_array($event, array_merge(['follow', 'user_submit_info', 'user_reacted_message', 'user_feedback'], $msgEvents))) {
                            $accessToken = ensureZaloToken($pdo, $oaConfig['id']);
                            if ($accessToken) {
                                $profile = getZaloUserProfile($accessToken, $zaloUserId);
                                if ($profile) {
                                    if (!isset($data['sender']))
                                        $data['sender'] = [];
                                    $data['sender']['display_name'] = $profile['display_name'] ?? ($profile['name'] ?? '');
                                    $data['sender']['avatar'] = $profile['avatar'] ?? '';

                                    // Capture real follower status from Zalo Profile
                                    if (isset($profile['user_is_follower'])) {
                                        $data['sender']['user_is_follower'] = $profile['user_is_follower'] ? 1 : 0;
                                    }

                                    // [FIX BUG-ZH-1 call-site] Pass oaConfigId so workspace_id is resolved correctly
                                    $mainId = upsertZaloSubscriber($pdo, $zaloUserId, $profile, $oaConfig['id']);
                                    if ($mainId) {
                                        require_once 'trigger_helper.php';
                                        checkDynamicTriggers($pdo, $mainId);
                                    }
                                }
                            }
                        }

                        $subId = upsertZaloSubscriberWebhook($pdo, $zaloUserId, $data, $oaConfig['id'], $oaConfig['name'], $event, $oaConfig['workspace_id']);

                        // [OPTIMIZATION] Send Response Immediately to avoid Timeout
                        if (function_exists('fastcgi_finish_request')) {
                            while (ob_get_level() > 0)
                                ob_end_clean();
                            echo json_encode(['status' => 'success']);
                            fastcgi_finish_request();
                        } else {
                            // PHP-FPM not available, output buffer flush
                            ignore_user_abort(true);
                            while (ob_get_level() > 0)
                                ob_end_clean();
                            ob_start();
                            echo json_encode(['status' => 'success']);
                            $size = ob_get_length();
                            header('Connection: close');
                            header('Content-Encoding: none');
                            header("Content-Length: $size");
                            ob_end_flush();
                            flush();
                            if (session_id())
                                session_write_close();
                        }

                        // --- 1. DATA EXTRACTION LOGIC (Email & Phone) ---
                        if ($subId && ($event === 'user_send_text' || $event === 'user_submit_info')) {
                            $msgText = $data['message']['text'] ?? '';
                            $email = null;
                            $phone = $data['info']['phone'] ?? null; // user_submit_info

                            // Extraction Regex from Text if not explicit
                            if (!$phone && isset($data['message']['text'])) {
                                if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $msgText, $matches))
                                    $email = $matches[0];
                                if (preg_match('/(0|\+84)[3|5|7|8|9][0-9]{8}/', $msgText, $matches))
                                    $phone = $matches[0];
                            }

                            // Validate phone if found
                            if ($phone) {
                                // Normalize phone (using simple regex here or helper if available)
                                // We'll keep it simple: Ensure it starts with 0 or +84
                            }
                            if ($email || $phone) {
                                // 10M UPGRADE: Async Profile Sync & Linking
                                dispatchQueueJob($pdo, 'sync_zalo_profile', [
                                    'sub_id' => $subId,
                                    'zalo_user_id' => $zaloUserId,
                                    'email' => $email,
                                    'phone' => $phone,
                                    'display_name' => $data['sender']['display_name'] ?? ($data['info']['display_name'] ?? null),
                                    'avatar' => $data['sender']['avatar'] ?? null,
                                    'event_id' => $eventId
                                ]);
                            }
                        }

                        if ($subId && !in_array($event, ['user_send_text', 'sent_message'])) {
                            $pointLabel = "";
                            if ($event === 'follow') {
                                $pointLabel = " (+2 điểm)";
                                updateZaloLeadScore($pdo, $zaloUserId, 'follow');

                                // Welcome Scenario
                                if ($oaConfig) {
                                    $stmtW = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, schedule_type, active_days, start_time, end_time, priority_override, trigger_text FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'welcome' AND status = 'active' LIMIT 1"); // [FIX P38-WH] Explicit columns
                                    $stmtW->execute([$oaConfig['id']]);
                                    $welcome = $stmtW->fetch(PDO::FETCH_ASSOC);
                                    if ($welcome) {
                                        $accessToken = ensureZaloToken($pdo, $oaConfig['id']);
                                        sendZaloScenarioReply($pdo, $zaloUserId, $accessToken, $welcome, '', $oaConfig['workspace_id']);
                                    }
                                }
                            }
                            if ($event === 'user_reacted_message') {
                                $pointLabel = " (+3 điểm)";
                                updateZaloLeadScore($pdo, $zaloUserId, 'reaction');
                            }
                            if ($event === 'user_feedback') {
                                $pointLabel = " (+5 điểm)";
                                updateZaloLeadScore($pdo, $zaloUserId, 'feedback');
                            }
                            logZaloSubscriberActivity($pdo, $subId, $event, null, "Sự kiện Zalo $event{$pointLabel}", "Zalo Webhook", $eventId, $oaConfig['workspace_id']);

                            // Also log to Main Timeline for high-value events
                            if (in_array($event, ['follow', 'user_reacted_message', 'user_feedback'])) {
                                $stmtMainEv = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                                $stmtMainEv->execute([$zaloUserId]);
                                $mainIdEv = $stmtMainEv->fetchColumn();
                                if ($mainIdEv) {
                                    $evLabel = $event === 'follow' ? 'Follow OA' : ($event === 'user_reacted_message' ? 'Reaction' : 'Feedback');
                                    logActivity($pdo, $mainIdEv, $event, null, $evLabel, "Sự kiện Zalo $event{$pointLabel}", null, null, [], $oaConfig['workspace_id']);

                                    if ($event === 'follow') {
                                        require_once 'trigger_helper.php';
                                        triggerFlows($pdo, $mainIdEv, 'zalo_follow', null);
                                    }
                                }
                            }

                            // Track ZNS Delivered
                            if ($event === 'user_received_message') {
                                // Find linked main subscriber
                                $stmtLink = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                                $stmtLink->execute([$zaloUserId]);
                                $linkedSubId = $stmtLink->fetchColumn();

                                if ($linkedSubId) {
                                    $msgId = $data['message']['msg_id'] ?? null;
                                    if ($msgId) {
                                        // Update ZNS Log status to 'delivered' (Scoped by workspace_id)
                                        $pdo->prepare("UPDATE zalo_delivery_logs SET status = 'delivered' WHERE zalo_msg_id = ? AND workspace_id = ? AND status NOT IN ('delivered', 'seen')")->execute([$msgId, $oaConfig['workspace_id']]);
                                    }

                                    // Find recent ZNS sent in flow (within last 15 minutes to be safe)
                                    $stmtFlow = $pdo->prepare("
                                        SELECT q.id, q.flow_id, q.step_id, f.name as flow_name
                                        FROM subscriber_flow_states q
                                        JOIN flows f ON f.id = q.flow_id
                                        WHERE q.subscriber_id = ? 
                                        AND q.status = 'waiting'
                                        AND q.updated_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
                                        ORDER BY q.updated_at DESC
                                        LIMIT 1
                                    ");
                                    $stmtFlow->execute([$linkedSubId]);
                                    $enrollment = $stmtFlow->fetch(PDO::FETCH_ASSOC);

                                    if ($enrollment) {
                                        // Log activity for main subscriber
                                        require_once 'flow_helpers.php';
                                        $znsDelScore = max(1, floor($LSC['leadscore_zalo_interact'] / 2));
                                        logActivity($pdo, $linkedSubId, 'zns_delivered', $enrollment['step_id'], $enrollment['flow_name'], "ZNS Delivered (+$znsDelScore điểm)", $enrollment['flow_id'], $enrollment['flow_id'], [], $oaConfig['workspace_id']);
                                        $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ? AND workspace_id = ?")->execute([$znsDelScore, $linkedSubId, $oaConfig['workspace_id']]);
                                    }
                                }
                            }

                            // Track ZNS Seen
                            if ($event === 'user_seen_message') {
                                // Find linked main subscriber
                                $stmtLink = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                                $stmtLink->execute([$zaloUserId]);
                                $linkedSubId = $stmtLink->fetchColumn();

                                if ($linkedSubId) {
                                    $msgId = $data['message']['msg_id'] ?? null;
                                    if ($msgId) {
                                        // Update ZNS Log status to 'seen' (Scoped by workspace_id)
                                        $stmtUpd = $pdo->prepare("UPDATE zalo_delivery_logs SET status = 'seen' WHERE zalo_msg_id = ? AND workspace_id = ? AND status != 'seen'");
                                        $stmtUpd->execute([$msgId, $oaConfig['workspace_id']]);

                                        if ($stmtUpd->rowCount() > 0) {
                                            // Find campaign/flow associated with this message
                                            $stmtMsg = $pdo->prepare("SELECT flow_id, step_id FROM zalo_delivery_logs WHERE zalo_msg_id = ? LIMIT 1");
                                            $stmtMsg->execute([$msgId]);
                                            $logEntry = $stmtMsg->fetch(PDO::FETCH_ASSOC);

                                            if ($logEntry && $logEntry['flow_id']) {
                                                // [FIX BUG-C1] zalo_delivery_logs.flow_id might store a FLOW ID,
                                                // NOT a campaign ID. Blindly updating campaigns table with an
                                                // unmatched ID causes silent data corruption.
                                                // Verify it's actually a campaign before updating.
                                                $stmtVerifyCamp = $pdo->prepare("SELECT id FROM campaigns WHERE id = ? AND workspace_id = ? LIMIT 1");
                                                $stmtVerifyCamp->execute([$logEntry['flow_id'], $oaConfig['workspace_id']]);
                                                if ($stmtVerifyCamp->fetchColumn()) {
                                                    $pdo->prepare("UPDATE campaigns SET count_unique_opened = count_unique_opened + 1 WHERE id = ? AND workspace_id = ?")->execute([$logEntry['flow_id'], $oaConfig['workspace_id']]);
                                                }

                                                // Log activity
                                                require_once 'flow_helpers.php';
                                                $znsSeenScore = $LSC['leadscore_zalo_interact'];
                                                logActivity($pdo, $linkedSubId, 'zns_seen', $logEntry['step_id'], 'ZNS', "ZNS Seen (+$znsSeenScore điểm)", $logEntry['flow_id'], $logEntry['flow_id'], [], $oaConfig['workspace_id']);
                                                $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ? AND workspace_id = ?")->execute([$znsSeenScore, $linkedSubId, $oaConfig['workspace_id']]);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // --- [NEW] STAFF REPLY TRACKING ---
                        if ($subId && $event === 'oa_send_text') {
                            $staffMsg = $data['message']['text'] ?? '[' . strtoupper(str_replace('oa_send_', '', $event)) . ']';

                            // [KEY FIX] Fix Zalo Human vs Bot parsing since Zalo API doesn't give admin_id reliably
                            $hasAdminId = !empty($data['sender']['admin_id']);

                            // [FIX] Ensure we correctly detect human agents. Since Zalo sometimes omits admin_id for OA reps,
                            // we must assume it's human UNLESS we explicitly sent it just now in our DB.
                            $isAutomated = (strpos($staffMsg, '[Automation]') === 0);

                            if (!$hasAdminId && !$isAutomated) {
                                // It doesn't have an admin_id, BUT it could still be a human using Zalo OA Web.
                                // Let's check if AutoFlow JUST sent this exact message.
                                $stmtCheck = $pdo->prepare("SELECT id FROM zalo_user_messages WHERE zalo_user_id = ? AND direction = 'outbound' AND message_text IN (?, ?) AND created_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE) LIMIT 1");
                                $stmtCheck->execute([$zaloUserId, $staffMsg, "[Automation] " . $staffMsg]);
                                if ($stmtCheck->fetch()) {
                                    $isAutomated = true; // Yes, we generated this. Not a human takeover.
                                } else {
                                    $isAutomated = false; // We didn't send it. Must be a human rep on Zalo OA app!
                                }
                            }

                            if (!$isAutomated) {
                                // [PRO-FIX] Robust Detection of Zalo System Greeting Messages
                                // Case 1: Message sent within 30s of a 'follow' event.
                                // Case 2: Message sent but the user has NEVER sent an inbound message yet (Zalo auto-greeting).
                                try {
                                    $stmtFollowCheck = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'follow' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 SECOND) LIMIT 1");
                                    $stmtFollowCheck->execute([$subId]);
                                    $isRecentFollow = (bool) $stmtFollowCheck->fetch();

                                    $stmtMsgCheck = $pdo->prepare("SELECT COUNT(*) FROM zalo_user_messages WHERE zalo_user_id = ? AND direction = 'inbound'");
                                    $stmtMsgCheck->execute([$zaloUserId]);
                                    $inboundCount = (int) $stmtMsgCheck->fetchColumn();

                                    if ($isRecentFollow || $inboundCount === 0) {
                                        // Log to chat history as system outbound but DONT pause automation
                                        logZaloMsg($pdo, $zaloUserId, 'outbound', "[System Message] " . $staffMsg, $oaConfig['workspace_id']);
                                        // Log as system_reply instead of staff_reply
                                        logZaloSubscriberActivity($pdo, $subId, 'system_reply', null, "Zalo System/Greeting: $staffMsg", "Zalo Official Account", $eventId, $oaConfig['workspace_id']);
                                        $isAutomated = true; // Skip human logic below
                                    }
                                } catch (Exception $e) { /* ignore */
                                }
                            }

                            if (!$isAutomated) {
                                // Log to chat history as outbound
                                logZaloMsg($pdo, $zaloUserId, 'outbound', $staffMsg, $oaConfig['workspace_id']);
                                // Log to activity timeline as staff_reply (CRITICAL for AI Cooldown)
                                logZaloSubscriberActivity($pdo, $subId, 'staff_reply', null, "Tư vấn viên trả lời: $staffMsg", "Zalo Official Account", $eventId, $oaConfig['workspace_id']);

                                // [NEW] Sync human reply to AI History
                                try {
                                    // 1. Always Pause Subscriber AI for 30 minutes
                                    $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ? AND workspace_id = ?")->execute([$subId, $oaConfig['workspace_id']]);

                                    // 2. Add log for debug tool
                                    file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "Human Zalo Reply Detected -> Pausing AI for Sub $subId\n", FILE_APPEND);

                                    $zaloVid = "zalo_" . $zaloUserId;
                                    // Find recent active conversation
                                    $stmtC = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND status != 'closed' ORDER BY last_message_at DESC LIMIT 1");
                                    $stmtC->execute([$zaloVid]);
                                    $convId = $stmtC->fetchColumn();
                                    if ($convId) {
                                        $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'human', ?)")->execute([$convId, $staffMsg]);
                                        // [MODIFIED] Update last message but keep AI status (Auto-Resume). 
                                        $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$staffMsg, $convId]);
                                    }
                                } catch (Exception $e) { /* ignore */
                                }
                            }
                        }


                        if ($subId && in_array($event, $msgEvents)) {
                            $msgText = $data['message']['text'] ?? '[' . strtoupper(str_replace('user_send_', '', $event)) . ']';
                            logZaloMsg($pdo, $zaloUserId, 'inbound', $msgText, $oaConfig['workspace_id']);

                            // [REDUNDANCY FIX] Skip individual timeline/lead score for text events (batched later)
                            // Other events like user_send_image still log immediately.
                            if ($event !== 'user_send_text') {
                                updateZaloLeadScore($pdo, $zaloUserId, 'message');
                                logZaloSubscriberActivity($pdo, $subId, $event, null, "KH gửi tin nhắn: $msgText", "Zalo Webhook", $eventId, $oaConfig['workspace_id']);
                            }

                            // [NEW] Sync Inbound Message to AI Chat History (Fix Empty List)
                            try {
                                // Find associated Property ID (Chatbot ID) from Default AI Scenario
                                $stmtProp = $pdo->prepare("SELECT ai_chatbot_id FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' AND ai_chatbot_id IS NOT NULL AND status = 'active' ORDER BY priority_override DESC, created_at DESC LIMIT 1");
                                $stmtProp->execute([$oaConfig['id']]);
                                $aiPropId = $stmtProp->fetchColumn();

                                // Fallback to any chatbot in workspace if no AI scenario found
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
                                    $aiPropId = $stmtFallback->fetchColumn();
                                }

                                if ($aiPropId) {
                                    $zaloVid = "zalo_" . $zaloUserId;

                                    // Check/Create Conversation
                                    $stmtConv = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? LIMIT 1");
                                    $stmtConv->execute([$zaloVid, $aiPropId]);
                                    $convId = $stmtConv->fetchColumn();

                                    if (!$convId) {
                                        // Generate UUID v4
                                        $convId = sprintf(
                                            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                                            mt_rand(0, 0xffff),
                                            mt_rand(0, 0xffff),
                                            mt_rand(0, 0xffff),
                                            mt_rand(0, 0x0fff) | 0x4000,
                                            mt_rand(0, 0x3fff) | 0x8000,
                                            mt_rand(0, 0xffff),
                                            mt_rand(0, 0xffff),
                                            mt_rand(0, 0xffff)
                                        );
                                        $pdo->prepare("INSERT INTO domation_ai_conversations (id, property_id, visitor_id, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, 'ai', NOW(), NOW(), NOW())")->execute([$convId, $aiPropId, $zaloVid]);
                                    }

                                    // [CRITICAL FIX] Insert visitor message into domation_ai_messages (This was completely missing!)
                                    $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message, created_at) VALUES (?, 'visitor', ?, NOW())")->execute([$convId, $msgText]);

                                    // Update Conversation Last Message (So it appears in list immediately)
                                    $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$msgText, $convId]);
                                    // Note: domation_ai_conversations ID is a UUID and lacks workspace_id in current schema, but it's visitor-linked.
                                }
                            } catch (Exception $e) { /* ignore */
                            }

                            // Also log to Main Timeline
                            $stmtMainMsg = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                            $stmtMainMsg->execute([$zaloUserId]);
                            $mainIdMsg = $stmtMainMsg->fetchColumn();
                            if ($mainIdMsg) {
                                logActivity($pdo, $mainIdMsg, 'user_send_text', null, 'Zalo Message', "KH gửi tin nhắn: $msgText", null, null, [], $oaConfig['workspace_id']);
                            }
                        }

                        // --- 2. ZALO AUTOMATION LOGIC ---
                        if (($event === 'follow' || in_array($event, $msgEvents)) && $oaConfig['id']) {
                            $scenario = null;
                            // [BUG-2 FIX] Initialize $msgText early to avoid "Undefined variable" notice.
                            // For 'follow' events, no message text exists — $msgText must be '' not undefined,
                            // since sendZaloScenarioReply() receives it as a parameter at line ~777.
                            $msgText = $msgText ?? '';
                            $nowTime = date('H:i:s');
                            $nowDay = date('w'); // 0 (Sun) to 6 (Sat)
                            if ($nowDay == 0)
                                $nowDay = 0; // consistent with our mapping

                            // --- [NEW] AI AUTOMATION COOLDOWN & HUMAN TAKEOVER CHECK ---
                            $skipAI = false;
                            if ($subId && $oaConfig['id']) {
                                try {
                                    // 1. Check if staff recently replied (2 min cooldown)
                                    $stmtCool = $pdo->prepare("
                                        SELECT a.id 
                                        FROM zalo_subscriber_activity a
                                        WHERE a.subscriber_id = ? 
                                        AND a.type = 'staff_reply'
                                        AND a.created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
                                        LIMIT 1
                                    ");
                                    $stmtCool->execute([$subId]);
                                    if ($stmtCool->fetchColumn()) {
                                        $skipAI = true;
                                    }

                                    // 2. Check if conversation is in Human mode
                                    $zaloVid = "zalo_" . $zaloUserId;
                                    $stmtHuman = $pdo->prepare("SELECT status FROM domation_ai_conversations WHERE visitor_id = ? AND status = 'human' LIMIT 1");
                                    $stmtHuman->execute([$zaloVid]);
                                    if ($stmtHuman->fetchColumn() === 'human') {
                                        $skipAI = true;
                                    }

                                    // 3. Check AI Pause Timer
                                    $stmtPause = $pdo->prepare("SELECT ai_paused_until FROM zalo_subscribers WHERE id = ?");
                                    $stmtPause->execute([$subId]);
                                    $pausedUntil = $stmtPause->fetchColumn();
                                    if ($pausedUntil && strtotime($pausedUntil) > time()) {
                                        $skipAI = true;
                                    }

                                    // 4. [FLOW-AWARENESS] Silences AI if subscriber is active in an automation flow
                                    // [DISABLED 2026-04-17] This causes AI to stop replying permanently if human agent enrolled them in an email flow!
                                    /*
                                    if (!$skipAI) {
                                        $stmtFlowCheck = $pdo->prepare("
                                             SELECT 1 FROM subscriber_flow_states sfs
                                             JOIN subscribers s ON sfs.subscriber_id = s.id
                                             JOIN zalo_subscribers zs ON zs.zalo_user_id = s.zalo_user_id
                                             WHERE zs.zalo_user_id = ? AND sfs.status IN ('waiting', 'processing')
                                             LIMIT 1
                                         ");
                                        $stmtFlowCheck->execute([$zaloUserId]);
                                        if ($stmtFlowCheck->fetch()) {
                                            $skipAI = true;
                                        }
                                    }
                                    */

                                    // 5. [ANTI-SPAM INFINITE LOOP] Vòng 96: Prevent User Bot vs AI Bot Loop
                                    // If user sent >= 15 messages in the last 1 minute (Ping-pong loop), pause AI
                                    if (!$skipAI) {
                                        $stmtSpam = $pdo->prepare("
                                            SELECT COUNT(*) FROM zalo_subscriber_activity 
                                            WHERE subscriber_id = ? AND type = 'user_send_text' 
                                            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                                        ");
                                        $stmtSpam->execute([$subId]);
                                        if ((int) $stmtSpam->fetchColumn() >= 15) {
                                            $skipAI = true;
                                            $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ? AND workspace_id = ?")->execute([$subId, $oaConfig['workspace_id']]);
                                            @file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "ANTI-SPAM LOOP TRIPPED for $zaloUserId. Paused AI for 30 mins.\n", FILE_APPEND);
                                        }
                                    }
                                } catch (Exception $e) {
                                    // Fallback if schema mismatch during JOIN
                                }
                            }
                            // ------------------------------------------

                            file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] skipAI=$skipAI event=$event\n", FILE_APPEND);

                            if ($event === 'follow') {
                                $stmtS = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, schedule_type, active_days, start_time, end_time, priority_override, trigger_text FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'welcome' AND status = 'active' LIMIT 1"); // [FIX P38-WH] Explicit columns
                                $stmtS->execute([$oaConfig['id']]);
                                $row = $stmtS->fetch(PDO::FETCH_ASSOC);
                                if ($row && isScenarioActive($row, $nowTime, $nowDay))
                                    $scenario = $row;
                            } elseif ($event === 'user_send_text' && isset($data['message']['text'])) {
                                // [BATCH MESSAGE LOGIC] Debounce — collect all messages sent within ~1s
                                // Context: Users often send 2-3 short messages in quick succession.
                                // We want to treat them as ONE combined message for automation.
                                //
                                // [SLEEP FIX] Original code: sleep(1) BEFORE sending HTTP response to Zalo.
                                // Problem: 100 simultaneous Zalo webhooks = 100 PHP-FPM workers frozen
                                // for 1s each, holding open connections => Gateway Timeout 504.
                                //
                                // Fix: HTTP response is ALREADY sent above via fastcgi_finish_request()
                                // or ob_end_flush()+flush(). So usleep() happens AFTER Zalo is happy.
                                // The delay is pure background processing, not blocking any HTTP connection.
                                //
                                // STEP 1: Save current message to queue FIRST (must happen before sleep!)
                                $rawMsg = trim($data['message']['text']);
                                $pdo->prepare("INSERT INTO zalo_message_queue (zalo_user_id, message_text) VALUES (?, ?)")
                                    ->execute([$zaloUserId, $rawMsg]);

                                // STEP 1.1: Fast Path Check (Keywords & Payloads)
                                // If message matches a keyword or button payload exactly, bypass the 1s wait.
                                $isFastPath = false;
                                $msgLower = mb_strtolower($rawMsg, "UTF-8");

                                // Check Keywords
                                $stmtFast = $pdo->prepare("SELECT trigger_text, match_type FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'keyword' AND status = 'active'");
                                $stmtFast->execute([$oaConfig['id']]);
                                while ($fs = $stmtFast->fetch()) {
                                    $kws = array_map('trim', explode(',', mb_strtolower($fs['trigger_text'] ?? '', "UTF-8")));
                                    foreach ($kws as $kw) {
                                        if ($fs['match_type'] === 'exact' && $msgLower === $kw) {
                                            $isFastPath = true;
                                            break 2;
                                        }
                                    }
                                }

                                // Check Button Payloads (Instant feedback for UI actions)
                                if (!$isFastPath) {
                                    $stmtP = $pdo->prepare("SELECT buttons FROM zalo_automation_scenarios WHERE oa_config_id = ? AND status = 'active' AND buttons IS NOT NULL");
                                    $stmtP->execute([$oaConfig['id']]);
                                    while ($pr = $stmtP->fetch()) {
                                        $btns = json_decode($pr['buttons'] ?? '[]', true);
                                        foreach ($btns as $b) {
                                            if (isset($b['payload']) && mb_strtolower(trim($b['payload']), "UTF-8") === $msgLower) {
                                                $isFastPath = true;
                                                break 2;
                                            }
                                        }
                                    }
                                }

                                // STEP 2: Wait 1s for sibling messages (SKIP if Fast Path)
                                if (!$isFastPath) {
                                    usleep(1000000); // 1 second debounce
                                } else {
                                    file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ⚡ Fast Path triggered for: $rawMsg\n", FILE_APPEND);
                                }

                                // STEP 3: Claim ALL pending messages for this user atomically
                                // [INDEX REQUIRED for Row Lock]:
                                //   ALTER TABLE zalo_message_queue ADD INDEX idx_queue_user_proc (zalo_user_id, processed);
                                // Without it: FOR UPDATE = full Table Lock (ALL users blocked simultaneously).
                                // With it: Row Lock scoped per zalo_user_id only — other users unaffected.
                                // Verify index exists: SHOW INDEX FROM zalo_message_queue WHERE Key_name = 'idx_queue_user_proc';
                                $pdo->beginTransaction();
                                $stmtBatch = $pdo->prepare("SELECT id, message_text FROM zalo_message_queue WHERE zalo_user_id = ? AND processed = 0 ORDER BY id ASC FOR UPDATE");
                                $stmtBatch->execute([$zaloUserId]);
                                $batchItems = $stmtBatch->fetchAll(PDO::FETCH_ASSOC);

                                if (empty($batchItems)) {
                                    $pdo->rollBack();
                                    // [GOTO-FIX] Batch already processed by a sibling process.
                                    // Previously used: goto sendResponse — which SKIPPED the BROADCAST TRACKING
                                    // block (lines ~848+), causing user_seen_message / user_reacted_message
                                    // tracking to be lost if they arrived in the same request cycle.
                                    // Using a flag + falling through ensures that block always executes.
                                    $batchProcessedBySibling = true;
                                } else {
                                    $msgText = implode("\n", array_column($batchItems, 'message_text'));
                                    $idsToMark = array_column($batchItems, 'id');
                                    $placeholders = implode(',', array_fill(0, count($idsToMark), '?'));
                                    $pdo->prepare("UPDATE zalo_message_queue SET processed = 1 WHERE id IN ($placeholders)")->execute($idsToMark);
                                    $pdo->commit();

                                    // [REDUNDANCY FIX] Log combined batched message to timeline once
                                    if ($subId) {
                                        updateZaloLeadScore($pdo, $zaloUserId, 'message');
                                        logZaloSubscriberActivity($pdo, $subId, 'user_send_text', null, "KH gửi tin nhắn [BATCH]: $msgText", "Zalo Webhook Batch", $eventId . "_batch", $oaConfig['workspace_id']);

                                        // [NEW] Trigger Inbound Message Flow
                                        $stmtMainMsg = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                                        $stmtMainMsg->execute([$zaloUserId]);
                                        $mainIdMsg = $stmtMainMsg->fetchColumn();
                                        if ($mainIdMsg) {
                                            require_once 'trigger_helper.php';
                                            triggerFlows($pdo, $mainIdMsg, 'inbound_message', $msgText);
                                        }
                                    }

                                    // Update data for subsequent processing
                                    $data['message']['text'] = $msgText;
                                } // end batch processing
                                // -----------------------------------------

                                if (empty($batchProcessedBySibling)) {

                                    // Payload Click Tracking & Debounce (Robust for batches & spaces)
                                    // Regex: Optional spaces around |, alphanumeric/underscore ID, Base64 label
                                    if (preg_match_all('/\s*\|\s*([a-zA-Z0-9_]+):([A-Za-z0-9+\/]+={0,2})/', $msgText, $matches, PREG_SET_ORDER)) {
                                        // [BUG-6 FIX] N+1 query: Pre-fetch ALL recent click timestamps for this subscriber
                                        // in ONE query, then check in PHP — avoids firing 1 DB query per button match.
                                        $recentClickTimes = [];
                                        if ($subId) {
                                            $stmtAllDebounce = $pdo->prepare(
                                                "SELECT reference_id, created_at FROM zalo_subscriber_activity "
                                                . "WHERE subscriber_id = ? AND type = 'zalo_clicked' "
                                                . "AND created_at >= DATE_SUB(NOW(), INTERVAL 2 SECOND)"
                                            );
                                            $stmtAllDebounce->execute([$subId]);
                                            foreach ($stmtAllDebounce->fetchAll(PDO::FETCH_ASSOC) as $rc) {
                                                $recentClickTimes[$rc['reference_id']] = $rc['created_at'];
                                            }
                                        }

                                        foreach ($matches as $match) {
                                            $fullMarker = $match[0];
                                            $markerSid = $match[1];
                                            $markerLabel = base64_decode($match[2]);

                                            // Remove the marker from msgText immediately
                                            $msgText = trim(str_replace($fullMarker, '', $msgText));

                                            // Anti-Spam: Block click if < 2 seconds (PHP check, no extra DB hit)
                                            if ($subId) {
                                                if (isset($recentClickTimes[$markerSid])) {
                                                    continue; // Already clicked within 2s — skip but clean marker
                                                }

                                                logZaloSubscriberActivity($pdo, $subId, 'zalo_clicked', $markerSid, "Click Button (+2 điểm): $markerLabel", $markerLabel, $eventId . "_click_" . $markerSid, $oaConfig['workspace_id']);

                                                // Also log to Main Timeline if possible
                                                $stmtMainClick = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                                                $stmtMainClick->execute([$zaloUserId]);
                                                $mainIdClick = $stmtMainClick->fetchColumn();
                                                if ($mainIdClick) {
                                                    // [SYNCED] Determine Campaign/Flow context from markerSid (Scenario ID)
                                                    $flowId = null;
                                                    $campaignId = null;

                                                    // Try to resolve if it's a flow or campaign
                                                    $stmtFlow = $pdo->prepare("SELECT id FROM flows WHERE id = ?");
                                                    $stmtFlow->execute([$markerSid]);
                                                    if ($stmtFlow->fetchColumn()) {
                                                        $flowId = $markerSid;
                                                    } else {
                                                        $stmtCamp = $pdo->prepare("SELECT id FROM campaigns WHERE id = ?");
                                                        $stmtCamp->execute([$markerSid]);
                                                        if ($stmtCamp->fetchColumn())
                                                            $campaignId = $markerSid;
                                                    }

                                                    processTrackingEvent($pdo, 'stat_update', [
                                                        'type' => 'zalo_clicked',
                                                        'subscriber_id' => $mainIdClick,
                                                        'reference_id' => $markerSid,
                                                        'flow_id' => $flowId,
                                                        'campaign_id' => $campaignId,
                                                        'extra_data' => [
                                                            'label' => $markerLabel,
                                                            'zalo_sub_id' => $subId,
                                                            'source' => 'Zalo Button'
                                                        ]
                                                    ]);

                                                    updateZaloLeadScore($pdo, $zaloUserId, 'click', $markerSid);
                                                }
                                            }
                                        }
                                    }

                                    // [NEW] LOG ZNS REPLY (Contextual)
                                    // If the active subscriber has received a ZNS in the last 24h, we consider this text a 'reply_zns' as well.
                                    if ($subId) {
                                        // Check if this sub received a ZNS recently (24h)
                                        // We need to look up in `subscriber_activity` for `zns_sent` for the MAIN subscriber ID.
                                        // 1. Get Main Subscriber ID
                                        $stmtMain = $pdo->prepare("SELECT zalo_user_id, id AS main_sub_id FROM subscribers WHERE zalo_user_id = ? LIMIT 1");
                                        $stmtMain->execute([$zaloUserId]);
                                        $mainSubRow = $stmtMain->fetch(PDO::FETCH_ASSOC);

                                        if ($mainSubRow) {
                                            $mainId = $mainSubRow['main_sub_id'];
                                            // 2. Check ZNS History
                                            $stmtZns = $pdo->prepare("SELECT flow_id, created_at FROM subscriber_activity WHERE subscriber_id = ? AND type = 'zns_sent' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY created_at DESC LIMIT 1");
                                            $stmtZns->execute([$mainId]);
                                            $lastZns = $stmtZns->fetch(PDO::FETCH_ASSOC);

                                            if ($lastZns) {
                                                // User requested to remove automatic 'ZALO - Email Verify' segment creation.
                                                // The 'verified' column is already set in the block above.

                                                // Log Profile Sync
                                                logActivity($pdo, $mainId, 'profile_sync', null, 'Sync Profile', "Linked Zalo ID: $zaloUserId", null, null, [], $oaConfig['workspace_id']);
                                                $znsRepScore = $LSC['leadscore_zalo_interact'] + 2; // Extra points for text reply
                                                logActivity($pdo, $mainId, 'reply_zns', $lastZns['flow_id'] ?? null, 'Zalo Reply', "Replied to ZNS (+$znsRepScore điểm): $msgText", $lastZns['flow_id'] ?? null, null, [], $oaConfig['workspace_id']);
                                                // Award points for ZNS reply
                                                $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")->execute([$znsRepScore, $mainId]);
                                            }
                                        }
                                    }

                                    // Search Keyword Scenarios
                                    // --- HOLIDAY SCENARIO CHECK ---
                                    $holidayTriggered = false;
                                    $stmtH = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, schedule_type, active_days, start_time, end_time, holiday_start_at, holiday_end_at, priority_override, trigger_text FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'holiday' AND status = 'active'"); // [FIX P38-WH] Explicit columns
                                    $stmtH->execute([$oaConfig['id']]);
                                    $holidays = $stmtH->fetchAll(PDO::FETCH_ASSOC);

                                    foreach ($holidays as $h) {
                                        $isActive = false;
                                        // 1. Check Schedule
                                        if ($h['schedule_type'] === 'date_range') {
                                            // Date Range Logic
                                            if (!empty($h['holiday_start_at']) && !empty($h['holiday_end_at'])) {
                                                $nowTs = time();
                                                $startTs = strtotime($h['holiday_start_at']);
                                                $endTs = strtotime($h['holiday_end_at']);
                                                if ($nowTs >= $startTs && $nowTs <= $endTs)
                                                    $isActive = true;
                                            }
                                        } else {
                                            // Daily Range Logic (Overnight support)
                                            // Check Day of Week first
                                            $activeDays = explode(',', $h['active_days']);
                                            if (in_array((string) $nowDay, $activeDays)) {
                                                if ($h['schedule_type'] === 'full') {
                                                    $isActive = true;
                                                } else {
                                                    $curr = date('H:i:s');
                                                    $s = $h['start_time'];
                                                    $e = $h['end_time'];
                                                    if ($s > $e) {
                                                        // Overnight (e.g. 22:00 - 05:00)
                                                        if ($curr >= $s || $curr <= $e)
                                                            $isActive = true;
                                                    } else {
                                                        // Normal (e.g. 08:00 - 17:00)
                                                        if ($curr >= $s && $curr <= $e)
                                                            $isActive = true;
                                                    }
                                                }
                                            }
                                        }

                                        if ($isActive) {
                                            // 2. Check Frequency (Once per day per user for this scenario)
                                            if ($subId) {
                                                $stmtFreq = $pdo->prepare("SELECT id FROM zalo_subscriber_activity WHERE subscriber_id = ? AND type = 'automation_reply' AND reference_id = ? AND created_at >= CURDATE()");
                                                $stmtFreq->execute([$subId, $h['id']]);
                                                if ($stmtFreq->fetchColumn()) {
                                                    // Already sent today, skip triggering but still respect priority if active? 
                                                    // User req: "Kịch bản này sẽ kích hoạt 1 lần...". 
                                                    // If priority override is ON, and it's active time, we should probably still BLOCK others even if we don't send?
                                                    // "nếu có kịch bản ngày nghĩ được kích hoạt thì các kịch bản khác trong khoảng thời gian này có trùng cũng ko được kích hoạt"
                                                    // -> This implies if the holiday condition is MET (isActive), strictly block others.
                                                    if ($h['priority_override']) {
                                                        $holidayTriggered = true; // Block subsequent
                                                    }
                                                    continue;
                                                }
                                            }

                                            // 3. Trigger Holiday Reply
                                            // [FIX BUG-C3] Use ensureZaloToken() which auto-refreshes expired tokens.
                                            // $oaConfig['access_token'] is read from DB and may be stale/expired,
                                            // causing silent send failures without any error log.
                                            $freshHolidayToken = ensureZaloToken($pdo, $oaConfig['id']);
                                            sendZaloScenarioReply($pdo, $zaloUserId, $freshHolidayToken, $h);
                                            if ($subId) {
                                                logZaloSubscriberActivity($pdo, $subId, 'automation_reply', $h['id'], "Sent Holiday Reply: " . $h['title'], $msgText, $eventId . "_holiday", $oaConfig['workspace_id']);
                                            }

                                            $holidayTriggered = true;
                                            if ($h['priority_override'])
                                                break; // Stop checking other holidays and keywords
                                        }
                                    }

                                    if ($holidayTriggered) {
                                        // [FIX-3] Use exit only — return in global scope is misleading,
                                        // and the exit below it was unreachable dead code.
                                        if (isset($lockName)) {
                                            db_release_lock($pdo, $lockName);
                                        }
                                        exit;
                                    }

                                    // Search Keyword Scenarios
                                    // Search Keyword & AI Scenarios (Specific)
                                    $stmtS = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, trigger_text, match_type, schedule_type, active_days, start_time, end_time, priority_override FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type IN ('keyword', 'ai_reply') AND status = 'active' ORDER BY created_at DESC"); // [FIX P38-WH] Explicit columns
                                    $stmtS->execute([$oaConfig['id']]);
                                    $scenarios = $stmtS->fetchAll(PDO::FETCH_ASSOC);

                                    foreach ($scenarios as $s) {
                                        if (!isScenarioActive($s, $nowTime, $nowDay))
                                            continue;

                                        // Skip wildcard AI for now, handle as fallback later
                                        if ($s['type'] === 'ai_reply' && (empty($s['trigger_text']) || $s['trigger_text'] === '*' || $s['trigger_text'] === 'default'))
                                            continue;

                                        $keywords = array_map('trim', explode(',', mb_strtolower($s['trigger_text'] ?? '', "UTF-8")));
                                        $matched = false;
                                        $msgLower = mb_strtolower($msgText, "UTF-8");

                                        foreach ($keywords as $kw) {
                                            if (empty($kw))
                                                continue;
                                            if ($s['match_type'] === 'contains') {
                                                if (mb_strpos($msgLower, $kw) !== false) {
                                                    $matched = true;
                                                    break;
                                                }
                                            } else {
                                                // [FIX-2] Exact match per-line: batch debounce joins messages with \n,
                                                // so "giá\nbao nhiêu" must match keyword "giá" on its own line.
                                                $lines = explode("\n", $msgLower);
                                                foreach ($lines as $line) {
                                                    if (trim($line) === $kw) {
                                                        $matched = true;
                                                        break 2; // break both foreach loops
                                                    }
                                                }
                                            }
                                        }

                                        if ($matched) {
                                            if ($s['type'] === 'ai_reply' && $skipAI) {
                                                // AI Cooldown active, skip this scenario and look for next match
                                                continue;
                                            }
                                            $scenario = $s;
                                            break;
                                        }
                                    }

                                    // Search Payload Responses
                                    if (!$scenario) {
                                        $stmtAll = $pdo->prepare("SELECT id, buttons FROM zalo_automation_scenarios WHERE oa_config_id = ? AND status = 'active' AND buttons IS NOT NULL");
                                        $stmtAll->execute([$oaConfig['id']]);
                                        while ($rec = $stmtAll->fetch()) {
                                            $btns = json_decode($rec['buttons'] ?? '[]', true);
                                            foreach ($btns as $b) {
                                                if (isset($b['type']) && $b['type'] === 'oa.query.show' && isset($b['payload'])) {
                                                    if (mb_strtolower(trim($b['payload']), "UTF-8") === mb_strtolower($msgText, "UTF-8")) {
                                                        if (!empty($b['auto_response_content'])) {
                                                            $scenario = ['content' => $b['auto_response_content'], 'message_type' => 'text', 'title' => '', 'buttons' => '[]', 'id' => $rec['id']];
                                                        }
                                                        break 2;
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    if (!$scenario && !$skipAI) {
                                        $stmtAI = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, trigger_text, schedule_type, active_days, start_time, end_time FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' AND (trigger_text IS NULL OR trigger_text = '' OR trigger_text = '*' OR trigger_text = 'default') AND status = 'active' ORDER BY priority_override DESC, created_at DESC LIMIT 1");
                                        $stmtAI->execute([$oaConfig['id']]);
                                        $rowAI = $stmtAI->fetch(PDO::FETCH_ASSOC);

                                        // [TRACE] AI scenario query result
                                        if ($rowAI) {
                                            $schedActive = isScenarioActive($rowAI, $nowTime, $nowDay);
                                            file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] AI row found: id={$rowAI['id']} trigger='" . ($rowAI['trigger_text'] ?? 'NULL') . "' schedule={$rowAI['schedule_type']} isActive=" . ($schedActive ? 'YES' : 'NO') . " nowDay=$nowDay nowTime=$nowTime\n", FILE_APPEND);
                                            if ($schedActive) {
                                                $scenario = $rowAI;
                                            }
                                        } else {
                                            // Count ALL ai_reply scenarios regardless of trigger_text to see if there's a mismatch
                                            $stmtDbg = $pdo->prepare("SELECT id, trigger_text, status, schedule_type FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' LIMIT 5");
                                            $stmtDbg->execute([$oaConfig['id']]);
                                            $dbgRows = $stmtDbg->fetchAll(PDO::FETCH_ASSOC);
                                            $dbgInfo = empty($dbgRows) ? 'NO ai_reply scenarios at all!' : json_encode(array_map(fn($r) => ['trigger' => $r['trigger_text'], 'status' => $r['status']], $dbgRows));
                                            file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ❌ AI query returned NULL for oa_config_id={$oaConfig['id']}. All ai_reply rows: $dbgInfo\n", FILE_APPEND);
                                        }
                                    }

                                    // First Message Logic
                                    if (!$scenario) {
                                        $stmtSub = $pdo->prepare("SELECT is_follower FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
                                        $stmtSub->execute([$zaloUserId]);
                                        if (!$stmtSub->fetchColumn()) {
                                            $stmtFirst = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, trigger_text FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'first_message' AND status = 'active' LIMIT 1"); // [FIX P38-WH] Explicit columns
                                            $stmtFirst->execute([$oaConfig['id']]);
                                            $row = $stmtFirst->fetch(PDO::FETCH_ASSOC);
                                            if ($row && isScenarioActive($row, $nowTime, $nowDay)) {
                                                $scenario = $row;
                                            }
                                        }
                                    }
                                }

                                if ($scenario) {
                                    file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ✅ Scenario found: " . ($scenario['title'] ?? $scenario['type']) . " → sending reply\n", FILE_APPEND);
                                    if (!empty($subId) && !empty($scenario['id'])) {
                                        logZaloSubscriberActivity($pdo, $subId, 'automation_trigger', $scenario['id'], "Kích hoạt kịch bản: " . ($scenario['title'] ?? 'Auto Response'), $scenario['title'] ?? 'Auto Response', $eventId, $oaConfig['workspace_id']);
                                    }
                                    $freshScenarioToken = ensureZaloToken($pdo, $oaConfig['id']);
                                    if (($scenario['type'] ?? '') === 'ai_reply') {
                                        sendZaloAIReply($pdo, $zaloUserId, $freshScenarioToken, $scenario, $msgText, $oaConfig['workspace_id']);
                                    } else {
                                        sendZaloScenarioReply($pdo, $zaloUserId, $freshScenarioToken, $scenario, $msgText, $oaConfig['workspace_id']);
                                    }
                                } else {
                                    file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ❌ No scenario matched. skipAI=$skipAI\n", FILE_APPEND);
                                }

                            } // end if (empty($batchProcessedBySibling))
                            else {
                                file_put_contents($zaloLogFile, date('[Y-m-d H:i:s] ') . "[TRACE] ⛔ batchProcessedBySibling=true — skipped tracking and scenarios\n", FILE_APPEND);
                            }
                        }
                    }
                } catch (Exception $e) {
                    if ($pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
                }

                // --- [FIX-1] BROADCAST TRACKING for user_seen_message / user_reacted_message ---
                // Was dead elseif — moved here so it actually executes (both events are in $allowedEvents)
                if ($event === 'user_seen_message' || $event === 'user_reacted_message') {
                    $msgId = $data['message']['msg_id'] ?? null;
                    if ($msgId) {
                        $stmtT = $pdo->prepare("SELECT id, broadcast_id, status, zalo_user_id FROM zalo_broadcast_tracking WHERE zalo_msg_id = ?");
                        $stmtT->execute([$msgId]);
                        $track = $stmtT->fetch(PDO::FETCH_ASSOC);
                        if ($track) {
                            $stmtS = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
                            $stmtS->execute([$track['zalo_user_id']]);
                            $broadcastSubId = $stmtS->fetchColumn();
                            if ($event === 'user_seen_message' && !in_array($track['status'], ['seen', 'reacted'])) {
                                $pdo->prepare("UPDATE zalo_broadcast_tracking SET status = 'seen', seen_at = NOW() WHERE id = ?")->execute([$track['id']]);
                                $pdo->prepare("UPDATE zalo_broadcasts SET stats_seen = stats_seen + 1 WHERE id = ?")->execute([$track['broadcast_id']]);
                                if ($broadcastSubId) {
                                    // Try to resolve workspace_id from OA
                                    logZaloSubscriberActivity($pdo, $broadcastSubId, 'seen_broadcast', $track['broadcast_id'], "Đã xem Broadcast", "Broadcast", null, $oaConfig['workspace_id']);
                                    updateZaloLeadScore($pdo, $zaloUserId, 'zns_interaction', $track['broadcast_id']);
                                }
                            } elseif ($event === 'user_reacted_message' && $track['status'] !== 'reacted') {
                                $pdo->prepare("UPDATE zalo_broadcast_tracking SET status = 'reacted', reacted_at = NOW() WHERE id = ?")->execute([$track['id']]);
                                $pdo->prepare("UPDATE zalo_broadcasts SET stats_reacted = stats_reacted + 1 WHERE id = ?")->execute([$track['broadcast_id']]);
                                if ($broadcastSubId) {
                                    logZaloSubscriberActivity($pdo, $broadcastSubId, 'reacted_broadcast', $track['broadcast_id'], "Đã tương tác Broadcast", "Broadcast", null, $oaConfig['workspace_id']);
                                    updateZaloLeadScore($pdo, $zaloUserId, 'zns_interaction', $track['broadcast_id']);
                                }
                            }
                        }
                        if ($event === 'user_seen_message') {
                            $stmtZns = $pdo->prepare("SELECT flow_id FROM zalo_delivery_logs WHERE zalo_msg_id = ? LIMIT 1");
                            $stmtZns->execute([$msgId]);
                            $znsLog = $stmtZns->fetch(PDO::FETCH_ASSOC);
                            if ($znsLog && $znsLog['flow_id']) {
                                $pdo->prepare("UPDATE zalo_delivery_logs SET status = 'seen' WHERE zalo_msg_id = ? AND status != 'seen'")->execute([$msgId]);
                                $stmtCheckCamp = $pdo->prepare("SELECT id FROM campaigns WHERE id = ? LIMIT 1");
                                $stmtCheckCamp->execute([$znsLog['flow_id']]);
                                if ($stmtCheckCamp->fetchColumn()) {
                                    $pdo->prepare("UPDATE campaigns SET count_opened = count_opened + 1 WHERE id = ?")->execute([$znsLog['flow_id']]);
                                }
                            }
                        }
                    }
                }
            } // end if ($oaConfig)
            // [FIX P4-C2] Release the Zalo idempotency lock after processing completes.
            // GET_LOCK was acquired at the top of this block but was ONLY released in the
            // 'duplicate event' early-exit branch. For all normal processing paths, the lock
            // was held until the MySQL connection closed (end of PHP-FPM request lifecycle).
            // With connection pooling (keep-alive), stale locks could block subsequent
            // Zalo webhooks for the same OA for up to 3 seconds each — causing 504 timeouts
            // under load (100+ events/min). Always release explicitly after processing.
            if (isset($lockName)) {
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
            }
        } // end if ($zaloUserId && $zaloOaId)

        // [BUG-3 FIX] Removed duplicate echo here.
        // At line ~108, we already echo json_encode(['status'=>'success']) and call
        // fastcgi_finish_request() OR ob_end_flush()+flush().
        // Adding another echo here caused double output: {"status":"success"}{"status":"success"}
        // which is invalid JSON and causes Zalo to mark the webhook call as failed.
        // [GOTO-FIX] Removed the goto sendResponse label. The flag $batchProcessedBySibling
        // now allows broadcast tracking to run before reaching this exit.
        exit;
    }
} else {
    require_once 'flow_helpers.php';

    $type = $_GET['type'] ?? '';

    if ($type === 'open' || $type === 'click' || $type === 'unsubscribe') {
        // [FIX] Support Aliases matching worker_flow.php generation (sub_id, flow_id, step_id)
        $sid = $_GET['sid'] ?? $_GET['sub_id'] ?? null;
        $fid = $_GET['fid'] ?? $_GET['flow_id'] ?? null;
        $cid = $_GET['cid'] ?? $_GET['campaign_id'] ?? null;
        $rid = $_GET['rid'] ?? $_GET['step_id'] ?? null; // step_id or reminder_id

        // [ADVANCED TRACKING] Capture Environment
        // Improved IP Detection
        $ip = $_SERVER['HTTP_CLIENT_IP'] ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['HTTP_X_FORWARDED'] ?? ($_SERVER['HTTP_FORWARDED_FOR'] ?? ($_SERVER['HTTP_FORWARDED'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'Unknown')))));
        if (strpos($ip, ',') !== false) {
            $ips = explode(',', $ip);
            $ip = trim($ips[0]);
        }

        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

        // [10M PERFORMANCE UPGRADE]
        // Offload device/geo resolution to background worker.
        // Sync resolution (getLocationFromIP) hits an external API with 1s timeout.
        // Under load (1k emails -> 200 clicks), this consumes all PHP-FPM workers and hangs the server.
        $deviceInfo = ['device' => null, 'os' => null, 'browser' => null];
        $location = null;

        // Note: For OPEN events, we already skipped this. Now we skip for CLICK too.
        // worker_tracking_aggregator.php will resolve these lazily.

        if ($type === 'click') {
            $debugUrl = isset($_GET['url']) ? base64_decode($_GET['url']) : 'N/A';
            $debugMsg = date('[Y-m-d H:i:s] ') . "Click Tracking Debug:\n";
            $debugMsg .= "Received Link: " . $debugUrl . "\n"; // Log the actual URL
            $debugMsg .= "IP: " . ($ip ?? 'NULL') . "\n";
            $debugMsg .= "UA: " . ($ua ?? 'NULL') . "\n";
            $debugMsg .= "Location: " . ($location ?? 'NULL') . "\n";
            $debugMsg .= "Device: " . json_encode($deviceInfo) . "\n";
            // [FIX F-7] Auto-rotate at 5MB — prevents disk exhaustion on high-volume campaigns.
            // Without this: 100k subs × 15% CTR = 15k click events per campaign → unbounded growth.
            $debugLogFile = __DIR__ . '/webhook_debug.log';
            if (file_exists($debugLogFile) && filesize($debugLogFile) > 5 * 1024 * 1024) {
                rename($debugLogFile, $debugLogFile . '.' . date('YmdHis') . '.bak');
            }
            file_put_contents($debugLogFile, $debugMsg, FILE_APPEND);
        }

        $extraData = [
            'ip' => $ip,
            'user_agent' => $ua,
            'device_type' => $deviceInfo['device'],
            'os' => $deviceInfo['os'],
            'browser' => $deviceInfo['browser'],
            'location' => $location
        ];

        // [AUTO-UPDATE] Subscriber City & Workspace Context from IP/DB (Click Events Only)
        $wId = 1; // Default
        if ($sid) {
            try {
                $stmtSub = $pdo->prepare("SELECT city, workspace_id FROM subscribers WHERE id = ?");
                $stmtSub->execute([$sid]);
                $subRow = $stmtSub->fetch(PDO::FETCH_ASSOC);

                if ($subRow) {
                    $wId = $subRow['workspace_id'] ?? 1;
                    $currentCity = $subRow['city'];

                    // [USER REQ] Only update city if current data is EMPTY
                    if ($type === 'click' && $location && empty($currentCity)) {
                        $pdo->prepare("UPDATE subscribers SET city = ?, country = ? WHERE id = ?")->execute([$location, $location, $sid]);
                    }
                }
            } catch (Exception $e) {
                // Ignore errors during city update to not break tracking
            }
        }

        // [SECURITY FIX] Validate URL before redirect.
        // Original regex could be bypassed: javascript:@https://legit.com is valid per FILTER_VALIDATE_URL
        // because FILTER_VALIDATE_URL only checks structure, not scheme safety.
        // Fix: Explicitly allow only http:// and https:// scheme AND check host is not empty.
        $rawEncodedUrl = isset($_GET['url']) ? str_replace(' ', '+', (string)$_GET['url']) : '';
        $url = $rawEncodedUrl !== '' ? base64_decode($rawEncodedUrl) : 'https://automation.ideas.edu.vn';
        if ($url === false || trim($url) === '') {
            $url = 'https://automation.ideas.edu.vn';
        }
        // Decode HTML entities if any (e.g. &amp; -> &) and strip control characters / CRLF
        $url = html_entity_decode(trim($url), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $url = preg_replace('/[\x00-\x1F\x7F]+/', '', $url);
        if (strpos($url, '//') === 0) {
            $url = 'https:' . $url;
        } elseif (!preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $url) && strpos($url, '/') !== 0 && !preg_match('/^(?:javascript:|data:|mailto:|tel:)/i', $url)) {
            $url = 'https://' . ltrim($url, '/');
        }
        // Percent-encode spaces and UTF-8 / non-ASCII characters so FILTER_VALIDATE_URL does not
        // reject valid URLs with Vietnamese slugs or query params
        $url = preg_replace_callback('/[^\x21-\x7E]/', function ($m) {
            return rawurlencode($m[0]);
        }, $url);
        $parsedUrl = parse_url($url);
        $urlScheme = strtolower($parsedUrl['scheme'] ?? '');
        $urlHost = $parsedUrl['host'] ?? '';
        if (!in_array($urlScheme, ['http', 'https']) || empty($urlHost) || !filter_var($url, FILTER_VALIDATE_URL)) {
            $url = 'https://automation.ideas.edu.vn';
        }

        if ($sid) {
            // [PERFORMANCE] BUFFER-FIRST ARCHITECTURE
            // For high-volume events (Open/Click), we push to a raw buffer to avoid locking main tables.
            // Unsubscribe remains synchronous to ensure immediate compliance.

            // [ANTI-PHANTOM-CLICK] Filter out email security scanners that pre-fetch links.
            // These bots scan email links (Google Safe Browsing, etc.) BEFORE the user actually clicks.
            // Without this filter: 1 real click = 2 recorded clicks (bot + human). N users = 2N clicks.
            $isBotClick = false;
            if ($type === 'click') {
                // [PREFETCH DETECTION] Safar/Email Clients often pre-download links!
                $xPurpose = $_SERVER['HTTP_X_PURPOSE'] ?? '';
                $purpose = $_SERVER['HTTP_PURPOSE'] ?? '';
                $secFetchMode = $_SERVER['HTTP_SEC_FETCH_MODE'] ?? '';
                if (strtolower($xPurpose) === 'preview' || strtolower($purpose) === 'prefetch' || strtolower($secFetchMode) === 'prefetch') {
                    $isBotClick = true;
                }

                if (!$isBotClick) {
                    $botUaPatterns = [
                        'GoogleImageProxy',
                        'YahooMailProxy',
                        'Googlebot',
                        'bingbot',
                        'BingPreview',
                        'Twitterbot',
                        'facebookexternalhit',
                        'LinkedInBot',
                        'Slackbot',
                        'AhrefsBot',
                        'SemrushBot',
                        'DotBot',
                        'python-requests',
                        'python-urllib',
                        'curl/',
                        'wget/',
                        'HeadlessChrome',
                        'PhantomJS',
                        'SafeBrowsing',
                        'GSecurityScanner',
                        'Barracuda',
                        'Proofpoint',
                        'Mimecast',
                        'MSIE 7.0',
                        'MS Web Services Client Protocol',
                        // ADDITIONAL: Secure Web Gateways & Scanners
                        'Microsoft Office',
                        'Outlook-Express',
                        'Outlook-iOS',
                        'Outlook-Android',
                        'Office 365',
                        'Exchange Online',
                        'Safelinks',
                        'G-Security-Scanner',
                        'CiscoUmbrella',
                        'Trend Micro',
                        'FireEye',
                        'Sophos',
                        'Fortinet',
                        'Palo Alto Networks',
                        'Zscaler',
                        'Symantec',
                        'McAfee',
                        'Bitdefender',
                        'Cloudflare-HealthCheck',
                        'Viber',
                        'WhatsApp',
                        'TelegramBot',
                        'Cyber-Security'
                    ];
                    foreach ($botUaPatterns as $pattern) {
                        if (stripos($ua, $pattern) !== false) {
                            $isBotClick = true;
                            break;
                        }
                    }
                }

                // Also filter by known scanner IP ranges
                if (!$isBotClick) {
                    $botIpPrefixes = [
                        '66.249.',
                        '64.233.',
                        '72.14.',
                        '209.85.', // Google
                        '40.77.',
                        '157.55.',
                        '207.46.',
                        '20.42.',
                        '20.191.', // Bing/Microsoft
                        '104.47.',
                        '52.148.',
                        '13.107.',
                        '13.106.', // Microsoft EOP / Azure
                        '104.143.',
                        '104.146.',
                        '104.147.', // Outlook
                        '108.177.',
                        '74.125.', // Google DCs
                        '192.174.',
                        '199.10.', // Proofpoint
                        '204.14.',
                        '208.75.',  // Mimecast
                        '40.' // Broad MS range
                    ];
                    foreach ($botIpPrefixes as $prefix) {
                        if (strpos($ip, $prefix) === 0) {
                            $isBotClick = true;
                            break;
                        }
                    }
                }
            }

            if ($type === 'open' || ($type === 'click' && !$isBotClick)) {

                // [DEBOUNCE FIX] Pre-buffer deduplication
                // Checks raw_event_buffer for identical recent events to prevent redundant logs
                // from multi-threaded scanners or rapid user clicks.
                $isDebounced = false;
                try {
                    $stmtCheck = $pdo->prepare("
                        SELECT 1 FROM raw_event_buffer 
                        WHERE type = ? 
                        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 SECOND)
                        AND payload LIKE ? 
                        LIMIT 1
                    ");
                    $likePattern = '%"sid":"' . $sid . '"%' . ($rid ? '%"rid":"' . $rid . '"%' : '');
                    if ($type === 'click' && $url) {
                        $jsonEscapedUrl = trim(json_encode($url), '"');
                        $likePattern .= '%"url":"' . $jsonEscapedUrl . '"%';
                    }
                    $stmtCheck->execute([$type, $likePattern]);
                    if ($stmtCheck->fetchColumn()) {
                        $isDebounced = true;
                    }
                } catch (Exception $e) {
                }

                if (!$isDebounced) {
                    try {
                        $rawPayload = json_encode([
                            'sid' => $sid,
                            'rid' => $rid,
                            'fid' => $fid,
                            'cid' => $cid,
                            'var' => $_GET['var'] ?? null,
                            'workspace_id' => $wId, // [HARDENING] Pass workspace_id into buffer
                            // user_agent is already inside $extraData['user_agent'] — no need to duplicate at root
                            'extra_data' => array_merge($extraData, ['url' => $url]),
                            'timestamp' => microtime(true)
                        ]);

                        $stmt = $pdo->prepare("INSERT INTO raw_event_buffer (type, payload) VALUES (?, ?)");
                        $stmt->execute([$type, $rawPayload]);
                    } catch (Exception $e) {
                        // Fallback: If table doesn't exist, create it and retry
                        if (strpos($e->getMessage(), "doesn't exist") !== false) {
                            try {
                                $pdo->exec("CREATE TABLE IF NOT EXISTS raw_event_buffer (
                                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                                    type VARCHAR(50) NOT NULL,
                                    payload JSON NOT NULL,
                                    processed TINYINT(1) DEFAULT 0,
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    INDEX idx_processed (processed)
                                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

                                $stmt = $pdo->prepare("INSERT INTO raw_event_buffer (type, payload) VALUES (?, ?)");
                                $stmt->execute([$type, $rawPayload]);
                            } catch (Exception $ex) {
                                // If still fails, log and ignore (don't break redirect)
                                file_put_contents(__DIR__ . '/webhook_error.log', date('[Y-m-d H:i:s] ') . "Buffer Insert Failed: " . $ex->getMessage() . "\n", FILE_APPEND);
                            }
                        } else {
                            file_put_contents(__DIR__ . '/webhook_error.log', date('[Y-m-d H:i:s] ') . $e->getMessage() . "\n", FILE_APPEND);
                        }
                    }
                }
            } elseif ($type === 'unsubscribe') {
                // [CRITICAL FIX] Explicit 'unsubscribe' type check.
                // Old code used bare 'else' — if type='click' and $isBotClick=true,
                // the bot request would accidentally trigger processTrackingEvent('unsubscribe'),
                // potentially unsubscribing real users via Google's security scanner!
                try {
                    $trackPayload = [
                        'type' => 'unsubscribe',
                        'subscriber_id' => $sid,
                        'reference_id' => $rid,
                        'flow_id' => $fid,
                        'campaign_id' => $cid,
                        'extra_data' => array_merge($extraData, ['url' => $url])
                    ];
                    processTrackingEvent($pdo, 'unsubscribe', $trackPayload);
                } catch (Exception $e) {
                    file_put_contents(__DIR__ . '/webhook_error.log', date('[Y-m-d H:i:s] ') . $e->getMessage() . "\n", FILE_APPEND);
                }
                // Bot clicks ($isBotClick=true) fall through here silently — just redirect, no tracking.
            }

        }

        // 2. RESPONSE & REDIRECT
        if ($type === 'open') {
            header('Content-Type: image/gif');
            echo base64_decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
            exit;
        }

        if ($type === 'click') {
            // [SURVEY & SUBSCRIBER PREFILL] Forward subscriber context to surveys and verified domains
            if ($sid) {
                try {
                    $stmtE = $pdo->prepare("SELECT id, email, first_name, last_name, phone_number, company_name FROM subscribers WHERE id = ? LIMIT 1");
                    $stmtE->execute([$sid]);
                    $sub = $stmtE->fetch(PDO::FETCH_ASSOC);
                    if ($sub) {
                        $isSurveyOrInternal = (
                            (isset($_GET['v']) && $_GET['v'] === '1') ||
                            strpos($url, '/surveys/') !== false ||
                            strpos($url, '/s/') !== false ||
                            strpos($url, 'survey_public.php') !== false ||
                            strpos($url, 'forms.php') !== false ||
                            strpos($url, 'ideas.edu.vn') !== false
                        );
                        if ($isSurveyOrInternal) {
                            $fragment = '';
                            $hashPos = strpos($url, '#');
                            if ($hashPos !== false) {
                                $fragment = substr($url, $hashPos);
                                $url = substr($url, 0, $hashPos);
                            }
                            $connector = (strpos($url, '?') !== false) ? '&' : '?';
                            $paramsToAdd = [];
                            if (!empty($sub['id']) && strpos($url, 'sid=') === false) {
                                $paramsToAdd['sid'] = $sub['id'];
                            }
                            if (!empty($sub['email'])) {
                                if (strpos($url, 'email=') === false) $paramsToAdd['email'] = $sub['email'];
                                if (strpos($url, 'uid=') === false) $paramsToAdd['uid'] = $sub['email'];
                            }
                            if (!empty($sub['first_name']) && strpos($url, 'name=') === false) {
                                $fullName = trim(($sub['first_name'] ?? '') . ' ' . ($sub['last_name'] ?? ''));
                                $paramsToAdd['name'] = $fullName ?: $sub['first_name'];
                            }
                            if (!empty($sub['phone_number']) && strpos($url, 'phone=') === false) {
                                $paramsToAdd['phone'] = $sub['phone_number'];
                            }
                            if (!empty($paramsToAdd)) {
                                $url .= $connector . http_build_query($paramsToAdd);
                            }
                            $url .= $fragment;
                        }
                    }
                } catch (Exception $e) {
                    error_log('[webhook] Subscriber info append failed for sid=' . $sid . ': ' . $e->getMessage());
                }
            }
            header("Location: $url");
            exit;
        }

        if ($type === 'unsubscribe') {
            // [BUG-J1 FIX] rawurlencode() params to prevent HTTP header injection
            // [FIX R4-H02] Use APP_BASE_URL env var instead of hardcoded domain.
            // Hardcoded domain breaks if: (a) domain changes, (b) domain expires/hijacked.
            $appBase = rtrim(getenv('APP_BASE_URL') ?: 'https://automation.ideas.edu.vn', '/');
            $redirect = $appBase . '/crm/manage_subscription.php?sid=' . rawurlencode($sid);
            if ($fid)
                $redirect .= '&fid=' . rawurlencode($fid);
            if ($cid)
                $redirect .= '&cid=' . rawurlencode($cid);
            header('Location: ' . $redirect);
            exit;
        }

    } elseif ($type === 'diagnostic') {
        header('Content-Type: text/html; charset=utf-8');
        echo "<!DOCTYPE html><html><head><title>Webhook Diagnostic</title></head><body style='font-family:sans-serif;padding:20px;'>";
        echo "<h1>Webhook Diagnostic</h1>";
        echo "<p>This page checks the Zalo webhook listener's log file and write permissions.</p>";

        $logFile = __DIR__ . '/zalo_debug.log';

        if (file_exists($logFile)) {
            echo "<h2>Zalo Debug Log</h2>";
            echo "Last 20 lines:<br>";
            echo "<pre style='background:#f4f4f4;padding:10px;border:1px solid #ccc; max-height: 400px; overflow: auto;'>";
            $lines = file($logFile);
            $lastLines = array_slice($lines, -20);
            echo htmlspecialchars(implode("", $lastLines));
            echo "</pre>";
        } else {
            echo "<b style='color:red;'>Log file (zalo_debug.log) does not exist.</b><br>";
            echo "Attempting to create test log entry...<br>";
            $testWrite = file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "Diagnostic Test Write\n", FILE_APPEND);
            if ($testWrite) {
                echo "✅ Test write successful! Refresh this page.<br>";
            } else {
                echo "❌ <b style='color:red;'>Test write FAILED.</b> There is a permission issue preventing PHP from creating files in this folder.<br>";
            }
        }
        echo "</body></html>";
        exit;
    }

    // Default Fallback
    echo json_encode(['status' => 'ready', 'message' => 'Zalo Webhook Listener is active']);
    exit;
}



function upsertZaloSubscriberWebhook($pdo, $zaloUserId, $payload, $oaConfigId, $oaName, $event, $workspaceId)
{
    // 1. Get List ID
    $stmt = $pdo->prepare("SELECT id FROM zalo_lists WHERE workspace_id = ? AND oa_config_id = ? LIMIT 1");
    $stmt->execute([$workspaceId, $oaConfigId]);
    $list = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$list) {
        $listId = bin2hex(random_bytes(16));
        $pdo->prepare("INSERT INTO zalo_lists (id, workspace_id, name, oa_config_id) VALUES (?, ?, ?, ?)")->execute([$listId, $workspaceId, "Người quan tâm: $oaName", $oaConfigId]);
    } else {
        $listId = $list['id'];
    }

    $name = $payload['sender']['display_name'] ?? ($payload['info']['display_name'] ?? ($payload['info']['name'] ?? null));
    $avatar = $payload['sender']['avatar'] ?? ($payload['info']['avatar'] ?? null);
    $isFollower = ($event === 'follow') ? 1 : 0;

    // 2. ATOMIC UPSERT (10M SCALE)
    // We use INSERT IGNORE to handle race conditions where two threads try to create the same user.
    // The id is generated here but IGNORE will discard the insert if zalo_user_id exists.
    $newSubId = bin2hex(random_bytes(16));
    try {
        $stmtInsert = $pdo->prepare("
            INSERT IGNORE INTO zalo_subscribers 
            (id, workspace_id, zalo_list_id, zalo_user_id, display_name, avatar, joined_at, last_interaction_at, is_follower) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
        ");
        $stmtInsert->execute([$newSubId, $workspaceId, $listId, $zaloUserId, $name ?: 'Zalo User', $avatar, $isFollower]);

        if ($stmtInsert->rowCount() > 0) {
            // First time created, increment count
            $pdo->prepare("UPDATE zalo_lists SET subscriber_count = subscriber_count + 1 WHERE id = ?")->execute([$listId]);
            return $newSubId;
        }

        // 3. IF ALREADY EXISTS, UPDATE
        // Lock the row for update to ensure we have the latest status
        $stmtExisting = $pdo->prepare("SELECT id, display_name, avatar, is_follower FROM zalo_subscribers WHERE workspace_id = ? AND zalo_user_id = ? FOR UPDATE");
        $stmtExisting->execute([$workspaceId, $zaloUserId]);
        $existing = $stmtExisting->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $subId = $existing['id'];
            $currentIsFollower = $existing['is_follower'];
            $updateCols = ["last_interaction_at = NOW()"];
            $params = [];

            if ($event === 'follow' && $currentIsFollower != 1) {
                $updateCols[] = "is_follower = 1";
            } elseif ($event === 'unfollow' && $currentIsFollower != 0) {
                $updateCols[] = "is_follower = 0";
            } elseif (isset($payload['sender']['user_is_follower'])) {
                $newStatus = $payload['sender']['user_is_follower'] ? 1 : 0;
                if ($currentIsFollower != $newStatus) {
                    $updateCols[] = "is_follower = ?";
                    $params[] = $newStatus;
                }
            }

            if ($name && $name !== 'Zalo User' && $name !== $existing['display_name']) {
                $updateCols[] = "display_name = ?";
                $params[] = $name;
            }
            if ($avatar && $avatar !== $existing['avatar']) {
                $updateCols[] = "avatar = ?";
                $params[] = $avatar;
            }

            if (count($params) > 0 || count($updateCols) > 1) {
                $params[] = $subId;
                $pdo->prepare("UPDATE zalo_subscribers SET " . implode(", ", $updateCols) . " WHERE id = ?")->execute($params);

                // [SYNC] Update Main Subscriber 'is_zalo_follower'
                $newIsFollower = null;
                if ($event === 'follow')
                    $newIsFollower = 1;
                elseif ($event === 'unfollow')
                    $newIsFollower = 0;
                // Else usage of $newStatus variable from logic above, but safer to rely on event or explicit change

                if ($newIsFollower !== null) {
                    try {
                        // Find linked subscriber
                        $stmtLink = $pdo->prepare("SELECT id FROM subscribers WHERE workspace_id = ? AND zalo_user_id = (SELECT zalo_user_id FROM zalo_subscribers WHERE workspace_id = ? AND id = ? LIMIT 1) LIMIT 1");
                        $stmtLink->execute([$workspaceId, $workspaceId, $subId]);
                        $linkedId = $stmtLink->fetchColumn();

                        if ($linkedId) {
                            $pdo->prepare("UPDATE subscribers SET is_zalo_follower = ? WHERE id = ? AND workspace_id = ?")->execute([$newIsFollower, $linkedId, $workspaceId]);
                        }
                    } catch (Exception $e) {
                        error_log('[webhook] is_zalo_follower sync failed for subId=' . $subId . ': ' . $e->getMessage());
                    }
                }
            }
            return $subId;
        }
    } catch (Exception $e) {
        // Fallback for extreme cases (deadlocks, etc)
        error_log("Race condition in upsertZaloSubscriberWebhook: " . $e->getMessage());
    }

    // Safety fallback: search with prepared statement (Scoped by workspaceId)
    $stmtFallback = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE zalo_user_id = ? AND workspace_id = ? LIMIT 1");
    $stmtFallback->execute([$zaloUserId, $workspaceId]);
    return $stmtFallback->fetchColumn();
}

// Helper to add tag
function addSubscriberTag($pdo, $subId, $tag, $workspaceId)
{
    updateSubscriberTagsAtomic($pdo, $subId, [$tag], [], $workspaceId);
}

// Helper to remove tag
function removeSubscriberTag($pdo, $subId, $tag, $workspaceId)
{
    updateSubscriberTagsAtomic($pdo, $subId, [], [$tag], $workspaceId);
}

// [NEW] Consolidated Tag Update (10M UPGRADE: Relational)
function updateSubscriberTagsAtomic($pdo, $subId, $addTags = [], $removeTags = [], $workspaceId = null)
{
    if (!$workspaceId)
        return; // Strict mode: workspaceId required

    try {
        // Safety: If $subId looks like a Zalo subscriber row (check via zalo_subscribers),
        // resolve the linked Main subscriber ID to avoid FK mismatch on subscriber_tags.
        $resolvedId = $subId;
        $stmtCheck = $pdo->prepare(
            "SELECT s.id FROM subscribers s "
            . "JOIN zalo_subscribers zs ON zs.zalo_user_id = s.zalo_user_id "
            . "WHERE zs.id = ? AND s.workspace_id = ? AND zs.workspace_id = ? LIMIT 1"
        );
        $stmtCheck->execute([$subId, $workspaceId, $workspaceId]);
        $mainId = $stmtCheck->fetchColumn();
        if ($mainId) {
            $resolvedId = $mainId; // Use Main subscriber ID for subscriber_tags FK
        }

        if (!empty($addTags)) {
            foreach ($addTags as $tagName) {
                $stmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ? LIMIT 1");
                $stmt->execute([$tagName, $workspaceId]);
                $tagId = $stmt->fetchColumn();
                if ($tagId) {
                    $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id, workspace_id) VALUES (?, ?, ?)")->execute([$resolvedId, $tagId, $workspaceId]);
                }
            }
        }
        if (!empty($removeTags)) {
            foreach ($removeTags as $tagName) {
                $stmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ? LIMIT 1");
                $stmt->execute([$tagName, $workspaceId]);
                $tagId = $stmt->fetchColumn();
                if ($tagId) {
                    $pdo->prepare("DELETE FROM subscriber_tags WHERE subscriber_id = ? AND tag_id = ? AND workspace_id = ?")->execute([$resolvedId, $tagId, $workspaceId]);
                }
            }
        }
    } catch (Exception $e) {
        error_log('[webhook] updateSubscriberTagsAtomic failed for subId=' . $subId . ': ' . $e->getMessage());
    }
}

// [BUG-1 NOTE] Old GC block removed — now handled via register_shutdown_function() at top of file.
// This ensures GC runs even when execution ends via exit().
