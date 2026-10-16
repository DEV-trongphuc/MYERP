<?php
// api/create_api_tokens_table.php
// CLI-only migration runner — blocked from HTTP access via .htaccess
// Run: php api/create_api_tokens_table.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('This script can only be run from the command line.');
}

require_once __DIR__ . '/db_connect.php';

$sql = file_get_contents(__DIR__ . '/migrations/create_api_tokens_table.sql');

// Split on semicolons to run each statement separately
$statements = array_filter(
    array_map('trim', explode(';', $sql)),
    fn($s) => !empty($s) && strpos($s, '--') !== 0
);

$success = 0;
$errors = 0;
foreach ($statements as $stmt) {
    // Skip pure comment lines
    if (preg_match('/^\s*--/', $stmt)) continue;
    try {
        $pdo->exec($stmt);
        echo "[OK] " . substr($stmt, 0, 60) . "...\n";
        $success++;
    } catch (PDOException $e) {
        echo "[SKIP/ERROR] " . $e->getMessage() . "\n";
        $errors++;
    }
}

echo "\nDone. {$success} statements executed, {$errors} errors.\n";
echo "api_tokens table is ready. To add a real token:\n";
echo "  \$raw = bin2hex(random_bytes(32));\n";
echo "  \$hash = hash('sha256', \$raw);\n";
echo "  INSERT INTO api_tokens (name, token, scope, is_active) VALUES ('My Token', '\$hash', 'upload', 1);\n";
echo "  Give the client the raw token value: \$raw\n";
