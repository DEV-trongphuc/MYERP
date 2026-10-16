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
            'survey_submit'
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

/**
 * Replace merge tags in content
 */
function replaceMergeTags($html, $subscriber, $context = [])
{
    if (empty($html))
        return "";

    $firstName = $subscriber['first_name'] ?? ($subscriber['firstName'] ?? '');
    $lastName = $subscriber['last_name'] ?? ($subscriber['lastName'] ?? '');
    $fullName = trim($firstName . ' ' . $lastName);
    $email = $subscriber['email'] ?? '';

    // Standard Map (Old logic + Fallbacks)
    $subscriberId = $subscriber['subscriber_id'] ?? $subscriber['id'] ?? '';
    $phoneNumber = $subscriber['phone_number'] ?? $subscriber['phone'] ?? '';
    $map = [
        'first_name' => $firstName,
        'firstName' => $firstName,
        'last_name' => $lastName,
        'lastName' => $lastName,
        'full_name' => $fullName ?: 'Bạn',
        'fullName' => $fullName ?: 'Bạn',
        'customer_name' => $fullName ?: 'Bạn',
        'customerName' => $fullName ?: 'Bạn',
        'email' => $email,
        'company_name' => $subscriber['company_name'] ?? '',
        'phone' => $phoneNumber,
        'phone_number' => $phoneNumber,
        'job_title' => $subscriber['job_title'] ?? '',
        'company' => $subscriber['company_name'] ?? '',
        'city' => $subscriber['city'] ?? ($subscriber['last_city'] ?? ''),
        'country' => $subscriber['country'] ?? '',
        'address' => $subscriber['address'] ?? ($subscriber['city'] ?? ($subscriber['last_city'] ?? '')),
        'gender' => $subscriber['gender'] ?? '',
        'birthday' => $subscriber['date_of_birth'] ?? '',
        'date_of_birth' => $subscriber['date_of_birth'] ?? '',
        'anniversary' => $subscriber['anniversary_date'] ?? '',
        'anniversary_date' => $subscriber['anniversary_date'] ?? '',
        'joined_at' => $subscriber['joined_at'] ? date('d/m/Y', strtotime($subscriber['joined_at'])) : '',
        'year' => date('Y'),
        'date' => date('d/m/Y'),
        'current_date' => date('d/m/Y'),
        'time' => date('H:i'),
        'current_time' => date('H:i'),
        // New special variables
        'today' => date('d/m/Y'),           // Ngày hôm nay (dd/mm/yyyy)
        'today_ymd' => date('Y-m-d'),        // Ngày hôm nay (yyyy-mm-dd)
        'today_dmy' => date('d-m-Y'),        // Ngày hôm nay (dd-mm-yyyy)
        'subscriber_id' => $subscriberId,    // ID của subscriber (full 32 chars)
        'subscriber_id_short' => substr((string) $subscriberId, 0, 10), // [ZNS] ID ngắn 10 ký tự cho ZNS fields có max length
        'contact_id' => $subscriberId,       // Alias for subscriber_id
        'contact_id_short' => substr((string) $subscriberId, 0, 10), // Alias short
        'random_id' => str_pad((string) rand(0, 9999999999), 10, '0', STR_PAD_LEFT), // [ZNS] Random 10 chữ số
        'random_6' => str_pad((string) rand(0, 999999), 6, '0', STR_PAD_LEFT),       // [ZNS] Random 6 chữ số
        // [FIX] camelCase aliases to match frontend email editor variables
        'phoneNumber' => $phoneNumber,
        'companyName' => $subscriber['company_name'] ?? '',
        'jobTitle' => $subscriber['job_title'] ?? '',
        // [BUG-FIX] unsubscribeLink CANNOT reference $map here — $map is still being built.
        // Referencing $map['unsubscribe_url'] inside the $map array definition is a PHP self-
        // reference bug: $map does not yet exist, so it always resolves to empty string.
        // Fix: use $context['unsubscribe_url'] directly. A post-build step below will
        // also inject it from the merged context to handle late-binding cases.
        'unsubscribeLink' => $context['unsubscribe_url'] ?? '',
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
                    if (strcasecmp($st, $cond['value']) === 0) {
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
                }
                continue;
            } else if ($field === 'lastActivityDays') {
                $lastAct = $sub['last_activity_at'] ?? null;
                $refDate = $lastAct ? $lastAct : ($sub['joined_at'] ?? date('Y-m-d'));
                $actualVal = (time() - strtotime($refDate)) / (86400); // days
            } else {
                // Map frontend field names to DB columns (handles both camelCase and snake_case)
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
                    'browser' => 'last_browser'
                ];

                $dbField = $map[$field] ?? null;

                if ($dbField && isset($sub[$dbField])) {
                    $actualVal = $sub[$dbField];
                } else {
                    // Not a standard field? Check CUSTOM ATTRIBUTES
                    // 1. Check if sub has custom_attributes (already decoded or needs decoding)
                    $customAttrs = [];
                    if (isset($sub['custom_attributes'])) {
                        $customAttrs = is_array($sub['custom_attributes'])
                            ? $sub['custom_attributes']
                            : (json_decode($sub['custom_attributes'], true) ?: []);
                    }

                    if (isset($customAttrs[$field])) {
                        $actualVal = $customAttrs[$field];
                    } else {
                        // Final fallback: direct check for $sub[$field] might work if already hydrated
                        $actualVal = $sub[$field] ?? "";
                    }
                }
            }

            $actualVal = (string) $actualVal;
            $isMatch = false;

            switch ($op) {
                case 'contains':
                    if (strpos(strtolower($actualVal), $val) !== false)
                        $isMatch = true;
                    break;
                case 'not_contains':
                    if (strpos(strtolower($actualVal), $val) === false)
                        $isMatch = true;
                    break;
                case 'equals':
                case 'is':
                    if (strtolower($actualVal) == $val)
                        $isMatch = true;
                    break;
                case 'is_not':
                    if (strtolower($actualVal) != $val)
                        $isMatch = true;
                    break;
                case 'starts_with':
                    if (substr(strtolower($actualVal), 0, strlen($val)) === $val)
                        $isMatch = true;
                    break;
                case 'greater_than':
                    if ((float) $actualVal > (float) $val)
                        $isMatch = true;
                    break;
                case 'less_than':
                    if ((float) $actualVal < (float) $val)
                        $isMatch = true;
                    break;
                case 'after':
                    if (strtotime($actualVal) > strtotime($val))
                        $isMatch = true;
                    break;
                case 'before':
                    if (strtotime($actualVal) < strtotime($val))
                        $isMatch = true;
                    break;
                case 'on':
                    if (date('Y-m-d', strtotime($actualVal)) === $val)
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
 * Fetch a comprehensive subscriber profile for flow evaluation
 */
function getSubscriberProfileForFlow($pdo, $subscriberId)
{
    // [PERF P36-FH] Changed SELECT * -> explicit columns.
    // SELECT * loads ~50 cols including large TEXT (custom_attributes, notes, address etc.)
    // over the network on EVERY flow subscriber evaluation. Explicit columns reduce
    // per-call transfer by ~60-80% on busy installations (1000+ subs/hour).
    $stmt = $pdo->prepare(
        "SELECT id, workspace_id, email, first_name, last_name, phone_number, status, source,
                gender, date_of_birth, city, country, address, company_name, job_title,
                last_os, last_browser, last_device, last_city, last_country, last_ip,
                zalo_user_id, custom_attributes, lead_score, joined_at, last_activity_at,
                stats_sent, stats_opened, stats_clicked
         FROM subscribers WHERE id = ? LIMIT 1"
    );
    $stmt->execute([$subscriberId]);
    $sub = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($sub) {
        // [10M UPGRADE] Fetch Relational Tags for proper evaluation
        $stmtT = $pdo->prepare("SELECT t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.subscriber_id = ?");
        $stmtT->execute([$subscriberId]);
        $sub['tags_array'] = $stmtT->fetchAll(PDO::FETCH_COLUMN);
    }

    return $sub;
}

/**
 * Centrally evaluate a group of advanced conditions (AND logic within a group)
 * Shared between worker_flow.php and worker_priority.php
 */
function evaluateAdvancedConditionGroup($pdo, $subscriberId, $subProfile, $conditions)
{
    if (empty($conditions)) {
        // [FIX F-5] Return false for empty conditions — an empty rule set should NOT auto-match.
        // Callers (FlowExecutor advanced_condition) already guard with !empty($conditions) before
        // calling this function, so real flows are unaffected. This stricter semantic prevents
        // accidental auto-match if this function is ever called from new code without the guard.
        return false;
    }

    foreach ($conditions as $cond) {
        $field = $cond['field'];
        $op = $cond['operator'];
        $val = trim($cond['value'] ?? '');

        // -----------------------------------------------------------------
        // 1. Map Fields to Actual Subscriber Data
        // -----------------------------------------------------------------
        $actualVal = "";
        $isArrayField = false;
        $isSpecialField = false; // handled separately (web_activity, activity_history, lastActivityDays)
        $condMatch = false;

        // --- Profile scalar fields ---
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
            'address' => 'address',
            'salesperson' => 'salesperson',
            'meta_psid' => 'meta_psid',
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
        ];

        if ($field === 'tags') {
            // [10M UPGRADE] Use pre-fetched relational tags
            if (isset($subProfile['tags_array'])) {
                $actualVal = $subProfile['tags_array'];
            } else {
                $stmtT = $pdo->prepare("SELECT t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.subscriber_id = ?");
                $stmtT->execute([$subscriberId]);
                $actualVal = $stmtT->fetchAll(PDO::FETCH_COLUMN);
            }
            $isArrayField = true;

        } elseif (isset($profileFieldMap[$field])) {
            $actualVal = $subProfile[$profileFieldMap[$field]] ?? '';

        } elseif ($field === 'custom_field') {
            // Handle explicit custom field selection from UI
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
            // Days since last activity — compare as number
            $isSpecialField = true;
            $lastAt = $subProfile['last_activity_at'] ?? $subProfile['joined_at'] ?? null;
            if ($lastAt) {
                $diffDays = (int) floor((time() - strtotime($lastAt)) / 86400);
            } else {
                $diffDays = 9999; // never active
            }
            $condMatch = false;
            // [BUG-FIX #9] Correct strict vs. non-strict comparison:
            // 'greater_than' must be strict (>), 'greater_than_or_equal' must be (>=).
            // Previously both mapped to >=, making them equivalent (wrong).
            if ($op === 'greater_than') {
                $condMatch = ($diffDays > (int) $val);
            } elseif ($op === 'greater_than_or_equal') {
                $condMatch = ($diffDays >= (int) $val);
            } elseif ($op === 'less_than') {
                $condMatch = ($diffDays < (int) $val);
            } elseif ($op === 'less_than_or_equal') {
                $condMatch = ($diffDays <= (int) $val);
            } elseif ($op === 'equals') {
                $condMatch = ($diffDays === (int) $val);
            }

        } elseif ($field === 'web_activity') {
            // Check web visit history (subscriber_activity WHERE type LIKE 'web_%')
            $isSpecialField = true;
            $lookbackLimit = (int) ($cond['lookback'] ?? 50);
            if ($lookbackLimit <= 0)
                $lookbackLimit = 1000;

            static $webHistoryCache = [];
            $cacheKey = $subscriberId . '_web_' . $lookbackLimit;
            if (!isset($webHistoryCache[$cacheKey])) {
                // [FIX] LRU-style cap: $webHistoryCache stores full HTML-length text arrays
                // for each subscriber. At 5,000 subscribers this can exhaust all available RAM.
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
                // Use mb_stripos for proper Unicode/Vietnamese case-insensitive matching
                $kwMatch = empty($keywords) ? true : false;
                foreach ($keywords as $kw) {
                    if ($kw !== '' && mb_stripos($line, $kw, 0, 'UTF-8') !== false) {
                        $kwMatch = true;
                        break;
                    }
                }
                // page_url empty → always match (no URL filter)
                $pageMatch = empty($pageUrl) || mb_stripos($line, $pageUrl, 0, 'UTF-8') !== false;
                if ($kwMatch && $pageMatch) {
                    $found = true;
                    break;
                }
            }
            $condMatch = ($op === 'not_contains') ? !$found : $found;

        } elseif ($field === 'activity_history') {
            // Flexible activity history check:
            // cond['activity_type'] = 'click_link' | 'open_email' | 'custom_event' | 'purchase' | 'zns_sent' | 'unsubscribe' | ... (comma-sep for OR)
            // cond['value'] = keyword to search in details
            // cond['lookback'] = number of records to check (default 50)
            // cond['days'] = only check within last N days (optional)
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
                // No keyword filter — just check if any activity exists
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
            $condMatch = ($op === 'not_contains' || $op === 'is_not_set') ? !$found : $found;

        } else {
            // Fallback: try custom_attributes JSON field
            $isSpecialField = true;
            if (!empty($subProfile['custom_attributes'])) {
                $customAttrs = is_array($subProfile['custom_attributes'])
                    ? $subProfile['custom_attributes']
                    : json_decode($subProfile['custom_attributes'], true);
                $actualVal = $customAttrs[$field] ?? '';
            } else {
                $actualVal = '';
            }
            // Fall through to scalar evaluation below
            $isSpecialField = false; // let scalar logic handle it
        }

        // Skip scalar evaluation if special field already set $condMatch
        if ($isSpecialField) {
            if (!$condMatch)
                return false;
            continue;
        }

        // -----------------------------------------------------------------
        // 2. Evaluate Condition
        // -----------------------------------------------------------------

        // --- A. ARRAY LOGIC (tags) ---
        if ($isArrayField && is_array($actualVal)) {
            switch ($op) {
                case 'contains':
                    foreach ($actualVal as $item) {
                        if (mb_stripos($item, $val) !== false) {
                            $condMatch = true;
                            break;
                        }
                    }
                    break;
                case 'not_contains':
                    $condMatch = true;
                    foreach ($actualVal as $item) {
                        if (mb_stripos($item, $val) !== false) {
                            $condMatch = false;
                            break;
                        }
                    }
                    break;
                case 'is_set':
                    $condMatch = !empty($actualVal);
                    break;
                case 'is_not_set':
                    $condMatch = empty($actualVal);
                    break;
                default:
                    $condMatch = false;
            }
        } else {
            // --- B. SCALAR LOGIC ---
            $isDateOp = in_array($op, ['is_before', 'is_after', 'is_on']);
            // [FIX] Custom attribute values decoded from JSON can be arrays.
            // Casting an array directly to string produces the literal "Array",
            // making all comparisons wrong and triggering PHP "Array to string" warnings.
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
                    $condMatch = ($checkVal === $targetVal);
                    break;
                case 'is_not':
                    $condMatch = ($checkVal !== $targetVal);
                    break;
                case 'contains':
                    $condMatch = (mb_strpos($checkVal, $targetVal, 0, 'UTF-8') !== false);
                    break;
                case 'not_contains':
                    $condMatch = (mb_strpos($checkVal, $targetVal, 0, 'UTF-8') === false);
                    break;
                case 'starts_with':
                    // [PHP 7 COMPAT] str_starts_with() is PHP 8.0+ only — fallback for PHP 7.x
                    $condMatch = ($targetVal === '' || substr($checkVal, 0, strlen($targetVal)) === $targetVal);
                    break;
                case 'ends_with':
                    // [PHP 7 COMPAT] str_ends_with() is PHP 8.0+ only — fallback for PHP 7.x
                    $condMatch = ($targetVal === '' || substr($checkVal, -strlen($targetVal)) === $targetVal);
                    break;
                case 'is_set':
                    $condMatch = ($actualVal !== '' && $actualVal !== null);
                    break;
                case 'is_not_set':
                    $condMatch = ($actualVal === '' || $actualVal === null);
                    break;
                case 'greater_than':
                    $condMatch = (is_numeric($actualVal) && is_numeric($val) && (float) $actualVal > (float) $val);
                    break;
                case 'less_than':
                    $condMatch = (is_numeric($actualVal) && is_numeric($val) && (float) $actualVal < (float) $val);
                    break;
                case 'in_list':
                    $listItems = array_filter(array_map('trim', preg_split("/[\r\n,]+/", $targetVal)));
                    $condMatch = in_array($checkVal, $listItems);
                    break;
                case 'is_on':
                case 'is_before':
                case 'is_after':
                    if (!$actualVal) {
                        $condMatch = false;
                    } else {
                        $dbTs = strtotime(date('Y-m-d', strtotime($actualVal)));
                        $userTs = strtotime(date('Y-m-d', strtotime($val)));
                        if ($dbTs === false || $userTs === false) {
                            $condMatch = false;
                            break;
                        }
                        if ($op === 'is_on')
                            $condMatch = ($dbTs === $userTs);
                        if ($op === 'is_before')
                            $condMatch = ($dbTs < $userTs);
                        if ($op === 'is_after')
                            $condMatch = ($dbTs > $userTs);
                    }
                    break;
            }
        }

        if (!$condMatch) {
            return false;
        }
    }

    return true;
}
