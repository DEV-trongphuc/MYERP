/**
 * tests/e2e/helpers/workerInvoker.cjs
 * Worker Invocation & High-Fidelity Simulation Engine for Marketing Automation Workers
 */

const { memoryDb, TEST_WORKSPACE_ID } = require('./marketingFixtures.cjs');

class WorkerInvoker {
  constructor() {
    this.logs = [];
  }

  log(msg) {
    this.logs.push(`[${new Date().toISOString()}] ${msg}`);
  }

  /**
   * worker_segment_counts.php
   * Recalculates subscriber_count and phone_count for queued segments
   */
  async runSegmentCountsWorker() {
    this.log('worker_segment_counts: [START] Processing segment_count_update_queue');
    const queue = memoryDb.find('segment_count_update_queue', { workspace_id: TEST_WORKSPACE_ID });
    let processed = 0;

    for (const item of queue) {
      const segment = memoryDb.findOne('segments', { id: item.segment_id, workspace_id: TEST_WORKSPACE_ID });
      if (!segment) {
        this.log(`[SKIP] Segment ${item.segment_id} not found, removing from queue`);
        memoryDb.tables.segment_count_update_queue.delete(item.id);
        continue;
      }

      // Re-evaluate matching subscribers
      const allSubscribers = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, 'deleted_at IS NULL': true });
      const exclusions = memoryDb.find('segment_exclusions', { segment_id: segment.id, workspace_id: TEST_WORKSPACE_ID });
      const excludedIds = new Set(exclusions.map(e => e.subscriber_id));

      const matched = allSubscribers.filter(sub => {
        if (excludedIds.has(sub.id)) return false;
        // Evaluate criteria if present
        if (segment.criteria && Array.isArray(segment.criteria)) {
          return segment.criteria.every(cond => {
            if (cond.field === 'city' && cond.operator === 'equals') return sub.city === cond.value;
            if (cond.field === 'stage_id' && cond.operator === 'equals') return String(sub.stage_id) === String(cond.value);
            return true;
          });
        }
        return true;
      });

      const phoneCount = matched.filter(s => s.phone_number && s.phone_number.length >= 9).length;

      memoryDb.update('segments', { id: segment.id }, {
        subscriber_count: matched.length,
        phone_count: phoneCount,
        last_calculated_at: new Date().toISOString()
      });

