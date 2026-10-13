<?php
// Direct wrapper for Customer Journey AI Insights
$_GET['action'] = 'customer-journey-summary';
$_SERVER['REQUEST_URI'] = '/backend/customer-journey-summary' . (!empty($_GET) ? '?' . http_build_query($_GET) : '');
require_once __DIR__ . '/index.php';
