-- Migration 240: Bổ sung chỉ mục tối ưu hiệu năng cho distribution_logs, data_reports và audit_logs

ALTER TABLE `distribution_logs` ADD INDEX IF NOT EXISTS `idx_dl_lead_assign` (`lead_id`, `assigned_to`);
ALTER TABLE `data_reports` ADD INDEX IF NOT EXISTS `idx_dr_lead_consultant` (`lead_id`, `consultant_id`);
ALTER TABLE `audit_logs` ADD INDEX IF NOT EXISTS `idx_al_res_act` (`resource`, `resource_id`, `action`);
