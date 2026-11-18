import os
import subprocess
import sys
import json
import pandas as pd

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

print("=== 1. FIND NGUYỄN THU THẢO ===")
print(query("SELECT id, name, email, role, department FROM users WHERE name LIKE '%Thảo%' OR name LIKE '%Thao%';"))

print("=== 2. DEPOSITS TABLE STRUCTURE ===")
print(query("DESCRIBE deposits;"))

print("=== 3. CONTACTS WITH SHORT NAMES (Hùng, An, Nhu, etc.) ===")
print(query("SELECT id, full_name, email, phone, code FROM contacts WHERE full_name IN ('Hùng', 'An', 'Nhu', 'Hồng') OR full_name LIKE '%Hùng%' OR full_name LIKE '%Quỳnh Như%' OR full_name LIKE '%Minh An%';"))

print("=== 4. CURRENT DEPOSITS MATCHING Hùng, An, Nhu ===")
print(query("""
SELECT d.id, d.unit_code, d.contact_id, c.full_name as contact_name, d.price, d.status, d.created_at, u.name as sale_name
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
LEFT JOIN users u ON d.sale_person_id = u.id
WHERE c.full_name IN ('Hùng', 'An', 'Nhu', 'Hồng', 'Huỳnh Thanh Hùng', 'dinh pham quynh nhu', 'Bùi Minh An')
   OR d.unit_code IN ('DH0000621', 'DH0000588', 'DH0000282')
ORDER BY d.id DESC;
"""))
