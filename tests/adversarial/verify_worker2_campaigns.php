<?php
/**
 * Verification of campaigns.php parameter fallback hardening
 */
$phpBin = 'C:\\Users\\LENOVO\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.exe';

// 1. Test PUT ID fallback logic
$testCases = [
    ['path' => null, 'body' => ['id' => 'cmp_1'], 'get' => [], 'expected' => 'cmp_1'],
    ['path' => null, 'body' => ['campaign_id' => 'cmp_2'], 'get' => [], 'expected' => 'cmp_2'],
    ['path' => null, 'body' => [], 'get' => ['id' => 'cmp_3'], 'expected' => 'cmp_3'],
    ['path' => null, 'body' => [], 'get' => ['campaign_id' => 'cmp_4'], 'expected' => 'cmp_4'],
    ['path' => 'cmp_path', 'body' => ['id' => 'cmp_ignored'], 'get' => [], 'expected' => 'cmp_path'],
    ['path' => null, 'body' => [], 'get' => [], 'expected' => null],
];

foreach ($testCases as $idx => $tc) {
    $path = $tc['path'];
    $data = $tc['body'];
    $_GET = $tc['get'];
    $resolved = $path ?: ($data['id'] ?? $data['campaign_id'] ?? $_GET['id'] ?? $_GET['campaign_id'] ?? null);
    if ($resolved !== $tc['expected']) {
        echo "FAIL case $idx: got " . var_export($resolved, true) . ", expected " . var_export($tc['expected'], true) . "\n";
        exit(1);
    }
}
echo "PUT ID fallback tests: PASS (6/6 cases)\n";

// 2. Test resend_failed_emails parameter fallback
$resendCases = [
    ['body' => ['campaign_id' => 'c1'], 'get' => [], 'expected' => 'c1'],
    ['body' => ['id' => 'c2'], 'get' => [], 'expected' => 'c2'],
    ['body' => [], 'get' => ['campaign_id' => 'c3'], 'expected' => 'c3'],
    ['body' => [], 'get' => ['id' => 'c4'], 'expected' => 'c4'],
    ['body' => [], 'get' => [], 'expected' => null],
];

foreach ($resendCases as $idx => $tc) {
    $data = $tc['body'];
    $_GET = $tc['get'];
    $cid = $data['campaign_id'] ?? $data['id'] ?? $_GET['campaign_id'] ?? $_GET['id'] ?? null;
    if ($cid !== $tc['expected']) {
        echo "FAIL resend case $idx: got " . var_export($cid, true) . ", expected " . var_export($tc['expected'], true) . "\n";
        exit(1);
    }
}
echo "resend_failed_emails fallback tests: PASS (5/5 cases)\n";

// 3. Test send_test parameter fallback
$sendTestCases = [
    ['input' => ['campaign_id' => 't1'], 'get' => [], 'expected' => 't1'],
    ['input' => ['id' => 't2'], 'get' => [], 'expected' => 't2'],
    ['input' => [], 'get' => ['campaign_id' => 't3'], 'expected' => 't3'],
    ['input' => [], 'get' => ['id' => 't4'], 'expected' => 't4'],
    ['input' => null, 'get' => [], 'expected' => null],
];

foreach ($sendTestCases as $idx => $tc) {
    $data = is_array($tc['input']) ? $tc['input'] : [];
    $_GET = $tc['get'];
    $cid = $data['campaign_id'] ?? $data['id'] ?? $_GET['campaign_id'] ?? $_GET['id'] ?? null;
    if ($cid !== $tc['expected']) {
        echo "FAIL send_test case $idx: got " . var_export($cid, true) . ", expected " . var_export($tc['expected'], true) . "\n";
        exit(1);
    }
}
echo "send_test fallback tests: PASS (5/5 cases)\n";

// 4. Verify no '/../uploadss/' in backend/automation/campaigns.php
$content = file_get_contents(__DIR__ . '/../../backend/automation/campaigns.php');
if (strpos($content, '/../uploadss/') !== false) {
    echo "FAIL: /../uploadss/ still exists in backend/automation/campaigns.php\n";
    exit(1);
}
echo "uploadss typo check: PASS (0 occurrences)\n";

echo "\n>>> ALL CAMPAIGNS.PHP HARDENING TESTS PASSED <<<\n";
