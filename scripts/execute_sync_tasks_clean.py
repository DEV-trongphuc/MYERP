import zipfile, io, os, sys, re, openpyxl, unicodedata, json, subprocess
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = [
    'ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519',
    '-4', '-p', '2210',
    '-o', 'StrictHostKeyChecking=no',
    'vhvxoigh@chiefaiofficer.vn'
]

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
    if val is None: return 'NULL'
    s = str(val).replace('\\', '\\\\').replace("'", "\\'")
    return f"'{s}'"

def remove_accents(s):
    if not s: return ""
    s1 = unicodedata.normalize('NFD', s)
    s2 = "".join(c for c in s1 if unicodedata.category(c) != 'Mn')
    return s2.replace('đ', 'd').replace('Đ', 'D').lower().strip()

print("==================================================================")
print("1. LOADING USERS & ATTACHMENTS")
print("==================================================================")

out_u, _ = run_remote_sql("SELECT id, full_name, email FROM users;")
users = []
for line in out_u.strip().split('\n')[1:]:
    p = line.split('\t')
    if len(p) >= 2:
        users.append({
            'id': int(p[0]),
            'full_name': p[1].strip(),
            'email': p[2].strip() if len(p) > 2 else ''
        })
print(f"Loaded {len(users)} users from database.")

def match_user(raw_str, default_id=100067):
    if not raw_str: return default_id
    clean_name = raw_str.split('(')[0].strip()
    norm = remove_accents(clean_name)
    if not norm: return default_id
    for u in users:
        if remove_accents(u['full_name']) == norm:
            return u['id']
    m = re.search(r'[\w\.-]+@ideas\.edu\.vn', raw_str)
    if m:
        em = m.group(0).lower()
        for u in users:
            if u['email'].lower() == em:
                return u['id']
    for u in users:
        u_norm = remove_accents(u['full_name'])
        if norm in u_norm or u_norm in norm:
            return u['id']
    return default_id

def match_user_ids(raw_str):
    if not raw_str: return ""
    res = []
    parts = re.split(r'[,;]+', raw_str)
    for p in parts:
        p = p.strip()
        if p:
            uid = match_user(p, None)
            if uid and uid not in res:
                res.append(uid)
    return ",".join(str(x) for x in res)

