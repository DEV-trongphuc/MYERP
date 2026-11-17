/**
 * tests/e2e/marketing_e2e_runner.cjs
 * Master Test Runner for MYERP Marketing Automation E2E Zero-Trust Testing Suite
 * Executes 4 Tiers:
 *   - Tier 1: Functional Feature Coverage (Features 1 - 37)
 *   - Tier 2: Boundary, NULLs, Limits & Adversarial Hardening (Features 1 - 37)
 *   - Tier 3: Pairwise Cross-Subsystem Feature Interactions (38 Tests)
 *   - Tier 4: Real-World Multistep Workload Scenarios (20 Steps across 5 Scenarios)
 */

const { registry } = require('./helpers/testHarness.cjs');
const { dbClient, TEST_WORKSPACE_ID } = require('./helpers/marketingFixtures.cjs');

// Import test suites
const { registerTier1AudienceTests } = require('./suites/tier1_audience.cjs');
const { registerTier1FlowsTests } = require('./suites/tier1_flows.cjs');
const { registerTier1TrackingTests } = require('./suites/tier1_tracking.cjs');
const { registerTier2BoundaryTests } = require('./suites/tier2_boundaries.cjs');
const { registerTier3PairwiseTests } = require('./suites/tier3_pairwise.cjs');
const { registerTier4ApplicationTests } = require('./suites/tier4_application.cjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      options.tier = parseInt(arg.split('=')[1], 10);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();

  // 1. Establish database connection and isolate workspace 99999
  await dbClient.connect();
  console.log(`[SETUP] Cleaning workspace ${TEST_WORKSPACE_ID} before test execution...`);
  await dbClient.cleanWorkspace(TEST_WORKSPACE_ID);

  // 2. Register all 4-Tier test suites
  console.log('[REGISTRY] Registering 4-Tier test suites...');
  registerTier1AudienceTests();
  registerTier1FlowsTests();
  registerTier1TrackingTests();
  registerTier2BoundaryTests();
  registerTier3PairwiseTests();
  registerTier4ApplicationTests();

  // 3. Execute all test suites
  const success = await registry.runAll(options);

  // 4. Teardown & cleanup test workspace
  console.log(`\n[TEARDOWN] Cleaning up workspace ${TEST_WORKSPACE_ID}...`);
  await dbClient.cleanWorkspace(TEST_WORKSPACE_ID);
  await dbClient.close();

  // 5. Exit with appropriate status code
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error('\n[FATAL ERROR] Test runner crashed:', err);
  process.exit(1);
});
