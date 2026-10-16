<?php
// backend/migrations/323_seed_ideas_labor_regulations_2024_and_late_quota.php
// Chuẩn hóa cấu hình định mức đi trễ/về sớm theo giới tính (Nữ 60p/tháng, Nam 30p/tháng - Điều 14 NQLĐ 2024),
// chuẩn hóa giới tính nhân sự IDEAS, dọn dẹp tài liệu trùng lặp và huấn luyện trọn bộ Nội quy Lao động Viện IDEAS (QĐ 001/2024 - 7 Chương, 28 Điều).

if (!function_exists('createTrainingChunks323')) {
    function createTrainingChunks323(string $text, int $chunkSize = 700, int $overlap = 120): array {
        $paragraphs = preg_split('/\n\s*\n/', $text);
        $chunks = [];
        $currentChunk = '';

        foreach ($paragraphs as $para) {
            $para = trim($para);
            if (empty($para)) continue;

            if (mb_strlen($currentChunk . "\n\n" . $para) <= $chunkSize) {
                $currentChunk = empty($currentChunk) ? $para : $currentChunk . "\n\n" . $para;
            } else {
                if (!empty($currentChunk)) {
                    $chunks[] = $currentChunk;
                    $words = explode(' ', $currentChunk);
                    $tailWords = array_slice($words, -15);
                    $currentChunk = implode(' ', $tailWords) . "\n\n" . $para;
                } else {
                    $subChunks = mb_str_split($para, $chunkSize);
                    foreach ($subChunks as $sc) {
                        if (mb_strlen(trim($sc)) >= 30) {
                            $chunks[] = trim($sc);
                        }
                    }
                    $currentChunk = '';
                }
            }
        }

        if (!empty($currentChunk) && mb_strlen(trim($currentChunk)) >= 30) {
            $chunks[] = trim($currentChunk);
        }

        return array_values($chunks);
    }
}

// ============================================================================
// DỮ LIỆU CHUẨN HÓA DOC-01 & DOC-18 KHỚP 100% VỚI QĐ 001/2024
// ============================================================================
$updatedExistingDocs = [
    [
        'id_hint' => 1,
        'like_pattern' => 'DOC-01: Quy chế Quản trị Nhân sự%',
        'title' => 'DOC-01: Quy chế Quản trị Nhân sự & Đơn từ Hành chính (HRM & Leaves)',
        'source_type' => 'manual',
        'tags' => 'hrm, nhan_su, cham_cong, di_tre, ve_som, nu_60_phut, nam_30_phut, nghi_phep, phep_nam, nghi_bu, wfh, qd_001_2024',
        'content' => "DOC-01: QUY CHẾ QUẢN TRỊ NHÂN SỰ, CHẤM CÔNG & ĐƠN TỪ HÀNH CHÍNH VIỆN IDEAS (THEO QĐ 001/2024)\n"
            . "Từ khóa tra cứu: noi quy lao dong, qd 001 2024, gio lam viec, di tre ve som, nu 60 phut, nam 30 phut, wfh, nghi phep nam, nghi bu.\n\n"
            . "1. THỜI GIỜ LÀM VIỆC & NGHỈ NGƠI CHUẨN (ĐIỀU 5 NQLĐ QĐ 001/2024):\n"
            . "- Thời gian làm việc trong tuần: 5 ngày/tuần, tổng cộng 40 giờ/tuần (nghỉ hàng tuần 02 ngày/tuần).\n"
            . "- Thời gian làm việc trong ngày: 8 tiếng/ngày (tương đương 1.0 ngày công chuẩn = 0.5 công sáng + 0.5 công chiều).\n"
            . "  + Ca sáng: Từ 08:00 đến 12:00 (4 tiếng).\n"
            . "  + Nghỉ trưa: Từ 12:00 đến 13:00 (01 tiếng).\n"
            . "  + Ca chiều: Từ 13:00 đến 17:00 (4 tiếng).\n"
            . "- Tất cả Người lao động (NLĐ) phải thực hiện nghiêm chỉnh quy định giờ làm việc: không đi muộn về sớm, không lãng phí thời gian làm việc, không sử dụng thời gian làm việc để làm việc riêng.\n\n"
            . "2. QUY ĐỊNH ĐI TRỄ, VỀ SỚM, RA NGOÀI & ĐỊNH MỨC PHÚT TRỄ ĐƯỢC PHÉP HÀNG THÁNG (ĐIỀU 14 NQLĐ QĐ 001/2024):\n"
            . "- Định mức đi trễ và về sớm được phép trong tháng theo giới tính:\n"
            . "  + Đối với lao động Nữ: Có 60 phút/tháng đi trễ và về sớm được phép (không bị trừ công/phép).\n"
            . "  + Đối với lao động Nam: Có 30 phút/tháng đi trễ và về sớm được phép (không bị trừ công/phép).\n"
            . "- Cách tính khấu trừ khi vượt định mức: Chỉ khi tổng số phút đi trễ và về sớm thực tế trong tháng (sau khi trừ các ngày có đơn xin đi trễ/về sớm hợp lệ được duyệt) vượt quá 60 phút đối với Nữ hoặc 30 phút đối với Nam, thì phần số phút vượt định mức (excess_late_minutes = tổng_phút_trễ - định_mức) mới bị quy đổi khấu trừ lần lượt vào Quỹ nghỉ bù -> Quỹ phép năm -> Ngày công thực tế.\n"
            . "- Nguyên tắc pháp lý (Điều 23.1.4): Viện tuyệt đối KHÔNG áp dụng hình thức phạt tiền hoặc cắt lương trực tiếp thay cho việc xử lý kỷ luật lao động.\n"
            . "- Quy trình báo cáo khi đi trễ / về sớm / ra ngoài (Điều 14):\n"
            . "  + Trường hợp đến trễ hoặc vắng mặt đột xuất vì bệnh hoặc lý do khác: Phải thông báo ngay cho Trưởng Phòng và Phòng HCNS qua điện thoại càng sớm càng tốt.\n"
            . "  + Trường hợp muốn về sớm hoặc ra ngoài vì mục đích cá nhân trong giờ làm việc: Phải được Trưởng Phòng và Phòng HCNS chấp thuận trước.\n"
            . "  + Nếu vắng mặt mà không thông báo hoặc không được chấp thuận trước sẽ bị xem là nghỉ không có lý do chính đáng và xử lý kỷ luật.\n\n"
            . "3. QUY ĐỊNH LÀM VIỆC TỪ XA - WFH (ĐIỀU 5.3 NQLĐ QĐ 001/2024):\n"
            . "- Viện chỉ áp dụng làm việc từ xa (WFH) và hưởng nguyên đãi ngộ như làm việc trực tiếp tại Viện đối với 04 trường hợp sau:\n"
            . "  (1) Phụ nữ đang hưởng chế độ thai sản có nhu cầu làm việc trước thời gian nghỉ thai sản, với điều kiện nuôi con từ tháng thứ 4 trở lên;\n"
            . "  (2) Người lao động mắc bệnh phải điều trị dài ngày trong danh mục bệnh dài ngày theo Thông tư 46/2016/TT-BYT của Bộ Y Tế;\n"
            . "  (3) Trường hợp bất khả kháng: thiên tai, dịch bệnh, hỏa hoạn... theo Khoản 1 Điều 156 Bộ Luật Dân Sự 2015;\n"
            . "  (4) Trường hợp chăm sóc học viên online, trực lớp online.\n\n"
            . "4. QUY ĐỊNH NGHỈ PHÉP NĂM, THANH TOÁN PHÉP TỒN & NGHỈ BÙ (ĐIỀU 7 NQLĐ QĐ 001/2024):\n"
            . "- Quỹ phép năm chuẩn: 12 ngày phép hưởng nguyên lương/năm đối với điều kiện làm việc bình thường (mỗi tháng làm việc được tích lũy 1 ngày phép, chưa nghỉ sẽ cộng dồn sang các tháng sau). Cứ đủ 05 năm thâm niên làm việc liên tục tại Viện được cộng thêm 01 ngày phép/năm.\n"
            . "- Thủ tục xin nghỉ phép:\n"
            . "  + Phải làm đơn xin phép trên hệ thống và được sự đồng ý của Trưởng phòng, Phòng HCNS hoặc Viện Trưởng.\n"
            . "  + Nghỉ từ 05 ngày trở lên: Phải làm đơn xin phép trước ít nhất 02 tuần (14 ngày).\n"
            . "  + Trường hợp khẩn cấp xin nghỉ trong ngày: Phải thông báo bằng điện thoại cho cấp trên trước 08h00 sáng hôm đó.\n"
            . "- Giải quyết phép năm chưa nghỉ hết (Phép tồn):\n"
            . "  + Phép năm chưa dùng hết được chuyển sang năm kế tiếp, nhưng NLĐ phải sắp xếp nghỉ hết trước Quý I năm sau (tức trước ngày 30/03 năm sau).\n"
            . "  + Đến hết ngày 30/03 năm sau hoặc khi thôi việc mà vẫn còn phép chưa nghỉ hết: Viện thanh toán thành tiền lương nhưng TỐI ĐA KHÔNG QUÁ 10 NGÀY PHÉP NĂM theo mức lương trong HĐLĐ mới nhất.\n"
            . "- Chế độ Nghỉ bù (Điều 7B & Điều 12):\n"
            . "  + NLĐ làm việc vào buổi tối, cuối tuần (Thứ 7, Chủ nhật) được tính vào Quỹ ngày nghỉ bù.\n"
            . "  + Ngày nghỉ bù được sử dụng tương tự như phép năm nhưng KHÔNG được quy đổi thành tiền lương nếu không sắp xếp nghỉ hết trước ngày 30/03 năm sau."
    ],
    [
        'id_hint' => 41,
        'like_pattern' => 'DOC-18:%',
        'title' => 'DOC-18: Quy chế Khen thưởng Hoa hồng Tuyển sinh, Phúc lợi, Thai sản & Kỷ luật Đi muộn',
        'source_type' => 'manual',
        'tags' => 'khen_thuong, phuc_loi, thai_san, nghi_benh, viec_rieng, ky_luat, di_muon, nu_60_phut, nam_30_phut, qd_001_2024',
        'content' => "DOC-18: QUY CHẾ PHÚC LỢI, NGHỈ LỄ TẾT, BỆNH, THAI SẢN, VIỆC RIÊNG & KỶ LUẬT ĐI MUỘN VIỆN IDEAS (QĐ 001/2024)\n"
            . "Từ khóa tra cứu: phuc loi, thai san, nghi benh, ket hon, tang che, di tre, nu 60 phut, nam 30 phut, ky luat lao dong, sa thai.\n\n"
            . "1. CHÍNH SÁCH ĐỊNH MỨC ĐI TRỄ VỀ SỚM & XỬ LÝ VI PHẠM GIỜ GIẤC (ĐIỀU 14, 23, 24 NQLĐ 2024):\n"
            . "- Định mức miễn trừ đi trễ và về sớm hàng tháng (Điều 14):\n"
            . "  + Nhân sự Nữ: Được phép đi trễ và về sớm tối đa 60 phút/tháng.\n"
            . "  + Nhân sự Nam: Được phép đi trễ và về sớm tối đa 30 phút/tháng.\n"
            . "- Khi tổng số phút đi trễ/về sớm trong tháng nằm trong định mức (<= 60 phút với Nữ, <= 30 phút với Nam): Nhân sự không bị trừ phép hay ngày công.\n"
            . "- Khi vượt định mức: Chỉ phần số phút vượt ngoài 60 phút (Nữ) hoặc 30 phút (Nam) mới bị quy đổi khấu trừ vào Nghỉ bù / Phép năm / Ngày công.\n"
            . "- Tuyệt đối tuân thủ Điều 23.1.4 NQLĐ và Bộ luật Lao động: Nghiêm cấm phạt tiền hoặc cắt lương thay việc xử lý kỷ luật lao động. Nhân viên vi phạm kỷ luật giờ giấc (Điều 5, Điều 14) lần đầu sẽ bị nhắc nhở/khiển trách bằng văn bản và trừ điểm đánh giá Tháng/Quý/Năm; tái phạm trong vòng 1 tháng kể từ ngày bị khiển trách sẽ áp dụng hình thức kéo dài thời hạn nâng lương không quá 06 tháng.\n\n"
            . "2. CHẾ ĐỘ NGHỈ LỄ, TẾT HƯỞNG NGUYÊN LƯƠNG (ĐIỀU 6 NQLĐ 2024):\n"
            . "- Tổng cộng 11 ngày nghỉ Lễ, Tết hưởng nguyên lương trong năm:\n"
            . "  + Tết Dương lịch: 01 ngày (01/01 dương lịch).\n"
            . "  + Tết Âm lịch: 05 ngày.\n"
            . "  + Ngày Giỗ Tổ Hùng Vương: 01 ngày (10/03 âm lịch).\n"
            . "  + Ngày Giải phóng miền Nam: 01 ngày (30/04 dương lịch).\n"
            . "  + Ngày Quốc tế Lao động: 01 ngày (01/05 dương lịch).\n"
            . "  + Ngày Quốc khánh: 02 ngày (02/09 dương lịch và 01 ngày liền kề trước hoặc sau).\n"
            . "- Nếu ngày nghỉ hằng tuần trùng với ngày nghỉ lễ, tết thì NLĐ được nghỉ bù vào ngày làm việc kế tiếp.\n\n"
            . "3. CHẾ ĐỘ NGHỈ BỆNH / ỐM ĐAU (ĐIỀU 8 NQLĐ 2024):\n"
            . "- Khi bị bệnh, NLĐ hoặc người thân phải thông báo cho Viện trong thời gian sớm nhất.\n"
            . "- Nếu nghỉ bệnh hơn 03 ngày liên tục: Sau khi đi làm lại phải nộp đơn xin nghỉ bệnh kèm Giấy xác nhận của Bác sĩ; nếu không có giấy bác sĩ sẽ bị khấu trừ vào ngày phép năm.\n"
            . "- Thời gian hưởng trợ cấp ốm đau BHXH tối đa: 30 ngày/năm (đóng BHXH < 15 năm), 40 ngày/năm (đóng BHXH từ 15 đến < 30 năm), 60 ngày/năm (đóng BHXH >= 30 năm).\n\n"
            . "4. CHẾ ĐỘ NGHỈ THAI SẢN CHO LAO ĐỘNG NỮ & NAM (ĐIỀU 9 NQLĐ 2024):\n"
            . "- Đối với Lao động Nữ:\n"
            . "  + Được nghỉ trước và sau khi sinh con là 06 tháng (nghỉ trước sinh tối đa không quá 02 tháng; sinh đôi trở lên từ con thứ 2 mỗi con được nghỉ thêm 01 tháng).\n"
            . "  + Đi làm sớm trước hạn: Phải đã nghỉ ít nhất 04 tháng, báo trước cho Trưởng phòng & HCNS/Viện Trưởng ít nhất 07 ngày và được chấp thuận. Được hưởng đủ lương những ngày đi làm ngoài khoản trợ cấp BHXH.\n"
            . "  + Xin nghỉ thêm sau thai sản: Báo trước ít nhất 10 ngày, nghỉ thêm tối đa không quá 30 ngày (tính là nghỉ không hưởng lương).\n"
            . "- Đối với Lao động Nam (đang đóng BHXH khi vợ sinh con, tính trong 30 ngày đầu kể từ ngày vợ sinh):\n"
            . "  + Vợ sinh thường: Nghỉ 05 ngày làm việc.\n"
            . "  + Vợ sinh phẫu thuật hoặc sinh con dưới 32 tuần tuổi: Nghỉ 07 ngày làm việc.\n"
            . "  + Vợ sinh đôi: Nghỉ 10 ngày làm việc (từ sinh ba trở lên, mỗi con thêm 03 ngày).\n"
            . "  + Vợ sinh đôi trở lên mà phải phẫu thuật: Nghỉ 14 ngày làm việc.\n\n"
            . "5. NGHỈ VIỆC RIÊNG CÓ LƯƠNG & KHÔNG HƯỞNG LƯƠNG (ĐIỀU 10 & ĐIỀU 11 NQLĐ 2024):\n"
            . "- Nghỉ việc riêng hưởng nguyên lương (Điều 10):\n"
            . "  + Bản thân kết hôn: Nghỉ 03 ngày.\n"
            . "  + Con đẻ, con nuôi kết hôn: Nghỉ 01 ngày.\n"
            . "  + Cha đẻ, mẹ đẻ, cha nuôi, mẹ nuôi (của mình hoặc của vợ/chồng), vợ/chồng, con đẻ, con nuôi mất: Nghỉ 03 ngày.\n"
            . "- Nghỉ việc riêng không hưởng lương (Điều 11):\n"
            . "  + Ông bà nội/ngoại, anh chị em ruột mất; hoặc cha/mẹ kết hôn, anh chị em ruột kết hôn: Nghỉ không lương 01 ngày (phải thông báo).\n"
            . "  + Nghỉ không lương theo thỏa thuận có lý do chính đáng (được Trưởng phòng & HCNS/Viện Trưởng đồng ý): Tối đa 14 ngày/năm."
    ]
];

