<?php
// api/worker_tracking_aggregator.php - HIGH-PERFORMANCE TRACKING AGGREGATOR V2.0
// Handles millions of raw events using Buffer-First + Short-lived Transaction pattern.

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
set_time_limit(300); // 5 minutes
ignore_user_abort(true);

require_once 'db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once 'tracking_processor.php';
require_once 'tracking_helper.php';

// [FIX P10-C1] MySQL version-aware SKIP LOCKED guard.
// SKIP LOCKED is only valid on MySQL >= 8.0. On 5.7 it throws a fatal syntax error
// that crashes the entire aggregator, causing activity/stats buffers to stall indefinitely.
// Pattern matches worker_campaign.php (P9-C1) and worker_priority.php (P9-C2).
$skipLockedClause = isDatabaseSkipLockedSupported($pdo) ? 'SKIP LOCKED' : '';

$batchSize = 1000;
$now = date('Y-m-d H:i:s');

// 1. Fetch raw events and process (Only if run directly as a worker)
if (basename($_SERVER['SCRIPT_FILENAME']) === 'worker_tracking_aggregator.php') {

    // =========================================================================
    // [BUG-1 FIX] SHORT-LIVED TRANSACTION PATTERN
    // =========================================================================
    // BEFORE: beginTransaction() -> FOR UPDATE on 1000 rows -> getLocationFromIP()
    //         (external API, up to 1s/call) -> 1000 rows locked for ~1000s -> DB pool exhausted -> CRASH.
    //
    // AFTER:
    //   Phase A (Short TX): Claim batch by marking processed=2 ('in-progress'), commit immediately.
    //                        Rows are "owned" by this worker. Lock released in milliseconds.
    //   Phase B (Outside TX): Slow work  getDeviceDetails(), getLocationFromIP(), processTrackingEvent().
    //   Phase C (Fast cleanup): DELETE claimed rows (done). No transaction needed.
    // =========================================================================

    // --- PHASE A: CLAIM BATCH (Short Transaction) ---
    $events = [];
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            "SELECT id, type, payload FROM raw_event_buffer
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND processed = 0 ORDER BY id ASC LIMIT ? FOR UPDATE $skipLockedClause"
        );
        $stmt->execute([$batchSize]);
        $events = $stmt->fetchAll();

        if (!empty($events)) {
            $claimIds = array_column($events, 'id');
            $placeholders = implode(',', array_fill(0, count($claimIds), '?'));
            // Mark as 'in-progress' (processed=2) so other workers skip them
            $pdo->prepare("UPDATE raw_event_buffer SET processed = 2 WHERE id IN ($placeholders)")
                ->execute($claimIds);
        }
        $pdo->commit(); // Release ALL row locks immediately
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        exit(json_encode(['status' => 'error', 'msg' => 'Claim failed: ' . $e->getMessage()]));
    }

    if (empty($events)) {
        // No raw events  still sync the activity/stats buffers
        syncStatsBuffer($pdo);
        syncActivityBuffer($pdo);
        syncZaloActivityBuffer($pdo);
        syncTimestampBuffer($pdo);
        exit(json_encode(['status' => 'idle_synced']));
    }

    // --- PHASE B: PROCESS OUTSIDE TRANSACTION (slow: external API calls, geo-lookup etc.) ---
    // [TIMEOUT SAFETY FIX] set_time_limit(300) means PHP kills script at 300s.
    // With 1000 events  ~1s per getLocationFromIP() = up to 1000s total.
    // If PHP kills at 300s, events 301-1000 stay marked processed=2 forever,
    // then prune_queues.php deletes them after 1h => SILENT DATA LOSS.
    //
    // Fix: Check elapsed time before each event. If >260s (40s safety buffer), break.
    // Phase C2 resets unfinished events back to processed=0 so next worker retries them.
    $processedIds = [];
    $startTime = microtime(true);
    $timeLimit = 260; // Break at 260s  leaves 40s for Phase C/C2 cleanup + sync buffers

    // [ANTI-SPAM IN-MEMORY DEBOUNCE]
    // Drops multiple identical click events hitting the same batch (e.g. from rapid-fire email scanners).
    $seenRapidEvents = [];

    foreach ($events as $event) {
        // [TIMEOUT GUARD] Check elapsed time before starting each potentially slow event
        if ((microtime(true) - $startTime) > $timeLimit) {
            error_log('[worker_aggregator] Timeout guard  processed ' . count($processedIds) . '/' . count($events) . ' events. Remaining will be retried.');
            break; // Safe exit  unprocessed IDs NOT added to $processedIds
        }

        $payload = json_decode($event['payload'], true);
        $type = $event['type']; // open, click, unsubscribe

        $sid = $payload['sid'] ?? null;
        $rid = $payload['rid'] ?? null;
        $fid = $payload['fid'] ?? null;
        $cid = $payload['cid'] ?? null;
        $wId = $payload['workspace_id'] ?? 1; // [HARDENING] Extract workspace_id from payload
        $extra = $payload['extra_data'] ?? [];
        $variation = $payload['var'] ?? null;
        if ($variation) {
            $extra['variation'] = $variation;
        }

        // [ANTI-SPAM CACHE CHECK]
        // Drops multiple identical events hitting the same batch (e.g. from rapid-fire email scanners).
        // Applied to all types (open, click, unsubscribe) to prevent intra-batch race conditions
        // since `processTrackingEvent` checks the main DB but writes are buffered.
        $hashUrl = $extra['url'] ?? '';
        $hash = md5("{$type}|{$sid}|{$cid}|{$fid}|{$rid}|{$hashUrl}");
        if (isset($seenRapidEvents[$hash])) {
            // Duplicate in the same worker batch. Mark processed and skip DB hit!
            $processedIds[] = $event['id'];
            continue;
        }
        $seenRapidEvents[$hash] = true;

        if ($type === 'open' || $type === 'click') {
            // Enrich with device/geo (offloaded from webhook to avoid blocking PHP-FPM under load)
            if (!empty($extra['user_agent'])) {
                $ua = $extra['user_agent'];
                $ip = $extra['ip'] ?? null;

                // Resolve Device Details if missing
                if (empty($extra['device_type'])) {
                    $details = getDeviceDetails($ua);
                    $extra = array_merge($extra, $details);
                    // Normalize: getDeviceDetails() returns 'device', DB column is 'device_type'
                    if (!empty($extra['device']) && empty($extra['device_type'])) {
                        $extra['device_type'] = $extra['device'];
                    }
                }

                // Resolve Geo Location  SAFE here: outside transaction, won't block DB locks
                if (empty($extra['location']) && $ip) {
                    if (!empty($extra['device']) && $extra['device'] === 'Proxy') {
                        $extra['location'] = $extra['os'] ?? null; // Proxy: use OS as label, skip API
                    } else {
                        $extra['location'] = getLocationFromIP($ip); // May take ~1s per call
                    }
                }
            }

            processTrackingEvent($pdo, 'stat_update', [
                'type' => ($type === 'open' ? 'open_email' : 'click_link'),
                'subscriber_id' => $sid,
                'reference_id' => $rid,
                'flow_id' => $fid,
                'campaign_id' => $cid,
                'extra_data' => $extra,
                'workspace_id' => $wId // [HARDENING] Pass workspace_id to processor
            ]);
        } elseif ($type === 'unsubscribe') {
            processTrackingEvent($pdo, 'unsubscribe', [
                'subscriber_id' => $sid,
                'flow_id' => $fid,
                'campaign_id' => $cid,
                'reference_id' => $rid
            ]);
        }

        // Only mark as done AFTER successful processing (not before the loop!)
        $processedIds[] = $event['id'];
    }

    // --- PHASE C: DELETE fully processed rows ---
    if (!empty($processedIds)) {
        try {
            $placeholders = implode(',', array_fill(0, count($processedIds), '?'));
            $pdo->prepare("DELETE FROM raw_event_buffer WHERE id IN ($placeholders)")
                ->execute($processedIds);
        } catch (Exception $e) {
            error_log('[worker_aggregator] Failed to delete raw events: ' . $e->getMessage());
        }
    }

    // --- PHASE C2: RESET unfinished events back to processed=0 for retry ---
    // These are rows we claimed (processed=2) but didn't finish because of timeout guard.
    // Without this: prune_queues.php deletes them 1h later => silent data loss.
    $allClaimedIds = array_column($events, 'id');
    $unprocessedIds = array_values(array_diff($allClaimedIds, $processedIds));
    if (!empty($unprocessedIds)) {
        try {
            $phUnproc = implode(',', array_fill(0, count($unprocessedIds), '?'));
            $pdo->prepare("UPDATE raw_event_buffer SET processed = 0 WHERE id IN ($phUnproc)")
                ->execute($unprocessedIds);
            error_log('[worker_aggregator] Reset ' . count($unprocessedIds) . ' unfinished events to processed=0 for retry.');
        } catch (Exception $e) {
            error_log('[worker_aggregator] Failed to reset unprocessed events: ' . $e->getMessage());
        }
    }

    // Sync all downstream buffers
    syncStatsBuffer($pdo);
    syncActivityBuffer($pdo);
    syncZaloActivityBuffer($pdo);
    syncTimestampBuffer($pdo);

    // [PHASE 9 MEMORY FIX] Dọn dẹp RAM rác khổng lồ từ mảng Tracking Event (hàng nghìn objects JSON)
    unset($events, $processedIds, $unprocessedIds, $seenRapidEvents);
    gc_collect_cycles();

    echo json_encode(['status' => 'success', 'processed' => count($processedIds), 'retried' => count($unprocessedIds)]);
}

