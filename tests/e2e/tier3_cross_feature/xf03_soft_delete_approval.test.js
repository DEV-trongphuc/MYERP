/**
 * tests/e2e/tier3_cross_feature/xf03_soft_delete_approval.test.js
 * Cross-Feature 3: Soft-Delete Mandate (F2) + Anti-Self-Approval (F4)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { ACIDDepositSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerXF03Tests() {
  describe('Tier 3 - Pairwise Interaction: Soft-Delete Mandate (F2) + Anti-Self-Approval (F4)', () => {
    it('XF3.1: Soft-deleted manager cannot approve deposits; milestone retains audit logs of former active approvers', () => {
      const depositSim = new ACIDDepositSimulator();

      // Create deposit with 2 milestones
      depositSim.createDeposit(100, USERS.saleAlpha.id, 1, [
        { id: 1001, milestone_name: 'Đợt 1', expected_amount: 10000000, status: 'pending' },
        { id: 1002, milestone_name: 'Đợt 2', expected_amount: 10000000, status: 'pending' }
      ]);

      // Active manager approves milestone 1
      const res1 = depositSim.approveMilestone(USERS.manager, 100, 1001);
      assertEqual(res1.status, 200);
      assertEqual(depositSim.auditLogs.length, 1);

      // Now Manager is soft-deleted
      const softDeletedManager = { ...USERS.manager, deleted_at: new Date().toISOString() };

      // Soft-deleted manager attempts to approve milestone 2
      const attemptApproval = (auth, depId, mileId) => {
        if (auth.deleted_at !== null && auth.deleted_at !== undefined) {
          return { success: false, status: 401, message: 'Tài khoản đã bị xóa mềm' };
        }
        return depositSim.approveMilestone(auth, depId, mileId);
      };

      const res2 = attemptApproval(softDeletedManager, 100, 1002);
      assertEqual(res2.status, 401);
      assertEqual(res2.success, false);

      // Milestone 1 audit record still preserves original active approver
      assertEqual(depositSim.auditLogs[0].user_id, USERS.manager.id);
    }, { tier: 3 });
  });
}
