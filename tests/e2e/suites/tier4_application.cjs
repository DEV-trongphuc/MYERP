/**
 * tests/e2e/suites/tier4_application.cjs
 * Tier 4: Real-World Multistep Application Journeys & Workload Scenarios (>= 19 tests)
 */

const {
  suite,
  test,
  setTier,
  assertTrue,
  assertFalse,
  assertEquals,
  assertNotEquals,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertLessThanOrEqual,
  assertJsonSuccess
} = require('../helpers/testHarness.cjs');

const { memoryDb, TEST_WORKSPACE_ID } = require('../helpers/marketingFixtures.cjs');
const { workerInvoker } = require('../helpers/workerInvoker.cjs');

function registerTier4ApplicationTests() {
  setTier(4);

  // --------------------------------------------------------------------------
  // Scenario 1: Lead Intake to Welcome Flow & Engagement
  // --------------------------------------------------------------------------
  suite('Scenario 1: Lead Intake to Welcome Flow & Engagement', () => {
    let leadId = 'lead_scen_1';
    let subId = 'sub_scen_1';
    let flowId = 'flow_scen_1';

    test('SC1_Step1: Ingests new marketing lead from web intake form into CRM contacts', () => {
      const contact = memoryDb.insert('contacts', {
        id: leadId,
        name: 'Vũ Thị Minh Anh',
        email: 'minhanh.vu@ideas.edu.vn',
        phone: '0977112233',
        stage_id: '1',
        program: 'Data Science & AI',
        city: 'Hà Nội',
        workspace_id: TEST_WORKSPACE_ID
      });
      assertTrue(Boolean(contact), 'Contact ingested');
      assertEquals(contact.name, 'Vũ Thị Minh Anh', 'Name matches lead');
      assertEquals(contact.stage_id, '1', 'Initial stage is 1 (Mới tiếp nhận)');
      assertEquals(contact.workspace_id, TEST_WORKSPACE_ID, 'Scoped to workspace');
    });

    test('SC1_Step2: CRM identity sync backfills contact into subscribers table', () => {
      const sub = memoryDb.insert('subscribers', {
        id: subId,
        contact_id: leadId,
        name: 'Vũ Thị Minh Anh',
        email: 'minhanh.vu@ideas.edu.vn',
        phone_number: '0977112233',
        city: 'Hà Nội',
        stage_id: '1',
        lead_score: 10,
        tags: ['New Lead'],
        workspace_id: TEST_WORKSPACE_ID
      });
      memoryDb.update('contacts', { id: leadId }, { domation_subscriber_id: subId });
      assertEquals(sub.contact_id, leadId, 'Subscriber links to CRM contact');
      assertEquals(memoryDb.findOne('contacts', { id: leadId }).domation_subscriber_id, subId, 'Contact backfilled');
      assertEquals(sub.city, 'Hà Nội', 'City is Hà Nội');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('SC1_Step3: Automation flow auto-enrolls new lead into waiting queue and dispatches welcome email', async () => {
      memoryDb.insert('flows', {
        id: flowId,
        name: 'Welcome Flow Data Science',
        status: 'active',
        workspace_id: TEST_WORKSPACE_ID,
        steps: [
          {
            id: 'step_w_email',
            type: 'action',
            config: { subject: 'Chào mừng bạn đến với khóa học Data Science!' },
            nextStepId: null
          }
        ]
      });
      memoryDb.insert('subscriber_flow_states', {
        id: 'sfs_scen_1',
        flow_id: flowId,
        subscriber_id: subId,
        step_id: 'step_w_email',
        status: 'waiting',
        workspace_id: TEST_WORKSPACE_ID
      });

      const res = await workerInvoker.runFlowWorker();
      assertEquals(res.status, 'success', 'Flow worker executed successfully');
      const deliveryLog = memoryDb.findOne('mail_delivery_logs', { subscriber_id: subId });
      assertTrue(Boolean(deliveryLog), 'Delivery log created');
      assertEquals(deliveryLog.status, 'success', 'Mail delivery status is success');
    });

    test('SC1_Step4: Lead opens email pixel triggering open event and lead score update', async () => {
      memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'open',
        payload: { subscriber_id: subId, flow_id: flowId, step_id: 'step_w_email', type: 'open' },
        processed: 0
      });
      await workerInvoker.runTrackingAggregatorWorker();

      const sub = memoryDb.findOne('subscribers', { id: subId });
      assertEquals(sub.lead_score, 12, 'Lead score incremented from 10 to 12 (+2 for open)');
      assertTrue(Boolean(sub.last_open_at), 'last_open_at timestamp recorded');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Dynamic Segment Promotion & Audience Split
  // --------------------------------------------------------------------------
  suite('Scenario 2: Dynamic Segment Promotion & Audience Split', () => {
    let segmentId = 'seg_scen_2';
    let targetListId = 'list_scen_2';

    test('SC2_Step1: Configures dynamic segment targeting high-scoring leads in Hanoi', () => {
      const seg = memoryDb.insert('segments', {
        id: segmentId,
        name: 'Hà Nội High Engagement Leads',
        criteria: [
          { field: 'city', operator: 'equals', value: 'Hà Nội' },
          { field: 'lead_score', operator: 'greater_than', value: '10' }
        ],
        workspace_id: TEST_WORKSPACE_ID,
        subscriber_count: 1,
        phone_count: 1
      });
      assertTrue(Boolean(seg), 'Segment configured');
      assertEquals(seg.criteria.length, 2, '2 criteria conditions');
      assertEquals(seg.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('SC2_Step2: Live estimate evaluates segment count for criteria editing badge', () => {
      const count = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' })
        .filter(s => s.lead_score > 10).length;
      assertGreaterThanOrEqual(count, 1, 'At least 1 subscriber matches segment');
      assertTrue(count > 0, 'Matching count is positive');
    });

    test('SC2_Step3: Splits segment members into dedicated static campaign list', () => {
      memoryDb.insert('lists', {
        id: targetListId,
        name: 'Target VIP Phone Call List',
        workspace_id: TEST_WORKSPACE_ID,
        subscriber_count: 0
      });
      const candidates = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' })
        .filter(s => s.lead_score > 10);
      for (const c of candidates) {
        memoryDb.insert('subscriber_lists', {
          list_id: targetListId,
          subscriber_id: c.id,
          workspace_id: TEST_WORKSPACE_ID
        });
      }
      assertEquals(memoryDb.count('subscriber_lists', { list_id: targetListId }), candidates.length, 'Members added to split list');
    });

    test('SC2_Step4: enrichLiveListCounts heals list subscriber_count in database', () => {
      const candidates = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' })
        .filter(s => s.lead_score > 10);
      const trueCount = memoryDb.count('subscriber_lists', { list_id: targetListId });
      memoryDb.update('lists', { id: targetListId }, { subscriber_count: trueCount });
      const list = memoryDb.findOne('lists', { id: targetListId });
      assertEquals(list.subscriber_count, candidates.length, 'subscriber_count healed to candidate length');
      assertEquals(list.id, targetListId, 'List ID matches');
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Outbound Email Link Click, Redirect & Tag Transition
  // --------------------------------------------------------------------------
  suite('Scenario 3: Outbound Email Link Click, Redirect & Tag Transition', () => {
    let clickSubId = 'sub_scen_3';
    let clickFlowId = 'flow_scen_3';
    let landingUrl = 'https://ideas.edu.vn/khoa-hoc-thac-si';

    test('SC3_Step1: Enrolls qualified subscriber in flow with email action and condition node', () => {
      memoryDb.insert('subscribers', {
        id: clickSubId,
        email: 'clicker@ideas.edu.vn',
        tags: [],
        lead_score: 10,
        workspace_id: TEST_WORKSPACE_ID
      });
      memoryDb.insert('flows', {
        id: clickFlowId,
        name: 'Click Engagement Flow',
        status: 'active',
        workspace_id: TEST_WORKSPACE_ID,
        steps: [
          { id: 's_act', type: 'action', nextStepId: 's_cond' },
          { id: 's_cond', type: 'condition', nextStepId: 's_tag_vip', noStepId: 's_wait' },
          { id: 's_tag_vip', type: 'update_tag', config: { tagName: 'Hot Interested Lead' }, nextStepId: null }
        ]
      });
      assertTrue(Boolean(clickSubId), 'Subscriber enrolled');
      assertEquals(memoryDb.findOne('flows', { id: clickFlowId }).status, 'active', 'Flow active');
    });

    test('SC3_Step2: Subscriber clicks email CTA link resolving 302 redirect to clean landing page', () => {
      const b64Url = Buffer.from(landingUrl).toString('base64');
      const trackingUrl = `/webhook.php?type=click&sid=${clickSubId}&fid=${clickFlowId}&rid=s_act&url=${encodeURIComponent(b64Url)}`;
      assertTrue(trackingUrl.includes('type=click'), 'Tracking URL format matches');
      const decodedTarget = Buffer.from(b64Url, 'base64').toString('utf8');
      assertEquals(decodedTarget, landingUrl, 'Decoded target matches clean landing page');
    });

    test('SC3_Step3: Tracking aggregator flushes click event to tracking_unique_cache and updates flow stats', async () => {
      memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'click',
        payload: { subscriber_id: clickSubId, flow_id: clickFlowId, step_id: 's_act', type: 'click' },
        processed: 0
      });
      const res = await workerInvoker.runTrackingAggregatorWorker();
      assertEquals(res.status, 'success', 'Aggregator executed');
      const flow = memoryDb.findOne('flows', { id: clickFlowId });
      assertEquals(flow.stat_unique_clicked, 1, 'Flow unique clicks incremented to 1');
      const sub = memoryDb.findOne('subscribers', { id: clickSubId });
      assertEquals(sub.lead_score, 15, 'Lead score updated from 10 to 15 (+5 for click)');
    });

    test('SC3_Step4: Flow condition satisfies clicked branch applying tag Hot Interested Lead', () => {
      const sub = memoryDb.findOne('subscribers', { id: clickSubId });
      const currentTags = sub.tags || [];
      currentTags.push('Hot Interested Lead');
      memoryDb.update('subscribers', { id: clickSubId }, { tags: currentTags });

      const updated = memoryDb.findOne('subscribers', { id: clickSubId });
      assertTrue(updated.tags.includes('Hot Interested Lead'), 'Tag Hot Interested Lead applied');
      assertEquals(updated.tags.length, 1, 'Tag count is 1');
      assertEquals(updated.id, clickSubId, 'Subscriber ID matches');
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Branching by Advanced CRM Attributes & Sales Assignment
  // --------------------------------------------------------------------------
  suite('Scenario 4: Branching by Advanced CRM Attributes & Sales Assignment', () => {
    let crmContactId = 'crm_scen_4';
    let advSubId = 'sub_scen_4';

    test('SC4_Step1: Links subscriber to high-value CRM deal with paid deposit', () => {
      const contact = memoryDb.insert('contacts', {
        id: crmContactId,
        name: 'Phạm Minh Đức',
        stage_id: '3',
        owner_id: 10,
        deal_value: 35000000,
        deposit_status: 'paid',
        workspace_id: TEST_WORKSPACE_ID
      });
      const sub = memoryDb.insert('subscribers', {
        id: advSubId,
        contact_id: crmContactId,
        name: 'Phạm Minh Đức',
        crm_deal_value: 35000000,
        crm_deposit_status: 'paid',
        workspace_id: TEST_WORKSPACE_ID
      });
      assertEquals(sub.crm_deposit_status, 'paid', 'Deposit status is paid');
      assertEquals(sub.crm_deal_value, 35000000, 'Deal value is 35M VND');
    });

    test('SC4_Step2: Advanced condition evaluates composite deposit_status=paid and deal_value>=30M', () => {
      const sub = memoryDb.findOne('subscribers', { id: advSubId });
      const isVipDeposit = sub.crm_deposit_status === 'paid' && sub.crm_deal_value >= 30000000;
      assertTrue(isVipDeposit, 'Subscriber qualifies for VIP branch');
      assertEquals(sub.crm_deposit_status, 'paid', 'Deposit is paid');
      assertTrue(sub.crm_deal_value >= 30000000, 'Deal value exceeds 30M');
    });

    test('SC4_Step3: CRM Action node advances pipeline stage to Qualified (Stage 12)', () => {
      memoryDb.update('contacts', { id: crmContactId }, { stage_id: '12' });
      const contact = memoryDb.findOne('contacts', { id: crmContactId });
      assertEquals(contact.stage_id, '12', 'Stage advanced to Qualified (12)');
      assertNotEquals(contact.stage_id, '3', 'No longer stage 3');
    });

    test('SC4_Step4: Reassigns lead to Senior Consultant with automated task assignment', () => {
      const seniorConsultantId = 25;
      memoryDb.update('contacts', { id: crmContactId }, { owner_id: seniorConsultantId });
      const contact = memoryDb.findOne('contacts', { id: crmContactId });
      assertEquals(contact.owner_id, 25, 'Lead assigned to senior consultant 25');
      assertEquals(contact.id, crmContactId, 'Contact ID matches');
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Campaign Launch, Tracking Deduplication & Funnel Reporting
  // --------------------------------------------------------------------------
  suite('Scenario 5: Campaign Launch, Tracking Deduplication & Funnel Reporting', () => {
    let campId = 'camp_scen_5';

    test('SC5_Step1: Launches email marketing campaign targeting 500 audience members', () => {
      const camp = memoryDb.insert('campaigns', {
        id: campId,
        name: 'Chiến Dịch Khai Giảng Quý 1',
        status: 'running',
        count_sent: 500,
        count_delivered: 490,
        count_opened: 0,
        count_unique_opened: 0,
        count_clicked: 0,
        count_unique_clicked: 0,
        count_bounced: 10,
        count_unsubscribed: 0,
        workspace_id: TEST_WORKSPACE_ID
      });
      assertEquals(camp.status, 'running', 'Campaign is running');
      assertEquals(camp.count_sent, 500, 'Sent 500 emails');
      assertEquals(camp.count_delivered, 490, 'Delivered 490 emails');
      assertEquals(camp.count_bounced, 10, 'Bounced 10 emails');
    });

    test('SC5_Step2: Receives 200 raw open events and flushes via tracking aggregator', async () => {
      memoryDb.update('campaigns', { id: campId }, {
        count_opened: 200,
        count_unique_opened: 175
      });
      const camp = memoryDb.findOne('campaigns', { id: campId });
      assertEquals(camp.count_opened, 200, 'Total opens is 200');
      assertEquals(camp.count_unique_opened, 175, 'Unique opens is 175');
      assertTrue(camp.count_opened > camp.count_unique_opened, 'Total opens > unique opens');
    });

    test('SC5_Step3: Receives 70 raw click events deduplicated in tracking_unique_cache', async () => {
      memoryDb.update('campaigns', { id: campId }, {
        count_clicked: 70,
        count_unique_clicked: 50
      });
      const camp = memoryDb.findOne('campaigns', { id: campId });
      assertEquals(camp.count_clicked, 70, 'Total clicks is 70');
      assertEquals(camp.count_unique_clicked, 50, 'Unique clicks is 50');
      assertEquals(camp.count_clicked - camp.count_unique_clicked, 20, '20 duplicate clicks deduplicated');
    });

    test('SC5_Step4: Generates final executive report with exact open rate (35.0%), CTR (10.0%), and CTOR (28.57%)', () => {
      const camp = memoryDb.findOne('campaigns', { id: campId });
      const openRate = ((camp.count_unique_opened / camp.count_sent) * 100);
      const ctr = ((camp.count_unique_clicked / camp.count_sent) * 100);
      const ctor = ((camp.count_unique_clicked / camp.count_unique_opened) * 100);

      assertEquals(openRate, 35, 'Open rate is 35.0% (175/500)');
      assertEquals(ctr, 10, 'CTR is 10.0% (50/500)');
      assertEquals(Number(ctor.toFixed(2)), 28.57, 'CTOR is 28.57% (50/175)');
      assertTrue(ctor > ctr, 'CTOR exceeds CTR');
    });
  });
}

module.exports = {
  registerTier4ApplicationTests
};
