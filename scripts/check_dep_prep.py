import openpyxl
import subprocess
import sys
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

# Check projects in DB
projects_raw = query("SELECT id, name FROM projects;")
print("Projects in DB:\n", projects_raw)

# Check contacts count and sample
contacts_raw = query("SELECT id, full_name, program, owner_id FROM contacts WHERE full_name LIKE '%HOÀNG PHI%' LIMIT 1;")
print("Sample contact HOÀNG PHI:\n", contacts_raw)
