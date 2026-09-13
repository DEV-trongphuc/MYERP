import zipfile, io, openpyxl, sys

sys.stdout.reconfigure(encoding='utf-8')

zp = r"D:\Downloads\MISA-20260913T054357Z-1-001.zip"
with zipfile.ZipFile(zp) as z_outer:
    z_data = z_outer.read("MISA/Quy trình/XuatKhauLuotChayAmisQuyTrinh_11092026 (1).zip")
    with zipfile.ZipFile(io.BytesIO(z_data)) as z_inner:
        excel_data = z_inner.read("Thù lao Giảng viên nước ngoài/Thù lao Giảng viên nước ngoài.xlsx")
        wb = openpyxl.load_workbook(io.BytesIO(excel_data), data_only=True)
        
        for sname in wb.sheetnames:
            ws = wb[sname]
            if ws.max_row <= 7: continue
            print(f"\n================ SHEET: {sname} ================")
            
            curr_id = None
            curr_title = None
            curr_status = None
            
            for r in range(8, ws.max_row + 1):
                rid = ws.cell(r, 1).value
                if rid is not None:
                    curr_id = rid
                    curr_title = ws.cell(r, 2).value
                    curr_status = ws.cell(r, 3).value
                    creator = ws.cell(r, 4).value
                    created_at = ws.cell(r, 5).value
                    pending_person = ws.cell(r, 6).value
                    curr_actor = ws.cell(r, 7).value
                    curr_step = ws.cell(r, 8).value
                    curr_time = ws.cell(r, 9).value
                    curr_note = ws.cell(r, 10).value
                    currency = ws.cell(r, 21).value
                    fee = ws.cell(r, 20).value
                    print(f"\n[MISA #{curr_id}] - {curr_title} | TT: {curr_status} | {fee} {currency}")
                    print(f"  Tạo: {creator} lúc {created_at} | Đang chờ: {pending_person}")
                    if curr_actor:
                        print(f"  -> Step: {curr_step} | Bởi: {curr_actor} | Lúc: {curr_time} | Note: {curr_note}")
                else:
                    actor = ws.cell(r, 7).value
                    step = ws.cell(r, 8).value
                    time = ws.cell(r, 9).value
                    note = ws.cell(r, 10).value
                    if actor or step:
                        print(f"  -> Step: {step} | Bởi: {actor} | Lúc: {time} | Note: {note}")
