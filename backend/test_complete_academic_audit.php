<?php
// backend/test_complete_academic_audit.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 SYSTEM AUDIT: PROGRAMS, COURSES, CALENDARS & LECTURERS\n";
echo "====================================================\n\n";

// 1. Audit System Settings
echo "--- 1. SYSTEM SETTINGS & PARAMETERS ---\n";
$stmtSetting = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status'");
$wonSetting = $stmtSetting->fetch();
$wonStatus = $wonSetting ? $wonSetting['setting_value'] : 'hoc_vien';
assertTest("System setting 'deal_won_status' is defined", $wonSetting !== false, "Value: {$wonStatus}");

// 2. Audit Campaigns Table (Courses)
echo "\n--- 2. MARKETING CAMPAIGNS (COURSES) SCHEMAS & INTEGRITY ---\n";
$stmtCamps = $pdo->query("SELECT * FROM marketing_campaigns");
$camps = $stmtCamps->fetchAll();
assertTest("Total marketing campaigns found", count($camps) > 0, "Found " . count($camps) . " campaigns");

foreach ($camps as $camp) {
    $campId = $camp['id'];
    $campName = $camp['name'];
    
    // Check start and end dates
    $startDate = $camp['start_date'];
    $endDate = $camp['end_date'];
    $validDates = true;
    if ($startDate && $endDate) {
        $validDates = (strtotime($startDate) <= strtotime($endDate));
    }
    assertTest("Campaign ID: {$campId} ('{$campName}') dates order validity", $validDates, "Start: {$startDate} | End: {$endDate}");

    // Validate subjects JSON
    $subjectsJson = $camp['subjects_json'];
    $subjects = json_decode($subjectsJson, true);
    $subjectsValid = (json_last_error() === JSON_ERROR_NONE);
    assertTest("Campaign ID: {$campId} subjects_json syntax check", $subjectsValid, "Length: " . strlen($subjectsJson));

    if ($subjectsValid && is_array($subjects)) {
        $subjectIds = [];
        $duplicateIdsFound = false;
        foreach ($subjects as $sub) {
            $subId = $sub['id'] ?? '';
            if (in_array($subId, $subjectIds)) {
                $duplicateIdsFound = true;
            }
            $subjectIds[] = $subId;

            // Check schedules
            if (isset($sub['schedules']) && is_array($sub['schedules'])) {
                foreach ($sub['schedules'] as $sch) {
                    $day = $sch['day_of_week'] ?? 0;
                    $start = $sch['time_start'] ?? '';
                    $end = $sch['time_end'] ?? '';
                    $validSch = ($day >= 2 && $day <= 8 && $start !== '' && $end !== '');
                    assertTest("Subject '{$sub['name']}' schedule entry validity", $validSch, "Day: {$day} | {$start} - {$end}");
                }
            }
        }
        assertTest("Campaign ID: {$campId} subject list has unique IDs", !$duplicateIdsFound);
    }

    // Validate reminders JSON
    $remindersJson = $camp['reminders_json'];
    if ($remindersJson) {
        $reminders = json_decode($remindersJson, true);
        $remindersValid = (json_last_error() === JSON_ERROR_NONE);
        assertTest("Campaign ID: {$campId} reminders_json syntax check", $remindersValid);
    }
}

// 3. Audit Projects (Programs)
echo "\n--- 3. PROJECTS (PROGRAMS) ---\n";
$stmtProjs = $pdo->query("SELECT * FROM projects");
$projs = $stmtProjs->fetchAll();
assertTest("Total projects found", count($projs) > 0, "Found " . count($projs) . " programs");

// 4. Audit Lecturers (Consultants vs Companies)
echo "\n--- 4. LECTURER ENTITIES & CONTACT INTEGRITY ---\n";
$stmtCons = $pdo->query("SELECT id, name, email, phone FROM consultants");
$consultantsList = $stmtCons->fetchAll();
echo "Found " . count($consultantsList) . " internal consultants.\n";
foreach ($consultantsList as $cons) {
    if (empty($cons['email'])) {
        echo "⚠️ Internal Consultant '{$cons['name']}' has empty email.\n";
    }
}

$stmtComp = $pdo->query("SELECT id, name, email, phone FROM companies");
$companiesList = $stmtComp->fetchAll();
echo "Found " . count($companiesList) . " external company partners.\n";
foreach ($companiesList as $comp) {
    if (empty($comp['email'])) {
        echo "⚠️ External Company '{$comp['name']}' has empty email.\n";
    }
}

// 5. Test Academic Reminders Query Optimization
echo "\n--- 5. REMINDER QUERY OPTIMIZATION SCAN ---\n";
try {
    $explain = $pdo->query("EXPLAIN SELECT id FROM contacts WHERE campaign_id = 6 AND pipeline_status = 'hoc_vien'")->fetchAll();
    $hasIndex = false;
    foreach ($explain as $expRow) {
        if (!empty($expRow['key'])) {
            $hasIndex = true;
            echo "Query Index Hit: {$expRow['key']} | Type: {$expRow['type']} | Rows scanned: {$expRow['rows']}\n";
        }
    }
    
    if (!$hasIndex) {
        echo "⚠️ No indexes hit! Printing all indexes on table 'contacts':\n";
        $indices = $pdo->query("SHOW INDEX FROM contacts")->fetchAll();
        foreach ($indices as $ind) {
            echo "Index: {$ind['Key_name']} | Column: {$ind['Column_name']} | Non_unique: {$ind['Non_unique']}\n";
        }
    }
    assertTest("Contacts queries utilize database indexing for campaign_id and pipeline_status", $hasIndex);
} catch (\Throwable $ex) {
    assertTest("Contacts queries utilize database indexing for campaign_id and pipeline_status", false, "Error: " . $ex->getMessage());
}

echo "\n";
printTestSummary();
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    exit($testStats['fail'] > 0 ? 1 : 0);
}
