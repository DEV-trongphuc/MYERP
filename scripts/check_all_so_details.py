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
    # Escape double quotes inside sql for bash
    escaped_sql = sql.replace('"', '\\"')
    remote = f"mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp --default-character-set=utf8mb4 -e \"{escaped_sql}\""
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    if proc.returncode != 0:
        print("ERR:", proc.stderr)
    return proc.stdout

print("=== 1. FIND NGUYEN THU THAO IN USERS ===")
print(query("SELECT id, name, email, role, department FROM users WHERE name LIKE '%Th\\ảo%' OR name LIKE '%Thao%' OR email LIKE '%thao%';"))

print("=== 2. ALL USERS ===")
print(query("SELECT id, name, email, role, department FROM users;"))

print("=== 3. DEPOSITS WITH SHORT OR WRONG CUSTOMER NAMES ===")
print(query("""
SELECT d.id, d.unit_code, d.contact_id, c.full_name as contact_name, d.price, d.participant_ids, d.accountant_id, d.notes
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
WHERE LENGTH(c.full_name) < 10 OR c.full_name LIKE '%Hùng%' OR c.full_name LIKE '%Nhu%' OR c.full_name LIKE '%An%';
"""))
