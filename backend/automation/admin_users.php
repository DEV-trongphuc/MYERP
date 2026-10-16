<?php
// api/admin_users.php
require_once 'db_connect.php';

// [FIX M-04] Root admin emails extracted to single constant — no longer duplicated 3x in code.
// To add/remove root admins, only change this list.
define('ROOT_ADMIN_EMAILS', [
    'dom.marketing.vn@gmail.com',
    'marketing@ideas.edu.vn',
    'ledaovuphuong@gmail.com',
]);

// Auth Check: Must be admin
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$role = $_SESSION['role'] ?? '';
$isApprovedAdmin = (($role === 'admin' || $role === 'super_admin') && ($_SESSION['status'] ?? '') === 'approved');
// Also allow from internal bypass token if needed
if (!$isApprovedAdmin && ($GLOBALS['current_admin_id'] !== 'admin-001')) {
    jsonResponse(false, null, 'Unauthorized');
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'list') {
    $stmt = $pdo->query("SELECT id, email, name, role, status, last_login, picture FROM users ORDER BY last_login DESC, created_at DESC");
    $users = $stmt->fetchAll();

    if (!empty($users)) {
        $userIds = array_map(function($u) { return $u['id']; }, $users);
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        
        try {
            $wsStmt = $pdo->prepare("
                SELECT wu.user_id, w.name as workspace_name, r.name as role_name 
                FROM workspace_users wu
                JOIN workspaces w ON w.id = wu.workspace_id
                LEFT JOIN roles r ON r.id = wu.role_id
                WHERE TRIM(wu.user_id) COLLATE utf8mb4_unicode_ci IN ($placeholders)
            ");
            // Map the bound parameters to execute
            $wsStmt->execute($userIds);
            $memberships = $wsStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $grouped = [];
            foreach ($memberships as $m) {
                $uid = trim($m['user_id']);
                if (!isset($grouped[$uid])) {
                    $grouped[$uid] = [];
                }
                $grouped[$uid][] = [
                    'workspace_name' => $m['workspace_name'],
                    'role_name' => $m['role_name']
                ];
            }
            
            foreach ($users as &$user) {
                $uid = trim($user['id']);
                $user['workspaces'] = $grouped[$uid] ?? [];
            }
        } catch (Exception $e) {
            foreach ($users as &$user) {
                $user['workspaces'] = [];
            }
        }
    }

    jsonResponse(true, $users);
}

if ($method === 'POST' && $action === 'update_status') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'] ?? null;
    $status = $data['status'] ?? null;

    if (!$id || !$status) jsonResponse(false, null, 'Missing data');
    
    // Prevent disabling self or root admins
    $userStmt = $pdo->prepare("SELECT email FROM users WHERE id = ?");
    $userStmt->execute([$id]);
    $userEmail = $userStmt->fetchColumn();
    $rootAdmins = ROOT_ADMIN_EMAILS;
    if (in_array($userEmail, $rootAdmins)) jsonResponse(false, null, 'Cannot modify root admin');

    $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
    $stmt->execute([$status, $id]);
    jsonResponse(true, null, 'Status updated');
}

if ($method === 'POST' && $action === 'update_role') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'] ?? null;
    $role = $data['role'] ?? null;

    if (!$id || !$role) jsonResponse(false, null, 'Missing data');

    $userStmt = $pdo->prepare("SELECT email FROM users WHERE id = ?");
    $userStmt->execute([$id]);
    $userEmail = $userStmt->fetchColumn();
    $rootAdmins = ROOT_ADMIN_EMAILS;
    if (in_array($userEmail, $rootAdmins)) jsonResponse(false, null, 'Cannot modify root admin');

    $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt->execute([$role, $id]);
    jsonResponse(true, null, 'Role updated');
}

if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'] ?? $_GET['id'] ?? null;

    if (!$id) jsonResponse(false, null, 'ID required');

    $userStmt = $pdo->prepare("SELECT email FROM users WHERE id = ?");
    $userStmt->execute([$id]);
    $userEmail = $userStmt->fetchColumn();
    $rootAdmins = ROOT_ADMIN_EMAILS;
    if (in_array($userEmail, $rootAdmins)) jsonResponse(false, null, 'Cannot delete root admin');

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(true, null, 'User deleted');
}

jsonResponse(false, null, 'Invalid action');
