import os
import re

files_to_check = [
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
    r"src\components\marketing\components\campaigns\CampaignDetailDrawer.tsx",
    r"src\components\marketing\components\campaigns\TechStatsTab.tsx",
]

print("=== CHECKING CODE CLEANLINESS & DEBUG ARTIFACTS ===")

# In PHP: check var_dump, print_r (without return), die( (unless standard exit with json), dd(, console.log in TSX
patterns = [
    (r"\bvar_dump\s*\(", "var_dump"),
    (r"\bprint_r\s*\([^,)]+\)", "print_r without return true"),
    (r"\bdd\s*\(", "Laravel/Symfony dump-and-die"),
    (r"\bxdebug_", "xdebug artifact"),
]

findings = []

for f in files_to_check:
    full_path = os.path.abspath(f)
    if not os.path.exists(full_path):
        continue
    with open(full_path, "r", encoding="utf-8", errors="ignore") as fp:
        lines = fp.readlines()
    
    for idx, line in enumerate(lines, 1):
        # strip comments
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*") or stripped.startswith("#"):
            continue
        for pat, desc in patterns:
            if re.search(pat, line):
                findings.append((f, idx, desc, stripped))

print(f"Total debug artifact findings: {len(findings)}")
for f, idx, desc, stripped in findings:
    print(f"  {f}:{idx} [{desc}] -> {stripped}")

# Check die() / exit() usage in backend files
print("\n=== CHECKING DIE() / EXIT() CALLS ===")
exit_findings = []
for f in files_to_check:
    if not f.endswith(".php"):
        continue
    full_path = os.path.abspath(f)
    with open(full_path, "r", encoding="utf-8", errors="ignore") as fp:
        lines = fp.readlines()
    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*") or stripped.startswith("#"):
            continue
        if re.search(r"\bdie\s*\(", stripped) or re.search(r"\bexit\s*\(?", stripped):
            # Check context: is it an intentional fast exit after 302 or JSON error?
            exit_findings.append((f, idx, stripped))

print(f"Total exit/die occurrences: {len(exit_findings)}")
for f, idx, code in exit_findings[:20]:
    print(f"  {f}:{idx} -> {code}")
if len(exit_findings) > 20:
    print(f"  ... and {len(exit_findings) - 20} more.")
