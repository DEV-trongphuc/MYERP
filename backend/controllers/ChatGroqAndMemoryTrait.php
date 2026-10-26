<?php
trait ChatGroqAndMemoryTrait {
    private function buildGroqFocusedSystemPrompt(
        string $fullSystemPrompt,
        string $primaryDomain,
        array $matchedDomains = [],
        bool $isSynthesisTurn = false
    ): string {
        // 1. Extract Persona, Salutation & RBAC header (up to "• QUY ĐỊNH GIỜ LÀM VIỆC")
        $headerEndPos = strpos($fullSystemPrompt, "• QUY ĐỊNH GIỜ LÀM VIỆC");
        $coreHeader = $headerEndPos !== false
            ? trim(substr($fullSystemPrompt, 0, $headerEndPos))
            : mb_substr($fullSystemPrompt, 0, 1200, 'UTF-8');

        // 2. Extract Dynamic Runtime Context blocks appended at the bottom of $fullSystemPrompt
        $dynamicTail = '';
        $dynamicMarkers = [
            'NĂNG LỰC PHÂN TÍCH TÀI LIỆU & FILE ĐÍNH KÈM',
            '--- [BỘ NHỚ LÀM VIỆC PHIÊN TRƯỚC (WORKING MEMORY)] ---',
            '--- [KIẾN THỨC TỪ HUẤN LUYỆN AI DOANH NGHIỆP] ---',
            '--- [BỨC TRANH TOÀN CẢNH HỆ THỐNG',
            '--- [TRỰC GIÁC MÀN HÌNH & HỒ SƠ ĐANG MỞ',
            '--- [DỮ LIỆU THỰC TẾ TRA CỨU TỪ HỆ THỐNG ERP',
            '--- [GHI NHỚ CÁ NHÂN HÓA',
            '--- [BỐI CẢNH ĐỐI TƯỢNG VỪA THAO TÁC',
            '--- [CẢNH BÁO RỦI RO VẬN HÀNH',
            '[GHI CHÚ HỆ THỐNG GIẢI NGHĨA ĐẠI TỪ]'
        ];
        $earliestPos = null;
        foreach ($dynamicMarkers as $marker) {
            $pos = strpos($fullSystemPrompt, $marker);
            if ($pos !== false && ($earliestPos === null || $pos < $earliestPos)) {
                $earliestPos = $pos;
            }
        }
        if ($earliestPos !== null) {
            $dynamicTail = trim(substr($fullSystemPrompt, $earliestPos));
            if (mb_strlen($dynamicTail, 'UTF-8') > 4500) {
                $dynamicTail = mb_substr($dynamicTail, 0, 4500, 'UTF-8') . "\n--- [HẾT BỐI CẢNH ĐỘNG] ---";
            }
        }

        if ($isSynthesisTurn) {
            return $coreHeader . "\n\n"
                . "QUY CHUẨN TỔNG HỢP BÁO CÁO ĐIỀU HÀNH & SMART UI TAGS (BẮT BUỘC 100%):\n"
                . "1. CHÂN LÝ DỮ LIỆU SQL (`STRICT_DATABASE_GROUND_TRUTH`): Dùng chính xác 100% con số từ kết quả công cụ SQL vừa thực thi (`total_matching`, `financial_summary`, `period_comparison`, `facets`, `summary`, `_ground_truth_lock`). Tuyệt đối không tự cộng nhẩm lại từ danh sách xem trước hay bịa số liệu.\n"
                . "2. KHUNG PHẢN HỒI ĐIỀU HÀNH 5 PHẦN: (a) Tổng quan chỉ số cốt lõi (nếu có `period_comparison` thì nêu rõ biến động % so với kỳ trước); (b) Bảng Markdown bóc tách đa chiều (`facets`: Chương trình / Nguồn / Sale / Giai đoạn kèm số lượng cọc & tỷ lệ chuyển đổi %); (c) Chẩn đoán điểm sáng & điểm nghẽn (lead chưa liên hệ `uncontacted_count`, kênh CPL/CAC/ROAS); (d) Giữ nguyên thẻ `<<<DYNAMIC_CHART: {...}>>>`; (e) Bảng danh sách mẫu & Link tải Excel.\n"
                . "3. KHÔNG DÙNG EMOJI TRONG TIÊU ĐỀ `###`: Trình bày chuẩn Enterprise SaaS trang trọng, dùng BẢNG MARKDOWN rõ ràng.\n"
                . "4. BẢNG DANH SÁCH LEAD / HỌC VIÊN CRM: Dùng đúng các cột `| ID | HỌ VÀ TÊN | SĐT | CHƯƠNG TRÌNH | GIAI ĐOẠN | SALE PHỤ TRÁCH | TIỀN CỌC |`, cột HỌ VÀ TÊN gắn link `[Tên](/contacts?id=ID)`. Giữ nguyên link tải Excel `[Bấm vào đây để tải danh sách (File Excel/CSV)](/export?...)`.\n"
                . "5. QUY TẮC THẺ ĐƠN LẺ (`<<<ERP_CARD:...>>>`) & HỎI LẠI (`CLARIFY_OPTIONS`): Nếu kết quả có > 1 bản ghi (`total_matching > 1`), CẤM sinh thẻ `<<<ERP_CARD:...>>>` đơn lẻ dưới bảng. Chỉ sinh `<<<ERP_CARD:...>>>` khi tra cứu đích danh 1 đối tượng duy nhất (`total_matching = 1`). Khi `requires_disambiguation: true`, liệt kê bảng ứng viên và giữ nguyên `<<<CLARIFY_OPTIONS: [...]>>>`.\n"
                . "6. GỢI Ý BƯỚC TIẾP THEO CUỐI BÀI: Chỉ giữ `<<<ACTION_PROPOSAL: {...}>>>` nếu công cụ trả về thẻ đề xuất thực thi; KHÔNG tự chế `<<<ACTION_PROPOSAL:...>>>` cho câu hỏi thống kê/tra cứu. Luôn kết thúc bằng `<<<NEXT_BEST_ACTIONS: [\"Gợi ý 1\", \"Gợi ý 2\", \"Gợi ý 3\"]>>>`.\n"
                . ($dynamicTail !== '' ? "\n" . $dynamicTail : '');
        }

        $todayYmd = date('Y-m-d');
        $last7Ymd = date('Y-m-d', strtotime('-7 days'));
        $last30Ymd = date('Y-m-d', strtotime('-30 days'));
        $monthStartYmd = date('Y-m-01');

        $activeDomains = array_values(array_unique(array_merge([$primaryDomain], $matchedDomains)));
        $domainRules = [];

        foreach ($activeDomains as $dom) {
            switch ($dom) {
                case 'sales':
                case 'academic':
                case 'records_legal':
                    $domainRules[] = "• QUY TẮC CRM LEADS, HỌC VIÊN & TUYỂN SINH (Mốc thời gian chuẩn: Hôm nay='{$todayYmd}', 7 ngày qua: from_date='{$last7Ymd}' & to_date='{$todayYmd}', 30 ngày qua: from_date='{$last30Ymd}' & to_date='{$todayYmd}', Tháng này: from_date='{$monthStartYmd}' & to_date='{$todayYmd}'):\n"
                        . "  - Khi lọc/tra cứu/thống kê lead hoặc học viên theo bất kỳ điều kiện nào (tư vấn viên `owners`, đội nhóm `teams`, chương trình `programs`, giai đoạn `stages` + `stage_op`, loại data `data_type` ('distributed' = Được chia, 'personal' = Cá nhân), nguồn `sources`, địa bàn `branches_or_cities`, đặt cọc `financial_filter`, tương tác `interacted_within_days`/`min_call_count`/`note_keyword`, giới tính/tuổi/chức vụ, thiếu hồ sơ `missing_document`, hoặc so sánh kỳ trước `compare_previous_period=true`): BẮT BUỘC gọi `query_crm_leads_multitier` (truyền `record_type='all'` khi tìm data của tư vấn viên).\n"
                        . "  - CẤM TUYỆT ĐỐI BỊA `note_keyword`: Khi người dùng yêu cầu 'đọc kỹ note', 'rà soát note', 'phân tích note', 'phân loại lại theo note' hoặc 'xem danh sách lead trong giai đoạn', BẮT BUỘC ĐỂ TRỐNG `note_keyword` và truyền `limit=60` trong `query_crm_leads_multitier` để lấy toàn bộ danh sách kèm `latest_note` thực tế (không làm rớt các lead ghi tắt như 'KNM', 'kbm', 'thuê bao'). Chỉ truyền `note_keyword` khi người dùng chỉ định tìm đích danh 1 từ khóa cụ thể!\n"
                        . "  - KẾ THỪA BỘ NHỚ LÀM VIỆC (`WORKING MEMORY`) & TRỰC GIÁC MÀN HÌNH: Khi người dùng hỏi tiếp nối ('còn theo nguồn?', 'so với tháng trước?', 'lọc riêng MBA', 'ai phụ trách nhiều nhất?', 'trong số đó ai đã cọc?', 'đọc kỹ note của các lead này'), hãy kế thừa các bộ lọc đang áp dụng trong `[BỘ NHỚ LÀM VIỆC PHIÊN TRƯỚC]` hoặc `[TRỰC GIÁC MÀN HÌNH]` (như `from_date`, `to_date`, `stages`, `data_type`, `programs`, `owners`) và bật `compare_previous_period=true` nếu người dùng hỏi so sánh với kỳ trước.\n"
                        . "  - QUAN TRỌNG VỀ NGÀY THÁNG: Khi hỏi lead có/tạo trong N ngày qua (vd: 7 ngày qua, 30 ngày qua, hôm nay), BẮT BUỘC truyền `from_date` và `to_date` (kèm `date_field='created_at'`). TUYỆT ĐỐI KHÔNG truyền `stale_days` trừ khi người dùng hỏi rõ 'lead bỏ quên / chưa chăm sóc trên N ngày'!\n"
                        . "  - Khi tra cứu 1 khách hàng/học viên cụ thể hoặc xem lịch sử ghi chú chăm sóc: Gọi `get_contact_360_profile` (mặc định trích xuất TOP 3 tương tác gần nhất).\n"
                        . "  - Khi thêm data cá nhân, tạo lead mới hoặc phân bổ/chuyển giao lead cho đồng nghiệp: Gọi `smart_create_or_assign_leads` hoặc `reassign_lead_owner`. Khi điều phối vòng chia số/bù data: Gọi `manage_lead_round_distribution`.\n"
                        . "  - KHI HỎI TỔNG QUAN DATA, CHÂN DUNG HỌC VIÊN & KHÁCH HÀNG (Tổng số học viên/lead, học viên theo trường/chương trình `UBIS`, `UMEF`, `ASC`, `Apollos`, `SBS`, `MSc-AI`, khóa `Intake 01`..`Intake 47`, học viên học >= 2 khóa/chương trình, tỷ lệ Nam/Nữ, độ tuổi bình quân, tháp cấp bậc chức vụ, Top công ty/ngân hàng có nhiều học viên, ngành nghề, độ đầy đủ hồ sơ): BẮT BUỘC ưu tiên gọi `query_customer_student_persona_overview` (truyền `segment='all'|'students'|'leads'`, kèm `program` hoặc `intake` nếu có). Khi cần tải file chức vụ của N lead gần đây: Gọi `analyze_leads_demographics_and_job_titles`.\n"
                        . "  - KHI HỎI HIỆU SUẤT LEAD, BẢNG XẾP HẠNG SALE, TỶ LỆ CHUYỂN ĐỔI PHỄU, HOẶC HIỆU QUẢ NGUỒN MARKETING: Gọi `query_sales_lead_performance_deck` hoặc `get_sales_leaderboard` / `get_sales_performance_and_stale_leads` (đồng bộ 100% với tab Hiệu Suất Lead trên Dashboard: Tổng Lead = Lead công ty chia cho Sale `role IN ('sale','sales')` loại trừ Cá nhân/Giới thiệu/Import/Báo lỗi; Chưa tương tác = chưa có `last_contact`/activities/manual note; Biểu đồ tròn Phễu 3 nhóm = 100% gồm `Chưa Connect (Stage 1-2)`, `Lead Qualified (Stage 3-12)`, `Win (Stage 13-14)`; Cột `Qualified` trên bảng = `Stage 3-14`; Nguồn Marketing gồm cả `new_leads` + `prior_closed_leads`; Luôn báo cáo rõ `Doanh thu dự kiến (tổng giá trị SO)` và `Thực thu (đã duyệt theo các đợt đóng phí deposit_milestones)`).";
                    break;
                case 'finance':
                    $domainRules[] = "• QUY TẮC TÀI CHÍNH, THU CHI, ĐẶT CỌC & PO/SO:\n"
                        . "  - Khi hỏi chi phí, phiếu chi, PO, nhà cung cấp, tạm ứng, ngân sách, hóa đơn: Gọi `query_finance_multitier_analytics` hoặc `filter_expenses_advanced`.\n"
                        . "  - Khi hỏi doanh thu đặt cọc, học phí, đơn bán hàng SO, đợt đóng học phí (`deposit_milestones`): Gọi `query_deposits_and_revenue_multitier`.\n"
                        . "  - Khi yêu cầu tạo/duyệt phiếu chi, PO, SO, phiếu cọc: Gọi `smart_manage_po_so_and_approvals` hoặc `draft_action_proposal`.";
                    break;
                case 'hrm':
                    $domainRules[] = "• QUY TẮC NHÂN SỰ, CHẤM CÔNG, ĐƠN TỪ & BẢNG LƯƠNG (QĐ 001/2024 VIỆN IDEAS):\n"
                        . "  - Giờ làm việc: Sáng 08:00-12:00, Chiều 13:00-17:00 (5 ngày/tuần). Định mức đi trễ & về sớm miễn trừ hàng tháng: Nữ 60 phút/tháng, Nam 30 phút/tháng. Phép năm: 12 ngày/năm.\n"
                        . "  - Khi hỏi đi làm hôm nay / có mặt / vắng mặt / chấm công: BẮT BUỘC gọi `query_company_attendance_and_work_hours` (`scope='today_status'`), trình bày 3 nhóm: Có mặt tại văn phòng, WFH có đơn duyệt, Chưa quẹt thẻ/Vắng mặt (tách riêng tài khoản ngừng chấm công >30 ngày, cấm gộp Bot SI IDEAS).\n"
                        . "  - Khi hỏi danh bạ nhân sự: Gọi `get_staff_directory_advanced` hoặc `get_company_staff_directory`.\n"
                        . "  - Khi hỏi lương/phiếu lương: Gọi `get_my_payslip` hoặc `query_hrm_workforce_and_payroll_multitier`.\n"
                        . "  - Khi tạo/xác nhận đơn nghỉ phép, giải trình công, OT/WFH, tạm ứng hoặc duyệt đơn nhân sự: Gọi `manage_my_hr_profile_and_requests` hoặc `smart_manage_hrm_and_payroll`.";
                    break;
                case 'tasks':
                    $domainRules[] = "• QUY TẮC CÔNG VIỆC (TASKS), VIỆC CON & DỰ ÁN:\n"
                        . "  - Khi tra cứu công việc cá nhân/team/quá hạn: Gọi `query_tasks_and_projects_multitier` hoặc `get_my_tasks`.\n"
                        . "  - Khi tạo/cập nhật công việc, checklist/việc con, duyệt task: Gọi `smart_manage_tasks_and_subtasks`.\n"
                        . "  - Khi tra cứu hoặc quản lý dự án: Gọi `query_and_manage_projects`.";
                    break;
                case 'marketing_campaigns':
                    $domainRules[] = "• QUY TẮC MARKETING AUTOMATION, ĐA KÊNH & CHIẾN DỊCH:\n"
                        . "  - Khi hỏi hiệu quả kịch bản Automation Flow, điểm nghẽn, chiến dịch Email/ZNS, Voucher, Khảo sát, lưu lượng Web/UTM: Gọi `query_omnichannel_journey_and_automation_analytics`.\n"
                        . "  - Khi xem dấu chân số 360° của 1 khách hàng: Gọi `get_lead_digital_footprint_360`.\n"
                        . "  - Khi thao tác kịch bản Flow/Voucher/Đồng bộ: Gọi `smart_manage_automation_flows_and_campaigns`.";
                    break;
                default:
                    $domainRules[] = "• QUY TẮC ĐIỀU HÀNH TỔNG HỢP (EXECUTIVE BI & CROSS-DOMAIN):\n"
                        . "  - Khi hỏi bức tranh tổng thể, doanh thu - chi phí - dòng tiền ròng, CPL/CAC/ROAS, Top Sales, tóm tắt đầu ngày: Gọi `query_cross_domain_executive_synthesis`, `get_executive_morning_brief`, `get_executive_financial_pulse` hoặc `get_sales_leaderboard`.\n"
                        . "  - Khi hỏi tồn kho/tài sản: Gọi `query_inventory_and_assets_multitier`. Khi hỏi B2B/Deals: Gọi `query_deals_and_b2b_multitier`. Khi hỏi Ticket/SLA: Gọi `query_tickets_and_sla_multitier`.";
                    break;
            }
        }

        $domainBlock = implode("\n", array_unique($domainRules));
        require_once __DIR__ . '/../utils/SemanticMdlRegistry.php';
        $mdlGroundingBlock = SemanticMdlRegistry::getDomainSemanticContext($primaryDomain);

        return $coreHeader . "\n\n"
            . $domainBlock . "\n\n"
            . $mdlGroundingBlock . "\n\n"
            . "QUY TẮC TRÌNH BÀY & SMART UI TAGS:\n"
            . "• Từ lóng: 'củ'/'chai' = Triệu VNĐ ('5 củ' = 5.000.000 VNĐ); 'lead mồ côi' = `owners='unassigned'`; 'lead ngâm' = `stale_days`.\n"
            . "• Không dùng từ '(Zero-Trust)'. Không dùng emoji trong tiêu đề `###`. Dùng BẢNG MARKDOWN khi có >= 2 đối tượng.\n"
            . "• Khi trùng tên nhiều hồ sơ (`disambiguation_required: true`), không tự đoán mò mà liệt kê bảng so sánh và giữ nguyên `<<<CLARIFY_OPTIONS: [...]>>>`.\n"
            . "• Chỉ sinh `<<<ERP_CARD: {...}>>>` khi kết quả có ĐÚNG 1 hồ sơ (`total_matching = 1`); cấm sinh thẻ đơn lẻ dưới bảng nhiều dòng.\n"
            . "• Giữ nguyên link tải `[Bấm vào đây để tải danh sách (File Excel/CSV)](/export?...)`, và luôn kết thúc bằng `<<<NEXT_BEST_ACTIONS: [\"Gợi ý 1\", \"Gợi ý 2\", \"Gợi ý 3\"]>>>`.\n"
            . ($dynamicTail !== '' ? "\n" . $dynamicTail : '');
    }

