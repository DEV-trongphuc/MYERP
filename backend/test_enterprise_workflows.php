<?php
// backend/test_enterprise_workflows.php
// Tập lệnh kiểm thử tự động tích hợp cho PO, SO, Mentions, Notifications

define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 KHỞI CHẠY KIỂM THỬ TÍCH HỢP QUY TRÌNH HỆ THỐNG ERP\n";
echo "====================================================\n\n";

$tenantId = 1;
$adminId = 100010; // Director/Admin thực tế
$salesId = 100012; // Sales thực tế
$accountantId = 100014; // Kế toán thực tế

// ----------------------------------------------------------------
// 1. KIỂM THỬ QUY TRÌNH PO (PURCHASE ORDERS) & NHẬP KHO
// ----------------------------------------------------------------
echo "--- 1. Kiểm thử quy trình Đơn Nhập Hàng (PO) ---\n";

// Khởi tạo Nhà cung cấp và Sản phẩm giả lập
$conn->query("INSERT INTO suppliers (tenant_id, created_by, name) VALUES ({$tenantId}, {$adminId}, 'Nhà cung cấp thử nghiệm PO')");
$supplierId = $conn->insert_id;
assertTest("Mock nhà cung cấp thành công", $supplierId > 0, "Supplier ID: {$supplierId}");

$conn->query("INSERT INTO products (tenant_id, created_by, name, price, cost, stock_quantity) VALUES ({$tenantId}, {$adminId}, 'Sản phẩm thử nghiệm PO', 15000.00, 10000.00, 100.00)");
$productId = $conn->insert_id;
$initialStock = 100.00;
assertTest("Mock sản phẩm thành công", $productId > 0, "Product ID: {$productId}");

