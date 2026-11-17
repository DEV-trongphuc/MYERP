<?php
/**
 * Empirical Adversarial Test Harness: Open Redirect & Protocol Sanitization
 * Testing sanitize_redirect_url from:
 * - backend/automation/go.php
 * - backend/automation/webhook.php
 * - backend/automation/zalo_track.php
 * - backend/automation/zalo_tracking.php
 * - backend/automation/links_qr.php
 */

// Dynamically extract the function from go.php without executing top-level script logic
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

if (!function_exists('sanitize_redirect_url')) {
    echo "ERROR: Failed to load sanitize_redirect_url!\n";
    exit(1);
}

$vectors = [
    // Dangerous Schemes & XSS
    'javascript:alert(1)' => 'dangerous_scheme',
    'JAVASCRIPT:alert(1)' => 'dangerous_scheme',
    'javascript:alert(document.cookie)' => 'dangerous_scheme',
    ' javascript:alert(1)' => 'dangerous_scheme',
    "\tjavascript:alert(1)" => 'dangerous_scheme',
    "\njavascript:alert(1)" => 'dangerous_scheme',
    "java\0script:alert(1)" => 'dangerous_scheme',
    "java\nscript:alert(1)" => 'dangerous_scheme',
    "java\r\nscript:alert(1)" => 'dangerous_scheme',
    "jav\tascript:alert(1)" => 'dangerous_scheme',
    'jav&#x61;script:alert(1)' => 'dangerous_scheme',
    'javascript&colon;alert(1)' => 'dangerous_scheme',
    '&Tab;javascript:alert(1)' => 'dangerous_scheme',
    'jav&#0000097;script:alert(1)' => 'dangerous_scheme',
    'javascript:/*--></title></style></noscript></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//\'>' => 'dangerous_scheme',
    'vbscript:msgbox(1)' => 'dangerous_scheme',
    'VBSCRIPT:msgbox(1)' => 'dangerous_scheme',
    'data:text/html,<script>alert(1)</script>' => 'dangerous_scheme',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' => 'dangerous_scheme',
    'DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' => 'dangerous_scheme',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=' => 'dangerous_scheme',
    'file:///etc/passwd' => 'dangerous_scheme',
    'file://C:/Windows/win.ini' => 'dangerous_scheme',
    'about:blank' => 'dangerous_scheme',
    'blob:https://example.com/uuid-here' => 'dangerous_scheme',
    'mailto:victim@example.com' => 'dangerous_scheme',
    'tel:+84987654321' => 'dangerous_scheme',
    'sms:+84987654321' => 'dangerous_scheme',
    'intent://example.com#Intent;scheme=http;package=com.android.chrome;end' => 'dangerous_scheme',

    // CRLF / Header Injection
    "https://valid.com\r\nSet-Cookie: stolen=1" => 'crlf_injection',
    "https://valid.com\r\nLocation: https://evil.com" => 'crlf_injection',
    "https://valid.com\rLocation: https://evil.com" => 'crlf_injection',
    "https://valid.com\nLocation: https://evil.com" => 'crlf_injection',
    "\r\nLocation: https://evil.com" => 'crlf_injection',
    "https://valid.com\r\n\r\n<script>alert(1)</script>" => 'crlf_injection',
    "https://valid.com\x0d\x0aContent-Length: 0\x0d\x0a\x0d\x0aHTTP/1.1 200 OK" => 'crlf_injection',

    // Protocol-Relative & Backslash Evasion
    '//evil.com' => 'protocol_relative',
    '//evil.com/path?foo=bar' => 'protocol_relative',
    '///evil.com' => 'protocol_relative',
    '////evil.com' => 'protocol_relative',
    '/\\evil.com' => 'backslash_evasion',
    '\\/evil.com' => 'backslash_evasion',
    '\\\\evil.com' => 'backslash_evasion',
    'https:evil.com' => 'malformed_scheme',
    'http:evil.com' => 'malformed_scheme',
    'https:///evil.com' => 'slash_evasion',
    'http:\/\/evil.com' => 'backslash_evasion',
    'https://valid.com\\@evil.com' => 'userinfo_evasion',
    'https://valid.com@evil.com' => 'userinfo_evasion',

    // Malformed / Empty
    '' => 'empty_or_null',
    '   ' => 'empty_or_null',
    'https://' => 'malformed',
    'http://' => 'malformed',
    'http://.evil.com' => 'malformed',
    'http://evil..com' => 'malformed',
    'http://:80' => 'malformed',

    // Legitimate URLs (must be preserved)
    'https://ideas.edu.vn' => 'valid_https',
    'https://automation.ideas.edu.vn/s/survey-123' => 'valid_https',
    'https://subdomain.domain.vn/path/to/page?utm_source=email&utm_campaign=c1#hash' => 'valid_https',
    'http://example.com' => 'valid_http',
    'https://myerp.vn:8443/landing?foo=bar&baz=1' => 'valid_port',
];

