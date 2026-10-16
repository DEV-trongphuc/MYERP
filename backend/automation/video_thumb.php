<?php
// api/video_thumb.php - Real-time composite video thumbnail generator with centered play button
// Generates a 100% email-client-compatible (Gmail, Outlook, Yahoo, iOS, Android) single image.

error_reporting(0);
ini_set('display_errors', 0);

$imageUrl = $_GET['url'] ?? $_GET['thumb'] ?? '';
$colorHex = ltrim($_GET['color'] ?? 'd97706', '#');
$size = max(40, min(120, intval($_GET['size'] ?? 72)));

if (empty($imageUrl)) {
    // Return a default placeholder if no image provided
    $width = 600;
    $height = 340;
    $im = imagecreatetruecolor($width, $height);
    $bg = imagecolorallocate($im, 30, 41, 59); // slate-800
    imagefilledrectangle($im, 0, 0, $width, $height, $bg);
    drawPlayButton($im, $width / 2, $height / 2, 36, $colorHex);
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=86400');
    imagejpeg($im, null, 90);
    imagedestroy($im);
    exit;
}

// 1. Check cache
$cacheDir = __DIR__ . '/../uploadss/video_cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$cacheKey = md5($imageUrl . '_' . $colorHex . '_' . $size);
$cacheFile = $cacheDir . '/' . $cacheKey . '.jpg';

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 2592000)) { // 30 days
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=2592000');
    header('Content-Length: ' . filesize($cacheFile));
    readfile($cacheFile);
    exit;
}

// 2. Fetch or load source image data
$imageData = null;

// Check if local file in uploadss
if (strpos($imageUrl, '/uploadss/') !== false) {
    $parts = explode('/uploadss/', $imageUrl);
    $localFile = __DIR__ . '/../uploadss/' . end($parts);
    if (file_exists($localFile) && is_readable($localFile)) {
        $imageData = file_get_contents($localFile);
    }
}

if (!$imageData) {
    // Fetch via cURL with timeout
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $imageUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AutoflowEmailEngine/1.0');
        $imageData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($httpCode !== 200) {
            $imageData = null;
        }
    } else {
        $context = stream_context_create([
            'http' => ['timeout' => 6, 'user_agent' => 'AutoflowEmailEngine/1.0'],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
        ]);
        $imageData = @file_get_contents($imageUrl, false, $context);
    }
}

if (!$imageData || !extension_loaded('gd')) {
    // Fallback: redirect directly to source image
    header("Location: $imageUrl", true, 302);
    exit;
}

// 3. Create GD image from binary data
$source = @imagecreatefromstring($imageData);
if (!$source) {
    header("Location: $imageUrl", true, 302);
    exit;
}

$origW = imagesx($source);
$origH = imagesy($source);

// Create truecolor destination
$im = imagecreatetruecolor($origW, $origH);
imagealphablending($im, true);
imagesavealpha($im, false);

// Copy source image
imagecopy($im, $source, 0, 0, 0, 0, $origW, $origH);
imagedestroy($source);

// 4. Draw gentle dark overlay (25% black tint) to make play button pop
$overlay = imagecolorallocatealpha($im, 0, 0, 0, 95);
imagefilledrectangle($im, 0, 0, $origW, $origH, $overlay);

// 5. Draw Play Button in exact center
$cx = $origW / 2;
$cy = $origH / 2;

// Button radius proportional to image (minimum 28px, maximum 55px)
$btnRadius = max(28, min(round($origW * 0.065), 55));
drawPlayButton($im, $cx, $cy, $btnRadius, $colorHex);

// 6. Save cache & output
@imagejpeg($im, $cacheFile, 90);

header('Content-Type: image/jpeg');
header('Cache-Control: public, max-age=2592000');
imagejpeg($im, null, 90);
imagedestroy($im);
exit;

/**
 * Helper to draw a circular play button with drop-shadow effect and white triangle
 */
function drawPlayButton($im, $cx, $cy, $radius, $hexColor) {
    // Hex to RGB
    if (strlen($hexColor) === 3) {
        $r = hexdec(str_repeat(substr($hexColor, 0, 1), 2));
        $g = hexdec(str_repeat(substr($hexColor, 1, 1), 2));
        $b = hexdec(str_repeat(substr($hexColor, 2, 1), 2));
    } else {
        $r = hexdec(substr($hexColor, 0, 2));
        $g = hexdec(substr($hexColor, 2, 2));
        $b = hexdec(substr($hexColor, 4, 2));
    }

    // Outer shadow / glow
    for ($i = 4; $i >= 1; $i--) {
        $shadowAlpha = 110 + ($i * 4);
        if ($shadowAlpha > 127) $shadowAlpha = 127;
        $shadowCol = imagecolorallocatealpha($im, 0, 0, 0, $shadowAlpha);
        imagefilledellipse($im, $cx, $cy + ($i * 1.5), ($radius * 2) + ($i * 4), ($radius * 2) + ($i * 4), $shadowCol);
    }

    // Main circle button
    $btnColor = imagecolorallocate($im, $r, $g, $b);
    imagefilledellipse($im, $cx, $cy, $radius * 2, $radius * 2, $btnColor);

    // Subtle white border
    $whiteBorder = imagecolorallocatealpha($im, 255, 255, 255, 100);
    imagesetthickness($im, 2);
    imageellipse($im, $cx, $cy, $radius * 2, $radius * 2, $whiteBorder);

    // White Play Triangle
    $tSize = round($radius * 0.50);
    $offsetRight = round($radius * 0.08); // Optical center alignment
    $white = imagecolorallocate($im, 255, 255, 255);

    $points = [
        $cx - ($tSize * 0.7) + $offsetRight, $cy - $tSize,          // Top left
        $cx - ($tSize * 0.7) + $offsetRight, $cy + $tSize,          // Bottom left
        $cx + ($tSize * 1.1) + $offsetRight, $cy                    // Right tip
    ];

    imagefilledpolygon($im, $points, $white);
}
