# HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (LARGE-SCALE ENTERPRISE SAAS CONSTITUTION) & GIAO THỨC KIỂM ĐỊNH ĐỐI KHÁNG ZERO-TRUST — DỰ ÁN MYERP

---

## ⚡ CHƯƠNG I: 5 NGUYÊN TẮC TỐI THƯỢNG CỦA HỆ THỐNG LỚN (MISSION-CRITICAL AXIOMS)

1. **CHÂN LÝ THỰC NGHIỆM LÀ DUY NHẤT (Empirical Ground Truth Only)**
   - Nghiêm cấm mọi câu trả lời mang tính phỏng đoán (*"Về lý thuyết đã chạy"*, *"Chắc do cache"*, *"Tôi đã sửa xong"* khi chưa có log thực thi).
   - Mọi khẳng định hoàn thành bắt buộc phải chứng minh bằng **4 Bằng Chứng Thực Nghiệm (4-Point Proof)**:
     1. **Exact Code Diff**: Đường dẫn file và số dòng chính xác (`[File.php](file:///.../File.php#L100-L140)`).
     2. **Zero-Error Double Build**: Frontend `npm run build` (`tsc -b && vite build`) **Exit Code 0** VÀ Backend `php -l` trên 100% file chỉnh sửa đạt **`No syntax errors detected`**.
     3. **Live Runtime & SQL Execution Proof**: Kết quả thực thi SQL/API thực tế từ MySQL & PHP, kiểm chứng đúng dữ liệu tới từng bản ghi, từng đồng doanh thu/cọc/lương.
     4. **Adversarial & Boundary Self-Test**: Đã kiểm thử thực tế kịch bản 0 bản ghi (Empty State), giá trị `NULL`, mảng rỗng, tham số biên, và thao tác đồng thời (Concurrency).

2. **TUYỆT ĐỐI KHÔNG MOCK DATA & KHÔNG FALLBACK GIẢ LẬP (Zero Fake Data Tolerance)**
   - Trên toàn bộ các phân hệ của MYERP (**CRM & Tuyển sinh, Marketing Automation & Omnichannel, Học vụ & Sinh viên, Tài chính - Kế toán - Đặt cọc - PO/SO, HRM - Chấm công - Bảng lương, WorkChat & AI Multi-Agent `SI IDEAS`, API v1**): **Số liệu sai lệch là thảm họa vận hành**.
   - Nghiêm cấm tạo mảng tĩnh (`const MOCK_... = [...]`), bịa số liệu mẫu, dùng `setTimeout` giả lập API, hoặc nuốt lỗi `catch (\Throwable $e) {}` làm trả về trạng thái thành công giả tạo.
   - Lỗi phải trả mã HTTP `4xx/5xx` tường minh kèm thông điệp nghiệp vụ chuẩn xác; dữ liệu rỗng phải hiển thị **Empty State** sạch sẽ.

3. **TƯƠNG THÍCH NGƯỢC TUYỆT ĐỐI & KHÔNG HỒI QUY (100% Backward-Compatible & Zero Regression)**
   - **Sửa phân hệ A tuyệt đối không được làm gãy phân hệ B; nâng cấp API v1 tuyệt đối không được làm lỗi Web App hiện tại.**
   - Khi mở rộng Router (`backend/index.php`) hoặc Controller: Bắt buộc dùng **Additive Route Aliases** (`in_array($p0, ['legacy-route', 'v1-route'], true)`) và **Parameter Fallback Chain** (`$body['owner_id'] ?? $body['assigned_to'] ?? $body['user_id']`). Tuyệt đối không xóa hoặc đổi tên trường JSON mà Frontend hiện tại đang đọc.

