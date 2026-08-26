<?php
// backend/cron_academic_reminders.php
// Cron job to automatically send thesis milestone reminders, class session reminders, assignment deadlines, and urgent upcoming session alerts.

// --- PREVENT CONCURRENT EXECUTION (CHỐNG XUNG ĐỘT) ---
$lockFile = sys_get_temp_dir() . '/cron_academic_reminders_' . md5(__DIR__) . '.lock';
$lockFp = @fopen($lockFile, 'w');
if (!$lockFp) {
    echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
    exit(1);
}
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_academic_reminders.php is already running. Exiting.\n";
    fclose($lockFp);
    exit(0);
}
// --- END PREVENT CONCURRENT EXECUTION ---

echo "[" . date('Y-m-d H:i:s') . "] Starting automated academic reminders check...\n";

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/mailer.php';

try {
    // 1. Fetch active campaigns with non-empty reminders_json
    $res = $conn->query("SELECT id, name, tenant_id, subjects_json, thesis_milestones_json, reminders_json FROM marketing_campaigns WHERE status = 'active'");
    if (!$res) {
        throw new Exception("Error querying campaigns: " . $conn->error);
    }

    $countThesisReminders = 0;
    $countLecturerReminders = 0;
    $countSchoolReminders = 0;
    $countIdeasReminders = 0;
    $countAssignReminders = 0;
    $countUpcomingReminders = 0;

    $todayStr = date('Y-m-d');
    $nowTime = time();

    while ($camp = $res->fetch_assoc()) {
        $reminders = !empty($camp['reminders_json']) ? json_decode($camp['reminders_json'], true) : [];
        if (empty($reminders)) {
            continue;
        }

        // --- FETCH CAMPAIGN STUDENTS (CONTACTS) ---
        $studentsList = [];
        $stmtC = $conn->prepare("SELECT id, name, email, phone FROM contacts WHERE campaign_id = ? AND tenant_id = ? AND pipeline_status = (SELECT COALESCE(setting_value, 'hoc_vien') FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1) AND deleted_at IS NULL");
        $stmtC->bind_param("ii", $camp['id'], $camp['tenant_id']);
        $stmtC->execute();
        $resStudents = $stmtC->get_result();
        while ($student = $resStudents->fetch_assoc()) {
            if (!empty($student['email'])) {
                $studentsList[] = $student;
            }
        }
        $stmtC->close();

        // --- DECODE SUBJECTS ---
        $subjects = !empty($camp['subjects_json']) ? json_decode($camp['subjects_json'], true) : [];
        if (!is_array($subjects)) {
            $subjects = [];
        }

        // --- A. LECTURER SEMINAR REMINDERS ---
        $lectEnabled = false;
        $lectHours = 12;
        if (isset($reminders['lecturer_reminder_enabled'])) {
            $lectEnabled = (bool)$reminders['lecturer_reminder_enabled'];
            $lectHours = intval($reminders['lecturer_reminder_hours'] ?? 12);
        } else if (isset($reminders['lecturer_seminar']['enabled'])) {
            $lectEnabled = (bool)$reminders['lecturer_seminar']['enabled'];
            $lectHours = intval($reminders['lecturer_seminar']['hours_before'] ?? 12);
        }

        if ($lectEnabled && !empty($subjects)) {
            foreach ($subjects as $sub) {
                if (empty($sub['seminars'])) continue;
                $subLecturerId = $sub['lecturer_id'] ?? null;

                foreach ($sub['seminars'] as $semIdx => $sem) {
                    if (empty($sem['date'])) continue;

                    $startTime = '08:30';
                    if (!empty($sem['session1_start'])) {
                        $startTime = $sem['session1_start'];
                    } else if (!empty($sem['time_slot'])) {
                        $parts = explode('-', $sem['time_slot']);
                        if (!empty($parts[0])) {
                            $startTime = trim($parts[0]);
                        }
                    }

                    $semDateTimeStr = $sem['date'] . ' ' . $startTime;
                    $semTimestamp = strtotime($semDateTimeStr);
                    $reminderStartTimestamp = $semTimestamp - ($lectHours * 3600);

                    if ($nowTime >= $reminderStartTimestamp && $nowTime < $semTimestamp) {
                        $notifyType = "acad_lect_" . $camp['id'] . "_" . ($sub['id'] ?? 'sub') . "_" . $semIdx;
                        $lectId = !empty($sem['lecturer_id']) ? $sem['lecturer_id'] : $subLecturerId;
                        if (!$lectId) continue;

                        $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ?");
                        $chk->bind_param("is", $lectId, $notifyType);
                        $chk->execute();
                        $alreadySent = $chk->get_result()->num_rows > 0;
                        $chk->close();

                        if (!$alreadySent) {
                            $stmtL = $conn->prepare("SELECT name, email, phone FROM companies WHERE id = ?");
                            $stmtL->bind_param("i", $lectId);
                            $stmtL->execute();
                            $lectInfo = $stmtL->get_result()->fetch_assoc();
                            $stmtL->close();

                            if (!$lectInfo) {
                                $stmtL = $conn->prepare("SELECT name, email, phone FROM consultants WHERE id = ?");
                                $stmtL->bind_param("i", $lectId);
                                $stmtL->execute();
                                $lectInfo = $stmtL->get_result()->fetch_assoc();
                                $stmtL->close();
                            }

                            if ($lectInfo) {
                                $lectName = $lectInfo['name'];
                                $lectEmail = $lectInfo['email'];

                                $msgTitle = "⏰ NHẮC NHỞ LỊCH GIẢNG DẠY CHUYÊN ĐỀ";
                                $msgBody = "Chào Thầy/Cô $lectName, đây là nhắc nhở tự động về lịch giảng dạy chuyên đề: \"{$sem['topic']}\" vào ngày " . date('d/m/Y', strtotime($sem['date'])) . " lúc $startTime. Địa điểm: " . ($sem['location'] ?? 'Online') . ". Vui lòng chuẩn bị và lên lớp đúng giờ.";

                                if (!empty($lectEmail)) {
                                    try {
                                        sendEmailNotification($lectEmail, "[IDEAS] Nhắc nhở lịch giảng dạy chuyên đề - Thầy/Cô $lectName", $msgTitle, nl2br($msgBody));
                                        echo "  [Lecturer] Email sent to $lectName ($lectEmail)\n";
                                    } catch (\Throwable $emEx) {
                                        echo "  [Lecturer] Email send error: " . $emEx->getMessage() . "\n";
                                    }
                                }

                                $ins = $conn->prepare("INSERT INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
                                $ins->bind_param("iss", $lectId, $notifyType, $todayStr);
                                $ins->execute();
                                $ins->close();

                                $countLecturerReminders++;
                            }
                        }
                    }
                }
            }
        }

        // --- B. THESIS MILESTONE REMINDERS ---
        $thesisEnabled = false;
        $thesisHours = 12;
        if (isset($reminders['thesis_reminder_enabled'])) {
            $thesisEnabled = (bool)$reminders['thesis_reminder_enabled'];
            $thesisHours = intval($reminders['thesis_reminder_hours'] ?? 12);
        } else if (isset($reminders['thesis_milestone']['enabled'])) {
            $thesisEnabled = (bool)$reminders['thesis_milestone']['enabled'];
            $thesisHours = intval($reminders['thesis_milestone']['hours_before'] ?? 12);
        }

        if ($thesisEnabled && !empty($camp['thesis_milestones_json']) && !empty($studentsList)) {
            $milestones = json_decode($camp['thesis_milestones_json'], true) ?: [];

            foreach ($milestones as $msIdx => $ms) {
                if (empty($ms['due_date'])) continue;

                $dueDateTimeStr = $ms['due_date'] . ' 09:00:00';
                $dueTimestamp = strtotime($dueDateTimeStr);
                $reminderStartTimestamp = $dueTimestamp - ($thesisHours * 3600);

                if ($nowTime >= $reminderStartTimestamp && $nowTime < $dueTimestamp) {
                    $notifyType = "acad_thesis_" . $camp['id'] . "_" . $msIdx;

                    foreach ($studentsList as $student) {
                        $studentId = $student['id'];

                        $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ?");
                        $chk->bind_param("is", $studentId, $notifyType);
                        $chk->execute();
                        $alreadySent = $chk->get_result()->num_rows > 0;
                        $chk->close();

                        if (!$alreadySent) {
                            $studName = $student['name'];
                            $studEmail = $student['email'];

                            $msgTitle = "⏰ NHẮC NHỞ CỘT MỐC LUẬN VĂN";
                            $msgBody = "Chào Anh/Chị $studName, đây là thông báo nhắc nhở tự động về hạn hoàn thành cột mốc luận văn/đề cương: \"{$ms['milestone']}\" trước ngày " . date('d/m/Y', strtotime($ms['due_date'])) . ". Vui lòng hoàn thành đúng tiến độ.";

                            if (!empty($studEmail)) {
                                try {
                                    sendEmailNotification($studEmail, "[IDEAS] Nhắc nhở hạn nộp luận văn: {$ms['milestone']}", $msgTitle, nl2br($msgBody));
                                    echo "  [Thesis] Email sent to student $studName ($studEmail)\n";
                                } catch (\Throwable $emEx) {
                                    echo "  [Thesis] Email send error: " . $emEx->getMessage() . "\n";
                                }
                            }

                            $ins = $conn->prepare("INSERT INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
                            $ins->bind_param("iss", $studentId, $notifyType, $todayStr);
                            $ins->execute();
                            $ins->close();

                            $countThesisReminders++;
                        }
                    }
                }
            }
        }

        // --- C. SCHOOL SESSIONS REMINDERS (STUDENT) ---
        $schoolEnabled = (bool)($reminders['school_reminder_enabled'] ?? false);
        $schoolHours = intval($reminders['school_reminder_hours'] ?? 12);

        if ($schoolEnabled && !empty($studentsList) && !empty($subjects)) {
            foreach ($subjects as $sub) {
                if (empty($sub['host_sessions'])) continue;
                foreach ($sub['host_sessions'] as $sessionIdx => $session) {
                    if (empty($session['date'])) continue;

                    $timeStart = !empty($session['time_start']) ? $session['time_start'] : '20:00';
                    $sessionDateTimeStr = $session['date'] . ' ' . $timeStart;
                    $sessionTimestamp = strtotime($sessionDateTimeStr);
                    $reminderStartTimestamp = $sessionTimestamp - ($schoolHours * 3600);

                    if ($nowTime >= $reminderStartTimestamp && $nowTime < $sessionTimestamp) {
                        $notifyType = "acad_school_" . $camp['id'] . "_" . ($sub['id'] ?? 'sub') . "_" . ($session['id'] ?? $sessionIdx);

                        foreach ($studentsList as $student) {
                            $studentId = $student['id'];

                            $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ?");
                            $chk->bind_param("is", $studentId, $notifyType);
                            $chk->execute();
                            $alreadySent = $chk->get_result()->num_rows > 0;
                            $chk->close();

                            if (!$alreadySent) {
                                $studName = $student['name'];
                                $studEmail = $student['email'];

                                $msgTitle = "⏰ NHẮC NHỞ LỊCH HỌC CHÍNH THỨC";
                                $msgBody = "Chào Anh/Chị $studName, đây là thông báo nhắc nhở tự động về buổi học chính thức tại trường của môn: \"{$sub['name']}\" ({$sub['code']}) diễn ra vào ngày " . date('d/m/Y', strtotime($session['date'])) . " lúc $timeStart. Vui lòng tham gia lớp học đầy đủ và đúng giờ.";

                                try {
                                    sendEmailNotification($studEmail, "[IDEAS] Nhắc nhở lịch học chính thức - Môn {$sub['name']}", $msgTitle, nl2br($msgBody));
                                    echo "  [School] Email sent to student $studName ($studEmail)\n";
                                } catch (\Throwable $emEx) {}

                                $ins = $conn->prepare("INSERT INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
                                $ins->bind_param("iss", $studentId, $notifyType, $todayStr);
                                $ins->execute();
                                $ins->close();

                                $countSchoolReminders++;
                            }
                        }
                    }
                }
            }
        }

        // --- D. IDEAS SEMINARS REMINDERS (STUDENT) ---
        $ideasEnabled = (bool)($reminders['ideas_reminder_enabled'] ?? false);
        $ideasHours = intval($reminders['ideas_reminder_hours'] ?? 12);

        if ($ideasEnabled && !empty($studentsList) && !empty($subjects)) {
            foreach ($subjects as $sub) {
                if (empty($sub['seminars'])) continue;
                foreach ($sub['seminars'] as $semIdx => $sem) {
                    if (empty($sem['date'])) continue;

                    $startTime = '08:30';
                    if (!empty($sem['session1_start'])) {
                        $startTime = $sem['session1_start'];
                    } else if (!empty($sem['time_slot'])) {
                        $parts = explode('-', $sem['time_slot']);
                        if (!empty($parts[0])) {
                            $startTime = trim($parts[0]);
                        }
                    }

                    $semDateTimeStr = $sem['date'] . ' ' . $startTime;
                    $semTimestamp = strtotime($semDateTimeStr);
                    $reminderStartTimestamp = $semTimestamp - ($ideasHours * 3600);

                    if ($nowTime >= $reminderStartTimestamp && $nowTime < $semTimestamp) {
                        $notifyType = "acad_ideas_" . $camp['id'] . "_" . ($sub['id'] ?? 'sub') . "_" . ($sem['id'] ?? $semIdx);

                        foreach ($studentsList as $student) {
                            $studentId = $student['id'];

                            $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ?");
                            $chk->bind_param("is", $studentId, $notifyType);
                            $chk->execute();
                            $alreadySent = $chk->get_result()->num_rows > 0;
                            $chk->close();

                            if (!$alreadySent) {
                                $studName = $student['name'];
                                $studEmail = $student['email'];

                                $msgTitle = "⏰ NHẮC NHỞ LỊCH HỌC LỚP CHUYÊN ĐỀ";
                                $msgBody = "Chào Anh/Chị $studName, đây là thông báo nhắc nhở tự động về lớp học chuyên đề IDEAS: \"{$sem['topic']}\" của môn: \"{$sub['name']}\" diễn ra vào ngày " . date('d/m/Y', strtotime($sem['date'])) . " lúc $startTime. Địa điểm: " . ($sem['location'] ?? 'Online') . ". Vui lòng tham gia đầy đủ và đúng giờ.";

                                try {
                                    sendEmailNotification($studEmail, "[IDEAS] Nhắc nhở lịch học chuyên đề - Môn {$sub['name']}", $msgTitle, nl2br($msgBody));
                                    echo "  [Ideas] Email sent to student $studName ($studEmail)\n";
                                } catch (\Throwable $emEx) {}

                                $ins = $conn->prepare("INSERT INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
                                $ins->bind_param("iss", $studentId, $notifyType, $todayStr);
                                $ins->execute();
                                $ins->close();

                                $countIdeasReminders++;
                            }
                        }
                    }
                }
            }
        }

        // --- E. ASSIGNMENTS / QUIZZES REMINDERS (STUDENT) ---
        $assignEnabled = (bool)($reminders['assignment_reminder_enabled'] ?? false);
        $assignHours = intval($reminders['assignment_reminder_hours'] ?? 12);

        if ($assignEnabled && !empty($studentsList) && !empty($subjects)) {
            foreach ($subjects as $sub) {
                if (empty($sub['assignments'])) continue;
                foreach ($sub['assignments'] as $asnIdx => $asn) {
                    if (empty($asn['due_date'])) continue;

                    $dueStr = $asn['due_date'];
                    if (strlen($dueStr) <= 10) {
                        $dueStr .= ' 23:59:59';
                    } else {
                        $dueStr = str_replace('T', ' ', $dueStr);
                    }
                    $dueTimestamp = strtotime($dueStr);
                    $reminderStartTimestamp = $dueTimestamp - ($assignHours * 3600);

                    if ($nowTime >= $reminderStartTimestamp && $nowTime < $dueTimestamp) {
                        $notifyType = "acad_assign_" . $camp['id'] . "_" . ($sub['id'] ?? 'sub') . "_" . ($asn['id'] ?? $asnIdx);

                        foreach ($studentsList as $student) {
                            $studentId = $student['id'];

                            $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ?");
                            $chk->bind_param("is", $studentId, $notifyType);
                            $chk->execute();
                            $alreadySent = $chk->get_result()->num_rows > 0;
                            $chk->close();

                            if (!$alreadySent) {
                                $studName = $student['name'];
                                $studEmail = $student['email'];

                                $msgTitle = "⏰ NHẮC NHỞ HẠN NỘP BÀI TẬP / QUIZ";
                                $msgBody = "Chào Anh/Chị $studName, đây là nhắc nhở tự động về hạn chót (Deadline) nộp bài tập: \"{$asn['name']}\" của môn: \"{$sub['name']}\" vào lúc " . date('H:i d/m/Y', $dueTimestamp) . ". Anh/Chị vui lòng hoàn thành và nộp bài đúng hạn.";

                                try {
                                    sendEmailNotification($studEmail, "[IDEAS] Nhắc nhở hạn nộp bài tập: {$asn['name']}", $msgTitle, nl2br($msgBody));
                                    echo "  [Assign] Email sent to student $studName ($studEmail)\n";
                                } catch (\Throwable $emEx) {}

                                $ins = $conn->prepare("INSERT INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
                                $ins->bind_param("iss", $studentId, $notifyType, $todayStr);
                                $ins->execute();
                                $ins->close();

                                $countAssignReminders++;
                            }
                        }
                    }
                }
            }
        }

        // --- F. URGENT UPCOMING SESSION REMINDERS (STUDENT) ---
        $upcomingEnabled = (bool)($reminders['upcoming_session_reminder_enabled'] ?? true);
        $upcomingMinutes = intval($reminders['upcoming_session_reminder_minutes'] ?? 5);

        if ($upcomingEnabled && !empty($studentsList) && !empty($subjects)) {
            $allSessionsByDate = [];

            foreach ($subjects as $sub) {
                // School host sessions
                if (!empty($sub['host_sessions'])) {
                    foreach ($sub['host_sessions'] as $sessionIdx => $session) {
                        if (empty($session['date'])) continue;
                        $date = $session['date'];
                        $time = !empty($session['time_start']) ? $session['time_start'] : '20:00';
                        $allSessionsByDate[$date][] = [
                            'time' => $time,
                            'type' => 'school',
                            'title' => "Buổi học trường môn " . ($sub['name'] ?? ''),
                            'id' => $session['id'] ?? ('school_' . $sessionIdx),
                            'sub_name' => $sub['name'] ?? '',
                            'sub_code' => $sub['code'] ?? '',
                            'zoom_info' => [
                                'link' => $sub['school_zoom_link'] ?? $sub['zoom_link'] ?? '',
                                'id' => $sub['school_zoom_id'] ?? $sub['zoom_id'] ?? '',
                                'pass' => $sub['school_zoom_pass'] ?? $sub['zoom_pass'] ?? ''
                            ]
                        ];
                    }
                }

                // IDEAS Seminars
                if (!empty($sub['seminars'])) {
                    foreach ($sub['seminars'] as $semIdx => $sem) {
                        if (empty($sem['date'])) continue;
                        $date = $sem['date'];
                        $time = '08:30';
                        if (!empty($sem['session1_start'])) {
                            $time = $sem['session1_start'];
                        } else if (!empty($sem['time_slot'])) {
                            $parts = explode('-', $sem['time_slot']);
                            if (!empty($parts[0])) {
                                $time = trim($parts[0]);
                            }
                        }
                        $allSessionsByDate[$date][] = [
                            'time' => $time,
                            'type' => 'seminar',
                            'title' => "Buổi chuyên đề: " . ($sem['topic'] ?? ''),
                            'id' => $sem['id'] ?? ('sem_' . $semIdx),
                            'sub_name' => $sub['name'] ?? '',
                            'sub_code' => $sub['code'] ?? '',
                            'zoom_info' => [
                                'link' => $sub['seminar_zoom_link'] ?? $sub['zoom_link'] ?? '',
                                'id' => $sub['seminar_zoom_id'] ?? $sub['zoom_id'] ?? '',
                                'pass' => $sub['seminar_zoom_pass'] ?? $sub['zoom_pass'] ?? ''
                            ]
                        ];
                    }
                }
            }

            // Keep only the first scheduled session for each day (BUỔI đầu trong ngày)
            $firstSessions = [];
            foreach ($allSessionsByDate as $date => $daySessions) {
                if (empty($daySessions)) continue;
                usort($daySessions, function($a, $b) {
                    return strcmp($a['time'], $b['time']);
                });
                $firstSessions[] = array_merge($daySessions[0], ['date' => $date]);
            }

            // Run alerts
            foreach ($firstSessions as $sess) {
                $sessDateTimeStr = $sess['date'] . ' ' . $sess['time'];
                $sessTimestamp = strtotime($sessDateTimeStr);
                $reminderStartTimestamp = $sessTimestamp - ($upcomingMinutes * 60);

                if ($nowTime >= $reminderStartTimestamp && $nowTime < $sessTimestamp) {
                    $notifyType = "acad_upcoming_" . $camp['id'] . "_" . $sess['type'] . "_" . $sess['id'];

                    foreach ($studentsList as $student) {
                        $studentId = $student['id'];

                        $chk = $conn->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ?");
                        $chk->bind_param("is", $studentId, $notifyType);
                        $chk->execute();
                        $alreadySent = $chk->get_result()->num_rows > 0;
                        $chk->close();

                        if (!$alreadySent) {
                            $studName = $student['name'];
                            $studEmail = $student['email'];

                            $zoomInfoText = "";
                            if (!empty($sess['zoom_info']['link'])) {
                                $zoomInfoText = "\nLiên kết học trực tuyến Zoom: " . $sess['zoom_info']['link'];
                                if (!empty($sess['zoom_info']['id'])) {
                                    $zoomInfoText .= "\nID cuộc họp: " . $sess['zoom_info']['id'];
                                }
                                if (!empty($sess['zoom_info']['pass'])) {
                                    $zoomInfoText .= "\nMật mã: " . $sess['zoom_info']['pass'];
                                }
                            }

                            $msgTitle = "⚡️ LỊCH HỌC SẮP BẮT ĐẦU (TRONG " . $upcomingMinutes . " PHÚT NỮA)";
                            $msgBody = "Chào Anh/Chị $studName, đây là thông báo khẩn nhắc nhở lớp học sắp diễn ra sau ít phút:\n"
                                     . "• Tiết học: {$sess['title']}\n"
                                     . "• Môn học: {$sess['sub_name']} ({$sess['sub_code']})\n"
                                     . "• Thời gian bắt đầu: {$sess['time']} hôm nay ({$sess['date']})."
                                     . $zoomInfoText
                                     . "\n\nAnh/Chị vui lòng chuẩn bị thiết bị và truy cập lớp học đúng giờ.";

                            try {
                                sendEmailNotification($studEmail, "[IDEAS] Lớp học sắp bắt đầu - {$sess['title']}", $msgTitle, nl2br($msgBody));
                                echo "  [Upcoming] Email sent to student $studName ($studEmail)\n";
                            } catch (\Throwable $emEx) {}

                            $ins = $conn->prepare("INSERT INTO sent_notifications (user_id, notify_type, notify_date) VALUES (?, ?, ?)");
                            $ins->bind_param("iss", $studentId, $notifyType, $todayStr);
                            $ins->execute();
                            $ins->close();

                            $countUpcomingReminders++;
                        }
                    }
                }
            }
        }
    }

    echo "[" . date('Y-m-d H:i:s') . "] Completed check. Sent: \n"
       . "  - $countLecturerReminders lecturer seminar reminders\n"
       . "  - $countThesisReminders student thesis reminders\n"
       . "  - $countSchoolReminders student school session reminders\n"
       . "  - $countIdeasReminders student ideas seminar reminders\n"
       . "  - $countAssignReminders student assignment reminders\n"
       . "  - $countUpcomingReminders student upcoming session alerts.\n";

} catch (Throwable $e) {
    echo "[" . date('Y-m-d H:i:s') . "] ERROR in academic reminders cron: " . $e->getMessage() . "\n";
}

// Release lock
flock($lockFp, LOCK_UN);
fclose($lockFp);

