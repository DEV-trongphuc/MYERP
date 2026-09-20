import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

c_ids = [
    1021827, 1013389, 1001214, 1013834, 1024595, 1021968, 1003234, 1020499,
    1019996, 1005352, 1017457, 1014211, 1000539, 1000487, 1005161, 1002554,
    1019433, 1016895, 1001989, 1024537, 1001873
]

id_str = ','.join(map(str, c_ids))
print("Checking usage in tasks:")
print(query(f"SELECT contact_id, COUNT(*) FROM tasks WHERE contact_id IN ({id_str}) GROUP BY contact_id;"))

print("Checking usage in deals:")
print(query(f"SELECT contact_id, COUNT(*) FROM deals WHERE contact_id IN ({id_str}) GROUP BY contact_id;"))

print("Checking usage in other deposits:")
print(query(f"SELECT contact_id, COUNT(*) FROM deposits WHERE contact_id IN ({id_str}) GROUP BY contact_id;"))
