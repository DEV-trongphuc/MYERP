<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$stmt = $pdo->query("SHOW FULL PROCESSLIST");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID: {$row['Id']} | User: {$row['User']} | Time: {$row['Time']} | State: {$row['State']} | Info: {$row['Info']}\n";
}
