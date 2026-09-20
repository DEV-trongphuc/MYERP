import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@103.110.87.26']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    if proc.stderr:
        print("STDERR:", proc.stderr, file=sys.stderr)
    return proc.stdout

migration_sql = """
UPDATE expenses SET date = '2026-09-25' WHERE id = 1504;
SELECT id, title, amount, currency, date, status, updated_at FROM expenses WHERE id = 1504;
"""

print("=== MIGRATING EXPENSES #1504 DUE DATE ===")
print(query(migration_sql))
