<?php
/**
 * tests/adversarial/adversarial_condition_stress_m2.php
 * Adversarial Challenger 1 Empirical Test Harness for Milestone 2
 * 
 * Target: backend/automation/flow_helpers.php
 * Functions: evaluateAdvancedConditionGroup and isSubscriberMatch
 * 
 * Test Scenarios:
 * 1. Tag matching: tag, tags, crm_tags with has_tag, not_has_tag (single, comma, pipe, missing)
 * 2. Boolean semantics: is_true and is_false with multi-semantic values ('yes', 'no', 'true', 'false', '1', '0', 1, 0, null, '', 'none')
 * 3. Numeric vs float vs string comparison: not_equals and != ('10.0' vs '10', '0' vs '', strings)
 * 4. Inverted not_has_done on activity_history and web_activity: true when not performed, false when performed
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../../backend/env.php';
require_once __DIR__ . '/../../backend/automation/flow_helpers.php';

// Database setup from backend/.env or environment
$dbHost = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: '127.0.0.1';
$dbName = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: 'vhvxoigh_myerp';
$dbUser = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: '';
$dbPass = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '';
if ($dbUser === '' || $dbPass === '') {
    fwrite(STDERR, "Missing DB_USER / DB_PASS in backend/.env or environment.\n");
    exit(1);
}
$pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
]);

$totalTests = 0;
$passedTests = 0;
$failedTests = 0;
$failures = [];

function run_test(string $name, callable $fn) {
    global $totalTests, $passedTests, $failedTests, $failures;
    $totalTests++;
    try {
        $result = $fn();
        if ($result === true) {
            $passedTests++;
            echo "  [PASS] $name\n";
        } else {
            $failedTests++;
            $msg = "Returned false or non-true: " . var_export($result, true);
            $failures[] = ["test" => $name, "error" => $msg];
            echo "  [FAIL] $name: $msg\n";
        }
    } catch (Throwable $e) {
        $failedTests++;
        $failures[] = ["test" => $name, "error" => $e->getMessage()];
        echo "  [FAIL] $name (Exception): " . $e->getMessage() . "\n";
    }
}

echo "====================================================================\n";
echo "   ADVERSARIAL STRESS TEST SUITE: MILESTONE 2 (FLOW_HELPERS.PHP)\n";
echo "====================================================================\n\n";

// ====================================================================
// SUITE 1: TAG MATCHING IN evaluateAdvancedConditionGroup
// ====================================================================
echo "▶ Suite 1: evaluateAdvancedConditionGroup Tag Operators (has_tag & not_has_tag)\n";

$subWithTags = [
    'id' => 'sub_tag_01',
    'tags_array' => ['VIP', 'Hot Lead', 'Học viên 2026', 'Kế toán']
];

$subWithoutTags = [
    'id' => 'sub_tag_02',
    'tags_array' => []
];

// 1.1 Single tag matching
run_test("1.1.1 field: 'tag', operator: 'has_tag' matches single existing tag 'VIP'", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.1.2 field: 'tag', operator: 'has_tag' is case-insensitive ('vip' matches 'VIP')", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'vip']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.1.3 field: 'tags', operator: 'has_tag' matches 'Hot Lead'", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tags', 'operator' => 'has_tag', 'value' => 'Hot Lead']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.1.4 field: 'crm_tags', operator: 'has_tag' matches 'Kế toán'", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'crm_tags', 'operator' => 'has_tag', 'value' => 'Kế toán']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.1.5 field: 'tag', operator: 'has_tag' returns FALSE for non-existing tag 'Blacklist'", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'Blacklist']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === false;
});

// 1.2 Comma-separated and pipe-separated tags
run_test("1.2.1 field: 'tag', operator: 'has_tag' with comma-separated 'Blacklist, VIP' returns TRUE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'Blacklist, VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.2.2 field: 'tag', operator: 'has_tag' with pipe-separated 'Cold|Hot Lead' returns TRUE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'Cold|Hot Lead']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.2.3 field: 'tag', operator: 'has_tag' with 'Cold, Dormant, Spam' returns FALSE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'Cold, Dormant, Spam']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === false;
});

// 1.3 not_has_tag operator
run_test("1.3.1 field: 'tag', operator: 'not_has_tag' on non-existing tag 'Spam' returns TRUE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'Spam']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

run_test("1.3.2 field: 'tag', operator: 'not_has_tag' on existing tag 'VIP' returns FALSE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === false;
});

run_test("1.3.3 field: 'tag', operator: 'not_has_tag' with comma 'Spam, VIP' returns FALSE (since VIP is present)", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'Spam, VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === false;
});

run_test("1.3.4 field: 'tag', operator: 'not_has_tag' with comma 'Spam, Trash' returns TRUE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'Spam, Trash']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

// 1.4 Missing / Empty tags
run_test("1.4.1 field: 'tag', operator: 'has_tag' on subscriber with NO tags returns FALSE", function() use ($pdo, $subWithoutTags) {
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_02', $subWithoutTags, $cond) === false;
});

run_test("1.4.2 field: 'tag', operator: 'not_has_tag' on subscriber with NO tags returns TRUE", function() use ($pdo, $subWithoutTags) {
    $cond = [['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_02', $subWithoutTags, $cond) === true;
});

run_test("1.4.3 field: 'tag', operator: 'is_empty' on subscriber with NO tags returns TRUE", function() use ($pdo, $subWithoutTags) {
    $cond = [['field' => 'tag', 'operator' => 'is_empty', 'value' => '']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_02', $subWithoutTags, $cond) === true;
});

run_test("1.4.4 field: 'tag', operator: 'is_not_empty' on subscriber with tags returns TRUE", function() use ($pdo, $subWithTags) {
    $cond = [['field' => 'tag', 'operator' => 'is_not_empty', 'value' => '']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_tag_01', $subWithTags, $cond) === true;
});

echo "\n";

// ====================================================================
// SUITE 2: TAG MATCHING IN isSubscriberMatch (Segment criteria)
// ====================================================================
echo "▶ Suite 2: isSubscriberMatch Tag Operators (has_tag & not_has_tag via DB)\n";

// Set up temporary test tags in DB
$testSubId = 'sub_emp_test_' . bin2hex(random_bytes(6));
$tag1Id = 'tag_emp_' . bin2hex(random_bytes(6));
$tag2Id = 'tag_emp_' . bin2hex(random_bytes(6));

try {
    $pdo->prepare("INSERT INTO domation_tags (id, workspace_id, name, created_at) VALUES (?, 99999, 'VIP_ORACLE', NOW()), (?, 99999, 'HOT_DEAL_ORACLE', NOW())")
        ->execute([$tag1Id, $tag2Id]);

    $pdo->prepare("INSERT INTO subscriber_tags (subscriber_id, tag_id, workspace_id) VALUES (?, ?, 99999), (?, ?, 99999)")
        ->execute([$testSubId, $tag1Id, $testSubId, $tag2Id]);

    $subDbRecord = ['id' => $testSubId, 'email' => 'oracle@ideas.edu.vn'];

    run_test("2.1 isSubscriberMatch: field: 'tag', operator: 'has_tag' matches single tag 'VIP_ORACLE'", function() use ($subDbRecord) {
        $criteria = [['conditions' => [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP_ORACLE']]]];
        return isSubscriberMatch($subDbRecord, $criteria) === true;
    });

    run_test("2.2 isSubscriberMatch: field: 'tag', operator: 'has_tag' with comma-separated 'OTHER, VIP_ORACLE' returns TRUE", function() use ($subDbRecord) {
        $criteria = [['conditions' => [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'OTHER, VIP_ORACLE']]]];
        return isSubscriberMatch($subDbRecord, $criteria) === true;
    });

    run_test("2.3 isSubscriberMatch: field: 'tag', operator: 'has_tag' for non-existent tag returns FALSE", function() use ($subDbRecord) {
        $criteria = [['conditions' => [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'NON_EXISTENT']]]];
        return isSubscriberMatch($subDbRecord, $criteria) === false;
    });

    run_test("2.4 isSubscriberMatch: field: 'tags', operator: 'not_has_tag' on non-existent tag returns TRUE", function() use ($subDbRecord) {
        $criteria = [['conditions' => [['field' => 'tags', 'operator' => 'not_has_tag', 'value' => 'NON_EXISTENT']]]];
        return isSubscriberMatch($subDbRecord, $criteria) === true;
    });

    run_test("2.5 isSubscriberMatch: field: 'tags', operator: 'not_has_tag' on existing tag 'VIP_ORACLE' returns FALSE", function() use ($subDbRecord) {
        $criteria = [['conditions' => [['field' => 'tags', 'operator' => 'not_has_tag', 'value' => 'VIP_ORACLE']]]];
        return isSubscriberMatch($subDbRecord, $criteria) === false;
    });

    run_test("2.6 isSubscriberMatch: subscriber with no tags tested with has_tag returns FALSE", function() {
        $emptySub = ['id' => 'sub_no_tags_' . bin2hex(random_bytes(6)), 'email' => 'empty@ideas.edu.vn'];
        $criteria = [['conditions' => [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP_ORACLE']]]];
        return isSubscriberMatch($emptySub, $criteria) === false;
    });

    run_test("2.7 isSubscriberMatch: subscriber with no tags tested with not_has_tag returns TRUE", function() {
        $emptySub = ['id' => 'sub_no_tags_' . bin2hex(random_bytes(6)), 'email' => 'empty@ideas.edu.vn'];
        $criteria = [['conditions' => [['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'VIP_ORACLE']]]];
        return isSubscriberMatch($emptySub, $criteria) === true;
    });

} finally {
    // Cleanup temporary DB tags
    $pdo->prepare("DELETE FROM subscriber_tags WHERE subscriber_id = ?")->execute([$testSubId]);
    $pdo->prepare("DELETE FROM domation_tags WHERE id IN (?, ?)")->execute([$tag1Id, $tag2Id]);
}

echo "\n";

// ====================================================================
// SUITE 3: MULTI-SEMANTIC BOOLEAN OPERATORS (is_true & is_false)
// ====================================================================
echo "▶ Suite 3: Boolean Operators (is_true & is_false across multi-semantic values)\n";

$multiSemanticValues = [
    // True group: 'yes', 'true', '1', 1
    ['val' => 'yes',   'expected_true' => true,  'expected_false' => false],
    ['val' => 'true',  'expected_true' => true,  'expected_false' => false],
    ['val' => '1',     'expected_true' => true,  'expected_false' => false],
    ['val' => 1,       'expected_true' => true,  'expected_false' => false],
    // False group: 'no', 'false', '0', 0, null, '', 'none'
    ['val' => 'no',    'expected_true' => false, 'expected_false' => true],
    ['val' => 'false', 'expected_true' => false, 'expected_false' => true],
    ['val' => '0',     'expected_true' => false, 'expected_false' => true],
    ['val' => 0,       'expected_true' => false, 'expected_false' => true],
    ['val' => null,    'expected_true' => false, 'expected_false' => true],
    ['val' => '',      'expected_true' => false, 'expected_false' => true],
    ['val' => 'none',  'expected_true' => false, 'expected_false' => true],
];

// Test on erp_is_student
foreach ($multiSemanticValues as $idx => $item) {
    $val = $item['val'];
    $valDesc = is_null($val) ? 'null' : (is_string($val) ? "'$val'" : var_export($val, true));
    $expTrue = $item['expected_true'];
    $expFalse = $item['expected_false'];

    run_test("3.1." . ($idx+1) . " erp_is_student = $valDesc -> is_true evaluates to " . ($expTrue ? 'TRUE' : 'FALSE'), function() use ($pdo, $val, $expTrue) {
        $sub = ['id' => 'sub_bool_test', 'erp_is_student' => $val];
        $cond = [['field' => 'erp_is_student', 'operator' => 'is_true', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, 'sub_bool_test', $sub, $cond) === $expTrue;
    });

    run_test("3.2." . ($idx+1) . " erp_is_student = $valDesc -> is_false evaluates to " . ($expFalse ? 'TRUE' : 'FALSE'), function() use ($pdo, $val, $expFalse) {
        $sub = ['id' => 'sub_bool_test', 'erp_is_student' => $val];
        $cond = [['field' => 'erp_is_student', 'operator' => 'is_false', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, 'sub_bool_test', $sub, $cond) === $expFalse;
    });
}

// Test on crm_sale_contacted (which has special boolean normalization)
run_test("3.3.1 crm_sale_contacted = 'yes' -> is_true evaluates to TRUE", function() use ($pdo) {
    $sub = ['id' => 'sub_bool_crm', 'crm_sale_contacted' => 'yes'];
    $cond = [['field' => 'crm_sale_contacted', 'operator' => 'is_true', 'value' => '']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_bool_crm', $sub, $cond) === true;
});

run_test("3.3.2 crm_sale_contacted = 'no' -> is_false evaluates to TRUE", function() use ($pdo) {
    $sub = ['id' => 'sub_bool_crm', 'crm_sale_contacted' => 'no'];
    $cond = [['field' => 'crm_sale_contacted', 'operator' => 'is_false', 'value' => '']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_bool_crm', $sub, $cond) === true;
});

echo "\n";

// ====================================================================
// SUITE 4: NOT_EQUALS & != COMPARISONS (Numeric, Float & String)
// ====================================================================
echo "▶ Suite 4: not_equals and != Operators (Numeric Float & String Comparison)\n";

// 4.1 Numeric and Float comparisons
run_test("4.1.1 lead_score: '10.0' vs '10' with not_equals evaluates to FALSE (they are numerically equal)", function() use ($pdo) {
    $sub = ['id' => 'sub_num_01', 'lead_score' => '10.0'];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '10']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_num_01', $sub, $cond) === false;
});

run_test("4.1.2 lead_score: '10.0' vs '10' with != evaluates to FALSE (they are numerically equal)", function() use ($pdo) {
    $sub = ['id' => 'sub_num_01', 'lead_score' => '10.0'];
    $cond = [['field' => 'lead_score', 'operator' => '!=', 'value' => '10']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_num_01', $sub, $cond) === false;
});

run_test("4.1.3 lead_score: '10.5' vs '10' with not_equals evaluates to TRUE", function() use ($pdo) {
    $sub = ['id' => 'sub_num_02', 'lead_score' => '10.5'];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '10']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_num_02', $sub, $cond) === true;
});

run_test("4.1.4 lead_score: '0' vs '' with not_equals evaluates to TRUE (string comparison: '0' !== '')", function() use ($pdo) {
    $sub = ['id' => 'sub_num_03', 'lead_score' => '0'];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_num_03', $sub, $cond) === true;
});

run_test("4.1.5 lead_score: '0' vs '0.0' with not_equals evaluates to FALSE (numerically 0.0 == 0.0)", function() use ($pdo) {
    $sub = ['id' => 'sub_num_04', 'lead_score' => '0'];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '0.0']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_num_04', $sub, $cond) === false;
});

run_test("4.1.6 lead_score: '-5.0' vs '-5' with not_equals evaluates to FALSE (negative equality)", function() use ($pdo) {
    $sub = ['id' => 'sub_num_05', 'lead_score' => '-5.0'];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '-5']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_num_05', $sub, $cond) === false;
});

// 4.2 String comparisons with not_equals and !=
run_test("4.2.1 city: 'Hà Nội' vs 'Hà Nội' with not_equals evaluates to FALSE", function() use ($pdo) {
    $sub = ['id' => 'sub_str_01', 'city' => 'Hà Nội'];
    $cond = [['field' => 'city', 'operator' => 'not_equals', 'value' => 'Hà Nội']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_str_01', $sub, $cond) === false;
});

run_test("4.2.2 city: 'Hà Nội' vs 'hà nội' with not_equals evaluates to FALSE (case-insensitive)", function() use ($pdo) {
    $sub = ['id' => 'sub_str_01', 'city' => 'Hà Nội'];
    $cond = [['field' => 'city', 'operator' => 'not_equals', 'value' => 'hà nội']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_str_01', $sub, $cond) === false;
});

run_test("4.2.3 city: 'Hà Nội' vs 'TP HCM' with not_equals evaluates to TRUE", function() use ($pdo) {
    $sub = ['id' => 'sub_str_01', 'city' => 'Hà Nội'];
    $cond = [['field' => 'city', 'operator' => 'not_equals', 'value' => 'TP HCM']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_str_01', $sub, $cond) === true;
});

run_test("4.2.4 city: 'Hà Nội' vs 'TP HCM' with != evaluates to TRUE", function() use ($pdo) {
    $sub = ['id' => 'sub_str_01', 'city' => 'Hà Nội'];
    $cond = [['field' => 'city', 'operator' => '!=', 'value' => 'TP HCM']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_str_01', $sub, $cond) === true;
});

echo "\n";

// ====================================================================
// SUITE 5: INVERTED not_has_done ON ACTIVITY_HISTORY & WEB_ACTIVITY
// ====================================================================
echo "▶ Suite 5: Inverted not_has_done Operator (activity_history & web_activity)\n";

$actSubId1 = 'sub_act_done_' . bin2hex(random_bytes(6));
$actSubId2 = 'sub_act_none_' . bin2hex(random_bytes(6));

try {
    // Populate activity for sub 1: email click and web view
    $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, details, reference_name, reference_id, created_at) VALUES 
        (?, 99999, 'clicked_link', 'Clicked URL https://ideas.edu.vn/khoa-hoc-mba', 'Chiến dịch MBA', 'camp_001', NOW()),
        (?, 99999, 'web_page_view', 'Visited page /tuyen-sinh-2026', 'Tuyển sinh 2026', 'page_001', NOW())
    ")->execute([$actSubId1, $actSubId1]);

    // Sub 2 has NO activity records in subscriber_activity

    // 5.1 activity_history tests
    run_test("5.1.1 activity_history: sub HAS performed 'clicked_link' -> 'has_done' evaluates to TRUE", function() use ($pdo, $actSubId1) {
        $sub = ['id' => $actSubId1];
        $cond = [['field' => 'activity_history', 'operator' => 'has_done', 'activity_type' => 'clicked_link', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId1, $sub, $cond) === true;
    });

    run_test("5.1.2 activity_history: sub HAS performed 'clicked_link' -> 'not_has_done' evaluates to FALSE", function() use ($pdo, $actSubId1) {
        $sub = ['id' => $actSubId1];
        $cond = [['field' => 'activity_history', 'operator' => 'not_has_done', 'activity_type' => 'clicked_link', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId1, $sub, $cond) === false;
    });

    run_test("5.1.3 activity_history: sub has NOT performed 'opened_email' -> 'not_has_done' evaluates to TRUE", function() use ($pdo, $actSubId1) {
        $sub = ['id' => $actSubId1];
        $cond = [['field' => 'activity_history', 'operator' => 'not_has_done', 'activity_type' => 'opened_email', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId1, $sub, $cond) === true;
    });

    run_test("5.1.4 activity_history: sub with zero activities -> 'not_has_done' evaluates to TRUE", function() use ($pdo, $actSubId2) {
        $sub = ['id' => $actSubId2];
        $cond = [['field' => 'activity_history', 'operator' => 'not_has_done', 'activity_type' => 'clicked_link', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId2, $sub, $cond) === true;
    });

    run_test("5.1.5 activity_history: sub with zero activities -> 'has_done' evaluates to FALSE", function() use ($pdo, $actSubId2) {
        $sub = ['id' => $actSubId2];
        $cond = [['field' => 'activity_history', 'operator' => 'has_done', 'activity_type' => 'clicked_link', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId2, $sub, $cond) === false;
    });

    // 5.2 web_activity tests
    run_test("5.2.1 web_activity: sub HAS visited '/tuyen-sinh-2026' -> 'has_done' evaluates to TRUE", function() use ($pdo, $actSubId1) {
        $sub = ['id' => $actSubId1];
        $cond = [['field' => 'web_activity', 'operator' => 'has_done', 'page_url' => 'tuyen-sinh-2026', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId1, $sub, $cond) === true;
    });

    run_test("5.2.2 web_activity: sub HAS visited '/tuyen-sinh-2026' -> 'not_has_done' evaluates to FALSE", function() use ($pdo, $actSubId1) {
        $sub = ['id' => $actSubId1];
        $cond = [['field' => 'web_activity', 'operator' => 'not_has_done', 'page_url' => 'tuyen-sinh-2026', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId1, $sub, $cond) === false;
    });

    run_test("5.2.3 web_activity: sub has NOT visited '/bang-gia' -> 'not_has_done' evaluates to TRUE", function() use ($pdo, $actSubId1) {
        $sub = ['id' => $actSubId1];
        $cond = [['field' => 'web_activity', 'operator' => 'not_has_done', 'page_url' => 'bang-gia', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId1, $sub, $cond) === true;
    });

    run_test("5.2.4 web_activity: sub with zero web visits -> 'not_has_done' evaluates to TRUE", function() use ($pdo, $actSubId2) {
        $sub = ['id' => $actSubId2];
        $cond = [['field' => 'web_activity', 'operator' => 'not_has_done', 'page_url' => 'tuyen-sinh-2026', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId2, $sub, $cond) === true;
    });

    run_test("5.2.5 web_activity: sub with zero web visits -> 'has_done' evaluates to FALSE", function() use ($pdo, $actSubId2) {
        $sub = ['id' => $actSubId2];
        $cond = [['field' => 'web_activity', 'operator' => 'has_done', 'page_url' => 'tuyen-sinh-2026', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $actSubId2, $sub, $cond) === false;
    });

} finally {
    // Cleanup temporary DB activity
    $pdo->prepare("DELETE FROM subscriber_activity WHERE subscriber_id IN (?, ?)")->execute([$actSubId1, $actSubId2]);
}

echo "\n";

// ====================================================================
// SUITE 6: ADVERSARIAL NESTED & EDGE CASE CONDITIONS
// ====================================================================
echo "▶ Suite 6: Adversarial Nested Conditions & Complex Combinations\n";

run_test("6.1 Nested condition groups: (Tag=VIP OR erp_is_student=is_true) AND (lead_score not_equals 0)", function() use ($pdo) {
    $sub = [
        'id' => 'sub_nested_01',
        'tags_array' => ['VIP'],
        'erp_is_student' => 'no',
        'lead_score' => '15'
    ];
    $condGroup = [
        'logic' => 'AND',
        'conditions' => [
            [
                'logic' => 'OR',
                'conditions' => [
                    ['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP'],
                    ['field' => 'erp_is_student', 'operator' => 'is_true', 'value' => '']
                ]
            ],
            [
                'field' => 'lead_score', 'operator' => 'not_equals', 'value' => '0'
            ]
        ]
    ];
    return evaluateAdvancedConditionGroup($pdo, 'sub_nested_01', $sub, $condGroup) === true;
});

run_test("6.2 Nested condition groups: Fails when inner AND branch fails", function() use ($pdo) {
    $sub = [
        'id' => 'sub_nested_02',
        'tags_array' => ['VIP'],
        'erp_is_student' => 'no',
        'lead_score' => '0' // fails not_equals 0
    ];
    $condGroup = [
        'logic' => 'AND',
        'conditions' => [
            [
                'logic' => 'OR',
                'conditions' => [
                    ['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP'],
                    ['field' => 'erp_is_student', 'operator' => 'is_true', 'value' => '']
                ]
            ],
            [
                'field' => 'lead_score', 'operator' => 'not_equals', 'value' => '0'
            ]
        ]
    ];
    return evaluateAdvancedConditionGroup($pdo, 'sub_nested_02', $sub, $condGroup) === false;
});

run_test("6.3 Empty conditions array returns false safely without throwing exception", function() use ($pdo) {
    return evaluateAdvancedConditionGroup($pdo, 'sub_empty', [], []) === false;
});

run_test("6.4 Null/malformed values in subscriber profile do not trigger fatal errors", function() use ($pdo) {
    $sub = [
        'id' => 'sub_malformed',
        'tags_array' => null,
        'erp_is_student' => null,
        'lead_score' => null,
        'city' => null
    ];
    $cond = [
        ['field' => 'tag', 'operator' => 'not_has_tag', 'value' => 'VIP'],
        ['field' => 'erp_is_student', 'operator' => 'is_false', 'value' => ''],
        ['field' => 'city', 'operator' => 'is_empty', 'value' => '']
    ];
    return evaluateAdvancedConditionGroup($pdo, 'sub_malformed', $sub, $cond) === true;
});

echo "\n";

// ====================================================================
// SUITE 7: ADVANCED BOUNDARIES, STRING/JSON FORMATS & CUSTOM ATTRIBUTES
// ====================================================================
echo "▶ Suite 7: Boundary Formats, Custom Attributes & SARGable History\n";

// 7.1 tags_array string formats (JSON string and comma-separated string)
run_test("7.1 tags_array passed as JSON string '[\"VIP\", \"Leader\"]' parses and matches 'has_tag'", function() use ($pdo) {
    $sub = ['id' => 'sub_fmt_01', 'tags_array' => '["VIP", "Leader"]'];
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'Leader']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_fmt_01', $sub, $cond) === true;
});

run_test("7.2 tags_array passed as comma-separated string 'VIP, Leader' parses and matches 'has_tag'", function() use ($pdo) {
    $sub = ['id' => 'sub_fmt_02', 'tags_array' => 'VIP, Leader'];
    $cond = [['field' => 'tag', 'operator' => 'has_tag', 'value' => 'VIP']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_fmt_02', $sub, $cond) === true;
});

// 7.3 Numeric string boundary formatting
run_test("7.3 lead_score with whitespace padding '  15.0  ' vs '15' with not_equals evaluates to FALSE", function() use ($pdo) {
    $sub = ['id' => 'sub_fmt_03', 'lead_score' => '  15.0  '];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '15']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_fmt_03', $sub, $cond) === false;
});

run_test("7.4 lead_score in scientific/exponential notation '1e2' vs '100' with not_equals evaluates to FALSE", function() use ($pdo) {
    $sub = ['id' => 'sub_fmt_04', 'lead_score' => '1e2'];
    $cond = [['field' => 'lead_score', 'operator' => 'not_equals', 'value' => '100']];
    return evaluateAdvancedConditionGroup($pdo, 'sub_fmt_04', $sub, $cond) === false;
});

// 7.5 Custom attributes JSON evaluation in evaluateAdvancedConditionGroup
run_test("7.5 custom_attributes JSON field in evaluateAdvancedConditionGroup", function() use ($pdo) {
    $sub = [
        'id' => 'sub_cust_01',
        'custom_attributes' => json_encode(['hobby' => 'Tennis', 'experience_years' => 5])
    ];
    $cond = [
        ['field' => 'custom_field', 'key' => 'hobby', 'operator' => 'equals', 'value' => 'tennis']
    ];
    return evaluateAdvancedConditionGroup($pdo, 'sub_cust_01', $sub, $cond) === true;
});

// 7.6 Custom attributes in isSubscriberMatch
run_test("7.6 custom_attributes JSON field in isSubscriberMatch", function() {
    $sub = [
        'id' => 'sub_cust_02',
        'email' => 'custom@ideas.edu.vn',
        'custom_attributes' => json_encode(['tier' => 'Platinum', 'years' => 3])
    ];
    $criteria = [
        ['conditions' => [
            ['field' => 'tier', 'operator' => 'equals', 'value' => 'Platinum']
        ]]
    ];
    return isSubscriberMatch($sub, $criteria) === true;
});

// 7.7 Activity history matching with NULL details and multiple activity_types
$advActSubId = 'sub_adv_act_' . bin2hex(random_bytes(6));
try {
    $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, details, reference_name, reference_id, created_at) VALUES 
        (?, 99999, 'zns_delivered', NULL, 'ZNS Invoice #123', 'inv_123', NOW()),
        (?, 99999, 'form_submitted', 'Form Registration', 'Đăng ký học', 'form_01', DATE_SUB(NOW(), INTERVAL 20 DAY))
    ")->execute([$advActSubId, $advActSubId]);

    run_test("7.7.1 activity_history matches when details is NULL but type is 'zns_delivered'", function() use ($pdo, $advActSubId) {
        $sub = ['id' => $advActSubId];
        $cond = [['field' => 'activity_history', 'operator' => 'has_done', 'activity_type' => 'zns_delivered', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $advActSubId, $sub, $cond) === true;
    });

    run_test("7.7.2 activity_history matches comma-separated activity_types 'email_open, zns_delivered'", function() use ($pdo, $advActSubId) {
        $sub = ['id' => $advActSubId];
        $cond = [['field' => 'activity_history', 'operator' => 'has_done', 'activity_type' => 'email_open, zns_delivered', 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $advActSubId, $sub, $cond) === true;
    });

    run_test("7.7.3 activity_history with days lookback: 'form_submitted' 20 days ago fails when days=7", function() use ($pdo, $advActSubId) {
        $sub = ['id' => $advActSubId];
        $cond = [['field' => 'activity_history', 'operator' => 'has_done', 'activity_type' => 'form_submitted', 'days' => 7, 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $advActSubId, $sub, $cond) === false;
    });

    run_test("7.7.4 activity_history with days lookback: 'not_has_done' for 20-day-old activity returns TRUE when days=7", function() use ($pdo, $advActSubId) {
        $sub = ['id' => $advActSubId];
        $cond = [['field' => 'activity_history', 'operator' => 'not_has_done', 'activity_type' => 'form_submitted', 'days' => 7, 'value' => '']];
        return evaluateAdvancedConditionGroup($pdo, $advActSubId, $sub, $cond) === true;
    });

} finally {
    $pdo->prepare("DELETE FROM subscriber_activity WHERE subscriber_id = ?")->execute([$advActSubId]);
}

// 7.8 isSubscriberMatch boundary edge cases
run_test("7.8 isSubscriberMatch with empty criteria returns true (no filter)", function() {
    $sub = ['id' => 'sub_empty_crit', 'email' => 'test@ideas.edu.vn'];
    return isSubscriberMatch($sub, '') === true && isSubscriberMatch($sub, []) === true;
});

run_test("7.9 isSubscriberMatch with number comparisons: lead_score greater_than 50", function() {
    $subHigh = ['id' => 'sub_high', 'lead_score' => 75];
    $subLow = ['id' => 'sub_low', 'lead_score' => 25];
    $criteria = [['conditions' => [['field' => 'lead_score', 'operator' => 'greater_than', 'value' => '50']]]];
    return isSubscriberMatch($subHigh, $criteria) === true && isSubscriberMatch($subLow, $criteria) === false;
});

echo "\n====================================================================\n";
echo "SUMMARY OF RESULTS\n";
echo "====================================================================\n";
echo "Total Tests Run : $totalTests\n";
echo "Passed (PASS)   : $passedTests\n";
echo "Failed (FAIL)   : $failedTests\n";

if ($failedTests === 0) {
    echo "✔ ALL $totalTests ADVERSARIAL STRESS HARNESS TESTS PASSED WITH 100% SUCCESS RATE!\n";
    exit(0);
} else {
    echo "✖ $failedTests TEST(S) FAILED:\n";
    foreach ($failures as $f) {
        echo "  - " . $f['test'] . ": " . $f['error'] . "\n";
    }
    exit(1);
}
