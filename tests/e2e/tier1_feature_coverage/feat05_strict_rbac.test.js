/**
 * tests/e2e/tier1_feature_coverage/feat05_strict_rbac.test.js
 * Feature 5: Enforce Strict RBAC in backend/api.php (R2)
 */

import { describe, it, assertEqual } from '../helpers/testHarness.js';
import { RBACSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerFeature5Tests() {
  describe('Tier 1 - Feature 5: Enforce Strict RBAC in backend/api.php', () => {
    it('T1.5_TC1: approve_report is strictly rejected with HTTP 403 for sale and consultant roles', () => {
      const resSale = RBACSimulator.authorizeApiAction('approve_report', USERS.saleAlpha);
      assertEqual(resSale.status, 403);
      assertEqual(resSale.authorized, false);

      const resConsultant = RBACSimulator.authorizeApiAction('approve_report', { id: 12, role: 'consultant' });
      assertEqual(resConsultant.status, 403);
      assertEqual(resConsultant.authorized, false);
    }, { tier: 1, featureId: 5 });

    it('T1.5_TC2: reject_report is rejected with HTTP 403 for unauthorized callers', () => {
      const res = RBACSimulator.authorizeApiAction('reject_report', USERS.saleBeta);
      assertEqual(res.status, 403);
      assertEqual(res.authorized, false);
    }, { tier: 1, featureId: 5 });

    it('T1.5_TC3: reassign_lead and block_lead actions are allowed for whitelisted management roles', () => {
      const allowedUsers = [USERS.admin, USERS.superAdmin, USERS.director, USERS.manager, USERS.marketing];
      for (const u of allowedUsers) {
        const resReassign = RBACSimulator.authorizeApiAction('reassign_lead', u);
        assertEqual(resReassign.status, 200, `Role ${u.role} should be authorized for reassign_lead`);

        const resBlock = RBACSimulator.authorizeApiAction('block_lead', u);
        assertEqual(resBlock.status, 200, `Role ${u.role} should be authorized for block_lead`);
      }
    }, { tier: 1, featureId: 5 });

    it('T1.5_TC4: compensate_approved_no_comp is strictly forbidden for non-management roles', () => {
      const res = RBACSimulator.authorizeApiAction('compensate_approved_no_comp', USERS.saleAlpha);
      assertEqual(res.status, 403);
      assertEqual(res.authorized, false);
    }, { tier: 1, featureId: 5 });

    it('T1.5_TC5: update_lead_fields restricts administrative overrides from sale callers', () => {
      const res = RBACSimulator.authorizeApiAction('update_lead_fields', USERS.saleBeta);
      assertEqual(res.status, 403);
      assertEqual(res.authorized, false);

      const resAdmin = RBACSimulator.authorizeApiAction('update_lead_fields', USERS.admin);
      assertEqual(resAdmin.status, 200);
      assertEqual(resAdmin.authorized, true);
    }, { tier: 1, featureId: 5 });
  });
}
