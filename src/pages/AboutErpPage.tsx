import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon } from '../components/common/AppIcons';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Layers,
  GitBranch,
  Target,
  Users,
  BarChart3,
  CheckCircle2,
  Zap,
  Globe,
  Bot,
  FileText,
  GraduationCap,
  CreditCard,
  Clock,
  Scale,
  Filter,
  Search,
  ExternalLink,
  Award,
  Activity,
  Lock,
  Cpu,
  ChevronRight,
  AlertTriangle,
  Building2,
  BookOpen,
  Receipt
} from 'lucide-react';

interface SubTabItem {
  name: string;
  route: string;
  iconName: string;
  badge?: string;
  desc: string;
}

interface ErpPillar {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  iconName: string;
  primaryRoute: string;
  metrics: { label: string; value: string }[];
  highlights: string[];
  workflowSteps: { step: string; title: string; detail: string }[];
  tabs: SubTabItem[];
}

const ERP_PILLARS: ErpPillar[] = [
  {
    id: 'executive_dashboard',
    code: '01',
    title: 'Hệ Thống 8 Dashboard Điều Hành Cấp Cao',
    subtitle: 'Executive Business Intelligence & Real-Time Telemetry',
    iconName: 'Dashboard',
    primaryRoute: '/',
    metrics: [
      { label: 'BỘ BÁO CÁO CHUYÊN SÂU', value: '08 Decks' },
      { label: 'TỐC ĐỘ PHẢN HỒI SWR', value: '0ms Instant' },
      { label: 'ĐỒNG BỘ DỮ LIỆU', value: '4-Way Parity' }
    ],
    highlights: [
      'Chuẩn hóa ngôn ngữ thiết kế Executive Brand Crimson (#C6333D) & Slate (#0F172A) đồng bộ 100% toàn hệ thống.',
      'Tích hợp cơ chế Stale-While-Revalidate (SWR) & File Cache thông minh giúp chuyển đổi giữa 8 bộ Dashboard trong 0ms.',
      'Phân tích sâu từ Chân dung Học viên, Phễu Lead, Hiệu suất Sale, Meta Ads Full-Funnel đến Tài chính, HR và Kế toán - Lương A-Z.'
    ],
    workflowSteps: [
      { step: '01', title: 'Thu thập Thời gian thực', detail: 'Tự động gom dữ liệu từ CRM, Marketing, Học vụ, Đặt cọc, PO/SO và Chấm công.' },
      { step: '02', title: 'Chuẩn hóa Đa chiều', detail: 'Áp dụng cùng một bộ lọc chuẩn trên UI, AI Agent, Phân khúc Marketing và Xuất Excel.' },
      { step: '03', title: 'Drill-down Chi tiết', detail: 'Bấm trực tiếp vào từng cột biểu đồ, nguồn, trường hoặc tư vấn viên để xem danh sách hồ sơ.' },
      { step: '04', title: 'Ra quyết định Tức thì', detail: 'Cảnh báo đỏ/vàng/xanh theo % SLA và độ đầy đủ dữ liệu chân dung.' }
    ],
    tabs: [
      { name: 'Chân dung Học viên', route: '/?tab=persona', iconName: 'Học viên', badge: 'Flagship', desc: 'Phân tích trường/chương trình, giới tính, độ tuổi, ngành nghề, chức danh, top công ty, khu vực & học viên học nhiều khóa.' },
      { name: 'Tổng quan Lead & Phân bổ', route: '/?tab=leads', iconName: 'Tiềm năng', desc: 'Theo dõi tổng data tiếp nhận, chia thành công, tỷ lệ SLA, thống kê theo vòng chia, nguồn data và lỗi ticket.' },
      { name: 'Hiệu suất Sales & Chất lượng', route: '/?tab=sales', iconName: 'Pipeline', badge: 'Real-time', desc: 'Bảng xếp hạng đội ngũ Sale (có Avatar & huy chương), ma trận chuyển đổi theo nguồn và tốc độ phản hồi SLA.' },
      { name: 'Meta Ads Full-Funnel', route: '/?tab=meta_ads', iconName: 'Marketing', badge: 'ROI / ROAS', desc: 'Báo cáo cây Chiến dịch -> Nhóm QC -> Bài QC, tính CPL, CPQ (Qualified), CPW (Won), CPE (Học viên) và ROAS thực tế.' },
      { name: 'Marketing Omnichannel', route: '/marketing', iconName: 'marketing_dashboard', desc: 'Thống kê 4 phân khúc Pipeline động, hiệu suất Email/ZNS, Automation Flows, Khảo sát và Voucher QR.' },
      { name: 'Tài chính & Dòng tiền', route: '/?tab=finance', iconName: 'Dự báo dòng tiền', desc: 'Đối soát P&L, doanh thu thực thu, công nợ học viên, đặt cọc đa đợt và chi phí vận hành.' },
      { name: 'Tổng quan Nhân sự (HR)', route: '/?tab=hrm', iconName: 'Nhân sự & Lương', desc: 'Phân bổ nhân sự & quỹ lương theo phòng ban, tỷ lệ chuyên cần, đi trễ, OT và độ đầy đủ hồ sơ HR.' },
      { name: 'Nghiệp vụ Kế toán & Lương A-Z', route: '/accounting-az', iconName: 'Phiếu lương', badge: 'TT200', desc: 'Tính lương Gross-Net, BHXH 10.5%/23.5%, Thuế TNCN 7 bậc, Sổ Nhật Ký Chung và Tờ khai 05/KK.' }
    ]
  },
  {
    id: 'lead_routing_scoring',
    code: '02',
    title: 'Chia Lead Tự Động, AI Gatekeeper & Chấm Điểm Lead',
    subtitle: 'Smart Lead Distribution, SLA Recall, Fair-Share & 0–100 Scoring Engine',
    iconName: 'Vòng phân bổ',
    primaryRoute: '/rounds',
    metrics: [
      { label: 'THUẬT TOÁN PHÂN BỔ', value: 'Round-Robin+' },
      { label: 'CỔNG LỌC TRƯỚC AI', value: 'AI Gatekeeper' },
      { label: 'THANG ĐIỂM ĐA CHIỀU', value: '0 – 100 Pts' }
    ],
    highlights: [
      'Cổng AI Pre-screener tự động kiểm duyệt chất lượng Lead ngay khi phát sinh: lọc spam, đánh giá bằng cấp/kinh nghiệm và định tuyến vòng dự phòng.',
      'Chia Lead công bằng theo Vòng phân bổ (Round-Robin), tự động kiểm tra ca làm việc, chế độ nghỉ phép, đăng ký trực tối & cuối tuần.',
      'Giám sát SLA phản hồi theo từng phút: tự động thu hồi Lead chưa tương tác và cộng bù vòng tự động khi Ticket báo lỗi Data được duyệt.'
    ],
    workflowSteps: [
      { step: '01', title: 'Thu nhận Đa nguồn & Chống trùng', detail: 'Nhận Lead từ Meta Lead Ads, Website, Zalo, API; kiểm tra trùng SĐT/Email trong chu kỳ 6 tháng.' },
      { step: '02', title: 'AI Pre-Screener Kiểm duyệt', detail: 'Phân loại chuẩn/dưới chuẩn theo quy tắc AI & Manual Rules trước khi đưa vào vòng chia.' },
      { step: '03', title: 'Định tuyến & Chia Vòng', detail: 'Khớp Quy tắc định tuyến (Chương trình, Nguồn, Giờ hành chính/Ngoài giờ) và gán cho TVV đủ điều kiện.' },
      { step: '04', title: 'Đếm ngược SLA & Bù vòng', detail: 'Theo dõi thời gian tiếp nhận; thu hồi nếu quá hạn SLA hoặc cộng bù vòng khi duyệt Ticket data lỗi.' }
    ],
    tabs: [
      { name: 'Vòng phân bổ (Rounds)', route: '/rounds', iconName: 'Vòng phân bổ', badge: 'Core Engine', desc: 'Quản lý danh sách TVV trong từng vòng, trọng số nhận số, trạng thái active/vacation và vòng fallback.' },
      { name: 'Quy tắc định tuyến (Rules)', route: '/rules', iconName: 'Quy tắc định tuyến', desc: 'Thiết lập điều kiện tự động điều phối Lead từ Chiến dịch/Nguồn/Form về đúng Vòng phân bổ mục tiêu.' },
      { name: 'AI Pre-screener (Gatekeeper)', route: '/gatekeeper', iconName: 'AI Pre-screener', badge: 'AI Filter', desc: 'Kiểm tra các Lead đang tạm giữ (Held Leads), cấu hình tiêu chí lọc AI/Hybrid và duyệt đẩy số.' },
      { name: 'Đối soát công bằng (Fair-Share)', route: '/fair-share', iconName: 'Đối soát công bằng', desc: 'Bảng kiểm toán minh bạch số lượng data từng TVV nhận theo vòng, số bù lỗi và phân tích ngoài giờ.' },
      { name: 'Ticket Data lỗi', route: '/tickets', iconName: 'Ticket data lỗi', badge: 'Auto-Compensate', desc: 'TVV gửi báo cáo số sai/thuê bao/trùng kèm minh chứng; duyệt ticket tự động hoàn trả slot nhận bù.' },
      { name: 'Nhật ký Data (Data Logs)', route: '/data', iconName: 'Nhật ký Data', desc: 'Truy vết toàn bộ lịch sử phân bổ, chuyển quyền sở hữu và log hệ thống của từng Lead.' },
      { name: 'Tích hợp Data & Webhook', route: '/integrations', iconName: 'Tích hợp Data', desc: 'Kết nối trực tiếp Facebook Lead Ads, Google Forms, Landing Page Webhook và chuyển đổi CAPI.' }
    ]
  },
  {
    id: 'crm_pipeline_360',
    code: '03',
    title: 'CRM Tuyển Sinh, Pipeline 14 Bước & Hồ Sơ 360°',
    subtitle: '14-Stage Admissions Kanban, 11-Tab Customer 360° Drawer & Revenue Sharing',
    iconName: 'Tiềm năng',
    primaryRoute: '/contacts',
    metrics: [
      { label: 'PHỄU TUYỂN SINH', value: '14 Giai đoạn' },
      { label: 'HỒ SƠ KHÁCH HÀNG 360°', value: '11 Chuyên Tab' },
      { label: 'TỐC ĐỘ KÉO THẢ KANBAN', value: '0ms Optimistic' }
    ],
    highlights: [
      'Quản lý xuyên suốt vòng đời từ Tiềm năng (/contacts) -> Pipeline 14 bước (/deals) -> Học viên chính thức (/students).',
      'Hồ sơ Khách hàng 360° (CustomerProfileDrawer) tích hợp 11 Tab chuyên sâu với bộ SVG App Icon đặc trưng, mở song song với cửa sổ AI Chat.',
      'Hỗ trợ tạo Phiếu Hợp Tác chia sẻ doanh thu (Cooperation Slips) giữa nhiều TVV với quy trình ký số điện tử và phê duyệt minh bạch.'
    ],
    workflowSteps: [
      { step: '01', title: 'Tiếp cận & Ghi nhận Tương tác', detail: 'Gọi điện (QR Call), gửi Email/ZNS, ghi chú CSKH (@Mention đồng nghiệp) và xem nhanh 3 nhật ký mới nhất.' },
      { step: '02', title: 'Dịch chuyển Phễu 14 Bước', detail: 'Kéo thả trên bảng Kanban từ 01-New Lead qua Qualified, Nộp hồ sơ, Đóng lệ phí tới 14-Enrolled.' },
      { step: '03', title: 'Đặt cọc & Hợp tác Doanh thu', detail: 'Tạo đợt đặt cọc (Milestones), lập phiếu hợp tác chia % doanh thu và trình ký điện tử.' },
      { step: '04', title: 'Đồng bộ Học vụ & AI', detail: 'Tự động chuyển trạng thái Học viên, kích hoạt quản lý tiến độ học tập và lưu trữ trọn bộ hồ sơ ZIP.' }
    ],
    tabs: [
      { name: 'Khách hàng Tiềm năng', route: '/contacts', iconName: 'Tiềm năng', badge: 'Smart Filter', desc: 'Bảng dữ liệu CRM tốc độ cao với bộ lọc đa tầng, xem nhanh 3 nhật ký mới nhất khi hover và thao tác hàng loạt.' },
      { name: 'Pipeline Bán hàng (Kanban)', route: '/deals', iconName: 'Pipeline', badge: '14 Stages', desc: 'Quản lý trực quan 14 giai đoạn tuyển sinh, dự báo doanh thu theo xác suất và chuyển giai đoạn tức thì.' },
      { name: 'Bàn làm việc Sale (Workspace)', route: '/workspace', iconName: 'Bàn làm việc', desc: 'Giao diện tác nghiệp hằng ngày cho Tư vấn viên: nhận số mới, lịch hẹn, công việc cần làm và tiến độ KPI.' },
      { name: 'Hồ sơ 360° — 11 Tab Chuyên sâu', route: '/contacts', iconName: 'Thông tin chung', badge: '11 SVG Tabs', desc: 'Gồm: Thông tin chung, Tương tác, Học tập & Học vụ, Phân loại, Công việc, Hồ sơ ZIP, Scoring, Hành trình 360°, Thanh toán, Chi phí, Helpdesk.' },
      { name: 'Phiếu hợp tác (Cooperation Slips)', route: '/cooperation-slips', iconName: 'Đối tác', desc: 'Quản lý chia sẻ tỷ lệ doanh thu giữa các TVV đồng phụ trách kèm chữ ký số của từng bên.' },
      { name: 'Lịch trình & Cuộc hẹn', route: '/calendar', iconName: 'Lịch trình', desc: 'Theo dõi lịch tư vấn 1-1, lịch gọi lại và đồng bộ công việc chăm sóc khách hàng.' },
      { name: 'Helpdesk & Hỗ trợ', route: '/support-tickets', iconName: 'Helpdesk', desc: 'Tiếp nhận và xử lý yêu cầu hỗ trợ kỹ thuật, học vụ hoặc khiếu nại từ học viên.' }
    ]
  },
  {
    id: 'academic_students',
    code: '04',
    title: 'Quản Trị Học Vụ, Chương Trình & Vòng Đời Học Viên',
    subtitle: 'Academic Programs, Intakes, Schedules & Amber Missing-Info Compliance',
    iconName: 'Học viên',
    primaryRoute: '/students',
    metrics: [
      { label: 'TRƯỜNG & CHƯƠNG TRÌNH', value: 'Đa Quốc Tế' },
      { label: 'KIỂM SOÁT HỒ SƠ', value: 'Amber Alert' },
      { label: 'LƯU TRỮ TÀI LIỆU', value: '1-Click ZIP' }
    ],
    highlights: [
      'Hệ thống Cảnh báo Màu Vàng (Amber Warning Badges) tự động phát hiện và nhắc nhở khi Học viên thiếu CCCD, Chức vụ, Công ty, Ngành nghề, Ngày sinh, Email, SĐT.',
      'Quản lý đa chương trình (UBIS, UMEF, ASC, SBS, MSc-AI, Apollos...), theo dõi học viên đăng ký từ 2 chương trình trở lên (Multi-Program).',
      'Quản lý Lịch học nội bộ & Cổng Lịch học Public theo từng Khóa học, Giảng viên và Học viên kèm kho tài liệu đám mây.'
    ],
    workflowSteps: [
      { step: '01', title: 'Tiếp nhận Hồ sơ Nhập học', detail: 'Phân luồng Nộp hồ sơ -> Đóng lệ phí xét duyệt -> Học viên chính thức.' },
      { step: '02', title: 'Rà soát Hồ sơ Chuẩn (Amber Check)', detail: 'Tự động gắn nhãn cảnh báo vàng cho các trường thông tin còn thiếu; bấm vào chip nhảy thẳng tới ô nhập.' },
      { step: '03', title: 'Phân lớp, Khóa học & Lịch giảng', detail: 'Gán học viên vào Khóa/Intake, xếp lịch giảng viên và xuất bản lịch học tra cứu trực tuyến.' },
      { step: '04', title: 'Theo dõi Môn học & Tốt nghiệp', detail: 'Cập nhật điểm số, tiến độ môn học, trạng thái Đang học / Bảo lưu / Tốt nghiệp trong Tab Học tập & Học vụ.' }
    ],
    tabs: [
      { name: 'Học viên Chính thức', route: '/students', iconName: 'Học viên', badge: 'Amber Check', desc: 'Quản lý danh sách học viên theo trạng thái hồ sơ, cảnh báo thiếu thông tin quan trọng và lọc học viên đa khóa.' },
      { name: 'Chương trình Đào tạo', route: '/projects', iconName: 'Chương trình', desc: 'Quản lý danh mục trường/chương trình đào tạo, nhân sự phụ trách (Roster) và không gian công việc dự án.' },
      { name: 'Khóa học & Chiến dịch (Intakes)', route: '/projects?tab=campaigns', iconName: 'Khóa học', desc: 'Quản lý từng đợt khai giảng, chỉ tiêu tuyển sinh và danh sách học viên thuộc khóa.' },
      { name: 'Lịch học & Giảng dạy', route: '/schedules', iconName: 'Lịch học', badge: 'Public Link', desc: 'Lập thời khóa biểu môn học, phân công giảng viên và chia sẻ link lịch học công khai.' },
      { name: 'Đối tác & Giảng viên', route: '/companies', iconName: 'Đối tác', desc: 'Quản lý thông tin trường đối tác quốc tế, doanh nghiệp B2B và hồ sơ giảng viên.' },
      { name: 'Kho Tài liệu & Hồ sơ Cloud', route: '/files', iconName: 'Tài liệu', desc: 'Lưu trữ bằng cấp, CCCD, hợp đồng đào tạo, hỗ trợ trích xuất CCCD bằng AI và tải trọn bộ ZIP.' }
    ]
  },
  {
    id: 'marketing_omnichannel',
    code: '05',
    title: 'Marketing Automation, Omnichannel & Meta Ads Attribution',
    subtitle: 'Visual Flow Builder, Email/ZNS Studio, Social Bot & Full-Funnel Ad ROI',
    iconName: 'Automation',
    primaryRoute: '/marketing',
    metrics: [
      { label: 'KÊNH TƯƠNG TÁC', value: 'Omnichannel' },
      { label: 'PHÂN KHÚC PIPELINE', value: '100% Auto-Sync' },
      { label: 'ĐO LƯỜNG QUẢNG CÁO', value: 'Live Ad Iframe' }
    ],
    highlights: [
      'Đồng bộ tự động 4 Phân khúc Pipeline động (Chưa tương tác [1-2], Qualified [3-12], Won [13-14], Học viên [14]) với CRM theo thời gian thực.',
      'Trình thiết kế Kịch bản Automation kéo-thả (Flow Builder) và Trình thiết kế Email/Survey trực quan mở tức thì (0ms Instant Open).',
      'Báo cáo Meta Ads Full-Funnel kết nối trực tiếp chi phí quảng cáo với doanh thu thực thu tại CRM, hiển thị bản xem trước bài quảng cáo ngay trong Hồ sơ 360°.'
    ],
    workflowSteps: [
      { step: '01', title: 'Thu thập & Định danh Đa kênh', detail: 'Ghi nhận UTM, Web Tracking, Meta Lead ID (Campaign/AdSet/Ad/Form), Survey và QR Voucher.' },
      { step: '02', title: 'Phân khúc Động Tự động', detail: 'Tự động đưa liên hệ vào đúng phân khúc theo giai đoạn Pipeline, chương trình quan tâm và điểm tương tác.' },
      { step: '03', title: 'Kích hoạt Luồng Nuôi dưỡng', detail: 'Tự động gửi chuỗi Email/ZNS cá nhân hóa, phản hồi qua Social Bot (Messenger/Zalo OA) và cộng điểm Scoring.' },
      { step: '04', title: 'Đo lường ROI & Chuyển đổi', detail: 'Đối chiếu chi phí quảng cáo trên từng bài Ad với số lượng Lead Qualified, Won và Học phí thực thu.' }
    ],
    tabs: [
      { name: 'Tổng quan Marketing', route: '/marketing', iconName: 'marketing_dashboard', desc: 'Dashboard phân tích phễu khán giả, hiệu suất kênh gửi và độ đầy đủ dữ liệu Marketing.' },
      { name: 'Kịch bản Automation (Flows)', route: '/marketing/flows', iconName: 'automation_flows', badge: 'Visual Canvas', desc: 'Thiết kế kịch bản chăm sóc tự động đa nhánh theo sự kiện CRM, Tag, Mở mail, Sinh nhật và Win-back.' },
      { name: 'Chiến dịch Email & Broadcast', route: '/marketing/campaigns', iconName: 'email_campaigns', desc: 'Gửi chiến dịch hàng loạt qua Amazon SES / SMTP xác thực, kiểm tra Pre-Send và thống kê Open/Click.' },
      { name: 'Mẫu thiết kế (Email Studio)', route: '/marketing/templates', iconName: 'email_templates', desc: 'Trình kéo-thả khối nội dung Email chuyên nghiệp, thư viện mẫu chuẩn thương hiệu Viện IDEAS.' },
      { name: 'Tệp liên hệ & Phân khúc', route: '/marketing/audience', iconName: 'audience_segments', badge: '4-Way Parity', desc: 'Quản lý Danh sách tĩnh (Lists) và Phân khúc động (Segments) đồng bộ 2 chiều với CRM.' },
      { name: 'Khảo sát & Bài Test (Quiz)', route: '/marketing/surveys', iconName: 'surveys_quiz', desc: 'Tạo form khảo sát/đánh giá năng lực có chấm điểm và đẩy kết quả thẳng vào Timeline 360°.' },
      { name: 'Voucher & QR Sự kiện', route: '/marketing/vouchers', iconName: 'vouchers_qr', desc: 'Phát hành mã ưu đãi học phí và cổng quét QR nhận voucher tích hợp định danh Lead.' },
      { name: 'Social Bot (FB & Zalo OA)', route: '/marketing/social-bot', iconName: 'social_bot', desc: 'Quản lý hội thoại Fanpage Messenger, Zalo OA, kịch bản trả lời tự động và mẫu tin ZNS.' },
      { name: 'Web Tracking & Hành vi', route: '/marketing/web-tracking', iconName: 'web_tracking', desc: 'Theo dõi lịch sử truy cập trang đích, nguồn UTM và hành vi đọc nội dung của từng khách hàng.' },
      { name: 'API Triggers & Webhook', route: '/marketing/api-triggers', iconName: 'api_triggers', desc: 'Cấu hình cổng nhận sự kiện thời gian thực từ các hệ thống bên ngoài để kích hoạt Automation.' }
    ]
  },
  {
    id: 'erp_finance_hrm_approvals',
    code: '06',
    title: 'Quản Trị ERP: Quy Trình, Tài Chính, Nhân Sự & Kế Toán A-Z',
    subtitle: 'Multi-Role Approval Matrix, PO/SO/Deposits, HRM Attendance & TT200 Accounting',
    iconName: 'Quy trình',
    primaryRoute: '/approvals',
    metrics: [
      { label: 'CƠ CHẾ GIAO DỊCH', value: 'ACID Atomic' },
      { label: 'CHUẨN HẠCH TOÁN', value: 'TT200 / TT133' },
      { label: 'BẢO MẬT PHÊ DUYỆT', value: 'Anti-Self-Approve' }
    ],
    highlights: [
      'Trung tâm Quy trình & Phê duyệt (/approvals) tập trung toàn bộ tờ trình Đặt cọc, Chi phí PO, Hợp tác, Nghỉ phép, OT, Tạm ứng với chữ ký số điện tử.',
      'Quản lý Tài chính chặt chẽ: Đặt cọc học phí đa đợt (Sales Orders), Đơn mua hàng & Chi phí (Purchase Orders) và Dự báo dòng tiền.',
      'Phân hệ Nhân sự & Kế toán Lương A-Z tự động tính Gross-to-Net, BHXH (10.5% / 23.5%), Thuế TNCN 7 bậc và sinh Bút toán Nhật ký chung.'
    ],
    workflowSteps: [
      { step: '01', title: 'Khởi tạo Đề xuất / Chứng từ', detail: 'Nhân sự lập phiếu Đặt cọc, Phiếu Chi PO, Đơn xin nghỉ phép/OT/Tạm ứng kèm chứng từ đính kèm.' },
      { step: '02', title: 'Phê duyệt Đa cấp & Ký số', detail: 'Hệ thống định tuyến tới Trưởng bộ phận -> Kế toán / HR -> Ban Giám Đốc (chống tự duyệt phiếu của chính mình).' },
      { step: '03', title: 'Hạch toán Bút toán Tự động', detail: 'Tự động ghi nhận vào Sổ Nhật Ký Chung (TK 111/112, 131, 331, 334, 338, 3335, 511, 641, 642).' },
      { step: '04', title: 'Lên Báo cáo P&L & Quyết toán', detail: 'Tổng hợp Báo cáo Kết quả Kinh doanh, Dòng tiền, Bảng lương tháng và Tờ khai Thuế TNCN 05/KK.' }
    ],
    tabs: [
      { name: 'Trung tâm Quy trình & Phê duyệt', route: '/approvals', iconName: 'Quy trình', badge: 'E-Signature', desc: 'Phê duyệt tập trung toàn bộ phiếu đề xuất trong doanh nghiệp với tốc độ phản hồi 0ms Optimistic.' },
      { name: 'Sales Order & Đặt cọc', route: '/deposits', iconName: 'Sales Order', desc: 'Quản lý các đợt thu học phí/đặt cọc, quy đổi tỷ giá ngoại tệ và đối soát chứng từ chuyển khoản.' },
      { name: 'Purchase Order & Chi phí', route: '/expenses', iconName: 'Purchase Order', desc: 'Quản lý đề xuất chi tiêu, đơn mua hàng, thanh toán nhà cung cấp và phân bổ chi phí theo dự án.' },
      { name: 'Dự báo Dòng tiền (Cashflow)', route: '/cash-flow', iconName: 'Dự báo dòng tiền', desc: 'Theo dõi dòng tiền thực thu, dự kiến thu từ các đợt cọc sắp tới và cân đối nghĩa vụ chi trả.' },
      { name: 'Quản trị Nhân sự & Lương (HRM)', route: '/hrm', iconName: 'Nhân sự & Lương', badge: 'Full Suite', desc: 'Quản lý hồ sơ nhân sự, hợp đồng, bảng lương tháng, KPI, tài sản cấp phát và đề xuất HR.' },
      { name: 'Nghiệp vụ Kế toán & Lương A-Z', route: '/accounting-az', iconName: 'Phiếu lương', badge: 'A-Z Engine', desc: 'Không gian làm việc chuyên sâu cho Kế toán & HR: Tính lương Gross-Net, Sổ Nhật Ký Chung, P&L, Thuế HTKK & Sổ lao động.' },
      { name: 'Quản lý Chấm công', route: '/attendance', iconName: 'Quản lý công', desc: 'Chấm công hàng ngày, theo dõi đi trễ/về sớm, đăng ký ca đêm/cuối tuần và duyệt giải trình công.' },
      { name: 'Nhân sự & Sơ đồ Phòng ban', route: '/consultants', iconName: 'Phòng ban', desc: 'Quản lý danh bạ nhân sự toàn công ty, cấu trúc Team/Phòng ban, ca làm việc và trạng thái nhận Lead.' },
      { name: 'Phiếu lương Cá nhân', route: '/my-payslips', iconName: 'Phiếu lương', desc: 'Cổng tra cứu và xác nhận phiếu lương chi tiết hàng tháng dành cho từng nhân sự.' }
    ]
  },
  {
    id: 'ai_workspace_security',
    code: '07',
    title: 'Trí Tuệ Nhân Tạo Đa Tác Tử SI IDEAS, Workspace & Quản Trị Hệ Thống',
    subtitle: 'Gemini 3.5 Flash-Lite Multi-Agent, WorkChat, Tasks & Zero-Trust RBAC',
    iconName: 'Huấn luyện AI',
    primaryRoute: '/ai-training',
    metrics: [
      { label: 'ĐỘNG CƠ AI TRUNG TÂM', value: 'Gemini 3.5' },
      { label: 'TRÍ NHỚ HỘI THOẠI', value: 'Working Memory' },
      { label: 'BẢO VỆ DỮ LIỆU', value: '100% Soft-Delete' }
    ],
    highlights: [
      'Trợ lý AI Đa Tác Tử SI IDEAS tích hợp bộ nhớ ngữ cảnh <working_memory>, gọi song song nhiều công cụ (Parallel Function Calling) để trả lời các câu hỏi quản trị hóc búa.',
      'Quản lý Công việc & Dự án (Workspace Tasks) hỗ trợ Nhân bản công việc, Lưu trữ/Tắt ẩn, Checklist, Đính kèm tệp tin và bình luận @Mention.',
      'Kiến trúc phân quyền RBAC đa tầng (All / Team / Own), xác thực 2 lớp (2FA TOTP) và bảo toàn lịch sử 100% bằng cơ chế Xóa mềm (Soft-Delete).'
    ],
    workflowSteps: [
      { step: '01', title: 'Truy vấn Ngôn ngữ Tự nhiên', detail: 'Hỏi trực tiếp SI IDEAS bằng tiếng Việt về doanh thu, phễu Lead, hiệu suất Sale, nhân sự hoặc chi phí.' },
      { step: '02', title: 'Định tuyến Công cụ Tinh gọn', detail: 'AI tự động chọn đúng 5–9 công cụ thuộc phân hệ liên quan và kế thừa bộ lọc câu trước qua <working_memory>.' },
      { step: '03', title: 'Thực thi & Đề xuất Hành động', detail: 'Vẽ biểu đồ trực quan, mở Drawer xem hồ sơ song song (Side-by-Side Peek) hoặc tạo thẻ đề xuất giao việc.' },
      { step: '04', title: 'Kiểm soát An toàn Zero-Trust', detail: 'Mọi thao tác đều tuân thủ phân quyền RBAC của người dùng và lưu vết Audit Log đầy đủ.' }
    ],
    tabs: [
      { name: 'Huấn luyện AI & Knowledge Base', route: '/ai-training', iconName: 'Huấn luyện AI', badge: 'SI IDEAS', desc: 'Quản lý kho tri thức nội bộ, kịch bản tư vấn và huấn luyện trợ lý AI Đa Tác Tử.' },
      { name: 'Không gian Dự án & Công việc', route: '/projects', iconName: 'Chương trình', badge: 'Task Engine', desc: 'Quản lý bảng công việc Kanban/List, nhân bản task, tắt ẩn, đính kèm file và tag @Mention.' },
      { name: 'Bảng tin Doanh nghiệp (Feed)', route: '/feed', iconName: 'Bảng tin nội bộ', desc: 'Truyền thông nội bộ, tự động chúc mừng giao dịch chốt thành công và gắn kết đội ngũ.' },
      { name: 'Quản lý Tài khoản & Phân quyền', route: '/accounts', iconName: 'Quản lý tài khoản', desc: 'Thiết lập vai trò (SuperAdmin, Director, Manager, Sale, HR, Accountant, Marketing, Academic) và quyền chi tiết.' },
      { name: 'Cài đặt Hệ thống', route: '/settings', iconName: 'Cài đặt hệ thống', desc: 'Cấu hình giai đoạn Pipeline, thời gian làm việc toàn cục, SMTP/SES, AI Screener và thông số vận hành.' },
      { name: 'Tài liệu Kỹ thuật & API v1', route: '/api-docs', iconName: 'API & Webhook', desc: 'Cổng tài liệu chuẩn OpenAPI / RESTful API v1 và hướng dẫn sử dụng hệ thống (/documentation).' }
    ]
  }
];

