<?php
// backend/test_activities_optimizations.php
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();
require_once __DIR__ . '/controllers/ActivityController.php';

// Safe mock function for respond in CLI mode
if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        $GLOBALS['last_response'] = [
            'code' => $code,
            'data' => $data,
            'message' => $message,
            'success' => $success
        ];
    }
}

// 1. Check DB columns and indexes
echo "=== TESTING DATABASE STRUCTURE ===\n";
assertDbField($conn, 'activity_comments', 'subtask_id', "id > 0 ORDER BY id DESC", null, "Checks that subtask_id exists on activity_comments");

// Verify index on expenses table
$indexCheck = $conn->query("SHOW INDEX FROM expenses WHERE Key_name = 'idx_expenses_tenant_title'");
assertTest("Checks that idx_expenses_tenant_title index is present on expenses table", $indexCheck && $indexCheck->num_rows > 0);

// 2. Instantiate Controller (No ALTER TABLE blocks should run)
echo "\n=== TESTING CONTROLLER INSTANTIATION ===\n";
$timeStart = microtime(true);
$controller = new ActivityController($pdo);
$timeEnd = microtime(true);
assertTest("Controller instantiated successfully without executing DDL schema ALTER TABLEs", ($timeEnd - $timeStart) < 0.05);

// 3. Test Index API logic (Solving N+1 Queries & REPLACE)
echo "\n=== TESTING ACTIVITIES LIST FETCH (N+1 OPTIMIZATION) ===\n";
$auth = [
    'user_id' => 1,
    'role' => 'super_admin',
    'tenant_id' => 1,
    'username' => 'superadmin',
    'full_name' => 'Super Admin'
];

$_GET['limit'] = 10;
$_GET['page'] = 1;

$controller->index($auth);

if (isset($GLOBALS['last_response'])) {
    $res = $GLOBALS['last_response'];
    assertTest("API returned successfully", $res['success'] === true);
    assertTest("Response contains items list", isset($res['data']['items']));
    
    if (isset($res['data']['items']) && count($res['data']['items']) > 0) {
        $firstItem = $res['data']['items'][0];
        assertTest("Item contains first_image_url field", array_key_exists('first_image_url', $firstItem));
    }
} else {
    assertTest("API respond was not triggered", false);
}

printTestSummary();