    /**
     * Extract the most recent Working Memory object from the conversation history
     */
    private function extractLatestWorkingMemoryFromHistory(array $history): array {
        for ($i = count($history) - 1; $i >= 0; $i--) {
            $msg = $history[$i];
            if ((int)($msg['sender_id'] ?? 0) !== 9000001) {
                continue;
            }
            $metaRaw = $msg['metadata'] ?? null;
            $meta = is_string($metaRaw) ? (json_decode($metaRaw, true) ?: []) : (is_array($metaRaw) ? $metaRaw : []);
            if (!empty($meta['working_memory']) && is_array($meta['working_memory'])) {
                return $meta['working_memory'];
            }
            if (!empty($meta['agent_steps']) && is_array($meta['agent_steps'])) {
                $lastStep = end($meta['agent_steps']);
                if (is_array($lastStep) && !empty($lastStep['tool_name'])) {
                    return [
                        'domain' => $meta['specialist']['id'] ?? 'general',
                        'last_tool' => $lastStep['tool_name'],
                        'applied_filters' => is_array($lastStep['args'] ?? null) ? $lastStep['args'] : [],
                        'key_metrics' => [],
                        'top_facets' => [],
                        'entity_anchors' => [],
                        'export_url' => ''
                    ];
                }
            }
        }
        return [];
    }

