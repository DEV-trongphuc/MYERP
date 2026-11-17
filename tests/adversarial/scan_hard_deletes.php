<?php
$files = [
    'backend/automation/campaigns.php',
    'backend/automation/links_qr.php',
    'backend/automation/web_tracking.php',
    'backend/automation/go.php',
    'backend/automation/track.php'
];

echo "=== SCANNING FOR HARD DELETE STATEMENTS ===\n";

foreach ($files as $f) {
    $full = __DIR__ . '/../../' . $f;
    if (!file_exists($full)) {
        echo "[MISSING] $f\n";
        continue;
    }
    $lines = file($full);
    $found = [];
    foreach ($lines as $i => $line) {
        $num = $i + 1;
        if (preg_match('/\bDELETE\s+FROM\b/i', $line)) {
            $found[] = [$num, trim($line)];
        }
    }
    echo "\n$f: " . count($found) . " DELETE FROM statement(s) found\n";
    foreach ($found as $match) {
        echo "  Line {$match[0]}: {$match[1]}\n";
    }
}
