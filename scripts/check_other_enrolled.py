import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']
sql = 'SELECT id, full_name, phone, status, pipeline_status, admission_date, created_at FROM contacts WHERE pipeline_status = "enrolled" AND id < 1024700 ORDER BY id DESC LIMIT 10;'
remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e \'' + sql + '\''
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print(proc.stdout.decode('utf-8', errors='replace'))
