-- Migration 228: Ensure all company user emails are active, verified and system settings point to MYERP
UPDATE `users` 
SET `is_active` = 1, `status` = 'active' 
WHERE `email` IS NOT NULL AND `email` != '' AND (`is_active` = 0 OR `status` IS NULL OR `status` != 'active');

REPLACE INTO `system_settings` (`setting_key`, `setting_value`) 
VALUES ('frontend_url', 'https://myerp.ideas.edu.vn');

REPLACE INTO `system_settings` (`setting_key`, `setting_value`) 
VALUES ('ses_sender_email', 'systemnoti@ideas.edu.vn');

REPLACE INTO `system_settings` (`setting_key`, `setting_value`) 
VALUES ('ses_sender_name', 'IDEAS NOTIFICATION');
