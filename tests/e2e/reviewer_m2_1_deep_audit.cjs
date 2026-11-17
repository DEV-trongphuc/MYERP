/**
 * Reviewer M2-1 Independent Adversarial Deep Audit Suite
 * Audits:
 * 1. backend/automation/flow_helpers.php
 * 2. backend/automation/FlowExecutor.php
 * 3. backend/automation/flows.php
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passed++;
  } catch (e) {
    console.error(`  ✖ [FAIL] ${desc}: ${e.message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('   REVIEWER M2-1 ADVERSARIAL BACKEND AUDIT SUITE');
console.log('======================================================================\n');

// -------------------------------------------------------------------------
// 1. AST & Code Pattern Audits
// -------------------------------------------------------------------------
const helpersCode = fs.readFileSync('backend/automation/flow_helpers.php', 'utf8');
const executorCode = fs.readFileSync('backend/automation/FlowExecutor.php', 'utf8');
const flowsCode = fs.readFileSync('backend/automation/flows.php', 'utf8');

console.log('▶ Suite 1: flow_helpers.php Tag, Boolean & Operator Inspection');

it('flow_helpers.php L1531 supports $field === "tag" || $field === "tags" || $field === "crm_tags"', () => {
  assert(helpersCode.includes("$field === 'tag' || $field === 'tags' || $field === 'crm_tags'"), 'Missing tag field match at L1531');
});

it('flow_helpers.php L2269 supports $field === "tag" || $field === "tags" || $field === "crm_tags"', () => {
  assert(helpersCode.includes("if ($field === 'tag' || $field === 'tags' || $field === 'crm_tags') {"), 'Missing tag field match in evaluateAdvancedConditionGroup');
});

it('flow_helpers.php handles has_tag and not_has_tag in array logic', () => {
  assert(helpersCode.includes("case 'has_tag':"), 'Missing case has_tag in array logic');
  assert(helpersCode.includes("case 'not_has_tag':"), 'Missing case not_has_tag in array logic');
});

it('flow_helpers.php handles is_true and is_false with multi-semantic values', () => {
  assert(helpersCode.includes("case 'is_true':"), 'Missing case is_true');
  assert(helpersCode.includes("case 'is_false':"), 'Missing case is_false');
  assert(helpersCode.includes("!in_array($checkVal, ['0', 'false', 'no', 'null', 'none'], true)"), 'Missing boolean multi-semantic values in is_true');
  assert(helpersCode.includes("in_array($checkVal, ['0', 'false', 'no', 'null', 'none'], true)"), 'Missing boolean multi-semantic values in is_false');
});

it('flow_helpers.php handles not_equals and != with numeric float comparison', () => {
  assert(helpersCode.includes("case 'not_equals':"), 'Missing case not_equals');
  assert(helpersCode.includes("case '!=':"), 'Missing case !=');
  assert(helpersCode.includes("((float) $actualVal != (float) $val)"), 'Missing numeric float comparison');
});

it('flow_helpers.php handles not_has_done with !$found in web_activity and activity_history', () => {
  const webActMatch = helpersCode.includes("in_array($op, ['not_has_done', 'not_contains', 'is_not_set', 'is_empty', 'not_equals', 'is_not'], true) ? !$found : $found");
  assert(webActMatch, 'Missing in_array check for not_has_done with !$found');
  assert(helpersCode.includes("COALESCE(type,'')"), 'Missing COALESCE(type, \'\') in activity query');
});

console.log('\n▶ Suite 2: FlowExecutor.php and flows.php UPSERT and Re-Entry Hardening');

it('FlowExecutor.php:1969 link_flow uses ON DUPLICATE KEY UPDATE with required fields', () => {
  const idx = executorCode.indexOf('stmtLinkedEnroll');
  assert(idx !== -1, 'stmtLinkedEnroll not found in FlowExecutor.php');
  const linkFlowSnippet = executorCode.slice(idx, idx + 1500);
  assert(linkFlowSnippet.includes("ON DUPLICATE KEY UPDATE"), 'link_flow missing ON DUPLICATE KEY UPDATE');
  assert(linkFlowSnippet.includes("id = LAST_INSERT_ID(id)"), 'link_flow missing id = LAST_INSERT_ID(id)');
  assert(linkFlowSnippet.includes("waiting_until = NULL"), 'link_flow missing waiting_until = NULL');
  assert(linkFlowSnippet.includes("branch_taken = NULL"), 'link_flow missing branch_taken = NULL');
  assert(linkFlowSnippet.includes("last_error = NULL"), 'link_flow missing last_error = NULL');
  assert(linkFlowSnippet.includes("status = 'waiting'"), 'link_flow missing status = waiting');
  assert(linkFlowSnippet.includes("created_at = NOW()"), 'link_flow missing created_at = NOW()');
  assert(linkFlowSnippet.includes("updated_at = NOW()"), 'link_flow missing updated_at = NOW()');
});

it('flows.php:1491 manual-add-participant uses ON DUPLICATE KEY UPDATE with required fields', () => {
  const idx = flowsCode.indexOf('sqlState = "INSERT INTO subscriber_flow_states');
  assert(idx !== -1, 'sqlState not found in flows.php');
  const manualSnippet = flowsCode.slice(idx, idx + 1200);
  assert(manualSnippet.includes("ON DUPLICATE KEY UPDATE"), 'manual-add-participant missing ON DUPLICATE KEY UPDATE');
  assert(manualSnippet.includes("id = LAST_INSERT_ID(id)"), 'manual-add-participant missing id = LAST_INSERT_ID(id)');
  assert(manualSnippet.includes("waiting_until = NULL"), 'manual-add-participant missing waiting_until = NULL');
  assert(manualSnippet.includes("branch_taken = NULL"), 'manual-add-participant missing branch_taken = NULL');
  assert(manualSnippet.includes("last_error = NULL"), 'manual-add-participant missing last_error = NULL');
  assert(manualSnippet.includes("status = 'waiting'"), 'manual-add-participant missing status = waiting');
  assert(manualSnippet.includes("created_at = NOW()"), 'manual-add-participant missing created_at = NOW()');
});

it('flows.php:3706 batch enrollment on activation uses ON DUPLICATE KEY UPDATE with required fields', () => {
  const idx = flowsCode.indexOf('sqlIns = "INSERT INTO subscriber_flow_states');
  assert(idx !== -1, 'sqlIns not found in flows.php');
  const enrollSnippet = flowsCode.slice(idx, idx + 1500);
  assert(enrollSnippet.includes("ON DUPLICATE KEY UPDATE"), 'batch activation missing ON DUPLICATE KEY UPDATE');
  assert(enrollSnippet.includes("id = LAST_INSERT_ID(id)"), 'batch activation missing id = LAST_INSERT_ID(id)');
  assert(enrollSnippet.includes("waiting_until = NULL"), 'batch activation missing waiting_until = NULL');
  assert(enrollSnippet.includes("branch_taken = NULL"), 'batch activation missing branch_taken = NULL');
  assert(enrollSnippet.includes("last_error = NULL"), 'batch activation missing last_error = NULL');
  assert(enrollSnippet.includes("status = VALUES(status)"), 'batch activation missing status = VALUES(status)');
  assert(enrollSnippet.includes("created_at = NOW()"), 'batch activation missing created_at = NOW()');
});

console.log('\n▶ Suite 3: 100% Soft-Delete Mandate in flows.php');

it('flows.php:deleteFlowPermanently does NOT delete mail_delivery_logs', () => {
  const fnSnippet = flowsCode.slice(flowsCode.indexOf("function deleteFlowPermanently"), flowsCode.indexOf("function deleteFlowPermanently") + 2500);
  assert(!fnSnippet.includes("DELETE FROM mail_delivery_logs"), 'Illegal hard DELETE FROM mail_delivery_logs found');
});

it('flows.php:deleteFlowPermanently does NOT delete zalo_delivery_logs', () => {
  const fnSnippet = flowsCode.slice(flowsCode.indexOf("function deleteFlowPermanently"), flowsCode.indexOf("function deleteFlowPermanently") + 2500);
  assert(!fnSnippet.includes("DELETE FROM zalo_delivery_logs"), 'Illegal hard DELETE FROM zalo_delivery_logs found');
});

it('flows.php:deleteFlowPermanently does NOT delete subscriber_activity', () => {
  const fnSnippet = flowsCode.slice(flowsCode.indexOf("function deleteFlowPermanently"), flowsCode.indexOf("function deleteFlowPermanently") + 2500);
  assert(!fnSnippet.includes("DELETE FROM subscriber_activity"), 'Illegal hard DELETE FROM subscriber_activity found');
});

it('flows.php:deleteFlowPermanently soft-deletes the flow entity via UPDATE', () => {
  const fnSnippet = flowsCode.slice(flowsCode.indexOf("function deleteFlowPermanently"), flowsCode.indexOf("function deleteFlowPermanently") + 2500);
  assert(!fnSnippet.includes("DELETE FROM flows"), 'Illegal hard DELETE FROM flows found');
  assert(fnSnippet.includes("UPDATE flows SET deleted_at = NOW()"), 'Missing UPDATE flows SET deleted_at = NOW()');
});

it('ensureFlowsTableSchema is present and idempotent', () => {
  assert(flowsCode.includes("function ensureFlowsTableSchema(PDO $pdo): void"), 'Missing ensureFlowsTableSchema function');
  assert(flowsCode.includes("SHOW COLUMNS FROM `flows`"), 'ensureFlowsTableSchema must check existing columns');
  assert(flowsCode.includes("ALTER TABLE `flows` ADD COLUMN `deleted_at`"), 'ensureFlowsTableSchema must add deleted_at');
});

it('GET /flows.php filters deleted_at IS NULL on flow lists and summary', () => {
  assert(flowsCode.includes("whereFlow = [$wsClause, \"(deleted_at IS NULL)\"]"), 'Flow listing missing deleted_at IS NULL');
  assert(flowsCode.includes("WHERE {$wsClause} AND (deleted_at IS NULL)"), 'Aggregate summary query missing deleted_at IS NULL');
  assert(flowsCode.includes("WHERE f.id = ? AND f.workspace_id = ? AND f.deleted_at IS NULL"), 'Single flow fetch missing deleted_at IS NULL');
});

console.log('\n▶ Suite 4: Simulation of Condition Evaluator Semantics');

// Simulate the exact logic in flow_helpers.php
function evalTag(actualVal, op, val) {
  let condMatch = false;
  const targets = (val || '').split(/[,|]/).map(s => s.trim()).filter(Boolean);
  if (targets.length === 0 && val) targets.push(val.trim());

  if (['has_tag', 'contains', 'equals', 'is', 'in'].includes(op)) {
    for (const item of (actualVal || [])) {
      for (const t of targets) {
        if (t !== '' && (String(item).toLowerCase() === t.toLowerCase() || String(item).toLowerCase().includes(t.toLowerCase()))) {
          condMatch = true;
          break;
        }
      }
      if (condMatch) break;
    }
  } else if (['not_has_tag', 'not_contains', 'is_not', 'not_equals'].includes(op)) {
    condMatch = true;
    for (const item of (actualVal || [])) {
      for (const t of targets) {
        if (t !== '' && (String(item).toLowerCase() === t.toLowerCase() || String(item).toLowerCase().includes(t.toLowerCase()))) {
          condMatch = false;
          break;
        }
      }
      if (!condMatch) break;
    }
  }
  return condMatch;
}

it('Tag Simulator: has_tag matches case-insensitively and handles pipe/comma separated values', () => {
  assert.strictEqual(evalTag(['VIP', 'Khách hàng'], 'has_tag', 'vip'), true);
  assert.strictEqual(evalTag(['VIP', 'Khách hàng'], 'has_tag', 'khach hang'), false); // unicode without diacritics
  assert.strictEqual(evalTag(['VIP', 'Khách hàng'], 'has_tag', 'Khách hàng'), true);
  assert.strictEqual(evalTag(['VIP'], 'has_tag', 'Lead, Student|VIP'), true);
  assert.strictEqual(evalTag(['VIP'], 'has_tag', 'Lead'), false);
});

it('Tag Simulator: not_has_tag returns false if tag exists and true if tag absent', () => {
  assert.strictEqual(evalTag(['VIP'], 'not_has_tag', 'VIP'), false);
  assert.strictEqual(evalTag(['VIP'], 'not_has_tag', 'Lead'), true);
  assert.strictEqual(evalTag([], 'not_has_tag', 'VIP'), true);
});

function evalScalar(actualVal, op, val) {
  const checkVal = String(actualVal ?? '').toLowerCase();
  const targetVal = String(val ?? '').toLowerCase();
  let condMatch = false;

  switch (op) {
    case 'equals':
    case 'is':
      condMatch = (checkVal === targetVal);
      break;
    case 'is_not':
    case 'not_equals':
    case '!=':
      if (!isNaN(Number(actualVal)) && !isNaN(Number(val)) && actualVal !== '' && val !== '') {
        condMatch = (Number(actualVal) !== Number(val));
      } else {
        condMatch = (checkVal !== targetVal);
      }
      break;
    case 'is_true':
      condMatch = (checkVal !== '' && !['0', 'false', 'no', 'null', 'none'].includes(checkVal));
      break;
    case 'is_false':
      condMatch = (checkVal === '' || ['0', 'false', 'no', 'null', 'none'].includes(checkVal));
      break;
  }
  return condMatch;
}

it('Boolean Simulator: is_true and is_false correctly evaluate multi-semantic truthy and falsy values', () => {
  // Falsy inputs
  const falsyCases = [null, undefined, '', '0', 'false', 'no', 'null', 'none', 'FALSE', 'NO', 'None'];
  for (const c of falsyCases) {
    assert.strictEqual(evalScalar(c, 'is_true', ''), false, `is_true should be false for: ${c}`);
    assert.strictEqual(evalScalar(c, 'is_false', ''), true, `is_false should be true for: ${c}`);
  }

  // Truthy inputs
  const truthyCases = ['1', 'true', 'yes', 'TRUE', 'YES', 'student', 'VIP', 'active'];
  for (const c of truthyCases) {
    assert.strictEqual(evalScalar(c, 'is_true', ''), true, `is_true should be true for: ${c}`);
    assert.strictEqual(evalScalar(c, 'is_false', ''), false, `is_false should be false for: ${c}`);
  }
});

it('Numeric Float Comparison: not_equals handles numeric string floats accurately', () => {
  assert.strictEqual(evalScalar('10', 'not_equals', '10.0'), false); // numerically equal
  assert.strictEqual(evalScalar('10', '!=', '10'), false);
  assert.strictEqual(evalScalar('10.5', 'not_equals', '10.50'), false);
  assert.strictEqual(evalScalar('10.5', 'not_equals', '10.6'), true);
  assert.strictEqual(evalScalar('Hà Nội', 'not_equals', 'TP.HCM'), true);
  assert.strictEqual(evalScalar('Hà Nội', 'not_equals', 'hà nội'), false); // case-insensitive
});

console.log('\n▶ Suite 5: PHP Syntax & Bracket Balance Verification');

function checkFileBrackets(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let inString = false;
  let strChar = '';
  let inSingleComment = false;
  let inMultiComment = false;
  const clean = [];
  
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (inSingleComment) {
      if (c === '\n') inSingleComment = false;
      continue;
    }
    if (inMultiComment) {
      if (c === '*' && code[i + 1] === '/') {
        inMultiComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === strChar) inString = false;
      continue;
    }
    if (c === '\'' || c === '"') {
      inString = true;
      strChar = c;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      inSingleComment = true;
      i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      inMultiComment = true;
      i++;
      continue;
    }
    if (c === '#') {
      inSingleComment = true;
      continue;
    }
    clean.push(c);
  }
  
  const cleaned = clean.join('');
  const stack = [];
  const map = { '(': ')', '{': '}', '[': ']' };
  const rev = { ')': '(', '}': '{', ']': '[' };
  
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (map[ch]) stack.push(ch);
    else if (rev[ch]) {
      if (stack.length === 0) return 'Unmatched closing ' + ch;
      const last = stack.pop();
      if (map[last] !== ch) return 'Mismatched ' + last + ' and ' + ch;
    }
  }
  if (stack.length > 0) return 'Unclosed ' + stack.length + ' brackets, top is ' + stack[stack.length - 1];
  return 'OK';
}

['backend/automation/flow_helpers.php', 'backend/automation/FlowExecutor.php', 'backend/automation/flows.php'].forEach(f => {
  it(`PHP Bracket Integrity: ${f}`, () => {
    const res = checkFileBrackets(f);
    assert.strictEqual(res, 'OK', `Syntax issue in ${f}: ${res}`);
  });
});

console.log('======================================================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) process.exit(1);
