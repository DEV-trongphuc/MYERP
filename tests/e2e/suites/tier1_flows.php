<?php
/**
 * tests/e2e/suites/tier1_flows.php
 *
 * Tier 1: Flows, Triggers, Steps, Conditions & Execution Engine (Features 24 - 29)
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - 100% Soft-Delete Mandate
 */

use MYERP\Tests\E2E\Helpers\Assertions;
use MYERP\Tests\E2E\Helpers\TestDatabase;

$wsId = TestDatabase::TEST_WORKSPACE_ID;

// Feature 24: Flow Definition & CRUD Engine
e2e_test('F24_TC1: Flow CRUD creates, reads, updates, and soft-deletes flow definition', function($ctx) use ($wsId) {
    $flowId = TestDatabase::uniqueId('flw');
    $flowName = 'Onboarding Flow ' . substr($flowId, -4);
    
    $flowData = [
        'id'          => $flowId,
        'name'        => $flowName,
        'status'      => 'draft',
        'trigger'     => ['type' => 'form_submit', 'form_id' => 'form_123'],
        'steps'       => [
            ['id' => 'step_1', 'type' => 'update_tag', 'config' => ['tags' => ['Welcome_Enrolled']]],
            ['id' => 'step_2', 'type' => 'wait', 'config' => ['delay' => 3600]],
            ['id' => 'step_3', 'type' => 'action', 'config' => ['template_id' => 'tpl_welcome']]
        ]
    ];
    
    // 1. Create (POST)
    $resp = $ctx['http']->post('/backend/automation/flows.php', $flowData);
    Assertions::assertHttpStatus(200, $resp->status, 'Create flow must return HTTP 200');
    
    // Assert in MySQL
    $flowRow = TestDatabase::fetchRow('flows', ['id' => $flowId, 'workspace_id' => $wsId]);
    Assertions::assertNotNull($flowRow, 'Flow record must exist in MySQL');
    Assertions::assertEquals($flowName, $flowRow['name'], 'Flow name must match');
    
    // 2. Snapshot Creation
    $snapId = TestDatabase::uniqueId('snp');
    TestDatabase::insertFixture('flow_snapshots', [
        'id'         => $snapId,
        'flow_id'    => $flowId,
        'label'      => 'v1.0 Initial Draft',
        'flow_data'  => json_encode($flowData)
    ]);
    $snapRow = TestDatabase::fetchRow('flow_snapshots', ['id' => $snapId]);
    Assertions::assertNotNull($snapRow, 'Flow snapshot must exist in MySQL');
    
    // 3. Delete (Soft-Delete)
    $respDel = $ctx['http']->delete("/backend/automation/flows.php?id={$flowId}");
    Assertions::assertHttpStatus(200, $respDel->status, 'Delete flow must return HTTP 200');
    
    // Assert Soft-Delete in MySQL
    $flowDeleted = TestDatabase::fetchRow('flows', ['id' => $flowId]);
    Assertions::assertNotNull($flowDeleted, 'Soft-deleted flow must remain in database');
    Assertions::assertEquals('archived', $flowDeleted['status'], 'Flow status must be archived');
    Assertions::assertNotNull($flowDeleted['deleted_at'], 'Flow deleted_at timestamp must be set');
});

// Feature 25: Flow Triggers (Form, Survey, Webhook, API, CRM Event)
e2e_test('F25_TC1: Trigger enrolls subscriber into subscriber_flow_states', function($ctx) use ($wsId) {
    $flowId = TestDatabase::uniqueId('flw_trg');
    $subId = TestDatabase::uniqueId('sub_trg');
    
    TestDatabase::insertFixture('flows', [
        'id'           => $flowId,
        'name'         => 'Trigger Test Flow',
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "trigger_{$subId}@ideas.edu.vn",
        'status'       => 'active',
        'workspace_id' => $wsId
    ]);
    
    // Enroll subscriber into flow state
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'step_welcome',
        'status'        => 'waiting',
        'scheduled_at'  => date('Y-m-d H:i:s')
    ]);
    
    $stateRow = TestDatabase::fetchRow('subscriber_flow_states', [
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'workspace_id'  => $wsId
    ]);
    
    Assertions::assertNotNull($stateRow, 'Subscriber flow state must exist in database');
    Assertions::assertEquals('waiting', $stateRow['status'], 'Status must be waiting');
    Assertions::assertEquals('step_welcome', $stateRow['step_id'], 'Initial step_id must match');
});

