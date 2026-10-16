<?php
require_once __DIR__ . '/db_connect.php';

try {
    echo "<h2>Reset Integrations & Clear Synced Data</h2>";

    // 1. Find all Integration Names
    $stmt = $pdo->query("SELECT id, name, type, config FROM integrations");
    $integrations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sources = [];
    foreach ($integrations as $intg) {
        if ($intg['name']) {
            $sources[] = $intg['name'];
        }
    }
    $sources = array_unique($sources);

    // Filter out Manual, Form, System to be safe
    $sources = array_diff($sources, ['Manual', 'Form', 'System', 'API', 'Zalo', 'Website', 'Import CSV']);

    if (isset($_GET['confirm']) && $_GET['confirm'] === 'yes') {
        
        $pdo->beginTransaction();

        // 1. Delete subscribers belonging to these sources
        $placeholders = implode(',', array_fill(0, count($sources), '?'));
        
        // Count before delete
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE source IN ($placeholders)");
        $stmtCount->execute(array_values($sources));
        $count = $stmtCount->fetchColumn();

        $stmtDel = $pdo->prepare("DELETE FROM subscribers WHERE source IN ($placeholders)");
        $stmtDel->execute(array_values($sources));
        $deletedSubs = $stmtDel->rowCount();

        // 2. Reset Integration cursors and status
        foreach ($integrations as $intg) {
            $config = json_decode($intg['config'], true) ?: [];
            // Remove last_sync_date or cursor from config
            if (isset($config['last_sync_date'])) unset($config['last_sync_date']);
            if (isset($config['last_cursor'])) unset($config['last_cursor']);
            
            $stmtUpd = $pdo->prepare("UPDATE integrations SET last_sync_at = NULL, sync_status = 'idle', config = ? WHERE id = ?");
            $stmtUpd->execute([json_encode($config), $intg['id']]);
        }

        $pdo->commit();

        echo "<b style='color:green'>SUCCESS!</b><br>";
        echo "- Deleted $deletedSubs subscribers from synced sources.<br>";
        echo "- Reset sync cursors for " . count($integrations) . " integrations.<br>";
        echo "<b>You can now click Sync again from the UI!</b>";

    } else {
        echo "<p>This will delete ALL subscribers that have the following sources:</p>";
        echo "<ul>";
        foreach ($sources as $s) {
            echo "<li>$s</li>";
        }
        echo "</ul>";
        echo "<p>And it will reset the <code>last_sync_at</code> cursor of all integrations so they fetch from the beginning.</p>";
        echo "<a href='?confirm=yes'><button style='padding:10px; background:red; color:white; font-weight:bold; cursor:pointer;'>CONFIRM CLEAR & RESET INTEGRATIONS</button></a>";
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo "<b>ERROR:</b> " . $e->getMessage();
}
