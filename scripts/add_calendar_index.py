import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def run_query(sql):
    remote_cmd = f'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e "{sql}"'
    proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
    return proc.stdout.decode('utf-8', errors='replace'), proc.stderr.decode('utf-8', errors='replace')

sql = "CREATE INDEX idx_activities_calendar ON activities (tenant_id, deleted_at, due_date, user_id);"
print("Adding index...")
out, err = run_query(sql)
print("Out:", out)
print("Err:", err)

out2, err2 = run_query("SHOW INDEX FROM activities WHERE Key_name = 'idx_activities_calendar';")
print("Verified index:")
print(out2)
