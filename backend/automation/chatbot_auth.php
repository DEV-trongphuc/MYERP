<?php
// api/chatbot_auth.php - Specialized Strict Authentication for Chatbot/Workspace
require_once 'db_connect.php';

/**
 * Enforces strictly session-based authentication.
 * Bypasses $_GET fallbacks to prevent impersonation.
 */
function requireStrictAuth()
{
    // Only trust Session
    $userId = $_SESSION['user_id'] ?? $_SESSION['org_user_id'] ?? null;

    // Admin Sync Mapping
    if ($userId == 1 || $userId === '1') {
        $userId = 'admin-001';
    }

    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Strict authentication required.']);
        exit;
    }

    // Override global admin_id for the current script's scope
    $GLOBALS['current_admin_id'] = $userId;
    return $userId;
}
