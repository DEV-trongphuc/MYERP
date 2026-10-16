<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

try {
    // 1. Check Column existence
    $stmt = $pdo->query("SHOW COLUMNS FROM subscribers LIKE 'salesperson'");
    $column = $stmt->fetch();
    
    // 2. Count subscribers with salesperson data
    $stmt = $pdo->query("SELECT COUNT(*) FROM subscribers WHERE salesperson IS NOT NULL AND salesperson != ''");
    $count = $stmt->fetchColumn();
    
    // 3. Get sample data
    $stmt = $pdo->query("SELECT id, email, first_name, last_name, salesperson, joined_at FROM subscribers WHERE salesperson IS NOT NULL AND salesperson != '' LIMIT 10");
    $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 4. Check custom_attributes for any salesperson keys (legacy)
    $stmt = $pdo->query("SELECT id, email, custom_attributes FROM subscribers WHERE custom_attributes LIKE '%salesperson%' LIMIT 5");
    $legacy = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'column_info' => $column,
        'total_with_salesperson' => (int)$count,
        'samples' => $samples,
        'legacy_mentions' => $legacy,
        'message' => $count > 0 ? "Tìm thấy $count khách hàng đã có thông tin Salesperson." : "Chưa có khách hàng nào có thông tin Salesperson. Hãy thử bấm Đồng bộ ngay."
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
