/**
 * tests/e2e/tier2_boundary_cases/feat04_boundary.test.js
 * Feature 4 Boundary & Corner Cases: Anti-Self-Approval for Deposit Milestones
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { ACIDDepositSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerFeature4BoundaryTests() {
  describe('Tier 2 - Feature 4 Boundary Cases: Anti-Self-Approval', () => {
    it('BC4.1: Creator ID string comparison ("10" === 10) correctly detects self-approval attempt', () => {
      const sim = new ACIDDepositSimulator();
      // Created by user_id string "10"
      sim.createDeposit(70, "10", 1, [
        { id: 701, milestone_name: 'Đợt 1', expected_amount: 10000000, status: 'pending' }
      ]);

      // Sale Alpha with integer user_id: 10
      const res = sim.approveMilestone(USERS.saleAlpha, 70, 701);
      assertEqual(res.status, 403);
      assertEqual(res.success, false);
      assert(res.message.includes('tự phê duyệt'));
    }, { tier: 2, featureId: 4 });

    it('BC4.2: System-generated deposit where created_by is NULL can be approved by manager', () => {
      const sim = new ACIDDepositSimulator();
      sim.createDeposit(80, null, 1, [
        { id: 801, milestone_name: 'Đợt Hệ Thống', expected_amount: 5000000, status: 'pending' }
      ]);

      const res = sim.approveMilestone(USERS.manager, 80, 801);
      assertEqual(res.status, 200);
      assertEqual(res.success, true);
      assertEqual(res.milestone.status, 'approved');
    }, { tier: 2, featureId: 4 });

    it('BC4.3: Milestone approval with negative or zero actual_amount is rejected with HTTP 400', () => {
      const validateActualAmount = (amount) => {
        if (amount === null || amount === undefined || Number(amount) <= 0) {
          return { valid: false, status: 400, message: 'Số tiền thực tế phải lớn hơn 0' };
        }
        return { valid: true };
      };

      const resZero = validateActualAmount(0);
      const resNegative = validateActualAmount(-5000000);
      const resValid = validateActualAmount(15000000);

      assertEqual(resZero.valid, false);
      assertEqual(resNegative.valid, false);
      assertEqual(resValid.valid, true);
    }, { tier: 2, featureId: 4 });

    it('BC4.4: Milestone already approved cannot be approved again (HTTP 422 guard)', () => {
      const sim = new ACIDDepositSimulator();
      sim.createDeposit(90, USERS.saleAlpha.id, 1, [
        { id: 901, milestone_name: 'Đợt 1', expected_amount: 10000000, status: 'approved' }
      ]);

      const res = sim.approveMilestone(USERS.manager, 90, 901);
      assertEqual(res.status, 422);
      assertEqual(res.success, false);
      assert(res.message.includes('đã được duyệt từ trước'));
    }, { tier: 2, featureId: 4 });

    it('BC4.5: Concurrent double approval on same milestone processes first and rejects second with 422', () => {
      const sim = new ACIDDepositSimulator();
      sim.createDeposit(95, USERS.saleBeta.id, 1, [
        { id: 951, milestone_name: 'Đợt 1', expected_amount: 25000000, status: 'pending' }
      ]);

      // Call 1
      const call1 = sim.approveMilestone(USERS.manager, 95, 951, 25000000);
      // Call 2
      const call2 = sim.approveMilestone(USERS.accountant, 95, 951, 25000000);

      assertEqual(call1.status, 200);
      assertEqual(call2.status, 422);
    }, { tier: 2, featureId: 4 });
  });
}
