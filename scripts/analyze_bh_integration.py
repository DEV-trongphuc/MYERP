import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import unicodedata

df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2).dropna(subset=['Số hợp đồng', 'Khách hàng'])
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2).dropna(subset=['Số đơn hàng', 'Khách hàng'])
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2).dropna(subset=['Số chứng từ', 'Khách hàng'])

def norm(s):
    return unicodedata.normalize('NFC', str(s).lower().strip())

hd_custs = {norm(c) for c in df_hd['Khách hàng']}
ddh_custs = {norm(c) for c in df_ddh['Khách hàng']}
all_existing_custs = hd_custs.union(ddh_custs)

print("BH total rows:", len(df_bh))
bh_in_hd = []
bh_new = []

for idx, r in df_bh.iterrows():
    cust = r['Khách hàng']
    nc = norm(cust)
    doc_no = r['Số chứng từ']
    val = r['Tổng tiền thanh toán']
    paid_status = r['TT thanh toán']
    date = r['Ngày hạch toán']
    
    if nc in all_existing_custs:
        bh_in_hd.append((doc_no, cust, val, paid_status, date))
    else:
        bh_new.append((doc_no, cust, val, paid_status, date))

print(f"BH rows matching existing contract customers: {len(bh_in_hd)}")
print(f"BH rows of NEW customers: {len(bh_new)}")

# Group new customers by customer name
from collections import defaultdict
new_by_cust = defaultdict(list)
for item in bh_new:
    new_by_cust[norm(item[1])].append(item)

print(f"Total unique NEW customers in Ban_hang: {len(new_by_cust)}")
for cnorm, items in list(new_by_cust.items())[:15]:
    total_val = sum(x[2] for x in items)
    print(f"Customer '{items[0][1]}': {len(items)} vouchers, total: {total_val:,.0f} đ, sample: {[x[0] for x in items]}")
