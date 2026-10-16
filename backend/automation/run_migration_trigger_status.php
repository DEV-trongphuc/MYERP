<?php
// api/run_migration_trigger_status.php
// Safe idempotent migration: Add status + workspace_id to trigger source tables
// Run once via: https://automation.ideas.edu.vn/mail_api/run_migration_trigger_status.php?secret=autoflow_cron_2026
// Or via CLI: php api/run_migration_trigger_status.php

$secret = $_GET['secret'] ?? (php_sapi_name() === 'cli' ? 'autoflow_cron_2026' : '');
if ($secret !== 'autoflow_cron_2026') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// Direct DB connect (avoid session/auth overhead)
$host    = 'localhost';
$db      = 'vhvxoigh_mail_auto';
$user    = 'vhvxoigh_mail_auto';
$pass    = 'Ideas@812';
$charset = 'utf8mb4';

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=$charset",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit;
}

$results = [];

// Helper: check if column exists
function columnExists(PDO $pdo, string $table, string $column, string $db): bool {
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?"
    );
    $stmt->execute([$db, $table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

// Helper: check if index exists
function indexExists(PDO $pdo, string $table, string $index): bool {
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?"
    );
    $stmt->execute([$table, $index]);
    return (int)$stmt->fetchColumn() > 0;
}

// ── 1. custom_events ──────────────────────────────────────────────────────────
$tbl = 'custom_events';

if (!columnExists($pdo, $tbl, 'workspace_id', $db)) {
    $pdo->exec("ALTER TABLE `$tbl` ADD COLUMN `workspace_id` INT(11) NOT NULL DEFAULT 1 AFTER `id`");
    $results[] = "✅ $tbl.workspace_id — ADDED";
} else {
    $results[] = "⏭  $tbl.workspace_id — already exists, skipped";
}

if (!columnExists($pdo, $tbl, 'status', $db)) {
    $pdo->exec("ALTER TABLE `$tbl` ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `name`");
    $results[] = "✅ $tbl.status — ADDED";
} else {
    $results[] = "⏭  $tbl.status — already exists, skipped";
}

if (!indexExists($pdo, $tbl, 'idx_ce_workspace')) {
    $pdo->exec("ALTER TABLE `$tbl` ADD INDEX `idx_ce_workspace` (`workspace_id`)");
    $results[] = "✅ idx_ce_workspace — ADDED";
} else {
    $results[] = "⏭  idx_ce_workspace — already exists, skipped";
}

if (!indexExists($pdo, $tbl, 'idx_ce_status')) {
    $pdo->exec("ALTER TABLE `$tbl` ADD INDEX `idx_ce_status` (`status`)");
    $results[] = "✅ idx_ce_status — ADDED";
} else {
    $results[] = "⏭  idx_ce_status — already exists, skipped";
}

// ── 2. purchase_events ───────────────────────────────────────────────────────
$tbl = 'purchase_events';

if (!columnExists($pdo, $tbl, 'status', $db)) {
    $pdo->exec("ALTER TABLE `$tbl` ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `name`");
    $results[] = "✅ $tbl.status — ADDED";
} else {
    $results[] = "⏭  $tbl.status — already exists, skipped";
}

if (!indexExists($pdo, $tbl, 'idx_pe_status')) {
    $pdo->exec("ALTER TABLE `$tbl` ADD INDEX `idx_pe_status` (`status`)");
    $results[] = "✅ idx_pe_status — ADDED";
} else {
    $results[] = "⏭  idx_pe_status — already exists, skipped";
}

// ── 3. forms ─────────────────────────────────────────────────────────────────
$tbl = 'forms';

if (!columnExists($pdo, $tbl, 'status', $db)) {
    $pdo->exec("ALTER TABLE `$tbl` ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `name`");
    $results[] = "✅ $tbl.status — ADDED";
} else {
    $results[] = "⏭  $tbl.status — already exists, skipped";
}

if (!indexExists($pdo, $tbl, 'idx_forms_status')) {
    $pdo->exec("ALTER TABLE `$tbl` ADD INDEX `idx_forms_status` (`status`)");
    $results[] = "✅ idx_forms_status — ADDED";
} else {
    $results[] = "⏭  idx_forms_status — already exists, skipped";
}

// ── 4. tags ──────────────────────────────────────────────────────────────────
$tbl = 'tags';

if (!columnExists($pdo, $tbl, 'status', $db)) {
    $pdo->exec("ALTER TABLE `$tbl` ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `name`");
    $results[] = "✅ $tbl.status — ADDED";
} else {
    $results[] = "⏭  $tbl.status — already exists, skipped";
}

if (!indexExists($pdo, $tbl, 'idx_tags_status')) {
    $pdo->exec("ALTER TABLE `$tbl` ADD INDEX `idx_tags_status` (`status`)");
    $results[] = "✅ idx_tags_status — ADDED";
} else {
    $results[] = "⏭  idx_tags_status — already exists, skipped";
}

// ── VERIFY ───────────────────────────────────────────────────────────────────
$verify = $pdo->query("
    SELECT 'custom_events' AS tbl, COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '$db' AND TABLE_NAME = 'custom_events' AND COLUMN_NAME IN ('workspace_id','status')
    UNION ALL
    SELECT 'purchase_events', COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '$db' AND TABLE_NAME = 'purchase_events' AND COLUMN_NAME = 'status'
    UNION ALL
    SELECT 'forms', COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '$db' AND TABLE_NAME = 'forms' AND COLUMN_NAME = 'status'
    UNION ALL
    SELECT 'tags', COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '$db' AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'status'
")->fetchAll();

header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
    'success' => true,
    'migration' => 'trigger_status_fields',
    'applied_at' => date('Y-m-d H:i:s'),
    'steps' => $results,
    'verify' => $verify,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
