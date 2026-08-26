<?php
// backend/test_cloud_files_link.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/CloudFileController.php';

// Mock getBody globally for the controller test
if (!function_exists('getBody')) {
    function getBody(): array {
        global $mockPayload;
        return $mockPayload ?? [];
    }
}

// Mock respond function if not defined, or override behaviors
if (!function_exists('respond')) {
    function respond(int $code, $data, string $message, bool $success = true): void {
        echo json_encode([
            'status' => $code,
            'success' => $success,
            'message' => $message,
            'data' => $data
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        // Throw an exception to stop script execution just like exit/respond would do,
        // so that we can catch it in our test assertions.
        throw new Exception("RESPOND_CALLED: " . $message);
    }
}

echo "=== SYSTEM AUDIT: GOOGLE DRIVE LINK STORAGE TEST SUITE ===\n";

// 1. Create a dummy contact to associate the file with
$userQuery = $conn->query("SELECT id, tenant_id FROM users LIMIT 1");
$userRow = $userQuery->fetch_assoc();
$userId = $userRow ? (int)$userRow['id'] : 1;
$tenantId = $userRow ? (int)$userRow['tenant_id'] : 1;

$conn->query("INSERT INTO contacts (tenant_id, owner_id, full_name, email, phone, pipeline_status) VALUES ($tenantId, $userId, 'Test Drive Contact', 'test_drive@example.com', '0999999999', 'lead')");
$contactId = $conn->insert_id;

assertTest("TC01: Created dummy contact for testing", $contactId > 0, "Contact ID: " . $contactId);

// Initialize controller
$controller = new CloudFileController($pdo);

// Prepare mock payload for Google Drive Link
$mockPayload = [
    'name' => 'Tài liệu Dự án Richland Drive',
    'link_url' => 'https://drive.google.com/drive/folders/123456abcdef',
    'is_link' => 1,
    'contact_id' => $contactId,
    'category' => 'Hồ sơ pháp lý',
    'visibility' => 'shared'
];

$auth = [
    'tenant_id' => $tenantId,
    'user_id' => $userId,
    'role' => 'admin'
];

// Test case 2: Save the Drive Link
try {
    echo "Attempting to store Google Drive link...\n";
    $controller->store($auth);
} catch (Exception $e) {
    assertTest("TC02: Called store and finished with respond", strpos($e->getMessage(), "RESPOND_") !== false);
}

// Test case 3: Verify link in Database
$stmt = $pdo->prepare("SELECT * FROM cloud_files WHERE contact_id = ? ORDER BY id DESC LIMIT 1");
$stmt->execute([$contactId]);
$inserted = $stmt->fetch();

assertTest("TC03: Google Drive Link record found in database", !empty($inserted));
if (!empty($inserted)) {
    assertTest("TC04: Verify file_path contains the correct URL", $inserted['file_path'] === $mockPayload['link_url']);
    assertTest("TC05: Verify mime_type is set to 'link'", $inserted['mime_type'] === 'link');
    assertTest("TC06: Verify category is set to 'Hồ sơ pháp lý'", $inserted['category'] === $mockPayload['category']);
    
    // Clean up
    $pdo->prepare("DELETE FROM cloud_files WHERE id = ?")->execute([$inserted['id']]);
    assertTest("TC07: Cleaned up inserted cloud file record", true);
}

// Clean up dummy contact
$conn->query("DELETE FROM contacts WHERE id = $contactId");
assertTest("TC08: Cleaned up dummy contact", true);

printTestSummary();
