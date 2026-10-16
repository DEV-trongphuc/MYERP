<?php
/**
 * api/run_migration.php
 * ============================================================
 * Safe migration runner for sql_fix.sql
 *
 * Usage:
 *   CLI:  php api/run_migration.php
 *   Web:  /api/run_migration.php?secret=YOUR_MIGRATION_SECRET
 *
 * Features:
 *   - Idempotent: all statements use IF NOT EXISTS / IF EXISTS
 *   - Per-statement error reporting (skips failed, continues)
 *   - Skips comments and blank lines
 *   - Detects MySQL version (warns if < 8.0 for IF NOT EXISTS on INDEX)
 *   - Logs output to migration_YYYYMMDD_HHMMSS.log
 * ============================================================
 */

// ── Security Guard ────────────────────────────────────────────────────────
// Default secret — change this if deploying long-term
// Can also override via env: export MIGRATION_SECRET=your_secret
define('MIGRATION_SECRET', getenv('MIGRATION_SECRET') ?: 'autoflow_migrate_2026');

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $secret = $_GET['secret'] ?? $_POST['secret'] ?? '';
    if ($secret !== MIGRATION_SECRET) {
        http_response_code(403);
        echo "403 Forbidden: Pass ?secret=autoflow_migrate_2026 or run via CLI.\n";
        exit(1);
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────
set_time_limit(300);
ini_set('memory_limit', '256M');

require_once __DIR__ . '/db_connect.php';

if (!isset($pdo)) {
    die("ERROR: Database connection failed (PDO not available).\n");
}

// Allow running a specific SQL file via ?file=filename.sql (web) or --file=filename.sql (CLI)
$requestedFile = 'sql_fix.sql'; // default
if ($isCli) {
    foreach ($argv ?? [] as $arg) {
        if (str_starts_with($arg, '--file=')) {
            $requestedFile = substr($arg, 7);
        }
    }
} else {
    $requestedFile = basename($_GET['file'] ?? 'sql_fix.sql'); // basename prevents path traversal
}

// Security: only allow .sql files inside api/ directory
if (!preg_match('/^[\w\-]+\.sql$/', $requestedFile)) {
    die("ERROR: Invalid file name '$requestedFile'. Only .sql files allowed.\n");
}

$sqlFile = __DIR__ . '/' . $requestedFile;
if (!file_exists($sqlFile)) {
    die("ERROR: $requestedFile not found at $sqlFile\n");
}

// ── Log file ──────────────────────────────────────────────────────────────
$logDir  = __DIR__ . '/logs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
$logFile = $logDir . '/migration_' . date('Ymd_His') . '.log';
$logFp   = fopen($logFile, 'w');

function mlog(string $msg, $fp = null): void
{
    global $logFp, $isCli;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    if ($fp) fwrite($fp, $line);
    echo $line;
    flush();
}

mlog("=== AutoFlow Migration Runner ===", $logFp);
mlog("File   : $sqlFile", $logFp);
mlog("Log    : $logFile", $logFp);
mlog("", $logFp);

// ── MySQL Version Check ───────────────────────────────────────────────────
try {
    $version   = $pdo->query("SELECT VERSION()")->fetchColumn();
    $majorMinor = (float) $version;
    mlog("MySQL  : $version", $logFp);
    if ($majorMinor < 8.0) {
        mlog("WARNING: MySQL < 8.0 detected. 'ADD INDEX IF NOT EXISTS' requires MySQL 8.0+.", $logFp);
        mlog("         Statements using that syntax may produce errors (safely caught below).", $logFp);
    }
} catch (Exception $e) {
    mlog("WARNING: Could not determine MySQL version: " . $e->getMessage(), $logFp);
}

// ── Check Event Scheduler ─────────────────────────────────────────────────
try {
    $evSched = $pdo->query("SHOW VARIABLES LIKE 'event_scheduler'")->fetch(PDO::FETCH_ASSOC);
    $evStatus = $evSched['Value'] ?? 'UNKNOWN';
    mlog("Event Scheduler: $evStatus" . ($evStatus !== 'ON' ? " (WARNING: Enable with SET GLOBAL event_scheduler = ON)" : ""), $logFp);
} catch (Exception $e) {
    mlog("Event Scheduler: could not check", $logFp);
}

mlog("", $logFp);

// ── Parse SQL file into statements ────────────────────────────────────────
$raw        = file_get_contents($sqlFile);
// Strip UTF-8 BOM if present (PowerShell Set-Content adds \xEF\xBB\xBF)
$raw        = ltrim($raw, "\xEF\xBB\xBF");
$lines      = explode("\n", $raw);
$statements = [];
$buffer     = '';

foreach ($lines as $line) {
    $trimmed = trim($line);

    // Skip full-line comments and blank lines
    if ($trimmed === '' || str_starts_with($trimmed, '--')) {
        continue;
    }

    $buffer .= ' ' . $trimmed;

    // Statement ends at semicolon
    if (str_ends_with($trimmed, ';')) {
        $stmt = trim($buffer);
        if ($stmt !== ';' && $stmt !== '') {
            $statements[] = $stmt;
        }
        $buffer = '';
    }
}

mlog("Parsed : " . count($statements) . " SQL statements", $logFp);
mlog("", $logFp);

// ── Execute each statement ────────────────────────────────────────────────
$ok      = 0;
$skipped = 0;
$errors  = 0;

// These MySQL error codes are safe to ignore (already exists, etc.)
$ignoreCodes = [
    1050, // Table already exists
    1060, // Duplicate column
    1061, // Duplicate key name
    1091, // Can't DROP; check that column/key exists
    1068, // Multiple primary key defined
    1062, // Duplicate entry (for INSERT IGNORE equivalent)
];

foreach ($statements as $i => $stmt) {
    $stmtNum = $i + 1;
    $preview = substr(preg_replace('/\s+/', ' ', $stmt), 0, 80);

    try {
        $pdo->exec($stmt);
        $ok++;
        mlog("  [OK  ] #$stmtNum: $preview", $logFp);
    } catch (PDOException $e) {
        $errCode = (int) $e->getCode();
        $errMsg  = $e->getMessage();

        // Gracefully skip known safe-to-ignore errors
        $sqlErrCode = 0;
        if (preg_match('/SQLSTATE\[[\dA-Z]+\].*?(\d{4})/', $errMsg, $m)) {
            $sqlErrCode = (int) $m[1];
        }

        if (in_array($sqlErrCode, $ignoreCodes, true)) {
            $skipped++;
            mlog("  [SKIP] #$stmtNum (already applied): $preview", $logFp);
        } else {
            $errors++;
            mlog("  [FAIL] #$stmtNum: $preview", $logFp);
            mlog("         Error $sqlErrCode: $errMsg", $logFp);
        }
    }
}

// ── Summary ───────────────────────────────────────────────────────────────
mlog("", $logFp);
mlog("=== Migration Complete ===", $logFp);
mlog("  OK      : $ok", $logFp);
mlog("  Skipped : $skipped (already applied — safe)", $logFp);
mlog("  Errors  : $errors", $logFp);
mlog("  Log     : $logFile", $logFp);

if ($errors === 0) {
    mlog("  STATUS  : SUCCESS ✓", $logFp);
} else {
    mlog("  STATUS  : COMPLETED WITH $errors ERROR(S) — review log above", $logFp);
}

fclose($logFp);
exit($errors > 0 ? 1 : 0);
