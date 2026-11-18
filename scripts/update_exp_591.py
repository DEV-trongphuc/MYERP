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
SSH_CMD = ['ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')), '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout, proc.stderr

print("=== UPDATING EXP-591 CURRENCY TO CHF ===")
out, err = query("UPDATE expenses SET currency = 'CHF' WHERE id = 591;")
print("Update output:", out, err)

print("=== VERIFYING EXP-591 ===")
out, err = query("SELECT id, amount, currency, title, status FROM expenses WHERE id = 591;")
print(out)
