<?php
// backend/test_list_tables.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== DATABASE TABLES DIAGNOSTIC ===\n\n";

$res = $conn->query("SHOW TABLES");
while ($row = $res->fetch_row()) {
    $tableName = $row[0];
    $countRes = $conn->query("SELECT COUNT(*) FROM `$tableName`");
    $count = $countRes ? $countRes->fetch_row()[0] : 'N/A';
    echo "Table: $tableName | Rows: $count\n";
}
