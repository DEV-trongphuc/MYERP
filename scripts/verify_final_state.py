import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
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
