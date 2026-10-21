<?php
// api/flow_helpers.php - OMNI-ENGINE V29.6 (SHARED HELPERS)
// Shared logic for worker_flow.php and worker_priority.php to ensure consistency and prevent duplication.

/**
 * Check if subscriber triggered an advancedExit condition (form submit, purchase, custom event).
 * Looks at activityCache first, falls back to DB query if needed.
 * Returns true if subscriber should exit the flow, false otherwise.
 */
if (!function_exists('isVirtualEmail')) {
    /**
     * Check if an email belongs to a virtual/non-email domain
     * Used to skip delivery and prevent quota waste.
     */
    function isVirtualEmail($email)
    {
        if (empty($email)) return true;
        $email = strtolower(trim($email));
        $virtualDomains = [
            '@no-email.domation',
            '@zalo-oa.vn',
            '@facebook.com'
        ];
        foreach ($virtualDomains as $domain) {
            if (strpos($email, $domain) !== false) {
                return true;
            }
        }
        return false;
    }
}

if (!function_exists('extractClickedUrlFromDetails')) {
    /**
     * Extract clean destination URL from subscriber_activity.details.
     * Strips prefixes like "Clicked link: ", "Clicked link (A) (+5 điểm): ",
     * "Zalo Clicked link/button (+3 điểm): ", etc.
     */
    function extractClickedUrlFromDetails($details)
    {
        if (empty($details) || !is_string($details)) {
            return '';
        }
        $clean = trim($details);
        // Strip standard activity log prefixes (with optional variation/score parentheses)
        $clean = preg_replace('/^(?:Zalo\s+)?Click(?:ed)?\s+(?:link(?:\/button)?|button)(?:\s*\([^)]*\))*:\s*/iu', '', $clean);
        $clean = trim($clean);
        // Fallback: if any prefix still precedes http(s):// (e.g. legacy mojibake or custom label)
        if (!preg_match('/^https?:\/\//i', $clean) && preg_match('/(https?:\/\/\S+)/i', $clean, $m)) {
            $clean = $m[1];
        }
        // Normalize bare domain URLs (e.g. "ideas.edu.vn/..." or "www.ideas.edu.vn")
        if ($clean !== '' && !preg_match('/^(?:https?:\/\/|mailto:|tel:|#|\/)/i', $clean)) {
            if (preg_match('/^[a-z0-9-]+(\.[a-z0-9-]+)+/i', $clean)) {
                $clean = 'https://' . $clean;
            }
        }
        return trim($clean);
    }
}

if (!function_exists('checkAdvancedExit')) {
    function checkAdvancedExit($pdo, $subscriberId, $enrolledAt, $advancedExitConfig, $activityCache = [])
    {
        if (empty($advancedExitConfig))
            return false;

        // Map section key → activity type stored in subscriber_activity
        $sectionTypeMap = [
            'forms' => 'form_submit',
            'purchases' => 'purchase',
            'customEvents' => 'custom_event',
        ];

        foreach ($sectionTypeMap as $section => $actType) {
            $cfg = $advancedExitConfig[$section] ?? [];
            if (empty($cfg['enabled']))
                continue;

            $isAll = !empty($cfg['all']);
            $targetIds = $cfg['ids'] ?? [];

            // 1. Check in-memory activityCache first (fast path)
            $foundInCache = false;
            foreach ($activityCache as $act) {
                if ($act['type'] !== $actType)
                    continue;
                // Check if activity happened AFTER enrollment
                if (!empty($enrolledAt) && $act['created_at'] <= $enrolledAt)
                    continue;

                if ($isAll || empty($targetIds)) {
                    $foundInCache = true;
                    break;
                }
                // Match specific IDs (reference_id stores form_id / purchase_event_id / custom_event_id)
                if (in_array($act['reference_id'], $targetIds)) {
                    $foundInCache = true;
                    break;
                }
            }

            if ($foundInCache)
                return true;

            // 2. Fallback to DB query (if activityCache didn't cover this type)
            // [FIX] Guard NULL/empty $enrolledAt: MySQL evaluates 'created_at > NULL' as UNKNOWN
            // (always false), making every exit condition silently inactive.
            $safeEnrolledAt = !empty($enrolledAt) ? $enrolledAt : '1970-01-01 00:00:00';
            if ($isAll || empty($targetIds)) {
                $stmt = $pdo->prepare(
                    "SELECT 1 FROM subscriber_activity WHERE subscriber_id = ? AND type = ? AND created_at > ? LIMIT 1"
                );
                $stmt->execute([$subscriberId, $actType, $safeEnrolledAt]);
            } else {
                $placeholders = implode(',', array_fill(0, count($targetIds), '?'));
                $stmt = $pdo->prepare(
                    "SELECT 1 FROM subscriber_activity WHERE subscriber_id = ? AND type = ? AND reference_id IN ($placeholders) AND created_at > ? LIMIT 1"
                );
                $stmt->execute(array_merge([$subscriberId, $actType], $targetIds, [$safeEnrolledAt]));
            }

            if ($stmt->fetchColumn())
                return true;
        }

        return false;
    }
}

if (!function_exists('logActivity')) {
    /**
     * Log activity for a subscriber with history limiting (keep last 10)
     */
    function logActivity($pdo, $subscriberId, $type, $referenceId, $referenceName, $details, $flowId = null, $campaignId = null, $extra = [], $workspaceId = null)
    {
        // ESSENTIAL ENGAGEMENT TYPES: Keep forever for accurate lifetime statistics
        // 10M UPDATE: Added system progression types (enter_flow, condition_true, etc.) to support Flow Analytics Journey View.
        $essentialTypes = [
            'open_email',
            'click_link',
            'receive_email',
            'failed_email',
            'unsubscribe',
            'form_submit',
            'purchase',
            'reply_email',
            'custom_event',
            'lead_score_sync',
            // Flow Progression Types (Required for "Passed Through" stats)
            'enter_flow',
            'update_tag',
            'list_action',
            'condition_true',
            'condition_false',
            'wait_processed',
            'remove_action',
            'ab_test_a',
            'ab_test_b',
            'advanced_condition',
            // Zalo Interaction Types
            'follow',
            'zalo_sent', // Added
            'meta_sent', // Added
            'user_reacted_message',
            'user_feedback',
            'user_send_text',
            // ZNS Types
            'sent_zns', // Added
            'zns_sent', // Added
            'zns_delivered',
            'zns_clicked',
            'click_zns',
            'zns_failed',
            'zns_replied',
            // Critical Flow Events
            'frequency_cap_reached',
            'complete_flow',
            'exit_flow',
            'unsubscribed_from_flow',
            'zns_skipped',
            'delete_contact',
            'web_activity',
            'survey_submit',
            'crm_action',
            'crm_update_stage',
            'crm_create_task',
            'crm_assign_owner',
            'crm_assign_round_robin',
            'crm_reassign_sla',
            'crm_update_temperature',
            'crm_notify_owner',
            'crm_create_ticket'
        ];

        // If it's a system progress event (wait, enter, exit, tag update, etc.), skip logging to keep Flow history clean
        if (!in_array($type, $essentialTypes)) {
            return;
        }

        // 10M UPGRADE: Static cache for existence check to reduce redundant queries
        static $subCache = [];
        $cacheKey = $workspaceId ? "{$workspaceId}:{$subscriberId}" : $subscriberId;
        if (!isset($subCache[$cacheKey])) {
            // [FIX] LRU-style cap
            if (count($subCache) > 500) {
                array_shift($subCache);
            }
            // [FIX] Scoped existence check
            $sqlCheck = "SELECT id FROM subscribers WHERE id = ?";
            $paramsCheck = [$subscriberId];
            if ($workspaceId) {
                $sqlCheck .= " AND workspace_id = ?";
                $paramsCheck[] = $workspaceId;
            }
            $stmtCheckSub = $pdo->prepare($sqlCheck);
            $stmtCheckSub->execute($paramsCheck);
            if (!$stmtCheckSub->fetch()) {
                $subCache[$cacheKey] = false;
                return;
            }
            $subCache[$cacheKey] = true;
        } else if ($subCache[$cacheKey] === false) {
            return;
        }

        // Prepare Extended Data
        $ip = $extra['ip'] ?? null;
        $ua = $extra['user_agent'] ?? null;
        $device = $extra['device_type'] ?? null;
        $os = $extra['os'] ?? null;
        $browser = $extra['browser'] ?? null;
        $location = $extra['location'] ?? null;

        // [PERFORMANCE] LOG BUFFERING
        // Instead of inserting directly into subscriber_activity (heavy index), we insert into activity_buffer.
        // A background worker will move these to the main table.

        // [FIX] Store BOTH key aliases to prevent downstream key-mismatch bugs:
        // - 'ua' and 'user_agent' for User-Agent string
        // - 'device' and 'device_type' for device category (desktop/mobile/tablet)
        $bufferExtra = array_merge($extra, [
            'reference_name' => $referenceName,
            'ip' => $ip,
            'ua' => $ua,
            'user_agent' => $ua,   // alias
            'device' => $device,
            'device_type' => $device, // alias
            'os' => $os,
            'browser' => $browser,
            'location' => $location,
            'workspace_id' => $workspaceId // [HARDENING] Pass workspace_id through buffer
        ]);
        // [PERFORMANCE] LOG BUFFERING (RAM LEVEL)
        // Convert sequential single writes (which choke MySQL connection pooling) into Mass DB Queries.
        // We accumulate both the `INSERT INTO activity_buffer` and the `UPDATE subscribers` here.
        global $GLOBAL_ACTIVITY_BUFFER;
        global $GLOBAL_SUBSCRIBER_ACTIVE_IDS;
        global $GLOBAL_ACTIVITY_REGISTERED;

        if (!is_array($GLOBAL_ACTIVITY_BUFFER)) $GLOBAL_ACTIVITY_BUFFER = [];
        if (!is_array($GLOBAL_SUBSCRIBER_ACTIVE_IDS)) $GLOBAL_SUBSCRIBER_ACTIVE_IDS = [];

        if (empty($GLOBAL_ACTIVITY_REGISTERED)) {
            $GLOBAL_ACTIVITY_REGISTERED = true;
            register_shutdown_function(function () use ($pdo) {
                if (function_exists('flushActivityLogBuffer')) {
                    flushActivityLogBuffer($pdo);
                }
            });
        }

        $jsonData = json_encode($bufferExtra) ?: '{}';
        $GLOBAL_ACTIVITY_BUFFER[] = [$subscriberId, $type, $details, $referenceId, $flowId, $campaignId, $jsonData];

        // For rich Tracking Data (OS, Browser) triggered by individual Tracker Webhooks, update immediately.
        // For Flow/Campaign Backend Workers (which spam 1000s of events like 'receive_email'), queue them for Bulk Update.
        if (!empty($os) || !empty($device) || !empty($browser) || !empty($location)) {
            $updateFields = ["last_activity_at = NOW()"];
            $updateParams = [];

            if (!empty($os)) { $updateFields[] = "last_os = ?"; $updateParams[] = $os; }
            if (!empty($device)) { $updateFields[] = "last_device = ?"; $updateParams[] = $device; }
            if (!empty($browser)) { $updateFields[] = "last_browser = ?"; $updateParams[] = $browser; }
            if (!empty($location)) { $updateFields[] = "last_city = ?"; $updateParams[] = $location; }

            $updateParams[] = $subscriberId;
            $sql = "UPDATE subscribers SET " . implode(', ', $updateFields) . " WHERE id = ?";
            if ($workspaceId) {
                $sql .= " AND workspace_id = ?";
                $updateParams[] = $workspaceId;
            }
            try { $pdo->prepare($sql)->execute($updateParams); } catch (Exception $e) {}
        } else {
            // [HARDENING] Store with workspaceId for scoped bulk update
            $GLOBAL_SUBSCRIBER_ACTIVE_IDS[$subscriberId] = $workspaceId ?: 1;
        }

        // Auto-flush every 150 items to prevent MySQL max_allowed_packet overload
        if (count($GLOBAL_ACTIVITY_BUFFER) >= 150) {
            flushActivityLogBuffer($pdo);
        }

        // NO CLEANUP for essential types. We want lifetime history for stats.

        // [10M UPGRADE] Event-Driven Flow Progression (Smart Trigger)
        // [FIX P12-H1] Added 'click_zns' alongside 'zns_clicked'.
        // tracking_processor.php + zalo_track.php log ZNS link clicks as 'click_zns' (P10-M1).
        // Without 'click_zns' here, ZNS click events never trigger priority worker kickoff
        // → flow Condition steps (wait for ZNS click) stay stuck until next scheduled cron tick.
        $triggerTypes = ['open_email', 'click_link', 'reply_email', 'zns_clicked', 'click_zns', 'zns_replied', 'form_submit', 'purchase', 'custom_event', 'survey_submit', 'voucher_redeem', 'OTP_VERIFIED'];

        if ($subscriberId && function_exists('domationSyncSubscriberMatchOnly')) {
            try {
                domationSyncSubscriberMatchOnly($pdo, $subscriberId);
            } catch (Exception $eSync) {}
        }

        if (in_array($type, $triggerTypes) && $subscriberId) {
            try {
                // Find flows where this subscriber is WAITING (Scoped by workspace_id)
                $sqlWait = "SELECT id, flow_id, step_type FROM subscriber_flow_states WHERE subscriber_id = ? AND status = 'waiting'";
                $paramsWait = [$subscriberId];
                if ($workspaceId) {
                    $sqlWait .= " AND workspace_id = ?";
                    $paramsWait[] = $workspaceId;
                }
                $stmtWait = $pdo->prepare($sqlWait);
                $stmtWait->execute($paramsWait);
                $waitingFlows = $stmtWait->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($waitingFlows)) {
                    // [BUG-FLOW-09] Update scheduled_at = NOW() so worker_flow.php STALE-GUARD does not skip the woken item
                    $waitIds = array_column($waitingFlows, 'id');
                    if (!empty($waitIds)) {
                        $wPh = implode(',', array_fill(0, count($waitIds), '?'));
                        $pdo->prepare("UPDATE subscriber_flow_states SET scheduled_at = NOW() WHERE id IN ($wPh) AND status = 'waiting'")
                            ->execute($waitIds);
                    }

                    $apiUrl = defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api';
                    if (strpos($apiUrl, 'http') === false)
                        $apiUrl = 'https://automation.ideas.edu.vn/mail_api';

                    $mh = curl_multi_init();
                    $channels = [];

                    foreach ($waitingFlows as $wf) {
                        // [HARDENING] Pass workspace_id to background worker
                        $url = $apiUrl . "/worker_flow.php?priority_queue_id=" . $wf['id'] . "&priority_sub_id=" . $subscriberId . "&priority_flow_id=" . $wf['flow_id'];
                        if ($workspaceId) {
                            $url .= "&workspace_id=" . $workspaceId;
                        }

                        $c = curl_init();
                        curl_setopt($c, CURLOPT_URL, $url);
                        curl_setopt($c, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($c, CURLOPT_TIMEOUT_MS, 200); // Fire and forget (200ms timeout)
                        curl_setopt($c, CURLOPT_NOSIGNAL, 1);
                        curl_setopt($c, CURLOPT_SSL_VERIFYPEER, true);
                        curl_setopt($c, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P36-FH] hostname verification
                        curl_multi_add_handle($mh, $c);
                        $channels[] = $c;
                    }

                    $running = null;
                    do {
                        $status = curl_multi_exec($mh, $running);
                        if ($running) {
                            // [PERF FIX] Reduced from 0.5s to 0.01s (fire-and-forget optimisation).
                            curl_multi_select($mh, 0.01);
                        }
                    } while ($running && $status == CURLM_OK);

                    foreach ($channels as $c) {
                        curl_multi_remove_handle($mh, $c);
                        curl_close($c);
                    }
                    curl_multi_close($mh);
                }
            } catch (Exception $e) {
                // checking flow states shouldn't break the main request
            }
        }
    }
}

