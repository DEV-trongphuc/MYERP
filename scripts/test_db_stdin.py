import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = ['mysql', '-u', 'vhvxoigh_mail_auto', '-pIdeas@812', 'vhvxoigh_myerp', '--default-character-set=utf8mb4']
    proc = subprocess.run(SSH_CMD + remote, input=sql, capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== 1. FIND NGUYỄN THU THẢO ===")
print(query("SELECT id, name, email, role, department FROM users WHERE name LIKE '%Thảo%' OR name LIKE '%Thao%';"))
print(query("SELECT id, name, email, role, department FROM users;"))
