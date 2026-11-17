<?php
require_once __DIR__ . '/helpers/TestDatabase.php';
require_once dirname(__DIR__, 2) . '/backend/automation/worker_flow.php';

use MYERP\Tests\E2E\Helpers\TestDatabase;

$pdo = TestDatabase::pdo();
$wsId = 99999;

$flowId = TestDatabase::uniqueId('flw_split_loop');
$subId = TestDatabase::uniqueId('sub_split_loop');

$circularSteps = [
    [
        'id' => 'split_step_1',
        'type' => 'split_test',
        'config' => ['ratioA' => 100],
        'pathAStepId' => 'split_step_2',
        'pathBStepId' => 'split_step_2'
    ],
    [
        'id' => 'split_step_2',
        'type' => 'split_test',
        'config' => ['ratioA' => 100],
        'pathAStepId' => 'split_step_1',
        'pathBStepId' => 'split_step_1'
    ]
];

TestDatabase::insertFixture('flows', [
    'id'           => $flowId,
    'name'         => 'Circular Split Flow',
    'status'       => 'active',
    'steps'        => json_encode($circularSteps),
    'config'       => json_encode(['frequency' => 'one-time']),
    'workspace_id' => $wsId
]);

TestDatabase::insertFixture('subscribers', [
    'id'                => $subId,
    'email'             => "split_{$subId}@ideas.edu.vn",
    'status'            => 'active',
    'workspace_id'      => $wsId
]);

TestDatabase::insertFixture('subscriber_flow_states', [
    'workspace_id'  => $wsId,
    'flow_id'       => $flowId,
    'subscriber_id' => $subId,
    'step_id'       => 'split_step_1',
    'status'        => 'waiting',
    'scheduled_at'  => date('Y-m-d H:i:s', time() - 10)
]);

$t0 = microtime(true);
$res = runWorkerFlow($pdo);
$dur = microtime(true) - $t0;

echo "Duration: " . round($dur, 4) . "s\n";
echo "Result Status: " . ($res['status'] ?? 'none') . "\n";
$logs = implode("\n", $res['logs'] ?? []);
echo "Log snippet: " . substr($logs, -300) . "\n";

$row = TestDatabase::fetchRow('subscriber_flow_states', ['flow_id' => $flowId, 'subscriber_id' => $subId]);
echo "MySQL State Row: " . json_encode($row) . "\n";
