# 🛡️ BẢN THIẾT KẾ & KẾ HOẠCH MASTER AUDIT HỆ THỐNG MULTI-AGENT PHÂN CẤP ĐA TẦNG (HIERARCHICAL MULTI-AGENT SYSTEM & ZERO-TRUST RBAC)
> **DỰ ÁN**: HỆ THỐNG QUẢN TRỊ DOANH NGHIỆP & ĐÀO TẠO QUỐC TẾ MYERP (VIỆN IDEAS)  
> **PHIÊN BẢN**: 3.0 - HỆ THỐNG ĐA TÁC NHÂN PHÂN CẤP & TIẾP NHẬN ĐA TẦNG (5-TIER HIERARCHICAL SWARM)  
> **CƠ QUAN THẨM ĐỊNH**: TRƯỞNG BAN KIỂM ĐỊNH & RED TEAM QA/QC HACKER ĐỘC LẬP  
> **NGUYÊN TẮC CỐT LÕI**: HIẾN CHƯƠNG AGENTS.MD • CHÂN LÝ THỰC NGHIỆM • SMART DRAFTER / HUMAN COMMITTER

---

## 🏛️ CHƯƠNG I: TUYÊN NGÔN KIỂM ĐỊNH ZERO-TRUST & CHÂN LÝ THỰC NGHIỆM

