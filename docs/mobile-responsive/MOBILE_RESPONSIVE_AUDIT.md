# BÁO CÁO TOÀN DIỆN AUDIT UI/UX MOBILE & TABLET (MYERP ENTERPRISE)
## Khảo sát Kiến trúc Giao diện, Điểm nghẽn Responsive & Chiến lược Tách bạch Desktop

---

### 1. TỔNG QUAN KIẾN TRÚC & PHẠM VI AUDIT
Hệ thống MYERP là nền tảng quản trị doanh nghiệp toàn diện gồm 40+ module nghiệp vụ (CRM & Tuyển sinh, Kế toán - Tài chính - Đặt cọc - Duyệt chi, HRM - Chấm công - Bảng lương, Marketing Automation, Omnichannel Bots, WorkChat đa tác tử, Hệ thống phê duyệt, Bàn làm việc số).
Cuộc audit này khảo sát 100% routes trong `src/App.tsx`, toàn bộ components tại `src/pages/**`, `src/pages/marketing/**`, `src/components/**`, các overlays (modals, drawers, popovers, select dropdowns), và các công cụ biên tập đồ sộ (`EmailEditor`, `FlowBuilder`, `SurveyEditor`, `MetaMessenger`, `HrmAccountingAzWorkspace`).

### 2. CHIẾN LƯỢC TÁCH BẠCH 3 TẦNG THIẾT BỊ (DEVICE-TIER SEPARATION)
Tuân thủ nguyên tắc tối thượng trong `writing-block.md`: **"Tuyệt đối không áp dụng phương pháp thu nhỏ Desktop một cách máy móc; Tuyệt đối không làm gãy hoặc giảm trải nghiệm Desktop >= 1280px."**

| Tầng thiết bị | Viewport CSS | Chiến lược Layout & Interaction | Trọng tâm kiểm soát |
|---|---|---|---|
| **Small Mobile** | `320px – 374px` | Single-column, 0 overflow, padding 10–12px, icon + short labels, compact drawer footer | Triệt tiêu 100% bẫy tràn ngang, nút bấm không đè lấn |
| **Standard Mobile** | `375px – 430px` | Single-column, touch momentum, bottom nav bar, contextual actions drawer, full-bleed editors | Thao tác 1 tay tối ưu, không zoom bàn phím ảo |
| **Large Mobile** | `431px – 767px` | 1–2 column adaptive, collapsible filter drawers, sticky dock hành động | Tránh khoảng trống lãng phí, co giãn tỷ lệ |
| **Tablet Portrait** | `768px – 1023px` | 2-column dashboard grids, slide-over navigation overlay, adaptive toolbars | Giữ nhịp làm việc trực quan, không nhồi nhét desktop |
| **Compact Desktop** | `1024px – 1279px` | Bố cục desktop co gọn, sidebar thu nhỏ tự động khi cần | Chuyển tiếp mượt mà |
| **Full Desktop** | `>= 1280px` | **GIỮ NGUYÊN 100% BỐ CỤC, TOOLBAR, MULTI-PANE GỐC** | **ZERO REGRESSION** |

### 3. CÁC ĐIỂM NGHẼN KỸ THUẬT PHÁT HIỆN TỪ AUDIT REPOSITORY

#### 3.1. Bẫy tràn ngang `100vw` (Viewport Horizontal Overflow Traps)
- **Vị trí**:
  - `CustomModal.tsx` & `CustomModal.module.css` (dòng 7, 127, 172, 238): `width: 100vw`, `max-width: 100vw`. Khi thanh cuộn dọc (scrollbar) xuất hiện trên trình duyệt, `100vw` tính cả bề rộng scrollbar (thường là 15-17px) khiến `document.documentElement.scrollWidth > clientWidth`.
  - `EntityDrawer.module.css` (dòng 150-151): `.drawer { width: 100vw !important; max-width: 100vw !important; }`.
  - `CustomerPersonaOverviewDeck.tsx` (dòng 3162): `maxWidth: isMobile ? '100vw' : 'min(95vw, 780px)'`.
  - `SurveyEditor.tsx` (dòng 358, 408): `w-screen h-screen` trong Tailwind gán `width: 100vw`, gây tràn mép ngang trên thiết bị di động có thanh cuộn hoặc notch.
