<?php
// api/export_core_db.php
// Secure script to export a clean, pre-anonymized, lightweight SQL dump of the core database.
// Excludes massive tracking log data (structure-only) to prevent 'MySQL server has gone away' timeout errors.

error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300); // 5 minutes

require_once 'db_connect.php';

// 1. Strict Security Safeguard
$token = $_GET['token'] ?? '';
if ($token !== ADMIN_BYPASS_TOKEN && empty($GLOBALS['current_admin_id'])) {
    http_response_code(403);
    die(json_encode(['success' => false, 'error' => 'Unauthorized access.']));
}

// 2. Database Name configurations
$sourceDb = 'vhvxoigh_mail_auto';
$targetDb = 'vhvxoigh_auto_demo';

// Tables to export STRUCTURE ONLY (No INSERT statement data to keep it small and avoid timeout)
$structureOnlyTables = [
    'web_page_views',
    'web_events',
    'web_sessions',
    'web_heatmap_data',
    'web_form_submissions',
    'user_access_logs',
    'subscriber_activity',
    'activity_buffer',
    'mail_delivery_logs',
    'zalo_delivery_logs'
];

try {
    // Open target file stream
    $fileName = 'domation_demo_clean.txt';
    $filePath = __DIR__ . '/' . $fileName;
    $fOut = fopen($filePath, 'w');
    if (!$fOut) {
        throw new Exception("Could not open file for writing: " . $filePath);
    }

    // Fetch all tables in the database
    $tablesQuery = $pdo->query("SHOW TABLES");
    $tables = $tablesQuery->fetchAll(PDO::FETCH_COLUMN);

    fwrite($fOut, "-- DOMATION Clean Pre-Anonymized Database Dump\n");
    fwrite($fOut, "-- Target Database: {$targetDb}\n");
    fwrite($fOut, "-- Generated: " . date('Y-m-d H:i:s') . "\n\n");
    fwrite($fOut, "SET FOREIGN_KEY_CHECKS = 0;\n");
    fwrite($fOut, "SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n");
    fwrite($fOut, "START TRANSACTION;\n");
    fwrite($fOut, "SET time_zone = \"+00:00\";\n\n");

    foreach ($tables as $table) {
        // 1. Drop Table IF EXISTS
        fwrite($fOut, "DROP TABLE IF EXISTS `{$table}`;\n");

        // 2. Get Create Table statement
        $createTableQuery = $pdo->query("SHOW CREATE TABLE `{$table}`");
        $createTableRow = $createTableQuery->fetch(PDO::FETCH_NUM);
        $createSql = $createTableRow[1];

        fwrite($fOut, $createSql . ";\n\n");

        // If it's a structure-only table, skip exporting rows
        if (in_array($table, $structureOnlyTables)) {
            fwrite($fOut, "-- Table `{$table}` is log table: structure-only (truncated data for demo)\n\n");
            continue;
        }

        // 3. Export Data rows in chunks to prevent memory limit exhaustion
        $rowsQuery = $pdo->query("SELECT * FROM `{$table}`");
        $columns = [];
        $isFirstChunk = true;
        
        while ($row = $rowsQuery->fetch(PDO::FETCH_ASSOC)) {
            if (empty($columns)) {
                $columns = array_keys($row);
            }
            
            if ($isFirstChunk) {
                fwrite($fOut, "INSERT INTO `{$table}` (");
                fwrite($fOut, implode(", ", array_map(function($c) { return "`$c`"; }, $columns)));
                fwrite($fOut, ") VALUES\n");
                $isFirstChunk = false;
            } else {
                fwrite($fOut, ",\n");
            }
            
            $values = [];
            foreach ($columns as $col) {
                $val = $row[$col];

                if ($val === null) {
                    $values[] = "NULL";
                } else {
                    // Perform on-the-fly anonymization of sensitive columns
                    if ($table === 'subscribers') {
                        if ($col === 'email' && strpos($val, '@') !== false) {
                            $parts = explode('@', $val);
                            $val = substr($parts[0], 0, 2) . '***_' . substr(md5($row['id']), 0, 6) . '@' . $parts[1];
                        }
                        if ($col === 'phone_number' && strlen($val) >= 8) {
                            $val = substr($val, 0, 3) . '***' . substr($val, -3);
                        }
                        if (($col === 'zalo_user_id' || $col === 'meta_psid') && !empty($val)) {
                            $val = substr($val, 0, 4) . '***' . substr($val, -4);
                        }
                    }
                    elseif ($table === 'web_visitors') {
                        if ($col === 'email' && strpos($val, '@') !== false) {
                            $parts = explode('@', $val);
                            $val = substr($parts[0], 0, 2) . '***_' . substr(md5($row['visitor_id'] ?? $row['id'] ?? uniqid()), 0, 6) . '@' . $parts[1];
                        }
                        if ($col === 'phone' && strlen($val) >= 8) {
                            $val = substr($val, 0, 3) . '***' . substr($val, -3);
                        }
                    }
                    elseif ($table === 'users' || $table === 'ai_org_users') {
                        // Skip main admin
                        if ($row['role'] !== 'admin' && ($row['username'] ?? '') !== 'admin' && strpos($row['email'] ?? '', 'admin') !== 0) {
                            if ($col === 'email') {
                                $val = 'demo_user_' . $row['id'] . '@domation.net';
                            }
                            if ($col === 'phone') {
                                $val = '098***1234';
                            }
                        }
                    }

                    $values[] = $pdo->quote($val);
                }
            }
            fwrite($fOut, "(" . implode(", ", $values) . ")");
        }
        
        if (!$isFirstChunk) {
            fwrite($fOut, ";\n\n");
        }
    }

    // Include DELIMITER and routines
    fwrite($fOut, "-- Procedures\n");
    fwrite($fOut, "DROP PROCEDURE IF EXISTS `RenameFlowStatClickRate`;\n");
    fwrite($fOut, "DELIMITER $$\n");
    fwrite($fOut, "CREATE PROCEDURE `RenameFlowStatClickRate` () BEGIN\n");
    fwrite($fOut, "IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flows' AND COLUMN_NAME = 'stat_click_rate') THEN\n");
    fwrite($fOut, "ALTER TABLE `flows` CHANGE COLUMN `stat_click_rate` `stat_total_clicked` INT DEFAULT 0;\n");
    fwrite($fOut, "END IF;\n");
    fwrite($fOut, "END$$\n");
    fwrite($fOut, "DELIMITER ;\n\n");

    fwrite($fOut, "COMMIT;\n");
    fwrite($fOut, "SET FOREIGN_KEY_CHECKS = 1;\n");
    fclose($fOut);

    echo json_encode([
        'success' => true,
        'message' => 'Clean database dump generated successfully!',
        'file_name' => $fileName,
        'download_url' => API_BASE_URL . '/' . $fileName,
        'size_mb' => round(filesize($filePath) / 1024 / 1024, 2)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    if (isset($fOut) && is_resource($fOut)) {
        fclose($fOut);
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
