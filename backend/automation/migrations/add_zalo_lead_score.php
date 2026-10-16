<?php
/**
 * Migration: Add Lead Score to Zalo Subscribers
 */
require_once 'db_connect.php';

try {
    // 1. Add lead_score to zalo_subscribers
    $pdo->exec("ALTER TABLE zalo_subscribers ADD COLUMN lead_score INT DEFAULT 0 AFTER status");
    echo "Added lead_score column to zalo_subscribers.<br>";
} catch (PDOException $e) {
    echo "Column lead_score might already exist or error: " . $e->getMessage() . "<br>";
}

try {
    // 2. Add index for faster syncing
    $pdo->exec("CREATE INDEX idx_lead_score ON zalo_subscribers(lead_score)");
    echo "Added index to lead_score.<br>";
} catch (PDOException $e) {
    // Ignore duplicate index
}

echo "Migration completed.";