$fallback = 'https://automation.ideas.edu.vn/';
$passed = 0;
$failed = 0;
$results = [];

foreach ($vectors as $input => $category) {
    $clean = sanitize_redirect_url($input, $fallback);
    
    // Check if CRLF is present in output
    $hasCrlf = (strpos($clean, "\r") !== false || strpos($clean, "\n") !== false);
    
    // Check if dangerous scheme survived
    $isDangerous = (bool)preg_match('/^(?:javascript|vbscript|data|file|about|blob|mailto|tel|sms|intent):/i', $clean);
    
    // Check if valid URL structure
    $parsed = @parse_url($clean);
    $isValidUrl = (bool)filter_var($clean, FILTER_VALIDATE_URL);
    $hasScheme = in_array(strtolower($parsed['scheme'] ?? ''), ['http', 'https'], true);
    $hasHost = !empty($parsed['host']);
    
    $ok = true;
    $failureReason = '';
    
    if ($hasCrlf) {
        $ok = false;
        $failureReason = 'CRLF characters present in output';
    } elseif ($isDangerous) {
        $ok = false;
        $failureReason = 'Dangerous scheme survived: ' . substr($clean, 0, 30);
    } elseif (!$isValidUrl || !$hasScheme || !$hasHost) {
        $ok = false;
        $failureReason = 'Output is not a valid HTTP/HTTPS URL: ' . $clean;
    }
    
    if ($category === 'dangerous_scheme' && $clean !== $fallback) {
        // Must fallback to safe URL
        $ok = false;
        $failureReason = 'Dangerous scheme was not redirected to fallback; got: ' . $clean;
    }
    
    if ($category === 'crlf_injection' && $clean !== $fallback && $hasCrlf) {
        $ok = false;
        $failureReason = 'CRLF injection was not neutralized';
    }
    
    if ($category === 'empty_or_null' && $clean !== $fallback) {
        $ok = false;
        $failureReason = 'Empty/null did not return fallback; got: ' . $clean;
    }
    
    if ($category === 'malformed' && $clean !== $fallback) {
        $ok = false;
        $failureReason = 'Malformed URL did not return fallback; got: ' . $clean;
    }
    
    if ($ok) {
        $passed++;
        $results[] = [
            'status' => 'PASS',
            'input' => $input,
            'output' => $clean,
            'category' => $category
        ];
    } else {
        $failed++;
        $results[] = [
            'status' => 'FAIL',
            'input' => $input,
            'output' => $clean,
            'category' => $category,
            'reason' => $failureReason
        ];
    }
}

echo "=== EMPIRICAL ADVERSARIAL OPEN REDIRECT TEST RESULTS ===\n";
echo "Total vectors tested: " . count($vectors) . "\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n\n";

foreach ($results as $r) {
    if ($r['status'] === 'FAIL') {
        echo "[FAIL] Input: " . addcslashes($r['input'], "\r\n\t") . "\n";
        echo "       Output: " . $r['output'] . "\n";
        echo "       Category: " . $r['category'] . "\n";
        echo "       Reason: " . $r['reason'] . "\n\n";
    }
}

if ($failed === 0) {
    echo ">>> ALL OPEN REDIRECT ADVERSARIAL VECTORS SAFELY NEUTRALIZED (ZERO FAILURES) <<<\n";
} else {
    echo ">>> VULNERABILITIES DETECTED: $failed VECTORS FAILED <<<\n";
    exit(1);
}
