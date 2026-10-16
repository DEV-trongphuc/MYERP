<?php
/**
 * Meta Messenger Webhook Handler (Production)
 * Endpoint: /api/meta_webhook.php
 */

require_once 'db_connect.php';
require_once 'meta_sender.php'; // Includes helper to update conversation state
require_once 'meta_sync_helpers.php'; // Handle sync to Audience
require_once 'meta_helpers.php'; // Required for logMetaJourney and profile fetching

// Keep logging for debugging initially
$LOG_FILE = __DIR__ . '/meta_webhook_prod.log';

function writeLog($data)
{
    global $LOG_FILE;

    // Auto-clear if log is > 10MB
    if (file_exists($LOG_FILE) && filesize($LOG_FILE) > 10 * 1024 * 1024) {
        file_put_contents($LOG_FILE, date('[Y-m-d H:i:s] ') . "Log cleared (exceeded 10MB)\n");
    }

    file_put_contents($LOG_FILE, date('[Y-m-d H:i:s] ') . print_r($data, true) . "\n", FILE_APPEND);
}

// =============================================================================
// 1. VERIFICATION REQUEST (GET)
// =============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? null;
    $token = $_GET['hub_verify_token'] ?? null;
    $challenge = $_GET['hub_challenge'] ?? null;

    if ($mode && $token && $challenge) {
        // Check against ALL active configs in DB
        // (Since multiple pages might point here, we check if ANY match)
        $stmt = $pdo->prepare("SELECT id FROM meta_app_configs WHERE verify_token = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$token]);

        if ($stmt->fetch()) {
            http_response_code(200);
            echo $challenge;
            exit;
        } else {
            http_response_code(403);
            echo "Invalid Verify Token";
            exit;
        }
    }
}

// =============================================================================
// 2. EVENT HANDLING (POST)
// =============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');

    // [FIX P16-C1] X-Hub-Signature-256 Verification — CRITICAL
    // Meta sends header: X-Hub-Signature-256: sha256=<HMAC(app_secret, raw_body)>
    // Without this check, ANY attacker who knows the webhook URL can inject fake events
    // to trigger automation flows, create fake leads, or spam AI chatbot responses.
    $sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
    if (!empty($sigHeader)) {
        // Fetch ALL active app secrets and verify against any one of them.
        // (Multi-page setup: different pages use different app_secrets)
        try {
            $stmtSecrets = $pdo->prepare("SELECT app_secret FROM meta_app_configs WHERE status = 'active' AND app_secret IS NOT NULL AND app_secret != ''");
            $stmtSecrets->execute();
            $secrets = $stmtSecrets->fetchAll(PDO::FETCH_COLUMN);

            // [DEBUG] Log secret count and partial info to diagnose MISMATCH
            writeLog("[DEBUG SIG] Found " . count($secrets) . " secret(s) in DB. Header=" . substr($sigHeader, 0, 20) . "...");

            // [FIX BUG-MW-1] CRITICAL: When no secrets are configured, REJECT instead of allowing through.
            // Old behavior: if DB has no app_secret, any attacker knowing the webhook URL could inject
            // fake events (fake leads, fake purchases, spam AI chatbot) during initial setup or after
            // an accidental secret wipe. This is a critical window of vulnerability.
            // New behavior: 503 Service Unavailable — safer to lose some events than to process unsigned ones.
            if (empty($secrets)) {
                writeLog("[CRITICAL] No app_secret in DB! Cannot verify X-Hub-Signature-256. Rejecting request. Please configure app_secret in Meta Config.");
                http_response_code(503);
                echo json_encode(['error' => 'Webhook signature verification not configured. Contact administrator.']);
                exit;
            } else {
                $signatureValid = false;
                foreach ($secrets as $idx => $appSecret) {
                    $expectedSig = 'sha256=' . hash_hmac('sha256', $input, $appSecret);
                    $secretLen = strlen($appSecret);
                    $expectedPrefix = substr($expectedSig, 0, 20);
                    writeLog("[DEBUG SIG] Secret[$idx] len=$secretLen, expected=" . $expectedPrefix . "...");
                    if (hash_equals($expectedSig, $sigHeader)) {
                        $signatureValid = true;
                        writeLog("[DEBUG SIG] ✅ Match with secret[$idx]");
                        break;
                    }
                }
                if (!$signatureValid) {
                    writeLog("[SECURITY P16-C1] X-Hub-Signature-256 MISMATCH. Rejecting request. Secrets tried: " . count($secrets));
                    http_response_code(403);
                    echo 'SIGNATURE_MISMATCH';
                    exit;
                }
            }
        } catch (Exception $e) {
            // If DB fails, log but allow through to prevent total outage
            writeLog("[WARN P16-C1] Could not verify signature (DB error): " . $e->getMessage());
        }
    } else {
        // [FIX R3-H01] No X-Hub-Signature-256 header — reject instead of silently processing.
        // Meta ALWAYS sends this header in production webhooks (since API v2.2+).
        // A missing header indicates: (a) a fake/test POST not from Meta, or (b) a stripped header.
        // Reject with 400 to block fake events while Meta dashboard test events will retry with the header.
        // To temporarily disable (e.g. local tunnel testing), set META_SKIP_SIG_CHECK=1 env var.
        if (!getenv('META_SKIP_SIG_CHECK')) {
            writeLog("[SECURITY R3-H01] Rejected POST: missing X-Hub-Signature-256 header.");
            http_response_code(400);
            echo json_encode(['error' => 'Missing webhook signature header']);
            exit;
        }
        writeLog("[WARN R3-H01] META_SKIP_SIG_CHECK enabled — allowing unsigned request (dev only).");
    }
    // [END SIGNATURE CHECK]


    $body = json_decode($input, true);
    writeLog($body); // Debug Log

    // [FIX] Acknowledge Facebook IMMEDIATELY to prevent 20-second timeouts.
    // If Gemini takes 35s to respond, Facebook will force-close the socket at 20s and kill PHP.
    // This allows PHP to run in the background safely.
    ignore_user_abort(true);
    if (!ob_get_level()) ob_start();
    http_response_code(200);
    echo 'EVENT_RECEIVED';
    header("Connection: close");
    header("Content-Length: " . ob_get_length());
    ob_end_flush();
    @ob_flush();
    flush();
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    if ($body && isset($body['object']) && $body['object'] === 'page') {

        foreach ($body['entry'] as $entry) {
            $pageId = $entry['id'];
            $entryTime = $entry['time'];

            // Loop through messaging & standby events (Standby is used if another bot is Primary)
            $channels = ['messaging', 'standby'];
            foreach ($channels as $ch) {
                if (isset($entry[$ch])) {
                    foreach ($entry[$ch] as $event) {
                        processMessagingEvent($pdo, $pageId, $event);
                    }
                }
            }
        }
    } else {
        // Not a page event, but we already responded 200 to keep Meta happy.
        // We do nothing else.
    }
}