4. **BẢO TOÀN DỮ LIỆU & XÓA MỀM TOÀN DIỆN (`100% Soft-Delete Mandate`)**
   - Mọi thực thể nghiệp vụ cốt lõi (`contacts`, `leads`, `deals`, `activities`, `deposits`, `invoices`, `expenses`, `students`, `users`, `support_tickets`, `chat_messages`) khi thực hiện thao tác xóa đơn lẻ hoặc xóa hàng loạt (`bulk-delete`) **BẮT BUỘC dùng Xóa Mềm (`UPDATE ... SET deleted_at = NOW()`)** trong Transaction.
   - Nghiêm cấm dùng `DELETE FROM` xóa cứng hồ sơ khách hàng/lead hoặc nhật ký chăm sóc gây mất lịch sử hoặc gây lỗi khóa ngoại / lỗi `HTTP 500`.

5. **KỶ LUẬT THẨM THẤU 2 CHIỀU (Universal Dual-Mindset Mandate)**
   - Bất kể được gọi ở vai trò `@Role DEV` hay `@Role Tester` (`@ROLE QA QC`), AI Agent bắt buộc phải nắm vững toàn bộ Hiến Chương này:
     - **Principal DEV viết code với tư duy của QA Hacker**: Chủ động chặn trước bẫy SQL `NOT IN (NULL)`, lỗi `SQLSTATE[HY093]` do mảng không tuần tự, Race Condition tài chính, lỗ hổng IDOR/RBAC, rò rỉ Token AI, spam thông báo và xung đột Z-Index/UX ngay từ dòng code đầu tiên.
     - **Red-Team QA kiểm định với tầm nhìn Kiến trúc sư Hệ thống**: Nắm rõ Schema MySQL, luồng Transaction PDO, cơ chế đồng bộ CRM $\leftrightarrow$ Marketing $\leftrightarrow$ AI $\leftrightarrow$ Export để tấn công đúng tử huyệt kỹ thuật.

---

## 🏛️ CHƯƠNG II: KIẾN TRÚC KỸ THUẬT CỐT LÕI CHO HỆ THỐNG LỚN (ENTERPRISE ENGINEERING STANDARDS)

### 1. Kiến Trúc Cơ Sở Dữ Liệu MySQL & Kỷ Luật Truy Vấn Hiệu Năng Cao (High-Performance SQL Rigor)
- **Đối Chiếu Schema Thực Tế Trước Khi Viết SQL (Zero Hallucinated Columns)**:
  - Bắt buộc kiểm tra cấu trúc bảng thực tế trước khi viết query:
    - Phân biệt rõ bảng dùng `tenant_id` (`contacts`, `deals`, `users`, `invoices`, `expenses`, `notifications`), bảng dùng `workspace_id` (`subscribers`, `lists`, `subscriber_lists`, `segments`, `flows`, `campaigns`, `templates`), và bảng liên kết qua `users.tenant_id` (`deposits`, `monthly_payslips`, `hrm_leave_requests`, `hrm_salary_advances`).
    - Không bao giờ gọi cột không tồn tại (ví dụ: dùng `po.po_number` thay vì `po.order_number`, `so.so_number` thay vì `so.order_number`, `contacts.dob`/`birthday` thay vì `birth_date`).
- **4 Quy Tắc Vàng Khi Viết SQL & PDO**:
  1. **Cấm tuyệt đối `NOT IN (SELECT ...)` trên cột có thể `NULL`**: Bắt buộc dùng `NOT EXISTS (SELECT 1 FROM ... WHERE ...)` để tránh lỗi toàn bộ câu query trả về `0` bản ghi khi bảng phụ có `NULL`.
  2. **Chống lỗi `SQLSTATE[HY093]: Invalid parameter number`**: Khi truyền mảng động vào `WHERE col IN (?, ?, ?)` qua `$stmt->execute($params)`, **BẮT BUỘC bọc `array_values(...)`** sau `array_unique()` / `array_filter()` để reset key về `0, 1, 2...`.
  3. **Chống N+1 Query & Nhân Bản Dòng (Anti-Cartesian Explosion)**:
     - Cấm chạy câu lệnh SQL đơn lẻ bên trong vòng lặp `foreach` khi xử lý danh sách lớn (Import CSV, đồng bộ Danh sách tĩnh, chia Lead, tính lương). Bắt buộc dùng **Batch Set-Based SQL** (`INSERT IGNORE INTO ... SELECT ...`, `ON DUPLICATE KEY UPDATE`, hoặc pre-fetch bằng `WHERE id IN (...)`).
     - Khi `JOIN` nhiều bảng `1-N` (`contacts` $\leftrightarrow$ `deposits` $\leftrightarrow$ `activities`), phải dùng `COUNT(DISTINCT c.id)` hoặc gom nhóm bằng Derived Subquery trước khi tính `SUM(...)`.
  4. **Truy vấn SARGable tận dụng B-Tree Index**: Không bọc cột đánh index trong hàm SQL ở mệnh đề `WHERE` (dùng `created_at >= ? AND created_at <= ?` thay vì `DATE(created_at) = ?`). Luôn kèm điều kiện `deleted_at IS NULL`.

