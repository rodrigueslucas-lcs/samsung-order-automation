const { refreshAll, normalizeMarkets } = require('../utils/authRefreshAllRunner.cjs');

const cliMarkets = process.argv.slice(2);
const markets = cliMarkets.length
  ? normalizeMarkets(cliMarkets)
  : normalizeMarkets(process.env.AUTH_REFRESH_MARKETS || process.env.MARKETS || 'mx,pe,co,cl');
const environment = process.env.AUTH_REFRESH_ENVIRONMENT || process.env.ENVIRONMENT || 'S2';

refreshAll({ markets, environment, env: process.env })
  .then((summary) => {
    if (!summary.ok) process.exitCode = summary.human > 0 && summary.failed === 0 ? 2 : 1;
  })
  .catch((error) => {
    console.error(`[auth:refresh:all] FAILED · ${String(error.message || error).split('\n')[0]}`);
    process.exitCode = 1;
  });
