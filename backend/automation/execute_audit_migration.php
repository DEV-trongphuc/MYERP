<?php
/**
 * api/execute_audit_migration.php
 * Wrapper to run the audit migration safely.
 */
require_once __DIR__ . '/db_connect.php';

$sqlFile = __DIR__ . '/migration_audit_optimizations.sql';
if (!file_exists($sqlFile)) {
    die("Error: migration_audit_optimizations.sql not found.\n");
}

echo "Starting migration: migration_audit_optimizations.sql\n";

$sql = file_get_contents($sqlFile);
// Simple split by semicolon (not perfect for all SQL, but okay for this file)
$statements = explode(';', $sql);

foreach ($statements as $stmt) {
    $stmt = trim($stmt);
    if (empty($stmt)) continue;

    try {
        $pdo->exec($stmt);
        echo "[OK] " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 80) . "...\n";
    } catch (PDOException $e) {
        // Ignore "already exists" errors
        if (strpos($e->getMessage(), '1060') !== false || strpos($e->getMessage(), '1061') !== false || strpos($e->getMessage(), '1050') !== false) {
            echo "[SKIP] Already applied: " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 80) . "...\n";
        } else {
            echo "[ERROR] " . $e->getMessage() . " in: " . substr($stmt, 0, 100) . "...\n";
        }
    }
}

echo "Migration finished.\n";
