<?php
// api/ai_org_users.php
require_once 'db_connect.php';
require_once 'ai_org_middleware.php'; // For logAdminAction
require_once 'auth_middleware.php';

if (session_status() === PHP_SESSION_NONE)
    session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Helper
if (!function_exists('jsonResponse')) {
    function jsonResponse($success, $data = null, $message = '')
    {
        header('Content-Type: application/json');
        echo json_encode(['success' => $success, 'data' => $data, 'message' => $message]);
        exit;
    }
}

// Authentication Check: Must be authenticated for AI Space
$currentOrgUser = requireAISpaceAuth();
$currentUserId = $currentOrgUser['id'];
$currentUserRole = $currentOrgUser['role'];

// Determine the org scope: use admin_id from the current user record to scope all queries.
// If the current user is a top-level admin (admin_id is null or 'admin-001'), 
// they are the anchor for their own organization.
$orgScopeAdminId = $currentOrgUser['admin_id'] ?? null;

// Virtual 'admin-001' should not be used for database WHERE clauses if we have a real ID
if ($orgScopeAdminId === 'admin-001' || is_super_admin()) $orgScopeAdminId = null;

if (!$orgScopeAdminId && $currentUserRole === 'admin') {
    $orgScopeAdminId = $currentUserId; // Top-level admin: use own ID as org scope
}

// Final fallback: if currentUserId is virtual, don't use it for scoping unless we specifically want global access
if ($orgScopeAdminId === 'admin-001' || is_super_admin()) $orgScopeAdminId = null;

// Only Admin and Assistant can access the users management API
if (!in_array($currentUserRole, ['admin', 'assistant'])) {
    http_response_code(403);
    jsonResponse(false, null, 'Access Denied: Admin or Assistant privileges required');
}

// Quick Migration for new status fields
try {
    $pdo->exec("ALTER TABLE ai_org_users ADD COLUMN IF NOT EXISTS status_reason TEXT AFTER status");
    $pdo->exec("ALTER TABLE ai_org_users ADD COLUMN IF NOT EXISTS status_expiry DATETIME AFTER status_reason");
    $pdo->exec("ALTER TABLE ai_org_users ADD COLUMN IF NOT EXISTS gender ENUM('male', 'female', 'other') DEFAULT NULL AFTER full_name");
} catch (Exception $e) {
    // Ignore if column exists or IF NOT EXISTS not supported by this DB version
}

// Data Migration: Fix existing users with NULL admin_id
// If we have an orgScopeAdminId, update users who have no admin_id
// and are NOT themselves admins (to avoid overwriting top-level admins)
if ($orgScopeAdminId) {
    try {
        // Fix users with NULL or empty admin_id that should belong to this org
        // Only update non-admin users (regular users/assistants with no org assigned)
        $pdo->prepare("UPDATE ai_org_users SET admin_id = ? WHERE (admin_id IS NULL OR admin_id = '') AND role != 'admin' AND id != ?")->execute([$orgScopeAdminId, $currentUserId]);
        // Also link them to the category if categoryId context is available
    } catch (Exception $e) {
        error_log('[ai_org_users] admin_id migration warning: ' . $e->getMessage());
    }
}

