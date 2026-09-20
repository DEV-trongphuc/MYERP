import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df_ddh = pd.read_excel(r'D:\Downloads\Don_dat_hang.xlsx', header=2)
for name in ['BÙI DẠ VỸ', 'Dương Bình An', 'Vũ Văn Năm', 'LÊ HỒNG TÍN', 'HUYNH YEN THANH']:
    matches = df_ddh[df_ddh['Khách hàng'].str.contains(name, na=False, case=False)]
    print(f"DDH for {name}: {len(matches)}")
    if len(matches) > 0:
        print(matches[['Số đơn hàng', 'Khách hàng', 'Giá trị đơn hàng', 'Thực thu']])
