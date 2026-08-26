<?php
class UploadController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function handle(array $auth): void {
        $tid = $auth['tenant_id'];
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'DELETE' || (isset($_GET['_method']) && $_GET['_method'] === 'DELETE')) {
            $b = getBody();
            $fileUrl = $b['file_url'] ?? $_GET['file_url'] ?? null;
            if ($fileUrl && deleteServerFile($fileUrl)) {
                respond(200, null, 'Đã xóa tệp tin thành công khỏi hệ thống');
            }
            respond(200, null, 'Không tìm thấy tệp hoặc đã được xóa trước đó');
        }

        $fileKey = isset($_FILES['file']) ? 'file' : (isset($_FILES['avatar']) ? 'avatar' : null);
        if (!$fileKey) {
            respond(400, null, 'Không có file nào được tải lên');
        }

        $file = $_FILES[$fileKey];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(500, null, 'Lỗi upload file: ' . $file['error']);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $blockedExts = [
            'php', 'php3', 'php4', 'php5', 'phtml', 
            'js', 'ts', 'py', 'pl', 'sh', 'cgi', 'rb', 'go', 'c', 'cpp', 'java', 'h', 'cs', 'swift', 'kt', 'rs',
            'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'wsf', 'ps1', 'jar', 'apk', 'htaccess', 'config'
        ];

        if (in_array($ext, $blockedExts)) {
            respond(400, null, 'Định dạng file không hỗ trợ hoặc không an toàn', false);
        }

        // Kiểm tra nội dung file có chứa mã script hoặc PHP độc hại không
        $fileContent = @file_get_contents($file['tmp_name']);
        if ($fileContent !== false) {
            if (preg_match('/<\?php/i', $fileContent) || preg_match('/<\?=/i', $fileContent) || preg_match('/<script/i', $fileContent)) {
                respond(400, null, 'Nội dung file chứa mã độc hại nguy hiểm bị chặn', false);
            }
        }

        // Kiểm tra MIME type thực tế
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            
            $allowedMimes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
                'application/pdf',
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain', 'text/csv',
                'application/zip', 'application/x-rar-compressed', 'application/x-zip-compressed', 'application/octet-stream'
            ];
            
            if (!in_array($mime, $allowedMimes, true)) {
                respond(400, null, 'Định dạng MIME không được phép tải lên hệ thống', false);
            }
        }

        // Limit size to 10MB
        if ($file['size'] > 10 * 1024 * 1024) {
            respond(400, null, 'Dung lượng file quá lớn (tối đa 10MB)');
        }

        // Tenant-isolated storage directory
        $uploadDirBase = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
        $storageDir = $uploadDirBase . "/tenant_{$tid}/";
        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0755, true);
        }

        $filename = uniqid('img_', true) . '.' . $ext;
        $targetPath = $storageDir . $filename;

        require_once __DIR__ . '/../config/ImageHelper.php';
        $res = ImageHelper::saveUploadedFile($file['tmp_name'], $targetPath, $file['name']);

        if ($res['success']) {
            $savedFilename = $res['filename'];
            // Delete old file if requested
            $oldUrl = $_POST['previous_url'] ?? $_GET['previous_url'] ?? null;
            if ($oldUrl) {
                deleteServerFile($oldUrl);
            }

            // Return relative URL
            $url = "uploads/tenant_{$tid}/" . $savedFilename;
            respond(200, ['url' => $url], 'Tải lên thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên server');
        }
    }
}
