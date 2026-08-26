<?php
// backend/test_workspace_full_lifecycle_suite.php
// End-to-End Automated Integration Test Suite for Workspace Tasks, Subtasks, Deadlines, Mentions, and Notifications

if (!defined('DIAG_TOKEN')) define('DIAG_TOKEN', true);
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
        ], JSON_UNESCAPED_UNICODE));
    }
}

if (!function_exists('getBody')) {
    global $mockBody;
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

echo "===============================================================\n";
echo "=== WORKSPACE TASK FULL LIFECYCLE & NOTIFICATIONS TEST SUITE ===\n";
echo "===============================================================\n\n";

// 1. Ensure test users exist in database
$testUsers = [
    200001 => ['email' => 'test_admin@ideas.com', 'username' => 'test_admin_u', 'full_name' => 'Admin Boss', 'role' => 'admin'],
    200002 => ['email' => 'test_manager@ideas.com', 'username' => 'test_manager_u', 'full_name' => 'Manager Leader', 'role' => 'manager'],
    200003 => ['email' => 'test_sale1@ideas.com', 'username' => 'test_sale1_u', 'full_name' => 'Sale Representative 1', 'role' => 'sales'],
    200004 => ['email' => 'test_sale2@ideas.com', 'username' => 'test_sale2_u', 'full_name' => 'Sale Representative 2', 'role' => 'sales']
];

foreach ($testUsers as $uid => $u) {
    $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmtCheck->execute([$uid]);
    if (!$stmtCheck->fetch()) {
        $stmtIns = $pdo->prepare("INSERT INTO users (id, email, username, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, 1)");
        $stmtIns->execute([$uid, $u['email'], $u['username'], $u['full_name'], $u['role']]);
    }
}

$tenantId = 1;
$ctrl = new ActivityController($pdo);

// Cleanup old test data
$pdo->exec("DELETE FROM notifications WHERE user_id IN (200001, 200002, 200003, 200004)");
$pdo->exec("DELETE FROM activity_comments WHERE tenant_id = 1 AND content LIKE '%[TEST_WORKSPACE]%'");
$pdo->exec("DELETE FROM activities WHERE tenant_id = 1 AND subject LIKE '[TEST_WORKSPACE]%'");

// -------------------------------------------------------------
// TEST CASE 1: Create Task with Subtasks, Assignee, Approver, and Participants
// -------------------------------------------------------------
echo "--- TEST 1: Task Creation with Subtask Assignees & Notifications ---\n";

$subtasks = [
    [
        'id' => 'sub_101',
        'title' => 'Thiết kế Slide thuyết trình',
        'assignee_id' => 200004, // Sale 2
        'due_date' => date('Y-m-d', strtotime('+2 days')),
        'priority' => 'high',
        'done' => false
    ],
    [
        'id' => 'sub_102',
        'title' => 'Chuẩn bị hợp đồng mẫu',
        'assignee_id' => 200003, // Sale 1 (Primary assignee)
        'due_date' => date('Y-m-d', strtotime('+3 days')),
        'priority' => 'medium',
        'done' => false
    ]
];

$bodyJson = json_encode([
    'erp_task' => [
        'description' => '<p>Triển khai kế hoạch đàm phán hợp đồng quý 3</p>',
        'internal_type' => 'task',
        'checklist' => $subtasks
    ]
], JSON_UNESCAPED_UNICODE);

global $mockBody;
$mockBody = [
    'subject' => '[TEST_WORKSPACE] Triển khai dự án ERP 2026',
    'type' => 'task',
    'user_id' => 200003, // Assigned to Sale 1
    'require_approval' => 1,
    'approver_id' => 200002, // Approver is Manager
    'participant_ids' => '200004', // Sale 2 is collaborator
    'priority' => 'urgent',
    'due_date' => date('Y-m-d H:i:s', strtotime('+5 days')),
    'body' => $bodyJson
];

$authAdmin = [
    'tenant_id' => 1,
    'user_id' => 200001,
    'role' => 'admin',
    'full_name' => 'Admin Boss'
];

$createdTask = null;
try {
    $ctrl->store($authAdmin);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'RESPOND_TRIGGERED: ') === 0) {
        $jsonStr = substr($e->getMessage(), strlen('RESPOND_TRIGGERED: '));
        $resp = json_decode($jsonStr, true);
        $createdTask = $resp['data'] ?? null;
    } else {
        echo "Error in store: " . $e->getMessage() . "\n";
    }
}

assertTest("Task successfully created via ActivityController::store", !empty($createdTask) && !empty($createdTask['id']), "Created Task ID: " . ($createdTask['id'] ?? 'N/A'));

$taskId = (int)($createdTask['id'] ?? 0);

// Verify Notifications generated on Task Creation:
// 1. Assignee (200003) should receive task_assignment
$stmtNotifAssignee = $pdo->prepare("SELECT * FROM notifications WHERE user_id = 200003 AND link LIKE ? ORDER BY id DESC LIMIT 1");
$stmtNotifAssignee->execute(["/activities/{$taskId}%"]);
$notifAssignee = $stmtNotifAssignee->fetch(PDO::FETCH_ASSOC);
assertTest("Primary Assignee (Sale 1) received task assignment notification", !empty($notifAssignee), "Notification Title: " . ($notifAssignee['title'] ?? 'N/A'));

