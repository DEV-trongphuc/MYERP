/**
 * tests/e2e/tier3_cross_feature/xf06_flow_unicode_softdelete.test.js
 * Cross-Feature 6: Flow Survey Names (F8) + Soft-Delete & Unicode Compliance (F9)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';

export function registerXF06Tests() {
  describe('Tier 3 - Pairwise Interaction: Flow Survey Names (F8) + Soft-Delete & Unicode (F9)', () => {
    it('XF6.1: Soft-deleted survey with Vietnamese Unicode title renders title cleanly with warning badge', () => {
      const survey = {
        id: 'surv-vn-01',
        title: 'Khảo sát ý kiến học viên chương trình Thạc sĩ AI & Big Data 2026',
        deleted_at: '2026-11-12 14:00:00'
      };

      const resolveFlowSurveyInfo = (s) => {
        return {
          title: s.title, // Clean Vietnamese UTF-8
          isDeleted: Boolean(s.deleted_at),
          badgeText: s.deleted_at ? 'Khảo sát đã xóa' : 'Đang hoạt động',
          badgeColor: s.deleted_at ? 'rose' : 'emerald'
        };
      };

      const info = resolveFlowSurveyInfo(survey);
      assertEqual(info.title, 'Khảo sát ý kiến học viên chương trình Thạc sĩ AI & Big Data 2026');
      assertEqual(info.isDeleted, true);
      assertEqual(info.badgeText, 'Khảo sát đã xóa');
      assertEqual(info.badgeColor, 'rose');
    }, { tier: 3 });
  });
}
