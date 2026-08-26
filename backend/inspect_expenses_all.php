<?php
// backend/inspect_expenses_all.php
require_once __DIR__ . '/test_bootstrap.php';

echo "--- EXPENSES TABLE CONTENTS ---\n";
$exps = $pdo->query("SELECT * FROM expenses")->fetchAll(PDO::FETCH_ASSOC);
echo "Total expenses: " . count($exps) . "\n";
print_r($exps);
