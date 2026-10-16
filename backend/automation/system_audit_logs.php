<?php
// api/system_audit_logs.php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Only allow users who are logged in
    $userId = $_SESSION['user_id'] ?? $GLOBALS['current_admin_id'] ?? null;
    
    if (!$userId) {
        jsonResponse(false, null, 'Không có quyền truy cập');
    }

    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;

    // Hard limit overall records to 100 per user (User requested max 100 recent events)
    if ($page * $limit > 100) {
        // Capping to prevent reading past 100
        $limit = max(0, 100 - (($page - 1) * $limit));
    }

    $offset = ($page - 1) * 20;

    if ($limit <= 0) {
        jsonResponse(true, ['logs' => [], 'total' => 100, 'page' => $page, 'hasMore' => false]);
    }

    $isAdmin = (isset($_SESSION['role']) && $_SESSION['role'] === 'admin') || is_super_admin();

    try {
        if ($isAdmin) {
            // Admin sees all logs globally
            $stmt = $pdo->prepare("
                SELECT l.id, l.user_name, l.module, l.action, l.target_name, l.details, l.created_at, u.picture as user_picture
                FROM system_audit_logs l
                LEFT JOIN users u ON l.user_id = u.id
                ORDER BY l.created_at DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->bindValue(2, $offset, PDO::PARAM_INT);
        } else {
            // Normal user sees only their own logs
            $stmt = $pdo->prepare("
                SELECT l.id, l.user_name, l.module, l.action, l.target_name, l.details, l.created_at, u.picture as user_picture
                FROM system_audit_logs l
                LEFT JOIN users u ON l.user_id = u.id
                WHERE l.user_id = ?
                ORDER BY l.created_at DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->bindValue(1, $userId);
            $stmt->bindValue(2, $limit, PDO::PARAM_INT);
            $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        }
        $stmt->execute();
        
        $logs = $stmt->fetchAll();

        // Decode details if string
        foreach($logs as &$log) {
            if ($log['details']) {
                $decoded = json_decode($log['details'], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $log['details'] = $decoded;
                }
            }
        }

        // Check if there are more up to 100
        $hasMore = (count($logs) == 20) && (($page * 20) < 100);

        jsonResponse(true, [
            'logs' => $logs,
            'page' => $page,
            'hasMore' => $hasMore
        ]);

    } catch (Exception $e) {
        jsonResponse(false, null, "Lỗi lấy log: " . $e->getMessage());
    }
} else {
    jsonResponse(false, null, 'Method not allowed');
}
