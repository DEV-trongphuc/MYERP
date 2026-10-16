<?php
// api/tracking_helper.php

function getDeviceDetails($ua)
{
    $device = 'desktop';
    $os = 'Unknown OS';
    $browser = 'Unknown Browser';

    if (!$ua)
        return compact('device', 'os', 'browser');

    // PROXY DETECTION (Gmail, Yahoo, etc.)
    if (preg_match('/GoogleImageProxy/i', $ua)) {
        return ['device' => 'Proxy', 'os' => 'Google Proxy', 'browser' => 'Gmail'];
    }
    if (preg_match('/YahooMailProxy/i', $ua)) {
        return ['device' => 'Proxy', 'os' => 'Yahoo Proxy', 'browser' => 'Yahoo Mail'];
    }
    if (preg_match('/Brevo\/1\.0/i', $ua)) {
        return ['device' => 'Proxy', 'os' => 'Brevo Proxy', 'browser' => 'Brevo Mail'];
    }

    // Simple Regex Detection
    if (preg_match('/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i', $ua)) {
        $device = 'mobile';
    } elseif (preg_match('/ipad|tablet/i', $ua)) {
        $device = 'tablet';
    }

    // OS
    if (preg_match('/windows nt 10/i', $ua))
        $os = 'Windows 10';
    elseif (preg_match('/windows nt 6.3/i', $ua))
        $os = 'Windows 8.1';
    elseif (preg_match('/windows nt 6.2/i', $ua))
        $os = 'Windows 8';
    elseif (preg_match('/windows nt 6.1/i', $ua))
        $os = 'Windows 7';
    elseif (preg_match('/macintosh|mac os x/i', $ua))
        $os = 'macOS';
    elseif (preg_match('/android/i', $ua))
        $os = 'Android';
    elseif (preg_match('/iphone|ipad|ipod/i', $ua))
        $os = 'iOS';
    elseif (preg_match('/linux/i', $ua))
        $os = 'Linux';

    // Browser (check Edge BEFORE Chrome — Edge UA also contains 'Chrome')
    // [FIX] Check Cốc Cốc and Samsung Internet BEFORE Chrome — their UAs embed 'Chrome'
    if (preg_match('/MSIE/i', $ua) && !preg_match('/Opera/i', $ua))
        $browser = 'Internet Explorer';
    elseif (preg_match('/Edg\//i', $ua) || preg_match('/Edge\//i', $ua))
        $browser = 'Edge';
    elseif (preg_match('/OPR\//i', $ua) || preg_match('/Opera/i', $ua))
        $browser = 'Opera';
    elseif (preg_match('/coc_coc_browser/i', $ua))
        $browser = 'Cốc Cốc';
    elseif (preg_match('/SamsungBrowser/i', $ua))
        $browser = 'Samsung Internet';
    elseif (preg_match('/Firefox/i', $ua))
        $browser = 'Firefox';
    elseif (preg_match('/Chrome/i', $ua))
        $browser = 'Chrome';
    elseif (preg_match('/Safari/i', $ua))
        $browser = 'Safari';


    return compact('device', 'os', 'browser');
}

function getLocationFromIP($ip)
{
    static $locCache = [];
    if (isset($locCache[$ip]))
        return $locCache[$ip];

    // [FIX] Screen all private/reserved IP ranges — never hit external API for internal traffic.
    // Old code only checked 127.0.0.1 and ::1, missing LAN ranges like 192.168.x.x, 10.x.x.x.
    if (
        $ip === '127.0.0.1' || $ip === '::1' ||
        strpos($ip, '192.168.') === 0 ||
        strpos($ip, '10.') === 0 ||
        strpos($ip, 'fc00:') === 0 ||
        strpos($ip, 'fe80:') === 0 ||
        preg_match('/^172\.(1[6-9]|2\d|3[01])\./', $ip)
    ) {
        return $locCache[$ip] = 'Localhost';
    }

    // [WARNING] This is a synchronous HTTP call in the request hot-path.
    // For high-traffic deployments, move IP geolocation to a background worker
    // or use a local MaxMind GeoIP2 .mmdb file (100x faster, no external dependency).
    // [FIX] Reduced timeout from 1s → 0.5s and added ignore_errors to prevent
    // PHP warnings from leaking into the response when ip-api.com is briefly unreachable.
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 0.5,
            'ignore_errors' => true
        ]
    ]);
    $json = @file_get_contents("http://ip-api.com/json/$ip?fields=city,country,status", false, $ctx);
    if ($json) {
        $data = json_decode($json, true);
        // [FIX] Check status==='success' instead of isset($data['city']).
        // ip-api returns {'status':'fail','message':'...'} for invalid/reserved IPs —
        // the old check would still try to build "Unknown, fail" as a location string.
        if ($data && ($data['status'] ?? '') === 'success') {
            $locCache[$ip] = $data['city'] . ', ' . $data['country'];
            return $locCache[$ip];
        }
    }
    return $locCache[$ip] = null;
}
?>