### 2. Đồng Bộ Tuyệt Đối 4 Bề Mặt Dữ Liệu (`4-Way Data Parity`: UI ⮂ AI Agent ⮂ Marketing Segment/List ⮂ Export)
- Mọi bộ lọc đa cấp (`program`, `project_id`, `stage_id`, `pipeline_status`, `lead_status`, `temperature`, `source`, `owner_id`, `city`, `gender`, `deposit_status`, `activity_status`, `from_date`, `to_date`, `date_field`) phải cho ra **cùng một tập kết quả chính xác 100%** trên cả 4 bề mặt:
  1. Bảng dữ liệu & KPI trên giao diện Web App (`/contacts`, `/finance`, `/hrm`, ...).
  2. Kết quả truy vấn từ công cụ AI Multi-Agent (`AgentToolRegistry.php`).
  3. Bộ lọc Phân khúc động (`segment_helper.php`) & Nạp nhanh Danh sách tĩnh (`createOrPopulateStaticList` / `lists.php`).
  4. File Excel/CSV tải xuống từ `ExportController.php`.

### 3. Toàn Vẹn Tài Chính, Nhân Sự & Xử Lý Đồng Thời (`Atomic Concurrency & State Machine`)
- **Giao dịch Nguyên tử (ACID Transaction & Row Locking)**:
  - Mọi thao tác biến động tiền tệ, đặt cọc (`DepositController`), duyệt chi (`ExpenseController`), hóa đơn (`FinanceController`), đơn hàng (`SalesOrderController`, `PurchaseOrderController`, `POSController`), số dư ví/credits (`WalletController`), và duyệt ngày phép/tạm ứng/bảng lương (`HRMController`) bắt buộc bọc trong `$db->beginTransaction() ... $db->commit() / $db->rollBack()`.
  - Sử dụng `SELECT ... FOR UPDATE` hoặc **Atomic Conditional Update** (`UPDATE ... SET balance = balance - ? WHERE id = ? AND balance >= ?` / `WHERE id = ? AND status = 'pending'`) để triệt tiêu 100% lỗ hổng **Race Condition / Double-Spending / Trừ đúp ngày phép**.
- **Chống Tự Phê Duyệt & Can Thiệp Giá (`Anti-Self-Approval & Server-Side Price Enforcement`)**:
  - Nhân sự tạo phiếu đề xuất/đơn hàng không được tự phê duyệt phiếu của chính mình (trừ `admin`/`super_admin`/`director`).
  - Không bao giờ chấp nhận số tiền âm (`< 0`), số lượng `<= 0`, hoặc đơn giá tự chế từ Client khi tạo đơn POS/Hóa đơn/Hoàn tiền.

### 4. Kiến Trúc AI Multi-Agent (`SI IDEAS`) Thông Minh, Nhanh Nhạy & Tiết Kiệm Token
- **Engine Chuẩn Hóa & Tốc Độ Cao (`gemini-3.5-flash-lite`)**:
  - Sử dụng trực tiếp `gemini-3.5-flash-lite` làm động cơ xử lý chính, không chạy vòng lặp qua các model free bị giới hạn tốc độ (429 TPM) hoặc làm cắt cụt danh sách công cụ.
