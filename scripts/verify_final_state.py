import os
import subprocess
import sys

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

print("=== 1. VERIFY EXP-591 ===")
print(query("SELECT id, amount, currency, title, status, created_at FROM expenses WHERE id = 591;"))

print("=== 2. VERIFY SALES ORDERS & ITEMS ===")
print("sales_orders count:", query("SELECT count(*) FROM sales_orders;").strip())
print("sales_order_items count:", query("SELECT count(*) FROM sales_order_items;").strip())
print("sales_orders sum total:", query("SELECT SUM(total) FROM sales_orders;").strip())

print("=== 3. VERIFY MAIL QUEUE (SILENCE AUDIT) ===")
print("mail_queue count:", query("SELECT count(*) FROM mail_queue;").strip())

print("=== 4. SAMPLE 3 SALES ORDERS WITH DATES AND STATUSES ===")
print(query("""
SELECT so.id, so.so_number, so.order_date, c.full_name, so.total, so.status, so.payment_status, SUBSTRING(so.notes, 1, 80) as notes_preview
FROM sales_orders so
LEFT JOIN contacts c ON so.contact_id = c.id
ORDER BY so.id ASC
LIMIT 3;
"""))