const PIPELINE_14_STAGES = [
  { code: '01', name: 'New Lead', vi: 'Lead mới tiếp nhận', group: 'Tương tác đầu', color: '#64748b' },
  { code: '02', name: 'Contact Attempted', vi: 'Đã thử liên hệ', group: 'Tương tác đầu', color: '#64748b' },
  { code: '03', name: 'Contacted', vi: 'Đã liên hệ được', group: 'Tư vấn & Sàng lọc', color: '#334155' },
  { code: '04', name: 'Qualified', vi: 'Đạt chuẩn tiềm năng', group: 'Tư vấn & Sàng lọc', color: '#334155' },
  { code: '05', name: 'Consultation Scheduled', vi: 'Hẹn tư vấn 1-1', group: 'Tư vấn & Sàng lọc', color: '#334155' },
  { code: '06', name: 'Consulted', vi: 'Đã tư vấn chuyên sâu', group: 'Tư vấn & Sàng lọc', color: '#0f172a' },
  { code: '07', name: 'Proposal Sent', vi: 'Đã gửi lộ trình/học phí', group: 'Hồ sơ & Xét duyệt', color: '#0f172a' },
  { code: '08', name: 'Application Submitted', vi: 'Đã nộp hồ sơ', group: 'Hồ sơ & Xét duyệt', color: '#d97706' },
  { code: '09', name: 'Admission Fee Paid', vi: 'Đóng lệ phí hồ sơ', group: 'Hồ sơ & Xét duyệt', color: '#d97706' },
  { code: '10', name: 'Interview / Review', vi: 'Phỏng vấn / Hội đồng duyệt', group: 'Hồ sơ & Xét duyệt', color: '#d97706' },
  { code: '11', name: 'Offer Letter Issued', vi: 'Cấp Thư mời nhập học', group: 'Chốt & Nhập học', color: '#e11d48' },
  { code: '12', name: 'Deposit Paid', vi: 'Đã đặt cọc học phí', group: 'Chốt & Nhập học', color: '#C6333D' },
  { code: '13', name: 'Tuition Paid', vi: 'Hoàn tất học phí đợt 1', group: 'Chốt & Nhập học', color: '#C6333D' },
  { code: '14', name: 'Enrolled (Student)', vi: 'Học viên chính thức', group: 'Chốt & Nhập học', color: '#10b981' }
];

