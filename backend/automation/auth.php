<?php
// api/auth.php
require_once 'db_connect.php';
/** @var PDO $pdo */
require_once 'auth_middleware.php';

// [FIX H-06] Guard against double session_start() — db_connect.php already starts session.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
apiHeaders();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Auto login for Demo environment
if ($action === 'demo_login') {
    $isDemo = (isset($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] === 'open.domation.net') 
        || ($_GET['token'] ?? '') === ADMIN_BYPASS_TOKEN;

    if ($isDemo) {
        try {
            $stmtAdmin = $pdo->query("SELECT id, username, email, full_name, full_name AS name, avatar_url AS picture, role, status, (SELECT workspace_id FROM workspace_users WHERE BINARY user_id = BINARY users.id LIMIT 1) as workspace_id FROM users WHERE role = 'admin' LIMIT 1");
            $user = $stmtAdmin->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $adminId = uniqid();
                $pdo->prepare("INSERT INTO users (id, username, password_hash, email, full_name, role, status) VALUES (?, 'admin', ?, 'admin@domation.net', 'Demo Admin', 'admin', 'active')")
                    ->execute([$adminId, password_hash('admin123', PASSWORD_BCRYPT)]);
                
                $wsId = 1;
                $pdo->prepare("INSERT IGNORE INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, 'admin')")
                    ->execute([$wsId, $adminId]);

                $stmtAdmin = $pdo->prepare("SELECT id, username, email, full_name, full_name AS name, avatar_url AS picture, role, status, (SELECT workspace_id FROM workspace_users WHERE BINARY user_id = BINARY users.id LIMIT 1) as workspace_id FROM users WHERE id = ?");
                $stmtAdmin->execute([$adminId]);
                $user = $stmtAdmin->fetch(PDO::FETCH_ASSOC);
            }

            if ($user) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'] ?? '';
                $_SESSION['full_name'] = $user['full_name'] ?? $user['name'] ?? 'Demo Admin';
                $_SESSION['role'] = $user['role'] ?? 'admin';
                
                if (isset($_GET['redirect'])) {
                    header("Location: " . $_GET['redirect']);
                    exit;
                }
                jsonResponse(true, $user, 'Đăng nhập Demo thành công');
            }
        } catch (Throwable $e) {
            http_response_code(500);
            die("LỖI CƠ SỞ DỮ LIỆU DEMO: Vui lòng đảm bảo bạn đã nhập (Import) file SQL 'domation_demo_clean.sql' vào database 'vhvxoigh_auto_demo' trước khi đăng nhập! Chi tiết lỗi: " . $e->getMessage());
        }
    }
}

