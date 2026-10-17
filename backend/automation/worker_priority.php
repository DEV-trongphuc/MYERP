<?php
// api/worker_priority.php - OMNI-ENGINE V29.6 (PRIORITY CHAINING ENGINE - FINAL FIX FOR INSTANT EXECUTION)
// This worker is triggered directly by API calls (forms.php, purchase_events.php, custom_events.php, worker_campaign.php)
// to immediately enroll a SPECIFIC subscriber into relevant flows AND execute the *initial chain of instant steps*.

// IMMEDIATE ERROR LOGGING - before ANYTHING else
$errorLogFile = __DIR__ . '/worker_error.log';
$debugLogFile = __DIR__ . '/debug_priority.log';

$isIncluded = (basename($_SERVER['SCRIPT_FILENAME']) !== 'worker_priority.php');
try {
    // PREVENT SCRIPT ABORTION WHEN CURL DISCONNECTS
    ignore_user_abort(true);
    set_time_limit(300); // 5 minutes for deep priority chains

    // [DEBUG] Unified Trace Log Helper
    if (!function_exists('traceLog')) {
        function traceLog($msg)
        {
            $logFile = __DIR__ . '/worker_trace.log';
            $entry = date('H:i:s') . " " . $msg . PHP_EOL;
            file_put_contents($logFile, $entry, FILE_APPEND);
        }
    }

    // Log entry IMMEDIATELY
    traceLog("[Priority] === ENTRY GET: " . json_encode($_GET));
    file_put_contents($debugLogFile, "\n=== ENTRY " . date('Y-m-d H:i:s') . " ===\nGET: " . print_r($_GET, true), FILE_APPEND | LOCK_EX);

    error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
    ini_set('display_errors', 0); // Disable for production

    require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
    traceLog("[Priority] DB Connected");
    file_put_contents($debugLogFile, "DB connected\n", FILE_APPEND | LOCK_EX);

    require_once __DIR__ . '/Mailer.php'; // Mailer is required here for sending emails within the priority chain
    require_once __DIR__ . '/trigger_helper.php'; // Required for Propagation
    require_once __DIR__ . '/FlowExecutor.php';
    traceLog("[Priority] Deps Loaded");
    file_put_contents($debugLogFile, "Mailer loaded\n", FILE_APPEND | LOCK_EX);

    date_default_timezone_set('Asia/Ho_Chi_Minh');
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET SESSION innodb_lock_wait_timeout = 5");

    // Params passed via GET request
    $prioritySid = $_GET['subscriber_id'] ?? $_GET['priority_sub_id'] ?? null;
    $priorityTriggerType = $_GET['trigger_type'] ?? null;
    $priorityTargetId = $_GET['target_id'] ?? null;
    $priorityQueueId = $_GET['priority_queue_id'] ?? null;
    $priorityFlowId = $_GET['priority_flow_id'] ?? null;
    $priorityDepth = (int) ($_GET['depth'] ?? 0);

    if ($priorityDepth > 8) {
        traceLog("[Priority] ABORT: Max depth (8) exceeded. Possible infinite loop.");
        file_put_contents($debugLogFile, "Aborting: Max depth reached (8)\n", FILE_APPEND);
        if ($isIncluded) return; else exit;
    }

    // [MONITOR] Warn at depth 6+ without hard-failing — helps detect unexpectedly deep chains
    if ($priorityDepth >= 6) {
        traceLog("[Priority] WARNING: Deep chain detected (depth={$priorityDepth}). Review flow triggers for loops.");
    }

    $logs = [];
    $logs[] = "--- PRIORITY WORKER START: " . date('Y-m-d H:i:s') . " ---";
    // file_put_contents($debugLogFile, "--- RUN " . date('Y-m-d H:i:s') . " ---\nREQUEST: " . print_r($_GET, true) . "\n", FILE_APPEND);

} catch (Throwable $e) {
    if (function_exists('traceLog'))
        traceLog("[Priority] FATAL EARLY: " . $e->getMessage());
    file_put_contents($errorLogFile, date('Y-m-d H:i:s') . " FATAL EARLY ERROR: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n", FILE_APPEND);
    die("Worker initialization failed");
}

// Hardcoded production URL for tracking
$apiUrl = API_BASE_URL;
// [FIX P39-WP1] Only fetch required settings keys — avoids loading ALL secrets (smtp_password, API keys) into memory
$stmtSettings = $pdo->prepare("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN ('smtp_user','smtp_host','max_messages_per_day')");
$stmtSettings->execute();
$settings = [];
while ($row = $stmtSettings->fetch()) {
    $settings[$row['key']] = $row['value'];
}
// [SECURITY] Fetch workspace_id early for Mailer initialization
$prioritySid = $_GET['subscriber_id'] ?? $_GET['priority_sub_id'] ?? null;
$priorityWorkspaceId = $_GET['workspace_id'] ?? null;
if (!$priorityWorkspaceId && $prioritySid) {
    $stmtW = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
    $stmtW->execute([$prioritySid]);
    $priorityWorkspaceId = $stmtW->fetchColumn();
}
$priorityWorkspaceId = $priorityWorkspaceId ? (int)$priorityWorkspaceId : 0;

$defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
$mailer = new Mailer($pdo, $apiUrl, $defaultSender, $priorityWorkspaceId);
$flowExecutor = new FlowExecutor($pdo, $mailer, $apiUrl);

// [FIX P9-C2] MySQL version guard — SKIP LOCKED requires MySQL = 8.0.
// worker_priority.php uses SKIP LOCKED in 2 places (Scenario B chain lock + Scenario D batch).
// Without this guard: Fatal Syntax Error on MySQL 5.7 ? ALL priority enrollments fail.
$skipLockedClause = isDatabaseSkipLockedSupported($pdo) ? 'SKIP LOCKED' : '';

$now = date('Y-m-d H:i:s');
$currentTime = date('H:i');
$currentDayIdx = (int) date('w'); // 0 (Sun) to 6 (Sat)

// =================================================================================
// HELPER: Shared Logic (Imported)
// =================================================================================
require_once 'flow_helpers.php';
// Functions moved to flow_helpers.php:
// - logActivity
// - parseLoopingContent
// - resolveEmailContent
// - replaceMergeTags
// - isSubscriberMatch

// =================================================================================
// PRIORITY ENROLLMENT AND IMMEDIATE CHAIN EXECUTION
// =================================================================================
$pdo->beginTransaction(); // Start a global transaction for the entire worker run
traceLog("[Priority] Transaction Started");

