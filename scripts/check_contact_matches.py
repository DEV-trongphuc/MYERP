import subprocess
import sys
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

# Fetch all contacts
raw = query("SELECT id, full_name, phone, email, owner_id FROM contacts;")
all_contacts = []
for line in raw.strip().split('\n')[1:]:
    p = line.split('\t')
    if len(p) >= 2:
        all_contacts.append({
            'id': int(p[0]),
            'full_name': p[1].strip(),
            'phone': p[2] if len(p) > 2 else '',
            'email': p[3] if len(p) > 3 else '',
            'owner_id': p[4] if len(p) > 4 else ''
        })

print(f"Total contacts in DB: {len(all_contacts)}")

# Check each of the 22 names
misa_names = [
    'Huỳnh Thanh Hùng', 'Ân Phan', 'dinh pham quynh nhu', 'Lam Chí Hưng',
    'Nguyễn Thị Ái Vân', 'TRẦN THỊ YẾN NHI', 'Sophia', 'Nguyễn Thị Tuyết Thanh',
    'Vũ Thị Thu Hiền', 'Trần Hoàng Thảo Nguyên', 'Nguyễn Thị Hoài Trâm',
    'Nguyễn Đỗ Thúy Anh', 'Khang', 'Trần Thị Ngọc', 'Vũ Trường Tân',
    'Đặng Thị Thanh Tâm', 'Đặng Thuỳ Linh', 'NGUYỄN XUÂN HIỆP',
    'Huỳnh Thị Hồng Hạnh', 'Nguyễn Anh Quang', 'Nguyễn Đức Thịnh', 'Thiên Quốc Phan'
]

def norm(s):
    return unicodedata.normalize('NFC', s.lower().strip())

for target in misa_names:
    nt = norm(target)
    matches = [c for c in all_contacts if norm(c['full_name']) == nt]
    if matches:
        print(f"EXACT MATCH for '{target}': ID {matches[0]['id']} ('{matches[0]['full_name']}')")
    else:
        # try without tone or close match
        close = [c for c in all_contacts if nt in norm(c['full_name']) or norm(c['full_name']) in nt]
        print(f"NO EXACT MATCH for '{target}'. Close candidates: {[(c['id'], c['full_name']) for c in close[:3]]}")
