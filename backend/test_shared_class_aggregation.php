<?php
// backend/test_shared_class_aggregation.php
// PHP Test Harness for verifying shared classes aggregation logic (deduplication of lecturer sessions)

require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING SHARED CLASS AGGREGATION & LECTURER DEDUPLICATION TESTS ===\n\n";

// 1. Verify database connectivity
assertTest(
    "Database connection is online",
    isset($conn) && $conn instanceof mysqli,
    "MySQLi status: " . (isset($conn) ? "Connected" : "Disconnected")
);

// 2. Mock a scenario with duplicate sessions for a lecturer across different courses
// Subject A in Course 1: Lecturing on 2026-09-01 18:30-21:30 by Lecturer ID 999
// Subject A in Course 2: Lecturing on 2026-09-01 18:30-21:30 by Lecturer ID 999
$mockEvents = [
    [
        "type" => "school",
        "date" => "2026-09-01",
        "subjectCode" => "MBA101",
        "subjectName" => "Marketing Strategy (MBA K20)",
        "title" => "Buổi học 1",
        "time" => "18:30 - 21:30",
        "lecturer" => "Nguyễn Văn A",
        "location" => "Zoom 1"
    ],
    [
        "type" => "school",
        "date" => "2026-09-01",
        "subjectCode" => "MBA101",
        "subjectName" => "Marketing Strategy (MBA K21)",
        "title" => "Buổi học 1",
        "time" => "18:30 - 21:30",
        "lecturer" => "Nguyễn Văn A",
        "location" => "Zoom 1"
    ],
    // Event 3: Different time, same day (Should NOT be merged)
    [
        "type" => "school",
        "date" => "2026-09-01",
        "subjectCode" => "MBA101",
        "subjectName" => "Marketing Strategy (MBA K20)",
        "title" => "Buổi học 2",
        "time" => "08:30 - 11:30",
        "lecturer" => "Nguyễn Văn A",
        "location" => "Zoom 1"
    ]
];

echo "Simulating frontend deduplication logic on " . count($mockEvents) . " sessions...\n";

// Emulate frontend React deduplication logic
$dedupedEvents = [];
foreach ($mockEvents as $evt) {
    $foundIdx = -1;
    for ($i = 0; $i < count($dedupedEvents); $i++) {
        $e = $dedupedEvents[$i];
        if (
            $e['date'] === $evt['date'] &&
            $e['lecturer'] === $evt['lecturer'] &&
            $e['subjectCode'] === $evt['subjectCode'] &&
            $e['time'] === $evt['time'] &&
            $e['type'] === $evt['type']
        ) {
            $foundIdx = $i;
            break;
        }
    }

    if ($foundIdx !== -1) {
        // Gộp tên khóa học
        $existing = &$dedupedEvents[$foundIdx];
        
        $getCourseName = function($fullName) {
            if (preg_match('/\(([^)]+)\)$/', $fullName, $matches)) {
                return $matches[1];
            }
            return '';
        };
        
        $getBaseName = function($fullName) {
            return trim(preg_replace('/\s*\([^)]+\)$/', '', $fullName));
        };
        
        $course1 = $getCourseName($existing['subjectName']);
        $course2 = $getCourseName($evt['subjectName']);
        $baseName = $getBaseName($existing['subjectName']);
        
        if (!empty($course1) && !empty($course2) && $course1 !== $course2) {
            $courses = array_unique(array_merge(explode(', ', $course1), explode(', ', $course2)));
            $existing['subjectName'] = $baseName . ' (' . implode(', ', $courses) . ')';
        } elseif (empty($course1) && !empty($course2)) {
            $existing['subjectName'] = $existing['subjectName'] . ' (' . $course2 . ')';
        }

        if ($existing['title'] !== $evt['title']) {
            $existing['title'] = implode(' / ', array_unique([$existing['title'], $evt['title']]));
        }
    } else {
        $dedupedEvents[] = $evt;
    }
}

assertTest(
    "Deduplication output has correct number of sessions",
    count($dedupedEvents) === 2,
    "Expected count: 2 | Actual count: " . count($dedupedEvents)
);

assertTest(
    "Shared session (K20, K21) subjectName was merged correctly",
    $dedupedEvents[0]['subjectName'] === "Marketing Strategy (MBA K20, MBA K21)",
    "Merged subjectName: " . $dedupedEvents[0]['subjectName']
);

assertTest(
    "Different time session was NOT merged",
    $dedupedEvents[1]['time'] === "08:30 - 11:30" && $dedupedEvents[1]['subjectName'] === "Marketing Strategy (MBA K20)",
    "Unmerged session time: " . $dedupedEvents[1]['time'] . " | Name: " . $dedupedEvents[1]['subjectName']
);

echo "\n";
printTestSummary();
