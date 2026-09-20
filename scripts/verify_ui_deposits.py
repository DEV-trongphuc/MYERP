import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== CHECK FIRST 15 DEPOSITS IN LIST (WHAT UI SHOWS) ===")
print(query("""
SELECT d.id, d.unit_code, c.full_name as customer_name, d.price, d.created_at, d.accountant_id, d.participant_ids
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
ORDER BY d.created_at DESC
LIMIT 15;
"""))
