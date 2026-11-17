<?php
declare(strict_types=1);

/**
 * Round-2 Enterprise Multi-Tenant SaaS, Dynamic Custom RBAC, Migration Idempotency & Atomic Approval Verification Suite
 */

if (!class_exists('RespondException')) {
    class RespondException extends RuntimeException
    {
        public int $statusCode;
        public mixed $payload;
        public string $msg;
        public bool $ok;

        public function __construct(int $code, mixed $data, string $message, bool $success)
        {
            parent::__construct($message, $code);
            $this->statusCode = $code;
            $this->payload = $data;
            $this->msg = $message;
            $this->ok = $success;
        }
    }
}

if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void
    {
        throw new RespondException($code, $data, $message, $success);
    }
}

if (!function_exists('getBody')) {
    function getBody(): array
    {
        return $GLOBALS['__test_body'] ?? [];
    }
}

if (!function_exists('logActivity')) {
    function logActivity(PDO $db, $tenantId, $userId, string $action, string $entityType = '', $entityId = null, $details = null): void
    {
    }
}

if (!function_exists('logInteraction')) {
    function logInteraction(PDO $db, $tenantId, $userId, string $type, string $subject, string $body, string $entityType, $entityId): void
    {
    }
}

require_once __DIR__ . '/../../backend/config/TenantConfigService.php';
require_once __DIR__ . '/../../backend/migrations/337_enterprise_multitenant_saas_architecture.php';
require_once __DIR__ . '/../../backend/migrations/338_schema_parity_and_soft_delete_complete.php';
require_once __DIR__ . '/../../backend/controllers/FinanceController.php';
require_once __DIR__ . '/../../backend/controllers/DepositController.php';
require_once __DIR__ . '/../../backend/controllers/PurchaseOrderController.php';
require_once __DIR__ . '/../../backend/controllers/CooperationController.php';
require_once __DIR__ . '/../../backend/controllers/HRMController.php';

$passed = 0;
$failed = 0;

function assertCheck(bool $cond, string $label): void
{
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "  [PASS] {$label}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$label}\n";
    }
}

function invokeController(callable $fn): array
{
    try {
        $fn();
        return ['code' => 200, 'data' => null, 'message' => '', 'success' => true];
    } catch (RespondException $re) {
        return ['code' => $re->statusCode, 'data' => $re->payload, 'message' => $re->msg, 'success' => $re->ok];
    }
}

echo "======================================================================\n";
echo "  ROUND-2 LIVE PDO MULTI-TENANT, CUSTOM RBAC & ATOMIC APPROVAL PROOF\n";
echo "======================================================================\n";

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

// Create core operational tables for live controller verification
$pdo->exec("CREATE TABLE contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    company_id INTEGER NULL,
    project_id INTEGER NULL,
    owner_id INTEGER NULL,
    created_by INTEGER NULL,
    full_name TEXT NOT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    status TEXT DEFAULT 'lead',
    pipeline_status TEXT DEFAULT 'new',
    stage_id INTEGER NULL,
    collaborator_ids TEXT NULL,
    deleted_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    deleted_at TEXT NULL
)");

$pdo->exec("CREATE TABLE deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NULL,
    company_id INTEGER NULL,
    supplier_id INTEGER NULL,
    project_id INTEGER NULL,
    unit_code TEXT NULL,
    price REAL NOT NULL DEFAULT 0,
    expected_commission REAL DEFAULT 0,
    currency TEXT DEFAULT 'VND',
    exchange_rate REAL DEFAULT 1,
    status TEXT DEFAULT 'pending',
    cancelled_reason TEXT NULL,
    accountant_id INTEGER NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT NULL
)");

$pdo->exec("CREATE TABLE deposit_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deposit_id INTEGER NOT NULL,
    milestone_name TEXT NOT NULL,
    expected_amount REAL NOT NULL DEFAULT 0,
    original_amount REAL NULL,
    actual_amount REAL NULL,
    status TEXT DEFAULT 'pending',
    unc_file_path TEXT NULL,
    approval_date TEXT NULL,
    approved_by INTEGER NULL
)");

$pdo->exec("CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    contact_id INTEGER NULL,
    company_id INTEGER NULL,
    created_by INTEGER NULL,
    invoice_number TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    issue_date TEXT NULL,
    due_date TEXT NULL,
    paid_at TEXT NULL,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    shipping_fee REAL DEFAULT 0,
    total REAL DEFAULT 0,
    is_inventory_deducted INTEGER DEFAULT 0,
    notes TEXT NULL,
    deleted_at TEXT NULL
)");

