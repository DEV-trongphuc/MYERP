<?php
require_once __DIR__ . '/db_connect.php';
try {
    $stmt = $pdo->query("SELECT PARTITION_NAME, PARTITION_DESCRIPTION FROM information_schema.PARTITIONS WHERE TABLE_NAME = 'raw_event_buffer' AND TABLE_SCHEMA = '$db'");
    echo "Partitions for raw_event_buffer:\n";
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "- " . $row['PARTITION_NAME'] . " (" . $row['PARTITION_DESCRIPTION'] . ")\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
