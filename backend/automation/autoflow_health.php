<?php
/**
 * AutoFlow Master Health Check v2 — Full-Stack Deep Audit
 * Covers: Code correctness, DB integrity, table health, worker liveness, conflict detection.
 * GET ?admin_token=autoflow-admin-001
 * DELETE AFTER USE.
 */
require_once __DIR__ . '/db_connect.php';
require_once 'auth_middleware.php';
$isCli = php_sapi_name() === 'cli';
$adminToken = $_GET['admin_token'] ?? '';
$validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : 'autoflow-admin-001';

if (!$isCli && $adminToken !== $validBypassToken && ($GLOBALS['current_admin_id'] ?? '') !== 'admin-001') {
    http_response_code(403);
    die(json_encode(['success' => false, 'error' => 'Unauthorized: Valid admin_token is required for HTTP access.']));
}

header('Content-Type: application/json; charset=utf-8');
set_time_limit(90);

$report = ['generated_at' => date('Y-m-d H:i:s'), 'sections' => []];

function chk($label, $status, $value, $detail = '') { return compact('label','status','value','detail'); }
function sec($name, $items) { return compact('name','items'); }

// Helper: count non-comment occurrences of a pattern in PHP source
function countInCode($src, $pattern) {
    $lines = explode("\n", $src);
    $count = 0;
    foreach ($lines as $line) {
        $trimmed = ltrim($line);
        if (strncmp($trimmed, '//', 2) === 0 || strncmp($trimmed, '*', 1) === 0 || strncmp($trimmed, '/*', 2) === 0) continue;
        if (strpos($line, $pattern) !== false) $count++;
    }
    return $count;
}

// Load source files
$FILES = [
    'FlowExecutor'            => @file_get_contents(__DIR__ . '/FlowExecutor.php'),
    'Mailer'                  => @file_get_contents(__DIR__ . '/Mailer.php'),
    'webhook'                 => @file_get_contents(__DIR__ . '/webhook.php'),
    'worker_priority'         => @file_get_contents(__DIR__ . '/worker_priority.php'),
    'worker_flow'             => @file_get_contents(__DIR__ . '/worker_flow.php'),
    'worker_campaign'         => @file_get_contents(__DIR__ . '/worker_campaign.php'),
    'worker_tracking_aggregator' => @file_get_contents(__DIR__ . '/worker_tracking_aggregator.php'),
    'flow_helpers'            => @file_get_contents(__DIR__ . '/flow_helpers.php'),
    'trigger_helper'          => @file_get_contents(__DIR__ . '/trigger_helper.php'),
    'zalo_helpers'            => @file_get_contents(__DIR__ . '/zalo_helpers.php'),
    'db_connect'              => @file_get_contents(__DIR__ . '/db_connect.php'),
];

// --- 1. CODE FIX VERIFICATION (Non-comment line checks) ----------------------
$items = [];

// BUG-C2: A/B split test uses abs(crc32) not hexdec
$items[] = chk('BUG-C2 A/B split: abs(crc32()) used',
    countInCode($FILES['FlowExecutor'], 'abs(crc32(') >= 1 ? 'PASS' : 'FAIL',
    countInCode($FILES['FlowExecutor'], 'abs(crc32(') . ' occurrence(s)',
    'Was hexdec() — can overflow on 32-bit ? always Path B');

// BUG-H3: sentInSession incremented exactly once (in dispatchRaw, NOT in sendViaPHPMailer)
$smCount = countInCode($FILES['Mailer'], '$this->sentInSession++');
$items[] = chk('BUG-H3 SMTP sentInSession: exactly 1 increment in code (excl. comments)',
    $smCount === 1 ? 'PASS' : 'FAIL',
    "Found $smCount non-comment line(s) with sentInSession++",
    $smCount !== 1 ? 'Expected only in dispatchRaw(). Second one causes double-count ? reconnect at 250 not 500' : '');

// BUG-C1: ZNS seen verifies campaign before UPDATE
$items[] = chk('BUG-C1 ZNS seen: verifies campaign ID before UPDATE',
    strpos($FILES['webhook'], 'stmtVerifyCamp') !== false ? 'PASS' : 'FAIL',
    strpos($FILES['webhook'], 'stmtVerifyCamp') !== false ? 'Guard present' : 'MISSING');

