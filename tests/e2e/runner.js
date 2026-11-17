/**
 * tests/e2e/runner.js
 * Master Automated Test Runner for MYERP E2E Zero-Trust Testing Suite.
 * Executes all 14 Features across 4 Tiers (143 test cases).
 */

import { registry, colors } from './helpers/testHarness.js';

// Tier 1: Feature Coverage (Features 1 - 13)
import { registerFeature1Tests } from './tier1_feature_coverage/feat01_decouple_ticket.test.js';
import { registerFeature2Tests } from './tier1_feature_coverage/feat02_soft_delete_mandate.test.js';
import { registerFeature3Tests } from './tier1_feature_coverage/feat03_sql_hardening.test.js';
import { registerFeature4Tests } from './tier1_feature_coverage/feat04_anti_self_approval.test.js';
import { registerFeature5Tests } from './tier1_feature_coverage/feat05_strict_rbac.test.js';
import { registerFeature6Tests } from './tier1_feature_coverage/feat06_idor_prevention.test.js';
import { registerFeature7Tests } from './tier1_feature_coverage/feat07_route_guards.test.js';
import { registerFeature8Tests } from './tier1_feature_coverage/feat08_automation_flows.test.js';
import { registerFeature9Tests } from './tier1_feature_coverage/feat09_soft_delete_unicode.test.js';
import { registerFeature10Tests } from './tier1_feature_coverage/feat10_survey_builder_email.test.js';
import { registerFeature11Tests } from './tier1_feature_coverage/feat11_web_tracking_recharts.test.js';
import { registerFeature12Tests } from './tier1_feature_coverage/feat12_academic_modal.test.js';
import { registerFeature13Tests } from './tier1_feature_coverage/feat13_ui_ux_brand_dna.test.js';

// Tier 2: Boundary & Corner Cases (Features 1 - 13)
import { registerFeature1BoundaryTests } from './tier2_boundary_cases/feat01_boundary.test.js';
import { registerFeature2BoundaryTests } from './tier2_boundary_cases/feat02_boundary.test.js';
import { registerFeature3BoundaryTests } from './tier2_boundary_cases/feat03_boundary.test.js';
import { registerFeature4BoundaryTests } from './tier2_boundary_cases/feat04_boundary.test.js';
import { registerFeature5BoundaryTests } from './tier2_boundary_cases/feat05_boundary.test.js';
import { registerFeature6BoundaryTests } from './tier2_boundary_cases/feat06_boundary.test.js';
import { registerFeature7BoundaryTests } from './tier2_boundary_cases/feat07_boundary.test.js';
import { registerFeature8BoundaryTests } from './tier2_boundary_cases/feat08_boundary.test.js';
import { registerFeature9BoundaryTests } from './tier2_boundary_cases/feat09_boundary.test.js';
import { registerFeature10BoundaryTests } from './tier2_boundary_cases/feat10_boundary.test.js';
import { registerFeature11BoundaryTests } from './tier2_boundary_cases/feat11_boundary.test.js';
import { registerFeature12BoundaryTests } from './tier2_boundary_cases/feat12_boundary.test.js';
import { registerFeature13BoundaryTests } from './tier2_boundary_cases/feat13_boundary.test.js';

// Tier 3: Cross-Feature Interactions
import { registerXF01Tests } from './tier3_cross_feature/xf01_ticket_rbac.test.js';
import { registerXF02Tests } from './tier3_cross_feature/xf02_ticket_idor.test.js';
import { registerXF03Tests } from './tier3_cross_feature/xf03_soft_delete_approval.test.js';
import { registerXF04Tests } from './tier3_cross_feature/xf04_sql_flows.test.js';
import { registerXF05Tests } from './tier3_cross_feature/xf05_rbac_route_guards.test.js';
import { registerXF06Tests } from './tier3_cross_feature/xf06_flow_unicode_softdelete.test.js';
import { registerXF07Tests } from './tier3_cross_feature/xf07_webtracking_brand_dna.test.js';
import { registerXF08Tests } from './tier3_cross_feature/xf08_academic_brand_dna.test.js';