- **Định Tuyến Công Cụ Tinh Gọn (`Domain-Scoped Tool Injection`)**:
  - Trong `AgentToolRegistry::getGeminiToolsDeclaration()`, danh sách `$essential` chỉ giữ các công cụ cốt lõi tối thiểu (`draft_action_proposal`, `get_system_navigation`, `query_cross_domain_executive_synthesis`).
  - Mỗi lượt gọi chỉ nạp **5–9 công cụ đúng phân hệ** dựa trên Hybrid Router + `<working_memory>`, và gỡ bỏ toàn bộ Tool Schema ở lượt tổng hợp câu trả lời cuối cùng (Turn 2 Synthesis Slimming) để tiết kiệm ~75% lượng token.
- **Trí Nhớ Hội Thoại 2 Tầng (`<working_memory>` & History Compaction)**:
  - Sau mỗi lượt AI chạy công cụ, tự động trích xuất và lưu `working_memory` (`domain`, `last_tool`, `active_filters`, `total_matching`, `entity_refs`) vào `chat_messages.metadata`.
  - Ở lượt hỏi kế tiếp, nạp khối `<working_memory>` (~120 tokens) để AI kế thừa chính xác 100% bộ lọc câu trước khi người dùng hỏi xoáy/lọc tiếp (*"trong số đó ai ở HCM?"*, *"còn tháng trước thì sao?"*, *"giao 3 lead này cho bạn A"*), đồng thời lọc bỏ các thẻ JSON nặng (`<<<DYNAMIC_CHART:...>>>`) và thu gọn bảng Markdown cũ trong lịch sử.
- **Giải Quyết Trọn Vẹn Các Câu Hỏi Hóc Búa (Complex Analytics & Parallel Calling)**:
  - Hỗ trợ tự động so sánh tăng trưởng kỳ này vs kỳ trước (`compare_previous_period`), tính tỷ lệ chuyển đổi phễu (`conversion_rate_pct`), số lượng chưa chăm sóc (`uncontacted_count`), chi phí CPL/CAC/ROAS và gọi song song nhiều công cụ (`Parallel Function Calling`) trong 1 lượt.

### 5. Kiến Trúc Hệ Thống Thông Báo Thông Minh (`Smart Notification Architecture`)
- **4 Quy Tắc Bắn Thông Báo Chuẩn Enterprise**:
  1. **Không tự thông báo cho chính mình (`Zero Self-Notification`)**: Luôn kiểm tra `(int)$recipientId !== (int)$auth['user_id']` trước khi `INSERT INTO notifications`.
  2. **Gộp thông báo khi thao tác hàng loạt (`Bulk Aggregation`)**: Khi phân bổ hàng loạt 50 Lead, duyệt nhiều phiếu hoặc import dữ liệu, chỉ gửi **1 thông báo tổng hợp duy nhất** cho mỗi người nhận (VD: *"Bạn vừa được phân bổ 50 khách hàng mới"*), nghiêm cấm bắn 50 thông báo rời rạc trong vòng lặp.
  3. **Đồng bộ 100% Deep-Link (`notif.link`) với Frontend Router & Drawer**: Mọi đường dẫn `link` lưu trong bảng `notifications` phải khớp chính xác với bộ lắng nghe URL trên Frontend (mở đúng trang, đúng tab, tự động bật Drawer chi tiết và dọn sạch query param khi đóng).
  4. **Cô lập Tenant & Quyền hạn**: Mọi truy vấn đọc/đánh dấu đã đọc thông báo phải lọc chặt theo `user_id = ? AND tenant_id = ?`.

