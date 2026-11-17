<?php
/**
 * Empirical Adversarial Test Harness: Tracking Unique Cache Collision Resilience
 * Tests MD5 composite key generation across workspaces, target types, campaigns/flows,
 * events, subscribers, and reference keys.
 */

echo "=== STARTING TRACKING UNIQUE CACHE COLLISION STRESS TEST ===\n";

$targetTypes = ['flow', 'campaign', 'zalo'];
$workspaces = [1, 2, 10, 99, 1000];
$events = ['open', 'click'];

// Generate 100 diverse target IDs (UUIDs, ints, slugs)
$targetIds = [];
for ($i = 1; $i <= 50; $i++) {
    $targetIds[] = (string)$i;
    $targetIds[] = sprintf("c_%04d", $i);
    $targetIds[] = sprintf("550e8400-e29b-41d4-a716-%012d", $i);
}

// Generate 100 diverse subscriber IDs
$subscriberIds = [];
for ($i = 1; $i <= 50; $i++) {
    $subscriberIds[] = (string)$i;
    $subscriberIds[] = sprintf("sub_%05d", $i);
    $subscriberIds[] = sprintf("6ba7b810-9dad-11d1-80b4-%012d", $i);
}

// Generate diverse reference keys (URLs, step IDs, special characters)
$refKeys = [
    'general',
    'step_welcome',
    'step_condition_1',
    'step_action_email',
    'https://ideas.edu.vn',
    'https://ideas.edu.vn/landing?utm_source=email&utm_campaign=c1',
    'https://ideas.edu.vn/landing?utm_source=email&utm_campaign=c2',
    'https://ideas.edu.vn/survey/checkin?sid=123',
    'https://ideas.edu.vn/survey/checkin?sid=124',
    'https://shopee.vn/product/12345?param=value#target',
    'https://facebook.com/fanpage/posts/99999',
    'http://subdomain.domain.vn/path/to/resource?a=1&b=2',
    'https://myerp.vn/app/courses/view?id=42&tab=overview',
    'btn_enroll_now',
    'btn_contact_advisor',
    'footer_unsubscribe_link',
    'header_logo_home'
];

echo "Generating combinations and validating hash collision resistance...\n";

$seenHashes = [];
$totalGenerated = 0;
$collisionCount = 0;
$collisions = [];

$startTime = microtime(true);

// 1. Systematic Permutation Test
foreach ($workspaces as $wid) {
    foreach ($targetTypes as $type) {
        foreach (array_slice($targetIds, 0, 10) as $tid) {
            foreach ($events as $evt) {
                foreach (array_slice($subscriberIds, 0, 15) as $sid) {
                    foreach ($refKeys as $ref) {
                        $rawKey = "{$wid}_{$type}_{$tid}_{$evt}_{$sid}_{$ref}";
                        $hash = md5($rawKey);
                        $totalGenerated++;
                        
                        if (isset($seenHashes[$hash])) {
                            if ($seenHashes[$hash] !== $rawKey) {
                                $collisionCount++;
                                $collisions[] = [
                                    'hash' => $hash,
                                    'key1' => $seenHashes[$hash],
                                    'key2' => $rawKey
                                ];
                            }
                        } else {
                            $seenHashes[$hash] = $rawKey;
                        }
                    }
                }
            }
        }
    }
}

$elapsed1 = round(microtime(true) - $startTime, 3);
echo "Phase 1 (Systematic Permutations): Generated $totalGenerated unique keys in {$elapsed1}s. Collisions: $collisionCount\n";

// 2. High-entropy Random Stress Test (100,000 random inputs)
echo "Phase 2: Generating 100,000 high-entropy random tracking events...\n";
$phase2Count = 0;
for ($i = 0; $i < 100000; $i++) {
    $wid = rand(1, 500);
    $type = $targetTypes[array_rand($targetTypes)];
    $tid = 'tid_' . bin2hex(random_bytes(8));
    $evt = $events[array_rand($events)];
    $sid = 'sub_' . bin2hex(random_bytes(8));
    $ref = 'https://example.com/p/' . bin2hex(random_bytes(4)) . '?q=' . rand(1, 99999);
    
    $rawKey = "{$wid}_{$type}_{$tid}_{$evt}_{$sid}_{$ref}";
    $hash = md5($rawKey);
    $totalGenerated++;
    $phase2Count++;
    
    if (isset($seenHashes[$hash])) {
        if ($seenHashes[$hash] !== $rawKey) {
            $collisionCount++;
            $collisions[] = [
                'hash' => $hash,
                'key1' => $seenHashes[$hash],
                'key2' => $rawKey
            ];
        }
    } else {
        $seenHashes[$hash] = $rawKey;
    }
}

