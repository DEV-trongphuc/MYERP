<?php
$files = [
    'backend/automation/go.php',
    'backend/automation/webhook.php',
    'backend/automation/zalo_track.php',
    'backend/automation/zalo_tracking.php',
    'backend/automation/links_qr.php'
];

foreach ($files as $f) {
    $full = __DIR__ . '/../../' . $f;
    if (!file_exists($full)) {
        echo "$f: FILE NOT FOUND\n";
        continue;
    }
    $c = file_get_contents($full);
    $start = strpos($c, 'function sanitize_redirect_url');
    if ($start === false) {
        echo "$f: FUNCTION NOT FOUND\n";
        continue;
    }
    // find matching brace
    $braceOpen = strpos($c, '{', $start);
    $depth = 1;
    $idx = $braceOpen + 1;
    $len = strlen($c);
    while ($depth > 0 && $idx < $len) {
        if ($c[$idx] === '{') $depth++;
        elseif ($c[$idx] === '}') $depth--;
        $idx++;
    }
    $fnCode = substr($c, $start, $idx - $start);
    $normalized = preg_replace('/\s+/', ' ', trim($fnCode));
    echo "$f: MD5=" . md5($normalized) . ", Len=" . strlen($fnCode) . "\n";
}