if (!function_exists('flushActivityLogBuffer')) {
    /**
     * Dumps the accumulated Static RAM Buffer into MySQL in ONE bulk query.
     * MUST be called at the very end of ANY worker script (`worker_flow`, `worker_priority`, `worker_campaign`)
     */
    function flushActivityLogBuffer($pdo)
    {
        global $GLOBAL_ACTIVITY_BUFFER;
        global $GLOBAL_SUBSCRIBER_ACTIVE_IDS;

        if (empty($GLOBAL_ACTIVITY_BUFFER) || !is_array($GLOBAL_ACTIVITY_BUFFER)) return;

        // 1. Bulk Insert into `activity_buffer`
        $vals = [];
        $binds = [];
        foreach ($GLOBAL_ACTIVITY_BUFFER as $act) {
            $binds[] = "(?, ?, ?, ?, ?, ?, ?, ?)";
            // $act has [sub_id, type, details, ref_id, flow_id, camp_id, extra_data]
            // We need to inject workspace_id from $extra_data if present
            $extraData = json_decode($act[6], true);
            $wId = $extraData['workspace_id'] ?? 1; // Fallback to 1
            
            $vals[] = $act[0]; // sub_id
            $vals[] = $act[1]; // type
            $vals[] = $wId;    // workspace_id (NEW)
            $vals[] = $act[2]; // details
            $vals[] = $act[3]; // ref_id
            $vals[] = $act[4]; // flow_id
            $vals[] = $act[5]; // camp_id
            $vals[] = $act[6]; // extra_data
        }

        try {
            // [SELF-HEALING] Check if workspace_id column exists before inserting
            static $hasWorkspaceCol = null;
            if ($hasWorkspaceCol === null) {
                $check = $pdo->query("SHOW COLUMNS FROM activity_buffer LIKE 'workspace_id'");
                $hasWorkspaceCol = ($check->rowCount() > 0);
            }

            if ($hasWorkspaceCol) {
                $sql = "INSERT INTO activity_buffer (subscriber_id, type, workspace_id, details, reference_id, flow_id, campaign_id, extra_data) VALUES " . implode(',', $binds);
            } else {
                // Fallback for legacy schema (strip workspace_id from binds/vals)
                $legacyBinds = array_fill(0, count($GLOBAL_ACTIVITY_BUFFER), "(?, ?, ?, ?, ?, ?, ?)");
                $legacyVals = [];
                foreach ($GLOBAL_ACTIVITY_BUFFER as $act) {
                    $legacyVals[] = $act[0]; $legacyVals[] = $act[1]; $legacyVals[] = $act[2];
                    $legacyVals[] = $act[3]; $legacyVals[] = $act[4]; $legacyVals[] = $act[5]; $legacyVals[] = $act[6];
                }
                $sql = "INSERT INTO activity_buffer (subscriber_id, type, details, reference_id, flow_id, campaign_id, extra_data) VALUES " . implode(',', $legacyBinds);
                $vals = $legacyVals;
            }
            $pdo->prepare($sql)->execute($vals);
        } catch (Exception $e) {
            // Fallback: Create table if missing
            if (strpos($e->getMessage(), "doesn't exist") !== false) {
                try {
                    if (!$pdo->inTransaction()) {
                        $pdo->exec("CREATE TABLE IF NOT EXISTS activity_buffer (
                            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                            subscriber_id char(36) NOT NULL,
                            workspace_id INT DEFAULT 1,
                            type VARCHAR(50) NOT NULL,
                            details TEXT,
                            reference_id VARCHAR(100),
                            flow_id VARCHAR(50),
                            campaign_id VARCHAR(50),
                            extra_data JSON,
                            processed TINYINT(1) DEFAULT 0,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_processed (processed),
                            INDEX idx_workspace_id (workspace_id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

                        $sql = "INSERT INTO activity_buffer (subscriber_id, type, workspace_id, details, reference_id, flow_id, campaign_id, extra_data) VALUES " . implode(',', $binds);
                        $pdo->prepare($sql)->execute($vals);
                    }
                } catch (Exception $ex) {
                    // ignore
                }
            }
        }

        // 2. Bulk Update Last Activity (Grouped by workspace_id for strict isolation)
        if (!empty($GLOBAL_SUBSCRIBER_ACTIVE_IDS)) {
            $grouped = [];
            foreach ($GLOBAL_SUBSCRIBER_ACTIVE_IDS as $subId => $wId) {
                $grouped[$wId][] = $subId;
            }

            foreach ($grouped as $wId => $ids) {
                $chunks = array_chunk($ids, 500);
                foreach ($chunks as $chunk) {
                    $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                    $updateParams = array_merge($chunk, [$wId]);
                    try {
                        $pdo->prepare("UPDATE subscribers SET last_activity_at = NOW() WHERE id IN ($placeholders) AND workspace_id = ?")->execute($updateParams);
                    } catch (Exception $e) {}
                }
            }
        }

        // Reset buffers
        $GLOBAL_ACTIVITY_BUFFER = [];
        $GLOBAL_SUBSCRIBER_ACTIVE_IDS = [];
    }
}

/**
 * Dispatch a background job (or trigger immediate recursive worker)
 */
function dispatchFlowWorker($pdo, $type, $payload)
{
    $apiUrl = defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api';
    if (strpos($apiUrl, 'http') === false)
        $apiUrl = 'https://automation.ideas.edu.vn/mail_api';

    // 1. Recursive Priority Trigger (Immediate Chaining)
    if (isset($payload['priority_queue_id']) || ($payload['mode'] ?? '') === 'batch') {
        $params = http_build_query($payload);
        $workerUrl = $apiUrl . "/worker_priority.php?" . $params;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $workerUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, 200);
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P36-FH] hostname verification
        @curl_exec($ch);
        curl_close($ch);
        return;
    }

    // 2. Trigger Based Actions (e.g. Tag added)
    if ($type === 'flows' && isset($payload['trigger_type'])) {
        $workspaceId = $payload['workspace_id'] ?? null;
        // Direct call if helper is available, otherwise could rely on generic worker
        if (function_exists('enrollSubscribersBulk')) {
            $sIds = isset($payload['subscriber_id']) ? [$payload['subscriber_id']] : [];
            if (!empty($sIds)) {
                enrollSubscribersBulk($pdo, $sIds, $payload['trigger_type'], $payload['target_id'] ?? null, $workspaceId);
            }
        } else {
            // Fallback: Try to require trigger_helper if file exists
            if (file_exists(__DIR__ . '/trigger_helper.php')) {
                require_once __DIR__ . '/trigger_helper.php';
                if (function_exists('enrollSubscribersBulk')) {
                    $sIds = isset($payload['subscriber_id']) ? [$payload['subscriber_id']] : [];
                    if (!empty($sIds)) {
                        enrollSubscribersBulk($pdo, $sIds, $payload['trigger_type'], $payload['target_id'] ?? null, $workspaceId);
                    }
                }
            }
        }
    }
}

/**
 * [SES SHARED RATE LIMITER] Acquire a send-slot from a cross-process token bucket.
 *
 * Uses a file lock so ALL PHP workers (campaign + flow) share ONE rate counter.
 * This prevents the "10/s campaign + 10/s flow = 20/s → SES throttle" problem.
 *
 * Algorithm (non-blocking queue — lock held for microseconds only):
 *   1. Open shared file with LOCK_EX (held only for the read+write, not during sleep)
 *   2. Read the next available slot timestamp from the file
 *   3. Claim that slot (or now if slot is in the past)
 *   4. Advance the file pointer by $intervalUs microseconds
 *   5. Release lock immediately
 *   6. Sleep until the claimed slot (outside the lock — other workers proceed in parallel)
 *
 * @param int $intervalUs Microseconds between sends (default 100000 = 100ms = 10/s total)
 */
if (!function_exists('sesAcquireRateSlot')) {
    function sesAcquireRateSlot($intervalUs = 100000)
    {
        static $rlFile = null;
        if ($rlFile === null) {
            // Shared file accessible by all PHP processes on the same server
            $rlFile = __DIR__ . '/_locks/autoflow_ses_rl.bin';
        }

        $fp = @fopen($rlFile, 'c+');
        if (!$fp) {
            // If file cannot be opened (permissions issue), skip rate limiting rather than blocking all email
            return;
        }

        $mySlotUs = null;
        if (flock($fp, LOCK_EX)) {
            $content = fread($fp, 24); // 24 bytes enough for microsecond timestamps past 2100
            $nowUs   = microtime(true) * 1e6;
            $nextSlot = (float)($content ?: 0);

            // Claim the next slot (queue-based: if ahead of now, queue behind last worker)
            $mySlotUs = max($nextSlot, $nowUs);

            // Advance shared pointer for next caller
            fseek($fp, 0);
            fwrite($fp, number_format($mySlotUs + $intervalUs, 0, '.', ''));
            ftruncate($fp, ftell($fp));

            flock($fp, LOCK_UN); // Release lock IMMEDIATELY — do not sleep while holding it
        }
        fclose($fp);

        // Sleep until our assigned slot (happens outside the lock so other workers can proceed)
        if ($mySlotUs !== null) {
            $sleepUs = (int)($mySlotUs - microtime(true) * 1e6);
            if ($sleepUs > 5000) { // Skip negligible gaps < 5ms
                usleep($sleepUs);
            }
        }
    }
}

/**
 * Dispatch a campaign background job (Trigger worker_campaign.php)
 */
function dispatchCampaignWorker($pdo, $campaignId)
{
    $apiUrl = defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api';
    if (strpos($apiUrl, 'http') === false)
        $apiUrl = 'https://automation.ideas.edu.vn/mail_api';

    $workerUrl = $apiUrl . "/worker_campaign.php?campaign_id=" . $campaignId;

    // Use non-blocking CURL if possible, otherwise standard curl
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $workerUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT_MS, 200);
    curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P36-FH] hostname verification
    @curl_exec($ch);
    curl_close($ch);
}

/**
 * Parse dynamic looping content in email templates
 */
function parseLoopingContent($html, $context)
{
    return preg_replace_callback('/<!-- START_ITEM_LOOP -->(.*?)<!-- END_ITEM_LOOP -->/s', function ($matches) use ($context) {
        $template = $matches[1];
        $output = '';
        $items = $context['items'] ?? [];
        if (is_array($items) && count($items) > 0) {
            foreach ($items as $item) {
                $row = $template;
                foreach ($item as $key => $val) {
                    $row = str_replace("{{item.$key}}", $val, $row);
                }
                $output .= $row;
            }
        }
        return $output;
    }, $html);
}

/**
 * Resolve email content from Template ID or Custom HTML
 */
function resolveEmailContent($pdo, $templateId, $customHtml, $fallbackBody = '', $context = [])
{
    // [PERF] In-memory static cache to prevent hitting MySQL for thousands of identical flow loops
    static $templateCache = [];
    $cacheKey = md5((string)$templateId . (string)$customHtml . (string)$fallbackBody);

    if (isset($templateCache[$cacheKey])) {
        $htmlContent = $templateCache[$cacheKey];
    } else {
        $htmlContent = '';
        if ($templateId && $templateId !== 'custom-html') {
            $stmt = $pdo->prepare("SELECT html_content FROM templates WHERE id = ?");
            $stmt->execute([$templateId]);
            $htmlContent = $stmt->fetchColumn();
            if ($htmlContent && $fallbackBody && strpos($htmlContent, '{{body}}') !== false) {
                $htmlContent = str_replace('{{body}}', $fallbackBody, $htmlContent);
            }
        } elseif ($templateId === 'custom-html' || !empty($customHtml)) {
            $htmlContent = !empty($customHtml) ? $customHtml : $fallbackBody;
        } else {
            // Fallback to contentBody if no customHtml and no valid templateId
            $htmlContent = $fallbackBody;
        }

        if (!$htmlContent) {
            $htmlContent = "<html><body><p>(No Content)</p></body></html>";
        }

        // Limit the static cache to 50 active items to prevent worker memory leaks over long processes
        if (count($templateCache) >= 50) {
            array_shift($templateCache);
        }
        $templateCache[$cacheKey] = $htmlContent;
    }

    return parseLoopingContent($htmlContent, $context);
}

/**
 * Helper to detect if a value is an active URL or domain name (e.g. https://..., www...., ideas.edu.vn, domain.com/path).
 */
function isLinkOrDomainValue($val, &$normalizedHref = null)
{
    if (!is_string($val) && !is_numeric($val)) return false;
    $val = trim((string)$val);
    if (empty($val)) return false;

    // Do NOT match email addresses (e.g. user@gmail.com)
    if (strpos($val, '@') !== false && !preg_match('/^https?:\/\//i', $val)) {
        return false;
    }

    // Must not have whitespace or line breaks
    if (preg_match('/\s/', $val)) {
        return false;
    }

    // 1. Explicit http:// or https:// URL
    if (preg_match('/^https?:\/\/[^\s<>"\'`]+$/i', $val)) {
        $normalizedHref = $val;
        return true;
    }

    // 2. Starts with www.
    if (preg_match('/^www\.[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(?::[0-9]+)?(?:\/[^\s<>"\'`]*)?$/i', $val)) {
        $normalizedHref = 'https://' . $val;
        return true;
    }

    // 3. Domain pattern (e.g. domain.com, sub.domain.vn, shop.io/product/123)
    if (preg_match('/^[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.(?:[a-zA-Z]{2,63})(?::[0-9]+)?(?:\/[^\s<>"\'`]*)?$/i', $val)) {
        $normalizedHref = 'https://' . $val;
        return true;
    }

    return false;
}

