<?php
// backend/NotificationService.php

class NotificationService {

    /**
     * Dispatch notification across all 4 independent channels (In-App Bell, Zalo Bot, Telegram Bot, Email)
     * 
     * @param PDO $db
     * @param int $tenantId
     * @param string $eventType e.g. 'CHECKIN_LATE', 'ATTENDANCE_UPDATE', 'ATTENDANCE_APPROVAL', 'EXPENSE_REQUEST', 'TICKET_NEW'
     * @param array $payload Event specific details
     */
    public static function send(PDO $db, int $tenantId, string $eventType, array $payload): void {
        try {
            $GLOBALS['pdo'] = $db;
            $resolved = self::resolveEventData($db, $tenantId, $eventType, $payload);
            if (!$resolved) {
                return;
            }

            $recipients = $resolved['recipients'] ?? [];
            $excludeUserId = (int)($payload['exclude_user_id'] ?? $payload['actor_id'] ?? $payload['current_user_id'] ?? 0);
            if ($excludeUserId > 0 && !empty($recipients)) {
                $recipients = array_values(array_filter($recipients, function($r) use ($excludeUserId) {
                    return (int)($r['id'] ?? 0) !== $excludeUserId;
                }));
            }
            if (empty($recipients) && empty($resolved['force_broadcast'])) {
                return;
            }
            $title = $resolved['title'] ?? 'Thông báo hệ thống';
            $body = $resolved['body'] ?? '';
            $type = $resolved['type'] ?? 'attendance';
            $link = $resolved['link'] ?? '/';
            $zaloMsg = $resolved['zalo_msg'] ?? '';
            $tgMsg = $resolved['tg_msg'] ?? '';
            $emailSubject = $resolved['email_subject'] ?? '';
            $emailTitle = $resolved['email_title'] ?? '';
            $emailContent = $resolved['email_content'] ?? '';

            // Fetch recipients' matrix configurations from database
            $recipientIds = array_filter(array_map(fn($r) => (int)($r['id'] ?? 0), $recipients));
            $userConfigs = [];
            if (!empty($recipientIds)) {
                try {
                    $inPlace = implode(',', array_fill(0, count($recipientIds), '?'));
                    $stmtCfg = $db->prepare("SELECT user_id, matrix_config FROM user_notification_settings WHERE user_id IN ($inPlace)");
                    $stmtCfg->execute(array_values($recipientIds));
                    while ($cRow = $stmtCfg->fetch(PDO::FETCH_ASSOC)) {
                        if (!empty($cRow['matrix_config'])) {
                            $userConfigs[(int)$cRow['user_id']] = json_decode($cRow['matrix_config'], true);
                        }
                    }
                } catch (\Throwable $cfgEx) {}
            }

            // Helper lambda to check if a specific channel is enabled for a user for this eventType
            $isChannelEnabled = function(int $userId, string $channel) use ($userConfigs, $eventType): bool {
                if ($channel === 'bell') {
                    if (!isset($userConfigs[$userId][$eventType])) return true;
                    $evtCfg = $userConfigs[$userId][$eventType];
                    if (isset($evtCfg['master']) && !$evtCfg['master']) return false;
                    return !isset($evtCfg['bell']) || (bool)$evtCfg['bell'];
                }
                if (!isset($userConfigs[$userId][$eventType])) {
                    return true; // Default behavior: Enabled
                }
                $evtCfg = $userConfigs[$userId][$eventType];
                if (isset($evtCfg['master']) && !$evtCfg['master']) {
                    return false; // Master switch OFF for this event
                }
                if (isset($evtCfg[$channel])) {
                    return (bool)$evtCfg[$channel];
                }
                return true;
            };

            // ==================== CHANNEL 1: IN-APP NOTIFICATION BELL ====================
            try {
                if (!empty($recipients)) {
                    $insertNotif = $db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
                    ");
                    $insertedUserIds = [];
                    foreach ($recipients as $rec) {
                        $rId = (int)($rec['id'] ?? 0);
                        if ($rId > 0 && !in_array($rId, $insertedUserIds, true) && $isChannelEnabled($rId, 'bell')) {
                            $insertedUserIds[] = $rId;
                            $insertNotif->execute([$rId, $tenantId, $title, $body, $type, $link]);
                        }
                    }
                }
            } catch (\Throwable $bellEx) {
                error_log("NotificationService Bell Error: " . $bellEx->getMessage());
            }

            // Fetch system settings for Zalo and Telegram group configuration
            $stmtGSettings = $db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('zalo_admin_group_chat_id', 'zalo_notify_only_group', 'telegram_admin_group_chat_id', 'telegram_notify_only_group', 'zalo_bot_token', 'telegram_bot_token')");
            $stmtGSettings->execute();
            $gSettings = $stmtGSettings->fetchAll(PDO::FETCH_KEY_PAIR);

            $zaloBotToken = trim((string)($gSettings['zalo_bot_token'] ?? ''));
            $zaloGroupChatId = trim((string)($gSettings['zalo_admin_group_chat_id'] ?? ''));
            $zaloOnlyGroup = ($gSettings['zalo_notify_only_group'] ?? '0') === '1';

            $tgBotToken = trim((string)($gSettings['telegram_bot_token'] ?? ''));
            $tgGroupChatId = trim((string)($gSettings['telegram_admin_group_chat_id'] ?? ''));
            $tgOnlyGroup = ($gSettings['telegram_notify_only_group'] ?? '0') === '1';

            // If in test mode, do not blast real external network messages (Zalo, Telegram, Email)
            if (getenv('MYERP_TEST_MODE') === '1' || defined('MYERP_TEST_MODE') || !empty($payload['is_test'])) {
                return;
            }

            $isAdminBroadcastEvent = in_array($eventType, [
                'HOLIDAY_REGISTRATION_OPENED', 'HOLIDAY_UPDATE', 'HOLIDAY_RETURN_REMINDER', 'SYSTEM_ANNOUNCEMENT'
            ], true);

            // Defer heavy external network dispatches (Zalo, Telegram, Email) to shutdown function so API responds instantly to user UI!
            register_shutdown_function(function() use (
                $zaloBotToken, $zaloMsg, $zaloGroupChatId, $zaloOnlyGroup, $isAdminBroadcastEvent,
                $tgBotToken, $tgMsg, $tgGroupChatId, $tgOnlyGroup,
                $emailSubject, $emailTitle, $emailContent,
                $recipients, $isChannelEnabled, $eventType
            ) {
                if (function_exists('fastcgi_finish_request')) {
                    @fastcgi_finish_request();
                }

                // Recreate database connection inside shutdown function using global configuration variables
                global $servername, $username, $password, $dbname;
                if (!empty($servername) && !empty($username)) {
                    try {
                        $shutdownDb = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password, [
                            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
                        ]);
                        $GLOBALS['pdo'] = $shutdownDb;
                    } catch (\Throwable $dbEx) {
                        error_log("NotificationService Shutdown Reconnection Error: " . $dbEx->getMessage());
                    }
                }

                // ==================== CHANNEL 2: ZALO BOT (INDEPENDENT) ====================
                try {
                    if ($zaloBotToken && !empty($zaloMsg)) {
                        require_once __DIR__ . '/zalo_bot.php';

                        $zaloChatIds = [];
                        // 1. Group Admin Zalo: TUYỆT ĐỐI CHỈ gửi tới group Zalo các sự kiện liên quan đến Lead / Data
                        $isLeadEvent = in_array($eventType, ['LEAD_ASSIGNMENT', 'LEAD_NEW', 'NEW_LEAD', 'LEAD_REASSIGN', 'LEAD_RECALL', 'TICKET_LEAD', 'TICKET_NEW', 'TICKET_APPROVED', 'TICKET_REJECTED'], true);
                        if (!empty($zaloGroupChatId) && $isAdminBroadcastEvent && $isLeadEvent) {
                            $zaloChatIds[] = $zaloGroupChatId;
                        }

                        // 2. Personal Zalo: Hiện tại CHỈ gửi cho Sale khi có Lead tới / Giao Lead (không gửi Zalo cá nhân cho các sự kiện ngoài Lead)
                        $isLeadEvent = in_array($eventType, ['LEAD_ASSIGNMENT', 'LEAD_NEW', 'NEW_LEAD', 'LEAD_REASSIGN'], true);
                        if ($isLeadEvent && (!$zaloOnlyGroup || !$isAdminBroadcastEvent)) {
                            foreach ($recipients as $rec) {
                                $rId = (int)($rec['id'] ?? 0);
                                $role = strtolower((string)($rec['role'] ?? ''));
                                $isSale = in_array($role, ['sale', 'sales'], true) || !empty($rec['is_consultant']);
                                if ($isSale && !empty($rec['zalo_chat_id']) && $isChannelEnabled($rId, 'zalo')) {
                                    $zaloChatIds[] = trim($rec['zalo_chat_id']);
                                }
                            }
                        }
                        $zaloChatIds = array_unique(array_filter($zaloChatIds));

                        foreach ($zaloChatIds as $zId) {
                            try {
                                sendZaloMessage($zaloBotToken, $zId, $zaloMsg, false);
                            } catch (\Throwable $ze) {
                                error_log("NotificationService Zalo send error ($zId): " . $ze->getMessage());
                            }
                        }
                    }
                } catch (\Throwable $zEx) {
                    error_log("NotificationService Zalo Channel Error: " . $zEx->getMessage());
                }

                // ==================== CHANNEL 3: TELEGRAM BOT (INDEPENDENT) ====================
                try {
                    if ($tgBotToken && !empty($tgMsg)) {
                        require_once __DIR__ . '/telegram_bot.php';

                        $tgChatIds = [];
                        if (!empty($tgGroupChatId) && $isAdminBroadcastEvent) {
                            $tgChatIds[] = $tgGroupChatId;
                        }
                        if (!$tgOnlyGroup || !$isAdminBroadcastEvent) {
                            foreach ($recipients as $rec) {
                                $rId = (int)($rec['id'] ?? 0);
                                if (!empty($rec['telegram_chat_id']) && $isChannelEnabled($rId, 'telegram')) {
                                    $tgChatIds[] = trim($rec['telegram_chat_id']);
                                }
                            }
                        }
                        $tgChatIds = array_unique(array_filter($tgChatIds));

                        foreach ($tgChatIds as $cId) {
                            try {
                                sendTelegramMessage($tgBotToken, $cId, $tgMsg, false);
                            } catch (\Throwable $tge) {
                                error_log("NotificationService Telegram send error ($cId): " . $tge->getMessage());
                            }
                        }
                    }
                } catch (\Throwable $tgEx) {
                    error_log("NotificationService Telegram Channel Error: " . $tgEx->getMessage());
                }

                // ==================== CHANNEL 4: EMAIL SMTP (INDEPENDENT VIA MAIL QUEUE) ====================
                try {
                    if (!empty($emailSubject) && !empty($emailContent)) {
                        require_once __DIR__ . '/mailer.php';
                        foreach ($recipients as $rec) {
                            $rId = (int)($rec['id'] ?? 0);
                            if (!empty($rec['email']) && $isChannelEnabled($rId, 'email')) {
                                try {
                                    sendEmailNotification($rec['email'], $emailSubject, $emailTitle, $emailContent, '', false, false);
                                } catch (\Throwable $ee) {
                                    error_log("NotificationService Email send error (" . $rec['email'] . "): " . $ee->getMessage());
                                }
                            }
                        }
                    }
                } catch (\Throwable $emEx) {
                    error_log("NotificationService Email Channel Error: " . $emEx->getMessage());
                }
            });

        } catch (\Throwable $outerEx) {
            error_log("NotificationService Global Dispatch Error: " . $outerEx->getMessage());
        }
    }

    /**
     * Resolve event templates and recipient accounts
     */
    private static function resolveEventData(PDO $db, int $tenantId, string $eventType, array $payload): ?array {
        $userName = $payload['user_name'] ?? 'Nhân viên';
        $today = $payload['date'] ?? date('Y-m-d');
        $time = $payload['time'] ?? date('H:i');
        $reason = $payload['reason'] ?? 'Không có';

        switch ($eventType) {
            case 'CHECKIN_LATE':
                $recipients = self::getAdminsAndManagers($db, $tenantId, $payload['team_id'] ?? null);
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu duyệt đi trễ",
                    'body' => "Nhân viên " . $userName . " đã check-in trễ lúc " . substr($time, 0, 5) . " và gửi lý do: \"" . $reason . "\"",
                    'type' => "attendance",
                    'link' => "/attendance?view=calendar&date=" . $today,
                    'zalo_msg' => "⏰ [ YÊU CẦU DUYỆT ĐI TRỄ ]\n\n"
                        . "Nhân viên $userName vừa báo cáo đi trễ ngày $today:\n"
                        . "  • Tên NV: $userName\n"
                        . "  • Thời gian: " . substr($time, 0, 5) . "\n"
                        . "  • Lý do: \"$reason\"\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "⏰ <b>[ YÊU CẦU DUYỆT ĐI TRỄ ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa báo cáo đi trễ ngày <code>$today</code>:\n"
                        . "  • Tên NV: <b>$userName</b>\n"
                        . "  • Thời gian: <code>" . substr($time, 0, 5) . "</code>\n"
                        . "  • Lý do: <i>\"$reason\"</i>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[IDEAS] Yêu cầu phê duyệt đi trễ - NV $userName",
                    'email_title' => "DUYỆT YÊU CẦU ĐI TRỄ",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa check-in trễ giờ quy định lúc " . substr($time, 0, 5) . " ngày $today.<br/>" .
                                    "Lý do đi trễ: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'ATTENDANCE_UPDATE':
                $recipients = self::getAdminsAndManagers($db, $tenantId, $payload['team_id'] ?? null);
                $isBulk = !empty($payload['is_bulk']);
                $bulkLink = $isBulk && !empty($payload['ref_id']) 
                    ? "/approvals?open_id=" . $payload['ref_id'] . "&open_type=attendance_bulk" 
                    : "/attendance?view=calendar&date=" . $today;
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu cập nhật công",
                    'body' => "Nhân viên " . $userName . " vừa gửi Yêu cầu cập nhật công bổ sung ngày " . $today . " lúc " . substr($time, 0, 5) . " với lý do: \"" . $reason . "\"",
                    'type' => "attendance_update",
                    'link' => $bulkLink,
                    'zalo_msg' => "🔄 [ YÊU CẦU CẬP NHẬT CÔNG ]\n\n"
                        . "Nhân viên $userName vừa gửi Yêu cầu cập nhật công ngày $today:\n"
                        . "  • Tên NV: $userName\n"
                        . "  • Giờ đề xuất: " . substr($time, 0, 5) . "\n"
                        . "  • Lý do: \"$reason\"\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "🔄 <b>[ YÊU CẦU CẬP NHẬT CÔNG ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa gửi Yêu cầu cập nhật công ngày <code>$today</code>:\n"
                        . "  • Tên NV: <b>$userName</b>\n"
                        . "  • Giờ đề xuất: <code>" . substr($time, 0, 5) . "</code>\n"
                        . "  • Lý do: <i>\"$reason\"</i>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[IDEAS] Yêu cầu cập nhật công - NV $userName",
                    'email_title' => "YÊU CẦU CẬP NHẬT CÔNG",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa gửi Yêu cầu cập nhật công bổ sung ngày $today lúc " . substr($time, 0, 5) . ".<br/>" .
                                    "Lý do: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'APPROVAL_REMINDER':
                $recipients = $payload['recipients'] ?? [];
                $msg = $payload['message'] ?? 'Có đề xuất đang chờ bạn phê duyệt!';
                $senderName = $payload['sender_name'] ?? 'Đồng nghiệp';
                $itemTitle = $payload['item_title'] ?? 'đề xuất';
                $itemId = $payload['item_id'] ?? 0;
                $itemType = $payload['item_type'] ?? '';

                return [
                    'recipients' => $recipients,
                    'title' => "Nhắc nhở phê duyệt: " . $itemTitle,
                    'body' => "Nhân sự {$senderName} vừa gửi lời nhắc nhở: \"{$msg}\"",
                    'type' => "approval",
                    'link' => "/approvals?open_id={$itemId}&open_type={$itemType}",
                    'zalo_msg' => "🔔 [ NHẮC NHỞ PHÊ DUYỆT ĐƠN ]\n\nNhân sự $senderName gửi lời nhắc phê duyệt đơn: \"$itemTitle\"\nNội dung: \"$msg\"",
                    'tg_msg' => "🔔 <b>[ NHẮC NHỞ PHÊ DUYỆT ĐƠN ]</b>\n\nNhân sự <b>$senderName</b> gửi lời nhắc phê duyệt đơn: <i>\"$itemTitle\"</i>\nNội dung: <i>\"$msg\"</i>",
                    'email_subject' => "[IDEAS] Nhắc nhở phê duyệt đơn - $itemTitle",
                    'email_title' => "NHẮC NHỞ PHÊ DUYỆT ĐƠN",
                    'email_content' => "Nhân sự <strong>$senderName</strong> vừa gửi lời nhắc nhở phê duyệt đơn: <strong>$itemTitle</strong>.<br/><br/>Nội dung: <em>\"$msg\"</em>"
                ];

            case 'ATTENDANCE_APPROVAL_RESULT':
                $status = $payload['status'] ?? 'approved';
                $isSupplementary = !empty($payload['is_supplementary']);
                $statusText = $status === 'approved' ? "chấp thuận" : ($status === 'rejected' ? "từ chối" : "cập nhật thành chờ duyệt");

                $recipients = [];
                if (!empty($payload['user_id'])) {
                    $stmtUser = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE id = ? LIMIT 1");
                    $stmtUser->execute([$payload['user_id']]);
                    $rowU = $stmtUser->fetch(PDO::FETCH_ASSOC);
                    if ($rowU) $recipients[] = $rowU;
                }

                $title = $isSupplementary
                    ? ($status === 'approved' ? "Cập nhật công của bạn đã được duyệt" : "Yêu cầu cập nhật công bị từ chối")
                    : ($status === 'approved' ? "Chấm công đi trễ đã được duyệt" : "Yêu cầu đi trễ bị từ chối");
                $body = "Yêu cầu " . ($isSupplementary ? "cập nhật công" : "nhận lead/đi trễ") . " ngày " . $today . " của bạn đã được " . $statusText . " bởi quản trị viên." . (!empty($reason) ? " Ghi chú: \"$reason\"" : "");

                return [
                    'recipients' => $recipients,
                    'title' => $title,
                    'body' => $body,
                    'type' => "attendance",
                    'link' => "/sale-portal",
                    'zalo_msg' => "✅ [ KẾT QUẢ DUYỆT " . ($isSupplementary ? "CẬP NHẬT CÔNG" : "ĐI TRỄ") . " ]\n\n"
                        . "Yêu cầu của $userName ngày $today đã được $statusText bởi quản trị viên.\n"
                        . (!empty($reason) ? "  • Ghi chú: \"$reason\"\n" : ""),
                    'tg_msg' => "✅ <b>[ KẾT QUẢ DUYỆT " . ($isSupplementary ? "CẬP NHẬT CÔNG" : "ĐI TRỄ") . " ]</b>\n\n"
                        . "Yêu cầu của <b>" . htmlspecialchars($userName) . "</b> ngày <code>$today</code> đã được <b>$statusText</b> bởi quản trị viên.\n",
                    'email_subject' => "[IDEAS] Phê duyệt " . ($isSupplementary ? "cập nhật công" : "đi trễ") . " - Ngày " . $today,
                    'email_title' => "KẾT QUẢ PHÊ DUYỆT CHẤM CÔNG",
                    'email_content' => "Chào <strong>" . htmlspecialchars($userName) . "</strong>,<br/><br/>" .
                                    "Yêu cầu " . ($isSupplementary ? "cập nhật công" : "phê duyệt đi trễ") . " ngày $today của bạn đã được <strong>$statusText</strong> bởi quản trị viên.<br/>" .
                                    (!empty($reason) ? "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em><br/>" : "") .
                                    "Vui lòng kiểm tra trên hệ thống CRM."
                ];

            case 'HOLIDAY_REGISTRATION_OPENED':
                $holidayName = $payload['holiday_name'] ?? 'Lễ, Tết';
                $shiftDate = $payload['shift_date'] ?? '';
                $deadline = $payload['deadline'] ?? '';
                $recipients = self::getAllActiveUsers($db, $tenantId);
                return [
                    'recipients' => $recipients,
                    'title' => "🎉 Mở đăng ký ca trực lễ $holidayName",
                    'body' => "Ban quản trị đã mở đăng ký trực ca cho ngày lễ $holidayName ($shiftDate)." . (!empty($deadline) ? " Hạn đăng ký: $deadline" : ""),
                    'type' => "holiday",
                    'link' => "/sale-portal",
                    'zalo_msg' => "🎉 [ MỞ ĐĂNG KÝ TRỰC LỄ ]\n\n"
                        . "Ban quản trị đã mở đăng ký ca trực cho ngày nghỉ lễ: $holidayName ($shiftDate).\n"
                        . (!empty($deadline) ? "  • Hạn chót đăng ký: $deadline\n" : "")
                        . "Vui lòng truy cập trang Cá nhân / Sale Portal để đăng ký nhận lead.",
                    'tg_msg' => "🎉 <b>[ MỞ ĐĂNG KÝ TRỰC LỄ ]</b>\n\n"
                        . "Ban quản trị đã mở đăng ký ca trực cho ngày nghỉ lễ: <b>$holidayName</b> (<code>$shiftDate</code>).\n"
                        . (!empty($deadline) ? "  • Hạn chót đăng ký: <code>$deadline</code>\n" : "")
                        . "Vui lòng truy cập hệ thống để đăng ký nhận lead.",
                    'email_subject' => "[IDEAS] Mở đăng ký trực lễ - $holidayName",
                    'email_title' => "MỞ ĐĂNG KÝ TRỰC LỄ",
                    'email_content' => "Chào các thành viên,<br/><br/>" .
                                    "Ban quản trị chính thức mở đăng ký nhận lead ca trực cho ngày lễ: <strong>$holidayName</strong> ($shiftDate).<br/>" .
                                    (!empty($deadline) ? "Hạn chót đăng ký: <strong>$deadline</strong>.<br/>" : "") .
                                    "Vui lòng truy cập trang Sale Portal để đăng ký."
                ];

            case 'HOLIDAY_UPDATE':
                $holidayName = $payload['holiday_name'] ?? 'Ngày nghỉ lễ';
                $description = $payload['description'] ?? '';
                $recipients = self::getAllActiveUsers($db, $tenantId);
                return [
                    'recipients' => $recipients,
                    'title' => "🌴 Thông báo lịch nghỉ lễ $holidayName",
                    'body' => "Công ty thông báo lịch nghỉ lễ $holidayName. $description",
                    'type' => "holiday",
                    'link' => "/sale-portal",
                    'zalo_msg' => "🌴 [ THÔNG BÁO LỊCH NGHĨ LỄ ]\n\n"
                        . "Công ty thông báo chính thức lịch nghỉ lễ: $holidayName.\n"
                        . (!empty($description) ? "  • Chi tiết: $description\n" : "")
                        . "Chúc toàn thể cán bộ nhân viên có kỳ nghỉ vui vẻ!",
                    'tg_msg' => "🌴 <b>[ THÔNG BÁO LỊCH NGHĨ LỄ ]</b>\n\n"
                        . "Công ty thông báo chính thức lịch nghỉ lễ: <b>$holidayName</b>.\n"
                        . (!empty($description) ? "  • Chi tiết: <i>$description</i>\n" : "")
                        . "Chúc toàn thể cán bộ nhân viên có kỳ nghỉ vui vẻ!",
                    'email_subject' => "[IDEAS] Thông báo lịch nghỉ lễ - $holidayName",
                    'email_title' => "THÔNG BÁO LỊCH NGHĨ LỄ",
                    'email_content' => "Chào toàn thể cán bộ nhân viên,<br/><br/>" .
                                    "Công ty xin thông báo chính thức lịch nghỉ lễ: <strong>$holidayName</strong>.<br/>" .
                                    (!empty($description) ? "Chi tiết: <em>\"$description\"</em><br/>" : "") .
                                    "Chúc các bạn có một kỳ nghỉ an lành và vui vẻ!"
                ];

            case 'HOLIDAY_RETURN_REMINDER':
                $recipients = self::getAllActiveUsers($db, $tenantId);
                $holidayName = $payload['holiday_name'] ?? 'Kỳ nghỉ lễ';
                $nextDayText = $payload['next_day_text'] ?? 'ngày mai';
                $workStart = $payload['work_start'] ?? '08:00';

                $title = "⏰ Nhắc nhở: Ngày mai bắt đầu làm việc trở lại!";
                $body = "Kỳ nghỉ lễ {$holidayName} đã kết thúc. Ngày mai ({$nextDayText}) công ty bắt đầu làm việc trở lại bình thường lúc {$workStart}.";

                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $directLink = rtrim($frontendUrl, '/') . '/attendance';

                return [
                    'recipients' => $recipients,
                    'title' => $title,
                    'body' => $body,
                    'type' => "holiday",
                    'link' => "/attendance",
                    'zalo_msg' => "⏰ [ NHẮC NHỞ LỊCH LÀM VIỆC NGÀY MAI ]\n\n"
                        . "Kỳ nghỉ lễ $holidayName đã kết thúc.\n"
                        . "👉 Ngày mai ($nextDayText), công ty bắt đầu làm việc trở lại bình thường lúc $workStart.\n\n"
                        . "Chúc các bạn có một ngày làm việc mới tràn đầy năng lượng!",
                    'tg_msg' => "⏰ <b>[ NHẮC NHỞ LỊCH LÀM VIỆC NGÀY MAI ]</b>\n\n"
                        . "Kỳ nghỉ lễ <b>$holidayName</b> đã kết thúc.\n"
                        . "👉 Ngày mai (<b>$nextDayText</b>), công ty bắt đầu làm việc trở lại bình thường lúc <code>$workStart</code>.\n\n"
                        . "Chúc các bạn có một ngày làm việc mới tràn đầy năng lượng!",
                    'email_subject' => "[IDEAS ERP] Nhắc nhở: Ngày mai bắt đầu làm việc trở lại ($nextDayText)",
                    'email_title' => "THÔNG BÁO LỊCH LÀM VIỆC",
                    'email_content' => "<div style=\"background: #f1f5f9; border-left: 4px solid #BD1D2D; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #0f172a; margin: 0 0 10px; font-size: 16px;\">Nhắc nhở: Ngày mai bắt đầu làm việc trở lại!</h3>" .
                                    "  <p style=\"margin: 0; color: #334155;\">Kỳ nghỉ lễ <strong>" . htmlspecialchars($holidayName) . "</strong> đã kết thúc.<br/>Ngày mai (<strong>" . htmlspecialchars($nextDayText) . "</strong>), công ty bắt đầu làm việc trở lại bình thường lúc <strong>" . htmlspecialchars($workStart) . "</strong>. Bạn nhớ có mặt đúng giờ và chấm công đầy đủ nhé!</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$directLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">ĐĂNG NHẬP HỆ THỐNG</a>" .
                                    "</p>"
                ];

            case 'MONTHLY_ATTENDANCE_REPORT':
                $recipients = $payload['recipients'] ?? [];
                $summaryText = $payload['summary_text'] ?? '';
                $periodStr = $payload['period_str'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "📊 Báo cáo Chấm công & Trực ca ($periodStr)",
                    'body' => $summaryText,
                    'type' => "attendance_report",
                    'link' => "/attendance",
                    'zalo_msg' => "📊 [ BÁO CÁO CHẤM CÔNG & TRỰC CA ]\n\n" . $summaryText,
                    'tg_msg' => "📊 <b>[ BÁO CÁO CHẤM CÔNG & TRỰC CA ]</b>\n\n" . preg_replace('/•\s*([^:]+):/', '• <b>$1</b>:', htmlspecialchars($summaryText)),
                    'email_subject' => "[IDEAS] Báo cáo tổng kết Chấm công & Trực ca ($periodStr)",
                    'email_title' => "BÁO CÁO CHẤM CÔNG CÁ NHÂN",
                    'email_content' => nl2br(htmlspecialchars($summaryText))
                ];

            case 'ATTENDANCE_REMINDER':
                $recipients = !empty($payload['recipients']) ? $payload['recipients'] : self::getRecipientById($db, (int)($payload['user_id'] ?? 0));
                $todayDate = date('Y-m-d');
                $recipients = array_values(array_filter($recipients, function($r) use ($db, $todayDate) {
                    if (in_array(strtolower($r['role'] ?? ''), ['director'], true)) return false;
                    $uid = (int)($r['id'] ?? 0);
                    if ($uid <= 0) return true;
                    if (!empty($r['vacation_mode']) && (int)$r['vacation_mode'] === 1) return false;
                    if (!empty($r['leave_start']) && !empty($r['leave_end'])) {
                        if ($todayDate >= $r['leave_start'] && $todayDate <= $r['leave_end']) return false;
                    }
                    try {
                        $st = $db->prepare("SELECT id FROM hrm_leave_requests WHERE user_id = ? AND status IN ('approved', 'pending') AND DATE(start_date) <= ? AND DATE(end_date) >= ? AND leave_type NOT IN ('late_early', 'overtime') LIMIT 1");
                        $st->execute([$uid, $todayDate, $todayDate]);
                        if ($st->fetchColumn()) return false;
                    } catch (\Throwable $t) {}
                    return true;
                }));
                if (empty($recipients)) return null;

                $workStart = !empty($payload['work_start']) ? $payload['work_start'] : '';
                if (empty($workStart)) {
                    $stmtWs = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1");
                    $workStart = substr((string)($stmtWs ? $stmtWs->fetchColumn() : ''), 0, 5) ?: '08:00';
                }
                $timeText = !empty($workStart) ? " ($workStart)" : "";
                $name = $payload['user_name'] ?? ($recipients[0]['full_name'] ?? 'bạn');
                
                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $loginAttendanceLink = rtrim($frontendUrl, '/') . '/login?redirect=/attendance';

                return [
                    'recipients' => $recipients,
                    'title' => "⏰ ĐÃ ĐẾN GIỜ CHẤM CÔNG{$timeText}",
                    'body' => "Đã sắp đến giờ vào ca làm việc{$timeText}. Vui lòng chấm công đúng giờ nhé!",
                    'type' => "attendance",
                    'link' => "/attendance",
                    'zalo_msg' => "⏰ [ NHẮC NHỞ CHẤM CÔNG ]\n\nXin chào $name,\nĐã sắp đến giờ vào ca làm việc{$timeText}. Vui lòng đăng nhập MYERP để chấm công đúng giờ nhé!\n👉 $loginAttendanceLink",
                    'tg_msg' => "⏰ <b>[ NHẮC NHỞ CHẤM CÔNG ]</b> (Ca {$workStart})\n\nXin chào <b>" . htmlspecialchars($name) . "</b>,\nĐã sắp đến giờ vào ca làm việc (<code>$workStart</code>). Vui lòng đăng nhập MYERP để chấm công đúng giờ nhé!\n\n👉 <a href=\"$loginAttendanceLink\"><b>Đăng nhập MYERP để Chấm công ngay</b></a>",
                    'email_subject' => "[IDEAS ERP] ⏰ Nhắc nhở: Sắp đến giờ chấm công vào ca [Ca $workStart]",
                    'email_title' => "NHẮC NHỞ CHẤM CÔNG VÀO CA",
                    'email_content' => "<div style=\"background: #f1f5f9; border-left: 4px solid #BD1D2D; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #0f172a; margin: 0 0 10px; font-size: 16px;\">Sắp đến giờ bắt đầu ca làm việc</h3>" .
                                    "  <p style=\"margin: 0; color: #334155;\">Chào <strong>" . htmlspecialchars($name) . "</strong>, hệ thống nhắc nhở bạn sắp đến giờ bắt đầu ca làm việc (lúc <strong>" . htmlspecialchars($workStart) . "</strong>). Vui lòng truy cập hệ thống MYERP để thực hiện điểm danh/chấm công đúng giờ.</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$loginAttendanceLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">ĐĂNG NHẬP CHẤM CÔNG</a>" .
                                    "</p>"
                ];

            case 'CHECKIN_MISSING_REMINDER':
                $recipients = !empty($payload['recipients']) ? $payload['recipients'] : self::getRecipientById($db, (int)($payload['user_id'] ?? 0));
                // Do NOT send attendance reminders to directors or users on leave/vacation
                $todayDate = date('Y-m-d');
                $recipients = array_values(array_filter($recipients, function($r) use ($db, $todayDate) {
                    if (in_array(strtolower($r['role'] ?? ''), ['director'], true)) return false;
                    $uid = (int)($r['id'] ?? 0);
                    if ($uid <= 0) return true;
                    if (!empty($r['vacation_mode']) && (int)$r['vacation_mode'] === 1) return false;
                    if (!empty($r['leave_start']) && !empty($r['leave_end'])) {
                        if ($todayDate >= $r['leave_start'] && $todayDate <= $r['leave_end']) return false;
                    }
                    try {
                        $st = $db->prepare("SELECT id FROM hrm_leave_requests WHERE user_id = ? AND status IN ('approved', 'pending') AND DATE(start_date) <= ? AND DATE(end_date) >= ? AND leave_type NOT IN ('late_early', 'overtime') LIMIT 1");
                        $st->execute([$uid, $todayDate, $todayDate]);
                        if ($st->fetchColumn()) return false;
                    } catch (\Throwable $t) {}
                    return true;
                }));
                if (empty($recipients)) return null;

                $workStart = !empty($payload['work_start']) ? $payload['work_start'] : '';
                if (empty($workStart)) {
                    $stmtWs = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1");
                    $workStart = substr((string)($stmtWs ? $stmtWs->fetchColumn() : ''), 0, 5) ?: '08:00';
                }
                $timeText = !empty($workStart) ? " ($workStart)" : "";
                $name = $payload['user_name'] ?? ($recipients[0]['full_name'] ?? 'bạn');
                
                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $loginAttendanceLink = rtrim($frontendUrl, '/') . '/login?redirect=/attendance';

                return [
                    'recipients' => $recipients,
                    'title' => "⚠️ CẢNH BÁO: Bạn chưa chấm công hôm nay!",
                    'body' => "Đã quá giờ bắt đầu ca{$timeText} nhưng bạn chưa thực hiện chấm công vào hôm nay.",
                    'type' => "attendance",
                    'link' => "/attendance",
                    'zalo_msg' => "⚠️ [ CẢNH BÁO: CHƯA CHẤM CÔNG HÔM NAY ]\n\nXin chào $name,\nĐã quá giờ bắt đầu ca làm việc{$timeText} nhưng hệ thống chưa ghi nhận lượt chấm công vào hôm nay của bạn.\n👉 Đăng nhập MYERP để chấm công ngay:\n$loginAttendanceLink",
                    'tg_msg' => "⚠️ <b>[ CẢNH BÁO: CHƯA CHẤM CÔNG HÔM NAY ]</b>\n\nXin chào <b>" . htmlspecialchars($name) . "</b>,\nĐã quá giờ bắt đầu ca làm việc" . (!empty($workStart) ? " (<code>$workStart</code>)" : "") . " nhưng bạn chưa thực hiện chấm công vào hôm nay.\n\n👉 <a href=\"$loginAttendanceLink\"><b>Đăng nhập MYERP để Chấm công ngay</b></a>",
                    'email_subject' => "[IDEAS ERP] ⚠️ Cảnh báo: Bạn chưa thực hiện chấm công hôm nay [Ca $workStart]",
                    'email_title' => "CẢNH BÁO CHƯA CHẤM CÔNG HÔM NAY",
                    'email_content' => "<div style=\"background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #991b1b; margin: 0 0 10px; font-size: 16px;\">Cảnh báo chưa chấm công vào ca</h3>" .
                                    "  <p style=\"margin: 0; color: #7f1d1d;\">Chào <strong>" . htmlspecialchars($name) . "</strong>, hệ thống ghi nhận đã quá giờ bắt đầu ca làm việc" . (!empty($workStart) ? " (<strong>$workStart</strong>)" : "") . " nhưng bạn <strong>chưa thực hiện chấm công vào hôm nay</strong>.<br/><br/>Vui lòng truy cập hệ thống MYERP để thực hiện chấm công ngay hoặc tạo phiếu giải trình đi trễ nếu có lý do chính đáng.</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$loginAttendanceLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">ĐĂNG NHẬP CHẤM CÔNG NGAY</a>" .
                                    "</p>"
                ];

            case 'CHECKOUT_REMINDER':
            case 'CHECKOUT_MISSING_REMINDER':
                $recipients = !empty($payload['recipients']) ? $payload['recipients'] : self::getRecipientById($db, (int)($payload['user_id'] ?? 0));
                // Do NOT send attendance reminders to directors or users on leave/vacation
                $todayDate = date('Y-m-d');
                $recipients = array_values(array_filter($recipients, function($r) use ($db, $todayDate) {
                    if (in_array(strtolower($r['role'] ?? ''), ['director'], true)) return false;
                    $uid = (int)($r['id'] ?? 0);
                    if ($uid <= 0) return true;
                    if (!empty($r['vacation_mode']) && (int)$r['vacation_mode'] === 1) return false;
                    if (!empty($r['leave_start']) && !empty($r['leave_end'])) {
                        if ($todayDate >= $r['leave_start'] && $todayDate <= $r['leave_end']) return false;
                    }
                    try {
                        $st = $db->prepare("SELECT id FROM hrm_leave_requests WHERE user_id = ? AND status IN ('approved', 'pending') AND DATE(start_date) <= ? AND DATE(end_date) >= ? AND leave_type NOT IN ('late_early', 'overtime') LIMIT 1");
                        $st->execute([$uid, $todayDate, $todayDate]);
                        if ($st->fetchColumn()) return false;
                    } catch (\Throwable $t) {}
                    return true;
                }));
                if (empty($recipients)) return null;

                $workEnd = !empty($payload['work_end']) ? $payload['work_end'] : '';
                if (empty($workEnd)) {
                    $stmtWe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1");
                    $workEnd = substr((string)($stmtWe ? $stmtWe->fetchColumn() : ''), 0, 5);
                }
                $timeTextEnd = !empty($workEnd) ? " ($workEnd)" : "";
                $name = $payload['user_name'] ?? ($recipients[0]['full_name'] ?? 'bạn');
                
                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $loginAttendanceLink = rtrim($frontendUrl, '/') . '/login?redirect=/attendance';

                return [
                    'recipients' => $recipients,
                    'title' => "🌆 Nhắc nhở: Bạn chưa chấm công ra hôm nay!",
                    'body' => "Đã đến giờ kết thúc ca{$timeTextEnd}. Bạn vui lòng chấm công ra ca hôm nay nhé!",
                    'type' => "attendance",
                    'link' => "/attendance",
                    'zalo_msg' => "🌆 [ NHẮC NHỞ CHẤM CÔNG RA CA ]\n\nXin chào $name,\nĐã đến giờ kết thúc ca làm việc{$timeTextEnd} nhưng bạn chưa thực hiện chấm công ra ca hôm nay.\n👉 Đăng nhập MYERP để chấm công ra ca:\n$loginAttendanceLink",
                    'tg_msg' => "🌆 <b>[ NHẮC NHỞ CHẤM CÔNG RA CA ]</b>\n\nXin chào <b>" . htmlspecialchars($name) . "</b>,\nĐã đến giờ kết thúc ca làm việc" . (!empty($workEnd) ? " (<code>$workEnd</code>)" : "") . " nhưng bạn chưa thực hiện chấm công ra ca hôm nay.\n\n👉 <a href=\"$loginAttendanceLink\"><b>Đăng nhập MYERP để Chấm công Ra ca</b></a>",
                    'email_subject' => "[IDEAS ERP] Nhắc nhở: Đến giờ chấm công ra ca hôm nay",
                    'email_title' => "NHẮC NHỞ CHẤM CÔNG",
                    'email_content' => "<div style=\"background: #f1f5f9; border-left: 4px solid #BD1D2D; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #0f172a; margin: 0 0 10px; font-size: 16px;\">Nhắc nhở chấm công ra ca</h3>" .
                                    "  <p style=\"margin: 0; color: #334155;\">Chào <strong>" . htmlspecialchars($name) . "</strong>, hệ thống ghi nhận đã đến giờ kết thúc ca làm việc" . (!empty($workEnd) ? " (<strong>$workEnd</strong>)" : "") . " nhưng bạn chưa thực hiện chấm công ra ca hôm nay.</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$loginAttendanceLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">ĐĂNG NHẬP CHẤM CÔNG</a>" .
                                    "</p>"
                ];

            case 'EXPENSE_REQUEST':
                $targetApproverId = (int)($payload['approver_id'] ?? $payload['target_user_id'] ?? 0);
                if ($targetApproverId > 0) {
                    $recipients = self::getRecipientById($db, $targetApproverId);
                } else {
                    $submitterId = (int)($payload['user_id'] ?? $payload['submitter_id'] ?? 0);
                    $amt = (float)($payload['amount'] ?? 0);
                    $recipients = self::getApproversForEvent($db, $tenantId, 'expense', $submitterId, $amt);
                }
                $titleText = $payload['title'] ?? 'Đề xuất';
                $amt = (float)($payload['amount'] ?? 0);
                $hasCost = $amt > 0;
                $amountText = $hasCost ? number_format($amt, 0, ',', '.') . 'đ' : '';
                $costSuffix = $hasCost ? " (" . $amountText . ")" : "";
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu phê duyệt chi phí / đề xuất" . $costSuffix,
                    'body' => "Nhân viên " . $userName . " vừa gửi đề xuất: " . $titleText . $costSuffix,
                    'type' => "expense",
                    'link' => "/approvals?open_id=" . ($payload['ref_id'] ?? '') . "&open_type=expense",
                    'zalo_msg' => "📋 [ YÊU CẦU PHÊ DUYỆT ĐỀ XUẤT ]\n\n"
                        . "Nhân viên $userName vừa tạo đề xuất mới:\n"
                        . "  • Tiêu đề: $titleText\n"
                        . ($hasCost ? "  • Kinh phí: $amountText\n" : "")
                        . "  • Ghi chú: \"$reason\"\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "📋 <b>[ YÊU CẦU PHÊ DUYỆT ĐỀ XUẤT ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa tạo đề xuất mới:\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($titleText) . "</b>\n"
                        . ($hasCost ? "  • Kinh phí: <b>$amountText</b>\n" : "")
                        . "  • Ghi chú: <i>\"" . htmlspecialchars($reason) . "\"</i>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[IDEAS] Yêu cầu phê duyệt Đề xuất - NV $userName" . $costSuffix,
                    'email_title' => "PHÊ DUYỆT ĐỀ XUẤT",
                    'email_content' => "Chào quản trị viên / người duyệt,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa tạo một đề xuất mới cần phê duyệt: <strong>" . htmlspecialchars($titleText) . "</strong>.<br/>" .
                                    ($hasCost ? "Kinh phí dự kiến: <strong>$amountText</strong>.<br/>" : "") .
                                    "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'EXPENSE_APPROVED':
            case 'EXPENSE_REJECTED':
                $isApproved = ($eventType === 'EXPENSE_APPROVED');
                $targetUserId = (int)($payload['target_user_id'] ?? $payload['user_id'] ?? 0);
                $recipients = [];
                if ($targetUserId > 0) {
                    $stmtUser = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name, role FROM users WHERE id = ? LIMIT 1");
                    $stmtUser->execute([$targetUserId]);
                    $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                    if ($userRow) $recipients[] = $userRow;
                }
                $titleText = $payload['title'] ?? 'Đề xuất';
                $amt = (float)($payload['amount'] ?? 0);
                $hasCost = $amt > 0;
                $amountText = $hasCost ? number_format($amt, 0, ',', '.') . 'đ' : '';
                $statusText = $isApproved ? 'ĐÃ DUYỆT' : 'TỪ CHỐI';
                $statusTextLower = $isApproved ? 'chấp thuận' : 'từ chối';
                $rejectReason = $payload['reject_reason'] ?? $payload['reason'] ?? '';

                return [
                    'recipients' => $recipients,
                    'title' => $isApproved ? "Đề xuất đã được duyệt: $titleText" : "Đề xuất bị từ chối: $titleText",
                    'body' => "Đề xuất \"$titleText\" của bạn đã được $statusTextLower bởi quản trị viên." . (!empty($rejectReason) ? " Lý do: $rejectReason" : ""),
                    'type' => "expense",
                    'link' => "/approvals?open_id=" . ($payload['ref_id'] ?? '') . "&open_type=expense",
                    'zalo_msg' => ($isApproved ? "✅" : "❌") . " [ ĐỀ XUẤT $statusText ]\n\n"
                        . "Đề xuất của bạn đã được $statusTextLower bởi quản trị viên:\n"
                        . "  • Tiêu đề: $titleText\n"
                        . ($hasCost ? "  • Số tiền: $amountText\n" : "")
                        . (!empty($rejectReason) ? "  • Lý do: $rejectReason\n" : "")
                        . "\nVui lòng truy cập hệ thống để xem chi tiết.",
                    'tg_msg' => ($isApproved ? "✅" : "❌") . " <b>[ ĐỀ XUẤT $statusText ]</b>\n\n"
                        . "Đề xuất của bạn đã được <b>$statusTextLower</b> bởi quản trị viên:\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($titleText) . "</b>\n"
                        . ($hasCost ? "  • Số tiền: <b>$amountText</b>\n" : "")
                        . (!empty($rejectReason) ? "  • Lý do: <i>" . htmlspecialchars($rejectReason) . "</i>\n" : "")
                        . "\nVui lòng truy cập hệ thống để xem chi tiết.",
                    'email_subject' => "[IDEAS] Đề xuất của bạn đã được $statusTextLower - $titleText",
                    'email_title' => "KẾT QUẢ PHÊ DUYỆT ĐỀ XUẤT",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Đề xuất <strong>" . htmlspecialchars($titleText) . "</strong> của bạn đã được <strong>$statusTextLower</strong>.<br/>" .
                                    ($hasCost ? "Số tiền: <strong>$amountText</strong>.<br/>" : "") .
                                    (!empty($rejectReason) ? "Lý do: <em>\"" . htmlspecialchars($rejectReason) . "\"</em>.<br/>" : "") .
                                    "Vui lòng truy cập hệ thống CRM để xem chi tiết."
                ];

            case 'TICKET_NEW':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $ticketId = $payload['ticket_id'] ?? '0';
                $subjectText = $payload['subject'] ?? 'Hỗ trợ';
                $priorityText = $payload['priority'] ?? 'medium';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu hỗ trợ mới (Ticket #$ticketId)",
                    'body' => "Có yêu cầu hỗ trợ mới từ $userName: $subjectText",
                    'type' => "ticket_assignment",
                    'link' => "/support-tickets",
                    'zalo_msg' => "🎫 [ TICKET HỖ TRỢ MỚI ]\n\n"
                        . "Có yêu cầu hỗ trợ mới từ $userName:\n"
                        . "  • Ticket: #$ticketId\n"
                        . "  • Tiêu đề: $subjectText\n"
                        . "  • Độ ưu tiên: $priorityText\n\n"
                        . "Vui lòng truy cập CRM để xử lý.",
                    'tg_msg' => "🎫 <b>[ TICKET HỖ TRỢ MỚI ]</b>\n\n"
                        . "Có yêu cầu hỗ trợ mới từ <b>" . htmlspecialchars($userName) . "</b>:\n"
                        . "  • Ticket: <b>#$ticketId</b>\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($subjectText) . "</b>\n"
                        . "  • Độ ưu tiên: <b>" . htmlspecialchars($priorityText) . "</b>\n\n"
                        . "Vui lòng truy cập CRM để xử lý.",
                    'email_subject' => "[IDEAS] Yêu cầu hỗ trợ mới (Ticket #$ticketId)",
                    'email_title' => "TICKET HỖ TRỢ MỚI",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Có yêu cầu hỗ trợ mới từ <strong>" . htmlspecialchars($userName) . "</strong>:<br/>" .
                                    "Tiêu đề: <strong>" . htmlspecialchars($subjectText) . "</strong>.<br/>" .
                                    "Mô tả: <em>\"" . htmlspecialchars($reason) . "\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để xử lý."
                ];

            case 'COOPERATION_PENDING_APPROVAL':
                $targetApproverId = (int)($payload['approver_id'] ?? $payload['target_user_id'] ?? 0);
                if ($targetApproverId > 0) {
                    $recipients = self::getRecipientById($db, $targetApproverId);
                } else {
                    $submitterId = (int)($payload['user_id'] ?? 0);
                    $recipients = self::getApproversForEvent($db, $tenantId, 'cooperation', $submitterId);
                }
                $slipId = $payload['slip_id'] ?? '0';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu phê duyệt phiếu hợp tác",
                    'body' => "Phiếu hợp tác #" . $slipId . " đã thu thập đủ chữ ký và đang chờ phê duyệt",
                    'type' => "cooperation",
                    'link' => "/cooperation-slips",
                    'zalo_msg' => "✍️ [ YÊU CẦU PHÊ DUYỆT PHIẾU HỢP TÁC ]\n\n"
                        . "Phiếu hợp tác chia sẻ hoa hồng #$slipId đã thu thập đầy đủ chữ ký của các thành viên.\n"
                        . "  • Mã phiếu: #$slipId\n"
                        . "  • Trạng thái: Chờ phê duyệt\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'tg_msg' => "✍️ <b>[ YÊU CẦU PHÊ DUYỆT PHIẾU HỢP TÁC ]</b>\n\n"
                        . "Phiếu hợp tác chia sẻ hoa hồng <b>#$slipId</b> đã thu thập đầy đủ chữ ký của các thành viên.\n"
                        . "  • Trạng thái: Chờ phê duyệt\n\n"
                        . "Vui lòng truy cập hệ thống CRM để phê duyệt.",
                    'email_subject' => "[IDEAS] Yêu cầu phê duyệt Phiếu hợp tác #$slipId",
                    'email_title' => "PHÊ DUYỆT PHIẾU HỢP TÁC",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Phiếu hợp tác chia sẻ hoa hồng <strong>#$slipId</strong> đã thu thập đầy đủ chữ ký của các thành viên.<br/>" .
                                    "Vui lòng truy cập hệ thống CRM để phê duyệt."
                ];

            case 'DEPOSIT_NEW':
                $targetApproverId = (int)($payload['approver_id'] ?? $payload['target_user_id'] ?? 0);
                if ($targetApproverId > 0) {
                    $recipients = self::getRecipientById($db, $targetApproverId);
                } else {
                    $submitterId = (int)($payload['user_id'] ?? 0);
                    $recipients = self::getApproversForEvent($db, $tenantId, 'deposit', $submitterId);
                }
                $depId = $payload['deposit_id'] ?? '0';
                $customerName = $payload['customer_name'] ?? 'Khách hàng';
                $depAmount = number_format((float)($payload['amount'] ?? 0), 0, ',', '.') . 'đ';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu duyệt Sale Order mới",
                    'body' => "Nhân viên " . $userName . " vừa tạo Sale Order cho khách hàng " . $customerName . " (" . $depAmount . ")",
                    'type' => "deposit",
                    'link' => "/deposits",
                    'zalo_msg' => "🏠 [ YÊU CẦU DUYỆT SALE ORDER MỚI ]\n\n"
                        . "Nhân viên $userName vừa tạo yêu cầu Sale Order mới:\n"
                        . "  • Mã Sale Order: #$depId\n"
                        . "  • Khách hàng: $customerName\n"
                        . "  • Số tiền: $depAmount\n\n"
                        . "Vui lòng truy cập CRM để xem xét.",
                    'tg_msg' => "🏠 <b>[ YÊU CẦU DUYỆT SALE ORDER MỚI ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa tạo yêu cầu Sale Order mới:\n"
                        . "  • Mã Sale Order: <b>#$depId</b>\n"
                        . "  • Khách hàng: <b>" . htmlspecialchars($customerName) . "</b>\n"
                        . "  • Số tiền: <b>$depAmount</b>\n\n"
                        . "Vui lòng truy cập CRM để xem xét.",
                    'email_subject' => "[IDEAS] Yêu cầu duyệt Sale Order mới #$depId",
                    'email_title' => "DUYỆT SALE ORDER MỚI",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa tạo Sale Order mới cho khách hàng <strong>" . htmlspecialchars($customerName) . "</strong>.<br/>" .
                                    "Số tiền: <strong>$depAmount</strong>.<br/>" .
                                    "Vui lòng truy cập CRM để xem xét."
                ];

            case 'MY_DEPOSIT_UPDATE':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $customerName = $payload['customer_name'] ?? 'Khách hàng';
                $statusText = $payload['status_text'] ?? 'được cập nhật';
                $depId = $payload['deposit_id'] ?? '0';
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật Sale Order #$depId",
                    'body' => "Sale Order cho khách hàng $customerName đã $statusText",
                    'type' => "deposit",
                    'link' => "/deposits",
                    'zalo_msg' => "💳 [ CẬP NHẬT SALE ORDER ]\n\n"
                        . "Sale Order #$depId (KH $customerName) đã $statusText.\n"
                        . (!empty($reason) ? "  • Ghi chú: \"$reason\"\n" : "")
                        . "\nVui lòng xem chi tiết trên CRM.",
                    'tg_msg' => "💳 <b>[ CẬP NHẬT SALE ORDER ]</b>\n\n"
                        . "Sale Order <b>#$depId</b> (KH <b>" . htmlspecialchars($customerName) . "</b>) đã <b>$statusText</b>.\n"
                        . (!empty($reason) ? "  • Ghi chú: <i>\"" . htmlspecialchars($reason) . "\"</i>\n" : "")
                        . "\nVui lòng xem chi tiết trên CRM.",
                    'email_subject' => "[IDEAS] Cập nhật Sale Order #$depId - $customerName",
                    'email_title' => "CẬP NHẬT SALE ORDER",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Sale Order #$depId của khách hàng <strong>" . htmlspecialchars($customerName) . "</strong> đã <strong>$statusText</strong>.<br/>" .
                                    (!empty($reason) ? "Ghi chú: <em>\"" . htmlspecialchars($reason) . "\"</em><br/>" : "") .
                                    "Vui lòng kiểm tra trên CRM."
                ];

            case 'NIGHT_SHIFT_BOOKING':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $shiftDate = $payload['shift_date'] ?? $today;
                return [
                    'recipients' => $recipients,
                    'title' => "Đăng ký trực đêm mới",
                    'body' => "Nhân viên " . $userName . " đã đăng ký trực ca đêm ngày " . $shiftDate,
                    'type' => "roster",
                    'link' => "/roster",
                    'zalo_msg' => "🌙 [ ĐĂNG KÝ TRỰC ĐÊM MỚI ]\n\n"
                        . "Nhân viên $userName vừa đăng ký trực ca đêm:\n"
                        . "  • Ngày trực: $shiftDate\n"
                        . "  • Trạng thái: Đã ghi nhận\n\n"
                        . "Vui lòng kiểm tra lịch trực trên CRM.",
                    'tg_msg' => "🌙 <b>[ ĐĂNG KÝ TRỰC ĐÊM MỚI ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa đăng ký trực ca đêm:\n"
                        . "  • Ngày trực: <code>$shiftDate</code>\n\n"
                        . "Vui lòng kiểm tra lịch trực trên CRM.",
                    'email_subject' => "[IDEAS] Đăng ký trực đêm - NV $userName",
                    'email_title' => "ĐĂNG KÝ TRỰC ĐÊM",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa đăng ký trực ca đêm ngày <strong>$shiftDate</strong>.<br/>" .
                                    "Vui lòng kiểm tra lịch trực trên CRM."
                ];

            case 'LEAVE_REQUEST':
                $targetApproverId = (int)($payload['approver_id'] ?? $payload['target_user_id'] ?? 0);
                if ($targetApproverId > 0) {
                    $recipients = self::getRecipientById($db, $targetApproverId);
                } else {
                    $submitterId = (int)($payload['user_id'] ?? 0);
                    $recipients = self::getApproversForEvent($db, $tenantId, 'leave', $submitterId);
                }
                $leaveDate = $payload['leave_date'] ?? $today;
                $leaveLink = !empty($payload['ref_id']) 
                    ? "/approvals?open_id=" . $payload['ref_id'] . "&open_type=leave" 
                    : "/attendance";
                return [
                    'recipients' => $recipients,
                    'title' => "Đơn xin nghỉ phép mới",
                    'body' => "Nhân viên " . $userName . " đã gửi đơn xin nghỉ phép ngày " . $leaveDate . " với lý do: \"" . $reason . "\"",
                    'type' => "leave",
                    'link' => $leaveLink,
                    'zalo_msg' => "🏖️ [ ĐƠN XIN NGHỈ PHÉP MỚI ]\n\n"
                        . "Nhân viên $userName vừa gửi đơn xin nghỉ phép:\n"
                        . "  • Ngày nghỉ: $leaveDate\n"
                        . "  • Lý do: \"$reason\"\n\n"
                        . "Vui lòng truy cập CRM để phê duyệt.",
                    'tg_msg' => "🏖️ <b>[ ĐƠN XIN NGHỈ PHÉP MỚI ]</b>\n\n"
                        . "Nhân viên <b>$userName</b> vừa gửi đơn xin nghỉ phép:\n"
                        . "  • Ngày nghỉ: <code>$leaveDate</code>\n"
                        . "  • Lý do: <i>\"$reason\"</i>\n\n"
                        . "Vui lòng truy cập CRM để phê duyệt.",
                    'email_subject' => "[IDEAS] Đơn xin nghỉ phép - NV $userName",
                    'email_title' => "ĐƠN XIN NGHỈ PHÉP",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa gửi đơn xin nghỉ phép ngày $leaveDate.<br/>" .
                                    "Lý do: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập CRM để phê duyệt."
                ];

            case 'LEAD_ASSIGNMENT':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng mới';
                $phone = $payload['phone'] ?? '';
                $maskedPhone = !empty($phone) && strlen($phone) >= 7 
                    ? (substr($phone, 0, 4) . '***' . substr($phone, -3)) 
                    : '******';
                return [
                    'recipients' => $recipients,
                    'title' => "Khách hàng mới được phân bổ",
                    'body' => "Bạn vừa được phân bổ khách hàng mới. Vui lòng vào CRM (Sale Portal) để nhận và xem chi tiết.",
                    'type' => "lead",
                    'link' => "/sale-portal",
                    'zalo_msg' => "🎯 [ KHÁCH HÀNG MỚI ĐƯỢC CHIA ]\n\n"
                        . "Bạn vừa được hệ thống phân bổ 1 khách hàng mới:\n"
                        . "  • Trạng thái: Chờ nhận & xem chi tiết\n"
                        . "  • SĐT liên hệ: $maskedPhone\n\n"
                        . "Vui lòng truy cập Sale Portal trên CRM ngay để nhận và lấy thông tin chi tiết!",
                    'tg_msg' => "🎯 <b>[ KHÁCH HÀNG MỚI ĐƯỢC CHIA ]</b>\n\n"
                        . "Bạn vừa được hệ thống phân bổ 1 khách hàng mới:\n"
                        . "  • Trạng thái: <b>Chờ nhận & xem chi tiết</b>\n"
                        . "  • SĐT liên hệ: <code>$maskedPhone</code>\n\n"
                        . "Vui lòng truy cập Sale Portal trên CRM ngay để nhận và lấy thông tin chi tiết!",
                    'email_subject' => "[IDEAS] Thông báo phân bổ khách hàng mới",
                    'email_title' => "KHÁCH HÀNG MỚI ĐƯỢC PHÂN BỔ",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Hệ thống vừa phân bổ 1 khách hàng mới cho bạn.<br/>" .
                                    "Vì lý do bảo mật dữ liệu, thông tin chi tiết và SĐT đầy đủ chỉ hiển thị khi bạn đăng nhập vào CRM.<br/>" .
                                    "Vui lòng truy cập <strong>Sale Portal</strong> trên CRM để nhận khách hàng."
                ];

            case 'COOP_INVITATION':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng';
                $inviterName = $payload['inviter_name'] ?? 'Đồng nghiệp';
                $sharePct = isset($payload['share_pct']) && $payload['share_pct'] !== '' ? ($payload['share_pct'] . '%') : '';
                $shareText = !empty($sharePct) ? " (Tỷ lệ hoa hồng: $sharePct)" : "";
                
                $slipId = isset($payload['slip_id']) ? (int)$payload['slip_id'] : 0;
                
                if ($slipId > 0) {
                    return [
                        'recipients' => $recipients,
                        'title' => "✍️ Yêu cầu ký xác nhận Phiếu hợp tác",
                        'body' => "Bạn nhận được yêu cầu ký xác nhận Phiếu hợp tác #$slipId cho khách hàng $custName.",
                        'type' => "cooperation",
                        'link' => "/sale-portal",
                        'zalo_msg' => "✍️ [ YÊU CẦU KÝ XÁC NHẬN PHIẾU HỢP TÁC ]\n\n"
                            . "Một phiếu hợp tác chia sẻ hoa hồng mới (#$slipId) đã được tạo cho khách hàng: $custName.\n"
                            . "Vui lòng truy cập CRM để xem chi tiết và ký xác nhận.",
                        'tg_msg' => "✍️ <b>[ YÊU CẦU KÝ XÁC NHẬN PHIẾU HỢP TÁC ]</b>\n\n"
                            . "Một phiếu hợp tác chia sẻ hoa hồng mới (<b>#$slipId</b>) đã được tạo cho khách hàng: <b>" . htmlspecialchars($custName) . "</b>.\n"
                            . "Vui lòng truy cập CRM để xem chi tiết và ký xác nhận.",
                        'email_subject' => $payload['email_subject'] ?? "[IDEAS] Yêu cầu ký xác nhận Phiếu hợp tác #$slipId",
                        'email_title' => $payload['email_title'] ?? "KÝ XÁC NHẬN PHIẾU HỢP TÁC",
                        'email_content' => $payload['email_content'] ?? "Chào bạn,<br/><br/>" .
                                        "Một phiếu hợp tác chia sẻ hoa hồng mới (#$slipId) đã được tạo trên hệ thống cho khách hàng <strong>" . htmlspecialchars($custName) . "</strong>.<br/>" .
                                        "Vui lòng đăng nhập CRM để xem chi tiết và ký xác nhận."
                    ];
                } else {
                    return [
                        'recipients' => $recipients,
                        'title' => "🤝 Lời mời hợp tác chăm sóc (Co-care)",
                        'body' => "Sale $inviterName vừa mời bạn hợp tác chăm sóc khách hàng $custName$shareText.",
                        'type' => "cooperation",
                        'link' => "/contacts?id=" . ($payload['contact_id'] ?? ''),
                        'zalo_msg' => "🤝 [ LỜI MỜI HỢP TÁC CHĂM SÓC ]\n\n"
                            . "Sale $inviterName vừa thêm bạn làm nhân sự hợp tác (Co-care):\n"
                            . "  • Khách hàng: $custName\n"
                            . (!empty($sharePct) ? "  • Tỷ lệ chia: $sharePct\n" : "")
                            . "\nVui lòng truy cập CRM để xem chi tiết khách hàng.",
                        'tg_msg' => "🤝 <b>[ LỜI MỜI HỢP TÁC CHĂM SÓC ]</b>\n\n"
                            . "Sale <b>" . htmlspecialchars($inviterName) . "</b> vừa thêm bạn làm nhân sự hợp tác (Co-care):\n"
                            . "  • Khách hàng: <b>" . htmlspecialchars($custName) . "</b>\n"
                            . (!empty($sharePct) ? "  • Tỷ lệ chia: <b>$sharePct</b>\n" : "")
                            . "\nVui lòng truy cập CRM để xem chi tiết khách hàng.",
                        'email_subject' => $payload['email_subject'] ?? "[IDEAS] Lời mời hợp tác chăm sóc khách hàng $custName",
                        'email_title' => $payload['email_title'] ?? "LỜI MỜI HỢP TÁC CHĂM SÓC (CO-CARE)",
                        'email_content' => $payload['email_content'] ?? "Chào bạn,<br/><br/>" .
                                        "Sale <strong>" . htmlspecialchars($inviterName) . "</strong> vừa mời bạn hợp tác chăm sóc (Co-care) khách hàng: <strong>" . htmlspecialchars($custName) . "</strong>.<br/>" .
                                        (!empty($sharePct) ? "Tỷ lệ chia sẻ hoa hồng: <strong>$sharePct</strong>.<br/>" : "") .
                                        "Vui lòng đăng nhập CRM để xem thông tin chi tiết."
                    ];
                }

            case 'CUSTOMER_UPDATE':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng';
                $updateContent = $payload['content'] ?? 'Thông tin khách hàng vừa được cập nhật';
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật khách hàng $custName",
                    'body' => $updateContent,
                    'type' => "customer",
                    'link' => "/contacts",
                    'zalo_msg' => "👤 [ CẬP NHẬT KHÁCH HÀNG ]\n\n"
                        . "Khách hàng $custName có cập nhật mới:\n"
                        . "  • Nội dung: $updateContent\n\n"
                        . "Vui lòng truy cập CRM để xem chi tiết.",
                    'tg_msg' => "👤 <b>[ CẬP NHẬT KHÁCH HÀNG ]</b>\n\n"
                        . "Khách hàng <b>" . htmlspecialchars($custName) . "</b> có cập nhật mới:\n"
                        . "  • Nội dung: <i>" . htmlspecialchars($updateContent) . "</i>\n\n"
                        . "Vui lòng truy cập CRM để xem chi tiết.",
                    'email_subject' => "[IDEAS] Cập nhật thông tin khách hàng $custName",
                    'email_title' => "CẬP NHẬT KHÁCH HÀNG",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Khách hàng <strong>" . htmlspecialchars($custName) . "</strong> có cập nhật mới.<br/>" .
                                    "Nội dung: <em>" . htmlspecialchars($updateContent) . "</em>.<br/>" .
                                    "Vui lòng kiểm tra trên CRM."
                ];

            case 'SECURITY_DEADLINE_WARNING':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $custName = $payload['customer_name'] ?? 'Khách hàng';
                $deadlineText = $payload['deadline'] ?? '24h';
                return [
                    'recipients' => $recipients,
                    'title' => "Cảnh báo hạn bảo mật Data",
                    'body' => "Khách hàng $custName sắp hết hạn bảo mật và sẽ bị thu hồi sau $deadlineText",
                    'type' => "security_warning",
                    'link' => "/contacts",
                    'zalo_msg' => "⏳ [ CẢNH BÁO HẠN BẢO MẬT DATA ]\n\n"
                        . "Khách hàng $custName của bạn sắp hết thời hạn bảo mật:\n"
                        . "  • Thời gian còn lại: $deadlineText\n\n"
                        . "Hãy cập nhật tương tác để gia hạn bảo mật data.",
                    'tg_msg' => "⏳ <b>[ CẢNH BÁO HẠN BẢO MẬT DATA ]</b>\n\n"
                        . "Khách hàng <b>" . htmlspecialchars($custName) . "</b> của bạn sắp hết thời hạn bảo mật:\n"
                        . "  • Thời gian còn lại: <code>$deadlineText</code>\n\n"
                        . "Hãy cập nhật tương tác để gia hạn bảo mật data.",
                    'email_subject' => "[IDEAS] Cảnh báo hạn bảo mật Data - $custName",
                    'email_title' => "CẢNH BÁO HẠN BẢO MẬT DATA",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Khách hàng <strong>" . htmlspecialchars($custName) . "</strong> sắp hết thời hạn bảo mật.<br/>" .
                                    "Thời gian còn lại: <strong>$deadlineText</strong>.<br/>" .
                                    "Hãy cập nhật tương tác để giữ quyền chăm sóc data."
                ];

            case 'MENTION_TAGGED':
                $recipients = !empty($payload['recipients']) ? $payload['recipients'] : self::getRecipientById($db, (int)($payload['user_id'] ?? 0));
                $authorName = $payload['author_name'] ?? 'Đồng nghiệp';
                $commentText = $payload['comment'] ?? 'đã nhắc tên bạn';
                $commentTextPlain = strip_tags($commentText); // strip html tags for cleaner view
                
                $targetLink = $payload['link'] ?? '/';
                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $fullDirectLink = rtrim($frontendUrl, '/') . '/' . ltrim($targetLink, '/');

                return [
                    'recipients' => $recipients,
                    'title' => "$authorName vừa nhắc tên bạn",
                    'body' => "$authorName đã nhắc tên bạn trong bình luận: \"$commentTextPlain\"",
                    'type' => "mention",
                    'link' => $targetLink,
                    'zalo_msg' => "🏷️ [ ĐƯỢC TAG TÊN / MENTION ]\n\n"
                        . "$authorName vừa nhắc tên bạn trong ghi chú/thảo luận:\n"
                        . "  • Nội dung: \"$commentTextPlain\"\n\n"
                        . "👉 Xem chi tiết: $fullDirectLink",
                    'tg_msg' => "🏷️ <b>[ ĐƯỢC TAG TÊN / MENTION ]</b>\n\n"
                        . "<b>" . htmlspecialchars($authorName) . "</b> vừa nhắc tên bạn trong ghi chú/thảo luận:\n"
                        . "  • Nội dung: <i>\"" . htmlspecialchars($commentTextPlain) . "\"</i>\n\n"
                        . "👉 <a href=\"$fullDirectLink\"><b>Bấm vào đây để xem chi tiết</b></a>",
                    'email_subject' => "[IDEAS ERP] $authorName vừa nhắc tên bạn",
                    'email_title' => "NHẮC TÊN TRONG THẢO LUẬN",
                    'email_content' => "<div style=\"background: #f1f5f9; border-left: 4px solid #BD1D2D; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #0f172a; margin: 0 0 10px; font-size: 16px;\">" . htmlspecialchars($authorName) . " vừa nhắc tên bạn</h3>" .
                                    "  <p style=\"margin: 0; color: #334155;\">" . htmlspecialchars($authorName) . " đã nhắc tên bạn trong bình luận: \"" . htmlspecialchars($commentTextPlain) . "\"</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$fullDirectLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">ĐĂNG NHẬP HỆ THỐNG</a>" .
                                    "</p>"
                ];

            case 'TASK_COMMENT_NEW':
                $recipients = !empty($payload['recipients']) ? $payload['recipients'] : self::getRecipientById($db, (int)($payload['user_id'] ?? 0));
                $authorName = $payload['author_name'] ?? 'Đồng nghiệp';
                $taskTitle = $payload['task_title'] ?? 'Công việc';
                $commentText = $payload['comment'] ?? '';
                $commentTextPlain = strip_tags($commentText);
                
                $targetLink = $payload['link'] ?? '/workspace';
                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $fullDirectLink = rtrim($frontendUrl, '/') . '/' . ltrim($targetLink, '/');

                return [
                    'recipients' => $recipients,
                    'title' => "$authorName đã bình luận trong: $taskTitle",
                    'body' => "$authorName: \"$commentTextPlain\"",
                    'type' => "comment",
                    'link' => $targetLink,
                    'zalo_msg' => "💬 [ BÌNH LUẬN MỚI TRONG CÔNG VIỆC ]\n\n"
                        . "Người bình luận: $authorName\n"
                        . "Công việc: $taskTitle\n"
                        . "Nội dung: \"$commentTextPlain\"\n\n"
                        . "👉 Xem chi tiết: $fullDirectLink",
                    'tg_msg' => "💬 <b>[ BÌNH LUẬN MỚI TRONG CÔNG VIỆC ]</b>\n\n"
                        . "Người bình luận: <b>" . htmlspecialchars($authorName) . "</b>\n"
                        . "Công việc: <b>" . htmlspecialchars($taskTitle) . "</b>\n"
                        . "Nội dung: <i>\"" . htmlspecialchars($commentTextPlain) . "\"</i>\n\n"
                        . "👉 <a href=\"$fullDirectLink\"><b>Bấm vào đây để xem chi tiết</b></a>",
                    'email_subject' => "[IDEAS ERP] $authorName đã bình luận trong công việc: $taskTitle",
                    'email_title' => "BÌNH LUẬN MỚI TRONG CÔNG VIỆC",
                    'email_content' => "<div style=\"background: #f1f5f9; border-left: 4px solid #BD1D2D; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #0f172a; margin: 0 0 10px; font-size: 16px;\">" . htmlspecialchars($authorName) . " đã bình luận trong công việc</h3>" .
                                    "  <p style=\"margin: 0 0 8px; color: #64748b; font-size: 13px;\">Công việc: <strong>" . htmlspecialchars($taskTitle) . "</strong></p>" .
                                    "  <p style=\"margin: 0; color: #334155;\">\"" . htmlspecialchars($commentTextPlain) . "\"</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$fullDirectLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">ĐĂNG NHẬP HỆ THỐNG</a>" .
                                    "</p>"
                ];

            case 'WORKFLOW_TASK_ASSIGNED':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $taskTitle = $payload['task_title'] ?? 'Nhiệm vụ mới';
                $reason = $payload['reason'] ?? '';
                $dueDate = $payload['due_date'] ?? '';
                $bodyText = $reason ? $reason : "Bạn được giao công việc: $taskTitle" . ($dueDate ? " (Hạn: $dueDate)" : "");

                $stmtFe = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'frontend_url' LIMIT 1");
                $frontendUrl = $stmtFe ? ($stmtFe->fetchColumn() ?: 'https://myerp.ideas.edu.vn') : 'https://myerp.ideas.edu.vn';
                $taskLink = $payload['link'] ?? "/activities";
                $fullTaskLink = rtrim($frontendUrl, '/') . '/' . ltrim($taskLink, '/');

                return [
                    'recipients' => $recipients,
                    'title' => $taskTitle,
                    'body' => $bodyText,
                    'type' => "task",
                    'link' => $taskLink,
                    'zalo_msg' => "📋 [ CÔNG VIỆC ĐƯỢC GIAO ]\n\n"
                        . "Bạn vừa được giao nhiệm vụ mới:\n"
                        . "  • Tiêu đề: $taskTitle\n"
                        . ($dueDate ? "  • Hạn hoàn thành: $dueDate\n" : "")
                        . "\nVui lòng kiểm tra và xử lý.",
                    'tg_msg' => "📋 <b>[ CÔNG VIỆC ĐƯỢC GIAO ]</b>\n\n"
                        . "Bạn vừa được giao nhiệm vụ mới:\n"
                        . "  • Tiêu đề: <b>" . htmlspecialchars($taskTitle) . "</b>\n"
                        . ($dueDate ? "  • Hạn hoàn thành: <code>$dueDate</code>\n" : "")
                        . "\nVui lòng kiểm tra và xử lý.",
                    'email_subject' => "[IDEAS ERP] Bạn được giao công việc: $taskTitle",
                    'email_title' => "CÔNG VIỆC ĐƯỢC GIAO",
                    'email_content' => "<div style=\"background: #f1f5f9; border-left: 4px solid #BD1D2D; padding: 20px; margin: 0 0 25px 0; border-radius: 0 8px 8px 0;\">" .
                                    "  <h3 style=\"color: #0f172a; margin: 0 0 10px; font-size: 16px;\">" . htmlspecialchars($taskTitle) . "</h3>" .
                                    "  <p style=\"margin: 0; color: #334155;\">" . htmlspecialchars($bodyText) . "</p>" .
                                    "</div>" .
                                    "<p style=\"margin-top: 25px; text-align: center;\">" .
                                    "  <a href=\"{$fullTaskLink}\" target=\"_blank\" style=\"display: inline-block; background-color: #BD1D2D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase;\">XEM CÔNG VIỆC</a>" .
                                    "</p>"
                ];

            case 'PROFILE_ACCOUNT_UPDATE':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật hồ sơ & bảo mật tài khoản",
                    'body' => "Thông tin hồ sơ hoặc cài đặt tài khoản của bạn vừa được cập nhật thành công.",
                    'type' => "account",
                    'link' => "/personal-account",
                    'zalo_msg' => "🔒 [ BẢO MẬT TÀI KHOẢN ]\n\n"
                        . "Thông tin hồ sơ tài khoản của bạn vừa được cập nhật thành công.\n"
                        . "Nếu không phải bạn thực hiện, vui lòng liên hệ Admin ngay lập tức.",
                    'tg_msg' => "🔒 <b>[ BẢO MẬT TÀI KHOẢN ]</b>\n\n"
                        . "Thông tin hồ sơ tài khoản của bạn vừa được cập nhật thành công.\n"
                        . "Nếu không phải bạn thực hiện, vui lòng liên hệ Admin ngay lập tức.",
                    'email_subject' => "[IDEAS] Cập nhật thông tin hồ sơ tài khoản",
                    'email_title' => "THÔNG BÁO BẢO MẬT TÀI KHOẢN",
                    'email_content' => "Chào bạn,<br/><br/>" .
                                    "Thông tin hồ sơ tài khoản của bạn vừa được thay đổi.<br/>" .
                                    "Nếu không phải bạn thực hiện, vui lòng đổi mật khẩu và liên hệ Ban quản trị ngay."
                ];

            case 'PROJECT_ROSTER_UPDATE':
                $recipients = self::getAdminsAndManagers($db, $tenantId);
                $projectName = $payload['project_name'] ?? 'Dự án';
                return [
                    'recipients' => $recipients,
                    'title' => "Cập nhật lịch Roster dự án",
                    'body' => "Lịch trực Roster dự án $projectName vừa được cập nhật mới.",
                    'type' => "project",
                    'link' => "/projects",
                    'zalo_msg' => "🏢 [ CẬP NHẬT ROSTER DỰ ÁN ]\n\n"
                        . "Lịch trực ca và phân công nhân sự dự án $projectName vừa được cập nhật.\n"
                        . "Vui lòng xem chi tiết trên bảng Roster CRM.",
                    'tg_msg' => "🏢 <b>[ CẬP NHẬT ROSTER DỰ ÁN ]</b>\n\n"
                        . "Lịch trực ca và phân công nhân sự dự án <b>" . htmlspecialchars($projectName) . "</b> vừa được cập nhật.\n"
                        . "Vui lòng xem chi tiết trên bảng Roster CRM.",
                    'email_subject' => "[IDEAS] Cập nhật Lịch Roster dự án $projectName",
                    'email_title' => "CẬP NHẬT LỊCH ROSTER DỰ ÁN",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Danh sách phân công Roster dự án <strong>" . htmlspecialchars($projectName) . "</strong> vừa có thay đổi.<br/>" .
                                    "Vui lòng truy cập CRM để xem chi tiết."
                ];

            case 'MONTHLY_ATTENDANCE_REPORT':
                $recipients = !empty($payload['user_id']) ? self::getRecipientById($db, (int)$payload['user_id']) : self::getAllUsers($db, $tenantId);
                $periodText = $payload['period'] ?? 'Tháng vừa qua';
                $workDays = $payload['work_days'] ?? 0;
                $lateDays = $payload['late_days'] ?? 0;
                $lateMins = $payload['late_minutes'] ?? 0;
                $missingDays = $payload['missing_days'] ?? 0;
                $nightShifts = $payload['night_shifts'] ?? 0;
                $weekendShifts = $payload['weekend_shifts'] ?? 0;
                $holidayShifts = $payload['holiday_shifts'] ?? 0;

                $reportSummary = "• Ngày chấm công: $workDays ngày\n"
                    . "• Đi trễ: $lateDays lần ($lateMins phút)\n"
                    . "• Quên chấm (giờ hành chính): $missingDays ngày\n"
                    . "• Trực đêm: $nightShifts ca\n"
                    . "• Trực cuối tuần: $weekendShifts ca\n"
                    . ($holidayShifts > 0 ? "• Trực lễ: $holidayShifts ca\n" : "");

                return [
                    'recipients' => $recipients,
                    'title' => "Báo cáo Chấm công & Ca trực ($periodText)",
                    'body' => "Tổng kết $periodText: $workDays ngày công, $lateDays lần trễ ($lateMins phút), $missingDays ngày chưa chấm.",
                    'type' => "attendance_report",
                    'link' => "/sale-portal",
                    'zalo_msg' => "📊 [ BÁO CÁO CHẤM CÔNG & CA TRỰC - $periodText ]\n\n"
                        . "Chi tiết tổng kết cá nhân:\n"
                        . $reportSummary
                        . "\nVui lòng xem thêm chi tiết tại Sale Portal.",
                    'tg_msg' => "📊 <b>[ BÁO CÁO CHẤM CÔNG & CA TRỰC - $periodText ]</b>\n\n"
                        . "Chi tiết tổng kết cá nhân:\n"
                        . nl2br(htmlspecialchars($reportSummary))
                        . "\nVui lòng xem thêm chi tiết tại Sale Portal.",
                    'email_subject' => "[IDEAS] Báo cáo Chấm công & Ca trực - $periodText",
                    'email_title' => "BÁO CÁO CHẤM CÔNG & CA TRỰC",
                    'email_content' => "Chào <strong>$userName</strong>,<br/><br/>" .
                                    "Dưới đây là chi tiết báo cáo chấm công & ca trực kỳ <strong>$periodText</strong> của bạn:<br/>" .
                                    "<ul>" .
                                    "<li>Ngày đã chấm công hợp lệ: <strong>$workDays ngày</strong></li>" .
                                    "<li>Số lần đi trễ: <strong>$lateDays lần ($lateMins phút)</strong></li>" .
                                    "<li>Số ngày vắng/chưa chấm (giờ hành chính): <strong style='color:red;'>$missingDays ngày</strong></li>" .
                                    "<li>Ca trực đêm: <strong>$nightShifts ca</strong></li>" .
                                    "<li>Ca trực cuối tuần: <strong>$weekendShifts ca</strong></li>" .
                                    ($holidayShifts > 0 ? "<li>Ca trực lễ/tết: <strong>$holidayShifts ca</strong></li>" : "") .
                                    "</ul><br/>" .
                                    "Vui lòng truy cập hệ thống để đối soát thông tin."
                ];

            case 'HOLIDAY_ROSTER_OPEN':
                $recipients = self::getAllUsers($db, $tenantId);
                $holidayName = $payload['holiday_name'] ?? 'Lễ / Tết';
                $deadline = $payload['deadline'] ?? 'trước ngày trực';
                return [
                    'recipients' => $recipients,
                    'title' => "Mở đăng ký trực lễ $holidayName",
                    'body' => "Ban quản trị đã mở cổng đăng ký ca trực ngày lễ $holidayName. Hạn đăng ký: $deadline",
                    'type' => "roster",
                    'link' => "/roster",
                    'zalo_msg' => "🎉 [ MỞ ĐĂNG KÝ TRỰC LỄ / TẾT ]\n\n"
                        . "Hệ thống đã mở đăng ký trực ngày lễ $holidayName.\n"
                        . "  • Dịp lễ: $holidayName\n"
                        . "  • Hạn đăng ký: $deadline\n\n"
                        . "Vui lòng truy cập mục Lịch Roster để đăng ký ca trực.",
                    'tg_msg' => "🎉 <b>[ MỞ ĐĂNG KÝ TRỰC LỄ / TẾT ]</b>\n\n"
                        . "Hệ thống đã mở đăng ký trực ngày lễ <b>" . htmlspecialchars($holidayName) . "</b>.\n"
                        . "  • Dịp lễ: <b>" . htmlspecialchars($holidayName) . "</b>\n"
                        . "  • Hạn đăng ký: <code>$deadline</code>\n\n"
                        . "Vui lòng truy cập mục Lịch Roster để đăng ký ca trực.",
                    'email_subject' => "[IDEAS] Mở đăng ký trực lễ $holidayName",
                    'email_title' => "MỞ ĐĂNG KÝ TRỰC LỄ / TẾT",
                    'email_content' => "Chào toàn thể cán bộ nhân viên,<br/><br/>" .
                                    "Hệ thống đã mở cổng đăng ký ca trực dịp <strong>" . htmlspecialchars($holidayName) . "</strong>.<br/>" .
                                    "Hạn đăng ký: <strong>$deadline</strong>.<br/>" .
                                    "Vui lòng truy cập CRM để đăng ký ca trực."
                ];

            case 'HOLIDAY_ANNOUNCEMENT':
                $recipients = self::getAllUsers($db, $tenantId);
                $holidayName = $payload['holiday_name'] ?? 'Nghỉ lễ';
                $datesText = $payload['dates'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "Thông báo lịch nghỉ lễ $holidayName",
                    'body' => "Công ty thông báo lịch nghỉ lễ $holidayName" . ($datesText ? ": $datesText" : ""),
                    'type' => "announcement",
                    'link' => "/",
                    'zalo_msg' => "📢 [ THÔNG BÁO LỊCH NGHỈ LỄ ]\n\n"
                        . "Thông báo lịch nghỉ lễ $holidayName toàn công ty:\n"
                        . "  • Dịp lễ: $holidayName\n"
                        . ($datesText ? "  • Thời gian: $datesText\n" : "")
                        . "\nChúc toàn thể nhân viên có kỳ nghỉ lễ an toàn và vui vẻ!",
                    'tg_msg' => "📢 <b>[ THÔNG BÁO LỊCH NGHỈ LỄ ]</b>\n\n"
                        . "Thông báo lịch nghỉ lễ <b>" . htmlspecialchars($holidayName) . "</b> toàn công ty:\n"
                        . "  • Dịp lễ: <b>" . htmlspecialchars($holidayName) . "</b>\n"
                        . ($datesText ? "  • Thời gian: <code>$datesText</code>\n" : "")
                        . "\nChúc toàn thể nhân viên có kỳ nghỉ lễ an toàn và vui vẻ!",
                    'email_subject' => "[IDEAS] Thông báo lịch nghỉ lễ $holidayName",
                    'email_title' => "THÔNG BÁO LỊCH NGHỈ LỄ",
                    'email_content' => "Chào toàn thể cán bộ nhân viên,<br/><br/>" .
                                    "Công ty xin thông báo lịch nghỉ lễ <strong>" . htmlspecialchars($holidayName) . "</strong>.<br/>" .
                                    ($datesText ? "Thời gian nghỉ: <strong>$datesText</strong>.<br/><br/>" : "") .
                                    "Chúc toàn thể nhân viên kỳ nghỉ vui vẻ!"
                ];

            case 'HRM_LEAVE_REQUEST':
                $targetApproverId = (int)($payload['approver_id'] ?? $payload['target_user_id'] ?? 0);
                if ($targetApproverId === 0 && !empty($payload['user_id']) && !empty($payload['submitter_id']) && (int)$payload['user_id'] !== (int)$payload['submitter_id']) {
                    $targetApproverId = (int)$payload['user_id'];
                }
                if ($targetApproverId > 0) {
                    $recipients = self::getRecipientById($db, $targetApproverId);
                } else {
                    $submitterId = (int)($payload['submitter_id'] ?? $payload['user_id'] ?? 0);
                    $recipients = self::getApproversForEvent($db, $tenantId, 'leave', $submitterId);
                }
                $leaveType = $payload['leave_type_text'] ?? 'Nghỉ phép';
                $leaveDays = $payload['total_days'] ?? 1;
                $leavePeriod = ($payload['start_date'] ?? '') . ' -> ' . ($payload['end_date'] ?? '');
                
                $isWFH = strpos(mb_strtolower($leaveType), 'làm việc từ xa') !== false || strpos(mb_strtolower($leaveType), 'remote') !== false;
                $isOT = strpos(mb_strtolower($leaveType), 'tăng ca') !== false || strpos(mb_strtolower($leaveType), 'overtime') !== false;
                $isLateEarly = strpos(mb_strtolower($leaveType), 'đi trễ') !== false || strpos(mb_strtolower($leaveType), 'về sớm') !== false;
                
                $actionName = $isWFH ? "đăng ký Làm việc từ xa (WFH)" : ($isOT ? "đăng ký Tăng ca (OT)" : ($isLateEarly ? "đăng ký Đi trễ/Về sớm" : "đơn xin nghỉ $leaveType"));
                $headerTitle = $isWFH ? "ĐĂNG KÝ LÀM VIỆC TỪ XA" : ($isOT ? "ĐĂNG KÝ TĂNG CA" : ($isLateEarly ? "ĐĂNG KÝ ĐI TRỄ/VỀ SỚM" : "YÊU CẦU DUYỆT NGHỈ PHÉP"));
                $icon = $isWFH ? "🏠" : ($isOT ? "⏰" : ($isLateEarly ? "⏱️" : "🏖️"));

                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu phê duyệt ($leaveType)",
                    'body' => "Nhân viên $userName vừa gửi $actionName từ $leavePeriod ($leaveDays ngày/giờ). Lý do: \"$reason\"",
                    'type' => "leave",
                    'link' => "/approvals?open_id=" . ($payload['ref_id'] ?? '') . "&open_type=leave",
                    'zalo_msg' => "$icon [ $headerTitle MỚI ]\n\n"
                        . "Nhân viên: $userName\n"
                        . "Thời gian: $leavePeriod ($leaveDays ngày/giờ)\n"
                        . "Lý do: \"$reason\"\n\nVui lòng truy cập hệ thống IDEAS ERP để phê duyệt.",
                    'tg_msg' => "$icon <b>[ $headerTitle MỚI ]</b>\n\n"
                        . "Nhân viên: <b>$userName</b>\n"
                        . "Thời gian: <code>$leavePeriod</code> ($leaveDays ngày/giờ)\n"
                        . "Lý do: <i>\"$reason\"</i>\n\nVui lòng truy cập hệ thống IDEAS ERP để phê duyệt.",
                    'email_subject' => "[IDEAS] $headerTitle mới - $userName",
                    'email_title' => $headerTitle,
                    'email_content' => "Chào quản lý,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa gửi <strong>$actionName</strong> từ <strong>$leavePeriod</strong> ($leaveDays ngày/giờ).<br/>" .
                                    "Lý do: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập hệ thống IDEAS ERP để xem chi tiết và phê duyệt."
                ];

            case 'HRM_LEAVE_APPROVAL':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $leaveType = $payload['leave_type_text'] ?? 'Nghỉ phép';
                $statusText = $payload['status_text'] ?? 'được cập nhật';
                $leavePeriod = ($payload['start_date'] ?? '') . ' -> ' . ($payload['end_date'] ?? '');
                
                $isWFH = strpos(mb_strtolower($leaveType), 'làm việc từ xa') !== false || strpos(mb_strtolower($leaveType), 'remote') !== false;
                $isOT = strpos(mb_strtolower($leaveType), 'tăng ca') !== false || strpos(mb_strtolower($leaveType), 'overtime') !== false;
                $isLateEarly = strpos(mb_strtolower($leaveType), 'đi trễ') !== false || strpos(mb_strtolower($leaveType), 'về sớm') !== false;
                $isLeave = !$isWFH && !$isOT && !$isLateEarly;
                
                $actionName = $isWFH ? "Đăng ký Làm việc từ xa (WFH)" : ($isOT ? "Đăng ký Tăng ca (OT)" : ($isLateEarly ? "Đăng ký Đi trễ/Về sớm" : "Đơn xin nghỉ $leaveType"));
                $headerTitle = $isWFH ? "KẾT QUẢ DUYỆT LÀM VIỆC TỪ XA" : ($isOT ? "KẾT QUẢ DUYỆT TĂNG CA" : ($isLateEarly ? "KẾT QUẢ DUYỆT ĐI TRỄ/VỀ SỚM" : "KẾT QUẢ DUYỆT NGHỈ PHÉP"));
                
                $balanceStr = '';
                $balanceHtml = '';
                if ($isLeave && isset($payload['remaining_annual_leave'])) {
                    $balanceStr = "\nSố phép năm còn lại: " . $payload['remaining_annual_leave'] . " ngày. Nghỉ bù còn lại: " . ($payload['remaining_compensatory_leave'] ?? 0) . " ngày.";
                    $balanceHtml = "<br/><br/><strong>Số dư ngày phép hiện tại của bạn:</strong><br/>- Phép năm còn lại: <strong>" . $payload['remaining_annual_leave'] . " ngày</strong><br/>- Nghỉ bù còn lại: <strong>" . ($payload['remaining_compensatory_leave'] ?? 0) . " ngày</strong>";
                }

                $icon = ($payload['status'] ?? '') === 'rejected' ? '❌' : '✅';

                return [
                    'recipients' => $recipients,
                    'title' => "Kết quả duyệt: $leaveType",
                    'body' => "$actionName từ $leavePeriod của bạn đã được $statusText." . (!empty($reason) ? " Ghi chú: \"$reason\"" : "") . $balanceStr,
                    'type' => "leave",
                    'link' => "/approvals?open_id=" . ($payload['ref_id'] ?? '') . "&open_type=leave&open_status=" . ($payload['status'] ?? ''),
                    'zalo_msg' => "$icon [ $headerTitle ]\n\n"
                        . "$actionName ($leavePeriod) của bạn đã được $statusText.\n"
                        . (!empty($reason) ? "Ghi chú: \"$reason\"\n" : "") . $balanceStr,
                    'tg_msg' => "$icon <b>[ $headerTitle ]</b>\n\n"
                        . "$actionName (<code>$leavePeriod</code>) của bạn đã được <b>$statusText</b>.\n"
                        . (!empty($reason) ? "Ghi chú: <i>\"$reason\"</i>\n" : "") . $balanceStr,
                    'email_subject' => "[IDEAS] Kết quả duyệt $actionName của bạn",
                    'email_title' => $headerTitle,
                    'email_content' => "Chào <strong>$userName</strong>,<br/><br/>" .
                                    "$actionName từ <strong>$leavePeriod</strong> của bạn đã được <strong>$statusText</strong> bởi người phê duyệt.<br/>" .
                                    (!empty($reason) ? "Ghi chú: <em>\"$reason\"</em>." : "") . $balanceHtml
                ];

            case 'HRM_ADVANCE_REQUEST':
                $targetApproverId = (int)($payload['approver_id'] ?? $payload['target_user_id'] ?? 0);
                if ($targetApproverId === 0 && !empty($payload['user_id']) && !empty($payload['submitter_id']) && (int)$payload['user_id'] !== (int)$payload['submitter_id']) {
                    $targetApproverId = (int)$payload['user_id'];
                }
                if ($targetApproverId > 0) {
                    $recipients = self::getRecipientById($db, $targetApproverId);
                } else {
                    $submitterId = (int)($payload['submitter_id'] ?? $payload['user_id'] ?? 0);
                    $amt = (float)($payload['amount'] ?? 0);
                    $recipients = self::getApproversForEvent($db, $tenantId, 'advance', $submitterId, $amt);
                }
                $amountText = number_format((float)($payload['amount'] ?? 0), 0, ',', '.') . 'đ';
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu tạm ứng lương mới",
                    'body' => "Nhân viên $userName đề xuất tạm ứng số tiền $amountText. Lý do: \"$reason\"",
                    'type' => "expense",
                    'link' => "/approvals?open_id=" . ($payload['ref_id'] ?? '') . "&open_type=advance",
                    'zalo_msg' => "💸 [ YÊU CẦU TẠM ỨNG LƯƠNG MỚI ]\n\n"
                        . "Nhân viên: $userName\n"
                        . "Số tiền đề xuất: $amountText\n"
                        . "Lý do: \"$reason\"\n\nVui lòng truy cập trang Quản lý nhân sự để phê duyệt.",
                    'tg_msg' => "💸 <b>[ YÊU CẦU TẠM ỨNG LƯƠNG MỚI ]</b>\n\n"
                        . "Nhân viên: <b>$userName</b>\n"
                        . "Số tiền đề xuất: <b>$amountText</b>\n"
                        . "Lý do: <i>\"$reason\"</i>\n\nVui lòng truy cập trang Quản lý nhân sự để phê duyệt.",
                    'email_subject' => "[IDEAS] Yêu cầu tạm ứng lương mới - $userName",
                    'email_title' => "YÊU CẦU DUYỆT TẠM ỨNG LƯƠNG",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> vừa gửi đề xuất tạm ứng lương số tiền <strong>$amountText</strong>.<br/>" .
                                    "Lý do: <em>\"$reason\"</em>.<br/>" .
                                    "Vui lòng truy cập trang Quản lý nhân sự trên CRM để phê duyệt."
                ];

            case 'HRM_ADVANCE_APPROVAL':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $amountText = number_format((float)($payload['amount'] ?? 0), 0, ',', '.') . 'đ';
                $statusText = $payload['status_text'] ?? 'được cập nhật';
                return [
                    'recipients' => $recipients,
                    'title' => "Kết quả duyệt tạm ứng lương",
                    'body' => "Đề xuất tạm ứng $amountText của bạn đã được $statusText. Ghi chú: \"$reason\"",
                    'type' => "expense",
                    'link' => "/approvals?open_id=" . ($payload['ref_id'] ?? '') . "&open_type=advance&open_status=" . ($payload['status'] ?? ''),
                    'zalo_msg' => "✅ [ KẾT QUẢ DUYỆT TẠM ỨNG LƯƠNG ]\n\n"
                        . "Đề xuất tạm ứng $amountText của bạn đã được $statusText.\n"
                        . "Ghi chú: \"$reason\"",
                    'tg_msg' => "✅ <b>[ KẾT QUẢ DUYỆT TẠM ỨNG LƯƠNG ]</b>\n\n"
                        . "Đề xuất tạm ứng <b>$amountText</b> của bạn đã được <b>$statusText</b>.\n"
                        . "Ghi chú: <i>\"$reason\"</i>",
                    'email_subject' => "[IDEAS] Kết quả duyệt tạm ứng lương của bạn",
                    'email_title' => "KẾT QUẢ DUYỆT TẠM ỨNG LƯƠNG",
                    'email_content' => "Chào <strong>$userName</strong>,<br/><br/>" .
                                    "Yêu cầu tạm ứng số tiền <strong>$amountText</strong> của bạn đã được <strong>$statusText</strong> bởi quản lý.<br/>" .
                                    "Ghi chú/lý do: <em>\"$reason\"</em>."
                ];

            case 'HRM_PAYSLIP_PUBLISHED':
                $recipients = self::getRecipientById($db, $payload['user_id'] ?? 0);
                $monthYear = $payload['month_year'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "Phiếu lương tháng $monthYear đã phát hành",
                    'body' => "Phiếu lương tháng $monthYear của bạn đã được phát hành. Vui lòng truy cập Cổng nhân sự để ký nhận.",
                    'type' => "account",
                    'link' => "/my-payslips",
                    'zalo_msg' => "📊 [ PHÁT HÀNH PHIẾU LƯƠNG THÁNG $monthYear ]\n\n"
                        . "Phiếu lương tháng $monthYear của bạn đã được phát hành.\n"
                        . "Vui lòng truy cập Cổng nhân sự cá nhân (My HR) để ký xác nhận trực tuyến.",
                    'tg_msg' => "📊 <b>[ PHÁT HÀNH PHIẾU LƯƠNG THÁNG $monthYear ]</b>\n\n"
                        . "Phiếu lương tháng $monthYear của bạn đã được phát hành.\n"
                        . "Vui lòng truy cập Cổng nhân sự cá nhân (My HR) để ký xác nhận trực tuyến.",
                    'email_subject' => "[IDEAS] Thông báo phát hành Phiếu lương tháng $monthYear",
                    'email_title' => "PHÁT HÀNH PHIẾU LƯƠNG",
                    'email_content' => "Chào <strong>$userName</strong>,<br/><br/>" .
                                    "Phiếu lương tháng $monthYear của bạn đã được phát hành trên hệ thống.<br/>" .
                                    "Vui lòng đăng nhập CRM và vào mục <strong>Phiếu lương cá nhân (My HR)</strong> để ký xác nhận trực tuyến."
                ];

            case 'HRM_PAYSLIP_CONFIRMED':
                $stmtHr = $db->prepare("
                    SELECT u.id, u.email, u.role, u.full_name,
                           COALESCE(NULLIF(NULLIF(TRIM(u.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết'), NULLIF(NULLIF(TRIM(c.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết')) AS zalo_chat_id,
                           COALESCE(NULLIF(NULLIF(TRIM(u.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết'), NULLIF(NULLIF(TRIM(c.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết')) AS telegram_chat_id
                    FROM users u
                    LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
                    WHERE u.tenant_id = ? AND u.status = 'active' AND u.role IN ('hr', 'accountant')
                ");
                $stmtHr->execute([$tenantId]);
                $recipients = $stmtHr->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (empty($recipients)) {
                    $recipients = self::getAdminsAndManagers($db, $tenantId);
                }
                $monthYear = $payload['month_year'] ?? '';
                return [
                    'recipients' => $recipients,
                    'title' => "Xác nhận ký nhận phiếu lương tháng $monthYear",
                    'body' => "Nhân viên $userName đã ký xác nhận phiếu lương tháng $monthYear thành công.",
                    'type' => "account",
                    'link' => "/hrm?tab=payroll",
                    'zalo_msg' => "✍️ [ XÁC NHẬN KÝ NHẬN PHIẾU LƯƠNG ]\n\n"
                        . "Nhân viên: $userName\n"
                        . "Nội dung: Đã ký xác nhận phiếu lương tháng $monthYear.\n"
                        . "Trạng thái: Hoàn tất ký nhận trực tuyến.",
                    'tg_msg' => "✍️ <b>[ XÁC NHẬN KÝ NHẬN PHIẾU LƯƠNG ]</b>\n\n"
                        . "Nhân viên: <b>$userName</b>\n"
                        . "Nội dung: Đã ký xác nhận phiếu lương tháng <b>$monthYear</b>.\n"
                        . "Trạng thái: <b>Hoàn tất ký nhận trực tuyến</b>.",
                    'email_subject' => "[IDEAS] Nhân viên $userName đã ký nhận phiếu lương tháng $monthYear",
                    'email_title' => "NHÂN VIÊN KÝ NHẬN PHIẾU LƯƠNG",
                    'email_content' => "Chào quản trị viên,<br/><br/>" .
                                    "Nhân viên <strong>$userName</strong> đã hoàn tất ký số trực tuyến xác nhận phiếu lương tháng $monthYear.<br/>" .
                                    "Vui lòng kiểm tra lịch sử ký trên hệ thống CRM."
                ];

            case 'PO_WAITING_APPROVAL':
                $recipients = self::getRecipientById($db, (int)($payload['target_user_id'] ?? 0));
                $poNumber = $payload['po_number'] ?? '';
                $currentLevel = $payload['current_level'] ?? 1;
                $poId = $payload['po_id'] ?? 0;
                return [
                    'recipients' => $recipients,
                    'title' => "Yêu cầu phê duyệt đơn nhập hàng",
                    'body' => "Đơn nhập hàng " . $poNumber . " đang chờ bạn phê duyệt Cấp " . $currentLevel,
                    'type' => "purchase_order",
                    'link' => "/purchase-orders?open_id=" . $poId,
                    'zalo_msg' => "📦 [ YÊU CẦU PHÊ DUYỆT ĐƠN NHẬP HÀNG ]\n\n"
                        . "Đơn nhập hàng $poNumber đang chờ bạn phê duyệt Cấp $currentLevel.\n"
                        . "  • Mã đơn: $poNumber\n"
                        . "  • Cấp phê duyệt: Cấp $currentLevel\n\n"
                        . "Vui lòng truy cập hệ thống CRM để xử lý.",
                    'tg_msg' => "📦 <b>[ YÊU CẦU PHÊ DUYỆT ĐƠN NHẬP HÀNG ]</b>\n\n"
                        . "Đơn nhập hàng <b>$poNumber</b> đang chờ bạn phê duyệt Cấp <b>$currentLevel</b>.\n"
                        . "  • Mã đơn: <code>$poNumber</code>\n"
                        . "  • Cấp phê duyệt: Cấp <b>$currentLevel</b>\n\n"
                        . "Vui lòng truy cập hệ thống CRM để xử lý.",
                    'email_subject' => "[IDEAS] Đơn nhập hàng $poNumber chờ phê duyệt Cấp $currentLevel",
                    'email_title' => "YÊU CẦU PHÊ DUYỆT ĐƠN NHẬP HÀNG",
                    'email_content' => "Chào quản trị viên/Người phê duyệt,<br/><br/>"
                        . "Đơn nhập hàng <strong>$poNumber</strong> đang chờ bạn phê duyệt Cấp $currentLevel.<br/>"
                        . "Vui lòng truy cập hệ thống CRM để xử lý."
                ];

            case 'PO_APPROVED':
                $recipients = self::getRecipientById($db, (int)($payload['target_user_id'] ?? 0));
                $poNumber = $payload['po_number'] ?? '';
                $poId = $payload['po_id'] ?? 0;
                return [
                    'recipients' => $recipients,
                    'title' => "Đơn nhập hàng đã được phê duyệt",
                    'body' => "Đơn nhập hàng " . $poNumber . " đã được phê duyệt hoàn tất",
                    'type' => "purchase_order",
                    'link' => "/purchase-orders?open_id=" . $poId,
                    'zalo_msg' => "✅ [ ĐƠN NHẬP HÀNG ĐÃ ĐƯỢC PHÊ DUYỆT ]\n\n"
                        . "Đơn nhập hàng $poNumber của bạn đã được phê duyệt hoàn tất.\n"
                        . "  • Mã đơn: $poNumber\n"
                        . "  • Trạng thái: Đã phê duyệt (Approved)\n\n"
                        . "Vui lòng kiểm tra trên hệ thống CRM.",
                    'tg_msg' => "✅ <b>[ ĐƠN NHẬP HÀNG ĐÃ ĐƯỢC PHÊ DUYỆT ]</b>\n\n"
                        . "Đơn nhập hàng <b>$poNumber</b> của bạn đã được phê duyệt hoàn tất.\n"
                        . "  • Mã đơn: <code>$poNumber</code>\n"
                        . "  • Trạng thái: <b>Đã phê duyệt (Approved)</b>\n\n"
                        . "Vui lòng kiểm tra trên hệ thống CRM.",
                    'email_subject' => "[IDEAS] Đơn nhập hàng $poNumber đã được phê duyệt",
                    'email_title' => "ĐƠN NHẬP HÀNG ĐÃ ĐƯỢC PHÊ DUYỆT",
                    'email_content' => "Chào bạn,<br/><br/>"
                        . "Đơn nhập hàng <strong>$poNumber</strong> của bạn đã được phê duyệt hoàn tất.<br/>"
                        . "Vui lòng truy cập hệ thống CRM để kiểm tra."
                ];

            case 'PO_REJECTED':
                $recipients = self::getRecipientById($db, (int)($payload['target_user_id'] ?? 0));
                $poNumber = $payload['po_number'] ?? '';
                $poId = $payload['po_id'] ?? 0;
                return [
                    'recipients' => $recipients,
                    'title' => "Đơn nhập hàng đã bị từ chối",
                    'body' => "Đơn nhập hàng " . $poNumber . " đã bị từ chối phê duyệt",
                    'type' => "purchase_order",
                    'link' => "/purchase-orders?open_id=" . $poId,
                    'zalo_msg' => "❌ [ ĐƠN NHẬP HÀNG ĐÃ BỊ TỪ CHỐI ]\n\n"
                        . "Đơn nhập hàng $poNumber của bạn đã bị từ chối phê duyệt.\n"
                        . "  • Mã đơn: $poNumber\n"
                        . "  • Trạng thái: Bị từ chối (Rejected)\n\n"
                        . "Vui lòng kiểm tra lý do trên hệ thống CRM.",
                    'tg_msg' => "❌ <b>[ ĐƠN NHẬP HÀNG ĐÃ BỊ TỪ CHỐI ]</b>\n\n"
                        . "Đơn nhập hàng <b>$poNumber</b> của bạn đã bị từ chối phê duyệt.\n"
                        . "  • Mã đơn: <code>$poNumber</code>\n"
                        . "  • Trạng thái: <b>Bị từ chối (Rejected)</b>\n\n"
                        . "Vui lòng kiểm tra lý do trên hệ thống CRM.",
                    'email_subject' => "[IDEAS] Đơn nhập hàng $poNumber đã bị từ chối",
                    'email_title' => "ĐƠN NHẬP HÀNG ĐÃ BỊ TỪ CHỐI",
                    'email_content' => "Chào bạn,<br/><br/>"
                        . "Đơn nhập hàng <strong>$poNumber</strong> của bạn đã bị từ chối phê duyệt.<br/>"
                        . "Vui lòng truy cập hệ thống CRM để kiểm tra chi tiết."
                ];

            default:
                return null;
        }
    }

    private static function getRecipientById(PDO $db, int $userId): array {
        if ($userId <= 0) return [];
        $stmt = $db->prepare("
            SELECT u.id, u.email, u.role,
                   COALESCE(
                     NULLIF(NULLIF(TRIM(u.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết'), 
                     NULLIF(NULLIF(TRIM(c.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết')
                   ) AS zalo_chat_id,
                   COALESCE(
                     NULLIF(NULLIF(TRIM(u.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết'), 
                     NULLIF(NULLIF(TRIM(c.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết')
                   ) AS telegram_chat_id,
                   u.full_name,
                   c.id AS is_consultant
            FROM users u
            LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
            WHERE u.id = ?
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? [$row] : [];
    }

    private static function getAllUsers(PDO $db, int $tenantId): array {
        $stmt = $db->prepare("
            SELECT u.id, u.email, u.role,
                   COALESCE(
                     NULLIF(NULLIF(TRIM(u.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết'), 
                     NULLIF(NULLIF(TRIM(c.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết')
                   ) AS zalo_chat_id,
                   COALESCE(
                     NULLIF(NULLIF(TRIM(u.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết'), 
                     NULLIF(NULLIF(TRIM(c.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết')
                   ) AS telegram_chat_id,
                   u.full_name,
                   c.id AS is_consultant
            FROM users u
            LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
            WHERE u.tenant_id = ? AND u.is_active = 1
        ");
        $stmt->execute([$tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Get list of admin and manager user accounts
     */
    private static function getAdminsAndManagers(PDO $db, int $tenantId, $teamId = null): array {
        // If teamId is given, target the direct team leader / co-leaders
        if (!empty($teamId)) {
            $stmtTeam = $db->prepare("SELECT leader_id, co_leader_ids FROM teams WHERE id = ? LIMIT 1");
            $stmtTeam->execute([$teamId]);
            $teamRow = $stmtTeam->fetch(PDO::FETCH_ASSOC);
            if ($teamRow) {
                $leaderIds = [];
                if (!empty($teamRow['leader_id'])) $leaderIds[] = (int)$teamRow['leader_id'];
                if (!empty($teamRow['co_leader_ids'])) {
                    foreach (explode(',', $teamRow['co_leader_ids']) as $cid) {
                        if (is_numeric(trim($cid))) $leaderIds[] = (int)trim($cid);
                    }
                }
                $leaderIds = array_unique(array_filter($leaderIds));
                if (!empty($leaderIds)) {
                    $inPlace = implode(',', array_fill(0, count($leaderIds), '?'));
                    $stmtL = $db->prepare("
                        SELECT u.id, u.email, u.role,
                               COALESCE(NULLIF(NULLIF(TRIM(u.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết'), NULLIF(NULLIF(TRIM(c.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết')) AS zalo_chat_id,
                               COALESCE(NULLIF(NULLIF(TRIM(u.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết'), NULLIF(NULLIF(TRIM(c.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết')) AS telegram_chat_id,
                               u.full_name, c.id AS is_consultant
                        FROM users u
                        LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
                        WHERE u.id IN ($inPlace) AND u.status = 'active'
                    ");
                    $stmtL->execute(array_values($leaderIds));
                    $teamApprovers = $stmtL->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    if (!empty($teamApprovers)) {
                        return $teamApprovers;
                    }
                }
            }
        }

        // Fallback: HR & Admin only (do NOT spam all other unrelated team managers or directors)
        $sql = "
            SELECT u.id, u.email, u.role,
                   COALESCE(NULLIF(NULLIF(TRIM(u.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết'), NULLIF(NULLIF(TRIM(c.zalo_chat_id), 'chưa liên kết'), 'Chưa liên kết')) AS zalo_chat_id,
                   COALESCE(NULLIF(NULLIF(TRIM(u.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết'), NULLIF(NULLIF(TRIM(c.telegram_chat_id), 'chưa liên kết'), 'Chưa liên kết')) AS telegram_chat_id,
                   u.full_name, c.id AS is_consultant
            FROM users u
            LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
            WHERE u.tenant_id = ? 
              AND u.status = 'active'
              AND u.role IN ('admin', 'superadmin', 'super_admin', 'hr')
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([$tenantId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Smart Enterprise ERP Approval Routing Engine (3-level Escalation Chain)
     * Level 1: Team Leader / Co-Leader of submitter's Team (if enabled)
     * Level 2: Designated Roles / Users configured in system_settings
     * Level 3: Fallback System Admins
     */
    public static function getApproversForEvent(PDO $db, int $tenantId, string $moduleKey, ?int $submitterUserId = null, float $amount = 0.0): array {
        try {
            $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'approval_matrix_config' LIMIT 1");
            $stmt->execute();
            $rawJson = $stmt->fetchColumn();
            $matrixConfig = $rawJson ? (json_decode($rawJson, true) ?: []) : [];

            $modCfg = $matrixConfig[$moduleKey] ?? [];

            // Level 1: Check Team Leader
            if (!empty($modCfg['enable_team_leader']) && $submitterUserId > 0) {
                $stmtUser = $db->prepare("SELECT team_id FROM users WHERE id = ? LIMIT 1");
                $stmtUser->execute([$submitterUserId]);
                $teamId = $stmtUser->fetchColumn();

                if ($teamId) {
                    $stmtTeam = $db->prepare("SELECT leader_id, co_leader_ids FROM teams WHERE id = ? LIMIT 1");
                    $stmtTeam->execute([$teamId]);
                    $teamRow = $stmtTeam->fetch(PDO::FETCH_ASSOC);

                    if ($teamRow) {
                        $leaderIds = [];
                        if (!empty($teamRow['leader_id'])) $leaderIds[] = (int)$teamRow['leader_id'];
                        if (!empty($teamRow['co_leader_ids'])) {
                            $coList = explode(',', $teamRow['co_leader_ids']);
                            foreach ($coList as $cid) {
                                if (is_numeric(trim($cid))) $leaderIds[] = (int)trim($cid);
                            }
                        }
                        $leaderIds = array_unique(array_filter($leaderIds));
                        
                        if (!empty($leaderIds)) {
                            $inPlace = implode(',', array_fill(0, count($leaderIds), '?'));
                            $stmtL = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE id IN ($inPlace) AND status = 'active'");
                            $stmtL->execute(array_values($leaderIds));
                            $teamApprovers = $stmtL->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            if (!empty($teamApprovers)) {
                                return $teamApprovers;
                            }
                        }
                    }
                }
            }

            // Level 2: Check Designated Roles / Users
            $roles = $modCfg['designated_roles'] ?? [];
            $userIds = $modCfg['designated_user_ids'] ?? [];

            // Money Tiers for Expenses (Dynamic Non-hardcoded Thresholds)
            if ($moduleKey === 'expense' && !empty($modCfg['money_tiers']) && is_array($modCfg['money_tiers'])) {
                foreach ($modCfg['money_tiers'] as $tier) {
                    $maxAmt = $tier['max_amount'] ?? null;
                    if ($maxAmt === null || (float)$maxAmt <= 0 || $amount <= (float)$maxAmt) {
                        $appType = $tier['approver_type'] ?? '';
                        if ($appType === 'team_leader' && $submitterUserId > 0) {
                            $stmtUser = $db->prepare("SELECT team_id FROM users WHERE id = ? LIMIT 1");
                            $stmtUser->execute([$submitterUserId]);
                            $tId = $stmtUser->fetchColumn();
                            if ($tId) {
                                $stmtTeam = $db->prepare("SELECT leader_id, co_leader_ids FROM teams WHERE id = ? LIMIT 1");
                                $stmtTeam->execute([$tId]);
                                $tRow = $stmtTeam->fetch(PDO::FETCH_ASSOC);
                                if ($tRow) {
                                    $lIds = [];
                                    if (!empty($tRow['leader_id'])) $lIds[] = (int)$tRow['leader_id'];
                                    if (!empty($tRow['co_leader_ids'])) {
                                        foreach (explode(',', $tRow['co_leader_ids']) as $cid) {
                                            if (is_numeric(trim($cid))) $lIds[] = (int)trim($cid);
                                        }
                                    }
                                    if (!empty($lIds)) {
                                        $inP = implode(',', array_fill(0, count($lIds), '?'));
                                        $stmtL = $db->prepare("SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE id IN ($inP) AND status = 'active'");
                                        $stmtL->execute(array_values($lIds));
                                        $tApprovers = $stmtL->fetchAll(PDO::FETCH_ASSOC) ?: [];
                                        if (!empty($tApprovers)) return $tApprovers;
                                    }
                                }
                            }
                        }
                        if (!empty($tier['roles'])) $roles = $tier['roles'];
                        if (!empty($tier['user_ids'])) $userIds = $tier['user_ids'];
                        break;
                    }
                }
            }

            if (!empty($roles) || !empty($userIds)) {
                $whereClauses = [];
                $params = [$tenantId];

                if (!empty($roles)) {
                    $inRoles = implode(',', array_fill(0, count($roles), '?'));
                    $whereClauses[] = "role IN ($inRoles)";
                    foreach ($roles as $r) $params[] = $r;
                }
                if (!empty($userIds)) {
                    $inIds = implode(',', array_fill(0, count($userIds), '?'));
                    $whereClauses[] = "id IN ($inIds)";
                    foreach ($userIds as $uid) $params[] = (int)$uid;
                }

                $whereStr = implode(' OR ', $whereClauses);
                $sql = "SELECT id, email, zalo_chat_id, telegram_chat_id, full_name FROM users WHERE tenant_id = ? AND status = 'active' AND ($whereStr)";
                $stmtD = $db->prepare($sql);
                $stmtD->execute($params);
                $desigApprovers = $stmtD->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (!empty($desigApprovers)) {
                    return $desigApprovers;
                }
            }
        } catch (\Throwable $e) {
            error_log("Error resolving approvers: " . $e->getMessage());
        }

        // Level 3: Fallback System Admins
        return self::getAdminsAndManagers($db, $tenantId);
    }

    /**
     * Verify if a specific user has approval authority for a given module & submitter
     */
    public static function canUserApproveModule(PDO $db, int $tenantId, string $moduleKey, int $currentUserId, ?int $submitterUserId = null, float $amount = 0.0): bool {
        try {
            // Admin and Super Admin always have approval authority
            $stmtRole = $db->prepare("SELECT role FROM users WHERE id = ? LIMIT 1");
            $stmtRole->execute([$currentUserId]);
            $userRole = strtolower($stmtRole->fetchColumn() ?: '');
            if (in_array($userRole, ['admin', 'superadmin', 'super_admin'])) {
                return true;
            }

            // Exclude non-manager / standard sale staff
            if (in_array($userRole, ['sale', 'employee', 'staff'])) {
                return false;
            }

            // Resolve list of valid approvers for this event
            $approvers = self::getApproversForEvent($db, $tenantId, $moduleKey, $submitterUserId, $amount);
            foreach ($approvers as $app) {
                if ((int)($app['id'] ?? 0) === $currentUserId) {
                    return true;
                }
            }

            // Additional check: If current user is Team Leader of submitter, grant permission when enable_team_leader is active
            if ($submitterUserId > 0 && $submitterUserId !== $currentUserId) {
                $stmtJson = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'approval_matrix_config' LIMIT 1");
                $stmtJson->execute();
                $rawJson = $stmtJson->fetchColumn();
                $matrixConfig = $rawJson ? (json_decode($rawJson, true) ?: []) : [];
                $modCfg = $matrixConfig[$moduleKey] ?? [];

                if (!empty($modCfg['enable_team_leader'])) {
                    $stmtUser = $db->prepare("SELECT team_id FROM users WHERE id = ? LIMIT 1");
                    $stmtUser->execute([$submitterUserId]);
                    $subTeamId = $stmtUser->fetchColumn();

                    if ($subTeamId) {
                        $stmtTeam = $db->prepare("SELECT leader_id, co_leader_ids FROM teams WHERE id = ? LIMIT 1");
                        $stmtTeam->execute([$subTeamId]);
                        $tRow = $stmtTeam->fetch(PDO::FETCH_ASSOC);

                        if ($tRow) {
                            if ((int)($tRow['leader_id'] ?? 0) === $currentUserId) return true;
                            if (!empty($tRow['co_leader_ids'])) {
                                $coList = array_map('trim', explode(',', $tRow['co_leader_ids']));
                                if (in_array((string)$currentUserId, $coList)) return true;
                            }
                        }
                    }
                }
            }

            return false;
        } catch (\Throwable $e) {
            error_log("Error checking user approval permission: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Helper: Fetch all active users for tenant
     */
    public static function getAllActiveUsers(PDO $db, int $tenantId): array {
        try {
            $stmt = $db->prepare("
                SELECT id, email, full_name, role, zalo_chat_id, telegram_chat_id 
                FROM users 
                WHERE (is_active = 1 OR status = 'active') AND (tenant_id = ? OR ? = 0)
            ");
            $stmt->execute([$tenantId, $tenantId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
            error_log("Error in getAllActiveUsers: " . $e->getMessage());
            return [];
        }
    }
}
