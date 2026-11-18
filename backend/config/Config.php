<?php
// ── Database credentials ───────────────────────
if (file_exists(__DIR__ . '/../env.php')) {
    require_once __DIR__ . '/../env.php';
}

if (!defined('DB_HOST')) define('DB_HOST', $_ENV['DB_HOST'] ?? (getenv('DB_HOST') ?: 'localhost'));
if (!defined('DB_USER')) define('DB_USER', $_ENV['DB_USER'] ?? (getenv('DB_USER') ?: ''));
if (!defined('DB_PASS')) define('DB_PASS', $_ENV['DB_PASS'] ?? (getenv('DB_PASS') !== false ? getenv('DB_PASS') : ''));
if (!defined('DB_NAME')) define('DB_NAME', $_ENV['DB_NAME'] ?? (getenv('DB_NAME') ?: ''));
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');

// ── JWT secret (configured via backend/.env) ─────────
if (!defined('JWT_SECRET')) {
    $envJwtSecret = (string)($_ENV['JWT_SECRET'] ?? (getenv('JWT_SECRET') ?: ''));
    if ($envJwtSecret === '' && (!defined('MYERP_SKIP_DB_CONNECT') || !MYERP_SKIP_DB_CONNECT)) {
        throw new \RuntimeException('Missing JWT_SECRET configuration in backend/.env');
    }
    define('JWT_SECRET', $envJwtSecret);
}
if (!defined('JWT_EXPIRE_ACCESS')) define('JWT_EXPIRE_ACCESS',  (int)($_ENV['JWT_EXPIRE_ACCESS'] ?? (60 * 60 * 24 * 30))); // 30 days
if (!defined('JWT_EXPIRE_REFRESH')) define('JWT_EXPIRE_REFRESH', (int)($_ENV['JWT_EXPIRE_REFRESH'] ?? (60 * 60 * 24 * 90))); // 90 days

// ── CORS ───────────────────────────────────────
if (!defined('ALLOWED_ORIGINS')) define('ALLOWED_ORIGINS', $_ENV['ALLOWED_ORIGINS'] ?? 'http://localhost:5173,http://localhost:3000');

// ── Upload paths ───────────────────────────────
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/../uploads/');
if (!defined('UPLOAD_URL')) define('UPLOAD_URL', '/crm/uploads/');
