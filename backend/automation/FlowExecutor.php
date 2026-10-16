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
                    // Previously $resolverContext was always [], so {{unsubscribeLink}},
                    // {{campaignName}} were never resolved in flow action emails.
                    $unsubToken = urlencode($subscriber['email'] ?? $subscriberId);
                    $resolverContext = [
                        'unsubscribe_url' => ($this->apiUrl . '/unsubscribe.php?token=' . $unsubToken . '&flow_id=' . $flowId),
                        'campaign_name' => $flowName,
                        'campaignName' => $flowName,
                        'variable_fallbacks' => $config['variable_fallbacks'] ?? ($config['fallbacks'] ?? []),
                        'config' => $config
                    ];

                    $htmlContent = resolveEmailContent($this->pdo, $config['templateId'] ?? '', $config['customHtml'] ?? '', $config['contentBody'] ?? '', $resolverContext);

                    $finalHtml = replaceMergeTags($htmlContent, $subscriber, $resolverContext);
                    $finalSubject = replaceMergeTags($config['subject'] ?? '', $subscriber, $resolverContext);


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
                    // Shared with worker_campaign.php â†’ campaign + flow combined â‰¤ 10/s total.
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
                            // [Váº¬N HÃ€NH] Log as skipped but ADVANCE the flow so Zalo/ZNS steps can still trigger
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

                    // 48h window check Ã¢â‚¬â€ Zalo CS requires subscriber to have interacted within 48h
                    // [BUG-FIX] Bug #6: Previously using `$lastInteract && (time() - strtotime() > 48h)`
                    // When lastInteract=NULL (never interacted), the condition evaluated to FALSE
                    // so the code allowed sending Ã¢â‚¬â€ but Zalo API requires recent interaction.
                    // Fix: treat NULL as "no interaction" Ã¢â€ â€™ block sending.
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
                    $finalText = replaceMergeTags($config['content'] ?? '', $subscriber, $csContext);
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
                        // [FIX] Track if we paused for time restriction Ã¢â‚¬â€ if true, skip
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
                                    $fbVal = is_string($value) ? replaceMergeTags($value, $subscriber, $fbZnsContext) : $value;
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
                    // $zaloFallbackPaused=true means status='waiting' was already set above Ã¢â‚¬â€ 
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
                        $val = is_string($value) ? replaceMergeTags($value, $subscriber, $znsContext) : $value;

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
                        //   - 'id', 'ma_giao_dich', 'ma_don_hang', 'tracking_id' Ã¢â€ â€™ max 20 chars
                        //   - All others Ã¢â€ â€™ max 100 chars (safe default)
                        // Previously all fields were truncated at 100 chars, but UUID (36 chars)
                        // still exceeded the 20-char limit for 'id' Ã¢â€ â€™ Zalo API error -1121.
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
                        $msgConfig['text'] = replaceMergeTags($config['content'], $subscriber, $metaContext);
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
                    $waitDur = (int) ($step['config']['waitDuration'] ?? 1);
                    $waitUnit = $step['config']['waitUnit'] ?? 'hours';

                    // [FIX] Khai bÃƒÂ¡o target/campaign ID tÃ¡Â»Â« bÃ†Â°Ã¡Â»â€ºc Trigger
                    $linkedCampaignId = null;
                    foreach ($flowSteps as $fs) {
                        if ($fs['type'] === 'trigger' && in_array($fs['config']['type'] ?? '', ['campaign', 'survey'])) {
                            // CÃ¡ÂºÂ¥u hÃƒÂ¬nh lÃ†Â°u trong targetId hoÃ¡ÂºÂ·c campaignId
                            $linkedCampaignId = $fs['config']['targetId'] ?? ($fs['config']['campaignId'] ?? null);
                            break;
                        }
                    }

                    // Timeout Calculation
                    $startTime = !empty($lastStepAt) ? $lastStepAt : (!empty($itemUpdatedAt) ? $itemUpdatedAt : $queueCreatedAt);
                    // [FIX] Guard against empty string or MySQL zero-date ("0000-00-00 00:00:00")
                    // from DB. Passing either into new DateTime() throws an uncatchable Fatal Error:
                    // "Failed to parse time string" Ã¢â‚¬â€ crashing the entire worker process.
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

                    // Forced Fail on Email Error
                    if (($hasEmailError && in_array($condType, ['opened', 'clicked'])) || (isset($hasZnsError) && $hasZnsError && strpos($condType, 'zns_') === 0)) {
                        $logs[] = "  -> Condition forced NO due to email error.";
                        $nextStepId = $step['noStepId'] ?? null;
                        $isInstantStep = true;
                        logActivity($this->pdo, $subscriberId, 'condition_false', $currentStepId, $flowName, "Forced FALSE (Email Error)", $flowId, null, [], $subscriber['workspace_id']);
                        break;
                    }

                    $isMatched = false;
                    // Resolve Reference (Campaign vs Step)
                    $targetStepId = $step['config']['targetStepId'] ?? null;

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
                            
                            // [FIX] Allow 1 hour grace period before queue creation to catch the survey response that triggered the flow
                            $graceStartTime = !empty($queueCreatedAt) ? $queueCreatedAt : $startTime;
                            $sqlResp .= " AND submitted_at >= ?";
                            $paramsResp[] = (new DateTime($graceStartTime))->modify('-1 hour')->format('Y-m-d H:i:s');

                            if ($targetSurveyId) {
                                $sqlResp .= " AND survey_id = ?";
                                $paramsResp[] = $targetSurveyId;
                            }
                            $sqlResp .= " ORDER BY submitted_at DESC LIMIT 1";
                            $stmtR = $this->pdo->prepare($sqlResp);
                            $stmtR->execute($paramsResp);
                            $latestResp = $stmtR->fetch(PDO::FETCH_ASSOC);

                            // [MEMORY GUARD] [FIX AUDIT-07] Use centralized pruning
                            self::pruneCache(self::$profileCache['_survey_responses'], 200);
                            self::$profileCache['_survey_responses'][$cacheKey] = $latestResp;
                        }

                        if ($latestResp) {
                            if ($condType === 'survey_score') {
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
                                        // Precise or contains match
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
                    } elseif ($condType === 'opened') {
                        $types = ['open_email', 'open_zns'];
                    } elseif ($condType === 'clicked') {
                        $types = ['click_link', 'click_zns'];
                    } elseif ($condType === 'unsubscribed') {
                        $types = ['unsubscribe'];
                    }
                    // [FIX] ZNS-specific condition types
                    elseif ($condType === 'zns_delivered') {
                        $types = ['zns_sent'];
                    } elseif ($condType === 'zns_clicked') {
                        $types = ['click_zns'];
                    } elseif ($condType === 'zns_replied') {
                        // [VERIFIED 2026-04-23] DB audit: ZNS reply is logged as 'staff_reply'
                        // by the CRM/support module. 'reply_zns' and 'zns_replied' do NOT exist
                        // in subscriber_activity. 'zns_clicked' also absent Ã¢â‚¬â€ Zalo click/reply
                        // webhooks are not configured on this installation.
                        $types = ['staff_reply'];
                    } elseif ($condType === 'zns_failed') {
                        $types = ['zns_failed'];
                    }
                    // [FIX] Email delivered = receive_email
                    elseif ($condType === 'delivered') {
                        $types = ['receive_email'];
                    }
                    // [FIX] Reminder conditions Ã¢â‚¬â€ check subscriber_activity for reminder events
                    elseif ($condType === 'received_reminder') {
                        $types = ['receive_email']; // receive_email logged when reminder is sent
                    } elseif ($condType === 'opened_reminder') {
                        $types = ['open_email']; // open_email logged when reminder is opened
                    }

                    // reminderId from frontend config Ã¢â‚¬â€ if set, filter activities to this specific reminder campaign
                    $reminderId = $step['config']['reminderId'] ?? null;

                    // [FIX] 'unsubscribe' is a global event Ã¢â‚¬â€ NOT scoped to flow_id.
                    // Reminder conditions are also global but can be scoped by reminderId (campaign_id).
                    $isGlobalEvent = in_array($condType, ['unsubscribed', 'received_reminder', 'opened_reminder']);

                    if (empty($types)) {
                        $activities = [];
                    } elseif (isset($contextData['activity_cache']) && count($contextData['activity_cache']) < 500) {
                        $cachedActivities = $contextData['activity_cache'];
                        $activities = [];
                        foreach ($cachedActivities as $act) {
                            if (in_array($act['type'], $types)) {
                                // [FIX] Global events (unsubscribe) have no flow_id Ã¢â‚¬â€ always include them
                                if ($isGlobalEvent) {
                                    // For reminder conditions: filter by reminderId (campaign_id) if provided
                                    if (($condType === 'received_reminder' || $condType === 'opened_reminder') && !empty($reminderId)) {
                                        if ((string) ($act['campaign_id'] ?? '') === (string) $reminderId) {
                                            $activities[] = $act;
                                        }
                                    } else {
                                        $activities[] = $act;
                                    }
                                    continue;
                                }
                                // Apply linkedCampaignId and targetStepId filtering to cached activities
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

                        // [FIX] 'unsubscribe' is global Ã¢â‚¬â€ do NOT filter by flow_id
                        // For reminder conditions: optionally filter by reminderId (campaign_id)
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
                            // Scope reminder to specific campaign
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

                            // [SMART MATCH] PhÃƒÂ¢n loÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»â€˜i soÃƒÂ¡t: Trigger vs Step cÃ¡Â»Â¥ thÃ¡Â»Æ’
                            $isFromTarget = false;

                            // 0. KiÃ¡Â»Æ’m tra xem bÃ†Â°Ã¡Â»â€ºc Ã„â€˜ÃƒÂ­ch cÃƒÂ³ phÃ¡ÂºÂ£i lÃƒÂ  Trigger khÃƒÂ´ng
                            $isTargetingTrigger = false;
                            if ($targetStepId) {
                                foreach ($flowSteps as $fs) {
                                    if ($fs['id'] === $targetStepId && $fs['type'] === 'trigger') {
                                        $isTargetingTrigger = true;
                                        break;
                                    }
                                }
                            }

                            // 1. TrÃ†Â°Ã¡Â»Âng hÃ¡Â»Â£p chÃ¡Â»Â Ã„â€˜Ã¡Â»Â£i kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ tÃ¡Â»Â« Trigger Campaign (TrÃ†Â°Ã¡Â»Âng hÃ¡Â»Â£p cÃ¡Â»Â§a anh hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i)
                            if ($isTargetingTrigger && $linkedCampaignId && !empty($act['campaign_id']) && (string) $act['campaign_id'] === (string) $linkedCampaignId) {
                                $isFromTarget = true;
                            }
                            // 2. TrÃ†Â°Ã¡Â»Âng hÃ¡Â»Â£p chÃ¡Â»Â Ã„â€˜Ã¡Â»Â£i mÃ¡Â»â„¢t bÃ†Â°Ã¡Â»â€ºc GÃ¡Â»Â­i Mail cÃ¡Â»Â¥ thÃ¡Â»Æ’ TRONG Flow
                            // (VÃƒÂ­ dÃ¡Â»Â¥: BÃ†Â°Ã¡Â»â€ºc 2 GÃ¡Â»Â­i Mail -> BÃ†Â°Ã¡Â»â€ºc 3 KiÃ¡Â»Æ’m tra Mail bÃ†Â°Ã¡Â»â€ºc 2)
                            elseif ($targetStepId && trim($act['reference_id'] ?? '') === trim($targetStepId)) {
                                $isFromTarget = true;
                            }
                            // 3. NÃ¡ÂºÂ¿u khÃƒÂ´ng chÃ¡Â»â€° Ã„â€˜Ã¡Â»â€¹nh Ã„â€˜ÃƒÂ­ch Ã„â€˜Ã¡ÂºÂ¿n, chÃ¡ÂºÂ¥p nhÃ¡ÂºÂ­n mÃ¡Â»Âi hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng thuÃ¡Â»â„¢c Flow nÃƒÂ y 
                            elseif (!$targetStepId) {
                                $isFromTarget = true;
                            }

                            if (!$isFromTarget)
                                continue;

                            if ($condType === 'clicked') {
                                $linkTargets = $step['config']['linkTargets'] ?? [];
                                if (!is_array($linkTargets) && !empty($step['config']['linkTarget']))
                                    $linkTargets = [$step['config']['linkTarget']];

                                if (empty($linkTargets)) {
                                    $isMatched = true;
                                    break;
                                } else {
                                    $rawDetail = $act['details'] ?? '';
                                    $clickedUrl = extractClickedUrlFromDetails($rawDetail);

                                    // [FIX #4] Old logic used strtok($u, '?') to strip ALL query strings,
                                    // causing links like ?ref=email to NEVER match the configured target.
                                    // New logic: normalize path only (strip protocol + trailing slash),
                                    // then use stripos to allow partial/substring URL matching.
                                    // This means: target 'example.com/page' matches 'example.com/page?utm_source=flow'
                                    $normalizeUrlBase = function ($u) {
                                        // Remove protocol
                                        $u = preg_replace('/^https?:\/\//', '', trim($u));
                                        // Remove trailing slash
                                        return rtrim($u, '/');
                                    };

                                    $normClicked = $normalizeUrlBase($clickedUrl);

                                    foreach ($linkTargets as $target) {
                                        $normTarget = $normalizeUrlBase($target);
                                        // Exact match OR clicked URL starts with/contains the target base
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
                        logActivity($this->pdo, $subscriberId, 'condition_false', $currentStepId, $flowName, "Timed Out: $condType", $flowId, null, [], $subscriber['workspace_id']);
                        $logs[] = "  -> Condition Timed Out. Moving to ELSE.";
                        $isInstantStep = true;
                    } else {
                        // CHÃ†Â¯A KHÃ¡Â»Å¡P VÃƒâ‚¬ CHÃ†Â¯A HÃ¡ÂºÂ¾T GIÃ¡Â»Å“ -> TIÃ¡ÂºÂ¾P TÃ¡Â»Â¤C Ã„ÂÃ¡Â»Â¢I
                        $logs[] = "  -> Condition not met yet. Still waiting...";
                        $status = 'waiting';
                        $shouldContinueChain = false;
                        // [FIX] T\u0103ng t\u1eeb 5 ph\u00fat l\u00ean 15 ph\u00fat \u2014 gi\u1ea3m t\u1ea3i worker khi c\u00f3 nhi\u1ec1u subscriber ch\u1edd condition
                        $nextScheduledAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));
                    }
                    break;

                case 'advanced_condition':
                    require_once 'flow_helpers.php';
                    // Ensure helper is available for evaluateAdvancedConditionGroup

                    $branches = $step['config']['branches'] ?? [];
                    $defaultStepId = $step['config']['defaultStepId'] ?? null;
                    $matchedStepId = null;
                    $matchLabel = "Fallback";

                    $subProfile = null;
                    if (isset(self::$profileCache[$subscriberId])) {
                        $subProfile = self::$profileCache[$subscriberId];
                    } else {
                        $subProfile = getSubscriberProfileForFlow($this->pdo, $subscriberId);
                        // [MEMORY GUARD] [FIX AUDIT-07] Use centralized pruning
                        self::pruneCache(self::$profileCache, 200);
                        self::$profileCache[$subscriberId] = $subProfile;
                    }

                    foreach ($branches as $branch) {
                        $conditions = $branch['conditions'] ?? [];
                        // [FIX] Empty conditions branch should NOT auto-match.
                        // Previously: empty($conditions) would cause every branch without
                        // conditions to match instantly, bypassing all other branches.
                        // Now: only branches with at least 1 condition AND all conditions true will match.
                        if (!empty($conditions) && evaluateAdvancedConditionGroup($this->pdo, $subscriberId, $subProfile, $conditions)) {
                            $matchedStepId = $branch['stepId'];
                            $matchLabel = $branch['label'];
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
                    // a negative integer. ($negativeInt % 100) is also negative Ã¢â€ â€™ always < $ratioA
                    // Ã¢â€ â€™ always Path A or always Path B depending on value. abs(crc32()) is safe
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
                            // "Field 'id' doesn't have a default value" Ã¢â‚¬â€ crashing the flow.
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
                        // [FIX] Log BEFORE delete Ã¢â‚¬â€  logActivity would fail (FK/orphan) if run after DELETE
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

                                    // [FIX P0] Status was 'processing' Ã¢â‚¬â€ workers only poll WHERE status='waiting',
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
                                        "INSERT INTO subscriber_flow_states (subscriber_id, workspace_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
                                         VALUES (?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())"
                                    )->execute([$subscriberId, $subscriber['workspace_id'] ?? 1, $linkedId, $lStart, $lStartType, $linkedInitialSchedule]);
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
                    // DO NOT also increment inside the canEnroll block Ã¢â‚¬â€ that causes double-counting
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
