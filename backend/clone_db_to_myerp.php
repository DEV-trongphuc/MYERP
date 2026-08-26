<?php
// backend/clone_db_to_myerp.php
// Script to clone schema and initial state from vhvxoigh_ideas_erp to vhvxoigh_myerp

$isCli = (php_sapi_name() === 'cli');
$hasValidToken = (($_GET['token'] ?? '') === 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7') || defined('DIAG_TOKEN');
if (!$isCli && !$hasValidToken) {
    http_response_code(403);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

require_once __DIR__ . '/env.php';

$host = $_ENV['DB_HOST'] ?? 'localhost';
$user = $_ENV['DB_USER'] ?? 'vhvxoigh_mail_auto';
$pass = $_ENV['DB_PASS'] ?? 'Ideas@812';
$sourceDb = 'vhvxoigh_ideas_erp';
$targetDb = $_ENV['DB_NAME'] ?? 'vhvxoigh_myerp';

echo "=== CLONING DATABASE: $sourceDb -> $targetDb ===\n";

try {
    // 1. Connect to MySQL server
    $pdoSource = new PDO("mysql:host={$host};dbname={$sourceDb};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    $pdoTarget = new PDO("mysql:host={$host};dbname={$targetDb};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    echo "✓ Connected to both source ($sourceDb) and target ($targetDb) databases successfully.\n";

    // 2. Get all tables from source
    $stmtTables = $pdoSource->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    $tables = [];
    while ($row = $stmtTables->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }
    echo "Found " . count($tables) . " tables in source database.\n";

    $pdoTarget->exec("SET FOREIGN_KEY_CHECKS = 0");

    foreach ($tables as $tbl) {
        // Get Create Table syntax
        $stmtCreate = $pdoSource->query("SHOW CREATE TABLE `{$tbl}`");
        $createRow = $stmtCreate->fetch(PDO::FETCH_ASSOC);
        $createSql = $createRow['Create Table'] ?? '';

        if ($createSql) {
            $pdoTarget->exec("DROP TABLE IF EXISTS `{$tbl}`");
            $pdoTarget->exec($createSql);
            echo "  - Recreated table: `{$tbl}`\n";

            // Copy data
            $pdoTarget->exec("INSERT INTO `{$targetDb}`.`{$tbl}` SELECT * FROM `{$sourceDb}`.`{$tbl}`");
            echo "    -> Data cloned for `{$tbl}`\n";
        }
    }

    // 3. Clone Views if any
    $stmtViews = $pdoSource->query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
    while ($row = $stmtViews->fetch(PDO::FETCH_NUM)) {
        $viewName = $row[0];
        $stmtCreateView = $pdoSource->query("SHOW CREATE VIEW `{$viewName}`");
        $createViewRow = $stmtCreateView->fetch(PDO::FETCH_ASSOC);
        $createViewSql = $createViewRow['Create View'] ?? '';
        if ($createViewSql) {
            $pdoTarget->exec("DROP VIEW IF EXISTS `{$viewName}`");
            // Adjust create view SQL to remove definer constraints if needed
            $createViewSql = preg_replace('/CREATE ALGORITHM=[^ ]+ DEFINER=[^ ]+ SQL SECURITY [^ ]+ VIEW/', 'CREATE OR REPLACE VIEW', $createViewSql);
            try {
                $pdoTarget->exec($createViewSql);
                echo "  - Recreated view: `{$viewName}`\n";
            } catch (Throwable $ve) {
                echo "  ! Warning creating view `{$viewName}`: " . $ve->getMessage() . "\n";
            }
        }
    }

    $pdoTarget->exec("SET FOREIGN_KEY_CHECKS = 1");

    // 4. Update system_settings in target database to reflect MYERP domain
    $updateSetting = $pdoTarget->prepare("
        INSERT INTO system_settings (setting_key, setting_value) 
        VALUES ('frontend_url', 'https://myerp.ideas.edu.vn') 
        ON DUPLICATE KEY UPDATE setting_value = 'https://myerp.ideas.edu.vn'
    ");
    $updateSetting->execute();

    echo "\n✓ SUCCESS: Database $sourceDb cloned into $targetDb with frontend_url updated to https://myerp.ideas.edu.vn!\n";

} catch (Throwable $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
}
