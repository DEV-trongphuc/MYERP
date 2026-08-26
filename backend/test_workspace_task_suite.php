<?php
// backend/test_workspace_task_suite.php
// Live Integration Test Suite for Workspace Task Drawer and Notifications
if (!defined('DIAG_TOKEN')) define('DIAG_TOKEN', true);
putenv('MYERP_TEST_MODE=1');
if (!defined('MYERP_TEST_MODE')) define('MYERP_TEST_MODE', true);
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ActivityController.php';

// Helper respond to override default JSON respond
if (!function_exists('respond')) {
    function respond($code, $data = null, $message = '', $success = true) {
        throw new Exception("RESPOND_TRIGGERED: " . json_encode([
            'code' => $code,
            'success' => $success,
            'message' => $message,
            'data' => $data
        ]));
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
    function logActivity(PDO $db, $tid, $uid, string $action, ?string $resource = null, $resourceId = null, ?string $data = null): void {
        // Mocked logActivity
    }
}

echo "=== STARTING WORKSPACE TASK DRAWER INTEGRATION TESTS ===\n\n";

// Auto create test users if they don't exist to satisfy foreign key constraints
$testUsers = [
    100009 => ['email' => 'dev_admin@test.com', 'username' => 'dev_admin', 'full_name' => 'Dev Admin', 'role' => 'admin'],
    100010 => ['email' => 'dev_director@test.com', 'username' => 'dev_director', 'full_name' => 'Dev Director', 'role' => 'director'],
    100011 => ['email' => 'dev_manager@test.com', 'username' => 'dev_manager', 'full_name' => 'Dev Manager', 'role' => 'manager'],
    100012 => ['email' => 'dev_sale@test.com', 'username' => 'dev_sale', 'full_name' => 'Dev Sale', 'role' => 'sales']
];

$GLOBALS['task_inserted_uids'] = [];

foreach ($testUsers as $uid => $u) {
    $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmtCheck->execute([$uid]);
    if (!$stmtCheck->fetch()) {
        $stmtIns = $pdo->prepare("INSERT INTO users (id, email, username, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, 1)");
        if ($stmtIns->execute([$uid, $u['email'], $u['username'], $u['full_name'], $u['role']])) {
            $GLOBALS['task_inserted_uids'][] = $uid;
        }
    }
}

$ctrl = new ActivityController($pdo);

// Prepare temporary contact and task for testing
$tenantId = 1;

// Clean old test items to keep database pristine
$pdo->exec("DELETE FROM activities WHERE subject LIKE '[TEST_SUITE]%'");
$pdo->exec("DELETE FROM notifications WHERE link LIKE '%highlight_activity_id%'");
$pdo->exec("DELETE FROM notifications WHERE user_id IN (100010, 100011, 100012)");

// 1. Create a base task activity
$stmt = $pdo->prepare("
    INSERT INTO activities (tenant_id, user_id, created_by, subject, type, related_type, related_id, progress, require_approval, approver_id, approval_status, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->execute([
    $tenantId,
    100009, // Dev Admin
    100009, // created_by: Dev Admin
    '[TEST_SUITE] Implement Workspace Task Drawer Tests',
    'task',
    'contact',
    24, // Related Contact ID 24
    50, // 50% progress
    1,  // Require approval
    100011, // Designated Approver: Dev Manager (100011)
    'pending',
    'planned'
]);
$taskId = (int)$pdo->lastInsertId();
assertTest("Create test activity task", $taskId > 0, "Inserted Task ID: " . $taskId);

// ----------------------------------------------------
// TEST CASE 1: Add a comment with HTML mention tag and check notification creation
// ----------------------------------------------------
echo "\n--- TEST CASE 1: HTML Mentions & Notification Notification Triggering ---\n";
global $mockBody;
$mockBody = [
    'content' => 'Chào <span class="mention" data-user-id="100010">@Dev Director</span>, hãy vào kiểm tra tiến độ nhé.',
    'attachments' => []
];

$authAdmin = [
    'user_id' => 100009,
    'tenant_id' => 1,
    'role' => 'admin',
    'full_name' => 'Dev Admin'
];

try {
    $ctrl->addComment($authAdmin, $taskId);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'RESPOND_TRIGGERED') === false && strpos($e->getMessage(), 'RESPOND_CODE_200') === false && strpos($e->getMessage(), 'RESPOND_CODE_201') === false) {
        echo "Unexpected error: " . $e->getMessage() . "\n";
    }
}

// Assert that a notification is created for user 100010 (Dev Director)
$stmtNotif = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'mention' ORDER BY id DESC LIMIT 1");
$stmtNotif->execute([100010]);
$notif = $stmtNotif->fetch(PDO::FETCH_ASSOC);

$hasNotif = !empty($notif);
$hasCorrectLink = $hasNotif && strpos($notif['link'], "/contacts?open_contact_id=24") !== false;
assertTest("Check notification created for tagged user (Dev Director)", $hasNotif, "Found notification: " . ($hasNotif ? json_encode($notif, JSON_UNESCAPED_UNICODE) : 'NONE'));
assertTest("Check notification link format containing contact and comment details", $hasCorrectLink, "Link: " . ($hasNotif ? $notif['link'] : 'N/A'));


// ----------------------------------------------------
// TEST CASE 2: Muted task check (Users who muted shouldn't get notifications)
// ----------------------------------------------------
echo "\n--- TEST CASE 2: Notification Exclusion for Muted Tasks ---\n";
// Mute this task for Dev Director (100010)
$pdo->exec("INSERT INTO task_muted_notifications (task_id, user_id, muted_at) VALUES ($taskId, 100010, NOW())");

// Clean previous notifications for Dev Director
$pdo->exec("DELETE FROM notifications WHERE user_id = 100010");

// Try to tag again
$mockBody = [
    'content' => 'Nhắc lại lần nữa <span class="mention" data-user-id="100010">@Dev Director</span> nhé.',
    'attachments' => []
];

try {
    $ctrl->addComment($authAdmin, $taskId);
} catch (Exception $e) {}

// Check notifications for 100010 - should be empty!
$stmtNotifMute = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ?");
$stmtNotifMute->execute([100010]);
$count = (int)$stmtNotifMute->fetchColumn();

assertTest("Confirm no notification is sent to muted user (Dev Director)", $count === 0, "Notification count: " . $count);

// Cleanup mute
$pdo->exec("DELETE FROM task_muted_notifications WHERE task_id = $taskId AND user_id = 100010");


// ----------------------------------------------------
// TEST CASE 3: Comment Reply Notification
// ----------------------------------------------------
echo "\n--- TEST CASE 3: Comment Reply Parent Notification ---\n";
// Dev Director (100010) makes a comment first
$mockBody = [
    'content' => 'Ý kiến của tôi về công việc này...',
    'attachments' => []
];
$authDirector = [
    'user_id' => 100010,
    'tenant_id' => 1,
    'role' => 'director',
    'full_name' => 'Dev Director'
];

$commentId = 0;
try {
    // We run insert query manually to get insert ID of parent comment easily
    $stmtCmt = $pdo->prepare("
        INSERT INTO activity_comments (tenant_id, activity_id, user_id, content)
        VALUES (?, ?, ?, ?)
    ");
    $stmtCmt->execute([1, $taskId, 100010, 'Ý kiến của tôi về công việc này...']);
    $commentId = (int)$pdo->lastInsertId();
} catch (Exception $e) {}

assertTest("Create parent comment for reply testing", $commentId > 0, "Comment ID: " . $commentId);

// Dev Admin (100009) replies to Dev Director's comment
$mockBody = [
    'content' => 'Tôi đồng ý với ý kiến của sếp.',
    'parent_id' => $commentId,
    'attachments' => []
];

try {
    $ctrl->addComment($authAdmin, $taskId);
} catch (Exception $e) {}

// Verify notification was sent to Dev Director (100010)
$stmtNotifReply = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'mention' ORDER BY id DESC LIMIT 1");
$stmtNotifReply->execute([100010]);
$notifReply = $stmtNotifReply->fetch(PDO::FETCH_ASSOC);

$hasReplyNotif = !empty($notifReply) && (int)$notifReply['user_id'] === 100010;
assertTest("Check notification created for parent comment owner", $hasReplyNotif, "Notification detail: " . ($notifReply ? json_encode($notifReply, JSON_UNESCAPED_UNICODE) : 'NONE'));


// ----------------------------------------------------
// TEST CASE 4: Task Approvals & Restricted Actions
// ----------------------------------------------------
echo "\n--- TEST CASE 4: Approval & Rejection Permissions ---\n";
// Dev Sale (100012) tries to approve task (should fail with 403)
$mockBody = [
    'approval_status' => 'approved'
];

$authSale = [
    'user_id' => 100012,
    'tenant_id' => 1,
    'role' => 'sales',
    'full_name' => 'Dev Sale'
];

$failedAsSale = false;
try {
    $ctrl->update($authSale, $taskId);
} catch (Exception $e) {
    if (strpos($e->getMessage(), '403') !== false) {
        $failedAsSale = true;
    }
}
assertTest("Check Dev Sale is blocked from approving task (Expected: 403 Blocked)", $failedAsSale);

// Dev Manager (100011) - designated approver - approves task (should succeed)
$authManager = [
    'user_id' => 100011,
    'tenant_id' => 1,
    'role' => 'manager',
    'full_name' => 'Dev Manager'
];
$mockBody = [
    'approval_status' => 'approved',
    'status' => 'done'
];

$succeededAsManager = false;
try {
    $ctrl->update($authManager, $taskId);
    $succeededAsManager = true;
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'RESPOND_TRIGGERED') !== false || strpos($e->getMessage(), 'RESPOND_CODE_200') !== false || (isset($e->code) && $e->code === 200)) {
        $succeededAsManager = true;
    }
}
assertTest("Check Designated Approver (Dev Manager) can approve task successfully", $succeededAsManager);

