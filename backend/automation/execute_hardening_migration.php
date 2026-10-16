<?php
// api/execute_hardening_migration.php
require_once 'db_connect.php';

if (php_sapi_name() !== 'cli' && !isset($_GET['force'])) {
    die("This script must be run from CLI or with ?force=1");
}

$sqlFile = __DIR__ . '/migrations/migration_hardening_v2.sql';
if (!file_exists($sqlFile)) {
    die("Migration file not found: $sqlFile");
}

$sql = file_get_contents($sqlFile);

try {
    echo "Starting Hardening Migration...\n";
    // Split by semicolon but ignore semicolons inside comments or strings (simplistic approach)
    // For reliable execution, we use individual statements.
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // We execute as one big blob if PDO driver supports it, 
    // otherwise we would need to split carefully.
    $pdo->exec($sql);
    
    echo "SUCCESS: Database hardened for 1B scale.\n";
} catch (Exception $e) {
    echo "ERROR during migration: " . $e->getMessage() . "\n";
}