// ============================================================================
// BỘ 5 TÀI LIỆU TOÀN DIỆN NỘI QUY LAO ĐỘNG VIỆN IDEAS 2024 (QĐ 001/2024 - 28 ĐIỀU)
// ============================================================================
$targetFolderName = '08. QUY TRÌNH & QUY CHẾ VẬN HÀNH DOANH NGHIỆP MYERP';

$nqldDocs = [
    [
        'title' => 'NQLĐ-01: Nội quy Viện IDEAS (QĐ 001/2024) – Quy định Chung, Giờ làm việc (8h-12h & 13h-17h), Định mức Đi trễ Về sớm (Nữ 60p / Nam 30p), WFH & Chế độ Họp (Điều 1, 2, 3, 4, 5, 12, 14)',
        'source_type' => 'manual',
        'tags' => 'noi_quy, nqld, qd_001, dieu_1, dieu_5, dieu_12, dieu_14, gio_lam_viec, di_tre, ve_som, nu_60_phut, nam_30_phut, wfh, lam_them_gio, hop_dinh_ky',
        'content' => "NỘI QUY LAO ĐỘNG VIỆN IDEAS NĂM 2024 (QUYẾT ĐỊNH 001/2024 - BAN HÀNH NGÀY 26/03/2024 BỞI VIỆN TRƯỞNG PHẠM QUANG VINH)\n"
            . "PHẦN 1: QUY ĐỊNH CHUNG, THỜI GIỜ LÀM VIỆC, ĐỊNH MỨC ĐI TRỄ VỀ SỚM (NỮ 60 PHÚT / NAM 30 PHÚT), LÀM VIỆC TỪ XA (WFH), LÀM THÊM GIỜ & CHẾ ĐỘ HỌP (ĐIỀU 1, 2, 3, 4, 5, 12, 14)\n"
            . "Từ khóa: noi quy lao dong vien ideas, qd 001 2024, gio lam viec, di tre ve som, nu 60 phut, nam 30 phut, wfh, lam them gio, hop toan vien, hop phong.\n\n"
            . "CHƯƠNG I: NHỮNG QUY ĐỊNH CHUNG (ĐIỀU 1 - ĐIỀU 4)\n"
            . "• Căn cứ pháp lý: Bộ Luật Lao Động số 45/2019/QH14 (20/11/2019); Nghị định 145/2020/NĐ-CP (14/12/2020); Thông tư 10/2020/TT-BLĐTBXH (12/11/2020) và sự thống nhất với Ban Chấp hành Công đoàn Viện.\n"
            . "• Điều 1 (Nội dung và mục đích) & Điều 2 (Phạm vi áp dụng):\n"
            . "  - Áp dụng thống nhất cho toàn thể cán bộ nhân viên làm việc tại 04 đơn vị thành viên: Viện Nghiên cứu Phát triển và Trao đổi Khoa học Ứng dụng (Viện IDEAS), Viện Đào tạo Chuyên gia Quản lý (Viện TIME), Công ty Cổ phần Dịch vụ Đào tạo và Tư vấn Du học (Công ty TSSAC), và Trung tâm Nghiên cứu Tư vấn Hỗ trợ Sáng tạo Khoa học Kỹ thuật TP. HCM (Trung tâm RICH).\n"
            . "  - Áp dụng đối với mọi hình thức và mọi loại hợp đồng lao động, kể cả người lao động trong thời gian tập việc, thử việc, học nghề.\n"
            . "• Điều 3 (Áp dụng, sửa đổi, bổ sung) & Điều 4 (Hiệu lực):\n"
            . "  - Các vấn đề chưa quy định trong NQLĐ được giải quyết theo Bộ Luật Lao Động. Nội quy có hiệu lực thi hành kể từ ngày ký (26/03/2024), áp dụng đồng thời với Quy chế trả lương khen thưởng để đánh giá nhân viên.\n\n"
            . "CHƯƠNG II: THỜI GIAN LÀM VIỆC, NGHỈ NGƠI & LÀM VIỆC TỪ XA - WFH (ĐIỀU 5)\n"
            . "• Điều 5.1 - Thời gian làm việc chuẩn:\n"
            . "  - Thời gian làm việc trong tuần: 05 ngày/tuần, tổng cộng 40 giờ/tuần.\n"
            . "  - Thời gian làm việc trong ngày: 08 tiếng/ngày:\n"
            . "    + Buổi sáng: Từ 08h00 đến 12h00.\n"
            . "    + Buổi chiều: Từ 13h00 đến 17h00.\n"
            . "• Điều 5.2 - Thời gian nghỉ ngơi:\n"
            . "  - Ngày nghỉ hàng tuần: 02 ngày/tuần.\n"
            . "  - Nghỉ trưa trong ngày làm việc: 01 (một) tiếng buổi trưa từ 12h00 đến 13h00.\n"
            . "  - Nghiêm cấm đi muộn về sớm, lãng phí thời gian làm việc hoặc làm việc riêng không vì quyền lợi của Viện.\n"
            . "• Điều 5.3 - Quy định Làm việc từ xa (WFH):\n"
            . "  - Viện CHỈ áp dụng làm việc từ xa (WFH) và giữ nguyên chính sách đãi ngộ như làm việc trực tiếp đối với 04 trường hợp cụ thể sau:\n"
            . "    1. Phụ nữ đang hưởng thai sản có nhu cầu làm việc trước thời gian nghỉ thai sản, với điều kiện nuôi con từ tháng thứ 4 trở lên;\n"
            . "    2. Người lao động mắc bệnh phải điều trị dài ngày trong danh mục bệnh dài ngày theo Thông tư 46/2016/TT-BYT của Bộ Y Tế;\n"
            . "    3. Trường hợp bất khả kháng: thiên tai, dịch bệnh, hỏa hoạn... theo Khoản 1 Điều 156 Bộ Luật Dân Sự 2015;\n"
            . "    4. Trường hợp chăm sóc học viên online, trực lớp online.\n\n"
            . "ĐIỀU 14: QUY ĐỊNH ĐI TRỄ, VỀ SỚM, ĐI RA NGOÀI VÌ MỤC ĐÍCH CÁ NHÂN & ĐỊNH MỨC PHÚT TRỄ HÀNG THÁNG\n"
            . "• Định mức đi trễ và về sớm được phép hàng tháng theo giới tính (Điều 14):\n"
            . "  - Đối với lao động Nữ: Có 60 phút/tháng đi trễ và về sớm.\n"
            . "  - Đối với lao động Nam: Có 30 phút/tháng đi trễ và về sớm.\n"
            . "  - Giải thích vận hành: Trong mỗi tháng, nhân sự Nữ được miễn trừ tối đa 60 phút đi trễ/về sớm và nhân sự Nam được miễn trừ tối đa 30 phút đi trễ/về sớm. Chỉ khi tổng số phút đi trễ/về sớm vượt quá định mức này thì số phút vượt mới bị khấu trừ vào nghỉ bù / phép năm / ngày công.\n"
            . "• Quy trình thông báo và xin phép (Điều 14):\n"
            . "  - Khi đến trễ hoặc vắng mặt không báo trước vì bệnh hoặc bất kỳ lý do nào khác: Phải thông báo ngay cho Trưởng Phòng và Phòng HCNS qua điện thoại càng sớm càng tốt.\n"
            . "  - Khi muốn về sớm hoặc đi ra ngoài vì mục đích cá nhân trong giờ làm việc: Phải được Trưởng Phòng và Phòng HCNS chấp thuận trước.\n"
            . "  - Nếu vắng mặt mà không thông báo hoặc không được chấp thuận trước sẽ bị xem là nghỉ không có lý do chính đáng và bị xử lý kỷ luật theo quy định.\n\n"
            . "ĐIỀU 12: QUY ĐỊNH LÀM THÊM GIỜ (OT), TRỰC CUỐI TUẦN & CHẾ ĐỘ HỌP ĐỊNH KỲ\n"
            . "• Điều 12.A - Làm thêm giờ và làm việc ngày nghỉ, ngày lễ:\n"
            . "  - Nhân viên được phân công trực lớp cuối tuần phải đăng ký và gửi lịch trực về Phòng HCNS.\n"
            . "  - Giới hạn giờ làm thêm: Phải có sự đồng ý của NLĐ; số giờ làm thêm không quá 50% số giờ làm việc bình thường trong 01 ngày; tổng giờ làm việc bình thường + làm thêm không quá 12 giờ/ngày, không quá 40 giờ/tháng và không quá 200 giờ/năm (trừ trường hợp pháp luật cho phép hoặc lệnh động viên quốc phòng/khắc phục thiên tai hỏa hoạn tại Điều 107 BLLĐ).\n"
            . "  - Chế độ đãi ngộ làm thêm giờ: NLĐ làm việc vào buổi tối, cuối tuần (Thứ 7 và Chủ nhật) được tính vào NGÀY NGHỈ BÙ. Riêng đối với Bộ phận Bảo vệ làm việc trong ngày nghỉ lễ được thanh toán 300% tiền lương thực trả của công việc đang làm.\n"
            . "• Điều 12.B - Chế độ họp định kỳ tại Viện IDEAS:\n"
            . "  - Họp chung toàn thể Viện: Định kỳ 01 lần/tháng vào đầu tháng hoặc cuối tháng (Phòng HCNS thông báo trước ít nhất 02 ngày qua Email và Group Zalo chung của Viện).\n"
            . "  - Họp phòng/bộ phận: Định kỳ 01 lần/tuần vào Thứ 2 hoặc Thứ 6 hàng tuần để đánh giá kết quả công việc tuần qua, triển khai nhiệm vụ tuần mới. Biên bản họp được lưu vào sổ họp của Phòng làm căn cứ đánh giá chất lượng và xếp loại thi đua hàng tháng, quý, năm.\n"
            . "  - Họp với Ban lãnh đạo Viện: Họp đột xuất với trưởng bộ phận và cá nhân khi có yêu cầu công việc cụ thể (lịch linh động)."
    ],
    [
        'title' => 'NQLĐ-02: Nội quy Viện IDEAS (QĐ 001/2024) – Nghỉ Lễ Tết, Nghỉ Phép Năm, Thanh toán Phép Tồn (Tối đa 10 ngày), Nghỉ Bù, Nghỉ Bệnh, Thai Sản (Nữ & Nam) & Nghỉ Việc Riêng (Điều 6, 7, 8, 9, 10, 11)',
        'source_type' => 'manual',
        'tags' => 'noi_quy, nqld, qd_001, dieu_6, dieu_7, dieu_8, dieu_9, dieu_10, dieu_11, nghi_le, phep_nam, phep_ton_10_ngay, nghi_bu, nghi_benh, thai_san, ket_hon',
        'content' => "NỘI QUY LAO ĐỘNG VIỆN IDEAS NĂM 2024 (QUYẾT ĐỊNH 001/2024)\n"
            . "PHẦN 2: CHẾ ĐỘ NGHỈ LỄ TẾT, NGHỈ PHÉP NĂM, THANH TOÁN PHÉP TỒN, NGHỈ BÙ, NGHỈ BỆNH, THAI SẢN (NỮ & NAM) & NGHỈ VIỆC RIÊNG (ĐIỀU 6, 7, 8, 9, 10, 11)\n"
            . "Từ khóa: nghi le tet, nghi phep nam, thanh toan phep ton toi da 10 ngay, truoc 30/3, nghi bu, nghi benh qua 3 ngay, giay bac si, nghi thai san nam nu, nghi ket hon, nghi khong luong.\n\n"
            . "ĐIỀU 6: NGÀY NGHỈ LỄ, TẾT HƯỞNG NGUYÊN LƯƠNG\n"
            . "• Người lao động được nghỉ và hưởng nguyên lương vào các ngày Lễ, Tết sau (tổng 11 ngày):\n"
            . "  1. Tết Dương lịch: 01 ngày (ngày 01/01 dương lịch);\n"
            . "  2. Tết Âm lịch: 05 ngày;\n"
            . "  3. Ngày Giải phóng miền Nam: 01 ngày (ngày 30/04 dương lịch);\n"
            . "  4. Ngày Quốc tế Lao động: 01 ngày (ngày 01/05 dương lịch);\n"
            . "  5. Quốc khánh: 02 ngày (ngày 02/09 dương lịch và 01 ngày liền kề trước hoặc sau);\n"
            . "  6. Ngày Giỗ Tổ Hùng Vương: 01 ngày (ngày 10/03 âm lịch).\n"
            . "• Nếu ngày nghỉ hằng tuần trùng với ngày nghỉ lễ, tết nêu trên thì NLĐ được nghỉ bù ngày nghỉ hằng tuần vào ngày làm việc kế tiếp.\n\n"
            . "ĐIỀU 7: NGHỈ PHÉP NĂM, THÂM NIÊN, THANH TOÁN PHÉP TỒN & NGHỈ BÙ\n"
            . "• Khoản A - Nghỉ phép năm (Annual Leave):\n"
            . "  1. Số ngày phép tiêu chuẩn (khi làm việc đủ 12 tháng): 12 ngày làm việc hưởng nguyên lương đối với điều kiện bình thường (14 ngày đối với lao động chưa thành niên/khuyết tật/nặng nhọc độc hại; 16 ngày đối với đặc biệt nặng nhọc độc hại).\n"
            . "  2. Làm việc chưa đủ 12 tháng: Số ngày phép tính theo tỷ lệ tương ứng với số tháng làm việc thực tế ((Phép chuẩn + Phép thâm niên) / 12 * Số tháng làm việc). Trong tháng nếu tổng ngày làm việc và nghỉ có lương chiếm >= 50% số ngày làm việc bình thường thì được tính là 01 tháng để tính phép năm.\n"
            . "  3. Tạm ứng lương & thời gian đi đường: Khi nghỉ phép năm trước kỳ trả lương được tạm ứng ít nhất bằng tiền lương những ngày nghỉ. Nếu đi bằng đường bộ, sắt, thủy mà số ngày đi đường cả đi và về trên 02 ngày thì từ ngày thứ 03 trở đi được tính thêm thời gian đi đường (chỉ tính cho 01 lần nghỉ/năm).\n"
            . "  4. Phép thâm niên (Điều 7.A.6): Cứ đủ 05 năm làm việc liên tục tại Viện thì số ngày nghỉ hằng năm được tăng thêm 01 ngày.\n"
            . "  5. Quy định tích lũy và nộp đơn xin nghỉ phép (Điều 7.A.7):\n"
            . "     + Mỗi tháng NLĐ có 01 ngày phép, nếu không nghỉ sẽ cộng dồn vào các tháng sau. Có thể thỏa thuận nghỉ thành nhiều lần hoặc nghỉ gộp tối đa 03 năm một lần.\n"
            . "     + Phải làm đơn xin phép và được sự đồng ý của Trưởng phòng, Phòng HCNS hoặc Viện Trưởng. Mọi thay đổi lịch nghỉ đã duyệt phải báo ngay và làm lại trình tự duyệt.\n"
            . "     + Nghỉ từ 05 (năm) ngày trở lên: Phải làm đơn xin phép trước 02 tuần.\n"
            . "     + Trường hợp khẩn cấp xin nghỉ trong ngày: Có thể thông báo bằng điện thoại cho cấp trên trước 08h00 sáng hôm đó.\n"
            . "  6. Cách giải quyết phép năm chưa nghỉ hết - Phép tồn (Điều 7.A.8):\n"
            . "     + Phép năm chưa dùng hết được chuyển sang năm kế tiếp, nhưng NLĐ BẮT BUỘC phải nghỉ hết trước Quý I của năm sau (tức trước ngày 30/03 năm sau).\n"
            . "     + Đến hết Quý I năm sau (hết ngày 30/03 năm sau) mà NLĐ vẫn chưa nghỉ hết phép năm: Viện sẽ thanh toán thành tiền TỐI ĐA 10 NGÀY PHÉP theo mức lương trong HĐLĐ mới nhất.\n"
            . "     + Khi thôi việc, bị mất việc làm mà chưa nghỉ hết phép năm: Được Viện thanh toán tiền lương cho những ngày chưa nghỉ nhưng KHÔNG QUÁ 10 NGÀY PHÉP NĂM.\n"
            . "• Khoản B - Nghỉ bù (Compensatory Leave):\n"
            . "  - NLĐ làm việc vào buổi tối, cuối tuần (Thứ 7 và Chủ nhật) được tính vào ngày nghỉ bù và sử dụng tương tự ngày phép năm.\n"
            . "  - LƯU Ý QUAN TRỌNG: Ngày nghỉ bù SẼ KHÔNG ĐƯỢC GIẢI QUYẾT THÀNH TIỀN LƯƠNG nếu không sắp xếp nghỉ hết trước Quý I của năm sau (tức trước ngày 30/03 năm sau).\n\n"
            . "ĐIỀU 8: CHẾ ĐỘ NGHỈ BỆNH (SICK LEAVE)\n"
            . "• Khi bị bệnh, NLĐ hoặc người thân phải thông báo cho Viện trong thời gian sớm nhất.\n"
            . "• Trường hợp nghỉ bệnh nhiều ngày liên tiếp (HƠN 03 NGÀY LIÊN TỤC): Sau khi nghỉ bệnh phải nộp đơn xin nghỉ bệnh kèm GIẤY XÁC NHẬN CỦA BÁC SĨ; nếu không có giấy xác nhận của Bác sĩ sẽ bị khấu trừ vào ngày phép năm.\n"
            . "• Thời gian hưởng trợ cấp ốm đau từ BHXH tối đa trong 1 năm: 30 ngày (nếu đóng BHXH dưới 15 năm); 40 ngày (đóng BHXH từ 15 năm đến dưới 30 năm); 60 ngày (đóng BHXH từ 30 năm trở lên).\n\n"
            . "ĐIỀU 9: CHẾ ĐỘ NGHỈ THAI SẢN (ĐỐI VỚI NỮ VÀ NAM)\n"
            . "• Điều 9.1 - Đối với lao động Nữ:\n"
            . "  - Thời gian nghỉ: 06 tháng trước và sau khi sinh con (thời gian nghỉ trước sinh tối đa không quá 02 tháng). Sinh đôi trở lên thì tính từ con thứ 02 trở đi, cứ mỗi con mẹ được nghỉ thêm 01 tháng.\n"
            . "  - Trở lại làm việc sớm trước hạn: Phải đã nghỉ ít nhất 04 tháng, thông báo cho Trưởng Phòng và Phòng HCNS hoặc Viện Trưởng ít nhất trước 07 ngày và được chấp thuận. Khi đi làm sớm, NLĐ nữ được thanh toán đủ lương cho những ngày đi làm ngoài chế độ thai sản từ Quỹ BHXH.\n"
            . "  - Nghỉ thêm sau khi hết thời gian thai sản: Phải thông báo và được chấp thuận trước ít nhất 10 ngày tính từ ngày kết thúc kỳ nghỉ thai sản; số ngày nghỉ thêm không vượt quá 30 ngày và tính là nghỉ không hưởng lương.\n"
            . "• Điều 9.2 - Đối với lao động Nam (đang đóng BHXH khi vợ sinh con, nghỉ trong 30 ngày đầu kể từ ngày vợ sinh):\n"
            . "  - Vợ sinh thường: Nghỉ 05 ngày làm việc;\n"
            . "  - Vợ sinh phẫu thuật hoặc sinh con dưới 32 tuần tuổi: Nghỉ 07 ngày làm việc;\n"
            . "  - Vợ sinh đôi: Nghỉ 10 ngày làm việc (từ sinh 3 trở lên cứ thêm mỗi con nghỉ thêm 03 ngày làm việc);\n"
            . "  - Vợ sinh đôi trở lên mà phải phẫu thuật: Nghỉ 14 ngày làm việc.\n\n"
            . "ĐIỀU 10 & ĐIỀU 11: NGHỈ VIỆC RIÊNG CÓ LƯƠNG & KHÔNG HƯỞNG LƯƠNG\n"
            . "• Điều 10 - Nghỉ việc riêng hưởng nguyên lương (phải thông báo trước):\n"
            . "  - Bản thân kết hôn: Nghỉ 03 ngày;\n"
            . "  - Con đẻ, con nuôi kết hôn: Nghỉ 01 ngày;\n"
            . "  - Cha đẻ, mẹ đẻ, cha nuôi, mẹ nuôi (của mình hoặc của vợ/chồng), vợ/chồng, con đẻ, con nuôi chết: Nghỉ 03 ngày.\n"
            . "• Điều 11 - Nghỉ việc riêng không hưởng lương:\n"
            . "  - Được nghỉ không lương 01 ngày (phải thông báo) khi: Ông nội, bà nội, ông ngoại, bà ngoại, anh, chị, em ruột chết; hoặc cha/mẹ kết hôn, anh/chị/em ruột kết hôn.\n"
            . "  - Xin nghỉ không lương theo thỏa thuận (có lý do thật sự chính đáng và được Trưởng Phòng, Phòng HCNS hoặc Viện Trưởng đồng ý): Tối đa 14 ngày trong năm."
    ],
    [
        'title' => 'NQLĐ-03: Nội quy Viện IDEAS (QĐ 001/2024) – Trật tự Nơi Làm việc, Tác phong, Vệ sinh, Hủy Tài liệu Bảo mật, Quy định Đồng phục (Thứ 2, T7, CN) & 11 Hành vi Nghiêm cấm (Điều 13, 15, 16, 17)',
        'source_type' => 'manual',
        'tags' => 'noi_quy, nqld, qd_001, dieu_13, dieu_15, dieu_16, dieu_17, tac_phong, ve_sinh, huy_giay_hcns, dong_phuc, trang_phuc, deo_the_ten, hanh_vi_nghiem_cam',
        'content' => "NỘI QUY LAO ĐỘNG VIỆN IDEAS NĂM 2024 (QUYẾT ĐỊNH 001/2024)\n"
            . "PHẦN 3: TRẬT TỰ NƠI LÀM VIỆC, TÁC PHONG CÔNG SỞ, LỐI SỐNG TẬP THỂ, QUY ĐỊNH ĐỒNG PHỤC & 11 HÀNH VI BỊ NGHIÊM CẤM (ĐIỀU 13, 15, 16, 17)\n"
            . "Từ khóa: trat tu noi lam viec, tac phong cong so, ve sinh van phong, huy tai lieu hcns, dong phuc thu 2 thu 7 chu nhat, deo the ten, 11 hanh vi nghiem cam.\n\n"
            . "CHƯƠNG III: TRẬT TỰ NƠI LÀM VIỆC\n"
            . "• Điều 13 - Thực hiện công việc được giao:\n"
            . "  - Thực hiện đúng công việc theo HĐLĐ và sự phân công của Trưởng Phòng, Phòng HCNS hoặc Viện Trưởng.\n"
            . "  - Tuân thủ nghiêm giờ làm việc và nghỉ ngơi; phải thông báo cho cấp trên mỗi khi rời vị trí làm việc hoặc ra ngoài công tác.\n"
            . "  - Trong giờ làm việc: Tuyệt đối không làm việc riêng, không gây mất trật tự, KHÔNG ĐƯỢC NGỦ trong thời gian làm việc. Luôn làm việc tận tâm, trung thực vì lợi ích của Viện.\n\n"
            . "• Điều 15 - Tác phong, thái độ làm việc nơi công sở và lối sống tập thể:\n"
            . "  - Khoản A (Tác phong, thái độ): Thái độ tích cực, có trách nhiệm; giao tiếp văn minh lịch sự với đồng nghiệp, đối tác, khách hàng (nhã nhặn, chào hỏi, kính trên nhường dưới); nghiêm cấm thái độ khiếm nhã với khách hàng, cấp trên.\n"
            . "  - Khoản B (Lối sống tập thể - 7 quy tắc bắt buộc):\n"
            . "    1. Vệ sinh & Hủy tài liệu bảo mật: Giữ gìn vệ sinh chung và bàn làm việc. Thùng rác trong/trước văn phòng CHỈ đựng rác văn phòng, tuyệt đối không bỏ rác thực phẩm gây mùi (rác thực phẩm/hỗn hợp phải bỏ vào thùng rác dưới hầm). Danh sách, giấy tờ liên quan tới hoạt động của Viện phải chuyển về Phòng HCNS để hủy giấy theo đúng quy định, TUYỆT ĐỐI KHÔNG đem giấy tờ ra ngoài để tránh thất thoát thông tin. Sắp xếp ghế và vật dụng gọn gàng trước khi về.\n"
            . "    2. Giày, dép: Để đúng nơi quy định, không để ra ngoài văn phòng hoặc vứt bừa bãi.\n"
            . "    3. Thảm, chăn, gối ngủ, vật dụng cá nhân: Phải xếp gọn gàng, ngay ngắn.\n"
            . "    4. Ăn uống: Hạn chế tối đa ăn uống tụ tập tại văn phòng trong giờ làm việc; KHÔNG ăn uống đồ có nặng mùi trong văn phòng; đồ ăn thừa phải bỏ đúng thùng rác quy định.\n"
            . "    5. Thiết bị máy tính & điện: Trước khi ra về phải tắt máy tính cá nhân; người về cuối cùng trong phòng phải tắt máy tính dùng in ấn, tắt đèn và thiết bị điện. Bộ phận Bảo vệ chịu trách nhiệm kiểm tra thiết bị điện các phòng sau giờ làm việc.\n"
            . "    6. Giúp đỡ đồng nghiệp: Chủ động hỗ trợ đồng nghiệp trong các công việc liên quan.\n"
            . "    7. Hoạt động ngoại khóa / công tác xã hội: Nhân viên tham gia các hoạt động ngoại khóa, công tác xã hội do Viện tổ chức/phối hợp vẫn được tính ngày công như ngày làm việc bình thường.\n\n"
            . "• Điều 16 - Quy định Trang phục nơi công sở (Đồng phục & Thẻ tên):\n"
            . "  - Mặc ĐỒNG PHỤC CỦA VIỆN vào ngày THỨ 2 hàng tuần và ngày cuối tuần (THỨ 7 và CHỦ NHẬT).\n"
            . "  - Mặc trang phục công sở lịch sự thông thường vào các ngày còn lại từ Thứ 3 đến Thứ 6.\n"
            . "  - Đối với nhân viên thử việc: Mặc trang phục công sở.\n"
            . "  - Đối với nhân viên của dự án Thuê phòng: Được phép mặc áo thun (có tay).\n"
            . "  - Luôn đảm bảo trang phục sạch sẽ, gọn gàng, lịch sự và ĐEO THẺ TÊN theo quy định của Viện.\n\n"
            . "• Điều 17 - 11 Hành vi bị nghiêm cấm tuyệt đối tại Viện IDEAS (Từ điểm a đến điểm k):\n"
            . "  a) Hút thuốc trong khu vực quy định không được hút thuốc;\n"
            . "  b) Uống rượu bia trong giờ làm việc, trừ những trường hợp gặp khách hàng, đối tác;\n"
            . "  c) Tham gia vào những chuyện ngồi lê đôi mách ác ý hoặc cáo buộc sai, cản trở/phá vỡ/ngăn cản người lao động khác thực hiện công việc;\n"
            . "  d) Có hành vi trái đạo đức hoặc không đứng đắn tại trụ sở;\n"
            . "  e) Cố cưỡng ép, lăng nhục, đe dọa hoặc dọa dẫm người lao động khác, đối tác, khách hàng của Viện;\n"
            . "  f) Cố ý gây thương tích cho người lao động khác hoặc đối tác, khách hàng của Viện;\n"
            . "  g) Sử dụng ma túy trong Viện;\n"
            . "  h) Tổ chức đánh bạc trong Viện;\n"
            . "  i) Tàng trữ vũ khí, chất nổ hoặc những vật dụng nguy hiểm hay bị cấm khác trong trụ sở Viện;\n"
            . "  j) Cố ý gây thiệt hại hoặc trộm cắp tài sản của Viện hoặc tài sản của Người lao động khác;\n"
            . "  k) Quấy rối tình dục hoặc bất cứ hành vi quấy rối nào khác hoặc phân biệt đối xử đối với đồng nghiệp."
    ],
    [
        'title' => 'NQLĐ-04: Nội quy Viện IDEAS (QĐ 001/2024) – An toàn Vệ sinh Lao động, PCCC, Sử dụng Bảo vệ Tài sản Viện & Bảo mật Thông tin Khách hàng (Điều 18, 19, 20, 21)',
        'source_type' => 'manual',
        'tags' => 'noi_quy, nqld, qd_001, dieu_18, dieu_19, dieu_20, dieu_21, an_toan_lao_dong, pccc, bao_ve_tai_san, bi_mat_kinh_doanh, bao_mat_khach_hang',
        'content' => "NỘI QUY LAO ĐỘNG VIỆN IDEAS NĂM 2024 (QUYẾT ĐỊNH 001/2024)\n"
            . "PHẦN 4: AN TOÀN - VỆ SINH LAO ĐỘNG, PHÒNG CHÁY CHỮA CHÁY (PCCC), BẢO VỆ TÀI SẢN VIỆN & BÍ MẬT KINH DOANH / THÔNG TIN KHÁCH HÀNG (ĐIỀU 18, 19, 20, 21)\n"
            . "Từ khóa: an toan ve sinh lao dong, pccc, su dung tai san vien, mang tai san ra ngoai, giu bi mat kinh doanh, bao mat thong tin khach hang.\n\n"
            . "CHƯƠNG IV: AN TOÀN - VỆ SINH LAO ĐỘNG (ĐIỀU 18 & ĐIỀU 19)\n"
            . "• Điều 18 - Trách nhiệm của Người sử dụng lao động (Viện IDEAS):\n"
            . "  - Bảo đảm vệ sinh môi trường làm việc, không gian, hệ thống thông gió, ánh sáng đạt tiêu chuẩn sức khỏe.\n"
            . "  - Trang bị thiết bị y tế, sơ cứu thích hợp và phương tiện bảo hộ lao động cần thiết.\n"
            . "  - Trang bị bảng chỉ dẫn an toàn vệ sinh lao động tại vị trí dễ đọc, dễ thấy; lấy ý kiến tổ chức đại diện tập thể lao động khi xây dựng kế hoạch an toàn vệ sinh lao động.\n"
            . "• Điều 19 - Trách nhiệm của Người lao động về An toàn lao động & PCCC:\n"
            . "  - Trước khi rời khỏi chỗ làm: Phải vệ sinh nơi làm việc, kiểm tra thiết bị điện, nước tại chỗ, bảo đảm đã tắt và khóa cẩn thận.\n"
            . "  - Chịu trách nhiệm bảo dưỡng, vệ sinh các thiết bị điện tại chỗ làm việc luôn sạch sẽ.\n"
            . "  - Báo cáo kịp thời khi phát hiện nguy cơ tai nạn lao động, sự cố nguy hiểm; có quyền từ chối hoặc rời bỏ nơi làm việc khi thấy rõ nguy cơ đe dọa tính mạng/sức khỏe cho đến khi sự cố được khắc phục.\n"
            . "  - Triệt để chấp hành các quy định, quy chế về Phòng cháy chữa cháy (PCCC).\n\n"
            . "CHƯƠNG V: BẢO VỆ TÀI SẢN VIỆN – BÍ MẬT KINH DOANH (ĐIỀU 20 & ĐIỀU 21)\n"
            . "• Điều 20 - Sử dụng và bảo vệ tài sản của Viện:\n"
            . "  1. Quyền sử dụng: NLĐ chỉ được phép sử dụng các tài sản đã được Viện bàn giao hoặc trang bị để thực hiện công việc của mình. Không tự ý sử dụng tài sản khác khi chưa được Trưởng Phòng, Phòng HCNS hoặc Viện Trưởng cho phép. Tuyệt đối không sử dụng tài sản của Viện cho bất cứ lợi ích cá nhân nào.\n"
            . "  2. Trách nhiệm bảo vệ tài sản:\n"
            . "     + Phải có trách nhiệm bảo vệ tài sản Viện; nếu làm thất thoát, hư hỏng thì phải bồi thường.\n"
            . "     + Không được phép mang dụng cụ, máy móc, văn bản và bất kỳ tài sản nào của Viện ra khỏi trụ sở mà không có sự đồng ý của Trưởng Phòng, Phòng HCNS hoặc Viện Trưởng.\n"
            . "     + Nghiêm cấm chiếm đoạt bất cứ tài sản nào của Viện vì mục đích cá nhân hoặc bán lại.\n\n"
            . "• Điều 21 - Giữ bí mật kinh doanh & Bảo mật dữ liệu khách hàng:\n"
            . "  - Trong suốt quá trình làm việc tại Viện, NLĐ tuyệt đối không được tiết lộ hoặc yêu cầu tiết lộ các thông tin bí mật thuộc quyền sở hữu của Viện về khách hàng, học viên hoặc nhà cung cấp cho người không có thẩm quyền (trừ khi được khách hàng cho phép hoặc theo yêu cầu của cơ quan pháp luật).\n"
            . "  - Bảo mật thông tin khách hàng là ưu tiên hàng đầu của mọi nhân sự trong Viện.\n"
            . "  - Nhân sự không có thẩm quyền tuyệt đối không được truy xuất trái phép vào dữ liệu, tài liệu và phương pháp kinh doanh bảo mật của Viện."
    ],
    [
        'title' => 'NQLĐ-05: Nội quy Viện IDEAS (QĐ 001/2024) – Xử lý Kỷ luật Lao động (Khiển trách, Kéo dài nâng lương <=6 tháng, Cách chức, Sa thải), Thời hiệu, Xóa kỷ luật, Tạm đình chỉ & Bồi thường Vật chất (Điều 22, 23, 24, 25, 26, 27, 28)',
        'source_type' => 'manual',
        'tags' => 'noi_quy, nqld, qd_001, dieu_22, dieu_23, dieu_24, dieu_25, dieu_26, dieu_27, dieu_28, ky_luat, khien_trach, cach_chuc, sa_thai, tam_dinh_chi, boi_thuong',
        'content' => "NỘI QUY LAO ĐỘNG VIỆN IDEAS NĂM 2024 (QUYẾT ĐỊNH 001/2024)\n"
            . "PHẦN 5: VI PHẠM KỶ LUẬT LAO ĐỘNG, 3 HÌNH THỨC XỬ LÝ KỶ LUẬT, THỜI HIỆU, XÓA KỶ LUẬT, TẠM ĐÌNH CHỈ CÔNG VIỆC & TRÁCH NHIỆM VẬT CHẤT (ĐIỀU 22, 23, 24, 25, 26, 27, 28 & CHƯƠNG VII)\n"
            . "Từ khóa: xu ly ky luat lao dong, khien trach, keo dai thoi han nang luong 6 thang, cach chuc, sa thai, bo viec 5 ngay, tam dinh chi cong viec, boi thuong thiet hai.\n\n"
            . "CHƯƠNG VI: VI PHẠM KỶ LUẬT LAO ĐỘNG, HÌNH THỨC XỬ LÝ & TRÁCH NHIỆM VẬT CHẤT\n"
            . "• Điều 22 - Các hành vi vi phạm kỷ luật lao động:\n"
            . "  - Vi phạm các quy định của Nội quy lao động này;\n"
            . "  - Gây thiệt hại hoặc ảnh hưởng xấu cho danh tiếng, lợi ích và tài sản Viện;\n"
            . "  - Hành động vượt quá khả năng hoặc phạm vi trách nhiệm được ủy quyền;\n"
            . "  - Giả mạo chứng nhận của Bác sĩ hoặc giấy tờ khác để lừa dối Viện;\n"
            . "  - Lừa đảo khi thực hiện công việc hoặc vi phạm nhiệm vụ được giao.\n\n"
            . "• Điều 23 - Nguyên tắc và trình tự xử lý kỷ luật lao động:\n"
            . "  - Nguyên tắc bắt buộc (Điều 23.1):\n"
            . "    + Phải lập thành biên bản; không áp dụng nhiều hình thức kỷ luật cho 01 hành vi; nếu đồng thời có nhiều hành vi vi phạm thì chỉ áp dụng hình thức kỷ luật cao nhất tương ứng với hành vi nặng nhất.\n"
            . "    + Nhân viên vi phạm kỷ luật sẽ bị trừ điểm vào phần đánh giá hàng Tháng/Quý/Năm.\n"
            . "    + Các trường hợp KHÔNG ĐƯỢC xử lý kỷ luật: Đang nghỉ ốm đau, điều dưỡng, nghỉ việc được sự đồng ý của Viện; Đang bị tạm giữ, tạm giam; Đang chờ kết quả điều tra của cơ quan có thẩm quyền (Khoản 1, 2 Điều 125 BLLĐ); Lao động nữ mang thai, nghỉ thai sản, nuôi con dưới 12 tháng tuổi; Người mắc bệnh tâm thần hoặc mất khả năng nhận thức/điều khiển hành vi.\n"
            . "    + CÁC HÀNH VI BỊ NGHIÊM CẤM KHI XỬ LÝ KỶ LUẬT (Điều 23.1.4): (1) Xâm phạm sức khỏe, danh dự, tính mạng, uy tín, nhân phẩm của NLĐ; (2) PHẠT TIỀN, CẮT LƯƠNG THAY VIỆC XỬ LÝ KỶ LUẬT LAO ĐỘNG; (3) Xử lý kỷ luật hành vi không quy định trong NQLĐ, HĐLĐ hoặc pháp luật.\n"
            . "  - Trình tự xử lý (Điều 23.2): Lập biên bản vi phạm -> Thông báo họp xử lý kỷ luật (có sự tham gia của tổ chức đại diện NLĐ và NLĐ có quyền tự bào chữa/nhờ luật sư) -> Lập biên bản cuộc họp có chữ ký các bên -> Người có thẩm quyền giao kết HĐLĐ ban hành Quyết định xử lý kỷ luật trong thời hiệu.\n\n"
            . "• Điều 24 - 03 Nhóm Hình thức Xử lý Kỷ luật Lao động cụ thể:\n"
            . "  1. Hình thức 1: KHIỂN TRÁCH BẰNG VĂN BẢN và trừ điểm đánh giá Tháng/Quý/Năm (Điều 24.1):\n"
            . "     Áp dụng cho vi phạm lần đầu, chưa gây hậu quả nghiêm trọng (thiệt hại dưới 5.000.000 đồng), bao gồm:\n"
            . "     + Vi phạm Điều 5 (Giờ làm việc, WFH), Điều 13 (Thực hiện công việc), Điều 14 (Đi trễ, về sớm, ra ngoài), Điều 15 (Tác phong, vệ sinh), Điều 16 (Trang phục, đồng phục), Điều 19 (An toàn lao động) và Điều 20 (Sử dụng tài sản);\n"
            . "     + Vi phạm điểm a (hút thuốc), điểm b (uống rượu bia), điểm c (ngồi lê đôi mách, cản trở công việc) tại Điều 17;\n"
            . "     + Đồng phạm, che giấu các hành vi vi phạm quy định của Viện.\n"
            . "  2. Hình thức 2: KÉO DÀI THỜI HẠN NÂNG LƯƠNG (<= 06 tháng) HOẶC CÁCH CHỨC (Điều 24.2):\n"
            . "     + Áp dụng CÁCH CHỨC (Điều 24.2.1): Vi phạm điểm d (trái đạo đức) và điểm e (cưỡng ép, lăng nhục, đe dọa) tại Điều 17; Sử dụng danh nghĩa Viện cho việc riêng; Cản trở giao dịch giữa Viện và khách hàng; Giả mạo giấy xác nhận của Bác sĩ hoặc giấy tờ khác để lừa dối Viện; Lừa đảo khi thực hiện nhiệm vụ.\n"
            . "     + Áp dụng KÉO DÀI THỜI HẠN NÂNG LƯƠNG KHÔNG QUÁ 06 THÁNG (Điều 24.2.2): Tái vi phạm các hành vi tại Khoản 1 Điều 24 trong vòng 01 tháng kể từ ngày bị khiển trách bằng văn bản; Có thái độ khiếm nhã đối với khách hàng, cấp trên; Không tuân thủ quy định an toàn, vệ sinh lao động.\n"
            . "  3. Hình thức 3: SA THẢI (Điều 24.3):\n"
            . "     + NLĐ có hành vi trộm cắp, tham ô, đánh bạc, cố ý gây thương tích, sử dụng ma túy trong phạm vi nơi làm việc, tiết lộ bí mật kinh doanh/công nghệ, xâm phạm quyền sở hữu trí tuệ của Viện, gây thiệt hại nghiêm trọng hoặc đe dọa gây thiệt hại đặc biệt nghiêm trọng về tài sản, lợi ích của Viện;\n"
            . "     + NLĐ bị xử lý kỷ luật kéo dài thời hạn nâng lương hoặc cách chức mà tái phạm trong thời gian chưa xóa kỷ luật;\n"
            . "     + NLĐ tự ý bỏ việc 05 ngày làm việc cộng dồn trong phạm vi 30 ngày (kể từ ngày đầu tiên tự ý bỏ việc) hoặc 20 ngày làm việc cộng dồn trong phạm vi 365 ngày mà không có lý do chính đáng.\n\n"
            . "• Điều 25 (Thời hiệu xử lý kỷ luật) & Điều 26 (Xóa kỷ luật, giảm thời hạn):\n"
            . "  - Thời hiệu xử lý kỷ luật (Điều 25): Tối đa 06 tháng kể từ ngày xảy ra vi phạm; nếu liên quan trực tiếp đến tài chính, tài sản, tiết lộ bí mật công nghệ/kinh doanh thì tối đa 12 tháng (có thể kéo dài thêm không quá 60 ngày khi hết thời gian quy định tại Khoản 4 Điều 122 BLLĐ).\n"
            . "  - Đương nhiên xóa kỷ luật (Điều 26): Sau 03 tháng đối với Khiển trách; sau 06 tháng đối với Kéo dài thời hạn nâng lương; sau 03 năm đối với Cách chức nếu không tiếp tục vi phạm. Nếu chấp hành được 1/2 thời hạn kéo dài nâng lương và tiến bộ thì có thể được xét giảm thời hạn.\n\n"
            . "• Điều 27 - Tạm đình chỉ công việc:\n"
            . "  - Chỉ thực hiện khi vụ việc có tình tiết phức tạp và sau khi tham khảo ý kiến tổ chức đại diện NLĐ tại cơ sở.\n"
            . "  - Thời hạn tạm đình chỉ: Không quá 15 ngày (trường hợp đặc biệt không quá 90 ngày). Trong thời gian tạm đình chỉ, NLĐ được tạm ứng 50% tiền lương trước khi bị đình chỉ.\n"
            . "  - Nếu bị xử lý kỷ luật, NLĐ không phải trả lại số tiền lương đã tạm ứng; nếu không bị xử lý kỷ luật thì được Viện trả đủ tiền lương cho thời gian tạm đình chỉ.\n\n"
            . "• Điều 28 - Trách nhiệm vật chất (Bồi thường thiệt hại & Khiếu nại):\n"
            . "  - Nếu làm hư hỏng dụng cụ, thiết bị do sơ suất gây thiệt hại không nghiêm trọng (giá trị không quá 10 tháng lương tối thiểu vùng) thì phải bồi thường nhiều nhất là 03 tháng tiền lương và khấu trừ hằng tháng vào lương theo Khoản 3 Điều 102 BLLĐ.\n"
            . "  - Nếu làm mất dụng cụ, thiết bị, tài sản hoặc tiêu hao vật tư quá định mức thì bồi thường một phần hoặc toàn bộ theo thời giá thị trường hoặc hợp đồng trách nhiệm (trừ trường hợp bất khả kháng thiên tai, hỏa hoạn, dịch bệnh không thể lường trước).\n"
            . "  - Quyền khiếu nại: NLĐ có quyền khiếu nại với Viện hoặc cơ quan có thẩm quyền theo quy định pháp luật."
    ]
];

