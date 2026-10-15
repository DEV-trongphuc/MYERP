/**
 * aiAgents.ts - Specialized Business AI Agents for MYERP
 * Mascot Avatar Stickers from /stickers/ideas/ideas_{id}.webp
 */

export interface SpecializedAgent {
  id: string;
  name: string;
  roleTitle: string;
  category: 'master' | 'tasks' | 'finance' | 'sales' | 'hrm' | 'academic' | 'records_legal' | 'assets_inventory' | 'marketing_campaigns' | 'executive_bi' | 'system_it';
  avatar: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  statusText: string;
  keywords: string[];
  suggestedPrompt: string;
  permissions: string[];
  allowedTools: string[];
  actionProposals: string[];
  synergyWith: string[];
  securityGuardrails: string[];
}

export const SPECIALIZED_AGENTS: SpecializedAgent[] = [
  {
    id: 'master',
    name: 'SI IDEAS',
    roleTitle: 'Chỉ huy & Tri thức',
    category: 'master',
    avatar: '/stickers/ideas/ideas_3.webp',
    badge: 'Chỉ huy',
    badgeColor: '#BD1D2D',
    badgeBg: '#fee2e2',
    description: 'Điều phối chung, tri thức kiểm định quốc tế Swiss UMEF & ISTEC Paris.',
    statusText: 'Đang tổng hợp câu trả lời...',
    keywords: ['viện ideas', 'ideas', 'chính sách', 'quy định', 'kiểm định', 'văn bằng', 'tổng quan', 'hỗ trợ', 'chào', 'hello'],
    suggestedPrompt: 'Giới thiệu kiểm định quốc tế của Swiss UMEF và ISTEC Paris',
    permissions: [
      'Điều phối & phân luồng hội đồng 11 Agent nghiệp vụ',
      'Tra cứu toàn bộ cơ sở tri thức đào tạo & kiểm định quốc tế IDEAS',
      'Phân tích đa phương tiện (Brochure, Hợp đồng, File PDF/Word/Excel)',
      'Truy vết nút thắt phê duyệt và điểm nghẽn quy trình liên phòng ban',
      'Tổng hợp báo cáo đa phân hệ & định tuyến người dùng'
    ],
    allowedTools: ['search_ideas_knowledge', 'get_program_details', 'get_system_navigation', 'get_system_health_status', 'trace_approval_blocker'],
    actionProposals: ['Tất cả các loại Thẻ Hành Động ERP'],
    synergyWith: ['sales', 'academic', 'records_legal', 'finance', 'hrm'],
    securityGuardrails: [
      'Bảo mật phân quyền: Không tự ý ghi đè CSDL, 100% thay đổi phải qua Thẻ Đề Xuất',
      'Tuân thủ bản quyền & quy chế kiểm định giáo dục Thụy Sĩ & Pháp'
    ]
  },
  {
    id: 'tasks',
    name: 'Agent Task',
    roleTitle: 'Kế hoạch & Việc con',
    category: 'tasks',
    avatar: '/stickers/ideas/ideas_16.webp',
    badge: 'Kế hoạch',
    badgeColor: '#2563eb',
    badgeBg: '#dbeafe',
    description: 'Phân rã việc con (WBS), checklist, phân bổ phòng ban, theo dõi deadline.',
    statusText: 'Đang lập kế hoạch & phân rã việc con...',
    keywords: ['task', 'công việc', 'kế hoạch', 'việc con', 'subtask', 'tiến độ', 'deadline', 'giao việc', 'phòng ban', 'checklist', 'dự án'],
    suggestedPrompt: 'Lập kế hoạch 5 bước sự kiện tuyển sinh, chia việc cho Marketing và Sales',
    permissions: [
      'Tra cứu công việc cá nhân & công việc liên quan trên Bàn làm việc',
      'Xem chi tiết tiến độ %, checklist, tài liệu đính kèm của Task',
      'Đề xuất phân rã việc con (WBS) & giao việc cho nhân sự phòng ban',
      'Cảnh báo công việc quá hạn (overdue) và mức độ khẩn cấp'
    ],
    allowedTools: ['get_my_tasks', 'get_task_detail', 'schedule_contact_activity', 'draft_action_proposal'],
    actionProposals: ['Thẻ Giao việc / Phân rã Task (task)'],
    synergyWith: ['hrm', 'sales', 'marketing_campaigns'],
    securityGuardrails: [
      'Chỉ xem các việc do mình tạo, được giao, hoặc được phân quyền giám sát',
      'Phải có người dùng bấm "Lưu công việc" để chính thức tạo task trên hệ thống'
    ]
  },
  {
    id: 'finance',
    name: 'Agent Thu Chi',
    roleTitle: 'Kế toán & PO / SO',
    category: 'finance',
    avatar: '/stickers/ideas/ideas_25.webp',
    badge: 'Tài chính',
    badgeColor: '#059669',
    badgeBg: '#d1fae5',
    description: 'Phiếu chi PO, phiếu thu SO, tiền cọc học phí, tạm ứng và dòng tiền.',
    statusText: 'Đang đối soát số liệu PO / SO & thu chi...',
    keywords: ['chi phí', 'phiếu chi', 'po', 'purchase order', 'phiếu thu', 'so', 'sales order', 'cọc', 'đặt cọc', 'học phí', 'tiền', 'dòng tiền', 'tạm ứng', 'ngân sách', 'hóa đơn', 'công nợ', 'nợ học phí', 'phải thu', 'đợt 2'],
    suggestedPrompt: 'Kiểm tra công nợ học phí các đơn hàng và danh sách cần đôn đốc thu tiền',
    permissions: [
      'Tra cứu lịch sử đặt cọc, phiếu thu học phí của học viên (deposits)',
      'Tra cứu đề xuất thanh toán chi phí & tạm ứng của người dùng',
      'Đôn đốc công nợ học phí và theo dõi tiến độ thanh toán theo đợt',
      'Xem tổng quan doanh thu & dòng tiền tháng (Admin/Kế toán)',
      'Đề xuất lập phiếu chi PO, tạm ứng, và đơn hàng bán SO có chia đợt'
    ],
    allowedTools: ['get_contact_financial_summary', 'lookup_recent_cash_receipts_and_deposits', 'get_my_payment_proposals', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'draft_action_proposal'],
    actionProposals: [
      'Thẻ Đề xuất thanh toán chi phí (expense)',
      'Thẻ Đề xuất tạm ứng công tác (advance_payment)',
      'Thẻ Đơn hàng bán & Lịch trình học phí (sales_order)',
      'Thẻ Đặt cọc / Giữ chỗ học phí (deposit)'
    ],
    synergyWith: ['sales', 'executive_bi', 'records_legal'],
    securityGuardrails: [
      'Kiểm soát hạn mức: Khoản chi >= 5.000.000đ bắt buộc nhắc quy trình 2 cấp duyệt',
      'Chống ghi đè tài chính: Không trừ tiền/cộng tiền tự động mà phải qua sổ quỹ kế toán'
    ]
  },
  {
    id: 'sales',
    name: 'Agent Sales',
    roleTitle: 'Tư vấn & CRM 360°',
    category: 'sales',
    avatar: '/stickers/ideas/ideas_10.webp',
    badge: 'Tư vấn CRM',
    badgeColor: '#d97706',
    badgeBg: '#fef3c7',
    description: 'Tra cứu khách hàng 360°, lịch sử tương tác, kịch bản tư vấn, 12 tình huống chốt sale.',
    statusText: 'Đang phân tích dữ liệu khách hàng & kịch bản tư vấn...',
    keywords: ['lead', 'tiềm năng', 'khách hàng', 'crm', 'tư vấn', 'chốt sale', 'từ chối', 'học viên', 'phễu', 'pipeline', 'chăm sóc', 'từ lúc nào', 'ai chăm sóc', 'note cái gì', 'chuẩn hết chưa', 'bỏ quên', 'ngâm lead', 'hiệu suất sale', 'tỷ lệ chốt'],
    suggestedPrompt: 'Có bao nhiêu Lead đang bị ngâm quá 3 ngày không ai gọi chăm sóc?',
    permissions: [
      'Tra cứu hồ sơ khách hàng 360° (ngày tạo, nguồn lead, người chăm sóc, note, hồ sơ, cọc)',
      'Phân tích hiệu suất chuyển đổi và phát hiện Lead bị gián đoạn chăm sóc',
      'Tìm kiếm khách hàng tiềm năng theo Tên, SĐT, Email trong phạm vi quản lý',
      'Tra cứu hộp thư CRM Inbox và các tương tác gần nhất',
      'Cập nhật bước chuyển phễu Pipeline & thêm ghi chú chăm sóc',
      'Cập nhật thông tin liên hệ (chức danh, công ty, địa chỉ)'
    ],
    allowedTools: ['get_contact_360_profile', 'search_contacts', 'check_lead_duplicate_and_fairshare_status', 'schedule_contact_activity', 'get_my_crm_inbox', 'get_sales_performance_and_stale_leads', 'lookup_recent_cash_receipts_and_deposits', 'update_contact_pipeline', 'add_contact_consultation_note', 'update_contact_profile', 'draft_action_proposal'],
    actionProposals: [
      'Thẻ Thêm học viên / Khách tiềm năng (lead)',
      'Thẻ Đơn hàng bán / Lịch thu học phí (sales_order)',
      'Thẻ Đặt cọc / Giữ chỗ học phí (deposit)'
    ],
    synergyWith: ['records_legal', 'finance', 'academic', 'marketing_campaigns'],
    securityGuardrails: [
      'RBAC nghiêm ngặt: Sale chỉ xem lead do mình phụ trách hoặc được cộng tác',
      'Chống IDOR: Không truy xuất trái phép dữ liệu khách hàng của chi nhánh khác'
    ]
  },
  {
    id: 'hrm',
    name: 'Agent Nhân Sự',
    roleTitle: 'Chấm công & Nhân sự',
    category: 'hrm',
    avatar: '/stickers/ideas/ideas_15.webp',
    badge: 'Nhân sự',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
    description: 'Sơ đồ phòng ban, ai quản lý, nhân sự nghỉ việc, chấm công, nay ai nghỉ & phép.',
    statusText: 'Đang tra cứu sơ đồ phòng ban, nhân sự & lịch nghỉ...',
    keywords: ['chấm công', 'nghỉ phép', 'phép năm', 'giải trình', 'quên chấm', 'đi trễ', 'bổ sung công', 'đổi ca', 'duyệt đơn', 'phiếu lương', 'bảng lương', 'lương', 'phê duyệt', 'công ty có ai', 'phòng ban', 'quản lý', 'trưởng phòng', 'trưởng nhóm', 'leader', 'nhân sự', 'nhân viên', 'nghỉ việc', 'nay ai nghỉ', 'hôm nay ai nghỉ', 'sắp tới ai nghỉ', 'ai nghỉ', 'ai off', 'vắng mặt', 'wfh', 'công tác', 'ai đang giữ đơn', 'kẹt đơn', 'tắc ở đâu'],
    suggestedPrompt: 'Đơn của tôi gửi mấy ngày rồi sao chưa thấy duyệt, hiện đang kẹt ở ai?',
    permissions: [
      'Tra cứu danh bạ nhân sự, sơ đồ quản lý và danh sách nhân sự nghỉ việc',
      'Tra cứu lịch nghỉ phép, vắng mặt toàn viện (hôm nay ai nghỉ, ai sắp nghỉ)',
      'Tra cứu dữ liệu chấm công, phép năm, phiếu lương cá nhân của người dùng',
      'Truy vết chính xác nút thắt phê duyệt đơn từ (ai đang duyệt, cấp 1, cấp 2)',
      'Tra cứu phiếu phê duyệt đang chờ duyệt (nghỉ phép, giải trình công)',
      'Đề xuất tạo đơn xin nghỉ phép, bổ sung công và đổi ca trực'
    ],
    allowedTools: ['get_company_staff_directory', 'get_company_leave_and_absence', 'get_my_attendance_summary', 'get_my_payslip', 'get_pending_approvals', 'trace_approval_blocker', 'draft_action_proposal'],
    actionProposals: [
      'Thẻ Đơn xin nghỉ phép (leave)',
      'Thẻ Giải trình quên chấm công (supplementary)',
      'Thẻ Đề xuất đổi ca trực (shift_swap)'
    ],
    synergyWith: ['tasks', 'assets_inventory', 'executive_bi'],
    securityGuardrails: [
      'Bảo mật lương: Chỉ người dùng mới xem được phiếu lương cá nhân của chính mình',
      'Bảo mật dữ liệu nghỉ việc: Chỉ Quản lý/HR/Admin mới xem được chi tiết lý do nghỉ việc'
    ]
  },
  {
    id: 'academic',
    name: 'Agent Đào Tạo',
    roleTitle: 'Học vụ & Tuyển sinh',
    category: 'academic',
    avatar: '/stickers/ideas/ideas_12.webp',
    badge: 'Học vụ',
    badgeColor: '#0891b2',
    badgeBg: '#cffafe',
    description: 'Chương trình quốc tế: EMBA, MBA, MSc AI, DBA ISTEC Paris, tín chỉ và luận văn.',
    statusText: 'Đang tra cứu khung chương trình & điều kiện...',
    keywords: ['emba', 'mba', 'msc ai', 'dba', 'topup', 'istec', 'umef', 'thụy sĩ', 'pháp', 'học phí', 'tín chỉ', 'ects', 'luận văn', 'capstone', 'khóa học', 'đào tạo'],
    suggestedPrompt: 'So sánh chương trình EMBA và MBA của Swiss UMEF',
    permissions: [
      'Tra cứu khung chương trình đào tạo quốc tế (Swiss UMEF Geneva, ISTEC Paris)',
      'Tra cứu điều kiện xét tuyển, chuẩn đầu vào và lộ trình tín chỉ ECTS',
      'Tra cứu dự án & chương trình đào tạo đang mở tuyển sinh',
      'Tư vấn chính sách bảo lưu, chuyển tiếp tín chỉ và lộ trình luận văn tốt nghiệp'
    ],
    allowedTools: ['get_program_details', 'get_academic_schedule_and_intakes', 'get_active_projects_and_campaigns', 'search_ideas_knowledge'],
    actionProposals: ['Thẻ Đăng ký chương trình đào tạo / Khóa học'],
    synergyWith: ['sales', 'records_legal', 'master'],
    securityGuardrails: [
      'Thông tin học phí & tín chỉ phải chuẩn xác 100% theo quy chế ban hành của Viện IDEAS',
      'Tuyệt đối không hứa hẹn sai về điều kiện công nhận văn bằng'
    ]
  },
  {
    id: 'records_legal',
    name: 'Agent Hồ Sơ & Pháp Lý',
    roleTitle: 'Thẩm định & Hồ sơ 360°',
    category: 'records_legal',
    avatar: '/stickers/ideas/ideas_18.webp',
    badge: 'Thẩm định',
    badgeColor: '#7c2d12',
    badgeBg: '#ffedd5',
    description: 'Thẩm định CCCD, bằng Đại học, bảng điểm, dịch thuật công chứng, hợp đồng đào tạo & cam kết.',
    statusText: 'Đang thẩm định danh mục hồ sơ & hợp đồng...',
    keywords: ['hồ sơ', 'bằng cấp', 'bằng đại học', 'bảng điểm', 'dịch thuật', 'công chứng', 'cccd', 'hộ chiếu', 'cv tiếng anh', 'chứng chỉ', 'ngoại ngữ', 'hợp đồng', 'phụ lục', 'cam kết', 'chuẩn đầu ra', 'xét tuyển', 'chuẩn hết chưa', 'thiếu giấy tờ'],
    suggestedPrompt: 'Kiểm tra học viên Nguyễn Văn An còn thiếu giấy tờ gì trong hồ sơ xét tuyển EMBA?',
    permissions: [
      'Thẩm định hồ sơ tuyển sinh chuẩn quốc tế (CCCD, Bằng ĐH, Bảng điểm, CV tiếng Anh, Dịch thuật)',
      'Tra cứu kho tài liệu đính kèm cloud_files của học viên',
      'Đính kèm / lưu file tài liệu vào hồ sơ học viên CRM từ đoạn chat',
      'Đề xuất Thẻ Thông báo yêu cầu bổ sung hồ sơ và Hợp đồng đào tạo pháp lý'
    ],
    allowedTools: ['check_student_admission_records', 'get_contact_360_profile', 'attach_files_to_contact', 'draft_action_proposal'],
    actionProposals: [
      'Thẻ Yêu cầu bổ sung hồ sơ học viên (admission_document_request)',
      'Thẻ Đề xuất ký kết hợp đồng pháp lý (legal_contract)'
    ],
    synergyWith: ['sales', 'academic', 'finance'],
    securityGuardrails: [
      'Rà soát tính hợp pháp của tài liệu dịch thuật công chứng và thời hạn CCCD/Hộ chiếu',
      'Không tự ý xác nhận đạt chuẩn tuyển sinh nếu thiếu các văn bản bắt buộc'
    ]
  },
  {
    id: 'assets_inventory',
    name: 'Agent Tài Sản & Kho',
    roleTitle: 'Kho & Cấp phát TS',
    category: 'assets_inventory',
    avatar: '/stickers/ideas/ideas_32.webp',
    badge: 'Vật tư & TS',
    badgeColor: '#ea580c',
    badgeBg: '#ffedd5',
    description: 'Quản lý kho ấn phẩm, balo, áo polo, quà tặng tuyển sinh, giáo trình và tài sản công ty.',
    statusText: 'Đang tra cứu tồn kho ấn phẩm & cấp phát tài sản...',
    keywords: ['kho', 'tồn kho', 'ấn phẩm', 'quà tặng', 'túi quà', 'balo', 'áo polo', 'sổ tay', 'bút ký', 'giáo trình', 'tài sản', 'cấp phát', 'bàn giao laptop', 'thu hồi', 'thiết bị', 'hrm_assets'],
    suggestedPrompt: 'Tồn kho túi quà tặng tuyển sinh và sổ tay còn bao nhiêu cái?',
    permissions: [
      'Tra cứu tồn kho ấn phẩm, quà tặng tuyển sinh (áo polo, balo, sổ tay, bút)',
      'Tra cứu tài sản công ty đã bàn giao cho nhân sự (hrm_assets: laptop, thiết bị)',
      'Đề xuất Phiếu nhập kho vật tư / giáo trình',
      'Đề xuất Biên bản bàn giao tài sản và trang thiết bị làm việc'
    ],
    allowedTools: ['get_inventory_and_asset_status', 'draft_action_proposal'],
    actionProposals: [
      'Thẻ Phiếu nhập kho ấn phẩm / vật tư (inventory_receipt)',
      'Thẻ Biên bản bàn giao tài sản thiết bị (asset_handover)'
    ],
    synergyWith: ['hrm', 'finance', 'marketing_campaigns'],
    securityGuardrails: [
      'Tài sản bàn giao bắt buộc phải có mã code và tình trạng thiết bị rõ ràng',
      'Không tự ý xuất kho mà không có phiếu xuất hoặc đề xuất được duyệt'
    ]
  },
  {
    id: 'marketing_campaigns',
    name: 'Agent Marketing',
    roleTitle: 'Chiến dịch & Tăng trưởng',
    category: 'marketing_campaigns',
    avatar: '/stickers/ideas/ideas_20.webp',
    badge: 'Marketing',
    badgeColor: '#db2777',
    badgeBg: '#fce7f3',
    description: 'Chiến dịch tuyển sinh, nguồn Lead, CPL, CAC, broadcast Zalo ZNS / SMS / Email và sự kiện.',
    statusText: 'Đang phân tích hiệu quả chiến dịch & nguồn Lead...',
    keywords: ['marketing', 'chiến dịch', 'nguồn lead', 'cpl', 'cac', 'facebook ads', 'google ads', 'tiktok', 'edufair', 'workshop', 'hội thảo', 'sự kiện', 'broadcast', 'zalo zns', 'sms', 'email marketing'],
    suggestedPrompt: 'Thống kê nguồn Lead tháng này và tỷ lệ chuyển đổi từng kênh',
    permissions: [
      'Tra cứu thống kê hiệu quả nguồn Lead (Facebook Ads, Google Ads, TikTok, Hội thảo)',
      'Đo lường tỷ lệ chuyển đổi từ Lead sang bước cọc/SO theo từng kênh tuyển sinh',
      'Phân tích nội dung quảng cáo, copywriting, brochure và kế hoạch truyền thông',
      'Đề xuất Khởi tạo chiến dịch Marketing mới hoặc sự kiện tuyển sinh EduFair'
    ],
    allowedTools: ['get_campaign_marketing_stats', 'get_active_projects_and_campaigns', 'draft_action_proposal'],
    actionProposals: ['Thẻ Khởi tạo chiến dịch Marketing (marketing_campaign)'],
    synergyWith: ['sales', 'assets_inventory', 'tasks'],
    securityGuardrails: [
      'Bảo mật thông tin chi phí quảng cáo (Ad Spend) theo phân quyền của bộ phận Marketing',
      'Chỉ đề xuất chiến dịch, duyệt ngân sách thuộc thẩm quyền Trưởng phòng / Giám đốc'
    ]
  },
  {
    id: 'executive_bi',
    name: 'Agent Trợ Lý Giám Đốc',
    roleTitle: 'Điều hành & Báo cáo BI',
    category: 'executive_bi',
    avatar: '/stickers/ideas/ideas_31.webp',
    badge: 'Điều hành BI',
    badgeColor: '#b45309',
    badgeBg: '#fef3c7',
    description: 'Báo cáo P&L thời gian thực, dòng tiền ròng, phát hiện bất thường thu chi dành cho Ban Giám đốc.',
    statusText: 'Đang tổng hợp báo cáo điều hành & phân tích P&L...',
    keywords: ['p&l', 'doanh thu tổng', 'dòng tiền ròng', 'báo cáo giám đốc', 'ban giám đốc', 'sức khỏe tài chính', 'bất thường', 'chi phí tổng', 'lợi nhuận', 'kpi toàn viện'],
    suggestedPrompt: 'Báo cáo nhanh mạch tài chính, dòng tiền ròng và doanh thu tuần này',
    permissions: [
      'Báo cáo mạch tài chính tổng thể: Thực thu cọc/học phí, thực chi giải ngân, dòng tiền ròng',
      'Cảnh báo các khoản chi lớn nhất và các biến động bất thường về dòng tiền',
      'Đôn đốc công nợ học phí phải thu và tỷ lệ hoàn thành thu tiền toàn viện',
      'Tổng hợp số lượng đơn cọc mới và tiến độ hoàn thành KPI tuyển sinh toàn viện',
      'Báo cáo P&L thời gian thực phục vụ Ban Giám đốc ra quyết định điều hành'
    ],
    allowedTools: ['get_executive_financial_pulse', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'get_system_health_status'],
    actionProposals: ['Thẻ Báo cáo điều hành P&L', 'Thẻ Khuyến nghị can thiệp dòng tiền'],
    synergyWith: ['finance', 'sales', 'hrm', 'master'],
    securityGuardrails: [
      'Phân quyền tối cao: Chỉ Ban Giám đốc (Director), Superadmin và Kế toán trưởng mới có quyền truy cập',
      'Dữ liệu số liệu tài chính được kiểm toán đối soát trực tiếp từ sổ quỹ và ngân hàng'
    ]
  },
  {
    id: 'system_it',
    name: 'Agent Kỹ Thuật & Vận Hành',
    roleTitle: 'Hỗ trợ IT & Hệ thống',
    category: 'system_it',
    avatar: '/stickers/ideas/ideas_11.webp',
    badge: 'Kỹ thuật IT',
    badgeColor: '#0284c7',
    badgeBg: '#e0f2fe',
    description: 'Giám sát đồng bộ Google Sheets, webhook, cronjob, tra cứu audit log và hỗ trợ lỗi hệ thống.',
    statusText: 'Đang kiểm tra trạng thái hệ thống & nhật ký vận hành...',
    keywords: ['kỹ thuật', 'hệ thống', 'lỗi app', 'webhook', 'sync sheet', 'đồng bộ', 'cronjob', 'audit log', 'ai_query_audit_logs', 'kết nối', 'hỗ trợ it', 'sự cố', 'ticket', 'khiếu nại', 'sla', 'trễ hạn'],
    suggestedPrompt: 'Có ticket hỗ trợ hay khiếu nại nào của học viên bị quá hạn SLA không?',
    permissions: [
      'Kiểm tra tình trạng sức khỏe toàn diện của hệ thống MYERP',
      'Giám sát khiếu nại học viên & phát hiện ticket vi phạm cam kết SLA',
      'Tra cứu nhật ký truy vấn AI (ai_query_audit_logs) và phát hiện các lỗ hổng cần huấn luyện',
      'Theo dõi số lượng nhân sự đang trực tuyến thời gian thực (presence)',
      'Hỗ trợ định hướng link điều hướng và xử lý các sự cố vận hành kỹ thuật'
    ],
    allowedTools: ['get_system_health_status', 'get_ticket_status_and_sla_breaches', 'get_system_navigation'],
    actionProposals: ['Thẻ Báo cáo sự cố hệ thống IT', 'Thẻ Yêu cầu bảo trì kỹ thuật'],
    synergyWith: ['master', 'executive_bi'],
    securityGuardrails: [
      'Không để lộ các thông tin mật như database password, secret key hoặc token trong phản hồi',
      'Chỉ quản trị viên kỹ thuật mới có quyền xem sâu chi tiết lỗi hạ tầng'
    ]
  }
];

