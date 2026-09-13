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

def match_user(raw_str, default_id=None):
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
    if not raw_str: return []
    res = []
    parts = re.split(r'[,;]+', raw_str)
    for p in parts:
        p = p.strip()
        if p:
            uid = match_user(p)
            if uid and uid not in res:
                res.append(uid)
    return res

cmd = 'find "/home/vhvxoigh/myerp.ideas.edu.vn/backend/uploads/misa_attachments/tasks" -type f'
proc = subprocess.Popen(SSH_CMD + [cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out_f, _ = proc.communicate()
server_files = [l.strip() for l in out_f.decode('utf-8', errors='replace').split('\n') if l.strip()]

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
    for kw_key, kw_patterns in keywords_map.items():
        if kw_key in subj_norm:
            for fp in server_files:
                fn = fp.split('/')[-1]
                fn_norm = remove_accents(fn)
                if any(p in fn_norm for p in kw_patterns):
                    matched.append((fp, fn))
                    
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
    return None

def extract_date_from_text(text):
    if not text: return None
    m = re.search(r'(\d{1,2})[\./\-](\d{1,2})[\./\-](\d{4})', text)
    if m:
        d, mon, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mon, d, 18, 0, 0).strftime('%Y-%m-%d %H:%M:%S')
        except: pass
    m2 = re.search(r'Tháng\s*(\d{1,2})[\./\-](\d{4})', text, re.IGNORECASE)
    if m2:
        mon, y = int(m2.group(1)), int(m2.group(2))
        try:
            return datetime(y, mon, 28, 18, 0, 0).strftime('%Y-%m-%d %H:%M:%S')
        except: pass
    return None

cutoff = datetime(2026, 8, 1)
all_parsed = []

for te in task_excels:
    fname = os.path.basename(te)
    wb = openpyxl.load_workbook(io.BytesIO(z.read(te)), data_only=True)
    ws = wb.active
    
    c_stt, c_name, c_parent, c_desc, c_status, c_due, c_start, c_created, c_assignee, c_followers, c_creator, c_progress, c_finish = 1, 2, 3, 5, 7, 8, 9, 10, 11, 14, 15, 17, 23
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
            elif val == 'Tiến độ công việc': c_progress = c
            elif val == 'Ngày hoàn thành thực tế': c_finish = c

    curr_root = None
    file_roots = []
    
    for r in range(7, ws.max_row + 1):
        name = ws.cell(r, c_name).value
        if not name: continue
        name_clean = str(name).strip()
        stt = str(ws.cell(r, c_stt).value or '').strip()
        parent = str(ws.cell(r, c_parent).value or '').strip()
        is_subtask = ('.' in stt) or name_clean.startswith('    ') or bool(parent)
        
        dt_created = parse_date(ws.cell(r, c_created).value) if c_created else None
        dt_due = parse_date(ws.cell(r, c_due).value) if c_due else None
        dt_start = parse_date(ws.cell(r, c_start).value) if c_start else None
        dt_finish = parse_date(ws.cell(r, c_finish).value) if c_finish else None
        
        c6_val = str(ws.cell(r, 6).value or '').strip()
        c7_val = str(ws.cell(r, c_status).value or '').strip().lower()
        
        progress_val = 0
        if c_progress and ws.cell(r, c_progress).value:
            try:
                progress_val = int(float(str(ws.cell(r, c_progress).value).replace('%','').strip()))
            except: pass
            
        is_truly_done = False
        if 'chưa hoàn thành' in c7_val or 'chưa' in c7_val:
            is_truly_done = False
        elif 'hoàn thành' in c7_val or 'đã đóng' in c7_val or 'đã hoàn thành' in c6_val.lower():
            if progress_val == 100 or dt_finish:
                is_truly_done = True
                
        assignee_id = match_user(str(ws.cell(r, c_assignee).value or ''), 100067)
        creator_id = match_user(str(ws.cell(r, c_creator).value or ''), 100062)
        followers = match_user_ids(str(ws.cell(r, c_followers).value or ''))
        
        item = {
            'row': r,
            'stt': stt,
            'subject': name_clean,
            'desc': str(ws.cell(r, c_desc).value or '').strip(),
            'is_subtask': is_subtask,
            'status': 'done' if is_truly_done else 'planned',
            'progress': progress_val,
            'created_at': dt_created,
            'due_date': dt_due or extract_date_from_text(name_clean) or extract_date_from_text(str(ws.cell(r, c_desc).value or '')) or dt_finish,
            'start_date': dt_start,
            'user_id': assignee_id,
            'created_by': creator_id,
            'followers': followers,
            'checklist': []
        }
        
        if is_subtask and curr_root:
            sub_due = dt_due or extract_date_from_text(name_clean) or dt_finish
            sub_id = f"sub_{stt.replace('.', '_')}_{r}" if stt else f"sub_{r}"
            curr_root['checklist'].append({
                'id': sub_id,
                'title': name_clean,
                'text': name_clean,
                'checked': is_truly_done,
                'done': is_truly_done,
                'due_date': sub_due,
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
            if not rt['due_date']:
                sub_dates = [ch['due_date'] for ch in rt['checklist'] if ch.get('due_date')]
                if sub_dates:
                    rt['due_date'] = max(sub_dates)
            if not rt['due_date'] and rt['created_at']:
                try:
                    c_dt = datetime.strptime(rt['created_at'], '%Y-%m-%d %H:%M:%S')
                    rt['due_date'] = (c_dt.replace(hour=18, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S')
                except: pass
                
            # Combine ALL participants:
            # 1. followers from MISA
            # 2. subtasks assignees
            # 3. 100062 (Mai Thị Nữ)
            all_parts = set(rt['followers'])
            for ch in rt['checklist']:
                if ch.get('assignee_id'):
                    all_parts.add(ch['assignee_id'])
            all_parts.add(100062) # Mai Thị Nữ
            if rt['user_id'] in all_parts:
                all_parts.remove(rt['user_id'])
            rt['participant_ids'] = ",".join(str(x) for x in sorted(all_parts))
            rt['links'] = find_files_for_task(rt['subject'], rt['desc'])
            all_parsed.append(rt)

print(f"Extracted {len(all_parsed)} tasks ready for DB update.")

# Execute DB Updates
sql_batches = []
for t in all_parsed:
    body_json = {
        "erp_task": {
            "misa_stt": t['stt'],
            "description": t['desc'],
            "internal_type": "task",
            "scope": "team",
            "recurrence": {
                "pattern": "none",
                "weekly_days": [],
                "monthly_day": 1,
                "days_interval": 3,
                "last_generated": ""
            },
            "checklist": t['checklist'],
            "links": t['links']
        },
        "due_sla_notified": True,
        "subtask_sla_notified": True
    }
    body_str = json.dumps(body_json, ensure_ascii=False)
    
    # Check existing by subject
    subj_check = f"SELECT id FROM activities WHERE type = 'task' AND subject = {escape_sql(t['subject'])} LIMIT 1;"
    out_sc, _ = run_remote_sql(subj_check)
    existing_id = None
    for line in out_sc.strip().split('\n')[1:]:
        if line.strip().isdigit():
            existing_id = int(line.strip())
            break
            
    priority_val = 'high' if 'khẩn' in t['subject'].lower() or 'lễ tốt nghiệp' in t['subject'].lower() else 'medium'
    
    if existing_id:
        upd = f"""
        UPDATE activities SET
            body = {escape_sql(body_str)},
            user_id = {t['user_id']},
            created_by = {t['created_by']},
            participant_ids = {escape_sql(t['participant_ids'])},
            status = '{t['status']}',
            priority = '{priority_val}',
            progress = {t['progress']},
            created_at = {escape_sql(t['created_at'])},
            due_date = {escape_sql(t['due_date'])},
            related_type = NULL,
            related_id = NULL,
            tags = 'misa_migrated,post_aug'
        WHERE id = {existing_id};
        """
        run_remote_sql(upd)
    else:
        ins = f"""
        INSERT INTO activities (
            tenant_id, user_id, created_by, type, subject, body,
            status, priority, progress, start_date, due_date, tags, created_at,
            related_type, related_id, participant_ids
        ) VALUES (
            1, {t['user_id']}, {t['created_by']}, 'task', {escape_sql(t['subject'])}, {escape_sql(body_str)},
            '{t['status']}', '{priority_val}', {t['progress']}, {escape_sql(t['start_date'])}, {escape_sql(t['due_date'])},
            'misa_migrated,post_aug', {escape_sql(t['created_at'])},
            NULL, NULL, {escape_sql(t['participant_ids'])}
        );
        """
        run_remote_sql(ins)

print("DATABASE ACTIVITIES UPDATED SUCCESSFULLY!")

# Verification query
out_v, _ = run_remote_sql("""
SELECT 
    COUNT(*) as total_aug_tasks,
    SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned_tasks,
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_tasks,
    SUM(CASE WHEN due_date IS NOT NULL THEN 1 ELSE 0 END) as with_deadline,
    SUM(CASE WHEN created_at IS NOT NULL THEN 1 ELSE 0 END) as with_created,
    SUM(CASE WHEN participant_ids IS NOT NULL AND participant_ids != '' THEN 1 ELSE 0 END) as with_participants
FROM activities 
WHERE type = 'task' AND created_at >= '2026-08-01';
""")
print("\n--- VERIFICATION STATS ---")
print(out_v)