try {
    // [FIX] Initialize variables used in catch/finally block to prevent
    // "Undefined variable" PHP 8 warnings if an exception occurs early
    // (e.g. before Scenario A/B/C branching sets these values).
    $subscriberId = null;
    $flowId = null;
    $queueId = null;
    $queueIdToUpdate = null;

    $item = null;

    traceLog("[Priority] Params - Sid: $prioritySid, Type: $priorityTriggerType, TargetId: $priorityTargetId, QueueId: $priorityQueueId");

    // Scenario A: Triggered for a new enrollment (from forms.php, etc.)
    if ($prioritySid && $priorityTriggerType && $priorityTargetId && !$priorityQueueId) {
        traceLog("[Priority] SCENARIO A: New Enrollment (WS: $priorityWorkspaceId)");
        $logs[] = "[Priority-Enroll] Received Trigger: $priorityTriggerType ID: $priorityTargetId for Subscriber $prioritySid";

        if ($priorityTriggerType === 'manual') {
            // MANUAL TRIGGER: Directly enroll into the specified flow (target_id)
            // [SECURITY FIX] Added workspace_id filter
            $stmtManualFlow = $pdo->prepare("SELECT id, name, steps, config FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtManualFlow->execute([$priorityTargetId, $priorityWorkspaceId]);
            $manualFlow = $stmtManualFlow->fetch();

            if ($manualFlow) {
                $logs[] = "[Priority-Manual] Manual trigger for Flow: {$manualFlow['name']}";
                $steps = json_decode($manualFlow['steps'], true);
                $trigger = null;
                foreach ($steps as $s)
                    if ($s['type'] === 'trigger')
                        $trigger = $s;

                if ($trigger && isset($trigger['nextStepId'])) {
                    // [SECURITY FIX] Added workspace_id check to prevent wiping other tenant states if ID collision occurs
                    $pdo->prepare("DELETE FROM subscriber_flow_states WHERE subscriber_id = ? AND flow_id = ? AND workspace_id = ? AND status IN ('waiting', 'processing')")
                        ->execute([$prioritySid, $manualFlow['id'], $priorityWorkspaceId]);

                    // [OPT] Explicit column select — avoid SELECT * on heavy subscribers table
                    // Columns needed: all fields used by FlowExecutor + flow_helpers for merge tags,
                    // send logic, phone validation, custom_attributes merge tags.
                    $stmtSubDetails = $pdo->prepare(
                        "SELECT id, contact_id, email, status, first_name, last_name, phone_number,
                                company_name, job_title, city, district, ward, country, address, gender,
                                date_of_birth, anniversary_date, joined_at,
                                last_os, last_device, last_browser, last_city,
                                stats_opened, stats_clicked, last_open_at, last_click_at,
                                timezone, is_zalo_follower, tags, custom_attributes, workspace_id,
                                program, stage_id, owner_id, salesperson
                         FROM subscribers WHERE id = ? AND workspace_id = ?"
                    );
                    $stmtSubDetails->execute([$prioritySid, $priorityWorkspaceId]);
                    $subDetails = $stmtSubDetails->fetch();

                    if ($subDetails) {
                        $pastTime = date('Y-m-d H:i:s', strtotime('-1 second'));
                        $initialSchedule = $pastTime;

                        // [SMART SCHEDULE FIX] Calculate future wait date if first step is wait
                        foreach ($steps as $fs) {
                            if (($fs['id'] ?? '') === $trigger['nextStepId'] && strtolower($fs['type'] ?? '') === 'wait') {
                                $fsWaitConfig = $fs['config'] ?? [];
                                $fsWaitMode = $fsWaitConfig['mode'] ?? 'duration';
                                if ($fsWaitMode === 'duration') {
                                    $dur = (int) ($fsWaitConfig['duration'] ?? 0);
                                    $unit = $fsWaitConfig['unit'] ?? 'minutes';
                                    $unitSeconds = match ($unit) {
                                        'weeks' => 604800,
                                        'days' => 86400,
                                        'hours' => 3600,
                                        default => 60,
                                    };
                                    if (($unitSeconds * $dur) > 0) {
                                        $initialSchedule = date('Y-m-d H:i:s', time() + ($unitSeconds * $dur));
                                    }
                                } elseif ($fsWaitMode === 'until_date') {
                                    $specDate = $fsWaitConfig['specificDate'] ?? '';
                                    $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                    if ($specDate) {
                                        $targetTs = strtotime("$specDate $targetTime:00");
                                        if ($targetTs > time()) {
                                            $initialSchedule = date('Y-m-d H:i:s', $targetTs);
                                        }
                                    }
                                } elseif ($fsWaitMode === 'until') {
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

                        // [HARDENING] Extract step type
                        $nextStepId = $trigger['nextStepId'];
                        $nextStepType = 'unknown';
                        foreach ($steps as $fs) {
                            if ($fs['id'] === $nextStepId) {
                                $nextStepType = $fs['type'] ?? 'unknown';
                                break;
                            }
                        }

                        $stmtE = $pdo->prepare("INSERT INTO subscriber_flow_states (workspace_id, subscriber_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())");
                        $stmtE->execute([$priorityWorkspaceId, $prioritySid, $subDetails['contact_id'] ?? null, $manualFlow['id'], $nextStepId, $nextStepType, $initialSchedule]);
                        $newQueueId = $pdo->lastInsertId();

                        logActivity($pdo, $prioritySid, 'enter_flow', $manualFlow['id'], $manualFlow['name'], "Manual Trigger by Admin", $manualFlow['id'], null, [], $priorityWorkspaceId);
                        $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + 1 WHERE id = ?")->execute([$manualFlow['id']]);

                        $item = array_merge($subDetails, [
                            'queue_id' => $newQueueId,
                            'subscriber_id' => $prioritySid,
                            'flow_id' => $manualFlow['id'],
                            'step_id' => $trigger['nextStepId'],
                            'scheduled_at' => $initialSchedule,
                            'queue_created_at' => $now,
                            'flow_steps' => $manualFlow['steps'],
                            'flow_config' => $manualFlow['config'],
                            'flow_name' => $manualFlow['name'],
                            'sub_email' => $subDetails['email'],
                            'sub_status' => $subDetails['status'],
                            'sub_tags' => $subDetails['tags'],
                            'sub_id' => $subDetails['id'],
                        ]);
                        $foundFlowForPriority = true;
                    }
                }
            }
        } else {
            // Standard triggers (form, tag, etc.)
            traceLog("[Priority] Fetching active flows for trigger: $priorityTriggerType (WS: $priorityWorkspaceId)");
            // [10M UPGRADE] Query flows specifically by trigger_type for MASSIVE performance gain
            // [SECURITY FIX] Added workspace_id filter
            $stmtFlows = $pdo->prepare("SELECT id, name, steps, config FROM flows WHERE workspace_id = ? AND status = 'active' AND (trigger_type = ? OR trigger_type = 'segment' OR trigger_type = 'list' OR trigger_type IS NULL)");
            $stmtFlows->execute([$priorityWorkspaceId, $priorityTriggerType]);
            $activeFlows = $stmtFlows->fetchAll();
            traceLog("[Priority] Found " . count($activeFlows) . " active flows");

            $foundFlowForPriority = false;

            foreach ($activeFlows as $flow) {
                $steps = json_decode($flow['steps'], true);
                $trigger = null;
                foreach ($steps as $s)
                    if ($s['type'] === 'trigger')
                        $trigger = $s;

                if (!$trigger || !isset($trigger['nextStepId']))
                    continue;

                $tConfig = $trigger['config'];
                $flowTriggerType = $tConfig['type'] ?? ''; // [FIX] was undefined — caused all standard triggers to never match
                $flowTargetSubtype = $tConfig['targetSubtype'] ?? '';
                $flowTargetId = $tConfig['targetId'] ?? '';

                // Match "list" or "added_to_list" trigger against flows that are "list" or "segment" with list/sync subtype
                $isMatch = false;
                if ($flowTriggerType === $priorityTriggerType) {
                    $isMatch = true;
                } elseif (($priorityTriggerType === 'list' || $priorityTriggerType === 'added_to_list') && ($flowTriggerType === 'list' || ($flowTriggerType === 'segment' && in_array($flowTargetSubtype, ['list', 'sync'], true)))) {
                    $isMatch = true;
                }

                // Target Matching Logic
                $targetMatched = ($flowTargetId == $priorityTargetId || empty($flowTargetId) || $flowTargetId === 'all');

                // SPECIAL CASE: Inbound Message Keyword Logic
                if ($isMatch && $priorityTriggerType === 'inbound_message' && !empty($flowTargetId) && $flowTargetId !== 'all') {
                    // [FIX] Use mb_strtolower + mb_stripos for proper Vietnamese Unicode matching
                    // Previously strpos() would fail on "Tư Vấn" vs "tư vấn" etc.
                    $keywords = array_map('trim', explode(',', mb_strtolower($flowTargetId, 'UTF-8')));
                    $msgLower = mb_strtolower($priorityTargetId, 'UTF-8');
                    $kwFound = false;
                    foreach ($keywords as $kw) {
                        if ($kw !== '' && mb_stripos($msgLower, $kw, 0, 'UTF-8') !== false) {
                            $kwFound = true;
                            break;
                        }
                    }
                    $targetMatched = $kwFound;
                }

                if ($isMatch && $targetMatched) {
                    traceLog("[Priority] MATCH! Flow {$flow['id']} ({$flow['name']}) matches trigger");
                    // [NEW] FREQUENCY & RE-ENROLLMENT CHECK (Respect One-Time vs Recurring)
                    $fConfig = json_decode($flow['config'] ?? '{}', true);
                    $frequency = $fConfig['frequency'] ?? 'one-time';
                    $cooldownHours = (int) ($fConfig['enrollmentCooldownHours'] ?? 12);

                    $stmtCheck = $pdo->prepare("SELECT id, status, updated_at FROM subscriber_flow_states WHERE subscriber_id = ? AND flow_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1");
                    $stmtCheck->execute([$prioritySid, $flow['id'], $priorityWorkspaceId]);
                    $existingState = $stmtCheck->fetch();

                    // [FIX BUG-H5] Initialize defaults BEFORE the if-block to prevent
                    // PHP 8.1+ "Undefined variable" notices when $existingState is null/false.
                    // These vars are used in $debugInfo below regardless of enrollment state.
                    $allowMultiple = $fConfig['allowMultiple'] ?? false;
                    $maxEnrollments = (int) ($fConfig['maxEnrollments'] ?? 0);

                    if ($existingState) {

                        // Check Max Enrollments if applicable
                        if ($maxEnrollments > 0) {
                            $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM subscriber_flow_states WHERE subscriber_id = ? AND flow_id = ?");
                            $stmtTotal->execute([$prioritySid, $flow['id']]);
                            $totalEnrollments = (int) $stmtTotal->fetchColumn();
                            if ($totalEnrollments >= $maxEnrollments) {
                                $logs[] = "[Priority-Enroll] Sub $prioritySid reached max enrollments ($maxEnrollments) for Flow {$flow['id']}." . " Skipping.";
                                continue;
                            }
                        }

                        if ($allowMultiple) {
                            $logs[] = "[Priority-Enroll] Flow {$flow['id']} has 'allowMultiple' enabled. Bypassing progress checks for sub $prioritySid.";
                        } else {
                            if ($frequency === 'one-time') {
                                $logs[] = "[Priority-Enroll] Sub $prioritySid already enrolled in one-time Flow {$flow['id']}. Skipping.";
                                continue; // DO NOT RE-ENROLL
                            } else if ($frequency === 'recurring') {
                                // If still in progress (waiting/processing), skip to avoid duplicates
                                if ($existingState['status'] === 'waiting' || $existingState['status'] === 'processing') {
                                    $logs[] = "[Priority-Enroll] Sub $prioritySid already in progress for Flow {$flow['id']}. Skipping.";
                                    continue;
                                }
                                // Check cooldown if completed or failed
                                $lastUpdated = strtotime($existingState['updated_at']);
                                if ((time() - $lastUpdated) < ($cooldownHours * 3600)) {
                                    $logs[] = "[Priority-Enroll] Sub $prioritySid too soon for recurring Flow {$flow['id']} (Cooldown: $cooldownHours h). Skipping.";
                                    continue;
                                }
                            }
                        }
                    }

                    // Proceed with enrollment
                    // [OPT] Explicit column select — same column list as manual trigger above
                    $stmtSubDetails = $pdo->prepare(
                        "SELECT id, contact_id, email, status, first_name, last_name, phone_number,
                                company_name, job_title, city, district, ward, country, address, gender,
                                date_of_birth, anniversary_date, joined_at,
                                last_os, last_device, last_browser, last_city,
                                stats_opened, stats_clicked, last_open_at, last_click_at,
                                timezone, is_zalo_follower, tags, custom_attributes, workspace_id,
                                program, stage_id, owner_id, salesperson
                         FROM subscribers WHERE id = ? AND workspace_id = ?"
                    );
                    $stmtSubDetails->execute([$prioritySid, $priorityWorkspaceId]);
                    $subDetails = $stmtSubDetails->fetch();

                    if (!$subDetails)
                        continue;

                    $pastTime = date('Y-m-d H:i:s', strtotime('-1 second'));
                    $initialSchedule = $pastTime;

                    // [SMART SCHEDULE FIX] Calculate future wait date if first step is wait
                    foreach ($steps as $fs) {
                        if (($fs['id'] ?? '') === $trigger['nextStepId'] && strtolower($fs['type'] ?? '') === 'wait') {
                            $fsWaitConfig = $fs['config'] ?? [];
                            $fsWaitMode = $fsWaitConfig['mode'] ?? 'duration';
                            if ($fsWaitMode === 'duration') {
                                $dur = (int) ($fsWaitConfig['duration'] ?? 0);
                                $unit = $fsWaitConfig['unit'] ?? 'minutes';
                                $unitSeconds = match ($unit) {
                                    'weeks' => 604800,
                                    'days' => 86400,
                                    'hours' => 3600,
                                    default => 60,
                                };
                                if (($unitSeconds * $dur) > 0) {
                                    $initialSchedule = date('Y-m-d H:i:s', time() + ($unitSeconds * $dur));
                                }
                            } elseif ($fsWaitMode === 'until_date') {
                                $specDate = $fsWaitConfig['specificDate'] ?? '';
                                $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                if ($specDate) {
                                    $targetTs = strtotime("$specDate $targetTime:00");
                                    if ($targetTs > time()) {
                                        $initialSchedule = date('Y-m-d H:i:s', $targetTs);
                                    }
                                }
                            } elseif ($fsWaitMode === 'until') {
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
                    // [DEBUG] Log enrollment attempt details
                    $debugInfo = [
                        'subscriber_id' => $prioritySid,
                        'flow_id' => $flow['id'],
                        'frequency' => $frequency,
                        'cooldownHours' => $cooldownHours,
                        'maxEnrollments' => $maxEnrollments ?? 0,
                        'allowMultiple' => $allowMultiple ?? false,
                        'existingState' => $existingState ? [
                            'status' => $existingState['status'],
                            'updated_at' => $existingState['updated_at'],
                            'hours_since_update' => round((time() - strtotime($existingState['updated_at'])) / 3600, 2)
                        ] : null
                    ];
                    traceLog("[Priority-Enroll-Debug] " . json_encode($debugInfo));

                        // [HARDENING] Extract step type
                        $nextStepId = $trigger['nextStepId'];
                        $nextStepType = 'unknown';
                        foreach ($steps as $fs) {
                            if ($fs['id'] === $nextStepId) {
                                $nextStepType = $fs['type'] ?? 'unknown';
                                break;
                            }
                        }

                        // [FIX] Respect allowMultiple flag in SQL INSERT
                        if ($allowMultiple) {
                            traceLog("[Priority] allowMultiple=true, using debounce INSERT");
                            $sqlIns = "INSERT INTO subscriber_flow_states (workspace_id, subscriber_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
                                       SELECT ?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW()
                                       FROM DUAL
                                       WHERE NOT EXISTS (
                                           SELECT 1 FROM subscriber_flow_states
                                           WHERE subscriber_id = ? AND flow_id = ? AND workspace_id = ?
                                           AND created_at >= DATE_SUB(NOW(), INTERVAL 3 SECOND)
                                       )";
                            $stmtE = $pdo->prepare($sqlIns);
                            $stmtE->execute([$priorityWorkspaceId, $prioritySid, $subDetails['contact_id'] ?? null, $flow['id'], $nextStepId, $nextStepType, $initialSchedule, $prioritySid, $flow['id'], $priorityWorkspaceId]);
                        } else {
                            // allowMultiple = false: Apply frequency and cooldown rules
                            if ($frequency === 'one-time') {
                                $blockCondition = "1=1"; // Always block if any record exists
                            } else {
                            $safeChHours = (int)$cooldownHours;
                            $blockCondition = "status IN ('waiting', 'processing') OR updated_at > DATE_SUB(NOW(), INTERVAL $safeChHours HOUR)";
                            }
    
                            $sqlIns = "INSERT INTO subscriber_flow_states (workspace_id, subscriber_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
                                       SELECT ?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW()
                                       FROM DUAL
                                       WHERE NOT EXISTS (
                                           SELECT 1 FROM subscriber_flow_states 
                                           WHERE subscriber_id = ? AND flow_id = ? AND workspace_id = ?
                                           AND ($blockCondition)
                                       )";
                            $stmtE = $pdo->prepare($sqlIns);
                            $stmtE->execute([$priorityWorkspaceId, $prioritySid, $subDetails['contact_id'] ?? null, $flow['id'], $nextStepId, $nextStepType, $initialSchedule, $prioritySid, $flow['id'], $priorityWorkspaceId]);
                        }

                    if ($stmtE->rowCount() === 0) {
                        $logs[] = "[Priority-Enroll] Race condition detected or criteria no longer met for Sub $prioritySid, Flow {$flow['id']}. Skipping duplicate INSERT.";
                        continue;
                    }

                    $newQueueId = $pdo->lastInsertId();

                    $detailMessage = "Priority Trigger: {$priorityTriggerType} ({$priorityTargetId})";
                    logActivity($pdo, $prioritySid, 'enter_flow', $flow['id'], $flow['name'], $detailMessage, $flow['id'], null, [], $priorityWorkspaceId);
                    $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + 1 WHERE id = ? AND workspace_id = ?")->execute([$flow['id'], $priorityWorkspaceId]);

                    if (!$item) {
                        $item = array_merge($subDetails, [
                            'queue_id' => $newQueueId,
                            'subscriber_id' => $prioritySid,
                            'flow_id' => $flow['id'],
                            'step_id' => $trigger['nextStepId'],
                            'scheduled_at' => $initialSchedule,
                            'queue_created_at' => $now,
                            'flow_steps' => $flow['steps'],
                            'flow_config' => $flow['config'],
                            'flow_name' => $flow['name'],
                            'sub_email' => $subDetails['email'],
                            'sub_status' => $subDetails['status'],
                            'sub_tags' => $subDetails['tags'],
                            'sub_id' => $subDetails['id'],
                        ]);
                        $foundFlowForPriority = true;
                    } else {
                        // Multi-flow trigger...
                        $workerParams = http_build_query(['priority_queue_id' => $newQueueId, 'subscriber_id' => $prioritySid, 'priority_flow_id' => $flow['id']]);
                        // [OPTIMIZED] Use centralized WorkerTriggerService for non-blocking self-trigger
                        require_once __DIR__ . '/WorkerTriggerService.php';
                        $triggerService = new WorkerTriggerService($pdo, API_BASE_URL);
                        $triggerService->trigger('/worker_priority.php?' . $workerParams);
                    }
                }
            }
        }
        if (!$foundFlowForPriority) {
            $logs[] = "[Priority-Enroll] No matching active flow for $priorityTriggerType ID $priorityTargetId. Exiting.";
            $pdo->commit();
            file_put_contents($debugLogFile, "No matching flow found - committed and exiting\n", FILE_APPEND | LOCK_EX);
            if ($isIncluded) return; else exit;
        }

        // FIX: COMMIT THE TRANSACTION AFTER SUCCESSFUL ENROLLMENT!
        $pdo->commit();
        file_put_contents($debugLogFile, "Transaction committed after enrollment\n", FILE_APPEND | LOCK_EX);
        $logs[] = "[Priority-Enroll] Transaction committed. Enrollment persisted to database.";

        // Start a new transaction for the chain execution
        $pdo->beginTransaction();
        file_put_contents($debugLogFile, "Started new transaction for chain execution\n", FILE_APPEND | LOCK_EX);

    }
    // Scenario B: Triggered to continue an existing priority chain (self-triggering from a non-instant step)
    else if ($priorityQueueId && $prioritySid && $priorityFlowId) {
        $logs[] = "[Priority-Chain] Received exclusive request for Queue ID: $priorityQueueId. Sub: $prioritySid, Flow: $priorityFlowId.";
 
        $stmtItem = $pdo->prepare("SELECT q.id as queue_id, q.subscriber_id, q.flow_id, q.step_id, q.status, q.scheduled_at, q.updated_at, q.created_at as queue_created_at, q.last_step_at, 
                                 f.steps as flow_steps, f.config as flow_config, f.name as flow_name, 
                                 s.email as sub_email, s.contact_id, s.first_name, s.last_name, s.company_name, s.phone_number, s.job_title,
                                 s.status as sub_status, s.tags as sub_tags, s.id as sub_id, s.date_of_birth, s.anniversary_date, s.joined_at,
                                 s.city, s.district, s.ward, s.country, s.address, s.gender, s.last_os, s.last_device, s.last_browser, s.last_city,
                                 s.stats_opened, s.stats_clicked, s.last_open_at, s.last_click_at, s.timezone, s.is_zalo_follower,
                                 s.custom_attributes, s.workspace_id, s.program, s.stage_id, s.owner_id, s.salesperson
                                 FROM subscriber_flow_states q 
                                 JOIN flows f ON q.flow_id = f.id 
                                 JOIN subscribers s ON q.subscriber_id = s.id 
                                 WHERE q.id = ? AND q.subscriber_id = ? AND q.flow_id = ? AND s.workspace_id = ? AND q.workspace_id = s.workspace_id AND q.status IN ('waiting', 'processing') AND f.status = 'active'
                                 LIMIT 1 FOR UPDATE $skipLockedClause");
        // [FIX] Added SKIP LOCKED to prevent duplicate chain execution when two concurrent priority
        // workers are fired for the same queue_id (e.g. double-click webhook, network retry).
        // Without SKIP LOCKED: Worker-B blocks ? A commits ? B finds 'waiting' row ? re-executes ? duplicate send.
        // With SKIP LOCKED: Worker-B finds 0 rows while A holds the lock ? exits cleanly.
 
        $stmtItem->execute([$priorityQueueId, $prioritySid, $priorityFlowId, $priorityWorkspaceId]);
        $priorityItem = $stmtItem->fetch();

        if ($priorityItem) {
            $initialStatus = $priorityItem['status'];

            // [DOUBLE-CHECK LOCK] Only execute if the item was genuinely 'waiting'.
            // If status is already 'processing', another worker claimed it first.
            // This shouldn't happen with SKIP LOCKED (we'd have gotten 0 rows),
            // but acts as a defensive safety net for MySQL versions without SKIP LOCKED support.
            if ($initialStatus === 'processing') {
                $logs[] = "[Priority-Chain] Item $priorityQueueId already 'processing' (race condition guard). Skipping to prevent duplicate.";
                $pdo->commit();
                if ($isIncluded) return; else exit;
            }

            $pdo->prepare("UPDATE subscriber_flow_states SET status = 'processing', updated_at = NOW() WHERE id = ? AND workspace_id = ?")->execute([$priorityQueueId, $priorityWorkspaceId]);
            $item = $priorityItem;
            // [FIX] The JOIN query aliases s.email as 'sub_email'. FlowExecutor and
            // replaceMergeTags both need the 'email' key — map it here to prevent
            // empty {{email}} merge tags and wrong Mailer send-to address.
            $item['email'] = $item['sub_email'] ?? '';
            $queueIdToUpdate = $priorityQueueId;
            $logs[] = "[Priority-Chain] Item $priorityQueueId found. Initial status: '{$initialStatus}'. Now 'processing'.";

        } else {
            $logs[] = "[Priority-Chain] Item $priorityQueueId not found, locked by another worker, or not in 'waiting'/'processing' state. Exiting without further action.";
            $pdo->commit();
            if ($isIncluded) return; else exit;
        }

    }
    // Scenario D: Batch Mode (Triggered by enrollSubscribersBulk or Cron)
    else if (($_GET['mode'] ?? '') === 'batch') {
        $logs[] = "[Priority-Batch] Processing top 50 waiting priority items (WS: $priorityWorkspaceId).";
        
        $sqlBatch = "SELECT q.id as queue_id, q.subscriber_id, q.flow_id 
                                   FROM subscriber_flow_states q
                                   JOIN flows f ON q.flow_id = f.id
                                   JOIN subscribers s ON q.subscriber_id = s.id
                                   WHERE q.status = 'waiting' AND q.scheduled_at <= NOW() AND f.status = 'active'
                                   AND q.workspace_id = s.workspace_id";
        
        $paramsBatch = [];
        if ($priorityWorkspaceId) {
            $sqlBatch .= " AND s.workspace_id = ?";
            $paramsBatch[] = $priorityWorkspaceId;
        }
 
        $sqlBatch .= " ORDER BY q.created_at ASC LIMIT 50 FOR UPDATE $skipLockedClause";
        
        $stmtBatch = $pdo->prepare($sqlBatch);
        $stmtBatch->execute($paramsBatch);
        $batchItems = $stmtBatch->fetchAll();

        if (empty($batchItems)) {
            $logs[] = "[Priority-Batch] No waiting items found. Exiting.";
            $pdo->commit();
            if ($isIncluded) return; else exit;
        }

        // [FIX] Replace 50 sequential cURL calls with curl_multi_exec with concurrency cap.
        // Old approach: foreach + curl_exec() fires up to 50 HTTP requests back-to-back,
        // exhausting PHP-FPM workers and acting like a local DDoS if cron runs every minute.
        // New approach: fire at most 5 requests concurrently, wait for them to finish,
        // then fire the next batch of 5 — controlled parallelism with no server overload.
        $CONCURRENCY = 5;
        $chunks = array_chunk($batchItems, $CONCURRENCY);

        foreach ($chunks as $chunk) {
            $mh = curl_multi_init();
            $handles = [];

            foreach ($chunk as $bi) {
                $workerParams = http_build_query([
                    'priority_queue_id' => $bi['queue_id'],
                    'subscriber_id' => $bi['subscriber_id'],
                    'priority_flow_id' => $bi['flow_id'],
                    'workspace_id' => $priorityWorkspaceId
                ]);
                $workerUrl = API_BASE_URL . "/worker_priority.php?" . $workerParams;

                $ch = curl_init();
                $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
                curl_setopt($ch, CURLOPT_URL, $workerUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 30);       // Give each worker 30s to complete
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3); // Fail fast on connection errors
                curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P12-C1]
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-Cron-Secret: ' . $cronSecret]);
                curl_multi_add_handle($mh, $ch);
                $handles[] = $ch;
            }

            // Execute all handles in this chunk concurrently
            do {
                $status = curl_multi_exec($mh, $running);
                if ($running)
                    curl_multi_select($mh, 0.5); // Wait up to 0.5s before polling again
            } while ($running > 0 && $status === CURLM_OK);

            // Clean up
            foreach ($handles as $ch) {
                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);
            }
            curl_multi_close($mh);
            
            // [PHASE 9 MEMORY FIX] Clear cURL handles and chunk arrays from memory
            unset($handles, $mh, $chunk);
            gc_collect_cycles();
        }

        $logs[] = "[Priority-Batch] Triggered workers for " . count($batchItems) . " items (concurrency: $CONCURRENCY).";
        $pdo->commit();
        if ($isIncluded) return; else exit;
    }
    // Scenario C: Triggered for immediate CAMPAIGN sending - DEPRECATED/REDIRECTED
    else if ((isset($_GET['type']) && $_GET['type'] === 'campaign') && !empty($_GET['id'])) {
        $logs[] = "[Priority-Campaign] DEPRECATED: worker_priority.php should NOT be used for campaigns. Please use worker_campaign.php.";
        file_put_contents($debugLogFile, "DEPRECATED CALL: worker_priority called for campaign. Redirecting/Aborting.\n", FILE_APPEND);

        // Optional: We could trigger worker_campaign.php here as a fail-safe, but seeing the logs is better for debugging.
        $pdo->commit();
        echo json_encode(['status' => 'redirected', 'message' => 'Campaign triggering via priority is deprecated', 'logs' => $logs]);
        if ($isIncluded) return; else exit;
    } else {
        $logs[] = "[Priority] No valid priority trigger parameters or queue ID received. Exiting.";
        $pdo->commit();
        if ($isIncluded) return; else exit;
    }

    // --- SHARED DATA FETCHING (PRE-CHAIN) ---
    $subscriberId = $item['subscriber_id'];
    $flowId = $item['flow_id'];
    $flowName = $item['flow_name'];
    $queueId = $item['queue_id'];

    // [ELIGIBILITY CHECK]
    if (trim($item['sub_status']) === 'unsubscribed') {
        // Use 'unsubscribed' status — DB ENUM includes: waiting, processing, completed, failed, unsubscribed
        $pdo->prepare("UPDATE subscriber_flow_states SET status = 'unsubscribed', updated_at = NOW() WHERE id = ? AND workspace_id = ?")->execute([$queueId, $priorityWorkspaceId]);
        $logs[] = "[Priority-Exit] Sub {$subscriberId} is unsubscribed. Marking unsubscribed and skipping chain.";
        $pdo->commit();
        if ($isIncluded) return; else exit;
    }

    // Optimization: Cache frequency check (GLOBAL)
    $todayStart = date('Y-m-d 00:00:00');
    $stmtCap = $pdo->prepare("
        SELECT type, COUNT(*) as cnt FROM subscriber_activity 
        WHERE subscriber_id = ? AND workspace_id = ?
        AND type IN ('receive_email', 'zalo_sent', 'meta_sent', 'zns_sent') 
        AND created_at >= ?
        GROUP BY type
    ");
    $stmtCap->execute([$subscriberId, $priorityWorkspaceId, $todayStart]);
    $totalSentToday = ['email' => 0, 'zalo' => 0, 'meta' => 0];
    while ($rowCap = $stmtCap->fetch()) {
        if ($rowCap['type'] === 'receive_email') $totalSentToday['email'] += $rowCap['cnt'];
        if ($rowCap['type'] === 'meta_sent') $totalSentToday['meta'] += $rowCap['cnt'];
        if (in_array($rowCap['type'], ['zalo_sent', 'zns_sent'])) $totalSentToday['zalo'] += $rowCap['cnt'];
    }

    // [BUG-FIX] Decode fConfig from item FIRST so exitConditions below read the CORRECT flow's config.
    // Previously fConfig here referenced the last-iterated $flow['config'] from Scenario A loop,
    // which could be a DIFFERENT flow when multiple flows matched the same trigger.
    $fConfig = is_string($item['flow_config']) ? json_decode($item['flow_config'], true) : ($item['flow_config'] ?: []);

    // [EXIT CHECK] Pre-compute exit types BEFORE the activity SELECT.
    $exitConditionsEarly = $fConfig['exitConditions'] ?? [];
    $exitActivityTypesEarly = [];
    if (!empty($exitConditionsEarly)) {
        $exitTypeMapEarly = [
            'unsubscribed' => ['unsubscribe'],
            'clicked' => ['click_link', 'click_zns'],
            'opened' => ['open_email', 'open_zns'],
            'bounced' => ['bounce'],
        ];
        foreach ($exitConditionsEarly as $cond) {
            $exitActivityTypesEarly = array_merge($exitActivityTypesEarly, $exitTypeMapEarly[$cond] ?? [$cond]);
        }
    }

    // Exit-specific activity cache — unlimited, filtered by type (no LIMIT risk)
    if (!empty($exitActivityTypesEarly)) {
        $exitPlaceholdersEarly = implode(',', array_fill(0, count($exitActivityTypesEarly), '?'));
        $stmtExitActEarly = $pdo->prepare(
            "SELECT type, reference_id, campaign_id, details, created_at
             FROM subscriber_activity
             WHERE subscriber_id = ? AND workspace_id = ? AND created_at >= ? AND type IN ($exitPlaceholdersEarly)
             ORDER BY created_at DESC"
        );
        $stmtExitActEarly->execute(array_merge([$subscriberId, $priorityWorkspaceId, $item['queue_created_at']], $exitActivityTypesEarly));
        $exitActivityCacheEarly = $stmtExitActEarly->fetchAll();
    } else {
        $exitActivityCacheEarly = [];
    }

    // General activity cache — LIMIT 500 for condition-chain logic
    $stmtAct = $pdo->prepare("SELECT type, reference_id, campaign_id, details, created_at FROM subscriber_activity WHERE subscriber_id = ? AND workspace_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 500");
    $stmtAct->execute([$subscriberId, $priorityWorkspaceId, $item['queue_created_at']]);
    $activityCache = $stmtAct->fetchAll();

    $pdo->commit(); // Commit enrollment changes / status update before starting chain
    file_put_contents($debugLogFile, "Starting chain execution for queue ID: {$queueId}\n", FILE_APPEND | LOCK_EX);

    // --- START IMMEDIATE CHAIN EXECUTION ---
    // Note: We use intermediate commits for each step
    $pdo->beginTransaction();

    // [DECODED ABOVE] flow_steps might already be an array if from scenario A enrollment
    $flowSteps = is_string($item['flow_steps']) ? json_decode($item['flow_steps'], true) : $item['flow_steps'];
    // $fConfig already decoded above (before exit-condition pre-fetch) — do NOT redeclare here

    $currentStepId = trim($item['step_id'] ?? '');
    $stepsProcessedInRun = 0;
    $MAX_STEPS = 50;
    $shouldContinueChain = true;
    $isPriorityChain = true;

    // Determine context for logging
    $campaignIdForFlow = null;
    foreach ($flowSteps as $s)
        if ($s['type'] === 'trigger' && ($s['config']['type'] ?? '') === 'campaign')
            $campaignIdForFlow = $s['config']['targetId'] ?? null;

    $totalSentStr = json_encode($totalSentToday);
    $logs[] = "[Priority-Chain] Starting chain for Sub {$subscriberId} (Queue: {$queueId}) in '{$flowName}'. Current Sent: {$totalSentStr}";
    $item['has_email_error'] = false;

    // [OMNI-FIX REMOVED] Priority Flows now bypass global flow frequency limits (activeDays, startTime, endTime).
    // They will execute instantly. (Zalo API physical limits are still enforced by FlowExecutor).

    while ($shouldContinueChain && $stepsProcessedInRun < $MAX_STEPS) {
        $stepsProcessedInRun++;
        $currentStep = null;
        foreach ($flowSteps as $s) {
            if (trim($s['id']) === $currentStepId) {
                $currentStep = $s;
                break;
            }
        }

        if (!$currentStep) {
            $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', updated_at = NOW() WHERE id = ?")->execute([$queueId]);
            $pdo->prepare("UPDATE flows SET stat_completed = stat_completed + 1 WHERE id = ?")->execute([$flowId]);
            $logs[] = "  -> Step '{$currentStepId}' not found. Flow completed.";
            break;
        }

        // [EXIT CHECK] Segment match or activity based exit
        $exitConditions = $fConfig['exitConditions'] ?? [];
        if (!empty($exitConditions)) {
            // [FIX] Normalize frontend exit condition ids to actual activity types
            $exitTypeMap = [
                'unsubscribed' => ['unsubscribe'],
                'clicked' => ['click_link', 'click_zns'],
                'opened' => ['open_email', 'open_zns'],
                'bounced' => ['bounce'],
            ];
            $exitActivityTypes = [];
            foreach ($exitConditions as $cond) {
                $exitActivityTypes = array_merge($exitActivityTypes, $exitTypeMap[$cond] ?? [$cond]);
            }

            $shouldExit = false;
            // [FIX] Use the pre-fetched, type-filtered exitActivityCacheEarly (no LIMIT risk)
            foreach ($exitActivityCacheEarly as $act) {
                if (in_array($act['type'], $exitActivityTypes)) {
                    $shouldExit = true;
                    break;
                }
            }
            if ($shouldExit) {
                $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', updated_at = NOW() WHERE id = ?")->execute([$queueId]);
                logActivity($pdo, $subscriberId, 'exit_flow', $flowId, $flowName, "Exited: Condition met", $flowId);
                $pdo->prepare("UPDATE flows SET stat_completed = stat_completed + 1 WHERE id = ?")->execute([$flowId]);
                $logs[] = "[Priority-Exit] Exit conditions met.";
                break;
            }
        }

        // [EXIT CHECK] Advanced Exit: form_submit / purchase / custom_event
        $advancedExit = $fConfig['advancedExit'] ?? [];
        if (!empty($advancedExit) && checkAdvancedExit($pdo, $subscriberId, $item['queue_created_at'], $advancedExit, $activityCache)) {
            $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', updated_at = NOW() WHERE id = ?")->execute([$queueId]);
            logActivity($pdo, $subscriberId, 'exit_flow', $flowId, $flowName, "Exited: Advanced condition met", $flowId);
            $pdo->prepare("UPDATE flows SET stat_completed = stat_completed + 1 WHERE id = ?")->execute([$flowId]);
            $logs[] = "[Priority-Exit] Advanced exit condition met (form/purchase/custom_event).";
            break;
        }

        // [OMNI-FIX REMOVED] Mid-chain Priority flow execution now ignores activeDays / startTime limits.
        // Zalo rules (06h - 22h) are still inherently protected inside FlowExecutor loop directly.

        // [SCHEDULE PROTECT]
        if ($isPriorityChain && !($_GET['force_skip'] ?? 0)) {
            $scheduledTime = strtotime($item['scheduled_at'] ?? $now);
            if ($scheduledTime > (time() + 1)) {
                $sType = strtolower($currentStep['type'] ?? '');
                if (!in_array($sType, ['condition', 'advanced_condition', 'trigger'])) {
                    $logs[] = "  -> [SCHEDULE PROTECT] Step '{$currentStep['label']}' paused (Scheduled: {$item['scheduled_at']}).";
                    // [FIX] Also update step_id so worker resumes at correct step, not the previous one
                    $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', step_id = ?, updated_at = NOW() WHERE id = ?")
                        ->execute([$currentStepId, $queueId]);
                    $shouldContinueChain = false;
                    break;
                }
            }
        }

        // EXECUTE
        $execCtx = [
            'queue_created_at' => $item['queue_created_at'],
            'last_step_at' => $item['last_step_at'] ?? $item['updated_at'],
            'updated_at' => $item['updated_at'],
            'scheduled_at' => $item['scheduled_at'],  // [BUG-FIX] Pass scheduled_at to FlowExecutor wait-case
            'has_email_error' => $item['has_email_error'] ?? false,
            'flow_steps' => $flowSteps,
            'flow_name' => $flowName,
            'is_priority_chain' => $isPriorityChain,
            'total_sent_today' => $totalSentToday,
            'activity_cache' => $activityCache,
            // [CRITICAL FIX] Must also check $item['status'] === 'waiting' (original status before UPDATE to 'processing').
            // If item was picked up as stale 'processing' (crash recovery), its step_id may already point to
            // a fresh/unscheduled wait step. Treating it as is_resumed_wait=TRUE would skip that wait entirely.
            // Only genuine 'waiting' ? time-expired ? picked-up items can be considered resumed.
            'is_resumed_wait' => ($stepsProcessedInRun === 1
                && ($item['status'] ?? '') === 'waiting'  // GUARD: only original 'waiting' items, not crash recovery
                && trim((string) ($item['step_id'] ?? '')) === trim((string) $currentStepId)
                && $item['scheduled_at'] <= $now),
            'now' => $now
        ];

        $execResult = $flowExecutor->executeStep($currentStep, $item, $flowId, $currentStepId, $campaignIdForFlow, $fConfig, $execCtx);
        if (!empty($execResult['logs']))
            $logs = array_merge($logs, $execResult['logs']);

        if ($execResult['status'] === 'completed' && $execResult['next_step_id']) {
            $currentStepId = $execResult['next_step_id'];
            if ($execResult['is_instant']) {
                // Update local sent count if message was sent
                if (!empty($execResult['message_sent'])) {
                    if (strpos(strtolower($currentStep['type']), 'zalo') !== false) {
                        $totalSentToday['zalo']++;
                    } elseif (strtolower($currentStep['type']) === 'meta_message') {
                        $totalSentToday['meta']++;
                    } elseif (strtolower($currentStep['type']) === 'action') {
                        $totalSentToday['email']++;
                    }
                }
                // [PERF] Persist step_type alongside step_id so tracking_processor can use
                // the indexed column instead of json_decode on every open/click event.
                $_nextStepType = null;
                foreach ($flowSteps as $_pns) {
                    if (trim((string)($_pns['id'] ?? '')) === trim((string)$currentStepId)) {
                        $_nextStepType = $_pns['type'] ?? null;
                        break;
                    }
                }
                $pdo->prepare("UPDATE subscriber_flow_states SET step_id = ?, step_type = ?, last_step_at = NOW(), updated_at = NOW() WHERE id = ?")
                    ->execute([$currentStepId, $_nextStepType, $queueId]);
                // [BUG-FLOW-10] Update last_step_at in RAM so consecutive Wait steps don't reuse stale timestamp
                $item['last_step_at'] = $now;
                $pdo->commit();
                $pdo->beginTransaction();
                $isPriorityChain = false; // After first action, constraints apply
                continue;
            } else {
                $_waitStepType = null;
                foreach ($flowSteps as $_pws) {
                    if (trim((string)($_pws['id'] ?? '')) === trim((string)$currentStepId)) {
                        $_waitStepType = $_pws['type'] ?? null;
                        break;
                    }
                }
                $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = ?, step_id = ?, step_type = ?, updated_at = NOW(), last_step_at = NOW() WHERE id = ?")->execute([$execResult['scheduled_at'], $currentStepId, $_waitStepType, $queueId]);
                $item['last_step_at'] = $now;
                $shouldContinueChain = false;
            }
        } else {
            if ($execResult['status'] === 'completed') {
                $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', step_type = NULL, updated_at = NOW() WHERE id = ?")->execute([$queueId]);
                $pdo->prepare("UPDATE flows SET stat_completed = stat_completed + 1 WHERE id = ?")->execute([$flowId]);
            } else {
                $_genStepType = null;
                foreach ($flowSteps as $_gs) {
                    if (trim((string)($_gs['id'] ?? '')) === trim((string)$currentStepId)) {
                        $_genStepType = $_gs['type'] ?? null;
                        break;
                    }
                }
                $pdo->prepare("UPDATE subscriber_flow_states SET status = ?, scheduled_at = ?, step_type = ?, updated_at = NOW(), step_id = ? WHERE id = ?")->execute([$execResult['status'], $execResult['scheduled_at'] ?? $now, $_genStepType, $currentStepId, $queueId]);
            }
            $shouldContinueChain = false;
        }
    }

    // NEW: Prevent infinite priority loops
    if ($shouldContinueChain && $stepsProcessedInRun >= $MAX_STEPS) {
        $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = NOW(), step_id = ?, updated_at = NOW() WHERE id = ?")->execute([$currentStepId, $queueId]);
        $logs[] = "  -> Reached limit ($MAX_STEPS). Pausing chain to prevent priority loop.";
    }

    if ($pdo->inTransaction())
        $pdo->commit();
    $logs[] = "[Priority-Chain] Chain executed. Steps: $stepsProcessedInRun";

    // [FIX] Force-flush any buffered Mailer delivery logs into DB before script exits.
    // Mailer.php batches logs in memory (writes every 10 emails). If the priority chain
    // processed < 10 email steps, those logs would be silently lost without this call.
    if (function_exists('flushActivityLogBuffer')) {
        flushActivityLogBuffer($pdo);
    }
    // [PHASE 8] Flush FlowExecutor RAM Buffer before exit context
    if (isset($flowExecutor) && method_exists($flowExecutor, 'flushStatsBuffer')) {
        $flowExecutor->flushStatsBuffer();
    }
    $mailer->closeConnection();

} catch (Throwable $e) {
    // Global catch block for any unexpected errors during processing
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        $logs[] = "[ERROR] An exception occurred in priority chain for Queue ID {$queueId} (Sub: {$subscriberId}, Flow: {$flowId}): " . $e->getMessage() . " on line " . $e->getLine() . " in " . $e->getFile();
        // Mark the current queue item as failed or put it back to 'waiting' for inspection
        if ($queueIdToUpdate) {
            // [FIX] Schedule +10min to prevent infinite pick-up loop when exception occurs
            $retryAt = date('Y-m-d H:i:s', time() + 600);
            $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = ?, last_error = ?, updated_at = NOW() WHERE id = ?")
                ->execute([$retryAt, $e->getMessage(), $queueIdToUpdate]);
            $logs[] = "  -> Queue item {$queueIdToUpdate} set to waiting (retry at $retryAt) due to error: " . $e->getMessage();
        }
    } else {
        $logs[] = "[ERROR] An exception occurred (no active transaction): " . $e->getMessage() . " on line " . $e->getLine() . " in " . $e->getFile();
    }
} finally {
    if ($pdo->inTransaction()) { // Should not happen after explicit commit/rollback, but good defensive programming
        $pdo->rollBack();
        $logs[] = "[WARNING] Transaction was still open in finally block and was rolled back defensively.";
    }
}

// Add log to file for debugging
$logs[] = "--- PRIORITY WORKER FINISHED: " . date('Y-m-d H:i:s') . " ---";
file_put_contents(__DIR__ . '/worker_priority.log', implode("\n", $logs) . "\n", FILE_APPEND | LOCK_EX);
echo implode("\n", $logs);