### 6. Kiến Trúc Frontend React 19, Z-Index Layering & Trải Nghiệm Không Đứt Quãng (Zero-Friction UX)
- **Hệ Phân Cấp Z-Index & Portal Chuẩn Hóa Toàn Hệ Thống**:
  - Floating Widgets (AI Chatbot button): `zIndex: 10005`.
  - Slide-over Drawers (`CustomerProfileDrawer`, `CampaignDetailDrawer`, `CampaignWizard`, ...): Render qua `createPortal(..., document.body)` với `.drawer-backdrop` ở `zIndex: 2147483620` và `.drawer-panel` ở `zIndex: 2147483625`.
  - Modals / Dialogs lồng bên trên Drawer (`TemplateAccessModal`, `PreSendReviewModal`, `ConfirmModal`): `zIndex: 2147483646–2147483647`.
  - Chuyển động đóng/mở Drawer đồng bộ cả Backdrop lẫn Panel trong **`220ms` (`cubic-bezier(0.25, 0.1, 0.25, 1)`)**, tuyệt đối không để kẹt lớp phủ mờ (`.drawer-backdrop`) sau khi đóng.
- **Mở Giao Diện Tức Thì (`0ms Instant Open`) & Skeleton Đồng Bộ Bố Cục**:
  - Mở các trình thiết kế (`EmailEditor`, `SurveyEditor`) và Drawer ngay lập tức từ dữ liệu trên RAM kết hợp đồng bộ ngầm (Background Hydration), không chặn người dùng bằng thông báo chờ.
  - Sử dụng Skeleton khớp bố cục (`animate-pulse`) thay cho spinner xoay toàn màn hình.
- **Lập Trình Phòng Thủ & Bảo Vệ Ý Định Người Dùng**:
  - Mọi phép gọi `.map()`, `.filter()`, `.slice()` trên dữ liệu từ API/LocalStorage phải được bảo vệ bởi `Array.isArray(...)` để chống lỗi `TypeError: ... is not a function` gây trắng trang.
  - Sử dụng `AbortController` để hủy request cũ khi chuyển tab/đóng modal và bỏ qua `AbortError` im lặng.
  - Sử dụng **Synchronous Ref Guard (`inFlightRef.current = true`)** chống spam click liên hoàn, và cô lập định danh sự kiện (`proposalId`, `entityId`) khi bắn `CustomEvent`.
  - Mở Drawer xem chi tiết hồ sơ từ cửa sổ AI Chat phải giữ nguyên cửa sổ Chat (`Side-by-Side Peek`) để đối chiếu song song; phím `/` chỉ kích hoạt lệnh AI đúng ngữ cảnh.

---

## 🚪 CHƯƠNG III: QUY TRÌNH BÀN GIAO & KIỂM ĐỊNH ĐỐI KHÁNG 4 CỔNG (4-GATE ZERO-TRUST PROTOCOL)

```
[Principal Full-Stack DEV (Blue Team)]                     [Red-Team QA & Chaos Architect]
  Gate 1: Schema, Blast Radius & Contract Scan ──▶
  Gate 2: Clean Code, Double Build & 4 Proofs  ──▶
                                                 Gate 3: 8-Vector Adversarial Pentest & Chaos Audit
                                             ◀── [REJECT NGAY LẬP TỨC nếu có 1 lỗi kèm PoC]
                                                 Gate 4: Zero-Regression & Production Sign-Off
```

### 🚪 Gate 1: Kiểm Toán Schema, Bán Kính Ảnh Hưởng & Hợp Đồng Giao Tiếp (Trước khi code)
- Dùng `grep_search` quét 100% call-sites của hàm/component/endpoint sắp sửa.
- Đối chiếu chính xác Schema bảng MySQL và đảm bảo tương thích ngược 100% với cả Web App hiện tại lẫn API v1.
- Khi có thay đổi cấu trúc lớn hoặc rủi ro nghiệp vụ, tóm tắt phương án rõ ràng và xin xác nhận từ người dùng.

### 🚪 Gate 2: Bàn Giao 4 Bằng Chứng Thực Nghiệm (DEV Submission)
1. **Diff Proof**: Link file và dòng code chính xác, không để lại code rác hoặc biến thừa.
2. **Double Build Proof**:
   - `npm run build` (`tsc -b && vite build`) $\rightarrow$ **Exit Code 0 (0 lỗi TypeScript)**.
   - `php -l` trên toàn bộ file PHP chỉnh sửa $\rightarrow$ **Exit Code 0 (`No syntax errors detected`)**.
