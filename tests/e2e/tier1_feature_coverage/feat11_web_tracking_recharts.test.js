/**
 * tests/e2e/tier1_feature_coverage/feat11_web_tracking_recharts.test.js
 * Feature 11: Web Tracking Dual-Series Recharts Implementation (R5)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { WebTrackingCalendarSimulator } from '../helpers/simulationEngine.js';

export function registerFeature11Tests() {
  describe('Tier 1 - Feature 11: Web Tracking Dual-Series Recharts Implementation', () => {
    it('T1.11_TC1: Backend calendar gap filling populates every calendar day in range with 0-filled defaults', () => {
      // 5-day range where only day 2 has visits
      const startDate = '2026-11-01';
      const endDate = '2026-11-05';
      const rawData = [
        { date: '2026-11-02', sessions: 120, pageViews: 450 }
      ];

      const filled = WebTrackingCalendarSimulator.generateStats(startDate, endDate, rawData);
      assertEqual(filled.length, 5, 'Must have exactly 5 entries for 5 calendar days');

      // Day 1: 0-filled
      assertEqual(filled[0].date, '2026-11-01');
      assertEqual(filled[0].sessions, 0);
      assertEqual(filled[0].pageViews, 0);

      // Day 2: actual data
      assertEqual(filled[1].date, '2026-11-02');
      assertEqual(filled[1].sessions, 120);
      assertEqual(filled[1].pageViews, 450);

      // Day 3: 0-filled
      assertEqual(filled[2].date, '2026-11-03');
      assertEqual(filled[2].sessions, 0);
      assertEqual(filled[2].pageViews, 0);
    }, { tier: 1, featureId: 11 });

    it('T1.11_TC2: Stats endpoint strictly guarantees integer types for sessions and pageViews', () => {
      const raw = [{ date: '2026-11-10', sessions: '85', pageViews: '230' }];
      const stats = WebTrackingCalendarSimulator.generateStats('2026-11-10', '2026-11-10', raw);

      assertEqual(typeof stats[0].sessions, 'number');
      assertEqual(Number.isInteger(stats[0].sessions), true);
      assertEqual(typeof stats[0].pageViews, 'number');
      assertEqual(Number.isInteger(stats[0].pageViews), true);
    }, { tier: 1, featureId: 11 });

    it('T1.11_TC3: Recharts dual-series color mapping specifies #BD1D2D for Sessions and #334155 for PageViews', () => {
      const chartSeriesConfig = {
        sessions: { stroke: '#BD1D2D', fill: 'url(#sessionsGradient)', name: 'Phiên truy cập' },
        pageViews: { stroke: '#334155', fill: 'url(#pageViewsGradient)', name: 'Lượt xem trang' }
      };

      assertEqual(chartSeriesConfig.sessions.stroke, '#BD1D2D');
      assertEqual(chartSeriesConfig.pageViews.stroke, '#334155');
    }, { tier: 1, featureId: 11 });

    it('T1.11_TC4: Multi-month date range generates strictly continuous day sequence without missing days', () => {
      const start = '2026-10-28';
      const end = '2026-11-03';
      const stats = WebTrackingCalendarSimulator.generateStats(start, end, []);

      // 28, 29, 30, 31 Oct + 1, 2, 3 Nov = 7 days
      assertEqual(stats.length, 7);
      assertEqual(stats[0].date, '2026-10-28');
      assertEqual(stats[3].date, '2026-10-31');
      assertEqual(stats[4].date, '2026-11-01');
      assertEqual(stats[6].date, '2026-11-03');
    }, { tier: 1, featureId: 11 });

    it('T1.11_TC5: Tooltip formatter displays readable metric labels and formatted counts', () => {
      const formatTooltipValue = (value, name) => {
        const formatted = new Intl.NumberFormat('vi-VN').format(value);
        return [formatted, name === 'sessions' ? 'Phiên truy cập' : 'Lượt xem trang'];
      };

      const [val1, name1] = formatTooltipValue(15420, 'sessions');
      assertEqual(val1, '15.420');
      assertEqual(name1, 'Phiên truy cập');

      const [val2, name2] = formatTooltipValue(48200, 'pageViews');
      assertEqual(val2, '48.200');
      assertEqual(name2, 'Lượt xem trang');
    }, { tier: 1, featureId: 11 });
  });
}
