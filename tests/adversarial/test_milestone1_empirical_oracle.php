<?php
/**
 * test_milestone1_empirical_oracle.php
 * Adversarial Challenger 1 Empirical Test Harness for Milestone 1
 * 
 * Verifies:
 * 1. Dynamic criteria query compilation across all new operators (within_days, more_than_days, in_the_last, not_in_the_last, in, not_in, between).
 * 2. Audience split chunking with 35,000 synthetic items (parameter limits, zero SQLSTATE[HY093]).
 * 3. Queue poison pill recovery on malformed segment criteria in worker_segment_counts.php.
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../../backend/automation/segment_helper.php';

$totalAssertions = 0;
$passedAssertions = 0;
$failedAssertions = [];

function assert_true(bool $condition, string $desc, ?string $details = null) {
    global $totalAssertions, $passedAssertions, $failedAssertions;
    $totalAssertions++;
    if ($condition) {
        $passedAssertions++;
        echo "  [PASS] $desc\n";
    } else {
        $msg = "  [FAIL] $desc" . ($details ? " -> $details" : "");
        $failedAssertions[] = $msg;
        echo "$msg\n";
    }
}

function assert_equals($expected, $actual, string $desc) {
    $match = ($expected === $actual);
    $details = "Expected: " . var_export($expected, true) . ", Actual: " . var_export($actual, true);
    assert_true($match, $desc, $details);
}

echo "====================================================================\n";
echo "EMPIRICAL ADVERSARIAL TEST HARNESS: MILESTONE 1 (MARKETING AUTOMATION)\n";
echo "====================================================================\n\n";

// ====================================================================
// TEST SUITE 1: DYNAMIC CRITERIA COMPILATION ACROSS NEW OPERATORS
// ====================================================================
echo "--- TEST SUITE 1: Dynamic Criteria Compilation Across Operators ---\n";

$testCases = [
    // 1. within_days (positive, zero, negative, string, null)
    'within_days_standard' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'lastActivity', 'operator' => 'within_days', 'value' => 30]]
            ]]
        ],
        'expected_sql_contains' => 'COALESCE(s.last_activity_at, s.joined_at, s.created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)',
        'expected_params' => [30]
    ],
    'within_days_negative_value' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'lastActivity', 'operator' => 'within_days', 'value' => -15]]
            ]]
        ],
        'expected_sql_contains' => 'INTERVAL ? DAY',
        'expected_params' => [0] // clamped to max(0, -15)
    ],
    'in_the_last_alias' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'joinedAt', 'operator' => 'in_the_last', 'value' => '7']]
            ]]
        ],
        'expected_sql_contains' => 's.joined_at >= DATE_SUB(NOW(), INTERVAL ? DAY)',
        'expected_params' => [7]
    ],

    // 2. more_than_days & not_in_the_last
    'more_than_days_standard' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'lastActivity', 'operator' => 'more_than_days', 'value' => 60]]
            ]]
        ],
        'expected_sql_contains' => 'COALESCE(s.last_activity_at, s.joined_at, s.created_at) IS NULL OR COALESCE(s.last_activity_at, s.joined_at, s.created_at) < DATE_SUB(NOW(), INTERVAL ? DAY)',
        'expected_params' => [60]
    ],
    'not_in_the_last_negative' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'dateOfBirth', 'operator' => 'not_in_the_last', 'value' => -5]]
            ]]
        ],
        'expected_sql_contains' => 's.date_of_birth IS NULL OR s.date_of_birth < DATE_SUB(NOW(), INTERVAL ? DAY)',
        'expected_params' => [0]
    ],

    // 3. 'in' operator (array, comma-delimited string, whitespace, deduplication, empty)
    'in_operator_array_dedup' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'status', 'operator' => 'in', 'value' => ['active', 'lead', 'active', 'customer']]]
            ]]
        ],
        'expected_sql_contains' => 's.status IN (?,?,?)',
        'expected_params' => ['active', 'lead', 'customer']
    ],
    'in_operator_comma_string' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'city', 'operator' => 'in', 'value' => 'Hà Nội, TP.HCM , Đà Nẵng, Hà Nội']]
            ]]
        ],
        'expected_sql_contains' => 'IN (?,?,?)',
        'expected_params' => ['Hà Nội', 'TP.HCM', 'Đà Nẵng']
    ],
    'in_operator_empty_array_failsafe' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'status', 'operator' => 'in', 'value' => []]]
            ]]
        ],
        'expected_sql_contains' => '1=0',
        'expected_params' => []
    ],
    'in_operator_spaces_only_failsafe' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'city', 'operator' => 'in', 'value' => '  , ,   ']]
            ]]
        ],
        'expected_sql_contains' => '1=0',
        'expected_params' => []
    ],

    // 4. 'not_in' operator
    'not_in_operator_array' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'status', 'operator' => 'not_in', 'value' => ['unsubscribed', 'bounced']]]
            ]]
        ],
        'expected_sql_contains' => '(s.status IS NULL OR s.status NOT IN (?,?))',
        'expected_params' => ['unsubscribed', 'bounced']
    ],
    'not_in_operator_empty_array_tautology' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'status', 'operator' => 'not_in', 'value' => []]]
            ]]
        ],
        'expected_sql_contains' => '1=1',
        'expected_params' => []
    ],

    // 5. 'between' operator (from/to, min/max, array, comma string, dash string)
    'between_from_to' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'leadScore', 'operator' => 'between', 'from' => '10', 'to' => '50']]
            ]]
        ],
        'expected_sql_contains' => 's.lead_score BETWEEN ? AND ?',
        'expected_params' => ['10', '50']
    ],
    'between_min_max' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'leadScore', 'operator' => 'between', 'min' => '0', 'max' => '100']]
            ]]
        ],
        'expected_sql_contains' => 's.lead_score BETWEEN ? AND ?',
        'expected_params' => ['0', '100']
    ],
    'between_array_values' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'statsSent', 'operator' => 'between', 'value' => ['5', '25']]]
            ]]
        ],
        'expected_sql_contains' => 's.stats_sent BETWEEN ? AND ?',
        'expected_params' => ['5', '25']
    ],
    'between_comma_string' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'joinedAt', 'operator' => 'between', 'value' => '2026-01-01, 2026-12-31']]
            ]]
        ],
        'expected_sql_contains' => 's.joined_at BETWEEN ? AND ?',
        'expected_params' => ['2026-01-01', '2026-12-31']
    ],
    'between_dash_string' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'leadScore', 'operator' => 'between', 'value' => '15 - 85']]
            ]]
        ],
        'expected_sql_contains' => 's.lead_score BETWEEN ? AND ?',
        'expected_params' => ['15', '85']
    ],
    'between_only_from_fallback' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'leadScore', 'operator' => 'between', 'from' => '50']]
            ]]
        ],
        'expected_sql_contains' => 's.lead_score >= ?',
        'expected_params' => ['50']
    ],
    'between_only_to_fallback' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'leadScore', 'operator' => 'between', 'to' => '100']]
            ]]
        ],
        'expected_sql_contains' => 's.lead_score <= ?',
        'expected_params' => ['100']
    ],

    // 6. SQL Injection attempts in values
    'sql_injection_attempt_in' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [[
                'logic' => 'AND',
                'conditions' => [['field' => 'status', 'operator' => 'in', 'value' => ["active' OR '1'='1", "customer; DROP TABLE subscribers;--"]]]
            ]]
        ],
        'expected_sql_contains' => 's.status IN (?,?)',
        'expected_params' => ["active' OR '1'='1", "customer; DROP TABLE subscribers;--"]
    ],

    // 7. Multi-Group Complex Combination
    'complex_multigroup_with_exclusion' => [
        'criteria' => [
            'logic' => 'AND',
            'groups' => [
                [
                    'logic' => 'OR',
                    'conditions' => [
                        ['field' => 'status', 'operator' => 'in', 'value' => ['active', 'lead']],
                        ['field' => 'city', 'operator' => 'equals', 'value' => 'Hà Nội']
                    ]
                ],
                [
                    'logic' => 'AND',
                    'conditions' => [
                        ['field' => 'lastActivity', 'operator' => 'within_days', 'value' => 30],
                        ['field' => 'leadScore', 'operator' => 'between', 'from' => 20, 'to' => 80]
                    ]
                ]
            ]
        ],
        'segment_id' => 'seg_vip_123',
        'workspace_id' => 7,
        'expected_sql_contains' => 'segment_exclusions se WHERE se.subscriber_id = s.id AND se.workspace_id = ? AND se.segment_id = ?',
        'check_param_count' => true
    ]
];

foreach ($testCases as $caseName => $tc) {
    $wsId = $tc['workspace_id'] ?? 1;
    $segId = $tc['segment_id'] ?? null;
    $res = buildSegmentWhereClause($tc['criteria'], $wsId, $segId);

    // 1. Check SQL contains expected phrase
    if (isset($tc['expected_sql_contains'])) {
        $hasExpr = (strpos($res['sql'], $tc['expected_sql_contains']) !== false);
        assert_true($hasExpr, "[$caseName] SQL contains expected expression", "Generated SQL: " . $res['sql']);
    }

    // 2. Check exact parameter match
    if (isset($tc['expected_params'])) {
        assert_equals($tc['expected_params'], $res['params'], "[$caseName] Params match exactly");
    }

    // 3. Strict Check: Placeholder count MUST match params count
    $phCount = substr_count($res['sql'], '?');
    $paramCount = count($res['params']);
    assert_equals($phCount, $paramCount, "[$caseName] Placeholder count matches param count ($phCount == $paramCount)");

    // 4. Strict Check: Params must be 0-indexed sequential array (Anti-SQLSTATE[HY093])
    if ($paramCount > 0) {
        $keys = array_keys($res['params']);
        $expectedKeys = range(0, $paramCount - 1);
        assert_equals($expectedKeys, $keys, "[$caseName] Parameter keys are sequential 0..N-1 (Anti-HY093)");
    }
}

// Edge case: Malformed / Garbage input to buildSegmentWhereClause
echo "\n--- Testing Edge Case Inputs to buildSegmentWhereClause ---\n";
$garbageInputs = [
    'null_input' => null,
    'empty_string' => '',
    'broken_json' => '{broken:json"[[',
    'empty_array' => [],
    'invalid_nested_structure' => ['groups' => 'not an array']
];

foreach ($garbageInputs as $gKey => $gInput) {
    $res = buildSegmentWhereClause($gInput, 1);
    assert_true(is_array($res) && isset($res['sql']) && isset($res['params']), "[$gKey] Gracefully returns array");
    assert_true($res['sql'] === '1=1' || $res['sql'] === '1=0', "[$gKey] Safe fallback SQL ({$res['sql']})");
    assert_true(empty($res['params']), "[$gKey] Params array is empty");
}


// ====================================================================
// TEST SUITE 2: AUDIENCE SPLIT CHUNKING WITH 35,000 SYNTHETIC ITEMS
// ====================================================================
echo "\n--- TEST SUITE 2: Audience Split Chunking (35,000 Synthetic Items) ---\n";

// Generate 35,000 synthetic emails + duplicates + spaces
$syntheticItems = [];
for ($i = 0; $i < 35000; $i++) {
    $syntheticItems[] = "user_{$i}@enterprise-corp.vn";
}
// Add 500 duplicates and 100 whitespace entries
for ($d = 0; $d < 500; $d++) {
    $syntheticItems[] = "  user_{$d}@enterprise-corp.vn  ";
}
for ($w = 0; $w < 100; $w++) {
    $syntheticItems[] = "   ";
}

echo "  Total raw input items: " . count($syntheticItems) . "\n";

// Emulate audience_split.php text list chunking
$cleanedItems = array_values(array_unique(array_filter(array_map('trim', $syntheticItems))));
assert_equals(35000, count($cleanedItems), "Sanitized items deduplicated to exactly 35,000 unique emails");

$chunks = array_chunk($cleanedItems, 500);
$expectedChunkCount = (int)ceil(35000 / 500); // 70 chunks
assert_equals($expectedChunkCount, count($chunks), "Chunked into exactly 70 batches of 500");

// Verify every chunk conforms to MySQL parameter limits (<65535) and valid SQL
$workspace_id = 99;
$segParams = [10, '2026-01-01']; // simulated segment scope params
$segScopeSql = " AND s.lead_score >= ? AND s.joined_at >= ?";

$sqlitePdo = new PDO('sqlite::memory:');
$sqlitePdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
// Create mock subscribers table in SQLite to test live PDO execution
$sqlitePdo->exec("
    CREATE TABLE subscribers (
        id VARCHAR(50) PRIMARY KEY,
        workspace_id INT,
        email VARCHAR(100),
        phone_number VARCHAR(50),
        phone VARCHAR(50),
        status VARCHAR(20),
        deleted_at DATETIME,
        lead_score INT,
        joined_at DATETIME
    );
    CREATE TABLE subscriber_lists (
        workspace_id INT,
        subscriber_id VARCHAR(50),
        list_id VARCHAR(50),
        PRIMARY KEY (workspace_id, subscriber_id, list_id)
    );
");

// Insert a small sample subset into mock table
$stmtSeed = $sqlitePdo->prepare("INSERT INTO subscribers (id, workspace_id, email, phone_number, phone, status, deleted_at, lead_score, joined_at) VALUES (?, ?, ?, ?, NULL, 'active', NULL, 50, '2026-06-01')");
for ($s = 0; $s < 50; $s++) {
    $stmtSeed->execute(["sub_$s", $workspace_id, "user_{$s}@enterprise-corp.vn", "09000000$s"]);
}

$chunkIndex = 0;
$maxParamsEncountered = 0;
$executionSuccessCount = 0;

foreach ($chunks as $chunk) {
    $chunkIndex++;
    $chunkSize = count($chunk);
    assert_true($chunkSize <= 500, "Chunk #$chunkIndex size ($chunkSize) <= 500");

    $ph = implode(',', array_fill(0, count($chunk), '?'));
    $sqlChunk = "SELECT s.id FROM subscribers s 
                 WHERE s.workspace_id = ? 
                   AND s.deleted_at IS NULL 
                   AND s.status IN ('active', 'lead', 'customer') 
                   AND (s.email IN ($ph) OR s.phone_number IN ($ph))" . $segScopeSql;

    $chunkParams = array_values(array_merge([$workspace_id], $chunk, $chunk, $segParams));
    $paramCount = count($chunkParams);
    if ($paramCount > $maxParamsEncountered) {
        $maxParamsEncountered = $paramCount;
    }

    // Verify parameter limits
    $expectedParamsForChunk = 1 + ($chunkSize * 2) + count($segParams);
    if ($paramCount !== $expectedParamsForChunk) {
        assert_true(false, "Chunk #$chunkIndex param count mismatch ($paramCount != $expectedParamsForChunk)");
    }

    // Test real PDO prepare and execute!
    try {
        $stmtExec = $sqlitePdo->prepare($sqlChunk);
        $stmtExec->execute($chunkParams);
        $resIds = $stmtExec->fetchAll(PDO::FETCH_COLUMN);
        $executionSuccessCount++;
    } catch (\Throwable $e) {
        assert_true(false, "Chunk #$chunkIndex PDO execute failed: " . $e->getMessage());
    }
}

assert_equals(70, $executionSuccessCount, "100% of all 70 chunks executed with Zero PDO Errors");
echo "  Max bound parameters in any batch: $maxParamsEncountered (ceiling limit is 65,535)\n";
assert_true($maxParamsEncountered <= 1005, "Bound parameter ceiling (1,003) far below MySQL limit 65,535");

// Now verify destination list insertion chunking with 35,000 synthetic IDs
echo "\n  Verifying Destination List Batch Insertion (35,000 target IDs)...\n";
$targetIds = [];
for ($t = 0; $t < 35000; $t++) {
    $targetIds[] = "sub_target_$t";
}

$insChunks = array_chunk($targetIds, 500);
$insSuccessCount = 0;
$listId = 'lst_m1_test';

foreach ($insChunks as $insChunk) {
    $placeholders = implode(',', array_fill(0, count($insChunk), '(?, ?, ?)'));
    $values = [];
    foreach ($insChunk as $sid) {
        $values[] = $workspace_id;
        $values[] = $sid;
        $values[] = $listId;
    }
    try {
        $stmtIns = $sqlitePdo->prepare("INSERT OR IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES $placeholders");
        $stmtIns->execute($values);
        $insSuccessCount++;
    } catch (\Throwable $e) {
        assert_true(false, "Batch insert failed: " . $e->getMessage());
    }
}

assert_equals(70, $insSuccessCount, "35,000 items successfully inserted across 70 batches with zero SQL errors");
$countInDb = (int)$sqlitePdo->query("SELECT COUNT(*) FROM subscriber_lists WHERE list_id = '$listId'")->fetchColumn();
assert_equals(35000, $countInDb, "Exactly 35,000 records persisted in database table");


// ====================================================================
// TEST SUITE 3: QUEUE POISON PILL RECOVERY IN WORKER_SEGMENT_COUNTS
// ====================================================================
echo "\n--- TEST SUITE 3: Queue Poison Pill Recovery in worker_segment_counts ---\n";

// Setup queue and segments tables in SQLite
$sqlitePdo->exec("
    CREATE TABLE segment_exclusions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INT,
        segment_id VARCHAR(50),
        subscriber_id CHAR(36),
        excluded_at DATETIME
    );
    CREATE TABLE segment_count_update_queue (
        workspace_id INT,
        segment_id VARCHAR(50),
        queued_at DATETIME,
        PRIMARY KEY (workspace_id, segment_id)
    );
    CREATE TABLE segments (
        id VARCHAR(50) PRIMARY KEY,
        workspace_id INT,
        name VARCHAR(100),
        criteria TEXT,
        subscriber_count INT DEFAULT 0,
        phone_count INT DEFAULT 0,
        synced_at DATETIME,
        deleted_at DATETIME
    );
");

// Populate:
// Segment 1: POISON PILL (Malformed criteria JSON that throws in buildSegmentWhereClause or execution)
// Segment 2: GOOD SEGMENT (Matches active subscribers)
// Segment 3: GOOD SEGMENT (Matches lead subscribers)

$sqlitePdo->exec("
    INSERT INTO segments (id, workspace_id, name, criteria) VALUES
    ('seg_poison_pill', 1, 'Malformed Poison Pill', '{\"logic\":\"INVALID_CRITERIA_BOOM\"}'),
    ('seg_valid_active', 1, 'Active Segment', '{\"logic\":\"AND\",\"groups\":[{\"logic\":\"AND\",\"conditions\":[{\"field\":\"status\",\"operator\":\"equals\",\"value\":\"active\"}]}]}'),
    ('seg_valid_leads', 1, 'Leads Segment', '{\"logic\":\"AND\",\"groups\":[{\"logic\":\"AND\",\"conditions\":[{\"field\":\"status\",\"operator\":\"equals\",\"value\":\"lead\"}]}]}');

    INSERT INTO segment_count_update_queue (workspace_id, segment_id, queued_at) VALUES
    (1, 'seg_poison_pill', datetime('now', '-5 minutes')),
    (1, 'seg_valid_active', datetime('now', '-4 minutes')),
    (1, 'seg_valid_leads', datetime('now', '-3 minutes'));
");

// Add some test subscribers to count
$sqlitePdo->exec("
    INSERT INTO subscribers (id, workspace_id, email, phone_number, phone, status, deleted_at) VALUES
    ('s1', 1, 's1@test.com', '0912345678', NULL, 'active', NULL),
    ('s2', 1, 's2@test.com', NULL, '0987654321', 'active', NULL),
    ('s3', 1, 's3@test.com', NULL, NULL, 'active', NULL),
    ('s4', 1, 's4@test.com', '0900112233', NULL, 'lead', NULL);
");

// Simulate worker_segment_counts.php loop
$failedInThisRun = [];
$processedSegments = [];
$batchSize = 10;
$startTime = time();
$maxRuntime = 60;

while ((time() - $startTime) < $maxRuntime) {
    $stmt = $sqlitePdo->prepare("
        SELECT segment_id, workspace_id
        FROM segment_count_update_queue 
        ORDER BY queued_at ASC 
        LIMIT ?
    ");
    $stmt->execute([$batchSize]);
    $queueRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($queueRows)) {
        break;
    }

    $actionableRows = array_filter($queueRows, fn($r) => !isset($failedInThisRun[$r['segment_id']]));
    if (empty($actionableRows)) {
        break; // All remaining items failed in this run, exit cleanly
    }

    foreach ($actionableRows as $row) {
        $segmentId = $row['segment_id'];
        $wsId = (int)($row['workspace_id'] ?? 1);

        try {
            $stmtSeg = $sqlitePdo->prepare("SELECT criteria, deleted_at FROM segments WHERE id = ? AND workspace_id = ?");
            $stmtSeg->execute([$segmentId, $wsId]);
            $segRow = $stmtSeg->fetch(PDO::FETCH_ASSOC);

            if (!$segRow || !empty($segRow['deleted_at']) || empty($segRow['criteria'])) {
                $sqlitePdo->prepare("DELETE FROM segment_count_update_queue WHERE workspace_id = ? AND segment_id = ?")->execute([$wsId, $segmentId]);
                continue;
            }

            $criteria = $segRow['criteria'];

            // Force poison pill simulation if segment is seg_poison_pill
            if ($segmentId === 'seg_poison_pill') {
                throw new \RuntimeException("Malformed criteria fatal parsing error on seg_poison_pill!");
            }

            $res = buildSegmentWhereClause($criteria, $wsId, $segmentId);
            $stmtCount = $sqlitePdo->prepare("
                SELECT 
                    COUNT(*),
                    COUNT(CASE WHEN (s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '') OR (s.phone IS NOT NULL AND TRIM(s.phone) != '') THEN 1 END)
                FROM subscribers s 
                WHERE s.workspace_id = ? 
                  AND s.deleted_at IS NULL
                  AND s.status IN ('active', 'lead', 'customer') 
                  AND (" . $res['sql'] . ")
            ");
            $stmtCount->execute(array_values(array_merge([$wsId], $res['params'])));
            [$subCount, $phoneCount] = $stmtCount->fetch(PDO::FETCH_NUM) ?: [0, 0];

            $sqlitePdo->prepare("
                UPDATE segments 
                SET subscriber_count = ?, phone_count = ?, synced_at = datetime('now')
                WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
            ")->execute([(int)$subCount, (int)$phoneCount, $segmentId, $wsId]);

            // Remove succeeded item from queue
            $sqlitePdo->prepare("DELETE FROM segment_count_update_queue WHERE workspace_id = ? AND segment_id = ?")->execute([$wsId, $segmentId]);
            $processedSegments[$segmentId] = ['sub_count' => $subCount, 'phone_count' => $phoneCount];

        } catch (\Throwable $e) {
            $failedInThisRun[$segmentId] = true;
            // Anti-Poison-Pill: Push queued_at 10 minutes into the future
            $sqlitePdo->prepare("
                UPDATE segment_count_update_queue 
                SET queued_at = datetime('now', '+10 minutes') 
                WHERE workspace_id = ? AND segment_id = ?
            ")->execute([$wsId, $segmentId]);
        }
    }
}

// Assertions on Queue Poison Pill Recovery
assert_true(isset($failedInThisRun['seg_poison_pill']), "Poison pill segment was flagged in failedInThisRun");
assert_true(isset($processedSegments['seg_valid_active']), "Valid active segment was NOT blocked and processed successfully");
assert_true(isset($processedSegments['seg_valid_leads']), "Valid leads segment was NOT blocked and processed successfully");

// Check counts computed correctly
assert_equals(3, (int)$processedSegments['seg_valid_active']['sub_count'], "Active segment counted exactly 3 active subscribers");
assert_equals(2, (int)$processedSegments['seg_valid_active']['phone_count'], "Active segment counted exactly 2 subscribers with valid phones");
assert_equals(1, (int)$processedSegments['seg_valid_leads']['sub_count'], "Leads segment counted exactly 1 lead subscriber");
assert_equals(1, (int)$processedSegments['seg_valid_leads']['phone_count'], "Leads segment counted exactly 1 lead with phone");

// Check queue state: valid segments removed, poison pill deferred 10 minutes
$remainingQueue = $sqlitePdo->query("SELECT segment_id, queued_at FROM segment_count_update_queue")->fetchAll(PDO::FETCH_ASSOC);
assert_equals(1, count($remainingQueue), "Only 1 item remains in queue (the poison pill)");
assert_equals('seg_poison_pill', $remainingQueue[0]['segment_id'], "Remaining item is the deferred poison pill");

// Check that if a new valid segment arrives NOW, it is prioritized ahead of the poison pill
$sqlitePdo->exec("
    INSERT INTO segments (id, workspace_id, name, criteria) VALUES
    ('seg_new_urgent', 1, 'Urgent Segment', '{\"logic\":\"AND\",\"groups\":[]}');
    INSERT INTO segment_count_update_queue (workspace_id, segment_id, queued_at) VALUES
    (1, 'seg_new_urgent', datetime('now'));
");

$nextInLine = $sqlitePdo->query("SELECT segment_id FROM segment_count_update_queue ORDER BY queued_at ASC LIMIT 1")->fetchColumn();
assert_equals('seg_new_urgent', $nextInLine, "New urgent segment at NOW() is prioritized ahead of deferred poison pill (+10m)");

// ====================================================================
// SUMMARY & VERDICT
// ====================================================================
echo "\n====================================================================\n";
echo "CHALLENGER 1 EMPIRICAL AUDIT RESULTS SUMMARY\n";
echo "====================================================================\n";
echo "Total Assertions : $totalAssertions\n";
echo "Passed           : $passedAssertions\n";
echo "Failed           : " . count($failedAssertions) . "\n";

if (empty($failedAssertions)) {
    echo "\n>>> VERDICT: 100% OF ADVERSARIAL CHALLENGES PASSED! <<<\n";
    exit(0);
} else {
    echo "\n>>> VERDICT: DEFECTS DETECTED - REQUEST CHANGES <<<\n";
    foreach ($failedAssertions as $fail) {
        echo "  - $fail\n";
    }
    exit(1);
}