/**
 * Determine the HTML context at a given offset in a document to decide whether to wrap in <a> or provide raw/normalized URL.
 */
function getHtmlContextAtOffset($html, $offset)
{
    $before = substr($html, 0, $offset);

    // 1. Inside an HTML tag attribute (e.g. <a href="{{var}}" ...> or <img src="{{var}}">)
    $lastOpenBracket = strrpos($before, '<');
    $lastCloseBracket = strrpos($before, '>');
    if ($lastOpenBracket !== false && ($lastCloseBracket === false || $lastOpenBracket > $lastCloseBracket)) {
        return 'inside_tag';
    }

    // 2. Inside an already open <a> tag (e.g. <a href="...">{{var}}</a>)
    $lastAOpen = preg_match_all('/<a[\s>]/i', $before, $mOpen);
    $lastAClose = preg_match_all('/<\/a\s*>/i', $before, $mClose);
    $numOpen = $lastAOpen ? $lastAOpen : 0;
    $numClose = $lastAClose ? $lastAClose : 0;
    if ($numOpen > $numClose) {
        return 'inside_anchor';
    }

    // 3. Check if document has HTML markup
    if (preg_match('/<[a-z][\s\S]*>/i', $html)) {
        return 'html_text';
    }

    return 'plain_text';
}

/**
 * Canonicalize variable keys for fuzzy matching (case/dash/underscore/Vietnamese-accent insensitive)
 * e.g. "Mã chứng chỉ", "cert_no", "certNo", "CERT_NO", "cert-no" -> "machungchi", "certno"
 */
if (!function_exists('canonicalizeVarKey')) {
    function canonicalizeVarKey($str)
    {
        if (!is_string($str) || $str === '') return '';
        $unicode = [
            'a' => 'á|à|ả|ã|ạ|ă|ắ|ặ|ằ|ẳ|ẵ|â|ấ|ầ|ẩ|ẫ|ậ|Á|À|Ả|Ã|Ạ|Ă|Ắ|Ặ|Ằ|Ẳ|Ẵ|Â|Ấ|Ầ|Ẩ|Ẫ|Ậ',
            'd' => 'đ|Đ',
            'e' => 'é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ|É|È|Ẻ|Ẽ|Ẹ|Ê|Ế|Ề|Ể|Ễ|Ệ',
            'i' => 'í|ì|ỉ|ĩ|ị|Í|Ì|Ỉ|Ĩ|Ị',
            'o' => 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ|Ó|Ò|Ỏ|Õ|Ọ|Ô|Ố|Ồ|Ổ|Ỗ|Ộ|Ơ|Ớ|Ờ|Ở|Ỡ|Ợ',
            'u' => 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự|Ú|Ù|Ủ|Ũ|Ụ|Ư|Ứ|Ừ|Ử|Ữ|Ự',
            'y' => 'ý|ỳ|ỷ|ỹ|ỵ|Ý|Ỳ|Ỷ|Ỹ|Ỵ',
        ];
        foreach ($unicode as $nonAccent => $accent) {
            $str = preg_replace("/($accent)/u", $nonAccent, $str);
        }
        return preg_replace('/[^a-z0-9]/', '', strtolower($str));
    }
}

