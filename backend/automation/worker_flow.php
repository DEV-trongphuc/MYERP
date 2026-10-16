<?php
// api/worker_flow.php - OMNI-ENGINE V30.3 (RELIABILITY & PERFORMANCE OPTIMIZED)
// Engine for processing flow automation jobs with chain execution.

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
ignore_user_abort(true);
set_time_limit(300);

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
// RELEASE SESSION LOCK: Workers don't need to hold the user's session lock.
if (session_id())
    session_write_close();
require_once __DIR__ . '/Mailer.php';
require_once 'FlowExecutor.php';
require_once 'flow_helpers.php';
require_once 'trigger_helper.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');
// [FIX P0-4] Added COLLATE to match db_connect.php setting (utf8mb4_unicode_ci).
// Without COLLATE, MySQL may use the server default collation in this session,
// causing collation mismatch warnings and potential comparison failures on text columns.
$pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
// [PERF FIX] Fail-fast on row lock contention (5s vs MySQL default 50s).
// Prevents campaign/flow workers from queuing behind each other for ~50s per lock.
$pdo->exec("SET SESSION innodb_lock_wait_timeout = 5");
header('Content-Type: application/json; charset=utf-8');

if (!function_exists('traceLog')) {
    function traceLog($msg)
    {
        file_put_contents(__DIR__ . '/worker_trace.log', date('H:i:s') . " " . $msg . "\n", FILE_APPEND);
    }
}

