import subprocess, sys, json

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

print("==========================================================")
print("STANDARDIZING ALL MISA SUBTASK ASSIGNEES IN DATABASE")
print("==========================================================")

# 1. Load users
out_u, _ = run_remote_sql("SELECT id, full_name, email FROM users;")
users_map = {}
for line in out_u.strip().split('\n')[1:]:
    p = line.split('\t')
    if len(p) >= 2:
        uid = int(p[0])
        name = p[1].strip()
        email = p[2].strip() if len(p) > 2 else ''
        users_map[uid] = {'id': uid, 'full_name': name, 'email': email}

print(f"Loaded {len(users_map)} users from DB.")

# 2. Load all task activities
sql = "SELECT id, subject, user_id, created_by, body FROM activities WHERE type = 'task';\n"
out_act, _ = run_remote_sql(sql)

updated_tasks = []
total_subtasks_fixed = 0

for line in out_act.strip().split('\n')[1:]:
    parts = line.split('\t')
    if len(parts) >= 5:
        try:
            tid = int(parts[0])
        except:
            continue
        subj = parts[1]
        raw_uid = int(parts[2]) if parts[2] and parts[2] != 'NULL' else None
        raw_cby = int(parts[3]) if parts[3] and parts[3] != 'NULL' else None
        body_raw = parts[4]

        # Determine true task owner
        task_owner_id = raw_uid or raw_cby or 100073
        task_owner_name = users_map.get(task_owner_id, {}).get('full_name', '')

        try:
            body_json = json.loads(body_raw)
            is_erp = 'erp_task' in body_json
            chk_list = body_json.get('erp_task', {}).get('checklist', []) if is_erp else body_json.get('checklist', [])
            
            if not chk_list or not isinstance(chk_list, list):
                continue
                
            task_modified = False
            for item in chk_list:
                cur_assignee = item.get('assignee_id')
                cur_name = item.get('assignee_name', '')
                
                needs_fix = False
                if cur_assignee == 100062 and task_owner_id != 100062:
                    # If assignee_name doesn't explicitly contain 'Mai Thị Nữ'
                    if not cur_name or 'Mai Thị Nữ' not in cur_name:
                        needs_fix = True
                elif not cur_assignee:
                    needs_fix = True

                if needs_fix:
                    item['assignee_id'] = task_owner_id
                    item['assignee_name'] = task_owner_name
                    task_modified = True
                    total_subtasks_fixed += 1

            if task_modified:
                new_body_str = json.dumps(body_json, ensure_ascii=False)
                updated_tasks.append((tid, subj, task_owner_id, task_owner_name, new_body_str))

        except Exception as e:
            pass

print(f"\nProcessing {len(updated_tasks)} tasks with {total_subtasks_fixed} subtasks to update...")

# 3. Apply updates in batches of 50
batch_size = 50
for i in range(0, len(updated_tasks), batch_size):
    batch = updated_tasks[i:i + batch_size]
    sql_updates = []
    for tid, subj, toid, toname, new_body in batch:
        sql_updates.append(f"UPDATE activities SET body = {escape_sql(new_body)} WHERE id = {tid};")
    
    batch_sql = "\n".join(sql_updates)
    out_res, err_res = run_remote_sql(batch_sql)
    if err_res and 'error' in err_res.lower():
        print(f"Error in batch {i//batch_size + 1}: {err_res}")
    else:
        print(f"Batch {i//batch_size + 1}/{(len(updated_tasks) + batch_size - 1)//batch_size} ({len(batch)} tasks) updated successfully!")

print("\n==========================================================")
print(f"SUCCESS: Standardized {len(updated_tasks)} tasks and {total_subtasks_fixed} subtasks!")
print("==========================================================")
