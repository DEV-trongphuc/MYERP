import os
import subprocess

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

ssh_cmd = ['ssh', '-i', os.environ.get('SSH_KEY', os.path.expanduser('~/.ssh/id_ed25519')), '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']
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
proc = subprocess.run(ssh_cmd + [f"mysql -u vhvxoigh_mail_auto -p'{_DB_PASS}' vhvxoigh_myerp -e \"{sql}\""], capture_output=True)
print("=== EXPENSES BY TIMELINE ===")
print(proc.stdout.decode('utf-8', errors='replace'))
