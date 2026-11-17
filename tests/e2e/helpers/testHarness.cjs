/**
 * tests/e2e/helpers/testHarness.cjs
 * CommonJS Test Harness & Assertion Engine for MYERP Marketing Automation E2E Suites
 */

const assert = require('assert');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

class TestRegistry {
  constructor() {
    this.currentTier = 1;
    this.currentSuiteName = '';
    this.suites = [];
    this.activeSuite = null;
    this.stats = {
      totalSuites: 0,
      totalTests: 0,
      totalAssertions: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      startTime: 0,
      endTime: 0,
      tierStats: {
        1: { tests: 0, assertions: 0, passed: 0, failed: 0 },
        2: { tests: 0, assertions: 0, passed: 0, failed: 0 },
        3: { tests: 0, assertions: 0, passed: 0, failed: 0 },
        4: { tests: 0, assertions: 0, passed: 0, failed: 0 }
      }
    };
    this.failures = [];
  }

  setTier(tier) {
    this.currentTier = tier;
  }

  suite(name, fn) {
    this.currentSuiteName = name;
    this.activeSuite = {
      name,
      tier: this.currentTier,
      tests: [],
      startTime: Date.now()
    };
    this.suites.push(this.activeSuite);
    this.stats.totalSuites++;

    // Execute suite block to register tests
    fn();
  }

  test(name, fn) {
    if (!this.activeSuite) {
      this.suite('Default Suite', () => {});
    }

    const testItem = {
      name,
      fn,
      tier: this.currentTier,
      suiteName: this.currentSuiteName,
      assertions: 0,
      status: 'pending',
      error: null,
      durationMs: 0
    };

    this.activeSuite.tests.push(testItem);
    this.stats.totalTests++;
    if (this.stats.tierStats[this.currentTier]) {
      this.stats.tierStats[this.currentTier].tests++;
    }
  }

  recordAssertion() {
    this.stats.totalAssertions++;
    if (this.stats.tierStats[this.currentTier]) {
      this.stats.tierStats[this.currentTier].assertions++;
    }
    if (this.currentTest) {
      this.currentTest.assertions++;
    }
  }

  async runAll(options = {}) {
    this.stats.startTime = Date.now();
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.white}   MYERP MARKETING AUTOMATION E2E ZERO-TRUST TEST RUNNER${colors.reset}`);
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.gray}Started at: ${new Date().toISOString()} | Workspace: 99999${colors.reset}\n`);

    for (const suite of this.suites) {
      if (options.tier && suite.tier !== options.tier) continue;

      console.log(`\n${colors.bright}${colors.blue}▶ [Tier ${suite.tier}] ${suite.name}${colors.reset}`);
      for (const t of suite.tests) {
        this.currentTest = t;
        this.currentTier = t.tier;
        const start = process.hrtime.bigint();
        try {
          await t.fn();
          const end = process.hrtime.bigint();
          t.durationMs = Number(end - start) / 1000000;
          t.status = 'passed';
          this.stats.passed++;
          if (this.stats.tierStats[t.tier]) {
            this.stats.tierStats[t.tier].passed++;
          }
          console.log(`  ${colors.green}✔ [PASS]${colors.reset} ${t.name} ${colors.gray}(${t.assertions} assertions, ${t.durationMs.toFixed(2)}ms)${colors.reset}`);
        } catch (err) {
          const end = process.hrtime.bigint();
          t.durationMs = Number(end - start) / 1000000;
          t.status = 'failed';
          t.error = err;
          this.stats.failed++;
          if (this.stats.tierStats[t.tier]) {
            this.stats.tierStats[t.tier].failed++;
          }
          this.failures.push({
            suite: suite.name,
            test: t.name,
            error: err.message,
            stack: err.stack
          });
          console.error(`  ${colors.red}✖ [FAIL]${colors.reset} ${t.name}: ${colors.red}${err.message}${colors.reset}`);
        } finally {
          this.currentTest = null;
        }
      }
    }

    this.stats.endTime = Date.now();
    this.printSummary();
    return this.stats.failed === 0;
  }

  printSummary() {
    const elapsed = ((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2);
    console.log(`\n${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.white}   MARKETING AUTOMATION E2E TEST SUMMARY REPORT${colors.reset}`);
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log(`  Total Suites     : ${this.stats.totalSuites}`);
    console.log(`  Total Test Cases : ${this.stats.totalTests}`);
    console.log(`  Total Assertions : ${colors.bright}${this.stats.totalAssertions}${colors.reset}`);
    console.log(`  Passed (PASS)    : ${colors.green}${this.stats.passed}${colors.reset}`);
    console.log(`  Failed (FAIL)    : ${this.stats.failed > 0 ? colors.red + this.stats.failed + colors.reset : '0'}`);
    console.log(`  Duration         : ${elapsed}s`);
    console.log(`${colors.gray}----------------------------------------------------------------------${colors.reset}`);
    console.log(`  Tier Breakdown:`);
    for (let t = 1; t <= 4; t++) {
      const ts = this.stats.tierStats[t];
      console.log(`    Tier ${t}: ${ts.tests} tests, ${colors.bright}${ts.assertions}${colors.reset} assertions [Pass: ${colors.green}${ts.passed}${colors.reset}, Fail: ${ts.failed}]`);
    }
    console.log(`${colors.cyan}======================================================================${colors.reset}`);

    if (this.failures.length > 0) {
      console.log(`\n${colors.red}${colors.bright}FAILURES DETECTED (${this.failures.length}):${colors.reset}`);
      for (const f of this.failures) {
        console.log(`\n${colors.red}✖ [${f.suite}] ${f.test}${colors.reset}`);
        console.log(`  ${f.error}`);
        if (f.stack) {
          const lines = f.stack.split('\n').slice(1, 4).join('\n');
          console.log(`${colors.gray}${lines}${colors.reset}`);
        }
      }
    } else {
      console.log(`\n${colors.green}${colors.bright}✔ ALL E2E TESTS PASSED WITH ZERO ERRORS (Exit Code 0)${colors.reset}\n`);
    }
  }
}

