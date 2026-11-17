<?php
/**
 * Test sanitize_redirect_url from webhook.php / go.php / zalo_track.php
 */
function sanitize_redirect_url(?string $rawUrl, ?string $fallbackUrl = null): string {
    $fallback = $fallbackUrl ?: (rtrim(getenv('APP_BASE_URL') ?: 'https://automation.ideas.edu.vn', '/') . '/');
    if ($rawUrl === null || trim($rawUrl) === '') {
        return $fallback;
    }

    // 1. HTML entity decode and strip control characters / CRLF
    $url = html_entity_decode(trim($rawUrl), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $url = preg_replace('/[\x00-\x1F\x7F]+/', '', $url);
    if (trim($url) === '') {
        return $fallback;
    }

    // 2. Reject dangerous schemes
    if (preg_match('/^(?:javascript|data|vbscript|file|about|blob):/i', $url)) {
        return $fallback;
    }

    // 3. Protocol-relative normalization
    if (strpos($url, '//') === 0) {
        $url = 'https:' . $url;
    } elseif (!preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $url)) {
        $url = 'https://' . ltrim($url, '/');
    }

    // 4. Encode non-ASCII for validation
    $encodedUrl = preg_replace_callback('/[^\x21-\x7E]/', function ($m) {
        return rawurlencode($m[0]);
    }, $url);

    $parsed = @parse_url($encodedUrl);
    if (!$parsed || !is_array($parsed)) {
        return $fallback;
    }

    $scheme = strtolower($parsed['scheme'] ?? '');
    $host   = $parsed['host'] ?? '';

    if (!in_array($scheme, ['http', 'https'], true) || empty($host)) {
        return $fallback;
    }

    if (!filter_var($encodedUrl, FILTER_VALIDATE_URL)) {
        return $fallback;
    }

    return str_replace(["\r", "\n"], '', $encodedUrl);
}

$testCases = [
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    "https://example.com\r\nSet-Cookie: session=hijacked",
    "https://example.com\nLocation: https://evil.com",
    "//evil.com/phish",
    "https://valid-target.com/path?param=1&foo=bar",
    "http://valid-http.com/landing",
    "",
    null,
    "   ",
    "https://example.com/test?name=<script>alert(1)</script>",
    "https://sub.domain.ideas.edu.vn/survey?id=123#page2",
    "java\x00script:alert(1)",
    "https://example.com/\r\nHTTP/1.1 200 OK\r\n\r\n<html>Hacked</html>"
];

$allPassed = true;
foreach ($testCases as $tc) {
    $sanitized = sanitize_redirect_url($tc, "https://default.com/fallback");
    $hasCRLF = (strpos($sanitized, "\r") !== false || strpos($sanitized, "\n") !== false);
    $hasBadScheme = (bool)preg_match('/^(?:javascript|data|vbscript|file|about|blob):/i', $sanitized);
    $passed = (!$hasCRLF && !$hasBadScheme);
    if (!$passed) $allPassed = false;
    echo "INPUT: " . var_export($tc, true) . PHP_EOL;
    echo "OUTPUT: " . $sanitized . PHP_EOL;
    echo "CRLF: " . ($hasCRLF ? "FAIL" : "SAFE") . " | SCHEME: " . ($hasBadScheme ? "FAIL" : "SAFE") . " -> " . ($passed ? "PASS" : "FAIL") . PHP_EOL . PHP_EOL;
}

echo "Overall Result: " . ($allPassed ? "ALL TESTS PASSED" : "TESTS FAILED") . PHP_EOL;
