import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

names = [
    'Huỳnh Thanh Hùng',
    'dinh pham quynh nhu',
    'Ân Phan',
    'Bùi Minh An',
    'Lam Chí Hưng',
    'Nguyễn Thị Ái Vân',
    'Sophia',
    'Nguyễn Thị Tuyết Thanh',
    'Vũ Thị Thu Hiền',
    'Trần Hoàng Thảo Nguyên',
    'Nguyễn Thị Hoài Trâm',
    'Nguyễn Đỗ Thúy Anh',
    'Vũ Trường Tân',
    'NGUYỄN XUÂN HIỆP',
    'Huỳnh Thị Hồng Hạnh',
    'Nguyễn Anh Quang',
    'Thiên Quốc Phan'
]

for name in names:
    clean_name = name.strip()
    res = query(f"SELECT id, full_name, phone, email, code FROM contacts WHERE full_name LIKE '%{clean_name}%' OR full_name = '{clean_name}';")
    lines = [l for l in res.strip().split('\n') if l and not l.startswith('id\t')]
    print(f"Target: '{clean_name}' -> Found {len(lines)} contacts:")
    for l in lines:
        print("   ", l)
