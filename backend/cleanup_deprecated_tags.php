<?php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== DỌN DẸP TAGS CŨ (NEW, UNQUALIFIED, NEEDED, CONSIDERING, BAD TIMING, QUALIFIED) ===\n";

$deprecatedTags = ['new', 'unqualified', 'needed', 'considering', 'badtiming', 'bad timing', 'bad_timing', 'qualified'];

// 1. Xóa trong bảng tags
$inPlaceholders = implode(',', array_fill(0, count($deprecatedTags), '?'));
$stmt = $pdo->prepare("DELETE FROM tags WHERE LOWER(TRIM(name)) IN ($inPlaceholders)");
$stmt->execute($deprecatedTags);
$deletedTagsCount = $stmt->rowCount();
echo "-> Đã xóa $deletedTagsCount thẻ tag trong bảng `tags`.\n";

// 2. Dọn dẹp trong contacts.tags
$stmtContacts = $pdo->query("SELECT id, tags FROM contacts WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'");
$updatedContacts = 0;

$updateStmt = $pdo->prepare("UPDATE contacts SET tags = ? WHERE id = ?");

while ($row = $stmtContacts->fetch(PDO::FETCH_ASSOC)) {
    $cid = $row['id'];
    $rawTags = $row['tags'];
    
    $tags = json_decode($rawTags, true);
    $isJson = is_array($tags);
    if (!$isJson) {
        $tags = array_map('trim', explode(',', $rawTags));
    }
    
    $newTags = [];
    $modified = false;
    foreach ($tags as $t) {
        $cleaned = trim((string)$t);
        if ($cleaned === '') continue;
        if (in_array(strtolower($cleaned), $deprecatedTags, true)) {
            $modified = true;
            continue;
        }
        $newTags[] = $cleaned;
    }
    
    if ($modified) {
        $finalVal = $isJson ? json_encode(array_values($newTags), JSON_UNESCAPED_UNICODE) : implode(', ', $newTags);
        if (empty($newTags)) {
            $finalVal = $isJson ? '[]' : '';
        }
        $updateStmt->execute([$finalVal, $cid]);
        $updatedContacts++;
    }
}

echo "-> Đã loại bỏ các tag cũ trong $updatedContacts khách hàng (contacts).\n";
echo "=== HOÀN TẤT DỌN DẸP TAGS ===\n";
