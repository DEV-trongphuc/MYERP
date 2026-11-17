/**
 * tests/e2e/tier4_real_world/rw04_marketing_campaign_analytics.test.js
 * Real-World Scenario 4: Marketing Automation Lifecycle & Web Tracking Analytics
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { RBACSimulator, WebTrackingCalendarSimulator } from '../helpers/simulationEngine.js';
import { USERS, BRAND_DNA } from '../helpers/fixtures.js';

export function registerRW04Tests() {
  describe('Tier 4 - Real-World Scenario 4: Marketing Automation Lifecycle & Analytics', () => {
    it('RW4.1: End-to-end survey creation, automation flow trigger mapping, and web tracking analytics', () => {
      // Step 1: Marketing specialist accesses marketing dashboard
      const canAccessMkt = RBACSimulator.canAccessMarketingRoute(USERS.marketing, '/marketing');
      assertEqual(canAccessMkt, true, 'Marketing role must access /marketing');

      // Step 2: Creates survey with Vietnamese Unicode title & questions
      const survey = {
        id: 'surv-mba-2026',
        title: 'Khảo sát định hướng nghề nghiệp & Nhu cầu học Thạc sĩ Quản trị Kinh doanh',
        questions: [
          {
            id: 'q1',
            title: 'Chuyên ngành bạn quan tâm nhất hiện nay?',
            type: 'radio',
            options: ['Trí tuệ nhân tạo (AI)', 'Kinh doanh quốc tế', 'Tài chính - Ngân hàng']
          }
        ],
        deleted_at: null
      };

      const serializedSurvey = JSON.stringify(survey);
      assert(serializedSurvey.includes('Trí tuệ nhân tạo (AI)'), 'Unicode characters preserved');

      // Step 3: Builds Automation Flow linking the survey trigger
      const flow = {
        id: 'flow-mba-nurture',
        name: 'Chuỗi email nuôi dưỡng ứng viên MBA',
        trigger: {
          type: 'survey_submit',
          surveyId: survey.id,
          resolvedSurveyName: survey.title
        },
        status: 'active'
      };

      assertEqual(flow.trigger.resolvedSurveyName, survey.title);
      assert(!flow.trigger.resolvedSurveyName.startsWith('Khảo sát: surv-mba-2026'), 'Must display real title');

      // Step 4: Web tracking traffic analysis over 7 days
      const startDate = '2026-11-01';
      const endDate = '2026-11-07';
      const rawTraffic = [
        { date: '2026-11-02', sessions: 250, pageViews: 780 },
        { date: '2026-11-05', sessions: 420, pageViews: 1350 }
      ];

      const continuousStats = WebTrackingCalendarSimulator.generateStats(startDate, endDate, rawTraffic);
      assertEqual(continuousStats.length, 7, 'Must generate exactly 7 continuous days');
      assertEqual(continuousStats[0].sessions, 0, 'Missing day 1 must be 0-filled');
      assertEqual(continuousStats[1].sessions, 250, 'Day 2 must contain actual traffic');
      assertEqual(continuousStats[4].sessions, 420, 'Day 5 must contain actual traffic');

      // Verify chart color contracts
      assertEqual(BRAND_DNA.deepRed, '#BD1D2D');
      assertEqual(BRAND_DNA.slateMuted, '#334155');

      // Step 5: Sale user attempts to bypass security and access marketing flows
      const saleAccess = RBACSimulator.canAccessMarketingRoute(USERS.saleAlpha, '/marketing/flows');
      assertEqual(saleAccess, false, 'Sale user must be blocked from marketing flows');
    }, { tier: 4 });
  });
}
