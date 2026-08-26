-- Migration 232: Normalize Task Due Dates to 23:59:59 & Clean Bogus Overdue Alerts
UPDATE activities SET due_date = CONCAT(DATE(due_date), ' 23:59:59') WHERE TIME(due_date) = '00:00:00';
DELETE FROM notifications WHERE title LIKE '%Nhắc nhở: Ngày mai bắt đầu làm việc trở lại%';
DELETE FROM notifications WHERE type = 'task_overdue' AND title LIKE '%CẢNH BÁO SLA%' AND (body LIKE '%26/08/2026%' OR body LIKE '%00:00%');
INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '232') ON DUPLICATE KEY UPDATE setting_value = '232';
