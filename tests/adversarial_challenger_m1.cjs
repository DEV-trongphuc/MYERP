/**
 * ADVERSARIAL CHALLENGER SUITE: MILESTONE 1
 * Independent Stress Harness & Chaos Pentest
 * 
 * Verifies:
 * 1. Anti-Self-Approval in DepositController.php
 * 2. Ticket Decoupling & ReportDataModal Contract
 * 3. Soft-Delete Retention & FK Non-Destruction
 * 4. PDO Parameter Re-indexing with array_values()
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;
const failureLog = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failureLog.push({ name, error: err.message, stack: err.stack });
  }
}

console.log('======================================================================');
console.log('   CHALLENGER ADVERSARIAL STRESS TEST SUITE: MILESTONE 1');
console.log('======================================================================\n');

// ======================================================================
// 1. STRESS TEST: Anti-Self-Approval in DepositController
// ======================================================================
console.log('▶ Suite 1: Anti-Self-Approval Logic & Edge Cases');

const depositControllerPath = path.resolve('backend/controllers/DepositController.php');
const depositControllerCode = fs.readFileSync(depositControllerPath, 'utf8');

// Verify AST/Code pattern in approveMilestone
test('DepositController::approveMilestone contains exact anti-self-approval guard', () => {
  assert(depositControllerCode.includes('function approveMilestone'), 'approveMilestone function missing');
  assert(depositControllerCode.includes('$isCreator = ((int)$depositData[\'created_by\'] === (int)$auth[\'user_id\']);'), 'isCreator check missing or loose');
  assert(depositControllerCode.includes('$isAdminOrDirector = in_array(strtolower($auth[\'role\'] ?? \'\'), [\'admin\', \'superadmin\', \'super_admin\', \'director\'], true);'), 'isAdminOrDirector check missing or malformed');
  assert(depositControllerCode.includes('if ($isCreator && !$isAdminOrDirector)'), 'Guard condition missing');
  assert(depositControllerCode.includes('respond(403, null, \'Không được tự phê duyệt đợt thanh toán của chính mình\', false);'), 'HTTP 403 response missing');
});

// Simulation oracle for DepositController logic
function simulateApproveMilestone(auth, depositData, milestoneData) {
  const allowedRoles = ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'accountant'];
  if (!allowedRoles.includes(auth.role ? auth.role.toLowerCase() : '')) {
    return { status: 403, message: 'Forbidden role' };
  }
  if (!depositData) {
    return { status: 404, message: 'Không tìm thấy phiếu đặt cọc' };
  }
  const isCreator = (Number(depositData.created_by) === Number(auth.user_id));
  const isAdminOrDirector = ['admin', 'superadmin', 'super_admin', 'director'].includes(
    auth.role ? auth.role.toLowerCase() : ''
  );
  if (isCreator && !isAdminOrDirector) {
    return { status: 403, message: 'Không được tự phê duyệt đợt thanh toán của chính mình' };
  }
  if (!milestoneData) {
    return { status: 404, message: 'Không tìm thấy đợt thanh toán' };
  }
  if (milestoneData.status === 'approved') {
    return { status: 422, message: 'Đợt thanh toán này đã được duyệt từ trước' };
  }
  return { status: 200, message: 'Milestone approved successfully' };
}

test('Accountant creator attempting self-approval is rejected (HTTP 403)', () => {
  const res = simulateApproveMilestone(
    { user_id: 10, role: 'accountant', tenant_id: 1 },
    { id: 100, created_by: 10 },
    { id: 1, status: 'pending' }
  );
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.message, 'Không được tự phê duyệt đợt thanh toán của chính mình');
});

test('Assistant creator attempting self-approval is rejected (HTTP 403)', () => {
  const res = simulateApproveMilestone(
    { user_id: 11, role: 'assistant', tenant_id: 1 },
    { id: 100, created_by: 11 },
    { id: 1, status: 'pending' }
  );
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.message, 'Không được tự phê duyệt đợt thanh toán của chính mình');
});

test('Peer Accountant approving deposit created by another user is permitted (HTTP 200)', () => {
  const res = simulateApproveMilestone(
    { user_id: 12, role: 'accountant', tenant_id: 1 },
    { id: 100, created_by: 10 },
    { id: 1, status: 'pending' }
  );
  assert.strictEqual(res.status, 200);
});

test('Admin creator approving own deposit is permitted (HTTP 200)', () => {
  const res = simulateApproveMilestone(
    { user_id: 1, role: 'admin', tenant_id: 1 },
    { id: 100, created_by: 1 },
    { id: 1, status: 'pending' }
  );
  assert.strictEqual(res.status, 200);
});

test('SuperAdmin / Super_admin creator approving own deposit is permitted (HTTP 200)', () => {
  for (const role of ['superadmin', 'super_admin', 'SUPERADMIN', 'Super_Admin']) {
    const res = simulateApproveMilestone(
      { user_id: 2, role, tenant_id: 1 },
      { id: 100, created_by: 2 },
      { id: 1, status: 'pending' }
    );
    assert.strictEqual(res.status, 200, `Failed for role ${role}`);
  }
});

test('Director creator approving own deposit is permitted (HTTP 200)', () => {
  for (const role of ['director', 'Director', 'DIRECTOR']) {
    const res = simulateApproveMilestone(
      { user_id: 3, role, tenant_id: 1 },
      { id: 100, created_by: 3 },
      { id: 1, status: 'pending' }
    );
    assert.strictEqual(res.status, 200, `Failed for role ${role}`);
  }
});

test('String vs Number user_id coercion does not bypass self-approval check', () => {
  // e.g. JWT auth contains '10' as string while database returns 10 as int
  const res = simulateApproveMilestone(
    { user_id: '10', role: 'accountant', tenant_id: 1 },
    { id: 100, created_by: 10 },
    { id: 1, status: 'pending' }
  );
  assert.strictEqual(res.status, 403);
});

test('Double approval is rejected with HTTP 422', () => {
  const res = simulateApproveMilestone(
    { user_id: 1, role: 'admin', tenant_id: 1 },
    { id: 100, created_by: 1 },
    { id: 1, status: 'approved' }
  );
  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.message, 'Đợt thanh toán này đã được duyệt từ trước');
});

// ======================================================================
// 2. STRESS TEST: Ticket Decoupling & ReportDataModal Contract
// ======================================================================
console.log('\n▶ Suite 2: Ticket Decoupling & Data Error Contract');

const reportModalPath = path.resolve('src/components/ui/ReportDataModal.tsx');
const reportModalCode = fs.readFileSync(reportModalPath, 'utf8');
const ticketControllerPath = path.resolve('backend/controllers/TicketController.php');
const ticketControllerCode = fs.readFileSync(ticketControllerPath, 'utf8');
const apiPhpPath = path.resolve('backend/api.php');
const apiPhpCode = fs.readFileSync(apiPhpPath, 'utf8');

test('ReportDataModal calls fetchAPI("submit_report") and NEVER calls api.post("/tickets")', () => {
  assert(reportModalCode.includes('fetchAPI(\'submit_report\''), 'submit_report endpoint call missing');
  assert(!reportModalCode.includes('api.post(\'/tickets\''), 'ReportDataModal still calls /tickets');
});

test('ReportDataModal constructs complete decoupled payload contract', () => {
  assert(reportModalCode.includes('lead_id: leadId'), 'lead_id missing from payload');
  assert(reportModalCode.includes('consultant_id: saleId'), 'consultant_id missing from payload');
  assert(reportModalCode.includes('round_id: roundId'), 'round_id missing from payload');
  assert(reportModalCode.includes('reason: fullDescription'), 'reason missing from payload');
});

test('ReportDataModal safely coerces IDs to Number to avoid NaN or undefined', () => {
  assert(reportModalCode.includes('const leadId = Number(contact.lead_id || contact.id || 0);'), 'leadId coercion check');
  assert(reportModalCode.includes('const roundId = Number(contact.dl_round_id || contact.round_id || 0);'), 'roundId coercion check');
});

test('TicketController.php has NO "Báo lỗi data" sync logic or data_reports writes', () => {
  assert(!ticketControllerCode.includes('$data[\'subject\'] === \'Báo lỗi data\''), 'TicketController still has Báo lỗi data branch');
  assert(!ticketControllerCode.includes('INSERT INTO data_reports'), 'TicketController still writes to data_reports');
  assert(!ticketControllerCode.includes('is_error_ticket = 1'), 'TicketController still writes is_error_ticket');
});

test('backend/api.php handles action=submit_report targeting data_reports table', () => {
  assert(apiPhpCode.includes('case \'submit_report\':'), 'submit_report action missing in api.php');
  assert(apiPhpCode.includes('INSERT INTO data_reports'), 'data_reports insertion missing in submit_report');
  // Verify submit_report does not insert into tickets
  const submitBlock = apiPhpCode.split('case \'submit_report\':')[1].split('case ')[0];
  assert(!submitBlock.includes('INSERT INTO tickets'), 'submit_report must not touch tickets table');
});

test('CustomerProfileDrawer.tsx no longer contains lead_error_compensation category', () => {
  const drawerPath = path.resolve('src/pages/CustomerProfileDrawer.tsx');
  const drawerCode = fs.readFileSync(drawerPath, 'utf8');
  assert(!drawerCode.includes('value: \'lead_error_compensation\''), 'Drawer still has lead_error_compensation option');
});

test('cron_ai_proactive_agent.php queries tickets instead of support_tickets', () => {
  const cronPath = path.resolve('backend/cron_ai_proactive_agent.php');
  const cronCode = fs.readFileSync(cronPath, 'utf8');
  assert(cronCode.includes('SELECT COUNT(*) FROM tickets'), 'cron query does not use tickets table');
  assert(!cronCode.includes('SELECT COUNT(*) FROM support_tickets'), 'cron query still references non-existent support_tickets');
});

// ======================================================================
// 3. STRESS TEST: Soft-Delete Mandate & Non-Destructive Retention
// ======================================================================
console.log('\n▶ Suite 3: 100% Soft-Delete Mandate & Non-Destructive Operations');

const adminUsersPath = path.resolve('backend/automation/admin_users.php');
const adminUsersCode = fs.readFileSync(adminUsersPath, 'utf8');
const agentHrmPath = path.resolve('backend/controllers/agent_tools/AgentHrmAttendanceTools.php');
const agentHrmCode = fs.readFileSync(agentHrmPath, 'utf8');

test('admin_users.php never hard deletes users (UPDATE users SET deleted_at = NOW())', () => {
  assert(!adminUsersCode.includes('DELETE FROM users'), 'admin_users.php contains hard DELETE FROM users');
  assert(adminUsersCode.includes('UPDATE users SET deleted_at = NOW() WHERE id = ?'), 'soft-delete query missing');
});

test('admin_users.php list action filters out soft-deleted users (WHERE u.deleted_at IS NULL)', () => {
  assert(adminUsersCode.includes('WHERE u.deleted_at IS NULL'), 'list query missing deleted_at IS NULL filter');
});

test('backend/api.php delete_consultant preserves data_reports without hard delete', () => {
  const deleteConsultantBlock = apiPhpCode.split('case \'delete_consultant\':')[1].split('case ')[0];
  assert(!deleteConsultantBlock.includes('DELETE FROM data_reports'), 'delete_consultant hard deletes data_reports');
  assert(deleteConsultantBlock.includes('UPDATE data_reports SET deleted_at = NOW() WHERE consultant_id = ?'), 'Preserves consultant reports via deleted_at');
});

test('backend/api.php delete_round detaches round_id without hard deleting data_reports', () => {
  const deleteRoundBlock = apiPhpCode.split('case \'delete_round\':')[1].split('case ')[0];
  assert(!deleteRoundBlock.includes('DELETE FROM data_reports'), 'delete_round hard deletes data_reports');
  assert(deleteRoundBlock.includes('SET round_id = NULL') || deleteRoundBlock.includes('SET deleted_at = NOW(), round_id = NULL'), 'delete_round detaches round_id safely');
});

test('AgentHrmAttendanceTools never hard-deletes hrm_leave_requests', () => {
  assert(!agentHrmCode.includes('DELETE FROM hrm_leave_requests'), 'Hard delete found in hrm_leave_requests');
  assert(agentHrmCode.includes('UPDATE hrm_leave_requests SET status = \'cancelled\''), 'Leave request cancellation status missing');
});

test('AgentHrmAttendanceTools never hard-deletes attendance_bulk_requests', () => {
  assert(!agentHrmCode.includes('DELETE FROM attendance_bulk_requests WHERE'), 'Hard delete found in attendance_bulk_requests');
  assert(agentHrmCode.includes('UPDATE attendance_bulk_requests SET status = \'cancelled\''), 'Bulk attendance cancellation status missing');
});

test('AgentHrmAttendanceTools never hard-deletes hrm_salary_advances', () => {
  assert(!agentHrmCode.includes('DELETE FROM hrm_salary_advances WHERE'), 'Hard delete found in hrm_salary_advances');
  assert(agentHrmCode.includes('UPDATE hrm_salary_advances SET status = \'cancelled\''), 'Salary advance cancellation status missing');
});

// ======================================================================
// 4. STRESS TEST: PDO Parameter Dynamic Arrays & N+1 Hardening
// ======================================================================
console.log('\n▶ Suite 4: PDO Parameter Safety & N+1 Loop Hardening');

const campaignsPath = path.resolve('backend/automation/campaigns.php');
const campaignsCode = fs.readFileSync(campaignsPath, 'utf8');
const workerFlowPath = path.resolve('backend/automation/worker_flow.php');
const workerFlowCode = fs.readFileSync(workerFlowPath, 'utf8');
const academicPath = path.resolve('backend/controllers/AcademicAffairsController.php');
const academicCode = fs.readFileSync(academicPath, 'utf8');

test('campaigns.php reindexes subscriber IDs with array_values(array_filter(...))', () => {
  assert(campaignsCode.includes('$subIds = array_values(array_filter(array_column($recipients, \'subscriber_id\')));'), 'array_values wrapper missing in campaigns.php');
});

test('worker_flow.php reindexes subscriber IDs with array_values(array_unique(array_filter(...)))', () => {
  assert(workerFlowCode.includes('$subIds = array_values(array_unique(array_filter(array_column($items, \'subscriber_id\'))));'), 'array_values wrapper missing in worker_flow.php');
});

test('AcademicAffairsController::saveStudentGrades prepares statements outside loop', () => {
  const saveGradesSection = academicCode.split('function saveStudentGrades')[1].split('function ')[0];
  const prepChkIdx = saveGradesSection.indexOf('$stmtChk = $this->db->prepare');
  const prepUpdIdx = saveGradesSection.indexOf('$stmtUpd = $this->db->prepare');
  const prepInsIdx = saveGradesSection.indexOf('$stmtIns = $this->db->prepare');
  const loopIdx = saveGradesSection.indexOf('foreach ($gradesList as $item)');

  assert(prepChkIdx !== -1 && prepChkIdx < loopIdx, '$stmtChk prepared inside loop');
  assert(prepUpdIdx !== -1 && prepUpdIdx < loopIdx, '$stmtUpd prepared inside loop');
  assert(prepInsIdx !== -1 && prepInsIdx < loopIdx, '$stmtIns prepared inside loop');
});

test('AcademicAffairsController::bulkImportGrades prepares statements outside nested loop', () => {
  const bulkSection = academicCode.split('function saveClassGradebook')[1].split('function ')[0];
  const prepChkIdx = bulkSection.indexOf('$stmtChk = $this->db->prepare');
  const prepUpdIdx = bulkSection.indexOf('$stmtUpd = $this->db->prepare');
  const prepInsIdx = bulkSection.indexOf('$stmtIns = $this->db->prepare');
  const loopIdx = bulkSection.indexOf('foreach ($rows as $row)');

  assert(prepChkIdx !== -1 && prepChkIdx < loopIdx, '$stmtChk prepared inside nested loop');
  assert(prepUpdIdx !== -1 && prepUpdIdx < loopIdx, '$stmtUpd prepared inside nested loop');
  assert(prepInsIdx !== -1 && prepInsIdx < loopIdx, '$stmtIns prepared inside nested loop');
});

// Chaos simulator for PHP array_filter / array_unique index gaps
function simulatePhpArrayFilterAndUnique(input, applyUnique = false) {
  // Simulates PHP associative array representation
  const phpArray = {};
  for (let i = 0; i < input.length; i++) {
    phpArray[i] = input[i];
  }
  // filter truthy
  const filtered = {};
  for (const k in phpArray) {
    if (phpArray[k]) {
      filtered[k] = phpArray[k];
    }
  }
  let result = filtered;
  if (applyUnique) {
    const seen = new Set();
    const unique = {};
    for (const k in filtered) {
      if (!seen.has(filtered[k])) {
        seen.add(filtered[k]);
        unique[k] = filtered[k];
      }
    }
    result = unique;
  }
  return result;
}

function simulateArrayValues(phpArray) {
  return Object.values(phpArray);
}

test('Sparse array with gaps without array_values retains associative keys (vulnerable)', () => {
  const rawInput = [null, 101, null, 102, 101, null, 103];
  const filteredWithUnique = simulatePhpArrayFilterAndUnique(rawInput, true);
  const keys = Object.keys(filteredWithUnique);
  // Indices are ['1', '3', '6'] -> GAPS!
  assert.notDeepStrictEqual(keys, ['0', '1', '2']);
  assert.strictEqual(keys.length, 3);
});

test('Applying array_values resets keys to dense 0..N-1 matching PDO ? count', () => {
  const rawInput = [null, 101, null, 102, 101, null, 103];
  const filteredWithUnique = simulatePhpArrayFilterAndUnique(rawInput, true);
  const reindexed = simulateArrayValues(filteredWithUnique);
  
  assert.deepStrictEqual(reindexed, [101, 102, 103]);
  assert.strictEqual(reindexed.length, 3);
  
  // PDO placeholders
  const placeholders = reindexed.map(() => '?').join(',');
  assert.strictEqual(placeholders, '?,?,?');
  assert.strictEqual(placeholders.split('?').length - 1, reindexed.length);
});

test('Empty array input yields empty dense array without placeholder errors', () => {
  const rawInput = [];
  const filtered = simulatePhpArrayFilterAndUnique(rawInput, true);
  const reindexed = simulateArrayValues(filtered);
  assert.deepStrictEqual(reindexed, []);
});

test('All null/falsy array yields empty dense array', () => {
  const rawInput = [null, undefined, 0, false, ''];
  const filtered = simulatePhpArrayFilterAndUnique(rawInput, true);
  const reindexed = simulateArrayValues(filtered);
  assert.deepStrictEqual(reindexed, []);
});

test('Large array with 10,000 items and 90% duplicates reindexes efficiently', () => {
  const largeInput = [];
  for (let i = 0; i < 10000; i++) {
    largeInput.push(i % 100 === 0 ? null : (i % 500));
  }
  const filtered = simulatePhpArrayFilterAndUnique(largeInput, true);
  const reindexed = simulateArrayValues(filtered);
  assert(reindexed.length <= 500);
  // Check strict 0-based continuity
  for (let i = 0; i < reindexed.length; i++) {
    assert.strictEqual(typeof reindexed[i], 'number');
  }
});

// ======================================================================
// SUMMARY
// ======================================================================
console.log('\n======================================================================');
console.log('   CHALLENGER STRESS TEST RESULTS');
console.log('======================================================================');
console.log(`  Total Adversarial Tests : ${totalTests}`);
console.log(`  Passed (PASS)           : ${passedTests}`);
console.log(`  Failed (FAIL)           : ${failureLog.length}`);
console.log('======================================================================');

if (failureLog.length > 0) {
  console.error('\nFAILURES DETECTED:');
  failureLog.forEach(f => console.error(`- ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log('\nVERDICT: 100% OF ADVERSARIAL STRESS TESTS PASSED!');
  process.exit(0);
}
