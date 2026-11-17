import subprocess

PHP_BIN = r"C:\Users\LENOVO\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"

test_script = """<?php
function sanitize_redirect_url(?string $rawUrl, ?string $fallbackUrl = null): string {
    $fallback = $fallbackUrl ?: (rtrim(getenv('APP_BASE_URL') ?: 'https://automation.ideas.edu.vn', '/') . '/');
    if ($rawUrl === null || trim($rawUrl) === '') {
        return $fallback;
    }

    // 1. HTML entity decode and strip control characters / CRLF
    $url = html_entity_decode(trim($rawUrl), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $url = preg_replace('/[\\x00-\\x1F\\x7F]+/', '', $url);
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
    } elseif (!preg_match('/^[a-z][a-z0-9+\\-.]*:\\/\\//i', $url)) {
        $url = 'https://' . ltrim($url, '/');
    }

    // 4. Encode non-ASCII for validation
    $encodedUrl = preg_replace_callback('/[^\\x21-\\x7E]/', function ($m) {
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

    return str_replace(["\\r", "\\n"], '', $encodedUrl);
}

$inputs = [
    "https://ideas.edu.vn",
    "http://ideas.edu.vn/path?param=1",
    "https://ideas.edu.vn\\r\\nHeader-Injected: test",
    "https://ideas.edu.vn\\nHeader-Injected: test",
    "//malicious.com/phish",
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "https://example.com/foo%20bar?name=Nguyễn",
    "",
    null
];

$results = [];
foreach ($inputs as $in) {
    $results[] = [
        'input' => $in,
        'output' => sanitize_redirect_url($in, 'https://fallback.com/')
    ];
}

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
"""

with open("tests/adversarial/temp_test_sanitize.php", "w", encoding="utf-8") as f:
    f.write(test_script)

res = subprocess.run([PHP_BIN, "tests/adversarial/temp_test_sanitize.php"], capture_output=True, text=True)
print("OUT:", res.stdout.strip())
