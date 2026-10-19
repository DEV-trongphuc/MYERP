<?php
// backend/automation/upload.php — High-Performance Media Library & Uploader with Auto WebP Thumbnails
require_once 'db_connect.php';
require_once 'auth_middleware.php';

// 1. SECURITY: Handle Authentication
$isStaffAdmin = !empty($_SESSION['is_admin']) || (!empty($_SESSION['role']) && $_SESSION['role'] === 'admin');
$isOrgUser = !empty($_SESSION['org_user_id']) || !empty($GLOBALS['current_admin_id']) || !empty($_SESSION['user_id']);

$bearerAuthed = false;
$allHeaders = function_exists('getallheaders') ? getallheaders() : [];
$normalizedHeaders = array_change_key_case($allHeaders, CASE_LOWER);
$authHeader = $normalizedHeaders['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!empty($authHeader) && preg_match('/Bearer\s+(.+)$/i', $authHeader, $tokenMatch)) {
    $rawToken = trim($tokenMatch[1]);
    try {
        $stmtTok = $pdo->prepare(
            "SELECT id FROM api_tokens WHERE token = ? AND (scope = 'upload' OR scope = 'full_access') AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1"
        );
        $stmtTok->execute([hash('sha256', $rawToken)]);
        if ($stmtTok->fetchColumn()) {
            $bearerAuthed = true;
        } else {
            $envToken = getenv('UPLOAD_API_TOKEN');
            if ($envToken && hash_equals(hash('sha256', $envToken), hash('sha256', $rawToken))) {
                $bearerAuthed = true;
            }
        }
    } catch (Exception $e) {
        error_log('[upload.php] Bearer token DB check failed: ' . $e->getMessage());
    }
}

if (!$isStaffAdmin && !$isOrgUser && !$bearerAuthed) {
    http_response_code(401);
    jsonResponse(false, null, 'Unauthorized');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 2. Resolve physical upload directory & public base URL reliably
$protocol = ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? 80) == 443 || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
    ? "https://"
    : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$basePath = rtrim(str_replace(['/api.php', '/index.php', '/automation/upload.php'], '', $_SERVER['SCRIPT_NAME'] ?? '/backend/index.php'), '/');
if ($basePath === '') {
    $basePath = '/backend';
}

// Physical uploadss directory inside backend/uploadss/
$uploadDir = dirname(__DIR__) . '/uploadss/';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}
$uploadDir = rtrim(realpath($uploadDir) ?: $uploadDir, '/\\') . '/';

$thumbDir = $uploadDir . '_thumbs/';
if (!is_dir($thumbDir)) {
    @mkdir($thumbDir, 0755, true);
}

$baseUrl = $protocol . $host . $basePath . "/uploadss/";

/**
 * Generate a lightweight 320px WebP thumbnail for fast grid loading
 */
