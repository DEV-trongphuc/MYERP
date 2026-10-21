# KẾ HOẠCH TRIỂN KHAI NÂNG CẤP RESPONSIVE MOBILE & TABLET (MYERP)
## Triển khai Theo Từng Đợt Kiểm Soát • Bảo toàn 100% Desktop • Kiểm định Đa Viewport Tự động

---

### MỤC TIÊU CHIẾN LƯỢC
1. Biến toàn bộ MYERP thành ứng dụng Web App-like hoàn hảo trên điện thoại và tablet.
2. Tách bạch hoàn toàn: Desktop giữ nguyên 100% bố cục, mật độ và trải nghiệm hiện hữu.
3. Loại bỏ triệt để mọi bẫy tràn ngang `100vw`, lỗi rớt dòng chữ tiếng Việt, padding lố, nút bấm chen chúc.
4. Chuyển đổi các công cụ soạn thảo đồ sộ (`EmailEditor`, `SurveyEditor`, `FlowBuilder`, `MetaMessenger`) từ 3 cột cố định thành Canvas chiếm 100% bề ngang kèm Toolbar/Properties dạng Slide-over Drawer trên Mobile/Tablet (`<1024px`).
5. Đảm bảo Double Build luôn đạt Exit Code 0 (`tsc -b && vite build`) sau từng đợt triển khai.

---

### LỘ TRÌNH 4 ĐỢT TRIỂN KHAI (BATCH IMPLEMENTATION)

```
[Batch 1: Design System & App Shell] 
        ↓  (Verify Build & Viewports 320px–1440px)
[Batch 2: Executive Dashboards & Analytics] 
        ↓  (Verify Build & Charts Responsiveness)
[Batch 3: Core CRM, HRM, Accounting, Approvals] 
        ↓  (Verify Build & Tables Horizontal Scroll)
[Batch 4: Marketing & Complex Editors Toolbar-to-Drawer] 
        ↓  (Verify Canvas 100% & Slide-over Drawers)
[Visual QA & Playwright Multi-Viewport Automated Proof]
```

---

### CHI TIẾT CÁC ĐỢT THỰC HIỆN

#### 🚀 BATCH 1: RESPONSIVE DESIGN SYSTEM, ZERO-OVERFLOW FOUNDATION, APP SHELL & OVERLAYS
- **Phạm vi file**:
  - `src/index.css`: Chuẩn hóa hệ thống media query, thiết lập CSS tokens cho mobile padding (`12px–14px`), rules chống auto-zoom iOS (font-size 16px), quy chuẩn touch momentum, dọn sạch bẫy tràn ngang.
  - `src/components/Layout/Layout.tsx`: Tối ưu khoảng đệm đáy `responsive-main` bù đắp cho Mobile Bottom Nav Bar (`calc(75px + env(safe-area-inset-bottom))`), menu drawer trượt mượt mà.
  - `src/components/Layout/Header.tsx`: Điều chỉnh khoảng cách và padding trên `<480px` và `<375px` để hàng nút icon (Search, Shield, Chat, Bell, Theme, Avatar) không bao giờ bị tràn ngoài màn hình.
  - `src/components/ui/CustomModal.tsx` & `CustomModal.module.css`: Khắc phục triệt để `width: 100vw` thành `width: 100%`, `max-width: 100%`, padding thích ứng 12–14px trên mobile, sticky footer cho nút bấm.
  - `src/components/ui/GlobalConfirmModal.tsx`: Tinh chỉnh nút xác nhận trên `320px–375px` không bị rớt hàng xấu.
  - `src/components/ui/CustomSelect.tsx` & `CustomSelect.module.css`: Định vị thông minh cho dropdown khi gần mép phải màn hình (`max-width: calc(100vw - 20px)`), chống xé khung nhìn.
  - `src/pages/EntityDrawer.module.css`: Xóa bỏ `100vw` trong `.drawer`, đảm bảo drawer hồ sơ khớp khít `100%` viewport mobile.
- **Tiêu chí nghiệm thu Batch 1**:
  - `npm run build` đạt Exit Code 0.
  - Không có bất kỳ lỗi horizontal overflow nào trên App Shell ở viewport 320px, 375px, 768px, 1440px.

---

#### 🚀 BATCH 2: EXECUTIVE DASHBOARDS & ANALYTICS SUITES
- **Phạm vi file**:
  - `src/pages/Dashboard.tsx`: Chuyển thanh segmented subtabs (`Vận hành`, `Tổng quan Học viên`, `Hiệu suất Lead`, `Nhân sự`, `Kế toán`, `Marketing`) thành Touch Horizontal Scroll Strip cuộn ngang mượt mà 1 hàng. Tối ưu KPI cards và layout biểu đồ.
  - `src/components/Dashboard/CustomerPersonaOverviewDeck.tsx`: 
    - Stack Donut chart và bảng xếp hạng trường đào tạo theo chiều dọc trên `<640px` để cả hai có không gian hiển thị tối đa.
    - Sửa bẫy `maxWidth: 100vw` thành `100%`.
    - Thích ứng bộ lọc đa cấp trên màn hình mobile.
  - `src/components/Dashboard/SalesLeadPerformanceDeck.tsx`: 
    - Xóa bỏ `minWidth: 210px` và `minWidth: 195px` cứng, thay bằng adaptive layout co giãn theo container.
    - Giữ trọn vẹn số liệu và drilldown modal.
  - `src/pages/marketing/MarketingDashboardPage.tsx`: Tinh gọn thanh lọc ngày và stack biểu đồ phễu.
  - `src/pages/SalePortal.tsx` & `src/pages/FinancialDashboard.tsx`: Đảm bảo hiển thị sạch trên điện thoại và tablet.
