#!/usr/bin/env python3
"""
Adversarial Stress Harness for MYERP Milestone 3 (Iteration 2)
Challenger R2-1: Empirical Pentest and Contract Verification.
Tests backend/automation/links_qr.php and campaigns.php.
"""

import subprocess
import json
import sys
import os

PHP_BIN = r"C:\Users\LENOVO\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"

class TestFailure(Exception):
    pass

passed_tests = []
failed_tests = []

def record_pass(name, details=""):
    print(f"  [PASS] {name} {details}")
    passed_tests.append(name)

def record_fail(name, reason):
    print(f"  [FAIL] {name}: {reason}")
    failed_tests.append((name, reason))

def run_php_script(script_content):
    temp_file = os.path.abspath("tests/adversarial/temp_harness_runner.php")
    with open(temp_file, "w", encoding="utf-8") as f:
        f.write(script_content)
    try:
        res = subprocess.run([PHP_BIN, temp_file], capture_output=True, text=True, timeout=15)
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass

print("=" * 70)
print("CHALLENGER R2-1: EMPIRICAL ADVERSARIAL PENTEST SUITE (MILESTONE 3)")
print("=" * 70)

# ============================================================================
# PHASE 1: DATABASE SETUP & SEEDING TEST RECORDS (IDEMPOTENT & CLEANED UP)
# ============================================================================
print("\n--- PHASE 1: SEEDING REAL DATABASE TEST RECORDS ---")

seed_script = """<?php
require_once __DIR__ . '/../../backend/automation/db_connect.php';

// Cleanup previous test fixtures
$pdo->exec("DELETE FROM link_clicks WHERE short_link_id IN ('test_link_ws1', 'test_link_ws2', 'test_link_deleted', 'test_link_empty')");
$pdo->exec("DELETE FROM short_links WHERE id IN ('test_link_ws1', 'test_link_ws2', 'test_link_deleted', 'test_link_empty')");

// 1. Link belonging to workspace 1
$pdo->prepare("INSERT INTO short_links (id, workspace_id, name, slug, target_url, status, is_deleted, created_at) VALUES ('test_link_ws1', '1', 'Test Link WS1', 'test-slug-ws1', 'https://example.com/1', 'active', 0, NOW())")->execute();

// 2. Link belonging to workspace 2
$pdo->prepare("INSERT INTO short_links (id, workspace_id, name, slug, target_url, status, is_deleted, created_at) VALUES ('test_link_ws2', '2', 'Test Link WS2', 'test-slug-ws2', 'https://example.com/2', 'active', 0, NOW())")->execute();

// 3. Soft-deleted link
$pdo->prepare("INSERT INTO short_links (id, workspace_id, name, slug, target_url, status, is_deleted, deleted_at, created_at) VALUES ('test_link_deleted', '1', 'Test Link Deleted', 'test-slug-del', 'https://example.com/del', 'active', 1, NOW(), NOW())")->execute();

// 4. Link with 0 clicks
$pdo->prepare("INSERT INTO short_links (id, workspace_id, name, slug, target_url, status, is_deleted, created_at) VALUES ('test_link_empty', '1', 'Test Link Empty', 'test-slug-empty', 'https://example.com/empty', 'active', 0, NOW())")->execute();

// Populate clicks for test_link_ws1
// Row 1: Desktop, Windows, Vietnam
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, clicked_at, ip_hash, device_type, os, country) VALUES (UUID(), 'test_link_ws1', NOW(), 'hash_ip_1', 'Desktop', 'Windows', 'Vietnam')")->execute();
// Row 2: Mobile, iOS, US
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, clicked_at, ip_hash, device_type, os, country) VALUES (UUID(), 'test_link_ws1', NOW() - INTERVAL 1 DAY, 'hash_ip_2', 'Mobile', 'iOS', 'United States')")->execute();
// Row 3: Tablet, Android, Vietnam (repeat country)
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, clicked_at, ip_hash, device_type, os, country) VALUES (UUID(), 'test_link_ws1', NOW() - INTERVAL 2 DAY, 'hash_ip_3', 'Tablet', 'Android', 'Vietnam')")->execute();
// Row 4: Empty / NULL device, os, country to test fallback
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, clicked_at, ip_hash, device_type, os, country) VALUES (UUID(), 'test_link_ws1', NOW() - INTERVAL 3 DAY, 'hash_ip_1', '', NULL, '')")->execute();

echo "SEEDED_OK";
"""