3. **Runtime, SQL & Parity Proof**: Bằng chứng đầu ra API/SQL thực tế, xác nhận đồng bộ giữa UI $\leftrightarrow$ AI Tool $\leftrightarrow$ Export.
4. **Boundary & UX Self-Check Proof**: Đã kiểm chứng dữ liệu rỗng, `NULL`, chống spam click, đóng/mở Drawer mượt mà và không xung đột với app hiện tại.

### 🚪 Gate 3: Kiểm Định Đối Kháng 8 Chiều (Red-Team QA Pentest & Chaos Audit)
QA Hacker độc lập kiểm tra 8 chiều tấn công:
1. **Tài chính, Credits & Đồng thời**: Bẫy số âm, giá 0đ, bắn request song song (Race Condition / Double-Spending) trên Ví, Đặt cọc, Duyệt chi, Nghỉ phép.
2. **Phân quyền RBAC, Multi-Tenant & IDOR**: Đổi ID trên URL/Body/AI Tool/ERP Tag xem trộm dữ liệu người khác hoặc chi nhánh khác; kiểm tra lỗ hổng tự duyệt phiếu của chính mình.
3. **Độ chính xác SQL, Soft-Delete & Xuất file**: Kiểm tra bẫy `NOT IN (NULL)`, lỗi `SQLSTATE[HY093]`, đảm bảo xóa liên hệ là `100% Soft Delete` (không lỗi 500 khi còn dữ liệu con), đối chiếu khớp 100% số dòng với file Export.
4. **Hiệu năng & Trí tuệ AI Agent**: Kiểm tra tốc độ phản hồi `gemini-3.5-flash-lite`, lượng token tiêu thụ, khả năng nhớ bộ lọc qua `<working_memory>` khi hỏi nối tiếp, và độ chính xác với các câu hỏi hóc búa đa chiều.
5. **Logic Thông báo & Deep-Link**: Kiểm tra không tự thông báo cho chính mình, gộp thông báo khi thao tác hàng loạt, bấm vào thông báo mở đúng Drawer/Tab đích.
6. **Chống Spam Click & Cô lập Sự kiện**: Kiểm tra `inFlightRef` và cô lập `proposalId` giữa nhiều thẻ hành động.
7. **Z-Index, Drawer Lifecycle & Bảo vệ Luồng UX**: Kiểm tra không kẹt `.drawer-backdrop`, không bị icon nổi đè lên Modal/Drawer, không tự đóng cửa sổ Chat khi mở Drawer xem hồ sơ, không kẹt `?id=` trên URL.
8. **Biên dữ liệu, PWA Cache & Bảo mật Payload**: Kiểm tra Empty State 0 bản ghi, bảo vệ `Array.isArray()` trước `.map()`, chống SQLi/XSS, và đảm bảo `.htaccess` không trả `index.html` cho file `/assets/*.js` cũ.

> **Nguyên tắc Xử lý Khiếm khuyết tại Gate 3**:
> - **TESTER TUYỆT ĐỐI KHÔNG VIẾT CODE SỬA HỘ DEV**.
> - Phát hiện dù chỉ 1 lỗi $\rightarrow$ Lập tức **REJECT** kèm bảng Defect Log (**Mã lỗi, Mức độ, File:Dòng, Mô tả thực tế, Kịch bản PoC tái hiện**).
> - **Luật Miễn Nhiễm Tái Phạm**: Lỗi đã sửa ở task trước tuyệt đối không được phép tái xuất hiện ở task sau.

### 🚪 Gate 4: Nghiệm Thu Không Hồi Quy (Zero-Regression Sign-Off)
- Chỉ khi toàn bộ 8 chiều kiểm thử đạt 100% và không gây bất kỳ xung đột nào với ứng dụng đang chạy, nhiệm vụ mới được ký duyệt hoàn tất.

---

## 🛡️ CHƯƠNG IV: QUY TẮC AN TOÀN CƠ SỞ DỮ LIỆU & DEPLOY (STAGING & PRODUCTION)

