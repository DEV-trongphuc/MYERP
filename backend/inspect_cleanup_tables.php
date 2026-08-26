<?php
// backend/inspect_cleanup_tables.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== CHI TIẾT TỔNG KHO VÀ ACTIVITIES ===\n\n";

$actTypes = $pdo->query("SELECT type, COUNT(*) as count FROM activities GROUP BY type")->fetchAll(PDO::FETCH_ASSOC);
echo "--- BREAKDOWN ACTIVITIES ---\n";
foreach ($actTypes as $a) {
    echo " - Type '{$a['type']}': {$a['count']} records\n";
}

echo "\n--- INVOICES COUNT ---\n";
$invCount = $pdo->query("SELECT COUNT(*) FROM invoices")->fetchColumn();
echo " - Invoices: {$invCount}\n";

echo "\n--- DEPOSITS & MILESTONES COUNT ---\n";
$depCount = $pdo->query("SELECT COUNT(*) FROM deposits")->fetchColumn();
$msCount = $pdo->query("SELECT COUNT(*) FROM deposit_milestones")->fetchColumn();
echo " - Deposits: {$depCount} | Milestones: {$msCount}\n";

echo "\n--- PURCHASE ORDERS COUNT ---\n";
$poCount = $pdo->query("SELECT COUNT(*) FROM purchase_orders")->fetchColumn();
$poiCount = $pdo->query("SELECT COUNT(*) FROM purchase_order_items")->fetchColumn();
echo " - POs: {$poCount} | PO Items: {$poiCount}\n";

echo "\n--- TICKETS & FEED COUNT ---\n";
$tickCount = $pdo->query("SELECT COUNT(*) FROM tickets")->fetchColumn();
$feedCount = $pdo->query("SELECT COUNT(*) FROM enterprise_posts")->fetchColumn();
echo " - Tickets: {$tickCount} | Feed posts: {$feedCount}\n";

echo "\n--- NOTIFICATIONS COUNT ---\n";
$notifCount = $pdo->query("SELECT COUNT(*) FROM notifications")->fetchColumn();
echo " - Notifications: {$notifCount}\n";

echo "\n--- LEAVE & APPROVAL REQUESTS COUNT ---\n";
$leaveCount = $pdo->query("SELECT COUNT(*) FROM hrm_leave_requests")->fetchColumn();
echo " - Leave Requests: {$leaveCount}\n";
