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

        $fileKey = isset($_FILES['file']) ? 'file' : (isset($_FILES['avatar']) ? 'avatar' : (!empty($_FILES) ? array_key_first($_FILES) : null));
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

        $isBinaryImage = in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
        if ($isBinaryImage) {
            // Xác thực là file ảnh hợp lệ thực tế, tránh false-positive do chuỗi byte nhị phân nén ngẫu nhiên
            if (!@getimagesize($file['tmp_name'])) {
                respond(400, null, 'File ảnh không hợp lệ hoặc bị hỏng', false);
            }
        } else {
            // Với các file khác (đặc biệt là svg, txt, csv, html,...), kiểm tra mã script độc hại
            $fileContent = @file_get_contents($file['tmp_name']);
            if ($fileContent !== false) {
                if (preg_match('/<\?php/i', $fileContent) || preg_match('/<script/i', $fileContent)) {
                    respond(400, null, 'Nội dung file chứa mã độc hại nguy hiểm bị chặn', false);
                }
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

        // Limit size to 50MB
        if ($file['size'] > 50 * 1024 * 1024) {
            respond(400, null, 'Dung lượng file quá lớn (tối đa 50MB)');
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

            // Return relative URL and original name
            $url = "uploads/tenant_{$tid}/" . $savedFilename;
            respond(200, ['url' => $url, 'name' => $file['name']], 'Tải lên thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên server');
        }
    }

    public function downloadFile(): void {
        $fileUrl = $_GET['url'] ?? $_GET['path'] ?? '';
        $fileName = $_GET['name'] ?? $_GET['filename'] ?? '';
        if (!$fileUrl) {
            respond(400, null, 'Thiếu đường dẫn tệp tin', false);
        }

        // Clean up URL/path
        $cleanPath = ltrim($fileUrl, '/');
        $parsed = parse_url($cleanPath, PHP_URL_PATH);
        if ($parsed) {
            $cleanPath = ltrim($parsed, '/');
        }
        if (strpos($cleanPath, 'backend/') === 0) {
            $cleanPath = substr($cleanPath, strlen('backend/'));
        }

        // Directory traversal protection
        if (strpos($cleanPath, '..') !== false) {
            respond(403, null, 'Đường dẫn không hợp lệ', false);
        }

        $uploadDirBase = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
        $fullPath = realpath(__DIR__ . '/../' . $cleanPath);
        if (!$fullPath || !file_exists($fullPath) || is_dir($fullPath)) {
            $testPath = realpath($uploadDirBase . '/' . basename($cleanPath));
            if ($testPath && file_exists($testPath) && !is_dir($testPath)) {
                $fullPath = $testPath;
            } else {
                respond(404, null, 'Không tìm thấy tệp tin trên máy chủ', false);
            }
        }

        $baseAllowed = realpath(__DIR__ . '/..');
        if (!$fullPath || strpos($fullPath, $baseAllowed) !== 0) {
            respond(403, null, 'Đường dẫn không hợp lệ', false);
        }

        if (!$fileName) {
            $fileName = basename($fullPath);
        }

        // Clean fileName
        $fileName = str_replace(["\r", "\n", '"', '/', '\\'], '', basename($fileName));

        $mime = 'application/octet-stream';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $detected = finfo_file($finfo, $fullPath);
                if ($detected) $mime = $detected;
                finfo_close($finfo);
            }
        }

        while (ob_get_level()) {
            ob_end_clean();
        }

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Expose-Headers: Content-Disposition, Content-Length');
        header('Content-Description: File Transfer');
        header('Content-Type: ' . $mime);

        $asciiFileName = preg_replace('/[^\x20-\x7E]/', '_', $fileName);
        $encodedFileName = rawurlencode($fileName);
        header('Content-Disposition: attachment; filename="' . addcslashes($asciiFileName, '"\\') . '"; filename*=UTF-8\'\'' . $encodedFileName);
        header('Content-Transfer-Encoding: binary');
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($fullPath));

        readfile($fullPath);
        exit;
    }
}