$pdo->exec("CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Khác',
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'VND',
    vat_amount REAL DEFAULT 0,
    date TEXT NULL,
    due_date TEXT NULL,
    status TEXT DEFAULT 'pending',
    approval_status TEXT DEFAULT 'pending',
    approver_id INTEGER NULL,
    approver_id_2 INTEGER NULL,
    approver_id_3 INTEGER NULL,
    approved_by INTEGER NULL,
    approved_by_2 INTEGER NULL,
    approved_by_3 INTEGER NULL,
    status_level_1 TEXT DEFAULT 'pending',
    status_level_2 TEXT DEFAULT 'none',
    status_level_3 TEXT DEFAULT 'none',
    approved_at TEXT NULL,
    approved_at_2 TEXT NULL,
    approved_at_3 TEXT NULL,
    reject_reason TEXT NULL,
    notes TEXT NULL,
    items TEXT NULL,
    vendor_name TEXT NULL,
    has_vat_invoice INTEGER DEFAULT 0,
    is_vat_inclusive INTEGER DEFAULT 0,
    image_url TEXT NULL,
    refund_image_url TEXT NULL,
    refunder_id INTEGER NULL,
    is_refunded INTEGER DEFAULT 0,
    refunded_at TEXT NULL,
    related_user_ids TEXT NULL,
    deleted_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE expense_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    amount REAL DEFAULT 0
)");

$pdo->exec("CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    bank_account TEXT NULL,
    total_ordered REAL DEFAULT 0,
    created_by INTEGER NULL,
    deleted_at TEXT NULL
)");

$pdo->exec("CREATE TABLE purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    supplier_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    po_number TEXT NOT NULL,
    order_date TEXT NULL,
    status TEXT DEFAULT 'pending_approval',
    payment_status TEXT DEFAULT 'unpaid',
    paid_amount REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    notes TEXT NULL,
    approver_id INTEGER NULL,
    approver_id_2 INTEGER NULL,
    approver_id_3 INTEGER NULL,
    approved_by INTEGER NULL,
    approved_by_2 INTEGER NULL,
    approved_by_3 INTEGER NULL,
    status_level_1 TEXT DEFAULT 'pending',
    status_level_2 TEXT DEFAULT 'none',
    status_level_3 TEXT DEFAULT 'none',
    approval_status TEXT DEFAULT 'pending',
    related_user_ids TEXT NULL,
    deleted_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    product_id INTEGER NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0
)");

