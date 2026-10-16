<?php
// api/worker_queue.php - MISSION-CRITICAL QUEUE ENGINE V1.0
// This is the heart of the 10M scalability upgrade.
// It processes background jobs from the queue_jobs table.

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
set_time_limit(300); // 5 minutes execution window
ignore_user_abort(true);
ini_set('memory_limit', '512M');

// [FIX R4-A01] PHP-level access guard — Defense-in-depth (Layer 2, .htaccess is Layer 1).
// Workers must only run via CLI (cron) or from localhost (internal trigger).
// If called via public HTTP, reject immediately before any DB connection.
if (php_sapi_name() !== 'cli') {
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    $isLocalhost = in_array($remoteAddr, ['127.0.0.1', '::1'], true);
    if (!$isLocalhost) {
        // Check for internal worker secret (for WorkerTriggerService calling via HTTP)
        $workerSecret = $_SERVER['HTTP_X_WORKER_SECRET'] ?? '';
        $configuredSecret = getenv('WORKER_SECRET');
        $secretValid = ($configuredSecret && hash_equals($configuredSecret, $workerSecret));
        if (!$secretValid) {
            http_response_code(403);
            exit(json_encode(['status' => 'forbidden', 'message' => 'Workers are CLI-only']));
        }
    }
}


// ? EXCLUSIVE LOCK: Only 1 worker runs at a time for standard tasks to avoid starving PHP-FPM pool
// Workers doing sleep(6) for embeddings need to be serialized.
// HIGH PRIORITY jobs can bypass this lock to prevent system-wide hangs.
$isPriority = (isset($_GET['priority']) && $_GET['priority'] === 'high');
// [FIX] Use __DIR__ instead of sys_get_temp_dir().
// sys_get_temp_dir() (/tmp) can be purged between requests on Shared Hosting or have
// per-pool isolation in PHP-FPM chroot / Docker tmpfs configs  causing the lock to
// vanish mid-run and allowing duplicate workers to spawn simultaneously.
// __DIR__ is always the same directory as the script, with guaranteed write permissions.
$workerLock = __DIR__ . '/worker_running.lock';
$lockMaxAge = 300; // 5 min  if older, assume dead

if (!$isPriority && file_exists($workerLock)) {
    $lockAge = time() - (int) @file_get_contents($workerLock);
    if ($lockAge < $lockMaxAge) {
        // Another worker is already running  exit silently
        echo json_encode(['status' => 'skipped', 'message' => "Worker already running (age={$lockAge}s)"]);
        exit;
    }
}
// Write our PID + timestamp as the lock  only for standard workers,
// Priority workers bypass the lock check but must NOT overwrite it
// (avoids corrupting lockAge calculation for the standard worker).
if (!$isPriority) {
    @file_put_contents($workerLock, time());
}
// Ensure lock is always removed, even on fatal errors  only for standard workers
register_shutdown_function(function () use ($workerLock, $isPriority) {
    if (!$isPriority) {
        @unlink($workerLock);
    }
});

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
// RELEASE SESSION LOCK: Workers don't need to hold the user's session lock.
if (session_id())
    session_write_close();

$now = date('Y-m-d H:i:s');
$workerId = getmypid();
// 0. RESET HUNG JOBS (Reclaim jobs that crashed/timed out)
// [PERF-GUARD] Stop if server is saturated
if (!isSystemHealthy()) {
    echo json_encode(['status' => 'throttled', 'message' => 'Server load too high, pausing worker']);
    exit;
}

$pdo->prepare("UPDATE queue_jobs SET status = 'pending', attempts = attempts + 1, available_at = NOW() 
               WHERE status = 'processing' AND reserved_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)")
    ->execute();

// Reset stuck PDF chunks (processing for > 30 min)
$pdo->prepare("UPDATE ai_pdf_chunk_results SET status = 'pending', error_message = NULL 
               WHERE status = 'error' AND error_message = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)")
    ->execute();

// 1. Fetch pending jobs with row-level locking
// [FIX] Match the MySQL version guard already used in worker_flow.php.
// FOR UPDATE SKIP LOCKED is only available in MySQL 8.0+.
// On MySQL 5.7 it throws a syntax error, bringing down the entire worker.
$isSkipLockedSupported = isDatabaseSkipLockedSupported($pdo);
$skipLockedClause = $isSkipLockedSupported ? 'FOR UPDATE SKIP LOCKED' : 'FOR UPDATE';

