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
WHERE (title LIKE '%Thù lao Giảng viên%' OR title LIKE '%thù lao giảng viên%')
  AND deleted_at IS NULL
ORDER BY id ASC;
"""

out, err = run_remote_sql(sql)
lines = out.strip().split('\n')
header = lines[0].split('\t')
print(f"Total lecturer expenses found: {len(lines) - 1}")

mismatched = []
for l in lines[1:]:
    parts = l.split('\t')
    if len(parts) >= 4:
        eid, title, dt, cat = parts[0], parts[1], parts[2], parts[3]
        # Check regex date in title: dd/mm/yyyy
        m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', title)
        title_date = None
        if m:
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            title_date = f"{y:04d}-{mo:02d}-{d:02d}"
        
        mismatched.append({
            'id': eid,
            'title': title,
            'date': dt,
            'created_at': cat,
            'title_date': title_date
        })

print(f"\nSample 15 records:")
for item in mismatched[:15]:
    diff = "==> KHÁC NHAU" if item['title_date'] and item['title_date'] != item['date'] else ""
    print(f"ID {item['id']}: date_in_db={item['date']} | date_in_title={item['title_date']} | created_at={item['created_at']} {diff}")
    print(f"   Title: {item['title']}")

print(f"\nRecords with title date != db date:")
cnt_diff = sum(1 for x in mismatched if x['title_date'] and x['title_date'] != x['date'])
print(f"Count mismatched title date vs db date: {cnt_diff} / {len(mismatched)}")
