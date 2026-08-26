<?php
// backend/test_public_schedule.php
// PHP Test Harness for public student schedule database integrity verification

require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING PUBLIC STUDENT SCHEDULE DATABASE VERIFICATION ===\n\n";

// 1. Verify that contact ID 101 exists in contacts table
$stmt = $conn->prepare("SELECT id, full_name, campaign_id, email, phone FROM contacts WHERE id = 101 LIMIT 1");
$stmt->execute();
$contact = $stmt->get_result()->fetch_assoc();

assertTest(
    "Contact 101 exists in contacts table",
    !empty($contact),
    "Found: " . ($contact ? $contact['full_name'] : 'none')
);

if ($contact) {
    assertTest(
        "Contact 101 full name is Nguyễn Văn A",
        $contact['full_name'] === 'Nguyễn Văn A',
        "Name: " . $contact['full_name']
    );
    assertTest(
        "Contact 101 is enrolled in campaign 6",
        (int)$contact['campaign_id'] === 6,
        "Campaign ID: " . $contact['campaign_id']
    );

    // 2. Verify campaign exists
    $stmtC = $conn->prepare("SELECT id, name, project_id, subjects_json FROM marketing_campaigns WHERE id = ? LIMIT 1");
    $campaignId = (int)$contact['campaign_id'];
    $stmtC->bind_param("i", $campaignId);
    $stmtC->execute();
    $campaign = $stmtC->get_result()->fetch_assoc();

    assertTest(
        "Campaign 6 exists in marketing_campaigns",
        !empty($campaign),
        "Campaign name: " . ($campaign ? $campaign['name'] : 'none')
    );

    if ($campaign) {
        $subjects = json_decode($campaign['subjects_json'], true);
        assertTest(
            "Campaign subjects_json is a valid array",
            is_array($subjects),
            "Subjects count: " . count($subjects ?? [])
        );
    }
}

echo "\n";
printTestSummary();
