# YÊU CẦU THIẾT KẾ QUY TRÌNH HOA HỒNG (MYERP)
> **Ngày ghi nhận:** 18/09/2026  
> **Trạng thái:** Chờ xác nhận người dùng trước khi triển khai  
> **Nguồn prompt:** Yêu cầu từ người dùng trong phiên làm việc MYERP

---

## 1. NGUYÊN VĂN PROMPT TỪ NGƯỜI DÙNG

```text
Xin chào bây giờ tôi cần bạn thiết kế thêm 1 quy trình Hoa hồng. 
Người tạo có thể là người duyệt luôn nha. 
RỒi tiếp theo là tiền chuyển là nội bộ nhưng mà được chọn nhiều nhân viên trong đó, 
Auto fill stk của các nhân viên sale vào. ko giới hạn số lượng nhân viên, chọn người nhận, số tiền, và nội dung. 
Ai được chọn là tự động gắn thành người liên quan, còn quy trình thì vẫn duyệt như quy trình thanh toán bình thường. 
tối ưu thông báo. 
Khi kế toán up xác nhận thì phải click xác nhận hoặc tải UNC từng ô của người nào thì sẽ thông báo riêng cho người đó, 
ko thông báo hàng loạt nếu kế toán xác nhận đã trả hoa hồng cho A thì ko được thông báo cho B. 
Làm chuẩn nha.
```

---

## 2. PHÂN TÍCH YÊU CẦU & BÓC TÁCH NGHIỆP VỤ

### 2.1. Loại quy trình & Cơ chế phê duyệt
- **Tên quy trình**: Đề xuất chi trả **Hoa hồng** (`workflow_type = 'commission'` hoặc loại chi phí tương ứng trong module Quy trình / Đề xuất thanh toán).
- **Quyền tự duyệt (Self-approval)**:
  - Thông thường quy trình thanh toán chặn người tạo tự duyệt đơn của mình.
  - Riêng quy trình Hoa hồng: **Người tạo có thể đồng thời là người duyệt** (hệ thống cho phép người tạo tự duyệt bước của mình nếu nằm trong chuỗi duyệt).
  - Các bước phê duyệt sau đó kế thừa các cấp duyệt như quy trình thanh toán bình thường (Quản lý -> Ban Giám Đốc -> Kế toán).

### 2.2. Danh sách nhân sự thụ hưởng (Multi-recipient)
- **Hình thức chi tiền**: Chuyển khoản nội bộ cho nhiều nhân sự trong một phiếu duy nhất.
- **Không giới hạn số lượng nhân sự** trong một phiếu đề xuất.
- **Mỗi dòng nhân sự bao gồm**:
  - `user_id`: Chọn nhân viên (Sale / Nhân sự).
  - `bank_name`, `bank_account`, `bank_owner`: Tự động Auto-fill từ hồ sơ nhân viên trong hệ thống (`users`). Cho phép chỉnh sửa nếu nhân viên đổi tài khoản.
  - `amount`: Số tiền hoa hồng chi trả cho nhân viên đó.
  - `note` / `content`: Nội dung chi tiết lý do chi hoa hồng cho từng người.
- **Tổng tiền**: Tự động tính tổng tiền toàn bộ phiếu bằng tổng số tiền các dòng nhân viên.

### 2.3. Tự động gắn Người liên quan
- Bất kỳ nhân sự nào có tên trong danh sách nhận hoa hồng sẽ được hệ thống **tự động thêm vào danh sách người liên quan (participants / followers)** của đề xuất để theo dõi tiến độ xử lý của phiếu.

### 2.4. Tối ưu thông báo & Xác nhận thanh toán từng người
- **Giao diện Kế toán**:
  - Với mỗi dòng nhân sự trong danh sách, Kế toán có thể:
    - Bấm nút **Xác nhận thanh toán** riêng cho từng người.
    - Hoặc tải lên tệp **UNC (Ủy nhiệm chi)** riêng cho từng người.
- **Quy tắc phân tách thông báo (Bảo mật số liệu hoa hồng)**:
  - **Tuyệt đối không thông báo hàng loạt**: Khi kế toán xác nhận chi hoặc up UNC cho nhân viên A, hệ thống **CHỈ gửi thông báo riêng cho nhân viên A**.
  - Nhân viên B không nhận được thông báo về việc thanh toán của A, đảm bảo tính riêng tư và bảo mật thu nhập hoa hồng giữa các nhân sự.

---

## 3. PHẠM VI ẢNH HƯỞNG HỆ THỐNG KHI TRIỂN KHAI

| Thành phần | Phạm vi ảnh hưởng cụ thể |
| :--- | :--- |
| **Database** | - Định nghĩa loại quy trình Hoa hồng (`commission`).<br>- Cấu trúc lưu trữ danh sách dòng chi tiết hoa hồng (line items: `user_id`, `bank_info`, `amount`, `note`, `payment_status`, `unc_url`, `paid_at`, `paid_by`). |
| **Backend API** | - `FinanceController.php` / `WorkflowController.php`: API tạo đề xuất hoa hồng, tự động fill thông tin ngân hàng của nhân viên.<br>- Bỏ chặn tự duyệt đối với người tạo trong quy trình hoa hồng.<br>- API xác nhận thanh toán / upload UNC cho từng dòng nhân sự.<br>- Service thông báo: Gửi notification đích danh đến từng `user_id` khi dòng của họ được xác nhận/up UNC. |
| **Frontend UI** | - Form tạo đề xuất Hoa hồng: Bảng chọn nhiều nhân viên, auto-fill STK, tính tổng tiền tự động.<br>- Drawer chi tiết đề xuất: Bảng danh sách thụ hưởng, phân quyền các nút thao tác Xác nhận/Upload UNC theo từng dòng dành cho Kế toán.<br>- Bộ lọc & Danh sách hiển thị tương thích. |

---

> ⚠️ **LƯU Ý THEO AGENTS RULES:**  
> Trước khi thực hiện sửa code, tạo migration hay can thiệp hệ thống, bắt buộc phải có sự xác nhận chính thức từ người dùng.
