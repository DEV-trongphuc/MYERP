import os
import subprocess
import sys
import re

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
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'" + _DB_PASS + "' vhvxoigh_myerp --default-character-set=utf8mb4"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    out, err = proc.communicate(input=sql)
    return out, err

sql = """
SELECT id, title, date, created_at 
FROM expenses 
WHERE title LIKE '%Thù lao Giảng viên Việt Nam%' AND deleted_at IS NULL 
ORDER BY id ASC;
"""

out, err = run_remote_sql(sql)
lines = out.strip().split('\n')
print(f"Total VN lecturer records: {len(lines)-1}")

diff_count = 0
for l in lines[1:]:
    p = l.split('\t')
    if len(p) >= 4:
        eid, title, dt, cat = p[0], p[1], p[2], p[3]
        m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', title)
        title_date = f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else "None"
        diff = "!= DIFF" if title_date != "None" and title_date != dt else ""
        if diff: diff_count += 1
        print(f"ID {eid:4s} | DB: {dt} | TitleDate: {title_date} | Created: {cat[:10]} | {diff:7s} | {title}")

print(f"\nTotal DIFF: {diff_count} / {len(lines)-1}")
