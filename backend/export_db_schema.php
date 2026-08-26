<?php
// backend/export_db_schema.php
// Script trích xuất và đồng bộ hóa toàn bộ Database Schema từ máy chủ thực tế

require_once __DIR__ . '/db_connect.php';

echo "Đang kết nối CSDL và đọc danh sách bảng...\n";

$tablesResult = $conn->query("SHOW FULL TABLES");
if (!$tablesResult) {
    die("Lỗi khi đọc bảng: " . $conn->error . "\n");
}

$tables = [];
$tableTypes = [];
while ($row = $tablesResult->fetch_array()) {
    $tableName = $row[0];
    $tableType = $row[1]; // BASE TABLE hoặc VIEW
    $tables[] = $tableName;
    $tableTypes[$tableName] = $tableType;
}

sort($tables);
$totalTables = count($tables);
echo "Tìm thấy {$totalTables} bảng/view trong CSDL.\n";

$ddlList = [];
$jsonSchema = [];
$mdContent = [];

$nowIso = date('c');

// Header for SQL
$sqlOutput = "-- Database Schema DDL Dump - IDEAS ERP (Staging)\n";
$sqlOutput .= "-- Generated automatically on: {$nowIso}\n";
$sqlOutput .= "-- Total Tables/Views: {$totalTables}\n\n";

// Header for MD
$mdHeader = "# Database Schema - IDEAS ERP (Staging)\n\n";
$mdHeader .= "*Generated automatically on: {$nowIso}*\n";
$mdHeader .= "*Total Tables: {$totalTables}*\n\n";
$mdHeader .= "## Table of Contents\n\n";

foreach ($tables as $tbl) {
    $mdHeader .= "- [{$tbl}](#" . strtolower($tbl) . ")\n";
}
$mdHeader .= "\n---\n\n";

$mdBody = "";

foreach ($tables as $tbl) {
    // 1. DDL
    $createRes = $conn->query("SHOW CREATE TABLE `{$tbl}`");
    if ($createRes) {
        $cRow = $createRes->fetch_array();
        $ddl = $cRow[1] ?? '';
        $ddlList[] = $ddl . ";\n";
    }

    // 2. Columns
    $colsRes = $conn->query("SHOW FULL COLUMNS FROM `{$tbl}`");
    $columns = [];
    $mdRows = [];

    if ($colsRes) {
        while ($col = $colsRes->fetch_assoc()) {
            $field = $col['Field'];
            $type = $col['Type'];
            $null = $col['Null'];
            $key = $col['Key'] ?: null;
            $default = $col['Default'];
            $extra = $col['Extra'] ?: null;
            $comment = $col['Comment'] ?: null;

            $columns[] = [
                'column' => $field,
                'type' => $type,
                'nullable' => ($null === 'YES'),
                'key' => $key,
                'default' => $default,
                'extra' => $extra,
                'comment' => $comment
            ];

            $defStr = ($default === null) ? ($null === 'YES' ? '`NULL`' : '*NULL*') : "`{$default}`";
            $comStr = $comment ? htmlspecialchars($comment, ENT_QUOTES) : '';
            $extraStr = $extra ? htmlspecialchars($extra, ENT_QUOTES) : '';
            $keyStr = $key ?: '';

            $mdRows[] = "| **{$field}** | `{$type}` | {$null} | {$keyStr} | {$defStr} | {$extraStr} | {$comStr} |";
        }
    }

    $jsonSchema[$tbl] = $columns;

    // Build MD Table
    $mdBody .= "### {$tbl}\n\n";
    $mdBody .= "| Column | Type | Nullable | Key | Default | Extra | Comment |\n";
    $mdBody .= "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
    $mdBody .= implode("\n", $mdRows) . "\n\n";
    $mdBody .= "[Back to top](#table-of-contents)\n\n---\n\n";
}

$sqlOutput .= implode("\n", $ddlList);
$mdFull = $mdHeader . $mdBody;
$jsonOutput = json_encode($jsonSchema, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Ghi trực tiếp vào thư mục hiện tại trên máy chủ
file_put_contents(__DIR__ . '/db_schema.json', $jsonOutput);
file_put_contents(__DIR__ . '/database_schema.json', $jsonOutput);
file_put_contents(__DIR__ . '/database_schema.sql', $sqlOutput);
file_put_contents(__DIR__ . '/database_schema.md', $mdFull);

// If root directory exists locally
$rootDir = dirname(__DIR__);
if (file_exists($rootDir . '/package.json')) {
    file_put_contents($rootDir . '/database_schema.sql', $sqlOutput);
    file_put_contents($rootDir . '/database_schema.json', $jsonOutput);
    file_put_contents($rootDir . '/database_schema.md', $mdFull);
    echo "Đã ghi thành công ra database_schema.sql, database_schema.json, database_schema.md ở thư mục gốc.\n";
}

echo "Hoàn tất trích xuất CSDL!\n";
