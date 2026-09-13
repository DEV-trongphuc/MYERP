import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = [
    'ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519',
    '-4', '-p', '2210',
    '-o', 'StrictHostKeyChecking=no',
    'vhvxoigh@chiefaiofficer.vn'
]

def run_remote_sql(sql):
    proc = subprocess.Popen(
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e \"" + sql.replace('"', '\\"') + "\""],
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
