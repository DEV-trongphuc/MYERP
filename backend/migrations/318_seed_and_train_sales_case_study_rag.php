<?php
// backend/migrations/318_seed_and_train_sales_case_study_rag.php
// Tự động chuẩn hóa và nạp dữ liệu tri thức đào tạo RAG (ai_training_docs & ai_training_chunks)
// Chuyên đề: Cẩm nang Sales Case Study - Xử lý từ chối Học phí MSc AI & Lộ trình Du học MBA (Úc, Canada, Mỹ CSU Fullerton)

$folderName = 'Kiến Thức Cốt Lõi Viện IDEAS & Hệ Sinh Thái LMS 4.0';

$docTitle = 'DOC-20: Cẩm nang Sales Xử lý từ chối Học phí MSc AI & Lộ trình Du học MBA (Úc, Canada, CSU Fullerton Mỹ)';
$docTags = 'sale_case_study, xu_ly_tu_choi, hoc_phi_cao_qua, msc_ai_hoc_phi_online, hoc_live_vs_tu_hoc, swiss_umef, topup_bba, du_hoc_mba, canada, uc_australia, swinburne, thompson_rivers, csu_fullerton, cal_state_fullerton, danh_gia_iee_wes, calculus_statistics, song_bang_bba_emba, transfer_tin_chi';

