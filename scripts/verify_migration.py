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

def run_remote_sql(sql):
    proc = subprocess.Popen(
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'" + _DB_PASS + "' vhvxoigh_myerp --default-character-set=utf8mb4 -e \"" + sql.replace('"', '\\"') + "\""],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    out, err = proc.communicate()
    return out, err

print("=== VERIFYING 10 CUSTOMERS IN LIVE DB ===")
query_10 = """
SELECT c.id, c.full_name, c.phone, c.email, c.owner_id, u.full_name as sale_name, c.stage_id, ps.name as stage_name, c.pipeline_status, c.student_id, c.tags
FROM contacts c
LEFT JOIN users u ON c.owner_id = u.id
LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
WHERE c.id IN (1024723, 1024722, 1024721, 1024720, 1024719, 1024716, 1024715, 1024714, 1024713, 1024712)
ORDER BY c.id DESC;
"""
out, err = run_remote_sql(query_10)
print(out)

print("\n=== VERIFYING ACTIVITIES EXTRACTED FOR THESE 10 CUSTOMERS ===")
query_act = """
SELECT contact_id, COUNT(*) as activity_count, MIN(due_date) as earliest, MAX(due_date) as latest
FROM activities
WHERE contact_id IN (1024723, 1024722, 1024721, 1024720, 1024719, 1024716, 1024715, 1024714, 1024713, 1024712)
GROUP BY contact_id;
"""
out, err = run_remote_sql(query_act)
print(out)

print("\n=== VERIFYING QUEUES (SHOULD BE 0 NEW) ===")
out, err = run_remote_sql("SELECT COUNT(*) as mail_q FROM mail_queue WHERE created_at >= NOW() - INTERVAL 10 MINUTE;")
print(out)
out, err = run_remote_sql("SELECT COUNT(*) as zalo_q FROM zalo_queue WHERE created_at >= NOW() - INTERVAL 10 MINUTE;")
print(out)
