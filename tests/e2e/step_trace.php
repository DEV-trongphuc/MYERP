<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
require_once dirname(__DIR__, 2) . '/backend/automation/tracking_processor.php';

use MYERP\Tests\E2E\Helpers\TestDatabase;

$pdo = TestDatabase::pdo();
$wsId = 99999;
$campId = TestDatabase::uniqueId('cmp_step3');
$subId = TestDatabase::uniqueId('sub_step3');

TestDatabase::insertFixture('campaigns', [
    'id'                   => $campId,
    'name'                 => 'Step Test Campaign 3',
    'workspace_id'         => $wsId,
    'count_sent'           => 1,
    'count_opened'         => 0,
    'count_unique_opened'  => 0,
    'status'               => 'sent'
]);

$payload = [
    'type'          => 'open_email',
    'subscriber_id' => $subId,
    'reference_id'  => null,
    'flow_id'       => null,
    'campaign_id'   => $campId,
    'extra_data'    => ['url' => 'https://ideas.edu.vn'],
    'workspace_id'  => $wsId
];

processTrackingEvent($pdo, 'stat_update', $payload);

$stmt = $pdo->prepare(
    "SELECT id, workspace_id, target_table, target_id, column_name, increment
     FROM stats_update_buffer
     WHERE processed = 0 AND batch_id IS NULL AND target_id = ?
     ORDER BY id ASC"
);
$stmt->execute([$campId]);
$rows = $stmt->fetchAll();

echo "Rows fetched from buffer: " . count($rows) . "\n";
foreach ($rows as $r) {
    echo "Updating: {$r['target_table']} . {$r['column_name']} on {$r['target_id']} with {$r['increment']}\n";
    try {
        $up = $pdo->prepare("UPDATE {$r['target_table']} SET {$r['column_name']} = COALESCE({$r['column_name']}, 0) + ? WHERE id = ?");
        $up->execute([$r['increment'], $r['target_id']]);
        echo "  -> RowCount: " . $up->rowCount() . "\n";
    } catch (\Throwable $e) {
        echo "  -> Error: " . $e->getMessage() . "\n";
    }
}

$camp = TestDatabase::fetchRow('campaigns', ['id' => $campId]);
echo "Camp after manual sync: count_opened={$camp['count_opened']}, count_unique_opened={$camp['count_unique_opened']}\n";
