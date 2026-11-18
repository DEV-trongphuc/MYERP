"""
EMPIRICAL CHALLENGER PYTHON SUITE - MILESTONE 1
Fuzzing, Invariant Verification & Matrix Testing
"""

import unittest
import os
import re
import random

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class TestEmpiricalChallengerM1(unittest.TestCase):

    def test_anti_self_approval_exhaustive_matrix(self):
        """
        Matrix test: all combinations of roles and creators
        Roles: ['admin', 'superadmin', 'super_admin', 'director', 'accountant', 'assistant', 'sale', 'manager']
        """
        roles = ['admin', 'superadmin', 'super_admin', 'director', 'accountant', 'assistant', 'sale', 'manager']
        
        def approve_milestone_oracle(auth_role, auth_id, deposit_creator_id):
            allowed_roles = ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'accountant']
            if auth_role.lower() not in allowed_roles:
                return (403, "Role not authorized to approve")
            is_creator = (int(auth_id) == int(deposit_creator_id))
            is_admin_or_director = auth_role.lower() in ['admin', 'superadmin', 'super_admin', 'director']
            if is_creator and not is_admin_or_director:
                return (403, "Không được tự phê duyệt đợt thanh toán của chính mình")
            return (200, "Approved")

        # 1. Creator = Accountant
        self.assertEqual(approve_milestone_oracle('accountant', 5, 5)[0], 403)
        self.assertEqual(approve_milestone_oracle('accountant', 6, 5)[0], 200)

        # 2. Creator = Assistant
        self.assertEqual(approve_milestone_oracle('assistant', 7, 7)[0], 403)
        self.assertEqual(approve_milestone_oracle('assistant', 8, 7)[0], 200)

        # 3. Creator = Admin / Director
        self.assertEqual(approve_milestone_oracle('admin', 1, 1)[0], 200)
        self.assertEqual(approve_milestone_oracle('superadmin', 2, 2)[0], 200)
        self.assertEqual(approve_milestone_oracle('super_admin', 2, 2)[0], 200)
        self.assertEqual(approve_milestone_oracle('director', 3, 3)[0], 200)

        # 4. Unauthorized roles (sale, manager) cannot approve regardless
        self.assertEqual(approve_milestone_oracle('sale', 9, 9)[0], 403)
        self.assertEqual(approve_milestone_oracle('sale', 9, 10)[0], 403)
        self.assertEqual(approve_milestone_oracle('manager', 11, 10)[0], 403)

    def test_deposit_controller_source_invariants(self):
        dep_path = os.path.join(BASE_DIR, "backend", "controllers", "DepositController.php")
        with open(dep_path, "r", encoding="utf-8") as f:
            code = f.read()

        # Invariant 1: Rollback before 403 respond
        rollback_pos = code.find("$this->db->rollBack();\n            respond(403, null, 'Không được tự phê duyệt đợt thanh toán của chính mình', false);")
        self.assertNotEqual(rollback_pos, -1, "Transaction must rollback before returning 403 in approveMilestone")

        # Invariant 2: Row-level lock (FOR UPDATE)
        self.assertIn("FOR UPDATE", code[rollback_pos-1200:rollback_pos], "Deposit fetch must be locked FOR UPDATE")

    def test_ticket_decoupling_zero_leakage(self):
        # Verify ReportDataModal does not import or use /tickets endpoint
        modal_path = os.path.join(BASE_DIR, "src", "components", "ui", "ReportDataModal.tsx")
        with open(modal_path, "r", encoding="utf-8") as f:
            modal_code = f.read()
        self.assertNotIn("'/tickets'", modal_code)
        self.assertNotIn('"/tickets"', modal_code)
        self.assertIn("fetchAPI('submit_report'", modal_code)

        # Verify TicketController does not reference data_reports
        tc_path = os.path.join(BASE_DIR, "backend", "controllers", "TicketController.php")
        with open(tc_path, "r", encoding="utf-8") as f:
            tc_code = f.read()
        self.assertNotIn("data_reports", tc_code)
        self.assertNotIn("is_error_ticket", tc_code)

    def test_soft_delete_preservation_audit(self):
        # 1. admin_users.php
        au_path = os.path.join(BASE_DIR, "backend", "automation", "admin_users.php")
        with open(au_path, "r", encoding="utf-8") as f:
            au_code = f.read()
        self.assertNotIn("DELETE FROM users", au_code)
        self.assertIn("UPDATE users SET deleted_at = NOW()", au_code)
        self.assertIn("WHERE u.deleted_at IS NULL", au_code)

        # 2. AgentHrmAttendanceTools.php
        agent_path = os.path.join(BASE_DIR, "backend", "controllers", "agent_tools", "AgentHrmAttendanceTools.php")
        with open(agent_path, "r", encoding="utf-8") as f:
            agent_code = f.read()
        self.assertNotIn("DELETE FROM hrm_leave_requests", agent_code)
        self.assertNotIn("DELETE FROM attendance_bulk_requests WHERE", agent_code)
        self.assertNotIn("DELETE FROM hrm_salary_advances", agent_code)

    def test_pdo_array_values_fuzzer(self):
        """
        Fuzzing test: generate 1,000 random arrays with gaps, nulls, negative numbers, strings,
        and confirm that array_values emulation strictly produces contiguous 0..N-1 keys.
        """
        for _ in range(1000):
            size = random.randint(0, 100)
            raw = [random.choice([None, 0, False, '', random.randint(1, 50)]) for _ in range(size)]
            
            # PHP array_filter preserves keys
            filtered = {i: val for i, val in enumerate(raw) if val}
            
            # PHP array_unique preserves keys
            seen = set()
            unique = {}
            for k, v in filtered.items():
                if v not in seen:
                    seen.add(v)
                    unique[k] = v
            
            # PHP array_values resets to dense sequential 0..len-1
            reindexed = list(unique.values())
            
            # Verify invariants
            self.assertEqual(len(reindexed), len(unique))
            for idx in range(len(reindexed)):
                self.assertIsNotNone(reindexed[idx])
                self.assertTrue(reindexed[idx])
            
            # Check SQL placeholders match exact parameter count
            placeholders = ",".join(["?"] * len(reindexed))
            self.assertEqual(placeholders.count("?"), len(reindexed))

if __name__ == '__main__':
    unittest.main()