if (!function_exists('enrichSubscriberWithCrmData')) {
    /**
     * Enrich subscriber array with MYERP CRM contact, consultant (owner), team, pipeline stage,
     * latest deal, and latest deposit data for full Merge Tag resolution.
     */
    function enrichSubscriberWithCrmData(?PDO $pdo, array $subscriber, array $context = []): array
    {
        if (!$pdo) {
            $pdo = $GLOBALS['pdo'] ?? null;
        }
        if (!$pdo) {
            return $subscriber;
        }

        $contactId = !empty($subscriber['contact_id']) ? (int)$subscriber['contact_id'] : 0;
        $email = trim((string)($subscriber['email'] ?? ''));
        $phone = trim((string)($subscriber['phone_number'] ?? ($subscriber['phone'] ?? '')));

        static $crmEnrichCache = [];
        $cacheKey = $contactId > 0 ? "cid:{$contactId}" : ($email !== '' ? "em:" . strtolower($email) : ($phone !== '' ? "ph:{$phone}" : ''));

        $crmData = null;
        if ($cacheKey !== '' && array_key_exists($cacheKey, $crmEnrichCache)) {
            $crmData = $crmEnrichCache[$cacheKey];
        } elseif ($cacheKey !== '') {
            try {
                if ($contactId <= 0) {
                    if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
                        require_once __DIR__ . '/../utils/DomationContactMatcher.php';
                    }
                    if (class_exists('DomationContactMatcher')) {
                        $matchedId = DomationContactMatcher::findExistingContactId($pdo, $email !== '' ? $email : null, $phone !== '' ? $phone : null, 1);
                        if ($matchedId) {
                            $contactId = (int)$matchedId;
                        }
                    }
                }

                if ($contactId > 0) {
                    $stmtC = $pdo->prepare("
                        SELECT c.*, c.id AS crm_contact_id,
                               ps.name AS stage_name, ps.system_slug AS stage_slug, ps.is_won AS stage_is_won,
                               pr.name AS project_name, pr.code AS project_code,
                               u.full_name AS owner_name, u.phone AS owner_phone, u.email AS owner_email, u.job_title AS owner_job_title,
                               tm.name AS team_name
                        FROM contacts c
                        LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                        LEFT JOIN projects pr ON pr.id = c.project_id
                        LEFT JOIN users u ON u.id = c.owner_id
                        LEFT JOIN teams tm ON tm.id = u.team_id
                        WHERE c.id = ? AND c.deleted_at IS NULL
                        LIMIT 1
                    ");
                    $stmtC->execute([$contactId]);
                    $contactRow = $stmtC->fetch(PDO::FETCH_ASSOC);

                    if ($contactRow) {
                        $dealRow = null;
                        $depRow = null;
                        $tuitionRemainingVal = 0.0;
                        try {
                            $stmtDeal = $pdo->prepare("SELECT title, value FROM deals WHERE contact_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1");
                            $stmtDeal->execute([$contactId]);
                            $dealRow = $stmtDeal->fetch(PDO::FETCH_ASSOC) ?: null;
                        } catch (Throwable $eD) {}

                        try {
                            $stmtDep = $pdo->prepare("SELECT price AS amount, status, id AS deposit_code FROM deposits WHERE contact_id = ? ORDER BY id DESC LIMIT 1");
                            $stmtDep->execute([$contactId]);
                            $depRow = $stmtDep->fetch(PDO::FETCH_ASSOC) ?: null;
                        } catch (Throwable $eDep) {}

                        try {
                            $stmtDebt = $pdo->prepare("
                                SELECT COALESCE(SUM(GREATEST(0, COALESCE(dm.expected_amount, 0) - COALESCE(dm.actual_amount, 0))), 0)
                                FROM deposit_milestones dm
                                INNER JOIN deposits dep ON dep.id = dm.deposit_id
                                WHERE dep.contact_id = ? AND dep.status != 'rejected'
                                  AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected')
                            ");
                            $stmtDebt->execute([$contactId]);
                            $tuitionRemainingVal = (float)$stmtDebt->fetchColumn();
                        } catch (Throwable $eMilestone) {}

                        if ($tuitionRemainingVal <= 0 && isset($contactRow['expected_revenue'])) {
                            $expRev = (float)($contactRow['expected_revenue'] ?? 0);
                            $totSpent = (float)($contactRow['total_spent'] ?? 0);
                            if ($expRev > $totSpent) {
                                $tuitionRemainingVal = $expRev - $totSpent;
                            }
                        }

                        $crmData = [
                            'contact' => $contactRow,
                            'deal' => $dealRow,
                            'deposit' => $depRow,
                            'tuition_remaining_val' => $tuitionRemainingVal,
                        ];
                    }
                }
            } catch (Throwable $e) {
                $crmData = null;
            }

            if (count($crmEnrichCache) >= 300) {
                array_shift($crmEnrichCache);
            }
            $crmEnrichCache[$cacheKey] = $crmData;
        }

        $c = $crmData['contact'] ?? [];
        $deal = $crmData['deal'] ?? [];
        $dep = $crmData['deposit'] ?? [];
        $tuitionRemainingVal = (float)($crmData['tuition_remaining_val'] ?? 0.0);

        if (!empty($c['crm_contact_id'])) {
            $subscriber['crm_contact_id'] = (int)$c['crm_contact_id'];
            $subscriber['contact_id'] = (int)$c['crm_contact_id'];
        }

        $crmFullName = !empty($c['full_name']) ? trim((string)$c['full_name']) : (!empty($c['name']) ? trim((string)$c['name']) : '');

        // Split CRM full name if subscriber first_name/last_name are missing
        if (empty($subscriber['first_name']) && empty($subscriber['last_name']) && $crmFullName !== '') {
            $parts = preg_split('/\s+/u', $crmFullName);
            if (count($parts) > 1) {
                $subscriber['first_name'] = array_pop($parts);
                $subscriber['last_name'] = implode(' ', $parts);
            } else {
                $subscriber['first_name'] = $crmFullName;
                $subscriber['last_name'] = '';
            }
        }
        if ($crmFullName !== '' && empty($subscriber['full_name'])) {
            $subscriber['full_name'] = $crmFullName;
        }

        if (empty($subscriber['email']) && !empty($c['email'])) {
            $subscriber['email'] = $c['email'];
        }
        if (empty($subscriber['phone_number']) && empty($subscriber['phone']) && !empty($c['phone'])) {
            $subscriber['phone_number'] = $c['phone'];
        }
        if (empty($subscriber['gender']) && !empty($c['gender'])) {
            $subscriber['gender'] = $c['gender'];
        }
        $dobVal = !empty($c['birthday']) ? $c['birthday'] : (!empty($c['dob']) ? $c['dob'] : ($subscriber['date_of_birth'] ?? ''));
        if ($dobVal !== '') {
            $subscriber['date_of_birth'] = $dobVal;
        }
        if (empty($subscriber['job_title']) && !empty($c['job_title'])) {
            $subscriber['job_title'] = $c['job_title'];
        }
        if (empty($subscriber['company_name']) && !empty($c['company'])) {
            $subscriber['company_name'] = $c['company'];
        }
        if (empty($subscriber['address']) && !empty($c['address'])) {
            $subscriber['address'] = $c['address'];
        }
        if (empty($subscriber['city']) && !empty($c['city'])) {
            $subscriber['city'] = $c['city'];
        }
        $subscriber['district'] = !empty($c['district']) ? $c['district'] : ($subscriber['district'] ?? '');
        $subscriber['ward'] = !empty($c['ward']) ? $c['ward'] : ($subscriber['ward'] ?? '');

        $subscriber['program'] = !empty($c['program']) ? $c['program'] : (!empty($c['project_name']) ? $c['project_name'] : ($subscriber['program'] ?? ''));
        $subscriber['student_id'] = !empty($c['student_id']) ? $c['student_id'] : ($subscriber['student_id'] ?? '');
        $subscriber['student_code'] = $subscriber['student_id'] ?: (!empty($c['crm_contact_id']) ? ('HV-' . str_pad((string)$c['crm_contact_id'], 4, '0', STR_PAD_LEFT)) : '');
        $subscriber['class_name'] = !empty($c['project_name']) ? $c['project_name'] : ($subscriber['program'] ?? '');
        $subscriber['class_code'] = !empty($c['project_code']) ? $c['project_code'] : ($subscriber['class_code'] ?? '');
        $subscriber['study_status'] = !empty($c['study_status']) ? $c['study_status'] : ($subscriber['study_status'] ?? '');
        $subscriber['source'] = !empty($c['source']) ? $c['source'] : ($subscriber['source'] ?? '');
        $subscriber['stage_name'] = !empty($c['stage_name']) ? $c['stage_name'] : ($subscriber['stage_name'] ?? '');
        $subscriber['pipeline_status'] = !empty($c['stage_slug']) ? $c['stage_slug'] : (!empty($c['pipeline_status']) ? $c['pipeline_status'] : ($subscriber['pipeline_status'] ?? ''));

        // Certificate code from custom_attributes if present
        $customAttrsArr = [];
        if (!empty($subscriber['custom_attributes'])) {
            $customAttrsArr = is_array($subscriber['custom_attributes'])
                ? $subscriber['custom_attributes']
                : (json_decode((string)$subscriber['custom_attributes'], true) ?: []);
        }
        $subscriber['certificate_code'] = !empty($customAttrsArr['certificate_code'])
            ? (string)$customAttrsArr['certificate_code']
            : (!empty($customAttrsArr['cert_no']) ? (string)$customAttrsArr['cert_no'] : ($subscriber['certificate_code'] ?? ''));

        $subscriber['tuition_remaining'] = $tuitionRemainingVal > 0
            ? (number_format($tuitionRemainingVal, 0, ',', '.') . ' đ')
            : ($subscriber['tuition_remaining'] ?? '0 đ');

        // Consultant / Owner fields (fallback to current logged-in sender if contact has no owner)
        $authUser = $GLOBALS['domation_auth'] ?? [];
        $subscriber['consultant_name'] = !empty($c['owner_name'])
            ? $c['owner_name']
            : (!empty($subscriber['salesperson']) ? $subscriber['salesperson'] : ($authUser['full_name'] ?? ''));
        $subscriber['consultant_phone'] = !empty($c['owner_phone'])
            ? $c['owner_phone']
            : ($authUser['phone'] ?? '');
        $subscriber['consultant_email'] = !empty($c['owner_email'])
            ? $c['owner_email']
            : ($GLOBALS['current_admin_email'] ?? ($authUser['email'] ?? ''));
        $subscriber['consultant_title'] = !empty($c['owner_job_title'])
            ? $c['owner_job_title']
            : 'Chuyên viên tư vấn';
        $subscriber['consultant_role'] = $subscriber['consultant_title'];
        $subscriber['team_name'] = !empty($c['team_name'])
            ? $c['team_name']
            : 'Phòng Tư vấn Tuyển sinh';

        // Deal & Deposit fields
        $subscriber['deal_title'] = $deal['title'] ?? ($subscriber['deal_title'] ?? '');
        $rawDealVal = isset($deal['value']) ? (float)$deal['value'] : (isset($c['expected_revenue']) ? (float)$c['expected_revenue'] : 0.0);
        $subscriber['deal_value'] = $rawDealVal > 0 ? (number_format($rawDealVal, 0, ',', '.') . ' đ') : ($subscriber['deal_value'] ?? '');

        $rawDepVal = isset($dep['amount']) ? (float)$dep['amount'] : 0.0;
        $subscriber['deposit_amount'] = $rawDepVal > 0 ? (number_format($rawDepVal, 0, ',', '.') . ' đ') : ($subscriber['deposit_amount'] ?? '');
        $subscriber['deposit_status'] = $dep['status'] ?? ($subscriber['deposit_status'] ?? '');
        $subscriber['deposit_code'] = !empty($dep['deposit_code']) ? ('DEP-' . $dep['deposit_code']) : ($subscriber['deposit_code'] ?? '');

        return $subscriber;
    }
}

/**
 * Replace merge tags in content
 */
function replaceMergeTags($html, $subscriber, $context = [], $pdo = null)
{
    if (empty($html))
        return "";

    if ($context instanceof PDO) {
        $pdo = $context;
        $context = [];
    }

    $subscriber = enrichSubscriberWithCrmData($pdo ?? ($GLOBALS['pdo'] ?? null), is_array($subscriber) ? $subscriber : [], is_array($context) ? $context : []);

    $firstName = $subscriber['first_name'] ?? ($subscriber['firstName'] ?? '');
    $lastName = $subscriber['last_name'] ?? ($subscriber['lastName'] ?? '');
    $fullName = '';
    if (!empty($subscriber['full_name'])) {
        $fullName = trim((string)$subscriber['full_name']);
    } elseif (!empty($subscriber['fullName'])) {
        $fullName = trim((string)$subscriber['fullName']);
    } elseif (!empty($subscriber['name'])) {
        $fullName = trim((string)$subscriber['name']);
    } else {
        $fullName = trim($lastName !== '' ? ($lastName . ' ' . $firstName) : $firstName);
    }
    $email = $subscriber['email'] ?? '';

    $rawGender = trim((string)($subscriber['gender'] ?? ''));
    $gLower = function_exists('mb_strtolower') ? mb_strtolower($rawGender, 'UTF-8') : strtolower($rawGender);
    $salutation = ($gLower === 'nam' || $gLower === 'male')
        ? 'Anh'
        : (($gLower === 'nữ' || $gLower === 'nu' || $gLower === 'female') ? 'Chị' : 'Bạn');

    // Standard Map (with full MYERP CRM + Consultant + Deal + Deposit variables)
    $subscriberId = $subscriber['subscriber_id'] ?? $subscriber['id'] ?? '';
    $crmContactId = !empty($subscriber['crm_contact_id'])
        ? (string)$subscriber['crm_contact_id']
        : (!empty($subscriber['contact_id']) ? (string)$subscriber['contact_id'] : (string)$subscriberId);
    $phoneNumber = $subscriber['phone_number'] ?? $subscriber['phone'] ?? '';
    $dobFormatted = !empty($subscriber['date_of_birth'])
        ? (strtotime($subscriber['date_of_birth']) ? date('d/m/Y', strtotime($subscriber['date_of_birth'])) : $subscriber['date_of_birth'])
        : '';
    $annivFormatted = !empty($subscriber['anniversary_date'])
        ? (strtotime($subscriber['anniversary_date']) ? date('d/m/Y', strtotime($subscriber['anniversary_date'])) : $subscriber['anniversary_date'])
        : '';
    $joinedFormatted = !empty($subscriber['joined_at'])
        ? (strtotime($subscriber['joined_at']) ? date('d/m/Y', strtotime($subscriber['joined_at'])) : $subscriber['joined_at'])
        : '';

    $consultantTitle = $subscriber['consultant_title'] ?? ($subscriber['consultant_role'] ?? 'Chuyên viên tư vấn');

    $map = [
        'first_name' => $firstName,
        'firstName' => $firstName,
        'last_name' => $lastName,
        'lastName' => $lastName,
        'name' => $fullName ?: 'Bạn',
        'full_name' => $fullName ?: 'Bạn',
        'fullName' => $fullName ?: 'Bạn',
        'customer_name' => $fullName ?: 'Bạn',
        'customerName' => $fullName ?: 'Bạn',
        'salutation' => $salutation,
        'danh_xung' => $salutation,
        'email' => $email,
        'company_name' => $subscriber['company_name'] ?? '',
        'companyName' => $subscriber['company_name'] ?? '',
        'company' => $subscriber['company_name'] ?? '',
        'phone' => $phoneNumber,
        'phone_number' => $phoneNumber,
        'phoneNumber' => $phoneNumber,
        'job_title' => $subscriber['job_title'] ?? '',
        'jobTitle' => $subscriber['job_title'] ?? '',
        'city' => $subscriber['city'] ?? ($subscriber['last_city'] ?? ''),
        'district' => $subscriber['district'] ?? '',
        'ward' => $subscriber['ward'] ?? '',
        'country' => $subscriber['country'] ?? '',
        'address' => $subscriber['address'] ?? ($subscriber['city'] ?? ($subscriber['last_city'] ?? '')),
        'gender' => $subscriber['gender'] ?? '',
        'dob' => $dobFormatted,
        'birthday' => $dobFormatted,
        'date_of_birth' => $dobFormatted,
        'dateOfBirth' => $dobFormatted,
        'anniversary' => $annivFormatted,
        'anniversary_date' => $annivFormatted,
        'anniversaryDate' => $annivFormatted,
        'joined_at' => $joinedFormatted,
        'joinedAt' => $joinedFormatted,
        // Education, Student, Class & CRM Lead variables
        'program' => $subscriber['program'] ?? '',
        'student_id' => $subscriber['student_id'] ?? ($subscriber['student_code'] ?? ''),
        'studentId' => $subscriber['student_id'] ?? ($subscriber['student_code'] ?? ''),
        'student_code' => $subscriber['student_code'] ?? ($subscriber['student_id'] ?? ''),
        'studentCode' => $subscriber['student_code'] ?? ($subscriber['student_id'] ?? ''),
        'class_name' => $subscriber['class_name'] ?? ($subscriber['program'] ?? ''),
        'className' => $subscriber['class_name'] ?? ($subscriber['program'] ?? ''),
        'class_code' => $subscriber['class_code'] ?? '',
        'classCode' => $subscriber['class_code'] ?? '',
        'study_status' => $subscriber['study_status'] ?? '',
        'studyStatus' => $subscriber['study_status'] ?? '',
        'certificate_code' => $subscriber['certificate_code'] ?? '',
        'certificateCode' => $subscriber['certificate_code'] ?? '',
        'cert_no' => $subscriber['certificate_code'] ?? '',
        'tuition_remaining' => $subscriber['tuition_remaining'] ?? '0 đ',
        'tuitionRemaining' => $subscriber['tuition_remaining'] ?? '0 đ',
        'source' => $subscriber['source'] ?? '',
        'stage_name' => $subscriber['stage_name'] ?? '',
        'stageName' => $subscriber['stage_name'] ?? '',
        'pipeline_status' => $subscriber['pipeline_status'] ?? '',
        'pipelineStatus' => $subscriber['pipeline_status'] ?? '',
        // Consultant / Owner variables
        'consultant_name' => $subscriber['consultant_name'] ?? '',
        'consultantName' => $subscriber['consultant_name'] ?? '',
        'owner_name' => $subscriber['consultant_name'] ?? '',
        'ownerName' => $subscriber['consultant_name'] ?? '',
        'consultant_phone' => $subscriber['consultant_phone'] ?? '',
        'consultantPhone' => $subscriber['consultant_phone'] ?? '',
        'owner_phone' => $subscriber['consultant_phone'] ?? '',
        'ownerPhone' => $subscriber['consultant_phone'] ?? '',
        'consultant_email' => $subscriber['consultant_email'] ?? '',
        'consultantEmail' => $subscriber['consultant_email'] ?? '',
        'owner_email' => $subscriber['consultant_email'] ?? '',
        'ownerEmail' => $subscriber['consultant_email'] ?? '',
        'consultant_title' => $consultantTitle,
        'consultantTitle' => $consultantTitle,
        'consultant_role' => $consultantTitle,
        'consultantRole' => $consultantTitle,
        'owner_title' => $consultantTitle,
        'owner_role' => $consultantTitle,
        'team_name' => $subscriber['team_name'] ?? 'Phòng Tư vấn Tuyển sinh',
        'teamName' => $subscriber['team_name'] ?? 'Phòng Tư vấn Tuyển sinh',
        // Deal & Deposit variables
        'deal_title' => $subscriber['deal_title'] ?? '',
        'dealTitle' => $subscriber['deal_title'] ?? '',
        'deal_value' => $subscriber['deal_value'] ?? '',
        'dealValue' => $subscriber['deal_value'] ?? '',
        'deposit_amount' => $subscriber['deposit_amount'] ?? '',
        'depositAmount' => $subscriber['deposit_amount'] ?? '',
        'deposit_status' => $subscriber['deposit_status'] ?? '',
        'depositStatus' => $subscriber['deposit_status'] ?? '',
        'deposit_code' => $subscriber['deposit_code'] ?? '',
        'depositCode' => $subscriber['deposit_code'] ?? '',
        // System & Date variables
        'year' => date('Y'),
        'date' => date('d/m/Y'),
        'current_date' => date('d/m/Y'),
        'time' => date('H:i'),
        'current_time' => date('H:i'),
        'today' => date('d/m/Y'),
        'today_ymd' => date('Y-m-d'),
        'today_dmy' => date('d-m-Y'),
        'subscriber_id' => $subscriberId,
        'subscriberId' => $subscriberId,
        'subscriber_id_short' => substr((string) $subscriberId, 0, 10),
        'contact_id' => $crmContactId,
        'contactId' => $crmContactId,
        'crm_contact_id' => $crmContactId,
        'crmContactId' => $crmContactId,
        'contact_id_short' => substr((string) $crmContactId, 0, 10),
        'random_id' => str_pad((string) rand(0, 9999999999), 10, '0', STR_PAD_LEFT),
        'random_6' => str_pad((string) rand(0, 999999), 6, '0', STR_PAD_LEFT),
        'unsubscribe_url' => $context['unsubscribe_url'] ?? ($context['unsubscribeLink'] ?? ''),
        'unsubscribeLink' => $context['unsubscribe_url'] ?? ($context['unsubscribeLink'] ?? ''),
        'campaign_name' => $context['campaign_name'] ?? ($context['campaignName'] ?? ''),
        'campaignName' => $context['campaign_name'] ?? ($context['campaignName'] ?? ''),
    ];

    // [PERF] Static cache: avoid json_decode(custom_attributes) on each call.
    // Cache key = "subId:crc32(raw)" — invalidates automatically if attributes change
    // (e.g. "Update Field" step followed by "Send Email" in the same worker run).
    // Capped at 500 slots (FIFO) to prevent memory leak during long worker runs.
    static $customAttrCache = [];
    $subId = $subscriber['id'] ?? $subscriber['subscriber_id'] ?? '';
    $attrRaw = $subscriber['custom_attributes'] ?? null;
    $attrCacheKey = $subId ? ($subId . ':' . crc32(is_string($attrRaw) ? $attrRaw : '')) : '';
    if ($attrCacheKey && !isset($customAttrCache[$attrCacheKey])) {
        $customAttrCache[$attrCacheKey] = is_array($attrRaw) ? $attrRaw : (json_decode((string) $attrRaw, true) ?: []);
        if (count($customAttrCache) >= 500) {
            reset($customAttrCache);
            unset($customAttrCache[key($customAttrCache)]);
        }
    }
    $customAttrs = $attrCacheKey ? ($customAttrCache[$attrCacheKey] ?? []) : (
        is_array($attrRaw) ? $attrRaw : (json_decode((string) ($attrRaw ?? ''), true) ?: [])
    );

    foreach ($customAttrs as $k => $v) {
        if (is_string($v) || is_numeric($v)) {
            $map[$k] = $v;
        }
    }

    // Merge Context
    foreach ($context as $key => $val) {
        if (is_string($val) || is_numeric($val)) {
            $map[$key] = $val;
        }
    }

    // [BUG-FIX] Post-build fix for unsubscribeLink:
    // After context is merged, re-apply unsubscribeLink in case it was provided
    // in $context under a different key (e.g. 'unsubscribeLink' directly).
    if (empty($map['unsubscribeLink']) && !empty($map['unsubscribe_url'])) {
        $map['unsubscribeLink'] = $map['unsubscribe_url'];
    }

    // [VOUCHER CLAIMING LOGIC] (End-to-End Dynamic Code Assignment)
    if (strpos($html, '[VOUCHER_') !== false) {
        $html = preg_replace_callback('/\[VOUCHER_([a-zA-Z0-9_\-]+)\]/i', function ($m) use ($subscriber, $context) {
            global $pdo;
            if (!$pdo) return $m[0]; 

            $campaignId = trim($m[1]);
            $subscriberId = $subscriber['id'] ?? ($subscriber['subscriber_id'] ?? null);
            $workspaceId = $subscriber['workspace_id'] ?? null;

            // [PERF] 1. Check Pre-fetched Cache first (passed from worker_campaign/flow)
            if (isset($context['voucher_cache'][$campaignId])) {
                return $context['voucher_cache'][$campaignId];
            }
            if (isset($context['vouchers_batch'][$subscriberId][$campaignId])) {
                return $context['vouchers_batch'][$subscriberId][$campaignId];
            }

            // 2. Check if this subscriber ALREADY has a code from this campaign
            if ($subscriberId) {
                $sqlCheck = "SELECT id, code FROM voucher_codes WHERE campaign_id = ? AND subscriber_id = ?";
                $paramsCheck = [$campaignId, $subscriberId];
                if ($workspaceId) {
                    $sqlCheck .= " AND workspace_id = ?";
                    $paramsCheck[] = $workspaceId;
                }
                $stmtCheck = $pdo->prepare($sqlCheck . " LIMIT 1");
                $stmtCheck->execute($paramsCheck);
                $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);
                
                if ($existing) {
                    $pdo->prepare("UPDATE voucher_codes SET sent_at = NOW() WHERE id = ? AND sent_at IS NULL")->execute([$existing['id']]);
                    return $existing['code'];
                }
            }

            // 3. Fetch Campaign Info
            $sqlCamp = "SELECT code_type, static_code, expiration_days FROM voucher_campaigns WHERE id = ? AND status = 'active'";
            $paramsCamp = [$campaignId];
            if ($workspaceId) {
                $sqlCamp .= " AND workspace_id = ?";
                $paramsCamp[] = $workspaceId;
            }
            $stmtCamp = $pdo->prepare($sqlCamp);
            $stmtCamp->execute($paramsCamp);
            $camp = $stmtCamp->fetch(PDO::FETCH_ASSOC);

            if (!$camp) return 'INVALID-VOUCHER';

            if ($camp['code_type'] === 'static') {
                return $camp['static_code'] ?: 'NO-CODE';
            }

            if (!$subscriberId) return 'NO-CODE';

            // 3. ATOMIC CLAIM FOR DYNAMIC CODE (Concurrency Safe)
            try {
                // Must ensure no recursive transaction errors if already in transaction
                $alreadyInTransaction = $pdo->inTransaction();
                if (!$alreadyInTransaction) $pdo->beginTransaction();

                // [RACE FIX] Re-check inside transaction (Scoped by workspace_id)
                if ($subscriberId) {
                    $sqlReCheck = "SELECT id, code FROM voucher_codes WHERE campaign_id = ? AND subscriber_id = ?";
                    $paramsReCheck = [$campaignId, $subscriberId];
                    if ($workspaceId) {
                        $sqlReCheck .= " AND workspace_id = ?";
                        $paramsReCheck[] = $workspaceId;
                    }
                    $stmtReCheck = $pdo->prepare($sqlReCheck . " LIMIT 1 LOCK IN SHARE MODE");
                    $stmtReCheck->execute($paramsReCheck);
                    $raceExisting = $stmtReCheck->fetch(PDO::FETCH_ASSOC);
                    if ($raceExisting) {
                        $pdo->prepare("UPDATE voucher_codes SET sent_at = NOW() WHERE id = ? AND sent_at IS NULL")->execute([$raceExisting['id']]);
                        if (!$alreadyInTransaction) $pdo->commit();
                        return $raceExisting['code'];
                    }
                }

                // Consolidate skip-locked version check
                $voucherSkipLocked = isDatabaseSkipLockedSupported($pdo) ? 'SKIP LOCKED' : '';
                
                $sqlClaim = "SELECT id, code FROM voucher_codes WHERE campaign_id = ? AND status = 'unused' AND subscriber_id IS NULL";
                $paramsClaim = [$campaignId];
                if ($workspaceId) {
                    $sqlClaim .= " AND workspace_id = ?";
                    $paramsClaim[] = $workspaceId;
                }
                
                $stmtClaim = $pdo->prepare($sqlClaim . " ORDER BY id ASC LIMIT 1 FOR UPDATE $voucherSkipLocked");
                $stmtClaim->execute($paramsClaim);
                $row = $stmtClaim->fetch(PDO::FETCH_ASSOC);

                if ($row) {
                    $expiresAt = null;
                    if (!empty($camp['expiration_days'])) {
                        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$camp['expiration_days']} days"));
                    }
                    
                    // Keep status as 'unused' during distribution/claiming (it only becomes 'used' on redemption)
                    $sqlUpdate = "UPDATE voucher_codes SET subscriber_id = ?, sent_at = NOW(), expires_at = ? WHERE id = ?";
                    $paramsUpdate = [$subscriberId, $expiresAt, $row['id']];
                    if ($workspaceId) {
                        $sqlUpdate .= " AND workspace_id = ?";
                        $paramsUpdate[] = $workspaceId;
                    }
                    
                    $pdo->prepare($sqlUpdate)->execute($paramsUpdate);
                        
                    if (!$alreadyInTransaction) $pdo->commit();
                    return $row['code'];
                } else {
                    if (!$alreadyInTransaction) $pdo->rollBack();
                    return 'HẾT-MÃ';
                }
            } catch (Exception $e) {
                // [FIX] Rollback dangling transaction on exception to prevent connection-level
                // "There is already an active transaction" errors in subsequent queries.
                try {
                    if (!isset($alreadyInTransaction) || !$alreadyInTransaction) {
                        if ($pdo->inTransaction()) $pdo->rollBack();
                    }
                } catch (Throwable $re) {}
                // Return generic error gracefully so flow does not crash
                return 'HẾT-MÃ';
            }

        }, $html);
    }

    // Build Canonical Map & Collect Fallbacks

    // Build Canonical Map & Collect Fallbacks
    $canonicalMap = [];
    foreach ($map as $k => $v) {
        $cKey = canonicalizeVarKey($k);
        if ($v !== null && $v !== '') {
            $canonicalMap[$cKey] = $v;
        }
    }

    $fallbacks = array_merge(
        $context['fallbacks'] ?? [],
        $context['variable_fallbacks'] ?? [],
        $context['config']['variable_fallbacks'] ?? []
    );
    $canonicalFallbacks = [];
    foreach ($fallbacks as $k => $v) {
        $cKey = canonicalizeVarKey($k);
        $canonicalFallbacks[$cKey] = $v;
    }

    // [ROBUST FIX] Use Regex with PREG_OFFSET_CAPTURE to handle {{ var }}, {{var}}, {{ VAR }}, %7B%7Bvar%7D%7D
    // and automatically auto-link / normalize link and domain variables!
    $html = preg_replace_callback('/(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i', function ($m) use ($map, $canonicalMap, $fallbacks, $canonicalFallbacks, $html) {
        $rawTag = $m[0][0];
        $tag = trim(!empty($m[1][0]) ? $m[1][0] : ($m[2][0] ?? ''));
        $offset = $m[0][1];
        $canon = canonicalizeVarKey($tag);

        // Resolve value from exact map, canonical map, or fallbacks
        $val = null;
        if (array_key_exists($tag, $map) && $map[$tag] !== null && $map[$tag] !== '') {
            $val = $map[$tag];
        } elseif (array_key_exists($canon, $canonicalMap) && $canonicalMap[$canon] !== null && $canonicalMap[$canon] !== '') {
            $val = $canonicalMap[$canon];
        } elseif (array_key_exists($tag, $fallbacks) && $fallbacks[$tag] !== null && $fallbacks[$tag] !== '') {
            $val = $fallbacks[$tag];
        } elseif (array_key_exists($canon, $canonicalFallbacks) && $canonicalFallbacks[$canon] !== null && $canonicalFallbacks[$canon] !== '') {
            $val = $canonicalFallbacks[$canon];
        }

        $htmlContext = getHtmlContextAtOffset($html, $offset);
        $before = substr($html, 0, $offset);
        $lastOpen = strrpos($before, '<');
        $tagBeforeAttr = ($lastOpen !== false) ? substr($before, $lastOpen) : '';
        $isInsideSrc = ($htmlContext === 'inside_tag') && preg_match('/src\s*=\s*["\'][^"\']*$/i', $tagBeforeAttr);
        $isInsideHref = ($htmlContext === 'inside_tag') && preg_match('/href\s*=\s*["\'][^"\']*$/i', $tagBeforeAttr);

        // Handle empty/missing value with smart fallback
        if ($val === null || $val === '') {
            $after = substr($html, $offset, 300);
            $tagSurround = $tagBeforeAttr . $after;
            $tagClose = strpos($tagSurround, '>');
            if ($tagClose !== false) {
                $tagSurround = substr($tagSurround, 0, $tagClose + 1);
            }

            if ($isInsideSrc) {
                if (preg_match('/data-fallback-src\s*=\s*["\']([^"\']+)["\']/i', $tagSurround, $mFbSrc)) {
                    return $mFbSrc[1];
                }
                $fbImg = $fallbacks[$tag] ?? ($canonicalFallbacks[$canon] ?? ($fallbacks['default_image'] ?? 'https://placehold.co/600x400/f8fafc/94a3b8?text=Image'));
                return $fbImg;
            }
            if ($isInsideHref) {
                if (preg_match('/data-fallback-url\s*=\s*["\']([^"\']+)["\']/i', $tagSurround, $mFbUrl)) {
                    return $mFbUrl[1];
                }
                $fbLink = $fallbacks[$tag] ?? ($canonicalFallbacks[$canon] ?? ($fallbacks['default_link'] ?? '#'));
                return $fbLink;
            }
            return (string)($fallbacks[$tag] ?? ($canonicalFallbacks[$canon] ?? ''));
        }

        // Check if the variable value is a Link or Domain (https://..., www...., ideas.edu.vn, domain.com, etc.)
        $normalizedHref = null;
        if (isLinkOrDomainValue($val, $normalizedHref)) {
            if ($isInsideSrc || $isInsideHref || $htmlContext === 'inside_tag') {
                // Inside <a href="{{var}}"> or <img src="{{var}}"> -> return normalized href without wrapping <a>
                return $normalizedHref;
            } elseif ($htmlContext === 'inside_anchor') {
                // Already inside <a href="...">{{var}}</a> -> return raw value text without nesting <a>
                return $val;
            } elseif ($htmlContext === 'html_text') {
                // In HTML body text -> render as a clean, active clickable anchor tag
                $escapedHref = htmlspecialchars($normalizedHref, ENT_QUOTES, 'UTF-8');
                $escapedText = htmlspecialchars($val, ENT_QUOTES, 'UTF-8');
                return '<a href="' . $escapedHref . '" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; word-break: break-all;">' . $escapedText . '</a>';
            } else {
                // Plain text message (Zalo/SMS/Telegram/Meta) -> return normalized URL so messaging clients auto-link
                return $normalizedHref;
            }
        }

        if ($isInsideSrc || $isInsideHref) {
            return (string)$val;
        }

        return (string)$val;
    }, $html, -1, $count, PREG_OFFSET_CAPTURE);

    return $html;
}

