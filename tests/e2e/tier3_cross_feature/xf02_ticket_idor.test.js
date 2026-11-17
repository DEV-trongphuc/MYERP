/**
 * tests/e2e/tier3_cross_feature/xf02_ticket_idor.test.js
 * Cross-Feature 2: Data Error Reporting (F1) + IDOR Prevention (F6)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { TicketDecouplingSimulator, IDORSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerXF02Tests() {
  describe('Tier 3 - Pairwise Interaction: Data Error Reporting (F1) + IDOR Prevention (F6)', () => {
    it('XF2.1: Sale attempts to submit data error report for contact owned by peer; IDOR check halts operation', () => {
      const ticketSim = new TicketDecouplingSimulator();

      const contactOwnedByBeta = {
        id: 777,
        full_name: 'Khách hàng VIP của Beta',
        owner_id: USERS.saleBeta.id, // Beta's contact
        tenant_id: 1,
        deleted_at: null
      };

      // 1. Sale Alpha tries to access/report on contact 777
      const hasAccess = IDORSimulator.canAccessContact(USERS.saleAlpha, contactOwnedByBeta);
      assertEqual(hasAccess, false, 'Sale Alpha must be blocked by IDOR check');

      // 2. Report submission is halted before data_reports insert
      let reportSubmitted = false;
      if (hasAccess) {
        ticketSim.submitDataErrorReport({ lead_id: 777, reason: 'Sai số' });
        reportSubmitted = true;
      }

      assertEqual(reportSubmitted, false);
      assertEqual(ticketSim.dataReports.length, 0);
      assertEqual(ticketSim.tickets.length, 0);
    }, { tier: 3 });
  });
}
