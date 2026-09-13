import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

updates = [
    (1024712, '2026-06-03 20:00:02'),
    (1024713, '2026-08-26 10:00:00'),
    (1024714, '2026-08-06 09:27:55'),
    (1024715, '2026-07-18 15:56:54'),
    (1024716, '2026-07-23 17:09:08'),
    (1024719, '2026-03-11 23:49:33'),
    (1024720, '2026-04-23 23:16:44'),
    (1024721, '2026-03-13 23:06:44'),
    (1024722, '2026-02-02 17:55:04'),
    (1024723, '2026-07-12 20:50:22')
]

sql_statements = []
for cid, dt in updates:
    sql_statements.append(f"UPDATE contacts SET created_at = '{dt}' WHERE id = {cid};")

full_sql = "\n".join(sql_statements)
remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp'
proc = subprocess.run(SSH_CMD + [remote_cmd], input=full_sql.encode('utf-8'), capture_output=True)
print("UPDATE STDOUT:", proc.stdout.decode('utf-8', errors='replace'))
if proc.stderr:
    print("UPDATE STDERR:", proc.stderr.decode('utf-8', errors='replace'))

# Verify
verify_sql = "SELECT id, full_name, phone, admission_date, created_at FROM contacts WHERE id IN (" + ",".join(str(cid) for cid, _ in updates) + ");"
proc2 = subprocess.run(SSH_CMD + [remote_cmd], input=verify_sql.encode('utf-8'), capture_output=True)
print("\nVERIFIED CONTACTS:")
print(proc2.stdout.decode('utf-8', errors='replace'))
