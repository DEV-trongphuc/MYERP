# QUY TẮC LÀM VIỆC DỰ ÁN MYERP (AGENTS RULES)

## 1. Xác nhận trước khi thực hiện (BẮT BUỘC)
- Khi nhận yêu cầu mới: Tóm tắt điểm chính cần làm, phạm vi ảnh hưởng (Frontend, Backend, Database).
- Đặt câu hỏi xác nhận ngắn gọn để người dùng duyệt trước khi viết code hay chỉnh sửa hệ thống.
- Tuyệt đối không tự ý sửa code hoặc chạy migration khi chưa có sự xác nhận của người dùng.

## 2. Quy tắc Deploy Production (NGHIÊM NGẶT)
- **Tuyệt đối không tự ý deploy lên server production (`deploy-myerp.ps1`)**:
  - Đặc biệt trong giờ hành chính, cơ chế Auto-Update reload trang sẽ làm gián đoạn công việc của nhân sự.
  - Chỉ thực hiện deploy khi người dùng có yêu cầu/cho phép tường minh bằng lệnh rõ ràng.
  - Mọi thay đổi và kiểm thử thông thường chỉ thực hiện ở môi trường local và commit/push git khi được yêu cầu.

## 3. Quản lý ngữ cảnh và phân tách task
- Không nhầm lẫn hoặc lôi logic/vấn đề của các task cũ đã đóng vào task mới.
- Mỗi task mới được tiếp cận độc lập, rõ ràng theo đúng yêu cầu hiện tại.

## 4. Tiêu chuẩn chất lượng
- Rà soát kỹ lưỡng luồng dữ liệu: UI -> Backend API -> Database -> Báo cáo/Công lương liên quan.
- Đảm bảo tính toán đồng bộ, không để sai lệch số liệu thực tế.
