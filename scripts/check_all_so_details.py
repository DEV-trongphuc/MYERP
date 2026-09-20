import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    # Escape double quotes inside sql for bash
    escaped_sql = sql.replace('"', '\\"')
    remote = f"mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e \"{escaped_sql}\""
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
