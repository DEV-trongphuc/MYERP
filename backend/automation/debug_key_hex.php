<?php
require_once 'db_connect.php';

echo "<h2>Detailed Gemini API Key Check</h2>";

try {
    $stmt = $pdo->query("SELECT workspace_id, value FROM mkt_system_settings WHERE `key` = 'gemini_api_key'");
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($results as $row) {
        $val = $row['value'];
        echo "Workspace: {$row['workspace_id']}<br>";
        echo "Value: '" . htmlspecialchars($val) . "'<br>";
        echo "Length: " . strlen($val) . "<br>";
        echo "Hex: " . bin2hex($val) . "<br>";
        echo "<hr>";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
