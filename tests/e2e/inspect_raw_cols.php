<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$stmt = $pdo->query("SHOW COLUMNS FROM raw_event_buffer");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
