import subprocess

ssh_cmd = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']
sql = """
SELECT 
    CASE 
        WHEN COALESCE(e.refunded_at, e.date) < CURDATE() THEN 'overdue_past'
        WHEN COALESCE(e.refunded_at, e.date) = CURDATE() THEN 'due_today'
        WHEN COALESCE(e.refunded_at, e.date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'due_next_30_days'
        ELSE 'due_later'
    END as category,
    COUNT(*) as count,
    ROUND(SUM(e.amount), 0) as total_amount
FROM expenses e
WHERE e.status = 'pending' AND e.deleted_at IS NULL
GROUP BY category;
"""
proc = subprocess.run(ssh_cmd + [f"mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp -e \"{sql}\""], capture_output=True)
print("=== EXPENSES BY TIMELINE ===")
print(proc.stdout.decode('utf-8', errors='replace'))
