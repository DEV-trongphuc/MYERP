import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

res = query("""
SELECT d.id, d.unit_code, c.id as cid, c.full_name, d.price, d.participant_ids, d.accountant_id
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
ORDER BY d.id ASC;
""")

print("All 69 deposits in DB:")
for l in res.strip().split('\n')[1:]:
    print(l)
