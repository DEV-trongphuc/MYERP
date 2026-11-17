<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$cols = $pdo->query("DESCRIBE campaigns")->fetchAll(PDO::FETCH_COLUMN);
echo implode(', ', $cols) . "\n";
