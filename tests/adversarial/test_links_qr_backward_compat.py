import os
import shutil
import subprocess
import json
import sys

PHP_BIN = os.environ.get("PHP_BIN") or shutil.which("php") or "php"

test_script = """<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = 'stats';
$_GET['id'] = 'lnk_123';
$_SESSION['user_id'] = 1;
$_SESSION['workspace_id'] = 1;
require_once __DIR__ . '/../../backend/automation/links_qr.php';
"""

with open("tests/adversarial/temp_run_stats.php", "w", encoding="utf-8") as f:
    f.write(test_script)

res = subprocess.run([PHP_BIN, "tests/adversarial/temp_run_stats.php"], capture_output=True, text=True)
stdout = res.stdout.strip()
print("STDOUT:", stdout)
if res.stderr.strip():
    print("STDERR:", res.stderr.strip())

try:
    data = json.loads(stdout)
    if data.get("success") is False and data.get("message") == "Action not handled":
        print("\n[CONFIRMED DEFECT] 'action=stats' was deleted from links_qr.php, breaking Web App LinksQR.tsx!")
        sys.exit(1)
    else:
        print("[PASS] Handled action=stats correctly")
        sys.exit(0)
except Exception as e:
    print(f"Error parsing JSON: {e}")
    sys.exit(2)
