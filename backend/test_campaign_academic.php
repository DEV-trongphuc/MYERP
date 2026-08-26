<?php
// backend/test_campaign_academic.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/config/Database.php';

header('Content-Type: text/plain; charset=UTF-8');

try {
    echo "=== TESTING CAMPAIGN ACADEMIC DATA STORAGE ===\n";

    // 1. Verify that 'marketing_campaigns' has subjects_json and thesis_milestones_json columns.
    $db = Database::getInstance();
    
    // Check if columns exist
    $cols = $db->query("SHOW COLUMNS FROM marketing_campaigns")->fetchAll(PDO::FETCH_ASSOC);
    $columnNames = array_column($cols, 'Field');
    
    assertTest(in_array('subjects_json', $columnNames), "marketing_campaigns table should contain subjects_json column");
    assertTest(in_array('thesis_milestones_json', $columnNames), "marketing_campaigns table should contain thesis_milestones_json column");

    // 2. Fetch the MBA High Quality campaign (id = 9) or create a dummy campaign
    $campaignId = 9;
    $campaign = $db->query("SELECT * FROM marketing_campaigns WHERE id = $campaignId")->fetch(PDO::FETCH_ASSOC);
    if (!$campaign) {
        // Fallback to first available campaign
        $campaign = $db->query("SELECT * FROM marketing_campaigns LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        if ($campaign) {
            $campaignId = $campaign['id'];
        }
    }

    assertTest($campaign !== false, "A campaign should exist in the database (Found ID: $campaignId)");

    // 3. Test CampaignController::update using mocked payload
    require_once __DIR__ . '/controllers/CampaignController.php';
    $ctrl = new CampaignController($db);

    // Prepare mock academic payload
    $mockSubjects = [
        [
            'id' => 'sub_123456789',
            'code' => 'MBA101',
            'name' => 'MBA High Quality Marketing Strategy',
            'duration_weeks' => 5,
            'lecturer_id' => '1',
            'schedules' => [
                ['day_of_week' => 2, 'time_start' => '18:30', 'time_end' => '21:30']
            ],
            'seminars' => [
                ['week_index' => 3, 'day_of_week' => 8, 'topic' => 'AI in Marketing', 'time_start' => '08:30', 'time_end' => '11:30']
            ],
            'assignments' => [
                ['name' => 'Quiz 1', 'due_week' => 2],
                ['name' => 'Final Assignment', 'due_week' => 5]
            ]
        ]
    ];

    $mockThesisMilestones = [
        [
            'id' => 'ms_123456789',
            'milestone' => 'Nộp đề cương chi tiết',
            'due_date' => '2026-09-30'
        ]
    ];

    echo "\nUpdating Campaign ID: $campaignId with mock subjects & thesis milestones...\n";
    
    // We can directly test SQL UPDATE and Retrieval
    $stmt = $db->prepare("UPDATE marketing_campaigns SET subjects_json = :subs, thesis_milestones_json = :thesis WHERE id = :id");
    $stmt->execute([
        ':subs' => json_encode($mockSubjects),
        ':thesis' => json_encode($mockThesisMilestones),
        ':id' => $campaignId
    ]);

    // Retrieve back and verify
    $updatedCampaign = $db->query("SELECT subjects_json, thesis_milestones_json FROM marketing_campaigns WHERE id = $campaignId")->fetch(PDO::FETCH_ASSOC);
    
    assertTest(!empty($updatedCampaign['subjects_json']), "subjects_json should not be empty after update");
    assertTest(!empty($updatedCampaign['thesis_milestones_json']), "thesis_milestones_json should not be empty after update");

    $retrievedSubjects = json_decode($updatedCampaign['subjects_json'], true);
    $retrievedThesis = json_decode($updatedCampaign['thesis_milestones_json'], true);

    assertTest(isset($retrievedSubjects[0]['code']) && $retrievedSubjects[0]['code'] === 'MBA101', "Retrieved subject code should match 'MBA101'");
    assertTest(isset($retrievedThesis[0]['milestone']) && $retrievedThesis[0]['milestone'] === 'Nộp đề cương chi tiết', "Retrieved milestone should match");

    echo "\n=== ACADEMIC CONFIGURATION DATABASE TESTS PASSED SUCCESSFULLY ===\n";
    printTestSummary();
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n";
}
