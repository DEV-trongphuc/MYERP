<?php
// backend/test_check_lecturers.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== CHECKING LECTURERS IN DATABASE ===\n\n";

echo "--- companies table ---\n";
$resComp = $conn->query("SELECT id, name FROM companies");
while ($row = $resComp->fetch_assoc()) {
    echo "ID: {$row['id']} | Name: {$row['name']}\n";
}

echo "\n--- users table ---\n";
$resUsers = $conn->query("SELECT id, username, full_name FROM users");
while ($row = $resUsers->fetch_assoc()) {
    echo "ID: {$row['id']} | Username: {$row['username']} | Full Name: {$row['full_name']}\n";
}
