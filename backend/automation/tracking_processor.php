<?php
// api/tracking_processor.php - Shared logic for tracking events
// Used by both worker_queue.php (async) and webhook.php (sync fallback)

// [FIX] Use __DIR__-anchored paths so this file works correctly when included
// from CLI/cron workers in different working directories, not just web context.
require_once __DIR__ . '/flow_helpers.php';
require_once __DIR__ . '/trigger_helper.php';

function processTrackingEvent($pdo, $type, $payload)
{
    if ($type === 'stat_update') {
        // [FIX] Use null coalescing to prevent PHP 8+ "Undefined array key" warnings
        // if the worker receives a malformed or incomplete payload.
        $subType = $payload['type'] ?? null;
        $sid = $payload['subscriber_id'] ?? null;
        $rid = $payload['reference_id'] ?? null;
        $fid = $payload['flow_id'] ?? null;
        $cid = $payload['campaign_id'] ?? null;
        $extra = $payload['extra_data'] ?? [];
        $wId = $payload['workspace_id'] ?? null; // [HARDENING] Extract workspace_id from payload

        // [GUARD] Skip processing if critical fields are missing
        if (!$subType || !$sid) {
            error_log('[tracking_processor] Skipping stat_update: missing subType or subscriber_id. Payload: ' . json_encode($payload));
            return false;
        }

        // [DEBOUNCE] Prevent duplicate logging and stats bloat if email pixel/click fires multiple times rapidly (AMPP proxy clones)
        // [FIX P10-M1] Include 'click_zns' in debounce — it is the actual type logged by zalo_track.php for ZNS link clicks.
        // 'zalo_clicked' was a legacy type name from older Zalo CS path; both must be debounced.
        if (in_array($subType, ['open_email', 'click_link', 'zalo_clicked', 'click_zns'])) {
            try {
                // A. IN-MEMORY BUFFER DEBOUNCE (to avoid race conditions within the same batch)
                global $GLOBAL_ACTIVITY_BUFFER;
                if (is_array($GLOBAL_ACTIVITY_BUFFER)) {
                    foreach ($GLOBAL_ACTIVITY_BUFFER as $buf) {
                        // $buf: [$subscriberId, $type, $details, $referenceId, $flowId, $campaignId, $jsonData]
                        if ($buf[0] === $sid && $buf[1] === $subType) {
                            if ($subType === 'click_link' || $subType === 'click_zns') {
                                // Rate-limit: block parallel click events in the same batch
                                return true; 
                            } elseif ($buf[3] === $rid) {
                                // For opens, block duplicates on the same email step in the same batch
                                return true;
                            }
                        }
                    }
                }

                // B. RATE LIMIT FOR CLICKS: Max 1 click per 3 seconds (helps filter out bot parallel link scans)
                if ($subType === 'click_link' || $subType === 'click_zns') {
                    $stmtRate = $pdo->prepare("
                        SELECT 1 FROM subscriber_activity 
                        WHERE subscriber_id = ? AND type = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 3 SECOND)
                        LIMIT 1
                    ");
                    $stmtRate->execute([$sid, $subType]);
                    if ($stmtRate->fetchColumn()) {
                        return true;
                    }
                }

                // C. DEBOUNCE BY URL OR TYPE (1 Minute)
                if ($subType === 'click_link' || $subType === 'click_zns') {
                    $currentUrl = $extra['url'] ?? '';
                    if (!empty($currentUrl)) {
                        $urlQuery = '%' . $currentUrl . '%';
                        
                        // Check main DB for the same URL click
                        $stmtSpam = $pdo->prepare("
                            SELECT 1 FROM subscriber_activity 
                            WHERE subscriber_id = ? AND type = ? AND (reference_id = ? OR (reference_id IS NULL AND ? IS NULL)) 
                            AND details LIKE ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                            LIMIT 1
                        ");
                        $stmtSpam->execute([$sid, $subType, $rid, $rid, $urlQuery]);
                        if ($stmtSpam->fetchColumn()) {
                            return true;
                        }

                        // Check pending database buffer for the same URL click
                        try {
                            $stmtBuf = $pdo->prepare("
                                SELECT 1 FROM activity_buffer
                                WHERE subscriber_id = ? AND type = ? AND (reference_id = ? OR (reference_id IS NULL AND ? IS NULL))
                                AND details LIKE ?
                                LIMIT 1
                            ");
                            $stmtBuf->execute([$sid, $subType, $rid, $rid, $urlQuery]);
                            if ($stmtBuf->fetchColumn()) {
                                return true;
                            }
                        } catch (Exception $eBuf) {}
                    }
                } else {
                    // Standard open/interaction debounce (any open in 1 minute)
                    $stmtSpam = $pdo->prepare("
                        SELECT 1 FROM subscriber_activity 
                        WHERE subscriber_id = ? AND type = ? AND (reference_id = ? OR (reference_id IS NULL AND ? IS NULL)) AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                        LIMIT 1
                    ");
                    $stmtSpam->execute([$sid, $subType, $rid, $rid]);
                    if ($stmtSpam->fetchColumn()) {
                        return true;
                    }

                    try {
                        $stmtBuf = $pdo->prepare("
                            SELECT 1 FROM activity_buffer
                            WHERE subscriber_id = ? AND type = ? AND (reference_id = ? OR (reference_id IS NULL AND ? IS NULL))
                            LIMIT 1
                        ");
                        $stmtBuf->execute([$sid, $subType, $rid, $rid]);
                        if ($stmtBuf->fetchColumn()) {
                            return true;
                        }
                    } catch (Exception $eBuf) {}
                }
            } catch (Exception $e) {
                // Ignore DB check error
            }
        }

        // 1. Log essential activity (PULL FROM CONFIG)
        require_once __DIR__ . '/db_connect.php'; // Ensure db_connect is loaded for getGlobalLeadScoreConfig
        $scoring = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
        $pOpen = $scoring['leadscore_email_open'] ?? 2;
        $pClick = $scoring['leadscore_email_click'] ?? 5;
        $pZaloClick = $scoring['leadscore_zalo_interact'] ?? 3;

        $pointValue = $pClick;
        $activityLabel = 'Email Click';
        $detailLabel = "Clicked link";

        if ($subType === 'open_email') {
            $pointValue = $pOpen;
            $activityLabel = 'Email Open';
            $detailLabel = "Opened Email";
        } elseif ($subType === 'zalo_clicked' || $subType === 'click_zns') {
            // [FIX P10-M1] Normalize both Zalo click types — 'click_zns' (ZNS link) + 'zalo_clicked' (Zalo CS)
            $pointValue = $pZaloClick;
            $activityLabel = 'Zalo Click';
            $detailLabel = "Zalo Clicked link/button";
        }

        $pointLabel = "(+$pointValue điểm)";
        $variationSuffix = !empty($extra['variation']) ? " (" . $extra['variation'] . ")" : "";

        $appendUrl = ($subType !== 'open_email' && !empty($extra['url'])) ? ": " . $extra['url'] : "";
        logActivity($pdo, $sid, $subType, $rid, $activityLabel, "{$detailLabel}{$variationSuffix} {$pointLabel}{$appendUrl}", $fid, $cid, $extra, $wId);

        // 2. Buffer subscriber stats updates
        $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('subscribers', ?, ?, 1)")
            ->execute([$sid, ($subType === 'open_email' ? 'stats_opened' : 'stats_clicked')]);

        // [OPTIMIZED] Buffer lead_score increment
        $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('subscribers', ?, 'lead_score', ?)")
            ->execute([$sid, $pointValue]);

        // [PERFORMANCE] Timestamp Buffering
        // Instead of UPDATE subscribers SET ... (Row Lock), we insert into timestamp_buffer.
        $ts = date('Y-m-d H:i:s');
        $col = 'last_activity_at';
        if ($subType === 'open_email')
            $col = 'last_open_at';
        elseif ($subType === 'click_link' || $subType === 'zalo_clicked' || $subType === 'click_zns')
            $col = 'last_click_at';

        try {
            $pdo->prepare("INSERT INTO timestamp_buffer (subscriber_id, column_name, timestamp_value) VALUES (?, ?, ?), (?, 'last_activity_at', ?)")
                ->execute([$sid, $col, $ts, $sid, $ts]);
        } catch (Exception $e) {
            // Fallback: Table may not exist yet.
            // [NOTE] Ideally CREATE TABLE timestamp_buffer should be run as a one-time
            // DB migration at setup time — not at runtime — to avoid race conditions
            // when multiple workers hit this catch block simultaneously (Deadlock risk).
            // The nested catch below acts as a last-resort safety net.
            if (strpos($e->getMessage(), "doesn't exist") !== false) {
                try {
                    // [HOTFIX RUNTIME_DDL] Removed CREATE TABLE IF NOT EXISTS here.
                    // This caused severe Metadata Locks freezing entire workers.
                    // Please run migrate_optimizations.php to provision the timestamp_buffer.

                    // If migration hasn't run, fallback to explicit UPDATE immediately (less ideal for concurrency, but won't crash DB core)
                    $pdo->prepare("UPDATE subscribers SET " . ($subType === 'open_email' ? 'last_open_at = NOW()' : 'last_click_at = NOW()') . ", last_activity_at = NOW() WHERE id = ?")
                        ->execute([$sid]);
                } catch (Exception $ex) {
                    // Ignore gracefully
                }
            } else {
                // Ignore other issues.
            }
        }

        // 3. Handle Flow Stats
        if ($fid) {
            // [FIX P10-H1] Route click_zns to stat_total_zalo_clicked (new column from P9-M4 migration).
            // Previously 'click_zns' fell into the else branch → stat_total_clicked (email counter) was
            // incorrectly incremented, and stat_total_zalo_clicked (added in P9-M4) stayed permanently 0.
            $flowTotalCol = 'stat_total_clicked'; // email link click default
            if ($subType === 'open_email') {
                $flowTotalCol = 'stat_total_opened';
            } elseif ($subType === 'click_zns' || $subType === 'zalo_clicked') {
                $flowTotalCol = 'stat_total_zalo_clicked';
            }
            $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('flows', ?, ?, 1)")
                ->execute([$fid, $flowTotalCol]);

            // [FIX] Unique Check — must include reference_key (step ID or URL) in the cache key.
            // Without it: subscriber clicks link A → cache row created (sub+flow+click).
            // Subscriber then clicks link B → INSERT IGNORE silently fails (same sub+flow+click).
            // → Unique click for link B is NEVER counted. Same bug for multi-step flow opens.
            $evt = ($subType === 'open_email' ? 'open' : 'click');
            $refKey = $rid ?? ($extra['url'] ?? 'general');
            // [CONFLICT-1 FIX] tracking_unique_cache may be missing 'reference_key' column
            // if DB was created before this column was added. Use self-healing ALTER + fallback.
            try {
                $stmtUnique = $pdo->prepare("INSERT IGNORE INTO tracking_unique_cache (subscriber_id, target_type, target_id, event_type, reference_key) VALUES (?, 'flow', ?, ?, ?)");
                $stmtUnique->execute([$sid, $fid, $evt, $refKey]);
            } catch (Exception $eUniq) {
                if (
                    strpos($eUniq->getMessage(), 'reference_key') !== false
                    || strpos($eUniq->getMessage(), "Unknown column") !== false
                ) {
                    // [HOTFIX RUNTIME_DDL] Removed ALTER TABLE tracking_unique_cache inline logic.
                    // Causes Metadata Locks. Fallback safely until migrate_optimizations.php is executed.
                    try {
                        $pdo->prepare("INSERT IGNORE INTO tracking_unique_cache (subscriber_id, target_type, target_id, event_type) VALUES (?, 'flow', ?, ?)")
                            ->execute([$sid, $fid, $evt]);
                    } catch (Exception $eAlt) {}
                    
                    $stmtUnique = null; // prevent rowCount() error below
                }
            }
            if (isset($stmtUnique) && $stmtUnique && $stmtUnique->rowCount() > 0) {
                // [FIX P10-H1] Route click_zns unique to stat_unique_zalo_clicked.
                $flowUniqueCol = 'stat_unique_clicked'; // email default
                if ($subType === 'open_email') {
                    $flowUniqueCol = 'stat_unique_opened';
                } elseif ($subType === 'click_zns' || $subType === 'zalo_clicked') {
                    $flowUniqueCol = 'stat_unique_zalo_clicked';
                }
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('flows', ?, ?, 1)")
                    ->execute([$fid, $flowUniqueCol]);
            }
        }

        // 4. Handle Campaign Stats
        if ($cid) {
            // Total
            $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('campaigns', ?, ?, 1)")
                ->execute([$cid, ($subType === 'open_email' ? 'count_opened' : 'count_clicked')]);

            if ($subType === 'open_email') {
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('campaigns', ?, 'stat_opens', 1)")->execute([$cid]);
            } else {
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('campaigns', ?, 'stat_clicks', 1)")->execute([$cid]);
            }

            if (!empty($extra['device_type'])) {
                $col = ($extra['device_type'] === 'mobile') ? 'stat_device_mobile' : 'stat_device_desktop';
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('campaigns', ?, ?, 1)")
                    ->execute([$cid, $col]);
            }

            // [FIX] Unique Check — include reference_key so each distinct link/step is tracked.
            // A campaign with 3 buttons: clicking button A blocks buttons B & C from counting
            // as unique if reference_key is not part of the uniqueness constraint.
            $evt = ($subType === 'open_email' ? 'open' : 'click');
            $refKey = $rid ?? ($extra['url'] ?? 'general');
            try {
                $stmtUnique = $pdo->prepare("INSERT IGNORE INTO tracking_unique_cache (subscriber_id, target_type, target_id, event_type, reference_key) VALUES (?, 'campaign', ?, ?, ?)");
                $stmtUnique->execute([$sid, $cid, $evt, $refKey]);
            } catch (Exception $eUniq) {
                if (
                    strpos($eUniq->getMessage(), 'reference_key') !== false
                    || strpos($eUniq->getMessage(), "Unknown column") !== false
                ) {
                    // [HOTFIX RUNTIME_DDL] Removed ALTER TABLE tracking_unique_cache inline logic.
                    // Fallback to legacy insert structure to prevent locking DB.
                    try {
                        $pdo->prepare("INSERT IGNORE INTO tracking_unique_cache (subscriber_id, target_type, target_id, event_type) VALUES (?, 'campaign', ?, ?)")
                            ->execute([$sid, $cid, $evt]);
                    } catch (Exception $eAlt) {}
                    
                    $stmtUnique = null;
                }
            }
            if (isset($stmtUnique) && $stmtUnique && $stmtUnique->rowCount() > 0) {
                $column = ($subType === 'open_email' ? 'count_unique_opened' : 'count_unique_clicked');
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('campaigns', ?, ?, 1)")
                    ->execute([$cid, $column]);
            }
        }

        // [POKE FLOW WORKER] - Trigger Immediate Flow Evaluation on subscriber interaction.
        // Only poke 'condition' steps — wait steps are time-gated and must not be woken early.
        // [PERF] Use indexed step_type column instead of JOIN+json_decode on every event.
        //        Falls back to json_decode path if step_type column doesn't exist yet (self-healing).
        if ($sid) {
            // Case A: Direct Flow Interaction (fid known)
            if ($fid) {
                try {
                    // Fast path: use step_type column (indexed, no json_decode)
                    $checkWait = $pdo->prepare("
                        SELECT sfs.id, sfs.step_id, sfs.step_type, f.steps
                        FROM subscriber_flow_states sfs
                        JOIN flows f ON sfs.flow_id = f.id
                        WHERE sfs.subscriber_id = ? AND sfs.flow_id = ? AND sfs.status = 'waiting'
                    ");
                    $checkWait->execute([$sid, $fid]);
                    $waitingStates = $checkWait->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($waitingStates as $state) {
                        // Fast path: step_type already stored — no json_decode needed
                        if ($state['step_type'] !== null) {
                            $currentStepType = $state['step_type'];
                        } else {
                            // Slow path fallback: decode flow steps (step_type column may not exist yet)
                            $flowSteps = json_decode($state['steps'] ?? '[]', true) ?: [];
                            $currentStepType = null;
                            foreach ($flowSteps as $s) {
                                if (trim($s['id']) === trim($state['step_id'])) {
                                    $currentStepType = $s['type'] ?? null;
                                    break;
                                }
                            }
                        }
                        // Only wake condition steps — NOT wait/action/zalo_zns etc.
                        if ($currentStepType !== 'condition') {
                            continue;
                        }
                        dispatchQueueJob($pdo, 'flows', [
                            'priority_queue_id' => $state['id'],
                            'subscriber_id' => $sid,
                            'priority_flow_id' => $fid
                        ]);
                    }
                } catch (Exception $e) {
                    // Ignore poke errors (e.g., step_type column not yet in schema)
                }
            }

            // Case B: Campaign Interaction (Poke all flows triggered by this campaign)
            if ($cid) {
                try {
                    static $campaignFlowCache = [];
                    // [FIX P8-H1] Add TTL to prevent stale data when flows are activated/deactivated
                    // during a long worker run, and to prevent unbounded memory growth.
                    static $campaignFlowCacheTime = [];
                    $CACHE_TTL = 300; // 5 minutes

                    if (!isset($campaignFlowCache[$cid]) || (time() - ($campaignFlowCacheTime[$cid] ?? 0)) > $CACHE_TTL) {
                        $stmtFlows = $pdo->prepare("SELECT id, steps FROM flows WHERE status = 'active' AND (trigger_type = 'campaign' OR steps LIKE ?)");
                        $stmtFlows->execute(['%"targetId":"' . $cid . '"%']);
                        $associatedFlows = $stmtFlows->fetchAll();

                        $matchedFlows = [];
                        foreach ($associatedFlows as $f) {
                            $fSteps = json_decode($f['steps'], true) ?: [];
                            foreach ($fSteps as $s) {
                                if ($s['type'] === 'trigger' && ($s['config']['type'] ?? '') === 'campaign' && ($s['config']['targetId'] ?? '') == $cid) {
                                    $matchedFlows[] = $f['id'];
                                    break;
                                }
                            }
                        }
                        $campaignFlowCache[$cid] = $matchedFlows;
                        $campaignFlowCacheTime[$cid] = time(); // [FIX P8-H1] record TTL timestamp
                    }

                    foreach ($campaignFlowCache[$cid] as $fId) {
                        if ($fId !== $fid) { // Skip if already poked by Case A above
                            $checkWait = $pdo->prepare("
                                SELECT sfs.id, sfs.step_id, sfs.step_type, f.steps
                                FROM subscriber_flow_states sfs
                                JOIN flows f ON sfs.flow_id = f.id
                                WHERE sfs.subscriber_id = ? AND sfs.flow_id = ? AND sfs.status = 'waiting'
                            ");
                            $checkWait->execute([$sid, $fId]);
                            $waitingStates = $checkWait->fetchAll(PDO::FETCH_ASSOC);

                            foreach ($waitingStates as $state) {
                                // Fast path: use stored step_type
                                if ($state['step_type'] !== null) {
                                    $stepTypeForCheck = $state['step_type'];
                                } else {
                                    // Slow fallback
                                    $fStepsForCheck = json_decode($state['steps'] ?? '[]', true) ?: [];
                                    $stepTypeForCheck = null;
                                    foreach ($fStepsForCheck as $s) {
                                        if (trim($s['id']) === trim($state['step_id'])) {
                                            $stepTypeForCheck = $s['type'] ?? null;
                                            break;
                                        }
                                    }
                                }
                                if ($stepTypeForCheck !== 'condition') {
                                    continue;
                                }
                                dispatchQueueJob($pdo, 'flows', [
                                    'priority_queue_id' => $state['id'],
                                    'subscriber_id' => $sid,
                                    'priority_flow_id' => $fId
                                ]);
                            }
                        }
                    }
                } catch (Exception $e) {
                    // Ignore poke errors
                }
            }
        }

        return true;
    }

    if ($type === 'unsubscribe') {
        $sid = $payload['subscriber_id'] ?? null;
        $fid = $payload['flow_id'] ?? null;
        $cid = $payload['campaign_id'] ?? null;
        $rid = $payload['reference_id'] ?? null;
        $wId = $payload['workspace_id'] ?? null;

        // [GUARD] Skip if subscriber_id is missing
        if (!$sid) {
            error_log('[tracking_processor] Skipping unsubscribe: missing subscriber_id. Payload: ' . json_encode($payload));
            return false;
        }

        $stmtStatus = $pdo->prepare("SELECT status FROM subscribers WHERE id = ?");
        $stmtStatus->execute([$sid]);
        $currentStatus = $stmtStatus->fetchColumn();

        // [ATOMIC FIX] Wrap both UPDATEs in a transaction.
        // Previously two separate auto-commit statements: if the connection dropped between them,
        // subscriber would be marked 'unsubscribed' but flow_states would remain 'waiting',
        // causing the flow worker to continue sending automated emails to the opted-out subscriber.
        // [GUARD] Check inTransaction() before beginTransaction() — if a caller (e.g. webhook.php
        // with an outer TX) is already in a transaction, calling beginTransaction() again would throw
        // PDOException: "There is already an active transaction".
        try {
            $alreadyInTx = $pdo->inTransaction();
            if (!$alreadyInTx) $pdo->beginTransaction();
            $pdo->prepare("UPDATE subscribers SET status = 'unsubscribed', updated_at = NOW() WHERE id = ?")->execute([$sid]);
            $pdo->prepare("UPDATE subscriber_flow_states SET status = 'cancelled', updated_at = NOW() WHERE subscriber_id = ? AND status IN ('waiting', 'processing')")->execute([$sid]);
            if (!$alreadyInTx) $pdo->commit();
        } catch (Exception $e) {
            if (!isset($alreadyInTx) || !$alreadyInTx) {
                if ($pdo->inTransaction()) $pdo->rollBack();
            }
            error_log('[tracking_processor] Unsubscribe transaction failed for sid=' . $sid . ': ' . $e->getMessage());
            return false;
        }

        // Only increment counters if they weren't already unsubscribed previously or from another click
        if ($currentStatus !== 'unsubscribed') {
            if ($fid) {
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('flows', ?, 'stat_total_unsubscribed', 1)")->execute([$fid]);
            }
            if ($cid) {
                $pdo->prepare("INSERT INTO stats_update_buffer (target_table, target_id, column_name, increment) VALUES ('campaigns', ?, 'count_unsubscribed', 1)")->execute([$cid]);
            }
        }

        logActivity($pdo, $sid, 'unsubscribe', $rid, 'Unsubscribe', "Unsubscribed via Link", $fid, $cid);

        // [WARNING] triggerFlows('unsubscribe') must NOT send any marketing emails.
        // The subscriber is already marked 'unsubscribed' above. Any flow triggered here
        // MUST check subscriber status before dispatching email actions to avoid
        // spam/bounce rate increases. Acceptable actions: internal notification, tag update, CRM webhook.
        triggerFlows($pdo, $sid, 'unsubscribe', null);

        return true;
    }

    return false;
}
