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

print("=== STEP 0: CHECK INITIAL COUNTS ===")
out_mail, _ = run_remote_sql("SELECT COUNT(*) FROM mail_queue;")
out_notif, _ = run_remote_sql("SELECT COUNT(*) FROM notifications;")
mail_pre = int(out_mail.strip().split('\n')[-1]) if out_mail.strip() else 0
notif_pre = int(out_notif.strip().split('\n')[-1]) if out_notif.strip() else 0
print(f"mail_queue count: {mail_pre}")
print(f"notifications count: {notif_pre}")

# Load all 3 files
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2).dropna(subset=['Số hợp đồng', 'Khách hàng'])
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2).dropna(subset=['Số đơn hàng', 'Khách hàng'])
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2).dropna(subset=['Số chứng từ', 'Khách hàng'])

print(f"Loaded Hop_dong: {len(df_hd)} rows")
print(f"Loaded Don_dat_hang: {len(df_ddh)} rows")
print(f"Loaded Ban_hang: {len(df_bh)} rows")