/**
 * Process Single Messaging Event
 */
function processMessagingEvent($pdo, $pageId, $event)
{
    // Identify Sender (Customer) and Recipient (Page)
    $senderId = $event['sender']['id'] ?? null;
    $recipientId = $event['recipient']['id'] ?? null;

    if (!$senderId || !$recipientId)
        return;

    // Avoid self-loops (if Page sends message, it might look like an event too in some modes like 'standby')
    // [FIX] But ALLOW echos! If it's an echo, sender == pageId, we MUST process it to pause AI.
    $message = $event['message'] ?? [];
    $isEcho = $message['is_echo'] ?? false;

    // If sender is the page, it's an outbound message (echo)
    if ($senderId === $pageId && !$isEcho) {
        // Some tools don't send is_echo: true, but if it's from the page ID, it IS an echo.
        $isEcho = true;
    }

    if ($senderId === $pageId && !$isEcho)
        return;

    // ---------------------------------------------------------
    // 1. Handle MESSAGE Events
    // ---------------------------------------------------------
    if (isset($event['message'])) {
        $message = $event['message'];
        $mid = $message['mid'] ?? null;
        $text = $message['text'] ?? null;
        $attachments = $message['attachments'] ?? [];
        $appId = $message['app_id'] ?? null; // Messages from Page Inbox have NO app_id

        // [SECURE FIX] Idempotency Lock MUST wrap the entire block, including Echoes,
        // because Meta can retry Echoes and cause duplicate pause/reply actions.
        $lockName = null;
        if ($mid) {
            $lockName = "meta_msg_" . md5($mid);
            // [FIX P16-B1] Prepared statement for GET_LOCK — consistent with P15-B1 standard
            $pdo->prepare("SELECT GET_LOCK(?, 10)")->execute([$lockName]);

            $stmt = $pdo->prepare("SELECT id FROM meta_message_logs WHERE mid = ?");
            $stmt->execute([$mid]);
            if ($stmt->fetch()) {
                // Already processed, release and skip
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]); // [FIX P16-B1]
                return;
            }
        }

        // [BUG-FLOW-18] Wrap in try/finally so early returns ($isEcho, quick_reply) ALWAYS release GET_LOCK
        try {
            if ($isEcho) {
                // Try to identify if this is our bot or a human
                $appId = $message['app_id'] ?? null;
                $ourAppId = null;
                try {
                    $stmtOurApp = $pdo->prepare("SELECT app_id FROM meta_app_configs WHERE page_id = ? LIMIT 1");
                    $stmtOurApp->execute([$pageId]);
                    $ourAppId = $stmtOurApp->fetchColumn();
                } catch (Exception $e) {
                }

                $metaDataVal = $message['metadata'] ?? '';
                $isOurBot = ($appId && $ourAppId && (string) $appId === (string) $ourAppId) || ($metaDataVal === 'autoflow_ai_bot');

                // [LOG] Store ALL outbound echo messages in meta_message_logs (for data retention)
                try {
                    $type = !empty($attachments) ? 'attachment' : 'text';
                    $content = $text ?? json_encode($attachments);
                    $stmtLog = $pdo->prepare("INSERT INTO meta_message_logs 
                        (mid, page_id, psid, direction, message_type, content, attachments, status, timestamp, created_at)
                        VALUES (?, ?, ?, 'outbound', ?, ?, ?, 'sent', ?, NOW())");
                    $stmtLog->execute([
                        $mid, $pageId, $recipientId, $type, $content, json_encode($attachments), $event['timestamp']
                    ]);
                } catch (Exception $e) { /* ignore log error */ }

                // [FIX] ONLY process further if it's a HUMAN reply, NOT our AI bot
                // (Because AI Chatbot already logged its own message into domation_ai_messages directly)
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
                    } catch (Exception $e) {}

                    // 2. Pause AI for 30 minutes
                    $pdo->prepare("UPDATE meta_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE page_id = ? AND psid = ?")->execute([$pageId, $recipientId]);

                    // 3. Log activity to timeline for Main Subscriber
                    try {
                        $stmtSub = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
                        $stmtSub->execute([$recipientId]);
                        $mainSubId = $stmtSub->fetchColumn();
                        if ($mainSubId) {
                            $stmtCheck = $pdo->prepare("SELECT id, details FROM subscriber_activity WHERE subscriber_id = ? AND type = 'staff_reply' AND created_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND) ORDER BY created_at DESC LIMIT 1");
                            $stmtCheck->execute([$mainSubId]);
                            $recent = $stmtCheck->fetch(PDO::FETCH_ASSOC);

                            $displayContent = substr($content, 0, 1000);
                            $fullLogDetails = "Staff replied via Facebook (ID: " . ($appId ?: 'Direct') . "): " . $displayContent;

                            if ($recent) {
                                $newIsRich = (strpos($content, '[') === 0 || strpos($content, '{') === 0);
                                $oldIsRich = (strpos($recent['details'], '[') !== false || strpos($recent['details'], '{') !== false);
                                if ($newIsRich && !$oldIsRich) {
                                    $pdo->prepare("UPDATE subscriber_activity SET details = ? WHERE id = ?")->execute([$fullLogDetails, $recent['id']]);
                                }
                            } else {
                                $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, details, created_at) VALUES (?, 'staff_reply', ?, NOW())")->execute([$mainSubId, $fullLogDetails]);
                            }
                        }
                    } catch (Exception $e) {}

                    writeLog("Human reply (echo) detected (app_id: " . ($appId ?: 'none') . ") from Page $pageId to $recipientId. Pausing AI.");
                } else if ($isOurBot) {
                    writeLog("Our AI Bot echo detected ($appId). Not logging duplicate to domation_ai_messages.");
                }
                return;
            }
            // --- Handle Quick Reply Clicks ---
            if (isset($message['quick_reply'])) {
                $payload = $message['quick_reply']['payload'];
                writeLog("Quick Reply Clicked: " . $payload);

                try {
                    upsertSubscriber($pdo, $pageId, $senderId);
                    // logMetaJourney REMOVED: Keep journey clean of basic message events

                    if (strpos($payload, '__REPLY__:') === 0) {
                        $btnTitle = str_replace('__REPLY__:', '', $payload);
                        triggerAutomation($pdo, $pageId, $senderId, $btnTitle);
                    } else {
                        triggerAutomation($pdo, $pageId, $senderId, $payload);
                    }
                } catch (Exception $e) {
                    writeLog("[ERROR] Quick Reply Handler Failed: " . $e->getMessage());
                }
                return;
            }

            // --- A. Save to Database (Log) ---
            try {
                $type = !empty($attachments) ? 'attachment' : 'text';
                $content = $text ?? json_encode($attachments);

                $stmt = $pdo->prepare("INSERT INTO meta_message_logs 
                    (mid, page_id, psid, direction, message_type, content, attachments, status, timestamp, created_at)
                    VALUES (?, ?, ?, 'inbound', ?, ?, ?, 'received', ?, NOW())");

                $stmt->execute([
                    $mid,
                    $pageId,
                    $senderId,
                    $type,
                    $content,
                    json_encode($attachments),
                    $event['timestamp']
                ]);

                // --- B. Update Subscriber Info (Includes Regex Sync) ---
                $hasExtractedData = upsertSubscriber($pdo, $pageId, $senderId, $text);

                // --- [SYNC] AI Conversations Fix ---
                try {
                    // Find associated Chatbot ID from AI Scenario
                    $stmtProp = $pdo->prepare("SELECT ai_chatbot_id FROM meta_automation_scenarios WHERE meta_config_id = (SELECT id FROM meta_app_configs WHERE page_id = ? LIMIT 1) AND type = 'ai_reply' AND ai_chatbot_id IS NOT NULL LIMIT 1");
                    $stmtProp->execute([$pageId]);
                    $aiPropId = $stmtProp->fetchColumn();

                    if ($aiPropId) {
                        $metaVid = "meta_" . $senderId;
                        // Check/Create AI Conversation
                        $stmtConv = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE visitor_id = ? AND property_id = ? LIMIT 1");
                        $stmtConv->execute([$metaVid, $aiPropId]);
                        $convId = $stmtConv->fetchColumn();

                        if (!$convId) {
                            $convId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                            $pdo->prepare("INSERT INTO domation_ai_conversations (id, property_id, visitor_id, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, 'ai', NOW(), NOW(), NOW())")->execute([$convId, $aiPropId, $metaVid]);
                        }

                        // [NEW FIX] Insert visitor message so it shows in UnifiedChat before AI replies
                        $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message, created_at) VALUES (?, 'visitor', ?, NOW())")->execute([$convId, $content]);

                        // Update Last Message so it appears in Unified Chat list
                        // [FIX] If Lead Form Data collected (hasExtractedData), Force Status = 'ai' and Unpause
                        if ($hasExtractedData) {
                            $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW(), status = 'ai' WHERE id = ?")->execute([$content, $convId]);
                        } else {
                            $pdo->prepare("UPDATE domation_ai_conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$content, $convId]);
                        }
                    }
                } catch (Exception $e) { /* silent fail for list sync */
                }

                // --- C. Update Conversation State (Recent msg) ---
                updateConversationState($pdo, $pageId, $senderId, $content, $event['timestamp']);

                // logMetaJourney REMOVED: Keep journey clean of basic message events

                // --- E. Trigger Automation (Auto-Reply) ---
                // Moved BEFORE mark_seen/typing_on to allow early exit if inactive/out-of-hours
                triggerAutomation($pdo, $pageId, $senderId, $text, $hasExtractedData);
            } catch (Exception $e) {
                writeLog("DB Error in processMessagingEvent: " . $e->getMessage());
            }
        } finally {
            if ($lockName) {
                try {
                    $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
                } catch (Exception $eLock) {}
            }
        }
    }

    // ---------------------------------------------------------
    // 2. Handle POSTBACK Events (Button clicks)
    // ---------------------------------------------------------
    elseif (isset($event['postback'])) {
        $payload = $event['postback']['payload'];
        $title = $event['postback']['title'];

        // Log Postback
        upsertSubscriber($pdo, $pageId, $senderId);
        // logMetaJourney REMOVED: Keep journey clean of basic message events

        // Specialized handling for Reply Buttons (from our Scenario Modal)
        if (strpos($payload, '__REPLY__:') === 0) {
            $btnTitle = str_replace('__REPLY__:', '', $payload);
            triggerAutomation($pdo, $pageId, $senderId, $btnTitle);
        } else {
            triggerAutomation($pdo, $pageId, $senderId, $payload); // Treat payload as text trigger
        }
    }

    // ---------------------------------------------------------
    // 3. Handle DELIVERY Events
    // ---------------------------------------------------------
    elseif (isset($event['delivery'])) {
        $mids = $event['delivery']['mids'] ?? [];
        foreach ($mids as $mid) {
            $pdo->prepare("UPDATE meta_message_logs SET status = 'delivered' WHERE mid = ?")->execute([$mid]);
        }
    }

    // ---------------------------------------------------------
    // 4. Handle READ Events
    // ---------------------------------------------------------
    elseif (isset($event['read'])) {
        $watermark = $event['read']['watermark'];
        // Mark all messages before watermark as read
        $pdo->prepare("UPDATE meta_message_logs SET status = 'read' WHERE psid = ? AND timestamp <= ? AND status != 'read'")->execute([$senderId, $watermark]);

        // Log Activity for Flow Conditions
        $stmtS = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? LIMIT 1");
        $stmtS->execute([$senderId]);
        $subId = $stmtS->fetchColumn();

        if ($subId) {
            // Log 'read_meta' activity
            $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, details, created_at) VALUES (?, 'read_meta', ?, NOW())")->execute([$subId, "Read up to $watermark"]);
        }
    }
}

