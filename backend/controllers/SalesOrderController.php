<?php
// backend/controllers/SalesOrderController.php
// IDEAS ERP - Controller Quản lý Đơn bán hàng (Sales Orders)

class SalesOrderController {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    /**
     * Lấy danh sách Đơn bán hàng (SO) tối ưu Eager Loading (Không N+1 query)
     */
    public function index(array $auth): void {
        $tenantId = (int)$auth['tenant_id'];
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(5000, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $status = trim($_GET['status'] ?? '');
        $search = trim($_GET['search'] ?? '');
        $startDate = trim($_GET['start_date'] ?? '');
        $endDate = trim($_GET['end_date'] ?? '');
        $paymentStatus = trim($_GET['payment_status'] ?? '');
        $excludeStatus = trim($_GET['exclude_status'] ?? '');

        $where = ["so.tenant_id = :tenant_id"];
        $params = [':tenant_id' => $tenantId];

        $companyId = (int)($_GET['company_id'] ?? 0);
        if ($companyId > 0) {
            $where[] = "so.company_id = :company_id";
            $params[':company_id'] = $companyId;
        }

        $contactId = (int)($_GET['contact_id'] ?? 0);
        if ($contactId > 0) {
            $where[] = "so.contact_id = :contact_id";
            $params[':contact_id'] = $contactId;
        }

        if (!empty($status)) {
            $where[] = "so.status = :status";
            $params[':status'] = $status;
        }

        if (!empty($paymentStatus)) {
            if ($paymentStatus === 'unpaid') {
                $where[] = "so.payment_status != 'paid'";
            } else {
                $where[] = "so.payment_status = :payment_status";
                $params[':payment_status'] = $paymentStatus;
            }
        }

        if (!empty($excludeStatus)) {
            $where[] = "so.status != :exclude_status";
            $params[':exclude_status'] = $excludeStatus;
        }

        if (!empty($startDate)) {
            $where[] = "so.order_date >= :start_date";
            $params[':start_date'] = $startDate;
        }

        if (!empty($endDate)) {
            $where[] = "so.order_date <= :end_date";
            $params[':end_date'] = $endDate;
        }

        if (!empty($search)) {
            $where[] = "(so.so_number LIKE :search OR c.name LIKE :search OR comp.name LIKE :search)";
            $params[':search'] = "%{$search}%";
        }

        $whereClause = implode(' AND ', $where);

        $simple = ($_GET['simple'] ?? '') === '1';
        if ($simple) {
            $sql = "
                SELECT 
                    so.id, so.so_number, so.total, so.paid_amount, so.order_date, so.status, so.payment_status,
                    c.full_name as contact_name,
                    c.phone as contact_phone,
                    comp.name as company_name
                FROM sales_orders so
                LEFT JOIN contacts c ON so.contact_id = c.id
                LEFT JOIN companies comp ON so.company_id = comp.id
                WHERE {$whereClause}
                ORDER BY so.id DESC
                LIMIT {$limit} OFFSET {$offset}
            ";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            respond(200, [
                'orders' => $orders,
                'pagination' => [
                    'total' => count($orders),
                    'page' => $page,
                    'limit' => $limit,
                    'total_pages' => 1
                ]
            ], 'Lấy danh sách đơn bán hàng thành công');
            return;
        }

