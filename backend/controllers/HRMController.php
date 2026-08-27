<?php
class HRMController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    private function isAdmin(array $auth): bool {
        return in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true);
    }

    public static function formatLeaveTypeText(string $type): string {
        $map = [
            'annual' => 'Phép năm',
            'sick' => 'Nghỉ ốm',
            'compensatory' => 'Nghỉ bù',
            'late_early' => 'Đi trễ/Về sớm',
            'overtime' => 'Tăng ca (OT)',
            'remote_work' => 'Làm việc từ xa (WFH)',
            'maternity' => 'Nghỉ thai sản',
            'paternity' => 'Nghỉ thai sản (nam)',
            'marriage' => 'Nghỉ kết hôn',
            'funeral' => 'Nghỉ tang chế',
            'special_paid' => 'Nghỉ hưởng nguyên lương',
            'business_trip' => 'Đi công tác',
            'unpaid' => 'Nghỉ không lương',
        ];
        return $map[$type] ?? ($type ?: 'Nghỉ phép');
    }

    public static function formatLeaveTitle(string $type): string {
        if ($type === 'remote_work') return 'Đăng ký làm việc từ xa (WFH)';
        if ($type === 'overtime') return 'Đăng ký tăng ca (OT)';
        if ($type === 'late_early') return 'Đăng ký đi trễ / về sớm';
        if ($type === 'business_trip') return 'Đăng ký đi công tác';
        return 'Đơn xin nghỉ phép (' . self::formatLeaveTypeText($type) . ')';
    }

    // --- PROFILES & CONTRACTS ---

    public function indexProfiles(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);

        $stmt = $this->db->prepare("
            SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account, u.team_id,
                   p.joined_date, p.base_salary, p.deal_salary, p.has_insurance, p.allowance_meal, p.allowance_travel, p.allowance_phone, p.kpi_target, p.kpi_multiplier_rules, p.custom_fields_json,
                   p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used,
                   p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn
            FROM users u
            LEFT JOIN hrm_profiles p ON u.id = p.user_id
            WHERE u.tenant_id = ?
            ORDER BY u.full_name
        ");
        $stmt->execute([$auth['tenant_id']]);
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function saveProfile(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        if (empty($b['user_id']) || empty($b['joined_date'])) {
            respond(400, null, 'Thiếu thông tin user_id hoặc ngày vào làm', false);
        }

        $stmt = $this->db->prepare("
            INSERT INTO hrm_profiles (user_id, joined_date, base_salary, deal_salary, has_insurance, allowance_meal, allowance_travel, allowance_phone, kpi_target, kpi_multiplier_rules, custom_fields_json,
                                      annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used,
                                      insurance_rate_bhxh, insurance_rate_bhyt, insurance_rate_bhtn)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                joined_date = VALUES(joined_date),
                base_salary = VALUES(base_salary),
                deal_salary = VALUES(deal_salary),
                has_insurance = VALUES(has_insurance),
                allowance_meal = VALUES(allowance_meal),
                allowance_travel = VALUES(allowance_travel),
                allowance_phone = VALUES(allowance_phone),
                kpi_target = VALUES(kpi_target),
                kpi_multiplier_rules = VALUES(kpi_multiplier_rules),
                custom_fields_json = VALUES(custom_fields_json),
                annual_leave_total = VALUES(annual_leave_total),
                annual_leave_used = VALUES(annual_leave_used),
                compensatory_leave_total = VALUES(compensatory_leave_total),
                compensatory_leave_used = VALUES(compensatory_leave_used),
                insurance_rate_bhxh = VALUES(insurance_rate_bhxh),
                insurance_rate_bhyt = VALUES(insurance_rate_bhyt),
                insurance_rate_bhtn = VALUES(insurance_rate_bhtn)
        ");

        $stmt->execute([
            (int)$b['user_id'],
            $b['joined_date'],
            (float)($b['base_salary'] ?? 0),
            (float)($b['deal_salary'] ?? 0),
            (int)($b['has_insurance'] ?? 1),
            (float)($b['allowance_meal'] ?? 0),
            (float)($b['allowance_travel'] ?? 0),
            (float)($b['allowance_phone'] ?? 0),
            (float)($b['kpi_target'] ?? 0),
            isset($b['kpi_multiplier_rules']) ? (is_array($b['kpi_multiplier_rules']) ? json_encode($b['kpi_multiplier_rules']) : $b['kpi_multiplier_rules']) : null,
            isset($b['custom_fields_json']) ? (is_array($b['custom_fields_json']) ? json_encode($b['custom_fields_json']) : $b['custom_fields_json']) : null,
            (float)($b['annual_leave_total'] ?? 12.0),
            (float)($b['annual_leave_used'] ?? 0.0),
            (float)($b['compensatory_leave_total'] ?? 0.0),
            (float)($b['compensatory_leave_used'] ?? 0.0),
            (float)($b['insurance_rate_bhxh'] ?? 8.00),
            (float)($b['insurance_rate_bhyt'] ?? 1.50),
            (float)($b['insurance_rate_bhtn'] ?? 1.00)
        ]);

        respond(200, ['success' => true]);
    }

    public function getMyBalance(array $auth): void {
        $stmt = $this->db->prepare("
            SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used 
            FROM hrm_profiles 
            WHERE user_id = ?
            LIMIT 1
        ");
        $stmt->execute([$auth['user_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            $row = [
                'annual_leave_total' => 12.0,
                'annual_leave_used' => 0.0,
                'compensatory_leave_total' => 0.0,
                'compensatory_leave_used' => 0.0
            ];
        } else {
            $row['annual_leave_total'] = (float)$row['annual_leave_total'];
            $row['annual_leave_used'] = (float)$row['annual_leave_used'];
            $row['compensatory_leave_total'] = (float)$row['compensatory_leave_total'];
            $row['compensatory_leave_used'] = (float)$row['compensatory_leave_used'];
        }
        
        respond(200, $row);
    }

    // --- LEAVE REQUESTS ---

    public function indexLeaves(array $auth): void {
        if ($this->isAdmin($auth)) {
            $stmt = $this->db->prepare("
                SELECT l.*, u.full_name as employee_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                WHERE u.tenant_id = ?
                ORDER BY l.created_at DESC
            ");
            $stmt->execute([$auth['tenant_id']]);
        } else {
            $stmt = $this->db->prepare("
                SELECT l.*, u.full_name as employee_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                WHERE l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? OR l.related_user_ids LIKE ?
                ORDER BY l.created_at DESC
            ");
            $stmt->execute([$auth['user_id'], $auth['user_id'], $auth['user_id'], '%"'.$auth['user_id'].'"%']);
        }
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function createLeave(array $auth): void {
        $b = getBody();
        // Support frontend key names from_date & to_date as fallbacks
        $startDate = $b['start_date'] ?? $b['from_date'] ?? null;
        $endDate = $b['end_date'] ?? $b['to_date'] ?? null;

        if (empty($startDate) || empty($endDate) || empty($b['leave_type'])) {
            respond(400, null, 'Thiếu thông tin đăng ký nghỉ phép', false);
            return;
        }

        if ($endDate < $startDate) {
            respond(400, null, 'Ngày kết thúc nghỉ phép không thể nhỏ hơn ngày bắt đầu.', false);
            return;
        }

        $approverId = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
        if (empty($approverId)) {
            $stmtLeader = $this->db->prepare("SELECT t.leader_id FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?");
            $stmtLeader->execute([$auth['user_id']]);
            $leadId = $stmtLeader->fetchColumn();
            if (!empty($leadId) && (int)$leadId !== (int)$auth['user_id']) {
                $approverId = (int)$leadId;
            } else {
                $stmtDir = $this->db->query("SELECT id FROM users WHERE LOWER(role) IN ('director', 'superadmin', 'super_admin') AND id != " . (int)$auth['user_id'] . " LIMIT 1");
                $approverId = (int)($stmtDir->fetchColumn() ?: 1003);
            }
        }
        $approverId2 = !empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null;

        // Ensure HR / Hành chính is ALWAYS included in related_user_ids (Người liên quan)
        $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true)) : [];
        if (!is_array($relArr)) $relArr = [];
        $stmtHrLead = $this->db->prepare("SELECT id FROM users WHERE (full_name LIKE '%Duy Phương%' OR username = 'phuongntd' OR role = 'hr') AND id != ? LIMIT 1");
        $stmtHrLead->execute([$auth['user_id']]);
        $hrLeaderId = (int)$stmtHrLead->fetchColumn();
        if ($hrLeaderId > 0 && $hrLeaderId !== (int)$approverId && !in_array($hrLeaderId, $relArr, true)) {
            $relArr[] = $hrLeaderId;
        }
        $relatedUserIds = !empty($relArr) ? json_encode(array_values(array_unique($relArr))) : null;

        $stmt = $this->db->prepare("
            INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status, approver_id, approver_id_2, status_level_1, status_level_2, related_user_ids)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'pending', ?, ?)
        ");
        $stmt->execute([
            $auth['user_id'],
            $b['leave_type'],
            $startDate,
            $endDate,
            (float)($b['total_days'] ?? 1.0),
            $b['reason'] ?? '',
            $approverId,
            $approverId2,
            $approverId2 ? 'pending' : 'none',
            $relatedUserIds
        ]);

        // Dispatch Notification
        try {
            $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtUser->execute([$auth['user_id']]);
            $userName = $stmtUser->fetchColumn() ?: 'Nhân viên';

            $leaveTypeText = self::formatLeaveTypeText($b['leave_type']);

            require_once __DIR__ . '/../NotificationService.php';
            $targetUserId = $approverId ?: $auth['user_id'];
            $leaveId = (int)$this->db->lastInsertId();
            NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_REQUEST', [
                'approver_id' => $targetUserId,
                'target_user_id' => $targetUserId,
                'user_id' => $targetUserId,
                'user_name' => $userName,
                'submitter_id' => (int)$auth['user_id'],
                'leave_type_text' => $leaveTypeText,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'total_days' => (float)($b['total_days'] ?? 1.0),
                'reason' => $b['reason'] ?? '',
                'date' => date('Y-m-d'),
                'ref_id' => $leaveId
            ]);

            // Notify related persons
            if (!empty($relArr)) {
                foreach ($relArr as $relUid) {
                    $relUid = (int)$relUid;
                    if ($relUid > 0 && $relUid !== (int)$auth['user_id'] && $relUid !== (int)$targetUserId) {
                        NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_REQUEST', [
                            'approver_id' => $relUid,
                            'target_user_id' => $relUid,
                            'user_id' => $relUid,
                            'user_name' => $userName,
                            'submitter_id' => (int)$auth['user_id'],
                            'leave_type_text' => $leaveTypeText,
                            'start_date' => $startDate,
                            'end_date' => $endDate,
                            'total_days' => (float)($b['total_days'] ?? 1.0),
                            'reason' => ($b['reason'] ?? '') . ' (Bạn được gắn là Người theo dõi)',
                            'date' => date('Y-m-d'),
                            'ref_id' => $leaveId
                        ]);
                    }
                }
            }
        } catch (\Throwable $e) {}

        respond(200, ['success' => true]);
    }

    public function approveLeave(array $auth): void {
        $b = getBody();
        if (empty($b['id']) || empty($b['status'])) {
            respond(400, null, 'Thiếu ID hoặc trạng thái phê duyệt', false);
        }

        $id = (int)$b['id'];
        $statusInput = $b['status'];
        $approverNote = $b['reason'] ?? 'Không có ghi chú thêm';

        $stmtL = $this->db->prepare("SELECT l.*, u.full_name FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE l.id = ?");
        $stmtL->execute([$id]);
        $leaveRow = $stmtL->fetch(PDO::FETCH_ASSOC);

        if (!$leaveRow) {
            respond(404, null, 'Yêu cầu nghỉ phép không tồn tại', false);
        }

        $isApprover1 = ($auth['user_id'] == $leaveRow['approver_id']);
        $isApprover2 = ($auth['user_id'] == $leaveRow['approver_id_2']);

        $nextStatus = 'pending';
        $updateFields = [];
        $params = [];

        if ($statusInput === 'rejected') {
            $nextStatus = 'rejected';
            if ($isApprover1) {
                $updateFields[] = "status_level_1 = 'rejected'";
                $updateFields[] = "approved_by = ?";
                $params[] = $auth['user_id'];
            }
            if ($isApprover2) {
                $updateFields[] = "status_level_2 = 'rejected'";
                $updateFields[] = "approved_by_2 = ?";
                $params[] = $auth['user_id'];
            }
            if (!$isApprover1 && !$isApprover2) {
                $updateFields[] = "status_level_1 = 'rejected'";
                $updateFields[] = "status_level_2 = 'rejected'";
                $updateFields[] = "approved_by = ?";
                $params[] = $auth['user_id'];
            }
            
            if (!empty($approverNote) && $approverNote !== 'Không có ghi chú thêm') {
                $reasonAppend = "\n[Từ chối: " . $approverNote . "]";
                try {
                    $stmtReason = $this->db->prepare("UPDATE hrm_leave_requests SET reason = CONCAT(COALESCE(reason, ''), ?) WHERE id = ?");
                    $stmtReason->execute([$reasonAppend, $id]);
                } catch (\Throwable $e) {}
            }
        } else {
            if ($isApprover1) {
                $updateFields[] = "status_level_1 = 'approved'";
                $updateFields[] = "approved_by = ?";
                $params[] = $auth['user_id'];
                
                if (!empty($leaveRow['approver_id_2'])) {
                    $nextStatus = 'pending';
                } else {
                    $nextStatus = 'approved';
                }
            }
            if ($isApprover2) {
                $updateFields[] = "status_level_2 = 'approved'";
                $updateFields[] = "approved_by_2 = ?";
                $params[] = $auth['user_id'];
                $nextStatus = 'approved';
            }
            if (!$isApprover1 && !$isApprover2) {
                $updateFields[] = "status_level_1 = 'approved'";
                $updateFields[] = "status_level_2 = 'approved'";
                $updateFields[] = "approved_by = ?";
                $params[] = $auth['user_id'];
                $nextStatus = 'approved';
            }
        }

        $updateFields[] = "status = ?";
        $params[] = $nextStatus;
        $params[] = $id;

        $updateSql = "UPDATE hrm_leave_requests SET " . implode(", ", $updateFields) . " WHERE id = ?";
        $stmtUpdate = $this->db->prepare($updateSql);
        $stmtUpdate->execute($params);

        // Deduct leave balance upon final approval
        if ($nextStatus === 'approved') {
            $days = (float)$leaveRow['total_days'];
            $type = $leaveRow['leave_type'];
            $userId = (int)$leaveRow['user_id'];
            
            if ($type === 'annual' || $type === 'compensatory') {
                $profStmt = $this->db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                $profStmt->execute([$userId]);
                $profile = $profStmt->fetch(PDO::FETCH_ASSOC);
                
                $remComp = 0.0;
                $remAnnual = 0.0;
                if ($profile) {
                    $remComp = max(0.0, (float)$profile['compensatory_leave_total'] - (float)$profile['compensatory_leave_used']);
                    $remAnnual = max(0.0, (float)$profile['annual_leave_total'] - (float)$profile['annual_leave_used']);
                }
                
                $deductComp = min($days, $remComp);
                $deductAnnual = min(max(0.0, $days - $deductComp), $remAnnual);
                $deductUnpaid = max(0.0, $days - ($deductComp + $deductAnnual));
                
                if ($deductComp > 0) {
                    $updStmt = $this->db->prepare("UPDATE hrm_profiles SET compensatory_leave_used = compensatory_leave_used + ? WHERE user_id = ?");
                    $updStmt->execute([$deductComp, $userId]);
                }
                if ($deductAnnual > 0) {
                    $updStmt = $this->db->prepare("UPDATE hrm_profiles SET annual_leave_used = annual_leave_used + ? WHERE user_id = ?");
                    $updStmt->execute([$deductAnnual, $userId]);
                }
                
                $parts = [];
                if ($deductComp > 0) $parts[] = "-{$deductComp} ngày phép bù";
                if ($deductAnnual > 0) $parts[] = "-{$deductAnnual} ngày phép năm";
                if ($deductUnpaid > 0) $parts[] = "-{$deductUnpaid} ngày không lương";
                
                $deductionLog = " [Khấu trừ thực tế: " . implode(', ', $parts) . "]";
                $updReason = $this->db->prepare("UPDATE hrm_leave_requests SET reason = CONCAT(COALESCE(reason, ''), ?), unpaid_days = ? WHERE id = ?");
                $updReason->execute([$deductionLog, $deductUnpaid, (int)$leaveRow['id']]);
            } elseif ($type === 'special_paid') {
                // Phân bổ nghỉ chế độ Hiếu/Hỉ theo Điều 115 BLLĐ 2019
                $reasonText = mb_strtolower($leaveRow['reason'] ?? '');
                $statutoryLimit = 3.0; // Mặc định 3 ngày (kết hôn, tứ thân phụ mẫu / vợ / chồng / con mất)
                if (strpos($reasonText, 'con kết hôn') !== false || strpos($reasonText, 'con cưới') !== false) {
                    $statutoryLimit = 1.0;
                } elseif (strpos($reasonText, 'ông bà') !== false || strpos($reasonText, 'anh chị em') !== false || strpos($reasonText, 'anh ruột') !== false || strpos($reasonText, 'chị ruột') !== false || strpos($reasonText, 'em ruột') !== false) {
                    $statutoryLimit = 1.0;
                }

                $statutoryPaidDays = min($days, $statutoryLimit);
                $overQuotaDays = max(0.0, $days - $statutoryPaidDays);

                $deductComp = 0.0;
                $deductAnnual = 0.0;
                $deductUnpaid = 0.0;

                if ($overQuotaDays > 0) {
                    $profStmt = $this->db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                    $profStmt->execute([$userId]);
                    $profile = $profStmt->fetch(PDO::FETCH_ASSOC);
                    
                    $remComp = 0.0;
                    $remAnnual = 0.0;
                    if ($profile) {
                        $remComp = max(0.0, (float)$profile['compensatory_leave_total'] - (float)$profile['compensatory_leave_used']);
                        $remAnnual = max(0.0, (float)$profile['annual_leave_total'] - (float)$profile['annual_leave_used']);
                    }
                    
                    $deductComp = min($overQuotaDays, $remComp);
                    $remOverAfterComp = $overQuotaDays - $deductComp;
                    $deductAnnual = min($remOverAfterComp, $remAnnual);
                    $deductUnpaid = max(0.0, $remOverAfterComp - $deductAnnual);
                    
                    if ($deductComp > 0) {
                        $updStmt = $this->db->prepare("UPDATE hrm_profiles SET compensatory_leave_used = compensatory_leave_used + ? WHERE user_id = ?");
                        $updStmt->execute([$deductComp, $userId]);
                    }
                    if ($deductAnnual > 0) {
                        $updStmt = $this->db->prepare("UPDATE hrm_profiles SET annual_leave_used = annual_leave_used + ? WHERE user_id = ?");
                        $updStmt->execute([$deductAnnual, $userId]);
                    }
                }

                $parts = [];
                $parts[] = "{$statutoryPaidDays} ngày chế độ luật (100% lương)";
                if ($deductComp > 0) $parts[] = "-{$deductComp} ngày phép bù";
                if ($deductAnnual > 0) $parts[] = "-{$deductAnnual} ngày phép năm";
                if ($deductUnpaid > 0) $parts[] = "-{$deductUnpaid} ngày không lương";
                
                $deductionLog = " [Phân bổ ngày nghỉ: " . implode(', ', $parts) . "]";
                $updReason = $this->db->prepare("UPDATE hrm_leave_requests SET reason = CONCAT(COALESCE(reason, ''), ?), unpaid_days = ? WHERE id = ?");
                $updReason->execute([$deductionLog, $deductUnpaid, (int)$leaveRow['id']]);
            } elseif ($type === 'unpaid') {
                $updReason = $this->db->prepare("UPDATE hrm_leave_requests SET unpaid_days = ? WHERE id = ?");
                $updReason->execute([$days, (int)$leaveRow['id']]);
            }

            // Sync to consultant_leaves so the lead assignment / check-in rotation excludes this user when on leave
            if (in_array($type, ['annual', 'sick', 'compensatory', 'unpaid', 'special_paid', 'maternity', 'paternity', 'marriage', 'funeral'])) {
                try {
                    $cLeaveStmt = $this->db->prepare("INSERT IGNORE INTO consultant_leaves (consultant_id, start_date, end_date) VALUES (?, ?, ?)");
                    $startDateOnly = explode('T', explode(' ', $leaveRow['start_date'])[0])[0];
                    $endDateOnly = explode('T', explode(' ', $leaveRow['end_date'])[0])[0];
                    $cLeaveStmt->execute([$userId, $startDateOnly, $endDateOnly]);

                    // Sync leave dates to users table for live lead check
                    $upUserStmt = $this->db->prepare("UPDATE users SET leave_start = ?, leave_end = ? WHERE id = ?");
                    $upUserStmt->execute([$startDateOnly, $endDateOnly, $userId]);
                } catch (\Throwable $e) {}
            }
        }

        // Fetch remaining leave balance for notifications
        $remainingAnnual = 12.0;
        $remainingComp = 0.0;
        $balStmt = $this->db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
        $balStmt->execute([$leaveRow['user_id']]);
        $balRow = $balStmt->fetch(PDO::FETCH_ASSOC);
        if ($balRow) {
            $remainingAnnual = (float)$balRow['annual_leave_total'] - (float)$balRow['annual_leave_used'];
            $remainingComp = (float)$balRow['compensatory_leave_total'] - (float)$balRow['compensatory_leave_used'];
        }

        try {
            $leaveTypeText = self::formatLeaveTypeText($leaveRow['leave_type']);
            $statusText = $nextStatus === 'approved' ? 'Phê duyệt hoàn toàn' : ($nextStatus === 'rejected' ? 'Từ chối' : 'Phê duyệt cấp 1 (Chờ Giám đốc duyệt)');

            require_once __DIR__ . '/../NotificationService.php';

            if ($statusInput === 'approved' && $isApprover1 && !empty($leaveRow['approver_id_2'])) {
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_REQUEST', [
                    'user_id' => $leaveRow['approver_id_2'],
                    'user_name' => $leaveRow['full_name'],
                    'leave_type_text' => $leaveTypeText,
                    'start_date' => $leaveRow['start_date'],
                    'end_date' => $leaveRow['end_date'],
                    'total_days' => (float)$leaveRow['total_days'],
                    'reason' => 'Đã duyệt Cấp 1. Lý do ban đầu: ' . $leaveRow['reason'],
                    'date' => date('Y-m-d'),
                    'ref_id' => $id
                ]);
            } else {
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_APPROVAL', [
                    'user_id' => $leaveRow['user_id'],
                    'user_name' => $leaveRow['full_name'],
                    'leave_type_text' => $leaveTypeText,
                    'start_date' => $leaveRow['start_date'],
                    'end_date' => $leaveRow['end_date'],
                    'status_text' => $statusText,
                    'reason' => $approverNote,
                    'remaining_annual_leave' => $remainingAnnual,
                    'remaining_compensatory_leave' => $remainingComp,
                    'ref_id' => $id,
                    'status' => $nextStatus
                ]);

                // Notify related persons of outcome
                if (!empty($leaveRow['related_user_ids'])) {
                    $relList = is_array($leaveRow['related_user_ids']) ? $leaveRow['related_user_ids'] : json_decode($leaveRow['related_user_ids'], true);
                    if (is_array($relList)) {
                        foreach ($relList as $relUid) {
                            $relUid = (int)$relUid;
                            if ($relUid > 0 && $relUid !== (int)$leaveRow['user_id'] && $relUid !== (int)$auth['user_id']) {
                                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_APPROVAL', [
                                    'user_id' => $relUid,
                                    'user_name' => $leaveRow['full_name'],
                                    'leave_type_text' => $leaveTypeText,
                                    'start_date' => $leaveRow['start_date'],
                                    'end_date' => $leaveRow['end_date'],
                                    'status_text' => $statusText,
                                    'reason' => $approverNote . ' (Đơn bạn đang theo dõi đã có kết quả)',
                                    'remaining_annual_leave' => $remainingAnnual,
                                    'remaining_compensatory_leave' => $remainingComp,
                                    'ref_id' => $id,
                                    'status' => $nextStatus
                                ]);
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {}

        respond(200, ['success' => true]);
    }

    // --- SALARY ADVANCES ---

    public function indexAdvances(array $auth): void {
        if ($this->isAdmin($auth)) {
            $stmt = $this->db->prepare("
                SELECT a.*, u.full_name as employee_name
                FROM hrm_salary_advances a
                JOIN users u ON a.user_id = u.id
                WHERE u.tenant_id = ?
                ORDER BY a.created_at DESC
            ");
            $stmt->execute([$auth['tenant_id']]);
        } else {
            $stmt = $this->db->prepare("
                SELECT a.*, u.full_name as employee_name
                FROM hrm_salary_advances a
                JOIN users u ON a.user_id = u.id
                WHERE a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ? OR a.related_user_ids LIKE ?
                ORDER BY a.created_at DESC
            ");
            $stmt->execute([$auth['user_id'], $auth['user_id'], $auth['user_id'], '%"'.$auth['user_id'].'"%']);
        }
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function createAdvance(array $auth): void {
        $b = getBody();
        if (empty($b['amount']) || (float)$b['amount'] <= 0) {
            respond(400, null, 'Số tiền tạm ứng phải lớn hơn 0', false);
        }

        $approverId = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
        if (empty($approverId)) {
            $stmtLeader = $this->db->prepare("SELECT t.leader_id FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?");
            $stmtLeader->execute([$auth['user_id']]);
            $leadId = $stmtLeader->fetchColumn();
            if (!empty($leadId) && (int)$leadId !== (int)$auth['user_id']) {
                $approverId = (int)$leadId;
            } else {
                $stmtDir = $this->db->query("SELECT id FROM users WHERE LOWER(role) IN ('director', 'superadmin', 'super_admin') AND id != " . (int)$auth['user_id'] . " LIMIT 1");
                $approverId = (int)($stmtDir->fetchColumn() ?: 1003);
            }
        }
        $approverId2 = !empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null;
        $relatedUserIds = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? json_encode($b['related_user_ids']) : $b['related_user_ids']) : null;

        $stmt = $this->db->prepare("
            INSERT INTO hrm_salary_advances (user_id, amount, request_date, reason, status, approver_id, approver_id_2, status_level_1, status_level_2, related_user_ids)
            VALUES (?, ?, CURDATE(), ?, 'pending', ?, ?, 'pending', ?, ?)
        ");
        $stmt->execute([
            $auth['user_id'],
            (float)$b['amount'],
            $b['reason'] ?? '',
            $approverId,
            $approverId2,
            $approverId2 ? 'pending' : 'none',
            $relatedUserIds
        ]);

        try {
            $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtUser->execute([$auth['user_id']]);
            $userName = $stmtUser->fetchColumn() ?: 'Nhân viên';

            require_once __DIR__ . '/../NotificationService.php';
            $targetUserId = $approverId ?: $auth['user_id'];
            $advId = (int)$this->db->lastInsertId();
            NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_REQUEST', [
                'user_id' => $targetUserId,
                'user_name' => $userName,
                'amount' => (float)$b['amount'],
                'reason' => $b['reason'] ?? '',
                'date' => date('Y-m-d'),
                'ref_id' => $advId
            ]);

            // Notify related persons
            if (!empty($b['related_user_ids'])) {
                $relList = is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true);
                if (is_array($relList)) {
                    foreach ($relList as $relUid) {
                        $relUid = (int)$relUid;
                        if ($relUid > 0 && $relUid !== (int)$auth['user_id'] && $relUid !== (int)$targetUserId) {
                            NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_REQUEST', [
                                'user_id' => $relUid,
                                'user_name' => $userName,
                                'amount' => (float)$b['amount'],
                                'reason' => ($b['reason'] ?? '') . ' (Bạn được gắn là Người liên quan)',
                                'date' => date('Y-m-d'),
                                'ref_id' => $advId
                            ]);
                        }
                    }
                }
            }
        } catch (\Throwable $e) {}

        respond(200, ['success' => true]);
    }

    public function approveAdvance(array $auth): void {
        $b = getBody();
        if (empty($b['id']) || empty($b['status'])) {
            respond(400, null, 'Thiếu ID hoặc trạng thái phê duyệt', false);
        }

        $id = (int)$b['id'];
        $statusInput = $b['status'];
        $approverNote = $b['reason'] ?? 'Không có ghi chú thêm';

        $stmtA = $this->db->prepare("SELECT a.*, u.full_name FROM hrm_salary_advances a JOIN users u ON a.user_id = u.id WHERE a.id = ?");
        $stmtA->execute([$id]);
        $advRow = $stmtA->fetch(PDO::FETCH_ASSOC);

        if (!$advRow) {
            respond(404, null, 'Yêu cầu tạm ứng không tồn tại', false);
        }

        $isApprover1 = ($auth['user_id'] == $advRow['approver_id']);
        $isApprover2 = ($auth['user_id'] == $advRow['approver_id_2']);

        $nextStatus = 'pending';
        $updateFields = [];
        $params = [];

        if ($statusInput === 'rejected') {
            $nextStatus = 'rejected';
            if ($isApprover1) {
                $updateFields[] = "status_level_1 = 'rejected'";
            }
            if ($isApprover2) {
                $updateFields[] = "status_level_2 = 'rejected'";
                $updateFields[] = "approved_by_2 = ?";
                $params[] = $auth['user_id'];
            }
            if (!$isApprover1 && !$isApprover2) {
                $updateFields[] = "status_level_1 = 'rejected'";
                $updateFields[] = "status_level_2 = 'rejected'";
            }
            
            if (!empty($approverNote) && $approverNote !== 'Không có ghi chú thêm') {
                $reasonAppend = "\n[Từ chối: " . $approverNote . "]";
                try {
                    $stmtReason = $this->db->prepare("UPDATE hrm_salary_advances SET reason = CONCAT(COALESCE(reason, ''), ?) WHERE id = ?");
                    $stmtReason->execute([$reasonAppend, $id]);
                } catch (\Throwable $e) {}
            }
        } else {
            if ($isApprover1) {
                $updateFields[] = "status_level_1 = 'approved'";
                
                if (!empty($advRow['approver_id_2'])) {
                    $nextStatus = 'pending';
                } else {
                    $nextStatus = 'approved';
                }
            }
            if ($isApprover2) {
                $updateFields[] = "status_level_2 = 'approved'";
                $updateFields[] = "approved_by_2 = ?";
                $params[] = $auth['user_id'];
                $nextStatus = 'approved';
            }
            if (!$isApprover1 && !$isApprover2) {
                $updateFields[] = "status_level_1 = 'approved'";
                $updateFields[] = "status_level_2 = 'approved'";
                $updateFields[] = "approved_by_2 = ?";
                $params[] = $auth['user_id'];
                $nextStatus = 'approved';
            }
        }

        $updateFields[] = "status = ?";
        $params[] = $nextStatus;
        $params[] = $id;

        $updateSql = "UPDATE hrm_salary_advances SET " . implode(", ", $updateFields) . " WHERE id = ?";
        $stmtUpdate = $this->db->prepare($updateSql);
        $stmtUpdate->execute($params);

        try {
            $statusText = $nextStatus === 'approved' ? 'Phê duyệt giải ngân hoàn toàn' : ($nextStatus === 'rejected' ? 'Từ chối' : 'Phê duyệt cấp 1 (Chờ Giám đốc duyệt)');

            require_once __DIR__ . '/../NotificationService.php';

            if ($statusInput === 'approved' && $isApprover1 && !empty($advRow['approver_id_2'])) {
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_REQUEST', [
                    'user_id' => $advRow['approver_id_2'],
                    'user_name' => $advRow['full_name'],
                    'amount' => (float)$advRow['amount'],
                    'reason' => 'Đã duyệt Cấp 1. Lý do ban đầu: ' . $advRow['reason'],
                    'date' => date('Y-m-d'),
                    'ref_id' => $id
                ]);
            } else {
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_APPROVAL', [
                    'user_id' => $advRow['user_id'],
                    'user_name' => $advRow['full_name'],
                    'amount' => (float)$advRow['amount'],
                    'status_text' => $statusText,
                    'reason' => $approverNote,
                    'ref_id' => $id,
                    'status' => $nextStatus
                ]);

                // Notify related persons of advance outcome
                if (!empty($advRow['related_user_ids'])) {
                    $relList = is_array($advRow['related_user_ids']) ? $advRow['related_user_ids'] : json_decode($advRow['related_user_ids'], true);
                    if (is_array($relList)) {
                        foreach ($relList as $relUid) {
                            $relUid = (int)$relUid;
                            if ($relUid > 0 && $relUid !== (int)$advRow['user_id'] && $relUid !== (int)$auth['user_id']) {
                                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_APPROVAL', [
                                    'user_id' => $relUid,
                                    'user_name' => $advRow['full_name'],
                                    'amount' => (float)$advRow['amount'],
                                    'status_text' => $statusText,
                                    'reason' => $approverNote . ' (Đơn bạn đang theo dõi đã có kết quả)',
                                    'ref_id' => $id,
                                    'status' => $nextStatus
                                ]);
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {}

        respond(200, ['success' => true]);
    }



    // --- PAYROLL CALCULATION ENGINE ---

    public function calculatePayroll(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        $monthYear = $b['month_year'] ?? ''; // Format: YYYY-MM or YYYY-13, YYYY-MID, YYYY-YEND
        if (empty($monthYear) || !preg_match('/^\d{4}-(?:[0-1]\d|13|MID|YEND)$/', $monthYear)) {
            respond(400, null, 'Định dạng kỳ thanh toán không hợp lệ', false);
        }

        // Standard work days in month (usually 26, custom if provided)
        $workDaysRequired = (int)($b['work_days_required'] ?? 26);

        // Fetch system settings for grace minutes
        $stmtGrace = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1");
        
        $stmtGrace->execute(['hrm_late_grace_male']);
        $graceMale = (int)($stmtGrace->fetchColumn() ?: 30); // Default 30 mins
        
        $stmtGrace->execute(['hrm_late_grace_female']);
        $graceFemale = (int)($stmtGrace->fetchColumn() ?: 60); // Default 60 mins

        // Check if special period
        $isSpecialPeriod = false;
        $isThang13 = false;
        if (preg_match('/^\d{4}-(13|MID|YEND)$/', $monthYear, $matches)) {
            $isSpecialPeriod = true;
            if ($matches[1] === '13') {
                $isThang13 = true;
            }
        }

        // Fetch all employees in tenant (excluding admin and director roles)
        $empStmt = $this->db->prepare("
            SELECT u.id, u.full_name, u.gender, u.role, p.base_salary, p.deal_salary, p.has_insurance,
                   p.allowance_meal, p.allowance_travel, p.allowance_phone, p.kpi_target, p.joined_date, p.custom_fields_json,
                   p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn,
                   p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used
            FROM users u
            LEFT JOIN hrm_profiles p ON u.id = p.user_id
            WHERE u.tenant_id = ? AND u.is_active = 1
        ");
        $empStmt->execute([$auth['tenant_id']]);
        $employees = $empStmt->fetchAll(PDO::FETCH_ASSOC);

        $results = [];

        // Pre-fetch all approved deposit milestones for YYYY-MM and their associated cooperation slips
        $milestonesList = [];
        $coopSlipsMap = [];
        if (!$isSpecialPeriod) {
            $milestonesStmt = $this->db->prepare("
                SELECT m.expected_amount, d.contact_id, d.created_by
                FROM deposit_milestones m
                JOIN deposits d ON m.deposit_id = d.id
                WHERE m.status = 'approved' AND DATE_FORMAT(m.approval_date, '%Y-%m') = ?
            ");
            $milestonesStmt->execute([$monthYear]);
            $milestonesList = $milestonesStmt->fetchAll(PDO::FETCH_ASSOC);

            $contactIds = array_values(array_unique(array_filter(array_column($milestonesList, 'contact_id'))));
            if (!empty($contactIds)) {
                $inContacts = implode(',', array_fill(0, count($contactIds), '?'));
                $csStmt = $this->db->prepare("SELECT contact_id, shares_json FROM cooperation_slips WHERE contact_id IN ($inContacts)");
                $csStmt->execute($contactIds);
                while ($row = $csStmt->fetch(PDO::FETCH_ASSOC)) {
                    $coopSlipsMap[(int)$row['contact_id']] = json_decode($row['shares_json'] ?? '[]', true) ?: [];
                }
            }

            // Load holiday schedules for automatic paid holiday credit
            $stmtHol = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'holiday_schedules' LIMIT 1");
            $holidaysJson = $stmtHol ? (string)$stmtHol->fetchColumn() : '[]';
            $holidayList = json_decode($holidaysJson, true) ?: [];
        }
        foreach ($employees as $emp) {
            $userId = (int)$emp['id'];

            // Hoàn trả số ngày nghỉ bù & phép năm đã trừ do đi trễ ở bảng lương cũ của tháng này (nếu có)
            $oldComp = 0.0;
            $oldAnn = 0.0;
            if (!$isSpecialPeriod) {
                $oldStmt = $this->db->prepare("SELECT /* refresh_cache_select */ lateness_compensatory_deducted, lateness_annual_deducted FROM monthly_payslips WHERE user_id = ? AND month_year = ? LIMIT 1");
                $oldStmt->execute([$userId, $monthYear]);
                $oldPayslip = $oldStmt->fetch(PDO::FETCH_ASSOC);
                if ($oldPayslip) {
                    $oldComp = (float)($oldPayslip['lateness_compensatory_deducted'] ?? 0.0);
                    $oldAnn = (float)($oldPayslip['lateness_annual_deducted'] ?? 0.0);
                    if ($oldComp > 0 || $oldAnn > 0) {
                        $restoreStmt = $this->db->prepare("UPDATE hrm_profiles SET compensatory_leave_used = GREATEST(0.0, compensatory_leave_used - ?), annual_leave_used = GREATEST(0.0, annual_leave_used - ?) WHERE user_id = ?");
                        $restoreStmt->execute([$oldComp, $oldAnn, $userId]);
                        
                        // Cập nhật lại trong PHP memory để tránh bất đồng bộ thông tin phép
                        $emp['compensatory_leave_used'] = max(0.0, (float)($emp['compensatory_leave_used'] ?? 0.0) - $oldComp);
                        $emp['annual_leave_used'] = max(0.0, (float)($emp['annual_leave_used'] ?? 0.0) - $oldAnn);
                    }
                }
            }

            $userRole = strtolower($emp['role'] ?? '');
            $isDirector = in_array($userRole, ['director', 'superadmin', 'super_admin'], true);

            $startDateOfMonth = $monthYear . '-01';
            $endDateOfMonth = date('Y-m-t', strtotime($startDateOfMonth));

            if ($isSpecialPeriod) {
                $actualWorkedDays = $isThang13 ? $workDaysRequired : 0;
                $paidLeaveDays = 0;
                $totalLateMinutes = 0;
                $overtimeDays = 0;
                $waivedDates = [];
                $checkinsList = [];
            } elseif ($isDirector) {
                // Director auto-enjoys 100% full work days without needing check-in
                $actualWorkedDays = (float)$workDaysRequired;
                $paidLeaveDays = 0.0;
                $totalLateMinutes = 0;
                $overtimeDays = 0.0;
                $waivedDates = [];
                $checkinsList = [];
            } else {
                // 1. Calculate Actual Work Days from check_ins & apply late_early waivers
                $leStmt = $this->db->prepare("
                    SELECT DATE(start_date) as le_date
                    FROM hrm_leave_requests
                    WHERE user_id = ? AND status = 'approved' AND leave_type = 'late_early'
                      AND start_date BETWEEN ? AND ?
                ");
                $leStmt->execute([$userId, $startDateOfMonth . ' 00:00:00', $endDateOfMonth . ' 23:59:59']);
                $waivedDates = $leStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

                $attStmt = $this->db->prepare("
                    SELECT check_in_date, late_minutes
                    FROM check_ins
                    WHERE user_id = ? AND status = 'approved' AND check_in_date BETWEEN ? AND ?
                ");
                $attStmt->execute([$userId, $startDateOfMonth, $endDateOfMonth]);
                $checkinsList = $attStmt->fetchAll(PDO::FETCH_ASSOC);

                // Query all approved leave requests per day to deduct overlapping days from actual check-in workdays
                $lvListStmt = $this->db->prepare("
                    SELECT DATE(start_date) as leave_date, SUM(total_days) as leave_days
                    FROM hrm_leave_requests
                    WHERE user_id = ? AND status = 'approved' AND leave_type IN ('annual', 'sick', 'compensatory', 'unpaid', 'remote_work', 'special_paid')
                      AND start_date BETWEEN ? AND ?
                    GROUP BY DATE(start_date)
                ");
                $lvListStmt->execute([$userId, $startDateOfMonth . ' 00:00:00', $endDateOfMonth . ' 23:59:59']);
                $leaveDaysMap = $lvListStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

                $actualWorkedDays = 0.0;
                $totalLateMinutes = 0;
                foreach ($checkinsList as $ci) {
                    $cDate = $ci['check_in_date'];
                    $leaveDaysOnDate = (float)($leaveDaysMap[$cDate] ?? 0.0);
                    $actualWorkedDays += max(0.0, 1.0 - $leaveDaysOnDate);

                    if (!in_array($cDate, $waivedDates)) {
                        $totalLateMinutes += (int)$ci['late_minutes'];
                    }
                }
            }

            // 2. Add approved leaves that are paid (leave_type = 'annual', 'sick', 'compensatory', 'remote_work', 'special_paid', 'maternity', 'paternity', 'marriage', 'funeral', 'business_trip')
            if ($isSpecialPeriod) {
                $paidLeaveDays = 0;
            } else {
                $lvStmt = $this->db->prepare("
                    SELECT SUM(total_days - unpaid_days) as paid_days
                    FROM hrm_leave_requests
                    WHERE user_id = ? AND status = 'approved' AND leave_type IN ('annual', 'sick', 'compensatory', 'remote_work', 'special_paid', 'maternity', 'paternity', 'marriage', 'funeral', 'business_trip')
                      AND DATE_FORMAT(start_date, '%Y-%m') = ?
                ");
                $lvStmt->execute([$userId, $monthYear]);
                $lv = $lvStmt->fetch(PDO::FETCH_ASSOC);
                $paidLeaveDays = (float)($lv['paid_days'] ?? 0);
            }

            // Calculate Paid Public Holidays in month (e.g. 2/9, 30/4, Tết) on working days not checked-in
            $paidHolidayDays = 0.0;
            if (!$isSpecialPeriod && !$isDirector && !empty($holidayList) && is_array($holidayList)) {
                $curH = strtotime($startDateOfMonth);
                $endH = strtotime($endDateOfMonth);
                while ($curH <= $endH) {
                    $cDate = date('Y-m-d', $curH);
                    $dayOfWeek = (int)date('N', $curH);
                    // Standard working weekday (Mon-Fri)
                    if ($dayOfWeek <= 5) {
                        foreach ($holidayList as $h) {
                            $hStart = $h['start'] ?? $h['start_date'] ?? $h['date'] ?? '';
                            $hEnd = $h['end'] ?? $h['end_date'] ?? $h['date'] ?? '';
                            $isPaid = isset($h['is_paid']) ? (int)$h['is_paid'] : 1;
                            if ($isPaid === 1 && !empty($hStart) && !empty($hEnd)) {
                                if ($cDate >= $hStart && $cDate <= $hEnd) {
                                    // Check if user already checked in on this date to avoid duplicate counting
                                    $alreadyCheckedIn = false;
                                    foreach ($checkinsList as $ci) {
                                        if ($ci['check_in_date'] === $cDate) {
                                            $alreadyCheckedIn = true;
                                            break;
                                        }
                                    }
                                    if (!$alreadyCheckedIn) {
                                        $paidHolidayDays += 1.0;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    $curH += 86400;
                }
            }

            $totalWorkDays = min((float)$workDaysRequired, $actualWorkedDays + $paidLeaveDays + $paidHolidayDays);

            // Tự động khấu trừ số phút đi trễ vào nghỉ bù -> phép năm -> ngày công
            $deductComp = 0.0;
            $deductAnn = 0.0;
            if (!$isSpecialPeriod && $totalLateMinutes > 0) {
                $remainComp = max(0.0, (float)($emp['compensatory_leave_total'] ?? 0.0) - (float)($emp['compensatory_leave_used'] ?? 0.0));
                $remainAnn = max(0.0, (float)($emp['annual_leave_total'] ?? 0.0) - (float)($emp['annual_leave_used'] ?? 0.0));
                
                $lateDays = $totalLateMinutes / 480.0;
                
                // Trừ vào nghỉ bù
                $deductComp = min($lateDays, $remainComp);
                $lateDaysRemaining = $lateDays - $deductComp;
                
                // Trừ vào phép năm
                $deductAnn = min($lateDaysRemaining, $remainAnn);
                $lateDaysRemaining = $lateDaysRemaining - $deductAnn;
                
                // Trừ vào ngày công thực tế
                $deductWorkDays = $lateDaysRemaining;
                $totalWorkDays = max(0.0, $totalWorkDays - $deductWorkDays);
                
                // Cập nhật lại số ngày phép đã sử dụng trong CSDL
                if ($deductComp > 0 || $deductAnn > 0) {
                    $updateProfileStmt = $this->db->prepare("UPDATE hrm_profiles SET compensatory_leave_used = compensatory_leave_used + ?, annual_leave_used = annual_leave_used + ? WHERE user_id = ?");
                    $updateProfileStmt->execute([$deductComp, $deductAnn, $userId]);
                }
            }

            // 3. Prorate Salary
            $baseSalary = (float)($emp['deal_salary'] ?? 0.0);
            $basicSalaryCalculated = 0.0;
            if ($isThang13 || $isDirector) {
                // Directors and 13th month receive 100% full deal salary automatically
                $basicSalaryCalculated = $baseSalary;
            } elseif (!$isSpecialPeriod) {
                $basicSalaryCalculated = ($workDaysRequired > 0) ? ($baseSalary / $workDaysRequired) * $totalWorkDays : 0;
            }

            // 4. Lateness Deduction Penalty with Gender Grace Threshold (Disabled as per user request)
            $latenessPenalty = 0.0;

            // 5. Allowances
            $allowanceTotal = 0.0;
            if (!$isSpecialPeriod) {
                $allowanceTotal = (float)($emp['allowance_meal'] ?? 0.0) + (float)($emp['allowance_travel'] ?? 0.0) + (float)($emp['allowance_phone'] ?? 0.0);
                if (!empty($emp['custom_fields_json'])) {
                    $customFields = json_decode($emp['custom_fields_json'], true);
                    if (is_array($customFields)) {
                        foreach ($customFields as $field) {
                            if (isset($field['value'])) {
                                $allowanceTotal += (float)$field['value'];
                            }
                        }
                    }
                }
            }

            // 6. Thưởng KPI based on revenue collected in approved milestones for YYYY-MM
            $kpiBonus = 0.0;
            $revenueCollected = 0.0;

            if (!$isSpecialPeriod) {
                foreach ($milestonesList as $mRow) {
                    $contactId = (int)$mRow['contact_id'];
                    $depositCreator = (int)$mRow['created_by'];
                    $amount = (float)$mRow['expected_amount'];

                    // Check if this contact has a cooperation slip for commission splitting in memory
                    $shares = isset($coopSlipsMap[$contactId]) ? $coopSlipsMap[$contactId] : null;

                    if ($shares !== null) {
                        if (isset($shares[$userId])) {
                            $percent = (float)$shares[$userId];
                            $revenueCollected += $amount * ($percent / 100.0);
                        }
                    } else {
                        // No cooperation slip, 100% of the revenue belongs to the deposit creator
                        if ($userId === $depositCreator) {
                            $revenueCollected += $amount;
                        }
                    }
                }

                $kpiTarget = (float)($emp['kpi_target'] ?? 0.0);
                if ($kpiTarget > 0) {
                    $achievementRate = $revenueCollected / $kpiTarget;
                    if ($achievementRate >= 1.2) {
                        $kpiBonus = $revenueCollected * 0.15; // 15% reward
                    } else if ($achievementRate >= 1.0) {
                        $kpiBonus = $revenueCollected * 0.10; // 10% reward
                    } else if ($achievementRate >= 0.8) {
                        $kpiBonus = $revenueCollected * 0.05; // 5% reward
                    } else {
                        $kpiBonus = 0.0;
                    }
                }
            }

            // 7. Insurance Deductions (social: 8%, health: 1.5%, unemployment: 1% of base_salary)
            $bhxh = 0;
            $bhyt = 0;
            $bhtn = 0;
            if (!$isSpecialPeriod) {
                $insuranceBase = (float)($emp['base_salary'] ?? 0.0);
                if ((int)($emp['has_insurance'] ?? 0) === 1 && $insuranceBase > 0) {
                    $rateBhxh = isset($emp['insurance_rate_bhxh']) ? (float)$emp['insurance_rate_bhxh'] / 100 : 0.08;
                    $rateBhyt = isset($emp['insurance_rate_bhyt']) ? (float)$emp['insurance_rate_bhyt'] / 100 : 0.015;
                    $rateBhtn = isset($emp['insurance_rate_bhtn']) ? (float)$emp['insurance_rate_bhtn'] / 100 : 0.01;
                    
                    $bhxh = $insuranceBase * $rateBhxh;
                    $bhyt = $insuranceBase * $rateBhyt;
                    $bhtn = $insuranceBase * $rateBhtn;
                }
            }

            // 8. Tax PIT (Thuế TNCN lũy tiến)
            $pit = 0;
            if (!$isSpecialPeriod || $isThang13) {
                $taxableMeal = max(0, (float)($emp['allowance_meal'] ?? 0.0) - 730000);
                $grossIncomeForTax = $basicSalaryCalculated + $kpiBonus + (float)($emp['allowance_travel'] ?? 0.0) + (float)($emp['allowance_phone'] ?? 0.0) + $taxableMeal;
                
                $insuranceDeductions = $bhxh + $bhyt + $bhtn;
                $personalDeduction = 11000000; // 11M VND
                $dependentsDeduction = 0; 
                
                $taxIncome = $grossIncomeForTax - $insuranceDeductions - $personalDeduction - $dependentsDeduction;
                if ($taxIncome > 0) {
                    if ($taxIncome <= 5000000) {
                        $pit = $taxIncome * 0.05;
                    } else if ($taxIncome <= 10000000) {
                        $pit = ($taxIncome * 0.10) - 250000;
                    } else if ($taxIncome <= 18000000) {
                        $pit = ($taxIncome * 0.15) - 750000;
                    } else if ($taxIncome <= 32000000) {
                        $pit = ($taxIncome * 0.20) - 1650000;
                    } else if ($taxIncome <= 52000000) {
                        $pit = ($taxIncome * 0.25) - 3250000;
                    } else if ($taxIncome <= 80000000) {
                        $pit = ($taxIncome * 0.30) - 5850000;
                    } else {
                        $pit = ($taxIncome * 0.35) - 9850000;
                    }
                }
            }

            // 9. Approved salary advances to deduct
            $advanceDeduction = 0.0;
            if (!$isSpecialPeriod) {
                $advStmt = $this->db->prepare("
                    SELECT SUM(amount) as adv_amt
                    FROM hrm_salary_advances
                    WHERE user_id = ? AND status = 'approved' AND deducted_payslip_id IS NULL
                ");
                $advStmt->execute([$userId]);
                $advVal = $advStmt->fetch(PDO::FETCH_ASSOC);
                $advanceDeduction = (float)($advVal['adv_amt'] ?? 0);
            }

            // 6b. Overtime calculation (Sum up approved leave requests of type 'overtime' in this month)
            $overtimeDays = 0.0;
            $overtimeSalary = 0.0;
            if (!$isSpecialPeriod) {
                $otStmt = $this->db->prepare("
                    SELECT SUM(total_days) as ot_days
                    FROM hrm_leave_requests
                    WHERE user_id = ? AND status = 'approved' AND leave_type = 'overtime'
                      AND DATE_FORMAT(start_date, '%Y-%m') = ?
                ");
                $otStmt->execute([$userId, $monthYear]);
                $otRow = $otStmt->fetch(PDO::FETCH_ASSOC);
                $overtimeDays = (float)($otRow['ot_days'] ?? 0);

                // Overtime salary: (deal_salary / work_days_required) * overtime_days * 1.5
                $overtimeSalary = ($workDaysRequired > 0) ? (($baseSalary / $workDaysRequired) * $overtimeDays * 1.5) : 0;
            }

            // 6c. Diligence calculation (Disabled as per user request)
            $diligenceBonus = 0.0;

            // 10. Net Pay calculation
            $netSalary = $basicSalaryCalculated + $allowanceTotal + $kpiBonus + $overtimeSalary + $diligenceBonus - $insuranceDeductions - $latenessPenalty - $pit - $advanceDeduction;
            if ($netSalary < 0) $netSalary = 0;

            // Save or Update into monthly_payslips
            $saveStmt = $this->db->prepare("
                INSERT /* refresh_cache_v3 */ INTO monthly_payslips (user_id, month_year, work_days_required, work_days_actual, lateness_minutes, lateness_penalty, lateness_compensatory_deducted, lateness_annual_deducted, salary_basic_calculated, allowance_total, kpi_bonus, insurance_bhxh, insurance_bhyt, insurance_bhtn, tax_pit, advance_deduction, net_salary, status, overtime_days, overtime_salary, diligence_bonus)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    work_days_required = VALUES(work_days_required),
                    work_days_actual = VALUES(work_days_actual),
                    lateness_minutes = VALUES(lateness_minutes),
                    lateness_penalty = VALUES(lateness_penalty),
                    lateness_compensatory_deducted = VALUES(lateness_compensatory_deducted),
                    lateness_annual_deducted = VALUES(lateness_annual_deducted),
                    salary_basic_calculated = VALUES(salary_basic_calculated),
                    allowance_total = VALUES(allowance_total),
                    kpi_bonus = VALUES(kpi_bonus),
                    insurance_bhxh = VALUES(insurance_bhxh),
                    insurance_bhyt = VALUES(insurance_bhyt),
                    insurance_bhtn = VALUES(insurance_bhtn),
                    tax_pit = VALUES(tax_pit),
                    advance_deduction = VALUES(advance_deduction),
                    net_salary = VALUES(net_salary),
                    overtime_days = VALUES(overtime_days),
                    overtime_salary = VALUES(overtime_salary),
                    diligence_bonus = VALUES(diligence_bonus)
            ");
            $saveStmt->execute([
                $userId,
                $monthYear,
                $workDaysRequired,
                $totalWorkDays,
                $totalLateMinutes,
                $latenessPenalty,
                $deductComp,
                $deductAnn,
                $basicSalaryCalculated,
                $allowanceTotal,
                $kpiBonus,
                $bhxh,
                $bhyt,
                $bhtn,
                $pit,
                $advanceDeduction,
                $netSalary,
                $overtimeDays,
                $overtimeSalary,
                $diligenceBonus
            ]);

            // Link advances to this payslip once generated
            $payslipId = (int)$this->db->lastInsertId();
            if ($payslipId === 0) {
                $stmtId = $this->db->prepare("SELECT id FROM monthly_payslips WHERE user_id = ? AND month_year = ?");
                $stmtId->execute([$userId, $monthYear]);
                $payslipId = (int)$stmtId->fetchColumn();
            }
            if ($payslipId > 0 && $advanceDeduction > 0) {
                $upAdv = $this->db->prepare("UPDATE hrm_salary_advances SET deducted_payslip_id = ? WHERE user_id = ? AND status = 'approved' AND deducted_payslip_id IS NULL");
                $upAdv->execute([$payslipId, $userId]);
            }

            $results[] = [
                'user_id' => $userId,
                'full_name' => $emp['full_name'],
                'work_days_actual' => $totalWorkDays,
                'lateness_minutes' => $totalLateMinutes,
                'net_salary' => $netSalary
            ];
        }

        respond(200, ['success' => true, 'data' => $results]);
    }

    // --- PAYSLIP CONTROLS ---

    public function indexPayslips(array $auth): void {
        $monthYear = $_GET['month_year'] ?? '';
        if (empty($monthYear)) respond(400, null, 'Thiếu tham số tháng (month_year)', false);

        if ($monthYear === 'all') {
            if ($this->isAdmin($auth)) {
                $stmt = $this->db->prepare("
                    SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title
                    FROM monthly_payslips p
                    JOIN users u ON p.user_id = u.id
                    WHERE u.tenant_id = ?
                    ORDER BY p.month_year DESC
                ");
                $stmt->execute([$auth['tenant_id']]);
            } else {
                $stmt = $this->db->prepare("
                    SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title
                    FROM monthly_payslips p
                    JOIN users u ON p.user_id = u.id
                    WHERE p.user_id = ?
                    ORDER BY p.month_year DESC
                ");
                $stmt->execute([$auth['user_id']]);
            }
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            return;
        }

        if ($this->isAdmin($auth)) {
            $stmt = $this->db->prepare("
                SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title
                FROM monthly_payslips p
                JOIN users u ON p.user_id = u.id
                WHERE u.tenant_id = ? AND p.month_year = ?
            ");
            $stmt->execute([$auth['tenant_id'], $monthYear]);
        } else {
            $stmt = $this->db->prepare("
                SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title
                FROM monthly_payslips p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ? AND p.month_year = ?
            ");
            $stmt->execute([$auth['user_id'], $monthYear]);
        }
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function sendPayslips(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        $id = (int)($b['id'] ?? 0);
        $monthYear = $b['month_year'] ?? '';

        if ($id > 0) {
            $stmt = $this->db->prepare("
                UPDATE monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                SET mp.status = 'sent', mp.signature_url = NULL, mp.confirmed_at = NULL, mp.note = NULL 
                WHERE mp.id = ? AND u.tenant_id = ?
            ");
            $stmt->execute([$id, $auth['tenant_id']]);

            $stmtP = $this->db->prepare("
                SELECT p.*, u.full_name 
                FROM monthly_payslips p 
                JOIN users u ON p.user_id = u.id 
                WHERE p.id = ? AND u.tenant_id = ?
            ");
            $stmtP->execute([$id, $auth['tenant_id']]);
            $psRow = $stmtP->fetch(PDO::FETCH_ASSOC);

            if ($psRow) {
                try {
                    require_once __DIR__ . '/../NotificationService.php';
                    NotificationService::send($this->db, $auth['tenant_id'], 'HRM_PAYSLIP_PUBLISHED', [
                        'user_id' => $psRow['user_id'],
                        'user_name' => $psRow['full_name'],
                        'month_year' => $psRow['month_year']
                    ]);
                } catch (\Throwable $e) {}
            }
            respond(200, ['success' => true]);
            return;
        }

        if (empty($monthYear)) respond(400, null, 'Thiếu tháng gửi phiếu lương', false);

        // Fetch users who have draft/disputed payslips in this month to notify them
        $stmtUsers = $this->db->prepare("
            SELECT DISTINCT mp.user_id 
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.month_year = ? AND mp.status IN ('draft', 'disputed') AND u.tenant_id = ?
        ");
        $stmtUsers->execute([$monthYear, $auth['tenant_id']]);
        $userIds = $stmtUsers->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $stmt = $this->db->prepare("
            UPDATE monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            SET mp.status = 'sent' 
            WHERE mp.month_year = ? AND mp.status IN ('draft', 'disputed') AND u.tenant_id = ?
        ");
        $stmt->execute([$monthYear, $auth['tenant_id']]);

        // Dispatch Notifications
        try {
            require_once __DIR__ . '/../NotificationService.php';
            foreach ($userIds as $uid) {
                $stmtU = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtU->execute([$uid]);
                $uName = $stmtU->fetchColumn() ?: 'Nhân viên';

                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_PAYSLIP_PUBLISHED', [
                    'user_id' => $uid,
                    'user_name' => $uName,
                    'month_year' => $monthYear
                ]);
            }
        } catch (\Throwable $e) {}

        respond(200, ['success' => true]);
    }

    public function confirmPayslip(array $auth): void {
        $b = getBody();
        $id = (int)($b['id'] ?? 0);
        $signatureUrl = $b['signature_url'] ?? '';
        $action = $b['action'] ?? 'confirm';
        $note = trim($b['note'] ?? '');

        if ($id <= 0) respond(400, null, 'Thiếu ID phiếu lương', false);

        // Fetch payslip to verify permission and tenant ownership
        $stmtCheck = $this->db->prepare("
            SELECT mp.*, u.tenant_id as owner_tenant_id 
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.id = ?
        ");
        $stmtCheck->execute([$id]);
        $psRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if (!$psRow) {
            respond(404, null, 'Không tìm thấy phiếu lương', false);
            return;
        }

        if ((int)$psRow['owner_tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Không có quyền truy cập dữ liệu của tenant khác', false);
            return;
        }

        $isOwner = ((int)$psRow['user_id'] === (int)$auth['user_id']);
        $isAdmin = $this->isAdmin($auth);

        if (!$isOwner && !$isAdmin) {
            respond(403, null, 'Bạn không có quyền thao tác trên phiếu lương này', false);
            return;
        }

        if ($action === 'dispute') {
            if (empty($note)) respond(400, null, 'Vui lòng nhập lý do/ghi chú yêu cầu thay đổi', false);

            $stmt = $this->db->prepare("
                UPDATE monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                SET mp.status = 'disputed', mp.note = ? 
                WHERE mp.id = ? AND u.tenant_id = ?
            ");
            $stmt->execute([$note, $id, $auth['tenant_id']]);

            // Dispatch Notification
            try {
                require_once __DIR__ . '/../NotificationService.php';
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_PAYSLIP_DISPUTED', [
                    'user_name' => $psRow['employee_name'] ?? 'Nhân viên',
                    'month_year' => $psRow['month_year'],
                    'note' => $note
                ]);
            } catch (\Throwable $e) {}

            respond(200, ['success' => true, 'message' => 'Đã gửi yêu cầu thay đổi thành công']);
            return;
        }

        if (empty($signatureUrl)) respond(400, null, 'Chữ ký là bắt buộc để xác nhận phiếu lương', false);

        $stmt = $this->db->prepare("
            UPDATE monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            SET mp.status = 'confirmed', mp.signature_url = ?, mp.confirmed_at = NOW() 
            WHERE mp.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$signatureUrl, $id, $auth['tenant_id']]);

        // Dispatch Notification
        try {
            require_once __DIR__ . '/../NotificationService.php';
            NotificationService::send($this->db, $auth['tenant_id'], 'HRM_PAYSLIP_CONFIRMED', [
                'user_name' => $psRow['employee_name'] ?? 'Nhân viên',
                'month_year' => $psRow['month_year']
            ]);
        } catch (\Throwable $e) {}

        respond(200, ['success' => true, 'signature_url' => $signatureUrl]);
    }

    public function lockPayroll(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        $monthYear = $b['month_year'] ?? '';
        if (empty($monthYear)) respond(400, null, 'Thiếu tháng khóa lương', false);

        $action = $b['action'] ?? 'lock';
        if ($action === 'unlock') {
            $stmt = $this->db->prepare("
                UPDATE monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                SET mp.status = 'draft', mp.signature_url = NULL, mp.confirmed_at = NULL 
                WHERE mp.month_year = ? AND u.tenant_id = ?
            ");
            $stmt->execute([$monthYear, $auth['tenant_id']]);
            respond(200, ['success' => true, 'message' => 'Unlocked successfully']);
            return;
        }

        $stmt = $this->db->prepare("
            UPDATE monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            SET mp.status = 'locked' 
            WHERE mp.month_year = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$monthYear, $auth['tenant_id']]);

        respond(200, ['success' => true]);
    }

    public function getPendingApprovals(array $auth): void {
        $pending = [];
        $userId = $auth['user_id'];
        $role = strtolower($auth['role']);
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr']);

        $ledTeamIds = [];
        $managedUserIds = [];
        if ($role === 'manager') {
            $stmtL = $this->db->prepare("SELECT id FROM teams WHERE leader_id = ?");
            $stmtL->execute([$userId]);
            $ledTeamIds = array_map('intval', $stmtL->fetchAll(PDO::FETCH_COLUMN) ?: []);

            if (!empty($ledTeamIds)) {
                $placeholders = implode(',', array_fill(0, count($ledTeamIds), '?'));
                $stmtM = $this->db->prepare("SELECT id FROM users WHERE team_id IN ($placeholders)");
                $stmtM->execute($ledTeamIds);
                $managedUserIds = array_map('intval', $stmtM->fetchAll(PDO::FETCH_COLUMN) ?: []);
            }
        }

        // 1. Pending Leaves
        $stmtLeaves = $this->db->prepare("
            SELECT l.id, l.user_id, u.full_name as employee_name, l.leave_type, 
                   l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                   l.approver_id, l.approver_id_2, l.status_level_1, l.status_level_2
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            WHERE u.tenant_id = ? AND l.status = 'pending'
        ");
        $stmtLeaves->execute([$auth['tenant_id']]);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $shouldShow = false;
            if ($l['status_level_1'] === 'pending') {
                if ($l['approver_id'] == $userId || in_array((int)$l['user_id'], $managedUserIds, true) || (empty($l['approver_id']) && $isGlobalAdmin)) {
                    $shouldShow = true;
                }
            } else if ($l['status_level_1'] === 'approved' && $l['status_level_2'] === 'pending') {
                if ($l['approver_id_2'] == $userId || $isGlobalAdmin) {
                    $shouldShow = true;
                }
            }

            if ($shouldShow) {
                $levelText = ($l['status_level_1'] === 'approved') ? 'Cấp 2 (Giám đốc)' : 'Cấp 1 (Quản lý)';
                $pending[] = [
                    'id' => (int)$l['id'],
                    'type' => 'leave',
                    'employee_name' => $l['employee_name'],
                    'user_id' => (int)$l['user_id'],
                    'approver_id' => (int)($l['approver_id'] ?? 0),
                    'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                    'status_level_1' => $l['status_level_1'] ?? 'pending',
                    'status_level_2' => $l['status_level_2'] ?? 'none',
                    'title' => self::formatLeaveTitle($l['leave_type']) . ' - ' . $levelText,
                    'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                    'status' => $l['status'] ?? 'pending',
                    'created_at' => $l['created_at']
                ];
            }
        }

        // 2. Pending Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.id, a.user_id, u.full_name as employee_name, a.amount, a.reason, a.status, a.created_at,
                   a.approver_id, a.approver_id_2, a.status_level_1, a.status_level_2
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            WHERE u.tenant_id = ? AND a.status = 'pending'
        ");
        $stmtAdvances->execute([$auth['tenant_id']]);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $shouldShow = false;
            if ($a['status_level_1'] === 'pending') {
                if ($a['approver_id'] == $userId || in_array((int)$a['user_id'], $managedUserIds, true) || (empty($a['approver_id']) && $isGlobalAdmin)) {
                    $shouldShow = true;
                }
            } else if ($a['status_level_1'] === 'approved' && $a['status_level_2'] === 'pending') {
                if ($a['approver_id_2'] == $userId || $isGlobalAdmin) {
                    $shouldShow = true;
                }
            }

            if ($shouldShow) {
                $levelText = ($a['status_level_1'] === 'approved') ? 'Cấp 2 (Giám đốc)' : 'Cấp 1 (Quản lý)';
                $pending[] = [
                    'id' => (int)$a['id'],
                    'type' => 'advance',
                    'employee_name' => $a['employee_name'],
                    'user_id' => (int)$a['user_id'],
                    'approver_id' => (int)($a['approver_id'] ?? 0),
                    'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                    'status_level_1' => $a['status_level_1'] ?? 'pending',
                    'status_level_2' => $a['status_level_2'] ?? 'none',
                    'title' => 'Đề xuất tạm ứng lương - ' . $levelText,
                    'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                    'status' => $a['status'] ?? 'pending',
                    'created_at' => $a['created_at']
                ];
            }
        }

        // 3. Pending Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.id, e.created_by, u.full_name as employee_name, e.title, e.amount, e.category, e.date, e.notes, e.status, e.created_at,
                   e.approver_id, e.approver_id_2, e.approver_id_3, e.status_level_1, e.status_level_2, e.status_level_3
            FROM expenses e
            JOIN users u ON e.created_by = u.id
            WHERE e.tenant_id = ? AND e.status = 'pending' AND e.deleted_at IS NULL
        ");
        $stmtExpenses->execute([$auth['tenant_id']]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $shouldShow = false;
            $levelText = '';
            
            $lvl1 = $e['status_level_1'] ?? 'pending';
            $lvl2 = $e['status_level_2'] ?? 'none';
            $lvl3 = $e['status_level_3'] ?? 'none';

            if ($isGlobalAdmin) {
                // Admin/Director có quyền kiểm tra và phê duyệt tất cả đề xuất/chi phí tồn đọng
                $shouldShow = true;
                if ($lvl1 === 'pending') {
                    $levelText = !empty($e['approver_id_2']) ? ' - Cấp 1' : '';
                } elseif ($lvl1 === 'approved' && $lvl2 === 'pending') {
                    $levelText = ' - Cấp 2';
                } elseif ($lvl1 === 'approved' && $lvl2 === 'approved' && $lvl3 === 'pending') {
                    $levelText = ' - Cấp 3';
                }
            } else {
                if ($lvl1 === 'pending') {
                    if ($e['approver_id'] == $userId || in_array((int)$e['created_by'], $managedUserIds, true)) {
                        $shouldShow = true;
                        $levelText = ' - Cấp 1';
                    }
                } elseif ($lvl1 === 'approved' && $lvl2 === 'pending') {
                    if ($e['approver_id_2'] == $userId || in_array($role, ['accountant'])) {
                        $shouldShow = true;
                        $levelText = ' - Cấp 2';
                    }
                } elseif ($lvl1 === 'approved' && $lvl2 === 'approved' && $lvl3 === 'pending') {
                    if ($e['approver_id_3'] == $userId) {
                        $shouldShow = true;
                        $levelText = ' - Cấp 3';
                    }
                }
            }

            if ($shouldShow) {
                $isZeroAmt = (float)($e['amount'] ?? 0) == 0;
                $displayTitle = $e['title'];
                if (!$isZeroAmt && !str_starts_with(mb_strtolower($e['title']), 'đề xuất') && !str_starts_with(mb_strtolower($e['title']), 'đề nghị') && !str_starts_with(mb_strtolower($e['title']), 'yêu cầu')) {
                    $displayTitle = 'Yêu cầu chi phí: ' . $e['title'];
                }
                $displayTitle .= $levelText;
                
                $displayDesc = $isZeroAmt 
                    ? ($e['notes'] ?: $e['description'] ?: '')
                    : ('Số tiền: ' . number_format($e['amount'], 0, ',', '.') . 'đ' . (!empty($e['notes']) ? '. Ghi chú: "' . $e['notes'] . '"' : ''));

                $pending[] = [
                    'id' => (int)$e['id'],
                    'type' => 'expense',
                    'employee_name' => $e['employee_name'],
                    'user_id' => (int)($e['created_by'] ?? 0),
                    'approver_id' => (int)($e['approver_id'] ?? 0),
                    'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                    'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                    'status_level_1' => $e['status_level_1'] ?? 'pending',
                    'status_level_2' => $e['status_level_2'] ?? 'none',
                    'status_level_3' => $e['status_level_3'] ?? 'none',
                    'title' => $displayTitle,
                    'description' => $displayDesc,
                    'amount' => (float)$e['amount'],
                    'currency' => 'VND',
                    'category' => $e['category'] ?? 'Vận hành',
                    'date' => $e['date'] ?? null,
                    'notes' => $e['notes'] ?? '',
                    'status' => $e['status'] ?? 'pending',
                    'created_at' => $e['created_at']
                ];
            }
        }

        // 4. Pending Checkins
        if (in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr']) || !empty($managedUserIds)) {
            $sqlCheck = "SELECT c.id, u.full_name as employee_name, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at
                         FROM check_ins c
                         JOIN users u ON c.user_id = u.id
                         WHERE u.tenant_id = ? AND c.status = 'pending_approval'";
            $pCheck = [$auth['tenant_id']];
            if (!in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr'])) {
                $placeholders = implode(',', array_fill(0, count($managedUserIds), '?'));
                $sqlCheck .= " AND c.user_id IN ($placeholders)";
                $pCheck = array_merge($pCheck, $managedUserIds);
            }
            $stmtCheckins = $this->db->prepare($sqlCheck);
            $stmtCheckins->execute($pCheck);
            $checkins = $stmtCheckins->fetchAll(PDO::FETCH_ASSOC);
            foreach ($checkins as $c) {
                $pending[] = [
                    'id' => (int)$c['id'],
                    'type' => 'checkin',
                    'employee_name' => $c['employee_name'],
                    'title' => 'Giải trình đi trễ ngày ' . $c['check_in_date'],
                    'description' => 'Đi trễ ' . $c['late_minutes'] . ' phút (Check-in lúc ' . $c['check_in_time'] . '). Lý do: "' . $c['reason'] . '"',
                    'created_at' => $c['created_at']
                ];
            }
        }

        // 5. Pending Bulk Attendance Requests
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name, u.team_id
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            WHERE u.tenant_id = ? AND r.status IN ('pending_manager', 'pending_hr')
        ");
        $stmtBulks->execute([$auth['tenant_id']]);
        $bulks = $stmtBulks->fetchAll(PDO::FETCH_ASSOC);
        foreach ($bulks as $b) {
            $shouldShow = false;
            $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
            if ($isAdmin) {
                $shouldShow = true;
            } else if ($b['status'] === 'pending_hr' && $role === 'hr') {
                $shouldShow = true;
            } else if ($b['status'] === 'pending_manager' && $role === 'manager' && (in_array((int)($b['team_id'] ?? 0), $ledTeamIds, true) || (int)($b['manager_id'] ?? 0) === $userId)) {
                $shouldShow = true;
            }

            if ($shouldShow) {
                $pending[] = [
                    'id' => (int)$b['id'],
                    'type' => 'attendance_bulk',
                    'employee_name' => $b['employee_name'],
                    'user_id' => (int)$b['user_id'],
                    'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                    'manager_id' => (int)($b['manager_id'] ?? 0),
                    'approved_at' => $b['approved_at'] ?? null,
                    'title' => 'Phiếu cập nhật công gộp tháng ' . $b['month_period'],
                    'description' => 'Giải trình công hàng loạt chu kỳ tháng ' . $b['month_period'],
                    'status' => $b['status'],
                    'created_at' => $b['created_at']
                ];
            }
        }

        // Sort by created_at DESC
        usort($pending, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        respond(200, $pending);
    }

    public function getMyRequests(array $auth): void {
        $pending = [];
        $userId = (int)$auth['user_id'];

        // 1. My Leaves
        $stmtLeaves = $this->db->prepare("
            SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                   l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, u.full_name as employee_name
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            WHERE l.user_id = ?
        ");
        $stmtLeaves->execute([$userId]);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $statusText = $l['status'];
            if ($l['status'] === 'pending' && $l['status_level_1'] === 'approved' && !empty($l['approver_id_2'])) {
                $statusText = 'level1_approved';
            }
            $pending[] = [
                'id' => (int)$l['id'],
                'type' => 'leave',
                'employee_name' => $l['employee_name'],
                'user_id' => (int)$l['user_id'],
                'approver_id' => (int)($l['approver_id'] ?? 0),
                'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                'title' => self::formatLeaveTitle($l['leave_type']),
                'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                'status' => $statusText,
                'created_at' => $l['created_at']
            ];
        }

        // 2. My Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.id, a.amount, a.reason, a.status, a.created_at,
                   a.status_level_1, a.status_level_2, a.approver_id, a.approver_id_2, a.user_id, u.full_name as employee_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            WHERE a.user_id = ?
        ");
        $stmtAdvances->execute([$userId]);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $statusText = $a['status'];
            if ($a['status'] === 'pending' && $a['status_level_1'] === 'approved' && !empty($a['approver_id_2'])) {
                $statusText = 'level1_approved';
            }
            $pending[] = [
                'id' => (int)$a['id'],
                'type' => 'advance',
                'employee_name' => $a['employee_name'],
                'user_id' => (int)$a['user_id'],
                'approver_id' => (int)($a['approver_id'] ?? 0),
                'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                'title' => 'Đề xuất tạm ứng lương',
                'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                'status' => $statusText,
                'created_at' => $a['created_at']
            ];
        }

        // 3. My Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.id, e.title, e.amount, e.category, e.date, e.notes, e.status, e.created_at, e.approver_id, e.approver_id_2, e.approver_id_3, e.created_by as user_id, u.full_name as employee_name
            FROM expenses e
            JOIN users u ON e.created_by = u.id
            WHERE e.created_by = ? AND e.deleted_at IS NULL
        ");
        $stmtExpenses->execute([$userId]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $isZeroAmt = (float)($e['amount'] ?? 0) == 0;
            $displayTitle = $e['title'];
            if (!$isZeroAmt && !str_starts_with(mb_strtolower($e['title']), 'đề xuất') && !str_starts_with(mb_strtolower($e['title']), 'đề nghị') && !str_starts_with(mb_strtolower($e['title']), 'yêu cầu')) {
                $displayTitle = 'Yêu cầu chi phí: ' . $e['title'];
            }
            
            $displayDesc = $isZeroAmt 
                ? ($e['notes'] ?: $e['description'] ?: '')
                : ('Số tiền: ' . number_format($e['amount'], 0, ',', '.') . 'đ' . (!empty($e['notes']) ? '. Ghi chú: "' . $e['notes'] . '"' : ''));

            $pending[] = [
                'id' => (int)$e['id'],
                'type' => 'expense',
                'employee_name' => $e['employee_name'],
                'user_id' => (int)$e['user_id'],
                'approver_id' => (int)($e['approver_id'] ?? 0),
                'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                'title' => $displayTitle,
                'description' => $displayDesc,
                'amount' => (float)$e['amount'],
                'currency' => 'VND',
                'category' => $e['category'] ?? 'Vận hành',
                'date' => $e['date'] ?? null,
                'notes' => $e['notes'] ?? '',
                'status' => $e['status'],
                'created_at' => $e['created_at']
            ];
        }

        // 4. My Checkins
        $stmtCheckins = $this->db->prepare("
            SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, u.full_name as employee_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.user_id = ? AND c.late_minutes > 0
        ");
        $stmtCheckins->execute([$userId]);
        $checkins = $stmtCheckins->fetchAll(PDO::FETCH_ASSOC);
        foreach ($checkins as $c) {
            $pending[] = [
                'id' => (int)$c['id'],
                'type' => 'checkin',
                'employee_name' => $c['employee_name'],
                'user_id' => (int)$c['user_id'],
                'title' => 'Giải trình đi trễ ngày ' . $c['check_in_date'],
                'description' => 'Đi trễ ' . $c['late_minutes'] . ' phút (Check-in lúc ' . $c['check_in_time'] . '). Lý do: "' . $c['reason'] . '"',
                'status' => $c['status'],
                'created_at' => $c['created_at']
            ];
        }

        // 5. My Bulk Attendance Requests
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.user_id = ?
        ");
        $stmtBulks->execute([$userId]);
        $bulks = $stmtBulks->fetchAll(PDO::FETCH_ASSOC);
        foreach ($bulks as $b) {
            $pending[] = [
                'id' => (int)$b['id'],
                'type' => 'attendance_bulk',
                'employee_name' => $b['employee_name'],
                'user_id' => (int)$b['user_id'],
                'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                'manager_id' => (int)($b['manager_id'] ?? 0),
                'approved_at' => $b['approved_at'] ?? null,
                'title' => 'Phiếu cập nhật công gộp tháng ' . $b['month_period'],
                'description' => 'Giải trình công hàng loạt chu kỳ tháng ' . $b['month_period'],
                'status' => $b['status'],
                'created_at' => $b['created_at']
            ];
        }

        // Sort by created_at DESC
        usort($pending, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        respond(200, $pending);
    }

    public function getFollowingRequests(array $auth): void {
        $pending = [];
        $userId = (int)$auth['user_id'];
        $role = strtolower($auth['role'] ?? '');

        // 1. Leaves where user is in related_user_ids or user is HR (excluding leaves created by self)
        $stmtLeaves = $this->db->prepare("
            SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                   l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids, u.full_name as employee_name
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            WHERE u.tenant_id = ?
            ORDER BY l.created_at DESC
        ");
        $stmtLeaves->execute([$auth['tenant_id']]);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isWatcher = in_array($userId, $relArr, true) || ($role === 'hr' && (int)$l['user_id'] !== $userId);
            if ($isWatcher && (int)$l['user_id'] !== $userId) {
                $statusText = $l['status'];
                if ($l['status'] === 'pending' && $l['status_level_1'] === 'approved' && !empty($l['approver_id_2'])) {
                    $statusText = 'level1_approved';
                }
                $pending[] = [
                    'id' => (int)$l['id'],
                    'type' => 'leave',
                    'employee_name' => $l['employee_name'],
                    'user_id' => (int)$l['user_id'],
                    'approver_id' => (int)($l['approver_id'] ?? 0),
                    'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                    'related_user_ids' => $relArr,
                    'title' => self::formatLeaveTitle($l['leave_type']),
                    'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                    'status' => $statusText,
                    'created_at' => $l['created_at'],
                    'is_following' => true
                ];
            }
        }

        // 2. Advances where user is in related_user_ids
        $stmtAdvances = $this->db->prepare("
            SELECT a.id, a.amount, a.reason, a.status, a.created_at,
                   a.status_level_1, a.status_level_2, a.approver_id, a.approver_id_2, a.user_id, a.related_user_ids, u.full_name as employee_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            WHERE u.tenant_id = ?
            ORDER BY a.created_at DESC
        ");
        $stmtAdvances->execute([$auth['tenant_id']]);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isWatcher = in_array($userId, $relArr, true);
            if ($isWatcher && (int)$a['user_id'] !== $userId) {
                $statusText = $a['status'];
                if ($a['status'] === 'pending' && $a['status_level_1'] === 'approved' && !empty($a['approver_id_2'])) {
                    $statusText = 'level1_approved';
                }
                $pending[] = [
                    'id' => (int)$a['id'],
                    'type' => 'advance',
                    'employee_name' => $a['employee_name'],
                    'user_id' => (int)$a['user_id'],
                    'approver_id' => (int)($a['approver_id'] ?? 0),
                    'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                    'related_user_ids' => $relArr,
                    'title' => 'Đề xuất tạm ứng lương',
                    'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                    'status' => $statusText,
                    'created_at' => $a['created_at'],
                    'is_following' => true
                ];
            }
        }

        // 3. Expenses where user is in related_user_ids
        $stmtExpenses = $this->db->prepare("
            SELECT e.id, e.title, e.amount, e.category, e.date, e.notes, e.status, e.created_at, e.approver_id, e.approver_id_2, e.approver_id_3, e.created_by as user_id, e.related_user_ids, u.full_name as employee_name
            FROM expenses e
            JOIN users u ON e.created_by = u.id
            WHERE e.tenant_id = ? AND e.deleted_at IS NULL
            ORDER BY e.created_at DESC
        ");
        $stmtExpenses->execute([$auth['tenant_id']]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isWatcher = in_array($userId, $relArr, true);
            if ($isWatcher && (int)$e['user_id'] !== $userId) {
                $isZeroAmt = (float)($e['amount'] ?? 0) == 0;
                $displayTitle = $e['title'];
                if (!$isZeroAmt && !str_starts_with(mb_strtolower($e['title']), 'đề xuất') && !str_starts_with(mb_strtolower($e['title']), 'đề nghị') && !str_starts_with(mb_strtolower($e['title']), 'yêu cầu')) {
                    $displayTitle = 'Yêu cầu chi phí: ' . $e['title'];
                }
                
                $displayDesc = $isZeroAmt 
                    ? ($e['notes'] ?: $e['description'] ?: '')
                    : ('Số tiền: ' . number_format($e['amount'], 0, ',', '.') . 'đ' . (!empty($e['notes']) ? '. Ghi chú: "' . $e['notes'] . '"' : ''));

                $pending[] = [
                    'id' => (int)$e['id'],
                    'type' => 'expense',
                    'employee_name' => $e['employee_name'],
                    'user_id' => (int)$e['user_id'],
                    'approver_id' => (int)($e['approver_id'] ?? 0),
                    'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                    'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                    'related_user_ids' => $relArr,
                    'title' => $displayTitle,
                    'description' => $displayDesc,
                    'amount' => (float)$e['amount'],
                    'currency' => 'VND',
                    'category' => $e['category'] ?? 'Vận hành',
                    'date' => $e['date'] ?? null,
                    'notes' => $e['notes'] ?? '',
                    'status' => $e['status'],
                    'created_at' => $e['created_at'],
                    'is_following' => true
                ];
            }
        }

        // Sort by created_at DESC
        usort($pending, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        respond(200, $pending);
    }

    public function getAllApprovals(array $auth): void {
        $userId = (int)$auth['user_id'];
        $role = strtolower($auth['role'] ?? '');
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr', 'accountant'], true);

        $ledTeamIds = [];
        $managedUserIds = [];
        if ($role === 'manager') {
            $stmtL = $this->db->prepare("SELECT id FROM teams WHERE leader_id = ?");
            $stmtL->execute([$userId]);
            $ledTeamIds = array_map('intval', $stmtL->fetchAll(PDO::FETCH_COLUMN) ?: []);

            if (!empty($ledTeamIds)) {
                $placeholders = implode(',', array_fill(0, count($ledTeamIds), '?'));
                $stmtM = $this->db->prepare("SELECT id FROM users WHERE team_id IN ($placeholders)");
                $stmtM->execute($ledTeamIds);
                $managedUserIds = array_map('intval', $stmtM->fetchAll(PDO::FETCH_COLUMN) ?: []);
            }
        }

        $all = [];

        // 1. All Leaves
        $stmtLeaves = $this->db->prepare("
            SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                   l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids, u.full_name as employee_name
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            WHERE u.tenant_id = ?
            ORDER BY l.created_at DESC
        ");
        $stmtLeaves->execute([$auth['tenant_id']]);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isPermitted = $isGlobalAdmin 
                || (int)$l['user_id'] === $userId 
                || (int)($l['approver_id'] ?? 0) === $userId 
                || (int)($l['approver_id_2'] ?? 0) === $userId 
                || in_array($userId, $relArr, true) 
                || in_array((int)$l['user_id'], $managedUserIds, true);

            if ($isPermitted) {
                $all[] = [
                    'id' => (int)$l['id'],
                    'type' => 'leave',
                    'employee_name' => $l['employee_name'],
                    'user_id' => (int)$l['user_id'],
                    'approver_id' => (int)($l['approver_id'] ?? 0),
                    'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                    'related_user_ids' => $relArr,
                    'title' => self::formatLeaveTitle($l['leave_type']),
                    'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                    'status' => $l['status'],
                    'created_at' => $l['created_at']
                ];
            }
        }

        // 2. All Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.id, a.amount, a.reason, a.status, a.created_at,
                   a.status_level_1, a.status_level_2, a.approver_id, a.approver_id_2, a.user_id, a.related_user_ids, u.full_name as employee_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            WHERE u.tenant_id = ?
            ORDER BY a.created_at DESC
        ");
        $stmtAdvances->execute([$auth['tenant_id']]);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isPermitted = $isGlobalAdmin 
                || (int)$a['user_id'] === $userId 
                || (int)($a['approver_id'] ?? 0) === $userId 
                || (int)($a['approver_id_2'] ?? 0) === $userId 
                || in_array($userId, $relArr, true) 
                || in_array((int)$a['user_id'], $managedUserIds, true);

            if ($isPermitted) {
                $all[] = [
                    'id' => (int)$a['id'],
                    'type' => 'advance',
                    'employee_name' => $a['employee_name'],
                    'user_id' => (int)$a['user_id'],
                    'approver_id' => (int)($a['approver_id'] ?? 0),
                    'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                    'related_user_ids' => $relArr,
                    'title' => 'Đề xuất tạm ứng lương',
                    'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                    'status' => $a['status'],
                    'created_at' => $a['created_at']
                ];
            }
        }

        // 3. All Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.id, e.title, e.amount, e.category, e.date, e.notes, e.status, e.created_at, e.approver_id, e.approver_id_2, e.approver_id_3, e.created_by as user_id, e.related_user_ids, u.full_name as employee_name
            FROM expenses e
            JOIN users u ON e.created_by = u.id
            WHERE e.tenant_id = ? AND e.deleted_at IS NULL
            ORDER BY e.created_at DESC
        ");
        $stmtExpenses->execute([$auth['tenant_id']]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isPermitted = $isGlobalAdmin 
                || (int)$e['user_id'] === $userId 
                || (int)($e['approver_id'] ?? 0) === $userId 
                || (int)($e['approver_id_2'] ?? 0) === $userId 
                || (int)($e['approver_id_3'] ?? 0) === $userId 
                || in_array($userId, $relArr, true) 
                || in_array((int)$e['user_id'], $managedUserIds, true);

            if ($isPermitted) {
                $isZeroAmt = (float)($e['amount'] ?? 0) == 0;
                $displayTitle = $e['title'];
                if (!$isZeroAmt && !str_starts_with(mb_strtolower($e['title']), 'đề xuất') && !str_starts_with(mb_strtolower($e['title']), 'đề nghị') && !str_starts_with(mb_strtolower($e['title']), 'yêu cầu')) {
                    $displayTitle = 'Yêu cầu chi phí: ' . $e['title'];
                }
                
                $displayDesc = $isZeroAmt 
                    ? ($e['notes'] ?: $e['description'] ?: '')
                    : ('Số tiền: ' . number_format($e['amount'], 0, ',', '.') . 'đ' . (!empty($e['notes']) ? '. Ghi chú: "' . $e['notes'] . '"' : ''));

                $all[] = [
                    'id' => (int)$e['id'],
                    'type' => 'expense',
                    'employee_name' => $e['employee_name'],
                    'user_id' => (int)$e['user_id'],
                    'approver_id' => (int)($e['approver_id'] ?? 0),
                    'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                    'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                    'related_user_ids' => $relArr,
                    'title' => $displayTitle,
                    'description' => $displayDesc,
                    'amount' => (float)$e['amount'],
                    'currency' => 'VND',
                    'category' => $e['category'] ?? 'Vận hành',
                    'date' => $e['date'] ?? null,
                    'notes' => $e['notes'] ?? '',
                    'status' => $e['status'],
                    'created_at' => $e['created_at']
                ];
            }
        }

        // Sort by created_at DESC
        usort($all, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        respond(200, $all);
    }

    public function savePayroll(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Không có quyền truy cập', false);
        
        $data = json_decode(file_get_contents('php://input'), true);
        $payslips = $data['payslips'] ?? [];
        
        if (!is_array($payslips)) respond(400, null, 'Dữ liệu không hợp lệ', false);
        
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                UPDATE monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                SET
                    mp.work_days_required = ?,
                    mp.work_days_actual = ?,
                    mp.lateness_minutes = ?,
                    mp.lateness_penalty = ?,
                    mp.lateness_compensatory_deducted = ?,
                    mp.lateness_annual_deducted = ?,
                    mp.salary_basic_calculated = ?,
                    mp.allowance_total = ?,
                    mp.kpi_bonus = ?,
                    mp.insurance_bhxh = ?,
                    mp.insurance_bhyt = ?,
                    mp.insurance_bhtn = ?,
                    mp.tax_pit = ?,
                    mp.advance_deduction = ?,
                    mp.net_salary = ?,
                    mp.overtime_days = ?,
                    mp.overtime_salary = ?,
                    mp.diligence_bonus = ?,
                    mp.note = ?
                WHERE mp.id = ? AND u.tenant_id = ?
            ");
            
            foreach ($payslips as $ps) {
                $stmt->execute([
                    (float)($ps['work_days_required'] ?? 26),
                    $ps['work_days_actual'],
                    $ps['lateness_minutes'],
                    $ps['lateness_penalty'],
                    $ps['lateness_compensatory_deducted'] ?? 0.00,
                    $ps['lateness_annual_deducted'] ?? 0.00,
                    $ps['salary_basic_calculated'],
                    $ps['allowance_total'],
                    $ps['kpi_bonus'],
                    $ps['insurance_bhxh'],
                    $ps['insurance_bhyt'] ?? 0.00,
                    $ps['insurance_bhtn'] ?? 0.00,
                    $ps['tax_pit'],
                    $ps['advance_deduction'],
                    $ps['net_salary'],
                    $ps['overtime_days'],
                    $ps['overtime_salary'],
                    $ps['diligence_bonus'],
                    $ps['note'] ?? null,
                    $ps['id'],
                    $auth['tenant_id']
                ]);
            }
            
            $this->db->commit();
            respond(200, ['success' => true]);
        } catch (Exception $e) {
            $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function deleteLeave(array $auth, int $id): void {
        $stmt = $this->db->prepare("SELECT * FROM hrm_leave_requests WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy yêu cầu nghỉ phép', false);
        }
        $isAdmin = $this->isAdmin($auth);
        if ((int)$row['user_id'] !== (int)$auth['user_id'] && !$isAdmin) {
            respond(403, null, 'Bạn không có quyền xóa yêu cầu này', false);
        }
        if ($row['status'] !== 'pending' && !$isAdmin) {
            respond(400, null, 'Chỉ có thể xóa yêu cầu ở trạng thái Chờ duyệt', false);
        }
        
        $this->db->prepare("DELETE FROM hrm_leave_requests WHERE id = ?")->execute([$id]);
        respond(200, null, 'Đã xóa yêu cầu nghỉ phép');
    }

    public function deleteAdvance(array $auth, int $id): void {
        $stmt = $this->db->prepare("SELECT * FROM hrm_salary_advances WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy yêu cầu tạm ứng', false);
        }
        $isAdmin = $this->isAdmin($auth);
        if ((int)$row['user_id'] !== (int)$auth['user_id'] && !$isAdmin) {
            respond(403, null, 'Bạn không có quyền xóa yêu cầu này', false);
        }
        if ($row['status'] !== 'pending' && !$isAdmin) {
            respond(400, null, 'Chỉ có thể xóa yêu cầu ở trạng thái Chờ duyệt', false);
        }
        
        $this->db->prepare("DELETE FROM hrm_salary_advances WHERE id = ?")->execute([$id]);
        respond(200, null, 'Đã xóa yêu cầu tạm ứng');
    }

    public function getLeaveComments(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'hrm_leave' AND c.entity_id = ? AND c.tenant_id = ?
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

    public function addLeaveComment(array $auth, int $id): void {
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'hrm_leave', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $id, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();
        $this->parseAndNotifyMentions($body, $id, 'leave', $auth);
        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    public function getAdvanceComments(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'hrm_advance' AND c.entity_id = ? AND c.tenant_id = ?
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

    public function addAdvanceComment(array $auth, int $id): void {
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'hrm_advance', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $id, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();
        $this->parseAndNotifyMentions($body, $id, 'leave', $auth);
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
}
