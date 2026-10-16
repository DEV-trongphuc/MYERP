<?php

class ExportController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function export(array $auth): void {
        require_once __DIR__ . '/AgentToolRegistry.php';
        $leadRbacTop = AgentToolRegistry::evaluateLeadReadScope($this->db, $auth);
        $allowedRoles = ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'general_director', 'sale_director', 'executive', 'ceo', 'leader', 'team_lead', 'truong_phong', 'sales', 'sale', 'consultant', 'tu_van', 'kinh_doanh', 'sale_admin', 'saleadmin', 'marketing', 'mkt', 'assistant', 'tro_ly', 'accountant', 'ke_toan', 'hr', 'nhan_su', 'cskh', 'academic_officer', 'academic', 'hoc_vu', 'hoc_thuat', 'tro_giang', 'teacher', 'giang_vien', 'viewer'];
        if (!$leadRbacTop['can_view_all_leads'] && !$leadRbacTop['can_view_team_leads'] && !in_array(strtolower($auth['role'] ?? ''), $allowedRoles, true)) {
            respond(403, null, 'Bạn không có quyền xuất dữ liệu', false);
        }
        
        // Boost resources for massive dataset streaming
        @set_time_limit(300);
        @ini_set('memory_limit', '512M');

        $rawType = strtolower(trim((string)($_GET['type'] ?? 'contact')));

        // Normalize type synonyms to prevent false 400 Bad Request
        if (in_array($rawType, ['contact', 'contacts', 'lead', 'leads', 'crm', 'crm_leads', 'student', 'students', 'hoc_vien', 'khach_hang', 'export_data', 'export'], true)) {
            $type = 'contact';
        } elseif (in_array($rawType, ['company', 'companies', 'doanh_nghiep'], true)) {
            $type = 'company';
        } elseif (in_array($rawType, ['deal', 'deals', 'co_hoi', 'b2b'], true)) {
            $type = 'deal';
        } elseif (in_array($rawType, ['product', 'products', 'san_pham'], true)) {
            $type = 'product';
        } elseif (in_array($rawType, ['inventory', 'inventories', 'kho', 'vat_tu'], true)) {
            $type = 'inventory';
        } elseif (in_array($rawType, ['asset', 'assets', 'tai_san'], true)) {
            $type = 'asset';
        } elseif (in_array($rawType, ['attendance', 'attendances', 'bang_cong', 'cham_cong'], true)) {
            $type = 'attendance';
        } elseif (in_array($rawType, ['expense', 'expenses', 'chi_phi', 'phieu_chi'], true)) {
            $type = 'expense';
        } elseif (in_array($rawType, ['purchase_order', 'purchase_orders', 'po', 'don_mua_hang'], true)) {
            $type = 'purchase_order';
        } elseif (in_array($rawType, ['deposit', 'deposits', 'phieu_thu', 'dat_coc', 'doanh_thu'], true)) {
            $type = 'deposit';
        } elseif (in_array($rawType, ['sales_order', 'sales_orders', 'so', 'don_dat_hang', 'don_hang_ban'], true)) {
            $type = 'sales_order';
        } elseif (in_array($rawType, ['invoice', 'invoices', 'hoa_don'], true)) {
            $type = 'invoice';
        } elseif (in_array($rawType, ['quote', 'quotes', 'bao_gia'], true)) {
            $type = 'quote';
        } elseif (in_array($rawType, ['supplier', 'suppliers', 'nha_cung_cap', 'vendor', 'vendors'], true)) {
            $type = 'supplier';
        } elseif (in_array($rawType, ['salary_advance', 'salary_advances', 'advance', 'tam_ung', 'tam_ung_luong'], true)) {
            $type = 'salary_advance';
        } elseif (in_array($rawType, ['task', 'tasks', 'cong_viec', 'nhiem_vu'], true)) {
            $type = 'task';
        } elseif (in_array($rawType, ['ticket', 'tickets', 'sla', 'yeu_cau', 'ho_tro'], true)) {
            $type = 'ticket';
        } elseif (in_array($rawType, ['staff', 'employee', 'employees', 'hrm', 'nhan_su', 'payroll', 'bang_luong'], true)) {
            $type = 'staff';
        } else {
            $type = $rawType;
        }
        
        // Attendance export handler
        if ($type === 'attendance') {
            $this->exportAttendance($auth);
            return;
        }

        // Expense export handler
        if ($type === 'expense') {
            $this->exportExpenses($auth);
            return;
        }

        // Purchase Order (PO) export handler
        if ($type === 'purchase_order') {
            $this->exportPurchaseOrders($auth);
            return;
        }

        // Deposit export handler
        if ($type === 'deposit') {
            $this->exportDeposits($auth);
            return;
        }

        // Sales Order (SO) export handler
        if ($type === 'sales_order') {
            $this->exportSalesOrders($auth);
            return;
        }

        // Invoice export handler
        if ($type === 'invoice') {
            $this->exportInvoices($auth);
            return;
        }

        // Quote export handler
        if ($type === 'quote') {
            $this->exportQuotes($auth);
            return;
        }

        // Supplier export handler
        if ($type === 'supplier') {
            $this->exportSuppliers($auth);
            return;
        }

        // HRM Salary Advance export handler
        if ($type === 'salary_advance') {
            $this->exportSalaryAdvances($auth);
            return;
        }

        // Task export handler
        if ($type === 'task') {
            $this->exportTasks($auth);
            return;
        }

        // Ticket & SLA export handler
        if ($type === 'ticket') {
            $this->exportTickets($auth);
            return;
        }

        // HRM Staff & Payroll export handler
        if ($type === 'staff') {
            $this->exportStaff($auth);
            return;
        }

        // HRM Assets export handler
        if ($type === 'asset') {
            $this->exportAssets($auth);
            return;
        }

        // Allowed types
        if (!in_array($type, ['contact', 'company', 'deal', 'product', 'inventory'])) {
            respond(400, null, "Loại dữ liệu xuất '$rawType' không hợp lệ", false);
        }

        // Clean any residual output buffers so streaming starts immediately with zero delay
        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        $segmentForFile = strtolower(trim((string)($_GET['segment'] ?? $_GET['record_type'] ?? '')));
        $filenamePrefix = ($type === 'contact' && in_array($segmentForFile, ['customer', 'student', 'students_only', 'hoc_vien'], true)) ? 'danh_sach_hoc_vien' : ($type === 'contact' ? 'danh_sach_lien_he' : 'export_' . $type);

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
            $recordType    = strtolower(trim((string)($_GET['record_type'] ?? '')));
            if ($segment === 'all' && $recordType !== '') {
                if (in_array($recordType, ['students_only', 'customer', 'student', 'hoc_vien'], true)) $segment = 'customer';
                elseif (in_array($recordType, ['leads_only', 'lead', 'tiem_nang'], true)) $segment = 'tiem_nang';
            }
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
                    'job_title' => 'Chức vụ / Chức danh', 
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
                    'job_title' => 'Chức vụ / Chức danh', 
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
                    'job_title' => 'Chức vụ / Chức danh', 
                    'city' => 'Tỉnh/Thành phố', 
                    'last_interaction' => 'Tương tác gần nhất', 
                    'last_contact' => 'Thời gian tương tác cuối', 
                    'notes' => 'Ghi chú', 
                    'created_at' => 'Ngày tạo'
                ];
            }
            
            $search        = trim((string)($_GET['search'] ?? ($_GET['search_query'] ?? '')));
            $status        = $_GET['status'] ?? '';
            $uncontacted   = !empty($_GET['uncontacted']) && in_array(strtolower((string)$_GET['uncontacted']), ['1', 'true', 'yes'], true);
            if ($status === 'not_contacted') {
                $uncontacted = true;
                $status = '';
            }
            $source        = trim((string)($_GET['source'] ?? $_GET['sources'] ?? ''));
            $owner         = $_GET['owner_id'] ?? '';
            $ownersParam   = trim((string)($_GET['owners'] ?? ''));
            $assignedToRaw = trim((string)($_GET['assigned_to'] ?? ''));
            if ($assignedToRaw !== '' && $assignedToRaw !== 'all') {
                if (is_numeric($assignedToRaw) && $owner === '') {
                    $owner = $assignedToRaw;
                } elseif ($ownersParam === '') {
                    $ownersParam = $assignedToRaw;
                }
            }
            $stage         = $_GET['stage_id'] ?? '';
            $companyId     = $_GET['company_id'] ?? '';
            $projectId     = $_GET['project_id'] ?? '';
            $campaignId    = $_GET['campaign_id'] ?? '';
            $tag           = trim((string)($_GET['tag'] ?? $_GET['tags'] ?? ''));
            $from          = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
            $to            = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
            $period        = strtolower(trim((string)($_GET['period'] ?? '')));
            if ($from === '' && $to === '' && $period !== '') {
                if ($period === 'today') {
                    $from = date('Y-m-d');
                    $to   = date('Y-m-d');
                } elseif ($period === 'yesterday') {
                    $from = date('Y-m-d', strtotime('-1 day'));
                    $to   = date('Y-m-d', strtotime('-1 day'));
                } elseif ($period === 'this_week') {
                    $from = date('Y-m-d', strtotime('monday this week'));
                    $to   = date('Y-m-d');
                } elseif ($period === 'this_month') {
                    $from = date('Y-m-01');
                    $to   = date('Y-m-t');
                } elseif ($period === 'this_year') {
                    $from = date('Y-01-01');
                    $to   = date('Y-12-31');
                }
            }
            $dateField     = strtolower(trim((string)($_GET['date_field'] ?? 'created_at')));
            $studentSubTab = $_GET['student_sub_tab'] ?? '';
            $teamId        = $_GET['team_id'] ?? '';
            $dataType      = $_GET['data_type'] ?? '';
            $leadStatus    = trim((string)($_GET['lead_status'] ?? ''));
            $leadStatusOp  = strtolower(trim((string)($_GET['lead_status_op'] ?? 'in')));
            $showLost      = isset($_GET['show_lost']) && in_array(strtolower((string)$_GET['show_lost']), ['1', 'true', 'yes'], true);
            $stageOp       = strtolower(trim((string)($_GET['stage_op'] ?? 'in')));
            $statusOp      = strtolower(trim((string)($_GET['status_op'] ?? 'in')));
            $programParam  = trim((string)($_GET['program'] ?? $_GET['programs'] ?? ''));
            $cityParam     = trim((string)($_GET['city'] ?? $_GET['branches_or_cities'] ?? ''));

            $where  = ['t.tenant_id = ?', 't.deleted_at IS NULL'];
            $isUnassignedQuery = !empty($_GET['unassigned'])
                || $status === 'unassigned'
                || in_array(mb_strtolower($ownersParam, 'UTF-8'), ['unassigned', 'none', 'null', '0', 'chua_phan_bo', 'chưa phân bổ', 'chua phan bo', 'chưa gán', 'chua gan'], true);
            if (!$isUnassignedQuery && $exportMode !== 'full') {
                $where[] = 't.owner_id IS NOT NULL';
            }
            $params = [$auth['tenant_id']];

            // Zero-Trust RBAC synced 100% with ContactController::getScope & AgentToolRegistry::evaluateLeadReadScope
            $leadRbac = AgentToolRegistry::evaluateLeadReadScope($this->db, $auth);
            if (!$leadRbac['can_view_all_leads']) {
                if ($leadRbac['can_view_team_leads']) {
                    $teamIdExp = (int)($leadRbac['team_id'] ?? 0);
                    $where[] = '(t.owner_id = ? OR FIND_IN_SET(?, IFNULL(t.collaborator_ids, \'\')) OR t.owner_id IN (
                        SELECT id FROM users WHERE team_id IN (
                            SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                        ) OR (? > 0 AND team_id = ?)
                    ))';
                    $params[] = $auth['user_id'];
                    $params[] = (string)$auth['user_id'];
                    $params[] = $auth['user_id'];
                    $params[] = $teamIdExp;
                    $params[] = $teamIdExp;
                } else {
                    $where[] = '(t.owner_id = ? OR FIND_IN_SET(?, IFNULL(t.collaborator_ids, \'\')))';
                    $params[] = $auth['user_id'];
                    $params[] = (string)$auth['user_id'];
                }
            }

            if ($search !== '') {
                if ($exportMode === 'full') {
                    $fuzzySearchName = AgentToolRegistry::buildVietnameseFuzzyNameWhere('t.full_name', $search, $params);
                    $likeQ = '%' . $search . '%';
                    $where[] = "({$fuzzySearchName} OR t.phone LIKE ? OR t.email LIKE ? OR t.company LIKE ? OR t.job_title LIKE ? OR t.notes LIKE ?)";
                    array_push($params, $likeQ, $likeQ, $likeQ, $likeQ, $likeQ);
                } else {
                    require_once __DIR__ . '/../utils/search_helpers.php';
                    $searchRes = buildContactSearchClause($search, 't.');
                    if (!empty($searchRes['clause'])) {
                        $where[] = $searchRes['clause'];
                        foreach ($searchRes['params'] as $sp) {
                            $params[] = $sp;
                        }
                    }
                }
            }

            // Filter by Lead Status (active, nurture, lost, active_only) or default hide lost & nurture when exporting filtered UI view
            if ($leadStatus !== '' && $leadStatus !== 'all') {
                if (strtolower($leadStatus) === 'active_only') {
                    $where[] = "(t.lead_status NOT IN ('lost', 'nurture') OR t.lead_status IS NULL)";
                } else {
                    $statuses = array_filter(array_map('trim', explode(',', $leadStatus)));
                    if (!empty($statuses)) {
                        if (count($statuses) === 1 && in_array('active', $statuses, true)) {
                            if ($leadStatusOp === 'not_in') {
                                $where[] = "(t.lead_status IN ('lost', 'nurture'))";
                            } else {
                                $where[] = "(t.lead_status = 'active' OR t.lead_status IS NULL OR t.lead_status = '')";
                            }
                        } else {
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
                    }
                }
            } elseif (!$showLost && empty($search) && $exportMode !== 'full') {
                $where[] = "(t.lead_status NOT IN ('lost', 'nurture') OR t.lead_status IS NULL)";
            }

            if ($status) {
                if ($statusOp === 'not_in') {
                    $where[] = '(t.status IS NULL OR t.status != ?)';
                } else {
                    $where[] = 't.status = ?';
                }
                $params[] = $status;
            }
            if ($source !== '' && $source !== 'all') {
                $srcList = array_filter(array_map('trim', explode(',', $source)));
                if (!empty($srcList)) {
                    $srcOrs = [];
                    foreach ($srcList as $sItem) {
                        $srcOrs[] = "(t.source LIKE ? OR t.utm_source LIKE ? OR t.platform LIKE ?)";
                        $params[] = '%' . $sItem . '%';
                        $params[] = '%' . $sItem . '%';
                        $params[] = '%' . $sItem . '%';
                    }
                    $where[] = "(" . implode(' OR ', $srcOrs) . ")";
                }
            }
            if ($owner !== '') {
                $where[] = '(t.owner_id = ? OR FIND_IN_SET(?, IFNULL(t.collaborator_ids, \'\')))';
                $params[] = (int)$owner;
                $params[] = (string)(int)$owner;
            } elseif ($ownersParam !== '' && $ownersParam !== 'all') {
                $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
                $ownOrs = [];
                foreach ($ownList as $own) {
                    $ownLow = mb_strtolower($own, 'UTF-8');
                    if (in_array($ownLow, ['unassigned', 'none', 'null', '0', 'chua_phan_bo', 'chưa phân bổ', 'chua phan bo', 'chưa gán', 'chua gan'], true)) {
                        $ownOrs[] = "(t.owner_id IS NULL OR t.owner_id = 0)";
                    } elseif (is_numeric($own)) {
                        $ownOrs[] = "(t.owner_id = ? OR FIND_IN_SET(?, IFNULL(t.collaborator_ids, '')))";
                        $params[] = (int)$own;
                        $params[] = (string)(int)$own;
                    } else {
                        $ownFuzzyWhere = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u_own.full_name', $own, $params);
                        $ownOrs[] = "EXISTS (SELECT 1 FROM users u_own WHERE (u_own.id = t.owner_id OR FIND_IN_SET(u_own.id, IFNULL(t.collaborator_ids, ''))) AND ({$ownFuzzyWhere} OR u_own.email LIKE ?))";
                        $params[] = '%' . $own . '%';
                    }
                }
                if (!empty($ownOrs)) {
                    $where[] = "(" . implode(' OR ', $ownOrs) . ")";
                }
            }

            // Program / Project multi-filter (100% synced with AgentToolRegistry)
            if ($programParam !== '' && $programParam !== 'all') {
                $progList = array_filter(array_map('trim', explode(',', $programParam)));
                if (!empty($progList)) {
                    $progOrs = [];
                    foreach ($progList as $pItem) {
                        $progOrs[] = "(t.program LIKE ? OR EXISTS (SELECT 1 FROM projects prj_f WHERE prj_f.id = t.project_id AND (prj_f.name LIKE ? OR prj_f.code LIKE ?)))";
                        $params[] = '%' . $pItem . '%';
                        $params[] = '%' . $pItem . '%';
                        $params[] = '%' . $pItem . '%';
                    }
                    $where[] = "(" . implode(' OR ', $progOrs) . ")";
                }
            }

            // City / District / Ward / Address & Team Branch multi-filter (100% synced with AgentToolRegistry)
            if ($cityParam !== '' && $cityParam !== 'all') {
                $cityList = array_filter(array_map('trim', explode(',', $cityParam)));
                if (!empty($cityList)) {
                    $cityOrs = [];
                    foreach ($cityList as $cItem) {
                        $cityOrs[] = "(t.city LIKE ? OR t.district LIKE ? OR t.ward LIKE ? OR t.address LIKE ? OR EXISTS (SELECT 1 FROM users u_br JOIN teams tm_br ON u_br.team_id = tm_br.id WHERE u_br.id = t.owner_id AND (tm_br.branch LIKE ? OR tm_br.name LIKE ?)))";
                        $likeCity = '%' . $cItem . '%';
                        array_push($params, $likeCity, $likeCity, $likeCity, $likeCity, $likeCity, $likeCity);
                    }
                    $where[] = "(" . implode(' OR ', $cityOrs) . ")";
                }
            }
            
            $stageSlug = !empty($_GET['stage_slug']) ? trim($_GET['stage_slug']) : '';
            if ($stage)  {
                $isNum = is_numeric($stage);
                if ($stageOp === 'not_in') {
                    if ($isNum) {
                        $where[] = "(t.stage_id != ? AND (t.pipeline_status IS NULL OR t.pipeline_status != ?))";
                        $params[] = (int)$stage;
                        $params[] = $stageSlug ?: (string)$stage;
                    } else {
                        $where[] = "(t.pipeline_status != ? AND (t.stage_id IS NULL OR t.stage_id != (SELECT ps.id FROM pipeline_stages ps WHERE ps.system_slug = ? LIMIT 1)))";
                        $params[] = $stage;
                        $params[] = $stage;
                    }
                } else {
                    if ($isNum) {
                        $clause = "(
                            t.stage_id = ? 
                            OR (t.stage_id IS NULL AND t.pipeline_status = ?)
                            OR (t.stage_id IS NULL AND t.pipeline_status = (SELECT ps.system_slug FROM pipeline_stages ps WHERE ps.id = ? LIMIT 1))";
                        $params[] = (int)$stage;
                        $params[] = $stageSlug ?: (string)$stage;
                        $params[] = (int)$stage;
                        if (!empty($stageSlug)) {
                            $clause .= " OR t.pipeline_status = ? OR t.stage_id = (SELECT ps2.id FROM pipeline_stages ps2 WHERE ps2.system_slug = ? LIMIT 1)";
                            $params[] = $stageSlug;
                            $params[] = $stageSlug;
                        }
                        $clause .= ")";
                        $where[] = $clause;
                    } else {
                        $where[] = "(t.pipeline_status = ? OR t.stage_id = (SELECT ps.id FROM pipeline_stages ps WHERE ps.system_slug = ? LIMIT 1))";
                        $params[] = $stage;
                        $params[] = $stage;
                    }
                }
            }

            // Multi-stage filtering (supports stage_op: in, not_in, gte, lte, gt, lt, and stage_name fallback)
            $stagesParam = trim((string)($_GET['stages'] ?? $_GET['stage_ids'] ?? $_GET['stage_name'] ?? ''));
            if (!empty($stagesParam) && $stagesParam !== 'all') {
                $rawParts = explode(',', $stagesParam);
                $stageIds = [];
                $orderIndexes = [];
                $stageSlugs = [];

                foreach ($rawParts as $part) {
                    $part = trim($part);
                    if (empty($part)) continue;

                    // Handle ranges like "1-4"
                    if (strpos($part, '-') !== false) {
                        $rangeParts = explode('-', $part, 2);
                        $min = (int)trim($rangeParts[0]);
                        $max = (int)trim($rangeParts[1]);
                        if ($min > 0 && $max >= $min) {
                            for ($r = $min; $r <= $max; $r++) {
                                if ($r <= 14) $orderIndexes[] = $r - 1;
                                $stageIds[] = $r;
                            }
                        }
                    } elseif (is_numeric($part)) {
                        $n = (int)$part;
                        if ($n >= 1 && $n <= 14) {
                            $orderIndexes[] = $n - 1; // Pipeline order 1-14 mapped to 0-13
                        }
                        $stageIds[] = $n;
                    } else {
                        $stageSlugs[] = $part;
                    }
                }

                if (in_array($stageOp, ['gte', 'lte', 'gt', 'lt'], true) && (!empty($orderIndexes) || !empty($stageIds))) {
                    $refOrder = !empty($orderIndexes) ? min($orderIndexes) : (max(1, min($stageIds)) - 1);
                    $opMap = ['gte' => '>=', 'lte' => '<=', 'gt' => '>', 'lt' => '<'];
                    $sqlOp = $opMap[$stageOp];
                    $where[] = "EXISTS (SELECT 1 FROM pipeline_stages ps_op WHERE ps_op.id = t.stage_id AND ps_op.order_index {$sqlOp} ?)";
                    $params[] = (int)$refOrder;
                } else {
                    $stageOrClauses = [];
                    if (!empty($stageIds)) {
                        $inIds = implode(',', array_unique(array_map('intval', $stageIds)));
                        $stageOrClauses[] = "COALESCE(t.stage_id, 0) IN ($inIds)";
                    }
                    if (!empty($orderIndexes)) {
                        $inOrders = implode(',', array_unique(array_map('intval', $orderIndexes)));
                        $stageOrClauses[] = "EXISTS (SELECT 1 FROM pipeline_stages ps_o WHERE ps_o.id = t.stage_id AND ps_o.order_index IN ($inOrders))";
                    }
                    if (!empty($stageSlugs)) {
                        foreach ($stageSlugs as $slug) {
                            $stageOrClauses[] = "(COALESCE(t.pipeline_status, '') LIKE ? OR COALESCE(t.status, '') LIKE ? OR EXISTS (SELECT 1 FROM pipeline_stages ps_s WHERE ps_s.id = t.stage_id AND (ps_s.system_slug = ? OR ps_s.name LIKE ?)))";
                            $params[] = '%' . $slug . '%';
                            $params[] = '%' . $slug . '%';
                            $params[] = $slug;
                            $params[] = '%' . $slug . '%';
                        }
                    }

                    if (!empty($stageOrClauses)) {
                        if ($stageOp === 'not_in' || $stageOp === 'exclude') {
                            $where[] = "NOT (" . implode(' OR ', $stageOrClauses) . ")";
                        } else {
                            $where[] = "(" . implode(' OR ', $stageOrClauses) . ")";
                        }
                    }
                }
            }

            // Gender filtering (male/nam vs female/nu vs unknown)
            $genderParam = strtolower(trim((string)($_GET['gender'] ?? '')));
            if (!empty($genderParam) && $genderParam !== 'all') {
                if (in_array($genderParam, ['male', 'nam', 'trai', 'boy', '1', 'm'], true)) {
                    $where[] = "LOWER(TRIM(COALESCE(t.gender, ''))) IN ('male', 'nam', '1', 'm')";
                } elseif (in_array($genderParam, ['female', 'nu', 'nữ', 'gai', 'girl', '0', 'f'], true)) {
                    $where[] = "(LOWER(TRIM(COALESCE(t.gender, ''))) IN ('female', 'nu', '0', 'f') OR t.gender = 'Nữ')";
                } elseif (in_array($genderParam, ['unknown', 'empty', 'null', 'chua_ro', 'chưa rõ'], true)) {
                    $where[] = "(t.gender IS NULL OR TRIM(t.gender) = '' OR LOWER(TRIM(t.gender)) IN ('unknown', 'other', 'khác', 'khac'))";
                } else {
                    $where[] = "t.gender = ?";
                    $params[] = $genderParam;
                }
            }
            if ($companyId) { $where[] = 't.company_id = ?'; $params[] = (int)$companyId; }
            if ($projectId !== '') { $where[] = 't.project_id = ?'; $params[] = (int)$projectId; }
            if ($campaignId !== '') { $where[] = 't.campaign_id = ?'; $params[] = (int)$campaignId; }
            if ($tag !== '' && $tag !== 'all') {
                $tagList = array_filter(array_map('trim', explode(',', $tag)));
                if (!empty($tagList)) {
                    $tagOrs = [];
                    foreach ($tagList as $tg) {
                        $tagOrs[] = "t.tags LIKE ?";
                        $params[] = '%' . $tg . '%';
                    }
                    $where[] = "(" . implode(' OR ', $tagOrs) . ")";
                }
            }
            if ($teamId) {
                $where[] = 't.owner_id IN (SELECT id FROM users WHERE team_id = ?)';
                $params[] = (int)$teamId;
            }

            // Financial & Deposit Status Filters (Multi-Tier AI Parity)
            $financialFilter = strtolower(trim((string)($_GET['financial_filter'] ?? $_GET['deposit_status'] ?? '')));
            if ($financialFilter === 'has_deposit') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = t.id AND dep_f.status NOT IN ('cancelled', 'rejected'))";
            } elseif ($financialFilter === 'approved_deposit' || $financialFilter === 'has_approved_deposit') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = t.id AND dep_f.status = 'approved')";
            } elseif ($financialFilter === 'pending_deposit') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = t.id AND dep_f.status = 'pending')";
            } elseif ($financialFilter === 'no_deposit') {
                $where[] = "NOT EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = t.id AND dep_f.status NOT IN ('cancelled', 'rejected'))";
            } elseif ($financialFilter === 'has_so') {
                $where[] = "(t.stage_id IN (SELECT id FROM pipeline_stages WHERE order_index >= 12) OR t.status = 'customer')";
            } elseif ($financialFilter === 'high_value_deposit') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = t.id AND dep_f.price >= 10000000 AND dep_f.status NOT IN ('cancelled', 'rejected'))";
            }

            $minDeposit = isset($_GET['min_deposit']) && is_numeric($_GET['min_deposit'])
                ? (float)$_GET['min_deposit']
                : (isset($_GET['min_deposit_amount']) && is_numeric($_GET['min_deposit_amount']) ? (float)$_GET['min_deposit_amount'] : 0);
            if ($minDeposit > 0) {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_m WHERE dep_m.contact_id = t.id AND dep_m.status NOT IN ('cancelled', 'rejected') GROUP BY dep_m.contact_id HAVING SUM(dep_m.price) >= ?)";
                $params[] = $minDeposit;
            }

            // Interaction / Activity Status Filter (Multi-Tier AI Parity: 3-source check)
            $interactionStatus = strtolower(trim((string)($_GET['interaction_status'] ?? $_GET['activity_status'] ?? '')));
            if ($uncontacted && $interactionStatus === '') {
                $interactionStatus = 'uncontacted';
            }
            if ($interactionStatus === 'has_activity' || $interactionStatus === 'contacted') {
                $where[] = "(
                    (t.last_contact IS NOT NULL AND t.last_contact != '')
                    OR EXISTS (SELECT 1 FROM activities act_f WHERE (act_f.contact_id = t.id OR (act_f.related_id = t.id AND act_f.related_type IN ('contact', 'lead'))) AND act_f.deleted_at IS NULL)
                    OR EXISTS (
                        SELECT 1 FROM notes n_f 
                        WHERE n_f.entity_type = 'contact' AND n_f.entity_id = t.id 
                          AND n_f.body NOT LIKE '[Tự động]%' 
                          AND n_f.body NOT LIKE '[Phân bổ]%' 
                          AND n_f.body NOT LIKE '[Giao data]%'
                          AND n_f.body NOT LIKE '[Auto]%'
                          AND n_f.body NOT LIKE '[Import]%'
                          AND n_f.body NOT LIKE '[Tái phân bổ]%'
                    )
                )";
            } elseif ($interactionStatus === 'no_activity' || $interactionStatus === 'uncontacted') {
                $where[] = "(
                    (t.last_contact IS NULL OR t.last_contact = '')
                    AND NOT EXISTS (SELECT 1 FROM activities act_f WHERE (act_f.contact_id = t.id OR (act_f.related_id = t.id AND act_f.related_type IN ('contact', 'lead'))) AND act_f.deleted_at IS NULL)
                    AND NOT EXISTS (
                        SELECT 1 FROM notes n_f 
                        WHERE n_f.entity_type = 'contact' AND n_f.entity_id = t.id 
                          AND n_f.body NOT LIKE '[Tự động]%' 
                          AND n_f.body NOT LIKE '[Phân bổ]%' 
                          AND n_f.body NOT LIKE '[Giao data]%'
                          AND n_f.body NOT LIKE '[Auto]%'
                          AND n_f.body NOT LIKE '[Import]%'
                          AND n_f.body NOT LIKE '[Tái phân bổ]%'
                    )
                )";
            } elseif ($interactionStatus === 'has_call_recently') {
                $where[] = "EXISTS (SELECT 1 FROM activities act_f WHERE (act_f.contact_id = t.id OR (act_f.related_id = t.id AND act_f.related_type IN ('contact', 'lead'))) AND act_f.type = 'call' AND act_f.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND act_f.deleted_at IS NULL)";
            }

            // Shared Multi-Tier Extended Filters (stale_days, interacted_within_days, call counts, note_keyword, age/birthday, job_titles, companies, industries, education, teams, campaign_or_utm, temperature, lead_score, study_status, missing_document, max_deposit, overdue_milestone, custom_rules)
            AgentToolRegistry::applyMultitierExtendedContactFilters($this->db, 't.', $_GET, $where, $params);

            $admissionFrom = $_GET['admission_from'] ?? '';
            $admissionTo   = $_GET['admission_to'] ?? '';

            if ($dateField === 'deposit_date') {
                if ($from !== '' && $to !== '') {
                    $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = t.id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at BETWEEN ? AND ?)";
                    $params[] = $from . ' 00:00:00';
                    $params[] = $to . ' 23:59:59';
                } elseif ($from !== '') {
                    $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = t.id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at >= ?)";
                    $params[] = $from . ' 00:00:00';
                } elseif ($to !== '') {
                    $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = t.id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at <= ?)";
                    $params[] = $to . ' 23:59:59';
                }
            } elseif (in_array($dateField, ['admission_date', 'next_followup_date', 'expected_decision_date', 'birthday'], true)) {
                $colExpr = ($dateField === 'birthday') ? 'COALESCE(t.birthday, t.dob)' : "t.{$dateField}";
                if ($from !== '') {
                    $where[] = "{$colExpr} >= ?";
                    $params[] = $from;
                }
                if ($to !== '') {
                    $where[] = "{$colExpr} <= ?";
                    $params[] = $to . ' 23:59:59';
                }
            } else {
                $targetDateField = ($dateField === 'last_contact') ? 't.last_contact' : (($dateField === 'updated_at') ? 't.updated_at' : 't.created_at');
                if ($from !== '' && $to !== '') {
                    $where[] = "{$targetDateField} BETWEEN ? AND ?";
                    $params[] = $from . ' 00:00:00';
                    $params[] = $to . ' 23:59:59';
                } elseif ($from !== '') {
                    $where[] = "{$targetDateField} >= ?";
                    $params[] = $from . ' 00:00:00';
                } elseif ($to !== '') {
                    $where[] = "{$targetDateField} <= ?";
                    $params[] = $to . ' 23:59:59';
                }
            }

            if ($admissionFrom !== '') {
                $where[] = "t.admission_date >= ?";
                $params[] = $admissionFrom;
            }
            if ($admissionTo !== '') {
                $where[] = "t.admission_date <= ?";
                $params[] = $admissionTo;
            }

            switch ($segment) {
                case 'tiem_nang':
                    if ($exportMode === 'full' || !empty($stage) || !empty($stageSlug) || !empty($_GET['stage_id']) || !empty($stagesParam)) {
                        $where[] = "(t.status IS NULL OR t.status != 'customer')";
                    } else {
                        $where[] = "((t.stage_id IS NULL OR t.stage_id != 44) AND (t.pipeline_status IS NULL OR t.pipeline_status NOT IN ('enrolled', 'hoc_vien')) AND (t.status IS NULL OR t.status != 'customer'))";
                    }
                    break;
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
                case 'not_contacted':
                    $where[] = "(
                        (t.last_contact IS NULL OR t.last_contact = '')
                        AND NOT EXISTS (
                            SELECT 1 FROM activities a 
                            WHERE a.tenant_id = t.tenant_id AND ((a.related_type = 'contact' AND a.related_id = t.id) OR a.contact_id = t.id) 
                              AND a.deleted_at IS NULL
                        )
                        AND NOT EXISTS (
                            SELECT 1 FROM notes n 
                            WHERE n.tenant_id = t.tenant_id AND n.entity_type = 'contact' AND n.entity_id = t.id 
                              AND n.body NOT LIKE '[Tự động]%' 
                              AND n.body NOT LIKE '[Phân bổ]%' 
                              AND n.body NOT LIKE '[Giao data]%'
                              AND n.body NOT LIKE '[Auto]%'
                              AND n.body NOT LIKE '[Import]%'
                              AND n.body NOT LIKE '[Tái phân bổ]%'
                              AND n.body NOT LIKE 'Tái phân bổ%'
                              AND n.body NOT LIKE 'Giao lại%'
                        )
                    )";
                    break;
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
                    t.duplicate_with_id > 0
                    OR t.id IN (SELECT duplicate_with_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND duplicate_with_id > 0)
                    OR (t.person_id > 0 AND t.person_id IN (
                        SELECT person_id FROM contacts 
                        WHERE tenant_id = ? AND deleted_at IS NULL AND person_id > 0 
                        GROUP BY person_id 
                        HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2 
                            OR COUNT(DISTINCT stage_id) >= 2 
                            OR SUM(CASE WHEN duplicate_with_id > 0 THEN 1 ELSE 0 END) > 0
                    ))
                    OR (t.phone != '' AND t.phone IS NOT NULL AND t.phone IN (
                        SELECT phone FROM contacts 
                        WHERE tenant_id = ? AND deleted_at IS NULL AND phone != '' AND phone IS NOT NULL 
                        GROUP BY phone 
                        HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2 
                            OR COUNT(DISTINCT stage_id) >= 2 
                            OR SUM(CASE WHEN duplicate_with_id > 0 THEN 1 ELSE 0 END) > 0
                    ))
                )";
                $params[] = $auth['tenant_id'];
                $params[] = $auth['tenant_id'];
                $params[] = $auth['tenant_id'];
            }

            if ($dataType !== '') {
                $errorCond = "(
                    EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = t.id AND tk.status IN ('open', 'in_progress'))
                    OR EXISTS (
                        SELECT 1 FROM data_reports dr 
                        JOIN leads l2 ON dr.lead_id = l2.id 
                        WHERE t.phone IS NOT NULL AND t.phone != '' AND l2.phone = t.phone AND dr.status IN ('pending', 'approved')
                    )
                )";
                $personalCond = "(
                    t.source IN ('ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref')
                    OR t.source LIKE 'ca_nhan%'
                    OR t.source = 'Nhân viên kinh doanh tự tìm kiếm'
                    OR (t.created_by = t.owner_id AND t.created_by NOT IN (1, 100009))
                )";
                if ($dataType === 'error_ticket') {
                    $where[] = $errorCond;
                } else if ($dataType === 'personal') {
                    $where[] = "NOT $errorCond";
                    $where[] = $personalCond;
                } else if ($dataType === 'distributed') {
                    $where[] = "NOT $errorCond";
                    $where[] = "NOT $personalCond";
                }
            }

            $whereStr = implode(' AND ', $where);

            $sql = "SELECT t.*, 
                           co.name as company_name, 
                           u.full_name as owner_name, 
                           p.name as project_name,
                           COALESCE(ps.name, ps_fb.name) as stage_name,
                           COALESCE(camp.name, l.campaign_name) as campaign_name,
                           CASE 
                               WHEN t.pipeline_status IN ('enrolled', 'hoc_vien') OR t.status = 'customer' THEN
                                   COALESCE(
                                       t.admission_date,
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
                           COALESCE(r.round_name, r2.round_name) as round_name,
                           dr.status as report_status,
                           COALESCE(
                               NULLIF(t.expected_revenue, 0),
                               (
                                   SELECT NULLIF(SUM(dep_v.price), 0)
                                   FROM deposits dep_v
                                   WHERE dep_v.contact_id = t.id AND dep_v.status NOT IN ('cancelled', 'rejected')
                               ),
                               (
                                   SELECT COALESCE(SUM(d.value), 0) 
                                   FROM deals d 
                                   WHERE d.contact_id = t.id AND d.deleted_at IS NULL
                               ),
                               0
                           ) as open_deal_value,
                           COALESCE(
                               (SELECT COALESCE(NULLIF(TRIM(a.body), ''), a.subject) FROM activities a WHERE ((a.related_type IN ('contact', 'lead') AND a.related_id = t.id) OR a.contact_id = t.id) AND a.deleted_at IS NULL ORDER BY a.id DESC LIMIT 1),
                               (SELECT n.body FROM notes n WHERE n.entity_type = 'contact' AND n.entity_id = t.id AND n.body NOT LIKE '[Tự động]%' AND n.body NOT LIKE '[Phân bổ]%' AND n.body NOT LIKE '[Giao data]%' AND n.body NOT LIKE '[Auto]%' AND n.body NOT LIKE '[Import]%' AND n.body NOT LIKE '[Tái phân bổ]%' ORDER BY n.id DESC LIMIT 1),
                               (SELECT n2.body FROM notes n2 WHERE n2.entity_type = 'contact' AND n2.entity_id = t.id ORDER BY n2.id DESC LIMIT 1)
                           ) as last_interaction
                    FROM contacts t 
                    LEFT JOIN companies co ON t.company_id = co.id 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    LEFT JOIN projects p ON t.project_id = p.id
                    LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
                    LEFT JOIN pipeline_stages ps_fb ON (t.stage_id IS NULL AND ps_fb.system_slug = t.pipeline_status)
                    LEFT JOIN marketing_campaigns camp ON t.campaign_id = camp.id
                    LEFT JOIN leads l ON l.id = COALESCE(
                        (SELECT MAX(id) FROM leads WHERE t.person_id IS NOT NULL AND person_id = t.person_id),
                        (SELECT MAX(id) FROM leads WHERE t.phone IS NOT NULL AND phone = t.phone)
                    )
                    LEFT JOIN distribution_logs dl ON dl.id = (
                        SELECT MAX(id) FROM distribution_logs 
                        WHERE l.id IS NOT NULL AND lead_id = l.id
                    )
                    LEFT JOIN distribution_rounds r ON dl.round_id = r.id
                    LEFT JOIN distribution_rounds r2 ON l.target_round_id = r2.id
                    LEFT JOIN data_reports dr ON dr.id = (
                        SELECT MAX(id) FROM data_reports 
                        WHERE (l.id IS NOT NULL AND lead_id = l.id AND consultant_id = t.owner_id)
                    )
                    WHERE $whereStr ORDER BY t.created_at DESC";
            $exportLimit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? (int)$_GET['limit'] : 0;
            if ($exportLimit > 0 && $exportLimit <= 50000) {
                $sql .= " LIMIT " . $exportLimit;
            }
        } elseif ($type === 'company') {
            $baseColumns = ['id' => 'ID', 'name' => 'Tên công ty', 'tax_id' => 'Mã số thuế', 'industry' => 'Ngành nghề', 'email' => 'Email', 'phone' => 'Số điện thoại', 'website' => 'Website', 'address' => 'Địa chỉ', 'city' => 'Tỉnh/Thành phố', 'size' => 'Quy mô', 'status' => 'Trạng thái', 'owner_name' => 'Người phụ trách', 'created_at' => 'Ngày tạo'];
            
            $where = ['t.tenant_id = ?', 't.deleted_at IS NULL'];
            $params = [$auth['tenant_id']];
            if (in_array(strtolower($auth['role'] ?? ''), ['sales', 'sale'], true)) {
                $where[] = 't.owner_id = ?';
                $params[] = $auth['user_id'];
            }
            
            $search  = $_GET['search'] ?? '';
            $status  = $_GET['status'] ?? '';
            $ownerId = trim((string)($_GET['owner_id'] ?? ''));
            $teamId  = trim((string)($_GET['team_id'] ?? ''));
            $stageId = trim((string)($_GET['stage_id'] ?? ''));
            $from    = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
            $to      = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
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
            if ($ownerId !== '' && $ownerId !== 'all') {
                $where[] = 't.owner_id = ?';
                $params[] = (int)$ownerId;
            }
            if ($teamId !== '' && $teamId !== 'all') {
                $where[] = 't.owner_id IN (SELECT id FROM users WHERE team_id = ?)';
                $params[] = (int)$teamId;
            }
            if ($stageId !== '' && $stageId !== 'all') {
                $where[] = 't.stage_id = ?';
                $params[] = (int)$stageId;
            }
            if ($from !== '') {
                $where[] = 't.created_at >= ?';
                $params[] = $from . ' 00:00:00';
            }
            if ($to !== '') {
                $where[] = 't.created_at <= ?';
                $params[] = $to . ' 23:59:59';
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
            $userRole = strtolower($auth['role'] ?? 'user');
            $isGlobalAdmin = in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'sale_admin', 'saleadmin', 'accountant', 'ke_toan'], true);
            $isManager = in_array($userRole, ['manager', 'truong_phong', 'leader', 'team_lead'], true);

            if (!$isGlobalAdmin) {
                if ($isManager) {
                    $where[] = '(t.owner_id = ? OR c.owner_id = ? OR t.owner_id IN (
                        SELECT id FROM users WHERE team_id IN (
                            SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                        )
                    ))';
                    $params[] = $auth['user_id'];
                    $params[] = $auth['user_id'];
                    $params[] = $auth['user_id'];
                } else {
                    $where[] = '(t.owner_id = ? OR c.owner_id = ?)';
                    $params[] = $auth['user_id'];
                    $params[] = $auth['user_id'];
                }
            }

            $search          = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));
            $ownersParam     = trim((string)($_GET['owners'] ?? $_GET['owner_id'] ?? ''));
            $teamId          = trim((string)($_GET['team_id'] ?? ''));
            $projectId       = trim((string)($_GET['project_id'] ?? ''));
            $campaignId      = trim((string)($_GET['campaign_id'] ?? ''));
            $sourceParam     = trim((string)($_GET['source'] ?? $_GET['sources'] ?? ''));
            $companyId       = trim((string)($_GET['company_id'] ?? ''));
            $contactId       = trim((string)($_GET['contact_id'] ?? ''));
            $stagesParam     = trim((string)($_GET['stages'] ?? $_GET['stage_ids'] ?? $_GET['stage_id'] ?? ''));
            $statusesParam   = strtolower(trim((string)($_GET['status'] ?? $_GET['statuses'] ?? '')));
            $prioritiesParam = strtolower(trim((string)($_GET['priority'] ?? $_GET['priorities'] ?? '')));
            $minValue        = isset($_GET['min_amount']) && is_numeric($_GET['min_amount']) ? (float)$_GET['min_amount'] : (isset($_GET['min_value']) && is_numeric($_GET['min_value']) ? (float)$_GET['min_value'] : 0);
            $maxValue        = isset($_GET['max_amount']) && is_numeric($_GET['max_amount']) ? (float)$_GET['max_amount'] : (isset($_GET['max_value']) && is_numeric($_GET['max_value']) ? (float)$_GET['max_value'] : 0);
            $period          = strtolower(trim((string)($_GET['period'] ?? '')));
            $from            = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
            $to              = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));

            if ($search !== '') {
                $like = "%{$search}%";
                $where[] = '(t.title LIKE ? OR co.name LIKE ? OR c.full_name LIKE ? OR u.full_name LIKE ?)';
                array_push($params, $like, $like, $like, $like);
            }
            if ($ownersParam !== '' && $ownersParam !== 'all') {
                $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
                if (!empty($ownList)) {
                    $ownOrs = [];
                    foreach ($ownList as $own) {
                        if (is_numeric($own)) {
                            $ownOrs[] = 't.owner_id = ?';
                            $params[] = (int)$own;
                        } else {
                            $ownOrs[] = 'u.full_name LIKE ?';
                            $params[] = '%' . $own . '%';
                        }
                    }
                    $where[] = '(' . implode(' OR ', $ownOrs) . ')';
                }
            }
            if ($teamId !== '' && $teamId !== 'all') {
                $where[] = 't.owner_id IN (SELECT id FROM users WHERE team_id = ?)';
                $params[] = (int)$teamId;
            }
            if ($projectId !== '' && $projectId !== 'all') {
                $where[] = 'c.project_id = ?';
                $params[] = (int)$projectId;
            }
            if ($campaignId !== '' && $campaignId !== 'all') {
                $where[] = 'c.campaign_id = ?';
                $params[] = (int)$campaignId;
            }
            if ($sourceParam !== '' && $sourceParam !== 'all') {
                $where[] = '(t.source = ? OR c.source = ?)';
                $params[] = $sourceParam;
                $params[] = $sourceParam;
            }
            if ($companyId !== '' && $companyId !== 'all') {
                $where[] = 't.company_id = ?';
                $params[] = (int)$companyId;
            }
            if ($contactId !== '' && $contactId !== 'all') {
                $where[] = 't.contact_id = ?';
                $params[] = (int)$contactId;
            }
            if ($stagesParam !== '' && $stagesParam !== 'all') {
                $stList = array_filter(array_map('trim', explode(',', $stagesParam)));
                if (!empty($stList)) {
                    $stOrs = [];
                    foreach ($stList as $sItem) {
                        if (is_numeric($sItem)) {
                            $stOrs[] = 't.stage_id = ?';
                            $params[] = (int)$sItem;
                        } else {
                            $stOrs[] = 'ps.name LIKE ?';
                            $params[] = '%' . $sItem . '%';
                        }
                    }
                    $where[] = '(' . implode(' OR ', $stOrs) . ')';
                }
            }
            if ($statusesParam !== '' && $statusesParam !== 'all') {
                $statusList = array_filter(array_map('trim', explode(',', $statusesParam)));
                if (!empty($statusList)) {
                    $sOrs = [];
                    foreach ($statusList as $st) {
                        if ($st === 'won') {
                            $sOrs[] = "(t.status = 'won' OR ps.is_won = 1)";
                        } elseif ($st === 'lost') {
                            $sOrs[] = "(t.status = 'lost' OR ps.is_lost = 1)";
                        } elseif ($st === 'open') {
                            $sOrs[] = "(COALESCE(t.status, 'open') = 'open' AND COALESCE(ps.is_won, 0) = 0 AND COALESCE(ps.is_lost, 0) = 0)";
                        } else {
                            $sOrs[] = "t.status = ?";
                            $params[] = $st;
                        }
                    }
                    $where[] = '(' . implode(' OR ', $sOrs) . ')';
                }
            }
            if ($prioritiesParam !== '' && $prioritiesParam !== 'all') {
                $prList = array_filter(array_map('trim', explode(',', $prioritiesParam)));
                if (!empty($prList)) {
                    $ph = implode(',', array_fill(0, count($prList), '?'));
                    $where[] = "t.priority IN ({$ph})";
                    foreach ($prList as $pr) $params[] = $pr;
                }
            }
            if ($minValue > 0) {
                $where[] = 't.value >= ?';
                $params[] = $minValue;
            }
            if ($maxValue > 0) {
                $where[] = 't.value <= ?';
                $params[] = $maxValue;
            }
            if ($from !== '' && $to !== '') {
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = $from . ' 00:00:00';
                $params[] = $to . ' 23:59:59';
            } elseif ($from !== '') {
                $where[] = 't.created_at >= ?';
                $params[] = $from . ' 00:00:00';
            } elseif ($to !== '') {
                $where[] = 't.created_at <= ?';
                $params[] = $to . ' 23:59:59';
            } elseif ($period === 'today') {
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = date('Y-m-d 00:00:00');
                $params[] = date('Y-m-d 23:59:59');
            } elseif ($period === 'this_week') {
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = date('Y-m-d 00:00:00', strtotime('monday this week'));
                $params[] = date('Y-m-d 23:59:59', strtotime('sunday this week'));
            } elseif ($period === 'this_month') {
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = date('Y-m-01 00:00:00');
                $params[] = date('Y-m-t 23:59:59');
            } elseif ($period === 'last_month') {
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = date('Y-m-01 00:00:00', strtotime('first day of last month'));
                $params[] = date('Y-m-t 23:59:59', strtotime('last day of last month'));
            } elseif ($period === 'this_quarter') {
                $curQ = (int)ceil((int)date('n') / 3);
                $qStartMonth = ($curQ - 1) * 3 + 1;
                $qEndMonth = $curQ * 3;
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = sprintf('%s-%02d-01 00:00:00', date('Y'), $qStartMonth);
                $params[] = date('Y-m-t 23:59:59', strtotime(sprintf('%s-%02d-01', date('Y'), $qEndMonth)));
            } elseif ($period === 'this_year') {
                $where[] = 't.created_at BETWEEN ? AND ?';
                $params[] = date('Y-01-01 00:00:00');
                $params[] = date('Y-12-31 23:59:59');
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
            
            $search = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));
            $categoriesPar = trim((string)($_GET['category'] ?? $_GET['categories'] ?? ''));
            if ($search !== '') {
                $where[] = '(t.name LIKE ? OR t.sku LIKE ? OR t.description LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            if ($categoriesPar !== '' && $categoriesPar !== 'all') {
                $cList = array_filter(array_map('trim', explode(',', $categoriesPar)));
                if (!empty($cList)) {
                    $cOrs = [];
                    foreach ($cList as $cItem) {
                        $cOrs[] = 't.category LIKE ?';
                        $params[] = '%' . $cItem . '%';
                    }
                    $where[] = '(' . implode(' OR ', $cOrs) . ')';
                }
            }

            $whereStr = implode(' AND ', $where);
            $sql = "SELECT t.* FROM products t WHERE $whereStr ORDER BY t.name ASC";
        } elseif ($type === 'inventory') {
            $baseColumns = ['id' => 'ID', 'product_name' => 'Sản phẩm', 'sku' => 'SKU', 'batch_code' => 'Mã lô', 'import_date' => 'Ngày nhập', 'expiry_date' => 'Hạn sử dụng', 'import_price' => 'Giá nhập', 'initial_qty' => 'Số lượng ban đầu', 'current_qty' => 'Tồn kho hiện tại', 'status' => 'Trạng thái'];
            $where = ['b.tenant_id = ?', "b.status = 'active'"];
            $params = [$auth['tenant_id']];

            $search = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));
            $categoriesPar = trim((string)($_GET['category'] ?? $_GET['categories'] ?? ''));
            $stockStatus = strtolower(trim((string)($_GET['stock_status'] ?? '')));

            if ($search !== '') {
                $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR b.batch_code LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            if ($categoriesPar !== '' && $categoriesPar !== 'all') {
                $cList = array_filter(array_map('trim', explode(',', $categoriesPar)));
                if (!empty($cList)) {
                    $cOrs = [];
                    foreach ($cList as $cItem) {
                        $cOrs[] = 'p.category LIKE ?';
                        $params[] = '%' . $cItem . '%';
                    }
                    $where[] = '(' . implode(' OR ', $cOrs) . ')';
                }
            }
            if ($stockStatus === 'in_stock') {
                $where[] = 'b.current_qty > 0';
            } elseif ($stockStatus === 'low_stock') {
                $where[] = 'b.current_qty > 0 AND (b.current_qty <= 10 OR (b.initial_qty > 0 AND (b.current_qty / b.initial_qty) <= 0.10))';
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
        $maxLimit = (isset($_GET['limit']) && is_numeric($_GET['limit'])) ? max(1, (int)$_GET['limit']) : 0;

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
            $currentBatchSize = ($maxLimit > 0) ? min($batchSize, $maxLimit - $totalExported) : $batchSize;
            if ($currentBatchSize <= 0) {
                break;
            }

            $batchSql = $sql . " LIMIT $currentBatchSize OFFSET $offset";
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
                        'completed' => 'Đã hoàn thành',
                        'graduated' => 'Đã tốt nghiệp',
                        'reserved' => 'Bảo lưu',
                        'deferred' => 'Bảo lưu',
                        'suspended' => 'Tạm ngưng',
                        'tam_ngung' => 'Tạm ngưng',
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
            $offset += count($records);

            if ($maxLimit > 0 && $totalExported >= $maxLimit) {
                break;
            }

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

    /**
     * Export attendance records to CSV (UTF-8 with BOM for Excel compatibility)
     */
    public function exportAttendance(array $auth): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower($auth['role'] ?? 'user');
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isHR = in_array($role, ['hr', 'nhan_su'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader'], true);
        $canViewAll = ($isGlobalAdmin || $isHR);

        $month = isset($_GET['month']) && !empty($_GET['month']) ? min(12, max(1, (int)$_GET['month'])) : (int)date('n');
        $year = isset($_GET['year']) && !empty($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
        $fromDate = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $userIdParam = trim((string)($_GET['user_id'] ?? ''));
        $userNameParam = trim((string)($_GET['user_name'] ?? $_GET['staff_name'] ?? $_GET['search'] ?? ''));
        $deptFilter = trim((string)($_GET['department'] ?? $_GET['departments'] ?? ''));
        $statusFilter = strtolower(trim((string)($_GET['status'] ?? $_GET['statuses'] ?? '')));

        if (!empty($fromDate) && !empty($toDate)) {
            $rangeStart = $fromDate;
            $rangeEnd = $toDate;
            $fileLabel = "{$fromDate}_den_{$toDate}";
        } else {
            $rangeStart = sprintf('%04d-%02d-01', $year, $month);
            $rangeEnd = date('Y-m-t', strtotime($rangeStart));
            $fileLabel = "thang_{$month}_{$year}";
        }

        // Prepare headers
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="bang_cham_cong_' . $fileLabel . '_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel

        // Header row
        $headers = [
            'STT',
            'Mã NV',
            'Họ và tên',
            'Phòng ban / Team',
            'Chức danh',
            'Email',
            'Ngày chấm công',
            'Thứ',
            'Giờ vào (Check-in)',
            'Giờ ra (Check-out)',
            'Số phút trễ',
            'Số phút về sớm',
            'Tăng ca OT (Giờ)',
            'Hình thức làm việc',
            'Trạng thái công',
            'Lý do / Ghi chú'
        ];
        fputcsv($output, $headers);

        // Build query
        $whereClauses = ["u.tenant_id = ?", "c.check_in_date BETWEEN ? AND ?"];
        $params = [$tid, $rangeStart, $rangeEnd];

        // RBAC filtering
        if (!$canViewAll) {
            if ($isManager) {
                $whereClauses[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))) OR (u.team_id IS NOT NULL AND u.team_id = (SELECT team_id FROM users WHERE id = ?)))";
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
            } else {
                $whereClauses[] = "u.id = ?";
                $params[] = $uid;
            }
        }

        if (!empty($userIdParam) && $userIdParam !== 'all') {
            if (is_numeric($userIdParam)) {
                $whereClauses[] = "c.user_id = ?";
                $params[] = (int)$userIdParam;
            } else {
                $whereClauses[] = "u.full_name LIKE ?";
                $params[] = "%{$userIdParam}%";
            }
        }

        if (!empty($userNameParam) && $userNameParam !== 'all') {
            $whereClauses[] = "(u.full_name LIKE ? OR u.email LIKE ?)";
            $params[] = "%{$userNameParam}%";
            $params[] = "%{$userNameParam}%";
        }

        if (!empty($deptFilter) && $deptFilter !== 'all') {
            $whereClauses[] = "(t.name LIKE ? OR u.department LIKE ? OR u.job_title LIKE ?)";
            $params[] = "%$deptFilter%";
            $params[] = "%$deptFilter%";
            $params[] = "%$deptFilter%";
        }

        if (!empty($statusFilter) && $statusFilter !== 'all') {
            if ($statusFilter === 'late_only' || $statusFilter === 'late') {
                $whereClauses[] = "(c.late_minutes > 0 OR TIME(c.check_in_time) > '08:05:00')";
            } elseif ($statusFilter === 'overtime_only' || $statusFilter === 'overtime' || $statusFilter === 'ot') {
                $whereClauses[] = "(c.check_out_time IS NOT NULL AND TIME(c.check_out_time) > '17:30:00')";
            } elseif ($statusFilter === 'wfh') {
                $whereClauses[] = "(c.reason LIKE '%wfh%' OR c.admin_note LIKE '%wfh%')";
            } elseif (in_array($statusFilter, ['pending', 'approved', 'rejected'], true)) {
                $whereClauses[] = "c.status = ?";
                $params[] = $statusFilter;
            }
        }

        $sql = "SELECT 
                    c.id as check_in_id,
                    c.user_id,
                    u.full_name,
                    COALESCE(u.job_title, u.role) as job_title,
                    COALESCE(t.name, 'Chung') as team_name,
                    u.email,
                    c.check_in_date,
                    DATE_FORMAT(c.check_in_date, '%d/%m/%Y') as formatted_date,
                    DAYNAME(c.check_in_date) as day_name,
                    TIME_FORMAT(c.check_in_time, '%H:%i') as check_in_time,
                    TIME_FORMAT(c.check_out_time, '%H:%i') as check_out_time,
                    c.late_minutes,
                    c.early_minutes,
                    c.status,
                    c.reason,
                    c.admin_note
                FROM check_ins c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE " . implode(' AND ', $whereClauses) . "
                ORDER BY c.check_in_date ASC, u.full_name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $stt = 1;
        $dayMap = [
            'Monday' => 'Thứ Hai',
            'Tuesday' => 'Thứ Ba',
            'Wednesday' => 'Thứ Tư',
            'Thursday' => 'Thứ Năm',
            'Friday' => 'Thứ Sáu',
            'Saturday' => 'Thứ Bảy',
            'Sunday' => 'Chủ Nhật'
        ];

        foreach ($records as $r) {
            $otHours = 0.0;
            if (!empty($r['check_out_time']) && $r['check_out_time'] > '17:00') {
                $outM = (int)substr($r['check_out_time'], 0, 2) * 60 + (int)substr($r['check_out_time'], 3, 2);
                $diff = $outM - (17 * 60);
                if ($diff > 0) $otHours = round($diff / 60.0, 1);
            }

            $lateM = (int)($r['late_minutes'] ?? 0);
            if ($lateM <= 0 && !empty($r['check_in_time']) && $r['check_in_time'] > '08:00') {
                $inM = (int)substr($r['check_in_time'], 0, 2) * 60 + (int)substr($r['check_in_time'], 3, 2);
                $diff = $inM - (8 * 60);
                if ($diff > 0) $lateM = $diff;
            }

            $statusText = 'Đúng giờ';
            if ($lateM > 0 && (int)($r['early_minutes'] ?? 0) > 0) {
                $statusText = 'Trễ & Về sớm';
            } elseif ($lateM > 0) {
                $statusText = 'Đi trễ';
            } elseif ((int)($r['early_minutes'] ?? 0) > 0) {
                $statusText = 'Về sớm';
            } elseif ($r['status'] === 'approved') {
                $statusText = 'Đủ công';
            }

            $workType = (stripos((string)$r['reason'], 'wfh') !== false || stripos((string)$r['admin_note'], 'wfh') !== false) ? 'Làm việc từ xa (WFH)' : 'Tại văn phòng';

            $note = trim(($r['reason'] ?: '') . ($r['admin_note'] ? ' | ' . $r['admin_note'] : ''));

            $csvRow = [
                $stt++,
                $r['user_id'],
                $r['full_name'],
                $r['team_name'],
                $r['job_title'],
                $r['email'],
                $r['formatted_date'],
                $dayMap[$r['day_name']] ?? $r['day_name'],
                $r['check_in_time'] ?: '--',
                $r['check_out_time'] ?: '--',
                $lateM,
                (int)($r['early_minutes'] ?? 0),
                $otHours,
                $workType,
                $statusText,
                $note
            ];

            fputcsv($output, $csvRow);
        }

        fclose($output);
        exit;
    }

    /**
     * Export expense / PO records to CSV (UTF-8 with BOM for Excel compatibility, 100% Filter & RBAC Parity)
     */
    public function exportExpenses(array $auth): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower($auth['role'] ?? 'user');
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isAccountant = in_array($role, ['accountant', 'ke_toan'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader'], true);

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_chi_phi_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel

        $headers = [
            'STT',
            'Mã Phiếu',
            'Tiêu đề / Nội dung chi',
            'Danh mục',
            'Số tiền (VNĐ)',
            'VAT (VNĐ)',
            'Trạng thái',
            'Trạng thái giải ngân (UNC)',
            'Ngày đề xuất',
            'Hạn thanh toán',
            'Người đề xuất',
            'Người duyệt Cấp 1',
            'Người duyệt Cấp 2',
            'Người duyệt Cấp 3',
            'Nhà cung cấp / Đối tác',
            'Ghi chú'
        ];
        fputcsv($output, $headers);

        $where = ["e.tenant_id = ?", "e.deleted_at IS NULL"];
        $params = [$tid];

        // Zero-Trust Finance RBAC Isolation
        if (!$isGlobalAdmin && !$isAccountant) {
            if ($isManager) {
                $stmtMgrTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ? LIMIT 1");
                $stmtMgrTeam->execute([$uid]);
                $mgrTeamId = (int)($stmtMgrTeam->fetchColumn() ?: 0);
                $where[] = "(e.created_by IN (SELECT id FROM users WHERE (team_id > 0 AND team_id = ?) OR team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR id = ?) OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                array_push($params, $mgrTeamId, $uid, $uid, $uid, $uid, $uid, (string)$uid);
            } else {
                $where[] = "(e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
                $params[] = (string)$uid;
            }
        }

        $departmentsParam = trim((string)($_GET['departments'] ?? ''));
        $categoriesParam  = trim((string)($_GET['category'] ?? $_GET['categories'] ?? ''));
        $statusesParam    = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $period           = strtolower(trim((string)($_GET['period'] ?? '')));
        $fromDate         = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate           = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $minAmount        = isset($_GET['min_amount']) && is_numeric($_GET['min_amount']) ? (float)$_GET['min_amount'] : 0;
        $maxAmount        = isset($_GET['max_amount']) && is_numeric($_GET['max_amount']) ? (float)$_GET['max_amount'] : 0;
        $overdueOnly      = !empty($_GET['overdue_only']) && in_array(strtolower((string)$_GET['overdue_only']), ['1', 'true', 'yes'], true);
        $search           = trim((string)($_GET['search'] ?? ''));
        $creatorId        = trim((string)($_GET['created_by'] ?? $_GET['creator_id'] ?? ''));
        $createdByName    = trim((string)($_GET['created_by_name'] ?? ''));
        $vendorNameParam  = trim((string)($_GET['vendor_name'] ?? ''));
        $hasVatInvoice    = strtolower(trim((string)($_GET['has_vat_invoice'] ?? '')));

        if ($creatorId !== '' && is_numeric($creatorId)) {
            $where[] = "e.created_by = ?";
            $params[] = (int)$creatorId;
        }
        if ($createdByName !== '') {
            $where[] = "u.full_name LIKE ?";
            $params[] = "%{$createdByName}%";
        }
        if ($vendorNameParam !== '') {
            $where[] = "e.vendor_name LIKE ?";
            $params[] = "%{$vendorNameParam}%";
        }
        if ($hasVatInvoice !== '' && $hasVatInvoice !== 'all') {
            if (in_array($hasVatInvoice, ['1', 'true', 'yes'], true)) {
                $where[] = "(e.has_vat_invoice = 1 OR COALESCE(e.vat_amount, 0) > 0)";
            } elseif (in_array($hasVatInvoice, ['0', 'false', 'no'], true)) {
                $where[] = "(COALESCE(e.has_vat_invoice, 0) = 0 AND COALESCE(e.vat_amount, 0) <= 0)";
            }
        }

        if ($departmentsParam !== '' && $departmentsParam !== 'all') {
            $deptList = array_filter(array_map('trim', explode(',', $departmentsParam)));
            if (!empty($deptList)) {
                $deptOrs = [];
                foreach ($deptList as $d) {
                    $deptOrs[] = "(e.category LIKE ? OR e.title LIKE ?)";
                    $params[] = '%' . $d . '%';
                    $params[] = '%' . $d . '%';
                }
                $where[] = "(" . implode(' OR ', $deptOrs) . ")";
            }
        }

        if ($categoriesParam !== '' && $categoriesParam !== 'all') {
            $catList = array_filter(array_map('trim', explode(',', $categoriesParam)));
            if (!empty($catList)) {
                $catOrs = [];
                foreach ($catList as $c) {
                    $catOrs[] = "e.category LIKE ?";
                    $params[] = '%' . $c . '%';
                }
                $where[] = "(" . implode(' OR ', $catOrs) . ")";
            }
        }

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', $statusesParam)));
            if (!empty($stList)) {
                $stOrs = [];
                foreach ($stList as $st) {
                    if ($st === 'pending') {
                        $stOrs[] = "(e.status = 'pending' OR e.status = 'level1_approved')";
                    } elseif ($st === 'approved') {
                        $stOrs[] = "e.status = 'approved'";
                    } elseif ($st === 'unpaid' || $st === 'approved_unpaid' || $st === 'waiting_disbursement') {
                        $stOrs[] = "(e.status = 'approved' AND COALESCE(e.is_refunded, 0) = 0)";
                    } elseif ($st === 'paid' || $st === 'disbursed') {
                        $stOrs[] = "(e.is_refunded = 1 OR e.status IN ('paid', 'refunded'))";
                    } elseif ($st === 'rejected') {
                        $stOrs[] = "e.status = 'rejected'";
                    } elseif ($st === 'pending_l1') {
                        $stOrs[] = "(e.status = 'pending' AND (e.status_level_1 = 'pending' OR e.status_level_1 IS NULL))";
                    } elseif ($st === 'pending_l2') {
                        $stOrs[] = "(e.status = 'pending' AND e.status_level_1 = 'approved' AND (e.status_level_2 = 'pending' OR e.status_level_2 IS NULL))";
                    } elseif ($st === 'pending_l3') {
                        $stOrs[] = "(e.status = 'pending' AND e.status_level_2 = 'approved' AND (e.status_level_3 = 'pending' OR e.status_level_3 IS NULL))";
                    } else {
                        $stOrs[] = "e.status = ?";
                        $params[] = $st;
                    }
                }
                if (!empty($stOrs)) {
                    $where[] = "(" . implode(' OR ', $stOrs) . ")";
                }
            }
        }

        if (!empty($fromDate) && !empty($toDate)) {
            $where[] = "e.date BETWEEN ? AND ?";
            $params[] = $fromDate;
            $params[] = $toDate;
        } elseif (!empty($fromDate)) {
            $where[] = "e.date >= ?";
            $params[] = $fromDate;
        } elseif (!empty($toDate)) {
            $where[] = "e.date <= ?";
            $params[] = $toDate;
        } elseif ($period === 'this_month') {
            $where[] = "e.date BETWEEN ? AND ?";
            $params[] = date('Y-m-01');
            $params[] = date('Y-m-t');
        } elseif ($period === 'last_month') {
            $where[] = "e.date BETWEEN ? AND ?";
            $params[] = date('Y-m-01', strtotime('first day of last month'));
            $params[] = date('Y-m-t', strtotime('last day of last month'));
        } elseif ($period === 'this_quarter') {
            $curQ = (int)ceil((int)date('n') / 3);
            $qStartMonth = ($curQ - 1) * 3 + 1;
            $qEndMonth = $curQ * 3;
            $where[] = "e.date BETWEEN ? AND ?";
            $params[] = sprintf('%s-%02d-01', date('Y'), $qStartMonth);
            $params[] = date('Y-m-t', strtotime(sprintf('%s-%02d-01', date('Y'), $qEndMonth)));
        } elseif ($period === 'last_quarter') {
            $curQ = (int)ceil((int)date('n') / 3);
            $lastQYear = (int)date('Y');
            $lastQ = $curQ - 1;
            if ($lastQ < 1) {
                $lastQ = 4;
                $lastQYear--;
            }
            $lqStartMonth = ($lastQ - 1) * 3 + 1;
            $lqEndMonth = $lastQ * 3;
            $where[] = "e.date BETWEEN ? AND ?";
            $params[] = sprintf('%04d-%02d-01', $lastQYear, $lqStartMonth);
            $params[] = date('Y-m-t', strtotime(sprintf('%04d-%02d-01', $lastQYear, $lqEndMonth)));
        } elseif ($period === 'this_year') {
            $where[] = "e.date BETWEEN ? AND ?";
            $params[] = date('Y-01-01');
            $params[] = date('Y-12-31');
        }

        if ($minAmount > 0) {
            $where[] = "e.amount >= ?";
            $params[] = $minAmount;
        }
        if ($maxAmount > 0) {
            $where[] = "e.amount <= ?";
            $params[] = $maxAmount;
        }
        if ($overdueOnly) {
            $where[] = "e.due_date IS NOT NULL AND e.due_date < CURDATE() AND (e.status != 'paid' AND (e.is_refunded = 0 OR e.is_refunded IS NULL))";
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = "(e.title LIKE ? OR e.category LIKE ? OR e.vendor_name LIKE ? OR e.notes LIKE ? OR u.full_name LIKE ?)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        if (file_exists(__DIR__ . '/agent_tools/AgentPoSoFinanceTools.php')) {
            require_once __DIR__ . '/agent_tools/AgentPoSoFinanceTools.php';
            if (class_exists('AgentPoSoFinanceTools') && method_exists('AgentPoSoFinanceTools', 'applyExtendedExpensePoFilters')) {
                AgentPoSoFinanceTools::applyExtendedExpensePoFilters($this->db, 'e.', $_GET, $where, $params, $tid, $uid, $isGlobalAdmin || $isAccountant);
            }
        }

        $sql = "SELECT e.id, e.title, e.category, e.amount, e.vat_amount, e.has_vat_invoice,
                       e.status, e.status_level_1, e.status_level_2, e.status_level_3,
                       e.is_refunded, e.date, e.due_date, e.created_at,
                       e.vendor_name, e.notes,
                       u.full_name as creator_name,
                       app1.full_name as approver_name_1,
                       app2.full_name as approver_name_2,
                       app3.full_name as approver_name_3
                FROM expenses e
                LEFT JOIN users u ON e.created_by = u.id
                LEFT JOIN users app1 ON e.approver_id = app1.id
                LEFT JOIN users app2 ON e.approver_id_2 = app2.id
                LEFT JOIN users app3 ON e.approver_id_3 = app3.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY e.date DESC, e.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $statusLabel = 'Chờ duyệt';
            $isDisbursed = ($r['status'] === 'paid' || $r['status'] === 'refunded' || (int)($r['is_refunded'] ?? 0) === 1);
            if ($isDisbursed) {
                $statusLabel = 'Đã thanh toán / Đã chi';
            } elseif ($r['status'] === 'approved') {
                $statusLabel = 'Đã duyệt (Chờ chi)';
            } elseif ($r['status'] === 'rejected') {
                $statusLabel = 'Từ chối';
            }

            $uncLabel = $isDisbursed ? 'Đã giải ngân (Có UNC)' : ($r['status'] === 'approved' ? 'Chờ kế toán giải ngân' : 'Chưa giải ngân');
            $dateStr = !empty($r['date']) ? date('d/m/Y', strtotime($r['date'])) : (!empty($r['created_at']) ? date('d/m/Y', strtotime($r['created_at'])) : '');
            $dueStr = !empty($r['due_date']) ? date('d/m/Y', strtotime($r['due_date'])) : '';

            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['title'] ?: '',
                $r['category'] ?: 'Chi phí khác',
                number_format((float)($r['amount'] ?? 0), 0, ',', '.'),
                number_format((float)($r['vat_amount'] ?? 0), 0, ',', '.'),
                $statusLabel,
                $uncLabel,
                $dateStr,
                $dueStr,
                $r['creator_name'] ?: '',
                $r['approver_name_1'] ?: '',
                $r['approver_name_2'] ?: '',
                $r['approver_name_3'] ?: '',
                $r['vendor_name'] ?: '',
                trim(preg_replace('/\s+/', ' ', strip_tags((string)($r['notes'] ?? ''))))
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (expense)", 'expense', null, "Exported " . ($stt - 1) . " expenses");
        }
        exit;
    }

    /**
     * Export Deposits / Cash Receipts (SO) with 100% Filter Parity with query_deposits_and_revenue_multitier
     */
    private function exportDeposits(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_phieu_thu_dat_coc_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        $headers = [
            'STT',
            'Mã phiếu',
            'Khách hàng / Học viên',
            'Số điện thoại',
            'Email',
            'Chương trình / Dự án',
            'Mã căn / Mã lớp',
            'Số tiền đặt cọc (VNĐ)',
            'Loại tiền',
            'Trạng thái',
            'Sale phụ trách',
            'Nguồn khách hàng',
            'Tỉnh / Thành phố',
            'Ngày tạo phiếu'
        ];
        fputcsv($output, $headers);

        $programsParam   = trim((string)($_GET['programs'] ?? $_GET['program'] ?? ''));
        $statusesParam   = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $milestoneStatus = strtolower(trim((string)($_GET['milestone_status'] ?? '')));
        $ownersParam     = trim((string)($_GET['owners'] ?? $_GET['sale_id'] ?? $_GET['owner_id'] ?? ''));
        $citiesParam     = trim((string)($_GET['city'] ?? $_GET['branches_or_cities'] ?? ''));
        $sourcesParam    = trim((string)($_GET['source'] ?? $_GET['sources'] ?? ''));
        $unitCodeParam   = trim((string)($_GET['unit_code'] ?? ''));
        $currencyParam   = strtoupper(trim((string)($_GET['currency'] ?? '')));
        $minAmount       = isset($_GET['min_amount']) && is_numeric($_GET['min_amount']) ? (float)$_GET['min_amount'] : 0;
        $maxAmount       = isset($_GET['max_amount']) && is_numeric($_GET['max_amount']) ? (float)$_GET['max_amount'] : 0;
        $period          = strtolower(trim((string)($_GET['period'] ?? '')));
        $fromDate        = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate          = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $search          = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        $where = [
            '(c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?)',
            '(c.id IS NULL OR c.deleted_at IS NULL)'
        ];
        $params = [$tid, $tid, $tid];

        $isFinAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'accountant', 'ke_toan', 'sale_admin', 'saleadmin'], true);
        $isManager  = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$isFinAdmin) {
            if ($isManager) {
                $where[] = "(d.created_by = ? OR c.owner_id = ? OR d.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                array_push($params, $uid, $uid, $uid, $uid);
            } else {
                $where[] = "(d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                array_push($params, $uid, $uid, (string)$uid);
            }
        }

        if ($unitCodeParam !== '') {
            $where[] = "d.unit_code LIKE ?";
            $params[] = '%' . $unitCodeParam . '%';
        }
        if ($currencyParam !== '' && $currencyParam !== 'ALL') {
            $where[] = "COALESCE(d.currency, 'VND') = ?";
            $params[] = $currencyParam;
        }

        if ($programsParam !== '' && $programsParam !== 'all') {
            $progList = array_filter(array_map('trim', explode(',', $programsParam)));
            if (!empty($progList)) {
                $progOrs = [];
                foreach ($progList as $pItem) {
                    $progOrs[] = "(c.program LIKE ? OR p.name LIKE ?)";
                    $params[] = '%' . $pItem . '%';
                    $params[] = '%' . $pItem . '%';
                }
                $where[] = "(" . implode(' OR ', $progOrs) . ")";
            }
        }

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
            if (!empty($stList)) {
                $stOrs = [];
                foreach ($stList as $st) {
                    if ($st === 'active_only') {
                        $stOrs[] = "d.status NOT IN ('cancelled', 'rejected')";
                    } elseif ($st === 'approved' || $st === 'completed') {
                        $stOrs[] = "d.status IN ('approved', 'completed')";
                    } elseif ($st === 'pending' || $st === 'pending_admin') {
                        $stOrs[] = "d.status IN ('pending', 'pending_admin')";
                    } else {
                        $stOrs[] = "d.status = ?";
                        $params[] = $st;
                    }
                }
                if (!empty($stOrs)) {
                    $where[] = "(" . implode(' OR ', $stOrs) . ")";
                }
            }
        }

        if ($milestoneStatus !== '' && $milestoneStatus !== 'all') {
            if ($milestoneStatus === 'overdue') {
                $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date < CURDATE())";
            } elseif ($milestoneStatus === 'due_soon') {
                $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))";
            } elseif ($milestoneStatus === 'waiting_unc_approval') {
                $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status = 'paid')";
            } elseif (in_array($milestoneStatus, ['unpaid', 'pending_approval', 'pending'], true)) {
                $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status IN ('pending', 'pending_approval', 'unpaid'))";
            } elseif (in_array($milestoneStatus, ['fully_paid', 'paid'], true)) {
                $where[] = "(d.status IN ('approved', 'completed') OR (EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id) AND NOT EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status NOT IN ('paid', 'approved', 'completed'))))";
            }
        }

        if ($ownersParam !== '' && $ownersParam !== 'all') {
            $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
            if (!empty($ownList)) {
                $ownOrs = [];
                foreach ($ownList as $own) {
                    if (is_numeric($own)) {
                        $ownOrs[] = "(d.created_by = ? OR c.owner_id = ?)";
                        $params[] = (int)$own;
                        $params[] = (int)$own;
                    } else {
                        $ownOrs[] = "(u.full_name LIKE ? OR u_c.full_name LIKE ?)";
                        $params[] = '%' . $own . '%';
                        $params[] = '%' . $own . '%';
                    }
                }
                $where[] = "(" . implode(' OR ', $ownOrs) . ")";
            }
        }

        if ($citiesParam !== '' && $citiesParam !== 'all') {
            $cityList = array_filter(array_map('trim', explode(',', $citiesParam)));
            if (!empty($cityList)) {
                $cityOrs = [];
                foreach ($cityList as $cItem) {
                    $cityOrs[] = "(c.city LIKE ? OR c.district LIKE ? OR c.address LIKE ?)";
                    $params[] = '%' . $cItem . '%';
                    $params[] = '%' . $cItem . '%';
                    $params[] = '%' . $cItem . '%';
                }
                $where[] = "(" . implode(' OR ', $cityOrs) . ")";
            }
        }

        if ($sourcesParam !== '' && $sourcesParam !== 'all') {
            $srcList = array_filter(array_map('trim', explode(',', $sourcesParam)));
            if (!empty($srcList)) {
                $srcOrs = [];
                foreach ($srcList as $sItem) {
                    $srcOrs[] = "(c.source LIKE ? OR c.utm_source LIKE ?)";
                    $params[] = '%' . $sItem . '%';
                    $params[] = '%' . $sItem . '%';
                }
                $where[] = "(" . implode(' OR ', $srcOrs) . ")";
            }
        }

        if ($minAmount > 0) {
            $where[] = "d.price >= ?";
            $params[] = $minAmount;
        }
        if ($maxAmount > 0) {
            $where[] = "d.price <= ?";
            $params[] = $maxAmount;
        }

        if ($fromDate !== '' && $toDate !== '') {
            $where[] = "d.created_at BETWEEN ? AND ?";
            $params[] = $fromDate . ' 00:00:00';
            $params[] = $toDate . ' 23:59:59';
        } elseif ($fromDate !== '') {
            $where[] = "d.created_at >= ?";
            $params[] = $fromDate . ' 00:00:00';
        } elseif ($toDate !== '') {
            $where[] = "d.created_at <= ?";
            $params[] = $toDate . ' 23:59:59';
        } elseif ($period === 'today') {
            $where[] = "d.created_at >= CURDATE() AND d.created_at <= CONCAT(CURDATE(), ' 23:59:59')";
        } elseif ($period === 'yesterday') {
            $where[] = "d.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND d.created_at < CURDATE()";
        } elseif ($period === 'this_week') {
            $where[] = "d.created_at BETWEEN ? AND ?";
            $params[] = date('Y-m-d 00:00:00', strtotime('monday this week'));
            $params[] = date('Y-m-d 23:59:59', strtotime('sunday this week'));
        } elseif ($period === 'this_month') {
            $where[] = "d.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND d.created_at <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
        } elseif ($period === 'last_month') {
            $where[] = "d.created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND d.created_at <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
        } elseif ($period === 'this_quarter') {
            $curMonth = (int)date('n');
            $qStartMonth = (int)(floor(($curMonth - 1) / 3) * 3 + 1);
            $qEndMonth = $qStartMonth + 2;
            $qYear = (int)date('Y');
            $where[] = "d.created_at BETWEEN ? AND ?";
            $params[] = sprintf('%04d-%02d-01 00:00:00', $qYear, $qStartMonth);
            $params[] = date('Y-m-t 23:59:59', strtotime(sprintf('%04d-%02d-01', $qYear, $qEndMonth)));
        } elseif ($period === 'this_year') {
            $where[] = "d.created_at BETWEEN ? AND ?";
            $params[] = date('Y-01-01 00:00:00');
            $params[] = date('Y-12-31 23:59:59');
        }

        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = "(c.full_name LIKE ? OR c.phone LIKE ? OR p.name LIKE ? OR d.unit_code LIKE ? OR CAST(d.id AS CHAR) LIKE ?)";
            array_push($params, $like, $like, $like, $like, $like);
        }

        if (file_exists(__DIR__ . '/agent_tools/AgentPoSoFinanceTools.php')) {
            require_once __DIR__ . '/agent_tools/AgentPoSoFinanceTools.php';
            if (class_exists('AgentPoSoFinanceTools') && method_exists('AgentPoSoFinanceTools', 'applyExtendedDepositSoFilters')) {
                AgentPoSoFinanceTools::applyExtendedDepositSoFilters($this->db, 'd.', $_GET, $where, $params, $tid, $uid, $isFinAdmin);
            }
        }

        $sql = "SELECT d.id, d.price, d.currency, d.status, d.unit_code, d.created_at,
                       c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
                       c.program as contact_program, c.source as contact_source, c.city as contact_city,
                       p.name as project_name,
                       COALESCE(u.full_name, u_c.full_name, '') as sale_name
                FROM deposits d
                LEFT JOIN contacts c ON d.contact_id = c.id
                LEFT JOIN projects p ON d.project_id = p.id
                LEFT JOIN users u ON COALESCE(d.created_by, c.owner_id) = u.id
                LEFT JOIN users u_c ON c.owner_id = u_c.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY d.created_at DESC, d.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $statusMap = [
            'approved' => 'Đã duyệt / Đã thu',
            'completed' => 'Hoàn tất',
            'pending' => 'Chờ kế toán duyệt',
            'pending_admin' => 'Chờ Admin / Kế toán duyệt',
            'rejected' => 'Từ chối',
            'cancelled' => 'Đã hủy'
        ];

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $stLabel = $statusMap[$r['status'] ?? 'pending'] ?? ($r['status'] ?? 'Chờ duyệt');
            $prog = $r['contact_program'] ?: ($r['project_name'] ?: '');
            $dateStr = !empty($r['created_at']) ? date('d/m/Y H:i', strtotime($r['created_at'])) : '';

            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['customer_name'] ?: '',
                $r['customer_phone'] ?: '',
                $r['customer_email'] ?: '',
                $prog,
                $r['unit_code'] ?: '',
                number_format((float)($r['price'] ?? 0), 0, ',', '.'),
                $r['currency'] ?: 'VND',
                $stLabel,
                $r['sale_name'] ?: '',
                $r['contact_source'] ?: '',
                $r['contact_city'] ?: '',
                $dateStr
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (deposit)", 'deposit', null, "Exported " . ($stt - 1) . " deposits");
        }
        exit;
    }

    /**
     * Export Tasks with 100% Filter Parity with query_tasks_and_projects_multitier
     */
    private function exportTasks(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_cong_viec_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        $headers = [
            'STT',
            'Mã công việc',
            'Tiêu đề công việc',
            'Mô tả',
            'Trạng thái',
            'Mức độ ưu tiên',
            'Người thực hiện',
            'Người giao việc',
            'Đối tượng liên quan',
            'Hạn hoàn thành (Deadline)',
            'Ngày hoàn thành',
            'Ngày tạo'
        ];
        fputcsv($output, $headers);

        $statusesParam    = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $prioritiesParam  = trim((string)($_GET['priority'] ?? $_GET['priorities'] ?? ''));
        $assigneesParam   = trim((string)($_GET['assignees'] ?? $_GET['assigned_to'] ?? $_GET['user_id'] ?? ''));
        $creatorsParam    = trim((string)($_GET['creators'] ?? $_GET['created_by'] ?? ''));
        $departmentsParam = trim((string)($_GET['departments'] ?? $_GET['department'] ?? ''));
        $relatedType      = strtolower(trim((string)($_GET['related_type'] ?? '')));
        $relatedId        = (int)($_GET['related_id'] ?? $_GET['contact_id'] ?? 0);
        $taskGroupId      = (int)($_GET['task_group_id'] ?? 0);
        $teamId           = isset($_GET['team_id']) && $_GET['team_id'] !== '' && $_GET['team_id'] !== 'all' && $_GET['team_id'] !== 'all_teams_bypass' ? (int)$_GET['team_id'] : 0;
        $overdueOnly      = !empty($_GET['overdue_only']) && in_array(strtolower((string)$_GET['overdue_only']), ['1', 'true', 'yes'], true);
        $dateField        = strtolower(trim((string)($_GET['date_field'] ?? 'due_date')));
        $period           = strtolower(trim((string)($_GET['period'] ?? '')));
        $fromDate         = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? $_GET['start_date'] ?? ''));
        $toDate           = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? $_GET['end_date'] ?? ''));
        $search           = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        $where = ['t.tenant_id = ?', 't.deleted_at IS NULL', "t.type = 'task'"];
        $params = [$tid];

        // Exclude tasks hidden by this user
        $where[] = "NOT EXISTS (SELECT 1 FROM task_hidden_users thu WHERE thu.task_id = t.id AND thu.user_id = ?)";
        $params[] = $uid;

        // Always exclude other users' personal tasks
        $where[] = "(NOT (IFNULL(t.tags, '') LIKE '%personal_task%' OR IFNULL(t.tags, '') LIKE '%ca_nhan%') OR t.user_id = ? OR t.created_by = ?)";
        $params[] = $uid;
        $params[] = $uid;

        $isTaskAdmin  = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'sale_admin', 'saleadmin'], true);
        $isManager    = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        $isAdminOrMgr = $isTaskAdmin || $isManager;
        if (!$isTaskAdmin) {
            if ($isManager) {
                $where[] = "(t.user_id = ? OR t.created_by = ? OR t.approver_id = ? OR FIND_IN_SET(?, IFNULL(t.participant_ids, '')) > 0 OR t.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))) OR t.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                array_push($params, $uid, $uid, $uid, (string)$uid, $uid, $uid);
            } else {
                $where[] = "(t.user_id = ? OR t.created_by = ? OR t.approver_id = ? OR FIND_IN_SET(?, IFNULL(t.participant_ids, '')) > 0)";
                array_push($params, $uid, $uid, $uid, (string)$uid);
            }
        }

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
            if (!empty($stList)) {
                $stOrs = [];
                foreach ($stList as $st) {
                    if ($st === 'in_progress') {
                        $stOrs[] = "(t.status = 'in_progress' OR (t.status = 'planned' AND t.progress > 0 AND t.progress < 100))";
                    } elseif (in_array($st, ['planned', 'open', 'open_only', 'not_done', 'active', 'todo'], true)) {
                        $stOrs[] = "(t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL))";
                    } elseif ($st === 'done' || $st === 'completed') {
                        $stOrs[] = "(t.status IN ('done', 'completed') OR t.progress >= 100)";
                    } elseif ($st === 'overdue') {
                        $stOrs[] = "(t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL))";
                    } else {
                        $stOrs[] = "t.status = ?";
                        $params[] = $st;
                    }
                }
                if (!empty($stOrs)) {
                    $where[] = "(" . implode(' OR ', $stOrs) . ")";
                }
            }
        }

        if ($prioritiesParam !== '' && $prioritiesParam !== 'all') {
            $prList = array_filter(array_map('trim', explode(',', strtolower($prioritiesParam))));
            if (!empty($prList)) {
                $placeholders = implode(',', array_fill(0, count($prList), '?'));
                $where[] = "t.priority IN ({$placeholders})";
                foreach ($prList as $pr) {
                    $params[] = $pr;
                }
            }
        }

        if ($assigneesParam !== '' && $assigneesParam !== 'all') {
            $assList = array_filter(array_map('trim', explode(',', $assigneesParam)));
            if (!empty($assList)) {
                $assOrs = [];
                foreach ($assList as $a) {
                    if (is_numeric($a)) {
                        $assOrs[] = "t.user_id = ?";
                        $params[] = (int)$a;
                    } else {
                        $assOrs[] = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u_ass.full_name', $a, $params);
                    }
                }
                $where[] = "(" . implode(' OR ', $assOrs) . ")";
            }
        }

        if ($creatorsParam !== '' && $creatorsParam !== 'all') {
            $crList = array_filter(array_map('trim', explode(',', $creatorsParam)));
            if (!empty($crList)) {
                $crOrs = [];
                foreach ($crList as $cr) {
                    if (is_numeric($cr)) {
                        $crOrs[] = "t.created_by = ?";
                        $params[] = (int)$cr;
                    } else {
                        $crOrs[] = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u_cr.full_name', $cr, $params);
                    }
                }
                $where[] = "(" . implode(' OR ', $crOrs) . ")";
            }
        }

        if ($departmentsParam !== '' && $departmentsParam !== 'all') {
            $deptList = array_filter(array_map('trim', explode(',', $departmentsParam)));
            if (!empty($deptList)) {
                $deptOrs = [];
                foreach ($deptList as $dItem) {
                    $likeD = '%' . $dItem . '%';
                    $deptOrs[] = "(u_ass.department LIKE ? OR u_cr.department LIKE ? OR tm_ass.name LIKE ? OR p.name LIKE ?)";
                    array_push($params, $likeD, $likeD, $likeD, $likeD);
                }
                $where[] = "(" . implode(' OR ', $deptOrs) . ")";
            }
        }

        if ($taskGroupId > 0) {
            $where[] = "t.task_group_id = ?";
            $params[] = $taskGroupId;
        }

        if ($teamId > 0) {
            $where[] = "(t.user_id IN (SELECT id FROM users WHERE team_id = ? AND tenant_id = ?))";
            $params[] = $teamId;
            $params[] = $tid;
        }

        if ($relatedType !== '' && $relatedType !== 'all') {
            $where[] = "t.related_type = ?";
            $params[] = $relatedType;
        }

        if ($relatedId > 0) {
            $where[] = "(t.related_id = ? OR t.contact_id = ?)";
            $params[] = $relatedId;
            $params[] = $relatedId;
        }

        if ($overdueOnly) {
            $where[] = "t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL)";
        }

        $colDateMap = [
            'due_date'     => 't.due_date',
            'created_at'   => 't.created_at',
            'completed_at' => 't.done_at',
            'done_at'      => 't.done_at',
        ];
        $colDate = $colDateMap[$dateField] ?? 't.due_date';
        if ($fromDate !== '' && $toDate !== '') {
            $where[] = "{$colDate} BETWEEN ? AND ?";
            $params[] = $fromDate . ' 00:00:00';
            $params[] = $toDate . ' 23:59:59';
        } elseif ($fromDate !== '') {
            $where[] = "{$colDate} >= ?";
            $params[] = $fromDate . ' 00:00:00';
        } elseif ($toDate !== '') {
            $where[] = "{$colDate} <= ?";
            $params[] = $toDate . ' 23:59:59';
        } elseif ($period === 'today') {
            $where[] = "{$colDate} >= CURDATE() AND {$colDate} <= CONCAT(CURDATE(), ' 23:59:59')";
        } elseif ($period === 'this_week') {
            $where[] = "{$colDate} BETWEEN ? AND ?";
            $params[] = date('Y-m-d 00:00:00', strtotime('monday this week'));
            $params[] = date('Y-m-d 23:59:59', strtotime('sunday this week'));
        } elseif ($period === 'this_month') {
            $where[] = "{$colDate} >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND {$colDate} <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
        } elseif ($period === 'last_month') {
            $where[] = "{$colDate} >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND {$colDate} <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
        }

        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = "(t.subject LIKE ? OR t.body LIKE ? OR u_ass.full_name LIKE ? OR p.name LIKE ? OR c.full_name LIKE ?)";
            array_push($params, $like, $like, $like, $like, $like);
        }

        if (file_exists(__DIR__ . '/agent_tools/AgentTaskProjectTools.php')) {
            require_once __DIR__ . '/agent_tools/AgentTaskProjectTools.php';
            if (class_exists('AgentTaskProjectTools') && method_exists('AgentTaskProjectTools', 'applyExtendedTaskMultiTierFilters')) {
                AgentTaskProjectTools::applyExtendedTaskMultiTierFilters($this->db, 't.', $_GET, $where, $params, $tid, $uid, $isAdminOrMgr);
            }
        }

        $sql = "SELECT t.id, t.subject as title, t.body as description, t.status, t.priority, t.progress, t.due_date, t.done_at as completed_at, t.created_at,
                       COALESCE(u_ass.full_name, 'Chưa phân công') as assignee_name,
                       COALESCE(u_cr.full_name, 'Hệ thống') as creator_name,
                       COALESCE(p.name, c.full_name, '') as related_name
                FROM activities t
                LEFT JOIN users u_ass ON t.user_id = u_ass.id
                LEFT JOIN teams tm_ass ON u_ass.team_id = tm_ass.id
                LEFT JOIN users u_cr ON t.created_by = u_cr.id
                LEFT JOIN projects p ON (t.related_type = 'project' AND t.related_id = p.id)
                LEFT JOIN contacts c ON ((t.related_type IN ('contact', 'lead') AND t.related_id = c.id) OR t.contact_id = c.id) AND c.deleted_at IS NULL
                WHERE " . implode(' AND ', $where) . "
                ORDER BY t.due_date ASC, t.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $dueStr = !empty($r['due_date']) ? date('d/m/Y H:i', strtotime($r['due_date'])) : '';
            $compStr = !empty($r['completed_at']) ? date('d/m/Y H:i', strtotime($r['completed_at'])) : '';
            $createdStr = !empty($r['created_at']) ? date('d/m/Y H:i', strtotime($r['created_at'])) : '';

            $rawDesc = (string)($r['description'] ?? '');
            $cleanDesc = $rawDesc;
            if (str_starts_with(trim($rawDesc), '{')) {
                $json = json_decode(trim($rawDesc), true);
                if (is_array($json) && isset($json['erp_task']) && is_array($json['erp_task'])) {
                    $cleanDesc = (string)($json['erp_task']['description'] ?? '');
                    if (!empty($json['erp_task']['checklist']) && is_array($json['erp_task']['checklist'])) {
                        $clList = $json['erp_task']['checklist'];
                        $totalCl = count($clList);
                        if ($totalCl > 0) {
                            $doneCl = 0;
                            foreach ($clList as $clItem) {
                                if (is_array($clItem) && (!empty($clItem['checked']) || !empty($clItem['done']) || !empty($clItem['completed']) || (($clItem['status'] ?? '') === 'done'))) {
                                    $doneCl++;
                                }
                            }
                            $cleanDesc .= " [Checklist: {$doneCl}/{$totalCl} hoàn thành]";
                        }
                    }
                }
            }
            $cleanDesc = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($cleanDesc), ENT_QUOTES | ENT_HTML5, 'UTF-8')));

            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['title'] ?: '',
                $cleanDesc,
                $r['status'] ?: 'todo',
                $r['priority'] ?: 'medium',
                $r['assignee_name'],
                $r['creator_name'],
                $r['related_name'],
                $dueStr,
                $compStr,
                $createdStr
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (task)", 'task', null, "Exported " . ($stt - 1) . " tasks");
        }
        exit;
    }

    /**
     * Export Tickets & SLA with 100% Filter Parity with query_tickets_and_sla_multitier
     */
    private function exportTickets(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_ticket_sla_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã Ticket',
            'Tiêu đề sự vụ',
            'Danh mục',
            'Mức độ ưu tiên',
            'Trạng thái',
            'Cảnh báo SLA (>48h)',
            'Khách hàng / Học viên',
            'Người xử lý',
            'Người tạo',
            'Ngày tạo'
        ]);

        $statusesParam   = strtolower(trim((string)($_GET['status'] ?? $_GET['statuses'] ?? '')));
        $prioritiesParam = strtolower(trim((string)($_GET['priority'] ?? $_GET['priorities'] ?? '')));
        $categoriesParam = trim((string)($_GET['category'] ?? $_GET['categories'] ?? ''));
        $assigneesParam  = trim((string)($_GET['assignees'] ?? $_GET['assignee_id'] ?? ''));
        $creatorsParam   = trim((string)($_GET['creators'] ?? $_GET['created_by'] ?? ''));
        $period          = strtolower(trim((string)($_GET['period'] ?? '')));
        $fromDate        = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate          = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $search          = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        $where = ['t.tenant_id = ?'];
        $params = [$tid];

        $isTicketAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'academic', 'hoc_vu', 'hoc_thuat', 'sale_admin', 'saleadmin', 'hr'], true);
        $isManager     = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$isTicketAdmin) {
            if ($isManager) {
                $where[] = "(t.assignee_id = ? OR t.created_by = ? OR t.assignee_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                array_push($params, $uid, $uid, $uid);
            } else {
                $where[] = "(t.assignee_id = ? OR t.created_by = ?)";
                array_push($params, $uid, $uid);
            }
        }

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', $statusesParam)));
            if (!empty($stList)) {
                $stOrs = [];
                foreach ($stList as $st) {
                    if ($st === 'overdue_sla') {
                        $stOrs[] = "(t.status NOT IN ('resolved', 'closed') AND t.created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR))";
                    } else {
                        $stOrs[] = "t.status = ?";
                        $params[] = $st;
                    }
                }
                $where[] = "(" . implode(' OR ', $stOrs) . ")";
            }
        }

        if ($prioritiesParam !== '' && $prioritiesParam !== 'all') {
            $prList = array_filter(array_map('trim', explode(',', $prioritiesParam)));
            if (!empty($prList)) {
                $ph = implode(',', array_fill(0, count($prList), '?'));
                $where[] = "t.priority IN ({$ph})";
                foreach ($prList as $pr) $params[] = $pr;
            }
        }

        if ($categoriesParam !== '' && $categoriesParam !== 'all') {
            $catList = array_filter(array_map('trim', explode(',', $categoriesParam)));
            if (!empty($catList)) {
                $catOrs = [];
                foreach ($catList as $cItem) {
                    $catOrs[] = "t.category LIKE ?";
                    $params[] = '%' . $cItem . '%';
                }
                $where[] = "(" . implode(' OR ', $catOrs) . ")";
            }
        }

        if ($assigneesParam !== '' && $assigneesParam !== 'all') {
            $assList = array_filter(array_map('trim', explode(',', $assigneesParam)));
            if (!empty($assList)) {
                $assOrs = [];
                foreach ($assList as $a) {
                    if (is_numeric($a)) {
                        $assOrs[] = "t.assignee_id = ?";
                        $params[] = (int)$a;
                    } else {
                        $assOrs[] = "u_ass.full_name LIKE ?";
                        $params[] = '%' . $a . '%';
                    }
                }
                $where[] = "(" . implode(' OR ', $assOrs) . ")";
            }
        }

        if ($creatorsParam !== '' && $creatorsParam !== 'all') {
            $crList = array_filter(array_map('trim', explode(',', $creatorsParam)));
            if (!empty($crList)) {
                $crOrs = [];
                foreach ($crList as $cr) {
                    if (is_numeric($cr)) {
                        $crOrs[] = "t.created_by = ?";
                        $params[] = (int)$cr;
                    } else {
                        $crOrs[] = "u_cr.full_name LIKE ?";
                        $params[] = '%' . $cr . '%';
                    }
                }
                $where[] = "(" . implode(' OR ', $crOrs) . ")";
            }
        }

        if ($fromDate !== '' && $toDate !== '') {
            $where[] = "t.created_at BETWEEN ? AND ?";
            $params[] = $fromDate . ' 00:00:00';
            $params[] = $toDate . ' 23:59:59';
        } elseif ($fromDate !== '') {
            $where[] = "t.created_at >= ?";
            $params[] = $fromDate . ' 00:00:00';
        } elseif ($toDate !== '') {
            $where[] = "t.created_at <= ?";
            $params[] = $toDate . ' 23:59:59';
        } elseif ($period === 'today') {
            $where[] = "t.created_at >= CURDATE() AND t.created_at <= CONCAT(CURDATE(), ' 23:59:59')";
        } elseif ($period === 'this_week') {
            $where[] = "t.created_at BETWEEN ? AND ?";
            $params[] = date('Y-m-d 00:00:00', strtotime('monday this week'));
            $params[] = date('Y-m-d 23:59:59', strtotime('sunday this week'));
        } elseif ($period === 'this_month') {
            $where[] = "t.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND t.created_at <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
        } elseif ($period === 'last_month') {
            $where[] = "t.created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND t.created_at <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
        }

        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = "(t.subject LIKE ? OR t.description LIKE ? OR t.customer_name LIKE ? OR u_ass.full_name LIKE ?)";
            array_push($params, $like, $like, $like, $like);
        }

        $sql = "SELECT t.id, t.subject, t.category, t.priority, t.status, t.customer_name, t.created_at,
                       COALESCE(u_ass.full_name, 'Chưa phân công') as assignee_name,
                       COALESCE(u_cr.full_name, 'Hệ thống') as creator_name
                FROM tickets t
                LEFT JOIN users u_ass ON t.assignee_id = u_ass.id
                LEFT JOIN users u_cr ON t.created_by = u_cr.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY t.created_at DESC, t.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $ageHours = !empty($r['created_at']) ? round((time() - strtotime($r['created_at'])) / 3600, 1) : 0;
            $slaBreach = !in_array($r['status'], ['resolved', 'closed'], true) && $ageHours > 48;
            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['subject'] ?: '',
                $r['category'] ?: 'Chung',
                $r['priority'] ?: 'medium',
                $r['status'] ?: 'open',
                $slaBreach ? 'Quá hạn SLA' : 'Đúng hạn',
                $r['customer_name'] ?: 'Nội bộ',
                $r['assignee_name'],
                $r['creator_name'],
                !empty($r['created_at']) ? date('d/m/Y H:i', strtotime($r['created_at'])) : ''
            ]);
        }

        fclose($output);
        exit;
    }

    /**
     * Export HRM Staff & Payroll with 100% Filter Parity with query_hrm_workforce_and_payroll_multitier
     */
    private function exportStaff(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_nhan_su_hrm_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã NV',
            'Họ và tên',
            'Chức danh',
            'Vai trò',
            'Phòng ban / Đội nhóm',
            'Số điện thoại',
            'Email',
            'Ngày vào làm',
            'Trạng thái BHXH',
            'Quỹ phép năm còn lại',
            'Quỹ nghỉ bù còn lại',
            'Số phút đi trễ',
            'Định mức trễ cho phép (60p Nữ / 30p Nam)',
            'Lương cơ bản (VNĐ)',
            'Lương thỏa thuận (Deal)',
            'Lương thực lĩnh kỳ này (VNĐ)',
            'Trạng thái phiếu lương',
            'Trạng thái làm việc'
        ]);

        $departmentsParam = trim((string)($_GET['departments'] ?? $_GET['department'] ?? ''));
        $rolesParam       = trim((string)($_GET['role'] ?? $_GET['roles'] ?? ''));
        $statusParam      = strtolower(trim((string)($_GET['status'] ?? 'active')));
        $hasInsurance     = strtolower(trim((string)($_GET['has_insurance'] ?? 'all')));
        $monthYear        = trim((string)($_GET['month_year'] ?? date('Y-m')));
        $search           = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        $where = [
            'u.tenant_id = ?',
            "u.role NOT IN ('superadmin', 'super_admin', 'bot', 'system')",
            'u.id != 9000001'
        ];
        $params = [$monthYear, $tid];

        $canViewFullHrm = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'nhan_su', 'accountant', 'ke_toan'], true);
        $isManager      = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$canViewFullHrm) {
            if ($isManager) {
                $where[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))))";
                array_push($params, $uid, $uid);
            } else {
                $where[] = "u.id = ?";
                $params[] = $uid;
            }
        }

        if ($statusParam === 'active') {
            $where[] = "COALESCE(u.is_active, 1) = 1";
        } elseif ($statusParam === 'inactive') {
            $where[] = "COALESCE(u.is_active, 1) = 0";
        }

        if ($departmentsParam !== '' && $departmentsParam !== 'all') {
            $dList = array_filter(array_map('trim', explode(',', $departmentsParam)));
            if (!empty($dList)) {
                $dOrs = [];
                foreach ($dList as $dItem) {
                    $likeD = '%' . $dItem . '%';
                    $dOrs[] = "(u.department LIKE ? OR tm.name LIKE ? OR tm.branch LIKE ?)";
                    array_push($params, $likeD, $likeD, $likeD);
                }
                $where[] = "(" . implode(' OR ', $dOrs) . ")";
            }
        }

        if ($rolesParam !== '' && $rolesParam !== 'all') {
            $rList = array_filter(array_map('trim', explode(',', $rolesParam)));
            if (!empty($rList)) {
                $rOrs = [];
                foreach ($rList as $rItem) {
                    $likeR = '%' . $rItem . '%';
                    $rOrs[] = "(u.role LIKE ? OR u.job_title LIKE ?)";
                    array_push($params, $likeR, $likeR);
                }
                $where[] = "(" . implode(' OR ', $rOrs) . ")";
            }
        }

        if ($hasInsurance === 'yes' || $hasInsurance === '1' || $hasInsurance === 'true') {
            $where[] = "hp.has_insurance = 1";
        } elseif ($hasInsurance === 'no' || $hasInsurance === '0' || $hasInsurance === 'false') {
            $where[] = "COALESCE(hp.has_insurance, 0) = 0";
        }

        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = "(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.job_title LIKE ?)";
            array_push($params, $like, $like, $like, $like);
        }

        if (file_exists(__DIR__ . '/agent_tools/AgentHrmAttendanceTools.php')) {
            require_once __DIR__ . '/agent_tools/AgentHrmAttendanceTools.php';
            if (class_exists('AgentHrmAttendanceTools') && method_exists('AgentHrmAttendanceTools', 'applyExtendedHrmMultiTierFilters')) {
                AgentHrmAttendanceTools::applyExtendedHrmMultiTierFilters($this->db, $_GET, $where, $params, $tid, $uid, $canViewFullHrm);
            }
        }

        $sql = "SELECT u.id, u.full_name, u.email, u.phone, u.gender, u.role, u.job_title, u.department, COALESCE(u.is_active, 1) as is_active,
                       COALESCE(tm.name, '') as team_name,
                       hp.joined_date, hp.base_salary, hp.deal_salary, hp.has_insurance,
                       hp.annual_leave_total, hp.annual_leave_used,
                       hp.compensatory_leave_total, hp.compensatory_leave_used,
                       mp.net_salary, mp.lateness_minutes, mp.status as payslip_status
                FROM users u
                LEFT JOIN hrm_profiles hp ON hp.user_id = u.id
                LEFT JOIN teams tm ON u.team_id = tm.id
                LEFT JOIN monthly_payslips mp ON (mp.user_id = u.id AND mp.tenant_id = u.tenant_id AND mp.month_year = ?)
                WHERE " . implode(' AND ', $where) . "
                ORDER BY u.id ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $sid = (int)$r['id'];
            $canSeeSalary = $canViewFullHrm || $sid === $uid;
            $dept = $r['department'] ?: ($r['team_name'] ?: '');
            $leaveRem = max(0, (float)($r['annual_leave_total'] ?? 12) - (float)($r['annual_leave_used'] ?? 0));
            $compLeaveRem = max(0, (float)($r['compensatory_leave_total'] ?? 0) - (float)($r['compensatory_leave_used'] ?? 0));
            $latenessMins = (int)($r['lateness_minutes'] ?? 0);
            $genderNorm = strtolower(trim((string)($r['gender'] ?? '')));
            $isFemale = in_array($genderNorm, ['female', 'nu', 'nữ', 'f'], true);
            $latenessQuotaLabel = $isFemale ? '60 phút (Nữ)' : '30 phút (Nam)';

            $psStatusRaw = strtolower((string)($r['payslip_status'] ?? ''));
            $psStatusLabel = 'Chưa chốt';
            if ($psStatusRaw === 'confirmed' || $psStatusRaw === 'paid') {
                $psStatusLabel = 'Đã xác nhận';
            } elseif ($psStatusRaw === 'sent' || $psStatusRaw === 'published') {
                $psStatusLabel = 'Đã gửi (Chờ xác nhận)';
            } elseif ($psStatusRaw !== '') {
                $psStatusLabel = $r['payslip_status'];
            }

            fputcsv($output, [
                $stt++,
                '#' . $sid,
                $r['full_name'] ?: '',
                $r['job_title'] ?: '',
                $r['role'] ?: '',
                $dept,
                $r['phone'] ?: '',
                $r['email'] ?: '',
                $r['joined_date'] ?: '',
                !empty($r['has_insurance']) ? 'Có BHXH' : 'Chưa đóng',
                $leaveRem,
                $compLeaveRem,
                $latenessMins,
                $latenessQuotaLabel,
                $canSeeSalary ? number_format((float)($r['base_salary'] ?? 0), 0, ',', '.') : 'Bảo mật',
                $canSeeSalary ? number_format((float)($r['deal_salary'] ?? 0), 0, ',', '.') : 'Bảo mật',
                $canSeeSalary && $r['net_salary'] !== null ? number_format((float)$r['net_salary'], 0, ',', '.') : ($canSeeSalary ? 'Chưa chốt' : 'Bảo mật'),
                $psStatusLabel,
                (int)($r['is_active'] ?? 1) === 1 ? 'Đang làm việc' : 'Ngừng hoạt động'
            ]);
        }

        fclose($output);
        exit;
    }

    /**
     * Export HRM Allocated Assets with 100% Filter Parity
     */
    private function exportAssets(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_tai_san_cap_phat_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã ID',
            'Mã tài sản',
            'Tên tài sản / Thiết bị',
            'Nhân sự đang giữ',
            'Ngày bàn giao'
        ]);

        $search = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));
        $where = ['a.tenant_id = ?'];
        $params = [$tid];

        $canViewAllAssets = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'nhan_su', 'accountant', 'ke_toan', 'manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$canViewAllAssets) {
            $where[] = 'a.user_id = ?';
            $params[] = $uid;
        }

        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = "(a.asset_name LIKE ? OR a.asset_code LIKE ? OR u.full_name LIKE ?)";
            array_push($params, $like, $like, $like);
        }

        $stmt = $this->db->prepare("
            SELECT a.id, a.asset_code, a.asset_name, a.given_date,
                   COALESCE(u.full_name, 'Chưa bàn giao') as holder_name
            FROM hrm_assets a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY a.id DESC
        ");
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['asset_code'] ?: '',
                $r['asset_name'] ?: '',
                $r['holder_name'],
                $r['given_date'] ?: ''
            ]);
        }

        fclose($output);
        exit;
    }

    /**
     * Export Purchase Orders (PO) with 100% Filter & RBAC Parity
     */
    private function exportPurchaseOrders(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_don_mua_hang_po_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã PO',
            'Nhà cung cấp',
            'Ngày đặt',
            'Ngày giao dự kiến',
            'Tổng tiền (VNĐ)',
            'Trạng thái',
            'Duyệt Cấp 1',
            'Duyệt Cấp 2',
            'Duyệt Cấp 3',
            'Trạng thái thanh toán',
            'Người tạo',
            'Ghi chú'
        ]);

        $where = ['po.tenant_id = ?'];
        $params = [$tid];

        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo'], true);
        $isAccountant  = in_array($role, ['accountant', 'ke_toan'], true);
        $isManager     = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);

        if (!$isGlobalAdmin && !$isAccountant) {
            if ($isManager) {
                $where[] = "(po.created_by = ? OR po.approver_id = ? OR po.approver_id_2 = ? OR po.approver_id_3 = ? OR po.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                array_push($params, $uid, $uid, $uid, $uid, $uid);
            } else {
                $where[] = "(po.created_by = ? OR po.approver_id = ? OR po.approver_id_2 = ? OR po.approver_id_3 = ?)";
                array_push($params, $uid, $uid, $uid, $uid);
            }
        }

        $statusesParam = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $supplierId    = isset($_GET['supplier_id']) && is_numeric($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : 0;
        $vendorName    = trim((string)($_GET['vendor_name'] ?? $_GET['supplier_name'] ?? ''));
        $fromDate      = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate        = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $minAmount     = isset($_GET['min_amount']) && is_numeric($_GET['min_amount']) ? (float)$_GET['min_amount'] : 0;
        $maxAmount     = isset($_GET['max_amount']) && is_numeric($_GET['max_amount']) ? (float)$_GET['max_amount'] : 0;
        $search        = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
            if (!empty($stList)) {
                $ph = implode(',', array_fill(0, count($stList), '?'));
                $where[] = "po.status IN ({$ph})";
                foreach ($stList as $st) {
                    $params[] = $st;
                }
            }
        }
        if ($supplierId > 0) {
            $where[] = 'po.supplier_id = ?';
            $params[] = $supplierId;
        }
        if ($vendorName !== '') {
            $where[] = 's.name LIKE ?';
            $params[] = '%' . $vendorName . '%';
        }
        if ($fromDate !== '' && $toDate !== '') {
            $where[] = 'po.order_date BETWEEN ? AND ?';
            $params[] = $fromDate;
            $params[] = $toDate;
        } elseif ($fromDate !== '') {
            $where[] = 'po.order_date >= ?';
            $params[] = $fromDate;
        } elseif ($toDate !== '') {
            $where[] = 'po.order_date <= ?';
            $params[] = $toDate;
        }
        if ($minAmount > 0) {
            $where[] = 'po.total >= ?';
            $params[] = $minAmount;
        }
        if ($maxAmount > 0) {
            $where[] = 'po.total <= ?';
            $params[] = $maxAmount;
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = '(po.order_number LIKE ? OR s.name LIKE ? OR po.notes LIKE ? OR u.full_name LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $sql = "SELECT po.id, po.order_number, po.order_date, po.expected_delivery_date,
                       po.total, po.status, po.status_level_1, po.status_level_2, po.status_level_3,
                       po.payment_status, po.notes,
                       COALESCE(s.name, '') as supplier_name,
                       COALESCE(u.full_name, '') as creator_name,
                       COALESCE(app1.full_name, '') as approver_name_1,
                       COALESCE(app2.full_name, '') as approver_name_2,
                       COALESCE(app3.full_name, '') as approver_name_3
                FROM purchase_orders po
                LEFT JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN users u ON po.created_by = u.id
                LEFT JOIN users app1 ON po.approver_id = app1.id
                LEFT JOIN users app2 ON po.approver_id_2 = app2.id
                LEFT JOIN users app3 ON po.approver_id_3 = app3.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY po.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $l1 = ($r['approver_name_1'] ?: 'Cấp 1') . (!empty($r['status_level_1']) ? ' (' . $r['status_level_1'] . ')' : '');
            $l2 = ($r['approver_name_2'] ?: '') !== '' ? $r['approver_name_2'] . (!empty($r['status_level_2']) ? ' (' . $r['status_level_2'] . ')' : '') : '';
            $l3 = ($r['approver_name_3'] ?: '') !== '' ? $r['approver_name_3'] . (!empty($r['status_level_3']) ? ' (' . $r['status_level_3'] . ')' : '') : '';

            fputcsv($output, [
                $stt++,
                $r['order_number'] ?: ('PO-' . $r['id']),
                $r['supplier_name'],
                $r['order_date'] ?: '',
                $r['expected_delivery_date'] ?: '',
                number_format((float)($r['total'] ?? 0), 0, ',', '.'),
                $r['status'] ?: 'draft',
                $l1,
                $l2,
                $l3,
                $r['payment_status'] ?: 'unpaid',
                $r['creator_name'],
                trim(preg_replace('/\s+/', ' ', strip_tags((string)($r['notes'] ?? ''))))
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (purchase_order)", 'purchase_order', null, "Exported " . ($stt - 1) . " purchase orders");
        }
        exit;
    }

    /**
     * Export Sales Orders (SO) with 100% Filter & RBAC Parity
     */
    private function exportSalesOrders(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_don_dat_hang_so_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã SO',
            'Khách hàng / Học viên',
            'Số điện thoại',
            'Công ty',
            'Ngày đặt',
            'Tổng tiền (VNĐ)',
            'Trạng thái',
            'Trạng thái thanh toán',
            'Người tạo',
            'Ghi chú'
        ]);

        $where = ['so.tenant_id = ?'];
        $params = [$tid];

        $isFinAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'accountant', 'ke_toan', 'sale_admin', 'saleadmin'], true);
        $isManager  = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$isFinAdmin) {
            if ($isManager) {
                $where[] = "(so.created_by = ? OR c.owner_id = ? OR so.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                array_push($params, $uid, $uid, $uid, $uid);
            } else {
                $where[] = "(so.created_by = ? OR c.owner_id = ?)";
                array_push($params, $uid, $uid);
            }
        }

        $statusesParam  = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $paymentStatus  = trim((string)($_GET['payment_status'] ?? ''));
        $contactId      = isset($_GET['contact_id']) && is_numeric($_GET['contact_id']) ? (int)$_GET['contact_id'] : 0;
        $fromDate       = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate         = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $minAmount      = isset($_GET['min_amount']) && is_numeric($_GET['min_amount']) ? (float)$_GET['min_amount'] : 0;
        $maxAmount      = isset($_GET['max_amount']) && is_numeric($_GET['max_amount']) ? (float)$_GET['max_amount'] : 0;
        $search         = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
            if (!empty($stList)) {
                $ph = implode(',', array_fill(0, count($stList), '?'));
                $where[] = "so.status IN ({$ph})";
                foreach ($stList as $st) {
                    $params[] = $st;
                }
            }
        }
        if ($paymentStatus !== '' && $paymentStatus !== 'all') {
            $where[] = 'so.payment_status = ?';
            $params[] = $paymentStatus;
        }
        if ($contactId > 0) {
            $where[] = 'so.contact_id = ?';
            $params[] = $contactId;
        }
        if ($fromDate !== '' && $toDate !== '') {
            $where[] = 'so.order_date BETWEEN ? AND ?';
            $params[] = $fromDate;
            $params[] = $toDate;
        } elseif ($fromDate !== '') {
            $where[] = 'so.order_date >= ?';
            $params[] = $fromDate;
        } elseif ($toDate !== '') {
            $where[] = 'so.order_date <= ?';
            $params[] = $toDate;
        }
        if ($minAmount > 0) {
            $where[] = 'so.total >= ?';
            $params[] = $minAmount;
        }
        if ($maxAmount > 0) {
            $where[] = 'so.total <= ?';
            $params[] = $maxAmount;
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = '(so.order_number LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR comp.name LIKE ? OR so.notes LIKE ?)';
            array_push($params, $like, $like, $like, $like, $like);
        }

        $sql = "SELECT so.id, so.order_number, so.order_date, so.total, so.status, so.payment_status, so.notes,
                       COALESCE(c.full_name, '') as customer_name,
                       COALESCE(c.phone, '') as customer_phone,
                       COALESCE(comp.name, '') as company_name,
                       COALESCE(u.full_name, '') as creator_name
                FROM sales_orders so
                LEFT JOIN contacts c ON so.contact_id = c.id
                LEFT JOIN companies comp ON so.company_id = comp.id
                LEFT JOIN users u ON so.created_by = u.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY so.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $stt++,
                $r['order_number'] ?: ('SO-' . $r['id']),
                $r['customer_name'],
                $r['customer_phone'],
                $r['company_name'],
                $r['order_date'] ?: '',
                number_format((float)($r['total'] ?? 0), 0, ',', '.'),
                $r['status'] ?: 'draft',
                $r['payment_status'] ?: 'unpaid',
                $r['creator_name'],
                trim(preg_replace('/\s+/', ' ', strip_tags((string)($r['notes'] ?? ''))))
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (sales_order)", 'sales_order', null, "Exported " . ($stt - 1) . " sales orders");
        }
        exit;
    }

    /**
     * Export Invoices with 100% Filter & RBAC Parity
     */
    private function exportInvoices(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_hoa_don_invoices_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Số hóa đơn',
            'Khách hàng / Học viên',
            'Công ty',
            'Ngày phát hành',
            'Hạn thanh toán',
            'Tổng tiền',
            'Loại tiền',
            'Trạng thái',
            'Người tạo',
            'Ghi chú'
        ]);

        $where = ['i.tenant_id = ?', 'i.deleted_at IS NULL'];
        $params = [$tid];

        $isFinAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'accountant', 'ke_toan', 'sale_admin', 'saleadmin', 'manager', 'truong_phong', 'leader'], true);
        if (!$isFinAdmin) {
            $where[] = '(i.created_by = ? OR ct.owner_id = ?)';
            array_push($params, $uid, $uid);
        }

        $statusesParam = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $fromDate      = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate        = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $overdueOnly   = !empty($_GET['overdue_only']) && in_array(strtolower((string)$_GET['overdue_only']), ['1', 'true', 'yes'], true);
        $search        = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
            if (!empty($stList)) {
                $ph = implode(',', array_fill(0, count($stList), '?'));
                $where[] = "i.status IN ({$ph})";
                foreach ($stList as $st) {
                    $params[] = $st;
                }
            }
        }
        if ($fromDate !== '' && $toDate !== '') {
            $where[] = 'i.issue_date BETWEEN ? AND ?';
            $params[] = $fromDate;
            $params[] = $toDate;
        } elseif ($fromDate !== '') {
            $where[] = 'i.issue_date >= ?';
            $params[] = $fromDate;
        } elseif ($toDate !== '') {
            $where[] = 'i.issue_date <= ?';
            $params[] = $toDate;
        }
        if ($overdueOnly) {
            $where[] = "i.due_date IS NOT NULL AND i.due_date < CURDATE() AND i.status NOT IN ('paid', 'cancelled')";
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = '(i.invoice_number LIKE ? OR ct.full_name LIKE ? OR c.name LIKE ? OR i.notes LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $sql = "SELECT i.id, i.invoice_number, i.issue_date, i.due_date, i.total, i.currency, i.status, i.notes,
                       COALESCE(ct.full_name, '') as contact_name,
                       COALESCE(c.name, '') as company_name,
                       COALESCE(u.full_name, '') as creator_name
                FROM invoices i
                LEFT JOIN companies c ON i.company_id = c.id
                LEFT JOIN contacts ct ON i.contact_id = ct.id
                LEFT JOIN users u ON i.created_by = u.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY i.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $stt++,
                $r['invoice_number'] ?: ('INV-' . $r['id']),
                $r['contact_name'],
                $r['company_name'],
                $r['issue_date'] ?: '',
                $r['due_date'] ?: '',
                number_format((float)($r['total'] ?? 0), 0, ',', '.'),
                $r['currency'] ?: 'VND',
                $r['status'] ?: 'draft',
                $r['creator_name'],
                trim(preg_replace('/\s+/', ' ', strip_tags((string)($r['notes'] ?? ''))))
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (invoice)", 'invoice', null, "Exported " . ($stt - 1) . " invoices");
        }
        exit;
    }

    /**
     * Export Quotes with 100% Filter & RBAC Parity
     */
    private function exportQuotes(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_bao_gia_quotes_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã báo giá',
            'Tiêu đề',
            'Khách hàng',
            'Số điện thoại',
            'Tổng tiền (VNĐ)',
            'Hiệu lực đến',
            'Trạng thái',
            'Người tạo',
            'Ngày tạo'
        ]);

        $where = ['q.tenant_id = ?'];
        $params = [$tid];

        $isAdminOrMgr = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'accountant', 'ke_toan', 'sale_admin', 'saleadmin', 'manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$isAdminOrMgr) {
            $where[] = '(q.created_by = ? OR c.owner_id = ?)';
            array_push($params, $uid, $uid);
        }

        $statusesParam = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $fromDate      = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toDate        = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $search        = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        if ($statusesParam !== '' && $statusesParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
            if (!empty($stList)) {
                $ph = implode(',', array_fill(0, count($stList), '?'));
                $where[] = "q.status IN ({$ph})";
                foreach ($stList as $st) {
                    $params[] = $st;
                }
            }
        }
        if ($fromDate !== '' && $toDate !== '') {
            $where[] = 'q.created_at BETWEEN ? AND ?';
            $params[] = $fromDate . ' 00:00:00';
            $params[] = $toDate . ' 23:59:59';
        } elseif ($fromDate !== '') {
            $where[] = 'q.created_at >= ?';
            $params[] = $fromDate . ' 00:00:00';
        } elseif ($toDate !== '') {
            $where[] = 'q.created_at <= ?';
            $params[] = $toDate . ' 23:59:59';
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = '(q.title LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR u.full_name LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $sql = "SELECT q.id, q.title, q.total, q.valid_until, q.status, q.created_at,
                       COALESCE(c.full_name, '') as customer_name,
                       COALESCE(c.phone, '') as customer_phone,
                       COALESCE(u.full_name, '') as creator_name
                FROM quotes q
                LEFT JOIN contacts c ON q.contact_id = c.id
                LEFT JOIN users u ON q.created_by = u.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY q.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['title'] ?: '',
                $r['customer_name'],
                $r['customer_phone'],
                number_format((float)($r['total'] ?? 0), 0, ',', '.'),
                $r['valid_until'] ?: '',
                $r['status'] ?: 'draft',
                $r['creator_name'],
                !empty($r['created_at']) ? date('d/m/Y H:i', strtotime($r['created_at'])) : ''
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (quote)", 'quote', null, "Exported " . ($stt - 1) . " quotes");
        }
        exit;
    }

    /**
     * Export Suppliers with 100% Filter Parity
     */
    private function exportSuppliers(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_nha_cung_cap_suppliers_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã NCC',
            'Tên nhà cung cấp',
            'Người liên hệ',
            'Số điện thoại',
            'Email',
            'Mã số thuế',
            'Danh mục',
            'Ngân hàng',
            'Số tài khoản',
            'Chủ tài khoản',
            'Trạng thái'
        ]);

        $where = ['s.tenant_id = ?', 's.deleted_at IS NULL'];
        $params = [$tid];

        $statusParam   = trim((string)($_GET['status'] ?? ''));
        $categoryParam = trim((string)($_GET['category'] ?? ''));
        $search        = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        if ($statusParam !== '' && $statusParam !== 'all') {
            $where[] = 's.status = ?';
            $params[] = $statusParam;
        }
        if ($categoryParam !== '' && $categoryParam !== 'all') {
            $where[] = 's.category LIKE ?';
            $params[] = '%' . $categoryParam . '%';
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = '(s.name LIKE ? OR s.code LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.tax_code LIKE ?)';
            array_push($params, $like, $like, $like, $like, $like);
        }

        $sql = "SELECT s.id, s.code, s.name, s.contact_person, s.phone, s.email, s.tax_code,
                       s.category, s.bank_name, s.bank_account, s.bank_holder, s.status
                FROM suppliers s
                WHERE " . implode(' AND ', $where) . "
                ORDER BY s.name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $stt++,
                $r['code'] ?: ('NCC-' . $r['id']),
                $r['name'] ?: '',
                $r['contact_person'] ?: '',
                $r['phone'] ?: '',
                $r['email'] ?: '',
                $r['tax_code'] ?: '',
                $r['category'] ?: '',
                $r['bank_name'] ?: '',
                $r['bank_account'] ?: '',
                $r['bank_holder'] ?: '',
                $r['status'] ?: 'active'
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (supplier)", 'supplier', null, "Exported " . ($stt - 1) . " suppliers");
        }
        exit;
    }

    /**
     * Export HRM Salary Advances with 100% Filter & RBAC Parity
     */
    private function exportSalaryAdvances(array $auth): void {
        $tid  = (int)($auth['tenant_id'] ?? 1);
        $uid  = (int)($auth['user_id'] ?? ($auth['id'] ?? 0));
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="danh_sach_tam_ung_luong_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF");

        fputcsv($output, [
            'STT',
            'Mã đơn',
            'Nhân viên',
            'Phòng ban',
            'Số tiền tạm ứng (VNĐ)',
            'Tháng khấu trừ',
            'Lý do',
            'Trạng thái',
            'Người duyệt Cấp 1',
            'Người duyệt Cấp 2',
            'Ngày tạo'
        ]);

        $where = ['u.tenant_id = ?'];
        $params = [$tid];

        $canViewAll = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'nhan_su', 'accountant', 'ke_toan'], true);
        $isManager  = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        if (!$canViewAll) {
            if ($isManager) {
                $where[] = "(a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ? OR u.team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))))";
                array_push($params, $uid, $uid, $uid, $uid);
            } else {
                $where[] = '(a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ?)';
                array_push($params, $uid, $uid, $uid);
            }
        }

        $statusParam    = trim((string)($_GET['status'] ?? $_GET['statuses'] ?? ''));
        $deductionMonth = trim((string)($_GET['deduction_month'] ?? $_GET['month_year'] ?? ''));
        $targetUserId   = isset($_GET['user_id']) && is_numeric($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
        $search         = trim((string)($_GET['search'] ?? $_GET['search_query'] ?? ''));

        if ($statusParam !== '' && $statusParam !== 'all') {
            $stList = array_filter(array_map('trim', explode(',', strtolower($statusParam))));
            if (!empty($stList)) {
                $ph = implode(',', array_fill(0, count($stList), '?'));
                $where[] = "a.status IN ({$ph})";
                foreach ($stList as $st) {
                    $params[] = $st;
                }
            }
        }
        if ($deductionMonth !== '') {
            $where[] = 'a.deduction_month = ?';
            $params[] = $deductionMonth;
        }
        if ($targetUserId > 0) {
            $where[] = 'a.user_id = ?';
            $params[] = $targetUserId;
        }
        if ($search !== '') {
            $like = "%{$search}%";
            $where[] = '(u.full_name LIKE ? OR a.reason LIKE ? OR u.department LIKE ?)';
            array_push($params, $like, $like, $like);
        }

        $sql = "SELECT a.id, a.amount, a.deduction_month, a.reason, a.status, a.created_at,
                       u.full_name, u.department,
                       COALESCE(app1.full_name, '') as approver_name_1,
                       COALESCE(app2.full_name, '') as approver_name_2
                FROM hrm_salary_advances a
                JOIN users u ON a.user_id = u.id
                LEFT JOIN users app1 ON a.approver_id = app1.id
                LEFT JOIN users app2 ON a.approver_id_2 = app2.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY a.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $stt = 1;
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            fputcsv($output, [
                $stt++,
                '#' . $r['id'],
                $r['full_name'] ?: '',
                $r['department'] ?: '',
                number_format((float)($r['amount'] ?? 0), 0, ',', '.'),
                $r['deduction_month'] ?: '',
                trim(preg_replace('/\s+/', ' ', strip_tags((string)($r['reason'] ?? '')))),
                $r['status'] ?: 'pending',
                $r['approver_name_1'],
                $r['approver_name_2'],
                !empty($r['created_at']) ? date('d/m/Y H:i', strtotime($r['created_at'])) : ''
            ]);
        }

        fclose($output);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $uid, "Export Data (salary_advance)", 'salary_advance', null, "Exported " . ($stt - 1) . " salary advances");
        }
        exit;
    }
}

