<?php
// backend/test_team_linking.php
define('DIAG_TOKEN', true);
require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING TEAM LINKING INTEGRATION TESTS ===\n\n";

$tenantId = 1;

// Clean old test items to keep database pristine
$pdo->exec("DELETE FROM activities WHERE subject LIKE '[TEST_TEAM]%'");

// 1. Create a test activity task linked to multiple teams
$erpMeta = [
    'team_id' => 2, // Primary Team: Phòng Nhân sự
    'team_ids' => [2, 3], // Linked Teams: Phòng Nhân sự, Phòng Kế toán
    'description' => 'Test task with multiple linked teams'
];

$bodyContent = json_encode(['erp_task' => $erpMeta]);

$stmt = $pdo->prepare("
    INSERT INTO activities (tenant_id, user_id, subject, type, body, related_type, related_id, progress, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->execute([
    $tenantId,
    100009, // Dev Admin
    '[TEST_TEAM] Multi-team linked task',
    'task',
    $bodyContent,
    'contact',
    24, // Related Contact ID 24
    0,
    'planned'
]);
$taskId = (int)$pdo->lastInsertId();
assertTest("Create task activity with multiple linked teams in erpMeta", $taskId > 0, "Inserted Task ID: " . $taskId);

// 2. Query task back and check erpMeta structure
$stmtTask = $pdo->prepare("SELECT * FROM activities WHERE id = ?");
$stmtTask->execute([$taskId]);
$taskRow = $stmtTask->fetch(PDO::FETCH_ASSOC);

$parsedBody = json_decode($taskRow['body'], true);
$meta = $parsedBody['erp_task'] ?? null;

assertTest("Retrieve task activity from database", !empty($taskRow), "Task exists");
assertTest("Parse erp_task metadata from body JSON", !empty($meta), "Metadata parsed successfully");
assertTest("Verify primary team_id matches 2", ($meta['team_id'] ?? null) === 2, "team_id: " . ($meta['team_id'] ?? 'NULL'));
assertTest("Verify multi team_ids array contains 2 and 3", is_array($meta['team_ids']) && in_array(2, $meta['team_ids']) && in_array(3, $meta['team_ids']), "team_ids: " . json_encode($meta['team_ids'] ?? []));

// 3. Clean up
$pdo->exec("DELETE FROM activities WHERE id = " . $taskId);

printTestSummary();
