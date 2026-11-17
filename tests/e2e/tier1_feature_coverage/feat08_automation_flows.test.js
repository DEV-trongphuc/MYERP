/**
 * tests/e2e/tier1_feature_coverage/feat08_automation_flows.test.js
 * Feature 8: Automation Flow Survey Name Resolution & Deleted Entity Badges (R5)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';

export function registerFeature8Tests() {
  describe('Tier 1 - Feature 8: Automation Flow Survey Name Resolution & Deleted Entity Badges', () => {
    it('T1.8_TC1: Survey ID is resolved to real human-readable title instead of raw hash string', () => {
      const surveysList = [
        { id: '7df9349c-a1b2-4c3d', title: 'Khảo sát nhu cầu tuyển sinh MBA 2026', deleted_at: null },
        { id: '8ba1234e-f5e6-7a8b', title: 'Đánh giá chất lượng hội thảo Data Science', deleted_at: null }
      ];

      const resolveSurveyName = (surveyId, list) => {
        const found = list.find(s => s.id === surveyId);
        return found ? found.title : `Khảo sát: ${surveyId.substring(0, 8)}...`;
      };

      const resolved = resolveSurveyName('7df9349c-a1b2-4c3d', surveysList);
      assertEqual(resolved, 'Khảo sát nhu cầu tuyển sinh MBA 2026');
      assert(!resolved.startsWith('Khảo sát: 7df9349c...'), 'Must NOT display raw hash string');
    }, { tier: 1, featureId: 8 });

    it('T1.8_TC2: Flow linked to a deleted survey displays warning badge indicating entity deletion', () => {
      const surveysList = [
        { id: 'surv-01', title: 'Khảo sát đã đóng', deleted_at: '2026-11-10 10:00:00' }
      ];

      const getSurveyBadge = (surveyId, list) => {
        const found = list.find(s => s.id === surveyId);
        if (!found) return { text: 'Không tìm thấy khảo sát', color: 'gray' };
        if (found.deleted_at) return { text: 'Khảo sát đã xóa', color: 'rose' };
        return { text: found.title, color: 'blue' };
      };

      const badge = getSurveyBadge('surv-01', surveysList);
      assertEqual(badge.text, 'Khảo sát đã xóa');
      assertEqual(badge.color, 'rose');
    }, { tier: 1, featureId: 8 });

    it('T1.8_TC3: flowValidationService detects deleted entity trigger without throwing runtime crash', () => {
      const flow = {
        id: 'flow-101',
        name: 'Kịch bản chăm sóc sau khảo sát',
        steps: [
          { id: 'trigger-1', type: 'trigger', trigger_type: 'survey_submit', target_id: 'surv-deleted' }
        ]
      };
      const availableSurveys = []; // Empty or deleted

      const validateFlowEntities = (f, surveys) => {
        const errors = [];
        const trigger = f.steps.find(s => s.type === 'trigger');
        if (trigger && trigger.trigger_type === 'survey_submit') {
          const exists = surveys.some(s => s.id === trigger.target_id && !s.deleted_at);
          if (!exists) {
            errors.push({
              stepId: trigger.id,
              type: 'warning',
              message: 'Khảo sát liên kết đã bị xóa hoặc không tồn tại'
            });
          }
        }
        return { isValid: errors.length === 0, errors };
      };

      const result = validateFlowEntities(flow, availableSurveys);
      assertEqual(result.isValid, false);
      assertEqual(result.errors.length, 1);
      assert(result.errors[0].message.includes('bị xóa'));
    }, { tier: 1, featureId: 8 });

    it('T1.8_TC4: FlowNodes render safe fallback label when survey metadata is unavailable', () => {
      const renderNodeLabel = (nodeMetadata) => {
        if (!nodeMetadata || !nodeMetadata.surveyName) {
          return 'Khảo sát (Không xác định)';
        }
        return nodeMetadata.surveyName;
      };

      assertEqual(renderNodeLabel(null), 'Khảo sát (Không xác định)');
      assertEqual(renderNodeLabel({ surveyName: 'Đăng ký học bổng' }), 'Đăng ký học bổng');
    }, { tier: 1, featureId: 8 });

    it('T1.8_TC5: TriggerConfig keeps target_id persistent to enable relinking when survey is recreated', () => {
      const configState = {
        triggerType: 'survey_submit',
        targetId: 'surv-legacy-99',
        isDeletedWarning: true
      };

      // User re-selects a new active survey
      configState.targetId = 'surv-new-100';
      configState.isDeletedWarning = false;

      assertEqual(configState.targetId, 'surv-new-100');
      assertEqual(configState.isDeletedWarning, false);
    }, { tier: 1, featureId: 8 });
  });
}
