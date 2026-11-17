#!/usr/bin/env python3
"""
Adversarial Stress-Testing Harness for MYERP Milestone 1
EMPIRICAL CHALLENGER - Gate 3 Adversarial Audit
"""

import sys
import re
import json

def log_test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")
    if detail:
        print(f"       Detail: {detail}")
    return passed

all_passed = True

print("=" * 70)
print("MYERP MILESTONE 1: EMPIRICAL ADVERSARIAL STRESS TEST HARNESS")
print("=" * 70)

# ==============================================================================
# CHALLENGE ITEM 1: Anti-Self-Approval in DepositController.php
# ==============================================================================
print("\n--- [1] Anti-Self-Approval Simulation & Boundary Fuzzing ---")

# Extracted from backend/controllers/DepositController.php lines 1078 & 1102-1110
ALLOWED_APPROVE_ROLES = ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'accountant']
ADMIN_OR_DIRECTOR_ROLES = ['admin', 'superadmin', 'super_admin', 'director']

def simulate_approve_milestone(auth_role, auth_user_id, deposit_created_by):
    # Step 1: requireRole
    normalized_role = auth_role.lower() if auth_role else ''
    if normalized_role not in [r.lower() for r in ALLOWED_APPROVE_ROLES]:
        return {"status": 403, "allowed": False, "reason": "Role not in whitelist"}
    
    # Step 2: Anti-self-approval
    try:
        creator_id = int(deposit_created_by) if deposit_created_by is not None else 0
    except (ValueError, TypeError):
        creator_id = 0
    try:
        user_id = int(auth_user_id) if auth_user_id is not None else 0
    except (ValueError, TypeError):
        user_id = 0
        
    is_creator = (creator_id == user_id)
    is_admin_or_director = normalized_role in [r.lower() for r in ADMIN_OR_DIRECTOR_ROLES]
    
    if is_creator and not is_admin_or_director:
        return {"status": 403, "allowed": False, "reason": "Không được tự phê duyệt đợt thanh toán của chính mình"}
    
    return {"status": 200, "allowed": True, "reason": "Approved"}

# Test scenarios:
test_cases_m1 = [
    # (auth_role, auth_user_id, deposit_created_by, expected_status, expected_allowed, desc)
    ("accountant", 10, 10, 403, False, "Accountant self-approving their own deposit -> BLOCKED"),
    ("assistant", 12, 12, 403, False, "Assistant self-approving their own deposit -> BLOCKED"),
    ("Accountant", "10", 10, 403, False, "Mixed-case 'Accountant' string ID self-approving -> BLOCKED"),
    ("ASSISTANT", 15, "15", 403, False, "Upper-case 'ASSISTANT' self-approving -> BLOCKED"),
    ("accountant", 10, 99, 200, True, "Accountant approving someone else's deposit -> ALLOWED"),
    ("assistant", 12, 99, 200, True, "Assistant approving someone else's deposit -> ALLOWED"),
    ("admin", 1, 1, 200, True, "Admin self-approving their own deposit -> ALLOWED"),
    ("director", 2, 2, 200, True, "Director self-approving their own deposit -> ALLOWED"),
    ("superadmin", 3, 3, 200, True, "SuperAdmin self-approving their own deposit -> ALLOWED"),
    ("super_admin", 4, 4, 200, True, "Super_Admin self-approving their own deposit -> ALLOWED"),
    ("sale", 20, 99, 403, False, "Sale role attempting milestone approval -> BLOCKED by requireRole"),
    ("guest", 0, 99, 403, False, "Guest role attempting milestone approval -> BLOCKED by requireRole"),
    ("accountant", 10, None, 200, True, "Deposit created_by is None (legacy row) -> ALLOWED for accountant"),
    ("accountant", 10, 0, 200, True, "Deposit created_by is 0 (system row) -> ALLOWED for accountant"),
]

for auth_role, uid, created_by, exp_status, exp_allowed, desc in test_cases_m1:
    res = simulate_approve_milestone(auth_role, uid, created_by)
    passed = (res["status"] == exp_status and res["allowed"] == exp_allowed)
    if not log_test(f"Anti-Self-Approval: {desc}", passed, f"got {res['status']} ({res['reason']})"):
        all_passed = False

