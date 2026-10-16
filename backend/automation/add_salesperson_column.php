<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
try {
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM subscribers LIKE 'salesperson'");
    $exists = $stmt->fetch();
    
    if (!$exists) {
        $pdo->exec("ALTER TABLE subscribers ADD COLUMN salesperson VARCHAR(255) NULL AFTER address");
        echo json_encode(['success' => true, 'message' => 'Column salesperson added successfully.']);
    } else {
        echo json_encode(['success' => true, 'message' => 'Column salesperson already exists.']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
