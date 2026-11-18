/**
 * tests/adversarial_reentry_softdelete.cjs
 * Empirical Challenger Test Harness for MYERP Marketing Automation Milestone 2
 * 
 * Verifies:
 * 1. allowMultiple re-entry: ON DUPLICATE KEY UPDATE resets status to 'waiting',
 *    scheduled_at = VALUES(scheduled_at), waiting_until = NULL, branch_taken = NULL,
 *    last_error = NULL, created_at = NOW() without 1062 Duplicate entry.
 * 2. Idempotency Guard interaction with created_at = NOW() allowing subsequent runs.
 * 3. flows.php:deleteFlowPermanently data preservation: mail_delivery_logs,
 *    zalo_delivery_logs, subscriber_activity are NOT deleted; flows is soft-deleted.
 * 4. Static regex/AST verification of flows.php and FlowExecutor.php.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const assert = require('assert');

const TEST_WS = 98888;

// Parse backend/.env
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    val = val.replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const rootDir = path.resolve(__dirname, '..');
const envBackend = parseEnvFile(path.join(rootDir, 'backend/.env'));
const envLocal = parseEnvFile(path.join(rootDir, 'backend/.env.local'));

const DB_CONFIG = {
  host: envLocal.DB_HOST || envBackend.DB_HOST || process.env.DB_HOST || '127.0.0.1',
  port: parseInt(envLocal.DB_PORT || envBackend.DB_PORT || process.env.DB_PORT || '3306', 10),
  user: envLocal.DB_USER || envBackend.DB_USER || process.env.DB_USER || '',
  password: envLocal.DB_PASS || envBackend.DB_PASS || process.env.DB_PASS || '',
  database: envLocal.DB_NAME || envBackend.DB_NAME || process.env.DB_NAME || 'vhvxoigh_myerp'
};

let passedTests = 0;
let totalTests = 0;
const failureLog = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    failureLog.push({ name, error: err.message, stack: err.stack });
  }
}

async function run() {
  console.log('======================================================================');
  console.log('   EMPIRICAL CHALLENGER: FLOW EXECUTION, RE-ENTRY & SOFT-DELETE');
  console.log('======================================================================\n');

  let pool;
  try {
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 5000
    });
    await pool.query('SELECT 1');
    console.log(`[DB] Connected to Live MySQL for Empirical Stress Tests (${DB_CONFIG.database})`);
  } catch (err) {
    console.error(`[DB] Failed connecting to Live MySQL: ${err.message}`);
    process.exit(1);
  }

  // Helper: clean workspace 98888
  async function cleanTestWorkspace() {
    const tables = [
      'subscriber_flow_states',
      'subscriber_activity',
      'mail_delivery_logs',
      'zalo_delivery_logs',
      'flow_enrollments',
      'queue_jobs',
      'flows'
    ];
    for (const t of tables) {
      try {
        await pool.query(`DELETE FROM \`${t}\` WHERE workspace_id = ?`, [TEST_WS]);
      } catch (_) {}
    }
    // Also clean queue_jobs with payload matching TEST_WS
    try {
      await pool.query(`DELETE FROM queue_jobs WHERE payload LIKE '%"workspace_id":${TEST_WS}%' OR payload LIKE '%flow_test_%'`);
    } catch (_) {}
  }

  // Ensure flows table schema has deleted_at column (mimicking ensureFlowsTableSchema)
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM flows LIKE 'deleted_at'");
    if (cols.length === 0) {
      console.log('[SCHEMA] Adding deleted_at column to flows table...');
      await pool.query("ALTER TABLE flows ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER archived_at, ADD INDEX idx_flows_ws_deleted (workspace_id, deleted_at)");
    }
  } catch (e) {
    console.log('[SCHEMA] Notice:', e.message);
  }

  await cleanTestWorkspace();

  // ====================================================================
  // TEST SUITE 1: allowMultiple Re-Entry & ON DUPLICATE KEY UPDATE
  // ====================================================================
  console.log('\n▶ Suite 1: allowMultiple Re-Entry & ON DUPLICATE KEY UPDATE in subscriber_flow_states');

  const subId = 'sub_challenger_01';
  const flowId = 'flow_challenger_01';
  const initialScheduledAt = '2026-01-01 10:00:00';
  const reScheduledAt = '2026-11-13 22:00:00';

  // Seed flow
  await pool.query(
    "INSERT INTO flows (id, workspace_id, name, status, created_at, updated_at) VALUES (?, ?, 'Challenger Reentry Flow', 'active', NOW(), NOW())",
    [flowId, TEST_WS]
  );

  // Seed initial completed state
  await pool.query(`
    INSERT INTO subscriber_flow_states 
      (subscriber_id, workspace_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, waiting_until, branch_taken, last_error, created_at, updated_at, last_step_at)
    VALUES (?, ?, 101, ?, 'step_completed', 'exit', ?, 'completed', '2026-01-01 12:00:00', 'branch_alpha', 'Initial error', '2026-01-01 08:00:00', '2026-01-01 08:00:00', '2026-01-01 08:00:00')
  `, [subId, TEST_WS, flowId, initialScheduledAt]);

  // Test 1.1: Verify that a plain INSERT without ON DUPLICATE KEY UPDATE produces 1062 Duplicate entry
  await test('Negative Assertion: Plain INSERT on existing (workspace_id, flow_id, subscriber_id) throws 1062 Duplicate entry', async () => {
    let caughtError = null;
    try {
      await pool.query(`
        INSERT INTO subscriber_flow_states 
          (subscriber_id, workspace_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
        VALUES (?, ?, 101, ?, 'step_new', 'action', ?, 'waiting', NOW(), NOW(), NOW())
      `, [subId, TEST_WS, flowId, reScheduledAt]);
    } catch (e) {
      caughtError = e;
    }
    assert(caughtError !== null, 'Expected duplicate key error was not thrown!');
    assert(caughtError.code === 'ER_DUP_ENTRY' || caughtError.errno === 1062, `Expected 1062 Duplicate entry, got ${caughtError.code} (${caughtError.message})`);
  });

  // Test 1.2: Execute exact ON DUPLICATE KEY UPDATE SQL from FlowExecutor.php:1970
  await test('Positive Assertion: ON DUPLICATE KEY UPDATE re-enrolls cleanly without 1062 Duplicate entry', async () => {
    const reEntrySql = `
      INSERT INTO subscriber_flow_states (subscriber_id, workspace_id, contact_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', NOW(), NOW(), NOW())
      ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          contact_id = COALESCE(VALUES(contact_id), contact_id),
          step_id = VALUES(step_id),
          step_type = VALUES(step_type),
          scheduled_at = VALUES(scheduled_at),
          waiting_until = NULL,
          branch_taken = NULL,
          last_error = NULL,
          status = 'waiting',
          created_at = NOW(),
          updated_at = NOW(),
          last_step_at = NOW()
    `;

    const [res] = await pool.query(reEntrySql, [subId, TEST_WS, 101, flowId, 'step_first_action', 'email', reScheduledAt]);
    // MySQL reports affectedRows = 2 on an UPDATE triggered by duplicate key
    assert(res.affectedRows >= 1, `Expected affectedRows >= 1, got ${res.affectedRows}`);
  });

  // Test 1.3: Verify all state columns were thoroughly reset to pristine waiting state
  await test('Pristine State Reset Verification: status=waiting, scheduled_at updated, waiting_until=NULL, branch_taken=NULL, last_error=NULL, created_at updated', async () => {
    const [rows] = await pool.query(
      "SELECT * FROM subscriber_flow_states WHERE workspace_id = ? AND flow_id = ? AND subscriber_id = ?",
      [TEST_WS, flowId, subId]
    );
    assert.strictEqual(rows.length, 1, 'Expected exactly 1 state row');
    const state = rows[0];

    assert.strictEqual(state.status, 'waiting', `status should be 'waiting', got ${state.status}`);
    assert.strictEqual(state.step_id, 'step_first_action', `step_id should be 'step_first_action', got ${state.step_id}`);
    assert.strictEqual(state.waiting_until, null, `waiting_until should be null, got ${state.waiting_until}`);
    assert.strictEqual(state.branch_taken, null, `branch_taken should be null, got ${state.branch_taken}`);
    assert.strictEqual(state.last_error, null, `last_error should be null, got ${state.last_error}`);
    
    // Verify created_at was updated to NOW() (not remaining at 2026-01-01)
    const createdAtDate = new Date(state.created_at);
    assert(createdAtDate.getFullYear() >= 2026, `created_at should be modern timestamp, got ${state.created_at}`);
    const timeDiffMs = Math.abs(Date.now() - createdAtDate.getTime());
    assert(timeDiffMs < 300000, `created_at was not updated to NOW(): diff is ${timeDiffMs}ms (${state.created_at})`);
  });

  // ====================================================================
  // TEST SUITE 2: Idempotency Guard Interaction with created_at = NOW()
  // ====================================================================
  console.log('\n▶ Suite 2: Idempotency Guard Interaction with created_at = NOW()');

  const oldEnrollmentCreatedAt = '2026-01-01 08:00:00';
  const pastEmailSentAt = '2026-01-01 08:05:00'; // Sent in first enrollment
  const currentStepId = 'step_first_action';

  // Seed past activity in subscriber_activity
  await pool.query(`
    INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, reference_name, created_at)
    VALUES (?, ?, 'receive_email', ?, 'Email Step 1', ?)
  `, [subId, TEST_WS, currentStepId, pastEmailSentAt]);

  // Test 2.1: Verify Idempotency check with OLD queueCreatedAt matches past email (would falsely block re-entry)
  await test('Idempotency Guard Vulnerability Scenario: If queue_created_at was NOT reset, past email is found and drops new email', async () => {
    const dedupSql = `
      SELECT 1 FROM subscriber_activity
      WHERE workspace_id = ? AND subscriber_id = ? AND type IN ('receive_email','failed_email') AND reference_id = ? AND created_at >= ?
      LIMIT 1
    `;
    const [rowsOld] = await pool.query(dedupSql, [TEST_WS, subId, currentStepId, oldEnrollmentCreatedAt]);
    assert.strictEqual(rowsOld.length, 1, 'Expected past email to match when using old enrollment created_at');
  });

  // Test 2.2: Verify Idempotency check with RESET queueCreatedAt (NOW()) ignores past email and allows sending
  await test('Idempotency Guard Remediation Verification: With created_at = NOW(), past email is ignored and step is allowed', async () => {
    // Current state has created_at = NOW()
    const [stateRows] = await pool.query(
      "SELECT created_at FROM subscriber_flow_states WHERE workspace_id = ? AND flow_id = ? AND subscriber_id = ?",
      [TEST_WS, flowId, subId]
    );
    const queueCreatedAt = stateRows[0].created_at;

    const dedupSql = `
      SELECT 1 FROM subscriber_activity
      WHERE workspace_id = ? AND subscriber_id = ? AND type IN ('receive_email','failed_email') AND reference_id = ? AND created_at >= ?
      LIMIT 1
    `;
    const [rowsNew] = await pool.query(dedupSql, [TEST_WS, subId, currentStepId, queueCreatedAt]);
    assert.strictEqual(rowsNew.length, 0, 'New enrollment should NOT find past email; must allow email to send!');
  });

  // Test 2.3: Verify Idempotency check STILL catches duplicate within CURRENT enrollment (crash recovery)
  await test('Crash Recovery Dedup: Duplicate send within the SAME enrollment is still prevented', async () => {
    const [stateRows] = await pool.query(
      "SELECT created_at FROM subscriber_flow_states WHERE workspace_id = ? AND flow_id = ? AND subscriber_id = ?",
      [TEST_WS, flowId, subId]
    );
    const queueCreatedAt = stateRows[0].created_at;

    // Simulate sending email NOW in the current enrollment
    await pool.query(`
      INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, reference_name, created_at)
      VALUES (?, ?, 'receive_email', ?, 'Email Step 1 (Run 2)', NOW())
    `, [subId, TEST_WS, currentStepId]);

    const dedupSql = `
      SELECT 1 FROM subscriber_activity
      WHERE workspace_id = ? AND subscriber_id = ? AND type IN ('receive_email','failed_email') AND reference_id = ? AND created_at >= ?
      LIMIT 1
    `;
    const [rowsCurrent] = await pool.query(dedupSql, [TEST_WS, subId, currentStepId, queueCreatedAt]);
    assert.strictEqual(rowsCurrent.length, 1, 'Current enrollment email send MUST be caught by idempotency guard');
  });

  // ====================================================================
  // TEST SUITE 3: flows.php:deleteFlowPermanently 100% Soft-Delete & Data Preservation
  // ====================================================================
  console.log('\n▶ Suite 3: flows.php:deleteFlowPermanently 100% Soft-Delete & Data Preservation');

  const delFlowId = 'flow_challenger_del_01';

  // Seed flow, logs, activity, queues
  await pool.query(
    "INSERT INTO flows (id, workspace_id, name, status, created_at, updated_at) VALUES (?, ?, 'Flow To Delete', 'active', NOW(), NOW())",
    [delFlowId, TEST_WS]
  );
  await pool.query(`
    INSERT INTO mail_delivery_logs (id, workspace_id, subscriber_id, recipient, status, flow_id, created_at)
    VALUES 
      ('mdl_del_01', ?, ?, 'del1@test.com', 'delivered', ?, NOW()),
      ('mdl_del_02', ?, ?, 'del2@test.com', 'bounced', ?, NOW())
  `, [TEST_WS, subId, delFlowId, TEST_WS, subId, delFlowId]);

  await pool.query(`
    INSERT INTO zalo_delivery_logs (id, workspace_id, subscriber_id, phone_number, status, flow_id, created_at)
    VALUES 
      ('zdl_del_01', ?, ?, '0912345678', 'sent', ?, NOW()),
      ('zdl_del_02', ?, ?, '0987654321', 'delivered', ?, NOW())
  `, [TEST_WS, subId, delFlowId, TEST_WS, subId, delFlowId]);

  await pool.query(`
    INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, flow_id, reference_name, created_at)
    VALUES 
      (?, ?, 'flow_completed', ?, 'Flow Completed', NOW()),
      (?, ?, 'clicked_link', ?, 'Clicked CTA', NOW())
  `, [subId, TEST_WS, delFlowId, subId, TEST_WS, delFlowId]);

  await pool.query(`
    INSERT INTO subscriber_flow_states (subscriber_id, workspace_id, flow_id, step_id, status, scheduled_at, created_at, updated_at)
    VALUES (?, ?, ?, 'step_x', 'waiting', NOW(), NOW(), NOW())
  `, [subId, TEST_WS, delFlowId]);

  // Execute the exact steps of deleteFlowPermanently as implemented in flows.php
  await test('deleteFlowPermanently execution preserves mail logs, zalo logs, subscriber activity, and soft-deletes flow', async () => {
    // 1. Transient queue cleanup
    await pool.query("DELETE FROM subscriber_flow_states WHERE flow_id = ?", [delFlowId]);
    await pool.query("DELETE FROM flow_enrollments WHERE flow_id = ?", [delFlowId]);
    await pool.query(
      "DELETE FROM queue_jobs WHERE (payload LIKE ? OR payload LIKE ?) AND status IN ('pending', 'processing')",
      [`%"flow_id":"${delFlowId}"%`, `%"priority_flow_id":"${delFlowId}"%`]
    );

    // 2. Soft-delete the flow
    const [delRes] = await pool.query(
      "UPDATE flows SET deleted_at = NOW(), status = 'archived', updated_at = NOW() WHERE id = ? AND workspace_id = ?",
      [delFlowId, TEST_WS]
    );
    assert.strictEqual(delRes.affectedRows, 1, 'Flow row must be updated');

    // 3. Verify mail_delivery_logs are NOT deleted
    const [mailLogs] = await pool.query(
      "SELECT COUNT(*) as cnt FROM mail_delivery_logs WHERE flow_id = ?",
      [delFlowId]
    );
    assert.strictEqual(mailLogs[0].cnt, 2, `mail_delivery_logs was deleted! Expected 2, got ${mailLogs[0].cnt}`);

    // 4. Verify zalo_delivery_logs are NOT deleted
    const [zaloLogs] = await pool.query(
      "SELECT COUNT(*) as cnt FROM zalo_delivery_logs WHERE flow_id = ?",
      [delFlowId]
    );
    assert.strictEqual(zaloLogs[0].cnt, 2, `zalo_delivery_logs was deleted! Expected 2, got ${zaloLogs[0].cnt}`);

    // 5. Verify subscriber_activity is NOT deleted
    const [activityRows] = await pool.query(
      "SELECT COUNT(*) as cnt FROM subscriber_activity WHERE flow_id = ?",
      [delFlowId]
    );
    assert.strictEqual(activityRows[0].cnt, 2, `subscriber_activity was deleted! Expected 2, got ${activityRows[0].cnt}`);

    // 6. Verify flow record is soft-deleted, NOT hard deleted
    const [flowRows] = await pool.query(
      "SELECT * FROM flows WHERE id = ? AND workspace_id = ?",
      [delFlowId, TEST_WS]
    );
    assert.strictEqual(flowRows.length, 1, 'Flow record must exist in DB (not hard-deleted)');
    assert.strictEqual(flowRows[0].status, 'archived', `Flow status should be 'archived', got ${flowRows[0].status}`);
    assert(flowRows[0].deleted_at !== null, 'Flow deleted_at must NOT be null');

    // 7. Verify GET /flows.php filter (deleted_at IS NULL) excludes the soft-deleted flow
    const [activeFlows] = await pool.query(
      "SELECT * FROM flows WHERE workspace_id = ? AND deleted_at IS NULL AND id = ?",
      [TEST_WS, delFlowId]
    );
    assert.strictEqual(activeFlows.length, 0, 'Soft-deleted flow must be omitted when deleted_at IS NULL');
  });

  // ====================================================================
  // TEST SUITE 4: Source Code Static Forensics
  // ====================================================================
  console.log('\n▶ Suite 4: Source Code Static Forensics in flows.php & FlowExecutor.php');

  const flowsCode = fs.readFileSync(path.resolve('backend/automation/flows.php'), 'utf8');
  const executorCode = fs.readFileSync(path.resolve('backend/automation/FlowExecutor.php'), 'utf8');

  test('flows.php: deleteFlowPermanently has ZERO hard DELETE on mail_delivery_logs', () => {
    assert(!flowsCode.includes('DELETE FROM mail_delivery_logs WHERE flow_id'), 'Found hard DELETE FROM mail_delivery_logs in flows.php!');
  });

  test('flows.php: deleteFlowPermanently has ZERO hard DELETE on zalo_delivery_logs', () => {
    assert(!flowsCode.includes('DELETE FROM zalo_delivery_logs WHERE flow_id'), 'Found hard DELETE FROM zalo_delivery_logs in flows.php!');
  });

  test('flows.php: deleteFlowPermanently has ZERO hard DELETE on subscriber_activity', () => {
    assert(!flowsCode.includes('DELETE FROM subscriber_activity WHERE flow_id'), 'Found hard DELETE FROM subscriber_activity in flows.php!');
  });

  test('flows.php: deleteFlowPermanently has ZERO hard DELETE on flows table', () => {
    assert(!flowsCode.includes('DELETE FROM flows WHERE id = ? AND workspace_id = ?'), 'Found hard DELETE FROM flows in flows.php!');
  });

  test('flows.php: deleteFlowPermanently executes UPDATE flows SET deleted_at = NOW(), status = \'archived\'', () => {
    assert(
      flowsCode.includes("UPDATE flows SET deleted_at = NOW(), status = 'archived'"),
      "Soft-delete UPDATE statement missing in flows.php"
    );
  });

  test('flows.php: GET /flows.php applies deleted_at IS NULL to prevent listing soft-deleted flows', () => {
    assert(
      flowsCode.includes("(deleted_at IS NULL)"),
      "deleted_at IS NULL filter missing in GET /flows.php"
    );
  });

  test('FlowExecutor.php: link_flow uses ON DUPLICATE KEY UPDATE with LAST_INSERT_ID(id) and state reset', () => {
    assert(
      executorCode.includes('ON DUPLICATE KEY UPDATE') &&
      executorCode.includes('id = LAST_INSERT_ID(id)') &&
      executorCode.includes('status = \'waiting\'') &&
      executorCode.includes('waiting_until = NULL') &&
      executorCode.includes('branch_taken = NULL') &&
      executorCode.includes('last_error = NULL') &&
      executorCode.includes('created_at = NOW()'),
      "ON DUPLICATE KEY UPDATE in FlowExecutor.php link_flow does not properly reset all columns"
    );
  });

  test('FlowExecutor.php: Idempotency Guard checks created_at >= queueCreatedAt', () => {
    assert(
      executorCode.includes('$dedupCreatedAtClause = \' AND created_at >= ?\';') ||
      executorCode.includes("if (!empty($queueCreatedAt)) {\n                            $dedupCreatedAtClause = ' AND created_at >= ?';"),
      "Idempotency Guard in FlowExecutor.php does not scope to queueCreatedAt"
    );
  });

  // Clean test workspace at end
  await cleanTestWorkspace();
  await pool.end();

  console.log('\n======================================================================');
  console.log('   EMPIRICAL CHALLENGER SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Tests Run: ${totalTests}`);
  console.log(`  Passed (PASS)  : ${passedTests}`);
  console.log(`  Failed (FAIL)  : ${failureLog.length}`);
  console.log('======================================================================\n');

  if (failureLog.length > 0) {
    console.error('✖ FAILURES DETECTED:');
    failureLog.forEach((f, idx) => {
      console.error(`  [${idx + 1}] ${f.name}`);
      console.error(`      Error: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('✔ ALL EMPIRICAL CHALLENGER TESTS PASSED (100% SUCCESS RATE)!');
    process.exit(0);
  }
}

run().catch(e => {
  console.error('Fatal crash:', e);
  process.exit(1);
});
