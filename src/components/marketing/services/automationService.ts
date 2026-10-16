
import { api } from './storageAdapter';
import { Flow, Subscriber, FlowStep } from '../types';

/**
 * Service xử lý logic vận hành Automation
 * (Frontend perspective: primarily for UI feedback & triggering backend workers)
 */
export const automationService = {
  /**
   * Kích hoạt Flow dựa trên sự kiện (Event-driven)
   * (Frontend gửi tín hiệu, Backend Worker_Priority sẽ xử lý)
   */
  async triggerFlowsByEvent(event: { type: 'tag_added' | 'campaign_sent' | 'segment_entered' | 'form_submitted' | 'purchase_created' | 'custom_event_triggered', targetId: string, subscriberIds: string[] }) {
    // This frontend function is mainly for determining which flows *might* be triggered for UI purposes (e.g., warning modals)
    // The actual triggering of flows for these events is now handled by the backend (e.g., forms.php, purchase_events.php calling worker_priority.php)
    // So, this frontend function will primarily query flows, but not directly enroll subscribers here.

    const flowsRes = await api.get<any>('flows');
    if (!flowsRes.success) return [];

    const rawData = flowsRes.data as any;
    const allFlows: Flow[] = Array.isArray(rawData) ? rawData : (rawData?.data || []);
    const activeFlows = allFlows.filter(f => f.status === 'active');
    let triggeredFlowsForUI: Flow[] = [];

    for (const flow of activeFlows) {
      const trigger = flow.steps.find(s => s.type === 'trigger');
      if (!trigger) continue;

      let shouldEnrollForUI = false; // Flag for UI, not actual enrollment

      // Logic kiểm tra khớp Trigger
      if (event.type === 'tag_added' && trigger.config.type === 'tag' && trigger.config.targetId === event.targetId) {
        shouldEnrollForUI = true;
      } else if (event.type === 'campaign_sent' && trigger.config.type === 'campaign' && trigger.config.targetId === event.targetId) {
        shouldEnrollForUI = true;
      } else if (event.type === 'segment_entered' && trigger.config.type === 'segment' && trigger.config.targetId === event.targetId) {
        shouldEnrollForUI = true;
      } else if (event.type === 'purchase_created' && trigger.config.type === 'purchase' && trigger.config.targetId === event.targetId) {
        shouldEnrollForUI = true;
      } else if (event.type === 'custom_event_triggered' && trigger.config.type === 'custom_event' && trigger.config.targetId === event.targetId) {
        shouldEnrollForUI = true;
      }

      if (shouldEnrollForUI) {
        triggeredFlowsForUI.push(flow);
      }
    }
    return triggeredFlowsForUI; // Return the list of flows that *would be* triggered for UI to show
  },

  /**
   * Chuyển tiếp khách hàng từ Flow này sang Flow khác (Direct Link)
   * (Hành động này được xử lý hoàn toàn bởi Worker_Flow ở Backend)
   */
  async transitionToFlow(targetFlowId: string, subscriberIds: string[]) {
    console.log(`[Automation - Frontend] Signalling backend to transition users to flow: ${targetFlowId}`);
    // In a real scenario, this would ideally be an API call to a backend endpoint
    // that then schedules these subscribers in the target flow via worker_flow.php
    // For now, this frontend function just logs, as the backend worker (worker_flow.php)
    // already handles the 'link_flow' step logic directly.
    // No direct frontend action needed beyond what worker_flow.php does.
  },

  /**
   * Ghi nhận việc khách hàng tham gia vào Flow
   * (Frontend chỉ gửi tín hiệu cập nhật, Backend Worker sẽ xử lý enrollment thực tế)
   */
  async enrollSubscribers(flowId: string, subIds: string[]) {
    console.log(`[Automation - Frontend] Signalling backend for enrollment of ${subIds.length} users into flow: ${flowId}`);
    // In the new architecture, the actual enrollment is done by worker_priority.php or worker_enroll.php
    // The frontend should NOT update flow stats or process steps directly.
    // If this function is still called on the frontend (e.g., from an Import modal), it implies
    // there's a corresponding backend API that needs to be hit, which in turn calls the workers.
    // For now, the existing `api.put` for flow stats acts as a placeholder for a dedicated backend endpoint.
    const flowRes = await api.get<Flow>(`flows/${flowId}`);
    if (flowRes.success) {
        const flow = flowRes.data;
        await api.put(`flows/${flowId}`, {
            ...flow,
            stats: {
                ...flow.stats,
                enrolled: (flow.stats.enrolled || 0) + subIds.length // This is a UI-centric optimistic update
            }
        });
    }
    // IMPORTANT: Removed the frontend-side processNextStep call.
    // The actual step processing will be picked up by worker_flow.php or worker_priority.php.
  },

  /**
   * Xử lý logic bước tiếp theo (Mô phỏng runtime)
   * (Này đã được chuyển hoàn toàn sang Backend Worker_Flow)
   */
  async processNextStep(flow: Flow, stepId: string, subIds: string[]) {
      console.warn("[Automation - Frontend] processNextStep is a backend-only operation in the new architecture. Frontend should not call this directly for actual execution.");
      // This function is no longer meant for actual execution on the frontend.
      // It's kept here as a stub or for legacy context but should not perform side effects.
  },

  /**
   * Thực thi hành động cụ thể của một bước
   * (Này đã được chuyển hoàn toàn sang Backend Worker_Flow)
   */
  async executeStepAction(flow: Flow, step: FlowStep, subscriberId: string) {
    console.warn("[Automation - Frontend] executeStepAction is a backend-only operation in the new architecture. Frontend should not call this directly for actual execution.");
    // This function is no longer meant for actual execution on the frontend.
    // It's kept here as a stub or for legacy context but should not perform side effects.
  }
};
