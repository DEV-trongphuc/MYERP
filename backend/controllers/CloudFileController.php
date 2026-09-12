<?php
class CloudFileController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
    }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $uid    = $auth['user_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(100, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $cat    = $_GET['category'] ?? '';
        $contactId = $_GET['contact_id'] ?? '';
        $projectId = $_GET['project_id'] ?? '';
        $campaignId = $_GET['campaign_id'] ?? '';

        $role = $auth['role'] ?? '';
        $isSale = $role === 'sales' || $role === 'sale';
        $visibility = $_GET['visibility'] ?? 'shared';

        $where = ["cf.tenant_id = ?"];
        $params = [$tid];

        if ($cat) {
            $where[] = "cf.category = ?";
            $params[] = $cat;
        }

        if ($contactId !== '') {
            $where[] = "cf.contact_id = ?";
            $params[] = (int)$contactId;
        } else {
            $where[] = "cf.contact_id IS NULL AND cf.category != 'Đặt cọc' AND cf.category != 'coop_proof'";
            if ($visibility === 'personal') {
                $where[] = "cf.visibility = 'personal'";
                $where[] = "cf.uploaded_by = ?";
                $params[] = $uid;
            } else {
                $where[] = "(cf.visibility = 'shared' OR cf.visibility IS NULL OR cf.visibility = '')";
                if ($isSale) {
                    $where[] = "(
                        cf.uploaded_by = ? 
                        OR (
                            cf.category NOT LIKE 'consultant_%' 
                            OR cf.category = ?
                        )
                    )";
                    $params[] = $uid;
                    $params[] = 'consultant_' . $uid;
                }
            }
        }

        if ($projectId !== '') {
            $where[] = "cf.project_id = ?";
            $params[] = (int)$projectId;
        }

        if ($campaignId !== '') {
            $where[] = "cf.campaign_id = ?";
            $params[] = (int)$campaignId;
        }

        $w = implode(' AND ', $where);

        $cnt = $this->db->prepare("SELECT COUNT(*) FROM cloud_files cf WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT cf.*, u.full_name as uploader_name, u2.full_name as editor_name, p.name as project_name, mc.name as campaign_name
            FROM cloud_files cf
            LEFT JOIN users u ON cf.uploaded_by = u.id
            LEFT JOIN users u2 ON cf.updated_by = u2.id
            LEFT JOIN projects p ON cf.project_id = p.id
            LEFT JOIN marketing_campaigns mc ON cf.campaign_id = mc.id
            WHERE $w
            ORDER BY cf.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        
        $totalSizeBytes = 0;
        if ($contactId === '' && $projectId === '' && $campaignId === '') {
            $sumStmt = $this->db->prepare("SELECT SUM(file_size) FROM cloud_files WHERE tenant_id = ?");
            $sumStmt->execute([$tid]);
            $totalSizeBytes = (int)$sumStmt->fetchColumn();
        }

        respond(200, [
            'items' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_size_bytes' => $totalSizeBytes
        ]);
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        
        $b = getBody();
        $category = $_POST['category'] ?? $b['category'] ?? 'general';
        if (in_array($auth['role'], ['sales', 'sale'], true) && strpos($category, 'consultant_') === 0) {
            if ($category !== 'consultant_' . $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền tải lên tài liệu nhân sự của người khác (consultant_*)', false);
            }
        }

        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $name = $_POST['name'] ?? $b['name'] ?? null;
        $visibility = $_POST['visibility'] ?? $b['visibility'] ?? 'shared';
        $project_id = isset($_POST['project_id']) && $_POST['project_id'] !== '' ? (int)$_POST['project_id'] : (isset($b['project_id']) && $b['project_id'] !== '' ? (int)$b['project_id'] : null);
        $contact_id = isset($_POST['contact_id']) && $_POST['contact_id'] !== '' ? (int)$_POST['contact_id'] : (isset($b['contact_id']) && $b['contact_id'] !== '' ? (int)$b['contact_id'] : null);
        $campaign_id = isset($_POST['campaign_id']) && $_POST['campaign_id'] !== '' ? (int)$_POST['campaign_id'] : (isset($b['campaign_id']) && $b['campaign_id'] !== '' ? (int)$b['campaign_id'] : null);

        $isLink = (int)($_POST['is_link'] ?? $b['is_link'] ?? 0) === 1;
        $linkUrl = $_POST['link_url'] ?? $b['link_url'] ?? '';

        if ($isLink) {
            if (empty($linkUrl)) respond(422, null, 'Vui lòng nhập đường dẫn liên kết', false);
            if (empty($name)) respond(422, null, 'Vui lòng nhập tên liên kết', false);

            // Save to DB
            $stmt = $this->db->prepare("
                INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility, project_id, contact_id, campaign_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $tid, $uid, $name,
                $linkUrl, 'link', 0,
                $category, $visibility, $project_id, $contact_id, $campaign_id
            ]);
        } else {
            if (empty($_FILES['file'])) respond(422, null, 'Vui lòng chọn tệp tin để tải lên', false);
            
            $file = $_FILES['file'];
            if ($file['error'] !== UPLOAD_ERR_OK) respond(500, null, 'Lỗi trong quá trình tải tệp lên server', false);

            // Security: Max file size 50MB
            if ($file['size'] > 50 * 1024 * 1024) respond(422, null, 'Dung lượng tệp tối đa cho phép là 50MB', false);

            // Security: Blocklist extensions
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $blockedExts = [
                'php', 'php3', 'php4', 'php5', 'phtml', 
                'js', 'ts', 'py', 'pl', 'sh', 'cgi', 'rb', 'go', 'c', 'cpp', 'java', 'h', 'cs', 'swift', 'kt', 'rs',
                'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'wsf', 'ps1', 'jar', 'apk', 'htaccess', 'config'
            ];
            if (in_array($ext, $blockedExts)) respond(422, null, "Định dạng tệp .$ext không được hỗ trợ hoặc không an toàn", false);

            $isBinaryImage = in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
            if ($isBinaryImage) {
                if (!@getimagesize($file['tmp_name'])) {
                    respond(422, null, 'File ảnh không hợp lệ hoặc bị hỏng', false);
                }
            } else {
                $fileContent = @file_get_contents($file['tmp_name']);
                if ($fileContent !== false) {
                    if (preg_match('/<\?php/i', $fileContent) || preg_match('/<script/i', $fileContent)) {
                        respond(422, null, 'Nội dung file chứa mã độc hại nguy hiểm bị chặn', false);
                    }
                }
            }

            // Kiểm tra MIME type thực tế bằng finfo
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
                    respond(422, null, 'Định dạng MIME không được phép tải lên hệ thống', false);
                }
            }

            if (empty($name)) {
                $name = $file['name'];
            }

            // 1. Prepare directory
            $targetDir = UPLOAD_DIR . "/cloud/$tid";
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0755, true);
            }

            // 2. Sanitize and prepare file path
            $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($name, PATHINFO_FILENAME));
            $fileName = time() . '_' . $safeName . '.' . $ext;
            $targetPath = $targetDir . '/' . $fileName;
            // 3. Move file with automatic WebP compression for images
            require_once __DIR__ . '/../config/ImageHelper.php';
            $res = ImageHelper::saveUploadedFile($file['tmp_name'], $targetPath, $file['name']);
            if (!$res['success']) {
                respond(500, null, 'Không thể lưu tệp tin vào thư mục đích', false);
            }
            $fileName = $res['filename'];
            $dbPath = "uploads/cloud/$tid/$fileName";

            // 4. Save to DB
            $stmt = $this->db->prepare("
                INSERT INTO cloud_files (tenant_id, uploaded_by, name, file_path, mime_type, file_size, category, visibility, project_id, contact_id, campaign_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $tid, $uid, $name,
                $dbPath, $file['type'], $file['size'],
                $category, $visibility, $project_id, $contact_id, $campaign_id
            ]);
        }

        // Auto notification for contact document upload
        if ($contact_id) {
            $stmtOwner = $this->db->prepare("SELECT owner_id, full_name as contact_name FROM contacts WHERE id = ? AND tenant_id = ?");
            $stmtOwner->execute([$contact_id, $tid]);
            $contactInfo = $stmtOwner->fetch();
            if ($contactInfo) {
                $ownerId = (int)$contactInfo['owner_id'];
                $contactName = $contactInfo['contact_name'];
                
                // Get uploader name
                $uploaderName = 'Hệ thống';
                $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtUser->execute([$uid]);
                $uRow = $stmtUser->fetch();
                if ($uRow && !empty($uRow['full_name'])) {
                    $uploaderName = $uRow['full_name'];
                }

                $notifyUids = [];
                if ($ownerId > 0 && $ownerId !== $uid) {
                    $notifyUids[] = $ownerId;
                }
                
                // Also notify managers of the owner's team
                if ($ownerId > 0) {
                    $stmtMgr = $this->db->prepare("
                        SELECT leader_id FROM teams 
                        WHERE id = (SELECT team_id FROM users WHERE id = ?) 
                          AND leader_id IS NOT NULL 
                          AND leader_id != ?
                    ");
                    $stmtMgr->execute([$ownerId, $uid]);
                    $mgrId = $stmtMgr->fetchColumn();
                    if ($mgrId) {
                        $notifyUids[] = (int)$mgrId;
                    }
                }

                $notifyUids = array_unique($notifyUids);
                if (!empty($notifyUids)) {
                    $link = "/contacts?open_contact_id=$contact_id";
                    foreach ($notifyUids as $nUid) {
                        // Check if an unread notification for the same contact from the same uploader exists in the last 30 minutes
                        $chkStmt = $this->db->prepare("
                            SELECT id, title, body 
                            FROM notifications 
                            WHERE user_id = ? 
                              AND tenant_id = ? 
                              AND type = 'contact_document' 
                              AND link = ? 
                              AND is_read = 0 
                              AND body LIKE ? 
                              AND created_at >= (NOW() - INTERVAL 30 MINUTE)
                            ORDER BY id DESC 
                            LIMIT 1
                        ");
                        $chkStmt->execute([$nUid, $tid, $link, "$uploaderName%"]);
                        $existing = $chkStmt->fetch(\PDO::FETCH_ASSOC);

                        if ($existing) {
                            $count = 2;
                            if (preg_match('/tải lên\s+(\d+)\s+tài liệu/ui', $existing['body'], $m)) {
                                $count = (int)$m[1] + 1;
                            }
                            $title = "Tài liệu khách hàng mới ($count tệp)";
                            $body = "$uploaderName đã tải lên $count tài liệu mới cho khách hàng $contactName (gần nhất: \"$name\")";

                            $updStmt = $this->db->prepare("
                                UPDATE notifications 
                                SET title = ?, body = ?, is_read = 0, created_at = NOW() 
                                WHERE id = ?
                            ");
                            $updStmt->execute([$title, $body, $existing['id']]);
                        } else {
                            $title = "Tài liệu khách hàng mới";
                            $body = "$uploaderName đã tải lên tài liệu mới \"$name\" cho khách hàng $contactName";
                            $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'contact_document', ?)");
                            $stmtNotif->execute([$nUid, $tid, $title, $body, $link]);
                        }
                    }
                }
            }
        }

        // Auto notification for consultant document upload
        if (strpos($category, 'consultant_') === 0) {
            $targetUserId = (int) substr($category, strlen('consultant_'));
            if ($targetUserId > 0) {
                // Get uploader name
                $uploaderName = 'Hệ thống';
                $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtUser->execute([$uid]);
                $uRow = $stmtUser->fetch();
                if ($uRow && !empty($uRow['full_name'])) {
                    $uploaderName = $uRow['full_name'];
                }
                
                // Get target user details to verify
                $stmtTarget = $this->db->prepare("SELECT id FROM users WHERE id = ?");
                $stmtTarget->execute([$targetUserId]);
                $targetExists = $stmtTarget->fetch();
                if ($targetExists) {
                    $link = '/account';
                    $chkStmt = $this->db->prepare("
                        SELECT id, title, body 
                        FROM notifications 
                        WHERE user_id = ? 
                          AND tenant_id = ? 
                          AND type = 'mention' 
                          AND link = ? 
                          AND is_read = 0 
                          AND title LIKE 'Tài liệu nhân sự mới%'
                          AND created_at >= (NOW() - INTERVAL 30 MINUTE)
                        ORDER BY id DESC 
                        LIMIT 1
                    ");
                    $chkStmt->execute([$targetUserId, $tid, $link]);
                    $existing = $chkStmt->fetch(\PDO::FETCH_ASSOC);

                    if ($existing) {
                        $count = 2;
                        if (preg_match('/tải lên\s+(\d+)\s+tài liệu/ui', $existing['body'], $m)) {
                            $count = (int)$m[1] + 1;
                        }
                        $title = "Tài liệu nhân sự mới đã được tải lên ($count tệp)";
                        if ($uid === $targetUserId) {
                            $body = "Bạn đã tải lên $count tài liệu mới (gần nhất: \"$name\")";
                        } else {
                            $body = "$uploaderName đã tải lên $count tài liệu mới cho bạn (gần nhất: \"$name\")";
                        }
                        $updStmt = $this->db->prepare("UPDATE notifications SET title = ?, body = ?, is_read = 0, created_at = NOW() WHERE id = ?");
                        $updStmt->execute([$title, $body, $existing['id']]);
                    } else {
                        $title = "Tài liệu nhân sự mới đã được tải lên";
                        if ($uid === $targetUserId) {
                            $body = "Bạn đã tải lên tài liệu mới: \"$name\"";
                        } else {
                            $body = "$uploaderName đã tải lên tài liệu mới cho bạn: \"$name\"";
                        }
                        
                        // Insert notification
                        $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'mention', ?)");
                        $stmtNotif->execute([$targetUserId, $tid, $title, $body, $link]);
                    }
                }
            }
        }

        respond(201, ['id' => $this->db->lastInsertId(), 'path' => $dbPath], 'Đã tải tệp tin lên thành công');
    }

    public function update(array $auth, int $id): void {
        $tid = $auth['tenant_id'];
        $b = getBody();
        
        $name = trim($b['name'] ?? '');

        if (!$name) {
            respond(422, null, 'Tên tệp là bắt buộc', false);
        }

        // Permission check: Only uploader or admin/manager
        $checkStmt = $this->db->prepare("SELECT name, uploaded_by, category, visibility, project_id, campaign_id FROM cloud_files WHERE id = ? AND tenant_id = ?");
        $checkStmt->execute([$id, $tid]);
        $file = $checkStmt->fetch();
        if (!$file) respond(404, null, 'Không tìm thấy tệp tin', false);

        $category = isset($b['category']) ? trim($b['category']) : ($file['category'] ?? 'general');
        $visibility = isset($b['visibility']) ? trim($b['visibility']) : ($file['visibility'] ?? 'shared');
        $project_id = isset($b['project_id']) ? ($b['project_id'] !== '' ? (int)$b['project_id'] : null) : ($file['project_id'] ?? null);
        $campaign_id = isset($b['campaign_id']) ? ($b['campaign_id'] !== '' ? (int)$b['campaign_id'] : null) : ($file['campaign_id'] ?? null);

        // Enforce original extension
        $origExt = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!empty($origExt)) {
            $newExt = pathinfo($name, PATHINFO_EXTENSION);
            if (strtolower($newExt) !== strtolower($origExt)) {
                $name .= '.' . $origExt;
            }
        }

        if (in_array($auth['role'], ['sales', 'sale'], true)) {
            if ((int)$file['uploaded_by'] !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn không có quyền sửa thông tin tệp tin của người khác', false);
            }
            if (
                (strpos($category, 'consultant_') === 0 && $category !== 'consultant_' . $auth['user_id']) || 
                ($file['category'] && strpos($file['category'], 'consultant_') === 0 && $file['category'] !== 'consultant_' . $auth['user_id'])
            ) {
                respond(403, null, 'Bạn không có quyền cập nhật tài liệu nhân sự (consultant_*)', false);
            }
        }

        $stmt = $this->db->prepare("
            UPDATE cloud_files 
            SET name = ?, category = ?, visibility = ?, project_id = ?, campaign_id = ?, updated_by = ?
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$name, $category, $visibility, $project_id, $campaign_id, $auth['user_id'], $id, $tid]);

        respond(200, null, 'Cập nhật thông tin tệp thành công');
    }

    public function destroy(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $tid = $auth['tenant_id'];
        
        // 1. Get file details first
        $stmt = $this->db->prepare("SELECT file_path, uploaded_by, category FROM cloud_files WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tid]);
        $file = $stmt->fetch();
        
        if (!$file) respond(404, null, 'Không tìm thấy tệp tin', false);

        // Permission check: Only uploader or admin/manager
        if (in_array($auth['role'], ['sales', 'sale'], true)) {
            if ((int)$file['uploaded_by'] !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn không có quyền xóa tệp tin của người khác', false);
            }
            if (strpos($file['category'], 'consultant_') === 0 && $file['category'] !== 'consultant_' . $auth['user_id']) {
                respond(403, null, 'Bạn không có quyền xóa tài liệu nhân sự (consultant_*)', false);
            }
        }
        $path = $file['file_path'];

        // 2. Delete from DB
        $this->db->prepare("DELETE FROM cloud_files WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);

        // 3. Delete physical file from disk
        deleteServerFile($path);

        respond(200, null, 'Đã xóa tệp tin vĩnh viễn');
    }

    public function downloadContactZip(array $auth, int $contactId): void {
        $tid = (int)$auth['tenant_id'];
        if ($contactId <= 0) {
            respond(400, null, 'ID khách hàng không hợp lệ', false);
        }

        // 1. Check contact exists
        $stmtContact = $this->db->prepare("SELECT id, full_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtContact->execute([$contactId, $tid]);
        $contact = $stmtContact->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Không tìm thấy thông tin khách hàng', false);
        }

        // 2. Collect files
        $filesToZip = [];

        // 2a. Files from cloud_files
        $stmtFiles = $this->db->prepare("SELECT id, name, file_path, category FROM cloud_files WHERE contact_id = ? AND tenant_id = ?");
        $stmtFiles->execute([$contactId, $tid]);
        $cloudFiles = $stmtFiles->fetchAll(PDO::FETCH_ASSOC);
        foreach ($cloudFiles as $cf) {
            $filesToZip[] = [
                'name' => $cf['name'] ?: basename($cf['file_path']),
                'path' => $cf['file_path'],
                'folder' => (!empty($cf['category']) && $cf['category'] !== 'general') ? $cf['category'] : 'Tài liệu chung'
            ];
        }

        // 2b. Deposits UNC proofs
        try {
            $stmtMilestones = $this->db->prepare("
                SELECT m.id, m.milestone_name as name, m.unc_file_path 
                FROM deposit_milestones m 
                JOIN deposits d ON m.deposit_id = d.id 
                WHERE d.contact_id = ? AND (m.unc_file_path IS NOT NULL AND m.unc_file_path != '')
            ");
            $stmtMilestones->execute([$contactId]);
            $milestones = $stmtMilestones->fetchAll(PDO::FETCH_ASSOC);
            foreach ($milestones as $ms) {
                $filesToZip[] = [
                    'name' => basename($ms['unc_file_path']),
                    'path' => $ms['unc_file_path'],
                    'folder' => 'Chứng từ thanh toán & UNC'
                ];
            }
        } catch (Throwable $e) {}

        // 2c. Cooperation slips attachments
        try {
            $stmtCoop = $this->db->prepare("SELECT attachment_url FROM cooperation_slips WHERE contact_id = ? AND (attachment_url IS NOT NULL AND attachment_url != '')");
            $stmtCoop->execute([$contactId]);
            $coopSlips = $stmtCoop->fetchAll(PDO::FETCH_ASSOC);
            foreach ($coopSlips as $cs) {
                if (!empty($cs['attachment_url'])) {
                    $urls = array_filter(array_map('trim', explode(',', $cs['attachment_url'])));
                    foreach ($urls as $u) {
                        $filesToZip[] = [
                            'name' => basename($u),
                            'path' => $u,
                            'folder' => 'Tài liệu Hợp tác & Hoa hồng'
                        ];
                    }
                }
            }
        } catch (Throwable $e) {}

        if (empty($filesToZip)) {
            respond(404, null, 'Khách hàng này hiện chưa có tài liệu nào để nén và tải về', false);
        }

        if (!class_exists('ZipArchive')) {
            respond(500, null, 'Hệ thống máy chủ chưa bật thư viện ZipArchive PHP', false);
        }

        $safeCustomerName = preg_replace('/[^\p{L}\p{N}\s_-]/u', '', $contact['full_name'] ?? 'Khach_hang');
        $safeCustomerName = trim(preg_replace('/\s+/', ' ', $safeCustomerName));
        if (empty($safeCustomerName)) $safeCustomerName = 'Khach_hang_' . $contactId;

        $zipFileName = $safeCustomerName . ' - Ho so tai lieu.zip';
        $tmpZip = tempnam(sys_get_temp_dir(), 'ct_zip_');
        $zip = new ZipArchive();
        if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            respond(500, null, 'Không thể khởi tạo tập tin ZIP trên máy chủ', false);
        }

        $baseUploadDir = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
        $addedCount = 0;
        $seenPaths = [];

        foreach ($filesToZip as $f) {
            $p = $f['path'];
            if (empty($p) || isset($seenPaths[$p])) continue;
            $seenPaths[$p] = true;

            // Resolve physical path
            $cleanRel = ltrim(str_replace(['/uploads/', 'uploads/'], '', $p), '/\\');
            $candidates = [
                rtrim($baseUploadDir, '/\\') . '/' . $cleanRel,
                __DIR__ . '/../' . ltrim($p, '/\\'),
                __DIR__ . '/../../' . ltrim($p, '/\\'),
                rtrim($baseUploadDir, '/\\') . '/' . basename($p)
            ];

            $resolvedFile = null;
            foreach ($candidates as $cand) {
                if (file_exists($cand) && is_file($cand)) {
                    $resolvedFile = $cand;
                    break;
                }
            }

            if ($resolvedFile) {
                $folder = trim($f['folder'] ?? '', '/\\');
                $origName = $f['name'] ?: basename($resolvedFile);
                $isWebp = strtolower(pathinfo($origName, PATHINFO_EXTENSION)) === 'webp' || strtolower(pathinfo($resolvedFile, PATHINFO_EXTENSION)) === 'webp';

                // Automatically convert WebP to JPG when downloading
                if ($isWebp && function_exists('imagecreatefromstring') && function_exists('imagejpeg')) {
                    try {
                        $raw = @file_get_contents($resolvedFile);
                        if ($raw) {
                            $img = @imagecreatefromstring($raw);
                            if ($img) {
                                $w = imagesx($img);
                                $h = imagesy($img);
                                $canvas = imagecreatetruecolor($w, $h);
                                $white = imagecolorallocate($canvas, 255, 255, 255);
                                imagefilledrectangle($canvas, 0, 0, $w, $h, $white);
                                imagecopy($canvas, $img, 0, 0, 0, 0, $w, $h);

                                $tmpJpg = tempnam(sys_get_temp_dir(), 'zip_jpg_');
                                imagejpeg($canvas, $tmpJpg, 92);
                                imagedestroy($canvas);
                                imagedestroy($img);

                                $jpgName = preg_replace('/\.webp$/i', '.jpg', $origName);
                                $zipEntry = ($folder ? $folder . '/' : '') . $jpgName;
                                $zip->addFile($tmpJpg, $zipEntry);
                                $addedCount++;
                                $tmpJpgFiles[] = $tmpJpg;
                                continue;
                            }
                        }
                    } catch (\Throwable $convEx) {}
                }

                $zipEntry = ($folder ? $folder . '/' : '') . $origName;
                $zip->addFile($resolvedFile, $zipEntry);
                $addedCount++;
            }
        }

        $zip->close();

        // Clean up temporary converted JPG files
        if (!empty($tmpJpgFiles)) {
            foreach ($tmpJpgFiles as $tj) {
                @unlink($tj);
            }
        }

        if ($addedCount === 0) {
            @unlink($tmpZip);
            respond(404, null, 'Không tìm thấy tệp vật lý nào trên máy chủ để nén', false);
        }

        // Send ZIP download
        while (ob_get_level()) { ob_end_clean(); }
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . rawurlencode($zipFileName) . '"; filename*=UTF-8\'\'' . rawurlencode($zipFileName));
        header('Content-Length: ' . filesize($tmpZip));
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        readfile($tmpZip);
        @unlink($tmpZip);
        exit;
    }

    public function extractIdDocument(array $auth): void {
        $tid = $auth['tenant_id'];
        $b = getBody();
        $fileId = isset($b['file_id']) ? (int)$b['file_id'] : 0;
        $fileUrl = $b['file_url'] ?? '';

        $localPath = null;
        $originalFileName = '';

        if ($fileId > 0) {
            $stmt = $this->db->prepare("SELECT id, name, file_path, mime_type FROM cloud_files WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$fileId, $tid]);
            $fileRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$fileRow) {
                respond(404, null, 'Không tìm thấy tệp tài liệu trong hệ thống', false);
            }
            $originalFileName = $fileRow['name'];
            $relPath = $fileRow['file_path'];
            $candidates = [
                __DIR__ . '/../' . $relPath,
                __DIR__ . '/../../' . $relPath,
                $_SERVER['DOCUMENT_ROOT'] . '/' . $relPath,
                (defined('UPLOAD_DIR') ? UPLOAD_DIR : __DIR__ . '/../uploads') . '/' . str_replace('uploads/', '', $relPath),
                (defined('UPLOAD_DIR') ? UPLOAD_DIR : __DIR__ . '/../uploads') . '/' . $relPath
            ];
            foreach ($candidates as $cand) {
                if (file_exists($cand) && is_file($cand)) {
                    $localPath = $cand;
                    break;
                }
            }
        } elseif (!empty($fileUrl)) {
            $parsed = parse_url($fileUrl, PHP_URL_PATH);
            $parsed = ltrim($parsed, '/');
            $originalFileName = basename($parsed);
            $candidates = [
                __DIR__ . '/../' . $parsed,
                __DIR__ . '/../../' . $parsed,
                $_SERVER['DOCUMENT_ROOT'] . '/' . $parsed,
                (defined('UPLOAD_DIR') ? UPLOAD_DIR : __DIR__ . '/../uploads') . '/' . str_replace('uploads/', '', $parsed),
                (defined('UPLOAD_DIR') ? UPLOAD_DIR : __DIR__ . '/../uploads') . '/' . $parsed
            ];
            foreach ($candidates as $cand) {
                if (file_exists($cand) && is_file($cand)) {
                    $localPath = $cand;
                    break;
                }
            }
        }

        if (!$localPath || !file_exists($localPath)) {
            respond(404, null, 'Tệp tin không tồn tại trên máy chủ hoặc không thể đọc được', false);
        }

        // Kiểm tra extension
        $ext = strtolower(pathinfo($localPath, PATHINFO_EXTENSION));
        $allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        if (!in_array($ext, $allowedExts)) {
            respond(422, null, 'Định dạng tệp không hợp lệ. Chỉ chấp nhận tệp hình ảnh (JPG, PNG, WEBP) hoặc PDF.', false);
        }

        // Xác định mimeType
        $mimeType = 'image/jpeg';
        if ($ext === 'pdf') {
            $mimeType = 'application/pdf';
        } elseif ($ext === 'png') {
            $mimeType = 'image/png';
        } elseif ($ext === 'webp') {
            $mimeType = 'image/webp';
        }

        // Lấy Gemini API key
        require_once __DIR__ . '/../db_connect.php';
        $apiKey = function_exists('get_system_setting') ? get_system_setting($this->db, 'gemini_api_key') : null;
        if (empty($apiKey)) {
            $apiKey = getenv('GEMINI_API_KEY') ?: '';
        }
        if (empty($apiKey)) {
            respond(500, null, 'Hệ thống chưa cấu hình Gemini API Key trong Cài đặt hệ thống. Vui lòng kiểm tra lại.', false);
        }

        // Đọc nội dung file
        $fileBytes = file_get_contents($localPath);
        if (empty($fileBytes)) {
            respond(422, null, 'Không thể đọc nội dung tệp tin (tệp rỗng).', false);
        }
        $base64 = base64_encode($fileBytes);

        // Prompt hướng dẫn Gemini
        $prompt = <<<EOT
Bạn là chuyên gia phân tích và trích xuất tài liệu tùy thân (OCR & Document AI) của hệ thống ERP.
Nhiệm vụ của bạn:
1. Xác định xem tài liệu trong ảnh/PDF này CÓ PHẢI là Căn cước công dân (CCCD), Chứng minh nhân dân (CMND) hoặc Hộ chiếu (Passport) hay KHÔNG.
- NẾU KHÔNG PHẢI là CCCD/CMND hoặc Hộ chiếu (ví dụ: là hợp đồng, hóa đơn, bằng cấp, bảng điểm, CV, chứng chỉ, giấy báo điểm, ảnh chân dung thường, phong cảnh, biên lai...):
  Trả về JSON:
  {
    "is_valid": false,
    "document_type": "invalid",
    "invalid_reason": "Tài liệu này không phải là CCCD hoặc Hộ chiếu (Passport). Vui lòng chọn đúng tệp ảnh hoặc PDF của CCCD hoặc Hộ chiếu."
  }
- NẾU ĐÚNG là CCCD/CMND hoặc Hộ chiếu (Passport):
  Trích xuất và chuẩn hóa tất cả các trường sau:
  {
    "is_valid": true,
    "document_type": "passport" HOẶC "cccd",
    "surname": "Họ / Surname ghi trên tài liệu (ví dụ: NGUYỄN)",
    "given_names": "Chữ đệm và tên / Given names ghi trên tài liệu (ví dụ: THỊ DUYÊN ANH)",
    "full_name": "Họ và tên viết IN HOA theo chuẩn Việt Nam: BẮT BUỘC HỌ ĐỨNG TRƯỚC (Ví dụ: Họ là NGUYỄN, Chữ đệm và tên là THỊ DUYÊN ANH thì full_name BẮT BUỘC PHẢI LÀ 'NGUYỄN THỊ DUYÊN ANH', TUYỆT ĐỐI KHÔNG ĐƯỢC đảo họ ra sau thành 'THỊ DUYÊN ANH NGUYỄN')",
    "citizen_id": "Số định danh cá nhân / Số CCCD / Số CMND (chỉ số, nếu có)",
    "passport": "Số hộ chiếu / Passport No (ví dụ: C1234567, nếu là passport hoặc có ghi trên tài liệu)",
    "birthday": "Ngày sinh định dạng chuẩn DD/MM/YYYY (ví dụ: 03/08/1980)",
    "gender": "male hoặc female (nếu là Nam ghi 'male', Nữ ghi 'female')",
    "nationality": "Quốc tịch (ví dụ: Việt Nam / VIETNAMESE)",
    "place_of_birth": "Nơi sinh",
    "place_of_origin": "Quê quán",
    "address": "Nơi thường trú / Địa chỉ cư trú đầy đủ nhất. Nếu giấy tờ không có địa chỉ thường trú (như Hộ chiếu/Passport), BẮT BUỘC lấy Nơi sinh hoặc Quê quán điền vào đây",
    "issue_date": "Ngày cấp định dạng DD/MM/YYYY (ví dụ: 30/09/2025)",
    "expiry_date": "Ngày hết hạn định dạng DD/MM/YYYY (ví dụ: 30/09/2035)",
    "issue_place": "Nơi cấp (ví dụ: Cục Cảnh sát QLHC về TTXH hoặc Cục Quản lý xuất nhập cảnh)"
  }

CHÚ Ý QUAN TRỌNG:
- Chỉ trả về duy nhất 1 chuỗi JSON hợp lệ.
- Không bọc trong markdown ```json ... ```, không thêm bất kỳ văn bản giải thích nào ngoài JSON.
EOT;

        $payload = [
            'contents' => [[
                'parts' => [
                    [
                        'inlineData' => [
                            'mimeType' => $mimeType,
                            'data' => $base64
                        ]
                    ],
                    [
                        'text' => $prompt
                    ]
                ]
            ]],
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'application/json'
            ]
        ];

        // Ưu tiên gemini-2.5-flash
        $model = function_exists('get_system_setting') ? (get_system_setting($this->db, 'gemini_model') ?: 'gemini-2.5-flash') : 'gemini-2.5-flash';
        if (strpos($model, 'embedding') !== false) {
            $model = 'gemini-2.5-flash';
        }
        $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . $apiKey;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if (!$response) {
            respond(500, null, 'Lỗi kết nối đến dịch vụ AI trích xuất: ' . $curlErr, false);
        }

        $resJson = json_decode($response, true);
        if ($httpCode !== 200) {
            $errDetail = $resJson['error']['message'] ?? 'Mã lỗi HTTP ' . $httpCode;
            respond(500, null, 'Lỗi từ Gemini AI: ' . $errDetail, false);
        }

        $rawText = $resJson['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $rawText = trim($rawText);
        $rawText = preg_replace('/^```json\s*/i', '', $rawText);
        $rawText = preg_replace('/\s*```$/', '', $rawText);
        $parsedData = json_decode($rawText, true);

        if (!$parsedData) {
            respond(500, null, 'Không thể giải mã dữ liệu trích xuất từ AI: ' . substr($rawText, 0, 150), false);
        }

        if (empty($parsedData['is_valid'])) {
            $reason = $parsedData['invalid_reason'] ?? 'Tài liệu không phải là CCCD hoặc Hộ chiếu (Passport) hợp lệ.';
            respond(422, [
                'is_valid' => false,
                'invalid_reason' => $reason,
                'raw_text' => $rawText
            ], $reason, false);
        }

        // Chuẩn hóa Họ và Tên: BẮT BUỘC HỌ đứng trước theo chuẩn tiếng Việt
        $surname = trim($parsedData['surname'] ?? '');
        $givenNames = trim($parsedData['given_names'] ?? '');
        if (!empty($surname) && !empty($givenNames)) {
            $parsedData['full_name'] = trim($surname . ' ' . $givenNames);
        }

        // Chuẩn hóa ngày sinh thành DD/MM/YYYY
        if (!empty($parsedData['birthday'])) {
            $bRaw = trim($parsedData['birthday']);
            if (preg_match('/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/', $bRaw, $m)) {
                $parsedData['birthday'] = sprintf('%02d/%02d/%04d', (int)$m[3], (int)$m[2], (int)$m[1]);
            }
        }

        // Chuẩn hóa các trường ngày cấp / ngày hết hạn
        foreach (['issue_date', 'expiry_date'] as $dateKey) {
            if (!empty($parsedData[$dateKey])) {
                $dRaw = trim($parsedData[$dateKey]);
                if (preg_match('/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/', $dRaw, $m)) {
                    $parsedData[$dateKey] = sprintf('%02d/%02d/%04d', (int)$m[3], (int)$m[2], (int)$m[1]);
                }
            }
        }

        // Nếu chưa có địa chỉ thì cập nhật bằng nơi sinh hoặc quê quán
        if (empty(trim($parsedData['address'] ?? ''))) {
            $fallbackAddr = trim($parsedData['place_of_birth'] ?? '');
            if (empty($fallbackAddr)) {
                $fallbackAddr = trim($parsedData['place_of_origin'] ?? '');
            }
            $parsedData['address'] = $fallbackAddr;
        }

        respond(200, [
            'is_valid' => true,
            'document_type' => $parsedData['document_type'] ?? 'passport',
            'data' => $parsedData,
            'file_name' => $originalFileName
        ], 'Trích xuất dữ liệu thành công');
    }
}

