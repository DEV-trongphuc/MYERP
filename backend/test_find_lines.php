<?php
// backend/test_find_lines.php
$filePath = __DIR__ . '/../src/pages/ProjectsPage.tsx';

if (!file_exists($filePath)) {
    echo "ERROR: File not found at $filePath\n";
    exit(1);
}

$lines = file($filePath);
echo "Total lines: " . count($lines) . "\n\n";

$keywords = ['editingProject', 'editingCampaign', 'activeTab', 'projects.map', 'campaigns.map'];

foreach ($keywords as $kw) {
    echo "=== Searching for '$kw' ===\n";
    $matchCount = 0;
    foreach ($lines as $idx => $line) {
        if (strpos($line, $kw) !== false) {
            $matchCount++;
            if ($matchCount <= 20) { // Limit output
                echo "Line " . ($idx + 1) . ": " . trim($line) . "\n";
            }
        }
    }
    echo "Total matches: $matchCount\n\n";
}
