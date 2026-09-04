<?php
// backend/controllers/CheckInController.php

class CheckInController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function index(array $auth): void {
        // Option to check only today's check-in for the logged-in user (useful for dashboard/buttons)
        if (isset($_GET['today_only']) && $_GET['today_only'] == '1') {
            $today = date('Y-m-d');
            $row = null;
            try {
                $stmt = $this->db->prepare("
                    SELECT c.*, 
                           IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_start_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS work_start_time,
                           IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_end_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1)) AS work_end_time,
                           u.full_name as user_name
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.user_id = ? AND c.check_in_date = ?
                ");
                $stmt->execute([$auth['user_id'], $today]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
            } catch (\Throwable $e) {
                try {
                    $stmt = $this->db->prepare("
                        SELECT c.*, 
                               (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1) AS work_start_time,
                               (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1) AS work_end_time,
                               u.full_name as user_name
                        FROM check_ins c
                        JOIN users u ON c.user_id = u.id
                        WHERE c.user_id = ? AND c.check_in_date = ?
                    ");
                    $stmt->execute([$auth['user_id'], $today]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                } catch (\Throwable $e2) {}
            }

            // If no check_ins record exists or status is rejected, check if user submitted an attendance update for today that is pending approval
            if (!$row || $row['status'] === 'rejected') {
                try {
                    // Check bulk requests
                    $bulkStmt = $this->db->prepare("
                        SELECT d.id, d.suggested_check_in, d.suggested_check_out, r.id as request_id, r.status
                        FROM attendance_bulk_request_details d
                        JOIN attendance_bulk_requests r ON d.request_id = r.id
                        WHERE r.user_id = ? AND d.date = ? AND r.status IN ('pending_manager', 'pending_hr', 'pending')
                        ORDER BY r.id DESC LIMIT 1
                    ");
                    $bulkStmt->execute([$auth['user_id'], $today]);
                    $bulkDetail = $bulkStmt->fetch(PDO::FETCH_ASSOC);

                    if ($bulkDetail) {
                        $row = [
                            'id' => 0,
                            'user_id' => $auth['user_id'],
                            'check_in_date' => $today,
                            'check_in_time' => $bulkDetail['suggested_check_in'] ?? null,
                            'check_out_time' => $bulkDetail['suggested_check_out'] ?? null,
                            'status' => 'pending_approval',
                            'pending_explanation_today' => true,
                            'is_bulk_pending' => true,
                            'bulk_request_id' => $bulkDetail['request_id'],
                            'work_start_time' => '08:00',
                            'work_end_time' => '17:00',
                            'user_name' => $auth['full_name'] ?? ''
                        ];
                    } else {
                        // Check single attendance requests
                        $reqStmt = $this->db->prepare("
                            SELECT id, status, requested_time
                            FROM attendance_requests
                            WHERE user_id = ? AND date = ? AND status = 'pending'
                            ORDER BY id DESC LIMIT 1
                        ");
                        $reqStmt->execute([$auth['user_id'], $today]);
                        $singleReq = $reqStmt->fetch(PDO::FETCH_ASSOC);
                        if ($singleReq) {
                            $row = [
                                'id' => 0,
                                'user_id' => $auth['user_id'],
                                'check_in_date' => $today,
                                'check_in_time' => $singleReq['requested_time'] ?? null,
                                'check_out_time' => null,
                                'status' => 'pending_approval',
                                'pending_explanation_today' => true,
                                'request_id' => $singleReq['id'],
                                'work_start_time' => '08:00',
                                'work_end_time' => '17:00',
                                'user_name' => $auth['full_name'] ?? ''
                            ];
                        }
                    }
                } catch (\Throwable $e3) {}
            }

            respond(200, $row ?: null, 'Lấy thông tin check-in hôm nay thành công');
        }

        $isManager = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'hr'], true);
        
        try {
            $sql = "SELECT c.*, u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar, 
                           IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_start_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1)) AS work_start_time,
                           IF(COALESCE(u.use_custom_work_hours, 0) = 1, u.work_end_time, (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1)) AS work_end_time
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE u.tenant_id = ?";
        } catch (\Throwable $e) {
            $sql = "SELECT c.*, u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar, 
                           (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_start_time' LIMIT 1) AS work_start_time,
                           (SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_end_time' LIMIT 1) AS work_end_time
                    FROM check_ins c
                    JOIN users u ON c.user_id = u.id
                    WHERE u.tenant_id = ?";
        }
        
        $params = [$auth['tenant_id']];

        // RLS: Sales can only see their own check-ins. Managers see their team's (where they are leader or belong to).
        if ($auth['role'] === 'manager') {
            $sql .= " AND (u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (u.team_id IS NOT NULL AND u.team_id = (SELECT team_id FROM users WHERE id = ?)))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
            if (isset($_GET['user_id']) && !empty($_GET['user_id']) && $_GET['user_id'] !== 'all') {
                $sql .= " AND c.user_id = ?";
                $params[] = (int)$_GET['user_id'];
            }
        } else if (!$isManager) {
            $sql .= " AND c.user_id = ?";
            $params[] = $auth['user_id'];
        } else {
            // Admin/Assistant/Superadmin filtering
            if (isset($_GET['user_id']) && !empty($_GET['user_id']) && $_GET['user_id'] !== 'all') {
                $sql .= " AND c.user_id = ?";
                $params[] = (int)$_GET['user_id'];
            }
        }

        if (isset($_GET['month']) && !empty($_GET['month'])) {
            $sql .= " AND YEAR(c.check_in_date) = ? AND MONTH(c.check_in_date) = ?";
            $params[] = (int)($_GET['year'] ?? date('Y'));
            $params[] = (int)$_GET['month'];
        } elseif (isset($_GET['from']) && !empty($_GET['from']) && isset($_GET['to']) && !empty($_GET['to'])) {
            $sql .= " AND c.check_in_date BETWEEN ? AND ?";
            $params[] = $_GET['from'];
            $params[] = $_GET['to'];
        } elseif (isset($_GET['date']) && !empty($_GET['date']) && $_GET['date'] !== 'all') {
            $sql .= " AND c.check_in_date = ?";
            $params[] = $_GET['date'];
        }

        if (isset($_GET['status']) && !empty($_GET['status']) && $_GET['status'] !== 'all') {
            $sql .= " AND c.status = ?";
            $params[] = $_GET['status'];
        }

        $sql .= " ORDER BY c.check_in_date DESC, c.check_in_time DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll() ?: [];

        if (isset($_GET['include_shifts']) && $_GET['include_shifts'] == '1') {
            $shifts = [];
            $userIdFilter = null;
            if (isset($_GET['user_id']) && !empty($_GET['user_id']) && $_GET['user_id'] !== 'all') {
                $userIdFilter = (int)$_GET['user_id'];
            }

            if (isset($_GET['month']) && !empty($_GET['month'])) {
                $year = (int)($_GET['year'] ?? date('Y'));
                $month = (int)$_GET['month'];

                // 1. Night shifts
                $nightSql = "SELECT 'night' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                             FROM night_shift_registrations r 
                             JOIN users u ON r.user_id = u.id 
                             WHERE YEAR(r.shift_date) = ? AND MONTH(r.shift_date) = ?";
                $nightParams = [$year, $month];
                if ($userIdFilter !== null) {
                    $nightSql .= " AND r.user_id = ?";
                    $nightParams[] = $userIdFilter;
                }
                $stmtNight = $this->db->prepare($nightSql);
                $stmtNight->execute($nightParams);
                $shifts = array_merge($shifts, $stmtNight->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 2. Weekend shifts
                $weekendSql = "SELECT 'weekend' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM weekend_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE YEAR(r.shift_date) = ? AND MONTH(r.shift_date) = ?";
                $weekendParams = [$year, $month];
                if ($userIdFilter !== null) {
                    $weekendSql .= " AND r.user_id = ?";
                    $weekendParams[] = $userIdFilter;
                }
                $stmtWeekend = $this->db->prepare($weekendSql);
                $stmtWeekend->execute($weekendParams);
                $shifts = array_merge($shifts, $stmtWeekend->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 3. Holiday shifts
                $holidaySql = "SELECT 'holiday' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, r.holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM holiday_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE YEAR(r.shift_date) = ? AND MONTH(r.shift_date) = ?";
                $holidayParams = [$year, $month];
                if ($userIdFilter !== null) {
                    $holidaySql .= " AND r.user_id = ?";
                    $holidayParams[] = $userIdFilter;
                }
                $stmtHoliday = $this->db->prepare($holidaySql);
                $stmtHoliday->execute($holidayParams);
                $shifts = array_merge($shifts, $stmtHoliday->fetchAll(PDO::FETCH_ASSOC) ?: []);

            } else if (isset($_GET['from']) && !empty($_GET['from']) && isset($_GET['to']) && !empty($_GET['to'])) {
                $from = $_GET['from'];
                $to = $_GET['to'];

                // 1. Night shifts
                $nightSql = "SELECT 'night' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                             FROM night_shift_registrations r 
                             JOIN users u ON r.user_id = u.id 
                             WHERE r.shift_date BETWEEN ? AND ?";
                $nightParams = [$from, $to];
                if ($userIdFilter !== null) {
                    $nightSql .= " AND r.user_id = ?";
                    $nightParams[] = $userIdFilter;
                }
                $stmtNight = $this->db->prepare($nightSql);
                $stmtNight->execute($nightParams);
                $shifts = array_merge($shifts, $stmtNight->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 2. Weekend shifts
                $weekendSql = "SELECT 'weekend' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, '' as holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM weekend_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE r.shift_date BETWEEN ? AND ?";
                $weekendParams = [$from, $to];
                if ($userIdFilter !== null) {
                    $weekendSql .= " AND r.user_id = ?";
                    $weekendParams[] = $userIdFilter;
                }
                $stmtWeekend = $this->db->prepare($weekendSql);
                $stmtWeekend->execute($weekendParams);
                $shifts = array_merge($shifts, $stmtWeekend->fetchAll(PDO::FETCH_ASSOC) ?: []);

                // 3. Holiday shifts
                $holidaySql = "SELECT 'holiday' as shift_type, r.id, r.user_id, r.shift_date, r.approved, r.created_at, u.full_name as user_name, r.holiday_name, u.avatar_url as user_avatar, u.email as user_email 
                               FROM holiday_shift_registrations r 
                               JOIN users u ON r.user_id = u.id 
                               WHERE r.shift_date BETWEEN ? AND ?";
                $holidayParams = [$from, $to];
                if ($userIdFilter !== null) {
                    $holidaySql .= " AND r.user_id = ?";
                    $holidayParams[] = $userIdFilter;
                }
                $stmtHoliday = $this->db->prepare($holidaySql);
                $stmtHoliday->execute($holidayParams);
                $shifts = array_merge($shifts, $stmtHoliday->fetchAll(PDO::FETCH_ASSOC) ?: []);
            }

            respond(200, [
                'check_ins' => $rows,
                'shifts' => $shifts
            ], 'Lấy danh sách check-in và trực ca thành công');
        }

        respond(200, $rows, 'Lấy danh sách check-in thành công');
    }

    public function store(array $auth): void {
        $b = getBody();
        $selfieUrl = trim($b['selfie_url'] ?? '');
        $reason = trim($b['reason'] ?? '');
        $today = trim($b['check_in_date'] ?? date('Y-m-d'));
        $currentTime = trim($b['check_in_time'] ?? date('H:i:s'));
        $action = trim($b['action'] ?? ''); // 'checkin' or 'checkout' or auto-detect
        
        $isSupplementary = ($today !== date('Y-m-d')) || (!empty($b['is_supplementary']));

        // Chặn chấm công hoặc cập nhật công cho tương lai
        if ($today > date('Y-m-d') || ($today === date('Y-m-d') && $currentTime > date('H:i:s'))) {
            respond(400, null, 'Không thể chấm công hoặc cập nhật công cho thời gian trong tương lai.', false);
            return;
        }

        // Fetch system settings for checkout & auto-approve requirements
        $stmtSettings = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('require_checkin_weekend_lead', 'require_checkin_holiday_lead', 'holiday_schedules', 'require_checkout', 'auto_approve_checkin', 'global_work_start_time', 'global_work_end_time', 'global_work_schedule', 'office_latitude', 'office_longitude', 'office_allowed_radius')");
        $stmtSettings->execute();
        $settingsMap = $stmtSettings->fetchAll(PDO::FETCH_KEY_PAIR);

        $reqCheckout = isset($settingsMap['require_checkout']) ? (int)$settingsMap['require_checkout'] : 1;
        $autoApprove = isset($settingsMap['auto_approve_checkin']) ? (int)$settingsMap['auto_approve_checkin'] : 1;
        $reqWeekend = isset($settingsMap['require_checkin_weekend_lead']) ? (int)$settingsMap['require_checkin_weekend_lead'] : 0;
        $reqHoliday = isset($settingsMap['require_checkin_holiday_lead']) ? (int)$settingsMap['require_checkin_holiday_lead'] : 0;

        // Tự động kiểm tra và hoàn trả quỹ phép khi nhân viên đi làm lại và check-in (Chỉ áp dụng khi Chấm công Vào ca, không áp dụng khi Ra ca)
        if ($action !== 'checkout') {
            try {
                $stmtActiveLeave = $this->db->prepare("
                    SELECT id, leave_type, start_date, end_date, total_days, unpaid_days, reason
                    FROM hrm_leave_requests
                    WHERE user_id = ? AND status = 'approved'
                      AND ? BETWEEN DATE(start_date) AND DATE(end_date)
                      AND leave_type IN ('annual', 'compensatory', 'special_paid', 'unpaid', 'sick')
                ");
                $stmtActiveLeave->execute([$auth['user_id'], $today]);
                $activeLeaves = $stmtActiveLeave->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($activeLeaves)) {
                    foreach ($activeLeaves as $lv) {
                        $startHour = (int)date('H', strtotime($lv['start_date']));
                        $currentHour = (int)date('H', strtotime($currentTime));

                        // Nếu nhân viên check-in sáng (< 12:00) nhưng đơn phép là nghỉ nửa buổi chiều (>= 12:00) -> Không hủy đơn chiều
                        if ($currentHour < 12 && $startHour >= 12) {
                            continue;
                        }

                        $lvId = (int)$lv['id'];
                        $lvType = $lv['leave_type'];
                        $lvTotalDays = (float)$lv['total_days'];
                        $lvReason = $lv['reason'] ?? '';

                        $refundDays = ($lvTotalDays <= 0.5) ? $lvTotalDays : 1.0;
                        $refundComp = 0.0;
                        $refundAnnual = 0.0;

                        if ($lvType === 'compensatory') {
                            $refundComp = $refundDays;
                        } elseif ($lvType === 'annual') {
                            $refundAnnual = $refundDays;
                        } elseif ($lvType === 'special_paid') {
                            if (preg_match('/-(\d+(?:\.\d+)?) ngày phép bù/', $lvReason, $mComp)) {
                                $refundComp = min($refundDays, (float)$mComp[1]);
                            }
                            if (preg_match('/-(\d+(?:\.\d+)?) ngày phép năm/', $lvReason, $mAnn)) {
                                $refundAnnual = min($refundDays - $refundComp, (float)$mAnn[1]);
                            }
                        }

                        // 1. Hoàn trả số ngày phép/nghỉ bù đã trừ vào hrm_profiles
                        if ($refundComp > 0 || $refundAnnual > 0) {
                            $upProf = $this->db->prepare("
                                UPDATE hrm_profiles 
                                SET compensatory_leave_used = GREATEST(0.0, compensatory_leave_used - ?),
                                    annual_leave_used = GREATEST(0.0, annual_leave_used - ?)
                                WHERE user_id = ?
                            ");
                            $upProf->execute([$refundComp, $refundAnnual, $auth['user_id']]);
                        }

                        // 2. Cập nhật hoặc hủy đơn nghỉ phép
                        if ($lvTotalDays <= 1.0) {
                            $upLv = $this->db->prepare("
                                UPDATE hrm_leave_requests 
                                SET status = 'cancelled', 
                                    reason = CONCAT(COALESCE(reason, ''), '\n[Tự động hủy đơn & hoàn trả ', ?, ' ngày phép do nhân viên đã đi làm và check-in ngày ', ?, ']')
                                WHERE id = ?
                            ");
                            $upLv->execute([$refundDays, $today, $lvId]);
                        } else {
                            $newTotal = max(0.0, $lvTotalDays - $refundDays);
                            $upLv = $this->db->prepare("
                                UPDATE hrm_leave_requests 
                                SET total_days = ?, 
                                    reason = CONCAT(COALESCE(reason, ''), '\n[Tự động hoàn trả ', ?, ' ngày phép do nhân viên đã đi làm và check-in ngày ', ?, ']')
                                WHERE id = ?
                            ");
                            $upLv->execute([$newTotal, $refundDays, $today, $lvId]);
                        }

                        // 3. Xóa consultant_leaves ngày hôm nay để khôi phục trạng thái làm việc
                        try {
                            $delCLeave = $this->db->prepare("DELETE FROM consultant_leaves WHERE consultant_id = ? AND start_date <= ? AND end_date >= ?");
                            $delCLeave->execute([$auth['user_id'], $today, $today]);
                            $this->db->prepare("UPDATE users SET leave_start = NULL, leave_end = NULL WHERE id = ? AND (leave_start = ? OR leave_end = ?)")->execute([$auth['user_id'], $today, $today]);
                        } catch (\Throwable $e) {}
                    }
                }
            } catch (\Throwable $e) {}
        }

        // Fetch existing check_in record for today
        $stmtExisting = $this->db->prepare("SELECT * FROM check_ins WHERE user_id = ? AND check_in_date = ? LIMIT 1");
        $stmtExisting->execute([$auth['user_id'], $today]);
        $existingRow = $stmtExisting->fetch(PDO::FETCH_ASSOC);

        // Fetch user work hours and custom schedule
        $stmtUser = $this->db->prepare("SELECT work_start_time, work_end_time, use_custom_work_hours, work_schedule FROM users WHERE id = ?");
        $stmtUser->execute([$auth['user_id']]);
        $uRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
        
        $workStartTime = '08:00';
        $workEndTime = '17:00';
        $workScheduleJson = null;
        if ($uRow) {
            if ((int)($uRow['use_custom_work_hours'] ?? 0) === 1) {
                $workStartTime = $uRow['work_start_time'] ?: '08:00';
                $workEndTime = $uRow['work_end_time'] ?: '17:00';
                $workScheduleJson = $uRow['work_schedule'] ?? null;
            } else {
                $workStartTime = $settingsMap['global_work_start_time'] ?? '08:00';
                $workEndTime = $settingsMap['global_work_end_time'] ?? '17:00';
                $workScheduleJson = $settingsMap['global_work_schedule'] ?? null;
            }
        }

        $dayOfWeek = (int)date('N', strtotime($today));
        $todaySchedule = null;
        if (!empty($workScheduleJson)) {
            $parsedSched = json_decode($workScheduleJson, true);
            if (is_array($parsedSched) && isset($parsedSched[$dayOfWeek])) {
                $todaySchedule = $parsedSched[$dayOfWeek];
            }
        }

        // Extract session times for today
        $morningStart = $workStartTime;
        $morningEnd = '12:00';
        $afternoonStart = '13:00';
        $afternoonEnd = $workEndTime;

        if ($todaySchedule) {
            $morningStart = substr($todaySchedule['start'] ?? $workStartTime, 0, 5);
            $morningEnd = substr($todaySchedule['end'] ?? '12:00', 0, 5);
            if (!empty($todaySchedule['start_afternoon'])) {
                $afternoonStart = substr($todaySchedule['start_afternoon'], 0, 5);
                $afternoonEnd = substr($todaySchedule['end_afternoon'] ?? $workEndTime, 0, 5);
            } else if (!empty($todaySchedule['end_afternoon'])) {
                $afternoonStart = '13:00';
                $afternoonEnd = substr($todaySchedule['end_afternoon'], 0, 5);
            } else {
                // If no afternoon session is configured, set afternoonEnd to morningEnd to prevent incorrect early checkout calculations
                $afternoonStart = '';
                $afternoonEnd = $morningEnd;
            }
        }

        // ==================== FLOW A: CHECK-OUT (RA CA) ====================
        if ($action === 'checkout' || ($reqCheckout === 1 && $existingRow && empty($existingRow['check_out_time']) && !$isSupplementary)) {
            if (!$existingRow) {
                respond(400, null, 'Bạn chưa thực hiện Chấm công Vào ca hôm nay, không thể chấm công Ra ca.', false);
                return;
            }

            $currentHM = substr($currentTime, 0, 5);
            if ($currentHM < $morningStart) {
                respond(400, null, "Không thể chấm công Ra ca trước khi ca làm việc bắt đầu ({$morningStart}).", false);
                return;
            }

            $outTimeStr = $today . ' ' . $currentTime;
            $workEndStr = $today . ' ' . $afternoonEnd . ':00';
            
            $earlyMinutes = 0;
            $checkOutStatus = 'on_time';

            if (strtotime($outTimeStr) < strtotime($workEndStr)) {
                // Check if user has an approved afternoon leave request today
                $afternoonLeaveStmt = $this->db->prepare("
                    SELECT id 
                    FROM hrm_leave_requests 
                    WHERE user_id = ? AND status = 'approved' AND DATE(start_date) = ?
                      AND leave_type IN ('annual', 'sick', 'compensatory', 'unpaid')
                      AND HOUR(start_date) >= 12
                    LIMIT 1
                ");
                $afternoonLeaveStmt->execute([$auth['user_id'], $today]);
                $afternoonLeave = $afternoonLeaveStmt->fetch(PDO::FETCH_ASSOC);

                if ($afternoonLeave) {
                    $earlyMinutes = 0;
                    $checkOutStatus = 'on_time';
                } else {
                    $earlyMinutes = (int)ceil((strtotime($workEndStr) - strtotime($outTimeStr)) / 60);
                    $checkOutStatus = 'early';
                }
            }

            $coLat = trim($b['latitude'] ?? $b['checkout_latitude'] ?? '');
            $coLng = trim($b['longitude'] ?? $b['checkout_longitude'] ?? '');
            $coAddr = trim($b['location_address'] ?? $b['checkout_location_address'] ?? '');
            $coSelfie = trim($b['checkout_selfie_url'] ?? $b['selfie_url'] ?? '');
            if (empty($coAddr) && !empty($coLat) && !empty($coLng)) {
                $coAddr = $coLat . ', ' . $coLng;
            }

            try {
                $updateOut = $this->db->prepare("UPDATE check_ins SET check_out_time = ?, checkout_selfie_url = ?, early_minutes = ?, check_out_status = ?, checkout_latitude = ?, checkout_longitude = ?, checkout_location_address = ? WHERE id = ?");
                $updateOut->execute([$outTimeStr, $coSelfie ?: null, $earlyMinutes, $checkOutStatus, $coLat ?: null, $coLng ?: null, $coAddr ?: null, $existingRow['id']]);
            } catch (\Throwable $ex) {
                try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_selfie_url TEXT NULL AFTER check_out_time"); } catch (\Throwable $e2) {}
                $updateOut = $this->db->prepare("UPDATE check_ins SET check_out_time = ?, checkout_selfie_url = ?, early_minutes = ?, check_out_status = ?, checkout_latitude = ?, checkout_longitude = ?, checkout_location_address = ? WHERE id = ?");
                $updateOut->execute([$outTimeStr, $coSelfie ?: null, $earlyMinutes, $checkOutStatus, $coLat ?: null, $coLng ?: null, $coAddr ?: null, $existingRow['id']]);
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CHECK_OUT', 'check_in', $existingRow['id'], json_encode([
                'date' => $today,
                'time' => $currentTime,
                'early_minutes' => $earlyMinutes,
                'check_out_status' => $checkOutStatus
            ]));

            $msgText = $earlyMinutes > 0
                ? "Ghi nhận Chấm công Ra ca thành công! (Về sớm {$earlyMinutes} phút)"
                : "Ghi nhận Chấm công Ra ca thành công! Chúc bạn buổi tối vui vẻ.";

            respond(200, [
                'id' => $existingRow['id'],
                'status' => $existingRow['status'],
                'check_out_time' => $outTimeStr,
                'early_minutes' => $earlyMinutes,
                'check_out_status' => $checkOutStatus,
                'message' => $msgText
            ]);
            return;
        }

        // ==================== FLOW B: CHECK-IN (VÀO CA) ====================
        if ($existingRow) {
            respond(409, null, 'Bạn đã thực hiện check-in hoặc gửi yêu cầu cho ngày này rồi', false);
            return;
        }

        // Chặn chấm công Vào ca sau khi đã quá giờ tan ca làm việc (chỉ cho phép tạo phiếu Cập nhật công)
        if (!$isSupplementary) {
            $currentHM = substr($currentTime, 0, 5);
            if ($currentHM >= $afternoonEnd) {
                respond(400, null, "Đã quá giờ tan ca hôm nay ({$afternoonEnd}). Bạn không thể chấm công vào ca trực tiếp mà cần tạo phiếu Cập nhật / Giải trình công để Quản lý phê duyệt.", false);
                return;
            }
        }

        if (empty($selfieUrl) && !$isSupplementary) {
            respond(422, null, 'Ảnh selfie check-in là bắt buộc', false);
        }

        $lat = trim($b['latitude'] ?? '');
        $lng = trim($b['longitude'] ?? '');
        // GPS is optional - do not block check-in if GPS is absent

        if ($isSupplementary && empty($reason)) {
            respond(422, null, 'Vui lòng cung cấp lý do/ghi chú cập nhật bổ sung chấm công', false);
        }

        $dayOfWeek = (int)date('N', strtotime($today));
        $isWeekend = ($dayOfWeek >= 6);

        $isHoliday = false;
        if (!empty($settingsMap['holiday_schedules'])) {
            try {
                $holidays = json_decode($settingsMap['holiday_schedules'], true);
                if (is_array($holidays)) {
                    foreach ($holidays as $h) {
                        $hStart = $h['start'] ?? $h['start_date'] ?? $h['date'] ?? '';
                        $hEnd = $h['end'] ?? $h['end_date'] ?? $h['date'] ?? '';
                        if (!empty($hStart) && !empty($hEnd)) {
                            if ($today >= $hStart && $today <= $hEnd) {
                                $isHoliday = true;
                                break;
                            }
                        }
                    }
                }
            } catch (\Throwable $t) {}
        }

        $currentHM = substr($currentTime, 0, 5);
        $workStartHM = substr($workStartTime, 0, 5);
        $isLate = false;
        $lateMinutes = 0;

        // Check if checking in during afternoon session (i.e. after morningEnd)
        if ($currentHM > $morningEnd) {
            $afternoonStartHM = !empty($afternoonStart) ? $afternoonStart : '13:00';
            // If afternoon session is not configured specifically for single-session day (like morning-only Saturday)
            if ($todaySchedule && empty($todaySchedule['start_afternoon']) && empty($todaySchedule['end_afternoon'])) {
                $isLate = ($currentHM > $workStartHM);
                if ($isLate) {
                    $lateMinutes = (int)ceil((strtotime($today . ' ' . $currentHM . ':00') - strtotime($today . ' ' . $workStartHM . ':00')) / 60);
                }
            } else {
                $isLate = ($currentHM > $afternoonStartHM);
                if ($isLate) {
                    $lateMinutes = (int)ceil((strtotime($today . ' ' . $currentHM . ':00') - strtotime($today . ' ' . $afternoonStartHM . ':00')) / 60);
                }
            }
        } else {
            $isLate = ($currentHM > $morningStart);
            if ($isLate) {
                $lateMinutes = (int)ceil((strtotime($today . ' ' . $currentHM . ':00') - strtotime($today . ' ' . $morningStart . ':00')) / 60);
            }
        }

        // Check-in status: All real-time check-ins are recorded directly as approved (no late approval needed)
        // Only manual supplementary requests (cập nhật công bù) require manager approval.
        $status = $isSupplementary ? 'pending_approval' : 'approved';

        $inTimeStr = $today . ' ' . $currentTime;

        $addr = trim($b['location_address'] ?? '');
        if (empty($addr) && !empty($lat) && !empty($lng)) {
            $addr = $lat . ', ' . $lng;
        }

        // Insert check-in log with self-healing schema check
        try {
            $insert = $this->db->prepare("
                INSERT INTO check_ins (user_id, check_in_date, check_in_time, late_minutes, selfie_url, status, reason, latitude, longitude, location_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insert->execute([$auth['user_id'], $today, $inTimeStr, $lateMinutes, $selfieUrl ?: null, $status, $reason ?: null, $lat ?: null, $lng ?: null, $addr ?: null]);
        } catch (\Throwable $e) {
            // Auto-heal check_ins table if columns are missing in DB schema
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN late_minutes INT DEFAULT 0 AFTER check_in_time"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN selfie_url TEXT NULL AFTER late_minutes"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN reason TEXT NULL AFTER status"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN latitude VARCHAR(50) NULL AFTER selfie_url"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN longitude VARCHAR(50) NULL AFTER latitude"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN location_address VARCHAR(500) NULL AFTER longitude"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_latitude VARCHAR(50) NULL"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_longitude VARCHAR(50) NULL"); } catch (\Throwable $ex) {}
            try { $this->db->exec("ALTER TABLE check_ins ADD COLUMN checkout_location_address VARCHAR(500) NULL"); } catch (\Throwable $ex) {}
            
            $insert = $this->db->prepare("
                INSERT INTO check_ins (user_id, check_in_date, check_in_time, late_minutes, selfie_url, status, reason, latitude, longitude, location_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insert->execute([$auth['user_id'], $today, $inTimeStr, $lateMinutes, $selfieUrl ?: null, $status, $reason ?: null, $lat ?: null, $lng ?: null, $addr ?: null]);
        }
        
        $newId = (int)$this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CHECK_IN', 'check_in', $newId, json_encode([
            'date' => $today,
            'time' => $currentTime,
            'late_minutes' => $lateMinutes,
            'is_late' => $isLate,
            'status' => $status
        ]));

        // Send notifications to Admins & Managers if late (and approval is needed) or supplementary request
        if (($isLate && $status === 'pending_approval') || $isSupplementary) {
            require_once __DIR__ . '/../NotificationService.php';
            $stmtUserDetails = $this->db->prepare("SELECT full_name, team_id FROM users WHERE id = ?");
            $stmtUserDetails->execute([$auth['user_id']]);
            $uDetails = $stmtUserDetails->fetch(PDO::FETCH_ASSOC);

            $eventType = $isSupplementary ? 'ATTENDANCE_UPDATE' : 'CHECKIN_LATE';
            NotificationService::send($this->db, $auth['tenant_id'], $eventType, [
                'user_name' => $uDetails ? $uDetails['full_name'] : 'Nhân viên',
                'team_id' => $uDetails ? $uDetails['team_id'] : null,
                'date' => $today,
                'time' => $currentTime,
                'reason' => $reason
            ]);
        }

        $msgText = 'Check-in thành công!';
        if ($status === 'approved' && $isLate) {
            $msgText = "Đã ghi nhận Chấm công Vào ca! (Đi trễ {$lateMinutes} phút)";
        } else if ($status === 'pending_approval') {
            $msgText = $isSupplementary ? 'Đã gửi yêu cầu bổ sung chấm công thành công. Đang chờ phê duyệt.' : 'Đã gửi báo cáo đi trễ thành công. Đang chờ phê duyệt.';
        }

        respond(200, [
            'id' => $newId,
            'status' => $status,
            'late_minutes' => $lateMinutes,
            'message' => $msgText
        ]);
    }

    public function update(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'manager', 'hr']);
        $b = getBody();
        $status = trim($b['status'] ?? '');
        $reason = trim($b['reason'] ?? ''); // Optionally update reason or note

        if (!in_array($status, ['approved', 'rejected', 'pending_approval'], true)) {
            respond(422, null, 'Trạng thái phê duyệt không hợp lệ', false);
        }

        if ($status === 'rejected' && empty($reason)) {
            respond(422, null, 'Vui lòng cung cấp lý do từ chối yêu cầu chấm công', false);
        }

        // Fetch check-in record to make sure it belongs to the same tenant
        $stmtCheck = $this->db->prepare("
            SELECT c.*, u.tenant_id, u.full_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch();

        if (!$row) {
            respond(404, null, 'Không tìm thấy bản ghi check-in', false);
        }

        if ((int)$row['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
        }

        if ($auth['role'] === 'manager') {
            $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtUserTeam->execute([$row['user_id']]);
            $targetUserTeamId = $stmtUserTeam->fetchColumn();

            $isTeamMember = false;
            if ($targetUserTeamId !== null) {
                $stmtCheckManager = $this->db->prepare("
                    SELECT 1 FROM teams WHERE id = ? AND FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    UNION
                    SELECT 1 FROM users WHERE id = ? AND team_id = ? AND role = 'manager'
                ");
                $stmtCheckManager->execute([$targetUserTeamId, $auth['user_id'], $auth['user_id'], $targetUserTeamId]);
                $isTeamMember = (bool)$stmtCheckManager->fetch();
            }

            if ((int)$row['user_id'] !== (int)$auth['user_id'] && !$isTeamMember) {
                respond(403, null, 'Bạn chỉ có quyền phê duyệt chấm công cho nhân viên thuộc nhóm của mình', false);
            }
        }



        // Update status and admin_note, keeping original Sale reason intact
        $adminNote = (!empty($reason) && trim($reason) !== '') ? trim($reason) : null;
        if ($status === 'approved') {
            $upd = $this->db->prepare("UPDATE check_ins SET status = ?, admin_note = COALESCE(?, admin_note), late_minutes = 0, early_minutes = 0 WHERE id = ?");
        } else {
            $upd = $this->db->prepare("UPDATE check_ins SET status = ?, admin_note = COALESCE(?, admin_note) WHERE id = ?");
        }
        $upd->execute([$status, $adminNote, $id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_CHECK_IN', 'check_in', $id, json_encode([
            'old_status' => $row['status'],
            'new_status' => $status,
            'sale_name' => $row['full_name']
        ]));

        // Send approval result notification to employee via NotificationService (In-App Bell, Email, Zalo, Telegram)
        require_once __DIR__ . '/../NotificationService.php';
        $isSupplementary = !empty($row['reason']) && (mb_stripos($row['reason'], 'bổ sung') !== false || $row['check_in_date'] !== date('Y-m-d'));
        NotificationService::send($this->db, $auth['tenant_id'], 'ATTENDANCE_APPROVAL_RESULT', [
            'user_id' => (int)$row['user_id'],
            'user_name' => $row['full_name'] ?? 'Nhân viên',
            'date' => $row['check_in_date'],
            'status' => $status,
            'reason' => $adminNote ?: ($row['reason'] ?? ''),
            'is_supplementary' => $isSupplementary
        ]);

        respond(200, null, 'Cập nhật trạng thái check-in thành công');
    }

    public function destroy(array $auth, int $id): void {
        // Fetch check-in record
        $stmtCheck = $this->db->prepare("
            SELECT c.*, u.tenant_id, u.full_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch();

        if (!$row) {
            respond(404, null, 'Không tìm thấy bản ghi check-in', false);
        }

        if ((int)$row['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
        }

        // Allow creator to recall pending request, otherwise require role
        $isCreator = ((int)$row['user_id'] === (int)$auth['user_id']);
        if ($isCreator) {
            if ($row['status'] !== 'pending_approval') {
                respond(400, null, 'Không thể thu hồi giải trình đã duyệt hoặc từ chối', false);
            }
        } else {
            requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director', 'hr']);
        }

        // Delete
        $this->db->prepare("DELETE FROM check_ins WHERE id = ?")->execute([$id]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_CHECK_IN', 'check_in', $id, json_encode([
            'sale_name' => $row['full_name'],
            'check_in_date' => $row['check_in_date']
        ]));

        respond(200, null, 'Đã xóa bản ghi check-in thành công');
    }

    public function suggestBulkDates(array $auth): void {
        try {
            $userId = (int)$auth['user_id'];
            
            // Quy tắc: Trước hoặc ngày 5 tây (<= 5) mặc định quét tháng trước, sau ngày 5 tây (> 5) quét tháng này
            $defaultMonth = (int)date('j') <= 5 ? date('Y-m', strtotime('first day of last month')) : date('Y-m');
            $month = $_GET['month'] ?? $_GET['month_period'] ?? $defaultMonth; // format 'YYYY-MM'
            
            $startDate = $month . '-01';
            $today = date('Y-m-d');
            $endDate = date('Y-m-t', strtotime($startDate));
            if ($endDate > $today) {
                $endDate = $today;
            }

            // Fetch system settings
            $stmtSettings = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('global_work_start_time', 'global_work_end_time', 'global_work_schedule', 'holiday_schedules')");
            $stmtSettings->execute();
            $settingsMap = [];
            while ($row = $stmtSettings->fetch(PDO::FETCH_ASSOC)) {
                $settingsMap[$row['setting_key']] = $row['setting_value'];
            }

            // Fetch user custom work hours and schedule
            $stmtUser = $this->db->prepare("SELECT work_start_time, work_end_time, use_custom_work_hours, work_schedule FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);

            $userCustom = (int)($userRow['use_custom_work_hours'] ?? 0) === 1;
            $baseWorkStart = ($userCustom && !empty($userRow['work_start_time'])) ? $userRow['work_start_time'] : ($settingsMap['global_work_start_time'] ?? '08:00');
            $baseWorkEnd = ($userCustom && !empty($userRow['work_end_time'])) ? $userRow['work_end_time'] : ($settingsMap['global_work_end_time'] ?? '17:00');
            $workScheduleJson = ($userCustom && !empty($userRow['work_schedule'])) ? $userRow['work_schedule'] : ($settingsMap['global_work_schedule'] ?? 'monday_to_friday');
            $scheduleMap = !empty($workScheduleJson) ? json_decode($workScheduleJson, true) : null;

            // Fetch leaves from both hrm_leave_requests, leaves and consultant_leaves with approved OR pending status
            $hrmLeaves = [];
            try {
                $stmtLeaves = $this->db->prepare("
                    SELECT DATE(start_date) as s_date, DATE(end_date) as e_date, status, reason, leave_type
                    FROM hrm_leave_requests 
                    WHERE user_id = ? AND status IN ('approved', 'pending') AND DATE(start_date) <= ? AND DATE(end_date) >= ?
                ");
                $stmtLeaves->execute([$userId, $endDate, $startDate]);
                $hrmLeaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {
                $hrmLeaves = [];
            }

            $leaves2 = [];
            try {
                $stmtL2 = $this->db->prepare("
                    SELECT DATE(start_date) as s_date, DATE(end_date) as e_date, status, reason, leave_type 
                    FROM leaves 
                    WHERE user_id = ? AND status IN ('approved', 'pending') AND DATE(start_date) <= ? AND DATE(end_date) >= ?
                ");
                $stmtL2->execute([$userId, $endDate, $startDate]);
                $leaves2 = $stmtL2->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {
                $leaves2 = [];
            }

            $cLeaves = [];
            try {
                $stmtCLeaves = $this->db->prepare("
                    SELECT start_date as s_date, end_date as e_date, status, reason, '' as leave_type 
                    FROM consultant_leaves 
                    WHERE consultant_id = ? AND status IN ('approved', 'pending') AND start_date <= ? AND end_date >= ?
                ");
                $stmtCLeaves->execute([$userId, $endDate, $startDate]);
                $cLeaves = $stmtCLeaves->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {
                $cLeaves = [];
            }
            $allLeaves = array_merge($hrmLeaves, $leaves2, $cLeaves);

            $getLeaveInfo = function($dateStr) use ($allLeaves) {
                foreach ($allLeaves as $l) {
                    if ($dateStr >= $l['s_date'] && $dateStr <= $l['e_date']) {
                        return $l;
                    }
                }
                return null;
            };

            // Fetch holiday schedules
            $holidays = [];
            if (!empty($settingsMap['holiday_schedules'])) {
                $decoded = json_decode($settingsMap['holiday_schedules'], true);
                if (is_array($decoded)) {
                    foreach ($decoded as $h) {
                        $hStart = $h['start'] ?? $h['start_date'] ?? $h['date'] ?? '';
                        $hEnd = $h['end'] ?? $h['end_date'] ?? $h['date'] ?? '';
                        if (!empty($hStart) && !empty($hEnd)) {
                            $curH = strtotime($hStart);
                            $endH = strtotime($hEnd);
                            while ($curH <= $endH) {
                                $holidays[date('Y-m-d', $curH)] = true;
                                $curH += 86400;
                            }
                        }
                    }
                }
            }

            // Fetch existing checkins
            $stmtCheckins = $this->db->prepare("
                SELECT check_in_date, check_in_time, check_out_time FROM check_ins 
                WHERE user_id = ? AND check_in_date BETWEEN ? AND ?
            ");
            $stmtCheckins->execute([$userId, $startDate, $endDate]);
            $checkins = [];
            foreach ($stmtCheckins->fetchAll(PDO::FETCH_ASSOC) as $c) {
                $checkins[$c['check_in_date']] = $c;
            }

            $formatTimeHHmm = function($str, $default) {
                if (empty($str)) return $default;
                $s = trim((string)$str);
                if (strpos($s, ' ') !== false) {
                    $parts = explode(' ', $s);
                    $s = $parts[1];
                }
                return strlen($s) >= 5 ? substr($s, 0, 5) : $default;
            };

            $suggestions = [];
            $current = strtotime($startDate);
            $last = strtotime($endDate);

            while ($current <= $last) {
                $dateStr = date('Y-m-d', $current);
                $dayOfWeekISO = (int)date('N', $current); // 1 = Monday ... 7 = Sunday

                $current += 86400;

                // Resolve daily work hours and working status based on schedule map
                $dayStart = substr($baseWorkStart, 0, 5);
                $dayEnd = substr($baseWorkEnd, 0, 5);
                $isWorkingDay = true;

                $daySched = null;
                if (is_array($scheduleMap)) {
                    $daySched = $scheduleMap[$dayOfWeekISO] ?? $scheduleMap[(string)$dayOfWeekISO] ?? null;
                }

                if ($daySched !== null) {
                    $isActive = true;
                    if (isset($daySched['active'])) {
                        $isActive = (bool)$daySched['active'];
                    } elseif (isset($daySched['is_working'])) {
                        $isActive = (bool)$daySched['is_working'];
                    }

                    if (!$isActive) {
                        $isWorkingDay = false;
                    } else {
                        if (!empty($daySched['start'])) {
                            $dayStart = substr($daySched['start'], 0, 5);
                        }
                        if (!empty($daySched['end_afternoon'])) {
                            $dayEnd = substr($daySched['end_afternoon'], 0, 5);
                        } else if (!empty($daySched['start_afternoon'])) {
                            $dayEnd = substr($daySched['end_afternoon'] ?? $baseWorkEnd, 0, 5);
                        } else if (!empty($daySched['end'])) {
                            // Single morning session (e.g. Saturday 08:00 - 12:00)
                            $dayEnd = substr($daySched['end'], 0, 5);
                        }
                    }
                } else {
                    if ($workScheduleJson === 'monday_to_saturday' || $workScheduleJson === 'monday_to_noon_saturday') {
                        $isWorkingDay = $dayOfWeekISO >= 1 && $dayOfWeekISO <= 6;
                    } elseif ($workScheduleJson === 'all_week') {
                        $isWorkingDay = true;
                    } else {
                        // Default: Monday to Friday
                        $isWorkingDay = $dayOfWeekISO >= 1 && $dayOfWeekISO <= 5;
                    }
                }

                if (!$isWorkingDay) {
                    continue;
                }

                // Skip holidays
                if (isset($holidays[$dateStr])) {
                    continue;
                }

                $leaveInfo = $getLeaveInfo($dateStr);
                $hasCheckIn = isset($checkins[$dateStr]) && !empty($checkins[$dateStr]['check_in_time']);
                $hasCheckOut = isset($checkins[$dateStr]) && !empty($checkins[$dateStr]['check_out_time']);

                // Nếu ngày này có đơn xin nghỉ (đã duyệt hoặc đang chờ duyệt) mà nhân viên không chấm công
                // -> Đánh dấu là inactive (is_on_leave = true, disabled = true), không cho bổ sung công gộp
                if ($leaveInfo !== null) {
                    if (!$hasCheckIn || !$hasCheckOut) {
                        $leaveTypeName = match($leaveInfo['leave_type'] ?? '') {
                            'annual' => 'Nghỉ phép năm',
                            'compensatory' => 'Nghỉ bù',
                            'special_paid' => 'Nghỉ Hiếu/Hỉ',
                            'sick' => 'Nghỉ ốm/thai sản',
                            'unpaid' => 'Nghỉ việc riêng',
                            default => !empty($leaveInfo['leave_type']) ? $leaveInfo['leave_type'] : 'Nghỉ phép'
                        };
                        $suggestions[] = [
                            'date' => $dateStr,
                            'has_check_in' => $hasCheckIn,
                            'has_check_out' => $hasCheckOut,
                            'check_in' => $dayStart,
                            'check_out' => $dayEnd,
                            'check_in_time' => $dayStart,
                            'check_out_time' => $dayEnd,
                            'is_on_leave' => true,
                            'leave_type' => $leaveTypeName,
                            'leave_reason' => $leaveInfo['reason'] ?? 'Đã có đơn xin nghỉ phép',
                            'disabled' => true
                        ];
                    }
                    continue;
                }

                if (!isset($checkins[$dateStr])) {
                    $suggestions[] = [
                        'date' => $dateStr,
                        'has_check_in' => false,
                        'has_check_out' => false,
                        'check_in' => $dayStart,
                        'check_out' => $dayEnd,
                        'check_in_time' => $dayStart,
                        'check_out_time' => $dayEnd,
                        'is_on_leave' => false,
                        'disabled' => false
                    ];
                } else {
                    $c = $checkins[$dateStr];
                    if (!$hasCheckIn || !$hasCheckOut) {
                        $inTime = $hasCheckIn ? $formatTimeHHmm($c['check_in_time'], $dayStart) : $dayStart;
                        $outTime = $hasCheckOut ? $formatTimeHHmm($c['check_out_time'], $dayEnd) : $dayEnd;

                        $suggestions[] = [
                            'date' => $dateStr,
                            'has_check_in' => $hasCheckIn,
                            'has_check_out' => $hasCheckOut,
                            'check_in' => $inTime,
                            'check_out' => $outTime,
                            'check_in_time' => $inTime,
                            'check_out_time' => $outTime,
                            'is_on_leave' => false,
                            'disabled' => false
                        ];
                    }
                }
            }

            respond(200, $suggestions, 'Gợi ý ngày thiếu công thành công');
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi quét ngày thiếu công: ' . $e->getMessage(), false);
        }
    }

    public function createBulkRequest(array $auth): void {
        $userId = (int)$auth['user_id'];
        $b = getBody();
        $month = trim($b['month_period'] ?? date('Y-m'));
        $details = $b['details'] ?? [];

        if (empty($details)) {
            respond(400, null, 'Danh sách ngày đề xuất bổ sung không được trống', false);
        }

        $this->db->beginTransaction();
        try {
            // Check if there is already a pending bulk request for this month
            $stmtCheck = $this->db->prepare("
                SELECT id FROM attendance_bulk_requests 
                WHERE user_id = ? AND month_period = ? AND status IN ('pending_manager', 'pending_hr')
                LIMIT 1
            ");
            $stmtCheck->execute([$userId, $month]);
            if ($stmtCheck->fetch()) {
                respond(400, null, "Bạn đã có phiếu đề xuất bổ sung công đang chờ duyệt trong tháng $month.", false);
            }

            // Look up manager/leader or HR as default if approver_id not provided
            $approverId = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
            if (empty($approverId)) {
                $stmtLeader = $this->db->prepare("SELECT t.leader_id FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?");
                $stmtLeader->execute([$userId]);
                $leadId = $stmtLeader->fetchColumn();
                if (!empty($leadId) && (int)$leadId !== (int)$userId) {
                    $approverId = (int)$leadId;
                } else {
                    // Fallback to HR Leader (Nguyễn Thị Duy Phương)
                    $stmtHr = $this->db->prepare("SELECT id FROM users WHERE (full_name LIKE '%Duy Phương%' OR username = 'phuongntd' OR role = 'hr') AND id != ? LIMIT 1");
                    $stmtHr->execute([$userId]);
                    $hrId = $stmtHr->fetchColumn();
                    if (!empty($hrId)) {
                        $approverId = (int)$hrId;
                    }
                }
            }

            // Ensure HR / Hành chính is ALWAYS included in related_user_ids (Người liên quan)
            $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $stmtHrLead = $this->db->prepare("SELECT id FROM users WHERE (full_name LIKE '%Duy Phương%' OR username = 'phuongntd' OR role = 'hr') AND id != ? LIMIT 1");
            $stmtHrLead->execute([$userId]);
            $hrLeaderId = (int)$stmtHrLead->fetchColumn();
            if ($hrLeaderId > 0 && $hrLeaderId !== (int)$approverId && !in_array($hrLeaderId, $relArr, true)) {
                $relArr[] = $hrLeaderId;
            }
            $relatedUserIds = !empty($relArr) ? json_encode(array_values(array_unique($relArr))) : null;

            // Create bulk request
            $stmt = $this->db->prepare("
                INSERT INTO attendance_bulk_requests (user_id, month_period, status, manager_id, related_user_ids)
                VALUES (?, ?, 'pending_manager', ?, ?)
            ");
            $stmt->execute([$userId, $month, $approverId, $relatedUserIds]);
            $requestId = (int)$this->db->lastInsertId();

            // Insert details
            $stmtDetail = $this->db->prepare("
                INSERT INTO attendance_bulk_request_details (request_id, check_in_date, suggested_check_in, suggested_check_out, reason, approved)
                VALUES (?, ?, ?, ?, ?, 1)
            ");

            // Fetch leaves to ensure no on-leave days are included
            $stmtLeaves = $this->db->prepare("
                SELECT DATE(start_date) as s_date, DATE(end_date) as e_date 
                FROM hrm_leave_requests 
                WHERE user_id = ? AND status IN ('approved', 'pending')
            ");
            $stmtLeaves->execute([$userId]);
            $userLeaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);

            $validDetailsCount = 0;
            foreach ($details as $d) {
                if (!empty($d['is_on_leave']) || !empty($d['disabled'])) {
                    continue;
                }
                $date = $d['date'];
                if ($date > date('Y-m-d')) {
                    throw new Exception('Không thể đề xuất bổ sung công cho các ngày trong tương lai: ' . $date);
                }

                // Check leave
                $isOnLeave = false;
                foreach ($userLeaves as $l) {
                    if ($date >= $l['s_date'] && $date <= $l['e_date']) {
                        $isOnLeave = true;
                        break;
                    }
                }
                if ($isOnLeave) {
                    continue;
                }

                $in = !empty($d['check_in']) ? $d['check_in'] : null;
                $out = !empty($d['check_out']) ? $d['check_out'] : null;
                $reason = $d['reason'] ?? 'Bổ sung công';

                $stmtDetail->execute([$requestId, $date, $in, $out, $reason]);
                $validDetailsCount++;
            }

            if ($validDetailsCount === 0) {
                throw new Exception('Tất cả các ngày trong danh sách đã có đơn xin nghỉ phép hoặc không hợp lệ.');
            }

            $this->db->commit();

            // Send notification to approver/manager (ATTENDANCE_UPDATE event type)
            try {
                $userName = $auth['full_name'] ?? 'Nhân viên';
                $targetUid = $approverId ?: $userId;
                NotificationService::send($this->db, 1, 'ATTENDANCE_UPDATE', [
                    'user_id' => $targetUid,
                    'user_name' => $userName,
                    'reason' => "Đề xuất bổ sung công tổng hợp tháng $month (" . count($details) . " ngày)",
                    'ref_id' => $requestId,
                    'is_bulk' => true
                ]);

                // Notify related persons
                if (!empty($relArr)) {
                    foreach ($relArr as $relUid) {
                        $relUid = (int)$relUid;
                        if ($relUid > 0 && $relUid !== (int)$userId && $relUid !== (int)$targetUid) {
                            NotificationService::send($this->db, 1, 'ATTENDANCE_UPDATE', [
                                'user_id' => $relUid,
                                'user_name' => $userName,
                                'reason' => "Đề xuất bổ sung công tổng hợp tháng $month (" . count($details) . " ngày) (Bạn được gắn là Người liên quan)",
                                'ref_id' => $requestId,
                                'is_bulk' => true
                            ]);
                        }
                    }
                }
            } catch (\Throwable $ne) {
                error_log("Failed to send bulk request notification: " . $ne->getMessage());
            }

            respond(201, ['request_id' => $requestId], 'Tạo phiếu đề xuất bổ sung công tổng hợp thành công');
        } catch (\Throwable $ex) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi hệ thống: ' . $ex->getMessage(), false);
        }
    }

    public function listBulkRequests(array $auth): void {
        $role = $auth['role'];
        $userId = (int)$auth['user_id'];

        $sql = "
            SELECT r.*, u.full_name, u.role as user_role
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            WHERE u.tenant_id = ?
        ";
        $params = [$auth['tenant_id']];

        if ($role === 'manager') {
            // Find team members
            $stmtTeam = $this->db->prepare("
                SELECT id FROM teams 
                WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
            ");
            $stmtTeam->execute([$userId]);
            $teamIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];

            if (!empty($teamIds)) {
                $placeholders = implode(',', array_fill(0, count($teamIds), '?'));
                $sql .= " AND (r.user_id = ? OR u.team_id IN ($placeholders))";
                $params = array_merge($params, [$userId], $teamIds);
            } else {
                $sql .= " AND r.user_id = ?";
                $params[] = $userId;
            }
        } elseif ($role === 'sales' || $role === 'viewer') {
            $sql .= " AND r.user_id = ?";
            $params[] = $userId;
        }

        $sql .= " ORDER BY r.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch details for each request
        foreach ($requests as &$req) {
            $stmtDetails = $this->db->prepare("
                SELECT * FROM attendance_bulk_request_details WHERE request_id = ?
            ");
            $stmtDetails->execute([$req['id']]);
            $req['details'] = $stmtDetails->fetchAll(PDO::FETCH_ASSOC);
        }

        respond(200, $requests, 'Lấy danh sách phiếu đề xuất thành công');
    }

    public function getBulkRequestDetail(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name, u.full_name, u.role as user_role, r.manager_id as approver_id
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $req = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            respond(404, null, 'Không tìm thấy phiếu đề xuất', false);
        }

        $stmtDetails = $this->db->prepare("
            SELECT * FROM attendance_bulk_request_details WHERE request_id = ? ORDER BY check_in_date ASC
        ");
        $stmtDetails->execute([$id]);
        $req['details'] = $stmtDetails->fetchAll(PDO::FETCH_ASSOC);

        respond(200, $req);
    }

    public function approveBulkRequest(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr']);
        $b = getBody();
        $status = trim($b['status'] ?? ''); // 'approved' or 'rejected'
        $adminNote = trim($b['admin_note'] ?? '');
        $approvedDetailIds = $b['approved_detail_ids'] ?? []; // Optional list of approved detail ids. If empty, approve all.

        if (!in_array($status, ['approved', 'rejected'], true)) {
            respond(400, null, 'Trạng thái phê duyệt không hợp lệ', false);
        }

        // Fetch request
        $stmtReq = $this->db->prepare("
            SELECT r.*, u.full_name, u.tenant_id
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        ");
        $stmtReq->execute([$id]);
        $req = $stmtReq->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            respond(404, null, 'Không tìm thấy phiếu đề xuất', false);
        }

        if ((int)$req['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền thao tác trên dữ liệu này', false);
            return;
        }

        // Manager checks: approve their own team members or if explicitly designated as approver
        if ($auth['role'] === 'manager') {
            $isAssignedApprover = (int)($req['manager_id'] ?? 0) === (int)$auth['user_id'];
            if (!$isAssignedApprover) {
                $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
                $stmtUserTeam->execute([$req['user_id']]);
                $targetUserTeamId = $stmtUserTeam->fetchColumn();

                $isTeamMember = false;
                if ($targetUserTeamId !== null) {
                    $stmtCheckManager = $this->db->prepare("
                        SELECT 1 FROM teams WHERE id = ? AND FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    ");
                    $stmtCheckManager->execute([$targetUserTeamId, $auth['user_id']]);
                    $isTeamMember = (bool)$stmtCheckManager->fetch();
                }

                if ((int)$req['user_id'] !== (int)$auth['user_id'] && !$isTeamMember) {
                    respond(403, null, 'Bạn chỉ có quyền phê duyệt chấm công cho nhân viên thuộc nhóm của mình hoặc khi được chỉ định làm người duyệt', false);
                }
            }
        }

        $this->db->beginTransaction();
        try {
            if ($status === 'rejected') {
                $stmtUpdate = $this->db->prepare("
                    UPDATE attendance_bulk_requests 
                    SET status = 'rejected', admin_note = ? 
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$adminNote, $id]);
            } else {
                // Quy trình 1 cấp duyệt: Khi Trưởng phòng hoặc Admin duyệt, phiếu chuyển ngay sang 'approved'
                $stmtUpdate = $this->db->prepare("
                    UPDATE attendance_bulk_requests 
                    SET status = 'approved', approved_by = ?, approved_at = NOW(), manager_id = COALESCE(manager_id, ?), admin_note = ? 
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$auth['user_id'], $auth['user_id'], $adminNote, $id]);

                // If approved/pending_hr, update approved flag in details
                if (!empty($approvedDetailIds)) {
                    // Reset all to unapproved
                    $this->db->prepare("UPDATE attendance_bulk_request_details SET approved = 0 WHERE request_id = ?")->execute([$id]);
                    // Approve specific ones
                    $placeholders = implode(',', array_fill(0, count($approvedDetailIds), '?'));
                    $stmtApproveDetails = $this->db->prepare("
                        UPDATE attendance_bulk_request_details SET approved = 1 
                        WHERE request_id = ? AND id IN ($placeholders)
                    ");
                    $stmtApproveDetails->execute(array_merge([$id], $approvedDetailIds));
                }

                // Cập nhật các bản ghi công hợp lệ vào bảng check_ins
                // Fetch all approved details
                $stmtDetails = $this->db->prepare("
                    SELECT * FROM attendance_bulk_request_details 
                    WHERE request_id = ? AND approved = 1
                ");
                $stmtDetails->execute([$id]);
                $details = $stmtDetails->fetchAll(PDO::FETCH_ASSOC);

                $stmtUpsert = $this->db->prepare("
                    INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, reason, admin_note, late_minutes, early_minutes)
                    VALUES (?, ?, ?, ?, 'approved', ?, ?, 0, 0)
                    ON DUPLICATE KEY UPDATE 
                      check_in_time = VALUES(check_in_time),
                      check_out_time = VALUES(check_out_time),
                      status = 'approved',
                      reason = VALUES(reason),
                      admin_note = VALUES(admin_note),
                      late_minutes = 0,
                      early_minutes = 0
                ");

                foreach ($details as $d) {
                    $date = $d['check_in_date'];
                    $inTime = $d['suggested_check_in'] ? "$date " . $d['suggested_check_in'] . ":00" : "$date 08:30:00";
                    $outTime = $d['suggested_check_out'] ? "$date " . $d['suggested_check_out'] . ":00" : "$date 17:00:00";

                    $stmtUpsert->execute([
                        $req['user_id'],
                        $date,
                        $inTime,
                        $outTime,
                        $d['reason'],
                        $adminNote ?: 'Duyệt bổ sung công tổng hợp'
                    ]);
                }
            }

            $this->db->commit();

            // Send notification to employee
            try {
                $statusText = $status === 'approved' ? 'chấp thuận' : 'từ chối';
                NotificationService::send($this->db, 1, 'ATTENDANCE_APPROVAL_RESULT', [
                    'user_id' => $req['user_id'],
                    'user_name' => $req['full_name'],
                    'date' => $req['month_period'],
                    'status' => $status,
                    'is_supplementary' => true,
                    'reason' => "Đề xuất bổ sung công tháng " . $req['month_period'] . " đã được " . $statusText
                ]);
            } catch (\Throwable $ne) {
                error_log("Failed to send bulk approve notification: " . $ne->getMessage());
            }

            respond(200, null, 'Phê duyệt phiếu đề xuất bổ sung công thành công');
        } catch (\Throwable $ex) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi hệ thống: ' . $ex->getMessage(), false);
        }
    }

    public function deleteBulkRequest(array $auth, int $id): void {
        $stmt = $this->db->prepare("SELECT * FROM attendance_bulk_requests WHERE id = ?");
        $stmt->execute([$id]);
        $req = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            respond(404, null, 'Không tìm thấy phiếu đề xuất', false);
        }

        $isAdmin = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isAdmin && (int)$req['user_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn không có quyền xóa phiếu này', false);
        }

        $this->db->prepare("DELETE FROM attendance_bulk_request_details WHERE request_id = ?")->execute([$id]);
        $this->db->prepare("DELETE FROM attendance_bulk_requests WHERE id = ?")->execute([$id]);

        respond(200, null, 'Đã xóa phiếu đề xuất thành công');
    }

    public function getCheckinComments(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'checkin' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $comments = array_map(function($row) {
            if (!empty($row['attachments'])) {
                $decoded = json_decode($row['attachments'], true);
                $row['attachments'] = is_array($decoded) ? $decoded : [];
            } else {
                $row['attachments'] = [];
            }
            return $row;
        }, $rows);
        respond(200, $comments, 'Lấy danh sách bình luận thành công');
    }

    public function addCheckinComments(array $auth, int $id): void {
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'checkin', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $id, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();
        $this->parseAndNotifyMentions($body, $id, 'checkin', $auth);
        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    public function getBulkComments(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'attendance_bulk' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $comments = array_map(function($row) {
            if (!empty($row['attachments'])) {
                $decoded = json_decode($row['attachments'], true);
                $row['attachments'] = is_array($decoded) ? $decoded : [];
            } else {
                $row['attachments'] = [];
            }
            return $row;
        }, $rows);
        respond(200, $comments, 'Lấy danh sách bình luận thành công');
    }

    public function addBulkComments(array $auth, int $id): void {
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'attendance_bulk', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $id, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();
        $this->parseAndNotifyMentions($body, $id, 'attendance_bulk', $auth);
        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    private function parseAndNotifyMentions(string $body, int $id, string $type, array $auth): void {
        $mentions = [];
        if (preg_match_all('/data-user-id=(?:&quot;|["\']|\\\\+["\'])?(\d+)/i', (string)$body, $matches)) {
            $uids = array_filter(array_map('intval', $matches[1]));
            foreach ($uids as $uid) {
                if ($uid !== (int)$auth['user_id']) {
                    $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE id=?");
                    $stmtUser->execute([$uid]);
                    $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                    if ($userRow) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        $matches = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()\s]+?)(?:<\/span>|<br|\n|$)/u', (string)$body, $matches);
        $names = is_array($matches[1] ?? null) ? $matches[1] : [];
        if (!empty($names)) {
            foreach ($names as $nameWithUnderscores) {
                $nameWithUnderscores = trim(strip_tags($nameWithUnderscores));
                if (empty($nameWithUnderscores)) continue;
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE (full_name=? OR REPLACE(full_name, ' ', '_')=?)");
                $stmtUser->execute([$fullName, $nameWithUnderscores]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $uid = (int)$userRow['id'];
                    if ($uid !== (int)$auth['user_id']) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        if (!empty($mentions)) {
            require_once __DIR__ . '/../NotificationService.php';
            foreach ($mentions as $uid => $userRow) {
                NotificationService::send($this->db, $auth['tenant_id'], 'MENTION_TAGGED', [
                    'user_id' => $uid,
                    'author_name' => $auth['full_name'] ?? 'Đồng nghiệp',
                    'comment' => $body,
                    'link' => "/approvals?open_id={$id}&open_type={$type}"
                ]);
            }
        }
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as employee_name, u.email as employee_email
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ? AND u.tenant_id = ?
            LIMIT 1
        ");
        $stmt->execute([$id, $auth['tenant_id'] ?? 1]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy dữ liệu chấm công', false);
            return;
        }
        respond(200, $row);
    }
}