/**
 * Intelligent Agent Intent Matcher
 */
export function detectActiveAgent(query: string, toolName?: string, actionType?: string): SpecializedAgent {
  // 1. Direct tool mapping
  if (toolName) {
    if (['get_my_tasks', 'get_task_detail'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'tasks')!;
    }
    if (['get_financial_overview', 'get_my_payment_proposals'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'finance')!;
    }
    if (['get_contact_360_profile', 'search_contacts', 'get_contact_financial_summary', 'get_my_crm_inbox', 'update_contact_pipeline', 'add_contact_consultation_note', 'update_contact_profile'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'sales')!;
    }
    if (['get_pending_approvals', 'get_my_attendance_summary', 'get_my_payslip', 'get_company_staff_directory', 'get_company_leave_and_absence'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'hrm')!;
    }
    if (['get_program_details', 'search_ideas_knowledge', 'get_active_projects_and_campaigns'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'academic')!;
    }
    if (['attach_files_to_contact', 'check_student_admission_records'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'records_legal')!;
    }
    if (['get_inventory_and_asset_status'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'assets_inventory')!;
    }
    if (['get_campaign_marketing_stats'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'marketing_campaigns')!;
    }
    if (['get_executive_financial_pulse'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'executive_bi')!;
    }
    if (['get_system_health_status', 'get_system_navigation'].includes(toolName)) {
      return SPECIALIZED_AGENTS.find(a => a.id === 'system_it')!;
    }
    if (toolName === 'draft_action_proposal') {
      if (actionType === 'task') return SPECIALIZED_AGENTS.find(a => a.id === 'tasks')!;
      if (['expense', 'advance_payment', 'sales_order'].includes(actionType || '')) {
        return SPECIALIZED_AGENTS.find(a => a.id === 'finance')!;
      }
      if (['leave', 'supplementary', 'shift_swap'].includes(actionType || '')) {
        return SPECIALIZED_AGENTS.find(a => a.id === 'hrm')!;
      }
      if (actionType === 'lead') return SPECIALIZED_AGENTS.find(a => a.id === 'sales')!;
      if (['inventory_receipt', 'asset_handover'].includes(actionType || '')) {
        return SPECIALIZED_AGENTS.find(a => a.id === 'assets_inventory')!;
      }
      if (['admission_document_request', 'legal_contract'].includes(actionType || '')) {
        return SPECIALIZED_AGENTS.find(a => a.id === 'records_legal')!;
      }
      if (['marketing_campaign', 'omnichannel_broadcast'].includes(actionType || '')) {
        return SPECIALIZED_AGENTS.find(a => a.id === 'marketing_campaigns')!;
      }
    }
  }

  // 2. Keyword heuristic mapping
  const q = (query || '').toLowerCase();
  if (!q.trim()) return SPECIALIZED_AGENTS[0];

  // Specific domain matching order
  if (q.includes('chuẩn hết chưa') || q.includes('chuẩn chưa') || q.includes('hồ sơ có gì') || q.includes('thiếu giấy tờ') || q.includes('bằng cấp') || q.includes('cccd') || q.includes('hộ chiếu') || q.includes('bảng điểm') || q.includes('dịch thuật') || q.includes('công chứng') || q.includes('cv tiếng anh') || q.includes('hợp đồng đào tạo') || q.includes('phụ lục hợp đồng')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'records_legal')!;
  }
  if (q.includes('từ lúc nào') || q.includes('ai chăm sóc') || q.includes('note cái gì') || q.includes('lịch sử tư vấn') || q.includes('lead') || q.includes('tiềm năng') || q.includes('khách hàng') || q.includes('crm') || q.includes('tư vấn sale') || q.includes('chốt sale') || q.includes('từ chối') || q.includes('chăm sóc')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'sales')!;
  }
  if (q.includes('tồn kho') || q.includes('ấn phẩm') || q.includes('balo') || q.includes('áo polo') || q.includes('sổ tay') || q.includes('quà tặng') || q.includes('giáo trình') || q.includes('tài sản') || q.includes('bàn giao laptop') || q.includes('thu hồi tài sản')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'assets_inventory')!;
  }
  if (q.includes('cpl') || q.includes('cac') || q.includes('facebook ads') || q.includes('google ads') || q.includes('edufair') || q.includes('workshop') || q.includes('chiến dịch') || q.includes('broadcast') || q.includes('zalo zns') || q.includes('marketing')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'marketing_campaigns')!;
  }
  if (q.includes('p&l') || q.includes('doanh thu tổng') || q.includes('dòng tiền ròng') || q.includes('báo cáo ban giám đốc') || q.includes('sức khỏe tài chính') || q.includes('bất thường thu chi')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'executive_bi')!;
  }
  if (q.includes('lỗi app') || q.includes('webhook') || q.includes('sync sheet') || q.includes('cronjob') || q.includes('audit log') || q.includes('kỹ thuật') || q.includes('sự cố hệ thống')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'system_it')!;
  }
  if (q.includes('task') || q.includes('việc con') || q.includes('kế hoạch') || q.includes('subtask') || q.includes('giao việc') || q.includes('phân bổ') || q.includes('tiến độ') || q.includes('công việc')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'tasks')!;
  }
  if (q.includes('chi phí') || q.includes('phiếu chi') || q.includes('po') || q.includes('phiếu thu') || q.includes('so') || q.includes('tạm ứng') || q.includes('tiền cọc') || q.includes('đặt cọc') || q.includes('dòng tiền') || q.includes('mua sắm') || q.includes('ngân sách') || q.includes('đóng tiền')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'finance')!;
  }
  if (q.includes('nghỉ phép') || q.includes('chấm công') || q.includes('bổ sung công') || q.includes('giải trình') || q.includes('đi trễ') || q.includes('quên chấm') || q.includes('phiếu lương') || q.includes('bảng lương') || q.includes('lương') || q.includes('duyệt đơn') || q.includes('phê duyệt') || q.includes('công ty có ai') || q.includes('ai nghỉ')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'hrm')!;
  }
  if (q.includes('lead') || q.includes('tiềm năng') || q.includes('khách hàng') || q.includes('crm') || q.includes('tư vấn sale') || q.includes('chốt sale') || q.includes('từ chối') || q.includes('chăm sóc')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'sales')!;
  }
  if (q.includes('emba') || q.includes('mba') || q.includes('msc ai') || q.includes('dba') || q.includes('topup') || q.includes('istec') || q.includes('umef') || q.includes('tín chỉ') || q.includes('luận văn') || q.includes('tuyển sinh')) {
    return SPECIALIZED_AGENTS.find(a => a.id === 'academic')!;
  }

  return SPECIALIZED_AGENTS[0];
}