// Tier 4: Real-World Workload Scenarios
import { registerRW01Tests } from './tier4_real_world/rw01_sales_lead_lifecycle.test.js';
import { registerRW02Tests } from './tier4_real_world/rw02_financial_deposit_audit.test.js';
import { registerRW03Tests } from './tier4_real_world/rw03_academic_dispatch.test.js';
import { registerRW04Tests } from './tier4_real_world/rw04_marketing_campaign_analytics.test.js';
import { registerRW05Tests } from './tier4_real_world/rw05_multi_tenant_chaos_defense.test.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const filter = {};
  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      filter.tier = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--feature=')) {
      filter.featureId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--pattern=')) {
      filter.pattern = arg.split('=')[1];
    }
  }
  return filter;
}

async function main() {
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   MYERP E2E ZERO-TRUST AUTOMATED TEST RUNNER (TIERS 1 - 4)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.dim}Date: ${new Date().toISOString()} | Node: ${process.version} | OS: ${process.platform}${colors.reset}\n`);

  registry.reset();

  // Register Tier 1
  registerFeature1Tests();
  registerFeature2Tests();
  registerFeature3Tests();
  registerFeature4Tests();
  registerFeature5Tests();
  registerFeature6Tests();
  registerFeature7Tests();
  registerFeature8Tests();
  registerFeature9Tests();
  registerFeature10Tests();
  registerFeature11Tests();
  registerFeature12Tests();
  registerFeature13Tests();

  // Register Tier 2
  registerFeature1BoundaryTests();
  registerFeature2BoundaryTests();
  registerFeature3BoundaryTests();
  registerFeature4BoundaryTests();
  registerFeature5BoundaryTests();
  registerFeature6BoundaryTests();
  registerFeature7BoundaryTests();
  registerFeature8BoundaryTests();
  registerFeature9BoundaryTests();
  registerFeature10BoundaryTests();
  registerFeature11BoundaryTests();
  registerFeature12BoundaryTests();
  registerFeature13BoundaryTests();

  // Register Tier 3
  registerXF01Tests();
  registerXF02Tests();
  registerXF03Tests();
  registerXF04Tests();
  registerXF05Tests();
  registerXF06Tests();
  registerXF07Tests();
  registerXF08Tests();

  // Register Tier 4
  registerRW01Tests();
  registerRW02Tests();
  registerRW03Tests();
  registerRW04Tests();
  registerRW05Tests();

  const filter = parseArgs();
  const { stats, failures } = await registry.run(filter);

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}   TEST EXECUTION SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`  Total Test Cases : ${colors.bold}${stats.total}${colors.reset}`);
  console.log(`  Passed (PASS)    : ${colors.green}${colors.bold}${stats.passed}${colors.reset}`);
  console.log(`  Failed (FAIL)    : ${stats.failed > 0 ? colors.red + colors.bold + stats.failed : colors.dim + '0'}${colors.reset}`);
  console.log(`  Skipped (SKIP)   : ${colors.dim}${stats.skipped}${colors.reset}`);
  console.log(`  Duration         : ${colors.yellow}${stats.durationMs}ms${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);

  if (failures.length > 0) {
    console.log(`\n${colors.bold}${colors.red}❌ FAILED TEST CASES DETAILS (${failures.length}):${colors.reset}`);
    failures.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] Suite: ${f.suite} | Test: ${f.test} (${f.duration}ms)`);
      console.log(`    ${colors.red}${f.error.stack || f.error.message}${colors.reset}`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}✔ ALL ${stats.total} E2E TEST CASES PASSED WITH 100% SUCCESS RATE!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal test runner error: ${err.message}${colors.reset}`);
  process.exit(1);
});