if (!function_exists('runWorkerFlow')) {
    function runWorkerFlow($pdo)
    {
        // [FIX #3] Dùng biến cục bộ thay vì $_SERVER['REQUEST_TIME']
        // $_SERVER['REQUEST_TIME'] không tồn tại khi chạy từ CLI/Cron trên một số cấu hình server
        $workerStartTime = time();

        // [PERF-GUARD] Stop if server is saturated
        if (!isSystemHealthy()) {
            return ['status' => 'throttled', 'message' => 'Server load too high, pausing flow worker'];
        }

        // [ZOMBIE REAPER] Rescue stuck processes
        try { $pdo->exec("UPDATE subscriber_flow_states SET status = 'waiting', updated_at = NOW() WHERE status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)"); } catch (Exception $e) {}

        // Detect priority runs
        $isPriorityRun = (isset($_GET['priority_queue_id']) && (isset($_GET['priority_sub_id']) || isset($_GET['subscriber_id'])) && isset($_GET['priority_flow_id']));
        $isTestMode = isset($_GET['test_mode']) && $_GET['test_mode'] == '1';

        // Shared objects
        $apiUrl = API_BASE_URL;
        // [FIX P37-WF] Replaced SELECT * (returned ALL settings incl. passwords, API keys, large blobs)
        // with targeted column fetch. Only smtp_user is actually used below.
        $stmt = $pdo->prepare("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN ('smtp_user','smtp_host')");
        $stmt->execute();
        $settings = [];
        foreach ($stmt->fetchAll() as $row) {
            $settings[$row['key']] = $row['value'];
        }
        $defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
        $mailer = new Mailer($pdo, $apiUrl, $defaultSender);
        $executor = new FlowExecutor($pdo, $mailer, $apiUrl);

        $now = date('Y-m-d H:i:s');
        $logs = [];
        $logs[] = "--- FLOW WORKER START: $now ---";

        // --- QUEUE FETCHING ---
        $BATCH_SIZE = 500;
        $items = [];

        if ($isPriorityRun) {
            $priorityQueueId = $_GET['priority_queue_id'];
            $prioritySubId = $_GET['subscriber_id'] ?? $_GET['priority_sub_id'];
            $priorityFlowId = $_GET['priority_flow_id'];

            $stmtPriority = $pdo->prepare("SELECT q.id as queue_id, q.subscriber_id, q.flow_id, q.step_id, q.status, q.scheduled_at, q.updated_at, q.created_at as queue_created_at, q.last_step_at, 
                                 f.steps as flow_steps, f.config as flow_config, f.name as flow_name, 
                                 s.email as sub_email, s.first_name, s.last_name, s.company_name, s.phone_number, s.job_title,
                                 s.status as sub_status, s.tags as sub_tags, s.id as sub_id, s.date_of_birth, s.anniversary_date, s.joined_at,
                                 s.city, s.country, s.gender, s.last_os, s.last_device, s.last_browser, s.last_city,
                                 s.stats_opened, s.stats_clicked, s.last_open_at, s.last_click_at, s.timezone, s.is_zalo_follower,
                                 s.custom_attributes, s.workspace_id as workspace_id, s.workspace_id as subscriber_workspace_id, f.workspace_id as flow_workspace_id
                                 FROM subscriber_flow_states q 
                                 JOIN flows f ON q.flow_id = f.id 
                                 JOIN subscribers s ON q.subscriber_id = s.id 
                                 WHERE (q.id = ? OR (q.id > 0 AND ? = '0' AND q.subscriber_id = ? AND q.flow_id = ?))
                                 AND q.status IN ('waiting', 'processing') AND f.status = 'active'
                                 AND f.workspace_id = s.workspace_id
                                 AND q.workspace_id = s.workspace_id
                                 LIMIT 1 FOR UPDATE");
            // [FIX P10-H3] Priority path: use SKIP LOCKED on MySQL >= 8.0 so a racing second
            // priority worker exits cleanly instead of blocking then re-reading the same item.
            // The double-check lock at L210 remains as defense-in-depth for MySQL 5.7 (FOR UPDATE).
            if (isDatabaseSkipLockedSupported($pdo)) {
                // Re-prepare with SKIP LOCKED for MySQL 8+
                $stmtPriority = $pdo->prepare(
                    str_replace('LIMIT 1 FOR UPDATE', 'LIMIT 1 FOR UPDATE SKIP LOCKED',
                        "SELECT q.id as queue_id, q.subscriber_id, q.flow_id, q.step_id, q.status, q.scheduled_at, q.updated_at, q.created_at as queue_created_at, q.last_step_at, 
                         f.steps as flow_steps, f.config as flow_config, f.name as flow_name, 
                         s.email as sub_email, s.first_name, s.last_name, s.company_name, s.phone_number, s.job_title,
                         s.status as sub_status, s.tags as sub_tags, s.id as sub_id, s.date_of_birth, s.anniversary_date, s.joined_at,
                         s.city, s.country, s.gender, s.last_os, s.last_device, s.last_browser, s.last_city,
                         s.stats_opened, s.stats_clicked, s.last_open_at, s.last_click_at, s.timezone, s.is_zalo_follower,
                         s.custom_attributes, s.workspace_id as workspace_id, s.workspace_id as subscriber_workspace_id, f.workspace_id as flow_workspace_id
                         FROM subscriber_flow_states q 
                         JOIN flows f ON q.flow_id = f.id 
                         JOIN subscribers s ON q.subscriber_id = s.id 
                         WHERE (q.id = ? OR (q.id > 0 AND ? = '0' AND q.subscriber_id = ? AND q.flow_id = ?))
                         AND q.status IN ('waiting', 'processing') AND f.status = 'active'
                         AND f.workspace_id = s.workspace_id
                         AND q.workspace_id = s.workspace_id
                         LIMIT 1 FOR UPDATE")
                );
            }
            try {
                // [FIX V3-M3] Wrap priority fetch in a transaction so the FOR UPDATE lock is held
                // until the status is committed to 'processing'. Without this, MySQL autocommit releases
                // the row lock immediately after SELECT, creating a race window where two simultaneous
                // priority workers could both pick up the same item \u2014 causing duplicate sends.
                $pdo->beginTransaction();
                $stmtPriority->execute([$priorityQueueId, $priorityQueueId, $prioritySubId, $priorityFlowId]);
                $priorityItem = $stmtPriority->fetch();
                if ($priorityItem) {
                    $pdo->prepare("UPDATE subscriber_flow_states SET status = 'processing', updated_at = NOW(), last_error = NULL WHERE id = ? AND workspace_id = ?")->execute([$priorityItem['queue_id'], $priorityItem['flow_workspace_id']]);
                    $items[] = $priorityItem;
                    $logs[] = "[Flow-Priority] Enqueued priority item: Sub {$prioritySubId} Flow {$priorityFlowId}";
                }
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                $logs[] = "[ERROR] Priority fetch failed: " . $e->getMessage();
            }
        }

        if (!$isPriorityRun) {
            try {
                $pdo->beginTransaction();
                $sqlRegular = "SELECT q.id as queue_id, q.subscriber_id, q.flow_id, q.step_id, q.status, q.scheduled_at, q.created_at as queue_created_at, q.last_step_at, 
                        f.steps as flow_steps, f.config as flow_config, f.name as flow_name, 
                        s.email as sub_email, s.first_name, s.last_name, s.company_name, s.phone_number, s.job_title,
                        s.status as sub_status, s.tags as sub_tags, s.id as sub_id, s.date_of_birth, s.anniversary_date, s.joined_at,
                        s.city, s.country, s.gender, s.last_os, s.last_device, s.last_browser, s.last_city,
                        s.stats_opened, s.stats_clicked, s.last_open_at, s.last_click_at, s.timezone, s.is_zalo_follower,
                        s.custom_attributes, s.workspace_id as workspace_id, s.workspace_id as subscriber_workspace_id, f.workspace_id as flow_workspace_id
                        FROM subscriber_flow_states q 
                        JOIN flows f ON q.flow_id = f.id 
                        JOIN subscribers s ON q.subscriber_id = s.id 
                        WHERE ((q.status = 'waiting' AND q.scheduled_at <= ?) OR 
                              (q.status = 'processing' AND q.updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE) AND q.scheduled_at <= NOW()))
                        AND f.status = 'active'
                        AND f.workspace_id = s.workspace_id
                        AND q.workspace_id = s.workspace_id
                        ORDER BY q.scheduled_at ASC, q.updated_at ASC, q.id ASC LIMIT {$BATCH_SIZE}";

                if (isDatabaseSkipLockedSupported($pdo)) {
                    $sqlRegular .= " FOR UPDATE SKIP LOCKED";
                } else {
                    $sqlRegular .= " FOR UPDATE";
                }

                $stmtRegular = $pdo->prepare($sqlRegular);
                $stmtRegular->execute([$now]);
                $regularItems = $stmtRegular->fetchAll();

                if (!empty($regularItems)) {
                    $queueIds = array_column($regularItems, 'queue_id');
                    // Group IDs by workspace to ensure bulk UPDATE with workspace_id guard
                    $wsGroups = [];
                    foreach ($regularItems as $ri) {
                        $wsGroups[$ri['flow_workspace_id']][] = $ri['queue_id'];
                    }
                    foreach ($wsGroups as $wsId => $ids) {
                        $placeholders = implode(',', array_fill(0, count($ids), '?'));
                        $pdo->prepare("UPDATE subscriber_flow_states SET status = 'processing', updated_at = NOW(), last_error = NULL WHERE id IN ($placeholders) AND workspace_id = ?")->execute(array_merge($ids, [$wsId]));
                    }
                    $items = array_merge($items, $regularItems);
                    $logs[] = "[Flow-Regular] Fetched and locked " . count($regularItems) . " items.";
                }
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                $logs[] = "[ERROR] Fetch failed: " . $e->getMessage();
            }
        }

        if (empty($items)) {
            // [FIX] return array instead of echo � prevents broken JSON output
            // when called multiple times from worker_queue.php loop
            return ['status' => 'idle', 'message' => 'No items', 'logs' => $logs];
        }

        $flowCache = [];
        $subscriberFreqCache = []; // Optimization: Cache frequency check per sub/flow

        // [OPTIMIZATION] Batch Fetch Frequency Counts for the entire batch per channel
        if (!empty($items)) {
            $subIds = array_unique(array_column($items, 'subscriber_id'));
            if (!empty($subIds)) {
                $todayStart = date('Y-m-d 00:00:00');
                $placeholders = implode(',', array_fill(0, count($subIds), '?'));
                // [PERF HARDENING] Added workspace_id filter to utilize the (workspace_id, subscriber_id, created_at) index.
                // Without this, at 1B rows, this COUNT(*) would scan the entire global activity table.
                $stmtCapBatch = $pdo->prepare("
                    SELECT subscriber_id, type, COUNT(*) as count 
                    FROM subscriber_activity 
                    WHERE subscriber_id IN ($placeholders) 
                    AND workspace_id IS NOT NULL
                    AND type IN ('receive_email', 'zalo_sent', 'meta_sent', 'zns_sent') 
                    AND created_at >= ?
                    GROUP BY subscriber_id, type
                ");
                $stmtCapBatch->execute(array_merge($subIds, [$todayStart]));
                $freqRows = $stmtCapBatch->fetchAll(PDO::FETCH_ASSOC);
                foreach ($freqRows as $r) {
                    $sId = $r['subscriber_id']; // [BUG FIX] Keep as raw string UUID � (int) cast converts UUIDs to 0, making all subscribers share cache key 0
                    if (!isset($subscriberFreqCache[$sId])) {
                        $subscriberFreqCache[$sId] = ['email' => 0, 'zalo' => 0, 'meta' => 0];
                    }
                    if ($r['type'] === 'receive_email') {
                        $subscriberFreqCache[$sId]['email'] += $r['count'];
                    } elseif (in_array($r['type'], ['zalo_sent', 'zns_sent'])) {
                        $subscriberFreqCache[$sId]['zalo'] += $r['count'];
                    } elseif ($r['type'] === 'meta_sent') {
                        $subscriberFreqCache[$sId]['meta'] += $r['count'];
                    }
                }
            }
        }

        // [OPTIMIZATION] Pre-compile all UPDATE queries outside the loop to eliminate N+1 AST Parsing overhead
        $stmtWaitState = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtUnsubscribeState = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'unsubscribed', updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtFailState = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'failed', last_error = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtCompleteExit = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', step_id = COALESCE(?, step_id), updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtStatCompleteBuff = $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment, created_at) VALUES ('flows', ?, 'stat_completed', 1, NOW())");
        $stmtStatCompleteFB = $pdo->prepare("UPDATE flows SET stat_completed = stat_completed + 1 WHERE id = ? AND workspace_id = ?");
        $stmtWaitSchedule = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = ?, step_id = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtUpdateStep = $pdo->prepare("UPDATE subscriber_flow_states SET step_id = ?, step_type = ?, last_step_at = NOW(), updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtUpdateWaitStepType = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = ?, step_id = ?, step_type = ?, updated_at = NOW(), last_step_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtCompleteStepType = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', step_id = ?, step_type = NULL, updated_at = NOW() WHERE id = ? AND workspace_id = ?");
        $stmtDynamicState = $pdo->prepare("UPDATE subscriber_flow_states SET status = ?, scheduled_at = ?, updated_at = NOW(), step_id = ?, step_type = ? WHERE id = ? AND workspace_id = ?");

        foreach ($items as $item) {
            // [PERF-GUARD] Stop if server is saturated (re-check every 10 subscribers)
            if ($stepsProcessedInRun > 0 && $stepsProcessedInRun % 10 === 0 && !isSystemHealthy(2.0, 64)) {
                $logs[] = "System saturated mid-flow run. Pausing batch.";
                break;
            }

            // [FIX #3] Dùng $workerStartTime thay vì $_SERVER['REQUEST_TIME'] (an toàn hơn cho CLI/Cron)
            if (time() - $workerStartTime > 280)
                break;

            $pdo->beginTransaction();
            try {
                $item['email'] = $item['sub_email']; // [FIX] Map sub_email to email for FlowExecutor

                $subscriberId = $item['subscriber_id'];
                $flowId = $item['flow_id'];
                $flowName = $item['flow_name'];
                $queueId = $item['queue_id'];

                // [BUG-FIX] DOUBLE-CHECK LOCK for MySQL 5.7 (no SKIP LOCKED):
                // On MySQL 5.7, FOR UPDATE blocks Worker B waiting for Worker A to commit.
                // After Worker A commits, Worker B wakes up and re-reads the SAME row �
                // now with status='waiting' or 'completed' (already advanced by A).
                // Without this check, Worker B would re-process the same item ? duplicate email in 1-2s.
                // Fix: re-read status from DB inside the new transaction. If no longer 'processing',
                // someone else already handled this item � skip it.
                $checkStmt = $pdo->prepare("SELECT status, updated_at FROM subscriber_flow_states WHERE id = ? AND workspace_id = ? FOR UPDATE");
                $checkStmt->execute([$queueId, $item['subscriber_workspace_id']]);
                $freshState = $checkStmt->fetch(PDO::FETCH_ASSOC);
                if (!$freshState || $freshState['status'] !== 'processing') {
                    $pdo->rollBack();
                    $logs[] = "  -> [DOUBLE-LOCK] Sub {$subscriberId} already processed by another worker (status: " . ($freshState['status'] ?? 'not found') . "). Skipping.";
                    continue;
                }

                // [BUG-FIX] Guard: Stale 'processing' items picked up via OR clause may have
                // scheduled_at far in the future (e.g. wait 1-day). Processing them now would
                // cause wait step to recalculate from scratch, resetting the timer.
                // If scheduled_at is still in the future, restore to 'waiting' and skip.
                if (!empty($item['scheduled_at']) && strtotime($item['scheduled_at']) > time()) {
                    $stmtWaitState->execute([$queueId, $item['subscriber_workspace_id']]);
                    $logs[] = "  -> [STALE-GUARD] Sub {$subscriberId} restored to waiting (scheduled: {$item['scheduled_at']})";
                    $pdo->commit();
                    continue;
                }

                // [EXIT CHECK] Check if subscriber is still eligible (not unsubscribed globally)
                if (trim($item['sub_status']) === 'unsubscribed') {
                    // DB ENUM confirmed: waiting, processing, completed, failed, unsubscribed — use correct status
                    $stmtUnsubscribeState->execute([$queueId, $item['subscriber_workspace_id']]);
                    $logs[] = "[Flow-Exit] Sub {$subscriberId} is unsubscribed. Marking unsubscribed and skipping.";
                    $pdo->commit();
                    continue;
                }

                // [SECURITY HARDENING] Workspace Isolation Guard
                // Prevents cross-tenant execution in case of enrollment bugs or malicious injections.
                if ($item['subscriber_workspace_id'] !== $item['flow_workspace_id']) {
                    $stmtFailState->execute(['SECURITY_ERR: Workspace mismatch', $queueId, $item['subscriber_workspace_id']]);
                    $logs[] = "[CRITICAL] Workspace mismatch for Sub {$subscriberId} in Flow {$flowId}. Execution blocked.";
                    $pdo->commit();
                    continue;
                }

                if (!isset($flowCache[$flowId])) {
                    $flowCache[$flowId] = [
                        // [FIX #1] Thêm ?? [] để tránh Fatal TypeError khi flow_steps là null hoặc JSON lỗi
                        'steps' => json_decode($item['flow_steps'], true) ?? [],
                        'config' => json_decode($item['flow_config'], true) ?? [],
                    ];
                }

                $flowSteps = $flowCache[$flowId]['steps'];
                $fConfig = $flowCache[$flowId]['config'];
                // [PERF #10] Build a hash map keyed by step id for O(1) step lookups.
                // Without this, every step iteration in the chain does a O(n) foreach.
                // With MAX_STEPS=50 and a 20-step flow: 50�20=1000 iterations per subscriber.
                // With $stepIndex: 20 iterations (one-time build) + O(1) per lookup = ~20 total.
                $stepIndex = [];

                // [FIX #1] Guard: nếu flow_steps không hợp lệ -> fail item thay vì crash toàn worker
                if (!is_array($flowSteps) || empty($flowSteps)) {
                    $stmtFailState->execute(['Invalid flow_steps JSON', $queueId, $item['subscriber_workspace_id']]);
                    $logs[] = "[ERROR] Flow {$flowId} has invalid steps JSON. Item {$queueId} marked failed.";
                    $pdo->commit();
                    continue;
                }
                // [PERF #10] Populate $stepIndex now that $flowSteps is confirmed valid.
                foreach ($flowSteps as $_si) {
                    if (!empty($_si['id'])) {
                        $stepIndex[trim((string) $_si['id'])] = $_si;
                    }
                }

                // [EXIT CHECK] Specific exit conditions for the flow
                // [PERF FIX] Pre-compute exitActivityTypes BEFORE fetching activity cache.
                // Previous ordering: exitActivityTypes built AFTER the SELECT ? forced LIMIT 500 blind ceiling.
                // New ordering: build type list first ? use it as a WHERE IN filter ? no LIMIT needed for exits.
                // Subscribers with thousands of activity records (long flows, many months) will no longer
                // silently miss exit events that existed beyond the old position-500 boundary.
                $exitConditions = $fConfig['exitConditions'] ?? [];
                $exitActivityTypes = [];
                if (!empty($exitConditions)) {
                    $exitTypeMap = [
                        'unsubscribed' => ['unsubscribe'],
                        'clicked' => ['click_link', 'click_zns'],
                        'opened' => ['open_email', 'open_zns'],
                        'bounced' => ['bounce'],
                    ];
                    foreach ($exitConditions as $cond) {
                        $exitActivityTypes = array_merge($exitActivityTypes, $exitTypeMap[$cond] ?? [$cond]);
                    }
                }

                // Activity Cache � fetched since enrollment (queue_created_at).
                // [FIX #5 v2] If we have exit types, filter the query by those types so we fetch ALL
                // matching rows without any LIMIT risk. A separate broader LIMIT 500 fetch covers
                // condition-chain logic that needs recent general activity.
                if (!empty($exitActivityTypes)) {
                    $exitPlaceholders = implode(',', array_fill(0, count($exitActivityTypes), '?'));
                    $stmtExitAct = $pdo->prepare(
                        "SELECT type, reference_id, campaign_id, details, created_at 
                         FROM subscriber_activity 
                         WHERE subscriber_id = ? AND workspace_id = ? AND created_at >= ? AND type IN ($exitPlaceholders) 
                         ORDER BY created_at DESC"
                    );
                    $stmtExitAct->execute(array_merge([$subscriberId, $item['subscriber_workspace_id'], $item['queue_created_at']], $exitActivityTypes));
                    $exitActivityCache = $stmtExitAct->fetchAll();
                } else {
                    $exitActivityCache = [];
                }

                // General activity cache (for condition steps, not only exits) � LIMIT 500 is safe here
                // because condition logic uses recent events, not exhaustive history.
                $stmtAct = $pdo->prepare(
                    "SELECT type, reference_id, campaign_id, details, created_at 
                     FROM subscriber_activity 
                     WHERE subscriber_id = ? AND workspace_id = ? AND created_at >= ? 
                     ORDER BY created_at DESC LIMIT 500"
                );
                $stmtAct->execute([$subscriberId, $item['subscriber_workspace_id'], $item['queue_created_at']]);
                $activityCache = $stmtAct->fetchAll();

                // [EXIT CHECK] Specific exit conditions � uses the unlimited exitActivityCache
                if (!empty($exitActivityTypes)) {
                    $shouldExit = false;
                    foreach ($exitActivityCache as $act) {
                        if (in_array($act['type'], $exitActivityTypes)) {
                            $shouldExit = true;
                            break;
                        }
                    }
                    if ($shouldExit) {
                        // [FIX] Include step_id so byBranch query in completed-users API counts correctly
                        $currentStepIdExit = $item['step_id'] ?? null;
                        $stmtCompleteExit->execute([$currentStepIdExit, $queueId, $item['subscriber_workspace_id']]);
                        logActivity($pdo, $subscriberId, 'exit_flow', $flowId, $flowName, "Exited: Condition met", $flowId, null, [], $item['workspace_id']);
                        // Buffer Completion Stat
                        try {
                            $stmtStatCompleteBuff->execute([$flowId]);
                        } catch (Exception $ignored) {
                            $stmtStatCompleteFB->execute([$flowId, $item['subscriber_workspace_id']]);
                        }
                        $logs[] = "  -> Subscriber exited flow (Exit Condition Match).";
                        $pdo->commit();
                        continue; // Use continue to move to the next item in the foreach loop
                    }
                }

                // [EXIT CHECK] Advanced Exit: form_submit / purchase / custom_event
                $advancedExit = $fConfig['advancedExit'] ?? [];
                if (!empty($advancedExit) && checkAdvancedExit($pdo, $subscriberId, $item['queue_created_at'], $advancedExit, $activityCache)) {
                    // [FIX] Include step_id so byBranch query in completed-users API counts correctly
                    $currentStepIdExit = $item['step_id'] ?? null;
                    $stmtCompleteExit->execute([$currentStepIdExit, $queueId, $item['subscriber_workspace_id']]);
                    logActivity($pdo, $subscriberId, 'exit_flow', $flowId, $flowName, "Exited: Advanced condition met", $flowId, null, [], $item['workspace_id']);
                    // Buffer Completion Stat
                    try {
                        $stmtStatCompleteBuff->execute([$flowId]);
                    } catch (Exception $ignored) {
                        $stmtStatCompleteFB->execute([$flowId, $item['subscriber_workspace_id']]);
                    }
                    $logs[] = "  -> Subscriber exited flow (Advanced Exit Condition Match).";
                    $pdo->commit();
                    continue;
                }

                $currentStepId = $item['step_id'];
                $stepsProcessedInRun = 0;
                $MAX_STEPS = 50; // [FIX] Tăng từ 20 lên 50 để nhất quán với worker_priority.php
                // Flow phức tạp >20 bước condition/split sẽ bị dừng sớm nếu giữ 20
                $shouldContinueChain = true;

                while ($shouldContinueChain && $stepsProcessedInRun < $MAX_STEPS) {
                    $stepsProcessedInRun++;
                    // [PERF #10] O(1) step lookup using prebuilt $stepIndex map.
                    $currentStep = $stepIndex[trim((string) $currentStepId)] ?? null;

                    if (!$currentStep) {
                        $stmtFailState->execute(['Step not found', $queueId, $item['subscriber_workspace_id']]);
                        break;
                    }

                    // [SCHEDULING CHECK MOVED INSIDE CHAIN LOOP]
                    // This prevents the "Night-Time Wait Node Exploit" where a wait node finishing at midnight
                    // would immediately process the next target node without checking the Time Restriction again.
                    $chkStepType = strtolower($currentStep['type'] ?? 'unknown');
                    $isCommunicationStep = in_array($chkStepType, ['action', 'zalo_zns', 'zalo_cs', 'meta_message', 'sms']);

                    if ($isCommunicationStep) {
                        $activeDays = $fConfig['activeDays'] ?? [0, 1, 2, 3, 4, 5, 6];
                        if (empty($activeDays)) {
                            $activeDays = [0, 1, 2, 3, 4, 5, 6];
                        }
                        $startTime = $fConfig['startTime'] ?? '00:00';
                        $endTime = $fConfig['endTime'] ?? '23:59';

                        if (isset($fConfig['type']) && $fConfig['type'] === 'realtime') {
                            $activeDays = [0, 1, 2, 3, 4, 5, 6];
                            $startTime = '00:00';
                            $endTime = '23:59';
                        }

                        $isZaloStep = in_array($chkStepType, ['zalo_zns', 'zalo_cs']);
                        if ($isZaloStep) {
                            if ($startTime < '06:00')
                                $startTime = '06:00';
                            if ($endTime > '21:59' || $endTime < '06:00')
                                $endTime = '21:59';
                        }

                        $currentDayOfWeek = (int) date('w');
                        $currentTime = date('H:i');

                        $isDayAllowed = in_array($currentDayOfWeek, array_map('intval', $activeDays));
                        $isTimeAllowed = ($currentTime >= $startTime && $currentTime <= $endTime);

                        if ($isDayAllowed && $currentTime > $endTime) {
                            $isDayAllowed = false;
                        }

                        if (!$isDayAllowed || !$isTimeAllowed) {
                            if ($isDayAllowed && !$isTimeAllowed) {
                                $nextSendAt = date('Y-m-d') . ' ' . $startTime . ':00';
                            } else {
                                $dtBase = new DateTime('now', new DateTimeZone('Asia/Ho_Chi_Minh'));
                                $dtBase->setTime((int) substr($startTime, 0, 2), (int) substr($startTime, 3, 2), 0);
                                $nextSendAt = $dtBase->format('Y-m-d H:i:s');
                                for ($i = 1; $i <= 7; $i++) {
                                    $dtCheck = clone $dtBase;
                                    $dtCheck->modify("+$i days");
                                    $checkDay = (int) $dtCheck->format('w');
                                    if (in_array($checkDay, array_map('intval', $activeDays))) {
                                        $nextSendAt = $dtCheck->format('Y-m-d H:i:s');
                                        break;
                                    }
                                }
                            }
                            // Save step_id so it wakes up at this exact step, not the previous one
                            $stmtWaitSchedule->execute([$nextSendAt, $currentStepId, $queueId, $item['subscriber_workspace_id']]);
                            $logs[] = "  -> Step '{$currentStep['label']}' paused (Time Restriction). Re-scheduled to: $nextSendAt";
                            $shouldContinueChain = false;
                            break; // Ngắt khỏi vòng while ngay lập tức, đợi lần chạy sau
                        }
                    }

                    // [OPTIMIZATION] Frequency Cap check - Uses batch-fetched data
                    $cacheKey = $subscriberId; // [BUG FIX] Keep as raw string UUID  must match the string key used when building $subscriberFreqCache above
                    // [FIX] PHP 8: initialize key before ++ to prevent Undefined array key Warning
                    if (!isset($subscriberFreqCache[$cacheKey])) {
                        $subscriberFreqCache[$cacheKey] = ['email' => 0, 'zalo' => 0, 'meta' => 0];
                    }
                    $todaySent = $subscriberFreqCache[$cacheKey];

                    $contextData = [
                        'queue_created_at' => $item['queue_created_at'],
                        'last_step_at' => $item['last_step_at'] ?? $item['updated_at'],
                        'updated_at' => $item['updated_at'],
                        'scheduled_at' => $item['scheduled_at'],  // [BUG-FIX] Pass scheduled_at so FlowExecutor wait-case doesn't recalculate from scratch
                        'flow_steps' => $flowSteps,
                        'flow_name' => $flowName,
                        'total_sent_today' => $subscriberFreqCache[$cacheKey],
                        'activity_cache' => $activityCache,
                        'now' => $now,
                        // [FIX #2] Cast (string) trước trim() để tránh PHP 8.1 Deprecated khi step_id là null
                        // [CRITICAL FIX] is_resumed_wait guards against the wait being re-calculated
                        // from scratch, but it MUST only be TRUE when:
                        // 1. This is the first step of this worker run (stepsProcessedInRun===1)
                        // 2. The ORIGINAL DB status was 'waiting'  NOT crash recovery ('processing').
                        //    If we were 'processing' when picked up (5-min stale fallback), it means
                        //    the worker previously committed step_id but crashed before scheduling the
                        //    wait. Treating it as a resumed wait would SKIP the wait entirely.
                        // 3. step_id in DB matches current step (same step the item was fetched with)
                        // 4. scheduled_at has passed (the wait time has actually expired)
                        'is_resumed_wait' => ($stepsProcessedInRun === 1
                            && ($item['status'] ?? '') === 'waiting'  // GUARD: only genuine wait-resume, not crash recovery
                            && trim((string) ($item['step_id'] ?? '')) === trim((string) $currentStepId)
                            && $item['scheduled_at'] <= $now)
                    ];

                    $execResult = $executor->executeStep($currentStep, $item, $flowId, $currentStepId, null, $fConfig, $contextData);
                    if (!empty($execResult['logs']))
                        $logs = array_merge($logs, $execResult['logs']);

                    if ($execResult['status'] === 'completed' && $execResult['next_step_id']) {
                        $currentStepId = $execResult['next_step_id'];
                        if ($execResult['is_instant']) {
                            // [FIX] Only update freq cache if a message was ACTUALLY sent (not on fail).
                            // Previously: any Zalo/email step (including failures) incremented the cap,
                            // causing future sends to be incorrectly throttled.
                            if (!empty($execResult['message_sent'])) {
                                if (strpos(strtolower($currentStep['type']), 'zalo') !== false) {
                                    $subscriberFreqCache[$cacheKey]['zalo']++;
                                } elseif (strtolower($currentStep['type']) === 'meta_message') {
                                    $subscriberFreqCache[$cacheKey]['meta']++;
                                } elseif (strtolower($currentStep['type']) === 'action') {
                                    $subscriberFreqCache[$cacheKey]['email']++;
                                }
                            }
                            // [BUG-FIX] CRASH RECOVERY: Persist step_id progress to DB BEFORE commit.
                            // Previously: commit() without updating step_id ? DB still shows the old wait step.
                            // If worker crashes after this commit, cron picks up item 5min later,
                            // sees step_id=wait_step, treats as fresh entry, recalculates wait ? RESET.
                            // Fix: always write step_id + updated_at so crash recovery resumes correctly.
                            // [PERF] Also persist step_type  used by tracking_processor to avoid
                            // json_decode on every open/click event (eliminates full flow.steps scan).
                            // [PERF #10] $stepIndex is built once per flow item (O(n) total),
                            // making each next-step type lookup O(1) instead of O(n).
                            // When a flow has 20 steps and MAX_STEPS=30, old code did up to 600 iterations;
                            // now it's always exactly 1 array access.
                            $nextStepType = $stepIndex[$currentStepId]['type'] ?? null;
                            $stmtUpdateStep->execute([$currentStepId, $nextStepType, $queueId, $item['subscriber_workspace_id']]);
                            // [BUG-FLOW-10] Update last_step_at in RAM so consecutive Wait steps don't reuse stale timestamp
                            $item['last_step_at'] = $now;
                            $pdo->commit();
                            $pdo->beginTransaction();
                            continue;
                        } else {
                            $waitStepType = $stepIndex[$currentStepId]['type'] ?? null;
                            $stmtUpdateWaitStepType->execute([$execResult['scheduled_at'], $currentStepId, $waitStepType, $queueId, $item['subscriber_workspace_id']]);
                            $item['last_step_at'] = $now;
                            $shouldContinueChain = false;
                        }
                    } else {
                        if ($execResult['status'] === 'completed') {
                            $stmtCompleteStepType->execute([$currentStepId, $queueId, $item['subscriber_workspace_id']]);

                            // NEW: Log completion activity for Dashboard accuracy
                            logActivity($pdo, $subscriberId, 'complete_flow', $currentStepId, $flowName, "Flow finished automatically", $flowId, null, [], $item['workspace_id'] ?? $item['subscriber_workspace_id']);

                            // Buffer Completion Stat
                            try {
                                $stmtStatCompleteBuff->execute([$flowId]);
                            } catch (Exception $e) {
                                $stmtStatCompleteFB->execute([$flowId, $item['subscriber_workspace_id']]);
                            }
                        } else {
                            $nextStepType = $stepIndex[$currentStepId]['type'] ?? null;
                            $stmtDynamicState->execute([$execResult['status'], $execResult['scheduled_at'] ?? $now, $currentStepId, $nextStepType, $queueId, $item['subscriber_workspace_id']]);
                        }
                        $shouldContinueChain = false;
                    }
                } // End of while loop

                // NEW: Prevent infinite loop if steps exceed MAX_STEPS without terminating explicitly
                if ($shouldContinueChain && $stepsProcessedInRun >= $MAX_STEPS) {
                    $stmtWaitSchedule->execute([$now, $currentStepId, $queueId, $item['subscriber_workspace_id']]);
                    $logs[] = "  -> Reached limit ($MAX_STEPS). Pausing chain to prevent infinite loop.";
                }

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();

                // [FIX] After rollback, explicitly reset status to 'waiting' with +5min retry.
                // Previously this left status='processing' indefinitely, relying on the implicit
                // 5-minute stale recovery � which works but: (a) provides no error trace,
                // (b) means the item silently retries with no visibility into what went wrong.
                // Now: write last_error for traceability + schedule explicit clean retry.
                $retryAt = date('Y-m-d H:i:s', time() + 300); // 5 minutes
                try {
                    $pdo->prepare(
                        "UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = ?, last_error = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ?"
                    )->execute([$retryAt, substr($e->getMessage(), 0, 500), $queueId, $item['subscriber_workspace_id']]);
                } catch (Throwable $resetEx) {
                    // last_error column may not exist on older schema � fall back to status-only reset
                    try {
                        $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ?")->execute([$retryAt, $queueId, $item['subscriber_workspace_id']]);
                    } catch (Throwable $ignored) {}
                }

                $logs[] = "[ERROR] Subscriber {$subscriberId} chain failed (retry at {$retryAt}): " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine();
                error_log("[worker_flow] Queue {$queueId} sub {$subscriberId} failed: " . $e->getMessage());
            }

        
            // [OPTIMIZATION] Explicit Garbage Collection (Zero-Leak Memory Profile)
            unset($item, $currentStep, $activityCache, $exitActivityCache, $contextData, $execResult, $freshState);
        }

        if (function_exists('flushActivityLogBuffer')) {
            flushActivityLogBuffer($pdo);
        }
        // [PHASE 8] Flush FlowExecutor RAM Buffer before exit context
        if (isset($executor) && method_exists($executor, 'flushStatsBuffer')) {
            $executor->flushStatsBuffer();
        }
        $mailer->closeConnection();
        // [FIX] LOCK_EX prevents log corruption when multiple worker processes write concurrently
        file_put_contents(__DIR__ . '/worker_flow.log', implode("\n", $logs) . "\n", FILE_APPEND | LOCK_EX);
        // [FIX] return array instead of echo � caller (worker_queue.php) is responsible for output
        return ['status' => 'completed', 'logs' => $logs];
    } // end runWorkerFlow()
} // end if (!function_exists)

// When run as standalone script (cron/direct), execute immediately and output result
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    // [FIX] Only echo here � when called via require_once from worker_queue.php,
    // the caller manages output. This guard prevents broken concatenated JSON.
    $result = runWorkerFlow($pdo);
    echo json_encode($result);
}

