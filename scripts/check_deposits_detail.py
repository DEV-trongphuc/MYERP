import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

print("=== PROJECTS IN DB ===")
print(query("SELECT id, name, code FROM projects LIMIT 20;"))

print("=== DEPOSITS DETAILS WITH MILESTONES ===")
print(query("""
SELECT d.id, d.unit_code, c.full_name, p.name as project_name, d.price, d.status, d.auto_remind, d.created_at,
       COUNT(m.id) as total_milestones,
       SUM(CASE WHEN m.status = 'approved' THEN 1 ELSE 0 END) as approved_milestones
FROM deposits d
LEFT JOIN contacts c ON d.contact_id = c.id
LEFT JOIN projects p ON d.project_id = p.id
LEFT JOIN deposit_milestones m ON d.id = m.deposit_id
GROUP BY d.id
ORDER BY d.id DESC;
"""))
