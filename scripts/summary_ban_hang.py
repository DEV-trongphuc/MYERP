import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df_bh = pd.read_excel(r'D:\Downloads\Ban_hang.xlsx', header=2)
print("TT thanh toán value counts:")
print(df_bh['TT thanh toán'].value_counts(dropna=False))
print("TT lập hóa đơn value counts:")
print(df_bh['TT lập hóa đơn'].value_counts(dropna=False))
print("Total sum of Tổng tiền thanh toán:", df_bh['Tổng tiền thanh toán'].sum())
print("Date min and max:", df_bh['Ngày hạch toán'].min(), df_bh['Ngày hạch toán'].max())
