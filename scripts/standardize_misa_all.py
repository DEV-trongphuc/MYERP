import sys
import io
import os
import zipfile
import json
import re
import openpyxl
import subprocess
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

SSH_CMD = [
    'ssh', '-i', r'C:\Users\LENOVO\.ssh\id_ed25519',
    '-4', '-p', '2210',
    '-o', 'StrictHostKeyChecking=no',
    'vhvxoigh@chiefaiofficer.vn'
]

ZIP_PATHS = [
    r"D:\Downloads\MISA-20260913T054357Z-1-001.zip",
    r"D:\Downloads\MISA-20260913T054357Z-1-002.zip"
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

def parse_date(v):
    if not v: return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d %H:%M:%S')
    s = str(v).strip()
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try: return datetime.strptime(s, fmt).strftime('%Y-%m-%d %H:%M:%S')
        except: pass
    return s

def clean_user_str(u_str):
    if not u_str: return "", ""
    s = str(u_str).strip()
    name = s.split('(')[0].strip()
    title = ""
    m = re.search(r'VTCV:\s*([^-\)]+)', s)
    if m:
        title = m.group(1).strip()
    return name, title

def parse_num(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace('.', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

def escape_sql(val):
    if val is None: return 'NULL'
    s = str(val).replace('\\', '\\\\').replace("'", "\\'")
    return f"'{s}'"

print("==========================================================")
print("MYERP COMPREHENSIVE STANDARDIZATION & MIGRATION")
print("==========================================================")

# 1. Load users
print("Loading users from MYERP database...")
out, err = run_remote_sql("SELECT id, full_name, email, role, department FROM users;")
users = []
for line in out.strip().split('\n')[1:]:
    parts = line.split('\t')
    if len(parts) >= 2:
        users.append({
            'id': int(parts[0]),
            'full_name': parts[1].strip(),
            'email': parts[2].strip() if len(parts) > 2 else '',
            'role': parts[3].strip() if len(parts) > 3 else '',
            'department': parts[4].strip() if len(parts) > 4 else ''
        })
print(f"Loaded {len(users)} users from database.")

def match_user(name_or_str, default_id=None):
    if not name_or_str: return default_id, None
    clean_name, _ = clean_user_str(name_or_str)
    t = clean_name.lower().strip()
    if not t: return default_id, None
    # 1. Exact match
    for u in users:
        fn = u['full_name'].lower().strip()
        if fn == t:
            return u['id'], u
    # 2. Substring match
    for u in users:
        fn = u['full_name'].lower().strip()
        if fn in t or t in fn:
            return u['id'], u
    return default_id, None

def match_user_ids(text):
    if not text: return ""
    matched = []
    items = re.split(r'[,;\n\r]+', str(text))
    for it in items:
        it_clean, _ = clean_user_str(it)
        uid, _ = match_user(it_clean)
        if uid and uid not in matched:
            matched.append(uid)
    return ",".join(str(i) for i in matched)

# 2. Load cached remote attachments map
remote_attach_file = 'scratch/remote_misa_attachments.json'
remote_attachments = {}
if os.path.exists(remote_attach_file):
    with open(remote_attach_file, 'r', encoding='utf-8') as f:
        remote_attachments = json.load(f)
    print(f"Loaded {len(remote_attachments)} runs with remote attachments.")
else:
    print("Warning: remote_misa_attachments.json not found, proceeding with empty map.")

# 3. Load all DB expenses to map
print("Loading existing expenses from DB...")
out_exp, _ = run_remote_sql("SELECT id, title, notes, amount, status FROM expenses;")
exp_by_misa = {} # (wf_name_clean, misa_id) -> exp_id
lines_exp = out_exp.strip().split('\n')[1:]
for l in lines_exp:
    parts = l.split('\t')
    if len(parts) >= 2:
        eid = int(parts[0])
        etitle = parts[1]
        enotes = parts[2] if len(parts) > 2 else ''
        
        m_id = None
        m1 = re.search(r'\[MISA #(\d+)\]', etitle)
        if m1: m_id = int(m1.group(1))
        else:
            m2 = re.search(r'\[Từ MISA AMIS #(\d+)\]', enotes)
            if m2: m_id = int(m2.group(1))
            
        mw = re.search(r'Quy trình:\s*([^\r\n\\]+)', enotes)
        if m_id and mw:
            wf_clean = mw.group(1).strip()
            exp_by_misa[(wf_clean.lower(), m_id)] = eid
            exp_by_misa[m_id] = eid # fallback by ID only

print(f"Loaded {len(lines_exp)} expenses, mapped {len(exp_by_misa)} MISA keys.")

# 4. Process all 26 MISA Workflows from Excel
print("\n--- STANDARDIZING ALL 26 MISA WORKFLOWS ---")
workflow_updates = []

for zp in ZIP_PATHS:
    z = zipfile.ZipFile(zp)
    for name in z.namelist():
        if 'Quy trình/XuatKhauLuotChay' in name and name.endswith('.zip'):
            data = z.read(name)
            iz = zipfile.ZipFile(io.BytesIO(data))
            for f in iz.namelist():
                if f.endswith('.xlsx'):
                    parts = f.split('/')
                    if len(parts) >= 2 and parts[-1].replace('.xlsx','').strip() == parts[0].strip():
                        wf_name = parts[0].strip()
                        wb = openpyxl.load_workbook(io.BytesIO(iz.read(f)), data_only=True)
                        
                        for sname in wb.sheetnames:
                            ws = wb[sname]
                            if ws.max_row <= 6: continue
                            
                            # Find columns
                            id_col = 1
                            title_col = 2
                            status_col = 3
                            creator_col = 4
                            created_col = 5
                            pending_col = 6
                            approver_col = 7
                            step_col = 8
                            time_col = 9
                            note_col = 10
                            stt_col = 26
                            item_name_col = 27
                            qty_col = 28
                            price_col = 29
                            amt_col = 30
                            vat_col = 31
                            vat_amt_col = 32
                            total_col = 33
                            
                            for r in range(1, min(10, ws.max_row + 1)):
                                for c in range(1, min(40, ws.max_column + 1)):
                                    val = str(ws.cell(r, c).value or '').strip()
                                    if val == 'ID': id_col = c
                                    elif val == 'Tiêu đề': title_col = c
                                    elif val == 'Trạng thái': status_col = c
                                    elif 'Người tạo' in val: creator_col = c
                                    elif 'Ngày tạo' in val: created_col = c
                                    elif 'Người cần thực hiện' in val: pending_col = c
                                    elif 'Người thực hiện' in val or 'Người đã thực hiện' in val: approver_col = c
                                    elif val == 'Bước': step_col = c
                                    elif 'Thời gian' in val: time_col = c
                                    elif 'Ghi chú' in val or 'Lý do' in val: note_col = c
                                    elif val == 'STT': stt_col = c
                                    elif 'Tên' in val or 'Nội dung' in val:
                                        if c > 20: item_name_col = c
                            
                            # Collect runs
                            curr_r = 7
                            while curr_r <= ws.max_row:
                                val_id = ws.cell(curr_r, id_col).value
                                if val_id is not None and str(val_id).strip() and str(val_id).strip().isdigit():
                                    misa_id = int(str(val_id).strip())
                                    run_rows = [curr_r]
                                    next_r = curr_r + 1
                                    while next_r <= ws.max_row and ws.cell(next_r, id_col).value is None:
                                        # Stop if row is completely empty
                                        if any(ws.cell(next_r, col).value is not None for col in (approver_col, step_col, stt_col, item_name_col)):
                                            run_rows.append(next_r)
                                        next_r += 1
                                    curr_r = next_r
                                    
                                    # Process this run
                                    r0 = run_rows[0]
                                    run_title = ws.cell(r0, title_col).value or f"{wf_name} #{misa_id}"
                                    raw_status = str(ws.cell(r0, status_col).value or '').strip()
                                    creator_str = ws.cell(r0, creator_col).value
                                    created_at = parse_date(ws.cell(r0, created_col).value)
                                    pending_str = ws.cell(r0, pending_col).value
                                    
                                    creator_name, creator_title = clean_user_str(creator_str)
                                    creator_id, _ = match_user(creator_name)
                                    
                                    # Status normalization
                                    if raw_status in ('Hoàn thành', 'Đã duyệt', 'approved'):
                                        final_status = 'approved'
                                    elif raw_status in ('Hủy bỏ', 'Từ chối', 'rejected'):
                                        final_status = 'rejected'
                                    else:
                                        final_status = 'pending'
                                        
                                    steps = []
                                    # Step 1: Creator
                                    steps.append({
                                        "user_name": creator_name,
                                        "actor": creator_name,
                                        "user_id": creator_id,
                                        "role": creator_title or "Người đề xuất",
                                        "title": ws.cell(r0, step_col).value or f"Lập đề nghị ({wf_name})",
                                        "step_name": ws.cell(r0, step_col).value or f"Lập đề nghị ({wf_name})",
                                        "status": "approved",
                                        "time": created_at,
                                        "notes": str(ws.cell(r0, note_col).value or '').strip()
                                    })
                                    
                                    # Subsequent approval steps
                                    approver_ids = []
                                    final_approved_time = None
                                    for r in run_rows:
                                        app_str = ws.cell(r, approver_col).value
                                        step_name = ws.cell(r, step_col).value
                                        step_time = parse_date(ws.cell(r, time_col).value)
                                        step_note = str(ws.cell(r, note_col).value or '').strip()
                                        
                                        if app_str and step_name and r != r0:
                                            a_name, a_title = clean_user_str(app_str)
                                            # Avoid creator placeholder on approval step
                                            if a_name == creator_name and any(kw in str(step_name).lower() for kw in ('duyệt', 'phê duyệt', 'kiểm tra', 'kế toán')):
                                                continue
                                            a_id, _ = match_user(a_name)
                                            if a_id and a_id not in approver_ids:
                                                approver_ids.append(a_id)
                                                
                                            st_status = "approved" if final_status == 'approved' or r < run_rows[-1] else ("rejected" if final_status == 'rejected' else "approved")
                                            steps.append({
                                                "user_name": a_name,
                                                "actor": a_name,
                                                "user_id": a_id,
                                                "role": a_title or "Người duyệt",
                                                "title": step_name,
                                                "step_name": step_name,
                                                "status": st_status,
                                                "time": step_time,
                                                "notes": step_note
                                            })
                                            if step_time:
                                                final_approved_time = step_time
                                                
                                    # Pending step if pending
                                    if final_status == 'pending' and pending_str:
                                        p_name, p_title = clean_user_str(pending_str)
                                        p_id, _ = match_user(p_name)
                                        steps.append({
                                            "user_name": p_name,
                                            "actor": p_name,
                                            "user_id": p_id,
                                            "role": p_title or "Người xử lý",
                                            "title": "Chờ duyệt / xử lý",
                                            "step_name": "Chờ duyệt / xử lý",
                                            "status": "pending",
                                            "time": None,
                                            "notes": ""
                                        })
                                        
                                    # Line items
                                    items = []
                                    for r in run_rows:
                                        stt = ws.cell(r, stt_col).value if stt_col else None
                                        item_name = ws.cell(r, item_name_col).value if item_name_col else None
                                        if item_name and str(stt).lower() != 'tổng':
                                            qty = parse_num(ws.cell(r, qty_col).value) if qty_col else 1.0
                                            unit_price = parse_num(ws.cell(r, price_col).value) if price_col else 0.0
                                            amt = parse_num(ws.cell(r, amt_col).value) if amt_col else 0.0
                                            vat = parse_num(ws.cell(r, vat_col).value) if vat_col else 0.0
                                            vat_amt = parse_num(ws.cell(r, vat_amt_col).value) if vat_amt_col else 0.0
                                            tot = parse_num(ws.cell(r, total_col).value) if total_col else (amt or (qty * unit_price))
                                            items.append({
                                                "stt": len(items) + 1,
                                                "name": str(item_name).strip(),
                                                "quantity": qty or 1.0,
                                                "unit_price": unit_price,
                                                "amount": amt or tot,
                                                "vat": vat,
                                                "vat_amount": vat_amt,
                                                "total": tot
                                            })
                                            
                                    calc_amount = sum(it['total'] or it['amount'] for it in items)
                                    
                                    # Attachments
                                    key_att = f"{wf_name}:{misa_id}"
                                    att_files = remote_attachments.get(key_att, [])
                                    first_image_url = None
                                    for af in att_files:
                                        if re.search(r'\.(png|jpe?g|webp|gif|bmp)$', af['name'], re.I):
                                            first_image_url = af['url']
                                            break
                                    if not first_image_url and att_files:
                                        first_image_url = att_files[0]['url']
                                        
                                    # Find matching expense row in DB
                                    eid = exp_by_misa.get((wf_name.lower(), misa_id)) or exp_by_misa.get(misa_id)
                                    if eid:
                                        workflow_updates.append({
                                            'id': eid,
                                            'misa_id': misa_id,
                                            'wf_name': wf_name,
                                            'title': run_title,
                                            'status': final_status,
                                            'steps': steps,
                                            'items': items,
                                            'amount': calc_amount,
                                            'files': att_files,
                                            'image_url': first_image_url,
                                            'approver_ids': approver_ids,
                                            'approved_at': final_approved_time if final_status == 'approved' else None,
                                            'created_at': created_at
                                        })
                                else:
                                    curr_r += 1

print(f"Generated standardized updates for {len(workflow_updates)} MISA workflow records!")

# Batch update expenses in DB
print("Updating expenses in database...")
batch_size = 50
total_batches = (len(workflow_updates) + batch_size - 1) // batch_size

for b_idx in range(total_batches):
    batch = workflow_updates[b_idx * batch_size : (b_idx + 1) * batch_size]
    sql_parts = []
    
    for item in batch:
        eid = item['id']
        mid = item['misa_id']
        wf = item['wf_name']
        steps_json = json.dumps(item['steps'], ensure_ascii=False)
        items_json = json.dumps(item['items'], ensure_ascii=False) if item['items'] else ""
        
        # Build clean formatted notes text
        notes_lines = [
            f"[Từ MISA AMIS #{mid}]: {item['title']}",
            f"Quy trình: {wf}"
        ]
        
        # Line items text
        if item['items']:
            notes_lines.append("\n[Bảng chi tiết thanh toán]:")
            for it in item['items']:
                notes_lines.append(f"{it['stt']}. {it['name']} (SL: {it['quantity']:g} x {it['unit_price']:,.0f} đ = {it['amount']:,.0f} đ)".replace(',', '.'))
            tot_val = sum(it['amount'] for it in item['items'])
            notes_lines.append(f"Tổng cộng: {tot_val:,.0f} đ".replace(',', '.'))
            notes_lines.append(f"\n[JSON_ITEMS]: {items_json}")
            
        # Approval steps JSON
        notes_lines.append(f"\n[APPROVAL_STEPS]: {steps_json}")
        
        # Attachments text
        if item['files']:
            notes_lines.append(f"\n[Tài liệu đính kèm ({len(item['files'])} tệp)]:")
            for af in item['files']:
                notes_lines.append(f"• {af['name']} ({af['url']})")
                
        final_notes = "\n".join(notes_lines)
        
        # Determine approver IDs & level statuses
        apps = item['approver_ids']
        app1 = apps[0] if len(apps) > 0 else 'NULL'
        app2 = apps[1] if len(apps) > 1 else 'NULL'
        app3 = apps[2] if len(apps) > 2 else 'NULL'
        
        st = item['status']
        if st == 'approved':
            s1 = 'approved'
            s2 = 'approved' if app2 != 'NULL' else 'not_reached'
            s3 = 'approved' if app3 != 'NULL' else 'not_reached'
            approved_by = apps[-1] if apps else 'NULL'
        elif st == 'rejected':
            s1 = 'rejected'
            s2 = 'not_reached'
            s3 = 'not_reached'
            approved_by = 'NULL'
        else:
            s1 = 'approved' if len(apps) > 0 else 'pending'
            s2 = 'pending' if app2 != 'NULL' else 'not_reached'
            s3 = 'not_reached'
            approved_by = 'NULL'
            
        amt_clause = f", amount = {item['amount']}" if item['amount'] > 0 else ""
        img_clause = f", image_url = {escape_sql(item['image_url'])}" if item['image_url'] else ""
        app_time_clause = f", approved_at = {escape_sql(item['approved_at'])}" if item['approved_at'] else ""
        
        sql = f"""
        UPDATE expenses 
        SET notes = {escape_sql(final_notes)},
            status = '{st}',
            approval_status = '{st}',
            approver_id = {app1},
            approver_id_2 = {app2},
            approver_id_3 = {app3},
            status_level_1 = '{s1}',
            status_level_2 = '{s2}',
            status_level_3 = '{s3}',
            approved_by = {approved_by}
            {amt_clause}
            {img_clause}
            {app_time_clause}
        WHERE id = {eid};
        """
        sql_parts.append(sql.strip())
        
    combined_sql = "\n".join(sql_parts)
    run_remote_sql(combined_sql)
    print(f"  -> Batch {b_idx + 1}/{total_batches} ({len(batch)} records) updated.")

print("All MISA workflows updated successfully!")

# 5. Tasks Migration & Cleanup
print("\n--- STANDARDIZING TASKS (ACTIVITIES) ---")
print("1. Deleting old tasks before 01/08/2026 and previous MISA tasks for clean re-sync...")
del_sql = """
DELETE FROM activity_comments 
WHERE activity_id IN (
    SELECT id FROM activities WHERE type = 'task' AND (tags LIKE '%misa%' OR created_at < '2026-08-01')
);
DELETE FROM activities 
WHERE type = 'task' AND (tags LIKE '%misa%' OR created_at < '2026-08-01');
"""
run_remote_sql(del_sql)

out_count, _ = run_remote_sql("SELECT COUNT(*) FROM activities WHERE type = 'task';")
print("Native MYERP tasks preserved in activities:", out_count.strip().split('\n')[-1])

print("\n2. Scanning and synchronizing tasks on/after 01/08/2026...")
z1 = zipfile.ZipFile(r"D:\Downloads\MISA-20260913T054357Z-1-001.zip")
task_excels = [f for f in z1.namelist() if f.endswith('.xlsx') and 'Công việc' in f]

# Scan project doc files on server
cmd_task_files = 'find "myerp.ideas.edu.vn/backend/uploads/misa_attachments/tasks" -type f'
p_tf = subprocess.Popen(SSH_CMD + [cmd_task_files], stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
out_tf, _ = p_tf.communicate()
server_task_files = [l.strip() for l in out_tf.strip().split('\n') if l.strip()]
print(f"Indexed {len(server_task_files)} task attachment files on server.")

cutoff = datetime(2026, 8, 1)
total_tasks_processed = 0

for te in task_excels:
    fname = te.split('/')[-1]
    wb = openpyxl.load_workbook(io.BytesIO(z1.read(te)), data_only=True)
    ws = wb.active
    
    # Header columns
    c_stt = 1
    c_name = 2
    c_parent = 3
    c_desc = 5
    c_group = 6
    c_status = 7
    c_due = 8
    c_start = 9
    c_created = 10
    c_assignee = 11
    c_priority = 13
    c_followers = 14
    c_creator = 15
    c_progress = 17
    
    for r in range(1, 10):
        for c in range(1, ws.max_column + 1):
            val = str(ws.cell(r, c).value or '').strip()
            if val == 'STT': c_stt = c
            elif val == 'Tên công việc': c_name = c
            elif val == 'Tên công việc cha': c_parent = c
            elif val == 'Mô tả': c_desc = c
            elif val == 'Nhóm công việc': c_group = c
            elif val == 'Trạng thái công việc': c_status = c
            elif val == 'Hạn hoàn thành': c_due = c
            elif val == 'Ngày bắt đầu': c_start = c
            elif val == 'Ngày tạo': c_created = c
            elif val == 'Người thực hiện': c_assignee = c
            elif val == 'Người liên quan': c_followers = c
            elif val == 'Người tạo công việc': c_creator = c
            elif val == 'Mức độ quan trọng': c_priority = c
            elif val == 'Tiến độ công việc': c_progress = c

    # Read rows
    current_root_task = None
    root_tasks = []
    
    for r in range(7, ws.max_row + 1):
        name = ws.cell(r, c_name).value
        if not name: continue
        name_clean = str(name).strip()
        stt = str(ws.cell(r, c_stt).value or '').strip()
        
        dt_created = parse_date(ws.cell(r, c_created).value) if c_created else None
        dt_due = parse_date(ws.cell(r, c_due).value) if c_due else None
        dt_start = parse_date(ws.cell(r, c_start).value) if c_start else None
        
        # Check cutoff
        is_post = False
        for dt_val in (dt_created, dt_due):
            if dt_val:
                try:
                    d = datetime.strptime(dt_val, '%Y-%m-%d %H:%M:%S')
                    if d >= cutoff:
                        is_post = True
                        break
                except: pass
                
        if not is_post: continue
        
        # Determine if subtask (has decimal in STT e.g. 2.1 or starts with spaces or has parent name)
        is_subtask = ('.' in stt) or name_clean.startswith('    ') or bool(ws.cell(r, c_parent).value)
        
        assignee_str = str(ws.cell(r, c_assignee).value or '').strip()
        creator_str = str(ws.cell(r, c_creator).value or '').strip()
        followers_str = str(ws.cell(r, c_followers).value or '').strip()
        
        assignee_id, _ = match_user(assignee_str, 100067)
        creator_id, _ = match_user(creator_str, 100067)
        follower_ids = match_user_ids(followers_str)
        
        desc = str(ws.cell(r, c_desc).value or '').strip()
        status_str = str(ws.cell(r, c_status).value or '').strip().lower()
        is_done = ('hoàn thành' in status_str or 'đã đóng' in status_str)
        priority_val = 'high' if 'cao' in str(ws.cell(r, c_priority).value or '').lower() else 'medium'
        progress_val = int(parse_num(ws.cell(r, c_progress).value)) if c_progress else (100 if is_done else 0)
        
        if is_subtask and current_root_task:
            # Append to current root checklist
            current_root_task['checklist'].append({
                "id": f"sub_{stt.replace('.','_')}_{r}",
                "title": name_clean,
                "text": name_clean,
                "checked": is_done,
                "done": is_done,
                "due_date": dt_due,
                "assignee_id": assignee_id,
                "notified_sla": True
            })
        else:
            # Root task
            current_root_task = {
                "stt": stt,
                "subject": name_clean,
                "description": desc,
                "user_id": assignee_id,
                "created_by": creator_id,
                "participant_ids": follower_ids,
                "status": 'done' if is_done else 'planned',
                "priority": priority_val,
                "progress": progress_val,
                "start_date": dt_start,
                "due_date": dt_due,
                "created_at": dt_created,
                "group_name": str(ws.cell(r, c_group).value or '').strip(),
                "checklist": [],
                "links": []
            }
            root_tasks.append(current_root_task)
            
    # Match files for root tasks
    for rt in root_tasks:
        matched_links = []
        subj_lower = rt['subject'].lower()
        for fpath in server_task_files:
            fname_only = fpath.split('/')[-1]
            f_clean = fname_only.lower()
            # Match keywords
            words = [w for w in re.split(r'[\s\-_.,]+', subj_lower) if len(w) >= 4]
            match_score = sum(1 for w in words if w in f_clean)
            if match_score >= 2 or (len(words) == 1 and words[0] in f_clean):
                rel_url = fpath.replace('myerp.ideas.edu.vn', '')
                if not rel_url.startswith('/'): rel_url = '/' + rel_url
                matched_links.append({
                    "url": rel_url,
                    "label": fname_only,
                    "is_file": True
                })
        rt['links'] = matched_links[:5] # top 5 relevant files
        
        # Build JSON body
        body_json = {
            "erp_task": {
                "misa_stt": rt['stt'],
                "description": rt['description'],
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
        
        # Check if task already exists by subject
        check_subj_sql = f"SELECT id FROM activities WHERE type = 'task' AND subject = {escape_sql(rt['subject'])} LIMIT 1;"
        out_s, _ = run_remote_sql(check_subj_sql)
        existing_id = None
        for sl in out_s.strip().split('\n')[1:]:
            if sl.strip().isdigit():
                existing_id = int(sl.strip())
                break
                
        body_str = json.dumps(body_json, ensure_ascii=False)
        if existing_id:
            # Update
            upd_t_sql = f"""
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
                tags = 'misa_migrated,post_aug'
            WHERE id = {existing_id};
            """
            run_remote_sql(upd_t_sql)
        else:
            # Insert
            ins_t_sql = f"""
            INSERT INTO activities (
                tenant_id, user_id, created_by, type, subject, body, 
                status, priority, progress, start_date, due_date, tags, created_at
            ) VALUES (
                1, {rt['user_id']}, {rt['created_by']}, 'task', {escape_sql(rt['subject'])}, {escape_sql(body_str)},
                '{rt['status']}', '{rt['priority']}', {rt['progress']}, {escape_sql(rt['start_date'])}, {escape_sql(rt['due_date'])},
                'misa_migrated,post_aug', {escape_sql(rt['created_at'] or '2026-08-01 00:00:00')}
            );
            """
            run_remote_sql(ins_t_sql)
            
        total_tasks_processed += 1

print(f"Processed and synchronized {total_tasks_processed} root tasks with full subtasks & files!")
print("==========================================================")
print("STANDARDIZATION COMPLETE!")
print("==========================================================")
