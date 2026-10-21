# DANH MỤC INVENTORY TOÀN BỘ COMPONENT & ROUTES (MYERP ENTERPRISE)
## Khảo sát Toàn diện Tất cả 40+ Tuyến đường, Modal, Drawer, Bảng dữ liệu và Editor Workspace

---

### 1. BẢNG TỔNG QUAN ROUTES & TRANG (SRC/APP.TSX)

| Tuyến đường (Route) | File Component | Phân hệ nghiệp vụ | Hiện trạng Responsive | Chiến lược Chuyển đổi Mobile/Tablet |
|---|---|---|---|---|
| `/` | `Dashboard.tsx` & `SalePortal.tsx` | Trang chủ Điều hành / Bàn làm việc Sales | Bị quấn tab, filter bar dài, biểu đồ donut đè legend | Horizontal scroll tabs, card stack, filter drawer |
| `/workspace` | `SalePortal.tsx` (embed mode) | Bàn làm việc & Task điều hành | Khá tốt, thanh tác vụ cần gọn | Mobile sticky action dock, quick actions |
| `/account` | `SalePortal.tsx` (schedule tab) | Lịch trình & Ca làm việc cá nhân | Bảng ca biểu dài | Horizontal card list theo ngày |
| `/data`, `/contacts` | `ContactsPage.tsx` | CRM & Tuyển sinh (Tiềm năng) | Bảng nhiều cột, toolbar quấn 3 dòng | Mobile cards / clean scroll, mobile more action drawer |
| `/students` | `ContactsPage.tsx` (`customer`) | Quản lý Học viên chính thức, hồ sơ | Tương tự contacts | Card view, phân loại tab con vuốt ngang |
| `/companies` | `CompaniesPage.tsx` | Quản lý Doanh nghiệp & Đối tác | Bảng dữ liệu | Controlled overflow table + drawer |
| `/deals` | `DealsPage.tsx` | Cơ hội & Hợp đồng | Pipeline Kanban & Table | Mobile toggle giữa List và Kanban, compact cards |
| `/quotes` | `QuotesPage.tsx` | Báo giá & Chiết khấu | Form báo giá nhiều cột | Form 1 cột thích ứng |
| `/activities` | `ActivitiesPage.tsx` | Nhật ký tương tác & Cuộc gọi | Timeline nhiều chi tiết | Compact timeline, phone link 1 chạm |
| `/feed` | `EnterpriseFeed.tsx` | Bản tin nội bộ mạng xã hội | Khá tốt | Full-bleed feed, touch lightbox ảnh |
| `/products` | `ProductsPage.tsx` | Khóa học & Sản phẩm | Grid sản phẩm | 2 cột trên Tablet, 1 cột trên Mobile |
| `/expenses` | `ExpensesPage.tsx` | Tài chính & Duyệt chi | Bảng chi phí & Filter date | Controlled scroll table, quick view drawer |
| `/deposits` | `DepositsPage.tsx` | Quản lý Đặt cọc & Dòng tiền | Bảng đặt cọc, phiếu thu | Table card toggle, status badge |
| `/reports-crm` | `ReportsPage.tsx` | Báo cáo CRM & Tỷ lệ chuyển đổi | Biểu đồ Recharts nhiều nhãn | Chart container co giãn 100%, stack dọc |
| `/inventory` | `InventoryPage.tsx` | Kho vận & Vật tư | Data grid | Scroll container độc lập |
| `/tickets` | `Tickets.tsx` / `TicketsPage.tsx` | Báo lỗi Data & Hỗ trợ | Bảng ticket | List view có badge trạng thái |
| `/attendance` | `AttendancePage.tsx` | Chấm công & GPS Check-in | Bản đồ + Bảng công | Stack dọc, GPS full-width trên di động |
| `/hrm` | `HRM.tsx` & `HrmAccountingAzWorkspace` | Quản trị nhân sự & Kế toán A-Z | Bảng lương, sổ lao động rất rộng | Horizontal scroll tabs, tab navigation mượt mà |
| `/my-payslips` | `MyPayslips.tsx` | Phiếu lương cá nhân | Chi tiết lương | Single-column slip view |
| `/approvals` | `Approvals.tsx` | Phê duyệt tổng hợp (Công, Chi, Cọc) | Bảng quy trình, nhiều nút duyệt | Card list, mobile action buttons |
| `/financial-dashboard` | `FinancialDashboard.tsx` | Dashboard Tài chính & Dòng tiền | Grid biểu đồ doanh thu | 1 cột trên mobile, 2 cột tablet |
| `/marketing` | `MarketingDashboardPage.tsx` | Dashboard Marketing | Filter date, biểu đồ phễu | Horizontal scroll period bar, stack charts |
| `/marketing/flows` | `AutomationFlowsPage.tsx` | Tự động hóa Automation Flows | Canvas node kéo thả | Collapsible palette, touch pan canvas |
| `/marketing/campaigns` | `EmailCampaignsPage.tsx` | Chiến dịch Email Marketing | Table danh sách | Responsive list, wizard mobile sheet |
| `/marketing/templates` | `EmailTemplatesPage.tsx` | Mẫu Email & Email Editor | Grid mẫu + Editor 3 cột đồ sộ | Editor: Left/Right thành Drawer trên `<1024px` |
| `/marketing/audience` | `AudienceSegmentsPage.tsx` | Phân khúc khách hàng động & tĩnh | Bảng điều kiện logic | Modal điều kiện full-screen trên mobile |
| `/marketing/surveys` | `SurveysQuizPage.tsx` | Khảo sát & Trắc nghiệm online | Editor 3 cột (Toolbox/Canvas/Props) | Toolbox & Props thành Slide-over Drawers |
| `/marketing/vouchers` | `VouchersQrPage.tsx` | Mã ưu đãi & Voucher QR | Grid voucher | Adaptive grid 1-2 cột |
| `/marketing/social-bot` | `SocialBotPage.tsx` | Meta Messenger & Zalo Bot | Subtabs & 3-pane chat | Single-pane switchable trên mobile |
| `/marketing/web-tracking` | `WebTrackingOmnichannelPage.tsx` | Đo lường đa kênh Omnichannel | Bảng sự kiện & Funnel | Responsive tables + stacked KPI cards |
| `/projects` | `ProjectsPage.tsx` | Quản lý dự án & Nhiệm vụ | Đang do Subagent D hoàn thiện | Tích hợp ở đợt cuối cùng khi Subagent D rảnh |