function ensureImageWebpThumb(string $srcPath, string $thumbDir, string $uniqueName, string $ext): ?string
{
    $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $imageExts, true)) {
        return null;
    }
    $thumbFilename = $uniqueName . '.webp';
    $thumbPath = $thumbDir . $thumbFilename;

    if (is_file($thumbPath) && filesize($thumbPath) > 0) {
        return $thumbFilename;
    }

    if (!function_exists('imagewebp') || !is_file($srcPath)) {
        return null;
    }

    // Skip huge > 12MB corrupted files to protect memory
    $fsize = @filesize($srcPath);
    if ($fsize === false || $fsize <= 0 || $fsize > 12 * 1024 * 1024) {
        return null;
    }

    try {
        $img = null;
        if ($ext === 'jpg' || $ext === 'jpeg') {
            $img = @imagecreatefromjpeg($srcPath);
        } elseif ($ext === 'png') {
            $img = @imagecreatefrompng($srcPath);
        } elseif ($ext === 'webp') {
            $img = @imagecreatefromwebp($srcPath);
        } elseif ($ext === 'gif') {
            $img = @imagecreatefromgif($srcPath);
        }

        if (!$img) {
            return null;
        }

        $w = imagesx($img);
        $h = imagesy($img);
        if ($w <= 0 || $h <= 0) {
            imagedestroy($img);
            return null;
        }

        $targetW = min(320, $w);
        $targetH = (int)max(1, round($h * ($targetW / $w)));

        $canvas = imagecreatetruecolor($targetW, $targetH);
        // Preserve transparency for PNG/WebP/GIF on a clean white/alpha canvas
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
        imagefilledrectangle($canvas, 0, 0, $targetW, $targetH, $transparent);

        imagecopyresampled($canvas, $img, 0, 0, 0, 0, $targetW, $targetH, $w, $h);
        $ok = @imagewebp($canvas, $thumbPath, 78);

        imagedestroy($canvas);
        imagedestroy($img);

        if ($ok && is_file($thumbPath) && filesize($thumbPath) > 0) {
            return $thumbFilename;
        }
    } catch (\Throwable $e) {
        // Ignore thumbnail generation error and fallback to original URL
    }

    return null;
}

function getLibraryCacheFile(string $uploadDir): string
{
    return sys_get_temp_dir() . '/myerp_media_lib_v4_' . md5($uploadDir) . '.json';
}

function invalidateLibraryCache(string $uploadDir): void
{
    $cacheFile = getLibraryCacheFile($uploadDir);
    if (is_file($cacheFile)) {
        @unlink($cacheFile);
    }
}

// ── GET: Thư viện file — liệt kê tất cả file đã upload (có Cache + WebP Thumbnails) ──
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['route']) && $_GET['route'] === 'library') {
    if (!is_dir($uploadDir)) {
        jsonResponse(true, []);
    }

    $dirMtime = (int)(@filemtime($uploadDir) ?: 0);
    $cacheFile = getLibraryCacheFile($uploadDir);

    // Check fast cache
    if (is_file($cacheFile)) {
        $rawCache = @file_get_contents($cacheFile);
        if ($rawCache) {
            $cached = json_decode($rawCache, true);
            if (
                is_array($cached) &&
                ($cached['dir_mtime'] ?? 0) === $dirMtime &&
                ($cached['base_url'] ?? '') === $baseUrl &&
                empty($cached['needs_more_thumbs']) &&
                isset($cached['files']) &&
                is_array($cached['files'])
            ) {
                header('Cache-Control: private, max-age=15');
                jsonResponse(true, $cached['files']);
            }
        }
    }

    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'csv'];
    $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    $files = [];
    $thumbsGeneratedNow = 0;
    $needsMoreThumbs = false;

    try {
        foreach (new DirectoryIterator($uploadDir) as $f) {
            if ($f->isDot() || $f->isDir()) continue;
            $fn = $f->getFilename();
            $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed, true)) continue;

            $origName = preg_replace('/^[a-f0-9]{13}_/', '', $fn);
            $fullUrl = $baseUrl . $fn;
            $thumbUrl = $fullUrl;

            if (in_array($ext, $imageExts, true)) {
                $existingThumb = $thumbDir . $fn . '.webp';
                if (is_file($existingThumb) && filesize($existingThumb) > 0) {
                    $thumbUrl = $baseUrl . '_thumbs/' . $fn . '.webp';
                } elseif ($thumbsGeneratedNow < 30) {
                    // Generate up to 30 missing thumbnails per request so response stays fast
                    $generated = ensureImageWebpThumb($uploadDir . $fn, $thumbDir, $fn, $ext);
                    if ($generated) {
                        $thumbUrl = $baseUrl . '_thumbs/' . $generated;
                        $thumbsGeneratedNow++;
                    }
                } else {
                    $needsMoreThumbs = true;
                }
            }

            $mtime = $f->getMTime();
            $files[] = [
                'name'        => $origName,
                'uniqueName'  => $fn,
                'url'         => $fullUrl,
                'thumbUrl'    => $thumbUrl,
                'size'        => $f->getSize(),
                'type'        => $ext,
                'date'        => $mtime,
                'modified_at' => $mtime,
            ];
        }
    } catch (Exception $e) {
        error_log("DirectoryIterator error: " . $e->getMessage());
    }

    usort($files, fn($a, $b) => $b['modified_at'] - $a['modified_at']);
    $sliced = array_slice($files, 0, 400);

    @file_put_contents($cacheFile, json_encode([
        'dir_mtime'         => (int)(@filemtime($uploadDir) ?: $dirMtime),
        'base_url'          => $baseUrl,
        'needs_more_thumbs' => $needsMoreThumbs,
        'files'             => $sliced,
    ], JSON_UNESCAPED_UNICODE));

    header('Cache-Control: private, max-age=15');
    jsonResponse(true, $sliced);
}

