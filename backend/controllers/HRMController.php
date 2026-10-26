<?php
class HRMController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    private static bool $checkInsHealed = false;
    private static ?array $lateGraceSettingsCache = null;

    public static function healPollutedCheckIns(PDO $db): void {
        if (self::$checkInsHealed) return;
        self::$checkInsHealed = true;
        $flagFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_hrm_healed_checkins_v2.flag';
        if (@is_file($flagFile) && (time() - (int)@filemtime($flagFile)) < 300) {
            return;
        }
        try {
            $stmt = $db->query("
                SELECT id, reason, status, late_minutes, selfie_url
                FROM check_ins
                WHERE reason LIKE '%[Ngoài bán kính%'
                   OR reason LIKE '%[Không có tọa độ GPS%'
                   OR (selfie_url IS NOT NULL AND TRIM(selfie_url) != '' AND (status = 'pending_approval' OR (reason IS NOT NULL AND TRIM(reason) != '')))
                   OR (status = 'pending_approval' AND late_minutes > 0)
                LIMIT 500
            ");
            $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            if (!empty($rows)) {
                $upd = $db->prepare("UPDATE check_ins SET reason = ?, status = ?, late_minutes = ? WHERE id = ?");
                foreach ($rows as $r) {
                    $hasSelfie = !empty(trim((string)($r['selfie_url'] ?? '')));
                    $lateMins = (int)($r['late_minutes'] ?? 0);
                    $newStatus = $r['status'];

                    if ($hasSelfie) {
                        $cleanedReason = null;
                        if ($newStatus === 'pending_approval') {
                            $newStatus = 'approved';
                        }
                    } else {
                        $cleaned = (string)($r['reason'] ?? '');
                        $cleaned = preg_replace('/\s*\[Ngoài bán kính văn phòng:[^\]]*\]/u', '', $cleaned);
                        $cleaned = preg_replace('/\s*\[Không có tọa độ GPS[^\]]*\]/u', '', $cleaned);
                        $cleaned = trim($cleaned);
                        $cleanedReason = $cleaned !== '' ? $cleaned : null;
                        if ($cleanedReason === null && $newStatus === 'pending_approval') {
                            $newStatus = 'approved';
                        }
                        if ($newStatus === 'pending_approval') {
                            $lateMins = 0;
                        }
                    }

                    $upd->execute([$cleanedReason, $newStatus, $lateMins, (int)$r['id']]);
                }
            }
            @file_put_contents($flagFile, (string)time());
        } catch (\Throwable $e) {}
    }

    private function isAdmin(array $auth): bool {
        return in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true);
    }

    private function resolveEmployeeLateGraceMinutes(?string $gender, ?string $fullName, int $graceMale = 30, int $graceFemale = 60): array {
        $g = mb_strtolower(trim((string)$gender), 'UTF-8');
        $isMale = in_array($g, ['male', 'nam', 'm', '1', 'boy', 'man'], true);
        $isFemale = in_array($g, ['female', 'nữ', 'nu', 'f', '0', 'girl', 'woman'], true);
        if (!$isMale && !$isFemale && !empty($fullName)) {
            $n = ' ' . mb_strtolower(trim($fullName), 'UTF-8') . ' ';
            if (strpos($n, ' thị ') !== false || strpos($n, ' nữ ') !== false || strpos($n, ' ngọc ') !== false || strpos($n, ' tuyết ') !== false || strpos($n, ' trâm ') !== false || strpos($n, ' thảo ') !== false || strpos($n, ' uyên ') !== false || strpos($n, ' nhi ') !== false || strpos($n, ' trân ') !== false || strpos($n, ' lan ') !== false || strpos($n, ' huyền ') !== false || strpos($n, ' ái ') !== false || strpos($n, ' thoa ') !== false || strpos($n, ' thương ') !== false || strpos($n, ' ngân ') !== false || strpos($n, ' linh ') !== false || strpos($n, ' thi ') !== false) {
                $isFemale = true;
            } elseif (strpos($n, ' văn ') !== false || strpos($n, ' đình ') !== false || strpos($n, ' trọng ') !== false || strpos($n, ' hoàng ') !== false || strpos($n, ' gia ') !== false || strpos($n, ' trí ') !== false || strpos($n, ' quốc ') !== false || strpos($n, ' trùng ') !== false || strpos($n, ' quang ') !== false) {
                $isMale = true;
            }
        }
        $resolvedGender = $isMale ? 'male' : 'female';
        $graceMinutes = $isMale ? $graceMale : $graceFemale;
        return [
            'gender' => $resolvedGender,
            'gender_label' => $isMale ? 'Nam' : 'Nữ',
            'grace_minutes' => $graceMinutes,
        ];
    }

    private function getSystemLateGraceSettings(): array {
        if (self::$lateGraceSettingsCache !== null) {
            return self::$lateGraceSettingsCache;
        }
        $graceMale = 30;
        $graceFemale = 60;
        try {
            $stmtGrace = $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('hrm_late_grace_male', 'hrm_late_grace_female')");
            foreach (($stmtGrace ? $stmtGrace->fetchAll(PDO::FETCH_ASSOC) : []) as $sRow) {
                if (($sRow['setting_key'] ?? '') === 'hrm_late_grace_male' && (int)$sRow['setting_value'] > 0) {
                    $graceMale = (int)$sRow['setting_value'];
                } elseif (($sRow['setting_key'] ?? '') === 'hrm_late_grace_female' && (int)$sRow['setting_value'] > 0) {
                    $graceFemale = (int)$sRow['setting_value'];
                }
            }
        } catch (\Throwable $e) {}
        self::$lateGraceSettingsCache = [$graceMale, $graceFemale];
        return self::$lateGraceSettingsCache;
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

    public static function cleanLeaveReason(?string $reason): string {
        if (!$reason) return '';
        $r = trim($reason);
        $r = preg_replace('/^\[(?:Đăng ký làm việc từ xa|Tăng ca|Đi muộn\/Về sớm|Nghỉ phép)\]\s*/iu', '', $r);
        $r = preg_replace('/^\[(?:Tỷ lệ hưởng lương|Hình thức):[^\]]+\]\s*/iu', '', $r);
        $r = preg_replace('/^Thời gian:\s*[^.]+\.\s*/iu', '', $r);
        $r = preg_replace('/^Lý do:\s*/iu', '', $r);
        return trim($r);
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

        $cleanReason = self::cleanLeaveReason($l['reason'] ?? '');
        $reasonStr = $cleanReason ? " - {$cleanReason}" : '';

        if ($type === 'remote_work') {
            return "Đăng ký WFH{$dateStr}{$daysStr}{$reasonStr}";
        }
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
        [$graceMale, $graceFemale] = $this->getSystemLateGraceSettings();
        $enrichProfiles = function(array $rows) use ($graceMale, $graceFemale): array {
            foreach ($rows as &$row) {
                $graceInfo = $this->resolveEmployeeLateGraceMinutes($row['gender'] ?? null, $row['full_name'] ?? null, $graceMale, $graceFemale);
                if (empty($row['gender'])) {
                    $row['gender'] = $graceInfo['gender'];
                }
                $row['gender_label'] = $graceInfo['gender_label'];
                $row['late_grace_minutes'] = $graceInfo['grace_minutes'];
            }
            unset($row);
            return $rows;
        };

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
                respond(200, $enrichProfiles($stmt->fetchAll(PDO::FETCH_ASSOC)));
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
                respond(200, $enrichProfiles($stmt->fetchAll(PDO::FETCH_ASSOC)));
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
            respond(200, $enrichProfiles($stmt->fetchAll(PDO::FETCH_ASSOC)));
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
            respond(200, $enrichProfiles($stmt->fetchAll(PDO::FETCH_ASSOC)));
        }
    }

    public function saveProfile(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        if (empty($b['user_id']) || empty($b['joined_date'])) {
            respond(400, null, 'Thiếu thông tin user_id hoặc ngày vào làm', false);
        }

        $targetUserId = (int)$b['user_id'];
        $chkUser = $this->db->prepare("SELECT id, full_name FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
        $chkUser->execute([$targetUserId, $auth['tenant_id']]);
        $targetUserRow = $chkUser->fetch(PDO::FETCH_ASSOC);
        if (!$targetUserRow) {
            respond(404, null, 'Nhân sự không tồn tại trong hệ thống', false);
        }

        if (array_key_exists('gender', $b)) {
            $rawGender = trim((string)($b['gender'] ?? ''));
            if ($rawGender !== '') {
                $graceInfo = $this->resolveEmployeeLateGraceMinutes($rawGender, $targetUserRow['full_name'] ?? null);
                $updGenderStmt = $this->db->prepare("UPDATE users SET gender = ? WHERE id = ? AND tenant_id = ?");
                $updGenderStmt->execute([$graceInfo['gender'], $targetUserId, $auth['tenant_id']]);
            }
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
            $targetUserId,
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
        $callerId = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        $targetUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : $callerId;

        $chkUser = $this->db->prepare("SELECT id, team_id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
        $chkUser->execute([$targetUserId, $auth['tenant_id']]);
        $targetUser = $chkUser->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            respond(404, null, 'Nhân sự không tồn tại trong hệ thống', false);
        }

        if ($targetUserId !== $callerId && !$this->isAdmin($auth)) {
            $role = strtolower((string)($auth['role'] ?? ''));
            $isManager = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead', 'accountant', 'ke_toan'], true);
            if (!$isManager) {
                respond(403, null, 'Không có quyền xem số dư phép của nhân sự khác', false);
            }
        }

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

    private static array $tableColumnsCache = [];

    private function hasColumn(string $table, string $column): bool {
        if (!isset(self::$tableColumnsCache[$table])) {
            $safeTbl = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
            $cacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_hrm_cols_v2_' . $safeTbl . '_' . md5((string)@filemtime(__FILE__)) . '.json';
            if (@is_file($cacheFile)) {
                $cached = @json_decode((string)@file_get_contents($cacheFile), true);
                if (is_array($cached)) {
                    self::$tableColumnsCache[$table] = $cached;
                }
            }
            if (!isset(self::$tableColumnsCache[$table])) {
                try {
                    $stmt = $this->db->query("SHOW COLUMNS FROM `{$table}`");
                    self::$tableColumnsCache[$table] = $stmt ? ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: []) : [];
                    @file_put_contents($cacheFile, json_encode(self::$tableColumnsCache[$table]));
                } catch (\Throwable $e) {
                    self::$tableColumnsCache[$table] = [];
                }
            }
        }
        return in_array($column, self::$tableColumnsCache[$table], true);
    }

    public function resolveRelatedUsers($rawRelated): array {
        if (empty($rawRelated)) return [];
        $ids = is_array($rawRelated) ? $rawRelated : (json_decode((string)$rawRelated, true) ?: []);
        if (!is_array($ids)) return [];
        $ids = array_values(array_filter(array_unique(array_map('intval', $ids))));
        if (empty($ids)) return [];
        $inClause = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT id, full_name, full_name as name, avatar_url, avatar_url as avatar, job_title, role FROM users WHERE id IN ($inClause)");
        $stmt->execute($ids);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    // --- LEAVE REQUESTS ---

    public function indexLeaves(array $auth): void {
        $userId = (int)$auth['user_id'];
        $leaveId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        $where = "u.tenant_id = ? AND (l.status != 'draft' OR l.user_id = ?)";
        $params = [$auth['tenant_id'], $userId];

        if ($leaveId > 0) {
            $where .= " AND l.id = ?";
            $params[] = $leaveId;
        }
        if (!$this->isAdmin($auth)) {
            $where .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? OR l.related_user_ids LIKE ? OR l.related_user_ids LIKE ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ?))";
            $params[] = $userId;
            $params[] = $userId;
            $params[] = $userId;
            $params[] = '%"' . $userId . '"%';
            $params[] = '%' . $userId . '%';
            $params[] = $userId;
        }

        $stmt = $this->db->prepare("
            SELECT l.*, u.full_name as employee_name, u.email as employee_email,
                   u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title,
                   app1.full_name as approver_name, app1.avatar_url as approver_avatar,
                   app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2,
                   apby.full_name as approved_by_name, apby.avatar_url as approved_by_avatar,
                   apby2.full_name as approved_by_name_2, apby2.avatar_url as approved_by_avatar_2,
                   COALESCE(p.annual_leave_total, 12.0) as annual_leave_total,
                   COALESCE(p.annual_leave_used, 0.0) as annual_leave_used,
                   COALESCE(p.compensatory_leave_total, 0.0) as compensatory_leave_total,
                   COALESCE(p.compensatory_leave_used, 0.0) as compensatory_leave_used
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN users app1 ON l.approver_id = app1.id
            LEFT JOIN users app2 ON l.approver_id_2 = app2.id
            LEFT JOIN users apby ON l.approved_by = apby.id
            LEFT JOIN users apby2 ON l.approved_by_2 = apby2.id
            LEFT JOIN hrm_profiles p ON l.user_id = p.user_id
            WHERE $where
            ORDER BY l.created_at DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $allRelatedIds = [];
        foreach ($rows as $rowItem) {
            $rawRel = $rowItem['related_user_ids'] ?? null;
            if (!empty($rawRel)) {
                $parsedIds = is_array($rawRel) ? $rawRel : (json_decode((string)$rawRel, true) ?: []);
                if (is_array($parsedIds)) {
                    foreach ($parsedIds as $rid) {
                        $ridInt = (int)$rid;
                        if ($ridInt > 0) $allRelatedIds[$ridInt] = $ridInt;
                    }
                }
            }
        }
        $relatedUsersMap = [];
        if (!empty($allRelatedIds)) {
            $inClause = implode(',', array_fill(0, count($allRelatedIds), '?'));
            $stmtRel = $this->db->prepare("SELECT id, full_name, full_name as name, avatar_url, avatar_url as avatar, job_title, department, role FROM users WHERE id IN ($inClause)");
            $stmtRel->execute(array_values($allRelatedIds));
            foreach ($stmtRel->fetchAll(PDO::FETCH_ASSOC) ?: [] as $uRow) {
                $relatedUsersMap[(int)$uRow['id']] = $uRow;
            }
        }

        foreach ($rows as &$r) {
            $r['annual_leave_total'] = (float)$r['annual_leave_total'];
            $r['annual_leave_used'] = (float)$r['annual_leave_used'];
            $r['compensatory_leave_total'] = (float)$r['compensatory_leave_total'];
            $r['compensatory_leave_used'] = (float)$r['compensatory_leave_used'];
            $r['remaining_annual_leave'] = max(0.0, $r['annual_leave_total'] - $r['annual_leave_used']);
            $r['remaining_compensatory_leave'] = max(0.0, $r['compensatory_leave_total'] - $r['compensatory_leave_used']);
            $r['raw_reason'] = $r['reason'] ?? '';
            $r['reason'] = self::cleanLeaveReason($r['reason'] ?? '');
            $r['title'] = self::formatLeaveTitle($r);
            $rawRel = $r['related_user_ids'] ?? null;
            $relIds = !empty($rawRel) ? (is_array($rawRel) ? $rawRel : (json_decode((string)$rawRel, true) ?: [])) : [];
            $relUsers = [];
            if (is_array($relIds)) {
                foreach (array_unique(array_map('intval', $relIds)) as $ridInt) {
                    if ($ridInt > 0 && isset($relatedUsersMap[$ridInt])) {
                        $relUsers[] = $relatedUsersMap[$ridInt];
                    }
                }
            }
            $r['related_users'] = $relUsers;
        }
        unset($r);

        if ($leaveId > 0 && !empty($rows)) {
            respond(200, $rows[0]);
            return;
        }

        respond(200, $rows);
    }

    public function showLeave(array $auth, int $id): void {
        $userId = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        $where = "l.id = ? AND u.tenant_id = ? AND (l.status != 'draft' OR l.user_id = ?)";
        $params = [$id, $auth['tenant_id'], $userId];
        if (!$this->isAdmin($auth)) {
            $where .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? OR l.related_user_ids LIKE ? OR l.related_user_ids LIKE ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ?))";
            array_push($params, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%', $userId);
        }

        $stmt = $this->db->prepare("
            SELECT l.*, u.full_name as employee_name, u.email as employee_email,
                   u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title,
                   app1.full_name as approver_name, app1.avatar_url as approver_avatar,
                   app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2,
                   apby.full_name as approved_by_name, apby.avatar_url as approved_by_avatar,
                   apby2.full_name as approved_by_name_2, apby2.avatar_url as approved_by_avatar_2,
                   COALESCE(p.annual_leave_total, 12.0) as annual_leave_total,
                   COALESCE(p.annual_leave_used, 0.0) as annual_leave_used,
                   COALESCE(p.compensatory_leave_total, 0.0) as compensatory_leave_total,
                   COALESCE(p.compensatory_leave_used, 0.0) as compensatory_leave_used
            FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN users app1 ON l.approver_id = app1.id
            LEFT JOIN users app2 ON l.approver_id_2 = app2.id
            LEFT JOIN users apby ON l.approved_by = apby.id
            LEFT JOIN users apby2 ON l.approved_by_2 = apby2.id
            LEFT JOIN hrm_profiles p ON l.user_id = p.user_id
            WHERE $where
            LIMIT 1
        ");
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy đơn xin nghỉ phép hoặc không có quyền xem', false);
            return;
        }

        $row['annual_leave_total'] = (float)$row['annual_leave_total'];
        $row['annual_leave_used'] = (float)$row['annual_leave_used'];
        $row['compensatory_leave_total'] = (float)$row['compensatory_leave_total'];
        $row['compensatory_leave_used'] = (float)$row['compensatory_leave_used'];
        $row['remaining_annual_leave'] = max(0.0, $row['annual_leave_total'] - $row['annual_leave_used']);
        $row['remaining_compensatory_leave'] = max(0.0, $row['compensatory_leave_total'] - $row['compensatory_leave_used']);
        $row['raw_reason'] = $row['reason'] ?? '';
        $row['reason'] = self::cleanLeaveReason($row['reason'] ?? '');
        $row['title'] = self::formatLeaveTitle($row);
        $row['related_users'] = $this->resolveRelatedUsers($row['related_user_ids'] ?? null);

        respond(200, $row);
    }

    public function createLeave(array $auth): void {
        $b = getBody();
        $isDraft = (($b['status'] ?? '') === 'draft');
        // Support frontend key names from_date & to_date as fallbacks
        $startDate = $b['start_date'] ?? $b['from_date'] ?? ($isDraft ? date('Y-m-d') : null);
        $endDate = $b['end_date'] ?? $b['to_date'] ?? ($isDraft ? $startDate : null);
        if ($isDraft && empty($b['leave_type'])) {
            $b['leave_type'] = 'annual';
        }

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
        if (empty($approverId) && !$isDraft) {
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

        // Giữ nguyên danh sách related_user_ids do người dùng chọn từ Frontend, không tự ý push thêm
        $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode((string)$b['related_user_ids'], true)) : [];
        if (!is_array($relArr)) $relArr = [];
        $relArr = array_values(array_unique(array_filter(array_map('intval', $relArr))));
        $relatedUserIds = !empty($relArr) ? json_encode($relArr) : null;

        $leaveType = $b['leave_type'];
        $otType = null;
        $otRate = null;
        $salaryRate = 100.0;
        $totalDays = (float)($b['total_days'] ?? $b['days'] ?? 1.0);
        $unpaidDays = 0.0;
        $rawReason = trim((string)($b['reason'] ?? ''));
        $reason = self::cleanLeaveReason($rawReason);

        if ($leaveType === 'overtime') {
            $otType = (!empty($b['ot_type']) && in_array($b['ot_type'], ['compensatory', 'salary'], true)) ? $b['ot_type'] : 'salary';
            $otRate = !empty($b['ot_rate']) ? (float)$b['ot_rate'] : 1.5;
            if ($otRate <= 0) $otRate = 1.5;
        } elseif ($leaveType === 'remote_work') {
            // Quy định WFH: 2 ngày đầu tiên trong tháng hưởng 100% lương, từ ngày thứ 3 trở đi hưởng 50% lương
            $targetMonth = substr($startDate, 0, 7); // 'YYYY-MM'
            $targetMonthStart = $targetMonth . '-01 00:00:00';
            $targetMonthEnd   = date('Y-m-t 23:59:59', strtotime($targetMonth . '-01'));
            $stmtWfhMonth = $this->db->prepare("
                SELECT COALESCE(SUM(total_days), 0) as used_days
                FROM hrm_leave_requests
                WHERE user_id = ? 
                  AND leave_type = 'remote_work' 
                  AND status IN ('approved', 'pending')
                  AND start_date >= ? AND start_date <= ?
            ");
            $stmtWfhMonth->execute([(int)$auth['user_id'], $targetMonthStart, $targetMonthEnd]);
            $usedWfhDays = (float)$stmtWfhMonth->fetchColumn();

            // Nếu người dùng không chỉ định tỷ lệ riêng, tự động áp dụng: <= 2 ngày thì 100%, > 2 ngày thì 50%
            if (isset($b['salary_rate'])) {
                $salaryRate = (float)$b['salary_rate'];
            } else {
                $salaryRate = ($usedWfhDays < 2.0) ? 100.0 : 50.0;
            }

            if ($salaryRate < 0.0 || $salaryRate > 100.0) {
                respond(400, null, 'Tỷ lệ hưởng lương làm việc từ xa phải từ 0% đến 100% (không được vượt quá 100%).', false);
                return;
            }
            $unpaidDays = round($totalDays * (1.0 - ($salaryRate / 100.0)), 2);
        } elseif ($leaveType === 'unpaid') {
            $unpaidDays = $totalDays;
            $salaryRate = 0.0;
        }

        if ($isDraft) {
            $isSelfApproved = false;
            $initialStatus = 'draft';
            $statusL1 = 'none';
            $statusL2 = 'none';
            $approvedBy = null;
            $approvedAt = null;
        } else {
            $isSelfApproved = ($approverId > 0 && $approverId === (int)$auth['user_id'] && (empty($approverId2) || $approverId2 === (int)$auth['user_id']));
            $initialStatus = $isSelfApproved ? 'approved' : 'pending';
            $statusL1 = $isSelfApproved ? 'approved' : 'pending';
            $statusL2 = $isSelfApproved ? (!empty($approverId2) ? 'approved' : 'none') : ($approverId2 ? 'pending' : 'none');
            $approvedBy = $isSelfApproved ? $auth['user_id'] : null;
            $approvedAt = $isSelfApproved ? date('Y-m-d H:i:s') : null;
        }

        $stmt = $this->db->prepare("
            INSERT INTO hrm_leave_requests (user_id, leave_type, ot_type, ot_rate, salary_rate, start_date, end_date, total_days, unpaid_days, reason, status, approver_id, approver_id_2, status_level_1, status_level_2, approved_by, approved_at, related_user_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['user_id'],
            $leaveType,
            $otType,
            $otRate,
            $salaryRate,
            $startDate,
            $endDate,
            $totalDays,
            $unpaidDays,
            $rawReason !== '' ? $rawReason : $reason,
            $initialStatus,
            $approverId,
            $approverId2,
            $statusL1,
            $statusL2,
            $approvedBy,
            $approvedAt,
            $relatedUserIds
        ]);
        $leaveId = (int)$this->db->lastInsertId();

        if (!$isDraft) {
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
                if (!$isSelfApproved) {
                    NotificationService::send($this->db, $auth['tenant_id'], 'HRM_LEAVE_REQUEST', [
                        'approver_id' => $approverId > 0 ? (int)$approverId : 0,
                        'target_user_id' => $approverId > 0 ? (int)$approverId : 0,
                        'user_id' => (int)$auth['user_id'],
                        'user_name' => $userName,
                        'submitter_id' => (int)$auth['user_id'],
                        'exclude_user_id' => (int)$auth['user_id'],
                        'leave_type' => $leaveType,
                        'leave_type_text' => $leaveTypeText,
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'total_days' => $totalDays,
                        'reason' => $reason,
                        'date' => date('Y-m-d'),
                        'ref_id' => $leaveId
                    ]);
                }

                // Notify related persons with informational watcher notification
                if (!empty($relArr)) {
                    $isOt = ($leaveType === 'overtime');
                    $wTitle = $isOt ? "📌 Bạn được gắn theo dõi đề xuất tăng ca" : "📌 Bạn được gắn theo dõi đơn nghỉ phép";
                    $wBody = "{$userName} vừa tạo " . ($isOt ? "đề xuất tăng ca" : "đơn xin nghỉ phép ({$leaveTypeText})") . " ({$startDate} - {$endDate}) và gắn bạn làm người liên quan.";
                    $wLink = "/approvals?tab=leave&open_id={$leaveId}&open_type=leave";
                    $stmtWatch = $this->db->prepare("
                        INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'leave', ?, 0, NOW())
                    ");
                    foreach (array_unique(array_map('intval', $relArr)) as $relUid) {
                        if ($relUid > 0 && $relUid !== (int)$auth['user_id'] && $relUid !== (int)$approverId && $relUid !== (int)$approverId2) {
                            $stmtWatch->execute([$relUid, $auth['tenant_id'], $wTitle, $wBody, $wLink]);
                            NotificationService::pruneUserNotifications($this->db, $relUid, 200);
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        respond(200, ['success' => true, 'id' => $leaveId]);
    }

    public function updateLeave(array $auth, int $id): void {
        $b = getBody();
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                SELECT l.*, u.tenant_id, u.full_name as employee_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                WHERE l.id = ? AND u.tenant_id = ?
                FOR UPDATE
            ");
            $stmt->execute([$id, $tid]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy đơn xin nghỉ phép', false);
            }

            $isCreator = ((int)$row['user_id'] === $uid);
            $isPrivileged = $this->isAdmin($auth) || in_array(strtolower($auth['role'] ?? ''), ['manager', 'director', 'hr', 'leader', 'truongphong', 'head_of_department'], true);
            if (!$isCreator && !$isPrivileged) {
                $this->db->rollBack();
                respond(403, null, 'Bạn không có quyền chỉnh sửa đơn này', false);
            }

            $oldStatus = $row['status'] ?? 'pending';
            if (!in_array($oldStatus, ['draft', 'pending', 'rejected'], true)) {
                $this->db->rollBack();
                respond(422, null, 'Chỉ có thể chỉnh sửa đơn ở trạng thái Nháp, Chờ duyệt hoặc Từ chối', false);
            }

            $leaveType = $b['leave_type'] ?? $row['leave_type'];
            $startDate = $b['start_date'] ?? $b['from_date'] ?? $row['start_date'];
            $endDate = $b['end_date'] ?? $b['to_date'] ?? $row['end_date'];
            $totalDays = isset($b['total_days']) ? (float)$b['total_days'] : (isset($b['days']) ? (float)$b['days'] : (float)$row['total_days']);
            $rawReason = array_key_exists('reason', $b) ? trim((string)$b['reason']) : (string)($row['reason'] ?? '');

            $newStatus = isset($b['status']) && in_array($b['status'], ['pending', 'draft'], true)
                ? $b['status']
                : ($oldStatus === 'rejected' ? 'pending' : $oldStatus);

            if ($newStatus === 'pending') {
                $rawReason = trim(preg_replace('/\s*\[Từ chối:[^\]]*\]/u', '', $rawReason));
            }

            $approverId = array_key_exists('approver_id', $b) ? (!empty($b['approver_id']) ? (int)$b['approver_id'] : null) : (!empty($row['approver_id']) ? (int)$row['approver_id'] : null);
            $approverId2 = array_key_exists('approver_id_2', $b) ? (!empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null) : (!empty($row['approver_id_2']) ? (int)$row['approver_id_2'] : null);

            if ($newStatus === 'pending' && empty($approverId)) {
                $stmtLeader = $this->db->prepare("SELECT t.leader_id FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?");
                $stmtLeader->execute([$row['user_id']]);
                $leadId = $stmtLeader->fetchColumn();
                if (!empty($leadId) && (int)$leadId !== (int)$row['user_id']) {
                    $approverId = (int)$leadId;
                } else {
                    $stmtDir = $this->db->query("SELECT id FROM users WHERE LOWER(role) IN ('director', 'superadmin', 'super_admin') AND id != " . (int)$row['user_id'] . " LIMIT 1");
                    $approverId = (int)($stmtDir->fetchColumn() ?: 1003);
                }
            }

            $relatedUserIds = $row['related_user_ids'] ?? null;
            if (array_key_exists('related_user_ids', $b)) {
                $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode((string)$b['related_user_ids'], true)) : [];
                if (!is_array($relArr)) $relArr = [];
                $relatedUserIds = !empty($relArr) ? json_encode(array_values(array_unique(array_map('intval', $relArr)))) : null;
            }

            $otType = array_key_exists('ot_type', $b) ? $b['ot_type'] : ($row['ot_type'] ?? null);
            $otRate = array_key_exists('ot_rate', $b) ? (float)$b['ot_rate'] : (isset($row['ot_rate']) ? (float)$row['ot_rate'] : null);
            $salaryRate = array_key_exists('salary_rate', $b) ? (float)$b['salary_rate'] : (isset($row['salary_rate']) ? (float)$row['salary_rate'] : 100.0);
            $unpaidDays = (float)($row['unpaid_days'] ?? 0.0);
            if ($leaveType === 'remote_work') {
                $unpaidDays = round($totalDays * (1.0 - ($salaryRate / 100.0)), 2);
            } elseif ($leaveType === 'unpaid') {
                $unpaidDays = $totalDays;
                $salaryRate = 0.0;
            }

            $statusL1 = $newStatus === 'draft' ? 'none' : 'pending';
            $statusL2 = $newStatus === 'draft' ? 'none' : (!empty($approverId2) ? 'pending' : 'none');

            $sets = [
                'leave_type = ?',
                'start_date = ?',
                'end_date = ?',
                'total_days = ?',
                'unpaid_days = ?',
                'salary_rate = ?',
                'ot_type = ?',
                'ot_rate = ?',
                'reason = ?',
                'approver_id = ?',
                'approver_id_2 = ?',
                'related_user_ids = ?',
                'status = ?',
                'status_level_1 = ?',
                'status_level_2 = ?'
            ];
            $params = [
                $leaveType,
                $startDate,
                $endDate,
                $totalDays,
                $unpaidDays,
                $salaryRate,
                $otType,
                $otRate,
                $rawReason,
                $approverId,
                $approverId2,
                $relatedUserIds,
                $newStatus,
                $statusL1,
                $statusL2
            ];

            if ($newStatus === 'pending') {
                $sets[] = 'approved_by = NULL';
                $sets[] = 'approved_at = NULL';
                if ($this->hasColumn('hrm_leave_requests', 'reject_reason')) {
                    $sets[] = 'reject_reason = NULL';
                }
            }
            if (array_key_exists('attachment_url', $b) && $this->hasColumn('hrm_leave_requests', 'attachment_url')) {
                $sets[] = 'attachment_url = ?';
                $params[] = $b['attachment_url'];
            }

            $params[] = $id;
            $upd = $this->db->prepare("UPDATE hrm_leave_requests SET " . implode(', ', $sets) . " WHERE id = ?");
            $upd->execute($params);

            $this->db->commit();

            if (in_array($oldStatus, ['draft', 'rejected'], true) && $newStatus === 'pending' && (!$approverId || $approverId !== $uid)) {
                try {
                    require_once __DIR__ . '/../NotificationService.php';
                    NotificationService::send($this->db, $tid, 'HRM_LEAVE_REQUEST', [
                        'approver_id' => $approverId > 0 ? (int)$approverId : 0,
                        'target_user_id' => $approverId > 0 ? (int)$approverId : 0,
                        'user_id' => (int)$row['user_id'],
                        'user_name' => $row['employee_name'] ?: ($auth['full_name'] ?? 'Nhân viên'),
                        'submitter_id' => (int)$row['user_id'],
                        'exclude_user_id' => $uid,
                        'leave_type' => $leaveType,
                        'leave_type_text' => self::formatLeaveTypeText($leaveType),
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'total_days' => $totalDays,
                        'reason' => self::cleanLeaveReason($rawReason),
                        'date' => date('Y-m-d'),
                        'ref_id' => $id
                    ]);
                } catch (\Throwable $e) {}
            }

            $this->showLeave($auth, $id);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi cập nhật đơn nghỉ phép: ' . $e->getMessage(), false);
        }
    }

    public function approveLeave(array $auth, ?int $urlId = null): void {
        $b = getBody();
        $id = (int)($b['id'] ?? $b['request_id'] ?? $urlId ?? $_GET['id'] ?? 0);
        if (!$id || empty($b['status'])) {
            respond(400, null, 'Thiếu ID hoặc trạng thái phê duyệt', false);
        }

        $statusInput = $b['status'];
        $approverNote = $b['reason'] ?? $b['reject_reason'] ?? $b['manager_note'] ?? $b['note'] ?? 'Không có ghi chú thêm';

        $ownTx = !$this->db->inTransaction();
        if ($ownTx) {
            $this->db->beginTransaction();
        }

        try {
            $stmtLock = $this->db->prepare("SELECT * FROM hrm_leave_requests WHERE id = ? FOR UPDATE");
            $stmtLock->execute([$id]);
            $lockedLeave = $stmtLock->fetch(PDO::FETCH_ASSOC);

            $stmtL = $this->db->prepare("SELECT l.*, u.full_name FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE l.id = ? FOR UPDATE");
            $stmtL->execute([$id]);
            $leaveRow = $stmtL->fetch(PDO::FETCH_ASSOC);

            if (!$lockedLeave || !$leaveRow) {
                if ($ownTx && $this->db->inTransaction()) $this->db->rollBack();
                respond(404, null, 'Yêu cầu nghỉ phép không tồn tại', false);
            }

            $isApprover1 = ((int)$auth['user_id'] === (int)$leaveRow['approver_id']);
            $isApprover2 = ((int)$auth['user_id'] === (int)$leaveRow['approver_id_2']);
            $isSuperAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
            $isPrivileged = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr', 'leader', 'team_lead', 'teamlead', 'marketing_lead'], true);

            $isCreator = ((int)$auth['user_id'] === (int)$leaveRow['user_id']);
            if ($isCreator && !$isApprover1 && !$isApprover2 && !$isPrivileged) {
                if ($ownTx && $this->db->inTransaction()) $this->db->rollBack();
                respond(403, null, 'Người tạo đơn không được tự phê duyệt đề xuất của chính mình', false);
            }

            if (!$isApprover1 && !$isApprover2 && !$isPrivileged) {
                if ($ownTx && $this->db->inTransaction()) $this->db->rollBack();
                respond(403, null, 'Bạn không có quyền phê duyệt yêu cầu này', false);
            }

            if ($isApprover2 && !$isApprover1 && !$isSuperAdmin) {
                if ($leaveRow['status_level_1'] === 'pending') {
                    if ($ownTx && $this->db->inTransaction()) $this->db->rollBack();
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

            // Deduct leave balance upon final approval (only when transitioning from non-approved to approved)
            if ($nextStatus === 'approved' && ($leaveRow['status'] ?? '') !== 'approved') {
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

                if (($type === 'annual' || $type === 'compensatory') && ($leaveRow['status'] ?? '') !== 'approved') {
                    $profStmt = $this->db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1 FOR UPDATE");
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
                        $profStmt = $this->db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1 FOR UPDATE");
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
                } elseif ($type === 'remote_work') {
                    $salaryRate = isset($leaveRow['salary_rate']) ? (float)$leaveRow['salary_rate'] : 50.0;
                    if ($salaryRate < 0.0) $salaryRate = 0.0;
                    if ($salaryRate > 100.0) $salaryRate = 100.0;
                    $unpaidDays = round($days * (1.0 - ($salaryRate / 100.0)), 2);
                    $paidDays = round($days - $unpaidDays, 2);
                    $wfhLog = " [Đã duyệt WFH: Hưởng {$salaryRate}% lương ~ {$paidDays} công]";
                    $updReason = $this->db->prepare("UPDATE hrm_leave_requests SET reason = CONCAT(COALESCE(reason, ''), ?), unpaid_days = ?, salary_rate = ? WHERE id = ?");
                    $updReason->execute([$wfhLog, $unpaidDays, $salaryRate, (int)$leaveRow['id']]);
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

            if ($ownTx && $this->db->inTransaction()) {
                $this->db->commit();
            }
        } catch (\Throwable $e) {
            if ($ownTx && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
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

        // Tự động tính lại số liệu đối soát công nếu đơn nghỉ phép / WFH / OT vừa được phê duyệt hoàn tất
        if ($nextStatus === 'approved') {
            try {
                $tenantId = (int)($auth['tenant_id'] ?? 1);
                $uId = (int)$leaveRow['user_id'];
                $sDate = substr($leaveRow['start_date'], 0, 10);
                $eDate = substr($leaveRow['end_date'], 0, 10);
                $stmtFindConf = $this->db->prepare("
                    SELECT ac.*, b.from_date, b.to_date
                    FROM attendance_confirmations ac
                    JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                    WHERE ac.user_id = ? AND ac.tenant_id = ? AND ac.status IN ('pending', 'disputed')
                      AND b.from_date <= ? AND b.to_date >= ?
                ");
                $stmtFindConf->execute([$uId, $tenantId, $eDate, $sDate]);
                $confs = $stmtFindConf->fetchAll(PDO::FETCH_ASSOC);
                foreach ($confs as $confRec) {
                    self::recalculateConfirmationRecord($this->db, $tenantId, $confRec);
                }
            } catch (\Throwable $eRecalc) {}
        }

        respond(200, ['success' => true]);
    }

    // --- SALARY ADVANCES ---

    public function indexAdvances(array $auth): void {
        $userId = (int)$auth['user_id'];
        $where = "u.tenant_id = ? AND (a.status != 'draft' OR a.user_id = ?)";
        $params = [$auth['tenant_id'], $userId];

        if (!$this->isAdmin($auth)) {
            $where .= " AND (a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ? OR a.related_user_ids LIKE ? OR a.related_user_ids LIKE ?)";
            $params[] = $userId;
            $params[] = $userId;
            $params[] = $userId;
            $params[] = '%"' . $userId . '"%';
            $params[] = '%' . $userId . '%';
        }

        $stmt = $this->db->prepare("
            SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title,
                   app1.full_name as approver_name, app1.avatar_url as approver_avatar,
                   app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2,
                   apby.full_name as approved_by_name, apby.avatar_url as approved_by_avatar,
                   apby2.full_name as approved_by_name_2, apby2.avatar_url as approved_by_avatar_2
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users app1 ON a.approver_id = app1.id
            LEFT JOIN users app2 ON a.approver_id_2 = app2.id
            LEFT JOIN users apby ON a.approved_by = apby.id
            LEFT JOIN users apby2 ON a.approved_by_2 = apby2.id
            WHERE $where
            ORDER BY a.created_at DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $allRelatedIds = [];
        foreach ($rows as $rowItem) {
            $rawRel = $rowItem['related_user_ids'] ?? null;
            if (!empty($rawRel)) {
                $parsedIds = is_array($rawRel) ? $rawRel : (json_decode((string)$rawRel, true) ?: []);
                if (is_array($parsedIds)) {
                    foreach ($parsedIds as $rid) {
                        $ridInt = (int)$rid;
                        if ($ridInt > 0) $allRelatedIds[$ridInt] = $ridInt;
                    }
                }
            }
        }
        $relatedUsersMap = [];
        if (!empty($allRelatedIds)) {
            $inClause = implode(',', array_fill(0, count($allRelatedIds), '?'));
            $stmtRel = $this->db->prepare("SELECT id, full_name, full_name as name, avatar_url, avatar_url as avatar, job_title, department, role FROM users WHERE id IN ($inClause)");
            $stmtRel->execute(array_values($allRelatedIds));
            foreach ($stmtRel->fetchAll(PDO::FETCH_ASSOC) ?: [] as $uRow) {
                $relatedUsersMap[(int)$uRow['id']] = $uRow;
            }
        }

        foreach ($rows as &$r) {
            $rawRel = $r['related_user_ids'] ?? null;
            $relIds = !empty($rawRel) ? (is_array($rawRel) ? $rawRel : (json_decode((string)$rawRel, true) ?: [])) : [];
            $relUsers = [];
            if (is_array($relIds)) {
                foreach (array_unique(array_map('intval', $relIds)) as $ridInt) {
                    if ($ridInt > 0 && isset($relatedUsersMap[$ridInt])) {
                        $relUsers[] = $relatedUsersMap[$ridInt];
                    }
                }
            }
            $r['related_users'] = $relUsers;
        }
        unset($r);
        respond(200, $rows);
    }

    public function showAdvance(array $auth, int $id): void {
        $userId = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        $role = strtolower((string)($auth['role'] ?? ''));
        $isFinOrAdmin = $this->isAdmin($auth) || in_array($role, ['accountant', 'ke_toan'], true);
        $where = "a.id = ? AND u.tenant_id = ? AND (a.status != 'draft' OR a.user_id = ?)";
        $params = [$id, $auth['tenant_id'], $userId];
        if (!$isFinOrAdmin) {
            $where .= " AND (a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ? OR a.related_user_ids LIKE ? OR a.related_user_ids LIKE ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ?))";
            array_push($params, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%', $userId);
        }

        $stmt = $this->db->prepare("
            SELECT a.*, u.full_name as employee_name, u.email as employee_email,
                   u.avatar_url as employee_avatar, u.avatar_url, u.department, u.job_title,
                   app1.full_name as approver_name, app1.avatar_url as approver_avatar,
                   app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2,
                   apby.full_name as approved_by_name, apby.avatar_url as approved_by_avatar,
                   apby2.full_name as approved_by_name_2, apby2.avatar_url as approved_by_avatar_2
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users app1 ON a.approver_id = app1.id
            LEFT JOIN users app2 ON a.approver_id_2 = app2.id
            LEFT JOIN users apby ON a.approved_by = apby.id
            LEFT JOIN users apby2 ON a.approved_by_2 = apby2.id
            WHERE $where
            LIMIT 1
        ");
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy đề nghị tạm ứng hoặc không có quyền xem', false);
            return;
        }

        $row['related_users'] = $this->resolveRelatedUsers($row['related_user_ids'] ?? null);
        respond(200, $row);
    }

    public function createAdvance(array $auth): void {
        $b = getBody();
        $isDraft = (($b['status'] ?? '') === 'draft');
        $amount = isset($b['amount']) ? (float)$b['amount'] : 0.0;
        if (!$isDraft && $amount <= 0) {
            respond(400, null, 'Số tiền tạm ứng phải lớn hơn 0', false);
        } elseif ($amount < 0) {
            respond(400, null, 'Số tiền tạm ứng không được âm', false);
        }

        $tid = (int)($auth['tenant_id'] ?? 0);
        $uid = (int)($auth['user_id'] ?? 0);
        $approverId = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
        if (empty($approverId) && !$isDraft) {
            $stmtLeader = $this->db->prepare("SELECT t.leader_id FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? AND u.tenant_id = ?");
            $stmtLeader->execute([$uid, $tid]);
            $leadId = $stmtLeader->fetchColumn();
            if (!empty($leadId) && (int)$leadId !== $uid) {
                $approverId = (int)$leadId;
            } else {
                $stmtDir = $this->db->prepare("SELECT id FROM users WHERE LOWER(role) IN ('director', 'superadmin', 'super_admin') AND tenant_id = ? AND id != ? AND is_active = 1 ORDER BY id ASC LIMIT 1");
                $stmtDir->execute([$tid, $uid]);
                $dirId = $stmtDir->fetchColumn();
                if (!$dirId) {
                    $stmtAdmin = $this->db->prepare("SELECT id FROM users WHERE LOWER(role) = 'admin' AND tenant_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1");
                    $stmtAdmin->execute([$tid]);
                    $dirId = $stmtAdmin->fetchColumn();
                }
                $approverId = $dirId ? (int)$dirId : null;
            }
        }
        $approverId2 = !empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null;
        $relatedUserIds = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? json_encode($b['related_user_ids']) : $b['related_user_ids']) : null;

        // Chỉ Ban Giám đốc / Superadmin mới có quyền tự duyệt tạm ứng của chính mình; Quản lý và nhân sự cấp dưới bắt buộc chờ Ban Giám đốc duyệt
        $isExecutive = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isDraft && !$isExecutive && ($approverId === $uid || $approverId2 === $uid)) {
            $stmtDir = $this->db->prepare("SELECT id FROM users WHERE LOWER(role) IN ('director', 'superadmin', 'super_admin') AND tenant_id = ? AND id != ? AND is_active = 1 ORDER BY id ASC LIMIT 1");
            $stmtDir->execute([$tid, $uid]);
            $dirId = $stmtDir->fetchColumn();
            if (!$dirId) {
                $stmtAdmin = $this->db->prepare("SELECT id FROM users WHERE LOWER(role) = 'admin' AND tenant_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1");
                $stmtAdmin->execute([$tid]);
                $dirId = $stmtAdmin->fetchColumn();
            }
            $approverId = $dirId ? (int)$dirId : null;
            if ($approverId2 === $uid) $approverId2 = null;
        }

        if ($isDraft) {
            $isSelfApproved = false;
            $initialStatus = 'draft';
            $statusL1 = 'none';
            $statusL2 = 'none';
            $approvedBy = null;
            $approvedAt = null;
        } else {
            $isSelfApproved = $isExecutive && ($approverId > 0 && $approverId === (int)$auth['user_id'] && (empty($approverId2) || $approverId2 === (int)$auth['user_id']));
            $initialStatus = $isSelfApproved ? 'approved' : 'pending';
            $statusL1 = $isSelfApproved ? 'approved' : 'pending';
            $statusL2 = $isSelfApproved ? (!empty($approverId2) ? 'approved' : 'none') : ($approverId2 ? 'pending' : 'none');
            $approvedBy = $isSelfApproved ? $auth['user_id'] : null;
            $approvedAt = $isSelfApproved ? date('Y-m-d H:i:s') : null;
        }

        $requestDate = !empty($b['request_date']) ? $b['request_date'] : date('Y-m-d');
        $stmt = $this->db->prepare("
            INSERT INTO hrm_salary_advances (user_id, amount, request_date, reason, status, approver_id, approver_id_2, status_level_1, status_level_2, approved_by, approved_at, related_user_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['user_id'],
            $amount,
            $requestDate,
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
        $advId = (int)$this->db->lastInsertId();

        if (!$isDraft) {
            try {
                $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtUser->execute([$auth['user_id']]);
                $userName = $stmtUser->fetchColumn() ?: 'Nhân viên';

                require_once __DIR__ . '/../NotificationService.php';
                if (!$isSelfApproved) {
                    NotificationService::send($this->db, $auth['tenant_id'], 'HRM_ADVANCE_REQUEST', [
                        'approver_id' => $approverId > 0 ? (int)$approverId : 0,
                        'target_user_id' => $approverId > 0 ? (int)$approverId : 0,
                        'user_id' => (int)$auth['user_id'],
                        'submitter_id' => (int)$auth['user_id'],
                        'exclude_user_id' => (int)$auth['user_id'],
                        'user_name' => $userName,
                        'amount' => $amount,
                        'reason' => $b['reason'] ?? '',
                        'date' => date('Y-m-d'),
                        'ref_id' => $advId
                    ]);
                }

                // Notify related persons with informational watcher notification
                if (!empty($b['related_user_ids'])) {
                    $relList = is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode((string)$b['related_user_ids'], true);
                    if (is_array($relList)) {
                        $wTitle = "📌 Bạn được gắn theo dõi đề nghị tạm ứng";
                        $wBody = "{$userName} vừa tạo đề nghị tạm ứng (" . number_format($amount, 0, ',', '.') . "đ) và gắn bạn làm người liên quan.";
                        $wLink = "/approvals?tab=advance&open_id={$advId}&open_type=advance";
                        $stmtWatch = $this->db->prepare("
                            INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                            VALUES (?, ?, ?, ?, 'expense', ?, 0, NOW())
                        ");
                        foreach (array_unique(array_map('intval', $relList)) as $relUid) {
                            if ($relUid > 0 && $relUid !== (int)$auth['user_id'] && $relUid !== (int)$approverId && $relUid !== (int)$approverId2) {
                                $stmtWatch->execute([$relUid, $auth['tenant_id'], $wTitle, $wBody, $wLink]);
                                NotificationService::pruneUserNotifications($this->db, $relUid, 200);
                            }
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        respond(200, ['success' => true, 'id' => $advId]);
    }

    public function updateAdvance(array $auth, int $id): void {
        $b = getBody();
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                SELECT a.*, u.tenant_id, u.full_name as employee_name
                FROM hrm_salary_advances a
                JOIN users u ON a.user_id = u.id
                WHERE a.id = ? AND u.tenant_id = ?
                FOR UPDATE
            ");
            $stmt->execute([$id, $tid]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy đề nghị tạm ứng', false);
            }

            $isCreator = ((int)$row['user_id'] === $uid);
            $isPrivileged = $this->isAdmin($auth) || in_array(strtolower($auth['role'] ?? ''), ['manager', 'director', 'hr', 'accountant', 'leader', 'truongphong', 'head_of_department'], true);
            if (!$isCreator && !$isPrivileged) {
                $this->db->rollBack();
                respond(403, null, 'Bạn không có quyền chỉnh sửa đề nghị tạm ứng này', false);
            }

            $oldStatus = $row['status'] ?? 'pending';
            if (!in_array($oldStatus, ['draft', 'pending', 'rejected'], true)) {
                $this->db->rollBack();
                respond(422, null, 'Chỉ có thể chỉnh sửa đề nghị tạm ứng ở trạng thái Nháp, Chờ duyệt hoặc Từ chối', false);
            }

            $newStatus = isset($b['status']) && in_array($b['status'], ['pending', 'draft'], true)
                ? $b['status']
                : ($oldStatus === 'rejected' ? 'pending' : $oldStatus);

            $amount = array_key_exists('amount', $b) ? (float)$b['amount'] : (float)($row['amount'] ?? 0);
            if ($newStatus !== 'draft' && $amount <= 0) {
                $this->db->rollBack();
                respond(400, null, 'Số tiền tạm ứng phải lớn hơn 0', false);
            } elseif ($amount < 0) {
                $this->db->rollBack();
                respond(400, null, 'Số tiền tạm ứng không được âm', false);
            }

            $reason = array_key_exists('reason', $b) ? trim((string)$b['reason']) : (string)($row['reason'] ?? '');
            if ($newStatus === 'pending') {
                $reason = trim(preg_replace('/\s*\[Từ chối:[^\]]*\]/u', '', $reason));
            }

            $requestDate = !empty($b['request_date']) ? $b['request_date'] : ($row['request_date'] ?? date('Y-m-d'));
            $approverId = array_key_exists('approver_id', $b) ? (!empty($b['approver_id']) ? (int)$b['approver_id'] : null) : (!empty($row['approver_id']) ? (int)$row['approver_id'] : null);
            $approverId2 = array_key_exists('approver_id_2', $b) ? (!empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null) : (!empty($row['approver_id_2']) ? (int)$row['approver_id_2'] : null);

            if ($newStatus === 'pending' && empty($approverId)) {
                $stmtLeader = $this->db->prepare("SELECT t.leader_id FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? AND u.tenant_id = ?");
                $stmtLeader->execute([(int)$row['user_id'], $tid]);
                $leadId = $stmtLeader->fetchColumn();
                if (!empty($leadId) && (int)$leadId !== (int)$row['user_id']) {
                    $approverId = (int)$leadId;
                } else {
                    $stmtDir = $this->db->prepare("SELECT id FROM users WHERE LOWER(role) IN ('director', 'superadmin', 'super_admin') AND tenant_id = ? AND id != ? AND is_active = 1 ORDER BY id ASC LIMIT 1");
                    $stmtDir->execute([$tid, (int)$row['user_id']]);
                    $approverId = (int)($stmtDir->fetchColumn() ?: 1003);
                }
            }

            $relatedUserIds = $row['related_user_ids'] ?? null;
            if (array_key_exists('related_user_ids', $b)) {
                $relArr = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? $b['related_user_ids'] : json_decode((string)$b['related_user_ids'], true)) : [];
                if (!is_array($relArr)) $relArr = [];
                $relatedUserIds = !empty($relArr) ? json_encode(array_values(array_unique(array_map('intval', $relArr)))) : null;
            }

            $statusL1 = $newStatus === 'draft' ? 'none' : 'pending';
            $statusL2 = $newStatus === 'draft' ? 'none' : (!empty($approverId2) ? 'pending' : 'none');

            $sets = [
                'amount = ?',
                'reason = ?',
                'request_date = ?',
                'approver_id = ?',
                'approver_id_2 = ?',
                'related_user_ids = ?',
                'status = ?',
                'status_level_1 = ?',
                'status_level_2 = ?'
            ];
            $params = [
                $amount,
                $reason,
                $requestDate,
                $approverId,
                $approverId2,
                $relatedUserIds,
                $newStatus,
                $statusL1,
                $statusL2
            ];

            if ($newStatus === 'pending') {
                $sets[] = 'approved_by = NULL';
                $sets[] = 'approved_at = NULL';
                if ($this->hasColumn('hrm_salary_advances', 'reject_reason')) {
                    $sets[] = 'reject_reason = NULL';
                }
            }
            if (array_key_exists('attachment_url', $b) && $this->hasColumn('hrm_salary_advances', 'attachment_url')) {
                $sets[] = 'attachment_url = ?';
                $params[] = $b['attachment_url'];
            }

            $params[] = $id;
            $upd = $this->db->prepare("UPDATE hrm_salary_advances SET " . implode(', ', $sets) . " WHERE id = ?");
            $upd->execute($params);

            $this->db->commit();

            if (in_array($oldStatus, ['draft', 'rejected'], true) && $newStatus === 'pending' && (!$approverId || $approverId !== $uid)) {
                try {
                    require_once __DIR__ . '/../NotificationService.php';
                    NotificationService::send($this->db, $tid, 'HRM_ADVANCE_REQUEST', [
                        'approver_id' => $approverId > 0 ? (int)$approverId : 0,
                        'target_user_id' => $approverId > 0 ? (int)$approverId : 0,
                        'user_id' => (int)$row['user_id'],
                        'submitter_id' => (int)$row['user_id'],
                        'exclude_user_id' => $uid,
                        'user_name' => $row['employee_name'] ?: ($auth['full_name'] ?? 'Nhân viên'),
                        'amount' => $amount,
                        'reason' => $reason,
                        'date' => date('Y-m-d'),
                        'ref_id' => $id
                    ]);
                } catch (\Throwable $e) {}
            }

            $this->showAdvance($auth, $id);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi cập nhật đề nghị tạm ứng: ' . $e->getMessage(), false);
        }
    }

    public function approveAdvance(array $auth, ?int $urlId = null): void {
        $b = getBody();
        $id = (int)($b['id'] ?? $b['request_id'] ?? $urlId ?? $_GET['id'] ?? 0);
        if (!$id || empty($b['status'])) {
            respond(400, null, 'Thiếu ID hoặc trạng thái phê duyệt', false);
        }

        $statusInput = $b['status'];
        $approverNote = $b['reason'] ?? $b['reject_reason'] ?? $b['manager_note'] ?? $b['note'] ?? 'Không có ghi chú thêm';

        $this->db->beginTransaction();
        try {
            $stmtA = $this->db->prepare("SELECT a.*, u.full_name FROM hrm_salary_advances a JOIN users u ON a.user_id = u.id WHERE a.id = ? FOR UPDATE");
            $stmtA->execute([$id]);
            $advRow = $stmtA->fetch(PDO::FETCH_ASSOC);

            if (!$advRow) {
                $this->db->rollBack();
                respond(404, null, 'Yêu cầu tạm ứng không tồn tại', false);
            }

            $isApprover1 = ((int)$auth['user_id'] === (int)$advRow['approver_id']);
            $isApprover2 = ((int)$auth['user_id'] === (int)$advRow['approver_id_2']);
            $isSuperAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
            $isPrivileged = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr', 'leader', 'team_lead', 'teamlead', 'marketing_lead'], true);

            $isExecutive = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
            $isCreator = ((int)$auth['user_id'] === (int)$advRow['user_id']);
            if ($isCreator && !$isExecutive) {
                $this->db->rollBack();
                respond(403, null, 'Chỉ Ban Giám đốc mới có thẩm quyền phê duyệt đề xuất tạm ứng của cấp Quản lý', false);
            }

            if (!$isApprover1 && !$isApprover2 && !$isPrivileged) {
                $this->db->rollBack();
                respond(403, null, 'Bạn không có quyền phê duyệt yêu cầu này', false);
            }

            if ($isApprover2 && !$isApprover1 && !$isSuperAdmin) {
                if ($advRow['status_level_1'] === 'pending') {
                    $this->db->rollBack();
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

            $this->db->commit();
        } catch (\Exception $e) {
            $this->db->rollBack();
            respond(500, null, 'Lỗi khi phê duyệt tạm ứng: ' . $e->getMessage(), false);
        }

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
        if (empty($monthYear) && !empty($b['month']) && !empty($b['year'])) {
            $monthYear = sprintf('%04d-%02d', (int)$b['year'], (int)$b['month']);
        } elseif (empty($monthYear) && !empty($b['month']) && preg_match('/^\d{4}-/', (string)$b['month'])) {
            $monthYear = (string)$b['month'];
        } elseif (empty($monthYear)) {
            $monthYear = date('Y-m');
        }
        if (!preg_match('/^\d{4}-(?:[0-1]\d|13|MID|YEND)$/', $monthYear)) {
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
        $startDateOfMonth = !$isSpecialPeriod ? ($monthYear . '-01') : date('Y-m-01');
        $endDateOfMonth   = !$isSpecialPeriod ? date('Y-m-t', strtotime($startDateOfMonth)) : date('Y-m-t');
        $monthStartTs     = $startDateOfMonth . ' 00:00:00';
        $monthEndTs       = $endDateOfMonth . ' 23:59:59';

        if (!$isSpecialPeriod) {
            $milestonesStmt = $this->db->prepare("
                SELECT m.expected_amount, d.contact_id, d.created_by
                FROM deposit_milestones m
                JOIN deposits d ON m.deposit_id = d.id
                LEFT JOIN users u_dep ON d.created_by = u_dep.id
                WHERE (u_dep.tenant_id = ? OR d.created_by IS NULL) AND m.status = 'approved' AND m.approval_date >= ? AND m.approval_date <= ?
            ");
            $milestonesStmt->execute([$auth['tenant_id'], $monthStartTs, $monthEndTs]);
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
        $this->db->beginTransaction();
        try {
            // Batch pre-fetch: Existing payslips for the month (Anti N+1 bottleneck)
            $oldPayslipsMap = [];
            if (!$isSpecialPeriod) {
                $oldStmt = $this->db->prepare("SELECT mp.* FROM monthly_payslips mp JOIN users u ON mp.user_id = u.id WHERE mp.month_year = ? AND u.tenant_id = ?");
                $oldStmt->execute([$monthYear, $auth['tenant_id']]);
                while ($row = $oldStmt->fetch(PDO::FETCH_ASSOC)) {
                    $oldPayslipsMap[(int)$row['user_id']] = $row;
                }
            }

            // Batch pre-fetch: Paid approved leaves per employee for this month (Anti N+1 bottleneck)
            $paidLeavesMap = [];
            $waivedDatesMap = [];
            $checkinsByUserMap = [];
            $leaveDaysByUserMap = [];
            $overtimeByUserMap = [];
            if (!$isSpecialPeriod) {
                $lvBatchStmt = $this->db->prepare("
                    SELECT lr.user_id, SUM(
                        CASE 
                            WHEN lr.leave_type = 'remote_work' THEN lr.total_days * (COALESCE(lr.salary_rate, 50.0) / 100.0)
                            ELSE (lr.total_days - lr.unpaid_days)
                        END
                    ) as paid_days
                    FROM hrm_leave_requests lr
                    JOIN users u ON lr.user_id = u.id
                    WHERE u.tenant_id = ? AND lr.status = 'approved' AND lr.leave_type IN ('annual', 'sick', 'compensatory', 'remote_work', 'special_paid', 'maternity', 'paternity', 'marriage', 'funeral', 'business_trip')
                      AND lr.start_date >= ? AND lr.start_date <= ?
                    GROUP BY lr.user_id
                ");
                $lvBatchStmt->execute([$auth['tenant_id'], $monthStartTs, $monthEndTs]);
                $paidLeavesMap = $lvBatchStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

                // Batch pre-fetch: late_early waivers per employee
                $leBatchStmt = $this->db->prepare("
                    SELECT l.user_id, DATE(l.start_date) as le_date
                    FROM hrm_leave_requests l
                    JOIN users u ON l.user_id = u.id
                    WHERE u.tenant_id = ? AND l.status = 'approved' AND l.leave_type = 'late_early'
                      AND l.start_date BETWEEN ? AND ?
                ");
                $leBatchStmt->execute([$auth['tenant_id'], $monthStartTs, $monthEndTs]);
                while ($rLe = $leBatchStmt->fetch(PDO::FETCH_ASSOC)) {
                    $waivedDatesMap[(int)$rLe['user_id']][] = $rLe['le_date'];
                }

                // Batch pre-fetch: approved check-ins per employee
                $attBatchStmt = $this->db->prepare("
                    SELECT ci.user_id, ci.check_in_date, ci.late_minutes
                    FROM check_ins ci
                    JOIN users u ON ci.user_id = u.id
                    WHERE u.tenant_id = ? AND ci.status = 'approved' AND ci.check_in_date BETWEEN ? AND ?
                ");
                $attBatchStmt->execute([$auth['tenant_id'], $startDateOfMonth, $endDateOfMonth]);
                while ($rAtt = $attBatchStmt->fetch(PDO::FETCH_ASSOC)) {
                    $checkinsByUserMap[(int)$rAtt['user_id']][] = $rAtt;
                }

                // Batch pre-fetch: approved daily leaves per employee to deduct overlapping days from check-in workdays
                $lvDailyBatchStmt = $this->db->prepare("
                    SELECT l.user_id, DATE(l.start_date) as leave_date, SUM(l.total_days) as leave_days
                    FROM hrm_leave_requests l
                    JOIN users u ON l.user_id = u.id
                    WHERE u.tenant_id = ? AND l.status = 'approved' AND l.leave_type IN ('annual', 'sick', 'compensatory', 'unpaid', 'remote_work', 'special_paid')
                      AND l.start_date BETWEEN ? AND ?
                    GROUP BY l.user_id, DATE(l.start_date)
                ");
                $lvDailyBatchStmt->execute([$auth['tenant_id'], $monthStartTs, $monthEndTs]);
                while ($rLvD = $lvDailyBatchStmt->fetch(PDO::FETCH_ASSOC)) {
                    $leaveDaysByUserMap[(int)$rLvD['user_id']][$rLvD['leave_date']] = (float)$rLvD['leave_days'];
                }

                // Batch pre-fetch: approved overtime per employee
                $otBatchStmt = $this->db->prepare("
                    SELECT l.user_id,
                           SUM(l.total_days) as ot_days,
                           SUM(l.total_days * COALESCE(l.ot_rate, 1.5)) as weighted_ot_days
                    FROM hrm_leave_requests l
                    JOIN users u ON l.user_id = u.id
                    WHERE u.tenant_id = ? AND l.status = 'approved' AND l.leave_type = 'overtime'
                      AND (l.ot_type = 'salary' OR l.ot_type IS NULL OR l.ot_type = '')
                      AND l.start_date >= ? AND l.start_date <= ?
                    GROUP BY l.user_id
                ");
                $otBatchStmt->execute([$auth['tenant_id'], $monthStartTs, $monthEndTs]);
                while ($rOt = $otBatchStmt->fetch(PDO::FETCH_ASSOC)) {
                    $overtimeByUserMap[(int)$rOt['user_id']] = $rOt;
                }
            }

            // Batch pre-fetch: Approved advances per employee (Anti N+1 bottleneck)
            $advancesMap = [];
            if (!$isSpecialPeriod) {
                $advBatchStmt = $this->db->prepare("
                    SELECT sa.user_id, SUM(sa.amount) as total_adv
                    FROM hrm_salary_advances sa
                    JOIN users u ON sa.user_id = u.id
                    WHERE u.tenant_id = ? AND sa.status = 'approved' AND sa.deducted_payslip_id IS NULL
                    GROUP BY sa.user_id
                ");
                $advBatchStmt->execute([$auth['tenant_id']]);
                $advancesMap = $advBatchStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
            }

            foreach ($employees as $emp) {
                $userId = (int)$emp['id'];

            // Hoàn trả số ngày nghỉ bù & phép năm đã trừ do đi trễ ở bảng lương cũ của tháng này (nếu có)
            $oldComp = 0.0;
            $oldAnn = 0.0;
            if (!$isSpecialPeriod) {
                $oldPayslip = $oldPayslipsMap[$userId] ?? null;
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

            if ($isSpecialPeriod) {
                $actualWorkedDays = $isThang13 ? $workDaysRequired : 0;
                $paidLeaveDays = 0;
                $totalLateMinutes = 0;
                $latenessCount = 0;
                $overtimeDays = 0;
                $waivedDates = [];
                $checkinsList = [];
            } elseif ($isDirector) {
                // Director auto-enjoys 100% full work days without needing check-in
                $actualWorkedDays = (float)$workDaysRequired;
                $paidLeaveDays = 0.0;
                $totalLateMinutes = 0;
                $latenessCount = 0;
                $overtimeDays = 0.0;
                $waivedDates = [];
                $checkinsList = [];
            } else {
                // 1. Calculate Actual Work Days from pre-fetched check_ins & apply late_early waivers
                $waivedDates = $waivedDatesMap[$userId] ?? [];
                $checkinsList = $checkinsByUserMap[$userId] ?? [];
                $leaveDaysMap = $leaveDaysByUserMap[$userId] ?? [];

                $actualWorkedDays = 0.0;
                $totalLateMinutes = 0;
                $latenessCount = 0;
                foreach ($checkinsList as $ci) {
                    $cDate = $ci['check_in_date'];
                    $leaveDaysOnDate = (float)($leaveDaysMap[$cDate] ?? 0.0);
                    $actualWorkedDays += max(0.0, 1.0 - $leaveDaysOnDate);

                    if (!in_array($cDate, $waivedDates)) {
                        $ciLate = (int)$ci['late_minutes'];
                        if ($ciLate > 0) {
                            $totalLateMinutes += $ciLate;
                            $latenessCount++;
                        }
                    }
                }
            }

            $graceInfo = $this->resolveEmployeeLateGraceMinutes($emp['gender'] ?? null, $emp['full_name'] ?? null, $graceMale, $graceFemale);
            $empGraceMinutes = $graceInfo['grace_minutes'];
            $excessLateMinutes = max(0, $totalLateMinutes - $empGraceMinutes);

            // 2. Add approved leaves that are paid (leave_type = 'annual', 'sick', 'compensatory', 'remote_work', 'special_paid', 'maternity', 'paternity', 'marriage', 'funeral', 'business_trip')
            if ($isSpecialPeriod) {
                $paidLeaveDays = 0;
            } else {
                $paidLeaveDays = (float)($paidLeavesMap[$userId] ?? 0.0);
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

            // Tự động khấu trừ số phút đi trễ vượt định mức vào nghỉ bù -> phép năm -> ngày công
            $deductComp = 0.0;
            $deductAnn = 0.0;
            if (!$isSpecialPeriod && $excessLateMinutes > 0) {
                $remainComp = max(0.0, (float)($emp['compensatory_leave_total'] ?? 0.0) - (float)($emp['compensatory_leave_used'] ?? 0.0));
                $remainAnn = max(0.0, (float)($emp['annual_leave_total'] ?? 0.0) - (float)($emp['annual_leave_used'] ?? 0.0));
                
                // Chỉ quy đổi số phút trễ VƯỢT ĐỊNH MỨC (Nữ > 60p, Nam > 30p) ra ngày công (1 ngày = 480 phút)
                $lateDays = $excessLateMinutes / 480.0;
                
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
                $advanceDeduction = (float)($advancesMap[$userId] ?? 0.0);
            }

            // 6b. Overtime calculation (from pre-fetched approved leave requests of type 'overtime' in this month)
            $overtimeDays = 0.0;
            $overtimeSalary = 0.0;
            if (!$isSpecialPeriod) {
                $otRow = $overtimeByUserMap[$userId] ?? null;
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
                'gender' => $graceInfo['gender'],
                'gender_label' => $graceInfo['gender_label'],
                'work_days_actual' => $totalWorkDays,
                'lateness_minutes' => $totalLateMinutes,
                'lateness_count' => $latenessCount,
                'late_grace_minutes' => $empGraceMinutes,
                'excess_late_minutes' => $excessLateMinutes,
                'remaining_late_grace_minutes' => max(0, $empGraceMinutes - $totalLateMinutes),
                'net_salary' => $netSalary
            ];
        }

            $this->db->commit();
            respond(200, ['success' => true, 'data' => $results]);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi tính bảng lương: ' . $e->getMessage(), false);
        }
    }

    // --- PAYSLIP CONTROLS ---

    public function indexPayslips(array $auth): void {
        $monthYear = $_GET['month_year'] ?? '';
        if (empty($monthYear) && !empty($_GET['month']) && !empty($_GET['year'])) {
            $monthYear = sprintf('%04d-%02d', (int)$_GET['year'], (int)$_GET['month']);
        } elseif (empty($monthYear) && !empty($_GET['month']) && preg_match('/^\d{4}-/', (string)$_GET['month'])) {
            $monthYear = (string)$_GET['month'];
        } elseif (empty($monthYear)) {
            $monthYear = 'all';
        }

        [$graceMale, $graceFemale] = $this->getSystemLateGraceSettings();
        $enrichPayslips = function(array $rows) use ($graceMale, $graceFemale): array {
            foreach ($rows as &$row) {
                $graceInfo = $this->resolveEmployeeLateGraceMinutes($row['gender'] ?? null, $row['employee_name'] ?? null, $graceMale, $graceFemale);
                $graceMinutes = $graceInfo['grace_minutes'];
                $lateMins = (int)($row['lateness_minutes'] ?? 0);
                $row['gender'] = $graceInfo['gender'];
                $row['gender_label'] = $graceInfo['gender_label'];
                $row['late_grace_minutes'] = $graceMinutes;
                $row['excess_late_minutes'] = max(0, $lateMins - $graceMinutes);
                $row['remaining_late_grace_minutes'] = max(0, $graceMinutes - $lateMins);
            }
            unset($row);
            return $rows;
        };

        $extraWhere = '';
        $extraParams = [];
        if (!empty($_GET['user_id'])) {
            $extraWhere .= ' AND p.user_id = ?';
            $extraParams[] = (int)$_GET['user_id'];
        }
        if (!empty($_GET['status'])) {
            $extraWhere .= ' AND p.status = ?';
            $extraParams[] = $_GET['status'];
        }

        if ($monthYear === 'all') {
            if ($this->isAdmin($auth)) {
                $stmt = $this->db->prepare("
                    SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title, u.gender, u.avatar_url, u.avatar_url as avatar
                    FROM monthly_payslips p
                    JOIN users u ON p.user_id = u.id
                    WHERE u.tenant_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'{$extraWhere}
                    ORDER BY p.month_year DESC, p.id DESC
                ");
                $stmt->execute(array_merge([$auth['tenant_id']], $extraParams));
            } else {
                $stmt = $this->db->prepare("
                    SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title, u.gender, u.avatar_url, u.avatar_url as avatar
                    FROM monthly_payslips p
                    JOIN users u ON p.user_id = u.id
                    WHERE u.tenant_id = ? AND p.user_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'{$extraWhere}
                    ORDER BY p.month_year DESC, p.id DESC
                ");
                $stmt->execute(array_merge([$auth['tenant_id'], $auth['user_id']], $extraParams));
            }
            respond(200, $enrichPayslips($stmt->fetchAll(PDO::FETCH_ASSOC)));
            return;
        }

        if ($this->isAdmin($auth)) {
            $stmt = $this->db->prepare("
                SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title, u.gender, u.avatar_url, u.avatar_url as avatar
                FROM monthly_payslips p
                JOIN users u ON p.user_id = u.id
                WHERE u.tenant_id = ? AND p.month_year = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'{$extraWhere}
            ");
            $stmt->execute(array_merge([$auth['tenant_id'], $monthYear], $extraParams));
        } else {
            $stmt = $this->db->prepare("
                SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title, u.gender, u.avatar_url, u.avatar_url as avatar
                FROM monthly_payslips p
                JOIN users u ON p.user_id = u.id
                WHERE u.tenant_id = ? AND p.user_id = ? AND p.month_year = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'{$extraWhere}
            ");
            $stmt->execute(array_merge([$auth['tenant_id'], $auth['user_id'], $monthYear], $extraParams));
        }
        respond(200, $enrichPayslips($stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    public function showPayslip(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT p.*, u.full_name as employee_name, u.email, u.phone, u.job_title, u.gender
            FROM monthly_payslips p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy phiếu lương', false);
        }
        if (!$this->isAdmin($auth) && (int)$row['user_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn không có quyền xem phiếu lương này', false);
        }
        [$graceMale, $graceFemale] = $this->getSystemLateGraceSettings();
        $graceInfo = $this->resolveEmployeeLateGraceMinutes($row['gender'] ?? null, $row['employee_name'] ?? null, $graceMale, $graceFemale);
        $graceMinutes = $graceInfo['grace_minutes'];
        $lateMins = (int)($row['lateness_minutes'] ?? 0);
        $row['gender'] = $graceInfo['gender'];
        $row['gender_label'] = $graceInfo['gender_label'];
        $row['late_grace_minutes'] = $graceMinutes;
        $row['excess_late_minutes'] = max(0, $lateMins - $graceMinutes);
        $row['remaining_late_grace_minutes'] = max(0, $graceMinutes - $lateMins);
        respond(200, $row);
    }

    public function adjustPayslip(array $auth, int $id): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        if (!empty($b['payslips']) && is_array($b['payslips'])) {
            $this->savePayroll($auth);
            return;
        }
        $stmt = $this->db->prepare("
            SELECT mp.*
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $ps = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ps) {
            respond(404, null, 'Không tìm thấy phiếu lương', false);
        }
        if (($ps['status'] ?? '') === 'locked') {
            respond(422, null, 'Bảng lương đã bị khóa, không thể chỉnh sửa số liệu', false);
        }

        $kpiBonus = array_key_exists('kpi_bonus', $b) ? (float)$b['kpi_bonus']
            : (array_key_exists('bonus_amount', $b) ? (float)$b['bonus_amount']
            : (array_key_exists('bonus', $b) ? (float)$b['bonus'] : (float)($ps['kpi_bonus'] ?? 0)));
        $latenessPenalty = array_key_exists('lateness_penalty', $b) ? (float)$b['lateness_penalty']
            : (array_key_exists('penalty_amount', $b) ? (float)$b['penalty_amount']
            : (array_key_exists('deduction', $b) ? (float)$b['deduction'] : (float)($ps['lateness_penalty'] ?? 0)));
        $allowanceTotal = array_key_exists('allowance_total', $b) ? (float)$b['allowance_total']
            : (array_key_exists('allowance', $b) ? (float)$b['allowance'] : (float)($ps['allowance_total'] ?? 0));
        $basicSalary = array_key_exists('salary_basic_calculated', $b) ? (float)$b['salary_basic_calculated'] : (float)($ps['salary_basic_calculated'] ?? 0);
        $overtimeSalary = array_key_exists('overtime_salary', $b) ? (float)$b['overtime_salary'] : (float)($ps['overtime_salary'] ?? 0);
        $diligenceBonus = array_key_exists('diligence_bonus', $b) ? (float)$b['diligence_bonus'] : (float)($ps['diligence_bonus'] ?? 0);
        $bhxh = array_key_exists('insurance_bhxh', $b) ? (float)$b['insurance_bhxh'] : (float)($ps['insurance_bhxh'] ?? 0);
        $bhyt = array_key_exists('insurance_bhyt', $b) ? (float)$b['insurance_bhyt'] : (float)($ps['insurance_bhyt'] ?? 0);
        $bhtn = array_key_exists('insurance_bhtn', $b) ? (float)$b['insurance_bhtn'] : (float)($ps['insurance_bhtn'] ?? 0);
        $pit = array_key_exists('tax_pit', $b) ? (float)$b['tax_pit'] : (float)($ps['tax_pit'] ?? 0);
        $adv = array_key_exists('advance_deduction', $b) ? (float)$b['advance_deduction'] : (float)($ps['advance_deduction'] ?? 0);
        $note = $b['note'] ?? $b['notes'] ?? ($ps['note'] ?? null);

        if (array_key_exists('net_salary', $b)) {
            $netSalary = max(0.0, (float)$b['net_salary']);
        } else {
            $netSalary = max(0.0, $basicSalary + $allowanceTotal + $kpiBonus + $overtimeSalary + $diligenceBonus - ($bhxh + $bhyt + $bhtn) - $latenessPenalty - $pit - $adv);
        }

        $upd = $this->db->prepare("
            UPDATE monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            SET mp.kpi_bonus = ?,
                mp.lateness_penalty = ?,
                mp.allowance_total = ?,
                mp.salary_basic_calculated = ?,
                mp.overtime_salary = ?,
                mp.diligence_bonus = ?,
                mp.net_salary = ?,
                mp.note = ?
            WHERE mp.id = ? AND u.tenant_id = ? AND mp.status != 'locked'
        ");
        $upd->execute([
            max(0.0, $kpiBonus),
            max(0.0, $latenessPenalty),
            max(0.0, $allowanceTotal),
            max(0.0, $basicSalary),
            max(0.0, $overtimeSalary),
            max(0.0, $diligenceBonus),
            $netSalary,
            $note,
            $id,
            $auth['tenant_id']
        ]);

        $this->showPayslip($auth, $id);
    }

    public function deletePayslip(array $auth, int $id): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $stmt = $this->db->prepare("
            SELECT mp.id, mp.status
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy phiếu lương', false);
        }
        if (($row['status'] ?? '') === 'locked') {
            respond(422, null, 'Không thể xóa phiếu lương đã khóa', false);
        }
        $this->db->prepare("
            DELETE mp FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.id = ? AND u.tenant_id = ?
        ")->execute([$id, $auth['tenant_id']]);
        respond(200, ['id' => $id], 'Xóa bảng lương thành công');
    }

    public function sendPayslips(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b = getBody();
        $id = (int)($b['id'] ?? $b['payroll_id'] ?? 0);
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

        // Fetch users who have draft/disputed payslips in this month to notify them (Batch join - zero N+1)
        $stmtUsers = $this->db->prepare("
            SELECT DISTINCT mp.user_id, u.full_name
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.month_year = ? AND mp.status IN ('draft', 'disputed') AND u.tenant_id = ?
        ");
        $stmtUsers->execute([$monthYear, $auth['tenant_id']]);
        $userRows = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];

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
            foreach ($userRows as $uRow) {
                $uid = (int)($uRow['user_id'] ?? 0);
                if ($uid <= 0) continue;
                $uName = !empty($uRow['full_name']) ? $uRow['full_name'] : 'Nhân viên';

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
        $id = (int)($b['id'] ?? $b['payroll_id'] ?? 0);
        $signatureUrl = $b['signature_url'] ?? '';
        $action = $b['action'] ?? 'confirm';
        $note = trim($b['note'] ?? '');

        if ($id <= 0) respond(400, null, 'Thiếu ID phiếu lương', false);

        // Fetch payslip to verify permission and tenant ownership
        $stmtCheck = $this->db->prepare("
            SELECT mp.*, u.tenant_id as owner_tenant_id, u.full_name as employee_name 
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
        $payrollId = (int)($b['payroll_id'] ?? $b['id'] ?? 0);
        $monthYear = $b['month_year'] ?? '';
        if (empty($monthYear) && !empty($b['month']) && !empty($b['year'])) {
            $monthYear = sprintf('%04d-%02d', (int)$b['year'], (int)$b['month']);
        }
        if (empty($monthYear) && $payrollId > 0) {
            $stmtM = $this->db->prepare("
                SELECT mp.month_year
                FROM monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                WHERE mp.id = ? AND u.tenant_id = ?
            ");
            $stmtM->execute([$payrollId, $auth['tenant_id']]);
            $monthYear = (string)($stmtM->fetchColumn() ?: '');
        }
        if (empty($monthYear) && $payrollId <= 0) {
            $monthYear = date('Y-m');
        }

        $action = $b['action'] ?? 'lock';
        if ($action === 'unlock') {
            if ($payrollId > 0 && empty($b['month_year'])) {
                $stmt = $this->db->prepare("
                    UPDATE monthly_payslips mp
                    JOIN users u ON mp.user_id = u.id
                    SET mp.status = 'draft', mp.signature_url = NULL, mp.confirmed_at = NULL 
                    WHERE mp.id = ? AND u.tenant_id = ?
                ");
                $stmt->execute([$payrollId, $auth['tenant_id']]);
            } else {
                $stmt = $this->db->prepare("
                    UPDATE monthly_payslips mp
                    JOIN users u ON mp.user_id = u.id
                    SET mp.status = 'draft', mp.signature_url = NULL, mp.confirmed_at = NULL 
                    WHERE mp.month_year = ? AND u.tenant_id = ?
                ");
                $stmt->execute([$monthYear, $auth['tenant_id']]);
            }
            respond(200, ['success' => true, 'message' => 'Unlocked successfully']);
            return;
        }

        if ($payrollId > 0 && empty($b['month_year'])) {
            $stmt = $this->db->prepare("
                UPDATE monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                SET mp.status = 'locked' 
                WHERE mp.id = ? AND u.tenant_id = ?
            ");
            $stmt->execute([$payrollId, $auth['tenant_id']]);
        } else {
            $stmt = $this->db->prepare("
                UPDATE monthly_payslips mp
                JOIN users u ON mp.user_id = u.id
                SET mp.status = 'locked' 
                WHERE mp.month_year = ? AND u.tenant_id = ?
            ");
            $stmt->execute([$monthYear, $auth['tenant_id']]);
        }

        respond(200, ['success' => true, 'status' => 'locked']);
    }

    private static array $autoConfirmedTenants = [];

    /**
     * Tự động xác nhận các bản ghi đối soát công đã quá hạn chót (Auto-Confirm Past Deadline)
     */
    public static function autoConfirmExpiredAttendance(PDO $db, int $tenantId = 0): int {
        if (isset(self::$autoConfirmedTenants[$tenantId])) {
            return 0;
        }
        self::$autoConfirmedTenants[$tenantId] = true;
        try {
            $where = "WHERE ac.status = 'pending' AND b.deadline_at <= NOW()";
            $params = [];
            if ($tenantId > 0) {
                $where .= " AND b.tenant_id = ?";
                $params[] = $tenantId;
            }
            $stmt = $db->prepare("
                UPDATE attendance_confirmations ac
                JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                SET ac.status = 'auto_confirmed',
                    ac.confirmed_at = b.deadline_at,
                    ac.confirmed_by_type = 'auto'
                {$where}
            ");
            $stmt->execute($params);
            $affected = $stmt->rowCount();

            // Cập nhật trạng thái batch thành 'completed' nếu tất cả bản ghi đã được xử lý
            $db->query("
                UPDATE attendance_confirmation_batches b
                SET b.status = 'completed'
                WHERE b.status = 'active'
                  AND b.deadline_at <= NOW()
                  AND NOT EXISTS (
                      SELECT 1 FROM attendance_confirmations ac
                      WHERE ac.batch_id = b.id AND ac.status IN ('pending', 'disputed')
                  )
            ");
            return $affected;
        } catch (\Throwable $e) {
            error_log("Error in autoConfirmExpiredAttendance: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * HR: Khởi tạo đợt đối soát công & snapshot dữ liệu gửi cho nhân viên
     */
    public function createAttendanceConfirmationBatch(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền HR/Admin là bắt buộc', false);

        $b = getBody();
        $title = trim($b['title'] ?? '');
        $periodType = in_array($b['period_type'] ?? '', ['month', 'range'], true) ? $b['period_type'] : 'month';
        $month = isset($b['month']) ? (int)$b['month'] : null;
        $year = isset($b['year']) ? (int)$b['year'] : null;
        $fromDate = $b['from_date'] ?? '';
        $toDate = $b['to_date'] ?? '';
        $standardDays = (float)($b['standard_days'] ?? 22.0);
        $deadlineAt = trim($b['deadline_at'] ?? '');
        $department = trim($b['department'] ?? 'all');
        $note = trim($b['note'] ?? '');
        $records = is_array($b['records'] ?? null) ? $b['records'] : [];

        if (empty($title)) respond(400, null, 'Vui lòng nhập tiêu đề đợt đối soát bảng công', false);
        if (empty($fromDate) || empty($toDate)) respond(400, null, 'Vui lòng cung cấp ngày bắt đầu và kết thúc kỳ công', false);
        if (empty($deadlineAt)) respond(400, null, 'Vui lòng chọn hạn chót xác nhận công', false);

        // Chuẩn hóa deadline_at
        $deadlineTs = strtotime($deadlineAt);
        if (!$deadlineTs || $deadlineTs <= time()) {
            respond(400, null, 'Hạn chót xác nhận phải lớn hơn thời điểm hiện tại', false);
        }
        $deadlineSql = date('Y-m-d H:i:s', $deadlineTs);

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $creatorId = (int)($auth['user_id'] ?? $auth['id'] ?? 0);

        try {
            $this->db->beginTransaction();

            // 1. Tạo batch
            $stmtBatch = $this->db->prepare("
                INSERT INTO attendance_confirmation_batches 
                (tenant_id, title, period_type, month, year, from_date, to_date, standard_days, deadline_at, department, note, created_by, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmtBatch->execute([
                $tenantId, $title, $periodType, $month, $year, $fromDate, $toDate, $standardDays, $deadlineSql, $department, $note, $creatorId
            ]);
            $batchId = (int)$this->db->lastInsertId();

            // 2. Chèn danh sách nhân sự snapshot
            $stmtInsertRecord = $this->db->prepare("
                INSERT INTO attendance_confirmations 
                (tenant_id, batch_id, user_id, emp_name, emp_dept, emp_title, standard_days, actual_days, 
                 annual_leave_days, comp_leave_days, special_leave_days, wfh_days, unpaid_leave_days, total_paid_days, 
                 late_count, late_minutes, early_minutes, ot_hours, night_shifts, weekend_shifts, supp_count, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                ON DUPLICATE KEY UPDATE 
                    emp_name = VALUES(emp_name),
                    emp_dept = VALUES(emp_dept),
                    emp_title = VALUES(emp_title),
                    standard_days = VALUES(standard_days),
                    actual_days = VALUES(actual_days),
                    annual_leave_days = VALUES(annual_leave_days),
                    comp_leave_days = VALUES(comp_leave_days),
                    special_leave_days = VALUES(special_leave_days),
                    wfh_days = VALUES(wfh_days),
                    unpaid_leave_days = VALUES(unpaid_leave_days),
                    total_paid_days = VALUES(total_paid_days),
                    late_count = VALUES(late_count),
                    late_minutes = VALUES(late_minutes),
                    early_minutes = VALUES(early_minutes),
                    ot_hours = VALUES(ot_hours),
                    night_shifts = VALUES(night_shifts),
                    weekend_shifts = VALUES(weekend_shifts),
                    supp_count = VALUES(supp_count),
                    status = 'pending',
                    dispute_reason = NULL,
                    confirmed_at = NULL,
                    confirmed_by_type = NULL
            ");

            $createdCount = 0;
            $notifiedUsers = [];

            // Lọc danh sách nhân viên đang hoạt động (loại trừ tài khoản inactive / nghỉ việc)
            $stmtActUsers = $this->db->prepare("
                SELECT id FROM users 
                WHERE tenant_id = ? AND is_active = 1 
                  AND LOWER(COALESCE(status, 'active')) NOT IN ('inactive', 'locked', 'resigned', 'terminated')
            ");
            $stmtActUsers->execute([$tenantId]);
            $activeUserMap = array_flip($stmtActUsers->fetchAll(PDO::FETCH_COLUMN) ?: []);

            foreach ($records as $r) {
                $uid = (int)($r['user_id'] ?? 0);
                if ($uid <= 0) continue;
                // Bỏ qua nhân sự inactive
                if (!isset($activeUserMap[$uid])) continue;

                $empName = trim($r['emp_name'] ?? '');
                $empDept = trim($r['emp_dept'] ?? '');
                $empTitle = trim($r['emp_title'] ?? '');
                $std = (float)($r['standard_days'] ?? $standardDays);
                $act = (float)($r['actual_days'] ?? 0);
                $ann = (float)($r['annual_leave_days'] ?? 0);
                $comp = (float)($r['comp_leave_days'] ?? 0);
                $spec = (float)($r['special_leave_days'] ?? 0);
                $wfh = (float)($r['wfh_days'] ?? 0);
                $unpaid = (float)($r['unpaid_leave_days'] ?? 0);
                $paid = (float)($r['total_paid_days'] ?? ($act + $ann + $comp + $spec + $wfh));
                $lateCount = (int)($r['late_count'] ?? 0);
                $lateMins = (int)($r['late_minutes'] ?? 0);
                $earlyMins = (int)($r['early_minutes'] ?? 0);
                $ot = (float)($r['ot_hours'] ?? 0);
                $night = (int)($r['night_shifts'] ?? 0);
                $weekend = (int)($r['weekend_shifts'] ?? 0);
                $supp = (int)($r['supp_count'] ?? 0);

                $stmtInsertRecord->execute([
                    $tenantId, $batchId, $uid, $empName, $empDept, $empTitle, $std, $act,
                    $ann, $comp, $spec, $wfh, $unpaid, $paid,
                    $lateCount, $lateMins, $earlyMins, $ot, $night, $weekend, $supp
                ]);

                $createdCount++;
                $notifiedUsers[$uid] = $empName;
            }

            $this->db->commit();

            // 3. Gửi thông báo tới nhân viên
            try {
                require_once __DIR__ . '/../NotificationService.php';
                foreach ($notifiedUsers as $uid => $uName) {
                    NotificationService::send($this->db, $tenantId, 'ATTENDANCE_CONFIRMATION_REQUESTED', [
                        'user_id' => $uid,
                        'user_name' => $uName,
                        'title' => $title,
                        'deadline' => $deadlineSql,
                        'note' => $note,
                        'batch_id' => $batchId
                    ]);
                }
            } catch (\Throwable $e) {
                error_log("Error dispatching attendance confirmation notifications: " . $e->getMessage());
            }

            respond(200, [
                'success' => true,
                'batch_id' => $batchId,
                'total_employees' => $createdCount,
                'deadline_at' => $deadlineSql
            ], 'Đã tạo đợt đối soát công và gửi thông báo thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi khởi tạo đợt đối soát: ' . $e->getMessage(), false);
        }
    }

    /**
     * HR: Danh sách các đợt đối soát bảng công và tiến độ tổng hợp
     */
    public function listAttendanceConfirmationBatches(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền HR/Admin là bắt buộc', false);

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        self::autoConfirmExpiredAttendance($this->db, $tenantId);

        $stmt = $this->db->prepare("
            SELECT b.*,
                   u.full_name as creator_name,
                   COUNT(ac.id) as total_count,
                   SUM(CASE WHEN ac.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
                   SUM(CASE WHEN ac.status = 'auto_confirmed' THEN 1 ELSE 0 END) as auto_confirmed_count,
                   SUM(CASE WHEN ac.status = 'disputed' THEN 1 ELSE 0 END) as disputed_count,
                   SUM(CASE WHEN ac.status = 'pending' THEN 1 ELSE 0 END) as pending_count
            FROM attendance_confirmation_batches b
            LEFT JOIN users u ON b.created_by = u.id
            LEFT JOIN attendance_confirmations ac ON b.id = ac.batch_id
            WHERE b.tenant_id = ?
            GROUP BY b.id
            ORDER BY b.id DESC
            LIMIT 50
        ");
        $stmt->execute([$tenantId]);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        respond(200, ['batches' => $batches]);
    }

    /**
     * HR: Xem chi tiết một đợt đối soát (kèm danh sách chi tiết nhân viên)
     */
    public function getAttendanceBatchDetail(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền HR/Admin là bắt buộc', false);

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $batchId = (int)($_GET['id'] ?? $_GET['batch_id'] ?? 0);
        if ($batchId <= 0) respond(400, null, 'Thiếu ID đợt đối soát', false);

        self::autoConfirmExpiredAttendance($this->db, $tenantId);

        // Fetch batch
        $stmtBatch = $this->db->prepare("
            SELECT b.*, u.full_name as creator_name
            FROM attendance_confirmation_batches b
            LEFT JOIN users u ON b.created_by = u.id
            WHERE b.id = ? AND b.tenant_id = ?
        ");
        $stmtBatch->execute([$batchId, $tenantId]);
        $batch = $stmtBatch->fetch(PDO::FETCH_ASSOC);
        if (!$batch) respond(404, null, 'Không tìm thấy đợt đối soát này', false);

        // Fetch confirmations
        $stmtList = $this->db->prepare("
            SELECT ac.*, u.email as emp_email, u.avatar_url, u.gender, u.full_name as user_full_name
            FROM attendance_confirmations ac
            LEFT JOIN users u ON ac.user_id = u.id
            WHERE ac.batch_id = ? AND ac.tenant_id = ?
            ORDER BY ac.emp_dept ASC, ac.emp_name ASC
        ");
        $stmtList->execute([$batchId, $tenantId]);
        $records = $stmtList->fetchAll(PDO::FETCH_ASSOC) ?: [];

        [$graceMale, $graceFemale] = $this->getSystemLateGraceSettings();

        $forceRecalc = (($_GET['recalculate'] ?? '') === '1');
        // Chỉ tự động tính toán lại khi có cờ ?recalculate=1 hoặc bản ghi chưa được tính toán lần nào
        foreach ($records as &$rec) {
            if (in_array($rec['status'], ['pending', 'disputed'], true) && ($forceRecalc || $rec['actual_work_days'] === null)) {
                $rec['from_date'] = $batch['from_date'];
                $rec['to_date'] = $batch['to_date'];
                self::recalculateConfirmationRecord($this->db, $tenantId, $rec);
            }
            $graceInfo = $this->resolveEmployeeLateGraceMinutes(
                $rec['gender'] ?? null,
                $rec['emp_name'] ?? $rec['user_full_name'] ?? null,
                $graceMale,
                $graceFemale
            );
            $graceMinutes = $graceInfo['grace_minutes'];
            $lateMins = (int)($rec['late_minutes'] ?? 0);
            $rec['gender'] = $graceInfo['gender'];
            $rec['gender_label'] = $graceInfo['gender_label'];
            $rec['late_grace_minutes'] = $graceMinutes;
            $rec['excess_late_minutes'] = max(0, $lateMins - $graceMinutes);
            $rec['remaining_late_grace_minutes'] = max(0, $graceMinutes - $lateMins);
        }
        unset($rec);

        respond(200, [
            'batch' => $batch,
            'records' => $records
        ]);
    }

    /**
     * Tự động tính toán lại số liệu công cho một bản ghi đối soát công dựa trên check-in và đơn từ mới nhất
     */
    public static function recalculateConfirmationRecord(PDO $db, int $tenantId, array &$record): void {
        $confId = (int)($record['id'] ?? 0);
        $userId = (int)($record['user_id'] ?? 0);
        $fromDate = $record['from_date'] ?? null;
        $toDate = $record['to_date'] ?? null;

        $instance = new self($db);
        [$graceMale, $graceFemale] = $instance->getSystemLateGraceSettings();
        $userGender = $record['gender'] ?? null;
        $userFullName = $record['emp_name'] ?? $record['user_full_name'] ?? null;
        if (($userGender === null || $userFullName === null) && $userId > 0) {
            try {
                $stmtU = $db->prepare("SELECT gender, full_name FROM users WHERE id = ? LIMIT 1");
                $stmtU->execute([$userId]);
                $uRow = $stmtU->fetch(PDO::FETCH_ASSOC);
                if ($uRow) {
                    if ($userGender === null) $userGender = $uRow['gender'] ?? null;
                    if ($userFullName === null) $userFullName = $uRow['full_name'] ?? null;
                }
            } catch (\Throwable $eU) {}
        }
        $graceInfo = $instance->resolveEmployeeLateGraceMinutes($userGender, $userFullName, $graceMale, $graceFemale);
        $graceMinutes = $graceInfo['grace_minutes'];

        if ($confId <= 0 || $userId <= 0 || empty($fromDate) || empty($toDate)) return;

        // Chỉ tự động tính lại nếu bản ghi chưa bị chốt (vẫn pending hoặc disputed)
        if (!in_array($record['status'], ['pending', 'disputed'], true)) {
            $curLateMins = (int)($record['late_minutes'] ?? 0);
            $record['gender'] = $graceInfo['gender'];
            $record['gender_label'] = $graceInfo['gender_label'];
            $record['late_grace_minutes'] = $graceMinutes;
            $record['excess_late_minutes'] = max(0, $curLateMins - $graceMinutes);
            $record['remaining_late_grace_minutes'] = max(0, $graceMinutes - $curLateMins);
            return;
        }

        // 1. Quét các đơn nghỉ phép / WFH / đi muộn về sớm đã được duyệt
        $stmtLeaves = $db->prepare("
            SELECT id, leave_type, salary_rate, start_date, end_date, total_days, status, reason
            FROM hrm_leave_requests
            WHERE user_id = ? 
              AND status = 'approved'
              AND start_date <= ? AND end_date >= ?
            ORDER BY start_date ASC
        ");
        $stmtLeaves->execute([$userId, $toDate . ' 23:59:59', $fromDate . ' 00:00:00']);
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $annualDays = 0.0;
        $compDays = 0.0;
        $specialDays = 0.0;
        $wfhDays = 0.0;
        $unpaidDays = 0.0;
        $waivedDates = [];
        $halfLeaveDates = [];
        $monthlyWfhUsed = [];

        foreach ($leaves as $lv) {
            $days = (float)($lv['total_days'] ?: 1);
            $type = $lv['leave_type'];
            $sDate = substr($lv['start_date'], 0, 10);

            if ($type === 'annual') {
                $annualDays += $days;
            } elseif ($type === 'compensatory') {
                $compDays += $days;
            } elseif ($type === 'remote_work') {
                // Chính sách 2 ngày đầu 100%, từ ngày thứ 3 tính 50%
                $monthKey = substr($sDate, 0, 7);
                $usedBefore = $monthlyWfhUsed[$monthKey] ?? 0.0;

                $quota100Remaining = max(0.0, 2.0 - $usedBefore);
                $daysAt100 = min($days, $quota100Remaining);
                $daysAt50 = max(0.0, $days - $daysAt100);

                $monthlyWfhUsed[$monthKey] = $usedBefore + $days;

                $paidThisWfh = round($daysAt100 * 1.0 + $daysAt50 * 0.5, 2);
                $wfhDays += $paidThisWfh;
            } elseif ($type === 'unpaid') {
                $unpaidDays += $days;
            } elseif (in_array($type, ['special_paid', 'maternity', 'paternity', 'marriage', 'funeral', 'business_trip', 'sick'], true)) {
                $specialDays += $days;
            } elseif ($type === 'late_early') {
                $waivedDates[] = $sDate;
            }

            if ((float)$lv['total_days'] === 0.5) {
                $halfLeaveDates[$sDate] = true;
            }
        }

        // 2. Quét các lượt check-in đã được duyệt (bao gồm cả bổ sung công đã được duyệt)
        $stmtCheckins = $db->prepare("
            SELECT check_in_date, check_in_time, check_out_time, late_minutes, early_minutes, selfie_url, reason, status
            FROM check_ins
            WHERE user_id = ? 
              AND check_in_date >= ? AND check_in_date <= ?
              AND status = 'approved'
            ORDER BY check_in_date ASC, id ASC
        ");
        $stmtCheckins->execute([$userId, $fromDate, $toDate]);
        $checkins = $stmtCheckins->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $actualDays = 0.0;
        $lateCount = 0;
        $lateMins = 0;
        $earlyMins = 0;
        $suppCount = 0;
        $checkedDates = [];

        foreach ($checkins as $ci) {
            $cDate = $ci['check_in_date'];
            if (!isset($checkedDates[$cDate])) {
                $checkedDates[$cDate] = true;
                if (isset($halfLeaveDates[$cDate])) {
                    $actualDays += 0.5;
                } else {
                    $actualDays += 1.0;
                }
            }

            $lMin = (int)($ci['late_minutes'] ?? 0);
            $eMin = (int)($ci['early_minutes'] ?? 0);

            if ($lMin > 0 && !in_array($cDate, $waivedDates, true)) {
                $lateCount++;
                $lateMins += $lMin;
            }
            if ($eMin > 0) {
                $earlyMins += $eMin;
            }
            if (empty($ci['selfie_url'])) {
                $suppCount++;
            }
        }

        // 3. Quét ca trực & OT đã được duyệt
        $otHours = 0.0;
        $nightShifts = 0;
        $weekendShifts = 0;

        try {
            $stmtNight = $db->prepare("
                SELECT COUNT(*) FROM night_shift_registrations 
                WHERE user_id = ? AND shift_date >= ? AND shift_date <= ? AND approved = 1
            ");
            $stmtNight->execute([$userId, $fromDate, $toDate]);
            $nightShifts = (int)$stmtNight->fetchColumn();

            $stmtWeekend = $db->prepare("
                SELECT COUNT(*) FROM weekend_shift_registrations 
                WHERE user_id = ? AND shift_date >= ? AND shift_date <= ? AND approved = 1
            ");
            $stmtWeekend->execute([$userId, $fromDate, $toDate]);
            $weekendShifts = (int)$stmtWeekend->fetchColumn();

            $stmtOt = $db->prepare("
                SELECT COALESCE(SUM(total_days * 8), 0.0) FROM hrm_leave_requests 
                WHERE user_id = ? AND leave_type = 'overtime' AND status = 'approved'
                  AND start_date >= ? AND start_date <= ?
            ");
            $stmtOt->execute([$userId, $fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
            $otHours = (float)($stmtOt->fetchColumn() ?: 0.0);
        } catch (\Throwable $eShifts) {
            error_log('Error querying shifts in getAttendanceConfirmationOverview: ' . $eShifts->getMessage());
        }

        // 4. Tổng công tính lương
        $totalPaidDays = round($actualDays + $annualDays + $compDays + $specialDays + $wfhDays, 2);

        // 5. Cập nhật vào DB
        $stmtUpd = $db->prepare("
            UPDATE attendance_confirmations
            SET actual_days = ?,
                annual_leave_days = ?,
                comp_leave_days = ?,
                special_leave_days = ?,
                wfh_days = ?,
                unpaid_leave_days = ?,
                total_paid_days = ?,
                late_count = ?,
                late_minutes = ?,
                early_minutes = ?,
                supp_count = ?,
                ot_hours = ?,
                night_shifts = ?,
                weekend_shifts = ?
            WHERE id = ? AND status IN ('pending', 'disputed')
        ");
        $stmtUpd->execute([
            $actualDays, $annualDays, $compDays, $specialDays, $wfhDays, $unpaidDays, $totalPaidDays,
            $lateCount, $lateMins, $earlyMins, $suppCount, $otHours, $nightShifts, $weekendShifts,
            $confId
        ]);

        // Cập nhật lại mảng record trả về
        $record['actual_days'] = $actualDays;
        $record['annual_leave_days'] = $annualDays;
        $record['comp_leave_days'] = $compDays;
        $record['special_leave_days'] = $specialDays;
        $record['wfh_days'] = $wfhDays;
        $record['unpaid_leave_days'] = $unpaidDays;
        $record['total_paid_days'] = $totalPaidDays;
        $record['late_count'] = $lateCount;
        $record['late_minutes'] = $lateMins;
        $record['early_minutes'] = $earlyMins;
        $record['supp_count'] = $suppCount;
        $record['ot_hours'] = $otHours;
        $record['night_shifts'] = $nightShifts;
        $record['weekend_shifts'] = $weekendShifts;
        $record['gender'] = $graceInfo['gender'];
        $record['gender_label'] = $graceInfo['gender_label'];
        $record['late_grace_minutes'] = $graceMinutes;
        $record['excess_late_minutes'] = max(0, $lateMins - $graceMinutes);
        $record['remaining_late_grace_minutes'] = max(0, $graceMinutes - $lateMins);
    }

    /**
     * Nhân viên: Lấy thông tin đợt đối soát công đang mở của mình
     */
    public function getMyPendingAttendanceConfirmation(array $auth): void {
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $userId = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        if ($userId <= 0) respond(401, null, 'Vui lòng đăng nhập', false);

        self::autoConfirmExpiredAttendance($this->db, $tenantId);

        $stmt = $this->db->prepare("
            SELECT ac.*, 
                   u.gender,
                   u.full_name as user_full_name,
                   b.title as batch_title, 
                   b.period_type, 
                   b.month, 
                   b.year, 
                   b.from_date, 
                   b.to_date, 
                   b.deadline_at, 
                   b.note as batch_note,
                   b.status as batch_status,
                   CASE WHEN b.deadline_at <= NOW() THEN 1 ELSE 0 END as is_expired
            FROM attendance_confirmations ac
            JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
            LEFT JOIN users u ON ac.user_id = u.id
            WHERE ac.user_id = ? AND ac.tenant_id = ?
            ORDER BY b.id DESC
            LIMIT 1
        ");
        $stmt->execute([$userId, $tenantId]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        // Tự động tính lại số liệu công mới nhất từ các đơn / bổ sung công vừa được duyệt
        if ($record) {
            self::recalculateConfirmationRecord($this->db, $tenantId, $record);
        }

        respond(200, ['confirmation' => $record ?: null]);
    }

    /**
     * Nhân viên: Xác nhận đúng công hoặc Gửi khiếu nại sai lệch
     */
    public function confirmMyAttendance(array $auth): void {
        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $userId = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        if ($userId <= 0) respond(401, null, 'Vui lòng đăng nhập', false);

        $b = getBody();
        $id = (int)($b['id'] ?? 0);
        $batchId = (int)($b['batch_id'] ?? 0);
        $action = $b['action'] ?? 'confirm'; // 'confirm' | 'dispute'
        $disputeReason = trim($b['dispute_reason'] ?? $b['note'] ?? '');

        self::autoConfirmExpiredAttendance($this->db, $tenantId);

        // Find confirmation record
        $stmtFind = $this->db->prepare("
            SELECT ac.*, u.gender, u.full_name as user_full_name, b.title as batch_title, b.from_date, b.to_date, b.deadline_at, b.status as batch_status
            FROM attendance_confirmations ac
            JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
            LEFT JOIN users u ON ac.user_id = u.id
            WHERE " . ($id > 0 ? "ac.id = ?" : "ac.batch_id = ? AND ac.user_id = ?") . " 
              AND ac.user_id = ? AND ac.tenant_id = ?
        ");
        $params = $id > 0 ? [$id, $userId, $tenantId] : [$batchId, $userId, $userId, $tenantId];
        $stmtFind->execute($params);
        $row = $stmtFind->fetch(PDO::FETCH_ASSOC);

        if (!$row) respond(404, null, 'Không tìm thấy thông tin đối soát công của bạn', false);

        if ($action === 'dispute') {
            if (empty($disputeReason)) {
                respond(400, null, 'Vui lòng ghi rõ nội dung sai lệch công để HR đối soát', false);
            }

            $stmtUpdate = $this->db->prepare("
                UPDATE attendance_confirmations
                SET status = 'disputed',
                    dispute_reason = ?,
                    confirmed_at = NULL,
                    confirmed_by_type = 'employee'
                WHERE id = ?
            ");
            $stmtUpdate->execute([$disputeReason, $row['id']]);

            // Dispatch notification to HR
            try {
                require_once __DIR__ . '/../NotificationService.php';
                NotificationService::send($this->db, $tenantId, 'ATTENDANCE_CONFIRMATION_DISPUTED', [
                    'employee_name' => $row['emp_name'] ?: ($auth['name'] ?? 'Nhân viên'),
                    'department' => $row['emp_dept'] ?: '',
                    'title' => $row['batch_title'],
                    'reason' => $disputeReason,
                    'batch_id' => $row['batch_id']
                ]);
            } catch (\Throwable $e) {}

            respond(200, ['success' => true], 'Đã gửi phản hồi sai lệch công về Phòng Nhân sự để xử lý');
        } else {
            // Action: confirm -> Tự động tính toán lại trước khi chốt để số liệu chính xác 100%
            self::recalculateConfirmationRecord($this->db, $tenantId, $row);

            $stmtUpdate = $this->db->prepare("
                UPDATE attendance_confirmations
                SET status = 'confirmed',
                    dispute_reason = NULL,
                    confirmed_at = NOW(),
                    confirmed_by_type = 'employee'
                WHERE id = ?
            ");
            $stmtUpdate->execute([$row['id']]);

            respond(200, ['success' => true, 'updated_record' => $row], 'Đã xác nhận bảng công thành công');
        }
    }

    /**
     * HR: Nhắc nhở những nhân viên chưa xác nhận công
     */
    public function remindAttendanceConfirmation(array $auth): void {
        if (!$this->isAdmin($auth)) respond(403, null, 'Quyền HR/Admin là bắt buộc', false);

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $b = getBody();
        $batchId = (int)($b['batch_id'] ?? 0);
        if ($batchId <= 0) respond(400, null, 'Thiếu ID đợt đối soát', false);

        self::autoConfirmExpiredAttendance($this->db, $tenantId);

        $stmtBatch = $this->db->prepare("SELECT * FROM attendance_confirmation_batches WHERE id = ? AND tenant_id = ?");
        $stmtBatch->execute([$batchId, $tenantId]);
        $batch = $stmtBatch->fetch(PDO::FETCH_ASSOC);
        if (!$batch) respond(404, null, 'Không tìm thấy đợt đối soát này', false);

        $stmtPending = $this->db->prepare("
            SELECT ac.user_id, ac.emp_name 
            FROM attendance_confirmations ac
            JOIN users u ON ac.user_id = u.id
            WHERE ac.batch_id = ? AND ac.tenant_id = ? AND ac.status = 'pending'
              AND u.is_active = 1 
              AND LOWER(COALESCE(u.status, 'active')) NOT IN ('inactive', 'locked', 'resigned', 'terminated')
        ");
        $stmtPending->execute([$batchId, $tenantId]);
        $pendingUsers = $stmtPending->fetchAll(PDO::FETCH_ASSOC) ?: [];

        if (empty($pendingUsers)) {
            respond(200, ['reminded_count' => 0], 'Tất cả nhân viên đã hoàn tất xác nhận, không còn ai chờ');
        }

        try {
            require_once __DIR__ . '/../NotificationService.php';
                foreach ($pendingUsers as $pu) {
                    NotificationService::send($this->db, $tenantId, 'ATTENDANCE_CONFIRMATION_REQUESTED', [
                        'user_id' => (int)$pu['user_id'],
                        'user_name' => $pu['emp_name'],
                        'title' => $batch['title'],
                        'deadline' => $batch['deadline_at'],
                        'note' => 'Nhắc nhở: Sắp hết hạn chót đối soát bảng công. Vui lòng kiểm tra và xác nhận sớm!',
                        'batch_id' => $batchId
                    ]);
                }
        } catch (\Throwable $e) {}

        respond(200, ['reminded_count' => count($pendingUsers)], "Đã gửi thông báo nhắc nhở tới " . count($pendingUsers) . " nhân viên");
    }


    public function countPendingApprovals(array $auth): int {
        return count($this->fetchPendingApprovals($auth));
    }

    public static function detectExpenseCurrency(?string $title, ?string $notes = null, $items = null, ?string $currentCurrency = null): string {
        if (!empty($currentCurrency) && strtoupper(trim($currentCurrency)) === 'USD') {
            return 'USD';
        }
        if (!empty($currentCurrency) && !in_array(strtoupper(trim($currentCurrency)), ['VND', 'VIETNAMDONG', ''], true)) {
            return strtoupper(trim($currentCurrency));
        }
        $text = mb_strtolower(($title ?? '') . ' ' . ($notes ?? ''));
        if (!empty($items)) {
            $text .= ' ' . mb_strtolower(is_string($items) ? $items : json_encode($items, JSON_UNESCAPED_UNICODE));
        }
        $isForeignLecturer = (
            str_contains($text, 'giảng viên nước ngoài') ||
            str_contains($text, 'giang vien nuoc ngoai') ||
            str_contains($text, 'giảng viên nn') ||
            str_contains($text, 'giang vien nn') ||
            str_contains($text, 'thù lao giảng viên nn') ||
            str_contains($text, 'thù lao gv nn') ||
            str_contains($text, 'thù lao gvnn') ||
            str_contains($text, 'oleh_tymchuk') ||
            str_contains($text, 'dr. alvin chan') ||
            str_contains($text, 'dr. walid ghodbane') ||
            str_contains($text, 'dr. serge nyawa') ||
            str_contains($text, 'dr. bruce hearn') ||
            str_contains($text, 'prof. julien sicard')
        );
        if ($isForeignLecturer) {
            return 'USD';
        }
        return !empty($currentCurrency) ? $currentCurrency : 'VND';
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

    private function batchLoadExpenseEntities(array $expenseIds): array {
        $expenseIds = array_values(array_filter(array_unique(array_map('intval', $expenseIds))));
        if (empty($expenseIds)) return [];
        $in = implode(',', array_fill(0, count($expenseIds), '?'));
        $sEE = $this->db->prepare("SELECT ee.*, c.full_name, c.avatar_url FROM expense_entities ee LEFT JOIN contacts c ON ee.entity_type='contact' AND ee.entity_id=c.id WHERE ee.expense_id IN ($in)");
        $sEE->execute($expenseIds);
        $allEntities = $sEE->fetchAll(PDO::FETCH_ASSOC);
        $entitiesByExp = [];
        foreach ($allEntities as $ee) {
            $ee['name'] = trim($ee['full_name'] ?? '');
            $entitiesByExp[(int)$ee['expense_id']][] = $ee;
        }
        return $entitiesByExp;
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
            SELECT l.id, l.user_id, u.full_name as employee_name, u.avatar_url as employee_avatar, l.leave_type, 
                   l.start_date, l.end_date, l.total_days, l.unpaid_days, l.reason, l.status, l.created_at,
                   l.approver_id, l.approver_id_2, l.status_level_1, l.status_level_2,
                   l.approved_by, l.approved_at, l.related_user_ids,
                   l.salary_rate, l.ot_type, l.ot_rate,
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
                $rawReason = $l['reason'] ?? '';
                $cleanReason = self::cleanLeaveReason($rawReason);
                $l['reason'] = $cleanReason;
                $pending[] = [
                    'id' => (int)$l['id'],
                    'type' => 'leave',
                    'employee_name' => $l['employee_name'],
                    'employee_avatar' => $l['employee_avatar'] ?? null,
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
                    'unpaid_days' => isset($l['unpaid_days']) ? (float)$l['unpaid_days'] : 0.0,
                    'salary_rate' => isset($l['salary_rate']) ? (float)$l['salary_rate'] : 50.0,
                    'ot_type' => $l['ot_type'] ?? null,
                    'ot_rate' => isset($l['ot_rate']) ? (float)$l['ot_rate'] : null,
                    'leave_type' => $l['leave_type'],
                    'reason' => $cleanReason,
                    'raw_reason' => $rawReason,
                    'title' => self::formatLeaveTitle($l) . ' - ' . $levelText,
                    'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ).' . ($cleanReason ? ' Lý do: "' . $cleanReason . '"' : ''),
                    'status' => $l['status'] ?? 'pending',
                    'created_at' => $l['created_at']
                ];
            }
        }

        // 2. Pending Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
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
                    'employee_avatar' => $a['employee_avatar'] ?? null,
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
                    'reason' => $a['reason'] ?? '',
                    'raw_reason' => $a['reason'] ?? '',
                    'request_date' => $a['request_date'] ?? null,
                    'title' => 'Đề xuất tạm ứng lương - ' . $levelText,
                    'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                    'status' => $a['status'] ?? 'pending',
                    'created_at' => $a['created_at']
                ];
            }
        }

        // 3. Pending Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.*, e.notes as description, u.full_name as employee_name, u.avatar_url as employee_avatar,
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
            WHERE e.tenant_id = ? AND e.status NOT IN ('draft', 'approved', 'rejected', 'failed', 'cancelled', 'confirmed', 'paid', 'completed') AND e.deleted_at IS NULL AND e.created_by != ?
            ORDER BY e.created_at DESC
            LIMIT 200
        ");
        $stmtExpenses->execute([$auth['tenant_id'], $userId]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        $entitiesByExp = $this->batchLoadExpenseEntities(array_column($expenses, 'id'));
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
                
                $displayDesc = $e['notes'] ?: $e['description'] ?: '';

                $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
                if (!is_array($relArr)) {
                    $relArr = explode(',', (string)$e['related_user_ids']);
                }
                $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

                $pending[] = [
                    'id' => (int)$e['id'],
                    'type' => 'expense',
                    'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['created_by']),
                    'employee_avatar' => $e['employee_avatar'] ?? null,
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
                    'approved_at_2' => $e['approved_at_2'] ?? null,
                    'approved_at_3' => $e['approved_at_3'] ?? null,
                    'approval_steps' => !empty($e['approval_steps']) ? (is_string($e['approval_steps']) ? json_decode($e['approval_steps'], true) : $e['approval_steps']) : null,
                    'status_level_1' => $e['status_level_1'] ?? 'pending',
                    'status_level_2' => $e['status_level_2'] ?? 'none',
                    'status_level_3' => $e['status_level_3'] ?? 'none',
                    'related_user_ids' => $relArr,
                    'image_url' => $e['image_url'] ?? null,
                    'items' => !empty($e['items']) ? (is_string($e['items']) ? json_decode($e['items'], true) : $e['items']) : [],
                    'entities' => $entitiesByExp[(int)$e['id']] ?? [],
                    'title' => $displayTitle,
                    'raw_title' => $e['title'],
                    'description' => $displayDesc,
                    'amount' => (float)$e['amount'],
                    'currency' => self::detectExpenseCurrency($e['title'], $e['notes'] ?? '', $e['items'] ?? null, $e['currency'] ?? 'VND'),
                    'category' => $e['category'] ?? 'Vận hành',
                    'date' => $e['date'] ?? null,
                    'due_date' => $e['due_date'] ?? null,
                    'vat_amount' => isset($e['vat_amount']) ? (float)$e['vat_amount'] : 0.0,
                    'vendor_name' => $e['vendor_name'] ?? null,
                    'has_vat_invoice' => (int)($e['has_vat_invoice'] ?? 0),
                    'is_vat_inclusive' => (int)($e['is_vat_inclusive'] ?? 0),
                    'reject_reason' => $e['reject_reason'] ?? null,
                    'notes' => $e['notes'] ?? '',
                    'status' => $e['status'] ?? 'pending',
                    'is_refunded' => (int)($e['is_refunded'] ?? 0),
                    'refunded_at' => $e['refunded_at'] ?? null,
                    'created_at' => $e['created_at']
                ];
            }
        }

        // 4. Pending Checkins - CHỈ LẤY ĐƠN BỔ SUNG CHẤM CÔNG THỦ CÔNG (Bỏ giải trình đi trễ và ngoài bán kính vì auto-accept)
        self::healPollutedCheckIns($this->db);
        if (in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'hr'], true) || !empty($managedUserIds)) {
            // Lấy ID của Trưởng phòng HCNS (Phương) để tự động gắn vào người theo dõi
            $phuongId = 0;
            try {
                $stmtHrP = $this->db->prepare("SELECT id FROM users WHERE (username = 'phuongntd' OR full_name LIKE '%Duy Phương%' OR role = 'hr') LIMIT 1");
                $stmtHrP->execute();
                $phuongId = (int)$stmtHrP->fetchColumn();
            } catch (\Throwable $eP) {}

            $sqlCheck = "SELECT c.id, c.user_id, c.manager_id, u.full_name as employee_name, u.avatar_url as employee_avatar, u.team_id,
                                c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, 
                                CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at,
                                m.full_name as approver_name, m.avatar_url as approver_avatar,
                                t_lead.id as team_leader_id, t_lead.full_name as team_leader_name, t_lead.avatar_url as team_leader_avatar
                         FROM check_ins c
                         JOIN users u ON c.user_id = u.id
                         LEFT JOIN users m ON c.manager_id = m.id
                         LEFT JOIN teams t ON u.team_id = t.id
                         LEFT JOIN users t_lead ON t.leader_id = t_lead.id
                         WHERE u.tenant_id = ? 
                           AND c.status = 'pending_approval' 
                           AND c.user_id != ?
                           AND (c.selfie_url IS NULL OR TRIM(c.selfie_url) = '')
                           AND COALESCE(c.late_minutes, 0) = 0
                           AND c.reason IS NOT NULL
                           AND TRIM(c.reason) != ''
                           AND c.reason NOT LIKE '%Ngoài bán kính%'
                           AND c.reason NOT LIKE '%Không có tọa độ GPS%'";
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
                $title = 'Bổ sung chấm công ngày ' . $c['check_in_date'];
                $desc = 'Bổ sung chấm công (Check-in lúc ' . $c['check_in_time'] . '). Lý do: "' . ($c['reason'] ?: 'Quên chấm công') . '"';
                $mgrId = (int)($c['manager_id'] ?: $c['team_leader_id'] ?: 0);
                $mgrName = $c['approver_name'] ?: $c['team_leader_name'] ?: null;
                $mgrAvatar = $c['approver_avatar'] ?: $c['team_leader_avatar'] ?: null;

                $pending[] = [
                    'id' => (int)$c['id'],
                    'type' => 'checkin',
                    'user_id' => (int)$c['user_id'],
                    'employee_name' => $c['employee_name'],
                    'employee_avatar' => $c['employee_avatar'] ?? null,
                    'manager_id' => $mgrId ?: null,
                    'approver_id' => $mgrId ?: null,
                    'approver_name' => $mgrName,
                    'approver_avatar' => $mgrAvatar,
                    'related_user_ids' => $phuongId > 0 ? [$phuongId] : [],
                    'title' => $title,
                    'description' => $desc,
                    'status' => $c['status'],
                    'created_at' => $c['created_at']
                ];
            }
        }

        // 5. Pending Bulk Attendance Requests (Cho phép Trưởng phòng / Quản lý tự duyệt đơn chấm công của chính mình)
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name, u.avatar_url as employee_avatar, u.team_id,
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
                    'employee_avatar' => $b['employee_avatar'] ?? null,
                    'user_id' => (int)$b['user_id'],
                    'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                    'approver_id_2' => (int)($b['approver2_id'] ?? 0),
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
            SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.unpaid_days, l.reason, l.status, l.created_at,
                   l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids, u.full_name as employee_name, u.avatar_url as employee_avatar,
                   l.approved_by, l.approved_at,
                   l.salary_rate, l.ot_type, l.ot_rate,
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

            $rawReason = $l['reason'] ?? '';
            $cleanReason = self::cleanLeaveReason($rawReason);
            $l['reason'] = $cleanReason;
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
                'unpaid_days' => isset($l['unpaid_days']) ? (float)$l['unpaid_days'] : 0.0,
                'salary_rate' => isset($l['salary_rate']) ? (float)$l['salary_rate'] : 50.0,
                'ot_type' => $l['ot_type'] ?? null,
                'ot_rate' => isset($l['ot_rate']) ? (float)$l['ot_rate'] : null,
                'leave_type' => $l['leave_type'],
                'reason' => $cleanReason,
                'raw_reason' => $rawReason,
                'title' => self::formatLeaveTitle($l),
                'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ).' . ($cleanReason ? ' Lý do: "' . $cleanReason . '"' : ''),
                'status' => $statusText,
                'created_at' => $l['created_at']
            ];
        }

        // 2. My Advances
        $stmtAdvances = $this->db->prepare("
            SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
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
                'reason' => $a['reason'] ?? '',
                'raw_reason' => $a['reason'] ?? '',
                'request_date' => $a['request_date'] ?? null,
                'title' => 'Đề xuất tạm ứng lương',
                'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                'status' => $statusText,
                'created_at' => $a['created_at']
            ];
        }

        // 3. My Expenses
        $stmtExpenses = $this->db->prepare("
            SELECT e.*, e.notes as description, e.created_by as user_id, u.full_name as employee_name, u.avatar_url as employee_avatar,
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
            WHERE (e.created_by = ? OR u.id = ?) AND e.tenant_id = ? AND e.deleted_at IS NULL
            ORDER BY e.created_at DESC
            LIMIT 200
        ");
        $stmtExpenses->execute([$userId, $userId, $auth['tenant_id']]);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        $entitiesByExp = $this->batchLoadExpenseEntities(array_column($expenses, 'id'));
        foreach ($expenses as $e) {
            $isZeroAmt = (float)($e['amount'] ?? 0) == 0;
            $displayTitle = $e['title'];
            if (!$isZeroAmt && !str_starts_with(mb_strtolower($e['title']), 'đề xuất') && !str_starts_with(mb_strtolower($e['title']), 'đề nghị') && !str_starts_with(mb_strtolower($e['title']), 'yêu cầu')) {
                $displayTitle = 'Yêu cầu chi phí: ' . $e['title'];
            }
            
            $displayDesc = $e['notes'] ?: $e['description'] ?: '';

            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$e['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $pending[] = [
                'id' => (int)$e['id'],
                'type' => 'expense',
                'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['user_id']),
                'employee_avatar' => $e['employee_avatar'] ?? null,
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
                'approved_at_2' => $e['approved_at_2'] ?? null,
                'approved_at_3' => $e['approved_at_3'] ?? null,
                'approval_steps' => !empty($e['approval_steps']) ? (is_string($e['approval_steps']) ? json_decode($e['approval_steps'], true) : $e['approval_steps']) : null,
                'status_level_1' => $e['status_level_1'] ?? 'pending',
                'status_level_2' => $e['status_level_2'] ?? 'none',
                'status_level_3' => $e['status_level_3'] ?? 'none',
                'related_user_ids' => $relArr,
                'image_url' => $e['image_url'] ?? null,
                'items' => !empty($e['items']) ? (is_string($e['items']) ? json_decode($e['items'], true) : $e['items']) : [],
                'entities' => $entitiesByExp[(int)$e['id']] ?? [],
                'title' => $displayTitle,
                'raw_title' => $e['title'],
                'description' => $displayDesc,
                'amount' => (float)$e['amount'],
                'currency' => self::detectExpenseCurrency($e['title'], $e['notes'] ?? '', $e['items'] ?? null, $e['currency'] ?? 'VND'),
                'category' => $e['category'] ?? 'Vận hành',
                'date' => $e['date'] ?? null,
                'due_date' => $e['due_date'] ?? null,
                'vat_amount' => isset($e['vat_amount']) ? (float)$e['vat_amount'] : 0.0,
                'vendor_name' => $e['vendor_name'] ?? null,
                'has_vat_invoice' => (int)($e['has_vat_invoice'] ?? 0),
                'is_vat_inclusive' => (int)($e['is_vat_inclusive'] ?? 0),
                'reject_reason' => $e['reject_reason'] ?? null,
                'notes' => $e['notes'] ?? '',
                'status' => $e['status'],
                'is_refunded' => (int)($e['is_refunded'] ?? 0),
                'refunded_at' => $e['refunded_at'] ?? null,
                'created_at' => $e['created_at']
            ];
        }

        // 4. My Checkins (Chỉ lấy đơn bổ sung chấm công thủ công, tuyệt đối không lấy chấm công thường/đi trễ/ngoài bán kính)
        self::healPollutedCheckIns($this->db);
        $phuongMyId = 0;
        try {
            $stmtHrMyP = $this->db->prepare("SELECT id FROM users WHERE (username = 'phuongntd' OR full_name LIKE '%Duy Phương%' OR role = 'hr') LIMIT 1");
            $stmtHrMyP->execute();
            $phuongMyId = (int)$stmtHrMyP->fetchColumn();
        } catch (\Throwable $eMyP) {}

        $stmtCheckins = $this->db->prepare("
            SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, 
                   CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, c.manager_id, c.approved_by,
                   u.full_name as employee_name, u.avatar_url as employee_avatar, u.team_id,
                   m.full_name as approver_name, m.avatar_url as approver_avatar,
                   t_lead.id as team_leader_id, t_lead.full_name as team_leader_name, t_lead.avatar_url as team_leader_avatar,
                   ap.full_name as approved_by_name, ap.avatar_url as approved_by_avatar
            FROM check_ins c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN users m ON c.manager_id = m.id
            LEFT JOIN teams t ON u.team_id = t.id
            LEFT JOIN users t_lead ON t.leader_id = t_lead.id
            LEFT JOIN users ap ON c.approved_by = ap.id
            WHERE c.user_id = ?
              AND (c.selfie_url IS NULL OR TRIM(c.selfie_url) = '')
              AND COALESCE(c.late_minutes, 0) = 0
              AND c.reason IS NOT NULL
              AND TRIM(c.reason) != ''
              AND c.reason NOT LIKE 'Duyệt%'
              AND c.reason NOT LIKE 'Tự động%'
              AND c.reason NOT LIKE '%Ngoài bán kính%'
              AND c.reason NOT LIKE '%Không có tọa độ GPS%'
              AND (
                  c.status = 'pending_approval'
                  OR (c.status IN ('approved', 'rejected') AND c.approved_by IS NOT NULL)
              )
            ORDER BY c.id DESC
            LIMIT 100
        ");
        $stmtCheckins->execute([$userId]);
        $checkins = $stmtCheckins->fetchAll(PDO::FETCH_ASSOC);
        foreach ($checkins as $c) {
            $title = 'Bổ sung chấm công ngày ' . $c['check_in_date'];
            $desc = 'Bổ sung chấm công (Check-in lúc ' . $c['check_in_time'] . '). Lý do: "' . ($c['reason'] ?: 'Quên chấm công') . '"';
            $mgrId = (int)($c['manager_id'] ?: $c['team_leader_id'] ?: 0);
            $mgrName = $c['approver_name'] ?: $c['team_leader_name'] ?: null;
            $mgrAvatar = $c['approver_avatar'] ?: $c['team_leader_avatar'] ?: null;

            $pending[] = [
                'id' => (int)$c['id'],
                'type' => 'checkin',
                'employee_name' => $c['employee_name'],
                'employee_avatar' => $c['employee_avatar'] ?? null,
                'user_id' => (int)$c['user_id'],
                'manager_id' => $mgrId ?: null,
                'approver_id' => $mgrId ?: null,
                'approver_name' => $mgrName,
                'approver_avatar' => $mgrAvatar,
                'related_user_ids' => $phuongMyId > 0 ? [$phuongMyId] : [],
                'approved_by' => !empty($c['approved_by']) ? (int)$c['approved_by'] : null,
                'approved_by_name' => $c['approved_by_name'] ?? null,
                'approved_by_avatar' => $c['approved_by_avatar'] ?? null,
                'title' => $title,
                'description' => $desc,
                'status' => $c['status'],
                'created_at' => $c['created_at']
            ];
        }

        // 5. My Bulk Attendance Requests
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
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
                'approver_id_2' => (int)($b['approver2_id'] ?? 0),
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

        // 1. Leaves where user is in related_user_ids or user is HR (excluding leaves created by self and drafts)
        if ($role === 'hr') {
            $stmtLeaves = $this->db->prepare("
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.unpaid_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       l.approved_by, l.approved_at,
                       l.salary_rate, l.ot_type, l.ot_rate,
                       u.full_name as employee_name, u.avatar_url as employee_avatar,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND l.user_id != ? AND l.status != 'draft'
                ORDER BY l.created_at DESC
                LIMIT 200
            ");
            $stmtLeaves->execute([$auth['tenant_id'], $userId]);
        } else {
            $stmtLeaves = $this->db->prepare("
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.unpaid_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       l.approved_by, l.approved_at,
                       l.salary_rate, l.ot_type, l.ot_rate,
                       u.full_name as employee_name, u.avatar_url as employee_avatar,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND l.user_id != ? AND l.status != 'draft' AND (l.related_user_ids LIKE ? OR l.related_user_ids LIKE ?)
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
                $rawReason = $l['reason'] ?? '';
                $cleanReason = self::cleanLeaveReason($rawReason);
                $l['reason'] = $cleanReason;
                $pending[] = [
                    'id' => (int)$l['id'],
                    'type' => 'leave',
                    'employee_name' => $l['employee_name'],
                    'employee_avatar' => $l['employee_avatar'] ?? null,
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
                    'start_date' => $l['start_date'] ?? null,
                    'end_date' => $l['end_date'] ?? null,
                    'total_days' => isset($l['total_days']) ? (float)$l['total_days'] : null,
                    'unpaid_days' => isset($l['unpaid_days']) ? (float)$l['unpaid_days'] : 0.0,
                    'salary_rate' => isset($l['salary_rate']) ? (float)$l['salary_rate'] : 50.0,
                    'ot_type' => $l['ot_type'] ?? null,
                    'ot_rate' => isset($l['ot_rate']) ? (float)$l['ot_rate'] : null,
                    'leave_type' => $l['leave_type'] ?? null,
                    'reason' => $cleanReason,
                    'raw_reason' => $rawReason,
                    'related_user_ids' => array_values($relArr),
                    'title' => self::formatLeaveTitle($l),
                    'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ).' . ($cleanReason ? ' Lý do: "' . $cleanReason . '"' : ''),
                    'status' => $statusText,
                    'created_at' => $l['created_at'],
                    'is_following' => true
                ];
            }
        }

        // 2. Advances where user is in related_user_ids (excluding drafts)
        $stmtAdvances = $this->db->prepare("
            SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users u_app1 ON a.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON a.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON a.approved_by = u_real.id
            WHERE u.tenant_id = ? AND a.user_id != ? AND a.status != 'draft' AND (a.related_user_ids LIKE ? OR a.related_user_ids LIKE ?)
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
                    'employee_avatar' => $a['employee_avatar'] ?? null,
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
                    'related_user_ids' => array_values($relArr),
                    'amount' => (float)$a['amount'],
                    'reason' => $a['reason'] ?? '',
                    'raw_reason' => $a['reason'] ?? '',
                    'request_date' => $a['request_date'] ?? null,
                    'title' => 'Đề xuất tạm ứng lương',
                    'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                    'status' => $statusText,
                    'created_at' => $a['created_at'],
                    'is_following' => true
                ];
            }
        }

        // 3. Expenses where user is in related_user_ids (excluding drafts)
        $stmtExpenses = $this->db->prepare("
            SELECT e.*, e.notes as description, e.created_by as user_id,
                   u.full_name as employee_name, u.avatar_url as employee_avatar,
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
            WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND e.status != 'draft' AND e.created_by != ? AND (e.related_user_ids LIKE ? OR e.related_user_ids LIKE ?)
            ORDER BY e.created_at DESC
            LIMIT 200
        ");
        $stmtExpenses->execute([$auth['tenant_id'], $userId, '%"' . $userId . '"%', '%' . $userId . '%']);
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        $entitiesByExp = $this->batchLoadExpenseEntities(array_column($expenses, 'id'));
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
                
                $displayDesc = $e['notes'] ?: $e['description'] ?: '';

                $pending[] = [
                    'id' => (int)$e['id'],
                    'type' => 'expense',
                    'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['user_id']),
                    'employee_avatar' => $e['employee_avatar'] ?? null,
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
                    'approved_at_2' => $e['approved_at_2'] ?? null,
                    'approved_at_3' => $e['approved_at_3'] ?? null,
                    'approval_steps' => !empty($e['approval_steps']) ? (is_string($e['approval_steps']) ? json_decode($e['approval_steps'], true) : $e['approval_steps']) : null,
                    'status_level_1' => $e['status_level_1'] ?? 'pending',
                    'status_level_2' => $e['status_level_2'] ?? 'none',
                    'status_level_3' => $e['status_level_3'] ?? 'none',
                    'related_user_ids' => $relArr,
                    'image_url' => $e['image_url'] ?? null,
                    'items' => !empty($e['items']) ? (is_string($e['items']) ? json_decode($e['items'], true) : $e['items']) : [],
                    'entities' => $entitiesByExp[(int)$e['id']] ?? [],
                    'title' => $displayTitle,
                    'raw_title' => $e['title'],
                    'description' => $displayDesc,
                    'amount' => (float)$e['amount'],
                    'currency' => self::detectExpenseCurrency($e['title'], $e['notes'] ?? '', $e['items'] ?? null, $e['currency'] ?? 'VND'),
                    'category' => $e['category'] ?? 'Vận hành',
                    'date' => $e['date'] ?? null,
                    'due_date' => $e['due_date'] ?? null,
                    'vat_amount' => isset($e['vat_amount']) ? (float)$e['vat_amount'] : 0.0,
                    'vendor_name' => $e['vendor_name'] ?? null,
                    'has_vat_invoice' => (int)($e['has_vat_invoice'] ?? 0),
                    'is_vat_inclusive' => (int)($e['is_vat_inclusive'] ?? 0),
                    'reject_reason' => $e['reject_reason'] ?? null,
                    'notes' => $e['notes'] ?? '',
                    'status' => $e['status'],
                    'is_refunded' => (int)($e['is_refunded'] ?? 0),
                    'refunded_at' => $e['refunded_at'] ?? null,
                    'created_at' => $e['created_at'],
                    'is_following' => true
                ];
            }
        }

        // 4. Bulk Attendance Requests where user is in related_user_ids (excluding drafts)
        $stmtBulks = $this->db->prepare("
            SELECT r.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
                   u_mgr.full_name as manager_name,
                   u_app.full_name as approved_by_name,
                   (SELECT COUNT(*) FROM attendance_bulk_request_details WHERE request_id = r.id) as days_count,
                   (SELECT check_in_date FROM attendance_bulk_request_details WHERE request_id = r.id ORDER BY check_in_date ASC LIMIT 1) as single_date,
                   (SELECT reason FROM attendance_bulk_request_details WHERE request_id = r.id AND reason IS NOT NULL AND reason != '' LIMIT 1) as first_reason
            FROM attendance_bulk_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users u_mgr ON r.manager_id = u_mgr.id
            LEFT JOIN users u_app ON r.approved_by = u_app.id
            WHERE u.tenant_id = ? AND r.user_id != ? AND r.status != 'draft' AND (r.related_user_ids LIKE ? OR r.related_user_ids LIKE ?)
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
                    'employee_avatar' => $b['employee_avatar'] ?? null,
                    'user_id' => (int)$b['user_id'],
                    'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                    'approver_id_2' => (int)($b['approver2_id'] ?? 0),
                    'manager_id' => (int)($b['manager_id'] ?? 0),
                    'manager_name' => $b['manager_name'] ?? null,
                    'approved_by' => (int)($b['approved_by'] ?? 0),
                    'approved_by_name' => $b['approved_by_name'] ?? null,
                    'approved_at' => $b['approved_at'] ?? null,
                    'related_user_ids' => array_values($relArr),
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
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'executive'], true);
        $isHrAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'executive', 'hr', 'nhan_su'], true);
        $isFinanceAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'executive', 'accountant', 'ke_toan', 'finance'], true);

        $isManagerOrLeader = in_array($role, ['manager', 'leader', 'head_of_department', 'truongphong', 'quanly', 'assistant', 'tro_ly'], true);
        $managedUserIds = [];
        if ($isManagerOrLeader) {
            $stmtL = $this->db->prepare("SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))");
            $stmtL->execute([$userId, $userId]);
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
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.unpaid_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       l.approved_by, l.approved_at,
                       l.salary_rate, l.ot_type, l.ot_rate,
                       u.full_name as employee_name, u.avatar_url as employee_avatar,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND (l.status != 'draft' OR l.user_id = ?)
                ORDER BY l.created_at DESC
                LIMIT 500
            ");
            $stmtLeaves->execute([$auth['tenant_id'], $userId]);
        } else {
            $conds = ["l.user_id = ?", "l.approver_id = ?", "l.approver_id_2 = ?", "l.related_user_ids LIKE ?", "l.related_user_ids LIKE ?"];
            $pL = [$auth['tenant_id'], $userId, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            if (!empty($managedUserIds)) {
                $mPh = implode(',', array_fill(0, count($managedUserIds), '?'));
                $conds[] = "l.user_id IN ($mPh)";
                $pL = array_merge($pL, $managedUserIds);
            }
            $sqlL = "
                SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.unpaid_days, l.reason, l.status, l.created_at,
                       l.status_level_1, l.status_level_2, l.approver_id, l.approver_id_2, l.user_id, l.related_user_ids,
                       l.approved_by, l.approved_at,
                       l.salary_rate, l.ot_type, l.ot_rate,
                       u.full_name as employee_name, u.avatar_url as employee_avatar,
                       ap1.full_name as approver_name,
                       ap2.full_name as approver_name_2,
                       app_by.full_name as approved_by_name
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                LEFT JOIN users ap1 ON l.approver_id = ap1.id
                LEFT JOIN users ap2 ON l.approver_id_2 = ap2.id
                LEFT JOIN users app_by ON l.approved_by = app_by.id
                WHERE u.tenant_id = ? AND (l.status != 'draft' OR l.user_id = ?) AND (" . implode(' OR ', $conds) . ")
                ORDER BY l.created_at DESC LIMIT 500";
            $stmtLeaves = $this->db->prepare($sqlL);
            $stmtLeaves->execute($pL);
        }
        $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);
        foreach ($leaves as $l) {
            $relArr = !empty($l['related_user_ids']) ? (is_array($l['related_user_ids']) ? $l['related_user_ids'] : json_decode($l['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$l['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $isCreator = ((int)$l['user_id'] === $userId);
            $isApprover = ((int)($l['approver_id'] ?? 0) === $userId || (int)($l['approver_id_2'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            $isManagerOfUser = in_array((int)$l['user_id'], $managedUserIds, true);
            if (!$isHrAdmin && !$isCreator && !$isApprover && !$isRelated && !$isManagerOfUser) {
                continue;
            }
            if (($l['status'] ?? '') === 'draft' && !$isCreator) {
                continue;
            }

            $rawReason = $l['reason'] ?? '';
            $cleanReason = self::cleanLeaveReason($rawReason);
            $l['reason'] = $cleanReason;
            $all[] = [
                'id' => (int)$l['id'],
                'type' => 'leave',
                'employee_name' => $l['employee_name'],
                'employee_avatar' => $l['employee_avatar'] ?? null,
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
                'start_date' => $l['start_date'] ?? null,
                'end_date' => $l['end_date'] ?? null,
                'total_days' => isset($l['total_days']) ? (float)$l['total_days'] : null,
                'unpaid_days' => isset($l['unpaid_days']) ? (float)$l['unpaid_days'] : 0.0,
                'salary_rate' => isset($l['salary_rate']) ? (float)$l['salary_rate'] : 50.0,
                'ot_type' => $l['ot_type'] ?? null,
                'ot_rate' => isset($l['ot_rate']) ? (float)$l['ot_rate'] : null,
                'leave_type' => $l['leave_type'] ?? null,
                'reason' => $cleanReason,
                'raw_reason' => $rawReason,
                'related_user_ids' => $relArr,
                'title' => self::formatLeaveTitle($l),
                'description' => 'Thời gian: ' . $l['start_date'] . ' -> ' . $l['end_date'] . ' (' . $l['total_days'] . ' ngày/giờ).' . ($cleanReason ? ' Lý do: "' . $cleanReason . '"' : ''),
                'status' => $l['status'],
                'created_at' => $l['created_at']
            ];
        }

        // 2. All Advances
        $advSelect = "
            SELECT a.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
                   u_app1.full_name as approver_name,
                   u_app2.full_name as approver_name_2,
                   u_real.full_name as approved_by_name
            FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN users u_app1 ON a.approver_id = u_app1.id
            LEFT JOIN users u_app2 ON a.approver_id_2 = u_app2.id
            LEFT JOIN users u_real ON a.approved_by = u_real.id
        ";
        if ($isFinanceAdmin) {
            $stmtAdvances = $this->db->prepare($advSelect . "
                WHERE u.tenant_id = ? AND (a.status != 'draft' OR a.user_id = ?)
                ORDER BY a.created_at DESC
                LIMIT 500
            ");
            $stmtAdvances->execute([$auth['tenant_id'], $userId]);
        } else {
            $conds = ["a.user_id = ?", "a.approver_id = ?", "a.approver_id_2 = ?", "a.related_user_ids LIKE ?", "a.related_user_ids LIKE ?"];
            $pA = [$auth['tenant_id'], $userId, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            if (!empty($managedUserIds)) {
                $mPh = implode(',', array_fill(0, count($managedUserIds), '?'));
                $conds[] = "a.user_id IN ($mPh)";
                $pA = array_merge($pA, $managedUserIds);
            }
            $sqlA = $advSelect . "
                WHERE u.tenant_id = ? AND (a.status != 'draft' OR a.user_id = ?) AND (" . implode(' OR ', $conds) . ")
                ORDER BY a.created_at DESC LIMIT 500";
            $stmtAdvances = $this->db->prepare($sqlA);
            $stmtAdvances->execute($pA);
        }
        $advances = $stmtAdvances->fetchAll(PDO::FETCH_ASSOC);
        foreach ($advances as $a) {
            $relArr = !empty($a['related_user_ids']) ? (is_array($a['related_user_ids']) ? $a['related_user_ids'] : json_decode($a['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$a['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $isCreator = ((int)$a['user_id'] === $userId);
            $isApprover = ((int)($a['approver_id'] ?? 0) === $userId || (int)($a['approver_id_2'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            $isManagerOfUser = in_array((int)$a['user_id'], $managedUserIds, true);
            if (!$isFinanceAdmin && !$isCreator && !$isApprover && !$isRelated && !$isManagerOfUser) {
                continue;
            }
            if (($a['status'] ?? '') === 'draft' && !$isCreator) {
                continue;
            }

            $all[] = [
                'id' => (int)$a['id'],
                'type' => 'advance',
                'employee_name' => $a['employee_name'],
                'employee_avatar' => $a['employee_avatar'] ?? null,
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
                'reason' => $a['reason'] ?? '',
                'raw_reason' => $a['reason'] ?? '',
                'request_date' => $a['request_date'] ?? null,
                'title' => 'Đề xuất tạm ứng lương',
                'description' => 'Số tiền: ' . number_format($a['amount'], 0, ',', '.') . 'đ. Lý do: "' . $a['reason'] . '"',
                'status' => $a['status'],
                'created_at' => $a['created_at']
            ];
        }

        // 3. All Expenses
        $expSelect = "
            SELECT e.*, e.notes as description, e.created_by as user_id,
                   u.full_name as employee_name, u.avatar_url as employee_avatar,
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
        ";

        if ($isFinanceAdmin) {
            $stmtExpenses = $this->db->prepare($expSelect . "
                WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND (e.status != 'draft' OR e.created_by = ?)
                ORDER BY e.created_at DESC
                LIMIT 500
            ");
            $stmtExpenses->execute([$auth['tenant_id'], $userId]);
        } else {
            $conds = ["e.created_by = ?", "e.approver_id = ?", "e.approver_id_2 = ?", "e.approver_id_3 = ?", "e.related_user_ids LIKE ?", "e.related_user_ids LIKE ?"];
            $pE = [$auth['tenant_id'], $userId, $userId, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            if (!empty($managedUserIds)) {
                $mPh = implode(',', array_fill(0, count($managedUserIds), '?'));
                $conds[] = "e.created_by IN ($mPh)";
                $pE = array_merge($pE, $managedUserIds);
            }
            $sqlE = $expSelect . "
                WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND (e.status != 'draft' OR e.created_by = ?) AND (" . implode(' OR ', $conds) . ")
                ORDER BY e.created_at DESC LIMIT 500";
            $stmtExpenses = $this->db->prepare($sqlE);
            $stmtExpenses->execute($pE);
        }
        $expenses = $stmtExpenses->fetchAll(PDO::FETCH_ASSOC);
        $entitiesByExp = $this->batchLoadExpenseEntities(array_column($expenses, 'id'));
        foreach ($expenses as $e) {
            $relArr = !empty($e['related_user_ids']) ? (is_array($e['related_user_ids']) ? $e['related_user_ids'] : json_decode($e['related_user_ids'], true)) : [];
            if (!is_array($relArr)) {
                $relArr = explode(',', (string)$e['related_user_ids']);
            }
            $relArr = array_values(array_filter(array_map('intval', (array)$relArr)));

            $isCreator = ((int)$e['user_id'] === $userId);
            $isApprover = ((int)($e['approver_id'] ?? 0) === $userId || (int)($e['approver_id_2'] ?? 0) === $userId || (int)($e['approver_id_3'] ?? 0) === $userId);
            $isRelated = in_array($userId, $relArr, true);
            $isManagerOfUser = in_array((int)$e['user_id'], $managedUserIds, true);
            if (!$isFinanceAdmin && !$isCreator && !$isApprover && !$isRelated && !$isManagerOfUser) {
                continue;
            }
            if (($e['status'] ?? '') === 'draft' && !$isCreator) {
                continue;
            }

            $isZeroAmt = (float)($e['amount'] ?? 0) == 0;
            $displayTitle = $e['title'];
            if (!$isZeroAmt && !str_starts_with(mb_strtolower($e['title']), 'đề xuất') && !str_starts_with(mb_strtolower($e['title']), 'đề nghị') && !str_starts_with(mb_strtolower($e['title']), 'yêu cầu')) {
                $displayTitle = 'Yêu cầu chi phí: ' . $e['title'];
            }
            
            $displayDesc = $e['notes'] ?: $e['description'] ?: '';

            $all[] = [
                'id' => (int)$e['id'],
                'type' => 'expense',
                'employee_name' => $e['employee_name'] ?? ('Người dùng #' . $e['user_id']),
                'employee_avatar' => $e['employee_avatar'] ?? null,
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
                'approved_at_2' => $e['approved_at_2'] ?? null,
                'approved_at_3' => $e['approved_at_3'] ?? null,
                'approval_steps' => !empty($e['approval_steps']) ? (is_string($e['approval_steps']) ? json_decode($e['approval_steps'], true) : $e['approval_steps']) : null,
                'status_level_1' => $e['status_level_1'] ?? 'pending',
                'status_level_2' => $e['status_level_2'] ?? 'none',
                'status_level_3' => $e['status_level_3'] ?? 'none',
                'related_user_ids' => $relArr,
                'image_url' => $e['image_url'] ?? null,
                'items' => !empty($e['items']) ? (is_string($e['items']) ? json_decode($e['items'], true) : $e['items']) : [],
                'entities' => $entitiesByExp[(int)$e['id']] ?? [],
                'title' => $displayTitle,
                'raw_title' => $e['title'],
                'description' => $displayDesc,
                'amount' => (float)$e['amount'],
                'currency' => self::detectExpenseCurrency($e['title'], $e['notes'] ?? '', $e['items'] ?? null, $e['currency'] ?? 'VND'),
                'category' => $e['category'] ?? 'Vận hành',
                'date' => $e['date'] ?? null,
                'due_date' => $e['due_date'] ?? null,
                'vat_amount' => isset($e['vat_amount']) ? (float)$e['vat_amount'] : 0.0,
                'vendor_name' => $e['vendor_name'] ?? null,
                'has_vat_invoice' => (int)($e['has_vat_invoice'] ?? 0),
                'is_vat_inclusive' => (int)($e['is_vat_inclusive'] ?? 0),
                'reject_reason' => $e['reject_reason'] ?? null,
                'notes' => $e['notes'] ?? '',
                'status' => $e['status'],
                'is_refunded' => (int)($e['is_refunded'] ?? 0),
                'refunded_at' => $e['refunded_at'] ?? null,
                'created_at' => $e['created_at']
            ];
        }

        // 4. All Checkins - CHỈ LẤY ĐƠN BỔ SUNG CHẤM CÔNG THỦ CÔNG (Loại bỏ giải trình đi trễ và ngoài bán kính)
        self::healPollutedCheckIns($this->db);
        $condCheckin = "c.status = 'pending_approval' 
            AND (c.selfie_url IS NULL OR TRIM(c.selfie_url) = '')
            AND COALESCE(c.late_minutes, 0) = 0
            AND c.reason IS NOT NULL
            AND TRIM(c.reason) != ''
            AND c.reason NOT LIKE '%Ngoài bán kính%'
            AND c.reason NOT LIKE '%Không có tọa độ GPS%'";
        
        $phuongAllId = 0;
        try {
            $stmtHrAllP = $this->db->prepare("SELECT id FROM users WHERE (username = 'phuongntd' OR full_name LIKE '%Duy Phương%' OR role = 'hr') LIMIT 1");
            $stmtHrAllP->execute();
            $phuongAllId = (int)$stmtHrAllP->fetchColumn();
        } catch (\Throwable $eAllP) {}

        if ($isHrAdmin) {
            $stmtCheckins = $this->db->prepare("
                SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, 
                       CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, c.manager_id, c.approved_by,
                       u.full_name as employee_name, u.avatar_url as employee_avatar, u.team_id,
                       m.full_name as approver_name, m.avatar_url as approver_avatar,
                       t_lead.id as team_leader_id, t_lead.full_name as team_leader_name, t_lead.avatar_url as team_leader_avatar,
                       ap.full_name as approved_by_name, ap.avatar_url as approved_by_avatar
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN users m ON c.manager_id = m.id
                LEFT JOIN teams t ON u.team_id = t.id
                LEFT JOIN users t_lead ON t.leader_id = t_lead.id
                LEFT JOIN users ap ON c.approved_by = ap.id
                WHERE u.tenant_id = ? AND $condCheckin
                ORDER BY c.id DESC
                LIMIT 500
            ");
            $stmtCheckins->execute([$auth['tenant_id']]);
        } else {
            $conds = ["c.user_id = ?"];
            $pC = [$auth['tenant_id'], $userId];
            if (!empty($managedUserIds)) {
                $mPh = implode(',', array_fill(0, count($managedUserIds), '?'));
                $conds[] = "c.user_id IN ($mPh)";
                $pC = array_merge($pC, $managedUserIds);
            }
            $sqlC = "
                SELECT c.id, c.check_in_date, c.check_in_time, c.late_minutes, c.reason, c.status, 
                       CONCAT(c.check_in_date, ' ', c.check_in_time) as created_at, c.user_id, c.manager_id, c.approved_by,
                       u.full_name as employee_name, u.avatar_url as employee_avatar, u.team_id,
                       m.full_name as approver_name, m.avatar_url as approver_avatar,
                       t_lead.id as team_leader_id, t_lead.full_name as team_leader_name, t_lead.avatar_url as team_leader_avatar,
                       ap.full_name as approved_by_name, ap.avatar_url as approved_by_avatar
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN users m ON c.manager_id = m.id
                LEFT JOIN teams t ON u.team_id = t.id
                LEFT JOIN users t_lead ON t.leader_id = t_lead.id
                LEFT JOIN users ap ON c.approved_by = ap.id
                WHERE u.tenant_id = ? AND $condCheckin AND (" . implode(' OR ', $conds) . ")
                ORDER BY c.id DESC LIMIT 500";
            $stmtCheckins = $this->db->prepare($sqlC);
            $stmtCheckins->execute($pC);
        }
        $checkins = $stmtCheckins->fetchAll(PDO::FETCH_ASSOC);
        foreach ($checkins as $c) {
            $title = 'Bổ sung chấm công ngày ' . $c['check_in_date'];
            $desc = 'Bổ sung chấm công (Check-in lúc ' . $c['check_in_time'] . '). Lý do: "' . ($c['reason'] ?: 'Quên chấm công') . '"';
            $mgrId = (int)($c['manager_id'] ?: $c['team_leader_id'] ?: 0);
            $mgrName = $c['approver_name'] ?: $c['team_leader_name'] ?: null;
            $mgrAvatar = $c['approver_avatar'] ?: $c['team_leader_avatar'] ?: null;

            $all[] = [
                'id' => (int)$c['id'],
                'type' => 'checkin',
                'employee_name' => $c['employee_name'],
                'employee_avatar' => $c['employee_avatar'] ?? null,
                'user_id' => (int)$c['user_id'],
                'manager_id' => $mgrId ?: null,
                'approver_id' => $mgrId ?: null,
                'approver_name' => $mgrName,
                'approver_avatar' => $mgrAvatar,
                'related_user_ids' => $phuongAllId > 0 ? [$phuongAllId] : [],
                'approved_by' => $c['approved_by'] ? (int)$c['approved_by'] : null,
                'approved_by_name' => $c['approved_by_name'] ?? null,
                'approved_by_avatar' => $c['approved_by_avatar'] ?? null,
                'title' => $title,
                'description' => $desc,
                'status' => $c['status'],
                'created_at' => $c['created_at']
            ];
        }

        // 5. All Bulk Attendance Requests
        $bulkSelect = "
            SELECT r.*, u.full_name as employee_name, u.avatar_url as employee_avatar,
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
                WHERE u.tenant_id = ? AND (r.status != 'draft' OR r.user_id = ?)
                ORDER BY r.created_at DESC
                LIMIT 500
            ");
            $stmtBulks->execute([$auth['tenant_id'], $userId]);
        } else {
            $conds = ["r.user_id = ?", "r.manager_id = ?", "r.approved_by = ?", "r.related_user_ids LIKE ?", "r.related_user_ids LIKE ?"];
            $pB = [$auth['tenant_id'], $userId, $userId, $userId, $userId, '%"' . $userId . '"%', '%' . $userId . '%'];
            if (!empty($managedUserIds)) {
                $mPh = implode(',', array_fill(0, count($managedUserIds), '?'));
                $conds[] = "r.user_id IN ($mPh)";
                $pB = array_merge($pB, $managedUserIds);
            }
            $sqlB = $bulkSelect . "
                WHERE u.tenant_id = ? AND (r.status != 'draft' OR r.user_id = ?) AND (" . implode(' OR ', $conds) . ")
                ORDER BY r.created_at DESC LIMIT 500";
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
            $isManagerOfUser = in_array((int)$b['user_id'], $managedUserIds, true);
            if (!$isHrAdmin && !$isCreator && !$isApprover && !$isRelated && !$isManagerOfUser) {
                continue;
            }
            if (($b['status'] ?? '') === 'draft' && !$isCreator) {
                continue;
            }
            list($bTitle, $bDesc) = self::formatBulkTitleAndDesc($b);
            $all[] = [
                'id' => (int)$b['id'],
                'type' => 'attendance_bulk',
                'employee_name' => $b['employee_name'],
                'employee_avatar' => $b['employee_avatar'] ?? null,
                'user_id' => (int)$b['user_id'],
                'approver_id' => (int)($b['approved_by'] ?? $b['manager_id'] ?? 0),
                'approver_id_2' => (int)($b['approver2_id'] ?? 0),
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

        // 6. Purchase Orders (PO waiting approval)
        $poSelect = "
            SELECT po.*, s.name as supplier_name, u.full_name as creator_name, u.avatar_url as creator_avatar,
                   app1.full_name as approver_name,
                   app2.full_name as approver_name_2,
                   app3.full_name as approver_name_3
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            JOIN users u ON po.created_by = u.id
            LEFT JOIN users app1 ON po.approver_id = app1.id
            LEFT JOIN users app2 ON po.approver_id_2 = app2.id
            LEFT JOIN users app3 ON po.approver_id_3 = app3.id
        ";
        if ($isFinanceAdmin || $isGlobalAdmin) {
            $stmtPOs = $this->db->prepare($poSelect . "
                WHERE po.tenant_id = ? AND (po.status != 'draft' OR po.created_by = ?)
                ORDER BY po.created_at DESC
                LIMIT 300
            ");
            $stmtPOs->execute([$auth['tenant_id'], $userId]);
        } else {
            $conds = ["po.created_by = ?", "po.approver_id = ?", "po.approver_id_2 = ?", "po.approver_id_3 = ?"];
            $pPO = [$auth['tenant_id'], $userId, $userId, $userId, $userId, $userId];
            if (!empty($managedUserIds)) {
                $mPh = implode(',', array_fill(0, count($managedUserIds), '?'));
                $conds[] = "po.created_by IN ($mPh)";
                $pPO = array_merge($pPO, $managedUserIds);
            }
            $sqlPO = $poSelect . "
                WHERE po.tenant_id = ? AND (po.status != 'draft' OR po.created_by = ?) AND (" . implode(' OR ', $conds) . ")
                ORDER BY po.created_at DESC LIMIT 300";
            $stmtPOs = $this->db->prepare($sqlPO);
            $stmtPOs->execute($pPO);
        }
        $pos = $stmtPOs->fetchAll(PDO::FETCH_ASSOC);
        foreach ($pos as $p) {
            if (($p['status'] ?? '') === 'draft' && (int)$p['created_by'] !== $userId) {
                continue;
            }
            $relArr = !empty($p['related_user_ids']) ? array_filter(array_map('intval', explode(',', (string)$p['related_user_ids']))) : [];
            $isPoApproved = ($p['approval_status'] === 'approved') || in_array($p['status'], ['ordered', 'received'], true) || ($p['status_level_1'] === 'approved' && empty($p['approver_id_2']) && $p['status'] !== 'draft');
            $all[] = [
                'id' => (int)$p['id'],
                'type' => 'po',
                'employee_name' => $p['creator_name'],
                'employee_avatar' => $p['creator_avatar'] ?? null,
                'user_id' => (int)$p['created_by'],
                'created_by' => (int)$p['created_by'],
                'approver_id' => (int)($p['approver_id'] ?? 0),
                'approver_id_2' => (int)($p['approver_id_2'] ?? 0),
                'approver_id_3' => (int)($p['approver_id_3'] ?? 0),
                'approver_name' => $p['approver_name'] ?? null,
                'approver_name_2' => $p['approver_name_2'] ?? null,
                'approver_name_3' => $p['approver_name_3'] ?? null,
                'status_level_1' => $p['status_level_1'] ?? 'pending',
                'status_level_2' => $p['status_level_2'] ?? 'none',
                'status_level_3' => $p['status_level_3'] ?? 'none',
                'approval_status' => $isPoApproved ? 'approved' : ($p['approval_status'] ?? 'pending'),
                'amount' => (float)($p['total'] ?? 0),
                'currency' => 'VND',
                'related_user_ids' => array_values($relArr),
                'title' => 'Đơn mua hàng: ' . ($p['po_number'] ?: ('#' . $p['id'])) . ($p['supplier_name'] ? (' - ' . $p['supplier_name']) : ''),
                'description' => $p['notes'] ?: ('Đơn mua hàng ' . $p['po_number']),
                'status' => ($p['status'] === 'pending_approval' ? 'pending' : ($isPoApproved ? 'approved' : ($p['status'] === 'cancelled' ? 'rejected' : $p['status']))),
                'created_at' => $p['created_at']
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

        // Pre-check: Ensure no locked payslips are being modified (State Machine SEC-HRM-02)
        $ids = array_values(array_filter(array_map(fn($p) => (int)($p['id'] ?? 0), $payslips)));
        if (!empty($ids)) {
            $inClause = implode(',', array_fill(0, count($ids), '?'));
            $checkLocked = $this->db->prepare("
                SELECT COUNT(*) FROM monthly_payslips mp 
                JOIN users u ON mp.user_id = u.id 
                WHERE mp.id IN ($inClause) AND u.tenant_id = ? AND mp.status = 'locked'
            ");
            $checkParams = array_merge($ids, [$auth['tenant_id']]);
            $checkLocked->execute($checkParams);
            if ((int)$checkLocked->fetchColumn() > 0) {
                respond(422, null, 'Bảng lương đã bị khóa, không thể chỉnh sửa số liệu', false);
            }
        }
        
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
                WHERE mp.id = ? AND u.tenant_id = ? AND mp.status != 'locked'
            ");
            
            foreach ($payslips as $ps) {
                $stmt->execute([
                    max(0.0, (float)($ps['work_days_required'] ?? 26)),
                    max(0.0, (float)($ps['work_days_actual'] ?? 0)),
                    max(0, (int)($ps['lateness_minutes'] ?? 0)),
                    max(0.0, (float)($ps['lateness_penalty'] ?? 0)),
                    max(0.0, (float)($ps['lateness_compensatory_deducted'] ?? 0.00)),
                    max(0.0, (float)($ps['lateness_annual_deducted'] ?? 0.00)),
                    max(0.0, (float)($ps['salary_basic_calculated'] ?? 0)),
                    max(0.0, (float)($ps['allowance_total'] ?? 0)),
                    max(0.0, (float)($ps['kpi_bonus'] ?? 0)),
                    max(0.0, (float)($ps['insurance_bhxh'] ?? 0)),
                    max(0.0, (float)($ps['insurance_bhyt'] ?? 0.00)),
                    max(0.0, (float)($ps['insurance_bhtn'] ?? 0.00)),
                    max(0.0, (float)($ps['tax_pit'] ?? 0)),
                    max(0.0, (float)($ps['advance_deduction'] ?? 0)),
                    max(0.0, (float)($ps['net_salary'] ?? 0)),
                    max(0.0, (float)($ps['overtime_days'] ?? 0)),
                    max(0.0, (float)($ps['overtime_salary'] ?? 0)),
                    max(0.0, (float)($ps['diligence_bonus'] ?? 0)),
                    $ps['note'] ?? null,
                    (int)($ps['id'] ?? 0),
                    $auth['tenant_id']
                ]);
            }
            
            $this->db->commit();
            respond(200, ['success' => true]);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, $e->getMessage(), false);
        }
    }

    public function deleteLeave(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT l.* FROM hrm_leave_requests l
            JOIN users u ON l.user_id = u.id
            WHERE l.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy yêu cầu nghỉ phép', false);
        }
        if (in_array($row['status'], ['approved', 'completed'], true)) {
            respond(400, null, 'Không thể xóa đơn nghỉ phép đã được duyệt', false);
        }
        $isPrivileged = $this->isAdmin($auth) || in_array($auth['role'], ['manager', 'director', 'hr'], true);
        $isCreator = ((int)$row['user_id'] === (int)$auth['user_id']);
        if (!$isCreator && !$isPrivileged) {
            respond(403, null, 'Bạn không có quyền xóa yêu cầu này', false);
        }
        
        $this->db->prepare("DELETE l FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE l.id = ? AND u.tenant_id = ?")->execute([$id, $auth['tenant_id']]);
        respond(200, null, 'Đã xóa yêu cầu nghỉ phép');
    }

    public function deleteAdvance(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT a.* FROM hrm_salary_advances a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND u.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy yêu cầu tạm ứng', false);
        }
        if (in_array($row['status'], ['approved', 'paid', 'completed'], true)) {
            respond(400, null, 'Không thể xóa yêu cầu tạm ứng đã được duyệt hoặc chi tiền', false);
        }
        $isPrivileged = $this->isAdmin($auth) || in_array($auth['role'], ['manager', 'director', 'hr'], true);
        $isCreator = ((int)$row['user_id'] === (int)$auth['user_id']);
        if (!$isCreator && !$isPrivileged) {
            respond(403, null, 'Bạn không có quyền xóa yêu cầu này', false);
        }
        
        $this->db->prepare("DELETE a FROM hrm_salary_advances a JOIN users u ON a.user_id = u.id WHERE a.id = ? AND u.tenant_id = ?")->execute([$id, $auth['tenant_id']]);
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
        $newId = (int)$this->db->lastInsertId();
        $mentionedIds = $this->parseAndNotifyMentions($body, $id, 'leave', $auth, $newId);
        try {
            $stmtReq = $this->db->prepare("SELECT l.user_id, l.approver_id, l.approver_id_2 FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE l.id = ? AND u.tenant_id = ?");
            $stmtReq->execute([$id, $auth['tenant_id']]);
            $reqRow = $stmtReq->fetch(PDO::FETCH_ASSOC);
            if ($reqRow) {
                $uid = (int)$auth['user_id'];
                $commenterName = $auth['full_name'] ?? 'Đồng nghiệp';
                $targetLink = "/approvals?open_id={$id}&open_type=leave&highlight_comment_id={$newId}";
                $recipients = array_unique(array_filter([
                    (int)($reqRow['user_id'] ?? 0),
                    (int)($reqRow['approver_id'] ?? 0),
                    (int)($reqRow['approver_id_2'] ?? 0),
                ]));
                $insNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'comment', ?, 0, NOW())
                ");
                foreach ($recipients as $rUid) {
                    if ($rUid > 0 && $rUid !== $uid && !in_array($rUid, $mentionedIds, true)) {
                        $insNotif->execute([
                            $rUid,
                            $auth['tenant_id'],
                            "Bình luận mới trong đơn xin nghỉ phép #{$id}",
                            "{$commenterName} vừa bình luận: \"" . mb_substr(strip_tags($body), 0, 120) . "\"",
                            $targetLink
                        ]);
                    }
                }
            }
        } catch (Throwable $e) {}
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
        $newId = (int)$this->db->lastInsertId();
        $mentionedIds = $this->parseAndNotifyMentions($body, $id, 'advance', $auth, $newId);
        try {
            $stmtReq = $this->db->prepare("SELECT a.user_id, a.approver_id, a.approver_id_2 FROM hrm_salary_advances a JOIN users u ON a.user_id = u.id WHERE a.id = ? AND u.tenant_id = ?");
            $stmtReq->execute([$id, $auth['tenant_id']]);
            $reqRow = $stmtReq->fetch(PDO::FETCH_ASSOC);
            if ($reqRow) {
                $uid = (int)$auth['user_id'];
                $commenterName = $auth['full_name'] ?? 'Đồng nghiệp';
                $targetLink = "/approvals?open_id={$id}&open_type=advance&highlight_comment_id={$newId}";
                $recipients = array_unique(array_filter([
                    (int)($reqRow['user_id'] ?? 0),
                    (int)($reqRow['approver_id'] ?? 0),
                    (int)($reqRow['approver_id_2'] ?? 0),
                ]));
                $insNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'comment', ?, 0, NOW())
                ");
                foreach ($recipients as $rUid) {
                    if ($rUid > 0 && $rUid !== $uid && !in_array($rUid, $mentionedIds, true)) {
                        $insNotif->execute([
                            $rUid,
                            $auth['tenant_id'],
                            "Bình luận mới trong phiếu tạm ứng lương #{$id}",
                            "{$commenterName} vừa bình luận: \"" . mb_substr(strip_tags($body), 0, 120) . "\"",
                            $targetLink
                        ]);
                    }
                }
            }
        } catch (Throwable $e) {}
        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    private function parseAndNotifyMentions(string $body, int $id, string $type, array $auth, ?int $commentId = null): array {
        $mentions = [];
        if (preg_match_all('/data-user-id=(?:&quot;|["\']|\\\\+["\'])?(\d+)/i', (string)$body, $matches)) {
            $uids = array_values(array_unique(array_filter(array_map('intval', $matches[1]), fn($u) => $u > 0 && $u !== (int)$auth['user_id'])));
            if (!empty($uids)) {
                $inPh = implode(',', array_fill(0, count($uids), '?'));
                $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE id IN ($inPh) AND tenant_id=?");
                $stmtUser->execute(array_merge($uids, [$auth['tenant_id']]));
                foreach ($stmtUser->fetchAll(PDO::FETCH_ASSOC) ?: [] as $userRow) {
                    $mentions[(int)$userRow['id']] = $userRow;
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
                $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE (full_name=? OR REPLACE(full_name, ' ', '_')=?) AND tenant_id=?");
                $stmtUser->execute([$fullName, $nameWithUnderscores, $auth['tenant_id']]);
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
            // 1. Automatically append mentioned users into related_user_ids
            try {
                $table = ($type === 'advance' || $type === 'hrm_advance') ? 'hrm_salary_advances' : 'hrm_leave_requests';
                $stmtReq = $this->db->prepare("SELECT r.related_user_ids FROM `{$table}` r JOIN users u ON r.user_id = u.id WHERE r.id = ? AND u.tenant_id = ?");
                $stmtReq->execute([$id, $auth['tenant_id']]);
                $reqRow = $stmtReq->fetch(PDO::FETCH_ASSOC);
                if ($reqRow) {
                    $curRelated = [];
                    if (!empty($reqRow['related_user_ids'])) {
                        $decoded = json_decode($reqRow['related_user_ids'], true);
                        if (is_array($decoded)) {
                            $curRelated = array_map('intval', $decoded);
                        } else {
                            $curRelated = array_filter(array_map('intval', explode(',', $reqRow['related_user_ids'])));
                        }
                    }
                    $newRelated = $curRelated;
                    foreach (array_keys($mentions) as $mUid) {
                        if (!in_array((int)$mUid, $newRelated, true)) {
                            $newRelated[] = (int)$mUid;
                        }
                    }
                    if ($newRelated !== $curRelated) {
                        $updateStmt = $this->db->prepare("UPDATE `{$table}` r JOIN users u ON r.user_id = u.id SET r.related_user_ids = ? WHERE r.id = ? AND u.tenant_id = ?");
                        $updateStmt->execute([json_encode(array_values(array_unique($newRelated))), $id, $auth['tenant_id']]);
                    }
                }
            } catch (Throwable $e) {
                // Keep resilient
            }

            // 2. Dispatch notifications
            require_once __DIR__ . '/../NotificationService.php';
            $link = "/approvals?open_id={$id}&open_type={$type}" . ($commentId ? "&highlight_comment_id={$commentId}" : "");
            foreach ($mentions as $uid => $userRow) {
                NotificationService::send($this->db, $auth['tenant_id'], 'MENTION_TAGGED', [
                    'user_id' => $uid,
                    'author_name' => $auth['full_name'] ?? 'Đồng nghiệp',
                    'comment' => $body,
                    'link' => $link
                ]);
            }
        }
        return array_map('intval', array_keys($mentions));
    }

    public function updateRelatedUsers(array $auth): void {
        $b = getBody();
        $type = trim($b['type'] ?? $b['entity_type'] ?? '');
        $id = (int)($b['id'] ?? $b['entity_id'] ?? 0);
        $relatedUserIds = isset($b['related_user_ids']) ? $b['related_user_ids'] : [];
        if (!$id || !$type) {
            respond(422, null, 'Thiếu thông tin loại hoặc ID yêu cầu', false);
        }
        if (!is_array($relatedUserIds)) {
            $relatedUserIds = array_filter(array_map('intval', explode(',', (string)$relatedUserIds)));
        } else {
            $relatedUserIds = array_values(array_unique(array_filter(array_map('intval', $relatedUserIds))));
        }
        $jsonVal = json_encode($relatedUserIds);
        $tid = (int)($auth['tenant_id'] ?? 1);

        if ($type === 'expense' || $type === 'expenses' || $type === 'commission_payout') {
            $stmt = $this->db->prepare("UPDATE expenses SET related_user_ids = ? WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$jsonVal, $id, $tid]);
        } elseif ($type === 'leave' || $type === 'hrm_leave') {
            $stmt = $this->db->prepare("UPDATE hrm_leave_requests l JOIN users u ON l.user_id = u.id SET l.related_user_ids = ? WHERE l.id = ? AND u.tenant_id = ?");
            $stmt->execute([$jsonVal, $id, $tid]);
        } elseif ($type === 'advance' || $type === 'hrm_advance') {
            $stmt = $this->db->prepare("UPDATE hrm_salary_advances a JOIN users u ON a.user_id = u.id SET a.related_user_ids = ? WHERE a.id = ? AND u.tenant_id = ?");
            $stmt->execute([$jsonVal, $id, $tid]);
        } elseif ($type === 'bulk_attendance' || $type === 'bulk' || $type === 'checkin_bulk') {
            $stmt = $this->db->prepare("UPDATE attendance_bulk_requests r JOIN users u ON r.user_id = u.id SET r.related_user_ids = ? WHERE r.id = ? AND u.tenant_id = ?");
            $stmt->execute([$jsonVal, $id, $tid]);
        } elseif ($type === 'deposit' || $type === 'deposits') {
            $stmt = $this->db->prepare("UPDATE deposits d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN projects p ON d.project_id = p.id SET d.related_user_ids = ? WHERE d.id = ? AND (c.tenant_id = ? OR p.tenant_id = ?)");
            $stmt->execute([$jsonVal, $id, $tid, $tid]);
        } else {
            respond(400, null, 'Loại quy trình không được hỗ trợ', false);
        }

        respond(200, ['related_user_ids' => $relatedUserIds], 'Cập nhật danh sách người liên quan thành công');
    }

    public function deleteHrmComment(array $auth, int $commentId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $isAdmin = $this->isAdmin($auth) || in_array(strtolower($auth['role'] ?? ''), ['director', 'hr', 'manager'], true);

        $stmt = $this->db->prepare("SELECT * FROM comments WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$commentId, $tid]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($comment) {
            if (!$isAdmin && (int)$comment['user_id'] !== $uid) {
                respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
            }
            $fetchStmt = $this->db->prepare("SELECT attachments, body FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
            $fetchStmt->execute([$commentId, $commentId, $tid]);
            $commentsToDelete = $fetchStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($commentsToDelete as $c) {
                if (!empty($c['attachments']) && function_exists('deleteAttachmentFiles')) deleteAttachmentFiles($c['attachments']);
                if (!empty($c['body']) && function_exists('deleteAttachmentFiles')) deleteAttachmentFiles($c['body']);
            }
            $delStmt = $this->db->prepare("DELETE FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
            $delStmt->execute([$commentId, $commentId, $tid]);
            respond(200, ['success' => true], 'Đã xóa bình luận thành công');
        }

        // Fallback check legacy HRM comment tables if any
        foreach (['hrm_request_comments', 'leave_comments', 'advance_comments', 'hrm_leave_comments'] as $tbl) {
            try {
                $chk = $this->db->prepare("SELECT * FROM `{$tbl}` WHERE id = ? LIMIT 1");
                $chk->execute([$commentId]);
                $legacyRow = $chk->fetch(PDO::FETCH_ASSOC);
                if ($legacyRow) {
                    if (!$isAdmin && (int)($legacyRow['user_id'] ?? 0) !== $uid) {
                        respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
                    }
                    $this->db->prepare("DELETE FROM `{$tbl}` WHERE id = ?")->execute([$commentId]);
                    respond(200, ['success' => true], 'Đã xóa bình luận thành công');
                }
            } catch (\Throwable $eTbl) {}
        }

        respond(404, null, 'Bình luận không tồn tại', false);
    }

    // =========================================================================
    // PHÂN HỆ KẾ TOÁN & NHÂN SỰ - LƯƠNG A-Z (SYNCHRONIZED ENTERPRISE ENGINE)
    // =========================================================================

    /**
     * Tham số pháp lý & cấu hình mặc định theo chuẩn lao động, thuế & BHXH Việt Nam
     */
    private function getLegalParameters(?int $year = null, ?int $month = null): array {
        $now = new DateTime();
        $y = $year ?? (int)$now->format('Y');
        $m = $month ?? (int)$now->format('n');

        // Lương cơ sở: trước 07/2026: 2.340.000đ; từ 07/2026: 2.530.000đ
        $isPostJuly2026 = ($y * 12 + $m) >= (2026 * 12 + 7);
        $luongCoSo = $isPostJuly2026 ? 2530000 : 2340000;

        // Lương tối thiểu vùng (Vùng 1 -> 4)
        $isYear2026OrLater = ($y >= 2026);
        $vung = $isYear2026OrLater 
            ? [1 => 5310000, 2 => 4730000, 3 => 4140000, 4 => 3680000]
            : [1 => 4960000, 2 => 4410000, 3 => 3860000, 4 => 3450000];

        // Tỷ lệ trích đóng BHXH, BHYT, BHTN, KPCĐ
        $rateNLD = ['bhxh' => 0.08, 'bhyt' => 0.015, 'bhtn' => 0.01];
        $rateDN  = ['bhxh' => 0.175, 'huu' => 0.14, 'om' => 0.03, 'tnld' => 0.005, 'bhyt' => 0.03, 'bhtn' => 0.01, 'kpcd' => 0.02];

        // Giảm trừ thuế TNCN
        $selfDeduction = $isYear2026OrLater ? 15500000 : 11000000;
        $depDeduction  = $isYear2026OrLater ? 6200000 : 4400000;

        // Biểu thuế lũy tiến
        $brackets = $isYear2026OrLater
            ? [
                ['cap' => 10000000,  'rate' => 0.05, 'sub' => 0],
                ['cap' => 30000000,  'rate' => 0.10, 'sub' => 500000],
                ['cap' => 60000000,  'rate' => 0.20, 'sub' => 3500000],
                ['cap' => 100000000, 'rate' => 0.30, 'sub' => 9500000],
                ['cap' => PHP_FLOAT_MAX, 'rate' => 0.35, 'sub' => 14500000],
            ]
            : [
                ['cap' => 5000000,   'rate' => 0.05, 'sub' => 0],
                ['cap' => 10000000,  'rate' => 0.10, 'sub' => 250000],
                ['cap' => 18000000,  'rate' => 0.15, 'sub' => 750000],
                ['cap' => 32000000,  'rate' => 0.20, 'sub' => 1650000],
                ['cap' => 52000000,  'rate' => 0.25, 'sub' => 3250000],
                ['cap' => 80000000,  'rate' => 0.30, 'sub' => 5850000],
                ['cap' => PHP_FLOAT_MAX, 'rate' => 0.35, 'sub' => 9850000],
            ];

        // Mức ăn trưa miễn thuế & vãng lai 10%
        $anTruaCap = $isPostJuly2026 ? 1200000 : 730000;
        $casualCap = $isPostJuly2026 ? 5000000 : 2000000;

        return [
            'year'            => $y,
            'month'           => $m,
            'luong_co_so'     => $luongCoSo,
            'vung'            => $vung,
            'rate_nld'        => $rateNLD,
            'rate_dn'         => $rateDN,
            'self_deduction'  => $selfDeduction,
            'dep_deduction'   => $depDeduction,
            'brackets'        => $brackets,
            'an_trua_cap'     => $anTruaCap,
            'casual_cap'      => $casualCap,
            'cap_bhxh_bhyt'   => 20 * $luongCoSo,
            'cap_bhtn_vung1'  => 20 * $vung[1],
        ];
    }

    /**
     * Tính thuế TNCN lũy tiến từng phần
     */
    private function calculateProgressiveTax(float $taxableIncome, array $brackets): float {
        if ($taxableIncome <= 0) return 0.0;
        foreach ($brackets as $b) {
            if ($taxableIncome <= $b['cap']) {
                $tax = ($taxableIncome * $b['rate']) - $b['sub'];
                return max(0.0, round($tax));
            }
        }
        $last = end($brackets);
        return max(0.0, round(($taxableIncome * $last['rate']) - $last['sub']));
    }

    /**
     * Quy đổi Net sang TNTT theo Phụ lục 02 Thông tư 111/2013/TT-BTC
     */
    private function netConvertedToTaxableIncome(float $convertedIncome, bool $is2026OrLater = false): float {
        if ($convertedIncome <= 0) return 0.0;
        if ($is2026OrLater) {
            if ($convertedIncome <= 9500000)   return round($convertedIncome / 0.95);
            if ($convertedIncome <= 27500000)  return round(($convertedIncome - 500000) / 0.90);
            if ($convertedIncome <= 51500000)  return round(($convertedIncome - 3500000) / 0.80);
            if ($convertedIncome <= 79500000)  return round(($convertedIncome - 9500000) / 0.70);
            return round(($convertedIncome - 14500000) / 0.65);
        } else {
            if ($convertedIncome <= 4750000)   return round($convertedIncome / 0.95);
            if ($convertedIncome <= 9250000)   return round(($convertedIncome - 250000) / 0.90);
            if ($convertedIncome <= 16050000)  return round(($convertedIncome - 750000) / 0.85);
            if ($convertedIncome <= 27250000)  return round(($convertedIncome - 1650000) / 0.80);
            if ($convertedIncome <= 42250000)  return round(($convertedIncome - 3250000) / 0.75);
            if ($convertedIncome <= 61850000)  return round(($convertedIncome - 5850000) / 0.70);
            return round(($convertedIncome - 9850000) / 0.65);
        }
    }

    /**
     * GET /api/hrm/accounting-az/overview
     * Tổng quan KPI, Cảnh báo hợp đồng (Khoản 2 Điều 20 BLLĐ 2019), Thiếu thông tin và Lịch thuế
     */
    public function getAccountingAzOverview(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $month = trim($_GET['month'] ?? date('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) $month = date('Y-m');
        [$y, $m] = array_map('intval', explode('-', $month));
        $params = $this->getLegalParameters($y, $m);

        // 1. Thống kê nhân sự thực tế (users table uses is_active, NOT status)
        $uStmt = $this->db->prepare("
            SELECT id, full_name, email, phone, role, is_active, citizen_id, bank_name, bank_account, avatar_url, job_title, gender, created_at
            FROM users
            WHERE tenant_id = ? AND role NOT IN ('superadmin', 'super_admin') AND email != 'info@ideas.edu.vn'
        ");
        $uStmt->execute([$tid]);
        $allUsers = $uStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $activeUsers = array_filter($allUsers, fn($u) => ($u['is_active'] ?? 0) == 1);
        $inactiveUsers = array_filter($allUsers, fn($u) => ($u['is_active'] ?? 0) == 0);

        // Thiếu thông tin CCCD, MST, STK
        $missingInfoUsers = [];
        foreach ($activeUsers as $u) {
            $missFields = [];
            if (empty(trim((string)($u['citizen_id'] ?? '')))) $missFields[] = 'CCCD';
            if (empty(trim((string)($u['bank_account'] ?? '')))) $missFields[] = 'STK Ngân hàng';
            if (!empty($missFields)) {
                $missingInfoUsers[] = [
                    'id'          => (int)$u['id'],
                    'full_name'   => $u['full_name'],
                    'email'       => $u['email'],
                    'avatar_url'  => $u['avatar_url'] ?? null,
                    'avatar'      => $u['avatar_url'] ?? null,
                    'job_title'   => $u['job_title'] ?? 'Nhân viên',
                    'miss_fields' => $missFields
                ];
            }
        }

        // 2. Thống kê bảng lương thực tế của tháng
        $pStmt = $this->db->prepare("
            SELECT 
                COUNT(*) as total_slips,
                COALESCE(SUM(salary_basic_calculated + allowance_total + kpi_bonus + overtime_salary + diligence_bonus), 0) as total_gross,
                COALESCE(SUM(insurance_bhxh + insurance_bhyt + insurance_bhtn), 0) as total_insurance_nld,
                COALESCE(SUM(tax_pit), 0) as total_tax_pit,
                COALESCE(SUM(advance_deduction), 0) as total_advance_deduction,
                COALESCE(SUM(net_salary), 0) as total_net
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE u.tenant_id = ? AND mp.month_year = ?
        ");
        $pStmt->execute([$tid, $month]);
        $payStat = $pStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalGross = (float)($payStat['total_gross'] ?? 0);
        $totalNet   = (float)($payStat['total_net'] ?? 0);
        $totalPIT   = (float)($payStat['total_tax_pit'] ?? 0);
        $totalInsNLD = (float)($payStat['total_insurance_nld'] ?? 0);
        $totalAdvance = (float)($payStat['total_advance_deduction'] ?? 0);
        $totalSlips = (int)($payStat['total_slips'] ?? 0);

        // 2b. Quỹ lương & bảo hiểm dự kiến (tính từ hồ sơ nhân sự hrm_profiles đang làm việc)
        $profStmt = $this->db->prepare("
            SELECT 
                COUNT(u.id) as active_count,
                COALESCE(SUM(COALESCE(p.base_salary, 0) + COALESCE(p.deal_salary, 0) + COALESCE(p.allowance_meal, 0) + COALESCE(p.allowance_travel, 0) + COALESCE(p.allowance_phone, 0)), 0) as projected_gross,
                COALESCE(SUM(CASE WHEN COALESCE(p.has_insurance, 1) = 1 THEN COALESCE(p.base_salary, 0) ELSE 0 END), 0) as projected_ins_salary
            FROM users u
            LEFT JOIN hrm_profiles p ON u.id = p.user_id
            WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
        ");
        $profStmt->execute([$tid]);
        $profData = $profStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $projectedGross  = (float)($profData['projected_gross'] ?? 0);
        $projectedInsSal = (float)($profData['projected_ins_salary'] ?? 0);
        $projectedInsNLD = round($projectedInsSal * 0.105);
        $projectedInsDN  = round($projectedInsSal * 0.235);
        $projectedKPCD   = round($projectedInsSal * 0.02);
        $projectedNet    = max(0, $projectedGross - $projectedInsNLD);

        $isProjected = ($totalSlips === 0 && $projectedGross > 0);

        // Ước tính bảo hiểm DN (23.5% gồm BHXH 17.5%, BHYT 3%, BHTN 1%, KPCĐ 2%)
        $totalInsDN = $totalGross > 0 ? round($totalGross * 0.235) : $projectedInsDN;
        $totalKPCD  = $totalGross > 0 ? round($totalGross * 0.02) : $projectedKPCD;

        // 3. Cảnh báo Hợp đồng lao động thực tế
        $contracts = [];
        try {
            $cStmt = $this->db->prepare("
                SELECT c.*, u.full_name, u.email, u.avatar_url, u.avatar_url as avatar, u.job_title
                FROM hrm_contracts c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ?
                ORDER BY c.end_date ASC
            ");
            $cStmt->execute([$tid]);
            $contracts = $cStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
            $contracts = [];
        }

        $nowDate = date('Y-m-d');
        $contractAlerts = [];
        $contractsByUser = [];

        foreach ($contracts as $c) {
            $contractsByUser[$c['user_id']][] = $c;
            if (empty($c['end_date'])) continue;
            $diffDays = (int)round((strtotime($c['end_date']) - strtotime($nowDate)) / 86400);

            if ($diffDays < 0 && ($c['status'] ?? '') === 'active') {
                $contractAlerts[] = [
                    'severity'   => 'bad',
                    'user_id'    => (int)$c['user_id'],
                    'full_name'  => $c['full_name'],
                    'avatar_url' => $c['avatar_url'] ?? null,
                    'avatar'     => $c['avatar_url'] ?? null,
                    'contract_code' => $c['contract_code'],
                    'contract_type' => $c['contract_type'],
                    'end_date'   => $c['end_date'],
                    'days_left'  => $diffDays,
                    'message'    => "Hợp đồng {$c['contract_code']} đã hết hạn " . abs($diffDays) . " ngày ({$c['end_date']}), chưa gia hạn."
                ];
            } elseif ($diffDays >= 0 && $diffDays <= 30 && ($c['status'] ?? '') === 'active') {
                $contractAlerts[] = [
                    'severity'   => 'warn',
                    'user_id'    => (int)$c['user_id'],
                    'full_name'  => $c['full_name'],
                    'avatar_url' => $c['avatar_url'] ?? null,
                    'avatar'     => $c['avatar_url'] ?? null,
                    'contract_code' => $c['contract_code'],
                    'contract_type' => $c['contract_type'],
                    'end_date'   => $c['end_date'],
                    'days_left'  => $diffDays,
                    'message'    => "Hợp đồng {$c['contract_code']} còn {$diffDays} ngày sẽ hết hạn ({$c['end_date']})."
                ];
            }
        }

        // Kiểm tra quy định khoản 2 Điều 20 BLLĐ 2019: đã ký >= 2 HĐ xác định thời hạn
        foreach ($contractsByUser as $uid => $userCts) {
            $xdCount = count(array_filter($userCts, fn($x) => in_array(strtolower($x['contract_type'] ?? ''), ['xd', 'definite', 'fixed_term'], true)));
            if ($xdCount >= 2) {
                $lastCt = end($userCts);
                if (in_array(strtolower($lastCt['contract_type'] ?? ''), ['xd', 'definite', 'fixed_term'], true)) {
                    $contractAlerts[] = [
                        'severity'   => 'info',
                        'user_id'    => (int)$uid,
                        'full_name'  => $lastCt['full_name'] ?? "Nhân viên #$uid",
                        'avatar_url' => $lastCt['avatar_url'] ?? null,
                        'avatar'     => $lastCt['avatar_url'] ?? null,
                        'contract_code' => $lastCt['contract_code'] ?? '',
                        'contract_type' => $lastCt['contract_type'] ?? '',
                        'end_date'   => $lastCt['end_date'] ?? null,
                        'days_left'  => null,
                        'message'    => "Đã ký {$xdCount} lần HĐ xác định thời hạn. HĐ tiếp theo bắt buộc phải là HĐ không xác định thời hạn (khoản 2 Điều 20 BLLĐ 2019)."
                    ];
                }
            }
        }

        // 4. Lịch thuế & Kê khai TNCN
        $quarter = (int)ceil($m / 3);
        $qEndMonth = $quarter * 3;
        $dueYear = ($qEndMonth === 12) ? ($y + 1) : $y;
        $dueMonth = ($qEndMonth === 12) ? 1 : ($qEndMonth + 1);
        $taxDueQuarter = date('t/m/Y', (int)mktime(0, 0, 0, $dueMonth, 1, $dueYear));
        $taxDueMonth = sprintf('20/%02d/%d', ($m == 12 ? 1 : $m + 1), ($m == 12 ? $y + 1 : $y));

        // 5. Checklist Quy trình Đóng kỳ Kế toán - Nhân sự hàng tháng
        $hasPayslips = ((int)($payStat['total_slips'] ?? 0)) > 0;
        $sopChecklist = [
            ['id' => 'profile',  'title' => '1. Rà soát hồ sơ nhân viên mới, hợp đồng & người phụ thuộc', 'done' => count($missingInfoUsers) === 0],
            ['id' => 'timesheet','title' => '2. Chốt dữ liệu chấm công, phê duyệt đơn nghỉ phép & OT',   'done' => true],
            ['id' => 'payroll',  'title' => '3. Tính toán bảng lương, bảo hiểm xã hội & thuế TNCN',       'done' => $hasPayslips],
            ['id' => 'slips',    'title' => '4. Gửi phiếu lương điện tử cho nhân sự kiểm tra & xác nhận', 'done' => $hasPayslips],
            ['id' => 'bank',     'title' => '5. Xuất danh sách chi lương qua ngân hàng & thanh toán',     'done' => $hasPayslips && $totalNet > 0],
            ['id' => 'journal',  'title' => '6. Hạch toán sổ nhật ký chung (TK 334, 338, 3335, 642)',     'done' => $hasPayslips],
            ['id' => 'tax',      'title' => '7. Lập tờ khai thuế TNCN 05/KK & nộp tiền bảo hiểm/thuế',    'done' => false],
        ];

        respond(200, [
            'month'             => $month,
            'legal_parameters'  => $params,
            'kpis'              => [
                'active_employees'   => count($activeUsers),
                'resigned_employees' => count($inactiveUsers),
                'total_employees'    => count($allUsers),
                'total_gross'        => $totalGross,
                'total_net'          => $totalNet,
                'total_tax_pit'      => $totalPIT,
                'total_advance'      => $totalAdvance,
                'total_insurance_nld'=> $totalGross > 0 ? $totalInsNLD : $projectedInsNLD,
                'total_insurance_dn' => $totalInsDN,
                'total_insurance_all'=> ($totalGross > 0 ? $totalInsNLD : $projectedInsNLD) + $totalInsDN,
                'total_kpcd'         => $totalKPCD,
                'total_payslips'     => $totalSlips,
                'projected_gross'    => $projectedGross,
                'projected_net'      => $projectedNet,
                'projected_ins_nld'  => $projectedInsNLD,
                'projected_ins_dn'   => $projectedInsDN,
                'is_projected'       => $isProjected,
            ],
            'alerts'            => [
                'contract_alerts'    => $contractAlerts,
                'missing_info_users' => $missingInfoUsers,
            ],
            'tax_schedule'      => [
                'quarter'        => $quarter,
                'due_monthly'    => $taxDueMonth,
                'due_quarterly'  => $taxDueQuarter,
                'suggested_type' => 'Q', // Quý
            ],
            'sop_checklist'     => $sopChecklist
        ], 'Lấy tổng quan kế toán & lương A-Z thành công');
    }

    /**
     * POST /api/hrm/accounting-az/simulate-payroll
     * Bộ chuyển đổi & mô phỏng tính lương Gross ⇄ Net, BHXH, Thuế TNCN
     */
    public function simulatePayroll(array $auth): void {
        $body = getBody();
        $salary = (float)($body['salary'] ?? 0);
        $mode   = trim((string)($body['mode'] ?? 'gross_to_net')); // 'gross_to_net' | 'net_to_gross'
        $deps   = max(0, (int)($body['dependents'] ?? 0));
        $region = max(1, min(4, (int)($body['region'] ?? 1)));
        $year   = (int)($body['year'] ?? date('Y'));
        $month  = (int)($body['month'] ?? date('n'));
        $ctType = trim((string)($body['contract_type'] ?? 'labour_resident')); // 'labour_resident' | 'probation_casual' | 'non_resident'
        $hasIns = (bool)($body['has_insurance'] ?? true);
        $hasUnion = (bool)($body['has_union'] ?? false);
        $customInsSalary = (float)($body['insurance_salary'] ?? 0);

        // Phụ cấp
        $pcMeal   = (float)($body['allowance_meal'] ?? 0);
        $pcPhone  = (float)($body['allowance_phone'] ?? 0);
        $pcTravel = (float)($body['allowance_travel'] ?? 0);
        $pcOther  = (float)($body['allowance_other'] ?? 0);
        $totalAllowances = $pcMeal + $pcPhone + $pcTravel + $pcOther;

        $params = $this->getLegalParameters($year, $month);
        $capXH  = $params['cap_bhxh_bhyt'];
        $capTN  = 20 * $params['vung'][$region];

        // 1. Nếu mode === 'gross_to_net'
        if ($mode !== 'net_to_gross') {
            $gross = $salary;
            $insSalary = $customInsSalary > 0 ? $customInsSalary : ($gross - $pcMeal);
            if (!$hasIns || $ctType === 'probation_casual') {
                $insSalary = 0;
            }

            $bXH = min($insSalary, $capXH);
            $bTN = ($ctType === 'non_resident') ? 0 : min($insSalary, $capTN);

            // Bảo hiểm NLĐ
            $insNLD = [
                'bhxh'  => round($bXH * $params['rate_nld']['bhxh']),
                'bhyt'  => round($bXH * $params['rate_nld']['bhyt']),
                'bhtn'  => round($bTN * $params['rate_nld']['bhtn']),
            ];
            $totalInsNLD = $insNLD['bhxh'] + $insNLD['bhyt'] + $insNLD['bhtn'];

            // Bảo hiểm DN
            $insDN = [
                'bhxh'  => round($bXH * $params['rate_dn']['bhxh']),
                'bhyt'  => round($bXH * $params['rate_dn']['bhyt']),
                'bhtn'  => round($bTN * $params['rate_dn']['bhtn']),
                'kpcd'  => round($bXH * $params['rate_dn']['kpcd']),
            ];
            $totalInsDN = $insDN['bhxh'] + $insDN['bhyt'] + $insDN['bhtn'] + $insDN['kpcd'];

            // Đoàn phí công đoàn (1% lương BH, tối đa 10% lương cơ sở)
            $doanPhi = $hasUnion ? min(round($bXH * 0.01), round($params['luong_co_so'] * 0.1)) : 0;

            // Miễn thuế: ăn trưa trong mức quy định
            $exemptMeal = min($pcMeal, $params['an_trua_cap']);
            $totalExempt = $exemptMeal;

            // Thu nhập chịu thuế (TNCT)
            $tnct = max(0.0, $gross - $totalExempt);

            // Giảm trừ gia cảnh
            $selfReduction = $params['self_deduction'];
            $depReduction  = $deps * $params['dep_deduction'];
            $totalReduction = $selfReduction + $depReduction;

            // Thuế TNCN
            if ($ctType === 'non_resident') {
                $method = 'Không cư trú 20%';
                $tntt = $tnct;
                $taxPIT = round($tnct * 0.20);
            } elseif ($ctType === 'probation_casual') {
                $method = 'Khấu trừ 10% tại nguồn';
                $tntt = $tnct;
                $taxPIT = ($tnct >= $params['casual_cap']) ? round($tnct * 0.10) : 0.0;
            } else {
                $method = ($year >= 2026) ? 'Biểu lũy tiến 5 bậc' : 'Biểu lũy tiến 7 bậc';
                $tntt = max(0.0, $tnct - $totalReduction - $totalInsNLD);
                $taxPIT = $this->calculateProgressiveTax($tntt, $params['brackets']);
            }

            $net = max(0.0, $gross - $totalInsNLD - $doanPhi - $taxPIT);
            $totalCostDN = $gross + $totalInsDN;

            respond(200, [
                'mode'            => 'gross_to_net',
                'gross'           => round($gross),
                'net'             => round($net),
                'insurance_nld'   => [
                    'bhxh'  => $insNLD['bhxh'],
                    'bhyt'  => $insNLD['bhyt'],
                    'bhtn'  => $insNLD['bhtn'],
                    'total' => $totalInsNLD
                ],
                'insurance_dn'    => [
                    'bhxh'  => $insDN['bhxh'],
                    'bhyt'  => $insDN['bhyt'],
                    'bhtn'  => $insDN['bhtn'],
                    'kpcd'  => $insDN['kpcd'],
                    'total' => $totalInsDN
                ],
                'union_fee'       => $doanPhi,
                'tax'             => [
                    'method'          => $method,
                    'tnct'            => round($tnct),
                    'exempt'          => round($totalExempt),
                    'self_deduction'  => $selfReduction,
                    'dep_deduction'   => $depReduction,
                    'total_reduction' => $totalReduction,
                    'tntt'            => round($tntt),
                    'pit'             => round($taxPIT),
                ],
                'employer_total_cost' => round($totalCostDN),
                'parameters'      => $params
            ], 'Mô phỏng lương Gross sang Net thành công');
        } else {
            // 2. Mode === 'net_to_gross'
            $targetNet = $salary;
            $selfReduction = $params['self_deduction'];
            $depReduction  = $deps * $params['dep_deduction'];
            $totalReduction = $selfReduction + $depReduction;
            $exemptMeal = min($pcMeal, $params['an_trua_cap']);

            if ($ctType === 'non_resident') {
                $gross = round($targetNet / 0.80);
                $taxPIT = round($gross * 0.20);
                $totalInsNLD = 0;
            } elseif ($ctType === 'probation_casual') {
                if ($targetNet >= $params['casual_cap'] * 0.9) {
                    $gross = round($targetNet / 0.90);
                    $taxPIT = round($gross * 0.10);
                } else {
                    $gross = $targetNet;
                    $taxPIT = 0;
                }
                $totalInsNLD = 0;
            } else {
                // Thu nhập quy đổi = Net - Giảm trừ gia cảnh
                $convertedIncome = max(0.0, $targetNet - $totalReduction);
                $is2026 = ($year >= 2026);
                $tntt = $this->netConvertedToTaxableIncome($convertedIncome, $is2026);
                $taxPIT = $this->calculateProgressiveTax($tntt, $params['brackets']);

                // Approximate Gross
                $interimGross = $targetNet + $taxPIT;
                if ($hasIns) {
                    $insBase = $customInsSalary > 0 ? $customInsSalary : $interimGross;
                    $bXH = min($insBase, $capXH);
                    $bTN = min($insBase, $capTN);
                    $totalInsNLD = round($bXH * $params['rate_nld']['bhxh'] + $bXH * $params['rate_nld']['bhyt'] + $bTN * $params['rate_nld']['bhtn']);
                } else {
                    $totalInsNLD = 0;
                }
                $gross = $targetNet + $taxPIT + $totalInsNLD;
            }

            // Recalculate employer side
            $insSalary = $customInsSalary > 0 ? $customInsSalary : $gross;
            $bXH = min($insSalary, $capXH);
            $bTN = min($insSalary, $capTN);
            $insDN = [
                'bhxh'  => round($bXH * $params['rate_dn']['bhxh']),
                'bhyt'  => round($bXH * $params['rate_dn']['bhyt']),
                'bhtn'  => round($bTN * $params['rate_dn']['bhtn']),
                'kpcd'  => round($bXH * $params['rate_dn']['kpcd']),
            ];
            $totalInsDN = $insDN['bhxh'] + $insDN['bhyt'] + $insDN['bhtn'] + $insDN['kpcd'];

            respond(200, [
                'mode'            => 'net_to_gross',
                'net'             => round($targetNet),
                'gross'           => round($gross),
                'insurance_nld'   => ['total' => $totalInsNLD],
                'insurance_dn'    => array_merge($insDN, ['total' => $totalInsDN]),
                'tax'             => [
                    'pit'             => round($taxPIT),
                    'self_deduction'  => $selfReduction,
                    'dep_deduction'   => $depReduction,
                    'total_reduction' => $totalReduction,
                ],
                'employer_total_cost' => round($gross + $totalInsDN),
                'parameters'      => $params
            ], 'Quy đổi lương Net sang Gross thành công');
        }
    }

    /**
     * GET /api/hrm/accounting-az/general-journal
     * Sổ Nhật Ký Chung & Bút toán Hạch toán Kép (TT200 / TT133)
     */
    public function getGeneralJournal(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $month = trim($_GET['month'] ?? date('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) $month = date('Y-m');
        [$y, $m] = array_map('intval', explode('-', $month));

        // 1. Lấy dữ liệu bảng lương thực tế
        $pStmt = $this->db->prepare("
            SELECT 
                COALESCE(SUM(salary_basic_calculated + allowance_total + kpi_bonus + overtime_salary + diligence_bonus), 0) as total_gross,
                COALESCE(SUM(insurance_bhxh), 0) as ins_bhxh_nld,
                COALESCE(SUM(insurance_bhyt), 0) as ins_bhyt_nld,
                COALESCE(SUM(insurance_bhtn), 0) as ins_bhtn_nld,
                COALESCE(SUM(tax_pit), 0) as total_pit,
                COALESCE(SUM(advance_deduction), 0) as total_advance,
                COALESCE(SUM(net_salary), 0) as total_net
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE u.tenant_id = ? AND mp.month_year = ?
        ");
        $pStmt->execute([$tid, $month]);
        $pay = $pStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $gross       = (float)($pay['total_gross'] ?? 0);
        $bhxhNLD     = (float)($pay['ins_bhxh_nld'] ?? 0);
        $bhytNLD     = (float)($pay['ins_bhyt_nld'] ?? 0);
        $bhtnNLD     = (float)($pay['ins_bhtn_nld'] ?? 0);
        $totalInsNLD = $bhxhNLD + $bhytNLD + $bhtnNLD;
        $pit         = (float)($pay['total_pit'] ?? 0);
        $advance     = (float)($pay['total_advance'] ?? 0);
        $net         = (float)($pay['total_net'] ?? 0);

        // Bảo hiểm & KPCĐ phía DN
        $bhxhDN = round($gross * 0.175);
        $bhytDN = round($gross * 0.03);
        $bhtnDN = round($gross * 0.01);
        $kpcdDN = round($gross * 0.02);
        $totalInsDN = $bhxhDN + $bhytDN + $bhtnDN + $kpcdDN;

        // 1b. Lấy dữ liệu dự kiến từ hrm_profiles nếu chưa chốt bảng lương thực tế
        $profStmt = $this->db->prepare("
            SELECT 
                COUNT(u.id) as active_count,
                COALESCE(SUM(COALESCE(p.base_salary, 0) + COALESCE(p.deal_salary, 0) + COALESCE(p.allowance_meal, 0) + COALESCE(p.allowance_travel, 0) + COALESCE(p.allowance_phone, 0)), 0) as projected_gross,
                COALESCE(SUM(CASE WHEN COALESCE(p.has_insurance, 1) = 1 THEN COALESCE(p.base_salary, 0) ELSE 0 END), 0) as projected_ins_salary
            FROM users u
            LEFT JOIN hrm_profiles p ON u.id = p.user_id
            WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
        ");
        $profStmt->execute([$tid]);
        $profData = $profStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $projectedGross  = (float)($profData['projected_gross'] ?? 0);
        $projectedInsSal = (float)($profData['projected_ins_salary'] ?? 0);
        $projectedInsNLD = round($projectedInsSal * 0.105);
        $projectedInsDN  = round($projectedInsSal * 0.235);
        $projectedKPCD   = round($projectedInsSal * 0.02);
        $projectedNet    = max(0, $projectedGross - $projectedInsNLD);

        $isProjectedSalary = ($gross == 0 && $projectedGross > 0);
        $effGross   = $gross > 0 ? $gross : $projectedGross;
        $effNet     = $gross > 0 ? $net : $projectedNet;
        $effInsNLD  = $gross > 0 ? $totalInsNLD : $projectedInsNLD;
        $effInsDN   = $gross > 0 ? $totalInsDN : $projectedInsDN;
        $effBhxhNLD = $gross > 0 ? $bhxhNLD : round($projectedInsSal * 0.08);
        $effBhytNLD = $gross > 0 ? $bhytNLD : round($projectedInsSal * 0.015);
        $effBhtnNLD = $gross > 0 ? $bhtnNLD : round($projectedInsSal * 0.01);
        $effBhxhDN  = $gross > 0 ? $bhxhDN : round($projectedInsSal * 0.175);
        $effBhytDN  = $gross > 0 ? $bhytDN : round($projectedInsSal * 0.03);
        $effBhtnDN  = $gross > 0 ? $bhtnDN : round($projectedInsSal * 0.01);
        $effKpcdDN  = $gross > 0 ? $kpcdDN : $projectedKPCD;

        // 2. Lấy dữ liệu Doanh thu Học phí/Cọc (deposits + invoices - SARGable date range)
        $monthStart = $month . '-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        $monthStartTs = $monthStart . ' 00:00:00';
        $monthEndTs = $monthEnd . ' 23:59:59';

        $dStmt = $this->db->prepare("
            SELECT COALESCE(SUM(price), 0) as total_deposit
            FROM deposits d
            JOIN contacts c ON d.contact_id = c.id
            WHERE c.tenant_id = ? AND d.deleted_at IS NULL AND d.status = 'approved' AND d.created_at >= ? AND d.created_at <= ?
        ");
        $dStmt->execute([$tid, $monthStartTs, $monthEndTs]);
        $depRow = $dStmt->fetch(PDO::FETCH_ASSOC);
        $depositRevenue = (float)($depRow['total_deposit'] ?? 0);

        $iStmt = $this->db->prepare("
            SELECT COALESCE(SUM(total), 0) as total_invoice
            FROM invoices
            WHERE tenant_id = ? AND status = 'paid' AND deleted_at IS NULL AND paid_at >= ? AND paid_at <= ?
        ");
        $iStmt->execute([$tid, $monthStartTs, $monthEndTs]);
        $invRow = $iStmt->fetch(PDO::FETCH_ASSOC);
        $invoiceRevenue = (float)($invRow['total_invoice'] ?? 0);
        $totalRevenue = $depositRevenue + $invoiceRevenue;

        // 3. Lấy dữ liệu Chi phí vận hành (expenses - SARGable date range)
        $eStmt = $this->db->prepare("
            SELECT COALESCE(SUM(amount), 0) as total_expense, COALESCE(SUM(vat_amount), 0) as total_vat
            FROM expenses
            WHERE tenant_id = ? AND status = 'approved' AND deleted_at IS NULL AND date >= ? AND date <= ?
        ");
        $eStmt->execute([$tid, $monthStart, $monthEnd]);
        $expRow = $eStmt->fetch(PDO::FETCH_ASSOC);
        $totalExpense = (float)($expRow['total_expense'] ?? 0);
        $totalExpVAT  = (float)($expRow['total_vat'] ?? 0);

        // TỔNG HỢP CÁC BÚT TOÁN KÉP (DOUBLE-ENTRY GENERAL JOURNAL ENTRIES)
        $journalEntries = [];
        $seq = 1;
        $docDate = date('Y-m-t', strtotime("$month-01"));

        // BT 1: Hạch toán chi phí lương phải trả NLĐ
        if ($effGross > 0) {
            $prefix = $isProjectedSalary ? 'PKT-EST' : 'PKT-SAL';
            $suffix = $isProjectedSalary ? ' (Dự kiến)' : '';
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "{$prefix}-{$month}-01",
                'desc'       => "Tính tiền lương phải trả nhân viên tháng {$month}{$suffix}",
                'debit_acc'  => '6422',
                'credit_acc' => '3341',
                'amount'     => $effGross,
                'type'       => $isProjectedSalary ? 'projected_payroll_salary' : 'payroll_salary'
            ];
        }

        // BT 2: Trích BHXH, BHYT, BHTN, KPCĐ tính vào chi phí doanh nghiệp (23.5%)
        if ($effInsDN > 0) {
            $prefix = $isProjectedSalary ? 'PKT-EST' : 'PKT-SAL';
            $suffix = $isProjectedSalary ? ' (Dự kiến)' : '';
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "{$prefix}-{$month}-02A",
                'desc'       => "Trích KPCĐ (2%) tính vào CP DN tháng {$month}{$suffix}",
                'debit_acc'  => '6422',
                'credit_acc' => '3382',
                'amount'     => $effKpcdDN,
                'type'       => 'payroll_insurance_dn'
            ];
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "{$prefix}-{$month}-02B",
                'desc'       => "Trích BHXH (17.5%) tính vào CP DN tháng {$month}{$suffix}",
                'debit_acc'  => '6422',
                'credit_acc' => '3383',
                'amount'     => $effBhxhDN,
                'type'       => 'payroll_insurance_dn'
            ];
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "{$prefix}-{$month}-02C",
                'desc'       => "Trích BHYT (3%) tính vào CP DN tháng {$month}{$suffix}",
                'debit_acc'  => '6422',
                'credit_acc' => '3384',
                'amount'     => $effBhytDN,
                'type'       => 'payroll_insurance_dn'
            ];
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "{$prefix}-{$month}-02D",
                'desc'       => "Trích BHTN (1%) tính vào CP DN tháng {$month}{$suffix}",
                'debit_acc'  => '6422',
                'credit_acc' => '3386',
                'amount'     => $effBhtnDN,
                'type'       => 'payroll_insurance_dn'
            ];
        }

        // BT 3: Trích các khoản bảo hiểm trừ vào lương người lao động (10.5%)
        if ($effInsNLD > 0) {
            $prefix = $isProjectedSalary ? 'PKT-EST' : 'PKT-SAL';
            $suffix = $isProjectedSalary ? ' (Dự kiến)' : '';
            if ($effBhxhNLD > 0) {
                $journalEntries[] = [
                    'seq'        => $seq++,
                    'date'       => $docDate,
                    'doc_no'     => "{$prefix}-{$month}-03A",
                    'desc'       => "Trích BHXH (8%) trừ vào lương NLĐ tháng {$month}{$suffix}",
                    'debit_acc'  => '3341',
                    'credit_acc' => '3383',
                    'amount'     => $effBhxhNLD,
                    'type'       => 'payroll_deduction_nld'
                ];
            }
            if ($effBhytNLD > 0) {
                $journalEntries[] = [
                    'seq'        => $seq++,
                    'date'       => $docDate,
                    'doc_no'     => "{$prefix}-{$month}-03B",
                    'desc'       => "Trích BHYT (1.5%) trừ vào lương NLĐ tháng {$month}{$suffix}",
                    'debit_acc'  => '3341',
                    'credit_acc' => '3384',
                    'amount'     => $effBhytNLD,
                    'type'       => 'payroll_deduction_nld'
                ];
            }
            if ($effBhtnNLD > 0) {
                $journalEntries[] = [
                    'seq'        => $seq++,
                    'date'       => $docDate,
                    'doc_no'     => "{$prefix}-{$month}-03C",
                    'desc'       => "Trích BHTN (1%) trừ vào lương NLĐ tháng {$month}{$suffix}",
                    'debit_acc'  => '3341',
                    'credit_acc' => '3386',
                    'amount'     => $effBhtnNLD,
                    'type'       => 'payroll_deduction_nld'
                ];
            }
        }

        // BT 4: Khấu trừ thuế TNCN của NLĐ
        if ($pit > 0) {
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "PKT-SAL-{$month}-04",
                'desc'       => "Khấu trừ thuế TNCN người lao động tháng {$month}",
                'debit_acc'  => '3341',
                'credit_acc' => '3335',
                'amount'     => $pit,
                'type'       => 'payroll_tax'
            ];
        }

        // BT 5: Khấu trừ tạm ứng lương
        if ($advance > 0) {
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "PKT-SAL-{$month}-05",
                'desc'       => "Khấu trừ tạm ứng lương đã nhận trong tháng {$month}",
                'debit_acc'  => '3341',
                'credit_acc' => '141',
                'amount'     => $advance,
                'type'       => 'payroll_advance'
            ];
        }

        // BT 6: Chi trả lương thực lĩnh qua tài khoản Ngân hàng
        if ($effNet > 0) {
            $prefix = $isProjectedSalary ? 'UNC-EST' : 'UNC-SAL';
            $suffix = $isProjectedSalary ? ' (Dự kiến)' : '';
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => date('Y-m-d', strtotime("$docDate +5 days")),
                'doc_no'     => "{$prefix}-{$month}-06",
                'desc'       => "Thanh toán lương thực lĩnh tháng {$month} qua Ngân hàng{$suffix}",
                'debit_acc'  => '3341',
                'credit_acc' => '1121',
                'amount'     => $effNet,
                'type'       => 'bank_payment'
            ];
        }

        // BT 7: Doanh thu Học phí / Đặt cọc
        if ($totalRevenue > 0) {
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "PT-REV-{$month}-01",
                'desc'       => "Thu tiền học phí & cọc dịch vụ tháng {$month}",
                'debit_acc'  => '1121',
                'credit_acc' => '5113',
                'amount'     => $totalRevenue,
                'type'       => 'revenue'
            ];
        }

        // BT 8: Chi phí vận hành & VAT đầu vào
        if ($totalExpense > 0) {
            $netExp = $totalExpense - $totalExpVAT;
            $journalEntries[] = [
                'seq'        => $seq++,
                'date'       => $docDate,
                'doc_no'     => "PC-EXP-{$month}-01",
                'desc'       => "Chi phí vận hành & hoạt động doanh nghiệp tháng {$month}",
                'debit_acc'  => '6422',
                'credit_acc' => '1121',
                'amount'     => $netExp > 0 ? $netExp : $totalExpense,
                'type'       => 'expense'
            ];
            if ($totalExpVAT > 0) {
                $journalEntries[] = [
                    'seq'        => $seq++,
                    'date'       => $docDate,
                    'doc_no'     => "PC-EXP-{$month}-02",
                    'desc'       => "Thuế GTGT đầu vào được khấu trừ tháng {$month}",
                    'debit_acc'  => '1331',
                    'credit_acc' => '1121',
                    'amount'     => $totalExpVAT,
                    'type'       => 'vat_in'
                ];
            }
        }

        $totalDebit = array_reduce($journalEntries, fn($s, $e) => $s + $e['amount'], 0.0);
        $totalCredit = $totalDebit;

        respond(200, [
            'month'        => $month,
            'entries'      => $journalEntries,
            'summary'      => [
                'total_entries' => count($journalEntries),
                'total_debit'   => $totalDebit,
                'total_credit'  => $totalCredit,
                'is_balanced'   => true,
                'total_gross'   => $effGross,
                'total_net'     => $effNet,
                'total_tax_pit' => $pit,
                'total_ins_nld' => $effInsNLD,
                'total_ins_dn'  => $effInsDN,
                'total_revenue' => $totalRevenue,
                'total_expense' => $totalExpense,
                'is_projected'  => $isProjectedSalary,
            ]
        ], 'Lấy sổ nhật ký chung và bút toán hạch toán thành công');
    }

    /**
     * GET /api/hrm/accounting-az/tax-declaration
     * Tờ khai TNCN 05/KK (tháng/quý) và 05/QTT (năm) chuẩn HTKK
     */
    public function getTaxDeclaration(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $type = trim($_GET['type'] ?? 'Q'); // 'M' | 'Q' | 'Y' (Quyết toán)
        $num  = (int)($_GET['num'] ?? 3);   // Quý 1-4 hoặc Tháng 1-12
        $year = (int)($_GET['year'] ?? date('Y'));

        // Lấy toàn bộ payslip của kỳ kê khai
        $monthCondition = "";
        $binds = [$tid];
        if ($type === 'M') {
            $targetMonth = sprintf('%04d-%02d', $year, $num);
            $monthCondition = "mp.month_year = ?";
            $binds[] = $targetMonth;
        } elseif ($type === 'Q') {
            $mStart = ($num - 1) * 3 + 1;
            $mEnd   = $num * 3;
            $months = [];
            for ($i = $mStart; $i <= $mEnd; $i++) {
                $months[] = sprintf('%04d-%02d', $year, $i);
            }
            $inClause = implode(',', array_fill(0, count($months), '?'));
            $monthCondition = "mp.month_year IN ($inClause)";
            $binds = array_merge($binds, $months);
        } else {
            // Cả năm
            $monthCondition = "mp.month_year LIKE ?";
            $binds[] = "{$year}-%";
        }

        $sql = "
            SELECT 
                u.id as user_id, u.full_name, u.citizen_id, u.email, u.avatar_url, u.avatar_url as avatar, u.job_title,
                COALESCE(SUM(mp.salary_basic_calculated + mp.allowance_total + mp.kpi_bonus + mp.overtime_salary + mp.diligence_bonus), 0) as gross,
                COALESCE(SUM(mp.tax_pit), 0) as pit,
                COALESCE(SUM(mp.insurance_bhxh + mp.insurance_bhyt + mp.insurance_bhtn), 0) as ins_nld
            FROM monthly_payslips mp
            JOIN users u ON mp.user_id = u.id
            WHERE u.tenant_id = ? AND {$monthCondition}
            GROUP BY u.id, u.full_name, u.citizen_id, u.email, u.avatar_url, u.job_title
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);
        $employees = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $ct16 = count($employees);
        $ct17 = $ct16;
        $taxPayerEmps = array_filter($employees, fn($e) => ((float)($e['pit'] ?? 0)) > 0);
        $ct18 = count($taxPayerEmps);
        $ct19 = $ct18;
        $ct20 = 0;

        $ct21 = array_reduce($employees, fn($s, $e) => $s + (float)$e['gross'], 0.0);
        $ct22 = $ct21;
        $ct23 = 0.0;

        $ct26 = array_reduce($taxPayerEmps, fn($s, $e) => $s + (float)$e['gross'], 0.0);
        $ct27 = $ct26;
        $ct28 = 0.0;

        $ct29 = array_reduce($employees, fn($s, $e) => $s + (float)$e['pit'], 0.0);
        $ct30 = $ct29;
        $ct31 = 0.0;

        $indicators = [
            'ct16' => $ct16,
            'ct17' => $ct17,
            'ct18' => $ct18,
            'ct19' => $ct19,
            'ct20' => $ct20,
            'ct21' => round($ct21),
            'ct22' => round($ct22),
            'ct23' => round($ct23),
            'ct24' => 0,
            'ct25' => 0,
            'ct26' => round($ct26),
            'ct27' => round($ct27),
            'ct28' => round($ct28),
            'ct29' => round($ct29),
            'ct30' => round($ct30),
            'ct31' => round($ct31),
            'ct32' => 0,
            'ct15' => 0,
        ];

        $qttIndicators = array_merge($indicators, [
            'ct35' => $ct16,
            'ct36' => round($ct29),
            'ct37' => 0,
            'ct38' => round($ct29),
            'ct39' => 0,
            'ct40' => 0,
            'ct41' => 0,
        ]);

        respond(200, [
            'type'        => $type,
            'num'         => $num,
            'year'        => $year,
            'indicators'  => ($type === 'Y') ? $qttIndicators : $indicators,
            'employees'   => $employees,
            'employee_count' => count($employees)
        ], 'Lấy số liệu tờ khai thuế TNCN thành công');
    }

    /**
     * POST /api/hrm/accounting-az/generate-htkk-xml
     * Xuất file XML chuẩn HTKK 05/KK-TNCN hoặc 05/QTT-TNCN
     */
    public function generateHtkkXml(array $auth): void {
        $body = getBody();
        $type = trim((string)($body['type'] ?? 'Q'));
        $num  = (int)($body['num'] ?? 3);
        $year = (int)($body['year'] ?? date('Y'));
        $taxInd = $body['indicators'] ?? [];

        $mst = trim((string)($body['company_mst'] ?? '0101234567'));
        $tenNNT = htmlspecialchars(trim((string)($body['company_name'] ?? 'CÔNG TY TNHH MYERP')), ENT_XML1);
        $nguoiKy = htmlspecialchars(trim((string)($body['signer'] ?? 'NGUYEN VAN A')), ENT_XML1);
        $cqtMa   = trim((string)($body['cqt_code'] ?? '70711'));
        $cqtTen  = htmlspecialchars(trim((string)($body['cqt_name'] ?? 'Chi cục Thuế')), ENT_XML1);
        $today   = date('Y-m-d');

        if ($type === 'Y') {
            $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
            $xml .= "<HSoThueDTu xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns=\"http://kekhaithue.gdt.gov.vn/TKhaiThue\">\n";
            $xml .= "  <HSoKhaiThue id=\"ID_1\">\n";
            $xml .= "    <TTinChung>\n";
            $xml .= "      <TTinDVu><maDVu>HTKK</maDVu><tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu><pbanDVu>5.7.9</pbanDVu></TTinDVu>\n";
            $xml .= "      <TTinTKhaiThue>\n";
            $xml .= "        <TKhaiThue>\n";
            $xml .= "          <maTKhai>953</maTKhai>\n";
            $xml .= "          <tenTKhai>TỜ KHAI QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN (Mẫu số 05/QTT-TNCN)</tenTKhai>\n";
            $xml .= "          <pbanTKhaiXML>2.9.3</pbanTKhaiXML>\n";
            $xml .= "          <loaiTKhai>C</loaiTKhai><soLan>0</soLan>\n";
            $xml .= "          <KyKKhaiThue><kieuKy>Y</kieuKy><kyKKhai>{$year}</kyKKhai></KyKKhaiThue>\n";
            $xml .= "          <maCQTNoiNop>{$cqtMa}</maCQTNoiNop><tenCQTNoiNop>{$cqtTen}</tenCQTNoiNop>\n";
            $xml .= "          <ngayLapTKhai>{$today}</ngayLapTKhai><nguoiKy>{$nguoiKy}</nguoiKy><ngayKy>{$today}</ngayKy>\n";
            $xml .= "        </TKhaiThue>\n";
            $xml .= "        <NNT><mst>{$mst}</mst><tenNNT>{$tenNNT}</tenNNT></NNT>\n";
            $xml .= "      </TTinTKhaiThue>\n";
            $xml .= "    </TTinChung>\n";
            $xml .= "    <CTieuTKhaiChinh>\n";
            for ($i = 16; $i <= 41; $i++) {
                $val = (int)($taxInd["ct{$i}"] ?? 0);
                $xml .= "      <ct{$i}>{$val}</ct{$i}>\n";
            }
            $xml .= "    </CTieuTKhaiChinh>\n";
            $xml .= "  </HSoKhaiThue>\n";
            $xml .= "</HSoThueDTu>";
            $filename = "{$mst}-05-QTT-TNCN-{$year}.xml";
        } else {
            $kyStr = ($type === 'Q') ? "{$num}/{$year}" : sprintf('%02d/%d', $num, $year);
            $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
            $xml .= "<HSoThueDTu xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns=\"http://kekhaithue.gdt.gov.vn/TKhaiThue\">\n";
            $xml .= "  <HSoKhaiThue id=\"ID_1\">\n";
            $xml .= "    <TTinChung>\n";
            $xml .= "      <TTinDVu><maDVu>HTKK</maDVu><tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu><pbanDVu>5.7.8</pbanDVu></TTinDVu>\n";
            $xml .= "      <TTinTKhaiThue>\n";
            $xml .= "        <TKhaiThue>\n";
            $xml .= "          <maTKhai>864</maTKhai>\n";
            $xml .= "          <tenTKhai>TK khấu trừ thuế thu nhập cá nhân Mẫu 05/KK-TNCN (TT80/2021)</tenTKhai>\n";
            $xml .= "          <pbanTKhaiXML>2.9.3</pbanTKhaiXML>\n";
            $xml .= "          <loaiTKhai>C</loaiTKhai><soLan>0</soLan>\n";
            $xml .= "          <KyKKhaiThue><kieuKy>{$type}</kieuKy><kyKKhai>{$kyStr}</kyKKhai></KyKKhaiThue>\n";
            $xml .= "          <maCQTNoiNop>{$cqtMa}</maCQTNoiNop><tenCQTNoiNop>{$cqtTen}</tenCQTNoiNop>\n";
            $xml .= "          <ngayLapTKhai>{$today}</ngayLapTKhai><nguoiKy>{$nguoiKy}</nguoiKy><ngayKy>{$today}</ngayKy>\n";
            $xml .= "        </TKhaiThue>\n";
            $xml .= "        <NNT><mst>{$mst}</mst><tenNNT>{$tenNNT}</tenNNT></NNT>\n";
            $xml .= "      </TTinTKhaiThue>\n";
            $xml .= "    </TTinChung>\n";
            $xml .= "    <CTieuTKhaiChinh>\n";
            for ($i = 15; $i <= 32; $i++) {
                $val = (int)($taxInd["ct{$i}"] ?? 0);
                $xml .= "      <ct{$i}>{$val}</ct{$i}>\n";
            }
            $xml .= "    </CTieuTKhaiChinh>\n";
            $xml .= "  </HSoKhaiThue>\n";
            $xml .= "</HSoThueDTu>";
            $filename = "{$mst}-05-KK-TNCN-" . str_replace('/', '_', $kyStr) . ".xml";
        }

        respond(200, [
            'filename' => $filename,
            'xml'      => $xml,
            'size'     => strlen($xml)
        ], 'Tạo tệp XML HTKK thành công');
    }

    /**
     * GET /api/hrm/accounting-az/labor-book
     * Sổ Quản Lý Lao Động (Khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP)
     */
    public function getLaborBook(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $year = (int)($_GET['year'] ?? date('Y'));

        $sql = "
            SELECT 
                u.id, u.full_name, u.gender, u.dob, u.citizen_id, u.address, u.phone, u.email,
                u.job_title, u.created_at as joined_date, u.is_active, u.avatar_url, u.avatar_url as avatar,
                p.base_salary, p.deal_salary, p.annual_leave_used, p.annual_leave_total,
                lc.contract_type as last_contract_type,
                lc.start_date as contract_start_date,
                lc.end_date as contract_end_date,
                lc.contract_code as contract_code,
                COALESCE(ot.total_ot_hours, 0) as total_ot_hours
            FROM users u
            LEFT JOIN hrm_profiles p ON u.id = p.user_id
            LEFT JOIN (
                SELECT c1.user_id, c1.contract_type, c1.start_date, c1.end_date, c1.contract_code
                FROM hrm_contracts c1
                INNER JOIN (
                    SELECT user_id, MAX(id) as max_id
                    FROM hrm_contracts
                    GROUP BY user_id
                ) c2 ON c1.id = c2.max_id
            ) lc ON lc.user_id = u.id
            LEFT JOIN (
                SELECT user_id, SUM(COALESCE(overtime_days, 0) * 8) as total_ot_hours
                FROM monthly_payslips
                WHERE month_year LIKE ?
                GROUP BY user_id
            ) ot ON ot.user_id = u.id
            WHERE u.tenant_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
            ORDER BY u.id ASC
        ";
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute(["{$year}-%", $tid]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
            $stmt = $this->db->prepare("
                SELECT u.id, u.full_name, u.gender, u.dob, u.citizen_id, u.address, u.phone, u.email,
                       u.job_title, u.created_at as joined_date, u.is_active, u.avatar_url, u.avatar_url as avatar,
                       p.base_salary, p.deal_salary, p.annual_leave_used, p.annual_leave_total
                FROM users u
                LEFT JOIN hrm_profiles p ON u.id = p.user_id
                WHERE u.tenant_id = ? AND u.role NOT IN ('superadmin', 'super_admin') AND u.email != 'info@ideas.edu.vn'
                ORDER BY u.id ASC
            ");
            $stmt->execute([$tid]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        $headers = [
            'STT', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Quốc tịch', 'Nơi cư trú', 'Số CCCD/Hộ chiếu',
            'Trình độ CMKT', 'Bậc kỹ năng nghề', 'Vị trí việc làm', 'Loại HĐLĐ', 'Ngày bắt đầu HĐ',
            'Ngày chấm dứt HĐ', 'Lý do chấm dứt', 'Mức lương theo HĐ', 'Số sổ BHXH',
            'Số ngày phép đã nghỉ', 'Số giờ làm thêm trong năm', 'Nâng lương/bậc', 'Đào tạo/bồi dưỡng', 'Kỷ luật/TNLĐ'
        ];

        $laborBookRecords = [];
        foreach ($rows as $i => $r) {
            $ctTypeStr = match (strtolower((string)($r['last_contract_type'] ?? ''))) {
                'kxd', 'indefinite' => 'HĐ không xác định thời hạn',
                'xd', 'definite', 'fixed_term' => 'HĐ xác định thời hạn',
                'tv', 'probation'   => 'Hợp đồng thử việc',
                'dv', 'service'     => 'HĐ dịch vụ / CTV',
                default             => 'Chưa ký HĐ'
            };

            $rawGender = strtolower(trim((string)($r['gender'] ?? '')));
            $genderVi = match ($rawGender) {
                'female', 'nữ', 'nu', 'f' => 'Nữ',
                'male', 'nam', 'm' => 'Nam',
                default => !empty($r['gender']) ? $r['gender'] : 'Nam'
            };

            $laborBookRecords[] = [
                'stt'              => $i + 1,
                'user_id'          => (int)$r['id'],
                'full_name'        => $r['full_name'],
                'avatar_url'       => $r['avatar_url'] ?? null,
                'avatar'           => $r['avatar_url'] ?? null,
                'email'            => $r['email'] ?? '',
                'gender'           => $genderVi,
                'dob'              => !empty($r['dob']) ? date('d/m/Y', strtotime($r['dob'])) : '',
                'nationality'      => 'Việt Nam',
                'address'          => $r['address'] ?? '',
                'citizen_id'       => $r['citizen_id'] ?? '',
                'qualification'    => 'Đại học / Cao đẳng',
                'skill_level'      => '',
                'job_title'        => !empty($r['job_title']) ? $r['job_title'] : 'Nhân viên',
                'contract_type'    => $ctTypeStr,
                'contract_start'   => !empty($r['contract_start_date']) ? date('d/m/Y', strtotime($r['contract_start_date'])) : (!empty($r['joined_date']) ? date('d/m/Y', strtotime($r['joined_date'])) : '—'),
                'contract_end'     => !empty($r['contract_end_date']) ? date('d/m/Y', strtotime($r['contract_end_date'])) : '—',
                'termination_reason'=> ((int)($r['is_active'] ?? 1) === 0) ? 'Hết hạn HĐ / Thỏa thuận chấm dứt' : '',
                'salary'           => (float)(($r['base_salary'] ?? 0) > 0 ? $r['base_salary'] : ($r['deal_salary'] ?? 0)),
                'insurance_book_no'=> '',
                'annual_leave_used'=> (float)($r['annual_leave_used'] ?? 0),
                'total_ot_hours'   => (float)($r['total_ot_hours'] ?? 0),
                'salary_raise'     => '',
                'training'         => '',
                'discipline'       => ''
            ];
        }

        respond(200, [
            'year'    => $year,
            'headers' => $headers,
            'records' => $laborBookRecords,
            'total'   => count($laborBookRecords)
        ], 'Lấy sổ quản lý lao động thành công');
    }

    /**
     * POST /api/hrm/accounting-az/calculate-benefits
     * Máy tính chế độ Thai sản & Trợ cấp thôi việc/mất việc
     */
    public function calculateBenefits(array $auth): void {
        $body = getBody();
        $type = trim((string)($body['benefit_type'] ?? 'maternity'));
        $avgSalary = (float)($body['average_salary'] ?? 0);
        $workYears = (float)($body['work_years'] ?? 0);
        $unemploymentYears = (float)($body['unemployment_insured_years'] ?? 0);

        $params = $this->getLegalParameters();
        $lcs = $params['luong_co_so'];

        if ($type === 'maternity') {
            $maternityAllowance = $avgSalary * 6;
            $oneTimeAllowance = 2 * $lcs;
            $totalBenefit = $maternityAllowance + $oneTimeAllowance;

            respond(200, [
                'benefit_type'         => 'maternity',
                'average_salary'       => $avgSalary,
                'luong_co_so'          => $lcs,
                'maternity_allowance'  => round($maternityAllowance),
                'one_time_allowance'   => round($oneTimeAllowance),
                'total_benefit'        => round($totalBenefit),
                'notes'                => 'Mức hưởng thai sản 6 tháng + Trợ cấp 1 lần bằng 2 lần lương cơ sở (Điều 38 Luật BHXH).'
            ], 'Tính chế độ thai sản thành công');
        } elseif ($type === 'severance') {
            $eligibleYears = max(0.0, $workYears - $unemploymentYears);
            $eligibleMonths = ceil($eligibleYears * 2) / 2;
            $allowance = $eligibleMonths * 0.5 * $avgSalary;

            respond(200, [
                'benefit_type'         => 'severance',
                'work_years'           => $workYears,
                'unemployment_years'   => $unemploymentYears,
                'eligible_years'       => $eligibleYears,
                'average_salary'       => $avgSalary,
                'total_allowance'      => round($allowance),
                'notes'                => 'Trợ cấp thôi việc: Mỗi năm làm việc không tham gia BHTN tính bằng 1/2 tháng lương bình quân 6 tháng liền kề (Điều 46 BLLĐ 2019).'
            ], 'Tính trợ cấp thôi việc thành công');
        } else {
            $eligibleYears = max(0.0, $workYears - $unemploymentYears);
            $allowance = max(2.0 * $avgSalary, $eligibleYears * $avgSalary);

            respond(200, [
                'benefit_type'         => 'job_loss',
                'work_years'           => $workYears,
                'unemployment_years'   => $unemploymentYears,
                'eligible_years'       => $eligibleYears,
                'average_salary'       => $avgSalary,
                'total_allowance'      => round($allowance),
                'notes'                => 'Trợ cấp mất việc làm: Mỗi năm làm việc không tham gia BHTN tính bằng 1 tháng lương, tối thiểu 2 tháng lương (Điều 47 BLLĐ 2019).'
            ], 'Tính trợ cấp mất việc làm thành công');
        }
    }
}

