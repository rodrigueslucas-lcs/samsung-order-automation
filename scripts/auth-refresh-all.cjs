const fs = require('node:fs');
const path = require('node:path');
const { refreshAll, normalizeMarkets } = require('../utils/authRefreshAllRunner.cjs');

const cliMarkets = process.argv.slice(2);
const markets = cliMarkets.length
  ? normalizeMarkets(cliMarkets)
  : normalizeMarkets(process.env.AUTH_REFRESH_MARKETS || process.env.MARKETS || 'mx,pe,co,cl');
const environment = process.env.AUTH_REFRESH_ENVIRONMENT || process.env.ENVIRONMENT || 'S2';

function writeSummary(summary) {
  const output = path.resolve('test-results/auth-refresh', `regional-${summary.environment.toLowerCase()}-summary.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    environment: summary.environment,
    markets: summary.markets,
    ready: summary.ready,
    human: summary.human,
    failed: summary.failed,
    ok: summary.ok,
    results: summary.results.map((result) => ({
      market: result.market,
      environment: result.environment,
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

refreshAll({ markets, environment, env: process.env })
  .then((summary) => {
    writeSummary(summary);
    if (!summary.ok) process.exitCode = summary.human > 0 && summary.failed === 0 ? 2 : 1;
  })
  .catch((error) => {
    console.error(`[auth:refresh:all] FAILED · ${String(error.message || error).split('\n')[0]}`);
    process.exitCode = 1;
  });