$pdo->exec("CREATE TABLE cooperation_slips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    deposit_slip_id INTEGER NULL,
    version INTEGER DEFAULT 1,
    total_percentage REAL DEFAULT 100,
    shares_json TEXT NULL,
    signatures_json TEXT NULL,
    status TEXT DEFAULT 'pending_manager_approval',
    created_by INTEGER NOT NULL,
    approved_by INTEGER NULL,
    approved_at TEXT NULL,
    deleted_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE hrm_profiles (
    user_id INTEGER PRIMARY KEY,
    joined_date TEXT NULL,
    annual_leave_total REAL DEFAULT 12.0,
    annual_leave_used REAL DEFAULT 0.0,
    compensatory_leave_total REAL DEFAULT 0.0,
    compensatory_leave_used REAL DEFAULT 0.0
)");

$pdo->exec("CREATE TABLE hrm_leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL DEFAULT 'annual',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days REAL NOT NULL DEFAULT 1.0,
    unpaid_days REAL DEFAULT 0.0,
    salary_rate REAL DEFAULT 100.0,
    ot_type TEXT NULL,
    ot_rate REAL NULL,
    reason TEXT NULL,
    status TEXT DEFAULT 'pending',
    approver_id INTEGER NULL,
    approver_id_2 INTEGER NULL,
    approved_by INTEGER NULL,
    approved_by_2 INTEGER NULL,
    approved_at TEXT NULL,
    status_level_1 TEXT DEFAULT 'pending',
    status_level_2 TEXT DEFAULT 'none',
    related_user_ids TEXT NULL,
    deleted_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE hrm_salary_advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reason TEXT NULL,
    request_date TEXT NULL,
    status TEXT DEFAULT 'pending',
    approver_id INTEGER NULL,
    approver_id_2 INTEGER NULL,
    approved_by INTEGER NULL,
    approved_by_2 INTEGER NULL,
    approved_at TEXT NULL,
    status_level_1 TEXT DEFAULT 'pending',
    status_level_2 TEXT DEFAULT 'none',
    related_user_ids TEXT NULL,
    deleted_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    body TEXT NULL,
    type TEXT NULL,
    link TEXT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

// 1. Verify Migration 337 + 338 Idempotency & Legacy Tenant 1 Preservation vs Clean Tenant 2 Isolation
TenantConfigService::ensureSchema($pdo, 1);
$pdo->exec("INSERT INTO tenants (id, name, slug, domain, is_active) VALUES (1, 'Viện Quốc Tế IDEAS', 'ideas', 'myerp.ideas.edu.vn', 1)");
$pdo->exec("INSERT INTO tenants (id, name, slug, domain, support_email, is_active) VALUES (2, 'Alpha Global Corp', 'alpha-corp', 'erp.alphaglobal.io', 'ops@alphaglobal.io', 1)");

$m337Run1 = run_migration_337_enterprise_multitenant_saas($pdo);
$m337Run2 = run_migration_337_enterprise_multitenant_saas($pdo);
$m338Run1 = run_migration_338_schema_parity_and_soft_delete($pdo);
$m338Run2 = run_migration_338_schema_parity_and_soft_delete($pdo);

assertCheck(in_array(1, $m337Run1['tenants_seeded'], true) && in_array(2, $m337Run2['tenants_seeded'], true), 'Migration 337 runs twice idempotently across multiple tenants');
assertCheck($m338Run1['migration'] === '338_schema_parity_and_soft_delete_complete' && $m338Run2['migration'] === '338_schema_parity_and_soft_delete_complete', 'Migration 338 runs twice idempotently with zero SQL errors');

// Verify Tenant 1 preserved existing live defaults while Tenant 2 has zero Tenant-1 brand/domain bleed
assertCheck(TenantConfigService::getBrandName($pdo, 1) === 'Viện Quốc Tế IDEAS', 'Tenant 1 preserves existing brand name after migration');
assertCheck(TenantConfigService::getBrandPrefix($pdo, 1) === '[IDEAS]', 'Tenant 1 preserves [IDEAS] email prefix from DB settings');
assertCheck(TenantConfigService::getFrontendUrl($pdo, 1) === 'https://myerp.ideas.edu.vn', 'Tenant 1 preserves frontend_url in DB settings');

assertCheck(TenantConfigService::getBrandName($pdo, 2) === 'Alpha Global Corp', 'Tenant 2 resolves isolated brand name Alpha Global Corp');
assertCheck(TenantConfigService::getFrontendUrl($pdo, 2) === 'https://erp.alphaglobal.io', 'Tenant 2 resolves isolated domain https://erp.alphaglobal.io');
assertCheck(stripos(TenantConfigService::getDefaultSenderEmail($pdo, 2), 'ideas') === false, 'Tenant 2 default sender email has zero Tenant 1 domain leakage');

// 2. Seed Users, Teams & Custom Roles in Tenant 1 & Tenant 2
$pdo->exec("INSERT INTO teams (id, tenant_id, name, department_code, is_sales_team, leader_id) VALUES
    (10, 1, 'Sales Team A', 'sales', 1, 102),
    (11, 1, 'Sales Team B', 'sales', 1, 106),
    (20, 2, 'Alpha Team', 'sales', 1, 201)
");

$pdo->exec("INSERT INTO users (id, tenant_id, email, full_name, role, team_id, is_active) VALUES
    (101, 1, 'dir@t1.com', 'Director T1', 'director', NULL, 1),
    (102, 1, 'mgrA@t1.com', 'Manager Team A', 'manager', 10, 1),
    (103, 1, 'saleA@t1.com', 'Sale Team A', 'sales', 10, 1),
    (104, 1, 'cfo@t1.com', 'Custom CFO Approver', 'cfo_approver', NULL, 1),
    (105, 1, 'mkt_revoked@t1.com', 'Revoked Marketing User', 'marketing', NULL, 1),
    (106, 1, 'mgrB@t1.com', 'Manager Team B', 'manager', 11, 1),
    (107, 1, 'acc@t1.com', 'Accountant T1', 'accountant', NULL, 1),
    (201, 2, 'admin@t2.com', 'Admin Tenant 2', 'admin', 20, 1)
");

// Create Custom Role `cfo_approver` in Tenant 1 (role_group = 'staff', granted expenses.approve='all', deposits.approve='all', cooperation.approve='all', purchase_orders.approve='all')
$customCfoPerms = [
    'expenses' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'all'],
    'deposits' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'all'],
    'purchase_orders' => ['read' => 'all', 'write' => 'own', 'delete' => 'none', 'approve' => 'all'],
    'cooperation' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'all'],
];
$stmtInsRole = $pdo->prepare("INSERT INTO tenant_roles (tenant_id, role_slug, name, role_group, can_self_approve, is_system, permissions_json, is_active) VALUES (1, 'cfo_approver', 'CFO Approver', 'staff', 0, 0, ?, 1)");
$stmtInsRole->execute([json_encode($customCfoPerms)]);

// Revoke marketing.write -> 'none' on user 105 via permissions_json
$revokedPerms = ['marketing' => ['read' => 'all', 'write' => 'none', 'delete' => 'none', 'approve' => 'none']];
$pdo->prepare("UPDATE users SET permissions_json = ? WHERE id = 105")->execute([json_encode($revokedPerms)]);
TenantConfigService::invalidateCache(1);

$authDirector1 = ['user_id' => 101, 'tenant_id' => 1, 'role' => 'director', 'full_name' => 'Director T1'];
$authMgrA      = ['user_id' => 102, 'tenant_id' => 1, 'role' => 'manager', 'team_id' => 10, 'full_name' => 'Manager Team A'];
$authSaleA     = ['user_id' => 103, 'tenant_id' => 1, 'role' => 'sales', 'team_id' => 10, 'full_name' => 'Sale Team A'];
$authCustomCfo = ['user_id' => 104, 'tenant_id' => 1, 'role' => 'cfo_approver', 'full_name' => 'Custom CFO Approver'];
$authRevokedMkt = ['user_id' => 105, 'tenant_id' => 1, 'role' => 'marketing', 'permissions' => $revokedPerms, 'full_name' => 'Revoked Marketing User'];
$authMgrB      = ['user_id' => 106, 'tenant_id' => 1, 'role' => 'manager', 'team_id' => 11, 'full_name' => 'Manager Team B'];
$authAcc1      = ['user_id' => 107, 'tenant_id' => 1, 'role' => 'accountant', 'full_name' => 'Accountant T1'];
$authAdmin2    = ['user_id' => 201, 'tenant_id' => 2, 'role' => 'admin', 'team_id' => 20, 'full_name' => 'Admin Tenant 2'];

// 3. Verify Dynamic Custom RBAC & Revocation Enforcement
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authCustomCfo, ['admin', 'accountant'], 'expenses', 'approve') === true, 'Custom role cfo_approver satisfies expenses.approve without hardcoded slug');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authCustomCfo, ['admin', 'sales'], 'contacts', 'write') === false, 'Custom role cfo_approver blocked from ungranted contacts.write');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authRevokedMkt, ['admin', 'marketing'], 'marketing', 'write', ['all', 'team', 'own']) === false, 'System role marketing with revoked marketing.write=none is strictly blocked');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleA, ['admin', 'director'], 'contacts', 'read', ['all']) === false, 'Sale with contacts.read=own cannot escalate to global all scope');