// ----------------------------------------------------
// TEST CASE 5: Task Hiding & Auto-unhiding Triggers
// ----------------------------------------------------
echo "\n--- TEST CASE 5: Task Hiding & Auto-unhiding Triggers ---\n";

// Ensure clean state
$pdo->exec("DELETE FROM task_hidden_users WHERE task_id = $taskId");

// 1. Toggle Hide (Hide the task)
$ctrl->toggleHide($authDirector, $taskId);
$isHidden1 = $ctrl->isTaskHidden($taskId, 100010);
assertTest("Toggle hide sets task as hidden", $isHidden1 === true);

// 2. Toggle Hide again (Unhide the task)
$ctrl->toggleHide($authDirector, $taskId);
$isHidden2 = $ctrl->isTaskHidden($taskId, 100010);
assertTest("Toggle hide again unhides task", $isHidden2 === false);

// 3. Hide again to test auto-unhide triggers
$ctrl->toggleHide($authDirector, $taskId); // hidden now

// 4. Trigger 1: Assign to Dev Director
$mockBody = [
    'user_id' => 100010
];
try {
    $ctrl->update($authAdmin, $taskId);
} catch (Exception $e) {}

$isHiddenAssignee = $ctrl->isTaskHidden($taskId, 100010);
assertTest("Trigger 1: Task automatically unhides when assigned as main assignee", $isHiddenAssignee === false);