$docContent = "CẨM NANG SALES CASE STUDY & XỬ LÝ TÌNH HUỐNG TƯ VẤN TUYỂN SINH VIỆN IDEAS\n\n"
    . "================================================================================\n"
    . "PHẦN 1: XỬ LÝ PHẢN ĐỐI HỌC PHÍ CAO (CHƯƠNG TRÌNH THẠC SĨ AI - MSc APPLIED AI)\n"
    . "================================================================================\n"
    . "• TÌNH HUỐNG / CÂU HỎI CỦA HỌC VIÊN:\n"
    . "\"Học phí bên em cao quá, chương trình online mà cao như vầy?\"\n\n"
    . "• KỊCH BẢN PHẢN HỒI CHUẨN TỪ TƯ VẤN VIÊN / AI AGENT:\n"
    . "\"Dạ em hiểu góc nhìn của anh/chị ạ, vì với chương trình thạc sĩ thì học phí luôn là yếu tố mình cân nhắc rất nhiều.\n"
    . "Thực ra chương trình Master of Science in Applied AI (MSc AI) bên em không phải dạng học online tự học 100% qua video thu sẵn ạ, mà là học LIVE TRỰC TIẾP với giảng viên quốc tế mỗi tuần 2 buổi tối, học liên tục theo lộ trình chuẩn quốc tế của chương trình Master of Science.\n\n"
    . "Điểm khác biệt vượt trội là học viên sẽ được:\n"
    . "1. Học trực tiếp với giảng viên quốc tế (có tương tác, hỏi đáp real-time, giải đáp thắc mắc chuyên sâu).\n"
    . "2. Làm project ứng dụng AI vào bài toán kinh doanh thực tế của chính doanh nghiệp học viên đang công tác.\n"
    . "3. Nhận bằng Master of Science chuẩn quốc tế (cấp bởi Đại học Swiss UMEF Thụy Sĩ, có kiểm định danh giá).\n"
    . "Chính vì sự đồng hành trực tiếp và giá trị bằng cấp thực chất nên chi phí sẽ khác biệt hoàn toàn so với các khóa học online dạng video quay sẵn trên thị trường ạ.\n\n"
    . "Ngoài ra, chương trình cũng có sự linh động về hình thức học để giúp học viên tối ưu chi phí hơn:\n"
    . "-> Nếu anh/chị muốn tiết kiệm ngân sách, mình có thể đăng ký hình thức học Online tự học qua video hệ thống (hệ Standard), chi phí sẽ nhẹ hơn rất nhiều mà vẫn nhận trọn vẹn giáo trình và bằng cấp chuẩn quốc tế ạ.\"\n\n"
    . "================================================================================\n"
    . "PHẦN 2: LỘ TRÌNH CHUYỂN TIẾP DU HỌC MBA TẠI CANADA HOẶC ÚC SAU KHI HỌC TOP-UP BBA\n"
    . "================================================================================\n"
    . "• TÌNH HUỐNG / CÂU HỎI CỦA HỌC VIÊN:\n"
    . "\"Học Topup BBA của Swiss UMEF chỉ có 1 năm thì có thể qua Canada hay Úc học MBA học offline được không?\"\n\n"
    . "• KỊCH BẢN PHẢN HỒI CHUẨN:\n"
    . "\"Bằng Top-up BBA của Swiss UMEF là bằng Cử nhân hợp lệ, được công nhận quốc tế (Swiss UMEF là trường đại học uy tín tại Geneva, Thụy Sỹ, bằng cấp châu Âu chuẩn 60 ECTS).\n\n"
    . "Tuy nhiên, khi xét tuyển vào chương trình MBA quốc tế (ví dụ Đại học Swinburne tại Úc hoặc Thompson Rivers University tại Canada), hội đồng tuyển sinh các trường sẽ không chỉ nhìn vào thời gian học Top-up 1 năm, mà họ sẽ xem xét TOÀN BỘ LỘ TRÌNH HỌC TẬP SAU THPT (Cao đẳng 2-3 năm + Top-up 1 năm = tổng 3-4 năm tích lũy học thuật).\n"
    . "Bạn cần nộp kèm tất cả văn bằng và bảng điểm (cả bằng Cao đẳng/Đại học trước đó và bằng BBA Swiss UMEF).\n\n"
    . "Phần lớn các trường quốc tế tại Canada và Úc vẫn chấp nhận hồ sơ, với các điều kiện cốt lõi:\n"
    . "1. Tổng thời gian học tập sau THPT đạt tối thiểu 3 năm.\n"
    . "2. Bằng Top-up phải hợp lệ, trường đào tạo được công nhận chính thức (Swiss UMEF được kiểm định SAC, EduQua, ACBSP).\n"
    . "3. Ứng viên có đủ nền tảng học thuật và năng lực tiếng Anh để vào chương trình MBA.\n\n"
    . "LƯU Ý NGHIỆP VỤ:\n"
    . "Mỗi trường và mỗi bang/khu vực sẽ có chính sách riêng. Một số trường yêu cầu học viên có kinh nghiệm làm việc chuyên môn từ 2-3 năm, hoặc họ sẽ thẩm định theo diện 'case-by-case' (xét duyệt từng bộ hồ sơ cụ thể).\n"
    . "Để đảm bảo chắc chắn 100%, tư vấn viên hướng dẫn học viên:\n"
    . "- Tra cứu kỹ phần yêu cầu đầu vào ('Entry Requirements' hoặc 'Admission Requirements' for MBA) trên cổng thông tin trường mục tiêu.\n"
    . "- Chủ động gửi thư xác nhận đến International Office / Admissions Office của trường với nội dung: 'Tôi có bằng Cao đẳng chuyên ngành..., đã học tiếp 1 năm lấy bằng BBA của Swiss UMEF Thụy Sĩ (Top-up), tổng thời gian học sau THPT là 3-4 năm. Tôi có đủ điều kiện nộp hồ sơ xét tuyển chương trình MBA của trường hay không?'\"\n\n"
    . "================================================================================\n"
    . "PHẦN 3: LỘ TRÌNH CHUYỂN TIẾP HỌC MBA TẠI CALIFORNIA STATE UNIVERSITY, FULLERTON (CSU FULLERTON - MỸ)\n"
    . "================================================================================\n"
    . "• TÌNH HUỐNG / CÂU HỎI CỦA HỌC VIÊN:\n"
    . "\"Muốn học thêm Topup BBA của Swiss UMEF để sau này học MBA tại California State University, Fullerton\"\n\n"
    . "• KỊCH BẢN PHẢN HỒI CHUẨN & QUY ĐỊNH TUYỂN SINH CSU FULLERTON:\n"
    . "Đối với trường Đại học Bang California, Fullerton (California State University, Fullerton - CSU Fullerton, Mỹ), quy trình xét hồ sơ nhập học MBA có các tiêu chuẩn học thuật rất khắt khe:\n"
    . "1. Yêu cầu Văn bằng Cử nhân 4 năm:\n"
    . "   - Trường yêu cầu bằng Cử nhân hệ đào tạo 4 năm. Nếu học viên mới chỉ hoàn thành hệ 3 năm thì bắt buộc phải học bổ sung thêm các khóa học sau đại học hoặc văn bằng 2 để đủ chuẩn thời lượng tương đương 4 năm của Mỹ.\n"
    . "2. Thẩm định bảng điểm qua tổ chức kiểm định quốc tế (IEE / WES):\n"
    . "   - Bảng điểm các hệ cử nhân đã học có thể phải thẩm định tương đương qua IEE hoặc WES. Về phần này, học viên hoàn toàn an tâm: cả IEE và WES đều thẩm định bằng Swiss UMEF chuẩn xác, hợp lệ (trước đây đã có học viên của IDEAS thẩm định thành công bằng Master của Swiss UMEF qua IEE và được các trường tại Mỹ chấp thuận).\n"
    . "3. Điều kiện Điểm trung bình (GPA) & Môn học tiên quyết:\n"
    . "   - GPA 2 năm cuối hoặc bảng điểm văn bằng 2 phải đạt từ 3.0/4.0 trở lên.\n"
    . "   - Đã hoàn thành 2 môn học nền tảng bắt buộc: Calculus (Giải tích) và Statistics (Xác suất thống kê) với điểm C trở lên. Nếu chưa học, ứng viên phải đăng ký học bổ sung kiến thức nền tảng trước khi nhập học chính thức.\n"
    . "4. Chứng chỉ tiếng Anh Quốc tế:\n"
    . "   - Yêu cầu IELTS tối thiểu 7.0 trở lên đối với sinh viên quốc tế.\n"
    . "5. Quy định Chuyển đổi tín chỉ (Credit Transfer):\n"
    . "   - CSU Fullerton KHÔNG chấp nhận chuyển đổi điểm từ hệ Đại học sang Thạc sĩ.\n"
    . "   - Trường CHỈ xem xét chuyển đổi tín chỉ Thạc sĩ khi ứng viên đã từng học chương trình Thạc sĩ trong vòng 5 năm gần nhất và đạt điểm B trở lên cho từng môn.\n\n"
    . "• CHIẾN LƯỢC TƯ VẤN & GIẢI PHÁP ĐỘT PHÁ TẠI IDEAS:\n"
    . "- Nếu ứng viên đã có sẵn 1 bằng Cử nhân hệ 4 năm tại Việt Nam, việc học thêm Văn bằng 2 BBA của Swiss UMEF (Top-up) sẽ tạo lợi thế hồ sơ cực lớn khi nộp vào CSU Fullerton, giúp bộ hồ sơ nổi bật giữa mức độ cạnh tranh tuyển sinh rất cao của trường.\n"
    . "- GIẢI PHÁP TỐI ƯU NHẤT: Học viên nên chọn chương trình SONG BẰNG BBA TOP-UP + EMBA TẠI IDEAS (hoàn thành trọn gói trong 2 năm):\n"
    . "  + Vừa có bằng Cử nhân Quốc tế BBA hoàn thiện hồ sơ học thuật.\n"
    . "  + Vừa sở hữu tấm bằng Thạc sĩ Điều hành QTKD (EMBA) Thụy Sĩ, đủ điều kiện xin xét CHUYỂN ĐỔI TỐI ĐA 9 TÍN CHỈ vào chương trình MBA của CSU Fullerton, giúp tiết kiệm hàng trăm triệu đồng chi phí học tập và sinh hoạt tại Mỹ, đồng thời nâng tỷ lệ duyệt visa du học và nhận thư mời nhập học lên mức cao nhất!\n\n"
    . "• LINK TRA CỨU CHÍNH THỨC CỦA TRƯỜNG CSU FULLERTON:\n"
    . "- Chương trình Flex MBA: https://business.fullerton.edu/programs/graduate/flex-mba\n"
    . "- Tiêu chuẩn tuyển sinh Graduate Requirements: https://business.fullerton.edu/programs/graduate/requirements";

