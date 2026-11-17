<?php
// worker_segment_counts.php - Background worker for segment count updates
require_once 'db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once 'segment_helper.php';

set_time_limit(300); // 5 minutes max
$startTime = time();
$maxRuntime = 240; // 4 minutes to allow graceful shutdown
$batchSize = 10;

$lockStmt = $pdo->query("SELECT GET_LOCK('worker_segment_counts_lock', 0)");
if ($lockStmt->fetchColumn() !== 1) {
    die("[SKIPPED] Already running.\n");
}

try {
    $logs = [];
    $logs[] = "[START] Segment count update worker started at " . date('Y-m-d H:i:s');
    $failedInThisRun = [];

    while ((time() - $startTime) < $maxRuntime) {
        // Fetch batch of segments to update
        $stmt = $pdo->prepare("
            SELECT segment_id, workspace_id
            FROM segment_count_update_queue 
            ORDER BY queued_at ASC 
            LIMIT ?
        ");
        $stmt->execute([$batchSize]);
        $queueRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($queueRows)) {
            $logs[] = "[IDLE] No segments in queue, exiting.";
            break;
        }

        // Filter out items that already failed during this process execution
        $actionableRows = array_filter($queueRows, fn($r) => !isset($failedInThisRun[$r['segment_id']]));
        if (empty($actionableRows)) {
            $logs[] = "[IDLE] All remaining queue items encountered errors in this run. Exiting gracefully.";
            break;
        }

        $logs[] = "[BATCH] Processing " . count($actionableRows) . " segments";

        foreach ($actionableRows as $row) {
            $segmentId = $row['segment_id'];
            $workspace_id = (int)($row['workspace_id'] ?? 1);
            try {
                // Get segment criteria and verify active state
                $stmtSeg = $pdo->prepare("SELECT criteria, deleted_at FROM segments WHERE id = ? AND workspace_id = ?");
                $stmtSeg->execute([$segmentId, $workspace_id]);
                $segRow = $stmtSeg->fetch(PDO::FETCH_ASSOC);

                if (!$segRow || !empty($segRow['deleted_at']) || empty($segRow['criteria'])) {
                    $logs[] = "[SKIP] Segment $segmentId not found, soft-deleted, or has empty criteria; removing from queue";
                    $pdo->prepare("DELETE FROM segment_count_update_queue WHERE workspace_id = ? AND segment_id = ?")->execute([$workspace_id, $segmentId]);
                    continue;
                }

                $criteria = $segRow['criteria'];

                // Calculate both subscriber_count and phone_count in a single pass
                $res = buildSegmentWhereClause($criteria, $workspace_id, $segmentId);
                $stmtCount = $pdo->prepare("
                    SELECT 
                        COUNT(*),
                        COUNT(CASE WHEN (s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '') OR (s.phone IS NOT NULL AND TRIM(s.phone) != '') THEN 1 END)
                    FROM subscribers s 
                    WHERE s.workspace_id = ? 
                      AND s.deleted_at IS NULL
                      AND s.status IN ('active', 'lead', 'customer') 
                      AND (" . $res['sql'] . ")
                ");
                $stmtCount->execute(array_values(array_merge([$workspace_id], $res['params'])));
                [$subCount, $phoneCount] = $stmtCount->fetch(PDO::FETCH_NUM) ?: [0, 0];

                // Update segment with both counts and sync timestamp
                $pdo->prepare("
                    UPDATE segments 
                    SET subscriber_count = ?, phone_count = ?, synced_at = NOW() 
                    WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
                ")->execute([(int)$subCount, (int)$phoneCount, $segmentId, $workspace_id]);

                // Remove from queue
                $pdo->prepare("DELETE FROM segment_count_update_queue WHERE workspace_id = ? AND segment_id = ?")->execute([$workspace_id, $segmentId]);

                $logs[] = "[UPDATE] Segment $segmentId: $subCount subscribers, $phoneCount phones";

            } catch (\Throwable $e) {
                $failedInThisRun[$segmentId] = true;
                $logs[] = "[ERROR] Segment $segmentId failed: " . $e->getMessage();
                
                // Anti-Poison-Pill: Push queued_at 10 minutes into the future so it will not block subsequent items
                try {
                    $pdo->prepare("
                        UPDATE segment_count_update_queue 
                        SET queued_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) 
                        WHERE workspace_id = ? AND segment_id = ?
                    ")->execute([$workspace_id, $segmentId]);
                } catch (\Throwable $qEx) {
                    $pdo->prepare("DELETE FROM segment_count_update_queue WHERE workspace_id = ? AND segment_id = ?")->execute([$workspace_id, $segmentId]);
                }
            }
        }

        // Prevent tight loop
        usleep(100000); // 100ms
    }

    $logs[] = "[END] Worker completed at " . date('Y-m-d H:i:s');

} catch (Exception $e) {
    $logs[] = "[FATAL] " . $e->getMessage();
}

// Output logs
foreach ($logs as $log) {
    echo $log . "\n";
}
$pdo->query("DO RELEASE_LOCK('worker_segment_counts_lock')");
?>
