<?php
$dir = __DIR__;
$files = glob($dir . '/*.php');

$search1 = "if (empty(\$GLOBALS['current_admin_id']) && empty(\$_SESSION['user_id'])) {";
$search2 = "if (empty(\$GLOBALS['current_admin_id']) && !isset(\$_SESSION['user_id'])) {";

$replace = "\$hasAuth = !empty(\$GLOBALS['current_admin_id']) || !empty(\$_SESSION['user_id']) || !empty(\$_SESSION['org_user_id']) || !empty(\$_SERVER['HTTP_AUTHORIZATION']) || false || false;\n    if (!\$hasAuth) {";

$count = 0;
foreach ($files as $file) {
    if (basename($file) === 'fix_auth.php') continue;
    $content = file_get_contents($file);
    $modified = false;
    
    if (strpos($content, $search1) !== false) {
        $content = str_replace($search1, $replace, $content);
        $modified = true;
    }
    if (strpos($content, $search2) !== false) {
        $content = str_replace($search2, $replace, $content);
        $modified = true;
    }
    
    if ($modified) {
        file_put_contents($file, $content);
        echo "Fixed " . basename($file) . "\n";
        $count++;
    }
}
echo "Total files fixed: $count\n";