// Chunks tailored specifically for optimal semantic search and retrieval
$chunks = [
    // Chunk 0: Xử lý phản đối Học phí MSc AI cao
    "XỬ LÝ TÌNH HUỐNG TƯ VẤN: HỌC PHÍ MSc AI CAO QUÁ, CHƯƠNG TRÌNH ONLINE MÀ HỌC PHÍ CAO NHƯ VẦY\n\n"
    . "1. Câu hỏi thường gặp của học viên:\n"
    . "\"Học phí bên em cao quá, chương trình online mà cao như vầy?\"\n\n"
    . "2. Kịch bản phản hồi chuẩn từ tư vấn viên IDEAS / AI Agent:\n"
    . "Dạ em hiểu góc nhìn của anh/chị ạ, vì với chương trình thạc sĩ thì học phí luôn là yếu tố mình cân nhắc rất nhiều.\n"
    . "Thực ra chương trình Master AI (MSc Applied AI) bên em không phải dạng học online tự học 100% qua video thu sẵn, mà là học Live trực tiếp với giảng viên quốc tế mỗi tuần 2 buổi tối, học liên tục theo lộ trình chuẩn quốc tế của chương trình Master of Science.\n"
    . "Điểm khác biệt vượt trội là học viên được:\n"
    . "- Học trực tiếp với giảng viên quốc tế (có tương tác, hỏi đáp real-time).\n"
    . "- Làm project ứng dụng AI vào bài toán kinh doanh thực tế của chính doanh nghiệp học viên đang công tác.\n"
    . "- Nhận bằng Master of Science chuẩn quốc tế (Swiss UMEF Thụy Sĩ, có kiểm định danh giá).\n"
    . "Chính vì vậy, chi phí sẽ khác biệt hoàn toàn so với các khóa học online dạng video quay sẵn trôi nổi trên mạng.\n"
    . "Ngoài ra, chương trình cũng có sự linh động về hình thức học để tiết kiệm chi phí hơn: Học viên có thể đăng ký hình thức học online tự học qua video hệ thống (hệ Standard), chi phí sẽ nhẹ hơn rất nhiều mà vẫn nhận trọn vẹn kiến thức và bằng cấp Thụy Sĩ.",

    // Chunk 1: Học Top-up BBA chuyển tiếp du học MBA Canada hoặc Úc
    "LỘ TRÌNH DU HỌC & CHUYỂN TIẾP MBA TẠI CANADA HOẶC ÚC SAU KHI HỌC TOP-UP BBA SWISS UMEF\n\n"
    . "1. Câu hỏi thường gặp:\n"
    . "\"Học Topup BBA của Swiss UMEF chỉ có 1 năm thì có thể qua Canada hay Úc học MBA học offline được không?\"\n\n"
    . "2. Kịch bản tư vấn chuẩn:\n"
    . "Bằng Top-up BBA của Swiss UMEF là bằng Cử nhân hợp lệ, được công nhận quốc tế (Swiss UMEF là trường đại học tại Thụy Sỹ, bằng cấp châu Âu, chuẩn 60 ECTS).\n"
    . "Tuy nhiên, khi xét tuyển vào chương trình MBA quốc tế (ví dụ Đại học Swinburne tại Úc hoặc Thompson Rivers University tại Canada), các trường sẽ không chỉ nhìn vào thời gian học Top-up 1 năm, mà họ sẽ xem xét toàn bộ lộ trình học tập sau THPT (Cao đẳng 2-3 năm + Top-up 1 năm = tổng 3-4 năm tích lũy học thuật).\n"
    . "Bạn cần nộp kèm tất cả bằng cấp và bảng điểm (cả Cao đẳng và BBA Swiss UMEF).\n"
    . "Phần lớn các trường quốc tế vẫn chấp nhận, với điều kiện:\n"
    . "- Tổng thời gian học sau THPT tối thiểu 3 năm.\n"
    . "- Bằng Top-up phải hợp lệ, trường đào tạo được công nhận (Swiss UMEF được kiểm định SAC, EduQua, ACBSP).\n"
    . "- Có đủ nền tảng học thuật và tiếng Anh để vào MBA.\n"
    . "Tuy nhiên mỗi trường có chính sách khác nhau (có trường xét case-by-case hoặc yêu cầu kinh nghiệm làm việc). Để chắc chắn nhất, học viên nên xem yêu cầu đầu vào (Admission Requirements) và chủ động liên hệ International Office của trường mục tiêu để xác nhận trước khi nộp hồ sơ.",

    // Chunk 2: Lộ trình chuyển tiếp MBA tại California State University, Fullerton (CSU Fullerton - Mỹ)
    "ĐIỀU KIỆN CHUYỂN TIẾP HỌC MBA TẠI CALIFORNIA STATE UNIVERSITY, FULLERTON (CSU FULLERTON - MỸ) SAU KHI HỌC TOP-UP BBA\n\n"
    . "1. Câu hỏi thường gặp:\n"
    . "\"Muốn học thêm Topup BBA của Swiss UMEF để sau này học MBA tại California State University, Fullerton\"\n\n"
    . "2. Tiêu chuẩn tuyển sinh MBA của CSU Fullerton:\n"
    . "- Bằng Cử nhân hệ 4 năm: Nếu chỉ học hệ 3 năm thì cần bổ sung thêm các khóa học sau đại học khác để tương đương hệ 4 năm của Mỹ.\n"
    . "- Thẩm định bảng điểm qua IEE hoặc WES: Cả IEE và WES đều đánh giá văn bằng Swiss UMEF đúng chuẩn quốc tế (đã có học viên IDEAS thẩm định thành công bằng Master UMEF qua IEE và được chấp thuận).\n"
    . "- Điểm GPA & môn học bắt buộc: GPA 2 năm cuối hoặc bảng điểm văn bằng 2 đạt từ 3.0/4.0 trở lên + Đã hoàn thành môn Calculus (Giải tích) và Statistics (Xác suất thống kê) đạt từ điểm C trở lên.\n"
    . "- Trình độ tiếng Anh: IELTS tối thiểu 7.0 đối với sinh viên quốc tế.\n"
    . "- Quy định chuyển đổi tín chỉ (Credit Transfer): CSU Fullerton KHÔNG chấp nhận chuyển đổi điểm từ hệ Đại học sang Thạc sĩ. Chỉ xem xét chuyển đổi khi học viên đã học Thạc sĩ trong 5 năm gần đây và đạt điểm B trở lên.\n\n"
    . "3. Chiến lược tư vấn tối ưu của Viện IDEAS:\n"
    . "- Nếu đã có 1 bằng cử nhân 4 năm tại VN: Học thêm văn bằng 2 BBA Swiss UMEF là lợi thế lớn để nộp hồ sơ vào CSU Fullerton.\n"
    . "- Phương án hồ sơ đẹp nhất: Chọn chương trình SONG BẰNG BBA TOP-UP + EMBA (học 2 năm tại IDEAS). Sau khi tốt nghiệp vừa có bằng BBA vừa có bằng Thạc sĩ EMBA Thụy Sĩ, đủ điều kiện xin chuyển đổi tối đa 9 tín chỉ Thạc sĩ tại CSU Fullerton, nâng cao tỷ lệ trúng tuyển.\n"
    . "Link tham khảo: https://business.fullerton.edu/programs/graduate/flex-mba và https://business.fullerton.edu/programs/graduate/requirements"
];