    /**
     * Detect whether the user query is a conversational follow-up, drill-down, comparison, or filter refinement
     */
    private function isFollowUpOrDrillDownQuery(string $query, array $prevWorkingMemory): bool {
        if (empty($prevWorkingMemory) || empty($prevWorkingMemory['last_tool'])) {
            return false;
        }
        $q = mb_strtolower(trim($query), 'UTF-8');
        if ($q === '') {
            return false;
        }
        if (mb_strlen($q, 'UTF-8') <= 48 && preg_match('/^(còn|thế còn|vậy còn|vậy|thế|sao|tại sao|vì sao|chi tiết|bóc tách|phân tích sâu|so với|so sánh|trong số đó|nhóm đó|danh sách đó|ở trên|vừa rồi|nãy|tiếp|lọc thêm|chỉ lấy|riêng|tải file|xuất file|xuất excel|tải excel)/iu', $q)) {
            return true;
        }
        if (preg_match('/(so với kỳ trước|so với tháng trước|so với tuần trước|cùng kỳ|tăng hay giảm|trong số đó|nhóm vừa lọc|danh sách trên|theo nguồn thì sao|theo sale thì sao|theo chương trình thì sao|theo giai đoạn thì sao|ai cao nhất|ai nhiều nhất|kênh nào tốt nhất)/iu', $q)) {
            return true;
        }
        return false;
    }

