<?php
// api/prune_queues.php - Automated Garbage Collection for Message Queues & Event Buffers
require_once 'db_connect.php';

/**
 * Prune and self-heal all buffer tables and caches.
 *
 * Strategy for each buffer table:
 *   - processed = 2 (in-progress / stuck > 1h): RESET to processed=0 for retry
 *     WHY: Worker may have crashed (OOM, server restart, PHP timeout).
 *          Deleting these rows = silent data loss. Resetting = safe retry.
 *   - processed = 1 (fully done, legacy mark): DELETE after 24h
 *     NOTE: New workers DELETE immediately, but older rows may still have processed=1
 *   - Zalo message queue: DELETE processed rows older than 24h
 *   - AI RAG cache: DELETE entries older than 7 days
 */
function pruneQueues($pdo)
{
    $results = [];
    try {
        // -----------------------------------------------------------------------
        // 1. raw_event_buffer
        // -----------------------------------------------------------------------
        // Reset stuck in-progress rows (worker crashed mid-batch) → retry
        $stmtReset = $pdo->prepare(
            "UPDATE raw_event_buffer SET processed = 0 WHERE processed = 2 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmtReset->execute();
        $results['raw_event_buffer_reset'] = $stmtReset->rowCount();

        // Delete old fully-processed rows (processed=1, legacy — new workers DELETE immediately)
        $stmtDel = $pdo->prepare(
            "DELETE FROM raw_event_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmtDel->execute();
        $results['raw_event_buffer_deleted'] = $stmtDel->rowCount();

        // -----------------------------------------------------------------------
        // 2. stats_update_buffer
        // -----------------------------------------------------------------------
        // Reset stuck in-progress rows
        $stmtStatReset = $pdo->prepare(
            "UPDATE stats_update_buffer SET processed = 0, batch_id = NULL WHERE processed = 2 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmtStatReset->execute();
        $results['stats_update_buffer_reset'] = $stmtStatReset->rowCount();

        // Delete old processed rows (legacy processed=1) older than 24h
        $stmtStatDel = $pdo->prepare(
            "DELETE FROM stats_update_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmtStatDel->execute();
        $results['stats_update_buffer_deleted'] = $stmtStatDel->rowCount();

        // Also reset abandoned batch claims (batch_id set but processed=0, stuck > 1h)
        $stmtBatchReset = $pdo->prepare(
            "UPDATE stats_update_buffer SET batch_id = NULL WHERE batch_id IS NOT NULL AND processed = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmtBatchReset->execute();
        $results['stats_update_buffer_batch_reset'] = $stmtBatchReset->rowCount();

        // -----------------------------------------------------------------------
        // 3. activity_buffer
        // -----------------------------------------------------------------------
        $stmtActReset = $pdo->prepare(
            "UPDATE activity_buffer SET processed = 0 WHERE processed = 2 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmtActReset->execute();
        $results['activity_buffer_reset'] = $stmtActReset->rowCount();

        $stmtActDel = $pdo->prepare(
            "DELETE FROM activity_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmtActDel->execute();
        $results['activity_buffer_deleted'] = $stmtActDel->rowCount();

        // -----------------------------------------------------------------------
        // 4. zalo_activity_buffer
        // -----------------------------------------------------------------------
        $stmtZaloActReset = $pdo->prepare(
            "UPDATE zalo_activity_buffer SET processed = 0 WHERE processed = 2 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmtZaloActReset->execute();
        $results['zalo_activity_buffer_reset'] = $stmtZaloActReset->rowCount();

        $stmtZaloActDel = $pdo->prepare(
            "DELETE FROM zalo_activity_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmtZaloActDel->execute();
        $results['zalo_activity_buffer_deleted'] = $stmtZaloActDel->rowCount();

        // -----------------------------------------------------------------------
        // 5. timestamp_buffer
        // -----------------------------------------------------------------------
        $stmtTsReset = $pdo->prepare(
            "UPDATE timestamp_buffer SET processed = 0 WHERE processed = 2 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmtTsReset->execute();
        $results['timestamp_buffer_reset'] = $stmtTsReset->rowCount();

        $stmtTsDel = $pdo->prepare(
            "DELETE FROM timestamp_buffer WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmtTsDel->execute();
        $results['timestamp_buffer_deleted'] = $stmtTsDel->rowCount();

        // -----------------------------------------------------------------------
        // 6. Zalo message queue — delete processed messages older than 24 hours
        // -----------------------------------------------------------------------
        $stmtZalo = $pdo->prepare(
            "DELETE FROM zalo_message_queue WHERE processed = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmtZalo->execute();
        $results['zalo_message_queue'] = $stmtZalo->rowCount();

        // -----------------------------------------------------------------------
        // 7. AI RAG search cache — older than 7 days
        // -----------------------------------------------------------------------
        $stmtRag = $pdo->prepare(
            "DELETE FROM ai_rag_search_cache WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        $stmtRag->execute();
        $results['rag_cache'] = $stmtRag->rowCount();

        return $results;

    } catch (Exception $e) {
        error_log("Pruning failed: " . $e->getMessage());
        return null;
    }
}

// Execution block — run via CLI or authenticated HTTP (?run=1&secret=...)
$isCli = (php_sapi_name() === 'cli');
if (!$isCli && isset($_GET['run'])) {
    $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
    if (($_GET['secret'] ?? '') !== $cronSecret) {
        http_response_code(403);
        echo json_encode(['error' => '403 Forbidden: Invalid cron secret.']);
        exit(1);
    }
}
if ($isCli || isset($_GET['run'])) {
    header('Content-Type: text/plain');
    $results = pruneQueues($pdo);
    if ($results) {
        echo "Pruning Complete:\n";
        foreach ($results as $key => $count) {
            if ($count > 0) {
                echo "- $key: $count rows\n";
            }
        }
        echo "Done.\n";
    } else {
        echo "Pruning failed.\n";
    }
}
