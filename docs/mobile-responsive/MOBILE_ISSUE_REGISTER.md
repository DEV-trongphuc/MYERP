# SỔ ĐĂNG KÝ VẤN ĐỀ RESPONSIVE (MOBILE ISSUE REGISTER)
## Ghi nhận Khiếm khuyết, Phân loại Mức độ Nghiêm trọng & Phương án Xử lý Chuẩn Enterprise

---

### PHÂN LOẠI MỨC ĐỘ ƯU TIÊN
- **P0 (Critical)**: Tràn ngang màn hình (`scrollWidth > clientWidth`), che khuất nút thao tác cốt lõi, không thể mở/đóng modal, vỡ bố cục hoàn toàn.
- **P1 (High)**: Toolbar 3 cột chen chúc làm biến mất canvas, padding lồng nhau làm hẹp nội dung, menu dropdown tràn mép, chữ rớt dòng cụt lủn.
- **P2 (Medium)**: Spacing không đồng đều, thiếu touch momentum, visual hierarchy chưa tối ưu trên màn hình nhỏ.
- **P3 (Polish)**: Hiệu ứng chuyển cảnh micro-interaction, tinh chỉnh nhãn icon.

---

### BẢNG GHI NHẬN CHI TIẾT (ISSUE REGISTER)

