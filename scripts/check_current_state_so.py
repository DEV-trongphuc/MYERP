import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== DEPOSITS 149, 154, 155, 173 ===")
print(query("SELECT id, unit_code, contact_id, accountant_id, participant_ids FROM deposits WHERE id IN (149, 154, 155, 173);"))

print("=== NEW CONTACTS RECENTLY CREATED ===")
print(query("SELECT id, full_name, owner_id, created_at FROM contacts WHERE id >= 1024800 ORDER BY id DESC LIMIT 30;"))

print("=== TOTAL CONTACTS AND DEPOSITS ===")
print(query("SELECT COUNT(*) FROM contacts;"))
print(query("SELECT COUNT(*) FROM deposits;"))
print(query("SELECT COUNT(*) FROM deposit_milestones;"))
