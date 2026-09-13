import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def run_query(sql):
    remote_cmd = f'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e "{sql}"'
    proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
    return proc.stdout.decode('utf-8', errors='replace'), proc.stderr.decode('utf-8', errors='replace')

out, err = run_query("SHOW INDEX FROM activities;")
print("Current indexes:")
for line in out.strip().split('\n'):
    parts = line.split('\t')
    if len(parts) > 4:
        print(f"Index: {parts[2]} | Col: {parts[4]} | Seq: {parts[3]}")