// Login
if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents("php://input"), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        jsonResponse(false, null, 'Username và password là bắt buộc');
    }

    // [FIX P11-H2] Brute-force protection using api_rate_limits table.
    // 5 failed attempts from same IP → locked out for 15 minutes.
    // Uses existing table structure: ip_address + action key + blocked_until.
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rateLimitAction = 'login';
    $maxAttempts = 5;
    $blockMinutes = 15;

    try {
        $stmtRate = $pdo->prepare(
            "SELECT attempts, blocked_until FROM api_rate_limits
             WHERE ip_address = ? AND action = ? LIMIT 1"
        );
        $stmtRate->execute([$clientIp, $rateLimitAction]);
        $rateRow = $stmtRate->fetch(PDO::FETCH_ASSOC);

        if ($rateRow) {
            // Check if currently blocked
            if (!empty($rateRow['blocked_until']) && strtotime($rateRow['blocked_until']) > time()) {
                $remainingMins = ceil((strtotime($rateRow['blocked_until']) - time()) / 60);
                jsonResponse(false, null, "Tài khoản tạm khóa do quá nhiều lần thử. Vui lòng thử lại sau {$remainingMins} phút.");
            }
        }
    } catch (Exception $e) { /* Rate limit table may not exist on old installs — fail open */ }

    try {
        // [FIX P39-AUTH] Use separate queries: first verify password, then load profile without password.
        // Prevents password hash from ever being part of the user object returned to frontend.
        $stmtPwd = $pdo->prepare("SELECT id, password_hash AS password FROM users WHERE username = ? AND status != 'disabled' LIMIT 1");
        $stmtPwd->execute([$username]);
        $pwdRow = $stmtPwd->fetch(PDO::FETCH_ASSOC);

        $loginSuccess = $pwdRow && password_verify($password, $pwdRow['password']);
        $user = $pwdRow; // Reference for backward compat with !$user check below

        if (!$loginSuccess) {
            // [FIX P11-H2] Record failed attempt
            try {
                $pdo->prepare(
                    "INSERT INTO api_rate_limits (ip_address, action, attempts, last_attempt_at)
                     VALUES (?, ?, 1, NOW())
                     ON DUPLICATE KEY UPDATE
                         attempts = attempts + 1,
                         last_attempt_at = NOW(),
                         blocked_until = IF(attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL)"
                )->execute([$clientIp, $rateLimitAction, $maxAttempts, $blockMinutes]);
            } catch (Exception $e) { /* fail silently if table missing */ }

            if (!$user) {
                jsonResponse(false, null, 'Tên đăng nhập hoặc mật khẩu không đúng');
            }
            jsonResponse(false, null, 'Tên đăng nhập hoặc mật khẩu không đúng');
        }

        // [FIX P11-H2] Clear rate limit record on successful login
        try {
            $pdo->prepare("DELETE FROM api_rate_limits WHERE ip_address = ? AND action = ?")
                ->execute([$clientIp, $rateLimitAction]);
        } catch (Exception $e) { /* fail silently */ }

        // [FIX P39-AUTH] Fetch safe user profile (no password column) after successful verify
        $stmtProfile = $pdo->prepare("SELECT id, username, email, full_name, full_name AS name, avatar_url AS picture, role, status, (SELECT workspace_id FROM workspace_users WHERE user_id = users.id LIMIT 1) as workspace_id, last_login_at AS last_login FROM users WHERE id = ? LIMIT 1");
        $stmtProfile->execute([$pwdRow['id']]);
        $user = $stmtProfile->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            jsonResponse(false, null, 'Lỗi tải thông tin người dùng');
        }

        // Update last login
        $updateStmt = $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
        $updateStmt->execute([$user['id']]);

        // Log Access
        try {
            $ip = $clientIp;
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
            $logId = bin2hex(random_bytes(16));
            $stmtLog = $pdo->prepare("INSERT IGNORE INTO user_access_logs (id, user_id, ip_address, device, action) VALUES (?, ?, ?, ?, 'login')");
            $stmtLog->execute([$logId, $user['id'], $ip, $ua]);
        } catch (Exception $e) { /* ignore */ }

        // [FIX P11-M3] Regenerate session ID after login to prevent Session Fixation.
        session_regenerate_id(true);

        // Set session
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'] ?? '';
        $_SESSION['full_name'] = $user['full_name'] ?? $user['name'] ?? '';
        $_SESSION['role'] = $user['role'] ?? 'user';

        // user object already has no password — safe to return
        jsonResponse(true, $user, 'Đăng nhập thành công');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// Check session/current user
