<?php
// backend/migrations/317_seed_and_train_rag_ideas_knowledge.php
// Tự động chuẩn hóa và nạp dữ liệu tri thức đào tạo RAG (ai_training_docs & ai_training_chunks)
// Bao gồm: Hành trình 15 năm IDEAS, Hệ sinh thái LMS 4.0, Biểu phí chính thức Swiss UMEF (CHF) & Đối tác, Cẩm nang 12 tình huống sale

$folderName = 'Kiến Thức Cốt Lõi Viện IDEAS & Hệ Sinh Thái LMS 4.0';

$trainingDocs = [
    [
        'title' => 'IDEAS – Hành trình 15 năm kết nối giáo dục toàn cầu & Định vị Học thuật',
        'source_type' => 'manual',
        'tags' => 'ideas, 15_nam, gioi_thieu, su_menh, tri_thuc_nguyen_ban_dong_hanh_ban_dia, doi_ngu, 2500_cuu_hoc_vien, 74_khoa',
        'content' => "IDEAS – HÀNH TRÌNH 15 NĂM KẾT NỐI GIÁO DỤC TOÀN CẦU (THÀNH LẬP TỪ 2011)\n\n"
            . "1. TỔNG QUAN & LỊCH SỬ HÌNH THÀNH:\n"
            . "Viện IDEAS là đơn vị hỗ trợ giáo dục uy tín với hơn 15 năm kinh nghiệm thực chiến (thành lập từ năm 2011), đồng hành cùng hơn 2.500 Thạc sĩ và Tiến sĩ tốt nghiệp thành công qua 74 khóa đào tạo liên tục. IDEAS giúp học viên Việt Nam theo học các chương trình Cử nhân, Thạc sĩ (MBA, EMBA, MSc AI) và Tiến sĩ (DBA) tại các trường đại học quốc tế danh tiếng của Thụy Sĩ, Pháp, Anh và Mỹ.\n\n"
            . "2. ĐỊNH VỊ VÀ SỨ MỆNH:\n"
            . "IDEAS là ĐỐI TÁC HỖ TRỢ HỌC THUẬT TOÀN DIỆN (Academic Support Partner), KHÔNG trực tiếp cấp bằng hay thay thế trường đại học. Sứ mệnh của IDEAS là đồng hành giúp học viên Việt Nam giải quyết mọi rào cản về ngôn ngữ, thời gian, phương pháp học thông qua hệ sinh thái hỗ trợ học thuật trên chuẩn nền giáo dục quốc tế và hệ thống bổ trợ chuyên sâu cuối tuần.\n\n"
            . "3. SLOGAN THƯƠNG HIỆU & GIÁ TRỊ CỐT LÕI:\n"
            . "\"Tri thức Nguyên bản - Đồng hành Bản địa\" (Original Knowledge - Localized Mentorship). Chương trình giữ nguyên 100% giáo trình, chuẩn kiểm định và giảng viên quốc tế, kết hợp đội ngũ cố vấn học vụ tại Việt Nam để bản địa hóa phương pháp tiếp thu.\n\n"
            . "4. ĐỘI NGŨ CỐ VẤN HỌC THUẬT:\n"
            . "Hơn 30 chuyên gia cố vấn học thuật, giáo sư, tiến sĩ, và giảng viên cao cấp trong nước và quốc tế, giàu kinh nghiệm thực tiễn quản trị doanh nghiệp và nghiên cứu hàn lâm.\n\n"
            . "5. GIẢI QUYẾT TRIỆT ĐỂ 6 RÀO CẢN HỌC TRỰC TUYẾN QUỐC TẾ:\n"
            . "- Rào cản Ngoại ngữ: IDEAS AI Platform giải thích thuật ngữ tức thì + Lớp Chủ Nhật tiếng Việt.\n"
            . "- Rào cản Thời gian: LMS Moodle 24/7 linh hoạt mọi lúc mọi nơi + Chương trình EMBA 10 môn không làm luận văn.\n"
            . "- Rào cản Phương pháp nghiên cứu Châu Âu: Cố vấn học thuật 1-1 + Hội đồng thẩm định Final Draft Review.\n"
            . "- Rào cản Thiếu tài liệu: Thư viện số Cengage Learning miễn phí 1.000+ đầu sách học thuật bản quyền.\n"
            . "- Rào cản Động lực học từ xa: Quản lý lớp đồng hành, nhắc nhở deadline tự động, diễn đàn kết nối cộng đồng học viên.\n"
            . "- Rào cản Áp dụng vào thực tế: Workshop chuyên đề cùng CEO, chuyên gia đầu ngành giải mã tình huống doanh nghiệp Việt Nam."
    ],
    [
        'title' => 'Hệ thống Hỗ trợ Học tập LMS & Hệ sinh thái Số 4.0 IDEAS',
        'source_type' => 'web',
        'tags' => 'he_thong_lms, moodle, ideas_ai_platform, cengage, workshop_cuoi_tuan, ho_tro_hoc_tap, he_sinh_thai_so, eacademy',
        'content' => "HỆ THỐNG HỖ TRỢ HỌC TẬP LMS & HỆ SINH THÁI HỌC TẬP SỐ TOÀN DIỆN IDEAS (https://ideas.edu.vn/he-thong-ho-tro-hoc-tap-lms-ideas)\n\n"
            . "1. CHỈ SỐ NỔI BẬT:\n"
            . "- 24/7 Học tập chủ động: Học viên hoàn toàn chủ động thời gian học tập, không bị gò bó lịch trình công việc.\n"
            . "- 1.000+ Tài liệu Cengage: Truy cập kho sách học thuật chuyên ngành Kinh tế, Quản trị bản quyền toàn cầu.\n"
            . "- 100% Bổ trợ tiếng Việt: Các buổi bổ trợ chuyên đề cuối tuần cùng giảng viên, chuyên gia đầu ngành.\n\n"
            . "2. BỐN TRỤ CỘT HỌC THUẬT CỐT LÕI:\n\n"
            . "Trụ cột 1: LMS Powered by Moodle (Nền tảng quản lý học tập quốc tế)\n"
            . "Moodle là hệ thống quản lý học tập phổ biến hàng đầu thế giới được sử dụng bởi các đại học danh tiếng. Tại IDEAS, Moodle được cấu hình thông minh và trực quan hóa tối đa:\n"
            . "+ Xem video bài giảng ghi hình chất lượng cao mọi lúc mọi nơi.\n"
            . "+ Tải tài liệu học tập, giáo trình, slide bài giảng trực tiếp.\n"
            . "+ Nộp bài tập, theo dõi điểm số và nhận feedback trực tiếp từ giảng viên quốc tế.\n"
            . "+ Diễn đàn trao đổi thảo luận giữa các học viên và ban học vụ.\n\n"
            . "Trụ cột 2: IDEAS AI Platform (Trợ lý học thuật 4.0 - Độc quyền tại IDEAS)\n"
            . "Nền tảng trợ lý trí tuệ nhân tạo chuyên biệt được phát triển dưới sự kiểm duyệt chuyên môn của IDEAS, tích hợp các mô hình ngôn ngữ lớn (LLM) tinh chỉnh chuyên sâu cho sau đại học:\n"
            . "+ Giải đáp học thuật tức thì: Hỗ trợ làm rõ các khái niệm, thuật ngữ quản trị, kinh tế, tài chính phức tạp bằng tiếng Việt chỉ trong vài giây.\n"
            . "+ Nghiên cứu tài liệu: Tóm tắt nội dung tài liệu tham khảo dài hàng trăm trang nhanh chóng.\n"
            . "+ Gợi ý hướng nghiên cứu & cấu trúc đề án: Hỗ trợ lập khung đề tài và phương pháp nghiên cứu luận văn tốt nghiệp (Capstone/Thesis scaffolding).\n"
            . "+ Cá nhân hóa lộ trình: Đóng vai trò như gia sư công nghệ 24/7 đồng hành mọi lúc mọi nơi, giải tỏa áp lực tự học, đảm bảo bảo mật thông tin tài nguyên. Đăng ký trải nghiệm tại: /dang-ky-tai-khoan-ai.\n\n"
            . "Trụ cột 3: Thư viện số Cengage Learning (Global Digital Library)\n"
            . "Cengage Learning là một trong những nhà xuất bản giáo dục lớn nhất thế giới. Học viên IDEAS được cấp quyền truy cập miễn phí vào kho tàng tri thức số khổng lồ:\n"
            . "+ Hơn 1.000+ đầu sách học thuật nguyên bản tiếng Anh chuyên ngành Kinh tế, Quản trị, Marketing, Tài chính.\n"
            . "+ Các giáo trình cập nhật mới nhất phục vụ trực tiếp cho các môn học MBA, EMBA, DBA.\n"
            . "+ Đọc trực tuyến dễ dàng trên máy tính, máy tính bảng và điện thoại di động.\n\n"
            . "Trụ cột 4: Lớp chuyên đề bổ trợ cuối tuần (Bilingual Weekend Support Workshops)\n"
            . "+ Các buổi chuyên đề cuối tuần cùng giảng viên và chuyên gia đầu ngành.\n"
            . "+ Phân tích cấu trúc bài tập và đề thi, giải tỏa các thắc mắc học vụ.\n"
            . "+ Hướng dẫn phương pháp làm bài luận chuẩn Châu Âu, thẩm định bản thảo trước khi nộp để hạn chế rủi ro trượt môn do lạc đề.\n"
            . "+ Kết nối tri thức quốc tế MBA với thực tiễn môi trường doanh nghiệp tại Việt Nam."
    ],
    [
        'title' => 'Biểu phí & Các chương trình Đào tạo Quốc tế Swiss UMEF & Đối tác',
        'source_type' => 'manual',
        'tags' => 'hoc_phi, swiss_umef, istec_paris, mba, emba, mscai, mbainai, bba, dba, chf, eur, bang_gia, chuong_trinh_dao_tao',
        'content' => "BIỂU PHÍ CHÍNH THỨC & THÔNG TIN CÁC CHƯƠNG TRÌNH ĐÀO TẠO QUỐC TẾ TẠI IDEAS\n\n"
            . "1. ĐỐI TÁC CHIẾN LƯỢC: SWISS UMEF (GENEVA, THỤY SĨ - THÀNH LẬP 1984)\n"
            . "Kiểm định liên bang Thụy Sĩ SAC (Swiss Accreditation Council), Swiss ENIC, VN-NARIC (Bộ GD&ĐT), ACBSP, CHEA, EDUQUA, IACBE, QS Stars 5 Stars Overall.\n\n"
            . "Biểu phí chính thức công bố tại website IDEAS:\n"
            . "+ Online MBA (Thạc sĩ QTKD Trực tuyến): 12.900 CHF (https://ideas.edu.vn/mba)\n"
            . "  - Thời lượng: 16-18 tháng | 90 ECTS (12 môn + Luận văn tốt nghiệp MBA Thesis bắt buộc).\n"
            . "  - Phù hợp: Quản lý, chuyên viên, người định hướng nghiên cứu, giảng dạy hoặc định cư quốc tế.\n"
            . "+ Executive MBA (EMBA - Thạc sĩ Điều hành QTKD): 12.900 CHF (https://ideas.edu.vn/emba)\n"
            . "  - Thời lượng: 12-14 tháng | 60 ECTS (10 môn thực chiến, HOÀN TOÀN KHÔNG LÀM LUẬN VĂN).\n"
            . "  - Phù hợp: Giám đốc, Founder, Quản lý cấp cao bận rộn; học nhanh nhất, áp dụng ngay vào quản trị doanh nghiệp; đủ điều kiện học tiếp lên Tiến sĩ (DBA).\n"
            . "+ Master AI - MSc Applied AI (Thạc sĩ AI Ứng dụng): 12.900 CHF (https://ideas.edu.vn/mscai)\n"
            . "  - Thời lượng: 16-18 tháng | 90 ECTS (12 môn + Capstone Project).\n"
            . "  - Phù hợp: Lãnh đạo định hướng ứng dụng AI vào tối ưu hóa vận hành doanh nghiệp. KHÔNG CẦN BIẾT LẬP TRÌNH.\n"
            . "+ MBA in AI (Thạc sĩ QTKD Ứng dụng AI): 10.970 CHF (https://ideas.edu.vn/mbainai)\n"
            . "  - Thời lượng: 14-16 tháng | Kết hợp quản trị kinh doanh chiến lược và công nghệ AI.\n"
            . "+ Global Online BBA (Cử nhân QTKD Quốc tế): 13.500 CHF (https://ideas.edu.vn/bba)\n"
            . "  - Đầu tư thông minh cho Cử nhân Quốc tế Thụy Sĩ.\n"
            . "+ Top-up BBA & Pre Top-up: Liên thông Cử nhân quốc tế 12 tháng cho người tốt nghiệp CĐ hoặc sinh viên hoàn thành năm 2-3 ĐH.\n"
            . "+ Hệ đào tạo Swiss UMEF:\n"
            . "  - Hệ Standard: Tối ưu chi phí, tự học qua LMS Moodle, Video, Lớp Chủ Nhật tiếng Việt và IDEAS AI Platform.\n"
            . "  - Hệ High Quality (HQ): Tương tác trực tiếp (Live) với giảng viên Thụy Sĩ, ĐẶC BIỆT bao gồm 2 chuyến đi Thụy Sĩ (Study Trip + Lễ tốt nghiệp).\n\n"
            . "2. ĐỐI TÁC CHIẾN LƯỢC: TRƯỜNG KINH DOANH ISTEC PARIS (PHÁP - THÀNH LẬP 1961)\n"
            . "Hơn 60 năm lịch sử, thuộc hệ thống Grande École danh giá, Bộ GDĐH Pháp công nhận, CGE, EFMD, AACSB, Top 8 Le Parisien, RNCP Level 7 & Level 8 (EQF Level 8 cao nhất Châu Âu), WES Earned Doctorate tại Mỹ & Canada.\n"
            . "+ MBA ISTEC Paris (Leadership & Business Transformation): 14-16 tháng, 60 ECTS, chuẩn Pháp RNCP Level 7 (Bac+5). Học phí công bố 8.500 EUR, ưu đãi độc quyền qua IDEAS chỉ còn 6.500 EUR + 200 EUR lệ phí hồ sơ.\n"
            . "+ DBA ISTEC Paris (Tiến sĩ Quản trị Kinh doanh): 03 năm chính quy, 180 ECTS, chuẩn Pro - Bac+8 / EQF Level 8, WES Earned Doctorate (Mỹ & Canada). Học phí trọn gói 13.000 EUR (đã bao gồm học phí 3 năm, hướng dẫn 1:1 Giáo sư quốc tế, AI Copilot 24/7 và hỗ trợ độc quyền từ IDEAS).\n\n"
            . "3. CHƯƠNG TRÌNH DUAL DBA ESTIAM (PHÁP) & RB COLLEGE (ANH):\n"
            . "+ Thời lượng: 2.5 - 4 năm. Học phí 12.500 EUR (giảm 3.000 EUR còn 9.500 EUR cho cựu học viên IDEAS), Hội đồng chuyên môn Viện IDEAS thực hiện Final Draft Review hỗ trợ hướng đi luận án.\n\n"
            . "4. PHÁP LÝ & CÔNG NHẬN VĂN BẰNG TẠI VIỆT NAM:\n"
            . "+ Chương trình Online 100% chưa thuộc diện công nhận văn bằng cho thi công chức/viên chức nhà nước, nhưng có giá trị thực tế cực lớn tại khối Doanh nghiệp Tư nhân & Tập đoàn đa quốc gia.\n"
            . "+ Nếu bắt buộc cần công nhận tại VN: học viên tham gia học kết hợp 70% trực tiếp tại Thụy Sĩ – 30% online."
    ],
    [
        'title' => 'Cẩm nang 12 tình huống tư vấn thực chiến cho tư vấn viên tuyển sinh (Sales Cases)',
        'source_type' => 'manual',
        'tags' => 'cam_nang_sale, 12_tinh_huong, tu_van, xu_ly_tu_choi, dac_cach_emba, topup_bba, thi_cong_chuc, mba_thesis',
        'content' => "CẨM NANG 12 TÌNH HUỐNG TƯ VẤN THỰC CHIẾN DÀNH CHO TƯ VẤN VIÊN TUYỂN SINH IDEAS\n\n"
            . "Tình huống 1: Khách tốt nghiệp Cao đẳng 3 năm + có từ 5 năm kinh nghiệm quản lý:\n"
            . "-> Đủ điều kiện xét đặc cách học EMBA Swiss UMEF (10 môn, 12-14 tháng, không làm luận văn). IDEAS hỗ trợ làm hồ sơ xin trường thẩm định phê duyệt.\n\n"
            . "Tình huống 2: Khách tốt nghiệp Cao đẳng 2 năm:\n"
            . "-> Tư vấn học chương trình Top-up BBA 1 năm lấy bằng Cử nhân Thụy Sĩ trước khi học lên Thạc sĩ (nếu tốt nghiệp trái ngành cần có từ 3 năm kinh nghiệm làm việc liên quan).\n\n"
            . "Tình huống 3: Khách có nhu cầu thi công chức, nâng ngạch viên chức nhà nước:\n"
            . "-> Giải thích minh bạch: Bằng Online 100% hiện chưa thuộc diện công nhận VN-NARIC cho thi công chức; giải pháp chuyển hướng sang hệ kết hợp 70% học trực tiếp tại Thụy Sĩ - 30% Online.\n\n"
            . "Tình huống 4: Giám đốc / Founder bận rộn, e ngại làm luận văn tốt nghiệp:\n"
            . "-> Hướng sang chương trình EMBA (Executive MBA): 10 môn học thực chiến, hoàn toàn KHÔNG LÀM LUẬN VĂN, học buổi tối và tự học linh hoạt qua LMS Moodle.\n\n"
            . "Tình huống 5: Khách muốn học AI nhưng lo ngại không có nền tảng công nghệ thông tin:\n"
            . "-> Khẳng định chương trình Master AI (MSc Applied AI) tập trung vào tư duy chiến lược ứng dụng AI vào quản trị & tự động hóa doanh nghiệp, HOÀN TOÀN KHÔNG YÊU CẦU BIẾT LẬP TRÌNH.\n\n"
            . "Tình huống 6: Khách tiếng Anh yếu, e ngại không theo kịp chương trình:\n"
            . "-> An tâm: Hệ Standard có IDEAS AI Platform dịch & giải nghĩa thuật ngữ tức thì + Lớp Chủ Nhật tiếng Việt củng cố kiến thức, phỏng vấn đầu vào thân thiện theo chuẩn đánh giá năng lực.\n\n"
            . "Tình huống 7: Khách muốn dẫn người thân cùng sang Thụy Sĩ dự lễ tốt nghiệp:\n"
            . "-> Hệ High Quality (HQ) có sẵn 2 chuyến đi Thụy Sĩ (bao gồm khách sạn, đưa đón tại Thụy Sĩ). IDEAS hỗ trợ cấp thư mời xin Visa Châu Âu cho người thân (chi phí cá nhân và vé bay người thân tự túc).\n\n"
            . "Tình huống 8: Cựu học viên IDEAS muốn học tiếp lên Tiến sĩ DBA:\n"
            . "-> Học phí DBA 12.500 EUR, ưu đãi độc quyền giảm 3.000 EUR còn 9.500 EUR cho cựu học viên, kèm sự đồng hành của Hội đồng chuyên môn IDEAS thẩm định Final Draft Review.\n\n"
            . "Tình huống 9: Học viên bận công tác đột xuất trễ hạn nộp bài:\n"
            . "-> Báo Trợ lý chương trình IDEAS hướng dẫn làm đơn xin gia hạn với lý do chính đáng gửi ban học vụ trường.\n\n"
            . "Tình huống 10: Khách đã học dở dang Thạc sĩ tại trường khác muốn chuyển điểm:\n"
            . "-> Hỗ trợ chuyển đổi tối đa 50% tín chỉ sau khi Hội đồng thẩm định hồ sơ bảng điểm gốc.\n\n"
            . "Tình huống 11: Khách muốn chia đợt đóng học phí linh hoạt:\n"
            . "-> Cho phép chia 2-3 đợt theo kỳ học, tạo đơn SO mốc thanh toán cụ thể trong hệ thống ERP.\n\n"
            . "Tình huống 12: Khách cần nộp hồ sơ gấp trước hạn chót:\n"
            . "-> Ưu tiên nộp trước Bằng tốt nghiệp + CV + CCCD để giữ chỉ tiêu, các giấy tờ công chứng và hồ sơ dịch thuật bổ sung sau."
    ]
];

