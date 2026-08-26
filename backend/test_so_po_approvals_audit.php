<?php
// backend/test_so_po_approvals_audit.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 SYSTEM AUDIT: OPERATIONS, APPROVALS & SO/PO ORDERS\n";
echo "====================================================\n\n";

// 1. Audit Purchase Orders (PO) & Items Calculations
echo "--- 1. PURCHASE ORDERS (PO) DATA INTEGRITY & CALCULATIONS ---\n";
$stmtPO = $pdo->query("SELECT id, subtotal, tax, total, status FROM purchase_orders WHERE po_number NOT LIKE 'PO-TEST-%'");
$purchaseOrders = $stmtPO->fetchAll();
$totalPO = count($purchaseOrders);
echo "Total Purchase Orders found (excluding tests): {$totalPO}\n";

$orphanedPOItems = 0;
$mismatchedPOCalculations = 0;

// Scan PO Items for orphans (excluding test POs)
$stmtPOItems = $pdo->query("SELECT COUNT(*) FROM purchase_order_items WHERE po_id NOT IN (SELECT id FROM purchase_orders) AND po_id NOT IN (SELECT id FROM purchase_orders WHERE po_number LIKE 'PO-TEST-%')");
$orphanedPOItems = $stmtPOItems->fetchColumn();

// Verify calculations for each PO
foreach ($purchaseOrders as $po) {
    $poId = $po['id'];
    $stmtSum = $pdo->prepare("SELECT SUM(quantity * unit_cost) FROM purchase_order_items WHERE po_id = ?");
    $stmtSum->execute([$poId]);
    $itemsSum = (float)$stmtSum->fetchColumn();

    $expectedSubtotal = (float)$po['subtotal'];
    $tax = (float)$po['tax'];
    $expectedTotal = (float)$po['total'];

    // Check if items sum matches subtotal
    $isSubtotalMatch = (abs($itemsSum - $expectedSubtotal) < 0.01);
    // Check if grand total matches subtotal + tax
    $isTotalMatch = (abs(($expectedSubtotal + $tax) - $expectedTotal) < 0.01);

    if (!$isSubtotalMatch || !$isTotalMatch) {
        $mismatchedPOCalculations++;
        echo "⚠️ Mismatch in PO ID: {$poId} | Items Sum: {$itemsSum} | Subtotal: {$expectedSubtotal} | Grand Total: {$expectedTotal} (Calculated: " . ($expectedSubtotal + $tax) . ")\n";
    }
}

assertTest("Orphaned purchase order items in database", $orphanedPOItems === 0, "Count: {$orphanedPOItems}");
assertTest("Purchase orders with mismatched subtotal or grand total calculations", $mismatchedPOCalculations === 0, "Count: {$mismatchedPOCalculations}");


// 2. Audit Sales Orders (SO) & Items Calculations
echo "\n--- 2. SALES ORDERS (SO) DATA INTEGRITY & CALCULATIONS ---\n";
$stmtSO = $pdo->query("SELECT id, subtotal, discount, tax, total, status FROM sales_orders WHERE so_number NOT LIKE 'SO-TEST-%'");
$salesOrders = $stmtSO->fetchAll();
$totalSO = count($salesOrders);
echo "Total Sales Orders found (excluding tests): {$totalSO}\n";

$orphanedSOItems = 0;
$mismatchedSOCalculations = 0;

// Scan SO Items for orphans (excluding test SOs)
$stmtSOItems = $pdo->query("SELECT COUNT(*) FROM sales_order_items WHERE so_id NOT IN (SELECT id FROM sales_orders) AND so_id NOT IN (SELECT id FROM sales_orders WHERE so_number LIKE 'SO-TEST-%')");
$orphanedSOItems = $stmtSOItems->fetchColumn();

// Verify calculations for each SO
foreach ($salesOrders as $so) {
    $soId = $so['id'];
    $stmtSum = $pdo->prepare("SELECT SUM(subtotal) FROM sales_order_items WHERE so_id = ?");
    $stmtSum->execute([$soId]);
    $itemsSum = (float)$stmtSum->fetchColumn();

    $expectedSubtotal = (float)$so['subtotal'];
    $tax = (float)$so['tax'];
    $discount = (float)$so['discount'];
    $expectedTotal = (float)$so['total'];

    // Check if items sum matches subtotal
    $isSubtotalMatch = (abs($itemsSum - $expectedSubtotal) < 0.01);
    // Check if grand total matches subtotal + tax - discount
    $isTotalMatch = (abs(($expectedSubtotal + $tax - $discount) - $expectedTotal) < 0.01);

    if (!$isSubtotalMatch || !$isTotalMatch) {
        $mismatchedSOCalculations++;
        echo "⚠️ Mismatch in SO ID: {$soId} | Items Sum: {$itemsSum} | Subtotal: {$expectedSubtotal} | Grand Total: {$expectedTotal} (Calculated: " . ($expectedSubtotal + $tax - $discount) . ")\n";
    }
}

assertTest("Orphaned sales order items in database", $orphanedSOItems === 0, "Count: {$orphanedSOItems}");
assertTest("Sales orders with mismatched subtotal or grand total calculations", $mismatchedSOCalculations === 0, "Count: {$mismatchedSOCalculations}");


// 3. Audit Approvals & Process Workflows
echo "\n--- 3. APPROVALS & DECISION LOGS INTEGRITY ---\n";
$stmtPOApproval = $pdo->query("SELECT id, status, approver_id, approval_status, po_number FROM purchase_orders WHERE (status = 'received' OR status = 'cancelled') AND po_number NOT LIKE 'PO-TEST-%'");
$poApproved = $stmtPOApproval->fetchAll();
echo "Found " . count($poApproved) . " approved/cancelled purchase orders.\n";
$invalidPOApprovers = 0;
foreach ($poApproved as $po) {
    // If completed status but no approver ID is set
    if ($po['status'] === 'received' && empty($po['approver_id'])) {
        $invalidPOApprovers++;
        echo "⚠️ PO ID: {$po['id']} (PO Number: {$po['po_number']}) is received | approval_status: '{$po['approval_status']}' | approver_id: '{$po['approver_id']}'.\n";
    }
}
assertTest("Completed purchase orders have valid approver log", $invalidPOApprovers === 0, "Mismatched approver logs count: {$invalidPOApprovers}");

echo "\n";
printTestSummary();
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    exit($testStats['fail'] > 0 ? 1 : 0);
}
