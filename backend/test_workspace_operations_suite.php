<?php
// backend/test_workspace_operations_suite.php
define('DIAG_TOKEN', true);
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ActivityController.php';

echo "====================================================\n";
echo "🧪 INTEGRATION TEST: WORKSPACE TASKS & NOTIFICATION OPERATIONS\n";
echo "====================================================\n\n";

$ctrl = new ActivityController($pdo);
$tenantId = 1;

// Clean old test items to keep database pristine
$pdo->exec("DELETE FROM activities WHERE subject LIKE '[TEST_WORKFLOW]%'");
$pdo->exec("DELETE FROM notifications WHERE link LIKE '%highlight_activity_id%'");

// Helper mock respond to capture controller outputs
if (!function_exists('respond')) {
    function respond($code, $data = null, $message = '', $success = true) {
        throw new Exception("RESPOND_CODE_{$code}: " . json_encode($data));
    }
}

if (!function_exists('getBody')) {
    global $mockBody;
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

if (!function_exists('logActivity')) {
    function logActivity(...$args): void {
        // Mocked logActivity
    }
}

$authAdmin = [
    'user_id' => 100009, // Dev Admin
    'tenant_id' => 1,
    'role' => 'admin',
    'full_name' => 'Dev Admin'
];

// ----------------------------------------------------
// TEST CASE 1: Task State Transition & Required Approval Rule
// ----------------------------------------------------
echo "--- TEST CASE 1: Task Required Approval State Transitions ---\n";
// Create a task requiring approval
global $mockBody;
$mockBody = [
    'type' => 'task',
    'subject' => '[TEST_WORKFLOW] Implement Workspace Task Workflow Tests',
    'body' => 'Test body',
    'status' => 'planned',
    'progress' => 0,
    'require_approval' => 1,
    'approver_id' => 100011, // Designated Approver: Dev Manager
    'approval_status' => 'pending'
];

$taskId = 0;
try {
    $ctrl->store($authAdmin);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'RESPOND_CODE_201') !== false || strpos($e->getMessage(), 'RESPOND_CODE_200') !== false) {
        $parts = explode(': ', $e->getMessage(), 2);
        $respData = json_decode($parts[1] ?? '{}', true);
        $taskId = (int)($respData['id'] ?? 0);
    } else {
        echo "Failed to create task: " . $e->getMessage() . "\n";
    }
}
assertTest("Create task requiring approval", $taskId > 0, "Created Task ID: " . $taskId);

// Try to update task status to 'done' (should auto-set progress to 100 and approval_status to pending)
$mockBody = [
    'status' => 'done'
];

try {
    $ctrl->update($authAdmin, $taskId);
} catch (Exception $e) {
    // Expected updated response
}

$stmtCheck = $pdo->prepare("SELECT status, progress, approval_status FROM activities WHERE id = ?");
$stmtCheck->execute([$taskId]);
$taskState = $stmtCheck->fetch();

// Status should remain 'planned' because approval is required before changing to 'done'!
$correctTransition = ($taskState['status'] === 'planned' && (int)$taskState['progress'] === 100 && $taskState['approval_status'] === 'pending');
assertTest("Verify status remains planned (awaiting approval), progress to 100, and approval_status is pending", $correctTransition, "Actual: status=" . $taskState['status'] . ", progress=" . $taskState['progress'] . ", approval_status=" . $taskState['approval_status']);


// ----------------------------------------------------
// TEST CASE 2: Mention Notification and Mute Suppression
// ----------------------------------------------------
echo "\n--- TEST CASE 2: Notification Tagging and Mute Suppression ---\n";

// Query another active user for testing notifications
$stmtOtherU = $pdo->prepare("SELECT id FROM users WHERE is_active = 1 AND id != ? LIMIT 1");
$stmtOtherU->execute([$adminUserId]);
$targetUserId = (int)$stmtOtherU->fetchColumn();
if (!$targetUserId) {
    $targetUserId = 100010; // Fallback
}
echo "Selected target user for mention testing: {$targetUserId}\n";

$pdo->exec("DELETE FROM task_muted_notifications WHERE task_id = {$taskId} AND user_id = {$targetUserId}");

// Step A: Mute task for User B
$pdo->prepare("INSERT INTO task_muted_notifications (task_id, user_id) VALUES (?, ?)")->execute([$taskId, $targetUserId]);

// Step B: User A comments and mentions User B
$mockBody = [
    'content' => 'Chào <span class="mention" data-user-id="' . $targetUserId . '">@Dev Director</span>, hãy vào kiểm tra tiến độ nhé.',
    'attachments' => []
];

try {
    $ctrl->addComment($authAdmin, $taskId);
} catch (Exception $e) {
    // Expected response
}

// Assert no notification was created for User B
$stmtNotif = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND link LIKE ?");
$stmtNotif->execute([$targetUserId, "%/activities/{$taskId}%"]);
$notifCount = (int)$stmtNotif->fetchColumn();
assertTest("Mute prevents mention notification", $notifCount === 0, "Notification count: {$notifCount} (Should be 0)");

// Step C: Unmute task for User B
$pdo->prepare("DELETE FROM task_muted_notifications WHERE task_id = ? AND user_id = ?")->execute([$taskId, $targetUserId]);

// Step D: User A comments and mentions User B again
$mockBody = [
    'content' => 'Nhắc lại lần 2 <span class="mention" data-user-id="' . $targetUserId . '">@Dev Director</span> nhé.',
    'attachments' => []
];

try {
    $ctrl->addComment($authAdmin, $taskId);
} catch (Exception $e) {
    // Expected response
}

// Assert notification IS created for User B
$stmtNotif->execute([$targetUserId, "%/activities/{$taskId}%"]);
$newNotifCount = (int)$stmtNotif->fetchColumn();
assertTest("Unmute restores mention notification", $newNotifCount > 0, "Notification count: {$newNotifCount} (Should be > 0)");

// Clean test items
$pdo->exec("DELETE FROM activities WHERE subject LIKE '[TEST_WORKFLOW]%'");
$pdo->exec("DELETE FROM notifications WHERE link LIKE '%highlight_activity_id%'");

echo "\n";
printTestSummary();
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    exit($testStats['fail'] > 0 ? 1 : 0);
}
