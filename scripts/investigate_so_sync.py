import subprocess
import sys
import json
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
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
