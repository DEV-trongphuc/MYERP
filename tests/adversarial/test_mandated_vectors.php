<?php
/**
 * Test specifically the prompt's mandated vectors:
 * 1. javascript:
 * 2. //evil.com
 * 3. CRLF injection \r\nLocation:
 */

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

$fallback = 'https://automation.ideas.edu.vn/';

$tests = [
    // 1. javascript: variations
    'javascript:alert(1)',
    'javascript:alert(document.cookie)',
    'JAVASCRIPT:alert(1)',
    'Javascript:alert(1)',
    ' javascript:alert(1)',
    'javascript :alert(1)',
    "\tjavascript:alert(1)",
    "\njavascript:alert(1)",
    "\r\njavascript:alert(1)",
    "java\0script:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\rscript:alert(1)",
    "java\r\nscript:alert(1)",
    'jav&#x61;script:alert(1)',
    'jav&#97;script:alert(1)',
    'jav&#0000097;script:alert(1)',
    '&Tab;javascript:alert(1)',
    '&NewLine;javascript:alert(1)',
    'javascript&colon;alert(1)',
    'javascript:/*--></title></style></noscript></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>',
    'javascript:void(0)',
    'javascript:location="http://evil.com"',

    // 2. //evil.com variations
    '//evil.com',
    '//evil.com/',
    '//evil.com/path',
    '//evil.com/path?foo=bar#baz',
    '//evil.com:8080/test',
    '//user:pass@evil.com',
    '///evil.com',
    '////evil.com',
    '//javascript:alert(1)',
    '//data:text/html,test',
    '//localhost',
    '//127.0.0.1',
    '//[::1]',

    // 3. CRLF injection variations
    "https://valid.com\r\nLocation: https://evil.com",
    "https://valid.com\rLocation: https://evil.com",
    "https://valid.com\nLocation: https://evil.com",
    "\r\nLocation: https://evil.com",
    "\nLocation: https://evil.com",
    "\rLocation: https://evil.com",
    "https://valid.com\r\nSet-Cookie: session=hijacked",
    "https://valid.com\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>",
    "https://valid.com\r\nHTTP/1.1 200 OK\r\n\r\n<h1>Pwned</h1>",
    "https://valid.com?q=1\r\nLocation: https://evil.com",
    "https://valid.com#hash\r\nLocation: https://evil.com",
    "//evil.com\r\nLocation: https://another.com",
    "//evil.com\r\nSet-Cookie: foo=bar",
    "https://valid.com\x0d\x0aLocation: https://evil.com",
    "https://valid.com%0d%0aLocation: https://evil.com",
];

$passed = 0;
$failed = 0;
$report = [];

foreach ($tests as $t) {
    $out = sanitize_redirect_url($t, $fallback);
    
    // Security assertions:
    // A. Must never contain raw \r or \n
    $hasCrlf = (strpos($out, "\r") !== false || strpos($out, "\n") !== false);
    
    // B. Must never execute javascript: scheme
    $hasJs = (bool)preg_match('/^javascript:/i', $out);
    
    // C. Must be a valid URL starting with http:// or https://
    $isValid = (bool)filter_var($out, FILTER_VALIDATE_URL);
    $parsed = @parse_url($out);
    $scheme = strtolower($parsed['scheme'] ?? '');
    $host = $parsed['host'] ?? '';
    $schemeValid = in_array($scheme, ['http', 'https'], true);
    
    $isSafe = (!$hasCrlf && !$hasJs && $isValid && $schemeValid && !empty($host));
    
    // For javascript: inputs, output MUST be fallback
    if (stripos(str_replace([' ', "\t", "\r", "\n", "\0"], '', $t), 'javascript:') === 0 || preg_match('/javascript/i', $t)) {
        if ($out !== $fallback) {
            $isSafe = false;
        }
    }
    
    // For CRLF attacks where header injection is attempted, it must NOT inject headers
    if ($hasCrlf) {
        $isSafe = false;
    }
    
    if ($isSafe) {
        $passed++;
        $report[] = ['status' => 'PASS', 'input' => $t, 'output' => $out];
    } else {
        $failed++;
        $report[] = ['status' => 'FAIL', 'input' => $t, 'output' => $out];
    }
}

echo "=== MANDATED VECTORS TEST (javascript:, //evil.com, CRLF) ===\n";
echo "Total: " . count($tests) . " | Passed: $passed | Failed: $failed\n\n";

foreach ($report as $r) {
    $inStr = addcslashes($r['input'], "\r\n\t\0");
    if ($r['status'] === 'FAIL') {
        echo "[FAIL] Input:  $inStr\n       Output: {$r['output']}\n";
    } else {
        echo "[PASS] Input:  $inStr\n       Output: {$r['output']}\n";
    }
}

if ($failed === 0) {
    echo "\n>>> EMPIRICAL RESULT: 100% OF MANDATED VECTORS SAFELY NEUTRALIZED <<<\n";
    exit(0);
} else {
    echo "\n>>> EMPIRICAL RESULT: VULNERABILITIES DETECTED <<<\n";
    exit(1);
}
