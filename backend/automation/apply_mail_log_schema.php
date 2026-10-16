<?php
require_once __DIR__ . '/db_connect.php';

try {
    $pdo->exec("ALTER TABLE mail_delivery_logs ADD COLUMN workspace_id int(11) DEFAULT 0;");
    echo "Column workspace_id added successfully.\n";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Column workspace_id already exists.\n";
    } else {
        echo "Error adding column: " . $e->getMessage() . "\n";
    }
}

try {
    $pdo->exec("ALTER TABLE mail_delivery_logs ADD INDEX idx_workspace_id (workspace_id);");
    echo "Index idx_workspace_id added successfully.\n";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate key name') !== false) {
        echo "Index idx_workspace_id already exists.\n";
    } else {
        echo "Error adding index: " . $e->getMessage() . "\n";
    }
}