// 1. List Users
if ($method === 'GET' && ($action === 'list' || $action === '')) {
    $categoryId = $_GET['category_id'] ?? null;
    if ($categoryId) {
        require_once 'ai_org_middleware.php'; // For resolvePropertyId
        $categoryId = resolvePropertyId($pdo, $categoryId);
        // [SECURITY FIX] Enforce access check for the category
        requireCategoryAccess($categoryId, $currentOrgUser);
    }

    // Lazy Migration: Ensure ai_org_user_categories exists
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS ai_org_user_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            category_id VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_user_cat (user_id, category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // AUTO-SYNC: If we have a categoryId but NO users linked to it yet,
        // we auto-link all existing 'admin' users of THIS ORG so they can manage it.
        if ($categoryId) {
            $adminScopeCheck = $orgScopeAdminId ? "AND admin_id = ?" : "";
            $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM ai_org_user_categories WHERE category_id = ?");
            $checkStmt->execute([$categoryId]);
            if ($checkStmt->fetchColumn() == 0) {
                // Link all existing admins of this org to this new category automatically
                // Link all existing admins of this org to this new category automatically
                if ($orgScopeAdminId) {
                    $pdo->prepare("
                        INSERT IGNORE INTO ai_org_user_categories (user_id, category_id)
                        SELECT id, ? FROM ai_org_users WHERE role = 'admin' AND (admin_id = ? OR id = ?)
                    ")->execute([$categoryId, $orgScopeAdminId, $orgScopeAdminId]);
                } else {
                    $pdo->prepare("
                        INSERT IGNORE INTO ai_org_user_categories (user_id, category_id)
                        SELECT id, ? FROM ai_org_users WHERE role = 'admin'
                    ")->execute([$categoryId]);
                }
            }
        }
    } catch (Exception $e) {
    }

    try {
        if ($categoryId) {
            // ORG ISOLATION: Return all users in the org (access is org-wide)
            if ($orgScopeAdminId) {
                $stmt = $pdo->prepare("
                    SELECT u.id, u.email, u.full_name, u.gender, u.role, u.status, u.status_reason, u.status_expiry, u.permissions, u.last_login, u.created_at,
                    IF(uc.id IS NOT NULL, 1, 0) as in_category
                    FROM ai_org_users u
                    LEFT JOIN ai_org_user_categories uc ON u.id = uc.user_id AND uc.category_id = ?
                    WHERE u.admin_id = ? OR u.id = ?
                    ORDER BY u.created_at DESC
                ");
                $stmt->execute([$categoryId, $orgScopeAdminId, $orgScopeAdminId]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT u.id, u.email, u.full_name, u.gender, u.role, u.status, u.status_reason, u.status_expiry, u.permissions, u.last_login, u.created_at,
                    IF(uc.id IS NOT NULL, 1, 0) as in_category
                    FROM ai_org_users u
                    LEFT JOIN ai_org_user_categories uc ON u.id = uc.user_id AND uc.category_id = ?
                    ORDER BY u.created_at DESC
                ");
                $stmt->execute([$categoryId]);
            }
        } else {
            // ORG ISOLATION: Only show users belonging to this org's admin_id
            if ($orgScopeAdminId) {
                $stmt = $pdo->prepare("SELECT id, email, full_name, gender, role, status, status_reason, status_expiry, permissions, last_login, created_at FROM ai_org_users WHERE admin_id = ? OR id = ? ORDER BY created_at DESC");
                $stmt->execute([$orgScopeAdminId, $orgScopeAdminId]);
            } else {
                $stmt = $pdo->query("SELECT id, email, full_name, gender, role, status, status_reason, status_expiry, permissions, last_login, created_at FROM ai_org_users ORDER BY created_at DESC");
            }
        }
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Transform permissions JSON
        foreach ($users as &$u) {
            $perms = !empty($u['permissions']) ? json_decode($u['permissions'], true) : null;
            $u['permissions'] = $perms ?: ['modes' => ['chat'], 'access' => 'limited'];
        }

        header('Content-Type: application/json');

        // Extended Sanity Check
        if ($orgScopeAdminId) {
            $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM ai_org_users WHERE admin_id = ? OR id = ?");
            $stmtTotal->execute([$orgScopeAdminId, $orgScopeAdminId]);
            $totalUsers = (int) $stmtTotal->fetchColumn();
        } else {
            $totalUsers = (int) $pdo->query("SELECT COUNT(*) FROM ai_org_users")->fetchColumn();
        }
        $totalLinks = $pdo->query("SELECT COUNT(*) FROM ai_org_user_categories")->fetchColumn();
        $isAdminInTable = $pdo->prepare("SELECT COUNT(*) FROM ai_org_users WHERE email = ? OR id = ?");
        $isAdminInTable->execute([$_SESSION['email'] ?? 'admin@autoflow.vn', $currentUserId]);
        $hasAdmin = $isAdminInTable->fetchColumn() > 0;

        echo json_encode([
            'success' => true,
            'data' => $users,
        ]);
        exit;
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// 2. Add User
if ($method === 'POST' && $action === 'add') {
    $input = json_decode(file_get_contents('php://input'), true);

    $email = $input['email'] ?? '';
    $password = $input['password'] ?? ''; // Optional, if empty generate random?
    $fullName = $input['full_name'] ?? '';
    $gender = $input['gender'] ?? null;
    $role = $input['role'] ?? 'user';
    $permissions = $input['permissions'] ?? ['modes' => ['chat'], 'access' => 'limited'];

    if (empty($email)) {
        jsonResponse(false, null, 'Email is required');
    }

    // Role Restriction: Assistant cannot create Admins
    if ($currentUserRole === 'assistant' && $role === 'admin') {
        jsonResponse(false, null, 'Assistants cannot create Admins');
    }

    try {
        // Check if email exists (scoped to this org)
        if ($orgScopeAdminId) {
            $stmtCheck = $pdo->prepare("SELECT id FROM ai_org_users WHERE email = ? AND admin_id = ?");
            $stmtCheck->execute([$email, $orgScopeAdminId]);
        } else {
            $stmtCheck = $pdo->prepare("SELECT id FROM ai_org_users WHERE email = ?");
            $stmtCheck->execute([$email]);
        }
        $existingId = $stmtCheck->fetchColumn();

        if ($existingId) {
            // Update existing user instead of erroring - "nhập email có sẵn thì ko cần nhập pass"
            $sql = "UPDATE ai_org_users SET full_name = ?, gender = ?, role = ?, permissions = ?, updated_at = NOW() WHERE id = ?";
            $pdo->prepare($sql)->execute([$fullName, $gender, $role, json_encode($permissions), $existingId]);

            // Handle Category Association for existing user
            $categoryId = $input['category_id'] ?? null;
            if ($categoryId) {
                try {
                    $pdo->prepare("INSERT IGNORE INTO ai_org_user_categories (user_id, category_id) VALUES (?, ?)")
                        ->execute([$existingId, $categoryId]);
                } catch (Exception $e) {
                    error_log('[ai_org_users] category link (update) warning: ' . $e->getMessage());
                }
            }

            jsonResponse(true, ['id' => $existingId], 'User profile updated successfully');
        } else {
            // Create new
            $passwordHash = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : null;
            $permsJson = json_encode($permissions);

            // Store admin_id to maintain org isolation
            $stmt = $pdo->prepare("INSERT INTO ai_org_users (email, password_hash, full_name, gender, role, status, permissions, status_reason, status_expiry, admin_id) VALUES (?, ?, ?, ?, ?, 'active', ?, '', NULL, ?)");
            $stmt->execute([$email, $passwordHash, $fullName, $gender, $role, $permsJson, $orgScopeAdminId]);

            $userId = $pdo->lastInsertId();
            logAdminAction($pdo, $currentUserId, 'create_user', 'user', $userId, ['email' => $email, 'role' => $role]);

            // Handle Category Association
            $categoryId = $input['category_id'] ?? null;
            if ($categoryId) {
                try {
                    $pdo->prepare("INSERT IGNORE INTO ai_org_user_categories (user_id, category_id) VALUES (?, ?)")
                        ->execute([$userId, $categoryId]);
                } catch (Exception $e) {
                    error_log('[ai_org_users] category link (create) warning: ' . $e->getMessage());
                }
            }

            jsonResponse(true, ['id' => $userId], 'User created successfully');
        }
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// 3. Update User
if ($method === 'POST' && $action === 'update') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;

    if (!$id) {
        jsonResponse(false, null, 'User ID required');
    }

    // Assistants cannot edit Admins — also verify target user belongs to SAME ORG
    if ($orgScopeAdminId) {
        $stmtOwn = $pdo->prepare("SELECT id FROM ai_org_users WHERE id = ? AND (admin_id = ? OR id = ? OR admin_id IS NULL)");
        $stmtOwn->execute([$id, $orgScopeAdminId, $orgScopeAdminId]);
        if (!$stmtOwn->fetchColumn()) {
            http_response_code(403);
            jsonResponse(false, null, 'Access Denied: User does not belong to your organization');
        }
    }
    if ($currentUserRole === 'assistant') {
        $stmtRole = $pdo->prepare("SELECT role FROM ai_org_users WHERE id = ?");
        $stmtRole->execute([$id]);
        $targetRole = $stmtRole->fetchColumn();
        if ($targetRole === 'admin') {
            jsonResponse(false, null, 'Assistants cannot edit Admins');
        }
    }

    try {
        $fields = [];
        $params = [];

        if (isset($input['full_name'])) {
            $fields[] = "full_name = ?";
            $params[] = $input['full_name'];
        }
        if (isset($input['gender'])) {
            $fields[] = "gender = ?";
            $params[] = $input['gender'];
        }
        if (isset($input['role'])) {
            // Cannot promote self to something else if you are last admin (safety check omitted for brevity but good to have)
            // Assistants cannot promote to Admin
            if ($currentUserRole === 'assistant' && $input['role'] === 'admin') {
                jsonResponse(false, null, 'Assistants cannot promote users to Admin');
            }
            $fields[] = "role = ?";
            $params[] = $input['role'];
        }
        if (isset($input['status'])) {
            $fields[] = "status = ?";
            $params[] = $input['status'];
        }
        if (isset($input['status_reason'])) {
            $fields[] = "status_reason = ?";
            $params[] = $input['status_reason'];
        }
        if (isset($input['status_expiry'])) {
            $fields[] = "status_expiry = ?";
            $params[] = !empty($input['status_expiry']) ? $input['status_expiry'] : null;
        }
        if (isset($input['permissions'])) {
            $fields[] = "permissions = ?";
            $params[] = json_encode($input['permissions']);
        }
        if (isset($input['password']) && !empty($input['password'])) {
            $fields[] = "password_hash = ?";
            $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
        }

        if (empty($fields)) {
            jsonResponse(false, null, 'No fields to update');
        }

        $sql = "UPDATE ai_org_users SET " . implode(", ", $fields) . ", updated_at = NOW() WHERE id = ?";
        $params[] = $id;
        $pdo->prepare($sql)->execute($params);

        // Determine action details for logging
        $logAction = 'update_user';
        if (isset($input['status']) && $input['status'] === 'banned')
            $logAction = 'ban_user';
        if (isset($input['status']) && $input['status'] === 'suspended')
            $logAction = 'warn_user'; // Map appropriately

        logAdminAction($pdo, $currentUserId, $logAction, 'user', $id, $input);

        jsonResponse(true, null, 'User updated successfully');

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// 4. Delete User
if ($method === 'POST' && $action === 'delete') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;

    if (!$id) {
        jsonResponse(false, null, 'User ID required');
    }

    // Prevent self-deletion
    if ($id == $currentUserId) {
        jsonResponse(false, null, 'Cannot delete yourself');
    }

    try {
        // ORG ISOLATION: Verify target user belongs to same org before deleting
        if ($orgScopeAdminId) {
            $stmtOwn = $pdo->prepare("SELECT id FROM ai_org_users WHERE id = ? AND admin_id = ?");
            $stmtOwn->execute([$id, $orgScopeAdminId]);
            if (!$stmtOwn->fetchColumn()) {
                http_response_code(403);
                jsonResponse(false, null, 'Access Denied: User does not belong to your organization');
            }
        }

        // Check target role
        $stmtRole = $pdo->prepare("SELECT role FROM ai_org_users WHERE id = ?");
        $stmtRole->execute([$id]);
        $targetRole = $stmtRole->fetchColumn();

        if ($currentUserRole === 'assistant' && $targetRole === 'admin') {
            jsonResponse(false, null, 'Assistants cannot delete Admins');
        }

        $pdo->prepare("DELETE FROM ai_org_users WHERE id = ?")->execute([$id]);

        logAdminAction($pdo, $currentUserId, 'delete_user', 'user', $id, ['target_role' => $targetRole]);

        jsonResponse(true, null, 'User deleted successfully');

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid request');
?>
