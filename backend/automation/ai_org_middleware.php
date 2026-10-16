<?php
// api/ai_org_middleware.php
require_once __DIR__ . '/auth_middleware.php';
// Authentication Middleware for AI Space (Category Chat, Org Chat, Workspace)
// This file should be included at the top of all AI Space API endpoints

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Verify that the user is authenticated for AI Space
 * Returns user data if authenticated, otherwise sends 401 and exits
 */
function requireAISpaceAuth()
{
    global $pdo;
    if (!$pdo instanceof PDO) {
        throw new Exception("Database connection not initialized.");
    }

    $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    $normalizedHeaders = array_change_key_case($allHeaders, CASE_LOWER);

    // ── PRIORITY 0: System Admin Bypass (Overrides everything) ──────────────
    $adminToken = null ?? null ?? $_SERVER['HTTP_XADMINTOKEN'] ?? $_GET['admin_token'] ?? $_POST['admin_token'] ?? '';
    $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
    
    if (($validBypassToken && $adminToken === $validBypassToken) || is_super_admin()) {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION['org_user_id'] = 'admin-001';
            $_SESSION['org_user_role'] = 'admin';
        }
        $GLOBALS['current_admin_id'] = 'admin-001';
        return [
            'id' => 'admin-001',
            'email' => $_SESSION['email'] ?? 'admin@autoflow.vn',
            'full_name' => $_SESSION['full_name'] ?? $_SESSION['username'] ?? 'Super Admin',
            'role' => 'admin',
            'status' => 'active',
            'permissions' => ['*']
        ];
    }

    // ── PRIORITY 1: Bearer Access Token (Authorization header) ──────────────
    // This is the primary auth mechanism. Frontend sends: Authorization: Bearer <token>
    $authHeader = $normalizedHeaders['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (!empty($authHeader) && preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $bearerToken = trim($matches[1]);
        try {
            $stmt = $pdo->prepare("
                SELECT u.*
                FROM ai_org_access_tokens t
                INNER JOIN ai_org_users u ON u.id = t.user_id
                WHERE t.token = ?
                  AND t.expires_at > NOW()
                  AND t.is_active = 1
                LIMIT 1
            ");
            $stmt->execute([$bearerToken]);
            $tokenUser = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($tokenUser) {
                if ($tokenUser['status'] === 'banned') {
                    http_response_code(403);
                    header('Content-Type: application/json');
                    echo json_encode([
                        'success' => false,
                        'error' => 'ACCOUNT_BANNED',
                        'message' => 'Your account has been banned due to policy violations.',
                        'app' => 'ai_space',
                    ]);
                    exit;
                }

                // Update last_used_at for the token
                $pdo->prepare("UPDATE ai_org_access_tokens SET last_used_at = NOW() WHERE token = ?")
                    ->execute([$bearerToken]);

                // Clean & return user data
                unset($tokenUser['password_hash']);
                $tokenUser['permissions'] = json_decode($tokenUser['permissions'] ?? '[]', true);
                if (empty($tokenUser['permissions']) && $tokenUser['role'] === 'admin') {
                    $tokenUser['permissions'] = ['*'];
                }

                // Sync session so session-based code still works
                $_SESSION['org_user_id'] = $tokenUser['id'];
                $_SESSION['org_user_email'] = $tokenUser['email'];
                $_SESSION['org_user_role'] = $tokenUser['role'];
                $GLOBALS['current_admin_id'] = $tokenUser['id'];

                return $tokenUser;
            }
            // Token invalid/expired — fall through to session fallback
        } catch (Exception $e) {
            error_log("Bearer token check error in requireAISpaceAuth: " . $e->getMessage());
        }
    }

    // ── PRIORITY 2: Session (org_user_id set at login) ──────────────────────
    $orgUserId = $GLOBALS['current_admin_id'] ?? null;

    if (!$orgUserId) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $orgUserId = $_SESSION['org_user_id'] ?? $_SESSION['user_id'] ?? null;
        if (!empty($orgUserId) && ($orgUserId == 1 || $orgUserId === '1')) {
            $orgUserId = 'admin-001';
        }
    }

    // ── PRIORITY 3: admin_id query/body param (legacy fallback) ─────────────
    // [FIX H-04] REMOVED: ?admin_id=admin-001 bypass.
    // Accepting 'admin-001' as a GET/POST param grants admin without any real auth check.
    // Users with valid sessions/tokens are already resolved above (Priority 1 & 2).
    // This fallback only verified DB existence for non-admin IDs, but the admin-001 branch
    // had no verification at all. Removed entirely for security.

    // ── PRIORITY 4: Autoflow admin session fallback ──────────────────────────
    // If admin is logged into Autoflow (user_id = 1 / is_admin / role = admin in session),
    // grant full AI Space access as admin-001 even if AI Space token has expired/missing.
    if (!$orgUserId || $orgUserId === ($_SESSION['user_id'] ?? null)) {
        $autoflowUserId = $_SESSION['user_id'] ?? null;
        $autoflowIsAdmin = $_SESSION['is_admin'] ?? null;
        $autoflowRole = $_SESSION['role'] ?? null;
        $autoflowEmail = $_SESSION['email'] ?? null;

        $isAutoflowAdmin =
            ($autoflowUserId == 1 || $autoflowUserId === '1') ||
            (!empty($autoflowIsAdmin)) ||
            ($autoflowRole === 'admin') ||
            (!empty($_SESSION['admin_id']));  // Some Autoflow versions store admin_id

        if ($isAutoflowAdmin) {
            $orgUserId = 'admin-001';
            // Bridge: write org_user_id into session so subsequent calls are instant
            if (session_status() === PHP_SESSION_ACTIVE) {
                $_SESSION['org_user_id'] = 'admin-001';
                $_SESSION['org_user_role'] = 'admin';
            }
            $GLOBALS['current_admin_id'] = 'admin-001';
        }
    }

    // ── PRIORITY 7: X-Autoflow-Auth header (internal-service bypass) ──────────
    // [P21-C1 SECURITY FIX] Previously accepted literal value '1' or 'true' — trivially spoofable.
    // Now requires the same ADMIN_BYPASS_TOKEN constant used by X-Admin-Token.
    // Internal services must send: X-Autoflow-Auth: <ADMIN_BYPASS_TOKEN value>
    if (!$orgUserId) {
        $autoflowAuthHeader = $normalizedHeaders['x-autoflow-auth'] ?? $_SERVER['HTTP_X_AUTOFLOW_AUTH'] ?? '';
        $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
        if (!empty($autoflowAuthHeader) && $validBypassToken && hash_equals($validBypassToken, $autoflowAuthHeader)) {
            $orgUserId = 'admin-001';
            if (session_status() === PHP_SESSION_ACTIVE) {
                $_SESSION['org_user_id'] = 'admin-001';
                $_SESSION['org_user_role'] = 'admin';
            }
            $GLOBALS['current_admin_id'] = 'admin-001';
        }
    }

    // ── PRIORITY 8: x_auth query param — DISABLED for security ─────────────────
    // [P21-C1] GET params appear in nginx logs — never use them for auth bypass.
    // if (!$orgUserId) { $isAuth = $_GET['x_auth'] ?? null; ... } // REMOVED

    if (!$orgUserId) {
        http_response_code(401);
        header('Content-Type: application/json');
        // [FIX P28-S1] SECURITY: Strip sensitive headers (Authorization, Cookie) from debug output.
        // Previously leaked full Authorization header to unauthenticated callers → credential exposure.
        $sensitiveKeys = ['HTTP_AUTHORIZATION', 'HTTP_COOKIE', 'HTTP_X_ADMIN_TOKEN', 'HTTP_X_AUTOFLOW_AUTH'];
        $safeHeaders = [];
        foreach ($_SERVER as $k => $v) {
            if (strpos($k, 'HTTP_') === 0 && !in_array($k, $sensitiveKeys)) {
                $safeHeaders[$k] = $v;
            }
        }
        echo json_encode([
            'success' => false,
            'error' => 'UNAUTHORIZED',
            'message' => 'Authentication required. Please log in to AI Space.',
            'app' => 'ai_space',
            'debug' => [
                'session_id' => session_id(),
                'has_org_user_id' => isset($_SESSION['org_user_id']),
                'has_user_id' => isset($_SESSION['user_id']),
                'safe_headers' => $safeHeaders,
                'get_params' => array_keys($_GET),
                'getallheaders_available' => function_exists('getallheaders')
            ]
        ]);
        exit;
    }

    // Fetch current user data from database

    try {
        // [FIX P28-S2] Exclude password_hash at query level — prevents accidental exposure
        // if a future code path forgets to unset() it before returning.
        $stmt = $pdo->prepare("SELECT id, user_id, email, full_name, role, status, status_reason,
            status_expiry, permissions, admin_id, last_login, created_at, updated_at
            FROM ai_org_users WHERE id = ? OR user_id = ? LIMIT 1");
        $stmt->execute([$orgUserId, $orgUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            // IF it's the main admin (admin-001) but not in ai_org_users table,
            // we treat them as a virtual super admin.
            if ($orgUserId === 'admin-001' || is_super_admin()) {
                return [
                    'id' => 'admin-001',
                    'email' => $_SESSION['email'] ?? 'admin@autoflow.vn',
                    'full_name' => $_SESSION['full_name'] ?? $_SESSION['name'] ?? $_SESSION['username'] ?? 'Super Admin',
                    'role' => 'admin',
                    'status' => 'active',
                    'permissions' => ['*']
                ];
            }

            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User account not found in AI Space.',
                'app' => 'ai_space',
                'user_id' => $orgUserId
            ]);
            exit;
        }

        // FORCE Super Admin rights for admin-001 regardless of database status (except banned)
        if ($orgUserId === 'admin-001' || is_super_admin()) {
            $user['role'] = 'admin';
            $user['permissions'] = json_encode(['*']);
        }

        // Check if user is banned
        if ($user['status'] === 'banned') {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'ACCOUNT_BANNED',
                'message' => 'Your account has been banned due to policy violations.',
                'app' => 'ai_space'
            ]);
            exit;
        }

        // Return user data (without password)
        unset($user['password_hash']);
        $user['permissions'] = json_decode($user['permissions'] ?? '[]', true);

        // CRITICAL: admin-001 is always super admin regardless of DB role
        if ($orgUserId === 'admin-001' || is_super_admin()) {
            $user['role'] = 'admin';
            $user['permissions'] = ['*'];
        }

        if (empty($user['permissions']) && $user['role'] === 'admin') {
            $user['permissions'] = ['*']; // Ensure admin has everything
        }

        return $user;

    } catch (Exception $e) {
        error_log("AI Space Auth Error: " . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'SYSTEM_ERROR',
            'message' => 'Lỗi hệ thống, vui lòng thử lại.',
            'app' => 'ai_space'
        ]);
        exit;
    }
}

