<?php
require_once __DIR__ . '/../../backend/automation/db_connect.php';

echo "=== DATABASE SCHEMA CHECKS ===\n";

$tables = ['tracking_unique_cache', 'subscribers', 'campaigns', 'short_links', 'web_properties'];

foreach ($tables as $t) {
    echo "\n--- TABLE: $t ---\n";
    try {
        $stmt = $pdo->query("DESCRIBE `$t`");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo sprintf("  %-25s %-20s %-6s %-6s %-10s\n", $row['Field'], $row['Type'], $row['Null'], $row['Key'], $row['Default'] ?? 'NULL');
        }
    } catch (\Throwable $e) {
        echo "Error describing $t: " . $e->getMessage() . "\n";
    }
}
