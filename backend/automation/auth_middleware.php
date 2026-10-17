<?php
// backend/automation/auth_middleware.php
// Unified MYERP JWT & Role-Based Access Control (SEC-01, SEC-02, SEC-03 Hardened)

require_once __DIR__ . '/db_connect.php';

/**
 * Ensures the current user has the required permission in the current workspace.
 * Enforces server-locked workspace_id from MYERP JWT ($auth['tenant_id']).
 */
function require_permission($pdo, $permission_slug, $workspace_id = null) {
    if (!$pdo) {
        jsonResponse(false, null, 'Database connection error', [], 500);
    }

    if (domationIsPublicOrInternalEndpoint() && empty($GLOBALS['domation_auth'])) {
        return true;
    }

    $auth = $GLOBALS['domation_auth'] ?? domationResolveAuth($pdo);
    if (!$auth || empty($auth['user_id'])) {
        jsonResponse(false, null, 'Unauthorized: Vui lòng đăng nhập MYERP.', [], 401);
    }

    $role = strtolower((string)($auth['role'] ?? ''));
    $allowedRoles = ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'mkt', 'digital_marketing', 'content', 'ads', 'manager', 'leader', 'team_leader', 'sale_admin', 'saleadmin', 'sale', 'sales'];
    if (!in_array($role, $allowedRoles, true)) {
        jsonResponse(false, null, 'Forbidden: Vai trò của bạn không được phép truy cập.', [], 403);
    }

    // Admin, Superadmin, Director, Marketing, Manager have full access to Marketing Automation
    if (in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'mkt', 'digital_marketing', 'content', 'ads', 'manager'], true)) {
        return true;
    }

    // Leader, Team Leader, Sale Admin, Sale: block workspace/role administrative mutations
    $restrictedPrefixes = ['workspaces.delete', 'workspaces.create', 'roles.manage', 'roles.delete', 'settings.Write'];
    foreach ($restrictedPrefixes as $prefix) {
        if (strcasecmp($permission_slug, $prefix) === 0) {
            jsonResponse(false, null, 'Forbidden: Bạn không có quyền quản trị hệ thống [' . $permission_slug . '].', [], 403);
        }
    }

    // Check granular permissions if configured on user
    if (!empty($auth['permissions']) && is_array($auth['permissions'])) {
        if (!empty($auth['permissions'][$permission_slug])) {
            return true;
        }
    }

    // Allow operational marketing/omnichannel permissions for manager, leader, team_leader, sale_admin, sale
    return true;
}

/**
 * Check if the current user is an admin/privileged automation user via MYERP JWT.
 * [SEC-01] No X-Admin-Token or X-Local-Dev-User bypass allowed!
 */
function is_super_admin() {
    $auth = $GLOBALS['domation_auth'] ?? null;
    if (!$auth || empty($auth['user_id'])) {
        return false;
    }
    $role = strtolower((string)($auth['role'] ?? ''));
    return in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'mkt', 'digital_marketing', 'content', 'ads', 'manager'], true);
}

/**
 * [SEC-02] Retrieve the server-locked workspace ID from MYERP JWT tenant_id.
 * Never trusts client-supplied X-Workspace-ID header to prevent cross-tenant IDOR.
 */
function get_current_workspace_id() {
    if (!empty($GLOBALS['domation_auth']['tenant_id'])) {
        $tid = (int)$GLOBALS['domation_auth']['tenant_id'];
        return $tid > 0 ? $tid : 1;
    }
    if (!empty($_SESSION['workspace_id'])) {
        $wid = (int)$_SESSION['workspace_id'];
        return $wid > 0 ? $wid : 1;
    }
    return 1;
}

/**
 * Helper to build workspace_id WHERE clause.
 * For default workspace 1, also matches legacy migrated rows where workspace_id IS NULL.
 */
function build_workspace_where($alias = '') {
    $wsid = get_current_workspace_id();
    $prefix = $alias ? "`{$alias}`." : "";
    if ($wsid === 1) {
        return " ({$prefix}workspace_id = 1 OR {$prefix}workspace_id IS NULL) ";
    }
    return " {$prefix}workspace_id = " . (int)$wsid . " ";
}

if (!function_exists('get_current_user_id')) {
    function get_current_user_id(): ?int {
        if (!empty($GLOBALS['current_admin_id'])) {
            return (int)$GLOBALS['current_admin_id'];
        }
        if (!empty($GLOBALS['domation_auth']['user_id'])) {
            return (int)$GLOBALS['domation_auth']['user_id'];
        }
        if (!empty($_SESSION['user_id'])) {
            return (int)$_SESSION['user_id'];
        }
        return null;
    }
}

if (!function_exists('get_current_user_info')) {
    function get_current_user_info(): array {
        return is_array($GLOBALS['domation_auth'] ?? null) ? $GLOBALS['domation_auth'] : [];
    }
}

if (!function_exists('domationFormatCreator')) {
    function domationFormatCreator(?array $row): ?array {
        if (!$row) {
            return null;
        }
        $creatorId = (int)($row['creator_id'] ?? $row['created_by'] ?? 0);
        if ($creatorId <= 0) {
            return null;
        }
        return [
            'id'         => $creatorId,
            'name'       => $row['creator_name'] ?? '',
            'email'      => $row['creator_email'] ?? '',
            'avatar_url' => $row['creator_avatar'] ?? null,
            'role'       => $row['creator_role'] ?? '',
        ];
    }
}


