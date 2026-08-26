<?php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/PostController.php';

$auth = [
    'tenant_id' => 1,
    'user_id' => 100009,
    'role' => 'admin'
];

$ctrl = new PostController($conn ? null : $pdo); // test_bootstrap provides $conn and $pdo
// If $db instance in PostController expects PDO:
$db = Database::getInstance();
$ctrl = new PostController($db);

ob_start();
$ctrl->index($auth);
$output = ob_get_clean();

echo "RESPONSE:\n" . $output . "\n";