/**
 * Verify that the user has access to a specific category
 * @param string $categoryId - The category ID to check access for
 * @param array $user - The authenticated user data
 * @return bool - True if user has access, false otherwise
 */
function requireCategoryAccess($categoryId, $user)
{
    global $pdo;
    if (!$pdo instanceof PDO) {
        return false;
    }

    // Only TRUE super admins bypass the category check:
    // - The hardcoded admin-001
    // - Users with wildcard permissions (e.g. platform owner)
    // - Admins whose admin_id is null (they ARE the top-level org owner, not a sub-admin)
    // Regular admins (role=admin but created under another admin) must be in the group list.
    $isSuperAdmin = (
        ($user['id'] ?? '') === 'admin-001' ||
        is_super_admin() ||
        in_array('*', $user['permissions'] ?? []) ||
        (($user['role'] ?? '') === 'admin' && empty($user['admin_id']))
    );

    if ($isSuperAdmin) {
        return true;
    }

    try {
        // --- STEP 1 + 1.5: Resolve chatbot_xxx and enforce Org Isolation ---
        // [FIX H-05] $userOrgAdminId declared FIRST so the chatbot admin check below is valid.
        $resolvedCategoryId = $categoryId;
        $userOrgAdminId = !empty($user['admin_id']) ? $user['admin_id'] : $user['id'];

        if (strpos($categoryId, 'chatbot_') === 0) {
            $stmtResolve = $pdo->prepare("SELECT c.category_id, cat.admin_id FROM ai_chatbots c LEFT JOIN ai_chatbot_categories cat ON c.category_id = cat.id WHERE c.id = ? LIMIT 1");
            $stmtResolve->execute([$categoryId]);
            $botData = $stmtResolve->fetch(PDO::FETCH_ASSOC);
            if ($botData) {
                $resolvedCategoryId = $botData['category_id'];
                // [SECURITY] If the bot belongs to a different admin, block immediately
                if ($botData['admin_id'] && $botData['admin_id'] !== $userOrgAdminId && $userOrgAdminId !== 'admin-001') {
                    http_response_code(403);
                    header('Content-Type: application/json');
                    echo json_encode([
                        'success' => false,
                        'error' => 'BOT_ACCESS_DENIED',
                        'message' => 'Chatbot này không thuộc tổ chức của bạn.',
                        'app' => 'ai_space'
                    ]);
                    exit;
                }
            }
        }

        $stmtOrgCheck = $pdo->prepare("SELECT admin_id FROM ai_chatbot_categories WHERE id = ? LIMIT 1");
        $stmtOrgCheck->execute([$resolvedCategoryId]);
        $categoryAdminId = $stmtOrgCheck->fetchColumn();
        
        if ($categoryAdminId && $categoryAdminId !== $userOrgAdminId && $userOrgAdminId !== 'admin-001') {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'ORG_ACCESS_DENIED',
                'message' => 'Danh mục này không thuộc tổ chức của bạn.',
                'app' => 'ai_space'
            ]);
            exit;
        }

        // --- STEP 2: Check if ANY restrictions exist for this category ---
        // If NO restrictions are configured → default-allow (opt-in restriction model)
        // This means: a fresh system with no assignments allows everyone to chat.
        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) FROM ai_org_user_categories 
            WHERE category_id = ?
        ");
        $stmtCount->execute([$resolvedCategoryId]);
        $totalRestrictions = (int) $stmtCount->fetchColumn();

        if ($totalRestrictions === 0) {
            // No restrictions configured for this category → allow all authenticated users
            return true;
        }

        // --- STEP 3: Restrictions exist — check if THIS user is allowed ---
        $stmtUser = $pdo->prepare("
            SELECT COUNT(*) FROM ai_org_user_categories 
            WHERE category_id = ? AND user_id = ?
        ");
        $stmtUser->execute([$resolvedCategoryId, $user['id']]);
        if ($stmtUser->fetchColumn() > 0) {
            return true;
        }

        // Also check by user_id string variation (some systems store as string)
        if (!empty($user['user_id'])) {
            $stmtUser2 = $pdo->prepare("
                SELECT COUNT(*) FROM ai_org_user_categories 
                WHERE category_id = ? AND user_id = ?
            ");
            $stmtUser2->execute([$resolvedCategoryId, $user['user_id']]);
            if ($stmtUser2->fetchColumn() > 0) {
                return true;
            }
        }

        // --- STEP 4: If chatbot_id was passed, also try matching by chatbot directly ---
        if ($categoryId !== $resolvedCategoryId) {
            // Already resolved and checked above
        } elseif (strpos($categoryId, 'chatbot_') === 0) {
            // Chatbot has no category → check if user has direct access via any chatbot assignment
            // Allow access since we can't verify category ownership
            return true;
        }

        // Restrictions exist and user is NOT in the allowed list → deny
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'ACCESS_DENIED',
            'message' => 'Bạn không có quyền truy cập danh mục này.',
            'app' => 'ai_space',
            'category_id' => $categoryId
        ]);
        exit;

    } catch (Exception $e) {
        error_log("Category Access Check Error: " . $e->getMessage());
        // On error, DENY access for safety.
        return false;
    }
}


