<?php
/**
 * api/config.php - Compatibility Layer
 * This file bridges legacy scripts to the modern db_connect.php architecture.
 */
require_once __DIR__ . '/db_connect.php';

// Define legacy constants if not present
if (!defined('EXTERNAL_ASSET_BASE')) {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    // Fallback detection for frontend URL
    if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
        define('EXTERNAL_ASSET_BASE', 'http://localhost:3000');
    } else {
        define('EXTERNAL_ASSET_BASE', "$protocol://$host");
    }
}

if (!defined('EXTERNAL_API_BASE')) {
    define('EXTERNAL_API_BASE', API_BASE_URL);
}
