<?php
// api/trigger_campaign_async.php - Async Campaign Worker Trigger
// Returns immediately while worker continues in background

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);

// Auth guard
require_once 'auth_middleware.php';

$campaignId = $_GET['campaign_id'] ?? null;

if (!$campaignId) {
    echo json_encode(['success' => false, 'error' => 'Missing campaign_id']);
    exit;
}

// Return success immediately
header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Worker triggered in background']);

// Close connection to browser
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    ob_start();
    header('Connection: close');
    header('Content-Length: ' . ob_get_length());
    ob_end_flush();
    flush();
}

// Continue processing in background
require_once 'db_connect.php';
triggerAsyncWorker('/worker_campaign.php?campaign_id=' . $campaignId);