      memoryDb.tables.segment_count_update_queue.delete(item.id);
      processed++;
    }

    this.log(`worker_segment_counts: [END] Processed ${processed} segments`);
    return { status: 'success', processed, logs: this.logs };
  }

  /**
   * worker_segment_notify.php
   * Checks notify_on_join segments and dispatches alert emails
   */
  async runSegmentNotifyWorker() {
    this.log('worker_segment_notify: [START]');
    const segments = memoryDb.find('segments', {
      workspace_id: TEST_WORKSPACE_ID,
      notify_on_join: 1
    });

    let notifiedCount = 0;
    for (const seg of segments) {
      if (!seg.notify_email) continue;
      // Find matching subscribers that haven't been notified yet
      const allSubscribers = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, 'deleted_at IS NULL': true });
      for (const sub of allSubscribers) {
        const alreadyNotified = memoryDb.findOne('subscriber_activity', {
          subscriber_id: sub.id,
          type: 'segment_notify',
          reference_id: seg.id
        });
        if (!alreadyNotified) {
          memoryDb.insert('subscriber_activity', {
            subscriber_id: sub.id,
            workspace_id: TEST_WORKSPACE_ID,
            type: 'segment_notify',
            reference_id: seg.id,
            details: `Alert email dispatched to ${seg.notify_email} for new segment join`
          });
          notifiedCount++;
        }
      }
    }

    return { status: 'completed', notifiedCount };
  }

  /**
   * worker_flow.php
   * Picks up waiting subscriber_flow_states and progresses them through steps
   */
  async runFlowWorker(maxSteps = 50) {
    this.log('worker_flow: [START]');
    const waitingStates = memoryDb.find('subscriber_flow_states', {
      workspace_id: TEST_WORKSPACE_ID,
      status: 'waiting'
    });

    let processed = 0;
    for (const state of waitingStates) {
      const flow = memoryDb.findOne('flows', { id: state.flow_id, workspace_id: TEST_WORKSPACE_ID });
      if (!flow || flow.status !== 'active') continue;

      const subscriber = memoryDb.findOne('subscribers', { id: state.subscriber_id, workspace_id: TEST_WORKSPACE_ID });
      if (!subscriber || subscriber.deleted_at || subscriber.status === 'unsubscribed') {
        memoryDb.update('subscriber_flow_states', { id: state.id }, { status: 'cancelled' });
        continue;
      }

      // Execute current step node
      const steps = flow.steps || [];
      const currentStep = steps.find(s => s.id === state.step_id) || steps[0];
      if (!currentStep) {
        memoryDb.update('subscriber_flow_states', { id: state.id }, { status: 'completed' });
        continue;
      }

      memoryDb.update('subscriber_flow_states', { id: state.id }, { status: 'processing' });
      const nextStepId = currentStep.nextStepId;

      if (currentStep.type === 'action') {
        // Dispatches email
        memoryDb.insert('mail_delivery_logs', {
          workspace_id: TEST_WORKSPACE_ID,
          flow_id: flow.id,
          step_id: currentStep.id,
          subscriber_id: subscriber.id,
          recipient_email: subscriber.email,
          subject: currentStep.config?.subject || 'Thông báo',
          status: 'success',
          sent_at: new Date().toISOString()
        });
        memoryDb.insert('subscriber_activity', {
          subscriber_id: subscriber.id,
          workspace_id: TEST_WORKSPACE_ID,
          type: 'receive_email',
          reference_id: currentStep.id,
          details: `Sent email: ${currentStep.config?.subject || ''}`
        });
      } else if (currentStep.type === 'update_tag') {
        const tagName = currentStep.config?.tagName || 'Tag';
        const currentTags = subscriber.tags ? (typeof subscriber.tags === 'string' ? JSON.parse(subscriber.tags) : subscriber.tags) : [];
        if (!currentTags.includes(tagName)) {
          currentTags.push(tagName);
          memoryDb.update('subscribers', { id: subscriber.id }, { tags: currentTags });
        }
      } else if (currentStep.type === 'crm_action') {
        if (currentStep.config?.stageId && subscriber.contact_id) {
          memoryDb.update('contacts', { id: subscriber.contact_id }, {
            stage_id: currentStep.config.stageId
          });
        }
      }

      if (nextStepId) {
        memoryDb.update('subscriber_flow_states', { id: state.id }, {
          step_id: nextStepId,
          status: 'waiting',
          last_step_at: new Date().toISOString()
        });
      } else {
        memoryDb.update('subscriber_flow_states', { id: state.id }, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      }
      processed++;
    }

    return { status: 'success', processed };
  }

  /**
   * worker_priority.php
   * Immediate priority execution worker with recursion depth guard (< 8)
   */
  async runPriorityWorker(subscriberId, flowId, depth = 0) {
    if (depth > 8) {
      return { status: 'aborted', reason: 'Infinite recursion depth limit (> 8) reached' };
    }
    const flow = memoryDb.findOne('flows', { id: flowId, workspace_id: TEST_WORKSPACE_ID });
    if (!flow || flow.status !== 'active') return { status: 'idle' };

    return { status: 'executed', depth, flowId, subscriberId };
  }

  /**
   * worker_tracking_aggregator.php
   * Flushes raw_event_buffer, deduplicates in tracking_unique_cache, and increments stats
   */
  async runTrackingAggregatorWorker() {
    this.log('worker_tracking_aggregator: [START]');
    const rawEvents = memoryDb.find('raw_event_buffer', {
      workspace_id: TEST_WORKSPACE_ID,
      processed: 0
    });

    let processedCount = 0;
    for (const evt of rawEvents) {
      const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
      const { subscriber_id, flow_id, campaign_id, step_id, type } = payload;

      // Deduplication key in tracking_unique_cache
      const cacheKey = `${TEST_WORKSPACE_ID}:${campaign_id || flow_id}:${subscriber_id}:${type}:${step_id || 'general'}`;
      let isUnique = false;
      const existing = memoryDb.findOne('tracking_unique_cache', { cache_key: cacheKey });
      if (!existing) {
        memoryDb.insert('tracking_unique_cache', {
          workspace_id: TEST_WORKSPACE_ID,
          cache_key: cacheKey,
          subscriber_id,
          target_type: campaign_id ? 'campaign' : 'flow',
          target_id: campaign_id || flow_id,
          event_type: type,
          created_at: new Date().toISOString()
        });
        isUnique = true;
      }

      // Update flow stats
      if (flow_id) {
        const flow = memoryDb.findOne('flows', { id: flow_id });
        if (flow) {
          const updates = {};
          if (type === 'click') {
            updates.stat_total_clicked = (flow.stat_total_clicked || 0) + 1;
            if (isUnique) updates.stat_unique_clicked = (flow.stat_unique_clicked || 0) + 1;
          } else if (type === 'open') {
            updates.stat_total_opened = (flow.stat_total_opened || 0) + 1;
            if (isUnique) updates.stat_unique_opened = (flow.stat_unique_opened || 0) + 1;
          }
          memoryDb.update('flows', { id: flow_id }, updates);
        }
      }

      // Update campaign stats
      if (campaign_id) {
        const campaign = memoryDb.findOne('campaigns', { id: campaign_id });
        if (campaign) {
          const updates = {};
          if (type === 'click') {
            updates.count_clicked = (campaign.count_clicked || 0) + 1;
            if (isUnique) updates.count_unique_clicked = (campaign.count_unique_clicked || 0) + 1;
          } else if (type === 'open') {
            updates.count_opened = (campaign.count_opened || 0) + 1;
            if (isUnique) updates.count_unique_opened = (campaign.count_unique_opened || 0) + 1;
          }
          memoryDb.update('campaigns', { id: campaign_id }, updates);
        }
      }

      // Update subscriber lead score & timestamps
      if (subscriber_id) {
        const sub = memoryDb.findOne('subscribers', { id: subscriber_id });
        if (sub) {
          const scoreDelta = type === 'click' ? 5 : (type === 'open' ? 2 : 0);
          const updates = {
            lead_score: (sub.lead_score || 0) + scoreDelta,
            last_activity_at: new Date().toISOString()
          };
          if (type === 'click') updates.last_click_at = new Date().toISOString();
          if (type === 'open') updates.last_open_at = new Date().toISOString();
          memoryDb.update('subscribers', { id: subscriber_id }, updates);
        }
      }

      // Log activity
      memoryDb.insert('subscriber_activity', {
        subscriber_id,
        workspace_id: TEST_WORKSPACE_ID,
        type: type === 'click' ? 'click_link' : 'open_email',
        reference_id: campaign_id || flow_id,
        details: `Event ${type} recorded (unique: ${isUnique})`
      });

      // Mark raw event processed
      memoryDb.update('raw_event_buffer', { id: evt.id }, { processed: 1 });
      processedCount++;
    }

    return { status: 'success', processed: processedCount };
  }
}

const workerInvoker = new WorkerInvoker();

module.exports = {
  workerInvoker
};
