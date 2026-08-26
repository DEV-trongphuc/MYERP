<?php
// backend/test_extended_rbac_suite.php
// Extended RBAC & Database verification suite for new roles (HR, Accountant, Marketing)
// Initiates the testing harness bootstrap

if (!defined('DIAG_TOKEN')) define('DIAG_TOKEN', true); // Allow bootstrap bypass
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/permission_matrix_helper.php';

echo "====================================================\n";
echo "🔐 BAT DAU KIEM THU PHAN QUYEN MO RONG (EXTENDED RBAC SUITE)\n";
echo "====================================================\n\n";

// 1. Kiểm tra cấu trúc CSDL thực tế (Staging Database Column Enum)
$roleEnumResult = $conn->query("DESCRIBE users");
$roleEnumVal = '';
if ($roleEnumResult) {
    while ($row = $roleEnumResult->fetch_assoc()) {
        if ($row['Field'] === 'role') {
            $roleEnumVal = $row['Type'];
            break;
        }
    }
}

$hasHrRole = (strpos($roleEnumVal, "'hr'") !== false);
$hasAccountantRole = (strpos($roleEnumVal, "'accountant'") !== false);
$hasMarketingRole = (strpos($roleEnumVal, "'marketing'") !== false);

assertTest("CSDL: Cấu hình enum role chứa vai trò 'hr'", $hasHrRole, "Enum value: $roleEnumVal");
assertTest("CSDL: Cấu hình enum role chứa vai trò 'accountant'", $hasAccountantRole, "Enum value: $roleEnumVal");
assertTest("CSDL: Cấu hình enum role chứa vai trò 'marketing'", $hasMarketingRole, "Enum value: $roleEnumVal");

// 2. Kiểm tra sự tồn tại của 3 tài khoản thử nghiệm
$testUsersRbac = [
    100013 => ['email' => 'hr@Ideas.test', 'username' => 'hr_test', 'full_name' => 'HR Tester', 'role' => 'hr'],
    100014 => ['email' => 'accountant@Ideas.test', 'username' => 'accountant_test', 'full_name' => 'Accountant Tester', 'role' => 'accountant'],
    100015 => ['email' => 'marketing@Ideas.test', 'username' => 'marketing_test', 'full_name' => 'Marketing Tester', 'role' => 'marketing']
];

$GLOBALS['rbac_inserted_uids'] = [];

foreach ($testUsersRbac as $uid => $u) {
    $stmtCheck = $conn->prepare("SELECT id FROM users WHERE id = ?");
    $stmtCheck->bind_param("i", $uid);
    $stmtCheck->execute();
    if ($stmtCheck->get_result()->num_rows === 0) {
        $stmtIns = $conn->prepare("INSERT INTO users (id, email, username, full_name, role, tenant_id) VALUES (?, ?, ?, ?, ?, 1)");
        $stmtIns->bind_param("issss", $uid, $u['email'], $u['username'], $u['full_name'], $u['role']);
        if ($stmtIns->execute()) {
            $GLOBALS['rbac_inserted_uids'][] = $uid;
        }
    }
}

assertDbField($conn, 'users', 'role', "email = 'hr@Ideas.test'", 'hr', "Tài khoản hr@Ideas.test có role 'hr'");
assertDbField($conn, 'users', 'role', "email = 'accountant@Ideas.test'", 'accountant', "Tài khoản accountant@Ideas.test có role 'accountant'");
assertDbField($conn, 'users', 'role', "email = 'marketing@Ideas.test'", 'marketing', "Tài khoản marketing@Ideas.test có role 'marketing'");

// 3. Kiểm tra logic phân quyền (Permission Matrix Helper Scopes)
$hrUser = ['user_id' => 100013, 'tenant_id' => 1, 'role' => 'hr'];
$acctUser = ['user_id' => 100014, 'tenant_id' => 1, 'role' => 'accountant'];
$mktUser = ['user_id' => 100015, 'tenant_id' => 1, 'role' => 'marketing'];

// Test HR Permission Scopes
assertTest("HR Scope: Quản lý nhân sự (hrm) -> 'all'", getModulePermissionScope($hrUser, 'hrm', 'read') === 'all');
assertTest("HR Scope: Quản lý chấm công (attendance) -> 'all'", getModulePermissionScope($hrUser, 'attendance', 'read') === 'all');
assertTest("HR Scope: Cài đặt hệ thống (settings) -> 'none'", getModulePermissionScope($hrUser, 'settings', 'write') === 'none');
assertTest("HR Scope: Lead/Kinh doanh mặc định -> 'own'", getModulePermissionScope($hrUser, 'deals', 'read') === 'own');

// Test Accountant Permission Scopes
assertTest("Accountant Scope: Đơn hàng & cọc (deposits) -> 'all'", getModulePermissionScope($acctUser, 'deposits', 'read') === 'all');
assertTest("Accountant Scope: Chi phí (expenses) -> 'all'", getModulePermissionScope($acctUser, 'expenses', 'read') === 'all');
assertTest("Accountant Scope: Hóa đơn (invoices) -> 'all'", getModulePermissionScope($acctUser, 'invoices', 'read') === 'all');
assertTest("Accountant Scope: Cài đặt hệ thống (settings) -> 'none'", getModulePermissionScope($acctUser, 'settings', 'write') === 'none');

// Test Marketing Permission Scopes
assertTest("Marketing Scope: Lead data (leads) -> 'all'", getModulePermissionScope($mktUser, 'leads', 'read') === 'all');
assertTest("Marketing Scope: Chiến dịch (campaigns) -> 'all'", getModulePermissionScope($mktUser, 'campaigns', 'read') === 'all');
assertTest("Marketing Scope: Dự án (projects) -> 'all'", getModulePermissionScope($mktUser, 'projects', 'read') === 'all');
assertTest("Marketing Scope: Nhân viên & Phòng ban (users) -> 'all'", getModulePermissionScope($mktUser, 'users', 'read') === 'all');
assertTest("Marketing Scope: Giao dịch / Pipeline (deals) -> 'all'", getModulePermissionScope($mktUser, 'deals', 'read') === 'all');
assertTest("Marketing Scope: Ticket data lỗi (tickets) -> 'all'", getModulePermissionScope($mktUser, 'tickets', 'read') === 'all');
assertTest("Marketing Scope: AI Pre-screener (gatekeeper) -> 'all'", getModulePermissionScope($mktUser, 'gatekeeper', 'read') === 'all');
assertTest("Marketing Scope: Học viên (students) -> 'all'", getModulePermissionScope($mktUser, 'students', 'read') === 'all');
assertTest("Marketing Scope: Tiềm năng (contacts) -> 'all'", getModulePermissionScope($mktUser, 'contacts', 'read') === 'all');
assertTest("Marketing Scope: Đối tác (companies) -> 'all'", getModulePermissionScope($mktUser, 'companies', 'read') === 'all');
assertTest("Marketing Scope: Cài đặt hệ thống (settings) -> 'none'", getModulePermissionScope($mktUser, 'settings', 'write') === 'none');

// Dọn dẹp dữ liệu test
if (!empty($GLOBALS['rbac_inserted_uids'])) {
    $inClause = implode(',', array_map('intval', $GLOBALS['rbac_inserted_uids']));
    $conn->query("DELETE FROM users WHERE id IN ($inClause)");
}

printTestSummary();
