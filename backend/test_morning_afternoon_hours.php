<?php
// backend/test_morning_afternoon_hours.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== STARTING TEST FOR MORNING/AFTERNOON WORKING HOURS ===\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

// Test case 1: Single shift (e.g. 08:00 to 17:30)
$singleShiftJson = json_encode([
    "1" => ["active" => true, "start" => "08:00", "end" => "17:30"]
]);

// Set fake day of week to Monday (1)
// Since isConsultantInWorkHours calls date('N'), we will test using the actual current day of week.
$currentDayOfWeek = date('N');
$scheduleWithToday = json_encode([
    $currentDayOfWeek => ["active" => true, "start" => "08:00", "end" => "12:00", "start_afternoon" => "13:30", "end_afternoon" => "17:30"]
]);

// 1. Check time during morning session (e.g., 09:00)
$inMorning = isConsultantInWorkHours("09:00", "08:00", "12:00", $scheduleWithToday);
assertTest("Time 09:00 during morning session (08:00-12:00)", $inMorning === true, "Returned: " . var_export($inMorning, true));

// 2. Check time during lunch break (e.g., 12:30) - should be false!
$inLunch = isConsultantInWorkHours("12:30", "08:00", "12:00", $scheduleWithToday);
assertTest("Time 12:30 during lunch break (12:00-13:30)", $inLunch === false, "Returned: " . var_export($inLunch, true));

// 3. Check time during afternoon session (e.g., 15:00)
$inAfternoon = isConsultantInWorkHours("15:00", "08:00", "12:00", $scheduleWithToday);
assertTest("Time 15:00 during afternoon session (13:30-17:30)", $inAfternoon === true, "Returned: " . var_export($inAfternoon, true));

// 4. Check time after afternoon session (e.g., 18:00) - should be false!
$inAfter = isConsultantInWorkHours("18:00", "08:00", "12:00", $scheduleWithToday);
assertTest("Time 18:00 after afternoon session (17:30+)", $inAfter === false, "Returned: " . var_export($inAfter, true));

// 5. Test fallback when no afternoon session is defined (regular single shift)
$regularSchedule = json_encode([
    $currentDayOfWeek => ["active" => true, "start" => "08:00", "end" => "17:30"]
]);
$fallbackInBetween = isConsultantInWorkHours("12:30", "08:00", "17:30", $regularSchedule);
assertTest("Time 12:30 on regular single shift (08:00-17:30)", $fallbackInBetween === true, "Returned: " . var_export($fallbackInBetween, true));

echo "\n=== SUMMARY ===\n";
printTestSummary();
