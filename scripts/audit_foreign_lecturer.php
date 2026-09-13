<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();

echo "=== CHI TIET CAC RECORD GIANG VIEN NUOC NGOAI (NN) ===\n";
$stmt = $db->query("
    SELECT id, title, amount, category, date, created_at, status 
    FROM expenses 
    WHERE (
        title LIKE '%giảng viên nước ngoài%' 
        OR title LIKE '%giang vien nuoc ngoai%'
        OR title LIKE '%giảng viên nn%'
        OR title LIKE '%giang vien nn%'
        OR notes LIKE '%giảng viên nước ngoài%'
        OR notes LIKE '%giang vien nuoc ngoai%'
        OR notes LIKE '%giảng viên nn%'
        OR notes LIKE '%giang vien nn%'
        OR items LIKE '%giảng viên nước ngoài%'
        OR items LIKE '%giang vien nuoc ngoai%'
        OR items LIKE '%giảng viên nn%'
        OR items LIKE '%giang vien nn%'
    )
    ORDER BY id ASC
");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Tong so ban ghi: " . count($rows) . "\n\n";
foreach ($rows as $r) {
    echo "ID #{$r['id']} | Amount: {$r['amount']} | Date: {$r['date']} | Status: {$r['status']}\n";
    echo "  Title: {$r['title']}\n";
}
