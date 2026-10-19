<?php
require_once __DIR__ . '/db_connect.php';

$res = $pdo->query("
    SELECT source, COUNT(*) as c 
    FROM subscribers 
    WHERE NOT EXISTS (SELECT 1 FROM subscriber_lists sl WHERE sl.subscriber_id = subscribers.id)
    GROUP BY source
")->fetchAll(PDO::FETCH_ASSOC);

echo "Orphaned Subscribers by Source:\n";
print_r($res);
