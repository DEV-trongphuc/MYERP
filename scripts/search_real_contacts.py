import os
import subprocess
import sys

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

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')), '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
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
