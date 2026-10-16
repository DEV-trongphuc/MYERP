<?php
/**
 * api/meta_inbound_processor.php - ASYNC PROCESSOR FOR META MESSENGER
 * Handles heavy lifting: Profiling, Syncing, Scenarios, and AI.
 */

require_once 'db_connect.php';
require_once 'meta_sender.php';
require_once 'meta_sync_helpers.php';
require_once 'meta_helpers.php';
require_once 'flow_helpers.php'; // Required for dispatchQueueJob
require_once 'trigger_helper.php';

// Polyfill for mb_str_split if PHP < 7.4
if (!function_exists('mb_str_split')) {
    function mb_str_split($string, $split_length = 1, $encoding = null)
    {
        if (null !== $string && !is_scalar($string) && !(is_object($string) && method_exists($string, '__toString'))) {
            trigger_error('mb_str_split() expects parameter 1 to be string, ' . gettype($string) . ' given', E_USER_WARNING);
            return null;
        }
        if (null !== $split_length && !is_numeric($split_length)) {
            trigger_error('mb_str_split() expects parameter 2 to be int, ' . gettype($split_length) . ' given', E_USER_WARNING);
            return null;
        }
        $split_length = (int) $split_length;
        if (1 > $split_length) {
            trigger_error('mb_str_split() length must be greater than 0', E_USER_WARNING);
            return false;
        }
        if (null === $encoding) {
            $encoding = mb_internal_encoding();
        } else {
            $encoding = (string) $encoding;
        }

        if (!in_array($encoding, mb_list_encodings(), true)) {
            static $aliases;
            if (null === $aliases) {
                $aliases = [];
                foreach (mb_list_encodings() as $enc) {
                    foreach (mb_encoding_aliases($enc) as $alias) {
                        $aliases[$alias] = $enc;
                    }
                }
            }
            if (isset($aliases[$encoding])) {
                $encoding = $aliases[$encoding];
            } else {
                trigger_error('mb_str_split(): Unknown encoding "' . $encoding . '"', E_USER_WARNING);
                return false;
            }
        }

        $result = [];
        $length = mb_strlen($string, $encoding);
        for ($i = 0; $i < $length; $i += $split_length) {
            $result[] = mb_substr($string, $i, $split_length, $encoding);
        }
        return $result;
    }
}

