import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', skiprows=1)
print(f"Hop_dong total rows: {len(df_hd)}")
print("Hop_dong columns:", list(df_hd.columns))

# Search for Hùng, An, Nhu
for idx, r in df_hd.iterrows():
    cust = str(r.get('Khách hàng', ''))
    so = str(r.get('Số hợp đồng', ''))
    val = r.get('Giá trị hợp đồng', '')
    owner = str(r.get('Người thực hiện', ''))
    date = str(r.get('Ngày ký', ''))
    if any(k in cust.lower() for k in ['hùng', 'an', 'nhu', 'hồng']):
        print(f"HD: {so} | Cust: {cust} | Val: {val} | Owner: {owner} | Date: {date}")

print("\n--- Don_dat_hang ---")
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', skiprows=1)
print(f"Don_dat_hang total rows: {len(df_ddh)}")
for idx, r in df_ddh.iterrows():
    cust = str(r.get('Khách hàng', ''))
    so = str(r.get('Số đơn hàng', ''))
    val = r.get('Giá trị đơn hàng', '')
    if any(k in cust.lower() for k in ['hùng', 'an', 'nhu', 'hồng']):
        print(f"DDH: {so} | Cust: {cust} | Val: {val}")

print("\n--- Ban_hang ---")
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', skiprows=1)
print(f"Ban_hang total rows: {len(df_bh)}")
print("Ban_hang columns:", list(df_bh.columns))
for idx, r in df_bh.iterrows():
    cust = str(r.get('Khách hàng', ''))
    so = str(r.get('Số chứng từ', ''))
    val = r.get('Tổng tiền thanh toán', '')
    if any(k in cust.lower() for k in ['hùng', 'an', 'nhu', 'hồng']):
        print(f"BH: {so} | Cust: {cust} | Val: {val}")
