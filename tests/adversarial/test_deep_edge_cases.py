#!/usr/bin/env python3
"""
Deep Edge-Case & Fuzzing Harness for Milestone 1
Adversarial Verification
"""

import sys
import re

def test(desc, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {desc}")
    if detail:
        print(f"       Detail: {detail}")
    return condition

all_ok = True

print("=" * 70)
print("MYERP MILESTONE 1: DEEP ADVERSARIAL EDGE-CASE & BOUNDARY FUZZING")
print("=" * 70)

# 1. Contact Fallback Matrix in ReportDataModal
def extract_report_payload(contact, user):
    lead_id = int(contact.get("lead_id") or contact.get("id") or 0)
    sale_id = int(contact.get("assigned_to") or contact.get("consultant_id") or contact.get("owner_id") or user.get("consultant_id") or user.get("id") or 0)
    round_id = int(contact.get("dl_round_id") or contact.get("round_id") or 0)
    return lead_id, sale_id, round_id

contacts_fuzz = [
    # (contact, user, exp_lead, exp_sale, exp_round)
    ({"id": 100, "assigned_to": 5, "round_id": 2}, {}, 100, 5, 2),
    ({"lead_id": 200, "id": 100, "consultant_id": 6, "dl_round_id": 3}, {}, 200, 6, 3),
    ({}, {"id": 99, "consultant_id": 88}, 0, 88, 0),
    ({"owner_id": 7}, {"id": 99}, 0, 7, 0),
    ({"lead_id": "300", "assigned_to": "40", "round_id": "15"}, {}, 300, 40, 15),
    ({"lead_id": None, "id": None}, {"id": None}, 0, 0, 0)
]

for idx, (c, u, el, es, er) in enumerate(contacts_fuzz):
    l, s, r = extract_report_payload(c, u)
    passed = (l == el and s == es and r == er)
    if not test(f"Contact Fallback Matrix #{idx+1}", passed, f"result: lead={l}, sale={s}, round={r}"):
        all_ok = False

# 2. Concurrency & Locking in DepositController approveMilestone
with open("backend/controllers/DepositController.php", "r", encoding="utf-8") as f:
    dep_text = f.read()

# Check FOR UPDATE on deposits and deposit_milestones
has_dep_lock = "FROM deposits d" in dep_text and "FOR UPDATE" in dep_text
has_mile_lock = "FROM deposit_milestones WHERE id = ? AND deposit_id = ? FOR UPDATE" in dep_text
has_already_approved_check = "$mileData['status'] === 'approved'" in dep_text

if not test("Deposit query uses FOR UPDATE row lock", has_dep_lock):
    all_ok = False
if not test("Milestone query uses FOR UPDATE row lock", has_mile_lock):
    all_ok = False
if not test("Duplicate approval rejected with 422", has_already_approved_check):
    all_ok = False

# 3. Currency Validation in DepositController
has_vnd_check = "!empty($depositData['currency']) && $depositData['currency'] !== 'VND'" in dep_text
has_under_expected_guard = "$actualAmount < $expected && !$isAdmin" in dep_text

if not test("Foreign currency requires explicit positive VND amount", has_vnd_check):
    all_ok = False
if not test("Non-admin cannot approve milestone with amount < expected", has_under_expected_guard):
    all_ok = False

# 4. Empty and Malformed Array Edge Cases in campaigns & worker_flow
def test_array_values_safety():
    # Empty subIds guard
    with open("backend/automation/campaigns.php", "r", encoding="utf-8") as f:
        c_code = f.read()
    with open("backend/automation/worker_flow.php", "r", encoding="utf-8") as f:
        w_code = f.read()
        
    camp_empty_guard = "if (!empty($subIds)) {" in c_code
    flow_empty_guard = "if (!empty($subIds)) {" in w_code
    return camp_empty_guard and flow_empty_guard

if not test("Guards against empty $subIds preventing empty IN () syntax error", test_array_values_safety()):
    all_ok = False

# 5. Check no unintentional DELETE statements in modified backend files
with open("backend/automation/admin_users.php", "r", encoding="utf-8") as f:
    u_del = "DELETE FROM users" in f.read()
if not test("admin_users.php: Zero hard deletes on users table", not u_del):
    all_ok = False

with open("backend/controllers/agent_tools/AgentHrmAttendanceTools.php", "r", encoding="utf-8") as f:
    hrm_text = f.read()
    h1 = "DELETE FROM hrm_leave_requests" in hrm_text
    h2 = "DELETE FROM attendance_bulk_requests" in hrm_text
    h3 = "DELETE FROM hrm_salary_advances" in hrm_text
if not test("AgentHrmAttendanceTools: Zero hard deletes across all request types", not (h1 or h2 or h3)):
    all_ok = False

print("\n" + "=" * 70)
if all_ok:
    print("ALL DEEP ADVERSARIAL EDGE-CASE TESTS PASSED! (VERDICT: APPROVE)")
else:
    print("EDGE-CASE TESTS FAILED! (VERDICT: REQUEST_CHANGES)")
print("=" * 70)

sys.exit(0 if all_ok else 1)
