import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import unicodedata
import subprocess
import re
from datetime import datetime
from collections import defaultdict

SSH_CMD = ['ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519', '-4', '-p', '2210', '-o', 'StrictHostKeyChecking=no', 'vhvxoigh@chiefaiofficer.vn']

def run_remote_sql(sql):
    proc = subprocess.Popen(
        SSH_CMD + ["mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    out, err = proc.communicate(input=sql)
    return out, err

def norm(s):
    if not s: return ''
    return unicodedata.normalize('NFC', str(s).strip().lower())

def clean_str(s):
    if not s: return ''
    return str(s).strip()

def escape_sql(val):
    if val is None: return 'NULL'
    s = str(val).replace('\\', '\\\\').replace("'", "\\'")
    return f"'{s}'"

def parse_num(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace('.', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

def parse_date(v):
    if not v: return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try: return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except: pass
    return None

def format_title_vietnamese(name):
    # Fix casing like 'dinh pham quynh nhu' -> 'Đinh Phạm Quỳnh Như'
    if not name: return ''
    special_cases = {
        'dinh pham quynh nhu': 'Đinh Phạm Quỳnh Như',
        'an phan': 'Ân Phan',
        'bui minh an': 'Bùi Minh An',
        'sophia': 'Sophia',
        'khang': 'Khang'
    }
    n = norm(name)
    if n in special_cases:
        return special_cases[n]
    return ' '.join(word.capitalize() for word in name.strip().split())

print("==================================================================")
print("EXECUTING FULL MISA SO SYNC, NGUYEN THU THAO ASSIGNMENT & NAME FIX")
print("==================================================================")

# Step 0: Audit before
out_mail_pre, _ = run_remote_sql("SELECT COUNT(*) FROM mail_queue;")
out_notif_pre, _ = run_remote_sql("SELECT COUNT(*) FROM notifications;")
mail_pre = int(out_mail_pre.strip().split()[-1]) if out_mail_pre.strip() else 0
notif_pre = int(out_notif_pre.strip().split()[-1]) if out_notif_pre.strip() else 0
print(f"Mail queue before: {mail_pre}")
print(f"Notifications before: {notif_pre}")

# Load users
raw_users, _ = run_remote_sql("SELECT id, full_name FROM users;")
users_map = {}
for l in raw_users.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        users_map[norm(p[1])] = int(p[0])

# Nguyễn Thu Thảo ID
ACCOUNTANT_ID = 100064

def get_owner_id(owner_name):
    if not owner_name: return ACCOUNTANT_ID
    n = norm(owner_name)
    if n in users_map: return users_map[n]
    for uname, uid in users_map.items():
        if n in uname or uname in n:
            return uid
    return ACCOUNTANT_ID

# Load exact contacts
raw_contacts, _ = run_remote_sql("SELECT id, full_name, owner_id, project_id FROM contacts;")
contacts_by_norm = {}
for l in raw_contacts.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        c_id = int(p[0])
        c_name = p[1].strip()
        c_norm = norm(c_name)
        if c_norm not in contacts_by_norm:
            contacts_by_norm[c_norm] = {
                'id': c_id,
                'full_name': c_name,
                'owner_id': int(p[2]) if len(p) > 2 and p[2] and p[2] != 'NULL' else ACCOUNTANT_ID,
                'project_id': int(p[3]) if len(p) > 3 and p[3] and p[3] != 'NULL' else 16
            }

sql_statements = []

def get_or_create_contact(cust_name, owner_id=ACCOUNTANT_ID, project_id=16):
    formatted_name = format_title_vietnamese(cust_name)
    cn = norm(formatted_name)
    if cn in contacts_by_norm:
        return contacts_by_norm[cn]['id']
    
    # Needs to be created
    sql_insert = f"""
    INSERT INTO contacts (tenant_id, full_name, owner_id, project_id, pipeline_status, created_at, updated_at)
    VALUES (1, {escape_sql(formatted_name)}, {owner_id}, {project_id}, 'won', NOW(), NOW());
    """
    out, err = run_remote_sql(sql_insert)
    if err and 'error' in err.lower():
        print(f"Error creating contact {formatted_name}: {err}")
    
    # Get last inserted id
    out_id, _ = run_remote_sql("SELECT LAST_INSERT_ID();")
    new_id = int(out_id.strip().split()[-1])
    print(f"-> Created new contact #{new_id}: '{formatted_name}'")
    contacts_by_norm[cn] = {
        'id': new_id,
        'full_name': formatted_name,
        'owner_id': owner_id,
        'project_id': project_id
    }
    return new_id

# 1. FIX EXISTING 22 MISMATCHED CONTRACTS IN DEPOSITS
print("\n--- STEP 1: FIXING MISMATCHED CONTACTS ON EXISTING DEPOSITS ---")
# Mapping from unit_code to correct MISA customer name & owner
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2).dropna(subset=['Số hợp đồng', 'Khách hàng'])
hd_info = {}
for idx, r in df_hd.iterrows():
    c_num = clean_str(r['Số hợp đồng'])
    cust = clean_str(r['Khách hàng'])
    owner = clean_str(r['Người thực hiện'])
    hd_info[c_num] = {
        'cust': cust,
        'owner_id': get_owner_id(owner)
    }

raw_deps, _ = run_remote_sql("SELECT id, unit_code, contact_id, notes FROM deposits WHERE id >= 149;")
for l in raw_deps.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        dep_id = int(p[0])
        unit_code = p[1].strip()
        current_cid = int(p[2]) if len(p) > 2 and p[2] and p[2] != 'NULL' else None
        notes = p[3] if len(p) > 3 else ''
        
        target_cust = None
        owner_id = ACCOUNTANT_ID
        if unit_code in hd_info:
            target_cust = hd_info[unit_code]['cust']
            owner_id = hd_info[unit_code]['owner_id']
        else:
            m = re.search(r'Khách hàng:\s*([^\n\\]+)', notes)
            if m:
                target_cust = m.group(1).strip()
        
        if target_cust:
            correct_cid = get_or_create_contact(target_cust, owner_id)
            if correct_cid != current_cid:
                print(f"Fixing Deposit #{dep_id} ({unit_code}): changing contact #{current_cid} -> #{correct_cid} ('{target_cust}')")
                run_remote_sql(f"UPDATE deposits SET contact_id = {correct_cid} WHERE id = {dep_id};")

# 2. UPDATE ACCOUNTANT & PARTICIPANT_IDS FOR ALL DEPOSITS
print("\n--- STEP 2: ASSIGNING ACCOUNTANT NGUYỄN THU THẢO TO ALL DEPOSITS ---")
run_remote_sql(f"""
UPDATE deposits 
SET accountant_id = {ACCOUNTANT_ID},
    participant_ids = CASE 
        WHEN participant_ids IS NULL OR participant_ids = '' THEN '{ACCOUNTANT_ID}'
        WHEN FIND_IN_SET('{ACCOUNTANT_ID}', participant_ids) > 0 THEN participant_ids
        ELSE CONCAT(participant_ids, ',{ACCOUNTANT_ID}')
    END;
""")
print(f"Updated accountant_id = {ACCOUNTANT_ID} and participant_ids on all deposits.")

# 3. SYNCHRONIZE BAN_HANG.XLSX (219 rows)
print("\n--- STEP 3: SYNCHRONIZING BAN_HANG.XLSX ---")
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2).dropna(subset=['Số chứng từ', 'Khách hàng'])
print(f"Ban_hang valid rows: {len(df_bh)}")

# Group by customer
bh_by_cust = defaultdict(list)
for idx, r in df_bh.iterrows():
    cust = clean_str(r['Khách hàng'])
    v_num = clean_str(r['Số chứng từ'])
    v_date = parse_date(r['Ngày hạch toán']) or '2026-01-01'
    v_val = parse_num(r['Tổng tiền thanh toán'])
    v_paid = str(r['TT thanh toán']).strip().lower() == 'đã thanh toán'
    v_inv = clean_str(r.get('Số hóa đơn', ''))
    
    bh_by_cust[norm(cust)].append({
        'cust': cust,
        'v_num': v_num,
        'v_date': v_date,
        'v_val': v_val,
        'v_paid': v_paid,
        'v_inv': v_inv
    })

# Check which customers already have deposits
raw_dep_units, _ = run_remote_sql("SELECT id, unit_code, contact_id FROM deposits;")
existing_units = set()
existing_cids = set()
for l in raw_dep_units.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        existing_units.add(p[1].strip())
        if len(p) > 2 and p[2] and p[2] != 'NULL':
            existing_cids.add(int(p[2]))

created_bh_deposits = 0
created_bh_milestones = 0

for c_norm_key, v_list in bh_by_cust.items():
    first_v = v_list[0]
    cust_name = first_v['cust']
    cid = get_or_create_contact(cust_name, ACCOUNTANT_ID, 16)
    
    # Check if this customer already has a deposit in system
    if cid in existing_cids:
        # Customer already has contract deposit in system!
        # Check if milestones with these BH vouchers already exist
        out_ms, _ = run_remote_sql(f"SELECT id, milestone_name, status FROM deposit_milestones WHERE deposit_id = (SELECT id FROM deposits WHERE contact_id = {cid} ORDER BY id DESC LIMIT 1);")
        # Just update status if already paid
        continue
    
    # Create new deposit for this BH customer
    total_price = sum(v['v_val'] for v in v_list)
    all_paid = all(v['v_paid'] for v in v_list)
    dep_status = 'approved' if all_paid else 'pending_admin'
    earliest_date = min(v['v_date'] for v in v_list)
    unit_code = first_v['v_num']
    
    notes_content = f"[Chứng từ bán hàng MISA AMIS - Ban_hang.xlsx]:\\n• Khách hàng: {cust_name}\\n• Số chứng từ chính: {unit_code}\\n• Tổng số đợt chứng từ: {len(v_list)}"
    
    sql_ins_dep = f"""
    INSERT INTO deposits (
        tenant_id, contact_id, project_id, unit_code, price, expected_commission,
        status, created_by, created_at, updated_at, auto_remind, notes, currency,
        exchange_rate, accountant_id, participant_ids
    ) VALUES (
        1, {cid}, 16, {escape_sql(unit_code)}, {total_price}, 0,
        {escape_sql(dep_status)}, {ACCOUNTANT_ID}, '{earliest_date} 08:00:00', NOW(), 0,
        {escape_sql(notes_content)}, 'VND', 1.0000, {ACCOUNTANT_ID}, '{ACCOUNTANT_ID}'
    );
    """
    run_remote_sql(sql_ins_dep)
    out_new_dep, _ = run_remote_sql("SELECT LAST_INSERT_ID();")
    dep_id = int(out_new_dep.strip().split()[-1])
    existing_cids.add(cid)
    created_bh_deposits += 1
    
    # Insert milestones for this deposit
    for i, v in enumerate(v_list):
        m_name = f"Đợt {i+1} - {v['v_num']}"
        m_status = 'approved' if v['v_paid'] else 'pending'
        act_amount = v['v_val'] if v['v_paid'] else 0.0
        appr_date = f"'{v['v_date']}'" if v['v_paid'] else 'NULL'
        
        sql_ms = f"""
        INSERT INTO deposit_milestones (
            deposit_id, milestone_name, expected_amount, actual_amount,
            expected_pay_date, status, approval_date, notes
        ) VALUES (
            {dep_id}, {escape_sql(m_name)}, {v['v_val']}, {act_amount},
            '{v['v_date']}', '{m_status}', {appr_date}, {escape_sql(v['v_inv'])}
        );
        """
        run_remote_sql(sql_ms)
        created_bh_milestones += 1

print(f"Created {created_bh_deposits} new deposits from Ban_hang.xlsx")
print(f"Created {created_bh_milestones} milestones from Ban_hang.xlsx")

# Step 4: AUDIT SAFETY
print("\n--- STEP 4: AUDIT SAFETY & COUNTS ---")
out_mail_post, _ = run_remote_sql("SELECT COUNT(*) FROM mail_queue;")
out_notif_post, _ = run_remote_sql("SELECT COUNT(*) FROM notifications;")
mail_post = int(out_mail_post.strip().split()[-1]) if out_mail_post.strip() else 0
notif_post = int(out_notif_post.strip().split()[-1]) if out_notif_post.strip() else 0

print(f"Mail queue count: {mail_post} (change: {mail_post - mail_pre})")
print(f"Notifications count: {notif_post} (change: {notif_post - notif_pre})")

if mail_post != mail_pre or notif_post != notif_pre:
    print("WARNING: Count changed!")
else:
    print("AUDIT PERFECT: Exactly 0 emails and 0 notifications sent!")

out_total_deps, _ = run_remote_sql("SELECT COUNT(*) FROM deposits;")
out_total_ms, _ = run_remote_sql("SELECT COUNT(*) FROM deposit_milestones;")
print(f"Total deposits now: {out_total_deps.strip().split()[-1]}")
print(f"Total milestones now: {out_total_ms.strip().split()[-1]}")