| ID | Tuyến / Thành phần | Viewport bị ảnh hưởng | Mô tả lỗi | Mức độ | Nguyên nhân gốc rễ | Phương án khắc phục | Tiêu chí nghiệm thu (AC) |
|---|---|---|---|---|---|---|---|
| **ISS-01** | `CustomModal.tsx` & `.module.css` | `<768px` (320px–430px) | Modal gây tràn ngang do `width: 100vw` khi xuất hiện scrollbar trình duyệt | **P0** | CSS sử dụng đơn vị `100vw` thay vì `100%`, bao gồm cả độ rộng scrollbar | Đổi toàn bộ `100vw` thành `100%`, thêm `box-sizing: border-box`, tinh chỉnh padding 12–14px | `document.documentElement.scrollWidth <= clientWidth`, không cuộn ngang |
| **ISS-02** | `EntityDrawer.module.css` | `<1024px` | Drawer hồ sơ khách hàng/lead gây tràn ngang hoặc lệch vị trí | **P0** | `.drawer { width: 100vw !important; max-width: 100vw !important; }` | Đổi sang `width: 100% !important; max-width: 100% !important; left: 0 !important;` | Mở drawer hồ sơ trên 375px & 768px khớp khít 100% màn hình |
| **ISS-03** | `Header.tsx` | `320px – 375px` | Hàng nút icon bên phải (Search + Shield + Chat + Bell + Theme + User) chen chúc vượt quá bề rộng màn hình | **P0** | Quá nhiều nút icon 36x36px với gap 14px và padding 20px ($>320\text{px}$) | Giảm gap trên `<480px` còn 6px, ẩn bớt icon phụ vào menu hoặc co gọn padding header còn 10px | Header trên 320px không bị tràn mép ngang |
| **ISS-04** | `SalesLeadPerformanceDeck.tsx` | `<768px` | Thanh filter chứa 2 dropdown có `minWidth: 210px` và `minWidth: 195px` xé rách container | **P0** | `minWidth` cố định tổng cộng $>405\text{px}$ trong flex container | Chuyển sang adaptive grid 1 cột hoặc 2 cột co giãn linh hoạt theo container | Container không bị kéo giãn quá chiều rộng viewport |
| **ISS-05** | `EmailEditor/index.tsx` | `<1024px` | Màn hình soạn thảo Email hiển thị đồng thời cả 3 cột (Toolbox 260px, Canvas, Properties 320px) khiến canvas bị ép nghẹt | **P1** | Bố cục desktop cố định 3 cột flex ngang không có media query tách thành drawer trên mobile/tablet | Giữ nguyên desktop `>=1024px`. Trên `<1024px`, chuyển Toolbox và Properties thành Slide-over Drawers với nút mở nổi | Canvas chiếm 100% chiều rộng di động, mở panel thuộc tính mượt mà |
| **ISS-06** | `SurveyEditor.tsx` | `<1024px` | Tương tự Email Editor, Toolbox câu hỏi (320px) và Thuộc tính (380px) chen chúc đè bẹp Canvas khảo sát | **P1** | 3-column layout cố định $320 + 380 = 700\text{px}$ | Giữ nguyên desktop. Trên `<1024px`, Toolbox và Properties chuyển thành Drawer trượt ra khi cần | Canvas hiển thị đầy đủ trên màn hình 375px, 768px |
| **ISS-07** | `CustomerPersonaOverviewDeck.tsx` | `<640px` | Biểu đồ Donut trường đào tạo và danh sách xếp hạng nằm cạnh nhau bị đè chữ | **P1** | Grid template 2 cột cạnh nhau trên màn hình hẹp | Stack dọc Donut lên trên hoặc danh sách lên trên trên `<640px` | Biểu đồ có bán kính đầy đủ, chữ không bị đè lấn |
| **ISS-08** | `HrmAccountingAzWorkspace.tsx` | `<768px` | 5 tab con dài bị quấn thành 4-5 hàng dọc chiếm hết không gian màn hình | **P1** | `display: inline-flex; flex-wrap: wrap;` trên danh sách tab có nhãn dài | Chuyển sang Horizontal Swipe Pill Strip (`overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none`) | Thanh tab cuộn mượt mà 1 hàng, chạm vuốt dễ dàng |
| **ISS-09** | `Dashboard.tsx` | `<768px` | Thanh segmented subtabs (Vận hành, Học viên, Hiệu suất, Nhân sự, Kế toán, Marketing) quấn 3-4 dòng | **P1** | Bố cục flex wrap không kiểm soát | Áp dụng Horizontal Swipe Strip với touch momentum | Hiển thị 1 hàng duy nhất có thể cuộn ngang nhẹ nhàng |
| **ISS-10** | `CustomSelect.module.css` | `<768px` | Menu dropdown mở ra bị lố cạnh phải màn hình khi trigger nằm gần mép phải | **P1** | Menu có `min-width: 100%; width: max-content; left: 0` | Thêm định vị thông minh: nếu nằm nửa phải màn hình thì tự động căn `right: 0; left: auto`, kèm `max-width: calc(100vw - 24px)` | Không có dropdown nào bị cắt mất một nửa nội dung |
| **ISS-11** | `GlobalConfirmModal.tsx` | `320px – 375px` | Hàng 3 nút xác nhận (Hủy, Thao tác phụ, Xác nhận) bị tràn hoặc ép chữ xuống dòng xấu | **P2** | 3 nút dàn ngang với padding lớn | Trên màn hình `<375px`, chuyển thành flex column-reverse hoặc co gọn padding chữ | Chữ trên nút hiển thị nguyên vẹn, dễ bấm bằng ngón cái |
| **ISS-12** | `ContactsPage.tsx` | `<768px` | Nút "Thêm data" và "Giao data" quấn hàng lộn xộn với tiêu đề | **P2** | Header action bar dài | Tối ưu hàng nút: "Thêm" (chính) + icon giao data hoặc rút gọn nhãn trên `<640px` | Giao diện thanh thoát, không rớt dòng bất thường |
| **ISS-13** | `Approvals.tsx` & `HRM.tsx` | `<1024px` | Bảng duyệt công, bảng lương nhiều cột bị co rúm chữ | **P2** | Table không có wrapper cuộn ngang độc lập | Bọc chặt bảng bằng `.responsive-table-wrap` có bóng mờ báo hiệu cuộn ngang | Toàn trang không bị cuộn ngang, bảng cuộn mượt |
| **ISS-14** | `Layout.tsx` | Tất cả mobile | Khoảng đệm đáy bị thanh bottom nav bar che khuất nội dung trang | **P2** | Nội dung trang không có padding-bottom bù cho bottom nav bar | Quy chuẩn `padding-bottom: calc(75px + env(safe-area-inset-bottom, 0px)) !important` trên `.responsive-main` | Nội dung và nút cuối cùng của trang không bao giờ bị che |
| **ISS-15** | Toàn hệ thống inputs | iOS / Safari | Trình duyệt tự phóng to (auto-zoom) khi người dùng chạm vào ô nhập liệu | **P2** | Font size của input nhỏ hơn 16px trên iOS | Đảm bảo `font-size: 16px !important;` cho toàn bộ input/select trên mobile trong `src/index.css` | Bàn phím ảo mở lên không làm giật zoom trang |
