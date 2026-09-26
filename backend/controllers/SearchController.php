<?php
// SearchController — Global Spotlight search across Contacts, Tasks, Approvals, Companies, and Deals
class SearchController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }    

    public function global(array $auth): void {
        $rawQ = trim($_GET['q'] ?? '');
        if (mb_strlen($rawQ) < 1) {
            respond(200, [
                'results' => [],
                'grouped' => [
                    'contacts' => [],
                    'tasks' => [],
                    'approvals' => [],
                    'companies' => [],
                    'deals' => []
                ],
                'query' => ''
            ]);
        }

        $role = strtolower($auth['role'] ?? '');
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        $userFullName = trim(mb_strtolower($auth['full_name'] ?? $auth['name'] ?? ''));

        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isManager = $role === 'manager';
        $isSale = $role === 'sales' || $role === 'sale';
        $isAcademic = in_array($role, ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'], true);

        // Check if query is looking for a numeric ID (#123, 123, task 123, don 123)
        $cleanDigits = preg_replace('/[^0-9]/', '', $rawQ);
        $searchId = (is_numeric($cleanDigits) && strlen($cleanDigits) > 0 && strlen($cleanDigits) <= 10) ? (int)$cleanDigits : 0;
        
        $cleanQuery = trim(preg_replace('/^[#\s]+/', '', $rawQ));
        $like = "%{$cleanQuery}%";

        $grouped = [
            'contacts' => [],
            'tasks' => [],
            'approvals' => [],
            'companies' => [],
            'deals' => []
        ];
        $allResults = [];

        require_once __DIR__ . '/../utils/search_helpers.php';

        // 1. 👤 Contacts / Students Search
        try {
            $searchRes = buildContactSearchClause($cleanQuery, '');
            $cWhere = !empty($searchRes['clause']) ? $searchRes['clause'] : '(c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
            $cParams = !empty($searchRes['clause']) ? $searchRes['params'] : [$like, $like, $like];

            if ($searchId > 0) {
                $cWhere = "(c.id = ? OR $cWhere)";
                array_unshift($cParams, $searchId);
            }

            $sqlC = "SELECT c.id, c.full_name as label, c.full_name, c.phone, c.email, c.status, c.expected_revenue, 
                            c.avatar, c.stage_id, ps.name as stage_name, u.full_name as owner_name, 'contact' as type 
                     FROM contacts c
                     LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                     LEFT JOIN users u ON c.owner_id = u.id
                     WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $cWhere";
            $pC = array_merge([$tid], $cParams);

            if ($isSale) {
                $sqlC .= ' AND (c.owner_id = ? OR c.id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
                ))';
                $pC[] = $uid;
                $pC[] = $uid;
            } else if ($isManager) {
                $sqlC .= " AND (c.owner_id = ? OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
                $pC[] = $uid;
                $pC[] = $uid;
            }

            $stmtC = $this->db->prepare($sqlC . " ORDER BY (c.id = " . (int)$searchId . ") DESC, c.updated_at DESC LIMIT 10");
            $stmtC->execute($pC);
            $contacts = $stmtC->fetchAll(PDO::FETCH_ASSOC);

            foreach ($contacts as $c) {
                $sublabelParts = [];
                if (!empty($c['phone'])) $sublabelParts[] = $c['phone'];
                if (!empty($c['stage_name'])) $sublabelParts[] = $c['stage_name'];
                else if (!empty($c['status'])) $sublabelParts[] = $c['status'];
                if (!empty($c['owner_name'])) $sublabelParts[] = "Phụ trách: " . $c['owner_name'];

                $item = [
                    'id' => (int)$c['id'],
                    'label' => $c['full_name'] ?: 'Khách hàng #' . $c['id'],
                    'sublabel' => implode(' • ', $sublabelParts),
                    'phone' => $c['phone'] ?? '',
                    'email' => $c['email'] ?? '',
                    'status' => $c['status'] ?? '',
                    'stage_name' => $c['stage_name'] ?? '',
                    'type' => 'contact',
                    'raw' => $c
                ];
                $grouped['contacts'][] = $item;
                $allResults[] = $item;
            }
        } catch (Throwable $e) {
            error_log('SearchController Contact error: ' . $e->getMessage());
        }

        // 2. 📋 Tasks / Activities Search (#56969 or Task Title)
        try {
            $taskWhere = "(a.subject LIKE ? OR a.body LIKE ? OR a.tags LIKE ?)";
            $taskParams = [$like, $like, $like];

            if ($searchId > 0) {
                $taskWhere = "(a.id = ? OR $taskWhere)";
                array_unshift($taskParams, $searchId);
            }

            $sqlT = "SELECT a.id, a.subject as label, a.subject, a.body, a.type as activity_type, a.status, a.priority, 
                            a.due_date, a.user_id, a.created_by, a.approver_id, a.participant_ids, a.tags,
                            a.related_type, a.related_id, a.contact_id,
                            u_assignee.full_name as assignee_name,
                            u_creator.full_name as creator_name,
                            'task' as type
                     FROM activities a
                     LEFT JOIN users u_assignee ON a.user_id = u_assignee.id
                     LEFT JOIN users u_creator ON a.created_by = u_creator.id
                     WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND $taskWhere";
            $pT = array_merge([$tid], $taskParams);

            if (!$isGlobalAdmin) {
                $sqlT .= " AND (
                    a.user_id = ? OR a.created_by = ? OR a.approver_id = ? 
                    OR FIND_IN_SET(?, COALESCE(a.participant_ids, '')) 
                    OR a.body LIKE ? 
                    OR a.tags LIKE ?
                    OR a.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?))
                )";
                $pT[] = $uid;
                $pT[] = $uid;
                $pT[] = $uid;
                $pT[] = (string)$uid;
                $pT[] = "%@{$auth['full_name']}%";
                $pT[] = "%@{$auth['username']}%";
                $pT[] = $uid;
            }

            $stmtT = $this->db->prepare($sqlT . " ORDER BY (a.id = " . (int)$searchId . ") DESC, a.created_at DESC LIMIT 10");
            $stmtT->execute($pT);
            $tasks = $stmtT->fetchAll(PDO::FETCH_ASSOC);

            foreach ($tasks as $t) {
                $subParts = [];
                $subParts[] = '#' . $t['id'];
                if (!empty($t['assignee_name'])) $subParts[] = 'Giao cho: ' . $t['assignee_name'];
                if (!empty($t['due_date'])) {
                    $d = date('d/m/Y', strtotime($t['due_date']));
                    $subParts[] = 'Hạn: ' . $d;
                }
                $statusMap = [
                    'todo' => 'Cần làm',
                    'in_progress' => 'Đang làm',
                    'review' => 'Chờ duyệt',
                    'done' => 'Hoàn thành',
                    'cancelled' => 'Đã hủy'
                ];
                if (!empty($t['status'])) {
                    $subParts[] = $statusMap[strtolower($t['status'])] ?? $t['status'];
                }

                $item = [
                    'id' => (int)$t['id'],
                    'label' => '#' . $t['id'] . ' - ' . ($t['subject'] ?: 'Công việc không tên'),
                    'sublabel' => implode(' • ', $subParts),
                    'status' => $t['status'] ?? 'todo',
                    'priority' => $t['priority'] ?? 'medium',
                    'due_date' => $t['due_date'] ?? null,
                    'type' => 'task',
                    'raw' => $t
                ];
                $grouped['tasks'][] = $item;
                $allResults[] = $item;
            }
        } catch (Throwable $e) {
            error_log('SearchController Task error: ' . $e->getMessage());
        }

        // 3. 📝 Approvals Search (#3079 or Proposal Title)
        try {
            // 3.1 Expenses & Payment requests
            $expWhere = "(e.title LIKE ? OR e.notes LIKE ? OR e.description LIKE ? OR u.full_name LIKE ?)";
            $expParams = [$like, $like, $like, $like];
            if ($searchId > 0) {
                $expWhere = "(e.id = ? OR $expWhere)";
                array_unshift($expParams, $searchId);
            }

            $sqlExp = "SELECT e.id, e.title as label, e.title, e.amount, e.currency, e.status, e.category, 
                              e.user_id, e.created_by, e.created_at, e.approver_id, e.approver_id_2, e.approver_id_3,
                              u.full_name as employee_name, 'expense' as approval_type, 'approval' as type
                       FROM expenses e
                       LEFT JOIN users u ON COALESCE(e.user_id, e.created_by) = u.id
                       WHERE e.tenant_id = ? AND $expWhere";
            $pExp = array_merge([$tid], $expParams);
            if (!$isGlobalAdmin && $role !== 'accountant' && $role !== 'hr') {
                $sqlExp .= " AND (e.user_id = ? OR e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ?)";
                $pExp[] = $uid;
                $pExp[] = $uid;
                $pExp[] = $uid;
                $pExp[] = $uid;
                $pExp[] = $uid;
            }
            $stmtExp = $this->db->prepare($sqlExp . " ORDER BY (e.id = " . (int)$searchId . ") DESC, e.created_at DESC LIMIT 8");
            $stmtExp->execute($pExp);
            $expenses = $stmtExp->fetchAll(PDO::FETCH_ASSOC);

            foreach ($expenses as $e) {
                $amtStr = number_format((float)($e['amount'] ?? 0), 0, ',', '.') . ' ' . ($e['currency'] ?: 'VND');
                $subParts = ['Đơn #' . $e['id']];
                if (!empty($e['employee_name'])) $subParts[] = $e['employee_name'];
                if ((float)$e['amount'] > 0) $subParts[] = $amtStr;
                $subParts[] = $e['status'] === 'approved' ? 'Đã duyệt' : ($e['status'] === 'rejected' ? 'Từ chối' : 'Chờ duyệt');

                $item = [
                    'id' => (int)$e['id'],
                    'approval_type' => 'expense',
                    'label' => '#' . $e['id'] . ' - ' . ($e['title'] ?: 'Đề xuất chi phí'),
                    'sublabel' => implode(' • ', $subParts),
                    'amount' => (float)$e['amount'],
                    'currency' => $e['currency'] ?: 'VND',
                    'status' => $e['status'] ?: 'pending',
                    'type' => 'approval',
                    'raw' => $e
                ];
                $grouped['approvals'][] = $item;
                $allResults[] = $item;
            }

            // 3.2 HR Leaves (Leave requests / Nghỉ phép / Đi muộn / OT)
            $leaveWhere = "(l.reason LIKE ? OR u.full_name LIKE ? OR l.leave_type LIKE ?)";
            $leaveParams = [$like, $like, $like];
            if ($searchId > 0) {
                $leaveWhere = "(l.id = ? OR $leaveWhere)";
                array_unshift($leaveParams, $searchId);
            }

            $sqlLeave = "SELECT l.id, l.leave_type, l.reason, l.total_days, l.status, l.user_id, l.created_at,
                                u.full_name as employee_name, 'leave' as approval_type, 'approval' as type
                         FROM hrm_leave_requests l
                         LEFT JOIN users u ON l.user_id = u.id
                         WHERE u.tenant_id = ? AND $leaveWhere";
            $pLeave = array_merge([$tid], $leaveParams);
            if (!$isGlobalAdmin && $role !== 'hr') {
                $sqlLeave .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ?)";
                $pLeave[] = $uid;
                $pLeave[] = $uid;
                $pLeave[] = $uid;
            }
            $stmtLeave = $this->db->prepare($sqlLeave . " ORDER BY (l.id = " . (int)$searchId . ") DESC, l.created_at DESC LIMIT 6");
            $stmtLeave->execute($pLeave);
            $leaves = $stmtLeave->fetchAll(PDO::FETCH_ASSOC);

            foreach ($leaves as $l) {
                $subParts = ['Đơn #' . $l['id']];
                if (!empty($l['employee_name'])) $subParts[] = $l['employee_name'];
                if ((float)$l['total_days'] > 0) $subParts[] = $l['total_days'] . ' ngày';
                $subParts[] = $l['status'] === 'approved' ? 'Đã duyệt' : ($l['status'] === 'rejected' ? 'Từ chối' : 'Chờ duyệt');

                $title = 'Đơn nghỉ phép / Đi muộn';
                if ($l['leave_type'] === 'overtime') $title = 'Đăng ký làm thêm (OT)';
                else if ($l['leave_type'] === 'late_early') $title = 'Đăng ký đi muộn / về sớm';
                else if ($l['leave_type'] === 'remote_work') $title = 'Đăng ký làm việc từ xa';
                if (!empty($l['reason'])) $title .= ' - ' . mb_substr($l['reason'], 0, 40);

                $item = [
                    'id' => (int)$l['id'],
                    'approval_type' => 'leave',
                    'label' => '#' . $l['id'] . ' - ' . $title,
                    'sublabel' => implode(' • ', $subParts),
                    'status' => $l['status'] ?: 'pending',
                    'type' => 'approval',
                    'raw' => $l
                ];
                $grouped['approvals'][] = $item;
                $allResults[] = $item;
            }

            // 3.3 HR Salary Advances (Tạm ứng)
            $advWhere = "(a.reason LIKE ? OR u.full_name LIKE ?)";
            $advParams = [$like, $like];
            if ($searchId > 0) {
                $advWhere = "(a.id = ? OR $advWhere)";
                array_unshift($advParams, $searchId);
            }

            $sqlAdv = "SELECT a.id, a.amount, a.reason, a.status, a.user_id, a.created_at,
                              u.full_name as employee_name, 'advance' as approval_type, 'approval' as type
                       FROM hrm_salary_advances a
                       LEFT JOIN users u ON a.user_id = u.id
                       WHERE u.tenant_id = ? AND $advWhere";
            $pAdv = array_merge([$tid], $advParams);
            if (!$isGlobalAdmin && $role !== 'hr' && $role !== 'accountant') {
                $sqlAdv .= " AND (a.user_id = ? OR a.approver_id = ? OR a.approver_id_2 = ?)";
                $pAdv[] = $uid;
                $pAdv[] = $uid;
                $pAdv[] = $uid;
            }
            $stmtAdv = $this->db->prepare($sqlAdv . " ORDER BY (a.id = " . (int)$searchId . ") DESC, a.created_at DESC LIMIT 5");
            $stmtAdv->execute($pAdv);
            $advances = $stmtAdv->fetchAll(PDO::FETCH_ASSOC);

            foreach ($advances as $a) {
                $amtStr = number_format((float)($a['amount'] ?? 0), 0, ',', '.') . ' VND';
                $subParts = ['Đơn #' . $a['id']];
                if (!empty($a['employee_name'])) $subParts[] = $a['employee_name'];
                if ((float)$a['amount'] > 0) $subParts[] = $amtStr;
                $subParts[] = $a['status'] === 'approved' ? 'Đã duyệt' : ($a['status'] === 'rejected' ? 'Từ chối' : 'Chờ duyệt');

                $item = [
                    'id' => (int)$a['id'],
                    'approval_type' => 'advance',
                    'label' => '#' . $a['id'] . ' - Đề nghị tạm ứng ' . ($a['reason'] ? '- ' . mb_substr($a['reason'], 0, 35) : ''),
                    'sublabel' => implode(' • ', $subParts),
                    'amount' => (float)$a['amount'],
                    'status' => $a['status'] ?: 'pending',
                    'type' => 'approval',
                    'raw' => $a
                ];
                $grouped['approvals'][] = $item;
                $allResults[] = $item;
            }
        } catch (Throwable $e) {
            error_log('SearchController Approvals error: ' . $e->getMessage());
        }

        // 4. 🏢 Companies & 💰 Deals Search (Secondary)
        try {
            $compWhere = "(name LIKE ? OR email LIKE ? OR phone LIKE ?)";
            $pComp = [$tid, $like, $like, $like];
            if ($searchId > 0) {
                $compWhere = "(id = ? OR $compWhere)";
                array_splice($pComp, 1, 0, [$searchId]);
            }
            $sqlComp = "SELECT id, name as label, city as sublabel, 'company' as type, status FROM companies WHERE tenant_id=? AND deleted_at IS NULL AND $compWhere";
            if ($isSale) {
                $sqlComp .= " AND owner_id = ?";
                $pComp[] = $uid;
            }
            $stmtComp = $this->db->prepare($sqlComp . " ORDER BY (id = " . (int)$searchId . ") DESC, updated_at DESC LIMIT 5");
            $stmtComp->execute($pComp);
            foreach ($stmtComp->fetchAll(PDO::FETCH_ASSOC) as $comp) {
                $item = [
                    'id' => (int)$comp['id'],
                    'label' => $comp['label'],
                    'sublabel' => $comp['sublabel'] ? 'Doanh nghiệp • ' . $comp['sublabel'] : 'Doanh nghiệp',
                    'type' => 'company',
                    'raw' => $comp
                ];
                $grouped['companies'][] = $item;
                $allResults[] = $item;
            }
        } catch (Throwable $e) {
            error_log('SearchController Company error: ' . $e->getMessage());
        }

        // 5. 📦 Orders (Purchase Orders PO & Sales Orders SO)
        try {
            // PO
            $poWhere = "(po.po_number LIKE ? OR po.notes LIKE ? OR s.name LIKE ?)";
            $pPo = [$tid, $like, $like, $like];
            if ($searchId > 0) {
                $poWhere = "(po.id = ? OR $poWhere)";
                array_splice($pPo, 1, 0, [$searchId]);
            }
            $sqlPo = "SELECT po.id, po.po_number, po.notes, po.total, po.status, s.name as supplier_name, 'po' as type 
                      FROM purchase_orders po 
                      LEFT JOIN suppliers s ON po.supplier_id = s.id 
                      WHERE po.tenant_id = ? AND $poWhere 
                      ORDER BY (po.id = " . (int)$searchId . ") DESC, po.id DESC LIMIT 4";
            $stmtPo = $this->db->prepare($sqlPo);
            $stmtPo->execute($pPo);
            foreach ($stmtPo->fetchAll(PDO::FETCH_ASSOC) as $po) {
                $item = [
                    'id' => (int)$po['id'],
                    'label' => ($po['po_number'] ?: ('Đơn PO #' . $po['id'])) . ($po['supplier_name'] ? ' - ' . $po['supplier_name'] : ''),
                    'sublabel' => 'Đơn mua hàng PO • ' . number_format((float)($po['total'] ?? 0), 0, ',', '.') . 'đ • ' . ($po['status'] ?? 'pending'),
                    'type' => 'po',
                    'raw' => $po
                ];
                $grouped['orders'][] = $item;
                $allResults[] = $item;
            }

            // SO
            $soWhere = "(so.so_number LIKE ? OR so.notes LIKE ? OR c.full_name LIKE ?)";
            $pSo = [$tid, $like, $like, $like];
            if ($searchId > 0) {
                $soWhere = "(so.id = ? OR $soWhere)";
                array_splice($pSo, 1, 0, [$searchId]);
            }
            $sqlSo = "SELECT so.id, so.so_number, so.notes, so.total, so.status, c.full_name as customer_name, 'so' as type 
                      FROM sales_orders so 
                      LEFT JOIN contacts c ON so.contact_id = c.id 
                      WHERE so.tenant_id = ? AND $soWhere 
                      ORDER BY (so.id = " . (int)$searchId . ") DESC, so.id DESC LIMIT 4";
            $stmtSo = $this->db->prepare($sqlSo);
            $stmtSo->execute($pSo);
            foreach ($stmtSo->fetchAll(PDO::FETCH_ASSOC) as $so) {
                $item = [
                    'id' => (int)$so['id'],
                    'label' => ($so['so_number'] ?: ('Đơn SO #' . $so['id'])) . ($so['customer_name'] ? ' - ' . $so['customer_name'] : ''),
                    'sublabel' => 'Đơn bán hàng SO • ' . number_format((float)($so['total'] ?? 0), 0, ',', '.') . 'đ • ' . ($so['status'] ?? 'draft'),
                    'type' => 'so',
                    'raw' => $so
                ];
                $grouped['orders'][] = $item;
                $allResults[] = $item;
            }
        } catch (Throwable $e) {
            error_log('SearchController Orders error: ' . $e->getMessage());
        }

        respond(200, [
            'results' => $allResults,
            'grouped' => $grouped,
            'query' => $rawQ
        ]);
    }

    public function smartFilter(array $auth): void {
        $q = strtolower(trim($_GET['q'] ?? ''));
        $this->global($auth);
    }
}

