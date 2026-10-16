<?php
// api/worker_trigger.php - OMNI-ENGINE V29.6 (POLLING TRIGGERS: DATE, CAMPAIGN, DORMANT)
// Trigger this via CRON every hour or 15 mins.
// Example: php /path/to/api/worker_trigger.php

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
set_time_limit(300);

// [FIX P8-H2] Use __DIR__-anchored paths so cron can call this file from any CWD.
// Relative paths (e.g. 'db_connect.php') fail when PHP process CWD != api/ directory.
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once __DIR__ . '/trigger_helper.php';
require_once __DIR__ . '/segment_helper.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

$logs = [];
$logs[] = "--- TRIGGER WORKER START: " . date('Y-m-d H:i:s') . " ---";
$startGlobalTime = time();

$stmtLock = $pdo->query("SELECT GET_LOCK('worker_trigger_lock', 0)");
if (!$stmtLock->fetchColumn()) {
    echo "Worker trigger is already running.\n";
    exit;
}
// [FIX P8-C1] Register shutdown handler to release advisory lock even on crash.
// Without this, the lock is held until the MySQL connection closes.
// On PHP-FPM with persistent connections, this blocks ALL subsequent cron runs.
register_shutdown_function(function () use ($pdo) {
    try { $pdo->query("SELECT RELEASE_LOCK('worker_trigger_lock')"); } catch (Throwable $e) {}
});

