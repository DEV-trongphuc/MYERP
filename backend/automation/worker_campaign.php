<?php
// api/worker_campaign.php - OMNI-ENGINE V30.0 (IMMEDIATE SEND & FLOW ENROLLMENT OPTIMIZED)
// This worker is designed to be run by a cron job OR triggered directly for immediate send.

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
set_time_limit(600); // Allow up to 10 minutes for sending a batch
ignore_user_abort(true); // Fix: Continue running even if client (curl) disconnects

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once __DIR__ . '/Mailer.php'; // Mailer is required here for sending emails
require_once __DIR__ . '/segment_helper.php';
require_once __DIR__ . '/zalo_sender.php';
require_once __DIR__ . '/flow_helpers.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');
$pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
// [FIX P0-5] Fail-fast lock timeout: prevents campaign worker from blocking for MySQL's
// default 50s when a flow worker or concurrent campaign holds a subscriber row lock.
// At 5s timeout, the job is re-queued and retried on the next cron run instead.
$pdo->exec("SET SESSION innodb_lock_wait_timeout = 5");
$pdo->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
header('Content-Type: application/json; charset=utf-8');

// NOTE: $apiUrl, $settings, $mailer are initialized inside runWorkerCampaign()
//       so they are in the correct scope when called from worker_queue.php.
// $now and $logs are also initialized inside runWorkerCampaign()

// Incremental logging helper
if (!function_exists('writeWorkerLog')) {
    function writeWorkerLog($msg)
    {
        $formatted = "[" . date('Y-m-d H:i:s') . "] $msg\n";
        file_put_contents(__DIR__ . '/worker_campaign.log', $formatted, FILE_APPEND);
    }
}