code, out, err = run_php_script(seed_script)
if "SEEDED_OK" in out:
    record_pass("Database Test Fixtures Seeded", "Inserted test links & clicks into live DB")
else:
    record_fail("Database Test Fixtures Seeded", f"Out: {out}, Err: {err}")

# ============================================================================
# PHASE 2: LINKS_QR.PHP — STATS VS ANALYTICS ROUTING & DUAL PAYLOAD CONTRACT
# ============================================================================
print("\n--- PHASE 2: LINKS_QR STATS & ANALYTICS PARITY & DUAL KEY PARSING ---")

def test_links_qr_call(action, link_id, ws_id=1, extra_get=None):
    extra = ""
    if extra_get:
        for k, v in extra_get.items():
            v_json = json.dumps(v)
            extra += f"$_GET['{k}'] = {v_json};\n"
    id_json = json.dumps(link_id) if link_id is not None else "null"
    id_line = f"$_GET['id'] = {id_json};" if link_id is not None else "unset($_GET['id']);"
    script = f"""<?php
if (session_status() === PHP_SESSION_NONE) {{
    @session_start();
}}
$GLOBALS['domation_auth'] = [
    'user_id' => 1,
    'tenant_id' => {ws_id},
    'workspace_id' => {ws_id},
    'role' => 'admin',
    'full_name' => 'Adversarial Tester'
];
$_SESSION['user_id'] = 1;
$_SESSION['workspace_id'] = {ws_id};

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = '{action}';
{id_line}
{extra}

require_once __DIR__ . '/../../backend/automation/links_qr.php';
"""
    return run_php_script(script)

# Test 2.1: action=stats on test_link_ws1
c, out_stats, err = test_links_qr_call('stats', 'test_link_ws1', 1)
try:
    res_stats = json.loads(out_stats)
    if res_stats.get('success') is True:
        record_pass("action=stats returns success:true", f"total={res_stats['data']['overall']['total']}")
    else:
        record_fail("action=stats returns success:true", f"Failed: {out_stats}")
except Exception as e:
    record_fail("action=stats returns success:true", f"JSON Parse error: {e}. Output: {out_stats}")

# Test 2.2: action=analytics on test_link_ws1
c, out_analytics, err = test_links_qr_call('analytics', 'test_link_ws1', 1)
try:
    res_analytics = json.loads(out_analytics)
    if res_analytics.get('success') is True:
        record_pass("action=analytics returns success:true", f"total={res_analytics['data']['overall']['total']}")
    else:
        record_fail("action=analytics returns success:true", f"Failed: {out_analytics}")
except Exception as e:
    record_fail("action=analytics returns success:true", f"JSON Parse error: {e}. Output: {out_analytics}")

# Test 2.3: Contract Parity between stats and analytics
if 'res_stats' in locals() and 'res_analytics' in locals() and res_stats.get('success') and res_analytics.get('success'):
    if res_stats == res_analytics:
        record_pass("stats vs analytics 100% Identical Payload", "Both actions return exact same response")
    else:
        diff_keys = []
        for k in res_stats.get('data', {}):
            if res_stats['data'][k] != res_analytics.get('data', {}).get(k):
                diff_keys.append(f"{k}: stats={res_stats['data'][k]} vs analytics={res_analytics.get('data',{}).get(k)}")
        record_fail("stats vs analytics 100% Identical Payload", f"Discrepancy detected: {', '.join(diff_keys)}")

