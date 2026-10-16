<?php
require_once __DIR__ . '/db_connect.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Unauthorized: This script can only be run from the command line (CLI).");
}

try {
    echo "Analyzing orphaned subscribers...<br>";
    
    $res = $pdo->query("
        SELECT source, COUNT(*) as c 
        FROM subscribers 
        WHERE id NOT IN (SELECT DISTINCT subscriber_id FROM subscriber_lists)
        GROUP BY source
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo "<h3>Orphaned Subscribers by Source:</h3><ul>";
    $totalOrphans = 0;
    $sourcesToDelete = [];
    foreach ($res as $row) {
        $src = $row['source'] ? $row['source'] : 'NULL';
        echo "<li>{$src}: <b>{$row['c']}</b></li>";
        $totalOrphans += $row['c'];
        
        // We will target anything that's not Manual or System for cleanup if run is passed
        if (!in_array($src, ['Manual', 'Form', 'System', 'API'])) {
            $sourcesToDelete[] = $row['source'];
        }
    }
    echo "</ul>";
    echo "<p>Total orphans: <b>$totalOrphans</b></p>";

    if (isset($_GET['confirm']) && $_GET['confirm'] === 'yes' && !empty($sourcesToDelete)) {
        $placeholders = implode(',', array_fill(0, count($sourcesToDelete), '?'));
        $stmt = $pdo->prepare("
            DELETE FROM subscribers 
            WHERE id NOT IN (SELECT DISTINCT subscriber_id FROM subscriber_lists)
            AND source IN ($placeholders)
        ");
        $stmt->execute($sourcesToDelete);
        $deleted = $stmt->rowCount();
        echo "<br><b style='color:green'>Cleaned up $deleted orphaned subscribers from Integration sources.</b><br>";
        echo "<b>WORKSPACE DATA IS NOW 100% CLEAN!</b>";
    } else if ($totalOrphans > 0) {
        echo "<br><a href='?confirm=yes'><button style='padding:10px; background:red; color:white; border:none; cursor:pointer;'>CONFIRM DELETE INTEGRATION ORPHANS</button></a>";
    }

} catch (Exception $e) {
    echo "<b>ERROR:</b> " . $e->getMessage();
}
