import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== CHECK NGUYEN TUNG LINH DEPOSIT & MILESTONE ===")
print(query("""
SELECT d.id, d.unit_code, c.full_name, d.price, d.status, m.id as milestone_id, m.milestone_name, m.status as m_status, m.actual_amount, m.approval_date
FROM deposits d
JOIN contacts c ON d.contact_id = c.id
LEFT JOIN deposit_milestones m ON d.id = m.deposit_id
WHERE c.full_name LIKE '%Nguyễn Tùng Linh%' OR d.unit_code LIKE '%DH0000473%';
"""))