const CUSTOMER_360_TABS = [
  { id: 'info', label: 'Thông tin chung', desc: 'Hồ sơ nhân khẩu học, CCCD, công ty, chức danh, cảnh báo vàng thiếu thông tin & AI phân tích.' },
  { id: 'timeline', label: 'Tương tác', desc: 'Nhật ký cuộc gọi, ghi chú CSKH (@Mention), lịch sử dịch chuyển giai đoạn và hoạt động.' },
  { id: 'learning', label: 'Học tập & Học vụ', desc: 'Mã học viên, khóa/intake, bảng điểm môn học, tín chỉ, trạng thái bảo lưu/tốt nghiệp.' },
  { id: 'tags', label: 'Phân loại', desc: 'Hệ thống nhãn (Tags) phân loại nhu cầu, mức độ ưu tiên và tệp chiến dịch.' },
  { id: 'tasks', label: 'Công việc', desc: 'Danh sách nhiệm vụ nhắc gọi lại, gửi hồ sơ và lịch hẹn gắn với khách hàng.' },
  { id: 'docs', label: 'Hồ sơ & Tài liệu', desc: 'Kho lưu trữ bằng cấp, CCCD (AI OCR), hợp đồng và tải xuống trọn bộ file ZIP.' },
  { id: 'scoring', label: 'Scoring', desc: 'Bảng phân rã điểm Lead Score (0–100) theo tiêu chí nhân khẩu học và hành vi.' },
  { id: 'journey360', label: 'Hành trình', desc: 'Dấu chân số đa kênh (Web, Email, Flow, Quiz, Voucher) & Xem trực tiếp bài quảng cáo Meta Ads.' },
  { id: 'deals', label: 'Thanh toán', desc: 'Quản lý các đợt đặt cọc (Milestones), hóa đơn học phí và lịch sử thanh toán.' },
  { id: 'expenses', label: 'Chi phí', desc: 'Theo dõi các khoản chi phí hoa hồng, đối tác hoặc hỗ trợ gắn liền với hồ sơ.' },
  { id: 'tickets', label: 'Helpdesk', desc: 'Lịch sử phiếu yêu cầu hỗ trợ học vụ và xử lý khiếu nại của học viên.' }
];