// 4. Live FinanceController Expense Creation, Boundary Validation, Team Isolation, Anti-Self-Approval & Multi-Level Custom Role Approval
$finCtrl = new FinanceController($pdo);

// Boundary: negative expense rejected
$GLOBALS['__test_body'] = ['title' => 'Negative Expense', 'amount' => -500000];
$resNegExp = invokeController(fn() => $finCtrl->createExpense($authSaleA));
assertCheck($resNegExp['code'] === 422, 'Negative expense amount rejected with HTTP 422');

// Create expense by Sale A (3,000,000 VND -> auto-resolves Team A leader 102!)
$pdo->exec("INSERT INTO expenses (id, tenant_id, created_by, title, amount, status, approval_status, approver_id, approver_id_2, status_level_1, status_level_2) VALUES
    (501, 1, 103, 'Chi phí tiếp khách Team A', 3000000, 'pending', 'pending', NULL, 104, 'pending', 'pending')
");
$resolvedApprover = TenantConfigService::resolveUserApprover($pdo, 1, 103, 'expense');
assertCheck($resolvedApprover === 102, 'Auto-approver resolves to Sale A Team Leader (102) in Tenant 1');

// Sale A cannot self-approve own expense
$resSelfExp = invokeController(fn() => $finCtrl->approveExpense($authSaleA, 501));
assertCheck($resSelfExp['code'] === 403, 'Creator Sale A blocked from self-approving own expense (HTTP 403)');

// Manager Team B cannot approve Sale Team A's unassigned Level 1 expense (Cross-Team Isolation)
$resWrongTeam = invokeController(fn() => $finCtrl->approveExpense($authMgrB, 501));
assertCheck($resWrongTeam['code'] === 403, 'Manager Team B blocked from approving Team A expense (HTTP 403)');

// Tenant 2 Admin cannot approve Tenant 1 expense (Cross-Tenant IDOR Defense)
$resCrossTenantExp = invokeController(fn() => $finCtrl->approveExpense($authAdmin2, 501));
assertCheck($resCrossTenantExp['code'] === 404, 'Tenant 2 Admin blocked from accessing Tenant 1 expense (HTTP 404)');

// Manager Team A approves Level 1 -> status stays pending waiting for Level 2 (104 Custom CFO)
$resLvl1 = invokeController(fn() => $finCtrl->approveExpense($authMgrA, 501));
$expAfterLvl1 = $pdo->query("SELECT status, status_level_1, status_level_2 FROM expenses WHERE id = 501")->fetch();
assertCheck($resLvl1['code'] === 200 && $expAfterLvl1['status_level_1'] === 'approved' && $expAfterLvl1['status'] === 'pending', 'Manager Team A approves Level 1; expense awaits Level 2');

// Custom CFO role (104) approves Level 2 -> expense transitions to approved!
$resLvl2 = invokeController(fn() => $finCtrl->approveExpense($authCustomCfo, 501));
$expAfterLvl2 = $pdo->query("SELECT status, approval_status, status_level_2, approved_by_2 FROM expenses WHERE id = 501")->fetch();
assertCheck($resLvl2['code'] === 200 && $expAfterLvl2['status'] === 'approved' && (int)$expAfterLvl2['approved_by_2'] === 104, 'Custom role cfo_approver approves Level 2 finalizing expense');

// Double-approval race guard -> 422
$resDoubleExp = invokeController(fn() => $finCtrl->approveExpense($authDirector1, 501));
assertCheck($resDoubleExp['code'] === 422, 'Double-approving already approved expense rejected with HTTP 422');

// 5. Live DepositController Anti-Self-Approval (including confirmPayment & approveMilestone) & Custom Role Approval
$depCtrl = new DepositController($pdo);
$pdo->exec("INSERT INTO projects (id, tenant_id, name) VALUES (1, 1, 'MBA Swiss')");
$pdo->exec("INSERT INTO contacts (id, tenant_id, owner_id, created_by, full_name) VALUES (1001, 1, 103, 103, 'Học viên Nguyễn Văn A')");
$pdo->exec("INSERT INTO deposits (id, contact_id, project_id, price, status, created_by) VALUES (701, 1001, 1, 20000000, 'pending', 107)");
$pdo->exec("INSERT INTO deposit_milestones (id, deposit_id, milestone_name, expected_amount, status) VALUES (801, 701, 'Đợt 1', 20000000, 'pending')");

// Accountant 107 created deposit 701 -> cannot self-approve via confirmPayment OR approveMilestone!
$GLOBALS['__test_body'] = [];
$resDepSelfConfirm = invokeController(fn() => $depCtrl->confirmPayment($authAcc1, 701));
assertCheck($resDepSelfConfirm['code'] === 403, 'Accountant creator blocked from self-approving deposit via confirmPayment (HTTP 403)');

$resDepSelfMile = invokeController(fn() => $depCtrl->approveMilestone($authAcc1, 701, 801));
assertCheck($resDepSelfMile['code'] === 403, 'Accountant creator blocked from self-approving deposit via approveMilestone (HTTP 403)');

// Custom CFO Approver (104) approves milestone 801 -> succeeds and creates paid invoice!
$resDepCfo = invokeController(fn() => $depCtrl->approveMilestone($authCustomCfo, 701, 801));
$depRowAfter = $pdo->query("SELECT status FROM deposits WHERE id = 701")->fetch();
assertCheck($resDepCfo['code'] === 200 && $depRowAfter['status'] === 'approved', 'Custom CFO role approves deposit milestone & transitions deposit to approved');

// Double milestone approval rejected with 422
$resDepDouble = invokeController(fn() => $depCtrl->approveMilestone($authDirector1, 701, 801));
assertCheck($resDepDouble['code'] === 422, 'Double milestone approval rejected with HTTP 422');

// 6. Live CooperationController Cross-Tenant IDOR Fix, Soft-Delete & Custom Role Approval
$coopCtrl = new CooperationController($pdo);
$pdo->exec("INSERT INTO cooperation_slips (id, contact_id, shares_json, status, created_by) VALUES (901, 1001, '{\"103\":100}', 'pending_manager_approval', 103)");

// Tenant 2 Admin attempting to view/approve/delete Tenant 1 slip -> blocked (403/404)!
$resCoopCrossTenant = invokeController(fn() => $coopCtrl->approveSlip($authAdmin2, 901));
assertCheck($resCoopCrossTenant['code'] === 404, 'Tenant 2 Admin blocked from approving Tenant 1 cooperation slip (IDOR closed)');

// Custom CFO Approver approves slip 901 -> 200
$resCoopApprove = invokeController(fn() => $coopCtrl->approveSlip($authCustomCfo, 901));
$coopStatus = $pdo->query("SELECT status FROM cooperation_slips WHERE id = 901")->fetchColumn();
assertCheck($resCoopApprove['code'] === 200 && $coopStatus === 'approved', 'Custom role approves cooperation slip via dynamic workflow');

// Soft-delete on cooperation_slips preserves row with non-null deleted_at
$resCoopDel = invokeController(fn() => $coopCtrl->destroy($authDirector1, 901));
$coopDeletedAt = $pdo->query("SELECT deleted_at FROM cooperation_slips WHERE id = 901")->fetchColumn();
assertCheck($resCoopDel['code'] === 200 && !empty($coopDeletedAt), 'CooperationController::destroy performs 100% Soft-Delete');

// 7. Live HRMController Leave Double-Approval Guard & Soft-Delete Proof
$hrmCtrl = new HRMController($pdo);
$pdo->exec("INSERT INTO hrm_profiles (user_id, annual_leave_total, annual_leave_used) VALUES (103, 12.0, 2.0)");
$pdo->exec("INSERT INTO hrm_leave_requests (id, user_id, leave_type, start_date, end_date, total_days, status, approver_id, status_level_1) VALUES (601, 103, 'annual', '2026-11-20', '2026-11-21', 2.0, 'pending', 102, 'pending')");

$GLOBALS['__test_body'] = ['id' => 601, 'status' => 'approved'];
$resLeaveApp1 = invokeController(fn() => $hrmCtrl->approveLeave($authMgrA, 601));
$usedAfter1 = (float)$pdo->query("SELECT annual_leave_used FROM hrm_profiles WHERE user_id = 103")->fetchColumn();
assertCheck($resLeaveApp1['code'] === 200 && abs($usedAfter1 - 4.0) < 0.001, 'Approving 2-day annual leave deducts exactly 2.0 days (2.0 -> 4.0)');

$resLeaveDouble = invokeController(fn() => $hrmCtrl->approveLeave($authDirector1, 601));
$usedAfterDouble = (float)$pdo->query("SELECT annual_leave_used FROM hrm_profiles WHERE user_id = 103")->fetchColumn();
assertCheck($resLeaveDouble['code'] === 422 && abs($usedAfterDouble - 4.0) < 0.001, 'Second approval attempt on leave rejected with HTTP 422 and zero double-deduction');

$pdo->exec("INSERT INTO hrm_leave_requests (id, user_id, leave_type, start_date, end_date, total_days, status, approver_id) VALUES (602, 103, 'annual', '2026-12-01', '2026-12-01', 1.0, 'pending', 102)");
$resLeaveSoftDel = invokeController(fn() => $hrmCtrl->deleteLeave($authSaleA, 602));
$leave602DeletedAt = $pdo->query("SELECT deleted_at FROM hrm_leave_requests WHERE id = 602")->fetchColumn();
assertCheck($resLeaveSoftDel['code'] === 200 && !empty($leave602DeletedAt), 'HRMController::deleteLeave performs 100% Soft-Delete');

// 8. Round-2 Red-Team Adversarial Regression Proofs (Privilege Escalation, Module Aliases, Tenant Asset Isolation, State Machines)
require_once __DIR__ . '/../../backend/controllers/SupplierController.php';
require_once __DIR__ . '/../../backend/controllers/SalesOrderController.php';
$pdo->exec("ALTER TABLE cooperation_slips ADD COLUMN dispute_details TEXT NULL");
$pdo->exec("CREATE TABLE sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    so_number TEXT NOT NULL DEFAULT 'SO-001',
    created_by INTEGER NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT NULL,
    deleted_at TEXT NULL
)");
$pdo->exec("CREATE TABLE subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER DEFAULT 1, email TEXT)");
$m338SqliteAlter = run_migration_338_schema_parity_and_soft_delete($pdo);
$subColsAfter338 = array_column($pdo->query("PRAGMA table_info(subscribers)")->fetchAll(PDO::FETCH_ASSOC), 'name');
assertCheck(in_array('deleted_at', $subColsAfter338, true), 'Migration 338 idempotently adds missing deleted_at column on SQLite tables via PRAGMA');

// 8A. Zero Cross-Tenant Private Asset Leakage (Google Drive / Swiss UMEF / ISTEC / ESTIAM isolated to Tenant 1)
$t1Progs = TenantConfigService::getAcademicPrograms($pdo, 1);
$t2Progs = TenantConfigService::getAcademicPrograms($pdo, 2);
$t2Tpls  = TenantConfigService::getEmailTemplates($pdo, 2);
$t2CombinedJson = json_encode([$t2Progs, $t2Tpls], JSON_UNESCAPED_UNICODE);
assertCheck(count($t1Progs) >= 8, 'Tenant 1 retains full 8 legacy academic programs (MBA/EMBA/MSC/BBA/ISTEC/ESTIAM)');
assertCheck(
    stripos($t2CombinedJson, 'drive.google.com') === false &&
    stripos($t2CombinedJson, 'swiss-umef') === false &&
    stripos($t2CombinedJson, 'istec') === false &&
    stripos($t2CombinedJson, 'estiam') === false,
    'Tenant 2 academic programs & email templates have zero Tenant 1 private Drive/school leakage'
);

// 8B. Privilege Escalation & Role-Identity Bleed Prevention
$authSaleAdmin1 = ['user_id' => 110, 'tenant_id' => 1, 'role' => 'sale_admin', 'full_name' => 'Sale Admin T1'];
$authAssistant1 = ['user_id' => 111, 'tenant_id' => 1, 'role' => 'assistant', 'full_name' => 'Assistant T1'];
$authHr1        = ['user_id' => 112, 'tenant_id' => 1, 'role' => 'hr', 'full_name' => 'HR T1'];
$authViewer1    = ['user_id' => 113, 'tenant_id' => 1, 'role' => 'viewer', 'full_name' => 'Viewer T1'];
$authAcademic1  = ['user_id' => 114, 'tenant_id' => 1, 'role' => 'academic', 'full_name' => 'Academic T1'];

assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleA, ['admin', 'manager', 'director', 'accountant'], 'invoices', 'write') === false, 'Sales user strictly blocked from invoices.write (privilege escalation closed)');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleA, ['admin', 'manager', 'director', 'marketing', 'academic'], 'projects', 'write') === false, 'Sales user strictly blocked from projects.write');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleAdmin1, ['admin', 'director', 'hr'], 'users', 'write') === false, 'Sale Admin strictly blocked from users.write / sensitive PII escalation');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authAssistant1, ['admin', 'director', 'hr'], 'users', 'write') === false, 'Assistant strictly blocked from users.write / admin user mutation');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleAdmin1, ['admin', 'director'], 'reports', 'read', ['all']) === false, 'Sale Admin does not masquerade as Admin/Director when requiredScopes=[all] is passed');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleAdmin1, ['sale_admin'], 'contacts', 'read', ['all']) === true, 'Sale Admin retains contacts.read=[all] for Sale Admin dashboard');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authHr1, ['admin', 'director'], 'hrm', 'approve', ['all']) === false, 'HR does not masquerade as Global Executive on hrm.approve=[all]');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authHr1, ['hr'], 'hrm', 'approve', ['all']) === true, 'HR retains full hrm.approve=[all] when HR is in allowedRoles');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authViewer1, ['admin', 'director', 'accountant', 'assistant'], 'expenses', 'read', ['all']) === false, 'Viewer strictly blocked from global expenses.read');

