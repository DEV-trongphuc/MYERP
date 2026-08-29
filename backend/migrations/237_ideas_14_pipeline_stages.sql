-- Migration 237: Cập nhật 14 Stages Pipeline Tuyển sinh IDEAS & Cấu trúc CRM
-- Thêm các cột cho bảng pipeline_stages
ALTER TABLE `pipeline_stages` 
  ADD COLUMN IF NOT EXISTS `definition` text DEFAULT NULL COMMENT 'Định nghĩa / Milestone khách hàng',
  ADD COLUMN IF NOT EXISTS `target_goal` text DEFAULT NULL COMMENT 'Mục tiêu giai đoạn',
  ADD COLUMN IF NOT EXISTS `sales_actions` text DEFAULT NULL COMMENT 'Sales Action chính / Checklist',
  ADD COLUMN IF NOT EXISTS `exit_criteria` text DEFAULT NULL COMMENT 'Tiêu chuẩn đầu ra (Exit Criteria)';

-- Thêm các cột CRM cho bảng contacts
ALTER TABLE `contacts`
  ADD COLUMN IF NOT EXISTS `lead_status` enum('active','nurture','lost') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái Lead: Active, Nurture, Lost',
  ADD COLUMN IF NOT EXISTS `lead_temperature` varchar(50) DEFAULT 'warm' COMMENT 'Độ nóng Lead: hot, warm, low_intent, nurture',
  ADD COLUMN IF NOT EXISTS `next_action` varchar(255) DEFAULT NULL COMMENT 'Hành động tiếp theo',
  ADD COLUMN IF NOT EXISTS `next_followup_date` datetime DEFAULT NULL COMMENT 'Ngày follow-up tiếp theo',
  ADD COLUMN IF NOT EXISTS `expected_decision_date` date DEFAULT NULL COMMENT 'Ngày dự kiến khách ra quyết định',
  ADD COLUMN IF NOT EXISTS `expected_intake` varchar(100) DEFAULT NULL COMMENT 'Kỳ nhập học dự kiến',
  ADD COLUMN IF NOT EXISTS `nurture_reason` text DEFAULT NULL COMMENT 'Lý do nuôi dưỡng (Nurture Reason)',
  ADD COLUMN IF NOT EXISTS `lost_reason` text DEFAULT NULL COMMENT 'Lý do mất Lead (Lost Reason)',
  ADD COLUMN IF NOT EXISTS `lost_stage_id` int(11) DEFAULT NULL COMMENT 'Stage tại thời điểm mất Lead';

-- Thêm các cột CRM cho bảng deals nếu cần
ALTER TABLE `deals`
  ADD COLUMN IF NOT EXISTS `next_action` varchar(255) DEFAULT NULL COMMENT 'Hành động tiếp theo',
  ADD COLUMN IF NOT EXISTS `next_followup_date` datetime DEFAULT NULL COMMENT 'Ngày follow-up tiếp theo',
  ADD COLUMN IF NOT EXISTS `expected_intake` varchar(100) DEFAULT NULL COMMENT 'Kỳ nhập học dự kiến',
  ADD COLUMN IF NOT EXISTS `nurture_reason` text DEFAULT NULL COMMENT 'Lý do nuôi dưỡng',
  ADD COLUMN IF NOT EXISTS `lost_stage_id` int(11) DEFAULT NULL COMMENT 'Stage tại thời điểm mất Deal';
