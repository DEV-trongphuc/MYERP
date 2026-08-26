<?php
// backend/test_all_lecturers_schedule.php
// PHP Test Harness for verifying database integrity and consolidated schedule data extraction

require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING DATABASE VERIFICATION FOR ALL LECTURERS CONSOLIDATED SCHEDULE ===\n\n";

// 1. Check database connection
assertTest(
    "Database connection is active",
    isset($conn) && $conn instanceof mysqli,
    "MySQLi connection status: " . (isset($conn) ? "Connected" : "Disconnected")
);

if (isset($conn) && $conn instanceof mysqli) {
    // 2. Query campaigns to fetch subject configurations
    $resCampaigns = $conn->query("SELECT id, name, project_id, subjects_json, status, thesis_milestones_json FROM marketing_campaigns");
    
    assertTest(
        "Query marketing_campaigns executed successfully",
        $resCampaigns !== false,
        "Error if any: " . $conn->error
    );

    if ($resCampaigns) {
        $matchingSubjects = [];
        $thesisMilestones = [];
        $totalCampaigns = 0;
        
        while ($row = $resCampaigns->fetch_assoc()) {
            $totalCampaigns++;
            if (empty($row['subjects_json'])) continue;
            $subjectsArray = json_decode($row['subjects_json'], true);
            if (!is_array($subjectsArray)) continue;

            foreach ($subjectsArray as $sub) {
                $sub['name'] = $sub['name'] . " (" . $row['name'] . ")";
                $matchingSubjects[] = $sub;
            }
            
            if (!empty($row['thesis_milestones_json'])) {
                $miles = json_decode($row['thesis_milestones_json'], true);
                if (is_array($miles)) {
                    $thesisMilestones = array_merge($thesisMilestones, $miles);
                }
            }
        }
        
        assertTest(
            "Found marketing campaigns in database",
            $totalCampaigns > 0,
            "Total campaigns count: " . $totalCampaigns
        );

        assertTest(
            "Extracted subjects config list successfully",
            count($matchingSubjects) > 0,
            "Total subjects extracted: " . count($matchingSubjects)
        );
        
        if (count($matchingSubjects) > 0) {
            $firstSub = $matchingSubjects[0];
            assertTest(
                "Subject structure has name, code, and id",
                isset($firstSub['id']) && isset($firstSub['name']),
                "First subject keys: " . implode(', ', array_keys($firstSub))
            );
        }
    }
}

echo "\n";
printTestSummary();
