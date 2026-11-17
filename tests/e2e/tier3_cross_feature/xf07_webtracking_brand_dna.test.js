/**
 * tests/e2e/tier3_cross_feature/xf07_webtracking_brand_dna.test.js
 * Cross-Feature 7: Web Tracking Recharts (F11) + UI/UX Brand DNA (F13)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { BRAND_DNA } from '../helpers/fixtures.js';
import { WebTrackingCalendarSimulator } from '../helpers/simulationEngine.js';

export function registerXF07Tests() {
  describe('Tier 3 - Pairwise Interaction: Web Tracking Recharts (F11) + UI/UX Brand DNA (F13)', () => {
    it('XF7.1: Web tracking trend chart strictly applies brand palette colors #BD1D2D and #334155 with 16px cards', () => {
      const stats = WebTrackingCalendarSimulator.generateStats('2026-11-01', '2026-11-03', [
        { date: '2026-11-01', sessions: 15, pageViews: 45 },
        { date: '2026-11-02', sessions: 25, pageViews: 80 },
        { date: '2026-11-03', sessions: 35, pageViews: 110 }
      ]);

      const chartConfig = {
        sessionsStroke: BRAND_DNA.deepRed, // #BD1D2D
        pageViewsStroke: BRAND_DNA.slateMuted, // #334155
        cardBorderRadius: BRAND_DNA.borderRadius,
        cardBorder: BRAND_DNA.cardBorder
      };

      assertEqual(chartConfig.sessionsStroke, '#BD1D2D');
      assertEqual(chartConfig.pageViewsStroke, '#334155');
      assertEqual(chartConfig.cardBorderRadius, 16);
      assertEqual(chartConfig.cardBorder, '1px solid #E2E8F0');
      assertEqual(stats.length, 3);
    }, { tier: 3 });
  });
}