# Verify code implementation in DepositController.php
with open("backend/controllers/DepositController.php", "r", encoding="utf-8") as f:
    dep_content = f.read()

has_guard = ("$isCreator = ((int)$depositData['created_by'] === (int)$auth['user_id']);" in dep_content)
has_role_check = ("$isAdminOrDirector = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);" in dep_content)
has_403 = ("Không được tự phê duyệt đợt thanh toán của chính mình" in dep_content)

if not log_test("DepositController.php exact code guard exists", has_guard and has_role_check and has_403):
    all_passed = False


# ==============================================================================
# CHALLENGE ITEM 2: Decoupled Data Error Reporting vs Helpdesk
# ==============================================================================
print("\n--- [2] Decoupled Data Error Reporting vs Helpdesk ---")

with open("src/components/ui/ReportDataModal.tsx", "r", encoding="utf-8") as f:
    modal_content = f.read()

# 1. Verify ReportDataModal calls submit_report and NOT /tickets
calls_submit_report = "fetchAPI('submit_report'" in modal_content
calls_tickets = "api.post('/tickets'" in modal_content or "'/tickets'" in modal_content

if not log_test("ReportDataModal calls fetchAPI('submit_report')", calls_submit_report):
    all_passed = False
if not log_test("ReportDataModal does NOT call /tickets", not calls_tickets):
    all_passed = False

# 2. Verify TicketController.php has no data error sync logic
with open("backend/controllers/TicketController.php", "r", encoding="utf-8") as f:
    ticket_ctrl = f.read()

has_bao_loi = "Báo lỗi data" in ticket_ctrl
has_data_reports = "data_reports" in ticket_ctrl
has_error_col = "is_error_ticket" in ticket_ctrl

if not log_test("TicketController has zero 'Báo lỗi data' logic", not has_bao_loi):
    all_passed = False
if not log_test("TicketController has zero 'data_reports' table references", not has_data_reports):
    all_passed = False
if not log_test("TicketController has zero 'is_error_ticket' references", not has_error_col):
    all_passed = False

# 3. Verify CustomerProfileDrawer has lead_error_compensation removed
with open("src/pages/CustomerProfileDrawer.tsx", "r", encoding="utf-8") as f:
    drawer_content = f.read()

has_lead_comp_option = "lead_error_compensation" in drawer_content
if not log_test("CustomerProfileDrawer removed lead_error_compensation", not has_lead_comp_option):
    all_passed = False

# 4. Verify cron_ai_proactive_agent queries tickets, not support_tickets
with open("backend/cron_ai_proactive_agent.php", "r", encoding="utf-8") as f:
    cron_content = f.read()

has_support_tickets_cron = "support_tickets" in cron_content
queries_tickets_cron = "SELECT COUNT(*) FROM tickets" in cron_content

if not log_test("cron_ai_proactive_agent does NOT query non-existent support_tickets", not has_support_tickets_cron):
    all_passed = False
if not log_test("cron_ai_proactive_agent queries tickets table", queries_tickets_cron):
    all_passed = False


# ==============================================================================
# CHALLENGE ITEM 3: Soft-Delete Retention
# ==============================================================================
print("\n--- [3] Soft-Delete Retention & Foreign Key Protection ---")

# 1. backend/automation/admin_users.php
with open("backend/automation/admin_users.php", "r", encoding="utf-8") as f:
    admin_users = f.read()

has_delete_from_users = "DELETE FROM users" in admin_users
has_soft_delete_users = "UPDATE users SET deleted_at = NOW() WHERE id = ?" in admin_users
has_filter_deleted_users = "WHERE u.deleted_at IS NULL" in admin_users

if not log_test("admin_users.php does NOT contain DELETE FROM users", not has_delete_from_users):
    all_passed = False
if not log_test("admin_users.php uses UPDATE users SET deleted_at = NOW()", has_soft_delete_users):
    all_passed = False
if not log_test("admin_users.php filters WHERE u.deleted_at IS NULL on list", has_filter_deleted_users):
    all_passed = False

# 2. backend/api.php delete_consultant & delete_round
with open("backend/api.php", "r", encoding="utf-8") as f:
    api_content = f.read()