// BUG-C3: Holiday scenario uses ensureZaloToken
$items[] = chk('BUG-C3 Holiday scenario: ensureZaloToken() used',
    strpos($FILES['webhook'], 'freshHolidayToken') !== false ? 'PASS' : 'FAIL',
    strpos($FILES['webhook'], 'freshHolidayToken') !== false ? 'Present' : 'MISSING');

// BUG-H4: GET_LOCK result is checked
$items[] = chk('BUG-H4 GET_LOCK return value checked',
    countInCode($FILES['webhook'], 'lockResult') >= 1 ? 'PASS' : 'FAIL',
    countInCode($FILES['webhook'], 'lockResult') . ' reference(s)');

// QUAL-5: delete_contact cleans orphan tables
$feHasMailLog  = countInCode($FILES['FlowExecutor'], 'DELETE FROM mail_delivery_logs');
$feHasActBuf   = countInCode($FILES['FlowExecutor'], 'DELETE FROM activity_buffer');
$items[] = chk('QUAL-5 delete_contact: mail_delivery_logs cleanup',
    $feHasMailLog >= 1 ? 'PASS' : 'FAIL', "$feHasMailLog line(s)");
$items[] = chk('QUAL-5 delete_contact: activity_buffer cleanup',
    $feHasActBuf >= 1 ? 'PASS' : 'FAIL', "$feHasActBuf line(s)");

// QUAL-4: webhook debug log is conditional (POST only)
$items[] = chk('QUAL-4 webhook debug log: conditional POST-only',
    countInCode($FILES['webhook'], "\$method === 'POST'") >= 1 ? 'PASS' : 'FAIL', '');

// BUG-H5: allowMultiple pre-initialized in worker_priority
$items[] = chk('BUG-H5 worker_priority: allowMultiple pre-initialized',
    strpos($FILES['worker_priority'], 'Initialize defaults BEFORE') !== false ? 'PASS' : 'FAIL', '');

// WORKER_FLOW: SET SESSION innodb_lock_wait_timeout (fail-fast)
$items[] = chk('worker_flow.php: SET SESSION innodb_lock_wait_timeout = 5',
    countInCode($FILES['worker_flow'], 'innodb_lock_wait_timeout') >= 1 ? 'PASS' : 'WARN',
    countInCode($FILES['worker_flow'], 'innodb_lock_wait_timeout') . ' reference(s)',
    'Workers should override global 50s timeout to 5s per-session');

// WORKER_CAMPAIGN: SET SESSION innodb_lock_wait_timeout
$items[] = chk('worker_campaign.php: SET SESSION innodb_lock_wait_timeout',
    countInCode($FILES['worker_campaign'], 'innodb_lock_wait_timeout') >= 1 ? 'PASS' : 'WARN',
    countInCode($FILES['worker_campaign'], 'innodb_lock_wait_timeout') . ' reference(s)');

// WORKER_PRIORITY: same
$items[] = chk('worker_priority.php: SET SESSION innodb_lock_wait_timeout',
    countInCode($FILES['worker_priority'], 'innodb_lock_wait_timeout') >= 1 ? 'PASS' : 'WARN',
    countInCode($FILES['worker_priority'], 'innodb_lock_wait_timeout') . ' reference(s)');

// MAILER: SMTP keep-alive (sentInSession pooling threshold at 500)
$items[] = chk('Mailer.php: SMTP pool size >= 500',
    strpos($FILES['Mailer'], '>= 500') !== false ? 'PASS' : 'WARN',
    'was 200; should be 500 after perf upgrade');

// FLOW_HELPERS: Activity buffer auto-flush threshold
$items[] = chk('flow_helpers.php: activity buffer auto-flush at 150',
    strpos($FILES['flow_helpers'], '>= 150') !== false ? 'PASS' : 'WARN',
    'Prevents max_allowed_packet overload on bulk campaigns');

// WORKER_TRACKING: checkStrategicIndexes re-add risk — verify it won't re-add dropped indexes
$dangerIdx = ['idx_sub_type_date', 'idx_sub_flow_status', 'idx_flow_states_processing'];
$trackSrc = $FILES['worker_tracking_aggregator'];
$foundDanger = [];
foreach ($dangerIdx as $di) {
    if (strpos($trackSrc, $di) !== false) $foundDanger[] = $di;
}
$items[] = chk('worker_tracking_aggregator: checkStrategicIndexes() won\'t re-add dropped indexes',
    empty($foundDanger) ? 'PASS' : 'WARN',
    empty($foundDanger) ? 'No conflicts' : 'References dropped index names: ' . implode(', ', $foundDanger),
    empty($foundDanger) ? '' : 'checkStrategicIndexes() may auto-recreate these indexes on 1% of runs');

