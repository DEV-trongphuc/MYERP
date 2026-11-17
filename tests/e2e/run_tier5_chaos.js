/**
 * tests/e2e/run_tier5_chaos.js
 * Runner for Milestone 5 Chaos Engineering & 8-Vector Security Pentest
 */

import { registry, colors } from './helpers/testHarness.js';
import { registerTier5ChaosPentest } from './tier5_chaos_pentest.js';

async function main() {
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   MYERP TIER 5 CHAOS & 8-VECTOR ADVERSARIAL PENTEST RUNNER${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.dim}Date: ${new Date().toISOString()} | Node: ${process.version} | OS: ${process.platform}${colors.reset}\n`);

  registry.reset();
  registerTier5ChaosPentest();

  const success = await registry.run();
  if (!success) {
    console.error(`\n${colors.bold}${colors.red}❌ TIER 5 CHAOS PENTEST DETECTED FAILURES!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}✔ ALL TIER 5 8-VECTOR CHAOS & SECURITY PENTESTS PASSED!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
