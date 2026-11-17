<?php
$files = [
    'backend/automation/campaigns.php',
    'backend/automation/links_qr.php',
    'backend/automation/web_tracking.php',
    'backend/automation/go.php',
    'backend/automation/track.php'
];

echo "=== CHECKING QUERY FILTERING FOR SOFT-DELETED ENTITIES ===\n";

foreach ($files as $f) {
    $full = __DIR__ . '/../../' . $f;
    $content = file_get_contents($full);
    
    echo "\n>>> File: $f <<<\n";
    
    // Look for SELECT queries involving campaigns, short_links, or web_properties
    $lines = file($full);
    foreach ($lines as $i => $line) {
        $num = $i + 1;
        if (preg_match('/SELECT\s+.*?\s+FROM\s+[`]?((?:campaigns|short_links|web_properties))[`]?/i', $line, $m)) {
            // Check lines around this query for deleted_at or is_deleted
            $snippet = '';
            for ($k = max(0, $i - 1); $k < min(count($lines), $i + 15); $k++) {
                $snippet .= $lines[$k];
                if (strpos($lines[$k], ';') !== false || strpos($lines[$k], '->execute') !== false || strpos($lines[$k], '->fetch') !== false) {
                    break;
                }
            }
            $table = $m[1];
            $hasFilter = (stripos($snippet, 'deleted_at') !== false || stripos($snippet, 'is_deleted') !== false || stripos($snippet, "status != 'deleted'") !== false || stripos($snippet, "status = 'deleted'") !== false);
            echo "  Line $num (Table: $table): " . ($hasFilter ? "[FILTERED]" : "[CHECK NEEDED]") . "\n";
            echo "    Snippet: " . trim(preg_replace('/\s+/', ' ', substr($snippet, 0, 160))) . "...\n";
        }
    }
}
