<?php
// ── Database credentials ───────────────────────
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_USER')) define('DB_USER', 'vhvxoigh_mail_auto');
if (!defined('DB_PASS')) define('DB_PASS', 'Ideas@812');
if (!defined('DB_NAME')) define('DB_NAME', 'vhvxoigh_myerp');
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');

// ── JWT secret (change in production!) ─────────
if (!defined('JWT_SECRET')) define('JWT_SECRET', 'MYERP_SECRET_KEY_2026_IDEAS');
if (!defined('JWT_EXPIRE_ACCESS')) define('JWT_EXPIRE_ACCESS',  60 * 60);         // 1 hour
if (!defined('JWT_EXPIRE_REFRESH')) define('JWT_EXPIRE_REFRESH', 60 * 60 * 24 * 30); // 30 days

// ── CORS ───────────────────────────────────────
if (!defined('ALLOWED_ORIGINS')) define('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000,http://open.Ideas.test,https://open.Ideas.test,https://myerp.ideas.edu.vn,http://myerp.ideas.edu.vn');

// ── Upload paths ───────────────────────────────
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/../uploads/');
if (!defined('UPLOAD_URL')) define('UPLOAD_URL', '/crm/uploads/');