$report['sections'][] = sec('Code Fix Verification', $items);

// --- 2. CONFLICT DETECTION BETWEEN FILES -------------------------------------
$items = [];

// Check: worker_flow and worker_campaign both release mailer connection
$items[] = chk('worker_flow.php: mailer->closeConnection() called on exit',
    strpos($FILES['worker_flow'], 'closeConnection') !== false ? 'PASS' : 'WARN', '');
$items[] = chk('worker_campaign.php: mailer->closeConnection() called on exit',
    strpos($FILES['worker_campaign'], 'closeConnection') !== false ? 'PASS' : 'WARN', '');

// Check: both workers flush activity buffer
$items[] = chk('worker_flow.php: flushActivityLogBuffer() called',
    strpos($FILES['worker_flow'], 'flushActivityLogBuffer') !== false ? 'PASS' : 'WARN', '');
$items[] = chk('worker_campaign.php: flushActivityLogBuffer() or equivalent',
    strpos($FILES['worker_campaign'], 'flushActivityLogBuffer') !== false ? 'PASS' : 'WARN', '');

// Check: FlowExecutor flushStatsBuffer called from workers
$items[] = chk('worker_flow.php: executor->flushStatsBuffer() called',
    strpos($FILES['worker_flow'], 'flushStatsBuffer') !== false ? 'PASS' : 'WARN', '');

// Check: stats_update_buffer target_table whitelist includes 'zalo_subscribers'
// (worker_tracking_aggregator line 580 has a comment warning about this)
$items[] = chk('worker_tracking_aggregator: zalo_subscribers in target_table whitelist',
    strpos($FILES['worker_tracking_aggregator'], "'zalo_subscribers'") !== false ? 'PASS' : 'FAIL',
    strpos($FILES['worker_tracking_aggregator'], "'zalo_subscribers'") !== false ? 'Present' : 'MISSING — zalo stat increments silently skipped',
    'FlowExecutor inserts zalo_subscribers; aggregator must accept it');

// Check: flow_helpers.php uses SAVEPOINT-safe voucher claim
$items[] = chk('flow_helpers.php: Voucher claim uses SAVEPOINT or inTransaction guard',
    strpos($FILES['flow_helpers'], 'inTransaction') !== false ? 'PASS' : 'WARN',
    'inTransaction() check ensures FOR UPDATE runs inside a transaction');

// Check: webhook.php uses fastcgi_finish_request (non-blocking response)
$items[] = chk('webhook.php: fastcgi_finish_request() for non-blocking response',
    strpos($FILES['webhook'], 'fastcgi_finish_request') !== false ? 'PASS' : 'WARN',
    strpos($FILES['webhook'], 'fastcgi_finish_request') !== false ? 'Present' : 'Missing — Zalo may timeout waiting for response');

// Check: worker_flow DOUBLE-LOCK guard present
$items[] = chk('worker_flow.php: DOUBLE-LOCK guard (re-read status before processing)',
    strpos($FILES['worker_flow'], 'DOUBLE-LOCK') !== false ? 'PASS' : 'WARN', '');

// Check: worker_flow STALE-GUARD (scheduled_at future check)
$items[] = chk('worker_flow.php: STALE-GUARD (scheduled_at > time() restore to waiting)',
    strpos($FILES['worker_flow'], 'STALE-GUARD') !== false ? 'PASS' : 'WARN', '');

// Check: worker_flow MAX_STEPS anti-infinite-loop
$items[] = chk('worker_flow.php: MAX_STEPS infinite loop guard',
    strpos($FILES['worker_flow'], 'MAX_STEPS') !== false ? 'PASS' : 'WARN', '');

// Check: zalo_helpers.php has ensureZaloToken function
$items[] = chk('zalo_helpers.php: ensureZaloToken() function exists',
    strpos($FILES['zalo_helpers'], 'function ensureZaloToken') !== false ? 'PASS' : 'FAIL',
    strpos($FILES['zalo_helpers'], 'function ensureZaloToken') !== false ? 'Present' : 'MISSING — BUG-C3 fix calls a non-existent function!');

