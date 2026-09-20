import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import unicodedata
import subprocess

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

def norm(s):
    if not s: return ''
    return unicodedata.normalize('NFC', str(s).strip().lower())

df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2).dropna(subset=['Số hợp đồng', 'Khách hàng'])
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2).dropna(subset=['Số chứng từ', 'Khách hàng'])

hd_names = {norm(c) for c in df_hd['Khách hàng']}

# Also existing deposits in DB
raw = query("SELECT d.id, d.unit_code, c.full_name, d.notes FROM deposits d LEFT JOIN contacts c ON d.contact_id = c.id;")
existing_deposit_names = set(hd_names)
for l in raw.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 3 and p[2]:
        existing_deposit_names.add(norm(p[2]))
    if len(p) >= 4 and p[3]:
        import re
        m = re.search(r'Khách hàng:\s*([^\n\\]+)', p[3])
        if m:
            existing_deposit_names.add(norm(m.group(1)))

print(f"Total existing contract/deposit customer names: {len(existing_deposit_names)}")

bh_custs = {norm(c) for c in df_bh['Khách hàng']}
overlap = bh_custs.intersection(existing_deposit_names)
new_custs = bh_custs - existing_deposit_names

print(f"Total customers in Ban_hang: {len(bh_custs)}")
print(f"Overlapping with existing contracts/deposits: {len(overlap)}")
print(f"NEW customers only in Ban_hang: {len(new_custs)}")
print("\nOverlapping names:", overlap)
