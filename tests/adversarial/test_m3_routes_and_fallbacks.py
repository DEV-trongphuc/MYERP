"""
Comprehensive Adversarial Route & Parameter Fallback Audit for Milestone 3 (Iteration 2)
Audits:
1. backend/automation/campaigns.php
2. backend/automation/web_tracking.php
3. backend/automation/webhook.php
4. backend/automation/go.php
5. backend/automation/zalo_track.php
6. backend/automation/zalo_tracking.php
7. backend/automation/links_qr.php
"""

import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def inspect_file(rel_path):
    path = os.path.join(ROOT, rel_path)
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()

def run_audit():
    findings = []
    
    # ── 1. campaigns.php ──
    camp_code = inspect_file('backend/automation/campaigns.php')
    
    # Check PUT id fallback
    put_match = re.search(r"case\s*'PUT':\s*try\s*\{\s*if\s*\(!\$path\)", camp_code)
    if put_match:
        findings.append({
            'file': 'backend/automation/campaigns.php',
            'severity': 'MEDIUM',
            'category': 'Missing Parameter Fallback',
            'description': "PUT handler requires $path ($_GET['id']) upfront before reading body ($data = json_decode(...)). If client calls PUT 'campaigns' with id in JSON body (as domationApi.updateCampaign does), request fails with 'ID required'."
        })
    
    # Check resend_failed_emails parameter fallback
    resend_match = re.search(r"if\s*\(\$method\s*===\s*'POST'\s*&&\s*\$route\s*===\s*'resend_failed_emails'\)\s*\{\s*try\s*\{\s*\$data\s*=\s*json_decode[^\n]+;\s*\$campaignId\s*=\s*\$data\['campaign_id'\]\s*\?\?\s*null;", camp_code)
    if resend_match:
        findings.append({
            'file': 'backend/automation/campaigns.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "resend_failed_emails only checks $data['campaign_id']. Lacks fallback to $data['id'] or $_GET['id']."
        })
    
    # Check send_test campaign_id parameter fallback
    send_test_match = re.search(r"if\s*\(\$method\s*===\s*'POST'\s*&&\s*\$route\s*===\s*'send_test'\)[^}]+?\$campaignId\s*=\s*\$data\['campaign_id'\];", camp_code)
    if send_test_match:
        findings.append({
            'file': 'backend/automation/campaigns.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "send_test uses $campaignId = $data['campaign_id'] directly without null coalescing or fallback to $data['id'] or $_GET['id']."
        })

    # Check uploadss typo in clear_attachments
    if '/../uploadss/' in camp_code:
        findings.append({
            'file': 'backend/automation/campaigns.php',
            'severity': 'LOW',
            'category': 'Code Cleanliness & Dead Code',
            'description': "clear_attachments contains typo '/../uploadss/' (double 's') and line 628 has an unreachable duplicate handler for 'clear_attachments'."
        })

    # ── 2. web_tracking.php ──
    wt_code = inspect_file('backend/automation/web_tracking.php')
    
    # Check DELETE parameter fallback
    del_match = re.search(r"if\s*\(\$method\s*===\s*'DELETE'\)\s*\{\s*try\s*\{\s*\$id\s*=\s*\$_GET\['id'\]\s*\?\?\s*'';", wt_code)
    if del_match:
        findings.append({
            'file': 'backend/automation/web_tracking.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "DELETE handler in web_tracking.php only checks $_GET['id']. Does not check input body ($input['id'] or $input['property_id']) or $_GET['property_id']."
        })

    # Check stats property_id parameter fallback
    stats_match = re.search(r"if\s*\(\$method\s*===\s*'GET'\s*&&\s*\$action\s*===\s*'stats'\)\s*\{\s*try\s*\{\s*\$id\s*=\s*\$_GET\['id'\]\s*\?\?\s*'';", wt_code)
    if stats_match:
        findings.append({
            'file': 'backend/automation/web_tracking.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "stats action in web_tracking.php only checks $_GET['id']. Does not check $_GET['property_id']."
        })

    # ── 3. go.php ──
    go_code = inspect_file('backend/automation/go.php')
    
    # Check slug parameter fallback
    if "$slug = $_GET['s'] ?? '';" in go_code:
        findings.append({
            'file': 'backend/automation/go.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "go.php only checks $_GET['s']. Lacks fallback to $_GET['slug'], and only splits PATH_INFO on '/go.php/' without fallback for direct '/go/' paths."
        })

    # ── 4. zalo_track.php ──
    zt_code = inspect_file('backend/automation/zalo_track.php')
    if "$rawUrl = $_GET['u'] ?? '';" in zt_code:
        findings.append({
            'file': 'backend/automation/zalo_track.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "zalo_track.php only checks single-letter params ('u', 'sid', 'uid', 'lbl'). Lacks fallbacks to standard full-name params ('url', 'scenario_id'/'flow_id', 'user_id'/'zalo_user_id', 'label')."
        })

    # ── 5. zalo_tracking.php ──
    ztk_code = inspect_file('backend/automation/zalo_tracking.php')
    if "$subId = $_GET['sub_id'] ?? null;" in ztk_code and "?? $_GET['sid']" not in ztk_code:
        findings.append({
            'file': 'backend/automation/zalo_tracking.php',
            'severity': 'LOW',
            'category': 'Missing Parameter Fallback',
            'description': "zalo_tracking.php checks 'sub_id', 'flow_id', 'step_id', 'url'. Lacks fallbacks to short aliases ('sid', 'fid', 'rid', 'u') used in webhook.php."
        })

    # ── 6. links_qr.php ──
    lqr_code = inspect_file('backend/automation/links_qr.php')
    if "if ($action === 'analytics')" in lqr_code and "stats" not in lqr_code.split("if ($action === 'analytics')")[1].split("if ($method === 'POST'")[0]:
        findings.append({
            'file': 'backend/automation/links_qr.php',
            'severity': 'HIGH',
            'category': 'Contract Breakage / Regression (DEF-CHAL2-01)',
            'description': "links_qr.php lacks 'action=stats' route alias, lacks 'timeline' data, and renames 'country' to 'countries', breaking LinksQR.tsx:348."
        })

    print(f"\nAudit complete. Total findings: {len(findings)}\n")
    for idx, f in enumerate(findings, 1):
        print(f"[{f['severity']}] Finding {idx}: {f['category']}")
        print(f"  File: {f['file']}")
        print(f"  Details: {f['description']}\n")

if __name__ == '__main__':
    run_audit()