/**
 * Syncs activity_buffer -> subscriber_activity
 *
 * [BUG-2 FIX] Short-lived TX + FOR UPDATE SKIP LOCKED:
 * Without this, N parallel workers all SELECT the same 500 rows -> N duplicate inserts.
 */
function syncActivityBuffer($pdo)
{
    global $skipLockedClause;
    $logs = [];
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            "SELECT * FROM activity_buffer WHERE processed = 0 ORDER BY id ASC LIMIT 500 FOR UPDATE $skipLockedClause"
        );
        $stmt->execute();
        $logs = $stmt->fetchAll();

        if (empty($logs)) {
            $pdo->rollBack();
            return;
        }

        $claimIds = array_column($logs, 'id');
        $ph = implode(',', array_fill(0, count($claimIds), '?'));
        $pdo->prepare("UPDATE activity_buffer SET processed = 2 WHERE id IN ($ph)")->execute($claimIds);
        $pdo->commit(); // Release row locks
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        return;
    }

    $insertValues = [];
    $insertBinds = [];

    foreach ($logs as $log) {
        $extra = json_decode($log['extra_data'], true) ?: [];

        // Key normalization: handle both 'ua'/'user_agent' and 'device'/'device_type' aliases
        $ip = $extra['ip'] ?? null;
        $ua = $extra['ua'] ?? ($extra['user_agent'] ?? null);
        $device = $extra['device'] ?? ($extra['device_type'] ?? null);
        $os = $extra['os'] ?? null;
        $browser = $extra['browser'] ?? null;
        $location = $extra['location'] ?? null;
        $refName = $extra['reference_name'] ?? null;
        $variation = $extra['variation'] ?? null;

        $insertBinds[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        // [O(N) FIX] array_push with splat instead of array_merge.
        // array_merge creates a brand-new array each iteration: O(N) total copies.
        // array_push appends in-place: O(1) per call, O(N) total.
        array_push(
            $insertValues,
            $log['subscriber_id'],
            $log['workspace_id'] ?? 1,
            $log['type'],
            $log['reference_id'],
            $log['flow_id'],
            $log['campaign_id'],
            $refName,
            $log['details'],
            $ip,
            $ua,
            $device,
            $os,
            $browser,
            $location,
            $log['created_at'],
            $variation
        );
    }

    if (!empty($insertValues)) {
        try {
            $sql = "INSERT INTO subscriber_activity
                    (subscriber_id, workspace_id, type, reference_id, flow_id, campaign_id, reference_name,
                     details, ip_address, user_agent, device_type, os, browser, location, created_at, variation)
                    VALUES " . implode(',', $insertBinds);
            $pdo->prepare($sql)->execute($insertValues);
        } catch (Exception $e) {
            file_put_contents(
                __DIR__ . '/worker_error.log',
                date('[Y-m-d H:i:s] ') . "Activity Sync Failed: " . $e->getMessage() . "\n",
                FILE_APPEND
            );
        }
    }

    // [FIX P5-M1] Use prepared statement instead of raw exec() with interpolated IDs.
    // IDs are internal integer PKs so direct injection is low risk, but exec() with
    // string interpolation is an unsafe pattern  standardize to prepared statements.
    try {
        $deletePh = implode(',', array_fill(0, count($claimIds), '?'));
        $pdo->prepare("DELETE FROM activity_buffer WHERE id IN ($deletePh)")->execute($claimIds);
    } catch (Exception $e) { /* ignore */
    }
}

