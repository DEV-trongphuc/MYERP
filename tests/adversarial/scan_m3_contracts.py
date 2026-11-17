"""
Adversarial Contract & Route Scanner for Milestone 3 (Iteration 2)
Checks:
- campaigns.php
- web_tracking.php
- webhook.php
- go.php
- zalo_track.php
- zalo_tracking.php
- links_qr.php
Against all frontend call sites in src/
"""

import os
import re
import json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def find_frontend_calls():
    src_dir = os.path.join(ROOT, 'src')
    patterns = [
        re.compile(r"""(?:api|axios|domationApi)\.(get|post|put|delete|patch)\s*(?:<[^>]+>)?\s*\(\s*[`'"]([^`'"]+)[`'"]""", re.IGNORECASE),
        re.compile(r"""(?:api|axios|domationApi)\.(get|post|put|delete|patch)\s*(?:<[^>]+>)?\s*\(\s*`([^`]+)`""", re.IGNORECASE),
    ]
    
    calls = []
    for dirpath, _, filenames in os.walk(src_dir):
        for f in filenames:
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                continue
            fpath = os.path.join(dirpath, f)
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    for pat in patterns:
                        for match in pat.finditer(line):
                            method = match.group(1).upper()
                            endpoint = match.group(2)
                            calls.append({
                                'file': os.path.relpath(fpath, ROOT),
                                'line': line_idx,
                                'method': method,
                                'raw_endpoint': endpoint,
                                'snippet': line.strip()
                            })
    return calls

if __name__ == '__main__':
    calls = find_frontend_calls()
    print(f"Total frontend API call sites detected: {len(calls)}")
    
    m3_keywords = ['campaigns', 'web_tracking', 'web_properties', 'visitors', 'webhook', 'go', 'zalo_track', 'zalo_tracking', 'links_qr', 'short_links']
    m3_calls = [c for c in calls if any(k in c['raw_endpoint'].lower() for k in m3_keywords)]
    print(f"Total M3-related frontend API call sites: {len(m3_calls)}")
    
    for c in m3_calls:
        print(f"[{c['method']}] {c['raw_endpoint']} -> {c['file']}:{c['line']}")
