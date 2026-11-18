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

print("=== CHECK COUNTS ===")
print("mail_queue count:", query("SELECT COUNT(*) FROM mail_queue;").strip().split('\n')[-1])
print("notifications count:", query("SELECT COUNT(*) FROM notifications;").strip().split('\n')[-1])

print("\n=== SAMPLE DEPOSITS PARTICIPANT_IDS ===")
print(query("SELECT id, unit_code, participant_ids, accountant_id FROM deposits WHERE participant_ids IS NOT NULL LIMIT 10;"))
print(query("SELECT COUNT(*) as total_deposits, COUNT(participant_ids) as has_participants, COUNT(accountant_id) as has_accountant FROM deposits;"))
