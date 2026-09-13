import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']
sql = "SELECT * FROM distribution_logs WHERE lead_id = 1678 \\G"
remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e \'' + sql.replace('\n', ' ') + '\''
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print(proc.stdout.decode('utf-8', errors='replace'))
if proc.stderr:
    print("STDERR:", proc.stderr.decode('utf-8', errors='replace'))
