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

    public static function formatLeaveTitle(array|string $l): string {
        if (is_string($l)) {
            $type = $l;
            if ($type === 'remote_work') return 'Đăng ký làm việc từ xa (WFH)';
            if ($type === 'overtime') return 'Đăng ký tăng ca (OT)';
            if ($type === 'late_early') return 'Đăng ký đi trễ / về sớm';
            if ($type === 'business_trip') return 'Đăng ký đi công tác';
            return 'Đơn xin nghỉ phép (' . self::formatLeaveTypeText($type) . ')';
        }
        $type = $l['leave_type'] ?? '';
        $typeText = self::formatLeaveTypeText($type);
        $start = !empty($l['start_date']) ? date('d/m/Y', strtotime($l['start_date'])) : '';
        $end = !empty($l['end_date']) ? date('d/m/Y', strtotime($l['end_date'])) : '';
        $days = (float)($l['total_days'] ?? 0);
        $daysStr = $days > 0 ? " ({$days} ngày)" : '';
        $dateStr = '';
        if ($start && $end) {
            $dateStr = ($start === $end) ? ": {$start}" : ": {$start} - {$end}";
        } elseif ($start) {
            $dateStr = ": {$start}";
        }
        $reason = trim($l['reason'] ?? '');
        $reasonStr = $reason ? " - {$reason}" : '';

        if ($type === 'remote_work') return "Đăng ký WFH{$dateStr}{$daysStr}{$reasonStr}";
        if ($type === 'overtime') return "Đăng ký OT{$dateStr}{$daysStr}{$reasonStr}";
        if ($type === 'late_early') return "Đăng ký đi muộn/về sớm{$dateStr}{$reasonStr}";
        if ($type === 'business_trip') return "Đăng ký công tác{$dateStr}{$daysStr}{$reasonStr}";
        return "[Nghỉ phép] {$typeText}{$dateStr}{$daysStr}{$reasonStr}";
    }

    public static function formatBulkTitleAndDesc(array $b): array {
        $daysCount = (int)($b['days_count'] ?? 0);
        if ($daysCount === 1 && !empty($b['single_date'])) {
            $dFmt = date('d/m/Y', strtotime($b['single_date']));
            $title = 'Phiếu giải trình cập nhật công ngày ' . $dFmt;
            $r = trim($b['first_reason'] ?? '');
            $desc = ($r && $r !== 'Bổ sung công') ? $r : ('Giải trình cập nhật công ngày ' . $dFmt);
        } else {
            $cntStr = $daysCount > 1 ? " ($daysCount ngày)" : '';
            $title = 'Phiếu cập nhật công tháng ' . ($b['month_period'] ?? date('Y-m')) . $cntStr;
            $desc = 'Giải trình cập nhật công chu kỳ tháng ' . ($b['month_period'] ?? date('Y-m')) . $cntStr;
        }
        return [$title, $desc];
    }

    // --- PROFILES & CONTRACTS ---

    public function indexProfiles(array $auth): void {
        if (!$this->isAdmin($auth)) {
            // Allow individual employee to fetch their own profile
            try {
                $stmt = $this->db->prepare("
                    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account, u.team_id,
                           u.avatar_url, u.avatar_url as avatar, u.job_title,
                           COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(t.name), ''), 
                               CASE 
                                   WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                                   WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                                   WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                                   WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                                   WHEN u.role IN ('sales', 'sale', 'sale_admin', 'saleadmin') THEN 'Phòng Kinh doanh'
                                   ELSE 'Khác'
                               END
                           ) as department,
                           COALESCE(NULLIF(TRIM(t.name), ''), NULLIF(TRIM(u.department), '')) as team_name,
                           p.joined_date, p.base_salary, p.deal_salary, p.has_insurance, p.allowance_meal, p.allowance_meal_type, p.allowance_travel, p.allowance_phone, p.kpi_target, p.kpi_multiplier_rules, p.custom_fields_json,
                           p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used,
                           p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn
                    FROM users u
                    LEFT JOIN hrm_profiles p ON u.id = p.user_id
                    LEFT JOIN teams t ON u.team_id = t.id
                    WHERE u.tenant_id = ? AND u.id = ?
                    LIMIT 1
                ");
                $stmt->execute([$auth['tenant_id'], $auth['user_id']]);
                respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            } catch (\Throwable $e) {
                $stmt = $this->db->prepare("
                    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account, u.team_id,
                           u.avatar_url, u.avatar_url as avatar, u.job_title,
                           COALESCE(NULLIF(TRIM(t.name), ''), 
                               CASE 
                                   WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                                   WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                                   WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                                   WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                                   WHEN u.role IN ('sales', 'sale', 'sale_admin', 'saleadmin') THEN 'Phòng Kinh doanh'
                                   ELSE 'Khác'
                               END
                           ) as department,
                           COALESCE(NULLIF(TRIM(t.name), ''), 'Khác') as team_name,
                           p.joined_date, p.base_salary, p.deal_salary, p.has_insurance, p.allowance_meal, p.allowance_meal_type, p.allowance_travel, p.allowance_phone, p.kpi_target, p.kpi_multiplier_rules, p.custom_fields_json,
                           p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used,
                           p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn
                    FROM users u
                    LEFT JOIN hrm_profiles p ON u.id = p.user_id
                    LEFT JOIN teams t ON u.team_id = t.id
                    WHERE u.tenant_id = ? AND u.id = ?
                    LIMIT 1
                ");
                $stmt->execute([$auth['tenant_id'], $auth['user_id']]);
                respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
            }
            return;
        }

        try {
            $stmt = $this->db->prepare("
                SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account, u.team_id,
                       u.avatar_url, u.avatar_url as avatar, u.job_title,
                       COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(t.name), ''), 
                           CASE 
                               WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                               WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                               WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                               WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                               WHEN u.role IN ('sales', 'sale', 'sale_admin', 'saleadmin') THEN 'Phòng Kinh doanh'
                               ELSE 'Khác'
                           END
                       ) as department,
                       COALESCE(NULLIF(TRIM(t.name), ''), NULLIF(TRIM(u.department), '')) as team_name,
                       p.joined_date, p.base_salary, p.deal_salary, p.has_insurance, p.allowance_meal, p.allowance_meal_type, p.allowance_travel, p.allowance_phone, p.kpi_target, p.kpi_multiplier_rules, p.custom_fields_json,
                       p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used,
                       p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn
                FROM users u
                LEFT JOIN hrm_profiles p ON u.id = p.user_id
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.tenant_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
                ORDER BY u.full_name
            ");
            $stmt->execute([$auth['tenant_id']]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (\Throwable $e) {
            $stmt = $this->db->prepare("
                SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account, u.team_id,
                       u.avatar_url, u.avatar_url as avatar, u.job_title,
                       COALESCE(NULLIF(TRIM(t.name), ''), 
                           CASE 
                               WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                               WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                               WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                               WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                               WHEN u.role IN ('sales', 'sale', 'sale_admin', 'saleadmin') THEN 'Phòng Kinh doanh'
                               ELSE 'Khác'
                           END
                       ) as department,
                       COALESCE(NULLIF(TRIM(t.name), ''), 'Khác') as team_name,
                       p.joined_date, p.base_salary, p.deal_salary, p.has_insurance, p.allowance_meal, p.allowance_meal_type, p.allowance_travel, p.allowance_phone, p.kpi_target, p.kpi_multiplier_rules, p.custom_fields_json,
                       p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used,
                       p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn
                FROM users u
                LEFT JOIN hrm_profiles p ON u.id = p.user_id
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.tenant_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
                ORDER BY u.full_name
            ");
            $stmt->execute([$auth['tenant_id']]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
        }
    }

    public function saveProfile(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        if (empty($b['user_id']) || empty($b['joined_date'])) {
            respond(400, null, 'Thiếu thông tin user_id hoặc ngày vào làm', false);
        }

        $stmt = $this->db->prepare("
            INSERT INTO hrm_profiles (user_id, joined_date, base_salary, deal_salary, has_insurance, allowance_meal, allowance_meal_type, allowance_travel, allowance_phone, kpi_target, kpi_multiplier_rules, custom_fields_json,
                                      annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used,
                                      insurance_rate_bhxh, insurance_rate_bhyt, insurance_rate_bhtn)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                joined_date = VALUES(joined_date),
                base_salary = VALUES(base_salary),
                deal_salary = VALUES(deal_salary),
                has_insurance = VALUES(has_insurance),
                allowance_meal = VALUES(allowance_meal),
                allowance_meal_type = VALUES(allowance_meal_type),
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
            $b['allowance_meal_type'] ?? 'per_day',
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
        $row['remaining_annual_leave'] = max(0.0, $row['annual_leave_total'] - $row['annual_leave_used']);
        $row['remaining_compensatory_leave'] = max(0.0, $row['compensatory_leave_total'] - $row['compensatory_leave_used']);
        
        respond(200, $row);
    }

    public function getUserBalance(array $auth): void {
        $targetUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : (int)$auth['user_id'];
        $stmt = $this->db->prepare("
            SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used 
            FROM hrm_profiles 
            WHERE user_id = ?
            LIMIT 1
        ");
        $stmt->execute([$targetUserId]);
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
        $row['remaining_annual_leave'] = max(0.0, $row['annual_leave_total'] - $row['annual_leave_used']);
        $row['remaining_compensatory_leave'] = max(0.0, $row['compensatory_leave_total'] - $row['compensatory_leave_used']);
        
        respond(200, $row);
    }

    // --- LEAVE REQUESTS ---

    public function indexLeaves(array $auth): void {
        $userId = (int)$auth['user_id'];
        $leaveId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        $where = "u.tenant_id = ?";
        $params = [$auth['tenant_id']];

        if ($leaveId > 0) {
            $where .= " AND l.id = ?";
            $params[] = $leaveId;
        } elseif (!$this->isAdmin($auth)) {
            $where .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? OR l.related_user_ids LIKE ? OR l.related_user_ids LIKE ?)";
            $params[] = $userId;
            $params[] = $userId;
            $params[] = $userId;
            $params[] = '%"' . $userId . '"%';
            $params[] = '%' . $userId . '%';
        }

        $stmt = $this->db->prepare("
            SELECT l.*, u.full_name as employee_name, u.email as employee_email,
                   u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title,
                   COALESCE(p.annual_leave_total, 12.0) as annual_leave_total,
                   COALESCE(p.annual_leave_used, 0.0) as annual_leave_used,
                   COALESCE(p.compensatory_leave_total, 0.0) as compensatory_leave_total,
                   COALESCE(p.compensatory_leave_used, 0.0) as compensatory_leave_used
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN hrm_profiles p ON l.user_id = p.user_id
            WHERE $where
            ORDER BY l.created_at DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['annual_leave_total'] = (float)$r['annual_leave_total'];
            $r['annual_leave_used'] = (float)$r['annual_leave_used'];
            $r['compensatory_leave_total'] = (float)$r['compensatory_leave_total'];
            $r['compensatory_leave_used'] = (float)$r['compensatory_leave_used'];
            $r['remaining_annual_leave'] = max(0.0, $r['annual_leave_total'] - $r['annual_leave_used']);
            $r['remaining_compensatory_leave'] = max(0.0, $r['compensatory_leave_total'] - $r['compensatory_leave_used']);
        }
        unset($r);

        if ($leaveId > 0 && !empty($rows)) {
            respond(200, $rows[0]);
            return;
        }

        respond(200, $rows);
    }

    public function showLeave(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT l.*, u.full_name as employee_name, u.email as employee_email,
                   COALESCE(p.annual_leave_total, 12.0) as annual_leave_total,
                   COALESCE(p.annual_leave_used, 0.0) as annual_leave_used,
                   COALESCE(p.compensatory_leave_total, 0.0) as compensatory_leave_total,
                   COALESCE(p.compensatory_leave_used, 0.0) as compensatory_leave_used
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN hrm_profiles p ON l.user_id = p.user_id
            WHERE l.id = ? AND u.tenant_id = ?
            LIMIT 1
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy đơn xin nghỉ phép', false);
            return;
        }

        $userId = (int)$auth['user_id'];
        $relArr = !empty($row['related_user_ids']) ? (is_array($row['related_user_ids']) ? $row['related_user_ids'] : json_decode($row['related_user_ids'], true)) : [];
        if (!is_array($relArr)) $relArr = [];
        $relArr = array_map('intval', $relArr);

        $hasPermission = $this->isAdmin($auth) ||
            (int)$row['user_id'] === $userId ||
            (int)$row['approver_id'] === $userId ||
            (int)($row['approver_id_2'] ?? 0) === $userId ||
            in_array($userId, $relArr, true);

        if (!$hasPermission) {
            respond(403, null, 'Bạn không có quyền xem đơn này', false);
            return;
        }

        $row['annual_leave_total'] = (float)$row['annual_leave_total'];
        $row['annual_leave_used'] = (float)$row['annual_leave_used'];
        $row['compensatory_leave_total'] = (float)$row['compensatory_leave_total'];
        $row['compensatory_leave_used'] = (float)$row['compensatory_leave_used'];
        $row['remaining_annual_leave'] = max(0.0, $row['annual_leave_total'] - $row['annual_leave_used']);
        $row['remaining_compensatory_leave'] = max(0.0, $row['compensatory_leave_total'] - $row['compensatory_leave_used']);

        respond(200, $row);
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

        $startTs = strtotime($startDate);
        $endTs = strtotime($endDate);
        if ($startTs !== false && $endTs !== false && $endTs < $startTs) {
            respond(400, null, 'Thời gian kết thúc không thể nhỏ hơn thời gian bắt đầu.', false);
            return;
        }

        $approverId = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
        if (empty($approverId)) {
            $stmtUser = $this->db->prepare("SELECT email, department, team_id FROM users WHERE id = ?");
            $stmtUser->execute([$auth['user_id']]);
            $uInfo = $stmtUser->fetch(PDO::FETCH_ASSOC);
            $uEmail = strtolower($uInfo['email'] ?? '');
            $uDept = mb_strtolower($uInfo['department'] ?? '', 'UTF-8');

            if ($uEmail === 'nganph@ideas.edu.vn' || str_contains($uDept, 'học vụ') || str_contains($uDept, 'học thuật')) {
                $stmtLead = $this->db->prepare("SELECT id FROM users WHERE email = 'tramlth@ideas.edu.vn' OR username = 'tramlth' OR full_name LIKE '%Huyền Trâm%' LIMIT 1");
                $stmtLead->execute();
                $foundLead = $stmtLead->fetchColumn();
                if (!empty($foundLead) && (int)$foundLead !== (int)$auth['user_id']) {
                    $approverId = (int)$foundLead;
                }
            } elseif ($uEmail === 'cuongnph@ideas.edu.vn' || str_contains($uDept, 'nhân sự') || str_contains($uDept, 'hành chính')) {
                $stmtLead = $this->db->prepare("SELECT id FROM users WHERE email LIKE 'phuongntd%' OR username = 'phuongntd' OR full_name LIKE '%Duy Phương%' LIMIT 1");
                $stmtLead->execute();
                $foundLead = $stmtLead->fetchColumn();
                if (!empty($foundLead) && (int)$foundLead !== (int)$auth['user_id']) {
                    $approverId = (int)$foundLead;
                }
            }

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

        $leaveType = $b['leave_type'];
        $otType = null;
        $otRate = null;
        $reason = $b['reason'] ?? '';
        if ($leaveType === 'overtime') {
            $otType = (!empty($b['ot_type']) && in_array($b['ot_type'], ['compensatory', 'salary'], true)) ? $b['ot_type'] : 'salary';
            $otRate = !empty($b['ot_rate']) ? (float)$b['ot_rate'] : 1.5;
            if ($otRate <= 0) $otRate = 1.5;

            $rateText = ($otRate == 1.0) ? 'Loại 1.0x (1:1)' : "Loại {$otRate}x";
            $tag = ($otType === 'compensatory') 
                ? "[Hình thức: Lấy OT bù (Nghỉ bù) | Hệ số {$rateText}]" 
                : "[Hình thức: Tính vào lương OT | Hệ số {$rateText}]";
            if (strpos($reason, '[Hình thức:') === false) {
                $reason = trim($tag . ' ' . $reason);
            }
        }

        $isSelfApproved = ($approverId > 0 && $approverId === (int)$auth['user_id'] && (empty($approverId2) || $approverId2 === (int)$auth['user_id']));
        $initialStatus = $isSelfApproved ? 'approved' : 'pending';
        $statusL1 = $isSelfApproved ? 'approved' : 'pending';
        $statusL2 = $isSelfApproved ? (!empty($approverId2) ? 'approved' : 'none') : ($approverId2 ? 'pending' : 'none');
        $approvedBy = $isSelfApproved ? $auth['user_id'] : null;
        $approvedAt = $isSelfApproved ? date('Y-m-d H:i:s') : null;

        $stmt = $this->db->prepare("
            INSERT INTO hrm_leave_requests (user_id, leave_type, ot_type, ot_rate, start_date, end_date, total_days, reason, status, approver_id, approver_id_2, status_level_1, status_level_2, approved_by, approved_at, related_user_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['user_id'],
            $leaveType,
            $otType,
            $otRate,
            $startDate,
            $endDate,
            (float)($b['total_days'] ?? 1.0),
            $reason,
            $initialStatus,
            $approverId,
            $approverId2,
            $statusL1,
            $statusL2,
            $approvedBy,
            $approvedAt,
            $relatedUserIds
        ]);

        if ($isSelfApproved && in_array($leaveType, ['annual', 'compensatory', 'sick', 'special_paid', 'maternity', 'paternity', 'marriage', 'funeral', 'remote_work'], true)) {
            $startDateOnly = date('Y-m-d', strtotime($startDate));
            $endDateOnly = date('Y-m-d', strtotime($endDate));
            try {
                $cLeaveStmt = $this->db->prepare("INSERT IGNORE INTO consultant_leaves (consultant_id, start_date, end_date) VALUES (?, ?, ?)");
                $cLeaveStmt->execute([$auth['user_id'], $startDateOnly, $endDateOnly]);
            } catch (\Throwable $e) {}
        }

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

        $isApprover1 = ((int)$auth['user_id'] === (int)$leaveRow['approver_id']);
        $isApprover2 = ((int)$auth['user_id'] === (int)$leaveRow['approver_id_2']);
        $isSuperAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isPrivileged = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr', 'leader', 'team_lead', 'teamlead', 'marketing_lead'], true);

        $isCreator = ((int)$auth['user_id'] === (int)$leaveRow['user_id']);
        if ($isCreator && !$isApprover1 && !$isApprover2 && !$isPrivileged) {
            respond(403, null, 'Người tạo đơn không được tự phê duyệt đề xuất của chính mình', false);
        }

        if (!$isApprover1 && !$isApprover2 && !$isPrivileged) {
            respond(403, null, 'Bạn không có quyền phê duyệt yêu cầu này', false);
        }

        if ($isApprover2 && !$isApprover1 && !$isSuperAdmin) {
            if ($leaveRow['status_level_1'] === 'pending') {
                respond(403, null, 'Cần có phê duyệt Cấp 1 trước khi Cấp 2 phê duyệt', false);
            }
        }

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
            
            // Khi đơn OT lấy nghỉ bù được duyệt hoàn tất -> tự động cộng vào quỹ nghỉ bù của nhân sự theo hệ số
            if ($type === 'overtime') {
                if (($leaveRow['ot_type'] ?? '') === 'compensatory' && ($leaveRow['status'] ?? '') !== 'approved') {
                    $otRate = (float)($leaveRow['ot_rate'] ?? 1.0);
                    if ($otRate <= 0) $otRate = 1.0;
                    $compDays = round((float)$leaveRow['total_days'] * $otRate, 2);
                    if ($compDays > 0) {
                        $updCompStmt = $this->db->prepare("
                            INSERT INTO hrm_profiles (user_id, joined_date, compensatory_leave_total)
                            VALUES (?, CURDATE(), ?)
                            ON DUPLICATE KEY UPDATE compensatory_leave_total = compensatory_leave_total + VALUES(compensatory_leave_total)
                        ");
                        $updCompStmt->execute([$userId, $compDays]);

                        $compLog = " [Đã tự động cộng +{$compDays} ngày vào quỹ nghỉ bù (Hệ số {$otRate}x)]";
                        $updReason = $this->db->prepare("UPDATE hrm_leave_requests SET reason = CONCAT(COALESCE(reason, ''), ?) WHERE id = ?");
                        $updReason->execute([$compLog, (int)$leaveRow['id']]);
                    }
                }
            }

            if ($type === 'annual' || $type === 'compensatory') {
                $profStmt = $this->db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                $profStmt->execute([$userId]);
                $profile = $profStmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$profile) {
                    try {
                        $this->db->prepare("
                            INSERT INTO hrm_profiles (user_id, joined_date, annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used)
                            VALUES (?, CURDATE(), 12.0, 0.0, 0.0, 0.0)
                            ON DUPLICATE KEY UPDATE annual_leave_total = COALESCE(annual_leave_total, 12.0)
                        ")->execute([$userId]);
                    } catch (\Throwable $eProf) {}
                    $profile = [
                        'annual_leave_total' => 12.0,
                        'annual_leave_used' => 0.0,
                        'compensatory_leave_total' => 0.0,
                        'compensatory_leave_used' => 0.0
                    ];
                }

                $remComp = max(0.0, (float)$profile['compensatory_leave_total'] - (float)$profile['compensatory_leave_used']);
                $remAnnual = max(0.0, (float)$profile['annual_leave_total'] - (float)$profile['annual_leave_used']);
                
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
                    
                    if (!$profile) {
                        try {
                            $this->db->prepare("
                                INSERT INTO hrm_profiles (user_id, joined_date, annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used)
                                VALUES (?, CURDATE(), 12.0, 0.0, 0.0, 0.0)
                                ON DUPLICATE KEY UPDATE annual_leave_total = COALESCE(annual_leave_total, 12.0)
                            ")->execute([$userId]);
                        } catch (\Throwable $eProf) {}
                        $profile = [
                            'annual_leave_total' => 12.0,
                            'annual_leave_used' => 0.0,
                            'compensatory_leave_total' => 0.0,
                            'compensatory_leave_used' => 0.0
                        ];
                    }

                    $remComp = max(0.0, (float)$profile['compensatory_leave_total'] - (float)$profile['compensatory_leave_used']);
                    $remAnnual = max(0.0, (float)$profile['annual_leave_total'] - (float)$profile['annual_leave_used']);
                    
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
                // Also notify submitter that Level 1 was approved
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_APPROVAL', [
                    'user_id' => $leaveRow['user_id'],
                    'user_name' => $leaveRow['full_name'],
                    'approver_name' => $auth['full_name'] ?? 'Người duyệt',
                    'leave_type_text' => $leaveTypeText,
                    'start_date' => $leaveRow['start_date'],
                    'end_date' => $leaveRow['end_date'],
                    'status_text' => 'Phê duyệt Cấp 1 (Chờ Cấp 2 duyệt)',
                    'reason' => $approverNote,
                    'remaining_annual_leave' => $remainingAnnual,
                    'remaining_compensatory_leave' => $remainingComp,
                    'ref_id' => $id,
                    'status' => 'pending'
                ]);

                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_REQUEST', [
                    'approver_id' => (int)$leaveRow['approver_id_2'],
                    'target_user_id' => (int)$leaveRow['approver_id_2'],
                    'user_id' => (int)$leaveRow['approver_id_2'],
                    'user_name' => $leaveRow['full_name'],
                    'submitter_id' => (int)$leaveRow['user_id'],
                    'leave_type_text' => $leaveTypeText,
                    'start_date' => $leaveRow['start_date'],
                    'end_date' => $leaveRow['end_date'],
                    'total_days' => (float)$leaveRow['total_days'],
                    'reason' => 'Đã duyệt Cấp 1 (Chờ Giám đốc duyệt). Lý do ban đầu: ' . $leaveRow['reason'],
                    'date' => date('Y-m-d'),
                    'ref_id' => $id
                ]);
            } else {
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_APPROVAL', [
                    'user_id' => $leaveRow['user_id'],
                    'user_name' => $leaveRow['full_name'],
                    'approver_name' => $auth['full_name'] ?? 'Người duyệt',
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
                                    'approver_name' => $auth['full_name'] ?? 'Người duyệt',
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
        $userId = (int)$auth['user_id'];
        if ($this->isAdmin($auth)) {
            $stmt = $this->db->prepare("
                SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title
                FROM hrm_salary_advances a
                JOIN users u ON a.user_id = u.id
                WHERE u.tenant_id = ?
                ORDER BY a.created_at DESC
            ");
            $stmt->execute([$auth['tenant_id']]);
        } else {
            $stmt = $this->db->prepare("
                SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title
                FROM hrm_salary_advances a
                JOIN users u ON a.user_id = u.id
                WHERE a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ? OR a.related_user_ids LIKE ? OR a.related_user_ids LIKE ?
                ORDER BY a.created_at DESC
            ");
            $stmt->execute([$userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%']);
        }
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function showAdvance(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT a.*, u.full_name as employee_name, u.email as employee_email
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND u.tenant_id = ?
            LIMIT 1
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy đề nghị tạm ứng', false);
            return;
        }

        $userId = (int)$auth['user_id'];
        $relArr = !empty($row['related_user_ids']) ? (is_array($row['related_user_ids']) ? $row['related_user_ids'] : json_decode($row['related_user_ids'], true)) : [];
        if (!is_array($relArr)) $relArr = [];
        $relArr = array_map('intval', $relArr);

        $hasPermission = $this->isAdmin($auth) ||
            (int)$row['user_id'] === $userId ||
            (int)$row['approver_id'] === $userId ||
            (int)($row['approver_id_2'] ?? 0) === $userId ||
            in_array($userId, $relArr, true);

        if (!$hasPermission) {
            respond(403, null, 'Bạn không có quyền xem đề xuất này', false);
            return;
        }

        respond(200, $row);
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

        $isSelfApproved = ($approverId > 0 && $approverId === (int)$auth['user_id'] && (empty($approverId2) || $approverId2 === (int)$auth['user_id']));
        $initialStatus = $isSelfApproved ? 'approved' : 'pending';
        $statusL1 = $isSelfApproved ? 'approved' : 'pending';
        $statusL2 = $isSelfApproved ? (!empty($approverId2) ? 'approved' : 'none') : ($approverId2 ? 'pending' : 'none');
        $approvedBy = $isSelfApproved ? $auth['user_id'] : null;
        $approvedAt = $isSelfApproved ? date('Y-m-d H:i:s') : null;

        $stmt = $this->db->prepare("
            INSERT INTO hrm_salary_advances (user_id, amount, request_date, reason, status, approver_id, approver_id_2, status_level_1, status_level_2, approved_by, approved_at, related_user_ids)
            VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['user_id'],
            (float)$b['amount'],
            $b['reason'] ?? '',
            $initialStatus,
            $approverId,
            $approverId2,
            $statusL1,
            $statusL2,
            $approvedBy,
            $approvedAt,
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

        $isApprover1 = ((int)$auth['user_id'] === (int)$advRow['approver_id']);
        $isApprover2 = ((int)$auth['user_id'] === (int)$advRow['approver_id_2']);
        $isSuperAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isPrivileged = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr', 'leader', 'team_lead', 'teamlead', 'marketing_lead'], true);

        $isCreator = ((int)$auth['user_id'] === (int)$advRow['user_id']);
        if ($isCreator && !$isApprover1 && !$isApprover2 && !$isPrivileged) {
            respond(403, null, 'Người tạo đề xuất không được tự phê duyệt đề xuất của chính mình', false);
        }

        if (!$isApprover1 && !$isApprover2 && !$isPrivileged) {
            respond(403, null, 'Bạn không có quyền phê duyệt yêu cầu này', false);
        }

        if ($isApprover2 && !$isApprover1 && !$isSuperAdmin) {
            if ($advRow['status_level_1'] === 'pending') {
                respond(403, null, 'Cần có phê duyệt Cấp 1 trước khi Cấp 2 phê duyệt', false);
            }
        }

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
                // Also notify submitter that Level 1 was approved
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_APPROVAL', [
                    'user_id' => $advRow['user_id'],
                    'user_name' => $advRow['full_name'],
                    'approver_name' => $auth['full_name'] ?? 'Người duyệt',
                    'amount' => (float)$advRow['amount'],
                    'status_text' => 'Phê duyệt Cấp 1 (Chờ Cấp 2 duyệt)',
                    'reason' => $approverNote,
                    'ref_id' => $id,
                    'status' => 'pending'
                ]);

                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_REQUEST', [
                    'approver_id' => (int)$advRow['approver_id_2'],
                    'target_user_id' => (int)$advRow['approver_id_2'],
                    'user_id' => (int)$advRow['approver_id_2'],
                    'user_name' => $advRow['full_name'],
                    'submitter_id' => (int)$advRow['user_id'],
                    'amount' => (float)$advRow['amount'],
                    'reason' => 'Đã duyệt Cấp 1 (Chờ Giám đốc duyệt). Lý do ban đầu: ' . $advRow['reason'],
                    'date' => date('Y-m-d'),
                    'ref_id' => $id
                ]);
            } else {
                NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_APPROVAL', [
                    'user_id' => $advRow['user_id'],
                    'user_name' => $advRow['full_name'],
                    'approver_name' => $auth['full_name'] ?? 'Người duyệt',
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
                                    'approver_name' => $auth['full_name'] ?? 'Người duyệt',
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
                   p.allowance_meal, p.allowance_meal_type, p.allowance_travel, p.allowance_phone, p.kpi_target, p.joined_date, p.custom_fields_json,
                   p.insurance_rate_bhxh, p.insurance_rate_bhyt, p.insurance_rate_bhtn,
                   p.annual_leave_total, p.annual_leave_used, p.compensatory_leave_total, p.compensatory_leave_used
            FROM users u
            LEFT JOIN hrm_profiles p ON u.id = p.user_id
            WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
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
                $mealType = $emp['allowance_meal_type'] ?? 'per_day';
                $mealRate = (float)($emp['allowance_meal'] ?? 0.0);
                $calculatedMeal = ($mealType === 'fixed') ? $mealRate : ($mealRate * (float)$totalWorkDays);

                $allowanceTotal = $calculatedMeal + (float)($emp['allowance_travel'] ?? 0.0) + (float)($emp['allowance_phone'] ?? 0.0);
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
                $mealType = $emp['allowance_meal_type'] ?? 'per_day';
                $mealRate = (float)($emp['allowance_meal'] ?? 0.0);
                $calculatedMeal = ($mealType === 'fixed') ? $mealRate : ($mealRate * (float)$totalWorkDays);
                $taxableMeal = max(0, $calculatedMeal - 730000);
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
                    SELECT SUM(total_days) as ot_days,
                           SUM(total_days * COALESCE(ot_rate, 1.5)) as weighted_ot_days
                    FROM hrm_leave_requests
                    WHERE user_id = ? AND status = 'approved' AND leave_type = 'overtime'
                      AND (ot_type = 'salary' OR ot_type IS NULL OR ot_type = '')
                      AND DATE_FORMAT(start_date, '%Y-%m') = ?
                ");
                $otStmt->execute([$userId, $monthYear]);
                $otRow = $otStmt->fetch(PDO::FETCH_ASSOC);
                $overtimeDays = (float)($otRow['ot_days'] ?? 0);
                $weightedOtDays = (float)($otRow['weighted_ot_days'] ?? 0);

                // Overtime salary: (deal_salary / work_days_required) * weighted_ot_days (nhân theo hệ số ot_rate 1.0 hoặc 1.5)
                $overtimeSalary = ($workDaysRequired > 0) ? (($baseSalary / $workDaysRequired) * $weightedOtDays) : 0;
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
                    WHERE u.tenant_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
                    ORDER BY p.month_year DESC
                ");
                $stmt->execute([$auth['tenant_id']]);
            } else {
                $stmt = $this->db->prepare("
                    SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title
                    FROM monthly_payslips p
                    JOIN users u ON p.user_id = u.id
                    WHERE p.user_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
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
                WHERE u.tenant_id = ? AND p.month_year = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
            ");
            $stmt->execute([$auth['tenant_id'], $monthYear]);
        } else {
            $stmt = $this->db->prepare("
                SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title
                FROM monthly_payslips p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ? AND p.month_year = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
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


    public function countPendingApprovals(array $auth): int {
        return count($this->fetchPendingApprovals($auth));
    }

    public function getApprovalsOverview(array $auth): void {
        respond(200, [
            'pending' => $this->fetchPendingApprovals($auth),
            'my_requests' => $this->fetchMyRequests($auth),
            'following' => $this->fetchFollowingRequests($auth),
            'all' => $this->fetchAllApprovals($auth)
        ]);
    }

    public function getPendingApprovals(array $auth): void {
        respond(200, $this->fetchPendingApprovals($auth));
    }

    public function getMyRequests(array $auth): void {
        respond(200, $this->fetchMyRequests($auth));
    }

    public function getFollowingRequests(array $auth): void {
        respond(200, $this->fetchFollowingRequests($auth));
    }

    public function getAllApprovals(array $auth): void {
        respond(200, $this->fetchAllApprovals($auth));
    }

    private function fetchPendingApprovals(array $auth): array {
        $pending = [];
        $userId = (int)$auth['user_id'];
        $userFullName = trim(mb_strtolower($auth['full_name'] ?? $auth['name'] ?? ''));
        $role = strtolower($auth['role'] ?? '');
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isHrAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr'], true);

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

        // 1. Pending Leaves (Chỉ hiển thị đơn người khác gửi đến cần user duyệt, loại trừ đơn của chính mình)
        $stmtLeaves = $this->db->prepare("
            SELECT l.id, l.user_id, u.full_name as employee_name, l.leave_type, 
                   l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                   l.approver_id, l.approver_id_2, l.status_level_1, l.status_level_2,
                   l.approved_by, l.approved_at, l.related_user_ids,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN users u_app1 ON l.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON l.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON l.approved_by = u_real.id
            WHERE u.tenant_id = ? AND l.status = 'pending' AND l.user_id != ?
            ORDER BY l.created_at DESC
            LIMIT 200
        ");
        $stmtLeaves->execute([$auth['tenant_id'], $userId]);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $shouldShow = false;
            $isApp1 = (!empty($l['approver_id']) && (int)$l['approver_id'] === $userId) || (!empty($l['approver_name']) && trim(mb_strtolower($l['approver_name'])) === $userFullName);
            $isApp2 = (!empty($l['approver_id_2']) && (int)$l['approver_id_2'] === $userId) || (!empty($l['approver_name_2']) && trim(mb_strtolower($l['approver_name_2'])) === $userFullName);

            if ($l['status_level_1'] === 'pending') {
                if (!empty($l['approver_id']) || !empty($l['approver_name'])) {
                    if ($isApp1 || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                } else {
                    if (in_array((int)$l['user_id'], $managedUserIds, true) || $isHrAdmin) {
                        $shouldShow = true;
                    }
                }
            } else if ($l['status_level_1'] === 'approved' && $l['status_level_2'] === 'pending') {
                if (!empty($l['approver_id_2']) || !empty($l['approver_name_2'])) {
                    if ($isApp2 || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                } else if ($isGlobalAdmin) {
                    $shouldShow = true;
                }
            }

            if ($shouldShow) {
                $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
                if (!is_array($relArr)) {
                    $relArr = explode(',', (string)$l['related_user_ids']);
                }
                $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

                $levelText = ($l['status_level_1'] === 'approved') ? 'Cấp 2 (Giám đốc)' : 'Cấp 1 (Quản lý)';
                $pending[] = [
                    'id' => (int)$l['id'],
                    'type' => 'leave',
                    'employee_name' => $l['employee_name'],
                    'user_id' => (int)$l['user_id'],
                    'approver_id' => (int)($l['approver_id'] ?? 0),
                    'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                    'approver_name' => $l['approver_name'] ?? null,
                    'approver_name_2' => $l['approver_name_2'] ?? null,
                    'approved_by' => (int)($l['approved_by'] ?? 0),
                    'approved_by_name' => $l['approved_by_name'] ?? null,
                    'approved_at' => $l['approved_at'] ?? null,
                    'status_level_1' => $l['status_level_1'] ?? 'pending',
                    'status_level_2' => $l['status_level_2'] ?? 'none',
                    'related_user_ids' => $relArr,
                    'start_date' => $l['start_date'],
                    'end_date' => $l['end_date'],
                    'total_days' => (float)$l['total_days'],
                    'leave_type' => $l['leave_type'],
                    'reason' => $l['reason'],
                    'title' => self::formatLeaveTitle($l) . ' - ' . $levelText,
                    'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                    'status' => $l['status'] ?? 'pending',
                    'created_at' => $l['created_at']
                ];
            }
        }

        // 2. Pending Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.id, a.user_id, u.full_name as employee_name, a.amount, a.reason, a.status, a.created_at,
                   a.approver_id, a.approver_id_2, a.status_level_1, a.status_level_2,
                   a.approved_by, a.approved_at, a.related_user_ids,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users u_app1 ON a.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON a.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON a.approved_by = u_real.id
            WHERE u.tenant_id = ? AND a.status = 'pending' AND a.user_id != ?
            ORDER BY a.created_at DESC
            LIMIT 200
        ");
        $stmtAdvances->execute([$auth['tenant_id'], $userId]);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $shouldShow = false;
            $isApp1 = (!empty($a['approver_id']) && (int)$a['approver_id'] === $userId) || (!empty($a['approver_name']) && trim(mb_strtolower($a['approver_name'])) === $userFullName);
            $isApp2 = (!empty($a['approver_id_2']) && (int)$a['approver_id_2'] === $userId) || (!empty($a['approver_name_2']) && trim(mb_strtolower($a['approver_name_2'])) === $userFullName);

            if ($a['status_level_1'] === 'pending') {
                if (!empty($a['approver_id']) || !empty($a['approver_name'])) {
                    if ($isApp1 || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                } else {
                    if (in_array((int)$a['user_id'], $managedUserIds, true) || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                }
            } else if ($a['status_level_1'] === 'approved' && $a['status_level_2'] === 'pending') {
                if (!empty($a['approver_id_2']) || !empty($a['approver_name_2'])) {
                    if ($isApp2 || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                } else if ($isGlobalAdmin) {
                    $shouldShow = true;
                }
            }

            if ($shouldShow) {
                $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
                if (!is_array($relArr)) {
                    $relArr = explode(',', (string)$a['related_user_ids']);
                }
                $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

                $levelText = ($a['status_level_1'] === 'approved') ? 'Cấp 2 (Giám đốc)' : 'Cấp 1 (Quản lý)';
                $pending[] = [
                    'id' => (int)$a['id'],
                    'type' => 'advance',
                    'employee_name' => $a['employee_name'],
                    'user_id' => (int)$a['user_id'],
                    'approver_id' => (int)($a['approver_id'] ?? 0),
                    'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                    'approver_name' => $a['approver_name'] ?? null,
                    'approver_name_2' => $a['approver_name_2'] ?? null,
                    'approved_by' => (int)($a['approved_by'] ?? 0),
                    'approved_by_name' => $a['approved_by_name'] ?? null,
                    'approved_at' => $a['approved_at'] ?? null,
                    'status_level_1' => $a['status_level_1'] ?? 'pending',
                    'status_level_2' => $a['status_level_2'] ?? 'none',
                    'related_user_ids' => $relArr,
                    'amount' => (float)$a['amount'],
                    'reason' => $a['reason'],
                    'title' => 'Đề xuất tạm ứng lương - ' . $levelText,
                    'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                    'status' => $a['status'] ?? 'pending',
                    'created_at' => $a['created_at']
                ];
            }
        }

        // 3. Pending Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.id, e.created_by, u.full_name as employee_name, e.title, e.amount, e.category, e.date, e.notes, e.notes as description, e.status, e.created_at,
                   e.approver_id, e.approver_id_2, e.approver_id_3, e.status_level_1, e.status_level_2, e.status_level_3,
                   e.approved_by, e.approved_at, e.related_user_ids, e.image_url,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_app3.full_name as approver_name_3,
                   u_real.full_name as approved_by_name
            FROM expenses e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN users u_app1 ON e.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON e.approver_id_2 = u_app2.id
            LEFT JOIN users u_app3 ON e.approver_id_3 = u_app3.id
            LEFT JOIN users u_real ON e.approved_by = u_real.id
            WHERE e.tenant_id = ? AND e.status NOT IN ('approved', 'rejected', 'failed', 'cancelled', 'confirmed', 'paid', 'completed') AND e.deleted_at IS NULL AND e.created_by != ?
            ORDER BY e.created_at DESC
            LIMIT 200
        ");
        $stmtExpenses->execute([$auth['tenant_id'], $userId]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $shouldShow = false;
            $levelText = '';
            
            $lvl1 = $e['status_level_1'] ?? 'pending';
            $lvl2 = $e['status_level_2'] ?? 'none';
            $lvl3 = $e['status_level_3'] ?? 'none';

            $isApp1 = (!empty($e['approver_id']) && (int)$e['approver_id'] === $userId) || (!empty($e['approver_name']) && trim(mb_strtolower($e['approver_name'])) === $userFullName);
            $isApp2 = (!empty($e['approver_id_2']) && (int)$e['approver_id_2'] === $userId) || (!empty($e['approver_name_2']) && trim(mb_strtolower($e['approver_name_2'])) === $userFullName);
            $isApp3 = (!empty($e['approver_id_3']) && (int)$e['approver_id_3'] === $userId) || (!empty($e['approver_name_3']) && trim(mb_strtolower($e['approver_name_3'])) === $userFullName);

            if ($lvl1 === 'pending') {
                if (!empty($e['approver_id']) || !empty($e['approver_name'])) {
                    if ($isApp1 || $isGlobalAdmin) {
                        $shouldShow = true;
                        $levelText = !empty($e['approver_id_2']) ? ' - Cấp 1' : '';
                    }
                } else {
                    if (in_array((int)$e['created_by'], $managedUserIds, true) || $isGlobalAdmin) {
                        $shouldShow = true;
                        $levelText = !empty($e['approver_id_2']) ? ' - Cấp 1' : '';
                    }
                }
            } elseif ($lvl1 === 'approved' && $lvl2 === 'pending') {
                if (!empty($e['approver_id_2']) || !empty($e['approver_name_2'])) {
                    if ($isApp2 || $isGlobalAdmin) {
                        $shouldShow = true;
                        $levelText = ' - Cấp 2';
                    }
                } else if (in_array($role, ['accountant'], true) || $isGlobalAdmin) {
                    $shouldShow = true;
                    $levelText = ' - Cấp 2';
                }
            } elseif ($lvl1 === 'approved' && $lvl2 === 'approved' && $lvl3 === 'pending') {
                if (!empty($e['approver_id_3']) || !empty($e['approver_name_3'])) {
                    if ($isApp3 || $isGlobalAdmin) {
                        $shouldShow = true;
                        $levelText = ' - Cấp 3';
                    }
                } else if ($isGlobalAdmin) {
                    $shouldShow = true;
                    $levelText = ' - Cấp 3';
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

                $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
                if (!is_array($relArr)) {
                    $relArr = explode(',', (string)$e['related_user_ids']);
                }
                $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

                $pending[] = [
                    'id' => (int)$e['id'],
                    'type' => 'expense',
                    'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['created_by']),
                    'user_id' => (int)($e['created_by'] ?? 0),
                    'approver_id' => (int)($e['approver_id'] ?? 0),
                    'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                    'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                    'approver_name' => $e['approver_name'] ?? null,
                    'approver_name_2' => $e['approver_name_2'] ?? null,
                    'approver_name_3' => $e['approver_name_3'] ?? null,
                    'approved_by' => (int)($e['approved_by'] ?? 0),
                    'approved_by_name' => $e['approved_by_name'] ?? null,
                    'approved_at' => $e['approved_at'] ?? null,
                    'status_level_1' => $e['status_level_1'] ?? 'pending',
                    'status_level_2' => $e['status_level_2'] ?? 'none',
                    'status_level_3' => $e['status_level_3'] ?? 'none',
                    'related_user_ids' => $relArr,
                    'image_url' => $e['image_url'] ?? null,
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

        // 4. Pending Checkins (Loại trừ check-in của chính mình)
        if (in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr'], true) || !empty($managedUserIds)) {
            $sqlCheck = "SELECT c.id, u.full_name as employee_name, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at
                         FROM check_ins c
                         JOIN users u ON c.user_id = u.id
                         WHERE u.tenant_id = ? AND c.status = 'pending_approval' AND c.user_id != ?";
            $pCheck = [$auth['tenant_id'], $userId];
            if (!in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr'], true)) {
                $placeholders = implode(',', array_fill(0, count($managedUserIds), '?'));
                $sqlCheck .= " AND c.user_id IN ($placeholders)";
                $pCheck = array_merge($pCheck, $managedUserIds);
            }
            $sqlCheck .= " ORDER BY c.id DESC LIMIT 100";
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

        // 5. Pending Bulk Attendance Requests (Cho phép Trưởng phòng / Quản lý tự duyệt đơn chấm công của chính mình)
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name, u.team_id,
                   u_mgr.full_name as manager_name,
                   u_real.full_name as approved_by_name,
                   (SELECT COUNT(*) FROM attendance_bulk_request_details WHERE request_id = r.id) as days_count,
                   (SELECT check_in_date FROM attendance_bulk_request_details WHERE request_id = r.id ORDER BY check_in_date ASC LIMIT 1) as single_date,
                   (SELECT reason FROM attendance_bulk_request_details WHERE request_id = r.id AND reason IS NOT NULL AND reason != '' LIMIT 1) as first_reason
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users u_mgr ON r.manager_id = u_mgr.id
            LEFT JOIN users u_real ON r.approved_by = u_real.id
            WHERE u.tenant_id = ? AND r.status IN ('pending_manager', 'pending_hr') 
              AND (r.user_id != ? OR r.manager_id = ? OR ?)
            ORDER BY r.created_at DESC
            LIMIT 100
        ");
        $canSelfApproveRole = ($isGlobalAdmin || $role === 'manager' || !empty($ledTeamIds)) ? 1 : 0;
        $stmtBulks->execute([$auth['tenant_id'], $userId, $userId, $canSelfApproveRole]);
        $bulks = $stmtBulks->fetchAll(PDO::FETCH_ASSOC);
        foreach ($bulks as $b) {
            $shouldShow = false;
            $isAssignedApprover = ((int)($b['manager_id'] ?? 0) === $userId) || (!empty($b['manager_name']) && trim(mb_strtolower($b['manager_name'])) === $userFullName);

            if ((int)$b['user_id'] === $userId) {
                // Đơn của chính mình: Chỉ hiển thị cho Trưởng phòng/Quản lý tự duyệt
                if (!$isAssignedApprover && !$isGlobalAdmin && $role !== 'manager' && empty($ledTeamIds)) {
                    continue;
                }
            }

            if ($b['status'] === 'pending_manager') {
                if (!empty($b['manager_id']) || !empty($b['manager_name'])) {
                    // Đã chỉ định người duyệt đích danh -> người đó hoặc Admin/Giám đốc thấy
                    if ($isAssignedApprover || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                } else {
                    // Không chỉ định người duyệt đích danh -> Trưởng nhóm, Quản lý trực tiếp, hoặc Admin/Giám đốc
                    if (in_array((int)($b['team_id'] ?? 0), $ledTeamIds, true) || in_array((int)($b['user_id'] ?? 0), $managedUserIds, true) || $isGlobalAdmin) {
                        $shouldShow = true;
                    }
                }
            } else if ($b['status'] === 'pending_hr') {
                // Cấp 2 chờ Nhân sự duyệt
                if ($role === 'hr' || $isGlobalAdmin) {
                    $shouldShow = true;
                }
            }

            if ($shouldShow) {
                $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true)) : [];
                if (!is_array($relArr)) {
                    $relArr = explode(',', (string)$b['related_user_ids']);
                }
                $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

                list($bTitle, $bDesc) = self::formatBulkTitleAndDesc($b);
                $pending[] = [
                    'id' => (int)$b['id'],
                    'type' => 'attendance_bulk',
                    'employee_name' => $b['employee_name'],
                    'user_id' => (int)$b['user_id'],
                    'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                    'manager_id' => (int)($b['manager_id'] ?? 0),
                    'manager_name' => $b['manager_name'] ?? null,
                    'approved_by' => (int)($b['approved_by'] ?? 0),
                    'approved_by_name' => $b['approved_by_name'] ?? null,
                    'approved_at' => $b['approved_at'] ?? null,
                    'related_user_ids' => $relArr,
                    'title' => $bTitle,
                    'description' => $bDesc,
                    'status' => $b['status'],
                    'created_at' => $b['created_at']
                ];
            }
        }

        usort($pending, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return $pending;
    }

    private function fetchMyRequests(array $auth): array {
        $pending = [];
        $userId = (int)$auth['user_id'];

        // 1. My Leaves
        $stmtLeaves = $this->db->prepare("
            SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                   l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids, u.full_name as employee_name,
                   l.approved_by, l.approved_at,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN users u_app1 ON l.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON l.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON l.approved_by = u_real.id
            WHERE l.user_id = ?
            ORDER BY l.created_at DESC
            LIMIT 200
        ");
        $stmtLeaves->execute([$userId]);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $statusText = $l['status'];
            if ($l['status'] === 'pending' && $l['status_level_1'] === 'approved' && !empty($l['approver_id_2'])) {
                $statusText = 'level1_approved';
            }
            $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$l['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $pending[] = [
                'id' => (int)$l['id'],
                'type' => 'leave',
                'employee_name' => $l['employee_name'],
                'user_id' => (int)$l['user_id'],
                'approver_id' => (int)($l['approver_id'] ?? 0),
                'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                'approver_name' => $l['approver_name'] ?? null,
                'approver_name_2' => $l['approver_name_2'] ?? null,
                'approved_by' => (int)($l['approved_by'] ?? 0),
                'approved_by_name' => $l['approved_by_name'] ?? null,
                'approved_at' => $l['approved_at'] ?? null,
                'status_level_1' => $l['status_level_1'] ?? 'pending',
                'status_level_2' => $l['status_level_2'] ?? 'none',
                'related_user_ids' => $relArr,
                'start_date' => $l['start_date'],
                'end_date' => $l['end_date'],
                'total_days' => (float)$l['total_days'],
                'leave_type' => $l['leave_type'],
                'reason' => $l['reason'],
                'title' => self::formatLeaveTitle($l),
                'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                'status' => $statusText,
                'created_at' => $l['created_at']
            ];
        }

        // 2. My Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.id, a.amount, a.reason, a.status, a.created_at,
                   a.status_level_1, a.status_level_2, a.approver_id, a.approver_id_2, a.user_id, a.related_user_ids, u.full_name as employee_name,
                   a.approved_by, a.approved_at,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users u_app1 ON a.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON a.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON a.approved_by = u_real.id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC
            LIMIT 200
        ");
        $stmtAdvances->execute([$userId]);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $statusText = $a['status'];
            if ($a['status'] === 'pending' && $a['status_level_1'] === 'approved' && !empty($a['approver_id_2'])) {
                $statusText = 'level1_approved';
            }
            $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$a['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $pending[] = [
                'id' => (int)$a['id'],
                'type' => 'advance',
                'employee_name' => $a['employee_name'],
                'user_id' => (int)$a['user_id'],
                'approver_id' => (int)($a['approver_id'] ?? 0),
                'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                'approver_name' => $a['approver_name'] ?? null,
                'approver_name_2' => $a['approver_name_2'] ?? null,
                'approved_by' => (int)($a['approved_by'] ?? 0),
                'approved_by_name' => $a['approved_by_name'] ?? null,
                'approved_at' => $a['approved_at'] ?? null,
                'status_level_1' => $a['status_level_1'] ?? 'pending',
                'status_level_2' => $a['status_level_2'] ?? 'none',
                'related_user_ids' => $relArr,
                'amount' => (float)$a['amount'],
                'reason' => $a['reason'],
                'title' => 'Đề xuất tạm ứng lương',
                'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                'status' => $statusText,
                'created_at' => $a['created_at']
            ];
        }

        // 3. My Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.id, e.title, e.amount, e.category, e.date, e.notes, e.notes as description, e.status, e.created_at,
                   e.approver_id, e.approver_id_2, e.approver_id_3,
                   e.status_level_1, e.status_level_2, e.status_level_3,
                   e.related_user_ids, e.image_url,
                   e.created_by as user_id, u.full_name as employee_name,
                   e.approved_by, e.approved_at,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_app3.full_name as approver_name_3,
                   u_real.full_name as approved_by_name
            FROM expenses e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN users u_app1 ON e.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON e.approver_id_2 = u_app2.id
            LEFT JOIN users u_app3 ON e.approver_id_3 = u_app3.id
            LEFT JOIN users u_real ON e.approved_by = u_real.id
            WHERE (e.created_by = ? OR u.id = ?) AND e.deleted_at IS NULL
            ORDER BY e.created_at DESC
            LIMIT 200
        ");
        $stmtExpenses->execute([$userId, $userId]);
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

            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$e['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $pending[] = [
                'id' => (int)$e['id'],
                'type' => 'expense',
                'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['user_id']),
                'user_id' => (int)$e['user_id'],
                'approver_id' => (int)($e['approver_id'] ?? 0),
                'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                'approver_name' => $e['approver_name'] ?? null,
                'approver_name_2' => $e['approver_name_2'] ?? null,
                'approver_name_3' => $e['approver_name_3'] ?? null,
                'approved_by' => (int)($e['approved_by'] ?? 0),
                'approved_by_name' => $e['approved_by_name'] ?? null,
                'approved_at' => $e['approved_at'] ?? null,
                'status_level_1' => $e['status_level_1'] ?? 'pending',
                'status_level_2' => $e['status_level_2'] ?? 'none',
                'status_level_3' => $e['status_level_3'] ?? 'none',
                'related_user_ids' => $relArr,
                'image_url' => $e['image_url'] ?? null,
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

        // 4. My Checkins (Chỉ lấy khi là đơn đề xuất chờ duyệt hoặc có lý do giải trình thực sự từ nhân viên)
        $stmtCheckins = $this->db->prepare("
            SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, u.full_name as employee_name
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            WHERE c.user_id = ? AND (c.status = 'pending_approval' OR (c.reason IS NOT NULL AND TRIM(c.reason) != '' AND c.reason NOT LIKE 'Duyệt%' AND c.reason NOT LIKE 'Tự động%'))
            ORDER BY c.id DESC
            LIMIT 100
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
            SELECT r.*, u.full_name as employee_name,
                   u_mgr.full_name as manager_name,
                   u_real.full_name as approved_by_name,
                   (SELECT COUNT(*) FROM attendance_bulk_request_details WHERE request_id = r.id) as days_count,
                   (SELECT check_in_date FROM attendance_bulk_request_details WHERE request_id = r.id ORDER BY check_in_date ASC LIMIT 1) as single_date,
                   (SELECT reason FROM attendance_bulk_request_details WHERE request_id = r.id AND reason IS NOT NULL AND reason != '' LIMIT 1) as first_reason
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users u_mgr ON r.manager_id = u_mgr.id
            LEFT JOIN users u_real ON r.approved_by = u_real.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
            LIMIT 100
        ");
        $stmtBulks->execute([$userId]);
        $bulks = $stmtBulks->fetchAll(PDO::FETCH_ASSOC);
        foreach ($bulks as $b) {
            list($bTitle, $bDesc) = self::formatBulkTitleAndDesc($b);
            $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$b['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $pending[] = [
                'id' => (int)$b['id'],
                'type' => 'attendance_bulk',
                'employee_name' => $b['employee_name'],
                'user_id' => (int)$b['user_id'],
                'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                'manager_id' => (int)($b['manager_id'] ?? 0),
                'manager_name' => $b['manager_name'] ?? null,
                'approved_by' => (int)($b['approved_by'] ?? 0),
                'approved_by_name' => $b['approved_by_name'] ?? null,
                'approved_at' => $b['approved_at'] ?? null,
                'related_user_ids' => $relArr,
                'title' => $bTitle,
                'description' => $bDesc,
                'status' => $b['status'],
                'created_at' => $b['created_at']
            ];
        }

        usort($pending, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return $pending;
    }

    private function fetchFollowingRequests(array $auth): array {
        $pending = [];
        $userId = (int)$auth['user_id'];
        $role = strtolower($auth['role'] ?? '');

        // 1. Leaves where user is in related_user_ids or user is HR (excluding leaves created by self)
        if ($role === 'hr') {
            $stmtLeaves = $this->db->prepare("
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       u.full_name as employee_name,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND l.user_id != ?
                ORDER BY l.created_at DESC
                LIMIT 200
            ");
            $stmtLeaves->execute([$auth['tenant_id'], $userId]);
        } else {
            $stmtLeaves = $this->db->prepare("
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       u.full_name as employee_name,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND l.user_id != ? AND (l.related_user_ids LIKE ? OR l.related_user_ids LIKE ?)
                ORDER BY l.created_at DESC
                LIMIT 200
            ");
            $stmtLeaves->execute([$auth['tenant_id'], $userId, '%"' . $userId . '"%', '%' . $userId . '%']);
        }
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$l['related_user_ids']);
            }
            $relArr = array_filter(array_map('intval', $relArr));

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
                    'approver_name' => $l['approver_name'] ?? null,
                    'approver_name_2' => $l['approver_name_2'] ?? null,
                    'approved_by_name' => $l['approved_by_name'] ?? null,
                    'status_level_1' => $l['status_level_1'] ?? 'pending',
                    'status_level_2' => $l['status_level_2'] ?? 'none',
                    'start_date' => $l['start_date'] ?? null,
                    'end_date' => $l['end_date'] ?? null,
                    'total_days' => $l['total_days'] ?? null,
                    'leave_type' => $l['leave_type'] ?? null,
                    'reason' => $l['reason'] ?? '',
                    'related_user_ids' => $relArr,
                    'title' => self::formatLeaveTitle($l),
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
                   a.status_level_1, a.status_level_2, a.approver_id, a.approver_id_2, a.user_id, a.related_user_ids,
                   a.approved_by, a.approved_at,
                   u.full_name as employee_name,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users u_app1 ON a.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON a.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON a.approved_by = u_real.id
            WHERE u.tenant_id = ? AND a.user_id != ? AND (a.related_user_ids LIKE ? OR a.related_user_ids LIKE ?)
            ORDER BY a.created_at DESC
            LIMIT 200
        ");
        $stmtAdvances->execute([$auth['tenant_id'], $userId, '%"' . $userId . '"%', '%' . $userId . '%']);
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$a['related_user_ids']);
            }
            $relArr = array_filter(array_map('intval', $relArr));

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
                    'approver_name' => $a['approver_name'] ?? null,
                    'approver_name_2' => $a['approver_name_2'] ?? null,
                    'approved_by' => (int)($a['approved_by'] ?? 0),
                    'approved_by_name' => $a['approved_by_name'] ?? null,
                    'approved_at' => $a['approved_at'] ?? null,
                    'status_level_1' => $a['status_level_1'] ?? 'pending',
                    'status_level_2' => $a['status_level_2'] ?? 'none',
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
            SELECT e.id, e.title, e.amount, e.category, e.date, e.notes, e.notes as description, e.status, e.created_at,
                   e.approver_id, e.approver_id_2, e.approver_id_3,
                   e.status_level_1, e.status_level_2, e.status_level_3,
                   e.created_by as user_id, e.related_user_ids, e.image_url,
                   e.approved_by, e.approved_at,
                   u.full_name as employee_name,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_app3.full_name as approver_name_3,
                   u_real.full_name as approved_by_name
            FROM expenses e
            JOIN users u ON e.created_by = u.id
            LEFT JOIN users u_app1 ON e.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON e.approver_id_2 = u_app2.id
            LEFT JOIN users u_app3 ON e.approver_id_3 = u_app3.id
            LEFT JOIN users u_real ON e.approved_by = u_real.id
            WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND e.created_by != ? AND (e.related_user_ids LIKE ? OR e.related_user_ids LIKE ?)
            ORDER BY e.created_at DESC
            LIMIT 200
        ");
        $stmtExpenses->execute([$auth['tenant_id'], $userId, '%"' . $userId . '"%', '%' . $userId . '%']);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$e['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

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
                    'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['user_id']),
                    'user_id' => (int)$e['user_id'],
                    'approver_id' => (int)($e['approver_id'] ?? 0),
                    'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                    'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                    'approver_name' => $e['approver_name'] ?? null,
                    'approver_name_2' => $e['approver_name_2'] ?? null,
                    'approver_name_3' => $e['approver_name_3'] ?? null,
                    'approved_by' => (int)($e['approved_by'] ?? 0),
                    'approved_by_name' => $e['approved_by_name'] ?? null,
                    'approved_at' => $e['approved_at'] ?? null,
                    'status_level_1' => $e['status_level_1'] ?? 'pending',
                    'status_level_2' => $e['status_level_2'] ?? 'none',
                    'status_level_3' => $e['status_level_3'] ?? 'none',
                    'related_user_ids' => $relArr,
                    'image_url' => $e['image_url'] ?? null,
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

        // 4. Bulk Attendance Requests where user is in related_user_ids
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name,
                   u_mgr.full_name as manager_name,
                   u_app.full_name as approved_by_name,
                   (SELECT COUNT(*) FROM attendance_bulk_request_details WHERE request_id = r.id) as days_count,
                   (SELECT check_in_date FROM attendance_bulk_request_details WHERE request_id = r.id ORDER BY check_in_date ASC LIMIT 1) as single_date,
                   (SELECT reason FROM attendance_bulk_request_details WHERE request_id = r.id AND reason IS NOT NULL AND reason != '' LIMIT 1) as first_reason
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users u_mgr ON r.manager_id = u_mgr.id
            LEFT JOIN users u_app ON r.approved_by = u_app.id
            WHERE u.tenant_id = ? AND r.user_id != ? AND (r.related_user_ids LIKE ? OR r.related_user_ids LIKE ?)
            ORDER BY r.created_at DESC
            LIMIT 100
        ");
        $stmtBulks->execute([$auth['tenant_id'], $userId, '%"' . $userId . '"%', '%' . $userId . '%']);
        $bulks = $stmtBulks->fetchAll(PDO::FETCH_ASSOC);
        foreach ($bulks as $b) {
            $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$b['related_user_ids']);
            }
            $relArr = array_filter(array_map('intval', $relArr));

            if (in_array($userId, $relArr, true)) {
                list($bTitle, $bDesc) = self::formatBulkTitleAndDesc($b);
                $pending[] = [
                    'id' => (int)$b['id'],
                    'type' => 'attendance_bulk',
                    'employee_name' => $b['employee_name'],
                    'user_id' => (int)$b['user_id'],
                    'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                    'manager_id' => (int)($b['manager_id'] ?? 0),
                    'manager_name' => $b['manager_name'] ?? null,
                    'approved_by' => (int)($b['approved_by'] ?? 0),
                    'approved_by_name' => $b['approved_by_name'] ?? null,
                    'approved_at' => $b['approved_at'] ?? null,
                    'related_user_ids' => $relArr,
                    'title' => $bTitle,
                    'description' => $bDesc,
                    'status' => $b['status'],
                    'created_at' => $b['created_at'],
                    'is_following' => true
                ];
            }
        }

        usort($pending, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return $pending;
    }

    private function fetchAllApprovals(array $auth): array {
        $userId = (int)$auth['user_id'];
        $role = strtolower($auth['role'] ?? '');
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isHrAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr'], true);

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
        if ($isHrAdmin) {
            $stmtLeaves = $this->db->prepare("
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       u.full_name as employee_name,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ?
                ORDER BY l.created_at DESC
                LIMIT 300
            ");
            $stmtLeaves->execute([$auth['tenant_id']]);
        } else {
            $sqlL = "
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       u.full_name as employee_name,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? OR l.related_user_ids LIKE ? OR l.related_user_ids LIKE ?)
                ORDER BY l.created_at DESC LIMIT 300";
            $pL = [$auth['tenant_id'], $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            $stmtLeaves = $this->db->prepare($sqlL);
            $stmtLeaves->execute($pL);
        }
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_map('intval', $relArr);

            $isCreator = ((int)$l['user_id'] === $userId);
            $isApprover = ((int)($l['approver_id'] ?? 0) === $userId || (int)($l['approver_id_2'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            if (!$isHrAdmin && !$isCreator && !$isApprover && !$isRelated) {
                continue;
            }

            $all[] = [
                'id' => (int)$l['id'],
                'type' => 'leave',
                'employee_name' => $l['employee_name'],
                'user_id' => (int)$l['user_id'],
                'approver_id' => (int)($l['approver_id'] ?? 0),
                'approver_id_2' => (int)($l['approver_id_2'] ?? 0),
                'approver_name' => $l['approver_name'] ?? null,
                'approver_name_2' => $l['approver_name_2'] ?? null,
                'approved_by_name' => $l['approved_by_name'] ?? null,
                'status_level_1' => $l['status_level_1'] ?? 'pending',
                'status_level_2' => $l['status_level_2'] ?? 'none',
                'start_date' => $l['start_date'] ?? null,
                'end_date' => $l['end_date'] ?? null,
                'total_days' => $l['total_days'] ?? null,
                'leave_type' => $l['leave_type'] ?? null,
                'reason' => $l['reason'] ?? '',
                'related_user_ids' => $relArr,
                'title' => self::formatLeaveTitle($l),
                'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ). Lý do: "' . $l['reason'] . '"',
                'status' => $l['status'],
                'created_at' => $l['created_at']
            ];
        }

        // 2. All Advances
        $advSelect = "
            SELECT a.id, a.amount, a.reason, a.status, a.created_at,
                   a.status_level_1, a.status_level_2, a.approver_id, a.approver_id_2, a.user_id, a.related_user_ids,
                   a.approved_by, a.approved_at,
                   u.full_name as employee_name,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users u_app1 ON a.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON a.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON a.approved_by = u_real.id
        ";
        if ($isGlobalAdmin) {
            $stmtAdvances = $this->db->prepare($advSelect . "
                WHERE u.tenant_id = ?
                ORDER BY a.created_at DESC
                LIMIT 300
            ");
            $stmtAdvances->execute([$auth['tenant_id']]);
        } else {
            $sqlA = $advSelect . "
                WHERE u.tenant_id = ? AND (a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ? OR a.related_user_ids LIKE ? OR a.related_user_ids LIKE ?)
                ORDER BY a.created_at DESC LIMIT 300";
            $pA = [$auth['tenant_id'], $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            $stmtAdvances = $this->db->prepare($sqlA);
            $stmtAdvances->execute($pA);
        }
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
            if (!is_array($relArr)) $relArr = [];
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $isCreator = ((int)$a['user_id'] === $userId);
            $isApprover = ((int)($a['approver_id'] ?? 0) === $userId || (int)($a['approver_id_2'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            if (!$isGlobalAdmin && !$isCreator && !$isApprover && !$isRelated) {
                continue;
            }

            $all[] = [
                'id' => (int)$a['id'],
                'type' => 'advance',
                'employee_name' => $a['employee_name'],
                'user_id' => (int)$a['user_id'],
                'approver_id' => (int)($a['approver_id'] ?? 0),
                'approver_id_2' => (int)($a['approver_id_2'] ?? 0),
                'approver_name' => $a['approver_name'] ?? null,
                'approver_name_2' => $a['approver_name_2'] ?? null,
                'approved_by' => (int)($a['approved_by'] ?? 0),
                'approved_by_name' => $a['approved_by_name'] ?? null,
                'approved_at' => $a['approved_at'] ?? null,
                'status_level_1' => $a['status_level_1'] ?? 'pending',
                'status_level_2' => $a['status_level_2'] ?? 'none',
                'related_user_ids' => $relArr,
                'title' => 'Đề xuất tạm ứng lương',
                'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                'status' => $a['status'],
                'created_at' => $a['created_at']
            ];
        }

        // 3. All Expenses
        $expSelect = "
            SELECT e.id, e.title, e.amount, e.category, e.date, e.notes, e.notes as description, e.status, e.created_at,
                   e.approver_id, e.approver_id_2, e.approver_id_3,
                   e.status_level_1, e.status_level_2, e.status_level_3,
                   e.created_by as user_id, e.related_user_ids, e.image_url,
                   u.full_name as employee_name,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_app3.full_name as approver_name_3,
                   u_real.full_name as approved_by_name,
                   e.approved_by, e.approved_at
            FROM expenses e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN users u_app1 ON e.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON e.approver_id_2 = u_app2.id
            LEFT JOIN users u_app3 ON e.approver_id_3 = u_app3.id
            LEFT JOIN users u_real ON e.approved_by = u_real.id
        ";

        if ($isGlobalAdmin) {
            $stmtExpenses = $this->db->prepare($expSelect . "
                WHERE e.tenant_id = ? AND e.deleted_at IS NULL
                ORDER BY e.created_at DESC
                LIMIT 300
            ");
            $stmtExpenses->execute([$auth['tenant_id']]);
        } else {
            $sqlE = $expSelect . "
                WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR e.related_user_ids LIKE ? OR e.related_user_ids LIKE ?)
                ORDER BY e.created_at DESC LIMIT 300";
            $pE = [$auth['tenant_id'], $userId, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            $stmtExpenses = $this->db->prepare($sqlE);
            $stmtExpenses->execute($pE);
        }
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expenses as $e) {
            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$e['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $isCreator = ((int)$e['user_id'] === $userId);
            $isApprover = ((int)($e['approver_id'] ?? 0) === $userId || (int)($e['approver_id_2'] ?? 0) === $userId || (int)($e['approver_id_3'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            if (!$isGlobalAdmin && !$isCreator && !$isApprover && !$isRelated) {
                continue;
            }

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
                'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['user_id']),
                'user_id' => (int)$e['user_id'],
                'approver_id' => (int)($e['approver_id'] ?? 0),
                'approver_id_2' => (int)($e['approver_id_2'] ?? 0),
                'approver_id_3' => (int)($e['approver_id_3'] ?? 0),
                'approver_name' => $e['approver_name'] ?? null,
                'approver_name_2' => $e['approver_name_2'] ?? null,
                'approver_name_3' => $e['approver_name_3'] ?? null,
                'approved_by' => (int)($e['approved_by'] ?? 0),
                'approved_by_name' => $e['approved_by_name'] ?? null,
                'approved_at' => $e['approved_at'] ?? null,
                'status_level_1' => $e['status_level_1'] ?? 'pending',
                'status_level_2' => $e['status_level_2'] ?? 'none',
                'status_level_3' => $e['status_level_3'] ?? 'none',
                'related_user_ids' => $relArr,
                'image_url' => $e['image_url'] ?? null,
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

        // 4. All Checkins (Chỉ lấy khi là đơn đề xuất chờ duyệt hoặc có lý do giải trình thực sự từ nhân viên)
        $condCheckin = "(c.status = 'pending_approval' OR (c.reason IS NOT NULL AND TRIM(c.reason) != '' AND c.reason NOT LIKE 'Duyệt%' AND c.reason NOT LIKE 'Tự động%'))";
        if ($isHrAdmin) {
            $stmtCheckins = $this->db->prepare("
                SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, u.full_name as employee_name
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ? AND $condCheckin
                ORDER BY c.id DESC
                LIMIT 200
            ");
            $stmtCheckins->execute([$auth['tenant_id']]);
        } else {
            $sqlC = "
                SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, u.full_name as employee_name
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ? AND $condCheckin AND c.user_id = ?
                ORDER BY c.id DESC LIMIT 200";
            $pC = [$auth['tenant_id'], $userId];
            $stmtCheckins = $this->db->prepare($sqlC);
            $stmtCheckins->execute($pC);
        }
        $checkins = $stmtCheckins->fetchAll(PDO::FETCH_ASSOC);
        foreach ($checkins as $c) {
            $all[] = [
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

        // 5. All Bulk Attendance Requests
        $bulkSelect = "
            SELECT r.*, u.full_name as employee_name,
                   u_mgr.full_name as manager_name,
                   u_app.full_name as approved_by_name,
                   (SELECT COUNT(*) FROM attendance_bulk_request_details WHERE request_id = r.id) as days_count,
                   (SELECT check_in_date FROM attendance_bulk_request_details WHERE request_id = r.id ORDER BY check_in_date ASC LIMIT 1) as single_date,
                   (SELECT reason FROM attendance_bulk_request_details WHERE request_id = r.id AND reason IS NOT NULL AND reason != '' LIMIT 1) as first_reason
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users u_mgr ON r.manager_id = u_mgr.id
            LEFT JOIN users u_app ON r.approved_by = u_app.id
        ";
        if ($isHrAdmin) {
            $stmtBulks = $this->db->prepare($bulkSelect . "
                WHERE u.tenant_id = ?
                ORDER BY r.created_at DESC
                LIMIT 200
            ");
            $stmtBulks->execute([$auth['tenant_id']]);
        } else {
            $sqlB = $bulkSelect . "
                WHERE u.tenant_id = ? AND (r.user_id = ? OR r.manager_id = ? OR r.approved_by = ? OR r.related_user_ids LIKE ? OR r.related_user_ids LIKE ?)
                ORDER BY r.created_at DESC LIMIT 200";
            $pB = [$auth['tenant_id'], $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            $stmtBulks = $this->db->prepare($sqlB);
            $stmtBulks->execute($pB);
        }
        $bulks = $stmtBulks->fetchAll(PDO::FETCH_ASSOC);
        foreach ($bulks as $b) {
            $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode($b['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$b['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $isCreator = ((int)$b['user_id'] === $userId);
            $isApprover = ((int)($b['approved_by'] ?? $b['manager_id'] ?? 0) === $userId || (int)($b['manager_id'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            if (!$isHrAdmin && !$isCreator && !$isApprover && !$isRelated) {
                continue;
            }
            list($bTitle, $bDesc) = self::formatBulkTitleAndDesc($b);
            $all[] = [
                'id' => (int)$b['id'],
                'type' => 'attendance_bulk',
                'employee_name' => $b['employee_name'],
                'user_id' => (int)$b['user_id'],
                'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                'manager_id' => (int)($b['manager_id'] ?? 0),
                'manager_name' => $b['manager_name'] ?? null,
                'approved_by' => (int)($b['approved_by'] ?? 0),
                'approved_by_name' => $b['approved_by_name'] ?? null,
                'approved_at' => $b['approved_at'] ?? null,
                'related_user_ids' => $relArr,
                'title' => $bTitle,
                'description' => $bDesc,
                'status' => $b['status'],
                'created_at' => $b['created_at']
            ];
        }

        usort($all, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return $all;
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
        $isPrivileged = $this->isAdmin($auth) || in_array($auth['role'], ['manager', 'director', 'hr'], true);
        $isCreator = ((int)$row['user_id'] === (int)$auth['user_id']);
        if (!$isCreator && !$isPrivileged) {
            respond(403, null, 'Bạn không có quyền xóa yêu cầu này', false);
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
        $isPrivileged = $this->isAdmin($auth) || in_array($auth['role'], ['manager', 'director', 'hr'], true);
        $isCreator = ((int)$row['user_id'] === (int)$auth['user_id']);
        if (!$isCreator && !$isPrivileged) {
            respond(403, null, 'Bạn không có quyền xóa yêu cầu này', false);
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