export const AboutErpPage: React.FC = () => {
  const navigate = useNavigate();
  const [activePillarId, setActivePillarId] = useState<string>(ERP_PILLARS[0].id);
  const [activePreviewMode, setActivePreviewMode] = useState<'dashboard' | 'routing' | 'drawer360' | 'accounting'>('dashboard');
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(13);

  const activePillar = useMemo(
    () => ERP_PILLARS.find(p => p.id === activePillarId) || ERP_PILLARS[0],
    [activePillarId]
  );

  const allRoutesDirectory = useMemo(() => {
    const items: Array<SubTabItem & { pillarTitle: string; pillarCode: string }> = [];
    ERP_PILLARS.forEach(p => {
      p.tabs.forEach(t => {
        items.push({
          ...t,
          pillarTitle: p.title,
          pillarCode: p.code
        });
      });
    });
    if (!directorySearch.trim()) return items;
    const q = directorySearch.toLowerCase().trim();
    return items.filter(
      it =>
        it.name.toLowerCase().includes(q) ||
        it.desc.toLowerCase().includes(q) ||
        it.route.toLowerCase().includes(q) ||
        it.pillarTitle.toLowerCase().includes(q)
    );
  }, [directorySearch]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflowX: 'hidden'
      }}
    >
      {/* 1. LUXURY STICKY GLASS HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E2E8F0'
        }}
      >
        <div
          style={{
            maxWidth: '1380px',
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #C6333D 0%, #991B1B 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '1.05rem',
                boxShadow: '0 6px 16px rgba(198, 51, 61, 0.25)'
              }}
            >
              ID
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.02em', color: '#0F172A' }}>
                  MYERP IDEAS
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: '#FEF2F2',
                    color: '#C6333D',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}
                >
                  Enterprise Edition
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                Hệ Điều Hành Quản Trị Tuyển Sinh, Học Vụ, Marketing & Tài Chính - Nhân Sự Hợp Nhất
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { label: '7 Phân Hệ Cốt Lõi', target: 'sec-pillars' },
              { label: 'Chia Lead & Scoring', target: 'sec-routing' },
              { label: 'Pipeline 14 Bước & 360°', target: 'sec-pipeline' },
              { label: 'ERP, Quy Trình & Kế Toán A-Z', target: 'sec-erp' },
              { label: 'Danh Mục 50+ Tab', target: 'sec-directory' }
            ].map(nav => (
              <button
                key={nav.target}
                type="button"
                onClick={() => scrollToSection(nav.target)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#F1F5F9';
                  e.currentTarget.style.color = '#C6333D';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#334155';
                }}
              >
                {nav.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                marginLeft: '6px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                background: '#C6333D',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(198, 51, 61, 0.25)'
              }}
            >
              <span>Vào Hệ Thống MYERP</span>
              <ArrowRight size={15} />
            </button>
          </nav>
        </div>
      </header>

      {/* 2. EXECUTIVE BRIGHT LUXURY HERO SECTION */}
      <section
        style={{
          position: 'relative',
          padding: '64px 24px 56px',
          background:
            'radial-gradient(circle at 15% 15%, rgba(198, 51, 61, 0.06) 0%, transparent 45%), radial-gradient(circle at 85% 20%, rgba(15, 23, 42, 0.04) 0%, transparent 50%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderBottom: '1px solid #E2E8F0'
        }}
      >
        <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '940px', margin: '0 auto 40px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '999px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                marginBottom: '20px'
              }}
            >
              <Sparkles size={14} style={{ color: '#C6333D' }} />
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0F172A', letterSpacing: '0.03em' }}>
                KIẾN TRÚC ENTERPRISE SAAS HỢP NHẤT TOÀN DIỆN • ZERO FAKE DATA • 4-WAY DATA PARITY
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 3.8vw, 3.25rem)',
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                color: '#0F172A',
                margin: '0 0 18px'
              }}
            >
              Toàn Bộ Hệ Sinh Thái Quản Trị{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #C6333D 0%, #991B1B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                MYERP IDEAS
              </span>{' '}
              Trên Một Nền Tảng Duy Nhất
            </h1>

            <p
              style={{
                fontSize: '1.05rem',
                lineHeight: 1.65,
                color: '#475569',
                margin: '0 auto 28px',
                maxWidth: '820px',
                fontWeight: 500
              }}
            >
              Kết nối liền mạch từ <strong>Quảng cáo Đa kênh (Meta/Google Ads)</strong>,{' '}
              <strong>Marketing Automation</strong>, <strong>Động cơ Chia Lead & AI Gatekeeper</strong>,{' '}
              <strong>Chấm điểm Lead 0–100</strong>, <strong>Phễu Tuyển Sinh 14 Giai đoạn</strong>,{' '}
              <strong>Hồ sơ Học viên 360°</strong> đến <strong>Tài chính PO/SO/Đặt cọc</strong>,{' '}
              <strong>Nhân sự - Bảng lương - Kế toán TT200 A-Z</strong> và <strong>Trợ lý AI Đa Tác Tử SI IDEAS</strong>.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  padding: '13px 26px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#C6333D',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 24px rgba(198, 51, 61, 0.25)'
                }}
              >
                <span>Mở Dashboard Điều Hành</span>
                <ArrowRight size={17} />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('sec-pillars')}
                style={{
                  padding: '13px 24px',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Layers size={17} style={{ color: '#C6333D' }} />
                <span>Khám Phá Chi Tiết 100% Phân Hệ</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/documentation')}
                style={{
                  padding: '13px 22px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#334155',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <BookOpen size={16} />
                <span>Tài Liệu Hướng Dẫn & API</span>
              </button>
            </div>
          </div>

          {/* 4 CANONICAL EXECUTIVE KPI CARDS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              marginBottom: '36px'
            }}
          >
            {[
              {
                label: 'PHÂN HỆ & MÀN HÌNH NGHIỆP VỤ',
                value: '50+ Tabs',
                isHighlight: false,
                icon: <Layers size={17} />,
                iconBg: 'rgba(189, 29, 45, 0.08)',
                iconColor: '#BD1D2D',
                line1Label: 'Trụ cột quản trị',
                line1Val: '07 Phân hệ lớn',
                line2: 'Bao phủ 100% quy trình từ Marketing tới Kế toán'
              },
              {
                label: 'ĐỘNG CƠ CHIA LEAD & PHỄU CRM',
                value: '14 Bước',
                isHighlight: true,
                icon: <GitBranch size={17} />,
                iconBg: 'rgba(189, 29, 45, 0.08)',
                iconColor: '#BD1D2D',
                line1Label: 'Chấm điểm & Lọc AI',
                line1Val: '0–100 Điểm + Gatekeeper',
                line2: 'Tự động thu hồi SLA & cộng bù vòng công bằng'
              },
              {
                label: 'HỒ SƠ KHÁCH HÀNG & HỌC VIÊN 360°',
                value: '11 Chuyên Tab',
                isHighlight: false,
                icon: <GraduationCap size={17} />,
                iconBg: 'rgba(15, 23, 42, 0.06)',
                iconColor: '#334155',
                line1Label: 'Kiểm soát tuân thủ',
                line1Val: 'Cảnh báo vàng thiếu hồ sơ',
                line2: 'Xem trực tiếp bài quảng cáo Meta Ads khách đã tương tác'
              },
              {
                label: 'TÀI CHÍNH, NHÂN SỰ & AI SI IDEAS',
                value: 'TT200 A-Z',
                isHighlight: false,
                icon: <ShieldCheck size={17} />,
                iconBg: 'rgba(15, 23, 42, 0.06)',
                iconColor: '#334155',
                line1Label: 'Động cơ AI',
                line1Val: 'Gemini 3.5 + Working Memory',
                line2: 'Tự động tính lương Gross-Net, BHXH, Thuế & Nhật ký chung'
              }
            ].map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span
                    style={{
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#64748B'
                    }}
                  >
                    {kpi.label}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: kpi.iconBg,
                      color: kpi.iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {kpi.icon}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    color: kpi.isHighlight ? '#BD1D2D' : '#0F172A',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                    marginBottom: '8px'
                  }}
                >
                  {kpi.value}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5 }}>
                  <div>
                    • {kpi.line1Label}: <strong style={{ color: '#0F172A' }}>{kpi.line1Val}</strong>
                  </div>
                  <div>• {kpi.line2}</div>
                </div>
              </div>
            ))}
          </div>

          {/* INTERACTIVE LIVE ARCHITECTURE PREVIEW SHOWCASE */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                paddingBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
                </div>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', marginLeft: '6px' }}>
                  TRÌNH MÔ PHỎNG KIẾN TRÚC TRỰC QUAN MYERP
                </span>
              </div>

              {/* Canonical Segmented Control */}
              <div
                style={{
                  display: 'inline-flex',
                  padding: '3px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  gap: '2px',
                  flexWrap: 'wrap'
                }}
              >
                {[
                  { id: 'dashboard', label: '8 Bộ Dashboard Điều Hành' },
                  { id: 'routing', label: 'Chia Lead & AI Gatekeeper' },
                  { id: 'drawer360', label: 'Hồ Sơ 360° & Cảnh Báo Vàng' },
                  { id: 'accounting', label: 'Quy Trình & Kế Toán Lương A-Z' }
                ].map(tab => {
                  const isActive = activePreviewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePreviewMode(tab.id as any)}
                      style={{
                        height: '32px',
                        padding: '0 14px',
                        borderRadius: '7px',
                        border: 'none',
                        background: isActive ? '#FFFFFF' : 'transparent',
                        color: isActive ? '#BD1D2D' : '#64748B',
                        fontWeight: isActive ? 700 : 600,
                        fontSize: '0.78rem',
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activePreviewMode === 'dashboard' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {[
                  { title: '1. Chân dung Học viên (Persona)', route: '/?tab=persona', icon: 'Học viên', stat: '8 Chiều Phân Tích', detail: 'Trường, Giới tính, Độ tuổi, Ngành nghề, Chức vụ, Công ty, Tỉnh thành & Học viên đa khóa.' },
                  { title: '2. Tổng quan Lead & Vòng chia', route: '/?tab=leads', icon: 'Tiềm năng', stat: 'Real-time SLA', detail: 'Lưu lượng data theo ngày/giờ, tỷ lệ nhận theo vòng phân bổ, đối soát công bằng & lỗi ticket.' },
                  { title: '3. Hiệu suất Đội ngũ Sales', route: '/?tab=sales', icon: 'Pipeline', stat: 'Leaderboard 🥇🥈🥉', detail: 'Xếp hạng tư vấn viên có Avatar, tỷ lệ tương tác, chuyển đổi Qualified/Won & doanh thu thực thu.' },
                  { title: '4. Meta Ads Full-Funnel ROI', route: '/?tab=meta_ads', icon: 'Marketing', stat: 'CPL • CPQ • CPW • ROAS', detail: 'Cây Campaign -> AdSet -> Ad gắn liền kết quả CRM thực tế và xem trực tiếp bài quảng cáo.' },
                  { title: '5. Marketing Omnichannel', route: '/marketing', icon: 'marketing_dashboard', stat: '4 Pipeline Segments', detail: 'Tự động gom tệp theo giai đoạn Pipeline, đo lường Email/ZNS, Automation Flow, Survey & Voucher.' },
                  { title: '6. Tài chính, HR & Kế toán A-Z', route: '/accounting-az', icon: 'Phiếu lương', stat: 'Chuẩn TT200 / TT133', detail: 'Báo cáo P&L, Dòng tiền, Quỹ lương phòng ban, Sổ Nhật Ký Chung và Tờ khai thuế TNCN.' }
                ].map((card, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(card.route)}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      background: '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AppIcon name={card.icon} size={32} />
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>{card.title}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#FFFFFF',
                          color: '#C6333D',
                          border: '1px solid #E2E8F0'
                        }}
                      >
                        {card.stat}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: '0.79rem', color: '#475569', lineHeight: 1.5 }}>{card.detail}</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, color: '#C6333D' }}>
                      <span>Mở trực tiếp</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activePreviewMode === 'routing' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {[
                  { step: 'BƯỚC 1', title: 'Tiếp nhận & Chống trùng', badge: 'Webhook / Meta Form', desc: 'Tự động chuẩn hóa SĐT/Email, kiểm tra trùng lặp trong 6 tháng và lưu vết Attribution (Campaign, AdSet, Ad, Form).' },
                  { step: 'BƯỚC 2', title: 'AI Pre-Screener (Gatekeeper)', badge: 'AI + Manual Rules', desc: 'Chấm điểm sơ loại bằng AI; tự động giữ lại (Hold) hoặc chuyển sang Vòng dự phòng nếu Lead dưới chuẩn.' },
                  { step: 'BƯỚC 3', title: 'Định tuyến & Vòng chia', badge: 'Round-Robin + Shift', desc: 'Khớp quy tắc Chương trình/Nguồn, kiểm tra ca làm việc, chế độ nghỉ phép, ca trực tối & cuối tuần để chia công bằng.' },
                  { step: 'BƯỚC 4', title: 'Đếm ngược SLA & Thu hồi', badge: 'Auto Lead Recall', desc: 'Giám sát thời gian phản hồi đầu tiên; tự động thu hồi và chuyển TVV khác nếu quá thời gian quy định.' },
                  { step: 'BƯỚC 5', title: 'Báo lỗi Ticket & Bù vòng', badge: '+1 Compensation Slot', desc: 'Khi TVV báo lỗi Data (sai số, thuê bao) được duyệt, hệ thống tự động cộng bù 1 lượt nhận số ở vòng kế tiếp.' }
                ].map((st, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      background: i === 2 ? '#FFF1F2' : '#F8FAFC'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#C6333D' }}>{st.step}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#FFFFFF', color: '#334155', border: '1px solid #E2E8F0' }}>
                        {st.badge}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: '6px' }}>{st.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{st.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {activePreviewMode === 'drawer360' && (
              <div>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.84rem' }}>
                        Cảnh Báo Màu Vàng (Amber Student Compliance):
                      </span>{' '}
                      <span style={{ fontSize: '0.8rem' }}>
                        Khi học viên chưa cập nhật đủ <strong>CCCD, Chức vụ, Công ty, Ngành nghề, Ngày sinh, Email, SĐT</strong>, hệ thống hiển thị huy hiệu vàng tại bảng Học viên & đầu Hồ sơ 360° (bấm nhảy thẳng tới ô nhập).
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/students')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #F59E0B',
                      background: '#FFFFFF',
                      color: '#B45309',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Xem Bảng Học Viên
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
                  {CUSTOMER_360_TABS.map(t => (
                    <div
                      key={t.id}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <AppIcon name={t.label} size={28} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.83rem', color: '#0F172A', marginBottom: '3px' }}>{t.label}</div>
                        <div style={{ fontSize: '0.73rem', color: '#64748B', lineHeight: 1.4 }}>{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePreviewMode === 'accounting' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                {[
                  {
                    title: 'Tính Lương Gross ⇄ Net & BHXH',
                    badge: '10.5% NLĐ / 23.5% DN',
                    desc: 'Tự động kết nối bảng chấm công, nghỉ phép, tăng ca (OT 150%/200%/300%), tạm ứng và phụ cấp miễn thuế.'
                  },
                  {
                    title: 'Thuế TNCN Lũy Tiến 7 Bậc & 05/KK',
                    badge: 'Giảm trừ 11tr + 4.4tr/NPT',
                    desc: 'Tính thuế TNCN lũy tiến 5%–35% hoặc khấu trừ 10% vãng lai; tự động tổng hợp tờ khai 05/KK-TNCN & 05/QTT.'
                  },
                  {
                    title: 'Sổ Nhật Ký Chung (TT200 / TT133)',
                    badge: 'Định khoản Nợ / Có tự động',
                    desc: 'Tự động sinh bút toán từ Phiếu Đặt cọc (TK 131/511), Chi phí PO (TK 641/642/331) và Bảng lương (TK 334/338/3335).'
                  },
                  {
                    title: 'Trung Tâm Phê Duyệt & Chữ Ký Số',
                    badge: 'Multi-Stage Approval',
                    desc: 'Phê duyệt đa cấp có chữ ký điện tử cho Đặt cọc, Phiếu Chi, Phiếu Hợp tác, Nghỉ phép, OT và Bảng lương.'
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate('/accounting-az')}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      background: '#F8FAFC',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>{item.title}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#FEF2F2', color: '#C6333D' }}>
                        {item.badge}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE 7-PILLAR & ALL TABS EXPLORER */}
      <section id="sec-pillars" style={{ padding: '64px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#C6333D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                KIẾN TRÚC PHÂN HỆ TOÀN DIỆN (100% MODULE & TAB INVENTORY)
              </div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Khám Phá Chi Tiết 7 Trụ Cột & Toàn Bộ Các Tab Nghiệp Vụ
              </h2>
            </div>
            <div style={{ fontSize: '0.84rem', color: '#64748B', fontWeight: 500 }}>
              Chọn từng phân hệ bên dưới để xem sơ đồ luồng nghiệp vụ và mở trực tiếp từng Tab
            </div>
          </div>

          {/* Pillar Selector Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
              gap: '10px',
              marginBottom: '28px'
            }}
          >
            {ERP_PILLARS.map(pillar => {
              const isSelected = pillar.id === activePillar.id;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setActivePillarId(pillar.id)}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    border: isSelected ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                    background: isSelected ? '#F8FAFC' : '#FFFFFF',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 8px 20px rgba(15, 23, 42, 0.06)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <AppIcon name={pillar.iconName} size={32} />
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: isSelected ? '#C6333D' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : '#64748B'
                      }}
                    >
                      PHÂN HỆ {pillar.code}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0F172A', lineHeight: 1.35 }}>
                    {pillar.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Detail Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.04)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '20px',
                paddingBottom: '24px',
                borderBottom: '1px solid #F1F5F9',
                marginBottom: '24px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', maxWidth: '760px' }}>
                <AppIcon name={activePillar.iconName} size={52} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#C6333D', textTransform: 'uppercase' }}>
                      TRỤ CỘT {activePillar.code} • {activePillar.subtitle}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', margin: '0 0 10px' }}>
                    {activePillar.title}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {activePillar.highlights.map((hl, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
                        <CheckCircle2 size={16} style={{ color: '#C6333D', flexShrink: 0, marginTop: '2px' }} />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {activePillar.metrics.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        minWidth: '130px'
                      }}
                    >
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: i === 1 ? '#C6333D' : '#0F172A', marginTop: '2px' }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate(activePillar.primaryRoute)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <span>Mở Phân Hệ Này ({activePillar.primaryRoute})</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>

            {/* 4-Step Workflow Strip */}
            <div style={{ marginBottom: '26px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                QUY TRÌNH VẬN HÀNH CHUẨN TRONG PHÂN HỆ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {activePillar.workflowSteps.map((wf, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: idx === 0 ? '#C6333D' : '#0F172A',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {wf.step}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0F172A' }}>{wf.title}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>{wf.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-Tabs Grid */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                DANH SÁCH CÁC TAB & MÀN HÌNH CHỨC NĂNG ({activePillar.tabs.length} TABS)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {activePillar.tabs.map((tab, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate(tab.route)}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#CBD5E1';
                      e.currentTarget.style.background = '#F8FAFC';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.background = '#FFFFFF';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <AppIcon name={tab.iconName} size={32} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>{tab.name}</div>
                            <code style={{ fontSize: '0.7rem', color: '#64748B' }}>{tab.route}</code>
                          </div>
                        </div>
                        {tab.badge && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#FEF2F2',
                              color: '#C6333D'
                            }}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 12px', fontSize: '0.79rem', color: '#475569', lineHeight: 1.5 }}>{tab.desc}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#C6333D' }}>Truy cập ngay</span>
                      <ArrowRight size={14} style={{ color: '#C6333D' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. DEEP-DIVE: SMART LEAD ROUTING, AI GATEKEEPER & LEAD SCORING 0-100 */}
      <section id="sec-routing" style={{ padding: '64px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#C6333D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              CƠ CHẾ TỰ ĐỘNG HÓA TUYỂN SINH CỐT LÕI
            </div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Động Cơ Chia Lead Công Bằng (Fair-Share) & Chấm Điểm Lead Đa Chiều (0–100)
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
            {/* Left Card: Lead Distribution & SLA Engine */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                    Thuật Toán Chia Lead Tự Động & Bù Vòng
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                    Đảm bảo 100% minh bạch, đúng ca trực và không bỏ sót bất kỳ Lead nào
                  </div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#F1F5F9', color: '#334155', fontSize: '0.74rem', fontWeight: 700 }}>
                  Zero Lead Loss
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { rank: '#1', title: 'Cổng AI Pre-Screener (/gatekeeper)', pct: '100%', detail: 'Tự động đánh giá Lead từ Form Quảng cáo; lọc trùng 6 tháng và phân luồng vòng dự phòng nếu dưới chuẩn.' },
                  { rank: '#2', title: 'Định tuyến Đa điều kiện (/rules)', pct: 'Auto', detail: 'Khớp chính xác Nguồn, Chiến dịch, Trường/Chương trình để đưa vào Vòng phân bổ chuyên trách.' },
                  { rank: '#3', title: 'Kiểm tra Ca làm việc & Nghỉ phép', pct: 'Live', detail: 'Tự động đối chiếu lịch làm việc, đơn nghỉ phép đã duyệt (hrm_leave_requests), đăng ký ca đêm & cuối tuần.' },
                  { rank: '#4', title: 'Thu hồi tự động quá hạn SLA (Lead Recall)', pct: 'SLA', detail: 'Đếm ngược thời gian tiếp nhận của Sale; tự động thu hồi và chuyển quyền chăm sóc nếu không phản hồi.' },
                  { rank: '#5', title: 'Duyệt Ticket Lỗi & Cộng Bù Vòng (/tickets)', pct: '+1 Bù', detail: 'Khi Lead bị sai số/thuê bao được duyệt Ticket lỗi, hệ thống tự động ghi nhận slot bù vòng công bằng.' }
                ].map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.8rem', color: idx === 0 ? '#BD1D2D' : '#64748B', minWidth: '24px' }}>
                        {row.rank}
                      </span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>{row.title}</div>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>{row.detail}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: idx === 0 ? '#FEF2F2' : '#E2E8F0',
                        color: idx === 0 ? '#BD1D2D' : '#334155',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        flexShrink: 0
                      }}
                    >
                      {row.pct}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Card: Lead Scoring 0-100 Engine */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                    Hệ Thống Chấm Điểm Lead (Lead Scoring 0–100)
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                    Kết hợp Nhân khẩu học (Profile Fit) & Hành vi Đa kênh (Omnichannel Engagement)
                  </div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', fontSize: '0.74rem', fontWeight: 800 }}>
                  Hot ≥ 80 Điểm
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'Chức danh Quản lý / C-Level (CEO, Director, Manager)', score: '+25 điểm', pct: 92, tone: '#10B981', bg: '#ECFDF5', text: '#059669' },
                  { label: 'Bằng cấp Đại học / Thạc sĩ & Kinh nghiệm ≥ 3 năm', score: '+20 điểm', pct: 85, tone: '#10B981', bg: '#ECFDF5', text: '#059669' },
                  { label: 'Tương tác Chiến dịch Email / Click xem Lộ trình Học phí', score: '+20 điểm', pct: 74, tone: '#F59E0B', bg: '#FFFBEB', text: '#D97706' },
                  { label: 'Hoàn thành Form Khảo sát / Đặt lịch Tư vấn 1-1', score: '+20 điểm', pct: 68, tone: '#F59E0B', bg: '#FFFBEB', text: '#D97706' },
                  { label: 'Hồ sơ thiếu SĐT/Email hoặc Chưa tương tác > 14 ngày', score: 'Cảnh báo', pct: 35, tone: '#EF4444', bg: '#FEF2F2', text: '#DC2626' }
                ].map((sc, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid #F1F5F9'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc.tone }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>{sc.label}</span>
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: sc.bg,
                          color: sc.text,
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}
                      >
                        {sc.score}
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
                      <div style={{ width: `${sc.pct}%`, height: '100%', borderRadius: '999px', background: sc.tone }} />
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  Phân hạng tự động: 🔥 Nóng (80–100) • ☀️ Ấm (50–79) • ❄️ Lạnh (&lt;50)
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/contacts')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#C6333D',
                    color: '#FFFFFF',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Mở Bảng Chấm Điểm
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. DEEP-DIVE: 14-STAGE ADMISSIONS PIPELINE */}
      <section id="sec-pipeline" style={{ padding: '64px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#C6333D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                CHUẨN HÓA HÀNH TRÌNH TUYỂN SINH QUỐC TẾ
              </div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Phễu Tuyển Sinh 14 Giai Đoạn (01 New Lead → 14 Enrolled)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/deals')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <span>Mở Bảng Kanban Pipeline (/deals)</span>
              <ArrowRight size={15} style={{ color: '#C6333D' }} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '10px'
            }}
          >
            {PIPELINE_14_STAGES.map((st, idx) => {
              const isSelected = idx === selectedStageIdx;
              return (
                <div
                  key={st.code}
                  onClick={() => setSelectedStageIdx(idx)}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    border: isSelected ? '1.5px solid #C6333D' : '1px solid #E2E8F0',
                    background: isSelected ? '#FFF1F2' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: isSelected ? '#C6333D' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : '#334155'
                      }}
                    >
                      BƯỚC {st.code}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B' }}>{st.group}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0F172A', marginBottom: '3px' }}>{st.name}</div>
                  <div style={{ fontSize: '0.76rem', color: '#475569' }}>{st.vi}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. DEEP-DIVE: ERP GOVERNANCE, MULTI-ROLE APPROVAL MATRIX & ACCOUNTING A-Z */}
      <section id="sec-erp" style={{ padding: '64px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#C6333D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              QUẢN TRỊ NỘI BỘ, TÀI CHÍNH & NHÂN SỰ CHUẨN ENTERPRISE
            </div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Ma Trận Phê Duyệt Đa Cấp, Đặt Cọc PO/SO & Kế Toán Lương TT200 A-Z
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {[
              {
                icon: 'Quy trình',
                title: 'Trung Tâm Phê Duyệt Đa Cấp (/approvals)',
                route: '/approvals',
                points: [
                  'Hợp nhất phê duyệt Phiếu Đặt cọc, Phiếu Chi (PO), Phiếu Hợp tác, Nghỉ phép, OT, Tạm ứng.',
                  'Tích hợp Chữ ký số điện tử (Signature Pad) tự động lưu file vật lý tối ưu dung lượng.',
                  'Chốt chặn Anti-Self-Approval: người tạo đề xuất không thể tự duyệt phiếu của chính mình.'
                ]
              },
              {
                icon: 'Sales Order',
                title: 'Đặt Cọc Đa Đợt, PO/SO & Dòng Tiền',
                route: '/deposits',
                points: [
                  'Theo dõi đặt cọc học phí theo từng đợt (Milestones), quy đổi ngoại tệ USD/EUR/CHF sang VND.',
                  'Quản lý Purchase Orders (/expenses), Nhà cung cấp (/suppliers) và đối chiếu chứng từ.',
                  'Dự báo dòng tiền (/cash-flow) theo thời gian thực với khóa giao dịch ACID Transaction.'
                ]
              },
              {
                icon: 'Nhân sự & Lương',
                title: 'HRM, Chấm Công & Nghiệp Vụ Kế Toán A-Z',
                route: '/accounting-az',
                points: [
                  'Chấm công tự động, quản lý ca làm việc, ngày phép năm, tăng ca (OT) và đánh giá KPI.',
                  'Tính lương Gross ⇄ Net, bảo hiểm 10.5% / 23.5%, thuế TNCN lũy tiến 7 bậc chuẩn xác.',
                  'Tự động sinh Bút toán Sổ Nhật Ký Chung (TT200/TT133), Báo cáo P&L và Sổ Quản lý Lao động.'
                ]
              },
              {
                icon: 'Huấn luyện AI',
                title: 'AI Đa Tác Tử SI IDEAS & WorkChat Nội Bộ',
                route: '/ai-training',
                points: [
                  'Sử dụng động cơ Gemini 3.5 Flash-Lite tốc độ cao kết hợp bộ nhớ hội thoại <working_memory>.',
                  'Truy vấn chéo đa phân hệ (CRM + Marketing + Tài chính + HR) và vẽ biểu đồ động tức thì.',
                  'Mở Drawer xem hồ sơ khách hàng song song (Side-by-Side Peek) ngay trong lúc chat với AI.'
                ]
              }
            ].map((box, idx) => (
              <div
                key={idx}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <AppIcon name={box.icon} size={40} />
                    <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0F172A' }}>{box.title}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {box.points.map((pt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.81rem', color: '#475569', lineHeight: 1.5 }}>
                        <CheckCircle2 size={15} style={{ color: '#C6333D', flexShrink: 0, marginTop: '2px' }} />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(box.route)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <span>Khám phá {box.route}</span>
                  <ArrowRight size={14} style={{ color: '#C6333D' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. MASTER SEARCHABLE DIRECTORY OF ALL 50+ ROUTES & TABS */}
      <section id="sec-directory" style={{ padding: '64px 24px 80px', background: '#FFFFFF' }}>
        <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '24px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#C6333D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                BẢN ĐỒ ĐIỀU HƯỚNG NHANH TOÀN HỆ THỐNG
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Danh Mục Toàn Bộ Chức Năng & Đường Dẫn Trực Tiếp ({allRoutesDirectory.length} Mục)
              </h2>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                minWidth: '280px'
              }}
            >
              <Search size={16} style={{ color: '#64748B' }} />
              <input
                type="text"
                value={directorySearch}
                onChange={e => setDirectorySearch(e.target.value)}
                placeholder="Tìm nhanh chức năng, tab hoặc đường dẫn..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '0.84rem',
                  color: '#0F172A',
                  width: '100%'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' }}>
            {allRoutesDirectory.map((item, idx) => (
              <div
                key={`${item.route}-${idx}`}
                onClick={() => navigate(item.route)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#C6333D';
                  e.currentTarget.style.background = '#FFF1F2';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                <AppIcon name={item.iconName} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>{item.name}</span>
                    <code style={{ fontSize: '0.68rem', color: '#C6333D', fontWeight: 700 }}>{item.route}</code>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutErpPage;
