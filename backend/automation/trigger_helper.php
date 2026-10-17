<?php
function triggerFlows($pdo, $subscriberId, $triggerType, $targetValue, $workspaceId = null)
{
    $params = [
        'subscriber_id' => $subscriberId,
        'trigger_type' => $triggerType,
        'target_id' => $targetValue
    ];
    
    if ($workspaceId) {
        $params['workspace_id'] = $workspaceId;
    }

    // For single subscriber triggers, use the priority worker for instant execution and chaining
    $workerParams = http_build_query($params);

    // [OPTIMIZED] Use centralized WorkerTriggerService
    require_once __DIR__ . '/WorkerTriggerService.php';
    $triggerService = new WorkerTriggerService($pdo, API_BASE_URL);
    $triggerService->trigger('/worker_priority.php?' . $workerParams);

    return 1;
}

/**
 * HIGH PERFORMANCE BULK ENROLLMENT
 * Replaces individual CURL triggers with set-based SQL and single worker trigger.
 * [SECURITY FIX] Added optional $workspaceId to ensure flows are scoped to the correct tenant.
 */
function enrollSubscribersBulk($pdo, array $subscriberIds, $triggerType, $targetValue = null, $workspaceId = null, $specificFlowId = null)
{
    if (empty($subscriberIds))
        return 0;

    // [AUTO-DETECT WORKSPACE] If not provided, fetch from the first subscriber
    if ($workspaceId === null) {
        $stmtW = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
        $stmtW->execute([$subscriberIds[0]]);
        $workspaceId = $stmtW->fetchColumn();
    }

    if ($workspaceId === null) {
        return 0; // Could not determine workspace
    }

    // 1. Find matching flows using the optimized trigger_type column
    // [FIX] Added workspace_id scoping + optional specificFlowId to prevent cross-enrolling into unrelated date/segment flows
    $sqlFlows = "SELECT id, workspace_id, name, steps, config FROM flows WHERE workspace_id = ? AND status = 'active' AND (trigger_type = ? OR trigger_type = 'erp_event' OR trigger_type = 'custom_event' OR trigger_type = 'segment' OR trigger_type = 'list' OR trigger_type IS NULL)";
    $flowParams = [$workspaceId, $triggerType];
    if ($specificFlowId !== null && $specificFlowId !== '') {
        $sqlFlows .= " AND id = ?";
        $flowParams[] = $specificFlowId;
    }
    $stmtFlows = $pdo->prepare($sqlFlows);
    $stmtFlows->execute($flowParams);
    $flows = $stmtFlows->fetchAll();

    $enrolledTotal = 0;
    foreach ($flows as $flow) {
        $enrolledInThisFlow = 0;
        $steps = json_decode($flow['steps'], true) ?: [];
        $fConfig = json_decode($flow['config'], true) ?: [];
        $frequency = $fConfig['frequency'] ?? 'one-time';
        $allowMultiple = !empty($fConfig['allowMultiple']);
        $maxEnrollments = (int) ($fConfig['maxEnrollments'] ?? 0);
        $cooldownHours = (int) ($fConfig['enrollmentCooldownHours'] ?? 12);

        $trigger = null;
        foreach ($steps as $s)
            if ($s['type'] === 'trigger')
                $trigger = $s;

        if (!$trigger || !isset($trigger['nextStepId']))
            continue;

        $tConfig = $trigger['config'] ?? [];
        $flowTriggerType = $tConfig['type'] ?? 'segment';
        $flowTargetSubtype = $tConfig['targetSubtype'] ?? ''; 
        $flowTargetId = $tConfig['targetId'] ?? '';

        // Match "list" or "added_to_list" trigger against flows that are "list" or "segment" with list/sync subtype
        $isMatch = false;
        if ($flowTriggerType === $triggerType) {
            $isMatch = true;
        } elseif (in_array($triggerType, ['erp_event', 'custom_event'], true) && in_array($flowTriggerType, ['erp_event', 'custom_event'], true)) {
            $isMatch = true;
        } elseif (($triggerType === 'list' || $triggerType === 'added_to_list') && ($flowTriggerType === 'list' || ($flowTriggerType === 'segment' && in_array($flowTargetSubtype, ['list', 'sync'], true)))) {
            $isMatch = true;
        }

        // Target Matching Logic
        $targetMatched = ($flowTargetId == $targetValue || empty($flowTargetId) || $flowTargetId === 'all');

        // SPECIAL CASE: Inbound Message Keyword Logic
        if ($isMatch && $triggerType === 'inbound_message' && !empty($flowTargetId) && $flowTargetId !== 'all') {
            $keywords = array_map('trim', explode(',', mb_strtolower($flowTargetId, 'UTF-8')));
            $msgLower = mb_strtolower($targetValue, 'UTF-8');
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
            // [P2 FIX] Block triggers if the target tag is inactive
            if (($triggerType === 'tag' || $flowTriggerType === 'tag') && !empty($flowTargetId) && $flowTargetId !== 'all') {
                // [PERF] Local cache for tag status to avoid N+1 in high-volume triggers
                static $tagStatusCache = [];
                $tagCacheKey = $workspaceId . ':' . $flowTargetId;
                if (!isset($tagStatusCache[$tagCacheKey])) {
                    $stmtTagCheck = $pdo->prepare("SELECT status FROM domation_tags WHERE name = ? AND workspace_id = ?");
                    $stmtTagCheck->execute([$flowTargetId, $workspaceId]);
                    $tagStatusCache[$tagCacheKey] = $stmtTagCheck->fetchColumn() ?: 'unknown';
                }
                
                if ($tagStatusCache[$tagCacheKey] === 'inactive') {
                    continue; 
                }
            }

            $pastTime = date('Y-m-d H:i:s', strtotime('-1 second'));
            $initialSchedule = $pastTime;

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

            $nextStepId = $trigger['nextStepId'];
            $nextStepType = 'unknown';
            foreach ($steps as $fs) {
                if ($fs['id'] === $nextStepId) {
                    $nextStepType = $fs['type'] ?? 'unknown';
                    break;
                }
            }

            // ATOMIC INSERT SELECT: Prevents duplicates based on frequency and status
            $existsCheckSql = "";
            $checkParams = [];
            
            $enrollStrategy = $tConfig['enrollStrategy'] ?? 'all';
            if ($enrollStrategy === 'new_only') {
                $existsCheckSql .= " AND NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.workspace_id = ? AND sfs.subscriber_id = s.id AND sfs.flow_id = ? AND sfs.status = 'cancelled')";
                $checkParams[] = $workspaceId;
                $checkParams[] = $flow['id'];
            }

            if ($frequency === 'one-time') {
                $existsCheckSql .= " AND NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.workspace_id = ? AND sfs.subscriber_id = s.id AND sfs.flow_id = ?)";
                $checkParams[] = $workspaceId;
                $checkParams[] = $flow['id'];
            } else {
                $checks = [];
                if ($maxEnrollments > 0) {
                    $checks[] = "(SELECT COUNT(*) FROM subscriber_flow_states sfs WHERE sfs.workspace_id = ? AND sfs.subscriber_id = s.id AND sfs.flow_id = ?) < $maxEnrollments";
                    $checkParams[] = $workspaceId;
                    $checkParams[] = $flow['id'];
                }
                if ($allowMultiple) {
                    $checks[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.workspace_id = ? AND sfs.subscriber_id = s.id AND sfs.flow_id = ? AND (sfs.status IN ('waiting', 'processing') OR sfs.created_at >= DATE_SUB(NOW(), INTERVAL 3 SECOND)))";
                    $checkParams[] = $workspaceId;
                    $checkParams[] = $flow['id'];
                } else {
                    $safeHours = (int)$cooldownHours;
                    $checks[] = "NOT EXISTS (
                        SELECT 1 FROM subscriber_flow_states sfs 
                        WHERE sfs.workspace_id = ?
                        AND sfs.subscriber_id = s.id 
                        AND sfs.flow_id = ? 
                        AND (sfs.status IN ('waiting', 'processing') OR sfs.updated_at > DATE_SUB(NOW(), INTERVAL $safeHours HOUR))
                    )";
                    $checkParams[] = $workspaceId;
                    $checkParams[] = $flow['id'];
                }
                if (!empty($checks)) {
                    $existsCheckSql .= " AND " . implode(" AND ", $checks);
                }
            }

            $enrollLockKey = count($subscriberIds) === 1 ? 'enroll_' . $flow['id'] . '_' . md5($subscriberIds[0]) : 'enroll_flow_' . $flow['id'];
            $lockAcquired = false;
            try {
                $stmtLock = $pdo->prepare('SELECT GET_LOCK(?, 3)');
                $stmtLock->execute([$enrollLockKey]);
                $lockAcquired = (bool) $stmtLock->fetchColumn();
                if (!$lockAcquired) {
                    error_log("[trigger_helper] Could not acquire enroll lock for flow {$flow['id']} \u2014 skipping to avoid duplicate");
                    continue;
                }
            } catch (Exception $lockEx) {
                error_log("[trigger_helper] GET_LOCK failed: " . $lockEx->getMessage());
            }

            $ENROLL_CHUNK = 500;
            foreach (array_chunk($subscriberIds, $ENROLL_CHUNK) as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '?'));

                $sqlIns = "INSERT INTO subscriber_flow_states (workspace_id, subscriber_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
                           SELECT ?, s.id, s.contact_id, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW()
                           FROM subscribers s
                           WHERE s.id IN ($placeholders)
                           AND s.workspace_id = ?
                           AND s.status IN ('active', 'lead', 'customer')
                           $existsCheckSql";

                $params = array_merge([$workspaceId, $flow['id'], $nextStepId, $nextStepType, $initialSchedule], $chunk, [$workspaceId], $checkParams);
                $stmt = $pdo->prepare($sqlIns);
                $stmt->execute($params);
                $enrolledInThisFlow += $stmt->rowCount();
            }

            if ($enrolledInThisFlow > 0) {
                $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + ? WHERE id = ?")->execute([$enrolledInThisFlow, $flow['id']]);
                $enrolledTotal += $enrolledInThisFlow;
            }
            if ($lockAcquired) {
                $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$enrollLockKey]);
            }
        }
    }

    if ($enrolledTotal > 0) {
        dispatchQueueJob($pdo, 'flows', ['mode' => 'batch']);
    }

    return $enrolledTotal;
}

