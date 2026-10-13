<?php
// backend/migrations/316_create_ai_agent_intelligence_memory.php
// Tự động tạo bảng lưu trữ Trí nhớ dài hạn (Episodic Memory) và Ngữ cảnh thực thể gần đây (Entity Context) cho AI Agent

$sql = "
CREATE TABLE IF NOT EXISTS `ai_user_memories` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL DEFAULT 1,
  `user_id` INT NOT NULL,
  `memory_key` VARCHAR(100) NOT NULL,
  `memory_value` TEXT NOT NULL,
  `category` ENUM('preference', 'working_context', 'project_priority', 'relationship') NOT NULL DEFAULT 'working_context',
  `importance` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_aum_user_tenant` (`tenant_id`, `user_id`),
  INDEX `idx_aum_cat` (`category`),
  UNIQUE KEY `uniq_user_key` (`tenant_id`, `user_id`, `memory_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_entity_context` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL DEFAULT 1,
  `user_id` INT NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT NOT NULL,
  `entity_name` VARCHAR(255) NOT NULL,
  `metadata_json` TEXT NULL,
  `last_referenced_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_aec_user_entity` (`tenant_id`, `user_id`, `entity_type`),
  INDEX `idx_aec_last_ref` (`last_referenced_at`),
  UNIQUE KEY `uniq_user_entity` (`tenant_id`, `user_id`, `entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

if (isset($db) && $db instanceof PDO) {
    $db->exec($sql);
    return;
}

if (isset($conn) && $conn instanceof mysqli) {
    $conn->multi_query($sql);
    while ($conn->more_results() && $conn->next_result()) {;}
    return;
}
