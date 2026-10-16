<?php
/**
 * Zalo Audience API
 * Manage Zalo Lists, Subscribers, and Broadcast
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'zalo_helpers.php';

// CORS Headers

header('Content-Type: application/json');

// [SECURITY] Require authenticated workspace session — accesses Zalo OA credentials & subscriber data
// Exception: upload_image route is called during broadcast create (checked below), still needs auth
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

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

try {
    // --- GET METHODS ---
    if ($method === 'GET') {
        if ($route === 'lists') {
            $stmt = $pdo->prepare("
                SELECT zl.*, 
                (SELECT COUNT(*) FROM zalo_subscribers zs WHERE zs.zalo_list_id = zl.id AND zs.workspace_id = ?) as real_count,
                (SELECT COUNT(*) FROM zalo_subscribers zs WHERE zs.zalo_list_id = zl.id AND zs.is_follower = 1 AND zs.workspace_id = ?) as followed_count
                FROM zalo_lists zl
                WHERE zl.workspace_id = ?
                ORDER BY zl.created_at DESC
            ");
            $stmt->execute([$workspace_id, $workspace_id, $workspace_id]);
            jsonResponse(true, $stmt->fetchAll(PDO::FETCH_ASSOC));
        } elseif ($route === 'subscribers') {
            $listId = $_GET['list_id'] ?? '';
            if (!$listId)
                jsonResponse(false, null, "Thiếu ID danh sách");

            // Pagination
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $limit = isset($_GET['limit']) ? min(100, max(1, (int) $_GET['limit'])) : 20;
            $offset = ($page - 1) * $limit;

            // Get total count
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM zalo_subscribers WHERE zalo_list_id = ? AND workspace_id = ?");
            $stmtCount->execute([$listId, $workspace_id]);
            $total = (int) $stmtCount->fetchColumn();

            // Get paginated data
            $stmt = $pdo->prepare("SELECT * FROM zalo_subscribers WHERE zalo_list_id = ? AND workspace_id = ? ORDER BY last_interaction_at DESC LIMIT ? OFFSET ?");
            $stmt->execute([$listId, $workspace_id, $limit, $offset]);

            jsonResponse(true, $stmt->fetchAll(PDO::FETCH_ASSOC), '', ['total' => $total, 'page' => $page, 'limit' => $limit]);
        } elseif ($route === 'user_details') {
            $id = $_GET['id'] ?? '';
            if (!$id)
                jsonResponse(false, null, "Thiếu ID người dùng");
            $stmt = $pdo->prepare("SELECT * FROM zalo_subscribers WHERE id = ? AND workspace_id = ?");
            $stmt->execute([$id, $workspace_id]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$user)
                jsonResponse(false, null, "Không tìm thấy người dùng");
            $stmtMsg = $pdo->prepare("SELECT * FROM zalo_user_messages WHERE zalo_user_id = ? ORDER BY created_at DESC LIMIT 20");
            $stmtMsg->execute([$user['zalo_user_id']]);
            $user['messages'] = array_reverse($stmtMsg->fetchAll(PDO::FETCH_ASSOC));
            $stmtAct = $pdo->prepare("SELECT * FROM zalo_subscriber_activity WHERE subscriber_id = ? ORDER BY created_at DESC LIMIT 20");
            $stmtAct->execute([$id]);
            $user['activities'] = $stmtAct->fetchAll(PDO::FETCH_ASSOC);
            jsonResponse(true, $user);
        }
    }
    // --- POST METHODS ---
    elseif ($method === 'POST') {
        if ($route === 'update_user') {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? '';
            if (!$id)
                jsonResponse(false, null, "Thiếu ID người dùng");
            $name = $input['display_name'] ?? '';
            $gender = $input['gender'] ?? null;
            $birthday = $input['birthday'] ?? null;
            $phone = $input['phone'] ?? null;
            $specialDay = $input['special_day'] ?? null;
            $manualEmail = $input['email'] ?? null;
            $notes = $input['notes'] ?? null;

            $stmt = $pdo->prepare("
                UPDATE zalo_subscribers 
                SET display_name = ?, gender = ?, phone_number = ?, birthday = ?, special_day = ?, manual_email = ?, notes = ? 
                WHERE id = ? AND workspace_id = ?
            ");
            $stmt->execute([$name, $gender, $phone, $birthday, $specialDay, $manualEmail, $notes, $id, $workspace_id]);

            // [NEW] Sync with Main List
            require_once 'zalo_sync_helpers.php';
            syncZaloToMain($pdo, $id);

            jsonResponse(true, null, 'Cập nhật thông tin thành công');
        }
        // --- UPLOAD IMAGE ---
        elseif ($route === 'upload_image') {
            $listId = $_POST['list_id'] ?? '';
            if (!$listId)
                jsonResponse(false, null, "Thiếu ID danh sách");

            $stmt = $pdo->prepare("
                SELECT oa.access_token 
                FROM zalo_lists l
                JOIN zalo_oa_configs oa ON l.oa_config_id = oa.id
                WHERE l.id = ? AND l.workspace_id = ?
            ");
            $stmt->execute([$listId, $workspace_id]);
            $oa = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$oa)
                jsonResponse(false, null, "Không tìm thấy cấu hình OA cho danh sách này");
            if (!isset($_FILES['file']))
                jsonResponse(false, null, "Chưa chọn file để tải lên");

            $file = $_FILES['file'];
            if ($file['error'] !== UPLOAD_ERR_OK)
                jsonResponse(false, null, "Lỗi tải file: " . $file['error']);

            // [SEC-04] Strict MIME type and file extension validation before saving
            $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $detectedMime = '';
            if (function_exists('finfo_open')) {
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                if ($finfo) {
                    $detectedMime = (string)finfo_file($finfo, $file['tmp_name']);
                    finfo_close($finfo);
                }
            } elseif (function_exists('mime_content_type')) {
                $detectedMime = (string)mime_content_type($file['tmp_name']);
            } else {
                $detectedMime = (string)($file['type'] ?? '');
            }
            if (!in_array($ext, $allowedExts, true) || !in_array($detectedMime, $allowedMimes, true)) {
                jsonResponse(false, null, "Định dạng file không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, GIF, WEBP.");
            }

            $uploadDir = '../uploads/zalo/';
            if (!is_dir($uploadDir))
                mkdir($uploadDir, 0777, true);

            $localName = 'zalo_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $localPath = $uploadDir . $localName;

            if (!move_uploaded_file($file['tmp_name'], $localPath))
                jsonResponse(false, null, "Không thể lưu file local");

            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
            $domain = $_SERVER['HTTP_HOST'] ?? 'automation.ideas.edu.vn';
            $localUrl = "$protocol://$domain/uploads/zalo/" . $localName;
            $url = "https://openapi.zalo.me/v2.0/oa/upload/image";
            $cfile = new CURLFile($localPath, $file['type'], $file['name']);

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["access_token: " . $oa['access_token']]);
            $response = curl_exec($ch);
            curl_close($ch);

            $result = json_decode($response, true);
            if (isset($result['data']['attachment_id'])) {
                jsonResponse(true, [
                    'attachment_id' => $result['data']['attachment_id'],
                    'image_url' => $localUrl
                ], 'Tải ảnh lên thành công');
            } else {
                jsonResponse(false, null, "Zalo Error: " . ($result['message'] ?? $response));
            }
        }
        // --- BROADCAST ---
        elseif ($route === 'broadcast') {
            $input = json_decode(file_get_contents('php://input'), true);
            $listId = $input['list_id'] ?? '';
            $messageContent = $input['message'] ?? '';
            $messageType = $input['message_type'] ?? 'text';
            $attachmentId = $input['attachment_id'] ?? '';
            $buttons = $input['buttons'] ?? [];
            $targetGroup = $input['target_group'] ?? 'all';
            $selectedIds = $input['selected_ids'] ?? [];

            if (!$listId)
                jsonResponse(false, null, "Thiếu ID danh sách");
            if ($messageType === 'text' && !$messageContent)
                jsonResponse(false, null, "Nội dung tin nhắn không được để trống");

            $stmt = $pdo->prepare("SELECT l.id, l.oa_config_id, oa.access_token FROM zalo_lists l JOIN zalo_oa_configs oa ON l.oa_config_id = oa.id WHERE l.id = ? AND l.workspace_id = ?");
            $stmt->execute([$listId, $workspace_id]);
            $info = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$info)
                jsonResponse(false, null, "Không tìm thấy danh sách hoặc cấu hình OA");

            $sql = "SELECT zalo_user_id FROM zalo_subscribers WHERE zalo_list_id = ? AND workspace_id = ? AND status IN ('active', 'lead', 'customer')";
            $params = [$listId, $workspace_id];
            if ($targetGroup === 'follower') {
                $sql .= " AND is_follower = 1";
            } elseif ($targetGroup === 'interacted') {
                $sql .= " AND is_follower = 0";
            } elseif ($targetGroup === 'specific') {
                if (empty($selectedIds))
                    jsonResponse(false, null, "Chưa chọn người nhận");
                $placeholders = implode(',', array_fill(0, count($selectedIds), '?'));
                $sql .= " AND zalo_user_id IN ($placeholders)";
                $params = array_merge($params, $selectedIds);
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $subs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (count($subs) === 0)
                jsonResponse(false, null, "Không tìm thấy người nhận trong nhóm này");

            $queued = 0;

            foreach ($subs as $sub) {
                dispatchQueueJob($pdo, 'zalo_broadcast_single', [
                    'user_id' => $sub['zalo_user_id'],
                    'list_id' => $listId,
                    'oa_config_id' => $info['oa_config_id'],
                    'message' => $messageContent,
                    'message_type' => $messageType,
                    'attachment_id' => $attachmentId,
                    'buttons' => $buttons
                ]);
                $queued++;
            }

            jsonResponse(true, [
                'sent' => $queued,
                'failed' => 0,
                'details' => []
            ], "Đã thêm $queued tin nhắn vào hàng đợi gửi (Background Mode).");
        }
        // --- SEND ZBS VIA UID ---
        elseif ($route === 'send_zbs') {
            require_once 'zalo_sender.php';
            $input = json_decode(file_get_contents('php://input'), true);
            $oaId = $input['oa_id'] ?? '';
            $templateId = $input['template_id'] ?? '';
            $recipients = $input['recipients'] ?? []; // Array of {uid, subscriber_id, data}
            $templateDataGlobal = $input['template_data'] ?? []; // Global data if not provided per recipient

            if (!$oaId || !$templateId || empty($recipients)) {
                jsonResponse(false, null, "Thiếu thông tin bắt buộc (oa_id, template_id, recipients)");
            }

            $results = [
                'success' => 0,
                'failed' => 0,
                'errors' => [],
                'details' => [] // [NEW] Capture detailed outcomes
            ];

            foreach ($recipients as $recipient) {
                // ... (existing variable extraction)
                $uid = $recipient['uid'] ?? '';
                $subscriberId = $recipient['subscriber_id'] ?? null;
                $perRecipientData = $recipient['data'] ?? [];

                // Merge global data with per-recipient data
                $finalData = array_merge($templateDataGlobal, $perRecipientData);

                if (!$uid) {
                    $results['failed']++;
                    $results['errors'][] = "Thiếu UID cho subscriber $subscriberId";
                    $results['details'][] = "Subscriber $subscriberId: Missing UID";
                    continue;
                }

                $res = sendZNSMessageByUID($pdo, $oaId, $templateId, $uid, $finalData, null, null, $subscriberId);

                if ($res['success']) {
                    $results['success']++;
                    // Capture the success message (e.g. "Auto-switched to Phone...")
                    $results['details'][] = "UID $uid: " . ($res['message'] ?? 'Success');
                } else {
                    $results['failed']++;
                    $errorMsg = "UID $uid: " . ($res['message'] ?? $res['error_message'] ?? 'Unknown Error');
                    $results['errors'][] = $errorMsg;
                    $results['details'][] = $errorMsg;
                }
            }

            jsonResponse(true, $results, "Hoàn tất gửi ZBS. Thành công: {$results['success']}, Thất bại: {$results['failed']}");
        }
    }
    // --- DELETE METHODS ---
    elseif ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonResponse(false, null, "Thiếu ID người dùng");

        // [SECURITY] Fetch user to get zalo_user_id for cascading cleanup
        $stmtF = $pdo->prepare("SELECT zalo_user_id FROM zalo_subscribers WHERE id = ? AND workspace_id = ?");
        $stmtF->execute([$id, $workspace_id]);
        $user = $stmtF->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            $pdo->beginTransaction();
            try {
                // 1. Cleanup message history (uses zalo_user_id)
                $pdo->prepare("DELETE FROM zalo_user_messages WHERE zalo_user_id = ?")->execute([$user['zalo_user_id']]);
                
                // 2. Cleanup activity logs (uses internal id)
                $pdo->prepare("DELETE FROM zalo_subscriber_activity WHERE subscriber_id = ?")->execute([$id]);
                
                // 3. Delete the subscriber record
                $pdo->prepare("DELETE FROM zalo_subscribers WHERE id = ?")->execute([$id]);

                $pdo->commit();
                jsonResponse(true, null, 'Đã xóa người dùng thành công');
            } catch (Exception $e) {
                $pdo->rollBack();
                jsonResponse(false, null, 'Lỗi khi xóa: ' . $e->getMessage());
            }
        } else {
            jsonResponse(false, null, "Không tìm thấy người dùng");
        }
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