    /**
     * Format the Working Memory block for injection into the System Prompt
     */
    private function formatWorkingMemoryPromptBlock(array $wm): string {
        if (empty($wm) || (empty($wm['last_tool']) && empty($wm['key_metrics']))) {
            return "";
        }
        $lines = ["\n--- [BỘ NHỚ LÀM VIỆC PHIÊN TRƯỚC (WORKING MEMORY)] ---"];
        $lines[] = "• Phân hệ đang làm việc: " . ($wm['domain'] ?? 'general') . " | Công cụ gần nhất: " . ($wm['last_tool'] ?? 'none');
        if (!empty($wm['applied_filters']) && is_array($wm['applied_filters'])) {
            if (isset($wm['applied_filters']['note_keyword']) && substr_count((string)$wm['applied_filters']['note_keyword'], ',') >= 2) {
                unset($wm['applied_filters']['note_keyword']);
            }
            if (!empty($wm['applied_filters'])) {
                $lines[] = "• Bộ lọc đang áp dụng (Active Filters): " . json_encode($wm['applied_filters'], JSON_UNESCAPED_UNICODE);
            }
        }
        if (!empty($wm['key_metrics']) && is_array($wm['key_metrics'])) {
            $lines[] = "• Số liệu Ground-Truth đã xác thực ở lượt trước: " . json_encode($wm['key_metrics'], JSON_UNESCAPED_UNICODE);
        }
        if (!empty($wm['top_facets']) && is_array($wm['top_facets'])) {
            $lines[] = "• Bóc tách Facets chính ở lượt trước: " . json_encode($wm['top_facets'], JSON_UNESCAPED_UNICODE);
        }
        if (!empty($wm['entity_anchors']) && is_array($wm['entity_anchors'])) {
            $lines[] = "• Các thực thể tiêu biểu vừa hiển thị: " . json_encode($wm['entity_anchors'], JSON_UNESCAPED_UNICODE);
        }
        if (!empty($wm['export_url'])) {
            $lines[] = "• Link xuất Excel lượt trước: " . $wm['export_url'];
        }
        $lines[] = "• CHỈ DẪN LIÊN KẾT MẠCH HỘI THOẠI: Nếu người dùng hỏi tiếp nối/đào sâu ('còn theo nguồn?', 'lọc riêng MBA', 'so với tháng trước?', 'trong số đó bao nhiêu người đã cọc?'), hãy KẾ THỪA các điều kiện lọc trong `Active Filters` ở trên khi gọi công cụ (và truyền `compare_previous_period=true` nếu hỏi so sánh kỳ trước). Nếu câu hỏi chỉ yêu cầu giải thích hoặc đọc góc nhìn đã có sẵn đầy đủ trong `Facets chính` hoặc `Số liệu Ground-Truth` ở trên, hãy dùng chính xác con số đó để phân tích.";
        $lines[] = "--- [HẾT BỘ NHỚ LÀM VIỆC PHIÊN TRƯỚC] ---\n";
        return implode("\n", $lines);
    }

