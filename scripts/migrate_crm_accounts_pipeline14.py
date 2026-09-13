import openpyxl
import sys
import os
import re
import json
import subprocess
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = [
    'ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519',
    '-4', '-p', '2210',
    '-o', 'StrictHostKeyChecking=no',
    'vhvxoigh@chiefaiofficer.vn'
]

EXCEL_PATH = r'D:\Downloads\CRM_Account_13.09.2026_23.22.15_757.xlsx'

SALES_MAPPING = {
    'phúc': 100059,
    'phuc': 100059,
    'hoàng phúc': 100059,
    'đan': 100061,
    'dan': 100061,
    'linh đan': 100061,
    'nhi': 100060,
    'ý nhi': 100060,
}
DEFAULT_SALE_ID = 100062  # Mai Thị Nữ (NV003)

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

def escape_sql(val):
    if val is None:
        return 'NULL'
    s = str(val).replace('\\', '\\\\').replace("'", "\\'")
    return f"'{s}'"

def norm_phone(p):
    if not p:
        return ''
    s = str(p).strip().replace(' ', '').replace('.', '').replace('-', '').replace('+84', '0')
    if not s.startswith('0') and len(s) in (9, 10):
        s = '0' + s
    return s

def parse_date_str(d_str):
    d_str = d_str.replace('.', '/').strip()
    parts = d_str.split('/')
    if len(parts) == 2:
        day, month = int(parts[0]), int(parts[1])
        year = 2026
    elif len(parts) == 3:
        day, month = int(parts[0]), int(parts[1])
        y = int(parts[2])
        year = 2000 + y if y < 100 else y
    else:
        return None
    try:
        return datetime(year, month, day, 12, 0, 0)
    except:
        return None

def extract_interactions(text):
    if not text:
        return []
    pattern = re.compile(r'(\b\d{1,2}[\/\.]\d{1,2}(?:[\/\.]\d{2,4})?\b(?:[\:\-\–]|\s))')
    matches = list(pattern.finditer(text))
    interactions = []
    for i, m in enumerate(matches):
        raw_date = m.group(0).strip(' :-–\t')
        start_idx = m.end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(text)
        body = text[start_idx:end_idx].strip()
        parsed_dt = parse_date_str(raw_date)
        if parsed_dt and len(body) > 2:
            interactions.append({
                'raw_date': raw_date,
                'datetime': parsed_dt.strftime('%Y-%m-%d %H:%M:%S'),
                'body': body
            })
    return interactions

def parse_tags(tag_str):
    if not tag_str:
        return json.dumps([], ensure_ascii=False)
    raw_tags = str(tag_str).split(',')
    cleaned = []
    for t in raw_tags:
        s = t.strip()
        if s.startswith('0.'):
            s = s[2:].strip()
        if s and s not in cleaned:
            cleaned.append(s)
    return json.dumps(cleaned, ensure_ascii=False)

def get_sale_id(owner_name):
    if not owner_name:
        return DEFAULT_SALE_ID
    owner_lower = str(owner_name).lower()
    if 'hoàng phúc' in owner_lower or 'phúc' in owner_lower or 'nv019' in owner_lower:
        return 100059
    if 'linh đan' in owner_lower or 'đan' in owner_lower or 'nv021' in owner_lower:
        return 100061
    if 'ý nhi' in owner_lower or 'nhi' in owner_lower or 'nv022' in owner_lower:
        return 100060
    return DEFAULT_SALE_ID

print("==========================================================")
print("STARTING CRM ACCOUNT MIGRATION TO PIPELINE 14 (ENROLLED)")
print("==========================================================")

# 1. Load Excel file
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
header = list(rows[0])
print(f"Loaded Excel: {len(rows)-1} account records.")

# 2. Fetch current contacts from live DB
print("Fetching existing contacts from database...")
out, err = run_remote_sql("SELECT id, phone, email, full_name, owner_id, pipeline_status, stage_id, student_id FROM contacts;")
if err:
    print("Warning fetching contacts:", err)

db_contacts = []
db_by_id = {}
db_by_phone = {}
db_by_email = {}
db_by_code = {}
db_by_name = {}

