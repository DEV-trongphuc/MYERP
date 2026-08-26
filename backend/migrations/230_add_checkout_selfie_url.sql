-- Migration 230: Add checkout_selfie_url column to check_ins table
ALTER TABLE `check_ins` 
ADD COLUMN `checkout_selfie_url` TEXT NULL AFTER `check_out_time`,
MODIFY COLUMN `selfie_url` TEXT NULL;