$supCtrl = new SupplierController($pdo);
$GLOBALS['__test_body'] = ['name' => 'Unauthorized Supplier'];
$resSaleSup = invokeController(fn() => $supCtrl->store($authSaleA));
assertCheck($resSaleSup['code'] === 403, 'SupplierController blocks sales user from creating suppliers (HTTP 403)');

// 8C. Module Alias Normalization & Backward-Compatible Explicit Whitelist
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleAdmin1, ['admin', 'director', 'manager', 'sale_admin'], 'tasks', 'write', ['all', 'team']) === true, 'Module alias tasks -> workspace works for sale_admin');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authSaleAdmin1, ['admin', 'director', 'manager', 'sale_admin'], 'cooperations', 'approve') === true, 'Canonical cooperations.approve works for sale_admin');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authAcademic1, ['academic'], 'academic', 'read') === true, 'Module alias academic -> students works for academic role');
assertCheck(TenantConfigService::doesUserSatisfyRoles($pdo, $authAcc1, ['accountant'], 'payroll', 'read') === true, 'Module alias payroll -> hrm works for accountant role');

// 8D. Custom Role Expansion in Notification & Approver Resolution
$pdo->exec("INSERT INTO users (id, tenant_id, email, full_name, role, is_active) VALUES (115, 1, 'finhead@t1.com', 'Finance Group Custom Role', 'chief_fin_custom', 1)");
$pdo->prepare("INSERT INTO tenant_roles (tenant_id, role_slug, name, role_group, can_self_approve, is_system, permissions_json, is_active) VALUES (1, 'chief_fin_custom', 'Chief Finance Custom', 'finance', 0, 0, ?, 1)")
    ->execute([json_encode(['deposits' => ['read' => 'all', 'write' => 'all', 'delete' => 'none', 'approve' => 'all']])]);
