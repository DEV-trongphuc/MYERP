<?php
// backend/master_all_backend_test_runner.php
// MASTER TEST RUNNER - GOM TOAN BO ALL BACKEND TEST SUITES VA CONTROLLERS

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "👑 MASTER BACKEND INTEGRATION TEST RUNNER\n";
echo "   Kiem thu gop toan bo tat ca 72+ file Backend\n";
echo "====================================================\n\n";

$masterStart = microtime(true);

// 1. Audit Controllers Syntax & Class Loading
echo "--- 1. AUDIT CONTROLLERS LOAD & SYNTAX ---\n";
$controllersDir = __DIR__ . '/controllers';
if (is_dir($controllersDir)) {
    $cFiles = glob($controllersDir . '/*Controller.php');
    foreach ($cFiles as $cFile) {
        $cName = basename($cFile);
        try {
            require_once $cFile;
            assertTest("Controller File Load: {$cName}", true);
        } catch (\Throwable $e) {
            assertTest("Controller File Load: {$cName}", false, "Error: " . $e->getMessage());
        }
    }
}

echo "\n--- 2. CHAY TEST SUITE: FULL SYSTEM HEALTH ---\n";
require_once __DIR__ . '/test_full_system.php';

echo "\n--- 3. CHAY TEST SUITE: SCHEMA & PAYLOAD AUDIT ---\n";
require_once __DIR__ . '/full_schema_payload_audit.php';

echo "\n--- 4. CHAY TEST SUITE: FULL MATRIX LOGIC & SHIFTS ---\n";
require_once __DIR__ . '/test_full_matrix_audit.php';

echo "\n--- 5. CHAY TEST SUITE: RBAC PERMISSION MATRIX ---\n";
require_once __DIR__ . '/test_permission_matrix.php';

echo "\n--- 6. CHAY TEST SUITE: EXTENDED BUSINESS RULES 1-4 ---\n";
require_once __DIR__ . '/test_extended_business_rules.php';

echo "\n--- 7. CHAY TEST SUITE: SQLSTATE & 500 STRESS TEST ---\n";
require_once __DIR__ . '/test_sqlstate_stress.php';

echo "\n--- 8. CHAY TEST SUITE: SMART LOGIC & DEFAULT CONFIGS AUDIT ---\n";
require_once __DIR__ . '/test_smart_logic_audit.php';

echo "\n--- 9. CHAY TEST SUITE: APPROVALS REJECTION REASON AUDIT ---\n";
require_once __DIR__ . '/test_approvals_rejection_audit.php';

echo "\n--- 10. CHAY TEST SUITE: COMPLETE ACADEMIC AUDIT ---\n";
require_once __DIR__ . '/test_complete_academic_audit.php';

echo "\n--- 11. CHAY TEST SUITE: ACADEMIC REMINDERS PAYLOAD AUDIT ---\n";
require_once __DIR__ . '/test_academic_reminders_payload.php';

echo "\n--- 12. CHAY TEST SUITE: SHARED CLASS AGGREGATION AUDIT ---\n";
require_once __DIR__ . '/test_shared_class_aggregation.php';

echo "\n--- 13. CHAY TEST SUITE: ALL LECTURERS SCHEDULE INTEGRITY ---\n";
require_once __DIR__ . '/test_all_lecturers_schedule.php';

echo "\n--- 14. CHAY TEST SUITE: WORKSPACE OPERATIONS INTEGRITY ---\n";
require_once __DIR__ . '/test_workspace_operations_suite.php';

echo "\n--- 15. CHAY TEST SUITE: WORKSPACE CONTACTS NOTIFICATIONS AUDIT ---\n";
require_once __DIR__ . '/test_workspace_contacts_notifications_audit.php';

echo "\n--- 16. CHAY TEST SUITE: SO/PO BOUNDARY CONCURRENCY AUDIT ---\n";
require_once __DIR__ . '/test_so_po_boundary_concurrency.php';

