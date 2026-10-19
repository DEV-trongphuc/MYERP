<?php
// f:\CRM\backend\controllers\POSController.php

class POSController {
    private PDO $db;
    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensurePosTables();
    }

    private function ensurePosTables(): void {
        static $checked = false;
        if ($checked || $this->db->inTransaction()) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS pos_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    branch_id INT NULL,
                    user_id INT NOT NULL,
                    opening_cash DECIMAL(15,2) NOT NULL DEFAULT 0,
                    closing_cash DECIMAL(15,2) NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'open',
                    note TEXT NULL,
                    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    closed_at DATETIME NULL,
                    INDEX idx_tenant_status (tenant_id, status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure POS Tables Error: " . $e->getMessage());
        }
    }

    public function listSessions(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("
            SELECT ps.*, u.full_name as cashier_name
            FROM pos_sessions ps
            LEFT JOIN users u ON ps.user_id = u.id
            WHERE ps.tenant_id = ?
            ORDER BY ps.id DESC
            LIMIT 100
        ");
        $stmt->execute([$tid]);
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [], 'Lấy danh sách ca bán hàng POS thành công');
    }

    public function showSession(array $auth, int $id): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("
            SELECT ps.*, u.full_name as cashier_name
            FROM pos_sessions ps
            LEFT JOIN users u ON ps.user_id = u.id
            WHERE ps.id = ? AND ps.tenant_id = ?
            LIMIT 1
        ");
        $stmt->execute([$id, $tid]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$session) {
            respond(404, null, 'Không tìm thấy ca bán hàng POS', false);
        }
        respond(200, $session, 'Lấy chi tiết ca bán hàng POS thành công');
    }

    public function openSession(array $auth): void {
        if (($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền mở ca POS', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $b = getBody();
        $branchId = isset($b['branch_id']) && $b['branch_id'] !== '' ? (int)$b['branch_id'] : null;
        $openingCash = (float)($b['opening_cash'] ?? $b['initial_cash'] ?? 0);
        if ($openingCash < 0) {
            respond(422, null, 'Tiền đầu ca không được âm', false);
        }
        $note = trim($b['note'] ?? $b['notes'] ?? '');

        $stmt = $this->db->prepare("
            INSERT INTO pos_sessions (tenant_id, branch_id, user_id, opening_cash, status, note, opened_at)
            VALUES (?, ?, ?, ?, 'open', ?, NOW())
        ");
        $stmt->execute([$tid, $branchId, $uid, $openingCash, $note ?: null]);
        $id = (int)$this->db->lastInsertId();

        respond(201, [
            'id' => $id,
            'session_id' => $id,
            'tenant_id' => $tid,
            'branch_id' => $branchId,
            'user_id' => $uid,
            'opening_cash' => $openingCash,
            'status' => 'open',
            'note' => $note ?: null
        ], 'Mở ca bán hàng POS thành công');
    }

    public function closeSession(array $auth, int $id): void {
        if (($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền đóng ca POS', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $b = getBody();
        $closingCash = isset($b['closing_cash']) ? (float)$b['closing_cash'] : (isset($b['actual_cash']) ? (float)$b['actual_cash'] : 0.0);
        if ($closingCash < 0) {
            respond(422, null, 'Tiền cuối ca không được âm', false);
        }
        $note = trim($b['note'] ?? $b['notes'] ?? '');

        $stmtCheck = $this->db->prepare("SELECT * FROM pos_sessions WHERE id = ? AND tenant_id = ? LIMIT 1");
        $stmtCheck->execute([$id, $tid]);
        $session = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$session) {
            respond(404, null, 'Không tìm thấy ca bán hàng POS', false);
        }

        $upd = $this->db->prepare("
            UPDATE pos_sessions
            SET closing_cash = ?, status = 'closed', note = COALESCE(NULLIF(?, ''), note), closed_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ");
        $upd->execute([$closingCash, $note, $id, $tid]);

        respond(200, [
            'id' => $id,
            'session_id' => $id,
            'closing_cash' => $closingCash,
            'status' => 'closed'
        ], 'Đóng ca bán hàng POS thành công');
    }

    public function showOrder(array $auth, int $id): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("
            SELECT i.*, c.full_name as customer_name, c.phone as customer_phone
            FROM invoices i
            LEFT JOIN contacts c ON i.contact_id = c.id
            WHERE i.id = ? AND i.tenant_id = ? AND i.deleted_at IS NULL
            LIMIT 1
        ");
        $stmt->execute([$id, $tid]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            respond(404, null, 'Không tìm thấy đơn hàng POS', false);
        }

        $stmtItems = $this->db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
        $stmtItems->execute([$id]);
        $order['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC) ?: [];

        respond(200, $order, 'Lấy chi tiết đơn hàng POS thành công');
    }

    public function deleteOrder(array $auth, int $id): void {
        if (($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền hủy đơn hàng POS', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmtCheck = $this->db->prepare("SELECT id FROM invoices WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmtCheck->execute([$id, $tid]);
        if (!$stmtCheck->fetch()) {
            respond(404, null, 'Không tìm thấy đơn hàng POS', false);
        }

        $upd = $this->db->prepare("UPDATE invoices SET deleted_at = NOW(), status = 'cancelled' WHERE id = ? AND tenant_id = ?");
        $upd->execute([$id, $tid]);
        respond(200, ['id' => $id, 'status' => 'cancelled'], 'Đã hủy đơn hàng POS thành công');
    }

    public function createOrder(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện giao dịch POS', false);
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $data = getBody();

        $rawCart = !empty($data['cart']) && is_array($data['cart'])
            ? $data['cart']
            : (!empty($data['items']) && is_array($data['items']) ? $data['items'] : []);

        if (empty($rawCart)) {
            respond(400, null, "Giỏ hàng không được để trống", false);
        }
        $data['cart'] = $rawCart;

        $customerId = !empty($data['customer_id'])
            ? (int)$data['customer_id']
            : (!empty($data['contact_id']) ? (int)$data['contact_id'] : null);
        
        // Server-side validation of total_amount & authoritative product price lookup
        $calculatedTotal = 0;
        foreach ($data['cart'] as &$item) {
            $itemId = !empty($item['id']) ? (int)$item['id'] : (!empty($item['product_id']) ? (int)$item['product_id'] : null);
            $item['id'] = $itemId;
            $qty = (float)($item['quantity'] ?? ($item['qty'] ?? 0));
            $itemPrice = (float)($item['price'] ?? ($item['unit_price'] ?? 0));
            if ($qty <= 0 || $itemPrice < 0 || (isset($item['qty']) && (float)$item['qty'] <= 0)) {
                respond(422, null, "Số lượng phải lớn hơn 0 và giá không được âm", false);
            }
            if (!empty($item['id'])) {
                $pCheck = $this->db->prepare("SELECT name, price FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
                $pCheck->execute([(int)$item['id'], $tid]);
                $prodRow = $pCheck->fetch(PDO::FETCH_ASSOC);
                if (!$prodRow) {
                    respond(403, null, "Sản phẩm ID {$item['id']} không hợp lệ hoặc không thuộc cửa hàng này", false);
                }
                if (empty($item['name'])) {
                    $item['name'] = $prodRow['name'] ?? ('Sản phẩm #' . $item['id']);
                }
                if ($itemPrice <= 0) {
                    $itemPrice = (float)($prodRow['price'] ?? 0);
                }
                $item['price'] = $itemPrice;
            } else {
                $item['price'] = $itemPrice;
                if (empty($item['name'])) {
                    $item['name'] = 'Sản phẩm POS';
                }
            }
            if ($itemPrice < 0) {
                respond(422, null, "Đơn giá sản phẩm không được âm", false);
            }
            $item['quantity'] = $qty;
            $calculatedTotal += $itemPrice * $qty;
        }
        unset($item);
        $shipping = (float)($data['shipping_fee'] ?? 0);
        if ($shipping < 0) respond(422, null, "Phí giao hàng không được âm", false);
        $shippingCustomerPay = (int)($data['shipping_customer_pay'] ?? 0);
        $totalWithShipping = $calculatedTotal + ($shippingCustomerPay ? $shipping : 0);

        if (!isset($data['total_amount']) || (float)$data['total_amount'] <= 0) {
            $data['total_amount'] = $totalWithShipping;
        } elseif (abs($totalWithShipping - (float)$data['total_amount']) > 1) {
            respond(422, null, "Tổng tiền không khớp với dữ liệu giỏ hàng. Vui lòng kiểm tra lại.", false);
        }

        if ($customerId) {
            // Verify customer belongs to tenant and is accessible by the user's role
            $sqlCust = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
            $pCust = [$customerId, $tid];
            if (in_array($auth['role'], ['sales', 'sale'], true)) {
                $sqlCust .= " AND owner_id=?";
                $pCust[] = $uid;
            } else if ($auth['role'] === 'manager') {
                $sqlCust .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
                $pCust[] = $uid;
                $pCust[] = $uid;
            }
            $checkCust = $this->db->prepare($sqlCust);
            $checkCust->execute($pCust);
            if (!$checkCust->fetch()) {
                respond(403, null, "Khách hàng không hợp lệ hoặc bạn không có quyền thao tác trên khách hàng này", false);
            }
        }

        $this->db->beginTransaction();
        try {
            $title = "Đơn hàng POS - " . date('d/m/Y H:i');
            
            // 1. Create an Invoice (Status: paid)
            $today = date('Ymd');
            $invNum = 'POS-' . $today . '-' . strtoupper(bin2hex(random_bytes(3)));
            $sInv = $this->db->prepare("
                INSERT INTO invoices (tenant_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, paid_at, total, shipping_fee, shipping_customer_pay, is_inventory_deducted)
                VALUES (?, ?, ?, ?, ?, 'paid', CURDATE(), CURDATE(), NOW(), ?, ?, ?, 1)
            ");
            $sInv->execute([
                $tid, 
                $customerId, 
                $uid, 
                $invNum, 
                $title, 
                $data['total_amount'],
                $data['shipping_fee'] ?? 0,
                $data['shipping_customer_pay'] ?? 0
            ]);
            $invId = (int)$this->db->lastInsertId();


            // 2. Add Invoice Items and Deduct Stock
            $sItem = $this->db->prepare("INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($data['cart'] as $item) {
                $sItem->execute([
                    $invId,
                    $item['id'] ?? null,
                    $item['name'],
                    $item['quantity'],
                    $item['price'],
                    $item['price'] * $item['quantity']
                ]);
                
                // Deduct stock if product_id is present
                if (!empty($item['id'])) {
                    $pCheck = $this->db->prepare("SELECT track_inventory FROM products WHERE id=? AND tenant_id=?");
                    $pCheck->execute([(int) $item['id'], $tid]);
                    if ($pCheck->fetchColumn()) {
                        deductStockFIFO($this->db, $tid, $uid, (int)$item['id'], (float)$item['quantity'], $invNum);
                    }
                }
            }

            // 3. Update Customer Stats & Timeline
            if ($customerId) {
                $sCust = $this->db->prepare("
                    UPDATE contacts 
                    SET total_spent = total_spent + ?, 
                        order_count = order_count + 1, 
                        last_order_at = NOW(),
                        last_contact = NOW(),
                        status = 'customer'
                    WHERE id = ? AND tenant_id = ?
                ");
                $sCust->execute([$data['total_amount'], $customerId, $tid]);

                logInteraction(
                    $this->db, $tid, $uid, 'task', 
                    "Đơn hàng POS #$invNum", 
                    "Đơn hàng trị giá " . number_format($data['total_amount'], 0, ',', '.') . " đ đã hoàn tất.",
                    'contact', $customerId
                );
            }

            // 4. Activity log (Internal Audit)
            logActivity($this->db, $tid, $uid, 'Tạo đơn hàng POS', 'invoice', (int)$invId, $invNum);

            $this->db->commit();
            respond(201, [
                "id" => $invId,
                "order_id" => $invId,
                "invoice_id" => $invId,
                "invoice_number" => $invNum,
                "message" => "Đơn hàng hoàn tất thành công"
            ]);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, $e->getMessage(), false);
        }
    }
}
