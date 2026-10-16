<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
try {
    // Get 5 subscribers with any data in salesperson
    $stmt = $pdo->query("SELECT id, email, salesperson, custom_attributes FROM subscribers WHERE salesperson IS NOT NULL AND salesperson != '' LIMIT 5");
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Also check some without it to see custom_attributes
    $stmt2 = $pdo->query("SELECT id, email, salesperson, custom_attributes FROM subscribers LIMIT 10");
    $data2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'with_salesperson' => $data,
        'sample_10' => $data2
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
