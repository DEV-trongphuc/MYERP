import json
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

with open('scratch/lecturer_due_dates.json', 'r', encoding='utf-8') as f:
    due_dates = json.load(f)

# Load DB expenses
sql = "SELECT id, title, date, created_at FROM expenses WHERE deleted_at IS NULL;"
out, _ = run_remote_sql(sql)

db_map = {}
for l in out.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 4:
        eid, title, dt, cat = int(p[0]), p[1], p[2], p[3]
        m = re.search(r'\[MISA #(\d+)\]', title)
        if m:
            mid = m.group(1)
            db_map[mid] = (eid, title, dt, cat)

updates = []
for mid, info in due_dates.items():
    if str(mid) in db_map:
        eid, title, cur_dt, cat = db_map[str(mid)]
        new_dt = info['due_date']
        if cur_dt != new_dt:
            updates.append({
                'eid': eid,
                'mid': mid,
                'type': info['type'],
                'cur_dt': cur_dt,
                'new_dt': new_dt,
                'title': title
            })
    else:
        print(f"MISA #{mid} not found in DB expenses")

print(f"\nTotal updates to be applied in DB: {len(updates)} / {len(due_dates)}")
for u in updates:
    print(f"[{u['type']}] Exp #{u['eid']:4d} (MISA #{u['mid']:3s}): {u['cur_dt']} -> {u['new_dt']} | {u['title']}")
