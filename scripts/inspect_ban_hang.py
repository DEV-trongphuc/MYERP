import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)
print("Ban_hang shape:", df_bh.shape)
print("Ban_hang columns:", list(df_bh.columns))
print(df_bh.head(10))

# Check unique customers, unique SO / vouchers in Ban_hang
print("\nUnique customers in Ban_hang:", df_bh['Khách hàng'].nunique())
print("Unique vouchers in Ban_hang:", df_bh['Số chứng từ'].nunique())
print("Sample vouchers:", df_bh['Số chứng từ'].dropna().head(10).tolist())
