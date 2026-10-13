<?php
// backend/cron_ai_worker.php
// Tiến trình chạy ngầm (Worker) để gọi Gemini API và phân bổ Lead bất đồng bộ

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/webhook_logic.php';

function runAIScreenerWorker($conn)
{
    // Ngăn chặn chạy trùng lặp tiến trình bằng file lock
    $lockFile = sys_get_temp_dir() . '/cron_ai_worker_' . md5(__DIR__) . '.lock';
    $fp = @fopen($lockFile, 'c+');
    if (!$fp) {
        echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
        return;
    }
    if (!@flock($fp, LOCK_EX | LOCK_NB)) {
        echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_ai_worker.php is already running. Exiting.\n";
        fclose($fp);
        return;
    }

    // Đặt thời gian thực thi không giới hạn
    set_time_limit(0);

    // Tự động khôi phục các lead bị kẹt ở trạng thái 'screening' từ phiên chạy trước bị lỗi/crash (quá 10 phút)
    $conn->query("UPDATE leads SET ai_screener_status = 'pending', ai_screening_started_at = NULL WHERE status = 'pending_approval' AND ai_screener_status = 'screening' AND (ai_screening_started_at IS NULL OR ai_screening_started_at <= DATE_SUB(NOW(), INTERVAL 10 MINUTE))");

    // 1. Lấy danh sách tối đa 20 Lead đang chờ duyệt AI hoặc bị lỗi kết nối dưới 3 lần
    $conn->begin_transaction();
    $res = $conn->query("
        SELECT id, phone, email, name, source, type, note, target_round_id, ai_attempts, connection_id 
        FROM leads 
        WHERE status = 'pending_approval' 
          AND (ai_screener_status = 'pending' OR (ai_screener_status = 'error' AND ai_attempts < 3))
        ORDER BY id ASC
        LIMIT 20
        FOR UPDATE SKIP LOCKED
    ");

    $leads = [];
    $ids = [];
    while ($row = $res->fetch_assoc()) {
        $leads[] = $row;
        $ids[] = (int) $row['id'];
    }

    if (empty($leads)) {
        $conn->commit();
        @flock($fp, LOCK_UN);
        @fclose($fp);
        echo "[" . date('Y-m-d H:i:s') . "] No pending AI screening leads.\n";
        return;
    }

    // Đánh dấu trạng thái 'screening' ngay trong transaction để tránh bị tranh chấp khi commit sớm
    $idsStr = implode(',', $ids);
    $conn->query("UPDATE leads SET ai_screener_status = 'screening', ai_screening_started_at = NOW() WHERE id IN ($idsStr)");
    $conn->commit();

    echo "[" . date('Y-m-d H:i:s') . "] Found " . count($leads) . " leads for AI screening. Processing...\n";

    // 2. Xử lý từng Lead
    foreach ($leads as $lead) {
        $leadId = (int) $lead['id'];
        $targetRoundId = (int) $lead['target_round_id'];
        $attempts = (int) $lead['ai_attempts'] + 1;

        echo "[" . date('Y-m-d H:i:s') . "] Processing Lead ID: $leadId (Attempt $attempts/3)...\n";

        // Tăng số lần thử trước khi gọi API đề phòng bị crash giữa chừng
        $updAttempts = $conn->prepare("UPDATE leads SET ai_attempts = ? WHERE id = ?");
        if ($updAttempts) {
            $updAttempts->bind_param("ii", $attempts, $leadId);
            $updAttempts->execute();
            $updAttempts->close();
        }

        // Kéo cấu hình quy tắc AI cho vòng xoay cụ thể của Lead
        $aiRules = null;
        $belowStandardFallbackEnabled = 0;
        $belowStandardAutoApprove = 0;
        $belowStandardFallbackRoundId = 0;

        $configsJson = get_system_setting($conn, 'ai_screener_configs');
        $configs = json_decode($configsJson, true);
        if (is_array($configs) && !empty($configs)) {
            foreach ($configs as $config) {
                $rounds = $config['rounds'] ?? [];
                $normalizedRounds = array_map('intval', $rounds);
                if (in_array($targetRoundId, $normalizedRounds)) {
                    $aiRules = $config['ai_rules'] ?? null;
                    $belowStandardFallbackEnabled = !empty($config['below_standard_fallback_enabled']) ? 1 : 0;
                    $belowStandardAutoApprove = !empty($config['below_standard_auto_approve']) ? 1 : 0;
                    $belowStandardFallbackRoundId = !empty($config['below_standard_fallback_round_id']) ? (int) $config['below_standard_fallback_round_id'] : 0;
                    break;
                }
            }
        }

        // Fallback cấu hình cũ
        if ($aiRules === null) {
            $aiRules = get_system_setting($conn, 'ai_screener_rules');
            $belowStandardFallbackEnabled = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_enabled');
            $belowStandardFallbackRoundId = (int) get_system_setting($conn, 'ai_screener_below_standard_fallback_round_id');
            $belowStandardAutoApprove = (int) get_system_setting($conn, 'ai_screener_below_standard_auto_approve');
        }

        // Tạo tham số leadData
        $leadData = [
            'phone' => $lead['phone'],
            'email' => $lead['email'],
            'name' => $lead['name'],
            'source' => $lead['source'],
            'type' => $lead['type'],
            'note' => $lead['note'],
            'connection_id' => $lead['connection_id']
        ];

        // Gọi API thực tế thông qua hàm cũ đã tối ưu sẵn trong webhook_logic.php
        // Hàm runAIScreener() sử dụng cURL và đã được cấu hình timeout
        $aiResult = runAIScreener($conn, $leadData, $aiRules);

        echo "[" . date('Y-m-d H:i:s') . "] Lead ID $leadId AI status: " . $aiResult['status'] . ", Reason: " . ($aiResult['reason'] ?? '') . "\n";

        if ($aiResult['status'] === 'passed') {
            // 2.1. Đạt chuẩn AI -> Phân bổ số
            distributeLeadAfterAI($conn, $leadId, $targetRoundId, $aiResult, $leadData);
        } else if ($aiResult['status'] === 'failed') {
            // 2.2. Dưới chuẩn AI -> Kiểm tra cấu hình auto-approve vòng fallback
            if ($belowStandardFallbackEnabled === 1 && $belowStandardAutoApprove === 1 && $belowStandardFallbackRoundId > 0) {
                echo "[" . date('Y-m-d H:i:s') . "] Lead ID $leadId failed AI but auto-approving to Fallback Round ID: $belowStandardFallbackRoundId\n";
                $aiResult['reason'] = "[Auto-Approve Fallback] " . $aiResult['reason'];
                distributeLeadAfterAI($conn, $leadId, $belowStandardFallbackRoundId, $aiResult, $leadData);
            } else {
                // Tạm giữ cho Admin duyệt tay
                $conn->begin_transaction();
                try {
                    $updHeld = $conn->prepare("UPDATE leads SET status = 'pending_approval', ai_screener_status = 'failed', ai_evaluation = ?, ai_prompt_tokens = ?, ai_completion_tokens = ?, ai_total_tokens = ? WHERE id = ?");
                    $promptT = isset($aiResult['prompt_tokens']) ? (int) $aiResult['prompt_tokens'] : 0;
                    $completionT = isset($aiResult['completion_tokens']) ? (int) $aiResult['completion_tokens'] : 0;
                    $totalT = isset($aiResult['total_tokens']) ? (int) $aiResult['total_tokens'] : 0;
                    $updHeld->bind_param("siiii", $aiResult['reason'], $promptT, $completionT, $totalT, $leadId);
                    $updHeld->execute();
                    $updHeld->close();

                    $logMsg = 'Tạm giữ bởi AI (Chạy ngầm): ' . $aiResult['reason'];
                    $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
                    $chkLog->bind_param("i", $leadId);
                    $chkLog->execute();
                    $logRow = $chkLog->get_result()->fetch_assoc();
                    $chkLog->close();

                    if ($logRow) {
                        $updLog = $conn->prepare("UPDATE distribution_logs SET message = ?, received_at = NOW() WHERE id = ?");
                        $updLog->bind_param("si", $logMsg, $logRow['id']);
                        $updLog->execute();
                        $updLog->close();
                    } else {
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', $logMsg, false);
                    }
                    $conn->commit();

                    // Đồng bộ live Sheet ngược về
                    triggerTwoWaySync($conn, $leadId);
                } catch (Exception $e) {
                    $conn->rollback();
                    error_log("Failed to update failed AI lead: " . $e->getMessage());
                }

                // Gửi thông báo cho admin duyệt tay
                try {
                    $roundName = '';
                    if ($targetRoundId) {
                        $rStmt = $conn->prepare("SELECT round_name FROM distribution_rounds WHERE id = ?");
                        if ($rStmt) {
                            $rStmt->bind_param("i", $targetRoundId);
                            $rStmt->execute();
                            $roundName = $rStmt->get_result()->fetch_assoc()['round_name'] ?? '';
                            $rStmt->close();
                        }
                    }
                    sendHeldLeadNotifications(
                        $conn,
                        $leadId,
                        $leadData['name'],
                        $leadData['phone'],
                        $aiResult['reason'],
                        $roundName,
                        $leadData['email'],
                        $leadData['source'],
                        $leadData['type'],
                        $leadData['note']
                    );
                } catch (Exception $ex) {
                    error_log("Failed to send held notification: " . $ex->getMessage());
                }
            }
        } else {
            // 2.3. Lỗi kết nối / Quá tải API (status === 'error')
            $conn->begin_transaction();
            try {
                $updHeld = $conn->prepare("UPDATE leads SET ai_screener_status = 'error', ai_evaluation = ?, ai_prompt_tokens = ?, ai_completion_tokens = ?, ai_total_tokens = ? WHERE id = ?");
                $promptT = isset($aiResult['prompt_tokens']) ? (int) $aiResult['prompt_tokens'] : 0;
                $completionT = isset($aiResult['completion_tokens']) ? (int) $aiResult['completion_tokens'] : 0;
                $totalT = isset($aiResult['total_tokens']) ? (int) $aiResult['total_tokens'] : 0;
                $updHeld->bind_param("siiii", $aiResult['reason'], $promptT, $completionT, $totalT, $leadId);
                $updHeld->execute();
                $updHeld->close();

                if ($attempts >= 3) {
                    // Nếu đã thử 3 lần lỗi, ghi log phân bổ lỗi hệ thống để admin can thiệp
                    $logMsg = 'Lỗi kết nối AI (Đã thử 3 lần thất bại): ' . $aiResult['reason'];
                    $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
                    $chkLog->bind_param("i", $leadId);
                    $chkLog->execute();
                    $logRow = $chkLog->get_result()->fetch_assoc();
                    $chkLog->close();

                    if ($logRow) {
                        $updLog = $conn->prepare("UPDATE distribution_logs SET message = ?, received_at = NOW() WHERE id = ?");
                        $updLog->bind_param("si", $logMsg, $logRow['id']);
                        $updLog->execute();
                        $updLog->close();
                    } else {
                        logDistribution($conn, $leadId, null, $targetRoundId, 'pending_approval', $logMsg, false);
                    }
                }
                $conn->commit();

                // Đồng bộ live Sheet ngược về
                triggerTwoWaySync($conn, $leadId);
            } catch (Exception $e) {
                $conn->rollback();
                error_log("Failed to update error AI lead: " . $e->getMessage());
            }
        }
    }

    @flock($fp, LOCK_UN);
    @fclose($fp);
}

function distributeLeadAfterAI($conn, $leadId, $targetRoundId, $aiScreenerResult, $leadData)
{
    // Phân bổ Round-Robin
    $assignedConsultantId = null;
    $status = 'pending';
    $message = 'Không có tư vấn viên hoạt động trong vòng xoay.';

    // --- Check CRM (Duplication & dynamic threshold rule) ---
    $phone = $leadData['phone'] ?? '';
    $email = $leadData['email'] ?? '';
    $crmCheckResult = checkCRMInteraction($conn, $phone, $email, false, $leadId);

    // Load dynamic duplicate check threshold
    $dupCheckMonths = (int) get_system_setting($conn, 'duplicate_check_months');
    if ($dupCheckMonths <= 0) {
        $dupCheckMonths = 6;
    }

    $isDuplicate = false;
    if ($crmCheckResult['isDuplicate'] && !empty($crmCheckResult['assignedTo'])) {
        if (!empty($crmCheckResult['hasRealInteraction']) && $crmCheckResult['monthsSinceLastInteraction'] < $dupCheckMonths) {
            $isDuplicate = true;
        } else if (isset($crmCheckResult['isBeforeHoSo']) && !$crmCheckResult['isBeforeHoSo']) {
            $isDuplicate = true;
        }
    }
    if ($isDuplicate) {
        $assignedConsultantId = $crmCheckResult['assignedTo'];
        $status = 'reminder';
        $message = 'Khách cũ đăng ký lại < ' . $dupCheckMonths . ' tháng (Chạy ngầm).';
    }

    $dupSuffix = '';
    if ($crmCheckResult['isDuplicate']) {
        $oldSaleName = !empty($crmCheckResult['assignedName']) ? $crmCheckResult['assignedName'] : 'Không rõ';
        $oldSaleMonths = $crmCheckResult['monthsSinceLastInteraction'];
        $dupSuffix = " (Trùng số: Sale cũ $oldSaleName > $oldSaleMonths tháng).";
    }

    if ($isDuplicate) {
        // Skip Round-Robin, keep duplicate owner
    } else if ($targetRoundId) {
        $assignResult = getNextConsultantInRound($conn, $targetRoundId);
        if ($assignResult) {
            $assignedConsultantId = $assignResult['id'];
            $status = $assignResult['is_compensation'] ? 'compensation' : 'assigned';
            $message = $assignResult['is_compensation']
                ? (isset($assignResult['is_starvation']) ? 'Được phân bổ bù lượt ngoài giờ/nghỉ phép (Starvation Prevention) (Chạy ngầm).' : 'Được phân bổ đền bù lượt lỗi (Chạy ngầm).')
                : 'Được phân bổ tự động.';
            $message .= $dupSuffix;

            // Check working hours
            $whStart = '00:00';
            $whEnd = '23:59';
            $workSchedule = null;
            $whStmt = $conn->prepare("SELECT work_start_time, work_end_time, work_schedule FROM consultants WHERE id = ?");
            if ($whStmt) {
                $whStmt->bind_param("i", $assignedConsultantId);
                $whStmt->execute();
                $whRes = $whStmt->get_result();
                if ($whRes && $whRow = $whRes->fetch_assoc()) {
                    $whStart = $whRow['work_start_time'] ?? '00:00';
                    $whEnd = $whRow['work_end_time'] ?? '23:59';
                    $workSchedule = $whRow['work_schedule'] ?? null;
                }
                $whStmt->close();
            }
            $currentTime = date('H:i');
            if (!isConsultantInWorkHours($currentTime, $whStart, $whEnd, $workSchedule, $assignedConsultantId, $conn)) {
                $status = 'pending_work_hours';
                $message .= ' (Trì hoãn: ngoài khung giờ làm việc)';
                $assignedConsultantId = null;
            }
        } else {
            $message = 'Không có tư vấn viên hoạt động trong vòng xoay.' . $dupSuffix;
        }
    } else {
        $message = 'Không khớp vòng phân bổ hoặc vòng không hoạt động.' . $dupSuffix;
    }

    $conn->begin_transaction();
    try {
        $leadStatus = 'active';
        $updLead = $conn->prepare("UPDATE leads SET status = ?, assigned_to = ?, ai_screener_status = ?, ai_evaluation = ?, ai_prompt_tokens = ?, ai_completion_tokens = ?, ai_total_tokens = ?, is_accepted = IF(? > 0, 1, is_accepted), accepted_at = IF(? > 0, IFNULL(accepted_at, NOW()), accepted_at) WHERE id = ?");
        $aiStatus = $aiScreenerResult['status'];
        $aiEval = $aiScreenerResult['reason'];
        $promptT = isset($aiScreenerResult['prompt_tokens']) ? (int) $aiScreenerResult['prompt_tokens'] : 0;
        $completionT = isset($aiScreenerResult['completion_tokens']) ? (int) $aiScreenerResult['completion_tokens'] : 0;
        $totalT = isset($aiScreenerResult['total_tokens']) ? (int) $aiScreenerResult['total_tokens'] : 0;
        $updLead->bind_param("sisssiiiii", $leadStatus, $assignedConsultantId, $aiStatus, $aiEval, $promptT, $completionT, $totalT, $assignedConsultantId, $assignedConsultantId, $leadId);
        $updLead->execute();
        $updLead->close();

        // Append duplicate note if duplicate exists
        if ($crmCheckResult['isDuplicate']) {
            $prevName = $crmCheckResult['assignedName'] ?? 'Sale cũ';
            $prevDate = !empty($crmCheckResult['lastInteractionDate']) ? date('d/m/Y', strtotime($crmCheckResult['lastInteractionDate'])) : 'Không rõ';
            $dupMonths = $crmCheckResult['monthsSinceLastInteraction'] ?? $dupCheckMonths;
            $noteAppend = "\n[Lưu ý: Trùng số của $prevName trên $dupMonths tháng. Cập nhật lần cuối: $prevDate]";

            $conn->query("UPDATE leads SET note = CONCAT(IFNULL(note, ''), '" . $conn->real_escape_string($noteAppend) . "') WHERE id = " . (int) $leadId);
        }

        $chkLog = $conn->prepare("SELECT id FROM distribution_logs WHERE lead_id = ? AND status = 'pending_approval' LIMIT 1");
        $chkLog->bind_param("i", $leadId);
        $chkLog->execute();
        $logRow = $chkLog->get_result()->fetch_assoc();
        $chkLog->close();

        if ($logRow) {
            $updLog = $conn->prepare("UPDATE distribution_logs SET assigned_to = ?, round_id = ?, status = ?, message = ?, received_at = NOW() WHERE id = ?");
            $targetRoundVal = $targetRoundId > 0 ? $targetRoundId : null;
            $updLog->bind_param("iissi", $assignedConsultantId, $targetRoundVal, $status, $message, $logRow['id']);
            $updLog->execute();
            $updLog->close();
        } else {
            logDistribution($conn, $leadId, $assignedConsultantId, $targetRoundId, $status, $message, false);
        }

        if ($assignedConsultantId > 0) {
            ensurePersonAndContact($conn, $leadId);
        }

        $conn->commit();

        // Đồng bộ live Sheet ngược về
        triggerTwoWaySync($conn, $leadId);
    } catch (Exception $e) {
        $conn->rollback();
        error_log("Failed to distribute lead after AI: " . $e->getMessage());
        return false;
    }

    // Gửi thông báo cho sale (Chạy bất đồng bộ qua zalo_queue và mail_queue)
    try {
        if ($assignedConsultantId && $status !== 'pending_work_hours') {
            $stmt = $conn->prepare("SELECT name, email FROM consultants WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $assignedConsultantId);
                $stmt->execute();
                $cRes = $stmt->get_result();
                if ($cRes->num_rows > 0) {
                    $c = $cRes->fetch_assoc();

                    require_once __DIR__ . '/mailer.php';
                    require_once __DIR__ . '/zalo_bot.php';

                    $ccEmails = '';
                    $roundName = '';
                    if ($targetRoundId) {
                        $rStmt = $conn->prepare("SELECT round_name, cc_emails FROM distribution_rounds WHERE id = ?");
                        if ($rStmt) {
                            $rStmt->bind_param("i", $targetRoundId);
                            $rStmt->execute();
                            $rData = $rStmt->get_result()->fetch_assoc();
                            if ($rData) {
                                $roundName = $rData['round_name'] ?? '';
                                $ccEmails = $rData['cc_emails'] ?? '';
                            }
                            $rStmt->close();
                        }
                    }

                    if ($status === 'reminder') {
                        // Gửi email & zalo nhắc lại
                        try {
                            $timeline = getLeadHistoryTimeline($conn, $leadId, true);
                            sendLeadReminderEmailToSale(
                                $c['email'],
                                $c['name'],
                                $leadData['name'],
                                $leadData['phone'],
                                $leadData['note'],
                                $leadData['source'],
                                $ccEmails,
                                $roundName,
                                $timeline,
                                $leadId
                            );
                        } catch (Exception $mailEx) {
                            error_log("Error sending post-AI reminder email: " . $mailEx->getMessage());
                        }

                        try {
                            $timeline = getLeadHistoryTimeline($conn, $leadId, true);
                            sendLeadReminderZaloMessageToSale(
                                $assignedConsultantId,
                                $c['name'],
                                $leadData['name'],
                                $leadData['phone'],
                                $leadData['note'],
                                $leadData['source'],
                                $roundName,
                                $timeline,
                                $leadId,
                                $leadData['email'],
                                $leadData['type'],
                                false // sync = false to queue it!
                            );
                        } catch (Exception $zaloEx) {
                            error_log("Error sending post-AI reminder Zalo: " . $zaloEx->getMessage());
                        }
                    } else {
                        // Gửi email & zalo (mặc định sync = false để chèn vào hàng đợi)
                        try {
                            sendLeadAssignedEmailToSale(
                                $c['email'],
                                $c['name'],
                                $leadData['name'],
                                $leadData['phone'],
                                $leadData['note'],
                                $leadData['source'],
                                $ccEmails,
                                $roundName,
                                $leadId,
                                $assignedConsultantId,
                                $targetRoundId
                            );
                        } catch (Exception $mailEx) {
                            error_log("Error sending post-AI email: " . $mailEx->getMessage());
                        }

                        try {
                            sendLeadAssignedZaloMessageToSale(
                                $assignedConsultantId,
                                $c['name'],
                                $leadData['name'],
                                $leadData['phone'],
                                $leadData['note'],
                                $leadData['source'],
                                $roundName,
                                $leadId,
                                $targetRoundId,
                                $leadData['email'],
                                $leadData['type'],
                                false // sync = false to queue it!
                            );
                        } catch (Exception $zaloEx) {
                            error_log("Error sending post-AI Zalo: " . $zaloEx->getMessage());
                        }
                    }
                }
                $stmt->close();
            }
        }
    } catch (Exception $notifyEx) {
        error_log("Error in post-AI notifications: " . $notifyEx->getMessage());
    }

    return true;
}

/**
 * Proactive Event-Driven AI Agent Worker (WorkChat Bot Push)
 * Dispatches targeted briefings:
 * - 8h00 - 10h00: Morning Briefing for Sales (Stale Leads + Tuition Due)
 * - 11h30 - 13h00: Approval & SLA Alert for Managers/Approvers (Pending POs/Expenses/Leaves + Breached Tickets)
 * - 17h00 - 19h00: Evening Wrap-up for Staff (Pending Tasks due today)
 */
function runProactiveAgentBriefingWorker($conn) {
    if (!($conn instanceof mysqli)) return;

    date_default_timezone_set('Asia/Ho_Chi_Minh');
    $currentHour = (int)date('G');

    // 1. Determine active slot
    $slot = null;
    if ($currentHour >= 8 && $currentHour < 10) {
        $slot = 'morning';
    } elseif ($currentHour >= 11 && $currentHour < 13) {
        $slot = 'midday';
    } elseif ($currentHour >= 17 && $currentHour < 19) {
        $slot = 'evening';
    }

    if (!$slot) {
        return; // Outside briefing hours
    }

    // Helper: Find or create direct conversation with Bot (9000001)
    $getOrCreateBotConv = function($userId, $tenantId = 1) use ($conn) {
        $stmt = $conn->prepare("
            SELECT c.id 
            FROM chat_conversations c
            JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = ?
            JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id = 9000001
            WHERE (c.tenant_id = ? OR c.tenant_id = 1) AND c.type = 'direct'
            LIMIT 1
        ");
        $stmt->bind_param("ii", $userId, $tenantId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();

        if ($row && !empty($row['id'])) {
            return (int)$row['id'];
        }

        // Create new direct conversation
        try {
            $conn->begin_transaction();
            $cStmt = $conn->prepare("
                INSERT INTO chat_conversations (tenant_id, type, title, avatar_url, created_by, last_message_at, created_at, updated_at)
                VALUES (?, 'direct', 'SI IDEAS', '/stickers/ideas/ideas_3.webp', 9000001, NOW(), NOW(), NOW())
            ");
            $cStmt->bind_param("i", $tenantId);
            $cStmt->execute();
            $convId = $conn->insert_id;
            $cStmt->close();

            $p1 = $conn->prepare("INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role, is_pinned, joined_at) VALUES (?, ?, ?, 'member', 1, NOW())");
            $p1->bind_param("iii", $tenantId, $convId, $userId);
            $p1->execute();
            $p1->close();

            $p2 = $conn->prepare("INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role, is_pinned, joined_at) VALUES (?, ?, 9000001, 'owner', 0, NOW())");
            $p2->bind_param("ii", $tenantId, $convId);
            $p2->execute();
            $p2->close();

            $conn->commit();
            return (int)$convId;
        } catch (\Throwable $e) {
            $conn->rollback();
            error_log("Error in getOrCreateBotConv: " . $e->getMessage());
            return 0;
        }
    };

    // Helper: Send briefing message to conversation if not already sent today
    $sendBriefingIfNotSent = function($convId, $userId, $tenantId, $slotName, $text) use ($conn) {
        if ($convId <= 0) return false;

        $slotTag = "\"briefing_slot\":\"{$slotName}\"";
        $checkStmt = $conn->prepare("
            SELECT COUNT(1) FROM chat_messages 
            WHERE conversation_id = ? AND sender_id = 9000001 
              AND metadata LIKE ? AND DATE(created_at) = CURDATE()
        ");
        $likeTag = "%" . $slotTag . "%";
        $checkStmt->bind_param("is", $convId, $likeTag);
        $checkStmt->execute();
        $alreadySent = (int)$checkStmt->get_result()->fetch_row()[0];
        $checkStmt->close();

        if ($alreadySent > 0) {
            return false; // Already notified today
        }

        $metaJson = json_encode(['briefing_slot' => $slotName, 'proactive' => true, 'date' => date('Y-m-d')]);
        $ins = $conn->prepare("
            INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, metadata, created_at)
            VALUES (?, ?, 9000001, 'text', ?, ?, NOW())
        ");
        $ins->bind_param("iiss", $tenantId, $convId, $text, $metaJson);
        $ins->execute();
        $msgId = $conn->insert_id;
        $ins->close();

        $upd = $conn->prepare("UPDATE chat_conversations SET last_message_id = ?, last_message_at = NOW() WHERE id = ?");
        $upd->bind_param("ii", $msgId, $convId);
        $upd->execute();
        $upd->close();

        return true;
    };

    // Slot 1: Morning Briefing (8h00 - 10h00)
    if ($slot === 'morning') {
        $uRes = $conn->query("SELECT id, full_name, tenant_id FROM users WHERE is_active = 1 AND role IN ('sale', 'sales', 'consultant', 'admin', 'manager')");
        if ($uRes) {
            $users = $uRes->fetch_all(MYSQLI_ASSOC);
            $uRes->close();
            foreach ($users as $u) {
                $uId = (int)$u['id'];
                $tId = (int)($u['tenant_id'] ?: 1);
                $uName = $u['full_name'] ?: 'bạn';

                // Count stale leads for this user (no note in >= 3 days)
                $sRes = $conn->query("
                    SELECT COUNT(1) FROM contacts c
                    LEFT JOIN (SELECT entity_id, MAX(created_at) as last_n FROM notes WHERE entity_type = 'contact' GROUP BY entity_id) n ON c.id = n.entity_id
                    WHERE c.owner_id = {$uId} AND c.deleted_at IS NULL AND (c.stage_id < 14 OR c.stage_id IS NULL)
                      AND DATEDIFF(NOW(), COALESCE(n.last_n, c.created_at)) >= 3
                ");
                $staleCount = $sRes ? (int)$sRes->fetch_row()[0] : 0;

                // Count unpaid sales orders
                $soRes = $conn->query("
                    SELECT COUNT(1), COALESCE(SUM(so.total - COALESCE(so.paid_amount, 0)), 0) 
                    FROM sales_orders so
                    LEFT JOIN contacts c ON so.contact_id = c.id
                    WHERE (c.owner_id = {$uId} OR so.created_by = {$uId}) AND so.status != 'cancelled' AND so.payment_status != 'paid' AND (so.total - COALESCE(so.paid_amount, 0)) > 0
                ");
                $soRow = $soRes ? $soRes->fetch_row() : [0, 0];
                $unpaidSoCount = (int)$soRow[0];
                $debtAmt = (float)$soRow[1];

                if ($staleCount > 0 || $unpaidSoCount > 0) {
                    $cId = $getOrCreateBotConv($uId, $tId);
                    $debtFormatted = number_format($debtAmt, 0, ',', '.') . ' VND';
                    $msg = "🌅 **[BẢN TIN SÁNG TỪ SI IDEAS]**\n"
                         . "Chào **{$uName}**, chúc bạn một ngày mới tràn đầy năng lượng!\n\n"
                         . "📊 **Điểm tin công việc sáng nay của bạn:**\n";
                    if ($staleCount > 0) {
                        $msg .= "• Có **{$staleCount} cơ hội học viên tiềm năng** bị gián đoạn tương tác trên 3 ngày. Bạn nhớ gọi điện/nhắn Zalo chăm sóc ngay nhé!\n";
                    }
                    if ($unpaidSoCount > 0) {
                        $msg .= "• Có **{$unpaidSoCount} đơn hàng/học phí** còn nợ đợt tiếp theo (tổng nợ: **{$debtFormatted}**). Hãy đôn đốc học viên đóng đúng hạn nhé!\n";
                    }
                    $msg .= "\n💡 *Bạn có thể nhắn cho mình bất cứ lúc nào để tra cứu sâu hồ sơ khách hàng hoặc nhờ mình soạn đề xuất nhé!*";

                    $sendBriefingIfNotSent($cId, $uId, $tId, 'morning', $msg);
                }
            }
        }
    }

    // Slot 2: Midday Approval & SLA Alert (11h30 - 13h00)
    elseif ($slot === 'midday') {
        $mRes = $conn->query("SELECT id, full_name, tenant_id FROM users WHERE is_active = 1 AND role IN ('admin', 'superadmin', 'director', 'manager', 'accountant')");
        if ($mRes) {
            $managers = $mRes->fetch_all(MYSQLI_ASSOC);
            $mRes->close();
            foreach ($managers as $m) {
                $mId = (int)$m['id'];
                $tId = (int)($m['tenant_id'] ?: 1);
                $mName = $m['full_name'] ?: 'Sếp';

                // Count pending expenses waiting for this manager
                $eRes = $conn->query("
                    SELECT COUNT(1) FROM expenses 
                    WHERE status = 'pending' AND deleted_at IS NULL 
                      AND (approver_id = {$mId} OR approver_id_2 = {$mId} OR approver_id_3 = {$mId})
                ");
                $expCount = $eRes ? (int)$eRes->fetch_row()[0] : 0;

                // Count breached tickets
                $tRes = $conn->query("
                    SELECT COUNT(1) FROM tickets 
                    WHERE status IN ('open', 'in_progress', 'waiting') 
                      AND ((priority = 'urgent' AND TIMESTAMPDIFF(HOUR, created_at, NOW()) > 12)
                        OR (priority = 'high' AND TIMESTAMPDIFF(HOUR, created_at, NOW()) > 24)
                        OR (TIMESTAMPDIFF(HOUR, created_at, NOW()) > 48))
                ");
                $breachedCount = $tRes ? (int)$tRes->fetch_row()[0] : 0;

                if ($expCount > 0 || $breachedCount > 0) {
                    $cId = $getOrCreateBotConv($mId, $tId);
                    $msg = "⏰ **[ĐIỂM NGHẼN PHÊ DUYỆT & DỊCH VỤ TRƯA]**\n"
                         . "Kính gửi **{$mName}**,\n\n"
                         . "Trước giờ nghỉ trưa, hệ thống phát hiện một số đầu việc cần được tháo gỡ:\n";
                    if ($expCount > 0) {
                        $msg .= "• Có **{$expCount} đề xuất chi tiêu / tạm ứng** đang chờ phê duyệt từ bạn.\n";
                    }
                    if ($breachedCount > 0) {
                        $msg .= "• Có **{$breachedCount} ticket khiếu nại học viên** đã vượt hạn cam kết SLA cần được chỉ đạo giải quyết.\n";
                    }
                    $msg .= "\n👉 *Nhờ {$mName} dành ít phút vào phê duyệt để các phòng ban kịp thời triển khai công việc buổi chiều ạ!*";

                    $sendBriefingIfNotSent($cId, $mId, $tId, 'midday', $msg);
                }
            }
        }
    }

    // Slot 3: Evening Wrap-up (17h00 - 19h00)
    elseif ($slot === 'evening') {
        $uRes = $conn->query("SELECT id, full_name, tenant_id FROM users WHERE is_active = 1");
        if ($uRes) {
            $staffList = $uRes->fetch_all(MYSQLI_ASSOC);
            $uRes->close();
            foreach ($staffList as $u) {
                $uId = (int)$u['id'];
                $tId = (int)($u['tenant_id'] ?: 1);
                $uName = $u['full_name'] ?: 'bạn';

                // Count tasks due today or overdue
                $tRes = $conn->query("
                    SELECT COUNT(1) FROM activities 
                    WHERE user_id = {$uId} AND deleted_at IS NULL 
                      AND (status IS NULL OR status NOT IN ('completed', 'done', 'hoan_thanh', 'cancelled'))
                      AND due_date IS NOT NULL AND due_date <= NOW()
                ");
                $dueTaskCount = $tRes ? (int)$tRes->fetch_row()[0] : 0;

                if ($dueTaskCount > 0) {
                    $cId = $getOrCreateBotConv($uId, $tId);
                    $msg = "🌇 **[TỔNG KẾT NGÀY LÀM VIỆC TỪ SI IDEAS]**\n"
                         . "Chào **{$uName}**, một ngày làm việc sắp khép lại!\n\n"
                         . "📋 Hệ thống ghi nhận bạn còn **{$dueTaskCount} công việc** đến hạn hôm nay chưa bấm hoàn thành.\n"
                         . "Bạn hãy kiểm tra lại Bàn làm việc để cập nhật tiến độ công việc và đừng quên điểm danh chấm công ra về nhé! 🎉";

                    $sendBriefingIfNotSent($cId, $uId, $tId, 'evening', $msg);
                }
            }
        }
    }
}

// Chạy trực tiếp nếu từ CLI hoặc cron
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runAIScreenerWorker($conn);
    runProactiveAgentBriefingWorker($conn);
}
