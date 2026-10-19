<?php
class PurchaseOrderController {
    private PDO $db;
    private static bool $schemaChecked = false;
    public function __construct(PDO $db) {
        $this->db = $db;
        if (!self::$schemaChecked && !$this->db->inTransaction()) {
            self::$schemaChecked = true;
            try {
                $col = $this->db->query("SHOW COLUMNS FROM purchase_orders LIKE 'deleted_at'")->fetch();
                if (!$col) {
                    $this->db->exec("ALTER TABLE purchase_orders ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
                }
            } catch (\Throwable $e) {
            }
        }
    }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $supplierId = (int)($_GET['supplier_id'] ?? 0);
        $paymentStatus = trim($_GET['payment_status'] ?? '');

        $where = ["po.tenant_id = ?", "po.deleted_at IS NULL"];
        $params = [$tid];

        if ($supplierId > 0) {
            $where[] = "po.supplier_id = ?";
            $params[] = $supplierId;
        }

        if ($paymentStatus === 'unpaid') {
            $where[] = "po.payment_status != 'paid'";
        } elseif (!empty($paymentStatus)) {
            $where[] = "po.payment_status = ?";
            $params[] = $paymentStatus;
        }

        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $isManager = $role === 'manager';

        // Load team members if manager
        $userIds = [$uid];
        if ($isManager) {
            $stmtTeam = $this->db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)");
            $stmtTeam->execute([$uid]);
            $teamMemberIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $userIds = array_merge($userIds, array_map('intval', $teamMemberIds));
        }