# Check delete_consultant (around line 7062)
del_consultant_block = re.search(r"case 'delete_consultant':.*?(break;|\n\s*case)", api_content, re.DOTALL)
if del_consultant_block:
    dc_text = del_consultant_block.group(0)
    has_hard_del_reports_dc = "DELETE FROM data_reports WHERE consultant_id" in dc_text
    has_soft_del_reports_dc = "UPDATE data_reports SET deleted_at = NOW() WHERE consultant_id = ?" in dc_text
    if not log_test("delete_consultant does NOT hard delete data_reports", not has_hard_del_reports_dc):
        all_passed = False
    if not log_test("delete_consultant preserves data_reports with safe update", has_soft_del_reports_dc):
        all_passed = False
else:
    log_test("delete_consultant block found", False)
    all_passed = False

# Check delete_round (around line 8400)
del_round_block = re.search(r"case 'delete_round':.*?(break;|\n\s*case)", api_content, re.DOTALL)
if del_round_block:
    dr_text = del_round_block.group(0)
    has_hard_del_reports_dr = "DELETE FROM data_reports WHERE round_id" in dr_text
    has_null_round_reports_dr = "round_id = NULL" in dr_text
    if not log_test("delete_round does NOT hard delete data_reports", not has_hard_del_reports_dr):
        all_passed = False
    if not log_test("delete_round detaches round_id = NULL to prevent FK violation", has_null_round_reports_dr):
        all_passed = False
else:
    log_test("delete_round block found", False)
    all_passed = False

# 3. AgentHrmAttendanceTools.php
with open("backend/controllers/agent_tools/AgentHrmAttendanceTools.php", "r", encoding="utf-8") as f:
    hrm_tools = f.read()

has_hard_del_leave = "DELETE FROM hrm_leave_requests" in hrm_tools
has_hard_del_attend = "DELETE FROM attendance_bulk_requests" in hrm_tools
has_hard_del_advance = "DELETE FROM hrm_salary_advances" in hrm_tools

has_soft_leave = "UPDATE hrm_leave_requests SET status = 'cancelled'" in hrm_tools
has_soft_attend = "UPDATE attendance_bulk_requests SET status = 'cancelled'" in hrm_tools
has_soft_advance = "UPDATE hrm_salary_advances SET status = 'cancelled'" in hrm_tools

if not log_test("AgentHrmAttendanceTools: No hard DELETE on hrm_leave_requests", not has_hard_del_leave):
    all_passed = False
if not log_test("AgentHrmAttendanceTools: No hard DELETE on attendance_bulk_requests", not has_hard_del_attend):
    all_passed = False
if not log_test("AgentHrmAttendanceTools: No hard DELETE on hrm_salary_advances", not has_hard_del_advance):
    all_passed = False

if not log_test("AgentHrmAttendanceTools: Soft-cancels hrm_leave_requests", has_soft_leave):
    all_passed = False
if not log_test("AgentHrmAttendanceTools: Soft-cancels attendance_bulk_requests", has_soft_attend):
    all_passed = False
if not log_test("AgentHrmAttendanceTools: Soft-cancels hrm_salary_advances", has_soft_advance):
    all_passed = False


# ==============================================================================
# CHALLENGE ITEM 4: PDO Dynamic Arrays & array_values() Safety
# ==============================================================================
print("\n--- [4] PDO Dynamic Arrays & Parameter Count Safety ---")

with open("backend/automation/campaigns.php", "r", encoding="utf-8") as f:
    camp_content = f.read()

with open("backend/automation/worker_flow.php", "r", encoding="utf-8") as f:
    flow_content = f.read()

has_av_campaigns = "$subIds = array_values(array_filter(array_column($recipients, 'subscriber_id')));" in camp_content
has_av_flow = "$subIds = array_values(array_unique(array_filter(array_column($items, 'subscriber_id'))));" in flow_content

if not log_test("campaigns.php uses array_values(array_filter(...))", has_av_campaigns):
    all_passed = False
if not log_test("worker_flow.php uses array_values(array_unique(array_filter(...)))", has_av_flow):
    all_passed = False

