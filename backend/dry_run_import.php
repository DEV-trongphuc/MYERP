<?php
// backend/dry_run_import.php
require_once __DIR__ . '/test_bootstrap.php';

// Ensure output is UTF-8
header('Content-Type: text/plain; charset=utf-8');

echo "=== DRY RUN IMPORT & NORMALIZATION SUMMARY ===\n";

$jsonPath = __DIR__ . '/normalized_students.json';
if (!file_exists($jsonPath)) {
    echo "Error: normalized_students.json not found!\n";
    exit(1);
}

$students = json_decode(file_get_contents($jsonPath), true);
if (!is_array($students)) {
    echo "Error: Invalid JSON data!\n";
    exit(1);
}

echo "Loaded " . count($students) . " students from JSON.\n\n";

// 1. Fetch users mapping from database
$usersMap = [];
$resUsers = $conn->query("SELECT id, full_name, username FROM users");
while ($row = $resUsers->fetch_assoc()) {
    // Save mapping using both full_name and username
    if (!empty($row['full_name'])) {
        $usersMap[strtolower(trim($row['full_name']))] = (int)$row['id'];
    }
    if (!empty($row['username'])) {
        $usersMap[strtolower(trim($row['username']))] = (int)$row['id'];
    }
}

// Find specific user IDs (Phúc, Đan, Nhi, Nữ)
function findUserId($name, $usersMap) {
    $lowerName = strtolower(trim($name));
    
    // Exact match first
    if (isset($usersMap[$lowerName])) {
        return $usersMap[$lowerName];
    }
    
    // Partial match
    foreach ($usersMap as $fullName => $id) {
        if (strpos($fullName, $lowerName) !== false) {
            return $id;
        }
    }
    return null;
}

$owners = ['Phúc', 'Đan', 'Nhi', 'Nữ'];
$ownerIds = [];
foreach ($owners as $owner) {
    $id = findUserId($owner, $usersMap);
    $ownerIds[$owner] = $id;
    echo "Owner: " . str_pad($owner, 10) . " -> Database User ID: " . ($id !== null ? $id : "NOT FOUND (Will fallback)") . "\n";
}
echo "\n";

$stats = [
    'total' => 0,
    'new_insert' => 0,
    'update_existing' => 0,
    'by_school' => [],
    'by_owner' => []
];

// 2. Perform DB checks for each student
foreach ($students as $student) {
    $stats['total']++;
    
    $phone = $student['phone'];
    $email = $student['email'];
    $school = $student['school'] ?? 'UNKNOWN';
    $ownerAssigned = $student['owner_assigned'];
    
    if (!isset($stats['by_school'][$school])) {
        $stats['by_school'][$school] = 0;
    }
    $stats['by_school'][$school]++;
    
    if (!isset($stats['by_owner'][$ownerAssigned])) {
        $stats['by_owner'][$ownerAssigned] = 0;
    }
    $stats['by_owner'][$ownerAssigned]++;
    
    // Check if duplicate exists in database
    $exists = false;
    if (!empty($phone)) {
        $stmt = $pdo->prepare("SELECT id, full_name, email FROM contacts WHERE phone = ? OR mobile = ? LIMIT 1");
        $stmt->execute([$phone, $phone]);
        $existing = $stmt->fetch();
        if ($existing) {
            $exists = true;
        }
    }
    
    if (!$exists && !empty($email)) {
        $stmt = $pdo->prepare("SELECT id, full_name, email FROM contacts WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $existing = $stmt->fetch();
        if ($existing) {
            $exists = true;
        }
    }
    
    if ($exists) {
        $stats['update_existing']++;
    } else {
        $stats['new_insert']++;
    }
}

echo "=== SUMMARY STATS ===\n";
echo "Total Rows Processed: " . $stats['total'] . "\n";
echo "New Leads to Insert : " . $stats['new_insert'] . "\n";
echo "Leads to Update/Sync: " . $stats['update_existing'] . "\n\n";

echo "=== BY SCHOOL/PROGRAM ===\n";
foreach ($stats['by_school'] as $sch => $count) {
    echo " - " . str_pad($sch, 15) . ": " . $count . " rows\n";
}
echo "\n";

echo "=== BY ASSIGNED OWNER ===\n";
foreach ($stats['by_owner'] as $own => $count) {
    $idStr = $ownerIds[$own] !== null ? "(ID: {$ownerIds[$own]})" : "(No ID)";
    echo " - " . str_pad($own . " " . $idStr, 18) . ": " . $count . " rows\n";
}
echo "\n";

echo "Dry run completed successfully. No writes were made to the database.\n";