function logMetaDebug($msg)
{
    $file = __DIR__ . '/meta_debug.log';
    file_put_contents($file, date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
}

function handleMetaInboundJob($pdo, $payload)
{
    $channel = $payload['channel'] ?? 'messaging';
    $pageId = $payload['page_id'] ?? null;
    $event = $payload['event'] ?? null;

    if (!$event || !$pageId) {
        logMetaDebug("Job Failed: Missing event or pageId");
        return false;
    }

    logMetaDebug("Processing Meta Inbound: Page $pageId | Channel $channel");

    try {
        processMessagingEventAsync($pdo, $pageId, $event, $channel);
        return true;
    } catch (Exception $e) {
        logMetaDebug("Processor Job Critical Error: " . $e->getMessage());
        return false;
    }
}

/**
 * Process Single Messaging Event (Logic moved from meta_webhook.php)
 */
function processMessagingEventAsync($pdo, $pageId, $event, $channel = 'messaging')
{
    // Identify Sender (Customer) and Recipient (Page)
    $senderId = $event['sender']['id'] ?? null;
    $recipientId = $event['recipient']['id'] ?? null;

    if (!$senderId || !$recipientId)
        return;

    logMetaDebug("Event from PSID: $senderId | PageID: $pageId | Channel: $channel");

    $message = $event['message'] ?? [];
    $isEcho = $message['is_echo'] ?? false;

    // If sender is the page, it's an outbound message (echo)
    if ($senderId === $pageId && !$isEcho) {
        $isEcho = true;
    }

    if ($senderId === $pageId && !$isEcho)
        return;

    // 1. Handle MESSAGE Events
    if (isset($event['message'])) {
        $message = $event['message'];
        $mid = $message['mid'] ?? null;
        $text = $message['text'] ?? null;
        $attachments = $message['attachments'] ?? [];
        $appId = $message['app_id'] ?? null;

        // [SECURE FIX] Idempotency Lock MUST wrap the entire block, including Echoes
        $lockName = null;
        if ($mid) {
            $lockName = "meta_msg_" . md5($mid);
            // [FIX P15-B1] Use prepared statement for GET_LOCK — consistent with project-wide
            // advisory lock pattern (see track.php, forms.php). Even though md5($mid) is hex-only
            // (no injection risk), string interpolation is inconsistent with code standards.
            $pdo->prepare("SELECT GET_LOCK(?, 10)")->execute([$lockName]);
            
            $stmt = $pdo->prepare("SELECT id FROM meta_message_logs WHERE mid = ?");
            $stmt->execute([$mid]);
            if ($stmt->fetch()) {
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]); // [FIX P15-B1]
                return;
            }
        }

        // [BUG-FLOW-19] Wrap in try/finally so early returns ($isEcho, optin, quick_reply) ALWAYS release GET_LOCK
        try {
            if ($isEcho) {
                logMetaDebug("Echo detected for Page: $pageId. Logging outbound.");
                
                // Try to identify if this is our bot or a human
                $appId = $message['app_id'] ?? null;
                $metadata = $message['metadata'] ?? '';
                $isOurBot = false;
                
                if (strpos($metadata, 'autoflow_ai_bot') !== false) {
                    $isOurBot = true;
                } else if ($appId) {
                    try {
                        $stmtOurApp = $pdo->prepare("SELECT app_id FROM meta_app_configs WHERE page_id = ? LIMIT 1");
                        $stmtOurApp->execute([$pageId]);
                        $ourAppId = $stmtOurApp->fetchColumn();
                        if ($ourAppId && $appId == $ourAppId) {
                            $isOurBot = true;
                        }
                    } catch (Exception $e) { error_log('[meta_inbound] bot_detect fail: ' . $e->getMessage()); }
                }

                // [LOG] Store ALL outbound echo messages in DB
                try {
                    $type = !empty($attachments) ? 'attachment' : 'text';
                    $content = $text ?? json_encode($attachments);
                    $stmtLog = $pdo->prepare("INSERT INTO meta_message_logs 
                        (mid, page_id, psid, direction, message_type, content, attachments, status, timestamp, created_at)
                        VALUES (?, ?, ?, 'outbound', ?, ?, ?, 'sent', ?, NOW())");
                    $stmtLog->execute([
                        $mid,
                        $pageId,
                        $recipientId,
                        $type,
                        $content,
                        json_encode($attachments),
                        $event['timestamp']
                    ]);
                } catch (Exception $e) { error_log('[meta_inbound] outbound_log fail: ' . $e->getMessage()); }

                // [FIX] ONLY process further if it's a HUMAN reply, NOT our AI bot
                if (!$isOurBot && !empty($recipientId)) {
                    // 1. Insert echo to domation_ai_messages so it shows in UnifiedChat as 'human'
                    try {
                        $stmtProp = $pdo->prepare("SELECT ai_chatbot_id FROM meta_automation_scenarios WHERE meta_config_id = (SELECT id FROM meta_app_configs WHERE page_id = ? LIMIT 1) AND type = 'ai_reply' AND ai_chatbot_id IS NOT NULL LIMIT 1");
                        $stmtProp->execute([$pageId]);
                        $aiPropId = $stmtProp->fetchColumn();
                        if ($aiPropId) {
                            $metaVid = "meta_" . $recipientId;
                            $stmtConv = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? LIMIT 1");
                            $stmtConv->execute([$metaVid, $aiPropId]);
                            $convId = $stmtConv->fetchColumn();
                            if ($convId) {
                                $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message, created_at) VALUES (?, 'human', ?, NOW())")->execute([$convId, $content]);
                                $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$content, $convId]);
                            }
                        }
                    } catch (Exception $e) { error_log('[meta_inbound] echo_ai_sync fail: ' . $e->getMessage()); }

                    // Pause AI for 30 minutes
                    $pdo->prepare("UPDATE meta_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE page_id = ? AND psid = ?")->execute([$pageId, $recipientId]);

                    // Log activity to timeline
                    try {
                        $stmtSub = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
                        $stmtSub->execute([$recipientId]);
                        $mainSubId = $stmtSub->fetchColumn();
                        if ($mainSubId) {
                            $displayContent = mb_substr($content, 0, 1000);
                            $fullLogDetails = "Tư vấn viên trả lời qua Facebook (App ID: " . ($appId ?: 'Direct') . "): " . $displayContent;

                            require_once 'flow_helpers.php';
                            logActivity($pdo, $mainSubId, 'staff_reply', null, 'Facebook Messenger', $fullLogDetails, null, null);
                        }
                    } catch (Exception $e) {
                        error_log('[meta_inbound] staff_reply log fail: ' . $e->getMessage());
                    }
                }
                return;
            }

            // 1.1 Handle Optin Events (Checkboxes, Send to Messenger)
            if (isset($event['optin'])) {
                $optin = $event['optin'];
                $ref = $optin['ref'] ?? null;
                $userUuid = upsertSubscriberAsync($pdo, $pageId, $senderId, null, 'optin');

                require_once 'flow_helpers.php';
                $stmtM = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
                $stmtM->execute([$senderId]);
                $mainSubId = $stmtM->fetchColumn();
                if ($mainSubId) {
                    logActivity($pdo, $mainSubId, 'meta_optin', null, 'Facebook Messenger', "Khách hàng Opt-in qua Facebook" . ($ref ? " (Ref: $ref)" : ""), null, null);
                    if ($ref)
                        triggerFlows($pdo, $mainSubId, 'meta_ref', $ref);
                }
                return;
            }

            // Quick Reply Clicks
            if (isset($message['quick_reply'])) {
                $payload = $message['quick_reply']['payload'];
                upsertSubscriberAsync($pdo, $pageId, $senderId);

                if (strpos($payload, '__REPLY__:') === 0) {
                    $btnTitle = str_replace('__REPLY__:', '', $payload);
                    triggerAutomationAsync($pdo, $pageId, $senderId, $btnTitle);
                } else {
                    triggerAutomationAsync($pdo, $pageId, $senderId, $payload);
                }
                return;
            }

            // Standard Inbound Message
            try {
                $type = !empty($attachments) ? 'attachment' : 'text';
                $content = $text ?? json_encode($attachments);

                // Save log (duplicates already handled by dispatcher check, but safety here too)
                $stmt = $pdo->prepare("INSERT IGNORE INTO meta_message_logs 
                    (mid, page_id, psid, direction, message_type, content, attachments, status, timestamp, created_at, metadata)
                    VALUES (?, ?, ?, 'inbound', ?, ?, ?, 'received', ?, NOW(), ?)");
                $stmt->execute([$mid, $pageId, $senderId, $type, $content, json_encode($attachments), $event['timestamp'], json_encode(['channel' => $channel])]);

                // Update Subscriber Info & Lead Score (Message = +5 points)
                $hasExtractedData = upsertSubscriberAsync($pdo, $pageId, $senderId, $text, 'message');

                // Log to Main Timeline
                try {
                    $stmtSub = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
                    $stmtSub->execute([$senderId]);
                    $mainSubId = $stmtSub->fetchColumn();
                    if ($mainSubId) {
                        require_once 'flow_helpers.php';
                        $logText = "KH gửi tin nhắn qua Facebook (+5 điểm): " . mb_substr($content, 0, 500);
                        logActivity($pdo, $mainSubId, 'meta_message', null, 'Facebook Messenger', $logText, null, null);

                        // Trigger Flows
                        triggerFlows($pdo, $mainSubId, 'inbound_message', $text);
                    }
                } catch (Exception $e) {
                    error_log('[meta_inbound] flow_trigger log fail: ' . $e->getMessage());
                }

                // Sync AI Conversations
                try {
                    $stmtProp = $pdo->prepare("SELECT ai_chatbot_id FROM meta_automation_scenarios WHERE meta_config_id = (SELECT id FROM meta_app_configs WHERE page_id = ? LIMIT 1) AND type = 'ai_reply' AND ai_chatbot_id IS NOT NULL LIMIT 1");
                    $stmtProp->execute([$pageId]);
                    $aiPropId = $stmtProp->fetchColumn();

                    if ($aiPropId) {
                        $metaVid = "meta_" . $senderId;
                        $stmtConv = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? LIMIT 1");
                        $stmtConv->execute([$metaVid, $aiPropId]);
                        $convId = $stmtConv->fetchColumn();

                        if (!$convId) {
                            $convId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                            $pdo->prepare("INSERT INTO domation_ai_conversations (id, property_id, visitor_id, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, 'ai', NOW(), NOW(), NOW())")->execute([$convId, $aiPropId, $metaVid]);
                        }
                        $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$content, $convId]);
                    }
                } catch (Exception $e) {
                    error_log('[meta_inbound] conv_track fail: ' . $e->getMessage());
                }

                // ONLY Reply if channel is messaging (don't reply to standby)
                if ($channel === 'messaging') {
                    updateConversationState($pdo, $pageId, $senderId, $content, $event['timestamp']);
                    triggerAutomationAsync($pdo, $pageId, $senderId, $text, $hasExtractedData);
                }

            } catch (Exception $e) {
                error_log("DB Error in processMessagingEventAsync: " . $e->getMessage());
            }
        } finally {
            if ($lockName) {
                try {
                    $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
                } catch (Exception $eLock) {}
            }
        }
    }

    // 2. Handle POSTBACK Events
    elseif (isset($event['postback'])) {
        $payload = $event['postback']['payload'];
        $title = $event['postback']['title'] ?? 'Nút Facebook';
        upsertSubscriberAsync($pdo, $pageId, $senderId, null, 'postback');

        // Log Postback Activity
        try {
            $stmtSub = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
            $stmtSub->execute([$senderId]);
            $mainId = $stmtSub->fetchColumn();
            if ($mainId) {
                require_once 'flow_helpers.php';
                logActivity($pdo, $mainId, 'meta_postback', null, 'Facebook Messenger', "Click nút (+2 điểm): $title", null, null);
            }
        } catch (Exception $e) {
            error_log('[meta_inbound] postback_log fail: ' . $e->getMessage());
        }

        if ($channel === 'messaging') {
            if (strpos($payload, '__REPLY__:') === 0) {
                $btnTitle = str_replace('__REPLY__:', '', $payload);
                triggerAutomationAsync($pdo, $pageId, $senderId, $btnTitle);
            } else {
                triggerAutomationAsync($pdo, $pageId, $senderId, $payload);
            }
        }
    }

    // 3. Handle DELIVERY Events
    elseif (isset($event['delivery'])) {
        $mids = $event['delivery']['mids'] ?? [];
        foreach ($mids as $mid) {
            $pdo->prepare("UPDATE meta_message_logs SET status = 'delivered', updated_at = NOW() WHERE mid = ?")->execute([$mid]);
        }
    }

    // 4. Handle READ Events
    elseif (isset($event['read'])) {
        $watermark = $event['read']['watermark'];
        $pdo->prepare("UPDATE meta_message_logs SET status = 'read', updated_at = NOW() WHERE psid = ? AND timestamp <= ? AND status != 'read'")->execute([$senderId, $watermark]);

        $stmtS = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
        $stmtS->execute([$senderId]);
        $subId = $stmtS->fetchColumn();

        if ($subId) {
            $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, details, created_at) VALUES (?, 'read_meta', ?, NOW())")->execute([$subId, "Read up to $watermark"]);
        }
    }
}