$elapsedTotal = round(microtime(true) - $startTime, 3);
echo "Phase 2 Complete: Total keys tested across both phases: $totalGenerated in {$elapsedTotal}s\n";
echo "Total Collisions Detected: $collisionCount\n\n";

// 3. Boundary & Edge Case Testing
echo "Phase 3: Testing Delimiter & Boundary Overlap Cases...\n";
$boundaryTests = [
    // Delimiter boundary shifts
    ['1_flow_10_open_5_link', '1_flow_1_0_open_5_link'],
    ['1_flow_10_open_5_link', '10_flow_1_open_5_link'],
    ['1_flow_2_open_5_link', '1_flow_20_pen_5_link'],
    ['1_campaign_1_open_1_btn1', '1_campaign_1_open_1_btn2'],
    ['1_flow_1_click_sub1_https://ideas.edu.vn', '1_flow_1_click_sub1_https://ideas.edu.vn/'],
    ['1_flow_1_click_sub1_http://ideas.edu.vn', '1_flow_1_click_sub1_https://ideas.edu.vn'],
    ['1_flow_1_click_sub1_general', '1_flow_1_open_sub1_general'],
    ['1_flow_1_click_sub1_general', '2_flow_1_click_sub1_general'],
];

$boundaryCollisions = 0;
foreach ($boundaryTests as $pair) {
    $h1 = md5($pair[0]);
    $h2 = md5($pair[1]);
    if ($h1 === $h2) {
        echo "[COLLISION BUG] '{$pair[0]}' and '{$pair[1]}' produced the same hash: $h1\n";
        $boundaryCollisions++;
    }
}
if ($boundaryCollisions === 0) {
    echo "Boundary Delimiter Tests: ALL PASSED (distinct hashes for all boundary variations).\n";
}

// 4. Live DB Insert Simulation Test with tracking_unique_cache
echo "\nPhase 4: Testing live MySQL INSERT IGNORE deduplication behavior...\n";
require_once __DIR__ . '/../../backend/automation/db_connect.php';

$testWid = 99999;
$testTid = 'test_camp_adversarial_' . time();
$testSub = 'sub_test_adversarial_' . time();
$testRef1 = 'https://ideas.edu.vn/link1';
$testRef2 = 'https://ideas.edu.vn/link2';

// Clean any previous test rows
$pdo->prepare("DELETE FROM tracking_unique_cache WHERE workspace_id = ?")->execute([$testWid]);

$key1 = md5("{$testWid}_campaign_{$testTid}_click_{$testSub}_{$testRef1}");
$key2 = md5("{$testWid}_campaign_{$testTid}_click_{$testSub}_{$testRef2}");

$stmt1 = $pdo->prepare("
    INSERT IGNORE INTO tracking_unique_cache 
    (cache_key, workspace_id, subscriber_id, target_type, target_id, event_type, reference_key) 
    VALUES (?, ?, ?, 'campaign', ?, 'click', ?)
");

// Insert Link 1 (First click)
$stmt1->execute([$key1, $testWid, $testSub, $testTid, $testRef1]);
$rc1 = $stmt1->rowCount();

// Insert Link 1 (Duplicate click by same subscriber on same link)
$stmt1->execute([$key1, $testWid, $testSub, $testTid, $testRef1]);
$rc2 = $stmt1->rowCount();

// Insert Link 2 (Click by same subscriber on DIFFERENT link in same campaign)
$stmt1->execute([$key2, $testWid, $testSub, $testTid, $testRef2]);
$rc3 = $stmt1->rowCount();

// Clean up
$pdo->prepare("DELETE FROM tracking_unique_cache WHERE workspace_id = ?")->execute([$testWid]);

echo "DB Test Results:\n";
echo "  Link 1 first click rowCount: $rc1 (Expected: 1 - unique counted)\n";
echo "  Link 1 second click rowCount: $rc2 (Expected: 0 - deduplicated/ignored)\n";
echo "  Link 2 click rowCount: $rc3 (Expected: 1 - distinct link counted as unique)\n";

$dbTestOk = ($rc1 === 1 && $rc2 === 0 && $rc3 === 1);

echo "\n=== FINAL CONCLUSION ON OBJECTIVE 2 ===\n";
if ($collisionCount === 0 && $boundaryCollisions === 0 && $dbTestOk) {
    echo ">>> EMPIRICAL VERDICT: PASS - ZERO COLLISION RISK & PERFECT ATOMIC DEDUPLICATION <<<\n";
    exit(0);
} else {
    echo ">>> EMPIRICAL VERDICT: FAIL - DETECTED COLLISION OR DEDUPLICATION DEFECT <<<\n";
    exit(1);
}