for line in out.strip().split('\n')[1:]:
    parts = line.split('\t')
    if len(parts) >= 7:
        c_id = int(parts[0])
        p = parts[1] if parts[1] != 'NULL' else ''
        e = parts[2].lower() if parts[2] != 'NULL' else ''
        n = parts[3].strip() if parts[3] != 'NULL' else ''
        own = int(parts[4]) if parts[4] != 'NULL' else None
        ps = parts[5] if parts[5] != 'NULL' else ''
        st = int(parts[6]) if parts[6] != 'NULL' else None
        code = parts[7].strip() if len(parts) > 7 and parts[7] != 'NULL' else ''
        
        c_obj = {
            'id': c_id, 'phone': p, 'email': e, 'name': n,
            'owner_id': own, 'pipeline_status': ps, 'stage_id': st, 'student_id': code
        }
        db_contacts.append(c_obj)
        db_by_id[c_id] = c_obj
        if code: db_by_code[code] = c_obj
        p_norm = norm_phone(p)
        if len(p_norm) >= 9:
            db_by_phone[p_norm[-9:]] = c_obj
        if e:
            db_by_email[e] = c_obj
        if n:
            db_by_name[n.lower()] = c_obj

print(f"Found {len(db_contacts)} existing contacts in DB.")

# 3. Process each Excel row
code_idx = header.index('Mã khách hàng') if 'Mã khách hàng' in header else -1
name_idx = header.index('Tên khách hàng') if 'Tên khách hàng' in header else -1
phone_idx = header.index('Điện thoại') if 'Điện thoại' in header else -1
email_idx = header.index('Email KH') if 'Email KH' in header else -1
owner_idx = header.index('Chủ sở hữu') if 'Chủ sở hữu' in header else -1
tags_idx = header.index('Thẻ') if 'Thẻ' in header else -1
mota_idx = header.index('Mô tả') if 'Mô tả' in header else -1
notes10_idx = header.index('10 ghi chú gần nhất') if '10 ghi chú gần nhất' in header else -1
source_idx = header.index('Source') if 'Source' in header else -1
campaign_idx = header.index('Campaign') if 'Campaign' in header else -1
medium_idx = header.index('Medium') if 'Medium' in header else -1
created_idx = header.index('Ngày tạo') if 'Ngày tạo' in header else -1
revenue_idx = header.index('Doanh số đơn hàng') if 'Doanh số đơn hàng' in header else -1
order_cnt_idx = header.index('Số lượng đơn hàng') if 'Số lượng đơn hàng' in header else -1
addr_idx = header.index('Địa chỉ (Hóa đơn)') if 'Địa chỉ (Hóa đơn)' in header else -1
last_deal_idx = header.index('Ngày giao dịch gần nhất') if 'Ngày giao dịch gần nhất' in header else -1

updates = []
inserts = []
activities_to_insert = []

for r_idx, r in enumerate(rows[1:], 1):
    r_code = str(r[code_idx]).strip() if code_idx != -1 and r[code_idx] else ''
    r_name = str(r[name_idx]).strip() if name_idx != -1 and r[name_idx] else ''
    r_phone = str(r[phone_idx]).strip() if phone_idx != -1 and r[phone_idx] else ''
    r_phone_norm = norm_phone(r_phone)
    r_email = str(r[email_idx]).strip().lower() if email_idx != -1 and r[email_idx] else ''
    r_owner_raw = str(r[owner_idx]).strip() if owner_idx != -1 and r[owner_idx] else ''
    r_sale_id = get_sale_id(r_owner_raw)
    
    r_tags = parse_tags(r[tags_idx] if tags_idx != -1 else '')
    r_mota = str(r[mota_idx] or '') if mota_idx != -1 else ''
    r_notes10 = str(r[notes10_idx] or '') if notes10_idx != -1 else ''
    
    combined_notes = r_mota
    if r_notes10 and r_notes10 not in combined_notes:
        combined_notes = (combined_notes + "\n--- Ghi chú gần nhất ---\n" + r_notes10).strip()
        
    r_source = str(r[source_idx] or 'other') if source_idx != -1 else 'other'
    r_campaign = str(r[campaign_idx] or '') if campaign_idx != -1 else ''
    r_medium = str(r[medium_idx] or '') if medium_idx != -1 else ''
    
    r_revenue = float(r[revenue_idx]) if revenue_idx != -1 and r[revenue_idx] is not None else 0.0
    r_order_cnt = int(r[order_cnt_idx]) if order_cnt_idx != -1 and r[order_cnt_idx] is not None else 0
    r_addr = str(r[addr_idx] or '') if addr_idx != -1 else ''
    
    # Interactions
    interactions = extract_interactions(r_mota + "\n" + r_notes10)
    latest_interaction_dt = None
    if interactions:
        latest_interaction_dt = max([item['datetime'] for item in interactions])
    elif last_deal_idx != -1 and r[last_deal_idx]:
        latest_interaction_dt = str(r[last_deal_idx])
    
    # Matching
    matched_contact = None
    if r_code and r_code in db_by_code:
        matched_contact = db_by_code[r_code]
    elif r_phone_norm and len(r_phone_norm) >= 9 and r_phone_norm[-9:] in db_by_phone:
        matched_contact = db_by_phone[r_phone_norm[-9:]]
    elif r_email and r_email in db_by_email:
        matched_contact = db_by_email[r_email]
    elif r_name and r_name.lower() in db_by_name:
        matched_contact = db_by_name[r_name.lower()]
        
    if matched_contact:
        c_id = matched_contact['id']
        updates.append({
            'id': c_id,
            'name': r_name or matched_contact['name'],
            'student_id': r_code or matched_contact['student_id'],
            'owner_id': r_sale_id,
            'stage_id': 44,
            'pipeline_status': 'enrolled',
            'status': 'customer',
            'tags': r_tags,
            'notes': combined_notes,
            'source': r_source,
            'utm_campaign': r_campaign,
            'utm_medium': r_medium,
            'last_contact': latest_interaction_dt,
            'total_spent': r_revenue,
            'order_count': r_order_cnt,
            'address': r_addr,
            'interactions': interactions
        })
    else:
        # Create new
        r_created_at = str(r[created_idx]) if created_idx != -1 and r[created_idx] else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        inserts.append({
            'name': r_name,
            'phone': r_phone_norm or r_phone,
            'email': r_email,
            'student_id': r_code,
            'owner_id': r_sale_id,
            'stage_id': 44,
            'pipeline_status': 'enrolled',
            'status': 'customer',
            'tags': r_tags,
            'notes': combined_notes,
            'source': r_source,
            'utm_campaign': r_campaign,
            'utm_medium': r_medium,
            'created_at': r_created_at,
            'last_contact': latest_interaction_dt,
            'total_spent': r_revenue,
            'order_count': r_order_cnt,
            'address': r_addr,
            'interactions': interactions
        })