/**
 * Upsert Subscriber Async logic with Scoring Logic
 */
function upsertSubscriberAsync($pdo, $pageId, $psid, $messageText = null, $eventType = 'activity')
{
    $id = md5($pageId . '_' . $psid);
    $dataCaptured = false;
    require_once __DIR__ . '/db_connect.php';
    $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
    $basePoints = (int)($LSC['leadscore_zalo_interact'] ?? 3); // Map Meta to Zalo interactions
    
    $points = max(1, floor($basePoints / 3)); // Activity
    if ($eventType === 'message')
        $points = $basePoints + 2;
    if ($eventType === 'postback' || $eventType === 'optin')
        $points = max(1, $basePoints - 1);

    $stmt = $pdo->prepare("SELECT name, email, phone, lead_score, notes FROM meta_subscribers WHERE id = ?");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    $newEmail = null;
    $newPhone = null;
    $extractedName = null;
    $mergedNotes = [];

    if ($messageText) {
        $lines = explode("\n", $messageText);
        $extraInfo = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line))
                continue;

            $foundField = false;
            if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $line, $matches)) {
                $newEmail = trim($matches[0]);
                $foundField = true;
            }
            $cleanedLine = str_replace([' ', '.', '-'], '', $line);
            if (preg_match('/(84|0[35789])([0-9]{8,10})\b/', $cleanedLine, $matches)) {
                $newPhone = $matches[0];
                if (strpos($newPhone, '84') === 0)
                    $newPhone = '0' . substr($newPhone, 2);
                $foundField = true;
            }
            if (preg_match('/(?:Full\s*name|Họ\s*tên|Tên|Name):\s*([^\n\r,]+)/iu', $line, $matches)) {
                $extractedName = trim($matches[1]);
                $foundField = true;
            }
            if (!$foundField && strpos($line, ':') !== false)
                $extraInfo[] = $line;
        }

        if (!empty($extraInfo) || $newEmail || $newPhone || $extractedName) {
            $existingNotesRaw = $existing['notes'] ?? '';
            $existingNotesArr = json_decode($existingNotesRaw, true) ?: [];
            $seenHashes = [];
            foreach ($existingNotesArr as $n) {
                $content = is_array($n) ? ($n['content'] ?? '') : (string) $n;
                $seenHashes[md5(trim($content))] = true;
                $mergedNotes[] = $n;
            }
            foreach ($extraInfo as $info) {
                $h = md5(trim($info));
                if (!isset($seenHashes[$h])) {
                    $mergedNotes[] = ['type' => 'meta_extra_info', 'content' => $info, 'created_at' => date('Y-m-d H:i:s')];
                    $seenHashes[$h] = true;
                }
            }
            if ($newEmail || $newPhone || $extractedName)
                $dataCaptured = true;
        }
    }

    $firstName = null;
    $lastName = null;
    $profilePic = null;
    $locale = null;
    $timezone = null;
    $gender = null;
    $fullName = null;
    $profileLink = null;
    if (!$existing || empty($existing['name'])) {
        $stmtPage = $pdo->prepare("SELECT page_access_token FROM meta_app_configs WHERE page_id = ?");
        $stmtPage->execute([$pageId]);
        $config = $stmtPage->fetch(PDO::FETCH_ASSOC);
        if ($config && !empty($config['page_access_token'])) {
            $profile = fetchMetaUserProfile($psid, $config['page_access_token']);
            if ($profile) {
                $firstName = $profile['first_name'];
                $lastName = $profile['last_name'];
                $profilePic = $profile['profile_pic'];
                $locale = $profile['locale'];
                $timezone = $profile['timezone'];
                $gender = $profile['gender'];
                $fullName = $profile['name'];
                $profileLink = $profile['profile_link'];
            }
        }
    }

    $finalName = $extractedName ?: $fullName;
    $sqlPart = "last_active_at = NOW(), lead_score = lead_score + ?"; // [FIX P36-MIP] No interpolation
    $params = [(int) $points]; // lead_score param injected first
    if ($finalName) {
        $sqlPart .= ", name = ?, first_name = ?";
        array_push($params, $finalName, $finalName);
    }
    if ($fullName) {
        $sqlPart .= ", last_name = ?, profile_pic = ?, locale = ?, timezone = ?, gender = ?, profile_link = ?";
        array_push($params, $lastName, $profilePic, $locale, $timezone, $gender, $profileLink);
    }
    if ($newEmail) {
        $sqlPart .= ", email = ?";
        $params[] = $newEmail;
    }
    if ($newPhone) {
        $sqlPart .= ", phone = ?";
        $params[] = $newPhone;
    }
    if (!empty($mergedNotes)) {
        $sqlPart .= ", notes = ?";
        $params[] = json_encode($mergedNotes);
    }

    $insertSql = "INSERT INTO meta_subscribers (id, page_id, psid, name, first_name, last_name, profile_pic, locale, timezone, gender, email, phone, last_active_at, created_at, lead_score, notes, profile_link)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)
                  ON DUPLICATE KEY UPDATE $sqlPart"; // [FIX P36-MIP] lead_score via ? binding
    $execParams = array_merge([$id, $pageId, $psid, $finalName, $firstName, $lastName, $profilePic, $locale, $timezone, $gender, $newEmail, $newPhone, (int)$points, json_encode($mergedNotes), $profileLink], $params);
    $pdo->prepare($insertSql)->execute($execParams);

    $mainSubId = syncMetaToMain($pdo, $id);
    if ($mainSubId) {
        require_once 'trigger_helper.php';
        checkDynamicTriggers($pdo, $mainSubId);
        if (!empty($messageText))
            triggerFlows($pdo, $mainSubId, 'inbound_message', $messageText);
    }
    return $dataCaptured;
}

