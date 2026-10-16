<?php
require_once 'db_connect.php';
$stmt = $pdo->query("SELECT config FROM integrations WHERE id = '695c1d36e803f'");
echo $stmt->fetchColumn();
?>
