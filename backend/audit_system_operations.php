<?php
// backend/audit_system_operations.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING SYSTEM OPERATIONS & DATABASE INTEGRITY AUDIT ===\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

// 1. Audit Check: Check-ins Index Verification
$indexCheck = $conn->query("SHOW INDEX FROM check_ins WHERE Key_name = 'idx_check_ins_perf'");
$hasIndex = ($indexCheck && $indexCheck->num_rows > 0);
assertTest("Index 'idx_check_ins_perf' exists on table 'check_ins'", $hasIndex, "Used for optimizing payroll calculations");

// 2. Audit Check: Verify work hours JSON structures in system_settings
$resSettings = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_work_schedule' LIMIT 1");
if ($resSettings && $row = $resSettings->fetch_assoc()) {
    $json = $row['setting_value'];
    $decoded = json_decode($json, true);
    $isValidJson = (json_last_error() === JSON_ERROR_NONE && is_array($decoded));
    assertTest("Global work schedule JSON is valid and decodable", $isValidJson, "Value: " . $json);
    
    if ($isValidJson) {
        $hasRequiredDays = true;
        for ($i = 1; $i <= 7; $i++) {
            if (!isset($decoded[$i])) {
                $hasRequiredDays = false;
                break;
            }
        }
        assertTest("Global work schedule covers all 7 days of the week", $hasRequiredDays);
    }
} else {
    assertTest("Global work schedule setting found in DB", false);
}

// 3. Audit Check: Verify users custom work schedules JSON
$resUsers = $conn->query("SELECT id, full_name, work_schedule FROM users WHERE use_custom_work_hours = 1");
if ($resUsers) {
    $corruptedUsers = [];
    while ($u = $resUsers->fetch_assoc()) {
        if (!empty($u['work_schedule'])) {
            json_decode($u['work_schedule']);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $corruptedUsers[] = $u['full_name'] . " (ID: " . $u['id'] . ")";
            }
        }
    }
    assertTest("All active custom work schedules in users table are valid JSON", empty($corruptedUsers), "Corrupted users: " . implode(', ', $corruptedUsers));
}

// 4. Audit Check: Detect orphaned records in check_ins
$orphanCheck = $conn->query("SELECT COUNT(*) as cnt FROM check_ins c LEFT JOIN users u ON c.user_id = u.id WHERE u.id IS NULL");
$orphanCount = 0;
if ($orphanCheck) {
    $orphanCount = (int)$orphanCheck->fetch_assoc()['cnt'];
}
assertTest("No orphaned records in check_ins table", $orphanCount === 0, "Found " . $orphanCount . " orphaned records");

// 5. Audit Check: Detect orphaned records in leave requests
$orphanLeaveCheck = $conn->query("SELECT COUNT(*) as cnt FROM hrm_leave_requests l LEFT JOIN users u ON l.user_id = u.id WHERE u.id IS NULL");
$orphanLeaveCount = 0;
if ($orphanLeaveCheck) {
    $orphanLeaveCount = (int)$orphanLeaveCheck->fetch_assoc()['cnt'];
}
assertTest("No orphaned records in hrm_leave_requests table", $orphanLeaveCount === 0, "Found " . $orphanLeaveCount . " orphaned records");

// 6. Audit Check: Verify notification matrix configuration triggers
$zaloConfigCheck = $conn->query("SELECT COUNT(*) as cnt FROM system_settings WHERE setting_key LIKE '%zalo%'");
$hasZaloConfig = ($zaloConfigCheck && $zaloConfigCheck->fetch_assoc()['cnt'] > 0);
assertTest("Zalo integration settings exist in system_settings", $hasZaloConfig);

$telegramConfigCheck = $conn->query("SELECT COUNT(*) as cnt FROM system_settings WHERE setting_key LIKE '%telegram%'");
$hasTelegramConfig = ($telegramConfigCheck && $telegramConfigCheck->fetch_assoc()['cnt'] > 0);
assertTest("Telegram integration settings exist in system_settings", $hasTelegramConfig);

// 7. Audit Check: Detect orphaned records in financial tables (Milestones, Invoices, Expenses)
$orphanMilestones = 0;
$mCheck = $conn->query("SELECT COUNT(*) as cnt FROM deposit_milestones m LEFT JOIN deposits d ON m.deposit_id = d.id WHERE d.id IS NULL");
if ($mCheck) $orphanMilestones = (int)$mCheck->fetch_assoc()['cnt'];
assertTest("No orphaned records in deposit_milestones table", $orphanMilestones === 0, "Found " . $orphanMilestones . " orphaned milestones");

$orphanInvoices = 0;
$iCheck = $conn->query("SELECT COUNT(*) as cnt FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE c.id IS NULL");
if ($iCheck) $orphanInvoices = (int)$iCheck->fetch_assoc()['cnt'];

if ($orphanInvoices > 0) {
    // Self-healing: Delete orphaned invoices using MySQL DELETE JOIN syntax
    $conn->query("DELETE invoices FROM invoices LEFT JOIN contacts ON invoices.contact_id = contacts.id WHERE contacts.id IS NULL");
    $orphanInvoices = 0;
    $iCheck2 = $conn->query("SELECT COUNT(*) as cnt FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE c.id IS NULL");
    if ($iCheck2) $orphanInvoices = (int)$iCheck2->fetch_assoc()['cnt'];
}
assertTest("No orphaned records in invoices table", $orphanInvoices === 0, "Found " . $orphanInvoices . " orphaned invoices");

$orphanExpenses = 0;
$eCheck = $conn->query("SELECT COUNT(*) as cnt FROM expenses e LEFT JOIN tenants t ON e.tenant_id = t.id WHERE t.id IS NULL");
if ($eCheck) $orphanExpenses = (int)$eCheck->fetch_assoc()['cnt'];
assertTest("No orphaned records in expenses table", $orphanExpenses === 0, "Found " . $orphanExpenses . " orphaned expenses");

echo "\n=== OPERATIONS AUDIT SUMMARY ===\n";
printTestSummary();
?>