$maleUserIds = [100009, 100059, 100067, 100069, 100072, 100074, 100075, 100077, 999906, 999993, 999994, 999998, 1000002, 1000003, 1000004, 1000005];
$femaleUserIds = [1004, 100060, 100061, 100062, 100064, 100065, 100066, 100068, 100070, 100071, 100073, 100076, 100078, 999907, 999992, 999995, 999996, 999997, 999999, 1000000, 1000001, 1000006, 1000007, 1000008];
$maleIdListSql = implode(',', array_map('intval', $maleUserIds));
$femaleIdListSql = implode(',', array_map('intval', $femaleUserIds));
$emptyVector = json_encode([]);

// ============================================================================
// EXECUTION BRANCH 1: PDO ($db)
// ============================================================================
if (isset($db) && $db instanceof PDO) {
    // Step A1: Upsert system_settings
    $settingsToUpsert = [
        'hrm_late_grace_female' => '60',
        'hrm_late_grace_male' => '30',
        'global_work_start_time' => '08:00',
        'global_work_end_time' => '17:00',
    ];
    $stmtSet = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    foreach ($settingsToUpsert as $sKey => $sVal) {
        $stmtSet->execute([$sKey, $sVal]);
    }
    @unlink(sys_get_temp_dir() . DIRECTORY_SEPARATOR . "ideas_system_settings.json");

    // Step A2: Standardize users.gender
    $db->exec("UPDATE users SET gender = 'male' WHERE LOWER(TRIM(COALESCE(gender, ''))) IN ('nam', 'm', 'male')");
    $db->exec("UPDATE users SET gender = 'female' WHERE LOWER(TRIM(COALESCE(gender, ''))) IN ('nữ', 'nu', 'f', 'female')");
    $db->exec("UPDATE users SET gender = 'male' WHERE id IN ({$maleIdListSql}) AND (gender IS NULL OR TRIM(gender) = '' OR gender NOT IN ('male', 'female'))");
    $db->exec("UPDATE users SET gender = 'female' WHERE id IN ({$femaleIdListSql}) AND (gender IS NULL OR TRIM(gender) = '' OR gender NOT IN ('male', 'female'))");
    $db->exec("UPDATE users SET gender = 'female' WHERE (gender IS NULL OR TRIM(gender) = '') AND (full_name LIKE '% Thị %' OR full_name LIKE '% Nữ%' OR full_name LIKE '% Nhi%' OR full_name LIKE '% Linh%' OR full_name LIKE '% Ngân%' OR full_name LIKE '% Trâm%' OR full_name LIKE '% Trân%' OR full_name LIKE '% Thảo%' OR full_name LIKE '% Uyên%' OR full_name LIKE '% Lan%' OR full_name LIKE '% Thoa%' OR full_name LIKE '% Thương%')");
    $db->exec("UPDATE users SET gender = 'male' WHERE (gender IS NULL OR TRIM(gender) = '') AND (full_name LIKE '% Văn %' OR full_name LIKE '% Hoàng %' OR full_name LIKE '% Trọng %' OR full_name LIKE '% Đình %' OR full_name LIKE '% Quốc %')");

    // Step B1: Clean up duplicate folder id=31 ('05. TRƯỜNG KINH DOANH ISTEC PARIS (PHÁP)') & its docs (31, 32, 33, 34) when id=27 already exists
    $chk27 = (int)$db->query("SELECT COUNT(*) FROM ai_training_docs WHERE id = 27")->fetchColumn();
    $chk31 = (int)$db->query("SELECT COUNT(*) FROM ai_training_docs WHERE id = 31 AND name LIKE '%ISTEC PARIS%'")->fetchColumn();
    if ($chk27 > 0 && $chk31 > 0) {
        $db->exec("DELETE FROM ai_training_chunks WHERE doc_id IN (31, 32, 33, 34)");
        $db->exec("DELETE FROM ai_training_docs WHERE id IN (31, 32, 33, 34)");
    }

    // Ensure target folder '08. QUY TRÌNH & QUY CHẾ VẬN HÀNH DOANH NGHIỆP MYERP'
    $fStmt = $db->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND source_type = 'folder' AND tenant_id = 1 LIMIT 1");
    $fStmt->execute([$targetFolderName]);
    $folderId = (int)$fStmt->fetchColumn();
    if (!$folderId) {
        $insF = $db->prepare("INSERT INTO ai_training_docs (tenant_id, name, source_type, parent_id, is_active, status) VALUES (1, ?, 'folder', 0, 1, 'trained')");
        $insF->execute([$targetFolderName]);
        $folderId = (int)$db->lastInsertId();
    }

    // Step B2: Update DOC-01 and DOC-18
    foreach ($updatedExistingDocs as $uDoc) {
        $findStmt = $db->prepare("SELECT id, parent_id FROM ai_training_docs WHERE (id = ? OR name LIKE ?) AND source_type != 'folder' ORDER BY (id = ?) DESC LIMIT 1");
        $findStmt->execute([$uDoc['id_hint'], $uDoc['like_pattern'], $uDoc['id_hint']]);
        $foundRow = $findStmt->fetch(PDO::FETCH_ASSOC);

        if ($foundRow) {
            $docId = (int)$foundRow['id'];
            $pId = ((int)$foundRow['parent_id'] > 0) ? (int)$foundRow['parent_id'] : $folderId;
            $upStmt = $db->prepare("UPDATE ai_training_docs SET name = ?, content = ?, tags = ?, source_type = ?, parent_id = ?, is_active = 1, status = 'trained' WHERE id = ?");
            $upStmt->execute([$uDoc['title'], $uDoc['content'], $uDoc['tags'], $uDoc['source_type'], $pId, $docId]);
        } else {
            $insStmt = $db->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status) VALUES (1, ?, ?, ?, ?, ?, 1, 'trained')");
            $insStmt->execute([$uDoc['title'], $uDoc['content'], $uDoc['tags'], $uDoc['source_type'], $folderId]);
            $docId = (int)$db->lastInsertId();
        }

        $delC = $db->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
        $delC->execute([$docId]);

        $chunks = createTrainingChunks323($uDoc['content']);
        $insC = $db->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, 0.0)");
        foreach ($chunks as $cIdx => $cText) {
            $insC->execute([$docId, $cIdx, $cText, $emptyVector]);
        }
    }

    // Step C: Upsert & Train the 5-Document Suite for QĐ 001 - NỘI QUY LAO ĐỘNG VIỆN IDEAS 2024
    foreach ($nqldDocs as $doc) {
        $dStmt = $db->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND tenant_id = 1 LIMIT 1");
        $dStmt->execute([$doc['title']]);
        $docId = (int)$dStmt->fetchColumn();

        if ($docId) {
            $upDoc = $db->prepare("UPDATE ai_training_docs SET content = ?, tags = ?, source_type = ?, parent_id = ?, is_active = 1, status = 'trained' WHERE id = ?");
            $upDoc->execute([$doc['content'], $doc['tags'], $doc['source_type'], $folderId, $docId]);
        } else {
            $insDoc = $db->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status) VALUES (1, ?, ?, ?, ?, ?, 1, 'trained')");
            $insDoc->execute([$doc['title'], $doc['content'], $doc['tags'], $doc['source_type'], $folderId]);
            $docId = (int)$db->lastInsertId();
        }

        $delChunks = $db->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
        $delChunks->execute([$docId]);

        $chunks = createTrainingChunks323($doc['content']);
        $insChunk = $db->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, 0.0)");
        foreach ($chunks as $cIdx => $cText) {
            $insChunk->execute([$docId, $cIdx, $cText, $emptyVector]);
        }
    }

    // Clear RAG search cache if exists
    try {
        $db->exec("DELETE FROM ai_rag_search_cache");
    } catch (\Throwable $e) {}

    return;
}

