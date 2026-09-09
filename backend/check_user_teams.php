<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();
echo "=== USERS ===\n";
print_r($db->query("SELECT id, full_name, email, role, team_id FROM users WHERE is_active=1")->fetchAll());

echo "=== TEAMS ===\n";
print_r($db->query("SELECT * FROM teams")->fetchAll());
