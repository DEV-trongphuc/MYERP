<?php
require_once __DIR__ . '/db_connect.php';
$table = $_GET['table'] ?? 'activity_buffer';
try {
    $stmt = $pdo->query("DESCRIBE `$table`");
    echo "Columns in $table:\n";
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
