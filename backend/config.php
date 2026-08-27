<?php
// d:\GITHUB_SPACE\IDEAS_ERP\backend\config.php

require_once __DIR__ . '/env.php';

if (!defined('DB_HOST')) define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
if (!defined('DB_USER')) define('DB_USER', $_ENV['DB_USER'] ?? 'vhvxoigh_mail_auto');
if (!defined('DB_PASS')) define('DB_PASS', $_ENV['DB_PASS'] ?? 'Ideas@812');
if (!defined('DB_NAME')) define('DB_NAME', $_ENV['DB_NAME'] ?? 'vhvxoigh_myerp');

// JWT
if (!defined('JWT_SECRET'))         define('JWT_SECRET',         $_ENV['JWT_SECRET'] ?? 'MYERP_SECRET_KEY_2026_IDEAS');
if (!defined('JWT_EXPIRE_ACCESS'))  define('JWT_EXPIRE_ACCESS',  60 * 60 * 24 * 30); // 30 days
if (!defined('JWT_EXPIRE_REFRESH')) define('JWT_EXPIRE_REFRESH', 60 * 60 * 24 * 90); // 90 days

// CORS allowed origins
if (!defined('ALLOWED_ORIGINS'))
    define('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://localhost:4173,http://open.Ideas.test,https://open.Ideas.test,https://myerp.ideas.edu.vn,http://myerp.ideas.edu.vn,https://crm-Ideas.vercel.app,https://crm-ideas.vercel.app');

// Storage
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/uploads');

// Global File Cleanup Helpers
if (!function_exists('deleteServerFile')) {
    /**
     * Safely deletes a physical file from the server's uploads storage
     * @param string|null $fileUrl
     * @return bool
     */
    function deleteServerFile(?string $fileUrl): bool {
        if (empty($fileUrl)) return false;
        
        $fileUrl = trim($fileUrl);

        // Strip domain or protocol if absolute URL
        if (preg_match('/uploads\/(.+)$/i', $fileUrl, $matches)) {
            $relativePath = 'uploads/' . $matches[1];
        } else {
            $relativePath = ltrim($fileUrl, '/');
        }

        $baseUploadDir = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/uploads');
        
        $candidatePaths = [
            __DIR__ . '/' . $relativePath,
            $baseUploadDir . '/' . (strpos($relativePath, 'uploads/') === 0 ? substr($relativePath, 8) : $relativePath),
            __DIR__ . '/storage/' . $relativePath,
            __DIR__ . '/public/' . $relativePath
        ];

        foreach ($candidatePaths as $path) {
            if ($path && file_exists($path) && is_file($path)) {
                return @unlink($path);
            }
        }

        return false;
    }
}

if (!function_exists('deleteAttachmentFiles')) {
    /**
     * Extracts all file URLs from a string (JSON/markdown/raw text) or array, and physically deletes them from disk.
     * @param string|array|null $input
     */
    function deleteAttachmentFiles($input): void {
        if (empty($input)) return;

        $urls = [];

        if (is_string($input)) {
            $decoded = json_decode($input, true);
            if (is_array($decoded)) {
                foreach ($decoded as $item) {
                    if (is_string($item)) {
                        $urls[] = $item;
                    } elseif (is_array($item)) {
                        if (!empty($item['url'])) $urls[] = $item['url'];
                        if (!empty($item['file_path'])) $urls[] = $item['file_path'];
                    }
                }
            } else {
                preg_match_all('/(?:uploads\/[^\s\)\"\'>]+|https?:\/\/[^\s\)\"\'>]+)/i', $input, $matches);
                if (!empty($matches[0])) {
                    foreach ($matches[0] as $m) {
                        $urls[] = $m;
                    }
                } else {
                    $urls[] = $input;
                }
            }
        } elseif (is_array($input)) {
            foreach ($input as $item) {
                if (is_string($item)) {
                    $urls[] = $item;
                } elseif (is_array($item)) {
                    if (!empty($item['url'])) $urls[] = $item['url'];
                    if (!empty($item['file_path'])) $urls[] = $item['file_path'];
                }
            }
        }

        foreach (array_unique($urls) as $url) {
            deleteServerFile((string)$url);
        }
    }
}

// Environment
if (!defined('APP_ENV')) define('APP_ENV', 'development');

// Backend Version (auto-increments on backend edits)
if (!defined('BACKEND_VERSION')) define('BACKEND_VERSION', '1.5.4.0');
