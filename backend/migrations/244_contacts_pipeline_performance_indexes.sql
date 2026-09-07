-- Migration 244: Tối ưu hiệu năng truy vấn Pipeline Contacts & Stage Counting
ALTER TABLE `contacts` ADD INDEX IF NOT EXISTS `idx_contacts_tenant_lead_stage` (`tenant_id`, `lead_status`, `stage_id`, `deleted_at`);
ALTER TABLE `contacts` ADD INDEX IF NOT EXISTS `idx_contacts_lead_status` (`lead_status`);
ALTER TABLE `contacts` ADD INDEX IF NOT EXISTS `idx_contacts_last_contact` (`tenant_id`, `last_contact`, `deleted_at`);
