<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();

echo "=== USER SEARCH FOR THU THAO ===\n";
$users = $db->query("SELECT id, tenant_id, full_name, email, role FROM users WHERE full_name LIKE '%Thu Thảo%' OR full_name LIKE '%Thao%' OR email LIKE '%thao%'")->fetchAll();
print_r($users);

echo "\n=== EXPENSE #13 ===\n";
$exp = $db->query("SELECT id, tenant_id, title, amount, image_url, refund_image_url, related_user_ids, created_by, approver_id, status FROM expenses WHERE id=13")->fetch();
print_r($exp);

if ($exp && !empty($exp['image_url'])) {
    $rawPath = $exp['image_url'];
    echo "Raw image_url in DB: " . $rawPath . "\n";
    $localPath1 = __DIR__ . '/' . ltrim($rawPath, '/');
    $localPath2 = __DIR__ . '/' . preg_replace('#^/?(backend/)?#', '', $rawPath);
    echo "Path 1 exists? " . (file_exists($localPath1) ? 'YES' : 'NO') . " ($localPath1)\n";
    echo "Path 2 exists? " . (file_exists($localPath2) ? 'YES' : 'NO') . " ($localPath2)\n";
}

echo "\n=== EXISTING RELATED_USER_IDS SAMPLES ===\n";
$samples = $db->query("SELECT id, related_user_ids FROM expenses WHERE related_user_ids IS NOT NULL AND related_user_ids != '' LIMIT 5")->fetchAll();
print_r($samples);
