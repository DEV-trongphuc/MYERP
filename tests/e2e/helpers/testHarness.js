/**
 * tests/e2e/helpers/testHarness.js
 * High-performance, zero-dependency test harness and assertion library
 * Designed for MYERP E2E Zero-Trust Testing Track.
 */

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

class TestRegistry {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0
    };
    this.failures = [];
  }

  reset() {
    this.suites = [];
    this.currentSuite = null;
    this.stats = { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    this.failures = [];
  }

  describe(name, fn) {
    const parentSuite = this.currentSuite;
    const suite = {
      name,
      tests: [],
      parent: parentSuite
    };
    this.suites.push(suite);
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parentSuite;
    }
  }

  it(name, fn, options = {}) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {});
    }
    this.currentSuite.tests.push({
      name,
      fn,
      skip: options.skip || false,
      tier: options.tier || 1,
      featureId: options.featureId || null
    });
  }

  async run(filter = {}) {
    const startTime = performance.now();
    this.stats = { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    this.failures = [];

    for (const suite of this.suites) {
      let suitePrinted = false;

      for (const test of suite.tests) {
        if (filter.tier && test.tier !== filter.tier) continue;
        if (filter.featureId && test.featureId !== filter.featureId) continue;
        if (filter.pattern && !test.name.toLowerCase().includes(filter.pattern.toLowerCase()) && !suite.name.toLowerCase().includes(filter.pattern.toLowerCase())) continue;

        if (!suitePrinted) {
          console.log(`\n${colors.bold}${colors.cyan}▶ Suite: ${suite.name}${colors.reset}`);
          suitePrinted = true;
        }

        this.stats.total++;

        if (test.skip) {
          this.stats.skipped++;
          console.log(`  ${colors.yellow}⊘ [SKIP]${colors.reset} ${test.name}`);
          continue;
        }

        const t0 = performance.now();
        try {
          await test.fn();
          const t1 = performance.now();
          const duration = (t1 - t0).toFixed(2);
          this.stats.passed++;
          console.log(`  ${colors.green}✔ [PASS]${colors.reset} ${test.name} ${colors.dim}(${duration}ms)${colors.reset}`);
        } catch (err) {
          const t1 = performance.now();
          const duration = (t1 - t0).toFixed(2);
          this.stats.failed++;
          this.failures.push({
            suite: suite.name,
            test: test.name,
            error: err,
            duration
          });
          console.log(`  ${colors.red}✖ [FAIL]${colors.reset} ${test.name} ${colors.dim}(${duration}ms)${colors.reset}`);
          console.log(`    ${colors.red}${err.message}${colors.reset}`);
        }
      }
    }

    this.stats.durationMs = (performance.now() - startTime).toFixed(2);
    return {
      stats: this.stats,
      failures: this.failures
    };
  }
}

export const registry = new TestRegistry();

export function describe(name, fn) {
  registry.describe(name, fn);
}

export function it(name, fn, options = {}) {
  registry.it(name, fn, options);
}

// Assertions
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    const detail = `Expected: ${JSON.stringify(expected)} | Actual: ${JSON.stringify(actual)}`;
    throw new Error(message ? `${message} -> ${detail}` : detail);
  }
}

export function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    const detail = `Expected: ${expectedStr} | Actual: ${actualStr}`;
    throw new Error(message ? `${message} -> ${detail}` : detail);
  }
}

export function assertIncludes(haystack, needle, message = '') {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected string to include "${needle}"`);
    }
  } else if (Array.isArray(haystack)) {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected array to include item: ${JSON.stringify(needle)}`);
    }
  } else if (haystack && typeof haystack === 'object') {
    if (!(needle in haystack)) {
      throw new Error(message || `Expected object to have key: "${needle}"`);
    }
  } else {
    throw new Error(`Invalid haystack type for assertIncludes: ${typeof haystack}`);
  }
}

export function assertThrows(fn, expectedPattern, message = '') {
  let thrown = false;
  let thrownError = null;
  try {
    fn();
  } catch (err) {
    thrown = true;
    thrownError = err;
  }
  if (!thrown) {
    throw new Error(message || 'Expected function to throw, but it executed without error');
  }
  if (expectedPattern) {
    const errMsg = thrownError?.message || String(thrownError);
    if (expectedPattern instanceof RegExp) {
      if (!expectedPattern.test(errMsg)) {
        throw new Error(`Expected error message matching ${expectedPattern}, got: "${errMsg}"`);
      }
    } else if (typeof expectedPattern === 'string') {
      if (!errMsg.includes(expectedPattern)) {
        throw new Error(`Expected error message including "${expectedPattern}", got: "${errMsg}"`);
      }
    }
  }
}

export async function assertRejects(asyncFn, expectedPattern, message = '') {
  let thrown = false;
  let thrownError = null;
  try {
    await asyncFn();
  } catch (err) {
    thrown = true;
    thrownError = err;
  }
  if (!thrown) {
    throw new Error(message || 'Expected async function to reject, but it resolved without error');
  }
  if (expectedPattern) {
    const errMsg = thrownError?.message || String(thrownError);
    if (expectedPattern instanceof RegExp) {
      if (!expectedPattern.test(errMsg)) {
        throw new Error(`Expected rejection matching ${expectedPattern}, got: "${errMsg}"`);
      }
    } else if (typeof expectedPattern === 'string') {
      if (!errMsg.includes(expectedPattern)) {
        throw new Error(`Expected rejection including "${expectedPattern}", got: "${errMsg}"`);
      }
    }
  }
}
