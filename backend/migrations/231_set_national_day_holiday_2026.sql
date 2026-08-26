-- Migration 231: Configure National Day Holiday 2026 (29/08/2026 to 02/09/2026)
INSERT INTO `system_settings` (`setting_key`, `setting_value`)
VALUES ('holiday_schedules', '[{"id":"quoc_khanh_2026","name":"Nghỉ lễ Quốc Khánh 2/9","start_date":"2026-08-29","end_date":"2026-09-02","start":"2026-08-29","end":"2026-09-02","description":"Nghỉ lễ Quốc khánh từ 29/08 đến hết 02/09/2026. Bắt đầu làm việc lại ngày 03/09/2026.","is_paid":1,"require_checkin":0}]')
ON DUPLICATE KEY UPDATE `setting_value` = '[{"id":"quoc_khanh_2026","name":"Nghỉ lễ Quốc Khánh 2/9","start_date":"2026-08-29","end_date":"2026-09-02","start":"2026-08-29","end":"2026-09-02","description":"Nghỉ lễ Quốc khánh từ 29/08 đến hết 02/09/2026. Bắt đầu làm việc lại ngày 03/09/2026.","is_paid":1,"require_checkin":0}]';
