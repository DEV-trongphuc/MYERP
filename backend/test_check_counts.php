<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();
$db->beginTransaction();
try {
    // Check deposits restore
    $depCount = $db->query("SELECT count(*) FROM `_bak_deposits_20260819_103521`")->fetchColumn();
    $poCount = $db->query("SELECT count(*) FROM `_bak_purchase_orders_20260819_103521`")->fetchColumn();
    $poItemCount = $db->query("SELECT count(*) FROM `_bak_purchase_order_items_20260819_103521`")->fetchColumn();
    $depMileCount = $db->query("SELECT count(*) FROM `_bak_deposit_milestones_20260819_103521`")->fetchColumn();

    echo "Bak counts: deposits=$depCount, milestones=$depMileCount, PO=$poCount, items=$poItemCount\n";
    $db->rollBack();
} catch (Exception $e) {
    $db->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}
