<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$cnt = $pdo->query("SELECT COUNT(*) FROM stats_update_buffer WHERE processed = 0 AND batch_id IS NULL")->fetchColumn();
echo "Unprocessed count in stats_update_buffer: {$cnt}\n";
