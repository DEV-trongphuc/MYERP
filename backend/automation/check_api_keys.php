<?php
require_once 'db_connect.php';

echo "<h2>Checking Gemini API Keys</h2>";

try {
    $stmt = $pdo->query("SELECT workspace_id, `key`, value FROM mkt_system_settings WHERE `key` = 'gemini_api_key'");
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($results)) {
        echo "❌ No gemini_api_key found in mkt_system_settings table.<br>";
    } else {
        echo "<table border='1'><tr><th>Workspace ID</th><th>Key</th><th>Value (Masked)</th></tr>";
        foreach ($results as $row) {
            $val = $row['value'];
            $masked = $val ? (substr($val, 0, 5) . "..." . substr($val, -5)) : "[EMPTY]";
            echo "<tr><td>{$row['workspace_id']}</td><td>{$row['key']}</td><td>$masked</td></tr>";
        }
        echo "</table>";
    }
    
    // Check fallback
    $envKey = getenv('GEMINI_API_KEY');
    echo "<br>Environment Key: " . ($envKey ? "FOUND" : "NOT FOUND");

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
