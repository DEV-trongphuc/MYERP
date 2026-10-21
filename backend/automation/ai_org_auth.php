<?php
// api/ai_org_auth.php
// NOTE: session_set_cookie_params MUST be called BEFORE session_start.
// db_connect.php already calls session_start(), so we handle remember-me differently.

// [FIX H-01] Set CUSTOM_SESSION_LIFETIME before db_connect.php starts the session.
// db_connect.php now reads this constant to set the correct cookie lifetime.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'login') {
    $rawInput = file_get_contents('php://input');
    $peekInput = json_decode($rawInput, true);
    $remember = !empty($peekInput['remember']) && $peekInput['remember'] === true;
    // Remember me = 30 days; No remember me = session cookie (browser close clears it)
    define('CUSTOM_SESSION_LIFETIME', $remember ? 2592000 : 0);
    $isSecure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    session_set_cookie_params([
        'lifetime' => CUSTOM_SESSION_LIFETIME,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
}

require_once 'db_connect.php';
require_once 'auth_middleware.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random token (hex string, 64 chars)
 */
function generateSecureToken(): string
{
    return bin2hex(random_bytes(32)); // 256-bit token
}

/**
 * Create a new access token (15 minutes) for a given user and store in DB.
 * Returns the token string.
 */
function createAccessToken($pdo, string $userId): string
{
    $token = generateSecureToken();
    $expiresAt = date('Y-m-d H:i:s', time() + 3600); // 1 hour (increased from 15m)

    // [FIX] Removed forced revocation of old access tokens.
    // Revoking old tokens causes a race condition when multiple parallel API requests 
    // try to refresh an expired token simultaneously (e.g. when opening dashboard after 15 mins).
    // It also causes users to be logged out of other tabs/devices.
    // $pdo->prepare("UPDATE ai_org_access_tokens SET is_active = 0 WHERE user_id = ? AND is_active = 1")
    //     ->execute([$userId]);

    $pdo->prepare(
        "INSERT INTO ai_org_access_tokens (user_id, token, expires_at, is_active, created_at)
         VALUES (?, ?, ?, 1, NOW())"
    )->execute([$userId, $token, $expiresAt]);

    return $token;
}

/**
 * Create a new refresh token (30 days) for a given user and store in DB.
 * Returns the token string.
 */
function createRefreshToken($pdo, string $userId, bool $remember = false): string
{
    $token = generateSecureToken();
    $days = $remember ? 30 : 7; // 30 days if remember-me, else 7 days
    $expiresAt = date('Y-m-d H:i:s', time() + $days * 24 * 60 * 60);
    $deviceInfo = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 255);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // [FIX] Disabled strict revocation to allow multi-device/multi-tab sessions.
    // Revoking old tokens causes users to be forcefully logged out on their other tabs/devices
    // whenever auto_login_group_admin runs or when they log in on a new device.
    /*
    $pdo->prepare("UPDATE ai_org_refresh_tokens SET is_active = 0 WHERE user_id = ? AND is_active = 1")
        ->execute([$userId]);
    */

    $pdo->prepare(
        "INSERT INTO ai_org_refresh_tokens (user_id, token, expires_at, is_active, device_info, ip_address, created_at)
         VALUES (?, ?, ?, 1, ?, ?, NOW())"
    )->execute([$userId, $token, $expiresAt, $deviceInfo, $ip]);

    return $token;
}

/**
 * Build the standard auth response payload (user + tokens)
 */