/**
 * Syncs zalo_activity_buffer -> zalo_subscriber_activity
 *
 * [BUG-2 FIX] FOR UPDATE SKIP LOCKED prevents duplicate inserts under concurrent workers.
 */
function syncZaloActivityBuffer($pdo)
{
    global $skipLockedClause;
    $logs = [];
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            "SELECT * FROM zalo_activity_buffer WHERE processed = 0 ORDER BY id ASC LIMIT 500 FOR UPDATE $skipLockedClause"
        );
        $stmt->execute();
        $logs = $stmt->fetchAll();

        if (empty($logs)) {
            $pdo->rollBack();
            return;
        }

        $claimIds = array_column($logs, 'id');
        $ph = implode(',', array_fill(0, count($claimIds), '?'));
        $pdo->prepare("UPDATE zalo_activity_buffer SET processed = 2 WHERE id IN ($ph)")->execute($claimIds);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        return;
    }

    $insertValues = [];
    $insertBinds = [];

    foreach ($logs as $log) {
        $insertBinds[] = "(?, ?, ?, ?, ?, ?, ?, ?)";
        // [O(N) FIX] array_push with splat  O(N) total vs array_merge O(N)
        array_push(
            $insertValues,
            $log['subscriber_id'],
            $log['workspace_id'] ?? 1,
            $log['type'],
            $log['reference_id'],
            $log['reference_name'],
            $log['details'],
            $log['zalo_msg_id'],
            $log['created_at']
        );
    }

    if (!empty($insertValues)) {
        try {
            $sql = "INSERT INTO zalo_subscriber_activity
                    (subscriber_id, workspace_id, type, reference_id, reference_name, details, zalo_msg_id, created_at)
                    VALUES " . implode(',', $insertBinds);
            $pdo->prepare($sql)->execute($insertValues);
        } catch (Exception $e) {
            file_put_contents(
                __DIR__ . '/worker_error.log',
                date('[Y-m-d H:i:s] ') . "Zalo Activity Sync Failed: " . $e->getMessage() . "\n",
                FILE_APPEND
            );
        }
    }

    // [FIX P5-M2] Use prepared statement instead of raw exec() with interpolated IDs.
    try {
        $deletePh = implode(',', array_fill(0, count($claimIds), '?'));
        $pdo->prepare("DELETE FROM zalo_activity_buffer WHERE id IN ($deletePh)")->execute($claimIds);
    } catch (Exception $e) { /* ignore */
    }
}