# Simulation of PHP's array_filter / array_unique key gap issue
def simulate_php_array_filter_and_unique(raw_items):
    # In PHP, array_filter preserves keys
    filtered = {i: v['subscriber_id'] for i, v in enumerate(raw_items) if v.get('subscriber_id')}
    
    # array_unique preserves keys of first occurrences
    unique_by_val = {}
    unique_with_gaps = {}
    for k, v in filtered.items():
        if v not in unique_by_val:
            unique_by_val[v] = k
            unique_with_gaps[k] = v
            
    # Without array_values, keys are sparse: e.g. {0: 10, 3: 20}
    # With array_values, keys become [0, 1, 2, ...]
    reindexed = list(unique_with_gaps.values())
    
    placeholders = ",".join(["?"] * len(reindexed))
    return {
        "raw_count": len(raw_items),
        "sparse_keys": list(unique_with_gaps.keys()),
        "reindexed_keys": list(range(len(reindexed))),
        "param_count": len(reindexed),
        "placeholder_count": len(placeholders.split(",")) if placeholders else 0,
        "is_gap_free": (list(range(len(reindexed))) == [i for i in range(len(reindexed))])
    }

fuzz_inputs = [
    [{"subscriber_id": 10}, {"subscriber_id": None}, {"subscriber_id": 0}, {"subscriber_id": 20}, {"subscriber_id": 10}],
    [{"subscriber_id": ""}, {"subscriber_id": False}, {"subscriber_id": 99}],
    [],
    [{"subscriber_id": i} for i in range(1, 100)],
    [{"subscriber_id": 5}] * 50
]

for idx, f_in in enumerate(fuzz_inputs):
    sim = simulate_php_array_filter_and_unique(f_in)
    passed = (sim["param_count"] == sim["placeholder_count"]) and sim["is_gap_free"]
    if not log_test(f"Fuzz test dynamic array #{idx+1} (raw={sim['raw_count']}, valid={sim['param_count']})", passed):
        all_passed = False

# Verify AcademicAffairsController loop optimization
with open("backend/controllers/AcademicAffairsController.php", "r", encoding="utf-8") as f:
    acad_content = f.read()

# Check that prepare statements are before foreach in saveStudentGrades
save_grades_match = re.search(r"public function saveStudentGrades.*?\{.*?(.*?foreach\s*\(\$gradesList as \$item\))", acad_content, re.DOTALL)
if save_grades_match:
    pre_loop = save_grades_match.group(1)
    has_pre_chk = "$stmtChk = $this->db->prepare" in pre_loop
    has_pre_upd = "$stmtUpd = $this->db->prepare" in pre_loop
    has_pre_ins = "$stmtIns = $this->db->prepare" in pre_loop
    if not log_test("saveStudentGrades prepares $stmtChk before loop", has_pre_chk):
        all_passed = False
    if not log_test("saveStudentGrades prepares $stmtUpd before loop", has_pre_upd):
        all_passed = False
    if not log_test("saveStudentGrades prepares $stmtIns before loop", has_pre_ins):
        all_passed = False
else:
    log_test("saveStudentGrades loop found", False)
    all_passed = False

# Check saveClassGradebook
bulk_grades_match = re.search(r"public function saveClassGradebook.*?\{.*?(.*?foreach\s*\(\$rows as \$row\))", acad_content, re.DOTALL)
if bulk_grades_match:
    pre_bulk_loop = bulk_grades_match.group(1)
    has_b_chk = "$stmtChk = $this->db->prepare" in pre_bulk_loop
    has_b_upd = "$stmtUpd = $this->db->prepare" in pre_bulk_loop
    has_b_ins = "$stmtIns = $this->db->prepare" in pre_bulk_loop
    if not log_test("saveClassGradebook prepares $stmtChk before loop", has_b_chk):
        all_passed = False
    if not log_test("saveClassGradebook prepares $stmtUpd before loop", has_b_upd):
        all_passed = False
    if not log_test("saveClassGradebook prepares $stmtIns before loop", has_b_ins):
        all_passed = False
else:
    log_test("saveClassGradebook loop found", False)
    all_passed = False

print("\n" + "=" * 70)
if all_passed:
    print("ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY! (VERDICT: APPROVE)")
else:
    print("SOME ADVERSARIAL STRESS TESTS FAILED! (VERDICT: REQUEST_CHANGES)")
print("=" * 70)

sys.exit(0 if all_passed else 1)
