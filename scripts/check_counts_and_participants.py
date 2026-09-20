import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== CHECK COUNTS ===")
print("mail_queue count:", query("SELECT COUNT(*) FROM mail_queue;").strip().split('\n')[-1])
print("notifications count:", query("SELECT COUNT(*) FROM notifications;").strip().split('\n')[-1])

print("\n=== SAMPLE DEPOSITS PARTICIPANT_IDS ===")
print(query("SELECT id, unit_code, participant_ids, accountant_id FROM deposits WHERE participant_ids IS NOT NULL LIMIT 10;"))
print(query("SELECT COUNT(*) as total_deposits, COUNT(participant_ids) as has_participants, COUNT(accountant_id) as has_accountant FROM deposits;"))