/**
 * Check if a subscriber matches criteria (Segment logic)
 */
function isSubscriberMatch($sub, $criteriaJson)
{
    global $pdo;
    if (empty($criteriaJson))
        return true;

    $groups = is_string($criteriaJson) ? json_decode($criteriaJson, true) : $criteriaJson;

    if (!$groups || !is_array($groups))
        return false;

    foreach ($groups as $group) {
        $groupMatch = true;
        if (!isset($group['conditions']) || !is_array($group['conditions']))
            continue; // Skip if no conditions

        foreach ($group['conditions'] as $cond) {
            $field = $cond['field'];
            $op = $cond['operator'];
            $val = strtolower($cond['value'] ?? '');
            $actualVal = "";

            if (strpos($field, 'stats.') === 0) {
                $statKey = str_replace('stats.', '', $field);
                if ($statKey == 'emailsOpened')
                    $actualVal = $sub['stats_opened'] ?? 0;
                else if ($statKey == 'linksClicked')
                    $actualVal = $sub['stats_clicked'] ?? 0;
            } else if ($field === 'tags') {
                // 10M UPGRADE: Cache relational tags for this call
                $sid = $sub['id'] ?? $sub['sub_id'] ?? $sub['subscriber_id'] ?? null;
                static $lastSubIdForTags = null;
                static $currentSubTags = [];

                if ($sid && $lastSubIdForTags !== $sid) {
                    $stmtTag = $pdo->prepare("SELECT t_sub.name FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.subscriber_id = ?");
                    $stmtTag->execute([$sid]);
                    $currentSubTags = $stmtTag->fetchAll(PDO::FETCH_COLUMN);
                    $lastSubIdForTags = $sid;
                }

                $hasTag = false;
                foreach ($currentSubTags as $st) {
                    if (strcasecmp($st, $cond['value'] ?? '') === 0 || mb_stripos((string)$st, (string)($cond['value'] ?? '')) !== false) {
                        $hasTag = true;
                        break;
                    }
                }

                if ($op === 'contains' && !$hasTag) {
                    $groupMatch = false;
                    break;
                } else if ($op === 'not_contains' && $hasTag) {
                    $groupMatch = false;
                    break;
                } else if (($op === 'is_set' || $op === 'is_not_empty') && empty($currentSubTags)) {
                    $groupMatch = false;
                    break;
                } else if (($op === 'is_not_set' || $op === 'is_empty') && !empty($currentSubTags)) {
                    $groupMatch = false;
                    break;
                }
                continue;
            } else if ($field === 'lastActivityDays' || $field === 'last_activity_days') {
                $lastAct = !empty($sub['last_activity_at']) ? $sub['last_activity_at'] : (!empty($sub['joined_at']) ? $sub['joined_at'] : ($sub['created_at'] ?? date('Y-m-d')));
                $actualVal = (time() - strtotime($lastAct)) / 86400; // days
            } else {
                // Map frontend field names to DB columns (handles both camelCase, snake_case, and CRM fields)
                $map = [
                    'firstName' => 'first_name',
                    'first_name' => 'first_name',
                    'lastName' => 'last_name',
                    'last_name' => 'last_name',
                    'email' => 'email',
                    'phoneNumber' => 'phone_number',
                    'phone_number' => 'phone_number',
                    'companyName' => 'company_name',
                    'company_name' => 'company_name',
                    'jobTitle' => 'job_title',
                    'job_title' => 'job_title',
                    'gender' => 'gender',
                    'status' => 'status',
                    'source' => 'source',
                    'salesperson' => 'salesperson',
                    'city' => 'city',
                    'district' => 'district',
                    'ward' => 'ward',
                    'country' => 'country',
                    'address' => 'address',
                    'dateOfBirth' => 'date_of_birth',
                    'date_of_birth' => 'date_of_birth',
                    'anniversaryDate' => 'anniversary_date',
                    'anniversary_date' => 'anniversary_date',
                    'joinedAt' => 'joined_at',
                    'joined_at' => 'joined_at',
                    'leadScore' => 'lead_score',
                    'lead_score' => 'lead_score',
                    'verified' => 'verified',
                    'os' => 'last_os',
                    'device' => 'last_device',
                    'browser' => 'last_browser',
                    'program' => 'program',
                    'crm_program' => 'program',
                    'stage_id' => 'stage_id',
                    'crm_stage' => 'stage_id',
                    'crm_stage_id' => 'stage_id',
                    'pipeline_status' => 'pipeline_status',
                    'crm_pipeline_status' => 'pipeline_status',
                    'lead_status' => 'lead_status',
                    'crm_lead_status' => 'lead_status',
                    'owner_id' => 'owner_id',
                    'crm_owner_id' => 'owner_id',
                ];

                $dbField = $map[$field] ?? null;

                if ($dbField && isset($sub[$dbField])) {
                    $actualVal = $sub[$dbField];
                } else {
                    $customAttrs = [];
                    if (isset($sub['custom_attributes'])) {
                        $customAttrs = is_array($sub['custom_attributes'])
                            ? $sub['custom_attributes']
                            : (json_decode($sub['custom_attributes'], true) ?: []);
                    }

                    if (isset($customAttrs[$field])) {
                        $actualVal = $customAttrs[$field];
                    } else {
                        $actualVal = $sub[$field] ?? "";
                    }
                }
            }

            $actualVal = (string) $actualVal;
            $isMatch = false;

            switch ($op) {
                case 'contains':
                    if (mb_stripos($actualVal, $val, 0, 'UTF-8') !== false)
                        $isMatch = true;
                    break;
                case 'not_contains':
                    if (mb_stripos($actualVal, $val, 0, 'UTF-8') === false)
                        $isMatch = true;
                    break;
                case 'equals':
                case 'is':
                    if (mb_strtolower($actualVal, 'UTF-8') === mb_strtolower($val, 'UTF-8'))
                        $isMatch = true;
                    break;
                case 'is_not':
                    if (mb_strtolower($actualVal, 'UTF-8') !== mb_strtolower($val, 'UTF-8'))
                        $isMatch = true;
                    break;
                case 'starts_with':
                    if (substr(strtolower($actualVal), 0, strlen($val)) === $val)
                        $isMatch = true;
                    break;
                case 'ends_with':
                    if ($val === '' || substr(strtolower($actualVal), -strlen($val)) === $val)
                        $isMatch = true;
                    break;
                case 'is_set':
                case 'is_not_empty':
                    if (trim($actualVal) !== '')
                        $isMatch = true;
                    break;
                case 'is_not_set':
                case 'is_empty':
                    if (trim($actualVal) === '')
                        $isMatch = true;
                    break;
                case 'greater_than':
                    if ((float) $actualVal > (float) $val)
                        $isMatch = true;
                    break;
                case 'greater_than_or_equal':
                    if ((float) $actualVal >= (float) $val)
                        $isMatch = true;
                    break;
                case 'less_than':
                    if ((float) $actualVal < (float) $val)
                        $isMatch = true;
                    break;
                case 'less_than_or_equal':
                    if ((float) $actualVal <= (float) $val)
                        $isMatch = true;
                    break;
                case 'after':
                case 'is_after':
                    if ($actualVal && strtotime($actualVal) > strtotime($val))
                        $isMatch = true;
                    break;
                case 'before':
                case 'is_before':
                    if ($actualVal && strtotime($actualVal) < strtotime($val))
                        $isMatch = true;
                    break;
                case 'on':
                case 'is_on':
                    if ($actualVal && date('Y-m-d', strtotime($actualVal)) === $val)
                        $isMatch = true;
                    break;
                case 'in_last_days':
                    if ($actualVal && strtotime($actualVal) >= strtotime('-' . max(0, (int)$val) . ' days'))
                        $isMatch = true;
                    break;
                case 'before_days':
                    if ($actualVal && strtotime($actualVal) < strtotime('-' . max(0, (int)$val) . ' days'))
                        $isMatch = true;
                    break;
                case 'is_today':
                    if ($actualVal && date('m-d', strtotime($actualVal)) === date('m-d'))
                        $isMatch = true;
                    break;
                case 'is_this_month':
                    if ($actualVal && date('m', strtotime($actualVal)) === date('m'))
                        $isMatch = true;
                    break;
            }

            if (!$isMatch) {
                $groupMatch = false;
                break;
            }
        }
        if ($groupMatch)
            return true;
    }
    return false;
}

