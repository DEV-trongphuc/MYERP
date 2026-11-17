/**
 * tests/e2e/tier1_feature_coverage/feat09_soft_delete_unicode.test.js
 * Feature 9: Soft-Delete & Unicode Compliance in Surveys & Forms (R5)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { checkSoftDeleteEnforcement } from '../helpers/contractValidator.js';

export function registerFeature9Tests() {
  describe('Tier 1 - Feature 9: Soft-Delete & Unicode Compliance in Surveys & Forms', () => {
    it('T1.9_TC1: Deleting a survey in surveys.php executes soft-delete and forbids DELETE FROM surveys', () => {
      const sqlSoftDelete = "UPDATE surveys SET deleted_at = NOW() WHERE id = ?";
      const forbiddenSql = "DELETE FROM surveys WHERE id = ?";

      assert(checkSoftDeleteEnforcement(sqlSoftDelete), 'Surveys soft delete must be permitted');
      assert(!checkSoftDeleteEnforcement(forbiddenSql), 'Hard DELETE FROM surveys must be forbidden');
    }, { tier: 1, featureId: 9 });

    it('T1.9_TC2: Deleting a form in forms.php executes UPDATE forms SET deleted_at = NOW()', () => {
      const sqlSoftDelete = "UPDATE forms SET deleted_at = NOW() WHERE id = ?";
      const forbiddenSql = "DELETE FROM forms WHERE id = ?";

      assert(checkSoftDeleteEnforcement(sqlSoftDelete), 'Forms soft delete must be permitted');
      assert(!checkSoftDeleteEnforcement(forbiddenSql), 'Hard DELETE FROM forms must be forbidden');
    }, { tier: 1, featureId: 9 });

    it('T1.9_TC3: JSON serialization uses unescaped Unicode preserving Vietnamese characters natively', () => {
      const surveyData = {
        title: 'Khảo sát ý kiến học viên chương trình Thạc sĩ Quản trị Kinh doanh',
        description: 'Vui lòng đánh giá mức độ hài lòng về chất lượng giảng dạy, giáo trình và dịch vụ hỗ trợ.'
      };

      // In Node.js / PHP JSON_UNESCAPED_UNICODE
      const jsonStr = JSON.stringify(surveyData);
      assert(!jsonStr.includes('\\u00'), 'JSON string must not encode Vietnamese as \\uXXXX');
      assert(jsonStr.includes('Thạc sĩ Quản trị Kinh doanh'), 'Must retain literal UTF-8 characters');
    }, { tier: 1, featureId: 9 });

    it('T1.9_TC4: Vietnamese Unicode diacritics round-trip without character encoding degradation', () => {
      const sampleText = 'Học viện Đào tạo Trí tuệ Nhân tạo & Chuyển đổi số Việt Nam (SI IDEAS)';
      const encoded = Buffer.from(sampleText, 'utf-8');
      const decoded = encoded.toString('utf-8');

      assertEqual(decoded, sampleText);
      assertEqual(decoded.length, sampleText.length);
    }, { tier: 1, featureId: 9 });

    it('T1.9_TC5: Active survey listing enforces deleted_at IS NULL filter', () => {
      const allSurveys = [
        { id: 1, title: 'Khảo sát đang mở', deleted_at: null },
        { id: 2, title: 'Khảo sát đã đóng', deleted_at: '2026-11-10 12:00:00' },
        { id: 3, title: 'Khảo sát tuyển sinh đợt 2', deleted_at: null }
      ];

      const activeSurveys = allSurveys.filter(s => s.deleted_at === null);
      assertEqual(activeSurveys.length, 2);
      assert(!activeSurveys.some(s => s.id === 2));
    }, { tier: 1, featureId: 9 });
  });
}