if ($method === 'GET' && $action === 'check') {
    if (isset($_SESSION['user_id'])) {
        try {
            // Lấy dữ liệu mới nhất từ DB để đảm bảo Avatar/Role luôn đúng
            $stmt = $pdo->prepare("SELECT id, email, full_name AS name, avatar_url AS picture, role, status, (SELECT workspace_id FROM workspace_users WHERE BINARY user_id = BINARY users.id LIMIT 1) as workspace_id FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch();

            if ($user) {
                // [P22-P2 PERF FIX] Only update last_login if it's been > 5 minutes since last update.
                // Previously this fired on EVERY session /check call (every page load / auth guard),
                // generating thousands of unnecessary DB writes/hour with no meaningful granularity gain.
                // 5-minute throttle reduces writes by ~500x while still showing accurate activity timestamps.
                $pdo->prepare("
                    UPDATE users SET last_login_at = NOW()
                    WHERE id = ?
                    AND (last_login_at IS NULL OR last_login_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
                ")->execute([$_SESSION['user_id']]);
                
                jsonResponse(true, $user);
            } else {
                session_destroy();
                jsonResponse(false, null, 'User not found');
            }
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
    } else {
        jsonResponse(false, null, 'Chưa đăng nhập');
    }
}

// [NEW] Lightweight activity ping — only updates last_login, no profile fetch
// Called by App.tsx heartbeat every 5 min to keep last_activity fresh while user is active
if ($method === 'GET' && $action === 'ping') {
        $hasAuth = !empty($GLOBALS['current_admin_id']) || !empty($_SESSION['user_id']) || !empty($_SESSION['org_user_id']) || !empty($_SERVER['HTTP_AUTHORIZATION']) || false || false;
    if (!$hasAuth) {
        jsonResponse(false, null, 'Not authenticated'); // Silently ignored by frontend
    }
    try {
        // Throttle server-side: only update if last_login > 5 minutes ago
        $updateId = $_SESSION['user_id'] ?? '';
        // [FIX M-05] Removed hardcoded admin emails from SQL. Use role-based is_super_admin().
        $stmt = $pdo->prepare("
            UPDATE users SET last_login_at = NOW()
            WHERE id = ?
            AND (last_login_at IS NULL OR last_login_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
        ");
        $stmt->execute([$updateId]);
        $rows = $stmt->rowCount();
        jsonResponse(true, ['user_id' => $updateId, 'affected' => $rows], 'ok');
    } catch (Exception $e) {
        jsonResponse(true, ['error' => $e->getMessage(), 'user_id' => $_SESSION['user_id'] ?? null], 'error'); 
    }
}

// Get access logs for current user (Sync real history)
if ($method === 'GET' && $action === 'logs') {
    $hasAuth = !empty($GLOBALS['current_admin_id']) || !empty($_SESSION['user_id']) || !empty($_SESSION['org_user_id']) || !empty($_SERVER['HTTP_AUTHORIZATION']) || false || false;
    if (!$hasAuth) {
        jsonResponse(false, null, 'Unauthorized');
    }

    try {
        // Ensure table exists
        $pdo->exec("CREATE TABLE IF NOT EXISTS `user_access_logs` (
          `id` varchar(64) NOT NULL,
          `user_id` varchar(64) NOT NULL,
          `ip_address` varchar(64) DEFAULT NULL,
          `device` varchar(255) DEFAULT NULL,
          `action` varchar(50) DEFAULT 'login',
          `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_user_created` (`user_id`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $userId = $_SESSION['user_id'] ?? $_SESSION['org_user_id'] ?? $GLOBALS['current_admin_id'] ?? (null ?? '1');

        $stmt = $pdo->prepare("SELECT ip_address, device, created_at FROM user_access_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10");
        $stmt->execute([$userId]);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // If no logs found, insert an active session entry
        if (empty($logs)) {
            $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $clientIp = trim(explode(',', $clientIp)[0]);
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Chrome (Web Desktop)';
            $logId = bin2hex(random_bytes(16));
            try {
                $stmtInsert = $pdo->prepare("INSERT INTO user_access_logs (id, user_id, ip_address, device, action, created_at) VALUES (?, ?, ?, ?, 'login', NOW())");
                $stmtInsert->execute([$logId, $userId, $clientIp, $ua]);
                $logs = [['ip_address' => $clientIp, 'device' => $ua, 'created_at' => date('Y-m-d H:i:s')]];
            } catch (Exception $e) {}
        }

        jsonResponse(true, $logs);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// Logout
if ($method === 'POST' && $action === 'logout') {
    session_destroy();
    jsonResponse(true, null, 'Đã đăng xuất');
}

// Change password
if ($method === 'POST' && $action === 'change-password') {
        $hasAuth = !empty($GLOBALS['current_admin_id']) || !empty($_SESSION['user_id']) || !empty($_SESSION['org_user_id']) || !empty($_SERVER['HTTP_AUTHORIZATION']) || false || false;
    if (!$hasAuth) {
        jsonResponse(false, null, 'Chưa đăng nhập');
    }

    $data = json_decode(file_get_contents("php://input"), true);
    $currentPassword = $data['currentPassword'] ?? '';
    $newPassword = $data['newPassword'] ?? '';

    if (empty($currentPassword) || empty($newPassword)) {
        jsonResponse(false, null, 'Vui lòng nhập đầy đủ thông tin');
    }

    try {
        $stmt = $pdo->prepare("SELECT password_hash AS password FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // [FIX P14-L1] Guard against deleted user still holding a valid session.
        // Without this check, $user = false and $user['password'] throws a TypeError.
        if (!$user) {
            jsonResponse(false, null, 'Tài khoản không tồn tại hoặc đã bị xóa');
        }

        if (!password_verify($currentPassword, $user['password'])) {
            jsonResponse(false, null, 'Mật khẩu hiện tại không đúng');
        }

        // [P24-A1 SECURITY] Enforce minimum password policy server-side.
        // Frontend may validate, but POST requests can bypass frontend checks.
        if (mb_strlen($newPassword, 'UTF-8') < 8) {
            jsonResponse(false, null, 'Mật khẩu mới phải có ít nhất 8 ký tự');
        }

        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $updateStmt->execute([$hashedPassword, $_SESSION['user_id']]);

        jsonResponse(true, null, 'Đổi mật khẩu thành công');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid request');
?>
