<?php
// api/upload.php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

// 1. SECURITY: Handle Authentication
// Required for any upload operation
$isStaffAdmin = !empty($_SESSION['is_admin']) || !empty($_SESSION['role']) && $_SESSION['role'] === 'admin';
$isOrgUser = !empty($_SESSION['org_user_id']) || !empty($GLOBALS['current_admin_id']);

// [FIX R3-C02] Validate Bearer token VALUE — not just its presence.
// Previously: any request with "Authorization: Bearer anything" bypassed auth check.
// Now: token must match a valid record in api_tokens table (or a server-configured env var).
$bearerAuthed = false;
$allHeaders = function_exists('getallheaders') ? getallheaders() : [];
$normalizedHeaders = array_change_key_case($allHeaders, CASE_LOWER);
$authHeader = $normalizedHeaders['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!empty($authHeader) && preg_match('/Bearer\s+(.+)$/i', $authHeader, $tokenMatch)) {
    $rawToken = trim($tokenMatch[1]);
    try {
        // Check against api_tokens table (scoped: only 'upload' or 'full_access' scope allowed)
        $stmtTok = $pdo->prepare(
            "SELECT id FROM api_tokens WHERE token = ? AND (scope = 'upload' OR scope = 'full_access') AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1"
        );
        $stmtTok->execute([hash('sha256', $rawToken)]);
        if ($stmtTok->fetchColumn()) {
            $bearerAuthed = true;
        } else {
            // Fallback: check against UPLOAD_API_TOKEN env var (for server-to-server)
            $envToken = getenv('UPLOAD_API_TOKEN');
            if ($envToken && hash_equals(hash('sha256', $envToken), hash('sha256', $rawToken))) {
                $bearerAuthed = true;
            }
        }
    } catch (Exception $e) {
        // DB error during token check — fail closed (reject)
        error_log('[upload.php] Bearer token DB check failed: ' . $e->getMessage());
    }
}

if (!$isStaffAdmin && !$isOrgUser && !$bearerAuthed) {
    http_response_code(401);
    jsonResponse(false, null, 'Unauthorized');
}

// 2. DYNAMIC BASE URL: No hardcoded domains
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
// Determine the base path of the app
$scriptPath = $_SERVER['SCRIPT_NAME'];
$apiPath = dirname($scriptPath); // e.g. /api
$rootPath = dirname($apiPath);   // e.g. /
$baseUrl = $protocol . $host . rtrim($rootPath, '/') . "/uploadss/";

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit(0);

// GET: Thư viện file — liệt kê tất cả file đã upload
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['route']) && $_GET['route'] === 'library') {
    $uploadDir = '../uploadss/';
    if (!is_dir($uploadDir)) {
        jsonResponse(true, []);
    }
    $baseUrl = $protocol . $host . rtrim($rootPath, '/') . "/uploadss/";

    $allowed = ['jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx','zip','txt','csv'];
    $files = [];
    try {
        foreach (new DirectoryIterator($uploadDir) as $f) {
            if ($f->isDot() || $f->isDir()) continue;
            $fn  = $f->getFilename();
        $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed)) continue;
        // Strip uniqid prefix (13 hex chars + _)
        $origName = preg_replace('/^[a-f0-9]{13}_/', '', $fn);
        $files[] = [
            'name'        => $origName,
            'uniqueName'  => $fn,
            'url'         => $baseUrl . $fn,
            'path'        => $uploadDir . $fn,
            'size'        => $f->getSize(),
            'type'        => $ext,
            'modified_at' => $f->getMTime(),
        ];
        }
    } catch (Exception $e) {
        error_log("DirectoryIterator error: " . $e->getMessage());
    }
    usort($files, fn($a, $b) => $b['modified_at'] - $a['modified_at']);
    jsonResponse(true, array_slice($files, 0, 300));
}

// DELETE (via GET với route=delete): Xóa file khỏi thư viện
if (isset($_GET['route']) && $_GET['route'] === 'delete') {
    $rawName  = $_GET['file'] ?? '';
    // SECURITY: chỉ lấy basename để ngăn path traversal (../, /, \)
    $safeName = basename($rawName);
    if (empty($safeName) || $safeName !== $rawName || strpbrk($safeName, '/\\') !== false) {
        jsonResponse(false, null, 'Tên file không hợp lệ');
    }
    $uploadDir = '../uploadss/';
    $filePath  = $uploadDir . $safeName;
    if (!file_exists($filePath)) {
        jsonResponse(false, null, 'File không tồn tại');
    }
    if (unlink($filePath)) {
        jsonResponse(true, ['deleted' => $safeName]);
    } else {
        jsonResponse(false, null, 'Không thể xóa file');
    }
}