- **Tiêu chí nghiệm thu Batch 2**:
  - `npm run build` đạt Exit Code 0.
  - Toàn bộ biểu đồ Recharts tự động co giãn 100% container, không đè lấn text nhãn, không tràn trang.

---

#### 🚀 BATCH 3: CORE CRM, HRM, ACCOUNTING A-Z, APPROVALS & FINANCE
- **Phạm vi file**:
  - `src/pages/ContactsPage.tsx`: 
    - Tối ưu header toolbar trên `<768px`: Nút Thêm data chính + menu thao tác gọn gàng, tránh quấn dòng 3 hàng.
    - Đảm bảo thanh trạng thái pipeline vuốt chạm mượt mà.
  - `src/components/HRM/HrmAccountingAzWorkspace.tsx`: 
    - Chuyển 5 subtabs dài thành Touch Horizontal Scroll Strip 1 hàng.
    - Bọc bảng Sổ Nhật Ký Chung, Sổ Quản Lý Lao Động trong `.responsive-table-wrap` có cuộn ngang độc lập.
  - `src/pages/HRM.tsx` & `src/pages/Approvals.tsx`: Tối ưu bảng duyệt quy trình, bảng chấm công/lương.
  - `src/pages/DepositsPage.tsx` & `src/pages/ExpensesPage.tsx`: Bảng đặt cọc, chi phí thích ứng.
  - `src/pages/AttendancePage.tsx`: Bản đồ GPS và bảng chấm công co giãn linh hoạt.
  - `src/pages/DealsPage.tsx`: Kanban cột có thể vuốt ngang hoặc chuyển dạng danh sách trên mobile.
  - `src/pages/Consultants.tsx`, `Tickets.tsx`, `Accounts.tsx`, `Settings.tsx`.
- **Tiêu chí nghiệm thu Batch 3**:
  - `npm run build` đạt Exit Code 0.
  - Không có bảng dữ liệu nào đẩy `document.documentElement.scrollWidth > clientWidth`.

---

#### 🚀 BATCH 4: MARKETING & COMPLEX EDITORS TOOLBAR-TO-DRAWER TRANSFORMATION
- **Phạm vi file**:
  - `src/components/marketing/components/templates/EmailEditor/index.tsx`:
    - **Desktop `>=1024px`**: Giữ nguyên vẹn 3 cột (Toolbox 260px, Canvas, Properties 320px).
    - **Mobile & Tablet `<1024px`**: Ẩn các cột cố định; Canvas nhận 100% bề ngang. Thêm **Floating Action Dock / Toggle Buttons** ("Khối nội dung" / "Thuộc tính") mở Slide-over Drawers để chỉnh sửa đầy đủ 100% tính năng trong 1 chạm.
  - `src/components/marketing/components/surveys/SurveyEditor.tsx`:
    - Tương tự Email Editor: Canvas nhận 100% bề ngang trên `<1024px`, Toolbox câu hỏi và Panel thuộc tính mở dạng Drawer/Bottom Sheet.
  - `src/components/marketing/components/flows/FlowBuilderTab.tsx` / `AutomationFlowsPage.tsx`:
    - Tối ưu canvas và node palette trên mobile/tablet.
  - `src/components/marketing/views/MetaMessenger.tsx` & `MetaCustomers.tsx`:
    - Master-Detail navigation trên mobile: Chạm vào khách hàng mở cửa sổ chat toàn màn hình có nút Back.
  - `src/pages/ProjectsPage.tsx` & `src/pages/WorkspaceTaskDrawer.tsx` (Tích hợp sau khi Subagent D hoàn thành).
- **Tiêu chí nghiệm thu Batch 4**:
  - `npm run build` đạt Exit Code 0.
  - Người dùng có thể chỉnh sửa Email và Khảo sát mượt mà trên iPhone/Android với Canvas rộng 100%.

---

### KIỂM ĐỊNH TỰ ĐỘNG & BẰNG CHỨNG THỰC NGHIỆM
- Chạy script kiểm thử Playwright tự động quét đa viewport:
  - Mobile Small: `320 x 568`
  - Mobile Standard: `375 x 812`, `390 x 844`
  - Tablet Portrait: `768 x 1024`
  - Tablet Landscape: `1024 x 768`
  - Desktop: `1440 x 900`
- Đo lường DOM: `hasDocumentHorizontalOverflow === false` trên 100% các màn hình được audit.
- Báo cáo hoàn thiện 12 điểm theo Mục 17 của `writing-block.md`.