// ── DELETE SINGLE FILE (GET/POST route=delete) ───────────────────────────────
if (isset($_GET['route']) && $_GET['route'] === 'delete') {
    $rawName = $_GET['file'] ?? '';
    $safeName = basename($rawName);
    if (empty($safeName) || $safeName !== $rawName || strpbrk($safeName, '/\\') !== false) {
        jsonResponse(false, null, 'Tên file không hợp lệ');
    }
    $filePath = $uploadDir . $safeName;
    if (!file_exists($filePath)) {
        invalidateLibraryCache($uploadDir);
        jsonResponse(false, null, 'File không tồn tại');
    }
    if (@unlink($filePath)) {
        @unlink($thumbDir . $safeName . '.webp');
        invalidateLibraryCache($uploadDir);
        jsonResponse(true, ['deleted' => $safeName]);
    } else {
        jsonResponse(false, null, 'Không thể xóa file');
    }
}

// ── BATCH DELETE (POST route=bulk_delete) ────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['route']) && $_GET['route'] === 'bulk_delete') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $fileList = is_array($body['files'] ?? null) ? $body['files'] : [];
    $deleted = [];
    $failed = 0;

    foreach ($fileList as $rawName) {
        if (!is_string($rawName)) continue;
        $safeName = basename($rawName);
        if (empty($safeName) || $safeName !== $rawName || strpbrk($safeName, '/\\') !== false) {
            $failed++;
            continue;
        }
        $filePath = $uploadDir . $safeName;
        if (is_file($filePath) && @unlink($filePath)) {
            @unlink($thumbDir . $safeName . '.webp');
            $deleted[] = $safeName;
        } else {
            $failed++;
        }
    }

    invalidateLibraryCache($uploadDir);
    jsonResponse(true, [
        'deleted' => $deleted,
        'deleted_count' => count($deleted),
        'failed_count' => $failed,
    ]);
}

