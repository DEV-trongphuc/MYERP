# QUY TẮC LÀM VIỆC DỰ ÁN MYERP (AGENTS RULES)

## 1. Xác nhận trước khi thực hiện (BẮT BUỘC)
- **Luôn luôn xác nhận với người dùng trước khi bắt đầu thực hiện bất kỳ task mới nào**:
  - Khi người dùng gửi yêu cầu công việc mới, AI phải tóm tắt lại các điểm chính cần làm, phạm vi ảnh hưởng (frontend, backend, database).
  - Đặt câu hỏi xác nhận ngắn gọn, rõ ràng để người dùng duyệt trước khi tiến hành viết code hay sửa đổi hệ thống.
  - Tuyệt đối không tự ý nhảy vào sửa code hoặc chạy migration khi chưa có sự xác nhận của người dùng.

## 2. Quản lý ngữ cảnh và phân tách task
- Không nhầm lẫn hoặc lôi các logic/vấn đề của các task cũ đã đóng vào task mới.
- Mỗi task mới phải được tiếp cận độc lập, rõ ràng theo đúng yêu cầu hiện tại của người dùng.

## 3. Tiêu chuẩn chất lượng
- Rà soát kỹ lưỡng logic từ UI -> Backend API -> Database -> Đồng bộ công lương/báo cáo liên quan.
- Đảm bảo tính toán đồng bộ, không để sai lệch số liệu thực tế.