    /**
     * Build a compact structured working state snapshot from a single tool execution
     */
    private function buildStepWorkingState(string $toolName, array $args, array $compactResult): array {
        $cleanFilters = [];
        foreach ($args as $k => $v) {
            if ($v !== null && $v !== '' && $v !== 'all' && $v !== []) {
                if ($k === 'note_keyword' && is_string($v) && substr_count($v, ',') >= 2) {
                    continue;
                }
                $cleanFilters[$k] = $v;
            }
        }

        $metrics = [];
        foreach (['total_matching', 'total_leads', 'total_records', 'created_count', 'reassigned_count'] as $mk) {
            if (isset($compactResult[$mk])) {
                $metrics[$mk] = $compactResult[$mk];
            }
        }
        foreach (['financial_summary', 'period_comparison', 'crm_and_funnel', 'revenue_and_deposits', 'expenses_and_cashflow', 'summary', 'deal_summary', 'ticket_summary', 'inventory_summary', 'persona_kpi', 'completeness', 'gender_breakdown', 'age_breakdown', 'seniority_tiers'] as $groupKey) {
            if (!empty($compactResult[$groupKey]) && is_array($compactResult[$groupKey])) {
                $metrics[$groupKey] = $compactResult[$groupKey];
            }
        }

        $topFacets = [];
        if (!empty($compactResult['facets']) && is_array($compactResult['facets'])) {
            foreach ($compactResult['facets'] as $fName => $fList) {
                if (is_array($fList) && !empty($fList)) {
                    $topFacets[$fName] = array_slice($fList, 0, 5);
                }
            }
        }
        foreach (['by_school_program', 'by_intake', 'top_companies', 'by_industry', 'multi_course_students'] as $pFacetKey) {
            if (!empty($compactResult[$pFacetKey]) && is_array($compactResult[$pFacetKey])) {
                $topFacets[$pFacetKey] = array_slice($compactResult[$pFacetKey], 0, 8);
            }
        }
        if (!empty($compactResult['top_sales_performers']) && is_array($compactResult['top_sales_performers'])) {
            $topFacets['top_sales_performers'] = array_slice($compactResult['top_sales_performers'], 0, 5);
        }

        $entityAnchors = [];
        foreach (['preview_leads', 'candidates', 'sample_deals', 'sample_tickets', 'sample_products'] as $listKey) {
            if (!empty($compactResult[$listKey]) && is_array($compactResult[$listKey])) {
                foreach (array_slice($compactResult[$listKey], 0, 6) as $row) {
                    if (is_array($row) && (!empty($row['id']) || !empty($row['full_name']) || !empty($row['name']))) {
                        $entityAnchors[] = array_filter([
                            'id' => $row['id'] ?? null,
                            'name' => $row['full_name'] ?? ($row['name'] ?? ($row['title'] ?? null)),
                            'program' => $row['program'] ?? null,
                            'stage' => $row['stage'] ?? ($row['status'] ?? null),
                            'owner' => $row['owner_name'] ?? ($row['sale_name'] ?? null)
                        ]);
                    }
                }
                if (!empty($entityAnchors)) {
                    break;
                }
            }
        }

        return [
            'tool_name' => $toolName,
            'applied_filters' => $cleanFilters,
            'key_metrics' => $metrics,
            'top_facets' => $topFacets,
            'entity_anchors' => $entityAnchors,
            'export_url' => (string)($compactResult['export_url'] ?? '')
        ];
    }

