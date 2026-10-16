<?php

/**
 * AgentPoSoFinanceTools — Pillar 3: PO, SO, Deposits, Tuition Milestones, Expenses, Purchase Orders,
 * Sales Orders, Invoices, Quotes, Suppliers, Cooperation Slips & Multi-Level Approvals 100% Schema AI Engine.
 */
class AgentPoSoFinanceTools
{
    /**
     * 1. Return Gemini Function Declarations for PO, SO, Finance & Multi-Level Approvals
     */
    public static function getToolDeclarations(): array
    {
        return [
            [
                'name' => 'smart_manage_po_so_and_approvals',
                'description' => 'Công cụ Chuyên sâu 100% Schema cho toàn bộ nghiệp vụ PO (Phiếu đề xuất chi expenses, Đơn mua hàng purchase_orders, Nhà cung cấp suppliers, Tạm ứng hrm_salary_advances) và SO (Đơn đặt cọc học phí deposits #SO, Các đợt đóng học phí deposit_milestones, Đơn đặt hàng B2B sales_orders, Báo giá quotes, Hóa đơn invoices, Phiếu hợp tác chia hoa hồng cooperation_slips) và Quy trình phê duyệt đa cấp (1-3 cấp). Hỗ trợ truy vấn đa tầng, lập phiếu mới, cập nhật, duyệt tuần tự cấp 1-2-3, xác nhận giải ngân UNC, nhập kho PO, kế toán duyệt UNC đợt thu học phí và chuyển đổi Báo giá/SO sang Hóa đơn.',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'action' => [
                            'type' => 'STRING',
                            'description' => "Hành động thực thi:
- Truy vấn & Xem chi tiết: 'query_purchase_orders' | 'query_suppliers' | 'query_sales_orders' | 'query_invoices' | 'query_quotes' | 'query_cooperation_slips' | 'get_po_or_so_detail'
- Tạo/Cập nhật PO (Chi phí/Mua hàng/NCC): 'create_expense_proposal' | 'update_expense_proposal' | 'create_purchase_order' | 'create_or_update_supplier'
- Tạo/Cập nhật SO (Đặt cọc học phí/Đơn hàng/Báo giá/Hóa đơn): 'create_deposit_so' | 'update_deposit_milestones' | 'create_sales_order' | 'create_quote' | 'create_invoice'
- Phê duyệt & Luồng nghiệp vụ: 'approve_or_reject_workflow' | 'disburse_expense' | 'receive_purchase_order' | 'approve_or_reject_deposit_milestone' | 'convert_to_invoice' | 'mark_invoice_paid'",
                        ],
                        'record_type' => [
                            'type' => 'STRING',
                            'description' => "Loại chứng từ: 'expense' | 'purchase_order' | 'supplier' | 'salary_advance' | 'deposit' | 'deposit_milestone' | 'sales_order' | 'invoice' | 'quote' | 'cooperation_slip'",
                        ],
                        'record_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID của phiếu/đơn/nhà cung cấp cần thao tác hoặc xem chi tiết.',
                        ],
                        'milestone_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID của đợt đóng học phí (deposit_milestones.id) khi duyệt/từ chối UNC đợt thu học phí.',
                        ],
                        'code_or_number' => [
                            'type' => 'STRING',
                            'description' => 'Mã phiếu hoặc số hiệu chứng từ (VD: PO-00012, SO-00045, INV-2026-001, QUO-2026-005, #SO120, #PO88).',
                        ],
                        'search_query' => [
                            'type' => 'STRING',
                            'description' => 'Từ khóa tìm kiếm theo tiêu đề, ghi chú, tên khách hàng/học viên, tên nhà cung cấp, mã căn/chương trình.',
                        ],
                        'status' => [
                            'type' => 'STRING',
                            'description' => "Trạng thái lọc (VD: 'pending', 'pending_l1', 'pending_l2', 'pending_l3', 'approved', 'rejected', 'disbursed', 'waiting_disbursement', 'draft', 'pending_approval', 'ordered', 'received', 'cancelled', 'paid', 'overdue', 'sent', 'accepted', 'expired', 'invoiced').",
                        ],
                        'payment_status' => [
                            'type' => 'STRING',
                            'description' => "Trạng thái thanh toán ('unpaid', 'partial', 'paid') hoặc trạng thái đợt thu ('waiting_unc_approval', 'failed').",
                        ],
                        'from_date' => [
                            'type' => 'STRING',
                            'description' => 'Từ ngày (YYYY-MM-DD).',
                        ],
                        'to_date' => [
                            'type' => 'STRING',
                            'description' => 'Đến ngày (YYYY-MM-DD).',
                        ],
                        'min_amount' => [
                            'type' => 'NUMBER',
                            'description' => 'Số tiền tối thiểu (VNĐ).',
                        ],
                        'max_amount' => [
                            'type' => 'NUMBER',
                            'description' => 'Số tiền tối đa (VNĐ).',
                        ],
                        'custom_rules' => [
                            'type' => 'STRING',
                            'description' => 'Chuỗi JSON mảng điều kiện lọc nâng cao [{field, operator, value}] trên toàn bộ cột của bảng tương ứng.',
                        ],
                        'title' => [
                            'type' => 'STRING',
                            'description' => 'Tiêu đề phiếu đề xuất chi, hóa đơn hoặc báo giá.',
                        ],
                        'category' => [
                            'type' => 'STRING',
                            'description' => 'Danh mục chi phí (VD: Marketing, Văn phòng phẩm, Hoa hồng, Lương thưởng, Thuê mặt bằng, Khác) hoặc phân loại NCC.',
                        ],
                        'vendor_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên nhà cung cấp / đơn vị thụ hưởng.',
                        ],
                        'supplier_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID nhà cung cấp (suppliers.id).',
                        ],
                        'contact_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID khách hàng / học viên (contacts.id).',
                        ],
                        'contact_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên khách hàng / học viên (hỗ trợ tự động tìm kiếm nếu chưa truyền contact_id).',
                        ],
                        'company_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID công ty / đối tác B2B (companies.id).',
                        ],
                        'project_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID chương trình đào tạo / dự án (projects.id).',
                        ],
                        'program' => [
                            'type' => 'STRING',
                            'description' => 'Tên chương trình đào tạo / dự án.',
                        ],
                        'unit_code' => [
                            'type' => 'STRING',
                            'description' => 'Mã khóa học / lớp / sản phẩm / căn (deposits.unit_code).',
                        ],
                        'amount' => [
                            'type' => 'NUMBER',
                            'description' => 'Tổng số tiền / học phí / giá trị phiếu (VNĐ).',
                        ],
                        'tax' => [
                            'type' => 'NUMBER',
                            'description' => 'Tiền thuế VAT (VNĐ).',
                        ],
                        'discount' => [
                            'type' => 'NUMBER',
                            'description' => 'Tiền chiết khấu / giảm giá (VNĐ).',
                        ],
                        'currency' => [
                            'type' => 'STRING',
                            'description' => 'Loại tiền tệ (mặc định VND, hoặc USD, EUR, JPY, KRW).',
                        ],
                        'has_vat_invoice' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Có hóa đơn đỏ GTGT (VAT) hay không.',
                        ],
                        'is_vat_inclusive' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Giá đã bao gồm VAT hay chưa.',
                        ],
                        'due_date' => [
                            'type' => 'STRING',
                            'description' => 'Hạn thanh toán / hạn hiệu lực / ngày giao hàng (YYYY-MM-DD).',
                        ],
                        'notes' => [
                            'type' => 'STRING',
                            'description' => 'Ghi chú chi tiết, điều khoản hoặc nội dung diễn giải.',
                        ],
                        'bank_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên ngân hàng thụ hưởng.',
                        ],
                        'bank_account' => [
                            'type' => 'STRING',
                            'description' => 'Số tài khoản ngân hàng thụ hưởng.',
                        ],
                        'approver_id' => [
                            'type' => 'INTEGER',
                            'description' => 'ID người phê duyệt Cấp 1.',
                        ],
                        'approver_id_2' => [
                            'type' => 'INTEGER',
                            'description' => 'ID người phê duyệt Cấp 2.',
                        ],
                        'approver_id_3' => [
                            'type' => 'INTEGER',
                            'description' => 'ID người phê duyệt Cấp 3.',
                        ],
                        'items' => [
                            'type' => 'ARRAY',
                            'description' => 'Danh sách mặt hàng / hạng mục chi tiết [{product_id, name, description, quantity, unit_price, unit_cost, discount}].',
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'product_id' => ['type' => 'INTEGER'],
                                    'name' => ['type' => 'STRING'],
                                    'description' => ['type' => 'STRING'],
                                    'quantity' => ['type' => 'NUMBER'],
                                    'unit_price' => ['type' => 'NUMBER'],
                                    'unit_cost' => ['type' => 'NUMBER'],
                                    'discount' => ['type' => 'NUMBER'],
                                ],
                            ],
                        ],
                        'milestones' => [
                            'type' => 'ARRAY',
                            'description' => 'Danh sách các đợt đóng học phí [{milestone_name, expected_amount, expected_pay_date}].',
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'milestone_name' => ['type' => 'STRING'],
                                    'expected_amount' => ['type' => 'NUMBER'],
                                    'expected_pay_date' => ['type' => 'STRING'],
                                ],
                            ],
                        ],
                        'decision' => [
                            'type' => 'STRING',
                            'description' => "Quyết định phê duyệt: 'approve' (Duyệt) hoặc 'reject' (Từ chối).",
                        ],
                        'reason' => [
                            'type' => 'STRING',
                            'description' => 'Lý do từ chối hoặc ghi chú phê duyệt.',
                        ],
                        'unc_file_url' => [
                            'type' => 'STRING',
                            'description' => 'Đường dẫn ảnh/file Ủy nhiệm chi (UNC) khi xác nhận giải ngân hoặc tải UNC.',
                        ],
                    ],
                    'required' => ['action'],
                ],
            ],
        ];
    }

    /**
     * Helper: Determine if current user is Admin / Director / Accountant with full Finance & PO/SO visibility
     */
    private static function isFinancePrivileged(array $auth): bool
    {
        $role = strtolower(trim((string)($auth['role'] ?? '')));
        return in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'accountant', 'assistant'], true);
    }

    /**
     * Helper: Resolve team member IDs for Manager role
     */
    private static function getManagerTeamUserIds(PDO $db, int $uid, string $role): array
    {
        $userIds = [$uid];
        if (strtolower($role) === 'manager' && $uid > 0) {
            try {
                $stmt = $db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?) AND deleted_at IS NULL");
                $stmt->execute([$uid]);
                $rows = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
                foreach ($rows as $r) {
                    $userIds[] = (int)$r;
                }
            } catch (\Throwable $e) {
                // Ignore if teams table differs
            }
        }
        return array_values(array_unique($userIds));
    }

    /**
     * Helper: Apply dynamic custom_rules safely against an allowed column whitelist
     */
    private static function applyCustomRulesToWhere(string $customRulesRaw, array $columnMap, array &$where, array &$params): void
    {
        $customRulesRaw = trim($customRulesRaw);
        if ($customRulesRaw === '') {
            return;
        }
        $decoded = json_decode($customRulesRaw, true);
        if (!is_array($decoded)) {
            return;
        }
        foreach ($decoded as $rule) {
            if (!is_array($rule)) {
                continue;
            }
            $field = strtolower(trim((string)($rule['field'] ?? '')));
            $op = strtolower(trim((string)($rule['operator'] ?? '=')));
            $val = $rule['value'] ?? null;

            if ($field === '' || !isset($columnMap[$field])) {
                continue;
            }
            $colSql = $columnMap[$field];

            switch ($op) {
                case '=':
                case 'eq':
                case 'equals':
                    if ($val === null || $val === 'NULL') {
                        $where[] = "$colSql IS NULL";
                    } else {
                        $where[] = "$colSql = ?";
                        $params[] = $val;
                    }
                    break;
                case '!=':
                case '<>':
                case 'neq':
                case 'not_equals':
                    if ($val === null || $val === 'NULL') {
                        $where[] = "$colSql IS NOT NULL";
                    } else {
                        $where[] = "($colSql IS NULL OR $colSql != ?)";
                        $params[] = $val;
                    }
                    break;
                case '>':
                case 'gt':
                    $where[] = "$colSql > ?";
                    $params[] = $val;
                    break;
                case '>=':
                case 'gte':
                    $where[] = "$colSql >= ?";
                    $params[] = $val;
                    break;
                case '<':
                case 'lt':
                    $where[] = "$colSql < ?";
                    $params[] = $val;
                    break;
                case '<=':
                case 'lte':
                    $where[] = "$colSql <= ?";
                    $params[] = $val;
                    break;
                case 'like':
                case 'contains':
                    $where[] = "$colSql LIKE ?";
                    $params[] = '%' . trim((string)$val) . '%';
                    break;
                case 'not_like':
                case 'not_contains':
                    $where[] = "($colSql IS NULL OR $colSql NOT LIKE ?)";
                    $params[] = '%' . trim((string)$val) . '%';
                    break;
                case 'in':
                    $arr = is_array($val) ? $val : array_map('trim', explode(',', (string)$val));
                    $arr = array_values(array_filter($arr, fn($v) => $v !== ''));
                    if (!empty($arr)) {
                        $ph = implode(',', array_fill(0, count($arr), '?'));
                        $where[] = "$colSql IN ($ph)";
                        foreach ($arr as $item) {
                            $params[] = $item;
                        }
                    }
                    break;
                case 'not_in':
                    $arr = is_array($val) ? $val : array_map('trim', explode(',', (string)$val));
                    $arr = array_values(array_filter($arr, fn($v) => $v !== ''));
                    if (!empty($arr)) {
                        $ph = implode(',', array_fill(0, count($arr), '?'));
                        $where[] = "($colSql IS NULL OR $colSql NOT IN ($ph))";
                        foreach ($arr as $item) {
                            $params[] = $item;
                        }
                    }
                    break;
                case 'is_null':
                case 'empty':
                    $where[] = "($colSql IS NULL OR CAST($colSql AS CHAR) = '')";
                    break;
                case 'is_not_null':
                case 'not_empty':
                    $where[] = "($colSql IS NOT NULL AND CAST($colSql AS CHAR) != '')";
                    break;
                case 'between':
                    if (is_array($val) && count($val) >= 2) {
                        $where[] = "($colSql >= ? AND $colSql <= ?)";
                        $params[] = $val[0];
                        $params[] = $val[1];
                    }
                    break;
            }
        }
    }

    /**
     * 2. Apply Extended Filters on `expenses` (PO / Phiếu đề xuất chi) — 100% 40-column schema support
     */
    public static function applyExtendedExpensePoFilters(PDO $db, string $alias, array $args, array &$where, array &$params, int $tid): void
    {
        $a = $alias !== '' ? rtrim($alias, '.') . '.' : '';

        // Extended status filters
        $status = strtolower(trim((string)($args['status'] ?? '')));
        if ($status === 'pending_l1') {
            $where[] = "{$a}status = 'pending' AND {$a}status_level_1 = 'pending'";
        } elseif ($status === 'pending_l2') {
            $where[] = "{$a}status = 'pending' AND {$a}status_level_1 = 'approved' AND {$a}status_level_2 = 'pending'";
        } elseif ($status === 'pending_l3') {
            $where[] = "{$a}status = 'pending' AND {$a}status_level_2 = 'approved' AND {$a}status_level_3 = 'pending'";
        } elseif ($status === 'disbursed' || $status === 'refunded') {
            $where[] = "{$a}is_refunded = 1";
        } elseif ($status === 'waiting_disbursement' || $status === 'unrefunded') {
            $where[] = "{$a}status = 'approved' AND COALESCE({$a}is_refunded, 0) = 0";
        }

        // Vendor name
        $vendorName = trim((string)($args['vendor_name'] ?? ''));
        if ($vendorName !== '') {
            $where[] = "{$a}vendor_name LIKE ?";
            $params[] = "%{$vendorName}%";
        }

        // Created by name
        $createdByName = trim((string)($args['created_by_name'] ?? ''));
        if ($createdByName !== '') {
            $where[] = "EXISTS (SELECT 1 FROM users u_cb WHERE u_cb.id = {$a}created_by AND u_cb.tenant_id = ? AND u_cb.full_name LIKE ?)";
            $params[] = $tid;
            $params[] = "%{$createdByName}%";
        }

        // Approver name across Level 1, Level 2, Level 3
        $approverName = trim((string)($args['approver_name'] ?? ''));
        if ($approverName !== '') {
            $where[] = "EXISTS (SELECT 1 FROM users u_ap WHERE u_ap.tenant_id = ? AND u_ap.full_name LIKE ? AND (u_ap.id = {$a}approver_id OR u_ap.id = {$a}approver_id_2 OR u_ap.id = {$a}approver_id_3 OR u_ap.id = {$a}approved_by OR u_ap.id = {$a}approved_by_2 OR u_ap.id = {$a}approved_by_3))";
            $params[] = $tid;
            $params[] = "%{$approverName}%";
        }

        // VAT flags
        if (isset($args['has_vat_invoice']) && $args['has_vat_invoice'] !== '' && $args['has_vat_invoice'] !== null) {
            $hasVat = filter_var($args['has_vat_invoice'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($hasVat !== null) {
                $where[] = "{$a}has_vat_invoice = ?";
                $params[] = $hasVat ? 1 : 0;
            }
        }
        if (isset($args['is_vat_inclusive']) && $args['is_vat_inclusive'] !== '' && $args['is_vat_inclusive'] !== null) {
            $incVat = filter_var($args['is_vat_inclusive'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($incVat !== null) {
                $where[] = "{$a}is_vat_inclusive = ?";
                $params[] = $incVat ? 1 : 0;
            }
        }

        // Linked ERP entities (`expense_entities`: contact, deal, project, company, etc.)
        $entityType = strtolower(trim((string)($args['entity_type'] ?? '')));
        $entityKeyword = trim((string)($args['entity_keyword'] ?? ''));
        if ($entityType !== '' || $entityKeyword !== '') {
            if ($entityType === 'contact' && $entityKeyword !== '') {
                $where[] = "EXISTS (SELECT 1 FROM expense_entities ee JOIN contacts c_ee ON ee.entity_type = 'contact' AND ee.entity_id = c_ee.id WHERE ee.expense_id = {$a}id AND c_ee.tenant_id = ? AND c_ee.deleted_at IS NULL AND (c_ee.full_name LIKE ? OR c_ee.phone LIKE ? OR CAST(c_ee.id AS CHAR) = ?))";
                $params[] = $tid;
                $params[] = "%{$entityKeyword}%";
                $params[] = "%{$entityKeyword}%";
                $params[] = $entityKeyword;
            } elseif ($entityType === 'project' && $entityKeyword !== '') {
                $where[] = "EXISTS (SELECT 1 FROM expense_entities ee JOIN projects p_ee ON ee.entity_type = 'project' AND ee.entity_id = p_ee.id WHERE ee.expense_id = {$a}id AND p_ee.tenant_id = ? AND p_ee.name LIKE ?)";
                $params[] = $tid;
                $params[] = "%{$entityKeyword}%";
            } elseif ($entityType === 'company' && $entityKeyword !== '') {
                $where[] = "EXISTS (SELECT 1 FROM expense_entities ee JOIN companies comp_ee ON ee.entity_type = 'company' AND ee.entity_id = comp_ee.id WHERE ee.expense_id = {$a}id AND comp_ee.tenant_id = ? AND comp_ee.name LIKE ?)";
                $params[] = $tid;
                $params[] = "%{$entityKeyword}%";
            } elseif ($entityKeyword !== '') {
                $where[] = "(EXISTS (SELECT 1 FROM expense_entities ee JOIN contacts c_ee ON ee.entity_type = 'contact' AND ee.entity_id = c_ee.id WHERE ee.expense_id = {$a}id AND c_ee.tenant_id = ? AND c_ee.deleted_at IS NULL AND c_ee.full_name LIKE ?) OR EXISTS (SELECT 1 FROM expense_entities ee JOIN projects p_ee ON ee.entity_type = 'project' AND ee.entity_id = p_ee.id WHERE ee.expense_id = {$a}id AND p_ee.tenant_id = ? AND p_ee.name LIKE ?))";
                $params[] = $tid;
                $params[] = "%{$entityKeyword}%";
                $params[] = $tid;
                $params[] = "%{$entityKeyword}%";
            } elseif ($entityType !== '') {
                $where[] = "EXISTS (SELECT 1 FROM expense_entities ee WHERE ee.expense_id = {$a}id AND ee.entity_type = ?)";
                $params[] = $entityType;
            }
        }

        // Specific date field filter (`date`, `due_date`, `created_at`, `approved_at`, `refunded_at`)
        $dateField = strtolower(trim((string)($args['date_field'] ?? '')));
        $fromDate = trim((string)($args['from_date'] ?? ''));
        $toDate = trim((string)($args['to_date'] ?? ''));
        $allowedDateFields = [
            'date' => "{$a}date",
            'due_date' => "{$a}due_date",
            'created_at' => "{$a}created_at",
            'approved_at' => "{$a}approved_at",
            'refunded_at' => "{$a}refunded_at",
        ];
        if ($dateField !== '' && $dateField !== 'date' && isset($allowedDateFields[$dateField])) {
            $col = $allowedDateFields[$dateField];
            if ($fromDate !== '') {
                $where[] = "$col >= ?";
                $params[] = strlen($fromDate) === 10 ? $fromDate . ' 00:00:00' : $fromDate;
            }
            if ($toDate !== '') {
                $where[] = "$col <= ?";
                $params[] = strlen($toDate) === 10 ? $toDate . ' 23:59:59' : $toDate;
            }
        }

        // All 40 columns of `expenses` mapped for custom_rules
        $expenseCols = [
            'id' => "{$a}id",
            'tenant_id' => "{$a}tenant_id",
            'created_by' => "{$a}created_by",
            'approver_id' => "{$a}approver_id",
            'approved_by' => "{$a}approved_by",
            'approved_by_2' => "{$a}approved_by_2",
            'approved_by_3' => "{$a}approved_by_3",
            'approved_at' => "{$a}approved_at",
            'approved_at_2' => "{$a}approved_at_2",
            'approved_at_3' => "{$a}approved_at_3",
            'title' => "{$a}title",
            'category' => "{$a}category",
            'vendor_name' => "{$a}vendor_name",
            'amount' => "{$a}amount",
            'currency' => "{$a}currency",
            'vat_amount' => "{$a}vat_amount",
            'date' => "{$a}date",
            'due_date' => "{$a}due_date",
            'status' => "{$a}status",
            'notes' => "{$a}notes",
            'items' => "{$a}items",
            'approval_steps' => "{$a}approval_steps",
            'has_vat_invoice' => "{$a}has_vat_invoice",
            'is_vat_inclusive' => "{$a}is_vat_inclusive",
            'created_at' => "{$a}created_at",
            'updated_at' => "{$a}updated_at",
            'deleted_at' => "{$a}deleted_at",
            'image_url' => "{$a}image_url",
            'reject_reason' => "{$a}reject_reason",
            'is_refunded' => "{$a}is_refunded",
            'refund_image_url' => "{$a}refund_image_url",
            'refunded_at' => "{$a}refunded_at",
            'refunder_id' => "{$a}refunder_id",
            'approver_id_2' => "{$a}approver_id_2",
            'approver_id_3' => "{$a}approver_id_3",
            'status_level_1' => "{$a}status_level_1",
            'status_level_2' => "{$a}status_level_2",
            'status_level_3' => "{$a}status_level_3",
            'approval_status' => "{$a}approval_status",
            'related_user_ids' => "{$a}related_user_ids",
        ];
        if (!empty($args['custom_rules'])) {
            self::applyCustomRulesToWhere((string)$args['custom_rules'], $expenseCols, $where, $params);
        }
    }

    /**
     * 3. Apply Extended Filters on `deposits` (#SO / Đơn đặt cọc học phí) — 100% 24-column schema support
     */
    public static function applyExtendedDepositSoFilters(PDO $db, string $alias, array $args, array &$where, array &$params, int $tid): void
    {
        $a = $alias !== '' ? rtrim($alias, '.') . '.' : '';

        // Normalize `pending` status to `IN ('pending', 'pending_admin')`
        $status = strtolower(trim((string)($args['status'] ?? '')));
        if ($status === 'pending' || $status === 'pending_admin') {
            // Check if a naive `$alias.status = ?` was already pushed to $where and replace it
            $replaced = false;
            foreach ($where as $idx => $clause) {
                if (preg_match('/^' . preg_quote($a, '/') . 'status\s*=\s*\?$/i', trim($clause))) {
                    $where[$idx] = "{$a}status IN ('pending', 'pending_admin')";
                    // Remove corresponding param if it matches 'pending' or 'pending_admin'
                    foreach ($params as $pIdx => $pVal) {
                        if ($pVal === 'pending' || $pVal === 'pending_admin') {
                            array_splice($params, $pIdx, 1);
                            break;
                        }
                    }
                    $replaced = true;
                    break;
                }
            }
            if (!$replaced) {
                $where[] = "{$a}status IN ('pending', 'pending_admin')";
            }
        }

        // Milestone status filter (`waiting_unc_approval`, `paid`, `approved`, `pending`, `failed`, `overdue`)
        $milestoneStatus = strtolower(trim((string)($args['milestone_status'] ?? ($args['payment_status'] ?? ''))));
        if ($milestoneStatus === 'waiting_unc_approval' || $milestoneStatus === 'paid') {
            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm_w WHERE dm_w.deposit_id = {$a}id AND dm_w.status = 'paid')";
        } elseif ($milestoneStatus === 'failed' || $milestoneStatus === 'rejected') {
            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm_f WHERE dm_f.deposit_id = {$a}id AND dm_f.status = 'failed')";
        } elseif ($milestoneStatus === 'overdue') {
            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm_o WHERE dm_o.deposit_id = {$a}id AND dm_o.status IN ('pending', 'failed') AND dm_o.expected_pay_date IS NOT NULL AND dm_o.expected_pay_date < CURDATE())";
        } elseif (in_array($milestoneStatus, ['pending', 'approved'], true)) {
            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm_s WHERE dm_s.deposit_id = {$a}id AND dm_s.status = ?)";
            $params[] = $milestoneStatus;
        }

        // Unit code filter
        $unitCode = trim((string)($args['unit_code'] ?? ''));
        if ($unitCode !== '') {
            $where[] = "{$a}unit_code LIKE ?";
            $params[] = "%{$unitCode}%";
        }

        // Accountant name filter (`accountant_id`)
        $accountantName = trim((string)($args['accountant_name'] ?? ''));
        if ($accountantName !== '') {
            $where[] = "EXISTS (SELECT 1 FROM users u_acc WHERE u_acc.id = {$a}accountant_id AND u_acc.tenant_id = ? AND u_acc.full_name LIKE ?)";
            $params[] = $tid;
            $params[] = "%{$accountantName}%";
        }

        // Currency filter
        $currency = strtoupper(trim((string)($args['currency'] ?? '')));
        if ($currency !== '') {
            $where[] = "{$a}currency = ?";
            $params[] = $currency;
        }

        // All 24 columns of `deposits` mapped for custom_rules
        $depositCols = [
            'id' => "{$a}id",
            'contact_id' => "{$a}contact_id",
            'company_id' => "{$a}company_id",
            'supplier_id' => "{$a}supplier_id",
            'project_id' => "{$a}project_id",
            'unit_code' => "{$a}unit_code",
            'price' => "{$a}price",
            'expected_commission' => "{$a}expected_commission",
            'status' => "{$a}status",
            'related_user_ids' => "{$a}related_user_ids",
            'cancelled_reason' => "{$a}cancelled_reason",
            'created_by' => "{$a}created_by",
            'created_at' => "{$a}created_at",
            'updated_at' => "{$a}updated_at",
            'auto_remind' => "{$a}auto_remind",
            'remind_days_before' => "{$a}remind_days_before",
            'remind_at_hour' => "{$a}remind_at_hour",
            'remind_target' => "{$a}remind_target",
            'notes' => "{$a}notes",
            'currency' => "{$a}currency",
            'exchange_rate' => "{$a}exchange_rate",
            'accountant_id' => "{$a}accountant_id",
            'participant_ids' => "{$a}participant_ids",
            'full_name' => "{$a}full_name",
        ];
        if (!empty($args['custom_rules'])) {
            self::applyCustomRulesToWhere((string)$args['custom_rules'], $depositCols, $where, $params);
        }
    }

    /**
     * 4. Unified Multi-Stage Approval Engine with `FOR UPDATE` row locking and Self-Approval Prevention
     */
    public static function executeUnifiedApprovalTicket(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $role = strtolower(trim((string)($auth['role'] ?? '')));
        $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isAccountant = in_array($role, ['accountant', 'assistant'], true);

        $ticketType = strtolower(trim((string)($args['ticket_type'] ?? ($args['record_type'] ?? 'expense'))));
        $ticketId = (int)($args['ticket_id'] ?? ($args['record_id'] ?? ($args['milestone_id'] ?? 0)));
        $decision = strtolower(trim((string)($args['decision'] ?? 'approve')));
        $reason = trim((string)($args['reason'] ?? ($args['notes'] ?? '')));

        if (!in_array($decision, ['approve', 'approved', 'reject', 'rejected'], true)) {
            return ['ok' => false, 'error' => "Quyết định phê duyệt không hợp lệ (chỉ nhận 'approve' hoặc 'reject')."];
        }
        $isApprove = in_array($decision, ['approve', 'approved'], true);

        if ($ticketId <= 0 && !empty($args['code_or_number'])) {
            $codeClean = preg_replace('/[^0-9]/', '', (string)$args['code_or_number']);
            if ($codeClean !== '') {
                $ticketId = (int)$codeClean;
            }
        }
        if ($ticketId <= 0) {
            return ['ok' => false, 'error' => 'Vui lòng cung cấp ID phiếu (ticket_id / record_id) cần phê duyệt.'];
        }

        try {
            // =========================================================================
            // CASE 1: EXPENSE (Phiếu đề xuất chi - 3 cấp tuần tự)
            // =========================================================================
            if (in_array($ticketType, ['expense', 'expenses', 'po_expense'], true)) {
                $db->beginTransaction();
                $stmt = $db->prepare("SELECT * FROM expenses WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL FOR UPDATE");
                $stmt->execute([$ticketId, $tid]);
                $exp = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$exp) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy phiếu đề xuất chi #$ticketId."];
                }
                if (($exp['status'] ?? '') !== 'pending') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Phiếu đề xuất chi #$ticketId hiện đang ở trạng thái '{$exp['status']}', không thể duyệt/từ chối lại."];
                }

                $app1 = !empty($exp['approver_id']) ? (int)$exp['approver_id'] : 0;
                $app2 = !empty($exp['approver_id_2']) ? (int)$exp['approver_id_2'] : 0;
                $app3 = !empty($exp['approver_id_3']) ? (int)$exp['approver_id_3'] : 0;
                $st1 = $exp['status_level_1'] ?? 'pending';
                $st2 = $exp['status_level_2'] ?? ($app2 ? 'pending' : 'none');
                $st3 = $exp['status_level_3'] ?? ($app3 ? 'pending' : 'none');

                // Determine current active level
                $currentLevel = 1;
                if ($st1 === 'approved') {
                    if ($app2 > 0 && $st2 === 'pending') {
                        $currentLevel = 2;
                    } elseif ($app3 > 0 && $st3 === 'pending') {
                        $currentLevel = 3;
                    } else {
                        $currentLevel = 0;
                    }
                }
                if ($currentLevel === 0) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Phiếu đề xuất chi #$ticketId đã hoàn tất các bước phê duyệt."];
                }

                $expectedApprover = $currentLevel === 1 ? $app1 : ($currentLevel === 2 ? $app2 : $app3);
                if (!$isAdmin && $expectedApprover > 0 && $uid !== $expectedApprover) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Bạn không phải người duyệt Cấp $currentLevel được chỉ định cho phiếu chi #$ticketId."];
                }
                if (!$isAdmin && (int)$exp['created_by'] === $uid) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => 'Không được phép tự phê duyệt phiếu chi do chính mình tạo (Zero-Trust Self-Approval Prevention).'];
                }

                if (!$isApprove) {
                    $lvlCol = "status_level_{$currentLevel}";
                    $byCol = $currentLevel === 1 ? 'approved_by' : "approved_by_{$currentLevel}";
                    $atCol = $currentLevel === 1 ? 'approved_at' : "approved_at_{$currentLevel}";
                    $upd = $db->prepare("UPDATE expenses SET status = 'rejected', approval_status = 'rejected', $lvlCol = 'rejected', $byCol = ?, $atCol = NOW(), reject_reason = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upd->execute([$uid, $reason !== '' ? $reason : 'Từ chối qua AI Copilot', $ticketId, $tid]);
                    $db->commit();
                    return [
                        'ok' => true,
                        'ticket_type' => 'expense',
                        'ticket_id' => $ticketId,
                        'title' => $exp['title'],
                        'amount' => (float)$exp['amount'],
                        'new_status' => 'rejected',
                        'level_acted' => $currentLevel,
                        'message' => "Đã TỪ CHỐI phiếu đề xuất chi #$ticketId ({$exp['title']}) ở Cấp $currentLevel.",
                    ];
                }

                // Approve current level
                if ($currentLevel === 1) {
                    if ($app2 > 0 && $st2 === 'pending') {
                        $upd = $db->prepare("UPDATE expenses SET status_level_1 = 'approved', approved_by = ?, approved_at = NOW(), approval_status = 'pending_l2', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'pending_l2';
                        $msg = "Đã duyệt Cấp 1 cho phiếu chi #$ticketId ({$exp['title']}). Phiếu đang chờ duyệt Cấp 2.";
                    } elseif ($app3 > 0 && $st3 === 'pending') {
                        $upd = $db->prepare("UPDATE expenses SET status_level_1 = 'approved', approved_by = ?, approved_at = NOW(), approval_status = 'pending_l3', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'pending_l3';
                        $msg = "Đã duyệt Cấp 1 cho phiếu chi #$ticketId ({$exp['title']}). Phiếu đang chờ duyệt Cấp 3.";
                    } else {
                        $upd = $db->prepare("UPDATE expenses SET status = 'approved', approval_status = 'approved', status_level_1 = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'approved';
                        $msg = "Đã phê duyệt hoàn tất phiếu đề xuất chi #$ticketId ({$exp['title']}) - Số tiền: " . number_format((float)$exp['amount'], 0, ',', '.') . " đ.";
                    }
                } elseif ($currentLevel === 2) {
                    if ($app3 > 0 && $st3 === 'pending') {
                        $upd = $db->prepare("UPDATE expenses SET status_level_2 = 'approved', approved_by_2 = ?, approved_at_2 = NOW(), approval_status = 'pending_l3', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'pending_l3';
                        $msg = "Đã duyệt Cấp 2 cho phiếu chi #$ticketId ({$exp['title']}). Phiếu đang chờ duyệt Cấp 3.";
                    } else {
                        $upd = $db->prepare("UPDATE expenses SET status = 'approved', approval_status = 'approved', status_level_2 = 'approved', approved_by_2 = ?, approved_at_2 = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'approved';
                        $msg = "Đã phê duyệt hoàn tất Cấp 2 (Cuối) cho phiếu đề xuất chi #$ticketId ({$exp['title']}).";
                    }
                } else {
                    $upd = $db->prepare("UPDATE expenses SET status = 'approved', approval_status = 'approved', status_level_3 = 'approved', approved_by_3 = ?, approved_at_3 = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upd->execute([$uid, $ticketId, $tid]);
                    $nextState = 'approved';
                    $msg = "Đã phê duyệt hoàn tất Cấp 3 (Cuối) cho phiếu đề xuất chi #$ticketId ({$exp['title']}).";
                }
                $db->commit();

                return [
                    'ok' => true,
                    'ticket_type' => 'expense',
                    'ticket_id' => $ticketId,
                    'title' => $exp['title'],
                    'amount' => (float)$exp['amount'],
                    'new_status' => $nextState,
                    'level_acted' => $currentLevel,
                    'message' => $msg,
                ];
            }

            // =========================================================================
            // CASE 2: PURCHASE ORDER (Đơn mua hàng PO - 3 cấp tuần tự -> status = 'ordered')
            // =========================================================================
            if (in_array($ticketType, ['purchase_order', 'po', 'purchase_orders'], true)) {
                $db->beginTransaction();
                $stmt = $db->prepare("SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
                $stmt->execute([$ticketId, $tid]);
                $po = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$po) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy Đơn mua hàng (PO) #$ticketId."];
                }
                if (in_array($po['status'], ['ordered', 'received', 'cancelled'], true) && ($po['approval_status'] ?? '') === 'approved') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Đơn mua hàng {$po['po_number']} đã ở trạng thái '{$po['status']}', không thể duyệt lại."];
                }

                $app1 = !empty($po['approver_id']) ? (int)$po['approver_id'] : 0;
                $app2 = !empty($po['approver_id_2']) ? (int)$po['approver_id_2'] : 0;
                $app3 = !empty($po['approver_id_3']) ? (int)$po['approver_id_3'] : 0;
                $st1 = $po['status_level_1'] ?? 'pending';
                $st2 = $po['status_level_2'] ?? ($app2 ? 'pending' : 'none');
                $st3 = $po['status_level_3'] ?? ($app3 ? 'pending' : 'none');

                $currentLevel = 1;
                if ($st1 === 'approved') {
                    if ($app2 > 0 && $st2 === 'pending') {
                        $currentLevel = 2;
                    } elseif ($app3 > 0 && $st3 === 'pending') {
                        $currentLevel = 3;
                    } else {
                        $currentLevel = 0;
                    }
                }
                if ($currentLevel === 0) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Đơn mua hàng {$po['po_number']} đã hoàn tất phê duyệt."];
                }

                $expectedApprover = $currentLevel === 1 ? $app1 : ($currentLevel === 2 ? $app2 : $app3);
                if (!$isAdmin && $expectedApprover > 0 && $uid !== $expectedApprover) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Bạn không phải người duyệt Cấp $currentLevel của Đơn mua hàng {$po['po_number']}."];
                }
                if (!$isAdmin && (int)$po['created_by'] === $uid) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => 'Bạn không thể tự phê duyệt Đơn mua hàng do chính mình lập.'];
                }

                if (!$isApprove) {
                    $lvlCol = "status_level_{$currentLevel}";
                    $byCol = $currentLevel === 1 ? 'approved_by' : "approved_by_{$currentLevel}";
                    $notesAppend = trim(($po['notes'] ?? '') . "\n[Từ chối Cấp $currentLevel]: " . ($reason ?: 'Không đồng ý'));
                    $upd = $db->prepare("UPDATE purchase_orders SET status = 'cancelled', approval_status = 'rejected', $lvlCol = 'rejected', $byCol = ?, notes = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upd->execute([$uid, $notesAppend, $ticketId, $tid]);
                    $db->commit();
                    return [
                        'ok' => true,
                        'ticket_type' => 'purchase_order',
                        'ticket_id' => $ticketId,
                        'po_number' => $po['po_number'],
                        'total' => (float)$po['total'],
                        'new_status' => 'cancelled',
                        'level_acted' => $currentLevel,
                        'message' => "Đã TỪ CHỐI Đơn mua hàng {$po['po_number']} ở Cấp $currentLevel.",
                    ];
                }

                if ($currentLevel === 1) {
                    if ($app2 > 0 && $st2 === 'pending') {
                        $upd = $db->prepare("UPDATE purchase_orders SET status_level_1 = 'approved', approved_by = ?, approval_status = 'pending', status = 'pending_approval', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'pending_l2';
                        $msg = "Đã duyệt Cấp 1 cho Đơn mua hàng {$po['po_number']}. Đang chờ duyệt Cấp 2.";
                    } elseif ($app3 > 0 && $st3 === 'pending') {
                        $upd = $db->prepare("UPDATE purchase_orders SET status_level_1 = 'approved', approved_by = ?, approval_status = 'pending', status = 'pending_approval', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'pending_l3';
                        $msg = "Đã duyệt Cấp 1 cho Đơn mua hàng {$po['po_number']}. Đang chờ duyệt Cấp 3.";
                    } else {
                        $upd = $db->prepare("UPDATE purchase_orders SET status_level_1 = 'approved', approved_by = ?, approval_status = 'approved', status = 'ordered', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'ordered';
                        $msg = "Đã phê duyệt hoàn tất Đơn mua hàng {$po['po_number']} (chuyển sang trạng thái 'ordered').";
                    }
                } elseif ($currentLevel === 2) {
                    if ($app3 > 0 && $st3 === 'pending') {
                        $upd = $db->prepare("UPDATE purchase_orders SET status_level_2 = 'approved', approved_by_2 = ?, approval_status = 'pending', status = 'pending_approval', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'pending_l3';
                        $msg = "Đã duyệt Cấp 2 cho Đơn mua hàng {$po['po_number']}. Đang chờ duyệt Cấp 3.";
                    } else {
                        $upd = $db->prepare("UPDATE purchase_orders SET status_level_2 = 'approved', approved_by_2 = ?, approval_status = 'approved', status = 'ordered', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                        $upd->execute([$uid, $ticketId, $tid]);
                        $nextState = 'ordered';
                        $msg = "Đã phê duyệt hoàn tất Cấp 2 (Cuối) cho Đơn mua hàng {$po['po_number']} (trạng thái 'ordered').";
                    }
                } else {
                    $upd = $db->prepare("UPDATE purchase_orders SET status_level_3 = 'approved', approved_by_3 = ?, approval_status = 'approved', status = 'ordered', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upd->execute([$uid, $ticketId, $tid]);
                    $nextState = 'ordered';
                    $msg = "Đã phê duyệt hoàn tất Cấp 3 (Cuối) cho Đơn mua hàng {$po['po_number']} (trạng thái 'ordered').";
                }
                $db->commit();

                return [
                    'ok' => true,
                    'ticket_type' => 'purchase_order',
                    'ticket_id' => $ticketId,
                    'po_number' => $po['po_number'],
                    'total' => (float)$po['total'],
                    'new_status' => $nextState,
                    'level_acted' => $currentLevel,
                    'message' => $msg,
                ];
            }

            // =========================================================================
            // CASE 3: SALARY ADVANCE (Tạm ứng lương - 2 cấp tuần tự)
            // =========================================================================
            if (in_array($ticketType, ['salary_advance', 'advance', 'hrm_salary_advances'], true)) {
                $db->beginTransaction();
                $stmt = $db->prepare("
                    SELECT sa.*, u.tenant_id as user_tenant_id
                    FROM hrm_salary_advances sa
                    JOIN users u ON sa.user_id = u.id
                    WHERE sa.id = ? AND u.tenant_id = ?
                    FOR UPDATE
                ");
                $stmt->execute([$ticketId, $tid]);
                $adv = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$adv) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy phiếu tạm ứng #$ticketId."];
                }
                if (($adv['status'] ?? '') !== 'pending') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Phiếu tạm ứng #$ticketId hiện đang ở trạng thái '{$adv['status']}'."];
                }

                $app1 = !empty($adv['approver_id']) ? (int)$adv['approver_id'] : 0;
                $app2 = !empty($adv['approver_id_2']) ? (int)$adv['approver_id_2'] : 0;
                $st1 = $adv['status_level_1'] ?? 'pending';
                $st2 = $adv['status_level_2'] ?? ($app2 ? 'pending' : 'none');

                $currentLevel = ($st1 === 'approved' && $app2 > 0 && $st2 === 'pending') ? 2 : 1;
                $expectedApprover = $currentLevel === 1 ? $app1 : $app2;

                if (!$isAdmin && !$isAccountant && $expectedApprover > 0 && $uid !== $expectedApprover) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Bạn không có quyền duyệt Cấp $currentLevel cho phiếu tạm ứng #$ticketId."];
                }

                if (!$isApprove) {
                    $lvlCol = "status_level_{$currentLevel}";
                    $upd = $db->prepare("UPDATE hrm_salary_advances SET status = 'rejected', $lvlCol = 'rejected', approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?");
                    $upd->execute([$uid, $ticketId]);
                    $db->commit();
                    return [
                        'ok' => true,
                        'ticket_type' => 'salary_advance',
                        'ticket_id' => $ticketId,
                        'amount' => (float)$adv['amount'],
                        'new_status' => 'rejected',
                        'level_acted' => $currentLevel,
                        'message' => "Đã TỪ CHỐI phiếu tạm ứng #$ticketId ở Cấp $currentLevel.",
                    ];
                }

                if ($currentLevel === 1 && $app2 > 0 && $st2 === 'pending') {
                    $upd = $db->prepare("UPDATE hrm_salary_advances SET status_level_1 = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?");
                    $upd->execute([$uid, $ticketId]);
                    $nextState = 'pending_l2';
                    $msg = "Đã duyệt Cấp 1 phiếu tạm ứng #$ticketId. Đang chờ duyệt Cấp 2.";
                } else {
                    $lvlCol = "status_level_{$currentLevel}";
                    $byCol = $currentLevel === 1 ? 'approved_by' : 'approved_by_2';
                    $atCol = $currentLevel === 1 ? 'approved_at' : 'approved_at_2';
                    $upd = $db->prepare("UPDATE hrm_salary_advances SET status = 'approved', $lvlCol = 'approved', $byCol = ?, $atCol = NOW(), updated_at = NOW() WHERE id = ?");
                    $upd->execute([$uid, $ticketId]);
                    $nextState = 'approved';
                    $msg = "Đã phê duyệt hoàn tất phiếu tạm ứng #$ticketId (" . number_format((float)$adv['amount'], 0, ',', '.') . " đ).";
                }
                $db->commit();

                return [
                    'ok' => true,
                    'ticket_type' => 'salary_advance',
                    'ticket_id' => $ticketId,
                    'amount' => (float)$adv['amount'],
                    'new_status' => $nextState,
                    'level_acted' => $currentLevel,
                    'message' => $msg,
                ];
            }

            // =========================================================================
            // CASE 4: LEAVE REQUEST (Đơn xin nghỉ phép)
            // =========================================================================
            if (in_array($ticketType, ['leave', 'leave_request', 'hrm_leave_requests'], true)) {
                $db->beginTransaction();
                $stmt = $db->prepare("
                    SELECT lr.*, u.tenant_id as user_tenant_id
                    FROM hrm_leave_requests lr
                    JOIN users u ON lr.user_id = u.id
                    WHERE lr.id = ? AND u.tenant_id = ?
                    FOR UPDATE
                ");
                $stmt->execute([$ticketId, $tid]);
                $lv = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$lv) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy đơn nghỉ phép #$ticketId."];
                }
                if (($lv['status'] ?? '') !== 'pending') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Đơn nghỉ phép #$ticketId đã ở trạng thái '{$lv['status']}'."];
                }
                if (!$isAdmin && (int)($lv['approver_id'] ?? 0) !== $uid) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Bạn không có quyền duyệt đơn nghỉ phép #$ticketId."];
                }
                $newSt = $isApprove ? 'approved' : 'rejected';
                $upd = $db->prepare("UPDATE hrm_leave_requests SET status = ?, status_level_1 = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?");
                $upd->execute([$newSt, $newSt, $uid, $ticketId]);
                $db->commit();
                return [
                    'ok' => true,
                    'ticket_type' => 'leave',
                    'ticket_id' => $ticketId,
                    'new_status' => $newSt,
                    'message' => ($isApprove ? "Đã DUYỆT" : "Đã TỪ CHỐI") . " đơn nghỉ phép #$ticketId.",
                ];
            }

            // =========================================================================
            // CASE 5: CHECK-IN / ATTENDANCE (Chấm công ngoài vùng / giải trình)
            // =========================================================================
            if (in_array($ticketType, ['check_in', 'checkin', 'attendance'], true)) {
                $db->beginTransaction();
                $stmt = $db->prepare("
                    SELECT ci.*, u.tenant_id as user_tenant_id
                    FROM check_ins ci
                    JOIN users u ON ci.user_id = u.id
                    WHERE ci.id = ? AND u.tenant_id = ?
                    FOR UPDATE
                ");
                $stmt->execute([$ticketId, $tid]);
                $ci = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$ci) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy bản ghi chấm công #$ticketId."];
                }
                if (!$isAdmin && !$isAccountant) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Bạn không có quyền duyệt bản ghi chấm công #$ticketId."];
                }
                $newSt = $isApprove ? 'approved' : 'rejected';
                $upd = $db->prepare("UPDATE check_ins SET status = ?, approved_by = ?, approved_at = NOW(), admin_note = COALESCE(NULLIF(?, ''), admin_note) WHERE id = ?");
                $upd->execute([$newSt, $uid, $reason, $ticketId]);
                $db->commit();
                return [
                    'ok' => true,
                    'ticket_type' => 'check_in',
                    'ticket_id' => $ticketId,
                    'new_status' => $newSt,
                    'message' => ($isApprove ? "Đã DUYỆT" : "Đã TỪ CHỐI") . " chấm công #$ticketId.",
                ];
            }

            // =========================================================================
            // CASE 6: DEPOSIT MILESTONE (Kế toán / Admin duyệt UNC đợt đóng học phí)
            // =========================================================================
            if (in_array($ticketType, ['deposit_milestone', 'milestone', 'tuition_milestone', 'deposit'], true)) {
                if (!$isAdmin && !$isAccountant) {
                    return ['ok' => false, 'error' => 'Chỉ Kế toán, Ban Giám Đốc hoặc Admin mới có quyền phê duyệt UNC đợt đóng học phí.'];
                }

                $milestoneId = (int)($args['milestone_id'] ?? $ticketId);
                $db->beginTransaction();

                // If caller passed deposit_id instead of milestone_id, find the first 'paid' or 'pending' milestone
                $stmtM = $db->prepare("
                    SELECT dm.*, d.contact_id, d.company_id, d.project_id, d.created_by as deposit_created_by,
                           c.full_name as student_name, c.tenant_id as contact_tenant_id, p.name as project_name
                    FROM deposit_milestones dm
                    JOIN deposits d ON dm.deposit_id = d.id
                    JOIN contacts c ON d.contact_id = c.id
                    LEFT JOIN projects p ON d.project_id = p.id
                    WHERE dm.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
                    FOR UPDATE
                ");
                $stmtM->execute([$milestoneId, $tid]);
                $ms = $stmtM->fetch(PDO::FETCH_ASSOC);

                if (!$ms && $ticketType === 'deposit') {
                    $stmtFallback = $db->prepare("
                        SELECT dm.*, d.contact_id, d.company_id, d.project_id, d.created_by as deposit_created_by,
                               c.full_name as student_name, c.tenant_id as contact_tenant_id, p.name as project_name
                        FROM deposit_milestones dm
                        JOIN deposits d ON dm.deposit_id = d.id
                        JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        WHERE d.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL AND dm.status IN ('paid', 'pending')
                        ORDER BY CASE WHEN dm.status = 'paid' THEN 0 ELSE 1 END, dm.id ASC
                        LIMIT 1
                        FOR UPDATE
                    ");
                    $stmtFallback->execute([$ticketId, $tid]);
                    $ms = $stmtFallback->fetch(PDO::FETCH_ASSOC);
                }

                if (!$ms) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy đợt đóng học phí #$milestoneId cần phê duyệt."];
                }

                $realMilestoneId = (int)$ms['id'];
                $depositId = (int)$ms['deposit_id'];

                if (!$isApprove) {
                    $upd = $db->prepare("UPDATE deposit_milestones SET status = 'failed', unc_file_path = NULL WHERE id = ?");
                    $upd->execute([$realMilestoneId]);
                    $db->commit();
                    return [
                        'ok' => true,
                        'ticket_type' => 'deposit_milestone',
                        'milestone_id' => $realMilestoneId,
                        'deposit_id' => $depositId,
                        'milestone_name' => $ms['milestone_name'],
                        'student_name' => $ms['student_name'],
                        'new_status' => 'failed',
                        'message' => "Đã TỪ CHỐI UNC đợt '{$ms['milestone_name']}' của học viên {$ms['student_name']} (Đơn #SO{$depositId}).",
                    ];
                }

                if (($ms['status'] ?? '') === 'approved') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Đợt đóng học phí '{$ms['milestone_name']}' (#$realMilestoneId) đã được duyệt trước đó."];
                }

                $actualAmount = isset($args['amount']) && (float)$args['amount'] > 0
                    ? (float)$args['amount']
                    : (float)$ms['expected_amount'];

                $updM = $db->prepare("
                    UPDATE deposit_milestones
                    SET status = 'approved', approval_date = NOW(), approved_by = ?, actual_amount = ?
                    WHERE id = ?
                ");
                $updM->execute([$uid, $actualAmount, $realMilestoneId]);

                // Automatically create a paid Invoice record matching DepositController::approveMilestone
                $invNo = 'INV-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
                $invTitle = 'Thu tiền: ' . $ms['milestone_name'] . ' - ' . ($ms['project_name'] ?: 'Đặt cọc / Học phí');
                $invNotes = "Tự động tạo từ duyệt đợt thanh toán ID: {$realMilestoneId} (Phiếu cọc #SO{$depositId})";
                $stmtInv = $db->prepare("
                    INSERT INTO invoices (tenant_id, company_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, paid_at, subtotal, tax, total, notes)
                    VALUES (?, ?, ?, ?, ?, ?, 'paid', CURDATE(), CURDATE(), NOW(), ?, 0, ?, ?)
                ");
                $stmtInv->execute([
                    $tid,
                    $ms['company_id'] ?: null,
                    $ms['contact_id'],
                    $uid,
                    $invNo,
                    $invTitle,
                    $actualAmount,
                    $actualAmount,
                    $invNotes,
                ]);
                $invoiceId = (int)$db->lastInsertId();

                // Check if all milestones of this deposit are now approved
                $stmtRem = $db->prepare("SELECT COUNT(*) FROM deposit_milestones WHERE deposit_id = ? AND status != 'approved'");
                $stmtRem->execute([$depositId]);
                $remCount = (int)$stmtRem->fetchColumn();
                $depositStatus = 'pending_admin';
                if ($remCount === 0) {
                    $db->prepare("UPDATE deposits SET status = 'approved', updated_at = NOW() WHERE id = ?")->execute([$depositId]);
                    $depositStatus = 'approved';
                }

                $db->commit();
                return [
                    'ok' => true,
                    'ticket_type' => 'deposit_milestone',
                    'milestone_id' => $realMilestoneId,
                    'deposit_id' => $depositId,
                    'milestone_name' => $ms['milestone_name'],
                    'student_name' => $ms['student_name'],
                    'actual_amount' => $actualAmount,
                    'invoice_id' => $invoiceId,
                    'invoice_number' => $invNo,
                    'new_status' => 'approved',
                    'deposit_status' => $depositStatus,
                    'message' => "Đã DUYỆT UNC đợt '{$ms['milestone_name']}' (" . number_format($actualAmount, 0, ',', '.') . " đ) cho học viên {$ms['student_name']} (#SO{$depositId}) và tự động tạo Hóa đơn thu tiền {$invNo}." . ($depositStatus === 'approved' ? " Toàn bộ các đợt đóng học phí của #SO{$depositId} đã hoàn tất!" : ''),
                ];
            }

            // =========================================================================
            // CASE 7: SALES ORDER (Đơn đặt hàng B2B sales_orders)
            // =========================================================================
            if (in_array($ticketType, ['sales_order', 'so', 'sales_orders'], true)) {
                if (!$isAdmin && !$isAccountant && $role !== 'manager') {
                    return ['ok' => false, 'error' => 'Bạn không có quyền phê duyệt Đơn đặt hàng (Sales Order).'];
                }
                $db->beginTransaction();
                $stmt = $db->prepare("SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
                $stmt->execute([$ticketId, $tid]);
                $so = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$so) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy Đơn đặt hàng (SO) #$ticketId."];
                }
                $newSt = $isApprove ? 'approved' : 'cancelled';
                $notesUpd = !$isApprove && $reason !== ''
                    ? trim(($so['notes'] ?? '') . "\n[Lý do hủy/từ chối]: " . $reason)
                    : ($so['notes'] ?? null);
                $upd = $db->prepare("UPDATE sales_orders SET status = ?, notes = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                $upd->execute([$newSt, $notesUpd, $ticketId, $tid]);
                $db->commit();

                return [
                    'ok' => true,
                    'ticket_type' => 'sales_order',
                    'ticket_id' => $ticketId,
                    'so_number' => $so['so_number'],
                    'total' => (float)$so['total'],
                    'new_status' => $newSt,
                    'message' => ($isApprove ? "Đã PHÊ DUYỆT" : "Đã HỦY/TỪ CHỐI") . " Đơn đặt hàng {$so['so_number']}.",
                ];
            }

            // =========================================================================
            // CASE 8: INVOICE (Xác nhận thanh toán Hóa đơn -> status = 'paid')
            // =========================================================================
            if (in_array($ticketType, ['invoice', 'invoices'], true)) {
                if (!$isAdmin && !$isAccountant) {
                    return ['ok' => false, 'error' => 'Chỉ Kế toán hoặc Admin mới có quyền xác nhận thanh toán Hóa đơn.'];
                }
                $db->beginTransaction();
                $stmt = $db->prepare("SELECT * FROM invoices WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL FOR UPDATE");
                $stmt->execute([$ticketId, $tid]);
                $inv = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$inv) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy Hóa đơn #$ticketId."];
                }
                $newSt = $isApprove ? 'paid' : 'cancelled';
                $upd = $db->prepare("UPDATE invoices SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                $upd->execute([$newSt, $newSt, $ticketId, $tid]);
                $db->commit();

                return [
                    'ok' => true,
                    'ticket_type' => 'invoice',
                    'ticket_id' => $ticketId,
                    'invoice_number' => $inv['invoice_number'],
                    'total' => (float)$inv['total'],
                    'new_status' => $newSt,
                    'message' => ($isApprove ? "Đã xác nhận THANH TOÁN (paid)" : "Đã HỦY") . " Hóa đơn {$inv['invoice_number']}.",
                ];
            }

            // =========================================================================
            // CASE 9: COOPERATION SLIP (Phiếu hợp tác chia hoa hồng)
            // =========================================================================
            if (in_array($ticketType, ['cooperation_slip', 'cooperation_slips', 'cooperation'], true)) {
                if (!$isAdmin && !$isAccountant) {
                    return ['ok' => false, 'error' => 'Chỉ Admin hoặc Kế toán mới có quyền phê duyệt Phiếu hợp tác chia hoa hồng.'];
                }
                $db->beginTransaction();
                $stmt = $db->prepare("
                    SELECT cs.*
                    FROM cooperation_slips cs
                    JOIN contacts c ON cs.contact_id = c.id
                    WHERE cs.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
                    FOR UPDATE
                ");
                $stmt->execute([$ticketId, $tid]);
                $cs = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$cs) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy Phiếu hợp tác #$ticketId."];
                }
                $newSt = $isApprove ? 'approved' : 'rejected';
                $upd = $db->prepare("UPDATE cooperation_slips SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?");
                $upd->execute([$newSt, $uid, $ticketId]);
                $db->commit();

                return [
                    'ok' => true,
                    'ticket_type' => 'cooperation_slip',
                    'ticket_id' => $ticketId,
                    'new_status' => $newSt,
                    'message' => ($isApprove ? "Đã PHÊ DUYỆT" : "Đã TỪ CHỐI") . " Phiếu hợp tác chia hoa hồng #$ticketId.",
                ];
            }

            return ['ok' => false, 'error' => "Loại phiếu '$ticketType' không được hỗ trợ trong luồng phê duyệt."];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            return ['ok' => false, 'error' => 'Lỗi hệ thống khi xử lý phê duyệt: ' . $e->getMessage()];
        }
    }

    /**
     * 5. Comprehensive Pending Approvals & Level Blockers Radar across 9 tables
     */
    public static function getComprehensivePendingApprovalsAndBlockers(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $isPriv = self::isFinancePrivileged($auth);
        $filterMine = !empty($args['only_my_approvals']) || (!$isPriv && empty($args['include_all']));

        $result = [
            'success' => true,
            'ok' => true,
            'summary_counts' => [],
            'pending_items' => [],
        ];

        // 1. Expenses (Phiếu đề xuất chi - Level 1, 2, 3)
        $expWhere = ["e.tenant_id = ?", "e.deleted_at IS NULL", "e.status = 'pending'"];
        $expParams = [$tid];
        if ($filterMine && !$isPriv) {
            $expWhere[] = "(e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR e.created_by = ?)";
            array_push($expParams, $uid, $uid, $uid, $uid);
        }
        $stmtExp = $db->prepare("
            SELECT e.id, e.title, e.category, e.vendor_name, e.amount, e.date, e.status, e.approval_status,
                   e.status_level_1, e.status_level_2, e.status_level_3,
                   e.approver_id, e.approver_id_2, e.approver_id_3,
                   u_cb.full_name as creator_name,
                   u1.full_name as approver_1_name,
                   u2.full_name as approver_2_name,
                   u3.full_name as approver_3_name
            FROM expenses e
            LEFT JOIN users u_cb ON e.created_by = u_cb.id
            LEFT JOIN users u1 ON e.approver_id = u1.id
            LEFT JOIN users u2 ON e.approver_id_2 = u2.id
            LEFT JOIN users u3 ON e.approver_id_3 = u3.id
            WHERE " . implode(' AND ', $expWhere) . "
            ORDER BY e.date DESC, e.id DESC LIMIT 50
        ");
        $stmtExp->execute($expParams);
        $expRows = $stmtExp->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($expRows as &$r) {
            if (($r['status_level_1'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 1';
                $r['blocking_approver_id'] = (int)($r['approver_id'] ?? 0);
                $r['blocking_approver_name'] = $r['approver_1_name'] ?: 'Chưa gán Cấp 1';
            } elseif (!empty($r['approver_id_2']) && ($r['status_level_2'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 2';
                $r['blocking_approver_id'] = (int)$r['approver_id_2'];
                $r['blocking_approver_name'] = $r['approver_2_name'] ?: 'Người duyệt Cấp 2';
            } elseif (!empty($r['approver_id_3']) && ($r['status_level_3'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 3';
                $r['blocking_approver_id'] = (int)$r['approver_id_3'];
                $r['blocking_approver_name'] = $r['approver_3_name'] ?: 'Người duyệt Cấp 3';
            } else {
                $r['blocker_stage'] = 'Pending Review';
                $r['blocking_approver_name'] = $r['approver_1_name'] ?: 'Ban Giám Đốc';
            }
        }
        unset($r);
        $result['summary_counts']['expenses_pending'] = count($expRows);
        $result['pending_items']['expenses'] = $expRows;

        // 2. Purchase Orders (Đơn mua hàng PO - Level 1, 2, 3)
        $poWhere = ["po.tenant_id = ?", "po.status = 'pending_approval'"];
        $poParams = [$tid];
        if ($filterMine && !$isPriv) {
            $poWhere[] = "(po.approver_id = ? OR po.approver_id_2 = ? OR po.approver_id_3 = ? OR po.created_by = ?)";
            array_push($poParams, $uid, $uid, $uid, $uid);
        }
        $stmtPo = $db->prepare("
            SELECT po.id, po.po_number, po.order_date, po.total, po.status, po.approval_status,
                   po.status_level_1, po.status_level_2, po.status_level_3,
                   po.approver_id, po.approver_id_2, po.approver_id_3,
                   s.name as supplier_name, u_cb.full_name as creator_name,
                   u1.full_name as approver_1_name, u2.full_name as approver_2_name, u3.full_name as approver_3_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u_cb ON po.created_by = u_cb.id
            LEFT JOIN users u1 ON po.approver_id = u1.id
            LEFT JOIN users u2 ON po.approver_id_2 = u2.id
            LEFT JOIN users u3 ON po.approver_id_3 = u3.id
            WHERE " . implode(' AND ', $poWhere) . "
            ORDER BY po.id DESC LIMIT 30
        ");
        $stmtPo->execute($poParams);
        $poRows = $stmtPo->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($poRows as &$r) {
            if (($r['status_level_1'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 1';
                $r['blocking_approver_name'] = $r['approver_1_name'] ?: 'Chưa gán Cấp 1';
            } elseif (!empty($r['approver_id_2']) && ($r['status_level_2'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 2';
                $r['blocking_approver_name'] = $r['approver_2_name'] ?: 'Người duyệt Cấp 2';
            } elseif (!empty($r['approver_id_3']) && ($r['status_level_3'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 3';
                $r['blocking_approver_name'] = $r['approver_3_name'] ?: 'Người duyệt Cấp 3';
            } else {
                $r['blocker_stage'] = 'Pending Approval';
                $r['blocking_approver_name'] = $r['approver_1_name'] ?: 'Ban Giám Đốc';
            }
        }
        unset($r);
        $result['summary_counts']['purchase_orders_pending'] = count($poRows);
        $result['pending_items']['purchase_orders'] = $poRows;

        // 3. Deposit Milestones waiting for Accountant UNC Approval (`dm.status = 'paid'`)
        $stmtDm = $db->prepare("
            SELECT dm.id as milestone_id, dm.deposit_id, dm.milestone_name, dm.expected_amount, dm.expected_pay_date,
                   dm.unc_file_path, dm.status,
                   c.full_name as student_name, c.phone as student_phone,
                   p.name as program_name, u_acc.full_name as accountant_name, u_cb.full_name as creator_name
            FROM deposit_milestones dm
            JOIN deposits d ON dm.deposit_id = d.id
            JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN projects p ON d.project_id = p.id
            LEFT JOIN users u_acc ON d.accountant_id = u_acc.id
            LEFT JOIN users u_cb ON d.created_by = u_cb.id
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND d.status NOT IN ('cancelled')
              AND dm.status = 'paid'
            ORDER BY dm.expected_pay_date ASC, dm.id DESC LIMIT 50
        ");
        $stmtDm->execute([$tid]);
        $dmRows = $stmtDm->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($dmRows as &$r) {
            $r['blocker_stage'] = 'Accountant UNC Approval';
            $r['blocking_approver_name'] = $r['accountant_name'] ?: 'Bộ phận Kế toán';
        }
        unset($r);
        $result['summary_counts']['deposit_milestones_waiting_unc'] = count($dmRows);
        $result['pending_items']['deposit_milestones_waiting_unc'] = $dmRows;

        // 4. Salary Advances (`hrm_salary_advances`)
        $stmtAdv = $db->prepare("
            SELECT sa.id, sa.amount, sa.reason, sa.status, sa.status_level_1, sa.status_level_2,
                   sa.approver_id, sa.approver_id_2, sa.created_at,
                   u.full_name as employee_name, u1.full_name as approver_1_name, u2.full_name as approver_2_name
            FROM hrm_salary_advances sa
            JOIN users u ON sa.user_id = u.id
            LEFT JOIN users u1 ON sa.approver_id = u1.id
            LEFT JOIN users u2 ON sa.approver_id_2 = u2.id
            WHERE u.tenant_id = ? AND sa.status = 'pending'
            ORDER BY sa.id DESC LIMIT 30
        ");
        $stmtAdv->execute([$tid]);
        $advRows = $stmtAdv->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($advRows as &$r) {
            if (($r['status_level_1'] ?? 'pending') === 'pending') {
                $r['blocker_stage'] = 'Level 1';
                $r['blocking_approver_name'] = $r['approver_1_name'] ?: 'Quản lý Cấp 1';
            } else {
                $r['blocker_stage'] = 'Level 2';
                $r['blocking_approver_name'] = $r['approver_2_name'] ?: 'Giám đốc / Kế toán Cấp 2';
            }
        }
        unset($r);
        $result['summary_counts']['salary_advances_pending'] = count($advRows);
        $result['pending_items']['salary_advances'] = $advRows;

        // 5. Leave Requests (`hrm_leave_requests`)
        $stmtLv = $db->prepare("
            SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.total_days, lr.reason, lr.status,
                   u_emp.full_name as employee_name, u.full_name as approver_name
            FROM hrm_leave_requests lr
            JOIN users u_emp ON lr.user_id = u_emp.id
            LEFT JOIN users u ON lr.approver_id = u.id
            WHERE u_emp.tenant_id = ? AND lr.status = 'pending'
            ORDER BY lr.id DESC LIMIT 30
        ");
        $stmtLv->execute([$tid]);
        $lvRows = $stmtLv->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $result['summary_counts']['leave_requests_pending'] = count($lvRows);
        $result['pending_items']['leave_requests'] = $lvRows;

        // 6. Check-ins & Bulk Attendance (`check_ins`, `attendance_bulk_requests`)
        $stmtCi = $db->prepare("
            SELECT ci.id, ci.check_in_date, ci.check_in_time, ci.check_out_time, ci.reason, ci.status,
                   u.full_name as employee_name
            FROM check_ins ci
            JOIN users u ON ci.user_id = u.id
            WHERE u.tenant_id = ? AND ci.status = 'pending'
            ORDER BY ci.id DESC LIMIT 30
        ");
        $stmtCi->execute([$tid]);
        $ciRows = $stmtCi->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $result['summary_counts']['check_ins_pending'] = count($ciRows);
        $result['pending_items']['check_ins'] = $ciRows;

        try {
            $stmtBulk = $db->prepare("
                SELECT abr.id, abr.reason, abr.status, abr.created_at,
                       u.full_name as requester_name
                FROM attendance_bulk_requests abr
                JOIN users u ON abr.user_id = u.id
                WHERE u.tenant_id = ? AND abr.status IN ('pending', 'pending_manager', 'pending_hr')
                ORDER BY abr.id DESC LIMIT 20
            ");
            $stmtBulk->execute([$tid]);
            $bulkRows = $stmtBulk->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
            $bulkRows = [];
        }
        $result['summary_counts']['attendance_bulk_pending'] = count($bulkRows);
        $result['pending_items']['attendance_bulk_requests'] = $bulkRows;

        // 7. Sales Orders (`sales_orders` status = 'pending_approval')
        $stmtSo = $db->prepare("
            SELECT so.id, so.so_number, so.order_date, so.total, so.status,
                   c.full_name as contact_name, comp.name as company_name, u.full_name as creator_name
            FROM sales_orders so
            LEFT JOIN contacts c ON so.contact_id = c.id
            LEFT JOIN companies comp ON so.company_id = comp.id
            LEFT JOIN users u ON so.created_by = u.id
            WHERE so.tenant_id = ? AND so.status = 'pending_approval'
            ORDER BY so.id DESC LIMIT 20
        ");
        $stmtSo->execute([$tid]);
        $soRows = $stmtSo->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $result['summary_counts']['sales_orders_pending'] = count($soRows);
        $result['pending_items']['sales_orders'] = $soRows;

        // 8. Cooperation Slips (`cooperation_slips` status = 'pending')
        $stmtCs = $db->prepare("
            SELECT cs.id, cs.contact_id, cs.deposit_slip_id, cs.total_percentage, cs.status, cs.created_at,
                   c.full_name as contact_name, u.full_name as creator_name
            FROM cooperation_slips cs
            JOIN contacts c ON cs.contact_id = c.id
            LEFT JOIN users u ON cs.created_by = u.id
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND cs.status = 'pending'
            ORDER BY cs.id DESC LIMIT 20
        ");
        $stmtCs->execute([$tid]);
        $csRows = $stmtCs->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $result['summary_counts']['cooperation_slips_pending'] = count($csRows);
        $result['pending_items']['cooperation_slips'] = $csRows;

        return $result;
    }

    /**
     * 6. Unified Tuition Receivables (`deposit_milestones` + `deposits`) & Cashflow Engine
     */
    public static function getUnifiedTuitionReceivablesAndCashflow(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $dueWithinDays = max(1, min(90, (int)($args['due_within_days'] ?? 7)));
        $fromDate = trim((string)($args['from_date'] ?? ''));
        $toDate = trim((string)($args['to_date'] ?? ''));

        // A. Summary of Tuition Milestones (`deposit_milestones` joined with `deposits` & `contacts`)
        $stmtSummary = $db->prepare("
            SELECT
                COUNT(dm.id) as total_milestones,
                COALESCE(SUM(CASE WHEN dm.status = 'approved' THEN COALESCE(NULLIF(dm.actual_amount, 0), dm.expected_amount) ELSE 0 END), 0) as collected_tuition_amount,
                COUNT(CASE WHEN dm.status = 'approved' THEN 1 END) as approved_milestones_count,
                COALESCE(SUM(CASE WHEN dm.status = 'paid' THEN dm.expected_amount ELSE 0 END), 0) as waiting_unc_approval_amount,
                COUNT(CASE WHEN dm.status = 'paid' THEN 1 END) as waiting_unc_approval_count,
                COALESCE(SUM(CASE WHEN dm.status IN ('pending', 'failed') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date < CURDATE() THEN dm.expected_amount ELSE 0 END), 0) as overdue_tuition_amount,
                COUNT(CASE WHEN dm.status IN ('pending', 'failed') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date < CURDATE() THEN 1 END) as overdue_milestones_count,
                COALESCE(SUM(CASE WHEN dm.status IN ('pending', 'failed') AND dm.expected_pay_date >= CURDATE() AND dm.expected_pay_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN dm.expected_amount ELSE 0 END), 0) as upcoming_due_amount,
                COUNT(CASE WHEN dm.status IN ('pending', 'failed') AND dm.expected_pay_date >= CURDATE() AND dm.expected_pay_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 1 END) as upcoming_due_count,
                COALESCE(SUM(CASE WHEN dm.status IN ('pending', 'failed') THEN dm.expected_amount ELSE 0 END), 0) as total_uncollected_tuition_amount
            FROM deposit_milestones dm
            JOIN deposits d ON dm.deposit_id = d.id
            JOIN contacts c ON d.contact_id = c.id
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND d.status NOT IN ('cancelled')
        ");
        $stmtSummary->execute([$dueWithinDays, $dueWithinDays, $tid]);
        $tuitionSummary = $stmtSummary->fetch(PDO::FETCH_ASSOC) ?: [];

        // B. Detailed Overdue & Upcoming & Waiting UNC Milestones
        $stmtMilestones = $db->prepare("
            SELECT dm.id as milestone_id, dm.deposit_id, CONCAT('SO-', d.id) as so_code,
                   dm.milestone_name, dm.expected_amount, dm.actual_amount, dm.expected_pay_date,
                   dm.status as milestone_status, dm.unc_file_path,
                   DATEDIFF(CURDATE(), dm.expected_pay_date) as days_overdue,
                   c.id as contact_id, c.full_name as student_name, c.phone as student_phone,
                   p.name as program_name, d.unit_code, u.full_name as owner_name
            FROM deposit_milestones dm
            JOIN deposits d ON dm.deposit_id = d.id
            JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN projects p ON d.project_id = p.id
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND d.status NOT IN ('cancelled')
              AND (
                  dm.status = 'paid'
                  OR (dm.status IN ('pending', 'failed') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY))
              )
            ORDER BY
              CASE WHEN dm.status = 'paid' THEN 0
                   WHEN dm.expected_pay_date < CURDATE() THEN 1
                   ELSE 2 END ASC,
              dm.expected_pay_date ASC
            LIMIT 40
        ");
        $stmtMilestones->execute([$tid, $dueWithinDays]);
        $actionableMilestones = $stmtMilestones->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // C. Invoices & Sales Orders Receivables
        $invDateSql = '';
        $invParams = [$tid];
        if ($fromDate !== '') {
            $invDateSql .= " AND i.issue_date >= ?";
            $invParams[] = substr($fromDate, 0, 10);
        }
        if ($toDate !== '') {
            $invDateSql .= " AND i.issue_date <= ?";
            $invParams[] = substr($toDate, 0, 10);
        }
        $stmtInv = $db->prepare("
            SELECT
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END), 0) as paid_invoices_total,
                COALESCE(SUM(CASE WHEN i.status IN ('pending', 'overdue') THEN i.total ELSE 0 END), 0) as unpaid_invoices_total,
                COALESCE(SUM(CASE WHEN i.status = 'overdue' OR (i.status = 'pending' AND i.due_date < CURDATE()) THEN i.total ELSE 0 END), 0) as overdue_invoices_total
            FROM invoices i
            WHERE i.tenant_id = ? AND i.deleted_at IS NULL $invDateSql
        ");
        $stmtInv->execute($invParams);
        $invoiceStats = $stmtInv->fetch(PDO::FETCH_ASSOC) ?: [];

        $stmtSo = $db->prepare("
            SELECT
                COUNT(so.id) as active_sales_orders_count,
                COALESCE(SUM(so.total), 0) as sales_orders_total_value,
                COALESCE(SUM(so.paid_amount), 0) as sales_orders_paid_amount,
                COALESCE(SUM(GREATEST(0, so.total - COALESCE(so.paid_amount, 0))), 0) as sales_orders_receivable_amount
            FROM sales_orders so
            WHERE so.tenant_id = ? AND so.status NOT IN ('cancelled', 'draft')
        ");
        $stmtSo->execute([$tid]);
        $soStats = $stmtSo->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'success' => true,
            'ok' => true,
            'tuition_milestone_summary' => $tuitionSummary,
            'actionable_tuition_milestones' => $actionableMilestones,
            'invoice_receivables_summary' => $invoiceStats,
            'sales_order_receivables_summary' => $soStats,
        ];
    }

    /**
     * 7. Main Execution Dispatcher for `smart_manage_po_so_and_approvals`
     */
    public static function executeSmartManagePoSoAndApprovals(PDO $db, array $args, array $auth): array
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $role = strtolower(trim((string)($auth['role'] ?? '')));
        $isPriv = self::isFinancePrivileged($auth);
        $teamUserIds = self::getManagerTeamUserIds($db, $uid, $role);

        $action = strtolower(trim((string)($args['action'] ?? '')));
        $recordType = strtolower(trim((string)($args['record_type'] ?? '')));
        $recordId = (int)($args['record_id'] ?? 0);
        $search = trim((string)($args['search_query'] ?? ''));
        $status = trim((string)($args['status'] ?? ''));
        $paymentStatus = trim((string)($args['payment_status'] ?? ''));
        $fromDate = trim((string)($args['from_date'] ?? ''));
        $toDate = trim((string)($args['to_date'] ?? ''));
        $minAmount = isset($args['min_amount']) && $args['min_amount'] !== '' ? (float)$args['min_amount'] : null;
        $maxAmount = isset($args['max_amount']) && $args['max_amount'] !== '' ? (float)$args['max_amount'] : null;

        try {
            // =====================================================================
            // A. WORKFLOW / APPROVAL / CONVERSION ACTIONS
            // =====================================================================
            if (in_array($action, ['approve_or_reject_workflow', 'approve_or_reject_deposit_milestone', 'mark_invoice_paid'], true)) {
                if ($action === 'approve_or_reject_deposit_milestone') {
                    $args['ticket_type'] = 'deposit_milestone';
                } elseif ($action === 'mark_invoice_paid') {
                    $args['ticket_type'] = 'invoice';
                    $args['decision'] = 'approve';
                } else {
                    $args['ticket_type'] = $recordType !== '' ? $recordType : 'expense';
                }
                return self::executeUnifiedApprovalTicket($db, $args, $auth);
            }

            // Disburse / Refund Expense (`disburse_expense`)
            if ($action === 'disburse_expense') {
                if (!$isPriv) {
                    return ['ok' => false, 'error' => 'Chỉ Kế toán, Ban Giám Đốc hoặc Admin mới có quyền xác nhận giải ngân phiếu chi.'];
                }
                if ($recordId <= 0) {
                    return ['ok' => false, 'error' => 'Vui lòng cung cấp record_id (ID phiếu đề xuất chi) cần xác nhận giải ngân.'];
                }
                $db->beginTransaction();
                $stmt = $db->prepare("SELECT * FROM expenses WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL FOR UPDATE");
                $stmt->execute([$recordId, $tid]);
                $exp = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$exp) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy phiếu đề xuất chi #$recordId."];
                }
                if (($exp['status'] ?? '') !== 'approved') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Phiếu đề xuất chi #$recordId chưa được phê duyệt hoàn tất (trạng thái hiện tại: {$exp['status']}), không thể giải ngân."];
                }
                if ((int)($exp['is_refunded'] ?? 0) === 1) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Phiếu đề xuất chi #$recordId đã được giải ngân trước đó."];
                }
                $uncUrl = trim((string)($args['unc_file_url'] ?? ($exp['refund_image_url'] ?? '')));
                $upd = $db->prepare("UPDATE expenses SET is_refunded = 1, refund_image_url = ?, refunded_at = NOW(), refunder_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                $upd->execute([$uncUrl !== '' ? $uncUrl : null, $uid, $recordId, $tid]);
                $db->commit();

                return [
                    'ok' => true,
                    'action' => 'disburse_expense',
                    'expense_id' => $recordId,
                    'title' => $exp['title'],
                    'amount' => (float)$exp['amount'],
                    'is_refunded' => 1,
                    'message' => "Đã xác nhận GIẢI NGÂN hoàn tất cho phiếu chi #$recordId ({$exp['title']}) - Số tiền: " . number_format((float)$exp['amount'], 0, ',', '.') . " đ.",
                ];
            }

            // Receive Purchase Order into Inventory (`receive_purchase_order`)
            if ($action === 'receive_purchase_order') {
                if (!$isPriv && $role !== 'manager') {
                    return ['ok' => false, 'error' => 'Bạn không có quyền xác nhận nhập kho Đơn mua hàng (PO).'];
                }
                if ($recordId <= 0) {
                    return ['ok' => false, 'error' => 'Vui lòng cung cấp record_id (ID Đơn mua hàng PO) cần nhập kho.'];
                }
                $db->beginTransaction();
                $stmt = $db->prepare("SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
                $stmt->execute([$recordId, $tid]);
                $po = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$po) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Không tìm thấy Đơn mua hàng #$recordId."];
                }
                if (($po['status'] ?? '') === 'received') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Đơn mua hàng {$po['po_number']} đã được nhập kho trước đó."];
                }
                if (($po['approval_status'] ?? '') !== 'approved' && ($po['status'] ?? '') !== 'ordered') {
                    $db->rollBack();
                    return ['ok' => false, 'error' => "Đơn mua hàng {$po['po_number']} chưa được phê duyệt hoàn tất, không thể nhập kho."];
                }

                $stmtItems = $db->prepare("SELECT * FROM purchase_order_items WHERE po_id = ?");
                $stmtItems->execute([$recordId]);
                $poItems = $stmtItems->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $updatedProducts = 0;
                foreach ($poItems as $item) {
                    $prodId = (int)($item['product_id'] ?? 0);
                    $qty = (int)($item['quantity'] ?? 0);
                    $unitCost = (float)($item['unit_cost'] ?? 0);
                    if ($prodId > 0 && $qty > 0) {
                        $db->prepare("UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + ?, cost = ? WHERE id = ? AND tenant_id = ?")
                            ->execute([$qty, $unitCost, $prodId, $tid]);
                        try {
                            $batchNo = 'LOT-' . date('ymd') . '-' . $recordId . '-' . $prodId;
                            $db->prepare("INSERT INTO batches (tenant_id, product_id, po_id, batch_number, quantity, remaining_qty, unit_cost, received_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())")
                                ->execute([$tid, $prodId, $recordId, $batchNo, $qty, $qty, $unitCost]);
                            $batchId = (int)$db->lastInsertId();
                            $db->prepare("INSERT INTO inventory_logs (tenant_id, product_id, batch_id, created_by, type, quantity, reference, notes) VALUES (?, ?, ?, ?, 'in', ?, ?, ?)")
                                ->execute([$tid, $prodId, $batchId ?: null, $uid, $qty, $po['po_number'], "Nhập kho từ PO {$po['po_number']}"]);
                        } catch (\Throwable $e) {
                            // Ignore if batches/inventory_logs schema optional
                        }
                        $updatedProducts++;
                    }
                }

                if (!empty($po['supplier_id'])) {
                    $db->prepare("UPDATE suppliers SET total_ordered = COALESCE(total_ordered, 0) + ? WHERE id = ? AND tenant_id = ?")
                        ->execute([(float)$po['total'], (int)$po['supplier_id'], $tid]);
                }
                $db->prepare("UPDATE purchase_orders SET status = 'received', updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                    ->execute([$recordId, $tid]);
                $db->commit();

                return [
                    'ok' => true,
                    'action' => 'receive_purchase_order',
                    'po_id' => $recordId,
                    'po_number' => $po['po_number'],
                    'updated_products_count' => $updatedProducts,
                    'new_status' => 'received',
                    'message' => "Đã xác nhận NHẬP KHO hoàn tất cho Đơn mua hàng {$po['po_number']} (cập nhật tồn kho cho $updatedProducts mặt hàng).",
                ];
            }

            // Convert Quote or Sales Order to Invoice (`convert_to_invoice`)
            if ($action === 'convert_to_invoice') {
                if ($recordId <= 0) {
                    return ['ok' => false, 'error' => 'Vui lòng cung cấp record_id của Báo giá (quote) hoặc Đơn đặt hàng (sales_order) cần chuyển thành Hóa đơn.'];
                }
                $db->beginTransaction();
                if ($recordType === 'quote' || $recordType === 'quotes') {
                    $stmtQ = $db->prepare("SELECT * FROM quotes WHERE id = ? AND tenant_id = ? FOR UPDATE");
                    $stmtQ->execute([$recordId, $tid]);
                    $q = $stmtQ->fetch(PDO::FETCH_ASSOC);
                    if (!$q) {
                        $db->rollBack();
                        return ['ok' => false, 'error' => "Không tìm thấy Báo giá #$recordId."];
                    }
                    $invNo = 'INV-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
                    $stmtIns = $db->prepare("
                        INSERT INTO invoices (tenant_id, deal_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, subtotal, discount, tax, total, notes)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([
                        $tid,
                        $q['deal_id'] ?: null,
                        $q['contact_id'] ?: null,
                        $uid,
                        $invNo,
                        $q['title'] ?: ('Hóa đơn từ Báo giá ' . $q['quote_number']),
                        (float)$q['subtotal'],
                        (float)$q['discount'],
                        (float)$q['tax'],
                        (float)$q['total'],
                        "Chuyển đổi từ Báo giá {$q['quote_number']}",
                    ]);
                    $invId = (int)$db->lastInsertId();

                    $stmtQI = $db->prepare("SELECT * FROM quote_items WHERE quote_id = ?");
                    $stmtQI->execute([$recordId]);
                    foreach ($stmtQI->fetchAll(PDO::FETCH_ASSOC) as $qi) {
                        $db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)")
                            ->execute([$invId, $qi['product_id'] ?: null, $qi['name'], $qi['quantity'], $qi['unit_price'], $qi['subtotal']]);
                    }
                    $db->prepare("UPDATE quotes SET status = 'invoiced', updated_at = NOW() WHERE id = ? AND tenant_id = ?")->execute([$recordId, $tid]);
                    $db->commit();

                    return [
                        'ok' => true,
                        'source_type' => 'quote',
                        'source_id' => $recordId,
                        'invoice_id' => $invId,
                        'invoice_number' => $invNo,
                        'total' => (float)$q['total'],
                        'message' => "Đã chuyển đổi Báo giá {$q['quote_number']} sang Hóa đơn {$invNo} (#$invId).",
                    ];
                } else {
                    $stmtSo = $db->prepare("SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
                    $stmtSo->execute([$recordId, $tid]);
                    $so = $stmtSo->fetch(PDO::FETCH_ASSOC);
                    if (!$so) {
                        $db->rollBack();
                        return ['ok' => false, 'error' => "Không tìm thấy Đơn đặt hàng (SO) #$recordId."];
                    }
                    $invNo = 'INV-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
                    $stmtIns = $db->prepare("
                        INSERT INTO invoices (tenant_id, so_id, deal_id, company_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, subtotal, discount, tax, total, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([
                        $tid,
                        $recordId,
                        $so['deal_id'] ?: null,
                        $so['company_id'] ?: null,
                        $so['contact_id'] ?: null,
                        $uid,
                        $invNo,
                        'Hóa đơn từ Đơn đặt hàng ' . $so['so_number'],
                        (float)$so['subtotal'],
                        (float)$so['discount'],
                        (float)$so['tax'],
                        (float)$so['total'],
                        $so['notes'] ?: "Chuyển đổi từ Đơn hàng {$so['so_number']}",
                    ]);
                    $invId = (int)$db->lastInsertId();

                    $stmtSI = $db->prepare("SELECT * FROM sales_order_items WHERE so_id = ?");
                    $stmtSI->execute([$recordId]);
                    foreach ($stmtSI->fetchAll(PDO::FETCH_ASSOC) as $si) {
                        $db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)")
                            ->execute([$invId, $si['product_id'] ?: null, $si['name'], $si['quantity'], $si['unit_price'], $si['subtotal']]);
                    }
                    $db->prepare("UPDATE sales_orders SET status = 'completed', invoice_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                        ->execute([$invId, $recordId, $tid]);
                    $db->commit();

                    return [
                        'ok' => true,
                        'source_type' => 'sales_order',
                        'source_id' => $recordId,
                        'invoice_id' => $invId,
                        'invoice_number' => $invNo,
                        'total' => (float)$so['total'],
                        'message' => "Đã chuyển đổi Đơn đặt hàng {$so['so_number']} sang Hóa đơn {$invNo} (#$invId).",
                    ];
                }
            }

            // =====================================================================
            // B. QUERY & DETAIL ACTIONS
            // =====================================================================
            if (in_array($action, ['query_all_po_so_invoices_quotes', 'query_all', 'overview'], true)) {
                $stmtPoCnt = $db->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as sum_total FROM purchase_orders WHERE tenant_id = ? AND status NOT IN ('cancelled')");
                $stmtPoCnt->execute([$tid]);
                $poSum = $stmtPoCnt->fetch(PDO::FETCH_ASSOC) ?: ['cnt' => 0, 'sum_total' => 0];

                $stmtSoCnt = $db->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as sum_total FROM sales_orders WHERE tenant_id = ? AND status NOT IN ('cancelled')");
                $stmtSoCnt->execute([$tid]);
                $soSum = $stmtSoCnt->fetch(PDO::FETCH_ASSOC) ?: ['cnt' => 0, 'sum_total' => 0];

                $stmtInvCnt = $db->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as sum_total FROM invoices WHERE tenant_id = ? AND deleted_at IS NULL AND status NOT IN ('cancelled')");
                $stmtInvCnt->execute([$tid]);
                $invSum = $stmtInvCnt->fetch(PDO::FETCH_ASSOC) ?: ['cnt' => 0, 'sum_total' => 0];

                $stmtQuoCnt = $db->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as sum_total FROM quotes WHERE tenant_id = ?");
                $stmtQuoCnt->execute([$tid]);
                $quoSum = $stmtQuoCnt->fetch(PDO::FETCH_ASSOC) ?: ['cnt' => 0, 'sum_total' => 0];

                $stmtSupCnt = $db->prepare("SELECT COUNT(*) as cnt FROM suppliers WHERE tenant_id = ? AND deleted_at IS NULL");
                $stmtSupCnt->execute([$tid]);
                $supCnt = (int)$stmtSupCnt->fetchColumn();

                return [
                    'ok' => true,
                    'action' => 'query_all_po_so_invoices_quotes',
                    'summary' => [
                        'purchase_orders' => ['count' => (int)$poSum['cnt'], 'total_amount' => (float)$poSum['sum_total'], 'export_url' => '/export?type=purchase_order'],
                        'sales_orders' => ['count' => (int)$soSum['cnt'], 'total_amount' => (float)$soSum['sum_total'], 'export_url' => '/export?type=sales_order'],
                        'invoices' => ['count' => (int)$invSum['cnt'], 'total_amount' => (float)$invSum['sum_total'], 'export_url' => '/export?type=invoice'],
                        'quotes' => ['count' => (int)$quoSum['cnt'], 'total_amount' => (float)$quoSum['sum_total'], 'export_url' => '/export?type=quote'],
                        'suppliers_count' => $supCnt,
                    ],
                ];
            }

            if ($action === 'query_purchase_orders') {
                $where = ["po.tenant_id = ?"];
                $params = [$tid];
                if (!$isPriv) {
                    $ph = implode(',', array_fill(0, count($teamUserIds), '?'));
                    $where[] = "(po.created_by IN ($ph) OR po.approver_id = ? OR po.approver_id_2 = ? OR po.approver_id_3 = ?)";
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                    array_push($params, $uid, $uid, $uid);
                }
                if (!empty($args['supplier_id'])) {
                    $where[] = "po.supplier_id = ?";
                    $params[] = (int)$args['supplier_id'];
                }
                if ($status !== '') {
                    if ($status === 'pending_l1') {
                        $where[] = "po.status = 'pending_approval' AND po.status_level_1 = 'pending'";
                    } elseif ($status === 'pending_l2') {
                        $where[] = "po.status = 'pending_approval' AND po.status_level_1 = 'approved' AND po.status_level_2 = 'pending'";
                    } elseif ($status === 'pending_l3') {
                        $where[] = "po.status = 'pending_approval' AND po.status_level_2 = 'approved' AND po.status_level_3 = 'pending'";
                    } else {
                        $where[] = "po.status = ?";
                        $params[] = $status;
                    }
                }
                if ($paymentStatus !== '') {
                    $where[] = "po.payment_status = ?";
                    $params[] = $paymentStatus;
                }
                if ($fromDate !== '') {
                    $where[] = "po.order_date >= ?";
                    $params[] = substr($fromDate, 0, 10);
                }
                if ($toDate !== '') {
                    $where[] = "po.order_date <= ?";
                    $params[] = substr($toDate, 0, 10);
                }
                if ($minAmount !== null) {
                    $where[] = "po.total >= ?";
                    $params[] = $minAmount;
                }
                if ($maxAmount !== null) {
                    $where[] = "po.total <= ?";
                    $params[] = $maxAmount;
                }
                if ($search !== '') {
                    $where[] = "(po.po_number LIKE ? OR po.notes LIKE ? OR s.name LIKE ?)";
                    array_push($params, "%$search%", "%$search%", "%$search%");
                }
                $poCols = [
                    'id' => 'po.id', 'supplier_id' => 'po.supplier_id', 'beneficiary_type' => 'po.beneficiary_type',
                    'beneficiary_id' => 'po.beneficiary_id', 'created_by' => 'po.created_by', 'po_number' => 'po.po_number',
                    'order_date' => 'po.order_date', 'status' => 'po.status', 'subtotal' => 'po.subtotal',
                    'tax' => 'po.tax', 'total' => 'po.total', 'notes' => 'po.notes', 'approver_id' => 'po.approver_id',
                    'approver_id_2' => 'po.approver_id_2', 'approver_id_3' => 'po.approver_id_3',
                    'status_level_1' => 'po.status_level_1', 'status_level_2' => 'po.status_level_2',
                    'status_level_3' => 'po.status_level_3', 'approval_status' => 'po.approval_status',
                    'payment_status' => 'po.payment_status', 'paid_amount' => 'po.paid_amount',
                ];
                if (!empty($args['custom_rules'])) {
                    self::applyCustomRulesToWhere((string)$args['custom_rules'], $poCols, $where, $params);
                }
                $wSql = implode(' AND ', $where);
                $stmt = $db->prepare("
                    SELECT po.*, s.name as supplier_name, u.full_name as creator_name,
                           u1.full_name as approver_1_name, u2.full_name as approver_2_name, u3.full_name as approver_3_name
                    FROM purchase_orders po
                    LEFT JOIN suppliers s ON po.supplier_id = s.id
                    LEFT JOIN users u ON po.created_by = u.id
                    LEFT JOIN users u1 ON po.approver_id = u1.id
                    LEFT JOIN users u2 ON po.approver_id_2 = u2.id
                    LEFT JOIN users u3 ON po.approver_id_3 = u3.id
                    WHERE $wSql
                    ORDER BY po.id DESC LIMIT 50
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $totalSum = array_sum(array_map(fn($r) => (float)($r['total'] ?? 0), $rows));
                return [
                    'ok' => true,
                    'record_type' => 'purchase_order',
                    'count' => count($rows),
                    'total_amount' => $totalSum,
                    'export_url' => '/export?type=purchase_order&' . http_build_query(array_filter([
                        'status' => $status, 'payment_status' => $paymentStatus, 'search' => $search, 'from' => $fromDate, 'to' => $toDate,
                    ])),
                    'items' => $rows,
                ];
            }

            if (in_array($action, ['query_suppliers', 'list_or_manage_suppliers', 'list_suppliers'], true)) {
                $where = ["s.tenant_id = ?", "s.deleted_at IS NULL"];
                $params = [$tid];
                if ($search !== '') {
                    $where[] = "(s.name LIKE ? OR s.contact_name LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.tax_code LIKE ? OR s.focused_type LIKE ?)";
                    array_push($params, "%$search%", "%$search%", "%$search%", "%$search%", "%$search%", "%$search%");
                }
                if ($status !== '') {
                    $where[] = "s.cooperation_status = ?";
                    $params[] = $status;
                }
                $supCols = [
                    'id' => 's.id', 'name' => 's.name', 'contact_name' => 's.contact_name', 'email' => 's.email',
                    'phone' => 's.phone', 'address' => 's.address', 'tax_code' => 's.tax_code', 'notes' => 's.notes',
                    'total_ordered' => 's.total_ordered', 'contact_position' => 's.contact_position', 'website' => 's.website',
                    'scale_capital' => 's.scale_capital', 'typical_projects' => 's.typical_projects', 'focused_type' => 's.focused_type',
                    'prestige_tier' => 's.prestige_tier', 'cooperation_status' => 's.cooperation_status', 'bank_account' => 's.bank_account',
                ];
                if (!empty($args['custom_rules'])) {
                    self::applyCustomRulesToWhere((string)$args['custom_rules'], $supCols, $where, $params);
                }
                $wSql = implode(' AND ', $where);
                $stmt = $db->prepare("SELECT s.* FROM suppliers s WHERE $wSql ORDER BY s.total_ordered DESC, s.id DESC LIMIT 50");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                return [
                    'ok' => true,
                    'record_type' => 'supplier',
                    'count' => count($rows),
                    'export_url' => '/export?type=supplier&' . http_build_query(array_filter(['search' => $search])),
                    'items' => $rows,
                ];
            }

            if ($action === 'query_sales_orders') {
                $where = ["so.tenant_id = ?"];
                $params = [$tid];
                if (!$isPriv) {
                    $ph = implode(',', array_fill(0, count($teamUserIds), '?'));
                    $where[] = "(so.created_by IN ($ph) OR c.owner_id IN ($ph))";
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                }
                if ($status !== '') {
                    $where[] = "so.status = ?";
                    $params[] = $status;
                }
                if ($paymentStatus !== '') {
                    $where[] = "so.payment_status = ?";
                    $params[] = $paymentStatus;
                }
                if (!empty($args['contact_id'])) {
                    $where[] = "so.contact_id = ?";
                    $params[] = (int)$args['contact_id'];
                }
                if (!empty($args['company_id'])) {
                    $where[] = "so.company_id = ?";
                    $params[] = (int)$args['company_id'];
                }
                if ($fromDate !== '') {
                    $where[] = "so.order_date >= ?";
                    $params[] = substr($fromDate, 0, 10);
                }
                if ($toDate !== '') {
                    $where[] = "so.order_date <= ?";
                    $params[] = substr($toDate, 0, 10);
                }
                if ($minAmount !== null) {
                    $where[] = "so.total >= ?";
                    $params[] = $minAmount;
                }
                if ($maxAmount !== null) {
                    $where[] = "so.total <= ?";
                    $params[] = $maxAmount;
                }
                if ($search !== '') {
                    $where[] = "(so.so_number LIKE ? OR so.notes LIKE ? OR c.full_name LIKE ? OR comp.name LIKE ?)";
                    array_push($params, "%$search%", "%$search%", "%$search%", "%$search%");
                }
                $soCols = [
                    'id' => 'so.id', 'contact_id' => 'so.contact_id', 'company_id' => 'so.company_id', 'deal_id' => 'so.deal_id',
                    'quote_id' => 'so.quote_id', 'invoice_id' => 'so.invoice_id', 'created_by' => 'so.created_by',
                    'so_number' => 'so.so_number', 'order_date' => 'so.order_date', 'delivery_date' => 'so.delivery_date',
                    'status' => 'so.status', 'payment_status' => 'so.payment_status', 'paid_amount' => 'so.paid_amount',
                    'subtotal' => 'so.subtotal', 'discount' => 'so.discount', 'tax' => 'so.tax', 'total' => 'so.total',
                ];
                if (!empty($args['custom_rules'])) {
                    self::applyCustomRulesToWhere((string)$args['custom_rules'], $soCols, $where, $params);
                }
                $wSql = implode(' AND ', $where);
                $stmt = $db->prepare("
                    SELECT so.*, c.full_name as contact_name, comp.name as company_name, u.full_name as creator_name
                    FROM sales_orders so
                    LEFT JOIN contacts c ON so.contact_id = c.id
                    LEFT JOIN companies comp ON so.company_id = comp.id
                    LEFT JOIN users u ON so.created_by = u.id
                    WHERE $wSql
                    ORDER BY so.id DESC LIMIT 50
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $totalSum = array_sum(array_map(fn($r) => (float)($r['total'] ?? 0), $rows));
                return [
                    'ok' => true,
                    'record_type' => 'sales_order',
                    'count' => count($rows),
                    'total_amount' => $totalSum,
                    'export_url' => '/export?type=sales_order&' . http_build_query(array_filter([
                        'status' => $status, 'payment_status' => $paymentStatus, 'search' => $search, 'from' => $fromDate, 'to' => $toDate,
                    ])),
                    'items' => $rows,
                ];
            }

            if ($action === 'query_invoices') {
                $where = ["i.tenant_id = ?", "i.deleted_at IS NULL"];
                $params = [$tid];
                if (!$isPriv) {
                    $ph = implode(',', array_fill(0, count($teamUserIds), '?'));
                    $where[] = "(i.created_by IN ($ph) OR c.owner_id IN ($ph))";
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                }
                if ($status !== '') {
                    $where[] = "i.status = ?";
                    $params[] = $status;
                }
                if (!empty($args['contact_id'])) {
                    $where[] = "i.contact_id = ?";
                    $params[] = (int)$args['contact_id'];
                }
                if (!empty($args['company_id'])) {
                    $where[] = "i.company_id = ?";
                    $params[] = (int)$args['company_id'];
                }
                if ($fromDate !== '') {
                    $where[] = "i.issue_date >= ?";
                    $params[] = substr($fromDate, 0, 10);
                }
                if ($toDate !== '') {
                    $where[] = "i.issue_date <= ?";
                    $params[] = substr($toDate, 0, 10);
                }
                if ($minAmount !== null) {
                    $where[] = "i.total >= ?";
                    $params[] = $minAmount;
                }
                if ($maxAmount !== null) {
                    $where[] = "i.total <= ?";
                    $params[] = $maxAmount;
                }
                if ($search !== '') {
                    $where[] = "(i.invoice_number LIKE ? OR i.title LIKE ? OR i.notes LIKE ? OR c.full_name LIKE ? OR comp.name LIKE ?)";
                    array_push($params, "%$search%", "%$search%", "%$search%", "%$search%", "%$search%");
                }
                $invCols = [
                    'id' => 'i.id', 'deal_id' => 'i.deal_id', 'so_id' => 'i.so_id', 'company_id' => 'i.company_id',
                    'contact_id' => 'i.contact_id', 'created_by' => 'i.created_by', 'invoice_number' => 'i.invoice_number',
                    'title' => 'i.title', 'status' => 'i.status', 'issue_date' => 'i.issue_date', 'due_date' => 'i.due_date',
                    'paid_at' => 'i.paid_at', 'subtotal' => 'i.subtotal', 'discount' => 'i.discount', 'tax' => 'i.tax',
                    'total' => 'i.total', 'shipping_fee' => 'i.shipping_fee', 'is_inventory_deducted' => 'i.is_inventory_deducted',
                ];
                if (!empty($args['custom_rules'])) {
                    self::applyCustomRulesToWhere((string)$args['custom_rules'], $invCols, $where, $params);
                }
                $wSql = implode(' AND ', $where);
                $stmt = $db->prepare("
                    SELECT i.*, c.full_name as contact_name, comp.name as company_name, u.full_name as creator_name
                    FROM invoices i
                    LEFT JOIN contacts c ON i.contact_id = c.id
                    LEFT JOIN companies comp ON i.company_id = comp.id
                    LEFT JOIN users u ON i.created_by = u.id
                    WHERE $wSql
                    ORDER BY i.id DESC LIMIT 50
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $totalSum = array_sum(array_map(fn($r) => (float)($r['total'] ?? 0), $rows));
                return [
                    'ok' => true,
                    'record_type' => 'invoice',
                    'count' => count($rows),
                    'total_amount' => $totalSum,
                    'export_url' => '/export?type=invoice&' . http_build_query(array_filter([
                        'status' => $status, 'search' => $search, 'from' => $fromDate, 'to' => $toDate,
                    ])),
                    'items' => $rows,
                ];
            }

            if ($action === 'query_quotes') {
                $where = ["q.tenant_id = ?"];
                $params = [$tid];
                if (!$isPriv) {
                    $ph = implode(',', array_fill(0, count($teamUserIds), '?'));
                    $where[] = "(q.created_by IN ($ph) OR c.owner_id IN ($ph))";
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                    foreach ($teamUserIds as $idVal) {
                        $params[] = $idVal;
                    }
                }
                if ($status !== '') {
                    $where[] = "q.status = ?";
                    $params[] = $status;
                }
                if (!empty($args['contact_id'])) {
                    $where[] = "q.contact_id = ?";
                    $params[] = (int)$args['contact_id'];
                }
                if ($search !== '') {
                    $where[] = "(q.quote_number LIKE ? OR q.title LIKE ? OR q.notes LIKE ? OR c.full_name LIKE ?)";
                    array_push($params, "%$search%", "%$search%", "%$search%", "%$search%");
                }
                $quoteCols = [
                    'id' => 'q.id', 'deal_id' => 'q.deal_id', 'contact_id' => 'q.contact_id', 'created_by' => 'q.created_by',
                    'quote_number' => 'q.quote_number', 'title' => 'q.title', 'status' => 'q.status',
                    'subtotal' => 'q.subtotal', 'discount' => 'q.discount', 'tax' => 'q.tax', 'total' => 'q.total',
                    'valid_until' => 'q.valid_until',
                ];
                if (!empty($args['custom_rules'])) {
                    self::applyCustomRulesToWhere((string)$args['custom_rules'], $quoteCols, $where, $params);
                }
                $wSql = implode(' AND ', $where);
                $stmt = $db->prepare("
                    SELECT q.*, c.full_name as contact_name, u.full_name as creator_name
                    FROM quotes q
                    LEFT JOIN contacts c ON q.contact_id = c.id
                    LEFT JOIN users u ON q.created_by = u.id
                    WHERE $wSql
                    ORDER BY q.id DESC LIMIT 50
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $totalSum = array_sum(array_map(fn($r) => (float)($r['total'] ?? 0), $rows));
                return [
                    'ok' => true,
                    'record_type' => 'quote',
                    'count' => count($rows),
                    'total_amount' => $totalSum,
                    'export_url' => '/export?type=quote&' . http_build_query(array_filter([
                        'status' => $status, 'search' => $search,
                    ])),
                    'items' => $rows,
                ];
            }

            if ($action === 'query_cooperation_slips') {
                $where = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
                $params = [$tid];
                if ($status !== '') {
                    $where[] = "cs.status = ?";
                    $params[] = $status;
                }
                if (!empty($args['contact_id'])) {
                    $where[] = "cs.contact_id = ?";
                    $params[] = (int)$args['contact_id'];
                }
                if ($search !== '') {
                    $where[] = "(c.full_name LIKE ? OR cs.full_name LIKE ? OR cs.dispute_details LIKE ?)";
                    array_push($params, "%$search%", "%$search%", "%$search%");
                }
                $wSql = implode(' AND ', $where);
                $stmt = $db->prepare("
                    SELECT cs.*, c.full_name as contact_name, u.full_name as creator_name, ua.full_name as approver_name
                    FROM cooperation_slips cs
                    JOIN contacts c ON cs.contact_id = c.id
                    LEFT JOIN users u ON cs.created_by = u.id
                    LEFT JOIN users ua ON cs.approved_by = ua.id
                    WHERE $wSql
                    ORDER BY cs.id DESC LIMIT 50
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                return [
                    'ok' => true,
                    'record_type' => 'cooperation_slip',
                    'count' => count($rows),
                    'items' => $rows,
                ];
            }

            // Get full detail of any PO or SO record (`get_po_or_so_detail`)
            if ($action === 'get_po_or_so_detail') {
                $codeOrNum = trim((string)($args['code_or_number'] ?? ''));
                if ($recordId <= 0 && $codeOrNum !== '') {
                    if (stripos($codeOrNum, 'PO-') === 0) {
                        $recordType = 'purchase_order';
                    } elseif (stripos($codeOrNum, 'SO-') === 0) {
                        $recordType = 'sales_order';
                    } elseif (stripos($codeOrNum, '#SO') === 0) {
                        $recordType = 'deposit';
                        $recordId = (int)preg_replace('/[^0-9]/', '', $codeOrNum);
                    } elseif (stripos($codeOrNum, 'INV-') === 0) {
                        $recordType = 'invoice';
                    } elseif (stripos($codeOrNum, 'QUO-') === 0) {
                        $recordType = 'quote';
                    } else {
                        $recordId = (int)preg_replace('/[^0-9]/', '', $codeOrNum);
                    }
                }

                if ($recordType === 'deposit' || $recordType === 'deposit_milestone') {
                    $stmt = $db->prepare("
                        SELECT d.*, c.full_name as contact_name, c.phone as contact_phone, p.name as project_name,
                               u.full_name as creator_name, ua.full_name as accountant_name
                        FROM deposits d
                        JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        LEFT JOIN users u ON d.created_by = u.id
                        LEFT JOIN users ua ON d.accountant_id = ua.id
                        WHERE d.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
                    ");
                    $stmt->execute([$recordId, $tid]);
                    $dep = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$dep) {
                        return ['ok' => false, 'error' => "Không tìm thấy Đơn đặt cọc học phí #SO{$recordId}."];
                    }
                    $stmtM = $db->prepare("SELECT dm.*, u.full_name as approved_by_name FROM deposit_milestones dm LEFT JOIN users u ON dm.approved_by = u.id WHERE dm.deposit_id = ? ORDER BY dm.id ASC");
                    $stmtM->execute([$recordId]);
                    $dep['milestones'] = $stmtM->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    return ['ok' => true, 'record_type' => 'deposit', 'record' => $dep];
                }

                if ($recordType === 'purchase_order') {
                    $stmt = $recordId > 0
                        ? $db->prepare("SELECT po.*, s.name as supplier_name, u.full_name as creator_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN users u ON po.created_by = u.id WHERE po.id = ? AND po.tenant_id = ?")
                        : $db->prepare("SELECT po.*, s.name as supplier_name, u.full_name as creator_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN users u ON po.created_by = u.id WHERE po.po_number = ? AND po.tenant_id = ?");
                    $stmt->execute([$recordId > 0 ? $recordId : $codeOrNum, $tid]);
                    $po = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$po) {
                        return ['ok' => false, 'error' => 'Không tìm thấy Đơn mua hàng (PO).'];
                    }
                    $stmtI = $db->prepare("SELECT * FROM purchase_order_items WHERE po_id = ?");
                    $stmtI->execute([(int)$po['id']]);
                    $po['items'] = $stmtI->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    return ['ok' => true, 'record_type' => 'purchase_order', 'record' => $po];
                }

                if ($recordType === 'sales_order') {
                    $stmt = $recordId > 0
                        ? $db->prepare("SELECT so.*, c.full_name as contact_name, comp.name as company_name FROM sales_orders so LEFT JOIN contacts c ON so.contact_id = c.id LEFT JOIN companies comp ON so.company_id = comp.id WHERE so.id = ? AND so.tenant_id = ?")
                        : $db->prepare("SELECT so.*, c.full_name as contact_name, comp.name as company_name FROM sales_orders so LEFT JOIN contacts c ON so.contact_id = c.id LEFT JOIN companies comp ON so.company_id = comp.id WHERE so.so_number = ? AND so.tenant_id = ?");
                    $stmt->execute([$recordId > 0 ? $recordId : $codeOrNum, $tid]);
                    $so = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$so) {
                        return ['ok' => false, 'error' => 'Không tìm thấy Đơn đặt hàng (Sales Order).'];
                    }
                    $stmtI = $db->prepare("SELECT * FROM sales_order_items WHERE so_id = ? ORDER BY sort_order ASC, id ASC");
                    $stmtI->execute([(int)$so['id']]);
                    $so['items'] = $stmtI->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    return ['ok' => true, 'record_type' => 'sales_order', 'record' => $so];
                }

                if ($recordType === 'invoice') {
                    $stmt = $recordId > 0
                        ? $db->prepare("SELECT i.*, c.full_name as contact_name, comp.name as company_name FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id LEFT JOIN companies comp ON i.company_id = comp.id WHERE i.id = ? AND i.tenant_id = ? AND i.deleted_at IS NULL")
                        : $db->prepare("SELECT i.*, c.full_name as contact_name, comp.name as company_name FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id LEFT JOIN companies comp ON i.company_id = comp.id WHERE i.invoice_number = ? AND i.tenant_id = ? AND i.deleted_at IS NULL");
                    $stmt->execute([$recordId > 0 ? $recordId : $codeOrNum, $tid]);
                    $inv = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$inv) {
                        return ['ok' => false, 'error' => 'Không tìm thấy Hóa đơn.'];
                    }
                    $stmtI = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
                    $stmtI->execute([(int)$inv['id']]);
                    $inv['items'] = $stmtI->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    return ['ok' => true, 'record_type' => 'invoice', 'record' => $inv];
                }

                // Default to expense
                $stmt = $db->prepare("
                    SELECT e.*, u.full_name as creator_name, u1.full_name as approver_1_name, u2.full_name as approver_2_name, u3.full_name as approver_3_name
                    FROM expenses e
                    LEFT JOIN users u ON e.created_by = u.id
                    LEFT JOIN users u1 ON e.approver_id = u1.id
                    LEFT JOIN users u2 ON e.approver_id_2 = u2.id
                    LEFT JOIN users u3 ON e.approver_id_3 = u3.id
                    WHERE e.id = ? AND e.tenant_id = ? AND e.deleted_at IS NULL
                ");
                $stmt->execute([$recordId, $tid]);
                $exp = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$exp) {
                    return ['ok' => false, 'error' => "Không tìm thấy phiếu đề xuất chi #$recordId."];
                }
                return ['ok' => true, 'record_type' => 'expense', 'record' => $exp];
            }

            // =====================================================================
            // C. CREATE / UPDATE PO & SO RECORDS
            // =====================================================================
            if ($action === 'create_expense_proposal' || $action === 'update_expense_proposal') {
                $title = trim((string)($args['title'] ?? ''));
                $amount = isset($args['amount']) ? (float)$args['amount'] : 0;
                $category = trim((string)($args['category'] ?? 'Chi phí vận hành'));
                $vendorName = trim((string)($args['vendor_name'] ?? ''));
                $notes = trim((string)($args['notes'] ?? ''));
                $dueDate = !empty($args['due_date']) ? substr(trim((string)$args['due_date']), 0, 10) : date('Y-m-d');
                $hasVat = !empty($args['has_vat_invoice']) ? 1 : 0;
                $incVat = !empty($args['is_vat_inclusive']) ? 1 : 0;
                $vatAmount = isset($args['tax']) ? (float)$args['tax'] : 0;

                if ($action === 'create_expense_proposal') {
                    if ($title === '' || $amount <= 0) {
                        return ['ok' => false, 'error' => 'Vui lòng cung cấp tiêu đề phiếu chi (title) và số tiền (amount > 0).'];
                    }
                    $app1 = !empty($args['approver_id']) ? (int)$args['approver_id'] : null;
                    $app2 = !empty($args['approver_id_2']) ? (int)$args['approver_id_2'] : null;
                    $app3 = !empty($args['approver_id_3']) ? (int)$args['approver_id_3'] : null;
                    if (!$app1) {
                        $stmtDir = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND deleted_at IS NULL AND role IN ('director', 'admin', 'superadmin') AND id != ? ORDER BY CASE WHEN role = 'director' THEN 0 ELSE 1 END, id ASC LIMIT 1");
                        $stmtDir->execute([$tid, $uid]);
                        $app1 = (int)$stmtDir->fetchColumn() ?: $uid;
                    }
                    $st1 = 'pending';
                    $st2 = $app2 ? 'pending' : 'none';
                    $st3 = $app3 ? 'pending' : 'none';

                    $stmtIns = $db->prepare("
                        INSERT INTO expenses (tenant_id, created_by, approver_id, approver_id_2, approver_id_3, status_level_1, status_level_2, status_level_3, approval_status, title, category, vendor_name, amount, currency, vat_amount, date, due_date, status, notes, has_vat_invoice, is_vat_inclusive)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'VND', ?, CURDATE(), ?, 'pending', ?, ?, ?)
                    ");
                    $stmtIns->execute([$tid, $uid, $app1, $app2, $app3, $st1, $st2, $st3, $title, $category, $vendorName ?: null, $amount, $vatAmount, $dueDate, $notes ?: null, $hasVat, $incVat]);
                    $newId = (int)$db->lastInsertId();

                    if (!empty($args['contact_id'])) {
                        $db->prepare("INSERT INTO expense_entities (expense_id, entity_type, entity_id, amount) VALUES (?, 'contact', ?, ?)")
                            ->execute([$newId, (int)$args['contact_id'], $amount]);
                    }
                    return [
                        'ok' => true,
                        'action' => 'create_expense_proposal',
                        'expense_id' => $newId,
                        'title' => $title,
                        'amount' => $amount,
                        'status' => 'pending',
                        'message' => "Đã tạo Phiếu đề xuất chi #PO{$newId} ({$title}) với số tiền " . number_format($amount, 0, ',', '.') . " đ.",
                    ];
                } else {
                    if ($recordId <= 0) {
                        return ['ok' => false, 'error' => 'Vui lòng cung cấp record_id của phiếu đề xuất chi cần cập nhật.'];
                    }
                    $stmt = $db->prepare("SELECT * FROM expenses WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
                    $stmt->execute([$recordId, $tid]);
                    $exp = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$exp) {
                        return ['ok' => false, 'error' => "Không tìm thấy phiếu đề xuất chi #$recordId."];
                    }
                    $updTitle = $title !== '' ? $title : $exp['title'];
                    $updAmount = $amount > 0 ? $amount : (float)$exp['amount'];
                    $updCat = !empty($args['category']) ? $category : $exp['category'];
                    $updNotes = $notes !== '' ? $notes : $exp['notes'];
                    $db->prepare("UPDATE expenses SET title = ?, amount = ?, category = ?, notes = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                        ->execute([$updTitle, $updAmount, $updCat, $updNotes, $recordId, $tid]);
                    return [
                        'ok' => true,
                        'action' => 'update_expense_proposal',
                        'expense_id' => $recordId,
                        'title' => $updTitle,
                        'amount' => $updAmount,
                        'message' => "Đã cập nhật Phiếu đề xuất chi #$recordId ({$updTitle}).",
                    ];
                }
            }

            if ($action === 'create_or_update_supplier') {
                $name = trim((string)($args['vendor_name'] ?? ($args['title'] ?? '')));
                if ($recordId <= 0 && $name === '') {
                    return ['ok' => false, 'error' => 'Vui lòng cung cấp tên nhà cung cấp (vendor_name / title).'];
                }
                if ($recordId > 0) {
                    $db->prepare("UPDATE suppliers SET name = COALESCE(NULLIF(?, ''), name), bank_account = COALESCE(NULLIF(?, ''), bank_account), notes = COALESCE(NULLIF(?, ''), notes), updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                        ->execute([$name, trim((string)($args['bank_account'] ?? '')), trim((string)($args['notes'] ?? '')), $recordId, $tid]);
                    return ['ok' => true, 'supplier_id' => $recordId, 'message' => "Đã cập nhật Nhà cung cấp #$recordId."];
                }
                $stmtIns = $db->prepare("INSERT INTO suppliers (tenant_id, created_by, name, contact_name, phone, bank_account, notes, cooperation_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Đang hợp tác')");
                $stmtIns->execute([
                    $tid, $uid, $name,
                    trim((string)($args['contact_name'] ?? '')) ?: null,
                    trim((string)($args['search_query'] ?? '')) ?: null,
                    trim((string)($args['bank_account'] ?? '')) ?: null,
                    trim((string)($args['notes'] ?? '')) ?: null,
                ]);
                $supId = (int)$db->lastInsertId();
                return ['ok' => true, 'supplier_id' => $supId, 'name' => $name, 'message' => "Đã thêm Nhà cung cấp mới '$name' (#$supId)."];
            }

            if ($action === 'create_purchase_order') {
                $supplierId = (int)($args['supplier_id'] ?? 0);
                $items = is_array($args['items'] ?? null) ? $args['items'] : [];
                $subtotal = 0.0;
                foreach ($items as $it) {
                    $qty = max(1, (float)($it['quantity'] ?? 1));
                    $cost = max(0, (float)($it['unit_cost'] ?? ($it['unit_price'] ?? 0)));
                    $subtotal += $qty * $cost;
                }
                if ($subtotal <= 0 && isset($args['amount']) && (float)$args['amount'] > 0) {
                    $subtotal = (float)$args['amount'];
                    $items = [['name' => $args['title'] ?? 'Hàng hóa mua vào', 'quantity' => 1, 'unit_cost' => $subtotal]];
                }
                if ($subtotal <= 0) {
                    return ['ok' => false, 'error' => 'Vui lòng cung cấp danh sách mặt hàng (items) hoặc tổng tiền (amount > 0) để lập Đơn mua hàng (PO).'];
                }
                $tax = isset($args['tax']) ? (float)$args['tax'] : 0.0;
                $total = $subtotal + $tax;
                $poNo = 'PO-' . str_pad((string)random_int(1000, 99999), 5, '0', STR_PAD_LEFT);
                $app1 = !empty($args['approver_id']) ? (int)$args['approver_id'] : null;
                $app2 = !empty($args['approver_id_2']) ? (int)$args['approver_id_2'] : null;
                $app3 = !empty($args['approver_id_3']) ? (int)$args['approver_id_3'] : null;
                if (!$app1) {
                    $stmtDir = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND deleted_at IS NULL AND role IN ('director', 'admin', 'superadmin') AND id != ? LIMIT 1");
                    $stmtDir->execute([$tid, $uid]);
                    $app1 = (int)$stmtDir->fetchColumn() ?: $uid;
                }

                $db->beginTransaction();
                $stmtPo = $db->prepare("
                    INSERT INTO purchase_orders (tenant_id, supplier_id, created_by, po_number, order_date, status, subtotal, tax, total, notes, approver_id, approver_id_2, approver_id_3, status_level_1, status_level_2, status_level_3, approval_status, payment_status)
                    VALUES (?, ?, ?, ?, CURDATE(), 'pending_approval', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'pending', 'unpaid')
                ");
                $stmtPo->execute([
                    $tid, $supplierId ?: null, $uid, $poNo, $subtotal, $tax, $total,
                    trim((string)($args['notes'] ?? '')) ?: null,
                    $app1, $app2, $app3,
                    $app2 ? 'pending' : 'none',
                    $app3 ? 'pending' : 'none',
                ]);
                $poId = (int)$db->lastInsertId();
                foreach ($items as $it) {
                    $qty = max(1, (int)($it['quantity'] ?? 1));
                    $cost = max(0, (float)($it['unit_cost'] ?? ($it['unit_price'] ?? 0)));
                    $db->prepare("INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)")
                        ->execute([$poId, !empty($it['product_id']) ? (int)$it['product_id'] : null, $it['name'] ?? 'Hạng mục PO', $qty, $cost, $qty * $cost]);
                }
                $db->commit();

                return [
                    'ok' => true,
                    'po_id' => $poId,
                    'po_number' => $poNo,
                    'total' => $total,
                    'status' => 'pending_approval',
                    'message' => "Đã tạo Đơn mua hàng {$poNo} (#$poId) với tổng giá trị " . number_format($total, 0, ',', '.') . " đ.",
                ];
            }

            if ($action === 'create_deposit_so' || $action === 'update_deposit_milestones') {
                $contactId = (int)($args['contact_id'] ?? 0);
                if ($contactId <= 0 && !empty($args['contact_name'])) {
                    $stmtC = $db->prepare("SELECT id, full_name FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND full_name LIKE ? ORDER BY id DESC LIMIT 1");
                    $stmtC->execute([$tid, '%' . trim((string)$args['contact_name']) . '%']);
                    $cRow = $stmtC->fetch(PDO::FETCH_ASSOC);
                    if ($cRow) {
                        $contactId = (int)$cRow['id'];
                    }
                }
                $projectId = (int)($args['project_id'] ?? 0);
                if ($projectId <= 0 && !empty($args['program'])) {
                    $stmtP = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND name LIKE ? ORDER BY id DESC LIMIT 1");
                    $stmtP->execute([$tid, '%' . trim((string)$args['program']) . '%']);
                    $projectId = (int)$stmtP->fetchColumn();
                }

                if ($action === 'create_deposit_so') {
                    if ($contactId <= 0) {
                        return ['ok' => false, 'error' => 'Vui lòng cung cấp contact_id hoặc contact_name (tên học viên/khách hàng) để lập Đơn đặt cọc #SO.'];
                    }
                    $price = max(0, (float)($args['amount'] ?? 0));
                    $unitCode = trim((string)($args['unit_code'] ?? ($args['program'] ?? 'Khóa học / Chương trình')));
                    $db->beginTransaction();
                    $stmtDep = $db->prepare("
                        INSERT INTO deposits (contact_id, company_id, project_id, unit_code, price, expected_commission, status, created_by, notes, currency, exchange_rate)
                        VALUES (?, ?, ?, ?, ?, 0, 'pending_admin', ?, ?, ?, 1)
                    ");
                    $stmtDep->execute([
                        $contactId,
                        !empty($args['company_id']) ? (int)$args['company_id'] : null,
                        $projectId ?: null,
                        $unitCode,
                        $price,
                        $uid,
                        trim((string)($args['notes'] ?? '')) ?: null,
                        strtoupper(trim((string)($args['currency'] ?? 'VND'))),
                    ]);
                    $depId = (int)$db->lastInsertId();

                    $milestones = is_array($args['milestones'] ?? null) && !empty($args['milestones'])
                        ? $args['milestones']
                        : [['milestone_name' => 'Đợt 1 - Đặt cọc học phí', 'expected_amount' => $price, 'expected_pay_date' => $args['due_date'] ?? date('Y-m-d')]];
                    foreach ($milestones as $ms) {
                        $mName = trim((string)($ms['milestone_name'] ?? 'Đợt đóng học phí'));
                        $mAmt = (float)($ms['expected_amount'] ?? $price);
                        $mDate = !empty($ms['expected_pay_date']) ? substr((string)$ms['expected_pay_date'], 0, 10) : date('Y-m-d');
                        $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, original_amount, expected_pay_date, status) VALUES (?, ?, ?, ?, ?, 'pending')")
                            ->execute([$depId, $mName, $mAmt, $mAmt, $mDate]);
                    }
                    $db->commit();

                    return [
                        'ok' => true,
                        'deposit_id' => $depId,
                        'so_code' => "#SO{$depId}",
                        'price' => $price,
                        'milestones_count' => count($milestones),
                        'message' => "Đã tạo Đơn đặt cọc học phí #SO{$depId} với tổng học phí " . number_format($price, 0, ',', '.') . " đ (" . count($milestones) . " đợt thanh toán).",
                    ];
                } else {
                    if ($recordId <= 0) {
                        return ['ok' => false, 'error' => 'Vui lòng cung cấp record_id (ID Đơn đặt cọc #SO) cần cập nhật các đợt đóng học phí.'];
                    }
                    $milestones = is_array($args['milestones'] ?? null) ? $args['milestones'] : [];
                    if (empty($milestones)) {
                        return ['ok' => false, 'error' => 'Vui lòng cung cấp danh sách milestones [{milestone_name, expected_amount, expected_pay_date}].'];
                    }
                    $db->beginTransaction();
                    foreach ($milestones as $ms) {
                        $mName = trim((string)($ms['milestone_name'] ?? 'Đợt bổ sung'));
                        $mAmt = (float)($ms['expected_amount'] ?? 0);
                        $mDate = !empty($ms['expected_pay_date']) ? substr((string)$ms['expected_pay_date'], 0, 10) : date('Y-m-d');
                        $db->prepare("INSERT INTO deposit_milestones (deposit_id, milestone_name, expected_amount, original_amount, expected_pay_date, status) VALUES (?, ?, ?, ?, ?, 'pending')")
                            ->execute([$recordId, $mName, $mAmt, $mAmt, $mDate]);
                    }
                    $db->commit();
                    return [
                        'ok' => true,
                        'deposit_id' => $recordId,
                        'added_milestones' => count($milestones),
                        'message' => "Đã cập nhật thêm " . count($milestones) . " đợt đóng học phí cho Đơn #SO{$recordId}.",
                    ];
                }
            }

            if (in_array($action, ['create_sales_order', 'create_quote', 'create_invoice'], true)) {
                $contactId = (int)($args['contact_id'] ?? 0);
                if ($contactId <= 0 && !empty($args['contact_name'])) {
                    $stmtC = $db->prepare("SELECT id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND full_name LIKE ? ORDER BY id DESC LIMIT 1");
                    $stmtC->execute([$tid, '%' . trim((string)$args['contact_name']) . '%']);
                    $contactId = (int)$stmtC->fetchColumn();
                }
                $companyId = !empty($args['company_id']) ? (int)$args['company_id'] : null;
                $items = is_array($args['items'] ?? null) ? $args['items'] : [];
                $subtotal = 0.0;
                foreach ($items as $it) {
                    $qty = max(1, (float)($it['quantity'] ?? 1));
                    $price = max(0, (float)($it['unit_price'] ?? ($it['unit_cost'] ?? 0)));
                    $subtotal += $qty * $price;
                }
                if ($subtotal <= 0 && isset($args['amount']) && (float)$args['amount'] > 0) {
                    $subtotal = (float)$args['amount'];
                    $items = [['name' => $args['title'] ?? 'Dịch vụ / Học phí', 'quantity' => 1, 'unit_price' => $subtotal]];
                }
                $discount = isset($args['discount']) ? (float)$args['discount'] : 0.0;
                $tax = isset($args['tax']) ? (float)$args['tax'] : 0.0;
                $total = max(0, $subtotal - $discount + $tax);

                $db->beginTransaction();
                if ($action === 'create_sales_order') {
                    $soNo = 'SO-' . date('Ymd') . '-' . random_int(100, 999);
                    $stmtIns = $db->prepare("
                        INSERT INTO sales_orders (tenant_id, contact_id, company_id, created_by, so_number, order_date, delivery_date, status, payment_status, subtotal, discount, tax, total, notes)
                        VALUES (?, ?, ?, ?, ?, CURDATE(), ?, 'pending_approval', 'unpaid', ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([$tid, $contactId ?: null, $companyId, $uid, $soNo, !empty($args['due_date']) ? substr((string)$args['due_date'], 0, 10) : null, $subtotal, $discount, $tax, $total, trim((string)($args['notes'] ?? '')) ?: null]);
                    $soId = (int)$db->lastInsertId();
                    foreach ($items as $idx => $it) {
                        $qty = max(1, (float)($it['quantity'] ?? 1));
                        $pr = max(0, (float)($it['unit_price'] ?? 0));
                        $db->prepare("INSERT INTO sales_order_items (so_id, product_id, name, description, quantity, unit_price, discount, subtotal, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)")
                            ->execute([$soId, !empty($it['product_id']) ? (int)$it['product_id'] : null, $it['name'] ?? 'Hạng mục', $it['description'] ?? null, $qty, $pr, $qty * $pr, $idx]);
                    }
                    $db->commit();
                    return ['ok' => true, 'so_id' => $soId, 'so_number' => $soNo, 'total' => $total, 'message' => "Đã tạo Đơn đặt hàng {$soNo} (#$soId) với tổng giá trị " . number_format($total, 0, ',', '.') . " đ."];
                } elseif ($action === 'create_quote') {
                    $qNo = 'QUO-' . date('Ymd') . '-' . random_int(100, 999);
                    $stmtIns = $db->prepare("
                        INSERT INTO quotes (tenant_id, contact_id, created_by, quote_number, title, status, subtotal, discount, tax, total, valid_until, notes)
                        VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([$tid, $contactId ?: null, $uid, $qNo, trim((string)($args['title'] ?? 'Báo giá dịch vụ')), $subtotal, $discount, $tax, $total, !empty($args['due_date']) ? substr((string)$args['due_date'], 0, 10) : date('Y-m-d', strtotime('+14 days')), trim((string)($args['notes'] ?? '')) ?: null]);
                    $qId = (int)$db->lastInsertId();
                    foreach ($items as $idx => $it) {
                        $qty = max(1, (float)($it['quantity'] ?? 1));
                        $pr = max(0, (float)($it['unit_price'] ?? 0));
                        $db->prepare("INSERT INTO quote_items (quote_id, product_id, name, description, quantity, unit_price, discount, subtotal, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)")
                            ->execute([$qId, !empty($it['product_id']) ? (int)$it['product_id'] : null, $it['name'] ?? 'Hạng mục', $it['description'] ?? null, $qty, $pr, $qty * $pr, $idx]);
                    }
                    $db->commit();
                    return ['ok' => true, 'quote_id' => $qId, 'quote_number' => $qNo, 'total' => $total, 'message' => "Đã tạo Báo giá {$qNo} (#$qId) với tổng giá trị " . number_format($total, 0, ',', '.') . " đ."];
                } else {
                    $invNo = 'INV-' . date('Ymd') . '-' . random_int(100, 999);
                    $stmtIns = $db->prepare("
                        INSERT INTO invoices (tenant_id, company_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, subtotal, discount, tax, total, notes)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', CURDATE(), ?, ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([$tid, $companyId, $contactId ?: null, $uid, $invNo, trim((string)($args['title'] ?? 'Hóa đơn thanh toán')), !empty($args['due_date']) ? substr((string)$args['due_date'], 0, 10) : date('Y-m-d', strtotime('+7 days')), $subtotal, $discount, $tax, $total, trim((string)($args['notes'] ?? '')) ?: null]);
                    $invId = (int)$db->lastInsertId();
                    foreach ($items as $it) {
                        $qty = max(1, (int)($it['quantity'] ?? 1));
                        $pr = max(0, (float)($it['unit_price'] ?? 0));
                        $db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)")
                            ->execute([$invId, !empty($it['product_id']) ? (int)$it['product_id'] : null, $it['name'] ?? 'Hạng mục', $qty, $pr, $qty * $pr]);
                    }
                    $db->commit();
                    return ['ok' => true, 'invoice_id' => $invId, 'invoice_number' => $invNo, 'total' => $total, 'message' => "Đã tạo Hóa đơn {$invNo} (#$invId) với tổng giá trị " . number_format($total, 0, ',', '.') . " đ."];
                }
            }

            return ['ok' => false, 'error' => "Hành động '$action' chưa được hỗ trợ hoặc thiếu tham số."];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            return ['ok' => false, 'error' => 'Lỗi thực thi công cụ PO/SO & Phê duyệt: ' . $e->getMessage()];
        }
    }
}
