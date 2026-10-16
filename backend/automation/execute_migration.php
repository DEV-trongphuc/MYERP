<?php
/**
 * Production Safe Database Migration 
 * Run via: https://automation.ideas.edu.vn/mail_api/execute_migration.php?admin_token=autoflow-admin-001
 */
require_once __DIR__ . '/db_connect.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die('Unauthorized: This script can only be run from the command line (CLI).');
}

header('Content-Type: text/plain; charset=utf-8');
echo "Starting Database Migration...\n";

// Task 1: Fix stats_update_buffer ENUM
try {
    $pdo->exec("ALTER TABLE stats_update_buffer MODIFY COLUMN target_table VARCHAR(50) NOT NULL");
    echo "[OK] Task 1: stats_update_buffer altered to VARCHAR(50)\n";
} catch (Exception $e) {
    echo "[Skip/Error] Task 1: " . $e->getMessage() . "\n";
}

// Task 3: Add revenue column to purchase_events
try {
    $pdo->exec("ALTER TABLE purchase_events ADD COLUMN revenue DECIMAL(15,2) NOT NULL DEFAULT 0");
    echo "[OK] Task 3a: Added revenue column to purchase_events\n";
} catch (Exception $e) {
    // Column might already exist
    echo "[Skip/Error] Task 3a: " . $e->getMessage() . "\n";
}

// Task 3b: Backfill revenue
try {
    $events = $pdo->query("SELECT id FROM purchase_events")->fetchAll(PDO::FETCH_COLUMN);
    $updatedCount = 0;
    foreach ($events as $id) {
        $stmt = $pdo->prepare("SELECT SUM(CAST(REGEXP_REPLACE(SUBSTRING_INDEX(details, 'Order value: ', -1), '[^0-9]', '') AS UNSIGNED)) FROM subscriber_activity WHERE type = 'purchase' AND reference_id = ?");
        $stmt->execute([$id]);
        $total = (float)$stmt->fetchColumn();
        if ($total > 0) {
            $pdo->prepare("UPDATE purchase_events SET revenue = ? WHERE id = ?")->execute([$total, $id]);
            $updatedCount++;
        }
    }
    echo "[OK] Task 3b: Backfilled revenue for $updatedCount events\n";
} catch (Exception $e) {
    echo "[Skip/Error] Task 3b: " . $e->getMessage() . "\n";
}

echo "\nMigration complete. You can delete this file now.\n";