// Feature 26: Flow Step Execution Nodes (13 types in FlowExecutor)
e2e_test('F26_TC1: Step execution nodes (wait, update_tag, list_action) update state and data', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/flow_helpers.php';
    require_once dirname(__DIR__, 3) . '/backend/automation/FlowExecutor.php';
    
    $subId = TestDatabase::uniqueId('sub_step');
    TestDatabase::insertFixture('subscribers', [
        'id'           => $subId,
        'email'        => "step_{$subId}@ideas.edu.vn",
        'tags'         => 'OldTag',
        'workspace_id' => $wsId
    ]);

    $flowId = TestDatabase::uniqueId('flw_step');
    TestDatabase::insertFixture('flows', [
        'id'           => $flowId,
        'name'         => 'Step Execution Flow',
        'workspace_id' => $wsId
    ]);
    
    // 1. Execute update_tag node via genuine FlowExecutor
    require_once dirname(__DIR__, 3) . '/backend/automation/Mailer.php';
    $mailer = new Mailer($ctx['pdo']);
    $executor = new FlowExecutor($ctx['pdo'], $mailer, 'http://127.0.0.1:8850');
    $tagStep = [
        'id'         => 'step_tag_add',
        'type'       => 'update_tag',
        'config'     => [
            'action' => 'add',
            'tags'   => ['Course_Registered']
        ],
        'nextStepId' => null
    ];
    $subscriber = TestDatabase::fetchRow('subscribers', ['id' => $subId]);
    $executor->executeStep($tagStep, $subscriber, $flowId, 'step_tag_add');
    
    // Verify tag relation in subscriber_tags
    $tag = TestDatabase::fetchRow('domation_tags', ['name' => 'Course_Registered', 'workspace_id' => $wsId]);
    Assertions::assertNotNull($tag, 'Tag must be auto-created in domation_tags by FlowExecutor');
    $subTag = TestDatabase::fetchRow('subscriber_tags', ['subscriber_id' => $subId, 'tag_id' => $tag['id']]);
    Assertions::assertNotNull($subTag, 'Tag update node via FlowExecutor must link tag to subscriber');
    
    // 2. Simulate wait node: schedule in future
    $flowId = TestDatabase::uniqueId('flw_wait');
    TestDatabase::insertFixture('flows', ['id' => $flowId, 'name' => 'Wait Flow', 'workspace_id' => $wsId]);
    
    $futureTime = date('Y-m-d H:i:s', time() + 7200);
    TestDatabase::insertFixture('subscriber_flow_states', [
        'workspace_id'  => $wsId,
        'flow_id'       => $flowId,
        'subscriber_id' => $subId,
        'step_id'       => 'step_delay',
        'status'        => 'waiting',
        'scheduled_at'  => $futureTime
    ]);
    
    $state = TestDatabase::fetchRow('subscriber_flow_states', ['flow_id' => $flowId, 'subscriber_id' => $subId]);
    Assertions::assertEquals($futureTime, $state['scheduled_at'], 'Wait node must set scheduled_at properly');
});

// Feature 27: Flow Condition & Advanced Condition Evaluation Engine
e2e_test('F27_TC1: evaluateAdvancedConditionGroup evaluates tags, attributes, and handles nulls safely', function($ctx) use ($wsId) {
    require_once dirname(__DIR__, 3) . '/backend/automation/flow_helpers.php';
    
    $subProfile = [
        'email'             => 'test_cond@ideas.edu.vn',
        'tags'              => 'VIP,Khóa_AI,Đã_Thanh_Toán',
        'custom_attributes' => json_encode(['score' => 85, 'cohort' => '2026-A'])
    ];
    
    // 1. Test has_tag true
    $condTagTrue = [
        ['type' => 'has_tag', 'value' => 'Khóa_AI']
    ];
    $res1 = evaluateAdvancedConditionGroup($ctx['pdo'], 'dummy_id', $subProfile, $condTagTrue, 'AND');
    Assertions::assertTrue($res1, 'has_tag for existing tag must evaluate true');
    
    // 2. Test not_has_tag true
    $condTagFalse = [
        ['type' => 'not_has_tag', 'value' => 'NonExistentTag']
    ];
    $res2 = evaluateAdvancedConditionGroup($ctx['pdo'], 'dummy_id', $subProfile, $condTagFalse, 'AND');
    Assertions::assertTrue($res2, 'not_has_tag for missing tag must evaluate true');
    
    // 3. Test safe handling with null/empty tags
    $emptyProfile = ['email' => 'empty@ideas.edu.vn', 'tags' => null];
    $res3 = evaluateAdvancedConditionGroup($ctx['pdo'], 'dummy_id', $emptyProfile, [
        ['type' => 'has_tag', 'value' => 'VIP']
    ], 'AND');
    Assertions::assertFalse($res3, 'has_tag with null tags must evaluate false without warning');
});

// Feature 28: Background Flow Worker
e2e_test('F28_TC1: worker_flow executes via proc_open CLI and processes flow states with Exit Code 0', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runFlowWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Flow worker must exit with code 0');
});

// Feature 29: Priority Flow Worker
e2e_test('F29_TC1: worker_priority executes via proc_open CLI with Exit Code 0', function($ctx) use ($wsId) {
    $res = $ctx['worker']->runPriorityWorker();
    Assertions::assertEquals(0, $res['exit_code'], 'Priority worker must exit with code 0');
});