/**
 * Trigger Automation Async
 */
function triggerAutomationAsync($pdo, $pageId, $senderId, $text, $skipKeywords = false)
{
    if (empty($text))
        return;
    $stmt = $pdo->prepare("SELECT id, page_name FROM meta_app_configs WHERE page_id = ?");
    $stmt->execute([$pageId]);
    $config = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$config)
        return;

    $configId = $config['id'];
    $nowTime = date('H:i:s');
    $nowDay = date('w');

    logMetaDebug("Checking Automation for Page Config $configId (PSID: $senderId)");

    $stmtPause = $pdo->prepare("SELECT ai_paused_until FROM meta_subscribers WHERE page_id = ? AND psid = ?");
    $stmtPause->execute([$pageId, $senderId]);
    $pausedUntil = $stmtPause->fetchColumn();
    if ($pausedUntil && strtotime($pausedUntil) > time()) {
        logMetaDebug("AI is PAUSED for PSID: $senderId until $pausedUntil");
        return;
    }

    // Holiday Check
    $stmtH = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, image_url, schedule_type, active_days, start_time, end_time, holiday_start_at, holiday_end_at, priority_override, trigger_text FROM meta_automation_scenarios WHERE meta_config_id = ? AND type = 'holiday' AND status = 'active'"); // [FIX P38-MIP] Explicit columns
    $stmtH->execute([$configId]);
    while ($h = $stmtH->fetch()) {
        if (isScenarioActive($h, $nowTime, $nowDay)) {
            logMetaDebug("Holiday Scenario Triggered: " . $h['title']);
            executeScenario($pdo, $pageId, $senderId, $h);
            if ($h['priority_override'])
                return;
        }
    }

    if (!$skipKeywords) {
        $msgLower = mb_strtolower($text, 'UTF-8');
        $stmtS = $pdo->prepare("SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, image_url, trigger_text, match_type, priority_override, schedule_type, active_days, start_time, end_time FROM meta_automation_scenarios WHERE meta_config_id = ? AND type IN ('keyword', 'ai_reply') AND status = 'active' ORDER BY created_at DESC"); // [FIX P38-MIP] Explicit columns
        $stmtS->execute([$configId]);
        $scenarios = $stmtS->fetchAll();
        logMetaDebug("Found " . count($scenarios) . " potential scenarios for this page.");
        foreach ($scenarios as $s) {
            if (!isScenarioActive($s, $nowTime, $nowDay))
                continue;
            if ($s['type'] === 'ai_reply') {
                if (empty($s['trigger_text']) || $s['trigger_text'] === '*' || $s['trigger_text'] === 'default') {
                    processMetaAIMessage($pdo, $pageId, $senderId, $text, $s);
                    return;
                }
            }
            $keywords = array_map('trim', explode(',', mb_strtolower($s['trigger_text'] ?? '', 'UTF-8')));
            foreach ($keywords as $kw) {
                if (($s['match_type'] === 'contains' && mb_strpos($msgLower, $kw) !== false) || ($s['match_type'] === 'exact' && $msgLower === $kw)) {
                    executeScenario($pdo, $pageId, $senderId, $s);
                    return;
                }
            }
        }
    }
}

