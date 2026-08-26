<?php
require_once __DIR__ . '/test_bootstrap.php';

try {
    echo "=== USERS BY TENANT ===\n";
    $users = $pdo->query("SELECT tenant_id, COUNT(*) as count FROM users GROUP BY tenant_id")->fetchAll();
    print_r($users);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
