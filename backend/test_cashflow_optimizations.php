<?php
// backend/test_cashflow_optimizations.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/FinanceController.php';
require_once __DIR__ . '/controllers/SalesOrderController.php';
require_once __DIR__ . '/controllers/PurchaseOrderController.php';

// Prepare mock auth context
$auth = [
    'tenant_id' => 1,
    'user_id' => 1,
    'role' => 'admin',
    'full_name' => 'Test Admin',
    'email' => 'admin@ideas.edu.vn'
];

echo "====================================================\n";
echo "🧪 RUNNING V2 CASHFLOW OPTIMIZATION TESTS (SIMPLE MODE)\n";
echo "====================================================\n\n";

// Test 1: Expenses simple mode
try {
    $_GET = [
        'limit' => 5000,
        'status' => 'pending',
        'simple' => '1'
    ];
    $financeCtrl = new FinanceController($pdo);
    
    ob_start();
    try {
        $financeCtrl->listExpenses($auth);
    } catch (Throwable $e) {}
    $respJson = ob_get_clean();
    
    $resp = json_decode($respJson, true);
    assertTest("Query expenses?status=pending&limit=5000&simple=1 responds", !empty($resp), "Response: " . substr($respJson, 0, 150));
    if ($resp) {
        assertTest("Response success field is true", isset($resp['success']) && $resp['success'] === true);
        $data = $resp['data'] ?? [];
        $items = $data['items'] ?? [];
        assertTest("Response contains items key", isset($data['items']));
        assertTest("Response items are array", is_array($items));
        if (count($items) > 0) {
            $first = $items[0];
            assertTest("Item contains id", isset($first['id']));
            assertTest("Item contains amount", isset($first['amount']));
            assertTest("Item contains date", isset($first['date']));
            assertTest("Item does NOT contain creator_name", !isset($first['creator_name']));
            assertTest("Item does NOT contain entities", !isset($first['entities']));
        }
    }
} catch (Throwable $t) {
    assertTest("FinanceController run exception", false, $t->getMessage());
}

// Test 2: SalesOrder simple mode
try {
    $_GET = [
        'limit' => 5000,
        'payment_status' => 'unpaid',
        'exclude_status' => 'cancelled',
        'simple' => '1'
    ];
    $soCtrl = new SalesOrderController();
    
    ob_start();
    try {
        $soCtrl->index($auth);
    } catch (Throwable $e) {}
    $respJson = ob_get_clean();
    
    $resp = json_decode($respJson, true);
    assertTest("Query sales-orders?simple=1 responds", !empty($resp), "Response: " . substr($respJson, 0, 150));
    if ($resp) {
        assertTest("Response success field is true", isset($resp['success']) && $resp['success'] === true);
        $data = $resp['data'] ?? [];
        $orders = $data['orders'] ?? [];
        assertTest("Response contains orders key", isset($data['orders']));
        if (count($orders) > 0) {
            $first = $orders[0];
            assertTest("SO contains id", isset($first['id']));
            assertTest("SO contains total", isset($first['total']));
            assertTest("SO contains order_date", isset($first['order_date']));
            assertTest("SO does NOT contain items", !isset($first['items']));
        }
    }
} catch (Throwable $t) {
    assertTest("SalesOrderController run exception", false, $t->getMessage());
}

// Test 3: PurchaseOrder simple mode
try {
    $_GET = [
        'payment_status' => 'unpaid',
        'simple' => '1'
    ];
    $poCtrl = new PurchaseOrderController($pdo);
    
    ob_start();
    try {
        $poCtrl->index($auth);
    } catch (Throwable $e) {}
    $respJson = ob_get_clean();
    
    $resp = json_decode($respJson, true);
    assertTest("Query purchase-orders?simple=1 responds", !empty($resp), "Response: " . substr($respJson, 0, 150));
    if ($resp) {
        assertTest("Response success field is true", isset($resp['success']) && $resp['success'] === true);
        $orders = $resp['data'] ?? [];
        assertTest("Response data is array", is_array($orders));
        if (count($orders) > 0) {
            $first = $orders[0];
            assertTest("PO contains id", isset($first['id']));
            assertTest("PO contains total", isset($first['total']));
            assertTest("PO does NOT contain items", !isset($first['items']));
        }
    }
} catch (Throwable $t) {
    assertTest("PurchaseOrderController run exception", false, $t->getMessage());
}

printTestSummary();
