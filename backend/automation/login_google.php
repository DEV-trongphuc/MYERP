<?php
// api/login_google.php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $credential = $data['credential'] ?? '';

    if (empty($credential)) {
        jsonResponse(false, null, 'Credential is required');
    }

    // Verify Google Token via Google API
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($credential));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);  // [SECURITY] Enforce TLS for Google OAuth
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        jsonResponse(false, null, 'Invalid Google Token');
    }

    $payload = json_decode($response, true);

    // [FIX NC-02] Validate 'aud' claim — token MUST be issued for THIS app's Client ID.
    // Google's /tokeninfo verifies the signature but not the audience.
    // Without this check, a token from ANY Google app could be used to login here.
    $expectedClientId = '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com';
    $tokenAud = $payload['aud'] ?? '';
    if ($tokenAud !== $expectedClientId) {
        jsonResponse(false, null, 'Invalid token audience');
    }

    $email = $payload['email'];
    if (empty($email)) {
        jsonResponse(false, null, 'Could not extract email from Google token');
    }
    $name = $payload['name'] ?? 'User';
    $picture = $payload['picture'] ?? '';


    try {
        // Find user by email
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Auto Register new user
            // [FIX NC-03] Use named constant matching ROOT_ADMIN_EMAILS in admin_users.php.
            // IMPORTANT: If you change admin emails, update BOTH this file AND admin_users.php.
            // TODO: Move to a shared config file (e.g. config.php) to avoid duplication.
            if (!defined('ROOT_ADMIN_EMAILS')) {
                define('ROOT_ADMIN_EMAILS', [
                    'dom.marketing.vn@gmail.com',
                    'marketing@ideas.edu.vn',
                    'ledaovuphuong@gmail.com'
                ]);
            }
            $role = in_array($email, ROOT_ADMIN_EMAILS) ? 'admin' : 'user';
            $status = in_array($email, ROOT_ADMIN_EMAILS) ? 'approved' : 'pending';

            $userId = bin2hex(random_bytes(16));
            $insert = $pdo->prepare("INSERT INTO users (id, username, email, name, picture, role, status, google_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $insert->execute([$userId, $email, $email, $name, $picture, $role, $status, $payload['sub']]);
            $user = [
                'id' => $userId,
                'email' => $email,
                'name' => $name,
                'picture' => $picture,
                'role' => $role,
                'status' => $status
            ];
        } else {
            // Update last login
            $update = $pdo->prepare("UPDATE users SET last_login = NOW(), picture = ?, name = ? WHERE id = ?");
            $update->execute([$picture, $name, $user['id']]);
            $user['picture'] = $picture;
            $user['name'] = $name;
        }

        if ($user['status'] !== 'approved') {
            // [FIX NM-02] Unset sensitive fields before returning to client.
            unset($user['password_hash'], $user['google_id']);
            jsonResponse(true, $user, 'PENDING_APPROVAL');
        }

        // [FIX NH-02] Replace @session_start() suppression with proper guard.
        // @session_start() silently fails if session is active — data may not be written.
        // db_connect.php calls session_write_close() only on GET requests;
        // login_google is POST → session should still be active here.
        // If somehow closed (edge case), re-open properly.
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['name'] = $user['name'];
        $_SESSION['picture'] = $user['picture'];
        $_SESSION['status'] = $user['status'];
        
        // Log Access
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
            $logId = bin2hex(random_bytes(16));
            $stmtLog = $pdo->prepare("INSERT INTO user_access_logs (id, user_id, ip_address, device, action) VALUES (?, ?, ?, ?, 'login')");
            $stmtLog->execute([$logId, $user['id'], $ip, $ua]);
        } catch (Exception $e) { /* ignore log errors */ }
        
        session_write_close();

        // [FIX NM-02] Unset sensitive fields before returning to client.
        unset($user['password_hash'], $user['google_id']);
        jsonResponse(true, $user, 'Login successful');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Invalid request');
