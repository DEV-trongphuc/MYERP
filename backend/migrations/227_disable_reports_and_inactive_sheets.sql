-- Migration 227: Disable automated reports & inactive sheet connections
UPDATE sheet_connections SET is_active = 0;

REPLACE INTO system_settings (setting_key, setting_value) VALUES ('zalo_daily_report_enabled', '0');
REPLACE INTO system_settings (setting_key, setting_value) VALUES ('zalo_weekly_report_day', '0');
REPLACE INTO system_settings (setting_key, setting_value) VALUES ('zalo_monthly_report_enabled', '0');
REPLACE INTO system_settings (setting_key, setting_value) VALUES ('attendance_report_enabled', '0');
REPLACE INTO system_settings (setting_key, setting_value) VALUES ('telegram_daily_report_enabled', '0');
REPLACE INTO system_settings (setting_key, setting_value) VALUES ('telegram_weekly_report_enabled', '0');
REPLACE INTO system_settings (setting_key, setting_value) VALUES ('telegram_monthly_report_enabled', '0');