try {
    // 1. Fetch Active Flows with Polling Triggers
    // [SECURITY FIX] Added workspace_id to SELECT
    $stmtFlows = $pdo->prepare("SELECT id, name, steps, config, workspace_id FROM flows WHERE status = 'active' AND (steps LIKE '%\"type\":\"date\"%' OR steps LIKE '%\"type\":\"campaign\"%')");
    $stmtFlows->execute();
    $flows = $stmtFlows->fetchAll();

    foreach ($flows as $flow) {
        unset($cachedSourceSql);
        unset($cachedSourceParams);

        $steps = json_decode($flow['steps'], true) ?: [];
        $trigger = null;
        foreach ($steps as $s) {
            if ($s['type'] === 'trigger') {
                $trigger = $s;
                break;
            }
        }

        if (!$trigger)
            continue;

        $fConfig = json_decode($flow['config'] ?? '{}', true) ?: [];
        $frequency = $fConfig['frequency'] ?? 'one-time';
        $cooldownHours = (int) ($fConfig['enrollmentCooldownHours'] ?? 24);
        if ($cooldownHours < 1)
            $cooldownHours = 1; // Minimum safety
        
        $wsId = $flow['workspace_id'];
        $tType = $trigger['config']['type'] ?? '';
        $tTargetId = $trigger['config']['targetId'] ?? '';

        $startTime = time();
        $BATCH_SIZE = 500;

        // --- CASE A: DATE TRIGGER (Born Today / Anniversary Today) ---
        if ($tType === 'date') {
            $field = $trigger['config']['dateField'] ?? 'dateOfBirth';

            if ($field === 'dateOfBirth' || $field === 'anniversaryDate' || $field === 'joinedAt') {
                $dbField = 'date_of_birth';
                if ($field === 'anniversaryDate')
                    $dbField = 'anniversary_date';
                if ($field === 'joinedAt')
                    $dbField = 'joined_at';

                $allParams = [];
                do {
                    if (time() - $startGlobalTime > 250)
                        break; // Re-add timeout check

                    $offsetType = $trigger['config']['offsetType'] ?? 'on';
                    $offsetValue = (int) ($trigger['config']['offsetValue'] ?? 0);
                    $targetDateExpr = "NOW()";
                    if ($offsetType === 'before') {
                        $targetDateExpr = "DATE_ADD(NOW(), INTERVAL $offsetValue DAY)";
                    } else if ($offsetType === 'after') {
                        $targetDateExpr = "DATE_SUB(NOW(), INTERVAL $offsetValue DAY)";
                    }

                    $wheres = [];
                    $wheres[] = "DATE_FORMAT($dbField, '%m-%d') = DATE_FORMAT($targetDateExpr, '%m-%d')";
                    $wheres[] = "s.status IN ('active', 'lead', 'customer')";
                    // [SECURITY FIX] Filter by workspace_id
                    $wheres[] = "s.workspace_id = ?";
                    // [BUG-FLOW-13] Exclude already-enrolled subscribers when frequency === 'one-time', else respect cooldown
                    if ($frequency === 'one-time') {
                        $wheres[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ?)";
                    } else {
                        $wheres[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ? AND (sfs.status IN ('waiting', 'processing') OR sfs.created_at > DATE_SUB(NOW(), INTERVAL $cooldownHours HOUR)))";
                    }

                    // [OPTIMIZATION] Build Source SQL once per Flow, not per chunk
                    if (!isset($cachedSourceSql)) {
                        $cachedSourceSql = "";
                        $cachedSourceParams = [];
                        $targetMode = $trigger['config']['targetLists'] ?? 'all';
                        $targetListIds = $trigger['config']['targetListIds'] ?? [];
                        $targetSegmentIds = $trigger['config']['targetSegmentIds'] ?? [];

                        if ($targetMode === 'specific' && (!empty($targetListIds) || !empty($targetSegmentIds))) {
                            $sourceConditions = [];
                            if (!empty($targetListIds)) {
                                $placeholders = implode(',', array_fill(0, count($targetListIds), '?'));
                                $sourceConditions[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id IN ($placeholders))";
                                $cachedSourceParams = array_merge($cachedSourceParams, $targetListIds);
                            }
                            if (!empty($targetSegmentIds)) {
                                // [PERF] Pre-fetch all segments for this flow to avoid N+1
                                $placeholdersSeg = implode(',', array_fill(0, count($targetSegmentIds), '?'));
                                $stmtSegs = $pdo->prepare("SELECT id, criteria FROM segments WHERE id IN ($placeholdersSeg) AND workspace_id = ?");
                                $stmtSegs->execute(array_merge($targetSegmentIds, [$wsId]));
                                $segmentsMap = $stmtSegs->fetchAll(PDO::FETCH_KEY_PAIR);

                                foreach ($targetSegmentIds as $segId) {
                                    $segConfig = $segmentsMap[$segId] ?? null;
                                    if ($segConfig) {
                                        $segRes = buildSegmentWhereClause($segConfig, $wsId, $segId);
                                        if ($segRes && !empty($segRes['sql'])) {
                                            $sourceConditions[] = "({$segRes['sql']})";
                                            if (!empty($segRes['params']))
                                                $cachedSourceParams = array_merge($cachedSourceParams, $segRes['params']);
                                        }
                                    }
                                }
                            }
                            if (!empty($sourceConditions)) {
                                $cachedSourceSql = " AND (" . implode(" OR ", $sourceConditions) . ")";
                            } else {
                                $cachedSourceSql = " AND 1=0";
                            }
                        } elseif ($targetMode === 'specific') {
                            $cachedSourceSql = " AND 1=0";
                        }
                    }

                    $idParams = array_merge([$wsId, $flow['id']], $cachedSourceParams);
                    $whereSql = implode(" AND ", $wheres) . $cachedSourceSql;
                    $sql = "SELECT s.id FROM subscribers s WHERE $whereSql LIMIT $BATCH_SIZE";

                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($idParams);
                    $subs = $stmt->fetchAll(PDO::FETCH_COLUMN);

                    if (!empty($subs)) {
                        $logs[] = "[Date Trigger] Found " . count($subs) . " subs for flow '{$flow['name']}' ($field) in workspace $wsId.";
                        enrollSubscribersBulk($pdo, $subs, 'date', $tTargetId, $wsId);
                    } else {
                        break; // No more found
                    }
                    $isDone = (count($subs) < $BATCH_SIZE);
                    // [OPTIMIZATION] Dọn rác bộ nhớ sau mỗi vòng lặp 500 records
                    unset($subs, $stmt, $idParams, $wheres, $whereSql, $sql);
                    gc_collect_cycles();
                    if ($isDone)
                        break;
                } while (true);
            }
            // --- CASE C: SPECIFIC DATE TRIGGER ---
            else if ($field === 'specificDate') {
                $specificDate = $trigger['config']['specificDate'] ?? '';
                if (empty($specificDate))
                    continue;

                do {
                    if (time() - $startGlobalTime > 250)
                        break;

                    // Match the specific date (YYYY-MM-DD)
                    $wheres = []; // Reset wheres for this specific case
                    $wheres[] = "DATE(NOW()) = ?";
                    $wheres[] = "s.status IN ('active', 'lead', 'customer')";
                    // [SECURITY FIX] Filter by workspace_id
                    $wheres[] = "s.workspace_id = ?";
                    // [BUG-FLOW-13] Push one-time frequency check into SQL NOT EXISTS
                    if ($frequency === 'one-time') {
                        $wheres[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states WHERE subscriber_id = s.id AND flow_id = ?)";
                    } else {
                        $wheres[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states WHERE subscriber_id = s.id AND flow_id = ? AND (status IN ('waiting', 'processing') OR created_at > DATE_SUB(NOW(), INTERVAL $cooldownHours HOUR)))";
                    }

                    // Source Filtering
                    $targetMode = $trigger['config']['targetLists'] ?? 'all';
                    $targetListIds = $trigger['config']['targetListIds'] ?? [];
                    $targetSegmentIds = $trigger['config']['targetSegmentIds'] ?? [];

                    $idParams = [$specificDate, $wsId, $flow['id']];
                    $sourceWheres = [];
                    if ($targetMode === 'specific' && (!empty($targetListIds) || !empty($targetSegmentIds))) {
                        $sourceConditions = [];
                        if (!empty($targetListIds)) {
                            $placeholders = implode(',', array_fill(0, count($targetListIds), '?'));
                            $sourceConditions[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id IN ($placeholders))";
                            $idParams = array_merge($idParams, $targetListIds);
                        }
                        if (!empty($targetSegmentIds)) {
                            foreach ($targetSegmentIds as $segId) {
                                $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                                $stmtSeg->execute([$segId, $wsId]);
                                $segConfig = $stmtSeg->fetchColumn();
                                if ($segConfig) {
                                    $segWhere = buildSegmentWhereClause($segConfig, $wsId, $segId);
                                    if ($segWhere && !empty($segWhere['sql'])) {
                                        $sourceConditions[] = "({$segWhere['sql']})";
                                        if (!empty($segWhere['params']))
                                            $idParams = array_merge($idParams, $segWhere['params']);
                                    }
                                }
                            }
                        }
                        if (!empty($sourceConditions)) {
                            $sourceWheres[] = "(" . implode(" OR ", $sourceConditions) . ")";
                        } else {
                            $sourceWheres[] = "1=0";
                        }
                    } elseif ($targetMode === 'specific') {
                        $sourceWheres[] = "1=0";
                    }

                    $totalWheres = array_merge($wheres, $sourceWheres);
                    $whereSql = implode(" AND ", $totalWheres);
                    $sql = "SELECT s.id FROM subscribers s WHERE $whereSql LIMIT $BATCH_SIZE";

                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($idParams);
                    $subs = $stmt->fetchAll(PDO::FETCH_COLUMN);

                    if (!empty($subs)) {
                        $logs[] = "[Specific Date Trigger] Found " . count($subs) . " subs for flow '{$flow['name']}' ($specificDate) in workspace $wsId.";

                        // [FIX #7] Direct INSERT instead of enrollSubscribersBulk().
                        $pastTime = date('Y-m-d H:i:s', strtotime('-1 second'));
                        $initialSchedule = $pastTime;

                        // [SMART SCHEDULE FIX] Calculate future wait date if first step is wait
                        foreach ($steps as $fs) {
                            if ($fs['id'] === $trigger['nextStepId'] && strtolower($fs['type'] ?? '') === 'wait') {
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
                                    $delay = $unitSeconds * $dur;
                                    if ($delay > 0) {
                                        $initialSchedule = date('Y-m-d H:i:s', time() + $delay);
                                    }
                                } elseif ($fsWaitMode === 'until_date') {
                                    $specDate   = $fsWaitConfig['specificDate'] ?? '';
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

                        $subPlaceholders = implode(',', array_fill(0, count($subs), '?'));
                        // [SECURITY FIX] Enforce workspace_id in direct INSERT
                        $sqlDirect = "INSERT INTO subscriber_flow_states
                            (subscriber_id, flow_id, step_id, scheduled_at, status, created_at, updated_at, last_step_at)
                            SELECT s.id, ?, ?, ?, 'waiting', NOW(), NOW(), NOW()
                            FROM subscribers s
                            WHERE s.id IN ($subPlaceholders)
                            AND s.workspace_id = ?
                            AND NOT EXISTS (
                                SELECT 1 FROM subscriber_flow_states sfs
                                WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ?
                                AND sfs.created_at > DATE_SUB(NOW(), INTERVAL $cooldownHours HOUR)
                            )";
                        $directParams = array_merge(
                            [$flow['id'], $trigger['nextStepId'], $initialSchedule],
                            $subs,
                            [$wsId, $flow['id']]
                        );
                        $stmtDirect = $pdo->prepare($sqlDirect);
                        $stmtDirect->execute($directParams);
                        $enrolledCount = $stmtDirect->rowCount();
                        if ($enrolledCount > 0) {
                            $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + ? WHERE id = ?")->execute([$enrolledCount, $flow['id']]);
                            $logs[] = "[Specific Date Trigger] Enrolled $enrolledCount subs into flow '{$flow['name']}'.";
                            if (function_exists('dispatchQueueJob')) {
                                dispatchQueueJob($pdo, 'flows', ['mode' => 'batch']);
                            }
                        }
                    } else {
                        break;
                    }
                    $isDone = (count($subs) < $BATCH_SIZE);
                    // [OPTIMIZATION] Dọn rác bộ nhớ
                    unset($subs, $stmt, $idParams, $wheres, $sourceWheres, $totalWheres, $whereSql, $sql);
                    gc_collect_cycles();
                    if ($isDone)
                        break;
                } while (true);
            }

            // --- CASE B: DORMANT TRIGGER (No activity for X days) ---
            else if ($field === 'lastActivity') {
                $days = (int) ($trigger['config']['inactiveAmount'] ?? 30);
                $cutoffDate = date('Y-m-d H:i:s', strtotime("-$days days"));

                $lastId = '0';
                do {
                    if (time() - $startGlobalTime > 250)
                        break;

                    $wheres = [];
                    $wheres[] = "s.id > ?";
                    $wheres[] = "s.last_activity_at < ?";
                    $wheres[] = "s.status IN ('active', 'lead', 'customer')";
                    // [SECURITY FIX] Filter by workspace_id
                    $wheres[] = "s.workspace_id = ?";

                    // [FIX] Dormant Fire Once Logic
                    if ($frequency === 'one-time') {
                        $wheres[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ?)";
                    } else {
                        $wheres[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ? AND (sfs.status IN ('waiting', 'processing') OR sfs.created_at > DATE_SUB(NOW(), INTERVAL $cooldownHours HOUR)))";
                    }

                    // Source Filtering
                    $targetMode = $trigger['config']['targetLists'] ?? 'all';
                    $targetListIds = $trigger['config']['targetListIds'] ?? [];
                    $targetSegmentIds = $trigger['config']['targetSegmentIds'] ?? [];

                    $idParams = [$lastId, $cutoffDate, $wsId, $flow['id']];
                    $sourceWheres = [];
                    if ($targetMode === 'specific' && (!empty($targetListIds) || !empty($targetSegmentIds))) {
                        $sourceConditions = [];
                        if (!empty($targetListIds)) {
                            $placeholders = implode(',', array_fill(0, count($targetListIds), '?'));
                            $sourceConditions[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id IN ($placeholders))";
                            $idParams = array_merge($idParams, $targetListIds);
                        }
                        if (!empty($targetSegmentIds)) {
                            foreach ($targetSegmentIds as $segId) {
                                $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                                $stmtSeg->execute([$segId, $wsId]);
                                $segConfig = $stmtSeg->fetchColumn();
                                if ($segConfig) {
                                    $segWhere = buildSegmentWhereClause($segConfig, $wsId, $segId);
                                    if ($segWhere && !empty($segWhere['sql'])) {
                                        $sourceConditions[] = "({$segWhere['sql']})";
                                        if (!empty($segWhere['params']))
                                            $idParams = array_merge($idParams, $segWhere['params']);
                                    }
                                }
                            }
                        }
                        if (!empty($sourceConditions)) {
                            $sourceWheres[] = "(" . implode(" OR ", $sourceConditions) . ")";
                        } else {
                            $sourceWheres[] = "1=0";
                        }
                    } elseif ($targetMode === 'specific') {
                        $sourceWheres[] = "1=0";
                    }

                    $totalWheres = array_merge($wheres, $sourceWheres);
                    $whereSql = implode(" AND ", $totalWheres);
                    $sql = "SELECT s.id FROM subscribers s WHERE $whereSql LIMIT $BATCH_SIZE";

                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($idParams);
                    $subs = $stmt->fetchAll(PDO::FETCH_COLUMN);

                    if (!empty($subs)) {
                        $logs[] = "[Dormant Trigger] Found " . count($subs) . " inactive subs for flow '{$flow['name']}' in workspace $wsId.";
                        enrollSubscribersBulk($pdo, $subs, 'date', 'lastActivity', $wsId);
                        $lastId = end($subs);
                    } else {
                        break;
                    }
                    $isDone = (count($subs) < $BATCH_SIZE);
                    // [OPTIMIZATION] Dọn rác bộ nhớ
                    unset($subs, $stmt, $idParams, $wheres, $sourceWheres, $totalWheres, $whereSql, $sql);
                    gc_collect_cycles();
                    if ($isDone)
                        break;
                } while (true);
            }
        }

        // --- CASE C: CAMPAIGN TRIGGER (Opened/Clicked specific Campaign) ---
        else if ($tType === 'campaign') {
            $campaignId = $tTargetId;
            $action = $trigger['config']['campaignAction'] ?? 'opened';
            $actType = 'open_email';
            if ($action === 'clicked')
                $actType = 'click_link';
            if ($action === 'sent')
                $actType = 'receive_email';

            $lastActId = 0;
            do {
                if (time() - $startGlobalTime > 250)
                    break;

                // [FIX] One-time vs Recurring logic for Campaign Triggers
                $existsCheck = "sfs.status IN ('waiting', 'processing') OR sfs.created_at > DATE_SUB(NOW(), INTERVAL $cooldownHours HOUR)";
                if ($frequency === 'one-time') {
                    $existsCheck = "1=1";
                }

                // [SECURITY FIX] JOIN with subscribers to enforce workspace_id
                $sql = "SELECT DISTINCT a.subscriber_id, a.id 
                        FROM subscriber_activity a
                        JOIN subscribers s ON a.subscriber_id = s.id
                        WHERE a.id > ? AND a.campaign_id = ? AND a.type = ?
                        AND s.workspace_id = ?
                        AND NOT EXISTS (
                            SELECT 1 FROM subscriber_flow_states sfs
                            WHERE sfs.subscriber_id = a.subscriber_id 
                            AND sfs.flow_id = ? 
                            AND ($existsCheck)
                        )
                        ORDER BY a.id ASC
                        LIMIT $BATCH_SIZE";

                $stmt = $pdo->prepare($sql);
                $stmt->execute([$lastActId, $campaignId, $actType, $wsId, $flow['id']]);
                $actRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $subs = array_column($actRows, 'subscriber_id');

                if (!empty($subs)) {
                    $logs[] = "[Campaign Trigger] Found " . count($subs) . " subs for flow '{$flow['name']}' (Camp: $campaignId, Act: $actType) in workspace $wsId.";
                    enrollSubscribersBulk($pdo, $subs, 'campaign', $campaignId, $wsId);
                    $lastActId = end($actRows)['id'];
                } else {
                    break;
                }
                $isDone = (count($subs) < $BATCH_SIZE);
                // [OPTIMIZATION] Dọn rác bộ nhớ
                unset($subs, $actRows, $stmt, $sql);
                gc_collect_cycles();
                if ($isDone)
                    break;
            } while (true);
        }
    }

} catch (Exception $e) {
    $logs[] = "[ERROR] " . $e->getMessage();
}

$logs[] = "--- END TRIGGER WORKER ---";

// [FIX P8-C1] Explicitly release advisory lock before log write.
// Ensures next cron run can start immediately without waiting for connection close.
$pdo->query("SELECT RELEASE_LOCK('worker_trigger_lock')");

echo implode("\n", $logs);
// [FIX P8-M2] Use __DIR__-anchored path for log file.
// Relative path 'worker_trigger.log' writes to the PHP process CWD (may be webroot, /,
// or the cron caller's directory — unpredictable and often wrong).
file_put_contents(__DIR__ . '/worker_trigger.log', implode("\n", $logs) . "\n", FILE_APPEND | LOCK_EX);
?>
