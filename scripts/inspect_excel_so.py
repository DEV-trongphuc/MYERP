import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

files = {
    'Don_dat_hang': r'D:\Downloads\Don_dat_hang.xlsx',
    'Ban_hang': r'D:\Downloads\Ban_hang.xlsx',
    'Hop_dong': r'D:\Downloads\Hop_dong.xlsx'
}

for name, path in files.items():
    print(f"================== {name} ==================")
    xl = pd.ExcelFile(path)
    print("Sheets:", xl.sheet_names)
    df = pd.read_excel(path, nrows=5)
    print("Columns:", list(df.columns))
    print("Sample rows:")
    for idx, row in df.iterrows():
        print(dict(row.dropna()))