1. **Kỷ Luật Sao Lưu & Migration An Toàn (Idempotent & Non-Destructive Schema Evolution)**:
   - Nghiêm cấm chạy các lệnh phá hủy dữ liệu (`DROP TABLE`, `TRUNCATE`, hoặc xóa cứng dữ liệu nghiệp vụ) khi chưa có phê duyệt tường minh.
   - Mọi bản Migration phải **Idempotent** (kiểm tra sự tồn tại của bảng/cột/index trong `information_schema` trước khi `ALTER TABLE`), các cột mới bắt buộc có `DEFAULT` hoặc cho phép `NULL` để không làm gián đoạn các câu query hiện hữu.
2. **Kỷ Luật Deploy Staging & Production**:
   - Không tự ý chạy script deploy lên Production khi chưa có lệnh cho phép từ người dùng.
   - Khi được lệnh deploy:
     1. Bắt buộc hoàn tất `npm run build` (`Exit Code 0`) và `php -l` (`Exit Code 0`) ở Local trước.
     2. Đồng bộ đầy đủ mã nguồn Backend + bản build Frontend (`dist`), giữ nguyên vẹn file cấu hình môi trường (`.env`) và thư mục `uploads/` trên Server.
     3. Đảm bảo quy tắc `.htaccess` trả đúng `404` cho các file tĩnh (`/assets/*`, `.js`, `.css`) không còn tồn tại để trình duyệt tự phục hồi khi chuyển bản build mới, tuyệt đối không trả về `index.html` gây lỗi `MIME type text/html`.
     4. Thực hiện kiểm tra thực nghiệm (Live Smoke & API Verification) ngay sau khi deploy và kiểm tra `error_log` sạch sẽ (0 Fatal/500 errors).

---
*Hiến chương này là chuẩn mực kỹ thuật tối cao và có hiệu lực bắt buộc 100% đối với mọi AI Agent, Kỹ sư Phát triển (DEV) và Chuyên gia Kiểm định (QA/Tester) trên toàn hệ thống MYERP.*


---

## 🎨 CHƯƠNG V: QUY CHUẨN UI/UX, CSS & MÀU SẮC DASHBOARD ĐỒNG BỘ TOÀN HỆ THỐNG (`CustomerPersonaOverviewDeck.tsx` DNA)

Toàn bộ các màn hình Dashboard, Báo cáo, Thống kê và Tab Hành trình 360° trên MYERP (**Chân dung Học viên, Tổng quan Lead, Hiệu suất Sales, Meta Ads Full-Funnel, Kế toán & Lương A-Z, Tài chính, Nhân sự HR, Marketing, Hành trình Tương tác Đa kênh 360°**) **BẮT BUỘC** tuân thủ 100% quy chuẩn thiết kế dưới đây:

1. **Bảng Màu Chuẩn Hóa (`Brand Red #C6333D / #BD1D2D & Executive Slate #0F172A`)**:
   - **Nền thẻ (`.card`, `.stat-card`)**: `#FFFFFF`, viền duy nhất `1px solid #E2E8F0`, `borderRadius: 16px`, `boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'`. **CẤM TUYỆT ĐỐI dùng viền màu xanh/đỏ/vàng/tím trên Card!**
   - **Mảng màu biểu đồ (`PALETTE`)**: `['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#475569', '#FB7185', '#94A3B8', '#1E293B', '#CBD5E1']`. Không dùng màu cầu vồng (xanh lá, tím, vàng, cam, xanh dương) trên biểu đồ phân bổ.
   - **Màu ngữ nghĩa Đỏ / Vàng / Xanh theo `%` (`getCompletenessTone`)**: Chỉ dùng cho thanh Độ đầy đủ dữ liệu / Tỷ lệ hoàn thành SLA (`>= 80%`: `#10b981` xanh lá; `50% - 79.9%`: `#f59e0b` vàng cam; `< 50%`: `#ef4444` đỏ).

