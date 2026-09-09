<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();

// Migrate EXP-13 to include Thu Thao (100064) as related user without notifications
$stmt = $db->prepare("UPDATE expenses SET related_user_ids = ? WHERE id = 13");
$stmt->execute(['[100064]']);

echo "=== MIGRATION RESULT FOR EXP-13 ===\n";
$res = $db->query("SELECT id, title, related_user_ids FROM expenses WHERE id = 13")->fetch();
print_r($res);