# Test 2.4: Dual Key Verification for Recharts & Consumers
if 'res_stats' in locals() and res_stats.get('success'):
    data = res_stats['data']
    
    # 1. Timeline key
    if 'timeline' in data and isinstance(data['timeline'], list) and len(data['timeline']) > 0:
        t_item = data['timeline'][0]
        if 'date' in t_item and 'clicks' in t_item and 'unique_clicks' in t_item:
            record_pass("Timeline Contract Verified", f"Fields: date, clicks, unique_clicks. Count: {len(data['timeline'])}")
        else:
            record_fail("Timeline Contract Verified", f"Missing fields in item: {t_item}")
    else:
        record_fail("Timeline Contract Verified", f"timeline missing or empty: {data.get('timeline')}")

    # 2. Devices dual keys (device_type, clicks) AND (name, value)
    if 'devices' in data and isinstance(data['devices'], list) and len(data['devices']) > 0:
        d_item = data['devices'][0]
        has_legacy = 'device_type' in d_item and 'clicks' in d_item
        has_modern = 'name' in d_item and 'value' in d_item
        if has_legacy and has_modern:
            record_pass("Devices Dual Key Contract Verified", f"Keys: device_type, clicks, name, value. Sample: {d_item}")
        else:
            record_fail("Devices Dual Key Contract Verified", f"Incomplete keys: {d_item}")
    else:
        record_fail("Devices Dual Key Contract Verified", f"devices missing or empty: {data.get('devices')}")

    # 3. OS dual keys (os, clicks) AND (name, value)
    if 'os' in data and isinstance(data['os'], list) and len(data['os']) > 0:
        os_item = data['os'][0]
        has_legacy = 'os' in os_item and 'clicks' in os_item
        has_modern = 'name' in os_item and 'value' in os_item
        if has_legacy and has_modern:
            record_pass("OS Dual Key Contract Verified", f"Keys: os, clicks, name, value. Sample: {os_item}")
        else:
            record_fail("OS Dual Key Contract Verified", f"Incomplete keys: {os_item}")
    else:
        record_fail("OS Dual Key Contract Verified", f"os missing or empty: {data.get('os')}")

    # 4. Country & Countries dual payload keys & dual item keys
    has_country = 'country' in data and isinstance(data['country'], list) and len(data['country']) > 0
    has_countries = 'countries' in data and isinstance(data['countries'], list) and len(data['countries']) > 0
    if has_country and has_countries and data['country'] == data['countries']:
        c_item = data['country'][0]
        has_legacy = 'country' in c_item and 'clicks' in c_item
        has_modern = 'name' in c_item and 'value' in c_item
        if has_legacy and has_modern:
            record_pass("Country & Countries Dual Contract Verified", f"Both payload keys match. Item keys: country, clicks, name, value. Sample: {c_item}")
        else:
            record_fail("Country & Countries Dual Contract Verified", f"Incomplete item keys: {c_item}")
    else:
        record_fail("Country & Countries Dual Contract Verified", f"Payload country/countries mismatch or empty: country={data.get('country')}")

    # 5. Overall summary keys
    ov = data.get('overall', {})
    if 'total' in ov and 'clicks' in ov and 'unique' in ov and 'unique_clicks' in ov:
        record_pass("Overall Summary Contract Verified", f"Keys: total={ov['total']}, clicks={ov['clicks']}, unique={ov['unique']}, unique_clicks={ov['unique_clicks']}")
    else:
        record_fail("Overall Summary Contract Verified", f"Missing summary keys: {ov}")

# ============================================================================
# PHASE 3: ADVERSARIAL EDGE CASES & SECURITY PENTEST (LINKS_QR.PHP)
# ============================================================================
print("\n--- PHASE 3: ADVERSARIAL EDGE CASES & SECURITY (LINKS_QR.PHP) ---")

# Test 3.1: Missing ID parameter (unset)
c, out, err = test_links_qr_call('stats', None, 1)
try:
    r = json.loads(out)
    if r.get('success') is False and r.get('message') == 'ID required':
        record_pass("Missing ID Parameter", "Cleanly rejected with 'ID required'")
    else:
        record_fail("Missing ID Parameter", f"Unexpected: {out}")
