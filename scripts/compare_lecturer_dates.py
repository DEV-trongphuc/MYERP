import subprocess
import sys
import re

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