// [BUG FIX] Initialize $maxJobs which was previously undefined, causing LIMIT syntax errors
// [FIX R4-H01] Cap max_jobs to prevent attacker-controlled massive DB scans.
// Without cap: ?max_jobs=999999 would lock the entire queue_jobs table.
$maxJobs = min((int)($_GET['max_jobs'] ?? 100), 1000);

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("
        SELECT id, queue, payload, attempts FROM queue_jobs 
        WHERE status = 'pending' AND available_at <= ? 
        ORDER BY 
            CASE 
                WHEN queue = 'high' THEN 1 
                WHEN queue = 'flows' THEN 2 
                ELSE 3 
            END ASC,
            available_at ASC,
            id ASC
        LIMIT ? 
        $skipLockedClause
    ");
    $stmt->execute([$now, $maxJobs]);
    $jobs = $stmt->fetchAll();

    if (empty($jobs)) {
        $pdo->commit();
        echo json_encode(['status' => 'idle', 'message' => 'No jobs found']);
        exit;
    }

    // 2. Mark jobs as processing
    $jobIds = array_column($jobs, 'id');
    $placeholders = implode(',', array_fill(0, count($jobIds), '?'));
    $pdo->prepare("UPDATE queue_jobs SET status = 'processing', reserved_at = ? WHERE id IN ($placeholders)")
        ->execute(array_merge([$now], $jobIds));

    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
    exit;
}

// 3. Process jobs one by one (outside reservation transaction to avoid long locks)
$jobsProcessed = 0; // [FIX-A] Must be initialized before the loop

