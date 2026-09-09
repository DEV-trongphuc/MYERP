<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();

// 1. Update team_id for users based on role
$db->query("UPDATE users SET team_id = 4 WHERE (role IN ('sales', 'sale', 'sale_admin') OR id = 1004) AND (team_id IS NULL OR team_id = 0)");
$db->query("UPDATE users SET team_id = 3 WHERE role = 'marketing' AND (team_id IS NULL OR team_id = 0)");
$db->query("UPDATE users SET team_id = 5 WHERE role IN ('academic', 'hoc_vu') AND (team_id IS NULL OR team_id = 0)");
$db->query("UPDATE users SET team_id = 2 WHERE (role IN ('accountant', 'ke_toan') OR id = 100064) AND (team_id IS NULL OR team_id = 0)");
$db->query("UPDATE users SET team_id = 1 WHERE (role IN ('hr') OR id = 100065) AND (team_id IS NULL OR team_id = 0)");

echo "SUCCESS: Team IDs updated in users table.\n";
$rows = $db->query("SELECT id, full_name, role, team_id FROM users WHERE is_active = 1")->fetchAll();
print_r($rows);
