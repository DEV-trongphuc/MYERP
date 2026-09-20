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
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    out, err = proc.communicate(input=sql)
    return out, err

sql = """
SELECT id, title, date, created_at, category, amount, approval_status, status
FROM expenses 
WHERE title LIKE '%Thù lao Giảng viên Việt Nam%' OR title LIKE '%thù lao giảng viên%'
ORDER BY id DESC
LIMIT 20;
"""

out, err = run_remote_sql(sql)
print(out)
if err:
    print("ERR:", err)
