<?php
/**
 * Migration: Add Token Status Fields to Zalo OA Configs
 * Adds token_status and last_token_check fields for better token management
 */

require_once __DIR__ . '/../db_connect.php';

header('Content-Type: application/json');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $results = [
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'changes' => []
    ];

    // Check if columns already exist
    $checkStmt = $pdo->query("SHOW COLUMNS FROM zalo_oa_configs LIKE 'token_status'");
    $tokenStatusExists = $checkStmt->rowCount() > 0;

    $checkStmt = $pdo->query("SHOW COLUMNS FROM zalo_oa_configs LIKE 'last_token_check'");
    $lastCheckExists = $checkStmt->rowCount() > 0;

    // Add token_status column
    if (!$tokenStatusExists) {
        $pdo->exec("
            ALTER TABLE zalo_oa_configs 
            ADD COLUMN token_status VARCHAR(20) DEFAULT 'unknown' 
            COMMENT 'Token health status: healthy, expiring, expired, unknown'
            AFTER token_expires_at
        ");
        $results['changes'][] = 'Added token_status column';
    } else {
        $results['changes'][] = 'token_status column already exists';
    }

    // Add last_token_check column
    if (!$lastCheckExists) {
        $pdo->exec("
            ALTER TABLE zalo_oa_configs 
            ADD COLUMN last_token_check DATETIME NULL 
            COMMENT 'Last time token was checked/refreshed'
            AFTER token_status
        ");
        $results['changes'][] = 'Added last_token_check column';
    } else {
        $results['changes'][] = 'last_token_check column already exists';
    }

    // Initialize token_status for existing records
    $updateStmt = $pdo->prepare("
        UPDATE zalo_oa_configs 
        SET token_status = CASE
            WHEN token_expires_at IS NULL THEN 'unknown'
            WHEN token_expires_at < NOW() THEN 'expired'
            WHEN token_expires_at < DATE_ADD(NOW(), INTERVAL 24 HOUR) THEN 'expiring'
            ELSE 'healthy'
        END,
        last_token_check = NOW()
        WHERE token_status = 'unknown' OR token_status IS NULL
    ");

    $affectedRows = $updateStmt->execute();
    $results['changes'][] = "Initialized token_status for existing records (affected: {$updateStmt->rowCount()} rows)";

    // Add index for faster queries
    try {
        $pdo->exec("
            CREATE INDEX idx_token_status ON zalo_oa_configs(token_status, token_expires_at)
        ");
        $results['changes'][] = 'Added index on token_status and token_expires_at';
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') !== false) {
            $results['changes'][] = 'Index already exists';
        } else {
            throw $e;
        }
    }

    echo json_encode($results, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