    /**
     * Extract the new 2-Tier Working Memory object after executing agent steps in the current turn
     */
    private function extractWorkingMemoryFromSteps(array $agentSteps, string $domain, string $cleanPrompt, array $prevWorkingMemory = []): array {
        if (empty($agentSteps)) {
            if (!empty($prevWorkingMemory)) {
                $prevWorkingMemory['last_user_query'] = mb_substr(trim($cleanPrompt), 0, 200, 'UTF-8');
                $prevWorkingMemory['updated_at'] = date('Y-m-d H:i:s');
                return $prevWorkingMemory;
            }
            return [];
        }

        $primaryState = null;
        for ($i = count($agentSteps) - 1; $i >= 0; $i--) {
            $st = $agentSteps[$i];
            if (!empty($st['working_state']) && is_array($st['working_state'])) {
                $primaryState = $st['working_state'];
                break;
            }
        }

        if (!$primaryState) {
            $lastStep = end($agentSteps);
            $fallbackFilters = is_array($lastStep['args'] ?? null) ? $lastStep['args'] : [];
            if (isset($fallbackFilters['note_keyword']) && substr_count((string)$fallbackFilters['note_keyword'], ',') >= 2) {
                unset($fallbackFilters['note_keyword']);
            }
            return [
                'domain' => $domain,
                'last_tool' => $lastStep['tool_name'] ?? 'none',
                'applied_filters' => $fallbackFilters,
                'key_metrics' => [],
                'top_facets' => [],
                'entity_anchors' => [],
                'export_url' => '',
                'last_user_query' => mb_substr(trim($cleanPrompt), 0, 200, 'UTF-8'),
                'updated_at' => date('Y-m-d H:i:s')
            ];
        }

        $primaryFilters = is_array($primaryState['applied_filters'] ?? null) ? $primaryState['applied_filters'] : [];
        if (isset($primaryFilters['note_keyword']) && substr_count((string)$primaryFilters['note_keyword'], ',') >= 2) {
            unset($primaryFilters['note_keyword']);
        }

        return [
            'domain' => $domain,
            'last_tool' => $primaryState['tool_name'] ?? 'none',
            'applied_filters' => $primaryFilters,
            'key_metrics' => $primaryState['key_metrics'] ?? [],
            'top_facets' => $primaryState['top_facets'] ?? [],
            'entity_anchors' => $primaryState['entity_anchors'] ?? [],
            'export_url' => $primaryState['export_url'] ?? '',
            'last_user_query' => mb_substr(trim($cleanPrompt), 0, 200, 'UTF-8'),
            'updated_at' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Compact historical conversation messages to prevent context bloat while preserving working memory facts
     */
    private function compactHistoryMessageForPrompt(string $rawMsg, ?string $metaJson, string $role = 'model'): string {
        $msgText = trim($rawMsg);
        if ($msgText === '') {
            return '';
        }

        if ($role === 'model') {
            $msgText = preg_replace('/<<<DYNAMIC_CHART:\s*[\s\S]*?>>>/', '[Đã hiển thị biểu đồ trực quan]', $msgText);
            $msgText = preg_replace('/<<<ACTION_PROPOSAL:\s*[\s\S]*?>>>/', '[Đã xuất thẻ hành động điền sẵn]', $msgText);
            $msgText = preg_replace('/<<<ERP_CARD:\s*[\s\S]*?>>>/', '[Đã hiển thị thẻ hồ sơ ERP]', $msgText);
            $msgText = preg_replace('/<<<CLARIFY_OPTIONS:\s*[\s\S]*?>>>/', '', $msgText);
            $msgText = preg_replace('/<<<PROACTIVE_INSIGHT:\s*[\s\S]*?>>>/', '', $msgText);
            $msgText = preg_replace('/<<<NEXT_BEST_ACTIONS:\s*[\s\S]*?>>>/', '', $msgText);
            $msgText = preg_replace('/<<<SAVE_MEMORY:\s*[\s\S]*?>>>/', '', $msgText);

            // Compress markdown tables with > 7 lines down to header + top 4 rows
            $lines = explode("\n", (string)$msgText);
            $compactedLines = [];
            $tableLineCount = 0;
            $skippedTableRows = 0;
            foreach ($lines as $ln) {
                $trimLn = trim($ln);
                if (str_starts_with($trimLn, '|') && str_ends_with($trimLn, '|')) {
                    $tableLineCount++;
                    if ($tableLineCount <= 6) {
                        $compactedLines[] = $ln;
                    } else {
                        $skippedTableRows++;
                    }
                } else {
                    if ($skippedTableRows > 0) {
                        $compactedLines[] = "| ... | *(Đã rút gọn {$skippedTableRows} dòng lịch sử)* |";
                        $skippedTableRows = 0;
                    }
                    $tableLineCount = 0;
                    $compactedLines[] = $ln;
                }
            }
            if ($skippedTableRows > 0) {
                $compactedLines[] = "| ... | *(Đã rút gọn {$skippedTableRows} dòng lịch sử)* |";
            }
            $msgText = trim((string)preg_replace('/\n{3,}/', "\n\n", implode("\n", $compactedLines)));

            if (mb_strlen($msgText, 'UTF-8') > 900) {
                $msgText = mb_substr($msgText, 0, 900, 'UTF-8') . '... [Đã nén lịch sử trả lời]';
            }

            if ($metaJson !== null && $metaJson !== '') {
                $meta = json_decode($metaJson, true);
                if (is_array($meta) && !empty($meta['working_memory']['last_tool'])) {
                    $wm = $meta['working_memory'];
                    $filtersCompact = !empty($wm['applied_filters']) ? json_encode($wm['applied_filters'], JSON_UNESCAPED_UNICODE) : '{}';
                    $msgText .= "\n[Bộ nhớ lượt này: tool={$wm['last_tool']}, filters={$filtersCompact}]";
                }
            }
        } elseif (mb_strlen($msgText, 'UTF-8') > 600) {
            $msgText = mb_substr($msgText, 0, 600, 'UTF-8') . '...';
        }

        return $msgText;
    }

    /**
     * Get ranked Groq Cloud model pool:
     * 1. Primary: `qwen/qwen3.8-27b` (30 RPM, 1K RPD, 8K TPM, tool-calling native)
     * 2. Failover 1: `openai/gpt-oss-120b` (independent 30 RPM, 1K RPD, 8K TPM bucket on Groq)
     * 3. Failover 2: `openai/gpt-oss-20b` (independent 30 RPM, 1K RPD, 8K TPM bucket on Groq)
     */
    private function getGroqModelPool(string $preferredModel): array {
        $pool = [
            'qwen/qwen3.8-27b',
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
        ];
        if (
            $preferredModel !== '' &&
            in_array($preferredModel, $pool, true)
        ) {
            array_unshift($pool, $preferredModel);
        }
        return array_values(array_unique($pool));
    }

    private function isGroqModelInCooldown(string $groqKey, string $modelId): bool {
        $flagFile = rtrim(sys_get_temp_dir(), '/\\') . '/groq_cd_' . substr(md5($groqKey . '|' . $modelId), 0, 12) . '.flag';
        if (is_file($flagFile)) {
            $until = (int)@file_get_contents($flagFile);
            if ($until > time()) {
                return true;
            }
            @unlink($flagFile);
        }
        return false;
    }

    private function markGroqModelCooldown(string $groqKey, string $modelId, int $seconds = 45): void {
        $flagFile = rtrim(sys_get_temp_dir(), '/\\') . '/groq_cd_' . substr(md5($groqKey . '|' . $modelId), 0, 12) . '.flag';
        @file_put_contents($flagFile, (string)(time() + $seconds));
    }

    /**
     * Stream Groq Cloud Synthesis response in real-time via SSE (`$onChunk`) with full token output (`max_tokens: 8192`)
     */
    private function streamGroqSynthesisWithPool(
        string $groqKey,
        string $preferredModel,
        array $messages,
        callable $onChunk
    ): ?string {
        $models = $this->getGroqModelPool($preferredModel);

        foreach ($models as $modelIdx => $modelId) {
            if ($this->isGroqModelInCooldown($groqKey, $modelId)) {
                continue;
            }

            $payload = [
                'model' => $modelId,
                'messages' => $messages,
                'temperature' => 0.2,
                'max_tokens' => 8192,
                'top_p' => 0.95,
                'stream' => true,
            ];

            $accumulated = '';
            $sseBuffer = '';
            $httpErrorBody = '';

            $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $groqKey,
                'Content-Type: application/json',
                'Accept: text/event-stream'
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) use (&$accumulated, &$sseBuffer, &$httpErrorBody, $onChunk) {
                $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                if ($httpCode >= 400) {
                    $httpErrorBody .= $chunk;
                    return strlen($chunk);
                }

                $sseBuffer .= $chunk;
                while (($pos = strpos($sseBuffer, "\n")) !== false) {
                    $line = trim(substr($sseBuffer, 0, $pos));
                    $sseBuffer = substr($sseBuffer, $pos + 1);

                    if ($line === '' || strpos($line, ':') === 0) {
                        continue;
                    }
                    if (strpos($line, 'data:') === 0) {
                        $dataStr = trim(substr($line, 5));
                        if ($dataStr === '[DONE]') {
                            continue;
                        }
                        $json = json_decode($dataStr, true);
                        if (is_array($json)) {
                            $delta = $json['choices'][0]['delta']['content'] ?? '';
                            if (is_string($delta) && $delta !== '') {
                                $accumulated .= $delta;
                                $onChunk($delta);
                            }
                        }
                    }
                }
                return strlen($chunk);
            });

            curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if (!$curlErr && $httpCode === 200 && trim($accumulated) !== '') {
                return $accumulated;
            }

            error_log("Groq Stream Model #{$modelIdx} ({$modelId}) HTTP {$httpCode} CurlErr={$curlErr} Body=" . substr($httpErrorBody, 0, 300));

            if ($httpCode === 429) {
                $cooldownSec = (stripos($httpErrorBody, 'tokens per day') !== false || stripos($httpErrorBody, 'requests per day') !== false) ? 600 : 35;
                $this->markGroqModelCooldown($groqKey, $modelId, $cooldownSec);
            }
        }

        return null;
    }

