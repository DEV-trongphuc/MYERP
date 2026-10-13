<?php
// backend/migrations/314_create_ai_query_audit_logs.php
// Tự động ghi vết và phân tích câu hỏi người dùng, nhận diện khoảng trống tri thức (Intent Gap Detection)

$sql = "
CREATE TABLE IF NOT EXISTS ai_query_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT DEFAULT 1,
  user_id INT NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  query_text TEXT NOT NULL,
  rag_chunks_found INT DEFAULT 0,
  erp_records_found INT DEFAULT 0,
  has_action_proposal TINYINT(1) DEFAULT 0,
  fallback_triggered TINYINT(1) DEFAULT 0,
  needs_training TINYINT(1) DEFAULT 0,
  gap_category VARCHAR(100) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_needs_training (needs_training),
  INDEX idx_gap_cat (gap_category),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

if (isset($db) && $db instanceof PDO) {
    $db->exec($sql);
    return;
}

if (isset($conn) && $conn instanceof mysqli) {
    $conn->query($sql);
    return;
}
