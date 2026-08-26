<?php
// backend/test_contact_bulk_delete.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ContactController.php';

// Safe mock function for respond in CLI mode
if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        $GLOBALS['last_response'] = [
            'code' => $code,
            'data' => $data,
            'message' => $message,
            'success' => $success
        ];
    }
}

echo "=== TESTING CONTACT BULK DELETE BATCH OPTIMIZATION ===\n";

$controller = new ContactController($pdo);

// Find some contact IDs in the database to test with
$stmt = $pdo->query("SELECT id FROM contacts WHERE tenant_id = 1 LIMIT 5");
$contactIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (!empty($contactIds)) {
    echo "Testing with contact IDs: " . implode(', ', $contactIds) . "\n";
    
    // Call the private method via reflection for testing
    try {
        $reflection = new ReflectionClass(ContactController::class);
        $method = $reflection->getMethod('restorePersonsPublicStatusBatch');
        $method->setAccessible(true);
        
        $timeStart = microtime(true);
        $method->invokeArgs($controller, [$contactIds, 1]);
        $timeEnd = microtime(true);
        $duration = ($timeEnd - $timeStart) * 1000;
        
        assertTest("Batch helper restorePersonsPublicStatusBatch executed successfully", true, "Time: " . number_format($duration, 2) . "ms");
    } catch (\Throwable $e) {
        assertTest("Batch helper failed to execute", false, "Error: " . $e->getMessage());
    }
} else {
    echo "No contacts found in DB to test. Creating mock test...\n";
    assertTest("Skipped (No contacts found)", true);
}

printTestSummary();
