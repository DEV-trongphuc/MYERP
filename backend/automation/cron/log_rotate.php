<?php
// api/cron/log_rotate.php
// Log Rotation Script — keeps worker logs lean and prevents disk bloat.
// Rotates any log file > 5MB, compresses it with gzip, keeps last 7 days.
//
// Schedule via cPanel cron (daily at 02:00):
//   0 2 * * * php /home/vhvxoigh/public_html/mail_api/cron/log_rotate.php >> /dev/null 2>&1
//
// Or run manually: php api/cron/log_rotate.php

define('LOG_MAX_SIZE_BYTES', 5 * 1024 * 1024); // 5MB — rotate if larger
define('LOG_RETAIN_DAYS', 7);                   // Keep 7 days of archives
define('LOG_DIR', __DIR__ . '/..');             // api/ directory

$logFiles = [
    'worker_flow.log',
    'worker_campaign.log',
    'worker_flow_debug.log',
    'worker_priority.log',
    'worker_priority_debug.log',
    'worker_sync.log',        // [P23-L2] Added: 2.9MB
    'worker_debug.log',       // [P23-L2] Added: ~128KB
    'worker_reminder.log',    // [P23-L2] Added: 215KB
    'worker_trace.log',       // [P23-L2] Added: 80KB
    'meta_webhook_prod.log',
    'meta_debug.log',         // [P23-L2] Added: 19KB (grows with volume)
    'error_log',              // [P23-L2] CRITICAL: 24.4MB unbounded PHP error log
    'training_debug.log',     // [P23-L2] Added: 480KB
    'webhook_debug.log',      // [P23-L2] Added: 68KB
    'ai_debug.log',           // [P23-L2] Added: 6.5KB
    'misa_sync_debug.log',    // [P23-L2] Added: 76KB
    'zns_error.log',
    'log_error.log',
    'wait_debug.log',
];

$report = [];

foreach ($logFiles as $logFile) {
    $fullPath = LOG_DIR . '/' . $logFile;

    if (!file_exists($fullPath)) {
        continue;
    }

    $size = filesize($fullPath);

    if ($size < LOG_MAX_SIZE_BYTES) {
        $report[] = "SKIP  {$logFile} (" . round($size / 1024, 1) . "KB — under limit)";
        continue;
    }

    // Archive filename: e.g. worker_flow.log.2026-04-16.gz
    $archiveName = $fullPath . '.' . date('Y-m-d') . '.gz';

    // Compress current log → archive
    $content = file_get_contents($fullPath);
    if ($content === false) {
        $report[] = "ERROR {$logFile} — could not read";
        continue;
    }

    $gz = gzopen($archiveName, 'wb9');
    if (!$gz) {
        $report[] = "ERROR {$logFile} — could not create gzip archive";
        continue;
    }
    gzwrite($gz, $content);
    gzclose($gz);

    // Truncate original log (don't delete — workers may have it open)
    file_put_contents($fullPath, '');

    $savedKB = round($size / 1024, 1);
    $report[] = "ROTATED {$logFile} ({$savedKB}KB → {$archiveName})";
}

// ─── Cleanup old archives (>7 days) ──────────────────────────────────────────
$cutoffTime = time() - (LOG_RETAIN_DAYS * 86400);
$globPattern = LOG_DIR . '/*.log.*.gz';
$archives = glob($globPattern);

if ($archives) {
    foreach ($archives as $archive) {
        if (filemtime($archive) < $cutoffTime) {
            unlink($archive);
            $report[] = "DELETED old archive: " . basename($archive);
        }
    }
}

// ─── Output ───────────────────────────────────────────────────────────────────
$timestamp = date('Y-m-d H:i:s');
$output = "[$timestamp] Log Rotation Report\n" . implode("\n", $report) . "\n";

echo $output;
// Also append to a rotation audit log
file_put_contents(LOG_DIR . '/log_rotate_audit.log', $output, FILE_APPEND | LOCK_EX);