/**
 * Detect Hard Bounce and mark subscriber as bounced
 */
function checkAndHandleHardBounce($pdo, $subscriberId, $errorMessage)
{
    if (!is_string($errorMessage)) {
        return false;
    }

    $isHardBounce = false;
    $hardBounceKeywords = [
        'hard bounce',
        'invalid recipient',
        'unreachable',
        'address rejected',
        'does not exist',
        '550 5.1.1',
        '550 5.2.1',
        '550 5.1.1',
        'user unknown',
        'recipient unknown',
        'mailbox not found',
        'account disabled',
        '5.1.1',
        'permanent failure'
    ];

    $errorMessage = strtolower($errorMessage); // Normalize once

    foreach ($hardBounceKeywords as $kb) {
        if (strpos($errorMessage, $kb) !== false) {
            $isHardBounce = true;
            break;
        }
    }

    if ($isHardBounce) {
        $stmtWs = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ?");
        $stmtWs->execute([$subscriberId]);
        $wsId = $stmtWs->fetchColumn();

        $pdo->prepare("UPDATE subscribers SET status = 'bounced' WHERE id = ?")->execute([$subscriberId]);
        
        // [FIX AUDIT-05] Log specifically why it was bounced for better UX/Debugging
        logActivity($pdo, $subscriberId, 'bounced_status', null, 'Mailer', "Hard Bounce detected: " . $errorMessage, null, null, [], $wsId);
        
        return true;
    }

    return false;
}

/**
 * Fetch a comprehensive subscriber profile for flow evaluation (including live MYERP CRM fields)
 */
