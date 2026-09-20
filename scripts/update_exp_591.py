import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout, proc.stderr

print("=== UPDATING EXP-591 CURRENCY TO CHF ===")
out, err = query("UPDATE expenses SET currency = 'CHF' WHERE id = 591;")
print("Update output:", out, err)

print("=== VERIFYING EXP-591 ===")
out, err = query("SELECT id, amount, currency, title, status FROM expenses WHERE id = 591;")
print(out)
