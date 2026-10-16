<?php
/**
 * api/worker_guard.php
 * Shared security guard for background worker scripts.
 *
 * Allows execution from:
 *   1. CLI (php worker_flow.php)
 *   2. Localhost / internal server (127.0.0.1 or ::1)
 *   3. HTTP requests with valid ?secret=<CRON_SECRET> or X-Cron-Secret header
 *
 * Usage: require_once __DIR__ . '/worker_guard.php';
 *        (place AFTER db_connect.php so CRON_SECRET env is loaded)
 */

// Already included guard
if (defined('WORKER_GUARD_LOADED')) return;
define('WORKER_GUARD_LOADED', true);

// 1. Allow CLI execution always
if (PHP_SAPI === 'cli') return;

// 2. Allow localhost / internal calls (server triggering its own workers)
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
if (in_array($remoteIp, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true)) return;

// 3. Validate secret for external HTTP calls
$cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';

$passedSecret = $_GET['secret']
    ?? $_POST['secret']
    ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '');

if (!hash_equals($cronSecret, (string) $passedSecret)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
