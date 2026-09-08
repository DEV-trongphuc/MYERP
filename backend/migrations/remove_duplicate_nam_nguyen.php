<?php
// backend/migrations/remove_duplicate_nam_nguyen.php
require_once __DIR__ . '/../db_connect.php';

echo "=== REMOVING DUPLICATE NAM NGUYEN ===\n";

// 1. Check existing records
echo "1. Current records:\n";
$resC = $conn->query("SELECT id, person_id, owner_id, full_name FROM contacts WHERE id IN (1024692, 1024693)");
while ($r = $resC->fetch_assoc()) {
    echo "Contact: " . json_encode($r, JSON_UNESCAPED_UNICODE) . "\n";
}

// 2. Remove duplicate contact 1024693, lead 1000038, log 52757, person 92
echo "2. Deleting duplicate contact 1024693 and related records...\n";
$conn->query("DELETE FROM activities WHERE contact_id = 1024693 OR (related_type = 'contact' AND related_id = 1024693)");
$conn->query("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id = 1024693");
$conn->query("DELETE FROM deals WHERE contact_id = 1024693");
$conn->query("DELETE FROM distribution_logs WHERE lead_id = 1000038");
$conn->query("DELETE FROM data_reports WHERE lead_id = 1000038");
$conn->query("DELETE FROM leads WHERE id = 1000038");
$conn->query("DELETE FROM contacts WHERE id = 1024693");
$conn->query("DELETE FROM persons WHERE id = 92");

// 3. Ensure the kept record (Contact 1024692, Person 91, Lead 1000037) has standard Vietnamese accented name 'Nam Nguyễn'
echo "3. Updating kept record to standard name 'Nam Nguyễn'...\n";
$conn->query("UPDATE persons SET full_name = 'Nam Nguyễn' WHERE id = 91");
$conn->query("UPDATE contacts SET full_name = 'Nam Nguyễn' WHERE id = 1024692");
$conn->query("UPDATE leads SET name = 'Nam Nguyễn' WHERE id = 1000037");

// 4. Verify remaining records
echo "4. Verification:\n";
$resVerify = $conn->query("SELECT id, person_id, owner_id, full_name, notes, deleted_at FROM contacts WHERE person_id IN (90, 91, 92) OR full_name LIKE '%Nam Nguy%'");
while ($r = $resVerify->fetch_assoc()) {
    echo "Remaining Contact: " . json_encode($r, JSON_UNESCAPED_UNICODE) . "\n";
}

echo "=== FINISHED SUCCESSFULLY ===\n";
