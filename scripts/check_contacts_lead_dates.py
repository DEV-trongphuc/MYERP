import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

sql = """
SELECT 
    c.id as contact_id,
    c.full_name as contact_name,
    c.phone as contact_phone,
    c.email as contact_email,
    c.created_at as contact_created_at,
    c.admission_date,
    l.id as lead_id,
    l.created_at as lead_created_at,
    dl.received_at as dist_received_at
FROM contacts c
LEFT JOIN leads l ON (LENGTH(c.phone) > 5 AND l.phone = c.phone) OR (LENGTH(c.email) > 5 AND l.email = c.email)
LEFT JOIN distribution_logs dl ON dl.lead_id = l.id
WHERE c.phone IN ("0988090396", "0931845254", "0866754348", "0932167888", "0397958468", "0928747477", "0969493366", "0346364900", "0948434878")
   OR c.email = "ng.nguyen2014@gmail.com"
GROUP BY c.id;
"""

remote_cmd = 'mysql -u vhvxoigh_mail_auto -p"Ideas@812" vhvxoigh_myerp -e \'' + sql.replace('\n', ' ') + '\''
proc = subprocess.run(SSH_CMD + [remote_cmd], capture_output=True)
print(proc.stdout.decode('utf-8', errors='replace'))
if proc.stderr:
    print("STDERR:", proc.stderr.decode('utf-8', errors='replace'))
