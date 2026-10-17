<?php
// api/FlowExecutor.php
// Shared Logic for executing flow steps (used by worker_flow.php and worker_priority.php)

require_once 'flow_helpers.php';
require_once 'Mailer.php';
require_once 'zalo_sender.php';
require_once 'meta_sender.php';

class FlowExecutor
{
    private $pdo;
    private $mailer;
    private $apiUrl;
    // [MEMORY] Static caches are class-level singletons shared across all instances within
    // one PHP process. Cap size to prevent unbounded growth during long worker runs
    // (e.g. flow worker processing 10k+ subscribers without restart).
    private static $tagCache = [];     // Max 200 entries Ã¢â‚¬â€ see pruneStaticCache() calls below
    private static $profileCache = []; // Max 200 entries

    public function __construct($pdo, $mailer, $apiUrl)
    {
        $this->pdo = $pdo;
        $this->mailer = $mailer;
        $this->apiUrl = $apiUrl;
    }

    private $statsBuffer = []; // [PHASE 8] RAM Buffer for heavy stats

    /**
     * [FIX AUDIT-07] Centralized static cache pruning to prevent memory leaks
     * in long-running worker processes.
     */
    private static function pruneCache(&$cache, $max = 200)
    {
        if (count($cache) >= $max) {
            reset($cache);
            unset($cache[key($cache)]);
        }
    }

    /**
     * Buffer stats update internally into RAM (Phase 8 - Extreme Scale)
     */
    private function bufferStatsUpdate($table, $id, $column, $value = 1, $workspaceId = null)
    {
        // [SECURITY] Whitelist valid table/column combinations to prevent SQL injection
        static $ALLOWED = [
            'flows'       => ['stat_total_sent', 'stat_total_failed', 'stat_completed', 'stat_enrolled', 'stat_zalo_sent', 'stat_zns_sent', 'stat_zns_failed', 'stat_meta_sent'],
            'subscribers' => ['stats_sent', 'stats_opened', 'stats_clicked'],
        ];
        if (!isset($ALLOWED[$table]) || !in_array($column, $ALLOWED[$table], true)) {
            error_log("[bufferStatsUpdate] Blocked invalid table/column: $table.$column");
            return;
        }

        $key = "{$table}_{$id}_{$column}";
        if (!isset($this->statsBuffer[$key])) {
            $this->statsBuffer[$key] = [
                'table' => $table,
                'id' => $id,
                'column' => $column,
                'increment' => 0,
                'workspace_id' => $workspaceId
            ];
        }
        $this->statsBuffer[$key]['increment'] += $value;
        if ($workspaceId) $this->statsBuffer[$key]['workspace_id'] = $workspaceId;
        
        // Auto-flush to prevent unbounded memory growth during huge loops
        if (count($this->statsBuffer) >= 100) {
            $this->flushStatsBuffer();
        }
    }

    /**
     * Flush memory stats buffer to DB in a single bulk INSERT (Phase 8 Multi-Million Scale)
     */
    public function flushStatsBuffer()
    {
        if (empty($this->statsBuffer)) return;

        try {
            $ph = [];
            $vals = [];
            foreach ($this->statsBuffer as $stat) {
                if ($stat['increment'] === 0) continue;
                $ph[] = "(?, ?, ?, ?, ?, NOW())";
                $vals[] = $stat['workspace_id'] ?? 1;
                $vals[] = $stat['table'];
                $vals[] = $stat['id'];
                $vals[] = $stat['column'];
                $vals[] = $stat['increment'];
            }
            if (!empty($ph)) {
                $sql = "INSERT INTO stats_update_buffer (workspace_id, target_table, target_id, column_name, increment, created_at) VALUES " . implode(',', $ph);
                $this->pdo->prepare($sql)->execute($vals);
            }
        } catch (Exception $e) {
            error_log("[FlowExecutor] Flush stats failed: " . $e->getMessage());
            // Fallback for strict modes or max_allowed_packet
            // [FIX P9-H3] Defense-in-depth: re-validate whitelist INSIDE fallback path.
            // bufferStatsUpdate() already filters, but the fallback UPDATE interpolates
            // table/column directly into SQL Ã¢â‚¬â€ if $statsBuffer is ever externally mutated
            // (future regression), SQL injection is possible without this guard.
            static $FALLBACK_ALLOWED = [
                'flows'       => ['stat_total_sent', 'stat_total_failed', 'stat_completed', 'stat_enrolled', 'stat_zalo_sent', 'stat_zns_sent', 'stat_zns_failed', 'stat_meta_sent'],
                'subscribers' => ['stats_sent', 'stats_opened', 'stats_clicked'],
            ];
            foreach ($this->statsBuffer as $stat) {
                if ($stat['increment'] === 0) continue;
                if (!isset($FALLBACK_ALLOWED[$stat['table']]) || !in_array($stat['column'], $FALLBACK_ALLOWED[$stat['table']], true)) {
                    error_log("[FlowExecutor] Fallback blocked invalid table/column: {$stat['table']}.{$stat['column']}");
                    continue;
                }
                try {
                    $where = "WHERE id = ?";
                    $params = [$stat['increment'], $stat['id']];
                    if (!empty($stat['workspace_id'])) {
                        $where .= " AND workspace_id = ?";
                        $params[] = $stat['workspace_id'];
                    }
                    $this->pdo->prepare("UPDATE {$stat['table']} SET {$stat['column']} = {$stat['column']} + ? $where")
                        ->execute($params);
                } catch (\Throwable $th) {}
            }
        }
        $this->statsBuffer = []; // Clear RAM
    }