// ── RENAME (POST route=rename) ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['route']) && $_GET['route'] === 'rename') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $uniqueName = basename($body['uniqueName'] ?? '');
    $newLabel = trim($body['newName'] ?? '');

    if (empty($uniqueName) || strpbrk($uniqueName, '/\\') !== false) {
        jsonResponse(false, null, 'Tên file không hợp lệ');
    }
    if (empty($newLabel) || preg_match('/[\/\\\\<>:"|?*\x00-\x1f]/', $newLabel)) {
        jsonResponse(false, null, 'Tên mới không hợp lệ');
    }
    $origExt = strtolower(pathinfo($uniqueName, PATHINFO_EXTENSION));
    $newLabelBase = preg_replace('/\.[a-z0-9]{2,5}$/i', '', $newLabel);
    $safeLabelBase = preg_replace('/[^a-zA-Z0-9._\- ]/', '', $newLabelBase);
    if (empty($safeLabelBase)) {
        jsonResponse(false, null, 'Tên mới không hợp lệ sau khi làm sạch');
    }
    $prefix = preg_match('/^[a-f0-9]{13}_/', $uniqueName, $m) ? $m[0] : '';
    $newUniqueName = basename($prefix . str_replace(' ', '_', $safeLabelBase) . '.' . $origExt);

    $oldPath = $uploadDir . $uniqueName;
    $newPath = $uploadDir . $newUniqueName;

    if (!file_exists($oldPath)) {
        jsonResponse(false, null, 'File nguồn không tồn tại');
    }
    if ($oldPath === $newPath) {
        jsonResponse(true, [
            'uniqueName' => $newUniqueName,
            'name'       => $safeLabelBase . '.' . $origExt,
            'url'        => $baseUrl . $newUniqueName,
        ]);
    }
    if (file_exists($newPath)) {
        $newUniqueName = $prefix . str_replace(' ', '_', $safeLabelBase) . '_' . time() . '.' . $origExt;
        $newPath = $uploadDir . $newUniqueName;
    }
    if (@rename($oldPath, $newPath)) {
        if (is_file($thumbDir . $uniqueName . '.webp')) {
            @rename($thumbDir . $uniqueName . '.webp', $thumbDir . $newUniqueName . '.webp');
        }
        invalidateLibraryCache($uploadDir);
        $thumbUrl = is_file($thumbDir . $newUniqueName . '.webp')
            ? $baseUrl . '_thumbs/' . $newUniqueName . '.webp'
            : $baseUrl . $newUniqueName;
        jsonResponse(true, [
            'uniqueName' => $newUniqueName,
            'name'       => $safeLabelBase . '.' . $origExt,
            'url'        => $baseUrl . $newUniqueName,
            'thumbUrl'   => $thumbUrl,
        ]);
    } else {
        jsonResponse(false, null, 'Không thể đổi tên file');
    }
}

// ── POST UPLOAD FILE ─────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

if (!isset($_FILES['file'])) {
    jsonResponse(false, null, 'No file uploaded');
}

$file = $_FILES['file'];
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'csv', 'webp'];
$fileName = $file['name'];
$fileSize = $file['size'];
$fileTmp = $file['tmp_name'];

if (strpos($fileName, "\0") !== false) {
    jsonResponse(false, null, 'Invalid filename');
}

$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if (!in_array($fileExt, $allowedExts, true)) {
    jsonResponse(false, null, 'File type not allowed');
}

$allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv', 'application/csv',
    'application/octet-stream',
];
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $detectedMime = finfo_file($finfo, $fileTmp);
    finfo_close($finfo);
    if (!in_array($detectedMime, $allowedMimes, true)) {
        jsonResponse(false, null, 'File content does not match allowed types (' . $detectedMime . ')');
    }
}

if ($fileSize > 10 * 1024 * 1024) {
    jsonResponse(false, null, 'File too large (Max 10MB)');
}

$cleanOrig = preg_replace('/[^a-zA-Z0-9._-]/', '', $fileName) ?: ('image.' . $fileExt);
$uniqueName = uniqid() . '_' . $cleanOrig;
$destination = $uploadDir . $uniqueName;
$publicUrl = $baseUrl . $uniqueName;

if (move_uploaded_file($fileTmp, $destination)) {
    $thumbFile = ensureImageWebpThumb($destination, $thumbDir, $uniqueName, $fileExt);
    $thumbUrl = $thumbFile ? ($baseUrl . '_thumbs/' . $thumbFile) : $publicUrl;
    $now = time();
    invalidateLibraryCache($uploadDir);

    jsonResponse(true, [
        'name'        => $cleanOrig,
        'uniqueName'  => $uniqueName,
        'url'         => $publicUrl,
        'thumbUrl'    => $thumbUrl,
        'size'        => $fileSize,
        'type'        => $fileExt,
        'date'        => $now,
        'modified_at' => $now,
    ]);
} else {
    jsonResponse(false, null, 'Failed to move uploaded file');
}