# Load server files
cmd = 'find "/home/vhvxoigh/myerp.ideas.edu.vn/backend/uploads/misa_attachments/tasks" -type f'
proc = subprocess.Popen(SSH_CMD + [cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out_f, _ = proc.communicate()
server_files = [l.strip() for l in out_f.decode('utf-8', errors='replace').split('\n') if l.strip()]
print(f"Indexed {len(server_files)} task attachment files on server.")

keywords_map = {
    "lễ tốt nghiệp": ["tot nghiep", "graduation"],
    "dba istec": ["istec", "brochure mba - vn"],
    "brochure dba": ["brochure mba - vn"],
    "ort bba": ["umef bba", "bba_attendance"],
    "ort msc": ["umef msc ai", "tan thac si msc ai"],
    "ort mba": ["orientation mba", "umef st&hq"],
    "vỏ bằng ega": ["ega_diploma"],
    "lead magnet - koda": ["lead magnet", "koda", "certificate"],
    "bộ salekit dba istec": ["istec", "brochure"],
    "chính sách tuyển sinh tháng 08.2026": ["chinh sach"],
    "booth tư vấn": ["booth"],
    "order namecard": ["namecard"]
}

def find_files_for_task(subject, description=""):
    matched = []
    subj_norm = remove_accents(subject)
    
    # 1. Check keywords_map
    for kw_key, kw_patterns in keywords_map.items():
        if kw_key in subj_norm:
            for fp in server_files:
                fn = fp.split('/')[-1]
                fn_norm = remove_accents(fn)
                if any(p in fn_norm for p in kw_patterns):
                    matched.append((fp, fn))
                    
    # 2. Check phrase / person name
    words = [w for w in re.split(r'[\s\-_.,]+', subj_norm) if len(w) >= 2 and w not in ['thang', 'ngay', 'danh', 'sach', 'cong', 'viec', 'hop', 'dong', 'ideas', 'intake']]
    if words:
        full_phrase = " ".join(words)
        for fp in server_files:
            fn = fp.split('/')[-1]
            fn_norm = remove_accents(fn)
            if full_phrase in fn_norm:
                matched.append((fp, fn))
            elif len(words) >= 3:
                cnt = sum(1 for w in words if w in fn_norm)
                if cnt >= len(words) - 1:
                    matched.append((fp, fn))
            elif len(words) == 2:
                if words[0] in fn_norm and words[1] in fn_norm:
                    matched.append((fp, fn))
                    
    seen = set()
    links = []
    for fp, fn in matched:
        if fn in seen: continue
        seen.add(fn)
        rel_url = fp.replace('/home/vhvxoigh/myerp.ideas.edu.vn', '')
        if not rel_url.startswith('/'): rel_url = '/' + rel_url
        links.append({
            'url': rel_url,
            'label': fn,
            'is_file': True
        })
    return links[:10]

print("==================================================================")
print("2. PARSING ALL 5 EXCEL FILES FROM 01/08/2026")
print("==================================================================")

zp = r"D:\Downloads\MISA-20260913T054357Z-1-001.zip"
z = zipfile.ZipFile(zp)

task_excels = [
    "MISA/Công việc Final/Liên phòng SaleMKT - Đào tạo - Kế toán/Liên phòng Sale_MKT - Đào tạo - Kế toán_Danh sách công việc dự án.xlsx",
    "MISA/Công việc Final/Khối kinh doanh và trải nghiệm học viên/Phòng Học vụ - Học thuật/Chuyển giao học viên mới/HV DBA_Danh sách công việc dự án.xlsx",
    "MISA/Công việc Final/Khối kinh doanh và trải nghiệm học viên/Phòng Học vụ - Học thuật/Chuyển giao học viên mới/HV MBA_EMBA_Danh sách công việc dự án.xlsx",
    "MISA/Công việc Final/Khối kinh doanh và trải nghiệm học viên/Phòng Học vụ - Học thuật/Chuyển giao học viên mới/HV TOP UP_Danh sách công việc dự án.xlsx",
    "MISA/Công việc Final/Khối kinh doanh và trải nghiệm học viên/Liên phòng Sale MKT/Liên phòng Sale & Marketing_Danh sách công việc dự án.xlsx"
]

def parse_date(v):
    if not v: return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d %H:%M:%S')
    s = str(v).strip()
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try: return datetime.strptime(s, fmt).strftime('%Y-%m-%d %H:%M:%S')
        except: pass
    return s

cutoff = datetime(2026, 8, 1)
all_roots = []

for te in task_excels:
    fname = os.path.basename(te)
    wb = openpyxl.load_workbook(io.BytesIO(z.read(te)), data_only=True)
    ws = wb.active
    
    c_stt, c_name, c_parent, c_desc, c_status, c_due, c_start, c_created, c_assignee, c_priority, c_followers, c_creator, c_progress = 1, 2, 3, 5, 7, 8, 9, 10, 11, 13, 14, 15, 17
    for r in range(1, 10):
        for c in range(1, ws.max_column + 1):
            val = str(ws.cell(r, c).value or '').strip()
            if val == 'STT': c_stt = c
            elif val == 'Tên công việc': c_name = c
            elif val == 'Tên công việc cha': c_parent = c
            elif val == 'Mô tả': c_desc = c
            elif val == 'Trạng thái công việc': c_status = c
            elif val == 'Hạn hoàn thành': c_due = c
            elif val == 'Ngày bắt đầu': c_start = c
            elif val == 'Ngày tạo': c_created = c
            elif val == 'Người thực hiện': c_assignee = c
            elif val == 'Người liên quan': c_followers = c
            elif val == 'Người tạo công việc': c_creator = c
            elif val == 'Mức độ quan trọng': c_priority = c
            elif val == 'Tiến độ công việc': c_progress = c

    file_roots = []
    curr_root = None
    
    for r in range(7, ws.max_row + 1):
        name = ws.cell(r, c_name).value
        if not name: continue
        name_clean = str(name).strip()
        stt = str(ws.cell(r, c_stt).value or '').strip()
        parent = str(ws.cell(r, c_parent).value or '').strip()
        
        dt_created = parse_date(ws.cell(r, c_created).value) if c_created else None
        dt_due = parse_date(ws.cell(r, c_due).value) if c_due else None
        dt_start = parse_date(ws.cell(r, c_start).value) if c_start else None
        
        desc = str(ws.cell(r, c_desc).value or '').strip()
        status_str = str(ws.cell(r, c_status).value or '').strip().lower()
        is_done = ('hoàn thành' in status_str or 'đã đóng' in status_str)
        priority_val = 'high' if 'cao' in str(ws.cell(r, c_priority).value or '').lower() else 'medium'
        progress_val = 100 if is_done else 0
        if c_progress and ws.cell(r, c_progress).value:
            try:
                progress_val = int(float(str(ws.cell(r, c_progress).value).replace('%','').strip()))
            except: pass
            
        assignee_str = str(ws.cell(r, c_assignee).value or '').strip()
        creator_str = str(ws.cell(r, c_creator).value or '').strip()
        followers_str = str(ws.cell(r, c_followers).value or '').strip()
        
        assignee_id = match_user(assignee_str, 100067)
        creator_id = match_user(creator_str, 100067)
        follower_ids = match_user_ids(followers_str)
        
        is_subtask = ('.' in stt) or name_clean.startswith('    ') or bool(parent)
        
        item = {
            'row': r,
            'stt': stt,
            'subject': name_clean,
            'parent': parent,
            'is_subtask': is_subtask,
            'desc': desc,
            'status': 'done' if is_done else 'planned',
            'is_done': is_done,
            'priority': priority_val,
            'progress': progress_val,
            'start_date': dt_start,
            'due_date': dt_due,
            'created_at': dt_created,
            'user_id': assignee_id,
            'created_by': creator_id,
            'participant_ids': follower_ids,
            'file': fname,
            'checklist': [],
            'links': []
        }
        
        if is_subtask and curr_root:
            sub_id = f"sub_{stt.replace('.', '_')}_{r}" if stt else f"sub_{r}"
            curr_root['checklist'].append({
                'id': sub_id,
                'title': name_clean,
                'text': name_clean,
                'checked': is_done,
                'done': is_done,
                'due_date': dt_due,
                'assignee_id': assignee_id,
                'notified_sla': True
            })
        else:
            curr_root = item
            file_roots.append(curr_root)
            
    for rt in file_roots:
        keep = False
        for dt_s in (rt['created_at'], rt['due_date']):
            if dt_s:
                try:
                    if datetime.strptime(dt_s, '%Y-%m-%d %H:%M:%S') >= cutoff:
                        keep = True
                        break
                except: pass
        if not keep:
            for ch in rt['checklist']:
                if ch.get('due_date'):
                    try:
                        if datetime.strptime(ch['due_date'], '%Y-%m-%d %H:%M:%S') >= cutoff:
                            keep = True
                            break
                    except: pass
        if keep:
            rt['links'] = find_files_for_task(rt['subject'], rt['desc'])
            all_roots.append(rt)

print(f"Extracted {len(all_roots)} root tasks and {sum(len(rt['checklist']) for rt in all_roots)} subtasks from Excel files.")

print("==================================================================")
print("3. CLEANING ORPHAN SUBTASKS & UNBINDING UNWANTED PROJECTS")
print("==================================================================")

# Remove orphan subtasks in activities table
# These are subtasks that were mistakenly inserted as activities
clean_orphan_sql = """
DELETE FROM activities 
WHERE id IN (
    54443, 54444, 54445, 54446, 54593, 54668, 54669, 54671, 54672, 
    54674, 54675, 54677, 54678, 54679, 54680, 54681, 54683, 54684, 
    54686, 54687, 54689, 54690, 54692, 54693, 54695, 54696, 54754, 
    54755, 54758, 54759, 54760
);
"""
out_co, err_co = run_remote_sql(clean_orphan_sql)
print("Cleaned orphan subtask records from activities.")

# Unbind projects 2, 3, 4, 5, 6, 7, 8 from activities
unbind_sql = """
UPDATE activities 
SET related_type = NULL, related_id = NULL 
WHERE related_type = 'project' AND related_id IN (2, 3, 4, 5, 6, 7, 8);

DELETE FROM projects WHERE id IN (2, 3, 4, 5, 6, 7, 8);
"""
out_ub, err_ub = run_remote_sql(unbind_sql)
print("Unbound unwanted project associations and cleaned project table.")

print("==================================================================")
print("4. SYNCHRONIZING STANDARDIZED ROOT TASKS, SUBTASKS & FILES")
print("==================================================================")

total_updated = 0
total_inserted = 0

for rt in all_roots:
    body_json = {
        "erp_task": {
            "misa_stt": rt['stt'],
            "description": rt['desc'],
            "internal_type": "task",
            "scope": "team",
            "recurrence": {
                "pattern": "none",
                "weekly_days": [],
                "monthly_day": 1,
                "days_interval": 3,
                "last_generated": ""
            },
            "checklist": rt['checklist'],
            "links": rt['links']
        },
        "due_sla_notified": True,
        "subtask_sla_notified": True
    }
    body_str = json.dumps(body_json, ensure_ascii=False)
    
    # Check if task already exists in activities
    # Match by subject or id if we know it
    subj_check = f"SELECT id FROM activities WHERE type = 'task' AND subject = {escape_sql(rt['subject'])} LIMIT 1;"
    out_sc, _ = run_remote_sql(subj_check)
    existing_id = None
    for line in out_sc.strip().split('\n')[1:]:
        if line.strip().isdigit():
            existing_id = int(line.strip())
            break
            
    if existing_id:
        upd_sql = f"""
        UPDATE activities 
        SET body = {escape_sql(body_str)},
            user_id = {rt['user_id']},
            created_by = {rt['created_by']},
            participant_ids = {escape_sql(rt['participant_ids'])},
            status = '{rt['status']}',
            priority = '{rt['priority']}',
            progress = {rt['progress']},
            start_date = {escape_sql(rt['start_date'])},
            due_date = {escape_sql(rt['due_date'])},
            related_type = NULL,
            related_id = NULL,
            tags = 'misa_migrated,post_aug'
        WHERE id = {existing_id};
        """
        run_remote_sql(upd_sql)
        total_updated += 1
    else:
        ins_sql = f"""
        INSERT INTO activities (
            tenant_id, user_id, created_by, type, subject, body, 
            status, priority, progress, start_date, due_date, tags, created_at,
            related_type, related_id
        ) VALUES (
            1, {rt['user_id']}, {rt['created_by']}, 'task', {escape_sql(rt['subject'])}, {escape_sql(body_str)},
            '{rt['status']}', '{rt['priority']}', {rt['progress']}, {escape_sql(rt['start_date'])}, {escape_sql(rt['due_date'])},
            'misa_migrated,post_aug', {escape_sql(rt['created_at'] or '2026-08-01 00:00:00')},
            NULL, NULL
        );
        """
        run_remote_sql(ins_sql)
        total_inserted += 1

print(f"Sync complete! Updated {total_updated} tasks, Inserted {total_inserted} tasks.")

print("==================================================================")
print("5. VERIFICATION & INTEGRITY CHECK")
print("==================================================================")

ver_sql = """
SELECT 'PROJECT COUNT:' as lbl, count(*) as cnt FROM projects
UNION ALL
SELECT 'PROJECT 2 OR 5 TASKS:' as lbl, count(*) as cnt FROM activities WHERE related_type = 'project' AND related_id IN (2, 5)
UNION ALL
SELECT 'ALL PROJECT LINKED TASKS:' as lbl, count(*) as cnt FROM activities WHERE type = 'task' AND related_type = 'project'
UNION ALL
SELECT 'NATIVE MYERP TASKS:' as lbl, count(*) as cnt FROM activities WHERE type = 'task' AND tags LIKE '%internal_task%'
UNION ALL
SELECT 'TOTAL TASKS AUGUST:' as lbl, count(*) as cnt FROM activities WHERE type = 'task' AND created_at >= '2026-08-01';
"""
out_v, _ = run_remote_sql(ver_sql)
print(out_v)
print("==================================================================")
print("TASK CLEANUP & SYNCHRONIZATION FINISHED SUCCESSFULLY!")
print("==================================================================")