// Helper chunking function: splits text into coherent chunks of ~500-700 chars
function createTrainingChunks(string $text, int $chunkSize = 650, int $overlap = 120): array {
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
                // create overlap from the tail of current chunk
                $words = explode(' ', $currentChunk);
                $tailWords = array_slice($words, -15);
                $currentChunk = implode(' ', $tailWords) . "\n\n" . $para;
            } else {
                // Para itself is larger than chunkSize, break by sentences or length
                $subChunks = str_split($para, $chunkSize);
                foreach ($subChunks as $sc) {
                    $chunks[] = trim($sc);
                }
                $currentChunk = '';
            }
        }
    }

    if (!empty($currentChunk)) {
        $chunks[] = trim($currentChunk);
    }

    return array_values(array_filter($chunks, function($c) { return mb_strlen(trim($c)) >= 30; }));
}

// EXECUTION: PDO or MySQLi
$emptyVector = json_encode([]);

if (isset($db) && $db instanceof PDO) {
    // 1. Ensure Folder
    $fStmt = $db->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND source_type = 'folder' AND tenant_id = 1 LIMIT 1");
    $fStmt->execute([$folderName]);
    $folderId = $fStmt->fetchColumn();

    if (!$folderId) {
        $insF = $db->prepare("INSERT INTO ai_training_docs (tenant_id, name, source_type, parent_id, is_active, status) VALUES (1, ?, 'folder', 0, 1, 'trained')");
        $insF->execute([$folderName]);
        $folderId = (int)$db->lastInsertId();
    }

    // 2. Insert/Update Documents & Chunks
    foreach ($trainingDocs as $doc) {
        $dStmt = $db->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND tenant_id = 1 LIMIT 1");
        $dStmt->execute([$doc['title']]);
        $docId = $dStmt->fetchColumn();

        if ($docId) {
            $upDoc = $db->prepare("UPDATE ai_training_docs SET content = ?, tags = ?, source_type = ?, parent_id = ?, is_active = 1, status = 'trained' WHERE id = ?");
            $upDoc->execute([$doc['content'], $doc['tags'], $doc['source_type'], $folderId, $docId]);
        } else {
            $insDoc = $db->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status) VALUES (1, ?, ?, ?, ?, ?, 1, 'trained')");
            $insDoc->execute([$doc['title'], $doc['content'], $doc['tags'], $doc['source_type'], $folderId]);
            $docId = (int)$db->lastInsertId();
        }

        // Delete old chunks
        $delChunks = $db->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
        $delChunks->execute([$docId]);

        // Create new chunks
        $chunks = createTrainingChunks($doc['content']);
        $insChunk = $db->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, 0.0)");
        foreach ($chunks as $cIdx => $cText) {
            $insChunk->execute([$docId, $cIdx, $cText, $emptyVector]);
        }
    }
    return;
}

