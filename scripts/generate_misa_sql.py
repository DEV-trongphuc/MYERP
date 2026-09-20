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

def query(sql):
    remote = f'''mysql -u vhvxoigh_mail_auto -p'Ideas@812' vhvxoigh_myerp --default-character-set=utf8mb4 -e "{sql}"'''
    proc = subprocess.run(SSH_CMD + [remote], capture_output=True, text=True, encoding='utf-8')
    return proc.stdout

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

ACCOUNTANT_ID = 100064

# Fetch all existing contacts from DB
raw_c = query("SELECT id, full_name FROM contacts;")
contacts_by_norm = {}
for l in raw_c.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 2:
        cn = norm(p[1])
        if cn not in contacts_by_norm:
            contacts_by_norm[cn] = int(p[0])

# Existing contracts and deposits customers
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2).dropna(subset=['Số hợp đồng', 'Khách hàng'])
existing_deposit_names = {norm(c) for c in df_hd['Khách hàng']}

raw_deps = query("SELECT d.id, d.unit_code, c.full_name, d.notes FROM deposits d LEFT JOIN contacts c ON d.contact_id = c.id;")
for l in raw_deps.strip().split('\n')[1:]:
    p = l.split('\t')
    if len(p) >= 3 and p[2]:
        existing_deposit_names.add(norm(p[2]))
    if len(p) >= 4 and p[3]:
        m = re.search(r'Khách hàng:\s*([^\n\\]+)', p[3])
        if m:
            existing_deposit_names.add(norm(m.group(1)))

print(f"Total contacts loaded: {len(contacts_by_norm)}")
print(f"Total existing contract/deposit names: {len(existing_deposit_names)}")

sql_lines = []
sql_lines.append("SET NAMES utf8mb4;")
sql_lines.append("START TRANSACTION;")

# 1. Update the 22 mismatched deposits
fixes = {
    149: 1024816, # Huỳnh Thanh Hùng
    154: 1024817, # Ân Phan
    155: 1024716, # ĐINH PHẠM QUỲNH NHƯ
    173: 1024818, # Lam Chí Hưng
    177: 1024819, # Nguyễn Thị Ái Vân
    179: 1024820, # Trần Thị Yến Nhi
    180: 1024821, # Sophia
    181: 1024822, # Nguyễn Thị Tuyết Thanh
    183: 1024823, # Vũ Thị Thu Hiền
    191: 1024824, # Trần Hoàng Thảo Nguyên
    192: 1024825, # Nguyễn Thị Hoài Trâm
    193: 1024826, # Nguyễn Đỗ Thúy Anh
    194: 1024827, # Khang
    197: 1024828, # Trần Thị Ngọc
    198: 1024829, # Vũ Trường Tân
    200: 1024830, # Đặng Thị Thanh Tâm
    202: 1024831, # Đặng Thuỳ Linh
    203: 1024832, # Nguyễn Xuân Hiệp
    204: 1024833, # Huỳnh Thị Hồng Hạnh
    205: 1024834, # Nguyễn Anh Quang
    206: 1024835, # Nguyễn Đức Thịnh
    207: 1024836  # Thiên Quốc Phan
}

for dep_id, cid in fixes.items():
    sql_lines.append(f"UPDATE deposits SET contact_id = {cid} WHERE id = {dep_id};")

# 2. Update accountant_id and participant_ids on all deposits
sql_lines.append(f"""
UPDATE deposits 
SET accountant_id = {ACCOUNTANT_ID},
    participant_ids = CASE 
        WHEN participant_ids IS NULL OR participant_ids = '' THEN '{ACCOUNTANT_ID}'
        WHEN FIND_IN_SET('{ACCOUNTANT_ID}', participant_ids) > 0 THEN participant_ids
        ELSE CONCAT(participant_ids, ',{ACCOUNTANT_ID}')
    END;
""")

# 3. Process Ban_hang.xlsx
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2).dropna(subset=['Số chứng từ', 'Khách hàng'])
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

bh_deposits_created = 0
bh_milestones_created = 0

for c_norm_key, v_list in bh_by_cust.items():
    # SKIP if this customer already has a contract or deposit in the system!
    if c_norm_key in existing_deposit_names:
        continue
    
    first_v = v_list[0]
    cust_name = format_title_vietnamese(first_v['cust'])
    cn = norm(cust_name)
    
    # Check if contact exists
    if cn in contacts_by_norm:
        cid_var = str(contacts_by_norm[cn])
    else:
        # Create contact in SQL and get its ID
        sql_lines.append(f"""
        INSERT INTO contacts (tenant_id, full_name, owner_id, project_id, pipeline_status, created_at, updated_at)
        VALUES (1, {escape_sql(cust_name)}, {ACCOUNTANT_ID}, 16, 'won', NOW(), NOW());
        """)
        sql_lines.append("SET @cur_cid = LAST_INSERT_ID();")
        cid_var = "@cur_cid"
        contacts_by_norm[cn] = 9999999
    
    total_price = sum(v['v_val'] for v in v_list)
    all_paid = all(v['v_paid'] for v in v_list)
    dep_status = 'approved' if all_paid else 'pending_admin'
    earliest_date = min(v['v_date'] for v in v_list)
    unit_code = first_v['v_num']
    notes_content = f"[Chứng từ bán hàng MISA AMIS - Ban_hang.xlsx]:\\n• Khách hàng: {cust_name}\\n• Số chứng từ: {unit_code}\\n• Số đợt thanh toán: {len(v_list)}"
    
    sql_lines.append(f"""
    INSERT INTO deposits (
        contact_id, project_id, unit_code, price, expected_commission,
        status, created_by, created_at, updated_at, auto_remind, notes, currency,
        exchange_rate, accountant_id, participant_ids
    ) VALUES (
        {cid_var}, 16, {escape_sql(unit_code)}, {total_price}, 0,
        '{dep_status}', {ACCOUNTANT_ID}, '{earliest_date} 08:00:00', NOW(), 0,
        {escape_sql(notes_content)}, 'VND', 1.0000, {ACCOUNTANT_ID}, '{ACCOUNTANT_ID}'
    );
    """)
    sql_lines.append("SET @cur_dep_id = LAST_INSERT_ID();")
    bh_deposits_created += 1
    
    for i, v in enumerate(v_list):
        m_name = f"Đợt {i+1} - {v['v_num']}"
        m_status = 'approved' if v['v_paid'] else 'pending'
        act_amount = v['v_val'] if v['v_paid'] else 0.0
        appr_date = f"'{v['v_date']}'" if v['v_paid'] else 'NULL'
        
        sql_lines.append(f"""
        INSERT INTO deposit_milestones (
            deposit_id, milestone_name, expected_amount, actual_amount,
            expected_pay_date, status, approval_date
        ) VALUES (
            @cur_dep_id, {escape_sql(m_name)}, {v['v_val']}, {act_amount},
            '{v['v_date']}', '{m_status}', {appr_date}
        );
        """)
        bh_milestones_created += 1

sql_lines.append("COMMIT;")

full_sql = '\n'.join(sql_lines)
with open(r'd:\GITHUB_SPACE\MYERP\scripts\sync_misa.sql', 'w', encoding='utf-8') as f:
    f.write(full_sql)

print(f"Generated sync_misa.sql with {len(sql_lines)} lines.")
print(f"New BH deposits to create: {bh_deposits_created}")
print(f"New BH milestones to create: {bh_milestones_created}")
