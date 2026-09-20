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
UPDATE users SET bank_name = 'HDBank', bank_account = '999990365042908' WHERE id = 100059;
UPDATE users SET bank_name = 'HDBank', bank_account = '150704070008814' WHERE id = 100060;
UPDATE users SET bank_name = 'HDBank', bank_account = '999991008020999' WHERE id = 100061;
UPDATE users SET bank_name = 'HDBank', bank_account = '150704070006851' WHERE id = 100062;
SELECT id, username, full_name, role, bank_name, bank_account FROM users WHERE id IN (100059, 100060, 100061, 100062);
"""

print("=== EXECUTING BANK MIGRATION ===")
print(query(migration_sql))