/**
 * AI Message Processor logic (Copied from meta_webhook.php)
 */
function processMetaAIMessage($pdo, $pageId, $senderId, $userMsg, $scenario)
{
    logMetaDebug("AI Step 1: Loading required files...");
    require_once 'chat_rag.php';
    require_once 'chat_gemini.php';
    require_once 'meta_sender.php';

    logMetaDebug("AI Step 2: Triggering typing indicator...");
    try {
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_on');
    } catch (Exception $e) {
        logMetaDebug("AI Warning: typing_on failed: " . $e->getMessage());
    }

    $aiBotId = $scenario['ai_chatbot_id'] ?? null;
    $historyLimit = (int) ($scenario['ai_history_limit'] ?? 10);
    $metaVid = "meta_" . $senderId;

    logMetaDebug("AI Step 3: Loading chat history for Bot: $aiBotId | Vid: $metaVid");
    $history = [];
    if ($aiBotId) {
        try {
            // [FIX] Changed 'role' to 'sender' to match DB schema
            $stmtH = $pdo->prepare("SELECT sender as role, message as content FROM domation_ai_messages WHERE (conversation_id = (SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? LIMIT 1)) ORDER BY created_at DESC LIMIT ?");
            $stmtH->execute([$metaVid, $aiBotId, $historyLimit]);
            $history = array_reverse($stmtH->fetchAll(PDO::FETCH_ASSOC));
            logMetaDebug("AI Step 4: History loaded (" . count($history) . " msgs)");
        } catch (Exception $e) {
            logMetaDebug("AI Error: History SQL failed: " . $e->getMessage());
        }
    }

    logMetaDebug("AI Step 5: Calling AI Chatbot Orchestrator via cURL...");
    $botMsg = '';
    try {
        $chatUrl = (defined('API_BASE_URL') ? API_BASE_URL : "https://automation.ideas.edu.vn/mail_api") . "/ai_chatbot.php";

        $postFields = [
            'message' => $userMsg,
            'property_id' => $aiBotId,
            'visitor_id' => $metaVid,
            'source' => 'messenger'
        ];

        $ch = curl_init($chatUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postFields));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $res = json_decode($response, true);
            // ai_chatbot.php returns the answer in data.message
            $botMsg = $res['reply'] ?? ($res['data']['message'] ?? ($res['answer'] ?? ($res['response'] ?? '')));
            logMetaDebug("AI Step 6: cURL Success. Answer length: " . mb_strlen($botMsg));
        } else {
            logMetaDebug("AI Step 6: cURL Failed with HTTP $httpCode. Response: " . substr($response, 0, 100));
        }
    } catch (Exception $e) {
        logMetaDebug("AI Step 6: cURL Exception: " . $e->getMessage());
        return;
    }

    // [FIX] Race condition check: Verify if AI is paused AGAIN right before sending.
    // A human agent might have replied while Gemini was generating this response.
    $stmtCheckPause = $pdo->prepare("SELECT ai_paused_until FROM meta_subscribers WHERE page_id = ? AND psid = ?");
    $stmtCheckPause->execute([$pageId, $senderId]);
    $finalCheck = $stmtCheckPause->fetchColumn();
    if ($finalCheck && strtotime($finalCheck) > time()) {
        logMetaDebug("AI Step 6.5: Aborting send! Human agent replied while generating. Paused until $finalCheck");
        return;
    }

    if ($botMsg) {
        $foundImageUrl = null;
        if (preg_match('/\[IMAGE:\s*(https?:\/\/[^\s\]]+)\]/iu', $botMsg, $matchesImg)) {
            $foundImageUrl = trim($matchesImg[1]);
            $botMsg = trim(str_replace($matchesImg[0], '', $botMsg));
        }

        $actionButtons = [];
        if (preg_match('/\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?\s*(.*?)\]/ius', $botMsg, $matches)) {
            $rawActions = $matches[1];
            $botMsg = trim(str_replace($matches[0], '', $botMsg));
            $separator = (strpos($rawActions, '|') !== false) ? '|' : ',';
            foreach (explode($separator, $rawActions) as $act) {
                if ($act = trim($act))
                    $actionButtons[] = ['type' => 'postback', 'title' => mb_substr($act, 0, 20), 'payload' => $act];
            }
        }

        $botMsg = preg_replace('/\[[A-Z_]+(?::\s*.*?)?\]/ius', '', $botMsg);

        $urlButtons = [];
        if (preg_match_all('/https?:\/\/[^\s\)]+/u', $botMsg, $linkMatches)) {
            foreach (array_unique($linkMatches[0]) as $link) {
                if ($foundImageUrl && $link === $foundImageUrl) {
                    $botMsg = trim(str_replace($link, '', $botMsg));
                    continue;
                }
                $urlButtons[] = ['type' => 'web_url', 'url' => $link, 'title' => 'Xem chi tiết'];
                $botMsg = trim(str_replace($link, '', $botMsg));
            }
        }

        // [FIX] Strip all Markdown for Meta Messenger AFTER parsing links
        require_once 'zalo_formatter.php';
        $botMsg = formatZaloMessage($botMsg);

        $finalButtons = array_slice($urlButtons, 0, 3);
        $quickReplies = [];
        foreach ($actionButtons as $btn) {
            if (count($quickReplies) < 13)
                $quickReplies[] = ['content_type' => 'text', 'title' => $btn['title'], 'payload' => $btn['payload']];
        }
        if (count($urlButtons) > 3) {
            foreach (array_slice($urlButtons, 3) as $ov) {
                if (count($quickReplies) < 13)
                    $quickReplies[] = ['content_type' => 'text', 'title' => mb_substr($ov['title'], 0, 20), 'payload' => $ov['url']];
            }
        }

        $botMsg = preg_replace('/:\s*$/u', '.', $botMsg);
        if (empty(trim($botMsg)))
            $botMsg = "Dạ, mời Anh/Chị xem thông tin chi tiết ạ:";

        // [META] Chia tin dài thành nhiều đoạn theo paragraph (không cắt cứng ký tự)
        if (mb_strlen($botMsg) > 2000) {
            $chunks = splitLongMessage($botMsg, 1900);
            
            $lastChunk = array_pop($chunks);
            foreach ($chunks as $c) {
                sendMetaMessage($pdo, $pageId, $senderId, ['text' => $c]);
                usleep(400000); // 0.4s
            }
            sendMetaMessage($pdo, $pageId, $senderId, ['text' => $lastChunk, 'quick_replies' => !empty($quickReplies) ? array_slice($quickReplies, 0, 13) : null]);
        } else {
            sendMetaMessage($pdo, $pageId, $senderId, ['text' => $botMsg, 'quick_replies' => !empty($quickReplies) ? array_slice($quickReplies, 0, 13) : null]);
        }
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_off');
    } else {
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_off');
    }
}

