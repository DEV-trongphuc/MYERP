import openpyxl
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

def inspect_file(path, search_term=None):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    wb = openpyxl.load_workbook(path, data_only=True)
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        print(f"\n--- Sheet: {sheet} (rows: {ws.max_row}, cols: {ws.max_column}) in {os.path.basename(path)} ---")
        # print first 10 rows
        for r in range(1, min(12, ws.max_row + 1)):
            row_vals = [str(ws.cell(r, c).value) if ws.cell(r, c).value is not None else '' for c in range(1, min(25, ws.max_column + 1))]
            if any(row_vals):
                print(f"Row {r}: {row_vals[:15]}")
        
        if search_term:
            found = 0
            for r in range(1, ws.max_row + 1):
                row_vals = [str(ws.cell(r, c).value or '') for c in range(1, ws.max_column + 1)]
                if any(search_term.lower() in v.lower() for v in row_vals):
                    print(f"Found '{search_term}' at Row {r}: {row_vals[:15]}")
                    found += 1
                    if found > 10: break

inspect_file(r"D:\Downloads\misa_extracted\MISA\Amis KT\Bán hàng\Don_dat_hang.xlsx")
inspect_file(r"D:\Downloads\misa_extracted\MISA\Amis KT\Tiền gửi\Danh_sach_de_nghi_chi_tien.xlsx", "777")
inspect_file(r"D:\Downloads\misa_extracted\MISA\Amis KT\Tiền gửi\Danh_sach_de_nghi_chi_tien.xlsx", "Thụy Sĩ")
inspect_file(r"D:\Downloads\misa_extracted\MISA\Kế toán\Khác\Danh_sach_loai_tien.xlsx")