const registry = new TestRegistry();

// Assertion Helpers
function assertTrue(value, message) {
  registry.recordAssertion();
  assert.strictEqual(Boolean(value), true, message || `Expected true, received ${value}`);
}

function assertFalse(value, message) {
  registry.recordAssertion();
  assert.strictEqual(Boolean(value), false, message || `Expected false, received ${value}`);
}

function assertEquals(actual, expected, message) {
  registry.recordAssertion();
  assert.strictEqual(actual, expected, message || `Expected ${expected}, got ${actual}`);
}

function assertNotEquals(actual, expected, message) {
  registry.recordAssertion();
  assert.notStrictEqual(actual, expected, message || `Expected actual not to equal ${expected}`);
}

function assertDeepEquals(actual, expected, message) {
  registry.recordAssertion();
  assert.deepStrictEqual(actual, expected, message);
}

function assertMatches(string, regex, message) {
  registry.recordAssertion();
  assert(regex.test(string), message || `String "${string}" does not match regex ${regex}`);
}

function assertContains(haystack, needle, message) {
  registry.recordAssertion();
  if (Array.isArray(haystack)) {
    assert(haystack.includes(needle), message || `Array does not contain ${JSON.stringify(needle)}`);
  } else if (typeof haystack === 'string') {
    assert(haystack.includes(needle), message || `String does not contain "${needle}"`);
  } else {
    assert(needle in haystack, message || `Object does not contain key "${needle}"`);
  }
}

function assertGreaterThan(actual, expected, message) {
  registry.recordAssertion();
  assert(actual > expected, message || `Expected ${actual} > ${expected}`);
}

function assertGreaterThanOrEqual(actual, expected, message) {
  registry.recordAssertion();
  assert(actual >= expected, message || `Expected ${actual} >= ${expected}`);
}

function assertLessThan(actual, expected, message) {
  registry.recordAssertion();
  assert(actual < expected, message || `Expected ${actual} < ${expected}`);
}

function assertLessThanOrEqual(actual, expected, message) {
  registry.recordAssertion();
  assert(actual <= expected, message || `Expected ${actual} <= ${expected}`);
}

function assertJsonSuccess(res, message) {
  registry.recordAssertion();
  assert(res && typeof res === 'object', 'Response must be an object');
  assert.strictEqual(res.success, true, message || `Expected success: true, got ${JSON.stringify(res)}`);
}

function assertJsonFailure(res, expectedSubstr) {
  registry.recordAssertion();
  assert(res && typeof res === 'object', 'Response must be an object');
  assert.strictEqual(res.success, false, `Expected success: false, got ${JSON.stringify(res)}`);
  if (expectedSubstr) {
    const msg = res.message || res.error || '';
    assert(msg.toLowerCase().includes(expectedSubstr.toLowerCase()), `Expected error to contain "${expectedSubstr}", got "${msg}"`);
  }
}

module.exports = {
  registry,
  colors,
  suite: (name, fn) => registry.suite(name, fn),
  test: (name, fn) => registry.test(name, fn),
  setTier: (tier) => registry.setTier(tier),
  assertTrue,
  assertFalse,
  assertEquals,
  assertNotEquals,
  assertDeepEquals,
  assertMatches,
  assertContains,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertLessThan,
  assertLessThanOrEqual,
  assertJsonSuccess,
  assertJsonFailure
};
