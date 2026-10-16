<?php
// api/img_ratio.php - Server-side exact aspect-ratio cropper & optimizer for email clients
// Solves email client limitations (Gmail, Outlook, Yahoo strip `aspect-ratio` & `object-fit: cover`).
// Crops images physically to the exact specified ratio so that `width: 100%; height: auto` renders
// identical dimensions across all columns on both desktop and mobile email clients.

error_reporting(0);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$imageUrl = trim($_GET['url'] ?? '');
$ratioStr = trim($_GET['ratio'] ?? '');
$fit = strtolower(trim($_GET['fit'] ?? 'cover'));
$maxW = max(100, min(2400, intval($_GET['w'] ?? 1200)));

if (empty($imageUrl)) {
    http_response_code(400);
    exit('Missing image url');
}

// Parse aspect ratio (e.g. "16/9", "16:9", "4/3", "4:3", "1/1", "1:1", "3/2", "2/1", "16/10", "1")
function parseAspectRatio($str) {
    if (empty($str) || $str === 'auto') return null;
    $clean = str_replace([' ', ':'], ['', '/'], trim($str));
    if (strpos($clean, '/') !== false) {
        $parts = explode('/', $clean);
        $w = floatval($parts[0] ?? 0);
        $h = floatval($parts[1] ?? 1);
        if ($w > 0 && $h > 0) return $w / $h;
    }
    $val = floatval($clean);
    return ($val > 0.05 && $val < 20) ? $val : null;
}

$targetRatio = parseAspectRatio($ratioStr);

// If ratio is not specified, 'auto', or invalid, redirect to original image directly
if ($targetRatio === null) {
    header("Location: $imageUrl", true, 302);
    exit;
}

// 1. Cache configuration
$cacheDir = __DIR__ . '/../uploadss/img_cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$cacheKey = md5($imageUrl . '_' . $ratioStr . '_' . $fit . '_' . $maxW);
$cacheBase = $cacheDir . '/' . $cacheKey;

// Check existing cached files (jpg, png, webp)
foreach (['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'] as $ext => $mime) {
    $cachedPath = $cacheBase . '.' . $ext;
    if (file_exists($cachedPath) && (time() - filemtime($cachedPath) < 2592000) && filesize($cachedPath) > 0) {
        // Handle ETag / 304 Not Modified
        $etag = '"' . $cacheKey . '"';
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
            header('HTTP/1.1 304 Not Modified');
            exit;
        }
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=2592000, immutable');
        header('ETag: ' . $etag);
        header('Content-Length: ' . filesize($cachedPath));
        readfile($cachedPath);
        exit;
    }
}

// 2. Load source image
$imageData = null;
$localFile = null;

// Local file optimization: if URL points to /uploadss/, read directly from disk with 0ms network latency
if (strpos($imageUrl, '/uploadss/') !== false) {
    $parts = explode('/uploadss/', $imageUrl);
    $relPath = ltrim(urldecode(end($parts)), '/\\');
    $relPath = str_replace(['../', '..\\'], '', $relPath);
    $chkFile = realpath(__DIR__ . '/../uploadss/' . $relPath);
    $uploadsBase = realpath(__DIR__ . '/../uploadss');
    if ($chkFile && $uploadsBase && strpos($chkFile, $uploadsBase) === 0 && file_exists($chkFile) && is_readable($chkFile)) {
        $localFile = $chkFile;
        $imageData = file_get_contents($localFile);
    }
}

// Fetch via cURL if not available locally
if (!$imageData && preg_match('~^https?://~i', $imageUrl)) {
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $imageUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AutoflowEmailEngine/1.0');
        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($httpCode === 200 && !empty($res)) {
            $imageData = $res;
        }
    } else {
        $ctx = stream_context_create([
            'http' => ['timeout' => 6, 'user_agent' => 'AutoflowEmailEngine/1.0'],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
        ]);
        $imageData = @file_get_contents($imageUrl, false, $ctx);
    }
}

// If unable to load image or GD not loaded, gracefully fallback to redirecting
if (!$imageData || !extension_loaded('gd')) {
    header("Location: $imageUrl", true, 302);
    exit;
}

// 3. Process image with GD
$source = @imagecreatefromstring($imageData);
if (!$source) {
    header("Location: $imageUrl", true, 302);
    exit;
}

// Correct EXIF orientation for smartphone photos if needed
if (function_exists('exif_read_data')) {
    $exif = false;
    if ($localFile) {
        $exif = @exif_read_data($localFile);
    } elseif (strpos($imageData, "\xFF\xD8") === 0) {
        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode(substr($imageData, 0, 131072)));
    }
    if ($exif && !empty($exif['Orientation'])) {
        switch ($exif['Orientation']) {
            case 3:
                $rotated = imagerotate($source, 180, 0);
                if ($rotated) { imagedestroy($source); $source = $rotated; }
                break;
            case 6:
                $rotated = imagerotate($source, -90, 0);
                if ($rotated) { imagedestroy($source); $source = $rotated; }
                break;
            case 8:
                $rotated = imagerotate($source, 90, 0);
                if ($rotated) { imagedestroy($source); $source = $rotated; }
                break;
        }
    }
}

