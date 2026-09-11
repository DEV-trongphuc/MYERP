-- Migration: 248_add_approved_by_to_expenses.sql
ALTER TABLE `expenses` ADD COLUMN `approved_by` INT(11) NULL DEFAULT NULL AFTER `approver_id`;
UPDATE `expenses` SET `approved_by` = `approver_id` WHERE `approved_by` IS NULL AND `approver_id` IS NOT NULL;