// RENAME (via POST với route=rename): Đổi tên hiển thị của file
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['route']) && $_GET['route'] === 'rename') {
    $body       = json_decode(file_get_contents('php://input'), true);
    $uniqueName = basename($body['uniqueName'] ?? '');
    $newLabel   = trim($body['newName'] ?? '');

    // Security: validate uniqueName
    if (empty($uniqueName) || strpbrk($uniqueName, '/\\') !== false) {
        jsonResponse(false, null, 'Tên file không hợp lệ');
    }
    // Security: validate newLabel — only safe chars, no path separators
    if (empty($newLabel) || preg_match('/[\/\\\\<>:"|?*\x00-\x1f]/', $newLabel)) {
        jsonResponse(false, null, 'Tên mới không hợp lệ');
    }
    // Keep the original extension
    $origExt = strtolower(pathinfo($uniqueName, PATHINFO_EXTENSION));
    // Strip extension from newLabel if user typed it, then re-add correct one
    $newLabelBase = preg_replace('/\.[a-z0-9]{2,5}$/i', '', $newLabel);
    $safeLabelBase = preg_replace('/[^a-zA-Z0-9._\- ]/', '', $newLabelBase);
    if (empty($safeLabelBase)) {
        jsonResponse(false, null, 'Tên mới không hợp lệ sau khi làm sạch');
    }
    // Build new physical filename: keep uniqid prefix, replace display part
    $prefix = preg_match('/^[a-f0-9]{13}_/', $uniqueName, $m) ? $m[0] : '';
    $newUniqueName = $prefix . str_replace(' ', '_', $safeLabelBase) . '.' . $origExt;
    $newUniqueName = basename($newUniqueName); // extra traversal guard

    $uploadDir = '../uploadss/';
    $oldPath   = $uploadDir . $uniqueName;
    $newPath   = $uploadDir . $newUniqueName;

    if (!file_exists($oldPath)) {
        jsonResponse(false, null, 'File nguồn không tồn tại');
    }
    if ($oldPath === $newPath) {
        jsonResponse(true, ['uniqueName' => $newUniqueName, 'name' => $safeLabelBase . '.' . $origExt]);
    }
    if (file_exists($newPath)) {
        // Avoid collision: append timestamp
        $newUniqueName = $prefix . str_replace(' ', '_', $safeLabelBase) . '_' . time() . '.' . $origExt;
        $newPath = $uploadDir . $newUniqueName;
    }
    if (rename($oldPath, $newPath)) {
        $baseUrl = $protocol . $host . rtrim($rootPath, '/') . "/uploadss/";
        jsonResponse(true, [
            'uniqueName' => $newUniqueName,
            'name'       => $safeLabelBase . '.' . $origExt,
            'url'        => $baseUrl . $newUniqueName,
        ]);
    } else {
        jsonResponse(false, null, 'Không thể đổi tên file');
    }
}


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

if (!isset($_FILES['file'])) {
    jsonResponse(false, null, 'No file uploaded');
}

$file = $_FILES['file'];
$uploadDir = '../uploadss/'; // Folder nằm ngoài thư mục api một cấp
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Security Check
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'csv', 'webp'];
$fileName = $file['name'];
$fileSize = $file['size'];
$fileTmp = $file['tmp_name'];

// [FIX P16-B3] Null-byte guard: "shell.php\0.jpg" → pathinfo() sees ".jpg" but storage sees "shell.php"
if (strpos($fileName, "\0") !== false) {
    jsonResponse(false, null, 'Invalid filename');
}

$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

if (!in_array($fileExt, $allowedExts)) {
    jsonResponse(false, null, 'File type not allowed');
}

// [FIX P16-B3] MIME type validation — extension alone can be faked.
// Verify actual file content matches allowed types.
$allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',                                                            // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',      // .docx
    'application/vnd.ms-excel',                                                     // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',            // .xlsx
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv', 'application/csv',
    'application/octet-stream', // fallback for some docx/xlsx on older systems
];
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $detectedMime = finfo_file($finfo, $fileTmp);
    finfo_close($finfo);
    if (!in_array($detectedMime, $allowedMimes)) {
        jsonResponse(false, null, 'File content does not match allowed types (' . $detectedMime . ')');
    }
}

if ($fileSize > 10 * 1024 * 1024) { // 10MB Limit
    jsonResponse(false, null, 'File too large (Max 10MB)');
}

// Generate unique name but keep original name for logic matching
$uniqueName = uniqid() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $fileName);
$destination = $uploadDir . $uniqueName;

// Use centralized $baseUrl defined at top
$publicUrl = $baseUrl . $uniqueName;

if (move_uploaded_file($fileTmp, $destination)) {
    jsonResponse(true, [
        'name' => $fileName,
        'url' => $publicUrl,
        'size' => $fileSize,
        'type' => $fileExt,
        // [FIX R3-C03] Removed 'path' field — internal server path (e.g. ../uploadss/abc.jpg)
        // was being returned to client, leaking filesystem structure to authenticated callers.
    ]);
} else {
    jsonResponse(false, null, 'Failed to move uploaded file');
}
?>
