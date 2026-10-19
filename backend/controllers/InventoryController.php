<?php
class InventoryController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    /**
     * Get all active batches with product info
     */
    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? '';
        $stockStatus = $_GET['stock_status'] ?? '';

        $where = ["b.tenant_id = ?", "b.status = 'active'"];
        $params = [$tid];

        if ($search) {
            $where[] = "(p.name LIKE ? OR p.sku LIKE ? OR b.batch_code LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($stockStatus === 'in_stock') {
            $where[] = "b.current_qty > 0";
        } elseif ($stockStatus === 'out_of_stock') {
            $where[] = "b.current_qty <= 0";
        } elseif ($stockStatus === 'low_stock') {
            $where[] = "b.current_qty > 0 AND b.current_qty <= 5";
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM batches b JOIN products p ON b.product_id = p.id WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT b.*, p.name as product_name, p.sku, p.category, p.unit, s.name as supplier_name
            FROM batches b
            JOIN products p ON b.product_id = p.id
            LEFT JOIN suppliers s ON b.supplier_id = s.id
            WHERE $w
            ORDER BY b.import_date DESC, b.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        
        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit
        ]);
    }

    /**
     * Get single batch or product inventory detail
     */
    public function show(array $auth, int $id): void {
        $tid = $auth['tenant_id'];

        // Try product first (common for /inventory/items/{id})
        $stmtProd = $this->db->prepare("
            SELECT p.*, COALESCE(p.stock_quantity, 0) as current_qty
            FROM products p
            WHERE p.id = ? AND p.tenant_id = ? AND p.deleted_at IS NULL
            LIMIT 1
        ");
        $stmtProd->execute([$id, $tid]);
        $prod = $stmtProd->fetch(PDO::FETCH_ASSOC);

        // Also check batch
        $stmtBatch = $this->db->prepare("
            SELECT b.*, p.name as product_name, p.sku, p.category, p.unit, s.name as supplier_name
            FROM batches b
            JOIN products p ON b.product_id = p.id
            LEFT JOIN suppliers s ON b.supplier_id = s.id
            WHERE b.id = ? AND b.tenant_id = ?
            LIMIT 1
        ");
        $stmtBatch->execute([$id, $tid]);
        $batch = $stmtBatch->fetch(PDO::FETCH_ASSOC);

        if ($prod) {
            $stmtBatches = $this->db->prepare("SELECT * FROM batches WHERE product_id = ? AND tenant_id = ? ORDER BY id DESC");
            $stmtBatches->execute([$id, $tid]);
            $prod['batches'] = $stmtBatches->fetchAll(PDO::FETCH_ASSOC) ?: [];
            respond(200, $prod, 'Lấy thông tin tồn kho sản phẩm thành công');
            return;
        }

        if ($batch) {
            respond(200, $batch, 'Lấy thông tin lô hàng thành công');
            return;
        }

        respond(404, null, 'Không tìm thấy mặt hàng hoặc lô hàng trong kho', false);
    }

    /**
     * Resolve or create an active batch for a product_id when batch_id is not explicitly provided
     */
    private function resolveOrCreateBatchId(int $tid, int $productId, float $initialQty = 0): int {
        $stmt = $this->db->prepare("SELECT id FROM batches WHERE product_id = ? AND tenant_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1");
        $stmt->execute([$productId, $tid]);
        $batchId = (int)$stmt->fetchColumn();
        if ($batchId > 0) {
            return $batchId;
        }

        // Check product exists in tenant
        $stmtP = $this->db->prepare("SELECT id, cost AS cost_price, cost, price FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmtP->execute([$productId, $tid]);
        $pRow = $stmtP->fetch(PDO::FETCH_ASSOC);
        if (!$pRow) {
            return 0;
        }

        $importPrice = (float)($pRow['cost_price'] ?? $pRow['cost'] ?? $pRow['price'] ?? 0);
        $batchCode = 'BATCH-' . date('Ymd') . '-' . $productId . '-' . rand(100, 999);
        $ins = $this->db->prepare("
            INSERT INTO batches (tenant_id, product_id, batch_code, initial_qty, current_qty, import_price, import_date, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'active', NOW())
        ");
        $ins->execute([$tid, $productId, $batchCode, max(0, $initialQty), max(0, $initialQty), $importPrice]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Handle stock-in
     */
    public function stockIn(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) {
            respond(403, null, 'Bạn không có quyền nhập kho', false);
        }
        $b = getBody();
        $tid = (int)$auth['tenant_id'];
        $uid = (int)$auth['user_id'];

        if (!empty($b['items']) && is_array($b['items']) && isset($b['items'][0])) {
            $first = $b['items'][0];
            $b['batch_id'] = $b['batch_id'] ?? $first['batch_id'] ?? null;
            $b['product_id'] = $b['product_id'] ?? $b['item_id'] ?? $first['product_id'] ?? $first['item_id'] ?? $first['id'] ?? null;
            $b['qty'] = $b['qty'] ?? $b['quantity'] ?? $b['new_qty'] ?? $first['qty'] ?? $first['quantity'] ?? null;
        }

        $batchId = (int)($b['batch_id'] ?? 0);
        $productId = (int)($b['product_id'] ?? $b['item_id'] ?? 0);
        $qty = (float)($b['qty'] ?? $b['quantity'] ?? $b['new_qty'] ?? $b['quantity_change'] ?? 0);
        $reason = trim($b['reason'] ?? $b['note'] ?? $b['notes'] ?? 'Nhập kho bổ sung');

        if ($qty <= 0) {
            respond(422, null, 'Số lượng nhập kho phải lớn hơn 0', false);
        }

        $this->db->beginTransaction();
        try {
            if ($batchId <= 0 && $productId > 0) {
                $batchId = $this->resolveOrCreateBatchId($tid, $productId, 0);
            }
            if ($batchId <= 0) {
                $this->db->rollBack();
                respond(422, null, 'Thiếu thông tin lô hàng hoặc sản phẩm để nhập kho', false);
            }

            $stmt = $this->db->prepare("SELECT id, current_qty, product_id FROM batches WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$batchId, $tid]);
            $batch = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$batch) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy lô hàng', false);
            }

            $newQty = (float)$batch['current_qty'] + $qty;
            $this->db->prepare("UPDATE batches SET current_qty = ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$newQty, $batchId, $tid]);

            $logStmt = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
                VALUES (?, ?, 'STOCK_IN', ?, ?, ?)
            ");
            $logStmt->execute([$tid, $batchId, $qty, $reason, $uid]);

            $this->db->prepare("UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$qty, $batch['product_id'], $tid]);

            logActivity($this->db, $tid, $uid, 'STOCK_IN', 'inventory', $batchId, json_encode(['qty' => $qty, 'reason' => $reason]));
            $this->db->commit();
            respond(200, ['batch_id' => $batchId, 'new_qty' => $newQty], 'Nhập kho thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    /**
     * Handle internal stock out (Damage, Gift, Loss)
     */
    public function internalExport(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền thực hiện xuất kho nội bộ', false);
        $b = getBody();
        $tid = (int)$auth['tenant_id'];

        if (!empty($b['items']) && is_array($b['items']) && isset($b['items'][0])) {
            $first = $b['items'][0];
            $b['batch_id'] = $b['batch_id'] ?? $first['batch_id'] ?? null;
            $b['product_id'] = $b['product_id'] ?? $b['item_id'] ?? $first['product_id'] ?? $first['item_id'] ?? $first['id'] ?? null;
            $b['qty'] = $b['qty'] ?? $b['quantity'] ?? $first['qty'] ?? $first['quantity'] ?? null;
        }

        $batchId = (int)($b['batch_id'] ?? 0);
        $productId = (int)($b['product_id'] ?? $b['item_id'] ?? 0);
        $qty = (float)($b['qty'] ?? $b['quantity'] ?? $b['new_qty'] ?? abs((float)($b['quantity_change'] ?? 0)));
        $reason = trim($b['reason'] ?? $b['note'] ?? $b['notes'] ?? 'Xuất kho nội bộ');

        if (($batchId <= 0 && $productId <= 0) || $qty <= 0) {
            respond(422, null, 'Thiếu thông tin xuất kho nội bộ hoặc số lượng không hợp lệ', false);
        }
        $b['qty'] = $qty;
        $b['reason'] = $reason;

        $this->db->beginTransaction();
        try {
            if ($batchId <= 0 && $productId > 0) {
                $stmtResolve = $this->db->prepare("SELECT id FROM batches WHERE product_id = ? AND tenant_id = ? AND status = 'active' AND current_qty >= ? ORDER BY import_date ASC, id ASC LIMIT 1");
                $stmtResolve->execute([$productId, $tid, $qty]);
                $batchId = (int)$stmtResolve->fetchColumn();
                if ($batchId <= 0) {
                    $stmtAny = $this->db->prepare("SELECT id FROM batches WHERE product_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1");
                    $stmtAny->execute([$productId, $tid]);
                    $batchId = (int)$stmtAny->fetchColumn();
                }
            }
            $b['batch_id'] = $batchId;

            if ($batchId <= 0 && $productId > 0) {
                // Direct product stock deduction when no batch exists
                $stmtP = $this->db->prepare("SELECT id, name, stock_quantity FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL FOR UPDATE");
                $stmtP->execute([$productId, $tid]);
                $pRow = $stmtP->fetch(PDO::FETCH_ASSOC);
                if (!$pRow) {
                    $this->db->rollBack();
                    respond(404, null, 'Không tìm thấy sản phẩm trong kho', false);
                }
                if ((float)$pRow['stock_quantity'] < $qty) {
                    $this->db->rollBack();
                    respond(422, null, 'Số lượng tồn kho sản phẩm không đủ', false);
                }
                $this->db->prepare("UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ? AND tenant_id = ?")
                     ->execute([$qty, $productId, $tid]);
                $this->db->commit();
                respond(200, ['product_id' => $productId, 'qty_exported' => $qty], 'Xuất kho nội bộ thành công');
                return;
            }

            // 1. Get batch info and lock for update
            $stmt = $this->db->prepare("
                SELECT b.current_qty, b.import_price, b.product_id, COALESCE(p.unit, 'Cái') as unit, p.name as product_name
                FROM batches b
                LEFT JOIN products p ON p.id = b.product_id
                WHERE b.id = ? AND b.tenant_id = ?
                FOR UPDATE
            ");
            $stmt->execute([$b['batch_id'], $auth['tenant_id']]);
            $batch = $stmt->fetch();

            if (!$batch) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy lô hàng', false);
            }
            if ($batch['current_qty'] < $b['qty']) {
                $this->db->rollBack();
                respond(422, null, 'Số lượng tồn kho trong lô không đủ', false);
            }

            // 2. Update batch quantity
            $newQty = (float)$batch['current_qty'] - (float)$b['qty'];
            $this->db->prepare("UPDATE batches SET current_qty = ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$newQty, $b['batch_id'], $auth['tenant_id']]);

            // 3. Create inventory log
            $logStmt = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by, receiver_id, receiver_type)
                VALUES (?, ?, 'EXPORT_INTERNAL', ?, ?, ?, ?, ?)
            ");
            $receiverId = !empty($b['receiver_id']) ? (int)$b['receiver_id'] : null;
            $receiverType = $receiverId ? 'contact' : null; // Default to contact for now as per UI
            
            $logStmt->execute([
                $auth['tenant_id'], $b['batch_id'], -$b['qty'], $b['reason'], $auth['user_id'], $receiverId, $receiverType
            ]);

            // 4. Update overall product stock (prevent negative stock)
            $this->db->prepare("UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ? AND tenant_id = ?")
                 ->execute([$b['qty'], $batch['product_id'], $auth['tenant_id']]);

            // 5. If gift/loss with receiver, create Expense record automatically
            if ($receiverId && $b['reason'] === 'Hàng tặng/Quà tặng') {
                $expenseAmount = $b['qty'] * $batch['import_price'];
                $pName = $batch['product_name'] ?? '';
                if (!$pName) {
                    $productNameStmt = $this->db->prepare("SELECT name FROM products WHERE id = ? AND tenant_id = ?");
                    $productNameStmt->execute([$batch['product_id'], $auth['tenant_id']]);
                    $pName = $productNameStmt->fetchColumn();
                }

                $expStmt = $this->db->prepare("
                    INSERT INTO expenses (tenant_id, created_by, title, category, amount, vat_amount, date, status, notes, has_vat_invoice, is_vat_inclusive)
                    VALUES (?, ?, ?, 'Quà tặng khách hàng', ?, 0, CURRENT_DATE, 'approved', ?, 0, 1)
                ");
                $expTitle = "Tặng phẩm: $pName (x" . $b['qty'] . ")";
                $expNotes = "Xuất từ lô #" . $b['batch_id'] . ". Lý do: " . $b['reason'];
                $expStmt->execute([
                    $auth['tenant_id'], $auth['user_id'], $expTitle, $expenseAmount, $expNotes
                ]);
                $expenseId = (int)$this->db->lastInsertId();

                // Link expense to the receiver entity
                $this->db->prepare("
                    INSERT INTO expense_entities (tenant_id, expense_id, entity_type, entity_id, amount)
                    VALUES (?, ?, ?, ?, ?)
                ")->execute([
                    $auth['tenant_id'], $expenseId, $receiverType, $receiverId, $expenseAmount
                ]);

                // Log interaction in contact timeline
                $unitLabel = $batch['unit'] ?? 'Cái';
                logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', "Nhận quà tặng: $pName", "Quà tặng từ kho (Lô #{$b['batch_id']}). Số lượng: {$b['qty']} {$unitLabel}. Lý do: {$b['reason']}", 'contact', $receiverId);
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'EXPORT_INTERNAL', 'inventory', $b['batch_id'], json_encode(['qty' => $b['qty'], 'reason' => $b['reason']]));
            $this->db->commit();
            respond(200, null, 'Xuất kho nội bộ thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }

    /**
     * Get logs for a specific batch or global logs
     */
    public function logs(array $auth): void {
        $batchId = (int)($_GET['batch_id'] ?? 0);
        if ($batchId > 0) {
            $this->getLogs($auth, $batchId);
        } else {
            $this->globalLogs($auth);
        }
    }

    /**
     * Get logs for a specific batch
     */
    public function getLogs(array $auth, int $batchId): void {
        if ($batchId <= 0) {
            $this->globalLogs($auth);
            return;
        }
        $stmt = $this->db->prepare("
            SELECT l.*, u.full_name as creator_name
            FROM inventory_logs l
            LEFT JOIN users u ON l.created_by = u.id
            WHERE l.batch_id = ? AND l.tenant_id = ?
            ORDER BY l.created_at DESC
        ");
        $stmt->execute([$batchId, $auth['tenant_id']]);
        respond(200, $stmt->fetchAll());
    }

    /**
     * Manual adjustment
     */
    public function adjust(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'manager', 'director'], true)) respond(403, null, 'Bạn không có quyền điều chỉnh kho', false);
        $b = getBody();
        $tid = (int)$auth['tenant_id'];

        if (!empty($b['items']) && is_array($b['items']) && isset($b['items'][0])) {
            $first = $b['items'][0];
            $b['batch_id'] = $b['batch_id'] ?? $first['batch_id'] ?? null;
            $b['product_id'] = $b['product_id'] ?? $b['item_id'] ?? $first['product_id'] ?? $first['item_id'] ?? $first['id'] ?? null;
            if (!isset($b['new_qty'])) {
                $b['new_qty'] = $first['new_qty'] ?? $first['qty'] ?? $first['quantity'] ?? null;
            }
        }

        $batchId = (int)($b['batch_id'] ?? 0);
        $productId = (int)($b['product_id'] ?? $b['item_id'] ?? 0);
        $hasNewQty = isset($b['new_qty']) || isset($b['qty']) || isset($b['quantity']);
        $newQtyInput = $hasNewQty ? (float)($b['new_qty'] ?? $b['qty'] ?? $b['quantity']) : null;
        $qtyChangeInput = isset($b['quantity_change']) ? (float)$b['quantity_change'] : (isset($b['adjustment']) ? (float)$b['adjustment'] : null);
        $reason = trim($b['reason'] ?? $b['note'] ?? $b['notes'] ?? 'Điều chỉnh thủ công');

        if ($batchId <= 0 && $productId <= 0) {
            respond(400, null, 'Thiếu thông tin điều chỉnh (batch_id hoặc product_id)', false);
        }
        if ($newQtyInput === null && $qtyChangeInput === null) {
            respond(400, null, 'Thiếu thông tin số lượng điều chỉnh', false);
        }
        if ($newQtyInput !== null && $newQtyInput < 0) {
            respond(422, null, 'Số lượng tồn kho không được nhỏ hơn 0', false);
        }

        $this->db->beginTransaction();
        try {
            if ($batchId <= 0 && $productId > 0) {
                $batchId = $this->resolveOrCreateBatchId($tid, $productId, 0);
            }
            if ($batchId <= 0) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy sản phẩm hoặc lô hàng', false);
            }

            $stmt = $this->db->prepare("SELECT current_qty, product_id FROM batches WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$batchId, $auth['tenant_id']]);
            $batch = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$batch) {
                $this->db->rollBack();
                respond(404, null, 'Không tìm thấy lô hàng', false);
            }

            $finalNewQty = $newQtyInput !== null
                ? $newQtyInput
                : max(0.0, (float)$batch['current_qty'] + (float)$qtyChangeInput);

            $qtyChange = $finalNewQty - (float)$batch['current_qty'];
            $this->db->prepare("UPDATE batches SET current_qty = ? WHERE id = ? AND tenant_id = ?")
                 ->execute([$finalNewQty, $batchId, $auth['tenant_id']]);

            $logStmt = $this->db->prepare("
                INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
                VALUES (?, ?, 'ADJUST', ?, ?, ?)
            ");
            $logStmt->execute([
                $auth['tenant_id'], $batchId, $qtyChange, $reason, $auth['user_id']
            ]);

            // Update overall product stock
            $this->db->prepare("UPDATE products p JOIN batches b ON p.id = b.product_id SET p.stock_quantity = GREATEST(0, COALESCE(p.stock_quantity, 0) + ?) WHERE b.id = ? AND p.tenant_id = ?")
                 ->execute([$qtyChange, $batchId, $auth['tenant_id']]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'ADJUST', 'inventory', $batchId, json_encode(['new_qty' => $finalNewQty, 'reason' => $reason]));
            $this->db->commit();
            respond(200, ['batch_id' => $batchId, 'new_qty' => $finalNewQty, 'qty_change' => $qtyChange], 'Điều chỉnh kho thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, $e->getMessage(), false);
        }
    }
    /**
     * Get global inventory logs for the tenant
     */
    public function globalLogs(array $auth): void {
        $tid = $auth['tenant_id'];
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        
        $stmt = $this->db->prepare("
            SELECT l.*, b.batch_code, p.name as product_name, u.full_name as creator_name
            FROM inventory_logs l
            JOIN batches b ON l.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            LEFT JOIN users u ON l.created_by = u.id
            WHERE l.tenant_id = ?
            ORDER BY l.created_at DESC
            LIMIT $limit
        ");
        $stmt->execute([$tid]);
        respond(200, $stmt->fetchAll());
    }

    /**
     * Archive a batch (when it's empty and no longer needed in active list)
     */
    public function archive(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) respond(403, null, 'Chỉ admin mới có quyền lưu trữ lô hàng', false);
        
        $stmt = $this->db->prepare("SELECT current_qty FROM batches WHERE id=? AND tenant_id=?");
        $stmt->execute([$id, $auth['tenant_id']]);
        $qty = $stmt->fetchColumn();
        
        if ($qty === false) respond(404, null, 'Không tìm thấy lô hàng', false);
        if ((float)$qty > 0) respond(400, null, 'Không thể lưu trữ lô hàng còn tồn kho. Vui lòng điều chỉnh kho về 0 trước.', false);

        $upd = $this->db->prepare("UPDATE batches SET status='archived' WHERE id=? AND tenant_id=? AND current_qty <= 0");
        $upd->execute([$id, $auth['tenant_id']]);
        if ($upd->rowCount() === 0) {
            respond(409, null, 'Không thể lưu trữ lô hàng do số lượng tồn kho đã thay đổi', false);
        }
        respond(200, null, 'Đã lưu trữ lô hàng');
    }
}
