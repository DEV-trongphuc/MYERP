<?php
class PurchaseOrderController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $supplierId = (int)($_GET['supplier_id'] ?? 0);
        $paymentStatus = trim($_GET['payment_status'] ?? '');

        $where = ["po.tenant_id = ?"];
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
        if (empty($b['supplier_id']) || empty($b['items'])) {
            respond(422, null, 'Thiếu thông tin đối tác / nhà cung cấp hoặc danh sách sản phẩm', false);
        }
        if (($b['total'] ?? 0) < 0) respond(422, null, 'Tổng tiền đơn hàng không được âm', false);

        // Đảm bảo Role Nhân sự (HR) chỉ lên PO cho Đối tác / Nhà cung cấp (như phí giảng viên)
        if (in_array($auth['role'], ['hr', 'human_resources'], true) && empty($b['supplier_id'])) {
            respond(403, null, 'Bộ phận Nhân sự chỉ có quyền tạo PO trả phí cho Đối tác / Nhà cung cấp', false);
        }

        $checkSup = $this->db->prepare("SELECT id FROM suppliers WHERE id=? AND tenant_id=?");
        $checkSup->execute([(int)$b['supplier_id'], $auth['tenant_id']]);
        if (!$checkSup->fetch()) respond(404, null, 'Nhà cung cấp không hợp lệ', false);

        // Fetch threshold for 3-level approval
        $threshold = 5000000;
        $thQuery = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'po_three_level_threshold' LIMIT 1");
        if ($thQuery) {
            $thRow = $thQuery->fetch();
            if ($thRow && is_numeric($thRow['setting_value'])) {
                $threshold = (float)$thRow['setting_value'];
            }
        }

        $total = (float)($b['total'] ?? 0);
        $approver_id = !empty($b['approver_id']) ? (int)$b['approver_id'] : null;
        $approver_id_2 = !empty($b['approver_id_2']) ? (int)$b['approver_id_2'] : null;
        $approver_id_3 = !empty($b['approver_id_3']) ? (int)$b['approver_id_3'] : null;

        if (empty($approver_id)) {
            respond(422, null, 'Đơn hàng yêu cầu duyệt bắt buộc phải chọn người duyệt Cấp 1.', false);
        }
        if ($total >= $threshold) {
            if (empty($approver_id_2)) {
                respond(422, null, 'Đơn hàng từ ' . number_format($threshold, 0, ',', '.') . ' VND trở lên bắt buộc phải phê duyệt 2 cấp, vui lòng chọn đầy đủ người duyệt Cấp 2.', false);
            }
        }

        $this->db->beginTransaction();
        try {
            $po_number = 'PO-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

            $status_level_1 = $approver_id ? 'pending' : 'none';
            $status_level_2 = $approver_id_2 ? 'pending' : 'none';
            $status_level_3 = $approver_id_3 ? 'pending' : 'none';
            $approval_status = $approver_id ? 'pending' : 'approved';
            $status = $approver_id ? 'pending_approval' : 'ordered';

            $stmt = $this->db->prepare("
                INSERT INTO purchase_orders (
                    tenant_id, supplier_id, created_by, po_number, order_date, 
                    status, subtotal, tax, total, notes, 
                    approver_id, approver_id_2, approver_id_3, 
                    status_level_1, status_level_2, status_level_3, approval_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $auth['tenant_id'], $b['supplier_id'], $auth['user_id'], $po_number,
                empty($b['order_date']) ? date('Y-m-d') : $b['order_date'], $status,
                $b['subtotal'] ?? 0, $b['tax'] ?? 0, $b['total'] ?? 0, $b['notes'] ?? null,
                $approver_id, $approver_id_2, $approver_id_3,
                $status_level_1, $status_level_2, $status_level_3, $approval_status
            ]);
            $poId = (int)$this->db->lastInsertId();

            $itemStmt = $this->db->prepare("
                INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($b['items'] as $item) {
                $qty = (float)($item['quantity'] ?? 1.0);
                $unit_cost = (float)($item['unit_cost'] ?? 0);
                if ($qty <= 0 || $unit_cost < 0) {
                    throw new Exception('Số lượng sản phẩm phải lớn hơn 0 và đơn giá không được âm');
                }

                if (!empty($item['product_id'])) {
                    $prodCheck = $this->db->prepare("SELECT id FROM products WHERE id=? AND tenant_id=?");
                    $prodCheck->execute([(int)$item['product_id'], $auth['tenant_id']]);
                    if (!$prodCheck->fetch()) {
                        throw new Exception("Sản phẩm ID {$item['product_id']} không hợp lệ hoặc không thuộc cửa hàng của bạn");
                    }
                }

                $itemStmt->execute([
                    $poId, $item['product_id'] ?? null, $item['name'],
                    $qty, $unit_cost, $item['subtotal']
                ]);
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'Tạo đơn nhập hàng', 'purchase_order', $poId, $po_number);

            // Send notification to first approver if any
            if ($approver_id) {
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

            $this->show($auth, $poId);
        } catch (Exception $e) {
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
                   app3.full_name as approver_name_3, app3.email as approver_email_3
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users u ON po.created_by = u.id
            LEFT JOIN users app1 ON po.approver_id = app1.id
            LEFT JOIN users app2 ON po.approver_id_2 = app2.id
            LEFT JOIN users app3 ON po.approver_id_3 = app3.id
            WHERE po.id = ? AND po.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $po = $stmt->fetch();
        if (!$po) respond(404, null, 'Không tìm thấy đơn hàng', false);

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
            $stmt = $this->db->prepare("SELECT status, approval_status FROM purchase_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
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
            if ($po['approval_status'] !== 'approved') {
                $this->db->rollBack();
                respond(422, null, 'Đơn hàng chưa được phê duyệt đầy đủ, không thể nhập kho', false);
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
        } catch (Exception $e) {
            if (get_class($e) === 'ResponseException') {
                if ($this->db->inTransaction()) $this->db->rollBack();
                throw $e;
            }
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi nhập kho: ' . $e->getMessage(), false);
        }
    }

    public function approve(array $auth, int $id): void {
        $b = getBody();
        $statusInput = $b['status'] ?? ''; // 'approved' or 'rejected'
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
            if ($expectedApproverId !== (int)$userId && !in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true)) {
                $this->db->rollBack();
                respond(403, null, 'Bạn không có quyền phê duyệt cấp này', false);
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
            logActivity($this->db, $tid, $userId, $actionLabel, 'purchase_order', $id, $po['po_number']);

            // Send notification
            try {
                require_once __DIR__ . '/../NotificationService.php';
                $eventPayload = [
                    'po_id' => $id,
                    'po_number' => $po['po_number'],
                    'current_level' => $currentLevel,
                    'status' => $statusInput,
                    'next_approval_status' => $nextApprovalStatus,
                    'creator_id' => $po['created_by']
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
        } catch (Exception $e) {
            if (get_class($e) === 'ResponseException') {
                if ($this->db->inTransaction()) $this->db->rollBack();
                throw $e;
            }
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi phê duyệt: ' . $e->getMessage(), false);
        }
    }

    public function update(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Bạn không có quyền cập nhật đơn nhập hàng', false);
        }

        $stmtStatus = $this->db->prepare("SELECT status FROM purchase_orders WHERE id = ? AND tenant_id = ?");
        $stmtStatus->execute([$id, $auth['tenant_id']]);
        $currentStatus = $stmtStatus->fetchColumn();

        if ($currentStatus === false) {
            respond(404, null, 'Không tìm thấy đơn hàng', false);
        }

        $b = getBody();
        
        // Nếu đơn hàng đã hoàn tất nhập kho (received) hoặc đã bị hủy (cancelled), cấm đổi trạng thái
        if (in_array($currentStatus, ['received', 'cancelled'], true) && isset($b['status']) && $b['status'] !== $currentStatus) {
            respond(422, null, 'Không thể thay đổi trạng thái của đơn hàng đã nhập kho hoặc đã hủy bỏ', false);
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
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền xóa đơn nhập hàng', false);
        $stmt = $this->db->prepare("DELETE FROM purchase_orders WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $stmt->execute([$id, $auth['tenant_id']]);
        if (!$stmt->rowCount()) respond(403, null, 'Chỉ có thể xóa đơn hàng nháp', false);
        respond(200, null, 'Đã xóa đơn hàng');
    }
}