// 2. Subtask Assignee (200004) should receive subtask assignment notification with subtask_id
$stmtNotifSub = $pdo->prepare("SELECT * FROM notifications WHERE user_id = 200004 AND link LIKE ? ORDER BY id DESC LIMIT 1");
$stmtNotifSub->execute(["/activities/{$taskId}?subtask_id=sub_101%"]);
$notifSub = $stmtNotifSub->fetch(PDO::FETCH_ASSOC);
assertTest("Subtask Assignee (Sale 2) received subtask assignment notification with subtask_id in link", !empty($notifSub) && strpos($notifSub['link'], 'sub_101') !== false, "Subtask Link: " . ($notifSub['link'] ?? 'N/A'));


// -------------------------------------------------------------
// TEST CASE 2: Subtask Comments with HTML & Text Mentions
// -------------------------------------------------------------
echo "\n--- TEST 2: Subtask Comments with Dual Mention & Deep Link ---\n";

$mockBody = [
    'content' => '[TEST_WORKSPACE] Nhờ bạn <span class="mention" data-user-id="200004">@Sale Representative 2</span> kiểm tra lại font chữ của slide nhé.',
    'subtask_id' => 'sub_101',
    'attachments' => []
];

$authSale1 = [
    'tenant_id' => 1,
    'user_id' => 200003,
    'role' => 'sales',
    'full_name' => 'Sale Representative 1'
];

try {
    $ctrl->addComment($authSale1, $taskId);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'RESPOND_TRIGGERED: ') === 0) {
        // Success
    }
}

// Verify that Sale 2 (200004) received a MENTION_TAGGED notification with subtask_id and comment_id
$stmtMentionNotif = $pdo->prepare("SELECT * FROM notifications WHERE user_id = 200004 AND type = 'mention' ORDER BY id DESC LIMIT 1");
$stmtMentionNotif->execute();
$mentionNotif = $stmtMentionNotif->fetch(PDO::FETCH_ASSOC);

assertTest("Mention notification generated for subtask comment", !empty($mentionNotif), "Mention Notif Title: " . ($mentionNotif['title'] ?? 'N/A'));
assertTest("Mention link contains subtask_id parameter", !empty($mentionNotif) && strpos($mentionNotif['link'], 'subtask_id=sub_101') !== false, "Mention link: " . ($mentionNotif['link'] ?? 'N/A'));
assertTest("Mention link contains comment_id parameter", !empty($mentionNotif) && strpos($mentionNotif['link'], 'comment_id=') !== false, "Mention link: " . ($mentionNotif['link'] ?? 'N/A'));


// -------------------------------------------------------------
// TEST CASE 3: Task Completion & Approval Workflow
// -------------------------------------------------------------
echo "\n--- TEST 3: Task Completion and Approval Request Notification ---\n";

// Update task to 100% progress
$mockBody = [
    'progress' => 100,
    'require_approval' => 1,
    'approver_id' => 200002,
    'approval_status' => 'pending'
];

try {
    $ctrl->update($authSale1, $taskId);
} catch (Exception $e) {
    // catch respond
}

// Verify Manager (200002) received approval request notification
$stmtApprovalNotif = $pdo->prepare("SELECT * FROM notifications WHERE user_id = 200002 AND type = 'approval_request' ORDER BY id DESC LIMIT 1");
$stmtApprovalNotif->execute();
$approvalNotif = $stmtApprovalNotif->fetch(PDO::FETCH_ASSOC);

assertTest("Manager received approval_request notification upon 100% completion", !empty($approvalNotif), "Approval Notif Title: " . ($approvalNotif['title'] ?? 'N/A'));


// Manager approves task
$mockBody = [
    'progress' => 100,
    'require_approval' => 1,
    'approver_id' => 200002,
    'approval_status' => 'approved',
    'status' => 'done'
];

$authManager = [
    'tenant_id' => 1,
    'user_id' => 200002,
    'role' => 'manager',
    'full_name' => 'Manager Leader'
];

try {
    $ctrl->update($authManager, $taskId);
} catch (Exception $e) {
    // catch respond
}

// Verify Assignee (200003) received approval_status approved notification
$stmtApprovedNotif = $pdo->prepare("SELECT * FROM notifications WHERE user_id = 200003 AND type = 'approval_status' ORDER BY id DESC LIMIT 1");
$stmtApprovedNotif->execute();
$approvedNotif = $stmtApprovedNotif->fetch(PDO::FETCH_ASSOC);

assertTest("Assignee received approval_status notification when manager approved", !empty($approvedNotif), "Approved Notif Title: " . ($approvedNotif['title'] ?? 'N/A'));


// -------------------------------------------------------------
// TEST CASE 4: Subtasks Comment Counts API
// -------------------------------------------------------------
echo "\n--- TEST 4: Subtasks Comment Counts Aggregation ---\n";

$countsData = null;
try {
    $ctrl->getSubtasksCommentCounts($authSale1, $taskId);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'RESPOND_TRIGGERED: ') === 0) {
        $jsonStr = substr($e->getMessage(), strlen('RESPOND_TRIGGERED: '));
        $resp = json_decode($jsonStr, true);
        $countsData = $resp['data'] ?? null;
    }
}

assertTest("getSubtasksCommentCounts returned valid array", is_array($countsData), "Counts keys: " . json_encode(array_keys($countsData ?? [])));
assertTest("Subtask sub_101 has count >= 1", isset($countsData['sub_101']) && $countsData['sub_101'] >= 1, "sub_101 count: " . ($countsData['sub_101'] ?? 0));


// Clean up test data
$pdo->exec("DELETE FROM notifications WHERE user_id IN (200001, 200002, 200003, 200004)");
$pdo->exec("DELETE FROM activity_comments WHERE activity_id = {$taskId}");
$pdo->exec("DELETE FROM activities WHERE id = {$taskId}");

printTestSummary("WORKSPACE TASK FULL LIFECYCLE & NOTIFICATIONS");