// [OPTIMIZATION] Pre-compile SQL statements to prevent N+1 CPU waste during job updates
$stmtJobSuccess = $pdo->prepare("UPDATE queue_jobs SET status = 'completed', finished_at = NOW() WHERE id = ?");
$stmtJobRetry = $pdo->prepare("UPDATE queue_jobs SET status = 'pending', attempts = ?, available_at = ?, error_message = ? WHERE id = ?");
$stmtJobFail = $pdo->prepare("UPDATE queue_jobs SET status = 'failed', error_message = ?, finished_at = NOW() WHERE id = ?");
foreach ($jobs as $jobItem) {
    // [HEAL] REFRESH LOCK: Update the lock timestamp every job so other workers don't start prematurely
    // during a long-running batch (e.g. 1000 emails campaign).
    if (!$isPriority) {
        @file_put_contents($workerLock, time());
    }

    // [TIME GUARD] Similar to worker_flow.php, stop if we're close to the execution limit (300s)
    // to avoid a Hard Fatal Timeout and let the next runner take over cleanly.
    if (time() - $_SERVER['REQUEST_TIME'] > 280) {
        $jobError = "Worker reached execution limit (280s). Stopping batch.";
        break;
    }

    $payload = json_decode($jobItem['payload'], true);
    $jobType = $jobItem['queue']; // [FIX] Use unique name to avoid include shadowing
    $jobSuccess = false;
    $jobError = null;

    try {
        // [PERF-GUARD] Re-check system health every job to catch sudden spikes
        if ($jobsProcessed > 0 && $jobsProcessed % 5 === 0 && !isSystemHealthy(2.0, 64)) {
            $jobError = "System saturated mid-batch. Pausing.";
            break;
        }

        switch ($jobType) {
            case 'high':
            case 'default':
            case 'low':
                // Web Tracking and Other Generic Tasks
                $action = $payload['action'] ?? '';
                if ($action === 'resolve_geo') {
                    require_once __DIR__ . '/web_tracking_processor.php';
                    $jobSuccess = resolveGeoLocation($pdo, $payload);
                } elseif ($action === 'identify_visitor') {
                    require_once __DIR__ . '/web_tracking_processor.php';
                    $jobSuccess = identifyVisitor($pdo, $payload);
                } elseif ($action === 'process_meta_inbound') {
                    // [FIX] Handle legacy meta inbound tasks
                    require_once __DIR__ . '/meta_webhook_processor.php';
                    if (function_exists('processMetaInboundJob')) {
                        $jobSuccess = processMetaInboundJob($pdo, $payload);
                    } else {
                        $jobSuccess = true; // Mark as done to clear queue if processor missing
                    }
                } elseif ($action === 'aggregate_daily') {
                    require_once __DIR__ . '/web_tracking_processor.php';
                    $jobSuccess = aggregateDailyStats($pdo, $payload);
                } elseif ($action === 'sync_web_journey') {
                    require_once __DIR__ . '/web_tracking_processor.php';
                    $jobSuccess = syncWebJourney($pdo, $payload);
                } elseif ($action === 'enrich_subscriber') {
                    require_once __DIR__ . '/web_tracking_processor.php';
                    $jobSuccess = enrichSubscriberProfile($pdo, $payload);
                } elseif ($action === 'notify_captured_lead') {
                    require_once __DIR__ . '/notification_helper.php';
                    $jobSuccess = sendLeadNotificationEmail($pdo, $payload['property_id'] ?? '', $payload['lead_data'] ?? [], $payload['source'] ?? 'AutoCapture');
                }
                break;

            case 'stat_update':
                // [FIX] Handle tracking events (open_email, click_link, etc.)
                // Shared Logic via tracking_processor.php
                require_once __DIR__ . '/tracking_processor.php';
                $jobSuccess = processTrackingEvent($pdo, 'stat_update', $payload);
                break;

            case 'unsubscribe':
                // Shared Logic via tracking_processor.php
                require_once __DIR__ . '/tracking_processor.php';
                $jobSuccess = processTrackingEvent($pdo, 'unsubscribe', $payload);
                break;

            case 'sync_zalo_profile':
                $zId = $payload['zalo_user_id'];
                $e = $payload['email'];
                $p = $payload['phone'];
                $subId = $payload['sub_id'];

                // 1. Update Zalo Subscriber Profile
                $stmtZ = $pdo->prepare("UPDATE zalo_subscribers SET manual_email = ?, phone_number = ? WHERE id = ?");
                $stmtZ->execute([$e, $p, $subId]);

                // 2. [NEW] Use Centralized Sync Helper
                require_once __DIR__ . '/zalo_sync_helpers.php';
                syncZaloToMain($pdo, $subId);

                $jobSuccess = true;
                break;

            case 'flows':
                // Propagation and Enrollment logic
                require_once __DIR__ . '/trigger_helper.php';

                if (isset($payload['trigger_type']) && isset($payload['subscriber_id'])) {
                    $tType = $payload['trigger_type'];
                    $sId = $payload['subscriber_id'];
                    $tId = $payload['target_id'] ?? 'all';

                    triggerFlows($pdo, $sId, $tType, $tId);
                    $jobSuccess = true;
                } elseif (isset($payload['priority_queue_id'])) {
                    $_GET['priority_queue_id'] = $payload['priority_queue_id'];
                    $_GET['subscriber_id'] = $payload['subscriber_id'];
                    $_GET['priority_flow_id'] = $payload['priority_flow_id'];
                    require_once __DIR__ . '/worker_flow.php';
                    runWorkerFlow($pdo);
                    $jobSuccess = true;
                } else {
                    // Default fallback: Trigger a regular flow worker run
                    require_once __DIR__ . '/worker_flow.php';
                    runWorkerFlow($pdo);
                    $jobSuccess = true;
                }
                break;

            case 'campaigns':
                // Campaign processing logic
                $cid = $payload['campaign_id'] ?? null;
                if ($cid) {
                    // [FIX-C] Use require_once + function call  safe for repeated jobs in same run
                    // [FIX-D] Use __DIR__ for consistent path resolution (cron-safe)
                    require_once __DIR__ . '/worker_campaign.php';
                    runWorkerCampaign($pdo, $cid);
                    $jobSuccess = true;
                } else {
                    $jobError = "Missing campaign_id in campaigns queue";
                }
                break;

            case 'zalo_broadcast_single':
                require_once __DIR__ . '/zalo_sender.php';
                $userId = $payload['user_id'];
                $listId = $payload['list_id'] ?? null;
                $messageContent = $payload['message'];
                $buttons = $payload['buttons'] ?? [];
                $attachmentId = $payload['attachment_id'] ?? null;
                $messageType = $payload['message_type'] ?? 'text';
                $oaConfigId = $payload['oa_config_id'] ?? null;

                // Lookup OA Config if missing
                if (!$oaConfigId && $listId) {
                    $stmtOa = $pdo->prepare("SELECT oa_config_id FROM zalo_lists WHERE id = ?");
                    $stmtOa->execute([$listId]);
                    $oaConfigId = $stmtOa->fetchColumn();
                }

                if (!$oaConfigId) {
                    $jobSuccess = false;
                    $jobError = "Missing OA Config ID";
                    break;
                }

                // Prepare Logic aligned with zalo_audience.php
                $finalText = $messageContent;
                $attachment = null;

                // 1. Image Message
                if ($messageType === 'image' && $attachmentId) {
                    $attachment = [
                        'type' => 'template',
                        'payload' => [
                            'template_type' => 'media',
                            'elements' => [['media_type' => 'image', 'attachment_id' => $attachmentId]]
                        ]
                    ];

                    // Buttons for Image
                    if (!empty($buttons)) {
                        $zaloButtons = [];
                        foreach ($buttons as $btn) {
                            if (!empty($btn['title']) && !empty($btn['url'])) {
                                $zaloButtons[] = ['title' => $btn['title'], 'type' => 'oa.open.url', 'payload' => ['url' => $btn['url']]];
                            }
                        }
                        if (!empty($zaloButtons)) {
                            $attachment['payload']['buttons'] = $zaloButtons;
                        }
                    }
                }
                // 2. Text Message
                else {
                    // Append buttons as text for basic text messages (Zalo CS API limitation for simple text)
                    if (!empty($buttons)) {
                        foreach ($buttons as $btn) {
                            if (!empty($btn['title']) && !empty($btn['url'])) {
                                $finalText .= "\n🔗 " . $btn['title'] . ": " . $btn['url'];
                            }
                        }
                    }
                }

                $res = sendConsultationMessage($pdo, $oaConfigId, $userId, $finalText, $attachment);
                $jobSuccess = $res['success'];
                if (!$jobSuccess) {
                    $jobError = $res['message'] ?? 'Zalo API Error';
                }
                break;

            case 'ai_training':
                // Optimized Async AI Training
                require_once __DIR__ . '/ai_training_core.php';
                $propertyId = $payload['property_id'];
                $docIds = $payload['doc_ids'] ?? [];
                $adminId = $payload['admin_id'] ?? null;

                $trainRes = trainDocsCore($pdo, $propertyId, $docIds, $adminId);

                if (isset($trainRes['success']) && $trainRes['success']) {
                    $jobSuccess = true;
                } else {
                    $jobSuccess = false;
                    $jobError = $trainRes['message'] ?? 'Training failed without error message';
                }
                break;

            case 'ai_pdf_chunk':
                // [NEW] Process up to 5 PDF page-range chunks in PARALLEL via curl_multi
                // payload: { doc_id, property_id, file_uri, total_chunks, api_key_hint }
                require_once __DIR__ . '/file_extractor.php';
                require_once __DIR__ . '/ai_training_core.php';

                // Lazy-create ai_pdf_chunk_results table if needed
                try {
                    $pdo->exec("CREATE TABLE IF NOT EXISTS ai_pdf_chunk_results (
                        id VARCHAR(50) PRIMARY KEY,
                        doc_id VARCHAR(50) NOT NULL,
                        chunk_index INT NOT NULL,
                        page_start INT NOT NULL,
                        page_end INT NOT NULL,
                        chapters_json MEDIUMTEXT,
                        status ENUM('pending','done','error') DEFAULT 'pending',
                        error_message TEXT DEFAULT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_doc_id (doc_id),
                        INDEX idx_status_updated (status, updated_at),
                        UNIQUE KEY uq_doc_chunk (doc_id, chunk_index)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
                } catch (Exception $e) { /* table may already exist */
                }

                $docId = $payload['doc_id'];
                $propertyId = $payload['property_id'];
                $fileUri = $payload['file_uri'];
                // total_chunks not stored in payload  query from DB
                $stmtTotalChunks = $pdo->prepare("SELECT COUNT(*) FROM ai_pdf_chunk_results WHERE doc_id = ?");
                $stmtTotalChunks->execute([$docId]);
                $totalChunks = (int) $stmtTotalChunks->fetchColumn();

                // Resolve API key
                $stmtKey2 = $pdo->prepare("SELECT s.gemini_api_key, c.gemini_api_key as cat_key FROM ai_chatbot_settings s LEFT JOIN ai_chatbots b ON s.property_id = b.id LEFT JOIN ai_chatbot_settings c ON b.category_id = c.property_id WHERE s.property_id = ? LIMIT 1");
                $stmtKey2->execute([$propertyId]);
                $keyRow = $stmtKey2->fetch(PDO::FETCH_ASSOC) ?: [];
                $activeKey = (!empty($keyRow['gemini_api_key'])) ? $keyRow['gemini_api_key'] : ((!empty($keyRow['cat_key'])) ? $keyRow['cat_key'] : (getenv('GEMINI_API_KEY') ?: ''));

                if (empty($activeKey)) {
                    $jobSuccess = false;
                    $jobError = 'Không có Gemini API Key cho property ' . $propertyId;
                    break;
                }

                // Grab up to 5 pending chunks for THIS doc from DB, mark as claimed
                $pdo->beginTransaction();
                try {
                    // [FIX P7-C3] Use $skipLockedClause (computed at startup with MySQL version check)
                    // instead of hardcoded 'FOR UPDATE SKIP LOCKED' which throws a fatal syntax error
                    // on MySQL 5.7 hosts  causing ai_pdf_chunk jobs to fail permanently.
                    $stmtPending = $pdo->prepare("SELECT chunk_index, page_start, page_end FROM ai_pdf_chunk_results WHERE doc_id = ? AND status = 'pending' ORDER BY chunk_index ASC LIMIT 5 $skipLockedClause");
                    $stmtPending->execute([$docId]);
                    $pendingChunks = $stmtPending->fetchAll(PDO::FETCH_ASSOC);

                    if (!empty($pendingChunks)) {
                        $idxList = array_column($pendingChunks, 'chunk_index');
                        $placeholders2 = implode(',', array_fill(0, count($idxList), '?'));
                        // Mark as 'doing' to prevent double-pick (reuse 'error' temp until done)
                        $pdo->prepare("UPDATE ai_pdf_chunk_results SET status = 'error', error_message = 'processing' WHERE doc_id = ? AND chunk_index IN ($placeholders2)")
                            ->execute(array_merge([$docId], $idxList));
                    }
                    $pdo->commit();
                } catch (Exception $e) {
                    if ($pdo->inTransaction())
                        $pdo->rollBack();
                    $pendingChunks = [];
                }

                if (empty($pendingChunks)) {
                    // No pending chunks for this doc  check if all chunks are done
                    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM ai_pdf_chunk_results WHERE doc_id = ? AND status != 'done'");
                    $stmtCount->execute([$docId]);
                    $notDone = (int) $stmtCount->fetchColumn();
                    if ($notDone === 0) {
                        // All done  trigger merge & embed
                        mergePdfChunksAndEmbed($pdo, $docId, $propertyId, $activeKey);
                    }
                    $jobSuccess = true;
                    break;
                }

                // Build pageRanges array for curl_multi call
                $pageRanges = [];
                foreach ($pendingChunks as $pc) {
                    $pageRanges[] = [
                        'start' => (int) $pc['page_start'],
                        'end' => (int) $pc['page_end'],
                        'chunk_index' => (int) $pc['chunk_index'],
                    ];
                }

                training_log("ai_pdf_chunk worker: Firing " . count($pageRanges) . " parallel requests for doc={$docId} (chunks: " . implode(',', array_column($pageRanges, 'chunk_index')) . ")");
                $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = 'Đang trích xuất " . count($pageRanges) . " đoạn song song (trang " . $pageRanges[0]['start'] . "-" . end($pageRanges)['end'] . ")...' WHERE id = ?")
                    ->execute([$docId]);

                // Fire 5 concurrent Gemini requests
                $multiResults = extractPdfPageRangeMulti($fileUri, $pageRanges, $activeKey);

                // Save results back to DB
                $stmtUpdate = $pdo->prepare("UPDATE ai_pdf_chunk_results SET status = ?, chapters_json = ?, error_message = ? WHERE doc_id = ? AND chunk_index = ?");
                $allSuccess = true;
                foreach ($pageRanges as $range) {
                    $idx = $range['chunk_index'];
                    $result = $multiResults[$idx] ?? ['error' => 'No result returned'];

                    if (isset($result['error'])) {
                        if (!empty($result['retry'])) {
                            // 429 rate limit ? reset to pending, will be picked up next run
                            $pdo->prepare("UPDATE ai_pdf_chunk_results SET status = 'pending', error_message = NULL WHERE doc_id = ? AND chunk_index = ?")
                                ->execute([$docId, $idx]);
                        } else {
                            $stmtUpdate->execute(['error', null, mb_substr($result['error'], 0, 500), $docId, $idx]);
                        }
                        $allSuccess = false;
                    } else {
                        $stmtUpdate->execute(['done', json_encode($result), null, $docId, $idx]);
                    }
                }

                // Check if ALL chunks for this doc are now done
                $stmtDone = $pdo->prepare("SELECT COUNT(*) FROM ai_pdf_chunk_results WHERE doc_id = ? AND status != 'done'");
                $stmtDone->execute([$docId]);
                $remaining = (int) $stmtDone->fetchColumn();

                training_log("ai_pdf_chunk worker: Done. Remaining chunks for doc={$docId}: {$remaining}");

                if ($remaining === 0) {
                    // All chunks extracted ? merge & embed
                    training_log("ai_pdf_chunk worker: All chunks complete for doc={$docId}. Triggering merge & embed.");
                    $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = 'Tất cả đoạn đã trích xuất. Đang merge và tạo Embedding...' WHERE id = ?")
                        ->execute([$docId]);
                    mergePdfChunksAndEmbed($pdo, $docId, $propertyId, $activeKey);
                } elseif ($remaining > 0) {
                    // More chunks pending.
                    // ? Throttle: wait 15s before next batch (max ~20 API calls/minute across all workers)
                    // [FIX] INFINITE LOOP GUARD: Track how many consecutive re-trigger rounds this doc has had.
                    // If a specific page consistently causes Gemini API Fatal errors, $remaining never reaches 0
                    // and the worker inserts a new job forever ? fills queue_jobs table and pegs the worker.
                    // Solution: carry retry_count in payload, auto-fail doc after MAX_PDF_RETRIES rounds.
                    $pdfRetryCount = (int) ($payload['pdf_retry_count'] ?? 0);
                    $MAX_PDF_RETRIES = 10; // 10 rounds  5 pages/round = 50 pages max chịu đựng lỗi
                    if ($pdfRetryCount >= $MAX_PDF_RETRIES) {
                        $errMsg = "[CIRCUIT BREAKER] Doc $docId auto-failed after $MAX_PDF_RETRIES retry rounds with $remaining chunks still unprocessed. Manual review required.";
                        training_log($errMsg);
                        $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'error', error_message = ? WHERE id = ?")
                            ->execute([mb_substr($errMsg, 0, 500), $docId]);
                    } else {
                        $nextRetry = $pdfRetryCount + 1;
                        $nextPayload = $payload;
                        $nextPayload['pdf_retry_count'] = $nextRetry;
                        $nextJobId = bin2hex(random_bytes(16));
                        $pdo->prepare("INSERT INTO queue_jobs (id, queue, payload, status, available_at, created_at) VALUES (?, 'ai_pdf_chunk', ?, 'pending', DATE_ADD(NOW(), INTERVAL 15 SECOND), NOW())")
                            ->execute([$nextJobId, json_encode($nextPayload)]);
                        // Update progress message showing cooldown
                        $doneCount = $totalChunks - $remaining;
                        $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = CONCAT(' trích xuất ', ?, '/', ?, ' đoạn, nghỉ 15 giây để tránh rate limit, sẽ tiếp tục tự động... (lần ', ?, '/', ?)') WHERE id = ?")
                            ->execute([$doneCount, $totalChunks, $nextRetry, $MAX_PDF_RETRIES, $docId]);
                    }

                }

                $jobSuccess = true;
                break;

            default:
                $jobError = "Unknown job type: $jobType";
                break;
        }
    } catch (Exception $e) {
        $jobError = $e->getMessage();
    }

    // 4. Update job status
    if ($jobSuccess) {
        $stmtJobSuccess->execute([$jobItem['id']]);
        $jobsProcessed++;

        // [FIX] KEEP-ALIVE LOCK: Refresh lock timestamp every 10 successful jobs.
        // Without this, a batch of 200 heavy jobs (AI PDF, campaign sends) taking >5 min
        // would look like a crashed/zombie worker to the next cron invocation  which then
        // starts a second worker, causing double-processing and CPU/RAM exhaustion.
        if (!$isPriority && $jobsProcessed % 10 === 0) {
            @file_put_contents($workerLock, time());
        }
    } else {
        $jobError = $jobError ?: "Task returned failure without specific error message";
        $attempts = ($jobItem['attempts'] ?? 0) + 1;
        $maxAttempts = 3;

        if ($attempts < $maxAttempts) {
            // Exponential backoff: 5min, 25min, 125min
            $delay = pow(5, $attempts) * 60;
            $retryAt = date('Y-m-d H:i:s', time() + $delay);

            $stmtJobRetry->execute([$attempts, $retryAt, mb_substr($jobError, 0, 500), $jobItem['id']]);
        } else {
            $stmtJobFail->execute([mb_substr($jobError, 0, 500), $jobItem['id']]);
            // [FIX] Write to dedicated error log for ops alerting.
            // DB row alone is easy to miss; this file gives ops team an out-of-band signal.
            // grep worker_error.log for [FAILED] to detect systemic job failures quickly.
            $errLine = date('[Y-m-d H:i:s]') . " [FAILED] job_id={$jobItem['id']} type={$jobType} attempts={$attempts} error=" . mb_substr($jobError, 0, 300) . "\n";
            @file_put_contents(__DIR__ . '/worker_error.log', $errLine, FILE_APPEND | LOCK_EX);
        }
    }
    
    // [OPTIMIZATION] Explicit Garbage Collection (Zero-Leak Memory Profile)
    unset($payload, $jobItem, $jobType, $jobSuccess, $jobError, $res, $trainRes, $multiResults, $pageRanges, $pendingChunks, $buttons, $attachment, $nextPayload);
    
    // Ép giải phóng bộ nhớ để tránh tràn RAM (Memory Leak)
    if ($jobsProcessed % 10 === 0) {
        gc_collect_cycles();
    }
}
gc_collect_cycles();

// 5. Automatic Cleanup (Self-Maintenance, 1% chance) to prevent table bloat
if (rand(1, 100) === 1) {
    // Delete completed jobs older than 1 hour to keep table light
    $pdo->query("DELETE FROM queue_jobs WHERE status = 'completed' AND finished_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");

    // [OPTIMIZATION] Prune AI Caches older than 30 days
    $pdo->query("DELETE FROM ai_vector_cache WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
    $pdo->query("DELETE FROM ai_rag_search_cache WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");

    // [FIX P7-H3] Keep failed jobs 7 days (was 1 day) for forensic analysis.
    // When worker_error.log is rotated, DB records are the only backup for systemic failure diagnosis.
    $pdo->query("DELETE FROM queue_jobs WHERE status = 'failed' AND finished_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
}

// 6. [FIX] Always scan subscriber_flow_states for due waiting items.
// worker_queue.php only processes queue_jobs, but flow delay steps just update
// scheduled_at in subscriber_flow_states without adding a new queue_jobs entry.
// Without this, waiting subscribers stay stuck until something else triggers worker_flow.php.
$hasDueFlowStates = false;
try {
    $stmt = $pdo->prepare("
        SELECT 1 FROM subscriber_flow_states q
        JOIN flows f ON q.flow_id = f.id
        WHERE q.status = 'waiting' AND q.scheduled_at <= NOW() AND f.status = 'active'
        LIMIT 1
    ");
    $stmt->execute();
    $hasDueFlowStates = (bool) $stmt->fetchColumn();
} catch (Exception $e) {
    // Ignore check errors  still safe to run worker_flow.php
    $hasDueFlowStates = true;
}

if ($hasDueFlowStates) {
    // [PERF-GUARD] Final health check before spawning heavy flow engine
    if (isSystemHealthy()) {
        require_once __DIR__ . '/worker_flow.php';
        if (function_exists('runWorkerFlow')) {
            runWorkerFlow($pdo);
        }
    }
}

echo json_encode(['status' => 'success', 'processed' => $jobsProcessed]);
