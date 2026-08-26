<?php
// backend/test_system_ddl_cleanup.php
require_once __DIR__ . '/test_bootstrap.php';

// Require all 8 updated controllers
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/ProjectController.php';
require_once __DIR__ . '/controllers/ContactController.php';
require_once __DIR__ . '/controllers/CampaignController.php';
require_once __DIR__ . '/controllers/CheckInController.php';
require_once __DIR__ . '/controllers/CloudFileController.php';
require_once __DIR__ . '/controllers/FileCategoryController.php';
require_once __DIR__ . '/controllers/NotificationController.php';

echo "=== TESTING CONTROLLERS INSTANTIATION AFTER DDL CLEANUP ===\n";

$controllers = [
    'UserController' => UserController::class,
    'ProjectController' => ProjectController::class,
    'ContactController' => ContactController::class,
    'CampaignController' => CampaignController::class,
    'CheckInController' => CheckInController::class,
    'CloudFileController' => CloudFileController::class,
    'FileCategoryController' => FileCategoryController::class,
    'NotificationController' => NotificationController::class
];

foreach ($controllers as $name => $class) {
    try {
        $timeStart = microtime(true);
        $instance = new $class($pdo);
        $timeEnd = microtime(true);
        $duration = ($timeEnd - $timeStart) * 1000;
        
        assertTest("Controller '{$name}' instantiated successfully", $instance instanceof $class, "Time: " . number_format($duration, 2) . "ms");
    } catch (\Throwable $e) {
        assertTest("Controller '{$name}' failed to instantiate", false, "Error: " . $e->getMessage());
    }
}

printTestSummary();