print(f"\nPrepared plan:")
print(f"  - Contacts to UPDATE: {len(updates)}")
print(f"  - Contacts to INSERT: {len(inserts)}")

# Check HOÀNG PHI explicitly
hoang_phi_updates = [
    # 1024714 (created today)
    {
        'id': 1024714,
        'student_id': 'BBA-25-0003211EN',
        'owner_id': 100062,
        'stage_id': 44,
        'pipeline_status': 'enrolled',
        'status': 'customer',
        'tags': json.dumps(['UMEF', 'Mã HV: BBA-25-0003211EN', 'Bằng: Cử nhân'], ensure_ascii=False),
        'notes': 'Trường: UMEF\nMã học viên: BBA-25-0003211EN\nLoại bằng: Cử nhân',
    },
    # 1024184 (from backup)
    {
        'id': 1024184,
        'phone': '0346364900',
        'student_id': 'BBA-25-0003211EN',
        'owner_id': 100062,
        'stage_id': 44,
        'pipeline_status': 'enrolled',
        'status': 'customer',
    }
]

print("Executing updates to contacts...")
sql_statements = []

for u in updates:
    set_clauses = [
        f"owner_id = {u['owner_id']}",
        f"stage_id = {u['stage_id']}",
        f"pipeline_status = {escape_sql(u['pipeline_status'])}",
        f"status = {escape_sql(u['status'])}",
        f"student_id = {escape_sql(u['student_id'])}",
        f"tags = {escape_sql(u['tags'])}",
        f"notes = {escape_sql(u['notes'])}",
        f"source = {escape_sql(u['source'])}",
        f"utm_campaign = {escape_sql(u['utm_campaign'])}",
        f"utm_medium = {escape_sql(u['utm_medium'])}",
    ]
    if u['total_spent'] > 0:
        set_clauses.append(f"total_spent = {u['total_spent']}")
    if u['order_count'] > 0:
        set_clauses.append(f"order_count = {u['order_count']}")
    if u['address']:
        set_clauses.append(f"address = {escape_sql(u['address'])}")
    if u['last_contact']:
        set_clauses.append(f"last_contact = {escape_sql(u['last_contact'])}")
        
    sql = f"UPDATE contacts SET {', '.join(set_clauses)} WHERE id = {u['id']};"
    sql_statements.append(sql)

for hp in hoang_phi_updates:
    clauses = [f"{k} = {escape_sql(v) if isinstance(v, str) else v}" for k, v in hp.items() if k != 'id']
    sql = f"UPDATE contacts SET {', '.join(clauses)} WHERE id = {hp['id']};"
    sql_statements.append(sql)

print(f"Generated {len(sql_statements)} contact update queries.")

# Execute update batch
batch_sql = "SET SQL_SAFE_UPDATES=0;\n" + "\n".join(sql_statements)
out, err = run_remote_sql(batch_sql)
if err and 'Warning' not in err:
    print("Error during contact updates:", err)
