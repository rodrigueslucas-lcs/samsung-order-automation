const fs = require('node:fs');
const path = require('node:path');
const { refreshAll, normalizeMarkets, normalizeSlot } = require('../utils/authRefreshAllRunner.cjs');

function parseArgs(argv) {
  const markets = [];
  let slot = process.env.AUTH_REFRESH_SLOT || 'primary';
  let publish = process.env.JENKINS_AUTH_PUBLISH === '1';
  for (const arg of argv) {
    if (arg === '--publish') publish = true;
    else if (arg === '--no-publish') publish = false;
    else if (arg.startsWith('--slot=')) slot = arg.slice('--slot='.length);
    else markets.push(arg);
  }
  slot = normalizeSlot(slot);
  return { markets, slot, publish };
}

const args = parseArgs(process.argv.slice(2));
const requestedMarkets = args.markets.length
  ? args.markets
  : (process.env.AUTH_REFRESH_MARKETS || process.env.MARKETS || '');
const markets = normalizeMarkets(requestedMarkets, args.slot);
const environment = process.env.AUTH_REFRESH_ENVIRONMENT || process.env.ENVIRONMENT || 'S2';
let runtimeEnv = {
  ...process.env,
  AUTH_REFRESH_SLOT: args.slot,
  JENKINS_AUTH_PUBLISH: args.publish ? '1' : '0',
};
// Fail before opening four browsers if publishing cannot be configured.
if (args.publish) runtimeEnv = require('../utils/jenkinsPublisherConfig.cjs').publisherEnvironment(runtimeEnv);

function writeSummary(summary) {
  const publishSuffix = args.publish ? '-jenkins' : '';
  const output = path.resolve(
    'test-results/auth-refresh',
    `regional-${summary.environment.toLowerCase()}-${summary.slot}${publishSuffix}-summary.json`,
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    environment: summary.environment,
    slot: summary.slot,
    publishJenkins: args.publish,
    markets: summary.markets,
    ready: summary.ready,
    human: summary.human,
    busy: summary.busy,
    failed: summary.failed,
    ok: summary.ok,
    results: summary.results.map((result) => ({
      market: result.market,
      environment: result.environment,
      slot: result.slot,
      status: result.status,
      code: result.code,
      signal: result.signal,
      elapsedMs: result.elapsedMs,
      error: result.error || null,
    })),
  };
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[auth:refresh:all] Summary written to ${output}`);
}

console.log(`[auth:refresh:all] Jenkins publish: ${args.publish ? 'enabled' : 'disabled'}.`);

refreshAll({ markets, environment, slot: args.slot, env: runtimeEnv })
  .then((summary) => {
    writeSummary(summary);
    if (!summary.ok) process.exitCode = summary.failed > 0 ? 1 : summary.human > 0 ? 2 : summary.busy > 0 ? 3 : 1;
  })
  .catch((error) => {
    console.error(`[auth:refresh:all] FAILED · ${String(error.message || error).split('\n')[0]}`);
    process.exitCode = 1;
  });

module.exports = { parseArgs };