    /**
     * Execute Groq Cloud Chat Completion across the ranked model pool (`qwen/qwen3.8-27b` primary) with automatic `tool_use_failed` recovery.
     */
    private function executeGroqRequestWithPool(
        string $groqKey,
        string $preferredModel,
        array $messages,
        array $openAiTools = [],
        ?string $toolChoice = 'auto'
    ): ?array {
        $models = $this->getGroqModelPool($preferredModel);

        foreach ($models as $modelIdx => $modelId) {
            if ($this->isGroqModelInCooldown($groqKey, $modelId)) {
                continue;
            }

            $payload = [
                'model' => $modelId,
                'messages' => $messages,
                'temperature' => 0.2,
                'max_tokens' => 8192,
                'top_p' => 0.95,
            ];

            if (!empty($openAiTools)) {
                $payload['tools'] = $openAiTools;
                if ($toolChoice !== null) {
                    $payload['tool_choice'] = $toolChoice;
                }
            }

            $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $groqKey,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

            $resp = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if (!$curlErr && $httpCode === 200 && $resp) {
                $decoded = json_decode((string)$resp, true);
                if (is_array($decoded) && !empty($decoded['choices'][0]['message'])) {
                    return $decoded;
                }
            }

            $respStr = (string)$resp;

            // Automatic recovery if Groq returns HTTP 400 `tool_use_failed` with `failed_generation`
            if ($httpCode === 400 && stripos($respStr, 'tool_use_failed') !== false) {
                $errDecoded = json_decode($respStr, true);
                $failedGen = (string)($errDecoded['error']['failed_generation'] ?? '');
                if ($failedGen !== '') {
                    if (preg_match('/<function=([a-zA-Z0-9_]+)[>=\s]*(\{[\s\S]*?\})\s*(?:<\/function>|$)/', $failedGen, $fgMatch)) {
                        return [
                            'choices' => [[
                                'message' => [
                                    'role' => 'assistant',
                                    'content' => '',
                                    'tool_calls' => [[
                                        'id' => 'call_' . substr(md5(uniqid('', true)), 0, 8),
                                        'type' => 'function',
                                        'function' => [
                                            'name' => trim($fgMatch[1]),
                                            'arguments' => trim($fgMatch[2])
                                        ]
                                    ]]
                                ]
                            ]]
                        ];
                    }
                    if (preg_match('/"name"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*?"(?:arguments|parameters)"\s*:\s*(\{[\s\S]*?\})/', $failedGen, $fgJsonMatch)) {
                        return [
                            'choices' => [[
                                'message' => [
                                    'role' => 'assistant',
                                    'content' => '',
                                    'tool_calls' => [[
                                        'id' => 'call_' . substr(md5(uniqid('', true)), 0, 8),
                                        'type' => 'function',
                                        'function' => [
                                            'name' => trim($fgJsonMatch[1]),
                                            'arguments' => trim($fgJsonMatch[2])
                                        ]
                                    ]]
                                ]
                            ]]
                        ];
                    }
                }
            }

            error_log("Groq Model #{$modelIdx} ({$modelId}) HTTP {$httpCode} CurlErr={$curlErr} Resp=" . substr($respStr, 0, 350));

            if ($httpCode === 429) {
                $cooldownSec = (stripos($respStr, 'tokens per day') !== false || stripos($respStr, 'requests per day') !== false) ? 600 : 35;
                $this->markGroqModelCooldown($groqKey, $modelId, $cooldownSec);
            }
        }

        return null;
    }

    /**
     * Convert Gemini functionDeclarations into OpenAI / Groq `tools` schema
     * Keeps 100% of parameter names, types, enums, and core semantics while ordering primary filter parameters first for `qwen/qwen3.8-27b`.
     */
    private function convertGeminiToolsToGroq(?array $geminiTools): array {
        $declarations = array_slice($geminiTools[0]['functionDeclarations'] ?? [], 0, 3);
        $openAiTools = [];
        $priorityParamOrder = [
            'owners', 'from_date', 'to_date', 'date_field', 'programs', 'stages', 'stage_op',
            'financial_filter', 'sources', 'branches_or_cities', 'record_type', 'search_query',
            'query', 'contact_id', 'limit'
        ];
        foreach ($declarations as $decl) {
            $name = $decl['name'] ?? '';
            if ($name === '') continue;
            $desc = trim((string)($decl['description'] ?? ''));
            if (mb_strlen($desc, 'UTF-8') > 160) {
                $desc = mb_substr($desc, 0, 160, 'UTF-8');
            }
            $desc .= ' (CHỈ truyền đúng tham số người dùng yêu cầu lọc; BỎ QUA không truyền các tham số khác. Lọc N ngày qua dùng from_date & to_date, cấm dùng stale_days trừ khi hỏi lead bỏ quên).';
            $rawParams = $decl['parameters'] ?? ['type' => 'OBJECT', 'properties' => []];
            if (!empty($rawParams['properties']) && is_array($rawParams['properties'])) {
                $orderedProps = [];
                foreach ($priorityParamOrder as $pKey) {
                    if (isset($rawParams['properties'][$pKey])) {
                        $orderedProps[$pKey] = $rawParams['properties'][$pKey];
                    }
                }
                foreach ($rawParams['properties'] as $k => $v) {
                    if (!isset($orderedProps[$k])) {
                        $orderedProps[$k] = $v;
                    }
                }
                $rawParams['properties'] = $orderedProps;
            }
            $params = $this->normalizeGroqSchemaProperty($rawParams);
            $openAiTools[] = [
                'type' => 'function',
                'function' => [
                    'name' => $name,
                    'description' => $desc,
                    'parameters' => $params,
                ]
            ];
        }
        return $openAiTools;
    }

    private function normalizeGroqSchemaProperty(array $prop): array {
        $out = [];
        $type = strtolower((string)($prop['type'] ?? 'string'));
        if (!in_array($type, ['object', 'string', 'number', 'integer', 'boolean', 'array'], true)) {
            $type = 'string';
        }
        $out['type'] = $type;

        if (!empty($prop['description'])) {
            $pDesc = trim((string)$prop['description']);
            if (mb_strlen($pDesc, 'UTF-8') > 95) {
                $pDesc = mb_substr($pDesc, 0, 95, 'UTF-8');
            }
            $out['description'] = $pDesc;
        }
        if (!empty($prop['enum']) && is_array($prop['enum'])) {
            $out['enum'] = array_values($prop['enum']);
        }
        if ($type === 'object') {
            $props = [];
            if (!empty($prop['properties']) && is_array($prop['properties'])) {
                foreach ($prop['properties'] as $k => $v) {
                    if (is_array($v)) {
                        $props[$k] = $this->normalizeGroqSchemaProperty($v);
                    }
                }
            }
            $out['properties'] = empty($props) ? (object)[] : $props;
            if (!empty($prop['required']) && is_array($prop['required'])) {
                $out['required'] = array_values($prop['required']);
            }
        } elseif ($type === 'array') {
            if (!empty($prop['items']) && is_array($prop['items'])) {
                $out['items'] = $this->normalizeGroqSchemaProperty($prop['items']);
            } else {
                $out['items'] = ['type' => 'string'];
            }
        }
        return $out;
    }

