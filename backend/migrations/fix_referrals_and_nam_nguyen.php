<?php
// backend/migrations/fix_referrals_and_nam_nguyen.php
require_once __DIR__ . '/../db_connect.php';

echo "=== FIXING REFERRAL LEADS AND NAM NGUYEN ===\n";

// 1. Clean up placeholder emails across leads, persons, contacts
echo "1. Cleaning up placeholder emails...\n";
$placeholders = ["'không'", "'khong'", "'k'", "'ko'", "'none'", "'null'", "'na'", "'n/a'"];
$phStr = implode(",", $placeholders);

$conn->query("UPDATE leads SET email = NULL WHERE email IN ($phStr)");
$conn->query("UPDATE leads SET phone = NULL WHERE phone IN ($phStr)");
$conn->query("UPDATE persons SET email = NULL WHERE email IN ($phStr)");
$conn->query("UPDATE persons SET phone = NULL WHERE phone IN ($phStr)");
$conn->query("UPDATE contacts SET email = NULL WHERE email IN ($phStr)");
$conn->query("UPDATE contacts SET phone = NULL WHERE phone IN ($phStr)");

// 2. Fix Soan Nguyen (person 90, contact 1024691, lead 1000036)
echo "2. Fixing Soạn Nguyễn (person 90, contact 1024691, lead 1000036)...\n";
$conn->query("UPDATE leads SET person_id = 90, email = NULL WHERE id = 1000036");
$conn->query("UPDATE persons SET full_name = 'Soạn Nguyễn', email = NULL, phone = NULL WHERE id = 90");
$soanNote = "Anh Phạm Phi Vũ cựu học viên DBA giới thiệu";
$stmtSoan = $conn->prepare("UPDATE contacts SET full_name = 'Soạn Nguyễn', email = NULL, phone = NULL, notes = ? WHERE id = 1024691");
$stmtSoan->bind_param("s", $soanNote);
$stmtSoan->execute();
$stmtSoan->close();

// 3. Fix Nam Nguyen (person 91, lead 1000037)
echo "3. Fixing Nam Nguyen (person 91, lead 1000037)...\n";
$conn->query("UPDATE leads SET person_id = 91, email = NULL WHERE id = 1000037");
$conn->query("UPDATE persons SET full_name = 'Nam Nguyen', email = NULL, phone = NULL WHERE id = 91");

// Check if contact for person 91 exists
$chk91 = $conn->query("SELECT id FROM contacts WHERE person_id = 91 AND deleted_at IS NULL LIMIT 1");
if ($chk91 && $row91 = $chk91->fetch_assoc()) {
    $contact91Id = $row91['id'];
    echo "Contact for person 91 already exists: $contact91Id\n";
    $conn->query("UPDATE contacts SET full_name = 'Nam Nguyen', email = NULL, phone = NULL, owner_id = 100059 WHERE id = $contact91Id");
} else {
    $stmtC91 = $conn->prepare("
        INSERT INTO contacts (tenant_id, person_id, owner_id, created_by, full_name, email, phone, source, status, pipeline_status, stage_id, notes, customer_type, temperature, suggested_temperature, created_at)
        VALUES (1, 91, 100059, 100059, 'Nam Nguyen', NULL, NULL, 'gioi_thieu', 'lead', 'new_lead', 31, ?, 'MBA', 'neutral', 'neutral', '2026-09-08 11:25:19')
    ");
    $namNote = "Anh Phạm Phi Vũ cựu học viên DBA giới thiệu";
    $stmtC91->bind_param("s", $namNote);
    $stmtC91->execute();
    $contact91Id = $stmtC91->insert_id;
    $stmtC91->close();
    echo "Created contact for person 91 (Nam Nguyen): $contact91Id\n";
}

// 4. Fix Nam Nguyễn (person 92, lead 1000038)
echo "4. Fixing Nam Nguyễn (person 92, lead 1000038)...\n";
$conn->query("UPDATE leads SET person_id = 92, email = NULL WHERE id = 1000038");
$conn->query("UPDATE persons SET full_name = 'Nam Nguyễn', email = NULL, phone = NULL WHERE id = 92");

// Check if contact for person 92 exists
$chk92 = $conn->query("SELECT id FROM contacts WHERE person_id = 92 AND deleted_at IS NULL LIMIT 1");
if ($chk92 && $row92 = $chk92->fetch_assoc()) {
    $contact92Id = $row92['id'];
    echo "Contact for person 92 already exists: $contact92Id\n";
    $conn->query("UPDATE contacts SET full_name = 'Nam Nguyễn', email = NULL, phone = NULL, owner_id = 100059 WHERE id = $contact92Id");
} else {
    $stmtC92 = $conn->prepare("
        INSERT INTO contacts (tenant_id, person_id, owner_id, created_by, full_name, email, phone, source, status, pipeline_status, stage_id, notes, customer_type, temperature, suggested_temperature, created_at)
        VALUES (1, 92, 100059, 100059, 'Nam Nguyễn', NULL, NULL, 'ca_nhan', 'lead', 'new_lead', 31, ?, 'MBA', 'neutral', 'neutral', '2026-09-08 14:12:24')
    ");
    $namNguyenNote = "Anh Phạm Phi Vũ cựu học viên DBA giới thiệu";
    $stmtC92->bind_param("s", $namNguyenNote);
    $stmtC92->execute();
    $contact92Id = $stmtC92->insert_id;
    $stmtC92->close();
    echo "Created contact for person 92 (Nam Nguyễn): $contact92Id\n";
}

echo "=== MIGRATION COMPLETED SUCCESSFULLY ===\n";
