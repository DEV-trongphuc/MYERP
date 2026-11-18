import os
import openpyxl
import subprocess
import sys
import unicodedata

def _get_db_pass():
    if os.environ.get('DB_PASS'):
        return os.environ['DB_PASS']
    env_p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', '.env')
    if os.path.exists(env_p):
        with open(env_p, encoding='utf-8') as _f:
            for _line in _f:
                if _line.strip().startswith('DB_PASS='):
                    return _line.split('=', 1)[1].strip().strip('"\'')
    raise RuntimeError('Missing DB_PASS env variable or backend/.env')

_DB_PASS = _get_db_pass()

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')), '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
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