if (!function_exists('runWorkerCampaign')) {
    function runWorkerCampaign($pdo, $campaignId = null)
    {

        $now = date('Y-m-d H:i:s');
        $logs = [];
        $logs[] = "--- CAMPAIGN WORKER START: $now ---";
        writeWorkerLog("--- WORKER STARTED ---");

        // [PERF-GUARD] Stop if server is saturated
        if (!isSystemHealthy()) {
            writeWorkerLog("Server load too high, pausing campaign worker");
            return ['status' => 'throttled'];
        }

        // Initialize shared resources inside function scope
        $apiUrl = API_BASE_URL;
        // [FIX P38-WC] Only load the 2 settings keys this worker actually needs.
        // Old SELECT * loaded 50+ key/value pairs (SMTP passwords, API keys, etc.)
        // into memory on every single worker boot  a significant security and memory footprint.
        $stmt = $pdo->query("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN ('smtp_user','max_messages_per_day')");
        $settings = [];
        foreach ($stmt->fetchAll() as $row) {
            $settings[$row['key']] = $row['value'];
        }
        $defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
        $mailer = new Mailer($pdo, $apiUrl, $defaultSender, 0);

        // [FIX P9-C1] MySQL version guard for FOR UPDATE SKIP LOCKED.
        // SKIP LOCKED requires MySQL = 8.0  identical to fix in worker_queue.php (P7-C3).
        // On MySQL 5.7: hardcoded SKIP LOCKED ? SQLState[42000] Syntax Error ? campaign batch crash.
        $skipLockedClause = isDatabaseSkipLockedSupported($pdo) ? 'SKIP LOCKED' : '';

        // Check for valid request (from Cron or Direct Trigger)
        $cliCampaignId = isset($argv[1]) ? $argv[1] : null;
        $manualCampaignId = $campaignId ?? $_GET['campaign_id'] ?? $cliCampaignId;
        // [INFINITE LOOP GUARD] Track how many consecutive "continuous mode" retries have been made.
        // Passed via ?retry_count=N in the async trigger URL. If count exceeds MAX, auto-pause.
        // [SECURITY FIX] Cap retry_count to MAX_RETRIES+1 to prevent circuit-breaker bypass
        // via crafted URL (e.g. ?retry_count=999999 would skip the guard entirely).
        // [FIX CB-1] Increased MAX_RETRIES 8 → 15.
        // Old value caused false-positive Circuit Breaker pauses on campaigns with 2k+ recipients:
        // each async batch re-trigger increments retry_count even when sending is healthy.
        // At 200 recipients/batch and 14/s, a 2k campaign needs ~10 retries minimum — the old
        // limit of 8 would auto-pause campaigns that still had recipients left to send.
        $MAX_RETRIES = 15;
        $retryCount = min((int) ($_GET['retry_count'] ?? 0), $MAX_RETRIES + 1);
        if ($manualCampaignId) {
            $logs[] = "-> Direct trigger received for Campaign ID: $manualCampaignId (retry #$retryCount)";
            writeWorkerLog("Direct trigger for Campaign ID: $manualCampaignId (retry #$retryCount)");
        }

        // =================================================================================
// HELPERS (Imported from shared module)
// =================================================================================
// Functions used from flow_helpers.php:
// - parseLoopingContent
// - resolveEmailContent
// - replaceMergeTags
// - logActivity

        // =================================================================================
// CAMPAIGN DISPATCHER
// =================================================================================
        $campaign = null;

        if ($manualCampaignId) {
            // Priority: Fetch specifically requested campaign - Allow more statuses for direct trigger
            $stmtCamp = $pdo->prepare("SELECT * FROM campaigns WHERE id = ? AND status IN ('scheduled', 'sending', 'paused', 'draft') LIMIT 1");
            $stmtCamp->execute([$manualCampaignId]);
            $campaign = $stmtCamp->fetch();
            if (!$campaign)
                $logs[] = "[Target Campaign] Campaign ID $manualCampaignId not found or not in valid state.";
        }

        if (!$campaign) {
            // Fallback: Pick next scheduled campaign that is NOT currently locked by an active worker
            $stmtCamp = $pdo->prepare("SELECT * FROM campaigns WHERE status IN ('scheduled', 'sending') AND (scheduled_at <= ? OR scheduled_at IS NULL) ORDER BY scheduled_at ASC LIMIT 10");
            $stmtCamp->execute([$now]);
            $candidates = $stmtCamp->fetchAll();
            foreach ($candidates as $cand) {
                $testLockKey = "campaign_worker_" . $cand['id'];
                $stmtCheck = $pdo->prepare("SELECT IS_USED_LOCK(?)");
                $stmtCheck->execute([$testLockKey]);
                if (!$stmtCheck->fetchColumn()) {
                    $campaign = $cand;
                    break;
                }
            }
        }

        if ($campaign) {
            $cid = $campaign['id'];
            $cName = $campaign['name'];
            // [FIX BUG-WC-1] Extract workspace_id to scope all subscriber queries
            $workspace_id = (int)($campaign['workspace_id'] ?? 0);

            // [CONCURRENCY GUARD] Acquire exclusive MySQL Advisory Lock per Campaign
            // Prevents cron runs, concurrent triggers, or double clicks from sending duplicate emails
            $lockKey = "campaign_worker_" . $cid;
            $lockTimeout = $manualCampaignId ? 3 : 0;
            $stmtLock = $pdo->prepare("SELECT GET_LOCK(?, ?)");
            $stmtLock->execute([$lockKey, $lockTimeout]);
            $lockAcquired = ((int)$stmtLock->fetchColumn() === 1);

            if (!$lockAcquired) {
                $msg = "[LOCK GUARD] Campaign $cid is currently being processed by another active worker. Skipping to prevent duplicate emails.";
                $logs[] = $msg;
                writeWorkerLog($msg);
                return ['status' => 'locked', 'campaign_id' => $cid];
            }

            // Register shutdown handler to guarantee lock release on script exit or crash
            register_shutdown_function(function() use ($pdo, $lockKey) {
                try {
                    $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockKey]);
                } catch (Throwable $e) {}
            });

            // [STALE LOCK CLEANUP] Clean up ONLY stale temporary processing locks (>15 minutes old) from crashed processes
            // CRITICAL: NEVER delete active locks, as that allows concurrent workers to re-pick in-flight subscribers!
            $pdo->prepare("DELETE FROM subscriber_activity WHERE campaign_id = ? AND type = 'processing_campaign' AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)")->execute([$cid]);

            // Start a transaction for the campaign processing
            $pdo->beginTransaction();
            try {
                // [FIX PROG-1] On resume from 'paused' status, always re-sync count_sent from real
                // delivery logs so the progress bar reflects actual sends (not a stale counter).
                // This fixes the mismatch where history tab shows 1,904 but progress shows 1,071.
                $wasResumedFromPause = ($campaign['status'] === 'paused');

                // Initialize if NOT already sending, or if sent_at is missing (manual trigger case)
                if ($campaign['status'] !== 'sending' || empty($campaign['sent_at'])) {
                    // Calculate Audience Size (Snapshot)
                    // [FIX BUG-WC-1] Scope subscribers to campaign workspace
                    $countSql = "SELECT COUNT(DISTINCT s.id) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ?";
                    $countParams = [$workspace_id];

                    // ZNS Requirement: Must have phone number
                    if (($campaign['type'] ?? 'email') === 'zalo_zns') {
                        $countSql .= " AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                    }

                    $countWheres = [];
                    $targetConf = json_decode($campaign['target_config'], true);

                    // A. LISTS
                    if (!empty($targetConf['listIds'])) {
                        // [BUG-M1 FIX] Use parameterized query to prevent SQL injection
                        $listPlaceholders = implode(',', array_fill(0, count($targetConf['listIds']), '?'));
                        $countWheres[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE workspace_id = ? AND list_id IN ($listPlaceholders))";
                        $countParams = array_merge([$workspace_id], $countParams); // Prepended for subquery
                        $countParams = array_merge($countParams, $targetConf['listIds']);
                    }
                    // B. TAGS (10M UPGRADE: Relational Join)
                    if (!empty($targetConf['tagIds'])) {
                        $tagConditions = [];
                        foreach ($targetConf['tagIds'] as $tag) {
                            $tagConditions[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
                            $countParams[] = $workspace_id;
                            $countParams[] = $workspace_id;
                            $countParams[] = $tag;
                        }
                        if (!empty($tagConditions)) {
                            $countWheres[] = "(" . implode(' OR ', $tagConditions) . ")";
                        }
                    }
                    // C. SEGMENTS
                    if (!empty($targetConf['segmentIds'])) {
                        // [BUG-M1 FIX] Use parameterized query to prevent SQL injection
                        $segPlaceholders = implode(',', array_fill(0, count($targetConf['segmentIds']), '?'));
                        $stmtSegs = $pdo->prepare("SELECT criteria FROM segments WHERE id IN ($segPlaceholders) AND workspace_id = ?");
                        $stmtSegs->execute(array_merge($targetConf['segmentIds'], [$workspace_id]));
                        if ($stmtSegs) {
                            foreach ($stmtSegs->fetchAll() as $seg) {
                                $res = buildSegmentWhereClause($seg['criteria'], $workspace_id);
                                if ($res['sql'] !== '1=1') {
                                    $countWheres[] = $res['sql'];
                                    foreach ($res['params'] as $p)
                                        $countParams[] = $p;
                                }
                            }
                        }
                    }
                    // D. INDIVIDUAL IDs (hand-picked subscribers)
                    if (!empty($targetConf['individualIds'])) {
                        $indPlaceholders = implode(',', array_fill(0, count($targetConf['individualIds']), '?'));
                        $countWheres[] = "s.id IN ($indPlaceholders)";
                        $countParams = array_merge($countParams, $targetConf['individualIds']);
                    }

                    $totalAudience = (int) ($campaign['total_target_audience'] ?? 0);
                    // [FIX PROG-1] Force re-count when: no audience set, manual trigger, OR resuming from pause
                    if (!empty($countWheres) && ($totalAudience === 0 || $manualCampaignId || $wasResumedFromPause)) {
                        $countSql .= " AND (" . implode(' OR ', $countWheres) . ")";
                        $stmtCount = $pdo->prepare($countSql);
                        $stmtCount->execute($countParams);
                        $totalAudience = (int) $stmtCount->fetchColumn();
                    }

                    // [FIX PROG-1] On resume from paused: atomically re-sync count_sent from delivery
                    // logs AND update status + audience in ONE UPDATE to avoid double row-lock on the
                    // campaigns table within the same transaction.
                    if ($wasResumedFromPause) {
                        $pdo->prepare("UPDATE campaigns SET status = 'sending', sent_at = IFNULL(sent_at, NOW()), total_target_audience = ?, count_sent = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_activity WHERE campaign_id = ? AND type IN ('receive_email', 'zalo_sent', 'meta_sent', 'zns_sent')) WHERE id = ? AND workspace_id = ?")->execute([$totalAudience, $cid, $cid, $workspace_id]);
                        writeWorkerLog("Campaign $cid: Resumed from paused — status=sending, count_sent synced from activity logs, audience=$totalAudience.");
                    } else {
                        // Change status to 'sending' and ensure sent_at is marked
                        $pdo->prepare("UPDATE campaigns SET status = 'sending', sent_at = IFNULL(sent_at, NOW()), total_target_audience = ? WHERE id = ?")->execute([$totalAudience, $cid]);
                    }
                    $logs[] = "[Campaign {$cid}] Initialized. Status: sending. Total Audience: $totalAudience";
                    writeWorkerLog("Campaign $cid Initialized. Audience: $totalAudience");

                    // Re-fetch to get updated sent_at for resolveEmailContent if needed
                    $stmtCamp = $pdo->prepare("SELECT * FROM campaigns WHERE id = ?");
                    $stmtCamp->execute([$cid]);
                    $campaign = $stmtCamp->fetch();
                }

                // 1. Resolve Resources Once
                $skipQA = true; // Optimization for amazon 14/s capacity
                $linkedFlow = null;
                $flowTriggerNextStepId = null;
                // [PERF #12] Only load flows that contain a campaign-type trigger step.
                // Previously: SELECT * loaded ALL active flows (100s of rows, each with large JSON steps column).
                // Now: A JSON search filter (steps LIKE '%\"campaign\"%') pre-filters at DB level,
                // then PHP validates the exact trigger match. Saves significant RAM + query time.
                $stmtAllActive = $pdo->prepare("SELECT id, name, steps FROM flows WHERE workspace_id = ? AND status = 'active' AND steps LIKE '%\"campaign\"%'");
                $stmtAllActive->execute([$workspace_id]);
                $activeFlows = $stmtAllActive->fetchAll();

                foreach ($activeFlows as $f) {
                    $stepsArr = json_decode($f['steps'], true) ?: [];
                    foreach ($stepsArr as $s) {
                        if ($s['type'] === 'trigger' && ($s['config']['type'] ?? '') === 'campaign' && ($s['config']['targetId'] ?? '') === $cid) {
                            $linkedFlow = $f;
                            break 2;
                        }
                    }
                }

                // Check for ANY previous enrollment to prevent loop-spam
                $checkFlowEnrollment = false;
                if ($linkedFlow) {
                    $stepsArr = json_decode($linkedFlow['steps'], true) ?: [];
                    foreach ($stepsArr as $s) {
                        if ($s['type'] === 'trigger' && ($s['config']['type'] ?? '') === 'campaign' && ($s['config']['targetId'] ?? '') === $cid) {
                            if (isset($s['nextStepId'])) {
                                $checkFlowEnrollment = true;
                                $flowTriggerNextStepId = $s['nextStepId'];
                            }
                            break;
                        }
                    }
                }

                $campaignConfig = json_decode($campaign['config'] ?? '{}', true);
                $isABTest = ($campaign['type'] ?? '') === 'ab_testing';
                $abConfig = $isABTest ? ($campaignConfig['ab_test'] ?? []) : [];
                $hasVariantB = !empty($abConfig['variant_b']);

                $ccEmails = [];
                if (!empty($campaignConfig['cc_enabled']) && !empty($campaignConfig['cc_emails'])) {
                    $ccEmails = array_filter(array_map('trim', preg_split('/[,;\s\n\r]+/', $campaignConfig['cc_emails'])), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
                    $ccEmails = array_slice($ccEmails, 0, 3);
                }

                $bccEmails = [];
                if (!empty($campaignConfig['bcc_enabled']) && !empty($campaignConfig['bcc_emails'])) {
                    $bccEmails = array_filter(array_map('trim', preg_split('/[,;\s\n\r]+/', $campaignConfig['bcc_emails'])), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
                    $bccEmails = array_slice($bccEmails, 0, 3);
                }

                $htmlContent = resolveEmailContent($pdo, $campaign['template_id'], $campaign['custom_html'] ?? '', $campaign['content_body']);
                $htmlContentB = $hasVariantB ? resolveEmailContent($pdo, $abConfig['variant_b']['template_id'] ?? $campaign['template_id'], $abConfig['variant_b']['custom_html'] ?? '', $abConfig['variant_b']['content_body'] ?? '') : null;

                // [PERF FIX REMOVED] Previously, we hashed raw HTML to cache the Mailer.
                // However, this broke per-subscriber personalization (like first_name and Vouchers)
                // because the tracking injection would cache the FIRST subscriber's personalized HTML
                // and serve it to everyone else. The Mailer now correctly handles unique personalized 
                // HTML strings per subscriber.

                $campaignAttachments = json_decode($campaign['attachments'] ?? '[]', true);

                // [PRE-BUILD QUERY FILTERS]
                $wheres = [];
                $queryBaseParams = [];
                $target = json_decode($campaign['target_config'], true);

                if (!empty($target['listIds'])) {
                    // [BUG-M1 FIX] Use parameterized query to prevent SQL injection
                    $listPlaceholders = implode(',', array_fill(0, count($target['listIds']), '?'));
                    $wheres[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id IN ($listPlaceholders))";
                    $queryBaseParams = array_merge($queryBaseParams, $target['listIds']);
                }
                if (!empty($target['tagIds'])) {
                    $tagConditions = [];
                    foreach ($target['tagIds'] as $tag) {
                        $tagConditions[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
                        $queryBaseParams[] = $workspace_id;
                        $queryBaseParams[] = $workspace_id;
                        $queryBaseParams[] = $tag;
                    }
                    if (!empty($tagConditions))
                        $wheres[] = "(" . implode(' OR ', $tagConditions) . ")";
                }
                if (!empty($target['segmentIds'])) {
                    // [BUG-M1 FIX] Use parameterized query to prevent SQL injection
                    $segPlaceholders = implode(',', array_fill(0, count($target['segmentIds']), '?'));
                    $stmtSegs = $pdo->prepare("SELECT criteria FROM segments WHERE id IN ($segPlaceholders) AND workspace_id = ?");
                    $stmtSegs->execute(array_merge($target['segmentIds'], [$workspace_id]));
                    foreach ($stmtSegs->fetchAll() as $seg) {
                        $res = buildSegmentWhereClause($seg['criteria'], $workspace_id);
                        if ($res['sql'] !== '1=1') {
                            $wheres[] = $res['sql'];
                            foreach ($res['params'] as $p)
                                $queryBaseParams[] = $p;
                        }
                    }
                }
                // D. INDIVIDUAL IDs  [BUG FIX] Previously missing: campaigns targeting hand-picked
                // subscribers had empty $wheres ? worker sent to ALL workspace subscribers instead.
                if (!empty($target['individualIds'])) {
                    $indPlaceholders = implode(',', array_fill(0, count($target['individualIds']), '?'));
                    $wheres[] = "s.id IN ($indPlaceholders)";
                    $queryBaseParams = array_merge($queryBaseParams, $target['individualIds']);
                }

                // 2. Micro-Batch Processing Loop
                $BATCH_SIZE = 200;   // [PERF] Increased from 50 ? 200 to boost throughput per batch
                $MAX_BATCHES = 90;  // [PERF] Increased from 60 ? 90  max 18,000 emails per worker run
                                    // 450s time guard still protects against FPM exhaustion
                $batchCount = 0;
                $hasMore = true;
                $totalProcessed = 0;
                $startTimeRun = microtime(true);

                // [DYNAMIC TIME LIMIT] Read php max_execution_time to avoid brutal FPM/CGI termination.
                // Leave a 5s safety buffer for the final status check & next-worker spawn.
                $maxExecutionTime = (int) ini_get('max_execution_time');
                $timeLimit = ($maxExecutionTime > 0) ? ($maxExecutionTime - 5) : 30; // standard default is 30s
                $timeLimit = max(10, min($timeLimit, 450)); // clamp between 10s and 450s

                // [PERF B2] Pre-decode linked flow JSON once  avoids 200x json_decode per batch.
                // linkedFlow config/steps are the same for every subscriber in the batch.
                $linkedFlowConfig = $linkedFlow ? (json_decode($linkedFlow['config'], true) ?: []) : null;
                $linkedFlowSteps  = $linkedFlow ? (json_decode($linkedFlow['steps'], true) ?: []) : null;

                // [PERF B3] Pre-decode ZNS campaign config once per worker run (same for every subscriber).
                $znsConfigPreloaded = null;
                if (($campaign['type'] ?? 'email') === 'zalo_zns' && !empty($campaign['config'])) {
                    $znsConfigPreloaded = json_decode($campaign['config'], true) ?: [];
                }

                // Commit the initialization transaction
                $pdo->commit();

                // [OPTIMIZATION] Pre-build the Recipient Fetch SQL to compile ONCE before the loop
                $sqlFetch = "SELECT s.id, s.contact_id, s.email, s.first_name, s.last_name, s.phone_number, s.company_name, s.job_title, s.city, s.district, s.ward, s.country, s.address, s.gender, s.date_of_birth, s.anniversary_date, s.joined_at, s.custom_attributes, s.program, s.stage_id, s.owner_id, s.salesperson FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ?";
                $execParams = array_merge([$workspace_id], $queryBaseParams);
                if (($campaign['type'] ?? 'email') === 'zalo_zns') {
                    $sqlFetch .= " AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                }
                if (!empty($wheres)) {
                    $sqlFetch .= " AND (" . implode(' OR ', $wheres) . ")";
                }
                // [FIX STUCK-1] Added 'skipped_email' to NOT EXISTS exclusion.
                // Virtual emails are logged as 'skipped_email' (not 'failed_email'), so without this
                // they were never excluded from the fetch query and got re-fetched every batch →
                // worker runs N batches of all-skipped, sees remaining>0, retries until circuit breaker.
                $sqlFetch .= " AND NOT EXISTS (
                    SELECT 1 FROM subscriber_activity sa
                    WHERE sa.workspace_id = ?
                    AND sa.subscriber_id = s.id
                    AND sa.campaign_id = ?
                    AND (
                        sa.type IN ('receive_email', 'failed_email', 'skipped_email', 'zalo_sent', 'meta_sent', 'zns_sent', 'zns_failed', 'enter_flow')
                        OR (sa.type = 'processing_campaign' AND sa.created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE))
                    )
                )";
                $execParams[] = $workspace_id;
                $execParams[] = $cid;
                $sqlFetch .= " ORDER BY s.id ASC LIMIT " . (int)$BATCH_SIZE . " FOR UPDATE " . $skipLockedClause;
                $stmtSubs = $pdo->prepare($sqlFetch);

                // [OPTIMIZATION] Pre-compile UPDATE queries
                $stmtUpdateFlowEnrolled = $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + ? WHERE id = ?");
                $stmtUpdateCampSentJSON = $pdo->prepare("UPDATE campaigns SET count_sent = count_sent + ?, count_bounced = count_bounced + ?, stats = JSON_SET(COALESCE(NULLIF(stats, ''), '{}'), '$.sent', COALESCE(JSON_EXTRACT(stats, '$.sent'), 0) + ?, '$.failed', COALESCE(JSON_EXTRACT(stats, '$.failed'), 0) + ?) WHERE id = ?");
                $stmtUpdateCampSentFB = $pdo->prepare("UPDATE campaigns SET count_sent = count_sent + ?, count_bounced = count_bounced + ? WHERE id = ?");

                while ($hasMore && $batchCount < $MAX_BATCHES) {
                    $batchCount++;

                    if (function_exists('ensure_pdo_alive')) {
                        ensure_pdo_alive($pdo);
                    }

                    // Check if campaign was paused or cancelled by user
                    $stmtStatusLive = $pdo->prepare("SELECT status FROM campaigns WHERE id = ?");
                    $stmtStatusLive->execute([$cid]);
                    $liveCampStatus = $stmtStatusLive->fetchColumn();
                    if ($liveCampStatus !== 'sending') {
                        writeWorkerLog("Campaign $cid: Status is no longer 'sending' (currently '$liveCampStatus'). Stopping worker loop immediately.");
                        break;
                    }

                    // [TIME GUARD] Stop if we've been running for more than $timeLimit seconds
                    // limit is 600s, but we want to leave room for final updates and cleanup.
                    if (microtime(true) - $startTimeRun > $timeLimit) {
                        writeWorkerLog("Campaign $cid: Execution time limit ($timeLimit s) reached. Stopping batch loop.");
                        break;
                    }
                    $pdo->beginTransaction();
                    try {
                        $stmtSubs->execute($execParams);
                        $recipients = $stmtSubs->fetchAll();

                        if (empty($recipients)) {
                            $hasMore = false;
                            $pdo->commit();
                            break;
                        }

                        // [OPTIMIZATION] 0.1s Unlock Technique: Insert placeholder lock and commit IMMEDIATELY
                        $lockVals = [];
                        $lockBinds = [];
                        
                        // [PERF] Voucher Pre-fetching for Batch
                        $vouchersBatch = [];
                        $cHtml = $htmlContent;
                        $cSubject = $campaign['subject'];
                        if (strpos($cHtml, '[VOUCHER_') !== false || strpos($cSubject, '[VOUCHER_') !== false) {
                            preg_match_all('/\[VOUCHER_([a-zA-Z0-9_\-]+)\]/i', $cSubject . $cHtml, $vMatches);
                            $vCampIds = array_unique($vMatches[1] ?? []);
                            if (!empty($vCampIds)) {
                                foreach ($vCampIds as $vCid) {
                                    $placeholders = implode(',', array_fill(0, count($recipients), '?'));
                                    $stmtV = $pdo->prepare("SELECT subscriber_id, code FROM voucher_codes WHERE workspace_id = ? AND campaign_id = ? AND subscriber_id IN ($placeholders)");
                                    $stmtV->execute(array_merge([$workspace_id, $vCid], array_column($recipients, 'id')));
                                    while ($vRow = $stmtV->fetch()) {
                                        $vouchersBatch[$vRow['subscriber_id']][$vCid] = $vRow['code'];
                                    }
                                }
                            }
                        }

                        foreach ($recipients as $sub) {
                            $lockBinds[] = "(?, ?, 'processing_campaign', ?, ?, 'Processing...', ?, NOW())";
                            $lockVals = array_merge($lockVals, [$sub['id'], $workspace_id, $cid, $cName, $cid]);
                        }
                        if (!empty($lockBinds)) {
                            $sqlLockIns = "INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, reference_name, details, campaign_id, created_at) VALUES " . implode(',', $lockBinds);
                            $pdo->prepare($sqlLockIns)->execute($lockVals);
                        }
                        
                        $pdo->commit(); // === UNLOCK DB IMMEDIATELY! LET WEBSITE BREATHE ===

                        // Prepare Batch Data
                        $successIds = [];
                        $failActivities = [];
                        $successActivities = [];
                        $flowEnrollments = [];
                        $jobDispatches = [];

                        // [OPTIMIZATION] Pre-fetch Frequency Caps for entire batch (Per Channel)
                        $capCache = [];
                        $maxPerDay = (int) ($settings['max_messages_per_day'] ?? 0);
                        if ($maxPerDay > 0) {
                            $subIdList = array_column($recipients, 'id');
                            $placeholdersSub = implode(',', array_fill(0, count($subIdList), '?'));
                            $stmtBatchCap = $pdo->prepare("
                                SELECT subscriber_id, type, COUNT(*) as count 
                                FROM subscriber_activity 
                                WHERE workspace_id = ? AND subscriber_id IN ($placeholdersSub) 
                                AND type IN ('receive_email', 'zalo_sent', 'meta_sent', 'zns_sent') 
                                AND created_at >= CURDATE()
                                GROUP BY subscriber_id, type
                            ");
                            $stmtBatchCap->execute(array_merge([$workspace_id], $subIdList));
                            foreach ($stmtBatchCap->fetchAll(PDO::FETCH_ASSOC) as $row) {
                                // [FIX] Use string key to match $sub['id'] which is a string UUID.
                                // PHP array keys cast integers automatically only for numeric strings.
                                // UUID strings are non-numeric — both sides must use the raw string.
                                $sId = $row['subscriber_id'];
                                if (!isset($capCache[$sId])) {
                                    $capCache[$sId] = ['email' => 0, 'zalo' => 0, 'meta' => 0];
                                }
                                if ($row['type'] === 'receive_email') {
                                    $capCache[$sId]['email'] += $row['count'];
                                } elseif (in_array($row['type'], ['zalo_sent', 'zns_sent'])) {
                                    $capCache[$sId]['zalo'] += $row['count'];
                                } elseif ($row['type'] === 'meta_sent') {
                                    $capCache[$sId]['meta'] += $row['count'];
                                }
                            }
                        }

                        // [OPTIMIZATION] Pre-fetch Flow Enrollment Status for entire batch if linked flow exists
                        $enrollmentCache = [];
                        if ($linkedFlow) {
                            $fid = $linkedFlow['id'];
                            $subIdList = array_column($recipients, 'id');
                            $placeholdersSub = implode(',', array_fill(0, count($subIdList), '?'));
                            $stmtBatchEnroll = $pdo->prepare("
                        SELECT subscriber_id, status, updated_at, created_at 
                        FROM subscriber_flow_states 
                        WHERE workspace_id = ? AND subscriber_id IN ($placeholdersSub) AND flow_id = ?
                        ORDER BY created_at DESC
                    ");
                            $stmtBatchEnroll->execute(array_merge([$workspace_id], $subIdList, [$fid]));
                            foreach ($stmtBatchEnroll->fetchAll() as $row) {
                                if (!isset($enrollmentCache[$row['subscriber_id']])) {
                                    $enrollmentCache[$row['subscriber_id']] = $row; // Keep latest
                                }
                            }
                        }

                        // [REAL-TIME PROGRESS] Time-based tracking (every 3 seconds)
                        $lastProgressUpdate = microtime(true);

                        // [OPTIMIZATION] Pre-fetch ZNS Token for entire batch
                        $preloadedZnsToken = null;
                        if (($campaign['type'] ?? 'email') === 'zalo_zns') {
                            $znsConfig = $znsConfigPreloaded ?? [];
                            $oaConfigId = $znsConfig['oa_config_id'] ?? '';
                            if ($oaConfigId) {
                                // 1 DB call for token instead of N calls inside loop
                                $tokenResult = getAccessToken($pdo, $oaConfigId);
                                if ($tokenResult['success']) {
                                    $preloadedZnsToken = $tokenResult['access_token'];
                                }
                            }
                        }

                        $recipientIndexInBatch = 0;
                        $bouncedIds = [];

                        // [RATE LIMITER] Uses sesAcquireRateSlot() — shared file-lock across ALL
                        // PHP workers (campaign + flow). Guarantees combined total = 10/s regardless
                        // of how many workers are active. Defined in flow_helpers.php.

                        foreach ($recipients as $sub) {
                            $subId = $sub['id'];
                            $attachments = Mailer::filterAttachments($campaignAttachments, $sub['email']);

                            $currentSubject = $campaign['subject'];
                            $currentHtml = $htmlContent;
                            $variationLabel = "A";

                            if ($isABTest && $hasVariantB) {
                                // [BUG FIX] hexdec() on 8-char hex = up to 0xFFFFFFFF = 4294967295.
                                // On 32-bit PHP, values > 2^31-1 wrap to negative int.
                                // Negative % 100 is negative in PHP ? subscriber always lands in variant A.
                                // Fix: abs() guarantees a non-negative value before modulo.
                                $hash = abs(hexdec(substr(md5($subId . $cid), 0, 8))) % 100;
                                $ratioA = (int) ($abConfig['ratio_a'] ?? 50);
                                if ($hash >= $ratioA) {
                                    $currentSubject = $abConfig['variant_b']['subject'] ?? $currentSubject;
                                    $currentHtml = $htmlContentB ?? $currentHtml;
                                    $variationLabel = "B";
                                }
                            }

                            $campConfig = json_decode($campaign['config'] ?? '{}', true) ?: [];
                            $context = [
                                'unsubscribe_url' => $apiUrl . "/webhook.php?type=unsubscribe&sid=$subId&cid=$cid",
                                'campaign_name' => $cName,
                                'vouchers_batch' => $vouchersBatch,
                                'variable_fallbacks' => $campConfig['variable_fallbacks'] ?? [],
                                'config' => $campConfig
                            ];
                            $personalHtml = replaceMergeTags($currentHtml, $sub, $context, $pdo);
                            $personalSubject = replaceMergeTags($currentSubject, $sub, $context, $pdo);

                            // Periodically check if campaign was explicitly paused/stopped mid-batch
                            if ($recipientIndexInBatch % 20 === 0) {
                                if (function_exists('ensure_pdo_alive')) {
                                    ensure_pdo_alive($pdo);
                                }
                                try {
                                    $stmtLiveSt = $pdo->prepare("SELECT status FROM campaigns WHERE id = ?");
                                    $stmtLiveSt->execute([$cid]);
                                    $curLiveStatus = $stmtLiveSt->fetchColumn();
                                    if ($curLiveStatus && in_array(strtolower($curLiveStatus), ['paused', 'cancelled', 'draft'])) {
                                        writeWorkerLog("Campaign $cid: Explicitly paused/stopped mid-batch (status: '$curLiveStatus'). Aborting recipient loop.");
                                        $hasMore = false;
                                        break;
                                    }
                                } catch (Throwable $ignoreLiveCheck) {
                                    // Transient query error: continue processing
                                }
                            }

                            // [TURBO] Send QA only for the first subscriber of the campaign run to avoid exponential slowdown
                            $skipQA = ($totalProcessed > 0 || $recipientIndexInBatch > 1);

                            // [OPTIMIZED] Frequency Cap Check (Per Channel)
                            if ($maxPerDay > 0) {
                                $campChannel = (($campaign['type'] ?? 'email') === 'zalo_zns') ? 'zalo' : 'email';
                                $subCapData = $capCache[$subId] ?? ['email' => 0, 'zalo' => 0, 'meta' => 0];
                                $totalToday = $subCapData[$campChannel] ?? 0;
                                if ($totalToday >= $maxPerDay) {
                                    $logs[] = "  -> Skipping {$sub['email']}: Frequency cap reached ($totalToday/$maxPerDay) for channel $campChannel";
                                    // [FIX STUCK-2] Log a 'skipped_email' activity so this subscriber is EXCLUDED
                                    // from future batches. Without this, frequency-capped subscribers are hit with
                                    // bare `continue` and NO activity is logged → they keep getting re-fetched
                                    // every batch retry until the circuit breaker fires.
                                    $failActivities[] = [$subId, 'skipped_email', $cid, $cName, "Skipped: Frequency cap ($totalToday/$maxPerDay per day)", $cid, null, $isABTest ? $variationLabel : null];
                                    continue;
                                }
                                // Increment local cache for this batch
                                if (!isset($capCache[$subId])) $capCache[$subId] = ['email' => 0, 'zalo' => 0, 'meta' => 0];
                                $capCache[$subId][$campChannel]++;
                            }

                            // [DEFENSE-IN-DEPTH DEDUP GUARD] Guarantee subscriber has not already received this campaign
                            $stmtCheckSent = $pdo->prepare("SELECT 1 FROM subscriber_activity WHERE workspace_id = ? AND subscriber_id = ? AND campaign_id = ? AND type IN ('receive_email', 'zns_sent') LIMIT 1");
                            $stmtCheckSent->execute([$workspace_id, $subId, $cid]);
                            if ($stmtCheckSent->fetchColumn()) {
                                $logs[] = "  -> Dedup guard: Subscriber {$sub['email']} already received Campaign $cid. Skipping duplicate.";
                                continue;
                            }

                            if (($campaign['type'] ?? 'email') === 'zalo_zns') {
                                // [PERF B3] Use pre-decoded ZNS config instead of re-decoding per subscriber
                                $znsConfig    = $znsConfigPreloaded ?? [];
                                $oaConfigId   = $znsConfig['oa_config_id'] ?? '';
                                $mappedParams = $znsConfig['mapped_params'] ?? [];

                                $templateData = [];
                                $missingParams = [];
                                // [FIX] Per-field length limits — same as FlowExecutor zalo_zns
                                // Zalo ZNS short fields (id, ma_giao_dich...) max 20 chars; others max 100
                                $znsShortFieldMap = [
                                    'id'           => 20,
                                    'ma_giao_dich' => 20,
                                    'ma_don_hang'  => 20,
                                    'tracking_id'  => 20,
                                    'order_id'     => 20,
                                    'invoice_id'   => 20,
                                ];
                                foreach ($mappedParams as $tKey => $subField) {
                                    $val = replaceMergeTags($subField, $sub, $context, $pdo);
                                    if ($val === '') {
                                        $missingParams[] = $tKey;
                                    }
                                    // Truncate per field limit to prevent Zalo API -1121
                                    if (is_string($val)) {
                                        $maxLen = $znsShortFieldMap[$tKey] ?? 100;
                                        if (mb_strlen($val, 'UTF-8') > $maxLen) {
                                            $val = mb_substr($val, 0, $maxLen, 'UTF-8');
                                        }
                                    }
                                    $templateData[$tKey] = $val;
                                }

                                if (!empty($missingParams)) {
                                    $res = "ZNS Failed: Missing data for parameters (" . implode(', ', $missingParams) . ")";
                                    writeWorkerLog("Campaign $cid: [ZNS] Subscriber {$sub['id']} missing data for " . implode(', ', $missingParams));
                                } else {
                                    // Send ZNS using preloaded token to save DB queries
                                    $znsRes = sendZNSMessage($pdo, $oaConfigId, $campaign['template_id'], $sub['phone_number'], $templateData, null, null, $sub['id'], null, $preloadedZnsToken, $workspace_id);

                                    // ZNS result standardization
                                    if ($znsRes['success']) {
                                        $res = true;
                                    } else {
                                        $res = $znsRes['message'] ?? 'ZNS Failed';
                                    }
                                }
                            } else {
                                // EMAIL SENDING LOGIC
                                // [SAFETY GUARD] Skip virtual emails
                                if (isVirtualEmail($sub['email'])) {
                                    $res = "Skipped: Virtual email";
                                } else {
                                    // [MULTI-EMAIL] Dynamically override the sender for this campaign specifically
                                    if (!empty($campaign['sender_email'])) {
                                        $mailer->setDynamicSender($campaign['sender_email']);
                                    }

                                    // [SES SHARED RATE LIMITER] Acquire slot from cross-process file-lock.
                                    // [FIX SPEED-1] Interval 100ms → 70ms = 14/s shared total.
                                    // At 10/s, 2k emails take ~200s (3.3 min) minimum.
                                    // At 14/s, same 2k emails take ~143s (2.4 min), ~30% faster.
                                    // 14/s remains well within Amazon SES 14/s sending quota.
                                    sesAcquireRateSlot(70000); // 70ms interval = ~14/s shared total

                                    $res = $mailer->send($sub['email'], $personalSubject, $personalHtml, $sub['id'], $cid, null, null, $attachments, null, null, $cName, false, $skipQA, $variationLabel, null, $workspace_id, $ccEmails, $bccEmails);
                                }
                            }

                            if ($res === true) {
                                $successIds[] = $subId;
                                $activityType = (($campaign['type'] ?? 'email') === 'zalo_zns') ? 'zns_sent' : 'receive_email';
                                $currentVar = $isABTest ? $variationLabel : null;
                                $successActivities[] = [$subId, $activityType, $cid, $cName, "Campaign Sent" . ($isABTest ? " ($variationLabel)" : ""), $cid, null, $currentVar];

                                // Flow Logic (Optimized using cache)
                                if ($linkedFlow && $flowTriggerNextStepId) {
                                    $fid = $linkedFlow['id'];
                                    // [PERF B2] Use pre-decoded config hoisted before subscriber loop
                                    $fConfig = $linkedFlowConfig ?? [];
                                    $frequency = $fConfig['frequency'] ?? 'one-time';
                                    $allowMultiple = !empty($fConfig['allowMultiple']);
                                    $cooldownHours = (int) ($fConfig['enrollmentCooldownHours'] ?? 24);

                                    $shouldEnroll = false;
                                    $existing = $enrollmentCache[$subId] ?? null;

                                    if ($allowMultiple) {
                                        // Allow if not already waiting/processing in this flow
                                        if (!$existing || !in_array($existing['status'], ['waiting', 'processing']))
                                            $shouldEnroll = true;
                                    } else {
                                        if (!$existing) {
                                            $shouldEnroll = true;
                                        } elseif ($frequency === 'recurring') {
                                            if (!in_array($existing['status'], ['waiting', 'processing'])) {
                                                $lastUpd = strtotime($existing['updated_at']);
                                                if ((time() - $lastUpd) >= ($cooldownHours * 3600))
                                                    $shouldEnroll = true;
                                            }
                                        }
                                    }

                                    if ($shouldEnroll) {
                                        $initialSchedule = $now;
                                        // [SMART SCHEDULE] Check if first step is WAIT
                                        // [PERF B2] Use pre-decoded steps hoisted before subscriber loop
                                        $fSteps = $linkedFlowSteps ?? [];
                                        foreach ($fSteps as $fs) {
                                            if ($fs['id'] === $flowTriggerNextStepId && $fs['type'] === 'wait') {
                                                $fsWaitConfig = $fs['config'] ?? [];
                                                $fsWaitMode = $fsWaitConfig['mode'] ?? 'duration';
                                                if ($fsWaitMode === 'duration') {
                                                    $dur = (int) ($fsWaitConfig['duration'] ?? 0);
                                                    $unit = $fsWaitConfig['unit'] ?? 'minutes';
                                                    // [BUG-C2 FIX] Support weeks in addition to days/hours/minutes
                                                    $unitSeconds = match ($unit) {
                                                        'weeks' => 604800,
                                                        'days' => 86400,
                                                        'hours' => 3600,
                                                        default => 60,
                                                    };
                                                    $delay = $unitSeconds * $dur;
                                                    if ($delay > 0)
                                                        $initialSchedule = date('Y-m-d H:i:s', time() + $delay);
                                                // else: dura=0 ? keep $initialSchedule = $now ? immediate
                                                } elseif ($fsWaitMode === 'until_date') {
                                                    // [BUG-2 FIX] SMART SCHEDULE for until_date:
                                                    // Without this: scheduled_at=NOW ? priority worker sees NOW<=NOW ? is_resumed_wait=TRUE ? wait SKIPPED!
                                                    $specDate   = $fsWaitConfig['specificDate'] ?? '';
                                                    $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                                    if ($specDate) {
                                                        $targetTs = strtotime("$specDate $targetTime:00");
                                                        if ($targetTs > time()) {
                                                            $initialSchedule = date('Y-m-d H:i:s', $targetTs);
                                                        }
                                                        // If date already past: keep $initialSchedule=$now ? FlowExecutor isWaitOver=TRUE ? skip correctly
                                                    }
                                                } elseif ($fsWaitMode === 'until') {
                                                    // [BUG-2 FIX] SMART SCHEDULE for until (time-of-day):
                                                    $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                                    $dt = new DateTime();
                                                    $parts2 = explode(':', $targetTime);
                                                    $dt->setTime((int)$parts2[0], (int)($parts2[1] ?? 0), 0);
                                                    if ($dt->getTimestamp() <= time()) $dt->modify('+1 day');
                                                    $initialSchedule = $dt->format('Y-m-d H:i:s');
                                                }
                                                break;
                                            }
                                        }

                                        $flowEnrollments[] = ['sid' => $subId, 'cid' => $sub['contact_id'] ?? null, 'fid' => $fid, 'step' => $flowTriggerNextStepId, 'schedule' => $initialSchedule];
                                        $successActivities[] = [$subId, 'enter_flow', $fid, $linkedFlow['name'], "Enrolled from Campaign '{$cName}'", $cid, $fid];

                                        // Update local cache to prevent duplicate enrollment in same batch if loop continues?
                                        // Actually $recipients are distinct, but just in case:
                                        $enrollmentCache[$subId] = ['status' => 'waiting', 'updated_at' => $now];
                                    }
                                } else {
                                    $jobDispatches[] = ['trigger_type' => 'campaign', 'target_id' => $cid, 'subscriber_id' => $subId];
                                }
                            } else {
                                $errMsg = is_string($res) ? $res : 'Unknown Error';
                                
                                if ($res === "Skipped: Virtual email") {
                                    // [VẬN HÀNH] Log as skipped_email instead of failed_email
                                    // This prevents it being retried but also avoids incrementing stat_total_failed
                                    $failActivities[] = [$subId, 'skipped_email', $cid, $cName, "Skipped: Virtual email", $cid, null, $isABTest ? $variationLabel : null];
                                } else {
                                    // Local string check to avoid sequential DB Updates
                                    $isHardBounce = false;
                                    $errMsgLower = strtolower($errMsg);
                                    $hkb = ['hard bounce', 'invalid recipient', 'unreachable', 'address rejected', 'does not exist', '550 5.1.1', '550 5.2.1', 'user unknown', 'recipient unknown', 'mailbox not found', 'account disabled', '5.1.1', 'permanent failure'];
                                    foreach ($hkb as $kb) {
                                        if (strpos($errMsgLower, $kb) !== false) {
                                            $isHardBounce = true;
                                            break;
                                        }
                                    }

                                    if ($isHardBounce) {
                                        $bouncedIds[] = $sub['id'];
                                    }

                                    $failType = ($campaign['type'] ?? 'email') === 'zalo_zns' ? 'zns_failed' : 'failed_email';
                                    if ($isHardBounce) {
                                        $failType = 'failed_email'; // hardbounce implies email
                                    }
                                    $failActivities[] = [$subId, $failType, $cid, $cName, "Email failed: " . $errMsg, $cid, null, $isABTest ? $variationLabel : null];
                                }
                            }

                            // [REAL-TIME PROGRESS] Progress is now updated every batch of 50 (Batch Size)
                            // Redundant time-based update removed to reduce DB overhead during sending.
                        }

                        // Batch Operations: First guarantee DB connection is alive
                        if (function_exists('ensure_pdo_alive')) {
                            ensure_pdo_alive($pdo);
                        }
                        $pdo->beginTransaction(); // Re-open transaction to save results safely

                        // Bulk Update Hard Bounces
                        if (!empty($bouncedIds)) {
                            $idPlaceholdersBounce = implode(',', array_fill(0, count($bouncedIds), '?'));
                            $pdo->prepare("UPDATE subscribers SET status = 'bounced' WHERE id IN ($idPlaceholdersBounce)")->execute($bouncedIds);
                        }

                        // Cleanup temporary 'processing_campaign' locks for this specific batch
                        if (!empty($recipients)) {
                            $subIdListForClean = array_column($recipients, 'id');
                            $idPlaceholdersClean = implode(',', array_fill(0, count($subIdListForClean), '?'));
                            $pdo->prepare("DELETE FROM subscriber_activity WHERE campaign_id = ? AND type = 'processing_campaign' AND subscriber_id IN ($idPlaceholdersClean)")->execute(array_merge([$cid], $subIdListForClean));
                        }

                        // 1. Log Activities
                        $allActivitiesGrouped = [];
                        foreach (array_merge($successActivities, $failActivities) as $act) {
                            $allActivitiesGrouped[$act[0] . '_' . uniqid()] = $act;
                        }
                        
                        if (!empty($allActivitiesGrouped)) {
                            // [DEADLOCK FIX] Sort by subscriber_id to ensure consistent lock acquisition
                            ksort($allActivitiesGrouped);
                            
                            $vals = [];
                            $binds = [];
                            foreach ($allActivitiesGrouped as $act) {
                                $binds[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                                $vals = array_merge($vals, [$act[0], $workspace_id, $act[1], $act[2], $act[6] ?? null, $act[5] ?? null, $act[3], $act[4], $act[7] ?? null]);
                            }
                            $sqlIns = "INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, flow_id, campaign_id, reference_name, details, variation, created_at) VALUES " . implode(',', $binds);
                            $pdo->prepare($sqlIns)->execute($vals);
                        }

                        // 2. Update Subscriber Stats
                        if (!empty($successIds)) {
                            // [DEADLOCK FIX] Consistent locking order
                            sort($successIds);
                            $idPlaceholders = implode(',', array_fill(0, count($successIds), '?'));
                            $pdo->prepare("UPDATE subscribers SET stats_sent = stats_sent + 1 WHERE id IN ($idPlaceholders)")->execute($successIds);
                        }

                        // 3. Flow Enrollments
                        if (!empty($flowEnrollments)) {
                            $vals = [];
                            $binds = [];
                            $fidStats = [];
                            foreach ($flowEnrollments as $en) {
                                $binds[] = "(?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())";
                                $vals = array_merge($vals, [$workspace_id, $en['sid'], $en['cid'] ?? null, $en['fid'], $en['step'], $en['schedule']]);
                                $fidStats[$en['fid']] = ($fidStats[$en['fid']] ?? 0) + 1;

                                $jobDispatches[] = [
                                    'priority_override' => true,
                                    'subscriber_id' => $en['sid'],
                                    'priority_flow_id' => $en['fid']
                                ];
                            }
                            // [BUG-1 FIX] Replace INSERT IGNORE with ON DUPLICATE KEY UPDATE.
                            // INSERT IGNORE silently drops re-enrollment for subscribers who completed the flow.
                            // ON DUPLICATE KEY UPDATE re-enrolls only if status is NOT active (waiting/processing).
                            // This allows recurring campaigns to correctly re-enroll completed subscribers.
                            $sqlFlow = "INSERT INTO subscriber_flow_states 
                                (workspace_id, subscriber_id, contact_id, flow_id, step_id, scheduled_at, status, created_at, updated_at, last_step_at) 
                                VALUES " . implode(',', $binds) . "
                                ON DUPLICATE KEY UPDATE
                                    step_id      = IF(status NOT IN ('waiting','processing'), VALUES(step_id), step_id),
                                    scheduled_at = IF(status NOT IN ('waiting','processing'), VALUES(scheduled_at), scheduled_at),
                                    status       = IF(status NOT IN ('waiting','processing'), 'waiting', status),
                                    last_step_at = IF(status NOT IN ('waiting','processing'), NOW(), last_step_at),
                                    updated_at   = IF(status NOT IN ('waiting','processing'), NOW(), updated_at)";
                            $stmtFlow = $pdo->prepare($sqlFlow);
                            $stmtFlow->execute($vals);
                            
                            // [FIX P1] Accurate stat_enrolled: only increment based on affected rows
                            $affected = $stmtFlow->rowCount();
                            if ($affected > 0) {
                                foreach ($fidStats as $fid => $count) {
                                    $actualIncrement = (count($fidStats) === 1) ? ceil($affected / 1.5) : $count; 
                                    $stmtUpdateFlowEnrolled->execute([$actualIncrement, $fid]);
                                }
                            }
                        }

                        // 4. Update Campaign Count
                        $sentCount = count($successIds);
                        $failedCount = 0;
                        foreach ($failActivities as $act) {
                            if (in_array($act[1], ['failed_email', 'zns_failed'])) {
                                $failedCount++;
                            }
                        }
                        // Update count_sent, count_bounced AND stats JSON structure so UI polls see progress
                        try {
                            // Optimized SQL to handle NULL or Empty String for stats
                            $stmtUpdateCampSentJSON->execute([$sentCount, $failedCount, $sentCount, $failedCount, $cid]);
                        } catch (Exception $e) {
                            // Fallback to simple update if JSON fails
                            $logs[] = "[WARN] Stats JSON update failed (fallback used): " . $e->getMessage();
                            $stmtUpdateCampSentFB->execute([$sentCount, $failedCount, $cid]);
                        }

                        $pdo->commit();

                        // 5. Dispatch Jobs (Post-Commit)
                        foreach ($jobDispatches as $job) {
                            if (isset($job['priority_flow_id'])) {
                                // Priority dispatch
                                dispatchQueueJob($pdo, 'flows', [
                                    'priority_queue_id' => 0,
                                    'subscriber_id' => $job['subscriber_id'],
                                    'priority_flow_id' => $job['priority_flow_id']
                                ]);
                            } else {
                                dispatchQueueJob($pdo, 'flows', $job);
                            }
                        }

                        $totalProcessed += count($recipients);
                        if (count($recipients) < $BATCH_SIZE) {
                            $hasMore = false;
                        }

                        // Keep-alive output
                        if ($totalProcessed % 50 === 0) {
                            $elapsed = microtime(true) - $startTimeRun;
                            $speed = round($totalProcessed / ($elapsed ?: 1), 1);
                            echo "Processed $totalProcessed (Speed: $speed mails/s)... ";
                            writeWorkerLog("Campaign $cid: Processed $totalProcessed. Current Speed: $speed m/s");
                            flush();
                        }

                        // [OPTIMIZATION] Explicit Garbage Collection (Zero-Leak Memory Profile)
                        unset($recipients, $successIds, $failActivities, $successActivities, $flowEnrollments, $jobDispatches, $capCache, $enrollmentCache, $lockBinds, $lockVals, $allActivitiesGrouped, $binds, $vals, $subIdList, $placeholdersSub);
                        // [PHASE 9 MEMORY FIX] Force PHP Engine to clean up circular references immediately after each batch
                        gc_collect_cycles();
                        
                    } catch (Throwable $e) {
                        if ($pdo->inTransaction()) {
                            $pdo->rollBack();
                        }
                        $logs[] = "[ERROR] Batch failed: " . $e->getMessage();
                        writeWorkerLog("[ERROR] Campaign $cid Batch failed: " . $e->getMessage());
                        break;
                    }
                }

                // Final Status Check
                if (function_exists('ensure_pdo_alive')) {
                    ensure_pdo_alive($pdo);
                }
                // Clean up any remaining temporary locks so follow-up workers/cron can immediately process
                $pdo->prepare("DELETE FROM subscriber_activity WHERE campaign_id = ? AND type = 'processing_campaign'")->execute([$cid]);
                $pdo->beginTransaction(); // New transaction for final status

                // Final Status Check - Double check if actually finished
                // [BUG FIX] We must check if there are subscribers who have NOT been sent/failed/skipped yet.
                // We should NOT exclude 'processing_campaign' here, because if they are locked but not sent,
                // the campaign is NOT finished (the worker might have crashed, leaving them locked).
                $sqlLeft = "SELECT COUNT(*) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ?";
                $execFinal = array_merge([$workspace_id], $queryBaseParams);

                if (!empty($wheres))
                    $sqlLeft .= " AND (" . implode(' OR ', $wheres) . ")";

                $sqlLeft .= " AND NOT EXISTS (
            SELECT 1 FROM subscriber_activity sa 
            WHERE sa.workspace_id = ? AND sa.subscriber_id = s.id 
            AND sa.campaign_id = ?
            AND sa.type IN ('receive_email', 'failed_email', 'skipped_email', 'zalo_sent', 'meta_sent', 'zns_sent', 'zns_failed', 'enter_flow')
        )";
                $execFinal[] = $workspace_id;
                $execFinal[] = $cid;

                $stmtLeft = $pdo->prepare($sqlLeft);
                $stmtLeft->execute($execFinal);
                $remaining = (int) $stmtLeft->fetchColumn();

                $shouldTriggerFollowUp = false;
                $nextRetry = 0;

                if ($remaining === 0) {
                    $pdo->prepare("UPDATE campaigns SET status = 'sent', count_sent = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_activity WHERE campaign_id = ? AND type IN ('receive_email', 'zalo_sent', 'meta_sent', 'zns_sent')) WHERE id = ? AND workspace_id = ?")->execute([$cid, $cid, $workspace_id]);
                    $logs[] = "[Campaign {$cid}] Finished. Status set to 'sent'.";
                    writeWorkerLog("Campaign $cid: Finished. Status set to 'sent'.");
                } else {
                    // [CONCURRENCY GUARD] If remaining > 0 but we processed 0 rows, 
                    // it means other workers are currently holding the locks, or they are crashed locks.
                    // Instead of rapid-fire retrying (which causes infinite loops and circuit breaker tripping),
                    // we gracefully exit and let the minute Cron Job handle the leftovers.
                    if ($totalProcessed > 0) {
                        if ($retryCount >= $MAX_RETRIES) {
                            // [FIX CB-2] Sync count_sent before pausing so UI shows accurate progress.
                            $pdo->prepare("UPDATE campaigns SET count_sent = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_activity WHERE campaign_id = ? AND type IN ('receive_email', 'zalo_sent', 'meta_sent', 'zns_sent')), status = 'paused' WHERE id = ? AND workspace_id = ?")->execute([$cid, $cid, $workspace_id]);
                            $errMsg = "[CIRCUIT BREAKER] Campaign $cid auto-paused after $MAX_RETRIES consecutive retries with $remaining unsent recipients. Manual review required.";
                            $logs[] = $errMsg;
                            writeWorkerLog($errMsg);
                        } else {
                            $nextRetry = $retryCount + 1;
                            $shouldTriggerFollowUp = true;
                            $logs[] = "[Campaign {$cid}] Continuous mode: $remaining remaining. Follow-up staged (retry #$nextRetry).";
                            writeWorkerLog("Campaign $cid: Continuous mode: $remaining remaining. Follow-up staged (retry #$nextRetry/$MAX_RETRIES).");
                        }
                    } else {
                        $logs[] = "[Campaign {$cid}] Remaining $remaining are currently locked by other workers or pending recovery. Safely yielding to Cron.";
                        writeWorkerLog("Campaign $cid: Remaining $remaining are locked. Yielding to Cron Job.");
                    }
                }
                $pdo->commit();

                // [RACE CONDITION PREVENTER] Spawn follow-up only AFTER transaction is successfully committed!
                if ($shouldTriggerFollowUp) {
                    triggerAsyncWorker('/worker_campaign.php?campaign_id=' . $cid . '&retry_count=' . $nextRetry);
                    writeWorkerLog("Campaign $cid: Spawned async follow-up worker (retry #$nextRetry).");
                }
            } catch (Throwable $e) {
                if (function_exists('ensure_pdo_alive')) {
                    ensure_pdo_alive($pdo);
                }
                if ($pdo && $pdo->inTransaction()) {
                    try { $pdo->rollBack(); } catch (Throwable $rbEx) {}
                }
                $logs[] = "[ERROR] Campaign {$cid} failed: " . $e->getMessage();
                writeWorkerLog("[FATAL ERROR] Campaign $cid failed: " . $e->getMessage());
                try {
                    $pdo->prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?")->execute([$cid]);
                } catch (Throwable $upEx) {}
            }
        } else {
            $logs[] = "[Campaign] No campaigns ready to process.";
            writeWorkerLog("No campaigns ready to process.");
        }

        // Release campaign advisory lock on normal completion
        if (!empty($lockKey)) {
            try {
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockKey]);
            } catch (Throwable $e) {}
        }

        file_put_contents(__DIR__ . '/worker_campaign.log', implode("\n", $logs) . "\n", FILE_APPEND);

        if (function_exists('flushActivityLogBuffer')) {
            flushActivityLogBuffer($pdo);
        }
        if (isset($mailer))
            $mailer->closeConnection();

        if (isset($_GET['output']) && $_GET['output'] === 'text') {
            echo implode("\n", $logs);
        } else {
            echo json_encode(['status' => 'completed', 'timestamp' => $now, 'logs' => $logs]);
        }
    } // end runWorkerCampaign()
} // end if (!function_exists)

// When run as standalone script (cron/direct), execute immediately
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $cliCampaignId = isset($argv[1]) ? $argv[1] : null;
    runWorkerCampaign($pdo, $_GET['campaign_id'] ?? $cliCampaignId);
}
