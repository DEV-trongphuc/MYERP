<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE voucher_campaigns 
        ADD COLUMN is_claimable TINYINT(1) DEFAULT 0,
        ADD COLUMN claim_approval_required TINYINT(1) DEFAULT 0,
        ADD COLUMN claim_email_template_id VARCHAR(100) DEFAULT NULL
    ");
    echo "Columns added!";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Columns already exist.";
    } else {
        echo "Error: " . $e->getMessage();
    }
}
