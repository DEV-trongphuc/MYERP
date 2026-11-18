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
    remote = ['mysql', '-u', 'vhvxoigh_mail_auto', f'-p{_DB_PASS}', 'vhvxoigh_myerp', '--default-character-set=utf8mb4']
    proc = subprocess.run(SSH_CMD + remote, input=sql, capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== 1. FIND NGUYỄN THU THẢO ===")
print(query("SELECT id, name, email, role, department FROM users WHERE name LIKE '%Thảo%' OR name LIKE '%Thao%';"))
print(query("SELECT id, name, email, role, department FROM users;"))