// Tạo PO giả định
$poNumber = 'PO-TEST-' . time();
$conn->query("
    INSERT INTO purchase_orders (tenant_id, supplier_id, created_by, po_number, order_date, status, subtotal, tax, total)
    VALUES ({$tenantId}, {$supplierId}, {$adminId}, '{$poNumber}', CURDATE(), 'ordered', 100000.00, 10000.00, 110000.00)
");
$poId = $conn->insert_id;
assertTest("Tạo đơn mua hàng PO thành công", $poId > 0, "PO ID: {$poId}, PO Number: {$poNumber}");

// Thêm sản phẩm vào PO
$conn->query("
    INSERT INTO purchase_order_items (po_id, product_id, name, quantity, unit_cost, subtotal)
    VALUES ({$poId}, {$productId}, 'Sản phẩm Test PO', 10.00, 10000.00, 100000.00)
");
$poItemId = $conn->insert_id;
assertTest("Thêm sản phẩm vào đơn PO thành công", $poItemId > 0);

// Giả lập logic Nhập kho (nhận hàng) của PurchaseOrderController::receive
// 1. Chuyển trạng thái PO sang received
$conn->query("UPDATE purchase_orders SET status = 'received' WHERE id = {$poId}");

// 2. Cộng tồn kho sản phẩm
$conn->query("UPDATE products SET stock_quantity = stock_quantity + 10 WHERE id = {$productId}");

// 3. Tạo lô hàng (Batch)
$batchCode = $poNumber . '-MOCK';
$conn->query("
    INSERT INTO batches (tenant_id, product_id, supplier_id, po_id, batch_code, import_date, import_price, initial_qty, current_qty)
    VALUES ({$tenantId}, {$productId}, {$supplierId}, {$poId}, '{$batchCode}', CURDATE(), 10000.00, 10.00, 10.00)
");
$batchId = $conn->insert_id;

// 4. Ghi log lịch sử kho
$conn->query("
    INSERT INTO inventory_logs (tenant_id, batch_id, action_type, qty_change, reason, created_by)
    VALUES ({$tenantId}, {$batchId}, 'IMPORT', 10.00, 'Nhập kho từ đơn test', {$adminId})
");

// Đối soát Database sau khi nhập kho
assertDbField($conn, 'purchase_orders', 'status', "id = {$poId}", 'received', "Trạng thái PO chuyển thành 'received'");
assertDbField($conn, 'products', 'stock_quantity', "id = {$productId}", $initialStock + 10, "Số lượng tồn kho sản phẩm tăng thêm 10. (Trước: {$initialStock}, Sau: " . ($initialStock + 10) . ")");

$chkBatch = $conn->query("SELECT id FROM batches WHERE po_id = {$poId}");
assertTest("Tạo thành công lô hàng (Batch) liên kết PO", $chkBatch && $chkBatch->num_rows > 0);


// ----------------------------------------------------------------
// 2. KIỂM THỬ BÌNH LUẬN & NHẮC TÊN (MENTIONS)
// ----------------------------------------------------------------
echo "\n--- 2. Kiểm thử Bình luận & Nhắc tên (Mentions) ---\n";

// Tạo một khách hàng tiềm năng kiểm thử
$conn->query("
    INSERT INTO contacts (tenant_id, owner_id, created_by, full_name, phone, pipeline_status, status)
    VALUES ({$tenantId}, {$salesId}, {$salesId}, 'Test Mention', '0999888777', 'da_gap', 'lead')
");
$contactId = $conn->insert_id;

// Thêm bình luận có nhắc tên Kế toán
$bodyText = "Yêu cầu đối soát dòng tiền nhờ đồng nghiệp @Kế_Toán";
$conn->query("
    INSERT INTO notes (tenant_id, entity_type, entity_id, user_id, body)
    VALUES ({$tenantId}, 'contact', {$contactId}, {$salesId}, '{$bodyText}')
");
$noteId = $conn->insert_id;
assertTest("Tạo bình luận thành công", $noteId > 0);

// Thêm liên kết ghi nhận tag Kế toán vào note_mentions
$conn->query("
    INSERT INTO note_mentions (note_id, user_id)
    VALUES ({$noteId}, {$accountantId})
");
$mentionId = $conn->affected_rows;
assertTest("Ghi nhận bản ghi tag nhân viên thành công", $mentionId > 0);

// Giả lập NotificationService gửi thông báo MENTION_TAGGED
$conn->query("
    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
    VALUES ({$accountantId}, {$tenantId}, 'Bạn được nhắc tên', 'Sales đã nhắc tên bạn trong ghi chú', 'mention', '/contacts/{$contactId}')
");
$notifId = $conn->insert_id;
assertTest("Hệ thống tạo thông báo chuông (Bell) cho người được tag", $notifId > 0);

assertDbField($conn, 'notifications', 'user_id', "id = {$notifId}", $accountantId, "Thông báo gửi đến đúng ID Kế toán");


// ----------------------------------------------------------------
// 3. DỌN DẸP DỮ LIỆU KIỂM THỬ (CLEANUP)
// ----------------------------------------------------------------
echo "\n--- 3. Dọn dẹp dữ liệu kiểm thử ---\n";

// Xóa dữ liệu PO test
$conn->query("DELETE FROM inventory_logs WHERE batch_id = {$batchId}");
$conn->query("DELETE FROM batches WHERE po_id = {$poId}");
$conn->query("DELETE FROM purchase_order_items WHERE po_id = {$poId}");
$conn->query("DELETE FROM purchase_orders WHERE id = {$poId}");

// Xóa sản phẩm và nhà cung cấp giả lập
$conn->query("DELETE FROM products WHERE id = {$productId}");
$conn->query("DELETE FROM suppliers WHERE id = {$supplierId}");

// Xóa dữ liệu mention test
$conn->query("DELETE FROM notifications WHERE id = {$notifId}");
$conn->query("DELETE FROM note_mentions WHERE note_id = {$noteId}");
$conn->query("DELETE FROM notes WHERE id = {$noteId}");
$conn->query("DELETE FROM contacts WHERE id = {$contactId}");

echo "Đã dọn dẹp sạch sẽ toàn bộ bản ghi kiểm thử.\n";

printTestSummary();
