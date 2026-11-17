/**
 * tests/e2e/tier1_feature_coverage/feat04_anti_self_approval.test.js
 * Feature 4: Anti-Self-Approval for Deposit Milestones (R1)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { ACIDDepositSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerFeature4Tests() {
  describe('Tier 1 - Feature 4: Anti-Self-Approval for Deposit Milestones', () => {
    it('T1.4_TC1: Non-admin creator attempting to self-approve own deposit milestone is rejected with HTTP 403', () => {
      const sim = new ACIDDepositSimulator();
      // Created by Accountant (user_id: 6)
      sim.createDeposit(10, USERS.accountant.id, 1, [
        { id: 101, milestone_name: 'Đợt 1', expected_amount: 15000000, status: 'pending' }
      ]);

      // Accountant attempts to self-approve
      const res = sim.approveMilestone(USERS.accountant, 10, 101);
      assertEqual(res.status, 403);
      assertEqual(res.success, false);
      assert(res.message.includes('tự phê duyệt'), 'Must state self-approval violation');
    }, { tier: 1, featureId: 4 });

    it('T1.4_TC2: Super admin or director role is permitted to approve milestone even if created by them', () => {
      const sim = new ACIDDepositSimulator();
      // Created by Super Admin (user_id: 1)
      sim.createDeposit(20, USERS.superAdmin.id, 1, [
        { id: 201, milestone_name: 'Đợt 1', expected_amount: 50000000, status: 'pending' }
      ]);

      // Super Admin approves
      const res = sim.approveMilestone(USERS.superAdmin, 20, 201);
      assertEqual(res.status, 200);
      assertEqual(res.success, true);
      assertEqual(res.milestone.status, 'approved');
    }, { tier: 1, featureId: 4 });

    it('T1.4_TC3: Peer manager or distinct authorized user can approve milestone created by another user', () => {
      const sim = new ACIDDepositSimulator();
      // Created by Sale Alpha (user_id: 10)
      sim.createDeposit(30, USERS.saleAlpha.id, 1, [
        { id: 301, milestone_name: 'Đợt 1', expected_amount: 20000000, status: 'pending' }
      ]);

      // Approved by Manager (user_id: 4)
      const res = sim.approveMilestone(USERS.manager, 30, 301);
      assertEqual(res.status, 200);
      assertEqual(res.success, true);
      assertEqual(res.milestone.approved_by, USERS.manager.id);
    }, { tier: 1, featureId: 4 });

    it('T1.4_TC4: Milestone approval atomically transitions state from pending to approved', () => {
      const sim = new ACIDDepositSimulator();
      sim.createDeposit(40, USERS.saleBeta.id, 1, [
        { id: 401, milestone_name: 'Đợt 2', expected_amount: 10000000, status: 'pending' }
      ]);

      const res = sim.approveMilestone(USERS.admin, 40, 401, 10000000);
      assertEqual(res.status, 200);
      assertEqual(res.milestone.status, 'approved');
      assertEqual(res.milestone.actual_amount, 10000000);
    }, { tier: 1, featureId: 4 });

    it('T1.4_TC5: Audit log captures milestone approval event with approver ID and timestamp', () => {
      const sim = new ACIDDepositSimulator();
      sim.createDeposit(50, USERS.saleAlpha.id, 1, [
        { id: 501, milestone_name: 'Đợt 1', expected_amount: 5000000, status: 'pending' }
      ]);

      sim.approveMilestone(USERS.director, 50, 501);
      assertEqual(sim.auditLogs.length, 1);
      assertEqual(sim.auditLogs[0].action, 'milestone_approved');
      assertEqual(sim.auditLogs[0].user_id, USERS.director.id);
      assert(Boolean(sim.auditLogs[0].timestamp));
    }, { tier: 1, featureId: 4 });
  });
}