else:
    print(f"✔ Successfully updated {len(updates)} contacts!")

# Now process inserts if any
if inserts:
    print(f"\nInserting {len(inserts)} new contacts...")
    insert_sqls = []
    for ins in inserts:
        cols = ['tenant_id', 'created_by', 'full_name', 'phone', 'email', 'owner_id', 
                'stage_id', 'pipeline_status', 'status', 'student_id', 'tags', 'notes', 
                'source', 'utm_campaign', 'utm_medium', 'created_at']
        vals = [
            '1', '1',
            escape_sql(ins['name']),
            escape_sql(ins['phone']),
            escape_sql(ins['email']),
            str(ins['owner_id']),
            str(ins['stage_id']),
            escape_sql(ins['pipeline_status']),
            escape_sql(ins['status']),
            escape_sql(ins['student_id']),
            escape_sql(ins['tags']),
            escape_sql(ins['notes']),
            escape_sql(ins['source']),
            escape_sql(ins['utm_campaign']),
            escape_sql(ins['utm_medium']),
            escape_sql(ins['created_at'])
        ]
        if ins['last_contact']:
            cols.append('last_contact')
            vals.append(escape_sql(ins['last_contact']))
        if ins['total_spent'] > 0:
            cols.append('total_spent')
            vals.append(str(ins['total_spent']))
        if ins['order_count'] > 0:
            cols.append('order_count')
            vals.append(str(ins['order_count']))
        if ins['address']:
            cols.append('address')
            vals.append(escape_sql(ins['address']))
            
        sql = f"INSERT INTO contacts ({', '.join(cols)}) VALUES ({', '.join(vals)});"
        insert_sqls.append(sql)
        
    out, err = run_remote_sql("\n".join(insert_sqls))
    if err and 'Warning' not in err:
        print("Error during contact inserts:", err)
    else:
        print(f"✔ Successfully inserted {len(inserts)} new contacts!")

# Now get final contact ID mapping to insert activities
print("\nMapping contact IDs for interaction insertion...")
out, err = run_remote_sql("SELECT id, phone, email, student_id FROM contacts;")
all_contacts_map = {}
for line in out.strip().split('\n')[1:]:
    parts = line.split('\t')
    if len(parts) >= 3:
        cid = int(parts[0])
        p = norm_phone(parts[1]) if parts[1] != 'NULL' else ''
        e = parts[2].lower().strip() if parts[2] != 'NULL' else ''
        st_id = parts[3].strip() if len(parts) > 3 and parts[3] != 'NULL' else ''
        if st_id: all_contacts_map[st_id] = cid
        if p and len(p) >= 9: all_contacts_map[p[-9:]] = cid
        if e: all_contacts_map[e] = cid

# Prepare activities
activity_sqls = []
for item in updates + inserts:
    c_id = item.get('id')
    if not c_id:
        st_id = item.get('student_id')
        p = norm_phone(item.get('phone', ''))
        e = item.get('email', '')
        c_id = all_contacts_map.get(st_id) or all_contacts_map.get(p[-9:]) or all_contacts_map.get(e)
        
    if not c_id:
        continue
        
    user_id = item['owner_id']
    for act in item.get('interactions', []):
        act_sql = f"""
        INSERT INTO activities (
            tenant_id, user_id, type, subject, body, status, priority, 
            due_date, done_at, created_at, related_type, related_id, contact_id
        ) SELECT 
            1, {user_id}, 'note', {escape_sql('Tương tác - ' + act['raw_date'])}, {escape_sql(act['body'])}, 
            'done', 'medium', {escape_sql(act['datetime'])}, {escape_sql(act['datetime'])}, {escape_sql(act['datetime'])}, 
            'contact', {c_id}, {c_id}
        WHERE NOT EXISTS (
            SELECT 1 FROM activities 
            WHERE contact_id = {c_id} AND subject = {escape_sql('Tương tác - ' + act['raw_date'])}
        );
        """
        activity_sqls.append(act_sql.strip())

print(f"Generated {len(activity_sqls)} activity insertion queries.")
# Execute in batches of 100
BATCH_SIZE = 100
for i in range(0, len(activity_sqls), BATCH_SIZE):
    batch = activity_sqls[i:i+BATCH_SIZE]
    out, err = run_remote_sql("\n".join(batch))
    if err and 'Warning' not in err:
        print(f"Error in activity batch {i//BATCH_SIZE}:", err)

print(f"✔ All {len(activity_sqls)} interaction activities processed!")
print("==========================================================")
print("MIGRATION COMPLETED SUCCESSFULLY!")
print("==========================================================")
