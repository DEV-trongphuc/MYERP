import openpyxl
import subprocess
import sys
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

# Check how contacts link to deals/projects
print("=== CHECK SAMPLE CONTACTS FROM SO ===")
print(query("""
SELECT c.id, c.full_name, c.owner_id, u.full_name as owner_name, d.id as deal_id, d.title as deal_title, d.pipeline_id
FROM contacts c
LEFT JOIN users u ON c.owner_id = u.id
LEFT JOIN deals d ON d.contact_id = c.id
WHERE c.full_name LIKE '%HOÀNG PHI%' OR c.full_name LIKE '%Lê Thị Mỹ Hạnh%' OR c.full_name LIKE '%Huỳnh Thanh Hùng%'
LIMIT 10;
"""))

# Check projects list
print("=== PROJECTS ===")
print(query("SELECT id, name, code FROM projects;"))
