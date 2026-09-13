import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

remote_cmd = '''mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e "SELECT id, title, amount, currency FROM expenses WHERE id = 425;"'''
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print("STDOUT:", proc.stdout.decode('utf-8', errors='replace'))
print("STDERR:", proc.stderr.decode('utf-8', errors='replace'))
