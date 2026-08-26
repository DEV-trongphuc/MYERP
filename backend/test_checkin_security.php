<?php
// backend/test_checkin_security.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/CheckInController.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

echo "=== STARTING CHECK-IN & BULK REQUEST TENANT ISOLATION TESTS ===\n\n";

global $mockBody;
$mockBody = [];
if (!function_exists('getBody')) {
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

if (!class_exists('RespondException')) {
    class RespondException extends Exception {
        public int $statusCode;
        public $responseData;
        public string $responseMsg;
        public bool $isSuccess;
        public function __construct(int $code, $data, string $msg, bool $success) {
            parent::__construct($msg, $code);
            $this->statusCode = $code;
            $this->responseData = $data;
            $this->responseMsg = $msg;
            $this->isSuccess = $success;
        }
    }
}

$lastResponse = null;
if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        global $lastResponse;
        $lastResponse = [
            'code' => $code,
            'data' => $data,
            'message' => $message,
            'success' => $success
        ];
        throw new RespondException($code, $data, $message, $success);
    }
}

if (!function_exists('requireRole')) {
    function requireRole(array $payload, array $roles): void {
        $userRole = strtolower($payload['role'] ?? '');
        $allowed = array_map('strtolower', $roles);
        if (!in_array($userRole, $allowed, true)) {
            respond(403, null, 'Bạn không có quyền thực hiện hành động này', false);
        }
    }
}

if (!function_exists('logActivity')) {
    function logActivity($db, $tid, $uid, string $action, ?string $resource = null, $resourceId = null, ?string $data = null): void {
        // Mock log activity in test harness
    }
}

$db = $pdo; // from test_bootstrap.php

// Helper to assert test case results
function assertTest(string $name, bool $expr, string $errorMsg = '') {
    if ($expr) {
        echo "✅ [PASS] $name\n";
    } else {
        echo "❌ [FAIL] $name" . ($errorMsg ? ": $errorMsg" : "") . "\n";
        exit(1);
    }
}

try {
    // Setup test users for Tenant A (1) and Tenant B (9999)
    $db->exec("DELETE FROM users WHERE id IN (88881, 88882)");
    $db->exec("DELETE FROM tenants WHERE id = 9999");
    $db->exec("DELETE FROM attendance_bulk_requests WHERE id IN (888801, 888802)");

    $db->prepare("
        INSERT INTO tenants (id, name, slug) 
        VALUES (9999, 'Test Staging Tenant B', 'test-staging-tenant-b')
    ")->execute();

    $db->prepare("
        INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) 
        VALUES (88881, 1, 'tenant_a_user@test.com', 'hash', 'Tenant A User', 'sales')
    ")->execute();

    $db->prepare("
        INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) 
        VALUES (88882, 9999, 'tenant_b_user@test.com', 'hash', 'Tenant B User', 'sales')
    ")->execute();

    $authA = [
        'user_id' => 88881,
        'tenant_id' => 1,
        'role' => 'sales',
        'full_name' => 'Tenant A User'
    ];

    $authB = [
        'user_id' => 88882,
        'tenant_id' => 9999,
        'role' => 'sales',
        'full_name' => 'Tenant B User'
    ];

    $authAdminB = [
        'user_id' => 88883,
        'tenant_id' => 9999,
        'role' => 'admin',
        'full_name' => 'Tenant B Admin'
    ];

    $ctrl = new CheckInController($db);

    // Create a bulk request for Tenant A
    $db->prepare("
        INSERT INTO attendance_bulk_requests (id, user_id, month_period, status)
        VALUES (888801, 88881, '2026-08', 'pending_approval')
    ")->execute();

    // Create a bulk request for Tenant B
    $db->prepare("
        INSERT INTO attendance_bulk_requests (id, user_id, month_period, status)
        VALUES (888802, 88882, '2026-08', 'pending_approval')
    ")->execute();


    // --- TEST CASE 1: listBulkRequests Isolation ---
    try {
        $ctrl->listBulkRequests($authB);
    } catch (RespondException $e) {
        $data = $e->responseData;
        $foundA = false;
        $foundB = false;
        foreach ($data as $r) {
            if ((int)$r['id'] === 888801) $foundA = true;
            if ((int)$r['id'] === 888802) $foundB = true;
        }
        assertTest("Tenant B list does not contain Tenant A request", !$foundA);
        assertTest("Tenant B list contains Tenant B request", $foundB);
    }


    // --- TEST CASE 2: getBulkRequestDetail Isolation ---
    // Fetch Tenant B's own request (should succeed)
    try {
        $ctrl->getBulkRequestDetail($authB, 888802);
        assertTest("Tenant B can fetch own request details", true);
    } catch (RespondException $e) {
        assertTest("Tenant B can fetch own request details", $e->statusCode === 200);
    }

    // Fetch Tenant A's request using Tenant B credentials (should return 404 since it's filtered by tenant)
    try {
        $ctrl->getBulkRequestDetail($authB, 888801);
        assertTest("Tenant B is blocked from fetching Tenant A details", false);
    } catch (RespondException $e) {
        assertTest("Tenant B is blocked from fetching Tenant A details (Status code " . $e->statusCode . ")", $e->statusCode === 404);
    }


    // --- TEST CASE 3: approveBulkRequest Isolation ---
    // Admin B attempts to approve Tenant A's request (should return 403 Forbidden)
    $mockBody = ['status' => 'approved', 'admin_note' => 'Approve by cross-tenant admin'];
    try {
        $ctrl->approveBulkRequest($authAdminB, 888801);
        assertTest("Tenant B Admin is blocked from approving Tenant A requests", false);
    } catch (RespondException $e) {
        assertTest("Tenant B Admin is blocked from approving Tenant A requests (Status code " . $e->statusCode . ")", $e->statusCode === 403);
    }

    // Clean up
    $db->exec("DELETE FROM users WHERE id IN (88881, 88882)");
    $db->exec("DELETE FROM attendance_bulk_requests WHERE id IN (888801, 888802)");
    $db->exec("DELETE FROM tenants WHERE id = 9999");

    echo "\n📊 ALL CHECK-IN SECURITY TEST CASES PASSED SUCCESSFULLY!\n";

} catch (\Throwable $e) {
    echo "❌ FATAL TEST SUITE FAILURE: " . $e->getMessage() . "\n";
    // Clean up just in case
    try {
        $db->exec("DELETE FROM users WHERE id IN (88881, 88882)");
        $db->exec("DELETE FROM attendance_bulk_requests WHERE id IN (888801, 888802)");
        $db->exec("DELETE FROM tenants WHERE id = 9999");
    } catch (\Throwable $ex) {}
    exit(1);
}
