"""
Analyze all M3 frontend calls in detail
"""

import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

with open(os.path.join(ROOT, 'tests', 'adversarial', 'scan_m3_contracts.py'), 'r', encoding='utf-8') as fp:
    from scan_m3_contracts import find_frontend_calls

calls = find_frontend_calls()

m3_files = {
    'campaigns': [],
    'web_tracking': [],
    'webhook': [],
    'go': [],
    'zalo_track': [],
    'zalo_tracking': [],
    'links_qr': []
}

for c in calls:
    ep = c['raw_endpoint'].lower()
    if 'campaign' in ep and not 'meta' in ep and not 'voucher' in ep:
        m3_files['campaigns'].append(c)
    if 'web_tracking' in ep or 'web_properties' in ep or 'visitor' in ep:
        m3_files['web_tracking'].append(c)
    if 'webhook' in ep:
        m3_files['webhook'].append(c)
    if 'go.php' in ep or '/go/' in ep:
        m3_files['go'].append(c)
    if 'zalo_track' in ep:
        m3_files['zalo_track'].append(c)
    if 'zalo_tracking' in ep:
        m3_files['zalo_tracking'].append(c)
    if 'links_qr' in ep or 'short_link' in ep:
        m3_files['links_qr'].append(c)

print("=== M3 CALL BREAKDOWN ===")
for k, v in m3_files.items():
    print(f"\n--- {k.upper()} ({len(v)} calls) ---")
    # Deduplicate by (method, endpoint)
    seen = set()
    for item in v:
        sig = (item['method'], item['raw_endpoint'])
        if sig not in seen:
            seen.add(sig)
            print(f"[{item['method']}] {item['raw_endpoint']} (e.g. at {item['file']}:{item['line']})")
