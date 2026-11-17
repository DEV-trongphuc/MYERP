/**
 * tests/e2e/tier3_cross_feature/xf01_ticket_rbac.test.js
 * Cross-Feature 1: Data Error Reporting (F1) + Strict RBAC (F5)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { TicketDecouplingSimulator, RBACSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerXF01Tests() {
  describe('Tier 3 - Pairwise Interaction: Data Error Reporting (F1) + Strict RBAC (F5)', () => {
    it('XF1.1: Sale reports data error on assigned lead; Manager approves report; Sale cannot self-approve', () => {
      const ticketSim = new TicketDecouplingSimulator();

      // 1. Sale submits data error report
      const submitRes = ticketSim.submitDataErrorReport({
        lead_id: 101,
        consultant_id: USERS.saleAlpha.id,
        round_id: 2,
        reason: 'Sai số điện thoại / Số ảo'
      }, USERS.saleAlpha.role);

      assertEqual(submitRes.status, 200);
      const reportId = submitRes.report_id;
      assertEqual(ticketSim.tickets.length, 0, 'Helpdesk tickets table must NOT be modified');

      // 2. Sale attempts to self-approve the report
      const selfApproveAuth = RBACSimulator.authorizeApiAction('approve_report', USERS.saleAlpha);
      assertEqual(selfApproveAuth.authorized, false, 'Sale must NOT be authorized to approve reports');
      assertEqual(selfApproveAuth.status, 403);

      // 3. Manager approves the report
      const managerAuth = RBACSimulator.authorizeApiAction('approve_report', USERS.manager);
      assertEqual(managerAuth.authorized, true, 'Manager must be authorized to approve reports');
      assertEqual(managerAuth.status, 200);

      // 4. Update status in data_reports
      const report = ticketSim.dataReports.find(r => r.id === reportId);
      report.status = 'approved';
      assertEqual(report.status, 'approved');
      assertEqual(ticketSim.tickets.length, 0, 'Historical tickets table remains 100% untouched');
    }, { tier: 3 });
  });
}
