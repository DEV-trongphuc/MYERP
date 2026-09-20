import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print(query("SELECT id, contact_id, so_number, order_date FROM sales_orders LIMIT 5;"))
print(query("""
SELECT c.id, c.full_name, c.owner_id, d.title as deal_title, d.pipeline_id 
FROM sales_orders so 
JOIN contacts c ON so.contact_id = c.id 
LEFT JOIN deals d ON d.contact_id = c.id 
LIMIT 5;
"""))