---

### 2. DANH MỤC MODALS, DRAWERS & OVERLAYS

| Thành phần Overlay | File nguồn | Z-Index quy chuẩn | Thách thức trên Mobile | Giải pháp Responsive |
|---|---|---|---|---|
| `CustomModal` | `src/components/ui/CustomModal.tsx` | `2147483645` | Bẫy `width: 100vw`, padding lố | Chuyển `100vw` thành `100%`, padding thích ứng 12-14px |
| `GlobalConfirmModal` | `src/components/ui/GlobalConfirmModal.tsx` | `2147483646` | Nút xác nhận bị rớt hàng trên 320px | Flex adaptive stack, compact action buttons |
| `CustomSelect` | `src/components/ui/CustomSelect.tsx` | `1000` (dropdown) | Menu dropdown bị tràn mép màn hình phải | Tự động căn lề phải/trái theo tọa độ viewport, max-width 100% |
| `CustomerProfileDrawer` | `src/pages/CustomerProfileDrawer.tsx` | `2147483625` | `100vw` trong css, header quá nhiều tab | Header tabs cuộn ngang mượt mà, `width: 100%` |
| `DepositDetailDrawer` | `src/components/DepositDetailDrawer.tsx` | `2147483625` | Form dài | Sticky header + independent body scroll |
| `ExpenseQuickViewDrawer` | `src/components/ExpenseQuickViewDrawer.tsx` | `2147483625` | Bảng hóa đơn con | Responsive card view |
| `CampaignDetailDrawer` | `CampaignDetailDrawer.tsx` | `2147483625` | Báo cáo gửi nhận | Stack KPI cards |
| `WorkspaceTaskDrawer` | `src/pages/WorkspaceTaskDrawer.tsx` | `2147483625` | Subagent D đang hoàn thiện | Giữ nguyên cho đợt cuối |

---

### 3. CÁC WORKSPACE & BIÊN TẬP ĐỒ SỘ (COMPLEX EDITORS)

| Workspace / Editor | File nguồn | Bố cục Desktop | Bố cục Mobile / Tablet (`<1024px`) |
|---|---|---|---|
| **Email Editor** | `EmailEditor/index.tsx` | TopBar + Left Toolbox (260px) + Center Canvas + Right Properties (320px) | **Canvas chiếm 100% bề ngang**. Hai thanh Toolbox và Properties trở thành **Bottom Sheet / Slide-over Drawer** kích hoạt qua nút nổi hoặc thanh bar dưới đáy. |
| **Survey Editor** | `SurveyEditor.tsx` | TopBar + Left Toolbox (320px) + Canvas + Right Properties (380px) | **Canvas chiếm 100% bề ngang**. Toolbox câu hỏi và Thuộc tính biến thành Drawer trượt ra mượt mà 220ms. |
| **Automation Flow Builder** | `FlowBuilderTab.tsx` | Header + Flow Sidebar + Canvas kéo thả | Canvas full width, bảng node xuất hiện dạng bottom drawer. |
| **Meta Messenger & Zalo Chat** | `MetaCustomers.tsx`, `MetaMessenger.tsx` | 3 cột: Danh sách trang/khách + Khung chat + Thông tin khách | Luồng chuyển đổi 1 pane (Master-Detail): Bấm khách hàng mở khung chat toàn màn hình, nút Back quay lại danh sách. |
| **Hrm Accounting A-Z** | `HrmAccountingAzWorkspace.tsx` | 5 subtabs dài dạng flex-wrap | **Horizontal Swipe Pill Strip** cuộn cảm ứng 1 chạm. |