$report['sections'][] = sec('Conflict Detection', $items);

// --- 3. MYSQL CONFIG (Workers override per-session, global is secondary) ------
$items = [];
$mv = [];
try {
    $stmt = $pdo->query("SHOW VARIABLES WHERE Variable_name IN (
        'innodb_lock_wait_timeout','max_connections','innodb_buffer_pool_size',
        'slow_query_log','long_query_time','max_allowed_packet','version'
    )");
    foreach ($stmt->fetchAll() as $r) $mv[$r['Variable_name']] = $r['Value'];
} catch(Exception $e){}

$lwt = (int)($mv['innodb_lock_wait_timeout'] ?? 50);
$items[] = chk('innodb_lock_wait_timeout (global)', $lwt <= 10 ? 'PASS' : 'INFO',
    "{$lwt}s",
    $lwt > 10 ? 'INFO: Workers SET SESSION to 5s. Global value only affects non-worker connections.' : '');

$items[] = chk('MySQL version', 'INFO', $mv['version'] ?? 'unknown');
$mc = (int)($mv['max_connections'] ?? 0);
$items[] = chk('max_connections', $mc >= 100 ? 'PASS' : 'WARN', "$mc");
$bp = round((int)($mv['innodb_buffer_pool_size'] ?? 0) / 1024 / 1024);
$items[] = chk('innodb_buffer_pool_size', $bp >= 128 ? 'PASS' : 'WARN', "{$bp} MB");
$items[] = chk('slow_query_log', ($mv['slow_query_log'] ?? 'OFF') === 'ON' ? 'PASS' : 'WARN',
    ($mv['slow_query_log'] ?? 'OFF') . " (threshold: " . ($mv['long_query_time'] ?? '?') . "s)");
$items[] = chk('max_allowed_packet', round((int)($mv['max_allowed_packet'] ?? 0)/1024/1024) >= 16 ? 'PASS' : 'WARN',
    round((int)($mv['max_allowed_packet'] ?? 0)/1024/1024) . ' MB');

$report['sections'][] = sec('MySQL Configuration', $items);

