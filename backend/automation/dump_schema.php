<?php
// api/dump_schema.php
// Secure script to export live database schema to db_schema.json

require_once __DIR__ . '/db_connect.php';

header("Content-Type: application/json; charset=utf-8");

$adminToken = $_GET['admin_token'] ?? '';
if ($adminToken !== ADMIN_BYPASS_TOKEN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized access.']);
    exit;
}

try {
    // Fetch all tables
    $tablesQuery = $pdo->query("SHOW TABLES");
    $tables = $tablesQuery->fetchAll(PDO::FETCH_COLUMN);
    
    $schema = [];
    foreach ($tables as $tableName) {
        $colsQuery = $pdo->query("SHOW COLUMNS FROM `$tableName`");
        $columns = $colsQuery->fetchAll(PDO::FETCH_ASSOC);
        
        $schema[$tableName] = [];
        foreach ($columns as $cRow) {
            $schema[$tableName][] = [
                'field'   => $cRow['Field'],
                'type'    => $cRow['Type'],
                'null'    => $cRow['Null'],
                'key'     => $cRow['Key'],
                'default' => $cRow['Default'],
                'extra'   => $cRow['Extra']
            ];
        }
    }
    
    $outputData = [
        'success' => true,
        'schema'  => $schema
    ];
    
    // Save to file
    $outputFile = __DIR__ . '/db_schema.json';
    file_put_contents($outputFile, json_encode($outputData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    echo json_encode([
        'success' => true,
        'message' => 'Schema successfully exported.',
        'tables_count' => count($schema),
        'file_path' => 'api/db_schema.json'
    ], JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