if (isset($conn) && $conn instanceof mysqli) {
    // 1. Ensure Folder
    $fStmt = $conn->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND source_type = 'folder' AND tenant_id = 1 LIMIT 1");
    $fStmt->bind_param("s", $folderName);
    $fStmt->execute();
    $fRes = $fStmt->get_result()->fetch_assoc();
    $fStmt->close();

    $folderId = $fRes['id'] ?? null;
    if (!$folderId) {
        $insF = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, source_type, parent_id, is_active, status) VALUES (1, ?, 'folder', 0, 1, 'trained')");
        $insF->bind_param("s", $folderName);
        $insF->execute();
        $folderId = $conn->insert_id;
        $insF->close();
    }

    // 2. Insert/Update Documents & Chunks
    foreach ($trainingDocs as $doc) {
        $dStmt = $conn->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND tenant_id = 1 LIMIT 1");
        $dStmt->bind_param("s", $doc['title']);
        $dStmt->execute();
        $dRes = $dStmt->get_result()->fetch_assoc();
        $dStmt->close();

        $docId = $dRes['id'] ?? null;
        if ($docId) {
            $upDoc = $conn->prepare("UPDATE ai_training_docs SET content = ?, tags = ?, source_type = ?, parent_id = ?, is_active = 1, status = 'trained' WHERE id = ?");
            $upDoc->bind_param("sssii", $doc['content'], $doc['tags'], $doc['source_type'], $folderId, $docId);
            $upDoc->execute();
            $upDoc->close();
        } else {
            $insDoc = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status) VALUES (1, ?, ?, ?, ?, ?, 1, 'trained')");
            $insDoc->bind_param("ssssi", $doc['title'], $doc['content'], $doc['tags'], $doc['source_type'], $folderId);
            $insDoc->execute();
            $docId = $conn->insert_id;
            $insDoc->close();
        }

        // Delete old chunks
        $delChunks = $conn->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
        $delChunks->bind_param("i", $docId);
        $delChunks->execute();
        $delChunks->close();

        // Create new chunks
        $chunks = createTrainingChunks($doc['content']);
        $insChunk = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (1, ?, ?, ?, ?, 0.0)");
        foreach ($chunks as $cIdx => $cText) {
            $insChunk->bind_param("iiss", $docId, $cIdx, $cText, $emptyVector);
            $insChunk->execute();
        }
        $insChunk->close();
    }
}
