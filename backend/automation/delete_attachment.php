<?php
// api/delete_attachment.php
require_once 'db_connect.php';
require_once 'ai_org_middleware.php';

// SECURITY: Enforce Auth
$currentOrgUser = requireAISpaceAuth();

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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

$input = json_decode(file_get_contents('php://input'), true);
$path = $input['path'] ?? '';

if (empty($path)) {
    jsonResponse(false, null, 'No path provided');
}

// Security: Verify ownership before deleting
$isAdmin = ($currentOrgUser['admin_id'] === 'admin-001' || is_super_admin());
$orgId = $currentOrgUser['admin_id'] ?? $currentOrgUser['id'];

$canDelete = false;

if ($isAdmin) {
    $canDelete = true;
} else {
    // Check if the file is tracked in global_assets and belongs to this user's org
    $stmtAsset = $pdo->prepare("SELECT id FROM global_assets WHERE url = ? AND (admin_id = ? OR property_id IN (SELECT id FROM ai_chatbots WHERE admin_id = ?)) LIMIT 1");
    $stmtAsset->execute([$path, $orgId, $orgId]);
    if ($stmtAsset->fetchColumn()) {
        $canDelete = true;
    }

    // Also check domation_ai_training_docs
    if (!$canDelete) {
        $stmtDoc = $pdo->prepare("SELECT id FROM domation_ai_training_docs WHERE content = ? AND (property_id IN (SELECT id FROM ai_chatbots WHERE admin_id = ?)) LIMIT 1");
        $stmtDoc->execute([$path, $orgId]);
        if ($stmtDoc->fetchColumn()) {
            $canDelete = true;
        }
    }
}

if (!$canDelete) {
    jsonResponse(false, null, 'Forbidden: You do not own this attachment');
}

// Chống Directory Traversal
$realUploadDir = realpath('../uploadss/');
$realTarget = realpath($path);

// Nếu file tồn tại và nằm gọn trong thư mục uploadss
if ($realTarget && file_exists($realTarget) && strpos($realTarget, $realUploadDir) === 0) {
    if (unlink($realTarget)) {
        // Also remove from global_assets (soft delete or hard delete)
        $pdo->prepare("UPDATE global_assets SET is_deleted = 1 WHERE url = ?")->execute([$path]);
        jsonResponse(true, null, 'Attachment deleted successfully');
    } else {
        jsonResponse(false, null, 'Failed to delete attachment from server');
    }
} else {
    // Nếu file không tồn tại, cứ coi như thao tác xoá đã xong
    jsonResponse(true, null, 'File not found or already deleted');
}
?>