        // 1. Đếm tổng số bản ghi
        $countStmt = $this->db->prepare("
            SELECT COUNT(*) 
            FROM sales_orders so
            LEFT JOIN contacts c ON so.contact_id = c.id
            LEFT JOIN companies comp ON so.company_id = comp.id
            WHERE {$whereClause}
        ");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // 2. Lấy danh sách SO (Sử dụng Composite Index: idx_so_tenant_status_date)
        $sql = "
            SELECT 
                so.*,
                c.full_name as contact_name,
                c.phone as contact_phone,
                c.email as contact_email,
                comp.name as company_name,
                u.full_name as creator_name
            FROM sales_orders so
            LEFT JOIN contacts c ON so.contact_id = c.id
            LEFT JOIN companies comp ON so.company_id = comp.id
            LEFT JOIN users u ON so.created_by = u.id
            WHERE {$whereClause}
            ORDER BY so.id DESC
            LIMIT {$limit} OFFSET {$offset}
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Eager Loading items (Gom nhóm 1 query thay vì N+1)
        if (!empty($orders)) {
            $soIds = array_column($orders, 'id');
            $inClause = implode(',', array_map('intval', $soIds));
            $itemStmt = $this->db->query("SELECT * FROM sales_order_items WHERE so_id IN ({$inClause}) ORDER BY sort_order ASC, id ASC");
            $allItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $itemsBySo = [];
            foreach ($allItems as $item) {
                $itemsBySo[$item['so_id']][] = $item;
            }

            foreach ($orders as &$order) {
                $order['items'] = $itemsBySo[$order['id']] ?? [];
            }
        }

        respond(200, [
            'orders' => $orders,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => ceil($total / $limit)
            ]
        ], 'Lấy danh sách đơn bán hàng thành công');
    }

    /**
     * Chi tiết một Đơn bán hàng
     */
    public function show(array $auth, int $id): void {
        $stmt = $this->db->prepare("
            SELECT 
                so.*,
                c.full_name as contact_name, c.phone as contact_phone, c.email as contact_email,
                comp.name as company_name,
                u.full_name as creator_name
            FROM sales_orders so
            LEFT JOIN contacts c ON so.contact_id = c.id
            LEFT JOIN companies comp ON so.company_id = comp.id
            LEFT JOIN users u ON so.created_by = u.id
            WHERE so.id = ? AND so.tenant_id = ?
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            respond(404, null, 'Đơn bán hàng không tồn tại', false);
        }

        $itemStmt = $this->db->prepare("SELECT * FROM sales_order_items WHERE so_id = ? ORDER BY sort_order ASC, id ASC");
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        respond(200, $order, 'Lấy chi tiết đơn bán hàng thành công');
    }

    /**
     * Tạo Đơn bán hàng mới trong DB Transaction
     */
    public function store(array $auth): void {
        $data = getBody();
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];

        $contactId = !empty($data['contact_id']) ? (int)$data['contact_id'] : null;
        $companyId = !empty($data['company_id']) ? (int)$data['company_id'] : null;
        $dealId = !empty($data['deal_id']) ? (int)$data['deal_id'] : null;
        $quoteId = !empty($data['quote_id']) ? (int)$data['quote_id'] : null;
        $orderDate = !empty($data['order_date']) ? $data['order_date'] : date('Y-m-d');
        $deliveryDate = !empty($data['delivery_date']) ? $data['delivery_date'] : null;
        $notes = $data['notes'] ?? '';
        $terms = $data['terms'] ?? '';
        $items = $data['items'] ?? [];

        if (empty($items) || !is_array($items)) {
            respond(400, null, 'Danh sách sản phẩm đơn bán hàng không được rỗng', false);
        }

        // Tạo mã SO tự động: SO-YYYYMMDD-XXXX
        $soNumber = 'SO-' . date('Ymd') . '-' . sprintf('%04d', rand(1, 9999));

        $subtotal = 0;
        $taxTotal = 0;
        $discountTotal = max(0, (float)($data['discount'] ?? 0));

        foreach ($items as $it) {
            $qty = max(0.01, (float)($it['quantity'] ?? 1));
            $price = max(0, (float)($it['unit_price'] ?? 0));
            $discPct = min(100, max(0, (float)($it['discount'] ?? 0)));
            
            $itemSub = $qty * $price * (1 - $discPct / 100);
            $subtotal += $itemSub;
        }

        $taxPct = min(100, max(0, (float)($data['tax_percent'] ?? 0)));
        $taxTotal = $subtotal * ($taxPct / 100);
        $total = $subtotal + $taxTotal - $discountTotal;

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO sales_orders 
                (tenant_id, contact_id, company_id, deal_id, quote_id, created_by, so_number, order_date, delivery_date, status, payment_status, subtotal, discount, tax, total, notes, terms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'unpaid', ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $tenantId, $contactId, $companyId, $dealId, $quoteId, $userId,
                $soNumber, $orderDate, $deliveryDate, $subtotal, $discountTotal, $taxTotal, $total, $notes, $terms
            ]);
            $soId = (int)$this->db->lastInsertId();

            $itemInsert = $this->db->prepare("
                INSERT INTO sales_order_items (so_id, product_id, name, description, quantity, unit_price, discount, subtotal, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($items as $idx => $it) {
                $qty = max(0.01, (float)($it['quantity'] ?? 1));
                $price = max(0, (float)($it['unit_price'] ?? 0));
                $discPct = min(100, max(0, (float)($it['discount'] ?? 0)));
                $itemSub = $qty * $price * (1 - $discPct / 100);

                $itemInsert->execute([
                    $soId,
                    !empty($it['product_id']) ? (int)$it['product_id'] : null,
                    $it['name'] ?? 'Sản phẩm',
                    $it['description'] ?? '',
                    $qty,
                    $price,
                    $discPct,
                    $itemSub,
                    $idx
                ]);
            }

            $this->db->commit();
            respond(201, ['id' => $soId, 'so_number' => $soNumber, 'total' => $total], 'Tạo đơn bán hàng thành công');
        } catch (\Throwable $e) {
            if ($e instanceof \Exception && (get_class($e) === 'ResponseException' || get_class($e) === 'RespondException')) {
                throw $e;
            }
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi tạo đơn bán hàng: ' . $e->getMessage(), false);
        }
    }

    /**
     * Phê duyệt Đơn bán hàng
     */
    public function approve(array $auth, int $id): void {
        $stmt = $this->db->prepare("SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
        $stmt->execute([$id, $auth['tenant_id']]);
        $so = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$so) {
            respond(404, null, 'Đơn bán hàng không tồn tại', false);
        }
        if ($so['status'] !== 'draft') {
            respond(422, null, 'Chỉ có thể phê duyệt đơn bán hàng nháp', false);
        }

        $update = $this->db->prepare("UPDATE sales_orders SET status = 'approved' WHERE id = ?");
        $update->execute([$id]);

        respond(200, ['id' => $id, 'status' => 'approved'], 'Phê duyệt đơn bán hàng thành công');
    }

    /**
     * Chuyển Đơn bán hàng (SO) thành Hóa đơn (Invoice) trong CSDL Transaction
     */
    public function convertToInvoice(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ? FOR UPDATE");
            $stmt->execute([$id, $tenantId]);
            $so = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$so) {
                $this->db->rollBack();
                respond(404, null, 'Đơn bán hàng không tồn tại', false);
                return;
            }
            if ($so['status'] !== 'approved') {
                $this->db->rollBack();
                respond(422, null, 'Đơn bán hàng phải ở trạng thái đã phê duyệt mới có thể tạo hóa đơn', false);
                return;
            }

            $itemStmt = $this->db->prepare("SELECT * FROM sales_order_items WHERE so_id = ?");
            $itemStmt->execute([$id]);
            $items = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $invNumber = 'INV-' . date('Ymd') . '-' . sprintf('%04d', rand(1, 9999));
            $issueDate = date('Y-m-d');
            $dueDate = date('Y-m-d', strtotime('+30 days'));

            $invInsert = $this->db->prepare("
                INSERT INTO invoices (tenant_id, deal_id, company_id, contact_id, created_by, invoice_number, title, status, issue_date, due_date, subtotal, discount, tax, total, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
            ");
            $invInsert->execute([
                $tenantId, $so['deal_id'], $so['company_id'], $so['contact_id'], $userId,
                $invNumber, "Hóa đơn xuất từ SO #" . $so['so_number'], $issueDate, $dueDate,
                $so['subtotal'], $so['discount'], $so['tax'], $so['total'], "Được sinh tự động từ SO " . $so['so_number']
            ]);
            $invId = (int)$this->db->lastInsertId();

            $invItemInsert = $this->db->prepare("
                INSERT INTO invoice_items (invoice_id, product_id, name, quantity, unit_price, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            foreach ($items as $it) {
                $invItemInsert->execute([
                    $invId, $it['product_id'], $it['name'],
                    $it['quantity'], $it['unit_price'], $it['subtotal']
                ]);
            }

            // Cập nhật SO sang completed
            $this->db->prepare("UPDATE sales_orders SET status = 'completed' WHERE id = ?")->execute([$id]);

            $this->db->commit();
            respond(201, ['invoice_id' => $invId, 'invoice_number' => $invNumber], 'Chuyển đơn bán hàng thành Hóa đơn thành công');
        } catch (\Throwable $e) {
            if ($e instanceof \Exception && (get_class($e) === 'ResponseException' || get_class($e) === 'RespondException')) {
                throw $e;
            }
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi chuyển SO thành Hóa đơn: ' . $e->getMessage(), false);
        }
    }
}
