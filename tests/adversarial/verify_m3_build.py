import subprocess
import shutil
import sys
import os

PHP_BIN = os.environ.get("PHP_BIN") or shutil.which("php") or "php"

files = [
    r"backend\automation\tracking_processor.php",
    r"backend\automation\zalo_tracking.php",
    r"backend\automation\zalo_track.php",
    r"backend\automation\worker_tracking_aggregator.php",
    r"backend\automation\webhook.php",
    r"backend\automation\Mailer.php",
    r"backend\automation\go.php",
    r"backend\automation\links_qr.php",
    r"backend\automation\campaigns.php",
    r"backend\automation\track.php",
    r"backend\automation\web_tracking.php",
    r"backend\migrations\332_sync_tracking_unique_cache_and_soft_delete.php",
]

print("=== VERIFYING PHP SYNTAX (php -l) ===")
all_passed = True
for f in files:
    full_path = os.path.abspath(f)
    if not os.path.exists(full_path):
        print(f"[MISSING] {f}")
        all_passed = False
        continue
    res = subprocess.run([PHP_BIN, "-l", full_path], capture_output=True, text=True)
    if res.returncode == 0:
        print(f"[PASS] {f}: {res.stdout.strip()}")
    else:
        print(f"[FAIL] {f} (code {res.returncode}):\n{res.stderr.strip()}\n{res.stdout.strip()}")
        all_passed = False

if not all_passed:
    print("PHP linting FAILED.")
    sys.exit(1)
else:
    print("ALL 12 PHP FILES PASSED php -l WITH EXIT CODE 0.")