TenantConfigService::invalidateCache(1);
$depNotifRecips = TenantConfigService::resolveNotificationRecipients($pdo, 1, 'DEPOSIT_CREATED', ['actor_id' => 103]);
$depRecipIds = array_map(fn($r) => (int)$r['id'], $depNotifRecips);
assertCheck(in_array(115, $depRecipIds, true), 'Custom role with role_group=finance receives DEPOSIT_CREATED notification');

// 8E. Approval Boundary & Soft-Delete Guards (Deposits, Cooperation, SalesOrder, HRM)
$pdo->exec("INSERT INTO deposits (id, contact_id, project_id, price, status, created_by) VALUES (702, 1001, 1, 15000000, 'pending', 103)");
$pdo->exec("INSERT INTO deposit_milestones (id, deposit_id, milestone_name, expected_amount, status) VALUES (802, 702, 'Đợt 1', 15000000, 'pending')");
$GLOBALS['__test_body'] = ['actual_amount' => -100];
$resNegMile = invokeController(fn() => $depCtrl->approveMilestone($authAcc1, 702, 802));
assertCheck($resNegMile['code'] === 422, 'DepositController::approveMilestone rejects negative actual_amount with HTTP 422');

$pdo->exec("UPDATE deposits SET deleted_at = CURRENT_TIMESTAMP WHERE id = 702");
$GLOBALS['__test_body'] = [];
$resSoftDelDep = invokeController(fn() => $depCtrl->confirmPayment($authAcc1, 702));
assertCheck($resSoftDelDep['code'] === 404, 'DepositController::confirmPayment blocks confirming soft-deleted deposit (HTTP 404)');

