<?php

class ExportController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function export(array $auth): void {
        $allowedRoles = ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'sales', 'sale', 'sale_admin', 'saleadmin', 'accountant', 'hr', 'cskh', 'academic_officer', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'];
        if (!in_array(strtolower($auth['role'] ?? ''), $allowedRoles, true)) {
            respond(403, null, 'Bạn không có quyền xuất dữ liệu', false);
        }
        
        $type = $_GET['type'] ?? 'contact';
        
        // Allowed types
        if (!in_array($type, ['contact', 'company', 'deal', 'product', 'inventory'])) {
            respond(400, null, 'Loại dữ liệu xuất không hợp lệ', false);
        }

        $segmentForFile = strtolower(trim((string)($_GET['segment'] ?? '')));
        $filenamePrefix = ($type === 'contact' && $segmentForFile === 'customer') ? 'danh_sach_hoc_vien' : ($type === 'contact' ? 'danh_sach_lien_he' : 'export_' . $type);

        // Prepare response headers for CSV download
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $filenamePrefix . '_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // Open output stream
        $output = fopen('php://output', 'w');
        
        // UTF-8 BOM for Excel compatibility
        fputs($output, "\xEF\xBB\xBF");

        // 1. Fetch Custom Fields definition for this type
        $stmtFields = $this->db->prepare("SELECT id, field_key, label, field_type FROM custom_fields WHERE tenant_id = ? AND entity_type = ? ORDER BY order_index ASC");
        $stmtFields->execute([$auth['tenant_id'], $type]);
        $customFields = $stmtFields->fetchAll(PDO::FETCH_ASSOC);

        // Prepare Base Columns
        $baseColumns = [];
        $sql = "";
        $params = [];