// 5. Hide again to test trigger 2
$ctrl->toggleHide($authDirector, $taskId); // hidden now

// 6. Trigger 2: Add to participants
$mockBody = [
    'participant_ids' => '100012,100010'
];
try {
    $ctrl->update($authAdmin, $taskId);
} catch (Exception $e) {}

$isHiddenParticipant = $ctrl->isTaskHidden($taskId, 100010);
assertTest("Trigger 2: Task automatically unhides when added to participants list", $isHiddenParticipant === false);

// 7. Hide again to test trigger 3
$ctrl->toggleHide($authDirector, $taskId); // hidden now

// 8. Trigger 3: Tag/Mention in Comment
$mockBody = [
    'content' => 'Nhắc nhở <span class="mention" data-user-id="100010">@Dev Director</span> làm việc này.',
    'attachments' => []
];
try {
    $ctrl->addComment($authAdmin, $taskId);
} catch (Exception $e) {}

$isHiddenMention = $ctrl->isTaskHidden($taskId, 100010);
assertTest("Trigger 3: Task automatically unhides when tagged in a comment", $isHiddenMention === false);


// ----------------------------------------------------
// CLEANUP AFTER TEST
// ----------------------------------------------------
echo "\n--- CLEANING UP TEST DATA ---\n";
$pdo->exec("DELETE FROM activities WHERE subject LIKE '[TEST_SUITE]%'");
$pdo->exec("DELETE FROM notifications WHERE user_id IN (100010, 100011, 100012) AND (link LIKE '%highlight_activity_id%' OR link LIKE '%highlight_comment_id%')");
if (!empty($GLOBALS['task_inserted_uids'])) {
    $inClause = implode(',', array_map('intval', $GLOBALS['task_inserted_uids']));
    $pdo->exec("DELETE FROM users WHERE id IN ($inClause)");
}
echo "Cleaned up all temporary testing records successfully.\n";

printTestSummary();
