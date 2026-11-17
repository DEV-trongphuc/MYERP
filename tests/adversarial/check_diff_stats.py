import subprocess
import os

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
    r"src\components\marketing\components\campaigns\CampaignDetailDrawer.tsx",
    r"src\components\marketing\components\campaigns\TechStatsTab.tsx",
]

for f in files:
    print(f"\n=======================================================")
    print(f"DIFF FOR: {f}")
    print(f"=======================================================")
    res = subprocess.run(["git", "diff", "--stat", f], capture_output=True, text=True)
    print(res.stdout.strip())
