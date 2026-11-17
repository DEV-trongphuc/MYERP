<?php
$source = file_get_contents(__DIR__ . '/../../backend/automation/go.php');
$start = strpos($source, 'function sanitize_redirect_url');
$braceOpen = strpos($source, '{', $start);
$depth = 1;
$idx = $braceOpen + 1;
$len = strlen($source);
while ($depth > 0 && $idx < $len) {
    if ($source[$idx] === '{') $depth++;
    elseif ($source[$idx] === '}') $depth--;
    $idx++;
}
$fnCode = substr($source, $start, $idx - $start);
eval($fnCode);

$test = [
    'tel:+84987654321',
    'sms:+84987654321',
    'intent://example.com#Intent;scheme=http;package=com.android.chrome;end',
    '//evil.com',
    '//evil.com/phish',
    'http://evil.com',
    'https://evil.com',
    '/s/123',
    's/123',
    'https://good.com\r\nLocation: https://evil.com',
    'https://good.com\r\nSet-Cookie: stolen=1',
    'javascript:alert(1)',
];

foreach ($test as $t) {
    $res = sanitize_redirect_url($t, 'https://fallback.com/');
    echo sprintf("%-50s => %s\n", addcslashes($t, "\r\n\t"), $res);
}
