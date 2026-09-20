import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import subprocess

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    proc = subprocess.Popen(
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    out, err = proc.communicate(input=sql)
    return out

print("=== 1. AUDIT BEFORE ===")
mail_pre = query("SELECT COUNT(*) FROM mail_queue;").strip().split()[-1]
notif_pre = query("SELECT COUNT(*) FROM notifications;").strip().split()[-1]
dep_pre = query("SELECT COUNT(*) FROM deposits;").strip().split()[-1]
ms_pre = query("SELECT COUNT(*) FROM deposit_milestones;").strip().split()[-1]
print(f"mail_queue before: {mail_pre}")
print(f"notifications before: {notif_pre}")
print(f"deposits before: {dep_pre}")
print(f"deposit_milestones before: {ms_pre}")

print("\n=== 2. EXECUTING sync_misa.sql ===")
with open(r'd:\GITHUB_SPACE\MYERP\scripts\sync_misa.sql', 'r', encoding='utf-8') as f:
    sql_content = f.read()

proc = subprocess.Popen(
    SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding='utf-8'
)
out, err = proc.communicate(input=sql_content)
if err:
    print("STDERR/NOTICES:", err)
print("EXECUTION COMPLETED.")

print("\n=== 3. AUDIT AFTER ===")
mail_post = query("SELECT COUNT(*) FROM mail_queue;").strip().split()[-1]
notif_post = query("SELECT COUNT(*) FROM notifications;").strip().split()[-1]
dep_post = query("SELECT COUNT(*) FROM deposits;").strip().split()[-1]
ms_post = query("SELECT COUNT(*) FROM deposit_milestones;").strip().split()[-1]
print(f"mail_queue after: {mail_post} (diff: {int(mail_post) - int(mail_pre)})")
print(f"notifications after: {notif_post} (diff: {int(notif_post) - int(notif_pre)})")
print(f"deposits after: {dep_post} (diff: +{int(dep_post) - int(dep_pre)})")
print(f"deposit_milestones after: {ms_post} (diff: +{int(ms_post) - int(ms_pre)})")

print("\n=== 4. VERIFY FIXED CUSTOMER NAMES IN DEPOSITS ===")
verify_sql = """
SELECT d.id, d.unit_code, c.full_name as customer_name, d.price, d.accountant_id, d.participant_ids
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
WHERE d.id IN (149, 150, 151, 152, 153, 154, 155, 173, 177, 189)
ORDER BY d.id ASC;
"""
print(query(verify_sql))
