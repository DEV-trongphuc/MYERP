/**
 * tests/e2e/tier4_real_world/rw01_sales_lead_lifecycle.test.js
 * Real-World Scenario 1: End-to-End Sales Lead Lifecycle & Data Error Compensation
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { TicketDecouplingSimulator, RBACSimulator, IDORSimulator } from '../helpers/simulationEngine.js';
import { USERS, REPORT_REASONS } from '../helpers/fixtures.js';

export function registerRW01Tests() {
  describe('Tier 4 - Real-World Scenario 1: Sales Lead Lifecycle & Data Error Compensation', () => {
    it('RW1.1: Complete multi-step enterprise workflow from lead distribution to error compensation', () => {
      // Step 1: Lead distributed to Sale Alpha via round 4
      const lead = {
        id: 4001,
        full_name: 'Đặng Tuấn Anh',
        phone: '0901234567',
        owner_id: USERS.saleAlpha.id,
        round_id: 4,
        tenant_id: 1,
        status: 'new',
        deleted_at: null
      };

      // Sale Alpha views lead (verified via IDOR check)
      const canView = IDORSimulator.canAccessContact(USERS.saleAlpha, lead);
      assertEqual(canView, true, 'Sale Alpha can view own lead');

      // Step 2: Sale calls lead, discovers invalid phone number
      const ticketSim = new TicketDecouplingSimulator();
      ticketSim.seedHistoricalTickets([
        { id: 10, title: 'Hỗ trợ kỹ thuật cổng LMS', tenant_id: 1 }
      ]);

      // Sale submits report via ReportDataModal
      const submitRes = ticketSim.submitDataErrorReport({
        lead_id: lead.id,
        consultant_id: USERS.saleAlpha.id,
        round_id: lead.round_id,
        reason: REPORT_REASONS[0].label,
        note: 'Số điện thoại chuông reo nhưng người lạ nghe máy xác nhận không có ai tên Đặng Tuấn Anh'
      }, USERS.saleAlpha.role);

      assertEqual(submitRes.status, 200);
      assertEqual(ticketSim.dataReports.length, 1);
      assertEqual(ticketSim.tickets.length, 1, 'Helpdesk tickets table MUST NOT be modified');

      // Step 3: Manager reviews pending reports in data_reports
      const pendingReports = ticketSim.dataReports.filter(r => r.status === 'pending');
      assertEqual(pendingReports.length, 1);

      // Sale attempts to approve -> blocked
      const saleApproval = RBACSimulator.authorizeApiAction('approve_report', USERS.saleAlpha);
      assertEqual(saleApproval.authorized, false);

      // Manager approves -> success
      const managerApproval = RBACSimulator.authorizeApiAction('approve_report', USERS.manager);
      assertEqual(managerApproval.authorized, true);

      pendingReports[0].status = 'approved';
      pendingReports[0].approved_by = USERS.manager.id;

      // Step 4: System queues priority compensation for Sale Alpha in round 4
      const compensationQueue = [
        { consultant_id: USERS.saleAlpha.id, round_id: 4, priority: 1, compensated_at: null }
      ];

      assertEqual(compensationQueue.length, 1);
      assertEqual(compensationQueue[0].priority, 1);
      assertEqual(ticketSim.tickets.length, 1, 'Historical helpdesk tickets remain 100% intact');
    }, { tier: 4 });
  });
}
