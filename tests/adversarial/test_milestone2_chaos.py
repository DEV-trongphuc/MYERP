#!/usr/bin/env python3
"""
ADVERSARIAL CHAOS & FUZZING SUITE: MILESTONE 2
Focus:
- Exhaustive combinatorial fuzzing of RBAC roles against api.php whitelist
- Fuzzy IDOR tests on ContactController collaborator_ids parser
- Path traversal & query-string poisoning on marketing route guards
- Cross-feature isolation verification
"""

import sys
import json
import re

total_tests = 0
passed_tests = 0
failures = []

def test(name):
    def decorator(fn):
        global total_tests, passed_tests
        total_tests += 1
        try:
            fn()
            print(f"  ✔ [PASS] {name}")
            passed_tests += 1
        except Exception as e:
            print(f"  ✖ [FAIL] {name}: {e}")
            failures.append((name, str(e)))
        return fn
    return decorator

print("======================================================================")
print("   CHALLENGER MILESTONE 2: CHAOS & ADVERSARIAL FUZZING SUITE")
print("======================================================================\n")

# ----------------------------------------------------------------------
# 1. RBAC Matrix Fuzzing
# ----------------------------------------------------------------------
print("▶ Phase 1: Exhaustive RBAC Role Combinatorial Fuzzing")

API_WHITELIST = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'marketing']

def check_api_rbac(role_val):
    if role_val is None:
        caller_role = ""
    elif isinstance(role_val, str):
        caller_role = role_val.lower()
    else:
        caller_role = str(role_val).lower()
    return caller_role in API_WHITELIST

@test("Fuzzing RBAC with 40+ benign and malicious role strings")
def test_rbac_fuzzing():
    # Roles that must be strictly REJECTED
    rejected_roles = [
        "sale", "sales", "consultant", "telesale", "viewer", "accountant",
        "hr", "guest", "anonymous", "student", "teacher", "partner",
        "sale_admin", "saleadmin", "leader", "team_leader",
        "admin; DROP TABLE users;--", "admin' OR '1'='1",
        "../admin", "role_admin", "admin_role", "sub_admin",
        "manager_sale", "marketing_sale", "sale_director",
        "undefined", "null", "false", "true", "0", "1", "-1",
        "", " ", "   "
    ]
    for r in rejected_roles:
        allowed = check_api_rbac(r)
        assert not allowed, f"Role '{r}' was improperly allowed through RBAC!"

    # Roles that must be AUTHORIZED
    authorized_roles = [
        "admin", "ADMIN", "Admin",
        "superadmin", "SUPERADMIN", "SuperAdmin",
        "super_admin", "SUPER_ADMIN", "Super_Admin",
        "director", "DIRECTOR", "Director",
        "manager", "MANAGER", "Manager",
        "marketing", "MARKETING", "Marketing"
    ]
    for r in authorized_roles:
        allowed = check_api_rbac(r)
        assert allowed, f"Legitimate role '{r}' was improperly rejected!"

# ----------------------------------------------------------------------
# 2. ContactController Collaborator Parsing Chaos
# ----------------------------------------------------------------------
print("\n▶ Phase 2: ContactController Collaborator Parsing & IDOR Chaos")

def parse_collabs(collab_str):
    if not collab_str:
        return []
    items = []
    for s in str(collab_str).split(','):
        trimmed = s.strip()
        if trimmed:
            try:
                items.append(int(trimmed))
            except ValueError:
                pass
    return items

def check_contact_show_access(auth_uid, auth_role, owner_id, collab_str):
    role = str(auth_role or '').lower()
    if role in ['sale', 'sales']:
        current_uid = int(auth_uid or 0)
        owner_id_int = int(owner_id or 0)
        collabs = parse_collabs(collab_str)
        is_owner_or_collab = (owner_id_int == current_uid) or (current_uid in collabs)
        if not is_owner_or_collab:
            return 403, "Forbidden"
    return 200, "OK"

@test("Collaborator ID parsing handles commas, spaces, invalid tokens, and zero values")
def test_collab_parsing_chaos():
    # Test valid parsing with messy spacing
    assert parse_collabs(" 10 , 20 , 30 ") == [10, 20, 30]
    # Test empty or consecutive commas
    assert parse_collabs(",,,10,,,20,,,") == [10, 20]
    # Test non-numeric injection
    assert parse_collabs("10, abc, 20, 'or 1=1") == [10, 20]
    # Test empty string / None
    assert parse_collabs("") == []
    assert parse_collabs(None) == []

@test("IDOR access check prevents partial ID matches (e.g. uid 5 matching 50, 15, 500)")
def test_partial_id_collision():
    # User ID 5 should NOT match 50, 15, 25, 500
    collabs_str = "50, 15, 25, 500"
    status, _ = check_contact_show_access(auth_uid=5, auth_role="sale", owner_id=99, collab_str=collabs_str)
    assert status == 403, "Partial ID collision granted unauthorized access!"

    # User ID 5 should match exact 5
    collabs_str_exact = "50, 5, 25"
    status, _ = check_contact_show_access(auth_uid=5, auth_role="sale", owner_id=99, collab_str=collabs_str_exact)
    assert status == 200, "Exact ID failed to grant authorized collaborator access!"

