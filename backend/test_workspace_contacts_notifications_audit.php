<?php
// backend/test_workspace_contacts_notifications_audit.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 SYSTEM AUDIT: CUSTOMERS, WORKSPACE TASKS & NOTIFICATIONS\n";
echo "====================================================\n\n";

// 1. Audit Customers & Students Data Quality
echo "--- 1. CONTACTS & DATA QUALITY AUDIT ---\n";
$stmtContacts = $pdo->query("SELECT id, full_name, email, phone, pipeline_status FROM contacts WHERE deleted_at IS NULL");
$contacts = $stmtContacts->fetchAll();
$totalContacts = count($contacts);
echo "Total active contacts/leads: {$totalContacts}\n";

$noEmail = 0;
$noPhone = 0;
$invalidEmail = 0;
$invalidPhone = 0;

foreach ($contacts as $c) {
    if (empty($c['email'])) {
        $noEmail++;
    } else {
        if (!filter_var($c['email'], FILTER_VALIDATE_EMAIL)) {
            $invalidEmail++;
        }
    }
    
    if (empty($c['phone'])) {
        $noPhone++;
    } else {
        // Simple numeric and length check
        $cleanPhone = preg_replace('/[^0-9+]/', '', $c['phone']);
        if (strlen($cleanPhone) < 8) {
            $invalidPhone++;
        }
    }
}

assertTest("Contacts missing email address", $noEmail >= 0, "Count: {$noEmail} (" . round(($noEmail / max(1, $totalContacts)) * 100, 1) . "%)");
assertTest("Contacts with invalid email format", $invalidEmail === 0, "Count: {$invalidEmail}");
assertTest("Contacts missing phone number", $noPhone >= 0, "Count: {$noPhone} (" . round(($noPhone / max(1, $totalContacts)) * 100, 1) . "%)");
assertTest("Contacts with invalid/short phone format", $invalidPhone === 0, "Count: {$invalidPhone}");

// 2. Audit Workspace Tasks (Activities) Schema & Logic
echo "\n--- 2. WORKSPACE TASKS (ACTIVITIES) AUDIT ---\n";
$stmtTasks = $pdo->query("SELECT id, subject, require_approval, approval_status, status FROM activities WHERE type = 'task'");
$tasks = $stmtTasks->fetchAll();
$totalTasks = count($tasks);
echo "Total workspace tasks: {$totalTasks}\n";

$pendingApprovalCompleted = 0;
$orphanedSubtasks = 0;

foreach ($tasks as $t) {
    // Check if task is completed but still pending approval
    if ($t['status'] === 'done' && $t['require_approval'] == 1 && $t['approval_status'] === 'pending') {
        $pendingApprovalCompleted++;
    }
}

assertTest("Completed tasks still pending required approval", $pendingApprovalCompleted === 0, "Count: {$pendingApprovalCompleted}");

// Scan subtasks structure in erp_task JSON
$stmtMeta = $pdo->query("SELECT id, body FROM activities WHERE type = 'task' AND body LIKE '%\"checklist\"%'");
$metaTasks = $stmtMeta->fetchAll();
$totalSubtasks = 0;
foreach ($metaTasks as $mt) {
    $body = $mt['body'];
    // Try to parse erp_task metadata
    if ($body) {
        $currentBody = trim($body);
        while (strpos($currentBody, '{"erp_task"') === 0 || strpos($currentBody, '{"erp_task":') === 0) {
            try {
                $parsed = json_decode($currentBody, true);
                if (isset($parsed['erp_task']['checklist']) && is_array($parsed['erp_task']['checklist'])) {
                    $totalSubtasks += count($parsed['erp_task']['checklist']);
                }
                if (isset($parsed['erp_task']['description'])) {
                    $currentBody = trim($parsed['erp_task']['description']);
                } else {
                    break;
                }
            } catch (\Throwable $e) {
                break;
            }
        }
    }
}
echo "Total subtasks found nested in erp_task metadata: {$totalSubtasks}\n";

// 3. Notification Muting Logic E2E Check
echo "\n--- 3. NOTIFICATION MUTING FUNCTIONALITY ---\n";
// Add a mock mute entry
$taskId = 999999;
$userId = 100009; // Dev Admin
$pdo->exec("DELETE FROM task_muted_notifications WHERE task_id = {$taskId} AND user_id = {$userId}");

// Test Muting
$stmtMute = $pdo->prepare("INSERT INTO task_muted_notifications (task_id, user_id) VALUES (?, ?)");
$muteSuccess = $stmtMute->execute([$taskId, $userId]);
assertTest("Insert task mute record", $muteSuccess);

// Verify Mute Status
$stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM task_muted_notifications WHERE task_id = ? AND user_id = ?");
$stmtCheck->execute([$taskId, $userId]);
$isMuted = $stmtCheck->fetchColumn() > 0;
assertTest("Verify task is currently muted", $isMuted);

// Test Unmuting
$stmtUnmute = $pdo->prepare("DELETE FROM task_muted_notifications WHERE task_id = ? AND user_id = ?");
$unmuteSuccess = $stmtUnmute->execute([$taskId, $userId]);
$stmtCheck->execute([$taskId, $userId]);
$stillMuted = $stmtCheck->fetchColumn() > 0;
assertTest("Verify task unmute deletes record", $unmuteSuccess && !$stillMuted);

echo "\n";
printTestSummary();
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    exit($testStats['fail'] > 0 ? 1 : 0);
}