1. **Chân lý thực nghiệm là tối cao (Empirical Ground Truth is King)**:
   - Nghiêm cấm tuyệt đối mọi hình thức bịa đặt dữ liệu (Mock data), số liệu giả lập, số dư ảo hoặc delay timeout giả để che giấu độ trễ backend.
   - 100% thông tin được phân tích và tổng hợp phải trích xuất trực tiếp từ Database quan hệ MySQL ([contacts](file:///d:/GITHUB_SPACE/MYERP/backend/controllers/ChatController.php#L3970), `activities`, `expenses`, `sales_orders`, `hrm_leave_requests`, `monthly_payslips`, `hrm_assets`).
2. **Quyền hạn can thiệp rạch ròi (Smart Drafter ➔ Final Human Committer)**:
   - **Multi-Agent Swarm** có quyền hạn tối cao trong việc: tiếp nhận, bóc tách nhiều cấp, đối soát logic chéo, điền sẵn (prefill) vào Form/Drawer.
   - **User** giữ quyền hạn sinh tử cuối cùng: kiểm tra, chỉnh sửa tùy ý trên giao diện và **chính tay bấm nút "LƯU / TẠO PHIẾU"**.
   - **LỆNH CẤM SEV-1**: Cấm mọi hành vi Agent tự ý gửi request ngầm vào database mà không qua xác nhận trực quan của người dùng.
3. **Bản lĩnh đối kháng của QA Hacker**:
   - Mặc định coi mọi tính năng "thông minh" là **CHƯA ĐƯỢC CHỨNG MINH** cho đến khi tự tay bẻ gãy, bắn tải race-condition và pentest xâm nhập vượt qua 100% kịch bản.

---

## 🏗️ CHƯƠNG II: KIẾN TRÚC MULTI-AGENT PHÂN CẤP 5 TẦNG (5-TIER HIERARCHICAL ARCHITECTURE)

Hệ thống được thiết kế theo mô hình **Phân Cấp Đa Tầng (Hierarchical Swarm Architecture)** giúp tiếp nhận thông tin phức tạp, xử lý chuyên sâu nhiều cấp và trả ra kết quả đầu cuối trọn gói cho người dùng:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 NGƯỜI DÙNG RA LỆNH VẤN ĐỀ ĐẦU VÀO                                │
│   (Ngôn ngữ tự nhiên, tài liệu đính kèm, ảnh chụp UNC/Hợp đồng, bảng tính, yêu cầu phức tạp)     │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🎯 TẦNG 1: MASTER INGESTION & DECOMPOSITION (SI IDEAS - Orchestrator #3)                         │
│ • Tiếp nhận thông tin thô, bóc tách ý định đa cấp (Intent Decomposition).                        │
│ • Nhận diện các phân hệ liên quan và lập Đồ Thị Phối Hợp Thực Thi (Execution DAG).               │
│ • Trích xuất các thực thể định danh: Tên học viên, SĐT, mã hợp đồng, số tiền, ngày hạn.         │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚙️ TẦNG 2: DOMAIN SPECIALIST EXECUTION (Swarm 10 Chuyên Viên Nghiệp Vụ Chuyên Sâu)              │
│ ┌──────────────────────┬──────────────────────┬──────────────────────┬─────────────────────────┐ │
│ │   Agent Sales (#10)  │  Agent Thu Chi (#25) │ Agent Hồ Sơ (#18) MỚI│    Agent Task (#16)     │ │
│ │   CRM, Lead, Phễu    │  PO, SO, Cọc, Dòng   │ Thẩm định bằng, CCCD │    WBS, Kế hoạch, hạn  │ │
│ ├──────────────────────┼──────────────────────┼──────────────────────┼─────────────────────────┤ │
│ │ Agent Nhân Sự (#15)  │  Agent Đào Tạo (#12) │ Agent Tài Sản (#32)  │  Agent Marketing (#20)  │ │
│ │ Công, Phép, Lương    │  Khung CT, UMEF/ISTEC│ Kho ấn phẩm, Cấp TS  │  Chiến dịch, CPL, Ads   │ │
│ ├──────────────────────┴──────────────────────┴──────────────────────┴─────────────────────────┤ │
│ │ Agent Điều Hành BI (#31) MỚI: P&L thời gian thực | Agent Kỹ Thuật IT (#11) MỚI: Hệ thống     │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ • Mỗi Agent truy vấn đúng dữ liệu phân hệ theo Server-Side RBAC, không kéo thừa dữ liệu.        │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔄 TẦNG 3: CROSS-AGENT VALIDATION & HANDSHAKE (Thẩm Định Chéo & Phát Hiện Xung Đột)              │
│ • Đối soát số liệu chéo giữa các Agent:                                                          │
│   - Sales đề xuất cọc ➔ Kế toán kiểm tra chính sách giá & ngân sách ➔ Hồ sơ kiểm tra điều kiện.  │
│   - Nhân sự xin nghỉ phép ➔ Task Agent kiểm tra công việc đến hạn ➔ Đề xuất bàn giao.           │
│ • Nhận diện khoảng trống dữ liệu (Slot Gaps) hoặc điều kiện không thỏa mãn.                     │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 📦 TẦNG 4: FINAL SYNTHESIS & ACTION DELIVERY (Đóng Gói & Trả Kết Quả Đầu Cuối)                  │
│ • SI IDEAS tổng hợp dữ liệu từ các Agent thành một câu trả lời hoàn chỉnh, mạch lạc, lịch thiệp.│
│ • Đính kèm Thẻ Hành Động Điền Sẵn (ActionProposalCard):                                          │
│   - Đơn cọc/SO ➔ Mở sẵn DepositCreateDrawer với số tiền, đợt cọc, thông tin khách.              │
│   - Đề xuất chi PO ➔ Mở sẵn ExpenseCreateDrawer với hạng mục, người duyệt, ghi chú.             │
│   - Giao việc ➔ Mở sẵn TaskDrawer với tiêu đề, hạn chót, checklist.                             │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 👑 TẦNG 5: HUMAN-IN-THE-LOOP COMMITMENT (Người Dùng Quyết Định & Lưu)                            │
│ • Người dùng bấm vào thẻ đề xuất ➔ Drawer trượt ra với 100% dữ liệu đã điền sẵn (Autofill).     │
│ • Người dùng kiểm tra, chỉnh sửa tùy ý bất kỳ trường nào.                                        │
│ • Chính tay Người Dùng bấm nút "XÁC NHẬN LƯU" ➔ API mới chính thức ghi vào CSDL MySQL.          │
│ • Tự động ghi vết vào bảng ai_query_audit_logs để phục vụ kiểm toán hệ thống.                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 👥 CHƯƠNG III: ĐỘI NGŨ 11 CHUYÊN GIA ĐA TÁC NHÂN (SWARM ROSTER)

Hệ thống MYERP hoàn thiện gồm **11 Chuyên Gia Tác Nhân** với nhiệm vụ và phân hệ rõ ràng:

| STT | Mã Agent | Tên Gọi & Huy Hiệu | Avatar Sticker | Phân Hệ Nghiệp Vụ & Năng Lực Trọng Tâm |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `master` | **SI IDEAS**<br>Chỉ huy & Tri thức (`#BD1D2D`) | `/stickers/ideas/ideas_3.webp` | **Tổng điều phối**: Tiếp nhận, bóc tách đa cấp, phân luồng Swarm, tri thức kiểm định Thụy Sĩ (Swiss UMEF) & Pháp (ISTEC Paris), văn hóa Viện. |
| **2** | `tasks` | **Agent Task**<br>Kế hoạch & Việc con (`#2563eb`) | `/stickers/ideas/ideas_16.webp` | **Bàn làm việc**: Phân rã WBS dự án, lập checklist, phân chia việc cho các phòng ban, theo dõi hạn chót và đôn đốc tiến độ. |
| **3** | `finance` | **Agent Thu Chi**<br>Kế toán & Dòng tiền (`#059669`) | `/stickers/ideas/ideas_25.webp` | **Kế toán & Ngân quỹ**: Đối soát phiếu chi PO, phiếu thu SO, tiền cọc học phí, tạm ứng, dòng tiền thu chi thực tế, công nợ. |
| **4** | `sales` | **Agent Sales**<br>Tư vấn CRM & Phễu (`#d97706`) | `/stickers/ideas/ideas_10.webp` | **Kinh doanh & CRM**: Quản lý Lead, 14 bước phễu tuyển sinh, kịch bản chốt sale, 12 tình huống xử lý từ chối của Viện IDEAS. |
| **5** | `hrm` | **Agent Nhân Sự**<br>Chấm công & Tổ chức (`#7c3aed`) | `/stickers/ideas/ideas_15.webp` | **Nhân sự & Lương**: Sơ đồ tổ chức, công ty có ai, ai nghỉ phép/WFH hôm nay, chấm công, giải trình đi trễ, tra cứu phiếu lương cá nhân. |
| **6** | `academic` | **Agent Đào Tạo**<br>Học vụ & Tuyển sinh (`#0891b2`) | `/stickers/ideas/ideas_12.webp` | **Học thuật & Đào tạo**: Khung chương trình EMBA, MBA, MSc AI, DBA, Top-up BBA, tín chỉ ECTS, điều kiện xét tuyển và luận văn tốt nghiệp. |
| **7** | `records_legal` | **Agent Hồ Sơ & Pháp Lý**<br>Thẩm Định Hồ Sơ (`#7c2d12`) - **MỚI** | `/stickers/ideas/ideas_18.webp` | **Hồ sơ học viên & Pháp lý**: Thẩm định CCCD, bằng Đại học, bảng điểm, CV tiếng Anh, dịch thuật công chứng, hợp đồng dịch vụ tư vấn đào tạo. |
| **8** | `assets_inventory` | **Agent Tài Sản & Kho**<br>Kho & Cấp Phát (`#ea580c`) - **MỚI** | `/stickers/ideas/ideas_32.webp` | **Kho vật tư & Tài sản**: Quản lý tồn kho ấn phẩm, quà tặng tuyển sinh (áo polo, balo, sổ tay, giáo trình) và cấp phát tài sản (`hrm_assets`) máy tính. |
| **9** | `marketing_campaigns`| **Agent Marketing**<br>Chiến Dịch & Tăng Trưởng (`#db2777`) - **MỚI** | `/stickers/ideas/ideas_20.webp` | **Marketing & Đa kênh**: Quản lý nguồn lead, chi phí CPL/CAC, kịch bản tin nhắn broadcast Zalo ZNS / SMS / Email, đo lường sự kiện EduFair/Workshop. |
| **10**| `executive_bi` | **Agent Trợ Lý Ban Giám Đốc**<br>Điều Hành BI (`#b45309`) - **MỚI** | `/stickers/ideas/ideas_31.webp` | **Trợ lý lãnh đạo**: Phục vụ riêng Ban Giám đốc (Director/Superadmin): Báo cáo P&L thời gian thực, sức khỏe tài chính, dòng tiền ròng, phát hiện bất thường thu chi. |
| **11**| `system_it` | **Agent Kỹ Thuật & Vận Hành**<br>Hỗ Trợ Kỹ Thuật (`#0284c7`) - **MỚI** | `/stickers/ideas/ideas_11.webp` | **IT & Hệ thống**: Giám sát đồng bộ Google Sheets (`sheet_sync_records`), webhook, cronjob, tra cứu vết audit (`ai_query_audit_logs`), hỗ trợ lỗi app. |

---

## 🔐 CHƯƠNG IV: MA TRẬN PHÂN QUYỀN ĐA TẦNG ZERO-TRUST RBAC & ISOLATION

Hệ thống Agent tuân thủ nghiêm ngặt **Cổng Phân Quyền Server-Side (RBAC Gateway)**:

```
[Request Chat/Tool] ──▶ [Trích xuất Token Server-Side] ──▶ [Xác thực Role, Branch, Tenant, UID]
                                                                      │
                              ┌───────────────────────────────────────┴───────────────────────────────────────┐
                              ▼                                                                               ▼
                     [HỢP LỆ VỚI VAI TRÒ]                                                            [VƯỢT THẨM QUYỀN]
                              │                                                                               │
                              ▼                                                                               ▼
                   [Cho phép Tool truy vấn]                                                        [Từ Chối Lịch Sự & Nêu Rõ Lý Do]
```

### Bảng Ma Trận Phân Quyền Giữa 11 Agents và Các Vai Trò (Roles):

| Phân hệ Dữ liệu & Bảng MySQL | Admin / Giám đốc (`admin`, `director`) | Kế toán (`accountant`) | Quản lý / Trưởng phòng (`manager`, `leader`) | Sales / Tư vấn (`sales`, `consultant`) | Học vụ / Giảng viên (`academic`) | Nhân sự / HR (`hr`) | Nhân viên thường (`user`, `staff`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Bảng lương cá nhân & Quỹ lương** (`monthly_payslips`) | Toàn quyền xem toàn viện | Xem toàn viện để giải ngân | Xem lương nhân viên trong phòng ban (nếu được ủy quyền) | ❌ **CHẶN** (Chỉ xem phiếu lương chính mình) | ❌ **CHẶN** (Chỉ xem phiếu lương chính mình) | Toàn quyền lập & xem bảng lương | ❌ **CHẶN** (Chỉ xem phiếu lương chính mình) |
| **2. Báo cáo Tài chính, P&L, Dòng tiền** (`expenses`, `sales_orders`) | Toàn quyền xem P&L, tổng hợp dòng tiền | Toàn quyền kiểm tra số dư, quỹ tiền, công nợ | Xem chi phí dự toán của phòng ban mình | ❌ **CHẶN TUYỆT ĐỐI** (Từ chối nhã nhặn) | ❌ **CHẶN TUYỆT ĐỐI** (Từ chối nhã nhặn) | Xem quỹ lương & chi phí nhân sự | ❌ **CHẶN TUYỆT ĐỐI** (Từ chối nhã nhặn) |
| **3. Khách hàng, Lead & Hồ sơ CRM** (`contacts`, `cooperation_slips`) | Toàn quyền xem toàn viện | Xem khách hàng gắn với chứng từ thu tiền | Xem Lead của phòng ban / team mình quản lý | Chỉ xem Lead của chính mình (`owner_id`) & Lead hợp tác | Xem học viên của lớp/khóa mình phụ trách | ❌ **CHẶN** (Trừ trường hợp tuyển dụng) | ❌ **CHẶN TUYỆT ĐỐI** |
| **4. Đơn cọc & Hợp đồng SO** (`sales_orders`, `sales_order_items`) | Toàn quyền duyệt & xem | Toàn quyền đối soát & xác nhận cọc | Xem đơn hàng SO của phòng ban mình | Tạo đề xuất cọc & xem SO của khách mình phụ trách | Xem tiến độ đóng học phí để mở học phần | Xem hợp đồng lao động nhân sự | ❌ **CHẶN TUYỆT ĐỐI** |
| **5. Đề xuất chi phí & Mua hàng PO** (`expenses`) | Toàn quyền phê duyệt cấp cao nhất | Kiểm tra hóa đơn, đối soát chi phí | Duyệt cấp 1 cho nhân viên thuộc phòng ban | Tạo đề xuất chi tạm ứng / tiếp khách của mình | Tạo đề xuất mua học liệu / giảng viên | Tạo đề xuất mua sắm phúc lợi nhân sự | Tạo đề xuất chi / tạm ứng cá nhân |
| **6. Quản lý Công việc & Dự án** (`activities`) | Xem toàn bộ công việc toàn viện | Xem việc liên quan tài chính | Quản lý & giao việc cho toàn bộ thành viên team | Quản lý việc cá nhân & việc được phối hợp | Quản lý việc học vụ & đào tạo | Quản lý việc nhân sự & tuyển dụng | Chỉ xem việc được giao, việc tự tạo |
| **7. Chấm công, Nghỉ phép & Nhân sự** (`hrm_leave_requests`, `users`) | Xem toàn viện, duyệt đơn cấp cao | Xem dữ liệu công để tính lương | Xem lịch nghỉ & duyệt phép cho nhân viên team | Xem lịch nghỉ hôm nay, chỉ xem phép của mình | Xem lịch nghỉ hôm nay, chỉ xem phép của mình | Toàn quyền quản trị nhân sự, tra cứu người nghỉ việc | Xem lịch nghỉ hôm nay, chỉ xem phép của mình |
| **8. Kho ấn phẩm & Cấp phát tài sản** (`hrm_assets`) | Toàn quyền điều chuyển tài sản | Định giá tài sản & khấu hao | Quản lý tài sản cấp phát cho team | Xem tồn kho quà tặng / tài liệu tuyển sinh | Xem tồn kho giáo trình môn học | Lập biên bản bàn giao & thu hồi khi off | Xem tài sản cá nhân được bàn giao |

---

## 🔄 CHƯƠNG V: GIAO THỨC BÀN GIAO & ĐỐI SOÁT CHÉO ĐA CẤP (CROSS-AGENT PROTOCOL)

Khi giải quyết các vấn đề phức hợp, các Agent tương tác với nhau theo **Giao Thức Bàn Giao Hướng Sự Kiện (Event-Driven Handover Protocol)**:

```
                  ┌──────────────────────────────────────────────┐
                  │           SỰ KIỆN KHỞI PHÁT (EVENT)          │
                  │   Ví dụ: Học viên đồng ý đóng cọc 20 triệu   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CHUỖI PHỐI HỢP LIÊN TÁC NHÂN (CHAIN OF COLLABORATION):                                         │
│                                                                                                │
│  [1. Agent Sales] ──Handover Payload──▶ [2. Agent Thu Chi] ──Handover Payload──▶ [3. Agent Task]│
│  - Cập nhật Pipeline bước 13            - Tạo Thẻ Đơn Hàng SO/Cọc               - Tạo 3 việc con│
│  - Trích xuất SĐT, học phí              - Mở sẵn DepositCreateDrawer            - Giao Onboarding│
│           │                                      │                                      │      │
│           └──────────────────────┬───────────────┴──────────────────────────────────────┘      │
│                                  ▼                                                             │
│                      [4. Agent Hồ Sơ & Pháp Lý] ◀──────────────────────────────────────────────┘
│                      - Đối soát checklist hồ sơ EMBA: CCCD, bằng ĐH, CV tiếng Anh còn thiếu
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ĐẦU RA TỔNG HỢP: SI IDEAS trả về câu trả lời hoàn thiện kèm 2 Thẻ Hành Động điền sẵn           │
│ [Thẻ 1: Mở Đơn Cọc 20tr] và [Thẻ 2: Mở Giao Việc Onboarding] để User kiểm tra và bấm Lưu.      │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5 Kịch Bản Thực Chiến Phối Hợp Đa Cấp:

#### 🌟 Kịch bản 1: Chuỗi Tuyển Sinh Chốt Cọc ➔ Thu Tiền ➔ Hồ Sơ Học Viên ➔ Kế Hoạch Onboarding
- **Đầu vào của User**: *"Học viên Nguyễn Văn An (SĐT: 0912345678) vừa chốt nộp cọc 20 triệu cho khóa EMBA Thụy Sĩ, hãy lên đơn cọc và chuẩn bị việc chăm sóc giúp tôi."*
- **Tiếp nhận & xử lý đa cấp**:
  1. `master` (SI IDEAS): Phân rã bài toán ➔ Nhận diện 4 thực thể: Khách hàng (An), Khóa học (EMBA), Số tiền (20tr), Thao tác (Tạo cọc + Lập việc).
  2. `sales` (Agent Sales): Tra cứu CSDL `contacts`, tìm thấy khách hàng #4582, đề xuất chuyển pipeline sang bước *13 – Deposit / Tuition Payment*.
  3. `finance` (Agent Thu Chi): Soạn thảo Action Proposal cho Đơn cọc / SO với giá trị 20.000.000đ, liên kết với [DepositCreateDrawer](file:///d:/GITHUB_SPACE/MYERP/src/components/DepositCreateDrawer.tsx).
  4. `records_legal` (Agent Hồ Sơ): Quét hồ sơ khách hàng #4582 trong `cloud_files`, cảnh báo: *"Học viên còn thiếu Bản dịch công chứng bằng Đại học và CV tiếng Anh"*.
  5. `tasks` (Agent Task): Lập Action Proposal tạo 2 công việc con: "Thu thập hồ sơ dịch thuật công chứng" và "Gửi thư xác nhận nhập học".
- **Đầu ra cho User**: Báo cáo tổng thể gãy gọn kèm 2 Thẻ Hành Động (Đơn cọc + Giao việc). User bấm vào thẻ, Form trượt ra đã điền sẵn 100%, User bấm "Lưu".

#### 🌟 Kịch bản 2: Nhân Sự Xin Nghỉ Phép ➔ Quét Rủi Ro Hạn Chót Task ➔ Đề Xuất Bàn Giao
- **Đầu vào của User**: *"Tuần sau tôi muốn xin nghỉ phép từ thứ 3 đến thứ 6 để đi việc gia đình."*
- **Tiếp nhận & xử lý đa cấp**:
  1. `hrm` (Agent Nhân Sự): Tính toán số ngày nghỉ (4 ngày), kiểm tra quỹ phép năm còn lại trong `hrm_leave_requests`.
  2. `tasks` (Agent Task): Tự động quét CSDL `activities`, phát hiện 2 task có `due_date` rơi vào thứ 4 và thứ 5 (trong đó có 1 task Khẩn cấp).
  3. `master` (SI IDEAS): Phối hợp cảnh báo: *"Đơn nghỉ phép 4 ngày đã được soạn sẵn. Tuy nhiên bạn có 1 việc khẩn cấp đến hạn ngày thứ 5: 'Hoàn thiện báo cáo tuyển sinh'. Bạn có muốn bàn giao việc này cho đồng nghiệp cùng team không?"* kèm Thẻ Đơn xin nghỉ phép và Thẻ Bàn giao việc.

#### 🌟 Kịch bản 3: Giám Sát Công Nợ Học Phí ➔ Tạm Hoãn Môn Học & Nhắc Nhở Chăm Sóc
- **Đầu vào của User**: *"Kiểm tra danh sách học viên lớp MBA-K12 xem có ai nợ học phí quá hạn không?"*
- **Tiếp nhận & xử lý đa cấp**:
  1. `finance` (Agent Thu Chi): Truy vấn bảng `sales_orders` và `sales_order_items`, phát hiện 3 học viên quá hạn đóng đợt 2 trên 15 ngày.
  2. `academic` (Agent Đào Tạo): Đối soát lịch học môn tiếp theo (Khai giảng tuần tới), cảnh báo điều kiện tín chỉ.
  3. `sales` (Agent Sales): Soạn sẵn kịch bản tin nhắn nhắc học phí tinh tế theo văn hóa Viện IDEAS để Tư vấn viên gửi cho học viên.

#### 🌟 Kịch bản 4: Chiến Dịch Tuyển Sinh Mới ➔ Dự Toán Ngân Sách PO ➔ Kiểm Kho & Phân Rã WBS
- **Đầu vào của User**: *"Tổ chức Hội thảo Tuyển sinh Mini-MBA tháng sau tại GEM Center cho 100 khách."*
- **Tiếp nhận & xử lý đa cấp**:
  1. `marketing_campaigns`: Lập kế hoạch truyền thông, mục tiêu 100 khách, 25 lead nóng.
  2. `finance`: Lập dự toán chi phí địa điểm, teabreak (25.000.000đ) ➔ Soạn Action Proposal Phiếu chi PO.
  3. `assets_inventory`: Kiểm tra kho ấn phẩm quà tặng (`hrm_assets`), cảnh báo: *"Kho chỉ còn 60 túi quà, cần đặt in thêm 40 túi trước 10 ngày"*.
  4. `tasks`: Phân rã WBS thành 4 việc con giao cho Marketing, Hậu cần, Sales.

#### 🌟 Kịch bản 5: Báo Cáo Sức Khỏe Doanh Nghiệp Thời Gian Thực (Dành Cho Ban Giám Đốc)
- **Đầu vào của Ban Giám Đốc**: *"Cho tôi báo cáo nhanh tình hình thu chi, dòng tiền và tiến độ tuyển sinh tuần này."*
- **Tiếp nhận & xử lý đa cấp**:
  1. `executive_bi`: Tổng hợp số liệu thu cọc thực tế từ `sales_orders`, chi phí đã giải ngân từ `expenses`, tính dòng tiền ròng (Net Cashflow).
  2. `sales`: Thống kê số lượng lead mới, tỷ lệ chốt đơn theo từng kênh.
  3. `hrm`: Báo cáo tỷ lệ đi làm đúng giờ, số nhân sự đang WFH/nghỉ phép.
  4. `master`: Đóng gói thành Dashboard tóm tắt 3 đoạn rõ ràng, kèm chỉ số cảnh báo rủi ro (nếu có).

---

## 🔒 CHƯƠNG VI: NGUYÊN TẮC THÉP VỀ QUYỀN HẠN ĐẦU CUỐI: SMART DRAFTER ➔ FINAL HUMAN COMMITTER

Để loại bỏ hoàn toàn nguy cơ AI tự ý thao túng dữ liệu tài chính hoặc ghi nhầm CSDL, hệ thống thiết lập nguyên tắc:

```
┌──────────────────────────────────────────────┐       ┌──────────────────────────────────────────────┐
│       PHẠM VI QUYỀN HẠN CỦA MULTI-AGENT      │       │          QUYỀN HẠN TỐI CAO CỦA USER          │
├──────────────────────────────────────────────┤       ├──────────────────────────────────────────────┤
│ ✅ Phân tích câu lệnh đa cấp, đối soát chéo. │       │ 👑 Xem xét toàn bộ thông tin AI đã điền sẵn. │
│ ✅ Tra cứu CSDL lấy đúng thực thể.           │  ──▶  │ 👑 Chỉnh sửa trực tiếp bất kỳ ô nhập liệu.  │
│ ✅ Tính toán công thức, đợt cọc, ngày tháng. │       │ 👑 Toàn quyền BẤM NÚT LƯU để ghi vào CSDL.  │
│ ✅ Khởi tạo Thẻ Hành Động (Action Proposal). │       │ 👑 Hoặc BẤM NÚT HỦY nếu không đồng ý.       │
│ ✅ Mở Drawer/Modal và điền sẵn 100% dữ liệu. │       │                                              │
│ ❌ CẤM TỰ Ý GỌI API LƯU NGẦM VÀO DATABASE!   │       │                                              │
└──────────────────────────────────────────────┘       └──────────────────────────────────────────────┘
```

1. **Chuẩn Hóa Thẻ Hành Động ([ActionProposalCard.tsx](file:///d:/GITHUB_SPACE/MYERP/src/components/chat/ActionProposalCard.tsx))**:
   - Khi Agent phản hồi, thẻ hành động xuất hiện với đầy đủ thông tin: Tiêu đề, loại hành động, tóm tắt và bảng chi tiết tham số.
   - Thẻ hiển thị nút bấm nổi bật: **"Mở phiếu & Điền sẵn thông tin"**.
2. **Kích Hoạt Drawer/Modal Nghiệp Vụ Tương Ứng**:
   - Nhấn nút sẽ kích hoạt các Drawer/Modal chuyên dụng: [DepositCreateDrawer](file:///d:/GITHUB_SPACE/MYERP/src/components/DepositCreateDrawer.tsx) (cho SO/Cọc), `ExpenseCreateDrawer` (cho Phiếu chi/Tạm ứng), [TaskDrawer](file:///d:/GITHUB_SPACE/MYERP/src/components/chat/ActionProposalCard.tsx#L218) (cho Giao việc), `QuickAddLeadModal` (cho Khách mới), `CreateLeaveModal` (cho Nghỉ phép).
3. **Người Dùng Là Chốt Chặn Cuối Cùng**:
   - Dữ liệu được nạp vào đúng các ô nhập liệu (`input`, `CustomSelect`, `CurrencyInput`).
   - Người dùng có thể kiểm tra, thay đổi số tiền, sửa ngày tháng, thêm ghi chú.
   - **Chỉ khi người dùng bấm nút "Lưu" / "Xác nhận tạo" trên Drawer/Modal, request API `POST` mới được kích hoạt**.

---

## 🌪️ CHƯƠNG VII: MA TRẬN KIỂM THỬ ĐỐI KHÁNG 7 CHIỀU CỦA QA/QC HACKER

Bản kế hoạch của Red Team QA Hacker nhằm bẻ gãy hệ thống:

```
                                  [KHO VŨ KHÍ TẤN CÔNG RED TEAM QA]
                                                  │
         ┌───────────────────┬────────────────────┼────────────────────┬───────────────────┐
         ▼                   ▼                    ▼                    ▼                   ▼
    [Chiều 1: SST]     [Chiều 2: RBAC]      [Chiều 3: HITL]      [Chiều 4: Chaos]    [Chiều 5: Swarm]
    Bẫy số liệu ảo,    IDOR, Branch         Parameter Tampering, Spam Clicks, Race   Vòng lặp vô tận,
    SQL Injection      Spoofing, Role Hack  Commit ngầm lọt lưới Condition, Abort    Deadlock phân quyền
```

| Chiều Tấn Công | Kịch Bản Khai Thác Của Hacker QA | Hành Vi Hệ Thống Bị Coi Là LỖI (REJECT ❌) | Hành Vi Hệ Thống ĐẠT Chuẩn (PASS ✅) |
| :--- | :--- | :--- | :--- |
| **1. Nguồn Chân Lý (Ground Truth & SST)** | • Nhập ID không tồn tại (`#99999999`).<br>• Tiêm payload SQL (`' OR '1'='1`).<br>• Tra cứu học viên chưa đóng tiền. | • Tự bịa số tiền đã đóng hoặc tự bịa thông tin khách.<br>• Bị crash lỗi cú pháp SQL (PDO Exception). | • Báo rõ không tìm thấy dữ liệu trong CSDL.<br>• PDO Prepared Statements escape sạch sẽ 100%. |
| **2. Bẻ Gãy Phân Quyền (RBAC & IDOR)** | • Sales hỏi xem bảng lương của Giám đốc.<br>• Nhân viên HN tra cứu Lead của HCM.<br>• Nhân viên thường đòi xem P&L toàn viện. | • Trả về thông tin nhạy cảm của người khác.<br>• Lộ hash mật khẩu, token, OTP trong response. | • Từ chối nhã nhặn, nêu rõ giới hạn phân quyền.<br>• Backend cưỡng chế `WHERE user_id = auth_uid`. |
| **3. Can Thiệp Quyền Hạn (Smart Drafter)** | • Can thiệp số âm (`-5 triệu`), số 0đ.<br>• Bắt gói tin F12 xem có request lưu ngầm.<br>• Sửa dữ liệu trên form rồi bấm Lưu. | • Tự động gửi API lưu ngầm khi User chưa bấm.<br>• Form nhận số tiền âm hoặc crash format tiền tệ.<br>• Lưu giá trị cũ của AI thay vì giá trị User sửa. | • Chỉ hiển thị ActionProposalCard & mở Drawer.<br>• Bắt buộc người dùng bấm Lưu mới gửi request.<br>• Lưu chính xác giá trị người dùng vừa sửa. |
| **4. Bắn Tải Đồng Thời (Concurrency)** | • Click 10 lần liên tục vào nút "Mở phiếu".<br>• Gửi 2 request đổi trạng thái đơn song song. | • Mở 10 Drawer đè lên nhau, đơ trình duyệt.<br>• Tạo 2 bản ghi trùng lặp hoặc trừ tiền đúp. | • Synchronous Ref Guard chặn từ cú click thứ 2.<br>• SQL Atomic Update & Idempotency Key bảo vệ. |
| **5. Đa Tab & Xung Đột Dữ Liệu** | • Tab 1 bấm Duyệt phiếu chi, Tab 2 bấm Từ chối. | • Ghi đè trạng thái sai lệch, mất lịch sử duyệt. | • Database Transaction phát hiện xung đột trạng thái. |
| **6. Mạng Hỗn Loạn & Hủy Vòng Đời** | • Đóng modal hoặc đổi tab khi đang stream AI.<br>• Ngắt kết nối mạng giữa chừng. | • Bắn toast đỏ báo lỗi mạng gây hoang mang.<br>• Spinner xoay vô tận làm treo màn hình. | • `AbortController` hủy im lặng, không văng lỗi.<br>• Hiển thị nút "Thử lại" thân thiện. |
| **7. Biên Dữ Liệu & Rỗng (Boundary)** | • Tài khoản mới tinh (0 task, 0 lead, 0 phiếu).<br>• Danh sách 10.000 lead cần phân trang. | • Crash màn hình trắng do gọi `.map()` trên null.<br>• Kéo toàn bộ bảng về Client làm nghẽn RAM. | • Hiển thị Empty State sạch sẽ, chuyên nghiệp.<br>• Phân trang Server-side, chỉ lấy Top 3-5 records. |

---

## 🚪 CHƯƠNG VIII: BỘ TIÊU CHUẨN NGHIỆM THU 4 CỔNG (4 GATES HANDSHAKE) & LỘ TRÌNH THỰC THI

```
[Senior Full-Stack DEV]                                            [Zero-Trust Tester / QA]
  Gate 1: Contract & Blast Radius Grep Scan ──▶
  Gate 2: Code, Double Build Pass & 4 Proofs ──▶
                                                 Gate 3: Adversarial Chaos & Security Audit
                                             ◀── [REJECT nếu lỗi / Trả về DEV kèm log chi tiết]
                                                 Gate 4: Blast Radius & Regression Sign-Off
```

### Các Bước Triển Khai Kỹ Thuật (Implementation Roadmap):

1. **Bước 1 (Frontend)**:
   - Cập nhật [aiAgents.ts](file:///d:/GITHUB_SPACE/MYERP/src/constants/aiAgents.ts) mở rộng đầy đủ **11 Chuyên Gia Agent** kèm avatars sticker tương ứng (`ideas_18.webp`, `ideas_32.webp`, `ideas_20.webp`, `ideas_31.webp`, `ideas_11.webp`).
   - Cập nhật hàm `detectActiveAgent` và cơ chế lắng nghe sự kiện Swarm.
2. **Bước 2 (Backend Chat Controller)**:
   - Cập nhật [ChatController.php](file:///d:/GITHUB_SPACE/MYERP/backend/controllers/ChatController.php) (`resolveCollaboratingAgents`), bổ sung logic bóc tách Intent đa cấp và điều phối Swarm.
   - Mở rộng vòng lặp Tool Execution (hỗ trợ Chained Multi-turn Calls - tối đa 3 turns).
3. **Bước 3 (Backend Tool Registry)**:
   - Cập nhật [AgentToolRegistry.php](file:///d:/GITHUB_SPACE/MYERP/backend/controllers/AgentToolRegistry.php) bổ sung các tool chuyên sâu cho 5 Agent mới:
     * `check_student_admission_records` (Agent Hồ sơ)
     * `get_inventory_and_asset_status` (Agent Kho & Tài sản)
     * `get_campaign_marketing_stats` (Agent Marketing)
     * `get_executive_financial_pulse` (Agent Trợ lý Giám đốc)
     * `get_system_health_status` (Agent Kỹ thuật IT)
4. **Bước 4 (Frontend Action Card & Drawer Hookup)**:
   - Đồng bộ hóa [ActionProposalCard.tsx](file:///d:/GITHUB_SPACE/MYERP/src/components/chat/ActionProposalCard.tsx) để hỗ trợ đầy đủ các loại Drawer nghiệp vụ tương ứng với 5 Agent mới.
5. **Bước 5 (QA Red Team Pentest & Regression Sign-off)**:
   - Triển khai toàn bộ 7 chiều kiểm thử đối kháng. Đạt Exit Code 0 trên cả Frontend TypeScript build và Backend PHP Syntax check trước khi nghiệm thu.

---

> **TRƯỞNG BAN THẨM ĐỊNH & RED TEAM QA/QC HACKER KÝ DUYỆT**:  
> *Bản thiết kế này quy định chuẩn mực cho toàn bộ hệ thống Multi-Agent của MYERP. Bất kỳ dòng code nào không đáp ứng tiêu chuẩn Phân Cấp Đa Tầng, Zero-Trust RBAC và Smart Drafter đều sẽ bị REJECT ngay lập tức.*
