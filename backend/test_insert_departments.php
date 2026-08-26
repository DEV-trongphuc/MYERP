<?php
// backend/test_insert_departments.php
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

echo "=== INSERTING DEPARTMENTS (TEAMS) ===\n\n";

$departments = [
    [
        'name' => 'Hành chính - Nhân sự',
        'leader_id' => 100065, // Nguyễn Thị Duy Phương
        'description' => 'Phòng Hành chính - Nhân sự'
    ],
    [
        'name' => 'Kế toán',
        'leader_id' => 100064, // Nguyễn Thu Thảo
        'description' => 'Phòng Kế toán'
    ],
    [
        'name' => 'Marketing',
        'leader_id' => 100009, // Để trống -> để tạm Admin phụ trách
        'description' => 'Phòng Marketing'
    ],
    [
        'name' => 'Tư vấn tuyển sinh',
        'leader_id' => 100062, // Mai Thị Nữ
        'description' => 'Phòng Tư vấn tuyển sinh'
    ],
    [
        'name' => 'Học vụ - học thuật',
        'leader_id' => 100009, // Để trống -> để tạm Admin phụ trách
        'description' => 'Phòng Học vụ - học thuật'
    ]
];

foreach ($departments as $dept) {
    // Check if team already exists
    $stmt = $conn->prepare("SELECT id FROM teams WHERE name = ? LIMIT 1");
    $stmt->bind_param("s", $dept['name']);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($res) {
        // Update existing team
        $stmtUpdate = $conn->prepare("UPDATE teams SET leader_id = ?, description = ? WHERE id = ?");
        $stmtUpdate->bind_param("isi", $dept['leader_id'], $dept['description'], $res['id']);
        $stmtUpdate->execute();
        $stmtUpdate->close();
        echo "Updated department: {$dept['name']} (ID: {$res['id']}) with leader ID: {$dept['leader_id']}\n";
    } else {
        // Insert new team
        $tenantId = 1;
        $stmtInsert = $conn->prepare("INSERT INTO teams (tenant_id, name, leader_id, description) VALUES (?, ?, ?, ?)");
        $stmtInsert->bind_param("isis", $tenantId, $dept['name'], $dept['leader_id'], $dept['description']);
        $stmtInsert->execute();
        $newId = $stmtInsert->insert_id;
        $stmtInsert->close();
        echo "Inserted new department: {$dept['name']} (New ID: {$newId}) with leader ID: {$dept['leader_id']}\n";
    }
}

echo "\n--- CURRENT DEPARTMENTS IN DATABASE ---\n";
$resTeams = $conn->query("SELECT t.id, t.name, t.leader_id, u.full_name as leader_name FROM teams t LEFT JOIN users u ON t.leader_id = u.id");
while ($row = $resTeams->fetch_assoc()) {
    echo "ID: {$row['id']} | Name: {$row['name']} | Leader: {$row['leader_name']} (ID: {$row['leader_id']})\n";
}

echo "\n";
printTestSummary();