/**
 * Syncs timestamp_buffer -> subscribers (max-value merge per column)
 *
 * [BUG-2 FIX] FOR UPDATE SKIP LOCKED prevents multiple workers racing to update same subscriber timestamps.
 * [DEADLOCK FIX] ksort($updates) before the update loop ensures all workers always acquire
 *   row locks in the SAME ascending subscriber_id order.
 *   Without this: Worker A locks sub_1 then tries sub_2, Worker B locks sub_2 then tries sub_1
 *   => Circular wait => MySQL kills one with DEADLOCK error.
 *   With ksort: all workers lock sub_1 before sub_2, never circular => deadlock structurally impossible.
 */
function syncTimestampBuffer($pdo)
{
    global $skipLockedClause;
    $rows = [];
    try {
        $pdo->beginTransaction();
        // [FILESORT FIX] ORDER BY id ASC  id is the Primary Key (B-Tree clustered).
        // MySQL scans exactly 1000 rows in physical order: ~0.001s, minimal locking.
        // ORDER BY subscriber_id (non-PK, no index for ordering) forces Full Table Scan
        // + filesort on all processed=0 rows BEFORE applying LIMIT.
        // With FOR UPDATE, this locks ALL scanned rows during sort  SKIP LOCKED becomes useless
        // because all workers scan and lock the same full set => deadlock / lock wait timeout.
        // ksort($updates) in PHP handles deadlock prevention without any DB-side sort.
        $stmt = $pdo->prepare(
            "SELECT * FROM timestamp_buffer WHERE processed = 0 ORDER BY id ASC LIMIT 1000 FOR UPDATE $skipLockedClause"
        );
        $stmt->execute();
        $rows = $stmt->fetchAll();

        if (empty($rows)) {
            $pdo->rollBack();
            return;
        }

        $claimIds = array_column($rows, 'id');
        $ph = implode(',', array_fill(0, count($claimIds), '?'));
        $pdo->prepare("UPDATE timestamp_buffer SET processed = 2 WHERE id IN ($ph)")->execute($claimIds);
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        return;
    }

    $updates = []; // [sub_id => [col => max_time]]

    foreach ($rows as $r) {
        $sid = $r['subscriber_id'];
        $col = $r['column_name'];
        $val = $r['timestamp_value'];

        if (!isset($updates[$sid]))
            $updates[$sid] = [];
        if (!isset($updates[$sid][$col]) || $val > $updates[$sid][$col]) {
            $updates[$sid][$col] = $val;
        }
    }

    // [DEADLOCK FIX] Sort by subscriber_id ascending before updating.
    // Guarantees all workers acquire row locks in the same consistent order.
    ksort($updates);

    // [OPTIMIZATION] Pre-compile SQL statements to prevent N+1 AST parsing
    static $stmtTsCache = [];

    foreach ($updates as $sid => $cols) {
        $setParts = [];
        $params = [];
        foreach ($cols as $col => $ts) {
            if (preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
                $setParts[] = "$col = GREATEST(COALESCE($col, '1000-01-01'), ?)";
                $params[] = $ts;
            }
        }
        if (!empty($setParts)) {
            $params[] = $sid;
            $cacheKey = implode('_', array_keys($cols));
            if (!isset($stmtTsCache[$cacheKey])) {
                $stmtTsCache[$cacheKey] = $pdo->prepare("UPDATE subscribers SET " . implode(', ', $setParts) . " WHERE id = ?");
            }
            $stmtTsCache[$cacheKey]->execute($params);
        }
    }

    // [FIX P5-M3] Use prepared statement instead of raw exec() with interpolated IDs.
    try {
        $deletePh = implode(',', array_fill(0, count($claimIds), '?'));
        $pdo->prepare("DELETE FROM timestamp_buffer WHERE id IN ($deletePh)")->execute($claimIds);
    } catch (Exception $e) { /* ignore */
    }
}

