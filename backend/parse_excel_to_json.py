# backend/parse_excel_to_json.py
import os
import json
import re
import pandas as pd

filepath = r"D:\Downloads\Copy of DANH SÁCH HỌC VIÊN TỔNG_Update06.03.26.xlsx"
output_path = r"backend/normalized_students.json"

if not os.path.exists(filepath):
    print(f"Error: Excel file not found at {filepath}")
    exit(1)

def normalize_phone(phone_str):
    if pd.isna(phone_str):
        return None
    val = str(phone_str).strip()
    # Strip dots, spaces, dashes, parentheses
    val = re.sub(r'[\s\.\-\(\)]', '', val)
    if not val:
        return None
    
    # Strip +84 or 84 prefix
    if val.startswith('+84'):
        val = val[3:]
    elif val.startswith('84') and len(val) > 9:
        val = val[2:]
        
    return val

def normalize_email(email_str):
    if pd.isna(email_str):
        return None
    val = str(email_str).strip().lower()
    if not val:
        return None
    return val

def normalize_gender(gender_str):
    if pd.isna(gender_str):
        return None
    val = str(gender_str).strip().lower()
    if val in ['f', 'female', 'ms.', 'nữ', 'nu']:
        return "Nữ"
    if val in ['m', 'male', 'mr.', 'nam']:
        return "Nam"
    return None

def normalize_dob(dob_val):
    if pd.isna(dob_val):
        return None
    val = str(dob_val).strip()
    if not val:
        return None
        
    # If year only (e.g. 1974)
    if re.match(r'^\d{4}$', val) or re.match(r'^\d{4}\.0$', val):
        year = val.split('.')[0]
        return f"{year}-01-01"
        
    # Convert dots to dashes (e.g. 18.06.1989 -> 1989-06-18)
    if '.' in val:
        parts = val.split('.')
        if len(parts) == 3:
            # Check if DD.MM.YYYY
            if len(parts[0]) <= 2 and len(parts[1]) <= 2 and len(parts[2]) == 4:
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            # Check if YYYY.MM.DD
            elif len(parts[0]) == 4 and len(parts[1]) <= 2 and len(parts[2]) <= 2:
                return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                
    # Parse DD/MM/YYYY
    if '/' in val:
        parts = val.split('/')
        if len(parts) == 3:
            if len(parts[0]) <= 2 and len(parts[1]) <= 2 and len(parts[2]) == 4:
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                
    # Standard datetime format (e.g. 1993-08-08 00:00:00)
    if '-' in val:
        # Extract date part
        date_part = val.split(' ')[0]
        parts = date_part.split('-')
        if len(parts) == 3 and len(parts[0]) == 4:
            return date_part
            
    return val

def get_school_name(sheet_name):
    parts = sheet_name.split('_')
    if len(parts) > 1:
        school = parts[1].strip()
        if school.lower() == 'total ubis':
            return 'UBIS'
        return school.upper()
    return 'UNKNOWN'

def get_assigned_owner(tvv_name):
    if pd.isna(tvv_name) or not str(tvv_name).strip():
        return "Nữ"
    tvv_clean = str(tvv_name).strip().lower()
    if tvv_clean in ['phúc', 'phuc']:
        return "Phúc"
    elif tvv_clean in ['đan', 'dan']:
        return "Đan"
    elif tvv_clean in ['nhi']:
        return "Nhi"
    else:
        return "Nữ"

excel_file = pd.ExcelFile(filepath)
all_students = []

