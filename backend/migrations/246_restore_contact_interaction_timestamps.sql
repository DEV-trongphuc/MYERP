-- Migration 246: Khôi phục lại thời gian tương tác thực tế (updated_at/last_contact) cho các danh bạ đã cập nhật
UPDATE contacts c
SET c.updated_at = COALESCE(c.last_contact, c.created_at)
WHERE c.last_contact IS NOT NULL AND c.updated_at > c.last_contact;
