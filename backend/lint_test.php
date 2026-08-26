<?php
$output = [];
$ret = 0;
exec("php -d display_errors=1 -d error_reporting=E_ALL -l " . escapeshellarg(__DIR__ . '/controllers/ActivityController.php') . " 2>&1", $output, $ret);
echo implode("\n", $output) . "\nReturn code: $ret\n";

if ($ret !== 0) {
    // Try to include in a subprocess to get error
    $out2 = [];
    exec("php -d display_errors=1 -d error_reporting=E_ALL -r \"include '" . __DIR__ . "/controllers/ActivityController.php';\" 2>&1", $out2, $ret2);
    echo "=== RUNTIME / PARSE ERROR ===\n" . implode("\n", $out2) . "\n";
}
