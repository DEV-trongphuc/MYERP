import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = [
    'ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519',
    '-4', '-p', '2210',
    '-o', 'StrictHostKeyChecking=no',
    'vhvxoigh@chiefaiofficer.vn'
]

sql = """
SELECT id, full_name, phone, email, status, pipeline_status, stage_id, created_at, updated_at, admission_date
FROM contacts
WHERE phone IN ('0988090396', '0931845254', '0866754348', '0932167888', '0397958468', '0928747477', '0969493366', '0346364900', '0948434878')
   OR email = 'ng.nguyen2014@gmail.com';
"""

remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e "' + sql.replace('\n', ' ') + '"'
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print("CONTACTS ON LIVE DB:")
print(proc.stdout.decode('utf-8', errors='replace'))
if proc.stderr:
    print("STDERR:", proc.stderr.decode('utf-8', errors='replace'))