// ============================================================================
// EXECUTION BRANCH 2: MySQLi ($conn)
// ============================================================================
if (isset($conn) && $conn instanceof mysqli) {
    // Step A1: Upsert system_settings
    $settingsToUpsert = [
        'hrm_late_grace_female' => '60',
        'hrm_late_grace_male' => '30',
        'global_work_start_time' => '08:00',
        'global_work_end_time' => '17:00',
    ];
    $stmtSet = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    if ($stmtSet) {
        foreach ($settingsToUpsert as $sKey => $sVal) {
            $stmtSet->bind_param("ss", $sKey, $sVal);
            $stmtSet->execute();
        }
        $stmtSet->close();
    }
    @unlink(sys_get_temp_dir() . DIRECTORY_SEPARATOR . "ideas_system_settings.json");

    // Step A2: Standardize users.gender
    $conn->query("UPDATE users SET gender = 'male' WHERE LOWER(TRIM(COALESCE(gender, ''))) IN ('nam', 'm', 'male')");
    $conn->query("UPDATE users SET gender = 'female' WHERE LOWER(TRIM(COALESCE(gender, ''))) IN ('nữ', 'nu', 'f', 'female')");
    $conn->query("UPDATE users SET gender = 'male' WHERE id IN ({$maleIdListSql}) AND (gender IS NULL OR TRIM(gender) = '' OR gender NOT IN ('male', 'female'))");
    $conn->query("UPDATE users SET gender = 'female' WHERE id IN ({$femaleIdListSql}) AND (gender IS NULL OR TRIM(gender) = '' OR gender NOT IN ('male', 'female'))");
    $conn->query("UPDATE users SET gender = 'female' WHERE (gender IS NULL OR TRIM(gender) = '') AND (full_name LIKE '% Thị %' OR full_name LIKE '% Nữ%' OR full_name LIKE '% Nhi%' OR full_name LIKE '% Linh%' OR full_name LIKE '% Ngân%' OR full_name LIKE '% Trâm%' OR full_name LIKE '% Trân%' OR full_name LIKE '% Thảo%' OR full_name LIKE '% Uyên%' OR full_name LIKE '% Lan%' OR full_name LIKE '% Thoa%' OR full_name LIKE '% Thương%')");
    $conn->query("UPDATE users SET gender = 'male' WHERE (gender IS NULL OR TRIM(gender) = '') AND (full_name LIKE '% Văn %' OR full_name LIKE '% Hoàng %' OR full_name LIKE '% Trọng %' OR full_name LIKE '% Đình %' OR full_name LIKE '% Quốc %')");

    // Step B1: Clean up duplicate folder id=31 ('05. TRƯỜNG KINH DOANH ISTEC PARIS (PHÁP)') & its docs (31, 32, 33, 34) when id=27 already exists
    $res27 = $conn->query("SELECT id FROM ai_training_docs WHERE id = 27 LIMIT 1");
    $res31 = $conn->query("SELECT id FROM ai_training_docs WHERE id = 31 AND name LIKE '%ISTEC PARIS%' LIMIT 1");
    if ($res27 && $res27->num_rows > 0 && $res31 && $res31->num_rows > 0) {
        $conn->query("DELETE FROM ai_training_chunks WHERE doc_id IN (31, 32, 33, 34)");
        $conn->query("DELETE FROM ai_training_docs WHERE id IN (31, 32, 33, 34)");
    }

    // Ensure target folder '08. QUY TRÌNH & QUY CHẾ VẬN HÀNH DOANH NGHIỆP MYERP'
    $fStmt = $conn->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND source_type = 'folder' AND tenant_id = 1 LIMIT 1");
    $fStmt->bind_param("s", $targetFolderName);
    $fStmt->execute();
    $fRes = $fStmt->get_result()->fetch_assoc();
    $fStmt->close();

    $folderId = isset($fRes['id']) ? (int)$fRes['id'] : 0;
    if (!$folderId) {
        $insF = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, source_type, parent_id, is_active, status) VALUES (1, ?, 'folder', 0, 1, 'trained')");
        $insF->bind_param("s", $targetFolderName);
        $insF->execute();
        $folderId = (int)$conn->insert_id;
        $insF->close();
    }

    // Step B2: Update DOC-01 and DOC-18
    foreach ($updatedExistingDocs as $uDoc) {
        $findStmt = $conn->prepare("SELECT id, parent_id FROM ai_training_docs WHERE (id = ? OR name LIKE ?) AND source_type != 'folder' ORDER BY (id = ?) DESC LIMIT 1");
        $findStmt->bind_param("isi", $uDoc['id_hint'], $uDoc['like_pattern'], $uDoc['id_hint']);
        $findStmt->execute();
        $foundRow = $findStmt->get_result()->fetch_assoc();
        $findStmt->close();

        if ($foundRow) {
            $docId = (int)$foundRow['id'];
            $pId = ((int)$foundRow['parent_id'] > 0) ? (int)$foundRow['parent_id'] : $folderId;
            $upStmt = $conn->prepare("UPDATE ai_training_docs SET name = ?, content = ?, tags = ?, source_type = ?, parent_id = ?, is_active = 1, status = 'trained' WHERE id = ?");
            $upStmt->bind_param("ssssii", $uDoc['title'], $uDoc['content'], $uDoc['tags'], $uDoc['source_type'], $pId, $docId);
            $upStmt->execute();
            $upStmt->close();
        } else {
            $insStmt = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status) VALUES (1, ?, ?, ?, ?, ?, 1, 'trained')");
            $insStmt->bind_param("ssssi", $uDoc['title'], $uDoc['content'], $uDoc['tags'], $uDoc['source_type'], $folderId);
            $insStmt->execute();
            $docId = (int)$conn->insert_id;
            $insStmt->close();
        }

        $delC = $conn->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
        $delC->bind_param("i", $docId);
        $delC->execute();
        $delC->close();

        $chunks = createTrainingChunks323($uDoc['content']);
        $insC = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, 0.0)");
        foreach ($chunks as $cIdx => $cText) {
            $insC->bind_param("iiss", $docId, $cIdx, $cText, $emptyVector);
            $insC->execute();
        }
        $insC->close();
    }

    // Step C: Upsert & Train the 5-Document Suite for QĐ 001 - NỘI QUY LAO ĐỘNG VIỆN IDEAS 2024
    foreach ($nqldDocs as $doc) {
        $dStmt = $conn->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND tenant_id = 1 LIMIT 1");
        $dStmt->bind_param("s", $doc['title']);
        $dStmt->execute();
        $dRes = $dStmt->get_result()->fetch_assoc();
        $dStmt->close();

        $docId = isset($dRes['id']) ? (int)$dRes['id'] : 0;
        if ($docId) {
            $upDoc = $conn->prepare("UPDATE ai_training_docs SET content = ?, tags = ?, source_type = ?, parent_id = ?, is_active = 1, status = 'trained' WHERE id = ?");
            $upDoc->bind_param("sssii", $doc['content'], $doc['tags'], $doc['source_type'], $folderId, $docId);
            $upDoc->execute();
            $upDoc->close();
        } else {
            $insDoc = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status) VALUES (1, ?, ?, ?, ?, ?, 1, 'trained')");
            $insDoc->bind_param("ssssi", $doc['title'], $doc['content'], $doc['tags'], $doc['source_type'], $folderId);
            $insDoc->execute();
            $docId = (int)$conn->insert_id;
            $insDoc->close();
        }

        $delChunks = $conn->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
        $delChunks->bind_param("i", $docId);
        $delChunks->execute();
        $delChunks->close();

        $chunks = createTrainingChunks323($doc['content']);
        $insChunk = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, 0.0)");
        foreach ($chunks as $cIdx => $cText) {
            $insChunk->bind_param("iiss", $docId, $cIdx, $cText, $emptyVector);
            $insChunk->execute();
        }
        $insChunk->close();
    }

    // Clear RAG search cache if exists
    try {
        $conn->query("DELETE FROM ai_rag_search_cache");
    } catch (\Throwable $e) {}
}