$pdo->exec("INSERT INTO cooperation_slips (id, contact_id, shares_json, status, created_by) VALUES (902, 1001, '{\"103\":100}', 'pending_signatures', 103)");
$GLOBALS['__test_body'] = ['reason' => 'Cần điều chỉnh tỷ lệ'];
$resCoopReject = invokeController(fn() => $coopCtrl->rejectSlip($authDirector1, 902));
assertCheck($resCoopReject['code'] === 200, 'CooperationController::rejectSlip succeeds cleanly on SQLite without FOR UPDATE crash');
$resCoopRejectAgain = invokeController(fn() => $coopCtrl->rejectSlip($authDirector1, 902));
assertCheck($resCoopRejectAgain['code'] === 400, 'CooperationController::rejectSlip returns HTTP 400 (not 500) on already-rejected slip');

$soCtrl = new SalesOrderController($pdo);
$pdo->exec("INSERT INTO sales_orders (id, tenant_id, so_number, created_by, total, status, deleted_at) VALUES (301, 1, 'SO-301', 103, 5000000, 'pending', CURRENT_TIMESTAMP)");
$resSoftDelSo = invokeController(fn() => $soCtrl->approve($authDirector1, 301));
assertCheck($resSoftDelSo['code'] === 404, 'SalesOrderController::approve blocks approving soft-deleted sales order (HTTP 404)');