/**
 * Upsert Subscriber (Create if new, update last active, Sync Email/Phone)
 */
function upsertSubscriber($pdo, $pageId, $psid, $messageText = null)
{
    $id = md5($pageId . '_' . $psid);
    $dataCaptured = false;

    // 1. Check if subscriber exists and has info (and lead score/data)
    $stmt = $pdo->prepare("SELECT name, email, phone, lead_score, notes FROM meta_subscribers WHERE id = ?");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Regex Sync (Name/Email/Phone) if matched in text
    $newEmail = null;
    $newPhone = null;
    $extractedName = null;

    // 4. Update Database
    $params = [];
    require_once __DIR__ . '/db_connect.php';
    $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
    $basePoints = (int)($LSC['leadscore_zalo_interact'] ?? 3);
    $points = max(1, floor($basePoints / 3)); // Synchronous basic interaction
    $sqlPart = "last_active_at = NOW(), lead_score = lead_score + $points";

    if ($messageText) {
        $lines = explode("\n", $messageText);
        $extraInfo = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line))
                continue;

            $foundField = false;

            // 1. Email Extraction
            if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $line, $matches)) {
                $newEmail = trim($matches[0]);
                $foundField = true;
            }

            // 2. Phone Extraction
            $cleanedLine = str_replace([' ', '.', '-'], '', $line);
            if (preg_match('/(84|0[35789])([0-9]{8,10})\b/', $cleanedLine, $matches)) {
                $newPhone = $matches[0];
                if (strpos($newPhone, '84') === 0) {
                    $newPhone = '0' . substr($newPhone, 2);
                }
                $foundField = true;
            }

            // 3. Name Extraction
            if (preg_match('/(?:Full\s*name|Họ\s*tên|Tên|Name):\s*([^\n\r,]+)/iu', $line, $matches)) {
                $extractedName = trim($matches[1]);
                $foundField = true;
            }

            // 4. Capture Extra Info if not a primary field
            if (!$foundField && strpos($line, ':') !== false) {
                $extraInfo[] = $line;
            }
        }

        // Log Extra Info to Journey/Notes if any
        if (!empty($extraInfo)) {
            logMetaJourney($pdo, $pageId, $psid, 'extra_info_captured', 'Thông tin bổ sung', ['data' => implode(' | ', $extraInfo)]);

            // Standardize as JSON array of objects for notes consistency
            $newNotes = [];
            foreach ($extraInfo as $info) {
                $newNotes[] = [
                    'type' => 'meta_extra_info',
                    'content' => $info,
                    'created_at' => date('Y-m-d H:i:s')
                ];
            }

            // Update $sqlPart to include notes appending (if column exists)
            // We'll use JSON_ARRAY_APPEND if available or just overwrite/merge in PHP if simpler
            // Let's assume we want to append to existing notes
            $existingNotesRaw = $existing['notes'] ?? '';
            $existingNotesArr = json_decode($existingNotesRaw, true);

            if (!is_array($existingNotesArr)) {
                $existingNotesArr = !empty($existingNotesRaw) ? [
                    [
                        'type' => 'manual_note',
                        'content' => $existingNotesRaw,
                        'created_at' => date('Y-m-d H:i:s')
                    ]
                ] : [];
            }
            // Deduplicate notes before updating
            $mergedNotes = [];
            $seenHashes = [];

            // 1. Existing notes
            foreach ($existingNotesArr as $n) {
                $content = is_array($n) ? ($n['content'] ?? '') : (string) $n;
                $h = md5(trim($content));
                if (!isset($seenHashes[$h]) && !empty($content)) {
                    $seenHashes[$h] = true;
                    $mergedNotes[] = $n;
                }
            }

            // 2. New notes (e.g. from current message)
            foreach ($newNotes as $n) {
                $content = is_array($n) ? ($n['content'] ?? '') : (string) $n;
                $h = md5(trim($content));
                if (!isset($seenHashes[$h]) && !empty($content)) {
                    $seenHashes[$h] = true;
                    $mergedNotes[] = $n;
                }
            }

            $sqlPart .= ", notes = ?";
            $params[] = json_encode($mergedNotes);
        }

        // Mark as captured if we found substantial info (Name/Email/Phone)
        if ($newEmail || $newPhone || $extractedName) {
            $dataCaptured = true;
        }
    }

    // 3. Fetch Profile from Meta if new or name is empty (and we have page token)
    $firstName = null;
    $lastName = null;
    $profilePic = null;
    $locale = null;
    $timezone = null;
    $gender = null;
    $fullName = null;
    $profileLink = null;

    if (!$existing || empty($existing['name'])) {
        // Get Page Access Token
        $stmtPage = $pdo->prepare("SELECT page_access_token FROM meta_app_configs WHERE page_id = ?");
        $stmtPage->execute([$pageId]);
        $config = $stmtPage->fetch(PDO::FETCH_ASSOC);

        if ($config && !empty($config['page_access_token'])) {
            require_once 'meta_helpers.php';
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

    // Always update last_active, increment score
    // (sqlPart initialized earlier)

    // Update Name if extracted from text (prio) OR fetched from profile
    $finalName = $extractedName ?: $fullName;
    if ($finalName) {
        $sqlPart .= ", name = ?";
        $params[] = $finalName;

        // Ensure first_name is updated if missing (for UI list consistency)
        if (empty($firstName)) {
            $sqlPart .= ", first_name = ?";
            $params[] = $finalName;
            $firstName = $finalName; // for insert part
        }
    }

    if ($fullName) {
        $sqlPart .= ", first_name = ?, last_name = ?, profile_pic = ?, locale = ?, timezone = ?, gender = ?, profile_link = ?";
        array_push($params, $firstName, $lastName, $profilePic, $locale, $timezone, $gender, $profileLink);
    }

    if ($newEmail) {
        $sqlPart .= ", email = ?";
        $params[] = $newEmail;
        if (empty($existing['email']) || $existing['email'] !== $newEmail) {
            logMetaJourney($pdo, $pageId, $psid, 'data_captured', 'Thu thập Email', ['email' => $newEmail]);
        }
    }

    if ($newPhone) {
        $sqlPart .= ", phone = ?";
        $params[] = $newPhone;
        if (empty($existing['phone']) || $existing['phone'] !== $newPhone) {
            logMetaJourney($pdo, $pageId, $psid, 'data_captured', 'Thu thập SĐT', ['phone' => $newPhone]);
        }
    }

    // Base Insert
    $insertSql = "INSERT INTO meta_subscribers (id, page_id, psid, name, first_name, last_name, profile_pic, locale, timezone, gender, email, phone, last_active_at, created_at, lead_score, notes, profile_link)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1, ?, ?)
                  ON DUPLICATE KEY UPDATE $sqlPart";

    // Prepare Base Params for Insert
    $execParams = [$id, $pageId, $psid, $finalName, $firstName, $lastName, $profilePic, $locale, $timezone, $gender, $newEmail, $newPhone, json_encode($mergedNotes ?? []), $profileLink];

    // Add params for the UPDATE part
    $execParams = array_merge($execParams, $params);

    $stmt = $pdo->prepare($insertSql);
    $stmt->execute($execParams);

    // 5. Trigger Sync to Audience (Main List)
    $mainSubId = syncMetaToMain($pdo, $id);
    if ($mainSubId) {
        require_once 'trigger_helper.php';
        checkDynamicTriggers($pdo, $mainSubId);

        // [NEW] Trigger Inbound Message Flow
        if (!empty($text)) {
            triggerFlows($pdo, $mainSubId, 'inbound_message', $text);
        }
    }

    return $dataCaptured;
}

/**
 * Trigger Automation Logic
 */
function triggerAutomation($pdo, $pageId, $senderId, $text, $skipKeywords = false)
{
    if (empty($text))
        return;

    // [P23-L1 PERF] Only log debug trace when DEBUG_MODE is enabled.
    // In production, this fires on EVERY inbound message and adds to meta_webhook_prod.log
    // which is already 7.2MB and growing. The Page ID and text are personally identifiable.
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        writeLog("[DEBUG] Entering triggerAutomation: Page=$pageId, Text=" . mb_substr($text, 0, 50));
    }

    // Get Config ID first
    $stmt = $pdo->prepare("SELECT id, page_name FROM meta_app_configs WHERE page_id = ?");
    $stmt->execute([$pageId]);
    $config = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$config) {
        writeLog("No Config found for Page ID: $pageId");
        return;
    }

    $configId = $config['id'];
    $pageName = $config['page_name'] ?? 'Unknown Page';

    // Get Times
    $nowTime = date('H:i:s');
    $nowDay = date('w'); // 0 (Sun) to 6 (Sat)

    // [NEW] Consolidated Pause & Human Takeover Check
    // We check this FIRST to ensure total silence if a Human or Flow is active
    try {
        // 1. Check Global/Channel Pause Timer
        $stmtPause = $pdo->prepare("SELECT ai_paused_until FROM meta_subscribers WHERE page_id = ? AND psid = ?");
        $stmtPause->execute([$pageId, $senderId]);
        $pausedUntil = $stmtPause->fetchColumn();
        if ($pausedUntil && strtotime($pausedUntil) > time()) {
            writeLog("AI Paused for Sender: $senderId until $pausedUntil. Skipping all automation.");
            return;
        }

        // 2. Cooldown: Check if staff replied very recently (2 minutes)
        // We look for 'staff_reply' in subscriber_activity for the linked main subscriber
        $stmtStaff = $pdo->prepare("
            SELECT 1 FROM subscriber_activity sa
            JOIN subscribers s ON sa.subscriber_id = s.id
            WHERE s.meta_psid = ? AND sa.type = 'staff_reply' 
            AND sa.created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
            LIMIT 1
        ");
        $stmtStaff->execute([$senderId]);
        if ($stmtStaff->fetch()) {
            writeLog("Staff recently replied to $senderId (2m cooldown). Silencing AI.");
            return;
        }

        // 3. Flow Awareness: Silence if active in a flow
        $stmtFlow = $pdo->prepare("
            SELECT 1 FROM subscriber_flow_states sfs
            JOIN subscribers s ON sfs.subscriber_id = s.id
            WHERE s.meta_psid = ? AND sfs.status IN ('waiting', 'processing')
            LIMIT 1
        ");
        $stmtFlow->execute([$senderId]);
        if ($stmtFlow->fetch()) {
            writeLog("AI Silenced: Subscriber $senderId is active in a Flow.");
            return;
        }

        // 4. Conversation Status Check
        $metaVid = "meta_" . $senderId;
        $stmtStatus = $pdo->prepare("SELECT status FROM domation_ai_conversations WHERE visitor_id = ? AND status = 'human' LIMIT 1");
        $stmtStatus->execute([$metaVid]);
        if ($stmtStatus->fetchColumn() === 'human') {
            writeLog("AI Silenced: Conversation for Meta_$senderId is set to 'human' status.");
            return;
        }
    } catch (Exception $e) {
        writeLog("Error in Pause Check: " . $e->getMessage());
    }

    // 1. Check exact/keyword match scenarios
    // SKIP if we extracted data (Lead Form) to let AI handle it naturally
    if (!$skipKeywords) {
        $sql = "SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, image_url, trigger_text, match_type, priority_override, schedule_type, active_days, start_time, end_time FROM meta_automation_scenarios -- [FIX P38-MW] Explicit columns
            WHERE meta_config_id = ? AND status = 'active' AND type = 'keyword'
            ORDER BY priority_override DESC, created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$configId]);
        $scenarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($scenarios as $scenario) {
            if (!isScenarioActive($scenario, $nowTime, $nowDay))
                continue;

            $triggers = array_map('trim', explode(',', $scenario['trigger_text']));
            $matched = false;

            foreach ($triggers as $trigger) {
                if ($scenario['match_type'] === 'exact') {
                    if (strcasecmp($text, $trigger) === 0)
                        $matched = true;
                } else {
                    if (stripos($text, $trigger) !== false)
                        $matched = true;
                }
            }

            if ($matched) {
                // [UX] Show typing/seen ONLY for matched scenario
                require_once 'meta_sender.php';
                sendMetaSenderAction($pdo, $pageId, $senderId, 'mark_seen');
                sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_on');

                executeScenario($pdo, $pageId, $senderId, $scenario);
                return; // Stop after first match
            }
        }
    } // End skipKeywords Check

    // 1.5 Check for "Reply" buttons matching this text
    $stmtReply = $pdo->prepare("SELECT buttons FROM meta_automation_scenarios WHERE meta_config_id = ? AND status = 'active' AND buttons IS NOT NULL");
    $stmtReply->execute([$configId]);
    while ($rec = $stmtReply->fetch()) {
        $btns = json_decode($rec['buttons'] ?? '[]', true);
        foreach ($btns as $b) {
            if (isset($b['type']) && $b['type'] === 'reply' && !empty($b['auto_response_content'])) {
                if (strcasecmp(trim($b['title']), trim($text)) === 0) {
                    $tempScenario = [
                        'message_type' => 'text',
                        'content' => $b['auto_response_content'],
                        'title' => '',
                        'buttons' => '[]'
                    ];
                    executeScenario($pdo, $pageId, $senderId, $tempScenario);
                    return;
                }
            }
        }
    }

    // 2. If no keyword, check for 'ai_reply' scenario
    $sqlAI = "SELECT id, type, ai_chatbot_id, buttons, message_type, attachment_id, content, title, image_url, trigger_text, schedule_type, active_days, start_time, end_time -- [FIX P38-MW] Explicit columns
              FROM meta_automation_scenarios
              WHERE meta_config_id = ? AND status = 'active' AND type = 'ai_reply'
              LIMIT 1";

    $stmtAI = $pdo->prepare($sqlAI);
    $stmtAI->execute([$configId]);
    $aiScenario = $stmtAI->fetch(PDO::FETCH_ASSOC);

    // [P23-L1 PERF] Guard verbose AI scenario debug log behind DEBUG_MODE.
    // This fires on every unanswered message even when AI is off-hours.
    if ($aiScenario) {
        $isActive = isScenarioActive($aiScenario, $nowTime, $nowDay);
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            writeLog("[DEBUG] AI Scenario Found: ID {$aiScenario['id']}, Schedule: {$aiScenario['schedule_type']}, Active: " . ($isActive ? 'YES' : 'NO') . ", Now: $nowTime (Dow: $nowDay)");
        }

        if ($isActive) {
            $chatbotId = $aiScenario['ai_chatbot_id'];
            if ($chatbotId) {
                // [UX] Only show Typing/Seen if AI is actually going to reply (Active & In-Hours)
                require_once 'meta_sender.php';
                sendMetaSenderAction($pdo, $pageId, $senderId, 'mark_seen');
                sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_on');

                writeLog("Triggering AI Chatbot: $chatbotId for Page: $pageName (Config: $configId)");
                processMetaAIMessage($pdo, $pageId, $senderId, $text, $chatbotId);
                return; // AI Handled it
            } else {
                writeLog("[ERROR] AI Scenario active but ai_chatbot_id is NULL");
            }
        }
    } else {
        // [FIX P31-L1] Wrap "No AI Scenario" debug log behind DEBUG_MODE guard.
        // Without guard, this fires for EVERY inbound message that has no AI match —
        // causing massive log growth in production (file reaches 10MB+ daily).
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            writeLog("[DEBUG] No AI Scenario Found matching config $configId");
        }
    }

    // Always ensure typing is off if we reached this point (no matches found)
    require_once 'meta_sender.php';
    sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_off');
}