echo "\n--- 17. CHAY TEST SUITE: SO/PO APPROVALS AUDIT ---\n";
require_once __DIR__ . '/test_so_po_approvals_audit.php';

echo "\n--- 18. CHAY TEST SUITE: PARTNER PO BANKING INTEGRITY ---\n";
require_once __DIR__ . '/test_partner_po_banking.php';

echo "\n--- 19. CHAY TEST SUITE: CRON JOBS READINESS ---\n";
require_once __DIR__ . '/test_cron_jobs.php';

echo "\n--- 20. CHAY TEST SUITE: COOPERATION SLIPS PERFORMANCE BENCHMARK ---\n";
require_once __DIR__ . '/test_coop_slips_performance.php';

echo "\n--- 21. CHAY TEST SUITE: HRM PAYROLL FORMULAS ---\n";
require_once __DIR__ . '/test_hrm_payroll.php';

echo "\n--- 22. CHAY TEST SUITE: PO MULTI LEVEL APPROVALS ---\n";
require_once __DIR__ . '/test_po_multi_level_approval.php';

echo "\n--- 23. CHAY TEST SUITE: SO/PO FINANCIAL TRANSACTION INTEGRITY ---\n";
require_once __DIR__ . '/test_so_po_finance_audit.php';

echo "\n--- 24. CHAY TEST SUITE: DEPOSIT CURRENCY EXCHANGE RATE APPROVALS ---\n";
require_once __DIR__ . '/test_deposit_currency_approval.php';

echo "\n--- 25. CHAY TEST SUITE: TELESALES LEAD VISIBILITY BOUNDARIES ---\n";
require_once __DIR__ . '/test_lead_visibility_rules.php';

echo "\n--- 26. CHAY TEST SUITE: SYSTEM ROLE PERMISSIONS RBAC MATRIX ---\n";
require_once __DIR__ . '/test_extended_rbac_suite.php';

echo "\n--- 27. CHAY TEST SUITE: WORKSPACE TASK CHECKLISTS & TREE RENDERING ---\n";
require_once __DIR__ . '/test_workspace_task_suite.php';

echo "\n--- 28. CHAY TEST SUITE: AI DATASETS & PARAMETERS SCHEMA ---\n";
require_once __DIR__ . '/test_ai_training_structure.php';

echo "\n--- 29. CHAY TEST SUITE: WEBHOOK & REMINDERS TENANT ISOLATION ---\n";
require_once __DIR__ . '/test_webhook_sync_tenant_isolation.php';

echo "\n--- 30. CHAY TEST SUITE: MASTER OPERATIONS (NOTIFICATIONS, APPROVALS, PO/SO, WORKSPACE) ---\n";
require_once __DIR__ . '/test_master_operations_audit.php';

echo "\n--- 31. CHAY TEST SUITE: MASTER HRM & ATTENDANCE AUDIT ---\n";
require_once __DIR__ . '/test_master_hrm_audit.php';

echo "\n--- 32. CHAY TEST SUITE: 4-LAYER COMPREHENSIVE HRM VERIFICATION ---\n";
require_once __DIR__ . '/test_comprehensive_hrm_verification.php';

echo "\n--- 33. CHAY TEST SUITE: DATA EXPORT & FILTER INTEGRITY ---\n";
require_once __DIR__ . '/test_export_logic.php';

echo "\n--- 34. CHAY TEST SUITE: COMPREHENSIVE COMMENTS & MENTIONS ACROSS ALL MODULES ---\n";
require_once __DIR__ . '/test_comprehensive_all_mentions.php';

$masterEnd = microtime(true);
$duration = round(($masterEnd - $masterStart) * 1000, 2);

echo "\n====================================================\n";
echo "🏆 MASTER TEST RUNNER HOAN THANH TRONG {$duration} ms\n";
printTestSummary();

