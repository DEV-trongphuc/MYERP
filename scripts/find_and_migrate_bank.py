import os
import subprocess
import sys

def _get_db_pass():
    if os.environ.get('DB_PASS'):
        return os.environ['DB_PASS']
    env_p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', '.env')
    if os.path.exists(env_p):
        with open(env_p, encoding='utf-8') as _f:
            for _line in _f:
                if _line.strip().startswith('DB_PASS='):
                    return _line.split('=', 1)[1].strip().strip('"\'')
    raise RuntimeError('Missing DB_PASS env variable or backend/.env')

_DB_PASS = _get_db_pass()

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')), '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@103.110.87.26']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
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
