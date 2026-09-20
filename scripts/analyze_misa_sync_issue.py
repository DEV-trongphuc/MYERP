import subprocess
import sys
import pandas as pd
import json

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

# Load all 3 files
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2)
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2)
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)

print(f"Hop_dong rows: {len(df_hd)}")
print(f"Don_dat_hang rows: {len(df_ddh)}")
print(f"Ban_hang rows: {len(df_bh)}")

# Check contracts where customer has short name or check how contracts map to DDH and BH
print("\n=== Sample of Hop_dong customer names ===")
for idx, r in df_hd.head(20).iterrows():
    print(f"SO: {r['Số hợp đồng']} | Cust: '{r['Khách hàng']}' | Val: {r['Giá trị hợp đồng']} | Owner: {r['Người thực hiện']}")

print("\n=== Check contacts in DB with single word or short full_name ===")
res = query("SELECT id, full_name, phone, email, code FROM contacts WHERE full_name NOT LIKE '% %' OR LENGTH(full_name) < 8 ORDER BY id DESC LIMIT 50;")
print(res)

print("\n=== Check deposits currently in DB ===")
res_dep = query("""
SELECT d.id, d.unit_code, d.contact_id, c.full_name as contact_name, d.price, d.accountant_id, d.participant_ids
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
ORDER BY d.id DESC;
""")
print(res_dep[:2000])
