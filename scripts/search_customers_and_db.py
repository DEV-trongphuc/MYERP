import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import json
import pymysql

# 1. Inspect Excel rows
df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2)
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2)
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)

print("Hop_dong count:", len(df_hd))
print("Don_dat_hang count:", len(df_ddh))
print("Ban_hang count:", len(df_bh))

print("\n=== Search for Hùng, An, Nhu in Hop_dong ===")
for idx, r in df_hd.iterrows():
    cust = str(r.get('Khách hàng', ''))
    so = str(r.get('Số hợp đồng', ''))
    val = r.get('Giá trị hợp đồng', '')
    owner = str(r.get('Người thực hiện', ''))
    if any(k == cust.strip().lower() or cust.strip().lower().endswith(' ' + k) for k in ['hùng', 'an', 'nhu', 'hồng']):
        print(f"HD: {so} | Cust: '{cust}' | Val: {val} | Owner: {owner}")

print("\n=== Search for Hùng, An, Nhu in Don_dat_hang ===")
for idx, r in df_ddh.iterrows():
    cust = str(r.get('Khách hàng', ''))
    so = str(r.get('Số đơn hàng', ''))
    val = r.get('Giá trị đơn hàng', '')
    if cust.strip().lower() in ['hùng', 'an', 'nhu', 'hồng', 'hung']:
        print(f"DDH: {so} | Cust: '{cust}' | Val: {val}")

print("\n=== Search for Hùng, An, Nhu in Ban_hang ===")
for idx, r in df_bh.iterrows():
    cust = str(r.get('Khách hàng', ''))
    so = str(r.get('Số chứng từ', ''))
    val = r.get('Tổng tiền thanh toán', '')
    if cust.strip().lower() in ['hùng', 'an', 'nhu', 'hồng', 'hung']:
        print(f"BH: {so} | Cust: '{cust}' | Val: {val}")

# Connect to DB to check users and deposits schema
with open('backend/config.php', 'r', encoding='utf-8') as f:
    text = f.read()
import re
db_host = re.search(r"'DB_HOST',\s*'([^']+)'", text).group(1)
db_user = re.search(r"'DB_USER',\s*'([^']+)'", text).group(1)
db_pass = re.search(r"'DB_PASS',\s*'([^']+)'", text).group(1)
db_name = re.search(r"'DB_NAME',\s*'([^']+)'", text).group(1)
db_port = int(re.search(r"'DB_PORT',\s*(\d+)", text).group(1) if re.search(r"'DB_PORT',\s*(\d+)", text) else 3306)

conn = pymysql.connect(host=db_host, user=db_user, password=db_pass, database=db_name, port=db_port, charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)
with conn.cursor() as cur:
    # 2. Find Nguyễn Thu Thảo
    cur.execute("SELECT id, name, email, role, department FROM users WHERE name LIKE '%Thảo%' OR name LIKE '%Thao%'")
    users = cur.fetchall()
    print("\n=== Users matching Thảo ===")
    for u in users:
        print(u)

    # 3. Check deposits columns
    cur.execute("DESCRIBE deposits")
    cols = cur.fetchall()
    print("\n=== deposits columns ===")
    print([c['Field'] for c in cols])

    # 4. Check current deposits where customer is Hùng, An, Nhu
    cur.execute("SELECT id, contact_id, customer_name, unit_code, total_amount, expected_pay_date, sale_person_id, participant_ids FROM deposits WHERE customer_name IN ('Hùng', 'An', 'Nhu', 'Hồng', 'Huỳnh Thanh Hùng')")
    deps = cur.fetchall()
    print("\n=== Current deposits matching Hùng, An, Nhu ===")
    for d in deps:
        print(d)

conn.close()
