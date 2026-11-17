<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$stmt = $pdo->query("SELECT (0 >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS res");
print_r($stmt->fetch(PDO::FETCH_ASSOC));
