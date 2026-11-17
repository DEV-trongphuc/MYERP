/**
 * tests/e2e/tier1_feature_coverage/feat06_idor_prevention.test.js
 * Feature 6: IDOR Prevention in ContactController.php & TicketController.php (R2)
 */

import { describe, it, assert, assertEqual } from '../helpers/testHarness.js';
import { IDORSimulator } from '../helpers/simulationEngine.js';
import { USERS } from '../helpers/fixtures.js';

export function registerFeature6Tests() {
  describe('Tier 1 - Feature 6: IDOR Prevention in ContactController & TicketController', () => {
    it('T1.6_TC1: Sale user attempting to view contact owned by another sale is blocked (IDOR prevention)', () => {
      const foreignContact = {
        id: 501,
        full_name: 'Khách hàng VIP Alpha',
        owner_id: USERS.saleBeta.id, // Owned by Beta
        tenant_id: 1,
        deleted_at: null
      };

      const hasAccess = IDORSimulator.canAccessContact(USERS.saleAlpha, foreignContact);
      assertEqual(hasAccess, false, 'Sale Alpha must NOT access Sale Beta contact');
    }, { tier: 1, featureId: 6 });

    it('T1.6_TC2: Sale user can view contact where they are the designated owner', () => {
      const ownedContact = {
        id: 502,
        full_name: 'Khách hàng của Alpha',
        owner_id: USERS.saleAlpha.id,
        tenant_id: 1,
        deleted_at: null
      };

      const hasAccess = IDORSimulator.canAccessContact(USERS.saleAlpha, ownedContact);
      assertEqual(hasAccess, true, 'Sale Alpha should access owned contact');
    }, { tier: 1, featureId: 6 });

    it('T1.6_TC3: Sale user listed as team collaborator is granted collaborative contact access', () => {
      const sharedContact = {
        id: 503,
        full_name: 'Khách hàng chăm sóc chung',
        owner_id: USERS.saleBeta.id,
        collaborator_ids: [USERS.saleAlpha.id, 99],
        tenant_id: 1,
        deleted_at: null
      };

      const hasAccess = IDORSimulator.canAccessContact(USERS.saleAlpha, sharedContact);
      assertEqual(hasAccess, true, 'Collaborator must be granted view access');
    }, { tier: 1, featureId: 6 });

    it('T1.6_TC4: Admin or Director role can access contacts across all sales and teams', () => {
      const anyContact = {
        id: 504,
        full_name: 'Khách hàng toàn hệ thống',
        owner_id: USERS.saleBeta.id,
        tenant_id: 1,
        deleted_at: null
      };

      const adminAccess = IDORSimulator.canAccessContact(USERS.admin, anyContact);
      const directorAccess = IDORSimulator.canAccessContact(USERS.director, anyContact);

      assertEqual(adminAccess, true, 'Admin should have universal contact access');
      assertEqual(directorAccess, true, 'Director should have universal contact access');
    }, { tier: 1, featureId: 6 });

    it('T1.6_TC5: checkTicketAccess in TicketController blocks non-creator and non-assignee from viewing tickets', () => {
      const ticket = {
        id: 88,
        title: 'Khiếu nại tư vấn',
        created_by: USERS.saleBeta.id,
        assigned_to: USERS.manager.id,
        tenant_id: 1,
        deleted_at: null
      };

      const unauthorizedAccess = IDORSimulator.canAccessTicket(USERS.saleAlpha, ticket);
      const creatorAccess = IDORSimulator.canAccessTicket(USERS.saleBeta, ticket);
      const assigneeAccess = IDORSimulator.canAccessTicket(USERS.manager, ticket);

      assertEqual(unauthorizedAccess, false, 'Unrelated sale must be blocked from foreign ticket');
      assertEqual(creatorAccess, true, 'Creator must be allowed to view ticket');
      assertEqual(assigneeAccess, true, 'Assignee must be allowed to view ticket');
    }, { tier: 1, featureId: 6 });
  });
}