$pdo->exec("INSERT INTO hrm_leave_requests (id, user_id, leave_type, start_date, end_date, total_days, status, approver_id, approver_id_2, status_level_1, status_level_2) VALUES (603, 103, 'annual', '2026-12-05', '2026-12-06', 2.0, 'pending', 102, 101, 'pending', 'pending')");
$GLOBALS['__test_body'] = ['id' => 603, 'status' => 'bogus_status'];
$resBogusLeave = invokeController(fn() => $hrmCtrl->approveLeave($authMgrA, 603));
$usedAfterBogus = (float)$pdo->query("SELECT annual_leave_used FROM hrm_profiles WHERE user_id = 103")->fetchColumn();
assertCheck($resBogusLeave['code'] === 400 && abs($usedAfterBogus - 4.0) < 0.001, 'HRMController::approveLeave rejects invalid status string with HTTP 400 and zero leave deduction');

$GLOBALS['__test_body'] = ['id' => 603, 'status' => 'approved'];
$resLeave603Lvl1 = invokeController(fn() => $hrmCtrl->approveLeave($authMgrA, 603));
$resLeave603DupLvl1 = invokeController(fn() => $hrmCtrl->approveLeave($authMgrA, 603));
assertCheck($resLeave603Lvl1['code'] === 200 && $resLeave603DupLvl1['code'] === 422, 'HRMController::approveLeave blocks duplicate Level-1 approval while awaiting Level-2 (HTTP 422)');

echo "----------------------------------------------------------------------\n";
echo "  TOTAL ASSERTIONS: " . ($passed + $failed) . " | PASSED: {$passed} | FAILED: {$failed}\n";
echo "======================================================================\n";
exit($failed > 0 ? 1 : 0);