for sheet in excel_file.sheet_names:
    school = get_school_name(sheet)
    print(f"Parsing sheet: {sheet} -> School: {school}")
    df = pd.read_excel(filepath, sheet_name=sheet)
    
    # Locate headers row (row 0 is header row)
    headers = [str(x).strip() for x in df.iloc[0]]
    df.columns = headers
    df = df.iloc[1:].reset_index(drop=True)
    
    # Map column headers to find relevant indices
    col_map = {}
    for col in df.columns:
        col_lower = str(col).lower()
        if ('name' in col_lower or 'tên' in col_lower) and 'công ty' not in col_lower and 'company' not in col_lower:
            col_map['name'] = col
        elif 'gender' in col_lower or 'tính' in col_lower:
            col_map['gender'] = col
        elif 'birth' in col_lower or 'sinh' in col_lower or 'dob' in col_lower:
            col_map['dob'] = col
        elif 'phone' in col_lower or 'điện thoại' in col_lower:
            col_map['phone'] = col
        elif 'email' in col_lower or 'thư điện tử' in col_lower:
            col_map['email'] = col
        elif 'chức vụ' in col_lower:
            col_map['job_title'] = col
        elif 'công ty' in col_lower:
            col_map['company'] = col
        elif 'ngành' in col_lower or 'nsi' in col_lower:
            col_map['industry'] = col
        elif 'tvv' in col_lower:
            col_map['tvv'] = col
        elif 'intake' in col_lower and 'đang học' not in col_lower:
            col_map['intake'] = col
        elif col_lower == 'id':
            col_map['student_id'] = col
        elif 'loại bằng' in col_lower:
            col_map['degree_type'] = col
        elif 'đang học theo intake' in col_lower:
            col_map['current_intake_status'] = col
            
    # Process rows
    for index, row in df.iterrows():
        # Get raw name
        name_raw = row.get(col_map.get('name')) if 'name' in col_map else None
        if pd.isna(name_raw) or not str(name_raw).strip():
            continue
            
        full_name = " ".join(str(name_raw).split()) # clean double/extra spaces
        
        # Phone parsing & splitting
        phone_raw = row.get(col_map.get('phone')) if 'phone' in col_map else None
        phone1, phone2 = None, None
        if not pd.isna(phone_raw):
            phone_str = str(phone_raw).strip()
            # Split by comma, slash, or newline
            phone_parts = re.split(r'[/,\n\r]+', phone_str)
            phone1 = normalize_phone(phone_parts[0])
            if len(phone_parts) > 1:
                phone2 = normalize_phone(phone_parts[1])
                
        # Email parsing & splitting
        email_raw = row.get(col_map.get('email')) if 'email' in col_map else None
        email1, email2 = None, None
        if not pd.isna(email_raw):
            email_str = str(email_raw).strip()
            email_parts = re.split(r'[;,\n\r\s]+', email_str)
            email1 = normalize_email(email_parts[0])
            if len(email_parts) > 1:
                email2 = normalize_email(email_parts[1])
                
        gender = normalize_gender(row.get(col_map.get('gender'))) if 'gender' in col_map else None
        dob = normalize_dob(row.get(col_map.get('dob'))) if 'dob' in col_map else None
        job_title = str(row.get(col_map.get('job_title'))).strip() if 'job_title' in col_map and not pd.isna(row.get(col_map.get('job_title'))) else None
        company = str(row.get(col_map.get('company'))).strip() if 'company' in col_map and not pd.isna(row.get(col_map.get('company'))) else None
        industry = str(row.get(col_map.get('industry'))).strip() if 'industry' in col_map and not pd.isna(row.get(col_map.get('industry'))) else None
        tvv = str(row.get(col_map.get('tvv'))).strip() if 'tvv' in col_map and not pd.isna(row.get(col_map.get('tvv'))) else None
        intake = str(row.get(col_map.get('intake'))).strip() if 'intake' in col_map and not pd.isna(row.get(col_map.get('intake'))) else None
        student_id = str(row.get(col_map.get('student_id'))).strip() if 'student_id' in col_map and not pd.isna(row.get(col_map.get('student_id'))) else None
        degree_type = str(row.get(col_map.get('degree_type'))).strip() if 'degree_type' in col_map and not pd.isna(row.get(col_map.get('degree_type'))) else None
        current_intake_status = str(row.get(col_map.get('current_intake_status'))).strip() if 'current_intake_status' in col_map and not pd.isna(row.get(col_map.get('current_intake_status'))) else None
        
        owner_assigned = get_assigned_owner(tvv)
        
        all_students.append({
            'full_name': full_name,
            'gender': gender,
            'birthday': dob,
            'phone': phone1,
            'phone2': phone2,
            'email': email1,
            'email2': email2,
            'job_title': job_title,
            'company': company,
            'industry': industry,
            'school': school,
            'intake': intake,
            'student_id': student_id,
            'degree_type': degree_type,
            'current_intake_status': current_intake_status,
            'tvv_original': tvv,
            'owner_assigned': owner_assigned
        })

print(f"Total students parsed: {len(all_students)}")

# Save to JSON
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_students, f, ensure_ascii=False, indent=2)
    
print("Successfully generated normalized_students.json!")
