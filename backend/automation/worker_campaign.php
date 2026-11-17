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
    function runWorkerCampaign($pdo, $campaignId = null, $shardArg = null, $shardsArg = null, $retryArg = null)
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
        $apiUrl = resolve_automation_api_base_url($pdo);
        // [FIX P38-WC] Only load the 2 settings keys this worker actually needs.
        $stmt = $pdo->query("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN ('smtp_user','max_messages_per_day')");
        $settings = [];
        foreach ($stmt->fetchAll() as $row) {
            $settings[$row['key']] = $row['value'];
        }
        $defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
        $mailer = new Mailer($pdo, $apiUrl, $defaultSender, 0);

        $skipLockedClause = isDatabaseSkipLockedSupported($pdo) ? 'SKIP LOCKED' : '';

        // Parse Campaign + Shard arguments from explicit args, HTTP query, or CLI $argv
        global $argv;
        $cliCampaignId = isset($argv[1]) && $argv[1] !== '' ? $argv[1] : null;
        $cliRetry      = isset($argv[2]) && is_numeric($argv[2]) ? (int)$argv[2] : null;
        $cliShard      = isset($argv[3]) && is_numeric($argv[3]) ? (int)$argv[3] : null;
        $cliShards     = isset($argv[4]) && is_numeric($argv[4]) ? (int)$argv[4] : null;

        $manualCampaignId = $campaignId ?? ($_GET['campaign_id'] ?? $cliCampaignId);
        $rawShard  = $shardArg  ?? ($_GET['shard'] ?? $cliShard);
        $rawShards = $shardsArg ?? ($_GET['shards'] ?? $cliShards);
        $explicitShardMode = ($rawShard !== null && $rawShards !== null);
        $shardId   = $explicitShardMode ? max(0, (int)$rawShard) : 0;
        $numShards = $explicitShardMode ? max(1, min(8, (int)$rawShards)) : 1;
        if ($shardId >= $numShards) {
            $shardId = $shardId % $numShards;
        }

        if (php_sapi_name() === 'cli') {
            @set_time_limit(0);
        }

        $MAX_RETRIES = 12;
        $rawRetry = $retryArg ?? ($_GET['retry_count'] ?? ($cliRetry ?? 0));
        $retryCount = min(max(0, (int)$rawRetry), $MAX_RETRIES + 1);
        if ($manualCampaignId) {
            $shardLabel = $explicitShardMode ? " shard {$shardId}/{$numShards}" : " (coordinator)";
            $logs[] = "-> Direct trigger received for Campaign ID: $manualCampaignId{$shardLabel} (retry #$retryCount)";
            writeWorkerLog("Direct trigger for Campaign ID: $manualCampaignId{$shardLabel} (retry #$retryCount)");
        }

        // =================================================================================
        // HELPERS (Imported from shared module)
        // =================================================================================

        // =================================================================================
        // CAMPAIGN DISPATCHER
        // =================================================================================
        $campaign = null;

        if ($manualCampaignId) {
            // Priority: Strictly ONLY pick active sending/scheduled campaigns — NEVER auto-resume 'paused'!
            $stmtCamp = $pdo->prepare("SELECT * FROM campaigns WHERE id = ? AND status IN ('scheduled', 'sending') LIMIT 1");
            $stmtCamp->execute([$manualCampaignId]);
            $campaign = $stmtCamp->fetch();
            if (!$campaign) {
                $logs[] = "[Target Campaign] Campaign ID $manualCampaignId is paused, finished, or not active — skipping.";
                writeWorkerLog("[Target Campaign] Campaign ID $manualCampaignId skipped (paused/inactive).");
            }
        }

        if (!$campaign && !$manualCampaignId) {
            // Fallback (Cron): Pick next scheduled or sending campaign needing work
            $stmtCamp = $pdo->prepare("SELECT * FROM campaigns WHERE status IN ('scheduled', 'sending') AND (scheduled_at <= ? OR scheduled_at IS NULL) ORDER BY scheduled_at ASC LIMIT 10");
            $stmtCamp->execute([$now]);
            $candidates = $stmtCamp->fetchAll();
            foreach ($candidates as $cand) {
                $coordLock = "campaign_coordinator_" . $cand['id'];
                $stmtCheck = $pdo->prepare("SELECT IS_USED_LOCK(?)");
                $stmtCheck->execute([$coordLock]);
                if (!$stmtCheck->fetchColumn()) {
                    $campaign = $cand;
                    break;
                }
            }
        }

        if ($campaign) {
            $cid = $campaign['id'];
            $cName = $campaign['name'];
            $workspace_id = (int)($campaign['workspace_id'] ?? 0);
            $campaignType = strtolower((string)($campaign['type'] ?? 'email'));

            // Ensure claims table exists & backfill sent logs safely if Coordinator or direct run
            $claimsTableAvailable = false;
            try {
                $pdo->query("SELECT 1 FROM campaign_send_claims LIMIT 1");
                $claimsTableAvailable = true;
            } catch (Throwable $eNoClaims) {
                $claimsTableAvailable = false;
            }

            // If Coordinator mode (cron or default un-sharded dispatch) AND multi-shard CLI is possible:
            // initialize snapshot once, backfill claims, spawn bounded parallel CLI shards, and yield cleanly.
            if (!$explicitShardMode && $campaignType !== 'zalo_zns' && function_exists('exec') && ($phpBin = findAutomationPhpCli()) !== null) {
                $coordLockKey = "campaign_coordinator_" . $cid;
                $stmtCL = $pdo->prepare("SELECT GET_LOCK(?, 2)");
                $stmtCL->execute([$coordLockKey]);
                if ((int)$stmtCL->fetchColumn() !== 1) {
                    writeWorkerLog("Campaign $cid coordinator already active. Skipping.");
                    return ['status' => 'locked', 'campaign_id' => $cid];
                }

                // Re-read fresh status under coordinator lock
                $stmtFresh = $pdo->prepare("SELECT * FROM campaigns WHERE id = ? LIMIT 1");
                $stmtFresh->execute([$cid]);
                $freshCamp = $stmtFresh->fetch(PDO::FETCH_ASSOC);
                if (!$freshCamp || !in_array(strtolower((string)$freshCamp['status']), ['scheduled', 'sending'], true)) {
                    $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$coordLockKey]);
                    writeWorkerLog("Campaign $cid status is not scheduled/sending after coordinator lock. Aborting.");
                    return ['status' => 'aborted_paused', 'campaign_id' => $cid];
                }

                if ($claimsTableAvailable) {
                    // Clean stale claims > 10 min and sync already-sent delivery logs so nothing ever duplicates
                    $pdo->prepare("DELETE FROM campaign_send_claims WHERE campaign_id = ? AND status = 'processing' AND claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)")
                        ->execute([$cid]);
                    $pdo->prepare("
                        INSERT IGNORE INTO campaign_send_claims
                            (campaign_id, workspace_id, recipient_key, channel, subscriber_id, status, claimed_at)
                        SELECT l.campaign_id, COALESCE(l.workspace_id, ?), LOWER(TRIM(l.recipient)), 'email', l.subscriber_id, 'sent', COALESCE(l.sent_at, NOW())
                        FROM mail_delivery_logs l
                        WHERE l.campaign_id = ? AND l.deleted_at IS NULL AND l.status = 'success'
                          AND l.recipient IS NOT NULL AND TRIM(l.recipient) != ''
                    ")->execute([$workspace_id, $cid]);
                }

                // Transition 'scheduled' -> 'sending' cleanly & count unique email audience once if unset
                $totalAud = (int)($freshCamp['total_target_audience'] ?? 0);
                if (strtolower((string)$freshCamp['status']) === 'scheduled' || empty($freshCamp['sent_at']) || $totalAud === 0) {
                    $targetConfCoord = json_decode($freshCamp['target_config'] ?? '{}', true) ?: [];
                    $cWheresCoord = [];
                    $cParamsCoord = [$workspace_id];
                    if (!empty($targetConfCoord['listIds'])) {
                        $ph = implode(',', array_fill(0, count($targetConfCoord['listIds']), '?'));
                        $cWheresCoord[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE workspace_id = ? AND list_id IN ($ph))";
                        $cParamsCoord = array_merge([$workspace_id], $cParamsCoord, $targetConfCoord['listIds']);
                    }
                    if (!empty($targetConfCoord['tagIds'])) {
                        $tc = [];
                        foreach ($targetConfCoord['tagIds'] as $tg) {
                            $tc[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
                            $cParamsCoord[] = $workspace_id;
                            $cParamsCoord[] = $workspace_id;
                            $cParamsCoord[] = $tg;
                        }
                        if (!empty($tc)) $cWheresCoord[] = "(" . implode(' OR ', $tc) . ")";
                    }
                    if (!empty($targetConfCoord['segmentIds'])) {
                        $ph = implode(',', array_fill(0, count($targetConfCoord['segmentIds']), '?'));
                        $stSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id IN ($ph) AND workspace_id = ?");
                        $stSeg->execute(array_merge($targetConfCoord['segmentIds'], [$workspace_id]));
                        foreach ($stSeg->fetchAll() as $seg) {
                            $resSeg = buildSegmentWhereClause($seg['criteria'], $workspace_id);
                            if ($resSeg['sql'] !== '1=1') {
                                $cWheresCoord[] = $resSeg['sql'];
                                foreach ($resSeg['params'] as $p) $cParamsCoord[] = $p;
                            }
                        }
                    }
                    if (!empty($targetConfCoord['individualIds'])) {
                        $ph = implode(',', array_fill(0, count($targetConfCoord['individualIds']), '?'));
                        $cWheresCoord[] = "s.id IN ($ph)";
                        $cParamsCoord = array_merge($cParamsCoord, $targetConfCoord['individualIds']);
                    }
                    if (!empty($cWheresCoord)) {
                        $cSql = "SELECT COUNT(DISTINCT LOWER(TRIM(s.email))) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND s.status IN ('active', 'lead', 'customer') AND s.email IS NOT NULL AND TRIM(s.email) != '' AND (" . implode(' OR ', $cWheresCoord) . ")";
                        $stCnt = $pdo->prepare($cSql);
                        $stCnt->execute($cParamsCoord);
                        $totalAud = (int)$stCnt->fetchColumn();
                    }
                    $pdo->prepare("UPDATE campaigns SET status = 'sending', sent_at = COALESCE(sent_at, NOW()), total_target_audience = ?, updated_at = NOW() WHERE id = ? AND status IN ('scheduled','sending')")
                        ->execute([$totalAud, $cid]);
                }

                // Estimate remaining unsent audience to decide parallel shards vs inline single run
                $sentSoFar = (int)($freshCamp['count_sent'] ?? 0);
                $estRemaining = max(0, $totalAud - $sentSoFar);
                if ($totalAud === 0 || $estRemaining >= 80) {
                    $spawnCount = 6;
                    $spawned = 0;
                    for ($s = 0; $s < $spawnCount; $s++) {
                        $stFree = $pdo->prepare("SELECT IS_FREE_LOCK(?)");
                        $stFree->execute(["campaign_worker_{$cid}_s{$s}"]);
                        if ((int)$stFree->fetchColumn() === 1) {
                            $cmd = sprintf(
                                'nohup %s %s %s 0 %d %d >/dev/null 2>&1 &',
                                escapeshellarg($phpBin),
                                escapeshellarg(__FILE__),
                                escapeshellarg($cid),
                                $s,
                                $spawnCount
                            );
                            @exec($cmd);
                            $spawned++;
                        }
                    }
                    $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$coordLockKey]);
                    writeWorkerLog("Campaign $cid coordinator checked shards: spawned $spawned/$spawnCount parallel shards (estRemaining=$estRemaining).");
                    echo json_encode(['status' => 'dispatched_shards', 'campaign_id' => $cid, 'spawned' => $spawned, 'shards' => $spawnCount]);
                    return ['status' => 'dispatched_shards', 'campaign_id' => $cid, 'spawned' => $spawned];
                }

                // Small campaign (<80 remaining): release coordinator lock and run inline directly as shard 0/1
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$coordLockKey]);
            }

            // [CONCURRENCY GUARD] Acquire exclusive MySQL Advisory Lock per Campaign Shard
            $lockKey = ($numShards > 1) ? "campaign_worker_{$cid}_s{$shardId}" : "campaign_worker_{$cid}_s0";
            $lockTimeout = $manualCampaignId ? 2 : 0;
            $stmtLock = $pdo->prepare("SELECT GET_LOCK(?, ?)");
            $stmtLock->execute([$lockKey, $lockTimeout]);
            $lockAcquired = ((int)$stmtLock->fetchColumn() === 1);

            if (!$lockAcquired) {
                $msg = "[LOCK GUARD] Campaign $cid ({$lockKey}) is already processed by another active worker. Skipping.";
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

            // Clean up ONLY stale temporary processing locks (>15 minutes old) from crashed processes
            if ($shardId === 0) {
                $pdo->prepare("UPDATE subscriber_activity SET type = 'released_campaign' WHERE campaign_id = ? AND workspace_id = ? AND type = 'processing_campaign' AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)")->execute([$cid, $workspace_id]);
                if ($claimsTableAvailable) {
                    $pdo->prepare("DELETE FROM campaign_send_claims WHERE campaign_id = ? AND status = 'processing' AND claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)")->execute([$cid]);
                }
            }

            // Double-check fresh live status after acquiring shard lock (prevents race with user Pause click!)
            $stmtReCheck = $pdo->prepare("SELECT * FROM campaigns WHERE id = ? LIMIT 1");
            $stmtReCheck->execute([$cid]);
            $campaign = $stmtReCheck->fetch(PDO::FETCH_ASSOC);
            if (!$campaign || !in_array(strtolower((string)$campaign['status']), ['scheduled', 'sending'], true)) {
                writeWorkerLog("Campaign $cid ({$lockKey}): Status became '" . ($campaign['status'] ?? 'unknown') . "' before start. Aborting.");
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockKey]);
                return ['status' => 'aborted_paused', 'campaign_id' => $cid];
            }

            // Start transaction for initialization
            $pdo->beginTransaction();
            try {
                // Initialize if NOT already sending, or if sent_at is missing (first trigger from scheduled)
                if ($campaign['status'] !== 'sending' || empty($campaign['sent_at'])) {
                    // Calculate Unique Audience Size (Snapshot) — deduplicated by email or phone + soft-delete safe
                    if ($campaignType === 'zalo_zns') {
                        $countSql = "SELECT COUNT(DISTINCT COALESCE(NULLIF(s.phone_norm9, ''), s.phone_number)) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND s.deleted_at IS NULL AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                    } else {
                        $countSql = "SELECT COUNT(DISTINCT LOWER(TRIM(s.email))) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND s.deleted_at IS NULL AND s.email IS NOT NULL AND TRIM(s.email) != ''";
                    }
                    $countParams = [$workspace_id];

                    $countWheres = [];
                    $targetConf = json_decode($campaign['target_config'], true);

                    // A. LISTS
                    if (!empty($targetConf['listIds'])) {
                        $listPlaceholders = implode(',', array_fill(0, count($targetConf['listIds']), '?'));
                        $countWheres[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE workspace_id = ? AND list_id IN ($listPlaceholders))";
                        $countParams = array_merge([$workspace_id], $countParams);
                        $countParams = array_merge($countParams, $targetConf['listIds']);
                    }
                    // B. TAGS
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
                    // D. INDIVIDUAL IDs
                    if (!empty($targetConf['individualIds'])) {
                        $indPlaceholders = implode(',', array_fill(0, count($targetConf['individualIds']), '?'));
                        $countWheres[] = "s.id IN ($indPlaceholders)";
                        $countParams = array_merge($countParams, $targetConf['individualIds']);
                    }

                    $totalAudience = (int) ($campaign['total_target_audience'] ?? 0);
                    if (!empty($countWheres) && ($totalAudience === 0 || $campaign['status'] !== 'sending')) {
                        $countSql .= " AND (" . implode(' OR ', $countWheres) . ")";
                        $stmtCount = $pdo->prepare($countSql);
                        $stmtCount->execute($countParams);
                        $totalAudience = (int) $stmtCount->fetchColumn();
                    }

                    // Transition only 'scheduled'/'sending' (never overwrite paused!)
                    $pdo->prepare("UPDATE campaigns SET status = 'sending', sent_at = COALESCE(sent_at, NOW()), total_target_audience = ? WHERE id = ? AND status IN ('scheduled', 'sending')")->execute([$totalAudience, $cid]);
                    $logs[] = "[Campaign {$cid}] Initialized ({$lockKey}). Status: sending. Total Unique Audience: $totalAudience";
                    writeWorkerLog("Campaign $cid Initialized ({$lockKey}). Unique Audience: $totalAudience");

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
                $BATCH_SIZE = 50;   // Frequent commits (every ~4-5s across 6 shards) -> smooth live progress & fast Pause response
                $MAX_BATCHES = 200; // Up to 10,000 unique emails per shard (~60,000 across 6 shards) per worker run
                $batchCount = 0;
                $hasMore = true;
                $totalProcessed = 0;
                $sentThisRun = 0;
                $abortedExternally = false;
                $startTimeRun = microtime(true);

                // [DYNAMIC TIME LIMIT] CLI PHP returns max_execution_time=0 (unlimited). Give CLI shards 1800s; cap FPM/HTTP safely.
                $maxExecutionTime = (int) ini_get('max_execution_time');
                $timeLimit = ($maxExecutionTime > 0) ? max(10, min($maxExecutionTime - 5, 450)) : 1800;

                // [PERF B2] Pre-decode linked flow JSON once
                $linkedFlowConfig = $linkedFlow ? (json_decode($linkedFlow['config'], true) ?: []) : null;
                $linkedFlowSteps  = $linkedFlow ? (json_decode($linkedFlow['steps'], true) ?: []) : null;

                // [PERF B3] Pre-decode ZNS campaign config once per worker run
                $znsConfigPreloaded = null;
                if (($campaign['type'] ?? 'email') === 'zalo_zns' && !empty($campaign['config'])) {
                    $znsConfigPreloaded = json_decode($campaign['config'], true) ?: [];
                }

                // Backfill sent claims once if single-shard path skipped Coordinator
                $campChannelType = ($campaignType === 'zalo_zns') ? 'zns' : 'email';
                if ($claimsTableAvailable && $campChannelType === 'email') {
                    $pdo->prepare("
                        INSERT IGNORE INTO campaign_send_claims
                            (campaign_id, workspace_id, recipient_key, channel, subscriber_id, status, claimed_at)
                        SELECT l.campaign_id, COALESCE(l.workspace_id, ?), LOWER(TRIM(l.recipient)), 'email', l.subscriber_id, 'sent', COALESCE(l.sent_at, NOW())
                        FROM mail_delivery_logs l
                        WHERE l.campaign_id = ? AND l.deleted_at IS NULL AND l.status = 'success'
                          AND l.recipient IS NOT NULL AND TRIM(l.recipient) != ''
                    ")->execute([$workspace_id, $cid]);
                }

                // Commit the initialization transaction
                $pdo->commit();

                // [OPTIMIZATION + 100% EMAIL DEDUP] Pre-build Recipient Fetch SQL before batch loop
                $innerParams = [$workspace_id];
                $innerWhere = "s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND s.deleted_at IS NULL";
                if ($campaignType === 'zalo_zns') {
                    $innerWhere .= " AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                } else {
                    $innerWhere .= " AND (s.email IS NOT NULL AND TRIM(s.email) != '')";
                }
                if (!empty($wheres)) {
                    $innerWhere .= " AND (" . implode(' OR ', $wheres) . ")";
                    $innerParams = array_merge($innerParams, $queryBaseParams);
                }
                if ($campaignType !== 'zalo_zns' && $numShards > 1) {
                    $innerWhere .= " AND MOD(CRC32(LOWER(TRIM(s.email))), ?) = ?";
                    $innerParams[] = $numShards;
                    $innerParams[] = $shardId;
                }
                if ($claimsTableAvailable && $campaignType !== 'zalo_zns') {
                    $innerWhere .= " AND NOT EXISTS (
                        SELECT 1 FROM campaign_send_claims csc
                        WHERE csc.campaign_id = ? AND csc.channel = 'email'
                          AND csc.recipient_key = LOWER(TRIM(s.email))
                          AND (csc.status IN ('sent', 'failed', 'skipped')
                               OR (csc.status = 'processing' AND csc.claimed_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)))
                    )";
                    $innerParams[] = $cid;
                }
                if ($campaignType !== 'zalo_zns') {
                    $innerWhere .= " AND NOT EXISTS (
                        SELECT 1 FROM mail_delivery_logs mdl
                        WHERE mdl.campaign_id = ? AND mdl.deleted_at IS NULL
                          AND mdl.status = 'success'
                          AND mdl.recipient = s.email
                    )";
                    $innerParams[] = $cid;
                }
                $innerWhere .= " AND NOT EXISTS (
                    SELECT 1 FROM subscriber_activity sa
                    WHERE sa.workspace_id = ?
                    AND sa.subscriber_id = s.id
                    AND sa.campaign_id = ?
                    AND (
                        sa.type IN ('receive_email', 'failed_email', 'skipped_email', 'zalo_sent', 'meta_sent', 'zns_sent', 'zns_failed', 'enter_flow')
                        OR (sa.type = 'processing_campaign' AND sa.created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE))
                    )
                )";
                $innerParams[] = $workspace_id;
                $innerParams[] = $cid;

                $execParams = array_values($innerParams);
                $groupKeyExpr = ($campaignType === 'zalo_zns')
                    ? "COALESCE(NULLIF(s.phone_norm9, ''), s.phone_number)"
                    : "LOWER(TRIM(s.email))";

                // Derived dedup table picks strictly 1 subscriber per unique normalized email/phone per batch
                $sqlFetch = "SELECT s_pick.id, s_pick.contact_id, s_pick.email, s_pick.first_name, s_pick.last_name,
                        s_pick.phone_number, s_pick.phone_norm9, s_pick.company_name, s_pick.job_title,
                        s_pick.city, s_pick.district, s_pick.ward, s_pick.country, s_pick.address,
                        s_pick.gender, s_pick.date_of_birth, s_pick.anniversary_date, s_pick.joined_at,
                        s_pick.custom_attributes, s_pick.program, s_pick.stage_id, s_pick.owner_id, s_pick.salesperson
                    FROM subscribers s_pick
                    INNER JOIN (
                        SELECT MIN(s.id) AS picked_id
                        FROM subscribers s
                        WHERE {$innerWhere}
                        GROUP BY {$groupKeyExpr}
                        ORDER BY picked_id ASC
                        LIMIT " . (int)$BATCH_SIZE . "
                    ) dedup ON dedup.picked_id = s_pick.id";
                $stmtSubs = $pdo->prepare($sqlFetch);

                // Prepare atomic per-recipient claim statement (prevents any duplicate even across crashed/re-queued workers)
                $stmtClaimInsert = $claimsTableAvailable ? $pdo->prepare("
                    INSERT IGNORE INTO campaign_send_claims
                        (campaign_id, workspace_id, recipient_key, channel, subscriber_id, status, claimed_at)
                    VALUES (?, ?, ?, ?, ?, 'processing', NOW())
                ") : null;
                $stmtClaimUpdate = $claimsTableAvailable ? $pdo->prepare("
                    UPDATE campaign_send_claims SET status = ?, updated_at = NOW()
                    WHERE campaign_id = ? AND channel = ? AND recipient_key = ?
                ") : null;

                // Claim 1 QA sample per entire campaign (not per email or per shard!)
                $qaAllowedOnce = false;
                if ($shardId === 0 && $retryCount === 0 && $campaignType !== 'zalo_zns') {
                    if ($claimsTableAvailable) {
                        $stmtQa = $pdo->prepare("INSERT IGNORE INTO campaign_send_claims (campaign_id, workspace_id, recipient_key, channel, status) VALUES (?, ?, '__qa_sample__', 'qa', 'sent')");
                        $stmtQa->execute([$cid, $workspace_id]);
                        $qaAllowedOnce = ($stmtQa->rowCount() === 1);
                    } else {
                        $qaAllowedOnce = true;
                    }
                }

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
                    $liveCampStatus = strtolower((string)$stmtStatusLive->fetchColumn());
                    if ($liveCampStatus !== 'sending') {
                        $abortedExternally = true;
                        $hasMore = false;
                        writeWorkerLog("Campaign $cid ({$lockKey}): Status is no longer 'sending' (currently '$liveCampStatus'). Stopping worker loop immediately.");
                        break;
                    }

                    // [TIME GUARD] Leave room for clean wrap-up before FPM/CLI soft limit
                    if (microtime(true) - $startTimeRun > $timeLimit) {
                        writeWorkerLog("Campaign $cid ({$lockKey}): Execution time limit ($timeLimit s) reached. Stopping batch loop.");
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
                            $vCampIds = array_values(array_unique($vMatches[1] ?? []));
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
                        $seenKeysInBatch = [];
                        $claimedBatchKeys = [];
                        $sentClaimKeys = [];
                        $failClaimKeys = [];
                        $skipClaimKeys = [];

                        // [RATE LIMITER] Uses sesAcquireRateSlot() — shared file-lock across ALL PHP workers.

                        foreach ($recipients as $sub) {
                            $currentIdx = $recipientIndexInBatch++;
                            $subId = $sub['id'];

                            // Check pause/stop every 5 recipients (stops all shards within <1s when user clicks Pause)
                            if ($currentIdx % 5 === 0) {
                                if (function_exists('ensure_pdo_alive')) {
                                    ensure_pdo_alive($pdo);
                                }
                                try {
                                    $stmtLiveSt = $pdo->prepare("SELECT status FROM campaigns WHERE id = ?");
                                    $stmtLiveSt->execute([$cid]);
                                    $curLiveStatus = strtolower((string)$stmtLiveSt->fetchColumn());
                                    if ($curLiveStatus && in_array($curLiveStatus, ['paused', 'cancelled', 'draft', 'sent'], true)) {
                                        writeWorkerLog("Campaign $cid ({$lockKey}): Explicitly paused/stopped mid-batch (status: '$curLiveStatus'). Aborting recipient loop.");
                                        $abortedExternally = true;
                                        $hasMore = false;
                                        break;
                                    }
                                } catch (Throwable $ignoreLiveCheck) {}
                            }

                            // Atomic email/phone dedup check (in-memory + campaign_send_claims UNIQUE index)
                            $normRecipientKey = ($campChannelType === 'zns')
                                ? (!empty($sub['phone_norm9']) ? (string)$sub['phone_norm9'] : trim((string)($sub['phone_number'] ?? '')))
                                : strtolower(trim((string)($sub['email'] ?? '')));

                            if ($normRecipientKey === '' || isset($seenKeysInBatch[$normRecipientKey])) {
                                continue;
                            }
                            $seenKeysInBatch[$normRecipientKey] = true;

                            if ($stmtClaimInsert) {
                                $stmtClaimInsert->execute([$cid, $workspace_id, $normRecipientKey, $campChannelType, $subId]);
                                if ($stmtClaimInsert->rowCount() === 0) {
                                    $logs[] = "  -> Dedup lock skip: {$normRecipientKey} already claimed/sent for Campaign $cid.";
                                    continue;
                                }
                                $claimedBatchKeys[] = $normRecipientKey;
                            } else {
                                // Fallback when claims table unavailable
                                $stmtCheckSent = $pdo->prepare("SELECT 1 FROM subscriber_activity WHERE workspace_id = ? AND subscriber_id = ? AND campaign_id = ? AND type IN ('receive_email', 'zns_sent') LIMIT 1");
                                $stmtCheckSent->execute([$workspace_id, $subId, $cid]);
                                if ($stmtCheckSent->fetchColumn()) {
                                    continue;
                                }
                            }

                            $attachments = Mailer::filterAttachments($campaignAttachments, $sub['email']);

                            $currentSubject = $campaign['subject'];
                            $currentHtml = $htmlContent;
                            $variationLabel = "A";

                            if ($isABTest && $hasVariantB) {
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

                            // QA copy sent ONCE per campaign (never on every email or reconnect SMTP connection!)
                            $skipQA = !$qaAllowedOnce;

                            // [OPTIMIZED] Frequency Cap Check (Per Channel)
                            if ($maxPerDay > 0) {
                                $campChannel = (($campaign['type'] ?? 'email') === 'zalo_zns') ? 'zalo' : 'email';
                                $subCapData = $capCache[$subId] ?? ['email' => 0, 'zalo' => 0, 'meta' => 0];
                                $totalToday = $subCapData[$campChannel] ?? 0;
                                if ($totalToday >= $maxPerDay) {
                                    $logs[] = "  -> Skipping {$sub['email']}: Frequency cap reached ($totalToday/$maxPerDay) for channel $campChannel";
                                    $failActivities[] = [$subId, 'skipped_email', $cid, $cName, "Skipped: Frequency cap ($totalToday/$maxPerDay per day)", $cid, null, $isABTest ? $variationLabel : null];
                                    $skipClaimKeys[] = $normRecipientKey;
                                    continue;
                                }
                                if (!isset($capCache[$subId])) $capCache[$subId] = ['email' => 0, 'zalo' => 0, 'meta' => 0];
                                $capCache[$subId][$campChannel]++;
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

                                    // [SES SHARED RATE LIMITER] 78ms interval = ~12.8/s safe cap across all shards (AWS SES quota: 14/s)
                                    sesAcquireRateSlot(78000);

                                    $res = $mailer->send($sub['email'], $personalSubject, $personalHtml, $sub['id'], $cid, null, null, $attachments, null, null, $cName, false, $skipQA, $variationLabel, null, $workspace_id, $ccEmails, $bccEmails);
                                    if ($qaAllowedOnce) {
                                        $qaAllowedOnce = false; // QA copy sent at most once per campaign
                                    }
                                }
                            }

                            if ($res === true) {
                                $sentClaimKeys[] = $normRecipientKey;
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
                                        $firstMeta = extractFlowStepMeta($fSteps, $flowTriggerNextStepId);
                                        $flowTriggerNextStepType = $firstMeta['type'] ?? 'unknown';
                                        if ($firstMeta['step'] && strtolower((string) $flowTriggerNextStepType) === 'wait') {
                                            $waitCalc = calculateWaitStepScheduledAt($firstMeta['step'], null, [
                                                'for_enrollment' => true,
                                                'past_fallback' => $now,
                                                'duration_default' => 0,
                                                'unit_default' => 'minutes',
                                            ]);
                                            $initialSchedule = $waitCalc['scheduled_at'];
                                        }

                                        $flowEnrollments[] = [
                                            'sid' => $subId,
                                            'cid' => $sub['contact_id'] ?? null,
                                            'fid' => $fid,
                                            'step' => $flowTriggerNextStepId,
                                            'step_type' => $flowTriggerNextStepType,
                                            'schedule' => $initialSchedule
                                        ];
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
                                    $skipClaimKeys[] = $normRecipientKey;
                                    $failActivities[] = [$subId, 'skipped_email', $cid, $cName, "Skipped: Virtual email", $cid, null, $isABTest ? $variationLabel : null];
                                } else {
                                    $failClaimKeys[] = $normRecipientKey;
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
                            $pdo->prepare("UPDATE subscribers SET status = 'bounced' WHERE id IN ($idPlaceholdersBounce) AND workspace_id = ?")->execute(array_merge($bouncedIds, [$workspace_id]));
                        }

                        // Sync atomic claims table statuses for this batch
                        if ($claimsTableAvailable && !empty($claimedBatchKeys)) {
                            $updateClaimGroup = function (array $keys, string $newStatus) use ($pdo, $cid, $campChannelType) {
                                $keys = array_values(array_unique(array_filter($keys)));
                                if (empty($keys)) return;
                                $ph = implode(',', array_fill(0, count($keys), '?'));
                                $pdo->prepare("UPDATE campaign_send_claims SET status = ?, updated_at = NOW() WHERE campaign_id = ? AND channel = ? AND recipient_key IN ($ph)")
                                    ->execute(array_values(array_merge([$newStatus, $cid, $campChannelType], $keys)));
                            };
                            $updateClaimGroup($sentClaimKeys, 'sent');
                            $updateClaimGroup($failClaimKeys, 'failed');
                            $updateClaimGroup($skipClaimKeys, 'skipped');

                            // Release any claimed rows in this batch that were NOT processed (e.g., mid-batch Pause abort)
                            $unprocessedKeys = array_values(array_diff($claimedBatchKeys, $sentClaimKeys, $failClaimKeys, $skipClaimKeys));
                            if (!empty($unprocessedKeys)) {
                                $ph = implode(',', array_fill(0, count($unprocessedKeys), '?'));
                                $pdo->prepare("DELETE FROM campaign_send_claims WHERE campaign_id = ? AND channel = ? AND status = 'processing' AND recipient_key IN ($ph)")
                                    ->execute(array_values(array_merge([$cid, $campChannelType], $unprocessedKeys)));
                            }
                        }

                        // Cleanup temporary 'processing_campaign' locks for this specific batch (soft-transition to released_campaign)
                        if (!empty($recipients)) {
                            $subIdListForClean = array_values(array_column($recipients, 'id'));
                            $idPlaceholdersClean = implode(',', array_fill(0, count($subIdListForClean), '?'));
                            $pdo->prepare("UPDATE subscriber_activity SET type = 'released_campaign' WHERE campaign_id = ? AND workspace_id = ? AND type = 'processing_campaign' AND subscriber_id IN ($idPlaceholdersClean)")
                                ->execute(array_values(array_merge([$cid, $workspace_id], $subIdListForClean)));
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
                            $pdo->prepare("UPDATE subscribers SET stats_sent = stats_sent + 1 WHERE id IN ($idPlaceholders) AND workspace_id = ?")->execute(array_merge($successIds, [$workspace_id]));
                        }

                        // 3. Flow Enrollments
                        if (!empty($flowEnrollments)) {
                            $vals = [];
                            $binds = [];
                            $fidStats = [];
                            foreach ($flowEnrollments as $en) {
                                $binds[] = "(?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())";
                                $vals = array_merge($vals, [$workspace_id, $en['sid'], $en['cid'] ?? null, $en['fid'], $en['step'], $en['step_type'] ?? 'unknown', $en['schedule']]);
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
                                (workspace_id, subscriber_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at) 
                                VALUES " . implode(',', $binds) . "
                                ON DUPLICATE KEY UPDATE
                                    step_id      = IF(status NOT IN ('waiting','processing'), VALUES(step_id), step_id),
                                    step_type    = IF(status NOT IN ('waiting','processing'), VALUES(step_type), step_type),
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
                                    $actualIncrement = (count($fidStats) === 1) ? min($count, (int)ceil($affected / 2)) : $count; 
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

                        $batchAttempts = count($sentClaimKeys) + count($failClaimKeys) + count($skipClaimKeys);
                        if ($batchAttempts === 0) {
                            $batchAttempts = count($successIds) + count($failActivities);
                        }
                        $sentThisRun += count($successIds);
                        $totalProcessed += $batchAttempts;
                        if ($abortedExternally || count($recipients) < $BATCH_SIZE) {
                            $hasMore = false;
                        }

                        // Keep-alive / progress log
                        if ($totalProcessed > 0 && ($batchCount % 1 === 0)) {
                            $elapsed = microtime(true) - $startTimeRun;
                            $speed = round($totalProcessed / max(0.01, $elapsed), 1);
                            writeWorkerLog("Campaign $cid ({$lockKey}): Batch #{$batchCount} committed (runProcessed={$totalProcessed}, runSent={$sentThisRun}, speed={$speed} m/s).");
                        }

                        // [OPTIMIZATION] Explicit Garbage Collection (Zero-Leak Memory Profile)
                        unset($recipients, $successIds, $failActivities, $successActivities, $flowEnrollments, $jobDispatches, $capCache, $enrollmentCache, $lockBinds, $lockVals, $allActivitiesGrouped, $binds, $vals, $subIdList, $placeholdersSub, $claimedBatchKeys, $sentClaimKeys, $failClaimKeys, $skipClaimKeys);
                        gc_collect_cycles();
                        
                    } catch (Throwable $e) {
                        if ($pdo->inTransaction()) {
                            $pdo->rollBack();
                        }
                        $logs[] = "[ERROR] Batch failed: " . $e->getMessage();
                        writeWorkerLog("[ERROR] Campaign $cid ({$lockKey}) Batch failed: " . $e->getMessage());
                        break;
                    }
                }

                // Final Status Check
                if (function_exists('ensure_pdo_alive')) {
                    ensure_pdo_alive($pdo);
                }

                // Only sweep campaign-wide stale processing locks in single-worker mode (multi-shard already cleaned its batch!)
                if ($numShards <= 1) {
                    $pdo->prepare("UPDATE subscriber_activity SET type = 'released_campaign' WHERE campaign_id = ? AND workspace_id = ? AND type = 'processing_campaign'")->execute([$cid, $workspace_id]);
                }

                // CRITICAL PAUSE GUARD: Re-read live status BEFORE checking remaining or spawning follow-ups!
                $stmtCurStatusEnd = $pdo->prepare("SELECT status FROM campaigns WHERE id = ? LIMIT 1");
                $stmtCurStatusEnd->execute([$cid]);
                $liveStatusEnd = strtolower((string)$stmtCurStatusEnd->fetchColumn());

                if ($abortedExternally || $liveStatusEnd !== 'sending') {
                    $logs[] = "[Campaign {$cid}] ({$lockKey}) Stopped cleanly (external status: '{$liveStatusEnd}'). Skipping completion check and follow-up spawn.";
                    writeWorkerLog("Campaign $cid ({$lockKey}): Aborted/paused cleanly (live status='{$liveStatusEnd}'). NO follow-up spawned.");
                } else {
                    $pdo->beginTransaction();

                    // Build accurate deduplicated remaining query
                    $remWhere = "s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND s.deleted_at IS NULL";
                    $remParams = [$workspace_id];
                    if ($campaignType === 'zalo_zns') {
                        $remWhere .= " AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                    } else {
                        $remWhere .= " AND (s.email IS NOT NULL AND TRIM(s.email) != '')";
                    }
                    if (!empty($wheres)) {
                        $remWhere .= " AND (" . implode(' OR ', $wheres) . ")";
                        $remParams = array_merge($remParams, $queryBaseParams);
                    }
                    if ($claimsTableAvailable && $campaignType !== 'zalo_zns') {
                        $remWhere .= " AND NOT EXISTS (
                            SELECT 1 FROM campaign_send_claims csc
                            WHERE csc.campaign_id = ? AND csc.channel = 'email'
                              AND csc.recipient_key = LOWER(TRIM(s.email))
                              AND csc.status IN ('sent', 'failed', 'skipped')
                        )";
                        $remParams[] = $cid;
                    }
                    if ($campaignType !== 'zalo_zns') {
                        $remWhere .= " AND NOT EXISTS (
                            SELECT 1 FROM mail_delivery_logs mdl
                            WHERE mdl.campaign_id = ? AND mdl.deleted_at IS NULL
                              AND mdl.status = 'success'
                              AND mdl.recipient = s.email
                        )";
                        $remParams[] = $cid;
                    }
                    $remWhere .= " AND NOT EXISTS (
                        SELECT 1 FROM subscriber_activity sa
                        WHERE sa.workspace_id = ? AND sa.subscriber_id = s.id AND sa.campaign_id = ?
                        AND sa.type IN ('receive_email', 'failed_email', 'skipped_email', 'zalo_sent', 'meta_sent', 'zns_sent', 'zns_failed', 'enter_flow')
                    )";
                    $remParams[] = $workspace_id;
                    $remParams[] = $cid;

                    $countDistinctExpr = ($campaignType === 'zalo_zns')
                        ? "COUNT(DISTINCT COALESCE(NULLIF(s.phone_norm9, ''), s.phone_number))"
                        : "COUNT(DISTINCT LOWER(TRIM(s.email)))";

                    $sqlLeft = "SELECT {$countDistinctExpr} FROM subscribers s WHERE {$remWhere}";
                    $stmtLeft = $pdo->prepare($sqlLeft);
                    $stmtLeft->execute(array_values($remParams));
                    $remaining = (int) $stmtLeft->fetchColumn();

                    // Also check remaining specifically in THIS shard (when multi-shard)
                    $shardRemaining = $remaining;
                    if ($remaining > 0 && $campaignType !== 'zalo_zns' && $numShards > 1) {
                        $shardWhere = $remWhere . " AND MOD(CRC32(LOWER(TRIM(s.email))), ?) = ?";
                        $shardParams = array_merge($remParams, [$numShards, $shardId]);
                        $stmtShardLeft = $pdo->prepare("SELECT {$countDistinctExpr} FROM subscribers s WHERE {$shardWhere}");
                        $stmtShardLeft->execute(array_values($shardParams));
                        $shardRemaining = (int) $stmtShardLeft->fetchColumn();
                    }

                    $shouldTriggerFollowUp = false;
                    $nextRetry = 0;

                    if ($remaining === 0) {
                        // Coordinate completion update cleanly — re-verify status is still 'sending'
                        $pdo->commit();
                        $stmtFinLock = $pdo->prepare("SELECT GET_LOCK(?, 2)");
                        $stmtFinLock->execute(["campaign_coordinator_" . $cid]);
                        $pdo->beginTransaction();

                        // Sync accurate unique count_sent before marking sent (wait briefly for any sibling shard finalizing its final commit)
                        if ($campaignType === 'zalo_zns') {
                            $pdo->prepare("UPDATE campaigns SET status = 'sent', count_sent = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_activity WHERE workspace_id = ? AND campaign_id = ? AND type IN ('zalo_sent', 'meta_sent', 'zns_sent')), updated_at = NOW() WHERE id = ? AND workspace_id = ? AND status = 'sending'")
                                ->execute([$workspace_id, $cid, $cid, $workspace_id]);
                        } else {
                            if ($hasClaimsTable) {
                                for ($w = 0; $w < 6; $w++) {
                                    $stProc = $pdo->prepare("SELECT COUNT(*) FROM campaign_send_claims WHERE campaign_id = ? AND channel = ? AND status = 'processing'");
                                    $stProc->execute([$cid, $campChannelType]);
                                    if ((int)$stProc->fetchColumn() === 0) break;
                                    usleep(300000);
                                }
                            }
                            $stmtUniqSent = $pdo->prepare("SELECT COUNT(DISTINCT LOWER(TRIM(recipient))) FROM mail_delivery_logs WHERE campaign_id = ? AND deleted_at IS NULL AND status = 'success' AND recipient IS NOT NULL AND TRIM(recipient) != ''");
                            $stmtUniqSent->execute([$cid]);
                            $finalUniqueSent = (int)$stmtUniqSent->fetchColumn();
                            if ($hasClaimsTable) {
                                $stmtClaimSent = $pdo->prepare("SELECT COUNT(*) FROM campaign_send_claims WHERE campaign_id = ? AND channel = ? AND status = 'sent' AND recipient_key != '__qa_sample__'");
                                $stmtClaimSent->execute([$cid, $campChannelType]);
                                $finalUniqueSent = max($finalUniqueSent, (int)$stmtClaimSent->fetchColumn());
                            }
                            $pdo->prepare("UPDATE campaigns SET status = 'sent', count_sent = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ? AND status = 'sending'")
                                ->execute([$finalUniqueSent, $cid, $workspace_id]);
                        }
                        $pdo->commit();
                        $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute(["campaign_coordinator_" . $cid]);

                        $logs[] = "[Campaign {$cid}] Finished. Status set to 'sent'.";
                        writeWorkerLog("Campaign $cid ({$lockKey}): Finished 100%. Status set to 'sent'.");
                    } else {
                        if ($shardRemaining > 0 && ($totalProcessed > 0 || $sentThisRun > 0)) {
                            // Forward progress resets retry counter so healthy large campaigns NEVER hit Circuit Breaker!
                            $nextRetry = ($sentThisRun > 0) ? 0 : ($retryCount + 1);
                            if ($sentThisRun === 0 && $nextRetry > $MAX_RETRIES) {
                                $curCfg = json_decode($campaign['config'] ?? '{}', true) ?: [];
                                $curCfg['pause_reason'] = 'circuit_breaker';
                                $curCfg['paused_at'] = date('Y-m-d H:i:s');
                                $pdo->prepare("UPDATE campaigns SET status = 'paused', config = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ? AND status = 'sending'")
                                    ->execute([json_encode($curCfg, JSON_UNESCAPED_UNICODE), $cid, $workspace_id]);
                                $errMsg = "[CIRCUIT BREAKER] Campaign $cid auto-paused after $MAX_RETRIES consecutive zero-progress retries with $remaining unsent recipients.";
                                $logs[] = $errMsg;
                                writeWorkerLog($errMsg);
                            } else {
                                $shouldTriggerFollowUp = true;
                                $logs[] = "[Campaign {$cid}] ({$lockKey}) Continuous mode: shardRemaining=$shardRemaining, totalRemaining=$remaining. Follow-up staged (retry #$nextRetry).";
                                writeWorkerLog("Campaign $cid ({$lockKey}): shardRemaining=$shardRemaining, totalRemaining=$remaining. Follow-up staged (retry #$nextRetry/$MAX_RETRIES).");
                            }
                        } else {
                            $logs[] = "[Campaign {$cid}] ({$lockKey}) Shard finished or yielding (shardRemaining=$shardRemaining, totalRemaining=$remaining).";
                            writeWorkerLog("Campaign $cid ({$lockKey}) finished/yielding (shardRemaining=$shardRemaining, totalRemaining=$remaining).");
                        }
                        $pdo->commit();
                    }

                    // Spawn follow-up ONLY AFTER transaction commit AND ONLY if campaign is STILL 'sending'!
                    if ($shouldTriggerFollowUp) {
                        $stmtReverify = $pdo->prepare("SELECT status FROM campaigns WHERE id = ? LIMIT 1");
                        $stmtReverify->execute([$cid]);
                        if (strtolower((string)$stmtReverify->fetchColumn()) === 'sending') {
                            $phpBinFollow = function_exists('exec') ? findAutomationPhpCli() : null;
                            if ($phpBinFollow) {
                                $cmdFollow = sprintf(
                                    'nohup %s %s %s %d %d %d >/dev/null 2>&1 &',
                                    escapeshellarg($phpBinFollow),
                                    escapeshellarg(__FILE__),
                                    escapeshellarg($cid),
                                    $nextRetry,
                                    $shardId,
                                    $numShards
                                );
                                @exec($cmdFollow);
                            } else {
                                triggerAsyncWorker("/worker_campaign.php?campaign_id={$cid}&retry_count={$nextRetry}&shard={$shardId}&shards={$numShards}");
                            }
                            writeWorkerLog("Campaign $cid ({$lockKey}): Spawned follow-up worker (retry #$nextRetry).");
                        } else {
                            writeWorkerLog("Campaign $cid ({$lockKey}): Suppressed follow-up spawn because status changed from 'sending'.");
                        }
                    }
                }
            } catch (Throwable $e) {
                if (function_exists('ensure_pdo_alive')) {
                    ensure_pdo_alive($pdo);
                }
                if ($pdo && $pdo->inTransaction()) {
                    try { $pdo->rollBack(); } catch (Throwable $rbEx) {}
                }
                $logs[] = "[ERROR] Campaign {$cid} failed: " . $e->getMessage();
                writeWorkerLog("[FATAL ERROR] Campaign $cid ({$lockKey}) failed: " . $e->getMessage());
                if ($numShards <= 1) {
                    try {
                        $errCfg = json_decode($campaign['config'] ?? '{}', true) ?: [];
                        $errCfg['pause_reason'] = 'circuit_breaker';
                        $errCfg['paused_at'] = date('Y-m-d H:i:s');
                        $pdo->prepare("UPDATE campaigns SET status = 'paused', config = ? WHERE id = ? AND status = 'sending'")
                            ->execute([json_encode($errCfg, JSON_UNESCAPED_UNICODE), $cid]);
                    } catch (Throwable $upEx) {}
                }
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

// When run as standalone script (cron/CLI/direct HTTP), execute immediately
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $cliCampaignId = isset($argv[1]) && $argv[1] !== '' ? $argv[1] : null;
    $cliRetry      = isset($argv[2]) && is_numeric($argv[2]) ? (int)$argv[2] : null;
    $cliShard      = isset($argv[3]) && is_numeric($argv[3]) ? (int)$argv[3] : null;
    $cliShards     = isset($argv[4]) && is_numeric($argv[4]) ? (int)$argv[4] : null;
    runWorkerCampaign(
        $pdo,
        $_GET['campaign_id'] ?? $cliCampaignId,
        $_GET['shard'] ?? $cliShard,
        $_GET['shards'] ?? $cliShards,
        $_GET['retry_count'] ?? $cliRetry
    );
}
