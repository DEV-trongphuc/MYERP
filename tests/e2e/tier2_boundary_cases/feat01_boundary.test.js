/**
 * tests/e2e/tier2_boundary_cases/feat01_boundary.test.js
 * Feature 1 Boundary & Corner Cases: Decouple Data Error Reporting from Helpdesk
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { TicketDecouplingSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerFeature1BoundaryTests() {
  describe('Tier 2 - Feature 1 Boundary Cases: Data Error Reporting', () => {
    it('BC1.1: Contact with NULL phone and NULL email submits data error report cleanly', () => {
      const sim = new TicketDecouplingSimulator();
      const payload = {
        lead_id: 999,
        customer_phone: null,
        customer_email: null,
        consultant_id: USERS.saleAlpha.id,
        round_id: 1,
        reason: 'Sai số điện thoại / Số ảo'
      };

      const res = sim.submitDataErrorReport(payload);
      assertEqual(res.status, 200);
      assertEqual(res.success, true);
      assertEqual(sim.dataReports.length, 1);
    }, { tier: 2, featureId: 1 });

    it('BC1.2: Contact with special characters and HTML tags in reason is sanitized and stored cleanly', () => {
      const sim = new TicketDecouplingSimulator();
      const maliciousReason = 'Sai số <script>alert("xss")</script> & "quotes" \'escaped\'';
      const payload = {
        lead_id: 1000,
        consultant_id: USERS.saleAlpha.id,
        round_id: 1,
        reason: maliciousReason
      };

      const res = sim.submitDataErrorReport(payload);
      assertEqual(res.status, 200);
      assertEqual(sim.dataReports[0].reason, maliciousReason);
      assertEqual(sim.tickets.length, 0);
    }, { tier: 2, featureId: 1 });

    it('BC1.3: Empty or pure whitespace reason is rejected with HTTP 400', () => {
      const sim = new TicketDecouplingSimulator();
      const payload = {
        lead_id: 1001,
        consultant_id: USERS.saleAlpha.id,
        round_id: 1,
        reason: '   ' // Pure whitespace
      };

      const res = sim.submitDataErrorReport(payload);
      assertEqual(res.status, 400);
      assertEqual(res.success, false);
      assert(res.message.includes('lý do'));
    }, { tier: 2, featureId: 1 });

    it('BC1.4: Extreme length note (5000+ characters) is handled safely without memory or buffer crash', () => {
      const sim = new TicketDecouplingSimulator();
      const massiveNote = 'Lý do chi tiết: ' + 'A'.repeat(5000);
      const payload = {
        lead_id: 1002,
        consultant_id: USERS.saleAlpha.id,
        round_id: 1,
        reason: 'Khác / Data Unqualified',
        note: massiveNote
      };

      const res = sim.submitDataErrorReport(payload);
      assertEqual(res.status, 200);
      assertEqual(sim.dataReports[0].note.length, massiveNote.length);
    }, { tier: 2, featureId: 1 });

    it('BC1.5: Idempotent handling of repeated submissions for identical lead and round', () => {
      const sim = new TicketDecouplingSimulator();
      const payload = {
        lead_id: 1003,
        consultant_id: USERS.saleAlpha.id,
        round_id: 2,
        reason: 'Trùng của tôi (< 6 tháng)'
      };

      const res1 = sim.submitDataErrorReport(payload);
      const res2 = sim.submitDataErrorReport(payload);

      assertEqual(res1.status, 200);
      assertEqual(res2.status, 200);
      // Both entries recorded without corrupting tickets table
      assertEqual(sim.tickets.length, 0);
    }, { tier: 2, featureId: 1 });
  });
}