function buildAuthResponse($pdo, array $user, bool $remember = false): array
{
    $userId = $user['id'];

    // Generate both tokens
    $accessToken = createAccessToken($pdo, (string) $userId);
    $refreshToken = createRefreshToken($pdo, (string) $userId, $remember);

    // Also set session for backwards-compatibility
    $_SESSION['org_user_id'] = $userId;
    $_SESSION['org_user_email'] = $user['email'];
    $_SESSION['org_user_role'] = $user['role'];
    $_SESSION['org_user_name'] = $user['full_name'];
    $_SESSION['org_user_permissions'] = is_array($user['permissions'])
        ? json_encode($user['permissions'])
        : ($user['permissions'] ?? '[]');

    // Clean user object before sending
    unset($user['password_hash']);
    if (is_string($user['permissions'])) {
        $user['permissions'] = json_decode($user['permissions'], true);
    }

    return [
        'user' => $user,
        'access_token' => $accessToken,
        'refresh_token' => $refreshToken,
        'expires_in' => 3600, // 1 hour in seconds
        'token_type' => 'Bearer',
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Organization Login (Email/Password)
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'login') {
    $input = isset($peekInput) ? $peekInput : json_decode(file_get_contents('php://input'), true);
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $remember = !empty($input['remember']) && $input['remember'] === true;

    if (empty($email) || empty($password)) {
        jsonResponse(false, null, 'Email and password are required');
    }

    // [SECURITY] Brute-force protection: max 5 failed attempts per IP per 10 minutes
    $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $clientIp = trim(explode(',', $clientIp)[0]); // Take first IP if behind proxy
    $ipKey = 'login_attempt_' . md5($clientIp);
    $attemptData = json_decode($_SESSION[$ipKey] ?? '{}', true);
    $now = time();
    $windowStart = $now - 600; // 10-minute window

    // Clean up old timestamps outside the window
    $attemptData['timestamps'] = array_filter($attemptData['timestamps'] ?? [], fn($t) => $t > $windowStart);

    if (count($attemptData['timestamps']) >= 5) {
        $waitSeconds = (int)(min($attemptData['timestamps']) + 600 - $now);
        http_response_code(429);
        jsonResponse(false, null, "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau {$waitSeconds} giây.");
    }

    try {
        // [FIX P42-A1] SELECT * exposed password_hash and other sensitive fields in memory.
        // Explicit columns — password_hash needed for verification, then stripped in buildAuthResponse().
        $stmt = $pdo->prepare("SELECT id, user_id, email, password_hash, full_name, role, status, permissions, gender,
            last_login, created_at, updated_at FROM ai_org_users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            // Record failed attempt
            $attemptData['timestamps'][] = $now;
            $_SESSION[$ipKey] = json_encode($attemptData);
            jsonResponse(false, null, 'Invalid email or password');
        }
        if ($user['status'] === 'banned') {
            jsonResponse(false, null, 'Your account has been banned due to policy violations.');
        }

        // Successful login — clear rate limit counter for this IP
        unset($_SESSION[$ipKey]);

        // Update last login
        $pdo->prepare("UPDATE ai_org_users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);

        // Build response with tokens
        $authData = buildAuthResponse($pdo, $user, $remember);

        jsonResponse(true, $authData, 'Login successful');

    } catch (Exception $e) {
        error_log("Org Auth Login Error: " . $e->getMessage());
        jsonResponse(false, null, 'System error during login');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Google Login
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'google_login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $credential = $input['credential'] ?? '';

    if (empty($credential)) {
        jsonResponse(false, null, 'No credential provided');
    }

    $googleApiUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($credential);
    $ch = curl_init($googleApiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    // [SECURITY FIX] Enable SSL peer verification for Google API calls.
    // Without CURLOPT_SSL_VERIFYPEER=true, a MITM attacker could intercept the tokeninfo
    // response and inject a fake token that bypasses Google OAuth verification.
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        jsonResponse(false, null, 'Invalid Google Token');
    }

    $googleData = json_decode($response, true);
    $email = $googleData['email'] ?? '';

    if (empty($email)) {
        jsonResponse(false, null, 'Could not retrieve email from Google');
    }

    // [SECURITY] Validate email is verified by Google
    if (($googleData['email_verified'] ?? 'false') !== 'true') {
        jsonResponse(false, null, 'Google email is not verified. Please verify your Google account first.');
    }

    try {
        // [FIX P42-A2] Explicit columns for Google login user lookup
        $stmt = $pdo->prepare("SELECT id, user_id, email, password_hash, full_name, role, status, permissions, gender,
            last_login, created_at, updated_at FROM ai_org_users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            jsonResponse(false, null, 'Access Denied. You must be added to the Organization by an administrator.');
        }
        if ($user['status'] === 'banned') {
            jsonResponse(false, null, 'Your account has been banned.');
        }

        $name = $googleData['name'] ?? $user['full_name'];
        $pdo->prepare("UPDATE ai_org_users SET last_login = NOW(), full_name = ? WHERE id = ?")
            ->execute([$name, $user['id']]);
        $user['full_name'] = $name;

        $authData = buildAuthResponse($pdo, $user);

        jsonResponse(true, $authData, 'Google login successful');

    } catch (Exception $e) {
        error_log("Org Auth Google Login Error: " . $e->getMessage());
        jsonResponse(false, null, 'System error during Google login');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Refresh Token — issue new access token using refresh token
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'refresh_token') {
    $input = json_decode(file_get_contents('php://input'), true);
    $refreshToken = $input['refresh_token'] ?? '';

    if (empty($refreshToken)) {
        http_response_code(401);
        jsonResponse(false, null, 'Refresh token required');
    }

    try {
        // Look up the refresh token
        $stmt = $pdo->prepare("
            SELECT rt.*, u.*
            FROM ai_org_refresh_tokens rt
            INNER JOIN ai_org_users u ON u.id = rt.user_id
            WHERE rt.token = ?
              AND rt.expires_at > NOW()
              
            LIMIT 1
        ");
        $stmt->execute([$refreshToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(401);
            jsonResponse(false, null, 'Invalid or expired refresh token');
        }

        if ($row['status'] === 'banned') {
            http_response_code(403);
            jsonResponse(false, null, 'Account has been banned.');
        }

        // Update last_used_at on refresh token
        $pdo->prepare("UPDATE ai_org_refresh_tokens SET last_used_at = NOW() WHERE token = ?")
            ->execute([$refreshToken]);

        // Issue a new access token ONLY (keep same refresh token alive)
        $newAccessToken = createAccessToken($pdo, (string) $row['user_id']);

        // Update session too — ensure session is active
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION['org_user_id'] = $row['user_id'];
        $_SESSION['org_user_email'] = $row['email'];
        $_SESSION['org_user_role'] = $row['role'];

        jsonResponse(true, [
            'access_token' => $newAccessToken,
            'expires_in' => 3600,
            'token_type' => 'Bearer',
        ], 'Token refreshed');

    } catch (Exception $e) {
        error_log("Refresh Token Error: " . $e->getMessage());
        jsonResponse(false, null, 'System error during token refresh');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Logout — revoke tokens + clear session
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'logout') {
    $input = json_decode(file_get_contents('php://input'), true);
    $refreshToken = $input['refresh_token'] ?? '';
    $accessToken = '';

    // Parse Bearer token from header
    $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    $normalized = array_change_key_case($allHeaders, CASE_LOWER);
    $authHeader = $normalized['authorization'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $m)) {
        $accessToken = $m[1];
    }

    try {
        if ($accessToken) {
            $pdo->prepare("UPDATE ai_org_access_tokens SET is_active = 0 WHERE token = ?")
                ->execute([$accessToken]);
        }
        if ($refreshToken) {
            $pdo->prepare("UPDATE ai_org_refresh_tokens SET is_active = 0 WHERE token = ?")
                ->execute([$refreshToken]);
        }
    } catch (Exception $e) {
        // fail silently — still clear session
    }

    unset(
        $_SESSION['org_user_id'],
        $_SESSION['org_user_email'],
        $_SESSION['org_user_role'],
        $_SESSION['org_user_name'],
        $_SESSION['org_user_permissions']
    );

    jsonResponse(true, null, 'Logged out successfully');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Check Session / Token (GET) — verify access token OR session
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'check') {
    // --- Try Bearer token first ---
    $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    $normalized = array_change_key_case($allHeaders, CASE_LOWER);
    $authHeader = $normalized['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $bearerToken = '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $m)) {
        $bearerToken = trim($m[1]);
    }

    if ($bearerToken) {
        try {
            $stmt = $pdo->prepare("
                SELECT u.*
                FROM ai_org_access_tokens t
                INNER JOIN ai_org_users u ON u.id = t.user_id
                WHERE t.token = ?
                  AND t.expires_at > NOW()
                  
                LIMIT 1
            ");
            $stmt->execute([$bearerToken]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user && $user['status'] !== 'banned') {
                $pdo->prepare("UPDATE ai_org_access_tokens SET last_used_at = NOW() WHERE token = ?")
                    ->execute([$bearerToken]);
                unset($user['password_hash']);
                $user['permissions'] = json_decode($user['permissions'] ?? '[]', true);
                if (empty($user['permissions']) && $user['role'] === 'admin') {
                    $user['permissions'] = ['*'];
                }
                jsonResponse(true, $user, 'Token valid');
            }
            // If token invalid/expired — fall through to session check below
        } catch (Exception $e) {
            error_log("Token check error: " . $e->getMessage());
        }
    }

    // --- Fallback: Session & X-Admin-Token ---
    $orgUserId = $_SESSION['org_user_id'] ?? null;
    $mainUserId = $_SESSION['user_id'] ?? null;

    if (!$orgUserId) {
        $adminTokenHeader = $normalized['x-admin-token'] ?? null ?? '';
        $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
        // [FIX C-01] REMOVED hardcoded backdoor: || $adminTokenHeader === 'admin-001'
        // Any caller with literal 'admin-001' could bypass all auth. Now requires valid computed token.
        if (($validBypassToken && $adminTokenHeader === $validBypassToken) || is_super_admin()) {
            $orgUserId = 'admin-001';
            $_SESSION['org_user_id'] = 'admin-001';
        }
    }

    // NOTE: Autoflow session fallback is intentionally REMOVED from `action=check`.
    // If there is no valid AI-Space JWT or explicit ai_space session, we return
    // failure so the frontend can trigger `auto_login_group_admin` to pick the
    // real top admin of the requested category instead of using the virtual admin-001.

    if ($orgUserId) {
        try {
            // [FIX P42-A3] SELECT * on session check — explicit columns, password_hash excluded
            $stmt = $pdo->prepare("SELECT id, user_id, email, full_name, role, status, permissions, gender,
                last_login, created_at, updated_at FROM ai_org_users WHERE id = ? OR user_id = ?");
            $stmt->execute([$orgUserId, $orgUserId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user && $user['status'] !== 'banned') {
                if ($orgUserId === 'admin-001' || is_super_admin()) {
                    $user['role'] = 'admin';
                    $user['permissions'] = ['*'];
                } else {
                    $user['permissions'] = json_decode($user['permissions'] ?? '[]', true);
                    if (empty($user['permissions']) && $user['role'] === 'admin') {
                        $user['permissions'] = ['*'];
                    }
                }
                unset($user['password_hash']);
                jsonResponse(true, $user);

            } elseif ($orgUserId === 'admin-001' || is_super_admin()) {
                jsonResponse(true, [
                    'id' => 'admin-001',
                    'email' => $_SESSION['email'] ?? $_SESSION['org_user_email'] ?? 'admin@autoflow.vn',
                    'full_name' => $_SESSION['full_name'] ?? $_SESSION['username'] ?? $_SESSION['org_user_name'] ?? 'Super Admin',
                    'role' => 'admin',
                    'status' => 'active',
                    'permissions' => ['*'],
                ]);
            } else {
                jsonResponse(false, null, 'Session invalid or user not found');
            }
        } catch (Exception $e) {
            jsonResponse(false, null, 'Error checking session');
        }
    } else {
        jsonResponse(false, null, 'Not logged in');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5b. Auto-Login as Top Admin of a specific Group/Category
// Called when an Autoflow admin links over to AI-Space.
// Finds the earliest-created admin of that category and issues tokens.
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'auto_login_group_admin') {
    $input = json_decode(file_get_contents('php://input'), true);
    $categorySlug = trim($input['category_id'] ?? '');
    $bypassToken = $input['bypass_token'] ?? '';

    // Validate bypass token (Must be defined in db_connect.php)
    $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
    if (!$validBypassToken || $bypassToken !== $validBypassToken) {
        jsonResponse(false, null, 'Unauthorized: Invalid Bypass Token');
    }

    if (empty($categorySlug)) {
        jsonResponse(false, null, 'category_id is required');
    }

    try {
        // 1. Resolve slug → real category ID
        $categoryId = $categorySlug;

        // Try as a direct ID first (prefixed UUIDs)
        if (strpos($categorySlug, 'category_') !== 0) {
            $stmtSlug = $pdo->prepare(
                "SELECT id FROM ai_chatbot_categories WHERE slug = ? OR id = ? LIMIT 1"
            );
            $stmtSlug->execute([$categorySlug, $categorySlug]);
            $resolved = $stmtSlug->fetchColumn();
            if ($resolved) {
                $categoryId = $resolved;
            }
        }

        // 2. Find the top (earliest-created) admin of this category
        //    Priority: admin_id column on category, then ai_org_users with role=admin linked to category
        $topAdmin = null;

        // 2a. Check ai_chatbot_categories.admin_id (the category owner)
        $stmtOwner = $pdo->prepare(
            "SELECT u.* FROM ai_chatbot_categories c
             JOIN ai_org_users u ON (u.id = c.admin_id OR u.user_id = c.admin_id)
             WHERE c.id = ? AND u.status = 'active'
             LIMIT 1"
        );
        $stmtOwner->execute([$categoryId]);
        $topAdmin = $stmtOwner->fetch(PDO::FETCH_ASSOC);

        // 2b. Fallback: earliest admin in ai_org_users for this category via ai_org_user_categories
        if (!$topAdmin) {
            $stmtAdmin = $pdo->prepare(
                "SELECT u.* FROM ai_org_users u
                 JOIN ai_org_user_categories uc ON uc.user_id = u.id
                 WHERE uc.category_id = ? AND u.role = 'admin' AND u.status = 'active'
                 ORDER BY u.created_at ASC
                 LIMIT 1"
            );
            $stmtAdmin->execute([$categoryId]);
            $topAdmin = $stmtAdmin->fetch(PDO::FETCH_ASSOC);
        }

        // 2c. Global fallback: earliest admin in ai_org_users overall (admin-001 style)
        if (!$topAdmin) {
            $stmtGlobal = $pdo->prepare(
                "SELECT * FROM ai_org_users
                 WHERE role = 'admin' AND status = 'active'
                 ORDER BY created_at ASC
                 LIMIT 1"
            );
            $stmtGlobal->execute();
            $topAdmin = $stmtGlobal->fetch(PDO::FETCH_ASSOC);
        }

        if (!$topAdmin) {
            jsonResponse(false, null, 'No active admin found for this group');
        }

        // 3. Issue tokens and return auth data
        $topAdmin['role'] = 'admin';
        $topAdmin['permissions'] = ['*'];

        $authData = buildAuthResponse($pdo, $topAdmin, false);

        // Update last login timestamp
        $pdo->prepare("UPDATE ai_org_users SET last_login = NOW() WHERE id = ?")
            ->execute([$topAdmin['id']]);

        jsonResponse(true, $authData, 'Auto-login as group admin successful');

    } catch (Exception $e) {
        error_log("auto_login_group_admin error: " . $e->getMessage());
        jsonResponse(false, null, 'System error during auto-login');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5c. Admin Auto-Login (backwards compatible - legacy)
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'admin_auto_login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $mainUserId = $_SESSION['user_id'] ?? null;

    // PRIMARY: Shared session
    if ($mainUserId == 1 || $mainUserId === '1') {
        $_SESSION['org_user_id'] = 'admin-001';

        // Try to issue real tokens for admin-001
        try {
            $stmt = $pdo->prepare("SELECT id, user_id, email, full_name, role, status, permissions, gender,
                last_login, created_at, updated_at FROM ai_org_users WHERE id = 'admin-001' OR user_id = 1 LIMIT 1");
            $stmt->execute();
            $adminUser = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($adminUser) {
                $adminUser['role'] = 'admin';
                $adminUser['permissions'] = ['*'];
                $authData = buildAuthResponse($pdo, $adminUser);
                jsonResponse(true, $authData, 'Admin auto-login successful');
            }
        } catch (Exception $e) { /* fall through */
        }

        jsonResponse(true, [
            'id' => 'admin-001',
            'email' => $_SESSION['email'] ?? 'admin@autoflow.vn',
            'full_name' => $_SESSION['full_name'] ?? $_SESSION['username'] ?? 'Super Admin',
            'role' => 'admin',
            'status' => 'active',
            'permissions' => ['*'],
        ], 'Admin auto-login successful');
    }

    // FALLBACK: Cross-origin session bridge
    $requestUserId = $input['user_id'] ?? null;
    $requestRole = $input['role'] ?? '';
    $requestIsAdmin = $input['is_admin'] ?? false;
    $bypassToken = $input['bypass_token'] ?? '';

    // Accept bypass_token from frontend (admin coming from Autoflow cross-origin)
    $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
    $isBypassTokenValid = ($validBypassToken && $bypassToken === $validBypassToken);

    // Only allow if we have a strong reason to believe this is an admin
    if ($isBypassTokenValid && ($requestUserId == 1 || $requestRole === 'admin' || $requestIsAdmin)) {
        $isConfirmedAdmin = false;
        try {
            // Verify against primary users table if they are ID 1
            if ($requestUserId == 1 || $requestUserId === '1') {
                $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE id = 1 LIMIT 1");
                $stmtCheck->execute();
                if ($stmtCheck->fetchColumn()) {
                    $isConfirmedAdmin = true;
                }
            } elseif (!empty($input['email'])) {
                $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
                $stmtCheck->execute([$input['email']]);
                if ($stmtCheck->fetchColumn()) {
                    $isConfirmedAdmin = true;
                }
            }
        } catch (Exception $e) {
            // Localhost/dev safety fallback
            $host = $_SERVER['HTTP_HOST'] ?? '';
            if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
                $isConfirmedAdmin = true;
            }
        }

        // Also grant access if session has X-Autoflow-Auth = 1 or the headers match
        if (!$isConfirmedAdmin) {
            $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
            $normalizedH = array_change_key_case($allHeaders, CASE_LOWER);
            $autoflowAuth = $normalizedH['x-autoflow-auth'] ?? $_SERVER['HTTP_X_AUTOFLOW_AUTH'] ?? '';
            if ($autoflowAuth === '1' || $autoflowAuth === 'true') {
                $isConfirmedAdmin = true;
            }
        }

        if ($isConfirmedAdmin) {
            $_SESSION['org_user_id'] = 'admin-001';

            // Try to get real user data from ai_org_users
            try {
                $stmtAdmin = $pdo->prepare("SELECT id, user_id, email, full_name, role, status, permissions, gender,
                    last_login, created_at, updated_at FROM ai_org_users WHERE id = 'admin-001' OR user_id = 1 LIMIT 1");
                $stmtAdmin->execute();
                $adminUser = $stmtAdmin->fetch(PDO::FETCH_ASSOC);
                if ($adminUser) {
                    $adminUser['role'] = 'admin';
                    $adminUser['permissions'] = ['*'];
                    $authData = buildAuthResponse($pdo, $adminUser);
                    jsonResponse(true, $authData, 'Admin auto-login successful (cross-origin bridge)');
                }
            } catch (Exception $e) { /* fall through */
            }

            jsonResponse(true, [
                'user' => [
                    'id' => 'admin-001',
                    'email' => $input['email'] ?? ($_SESSION['email'] ?? 'admin@autoflow.vn'),
                    'full_name' => $input['full_name'] ?? 'Super Admin',
                    'role' => 'admin',
                    'status' => 'active',
                    'permissions' => ['*'],
                ]
            ], 'Admin auto-login successful (session bridge)');
            exit;
        }
    }

    jsonResponse(false, null, 'Unauthorized: Not an admin session');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Update Profile
// ─────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'update_profile') {
    $currentUserId = $_SESSION['org_user_id'] ?? null;
    if (!$currentUserId) {
        // Also accept Bearer token
        $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
        $normalized = array_change_key_case($allHeaders, CASE_LOWER);
        $authHeader = $normalized['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $m)) {
            $stmt = $pdo->prepare("SELECT user_id FROM ai_org_access_tokens WHERE token = ? AND expires_at > NOW() AND is_active = 1 LIMIT 1");
            $stmt->execute([trim($m[1])]);
            $currentUserId = $stmt->fetchColumn();
        }
    }

    if (!$currentUserId) {
        jsonResponse(false, null, 'Not logged in');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $fullName = $input['full_name'] ?? '';
    $password = $input['password'] ?? '';

    try {
        $fields = [];
        $params = [];

        if (!empty($fullName)) {
            $fields[] = "full_name = ?";
            $params[] = $fullName;
            $_SESSION['org_user_name'] = $fullName;
        }
        if (isset($input['gender'])) {
            $fields[] = "gender = ?";
            $params[] = $input['gender'];
        }
        if (!empty($password)) {
            // [P24-A2 SECURITY] Enforce 8-char minimum — mirrors auth.php policy for consistency.
            if (mb_strlen($password, 'UTF-8') < 8) {
                jsonResponse(false, null, 'Mật khẩu phải có ít nhất 8 ký tự');
            }
            $fields[] = "password_hash = ?";
            $params[] = password_hash($password, PASSWORD_DEFAULT);
        }

        if (empty($fields)) {
            jsonResponse(false, null, 'No fields to update');
        }

        $params[] = $currentUserId;
        $sql = "UPDATE ai_org_users SET " . implode(", ", $fields) . ", updated_at = NOW() WHERE id = ?";
        $pdo->prepare($sql)->execute($params);

        jsonResponse(true, null, 'Profile updated successfully');

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid request');
?>
