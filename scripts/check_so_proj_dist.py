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

# Check programs and project_id for the 138 contacts
raw_contacts = query("SELECT c.id, c.full_name, c.project_id, c.program, c.owner_id FROM sales_orders so JOIN contacts c ON so.contact_id = c.id;")
contacts_data = {}
for line in raw_contacts.strip().split('\n')[1:]:
    p = line.split('\t')
    if len(p) >= 2:
        cid = p[0]
        cname = p[1]
        cproj = p[2] if len(p) > 2 else ''
        cprog = p[3] if len(p) > 3 else ''
        cowner = p[4] if len(p) > 4 else ''
        contacts_data[cid] = {'name': cname, 'project_id': cproj, 'program': cprog, 'owner_id': cowner}

print(f"Total matched contacts in sales_orders: {len(contacts_data)}")
proj_counts = {}
prog_counts = {}
for cid, d in contacts_data.items():
    proj_counts[d['project_id']] = proj_counts.get(d['project_id'], 0) + 1
    prog_counts[d['program']] = prog_counts.get(d['program'], 0) + 1

print("Project ID distribution:", proj_counts)
print("Program distribution:", prog_counts)