    private function stripReasoningTags(string $text): string {
        if ($text === '') return '';
        $cleaned = preg_replace('/<think>[\s\S]*?<\/think>/i', '', $text);
        return trim((string)$cleaned);
    }

    /**
     * Deterministically preserve /export links and <<<DYNAMIC_CHART:...>>> / <<<ACTION_PROPOSAL:...>>> / <<<ERP_CARD:...>>> tags
     * if the LLM omitted them during Turn 2 synthesis, and suppress stray single ERP_CARD below multi-row tables.
     */
    private function appendMissingDeterministicArtifacts(string $text, array $exportMarkdowns, array $structuredTags, bool $suppressSingleErpCard = false): string {
        if ($text === '') {
            return $text;
        }
        // If multi-row result was returned, strip any hallucinated single <<<ERP_CARD:...>>> below the table
        if ($suppressSingleErpCard && strpos($text, '<<<ERP_CARD:') !== false) {
            $text = trim((string)preg_replace('/<<<ERP_CARD:\s*[\s\S]*?>>>/', '', $text));
        }
        // Strip any LLM-hallucinated <<<ACTION_PROPOSAL:...>>> that does not contain a valid "action_type"
        if (strpos($text, '<<<ACTION_PROPOSAL:') !== false) {
            $text = (string)preg_replace_callback('/<<<ACTION_PROPOSAL:\s*([\s\S]*?)>>>/', function ($m) {
                return (strpos($m[1], '"action_type"') !== false) ? $m[0] : '';
            }, $text);
            $text = trim($text);
        }

        $appendParts = [];
        $uniqueExports = array_values(array_unique(array_filter($exportMarkdowns)));
        if (!empty($uniqueExports) && strpos($text, '/export?') === false) {
            foreach ($uniqueExports as $expMd) {
                $appendParts[] = $expMd;
            }
        }
        $uniqueTags = array_values(array_unique(array_filter($structuredTags)));
        foreach ($uniqueTags as $tagBlock) {
            if (strpos($tagBlock, '<<<DYNAMIC_CHART:') === 0) {
                if (strpos($text, '<<<DYNAMIC_CHART:') === false) {
                    $appendParts[] = $tagBlock;
                } elseif (strpos($tagBlock, '"datasets"') !== false && strpos($text, '"datasets"') === false) {
                    // Replace LLM's partial chart with the full multi-dataset chart from the tool
                    $text = (string)preg_replace('/<<<DYNAMIC_CHART:\s*[\s\S]*?>>>/', $tagBlock, $text, 1);
                }
            } elseif (strpos($tagBlock, '<<<ACTION_PROPOSAL:') === 0 && strpos($text, '<<<ACTION_PROPOSAL:') === false) {
                $appendParts[] = $tagBlock;
            } elseif (!$suppressSingleErpCard && strpos($tagBlock, '<<<ERP_CARD:') === 0 && strpos($text, '<<<ERP_CARD:') === false) {
                $appendParts[] = $tagBlock;
            }
        }
        if (!empty($appendParts)) {
            $text = rtrim($text) . "\n\n" . implode("\n\n", $appendParts);
        }
        return $text;
    }

    /**
     * Get AI Query Audit Logs for QA/QC & Admin Intent Gap Review
     */
    public function getAiAuditLogs(array $auth): void {
        try {
            $userRole = strtolower($auth['role'] ?? '');
            if (!in_array($userRole, ['admin', 'superadmin', 'director', 'manager'], true)) {
                respond(403, null, 'Bạn không có quyền truy cập nhật ký kiểm định AI', false);
                return;
            }

            $tid = (int)($auth['tenant_id'] ?? 1);
            $onlyGaps = isset($_GET['only_gaps']) && $_GET['only_gaps'] === '1';
            $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));

            $sql = "
                SELECT l.*, u.full_name AS user_name
                FROM ai_query_audit_logs l
                LEFT JOIN users u ON l.user_id = u.id
                WHERE l.tenant_id = ?
            ";
            $params = [$tid];
            if ($onlyGaps) {
                $sql .= " AND l.needs_training = 1";
            }
            $sql .= " ORDER BY l.id DESC LIMIT " . (int)$limit;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Compute summary statistics for this tenant
            $stmtStats = $this->db->prepare("
                SELECT 
                    COUNT(*) AS total_queries,
                    SUM(CASE WHEN needs_training = 1 THEN 1 ELSE 0 END) AS total_gaps,
                    SUM(CASE WHEN has_action_proposal = 1 THEN 1 ELSE 0 END) AS total_action_proposals,
                    SUM(CASE WHEN fallback_triggered = 1 THEN 1 ELSE 0 END) AS total_fallbacks
                FROM ai_query_audit_logs
                WHERE tenant_id = ?
            ");
            $stmtStats->execute([$tid]);
            $stats = $stmtStats->fetch(PDO::FETCH_ASSOC) ?: [];

            respond(200, [
                'logs' => $logs,
                'stats' => $stats
            ], 'Lấy nhật ký kiểm định AI thành công', true);
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi lấy nhật ký kiểm định: ' . $e->getMessage(), false);
        }
    }

    /**
     * Trigger Role/Level/Position-Tailored Proactive AI Briefing into SI IDEAS Chat
     */
    public function triggerProactiveBriefing(array $auth): void {
        try {
            require_once __DIR__ . '/../cron_ai_proactive_agent.php';
            $b = getBody();
            $slot = $b['slot'] ?? $_GET['slot'] ?? 'morning';
            if (!in_array($slot, ['morning', 'midday', 'eod'], true)) {
                $slot = 'morning';
            }
            $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'super_admin', 'superadmin', 'director'], true);
            $targetUserId = ($isAdmin && isset($b['user_id'])) ? (int)$b['user_id'] : (int)($auth['user_id'] ?? 0);
            $force = isset($b['force']) ? (bool)$b['force'] : true;

            $result = runProactiveAiAgentBriefings(null, $this->db, [
                'force' => $force,
                'slot' => $slot,
                'target_user_id' => $targetUserId
            ]);
            respond(200, $result, 'Đã gửi bản tin Trợ lý AI chủ động vào hộp chat SI IDEAS', true);
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi kích hoạt bản tin AI chủ động: ' . $e->getMessage(), false);
        }
    }
}
