-- Migration 239: Thêm Compound Indexes tăng tốc tối đa cho Activities, Notes, Contacts và Leads

ALTER TABLE `activities` ADD INDEX IF NOT EXISTS `idx_act_rel_del` (`tenant_id`, `related_type`, `related_id`, `deleted_at`);
ALTER TABLE `activities` ADD INDEX IF NOT EXISTS `idx_act_cid_del` (`tenant_id`, `contact_id`, `deleted_at`);
ALTER TABLE `notes` ADD INDEX IF NOT EXISTS `idx_notes_entity` (`tenant_id`, `entity_type`, `entity_id`);
ALTER TABLE `contacts` ADD INDEX IF NOT EXISTS `idx_contacts_person` (`tenant_id`, `person_id`, `deleted_at`);
ALTER TABLE `leads` ADD INDEX IF NOT EXISTS `idx_leads_person` (`tenant_id`, `person_id`);
