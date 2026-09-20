import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

res = query("""
SELECT d.id, d.unit_code, c.id as contact_id, c.full_name, d.notes
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
ORDER BY d.id ASC;
""")

lines = res.strip().split('\n')[1:]
mismatches = []
for l in lines:
    parts = l.split('\t')
    if len(parts) >= 4:
        d_id, unit_code, c_id, full_name = parts[0], parts[1], parts[2], parts[3]
        notes = parts[4] if len(parts) > 4 else ''
        # check if single word or notes has different customer name
        import re
        m = re.search(r'Khách hàng:\s*([^\n\\]+)', notes)
        if m:
            misa_cust = m.group(1).strip()
            if misa_cust.lower() != full_name.lower():
                mismatches.append((d_id, unit_code, c_id, full_name, misa_cust))

print(f"Total mismatched deposits: {len(mismatches)}")
for m in mismatches:
    print(f"Deposit #{m[0]} ({m[1]}): Current contact #{m[2]} '{m[3]}' -> MISA customer name: '{m[4]}'")
