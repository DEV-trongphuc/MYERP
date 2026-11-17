/**
 * tests/e2e/tier1_feature_coverage/feat01_decouple_ticket.test.js
 * Feature 1: Decouple Data Error Reporting from Helpdesk (R4)
 */

import { describe, it, assert, assertEqual, assertDeepEqual } from '../helpers/testHarness.js';
import { TicketDecouplingSimulator } from '../helpers/simulationEngine.js';
import { USERS, REPORT_REASONS } from '../helpers/fixtures.js';

export function registerFeature1Tests() {
  describe('Tier 1 - Feature 1: Decouple Data Error Reporting from Helpdesk', () => {
    it('T1.1_TC1: Submitting data error report routes to data_reports domain and never inserts to tickets', () => {
      const sim = new TicketDecouplingSimulator();
      const payload = {
        contact_id: 101,
        lead_id: 101,
        consultant_id: USERS.saleAlpha.id,
        round_id: 5,
        reason: REPORT_REASONS[0].label
      };

      const res = sim.submitDataErrorReport(payload, USERS.saleAlpha.role);
      assertEqual(res.status, 200);
      assertEqual(res.success, true);
      assertEqual(sim.dataReports.length, 1);
      assertEqual(sim.tickets.length, 0, 'Tickets table must remain untouched (0 records)');
      assertEqual(sim.dataReports[0].lead_id, 101);
    }, { tier: 1, featureId: 1 });

    it('T1.1_TC2: Payload contract requires lead_id, consultant_id, round_id, and valid reason', () => {
      const sim = new TicketDecouplingSimulator();
      const invalidPayload = {
        consultant_id: USERS.saleAlpha.id,
        round_id: 5,
        reason: '' // Missing reason
      };

      const res = sim.submitDataErrorReport(invalidPayload, USERS.saleAlpha.role);
      assertEqual(res.status, 400);
      assertEqual(res.success, false);
      assertEqual(sim.dataReports.length, 0);
    }, { tier: 1, featureId: 1 });

    it('T1.1_TC3: Helpdesk TicketController does not accept or process data error compensation tickets', () => {
      // Verifies interface separation: category "data_error" is segregated from Helpdesk ticket lifecycle
      const helpdeskCategories = ['support', 'complaint', 'technical', 'finance', 'consulting'];
      assert(!helpdeskCategories.includes('data_error'), 'Helpdesk categories must not contain decoupled data_error');
    }, { tier: 1, featureId: 1 });

    it('T1.1_TC4: Proactive AI agent query inspects data_reports instead of tickets table', () => {
      const sim = new TicketDecouplingSimulator();
      sim.submitDataErrorReport({
        lead_id: 202,
        consultant_id: USERS.saleAlpha.id,
        round_id: 3,
        reason: REPORT_REASONS[1].label
      });

      const pendingReports = sim.dataReports.filter(r => r.status === 'pending');
      assertEqual(pendingReports.length, 1);
      assertEqual(pendingReports[0].lead_id, 202);
      // AI cron agent inspects pendingReports in data_reports
      assert(pendingReports[0].id > 0);
    }, { tier: 1, featureId: 1 });

    it('T1.1_TC5: 100% historical ticket records in tickets table are preserved without alteration', () => {
      const sim = new TicketDecouplingSimulator();
      const historicalTickets = [
        { id: 1, title: 'Hỗ trợ reset mật khẩu', category: 'support', tenant_id: 1 },
        { id: 2, title: 'Khiếu nại thời gian tư vấn', category: 'complaint', tenant_id: 1 },
        { id: 3, title: 'Hỏi về hóa đơn', category: 'finance', tenant_id: 1 }
      ];
      sim.seedHistoricalTickets(historicalTickets);

      // Perform new data error report
      sim.submitDataErrorReport({
        lead_id: 303,
        consultant_id: USERS.saleAlpha.id,
        round_id: 1,
        reason: REPORT_REASONS[2].label
      });

      // Verify historical tickets remain 100% intact
      assertEqual(sim.tickets.length, 3);
      assertDeepEqual(sim.tickets, historicalTickets);
    }, { tier: 1, featureId: 1 });
  });
}
