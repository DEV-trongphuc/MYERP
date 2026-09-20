import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== DEPOSIT 163 (NGUYỄN TÙNG LINH) ===")
print(query("SELECT id, unit_code, price, status FROM deposits WHERE id = 163;"))
print(query("SELECT id, milestone_name, expected_amount, expected_pay_date, actual_amount, status FROM deposit_milestones WHERE deposit_id = 163 ORDER BY id ASC;"))

print("=== DEPOSIT 150 (HOÀNG PHI) ===")
print(query("SELECT id, unit_code, price, status FROM deposits WHERE id = 150;"))
print(query("SELECT id, milestone_name, expected_amount, expected_pay_date, actual_amount, status FROM deposit_milestones WHERE deposit_id = 150 ORDER BY id ASC;"))

