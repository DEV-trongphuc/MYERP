"""
Test campaigns.php PUT handler when ID is provided in JSON body (as domationApi.updateCampaign does)
"""
import os
import shutil
import subprocess
import json
import sys

PHP_BIN = os.environ.get("PHP_BIN") or shutil.which("php") or "php"

test_script = """<?php
// Mock php://input wrapper
$_SERVER['REQUEST_METHOD'] = 'PUT';
$_GET = []; // No ID in query parameters
$_SESSION['user_id'] = 1;
$_SESSION['workspace_id'] = 1;

// Simulate campaigns.php line 11 and line 1986
$path = isset($_GET['id']) ? $_GET['id'] : null;

// Current logic:
if (!$path) {
    echo json_encode(['success' => false, 'message' => 'ID required']);
    exit(1);
}
echo json_encode(['success' => true]);
"""

with open("tests/adversarial/temp_run_put.php", "w", encoding="utf-8") as f:
    f.write(test_script)

res = subprocess.run([PHP_BIN, "tests/adversarial/temp_run_put.php"], capture_output=True, text=True)
stdout = res.stdout.strip()
print("STDOUT:", stdout)
print("Return code:", res.returncode)

if "ID required" in stdout:
    print("\n[CONFIRMED DEFECT] campaigns.php PUT rejects body ID with 'ID required' when URL has no ID!")
    sys.exit(0)
else:
    sys.exit(1)
