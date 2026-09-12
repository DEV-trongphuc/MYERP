<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    $db->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Check columns of purchase_orders vs backup
    $curPoCols = $db->query("SHOW COLUMNS FROM purchase_orders")->fetchAll(PDO::FETCH_COLUMN);
    $bakPoCols = $db->query("SHOW COLUMNS FROM `_bak_purchase_orders_20260819_103521`")->fetchAll(PDO::FETCH_COLUMN);

    $commonPoCols = array_intersect($curPoCols, $bakPoCols);
    $colList = implode('`, `', $commonPoCols);

    $db->exec("INSERT INTO purchase_orders (`$colList`) SELECT `$colList` FROM `_bak_purchase_orders_20260819_103521`");
    echo "Restored PO: " . $db->query("SELECT count(*) FROM purchase_orders")->fetchColumn() . " rows\n";

    $curItemCols = $db->query("SHOW COLUMNS FROM purchase_order_items")->fetchAll(PDO::FETCH_COLUMN);
    $bakItemCols = $db->query("SHOW COLUMNS FROM `_bak_purchase_order_items_20260819_103521`")->fetchAll(PDO::FETCH_COLUMN);
    $commonItemCols = array_intersect($curItemCols, $bakItemCols);
    $itemColList = implode('`, `', $commonItemCols);
    $db->exec("INSERT INTO purchase_order_items (`$itemColList`) SELECT `$itemColList` FROM `_bak_purchase_order_items_20260819_103521`");
    echo "Restored PO items: " . $db->query("SELECT count(*) FROM purchase_order_items")->fetchColumn() . " rows\n";

    $curDepCols = $db->query("SHOW COLUMNS FROM deposits")->fetchAll(PDO::FETCH_COLUMN);
    $bakDepCols = $db->query("SHOW COLUMNS FROM `_bak_deposits_20260819_103521`")->fetchAll(PDO::FETCH_COLUMN);
    $commonDepCols = array_intersect($curDepCols, $bakDepCols);
    $depColList = implode('`, `', $commonDepCols);
    $db->exec("INSERT INTO deposits (`$depColList`) SELECT `$depColList` FROM `_bak_deposits_20260819_103521`");
    echo "Restored Deposits: " . $db->query("SELECT count(*) FROM deposits")->fetchColumn() . " rows\n";

    $curMileCols = $db->query("SHOW COLUMNS FROM deposit_milestones")->fetchAll(PDO::FETCH_COLUMN);
    $bakMileCols = $db->query("SHOW COLUMNS FROM `_bak_deposit_milestones_20260819_103521`")->fetchAll(PDO::FETCH_COLUMN);
    $commonMileCols = array_intersect($curMileCols, $bakMileCols);
    $mileColList = implode('`, `', $commonMileCols);
    $db->exec("INSERT INTO deposit_milestones (`$mileColList`) SELECT `$mileColList` FROM `_bak_deposit_milestones_20260819_103521`");
    echo "Restored Deposit milestones: " . $db->query("SELECT count(*) FROM deposit_milestones")->fetchColumn() . " rows\n";

    $db->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "SUCCESS!\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " on line " . $e->getLine() . "\n";
}
