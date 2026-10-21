<?php
/**
 * AgentHrmAttendanceTools.php - Pillar 2: HRM, Personal HR, User Account, Attendance,
 * Workdays, Leave/OT & Payroll 100% Schema AI Engine for SI IDEAS (MYERP).
 *
 * Enforces Zero-Trust RBAC, Atomic Transactions, 100% Real MySQL Schema Parity,
 * and Gender Late Grace Quota (Điều 14 NQLĐ QĐ 001/2024: Nữ 60p/tháng, Nam 30p/tháng).
 */

class AgentHrmAttendanceTools
{
    /**
     * Return 2 comprehensive Gemini function declarations for Pillar 2 (Personal HR & Enterprise HRM/Payroll)
     */
    public static function getToolDeclarations(): array
    {
        return [
            [
                'name' => 'manage_my_hr_profile_and_requests',
                'description' => 'Công cụ tự phục vụ 360 độ cho cá nhân nhân sự và tài khoản User: Xem toàn bộ hồ sơ cá nhân, hợp đồng, tài sản cấp phát, quỹ phép năm/nghỉ bù, định mức đi trễ (Nữ 60p / Nam 30p); tự cập nhật thông tin tài khoản cá nhân (SĐT, ngày sinh, giới tính, CCCD, địa chỉ, ngân hàng nhận lương, tiểu sử, chế độ nghỉ phép); tra cứu lịch sử đơn từ; tạo hoặc hủy đơn xin nghỉ phép/WFH/đi trễ về sớm/tăng ca OT/ứng lương/giải trình công; và xác nhận hoặc khiếu nại bảng công tháng (attendance_confirmations) cũng như phiếu lương tháng (monthly_payslips).',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'action' => [
                            'type' => 'STRING',
                            'enum' => [
                                'get_my_full_profile',
                                'update_my_profile',
                                'list_my_requests',
                                'create_leave_or_ot_request',
                                'cancel_my_request',
                                'create_supplement_attendance',
                                'create_salary_advance',
                                'get_my_attendance_confirmation',
                                'confirm_or_dispute_my_attendance',
                                'confirm_or_dispute_my_payslip'
                            ],
                            'description' => 'Hành động tự phục vụ cá nhân cần thực hiện'
                        ],
                        'phone' => [
                            'type' => 'STRING',
                            'description' => 'Số điện thoại cá nhân cập nhật'
                        ],
                        'dob' => [
                            'type' => 'STRING',
                            'description' => 'Ngày sinh (YYYY-MM-DD)'
                        ],
                        'gender' => [
                            'type' => 'STRING',
                            'enum' => ['male', 'female'],
                            'description' => 'Giới tính (male: Nam - định mức trễ 30p/tháng, female: Nữ - định mức trễ 60p/tháng)'
                        ],
                        'citizen_id' => [
                            'type' => 'STRING',
                            'description' => 'Số CCCD / CMND cá nhân'
                        ],
                        'address' => [
                            'type' => 'STRING',
                            'description' => 'Địa chỉ thường trú / liên hệ'
                        ],
                        'bank_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên ngân hàng nhận lương'
                        ],
                        'bank_account' => [
                            'type' => 'STRING',
                            'description' => 'Số tài khoản ngân hàng nhận lương'
                        ],
                        'bio' => [
                            'type' => 'STRING',
                            'description' => 'Tiểu sử / giới thiệu bản thân'
                        ],
                        'vacation_mode' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Bật/tắt chế độ đang nghỉ phép (vacation_mode) để tạm dừng nhận phân bổ Lead tự động'
                        ],
                        'request_type' => [
                            'type' => 'STRING',
                            'enum' => ['leave', 'supplement_attendance', 'bulk_attendance', 'salary_advance'],
                            'description' => 'Loại đơn từ cần tra cứu hoặc hủy'
                        ],
                        'request_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID của đơn từ cần hủy hoặc xem chi tiết'
                        ],
                        'leave_type' => [
                            'type' => 'STRING',
                            'enum' => [
                                'annual',
                                'compensatory',
                                'sick',
                                'unpaid',
                                'remote_work',
                                'business_trip',
                                'late_early',
                                'overtime',
                                'marriage',
                                'funeral',
                                'maternity',
                                'paternity'
                            ],
                            'description' => 'Loại đơn nghỉ phép / WFH / OT / đi trễ về sớm / công tác'
                        ],
                        'ot_type' => [
                            'type' => 'STRING',
                            'enum' => ['salary', 'compensatory'],
                            'description' => 'Hình thức tính tăng ca OT: salary (tính lương OT) hoặc compensatory (cộng vào quỹ nghỉ bù)'
                        ],
                        'start_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày/giờ bắt đầu nghỉ phép hoặc OT (YYYY-MM-DD hoặc YYYY-MM-DD HH:mm:ss)'
                        ],
                        'end_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày/giờ kết thúc nghỉ phép hoặc OT (YYYY-MM-DD hoặc YYYY-MM-DD HH:mm:ss)'
                        ],
                        'total_days' => [
                            'type' => 'NUMBER',
                            'description' => 'Tổng số ngày nghỉ phép / WFH / OT (ví dụ: 0.5, 1, 2)'
                        ],
                        'reason' => [
                            'type' => 'STRING',
                            'description' => 'Lý do xin nghỉ phép / WFH / OT / bổ sung công / ứng lương'
                        ],
                        'amount' => [
                            'type' => 'NUMBER',
                            'description' => 'Số tiền xin tạm ứng lương (VNĐ)'
                        ],
                        'check_in_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày cần giải trình / bổ sung chấm công (YYYY-MM-DD)'
                        ],
                        'suggested_check_in' => [
                            'type' => 'STRING',
                            'description' => 'Giờ vào đề xuất bổ sung (HH:mm, ví dụ 08:00)'
                        ],
                        'suggested_check_out' => [
                            'type' => 'STRING',
                            'description' => 'Giờ ra đề xuất bổ sung (HH:mm, ví dụ 17:00)'
                        ],
                        'approver_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID người phê duyệt đơn (tùy chọn, hệ thống tự động tìm Quản lý trực tiếp nếu để trống)'
                        ],
                        'approver_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên người phê duyệt đơn (tùy chọn)'
                        ],
                        'month' => [
                            'type' => 'INTEGER',
                            'description' => 'Tháng cần tra cứu / xác nhận bảng công (1-12)'
                        ],
                        'year' => [
                            'type' => 'INTEGER',
                            'description' => 'Năm cần tra cứu / xác nhận bảng công (ví dụ 2026)'
                        ],
                        'month_year' => [
                            'type' => 'STRING',
                            'description' => 'Kỳ tháng/năm (định dạng YYYY-MM, ví dụ 2026-10)'
                        ],
                        'confirmation_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID bản ghi đối soát công (attendance_confirmations.id) hoặc phiếu lương (monthly_payslips.id)'
                        ],
                        'decision' => [
                            'type' => 'STRING',
                            'enum' => ['confirm', 'dispute'],
                            'description' => 'Quyết định của nhân viên: confirm (xác nhận đồng ý) hoặc dispute (khiếu nại sai lệch)'
                        ],
                        'dispute_reason' => [
                            'type' => 'STRING',
                            'description' => 'Nội dung chi tiết lý do khiếu nại bảng công hoặc phiếu lương'
                        ]
                    ],
                    'required' => ['action']
                ]
            ],
            [
                'name' => 'smart_manage_hrm_and_payroll',
                'description' => 'Công cụ Quản trị Nhân sự (HR), Chấm công, Đơn từ, Xác nhận công & Bảng lương toàn công ty (dành cho HR, Admin, Ban Giám đốc, Kế toán và Trưởng phòng trong phạm vi quyền hạn): Tra cứu 360 độ nhân sự trên 100% trường (users, hrm_profiles, hrm_contracts, hrm_assets, monthly_payslips, attendance_confirmations); cập nhật hồ sơ/lương/phụ cấp/quỹ phép/giới tính/giờ làm việc của nhân sự; quản lý hợp đồng & tài sản; duyệt/từ chối đơn nghỉ phép, WFH, OT, giải trình công, ứng lương; xử lý khiếu nại công; và cập nhật/tính toán phiếu lương tháng (áp dụng chuẩn định mức trễ Nữ 60p / Nam 30p).',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'action' => [
                            'type' => 'STRING',
                            'enum' => [
                                'query_staff_360',
                                'update_employee_hr_profile',
                                'manage_contract',
                                'manage_asset',
                                'approve_or_reject_hr_request',
                                'recalculate_leave_balance',
                                'get_attendance_confirmations',
                                'resolve_attendance_dispute',
                                'update_payslip_adjustments'
                            ],
                            'description' => 'Hành động quản trị Nhân sự & Bảng lương cần thực hiện'
                        ],
                        'employee_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID của nhân sự mục tiêu (users.id)'
                        ],
                        'employee_name' => [
                            'type' => 'STRING',
                            'description' => 'Họ tên, email hoặc mã username của nhân sự mục tiêu'
                        ],
                        'department' => [
                            'type' => 'STRING',
                            'description' => 'Phòng ban của nhân sự'
                        ],
                        'job_title' => [
                            'type' => 'STRING',
                            'description' => 'Chức danh công việc'
                        ],
                        'role' => [
                            'type' => 'STRING',
                            'description' => 'Vai trò hệ thống (sales, marketing, hr, accountant, manager, director, admin)'
                        ],
                        'team_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID đội nhóm (teams.id)'
                        ],
                        'gender' => [
                            'type' => 'STRING',
                            'enum' => ['male', 'female'],
                            'description' => 'Giới tính (male: Nam - định mức trễ 30p/tháng, female: Nữ - định mức trễ 60p/tháng)'
                        ],
                        'dob' => [
                            'type' => 'STRING',
                            'description' => 'Ngày sinh (YYYY-MM-DD)'
                        ],
                        'citizen_id' => [
                            'type' => 'STRING',
                            'description' => 'Số CCCD / CMND'
                        ],
                        'phone' => [
                            'type' => 'STRING',
                            'description' => 'Số điện thoại nhân sự'
                        ],
                        'address' => [
                            'type' => 'STRING',
                            'description' => 'Địa chỉ liên hệ'
                        ],
                        'bank_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên ngân hàng nhận lương'
                        ],
                        'bank_account' => [
                            'type' => 'STRING',
                            'description' => 'Số tài khoản ngân hàng'
                        ],
                        'status' => [
                            'type' => 'STRING',
                            'enum' => ['active', 'inactive', 'leave'],
                            'description' => 'Trạng thái làm việc của nhân sự'
                        ],
                        'work_start_time' => [
                            'type' => 'STRING',
                            'description' => 'Giờ bắt đầu ca làm việc riêng (HH:mm, ví dụ 08:00)'
                        ],
                        'work_end_time' => [
                            'type' => 'STRING',
                            'description' => 'Giờ kết thúc ca làm việc riêng (HH:mm, ví dụ 17:00)'
                        ],
                        'use_custom_work_hours' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Áp dụng khung giờ làm việc riêng cho nhân sự này'
                        ],
                        'joined_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày chính thức vào làm việc (YYYY-MM-DD)'
                        ],
                        'base_salary' => [
                            'type' => 'NUMBER',
                            'description' => 'Mức lương cơ bản đóng BHXH (VNĐ)'
                        ],
                        'deal_salary' => [
                            'type' => 'NUMBER',
                            'description' => 'Mức lương thỏa thuận thực tế (VNĐ)'
                        ],
                        'has_insurance' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Có tham gia đóng bảo hiểm BHXH/BHYT/BHTN hay không'
                        ],
                        'allowance_meal' => [
                            'type' => 'NUMBER',
                            'description' => 'Mức phụ cấp cơm trưa (VNĐ)'
                        ],
                        'allowance_meal_type' => [
                            'type' => 'STRING',
                            'enum' => ['per_day', 'fixed'],
                            'description' => 'Cách tính phụ cấp cơm: per_day (theo ngày công thực tế) hoặc fixed (cố định tháng)'
                        ],
                        'allowance_travel' => [
                            'type' => 'NUMBER',
                            'description' => 'Phụ cấp xăng xe / đi lại cố định tháng (VNĐ)'
                        ],
                        'allowance_phone' => [
                            'type' => 'NUMBER',
                            'description' => 'Phụ cấp điện thoại cố định tháng (VNĐ)'
                        ],
                        'kpi_target' => [
                            'type' => 'NUMBER',
                            'description' => 'Chỉ tiêu doanh số KPI tháng (VNĐ)'
                        ],
                        'annual_leave_total' => [
                            'type' => 'NUMBER',
                            'description' => 'Tổng quỹ phép năm được cấp (ngày)'
                        ],
                        'compensatory_leave_total' => [
                            'type' => 'NUMBER',
                            'description' => 'Tổng quỹ phép nghỉ bù được cấp (ngày)'
                        ],
                        'contract_code' => [
                            'type' => 'STRING',
                            'description' => 'Mã hợp đồng lao động (hrm_contracts.contract_code)'
                        ],
                        'contract_type' => [
                            'type' => 'STRING',
                            'description' => 'Loại hợp đồng (probation: thử việc, official_1y: 1 năm, official_3y: 3 năm, indefinite: không thời hạn, part_time, intern)'
                        ],
                        'start_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày hiệu lực hợp đồng (YYYY-MM-DD)'
                        ],
                        'end_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày hết hạn hợp đồng (YYYY-MM-DD)'
                        ],
                        'probation_rate' => [
                            'type' => 'NUMBER',
                            'description' => 'Tỷ lệ hưởng lương thử việc (%, ví dụ 85 hoặc 100)'
                        ],
                        'asset_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID tài sản cấp phát (hrm_assets.id)'
                        ],
                        'asset_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên tài sản cấp phát (Laptop, Màn hình, Điện thoại...)'
                        ],
                        'asset_code' => [
                            'type' => 'STRING',
                            'description' => 'Mã tài sản / Serial Number'
                        ],
                        'given_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày bàn giao tài sản (YYYY-MM-DD)'
                        ],
                        'returned_date' => [
                            'type' => 'STRING',
                            'description' => 'Ngày thu hồi tài sản (YYYY-MM-DD)'
                        ],
                        'condition_note' => [
                            'type' => 'STRING',
                            'description' => 'Ghi chú tình trạng tài sản'
                        ],
                        'asset_status' => [
                            'type' => 'STRING',
                            'description' => 'Trạng thái tài sản (in_use, returned, damaged, lost)'
                        ],
                        'request_type' => [
                            'type' => 'STRING',
                            'enum' => ['leave', 'check_in', 'bulk_attendance', 'salary_advance'],
                            'description' => 'Loại phiếu nhân sự cần duyệt hoặc từ chối'
                        ],
                        'request_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID của phiếu cần duyệt / từ chối hoặc mã ID bản ghi đối soát công cần xử lý khiếu nại'
                        ],
                        'decision' => [
                            'type' => 'STRING',
                            'enum' => ['approve', 'reject'],
                            'description' => 'Quyết định phê duyệt: approve (duyệt) hoặc reject (từ chối)'
                        ],
                        'reason' => [
                            'type' => 'STRING',
                            'description' => 'Ghi chú phê duyệt / lý do từ chối / phản hồi giải quyết khiếu nại'
                        ],
                        'month_year' => [
                            'type' => 'STRING',
                            'description' => 'Kỳ lương hoặc kỳ công tháng (YYYY-MM, ví dụ 2026-10)'
                        ],
                        'diligence_bonus' => [
                            'type' => 'NUMBER',
                            'description' => 'Thưởng chuyên cần điều chỉnh trên phiếu lương (VNĐ)'
                        ],
                        'kpi_bonus' => [
                            'type' => 'NUMBER',
                            'description' => 'Thưởng KPI điều chỉnh trên phiếu lương (VNĐ)'
                        ],
                        'overtime_days' => [
                            'type' => 'NUMBER',
                            'description' => 'Số ngày công tăng ca OT điều chỉnh trên phiếu lương'
                        ],
                        'overtime_salary' => [
                            'type' => 'NUMBER',
                            'description' => 'Tiền lương tăng ca OT điều chỉnh trên phiếu lương (VNĐ)'
                        ],
                        'payslip_status' => [
                            'type' => 'STRING',
                            'description' => 'Trạng thái phiếu lương (draft, sent, confirmed, paid, disputed)'
                        ],
                        'note' => [
                            'type' => 'STRING',
                            'description' => 'Ghi chú trên phiếu lương hoặc đối soát công'
                        ],
                        'custom_rules' => [
                            'type' => 'STRING',
                            'description' => 'Chuỗi JSON mảng điều kiện lọc nâng cao [{field, operator, value, valueTo}] trên các bảng users, hrm_profiles, monthly_payslips'
                        ]
                    ],
                    'required' => ['action']
                ]
            ]
        ];
    }

    /**
     * Resolve employee gender & monthly late grace quota (Điều 14 NQLĐ QĐ 001/2024: Nữ 60p/tháng, Nam 30p/tháng)
     */
    public static function resolveEmployeeLateQuota(PDO $db, ?string $rawGender, ?string $fullName): array
    {
        $graceMale = 30;
        $graceFemale = 60;
        try {
            $stmtG = $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('hrm_late_grace_male', 'hrm_late_grace_female')");
            if ($stmtG) {
                foreach ($stmtG->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    if ($r['setting_key'] === 'hrm_late_grace_male' && is_numeric($r['setting_value'])) {
                        $graceMale = (int)$r['setting_value'];
                    } elseif ($r['setting_key'] === 'hrm_late_grace_female' && is_numeric($r['setting_value'])) {
                        $graceFemale = (int)$r['setting_value'];
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        $g = mb_strtolower(trim((string)$rawGender), 'UTF-8');
        $isMale = in_array($g, ['male', 'nam', 'm', '1', 'boy', 'man'], true);
        $isFemale = in_array($g, ['female', 'nữ', 'nu', 'f', '0', 'girl', 'woman'], true);

        if (!$isMale && !$isFemale && !empty($fullName)) {
            $n = ' ' . mb_strtolower(trim($fullName), 'UTF-8') . ' ';
            if (preg_match('/(\sthị\s|\snữ\s|\sngọc\s|\stuyết\s|\strâm\s|\sthảo\s|\suyên\s|\snhi\s|\strân\s|\slan\s|\shuyền\s|\sái\s|\sthoa\s|\sthương\s|\sngân\s|\slinh\s|\sthi\s)/iu', $n)) {
                $isFemale = true;
            } elseif (preg_match('/(\svăn\s|\sđình\s|\strọng\s|\shoàng\s|\sgia\s|\strí\s|\squốc\s|\strùng\s|\squang\s)/iu', $n)) {
                $isMale = true;
            }
        }

        $resolvedGender = $isMale ? 'male' : 'female';
        return [
            'gender' => $resolvedGender,
            'gender_label' => $isMale ? 'Nam' : 'Nữ',
            'grace_minutes' => $isMale ? $graceMale : $graceFemale,
            'grace_male_setting' => $graceMale,
            'grace_female_setting' => $graceFemale
        ];
    }

    /**
     * Accurately recalculates annual_leave_used and compensatory_leave_total / compensatory_leave_used
     * from hrm_leave_requests and monthly_payslips in the current year, updates hrm_profiles, and returns the updated balance.
     */
    public static function recalculateEmployeeLeaveBalance(PDO $db, int $userId): array
    {
        $year = (int)date('Y');
        $yearStart = "{$year}-01-01 00:00:00";
        $yearEnd = "{$year}-12-31 23:59:59";
        $yearMonthPrefix = "{$year}-%";

        // 1. Fetch existing hrm_profiles row
        $stmtProf = $db->prepare("
            SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used
            FROM hrm_profiles
            WHERE user_id = ?
            LIMIT 1
        ");
        $stmtProf->execute([$userId]);
        $prof = $stmtProf->fetch(PDO::FETCH_ASSOC);

        $annualTotal = $prof ? (float)($prof['annual_leave_total'] ?? 12.0) : 12.0;
        $existingCompTotal = $prof ? (float)($prof['compensatory_leave_total'] ?? 0.0) : 0.0;

        // 2. Approved annual leave days in current year
        $stmtAnnLeave = $db->prepare("
            SELECT COALESCE(SUM(GREATEST(0, COALESCE(total_days, 0) - COALESCE(unpaid_days, 0))), 0)
            FROM hrm_leave_requests
            WHERE user_id = ?
              AND status = 'approved'
              AND leave_type = 'annual'
              AND start_date >= ? AND start_date <= ?
        ");
        $stmtAnnLeave->execute([$userId, $yearStart, $yearEnd]);
        $approvedAnnualLeaveDays = (float)$stmtAnnLeave->fetchColumn();

        // 3. Approved compensatory leave used in current year
        $stmtCompUsed = $db->prepare("
            SELECT COALESCE(SUM(GREATEST(0, COALESCE(total_days, 0) - COALESCE(unpaid_days, 0))), 0)
            FROM hrm_leave_requests
            WHERE user_id = ?
              AND status = 'approved'
              AND leave_type = 'compensatory'
              AND start_date >= ? AND start_date <= ?
        ");
        $stmtCompUsed->execute([$userId, $yearStart, $yearEnd]);
        $approvedCompUsedDays = (float)$stmtCompUsed->fetchColumn();

        // 4. Approved overtime converted to compensatory leave in current year
        $stmtOtComp = $db->prepare("
            SELECT COALESCE(SUM(COALESCE(total_days, 0) * COALESCE(NULLIF(ot_rate, 0), 1.0)), 0)
            FROM hrm_leave_requests
            WHERE user_id = ?
              AND status = 'approved'
              AND leave_type = 'overtime'
              AND ot_type = 'compensatory'
              AND start_date >= ? AND start_date <= ?
        ");
        $stmtOtComp->execute([$userId, $yearStart, $yearEnd]);
        $earnedCompFromOt = round((float)$stmtOtComp->fetchColumn(), 2);

        // 5. Lateness deductions from monthly_payslips in current year
        $stmtPsDeduct = $db->prepare("
            SELECT COALESCE(SUM(COALESCE(lateness_annual_deducted, 0)), 0) AS lateness_ann,
                   COALESCE(SUM(COALESCE(lateness_compensatory_deducted, 0)), 0) AS lateness_comp
            FROM monthly_payslips
            WHERE user_id = ?
              AND month_year LIKE ?
        ");
        $stmtPsDeduct->execute([$userId, $yearMonthPrefix]);
        $psDeduct = $stmtPsDeduct->fetch(PDO::FETCH_ASSOC) ?: [];
        $latenessAnnualDeducted = round((float)($psDeduct['lateness_ann'] ?? 0.0), 2);
        $latenessCompDeducted = round((float)($psDeduct['lateness_comp'] ?? 0.0), 2);

        $annualUsed = round($approvedAnnualLeaveDays + $latenessAnnualDeducted, 2);
        $compUsed = round($approvedCompUsedDays + $latenessCompDeducted, 2);
        $compTotal = round(max($existingCompTotal, $earnedCompFromOt), 2);

        // 6. Persist into hrm_profiles
        $stmtUpsert = $db->prepare("
            INSERT INTO hrm_profiles (user_id, joined_date, annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used)
            VALUES (?, CURDATE(), ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                annual_leave_used = VALUES(annual_leave_used),
                compensatory_leave_total = VALUES(compensatory_leave_total),
                compensatory_leave_used = VALUES(compensatory_leave_used),
                updated_at = CURRENT_TIMESTAMP
        ");
        $stmtUpsert->execute([$userId, $annualTotal, $annualUsed, $compTotal, $compUsed]);

        return [
            'user_id' => $userId,
            'year' => $year,
            'annual_leave_total' => $annualTotal,
            'annual_leave_used' => $annualUsed,
            'annual_leave_from_requests' => round($approvedAnnualLeaveDays, 2),
            'lateness_annual_deducted' => $latenessAnnualDeducted,
            'annual_leave_remaining' => round(max(0.0, $annualTotal - $annualUsed), 2),
            'compensatory_leave_total' => $compTotal,
            'compensatory_leave_earned_from_ot' => $earnedCompFromOt,
            'compensatory_leave_used' => $compUsed,
            'compensatory_leave_from_requests' => round($approvedCompUsedDays, 2),
            'lateness_compensatory_deducted' => $latenessCompDeducted,
            'compensatory_leave_remaining' => round(max(0.0, $compTotal - $compUsed), 2)
        ];
    }

    /**
     * Multi-tier filter builder for query_hrm_workforce_and_payroll_multitier & ExportController::exportPayroll
     * Supports 100% schema filtering across users u, hrm_profiles hp, monthly_payslips mp.
     */
    public static function applyExtendedHrmMultiTierFilters(
        PDO $db,
        array $args,
        array &$where,
        array &$params,
        int $tid,
        int $uid,
        bool $canViewSalary
    ): void {
        // 1. Always exclude bot/system accounts
        $where[] = "(u.role IS NULL OR u.role NOT IN ('bot', 'system')) AND u.id != 9000001";

        // 2. Gender filter (male / female / nam / nữ)
        $genderParam = mb_strtolower(trim((string)($args['gender'] ?? '')), 'UTF-8');
        if ($genderParam !== '' && $genderParam !== 'all') {
            if (in_array($genderParam, ['male', 'nam', 'm', '1'], true)) {
                $where[] = "LOWER(TRIM(COALESCE(u.gender, ''))) IN ('male', 'nam', 'm', '1')";
            } elseif (in_array($genderParam, ['female', 'nữ', 'nu', 'f', '0'], true)) {
                $where[] = "LOWER(TRIM(COALESCE(u.gender, ''))) IN ('female', 'nữ', 'nu', 'f', '0')";
            }
        }

        // 3. Birthday month filter
        if (isset($args['birthday_month']) && $args['birthday_month'] !== '' && $args['birthday_month'] !== null) {
            $bMonth = (int)$args['birthday_month'];
            if ($bMonth >= 1 && $bMonth <= 12) {
                $where[] = "(u.dob IS NOT NULL AND MONTH(u.dob) = ?)";
                $params[] = $bMonth;
            }
        }

        // 4. Joined date range filter (hp.joined_date)
        $joinedFrom = trim((string)($args['joined_from'] ?? ''));
        if ($joinedFrom !== '') {
            $where[] = "(hp.joined_date IS NOT NULL AND hp.joined_date >= ?)";
            $params[] = $joinedFrom;
        }
        $joinedTo = trim((string)($args['joined_to'] ?? ''));
        if ($joinedTo !== '') {
            $where[] = "(hp.joined_date IS NOT NULL AND hp.joined_date <= ?)";
            $params[] = $joinedTo;
        }

        // 5. Vacation mode filter (u.vacation_mode)
        if (isset($args['vacation_mode']) && $args['vacation_mode'] !== '' && $args['vacation_mode'] !== 'all' && $args['vacation_mode'] !== null) {
            $vmRaw = $args['vacation_mode'];
            $vmBool = ($vmRaw === true || $vmRaw === 1 || $vmRaw === '1' || strtolower((string)$vmRaw) === 'true' || strtolower((string)$vmRaw) === 'yes') ? 1 : 0;
            $where[] = "COALESCE(u.vacation_mode, 0) = ?";
            $params[] = $vmBool;
        }

        // 6. Team ID / Team Name filter
        if (!empty($args['team_id']) && (int)$args['team_id'] > 0) {
            $where[] = "u.team_id = ?";
            $params[] = (int)$args['team_id'];
        }
        $teamName = trim((string)($args['team_name'] ?? ''));
        if ($teamName !== '' && strtolower($teamName) !== 'all') {
            $likeTeam = '%' . $teamName . '%';
            $where[] = "(u.department LIKE ? OR EXISTS (SELECT 1 FROM teams t_f WHERE t_f.id = u.team_id AND (t_f.name LIKE ? OR t_f.branch LIKE ?)))";
            array_push($params, $likeTeam, $likeTeam, $likeTeam);
        }

        // 7. Salary range filters (Strictly enforced by $canViewSalary)
        if ($canViewSalary) {
            if (isset($args['min_deal_salary']) && $args['min_deal_salary'] !== '' && $args['min_deal_salary'] !== null) {
                $where[] = "COALESCE(hp.deal_salary, hp.base_salary, 0) >= ?";
                $params[] = (float)$args['min_deal_salary'];
            }
            if (isset($args['max_deal_salary']) && $args['max_deal_salary'] !== '' && $args['max_deal_salary'] !== null) {
                $where[] = "COALESCE(hp.deal_salary, hp.base_salary, 0) <= ?";
                $params[] = (float)$args['max_deal_salary'];
            }
            if (isset($args['min_base_salary']) && $args['min_base_salary'] !== '' && $args['min_base_salary'] !== null) {
                $where[] = "COALESCE(hp.base_salary, 0) >= ?";
                $params[] = (float)$args['min_base_salary'];
            }
            if (isset($args['max_base_salary']) && $args['max_base_salary'] !== '' && $args['max_base_salary'] !== null) {
                $where[] = "COALESCE(hp.base_salary, 0) <= ?";
                $params[] = (float)$args['max_base_salary'];
            }
            if (isset($args['min_net_salary']) && $args['min_net_salary'] !== '' && $args['min_net_salary'] !== null) {
                $where[] = "COALESCE(mp.net_salary, 0) >= ?";
                $params[] = (float)$args['min_net_salary'];
            }
            if (isset($args['max_net_salary']) && $args['max_net_salary'] !== '' && $args['max_net_salary'] !== null) {
                $where[] = "COALESCE(mp.net_salary, 0) <= ?";
                $params[] = (float)$args['max_net_salary'];
            }
        }

        // 8. Payslip status filter (mp.status = ?)
        $payslipStatus = strtolower(trim((string)($args['payslip_status'] ?? '')));
        if ($payslipStatus !== '' && $payslipStatus !== 'all') {
            $where[] = "mp.status = ?";
            $params[] = $payslipStatus;
        }

        // 9. Has overtime filter (mp.overtime_days > 0)
        if (isset($args['has_overtime']) && $args['has_overtime'] !== '' && $args['has_overtime'] !== 'all' && $args['has_overtime'] !== null) {
            $otRaw = $args['has_overtime'];
            $hasOt = ($otRaw === true || $otRaw === 1 || $otRaw === '1' || strtolower((string)$otRaw) === 'true' || strtolower((string)$otRaw) === 'yes');
            if ($hasOt) {
                $where[] = "COALESCE(mp.overtime_days, 0) > 0";
            } else {
                $where[] = "COALESCE(mp.overtime_days, 0) = 0";
            }
        }

        // 10. Late quota status filter (Nữ 60p / Nam 30p)
        $lateQuotaStatus = strtolower(trim((string)($args['late_quota_status'] ?? '')));
        if ($lateQuotaStatus === 'exceeded_quota') {
            $where[] = "COALESCE(mp.lateness_minutes, 0) > CASE WHEN LOWER(COALESCE(u.gender,'')) IN ('male','nam','m') THEN 30 ELSE 60 END";
        } elseif ($lateQuotaStatus === 'within_quota') {
            $where[] = "COALESCE(mp.lateness_minutes, 0) <= CASE WHEN LOWER(COALESCE(u.gender,'')) IN ('male','nam','m') THEN 30 ELSE 60 END";
        }

        // 11. Dynamic custom_rules across whitelisted columns of users (u), hrm_profiles (hp), monthly_payslips (mp)
        $rawRules = $args['custom_rules'] ?? ($args['rules'] ?? null);
        if (!empty($rawRules)) {
            $rules = is_string($rawRules) ? json_decode($rawRules, true) : (is_array($rawRules) ? $rawRules : []);
            if (is_array($rules)) {
                $userCols = [
                    'id', 'username', 'email', 'full_name', 'job_title', 'phone', 'role', 'department',
                    'is_active', 'status', 'vacation_mode', 'leave_start', 'leave_end', 'work_start_time',
                    'work_end_time', 'work_schedule', 'zalo_chat_id', 'telegram_chat_id', 'is_confirmed',
                    'bio', 'last_login_at', 'created_at', 'updated_at', 'team_id', 'dob', 'gender',
                    'citizen_id', 'address', 'bank_name', 'bank_account', 'overtime_mode',
                    'manager_behavior_mode', 'use_custom_work_hours'
                ];
                $profilePublicCols = [
                    'joined_date', 'has_insurance', 'allowance_meal_type',
                    'annual_leave_total', 'annual_leave_used', 'compensatory_leave_total',
                    'compensatory_leave_used', 'insurance_rate_bhxh', 'insurance_rate_bhyt', 'insurance_rate_bhtn'
                ];
                $profileSalaryCols = [
                    'base_salary', 'deal_salary', 'allowance_meal', 'allowance_travel', 'allowance_phone', 'kpi_target'
                ];
                $payslipPublicCols = [
                    'month_year', 'work_days_required', 'work_days_actual', 'lateness_minutes',
                    'lateness_compensatory_deducted', 'lateness_annual_deducted', 'status',
                    'confirmed_at', 'overtime_days', 'note'
                ];
                $payslipSalaryCols = [
                    'lateness_penalty', 'salary_basic_calculated', 'allowance_total', 'kpi_bonus',
                    'insurance_bhxh', 'insurance_bhyt', 'insurance_bhtn', 'tax_pit', 'advance_deduction',
                    'net_salary', 'overtime_salary', 'diligence_bonus'
                ];

                $ruleClauses = [];
                foreach ($rules as $rule) {
                    if (!is_array($rule)) {
                        continue;
                    }
                    $rawField = strtolower(trim((string)($rule['field'] ?? '')));
                    if ($rawField === '') {
                        continue;
                    }

                    // Strip optional prefix u., hp., mp.
                    $prefix = '';
                    $field = $rawField;
                    if (str_contains($rawField, '.')) {
                        [$prefix, $field] = explode('.', $rawField, 2);
                    }

                    $colExpr = null;
                    if ($prefix === 'hp' || in_array($field, $profilePublicCols, true) || in_array($field, $profileSalaryCols, true)) {
                        if (in_array($field, $profileSalaryCols, true) && !$canViewSalary) {
                            continue;
                        }
                        if (in_array($field, $profilePublicCols, true) || in_array($field, $profileSalaryCols, true)) {
                            $colExpr = "hp.{$field}";
                        }
                    } elseif ($prefix === 'mp' || in_array($field, $payslipPublicCols, true) || in_array($field, $payslipSalaryCols, true)) {
                        if (in_array($field, $payslipSalaryCols, true) && !$canViewSalary) {
                            continue;
                        }
                        if (in_array($field, $payslipPublicCols, true) || in_array($field, $payslipSalaryCols, true)) {
                            $colExpr = "mp.{$field}";
                        }
                    } elseif (in_array($field, $userCols, true)) {
                        $colExpr = "u.{$field}";
                    }

                    if ($colExpr === null) {
                        continue;
                    }

                    $op = strtolower(trim((string)($rule['operator'] ?? ($rule['op'] ?? 'eq'))));
                    $val = $rule['value'] ?? '';
                    $valTo = $rule['valueTo'] ?? ($rule['value_to'] ?? null);

                    if (in_array($op, ['is_empty', 'empty', 'is_null', 'null'], true)) {
                        $ruleClauses[] = "({$colExpr} IS NULL OR TRIM(CAST({$colExpr} AS CHAR)) = '')";
                    } elseif (in_array($op, ['is_not_empty', 'not_empty', 'is_not_null', 'not_null'], true)) {
                        $ruleClauses[] = "({$colExpr} IS NOT NULL AND TRIM(CAST({$colExpr} AS CHAR)) != '')";
                    } elseif (in_array($op, ['eq', '=', 'equals'], true)) {
                        $ruleClauses[] = "{$colExpr} = ?";
                        $params[] = (string)$val;
                    } elseif (in_array($op, ['neq', '!=', '<>', 'not_equals'], true)) {
                        $ruleClauses[] = "({$colExpr} IS NULL OR {$colExpr} != ?)";
                        $params[] = (string)$val;
                    } elseif (in_array($op, ['like', 'contains'], true)) {
                        $ruleClauses[] = "{$colExpr} LIKE ?";
                        $params[] = '%' . (string)$val . '%';
                    } elseif ($op === 'starts_with') {
                        $ruleClauses[] = "{$colExpr} LIKE ?";
                        $params[] = (string)$val . '%';
                    } elseif ($op === 'ends_with') {
                        $ruleClauses[] = "{$colExpr} LIKE ?";
                        $params[] = '%' . (string)$val;
                    } elseif (in_array($op, ['not_like', 'not_contains'], true)) {
                        $ruleClauses[] = "({$colExpr} IS NULL OR {$colExpr} NOT LIKE ?)";
                        $params[] = '%' . (string)$val . '%';
                    } elseif (in_array($op, ['gt', '>'], true)) {
                        $ruleClauses[] = "{$colExpr} > ?";
                        $params[] = $val;
                    } elseif (in_array($op, ['gte', '>='], true)) {
                        $ruleClauses[] = "{$colExpr} >= ?";
                        $params[] = $val;
                    } elseif (in_array($op, ['lt', '<'], true)) {
                        $ruleClauses[] = "{$colExpr} < ?";
                        $params[] = $val;
                    } elseif (in_array($op, ['lte', '<='], true)) {
                        $ruleClauses[] = "{$colExpr} <= ?";
                        $params[] = $val;
                    } elseif ($op === 'between') {
                        $bMin = $val;
                        $bMax = $valTo;
                        if (is_array($val) && count($val) >= 2) {
                            $bMin = $val[0];
                            $bMax = $val[1];
                        } elseif (is_string($val) && str_contains($val, ',') && $bMax === null) {
                            [$bMin, $bMax] = array_map('trim', explode(',', $val, 2));
                        }
                        if ($bMin !== null && $bMax !== null && $bMin !== '' && $bMax !== '') {
                            $ruleClauses[] = "({$colExpr} >= ? AND {$colExpr} <= ?)";
                            $params[] = $bMin;
                            $params[] = $bMax;
                        }
                    } elseif ($op === 'in') {
                        $inList = is_array($val) ? $val : array_filter(array_map('trim', explode(',', (string)$val)));
                        if (!empty($inList)) {
                            $ph = implode(',', array_fill(0, count($inList), '?'));
                            $ruleClauses[] = "{$colExpr} IN ({$ph})";
                            foreach ($inList as $item) {
                                $params[] = $item;
                            }
                        }
                    } elseif ($op === 'not_in') {
                        $inList = is_array($val) ? $val : array_filter(array_map('trim', explode(',', (string)$val)));
                        if (!empty($inList)) {
                            $ph = implode(',', array_fill(0, count($inList), '?'));
                            $ruleClauses[] = "({$colExpr} IS NULL OR {$colExpr} NOT IN ({$ph}))";
                            foreach ($inList as $item) {
                                $params[] = $item;
                            }
                        }
                    }
                }

                if (!empty($ruleClauses)) {
                    $logic = strtoupper(trim((string)($args['custom_rules_logic'] ?? 'AND'))) === 'OR' ? 'OR' : 'AND';
                    $where[] = '(' . implode(" {$logic} ", $ruleClauses) . ')';
                }
            }
        }
    }

    /**
     * Enrich personal attendance summary with 360-degree breakdown:
     * - leave_and_ot_breakdown (approved & pending days for annual, compensatory, remote_work, overtime, late_early, business_trip, sick, unpaid)
     * - bulk_attendance_requests
     * - monthly_attendance_confirmation (from attendance_confirmations joined with attendance_confirmation_batches)
     */
    public static function enrichMyAttendanceSummary360(PDO $db, int $uid, int $month, int $year, array $baseSummary): array
    {
        $rangeStart = sprintf('%04d-%02d-01', $year, $month);
        $rangeEnd = date('Y-m-t', strtotime($rangeStart));
        $monthPeriod = sprintf('%04d-%02d', $year, $month);

        // 1. Leave & OT breakdown in the month
        $types = ['annual', 'compensatory', 'remote_work', 'overtime', 'late_early', 'business_trip', 'sick', 'unpaid'];
        $breakdown = [];
        foreach ($types as $t) {
            $breakdown[$t] = [
                'approved_days' => 0.0,
                'pending_days' => 0.0,
                'approved_count' => 0,
                'pending_count' => 0
            ];
        }

        $stmtLeaves = $db->prepare("
            SELECT id, leave_type, ot_type, ot_rate, salary_rate, start_date, end_date, total_days, unpaid_days, status, reason
            FROM hrm_leave_requests
            WHERE user_id = ?
              AND status IN ('approved', 'pending')
              AND DATE(start_date) <= ?
              AND DATE(end_date) >= ?
            ORDER BY start_date ASC
        ");
        $stmtLeaves->execute([$uid, $rangeEnd, $rangeStart]);
        $leaveRows = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($leaveRows as $lr) {
            $lt = (string)($lr['leave_type'] ?? 'annual');
            if (!isset($breakdown[$lt])) {
                $breakdown[$lt] = [
                    'approved_days' => 0.0,
                    'pending_days' => 0.0,
                    'approved_count' => 0,
                    'pending_count' => 0
                ];
            }
            $days = (float)($lr['total_days'] ?? 0.0);
            if ($lr['status'] === 'approved') {
                $breakdown[$lt]['approved_days'] = round($breakdown[$lt]['approved_days'] + $days, 2);
                $breakdown[$lt]['approved_count']++;
            } elseif ($lr['status'] === 'pending') {
                $breakdown[$lt]['pending_days'] = round($breakdown[$lt]['pending_days'] + $days, 2);
                $breakdown[$lt]['pending_count']++;
            }
        }
        $breakdown['requests'] = $leaveRows;

        // 2. Bulk attendance supplement requests for this month_period
        $stmtBulk = $db->prepare("
            SELECT r.id, r.month_period, r.status, r.manager_id, r.approver2_id, r.admin_note, r.approved_at, r.created_at
            FROM attendance_bulk_requests r
            WHERE r.user_id = ? AND r.month_period = ? AND r.status != 'draft'
            ORDER BY r.id DESC
        ");
        $stmtBulk->execute([$uid, $monthPeriod]);
        $bulkReqs = $stmtBulk->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (!empty($bulkReqs)) {
            $bIds = array_map(fn($r) => (int)$r['id'], $bulkReqs);
            $ph = implode(',', array_fill(0, count($bIds), '?'));
            $stmtDets = $db->prepare("
                SELECT request_id, check_in_date, suggested_check_in, suggested_check_out, reason, approved
                FROM attendance_bulk_request_details
                WHERE request_id IN ({$ph})
                ORDER BY check_in_date ASC
            ");
            $stmtDets->execute($bIds);
            $detsByReq = [];
            foreach ($stmtDets->fetchAll(PDO::FETCH_ASSOC) ?: [] as $d) {
                $detsByReq[(int)$d['request_id']][] = $d;
            }
            foreach ($bulkReqs as &$br) {
                $br['details'] = $detsByReq[(int)$br['id']] ?? [];
            }
            unset($br);
        }

        // 3. Monthly attendance confirmation record
        $stmtConf = $db->prepare("
            SELECT ac.*,
                   b.title AS batch_title,
                   b.period_type,
                   b.month AS batch_month,
                   b.year AS batch_year,
                   b.from_date,
                   b.to_date,
                   b.deadline_at,
                   b.status AS batch_status
            FROM attendance_confirmations ac
            JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
            WHERE ac.user_id = ?
              AND ((b.month = ? AND b.year = ?) OR (b.from_date <= ? AND b.to_date >= ?))
            ORDER BY b.id DESC
            LIMIT 1
        ");
        $stmtConf->execute([$uid, $month, $year, $rangeEnd, $rangeStart]);
        $confRecord = $stmtConf->fetch(PDO::FETCH_ASSOC) ?: null;

        // 4. Compensatory leave balance from hrm_profiles
        $stmtProf = $db->prepare("SELECT compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
        $stmtProf->execute([$uid]);
        $profRow = $stmtProf->fetch(PDO::FETCH_ASSOC) ?: [];
        $compTotal = (float)($profRow['compensatory_leave_total'] ?? 0.0);
        $compUsed = (float)($profRow['compensatory_leave_used'] ?? 0.0);

        $baseSummary['compensatory_leave_total'] = $compTotal;
        $baseSummary['compensatory_leave_used'] = $compUsed;
        $baseSummary['compensatory_leave_remaining'] = max(0.0, $compTotal - $compUsed);
        $baseSummary['leave_and_ot_breakdown'] = $breakdown;
        $baseSummary['bulk_attendance_requests'] = $bulkReqs;
        $baseSummary['monthly_attendance_confirmation'] = $confRecord;

        return $baseSummary;
    }

    /**
     * Enrich personal payslip response with 100% monthly_payslips columns:
     * overtime_days, overtime_salary, lateness_compensatory_deducted, lateness_annual_deducted,
     * insurance_bhxh, insurance_bhyt, insurance_bhtn, diligence_bonus, note, confirmed_at
     */
    public static function enrichMyPayslip360(PDO $db, int $uid, string $monthYear, array $basePayslip): array
    {
        if ($monthYear !== '') {
            $stmt = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? AND month_year = ? LIMIT 1");
            $stmt->execute([$uid, $monthYear]);
        } else {
            $stmt = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? ORDER BY month_year DESC LIMIT 1");
            $stmt->execute([$uid]);
        }
        $ps = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ps) {
            return $basePayslip;
        }

        $bhxh = (float)($ps['insurance_bhxh'] ?? 0.0);
        $bhyt = (float)($ps['insurance_bhyt'] ?? 0.0);
        $bhtn = (float)($ps['insurance_bhtn'] ?? 0.0);
        $otDays = (float)($ps['overtime_days'] ?? 0.0);
        $otSalary = (float)($ps['overtime_salary'] ?? 0.0);
        $diligenceBonus = (float)($ps['diligence_bonus'] ?? 0.0);
        $latenessCompDeducted = (float)($ps['lateness_compensatory_deducted'] ?? 0.0);
        $latenessAnnDeducted = (float)($ps['lateness_annual_deducted'] ?? 0.0);

        $basePayslip['payslip_id'] = (int)$ps['id'];
        $basePayslip['overtime_days'] = $otDays;
        $basePayslip['overtime_salary'] = number_format($otSalary, 0, ',', '.') . ' VND';
        $basePayslip['overtime_salary_raw'] = $otSalary;
        $basePayslip['diligence_bonus'] = number_format($diligenceBonus, 0, ',', '.') . ' VND';
        $basePayslip['diligence_bonus_raw'] = $diligenceBonus;
        $basePayslip['lateness_compensatory_deducted'] = $latenessCompDeducted;
        $basePayslip['lateness_annual_deducted'] = $latenessAnnDeducted;
        $basePayslip['insurance_bhxh'] = number_format($bhxh, 0, ',', '.') . ' VND';
        $basePayslip['insurance_bhyt'] = number_format($bhyt, 0, ',', '.') . ' VND';
        $basePayslip['insurance_bhtn'] = number_format($bhtn, 0, ',', '.') . ' VND';
        $basePayslip['insurance_total'] = number_format($bhxh + $bhyt + $bhtn, 0, ',', '.') . ' VND';
        $basePayslip['note'] = $ps['note'] ?? null;
        $basePayslip['confirmed_at'] = $ps['confirmed_at'] ?? null;
        $basePayslip['signature_url'] = $ps['signature_url'] ?? null;

        if (isset($basePayslip['deductions']) && is_array($basePayslip['deductions'])) {
            $basePayslip['deductions']['insurance_bhyt'] = number_format($bhyt, 0, ',', '.') . ' VND';
            $basePayslip['deductions']['insurance_bhtn'] = number_format($bhtn, 0, ',', '.') . ' VND';
            $basePayslip['deductions']['lateness_compensatory_deducted_days'] = $latenessCompDeducted;
            $basePayslip['deductions']['lateness_annual_deducted_days'] = $latenessAnnDeducted;
        }

        return $basePayslip;
    }

    /**
     * Execute Tool 1: manage_my_hr_profile_and_requests
     * Strict Zero-Trust Self-Service: operates ONLY on $uid = (int)$auth['user_id'].
     */
    public static function executeManageMyHrProfileAndRequests(PDO $db, array $args, array $auth): array
    {
        $uid = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower(trim((string)($auth['role'] ?? '')));

        if ($uid <= 0) {
            return ['success' => false, 'message' => 'Không xác định được danh tính người dùng hiện tại.'];
        }

        $action = strtolower(trim((string)($args['action'] ?? 'get_my_full_profile')));

        switch ($action) {
            // ----------------------------------------------------------
            // 1. GET MY FULL PROFILE (360-DEGREE SELF-SERVICE)
            // ----------------------------------------------------------
            case 'get_my_full_profile': {
                $stmtU = $db->prepare("
                    SELECT u.id, u.tenant_id, u.username, u.email, u.full_name, u.job_title, u.phone,
                           u.avatar_url, u.signature_url, u.role, u.department, u.is_active,
                           u.two_factor_enabled, u.two_factor_type, u.status, u.vacation_mode,
                           u.leave_start, u.leave_end, u.work_start_time, u.work_end_time,
                           u.work_schedule, u.zalo_chat_id, u.telegram_chat_id, u.is_confirmed,
                           u.bio, u.last_login_at, u.created_at, u.updated_at, u.team_id,
                           u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account,
                           u.overtime_mode, u.use_custom_work_hours,
                           t.name AS team_name,
                           hp.joined_date, hp.base_salary, hp.deal_salary, hp.has_insurance,
                           hp.allowance_meal, hp.allowance_meal_type, hp.allowance_travel, hp.allowance_phone,
                           hp.kpi_target, hp.kpi_multiplier_rules, hp.custom_fields_json,
                           hp.annual_leave_total, hp.annual_leave_used,
                           hp.compensatory_leave_total, hp.compensatory_leave_used,
                           hp.insurance_rate_bhxh, hp.insurance_rate_bhyt, hp.insurance_rate_bhtn
                    FROM users u
                    LEFT JOIN hrm_profiles hp ON hp.user_id = u.id
                    LEFT JOIN teams t ON u.team_id = t.id
                    WHERE u.id = ? AND u.tenant_id = ?
                    LIMIT 1
                ");
                $stmtU->execute([$uid, $tid]);
                $profile = $stmtU->fetch(PDO::FETCH_ASSOC);

                if (!$profile) {
                    return ['success' => false, 'message' => 'Không tìm thấy hồ sơ nhân sự của bạn.'];
                }

                $leaveBalance = self::recalculateEmployeeLeaveBalance($db, $uid);
                $quotaInfo = self::resolveEmployeeLateQuota($db, $profile['gender'] ?? null, $profile['full_name'] ?? null);

                // Contracts
                $stmtContracts = $db->prepare("
                    SELECT id, contract_code, contract_type, salary_base, salary_deal, salary_type,
                           probation_rate, start_date, end_date, status, created_at, updated_at
                    FROM hrm_contracts
                    WHERE user_id = ?
                    ORDER BY start_date DESC, id DESC
                ");
                $stmtContracts->execute([$uid]);
                $contracts = $stmtContracts->fetchAll(PDO::FETCH_ASSOC) ?: [];

                // Assets
                $stmtAssets = $db->prepare("
                    SELECT id, asset_name, asset_code, given_date, returned_date, condition_note, status, created_at, updated_at
                    FROM hrm_assets
                    WHERE user_id = ?
                    ORDER BY id DESC
                ");
                $stmtAssets->execute([$uid]);
                $assets = $stmtAssets->fetchAll(PDO::FETCH_ASSOC) ?: [];

                // Current month attendance & late minutes
                $curMonth = (int)date('n');
                $curYear = (int)date('Y');
                $mStart = date('Y-m-01');
                $mEnd = date('Y-m-t');
                $stmtCi = $db->prepare("
                    SELECT COUNT(1) AS check_in_days,
                           COALESCE(SUM(CASE
                               WHEN NOT EXISTS (
                                   SELECT 1 FROM hrm_leave_requests lr
                                   WHERE lr.user_id = c.user_id AND lr.status = 'approved'
                                     AND lr.leave_type = 'late_early' AND lr.start_date >= c.check_in_date AND lr.start_date < DATE_ADD(c.check_in_date, INTERVAL 1 DAY)
                               ) THEN COALESCE(c.late_minutes, 0)
                               ELSE 0
                           END), 0) AS late_minutes
                    FROM check_ins c
                    WHERE c.user_id = ? AND c.check_in_date BETWEEN ? AND ? AND c.status = 'approved'
                ");
                $stmtCi->execute([$uid, $mStart, $mEnd]);
                $ciRow = $stmtCi->fetch(PDO::FETCH_ASSOC) ?: [];
                $curLateMins = (int)($ciRow['late_minutes'] ?? 0);
                $graceMins = $quotaInfo['grace_minutes'];

                $attSummary = self::enrichMyAttendanceSummary360($db, $uid, $curMonth, $curYear, [
                    'month_period' => sprintf('%04d-%02d', $curYear, $curMonth),
                    'worked_days' => (int)($ciRow['check_in_days'] ?? 0),
                    'gender_label' => $quotaInfo['gender_label'],
                    'monthly_late_grace_minutes' => $graceMins,
                    'total_late_minutes' => $curLateMins,
                    'remaining_late_grace_minutes' => max(0, $graceMins - $curLateMins),
                    'excess_late_minutes' => max(0, $curLateMins - $graceMins),
                    'annual_leave_total' => $leaveBalance['annual_leave_total'],
                    'annual_leave_used' => $leaveBalance['annual_leave_used'],
                    'annual_leave_remaining' => $leaveBalance['annual_leave_remaining']
                ]);

                // Latest payslip
                $latestPayslip = self::enrichMyPayslip360($db, $uid, '', []);

                return [
                    'success' => true,
                    'action' => 'get_my_full_profile',
                    'profile' => $profile,
                    'gender_late_quota' => [
                        'gender' => $quotaInfo['gender'],
                        'gender_label' => $quotaInfo['gender_label'],
                        'monthly_late_grace_minutes' => $graceMins,
                        'current_month_late_minutes' => $curLateMins,
                        'remaining_late_grace_minutes' => max(0, $graceMins - $curLateMins),
                        'excess_late_minutes' => max(0, $curLateMins - $graceMins),
                        'policy_note' => 'Theo Điều 14 NQLĐ QĐ 001/2024: Nữ được phép đi trễ 60 phút/tháng, Nam được phép 30 phút/tháng.'
                    ],
                    'leave_balance' => $leaveBalance,
                    'contracts' => $contracts,
                    'assets' => $assets,
                    'current_month_attendance' => $attSummary,
                    'latest_payslip' => !empty($latestPayslip) ? $latestPayslip : null
                ];
            }

            // ----------------------------------------------------------
            // 2. UPDATE MY PROFILE (SELF-SERVICE ACCOUNT & HR INFO)
            // ----------------------------------------------------------
            case 'update_my_profile': {
                $sets = [];
                $params = [];
                $updatedFields = [];

                $stringFields = ['phone', 'citizen_id', 'address', 'bank_name', 'bank_account', 'bio'];
                foreach ($stringFields as $sf) {
                    if (array_key_exists($sf, $args) && $args[$sf] !== null) {
                        $sets[] = "{$sf} = ?";
                        $params[] = trim((string)$args[$sf]);
                        $updatedFields[$sf] = trim((string)$args[$sf]);
                    }
                }

                if (!empty($args['dob'])) {
                    $dobStr = trim((string)$args['dob']);
                    $ts = strtotime($dobStr);
                    if ($ts === false) {
                        return ['success' => false, 'message' => 'Định dạng ngày sinh (dob) không hợp lệ. Vui lòng nhập YYYY-MM-DD.'];
                    }
                    $dobFormatted = date('Y-m-d', $ts);
                    $sets[] = "dob = ?";
                    $params[] = $dobFormatted;
                    $updatedFields['dob'] = $dobFormatted;
                }

                if (!empty($args['gender'])) {
                    $gQuota = self::resolveEmployeeLateQuota($db, (string)$args['gender'], null);
                    $sets[] = "gender = ?";
                    $params[] = $gQuota['gender'];
                    $updatedFields['gender'] = $gQuota['gender'];
                    $updatedFields['monthly_late_grace_minutes'] = $gQuota['grace_minutes'];
                }

                if (array_key_exists('vacation_mode', $args) && $args['vacation_mode'] !== null) {
                    $vm = ($args['vacation_mode'] === true || $args['vacation_mode'] === 1 || $args['vacation_mode'] === '1' || strtolower((string)$args['vacation_mode']) === 'true') ? 1 : 0;
                    $sets[] = "vacation_mode = ?";
                    $params[] = $vm;
                    $updatedFields['vacation_mode'] = (bool)$vm;
                }

                if (empty($sets)) {
                    return ['success' => false, 'message' => 'Bạn chưa cung cấp thông tin cá nhân nào cần cập nhật (phone, dob, gender, citizen_id, address, bank_name, bank_account, bio, vacation_mode).'];
                }

                $sets[] = "updated_at = CURRENT_TIMESTAMP";
                $params[] = $uid;
                $params[] = $tid;

                $stmtUpd = $db->prepare("UPDATE users SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?");
                $stmtUpd->execute($params);

                return [
                    'success' => true,
                    'action' => 'update_my_profile',
                    'updated_fields' => $updatedFields,
                    'message' => 'Đã cập nhật thông tin hồ sơ cá nhân của bạn thành công.'
                ];
            }

            // ----------------------------------------------------------
            // 3. LIST MY REQUESTS
            // ----------------------------------------------------------
            case 'list_my_requests': {
                $reqType = strtolower(trim((string)($args['request_type'] ?? 'all')));
                $result = [];

                if ($reqType === 'all' || $reqType === 'leave') {
                    $stmtLv = $db->prepare("
                        SELECT l.*, u1.full_name AS approver_name, u2.full_name AS approver_name_2
                        FROM hrm_leave_requests l
                        LEFT JOIN users u1 ON l.approver_id = u1.id
                        LEFT JOIN users u2 ON l.approver_id_2 = u2.id
                        WHERE l.user_id = ?
                        ORDER BY l.created_at DESC
                        LIMIT 50
                    ");
                    $stmtLv->execute([$uid]);
                    $result['leave_and_ot_requests'] = $stmtLv->fetchAll(PDO::FETCH_ASSOC) ?: [];
                }

                if ($reqType === 'all' || $reqType === 'bulk_attendance' || $reqType === 'supplement_attendance') {
                    $stmtBulk = $db->prepare("
                        SELECT r.*, m.full_name AS manager_name
                        FROM attendance_bulk_requests r
                        LEFT JOIN users m ON r.manager_id = m.id
                        WHERE r.user_id = ?
                        ORDER BY r.created_at DESC
                        LIMIT 30
                    ");
                    $stmtBulk->execute([$uid]);
                    $bulks = $stmtBulk->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    if (!empty($bulks)) {
                        $bIds = array_map(fn($b) => (int)$b['id'], $bulks);
                        $ph = implode(',', array_fill(0, count($bIds), '?'));
                        $stmtD = $db->prepare("SELECT * FROM attendance_bulk_request_details WHERE request_id IN ({$ph}) ORDER BY check_in_date ASC");
                        $stmtD->execute($bIds);
                        $dMap = [];
                        foreach ($stmtD->fetchAll(PDO::FETCH_ASSOC) ?: [] as $dRow) {
                            $dMap[(int)$dRow['request_id']][] = $dRow;
                        }
                        foreach ($bulks as &$bRow) {
                            $bRow['details'] = $dMap[(int)$bRow['id']] ?? [];
                        }
                        unset($bRow);
                    }
                    $result['bulk_attendance_requests'] = $bulks;
                }

                if ($reqType === 'all' || $reqType === 'salary_advance') {
                    $stmtAdv = $db->prepare("
                        SELECT a.*, u1.full_name AS approver_name
                        FROM hrm_salary_advances a
                        LEFT JOIN users u1 ON a.approver_id = u1.id
                        WHERE a.user_id = ?
                        ORDER BY a.created_at DESC
                        LIMIT 30
                    ");
                    $stmtAdv->execute([$uid]);
                    $result['salary_advance_requests'] = $stmtAdv->fetchAll(PDO::FETCH_ASSOC) ?: [];
                }

                return [
                    'success' => true,
                    'action' => 'list_my_requests',
                    'request_type_filter' => $reqType,
                    'data' => $result
                ];
            }

            // ----------------------------------------------------------
            // 4. CREATE LEAVE / WFH / OT / LATE_EARLY REQUEST
            // ----------------------------------------------------------
            case 'create_leave_or_ot_request': {
                $leaveType = strtolower(trim((string)($args['leave_type'] ?? 'annual')));
                $allowedLeaveTypes = [
                    'annual', 'compensatory', 'sick', 'unpaid', 'remote_work',
                    'business_trip', 'late_early', 'overtime', 'marriage',
                    'funeral', 'maternity', 'paternity'
                ];
                if (!in_array($leaveType, $allowedLeaveTypes, true)) {
                    return ['success' => false, 'message' => "Loại đơn '{$leaveType}' không hợp lệ."];
                }

                $startDate = trim((string)($args['start_date'] ?? ''));
                $endDate = trim((string)($args['end_date'] ?? $startDate));
                if ($startDate === '') {
                    return ['success' => false, 'message' => 'Vui lòng cung cấp ngày bắt đầu (start_date).'];
                }

                $startTs = strtotime($startDate);
                $endTs = strtotime($endDate);
                if ($startTs === false || $endTs === false || $endTs < $startTs) {
                    return ['success' => false, 'message' => 'Thời gian bắt đầu / kết thúc không hợp lệ (end_date phải >= start_date).'];
                }

                $totalDays = isset($args['total_days']) && (float)$args['total_days'] > 0
                    ? (float)$args['total_days']
                    : (float)(floor(($endTs - $startTs) / 86400) + 1);
                $reason = trim((string)($args['reason'] ?? ''));

                // Resolve approver_id
                $approverId = !empty($args['approver_id']) ? (int)$args['approver_id'] : 0;
                if ($approverId <= 0 && !empty($args['approver_name'])) {
                    $appUser = self::findUserInTenant($db, $tid, 0, (string)$args['approver_name']);
                    if ($appUser) {
                        $approverId = (int)$appUser['id'];
                    }
                }
                if ($approverId <= 0) {
                    $approverId = self::resolveDefaultApproverId($db, $tid, $uid);
                }

                // Include HR in related_user_ids
                $relIds = [];
                $stmtHr = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND (role = 'hr' OR username = 'phuongntd') AND id != ? LIMIT 1");
                $stmtHr->execute([$tid, $uid]);
                $hrId = (int)$stmtHr->fetchColumn();
                if ($hrId > 0 && $hrId !== $approverId) {
                    $relIds[] = $hrId;
                }
                $relatedJson = !empty($relIds) ? json_encode(array_values(array_unique($relIds))) : null;

                $otType = null;
                $otRate = null;
                $salaryRate = 100.0;
                $unpaidDays = 0.0;

                if ($leaveType === 'overtime') {
                    $otType = (!empty($args['ot_type']) && in_array($args['ot_type'], ['salary', 'compensatory'], true))
                        ? $args['ot_type']
                        : 'salary';
                    $otRate = ($otType === 'compensatory') ? 1.0 : 1.5;
                } elseif ($leaveType === 'remote_work') {
                    $targetMonth = date('Y-m', $startTs);
                    $stmtWfh = $db->prepare("
                        SELECT COALESCE(SUM(total_days), 0)
                        FROM hrm_leave_requests
                        WHERE user_id = ? AND leave_type = 'remote_work'
                          AND status IN ('approved', 'pending')
                          AND start_date >= ? AND start_date <= ?
                    ");
                    $stmtWfh->execute([$uid, $targetMonth . '-01 00:00:00', date('Y-m-t 23:59:59', strtotime($targetMonth . '-01'))]);
                    $usedWfh = (float)$stmtWfh->fetchColumn();
                    $salaryRate = ($usedWfh < 2.0) ? 100.0 : 50.0;
                    $unpaidDays = round($totalDays * (1.0 - ($salaryRate / 100.0)), 2);
                } elseif ($leaveType === 'unpaid') {
                    $salaryRate = 0.0;
                    $unpaidDays = $totalDays;
                }

                $stmtIns = $db->prepare("
                    INSERT INTO hrm_leave_requests (
                        user_id, leave_type, ot_type, ot_rate, salary_rate,
                        start_date, end_date, total_days, unpaid_days, reason,
                        status, approver_id, status_level_1, status_level_2, related_user_ids
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending', 'none', ?)
                ");
                $stmtIns->execute([
                    $uid, $leaveType, $otType, $otRate, $salaryRate,
                    $startDate, $endDate, $totalDays, $unpaidDays, $reason,
                    $approverId ?: null, $relatedJson
                ]);
                $newId = (int)$db->lastInsertId();

                return [
                    'success' => true,
                    'action' => 'create_leave_or_ot_request',
                    'request_id' => $newId,
                    'leave_type' => $leaveType,
                    'ot_type' => $otType,
                    'salary_rate' => $salaryRate,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'total_days' => $totalDays,
                    'unpaid_days' => $unpaidDays,
                    'status' => 'pending',
                    'approver_id' => $approverId,
                    'message' => "Đã tạo đơn #{$newId} ({$leaveType}, {$totalDays} ngày) từ {$startDate} đến {$endDate} thành công và gửi chờ phê duyệt."
                ];
            }

            // ----------------------------------------------------------
            // 5. CANCEL MY REQUEST
            // ----------------------------------------------------------
            case 'cancel_my_request': {
                $reqType = strtolower(trim((string)($args['request_type'] ?? 'leave')));
                $reqId = (int)($args['request_id'] ?? 0);
                if ($reqId <= 0) {
                    return ['success' => false, 'message' => 'Vui lòng cung cấp mã ID đơn (request_id) cần hủy.'];
                }

                if ($reqType === 'leave') {
                    $stmt = $db->prepare("SELECT id, status, leave_type FROM hrm_leave_requests WHERE id = ? AND user_id = ? LIMIT 1");
                    $stmt->execute([$reqId, $uid]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$row) {
                        return ['success' => false, 'message' => "Không tìm thấy đơn nghỉ phép #{$reqId} của bạn."];
                    }
                    if (!in_array($row['status'], ['pending', 'draft', 'rejected'], true)) {
                        return ['success' => false, 'message' => "Không thể hủy đơn #{$reqId} vì đơn đã ở trạng thái '{$row['status']}'."];
                    }
                    $db->prepare("DELETE FROM hrm_leave_requests WHERE id = ? AND user_id = ?")->execute([$reqId, $uid]);
                    return ['success' => true, 'message' => "Đã hủy và xóa đơn #{$reqId} của bạn thành công."];
                }

                if ($reqType === 'supplement_attendance' || $reqType === 'bulk_attendance') {
                    $stmt = $db->prepare("SELECT id, status FROM attendance_bulk_requests WHERE id = ? AND user_id = ? LIMIT 1");
                    $stmt->execute([$reqId, $uid]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$row) {
                        return ['success' => false, 'message' => "Không tìm thấy phiếu giải trình công #{$reqId} của bạn."];
                    }
                    if (in_array($row['status'], ['approved', 'completed'], true)) {
                        return ['success' => false, 'message' => "Không thể hủy phiếu giải trình công #{$reqId} đã được phê duyệt."];
                    }
                    $db->beginTransaction();
                    try {
                        $db->prepare("DELETE FROM attendance_bulk_request_details WHERE request_id = ?")->execute([$reqId]);
                        $db->prepare("DELETE FROM attendance_bulk_requests WHERE id = ? AND user_id = ?")->execute([$reqId, $uid]);
                        $db->commit();
                    } catch (\Throwable $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        throw $e;
                    }
                    return ['success' => true, 'message' => "Đã hủy phiếu giải trình công #{$reqId} thành công."];
                }

                if ($reqType === 'salary_advance') {
                    $stmt = $db->prepare("SELECT id, status FROM hrm_salary_advances WHERE id = ? AND user_id = ? LIMIT 1");
                    $stmt->execute([$reqId, $uid]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$row) {
                        return ['success' => false, 'message' => "Không tìm thấy đơn ứng lương #{$reqId} của bạn."];
                    }
                    if (in_array($row['status'], ['approved', 'paid', 'completed'], true)) {
                        return ['success' => false, 'message' => "Không thể hủy đơn ứng lương #{$reqId} đã được duyệt."];
                    }
                    $db->prepare("DELETE FROM hrm_salary_advances WHERE id = ? AND user_id = ?")->execute([$reqId, $uid]);
                    return ['success' => true, 'message' => "Đã hủy đơn tạm ứng lương #{$reqId} thành công."];
                }

                return ['success' => false, 'message' => "Loại đơn '{$reqType}' không hợp lệ để hủy."];
            }

            // ----------------------------------------------------------
            // 6. CREATE SUPPLEMENT ATTENDANCE REQUEST
            // ----------------------------------------------------------
            case 'create_supplement_attendance': {
                $ciDate = trim((string)($args['check_in_date'] ?? ($args['start_date'] ?? '')));
                if ($ciDate === '') {
                    return ['success' => false, 'message' => 'Vui lòng cung cấp ngày cần bổ sung công (check_in_date, định dạng YYYY-MM-DD).'];
                }
                $ts = strtotime($ciDate);
                if ($ts === false) {
                    return ['success' => false, 'message' => 'Định dạng ngày bổ sung công không hợp lệ.'];
                }
                $ciDate = date('Y-m-d', $ts);
                if ($ciDate > date('Y-m-d')) {
                    return ['success' => false, 'message' => 'Không thể tạo phiếu bổ sung công cho ngày trong tương lai.'];
                }

                $inTime = trim((string)($args['suggested_check_in'] ?? '08:00'));
                $outTime = trim((string)($args['suggested_check_out'] ?? '17:00'));
                $reason = trim((string)($args['reason'] ?? 'Bổ sung chấm công'));
                $monthPeriod = substr($ciDate, 0, 7);

                $approverId = !empty($args['approver_id']) ? (int)$args['approver_id'] : self::resolveDefaultApproverId($db, $tid, $uid);
                $isLeaderOrManager = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'leader'], true);
                $status = $isLeaderOrManager ? 'approved' : 'pending_manager';
                $approvedBy = $isLeaderOrManager ? $uid : null;
                $approvedAt = $isLeaderOrManager ? date('Y-m-d H:i:s') : null;

                $db->beginTransaction();
                try {
                    $stmtReq = $db->prepare("
                        INSERT INTO attendance_bulk_requests (user_id, month_period, status, manager_id, approved_by, approved_at, admin_note)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmtReq->execute([
                        $uid,
                        $monthPeriod,
                        $status,
                        $isLeaderOrManager ? $uid : ($approverId ?: null),
                        $approvedBy,
                        $approvedAt,
                        $isLeaderOrManager ? 'Trưởng phòng tự tạo và tự phê duyệt chấm công' : null
                    ]);
                    $reqId = (int)$db->lastInsertId();

                    $stmtDet = $db->prepare("
                        INSERT INTO attendance_bulk_request_details (request_id, check_in_date, suggested_check_in, suggested_check_out, reason, approved)
                        VALUES (?, ?, ?, ?, ?, 1)
                    ");
                    $stmtDet->execute([$reqId, $ciDate, $inTime, $outTime, $reason]);

                    if ($isLeaderOrManager) {
                        $stmtUpsertCi = $db->prepare("
                            INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, reason, admin_note, late_minutes, early_minutes)
                            VALUES (?, ?, ?, ?, 'approved', ?, 'Tự động duyệt theo phân quyền Quản lý', 0, 0)
                            ON DUPLICATE KEY UPDATE
                                check_in_time = VALUES(check_in_time),
                                check_out_time = VALUES(check_out_time),
                                status = 'approved',
                                reason = VALUES(reason),
                                late_minutes = 0,
                                early_minutes = 0
                        ");
                        $stmtUpsertCi->execute([
                            $uid,
                            $ciDate,
                            "{$ciDate} {$inTime}:00",
                            "{$ciDate} {$outTime}:00",
                            $reason
                        ]);
                    }

                    $db->commit();

                    return [
                        'success' => true,
                        'action' => 'create_supplement_attendance',
                        'request_id' => $reqId,
                        'check_in_date' => $ciDate,
                        'suggested_check_in' => $inTime,
                        'suggested_check_out' => $outTime,
                        'status' => $status,
                        'message' => "Đã tạo phiếu bổ sung công #{$reqId} cho ngày {$ciDate} ({$inTime} - {$outTime}) thành công."
                    ];
                } catch (\Throwable $e) {
                    if ($db->inTransaction()) {
                        $db->rollBack();
                    }
                    throw $e;
                }
            }

            // ----------------------------------------------------------
            // 7. CREATE SALARY ADVANCE
            // ----------------------------------------------------------
            case 'create_salary_advance': {
                $amount = isset($args['amount']) ? (float)$args['amount'] : 0.0;
                if ($amount <= 0) {
                    return ['success' => false, 'message' => 'Số tiền xin tạm ứng lương (amount) phải lớn hơn 0 VNĐ.'];
                }
                $reason = trim((string)($args['reason'] ?? 'Đề xuất tạm ứng lương'));
                $reqDate = !empty($args['start_date']) ? date('Y-m-d', strtotime((string)$args['start_date'])) : date('Y-m-d');
                $approverId = !empty($args['approver_id']) ? (int)$args['approver_id'] : self::resolveDefaultApproverId($db, $tid, $uid);

                $stmtIns = $db->prepare("
                    INSERT INTO hrm_salary_advances (user_id, amount, request_date, reason, status, approver_id, status_level_1, status_level_2)
                    VALUES (?, ?, ?, ?, 'pending', ?, 'pending', 'none')
                ");
                $stmtIns->execute([$uid, $amount, $reqDate, $reason, $approverId ?: null]);
                $advId = (int)$db->lastInsertId();

                return [
                    'success' => true,
                    'action' => 'create_salary_advance',
                    'request_id' => $advId,
                    'amount' => $amount,
                    'amount_formatted' => number_format($amount, 0, ',', '.') . ' VNĐ',
                    'request_date' => $reqDate,
                    'status' => 'pending',
                    'approver_id' => $approverId,
                    'message' => 'Đã tạo đơn xin tạm ứng lương #' . $advId . ' với số tiền ' . number_format($amount, 0, ',', '.') . ' VNĐ thành công.'
                ];
            }

            // ----------------------------------------------------------
            // 8. GET MY ATTENDANCE CONFIRMATION
            // ----------------------------------------------------------
            case 'get_my_attendance_confirmation': {
                if (class_exists('HRMController') && method_exists('HRMController', 'autoConfirmExpiredAttendance')) {
                    \HRMController::autoConfirmExpiredAttendance($db, $tid);
                }

                $confId = (int)($args['confirmation_id'] ?? 0);
                $month = !empty($args['month']) ? (int)$args['month'] : 0;
                $year = !empty($args['year']) ? (int)$args['year'] : 0;
                if (!empty($args['month_year']) && preg_match('/^(\d{4})-(\d{2})$/', trim((string)$args['month_year']), $m)) {
                    $year = (int)$m[1];
                    $month = (int)$m[2];
                }

                $whereConf = "ac.user_id = ? AND ac.tenant_id = ?";
                $paramsConf = [$uid, $tid];
                if ($confId > 0) {
                    $whereConf .= " AND ac.id = ?";
                    $paramsConf[] = $confId;
                } elseif ($month > 0 && $year > 0) {
                    $whereConf .= " AND b.month = ? AND b.year = ?";
                    array_push($paramsConf, $month, $year);
                }

                $stmt = $db->prepare("
                    SELECT ac.*, u.gender, u.full_name AS user_full_name,
                           b.title AS batch_title, b.period_type, b.month, b.year,
                           b.from_date, b.to_date, b.deadline_at, b.status AS batch_status
                    FROM attendance_confirmations ac
                    JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                    LEFT JOIN users u ON ac.user_id = u.id
                    WHERE {$whereConf}
                    ORDER BY b.id DESC
                    LIMIT 1
                ");
                $stmt->execute($paramsConf);
                $record = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$record) {
                    return [
                        'success' => true,
                        'has_record' => false,
                        'message' => 'Hiện tại chưa có bản ghi đối soát bảng công nào của bạn trong kỳ được chọn.'
                    ];
                }

                if (class_exists('HRMController') && method_exists('HRMController', 'recalculateConfirmationRecord')) {
                    \HRMController::recalculateConfirmationRecord($db, $tid, $record);
                } else {
                    $quota = self::resolveEmployeeLateQuota($db, $record['gender'] ?? null, $record['emp_name'] ?? null);
                    $lateM = (int)($record['late_minutes'] ?? 0);
                    $record['gender'] = $quota['gender'];
                    $record['gender_label'] = $quota['gender_label'];
                    $record['late_grace_minutes'] = $quota['grace_minutes'];
                    $record['excess_late_minutes'] = max(0, $lateM - $quota['grace_minutes']);
                    $record['remaining_late_grace_minutes'] = max(0, $quota['grace_minutes'] - $lateM);
                }

                return [
                    'success' => true,
                    'has_record' => true,
                    'confirmation' => $record
                ];
            }

            // ----------------------------------------------------------
            // 9. CONFIRM OR DISPUTE MY ATTENDANCE
            // ----------------------------------------------------------
            case 'confirm_or_dispute_my_attendance': {
                $decision = strtolower(trim((string)($args['decision'] ?? 'confirm')));
                $disputeReason = trim((string)($args['dispute_reason'] ?? ($args['reason'] ?? '')));
                $confId = (int)($args['confirmation_id'] ?? ($args['request_id'] ?? 0));

                $whereConf = "ac.user_id = ? AND ac.tenant_id = ?";
                $paramsConf = [$uid, $tid];
                if ($confId > 0) {
                    $whereConf .= " AND ac.id = ?";
                    $paramsConf[] = $confId;
                } elseif (!empty($args['month']) && !empty($args['year'])) {
                    $whereConf .= " AND b.month = ? AND b.year = ?";
                    array_push($paramsConf, (int)$args['month'], (int)$args['year']);
                }

                $stmtFind = $db->prepare("
                    SELECT ac.*, b.from_date, b.to_date, b.title AS batch_title
                    FROM attendance_confirmations ac
                    JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                    WHERE {$whereConf}
                    ORDER BY b.id DESC
                    LIMIT 1
                ");
                $stmtFind->execute($paramsConf);
                $row = $stmtFind->fetch(PDO::FETCH_ASSOC);

                if (!$row) {
                    return ['success' => false, 'message' => 'Không tìm thấy bản ghi đối soát bảng công của bạn.'];
                }

                if ($decision === 'dispute') {
                    if ($disputeReason === '') {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp lý do sai lệch công (dispute_reason) để Phòng Nhân sự kiểm tra.'];
                    }
                    $stmtUpd = $db->prepare("
                        UPDATE attendance_confirmations
                        SET status = 'disputed', dispute_reason = ?, confirmed_at = NULL, confirmed_by_type = 'employee', updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ? AND tenant_id = ?
                    ");
                    $stmtUpd->execute([$disputeReason, (int)$row['id'], $uid, $tid]);
                    return [
                        'success' => true,
                        'confirmation_id' => (int)$row['id'],
                        'status' => 'disputed',
                        'dispute_reason' => $disputeReason,
                        'message' => "Đã ghi nhận khiếu nại bảng công ({$row['batch_title']}) và gửi tới Phòng Nhân sự xử lý."
                    ];
                }

                if (class_exists('HRMController') && method_exists('HRMController', 'recalculateConfirmationRecord')) {
                    \HRMController::recalculateConfirmationRecord($db, $tid, $row);
                }

                $stmtUpd = $db->prepare("
                    UPDATE attendance_confirmations
                    SET status = 'confirmed', dispute_reason = NULL, confirmed_at = NOW(), confirmed_by_type = 'employee', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ? AND tenant_id = ?
                ");
                $stmtUpd->execute([(int)$row['id'], $uid, $tid]);

                return [
                    'success' => true,
                    'confirmation_id' => (int)$row['id'],
                    'status' => 'confirmed',
                    'total_paid_days' => (float)($row['total_paid_days'] ?? 0),
                    'message' => "Đã xác nhận bảng công ({$row['batch_title']}) thành công."
                ];
            }

            // ----------------------------------------------------------
            // 10. CONFIRM OR DISPUTE MY PAYSLIP
            // ----------------------------------------------------------
            case 'confirm_or_dispute_my_payslip': {
                $decision = strtolower(trim((string)($args['decision'] ?? 'confirm')));
                $disputeReason = trim((string)($args['dispute_reason'] ?? ($args['reason'] ?? '')));
                $psId = (int)($args['confirmation_id'] ?? ($args['request_id'] ?? 0));
                $monthYear = trim((string)($args['month_year'] ?? ''));
                if ($monthYear === '' && !empty($args['month']) && !empty($args['year'])) {
                    $monthYear = sprintf('%04d-%02d', (int)$args['year'], (int)$args['month']);
                }

                if ($psId > 0) {
                    $stmtPs = $db->prepare("SELECT * FROM monthly_payslips WHERE id = ? AND user_id = ? LIMIT 1");
                    $stmtPs->execute([$psId, $uid]);
                } elseif ($monthYear !== '') {
                    $stmtPs = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? AND month_year = ? LIMIT 1");
                    $stmtPs->execute([$uid, $monthYear]);
                } else {
                    $stmtPs = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? ORDER BY month_year DESC LIMIT 1");
                    $stmtPs->execute([$uid]);
                }

                $ps = $stmtPs->fetch(PDO::FETCH_ASSOC);
                if (!$ps) {
                    return ['success' => false, 'message' => 'Không tìm thấy phiếu lương của bạn trong kỳ được chọn.'];
                }

                if ($ps['status'] === 'locked') {
                    return ['success' => false, 'message' => "Phiếu lương kỳ {$ps['month_year']} đã khóa sổ, không thể thay đổi trạng thái."];
                }

                if ($decision === 'dispute') {
                    if ($disputeReason === '') {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp nội dung phản hồi/khiếu nại phiếu lương (dispute_reason).'];
                    }
                    $stmtUpd = $db->prepare("UPDATE monthly_payslips SET status = 'disputed', note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
                    $stmtUpd->execute([$disputeReason, (int)$ps['id'], $uid]);
                    return [
                        'success' => true,
                        'payslip_id' => (int)$ps['id'],
                        'month_year' => $ps['month_year'],
                        'status' => 'disputed',
                        'note' => $disputeReason,
                        'message' => "Đã gửi khiếu nại phiếu lương kỳ {$ps['month_year']} tới Phòng Nhân sự / Kế toán."
                    ];
                }

                $stmtUpd = $db->prepare("UPDATE monthly_payslips SET status = 'confirmed', confirmed_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
                $stmtUpd->execute([(int)$ps['id'], $uid]);

                return [
                    'success' => true,
                    'payslip_id' => (int)$ps['id'],
                    'month_year' => $ps['month_year'],
                    'status' => 'confirmed',
                    'net_salary' => number_format((float)$ps['net_salary'], 0, ',', '.') . ' VNĐ',
                    'message' => "Đã xác nhận phiếu lương kỳ {$ps['month_year']} thành công."
                ];
            }

            default:
                return ['success' => false, 'message' => "Hành động '{$action}' không được hỗ trợ trong manage_my_hr_profile_and_requests."];
        }
    }

    /**
     * Execute Tool 2: smart_manage_hrm_and_payroll
     * Enterprise HR, Attendance, Contracts, Assets, Request Approvals & Payroll Management with Zero-Trust RBAC.
     */
    public static function executeSmartManageHrmAndPayroll(PDO $db, array $args, array $auth): array
    {
        $uid = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower(trim((string)($auth['role'] ?? '')));

        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'general_director'], true) || !empty($auth['is_admin']);
        $isHR = in_array($role, ['hr', 'nhan_su', 'hrm', 'hr_manager'], true) || !empty($auth['is_hr']);
        $isAccountant = in_array($role, ['accountant', 'ke_toan', 'finance', 'chief_accountant'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead', 'head_of_department'], true);

        $canManageHrm = ($isGlobalAdmin || $isHR);
        $canViewSalary = ($isGlobalAdmin || $isHR || $isAccountant);

        if (!$canManageHrm && !$isAccountant && !$isManager) {
            return [
                'success' => false,
                'restricted' => true,
                'message' => 'Công cụ quản trị Nhân sự & Bảng lương chỉ dành cho Ban Giám đốc, Phòng Nhân sự (HR), Kế toán hoặc Trưởng phòng. Để xem hoặc cập nhật hồ sơ cá nhân của chính mình, vui lòng sử dụng công cụ cá nhân.'
            ];
        }

        $action = strtolower(trim((string)($args['action'] ?? 'query_staff_360')));

        switch ($action) {
            // ----------------------------------------------------------
            // 1. QUERY STAFF 360 (100% SCHEMA COVERAGE)
            // ----------------------------------------------------------
            case 'query_staff_360':
            case 'get_employee_360':
            case 'get_staff_360':
            case 'list_staff': {
                $empId = (int)($args['employee_id'] ?? 0);
                $empName = trim((string)($args['employee_name'] ?? ''));

                if ($empId <= 0 && $empName === '') {
                    // Multi-employee list query using applyExtendedHrmMultiTierFilters
                    $monthYear = trim((string)($args['month_year'] ?? date('Y-m')));
                    $where = ["u.tenant_id = ?", "u.role NOT IN ('superadmin', 'super_admin')"];
                    $params = [$monthYear, $tid];

                    if (!$canViewSalary && $isManager) {
                        $where[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))";
                        array_push($params, $uid, $uid, $uid);
                    }

                    if (!empty($args['department'])) {
                        $likeD = '%' . trim((string)$args['department']) . '%';
                        $where[] = "(u.department LIKE ? OR tm.name LIKE ?)";
                        array_push($params, $likeD, $likeD);
                    }
                    if (!empty($args['status']) && $args['status'] !== 'all') {
                        $where[] = "COALESCE(u.status, 'active') = ?";
                        $params[] = trim((string)$args['status']);
                    }

                    self::applyExtendedHrmMultiTierFilters($db, $args, $where, $params, $tid, $uid, $canViewSalary);

                    $whereSql = implode(' AND ', $where);
                    $stmtList = $db->prepare("
                        SELECT u.id, u.full_name, u.email, u.phone, u.role, u.job_title, u.department,
                               u.gender, u.dob, u.status, u.is_active, u.vacation_mode,
                               COALESCE(tm.name, '') AS team_name,
                               hp.joined_date, hp.base_salary, hp.deal_salary, hp.has_insurance,
                               hp.annual_leave_total, hp.annual_leave_used,
                               hp.compensatory_leave_total, hp.compensatory_leave_used,
                               mp.net_salary, mp.lateness_minutes, mp.overtime_days, mp.status AS payslip_status
                        FROM users u
                        LEFT JOIN hrm_profiles hp ON hp.user_id = u.id
                        LEFT JOIN teams tm ON u.team_id = tm.id
                        LEFT JOIN monthly_payslips mp ON (mp.user_id = u.id AND mp.month_year = ?)
                        WHERE {$whereSql}
                        ORDER BY u.full_name ASC
                        LIMIT 50
                    ");
                    $stmtList->execute($params);
                    $rows = $stmtList->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    foreach ($rows as &$r) {
                        $q = self::resolveEmployeeLateQuota($db, $r['gender'] ?? null, $r['full_name'] ?? null);
                        $r['gender'] = $q['gender'];
                        $r['gender_label'] = $q['gender_label'];
                        $r['monthly_late_grace_minutes'] = $q['grace_minutes'];
                        if (!$canViewSalary && (int)$r['id'] !== $uid) {
                            $r['base_salary'] = 'Bảo mật';
                            $r['deal_salary'] = 'Bảo mật';
                            $r['net_salary'] = 'Bảo mật';
                        }
                    }
                    unset($r);

                    return [
                        'success' => true,
                        'action' => 'query_staff_360',
                        'mode' => 'multi_staff_list',
                        'month_year' => $monthYear,
                        'count' => count($rows),
                        'staff_list' => $rows
                    ];
                }

                $targetUser = self::findUserInTenant($db, $tid, $empId, $empName);
                if (!$targetUser) {
                    return ['success' => false, 'message' => 'Không tìm thấy nhân sự phù hợp trong hệ thống.'];
                }
                $targetUid = (int)$targetUser['id'];

                if (!self::canAccessEmployee($db, $tid, $uid, $targetUid, $canManageHrm || $isAccountant, $isManager)) {
                    return [
                        'success' => false,
                        'restricted' => true,
                        'message' => "Bạn không có quyền truy cập hồ sơ 360 độ của nhân sự {$targetUser['full_name']}."
                    ];
                }

                $stmtFull = $db->prepare("
                    SELECT u.id, u.tenant_id, u.username, u.email, u.full_name, u.job_title, u.phone,
                           u.avatar_url, u.signature_url, u.role, u.department, u.is_active,
                           u.two_factor_enabled, u.two_factor_type, u.status, u.vacation_mode,
                           u.leave_start, u.leave_end, u.work_start_time, u.work_end_time,
                           u.work_schedule, u.zalo_chat_id, u.telegram_chat_id, u.is_confirmed,
                           u.bio, u.last_login_at, u.created_at, u.updated_at, u.team_id,
                           u.dob, u.gender, u.citizen_id, u.address, u.bank_name, u.bank_account,
                           u.overtime_mode, u.manager_behavior_mode, u.use_custom_work_hours,
                           t.name AS team_name,
                           hp.joined_date, hp.base_salary, hp.deal_salary, hp.has_insurance,
                           hp.allowance_meal, hp.allowance_meal_type, hp.allowance_travel, hp.allowance_phone,
                           hp.kpi_target, hp.kpi_multiplier_rules, hp.custom_fields_json,
                           hp.annual_leave_total, hp.annual_leave_used,
                           hp.compensatory_leave_total, hp.compensatory_leave_used,
                           hp.insurance_rate_bhxh, hp.insurance_rate_bhyt, hp.insurance_rate_bhtn
                    FROM users u
                    LEFT JOIN hrm_profiles hp ON hp.user_id = u.id
                    LEFT JOIN teams t ON u.team_id = t.id
                    WHERE u.id = ? AND u.tenant_id = ?
                    LIMIT 1
                ");
                $stmtFull->execute([$targetUid, $tid]);
                $empProfile = $stmtFull->fetch(PDO::FETCH_ASSOC);

                $quota = self::resolveEmployeeLateQuota($db, $empProfile['gender'] ?? null, $empProfile['full_name'] ?? null);
                $leaveBalance = self::recalculateEmployeeLeaveBalance($db, $targetUid);

                $stmtContracts = $db->prepare("SELECT * FROM hrm_contracts WHERE user_id = ? ORDER BY start_date DESC, id DESC");
                $stmtContracts->execute([$targetUid]);
                $contracts = $stmtContracts->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $stmtAssets = $db->prepare("SELECT * FROM hrm_assets WHERE user_id = ? ORDER BY id DESC");
                $stmtAssets->execute([$targetUid]);
                $assets = $stmtAssets->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $stmtPayslips = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? ORDER BY month_year DESC LIMIT 6");
                $stmtPayslips->execute([$targetUid]);
                $payslips = $stmtPayslips->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $stmtConfs = $db->prepare("
                    SELECT ac.*, b.title AS batch_title, b.month, b.year, b.from_date, b.to_date, b.deadline_at
                    FROM attendance_confirmations ac
                    JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                    WHERE ac.user_id = ? AND ac.tenant_id = ?
                    ORDER BY b.id DESC
                    LIMIT 6
                ");
                $stmtConfs->execute([$targetUid, $tid]);
                $confirmations = $stmtConfs->fetchAll(PDO::FETCH_ASSOC) ?: [];

                if (!$canViewSalary && $targetUid !== $uid) {
                    foreach (['base_salary', 'deal_salary', 'allowance_meal', 'allowance_travel', 'allowance_phone', 'kpi_target'] as $sCol) {
                        $empProfile[$sCol] = 'Bảo mật';
                    }
                    foreach ($contracts as &$cRow) {
                        $cRow['salary_base'] = 'Bảo mật';
                        $cRow['salary_deal'] = 'Bảo mật';
                    }
                    unset($cRow);
                    $payslips = [];
                }

                return [
                    'success' => true,
                    'action' => 'query_staff_360',
                    'employee_profile' => $empProfile,
                    'gender_late_quota' => $quota,
                    'leave_balance' => $leaveBalance,
                    'contracts' => $contracts,
                    'assets' => $assets,
                    'recent_payslips' => $payslips,
                    'recent_attendance_confirmations' => $confirmations
                ];
            }

            // ----------------------------------------------------------
            // 2. UPDATE EMPLOYEE HR PROFILE
            // ----------------------------------------------------------
            case 'update_employee_hr_profile':
            case 'update_employee_profile_and_salary': {
                if (!$canManageHrm && !$isAccountant) {
                    return ['success' => false, 'restricted' => true, 'message' => 'Chỉ Phòng Nhân sự (HR), Kế toán hoặc Ban Giám đốc mới có quyền cập nhật hồ sơ nhân sự và lương.'];
                }

                $targetUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                if (!$targetUser) {
                    return ['success' => false, 'message' => 'Không tìm thấy nhân sự cần cập nhật hồ sơ.'];
                }
                $targetUid = (int)$targetUser['id'];

                $userSets = [];
                $userParams = [];

                $userStringCols = ['department', 'job_title', 'dob', 'citizen_id', 'phone', 'address', 'bank_name', 'bank_account', 'status', 'work_start_time', 'work_end_time'];
                foreach ($userStringCols as $col) {
                    if (array_key_exists($col, $args) && $args[$col] !== null && $args[$col] !== '') {
                        $userSets[] = "{$col} = ?";
                        $userParams[] = trim((string)$args[$col]);
                    }
                }

                if (!empty($args['role'])) {
                    $newRole = strtolower(trim((string)$args['role']));
                    if (in_array($newRole, ['superadmin', 'super_admin', 'admin', 'director'], true) && !$isGlobalAdmin) {
                        return ['success' => false, 'restricted' => true, 'message' => 'Chỉ Ban Giám đốc / Superadmin mới có quyền cấp vai trò Quản trị cấp cao.'];
                    }
                    $userSets[] = "role = ?";
                    $userParams[] = $newRole;
                }

                if (isset($args['team_id']) && (int)$args['team_id'] > 0) {
                    $userSets[] = "team_id = ?";
                    $userParams[] = (int)$args['team_id'];
                }

                if (!empty($args['gender'])) {
                    $qInfo = self::resolveEmployeeLateQuota($db, (string)$args['gender'], $targetUser['full_name'] ?? null);
                    $userSets[] = "gender = ?";
                    $userParams[] = $qInfo['gender'];
                }

                if (array_key_exists('use_custom_work_hours', $args) && $args['use_custom_work_hours'] !== null) {
                    $userSets[] = "use_custom_work_hours = ?";
                    $userParams[] = ($args['use_custom_work_hours'] === true || $args['use_custom_work_hours'] === 1 || $args['use_custom_work_hours'] === '1') ? 1 : 0;
                }

                $db->beginTransaction();
                try {
                    if (!empty($userSets)) {
                        $userSets[] = "updated_at = CURRENT_TIMESTAMP";
                        $userParams[] = $targetUid;
                        $userParams[] = $tid;
                        $db->prepare("UPDATE users SET " . implode(', ', $userSets) . " WHERE id = ? AND tenant_id = ?")->execute($userParams);
                    }

                    // Ensure hrm_profiles row exists
                    $stmtExist = $db->prepare("SELECT user_id FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                    $stmtExist->execute([$targetUid]);
                    if (!$stmtExist->fetchColumn()) {
                        $joinedDefault = !empty($args['joined_date']) ? trim((string)$args['joined_date']) : date('Y-m-d');
                        $db->prepare("INSERT INTO hrm_profiles (user_id, joined_date) VALUES (?, ?)")->execute([$targetUid, $joinedDefault]);
                    }

                    $profSets = [];
                    $profParams = [];
                    $profNumCols = ['base_salary', 'deal_salary', 'allowance_meal', 'allowance_travel', 'allowance_phone', 'kpi_target', 'annual_leave_total', 'compensatory_leave_total'];
                    foreach ($profNumCols as $pCol) {
                        if (array_key_exists($pCol, $args) && $args[$pCol] !== null && $args[$pCol] !== '') {
                            $profSets[] = "{$pCol} = ?";
                            $profParams[] = (float)$args[$pCol];
                        }
                    }
                    if (!empty($args['joined_date'])) {
                        $profSets[] = "joined_date = ?";
                        $profParams[] = trim((string)$args['joined_date']);
                    }
                    if (!empty($args['allowance_meal_type']) && in_array($args['allowance_meal_type'], ['per_day', 'fixed'], true)) {
                        $profSets[] = "allowance_meal_type = ?";
                        $profParams[] = $args['allowance_meal_type'];
                    }
                    if (array_key_exists('has_insurance', $args) && $args['has_insurance'] !== null) {
                        $profSets[] = "has_insurance = ?";
                        $profParams[] = ($args['has_insurance'] === true || $args['has_insurance'] === 1 || $args['has_insurance'] === '1') ? 1 : 0;
                    }

                    if (!empty($profSets)) {
                        $profSets[] = "updated_at = CURRENT_TIMESTAMP";
                        $profParams[] = $targetUid;
                        $db->prepare("UPDATE hrm_profiles SET " . implode(', ', $profSets) . " WHERE user_id = ?")->execute($profParams);
                    }

                    $db->commit();

                    return [
                        'success' => true,
                        'action' => 'update_employee_hr_profile',
                        'employee_id' => $targetUid,
                        'employee_name' => $targetUser['full_name'],
                        'message' => "Đã cập nhật hồ sơ nhân sự và chế độ lương/phụ cấp cho {$targetUser['full_name']} thành công."
                    ];
                } catch (\Throwable $e) {
                    if ($db->inTransaction()) {
                        $db->rollBack();
                    }
                    throw $e;
                }
            }

            // ----------------------------------------------------------
            // 3. MANAGE CONTRACT (hrm_contracts)
            // ----------------------------------------------------------
            case 'manage_contract': {
                if (!$canManageHrm) {
                    return ['success' => false, 'restricted' => true, 'message' => 'Chỉ Phòng Nhân sự (HR) hoặc Ban Giám đốc mới có quyền quản lý hợp đồng lao động.'];
                }

                $targetUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                if (!$targetUser) {
                    return ['success' => false, 'message' => 'Không tìm thấy nhân sự để quản lý hợp đồng.'];
                }
                $targetUid = (int)$targetUser['id'];

                $contractCode = trim((string)($args['contract_code'] ?? ''));
                $contractType = trim((string)($args['contract_type'] ?? 'official'));
                $startDate = trim((string)($args['start_date'] ?? date('Y-m-d')));
                $endDate = !empty($args['end_date']) ? trim((string)$args['end_date']) : null;
                $salaryBase = isset($args['base_salary']) ? (float)$args['base_salary'] : 0.0;
                $salaryDeal = isset($args['deal_salary']) ? (float)$args['deal_salary'] : 0.0;
                $probationRate = isset($args['probation_rate']) ? (int)$args['probation_rate'] : 100;
                $status = !empty($args['status']) ? trim((string)$args['status']) : 'active';

                if ($contractCode === '') {
                    $contractCode = 'HDLD-' . date('Ymd') . '-' . $targetUid;
                }

                $stmtChk = $db->prepare("SELECT id FROM hrm_contracts WHERE contract_code = ? AND user_id = ? LIMIT 1");
                $stmtChk->execute([$contractCode, $targetUid]);
                $existingId = (int)$stmtChk->fetchColumn();

                if ($existingId > 0) {
                    $stmtUpd = $db->prepare("
                        UPDATE hrm_contracts
                        SET contract_type = ?, salary_base = ?, salary_deal = ?, probation_rate = ?,
                            start_date = ?, end_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ?
                    ");
                    $stmtUpd->execute([$contractType, $salaryBase, $salaryDeal, $probationRate, $startDate, $endDate, $status, $existingId, $targetUid]);
                    $contractId = $existingId;
                } else {
                    $stmtIns = $db->prepare("
                        INSERT INTO hrm_contracts (user_id, contract_code, contract_type, salary_base, salary_deal, salary_type, probation_rate, start_date, end_date, status)
                        VALUES (?, ?, ?, ?, ?, 'gross', ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([$targetUid, $contractCode, $contractType, $salaryBase, $salaryDeal, $probationRate, $startDate, $endDate, $status]);
                    $contractId = (int)$db->lastInsertId();
                }

                return [
                    'success' => true,
                    'action' => 'manage_contract',
                    'contract_id' => $contractId,
                    'contract_code' => $contractCode,
                    'employee_id' => $targetUid,
                    'employee_name' => $targetUser['full_name'],
                    'message' => "Đã lưu hợp đồng lao động {$contractCode} cho nhân sự {$targetUser['full_name']}."
                ];
            }

            // ----------------------------------------------------------
            // 4. MANAGE ASSET (hrm_assets)
            // ----------------------------------------------------------
            case 'manage_asset': {
                if (!$canManageHrm) {
                    return ['success' => false, 'restricted' => true, 'message' => 'Chỉ Phòng Nhân sự (HR) hoặc Ban Giám đốc mới có quyền quản lý tài sản cấp phát.'];
                }

                $targetUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                if (!$targetUser) {
                    return ['success' => false, 'message' => 'Không tìm thấy nhân sự để cấp phát / cập nhật tài sản.'];
                }
                $targetUid = (int)$targetUser['id'];
                $assetId = (int)($args['asset_id'] ?? 0);
                $assetName = trim((string)($args['asset_name'] ?? ''));
                $assetCode = trim((string)($args['asset_code'] ?? ''));
                $givenDate = !empty($args['given_date']) ? trim((string)$args['given_date']) : date('Y-m-d');
                $returnedDate = !empty($args['returned_date']) ? trim((string)$args['returned_date']) : null;
                $conditionNote = trim((string)($args['condition_note'] ?? ($args['note'] ?? '')));
                $assetStatus = !empty($args['asset_status']) ? trim((string)$args['asset_status']) : ($returnedDate ? 'returned' : 'in_use');

                if ($assetId > 0) {
                    $stmtUpd = $db->prepare("
                        UPDATE hrm_assets
                        SET asset_name = COALESCE(NULLIF(?, ''), asset_name),
                            asset_code = COALESCE(NULLIF(?, ''), asset_code),
                            returned_date = COALESCE(?, returned_date),
                            condition_note = COALESCE(NULLIF(?, ''), condition_note),
                            status = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ?
                    ");
                    $stmtUpd->execute([$assetName, $assetCode, $returnedDate, $conditionNote, $assetStatus, $assetId, $targetUid]);
                } else {
                    if ($assetName === '') {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp tên tài sản (asset_name) cần bàn giao.'];
                    }
                    if ($assetCode === '') {
                        $assetCode = 'TS-' . date('YmdHis');
                    }
                    $stmtIns = $db->prepare("
                        INSERT INTO hrm_assets (user_id, asset_name, asset_code, given_date, returned_date, condition_note, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([$targetUid, $assetName, $assetCode, $givenDate, $returnedDate, $conditionNote, $assetStatus]);
                    $assetId = (int)$db->lastInsertId();
                }

                return [
                    'success' => true,
                    'action' => 'manage_asset',
                    'asset_id' => $assetId,
                    'employee_id' => $targetUid,
                    'employee_name' => $targetUser['full_name'],
                    'status' => $assetStatus,
                    'message' => "Đã cập nhật tài sản cấp phát #{$assetId} cho nhân sự {$targetUser['full_name']}."
                ];
            }

            // ----------------------------------------------------------
            // 5. APPROVE OR REJECT HR REQUEST
            // ----------------------------------------------------------
            case 'approve_or_reject_hr_request': {
                $reqType = strtolower(trim((string)($args['request_type'] ?? 'leave')));
                $reqId = (int)($args['request_id'] ?? 0);
                $decisionRaw = strtolower(trim((string)($args['decision'] ?? 'approve')));
                $isApproved = in_array($decisionRaw, ['approve', 'approved', 'confirm'], true);
                $targetStatus = $isApproved ? 'approved' : 'rejected';
                $reasonNote = trim((string)($args['reason'] ?? ($args['note'] ?? '')));

                if ($reqId <= 0) {
                    return ['success' => false, 'message' => 'Vui lòng cung cấp mã ID phiếu (request_id) cần xử lý.'];
                }

                if ($reqType === 'leave') {
                    $db->beginTransaction();
                    try {
                        $stmtL = $db->prepare("
                            SELECT l.*, u.full_name AS employee_name
                            FROM hrm_leave_requests l
                            JOIN users u ON l.user_id = u.id
                            WHERE l.id = ? AND u.tenant_id = ?
                            FOR UPDATE
                        ");
                        $stmtL->execute([$reqId, $tid]);
                        $lv = $stmtL->fetch(PDO::FETCH_ASSOC);
                        if (!$lv) {
                            $db->rollBack();
                            return ['success' => false, 'message' => "Không tìm thấy đơn nghỉ phép #{$reqId}."];
                        }
                        if ($lv['status'] !== 'pending') {
                            $db->rollBack();
                            return ['success' => false, 'message' => "Đơn #{$reqId} đã được xử lý trước đó (trạng thái: {$lv['status']})."];
                        }
                        if ((int)$lv['user_id'] === $uid && !$isGlobalAdmin) {
                            $db->rollBack();
                            return ['success' => false, 'message' => 'Người tạo đơn không được tự phê duyệt đơn nghỉ phép của chính mình.'];
                        }
                        if (!self::canAccessEmployee($db, $tid, $uid, (int)$lv['user_id'], $canManageHrm, $isManager)
                            && (int)($lv['approver_id'] ?? 0) !== $uid
                            && (int)($lv['approver_id_2'] ?? 0) !== $uid) {
                            $db->rollBack();
                            return ['success' => false, 'restricted' => true, 'message' => 'Bạn không có thẩm quyền phê duyệt đơn này.'];
                        }

                        $db->prepare("
                            UPDATE hrm_leave_requests
                            SET status = ?, status_level_1 = ?, approved_by = ?, approved_at = NOW(), updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ")->execute([$targetStatus, $targetStatus, $uid, $reqId]);

                        $balance = null;
                        if ($isApproved) {
                            $balance = self::recalculateEmployeeLeaveBalance($db, (int)$lv['user_id']);
                        }

                        $db->commit();
                        return [
                            'success' => true,
                            'request_type' => 'leave',
                            'request_id' => $reqId,
                            'decision' => $targetStatus,
                            'employee_name' => $lv['employee_name'],
                            'updated_leave_balance' => $balance,
                            'message' => ($isApproved ? 'Đã phê duyệt' : 'Đã từ chối') . " đơn #{$reqId} của {$lv['employee_name']}."
                        ];
                    } catch (\Throwable $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        throw $e;
                    }
                }

                if ($reqType === 'bulk_attendance') {
                    $db->beginTransaction();
                    try {
                        $stmtB = $db->prepare("
                            SELECT r.*, u.full_name AS employee_name
                            FROM attendance_bulk_requests r
                            JOIN users u ON r.user_id = u.id
                            WHERE r.id = ? AND u.tenant_id = ?
                            FOR UPDATE
                        ");
                        $stmtB->execute([$reqId, $tid]);
                        $bulk = $stmtB->fetch(PDO::FETCH_ASSOC);
                        if (!$bulk) {
                            $db->rollBack();
                            return ['success' => false, 'message' => "Không tìm thấy phiếu giải trình công #{$reqId}."];
                        }
                        if (!in_array($bulk['status'], ['pending_manager', 'pending_hr', 'pending'], true)) {
                            $db->rollBack();
                            return ['success' => false, 'message' => "Phiếu giải trình công #{$reqId} đã được xử lý trước đó ({$bulk['status']})."];
                        }

                        $db->prepare("
                            UPDATE attendance_bulk_requests
                            SET status = ?, approved_by = ?, approved_at = NOW(), admin_note = COALESCE(NULLIF(?, ''), admin_note), updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ")->execute([$targetStatus, $uid, $reasonNote, $reqId]);

                        if ($isApproved) {
                            $stmtDets = $db->prepare("SELECT * FROM attendance_bulk_request_details WHERE request_id = ? AND approved = 1");
                            $stmtDets->execute([$reqId]);
                            $dets = $stmtDets->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            $stmtUpsertCi = $db->prepare("
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
                            foreach ($dets as $d) {
                                $dDate = $d['check_in_date'];
                                $inT = !empty($d['suggested_check_in']) ? "{$dDate} {$d['suggested_check_in']}:00" : "{$dDate} 08:00:00";
                                $outT = !empty($d['suggested_check_out']) ? "{$dDate} {$d['suggested_check_out']}:00" : "{$dDate} 17:00:00";
                                $stmtUpsertCi->execute([(int)$bulk['user_id'], $dDate, $inT, $outT, $d['reason'], $reasonNote ?: 'Duyệt bổ sung công']);
                            }
                        }

                        $db->commit();
                        return [
                            'success' => true,
                            'request_type' => 'bulk_attendance',
                            'request_id' => $reqId,
                            'decision' => $targetStatus,
                            'employee_name' => $bulk['employee_name'],
                            'message' => ($isApproved ? 'Đã phê duyệt' : 'Đã từ chối') . " phiếu giải trình công #{$reqId} của {$bulk['employee_name']}."
                        ];
                    } catch (\Throwable $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        throw $e;
                    }
                }

                if ($reqType === 'check_in') {
                    $stmtC = $db->prepare("
                        SELECT c.*, u.full_name AS employee_name
                        FROM check_ins c
                        JOIN users u ON c.user_id = u.id
                        WHERE c.id = ? AND u.tenant_id = ?
                        LIMIT 1
                    ");
                    $stmtC->execute([$reqId, $tid]);
                    $ci = $stmtC->fetch(PDO::FETCH_ASSOC);
                    if (!$ci) {
                        return ['success' => false, 'message' => "Không tìm thấy bản ghi chấm công #{$reqId}."];
                    }
                    $db->prepare("
                        UPDATE check_ins
                        SET status = ?, approved_by = ?, approved_at = NOW(), admin_note = COALESCE(NULLIF(?, ''), admin_note)
                        WHERE id = ?
                    ")->execute([$targetStatus, $uid, $reasonNote, $reqId]);

                    return [
                        'success' => true,
                        'request_type' => 'check_in',
                        'request_id' => $reqId,
                        'decision' => $targetStatus,
                        'employee_name' => $ci['employee_name'],
                        'message' => ($isApproved ? 'Đã phê duyệt' : 'Đã từ chối') . " chấm công #{$reqId} ngày {$ci['check_in_date']} của {$ci['employee_name']}."
                    ];
                }

                if ($reqType === 'salary_advance') {
                    $db->beginTransaction();
                    try {
                        $stmtA = $db->prepare("
                            SELECT a.*, u.full_name AS employee_name
                            FROM hrm_salary_advances a
                            JOIN users u ON a.user_id = u.id
                            WHERE a.id = ? AND u.tenant_id = ?
                            FOR UPDATE
                        ");
                        $stmtA->execute([$reqId, $tid]);
                        $adv = $stmtA->fetch(PDO::FETCH_ASSOC);
                        if (!$adv) {
                            $db->rollBack();
                            return ['success' => false, 'message' => "Không tìm thấy đơn tạm ứng lương #{$reqId}."];
                        }
                        if ($adv['status'] !== 'pending') {
                            $db->rollBack();
                            return ['success' => false, 'message' => "Đơn tạm ứng lương #{$reqId} đã được xử lý trước đó ({$adv['status']})."];
                        }
                        if ((int)$adv['user_id'] === $uid && !$isGlobalAdmin) {
                            $db->rollBack();
                            return ['success' => false, 'message' => 'Người tạo đơn không được tự phê duyệt đơn tạm ứng lương của chính mình.'];
                        }

                        $db->prepare("
                            UPDATE hrm_salary_advances
                            SET status = ?, status_level_1 = ?, approved_by = ?, approved_at = NOW(), updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ")->execute([$targetStatus, $targetStatus, $uid, $reqId]);
                        $db->commit();

                        return [
                            'success' => true,
                            'request_type' => 'salary_advance',
                            'request_id' => $reqId,
                            'decision' => $targetStatus,
                            'employee_name' => $adv['employee_name'],
                            'amount' => (float)$adv['amount'],
                            'message' => ($isApproved ? 'Đã phê duyệt' : 'Đã từ chối') . " đơn tạm ứng lương #{$reqId} (" . number_format((float)$adv['amount'], 0, ',', '.') . " VNĐ) của {$adv['employee_name']}."
                        ];
                    } catch (\Throwable $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        throw $e;
                    }
                }

                return ['success' => false, 'message' => "Loại phiếu '{$reqType}' không hợp lệ."];
            }

            // ----------------------------------------------------------
            // 6. RECALCULATE LEAVE BALANCE
            // ----------------------------------------------------------
            case 'recalculate_leave_balance': {
                $targetUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                if ($targetUser) {
                    $bal = self::recalculateEmployeeLeaveBalance($db, (int)$targetUser['id']);
                    return [
                        'success' => true,
                        'action' => 'recalculate_leave_balance',
                        'employee_name' => $targetUser['full_name'],
                        'balance' => $bal,
                        'message' => "Đã tính toán và đồng bộ lại quỹ phép năm & nghỉ bù cho {$targetUser['full_name']}."
                    ];
                }

                if (!$canManageHrm) {
                    return ['success' => false, 'message' => 'Vui lòng cung cấp nhân sự cần tính lại quỹ phép.'];
                }

                $stmtAll = $db->prepare("SELECT id, full_name FROM users WHERE tenant_id = ? AND is_active = 1 AND role NOT IN ('bot', 'system', 'superadmin', 'super_admin')");
                $stmtAll->execute([$tid]);
                $staffRows = $stmtAll->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $recalculated = [];
                foreach ($staffRows as $sr) {
                    $recalculated[] = self::recalculateEmployeeLeaveBalance($db, (int)$sr['id']);
                }

                return [
                    'success' => true,
                    'action' => 'recalculate_leave_balance',
                    'recalculated_count' => count($recalculated),
                    'message' => 'Đã đồng bộ lại quỹ phép năm & nghỉ bù cho toàn bộ ' . count($recalculated) . ' nhân sự đang làm việc.'
                ];
            }

            // ----------------------------------------------------------
            // 7. GET ATTENDANCE CONFIRMATIONS
            // ----------------------------------------------------------
            case 'get_attendance_confirmations': {
                if (class_exists('HRMController') && method_exists('HRMController', 'autoConfirmExpiredAttendance')) {
                    \HRMController::autoConfirmExpiredAttendance($db, $tid);
                }

                $where = ["ac.tenant_id = ?"];
                $params = [$tid];

                if (!empty($args['month_year']) && preg_match('/^(\d{4})-(\d{2})$/', trim((string)$args['month_year']), $m)) {
                    $where[] = "b.year = ? AND b.month = ?";
                    array_push($params, (int)$m[1], (int)$m[2]);
                }
                if (!empty($args['status']) && $args['status'] !== 'all') {
                    $where[] = "ac.status = ?";
                    $params[] = trim((string)$args['status']);
                }
                if (!empty($args['department']) && $args['department'] !== 'all') {
                    $where[] = "ac.emp_dept LIKE ?";
                    $params[] = '%' . trim((string)$args['department']) . '%';
                }
                if (!empty($args['employee_id']) || !empty($args['employee_name'])) {
                    $tUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                    if ($tUser) {
                        $where[] = "ac.user_id = ?";
                        $params[] = (int)$tUser['id'];
                    }
                }

                $stmt = $db->prepare("
                    SELECT ac.*, u.gender, b.title AS batch_title, b.month, b.year, b.from_date, b.to_date, b.deadline_at
                    FROM attendance_confirmations ac
                    JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                    LEFT JOIN users u ON ac.user_id = u.id
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY b.id DESC, ac.emp_dept ASC, ac.emp_name ASC
                    LIMIT 100
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                foreach ($rows as &$r) {
                    $q = self::resolveEmployeeLateQuota($db, $r['gender'] ?? null, $r['emp_name'] ?? null);
                    $lateM = (int)($r['late_minutes'] ?? 0);
                    $r['gender'] = $q['gender'];
                    $r['gender_label'] = $q['gender_label'];
                    $r['late_grace_minutes'] = $q['grace_minutes'];
                    $r['excess_late_minutes'] = max(0, $lateM - $q['grace_minutes']);
                    $r['remaining_late_grace_minutes'] = max(0, $q['grace_minutes'] - $lateM);
                }
                unset($r);

                return [
                    'success' => true,
                    'action' => 'get_attendance_confirmations',
                    'count' => count($rows),
                    'records' => $rows
                ];
            }

            // ----------------------------------------------------------
            // 8. RESOLVE ATTENDANCE DISPUTE
            // ----------------------------------------------------------
            case 'resolve_attendance_dispute': {
                if (!$canManageHrm) {
                    return ['success' => false, 'restricted' => true, 'message' => 'Chỉ Phòng Nhân sự (HR) hoặc Ban Giám đốc mới có quyền xử lý khiếu nại bảng công.'];
                }

                $confId = (int)($args['request_id'] ?? 0);
                $where = "ac.tenant_id = ?";
                $params = [$tid];

                if ($confId > 0) {
                    $where .= " AND ac.id = ?";
                    $params[] = $confId;
                } else {
                    $tUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                    if (!$tUser) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp request_id (mã bản ghi đối soát) hoặc thông tin nhân sự cần xử lý khiếu nại.'];
                    }
                    $where .= " AND ac.user_id = ?";
                    $params[] = (int)$tUser['id'];
                }

                $stmt = $db->prepare("
                    SELECT ac.*, b.from_date, b.to_date, b.title AS batch_title
                    FROM attendance_confirmations ac
                    JOIN attendance_confirmation_batches b ON ac.batch_id = b.id
                    WHERE {$where}
                    ORDER BY b.id DESC
                    LIMIT 1
                ");
                $stmt->execute($params);
                $rec = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$rec) {
                    return ['success' => false, 'message' => 'Không tìm thấy bản ghi đối soát công cần xử lý.'];
                }

                if (class_exists('HRMController') && method_exists('HRMController', 'recalculateConfirmationRecord')) {
                    \HRMController::recalculateConfirmationRecord($db, $tid, $rec);
                }

                $resolutionNote = trim((string)($args['reason'] ?? ($args['note'] ?? 'Đã kiểm tra và cập nhật lại số liệu công thực tế.')));
                $newStatus = (isset($args['decision']) && $args['decision'] === 'reject') ? 'pending' : 'confirmed';

                $stmtUpd = $db->prepare("
                    UPDATE attendance_confirmations
                    SET status = ?, dispute_reason = ?, confirmed_at = CASE WHEN ? = 'confirmed' THEN NOW() ELSE NULL END,
                        confirmed_by_type = 'hr', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtUpd->execute([$newStatus, $resolutionNote, $newStatus, (int)$rec['id'], $tid]);

                return [
                    'success' => true,
                    'action' => 'resolve_attendance_dispute',
                    'confirmation_id' => (int)$rec['id'],
                    'employee_name' => $rec['emp_name'],
                    'status' => $newStatus,
                    'recalculated_record' => $rec,
                    'message' => "Đã tính toán lại công và giải quyết khiếu nại công cho {$rec['emp_name']} ({$rec['batch_title']})."
                ];
            }

            // ----------------------------------------------------------
            // 9. UPDATE PAYSLIP ADJUSTMENTS
            // ----------------------------------------------------------
            case 'update_payslip_adjustments': {
                if (!$canViewSalary) {
                    return ['success' => false, 'restricted' => true, 'message' => 'Chỉ Phòng Nhân sự (HR), Kế toán hoặc Ban Giám đốc mới có quyền điều chỉnh phiếu lương.'];
                }

                $targetUser = self::findUserInTenant($db, $tid, (int)($args['employee_id'] ?? 0), (string)($args['employee_name'] ?? ''));
                if (!$targetUser) {
                    return ['success' => false, 'message' => 'Không tìm thấy nhân sự cần điều chỉnh phiếu lương.'];
                }
                $targetUid = (int)$targetUser['id'];
                $monthYear = trim((string)($args['month_year'] ?? date('Y-m')));

                $db->beginTransaction();
                try {
                    $stmtPs = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? AND month_year = ? FOR UPDATE");
                    $stmtPs->execute([$targetUid, $monthYear]);
                    $ps = $stmtPs->fetch(PDO::FETCH_ASSOC);

                    if (!$ps) {
                        $db->rollBack();
                        return ['success' => false, 'message' => "Chưa có phiếu lương kỳ {$monthYear} của {$targetUser['full_name']} để điều chỉnh."];
                    }
                    if ($ps['status'] === 'locked') {
                        $db->rollBack();
                        return ['success' => false, 'message' => "Phiếu lương kỳ {$monthYear} đã khóa sổ (locked), không thể chỉnh sửa."];
                    }

                    $diligenceBonus = array_key_exists('diligence_bonus', $args) && $args['diligence_bonus'] !== null
                        ? (float)$args['diligence_bonus']
                        : (float)($ps['diligence_bonus'] ?? 0.0);
                    $kpiBonus = array_key_exists('kpi_bonus', $args) && $args['kpi_bonus'] !== null
                        ? (float)$args['kpi_bonus']
                        : (float)($ps['kpi_bonus'] ?? 0.0);
                    $otDays = array_key_exists('overtime_days', $args) && $args['overtime_days'] !== null
                        ? (float)$args['overtime_days']
                        : (float)($ps['overtime_days'] ?? 0.0);
                    $otSalary = array_key_exists('overtime_salary', $args) && $args['overtime_salary'] !== null
                        ? (float)$args['overtime_salary']
                        : (float)($ps['overtime_salary'] ?? 0.0);
                    $psStatus = !empty($args['payslip_status']) ? trim((string)$args['payslip_status']) : (string)$ps['status'];
                    $note = array_key_exists('note', $args) && $args['note'] !== null ? trim((string)$args['note']) : ($ps['note'] ?? null);

                    $basicCalc = (float)($ps['salary_basic_calculated'] ?? 0.0);
                    $allowanceTotal = (float)($ps['allowance_total'] ?? 0.0);
                    $insuranceTotal = (float)($ps['insurance_bhxh'] ?? 0.0) + (float)($ps['insurance_bhyt'] ?? 0.0) + (float)($ps['insurance_bhtn'] ?? 0.0);
                    $latenessPenalty = (float)($ps['lateness_penalty'] ?? 0.0);
                    $taxPit = (float)($ps['tax_pit'] ?? 0.0);
                    $advanceDed = (float)($ps['advance_deduction'] ?? 0.0);

                    $netSalary = max(0.0, $basicCalc + $allowanceTotal + $kpiBonus + $otSalary + $diligenceBonus - $insuranceTotal - $latenessPenalty - $taxPit - $advanceDed);

                    $stmtUpd = $db->prepare("
                        UPDATE monthly_payslips
                        SET diligence_bonus = ?, kpi_bonus = ?, overtime_days = ?, overtime_salary = ?,
                            net_salary = ?, status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ?
                    ");
                    $stmtUpd->execute([
                        $diligenceBonus, $kpiBonus, $otDays, $otSalary,
                        $netSalary, $psStatus, $note, (int)$ps['id'], $targetUid
                    ]);

                    $db->commit();

                    return [
                        'success' => true,
                        'action' => 'update_payslip_adjustments',
                        'payslip_id' => (int)$ps['id'],
                        'employee_id' => $targetUid,
                        'employee_name' => $targetUser['full_name'],
                        'month_year' => $monthYear,
                        'diligence_bonus' => $diligenceBonus,
                        'kpi_bonus' => $kpiBonus,
                        'overtime_days' => $otDays,
                        'overtime_salary' => $otSalary,
                        'net_salary' => $netSalary,
                        'net_salary_formatted' => number_format($netSalary, 0, ',', '.') . ' VNĐ',
                        'status' => $psStatus,
                        'message' => "Đã cập nhật phiếu lương kỳ {$monthYear} của {$targetUser['full_name']}. Thực lĩnh mới: " . number_format($netSalary, 0, ',', '.') . ' VNĐ.'
                    ];
                } catch (\Throwable $e) {
                    if ($db->inTransaction()) {
                        $db->rollBack();
                    }
                    throw $e;
                }
            }

            default:
                return ['success' => false, 'message' => "Hành động '{$action}' không được hỗ trợ trong smart_manage_hrm_and_payroll."];
        }
    }

    /**
     * Helper: Find employee in tenant by ID or fuzzy name/email/username
     */
    private static function findUserInTenant(PDO $db, int $tid, int $empId, string $empQuery): ?array
    {
        if ($empId > 0) {
            $stmt = $db->prepare("SELECT id, full_name, email, username, role, department, team_id, gender FROM users WHERE tenant_id = ? AND id = ? LIMIT 1");
            $stmt->execute([$tid, $empId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return $row;
            }
        }

        $q = trim($empQuery);
        if ($q === '') {
            return null;
        }
        if (is_numeric($q)) {
            $stmt = $db->prepare("SELECT id, full_name, email, username, role, department, team_id, gender FROM users WHERE tenant_id = ? AND id = ? LIMIT 1");
            $stmt->execute([$tid, (int)$q]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return $row;
            }
        }

        $like = '%' . $q . '%';
        $stmt = $db->prepare("
            SELECT id, full_name, email, username, role, department, team_id, gender
            FROM users
            WHERE tenant_id = ? AND (full_name LIKE ? OR email LIKE ? OR username LIKE ? OR phone LIKE ?)
            ORDER BY (LOWER(full_name) = LOWER(?)) DESC, is_active DESC, id ASC
            LIMIT 1
        ");
        $stmt->execute([$tid, $like, $like, $like, $like, $q]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Helper: Resolve default approver ID for a user (Team Leader -> HR -> Director)
     */
    private static function resolveDefaultApproverId(PDO $db, int $tid, int $uid): int
    {
        $stmtLeader = $db->prepare("
            SELECT t.leader_id
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.id = ? AND u.tenant_id = ?
            LIMIT 1
        ");
        $stmtLeader->execute([$uid, $tid]);
        $leadId = (int)$stmtLeader->fetchColumn();
        if ($leadId > 0 && $leadId !== $uid) {
            return $leadId;
        }

        $stmtDir = $db->prepare("
            SELECT id FROM users
            WHERE tenant_id = ? AND id != ? AND is_active = 1
              AND LOWER(role) IN ('director', 'superadmin', 'super_admin', 'admin')
            ORDER BY id ASC
            LIMIT 1
        ");
        $stmtDir->execute([$tid, $uid]);
        return (int)($stmtDir->fetchColumn() ?: 0);
    }

    /**
     * Helper: Zero-Trust RBAC check if caller can access target employee
     */
    private static function canAccessEmployee(PDO $db, int $tid, int $callerUid, int $targetUid, bool $canViewAll, bool $isManager): bool
    {
        if ($callerUid === $targetUid || $canViewAll) {
            return true;
        }
        if ($isManager) {
            $stmt = $db->prepare("
                SELECT 1
                FROM users u
                JOIN teams t ON u.team_id = t.id
                WHERE u.id = ? AND u.tenant_id = ?
                  AND (t.leader_id = ? OR FIND_IN_SET(?, COALESCE(t.co_leader_ids, '')) OR u.team_id = (SELECT team_id FROM users WHERE id = ?))
                LIMIT 1
            ");
            $stmt->execute([$targetUid, $tid, $callerUid, $callerUid, $callerUid]);
            return (bool)$stmt->fetchColumn();
        }
        return false;
    }
}
