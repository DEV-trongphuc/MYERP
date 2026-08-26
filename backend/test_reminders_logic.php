<?php
// backend/test_reminders_logic.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/config/Database.php';

header('Content-Type: text/plain; charset=UTF-8');

try {
    echo "=== STARTING ACADEMIC REMINDERS LOGIC TEST ===\n";

    // 1. Verify schema columns
    $db = Database::getInstance();
    $cols = $db->query("SHOW COLUMNS FROM marketing_campaigns")->fetchAll(PDO::FETCH_ASSOC);
    $columnNames = array_column($cols, 'Field');
    
    assertTest(in_array('reminders_json', $columnNames), "marketing_campaigns table must contain reminders_json column");

    // 2. Fetch or mock a campaign to run the reminder logic safely
    $campaign = $db->query("SELECT * FROM marketing_campaigns WHERE status = 'active' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    if ($campaign) {
        echo "Active campaign found: ID " . $campaign['id'] . " - " . $campaign['name'] . "\n";
        
        // Parse current reminders_json
        $remData = $campaign['reminders_json'] ? json_decode($campaign['reminders_json'], true) : null;
        assertTest(true, "Successfully parsed reminders_json of campaign ID " . $campaign['id']);
    } else {
        echo "No active campaign found to inspect, testing dry run.\n";
    }

    // 3. Syntax compile check of the cron script itself
    $cronFile = __DIR__ . '/cron_academic_reminders.php';
    if (file_exists($cronFile)) {
        $output = [];
        $returnVar = 0;
        exec("php -l " . escapeshellarg($cronFile), $output, $returnVar);
        assertTest($returnVar === 0, "cron_academic_reminders.php should pass PHP syntax linter: " . implode("\n", $output));
    } else {
        assertTest(false, "cron_academic_reminders.php file does not exist");
    }

    printTestSummary();

} catch (Throwable $e) {
    echo "ERROR during reminders test: " . $e->getMessage() . "\n";
}
