<?php
/**
 * Adversarial PoC: Verify backward-compatibility breakage in links_qr.php
 */

// Simulate GET request to links_qr.php with action=stats
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = 'stats';
$_GET['id'] = 'lnk_test123';

// Mock session/auth if needed
$_SESSION['user_id'] = 1;
$_SESSION['workspace_id'] = 1;

ob_start();
try {
    include __DIR__ . '/../../backend/automation/links_qr.php';
} catch (\Throwable $e) {
    echo "Uncaught exception: " . $e->getMessage() . "\n";
}
$output = ob_get_clean();

echo "RESPONSE FOR action=stats:\n";
echo $output . "\n";

$json = json_decode($output, true);
if (isset($json['success']) && $json['success'] === false && ($json['message'] ?? '') === 'Action not handled') {
    echo "\n>>> EMPIRICALLY CONFIRMED BUG: links_qr.php returned 'Action not handled' for action=stats! <<<\n";
    exit(1);
} else {
    echo "\nResponse was not 'Action not handled'\n";
    exit(0);
}
