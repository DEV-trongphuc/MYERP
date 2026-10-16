<?php
// api/roles.php
require_once 'auth_middleware.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Only Super Admins can manage roles overall
require_permission($pdo, 'manage_users');

if ($method === 'GET' && $action === 'list') {
    try {
        $stmt = $pdo->query("SELECT * FROM roles ORDER BY id ASC");
        $roles = $stmt->fetchAll();
        
        $permissionsStmt = $pdo->query("SELECT * FROM permissions ORDER BY category ASC, id ASC");
        $permissions = $permissionsStmt->fetchAll();

        // Attach permissions to each role
        foreach ($roles as &$role) {
            $rpStmt = $pdo->prepare("SELECT permission_slug FROM role_permissions WHERE role_id = ?");
            $rpStmt->execute([$role['id']]);
            $role['permissions'] = $rpStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        jsonResponse(true, [
            'roles' => $roles,
            'available_permissions' => $permissions
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'POST' && $action === 'update_role_permissions') {
    $input = json_decode(file_get_contents('php://input'), true);
    $role_id = $input['role_id'] ?? null;
    $permissions = $input['permissions'] ?? [];
    
    if (!$role_id) {
        jsonResponse(false, null, 'Role ID required');
    }

    try {
        $pdo->beginTransaction();
        
        // Remove old permissions
        $stmt = $pdo->prepare("DELETE FROM role_permissions WHERE role_id = ?");
        $stmt->execute([$role_id]);
        
        // Add new permissions
        if (!empty($permissions)) {
            $insert = $pdo->prepare("INSERT INTO role_permissions (role_id, permission_slug) VALUES (?, ?)");
            foreach ($permissions as $slug) {
                $insert->execute([$role_id, $slug]);
            }
        }
        
        $pdo->commit();
        jsonResponse(true, null, 'Role permissions updated successfully');
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid action');
?>