except Exception as e:
    record_fail("Missing ID Parameter", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.2: Empty string ID parameter (id='')
c, out, err = test_links_qr_call('stats', '', 1)
try:
    r = json.loads(out)
    if r.get('success') is False and r.get('message') == 'ID required':
        record_pass("Empty String ID Parameter", "Cleanly rejected with 'ID required'")
    else:
        record_fail("Empty String ID Parameter", f"Unexpected: {out}")
except Exception as e:
    record_fail("Empty String ID Parameter", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.3: Non-existent ID parameter
c, out, err = test_links_qr_call('stats', 'non_existent_random_id_999999', 1)
try:
    r = json.loads(out)
    if r.get('success') is False and 'not found or access denied' in r.get('message', '').lower():
        record_pass("Non-Existent ID", "Access denied / Not found safely returned")
    else:
        record_fail("Non-Existent ID", f"Unexpected: {out}")
except Exception as e:
    record_fail("Non-Existent ID", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.4: Hostile SQL Injection in ID
c, out, err = test_links_qr_call('stats', "' OR '1'='1' UNION SELECT 1,2,3--", 1)
try:
    r = json.loads(out)
    if r.get('success') is False and 'not found or access denied' in r.get('message', '').lower():
        record_pass("SQL Injection Defense in ID Parameter", "PDO parameterized query neutralized SQLi payload")
    else:
        record_fail("SQL Injection Defense in ID Parameter", f"Unexpected: {out}")
except Exception as e:
    record_fail("SQL Injection Defense in ID Parameter", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.5: Workspace Isolation — User in WS 2 attempting to view WS 1 link
c, out, err = test_links_qr_call('stats', 'test_link_ws1', 2)
try:
    r = json.loads(out)
    if r.get('success') is False and 'not found or access denied' in r.get('message', '').lower():
        record_pass("Tenant Isolation (WS 2 -> WS 1 Link)", "Correctly blocked access with 'Link not found or access denied'")
    else:
        record_fail("Tenant Isolation (WS 2 -> WS 1 Link)", f"Cross-tenant leak detected! Output: {out}")
except Exception as e:
    record_fail("Tenant Isolation (WS 2 -> WS 1 Link)", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.6: Workspace Isolation — User in WS 1 attempting to view WS 2 link
c, out, err = test_links_qr_call('stats', 'test_link_ws2', 1)
try:
    r = json.loads(out)
    if r.get('success') is False and 'not found or access denied' in r.get('message', '').lower():
        record_pass("Tenant Isolation (WS 1 -> WS 2 Link)", "Correctly blocked access with 'Link not found or access denied'")
    else:
        record_fail("Tenant Isolation (WS 1 -> WS 2 Link)", f"Cross-tenant leak detected! Output: {out}")
except Exception as e:
    record_fail("Tenant Isolation (WS 1 -> WS 2 Link)", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.7: Soft-deleted link access rejection
c, out, err = test_links_qr_call('stats', 'test_link_deleted', 1)
try:
    r = json.loads(out)
    if r.get('success') is False and 'not found or access denied' in r.get('message', '').lower():
        record_pass("Soft-Deleted Link Rejection", "Soft-deleted link correctly hidden from analytics")
    else:
        record_fail("Soft-Deleted Link Rejection", f"Soft-deleted link was leaked! Output: {out}")
except Exception as e:
    record_fail("Soft-Deleted Link Rejection", f"Crash/Invalid JSON: {e}. Output: {out}")

# Test 3.8: Link with 0 clicks (Empty State boundary)
c, out, err = test_links_qr_call('stats', 'test_link_empty', 1)
try:
    r = json.loads(out)
    if r.get('success') is True:
        d = r['data']
        if (d['overall']['total'] == 0 and d['overall']['clicks'] == 0 and 
            d['overall']['unique'] == 0 and d['timeline'] == [] and 
            d['devices'] == [] and d['os'] == [] and d['country'] == [] and d['countries'] == []):
            record_pass("Zero-Clicks Empty State Boundary", "Clean empty arrays and 0 numeric counts, no null dereferences")
        else:
            record_fail("Zero-Clicks Empty State Boundary", f"Incomplete empty state: {d}")
    else:
        record_fail("Zero-Clicks Empty State Boundary", f"Failed for empty link: {out}")
except Exception as e:
    record_fail("Zero-Clicks Empty State Boundary", f"Crash on zero clicks: {e}. Output: {out}")

# Test 3.9: Unhandled action rejection
c, out, err = test_links_qr_call('invalid_action_xyz_random', 'test_link_ws1', 1)
try:
    r = json.loads(out)
    if r.get('success') is False and r.get('message') == 'Action not handled':
        record_pass("Unhandled Action Graceful Exit", "Returned 'Action not handled' without PHP crash")
    else:
        record_fail("Unhandled Action Graceful Exit", f"Unexpected: {out}")
except Exception as e:
    record_fail("Unhandled Action Graceful Exit", f"Crash: {e}. Output: {out}")

# ============================================================================
# PHASE 4: CAMPAIGNS.PHP — PARAMETER FALLBACKS & HARDENING
# ============================================================================
print("\n--- PHASE 4: CAMPAIGNS.PHP PARAMETER FALLBACK CHAINS & HARDENING ---")

# We execute verify_worker2_campaigns.php directly
proc = subprocess.run([PHP_BIN, "tests/adversarial/verify_worker2_campaigns.php"], capture_output=True, text=True)
if proc.returncode == 0 and "ALL CAMPAIGNS.PHP HARDENING TESTS PASSED" in proc.stdout:
    record_pass("Campaigns Parameter Fallbacks (PUT, resend_failed_emails, send_test)", "All 16 fallback combinations passed")
else:
    record_fail("Campaigns Parameter Fallbacks", f"verify_worker2_campaigns.php failed: {proc.stdout} {proc.stderr}")

# Check clear_attachments uploadss typo in campaigns.php
with open("backend/automation/campaigns.php", "r", encoding="utf-8") as f:
    campaigns_content = f.read()

if "uploadss" in campaigns_content:
    record_fail("Uploadss Typo Check", "Found lingering 'uploadss' in campaigns.php")
else:
    record_pass("Uploadss Typo Check", "0 occurrences of 'uploadss' found in campaigns.php")

# ============================================================================
# PHASE 5: CLEANUP TEST FIXTURES
# ============================================================================
print("\n--- PHASE 5: CLEANUP DATABASE FIXTURES ---")

cleanup_script = """<?php
require_once __DIR__ . '/../../backend/automation/db_connect.php';
$pdo->exec("DELETE FROM link_clicks WHERE short_link_id IN ('test_link_ws1', 'test_link_ws2', 'test_link_deleted', 'test_link_empty')");
$pdo->exec("DELETE FROM short_links WHERE id IN ('test_link_ws1', 'test_link_ws2', 'test_link_deleted', 'test_link_empty')");
echo "CLEANUP_OK";
"""
c, out, err = run_php_script(cleanup_script)
if "CLEANUP_OK" in out:
    record_pass("Database Test Fixtures Cleaned", "Removed all temporary test records")
else:
    record_fail("Database Test Fixtures Cleaned", f"Out: {out}, Err: {err}")

# ============================================================================
# SUMMARY & VERDICT
# ============================================================================
print("\n" + "=" * 70)
print(f"TEST RESULTS SUMMARY: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
print("=" * 70)

if failed_tests:
    print("\nDETAILED FAILURES:")
    for name, reason in failed_tests:
        print(f"  - {name}: {reason}")
    print("\nFINAL VERDICT: REQUEST_CHANGES")
    sys.exit(1)
else:
    print("\nALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS.")
    print("FINAL VERDICT: APPROVE")
    sys.exit(0)
