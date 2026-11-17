<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$row = $pdo->query("SHOW CREATE TABLE raw_event_buffer")->fetch(PDO::FETCH_ASSOC);
echo $row['Create Table'] . "\n";