/**
        }
    }
}

/**
 * Syncs stats_update_buffer -> main tables (flows, campaigns, subscribers)
 *
 * [GAP LOCK FIX] Previous pattern: UPDATE ... LIMIT 1000 (no ORDER BY)
 * InnoDB scans the index and holds gap locks on every row it passes.
 * 5 concurrent workers all scanning the same index simultaneously => Lock Wait Timeout.
 *
 * New pattern: SELECT FOR UPDATE SKIP LOCKED -> claim IDs -> commit -> aggregate -> UPDATE targets
 * Each worker atomically owns a disjoint set of rows. No gap lock contention possible.
 *
 * [DEADLOCK FIX] After aggregating, GROUP BY target_table+target_id and sort results
 * so all workers update rows in the same table+id order => no circular lock wait.
 */
function syncStatsBuffer($pdo)
{
    global $skipLockedClause;
    // -----------------------------------------------------------------------
    // Phase A: Claim a disjoint batch via FOR UPDATE SKIP LOCKED (short TX)
    // -----------------------------------------------------------------------
    $rows = [];
    try {
        $pdo->beginTransaction();
        // [FILESORT FIX] ORDER BY id ASC  same reasoning as syncTimestampBuffer.
        // ORDER BY target_table, target_id causes filesort on non-indexed columns.
        // ksort($grouped) in PHP achieves deadlock-safe ordering without DB filesort.
        $stmt = $pdo->prepare(
            "SELECT id, workspace_id, target_table, target_id, column_name, increment
             FROM stats_update_buffer
             WHERE processed = 0 AND batch_id IS NULL
             ORDER BY id ASC
             LIMIT 1000 FOR UPDATE $skipLockedClause"
        );
        $stmt->execute();
        $rows = $stmt->fetchAll();

        if (empty($rows)) {
            $pdo->rollBack();
            return;
        }

        // Mark exclusively claimed rows with a unique batch_id
        $batchId = uniqid('batch_', true);
        $claimIds = array_column($rows, 'id');
        $ph = implode(',', array_fill(0, count($claimIds), '?'));
        $claimParams = array_merge([$batchId], $claimIds);
        $pdo->prepare("UPDATE stats_update_buffer SET batch_id = ? WHERE id IN ($ph)")
            ->execute($claimParams);
        $pdo->commit(); // Release all row locks immediately
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        return;
    }

    // -----------------------------------------------------------------------
    // Phase B: Aggregate the claimed batch in PHP (no DB locks held)
    // -----------------------------------------------------------------------
    // Group by [table][id][col] and sum increments
    $grouped = []; // ["table|id|col" => [table, id, col, total]]
    foreach ($rows as $r) {
        $key = $r['target_table'] . '|' . $r['target_id'] . '|' . $r['column_name'] . '|' . ($r['workspace_id'] ?? 1);
        if (!isset($grouped[$key])) {
            $grouped[$key] = [
                'table' => $r['target_table'],
                'id' => $r['target_id'],
                'col' => $r['column_name'],
                'workspace_id' => $r['workspace_id'] ?? 1,
                'total' => 0
            ];
        }
        $grouped[$key]['total'] += (int) $r['increment'];
    }

    if (empty($grouped)) {
        $pdo->prepare("DELETE FROM stats_update_buffer WHERE batch_id = ?")->execute([$batchId]);
        return;
    }

    // [DEADLOCK FIX] Sort by table then id ASCENDING before UPDATE loop.
    // All workers acquire locks in the same order => no circular wait => deadlock impossible.
    ksort($grouped); // key is "table|id|col" so ksort gives table-then-id-then-col order

    // -----------------------------------------------------------------------
    // Phase C: Apply aggregated increments to target tables
    // -----------------------------------------------------------------------
    // [OPTIMIZATION] Statement cache to prevent N+1 parsing
    static $stmtStatsCache = [];

    foreach ($grouped as $agg) {
        $table = $agg['table'];
        $id = $agg['id'];
        $col = $agg['col'];
        $val = $agg['total'];

        // [CONFLICT-2 FIX] database.sql ENUM only includes: 'campaigns','flows','subscribers'
        // But FlowExecutor.php also inserts 'zalo_subscribers'. ENUM strict mode FAILs silently.
        // ??  ONE-TIME migration needed:
        //   ALTER TABLE stats_update_buffer MODIFY COLUMN target_table VARCHAR(50) NOT NULL;
        if (!in_array($table, ['campaigns', 'flows', 'subscribers', 'zalo_subscribers']))
            continue;
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $col))
            continue;

        try {
            $cacheKey = "{$table}_{$col}";
            if (!isset($stmtStatsCache[$cacheKey])) {
                if ($table === 'zalo_subscribers') {
                    $stmtStatsCache[$cacheKey] = $pdo->prepare("UPDATE $table SET $col = $col + ? WHERE id = ?");
                } else {
                    $stmtStatsCache[$cacheKey] = $pdo->prepare("UPDATE $table SET $col = $col + ? WHERE id = ? AND workspace_id = ?");
                }
            }
            if ($table === 'zalo_subscribers') {
                $stmtStatsCache[$cacheKey]->execute([$val, $id]);
            } else {
                $stmtStatsCache[$cacheKey]->execute([$val, $id, $agg['workspace_id']]);
            }
        } catch (Exception $e) {
            error_log("Stats sync failed for $table.$col on $id: " . $e->getMessage());
        }
    }

    // Phase D: Delete processed rows to prevent buffer bloat
    $pdo->prepare("DELETE FROM stats_update_buffer WHERE batch_id = ?")->execute([$batchId]);
}
