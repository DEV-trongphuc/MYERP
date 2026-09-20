import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)
print("Ban_hang columns:", list(df_bh.columns))
for i in range(10):
    row = df_bh.iloc[i].dropna().to_dict()
    print(f"Row {i}: {row}")

# Check if there are other sheets or hidden columns
xl = pd.ExcelFile(r'D:\Downloads\Ban_hang.xlsx')
for sheet in xl.sheet_names:
    print("Sheet:", sheet)
    df_s = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', sheet_name=sheet)
    print("Shape:", df_s.shape)