/**
 * Execute a Scenario (Send Reply)
 */
function executeScenario($pdo, $pageId, $senderId, $scenario)
{
    $formattedMsg = [];
    $persistentButtons = [];
    $quickReplies = [];

    if (!empty($scenario['buttons'])) {
        $rawButtons = json_decode($scenario['buttons'], true);
        if (is_array($rawButtons)) {
            foreach ($rawButtons as $btn) {
                if ($btn['type'] === 'web_url') {
                    $persistentButtons[] = ['type' => 'web_url', 'url' => $btn['url'], 'title' => $btn['title']];
                } elseif ($btn['type'] === 'phone_number') {
                    $persistentButtons[] = ['type' => 'phone_number', 'title' => $btn['title'], 'payload' => $btn['payload']];
                } elseif ($btn['type'] === 'postback') {
                    $persistentButtons[] = ['type' => 'postback', 'title' => $btn['title'], 'payload' => $btn['payload']];
                } elseif ($btn['type'] === 'reply') {
                    $quickReplies[] = ['content_type' => 'text', 'title' => mb_substr($btn['title'], 0, 20), 'payload' => '__REPLY__:' . $btn['title']];
                }
            }
        }
    }

    $title = !empty($scenario['title']) ? $scenario['title'] : (!empty($scenario['content']) ? $scenario['content'] : 'Thông báo');
    $subtitle = !empty($scenario['content']) ? $scenario['content'] : '';
    $imageUrl = !empty($scenario['image_url']) ? $scenario['image_url'] : '';
    $attachmentId = !empty($scenario['attachment_id']) ? $scenario['attachment_id'] : '';

    if ($scenario['message_type'] === 'text') {
        if (!empty($persistentButtons)) {
            if (count($persistentButtons) > 3) {
                $formattedMsg = ['attachment' => ['type' => 'template', 'payload' => ['template_type' => 'generic', 'elements' => [['title' => mb_substr($title, 0, 80), 'subtitle' => mb_substr($subtitle, 0, 80), 'buttons' => array_slice($persistentButtons, 0, 3)]]]]];
            } else {
                $formattedMsg = ['attachment' => ['type' => 'template', 'payload' => ['template_type' => 'button', 'text' => mb_substr($subtitle ?: $title, 0, 640), 'buttons' => $persistentButtons]]];
            }
        } else {
            $text = $scenario['content'] ?: '...';
            if (mb_strlen($text) > 2000) {
                $chunks = mb_str_split($text, 1950);
                $lastChunk = array_pop($chunks);
                foreach ($chunks as $c) {
                    sendMetaMessage($pdo, $pageId, $senderId, ['text' => $c]);
                    usleep(300000);
                }
                $formattedMsg = ['text' => $lastChunk];
            } else {
                $formattedMsg = ['text' => $text];
            }
        }
    } elseif ($scenario['message_type'] === 'image') {
        if (!empty($persistentButtons)) {
            $formattedMsg = ['attachment' => ['type' => 'template', 'payload' => ['template_type' => 'generic', 'elements' => [['title' => mb_substr($title, 0, 80), 'subtitle' => mb_substr($subtitle, 0, 80), 'buttons' => array_slice($persistentButtons, 0, 3), 'image_url' => $imageUrl ?: null]]]]];
        } else {
            $formattedMsg = ['attachment' => ['type' => 'image', 'payload' => ['url' => $imageUrl, 'is_reusable' => true]]];
            if ($attachmentId)
                $formattedMsg['attachment']['payload']['attachment_id'] = $attachmentId;
        }
    }

    if (!empty($quickReplies)) {
        $formattedMsg['quick_replies'] = array_slice($quickReplies, 0, 13);
    }

    if (!empty($formattedMsg)) {
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_on');
        sendMetaMessage($pdo, $pageId, $senderId, $formattedMsg);
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_off');
    }
}

/**
 * Check if Scenario is active based on schedule
 */
function isScenarioActive($scenario, $nowTime, $nowDay)
{
    if (($scenario['schedule_type'] ?? 'full') === 'full')
        return true;
    if (isset($scenario['active_days']) && strpos($scenario['active_days'], '{') === 0) {
        $custom = json_decode($scenario['active_days'], true);
        if (isset($custom[$nowDay])) {
            $s = $custom[$nowDay]['start'] ?? '00:00';
            $e = $custom[$nowDay]['end'] ?? '23:59';
            return ($s > $e) ? ($nowTime >= $s || $nowTime <= $e) : ($nowTime >= $s && $nowTime <= $e);
        }
        return false;
    }
    $days = explode(',', $scenario['active_days'] ?? '0,1,2,3,4,5,6');
    if (!in_array((string) $nowDay, $days))
        return false;
    $s = $scenario['start_time'] ?? '00:00:00';
    $e = $scenario['end_time'] ?? '23:59:59';
    return ($s > $e) ? ($nowTime >= $s || $nowTime <= $e) : ($nowTime >= $s && $nowTime <= $e);
}

