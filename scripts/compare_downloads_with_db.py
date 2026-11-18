import os
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import subprocess

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

SSH_CMD = ['ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')), '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

# 1. Inspect Hop_dong
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2)
print("Hop_dong total rows:", len(df_hd))
hd_clean = df_hd.dropna(subset=['Số hợp đồng', 'Khách hàng'])
print("Hop_dong clean rows:", len(hd_clean))
print("Hop_dong columns:", list(df_hd.columns))

# 2. Inspect Don_dat_hang
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2)
print("\nDon_dat_hang total rows:", len(df_ddh))
ddh_clean = df_ddh.dropna(subset=['Số đơn hàng', 'Khách hàng'])
print("Don_dat_hang clean rows:", len(ddh_clean))
print("Don_dat_hang columns:", list(df_ddh.columns))

# 3. Inspect Ban_hang
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)
print("\nBan_hang total rows:", len(df_bh))
bh_clean = df_bh.dropna(subset=['Số chứng từ', 'Khách hàng'])
print("Ban_hang clean rows:", len(bh_clean))
print("Ban_hang columns:", list(df_bh.columns))

# 4. Check existing deposits in DB
print("\n=== Current deposits count in DB ===")
print(query("SELECT COUNT(*) FROM deposits;"))
print(query("SELECT COUNT(*) FROM deposit_milestones;"))