/**
 * Verify that the user has a specific permission
 * @param string $permission - The permission to check (e.g., 'manage_users', 'view_analytics')
 * @param array $user - The authenticated user data
 * @return bool - True if user has permission, false otherwise
 */
function requirePermission($permission, $user)
{
    // Admin has all permissions
    if ($user['role'] === 'admin') {
        return true;
    }

    // Check if user has the specific permission
    $permissions = $user['permissions'] ?? [];
    if (in_array($permission, $permissions)) {
        return true;
    }

    // User doesn't have permission
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'PERMISSION_DENIED',
        'message' => 'You do not have permission to perform this action.',
        'app' => 'ai_space',
        'required_permission' => $permission
    ]);
    exit;
}

/**
 * Optional: Verify access token (for API-based authentication instead of session)
 * This can be used for mobile apps or third-party integrations
 */
function verifyAccessToken()
{
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'MISSING_TOKEN',
            'message' => 'Access token required.',
            'app' => 'ai_space'
        ]);
        exit;
    }

    $token = $matches[1];

    // Verify token in database
    global $pdo;
    if (!$pdo instanceof PDO) {
        throw new Exception("Database connection not initialized.");
    }
    try {
        $stmt = $pdo->prepare("
            SELECT u.* 
            FROM ai_org_users u
            INNER JOIN ai_org_access_tokens t ON u.id = t.user_id
            WHERE t.token = ? AND t.expires_at > NOW() AND t.is_active = 1
            LIMIT 1
        ");
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'INVALID_TOKEN',
                'message' => 'Invalid or expired access token.',
                'app' => 'ai_space'
            ]);
            exit;
        }

        // Check if user is banned
        if ($user['status'] === 'banned') {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'ACCOUNT_BANNED',
                'message' => 'Your account has been banned.',
                'app' => 'ai_space'
            ]);
            exit;
        }

        // Update token last used timestamp
        $pdo->prepare("UPDATE ai_org_access_tokens SET last_used_at = NOW() WHERE token = ?")
            ->execute([$token]);

        // Return user data
        unset($user['password_hash']);
        // [FIX P28-S3] Default to '[]' not '{}' — permissions is an array throughout codebase.
        // json_decode('{}') returns stdClass object → in_array() checks silently fail.
        $user['permissions'] = json_decode($user['permissions'] ?? '[]', true) ?? [];

        return $user;

    } catch (Exception $e) {
        error_log("Token Verification Error: " . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'SYSTEM_ERROR',
            'message' => 'Token verification error.',
            'app' => 'ai_space'
        ]);
        exit;
    }
}

