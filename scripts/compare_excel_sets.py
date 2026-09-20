import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df_hd = pd.read_excel(r'D:\Downloads\Hop_dong.xlsx', header=2)
df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2)
df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)

print("Customers in Hop_dong:", set(df_hd['Khách hàng'].dropna()))
print("\nCustomers in Ban_hang not in Hop_dong:")
bh_custs = set(df_bh['Khách hàng'].dropna())
hd_custs = set(df_hd['Khách hàng'].dropna())
ddh_custs = set(df_ddh['Khách hàng'].dropna())

print("BH cust count:", len(bh_custs))
print("HD cust count:", len(hd_custs))
print("DDH cust count:", len(ddh_custs))

print("In BH but not in HD:", bh_custs - hd_custs)
print("In BH but not in DDH:", bh_custs - ddh_custs)
print("In DDH but not in HD:", ddh_custs - hd_custs)