2. **Quy Tắc 4 Thẻ KPI Đầu Trang (`dashboard-kpi-grid`)**:
   - **Tiêu đề (`stat-label`)**: Chữ IN HOA (`uppercase`), `fontSize: '0.73rem'`, `fontWeight: 700`, `letterSpacing: '0.04em'`, `color: '#64748b'`.
   - **Hộp Icon góc phải (`32px × 32px`, `borderRadius: 8px`)**:
     - Card 1 & Card 2: `background: 'rgba(189, 29, 45, 0.08)'` (`#fef2f2`), `color: '#BD1D2D'`.
     - Card 3 & Card 4 (và các Card tiếp theo): `background: 'rgba(15, 23, 42, 0.06)'` (`#f1f5f9`), `color: '#334155'`.
     - **CẤM** dùng icon màu xanh dương, hồng, tím, cam, xanh lá không có hộp nền chuẩn!
   - **Con số chính (`stat-value`)**: `fontSize: '1.85rem'`, `fontWeight: 800`, `fontVariantNumeric: 'tabular-nums'`.
     - Card 1, 3, 4: Màu chữ **`#0f172a`** (Đen Slate).
     - Card 2: Màu chữ **`#BD1D2D`** (`#C6333D` Đỏ thương hiệu).
     - **CẤM** tô màu xanh lá, xanh dương, nâu/cam lên con số KPI!
   - **2 dòng mô tả dưới đáy Card**: Chữ `#64748b` sạch sẽ (`• Nhãn: <strong style={{ color: '#0f172a' }}>Giá trị</strong>`), **CẤM** nhét các cục pill nền vàng/xanh/đỏ vào trong KPI Card.

3. **Quy Tắc Subtab / Segmented Control**:
   - Khay ngoài: `display: 'inline-flex', padding: '3px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', gap: '2px'`.
   - Nút trong khay: `height: '32px', padding: '0 14px', borderRadius: '7px', border: 'none', background: isActive ? '#ffffff' : 'transparent', color: isActive ? '#BD1D2D' : '#64748b', fontWeight: isActive ? 700 : 600, boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'`.
   - **CẤM** dùng nút subtab bo tròn `rounded-full` hoặc có viền đỏ `border: 1px solid #f87171`!

4. **Quy Tắc 5 Archetype Biểu Đồ & Bảng Xếp Hạng Nhân Sự**:
   - **Header của mọi Chart Card**: Tiêu đề `h3` (`0.98rem`, `fontWeight: 800`, `color: '#0f172a'`, **không có icon màu đứng trước tiêu đề**) + mô tả `p` (`0.76rem`, `color: '#64748b'`) + Badge tổng hợp góc phải (`background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontWeight: 700`).
   - **Archetype 1 (Ranked List + Donut)**: Cột trái danh sách xếp hạng `#1` (`#BD1D2D`), `#2+` (`#64748b`) kèm thanh progress `6px`; Cột phải (`borderLeft: '1px solid #f1f5f9'`) vòng Donut `162x162` hiển thị `%` ở tâm.
   - **Archetype 2 (Donut + Vertical BarChart)**: Cột trái vòng Donut `154x154` kèm hộp Legend trắng viền `#e2e8f0`; Cột phải biểu đồ cột đứng `BarChart` màu `#C6333D` (`radius={[6, 6, 2, 2]}`) **bắt buộc có `<LabelList position="top" />`** hiển thị số trên đỉnh cột.
   - **Archetype 3 (Top Nhân sự / Tư vấn viên)**: **TUYỆT ĐỐI KHÔNG BAO GIỜ LIỆT KÊ TÊN NHÂN SỰ MÀ KHÔNG CÓ `<Avatar />`!** Mỗi dòng gồm Huy chương (`🥇`, `🥈`, `🥉`, `#4...`) + `<Avatar size={30} />` + Tên đậm `#0f172a` + Thanh progress `5px` màu `#C6333D` (Top 1–3) / `#475569` (Top 4+) + Số lượng & Pill `%` (`#f1f5f9`).
