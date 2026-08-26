<?php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ContactController.php';
require_once __DIR__ . '/controllers/DealController.php';

echo "=== Testing Marketing Access ===\n";
$mktAuth = [
    'user_id' => 100071,
    'tenant_id' => 1,
    'role' => 'marketing',
    'email' => 'duongtnt@ideas.edu.vn'
];

$contactCtrl = new ContactController($pdo);
$reflection = new ReflectionClass(ContactController::class);
$getScopeMethod = $reflection->getMethod('getScope');
$getScopeMethod->setAccessible(true);

$contactScope = $getScopeMethod->invoke($contactCtrl, $mktAuth, 'leads', 'read');
echo "ContactController leads.read scope: $contactScope\n";

$dealCtrl = new DealController($pdo);
$dealReflection = new ReflectionClass(DealController::class);
$dealGetScopeMethod = $dealReflection->getMethod('getScope');
$dealGetScopeMethod->setAccessible(true);

$dealScope = $dealGetScopeMethod->invoke($dealCtrl, $mktAuth, 'deals', 'read');
echo "DealController deals.read scope: $dealScope\n";

$_GET = [
    'page' => 1,
    'limit' => 10,
    'segment' => 'tiem_nang'
];

ob_start();
try {
    $contactCtrl->index($mktAuth);
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
}
$output = ob_get_clean();
echo "ContactController index output sample (first 300 chars):\n";
echo substr($output, 0, 300) . "\n";
$json = json_decode($output, true);
if ($json && isset($json['data'])) {
    echo "Total returned items: " . count($json['data']['items'] ?? []) . ", Total in DB: " . ($json['data']['total'] ?? 0) . "\n";
} else {
    echo "Output was not standard JSON or error occurred.\n";
}
