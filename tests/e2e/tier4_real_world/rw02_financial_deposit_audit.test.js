/**
 * tests/e2e/tier4_real_world/rw02_financial_deposit_audit.test.js
 * Real-World Scenario 2: Financial Deposit Milestone Audit & Anti-Self-Approval
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { ACIDDepositSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerRW02Tests() {
  describe('Tier 4 - Real-World Scenario 2: Financial Deposit Milestone Audit', () => {
    it('RW2.1: End-to-end multi-milestone deposit creation, approval separation of duties, and audit trail', () => {
      const depositSim = new ACIDDepositSimulator();

      // Step 1: Sale Consultant creates deposit with 2 milestones (50M + 50M)
      depositSim.createDeposit(501, USERS.saleAlpha.id, 1, [
        { id: 5011, milestone_name: 'Đợt 1 (Đặt cọc giữ chỗ 50%)', expected_amount: 50000000, status: 'pending' },
        { id: 5012, milestone_name: 'Đợt 2 (Thanh toán hoàn tất 50%)', expected_amount: 50000000, status: 'pending' }
      ]);

      // Step 2: Sale Consultant attempts to approve milestone 1 -> Anti-Self-Approval guard rejects (403)
      const selfApproval = depositSim.approveMilestone(USERS.saleAlpha, 501, 5011);
      assertEqual(selfApproval.status, 403, 'Creator must NOT be allowed to self-approve');
      assertEqual(selfApproval.success, false);

      // Step 3: Chief Accountant reviews bank statement and approves milestone 1 -> Success
      const accountantApproval = depositSim.approveMilestone(USERS.accountant, 501, 5011, 50000000);
      assertEqual(accountantApproval.status, 200);
      assertEqual(accountantApproval.success, true);
      assertEqual(accountantApproval.milestone.status, 'approved');
      assertEqual(accountantApproval.milestone.approved_by, USERS.accountant.id);

      // Step 4: Accountant creates their own expense/deposit proposal and attempts to self-approve
      depositSim.createDeposit(502, USERS.accountant.id, 1, [
        { id: 5021, milestone_name: 'Quyết toán đào tạo', expected_amount: 30000000, status: 'pending' }
      ]);

      const accountantSelfApproval = depositSim.approveMilestone(USERS.accountant, 502, 5021);
      assertEqual(accountantSelfApproval.status, 403, 'Accountant cannot self-approve own proposal');

      // Step 5: Managing Director approves the proposal -> Success
      const directorApproval = depositSim.approveMilestone(USERS.director, 502, 5021, 30000000);
      assertEqual(directorApproval.status, 200);
      assertEqual(directorApproval.milestone.status, 'approved');

      // Verify audit logs captured both approvals with correct user IDs
      assertEqual(depositSim.auditLogs.length, 2);
      assertEqual(depositSim.auditLogs[0].user_id, USERS.accountant.id);
      assertEqual(depositSim.auditLogs[1].user_id, USERS.director.id);
    }, { tier: 4 });
  });
}
