const fs = require('node:fs'); const path = require('node:path');
const { runKeepAliveCycle } = require('../utils/authKeepAliveRunner.cjs');
const { publisherEnvironment } = require('../utils/jenkinsPublisherConfig.cjs');
const { jenkinsBuildsIdle } = require('../utils/authJenkinsActivity.cjs');
function parseArgs(argv, env = process.env) {
  let publish = env.AUTH_KEEPALIVE_PUBLISH !== '0';
  let environment = env.AUTH_KEEPALIVE_ENVIRONMENT || env.ENVIRONMENT || 'S2';
  let scheduled = false;
  let markets = ['mx','pe','co','cl'];
  for (const arg of argv) {
    if (arg === '--no-publish') publish = false;
    else if (arg === '--publish') publish = true;
    else if (arg === '--scheduled') scheduled = true;
    else if (arg.startsWith('--markets=')) markets = [...new Set(arg.slice('--markets='.length).split(',').map(m => m.trim().toLowerCase()))];
    else if (arg.startsWith('--environment=')) environment = arg.slice('--environment='.length);
    else throw new Error('Unsupported keep-alive argument.');
  }
  environment = String(environment).trim().toUpperCase();
  if (!['S1','S2'].includes(environment)) throw new Error('Keep-alive requires S1 or S2.');
  if (!markets.length || markets.some(m => !['mx','pe','co','cl'].includes(m))) throw new Error('Invalid keep-alive market scope.');
  return { publish, environment, scheduled, markets };
}
async function main({ argv = process.argv.slice(2), env = process.env, cycle = runKeepAliveCycle, activity = jenkinsBuildsIdle, configure = publisherEnvironment, log = console.log, save = true } = {}) {
  const args = parseArgs(argv, env);
  const runtimeEnv = configure(env);
  const activityResult = await activity(runtimeEnv, { markets: args.markets });
  if (!activityResult.idle) { log('[auth:keepalive] BUSY: Samsung builds are running/queued; no auth operation was started.'); return 3; }
  const summary = await cycle({ environment: args.environment, markets: args.markets, publish: args.publish, env: runtimeEnv });
  if (save) {
    const output = path.resolve('test-results/auth-keepalive', `last-cycle-${args.environment.toLowerCase()}${args.markets.length === 4 ? '' : '-' + [...args.markets].sort().join('-')}.json`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), ...summary }, null, 2));
  }
  if (summary.ok) return 0;
  if (summary.blocking?.some(r => r.status === 'HUMAN_REQUIRED')) return 2;
  return summary.busy?.length && !summary.blocking?.length ? 3 : 1;
}
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(() => { console.error('[auth:keepalive] FAILED: no READY was emitted; inspect the safe phase/status summary.'); process.exitCode = 1; });
module.exports = { parseArgs, main };
