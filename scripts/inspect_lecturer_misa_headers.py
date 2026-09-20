import zipfile
import io
import openpyxl
import sys
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

ZIP_PATHS = [
    r"D:\Downloads\MISA-20260913T054357Z-1-001.zip",
    r"D:\Downloads\MISA-20260913T054357Z-1-002.zip"
]

found = False
for zp in ZIP_PATHS:
    if found: break
    z = zipfile.ZipFile(zp)
    for name in z.namelist():
        if 'Quy trình/XuatKhauLuotChay' in name and name.endswith('.zip'):
            iz = zipfile.ZipFile(io.BytesIO(z.read(name)))
            for f in iz.namelist():
                if 'giảng viên' in f.lower() and f.endswith('.xlsx'):
                    print(f"Found lecturer file: {f}")
                    wb = openpyxl.load_workbook(io.BytesIO(iz.read(f)), data_only=True)
                    ws = wb.active
                    print(f"Sheet name: {ws.title}, max_row: {ws.max_row}, max_col: {ws.max_column}")
                    for r in range(1, 10):
                        row_vals = [f"Col {c}: {ws.cell(r, c).value}" for c in range(1, min(ws.max_column + 1, 35)) if ws.cell(r, c).value is not None]
                        if row_vals:
                            print(f"Row {r}: {row_vals[:15]}")
                    
                    # print first 3 data rows
                    for r in range(8, 12):
                        row_vals = [f"C{c}: {ws.cell(r, c).value}" for c in range(1, min(ws.max_column + 1, 30)) if ws.cell(r, c).value is not None]
                        print(f"Data Row {r}: {row_vals[:12]}")
                    found = True
                    break
