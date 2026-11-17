<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
require_once dirname(__DIR__, 2) . '/backend/automation/tracking_processor.php';
require_once dirname(__DIR__, 2) . '/backend/automation/worker_tracking_aggregator.php';

use MYERP\Tests\E2E\Helpers\TestDatabase;

$pdo = TestDatabase::pdo();
$wsId = 99999;
$campId = TestDatabase::uniqueId('cmp_trace');
$subId = TestDatabase::uniqueId('sub_trace');

TestDatabase::insertFixture('campaigns', [
    'id'                   => $campId,
    'name'                 => 'Trace Campaign',
    'workspace_id'         => $wsId,
    'count_sent'           => 1,
    'count_opened'         => 0,
    'count_unique_opened'  => 0,
    'status'               => 'sent'
]);

$eventData = [
    'subscriber_id' => $subId,
    'campaign_id'   => $campId,
    'workspace_id'  => $wsId,
    'extra_data'    => ['url' => 'https://ideas.edu.vn']
];

echo "Processing Event 1...\n";
processTrackingEvent($pdo, 'open_email', $eventData);

$buff = $pdo->query("SELECT * FROM stats_update_buffer WHERE target_id = '{$campId}'")->fetchAll(PDO::FETCH_ASSOC);
echo "Buffered rows: " . count($buff) . "\n";
foreach ($buff as $b) {
    echo "  -> Col: {$b['column_name']} | Inc: {$b['increment']}\n";
}

echo "Calling syncStatsBuffer...\n";
syncStatsBuffer($pdo);

$camp = TestDatabase::fetchRow('campaigns', ['id' => $campId]);
echo "Camp after sync: count_opened={$camp['count_opened']}, count_unique_opened={$camp['count_unique_opened']}\n";
