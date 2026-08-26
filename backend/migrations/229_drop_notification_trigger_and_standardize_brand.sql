-- Migration 229: Drop legacy trigger and update brand to IDEAS ERP
DROP TRIGGER IF EXISTS `trg_after_notification_insert`;

UPDATE `system_settings` SET `setting_value` = 'systemnoti@ideas.edu.vn' WHERE `setting_key` = 'ses_sender_email';
UPDATE `system_settings` SET `setting_value` = 'IDEAS NOTIFICATION' WHERE `setting_key` = 'ses_sender_name';
UPDATE `system_settings` SET `setting_value` = 'IDEAS ERP' WHERE `setting_key` = 'company_name' OR `setting_key` = 'brand_name';
