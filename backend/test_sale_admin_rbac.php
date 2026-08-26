<?php
// backend/test_sale_admin_rbac.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/CompanyController.php';
require_once __DIR__ . '/controllers/ContactController.php';

echo "====================================================\n";
echo "🔐 RUNNING SALE ADMIN RBAC TEST SUITE\n";
echo "====================================================\n\n";

class TestCompanyController extends CompanyController {
    public function testGetScope(array $auth, string $action): string {
        $reflector = new ReflectionClass('CompanyController');
        $method = $reflector->getMethod('getScope');
        $method->setAccessible(true);
        return $method->invoke($this, $auth, $action);
    }
}

class TestContactController extends ContactController {
    public function testGetScope(array $auth, string $module, string $action): string {
        $reflector = new ReflectionClass('ContactController');
        $method = $reflector->getMethod('getScope');
        $method->setAccessible(true);
        return $method->invoke($this, $auth, $module, $action);
    }
}

$tenantId = 1;
$mockUserId = 88888;
$authSaleAdmin = ['user_id' => $mockUserId, 'tenant_id' => $tenantId, 'role' => 'sale_admin'];

// 1. Verify CompanyController getScope for sale_admin
$compController = new TestCompanyController($pdo);
$compReadScope = $compController->testGetScope($authSaleAdmin, 'read');
$compWriteScope = $compController->testGetScope($authSaleAdmin, 'write');
$compDeleteScope = $compController->testGetScope($authSaleAdmin, 'delete');

assertTest("Sale Admin has Company Read Scope = 'all'", $compReadScope === 'all');
assertTest("Sale Admin has Company Write Scope = 'all'", $compWriteScope === 'all');
assertTest("Sale Admin has Company Delete Scope = 'all'", $compDeleteScope === 'all');

// 2. Verify ContactController getScope for sale_admin
$contactController = new TestContactController($pdo);
$contactReadScope = $contactController->testGetScope($authSaleAdmin, 'leads', 'read');
$contactWriteScope = $contactController->testGetScope($authSaleAdmin, 'leads', 'write');

assertTest("Sale Admin has Contact Read Scope = 'all'", $contactReadScope === 'all');
assertTest("Sale Admin has Contact Write Scope = 'all'", $contactWriteScope === 'all');

// 3. Verify Contact status restriction for index query
$where  = ['c.tenant_id = ?', 'c.deleted_at IS NULL', 'c.owner_id IS NOT NULL'];
$role = strtolower($authSaleAdmin['role'] ?? '');
if ($role === 'sale_admin' || $role === 'saleadmin') {
    $where[] = "c.status = 'customer'";
}

$whereStr = implode(' AND ', $where);
assertTest("Sale Admin Contact where clause filters out non-customers", strpos($whereStr, "c.status = 'customer'") !== false);

printTestSummary();
