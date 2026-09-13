import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']
sql = 'SHOW INDEX FROM activities WHERE Column_name IN ("related_type", "related_id", "contact_id");'
remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e \'' + sql + '\''
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print(proc.stdout.decode('utf-8', errors='replace'))