// --- 4. TABLE HEALTH (Fixed index count query) -------------------------------
$items = [];
try {
    $stmt = $pdo->query("
        SELECT table_name, table_rows,
            ROUND(data_length/1024/1024,2) AS data_mb,
            ROUND(index_length/1024/1024,2) AS idx_mb
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (
            'subscribers','campaigns','flows','subscriber_flow_states',
            'subscriber_activity','mail_delivery_logs','activity_buffer',
            'zalo_message_queue','voucher_codes','raw_event_buffer',
            'stats_update_buffer','timestamp_buffer','zalo_delivery_logs'
          )
        ORDER BY data_length DESC
    ");
    foreach ($stmt->fetchAll() as $r) {
        $ratio = $r['data_mb'] > 0 ? round($r['idx_mb'] / $r['data_mb'], 1) : 0;
        $st = ($ratio > 8 && $r['data_mb'] > 0.5) ? 'WARN' : 'PASS';
        $items[] = chk("Table: {$r['table_name']}", $st,
            "~" . number_format($r['table_rows']) . " rows | data={$r['data_mb']}MB | idx={$r['idx_mb']}MB",
            $ratio > 8 && $r['data_mb'] > 0.5 ? "Index/data ratio {$ratio}x — further dedup possible" : '');
    }

    // Fixed: COUNT DISTINCT index names, not rows
    $idxStmt = $pdo->query("
        SELECT TABLE_NAME,
               COUNT(DISTINCT INDEX_NAME) AS idx_count,
               SUM(CASE WHEN INDEX_NAME != 'PRIMARY' THEN 1 ELSE 0 END) AS col_entries
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('subscriber_flow_states','subscriber_activity','subscribers','mail_delivery_logs')
        GROUP BY TABLE_NAME
        ORDER BY idx_count DESC
    ");
    foreach ($idxStmt->fetchAll() as $r) {
        $ok = (int)$r['idx_count'] <= 22;
        $items[] = chk("Distinct indexes: {$r['TABLE_NAME']}", $ok ? 'PASS' : 'WARN',
            "{$r['idx_count']} indexes",
            !$ok ? 'Consider further deduplication (>22 indexes is excessive)' : '');
    }

    // Check required buffer tables exist
    foreach (['raw_event_buffer','activity_buffer','stats_update_buffer','timestamp_buffer'] as $bt) {
        $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$bt'")->fetchColumn();
        $items[] = chk("Buffer table exists: $bt", $exists ? 'PASS' : 'FAIL', $exists ? 'Exists' : 'MISSING — workers will crash');
    }

    // stats_update_buffer: verify target_table column type (ENUM vs VARCHAR)
    try {
        $colType = $pdo->query("
            SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stats_update_buffer' AND COLUMN_NAME='target_table'
        ")->fetchColumn();
        $isEnum = strpos(strtolower($colType ?? ''), 'enum') !== false;
        $items[] = chk('stats_update_buffer.target_table column type',
            !$isEnum ? 'PASS' : 'WARN',
            $colType ?? 'not found',
            $isEnum ? 'ENUM restricts to (campaigns,flows,subscribers) — zalo_subscribers inserts will silently fail. Run: ALTER TABLE stats_update_buffer MODIFY COLUMN target_table VARCHAR(50) NOT NULL' : '');
    } catch(Exception $e){ $items[] = chk('stats_update_buffer schema', 'WARN', $e->getMessage()); }

} catch(Exception $e){ $items[] = chk('Table health', 'FAIL', $e->getMessage()); }
$report['sections'][] = sec('Table Health', $items);

// --- 5. DATA INTEGRITY -------------------------------------------------------
$items = [];
try {
    // Orphan flow states
    $r = $pdo->query("SELECT COUNT(*) FROM subscriber_flow_states sfs LEFT JOIN subscribers s ON s.id = sfs.subscriber_id WHERE s.id IS NULL")->fetchColumn();
    $items[] = chk('Orphan flow states (subscriber deleted)', $r == 0 ? 'PASS' : 'WARN', "$r rows");

    // Stuck processing flow states > 15 min
    $r = $pdo->query("SELECT COUNT(*) FROM subscriber_flow_states WHERE status='processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)")->fetchColumn();
    $items[] = chk('Stuck PROCESSING flow states (>15min)', $r == 0 ? 'PASS' : ($r < 5 ? 'WARN' : 'FAIL'),
        "$r stuck rows", $r > 0 ? 'Worker crash? Check worker_flow.log for [ERROR]' : '');

    // Stuck campaigns
    $r = $pdo->query("SELECT COUNT(*) FROM campaigns WHERE status='processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 60 MINUTE)")->fetchColumn();
    $items[] = chk('Stuck PROCESSING campaigns (>60min)', $r == 0 ? 'PASS' : 'FAIL', "$r");

    // Duplicate active enrollments
    $r = $pdo->query("SELECT COUNT(*) FROM (
        SELECT subscriber_id, flow_id FROM subscriber_flow_states
        WHERE status IN ('waiting','processing')
        GROUP BY subscriber_id, flow_id HAVING COUNT(*) > 1) AS d")->fetchColumn();
    $items[] = chk('Duplicate active enrollments per flow', $r == 0 ? 'PASS' : 'WARN',
        "$r subscriber+flow pairs", $r > 0 ? 'Possible double-processing' : '');

    // Orphan ZNS delivery logs — check against BOTH subscribers AND zalo_subscribers.
    // subscriber_id in zalo_delivery_logs primarily references subscribers.id (see campaigns.php, flows.php JOINs).
    // sendZNSMessage() fallback may also store zalo_subscribers.id — so check both to avoid false positives.
    $r = $pdo->query("
        SELECT COUNT(*) FROM zalo_delivery_logs zdl
        LEFT JOIN subscribers s ON s.id = zdl.subscriber_id
        LEFT JOIN zalo_subscribers zs ON zs.id = zdl.subscriber_id
        WHERE zdl.subscriber_id IS NOT NULL AND s.id IS NULL AND zs.id IS NULL
    ")->fetchColumn();
    $items[] = chk('Orphan ZNS delivery logs (not in subscribers OR zalo_subscribers)', $r == 0 ? 'PASS' : 'WARN',
        "$r orphan rows",
        $r > 0 ? "DELETE zdl FROM zalo_delivery_logs zdl LEFT JOIN subscribers s ON s.id=zdl.subscriber_id LEFT JOIN zalo_subscribers zs ON zs.id=zdl.subscriber_id WHERE zdl.subscriber_id IS NOT NULL AND s.id IS NULL AND zs.id IS NULL" : '');

    // Campaign stats drift: |count_sent - actual mail_delivery_logs|
    $drift = $pdo->query("
        SELECT c.id, c.name, c.count_sent, COUNT(mdl.id) AS actual, ABS(c.count_sent - COUNT(mdl.id)) AS diff
        FROM campaigns c LEFT JOIN mail_delivery_logs mdl ON mdl.campaign_id = c.id
        WHERE c.status = 'sent' GROUP BY c.id HAVING diff > 50 LIMIT 10
    ")->fetchAll();
    $items[] = chk('Campaign sent count drift (|count_sent - logs| > 50)', count($drift) == 0 ? 'PASS' : 'WARN',
        count($drift) . ' campaigns',
        count($drift) > 0 ? 'IDs: ' . implode(', ', array_column($drift,'id')) . ' — run: UPDATE campaigns c SET count_sent=(SELECT COUNT(*) FROM mail_delivery_logs WHERE campaign_id=c.id) WHERE id IN (...)' : '');

    // Activity buffer: unprocessed rows older than 2h
    $r = $pdo->query("SELECT COUNT(*) FROM activity_buffer WHERE processed=0 AND created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)")->fetchColumn();
    $items[] = chk('Activity buffer: rows >2h unprocessed', $r == 0 ? 'PASS' : 'WARN',
        "$r rows", $r > 0 ? 'worker_tracking_aggregator.php not running regularly?' : '');

    // raw_event_buffer health
    try {
        $rb = $pdo->query("SELECT COUNT(*) FROM raw_event_buffer WHERE processed=0 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)")->fetchColumn();
        $items[] = chk('raw_event_buffer: stale unprocessed events (>1h)', $rb == 0 ? 'PASS' : 'WARN', "$rb rows");
    } catch(Exception $e){ $items[] = chk('raw_event_buffer', 'INFO', 'Table may not exist'); }

    // stats_update_buffer health
    try {
        $sb = $pdo->query("SELECT COUNT(*) FROM stats_update_buffer WHERE processed=0 AND batch_id IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)")->fetchColumn();
        $items[] = chk('stats_update_buffer: stale unprocessed (>1h)', $sb == 0 ? 'PASS' : 'WARN', "$sb rows");
    } catch(Exception $e){ $items[] = chk('stats_update_buffer', 'INFO', $e->getMessage()); }

    // Voucher orphans
    $r = $pdo->query("SELECT COUNT(*) FROM voucher_codes vc LEFT JOIN subscribers s ON s.id=vc.subscriber_id WHERE vc.subscriber_id IS NOT NULL AND s.id IS NULL")->fetchColumn();
    $items[] = chk('Orphan voucher codes (subscriber deleted)', $r == 0 ? 'PASS' : 'WARN', "$r");

} catch(Exception $e){ $items[] = chk('Data integrity', 'FAIL', $e->getMessage()); }
$report['sections'][] = sec('Data Integrity', $items);

// --- 6. BUSINESS LOGIC -------------------------------------------------------
$items = [];
try {
    $items[] = chk('Active flows', 'INFO', $pdo->query("SELECT COUNT(*) FROM flows WHERE status='active'")->fetchColumn() . ' flows');
    $items[] = chk('Active subscribers', 'INFO', number_format($pdo->query("SELECT COUNT(*) FROM subscribers WHERE status='active'")->fetchColumn()));

    // Flow state distribution
    $dist = $pdo->query("SELECT status, COUNT(*) AS cnt FROM subscriber_flow_states GROUP BY status ORDER BY cnt DESC")->fetchAll();
    $summary = implode(' | ', array_map(fn($x) => "{$x['status']}={$x['cnt']}", $dist));
    $items[] = chk('Flow state distribution', 'INFO', $summary ?: 'Empty');

    // Check: any flow state with empty/null step_id in waiting status (stuck at start)
    $r = $pdo->query("SELECT COUNT(*) FROM subscriber_flow_states WHERE status='waiting' AND (step_id IS NULL OR step_id='')")->fetchColumn();
    $items[] = chk('Waiting flow states with NULL step_id', $r == 0 ? 'PASS' : 'WARN',
        "$r rows", $r > 0 ? 'These subscribers may be stuck — check trigger_helper.php enrollment' : '');

    // Flow states with scheduled_at in the past not yet processed (only for active flows)
    $overdue = $pdo->query("
        SELECT COUNT(q.id) 
        FROM subscriber_flow_states q
        JOIN flows f ON q.flow_id = f.id
        WHERE q.status='waiting' AND q.scheduled_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        AND f.status = 'active'
    ")->fetchColumn();
    $items[] = chk('Overdue waiting states (scheduled >30min ago)', $overdue == 0 ? 'PASS' : ($overdue < 100 ? 'WARN' : 'FAIL'),
        "$overdue rows", $overdue > 0 ? 'Worker not picking these up — check cron/worker triggers' : '');

    // Last flow state completed (worker liveness — fixed metric)
    $lastComplete = $pdo->query("SELECT MAX(updated_at) FROM subscriber_flow_states WHERE status='completed'")->fetchColumn();
    $ageMins = $lastComplete ? round((time()-strtotime($lastComplete))/60) : null;
    $items[] = chk('Last completed flow state', $ageMins !== null && $ageMins < 120 ? 'PASS' : 'WARN',
        $ageMins !== null ? "{$ageMins} min ago ($lastComplete)" : 'No completions',
        $ageMins > 120 ? 'Flow workers may not be running. Check cron.' : '');

    // Worker_tracking_aggregator liveness — check last subscriber_activity INSERT (not activity_buffer processed=1 which always deletes)
    $lastSaInsert = $pdo->query("SELECT MAX(created_at) FROM subscriber_activity WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();
    $saMins = $lastSaInsert ? round((time()-strtotime($lastSaInsert))/60) : null;
    $items[] = chk('Last subscriber_activity INSERT (aggregator liveness)',
        $saMins !== null ? 'INFO' : 'WARN',
        $saMins !== null ? "{$saMins} min ago" : 'No recent activity',
        'Note: aggregator DELETEs buffer rows after sync (not updates processed=1)');

    // Unprocessed activity buffer count
    $unproc = $pdo->query("SELECT COUNT(*) FROM activity_buffer WHERE processed=0")->fetchColumn();
    $items[] = chk('activity_buffer unprocessed rows', $unproc < 200 ? 'PASS' : 'WARN', "$unproc rows");

} catch(Exception $e){ $items[] = chk('Business logic', 'FAIL', $e->getMessage()); }
$report['sections'][] = sec('Business Logic Sanity', $items);

// --- 7. LOG FILE HEALTH -------------------------------------------------------
$items = [];
$logs = [
    'error_log'            => [10, 50],
    'worker_flow.log'      => [50, 200],
    'worker_campaign.log'  => [20, 100],
    'meta_webhook_prod.log'=> [10, 50],
    'worker_sync.log'      => [10, 50],
    'webhook_debug.log'    => [10, 30],
    'zalo_debug.log'       => [5, 20],
    'debug_priority.log'   => [5, 20],
    'training_debug.log'   => [10, 50],
    'misa_sync_debug.log'  => [5, 20],
];
foreach ($logs as $file => [$warn, $fail]) {
    $path = __DIR__ . '/' . $file;
    if (!file_exists($path)) { continue; }
    $mb = round(filesize($path)/1024/1024, 2);
    $st = $mb >= $fail ? 'FAIL' : ($mb >= $warn ? 'WARN' : 'PASS');
    $items[] = chk("LOG: $file", $st, "{$mb} MB", $st !== 'PASS' ? "Rotate! thresh={$warn}MB/{$fail}MB" : '');
}
$report['sections'][] = sec('Log File Sizes', $items);

// --- Summary -----------------------------------------------------------------
$totals = ['PASS'=>0,'WARN'=>0,'FAIL'=>0,'INFO'=>0];
foreach ($report['sections'] as $sec) {
    foreach ($sec['items'] as $item) {
        $totals[$item['status']] = ($totals[$item['status']] ?? 0) + 1;
    }
}
$report['summary'] = $totals;
$report['overall'] = $totals['FAIL'] > 0 ? 'FAIL' : ($totals['WARN'] > 0 ? 'WARN' : 'PASS');
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);


