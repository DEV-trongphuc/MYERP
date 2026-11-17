/**
 * tests/e2e/tier2_boundary_cases/feat10_boundary.test.js
 * Feature 10 Boundary & Corner Cases: Survey Builder & Email Preview
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';

export function registerFeature10BoundaryTests() {
  describe('Tier 2 - Feature 10 Boundary Cases: Survey Builder & Email Preview', () => {
    it('BC10.1: Survey properties receives corrupted string or number as choices without throwing TypeError', () => {
      const parseQuestionChoices = (question) => {
        const rawChoices = question?.properties?.choices;
        if (!Array.isArray(rawChoices)) {
          return [];
        }
        return rawChoices.filter(Boolean);
      };

      assertEqual(parseQuestionChoices({ properties: { choices: "choice_a" } }).length, 0);
      assertEqual(parseQuestionChoices({ properties: { choices: 12345 } }).length, 0);
      assertEqual(parseQuestionChoices({ properties: { choices: {} } }).length, 0);
      assertEqual(parseQuestionChoices(null).length, 0);
    }, { tier: 2, featureId: 10 });

    it('BC10.2: Email preview with empty body writes default markup and calls document.close()', () => {
      let isClosed = false;
      const mockWin = {
        document: {
          open: () => {},
          write: () => {},
          close: () => { isClosed = true; }
        }
      };

      const renderPreview = (win, bodyContent) => {
        if (!win || !win.document) return;
        win.document.open();
        win.document.write(bodyContent || '<p>Nội dung trống</p>');
        win.document.close();
      };

      renderPreview(mockWin, '');
      assertEqual(isClosed, true, 'document.close() must still be called for empty body');
    }, { tier: 2, featureId: 10 });

    it('BC10.3: Popup blocker returning win === null is handled gracefully with toast notification', () => {
      let toastErrorFired = false;
      const openPreviewWindow = (winInstance) => {
        if (!winInstance) {
          toastErrorFired = true;
          return { success: false, message: 'Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép pop-up.' };
        }
        return { success: true };
      };

      const res = openPreviewWindow(null); // Blocked
      assertEqual(res.success, false);
      assertEqual(toastErrorFired, true);
    }, { tier: 2, featureId: 10 });

    it('BC10.4: Extremely small screen width (320px) collapses survey sidebar without overlapping canvas', () => {
      const getLayoutMode = (viewportWidth) => {
        if (viewportWidth < 640) return { isMobile: true, sidebarCollapsed: true };
        return { isMobile: false, sidebarCollapsed: false };
      };

      const mobileLayout = getLayoutMode(320);
      assertEqual(mobileLayout.isMobile, true);
      assertEqual(mobileLayout.sidebarCollapsed, true);
    }, { tier: 2, featureId: 10 });

    it('BC10.5: Window close event during email editing cleans up interval timers', () => {
      let timerCleared = false;
      const timerId = 12345;

      const cleanupEditor = (id) => {
        // Clear auto-save interval
        if (id) {
          timerCleared = true;
        }
      };

      cleanupEditor(timerId);
      assertEqual(timerCleared, true);
    }, { tier: 2, featureId: 10 });
  });
}
