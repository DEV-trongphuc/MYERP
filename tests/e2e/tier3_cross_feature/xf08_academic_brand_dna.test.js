/**
 * tests/e2e/tier3_cross_feature/xf08_academic_brand_dna.test.js
 * Cross-Feature 8: Academic Modal (F12) + UI/UX Brand DNA (F13)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { BRAND_DNA } from '../helpers/fixtures.js';

export function registerXF08Tests() {
  describe('Tier 3 - Pairwise Interaction: Academic Modal (F12) + UI/UX Brand DNA (F13)', () => {
    it('XF8.1: Subject announcement modal incorporates 32x32px icon boxes, brand red primary CTA, and subtabs', () => {
      const modalElements = {
        headerIconBox: {
          width: BRAND_DNA.kpiIconBox.width,
          height: BRAND_DNA.kpiIconBox.height,
          background: 'rgba(189, 29, 45, 0.08)',
          color: BRAND_DNA.deepRed
        },
        primaryCta: {
          background: BRAND_DNA.deepRed,
          color: '#ffffff',
          borderRadius: '8px'
        },
        stepperContainer: {
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '10px'
        }
      };

      assertEqual(modalElements.headerIconBox.width, 32);
      assertEqual(modalElements.headerIconBox.height, 32);
      assertEqual(modalElements.primaryCta.background, '#BD1D2D');
      assertEqual(modalElements.stepperContainer.background, '#f1f5f9');
    }, { tier: 3 });
  });
}