// Helper chunk vector generator
function getGeminiVector(string $text, string $apiKey): array {
    if (empty($apiKey)) return [[], 0.0];
    
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=" . $apiKey;
    $payload = [
        'model' => 'models/gemini-embedding-001',
        'content' => [
            'parts' => [['text' => $text]]
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    $res = curl_exec($ch);
    curl_close($ch);

    if ($res) {
        $data = json_decode($res, true);
        if (!empty($data['embedding']['values'])) {
            $vec = $data['embedding']['values'];
            $norm = 0.0;
            foreach ($vec as $v) $norm += $v * $v;
            return [$vec, sqrt($norm)];
        }
    }
    return [[], 0.0];
}

// EXECUTION: PDO or MySQLi
if (isset($db) && $db instanceof PDO) {
    // 1. Fetch API Key for embeddings
    $kStmt = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_api_key' LIMIT 1");
    $apiKey = $kStmt ? (string)$kStmt->fetchColumn() : '';

    // 2. Ensure Folder ID (Kiến Thức Cốt Lõi Viện IDEAS & Hệ Sinh Thái LMS 4.0)
    $fStmt = $db->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND source_type = 'folder' AND tenant_id = 1 LIMIT 1");
    $fStmt->execute([$folderName]);
    $folderId = (int)$fStmt->fetchColumn();
    if (!$folderId) $folderId = 43; // default fallback

    // 3. Insert or Update Document
    $dStmt = $db->prepare("SELECT id FROM ai_training_docs WHERE name = ? AND tenant_id = 1 LIMIT 1");
    $dStmt->execute([$docTitle]);
    $docId = (int)$dStmt->fetchColumn();

    if ($docId) {
        $upDoc = $db->prepare("UPDATE ai_training_docs SET content = ?, tags = ?, source_type = 'manual', parent_id = ?, is_active = 1, status = 'trained', updated_at = NOW() WHERE id = ?");
        $upDoc->execute([$docContent, $docTags, $folderId, $docId]);
    } else {
        $insDoc = $db->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, is_active, status, created_at, updated_at) VALUES (1, ?, ?, ?, 'manual', ?, 1, 'trained', NOW(), NOW())");
        $insDoc->execute([$docTitle, $docContent, $docTags, $folderId]);
        $docId = (int)$db->lastInsertId();
    }

    // 4. Delete old chunks
    $del = $db->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ?");
    $del->execute([$docId]);

    // 5. Insert new chunks with vector embeddings
    $insChunk = $db->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm, created_at) VALUES (1, ?, ?, ?, ?, ?, NOW())");
    $saveCache = $db->prepare("INSERT INTO ai_vector_cache (hash, vector, vector_norm) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vector = VALUES(vector), vector_norm = VALUES(vector_norm)");

    foreach ($chunks as $idx => $chunkText) {
        list($vector, $vectorNorm) = getGeminiVector($chunkText, $apiKey);
        $vectorJson = json_encode($vector);
        $insChunk->execute([$docId, $idx, $chunkText, $vectorJson, $vectorNorm]);

        if (!empty($vector)) {
            $hash = md5('models/gemini-embedding-001|v1beta|' . mb_strtolower($chunkText));
            $saveCache->execute([$hash, $vectorJson, $vectorNorm]);
        }
    }

    echo "Successfully trained DOC-20 and created " . count($chunks) . " RAG chunks with vector embeddings.\n";
    return;
}