        $isAdminOrDirectorOrAccountant = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'accountant'], true);
        $specificId = (int)($_GET['id'] ?? ($_GET['open_id'] ?? 0));
        $where[] = "(po.status != 'draft' OR po.created_by = ?)";
        $params[] = $uid;

        if ($specificId > 0) {
            $where[] = "po.id = ?";
            $params[] = $specificId;
        }
        if (!$isAdminOrDirectorOrAccountant) {
            if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $where[] = "(po.created_by IN ($placeholders) OR po.approver_id = ? OR po.approver_id_2 = ? OR po.approver_id_3 = ?)";
                $params = array_merge($params, $userIds);
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
            } else {
                $where[] = "(po.created_by = ? OR po.approver_id = ? OR po.approver_id_2 = ? OR po.approver_id_3 = ?)";
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
                $params[] = $uid;
            }
        }

        $search = trim($_GET['search'] ?? '');
        if ($search !== '') {
            $where[] = "(
                po.po_number LIKE ? 
                OR po.notes LIKE ? 
                OR CAST(po.id AS CHAR) = ? 
                OR EXISTS (SELECT 1 FROM suppliers s_s WHERE s_s.id = po.supplier_id AND s_s.name LIKE ?)
                OR EXISTS (SELECT 1 FROM users u_s WHERE u_s.id = po.created_by AND u_s.full_name LIKE ?)
            )";
            $searchWildcard = "%{$search}%";
            $cleanSearchId = preg_replace('/[^0-9]/', '', $search);
            $params[] = $searchWildcard;
            $params[] = $searchWildcard;
            $params[] = $cleanSearchId !== '' ? $cleanSearchId : $search;
            $params[] = $searchWildcard;
            $params[] = $searchWildcard;
        }

        $whereClause = implode(' AND ', $where);

        $simple = ($_GET['simple'] ?? '') === '1';
        if ($simple) {
            $stmt = $this->db->prepare("
                SELECT po.id, po.po_number, po.total, po.paid_amount, po.order_date, po.payment_status,
                       s.name as supplier_name
                FROM purchase_orders po
                LEFT JOIN suppliers s ON po.supplier_id = s.id
                WHERE $whereClause
                ORDER BY po.created_at DESC
            ");
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            respond(200, $orders);
            return;
        }

        $stmt = $this->db->prepare("
            SELECT po.*, s.name as supplier_name, u.full_name as creator_name,
                   app1.full_name as approver_name_1, app1.email as approver_email_1,
                   app2.full_name as approver_name_2, app2.email as approver_email_2,
                   app3.full_name as approver_name_3, app3.email as approver_email_3
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u ON po.created_by = u.id
            LEFT JOIN users app1 ON po.approver_id = app1.id
            LEFT JOIN users app2 ON po.approver_id_2 = app2.id
            LEFT JOIN users app3 ON po.approver_id_3 = app3.id
            WHERE $whereClause
            ORDER BY po.created_at DESC
        ");
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($orders)) {
            $poIds = array_column($orders, 'id');
            $inClause = implode(',', array_map('intval', $poIds));
            $itemStmt = $this->db->query("SELECT * FROM purchase_order_items WHERE po_id IN ({$inClause})");
            $allItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $itemsByPo = [];
            foreach ($allItems as $item) {
                $itemsByPo[$item['po_id']][] = $item;
            }

            foreach ($orders as &$order) {
                $order['items'] = $itemsByPo[$order['id']] ?? [];
            }
        }

        respond(200, $orders);
    }

    public function store(array $auth): void {
        $allowedRoles = ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'accountant', 'hr', 'human_resources', 'staff'];
        if (!in_array($auth['role'], $allowedRoles, true)) {
            respond(403, null, 'Bạn không có quyền tạo đơn mua hàng / PO cho đối tác', false);
        }

        $b = getBody();
        $isDraft = (($b['status'] ?? '') === 'draft');
        $supplier_id = !empty($b['supplier_id']) ? (int)$b['supplier_id'] : null;
        $beneficiary_type = !empty($b['beneficiary_type']) ? $b['beneficiary_type'] : 'supplier';
        $beneficiary_id = !empty($b['beneficiary_id']) ? (int)$b['beneficiary_id'] : null;

        // If beneficiary is an employee, create or find corresponding supplier record
        if ($beneficiary_type === 'employee' && $beneficiary_id) {
            $uStmt = $this->db->prepare("SELECT id, full_name, email, phone, bank_name, bank_account FROM users WHERE id=? AND tenant_id=?");
            $uStmt->execute([$beneficiary_id, $auth['tenant_id']]);
            $uRow = $uStmt->fetch();
            if ($uRow) {
                $supName = '[Nhân viên] ' . $uRow['full_name'];
                $sCheck = $this->db->prepare("SELECT id FROM suppliers WHERE name=? AND tenant_id=? LIMIT 1");
                $sCheck->execute([$supName, $auth['tenant_id']]);
                $existingSup = $sCheck->fetch();
                if ($existingSup) {
                    $supplier_id = (int)$existingSup['id'];
                } else {
                    $bankStr = trim(($uRow['bank_name'] ? $uRow['bank_name'] . ' ' : '') . ($uRow['bank_account'] ?? ''));
                    $insSup = $this->db->prepare("INSERT INTO suppliers (tenant_id, name, phone, email, bank_account, created_by) VALUES (?, ?, ?, ?, ?, ?)");
                    $insSup->execute([$auth['tenant_id'], $supName, $uRow['phone'] ?? '', $uRow['email'] ?? '', $bankStr, $auth['user_id']]);
                    $supplier_id = (int)$this->db->lastInsertId();
                }
            }
        }

        if (empty($supplier_id) || empty($b['items'])) {
            respond(422, null, 'Thiếu thông tin đối tác / nhà cung cấp hoặc danh sách sản phẩm', false);
        }
        if (($b['total'] ?? 0) < 0) respond(422, null, 'Tổng tiền đơn hàng không được âm', false);

        // Đảm bảo Role Nhân sự (HR) chỉ lên PO cho Đối tác / Nhà cung cấp (như phí giảng viên)
        if (in_array($auth['role'], ['hr', 'human_resources'], true) && empty($supplier_id)) {
            respond(403, null, 'Bộ phận Nhân sự chỉ có quyền tạo PO trả phí cho Đối tác / Nhà cung cấp', false);
        }

        $checkSup = $this->db->prepare("SELECT id FROM suppliers WHERE id=? AND tenant_id=?");
        $checkSup->execute([$supplier_id, $auth['tenant_id']]);
        if (!$checkSup->fetch()) respond(404, null, 'Nhà cung cấp hoặc đơn vị thụ hưởng không hợp lệ', false);

        // Fetch threshold for 3-level approval
        $threshold = 5000000;
        $thQuery = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'po_three_level_threshold' LIMIT 1");
        if ($thQuery) {
            $thRow = $thQuery->fetch();
            if ($thRow && is_numeric($thRow['setting_value'])) {
                $threshold = (float)$thRow['setting_value'];
            }
        }

        // Server-Side Recalculation of Items Subtotal and Total to prevent Parameter Tampering (SEC-FIN-03)
        $validatedItems = [];
        $calculatedSubtotal = 0.0;
        foreach ($b['items'] as $item) {
            $qty = (float)($item['quantity'] ?? 1.0);
            $unit_cost = (float)($item['unit_cost'] ?? 0);
            if ($qty <= 0 || $unit_cost < 0) {
                respond(422, null, 'Số lượng sản phẩm phải lớn hơn 0 và đơn giá không được âm', false);
            }
            if (!empty($item['product_id'])) {
                $prodCheck = $this->db->prepare("SELECT id FROM products WHERE id=? AND tenant_id=?");
                $prodCheck->execute([(int)$item['product_id'], $auth['tenant_id']]);
                if (!$prodCheck->fetch()) {
                    respond(422, null, "Sản phẩm ID {$item['product_id']} không hợp lệ hoặc không thuộc cửa hàng của bạn", false);
                }
            }
            $itemSubtotal = round($qty * $unit_cost, 2);
            $calculatedSubtotal += $itemSubtotal;
            $validatedItems[] = [
                'product_id' => !empty($item['product_id']) ? (int)$item['product_id'] : null,
                'name' => trim($item['name'] ?? ''),
                'quantity' => $qty,
                'unit_cost' => $unit_cost,
                'subtotal' => $itemSubtotal
            ];
        }

        $tax = max(0, (float)($b['tax'] ?? 0));
        $calculatedTotal = $calculatedSubtotal + $tax;
        if (!$isDraft && $calculatedTotal <= 0) {
            respond(422, null, 'Tổng giá trị đơn mua hàng phải lớn hơn 0', false);
        }

        $total = $calculatedTotal;
        $approver_id = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
        $approver_id_2 = !empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null;
        $approver_id_3 = !empty($b['approver_id_3']) ? (int)$b['approver_id_3'] : null;
        $related_user_ids = !empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? implode(',', $b['related_user_ids']) : (string)$b['related_user_ids']) : null;

        if (!$isDraft) {
            if (empty($approver_id)) {
                respond(422, null, 'Đơn hàng yêu cầu duyệt bắt buộc phải chọn người duyệt Cấp 1.', false);
            }
            if ($total >= $threshold) {
                if (empty($approver_id_2)) {
                    respond(422, null, 'Đơn hàng từ ' . number_format($threshold, 0, ',', '.') . ' VND trở lên bắt buộc phải phê duyệt 2 cấp, vui lòng chọn đầy đủ người duyệt Cấp 2.', false);
                }
            }
        }

        $this->db->beginTransaction();
        try {
            $po_number = 'PO-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            if ($isDraft) {
                $status_level_1 = 'none';
                $status_level_2 = 'none';
                $status_level_3 = 'none';
                $approval_status = 'draft';
                $status = 'draft';
            } else {
                $status_level_1 = $approver_id ? 'pending' : 'none';
                $status_level_2 = $approver_id_2 ? 'pending' : 'none';
                $status_level_3 = $approver_id_3 ? 'pending' : 'none';
                $approval_status = $approver_id ? 'pending' : 'approved';
                $status = $approver_id ? 'pending_approval' : 'ordered';
            }

            $stmt = $this->db->prepare("
                INSERT INTO purchase_orders (
                    tenant_id, supplier_id, created_by, po_number, order_date, 
                    status, subtotal, tax, total, notes, 
                    approver_id, approver_id_2, approver_id_3, 
                    status_level_1, status_level_2, status_level_3, approval_status,
                    related_user_ids
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $auth['tenant_id'], $supplier_id, $auth['user_id'], $po_number,
                empty($b['order_date']) ? date('Y-m-d') : $b['order_date'], $status,
                $calculatedSubtotal, $tax, $calculatedTotal, $b['notes'] ?? null,
                $approver_id, $approver_id_2, $approver_id_3,
                $status_level_1, $status_level_2, $status_level_3, $approval_status,
                $related_user_ids
            ]);
            $poId = (int)$this->db->lastInsertId();

            $itemStmt = $this->db->prepare("
                INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($validatedItems as $vItem) {
                $itemStmt->execute([
                    $poId, $vItem['product_id'], $vItem['name'],
                    $vItem['quantity'], $vItem['unit_cost'], $vItem['subtotal']
                ]);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], $isDraft ? 'Lưu nháp đơn nhập hàng' : 'Tạo đơn nhập hàng', 'purchase_order', $poId, $po_number);

            // Send notification to first approver if any (skip if draft)
            if (!$isDraft && $approver_id) {
                try {
                    require_once __DIR__ . '/../NotificationService.php';
                    NotificationService::send($this->db, $auth['tenant_id'], 'PO_WAITING_APPROVAL', [
                        'po_id' => $poId,
                        'po_number' => $po_number,
                        'current_level' => 1,
                        'status' => 'pending',
                        'next_approval_status' => 'pending',
                        'creator_id' => $auth['user_id'],
                        'target_user_id' => $approver_id
                    ]);
                } catch (\Throwable $notifEx) {
                    error_log("PO Notification Error: " . $notifEx->getMessage());
                }
            }

            // Send notification to related users if any (skip if draft)
            if (!$isDraft && !empty($related_user_ids)) {
                try {
                    $relIds = array_filter(array_map('intval', explode(',', $related_user_ids)));
                    foreach ($relIds as $rUserId) {
                        if ($rUserId !== (int)$auth['user_id'] && $rUserId !== $approver_id) {
                            $stmtNotif = $this->db->prepare("
                                INSERT INTO notifications (tenant_id, user_id, title, body, link, type, is_read, created_at)
                                VALUES (?, ?, ?, ?, ?, 'purchase_order', 0, NOW())
                            ");
                            $creatorName = !empty($auth['full_name']) ? $auth['full_name'] : 'Thành viên hệ thống';
                            $stmtNotif->execute([
                                $auth['tenant_id'],
                                $rUserId,
                                'Bạn được gắn liên quan trong đơn mua/chi phí: ' . $po_number,
                                'Người tạo: ' . $creatorName . ' - Số tiền: ' . number_format($total, 0, ',', '.') . ' đ',
                                '/inventory?tab=purchase_orders&open_id=' . $poId
                            ]);
                        }
                    }
                } catch (\Throwable $relEx) {
                    error_log("PO Related User Notification Error: " . $relEx->getMessage());
                }
            }

            $this->show($auth, $poId);
        } catch (\Throwable $e) {
            if (get_class($e) === 'ResponseException') {
                if ($this->db->inTransaction()) $this->db->rollBack();
                throw $e;
            }
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi tạo đơn nhập hàng: ' . $e->getMessage(), false);
        }
    }

    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT po.*, s.name as supplier_name, u.full_name as creator_name,
                   app1.full_name as approver_name_1, app1.email as approver_email_1,
                   app2.full_name as approver_name_2, app2.email as approver_email_2,
                   app3.full_name as approver_name_3, app3.email as approver_email_3,
                   real1.full_name as approved_by_name_1,
                   real2.full_name as approved_by_name_2,
                   real3.full_name as approved_by_name_3
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u ON po.created_by = u.id
            LEFT JOIN users app1 ON po.approver_id = app1.id
            LEFT JOIN users app2 ON po.approver_id_2 = app2.id
            LEFT JOIN users app3 ON po.approver_id_3 = app3.id
            LEFT JOIN users real1 ON po.approved_by = real1.id
            LEFT JOIN users real2 ON po.approved_by_2 = real2.id
            LEFT JOIN users real3 ON po.approved_by_3 = real3.id
            WHERE po.id = ? AND po.tenant_id = ? AND po.deleted_at IS NULL
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $po = $stmt->fetch();
        if (!$po) respond(404, null, 'Không tìm thấy đơn hàng', false);

        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $isAdminOrDirectorOrAccountant = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'accountant'], true);
        if (!$isAdminOrDirectorOrAccountant) {
            $userIds = [$uid];
            if ($role === 'manager') {
                $stmtTeam = $this->db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)");
                $stmtTeam->execute([$uid]);
                $teamMemberIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];
                $userIds = array_merge($userIds, array_map('intval', $teamMemberIds));
            }
            $relIds = !empty($po['related_user_ids']) ? array_map('intval', explode(',', (string)$po['related_user_ids'])) : [];
            $canView = in_array((int)($po['created_by'] ?? 0), $userIds, true)
                || in_array((int)($po['requester_id'] ?? 0), $userIds, true)
                || (int)($po['approver_id'] ?? 0) === $uid
                || (int)($po['approver_id_2'] ?? 0) === $uid
                || (int)($po['approver_id_3'] ?? 0) === $uid
                || in_array($uid, $relIds, true);
            if (!$canView || (($po['status'] ?? '') === 'draft' && (int)($po['created_by'] ?? 0) !== $uid)) {
                respond(403, null, 'Bạn không có quyền xem đơn nhập hàng này', false);
            }
        }

        $itemStmt = $this->db->prepare("SELECT * FROM purchase_order_items WHERE po_id = ?");
        $itemStmt->execute([$id]);
        $po['items'] = $itemStmt->fetchAll();

        respond(200, $po);
    }

    public function receive(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền nhập kho', false);
        $this->db->beginTransaction();
        try {
            // 1. Get PO and items
            $stmt = $this->db->prepare("SELECT status, approval_status FROM purchase_orders WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL FOR UPDATE");
            $stmt->execute([$id, $auth['tenant_id']]);
            $po = $stmt->fetch();
            if (!$po) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy đơn hàng', false);
            }
            if ($po['status'] === 'received') {
                $this->db->rollBack();
                respond(422, null, 'Đơn hàng này đã được nhập kho rồi', false);
            }
            if ($po['status'] === 'cancelled') {
                $this->db->rollBack();
                respond(422, null, 'Đơn hàng này đã bị hủy, không thể nhập kho', false);
            }
            if ($po['approval_status'] !== 'approved' && $po['status'] !== 'ordered') {
                $this->db->rollBack();
                respond(422, null, 'Đơn hàng chưa được phê duyệt đầy đủ hoặc chưa được chuyển sang trạng thái đặt hàng', false);
            }

            // 2. Update status
            $this->db->prepare("UPDATE purchase_orders SET status = 'received' WHERE id = ? AND tenant_id = ?")->execute([$id, $auth['tenant_id']]);

            // 3. Process items: Update stock, create batches and logs
            $itemStmt = $this->db->prepare("SELECT product_id, name, quantity, unit_cost FROM purchase_order_items WHERE po_id = ?");
            $itemStmt->execute([$id]);
            $items = $itemStmt->fetchAll();

            $updateStock = $this->db->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND tenant_id = ?");
            $insertBatch = $this->db->prepare("
                INSERT INTO batches (tenant_id, product_id, supplier_id, po_id, batch_code, import_date, import_price, initial_qty, current_qty)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $insertLog = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
                VALUES (?, ?, 'IMPORT', ?, ?, ?)
            ");

            // Get PO details for batch info
            $poInfoStmt = $this->db->prepare("SELECT po_number, supplier_id, total, order_date FROM purchase_orders WHERE id = ? AND tenant_id = ?");
            $poInfoStmt->execute([$id, $auth['tenant_id']]);
            $poInfo = $poInfoStmt->fetch();

            foreach ($items as $item) {
                if ($item['product_id']) {
                    // Update overall product stock
                    $updateStock->execute([$item['quantity'], $item['product_id'], $auth['tenant_id']]);
                    
                    // Create Batch
                    $batchCode = $poInfo['po_number'] . '-' . strtoupper(substr(md5($item['name'] . uniqid()), 0, 4));
                    $insertBatch->execute([
                        $auth['tenant_id'], $item['product_id'], $poInfo['supplier_id'], $id,
                        $batchCode, $poInfo['order_date'], $item['unit_cost'], 
                        $item['quantity'], $item['quantity']
                    ]);
                    $batchId = (int)$this->db->lastInsertId();

                    // Create Log
                    $insertLog->execute([
                        $auth['tenant_id'], $batchId, $item['quantity'], "Nhập hàng từ đơn {$poInfo['po_number']}", $auth['user_id']
                    ]);
                }
            }

            // 4. Update supplier totals (accounts payable)
            $this->db->prepare("UPDATE suppliers SET total_ordered = total_ordered + ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$poInfo['total'], $poInfo['supplier_id'], $auth['tenant_id']]);

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Nhập kho từ PO', 'purchase_order', $id, $poInfo['po_number']);
            respond(200, null, 'Đã nhập kho thành công, đã tạo lô hàng và cập nhật số lượng tồn kho');
        } catch (\Throwable $e) {
            if (get_class($e) === 'ResponseException') {
                if ($this->db->inTransaction()) $this->db->rollBack();
                throw $e;
            }
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi nhập kho: ' . $e->getMessage(), false);
        }
    }

    public function approve(array $auth, int $id, ?string $defaultAction = null): void {
        $b = getBody();
        $statusInput = trim((string)($b['status'] ?? '')); // 'approved' or 'rejected'
        if ($statusInput === '') {
            $statusInput = $defaultAction === 'reject' ? 'rejected' : ($defaultAction === 'approve' ? 'approved' : '');
        }
        $reason = trim((string)($b['reject_reason'] ?? $b['reason'] ?? $b['note'] ?? ''));
        if (!in_array($statusInput, ['approved', 'rejected'], true)) {
            respond(400, null, 'Trạng thái phê duyệt không hợp lệ', false);
        }

        $userId = $auth['user_id'];
        $tid = $auth['tenant_id'];

        $this->db->beginTransaction();
        try {
            // Fetch PO details
            $stmt = $this->db->prepare("
                SELECT * FROM purchase_orders 
                WHERE id = ? AND tenant_id = ? AND status = 'pending_approval'
                FOR UPDATE
            ");
            $stmt->execute([$id, $tid]);
            $po = $stmt->fetch();
            if (!$po) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy đơn hàng đang chờ duyệt hoặc đơn hàng đã xử lý', false);
            }

            if ((int)($po['created_by'] ?? 0) === (int)$userId) {
                $this->db->rollBack();
                respond(403, null, 'Người tạo đơn mua sắm không được tự phê duyệt đơn của chính mình', false);
            }

            // Determine which level needs to be approved next
            $currentLevel = 0;
            if ($po['status_level_1'] === 'pending') {
                $currentLevel = 1;
            } elseif ($po['status_level_1'] === 'approved' && $po['status_level_2'] === 'pending') {
                $currentLevel = 2;
            } elseif ($po['status_level_1'] === 'approved' && $po['status_level_2'] === 'approved' && $po['status_level_3'] === 'pending') {
                $currentLevel = 3;
            }

            if ($currentLevel === 0) {
                $this->db->rollBack();
                respond(422, null, 'Đơn hàng đã được duyệt hoặc từ chối đầy đủ rồi', false);
            }

            // Check if current user is the authorized approver for this level
            $expectedApproverId = (int)$po["approver_id" . ($currentLevel > 1 ? "_" . $currentLevel : "")];
            if ($expectedApproverId !== (int)$userId && !in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin'], true)) {
                $this->db->rollBack();
                respond(403, null, 'Bạn không có quyền phê duyệt cấp này hoặc chưa đến lượt phê duyệt của bạn', false);
            }

            // Update status of the current level
            $levelStatusField = "status_level_" . $currentLevel;
            $approvedByField = "approved_by" . ($currentLevel > 1 ? "_" . $currentLevel : "");
            
            $updateFields = ["$levelStatusField = ?"];
            $updateParams = [$statusInput];
            
            if ($currentLevel === 1) {
                $updateFields[] = "approved_by = ?";
                $updateParams[] = $userId;
            } elseif ($currentLevel === 2) {
                $updateFields[] = "approved_by_2 = ?";
                $updateParams[] = $userId;
            } elseif ($currentLevel === 3) {
                $updateFields[] = "approved_by_3 = ?";
                $updateParams[] = $userId;
            }

            // Determine overall PO status
            $nextApprovalStatus = $po['approval_status'];
            $nextPoStatus = $po['status'];

            if ($statusInput === 'rejected') {
                $nextApprovalStatus = 'rejected';
                $nextPoStatus = 'cancelled';
            } else {
                // Check if next levels are specified
                $hasLevel2 = !empty($po['approver_id_2']) && $po['status_level_2'] !== 'none';
                $hasLevel3 = !empty($po['approver_id_3']) && $po['status_level_3'] !== 'none';

                if ($currentLevel === 1) {
                    if ($hasLevel2) {
                        $nextApprovalStatus = 'pending';
                        $nextPoStatus = 'pending_approval';
                    } else {
                        $nextApprovalStatus = 'approved';
                        $nextPoStatus = 'ordered';
                    }
                } elseif ($currentLevel === 2) {
                    if ($hasLevel3) {
                        $nextApprovalStatus = 'pending';
                        $nextPoStatus = 'pending_approval';
                    } else {
                        $nextApprovalStatus = 'approved';
                        $nextPoStatus = 'ordered';
                    }
                } elseif ($currentLevel === 3) {
                    $nextApprovalStatus = 'approved';
                    $nextPoStatus = 'ordered';
                }
            }

            $updateFields[] = "approval_status = ?";
            $updateParams[] = $nextApprovalStatus;
            
            $updateFields[] = "status = ?";
            $updateParams[] = $nextPoStatus;

            $updateParams[] = $id;
            $updateParams[] = $tid;

            $updateSql = "UPDATE purchase_orders SET " . implode(', ', $updateFields) . " WHERE id = ? AND tenant_id = ?";
            $this->db->prepare($updateSql)->execute($updateParams);

            $this->db->commit();

            // Log activity
            $actionLabel = $statusInput === 'approved' ? 'Phê duyệt PO Cấp ' . $currentLevel : 'Từ chối PO Cấp ' . $currentLevel;
            $logPayload = $reason !== '' ? ($po['po_number'] . ' | Lý do: ' . $reason) : $po['po_number'];
            logActivity($this->db, $tid, $userId, $actionLabel, 'purchase_order', $id, $logPayload);

            // Send notification
            try {
                require_once __DIR__ . '/../NotificationService.php';
                $eventPayload = [
                    'po_id' => $id,
                    'po_number' => $po['po_number'],
                    'current_level' => $currentLevel,
                    'status' => $statusInput,
                    'reason' => $reason,
                    'next_approval_status' => $nextApprovalStatus,
                    'creator_id' => $po['created_by'],
                    'approver_name' => $auth['full_name'] ?? 'Người duyệt'
                ];
                
                $nextApproverId = null;
                $hasLevel2 = !empty($po['approver_id_2']) && $po['status_level_2'] !== 'none';
                $hasLevel3 = !empty($po['approver_id_3']) && $po['status_level_3'] !== 'none';
                
                if ($statusInput === 'approved') {
                    if ($currentLevel === 1 && $hasLevel2) {
                        $nextApproverId = (int)$po['approver_id_2'];
                    } elseif ($currentLevel === 2 && $hasLevel3) {
                        $nextApproverId = (int)$po['approver_id_3'];
                    }
                }
                
                if ($nextApproverId) {
                    NotificationService::send($this->db, $tid, 'PO_WAITING_APPROVAL', array_merge($eventPayload, ['target_user_id' => $nextApproverId]));
                } else {
                    NotificationService::send($this->db, $tid, $statusInput === 'approved' ? 'PO_APPROVED' : 'PO_REJECTED', array_merge($eventPayload, ['target_user_id' => $po['created_by']]));
                }
            } catch (\Throwable $notifEx) {
                error_log("PO Notification Error: " . $notifEx->getMessage());
            }

            respond(200, null, 'Phản hồi phê duyệt đơn hàng thành công');
        } catch (\Throwable $e) {
            if (get_class($e) === 'ResponseException') {
                if ($this->db->inTransaction()) $this->db->rollBack();
                throw $e;
            }
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi phê duyệt: ' . $e->getMessage(), false);
        }
    }

    public function update(array $auth, int $id): void {
        $stmtPo = $this->db->prepare("SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtPo->execute([$id, $auth['tenant_id']]);
        $po = $stmtPo->fetch(PDO::FETCH_ASSOC);

        if (!$po) {
            respond(404, null, 'Không tìm thấy đơn hàng', false);
            return;
        }

        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $isPrivileged = in_array($role, ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'accountant'], true);
        $isCreator = ((int)$po['created_by'] === $uid);

        if (!$isPrivileged && !$isCreator) {
            respond(403, null, 'Bạn không có quyền cập nhật đơn nhập hàng này', false);
            return;
        }

        $currentStatus = $po['status'] ?? '';
        $currentApprovalStatus = $po['approval_status'] ?? 'pending';
        $lvl1 = $po['status_level_1'] ?? 'pending';

        $b = getBody();
        $isFullEditPayload = array_key_exists('items', $b) || array_key_exists('supplier_id', $b) || array_key_exists('approver_id', $b) || array_key_exists('beneficiary_id', $b) || array_key_exists('tax', $b) || array_key_exists('order_date', $b) || array_key_exists('related_user_ids', $b);

        if (!$isPrivileged && $isCreator) {
            $canCreatorEdit = ($currentStatus === 'draft')
                || (in_array($currentStatus, ['pending', 'pending_approval'], true) && $lvl1 !== 'approved')
                || ($currentStatus === 'cancelled' || $currentApprovalStatus === 'rejected');
            if (!$canCreatorEdit) {
                respond(400, null, 'Chỉ có thể chỉnh sửa đơn hàng khi đang ở trạng thái Nháp, Chờ duyệt cấp 1 hoặc Từ chối', false);
                return;
            }
        }

        if ($currentStatus === 'received' && isset($b['status']) && $b['status'] !== $currentStatus) {
            respond(422, null, 'Không thể thay đổi trạng thái của đơn hàng đã nhập kho', false);
            return;
        }

        if ($isFullEditPayload || ($isCreator && !$isPrivileged)) {
            $isDraft = isset($b['status']) ? ($b['status'] === 'draft') : ($currentStatus === 'draft' && empty($b['submit']));

            $supplier_id = array_key_exists('supplier_id', $b) && !empty($b['supplier_id']) ? (int)$b['supplier_id'] : (int)$po['supplier_id'];
            $beneficiary_type = !empty($b['beneficiary_type']) ? $b['beneficiary_type'] : 'supplier';
            $beneficiary_id = !empty($b['beneficiary_id']) ? (int)$b['beneficiary_id'] : null;

            if ($beneficiary_type === 'employee' && $beneficiary_id) {
                $uStmt = $this->db->prepare("SELECT id, full_name, email, phone, bank_name, bank_account FROM users WHERE id=? AND tenant_id=?");
                $uStmt->execute([$beneficiary_id, $auth['tenant_id']]);
                $uRow = $uStmt->fetch();
                if ($uRow) {
                    $supName = '[Nhân viên] ' . $uRow['full_name'];
                    $sCheck = $this->db->prepare("SELECT id FROM suppliers WHERE name=? AND tenant_id=? LIMIT 1");
                    $sCheck->execute([$supName, $auth['tenant_id']]);
                    $existingSup = $sCheck->fetch();
                    if ($existingSup) {
                        $supplier_id = (int)$existingSup['id'];
                    } else {
                        $bankStr = trim(($uRow['bank_name'] ? $uRow['bank_name'] . ' ' : '') . ($uRow['bank_account'] ?? ''));
                        $insSup = $this->db->prepare("INSERT INTO suppliers (tenant_id, name, phone, email, bank_account, created_by) VALUES (?, ?, ?, ?, ?, ?)");
                        $insSup->execute([$auth['tenant_id'], $supName, $uRow['phone'] ?? '', $uRow['email'] ?? '', $bankStr, $auth['user_id']]);
                        $supplier_id = (int)$this->db->lastInsertId();
                    }
                }
            }

            if ($supplier_id > 0) {
                $checkSup = $this->db->prepare("SELECT id FROM suppliers WHERE id=? AND tenant_id=?");
                $checkSup->execute([$supplier_id, $auth['tenant_id']]);
                if (!$checkSup->fetch()) {
                    respond(404, null, 'Nhà cung cấp hoặc đơn vị thụ hưởng không hợp lệ', false);
                    return;
                }
            }

            $threshold = 5000000;
            $thQuery = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'po_three_level_threshold' LIMIT 1");
            if ($thQuery) {
                $thRow = $thQuery->fetch();
                if ($thRow && is_numeric($thRow['setting_value'])) {
                    $threshold = (float)$thRow['setting_value'];
                }
            }

            $calculatedSubtotal = (float)($po['subtotal'] ?? 0);
            $validatedItems = null;
            if (array_key_exists('items', $b) && is_array($b['items'])) {
                if (empty($b['items'])) {
                    respond(422, null, 'Danh sách sản phẩm không được để trống', false);
                    return;
                }
                $validatedItems = [];
                $calculatedSubtotal = 0.0;
                foreach ($b['items'] as $item) {
                    $qty = (float)($item['quantity'] ?? 1.0);
                    $unit_cost = (float)($item['unit_cost'] ?? 0);
                    if ($qty <= 0 || $unit_cost < 0) {
                        respond(422, null, 'Số lượng sản phẩm phải lớn hơn 0 và đơn giá không được âm', false);
                        return;
                    }
                    if (!empty($item['product_id'])) {
                        $prodCheck = $this->db->prepare("SELECT id FROM products WHERE id=? AND tenant_id=?");
                        $prodCheck->execute([(int)$item['product_id'], $auth['tenant_id']]);
                        if (!$prodCheck->fetch()) {
                            respond(422, null, "Sản phẩm ID {$item['product_id']} không hợp lệ hoặc không thuộc cửa hàng của bạn", false);
                            return;
                        }
                    }
                    $itemSubtotal = round($qty * $unit_cost, 2);
                    $calculatedSubtotal += $itemSubtotal;
                    $validatedItems[] = [
                        'product_id' => !empty($item['product_id']) ? (int)$item['product_id'] : null,
                        'name' => trim($item['name'] ?? ''),
                        'quantity' => $qty,
                        'unit_cost' => $unit_cost,
                        'subtotal' => $itemSubtotal
                    ];
                }
            }

            $tax = array_key_exists('tax', $b) ? max(0, (float)$b['tax']) : (float)($po['tax'] ?? 0);
            $calculatedTotal = $calculatedSubtotal + $tax;
            if (!$isDraft && $calculatedTotal <= 0) {
                respond(422, null, 'Tổng giá trị đơn mua hàng phải lớn hơn 0', false);
                return;
            }

            $approver_id = array_key_exists('approver_id', $b) ? (!empty($b['approver_id']) ? (int)$b['approver_id'] : null) : (!empty($po['approver_id']) ? (int)$po['approver_id'] : null);
            $approver_id_2 = array_key_exists('approver_id_2', $b) ? (!empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null) : (!empty($po['approver_id_2']) ? (int)$po['approver_id_2'] : null);
            $approver_id_3 = array_key_exists('approver_id_3', $b) ? (!empty($b['approver_id_3']) ? (int)$b['approver_id_3'] : null) : (!empty($po['approver_id_3']) ? (int)$po['approver_id_3'] : null);
            $related_user_ids = array_key_exists('related_user_ids', $b)
                ? (!empty($b['related_user_ids']) ? (is_array($b['related_user_ids']) ? implode(',', $b['related_user_ids']) : (string)$b['related_user_ids']) : null)
                : ($po['related_user_ids'] ?? null);
            $order_date = !empty($b['order_date']) ? $b['order_date'] : ($po['order_date'] ?: date('Y-m-d'));
            $notes = array_key_exists('notes', $b) ? $b['notes'] : ($po['notes'] ?? null);

            if (!$isDraft) {
                if (empty($approver_id)) {
                    respond(422, null, 'Đơn hàng yêu cầu duyệt bắt buộc phải chọn người duyệt Cấp 1.', false);
                    return;
                }
                if ($calculatedTotal >= $threshold && empty($approver_id_2)) {
                    respond(422, null, 'Đơn hàng từ ' . number_format($threshold, 0, ',', '.') . ' VND trở lên bắt buộc phải phê duyệt 2 cấp, vui lòng chọn đầy đủ người duyệt Cấp 2.', false);
                    return;
                }
            }

            if ($isDraft) {
                $status_level_1 = 'none';
                $status_level_2 = 'none';
                $status_level_3 = 'none';
                $approval_status = 'draft';
                $nextStatus = 'draft';
            } else {
                $status_level_1 = $approver_id ? 'pending' : 'none';
                $status_level_2 = $approver_id_2 ? 'pending' : 'none';
                $status_level_3 = $approver_id_3 ? 'pending' : 'none';
                $approval_status = $approver_id ? 'pending' : 'approved';
                $nextStatus = $approver_id ? 'pending_approval' : 'ordered';
            }

            $this->db->beginTransaction();
            try {
                $stmtUpd = $this->db->prepare("
                    UPDATE purchase_orders
                    SET supplier_id = ?, order_date = ?, status = ?, subtotal = ?, tax = ?, total = ?, notes = ?,
                        approver_id = ?, approver_id_2 = ?, approver_id_3 = ?,
                        status_level_1 = ?, status_level_2 = ?, status_level_3 = ?, approval_status = ?,
                        related_user_ids = ?
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtUpd->execute([
                    $supplier_id, $order_date, $nextStatus, $calculatedSubtotal, $tax, $calculatedTotal, $notes,
                    $approver_id, $approver_id_2, $approver_id_3,
                    $status_level_1, $status_level_2, $status_level_3, $approval_status,
                    $related_user_ids,
                    $id, $auth['tenant_id']
                ]);

                if (is_array($validatedItems)) {
                    $this->db->prepare("DELETE FROM purchase_order_items WHERE po_id = ?")->execute([$id]);
                    $itemStmt = $this->db->prepare("
                        INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    foreach ($validatedItems as $vItem) {
                        $itemStmt->execute([
                            $id, $vItem['product_id'], $vItem['name'],
                            $vItem['quantity'], $vItem['unit_cost'], $vItem['subtotal']
                        ]);
                    }
                }

                $this->db->commit();

                if (!$isDraft && in_array($currentStatus, ['draft', 'cancelled'], true) && $approver_id) {
                    try {
                        require_once __DIR__ . '/../NotificationService.php';
                        NotificationService::send($this->db, $auth['tenant_id'], 'PO_WAITING_APPROVAL', [
                            'po_id' => $id,
                            'po_number' => $po['po_number'],
                            'current_level' => 1,
                            'status' => 'pending',
                            'next_approval_status' => 'pending',
                            'creator_id' => $po['created_by'],
                            'target_user_id' => $approver_id
                        ]);
                    } catch (\Throwable $notifEx) {}
                }

                $this->show($auth, $id);
                return;
            } catch (\Throwable $e) {
                if (get_class($e) === 'ResponseException') {
                    if ($this->db->inTransaction()) $this->db->rollBack();
                    throw $e;
                }
                if ($this->db->inTransaction()) $this->db->rollBack();
                respond(500, null, 'Lỗi khi cập nhật đơn nhập hàng: ' . $e->getMessage(), false);
                return;
            }
        }

        // Nếu đơn hàng đã hoàn tất nhập kho (received) hoặc đã bị hủy (cancelled), cấm đổi trạng thái
        if (in_array($currentStatus, ['received', 'cancelled'], true) && isset($b['status']) && $b['status'] !== $currentStatus) {
            respond(422, null, 'Không thể thay đổi trạng thái của đơn hàng đã nhập kho hoặc đã hủy bỏ', false);
        }

        if (array_key_exists('paid_amount', $b)) {
            if ((float)$b['paid_amount'] < 0) {
                respond(422, null, 'Số tiền đã thanh toán không được âm', false);
            }
            $b['paid_amount'] = max(0, (float)$b['paid_amount']);
        }

        $fields = ['status', 'payment_status', 'paid_amount', 'notes'];
        $sets = []; $params = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) {
                $sets[] = "$f = ?";
                $params[] = $b[$f];
            }
        }
        if (!$sets) respond(422, null, 'Không có dữ liệu cập nhật', false);

        $params[] = $id; $params[] = $auth['tenant_id'];
        $stmt = $this->db->prepare("UPDATE purchase_orders SET " . implode(',', $sets) . " WHERE id = ? AND tenant_id = ?");
        $stmt->execute($params);
        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void {
        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        $isManagementOrAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true);

        $stmt = $this->db->prepare("SELECT id, status, payment_status, created_by FROM purchase_orders WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tid]);
        $po = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$po) {
            respond(404, null, 'Không tìm thấy đơn hàng cần xóa', false);
        }

        $isCreator = ((int)$po['created_by'] === $uid);
        if (!$isManagementOrAdmin && !$isCreator) {
            respond(403, null, 'Bạn không có quyền xóa hoặc thu hồi đơn hàng này', false);
        }

        $allowedStatuses = ['draft', 'pending', 'pending_approval'];
        if (!in_array($po['status'], $allowedStatuses, true)) {
            respond(400, null, 'Chỉ có thể xóa hoặc thu hồi đơn hàng đang ở trạng thái nháp hoặc chờ duyệt', false);
        }

        if (($po['payment_status'] ?? '') === 'paid') {
            respond(400, null, 'Không thể xóa đơn hàng đã thanh toán', false);
        }

        try {
            $this->db->beginTransaction();
            $stmtDel = $this->db->prepare("UPDATE purchase_orders SET deleted_at = NOW(), status = 'cancelled' WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
            $stmtDel->execute([$id, $tid]);

            $this->db->commit();
            respond(200, null, 'Đã xóa hoặc thu hồi đơn hàng thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi xóa đơn hàng: ' . $e->getMessage(), false);
        }
    }
}
