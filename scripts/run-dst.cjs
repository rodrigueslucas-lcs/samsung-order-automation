const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { executionPlan } = require('../utils/dstExecution.cjs');
const { acquireMarketLease } = require('../utils/authMarketLease.cjs');

function main(argv = process.argv.slice(2)) {
  const run = executionPlan(argv);
  const release = run.list ? null : acquireMarketLease(run.market.toLowerCase(), run.environment);
  try {
    if (!run.list) fs.mkdirSync(run.artifact, { recursive: true });
    const env = { ...run.childEnv, ...release?.env };
    if (release) env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require="${path.resolve('utils/authLeasePreload.cjs').replace(/\\/g, '/')}"`.trim();
    console.log(`[dst] ${run.market} ${run.environment} ${run.store} ${run.priority}; ${run.cases.map(c => c.id).join(', ')}; no finance; ${run.list ? 'DISCOVERY' : run.artifact}`);
    return spawnSync(process.execPath, run.command, { env, stdio: 'inherit', windowsHide: true }).status ?? 1;
  } finally { release?.(); }
}
if (require.main === module) { try { process.exitCode = main(); } catch (error) { console.error(`[dst] ${error.code || 'BLOCKED'}: ${error.message}`); process.exitCode = 2; } }
module.exports = { main };
