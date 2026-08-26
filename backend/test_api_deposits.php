<?php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/DepositController.php';

if (!function_exists('respond')) {
    function respond($code, $data = null, $message = '') {
        echo json_encode([
            'code' => $code,
            'success' => $code >= 200 && $code < 300,
            'data' => $data,
            'message' => $message
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}

$controller = new DepositController($pdo);

$auth = [
    'tenant_id' => 1,
    'user_id' => 100009,
    'role' => 'admin'
];

echo "=== MOCK API RESPONSE FOR ADMIN ===\n";
try {
    $controller->index($auth);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
