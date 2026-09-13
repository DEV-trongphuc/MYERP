import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def run_query(sql):
    remote_cmd = f'''mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
    return proc.stdout.decode('utf-8', errors='replace'), proc.stderr.decode('utf-8', errors='replace')

print("1. Checking if column 'currency' exists in 'expenses'...")
out, err = run_query("SHOW COLUMNS FROM expenses LIKE 'currency';")
print("Col check output:", out.strip())

if not out.strip():
    print("Adding column 'currency' to table 'expenses'...")
    alter_sql = "ALTER TABLE expenses ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'VND' AFTER amount;"
    out, err = run_query(alter_sql)
    print("Alter output:", out.strip(), err.strip())
else:
    print("Column 'currency' already exists.")

print("\n2. Migrating foreign lecturer expense records to USD...")
# List of 34 IDs identified:
# 379, 384, 394, 398, 410, 411, 423, 425, 1142, 1197..1221
target_ids = [379, 384, 394, 398, 410, 411, 423, 425, 1142] + list(range(1197, 1222))
ids_str = ', '.join(str(i) for i in target_ids)

update_sql = f"UPDATE expenses SET currency = 'USD' WHERE id IN ({ids_str});"
out, err = run_query(update_sql)
print("Update output:", out.strip(), err.strip())

# Also auto-update any other records that match foreign lecturer keywords just in case
keyword_update_sql = """
UPDATE expenses 
SET currency = 'USD' 
WHERE currency = 'VND' AND (
    title LIKE '%giảng viên nước ngoài%' 
    OR title LIKE '%giang vien nuoc ngoai%'
    OR title LIKE '%giảng viên nn%'
    OR title LIKE '%giang vien nn%'
    OR notes LIKE '%giảng viên nước ngoài%'
    OR notes LIKE '%giang vien nuoc ngoai%'
    OR notes LIKE '%giảng viên nn%'
    OR notes LIKE '%giang vien nn%'
    OR items LIKE '%giảng viên nước ngoài%'
    OR items LIKE '%giang vien nuoc ngoai%'
    OR items LIKE '%giảng viên nn%'
    OR items LIKE '%giang vien nn%'
);
"""
out, err = run_query(keyword_update_sql)
print("Keyword update output:", out.strip(), err.strip())

print("\n3. Verifying updated records...")
check_sql = f"SELECT id, amount, currency, title FROM expenses WHERE id IN ({ids_str}) ORDER BY id ASC;"
out, err = run_query(check_sql)
print(out)

print("\n4. Verifying Vietnamese lecturer records remain VND...")
vn_sql = "SELECT id, amount, currency, title FROM expenses WHERE (title LIKE '%Thù lao Giảng viên Việt Nam%' OR title LIKE '%giảng viên chuyên đề%') LIMIT 5;"
out, err = run_query(vn_sql)
print(out)