function checkDynamicTriggers($pdo, $subscriberId)
{
    require_once 'segment_helper.php';

    // [SECURITY FIX] Fetch subscriber's workspace_id first
    $stmtW = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
    $stmtW->execute([$subscriberId]);
    $workspaceId = $stmtW->fetchColumn();
    
    if (!$workspaceId) return;

    // 1. Get Active Flows with Segment or Date triggers
    // [BUG-FIX #13] Added trigger_type filter 
    // [SECURITY FIX] Added workspace_id filter
    $stmtFlows = $pdo->prepare("SELECT id, name, steps, config FROM flows WHERE workspace_id = ? AND status = 'active' AND trigger_type IN ('segment', 'date')");
    $stmtFlows->execute([$workspaceId]);
    $flows = $stmtFlows->fetchAll();

    foreach ($flows as $flow) {
        $steps = json_decode($flow['steps'], true) ?: [];
        $trigger = null;
        foreach ($steps as $s)
            if ($s['type'] === 'trigger')
                $trigger = $s;

        if (!$trigger)
            continue;
        $tType = $trigger['config']['type'] ?? '';
        $tTargetId = $trigger['config']['targetId'] ?? '';

        // A. Segment Trigger
        if ($tType === 'segment') {
            $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
            $stmtSeg->execute([$tTargetId, $workspaceId]);
            $criteriaJson = $stmtSeg->fetchColumn();

            if ($criteriaJson) {
                $segRes = buildSegmentWhereClause($criteriaJson, $workspaceId, $tTargetId);
                // Check if THIS subscriber matches criteria
                $sql = "SELECT 1 FROM subscribers s WHERE s.id = ? AND " . $segRes['sql'] . " LIMIT 1";
                $params = array_merge([$subscriberId], $segRes['params']);
                $stmtCheck = $pdo->prepare($sql);
                $stmtCheck->execute($params);
                if ($stmtCheck->fetch()) {
                    enrollSubscribersBulk($pdo, [$subscriberId], 'segment', $tTargetId, $workspaceId, $flow['id']);
                }
            }
        }
        // B. Date Trigger (Birthday, Anniversary)
        else if ($tType === 'date') {
            $field = $trigger['config']['dateField'] ?? 'dateOfBirth';
            if ($field === 'dateOfBirth' || $field === 'anniversaryDate' || $field === 'joinedAt') {
                $dbField = 'date_of_birth';
                if ($field === 'anniversaryDate')
                    $dbField = 'anniversary_date';
                if ($field === 'joinedAt')
                    $dbField = 'joined_at';

                $offsetType = $trigger['config']['offsetType'] ?? 'on';
                $offsetValue = (int) ($trigger['config']['offsetValue'] ?? 0);
                $triggerHour = (int) ($trigger['config']['triggerHour'] ?? 8);
                $triggerMin = (int) ($trigger['config']['triggerMinute'] ?? 0);

                // ✅ Check hour:minute window (±5 min)
                $nowTotal = (int) date('H') * 60 + (int) date('i');
                $targetTotal = $triggerHour * 60 + $triggerMin;
                if (abs($nowTotal - $targetTotal) > 5)
                    continue;

                $targetDateExpr = "NOW()";
                if ($offsetType === 'before')
                    $targetDateExpr = "DATE_ADD(NOW(), INTERVAL $offsetValue DAY)";
                if ($offsetType === 'after')
                    $targetDateExpr = "DATE_SUB(NOW(), INTERVAL $offsetValue DAY)";

                $sql = "SELECT 1 FROM subscribers s WHERE s.id = ? AND DATE_FORMAT(s.$dbField, '%m-%d') = DATE_FORMAT($targetDateExpr, '%m-%d')";

                $targetMode = $trigger['config']['targetLists'] ?? 'all';
                $targetListIds = $trigger['config']['targetListIds'] ?? [];
                $targetSegmentIds = $trigger['config']['targetSegmentIds'] ?? [];

                $params = [$subscriberId];
                if ($targetMode === 'specific') {
                    $sourceConditions = [];
                    if (!empty($targetListIds)) {
                        $phl = implode(',', array_fill(0, count($targetListIds), '?'));
                        $sourceConditions[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE workspace_id = ? AND list_id IN ($phl))";
                        $params = array_merge($params, [$workspaceId], $targetListIds);
                    }
                    if (!empty($targetSegmentIds)) {
                        foreach ($targetSegmentIds as $segId) {
                            $stmtSeg2 = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                            $stmtSeg2->execute([$segId, $workspaceId]);
                            $segConfig = $stmtSeg2->fetchColumn();
                            if ($segConfig) {
                                $segRes = buildSegmentWhereClause($segConfig, $workspaceId, $segId);
                                if ($segRes && !empty($segRes['sql'])) {
                                    $sourceConditions[] = "({$segRes['sql']})";
                                    if (!empty($segRes['params']))
                                        $params = array_merge($params, $segRes['params']);
                                }
                            }
                        }
                    }
                    $sql .= !empty($sourceConditions)
                        ? " AND (" . implode(" OR ", $sourceConditions) . ")"
                        : " AND 1=0";
                }

                $stmtDate = $pdo->prepare($sql);
                $stmtDate->execute($params);
                if ($stmtDate->fetch()) {
                    enrollSubscribersBulk($pdo, [$subscriberId], 'date', $tTargetId, $workspaceId, $flow['id']);
                }

            } elseif ($field === 'specificDate') {
                // ✅ Trigger vào một ngày cụ thể với offset
                $specificDate = trim($trigger['config']['specificDate'] ?? '');
                if (empty($specificDate))
                    continue;

                $offsetType = $trigger['config']['offsetType'] ?? 'on';
                $offsetValue = (int) ($trigger['config']['offsetValue'] ?? 0);
                $triggerHour = (int) ($trigger['config']['triggerHour'] ?? 8);
                $triggerMin = (int) ($trigger['config']['triggerMinute'] ?? 0);

                // Check hour:minute window (±5 min)
                $nowTotal = (int) date('H') * 60 + (int) date('i');
                $targetTotal = $triggerHour * 60 + $triggerMin;
                if (abs($nowTotal - $targetTotal) > 5)
                    continue;

                // Calculate which date should trigger today
                if ($offsetType === 'before') {
                    // Trigger fires X days before specificDate → today must be specificDate - offsetValue
                    $triggerOnDate = date('Y-m-d', strtotime($specificDate . " -$offsetValue days"));
                } elseif ($offsetType === 'after') {
                    $triggerOnDate = date('Y-m-d', strtotime($specificDate . " +$offsetValue days"));
                } else {
                    $triggerOnDate = $specificDate;
                }

                if (date('Y-m-d') !== $triggerOnDate)
                    continue;

                // List/segment filter
                $targetMode = $trigger['config']['targetLists'] ?? 'all';
                $targetListIds = $trigger['config']['targetListIds'] ?? [];

                if ($targetMode === 'specific' && !empty($targetListIds)) {
                    $phl = implode(',', array_fill(0, count($targetListIds), '?'));
                    $stmtF = $pdo->prepare("SELECT 1 FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id = ? AND list_id IN ($phl)");
                    $stmtF->execute(array_merge([$workspaceId, $subscriberId], $targetListIds));
                    if (!$stmtF->fetch())
                        continue;
                }

                enrollSubscribersBulk($pdo, [$subscriberId], 'date', $tTargetId, $workspaceId, $flow['id']);

            } elseif ($field === 'lastActivity') {
                // ✅ Trigger khi subscriber ngủ đông (không có activity trong N ngày)
                $inactiveDays = (int) ($trigger['config']['inactiveAmount'] ?? 30);

                // Check: không có open/click trong inactiveDays ngày
                $stmtLA = $pdo->prepare("
                    SELECT 1 FROM subscribers s
                    WHERE s.id = ?
                    AND s.status IN ('active','lead','customer')
                    AND (
                        NOT EXISTS (
                            SELECT 1 FROM subscriber_activity sa
                            WHERE sa.workspace_id = ? AND sa.subscriber_id = s.id
                            AND sa.type IN ('open_email','click_link','open_zns','click_zns')
                        )
                        OR (
                            SELECT MAX(sa2.created_at) FROM subscriber_activity sa2
                            WHERE sa2.workspace_id = ? AND sa2.subscriber_id = s.id
                            AND sa2.type IN ('open_email','click_link','open_zns','click_zns')
                        ) < DATE_SUB(NOW(), INTERVAL ? DAY)
                    )
                ");
                $stmtLA->execute([$subscriberId, $workspaceId, $workspaceId, $inactiveDays]);
                if (!$stmtLA->fetch())
                    continue;

                // List filter
                $targetMode = $trigger['config']['targetLists'] ?? 'all';
                $targetListIds = $trigger['config']['targetListIds'] ?? [];

                if ($targetMode === 'specific' && !empty($targetListIds)) {
                    $phl = implode(',', array_fill(0, count($targetListIds), '?'));
                    $stmtF = $pdo->prepare("SELECT 1 FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id = ? AND list_id IN ($phl)");
                    $stmtF->execute(array_merge([$workspaceId, $subscriberId], $targetListIds));
                    if (!$stmtF->fetch())
                        continue;
                }

                enrollSubscribersBulk($pdo, [$subscriberId], 'date', $tTargetId, $workspaceId, $flow['id']);

            } elseif ($field === 'custom_field_date') {
                // Trigger based on a date stored in a custom attribute
                $customFieldKey = $trigger['config']['customFieldKey'] ?? '';
                if (empty($customFieldKey))
                    continue;

                $offsetType = $trigger['config']['offsetType'] ?? 'on';
                $offsetValue = (int) ($trigger['config']['offsetValue'] ?? 0);
                $triggerHour = (int) ($trigger['config']['triggerHour'] ?? 8);
                $triggerMin = (int) ($trigger['config']['triggerMinute'] ?? 0);

                // Match within a 5-minute execution window around the configured HH:MM
                // (handles cron running every 5 min or every 1 min)
                $nowTotalMin = (int) date('H') * 60 + (int) date('i');
                $targetTotalMin = $triggerHour * 60 + $triggerMin;
                if (abs($nowTotalMin - $targetTotalMin) > 5)
                    continue;

                // Fetch subscriber's custom_attributes
                $stmtAttr = $pdo->prepare("SELECT custom_attributes FROM subscribers WHERE id = ?");
                $stmtAttr->execute([$subscriberId]);
                $rawAttrs = $stmtAttr->fetchColumn();
                if (!$rawAttrs)
                    continue;
                $attrs = json_decode($rawAttrs, true);
                if (!is_array($attrs) || !isset($attrs[$customFieldKey]))
                    continue;

                $rawDate = trim($attrs[$customFieldKey]);
                if (empty($rawDate))
                    continue;

                // Parse date (support YYYY-MM-DD and DD/MM/YYYY)
                $ts = strtotime($rawDate);
                if (!$ts) {
                    // Try DD/MM/YYYY
                    $parts = explode('/', $rawDate);
                    if (count($parts) === 3) {
                        $ts = mktime(0, 0, 0, (int) $parts[1], (int) $parts[0], (int) $parts[2]);
                    }
                }
                if (!$ts)
                    continue;

                $fieldDate = date('Y-m-d', $ts);

                // Calculate target date based on offsetType
                if ($offsetType === 'before') {
                    $targetDate = date('Y-m-d', strtotime("+$offsetValue days"));
                } elseif ($offsetType === 'after') {
                    $targetDate = date('Y-m-d', strtotime("-$offsetValue days"));
                } else {
                    $targetDate = date('Y-m-d');
                }

                // Compare only month-day (for annual) or full date
                if ($fieldDate !== $targetDate)
                    continue;

                // Apply list/segment filtering if configured
                $targetMode = $trigger['config']['targetLists'] ?? 'all';
                $targetListIds = $trigger['config']['targetListIds'] ?? [];

                if ($targetMode === 'specific' && !empty($targetListIds)) {
                    $placeholders = implode(',', array_fill(0, count($targetListIds), '?'));
                    $stmtFilter = $pdo->prepare(
                        "SELECT 1 FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id = ? AND list_id IN ($placeholders)"
                    );
                    $stmtFilter->execute(array_merge([$workspaceId, $subscriberId], $targetListIds));
                    if (!$stmtFilter->fetch())
                        continue; // Not in any target list
                }

                enrollSubscribersBulk($pdo, [$subscriberId], 'date', $tTargetId, $workspaceId, $flow['id']);
            }
        }
    }
}

// [EVENT-DRIVEN ARCHITECTURE] Wake up subscriber waiting in flows
if (!function_exists('wakeupWaitingSubscribers')) {
    function wakeupWaitingSubscribers($pdo, $subscriberId, $workspaceId = null) {
        if (!$subscriberId) return;

        // [FIX] Ensure workspaceId is present
        if ($workspaceId === null) {
            $stmtW = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
            $stmtW->execute([$subscriberId]);
            $workspaceId = $stmtW->fetchColumn();
        }

        if (!$workspaceId) return;

        try {
            // [FIX] Only wakeup 'condition' steps. 'wait' steps are time-based and should NOT be shortened by activity.
            // This prevents duration-based waits (e.g. Wait 3 Days) from being skipped when a user performs 
            // any action (click/open) from a previous step or different flow.
            $stmt = $pdo->prepare("UPDATE subscriber_flow_states SET scheduled_at = NOW() WHERE workspace_id = ? AND subscriber_id = ? AND status = 'waiting' AND step_type = 'condition' AND scheduled_at > NOW()");
            $stmt->execute([$workspaceId, $subscriberId]);
            if ($stmt->rowCount() > 0) {
                error_log("[wakeupWaitingSubscribers] Woke up Subscriber:{$subscriberId} (Step:Condition) in WS:{$workspaceId}");
                // Trigger priority worker in batch mode to immediately execute the next flow step for the woken up subscriber
                try {
                    require_once __DIR__ . '/WorkerTriggerService.php';
                    $triggerService = new WorkerTriggerService($pdo, API_BASE_URL);
                    $triggerService->trigger('/worker_priority.php?' . http_build_query([
                        'mode' => 'batch',
                        'workspace_id' => $workspaceId
                    ]));
                } catch (Exception $triggerEx) {
                    error_log("[wakeupWaitingSubscribers] Worker trigger failed: " . $triggerEx->getMessage());
                }
            }
        } catch (Exception $e) {
            error_log('[wakeupWaitingSubscribers] Failed: ' . $e->getMessage());
        }
    }
}

if (!class_exists('DomationEventDispatcher')) {
    class DomationEventDispatcher
    {
        public static function dispatch($pdo, int $contactId, string $eventCode, array $meta = []): void
        {
            if ($contactId <= 0 || trim($eventCode) === '') {
                return;
            }
            try {
                $stmtSub = $pdo->prepare("SELECT id, workspace_id FROM subscribers WHERE contact_id = ? LIMIT 1");
                $stmtSub->execute([$contactId]);
                $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);

                if (!$sub) {
                    $stmtC = $pdo->prepare("SELECT id, full_name, email, phone, source, owner_id, stage_id, lead_status, temperature, city, district FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                    $stmtC->execute([$contactId]);
                    $cRow = $stmtC->fetch(PDO::FETCH_ASSOC);
                    if (!$cRow) {
                        return;
                    }
                    $email = trim((string) ($cRow['email'] ?? ''));
                    $phone = trim((string) ($cRow['phone'] ?? ''));
                    if ($email !== '') {
                        $stmtByEmail = $pdo->prepare("SELECT id, workspace_id FROM subscribers WHERE email = ? LIMIT 1");
                        $stmtByEmail->execute([$email]);
                        $sub = $stmtByEmail->fetch(PDO::FETCH_ASSOC);
                    }
                    if (!$sub && $phone !== '') {
                        $stmtByPhone = $pdo->prepare("SELECT id, workspace_id FROM subscribers WHERE phone_number = ? LIMIT 1");
                        $stmtByPhone->execute([$phone]);
                        $sub = $stmtByPhone->fetch(PDO::FETCH_ASSOC);
                    }
                    if ($sub && !empty($sub['id'])) {
                        $pdo->prepare("UPDATE subscribers SET contact_id = ? WHERE id = ? AND (contact_id IS NULL OR contact_id = 0)")
                            ->execute([$contactId, $sub['id']]);
                    } else {
                        $wsStmt = $pdo->query("SELECT id FROM workspaces ORDER BY id ASC LIMIT 1");
                        $defaultWs = $wsStmt ? ($wsStmt->fetchColumn() ?: 'ws_default') : 'ws_default';
                        $subId = 'sub_erp_' . $contactId . '_' . substr(md5((string) microtime(true)), 0, 6);
                        $safeEmail = $email !== '' ? $email : ("contact_{$contactId}@myerp.local");
                        $pdo->prepare("
                            INSERT IGNORE INTO subscribers (id, workspace_id, contact_id, email, first_name, phone_number, source, status, stage_id, lead_status, temperature, owner_id, city, district, joined_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'customer', ?, ?, ?, ?, ?, ?, NOW())
                        ")->execute([
                            $subId,
                            $defaultWs,
                            $contactId,
                            $safeEmail,
                            $cRow['full_name'] ?? 'Khách hàng',
                            $phone !== '' ? $phone : null,
                            $cRow['source'] ?? 'MYERP CRM',
                            $cRow['stage_id'] ?? null,
                            $cRow['lead_status'] ?? 'active',
                            $cRow['temperature'] ?? 'hot',
                            $cRow['owner_id'] ?? null,
                            $cRow['city'] ?? null,
                            $cRow['district'] ?? null
                        ]);
                        $sub = ['id' => $subId, 'workspace_id' => $defaultWs];
                    }
                }

                $subscriberId = (string) ($sub['id'] ?? '');
                $workspaceId = (string) ($sub['workspace_id'] ?? '');
                if ($subscriberId === '' || $workspaceId === '') {
                    return;
                }

                enrollSubscribersBulk($pdo, [$subscriberId], 'erp_event', $eventCode, $workspaceId);
                wakeupWaitingSubscribers($pdo, $subscriberId, $workspaceId);
                checkDynamicTriggers($pdo, $subscriberId);
            } catch (\Throwable $e) {
                error_log('[DomationEventDispatcher] Non-blocking error for contact ' . $contactId . ' (' . $eventCode . '): ' . $e->getMessage());
            }
        }
    }
}

?>
