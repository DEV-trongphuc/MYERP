<?php

class ExportController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function export(array $auth): void {
        $allowedRoles = ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'sales', 'sale', 'sale_admin', 'saleadmin', 'accountant', 'hr', 'cskh', 'academic_officer', 'viewer'];
        if (!in_array(strtolower($auth['role'] ?? ''), $allowedRoles, true)) {
            respond(403, null, 'Bạn không có quyền xuất dữ liệu', false);
        }
        
        $type = $_GET['type'] ?? 'contact';
        
        // Allowed types
        if (!in_array($type, ['contact', 'company', 'deal', 'product', 'inventory'])) {
            respond(400, null, 'Loại dữ liệu xuất không hợp lệ', false);
        }

        // Prepare response headers for CSV download
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="export_' . $type . '_' . date('Ymd_His') . '.csv"');
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
            $baseColumns = [
                'id' => 'ID', 
                'full_name' => 'Họ tên', 
                'email' => 'Email', 
                'phone' => 'Số điện thoại', 
                'mobile' => 'Di động', 
                'job_title' => 'Chức danh', 
                'department' => 'Phòng ban', 
                'source' => 'Nguồn', 
                'status' => 'Trạng thái', 
                'stage_name' => 'Giai đoạn',
                'company_name' => 'Công ty', 
                'owner_name' => 'Người phụ trách', 
                'tags' => 'Phân loại (Tags)',
                'notes' => 'Ghi chú', 
                'customer_type' => 'Loại khách hàng', 
                'temperature' => 'Nhiệt độ (Nóng/Ấm/Lạnh)', 
                'project_name' => 'Dự án quan tâm', 
                'last_contact' => 'Tương tác gần nhất',
                'created_at' => 'Ngày tạo'
            ];
            
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
                        EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND ps2.system_slug IN ('deposit_tuition_payment', 'application_completed', 'dong_le_phi_ho_so'))
                        OR t.pipeline_status IN ('deposit_tuition_payment', 'application_completed', 'dong_le_phi_ho_so')
                    )";
                } elseif ($studentSubTab === 'nop_ho_so') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND ps2.system_slug IN ('application_started', 'admission_approved', 'offer_accepted', 'nop_ho_so'))
                        OR t.pipeline_status IN ('application_started', 'admission_approved', 'offer_accepted', 'nop_ho_so')
                    )";
                } elseif ($studentSubTab === 'chinh_thuc') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps2 WHERE ps2.id = t.stage_id AND (ps2.system_slug IN ('enrolled', 'hoc_vien') OR ps2.is_won = 1))
                        OR t.pipeline_status IN ('enrolled', 'hoc_vien')
                        OR t.status = 'customer'
                    )";
                }
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
                           ps.name as stage_name
                    FROM contacts t 
                    LEFT JOIN companies co ON t.company_id = co.id 
                    LEFT JOIN users u ON t.owner_id = u.id 
                    LEFT JOIN projects p ON t.project_id = p.id
                    LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
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
                $row = [];
                // Map base columns
                foreach (array_keys($baseColumns) as $colKey) {
                    $val = $record[$colKey] ?? '';
                    if ($colKey === 'tags' && !empty($val)) {
                        $decodedTags = json_decode($val, true);
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
