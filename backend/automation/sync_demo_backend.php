<?php
// api/sync_demo_backend.php
// Script to sync backend files from production to demo folder to bypass SSH/git limits.

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'db_connect.php';

$token = $_GET['token'] ?? '';
if ($token !== ADMIN_BYPASS_TOKEN) {
    http_response_code(403);
    die("Unauthorized.");
}

$srcDir = __DIR__;
$destDir = '/home/vhvxoigh/open.domation.net/mail_api';

if (!is_dir($destDir)) {
    // Try to create it if it doesn't exist
    mkdir($destDir, 0755, true);
}

function copyFolder($src, $dst) {
    $dir = @opendir($src);
    if (!$dir) return;
    @mkdir($dst, 0755, true);
    while (false !== ($file = readdir($dir))) {
        if (($file != '.') && ($file != '..')) {
            // Skip hidden folders and dev archives
            if (strpos($file, '_') === 0 || strpos($file, '.') === 0) {
                continue;
            }
            if (is_dir($src . '/' . $file)) {
                copyFolder($src . '/' . $file, $dst . '/' . $file);
            } else {
                copy($src . '/' . $file, $dst . '/' . $file);
            }
        }
    }
    closedir($dir);
}

echo "Bắt đầu đồng bộ hóa backend từ: {$srcDir} sang: {$destDir}...\n\n";

try {
    copyFolder($srcDir, $destDir);
    echo "Đồng bộ hóa hoàn tất thành công!";
} catch (Throwable $e) {
    echo "Lỗi trong quá trình đồng bộ: " . $e->getMessage();
}
?>
