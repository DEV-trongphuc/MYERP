import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import unicodedata
import subprocess
import re
from datetime import datetime
from collections import defaultdict

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

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

def norm(s):
    if not s: return ''
    return unicodedata.normalize('NFC', str(s).strip().lower())

def clean_str(s):
    if not s: return ''
    return str(s).strip()

def escape_sql(val):
    if val is None: return 'NULL'
    s = str(val).replace('\\', '\\\\').replace("'", "\\'")
    return f"'{s}'"

def parse_num(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace('.', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

def parse_date(v):
    if not v: return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try: return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except: pass
    return None

# Check counts
out_mail, _ = run_remote_sql("SELECT COUNT(*) FROM mail_queue;")
out_notif, _ = run_remote_sql("SELECT COUNT(*) FROM notifications;")
print(f"mail_queue count: {out_mail.strip().split()[-1]}")
print(f"notifications count: {out_notif.strip().split()[-1]}")

# 1. Load users
raw_users, _ = run_remote_sql("SELECT id, full_name, email FROM users;")
sales_map = {}
for l in raw_users.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        sales_map[norm(p[1])] = int(p[0])
print(f"Loaded {len(sales_map)} users")

# 2. Load projects
raw_projs, _ = run_remote_sql("SELECT id, name FROM projects;")
proj_list = []
for l in raw_projs.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        proj_list.append((int(p[0]), norm(p[1])))

def map_project(prog_str):
    prog_norm = norm(prog_str)
    if 'estiam' in prog_norm: return 9
    if 'istec' in prog_norm: return 10
    if 'msc' in prog_norm or 'ai' in prog_norm: return 11
    if 'mba hq' in prog_norm: return 12
    if 'mba st' in prog_norm: return 13
    if 'emba hq' in prog_norm: return 14
    if 'emba' in prog_norm: return 15
    if 'bba' in prog_norm: return 16
    if 'mba' in prog_norm: return 17
    return 16

# 3. Load contacts
raw_contacts, _ = run_remote_sql("SELECT id, full_name, owner_id, project_id FROM contacts;")
exact_contacts = {}
for l in raw_contacts.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        c_norm = norm(p[1])
        exact_contacts[c_norm] = {
            'id': int(p[0]),
            'full_name': p[1].strip(),
            'owner_id': int(p[2]) if len(p) > 2 and p[2] and p[2] != 'NULL' else 100064,
            'project_id': int(p[3]) if len(p) > 3 and p[3] and p[3] != 'NULL' else 16
        }
print(f"Loaded {len(exact_contacts)} exact contacts")

# 4. Check existing deposits
raw_deps, _ = run_remote_sql("SELECT id, unit_code, contact_id, participant_ids, accountant_id, notes FROM deposits;")
existing_deposits = {}
for l in raw_deps.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        existing_deposits[p[0]] = {
            'id': int(p[0]),
            'unit_code': p[1].strip(),
            'contact_id': int(p[2]) if len(p) > 2 and p[2] and p[2] != 'NULL' else None,
            'participant_ids': p[3] if len(p) > 3 and p[3] != 'NULL' else None,
            'accountant_id': int(p[4]) if len(p) > 4 and p[4] and p[4] != 'NULL' else None,
            'notes': p[5] if len(p) > 5 else ''
        }
print(f"Loaded {len(existing_deposits)} existing deposits")

# 5. Load Excel files
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2).dropna(subset=['Số hợp đồng', 'Khách hàng'])
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2).dropna(subset=['Số đơn hàng', 'Khách hàng'])
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2).dropna(subset=['Số chứng từ', 'Khách hàng'])

print(f"Hop_dong rows: {len(df_hd)}")
print(f"Don_dat_hang rows: {len(df_ddh)}")
print(f"Ban_hang rows: {len(df_bh)}")

# Check customer names in Hop_dong vs existing deposits
print("\n=== VERIFY CUSTOMER MATCHING FOR HOP_DONG ===")
hd_by_num = {}
for idx, r in df_hd.iterrows():
    c_num = clean_str(r['Số hợp đồng'])
    cust = clean_str(r['Khách hàng'])
    val = parse_num(r['Giá trị hợp đồng'])
    owner = clean_str(r['Người thực hiện'])
    prog = clean_str(r['Thuộc dự án']) if 'Thuộc dự án' in r else ''
    hd_by_num[c_num] = {
        'num': c_num,
        'cust': cust,
        'val': val,
        'owner': owner,
        'prog': prog
    }

print(f"Total contracts indexed: {len(hd_by_num)}")