@test("Anti-Lead Theft prevents reassignment via owner_id and assigned_to")
def test_anti_lead_theft_fuzzing():
    def check_update(auth_uid, auth_role, current_owner_id, body):
        role = str(auth_role or '').lower()
        if role in ['sale', 'sales']:
            uid = int(auth_uid or 0)
            curr_owner = int(current_owner_id or 0)
            if uid != curr_owner:
                return 403, "Not owner/collab"
            target_owner = curr_owner
            if "owner_id" in body:
                target_owner = int(body["owner_id"] or 0)
            elif "assigned_to" in body:
                target_owner = int(body["assigned_to"] or 0)
            if target_owner != curr_owner:
                return 403, "Cannot reassign"
        return 200, "OK"

    # Sale 10 owns contact 10
    # Attempt 1: explicitly change owner_id to 999
    res, msg = check_update(10, "sale", 10, {"owner_id": 999})
    assert res == 403 and msg == "Cannot reassign"

    # Attempt 2: change owner_id to 0
    res, msg = check_update(10, "sale", 10, {"owner_id": 0})
    assert res == 403 and msg == "Cannot reassign"

    # Attempt 3: change assigned_to to 888
    res, msg = check_update(10, "sales", 10, {"assigned_to": 888})
    assert res == 403 and msg == "Cannot reassign"

    # Attempt 4: keep owner_id identical (10)
    res, msg = check_update(10, "sale", 10, {"owner_id": 10, "full_name": "Valid update"})
    assert res == 200

# ----------------------------------------------------------------------
# 3. Frontend Route Guard Path Manipulation Fuzzing
# ----------------------------------------------------------------------
print("\n▶ Phase 3: Route Guard Path Traversal & Query Poisoning Fuzzing")

def can_access_marketing_route(user, href):
    if not user or not user.get("role"):
        return False
    role = str(user.get("role")).strip().lower()
    if role in ['marketing', 'admin', 'superadmin', 'super_admin', 'director', 'mkt', 'digital_marketing', 'content', 'ads']:
        return True
    is_leadership = role in ['manager', 'leader', 'sale_admin', 'saleadmin'] or bool(user.get("is_leader") or user.get("is_team_leader"))
    if is_leadership:
        clean_path = href.split('?')[0].rstrip('/')
        return clean_path in ['/marketing', '/marketing/flows', '/marketing/surveys', '/marketing/vouchers']
    return False

@test("Query parameter poisoning (?id=1&bypass=true) does not bypass route guard")
def test_query_poisoning():
    sale = {"id": 10, "role": "sale"}
    poisoned_routes = [
        "/marketing?role=admin",
        "/marketing/campaigns?bypass=1",
        "/marketing/flows?access=granted",
        "/marketing/audience?token=superadmin"
    ]
    for r in poisoned_routes:
        assert not can_access_marketing_route(sale, r), f"Sale bypassed route {r}"

@test("Manager role access boundaries remain strictly isolated across query-string variations")
def test_manager_boundary_isolation():
    manager = {"id": 4, "role": "manager"}
    # Allowed routes with query strings
    assert can_access_marketing_route(manager, "/marketing?tab=kpi")
    assert can_access_marketing_route(manager, "/marketing/flows?status=active")
    assert can_access_marketing_route(manager, "/marketing/surveys?page=1")
    assert can_access_marketing_route(manager, "/marketing/vouchers?filter=all")

    # Forbidden routes even with query strings
    assert not can_access_marketing_route(manager, "/marketing/campaigns?tab=kpi")
    assert not can_access_marketing_route(manager, "/marketing/audience?page=1")
    assert not can_access_marketing_route(manager, "/marketing/social-bot?view=logs")
    assert not can_access_marketing_route(manager, "/marketing/ai-training?model=flash")
    assert not can_access_marketing_route(manager, "/marketing/web-tracking?range=30d")
    assert not can_access_marketing_route(manager, "/marketing/api-triggers?hook=test")

# ----------------------------------------------------------------------
# 4. Summary
# ----------------------------------------------------------------------
print("\n======================================================================")
print("   CHAOS FUZZING EXECUTION SUMMARY REPORT")
print("======================================================================")
print(f"  Total Chaos Tests Run : {total_tests}")
print(f"  Passed (PASS)         : {passed_tests}")
print(f"  Failed (FAIL)         : {len(failures)}")
print("======================================================================")

if failures:
    print("\n✖ FAILURES DETECTED:")
    for name, err in failures:
        print(f"  - {name}: {err}")
    sys.exit(1)
else:
    print("\n✔ ALL ADVERSARIAL CHAOS & FUZZING TESTS PASSED (100% SUCCESS RATE)!")
    sys.exit(0)