function getSubscriberProfileForFlow($pdo, $subscriberId)
{
    $stmt = $pdo->prepare(
        "SELECT id, workspace_id, contact_id, email, first_name, last_name, phone_number, status, source,
                gender, date_of_birth, anniversary_date, city, district, ward, country, address,
                company_name, job_title, salesperson, verified, meta_psid, is_zalo_follower,
                owner_id, program, stage_id, pipeline_status, lead_status,
                last_os, last_browser, last_device, last_city, last_country, last_ip,
                zalo_user_id, custom_attributes, lead_score, joined_at, created_at, last_activity_at,
                stats_sent, stats_opened, stats_clicked
         FROM subscribers WHERE id = ? LIMIT 1"
    );
    $stmt->execute([$subscriberId]);
    $sub = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($sub) {
        // 1. Fetch Relational Tags
        $stmtT = $pdo->prepare("SELECT t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.subscriber_id = ?");
        $stmtT->execute([$subscriberId]);
        $tagsArray = $stmtT->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // 2. Default CRM enrichment keys from subscriber columns
        $sub['crm_stage_id'] = !empty($sub['stage_id']) ? (string)$sub['stage_id'] : '';
        $sub['crm_stage_name'] = '';
        $sub['crm_pipeline_status'] = $sub['pipeline_status'] ?? '';
        $sub['crm_lead_status'] = $sub['lead_status'] ?? '';
        $sub['crm_temperature'] = '';
        $sub['crm_program'] = $sub['program'] ?? '';
        $sub['crm_owner_id'] = !empty($sub['owner_id']) ? (string)$sub['owner_id'] : '';
        $sub['crm_team_id'] = '';
        $sub['crm_branch_id'] = '';
        $sub['crm_sale_contacted'] = 'false';
        $sub['crm_hours_uncontacted'] = 0;
        $sub['crm_deposit_status'] = 'none';
        $sub['crm_deposit_amount'] = 0;
        $sub['crm_expected_revenue'] = 0;
        $sub['survey_score'] = '';
        // Deep MYERP Student / Class / Tuition / Deal / Ticket / Certificate fields
        $sub['erp_is_student'] = 'no';
        $sub['erp_student_status'] = '';
        $sub['erp_class_id'] = '';
        $sub['erp_class_name'] = $sub['program'] ?? '';
        $sub['erp_tuition_status'] = 'unpaid';
        $sub['erp_deal_status'] = 'no_deal';
        $sub['erp_deal_value'] = 0;
        $sub['erp_sla_uncontacted_hours'] = 0;
        $sub['erp_ticket_status'] = 'no_ticket';
        $sub['erp_has_certificate'] = 'no';

        // Channel reachability array & primary channel
        $channelsList = [];
        $rawPhone = trim((string)($sub['phone_number'] ?? ''));
        $rawEmail = trim((string)($sub['email'] ?? ''));
        $hasValidPhone = ($rawPhone !== '' && strlen(preg_replace('/\D+/', '', $rawPhone)) >= 8);
        $hasValidEmail = ($rawEmail !== '' && !isVirtualEmail($rawEmail) && strpos($rawEmail, '@myerp.local') === false);
        $hasZalo = (!empty($sub['zalo_user_id']) || !empty($sub['is_zalo_follower']) || $hasValidPhone);
        if ($hasZalo) {
            $channelsList[] = 'zalo_oa';
        }
        if ($hasValidPhone) {
            $channelsList[] = 'phone_valid';
        }
        if ($hasValidEmail) {
            $channelsList[] = 'email_valid';
        }
        $sub['channel_available_list'] = $channelsList;
        $sub['channel_available'] = $channelsList[0] ?? 'none';

        // 3. Enrich from MYERP CRM contacts, pipeline_stages, deposits, deals, tickets, and certificates
        try {
            $contactId = !empty($sub['contact_id']) ? (int)$sub['contact_id'] : 0;
            if ($contactId <= 0 && (!empty($sub['email']) || !empty($sub['phone_number']))) {
                if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
                    require_once __DIR__ . '/../utils/DomationContactMatcher.php';
                }
                if (class_exists('DomationContactMatcher')) {
                    $matchedId = DomationContactMatcher::findExistingContactId($pdo, $sub['email'] ?? null, $sub['phone_number'] ?? null, 1);
                    if ($matchedId) {
                        $contactId = (int)$matchedId;
                        $sub['contact_id'] = $contactId;
                    }
                }
            }

            if ($contactId > 0) {
                $stmtCrm = $pdo->prepare("
                    SELECT c.stage_id, c.pipeline_status, c.lead_status, c.status AS contact_status,
                           c.temperature, c.program, c.project_id, c.student_id, c.study_status,
                           c.owner_id, c.company_id, c.expected_revenue, c.total_spent, c.last_contact, c.created_at AS assigned_at, c.created_at,
                           c.tags, c.district, c.ward, c.city,
                           u.team_id AS owner_team_id,
                           ps.name AS stage_name, ps.system_slug AS stage_slug, ps.is_won AS stage_is_won, ps.order_index AS stage_order,
                           pr.name AS project_name, pr.code AS project_code
                    FROM contacts c
                    LEFT JOIN users u ON u.id = c.owner_id
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    LEFT JOIN projects pr ON pr.id = c.project_id
                    WHERE c.id = ? AND c.deleted_at IS NULL
                    LIMIT 1
                ");
                $stmtCrm->execute([$contactId]);
                $crmRow = $stmtCrm->fetch(PDO::FETCH_ASSOC);

                if ($crmRow) {
                    $sub['crm_stage_id'] = !empty($crmRow['stage_id']) ? (string)$crmRow['stage_id'] : $sub['crm_stage_id'];
                    $sub['crm_stage_name'] = $crmRow['stage_name'] ?? '';
                    $sub['crm_pipeline_status'] = !empty($crmRow['stage_slug']) ? $crmRow['stage_slug'] : (!empty($crmRow['pipeline_status']) ? $crmRow['pipeline_status'] : $sub['crm_pipeline_status']);
                    $sub['crm_lead_status'] = !empty($crmRow['lead_status']) ? $crmRow['lead_status'] : $sub['crm_lead_status'];
                    $sub['crm_temperature'] = !empty($crmRow['temperature']) ? $crmRow['temperature'] : $sub['crm_lead_status'];
                    $sub['crm_program'] = !empty($crmRow['program']) ? $crmRow['program'] : (!empty($crmRow['project_name']) ? $crmRow['project_name'] : $sub['crm_program']);
                    $sub['crm_owner_id'] = !empty($crmRow['owner_id']) ? (string)$crmRow['owner_id'] : $sub['crm_owner_id'];
                    $sub['crm_team_id'] = !empty($crmRow['owner_team_id']) ? (string)$crmRow['owner_team_id'] : '';
                    $sub['crm_branch_id'] = !empty($crmRow['company_id']) ? (string)$crmRow['company_id'] : '';
                    $sub['crm_expected_revenue'] = isset($crmRow['expected_revenue']) ? (float)$crmRow['expected_revenue'] : 0;
                    $sub['erp_class_id'] = !empty($crmRow['project_id']) ? (string)$crmRow['project_id'] : $sub['crm_program'];
                    $sub['erp_class_name'] = !empty($crmRow['project_name']) ? $crmRow['project_name'] : $sub['crm_program'];

                    // Check latest distribution_logs for round_id and received_at
                    $distReceivedAt = null;
                    try {
                        $stmtDl = $pdo->prepare("SELECT round_id, received_at FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
                        $stmtDl->execute([$contactId]);
                        $dlRow = $stmtDl->fetch(PDO::FETCH_ASSOC);
                        if ($dlRow) {
                            if (empty($sub['crm_team_id']) && !empty($dlRow['round_id'])) {
                                $sub['crm_team_id'] = (string)$dlRow['round_id'];
                            }
                            if (!empty($dlRow['received_at'])) {
                                $distReceivedAt = $dlRow['received_at'];
                            }
                        }
                    } catch (Throwable $eDl) {}

                    // Determine erp_is_student & erp_student_status
                    $studyStLower = mb_strtolower(trim((string)($crmRow['study_status'] ?? '')), 'UTF-8');
                    $pipeLower = mb_strtolower(trim((string)($sub['crm_pipeline_status'] ?? '')), 'UTF-8');
                    $isStudentBool = (
                        ($crmRow['contact_status'] ?? '') === 'customer'
                        || in_array($pipeLower, ['enrolled', 'hoc_vien', 'dong_deal', 'thanh_cong', 'won'], true)
                        || !empty(trim((string)($crmRow['student_id'] ?? '')))
                        || $studyStLower !== ''
                        || !empty($crmRow['stage_is_won'])
                    );
                    $sub['erp_is_student'] = $isStudentBool ? 'yes' : 'no';

                    if (in_array($studyStLower, ['completed', 'graduated', 'hoan_thanh', 'hoàn thành', 'tot_nghiep', 'tốt nghiệp'], true)) {
                        $sub['erp_student_status'] = 'completed';
                        $sub['erp_has_certificate'] = 'yes';
                    } elseif (in_array($studyStLower, ['reserved', 'deferred', 'bao_luu', 'bảo lưu'], true)) {
                        $sub['erp_student_status'] = 'reserved';
                    } elseif (in_array($studyStLower, ['suspended', 'tam_ngung', 'tạm ngưng'], true)) {
                        $sub['erp_student_status'] = 'suspended';
                    } elseif (in_array($studyStLower, ['dropped', 'bo_hoc', 'bỏ học', 'nghi_hoc', 'nghỉ học'], true)) {
                        $sub['erp_student_status'] = 'dropped';
                    } elseif ($isStudentBool || in_array($studyStLower, ['studying', 'dang_hoc', 'đang học', 'active'], true)) {
                        $sub['erp_student_status'] = 'studying';
                    }

                    // Check if Sale has contacted the lead (call, note, meeting, zalo, or moved past stage 1)
                    $hasSaleActivity = false;
                    $stageOrder = (int)($crmRow['stage_order'] ?? 0);
                    $stageIdInt = (int)($crmRow['stage_id'] ?? 0);
                    if (($stageOrder > 1) || ($stageIdInt > 1 && !in_array($pipeLower, ['new_lead', 'assigned'], true))) {
                        $hasSaleActivity = true;
                    }
                    if (!$hasSaleActivity) {
                        try {
                            $stmtActCheck = $pdo->prepare("
                                SELECT 1 FROM activities
                                WHERE (contact_id = ? OR (related_type IN ('contact', 'lead') AND related_id = ?))
                                  AND type IN ('call', 'meeting', 'note', 'email', 'zalo', 'task')
                                  AND status != 'cancelled'
                                  AND deleted_at IS NULL
                                LIMIT 1
                            ");
                            $stmtActCheck->execute([$contactId, $contactId]);
                            if ($stmtActCheck->fetchColumn()) {
                                $hasSaleActivity = true;
                            }
                        } catch (Throwable $eAct) {}
                    }
                    $sub['crm_sale_contacted'] = $hasSaleActivity ? 'true' : 'false';

                    // SLA uncontacted hours
                    $slaRefTime = $distReceivedAt ?: (!empty($crmRow['assigned_at']) ? $crmRow['assigned_at'] : ($crmRow['created_at'] ?? null));
                    if (!$hasSaleActivity && !empty($slaRefTime)) {
                        $hoursUncontacted = max(0, (int)floor((time() - strtotime($slaRefTime)) / 3600));
                        $sub['erp_sla_uncontacted_hours'] = $hoursUncontacted;
                        $sub['crm_hours_uncontacted'] = $hoursUncontacted;
                    }

                    if (empty($sub['district']) && !empty($crmRow['district'])) {
                        $sub['district'] = $crmRow['district'];
                    }
                    if (empty($sub['ward']) && !empty($crmRow['ward'])) {
                        $sub['ward'] = $crmRow['ward'];
                    }
                    if (empty($sub['city']) && !empty($crmRow['city'])) {
                        $sub['city'] = $crmRow['city'];
                    }

                    if (!empty($crmRow['tags'])) {
                        $crmTags = json_decode($crmRow['tags'], true);
                        if (is_array($crmTags)) {
                            foreach ($crmTags as $ct) {
                                if (is_string($ct) && trim($ct) !== '' && !in_array($ct, $tagsArray, true)) {
                                    $tagsArray[] = trim($ct);
                                }
                            }
                        }
                    }
                }

                // Query deposit & tuition milestone summary for contact
                $stmtDep = $pdo->prepare("
                    SELECT
                        MAX(CASE WHEN status IN ('approved', 'completed', 'paid') THEN 1 ELSE 0 END) AS has_approved,
                        MAX(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS has_pending,
                        COALESCE(SUM(CASE WHEN status IN ('approved', 'completed', 'paid') THEN price ELSE 0 END), 0) AS approved_amount
                    FROM deposits
                    WHERE contact_id = ?
                ");
                $stmtDep->execute([$contactId]);
                $depSummary = $stmtDep->fetch(PDO::FETCH_ASSOC);
                if ($depSummary) {
                    if (!empty($depSummary['has_approved'])) {
                        $sub['crm_deposit_status'] = 'approved';
                    } elseif (!empty($depSummary['has_pending'])) {
                        $sub['crm_deposit_status'] = 'pending';
                    } else {
                        $sub['crm_deposit_status'] = 'none';
                    }
                    $sub['crm_deposit_amount'] = (float)($depSummary['approved_amount'] ?? 0);
                }

                // Tuition status (paid / has_debt / overdue / unpaid)
                $hasOverdueMilestone = false;
                $hasDebtMilestone = false;
                try {
                    $stmtMs = $pdo->prepare("
                        SELECT
                            MAX(CASE WHEN dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date < CURDATE() THEN 1 ELSE 0 END) AS is_overdue,
                            MAX(CASE WHEN dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND COALESCE(dm.expected_amount, 0) > COALESCE(dm.actual_amount, 0) THEN 1 ELSE 0 END) AS is_debt
                        FROM deposit_milestones dm
                        INNER JOIN deposits dep ON dep.id = dm.deposit_id
                        WHERE dep.contact_id = ? AND dep.status != 'rejected'
                    ");
                    $stmtMs->execute([$contactId]);
                    $msRow = $stmtMs->fetch(PDO::FETCH_ASSOC);
                    $hasOverdueMilestone = !empty($msRow['is_overdue']);
                    $hasDebtMilestone = !empty($msRow['is_debt']);
                } catch (Throwable $eMs) {}

                $expRev = (float)($crmRow['expected_revenue'] ?? 0);
                $totSpent = (float)($crmRow['total_spent'] ?? 0);
                $hasContactDebt = ($expRev > 0 && $expRev > $totSpent) || ($sub['crm_deposit_status'] === 'pending');

                if ($hasOverdueMilestone) {
                    $sub['erp_tuition_status'] = 'overdue';
                } elseif ($hasDebtMilestone || $hasContactDebt) {
                    $sub['erp_tuition_status'] = 'has_debt';
                } elseif ($sub['crm_deposit_status'] === 'approved' || ($totSpent > 0 && $totSpent >= $expRev)) {
                    $sub['erp_tuition_status'] = 'paid';
                } else {
                    $sub['erp_tuition_status'] = 'unpaid';
                }

                // Deals summary
                try {
                    $stmtDealSum = $pdo->prepare("
                        SELECT
                            COUNT(d.id) AS total_deals,
                            COALESCE(SUM(d.value), 0) AS total_val,
                            MAX(CASE WHEN ps.is_won = 1 OR ps.system_slug IN ('enrolled', 'hoc_vien', 'dong_deal', 'thanh_cong', 'won') THEN 1 ELSE 0 END) AS has_won,
                            MAX(CASE WHEN ps.is_lost = 1 OR ps.system_slug IN ('lost', 'rejected', 'churned') THEN 1 ELSE 0 END) AS has_lost,
                            MAX(CASE WHEN COALESCE(ps.is_won, 0) = 0 AND COALESCE(ps.is_lost, 0) = 0 THEN 1 ELSE 0 END) AS has_open
                        FROM deals d
                        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
                        WHERE d.contact_id = ? AND d.deleted_at IS NULL
                    ");
                    $stmtDealSum->execute([$contactId]);
                    $dealSum = $stmtDealSum->fetch(PDO::FETCH_ASSOC);
                    if ($dealSum && (int)$dealSum['total_deals'] > 0) {
                        $sub['erp_deal_value'] = (float)$dealSum['total_val'];
                        if (!empty($dealSum['has_won'])) {
                            $sub['erp_deal_status'] = 'won';
                        } elseif (!empty($dealSum['has_open'])) {
                            $sub['erp_deal_status'] = 'open';
                        } elseif (!empty($dealSum['has_lost'])) {
                            $sub['erp_deal_status'] = 'lost';
                        }
                    }
                } catch (Throwable $eDl) {}

                // Tickets summary
                try {
                    $stmtTk = $pdo->prepare("
                        SELECT
                            COUNT(id) AS total_tickets,
                            MAX(CASE WHEN status IN ('open', 'in_progress', 'waiting') THEN 1 ELSE 0 END) AS has_open,
                            MAX(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS has_in_progress,
                            MAX(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS has_resolved
                        FROM tickets
                        WHERE contact_id = ?
                    ");
                    $stmtTk->execute([$contactId]);
                    $tkRow = $stmtTk->fetch(PDO::FETCH_ASSOC);
                    if ($tkRow && (int)$tkRow['total_tickets'] > 0) {
                        if (!empty($tkRow['has_open'])) {
                            $sub['erp_ticket_status'] = 'has_open_ticket';
                        } elseif (!empty($tkRow['has_resolved'])) {
                            $sub['erp_ticket_status'] = 'resolved';
                        }
                    }
                } catch (Throwable $eTk) {}
            }
        } catch (Throwable $eCrm) {}

        // 4. Populate survey_score and certificate check from custom_attributes if present
        if (!empty($sub['custom_attributes'])) {
            $ca = is_array($sub['custom_attributes']) ? $sub['custom_attributes'] : (json_decode($sub['custom_attributes'], true) ?: []);
            if (isset($ca['survey_score'])) {
                $sub['survey_score'] = $ca['survey_score'];
            } elseif (isset($ca['nps_score'])) {
                $sub['survey_score'] = $ca['nps_score'];
            }
            if (!empty($ca['cert_no']) || !empty($ca['certificate_code'])) {
                $sub['erp_has_certificate'] = 'yes';
            }
        }

        $sub['tags_array'] = $tagsArray;
    }

    return $sub;
}

/**
 * Centrally evaluate a group of advanced conditions (supports recursive AND / OR groups & MYERP fields)
 * Shared between worker_flow.php and worker_priority.php
 */
function evaluateAdvancedConditionGroup($pdo, $subscriberId, $subProfile, $conditions, $groupLogic = 'AND')
{
    if (empty($conditions)) {
        return false;
    }

    // Support passing a conditionGroup object directly: ['logic' => 'AND'|'OR', 'conditions' => [...]]
    if (isset($conditions['conditions']) && is_array($conditions['conditions'])) {
        $groupLogic = strtoupper($conditions['logic'] ?? $groupLogic);
        $conditions = $conditions['conditions'];
        if (empty($conditions)) {
            return false;
        }
    }

    $isOrGroup = (strtoupper((string)$groupLogic) === 'OR');
    $anyMatched = false;

    foreach ($conditions as $cond) {
        // Recursive nested condition group support
        if (isset($cond['conditions']) && is_array($cond['conditions'])) {
            $subLogic = strtoupper($cond['logic'] ?? 'AND');
            $subMatch = evaluateAdvancedConditionGroup($pdo, $subscriberId, $subProfile, $cond['conditions'], $subLogic);
            if ($isOrGroup) {
                if ($subMatch) return true;
            } else {
                if (!$subMatch) return false;
            }
            continue;
        }

        $field = $cond['field'] ?? '';
        $op = $cond['operator'] ?? 'equals';
        $val = trim((string)($cond['value'] ?? ''));

        // -----------------------------------------------------------------
        // 1. Map Fields to Actual Subscriber Data
        // -----------------------------------------------------------------
        $actualVal = "";
        $isArrayField = false;
        $isSpecialField = false; // handled separately (web_activity, activity_history, lastActivityDays)
        $condMatch = false;

        // --- Profile & MYERP CRM scalar fields ---
        $profileFieldMap = [
            'email' => 'email',
            'first_name' => 'first_name',
            'firstName' => 'first_name',
            'last_name' => 'last_name',
            'lastName' => 'last_name',
            'phone_number' => 'phone_number',
            'phoneNumber' => 'phone_number',
            'company_name' => 'company_name',
            'companyName' => 'company_name',
            'job_title' => 'job_title',
            'jobTitle' => 'job_title',
            'status' => 'status',
            'source' => 'source',
            'gender' => 'gender',
            'country' => 'country',
            'city' => 'city',
            'district' => 'district',
            'ward' => 'ward',
            'address' => 'address',
            'salesperson' => 'salesperson',
            'meta_psid' => 'meta_psid',
            'is_zalo_follower' => 'is_zalo_follower',
            'verified' => 'verified',
            'lead_score' => 'lead_score',
            'leadScore' => 'lead_score',
            'os' => 'last_os',
            'device' => 'last_device',
            'browser' => 'last_browser',
            'last_os' => 'last_os',
            'last_device' => 'last_device',
            'last_browser' => 'last_browser',
            'joined_at' => 'joined_at',
            'joinedAt' => 'joined_at',
            'date_of_birth' => 'date_of_birth',
            'dateOfBirth' => 'date_of_birth',
            'anniversary_date' => 'anniversary_date',
            'anniversaryDate' => 'anniversary_date',
            'last_activity_at' => 'last_activity_at',
            'lastActivityAt' => 'last_activity_at',
            // Deep MYERP CRM fields
            'program' => 'crm_program',
            'crm_program' => 'crm_program',
            'owner_id' => 'crm_owner_id',
            'crm_owner_id' => 'crm_owner_id',
            'team_id' => 'crm_team_id',
            'crm_team_id' => 'crm_team_id',
            'branch_id' => 'crm_branch_id',
            'crm_branch_id' => 'crm_branch_id',
            'crm_sale_contacted' => 'crm_sale_contacted',
            'crm_hours_uncontacted' => 'crm_hours_uncontacted',
            'stage_id' => 'crm_stage_id',
            'crm_stage' => 'crm_stage_id',
            'crm_stage_id' => 'crm_stage_id',
            'stage_name' => 'crm_stage_name',
            'crm_stage_name' => 'crm_stage_name',
            'pipeline_status' => 'crm_pipeline_status',
            'crm_pipeline_status' => 'crm_pipeline_status',
            'lead_status' => 'crm_lead_status',
            'crm_lead_status' => 'crm_lead_status',
            'temperature' => 'crm_temperature',
            'crm_temperature' => 'crm_temperature',
            'deposit_status' => 'crm_deposit_status',
            'crm_deposit_status' => 'crm_deposit_status',
            'deposit_amount' => 'crm_deposit_amount',
            'crm_deposit_amount' => 'crm_deposit_amount',
            'expected_revenue' => 'crm_expected_revenue',
            'crm_expected_revenue' => 'crm_expected_revenue',
            'survey_score' => 'survey_score',
            // Deep MYERP Student, Class, Tuition, Deal, SLA, Ticket & Certificate fields
            'erp_is_student' => 'erp_is_student',
            'erp_student_status' => 'erp_student_status',
            'erp_class_id' => 'erp_class_id',
            'erp_class_name' => 'erp_class_name',
            'erp_tuition_status' => 'erp_tuition_status',
            'erp_deal_status' => 'erp_deal_status',
            'erp_deal_value' => 'erp_deal_value',
            'erp_sla_uncontacted_hours' => 'erp_sla_uncontacted_hours',
            'erp_ticket_status' => 'erp_ticket_status',
            'erp_has_certificate' => 'erp_has_certificate',
        ];

        if ($field === 'tags' || $field === 'crm_tags') {
            if (isset($subProfile['tags_array'])) {
                $actualVal = $subProfile['tags_array'];
            } else {
                $stmtT = $pdo->prepare("SELECT t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.subscriber_id = ?");
                $stmtT->execute([$subscriberId]);
                $actualVal = $stmtT->fetchAll(PDO::FETCH_COLUMN);
            }
            $isArrayField = true;

        } elseif ($field === 'channel_available') {
            $actualVal = $subProfile['channel_available_list'] ?? [$subProfile['channel_available'] ?? 'none'];
            $isArrayField = true;

        } elseif ($field === 'crm_owner_id' || $field === 'owner_id') {
            $rawOwnerVal = trim((string)($subProfile['crm_owner_id'] ?? ($subProfile['owner_id'] ?? '')));
            if ($val === 'unassigned') {
                $actualVal = ($rawOwnerVal === '' || $rawOwnerVal === '0') ? 'unassigned' : $rawOwnerVal;
            } else {
                $actualVal = $rawOwnerVal;
            }

        } elseif ($field === 'crm_deposit_status' || $field === 'deposit_status') {
            $rawDepSt = strtolower(trim((string)($subProfile['crm_deposit_status'] ?? 'none')));
            if (in_array(strtolower($val), ['paid', 'approved', 'completed'], true) && in_array($rawDepSt, ['paid', 'approved', 'completed'], true)) {
                $actualVal = strtolower($val);
            } else {
                $actualVal = $rawDepSt;
            }

        } elseif ($field === 'crm_sale_contacted') {
            $rawContacted = strtolower(trim((string)($subProfile['crm_sale_contacted'] ?? 'false')));
            $isContactedBool = in_array($rawContacted, ['true', 'yes', '1'], true);
            if (in_array(strtolower($val), ['true', 'yes', '1'], true)) {
                $actualVal = $isContactedBool ? strtolower($val) : 'false';
            } elseif (in_array(strtolower($val), ['false', 'no', '0'], true)) {
                $actualVal = !$isContactedBool ? strtolower($val) : 'true';
            } else {
                $actualVal = $isContactedBool ? 'true' : 'false';
            }

        } elseif ($field === 'erp_class_id' || $field === 'erp_class_name') {
            $classIdVal = (string)($subProfile['erp_class_id'] ?? '');
            $classNameVal = (string)($subProfile['erp_class_name'] ?? ($subProfile['crm_program'] ?? ''));
            if (!is_numeric($val) && $val !== '') {
                $actualVal = $classNameVal ?: $classIdVal;
            } else {
                $actualVal = $classIdVal ?: $classNameVal;
            }

        } elseif (in_array($field, ['crm_stage', 'crm_stage_id', 'stage_id'], true)) {
            // Allow matching against stage_id, stage_name, or pipeline_status slug seamlessly
            $stageIdVal = (string)($subProfile['crm_stage_id'] ?? ($subProfile['stage_id'] ?? ''));
            $stageNameVal = (string)($subProfile['crm_stage_name'] ?? '');
            $stageSlugVal = (string)($subProfile['crm_pipeline_status'] ?? ($subProfile['pipeline_status'] ?? ''));
            if (!is_numeric($val) && $val !== '') {
                if (mb_strtolower($stageNameVal, 'UTF-8') === mb_strtolower($val, 'UTF-8') || mb_stripos($stageNameVal, $val, 0, 'UTF-8') !== false) {
                    $actualVal = $stageNameVal;
                } elseif (mb_strtolower($stageSlugVal, 'UTF-8') === mb_strtolower($val, 'UTF-8')) {
                    $actualVal = $stageSlugVal;
                } else {
                    $actualVal = $stageNameVal ?: $stageIdVal;
                }
            } else {
                $actualVal = $stageIdVal;
            }

        } elseif (isset($profileFieldMap[$field])) {
            $mappedKey = $profileFieldMap[$field];
            $actualVal = $subProfile[$mappedKey] ?? ($subProfile[$field] ?? '');

        } elseif ($field === 'custom_field') {
            $attrKey = $cond['key'] ?? '';
            if ($attrKey && !empty($subProfile['custom_attributes'])) {
                $customAttrs = is_array($subProfile['custom_attributes'])
                    ? $subProfile['custom_attributes']
                    : json_decode($subProfile['custom_attributes'], true);
                $actualVal = $customAttrs[$attrKey] ?? '';
            } else {
                $actualVal = '';
            }

        } elseif ($field === 'lastActivityDays' || $field === 'last_activity_days') {
            // [BUG-FIX #3] Days since last activity — fallback to joined_at then created_at
            $isSpecialField = true;
            $lastAt = !empty($subProfile['last_activity_at'])
                ? $subProfile['last_activity_at']
                : (!empty($subProfile['joined_at']) ? $subProfile['joined_at'] : ($subProfile['created_at'] ?? null));
            if ($lastAt) {
                $diffDays = (int) floor((time() - strtotime($lastAt)) / 86400);
            } else {
                $diffDays = 9999; // never active
            }
            $condMatch = false;
            if ($op === 'greater_than') {
                $condMatch = ($diffDays > (int) $val);
            } elseif ($op === 'greater_than_or_equal') {
                $condMatch = ($diffDays >= (int) $val);
            } elseif ($op === 'less_than') {
                $condMatch = ($diffDays < (int) $val);
            } elseif ($op === 'less_than_or_equal') {
                $condMatch = ($diffDays <= (int) $val);
            } elseif ($op === 'equals' || $op === 'is') {
                $condMatch = ($diffDays === (int) $val);
            } elseif ($op === 'is_not') {
                $condMatch = ($diffDays !== (int) $val);
            }

        } elseif ($field === 'web_activity' || $field === 'web_page_visited') {
            // Check web visit history (subscriber_activity WHERE type LIKE 'web_%')
            $isSpecialField = true;
            $lookbackLimit = (int) ($cond['lookback'] ?? 50);
            if ($lookbackLimit <= 0)
                $lookbackLimit = 1000;

            static $webHistoryCache = [];
            $cacheKey = $subscriberId . '_web_' . $lookbackLimit;
            if (!isset($webHistoryCache[$cacheKey])) {
                if (count($webHistoryCache) > 200) {
                    array_shift($webHistoryCache);
                }
                $stmtH = $pdo->prepare(
                    "SELECT CONCAT(COALESCE(reference_name,''), ' ', COALESCE(details,''))
                     FROM subscriber_activity
                     WHERE subscriber_id = ? AND type LIKE 'web_%'
                     ORDER BY created_at DESC LIMIT " . (int) $lookbackLimit
                );
                $stmtH->execute([$subscriberId]);
                $webHistoryCache[$cacheKey] = $stmtH->fetchAll(PDO::FETCH_COLUMN);
            }
            $historyItems = $webHistoryCache[$cacheKey];

            $pageUrl = trim($cond['page_url'] ?? '');
            $keywords = array_filter(array_map('trim', preg_split('/[,|]/', $val, -1, PREG_SPLIT_NO_EMPTY)));
            $found = false;
            foreach ($historyItems as $line) {
                $kwMatch = empty($keywords) ? true : false;
                foreach ($keywords as $kw) {
                    if ($kw !== '' && mb_stripos($line, $kw, 0, 'UTF-8') !== false) {
                        $kwMatch = true;
                        break;
                    }
                }
                $pageMatch = empty($pageUrl) || mb_stripos($line, $pageUrl, 0, 'UTF-8') !== false;
                if ($kwMatch && $pageMatch) {
                    $found = true;
                    break;
                }
            }
            $condMatch = ($op === 'not_contains' || $op === 'is_not_set' || $op === 'is_empty') ? !$found : $found;

        } elseif ($field === 'activity_history') {
            $isSpecialField = true;
            $activityTypes = array_filter(array_map('trim', preg_split('/[,|]/', $cond['activity_type'] ?? '', -1, PREG_SPLIT_NO_EMPTY)));
            $lookbackLimit = max(1, (int) ($cond['lookback'] ?? 50));
            $lookbackDays = (int) ($cond['days'] ?? 0);

            $sql = "SELECT CONCAT(COALESCE(details,''), ' ', COALESCE(reference_name,''), ' ', COALESCE(reference_id,''))
                    FROM subscriber_activity
                    WHERE subscriber_id = ?";
            $params = [$subscriberId];

            if (!empty($activityTypes)) {
                $placeholders = implode(',', array_fill(0, count($activityTypes), '?'));
                $sql .= " AND type IN ($placeholders)";
                $params = array_merge($params, $activityTypes);
            }
            if ($lookbackDays > 0) {
                $sql .= " AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
                $params[] = $lookbackDays;
            }
            $sql .= " ORDER BY created_at DESC LIMIT " . (int) $lookbackLimit;

            $stmtAH = $pdo->prepare($sql);
            $stmtAH->execute($params);
            $activityItems = $stmtAH->fetchAll(PDO::FETCH_COLUMN);

            $keywords = array_filter(array_map('trim', preg_split('/[,|]/', $val, -1, PREG_SPLIT_NO_EMPTY)));
            $found = false;
            if (empty($keywords)) {
                $found = !empty($activityItems);
            } else {
                foreach ($activityItems as $line) {
                    foreach ($keywords as $kw) {
                        if (!empty($kw) && stripos($line, $kw) !== false) {
                            $found = true;
                            break 2;
                        }
                    }
                }
            }
            $condMatch = ($op === 'not_contains' || $op === 'is_not_set' || $op === 'is_empty') ? !$found : $found;

        } else {
            // Fallback: try custom_attributes JSON field
            if (!empty($subProfile['custom_attributes'])) {
                $customAttrs = is_array($subProfile['custom_attributes'])
                    ? $subProfile['custom_attributes']
                    : json_decode($subProfile['custom_attributes'], true);
                $actualVal = $customAttrs[$field] ?? '';
            } else {
                $actualVal = '';
            }
            $isSpecialField = false;
        }

        // Skip scalar evaluation if special field already set $condMatch
        if ($isSpecialField) {
            if ($isOrGroup) {
                if ($condMatch) return true;
            } else {
                if (!$condMatch) return false;
            }
            continue;
        }

        // -----------------------------------------------------------------
        // 2. Evaluate Condition
        // -----------------------------------------------------------------

        // --- A. ARRAY LOGIC (tags, channel_available) ---
        if ($isArrayField && is_array($actualVal)) {
            switch ($op) {
                case 'contains':
                case 'equals':
                case 'is':
                    foreach ($actualVal as $item) {
                        if (mb_stripos((string)$item, $val) !== false) {
                            $condMatch = true;
                            break;
                        }
                    }
                    break;
                case 'not_contains':
                case 'is_not':
                    $condMatch = true;
                    foreach ($actualVal as $item) {
                        if (mb_stripos((string)$item, $val) !== false) {
                            $condMatch = false;
                            break;
                        }
                    }
                    break;
                case 'is_set':
                case 'is_not_empty':
                    $condMatch = !empty($actualVal);
                    break;
                case 'is_not_set':
                case 'is_empty':
                    $condMatch = empty($actualVal);
                    break;
                default:
                    $condMatch = false;
            }
        } else {
            // --- B. SCALAR LOGIC ---
            $isDateOp = in_array($op, ['is_before', 'is_after', 'is_on', 'before', 'after', 'on', 'in_last_days', 'before_days', 'is_today', 'is_this_month'], true);
            if (is_array($actualVal)) {
                $actualVal = json_encode($actualVal, JSON_UNESCAPED_UNICODE);
            }
            $checkVal = $isDateOp ? (string) $actualVal : mb_strtolower((string) $actualVal, 'UTF-8');
            $targetVal = $isDateOp ? (string) $val : mb_strtolower((string) $val, 'UTF-8');

            // Smart matching for tech fields
            if (in_array($field, ['os', 'device', 'browser', 'last_os', 'last_device', 'last_browser'])) {
                if ($op === 'equals')
                    $op = 'contains';
                elseif ($op === 'is_not')
                    $op = 'not_contains';
            }

            switch ($op) {
                case 'equals':
                case 'is':
                    $condMatch = ($checkVal === $targetVal);
                    break;
                case 'is_not':
                    $condMatch = ($checkVal !== $targetVal);
                    break;
                case 'contains':
                    $condMatch = ($targetVal !== '' && mb_strpos($checkVal, $targetVal, 0, 'UTF-8') !== false);
                    break;
                case 'not_contains':
                    $condMatch = ($targetVal === '' || mb_strpos($checkVal, $targetVal, 0, 'UTF-8') === false);
                    break;
                case 'starts_with':
                    $condMatch = ($targetVal === '' || substr($checkVal, 0, strlen($targetVal)) === $targetVal);
                    break;
                case 'ends_with':
                    $condMatch = ($targetVal === '' || substr($checkVal, -strlen($targetVal)) === $targetVal);
                    break;
                case 'is_set':
                case 'is_not_empty':
                    $condMatch = (trim((string)$actualVal) !== '' && $actualVal !== null);
                    break;
                case 'is_not_set':
                case 'is_empty':
                    $condMatch = (trim((string)$actualVal) === '' || $actualVal === null);
                    break;
                case 'greater_than':
                    $condMatch = (is_numeric($actualVal) && is_numeric($val) && (float) $actualVal > (float) $val);
                    break;
                case 'greater_than_or_equal':
                    $condMatch = (is_numeric($actualVal) && is_numeric($val) && (float) $actualVal >= (float) $val);
                    break;
                case 'less_than':
                    $condMatch = (is_numeric($actualVal) && is_numeric($val) && (float) $actualVal < (float) $val);
                    break;
                case 'less_than_or_equal':
                    $condMatch = (is_numeric($actualVal) && is_numeric($val) && (float) $actualVal <= (float) $val);
                    break;
                case 'in_list':
                    $listItems = array_filter(array_map('trim', preg_split("/[\r\n,]+/", $targetVal)));
                    $condMatch = in_array($checkVal, $listItems);
                    break;
                case 'is_on':
                case 'on':
                case 'is_before':
                case 'before':
                case 'is_after':
                case 'after':
                    if (!$actualVal) {
                        $condMatch = false;
                    } else {
                        $dbTs = strtotime(date('Y-m-d', strtotime($actualVal)));
                        $userTs = strtotime(date('Y-m-d', strtotime($val)));
                        if ($dbTs === false || $userTs === false) {
                            $condMatch = false;
                            break;
                        }
                        if ($op === 'is_on' || $op === 'on')
                            $condMatch = ($dbTs === $userTs);
                        if ($op === 'is_before' || $op === 'before')
                            $condMatch = ($dbTs < $userTs);
                        if ($op === 'is_after' || $op === 'after')
                            $condMatch = ($dbTs > $userTs);
                    }
                    break;
                case 'in_last_days':
                    if (!$actualVal) {
                        $condMatch = false;
                    } else {
                        $dbTs = strtotime($actualVal);
                        $days = max(0, (int)$val);
                        $condMatch = ($dbTs !== false && $dbTs >= strtotime("-{$days} days") && $dbTs <= (time() + 86400));
                    }
                    break;
                case 'before_days':
                    if (!$actualVal) {
                        $condMatch = false;
                    } else {
                        $dbTs = strtotime($actualVal);
                        $days = max(0, (int)$val);
                        $condMatch = ($dbTs !== false && $dbTs < strtotime("-{$days} days"));
                    }
                    break;
                case 'is_today':
                    if (!$actualVal) {
                        $condMatch = false;
                    } else {
                        $dbTs = strtotime($actualVal);
                        $condMatch = ($dbTs !== false && date('m-d', $dbTs) === date('m-d'));
                    }
                    break;
                case 'is_this_month':
                    if (!$actualVal) {
                        $condMatch = false;
                    } else {
                        $dbTs = strtotime($actualVal);
                        $condMatch = ($dbTs !== false && date('m', $dbTs) === date('m'));
                    }
                    break;
            }
        }

        if ($isOrGroup) {
            if ($condMatch) {
                return true;
            }
        } else {
            if (!$condMatch) {
                return false;
            }
            $anyMatched = true;
        }
    }

    return $isOrGroup ? $anyMatched : true;
}
