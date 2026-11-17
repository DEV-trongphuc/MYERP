<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
$pdo = MYERP\Tests\E2E\Helpers\TestDatabase::pdo();
$camp = $pdo->query("SELECT id, count_sent, count_opened, count_unique_opened FROM campaigns WHERE id LIKE 'cmp_dup%' ORDER BY created_at DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
echo "Camp: " . json_encode($camp) . PHP_EOL;

$buff = $pdo->query("SELECT * FROM stats_update_buffer WHERE target_id = '" . ($camp['id'] ?? '') . "'")->fetchAll(PDO::FETCH_ASSOC);
echo "Stats buffer count: " . count($buff) . PHP_EOL;
echo "Stats buffer: " . json_encode($buff) . PHP_EOL;

$raw = $pdo->query("SELECT id, type, payload, processed FROM raw_event_buffer WHERE payload LIKE '%" . ($camp['id'] ?? '') . "%'")->fetchAll(PDO::FETCH_ASSOC);
echo "Raw events count: " . count($raw) . PHP_EOL;
echo "Raw events: " . json_encode($raw) . PHP_EOL;
