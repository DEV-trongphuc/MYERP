import zipfile, io, openpyxl, re, json, sys, subprocess

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def run_query(sql):
    proc = subprocess.Popen(
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    out, err = proc.communicate(input=sql)
    return out

# Check if expenses has approval_steps column
col_check = run_query("SHOW COLUMNS FROM expenses LIKE 'approval_steps';")
print("approval_steps column:", col_check.strip())
