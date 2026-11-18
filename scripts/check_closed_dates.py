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

SSH_CMD = [
    'ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')),
    '-4', '-p', '2210',
    '-o', 'StrictHostKeyChecking=no',
    'vhvxoigh@chiefaiofficer.vn'
]

sql = """
SELECT id, full_name, phone, email, status, pipeline_status, stage_id, created_at, updated_at, admission_date
FROM contacts
WHERE phone IN ('0988090396', '0931845254', '0866754348', '0932167888', '0397958468', '0928747477', '0969493366', '0346364900', '0948434878')
   OR email = 'ng.nguyen2014@gmail.com';
"""

remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"' + _DB_PASS + '" vhvxoigh_myerp -e "' + sql.replace('\n', ' ') + '"'
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print("CONTACTS ON LIVE DB:")
print(proc.stdout.decode('utf-8', errors='replace'))
if proc.stderr:
    print("STDERR:", proc.stderr.decode('utf-8', errors='replace'))
