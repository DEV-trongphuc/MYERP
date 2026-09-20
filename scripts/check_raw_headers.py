import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

for name, path in [('Hop_dong', r'D:\Downloads\Hop_dong.xlsx'), ('Don_dat_hang', r'D:\Downloads\Don_dat_hang.xlsx'), ('Ban_hang', r'D:\Downloads\Ban_hang.xlsx')]:
    print(f"=== {name} RAW FIRST 3 ROWS ===")
    df = pd.read_excel(path, header=None, nrows=3)
    for i, r in df.iterrows():
        print(f"Row {i}: {list(r.values)}")
