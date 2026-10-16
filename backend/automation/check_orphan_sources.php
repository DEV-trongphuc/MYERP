<?php
require_once __DIR__ . '/db_connect.php';

$res = $pdo->query("
    SELECT source, COUNT(*) as c 
    FROM subscribers 
    WHERE id NOT IN (SELECT DISTINCT subscriber_id FROM subscriber_lists)
    GROUP BY source
")->fetchAll(PDO::FETCH_ASSOC);

echo "Orphaned Subscribers by Source:\n";
print_r($res);
