<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();
$c = $db->query("SELECT id, tenant_id FROM contacts WHERE id IN (1000058, 1000383, 1000986, 1022976)")->fetchAll(PDO::FETCH_ASSOC);
$p = $db->query("SELECT id, tenant_id FROM projects WHERE id = 1")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['contacts' => $c, 'projects' => $p]);
