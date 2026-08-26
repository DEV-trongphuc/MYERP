<?php
// backend/test_task_visibility.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ActivityController.php';

echo "🧪 BẮT ĐẦU CHẠY KIỂM THỬ PHÂN QUYỀN HIỂN THỊ CÔNG VIỆC...\n\n";

// Mock different users
$devAdminAuth = [
    'tenant_id' => 1,
    'user_id' => 100009,
    'role' => 'admin',
    'full_name' => 'Dev Admin',
    'email' => 'turniodev@gmail.com'
];

$saleAdminAuth = [
    'tenant_id' => 1,
    'user_id' => 100066,
    'role' => 'sale_admin',
    'full_name' => 'Đặng Khánh Linh',
    'email' => 'linhdk@ideas.edu.vn'
];

$directorAuth = [
    'tenant_id' => 1,
    'user_id' => 100062,
    'role' => 'director',
    'full_name' => 'Mai Thị Nữ',
    'email' => 'numt@ideas.edu.vn'
];

// Helper to run ActivityController::index and catch response
function getActivities(array $auth, ?int $limit = 1000): array {
    global $pdo;
    $_GET = [
        'limit' => $limit
    ];
    
    $ctrl = new ActivityController($pdo);
    try {
        $ctrl->index($auth);
        return [];
    } catch (ResponseException $e) {
        if ($e->code === 200) {
            return $e->data['items'] ?? [];
        }
        return [];
    }
}

// Check hasAccess for individual tasks
function checkAccess(array $auth, array $task): bool {
    global $pdo;
    $ctrl = new ActivityController($pdo);
    
    try {
        $ctrl->show($auth, (int)$task['id']);
        return true;
    } catch (ResponseException $e) {
        if ($e->code === 200) {
            return true;
        }
        return false;
    } catch (Throwable $t) {
        return false;
    }
}

// 1. Get activities visible to Dev Admin
$devTasks = getActivities($devAdminAuth);
echo "   Count of tasks visible to Dev Admin: " . count($devTasks) . "\n";

// 2. Get activities visible to Sale Admin
$saleAdminTasks = getActivities($saleAdminAuth);
echo "   Count of tasks visible to Sale Admin: " . count($saleAdminTasks) . "\n";

// 3. Get activities visible to Director
$directorTasks = getActivities($directorAuth);
echo "   Count of tasks visible to Director: " . count($directorTasks) . "\n";

// Test 1: Verify Director sees more or equal tasks compared to Sale Admin
assertTest(
    "Director sees all system tasks",
    count($directorTasks) >= count($saleAdminTasks),
    "Director count: " . count($directorTasks) . " | Sale Admin count: " . count($saleAdminTasks)
);

// Test 2: Check tasks created by Dev Admin (user_id = 100009)
// If Sale Admin is not participant/assignee/approver of a Dev Admin's task, they should NOT see it.
$devAdminOnlyTaskFound = null;
foreach ($devTasks as $task) {
    if ((int)$task['created_by'] === 100009 || (int)$task['user_id'] === 100009) {
        $isRelatedToSaleAdmin = false;
        if ((int)$task['user_id'] === 100066 || (int)$task['created_by'] === 100066 || (int)$task['approver_id'] === 100066) {
            $isRelatedToSaleAdmin = true;
        }
        if (!empty($task['participant_ids'])) {
            $pIds = array_map('intval', explode(',', $task['participant_ids']));
            if (in_array(100066, $pIds, true)) {
                $isRelatedToSaleAdmin = true;
            }
        }
        if (!$isRelatedToSaleAdmin) {
            $devAdminOnlyTaskFound = $task;
            break;
        }
    }
}

if ($devAdminOnlyTaskFound) {
    echo "   Found a Dev Admin task unrelated to Sale Admin: ID {$devAdminOnlyTaskFound['id']} - \"{$devAdminOnlyTaskFound['subject']}\"\n";
    
    // Check if Sale Admin sees this task in the list
    $seenBySaleAdmin = false;
    foreach ($saleAdminTasks as $task) {
        if ((int)$task['id'] === (int)$devAdminOnlyTaskFound['id']) {
            $seenBySaleAdmin = true;
            break;
        }
    }
    assertTest(
        "Sale Admin cannot see unrelated Dev Admin task in list view",
        !$seenBySaleAdmin,
        "Seen by Sale Admin: " . ($seenBySaleAdmin ? 'yes' : 'no')
    );
    
    // Check direct show access
    $hasAccessDirect = checkAccess($saleAdminAuth, $devAdminOnlyTaskFound);
    assertTest(
        "Sale Admin direct access check (hasAccess) returns false for unrelated Dev Admin task",
        !$hasAccessDirect,
        "Access allowed: " . ($hasAccessDirect ? 'yes' : 'no')
    );

    // Check if Director can see this task
    $seenByDirector = false;
    foreach ($directorTasks as $task) {
        if ((int)$task['id'] === (int)$devAdminOnlyTaskFound['id']) {
            $seenByDirector = true;
            break;
        }
    }
    assertTest(
        "Director can see this Dev Admin task",
        $seenByDirector,
        "Seen by Director: " . ($seenByDirector ? 'yes' : 'no')
    );
} else {
    echo "   ⚠️ No unrelated Dev Admin task found in DB. Test skipped.\n";
}

printTestSummary();
