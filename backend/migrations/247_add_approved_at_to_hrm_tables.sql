-- backend/migrations/247_add_approved_at_to_hrm_tables.sql
-- Thêm cột approved_at vào hrm_leave_requests và approved_by, approved_at vào hrm_salary_advances
ALTER TABLE hrm_leave_requests ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL DEFAULT NULL AFTER approved_by;
ALTER TABLE hrm_salary_advances ADD COLUMN IF NOT EXISTS approved_by INT NULL DEFAULT NULL AFTER status_level_2;
ALTER TABLE hrm_salary_advances ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL DEFAULT NULL AFTER approved_by;
