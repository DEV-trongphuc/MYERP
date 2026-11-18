import os
import subprocess, sys

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

def run_query(sql):
    remote_cmd = f'mysql -u vhvxoigh_mail_auto -p"{_DB_PASS}" vhvxoigh_myerp -e "{sql}"'
    proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
    return proc.stdout.decode('utf-8', errors='replace'), proc.stderr.decode('utf-8', errors='replace')

out, err = run_query("SHOW INDEX FROM activities;")
print("Current indexes:")
for line in out.strip().split('\n'):
    parts = line.split('\t')
    if len(parts) > 4:
        print(f"Index: {parts[2]} | Col: {parts[4]} | Seq: {parts[3]}")
