/**
 * tests/e2e/tier3_cross_feature/xf05_rbac_route_guards.test.js
 * Cross-Feature 5: Strict RBAC (F5) + Marketing Route Guards (F7)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { RBACSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerXF05Tests() {
  describe('Tier 3 - Pairwise Interaction: Strict RBAC (F5) + Route Guards (F7)', () => {
    it('XF5.1: Multi-layer defense blocks unauthorized sale user at both UI route guard and backend API', () => {
      // Layer 1: Frontend Route Guard
      const uiRouteBlocked = !RBACSimulator.canAccessMarketingRoute(USERS.saleAlpha, '/marketing/campaigns');
      assertEqual(uiRouteBlocked, true, 'UI route guard must reject sale user');

      // Layer 2: Backend API Guard
      const backendApiBlocked = !RBACSimulator.authorizeApiAction('reassign_lead', USERS.saleAlpha).authorized;
      assertEqual(backendApiBlocked, true, 'Backend API must reject sale user');

      // Both layers enforce consistent enterprise security posture
      assert(uiRouteBlocked && backendApiBlocked, 'Both layers must synchronously reject unauthorized roles');
    }, { tier: 3 });
  });
}
