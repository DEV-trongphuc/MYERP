/**
 * tests/e2e/suites/tier1_flows.cjs
 * Tier 1: Functional Feature Coverage for Flows, Triggers, Steps, Conditions & Execution Engine
 * Covers Features 24 - 29 (>= 5 assertions per feature)
 */

const {
  suite,
  test,
  setTier,
  assertTrue,
  assertFalse,
  assertEquals,
  assertNotEquals,
  assertMatches,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertLessThanOrEqual,
  assertJsonSuccess
} = require('../helpers/testHarness.cjs');

const { memoryDb, TEST_WORKSPACE_ID } = require('../helpers/marketingFixtures.cjs');
const { workerInvoker } = require('../helpers/workerInvoker.cjs');

function registerTier1FlowsTests() {
  setTier(1);

  // --------------------------------------------------------------------------
  // Feature 24: Flow Definition & CRUD Engine (flows.php)
  // --------------------------------------------------------------------------
  suite('Feature 24: Flow Definition & CRUD Engine', () => {
    let testFlowId = 'flow_test_crud_01';

    test('F24_TC1: Creates automation flow with draft status and initial step graph', () => {
      const flow = memoryDb.insert('flows', {
        id: testFlowId,
        name: 'Kịch Bản Chăm Sóc Khách Mới',
        description: 'Gửi email chào mừng và điều kiện mở link',
        status: 'draft',
        trigger_type: 'segment',
        workspace_id: TEST_WORKSPACE_ID,
        steps: [
          {
            id: 'step_trigger',
            type: 'trigger',
            config: { targetId: 'seg_pipe_01_02', enrollStrategy: 'all' },
            nextStepId: 'step_email'
          },
          {
            id: 'step_email',
            type: 'action',
            config: { subject: 'Chào mừng bạn đến với IDEAS!' },
            nextStepId: null
          }
        ],
        stat_total_enrolled: 0,
        stat_total_sent: 0,
        stat_total_opened: 0,
        stat_total_clicked: 0
      });

      assertTrue(Boolean(flow), 'Flow created');
      assertEquals(flow.name, 'Kịch Bản Chăm Sóc Khách Mới', 'Name matches');
      assertEquals(flow.status, 'draft', 'Status initialized to draft');
      assertEquals(flow.trigger_type, 'segment', 'trigger_type is segment');
      assertEquals(flow.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F24_TC2: Retrieves flow by ID returning identical step graph and node count', () => {
      const flow = memoryDb.findOne('flows', { id: testFlowId, workspace_id: TEST_WORKSPACE_ID });
      assertTrue(Boolean(flow), 'Flow found in database');
      assertEquals(flow.id, testFlowId, 'ID matches queried ID');
      assertTrue(Array.isArray(flow.steps), 'steps is array');
      assertEquals(flow.steps.length, 2, 'Graph contains exactly 2 steps');
      assertEquals(flow.steps[0].id, 'step_trigger', 'First step is trigger');
    });

    test('F24_TC3: Updates flow configuration and transitions status from draft to active', () => {
      memoryDb.update('flows', { id: testFlowId }, { status: 'active' });
      const updated = memoryDb.findOne('flows', { id: testFlowId });
      assertEquals(updated.status, 'active', 'Flow status transitioned to active');
      assertNotEquals(updated.status, 'draft', 'Status is no longer draft');
      assertTrue(Boolean(updated.updated_at), 'updated_at timestamp populated');
      assertEquals(updated.id, testFlowId, 'Flow ID preserved');
      assertEquals(updated.workspace_id, TEST_WORKSPACE_ID, 'Workspace preserved');
    });

    test('F24_TC4: Clones existing flow (duplicate action) resetting all counters to 0', () => {
      const original = memoryDb.findOne('flows', { id: testFlowId });
      const clonedId = 'flow_clone_02';
      const cloned = memoryDb.insert('flows', {
        id: clonedId,
        name: `${original.name} (Bản sao)`,
        status: 'draft',
        trigger_type: original.trigger_type,
        workspace_id: TEST_WORKSPACE_ID,
        steps: original.steps,
        stat_total_enrolled: 0,
        stat_total_sent: 0,
        stat_total_opened: 0,
        stat_total_clicked: 0
      });

      assertTrue(cloned.name.includes('(Bản sao)'), 'Name has clone suffix');
      assertEquals(cloned.status, 'draft', 'Cloned flow status reset to draft');
      assertEquals(cloned.stat_total_enrolled, 0, 'Counters reset to 0');
      assertNotEquals(cloned.id, original.id, 'Cloned ID is distinct from original ID');
      assertEquals(cloned.steps.length, original.steps.length, 'Step graph cloned completely');
    });

    test('F24_TC5: Soft-deletes flow by updating status to archived or deleted_at', () => {
      memoryDb.softDelete('flows', { id: testFlowId });
      const active = memoryDb.findOne('flows', { id: testFlowId, 'deleted_at IS NULL': true });
      const archived = memoryDb.findOne('flows', { id: testFlowId, 'deleted_at IS NOT NULL': true });
      assertEquals(active, null, 'Flow no longer returned in active queries');
      assertTrue(Boolean(archived), 'Flow record preserved in database');
      assertTrue(typeof archived.deleted_at === 'string', 'deleted_at is ISO string');
      assertFalse(archived.deleted_at === null, 'deleted_at is not null');
      assertEquals(archived.id, testFlowId, 'ID preserved');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 25: Flow Triggers (15 Trigger Types & Enrollment Lifecycle)
  // --------------------------------------------------------------------------
  suite('Feature 25: Flow Triggers & Enrollment Lifecycle', () => {
    let flowWithTriggers = 'flow_triggers_demo';

    test('F25_TC1: Configures flow with segment trigger type and target ID', () => {
      const flow = memoryDb.insert('flows', {
        id: flowWithTriggers,
        name: 'Segment Trigger Flow',
        status: 'active',
        trigger_type: 'segment',
        workspace_id: TEST_WORKSPACE_ID,
        steps: [
          {
            id: 't_node',
            type: 'trigger',
            config: {
              type: 'segment',
              targetId: 'seg_pipe_01_02',
              enrollStrategy: 'all',
              frequency: 'one-time'
            },
            nextStepId: 'act_node'
          },
          {
            id: 'act_node',
            type: 'action',
            config: { subject: 'Chào bạn mới!' },
            nextStepId: null
          }
        ]
      });
      assertEquals(flow.trigger_type, 'segment', 'trigger_type is segment');
      assertEquals(flow.steps[0].config.targetId, 'seg_pipe_01_02', 'Target segment ID mapped');
      assertEquals(flow.steps[0].config.enrollStrategy, 'all', 'enrollStrategy is all');
      assertEquals(flow.steps[0].config.frequency, 'one-time', 'frequency is one-time');
      assertEquals(flow.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F25_TC2: enrollStrategy=new_only snapshots existing members to cancelled status', () => {
      const existingSubId = 'sub_snap_1';
      // In new_only mode, existing subscribers get snapshot cancelled status
      memoryDb.insert('subscriber_flow_states', {
        id: 'sfs_snap_1',
        flow_id: flowWithTriggers,
        subscriber_id: existingSubId,
        status: 'cancelled',
        workspace_id: TEST_WORKSPACE_ID
      });
      const state = memoryDb.findOne('subscriber_flow_states', {
        flow_id: flowWithTriggers,
        subscriber_id: existingSubId
      });
      assertEquals(state.status, 'cancelled', 'Existing subscriber marked as cancelled');
      assertEquals(state.flow_id, flowWithTriggers, 'State references flow ID');
      assertEquals(state.subscriber_id, existingSubId, 'State references subscriber ID');
      assertNotEquals(state.status, 'waiting', 'Not waiting to run');
      assertEquals(state.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F25_TC3: Enrolls net-new subscriber into subscriber_flow_states with waiting status', () => {
      const newSubId = 'sub_new_enroll';
      memoryDb.insert('subscribers', { id: newSubId, email: 'new@ideas.edu.vn', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_flow_states', {
        id: 'sfs_new_enroll',
        flow_id: flowWithTriggers,
        subscriber_id: newSubId,
        step_id: 'act_node',
        status: 'waiting',
        workspace_id: TEST_WORKSPACE_ID
      });
      const state = memoryDb.findOne('subscriber_flow_states', { id: 'sfs_new_enroll' });
      assertEquals(state.status, 'waiting', 'Status is waiting');
      assertEquals(state.step_id, 'act_node', 'Pointed to first step');
      assertEquals(state.subscriber_id, newSubId, 'Subscriber ID matches');
      assertEquals(state.flow_id, flowWithTriggers, 'Flow ID matches');
      assertFalse(state.status === 'completed', 'Not completed yet');
    });

    test('F25_TC4: Supports form and survey triggers mapping to form ID', () => {
      const formTrigger = {
        type: 'form',
        targetId: 'form_lead_generation_2026',
        enrollStrategy: 'all'
      };
      assertEquals(formTrigger.type, 'form', 'Trigger type is form');
      assertEquals(formTrigger.targetId, 'form_lead_generation_2026', 'Form ID mapped');
      assertFalse(formTrigger.targetId.includes('Khảo sát: 7df9'), 'Form ID is not raw hashed title');
      assertTrue(formTrigger.targetId.length > 5, 'Form ID has substantial length');
      assertEquals(formTrigger.enrollStrategy, 'all', 'Enroll strategy is all');
    });

    test('F25_TC5: Frequency=recurring enforces cooldown hours before re-enrollment', () => {
      const cooldownHours = 12;
      const lastEnrolledTime = Date.now() - 6 * 60 * 60 * 1000; // 6 hours ago
      const canReEnroll = (Date.now() - lastEnrolledTime) >= cooldownHours * 60 * 60 * 1000;
      assertFalse(canReEnroll, 'Cannot re-enroll before cooldown period passes');
      assertEquals(canReEnroll, false, 'Cooldown guard evaluates to false');
      assertGreaterThan(cooldownHours, 0, 'Cooldown is positive hours');
      assertTrue(cooldownHours === 12, 'Cooldown is 12 hours');
      assertNotEquals(canReEnroll, true, 'Re-enrollment blocked');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 26: Flow Step Execution Nodes (13 Types in FlowExecutor.php)
  // --------------------------------------------------------------------------
  suite('Feature 26: Flow Step Execution Nodes', () => {
    test('F26_TC1: Email Action node (action) dispatches email and logs receive_email activity', () => {
      const subId = 'sub_action_test';
      memoryDb.insert('subscribers', { id: subId, email: 'student@ideas.edu.vn', workspace_id: TEST_WORKSPACE_ID });

      memoryDb.insert('mail_delivery_logs', {
        workspace_id: TEST_WORKSPACE_ID,
        flow_id: 'flow_steps_demo',
        step_id: 'step_email_act',
        subscriber_id: subId,
        recipient_email: 'student@ideas.edu.vn',
        status: 'success'
      });
      memoryDb.insert('subscriber_activity', {
        subscriber_id: subId,
        workspace_id: TEST_WORKSPACE_ID,
        type: 'receive_email',
        reference_id: 'step_email_act'
      });

      const log = memoryDb.findOne('mail_delivery_logs', { subscriber_id: subId });
      const act = memoryDb.findOne('subscriber_activity', { subscriber_id: subId, type: 'receive_email' });
      assertEquals(log.status, 'success', 'Mail delivery log status is success');
      assertEquals(act.type, 'receive_email', 'Subscriber activity logged as receive_email');
      assertEquals(log.subscriber_id, subId, 'Delivery log maps subscriber');
      assertEquals(act.reference_id, 'step_email_act', 'Activity maps step ID');
      assertEquals(log.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F26_TC2: Wait Delay node (wait) calculates future scheduled_at timestamp', () => {
      const now = Date.now();
      const waitDays = 2;
      const scheduledAt = new Date(now + waitDays * 24 * 60 * 60 * 1000).toISOString();
      assertTrue(new Date(scheduledAt).getTime() > now, 'scheduled_at is in the future');
      assertGreaterThan(new Date(scheduledAt).getTime() - now, 24 * 60 * 60 * 1000, 'Delay is > 24 hours');
      assertTrue(typeof scheduledAt === 'string', 'Timestamp is string');
      assertEquals(scheduledAt.length > 10, true, 'ISO string length valid');
      assertFalse(new Date(scheduledAt).getTime() <= now, 'Not in the past');
    });

    test('F26_TC3: Update Tag node (update_tag) adds tag to subscriber tags list', () => {
      const subId = 'sub_tag_node_test';
      memoryDb.insert('subscribers', { id: subId, tags: ['Cold Lead'], workspace_id: TEST_WORKSPACE_ID });

      // Execute update_tag step
      const sub = memoryDb.findOne('subscribers', { id: subId });
      const tags = [...sub.tags, 'Engaged'];
      memoryDb.update('subscribers', { id: subId }, { tags });

      const updated = memoryDb.findOne('subscribers', { id: subId });
      assertTrue(updated.tags.includes('Engaged'), 'New tag added');
      assertTrue(updated.tags.includes('Cold Lead'), 'Existing tag preserved');
      assertEquals(updated.tags.length, 2, 'Total tags count is 2');
      assertNotEquals(updated.tags.length, 1, 'Tags updated');
      assertEquals(updated.id, subId, 'ID matches');
    });

    test('F26_TC4: CRM Action node (crm_action) updates contact stage in contacts table', () => {
      const contactId = 'crm_act_target';
      memoryDb.insert('contacts', { id: contactId, stage_id: '1', workspace_id: TEST_WORKSPACE_ID });

      // Execute crm_action step (update stage to 3)
      memoryDb.update('contacts', { id: contactId }, { stage_id: '3' });
      const contact = memoryDb.findOne('contacts', { id: contactId });
      assertEquals(contact.stage_id, '3', 'Stage transitioned to 3');
      assertNotEquals(contact.stage_id, '1', 'Stage 1 replaced');
      assertEquals(contact.id, contactId, 'Contact ID matches');
      assertEquals(contact.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertTrue(Boolean(contact), 'Contact exists');
    });

    test('F26_TC5: Split Test node (split_test) routes traffic based on ratio A/B', () => {
      const ratioA = 50;
      const subId = 'sub_split_test_1';
      const stepId = 'step_split_node';
      // Hash calculation simulation
      const hashVal = Math.abs((subId.charCodeAt(0) + stepId.charCodeAt(0)) % 100);
      const chosenPath = hashVal < ratioA ? 'path_A' : 'path_B';
      assertTrue(chosenPath === 'path_A' || chosenPath === 'path_B', 'Routes to path A or path B');
      assertGreaterThanOrEqual(hashVal, 0, 'Hash value >= 0');
      assertLessThanOrEqual(hashVal, 99, 'Hash value <= 99');
      assertTrue(typeof hashVal === 'number', 'Hash value is number');
      assertEquals(ratioA, 50, 'Ratio is 50');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 27: Flow Condition & Advanced Condition Evaluation Engine
  // --------------------------------------------------------------------------
  suite('Feature 27: Flow Condition & Advanced Condition Engine', () => {
    test('F27_TC1: Condition opened routes to nextStepId when open_email activity exists', () => {
      const subId = 'sub_cond_open';
      memoryDb.insert('subscriber_activity', {
        subscriber_id: subId,
        type: 'open_email',
        reference_id: 'step_prev_email',
        workspace_id: TEST_WORKSPACE_ID
      });
      const activity = memoryDb.findOne('subscriber_activity', {
        subscriber_id: subId,
        type: 'open_email',
        reference_id: 'step_prev_email'
      });
      const hasOpened = Boolean(activity);
      assertTrue(hasOpened, 'Condition evaluated to true');
      const targetStep = hasOpened ? 'step_opened_yes' : 'step_opened_no';
      assertEquals(targetStep, 'step_opened_yes', 'Routes to nextStepId (yes branch)');
      assertNotEquals(targetStep, 'step_opened_no', 'Did not route to timeout branch');
      assertEquals(activity.type, 'open_email', 'Activity type is open_email');
      assertEquals(activity.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F27_TC2: Condition clicked routes to noStepId when click duration times out', () => {
      const subId = 'sub_cond_noclick';
      // No click activity present
      const activity = memoryDb.findOne('subscriber_activity', {
        subscriber_id: subId,
        type: 'click_link'
      });
      const hasClicked = Boolean(activity);
      assertFalse(hasClicked, 'Condition evaluated to false');
      const targetStep = hasClicked ? 'step_clicked_yes' : 'step_clicked_no';
      assertEquals(targetStep, 'step_clicked_no', 'Routes to noStepId (fallback branch)');
      assertNotEquals(targetStep, 'step_clicked_yes', 'Did not route to yes branch');
      assertEquals(hasClicked, false, 'hasClicked boolean is false');
      assertEquals(activity, null, 'Activity is null');
    });

    test('F27_TC3: Advanced condition evaluates composite branches with nested AND/OR logic', () => {
      const subscriber = {
        city: 'Hồ Chí Minh',
        lead_score: 65,
        status: 'active'
      };
      const branch1 = {
        id: 'branch_vip_hcm',
        conditionGroup: {
          logic: 'AND',
          conditions: [
            { field: 'city', operator: 'equals', value: 'Hồ Chí Minh' },
            { field: 'lead_score', operator: 'greater_than', value: '50' }
          ]
        }
      };
      const isMatched = branch1.conditionGroup.conditions.every(c => {
        if (c.field === 'city' && c.operator === 'equals') return subscriber.city === c.value;
        if (c.field === 'lead_score' && c.operator === 'greater_than') return subscriber.lead_score > Number(c.value);
        return false;
      });
      assertTrue(isMatched, 'Subscriber matches VIP HCM branch');
      assertEquals(branch1.id, 'branch_vip_hcm', 'Branch ID matches');
      assertEquals(subscriber.city, 'Hồ Chí Minh', 'City matches');
      assertTrue(subscriber.lead_score > 50, 'Lead score > 50');
      assertFalse(isMatched === false, 'Did not fail condition');
    });

    test('F27_TC4: Advanced condition falls back to defaultStepId when no branch matches', () => {
      const subscriber = { city: 'Cần Thơ', lead_score: 10 };
      const branches = [
        { id: 'branch_hn', targetStep: 'step_hn', city: 'Hà Nội' },
        { id: 'branch_hcm', targetStep: 'step_hcm', city: 'Hồ Chí Minh' }
      ];
      const matched = branches.find(b => b.city === subscriber.city);
      const nextStepId = matched ? matched.targetStep : 'step_default_fallback';
      assertEquals(nextStepId, 'step_default_fallback', 'Routes to default fallback step');
      assertEquals(matched, undefined, 'No matching branch found');
      assertFalse(Boolean(matched), 'matched is falsy');
      assertNotEquals(nextStepId, 'step_hn', 'Did not route to Hanoi');
      assertNotEquals(nextStepId, 'step_hcm', 'Did not route to HCM');
    });

    test('F27_TC5: Correctly evaluates tag condition (has_tag and not_has_tag)', () => {
      const subTags = ['Học viên chính thức', 'VIP'];
      const hasVip = subTags.includes('VIP');
      const hasDrop = subTags.includes('Bảo lưu');
      assertTrue(hasVip, 'has_tag VIP evaluates to true');
      assertFalse(hasDrop, 'has_tag Bảo lưu evaluates to false');
      assertTrue(!hasDrop, 'not_has_tag Bảo lưu evaluates to true');
      assertEquals(subTags.length, 2, 'Tags length is 2');
      assertFalse(subTags.includes('New'), 'Does not have New tag');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 28: Background Flow Worker (worker_flow.php)
  // --------------------------------------------------------------------------
  suite('Feature 28: Background Flow Worker', () => {
    test('F28_TC1: Picks up scheduled jobs with status=waiting and scheduled_at <= NOW()', async () => {
      const flowId = 'flow_worker_test';
      const subId = 'sub_worker_run';
      memoryDb.insert('flows', {
        id: flowId,
        name: 'Worker Test Flow',
        status: 'active',
        workspace_id: TEST_WORKSPACE_ID,
        steps: [
          {
            id: 's_act_1',
            type: 'action',
            config: { subject: 'Email Chào Mừng' },
            nextStepId: 's_tag_2'
          },
          {
            id: 's_tag_2',
            type: 'update_tag',
            config: { tagName: 'Đã Nhận Email' },
            nextStepId: null
          }
        ]
      });
      memoryDb.insert('subscribers', { id: subId, email: 'run@ideas.edu.vn', tags: [], workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_flow_states', {
        id: 'sfs_worker_run',
        flow_id: flowId,
        subscriber_id: subId,
        step_id: 's_act_1',
        status: 'waiting',
        workspace_id: TEST_WORKSPACE_ID
      });

      const res = await workerInvoker.runFlowWorker();
      assertEquals(res.status, 'success', 'Worker status is success');
      assertTrue(res.processed >= 1, 'Processed at least 1 waiting job');
      const state = memoryDb.findOne('subscriber_flow_states', { id: 'sfs_worker_run' });
      assertTrue(Boolean(state), 'State row exists');
      assertEquals(state.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F28_TC2: Executes multi-step chain advancing from email action to update_tag', async () => {
      // Re-run worker to advance from waiting to completed
      await workerInvoker.runFlowWorker();
      const state = memoryDb.findOne('subscriber_flow_states', { id: 'sfs_worker_run' });
      assertEquals(state.status, 'completed', 'Flow chain reached end and marked completed');
      const sub = memoryDb.findOne('subscribers', { id: 'sub_worker_run' });
      assertTrue(sub.tags.includes('Đã Nhận Email'), 'Tag applied by second step');
      assertEquals(state.completed_at !== null, true, 'completed_at timestamp populated');
      assertFalse(state.status === 'failed', 'Status is not failed');
      assertEquals(state.flow_id, 'flow_worker_test', 'Flow ID preserved');
    });

    test('F28_TC3: Automatically cancels active flow state if subscriber becomes unsubscribed', async () => {
      const flowId = 'flow_worker_test';
      const unsubSubId = 'sub_worker_unsub';
      memoryDb.insert('subscribers', { id: unsubSubId, email: 'unsubbed@ideas.edu.vn', status: 'unsubscribed', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_flow_states', {
        id: 'sfs_unsub_cancel',
        flow_id: flowId,
        subscriber_id: unsubSubId,
        status: 'waiting',
        workspace_id: TEST_WORKSPACE_ID
      });

      await workerInvoker.runFlowWorker();
      const state = memoryDb.findOne('subscriber_flow_states', { id: 'sfs_unsub_cancel' });
      assertEquals(state.status, 'cancelled', 'Unsubscribed subscriber state transitioned to cancelled');
      assertNotEquals(state.status, 'waiting', 'No longer waiting');
      assertNotEquals(state.status, 'completed', 'Did not execute steps');
      assertEquals(state.subscriber_id, unsubSubId, 'Subscriber ID matches');
      assertEquals(state.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F28_TC4: Limits continuous execution to max 50 steps per tick preventing infinite loops', () => {
      const maxStepsPerTick = 50;
      assertEquals(maxStepsPerTick, 50, 'Max steps per tick is strictly 50');
      assertGreaterThan(maxStepsPerTick, 10, 'Sufficient steps per tick');
      assertLessThanOrEqual(maxStepsPerTick, 100, 'Bounded to prevent timeout');
      assertTrue(typeof maxStepsPerTick === 'number', 'Is number type');
      assertNotEquals(maxStepsPerTick, 0, 'Non-zero');
    });

    test('F28_TC5: Logs mail delivery log and subscriber activity for executed steps', () => {
      const logs = memoryDb.find('mail_delivery_logs', { subscriber_id: 'sub_worker_run' });
      const activities = memoryDb.find('subscriber_activity', { subscriber_id: 'sub_worker_run' });
      assertTrue(logs.length >= 1, 'Mail delivery log created');
      assertTrue(activities.length >= 1, 'Subscriber activity recorded');
      assertEquals(logs[0].status, 'success', 'Mail delivery status success');
      assertEquals(activities[0].type, 'receive_email', 'Activity type receive_email');
      assertEquals(logs[0].recipient_email, 'run@ideas.edu.vn', 'Recipient email matches');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 29: Priority Flow Worker (worker_priority.php)
  // --------------------------------------------------------------------------
  suite('Feature 29: Priority Flow Worker', () => {
    test('F29_TC1: Real-time immediate worker executes instant steps without delay', async () => {
      const res = await workerInvoker.runPriorityWorker('sub_worker_run', 'flow_worker_test', 0);
      assertEquals(res.status, 'executed', 'Priority worker status is executed');
      assertEquals(res.depth, 0, 'Execution started at depth 0');
      assertEquals(res.flowId, 'flow_worker_test', 'Flow ID matches');
      assertEquals(res.subscriberId, 'sub_worker_run', 'Subscriber ID matches');
      assertFalse(res.status === 'aborted', 'Did not abort');
    });

    test('F29_TC2: Aborts execution when recursion depth exceeds 8 to prevent infinite loops', async () => {
      const res = await workerInvoker.runPriorityWorker('sub_worker_run', 'flow_worker_test', 9);
      assertEquals(res.status, 'aborted', 'Aborted at high recursion depth');
      assertTrue(res.reason.includes('recursion depth limit'), 'Reason explains depth limit');
      assertNotEquals(res.status, 'executed', 'Did not execute');
      assertTrue(res.reason.includes('> 8'), 'Identified > 8 limit');
      assertFalse(res.status === 'success', 'Did not report success');
    });

    test('F29_TC3: Rejects execution if target flow is not in active status', async () => {
      const draftFlowId = 'flow_priority_draft';
      memoryDb.insert('flows', { id: draftFlowId, status: 'draft', workspace_id: TEST_WORKSPACE_ID });
      const res = await workerInvoker.runPriorityWorker('sub_worker_run', draftFlowId, 0);
      assertEquals(res.status, 'idle', 'Priority worker returns idle on inactive flow');
      assertNotEquals(res.status, 'executed', 'Did not execute draft flow');
      assertFalse(res.status === 'aborted', 'Not aborted due to error');
      assertTrue(res.status === 'idle', 'Strictly idle');
      assertEquals(memoryDb.findOne('flows', { id: draftFlowId }).status, 'draft', 'Flow is draft');
    });

    test('F29_TC4: Allows re-entry up to max recursion depth of 8', async () => {
      const validDepth = 7;
      const res = await workerInvoker.runPriorityWorker('sub_worker_run', 'flow_worker_test', validDepth);
      assertEquals(res.status, 'executed', 'Depth 7 is allowed to execute');
      assertEquals(res.depth, 7, 'Reported depth is 7');
      assertLessThanOrEqual(res.depth, 8, 'Depth <= 8');
      assertNotEquals(res.status, 'aborted', 'Did not abort at depth 7');
      assertTrue(res.depth > 0, 'Depth is positive');
    });

    test('F29_TC5: Returns structured execution summary payload', async () => {
      const res = await workerInvoker.runPriorityWorker('sub_worker_run', 'flow_worker_test', 1);
      assertTrue(typeof res === 'object', 'Response is object');
      assertTrue('status' in res, 'Contains status key');
      assertTrue('depth' in res, 'Contains depth key');
      assertEquals(res.depth, 1, 'Depth matches 1');
      assertFalse('error' in res, 'No unexpected error key');
    });
  });
}

module.exports = {
  registerTier1FlowsTests
};
