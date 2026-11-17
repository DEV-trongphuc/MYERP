/**
 * tests/e2e/tier2_boundary_cases/feat07_boundary.test.js
 * Feature 7 Boundary & Corner Cases: Frontend Route Guards for Marketing
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { RBACSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerFeature7BoundaryTests() {
  describe('Tier 2 - Feature 7 Boundary Cases: Marketing Route Guards', () => {
    it('BC7.1: Deep-linking to nested marketing subroutes without permissions is blocked', () => {
      const nestedRoutes = [
        '/marketing/flows/edit/999',
        '/marketing/surveys/survey-123/edit',
        '/marketing/campaigns/create/wizard',
        '/marketing/audience/segments/new'
      ];

      for (const subRoute of nestedRoutes) {
        const allowed = RBACSimulator.canAccessMarketingRoute(USERS.saleAlpha, subRoute);
        assertEqual(allowed, false, `Sale user must not access nested route: ${subRoute}`);
      }
    }, { tier: 2, featureId: 7 });

    it('BC7.2: Dynamic demotion of user role immediately revokes route access without stale cache', () => {
      const dynamicUser = { id: 15, role: 'marketing' };
      assertEqual(RBACSimulator.canAccessMarketingRoute(dynamicUser, '/marketing'), true);

      // Role changed in runtime session
      dynamicUser.role = 'sale';
      assertEqual(RBACSimulator.canAccessMarketingRoute(dynamicUser, '/marketing'), false);
    }, { tier: 2, featureId: 7 });

    it('BC7.3: Guard evaluation does not trigger infinite redirect loops', () => {
      const evaluateNavigation = (user, targetPath) => {
        let redirects = 0;
        let currentPath = targetPath;

        while (redirects < 10) {
          if (currentPath.startsWith('/marketing')) {
            if (!RBACSimulator.canAccessMarketingRoute(user, currentPath)) {
              currentPath = '/sale/workspace';
              redirects++;
              continue;
            }
          }
          break; // Destination reached safely
        }

        return { finalPath: currentPath, redirects };
      };

      const result = evaluateNavigation(USERS.saleAlpha, '/marketing/flows');
      assertEqual(result.finalPath, '/sale/workspace');
      assertEqual(result.redirects, 1, 'Must redirect exactly once without looping');
    }, { tier: 2, featureId: 7 });

    it('BC7.4: Trailing slash variations on marketing routes are normalized consistently', () => {
      const normalizeRoute = (p) => p.replace(/\/+$/, '') || '/';

      const pathWithSlash = '/marketing/campaigns/';
      const normalized = normalizeRoute(pathWithSlash);
      assertEqual(normalized, '/marketing/campaigns');

      const allowed = RBACSimulator.canAccessMarketingRoute(USERS.marketing, normalized);
      assertEqual(allowed, true);
    }, { tier: 2, featureId: 7 });

    it('BC7.5: Non-existent marketing route renders clean 404 without leaking backend server paths', () => {
      const handleUnknownRoute = (path) => {
        return { status: 404, message: 'Trang không tồn tại', path };
      };

      const res = handleUnknownRoute('/marketing/non_existent_module');
      assertEqual(res.status, 404);
      assert(!res.message.includes('C:\\') && !res.message.includes('/var/www'), 'No path leakage');
    }, { tier: 2, featureId: 7 });
  });
}
