<?php
// api/workspaces.php
require_once 'auth_middleware.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// require_permission($pdo, 'manage_workspaces'); -> Global removed. Scoped to actions.

if ($method === 'GET' && $action === 'list') {
    // [FIX R5-C01] Cập nhật logic xác thực đồng bộ với hệ thống (hỗ trợ Local Dev và Admin Token)
    $hasAuth = !empty($GLOBALS['current_admin_id']) || 
               !empty($_SESSION['user_id']) || 
               false || 
               false;

    if (!$hasAuth) {
        http_response_code(401);
        jsonResponse(false, null, 'Unauthorized');
    }

    $user_id = $_SESSION['user_id'] ?? null ?? null;
    $isSuper = is_super_admin();

    try {
        if ($isSuper) {
            $stmt = $pdo->query("SELECT * FROM workspaces ORDER BY id ASC");
        } else {
            $stmt = $pdo->prepare("
                SELECT w.* FROM workspaces w
                JOIN workspace_users wu ON wu.workspace_id = w.id
                WHERE wu.user_id = ?
                ORDER BY w.id ASC
            ");
            $stmt->execute([$user_id]);
        }
        $workspaces = $stmt->fetchAll();
        foreach ($workspaces as &$ws) {
            $ws['db_needs_migration'] = $GLOBALS['db_needs_migration'] ?? false;
        }
        jsonResponse(true, $workspaces);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'POST' && $action === 'create') {
    require_permission($pdo, 'manage_workspaces');
    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $desc = trim($input['description'] ?? '');

    if (empty($name)) {
        jsonResponse(false, null, 'Workspace name is required');
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO workspaces (name, description) VALUES (?, ?)");
        $stmt->execute([$name, $desc]);
        jsonResponse(true, ['id' => $pdo->lastInsertId()], 'Workspace created successfully');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'GET' && $action === 'users') {
    $workspace_id = $_GET['workspace_id'] ?? get_current_workspace_id();
    require_permission($pdo, 'manage_users', $workspace_id);
    try {
        // [P20-C2] Self-healing moved to lazy check — only runs once per session, not on every request.
        // Guards against workspace_1 being empty due to migration failures.
        if ((int)$workspace_id === 1 && empty($_SESSION['workspace1_healed'])) {
            try {
                $healCheck = $pdo->prepare("SELECT COUNT(*) FROM workspace_users WHERE workspace_id = 1");
                $healCheck->execute();
                if ((int)$healCheck->fetchColumn() === 0) {
                    $admins = $pdo->query("SELECT id FROM users WHERE role IN ('super_admin','admin') LIMIT 50")->fetchAll(PDO::FETCH_COLUMN);
                    foreach ($admins as $aid) {
                        $pdo->prepare("INSERT IGNORE INTO workspace_users (workspace_id, user_id, role_id) VALUES (1, ?, 1)")->execute([$aid]);
                    }
                }
            } catch (Exception $healEx) { /* ignore — non-critical */ }
            if (session_status() === PHP_SESSION_NONE) session_start();
            $_SESSION['workspace1_healed'] = true;
            session_write_close();
        }

        $stmt = $pdo->prepare("
            SELECT CONCAT(wu.workspace_id, '_', wu.user_id) as mapping_id, u.id as user_id, u.email, u.full_name AS name, u.full_name, u.avatar_url AS picture, u.last_login_at AS last_login, wu.role as role_name
            FROM workspace_users wu
            JOIN users u ON TRIM(u.id) COLLATE utf8mb4_unicode_ci = TRIM(wu.user_id) COLLATE utf8mb4_unicode_ci
            WHERE wu.workspace_id = ?
        ");
        $stmt->execute([$workspace_id]);
        $finalData = $stmt->fetchAll();

        // [FIX NH-01] Removed debug fallback that returned raw workspace_users bindings.
        // That response exposed internal DB schema fields and the raw user_id/role_id mappings
        // to authenticated callers whenever the JOIN found no users (e.g. ID type mismatch).
        // Now: return empty list — caller can investigate via admin tools if needed.
        jsonResponse(true, $finalData);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'POST' && $action === 'switch') {
    $input = json_decode(file_get_contents('php://input'), true);
    $target_workspace = (int) ($input['workspace_id'] ?? 1);
    $user_id = $_SESSION['user_id'] ?? null;

    // [P20-C1 SECURITY FIX] Verify the user actually belongs to the requested workspace.
    // Without this check, any authenticated user could switch to any workspace_id.
    $isSuperSession = is_super_admin();
    if (!$isSuperSession && $user_id) {
        try {
            $stmtCheck = $pdo->prepare("SELECT id FROM workspace_users WHERE workspace_id = ? AND user_id = ? LIMIT 1");
            $stmtCheck->execute([$target_workspace, $user_id]);
            if (!$stmtCheck->fetch()) {
                jsonResponse(false, null, 'Unauthorized: You do not belong to this workspace.');
                exit;
            }
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            exit;
        }
    }

    // Re-open session briefly to write (session_write_close() may have been called)
    if (session_status() === PHP_SESSION_NONE) session_start();
    $_SESSION['current_workspace_id'] = $target_workspace;
    session_write_close();
    jsonResponse(true, ['workspace_id' => $target_workspace], 'Switched workspace context');
}

if ($method === 'POST' && $action === 'add_user') {
    $workspace_id = $_GET['workspace_id'] ?? get_current_workspace_id();
    require_permission($pdo, 'manage_users', $workspace_id);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $email = trim($input['email'] ?? '');
    $role_id = (int) ($input['role_id'] ?? 0);
    
    if (!$email || !$role_id) jsonResponse(false, null, 'Email and Role are required');
    
    try {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $target_user_id = $stmt->fetchColumn();
        
        if (!$target_user_id) jsonResponse(false, null, 'User with this email not found in the global system');
        
        $insert = $pdo->prepare("INSERT INTO workspace_users (workspace_id, user_id, role_id) VALUES (?, ?, ?)");
        $insert->execute([$workspace_id, $target_user_id, $role_id]);
        jsonResponse(true, null, 'User added to workspace');
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            jsonResponse(false, null, 'User is already in this workspace');
        }
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'POST' && $action === 'update_user') {
    $workspace_id = $_GET['workspace_id'] ?? get_current_workspace_id();
    require_permission($pdo, 'manage_users', $workspace_id);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $mapping_id = (int) ($input['mapping_id'] ?? 0);
    $role_id = (int) ($input['role_id'] ?? 0);
    
    if (!$mapping_id || !$role_id) jsonResponse(false, null, 'Mapping ID and Role are required');

    // [P20-A1 SECURITY FIX] Prevent role escalation: a caller cannot assign a role with
    // higher privilege than their own. Roles with lower id= value typically have MORE privilege
    // (e.g. role_id=1 = owner/super_admin). We compare by checking if the target role_id
    // is less than the caller's own minimum role_id in this workspace.
    $isSuperAdmin = is_super_admin();
    if (!$isSuperAdmin) {
        $caller_user_id = $_SESSION['user_id'] ?? null;
        if ($caller_user_id) {
            // Get caller's role in this workspace
            $stmtCallerRole = $pdo->prepare(
                "SELECT MIN(role_id) as min_role_id FROM workspace_users WHERE user_id = ? AND workspace_id = ?"
            );
            $stmtCallerRole->execute([$caller_user_id, $workspace_id]);
            $callerMinRoleId = (int) $stmtCallerRole->fetchColumn();

            // If target role_id is LOWER (= higher privilege) than caller's role — deny it
            if ($callerMinRoleId > 0 && $role_id < $callerMinRoleId) {
                jsonResponse(false, null, 'Cannot assign a role with higher privileges than your own.');
                exit;
            }
        }
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE workspace_users SET role_id = ? WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$role_id, $mapping_id, $workspace_id]);
        jsonResponse(true, null, 'User role updated');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

if ($method === 'POST' && $action === 'remove_user') {
    $workspace_id = $_GET['workspace_id'] ?? get_current_workspace_id();
    require_permission($pdo, 'manage_users', $workspace_id);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $mapping_id = (int) ($input['mapping_id'] ?? 0);
    
    if (!$mapping_id) jsonResponse(false, null, 'Mapping ID is required');
    
    try {
        // [P20-C3] Prevent self-removal if this is the last admin in the workspace.
        $stmtTarget = $pdo->prepare("SELECT user_id, role FROM workspace_users WHERE user_id = ? AND workspace_id = ? LIMIT 1");
        $stmtTarget->execute([$mapping_id, $workspace_id]);
        $targetRow = $stmtTarget->fetch();

        if ($targetRow) {
            $roleName = $targetRow['role'] ?? 'user';

            if (in_array($roleName, ['admin', 'super_admin', 'owner'])) {
                // Count remaining admins in this workspace after removal
                $stmtAdminCount = $pdo->prepare("
                    SELECT COUNT(*) FROM workspace_users wu
                    WHERE wu.workspace_id = ? AND wu.role IN ('admin','super_admin','owner') AND wu.user_id != ?
                ");
                $stmtAdminCount->execute([$workspace_id, $mapping_id]);
                $remainingAdmins = (int)$stmtAdminCount->fetchColumn();

                if ($remainingAdmins === 0) {
                    jsonResponse(false, null, 'Không thể xóa admin cuối cùng khỏi workspace. Hãy thêm admin khác trước.');
                    exit;
                }
            }
        }

        $stmt = $pdo->prepare("DELETE FROM workspace_users WHERE user_id = ? AND workspace_id = ?");
        $stmt->execute([$mapping_id, $workspace_id]);
        jsonResponse(true, null, 'User removed from workspace');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid action');
?>