/**
 * Log user activity for audit trail
 */
function logUserActivity($userId, $action, $details = [])
{
    global $pdo;
    if (!$pdo instanceof PDO) {
        throw new Exception("Database connection not initialized.");
    }
    try {
        $stmt = $pdo->prepare("
            INSERT INTO ai_org_user_activity_logs 
            (user_id, action, details, ip_address, user_agent, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $userId,
            $action,
            json_encode($details),
            $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
        ]);
    } catch (Exception $e) {
        // Silent fail - don't block the request if logging fails
        error_log("Activity Log Error: " . $e->getMessage());
    }
}

/**
 * Resolve a property_id (which might be a slug) to its actual UUID
 * @param PDO $pdo - The database connection
 * @param string $propertyId - The slug or ID to resolve
 * @return string - The resolved UUID or the original input if not found
 */
function resolvePropertyId($pdo, $propertyId)
{
    if (empty($propertyId)) {
        return $propertyId;
    }

    // Handled prefixed IDs (UUIDs)
    if (strpos($propertyId, 'category_') === 0 || strpos($propertyId, 'chatbot_') === 0) {
        return $propertyId;
    }

    // Try to resolve category slug, prioritize user's own categories if not admin
    try {
        $adminId = $GLOBALS['current_admin_id'] ?? null;

        // 1. Try category slug
        $stmt = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE slug = ? " . ($adminId ? "ORDER BY (admin_id = ?) DESC" : "") . " LIMIT 1");
        if ($adminId) {
            $stmt->execute([$propertyId, $adminId]);
        } else {
            $stmt->execute([$propertyId]);
        }
        $resolved = $stmt->fetchColumn();
        if ($resolved) {
            return $resolved;
        }

        // 2. Try chatbot slug
        $stmt = $pdo->prepare("SELECT id FROM ai_chatbots WHERE slug = ? LIMIT 1");
        $stmt->execute([$propertyId]);
        $resolved = $stmt->fetchColumn();
        if ($resolved) {
            return $resolved;
        }
    } catch (Exception $e) {
        error_log("Slug resolution error for '$propertyId': " . $e->getMessage());
    }

    return $propertyId;
}

/**
 * Log Admin Action
 * @param PDO $pdo
 * @param int $adminId
 * @param string $action
 * @param string $targetType
 * @param string $targetId
 * @param array $details
 */
function logAdminAction($pdo, $adminId, $action, $targetType, $targetId, $details = [])
{
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $detailsJson = json_encode($details, JSON_UNESCAPED_UNICODE);

        $stmt = $pdo->prepare("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$adminId, $action, $targetType, $targetId, $detailsJson, $ip]);
    } catch (Exception $e) {
        // Silent fail to not disrupt main flow
        error_log("Logging Error: " . $e->getMessage());
    }
}
?>