$origW = imagesx($source);
$origH = imagesy($source);

if ($origW <= 0 || $origH <= 0) {
    imagedestroy($source);
    header("Location: $imageUrl", true, 302);
    exit;
}

$origRatio = $origW / $origH;

// Detect MIME type
$srcMime = 'image/jpeg';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
        $detected = finfo_buffer($finfo, $imageData);
        if ($detected) $srcMime = $detected;
        finfo_close($finfo);
    }
}

$isAlpha = ($srcMime === 'image/png' || $srcMime === 'image/webp' || $srcMime === 'image/gif');

// Calculate crop geometry
if ($fit === 'contain') {
    $outW = min($origW, $maxW);
    $outH = (int)round($outW / $targetRatio);
    if ($origRatio > $targetRatio) {
        $scaledW = $outW;
        $scaledH = (int)round($outW / $origRatio);
        $dstX = 0;
        $dstY = (int)round(($outH - $scaledH) / 2);
    } else {
        $scaledH = $outH;
        $scaledW = (int)round($outH * $origRatio);
        $dstX = (int)round(($outW - $scaledW) / 2);
        $dstY = 0;
    }
    $dst = imagecreatetruecolor($outW, $outH);
    if ($isAlpha) {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        $trans = imagecolorallocatealpha($dst, 255, 255, 255, 127);
        imagefilledrectangle($dst, 0, 0, $outW, $outH, $trans);
        imagealphablending($dst, true);
    } else {
        $white = imagecolorallocate($dst, 255, 255, 255);
        imagefilledrectangle($dst, 0, 0, $outW, $outH, $white);
    }
    imagecopyresampled($dst, $source, $dstX, $dstY, 0, 0, $scaledW, $scaledH, $origW, $origH);

} elseif ($fit === 'fill') {
    $outW = min($origW, $maxW);
    $outH = (int)round($outW / $targetRatio);
    $dst = imagecreatetruecolor($outW, $outH);
    if ($isAlpha) {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
    }
    imagecopyresampled($dst, $source, 0, 0, 0, 0, $outW, $outH, $origW, $origH);

} else {
    // Default 'cover': Center crop to exact aspect ratio
    if ($origRatio > $targetRatio) {
        // Source is wider: crop horizontal sides
        $cropH = $origH;
        $cropW = (int)round($origH * $targetRatio);
        $srcX = (int)round(($origW - $cropW) / 2);
        $srcY = 0;
    } else {
        // Source is taller: crop vertical top & bottom
        $cropW = $origW;
        $cropH = (int)round($origW / $targetRatio);
        $srcX = 0;
        $srcY = (int)round(($origH - $cropH) / 2);
    }

    $outW = min($cropW, $maxW);
    $outH = (int)round($outW / $targetRatio);

    $dst = imagecreatetruecolor($outW, $outH);
    if ($isAlpha) {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        $trans = imagecolorallocatealpha($dst, 255, 255, 255, 127);
        imagefilledrectangle($dst, 0, 0, $outW, $outH, $trans);
        imagealphablending($dst, true);
    }
    imagecopyresampled($dst, $source, 0, 0, $srcX, $srcY, $outW, $outH, $cropW, $cropH);
}

// 4. Output & Cache
if ($srcMime === 'image/png') {
    $outExt = 'png';
    $outMime = 'image/png';
    $cacheFile = $cacheBase . '.png';
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    @imagepng($dst, $cacheFile, 8);
} elseif ($srcMime === 'image/webp' && function_exists('imagewebp')) {
    $outExt = 'webp';
    $outMime = 'image/webp';
    $cacheFile = $cacheBase . '.webp';
    @imagewebp($dst, $cacheFile, 88);
} else {
    $outExt = 'jpg';
    $outMime = 'image/jpeg';
    $cacheFile = $cacheBase . '.jpg';
    @imagejpeg($dst, $cacheFile, 88);
}

$etag = '"' . $cacheKey . '"';
header('Content-Type: ' . $outMime);
header('Cache-Control: public, max-age=2592000, immutable');
header('ETag: ' . $etag);

if (file_exists($cacheFile) && filesize($cacheFile) > 0) {
    header('Content-Length: ' . filesize($cacheFile));
    readfile($cacheFile);
} else {
    // If disk write was prevented by permissions, stream directly from memory
    if ($outMime === 'image/png') {
        imagepng($dst, null, 8);
    } elseif ($outMime === 'image/webp' && function_exists('imagewebp')) {
        imagewebp($dst, null, 88);
    } else {
        imagejpeg($dst, null, 88);
    }
}

imagedestroy($source);
imagedestroy($dst);
exit;