        if ($type === 'contact') {
            $exportMode    = strtolower(trim((string)($_GET['export_mode'] ?? ($_GET['mode'] ?? 'filtered'))));
            $segment       = strtolower(trim((string)($_GET['segment'] ?? 'all')));
            $studentSubTab = strtolower(trim((string)($_GET['student_sub_tab'] ?? '')));

            if ($exportMode === 'full') {
                $baseColumns = [
                    'id' => 'ID', 
                    'full_name' => 'Họ và tên', 
                    'phone' => 'Số điện thoại', 
                    'mobile' => 'Di động', 
                    'phone2' => 'Số điện thoại 2', 
                    'email' => 'Email', 
                    'program' => 'Tên chương trình',
                    'admission_date' => 'Ngày nhập học',
                    'closed_date' => 'Ngày chốt',
                    'student_code' => 'Mã học viên',
                    'study_status' => 'Trạng thái học tập',
                    'major' => 'Ngành / Khóa học',
                    'stage_name' => 'Giai đoạn Pipeline',
                    'lead_status' => 'Trạng thái Lead', 
                    'status' => 'Trạng thái hệ thống', 
                    'owner_name' => 'Sale phụ trách', 
                    'collaborator_names' => 'Sale hỗ trợ / Đồng chăm sóc',
                    'source' => 'Nguồn khách hàng', 
                    'round_name' => 'Nguồn phân bổ (Đợt data)',
                    'report_status' => 'Trạng thái Ticket lỗi / Bù',
                    'open_deal_value' => 'Giá trị Deal đang mở',
                    'expected_revenue' => 'Doanh thu kỳ vọng', 
                    'budget' => 'Ngân sách',
                    'win_probability' => 'Xác suất thành công (%)', 
                    'lead_score' => 'Điểm tiềm năng (Score)', 
                    'customer_type' => 'Loại khách hàng', 
                    'temperature' => 'Nhiệt độ (Nóng/Ấm/Lạnh)', 
                    'tags' => 'Phân loại (Tags)',
                    'project_name' => 'Dự án quan tâm', 
                    'campaign_name' => 'Chiến dịch', 
                    'gender' => 'Giới tính', 
                    'birthday' => 'Ngày sinh', 
                    'id_card' => 'CMND/CCCD', 
                    'id_card_date' => 'Ngày cấp', 
                    'id_card_place' => 'Nơi cấp', 
                    'address' => 'Địa chỉ chi tiết', 
                    'ward' => 'Phường/Xã', 
                    'district' => 'Quận/Huyện', 
                    'city' => 'Tỉnh/Thành phố', 
                    'country' => 'Quốc gia', 
                    'company_name' => 'Công ty', 
                    'job_title' => 'Chức danh', 
                    'department' => 'Phòng ban', 
                    'last_interaction' => 'Tương tác gần nhất',
                    'last_contact' => 'Thời gian tương tác cuối',
                    'notes' => 'Ghi chú', 
                    'created_at' => 'Ngày tạo',
                    'updated_at' => 'Cập nhật lần cuối'
                ];
            } elseif ($segment === 'customer') {
                $baseColumns = [
                    'id' => 'ID', 
                    'full_name' => 'Họ và tên', 
                    'phone' => 'Số điện thoại', 
                    'email' => 'Email', 
                    'program' => 'Tên chương trình', 
                    'admission_date' => 'Ngày nhập học', 
                    'closed_date' => 'Ngày chốt', 
                    'student_code' => 'Mã học viên', 
                    'stage_name' => 'Trạng thái / Giai đoạn', 
                    'study_status' => 'Tình trạng học tập', 
                    'owner_name' => 'Sale phụ trách', 
                    'collaborator_names' => 'Sale hỗ trợ', 
                    'source' => 'Nguồn khách hàng', 
                    'round_name' => 'Nguồn phân bổ', 
                    'tags' => 'Phân loại (Tags)', 
                    'open_deal_value' => 'Doanh thu / Giá trị Deal', 
                    'major' => 'Ngành học', 
                    'company_name' => 'Công ty / Đơn vị', 
                    'job_title' => 'Chức danh', 
                    'address' => 'Địa chỉ', 
                    'city' => 'Tỉnh/Thành phố', 
                    'last_interaction' => 'Tương tác gần nhất', 
                    'last_contact' => 'Thời gian tương tác cuối', 
                    'notes' => 'Ghi chú', 
                    'created_at' => 'Ngày tạo'
                ];
            } else {
                $baseColumns = [
                    'id' => 'ID', 
                    'full_name' => 'Họ và tên', 
                    'phone' => 'Số điện thoại', 
                    'mobile' => 'Di động', 
                    'email' => 'Email', 
                    'program' => 'Tên chương trình', 
                    'admission_date' => 'Ngày nhập học', 
                    'stage_name' => 'Giai đoạn Pipeline', 
                    'lead_status' => 'Trạng thái Lead', 
                    'owner_name' => 'Sale phụ trách', 
                    'collaborator_names' => 'Sale hỗ trợ', 
                    'source' => 'Nguồn khách hàng', 
                    'round_name' => 'Nguồn phân bổ (Đợt data)', 
                    'report_status' => 'Trạng thái Ticket lỗi / Bù', 
                    'tags' => 'Phân loại (Tags)', 
                    'closed_date' => 'Ngày chốt', 
                    'student_code' => 'Mã học viên', 
                    'study_status' => 'Trạng thái học tập', 
                    'customer_type' => 'Loại khách hàng', 
                    'temperature' => 'Nhiệt độ (Nóng/Ấm/Lạnh)', 
                    'open_deal_value' => 'Giá trị Deal đang mở', 
                    'project_name' => 'Dự án quan tâm', 
                    'campaign_name' => 'Chiến dịch', 
                    'company_name' => 'Công ty', 
                    'job_title' => 'Chức danh', 
                    'city' => 'Tỉnh/Thành phố', 
                    'last_interaction' => 'Tương tác gần nhất', 
                    'last_contact' => 'Thời gian tương tác cuối', 
                    'notes' => 'Ghi chú', 
                    'created_at' => 'Ngày tạo'
                ];
            }
            
            $search        = $_GET['search'] ?? '';
            $status        = $_GET['status'] ?? '';
            $source        = $_GET['source'] ?? '';
            $owner         = $_GET['owner_id'] ?? '';
            $stage         = $_GET['stage_id'] ?? '';
            $companyId     = $_GET['company_id'] ?? '';
            $projectId     = $_GET['project_id'] ?? '';
            $campaignId    = $_GET['campaign_id'] ?? '';
            $tag           = $_GET['tag'] ?? '';
            $from          = $_GET['from'] ?? '';
            $to            = $_GET['to'] ?? '';
            $dateField     = $_GET['date_field'] ?? 'created_at';
            $segment       = $_GET['segment'] ?? 'all';
            $studentSubTab = $_GET['student_sub_tab'] ?? '';
            $teamId        = $_GET['team_id'] ?? '';
            $dataType      = $_GET['data_type'] ?? '';
            $leadStatus    = trim((string)($_GET['lead_status'] ?? ''));
            $leadStatusOp  = strtolower(trim((string)($_GET['lead_status_op'] ?? 'in')));
            $showLost      = isset($_GET['show_lost']) && in_array(strtolower((string)$_GET['show_lost']), ['1', 'true', 'yes'], true);
            $stageOp       = strtolower(trim((string)($_GET['stage_op'] ?? 'in')));
            $statusOp      = strtolower(trim((string)($_GET['status_op'] ?? 'in')));

            $where  = ['t.tenant_id = ?', 't.deleted_at IS NULL'];
            $params = [$auth['tenant_id']];

            // Role-based visibility: Sale can only see their own contacts / collaborated contacts
            $userRole = strtolower($auth['role'] ?? '');
            if (in_array($userRole, ['sales', 'sale'], true)) {
                $where[] = '(t.owner_id = ? OR FIND_IN_SET(?, t.collaborator_ids))';
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            } else if ($userRole === 'manager') {
                $where[] = '(t.owner_id = ? OR t.owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    )
                ))';
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            }

            if ($search) {
                $where[]  = '(t.full_name LIKE ? OR t.phone LIKE ? OR t.mobile LIKE ? OR t.email LIKE ? OR t.id = ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = is_numeric($search) ? (int)$search : 0;
            }

            // Filter by Lead Status (active, nurture, lost) or default hide lost
            if ($leadStatus !== '') {
                $statuses = array_filter(array_map('trim', explode(',', $leadStatus)));
                if (!empty($statuses)) {
                    $placeholders = implode(',', array_fill(0, count($statuses), '?'));
                    if ($leadStatusOp === 'not_in') {
                        $where[] = "(t.lead_status NOT IN ($placeholders) OR t.lead_status IS NULL)";
                    } else {
                        $where[] = "t.lead_status IN ($placeholders)";
                    }
                    foreach ($statuses as $st) {
                        $params[] = $st;
                    }
                }
            } elseif (!$showLost) {
                $where[] = "(t.lead_status != 'lost' OR t.lead_status IS NULL)";
            }

            if ($status) {
                if ($statusOp === 'not_in') {
                    $where[] = 't.status != ?';
                } else {
                    $where[] = 't.status = ?';
                }
                $params[] = $status;
            }
            if ($source) { $where[] = 't.source = ?'; $params[] = $source; }
            if ($owner)  { $where[] = 't.owner_id = ?'; $params[] = (int)$owner; }
            if ($stage)  {
                if ($stageOp === 'not_in') {
                    $where[] = 't.stage_id != ?';
                } else {
                    $where[] = 't.stage_id = ?';
                }
                $params[] = (int)$stage;
            }
            if ($companyId) { $where[] = 't.company_id = ?'; $params[] = (int)$companyId; }
            if ($projectId !== '') { $where[] = 't.project_id = ?'; $params[] = (int)$projectId; }
            if ($campaignId !== '') { $where[] = 't.campaign_id = ?'; $params[] = (int)$campaignId; }
            if ($tag !== '') { $where[] = 't.tags LIKE ?'; $params[] = '%"' . $tag . '"%'; }
            if ($teamId) {
                $where[] = 't.owner_id IN (SELECT id FROM users WHERE team_id = ?)';
                $params[] = (int)$teamId;
            }
            
            if ($from !== '') {
                $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
                $where[] = "t.{$whereField} >= ?";
                $params[] = $from . ' 00:00:00';
            }
            if ($to !== '') {
                $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
                $where[] = "t.{$whereField} <= ?";
                $params[] = $to . ' 23:59:59';
            }

            switch ($segment) {
                case 'tiem_nang':  $where[] = "t.status != 'customer'"; break;
                case 'hot':        $where[] = 't.lead_score >= 80'; break;
                case 'customer':
                    if ($studentSubTab === 'le_phi' || $studentSubTab === 'nop_ho_so') {
                        // Candidate stages
                    } else {
                        $where[] = "(t.status = 'customer' OR EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND (ps2.system_slug IN ('enrolled', 'hoc_vien') OR ps2.is_won = 1)) OR t.pipeline_status IN ('enrolled', 'hoc_vien'))";
                    }
                    break;
                case 'has_deal':   $where[] = "EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = t.id AND d.deleted_at IS NULL)"; break;
                case 'no_contact': $where[] = "t.last_contact < DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
                case 'not_contacted': $where[] = "NOT EXISTS (SELECT 1 FROM activities WHERE related_type = 'contact' AND related_id = t.id) AND NOT EXISTS (SELECT 1 FROM notes WHERE entity_type = 'contact' AND entity_id = t.id)"; break;
                case 'new_week':   $where[] = "t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
            }

            if ($segment === 'customer' && $studentSubTab !== '') {
                if ($studentSubTab === 'le_phi') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND ps2.system_slug IN ('deposit_tuition_payment', 'dong_le_phi_ho_so'))
                        OR t.pipeline_status IN ('deposit_tuition_payment', 'dong_le_phi_ho_so')
                    )";
                } elseif ($studentSubTab === 'nop_ho_so') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND ps2.system_slug IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))
                        OR t.pipeline_status IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so')
                    )";
                } elseif ($studentSubTab === 'chinh_thuc') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND (ps2.system_slug IN ('enrolled', 'hoc_vien') OR ps2.is_won = 1))
                        OR t.pipeline_status IN ('enrolled', 'hoc_vien')
                        OR t.status = 'customer'
                    )";
                }
            }

            $multiProgram = !empty($_GET['multi_program']) && in_array(strtolower((string)$_GET['multi_program']), ['1', 'true', 'yes', '2'], true);
            if ($multiProgram) {
                $where[] = "(
                    (t.person_id > 0 AND t.person_id IN (SELECT person_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND person_id > 0 GROUP BY person_id HAVING COUNT(*) > 1))
                    OR (t.duplicate_with_id > 0)
                    OR (t.id IN (SELECT duplicate_with_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND duplicate_with_id > 0))
                    OR (t.phone != '' AND t.phone IS NOT NULL AND t.phone IN (SELECT phone FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND phone != '' AND phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1))
                )";
                $params[] = $auth['tenant_id'];
                $params[] = $auth['tenant_id'];
                $params[] = $auth['tenant_id'];
            }

            if ($dataType === 'error_ticket') {
                $where[] = "EXISTS (
                    SELECT 1 FROM distribution_logs dl2 
                    INNER JOIN leads l2 ON dl2.lead_id = l2.id 
                    WHERE l2.person_id = t.person_id AND dl2.status IN ('duplicate', 'error', 'blacklisted')
                )";
            }

            $whereStr = implode(' AND ', $where);

            $sql = "SELECT t.*, 
                           co.name as company_name, 
                           u.full_name as owner_name, 
                           p.name as project_name,
                           COALESCE(ps.name, ps_fb.name) as stage_name,
                           camp.name as campaign_name,
                           CASE 
                               WHEN t.pipeline_status IN ('enrolled', 'hoc_vien') OR t.status = 'customer' THEN
                                   COALESCE(
                                       t.admission_date,
                                       (
                                           SELECT MIN(al.created_at)
                                           FROM audit_logs al
                                           WHERE al.resource = 'contact'
                                             AND al.resource_id = t.id
                                             AND al.action = 'MOVE_STAGE'
                                             AND (al.new_data LIKE '%enrolled%' OR al.new_data LIKE '%hoc_vien%')
                                       ),
                                       (
                                           SELECT MIN(dm.created_at)
                                           FROM deposit_milestones dm
                                           JOIN deposits dep ON dm.deposit_id = dep.id
                                           WHERE dep.contact_id = t.id
                                       ),
                                       t.created_at
                                   )
                               ELSE t.created_at
                           END as closed_date,
                           r.round_name as round_name,
                           COALESCE(dr.status, t.report_status) as report_status,
                           (
                               SELECT COALESCE(SUM(d.value), 0) 
                               FROM deals d 
                               WHERE d.contact_id = t.id AND d.deleted_at IS NULL
                           ) as open_deal_value,
                           COALESCE(
                               (SELECT n.body FROM notes n WHERE n.tenant_id = t.tenant_id AND n.entity_type = 'contact' AND n.entity_id = t.id ORDER BY n.id DESC LIMIT 1),
                               (SELECT COALESCE(a.body, a.subject) FROM activities a WHERE a.tenant_id = t.tenant_id AND a.related_type = 'contact' AND a.related_id = t.id AND a.deleted_at IS NULL ORDER BY a.id DESC LIMIT 1)
                           ) as last_interaction
                    FROM contacts t 
                    LEFT JOIN companies co ON t.company_id = co.id 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    LEFT JOIN projects p ON t.project_id = p.id
                    LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
                    LEFT JOIN pipeline_stages ps_fb ON (t.stage_id IS NULL AND ps_fb.system_slug = t.pipeline_status)
                    LEFT JOIN campaigns camp ON t.campaign_id = camp.id
                    LEFT JOIN leads l ON l.id = COALESCE(
                        (SELECT MAX(id) FROM leads WHERE t.person_id IS NOT NULL AND person_id = t.person_id),
                        (SELECT MAX(id) FROM leads WHERE t.phone IS NOT NULL AND phone = t.phone)
                    )
                    LEFT JOIN distribution_logs dl ON dl.id = (
                        SELECT MAX(id) FROM distribution_logs 
                        WHERE (lead_id = l.id AND assigned_to = t.owner_id) OR contact_id = t.id
                    )
                    LEFT JOIN distribution_rounds r ON dl.round_id = r.id
                    LEFT JOIN data_reports dr ON dr.id = (
                        SELECT MAX(id) FROM data_reports 
                        WHERE (l.id IS NOT NULL AND lead_id = l.id AND consultant_id = t.owner_id)
                    )
                    WHERE $whereStr ORDER BY t.created_at DESC";
        } elseif ($type === 'company') {
            $baseColumns = ['id' => 'ID', 'name' => 'Tên công ty', 'tax_id' => 'Mã số thuế', 'industry' => 'Ngành nghề', 'email' => 'Email', 'phone' => 'Số điện thoại', 'website' => 'Website', 'address' => 'Địa chỉ', 'city' => 'Tỉnh/Thành phố', 'size' => 'Quy mô', 'status' => 'Trạng thái', 'owner_name' => 'Người phụ trách', 'created_at' => 'Ngày tạo'];
            
            $where = ['t.tenant_id = ?', 't.deleted_at IS NULL'];
            $params = [$auth['tenant_id']];
            if (in_array(strtolower($auth['role'] ?? ''), ['sales', 'sale'], true)) {
                $where[] = 't.owner_id = ?';
                $params[] = $auth['user_id'];
            }
            
            $search = $_GET['search'] ?? '';
            $status = $_GET['status'] ?? '';
            if ($search) {
                $where[] = '(t.name LIKE ? OR t.tax_id LIKE ? OR t.phone LIKE ? OR t.email LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            if ($status) {
                $where[] = 't.status = ?';
                $params[] = $status;
            }

            $whereStr = implode(' AND ', $where);
            
            $sql = "SELECT t.*, u.full_name as owner_name 
                    FROM companies t 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    WHERE $whereStr ORDER BY t.created_at DESC";
        } elseif ($type === 'deal') {
            $baseColumns = ['id' => 'ID', 'title' => 'Tên Deal', 'value' => 'Giá trị', 'currency' => 'Tiền tệ', 'probability' => 'Xác suất (%)', 'expected_close_date' => 'Ngày dự kiến đóng', 'priority' => 'Độ ưu tiên', 'contact_name' => 'Người liên hệ', 'company_name' => 'Công ty', 'stage_name' => 'Giai đoạn', 'owner_name' => 'Người phụ trách', 'created_at' => 'Ngày tạo'];
            
            $where = ['t.tenant_id = ?', 't.deleted_at IS NULL'];
            $params = [$auth['tenant_id']];
            if (in_array(strtolower($auth['role'] ?? ''), ['sales', 'sale'], true)) {
                $where[] = 't.owner_id = ?';
                $params[] = $auth['user_id'];
            } else if (strtolower($auth['role'] ?? '') === 'manager') {
                $where[] = '(t.owner_id = ? OR t.owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    )
                ))';
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            }

            $search = $_GET['search'] ?? '';
            $owner = $_GET['owner_id'] ?? '';
            $stage = $_GET['stage_id'] ?? '';
            $from = $_GET['from'] ?? '';
            $to = $_GET['to'] ?? '';

            if ($search) {
                $where[] = 't.title LIKE ?';
                $params[] = "%$search%";
            }
            if ($owner) {
                $where[] = 't.owner_id = ?';
                $params[] = (int)$owner;
            }
            if ($stage) {
                $where[] = 't.stage_id = ?';
                $params[] = (int)$stage;
            }
            if ($from) {
                $where[] = 't.created_at >= ?';
                $params[] = $from . ' 00:00:00';
            }
            if ($to) {
                $where[] = 't.created_at <= ?';
                $params[] = $to . ' 23:59:59';
            }

            $whereStr = implode(' AND ', $where);
            
            $sql = "SELECT t.*, c.full_name as contact_name, co.name as company_name, u.full_name as owner_name, ps.name as stage_name
                    FROM deals t 
                    LEFT JOIN contacts c ON t.contact_id = c.id
                    LEFT JOIN companies co ON t.company_id = co.id 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
                    WHERE $whereStr ORDER BY t.created_at DESC";
        } elseif ($type === 'product') {
            $baseColumns = ['id' => 'ID', 'name' => 'Tên sản phẩm', 'sku' => 'SKU', 'category' => 'Danh mục', 'unit' => 'Đơn vị', 'price' => 'Giá bán', 'cost' => 'Giá vốn', 'description' => 'Mô tả', 'created_at' => 'Ngày tạo'];
            $where = ['t.tenant_id = ?', 't.deleted_at IS NULL'];
            $params = [$auth['tenant_id']];
            
            $search = $_GET['search'] ?? '';
            if ($search) {
                $where[] = '(t.name LIKE ? OR t.sku LIKE ? OR t.description LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }

            $whereStr = implode(' AND ', $where);
            $sql = "SELECT t.* FROM products t WHERE $whereStr ORDER BY t.name ASC";
        } elseif ($type === 'inventory') {
            $baseColumns = ['id' => 'ID', 'product_name' => 'Sản phẩm', 'sku' => 'SKU', 'batch_code' => 'Mã lô', 'import_date' => 'Ngày nhập', 'expiry_date' => 'Hạn sử dụng', 'import_price' => 'Giá nhập', 'initial_qty' => 'Số lượng ban đầu', 'current_qty' => 'Tồn kho hiện tại', 'status' => 'Trạng thái'];
            $where = ['b.tenant_id = ?', "b.status = 'active'"];
            $params = [$auth['tenant_id']];

            $search = $_GET['search'] ?? '';
            $stockStatus = $_GET['stock_status'] ?? '';

            if ($search) {
                $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR b.batch_code LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            if ($stockStatus === 'low_stock') {
                $where[] = 'b.current_qty > 0 AND b.initial_qty > 0 AND (b.current_qty / b.initial_qty) <= 0.10';
            } elseif ($stockStatus === 'out_of_stock') {
                $where[] = 'b.current_qty <= 0';
            } elseif ($stockStatus === 'expiring_soon') {
                $where[] = 'b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND b.current_qty > 0';
            }

            $whereStr = implode(' AND ', $where);
            $sql = "SELECT b.*, p.name as product_name, p.sku 
                    FROM batches b 
                    JOIN products p ON b.product_id = p.id 
                    WHERE $whereStr ORDER BY b.import_date DESC";
        }

        // Generate Header Row
        $headerRow = array_values($baseColumns);
        foreach ($customFields as $cf) {
            $headerRow[] = $cf['label'];
        }
        fputcsv($output, $headerRow);

        // Fetch Main Data in batches to prevent memory exhaustion
        $batchSize = 1000;
        $offset = 0;
        $totalExported = 0;

        $statusLabels = [
            'lead' => 'Lead mới',
            'qualified' => 'Đủ điều kiện',
            'customer' => 'Học viên',
            'churned' => 'Đã rời',
            'active' => 'Hoạt động',
            'inactive' => 'Ngừng',
            'prospect' => 'Tiềm năng'
        ];

        $userMap = [];
        if ($type === 'contact') {
            $userStmt = $this->db->prepare("SELECT id, full_name FROM users WHERE tenant_id = ?");
            $userStmt->execute([$auth['tenant_id']]);
            $userMap = $userStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
        }

        while (true) {
            $batchSql = $sql . " LIMIT $batchSize OFFSET $offset";
            $stmt = $this->db->prepare($batchSql);
            $stmt->execute($params);
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($records)) {
                break;
            }

            // Fetch Custom Field Values for this batch of records efficiently
            $entityIds = array_column($records, 'id');
            $groupedCfValues = [];
            
            if (!empty($entityIds)) {
                $placeholders = implode(',', array_fill(0, count($entityIds), '?'));
                
                $cfvSql = "SELECT cf.field_key, cfv.entity_id, cfv.value_text, cfv.value_number, cfv.value_date, cfv.value_json, cf.field_type
                           FROM custom_field_values cfv
                           JOIN custom_fields cf ON cfv.custom_field_id = cf.id
                           WHERE cf.tenant_id = ? AND cf.entity_type = ? AND cfv.entity_id IN ($placeholders)";
                
                $cfvParams = array_merge([$auth['tenant_id'], $type], $entityIds);
                $stmtCfv = $this->db->prepare($cfvSql);
                $stmtCfv->execute($cfvParams);
                $cfValues = $stmtCfv->fetchAll(PDO::FETCH_ASSOC);
                
                // Group CF values by entity_id
                foreach ($cfValues as $val) {
                    $eId = $val['entity_id'];
                    $key = $val['field_key'];
                    if (!isset($groupedCfValues[$eId])) {
                        $groupedCfValues[$eId] = [];
                    }
                    
                    // Format value based on type
                    $displayValue = '';
                    if ($val['field_type'] === 'number' && $val['value_number'] !== null) {
                        $displayValue = $val['value_number'] + 0; // removes trailing zeros
                    } elseif ($val['field_type'] === 'date' && $val['value_date'] !== null) {
                        $displayValue = $val['value_date'];
                    } elseif ($val['field_type'] === 'multiselect' || $val['field_type'] === 'checkbox') {
                        $arr = json_decode($val['value_json'] ?? '[]', true);
                        if (is_array($arr)) {
                            // Check if it's boolean true for single checkbox
                            if ($val['field_type'] === 'checkbox' && (is_bool($arr) || is_bool(json_decode($val['value_text']??'false')))) {
                                $displayValue = (json_decode($val['value_text']??'false') || $arr === true) ? 'Có' : 'Không';
                            } else {
                                $displayValue = implode(', ', $arr);
                            }
                        } else {
                            $displayValue = $val['value_text'] ?? '';
                        }
                    } else {
                        $displayValue = $val['value_text'] ?? '';
                    }
                    
                    $groupedCfValues[$eId][$key] = $displayValue;
                }
            }

            // Write Rows to Output Stream
            foreach ($records as $record) {
                if ($type === 'contact') {
                    // 1. Program resolution
                    $prog = trim((string)($record['program'] ?? ''));
                    if ($prog === '' && !empty($record['tags'])) {
                        $rawTags = is_array($record['tags']) ? $record['tags'] : (json_decode($record['tags'], true) ?: explode(',', (string)$record['tags']));
                        if (is_array($rawTags)) {
                            foreach ($rawTags as $t) {
                                $lt = mb_strtolower((string)$t);
                                if (strpos($lt, 'mba') !== false || strpos($lt, 'bba') !== false || strpos($lt, 'dba') !== false || strpos($lt, 'msc') !== false || strpos($lt, 'umef') !== false || strpos($lt, 'emba') !== false) {
                                    $prog = preg_replace('/^\d+\.\s*(status\s*-\s*)?/i', '', (string)$t);
                                    $prog = trim($prog);
                                    break;
                                }
                            }
                        }
                    }
                    if ($prog === '' && !empty($record['major'])) {
                        $prog = trim((string)$record['major']);
                    }
                    if ($prog === '' && !empty($record['project_name'])) {
                        $prog = trim((string)$record['project_name']);
                    }
                    $record['program'] = $prog;

                    // 2. Admission Date
                    if (!empty($record['admission_date'])) {
                        $ts = strtotime($record['admission_date']);
                        if ($ts) $record['admission_date'] = date('d/m/Y', $ts);
                    }

                    // 3. Closed Date
                    if (!empty($record['closed_date'])) {
                        $ts = strtotime($record['closed_date']);
                        if ($ts) $record['closed_date'] = date('Y-m-d H:i:s', $ts);
                    }

                    // 4. Student Code / ID
                    $record['student_code'] = !empty($record['student_code']) ? $record['student_code'] : ($record['student_id'] ?? '');

                    // 5. Phone 2 / Mobile
                    $record['phone2'] = !empty($record['phone2']) ? $record['phone2'] : ($record['mobile'] ?? '');

                    // 6. ID Card / CCCD
                    $record['id_card'] = !empty($record['id_card']) ? $record['id_card'] : (!empty($record['citizen_id']) ? $record['citizen_id'] : ($record['passport'] ?? ''));

                    // 7. Birthday
                    $bday = !empty($record['birthday']) ? $record['birthday'] : ($record['dob'] ?? '');
                    if (!empty($bday)) {
                        $ts = strtotime($bday);
                        $record['birthday'] = $ts ? date('d/m/Y', $ts) : $bday;
                    } else {
                        $record['birthday'] = '';
                    }

                    // 8. Company name fallback
                    if (empty($record['company_name']) && !empty($record['company'])) {
                        $record['company_name'] = $record['company'];
                    }

                    // 9. Collaborator names
                    $collabNames = [];
                    if (!empty($record['collaborator_ids'])) {
                        $cIds = explode(',', (string)$record['collaborator_ids']);
                        foreach ($cIds as $cid) {
                            $cid = trim($cid);
                            if (isset($userMap[$cid])) {
                                $collabNames[] = $userMap[$cid];
                            }
                        }
                    }
                    $record['collaborator_names'] = implode(', ', $collabNames);

                    // 10. Last interaction text clean
                    if (!empty($record['last_interaction'])) {
                        $cleanText = preg_replace('/\s*\n?\(?Giai đoạn:.*$/si', '', $record['last_interaction']);
                        $cleanText = preg_replace('/\s*\|\s*Lý do lost:.*$/si', '', $cleanText);
                        $cleanText = preg_replace('/\s*\|\s*Độ nóng:.*$/si', '', $cleanText);
                        $cleanText = strip_tags($cleanText);
                        $record['last_interaction'] = trim(preg_replace('/\s+/', ' ', $cleanText));
                    }

                    // 11. Last contact date
                    if (!empty($record['last_contact'])) {
                        $ts = strtotime($record['last_contact']);
                        if ($ts) $record['last_contact'] = date('d/m/Y H:i', $ts);
                    }

                    // 12. Friendly labels for lead_status
                    $leadStatusMap = [
                        'active' => 'Đang chăm sóc',
                        'nurture' => 'Nuôi dưỡng (Nurture)',
                        'lost' => 'Thất bại (Lost)'
                    ];
                    if (!empty($record['lead_status']) && isset($leadStatusMap[$record['lead_status']])) {
                        $record['lead_status'] = $leadStatusMap[$record['lead_status']];
                    }

                    // 13. Friendly source
                    $sourceMap = [
                        'facebook' => 'Facebook Ads',
                        'fb' => 'Facebook Ads',
                        'zalo' => 'Zalo',
                        'website' => 'Website',
                        'hotline' => 'Hotline',
                        'gioi_thieu' => 'Giới thiệu',
                        'ref' => 'Giới thiệu',
                        'referral' => 'Giới thiệu',
                        'ca_nhan' => 'Cá nhân tự khai thác',
                        'databank' => 'Data Bank',
                        'event' => 'Sự kiện / Hội thảo',
                        'direct' => 'Trực tiếp',
                        'other' => 'Khác'
                    ];
                    if (!empty($record['source']) && isset($sourceMap[$record['source']])) {
                        $record['source'] = $sourceMap[$record['source']];
                    }

                    // 14. Friendly report_status
                    $reportStatusMap = [
                        'pending' => 'Chờ duyệt bù',
                        'approved' => 'Đã duyệt bù',
                        'approved_no_comp' => 'Lỗi không bù',
                        'rejected' => 'Từ chối bù'
                    ];
                    if (!empty($record['report_status']) && isset($reportStatusMap[$record['report_status']])) {
                        $record['report_status'] = $reportStatusMap[$record['report_status']];
                    }

                    // 15. Friendly gender
                    if (!empty($record['gender'])) {
                        $g = mb_strtolower(trim($record['gender']));
                        if ($g === 'male' || $g === 'nam') $record['gender'] = 'Nam';
                        elseif ($g === 'female' || $g === 'nu' || $g === 'nữ') $record['gender'] = 'Nữ';
                        elseif ($g === 'other' || $g === 'khac' || $g === 'khác') $record['gender'] = 'Khác';
                    }

                    // 16. Friendly study_status
                    $studyStatusMap = [
                        'studying' => 'Đang học',
                        'graduated' => 'Đã tốt nghiệp',
                        'deferred' => 'Bảo lưu',
                        'dropped' => 'Thôi học',
                        'enrolled' => 'Mới nhập học'
                    ];
                    if (!empty($record['study_status']) && isset($studyStatusMap[$record['study_status']])) {
                        $record['study_status'] = $studyStatusMap[$record['study_status']];
                    }

                    // 17. Formatted deal / revenue numbers
                    if (isset($record['open_deal_value']) && is_numeric($record['open_deal_value'])) {
                        $val = (float)$record['open_deal_value'];
                        $record['open_deal_value'] = $val > 0 ? number_format($val, 0, ',', '.') . ' đ' : '0 đ';
                    }
                    if (isset($record['expected_revenue']) && is_numeric($record['expected_revenue'])) {
                        $val = (float)$record['expected_revenue'];
                        $record['expected_revenue'] = $val > 0 ? number_format($val, 0, ',', '.') . ' đ' : '';
                    }
                    if (isset($record['budget']) && is_numeric($record['budget'])) {
                        $val = (float)$record['budget'];
                        $record['budget'] = $val > 0 ? number_format($val, 0, ',', '.') . ' đ' : '';
                    }

                    // 18. Stage name fallback
                    if (empty($record['stage_name']) && !empty($record['pipeline_status'])) {
                        $record['stage_name'] = $record['pipeline_status'];
                    }
                }

                $row = [];
                // Map base columns
                foreach (array_keys($baseColumns) as $colKey) {
                    $val = $record[$colKey] ?? '';
                    if ($colKey === 'tags' && !empty($val)) {
                        $decodedTags = is_array($val) ? $val : json_decode($val, true);
                        if (is_array($decodedTags)) {
                            $val = implode(', ', $decodedTags);
                        }
                    } elseif ($colKey === 'status' && isset($statusLabels[$val])) {
                        $val = $statusLabels[$val];
                    }
                    $row[] = $val;
                }
                
                // Map custom fields
                $eId = $record['id'];
                foreach ($customFields as $cf) {
                    $key = $cf['field_key'];
                    $row[] = $groupedCfValues[$eId][$key] ?? '';
                }
                
                fputcsv($output, $row);
            }

            $totalExported += count($records);
            $offset += $batchSize;

            // Clear batch memory
            unset($records, $entityIds, $groupedCfValues, $cfValues);
        }

        fclose($output);
        
        // Log action if logActivity function exists
        if (function_exists('logActivity')) {
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], "Export Data ($type)", $type, null, "Exported " . $totalExported . " records");
        }
        
        exit;
    }
}