- **Giải pháp**: Thay thế triệt để bằng `width: 100%`, `max-width: 100%`, `box-sizing: border-box`.

#### 3.2. Bẫy chiều rộng tối thiểu cố định (`min-width` Overflow Traps)
- **Vị trí**:
  - `SalesLeadPerformanceDeck.tsx` (dòng 800-812): `<div style={{ minWidth: '210px' }}>` và `<div style={{ minWidth: '195px' }}>` nằm cùng hàng flex. Tổng min-width $210 + 195 = 405\text{px} > 375\text{px}$ (và vượt xa $320\text{px}$), lập tức xé rách container trên di động!
  - `src/index.css` (dòng 314): `.responsive-mapping-header, .responsive-mapping-row { min-width: 600px !important; }` không được bọc trong container `overflow-x: auto`.
- **Giải pháp**: Trên màn hình di động `<768px`, chuyển thành `min-width: 0`, `width: 100%` hoặc lưới thích ứng 1 cột.

#### 3.3. Các công cụ biên tập đồ sộ 3 cột (`EmailEditor`, `FlowBuilder`, `SurveyEditor`)
- **Vị trí**:
  - `EmailEditor/index.tsx`: Trên desktop chia 3 cột: Left Toolbox (260px) + Center Canvas + Right Properties (320px). Trên mobile/tablet, cả 3 cột vẫn đồng thời xuất hiện khiến Canvas bị bóp nghẹt dưới 50px hoặc biến mất.
  - `SurveyEditor.tsx`: Left Toolbox (320px) + Center Canvas + Right Properties (380px) = 700px tối thiểu! Trình duyệt mobile buộc phải co cụm hoặc tràn ngoài khung nhìn.
- **Giải pháp**:
  - **Desktop `>=1024px`**: Giữ nguyên vẹn 3 cột cạnh nhau.
  - **Mobile & Tablet `<1024px`**: Chuyển Left Toolbox và Right Properties thành **Slide-over Drawer / Bottom Sheet có thể toggle 1 chạm qua Floating Action Buttons** (`Toolbox` / `Thuộc tính`), trả lại 100% bề ngang cho Canvas biên tập.

#### 3.4. Bố cục Header & Toolbar bị nhồi nhét icon/nút bấm trên Mobile
- **Vị trí**:
  - `Header.tsx`: Trên màn hình 320–375px, hàng icon bên phải (Launcher + Search + Shield + WorkChat + Bell + Theme + Avatar) chiếm đến ~326px, chèn ép logo và trigger tìm kiếm.
  - `HrmAccountingAzWorkspace.tsx` (dòng 571-617): 5 tab dài ("Tính Lương Gross ⇄ Net", "Sổ Nhật Ký Chung", "Tờ khai TNCN & HTKK XML", "Sổ QLLĐ (NĐ 145)") dùng `flexWrap: 'wrap'` chiếm 4-5 hàng dọc trên di động.
  - `ContactsPage.tsx` & `Dashboard.tsx`: Segmented subtabs bị quấn dòng lộn xộn.
- **Giải pháp**: Áp dụng chuẩn **Touch Horizontal Scroll Strip** (`display: flex; overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -webkit-overflow-scrolling: touch`) với momentum cuộn mượt mà trên cảm ứng.

#### 3.5. Bảng dữ liệu lớn và xung đột Z-Index / Scroll Lock
- **Vị trí**:
  - Các bảng lớn trong `HRM.tsx`, `HrmAccountingAzWorkspace.tsx`, `Approvals.tsx`, `DepositsPage.tsx`, `ExpensesPage.tsx` cần được bọc chặt trong `.responsive-table-wrap` có `max-width: 100%` và `contain: paint`.
  - Đảm bảo hệ thống Z-Index tuân thủ nghiêm ngặt Hiến Chương MYERP: Floating Widget `10005`, Drawer Panel `2147483625`, Modal `2147483645–2147483647`.
