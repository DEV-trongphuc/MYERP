<?php
/**
 * Meta Attachment Upload API
 * Uploads media to Meta and returns attachment_id
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'meta_helpers.php';

metaApiHeaders();

// [SECURITY] Require authenticated workspace session
// Cần đăng nhập (bất kỳ quyền gì)
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

$configId = $_POST['meta_config_id'] ?? '';
if (!$configId) {
    jsonResponse(false, null, 'meta_config_id is required');
}

if (!isset($_FILES['file'])) {
    jsonResponse(false, null, 'No file uploaded');
}

try {
    // 1. Get Page Access Token
    $stmt = $pdo->prepare("SELECT page_access_token, page_id FROM meta_app_configs WHERE id = ?");
    $stmt->execute([$configId]);
    $config = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$config || empty($config['page_access_token'])) {
        jsonResponse(false, null, 'Fanpage configuration not found or token missing');
    }

    $pageAccessToken = $config['page_access_token'];
    $file = $_FILES['file'];
    $fileTmp = $file['tmp_name'];
    $fileType = $file['type'];
    $fileName = $file['name'];

    // Determine Meta attachment type
    $type = 'image';
    if (strpos($fileType, 'video') !== false) {
        $type = 'video';
    } elseif (strpos($fileType, 'audio') !== false) {
        $type = 'audio';
    }

    // 2. Upload to Meta using multipart/form-data
    $url = "https://graph.facebook.com/v24.0/me/message_attachments?access_token=" . $pageAccessToken;

    $ch = curl_init();
    $messagePayload = json_encode([
        'attachment' => [
            'type' => $type,
            'payload' => [
                'is_reusable' => true
            ]
        ]
    ]);

    $postFields = [
        'message' => $messagePayload,
        'file' => new CURLFile($fileTmp, $fileType, $fileName)
    ];

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        jsonResponse(false, null, 'Curl Error: ' . $err);
    }

    $resData = json_decode($response, true);

    if (isset($resData['attachment_id'])) {
        // Optional: Also save locally for preview if needed
        // For now, let's just return the id
        jsonResponse(true, [
            'attachment_id' => $resData['attachment_id'],
            'type' => $type
        ]);
    } else {
        $errorMsg = $resData['error']['message'] ?? 'Unknown Meta API Error';
        jsonResponse(false, $resData, 'Meta Upload Failed: ' . $errorMsg);
    }

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