    /**
     * Execute a single step for a subscriber
     * 
     * @param array $step The step configuration array
     * @param array $subscriber Subscriber data array (must include id, email, phone, etc.)
     * @param int $flowId Flow ID
     * @param string $currentStepId Current Step UUID
     * @param int|null $campaignId Optional Campaign ID context
     * @param array $flowConfig Full Flow Config
     * @param array $contextData Additional context (e.g. flow steps for references)
     * @return array Result ['status', 'next_step_id', 'is_instant', 'logs', 'scheduled_at', 'should_continue']
     */
    public function executeStep($step, $subscriber, $flowId, $currentStepId, $campaignId = null, $flowConfig = [], $contextData = [])
    {
        $logs = [];
        $isInstantStep = false;
        $shouldContinueChain = true;
        $messageSent = false;
        $nextStepId = null;
        $nextScheduledAt = date('Y-m-d H:i:s');
        $status = 'completed';

        $subscriberId = $subscriber['subscriber_id'] ?? $subscriber['id'];
        $flowName = $contextData['flow_name'] ?? 'Flow';

        // Helper context required for some checks
        $queueCreatedAt = $contextData['queue_created_at'] ?? null;
        $lastStepAt = $contextData['last_step_at'] ?? null;
        $itemUpdatedAt = $contextData['updated_at'] ?? null;
        $hasEmailError = $contextData['has_email_error'] ?? false;
        $flowSteps = $contextData['flow_steps'] ?? [];

        // OMNI-FIX REMOVED: User requested not to link flow activities back to campaign IDs
        // This ensures flow steps are reported under flow_id only, keeping campaign reports clean.

        try {
            switch ($step['type']) {
                case 'action': // Send Email
                    // [IDEMPOTENCY GUARD] Check if this step's email was already sent.
                    // Scenario: worker sends email Ã¢â€ â€™ crashes before committing step_id advance
                    // Ã¢â€ â€™ 5-min stale recovery picks up same item Ã¢â€ â€™ would re-send duplicate.
                    // Fix: Check BOTH activity_buffer (recently written, not yet synced) AND
                    // subscriber_activity (synced rows) for an existing send record.
                    // reference_id = $currentStepId uniquely identifies "this step for this flow".
                    //
                    // [SCOPE FIX] Must also scope to queue_created_at to prevent false positives on
                    // recurring/allowMultiple flows. Without scoping, a subscriber's 2nd enrollment
                    // would find 'receive_email' from their 1st enrollment (same step_id) and
                    // SILENTLY SKIP every email step Ã¢â‚¬â€ never sending on re-enrollment.
                    try {
                        $dedupParams = [$subscriber['workspace_id'], $subscriberId, $currentStepId];
                        $dedupCreatedAtClause = '';
                        if (!empty($queueCreatedAt)) {
                            $dedupCreatedAtClause = ' AND created_at >= ?';
                            $dedupParams[] = $queueCreatedAt;
                        }
                        $bufferParams = [$subscriber['workspace_id'], $subscriberId, $currentStepId];
                        if (!empty($queueCreatedAt)) {
                            $bufferParams[] = $queueCreatedAt;
                        }

                        $stmtDedup = $this->pdo->prepare("
                            SELECT 1 FROM subscriber_activity
                            WHERE workspace_id = ? AND subscriber_id = ? AND type IN ('receive_email','failed_email') AND reference_id = ?{$dedupCreatedAtClause}
                            UNION ALL
                            SELECT 1 FROM activity_buffer
                            WHERE workspace_id = ? AND subscriber_id = ? AND type IN ('receive_email','failed_email') AND reference_id = ?{$dedupCreatedAtClause}
                            LIMIT 1
                        ");
                        $stmtDedup->execute(array_merge($dedupParams, $bufferParams));
                        if ($stmtDedup->fetchColumn()) {
                            // Email already sent (or permanently failed) for this step in THIS enrollment.
                            $stepLabel = $step['label'] ?? $step['type'] ?? 'unknown'; // [FIX] Guard missing 'label' key
                            $logs[] = "  -> [IDEMPOTENCY] Step '{$stepLabel}' already sent for sub {$subscriberId} in this enrollment. Advancing.";

                            $nextStepId = $step['nextStepId'] ?? null;
                            $isInstantStep = true;
                            $messageSent = false;
                            break;
                        }
                    } catch (\Exception $eDup) {
                        // If check fails (e.g. table doesn't exist), fall through and attempt send normally.
                        error_log('[FlowExecutor] Idempotency check failed: ' . $eDup->getMessage());
                    }


                    // [OPTIMIZATION] Frequency Cap Check (Per Channel)
                    $maxPerDay = (int) ($flowConfig['maxMessagesPerDay'] ?? 0);
                    $todaySentData = $contextData['total_sent_today'] ?? ['email' => 0];
                    $todaySent = is_array($todaySentData) ? ($todaySentData['email'] ?? 0) : (int)$todaySentData;

                    if ($maxPerDay > 0 && $todaySent >= $maxPerDay) {
                        $logs[] = "  -> Frequency cap reached ($todaySent/$maxPerDay). Rescheduling to tomorrow.";
                        logActivity($this->pdo, $subscriberId, 'frequency_cap_reached', $currentStepId, $flowName, "Cap: $maxPerDay", $flowId, null, [], $subscriber['workspace_id']);

                        $status = 'waiting';
                        $nextScheduledAt = date('Y-m-d 09:00:00', strtotime('+1 day'));
                        $shouldContinueChain = false;
                        break;
                    }

                    $config = $step['config'];

                    // [BUG-FIX #10] Build resolver context before calling replaceMergeTags.
                    // Use /webhook.php?type=unsubscribe&sid=... matching Mailer.php and worker_campaign.php.
                    $unsubUrl = rtrim($this->apiUrl, '/') . '/webhook.php?type=unsubscribe&sid=' . urlencode((string)$subscriberId)
                        . ($flowId ? '&fid=' . urlencode((string)$flowId) : '')
                        . ($campaignId ? '&cid=' . urlencode((string)$campaignId) : '')
                        . ($currentStepId ? '&rid=' . urlencode((string)$currentStepId) : '');
                    $resolverContext = [
                        'unsubscribe_url' => $unsubUrl,
                        'unsubscribeLink' => $unsubUrl,
                        'campaign_name' => $flowName,
                        'campaignName' => $flowName,
                        'variable_fallbacks' => $config['variable_fallbacks'] ?? ($config['fallbacks'] ?? []),
                        'config' => $config
                    ];

                    $htmlContent = resolveEmailContent($this->pdo, $config['templateId'] ?? '', $config['customHtml'] ?? '', $config['contentBody'] ?? '', $resolverContext);

                    $finalHtml = replaceMergeTags($htmlContent, $subscriber, $resolverContext, $this->pdo);
                    $finalSubject = replaceMergeTags($config['subject'] ?? '', $subscriber, $resolverContext, $this->pdo);


                    // Attachments
                    // [PERF] Cache decoded attachment arrays per step to avoid re-decoding JSON
                    // for every subscriber in a flow batch (same step config is identical per subscriber).
                    static $attachmentCache = [];
                    if (!isset($attachmentCache[$currentStepId])) {
                        $attRaw = $config['attachments'] ?? '[]';
                        $attachmentCache[$currentStepId] = is_array($attRaw) ? $attRaw : (json_decode($attRaw, true) ?: []);
                        // Guard against cache growing unbounded for very long worker runs
                        if (count($attachmentCache) > 50) {
                            array_shift($attachmentCache);
                        }
                    }
                    $attachments = Mailer::filterAttachments($attachmentCache[$currentStepId], $subscriber['email']);

                    // [MULTI-EMAIL] Inject sender_email if specified in Flow Step
                    if (!empty($config['senderEmail'])) {
                        $this->mailer->setDynamicSender($config['senderEmail']);
                    } else {
                        $this->mailer->setDynamicSender(null);
                    }

                    // [SES SHARED RATE LIMITER] Acquire slot from cross-process file-lock.
                    // Shared with worker_campaign.php → campaign + flow combined ≤ 10/s total.
                    // Full implementation in sesAcquireRateSlot() (flow_helpers.php).
                    sesAcquireRateSlot(); // 100ms interval = 10/s shared across all workers

                    // Send
                    // [SAFETY GUARD] Skip virtual emails in flow
                    $isVirtualEmail = isVirtualEmail($subscriber['email']);
                    
                    if ($isVirtualEmail) {
                        $res = "Skipped: Virtual email";
                    } else {
                        // [PERF] skipQA=true: Flow emails are per-subscriber automation, not broadcast campaigns.
                        $res = $this->mailer->send($subscriber['email'], $finalSubject, $finalHtml, $subscriberId, $campaignId, $flowId, $flowName, $attachments, null, $currentStepId, $step['label'], false, true, null, null, $subscriber['workspace_id']);
                    }


                    if ($res === true || ($isVirtualEmail && $res === "Skipped: Virtual email")) {
                        if (!$isVirtualEmail) {
                            $this->bufferStatsUpdate('flows', $flowId, 'stat_total_sent', 1, $subscriber['workspace_id']);
                            $this->bufferStatsUpdate('subscribers', $subscriberId, 'stats_sent', 1, $subscriber['workspace_id']);
                            logActivity($this->pdo, $subscriberId, 'receive_email', $currentStepId, $flowName, "Email sent: " . $step['label'], $flowId, $campaignId, [], $subscriber['workspace_id']);
                            $logs[] = "  -> Email sent for {$subscriber['email']} (Step: {$step['label']}).";
                            
                            if (!isset($contextData['total_sent_today']) || !is_array($contextData['total_sent_today'])) {
                                $contextData['total_sent_today'] = [];
                            }
                            $contextData['total_sent_today']['email'] = ($contextData['total_sent_today']['email'] ?? 0) + 1;
                        } else {
                            // [VẬN HÀNH] Log as skipped but ADVANCE the flow so Zalo/ZNS steps can still trigger
                            logActivity($this->pdo, $subscriberId, 'skipped_email', $currentStepId, $flowName, "Skipped: Virtual email ({$subscriber['email']})", $flowId, $campaignId, [], $subscriber['workspace_id']);
                            $logs[] = "  -> Step '{$step['label']}' skipped (Virtual Email). Advancing flow.";
                        }

                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                        $messageSent = !$isVirtualEmail;
                    } else {
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_total_failed', 1, $subscriber['workspace_id']);
                        $errMsg = is_string($res) ? $res : 'Unknown Error';

                        // Hard Bounce Check
                        $isBounced = checkAndHandleHardBounce($this->pdo, $subscriberId, $errMsg);
                        $bounceBehavior = $flowConfig['bounceBehavior'] ?? 'stop';

                        if ($bounceBehavior === 'continue') {
                            $logs[] = "  -> Email failed for {$subscriber['email']}, but 'Auto Next' enabled. Continuing.";
                            logActivity($this->pdo, $subscriberId, 'failed_email', $currentStepId, $flowName, "Email failed (Continued): " . $errMsg, $flowId, $campaignId, [], $subscriber['workspace_id']);
                            $nextStepId = $step['nextStepId'] ?? null;
                            $isInstantStep = true;
                            $contextData['has_email_error'] = true;
                        } else {
                            $logs[] = "  -> Email failed for {$subscriber['email']}. Flow stopped.";
                            if ($isBounced) {
                                logActivity($this->pdo, $subscriberId, 'failed_email', $currentStepId, $flowName, "Hard Bounce: " . $errMsg, $flowId, $campaignId, [], $subscriber['workspace_id']);
                            } else {
                                logActivity($this->pdo, $subscriberId, 'failed_email', $currentStepId, $flowName, "Email failed: " . $errMsg, $flowId, $campaignId, [], $subscriber['workspace_id']);
                            }
                            $shouldContinueChain = false;
                            $status = 'failed';
                        }
                    }
                    break;

                case 'zalo_cs':
                    $config = $step['config'];
                    $oaConfigId = $config['zalo_oa_id'] ?? null;

                    // [PERF #6] Fetch zalo_user_id AND last_interaction_at in a single query.
                    // Previously: 2 identical SELECT queries with same WHERE condition.
                    // Saves 1 DB round-trip per Zalo CS step execution.
                    $stmtZ = $this->pdo->prepare("SELECT zalo_user_id, last_interaction_at FROM zalo_subscribers WHERE workspace_id = ? AND (id = ? OR zalo_user_id = ?) LIMIT 1");
                    $stmtZ->execute([$subscriber['workspace_id'], $subscriberId, $subscriberId]);
                    $zaloRow = $stmtZ->fetch();
                    $zaloUserId = $zaloRow['zalo_user_id'] ?? null;
                    $lastInteract = $zaloRow['last_interaction_at'] ?? null;

                    if (!$zaloUserId || !$oaConfigId) {
                        $logs[] = "  -> Zalo CS step skipped: Missing Zalo User ID or OA config.";
                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                        break;
                    }

                    // 48h window check — Zalo CS requires subscriber to have interacted within 48h
                    // [BUG-FIX] Bug #6: Previously using `$lastInteract && (time() - strtotime() > 48h)`
                    // When lastInteract=NULL (never interacted), the condition evaluated to FALSE
                    // so the code allowed sending — but Zalo API requires recent interaction.
                    // Fix: treat NULL as "no interaction" → block sending.
                    if (!$lastInteract || (time() - strtotime($lastInteract) > 48 * 3600)) {
                        $logs[] = "  -> Zalo CS step skipped: Out of 48h interaction window (last: " . ($lastInteract ?? 'never') . ").";
                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                        break;
                    }

                    // [OPTIMIZATION] Frequency Cap Check (Per Channel)
                    $maxPerDay = (int) ($flowConfig['maxMessagesPerDay'] ?? 0);
                    $todaySentData = $contextData['total_sent_today'] ?? ['zalo' => 0];
                    $todaySent = is_array($todaySentData) ? ($todaySentData['zalo'] ?? 0) : (int)$todaySentData;
                    if ($maxPerDay > 0 && $todaySent >= $maxPerDay) {
                        $logs[] = "  -> Frequency cap reached ($todaySent/$maxPerDay). Rescheduling Zalo to tomorrow.";
                        logActivity($this->pdo, $subscriberId, 'frequency_cap_reached', $currentStepId, $flowName, "Cap: $maxPerDay (Zalo)", $flowId, null, [], $subscriber['workspace_id']);
                        $status = 'waiting';
                        $nextScheduledAt = date('Y-m-d 09:00:00', strtotime('+1 day'));
                        $shouldContinueChain = false;
                        break;
                    }

                    $csContext = [
                        'variable_fallbacks' => $config['variable_fallbacks'] ?? ($config['fallbacks'] ?? []),
                        'config' => $config
                    ];
                    $finalText = replaceMergeTags($config['content'] ?? '', $subscriber, $csContext, $this->pdo);
                    $res = sendConsultationMessage($this->pdo, $oaConfigId, $zaloUserId, $finalText, null, $subscriber['workspace_id']);

                    if ($res['success']) {
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_zalo_sent', 1, $subscriber['workspace_id']);
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_total_sent', 1, $subscriber['workspace_id']);
                        logActivity($this->pdo, $subscriberId, 'zalo_sent', $currentStepId, $flowName, 'Zalo CS Sent: ' . $step['label'], $flowId, $campaignId, [], $subscriber['workspace_id']);
                        $logs[] = "  -> Zalo CS sent to {$zaloUserId}.";
                        $messageSent = true;

                        if (!isset($contextData['total_sent_today']) || !is_array($contextData['total_sent_today'])) {
                            $contextData['total_sent_today'] = [];
                        }
                        $contextData['total_sent_today']['zalo'] = ($contextData['total_sent_today']['zalo'] ?? 0) + 1;
                    } else {
                        $logs[] = "  -> Zalo CS failed: " . ($res['message'] ?? 'Unknown');
                        // Fallback ZNS
                        $fallbackTemplateId = $config['fallback_zns_template_id'] ?? null;
                        // [FIX] Track if we paused for time restriction — if true, skip
                        // $nextStepId/$isInstantStep below to preserve the 'waiting' status.
                        // (Can't use break here since we're inside an if-block, not a loop/switch)
                        $zaloFallbackPaused = false;
                        if ($fallbackTemplateId && !empty($subscriber['phone_number'])) {
                            $currentHour = (int) date('H');
                            if ($currentHour < 6 || $currentHour >= 22) {
                                $logs[] = "  -> Fallback ZNS paused (Outside 06-22). Rescheduling.";
                                $nextScheduledAt = date('Y-m-d 06:00:00', strtotime($currentHour < 6 ? 'today' : '+1 day'));
                                $status = 'waiting';
                                $shouldContinueChain = false;
                                $zaloFallbackPaused = true;
                            } else {
                                $logs[] = "  -> Attempting Fallback ZNS.";
                                $templateData = [];
                                $rawTemplateData = $config['fallback_zns_data'] ?? [];
                                $fbShortFieldMap = ['id' => 20, 'ma_giao_dich' => 20, 'ma_don_hang' => 20, 'tracking_id' => 20, 'order_id' => 20, 'invoice_id' => 20];
                                $fbZnsContext = [
                                    'variable_fallbacks' => $config['variable_fallbacks'] ?? ($config['fallbacks'] ?? []),
                                    'config' => $config
                                ];
                                foreach ($rawTemplateData as $key => $value) {
                                    $fbVal = is_string($value) ? replaceMergeTags($value, $subscriber, $fbZnsContext, $this->pdo) : $value;
                                    // [FIX] Apply same per-field ZNS length limits as primary zalo_zns step
                                    if (is_string($fbVal)) {
                                        $fbMax = $fbShortFieldMap[$key] ?? 100;
                                        if (mb_strlen($fbVal, 'UTF-8') > $fbMax) {
                                            $fbVal = mb_substr($fbVal, 0, $fbMax, 'UTF-8');
                                        }
                                    }
                                    $templateData[$key] = $fbVal;
                                }
                                $znsRes = sendZNSMessage($this->pdo, $oaConfigId, $fallbackTemplateId, $subscriber['phone_number'], $templateData, $flowId, $currentStepId, $subscriberId, null, null, $subscriber['workspace_id']);
                                if ($znsRes['success']) {
                                    $this->bufferStatsUpdate('flows', $flowId, 'stat_zns_sent', 1, $subscriber['workspace_id']);
                                    $this->bufferStatsUpdate('flows', $flowId, 'stat_total_sent', 1, $subscriber['workspace_id']);
                                    logActivity($this->pdo, $subscriberId, 'zns_sent', $currentStepId, $flowName, 'ZNS (Fallback) Sent', $flowId, $campaignId, [], $subscriber['workspace_id']);
                                    $logs[] = "  -> Fallback ZNS sent.";
                                    $messageSent = true;
                                } else {
                                    $logs[] = "  -> Fallback ZNS failed: " . ($znsRes['error_message'] ?? 'Unknown');
                                }
                            }
                        }
                    }
                    // [FIX] Only advance chain if we did NOT pause for time restriction.
                    // $zaloFallbackPaused=true means status='waiting' was already set above —
                    // overwriting with isInstantStep=true would cause the worker to skip the delay.
                    if (!($zaloFallbackPaused ?? false)) {
                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                    }
                    break;

                case 'zalo_zns':
                    $config = $step['config'];
                    $oaConfigId = $config['zalo_oa_id'] ?? null;
                    $templateId = $config['template_id'] ?? null;

                    if (!$oaConfigId || !$templateId) {
                        $logs[] = "  -> ZNS Skipped: Missing config.";
                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                        break;
                    }

                    // [IDEMPOTENCY GUARD] Prevent duplicate ZNS on crash recovery.
                    // Same pattern as email: check activity log scoped to current enrollment.
                    try {
                        $znsDedupParams = [$subscriberId, $currentStepId];
                        $znsDedupCreatedAt = '';
                        if (!empty($queueCreatedAt)) {
                            $znsDedupCreatedAt = ' AND created_at >= ?';
                            $znsDedupParams[] = $queueCreatedAt;
                        }
                        $stmtZnsDedup = $this->pdo->prepare("
                            SELECT 1 FROM subscriber_activity
                            WHERE workspace_id = ? AND subscriber_id = ? AND type IN ('zns_sent','zns_failed') AND reference_id = ?{$znsDedupCreatedAt}
                            LIMIT 1
                        ");
                        $stmtZnsDedup->execute(array_merge([$subscriber['workspace_id']], $znsDedupParams));
                        if ($stmtZnsDedup->fetchColumn()) {
                            $logs[] = "  -> [IDEMPOTENCY] ZNS already sent/failed for sub {$subscriberId} in this enrollment. Advancing.";
                            $nextStepId = $step['nextStepId'] ?? null;
                            $isInstantStep = true;
                            break;
                        }
                    } catch (\Exception $eZnsDedup) {
                        error_log('[FlowExecutor] ZNS Idempotency check failed: ' . $eZnsDedup->getMessage());
                    }


                    $currentHour = (int) date('H');
                    if ($currentHour < 6 || $currentHour >= 22) {
                        $nextScheduledAt = date('Y-m-d 06:00:00', strtotime($currentHour < 6 ? 'today' : '+1 day'));
                        $logs[] = "  -> ZNS Rescheduled to $nextScheduledAt (Outside 06-22).";
                        $status = 'waiting';
                        $shouldContinueChain = false;
                        break;
                    }

                    $phone = $subscriber['phone_number'] ?? '';
                    $normalizedPhone = validatePhoneNumber($phone);

                    if (empty($phone) || !$normalizedPhone) {
                        $reason = empty($phone) ? 'missing_phone' : 'invalid_phone';
                        $logs[] = "  -> ZNS Skipped: $reason ($phone).";
                        logActivity($this->pdo, $subscriberId, 'zns_skipped', $currentStepId, $flowName, "ZNS Skipped: $reason", $flowId, $campaignId, [], $subscriber['workspace_id']);
                        if (($config['fallback_behavior'] ?? 'skip') === 'mark_failed') {
                            $this->bufferStatsUpdate('flows', $flowId, 'stat_zns_failed', 1, $subscriber['workspace_id']);
                        }
                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                        break;
                    }

                    // [OPTIMIZATION] Frequency Cap Check (Per Channel)
                    $maxPerDay = (int) ($flowConfig['maxMessagesPerDay'] ?? 0);
                    $todaySentData = $contextData['total_sent_today'] ?? ['zalo' => 0];
                    $todaySent = is_array($todaySentData) ? ($todaySentData['zalo'] ?? 0) : (int)$todaySentData;
                    if ($maxPerDay > 0 && $todaySent >= $maxPerDay) {
                        $logs[] = "  -> Frequency cap reached ($todaySent/$maxPerDay). Rescheduling ZNS to tomorrow.";
                        logActivity($this->pdo, $subscriberId, 'frequency_cap_reached', $currentStepId, $flowName, "Cap: $maxPerDay (ZNS)", $flowId, null, [], $subscriber['workspace_id']);
                        $status = 'waiting';
                        $nextScheduledAt = date('Y-m-d 09:00:00', strtotime('+1 day'));
                        $shouldContinueChain = false;
                        break;
                    }

                    $templateData = [];
                    $missingParams = [];
                    $rawData = $config['template_data'] ?? [];
                    $znsContext = [
                        'variable_fallbacks' => $config['variable_fallbacks'] ?? ($config['fallbacks'] ?? []),
                        'config' => $config
                    ];

                    foreach ($rawData as $key => $value) {
                        $val = is_string($value) ? replaceMergeTags($value, $subscriber, $znsContext, $this->pdo) : $value;

                        if ($val === '') {
                            $missingParams[] = $key;
                        }

                        if (is_string($val) && filter_var($val, FILTER_VALIDATE_URL)) {
                            // [FIX] Zalo ZNS template data has strict max length per field (~200 chars)
                            // Only wrap in tracking URL if short enough; otherwise use original URL
                            $encodedUrl = urlencode($val);
                            $trackingUrl = $this->apiUrl . "/zalo_tracking.php?sub_id={$subscriberId}&flow_id={$flowId}&step_id={$currentStepId}&url={$encodedUrl}";
                            $val = (strlen($trackingUrl) <= 200) ? $trackingUrl : $val;
                        }

                        // [FIX v2] Per-field length limits for Zalo ZNS known short fields.
                        // Zalo enforces different max lengths per template param type:
                        //   - 'id', 'ma_giao_dich', 'ma_don_hang', 'tracking_id' → max 20 chars
                        //   - All others → max 100 chars (safe default)
                        // Previously all fields were truncated at 100 chars, but UUID (36 chars)
                        // still exceeded the 20-char limit for 'id' → Zalo API error -1121.
                        $znsShortFieldMap = [
                            'id'            => 20,
                            'ma_giao_dich'  => 20,
                            'ma_don_hang'   => 20,
                            'tracking_id'   => 20,
                            'order_id'      => 20,
                            'invoice_id'    => 20,
                        ];
                        if (is_string($val)) {
                            $maxLen = $znsShortFieldMap[$key] ?? 100;
                            if (mb_strlen($val, 'UTF-8') > $maxLen) {
                                $truncated = mb_substr($val, 0, $maxLen, 'UTF-8');
                                error_log("[ZNS-WARN] Field '$key' truncated from " . mb_strlen($val) . " to $maxLen chars for Sub:{$subscriberId}");
                                $val = $truncated;
                            }
                        }

                        $templateData[$key] = $val;
                    }

                    if (!empty($missingParams)) {
                        $logs[] = "  -> ZNS Skipped: Missing data for parameters (" . implode(', ', $missingParams) . ").";
                        logActivity($this->pdo, $subscriberId, 'zns_failed', $currentStepId, $flowName, "ZNS Failed: Missing parameters (" . implode(', ', $missingParams) . ")", $flowId, $campaignId, [], $subscriber['workspace_id']);
                        $result = ['success' => false, 'error_message' => 'Missing parameters: ' . implode(', ', $missingParams)];
                        // Debug log
                        file_put_contents(
                            __DIR__ . '/zns_error.log',
                            date('Y-m-d H:i:s') . " [MISSING_PARAMS] Sub:{$subscriberId} Phone:{$normalizedPhone} Missing: " . implode(', ', $missingParams) .
                            " | TemplateData: " . json_encode($templateData, JSON_UNESCAPED_UNICODE) . "\n",
                            FILE_APPEND | LOCK_EX
                        );
                    } else {
                        try {
                            $result = sendZNSMessage($this->pdo, $oaConfigId, $templateId, 
                                $normalizedPhone, $templateData, $flowId, $currentStepId, $subscriberId, null, null, $subscriber['workspace_id']);
                        } catch (Throwable $znsEx) {
                            // [FIX] Catch any exception from sendZNSMessage (PDO, network, etc.)
                            // to prevent it propagating to worker and causing a reschedule loop
                            $result = ['success' => false, 'error_code' => -1, 'error_message' => 'Exception: ' . $znsEx->getMessage()];
                            file_put_contents(
                                __DIR__ . '/zns_error.log',
                                date('Y-m-d H:i:s') . " [EXCEPTION] Sub:{$subscriberId} " . $znsEx->getMessage() . "\n",
                                FILE_APPEND | LOCK_EX
                            );
                        }
                    }

                    if ($result['success']) {
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_zns_sent', 1, $subscriber['workspace_id']);
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_total_sent', 1, $subscriber['workspace_id']);
                        logActivity($this->pdo, $subscriberId, 'zns_sent', $currentStepId, $flowName, 'ZNS Sent', $flowId, $campaignId, [], $subscriber['workspace_id']);
                        $logs[] = "  -> ZNS Sent.";
                        $messageSent = true;
                        
                        if (!isset($contextData['total_sent_today']) || !is_array($contextData['total_sent_today'])) {
                            $contextData['total_sent_today'] = [];
                        }
                        $contextData['total_sent_today']['zalo'] = ($contextData['total_sent_today']['zalo'] ?? 0) + 1;
                    } else {
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_zns_failed', 1, $subscriber['workspace_id']);
                        // [FIX] Normalize error keys: sendZNSMessage pre-checks return 'reason'/'message',
                        // while API errors return 'error_code'/'error_message'
                        $errCode = $result['error_code'] ?? $result['reason'] ?? $result['status'] ?? '?';
                        $errMsg = $result['error_message'] ?? $result['message'] ?? 'Unknown';
                        $errDetail = "Code:{$errCode} - {$errMsg}";
                        logActivity($this->pdo, $subscriberId, 'zns_failed', $currentStepId, $flowName, "ZNS Failed: " . $errDetail, $flowId, $campaignId, [], $subscriber['workspace_id']);
                        $logs[] = "  -> ZNS Failed: {$errDetail}";
                        // Write debug log
                        file_put_contents(
                            __DIR__ . '/zns_error.log',
                            date('Y-m-d H:i:s') . " [ZNS_FAIL] Sub:{$subscriberId} Phone:{$normalizedPhone}" .
                            " OA:{$oaConfigId} Template:{$templateId}" .
                            " Error:{$errDetail}" .
                            " | Data: " . json_encode($templateData, JSON_UNESCAPED_UNICODE) . "\n",
                            FILE_APPEND | LOCK_EX
                        );
                    }

                    $nextStepId = $step['nextStepId'] ?? null;
                    $isInstantStep = true;
                    break;

                case 'meta_message':
                    $config = $step['config'];

                    // Resolve Connection
                    $metaConn = resolveMetaConnection($this->pdo, $subscriberId, $subscriber['workspace_id']);
                    if (isset($metaConn['error'])) {
                        $logs[] = "  -> Meta Skip: " . $metaConn['error'];
                        $nextStepId = $step['nextStepId'] ?? null;
                        $isInstantStep = true;
                        break;
                    }

                    $pageId = $metaConn['page_id'];
                    $psid = $metaConn['psid'];

                    // [OPTIMIZATION] Frequency Cap Check (Per Channel)
                    $maxPerDay = (int) ($flowConfig['maxMessagesPerDay'] ?? 0);
                    $todaySentData = $contextData['total_sent_today'] ?? ['meta' => 0];
                    $todaySent = is_array($todaySentData) ? ($todaySentData['meta'] ?? 0) : (int)$todaySentData;
                    if ($maxPerDay > 0 && $todaySent >= $maxPerDay) {
                        $logs[] = "  -> Frequency cap reached ($todaySent/$maxPerDay). Rescheduling Meta to tomorrow.";
                        logActivity($this->pdo, $subscriberId, 'frequency_cap_reached', $currentStepId, $flowName, "Cap: $maxPerDay (Meta)", $flowId, null, [], $subscriber['workspace_id']);
                        $status = 'waiting';
                        $nextScheduledAt = date('Y-m-d 09:00:00', strtotime('+1 day'));
                        $shouldContinueChain = false;
                        break;
                    }

                    // Prepare Content
                    $msgConfig = [];
                    if (!empty($config['content'])) {
                        $metaContext = [
                            'variable_fallbacks' => $config['variable_fallbacks'] ?? ($config['fallbacks'] ?? []),
                            'config' => $config
                        ];
                        $msgConfig['text'] = replaceMergeTags($config['content'], $subscriber, $metaContext, $this->pdo);
                    }
                    if (!empty($config['attachment_url'])) {
                        $msgConfig['attachment_url'] = $config['attachment_url'];
                        $msgConfig['attachment_type'] = $config['attachment_type'] ?? 'image';
                    }

                    // Send
                    $res = sendMetaMessage($this->pdo, $pageId, $psid, $msgConfig, $flowId, $currentStepId, $subscriberId, $subscriber['workspace_id']);

                    if ($res['success']) {
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_total_sent', 1, $subscriber['workspace_id']);
                        // [FIX P6-C1] Track Meta messages per-channel (mirrors stat_zalo_sent / stat_zns_sent pattern)
                        $this->bufferStatsUpdate('flows', $flowId, 'stat_meta_sent', 1, $subscriber['workspace_id']);
                        logActivity($this->pdo, $subscriberId, 'meta_sent', $currentStepId, $flowName, 'Meta Msg Sent: ' . ($step['label'] ?? 'Message'), $flowId, $campaignId, [], $subscriber['workspace_id']);
                        $logs[] = "  -> Meta Msg Sent.";
                        // [FIX P6-H1] Increment per-channel frequency cap counter.
                        // Without this, $contextData['total_sent_today']['meta'] stays 0
                        // across the entire worker run Ã¢â€ â€™ frequency cap NEVER triggers for Meta.
                        if (!isset($contextData['total_sent_today']) || !is_array($contextData['total_sent_today'])) {
                            $contextData['total_sent_today'] = [];
                        }
                        $contextData['total_sent_today']['meta'] = ($contextData['total_sent_today']['meta'] ?? 0) + 1;
                        $messageSent = true;
                    } else {
                        logActivity($this->pdo, $subscriberId, 'meta_failed', $currentStepId, $flowName, "Meta Failed: " . ($res['message'] ?? ''), $flowId, $campaignId, [], $subscriber['workspace_id']);
                        $logs[] = "  -> Meta Failed: " . ($res['message'] ?? 'Unknown');
                    }

                    $nextStepId = $step['nextStepId'] ?? null;
                    $isInstantStep = true;
                    break;

                case 'wait':
                    $nextStepId = $step['nextStepId'] ?? null;
                    $mode = trim($step['config']['mode'] ?? 'duration');
                    $isWaitOver = false;
                    $logDetail = "";
                    $scheduleNow = $contextData['now'] ?? date('Y-m-d H:i:s');

                    // [DEBUG TRACE] Only write wait debug log when DEBUG_MODE is enabled
                    // to avoid I/O bottleneck in production with many subscribers
                    if (defined('DEBUG_MODE') && DEBUG_MODE) {
                        file_put_contents(
                            __DIR__ . '/wait_debug.log',
                            date('Y-m-d H:i:s') . " [WAIT] StepId:{$currentStepId}"
                            . " SubId:{$subscriberId} FlowId:{$flowId}"
                            . " is_resumed_wait:" . json_encode($contextData['is_resumed_wait'] ?? null)
                            . " scheduled_at:" . ($contextData['scheduled_at'] ?? 'not_set')
                            . " now:{$scheduleNow}"
                            . " Caller:" . (isset($contextData['is_priority_chain']) ? 'priority' : 'flow_worker')
                            . "\n",
                            FILE_APPEND | LOCK_EX
                        );
                    }

                    // Check Resume (If scheduled time passed)
                    // $contextData['scheduled_at'] is the DB value for the CURRENT wake-up step only.
                    // It must NOT be used for chain steps (fresh waits should always calculate, not resume).
                    // Only is_resumed_wait Ã¢â‚¬â€ set by the worker based on original DB scheduled_at Ã¢â‚¬â€
                    // correctly distinguishes "woken up from wait" vs "fresh wait in chain".
                    $dbScheduledAt = $contextData['scheduled_at'] ?? $scheduleNow; // used for debug log only
                    $isResuming = ($dbScheduledAt <= $scheduleNow); // diagnostic only Ã¢â‚¬â€ NOT used in logic

                    // CORRECT LOGIC: only is_resumed_wait controls wait resumption.
                    // Worker sets this TRUE only for step 1 in the run AND step_id matches AND scheduled_at passed.
                    // Chain steps (stepsProcessedInRun > 1) always get is_resumed_wait=FALSE Ã¢â€ â€™ always calculate.
                    if (!empty($contextData['is_resumed_wait'])) {
                        // [HARDENING - LAYER 2] Double-check if the wait is REALLY over.
                        // Even if the worker signaled resume (e.g. forced by wakeupWaitingSubscribers),
                        // if the scheduled_at is still in the future, we MUST go back to sleep.
                        $dbScheduledAt = $contextData['scheduled_at'] ?? null;
                        if ($dbScheduledAt && strtotime($dbScheduledAt) > time()) {
                            $logs[] = "  -> [HARDENING] Resumed early but scheduled time ({$dbScheduledAt}) not reached yet. Going back to sleep.";
                            $status = 'waiting';
                            $nextScheduledAt = $dbScheduledAt;
                            $shouldContinueChain = false;
                            break;
                        }
                        $isWaitOver = true;
                        $logDetail = "Wait Finished (Resumed)";
                    } else {
                        // Calculate Wait
                        if ($mode === 'until') {
                            $targetTime = $step['config']['untilTime'] ?? '09:00';
                            $targetDay = $step['config']['untilDay'] ?? null;
                            $dt = new DateTime($scheduleNow);
                            $targetTimeParts = explode(':', $targetTime);
                            $dt->setTime((int) $targetTimeParts[0], (int) ($targetTimeParts[1] ?? 0), 0);

                            if ($targetDay !== null && $targetDay !== '') {
                                $currentDay = (int) date('w', strtotime($scheduleNow));
                                $daysToWait = ((int) $targetDay - $currentDay + 7) % 7;
                                if ($daysToWait === 0 && $dt->getTimestamp() <= time()) {
                                    $daysToWait = 7;
                                }
                                if ($daysToWait > 0)
                                    $dt->modify("+$daysToWait days");
                            } else {
                                if ($dt->getTimestamp() <= time())
                                    $dt->modify("+1 day");
                            }
                            $nextScheduledAt = $dt->format('Y-m-d H:i:s');
                            $logDetail = "Wait UNTIL $nextScheduledAt";

                        } elseif ($mode === 'until_attribute') {
                            $attrKey = $step['config']['attributeKey'] ?? 'date_of_birth';
                            $offsetValue = (int) ($step['config']['offsetValue'] ?? 0);
                            $offsetType = $step['config']['offsetType'] ?? 'before';
                            $untilTime = $step['config']['untilTime'] ?? '09:00';
                            $attrValue = $subscriber[$attrKey] ?? null;
                            if ((!$attrValue || $attrValue === '0000-00-00') && !empty($subscriber['custom_attributes'])) {
                                $customAttrs = is_array($subscriber['custom_attributes'])
                                    ? $subscriber['custom_attributes']
                                    : (json_decode($subscriber['custom_attributes'], true) ?: []);
                                $cleanAttrKey = preg_replace('/^custom_/', '', $attrKey);
                                $attrValue = $customAttrs[$attrKey] ?? $customAttrs[$cleanAttrKey] ?? null;
                            }

                            if (!$attrValue || $attrValue === '0000-00-00') {
                                // Skip
                                $isWaitOver = true;
                                $logDetail = "Wait Skipped (Attributes missing)";
                            } else {
                                $dtAttr = new DateTime($attrValue);
                                $md = $dtAttr->format('m-d');
                                $targetDate = new DateTime(date('Y') . "-$md $untilTime:00");
                                if ($offsetType === 'before')
                                    $targetDate->modify("-$offsetValue days");
                                elseif ($offsetType === 'after')
                                    $targetDate->modify("+$offsetValue days");

                                if ($targetDate->getTimestamp() < time() - 86400) {
                                    if ($targetDate->format('Y-m-d') < date('Y-m-d'))
                                        $targetDate->modify("+1 year");
                                }
                                $nextScheduledAt = $targetDate->format('Y-m-d H:i:s');
                                if ($targetDate->getTimestamp() <= time())
                                    $isWaitOver = true;
                                $logDetail = "Wait Attribute $nextScheduledAt";
                            }

                        } elseif ($mode === 'until_date') {
                            $specDate = $step['config']['specificDate'] ?? '';
                            $targetTime = $step['config']['untilTime'] ?? '09:00';
                            if ($specDate) {
                                $targetTs = strtotime("$specDate $targetTime:00");
                                if ($targetTs <= time())
                                    $isWaitOver = true;
                                else
                                    $nextScheduledAt = date('Y-m-d H:i:s', $targetTs);
                                $logDetail = "Wait Date $nextScheduledAt";
                            } else {
                                $isWaitOver = true;
                                $logDetail = "Wait Skipped (No Date)";
                            }
                        } else {
                            // Duration
                            $dur = (int) ($step['config']['duration'] ?? 1);
                            $unit = $step['config']['unit'] ?? 'hours';
                            // [FIX] Use $scheduleNow (from $contextData['now']) for consistency
                            // with other wait modes. 'new DateTime()' uses PHP runtime which
                            // may drift if worker runs for a long time.
                            $dt = new DateTime($scheduleNow);
                            $dt->modify("+$dur $unit");
                            $nextScheduledAt = $dt->format('Y-m-d H:i:s');
                            $logDetail = "Wait Duration $dur $unit";
                        }
                    }

                    if ($isWaitOver) {
                        $logs[] = "  -> Step '{$step['label']}' Wait complete ($logDetail).";
                        $isInstantStep = true;
                        $status = 'completed'; // Proceed
                        logActivity($this->pdo, $subscriberId, 'wait_processed', $currentStepId, $flowName, "$logDetail (Completed)", $flowId, null, [], $subscriber['workspace_id']);
                    } else {
                        $logs[] = "  -> Step '{$step['label']}' waiting until $nextScheduledAt.";
                        $status = 'waiting';
                        $shouldContinueChain = false;
                    }
                    break;

                case 'condition':
                    $condType = $step['config']['conditionType'] ?? 'opened';
                    $waitDur = (int) ($step['config']['waitDuration'] ?? 0);
                    $waitUnit = $step['config']['waitUnit'] ?? 'hours';

                    // [FIX] Khai báo target/campaign ID từ bước Trigger
                    $linkedCampaignId = null;
                    foreach ($flowSteps as $fs) {
                        if ($fs['type'] === 'trigger' && in_array($fs['config']['type'] ?? '', ['campaign', 'survey'])) {
                            // Cấu hình lưu trong targetId hoặc campaignId
                            $linkedCampaignId = $fs['config']['targetId'] ?? ($fs['config']['campaignId'] ?? null);
                            break;
                        }
                    }

                    // Timeout Calculation (waitDur <= 0 means Instant Check -> immediately timed out if not matched)
                    if ($waitDur <= 0) {
                        $isTimedOut = true;
                    } else {
                        $startTime = !empty($lastStepAt) ? $lastStepAt : (!empty($itemUpdatedAt) ? $itemUpdatedAt : $queueCreatedAt);
                        if (empty($startTime) || strpos($startTime, '0000-00-00') !== false || trim($startTime) === '') {
                            $startTime = 'now';
                        }
                        try {
                            $timeout = new DateTime($startTime);
                        } catch (Exception $e) {
                            $timeout = new DateTime('now');
                        }
                        $timeout->modify("+$waitDur $waitUnit");
                        $isTimedOut = new DateTime('now') > $timeout;
                    }

                    // Forced Fail on Email Error
                    if (($hasEmailError && in_array($condType, ['opened', 'clicked', 'clicked_specific'])) || (isset($hasZnsError) && $hasZnsError && strpos($condType, 'zns_') === 0)) {
                        $logs[] = "  -> Condition forced NO due to email error.";
                        $nextStepId = $step['noStepId'] ?? null;
                        $isInstantStep = true;
                        logActivity($this->pdo, $subscriberId, 'condition_false', $currentStepId, $flowName, "Forced FALSE (Email Error)", $flowId, null, [], $subscriber['workspace_id']);
                        break;
                    }

                    $isMatched = false;
                    // Resolve Reference (Campaign vs Step)
                    $targetStepId = $step['config']['targetStepId'] ?? null;
                    $anyCampaign = !empty($step['config']['any_campaign']);

                    // Determine Types
                    $types = [];

                    // [NEW] Survey Condition Evaluation
                    if (strpos($condType, 'survey_') === 0) {
                        $targetSurveyId = $linkedCampaignId;
                        $cacheKey = "{$subscriberId}_{$targetSurveyId}";
                        if (!isset(self::$profileCache['_survey_responses'])) {
                            self::$profileCache['_survey_responses'] = [];
                        }

                        if (isset(self::$profileCache['_survey_responses'][$cacheKey])) {
                            $latestResp = self::$profileCache['_survey_responses'][$cacheKey];
                        } else {
                            $sqlResp = "SELECT * FROM survey_responses WHERE workspace_id = ? AND subscriber_id = ?";
                            $paramsResp = [$subscriber['workspace_id'], $subscriberId];
                            
                            if (!$anyCampaign) {
                                $graceStartTime = !empty($queueCreatedAt) ? $queueCreatedAt : ($lastStepAt ?: 'now');
                                $sqlResp .= " AND submitted_at >= ?";
                                $paramsResp[] = (new DateTime($graceStartTime))->modify('-1 hour')->format('Y-m-d H:i:s');
                            }

                            if ($targetSurveyId) {
                                $sqlResp .= " AND survey_id = ?";
                                $paramsResp[] = $targetSurveyId;
                            }
                            $sqlResp .= " ORDER BY submitted_at DESC LIMIT 1";
                            $stmtR = $this->pdo->prepare($sqlResp);
                            $stmtR->execute($paramsResp);
                            $latestResp = $stmtR->fetch(PDO::FETCH_ASSOC);

                            self::pruneCache(self::$profileCache['_survey_responses'], 200);
                            self::$profileCache['_survey_responses'][$cacheKey] = $latestResp;
                        }

                        if ($latestResp) {
                            if ($condType === 'survey_completed') {
                                $isMatched = true;
                            } elseif ($condType === 'survey_score') {
                                $targetVal = (float)($step['config']['scoreValue'] ?? 0);
                                $actualVal = (float)($latestResp['total_score'] ?? 0);
                                $op = $step['config']['scoreOperator'] ?? '>=';
                                if ($op === '>=') $isMatched = ($actualVal >= $targetVal);
                                elseif ($op === '<=') $isMatched = ($actualVal <= $targetVal);
                                elseif ($op === '==') $isMatched = ($actualVal == $targetVal);
                                elseif ($op === '<') $isMatched = ($actualVal < $targetVal);
                                elseif ($op === '>') $isMatched = ($actualVal > $targetVal);
                            } elseif ($condType === 'survey_answer') {
                                $qId = trim($step['config']['questionId'] ?? '');
                                $ansMatch = mb_strtolower(trim($step['config']['answerMatch'] ?? ''), 'UTF-8');
                                $answers = json_decode($latestResp['answers_json'] ?? '[]', true) ?: [];
                                foreach ($answers as $ans) {
                                    if (($ans['question_id'] ?? '') === $qId) {
                                        $valStr = trim($ans['answer_text'] ?? '');
                                        if ($valStr === '') {
                                            if (isset($ans['answer_num'])) {
                                                $valStr = (string)$ans['answer_num'];
                                            } elseif (!empty($ans['answer_json'])) {
                                                 if (is_array($ans['answer_json'])) {
                                                    $valStr = implode(', ', $ans['answer_json']);
                                                 } else {
                                                    $valStr = (string)$ans['answer_json'];
                                                 }
                                            }
                                        }
                                        $valStr = mb_strtolower($valStr, 'UTF-8');
                                        if (mb_stripos($valStr, $ansMatch, 0, 'UTF-8') !== false || $valStr === $ansMatch) {
                                            $isMatched = true;
                                            break;
                                        }
                                    }
                                }
                            } elseif ($condType === 'survey_screen') {
                                $targetScreen = trim($step['config']['endScreenId'] ?? 'default');
                                if ($targetScreen === '') $targetScreen = 'default';
                                $isMatched = (($latestResp['end_screen_id'] ?? 'default') === $targetScreen);
                            }
                        }
                    } elseif (in_array($condType, [
                        'crm_sale_contacted', 'crm_assigned_to', 'crm_stage_is', 'crm_temperature_is', 'channel_reachability',
                        'deposit_paid', 'has_deposit', 'has_deal', 'stage_matches',
                        'erp_is_student', 'erp_student_status', 'erp_tuition_status', 'erp_has_certificate', 'erp_ticket_status', 'erp_deal_status'
                    ], true)) {
                        $subProfile = getSubscriberProfileForFlow($this->pdo, $subscriberId);
                        if ($condType === 'crm_sale_contacted') {
                            $isMatched = (strtolower((string) ($subProfile['crm_sale_contacted'] ?? 'false')) === 'true');
                        } elseif ($condType === 'crm_assigned_to') {
                            $actualOwnerId = trim((string) ($subProfile['crm_owner_id'] ?? ''));
                            $actualTeamId = trim((string) ($subProfile['crm_team_id'] ?? ''));
                            $targetOwnerId = trim((string) ($step['config']['targetOwnerId'] ?? $step['config']['owner_id'] ?? ''));
                            $targetTeamId = trim((string) ($step['config']['targetTeamId'] ?? $step['config']['team_id'] ?? ''));
                            $assignMode = $step['config']['assignMatchMode'] ?? 'any_assigned';

                            if ($assignMode === 'specific' || $targetOwnerId !== '' || $targetTeamId !== '') {
                                $ownerOk = ($targetOwnerId === '' || $targetOwnerId === 'all' || $actualOwnerId === $targetOwnerId);
                                $teamOk = ($targetTeamId === '' || $targetTeamId === 'all' || $actualTeamId === $targetTeamId);
                                $isMatched = ($actualOwnerId !== '' && $actualOwnerId !== '0' && $ownerOk && $teamOk);
                            } else {
                                $isMatched = ($actualOwnerId !== '' && $actualOwnerId !== '0');
                            }
                        } elseif ($condType === 'crm_stage_is' || $condType === 'stage_matches') {
                            $targetStage = trim((string) ($step['config']['targetStageId'] ?? $step['config']['stageId'] ?? $step['config']['targetValue'] ?? ''));
                            $actualStageId = (string) ($subProfile['crm_stage_id'] ?? $subProfile['stage_id'] ?? '');
                            $actualStageName = (string) ($subProfile['crm_stage_name'] ?? '');
                            $actualSlug = (string) ($subProfile['crm_pipeline_status'] ?? '');
                            $isMatched = ($targetStage !== '' && (
                                $actualStageId === $targetStage
                                || mb_strtolower($actualStageName, 'UTF-8') === mb_strtolower($targetStage, 'UTF-8')
                                || mb_strtolower($actualSlug, 'UTF-8') === mb_strtolower($targetStage, 'UTF-8')
                            ));
                        } elseif ($condType === 'crm_temperature_is') {
                            $targetTemp = strtolower(trim((string) ($step['config']['targetTemperature'] ?? $step['config']['temperature'] ?? 'hot')));
                            $actualTemp = strtolower(trim((string) ($subProfile['crm_temperature'] ?: ($subProfile['crm_lead_status'] ?? ''))));
                            $isMatched = ($targetTemp !== '' && $actualTemp === $targetTemp);
                        } elseif ($condType === 'channel_reachability') {
                            $channelType = strtolower(trim((string) ($step['config']['channelType'] ?? 'has_zalo')));
                            $availList = $subProfile['channel_available_list'] ?? [];
                            if ($channelType === 'has_zalo' || $channelType === 'zalo_oa') {
                                $isMatched = in_array('zalo_oa', $availList, true);
                            } elseif ($channelType === 'has_email' || $channelType === 'email_valid') {
                                $isMatched = in_array('email_valid', $availList, true);
                            } elseif ($channelType === 'has_phone' || $channelType === 'phone_valid') {
                                $isMatched = in_array('phone_valid', $availList, true);
                            } else {
                                $isMatched = !empty($availList);
                            }
                        } elseif ($condType === 'deposit_paid' || $condType === 'has_deposit') {
                            $depStatus = strtolower((string) ($subProfile['crm_deposit_status'] ?? 'none'));
                            $isMatched = in_array($depStatus, ['approved', 'paid', 'completed', 'confirmed'], true) || ((float) ($subProfile['crm_deposit_amount'] ?? 0) > 0 && $depStatus !== 'cancelled' && $depStatus !== 'rejected');
                        } elseif ($condType === 'has_deal') {
                            $isMatched = ((float) ($subProfile['crm_expected_revenue'] ?? 0) > 0 || ($subProfile['erp_deal_status'] ?? 'no_deal') !== 'no_deal');
                        } elseif ($condType === 'erp_is_student') {
                            $isMatched = in_array(strtolower((string) ($subProfile['erp_is_student'] ?? 'no')), ['yes', 'true', '1'], true);
                        } elseif ($condType === 'erp_student_status') {
                            $targetSt = strtolower(trim((string) ($step['config']['studentStatus'] ?? $step['config']['targetValue'] ?? 'studying')));
                            $isMatched = (strtolower((string) ($subProfile['erp_student_status'] ?? 'none')) === $targetSt);
                        } elseif ($condType === 'erp_tuition_status') {
                            $targetTuit = strtolower(trim((string) ($step['config']['tuitionStatus'] ?? $step['config']['targetValue'] ?? 'paid')));
                            $actualTuit = strtolower((string) ($subProfile['erp_tuition_status'] ?? 'unpaid'));
                            $isMatched = ($actualTuit === $targetTuit || ($targetTuit === 'paid_full' && $actualTuit === 'paid'));
                        } elseif ($condType === 'erp_has_certificate') {
                            $isMatched = in_array(strtolower((string) ($subProfile['erp_has_certificate'] ?? 'no')), ['yes', 'true', '1'], true);
                        } elseif ($condType === 'erp_ticket_status') {
                            $targetTk = strtolower(trim((string) ($step['config']['ticketStatus'] ?? $step['config']['targetValue'] ?? 'has_open_ticket')));
                            $isMatched = (strtolower((string) ($subProfile['erp_ticket_status'] ?? 'no_ticket')) === $targetTk);
                        } elseif ($condType === 'erp_deal_status') {
                            $targetDealSt = strtolower(trim((string) ($step['config']['dealStatus'] ?? $step['config']['targetValue'] ?? 'won')));
                            $isMatched = (strtolower((string) ($subProfile['erp_deal_status'] ?? 'no_deal')) === $targetDealSt);
                        }
                    } elseif ($condType === 'voucher_claimed') {
                        try {
                            $stmtVc = $this->pdo->prepare("SELECT 1 FROM voucher_codes WHERE subscriber_id = ? AND sent_at IS NOT NULL LIMIT 1");
                            $stmtVc->execute([$subscriberId]);
                            if ($stmtVc->fetchColumn()) {
                                $isMatched = true;
                            }
                        } catch (\Throwable $eVc) {}
                        if (!$isMatched) {
                            $types = ['voucher_redeem'];
                        }
                    } elseif ($condType === 'opened') {
                        $types = ['open_email', 'open_zns'];
                    } elseif ($condType === 'clicked' || $condType === 'clicked_specific') {
                        $types = ['click_link', 'click_zns'];
                    } elseif ($condType === 'replied') {
                        $types = ['reply_email', 'staff_reply', 'zns_replied', 'user_send_text'];
                    } elseif ($condType === 'zalo_interacted') {
                        $types = ['click_zns', 'zns_clicked', 'zns_replied', 'staff_reply', 'user_send_text', 'user_reacted_message', 'follow'];
                    } elseif ($condType === 'unsubscribed') {
                        $types = ['unsubscribe'];
                    } elseif ($condType === 'zns_delivered') {
                        $types = ['zns_sent'];
                    } elseif ($condType === 'zns_clicked') {
                        $types = ['click_zns'];
                    } elseif ($condType === 'zns_replied') {
                        $types = ['staff_reply'];
                    } elseif ($condType === 'zns_failed') {
                        $types = ['zns_failed'];
                    } elseif ($condType === 'delivered') {
                        $types = ['receive_email'];
                    } elseif ($condType === 'received_reminder') {
                        $types = ['receive_email'];
                    } elseif ($condType === 'opened_reminder') {
                        $types = ['open_email'];
                    }

                    // reminderId from frontend config — if set, filter activities to this specific reminder campaign
                    $reminderId = $step['config']['reminderId'] ?? null;

                    // Global event check (including smart fallback when any_campaign = true or no targetStepId)
                    $isGlobalEvent = $anyCampaign || in_array($condType, ['unsubscribed', 'received_reminder', 'opened_reminder', 'zalo_interacted', 'voucher_claimed']);

                    if (empty($types)) {
                        $activities = [];
                    } elseif (isset($contextData['activity_cache']) && count($contextData['activity_cache']) < 500) {
                        $cachedActivities = $contextData['activity_cache'];
                        $activities = [];
                        foreach ($cachedActivities as $act) {
                            if (in_array($act['type'], $types)) {
                                if ($isGlobalEvent) {
                                    if (($condType === 'received_reminder' || $condType === 'opened_reminder') && !empty($reminderId)) {
                                        if ((string) ($act['campaign_id'] ?? '') === (string) $reminderId) {
                                            $activities[] = $act;
                                        }
                                    } else {
                                        $activities[] = $act;
                                    }
                                    continue;
                                }
                                $isFromTarget = false;
                                if ($linkedCampaignId && !empty($act['campaign_id']) && (string) $act['campaign_id'] === (string) $linkedCampaignId) {
                                    $isFromTarget = true;
                                } elseif ($targetStepId && trim($act['reference_id'] ?? '') === trim($targetStepId)) {
                                    $isFromTarget = true;
                                } elseif (!$targetStepId) {
                                    $isFromTarget = true;
                                }

                                if ($isFromTarget) {
                                    $activities[] = $act;
                                }
                            }
                        }
                    } else {
                        $sqlCheck = "SELECT id, type, details, reference_id, campaign_id FROM subscriber_activity WHERE workspace_id = ? AND subscriber_id = ?";
                        $params = [$subscriber['workspace_id'], $subscriberId];
                        $placeholders = implode(',', array_fill(0, count($types), '?'));
                        $sqlCheck .= " AND type IN ($placeholders)";
                        foreach ($types as $t)
                            $params[] = $t;

                        if (!$isGlobalEvent) {
                            if ($linkedCampaignId) {
                                $sqlCheck .= " AND (flow_id = ? OR campaign_id = ?) ";
                                $params[] = $flowId;
                                $params[] = $linkedCampaignId;
                            } else {
                                $sqlCheck .= " AND flow_id = ? ";
                                $params[] = $flowId;
                            }
                        } elseif (($condType === 'received_reminder' || $condType === 'opened_reminder') && !empty($reminderId)) {
                            $sqlCheck .= " AND campaign_id = ?";
                            $params[] = $reminderId;
                        }

                        $sqlCheck .= " ORDER BY created_at DESC LIMIT 50";

                        $stmtAct = $this->pdo->prepare($sqlCheck);
                        $stmtAct->execute($params);
                        $activities = $stmtAct->fetchAll();
                    }

                    if (!empty($types)) {
                        foreach ($activities as $act) {
                            if (!in_array($act['type'], $types))
                                continue;

                            $isFromTarget = false;
                            $isTargetingTrigger = false;
                            if ($targetStepId) {
                                foreach ($flowSteps as $fs) {
                                    if ($fs['id'] === $targetStepId && $fs['type'] === 'trigger') {
                                        $isTargetingTrigger = true;
                                        break;
                                    }
                                }
                            }

                            if ($isGlobalEvent) {
                                $isFromTarget = true;
                            } elseif ($isTargetingTrigger && $linkedCampaignId && !empty($act['campaign_id']) && (string) $act['campaign_id'] === (string) $linkedCampaignId) {
                                $isFromTarget = true;
                            } elseif ($targetStepId && trim($act['reference_id'] ?? '') === trim($targetStepId)) {
                                $isFromTarget = true;
                            } elseif (!$targetStepId) {
                                $isFromTarget = true;
                            }

                            if (!$isFromTarget)
                                continue;

                            if ($condType === 'clicked' || $condType === 'clicked_specific') {
                                $linkTargets = $step['config']['linkTargets'] ?? [];
                                if (!is_array($linkTargets) && !empty($step['config']['linkTarget']))
                                    $linkTargets = [$step['config']['linkTarget']];
                                if (empty($linkTargets) && !empty($step['config']['targetUrl']))
                                    $linkTargets = [$step['config']['targetUrl']];

                                if (empty($linkTargets)) {
                                    $isMatched = true;
                                    break;
                                } else {
                                    $rawDetail = $act['details'] ?? '';
                                    $clickedUrl = extractClickedUrlFromDetails($rawDetail);

                                    $normalizeUrlBase = function ($u) {
                                        $u = preg_replace('/^https?:\/\//', '', trim($u));
                                        return rtrim($u, '/');
                                    };

                                    $normClicked = $normalizeUrlBase($clickedUrl);

                                    foreach ($linkTargets as $target) {
                                        $normTarget = $normalizeUrlBase($target);
                                        if ($normTarget !== '' && mb_stripos($normClicked, $normTarget, 0, 'UTF-8') !== false) {
                                            $isMatched = true;
                                            break 2;
                                        }
                                    }
                                }
                            } else {
                                $isMatched = true;
                                break;
                            }
                        }
                    }

                    if ($isMatched) {
                        $nextStepId = $step['yesStepId'] ?? null;
                        logActivity($this->pdo, $subscriberId, 'condition_true', $currentStepId, $flowName, "Matched: $condType", $flowId, null, [], $subscriber['workspace_id']);
                        $logs[] = "  -> Condition Matched!";
                        $isInstantStep = true;
                    } elseif ($isTimedOut) {
                        $nextStepId = $step['noStepId'] ?? null;
                        logActivity($this->pdo, $subscriberId, 'condition_false', $currentStepId, $flowName, "Timed Out / Instant False: $condType", $flowId, null, [], $subscriber['workspace_id']);
                        $logs[] = "  -> Condition False/Timed Out. Moving to ELSE.";
                        $isInstantStep = true;
                    } else {
                        // CHƯA KHỚP VÀ CHƯA HẾT GIỜ -> TIẾP TỤC ĐỢI
                        $logs[] = "  -> Condition not met yet. Still waiting...";
                        $status = 'waiting';
                        $shouldContinueChain = false;
                        $nextScheduledAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));
                    }
                    break;

                case 'advanced_condition':
                    require_once 'flow_helpers.php';

                    $branches = $step['config']['branches'] ?? ($step['branches'] ?? []);
                    $defaultStepId = $step['defaultStepId'] ?? ($step['config']['defaultStepId'] ?? null);
                    $matchedStepId = null;
                    $matchLabel = "Fallback";

                    $subProfile = null;
                    if (isset(self::$profileCache[$subscriberId])) {
                        $subProfile = self::$profileCache[$subscriberId];
                    } else {
                        $subProfile = getSubscriberProfileForFlow($this->pdo, $subscriberId);
                        self::pruneCache(self::$profileCache, 200);
                        self::$profileCache[$subscriberId] = $subProfile;
                    }

                    foreach ($branches as $branch) {
                        $condGroup = $branch['conditionGroup'] ?? ($branch['conditions'] ?? ($branch['rules'] ?? []));
                        $hasRules = isset($condGroup['conditions']) ? !empty($condGroup['conditions']) : !empty($condGroup);
                        if ($hasRules && evaluateAdvancedConditionGroup($this->pdo, $subscriberId, $subProfile, $condGroup)) {
                            $matchedStepId = $branch['nextStepId'] ?? ($branch['stepId'] ?? null);
                            $matchLabel = $branch['label'] ?? ($branch['name'] ?? 'Branch');
                            break;
                        }
                    }

                    $nextStepId = $matchedStepId ?: $defaultStepId;
                    logActivity($this->pdo, $subscriberId, 'advanced_condition', $currentStepId, $flowName, "Matched: $matchLabel", $flowId, null, [], $subscriber['workspace_id']);
                    $logs[] = "  -> Advanced Cond: $matchLabel";
                    $isInstantStep = true;
                    break;

                case 'split_test':
                    $ratioA = (int) ($step['config']['ratioA'] ?? 50);
                    // [FIX BUG-C2] hexdec() on 8-char hex can overflow on 32-bit PHP, returning
                    // a negative integer. ($negativeInt % 100) is also negative → always < $ratioA
                    // → always Path A or always Path B depending on value. abs(crc32()) is safe
                    // on both 32-bit and 64-bit PHP and produces a uniform distribution.
                    $hash = abs(crc32($subscriberId . $currentStepId));
                    $isPathA = (($hash % 100) < $ratioA);
                    $nextStepId = $isPathA ? ($step['pathAStepId'] ?? null) : ($step['pathBStepId'] ?? null);

                    logActivity($this->pdo, $subscriberId, $isPathA ? 'ab_test_a' : 'ab_test_b', $currentStepId, $flowName, "Split Test: " . ($isPathA ? 'A' : 'B'), $flowId, $campaignId, ['variation' => $isPathA ? 'A' : 'B'], $subscriber['workspace_id']);
                    $logs[] = "  -> Split Test: " . ($isPathA ? 'Path A' : 'Path B');
                    $isInstantStep = true;
                    break;

                case 'update_tag':
                    $tags = $step['config']['tags'] ?? [];
                    $action = $step['config']['action'] ?? 'add';
                    // [FIX BUG-FLOW-TAG-1] Resolve workspace_id once before tag loop
                    $tagWorkspaceId = $subscriber['workspace_id'] ?? null;
                    if (!$tagWorkspaceId) {
                        $stmtWs = $this->pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ? LIMIT 1");
                        $stmtWs->execute([$subscriberId]);
                        $tagWorkspaceId = $stmtWs->fetchColumn();
                    }
                    foreach ($tags as $tagName) {
                        $tagId = null;
                        $tagCacheKey = ($tagWorkspaceId ?? '_global') . '_' . $tagName;
                        if (isset(self::$tagCache[$tagCacheKey])) {
                            $tagId = self::$tagCache[$tagCacheKey];
                        } else {
                            // [FIX BUG-FLOW-TAG-1] Scoped to workspace to prevent cross-tenant tag matches
                            $stmtT = $tagWorkspaceId
                                ? $this->pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ? LIMIT 1")
                                : $this->pdo->prepare("SELECT id FROM domation_tags WHERE name = ? LIMIT 1");
                            $stmtT->execute($tagWorkspaceId ? [$tagName, $tagWorkspaceId] : [$tagName]);
                            $tagId = $stmtT->fetchColumn();

                            // [FIX] tags.id is VARCHAR using uniqid(), NOT auto-increment.
                            // The original INSERT omitted the `id` column entirely.
                            // MySQL strict mode ('NO_DEFAULT_VALUE') throws:
                            // "Field 'id' doesn't have a default value" — crashing the flow.
                            if (!$tagId) {
                                $newTagId = uniqid();
                                // [FIX BUG-FLOW-TAG-2] Added workspace_id so auto-created tags are workspace-scoped
                                $stmtCreate = $tagWorkspaceId
                                    ? $this->pdo->prepare("INSERT IGNORE INTO domation_tags (id, name, workspace_id, created_at) VALUES (?, ?, ?, NOW())")
                                    : $this->pdo->prepare("INSERT IGNORE INTO domation_tags (id, name, created_at) VALUES (?, ?, NOW())");
                                $stmtCreate->execute($tagWorkspaceId ? [$newTagId, $tagName, $tagWorkspaceId] : [$newTagId, $tagName]);
                                
                                if ($stmtCreate->rowCount() == 0) {
                                    // It was ignored due to duplicate name. Fetch the real ID.
                                    $stmtT->execute($tagWorkspaceId ? [$tagName, $tagWorkspaceId] : [$tagName]);
                                    $tagId = $stmtT->fetchColumn();
                                } else {
                                    $tagId = $newTagId;
                                }
                            }
                            // [MEMORY GUARD] [FIX AUDIT-07] Use centralized pruning
                            self::pruneCache(self::$tagCache, 200);
                            self::$tagCache[$tagCacheKey] = $tagId;
                        }

                        if (!$tagId)
                            continue;

                        if ($action === 'remove') {
                            $this->pdo->prepare("DELETE FROM subscriber_tags WHERE workspace_id = ? AND subscriber_id = ? AND tag_id = ?")->execute([$tagWorkspaceId, $subscriberId, $tagId]);
                        } else {
                            $stmtIn = $this->pdo->prepare("INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES (?, ?, ?)");
                            $stmtIn->execute([$tagWorkspaceId, $subscriberId, $tagId]);
                            if ($stmtIn->rowCount() > 0) {
                                dispatchFlowWorker($this->pdo, 'flows', [
                                    'trigger_type' => 'tag', 
                                    'target_id' => $tagName, 
                                    'subscriber_id' => $subscriberId,
                                    'workspace_id' => $tagWorkspaceId
                                ]);
                            }
                        }
                        if (function_exists('domationSyncSubscriberMatchOnly')) {
                            domationSyncSubscriberMatchOnly($this->pdo, $subscriberId);
                        }
                    }

                    // Sync tags to MYERP CRM contacts.tags JSON column if linked
                    try {
                        $crmContactId = (int) ($subscriber['contact_id'] ?? 0);
                        if ($crmContactId <= 0) {
                            $stmtCid = $this->pdo->prepare("SELECT contact_id FROM subscribers WHERE id = ? LIMIT 1");
                            $stmtCid->execute([$subscriberId]);
                            $crmContactId = (int) $stmtCid->fetchColumn();
                        }
                        if ($crmContactId > 0 && !empty($tags)) {
                            $stmtCt = $this->pdo->prepare("SELECT tags FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                            $stmtCt->execute([$crmContactId]);
                            $rawCrmTags = $stmtCt->fetchColumn();
                            $crmTags = is_string($rawCrmTags) ? (json_decode($rawCrmTags, true) ?: []) : [];
                            if (!is_array($crmTags)) $crmTags = [];
                            if ($action === 'remove') {
                                $crmTags = array_values(array_filter($crmTags, function ($t) use ($tags) {
                                    return !in_array($t, $tags, true);
                                }));
                            } else {
                                foreach ($tags as $tName) {
                                    if (!in_array($tName, $crmTags, true)) {
                                        $crmTags[] = $tName;
                                    }
                                }
                            }
                            $this->pdo->prepare("UPDATE contacts SET tags = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL")
                                ->execute([json_encode(array_values($crmTags), JSON_UNESCAPED_UNICODE), $crmContactId]);
                        }
                    } catch (\Throwable $eTagSync) {
                        error_log("[FlowExecutor] CRM tag sync warning: " . $eTagSync->getMessage());
                    }

                    unset(self::$profileCache[$subscriberId]);
                    logActivity($this->pdo, $subscriberId, 'update_tag', $currentStepId, $flowName, "Tags $action: " . implode(',', $tags), $flowId, null, [], $subscriber['workspace_id']);
                    $logs[] = "  -> Tags updated.";
                    $nextStepId = $step['nextStepId'] ?? null;
                    $isInstantStep = true;
                    break;

                case 'list_action':
                    $lid = $step['config']['listId'] ?? '';
                    $action = $step['config']['action'] ?? 'add';
                    $workspaceId = $subscriber['workspace_id'] ?? null;
                    if ($lid) {
                        if ($action === 'add') {
                            $stmtL = $this->pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES (?, ?, ?)");
                            $stmtL->execute([$workspaceId, $subscriberId, $lid]);
                            if ($stmtL->rowCount() > 0) {
                                enrollSubscribersBulk($this->pdo, [$subscriberId], 'list', $lid, $workspaceId);
                            }
                        } else {
                            $this->pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id = ? AND list_id = ?")->execute([$workspaceId, $subscriberId, $lid]);
                        }
                        logActivity($this->pdo, $subscriberId, 'list_action', $currentStepId, "List Action", "$action list $lid", $flowId, null, [], $subscriber['workspace_id']);
                        $logs[] = "  -> List action done.";
                    }
                    $nextStepId = $step['nextStepId'] ?? null;
                    $isInstantStep = true;
                    break;

                case 'remove_action':
                    $aType = $step['config']['actionType'] ?? '';
                    if ($aType === 'unsubscribe') {
                        $this->pdo->prepare("UPDATE subscribers SET status='unsubscribed' WHERE id=? AND workspace_id = ?")->execute([$subscriberId, $subscriber['workspace_id']]);
                        logActivity($this->pdo, $subscriberId, 'unsubscribe', $currentStepId, $flowName, "Unsubscribed via flow", $flowId, null, [], $subscriber['workspace_id']);
                    } elseif ($aType === 'delete_contact') {
                        // [FIX] Log BEFORE delete — logActivity would fail (FK/orphan) if run after DELETE
                        logActivity($this->pdo, $subscriberId, 'delete_contact', $currentStepId, $flowName, "Deleted via flow", $flowId, null, [], $subscriber['workspace_id']);
                        // Delete all related records to prevent orphan data
                        $this->pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        $this->pdo->prepare("DELETE FROM subscriber_tags WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        $this->pdo->prepare("DELETE FROM subscriber_flow_states WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        $this->pdo->prepare("DELETE FROM subscriber_activity WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        // [FIX QUAL-5] Also clean up orphan records in related log tables
                        $this->pdo->prepare("DELETE FROM mail_delivery_logs WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        $this->pdo->prepare("DELETE FROM activity_buffer WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        $this->pdo->prepare("DELETE FROM zalo_delivery_logs WHERE workspace_id = ? AND subscriber_id=?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        // [FIX V3-M2] Unlink subscriber from zalo_subscribers
                        $this->pdo->prepare("UPDATE zalo_subscribers SET subscriber_id = NULL WHERE workspace_id = ? AND subscriber_id = ?")->execute([$subscriber['workspace_id'], $subscriberId]);
                        // [FIX F-4] Reclaim voucher codes
                        $this->pdo->prepare("UPDATE voucher_codes SET subscriber_id = NULL, status = 'unused', sent_at = NULL WHERE workspace_id = ? AND subscriber_id = ? AND status = 'available'")->execute([$subscriber['workspace_id'], $subscriberId]);
                        $this->pdo->prepare("DELETE FROM subscribers WHERE id=? AND workspace_id = ?")->execute([$subscriberId, $subscriber['workspace_id']]);
                    }
                    $this->bufferStatsUpdate('flows', $flowId, 'stat_completed', 1, $subscriber['workspace_id']);
                    $shouldContinueChain = false;
                    $status = 'completed';
                    $logs[] = "  -> Remove action executed ($aType). Flow complete.";
                    break;

                case 'crm_action':
                case 'crm_update_stage':
                case 'crm_create_task':
                case 'crm_assign_owner':
                case 'crm_notify_owner':
                    $crmConfig = $step['config'] ?? [];
                    $crmActionType = $step['type'] === 'crm_action'
                        ? ($crmConfig['crmActionType'] ?? $crmConfig['actionType'] ?? 'update_stage')
                        : str_replace('crm_', '', $step['type']);

                    // Resolve contact_id for subscriber
                    $crmContactId = (int) ($subscriber['contact_id'] ?? 0);
                    if ($crmContactId <= 0) {
                        $stmtCid = $this->pdo->prepare("SELECT contact_id FROM subscribers WHERE id = ? LIMIT 1");
                        $stmtCid->execute([$subscriberId]);
                        $crmContactId = (int) $stmtCid->fetchColumn();
                    }
                    if ($crmContactId <= 0 && function_exists('domationSyncSubscriberMatchOnly')) {
                        $crmContactId = (int) (domationSyncSubscriberMatchOnly($this->pdo, $subscriberId) ?? 0);
                    }

                    if ($crmActionType === 'update_stage' || $crmActionType === 'crm_update_stage') {
                        $rawStageId = $crmConfig['stage_id'] ?? $crmConfig['stageId'] ?? '';
                        $newStageId = $rawStageId !== '' ? (int) $rawStageId : null;
                        $newPipelineStatus = $crmConfig['pipelineStatus'] ?? $crmConfig['pipeline_status'] ?? null;
                        $newLeadStatus = $crmConfig['leadStatus'] ?? $crmConfig['lead_status'] ?? null;
                        $newTemperature = $crmConfig['temperature'] ?? null;

                        if ($crmContactId > 0) {
                            $setCols = [];
                            $setParams = [];
                            if ($newStageId !== null && $newStageId > 0) {
                                $setCols[] = "stage_id = ?";
                                $setParams[] = $newStageId;
                            }
                            if (!empty($newPipelineStatus)) {
                                $setCols[] = "pipeline_status = ?";
                                $setParams[] = $newPipelineStatus;
                            }
                            if (!empty($newLeadStatus)) {
                                $setCols[] = "lead_status = ?";
                                $setParams[] = $newLeadStatus;
                            }
                            if (!empty($newTemperature)) {
                                $setCols[] = "temperature = ?";
                                $setParams[] = $newTemperature;
                            }
                            if (!empty($setCols)) {
                                $setCols[] = "updated_at = NOW()";
                                $setParams[] = $crmContactId;
                                $this->pdo->prepare("UPDATE contacts SET " . implode(', ', $setCols) . " WHERE id = ? AND deleted_at IS NULL")->execute($setParams);
                            }
                        }

                        // Sync subscriber mirror columns
                        $subCols = [];
                        $subParams = [];
                        if ($newStageId !== null && $newStageId > 0) {
                            $subCols[] = "stage_id = ?";
                            $subParams[] = $newStageId;
                        }
                        if (!empty($newPipelineStatus)) {
                            $subCols[] = "pipeline_status = ?";
                            $subParams[] = $newPipelineStatus;
                        }
                        if (!empty($newLeadStatus)) {
                            $subCols[] = "lead_status = ?";
                            $subParams[] = $newLeadStatus;
                        }
                        if (!empty($subCols)) {
                            $subParams[] = $subscriberId;
                            $this->pdo->prepare("UPDATE subscribers SET " . implode(', ', $subCols) . " WHERE id = ?")->execute($subParams);
                        }

                        unset(self::$profileCache[$subscriberId]);
                        logActivity($this->pdo, $subscriberId, 'crm_update_stage', $currentStepId, $flowName, "CRM Stage updated (Stage: " . ($newStageId ?? $newPipelineStatus ?? 'N/A') . ")", $flowId, null, [], $subscriber['workspace_id']);
                        $logs[] = "  -> CRM Stage updated for contact {$crmContactId}.";
                    } elseif ($crmActionType === 'create_task' || $crmActionType === 'crm_create_task') {
                        if ($crmContactId > 0) {
                            $taskType = $crmConfig['task_type'] ?? $crmConfig['taskType'] ?? 'task';
                            $rawSubject = $crmConfig['subject'] ?? $crmConfig['taskSubject'] ?? $crmConfig['task_title'] ?? $crmConfig['title'] ?? ($step['label'] ?? 'Tác vụ tự động từ Flow');
                            $rawBody = $crmConfig['body'] ?? $crmConfig['taskBody'] ?? $crmConfig['task_description'] ?? $crmConfig['description'] ?? '';
                            if (isset($crmConfig['due_in_hours']) && (int)$crmConfig['due_in_hours'] > 0) {
                                $dueHours = (int) $crmConfig['due_in_hours'];
                                $dueDate = date('Y-m-d H:i:s', strtotime("+{$dueHours} hours"));
                            } else {
                                $dueDays = (int) ($crmConfig['due_days'] ?? $crmConfig['dueDays'] ?? $crmConfig['dueInDays'] ?? 1);
                                $dueDate = date('Y-m-d H:i:s', strtotime("+{$dueDays} days"));
                            }

                            $taskSubject = replaceMergeTags($rawSubject, $subscriber, ['campaign_name' => $flowName], $this->pdo);
                            $taskBody = replaceMergeTags($rawBody, $subscriber, ['campaign_name' => $flowName], $this->pdo);

                            // Determine owner_id
                            $rawOwner = $crmConfig['owner_id'] ?? $crmConfig['ownerId'] ?? null;
                            $taskOwnerId = !empty($rawOwner) ? (int) $rawOwner : null;
                            if (!$taskOwnerId) {
                                $stmtOw = $this->pdo->prepare("SELECT owner_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                                $stmtOw->execute([$crmContactId]);
                                $taskOwnerId = (int) $stmtOw->fetchColumn() ?: null;
                            }

                            $this->pdo->prepare("
                                INSERT INTO activities (tenant_id, contact_id, type, subject, body, status, due_date, user_id, created_by, created_at, updated_at)
                                VALUES (1, ?, ?, ?, ?, 'planned', ?, ?, ?, NOW(), NOW())
                            ")->execute([$crmContactId, $taskType, $taskSubject, $taskBody, $dueDate, $taskOwnerId, $taskOwnerId]);

                            logActivity($this->pdo, $subscriberId, 'crm_create_task', $currentStepId, $flowName, "Created CRM Task: {$taskSubject}", $flowId, null, [], $subscriber['workspace_id']);
                            $logs[] = "  -> CRM Task created for contact {$crmContactId}: {$taskSubject}";
                        } else {
                            $logs[] = "  -> CRM Task skipped: No linked CRM contact_id.";
                        }
                    } elseif ($crmActionType === 'assign_owner' || $crmActionType === 'crm_assign_owner') {
                        $rawOwner = $crmConfig['owner_id'] ?? $crmConfig['ownerId'] ?? null;
                        $targetOwnerId = !empty($rawOwner) ? (int) $rawOwner : null;
                        if (!$targetOwnerId && !empty($crmConfig['ownerIds']) && is_array($crmConfig['ownerIds'])) {
                            $validOwners = array_values(array_filter(array_map('intval', $crmConfig['ownerIds'])));
                            if (!empty($validOwners)) {
                                $idx = abs(crc32($subscriberId . $currentStepId)) % count($validOwners);
                                $targetOwnerId = $validOwners[$idx];
                            }
                        }

                        $onlyIfUnassigned = ($crmConfig['only_if_unassigned'] ?? true) !== false;

                        if ($targetOwnerId) {
                            $stmtUser = $this->pdo->prepare("SELECT full_name FROM users WHERE id = ? LIMIT 1");
                            $stmtUser->execute([$targetOwnerId]);
                            $ownerRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                            $ownerName = $ownerRow['full_name'] ?? null;

                            $shouldAssign = true;
                            if ($onlyIfUnassigned && $crmContactId > 0) {
                                $stmtCurr = $this->pdo->prepare("SELECT owner_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                                $stmtCurr->execute([$crmContactId]);
                                $currOwner = (int) $stmtCurr->fetchColumn();
                                if ($currOwner > 0) {
                                    $shouldAssign = false;
                                }
                            }

                            if ($shouldAssign) {
                                if ($crmContactId > 0) {
                                    $this->pdo->prepare("UPDATE contacts SET owner_id = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL")
                                        ->execute([$targetOwnerId, $crmContactId]);
                                }
                                $this->pdo->prepare("UPDATE subscribers SET owner_id = ?, salesperson = COALESCE(?, salesperson) WHERE id = ?")
                                    ->execute([$targetOwnerId, $ownerName, $subscriberId]);

                                unset(self::$profileCache[$subscriberId]);
                                logActivity($this->pdo, $subscriberId, 'crm_assign_owner', $currentStepId, $flowName, "Assigned owner: " . ($ownerName ?: $targetOwnerId), $flowId, null, [], $subscriber['workspace_id']);
                                $logs[] = "  -> CRM Owner assigned ({$targetOwnerId}) for subscriber {$subscriberId}.";
                            } else {
                                $logs[] = "  -> CRM Assign Owner skipped: Contact {$crmContactId} already has an owner.";
                            }
                        } else {
                            $logs[] = "  -> CRM Assign Owner skipped: No ownerId configured.";
                        }
                    } elseif (in_array($crmActionType, ['assign_round_robin', 'reassign_if_uncontacted', 'crm_assign_round_robin', 'crm_reassign_if_uncontacted'], true)) {
                        $isReassignSla = (strpos($crmActionType, 'reassign') !== false);
                        $rawRoundId = trim((string) ($crmConfig['roundId'] ?? $crmConfig['team_id'] ?? $crmConfig['round_id'] ?? ''));
                        $targetTeamId = ($rawRoundId !== '' && $rawRoundId !== 'all' && is_numeric($rawRoundId)) ? (int) $rawRoundId : 0;
                        $respectShifts = ($crmConfig['respectShifts'] ?? true) !== false;
                        $onlyIfUnassigned = !$isReassignSla && !empty($crmConfig['onlyIfUnassigned']);
                        $notifyNewSale = ($crmConfig['notifyNewSale'] ?? true) !== false;

                        // Check current owner of the contact
                        $currOwnerId = 0;
                        $currContactName = trim(($subscriber['first_name'] ?? '') . ' ' . ($subscriber['last_name'] ?? '')) ?: 'Khách hàng';
                        if ($crmContactId > 0) {
                            $stmtCurrC = $this->pdo->prepare("SELECT owner_id, full_name FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                            $stmtCurrC->execute([$crmContactId]);
                            $currCRow = $stmtCurrC->fetch(PDO::FETCH_ASSOC);
                            if ($currCRow) {
                                $currOwnerId = (int) ($currCRow['owner_id'] ?? 0);
                                if (!empty($currCRow['full_name'])) {
                                    $currContactName = $currCRow['full_name'];
                                }
                            }
                        }

                        if ($onlyIfUnassigned && $currOwnerId > 0) {
                            $logs[] = "  -> CRM Round-Robin skipped: Contact {$crmContactId} already has owner #{$currOwnerId}.";
                        } else {
                            // Find candidate active Sales in users (not on vacation)
                            $sqlUsers = "SELECT u.id, u.full_name, u.team_id,
                                                (SELECT MAX(dl.received_at) FROM distribution_logs dl WHERE dl.assigned_to = u.id) AS last_received_at
                                         FROM users u
                                         WHERE u.is_active = 1 AND COALESCE(u.vacation_mode, 0) = 0";
                            $uParams = [];
                            if ($targetTeamId > 0) {
                                $sqlUsers .= " AND u.team_id = ?";
                                $uParams[] = $targetTeamId;
                            } else {
                                $sqlUsers .= " AND LOWER(COALESCE(u.role, '')) IN ('sale', 'sales', 'consultant', 'telesale', 'manager', 'sale_admin')";
                            }
                            $stmtU = $this->pdo->prepare($sqlUsers);
                            $stmtU->execute($uParams);
                            $candidates = $stmtU->fetchAll(PDO::FETCH_ASSOC) ?: [];

                            // Filter by today's scheduled shifts if respectShifts is enabled and shift rows exist
                            if ($respectShifts && !empty($candidates)) {
                                try {
                                    $stmtShifts = $this->pdo->query("SELECT DISTINCT user_id FROM consultant_shifts WHERE shift_date = CURDATE() AND status = 'scheduled' AND user_id IS NOT NULL");
                                    $scheduledUserIds = $stmtShifts ? array_map('intval', $stmtShifts->fetchAll(PDO::FETCH_COLUMN)) : [];
                                    if (!empty($scheduledUserIds)) {
                                        $shiftedCandidates = array_values(array_filter($candidates, function ($c) use ($scheduledUserIds) {
                                            return in_array((int) $c['id'], $scheduledUserIds, true);
                                        }));
                                        if (!empty($shiftedCandidates)) {
                                            $candidates = $shiftedCandidates;
                                        }
                                    }
                                } catch (\Throwable $eShift) {}
                            }

                            // When reassigning due to SLA breach, exclude the current owner if another Sale is available
                            if ($isReassignSla && $currOwnerId > 0 && count($candidates) > 1) {
                                $otherCandidates = array_values(array_filter($candidates, function ($c) use ($currOwnerId) {
                                    return (int) $c['id'] !== $currOwnerId;
                                }));
                                if (!empty($otherCandidates)) {
                                    $candidates = $otherCandidates;
                                }
                            }

                            // Sort by oldest last_received_at (NULL first -> least recently assigned)
                            if (!empty($candidates)) {
                                usort($candidates, function ($a, $b) {
                                    $ta = !empty($a['last_received_at']) ? strtotime($a['last_received_at']) : 0;
                                    $tb = !empty($b['last_received_at']) ? strtotime($b['last_received_at']) : 0;
                                    if ($ta === $tb) {
                                        return ((int) $a['id']) <=> ((int) $b['id']);
                                    }
                                    return $ta <=> $tb;
                                });

                                $chosenSale = $candidates[0];
                                $chosenSaleId = (int) $chosenSale['id'];
                                $chosenSaleName = $chosenSale['full_name'] ?: "Sale #{$chosenSaleId}";
                                $chosenRoundId = $targetTeamId > 0 ? $targetTeamId : (int) ($chosenSale['team_id'] ?? 0);

                                if ($crmContactId > 0) {
                                    $this->pdo->prepare("UPDATE contacts SET owner_id = ?, pipeline_status = COALESCE(NULLIF(pipeline_status, 'held'), 'assigned'), assigned_at = NOW(), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL")
                                        ->execute([$chosenSaleId, $crmContactId]);

                                    try {
                                        $distMsg = $isReassignSla
                                            ? "Thu hồi SLA & chia lại tự động từ Flow '{$flowName}' sang {$chosenSaleName}"
                                            : "Chia tự động Round-Robin từ Flow '{$flowName}' cho {$chosenSaleName}";
                                        $this->pdo->prepare("
                                            INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message, received_at)
                                            VALUES (?, ?, ?, 'assigned', ?, NOW())
                                        ")->execute([$crmContactId, $chosenSaleId, $chosenRoundId, $distMsg]);
                                    } catch (\Throwable $eDl) {}
                                }

                                $this->pdo->prepare("UPDATE subscribers SET owner_id = ?, salesperson = ? WHERE id = ?")
                                    ->execute([$chosenSaleId, $chosenSaleName, $subscriberId]);

                                if ($notifyNewSale) {
                                    try {
                                        $notifTitle = $isReassignSla
                                            ? "🔄 Bàn giao Lead quá hạn SLA: {$currContactName}"
                                            : "🎯 Lead mới từ Vòng chia tự động: {$currContactName}";
                                        $notifBody = $isReassignSla
                                            ? "Khách hàng {$currContactName} vừa được hệ thống tự động thu hồi SLA và chuyển cho bạn chăm sóc từ kịch bản '{$flowName}'."
                                            : "Khách hàng {$currContactName} vừa được phân bổ cho bạn từ kịch bản '{$flowName}'. Vui lòng liên hệ ngay!";
                                        $linkUrl = $crmContactId > 0 ? "/contacts?open_contact_id={$crmContactId}" : "/contacts";
                                        $this->pdo->prepare("
                                            INSERT INTO notifications (tenant_id, user_id, type, title, body, link, is_read, created_at)
                                            VALUES (1, ?, 'lead_assigned', ?, ?, ?, 0, NOW())
                                        ")->execute([$chosenSaleId, $notifTitle, $notifBody, $linkUrl]);
                                    } catch (\Throwable $eNotif) {}
                                }

                                unset(self::$profileCache[$subscriberId]);
                                $actLogType = $isReassignSla ? 'crm_reassign_sla' : 'crm_assign_round_robin';
                                logActivity($this->pdo, $subscriberId, $actLogType, $currentStepId, $flowName, "Assigned to {$chosenSaleName} (#{$chosenSaleId})", $flowId, null, [], $subscriber['workspace_id']);
                                $logs[] = "  -> CRM Round-Robin assigned to {$chosenSaleName} (#{$chosenSaleId}).";
                            } else {
                                $logs[] = "  -> CRM Round-Robin skipped: No active Sales found for team #{$targetTeamId}.";
                            }
                        }
                    } elseif ($crmActionType === 'update_temperature' || $crmActionType === 'crm_update_temperature') {
                        $newTemp = strtolower(trim((string) ($crmConfig['temperature'] ?? 'hot')));
                        if (!in_array($newTemp, ['hot', 'warm', 'cold', 'nurture', 'lost'], true)) {
                            $newTemp = 'hot';
                        }
                        if ($crmContactId > 0) {
                            $this->pdo->prepare("UPDATE contacts SET temperature = ?, lead_status = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL")
                                ->execute([$newTemp, $newTemp, $crmContactId]);
                        }
                        try {
                            $this->pdo->prepare("UPDATE subscribers SET lead_status = ?, temperature = ? WHERE id = ?")
                                ->execute([$newTemp, $newTemp, $subscriberId]);
                        } catch (\Throwable $eSubTemp) {
                            $this->pdo->prepare("UPDATE subscribers SET lead_status = ? WHERE id = ?")
                                ->execute([$newTemp, $subscriberId]);
                        }
                        unset(self::$profileCache[$subscriberId]);
                        logActivity($this->pdo, $subscriberId, 'crm_update_temperature', $currentStepId, $flowName, "Updated Lead Temperature: " . strtoupper($newTemp), $flowId, null, [], $subscriber['workspace_id']);
                        $logs[] = "  -> CRM Lead Temperature updated to {$newTemp} for contact {$crmContactId}.";
                    } elseif ($crmActionType === 'notify_owner' || $crmActionType === 'crm_notify_owner') {
                        $rawNotifyUser = $crmConfig['user_id'] ?? $crmConfig['userId'] ?? $crmConfig['owner_id'] ?? $crmConfig['ownerId'] ?? null;
                        $notifyUserId = !empty($rawNotifyUser) ? (int) $rawNotifyUser : null;
                        if (!$notifyUserId && $crmContactId > 0) {
                            $stmtOw = $this->pdo->prepare("SELECT owner_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                            $stmtOw->execute([$crmContactId]);
                            $notifyUserId = (int) $stmtOw->fetchColumn() ?: null;
                        }
                        if (!$notifyUserId && !empty($subscriber['owner_id'])) {
                            $notifyUserId = (int) $subscriber['owner_id'];
                        }

                        $rawTitle = $crmConfig['notifyTitle'] ?? $crmConfig['title'] ?? "Thông báo từ Flow: {$flowName}";
                        $rawMessage = $crmConfig['notifyMessage'] ?? $crmConfig['message'] ?? $crmConfig['content'] ?? "Khách hàng {{fullName}} ({{email}}) vừa đi đến bước {$step['label']} trong luồng {$flowName}.";
                        $finalTitle = replaceMergeTags($rawTitle, $subscriber, ['campaign_name' => $flowName], $this->pdo);
                        $finalMessage = replaceMergeTags($rawMessage, $subscriber, ['campaign_name' => $flowName], $this->pdo);

                        if ($notifyUserId) {
                            try {
                                $linkUrl = $crmContactId > 0 ? "/crm/contacts?id={$crmContactId}" : "/automation/flows";
                                $this->pdo->prepare("
                                    INSERT INTO notifications (tenant_id, user_id, type, title, body, link, is_read, created_at)
                                    VALUES (1, ?, 'automation_flow', ?, ?, ?, 0, NOW())
                                ")->execute([$notifyUserId, $finalTitle, $finalMessage, $linkUrl]);
                            } catch (\Throwable $eNotif) {
                                // Fallback: log as CRM activity note if notifications table schema differs
                                if ($crmContactId > 0) {
                                    try {
                                        $this->pdo->prepare("
                                            INSERT INTO activities (tenant_id, contact_id, type, subject, body, status, done_at, user_id, created_by, created_at, updated_at)
                                            VALUES (1, ?, 'note', ?, ?, 'done', NOW(), ?, ?, NOW(), NOW())
                                        ")->execute([$crmContactId, $finalTitle, $finalMessage, $notifyUserId, $notifyUserId]);
                                    } catch (\Throwable $eAct) {}
                                }
                            }
                            logActivity($this->pdo, $subscriberId, 'crm_notify_owner', $currentStepId, $flowName, "Notified user #{$notifyUserId}: {$finalTitle}", $flowId, null, [], $subscriber['workspace_id']);
                            $logs[] = "  -> Notified CRM owner #{$notifyUserId}.";
                        } else {
                            $logs[] = "  -> CRM Notify Owner skipped: No owner resolved.";
                        }
                    } elseif ($crmActionType === 'create_support_ticket' || $crmActionType === 'create_ticket') {
                        $rawAssignee = $crmConfig['assignee_id'] ?? $crmConfig['assigneeId'] ?? $crmConfig['owner_id'] ?? $crmConfig['ownerId'] ?? null;
                        $assigneeId = !empty($rawAssignee) ? (int) $rawAssignee : null;
                        if (!$assigneeId && $crmContactId > 0) {
                            $stmtOw = $this->pdo->prepare("SELECT owner_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                            $stmtOw->execute([$crmContactId]);
                            $assigneeId = (int) $stmtOw->fetchColumn() ?: null;
                        }
                        if (!$assigneeId && !empty($subscriber['owner_id'])) {
                            $assigneeId = (int) $subscriber['owner_id'];
                        }
                        if (!$assigneeId) {
                            $assigneeId = 1;
                        }

                        $rawTicketSubject = $crmConfig['ticket_subject'] ?? $crmConfig['subject'] ?? "Hỗ trợ học viên / khách hàng {{full_name}}";
                        $rawTicketDesc = $crmConfig['ticket_description'] ?? $crmConfig['description'] ?? $crmConfig['body'] ?? "Ticket tự động khởi tạo từ kịch bản Marketing: {$flowName}.";
                        $finalTicketSubject = replaceMergeTags($rawTicketSubject, $subscriber, ['campaign_name' => $flowName], $this->pdo);
                        $finalTicketDesc = replaceMergeTags($rawTicketDesc, $subscriber, ['campaign_name' => $flowName], $this->pdo);

                        $priority = strtolower((string) ($crmConfig['priority'] ?? 'medium'));
                        if (!in_array($priority, ['low', 'medium', 'high', 'urgent'], true)) {
                            $priority = 'medium';
                        }
                        $dueHours = max(1, (int) ($crmConfig['due_in_hours'] ?? $crmConfig['dueInHours'] ?? 24));
                        $dueDate = date('Y-m-d H:i:s', time() + ($dueHours * 3600));
                        $customerName = trim(($subscriber['first_name'] ?? '') . ' ' . ($subscriber['last_name'] ?? '')) ?: ($subscriber['email'] ?? 'Khách hàng');
                        $relatedContactsJson = $crmContactId > 0 ? json_encode([(int) $crmContactId]) : null;

                        try {
                            $this->pdo->prepare("
                                INSERT INTO tickets (tenant_id, created_by, assignee_id, contact_id, subject, customer_name, description, status, priority, due_date, related_contacts, created_at)
                                VALUES (1, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NOW())
                            ")->execute([
                                $assigneeId,
                                $assigneeId,
                                $crmContactId > 0 ? $crmContactId : null,
                                $finalTicketSubject,
                                $customerName,
                                $finalTicketDesc,
                                $priority,
                                $dueDate,
                                $relatedContactsJson
                            ]);
                            $newTicketId = (int) $this->pdo->lastInsertId();
                            logActivity($this->pdo, $subscriberId, 'crm_create_ticket', $currentStepId, $flowName, "Created Ticket #{$newTicketId}: {$finalTicketSubject}", $flowId, null, [], $subscriber['workspace_id']);
                            $logs[] = "  -> Created MYERP Support Ticket #{$newTicketId} (Assignee #{$assigneeId}).";
                        } catch (\Throwable $eTk) {
                            $logs[] = "  -> CRM Create Ticket failed: " . $eTk->getMessage();
                        }
                    }

                    $nextStepId = $step['nextStepId'] ?? null;
                    $isInstantStep = true;
                    break;

                case 'link_flow':
                    $linkedId = $step['config']['linkedFlowId'] ?? '';
                    if ($linkedId) {
                        // [SECURITY FIX] Get linked flow config + steps AND verify it belongs to the same workspace
                        $stmtLF = $this->pdo->prepare("SELECT steps, config FROM flows WHERE id = ? AND workspace_id = ? AND status='active'");
                        $stmtLF->execute([$linkedId, $subscriber['workspace_id']]);
                        $lRow = $stmtLF->fetch();
                        if ($lRow) {
                            $lSteps = json_decode($lRow['steps'], true) ?: [];
                            $lConfig = json_decode($lRow['config'], true) ?: [];
                            $lFrequency = $lConfig['frequency'] ?? 'one-time';
                            $lCooldownHours = (int) ($lConfig['enrollmentCooldownHours'] ?? 12);
                            $lStart = null;
                            foreach ($lSteps as $s) {
                                if ($s['type'] === 'trigger') {
                                    $lStart = $s['nextStepId'] ?? null;
                                    break;
                                }
                            }

                            if ($lStart) {
                                // [FIX #6] Respect frequency setting of the linked flow
                                // Previously: INSERT IGNORE only prevented exact duplicate rows,
                                // but one-time flows could be re-enrolled if the previous state was 'completed'.
                                $canEnroll = false;
                                if ($lFrequency === 'one-time') {
                                    // One-time: only enroll if NEVER been in this flow before
                                    $stmtCheck = $this->pdo->prepare("SELECT COUNT(*) FROM subscriber_flow_states WHERE workspace_id = ? AND subscriber_id = ? AND flow_id = ?");
                                    $stmtCheck->execute([$subscriber['workspace_id'], $subscriberId, $linkedId]);
                                    $canEnroll = ($stmtCheck->fetchColumn() == 0);
                                } else {
                                    // Recurring: block if currently active or within cooldown
                                    $stmtCheck = $this->pdo->prepare(
                                        "SELECT COUNT(*) FROM subscriber_flow_states WHERE workspace_id = ? AND subscriber_id = ? AND flow_id = ?
                                         AND (status IN ('waiting', 'processing') OR updated_at > DATE_SUB(NOW(), INTERVAL ? HOUR))"
                                    );
                                    $stmtCheck->execute([$subscriber['workspace_id'], $subscriberId, $linkedId, $lCooldownHours]);
                                    $canEnroll = ($stmtCheck->fetchColumn() == 0);
                                }

                                if ($canEnroll) {
                                    $linkedInitialSchedule = date('Y-m-d H:i:s');
                                    // [SMART SCHEDULE FIX] Calculate future wait date if first step of linked flow is wait
                                    foreach ($lSteps as $fs) {
                                        if (($fs['id'] ?? '') === $lStart && strtolower($fs['type'] ?? '') === 'wait') {
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
                                                    $linkedInitialSchedule = date('Y-m-d H:i:s', time() + ($unitSeconds * $dur));
                                                }
                                            } elseif ($fsWaitMode === 'until_date') {
                                                $specDate = $fsWaitConfig['specificDate'] ?? '';
                                                $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                                if ($specDate) {
                                                    $targetTs = strtotime("$specDate $targetTime:00");
                                                    if ($targetTs > time()) {
                                                        $linkedInitialSchedule = date('Y-m-d H:i:s', $targetTs);
                                                    }
                                                }
                                            } elseif ($fsWaitMode === 'until') {
                                                $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                                $dt = new DateTime();
                                                $parts2 = explode(':', $targetTime);
                                                $dt->setTime((int)$parts2[0], (int)($parts2[1] ?? 0), 0);
                                                if ($dt->getTimestamp() <= time()) $dt->modify('+1 day');
                                                $linkedInitialSchedule = $dt->format('Y-m-d H:i:s');
                                            }
                                            break;
                                        }
                                    }

                                    // [FIX P0] Status was 'processing' — workers only poll WHERE status='waiting',
                                    // so linked-flow subscribers were invisible until a timeout reclaim cycle.
                                    // Changed to 'waiting' so the dispatched priority worker picks up instantly.
                                    // [HARDENING] Extract step type for the linked flow's first step
                                    // [FIX AUDIT-01] $linkedFlow was undefined. Use $lSteps (already decoded at L1322).
                                    $lStartType = 'unknown';
                                    foreach ($lSteps as $ls) {
                                        if ($ls['id'] === $lStart) {
                                            $lStartType = $ls['type'] ?? 'unknown';
                                            break;
                                        }
                                    }

                                    $this->pdo->prepare(
                                        "INSERT INTO subscriber_flow_states (subscriber_id, workspace_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
                                         VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())"
                                    )->execute([$subscriberId, $subscriber['workspace_id'] ?? 1, $subscriber['contact_id'] ?? null, $linkedId, $lStart, $lStartType, $linkedInitialSchedule]);
                                    $newQ = $this->pdo->lastInsertId();
                                    if ($newQ) {
                                        dispatchFlowWorker($this->pdo, 'flows', ['priority_queue_id' => $newQ, 'subscriber_id' => $subscriberId, 'priority_flow_id' => $linkedId]);
                                        logActivity($this->pdo, $subscriberId, 'enter_flow', $linkedId, "Linked Flow", "Linked to $linkedId", $linkedId, null, [], $subscriber['workspace_id']);
                                        $logs[] = "  -> Linked to flow $linkedId.";
                                    }

                                } else {
                                    $logs[] = "  -> Link Flow skipped: Subscriber already enrolled or in cooldown for flow $linkedId.";
                                }
                            }
                        }
                    }
                    // [FIX] Single stat_completed increment here (terminal step for current flow).
                    // DO NOT also increment inside the canEnroll block — that causes double-counting
                    // when a linked enrollment succeeds.
                    $this->bufferStatsUpdate('flows', $flowId, 'stat_completed', 1, $subscriber['workspace_id']);
                    $shouldContinueChain = false;
                    $status = 'completed';
                    break;


                default:
                    $logs[] = "  -> Unknown step type: {$step['type']}";
                    $nextStepId = $step['nextStepId'] ?? null;
                    $isInstantStep = true;
                    break;
            }

        } catch (Throwable $e) {
            $status = 'failed';
            $shouldContinueChain = false;
            $logs[] = "  -> Exception in step: " . $e->getMessage();
        }

        return [
            'status' => $status,
            'next_step_id' => $nextStepId,
            'is_instant' => $isInstantStep,
            'scheduled_at' => $nextScheduledAt,
            'logs' => $logs,
            'should_continue' => $shouldContinueChain,
            'message_sent' => $messageSent,
            'context_updates' => $contextData // Pass back any context changes (e.g. email error flagged)
        ];
    }
}
