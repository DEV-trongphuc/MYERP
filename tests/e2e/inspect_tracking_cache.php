<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$stmt = $pdo->query("SHOW CREATE TABLE tracking_unique_cache");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo $row['Create Table'] ?? 'Not found';
echo "\n\n";
$stmt2 = $pdo->query("SHOW INDEX FROM tracking_unique_cache");
while ($idx = $stmt2->fetch(PDO::FETCH_ASSOC)) {
    echo "Index: {$idx['Key_name']} | Unique: {$idx['Non_unique']} | Column: {$idx['Column_name']} | Seq: {$idx['Seq_in_index']}\n";
}
