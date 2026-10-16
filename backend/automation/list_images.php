<?php
// api/list_images.php

require_once 'db_connect.php';
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if (!function_exists('jsonResponse')) {
    function jsonResponse($success, $data = null, $message = '')
    {
        echo json_encode([
            'success' => $success,
            'data' => $data,
            'message' => $message
        ]);
        exit;
    }
}

$uploadDir = '../uploadss/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$files = scandir($uploadDir);
$images = [];

if ($files !== false) {

// Always use absolute URL for email and editor compatibility
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'];
if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
    $baseUrl = "https://automation.ideas.edu.vn/uploadss/";
} else {
    $baseUrl = $protocol . $host . "/uploadss/";
}

foreach ($files as $file) {
    if ($file === '.' || $file === '..')
        continue;

    $filePath = $uploadDir . $file;
    // Skip subdirectories (ai_generated, workspace_files, etc.)
    if (is_dir($filePath))
        continue;

    // Skip AI-generated images that may have been copied to root
    if (strpos($file, 'ai_gen_') === 0)
        continue;

    if (is_file($filePath)) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
            $images[] = [
                'name' => $file,
                'url' => $baseUrl . $file,
                'size' => filesize($filePath),
                'date' => filemtime($filePath)
            ];
        }
    }
}

} // End if files !== false
// Sort by date descending
usort($images, function ($a, $b) {
    return $b['date'] - $a['date'];
});

jsonResponse(true, $images);
?>