/**
 * Handle AI Chatbot response for Meta
 */
function processMetaAIMessage($pdo, $pageId, $senderId, $text, $chatbotId)
{
    // [FIX P16-B2] Build AI URL from hardcoded API_BASE_URL constant instead of
    // $_SERVER['HTTP_HOST'] (SSRF risk: spoofable Host header in proxied environments).
    // API_BASE_URL is defined in db_connect.php from ENV_API_URL or auto-detected at startup.
    $apiUrl = (defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api') . "/ai_chatbot.php";

    writeLog("Calling AI Endpoint: " . $apiUrl);

    $postData = [
        'message' => $text,
        'visitor_id' => 'meta_' . $senderId,
        'property_id' => $chatbotId,
        'stream' => false
    ];

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60); 
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);

    // Start timer
    $startTime = microtime(true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $elapsed = microtime(true) - $startTime;

    curl_close($ch);

    writeLog("AI API Response (Code $httpCode, ${elapsed}s): " . substr($response, 0, 200) . ($curlError ? " Error: $curlError" : ""));

    // [FIX] Race condition check: Verify if AI is paused AGAIN right before sending.
    // A human agent might have replied while Gemini was generating this response.
    $stmtCheckPause = $pdo->prepare("SELECT ai_paused_until FROM meta_subscribers WHERE page_id = ? AND psid = ?");
    $stmtCheckPause->execute([$pageId, $senderId]);
    $finalCheck = $stmtCheckPause->fetchColumn();
    if ($finalCheck && strtotime($finalCheck) > time()) {
        writeLog("AI Step 6.5: Aborting send! Human agent replied while generating. Paused until $finalCheck");
        return;
    }

    writeLog("AI Response time: {$elapsed}s");

    $result = json_decode($response, true);
    if ($result && $result['success'] && (!empty($result['reply']) || !empty($result['data']['message']))) {
        $botMsg = $result['reply'] ?? $result['data']['message'];
        writeLog("AI RAW DATA: " . $botMsg);

        // 1.7 Check for Image URL in AI response (e.g. [IMAGE: https://xxx.jpg])
        $foundImageUrl = null;
        if (preg_match('/\[IMAGE:\s*(https?:\/\/[^\s\]]+)\]/iu', $botMsg, $matchesImg)) {
            $foundImageUrl = trim($matchesImg[1]);
            $botMsg = trim(str_replace($matchesImg[0], '', $botMsg));
        }

        // 2. Parse [ACTIONS: ...] into Buttons (formerly Quick Replies)
        $actionButtons = [];
        if (preg_match('/\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?\s*(.*?)\]/ius', $botMsg, $matches)) {
            $rawActions = $matches[1];
            $botMsg = trim(str_replace($matches[0], '', $botMsg));

            $separator = (strpos($rawActions, '|') !== false) ? '|' : ',';
            $actions = explode($separator, $rawActions);

            foreach ($actions as $act) {
                $act = trim($act);
                if (empty($act))
                    continue;
                $actionButtons[] = [
                    'type' => 'postback',
                    'title' => mb_substr($act, 0, 20), // Meta limit strictly 20 chars
                    'payload' => $act
                ];
            }
            writeLog("Parsed Action Buttons: " . count($actionButtons));
        }

        $urlButtons = [];
        $imgExtRegex = '/https?:\/\/[^\s\)]+(?:\.jpg|\.png|\.webp|\.jpeg|\.gif|\.bmp)/iu';

        // 3.1 Auto-detect image if no [IMAGE] tag was used
        if (!$foundImageUrl && preg_match($imgExtRegex, $botMsg, $matchesAutoImg)) {
            $foundImageUrl = trim($matchesAutoImg[0]);
        }

        // 3.2 Find all links to convert to Buttons and STRIP them from text
        $anyLinkRegex = '/https?:\/\/[^\s\)]+/u';
        if (preg_match_all($anyLinkRegex, $botMsg, $linkMatches)) {
            foreach (array_unique($linkMatches[0]) as $link) {
                if ($foundImageUrl && $link === $foundImageUrl) {
                    $botMsg = trim(str_replace($link, '', $botMsg));
                    continue;
                }
                $urlButtons[] = ['type' => 'web_url', 'url' => $link, 'title' => 'Xem chi tiết'];
                $botMsg = trim(str_replace($link, '', $botMsg));
            }
        }

        // [FIX] Format Markdown for Meta Messenger AFTER parsing links
        require_once 'zalo_formatter.php';
        $botMsg = formatZaloMessage($botMsg);

        // 1.8 Final Cleaning of internal tags
        $botMsg = str_replace('[SHOW_LEAD_FORM]', '', $botMsg);
        $botMsg = preg_replace('/\[[A-Z_]+\]/', '', $botMsg); // Strip [TAGS]
        $botMsg = preg_replace('/\[[A-Z_]+:\s*.*?\]/ius', '', $botMsg); // Strip any remaining [TAG: ...]
        $botMsg = trim($botMsg);
        // 3.3 Handle Layout: URL Buttons (Vertical) vs AI Actions (Horizontal Quick Replies)
        $finalButtons = array_slice($urlButtons, 0, 3); // Vertical (max 3)
        $quickReplies = [];

        // All AI Actions go to Horizontal Quick Replies (Hàng ngang)
        foreach ($actionButtons as $btn) {
            if (count($quickReplies) < 13) { // Meta limit is 13
                $quickReplies[] = [
                    'content_type' => 'text',
                    'title' => $btn['title'],
                    'payload' => $btn['payload']
                ];
            }
        }

        // Overflow URLs go to Quick Replies too
        if (count($urlButtons) > 3) {
            $overflow = array_slice($urlButtons, 3);
            foreach ($overflow as $ov) {
                if (count($quickReplies) < 13) {
                    $quickReplies[] = [
                        'content_type' => 'text',
                        'title' => mb_substr($ov['title'], 0, 20),
                        'payload' => $ov['url']
                    ];
                }
            }
        }

        if (!empty($quickReplies)) {
            writeLog("Prepared " . count($quickReplies) . " Horizontal Quick Replies.");
        }

        // Clean up trailing punctuation if we removed a link at the end
        $botMsg = preg_replace('/:\s*$/u', '.', $botMsg);
        $botMsg = trim($botMsg);
        if (empty($botMsg))
            $botMsg = "Dạ, mời Anh/Chị xem thông tin chi tiết ạ:";

        // 4. Send Message(s) - SMART DELIVERY (v32.0)
        require_once 'meta_sender.php';

        // 4.1 Split message into standard 2000-char chunks for Meta
        $messageChunks = [];
        $tempMsg = $botMsg;
        while (mb_strlen($tempMsg) > 2000) {
            $pos = mb_strrpos(mb_substr($tempMsg, 0, 2000), " ");
            if ($pos === false)
                $pos = 2000;
            $messageChunks[] = mb_substr($tempMsg, 0, $pos);
            $tempMsg = mb_substr($tempMsg, $pos);
        }
        if (mb_strlen($tempMsg) > 0)
            $messageChunks[] = $tempMsg;

        $totalChunks = count($messageChunks);
        foreach ($messageChunks as $index => $chunk) {
            $isLast = ($index === $totalChunks - 1);
            $formattedMsg = [];

            if ($isLast && !empty($finalButtons)) {
                // LAST CHUNK WITH BUTTONS -> Use Button Template (Max 3 buttons)
                $formattedMsg = [
                    'attachment' => [
                        'type' => 'template',
                        'payload' => [
                            'template_type' => 'button',
                            'text' => mb_substr($chunk, 0, 640), // Meta Button Template limit
                            'buttons' => array_slice($finalButtons, 0, 3)
                        ]
                    ]
                ];
            } else {
                // NORMAL TEXT CHUNK
                $formattedMsg = ['text' => $chunk];
            }

            // Attach Quick Replies to the very last text/button chunk
            if ($isLast && !empty($quickReplies)) {
                $formattedMsg['quick_replies'] = array_slice($quickReplies, 0, 13);
            }

            writeLog("Sending Meta Msg Chunk " . ($index + 1) . "/$totalChunks");
            sendMetaMessage($pdo, $pageId, $senderId, $formattedMsg);
        }

        // 4.2 Send Image as a SEPARATE bubble (More reliable than Generic Template)
        if ($foundImageUrl) {
            writeLog("Sending Image Bubble: $foundImageUrl");
            $imagePayload = [
                'attachment' => [
                    'type' => 'image',
                    'payload' => [
                        'url' => $foundImageUrl,
                        'is_reusable' => true
                    ]
                ]
            ];

            // Optional: If we have many quick replies, repeat them on the image bubble so they stay visible
            if (!empty($quickReplies)) {
                $imagePayload['quick_replies'] = array_slice($quickReplies, 0, 13);
            }

            sendMetaMessage($pdo, $pageId, $senderId, $imagePayload);
        }

        // Turn off typing indicator after sending
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_off');
    } else {
        // AI failed or returned empty - turn off typing anyway
        writeLog("AI Response Failed or empty data: " . json_encode($result));
        require_once 'meta_sender.php';
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

    // 1. Parse Buttons if any
    if (!empty($scenario['buttons'])) {
        $rawButtons = json_decode($scenario['buttons'], true);
        if (is_array($rawButtons)) {
            foreach ($rawButtons as $btn) {
                // Ensure valid button structure
                if ($btn['type'] === 'web_url') {
                    $persistentButtons[] = [
                        'type' => 'web_url',
                        'url' => $btn['url'],
                        'title' => $btn['title']
                    ];
                } elseif ($btn['type'] === 'phone_number') {
                    $persistentButtons[] = [
                        'type' => 'phone_number',
                        'title' => $btn['title'],
                        'payload' => $btn['payload'] // Phone number
                    ];
                } elseif ($btn['type'] === 'postback') {
                    $persistentButtons[] = [
                        'type' => 'postback',
                        'title' => $btn['title'],
                        'payload' => $btn['payload'] // Custom payload string
                    ];
                } elseif ($btn['type'] === 'reply') {
                    // Match Zalo's Phản hồi nhanh - use Meta Quick Replies
                    $quickReplies[] = [
                        'content_type' => 'text',
                        'title' => mb_substr($btn['title'], 0, 20),
                        'payload' => '__REPLY__:' . $btn['title']
                    ];
                }
            }
        }
    }

    // 2. Prepare Fallbacks
    $title = !empty($scenario['title']) ? $scenario['title'] : (!empty($scenario['content']) ? $scenario['content'] : 'Thông báo');
    $subtitle = !empty($scenario['content']) ? $scenario['content'] : '';
    $imageUrl = !empty($scenario['image_url']) ? $scenario['image_url'] : '';
    $attachmentId = !empty($scenario['attachment_id']) ? $scenario['attachment_id'] : '';

    // 3. Construct Message Payload
    if ($scenario['message_type'] === 'text') {
        if (!empty($persistentButtons)) {
            if (count($persistentButtons) > 3) {
                // Use Generic Template (Support up to 10 buttons across multiple elements, but here we do 1 element for now)
                $formattedMsg = [
                    'attachment' => [
                        'type' => 'template',
                        'payload' => [
                            'template_type' => 'generic',
                            'elements' => [
                                [
                                    'title' => mb_substr($title, 0, 80),
                                    'subtitle' => mb_substr($subtitle, 0, 80),
                                    'buttons' => array_slice($persistentButtons, 0, 3)
                                ]
                            ]
                        ]
                    ]
                ];
            } else {
                // Use Button Template
                $formattedMsg = [
                    'attachment' => [
                        'type' => 'template',
                        'payload' => [
                            'template_type' => 'button',
                            'text' => mb_substr($subtitle ?: $title, 0, 640),
                            'buttons' => $persistentButtons
                        ]
                    ]
                ];
            }
        } else {
            // Simple Text (or with Quick Replies)
            $formattedMsg = ['text' => $scenario['content'] ?: '...'];
        }
    } elseif ($scenario['message_type'] === 'image') {
        if (!empty($persistentButtons)) {
            // Images with buttons MUST use Generic Template (or Media Template with specialized IDs)
            // Generic is more reliable for external URLs.
            $formattedMsg = [
                'attachment' => [
                    'type' => 'template',
                    'payload' => [
                        'template_type' => 'generic',
                        'elements' => [
                            [
                                'title' => mb_substr($title, 0, 80),
                                'subtitle' => mb_substr($subtitle, 0, 80),
                                'buttons' => array_slice($persistentButtons, 0, 3)
                            ]
                        ]
                    ]
                ]
            ];
            // Add image source
            if ($attachmentId) {
                if ($imageUrl) {
                    $formattedMsg['attachment']['payload']['elements'][0]['image_url'] = $imageUrl;
                }
            } elseif ($imageUrl) {
                $formattedMsg['attachment']['payload']['elements'][0]['image_url'] = $imageUrl;
            }
        } else {
            // Simple Image Attachment
            $formattedMsg = [
                'attachment' => [
                    'type' => 'image',
                    'payload' => ['is_reusable' => true]
                ]
            ];
            if ($attachmentId) {
                $formattedMsg['attachment']['payload']['attachment_id'] = $attachmentId;
            } else {
                $formattedMsg['attachment']['payload']['url'] = $imageUrl;
            }
        }
    } elseif ($scenario['message_type'] === 'video') {
        if (!empty($persistentButtons)) {
            // Video with buttons uses Media Template
            $formattedMsg = [
                'attachment' => [
                    'type' => 'template',
                    'payload' => [
                        'template_type' => 'media',
                        'elements' => [
                            [
                                'media_type' => 'video',
                                'buttons' => array_slice($persistentButtons, 0, 3)
                            ]
                        ]
                    ]
                ]
            ];
            if ($attachmentId) {
                $formattedMsg['attachment']['payload']['elements'][0]['attachment_id'] = $attachmentId;
            } else {
                $formattedMsg['attachment']['payload']['elements'][0]['url'] = $imageUrl;
            }
        } else {
            // Simple Video Attachment
            $formattedMsg = [
                'attachment' => [
                    'type' => 'video',
                    'payload' => ['is_reusable' => true]
                ]
            ];
            if ($attachmentId) {
                $formattedMsg['attachment']['payload']['attachment_id'] = $attachmentId;
            } else {
                $formattedMsg['attachment']['payload']['url'] = $imageUrl;
            }
        }
    }

    // 4. Attach Quick Replies to any formattedMsg
    if (!empty($quickReplies)) {
        $formattedMsg['quick_replies'] = array_slice($quickReplies, 0, 13); // Meta limit
    }

    if (!empty($formattedMsg)) {
        writeLog("Executing Scenario: " . ($scenario['title'] ?? 'Unnamed'));
        require_once 'meta_sender.php';

        // Effect: Show "TYPING"
        sendMetaSenderAction($pdo, $pageId, $senderId, 'typing_on');

        sendMetaMessage($pdo, $pageId, $senderId, $formattedMsg);

        // Turn off typing indicator after sending
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

    // [NEW] Support per-day schedule in active_days (JSON)
    if (isset($scenario['active_days']) && strpos($scenario['active_days'], '{') === 0) {
        $custom = json_decode($scenario['active_days'], true);
        if (isset($custom[$nowDay])) {
            $s = $custom[$nowDay]['start'] ?? '00:00';
            $e = $custom[$nowDay]['end'] ?? '23:59';
            if ($s > $e) {
                // Overnight (e.g. 22:00 - 08:00)
                return ($nowTime >= $s || $nowTime <= $e);
            } else {
                // Normal (e.g. 08:00 - 17:00)
                return ($nowTime >= $s && $nowTime <= $e);
            }
        }
        return false;
    }

    $days = explode(',', $scenario['active_days'] ?? '0,1,2,3,4,5,6');
    if (!in_array((string) $nowDay, $days))
        return false;

    $s = $scenario['start_time'] ?? '00:00:00';
    $e = $scenario['end_time'] ?? '23:59:59';

    if ($s > $e) {
        // Overnight (e.g. 17:00 - 09:00)
        return ($nowTime >= $s || $nowTime <= $e);
    } else {
        // Normal (e.g. 08:00 - 17:00)
        return ($nowTime >= $s && $nowTime <= $e);
    }
}

?>
