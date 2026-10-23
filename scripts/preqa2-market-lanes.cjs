const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { openMarketLanes, normalizeMarketList } = require('../utils/preqa2MarketLanes.cjs');
const { safePageIdentity } = require('../utils/wmcSessionState');

const endpoint = process.env.PREQA2_CDP_URL || 'http://127.0.0.1:9223';
const markets = normalizeMarketList(process.env.PREQA2_MARKETS || process.env.PREQA2_MARKET || 'mx,pe,co,cl');

async function main() {
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 7000 });
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No browser context is available at ${endpoint}.`);

    console.log(`[preqa2-lanes] Connected to ${endpoint}; existing pages=${context.pages().length}.`);
    const lanes = await openMarketLanes(context, markets, { reuse: true });

    const results = [];
    for (const { page, config, reused, lane } of lanes) {
      const record = {
        market: config.market,
        lane,
        reused,
        url: safePageIdentity(page.url()),
        title: await page.title().catch(() => ''),
      };
      results.push(record);
      console.log(`[preqa2-lanes] ${config.market} ${reused ? 'reused' : 'opened'} · ${lane} · ${record.url}`);
    }

    const output = path.resolve('test-results/preqa2/market-lanes.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), endpoint, markets: results }, null, 2)}\n`);
    console.log(`[preqa2-lanes] READY · ${results.length} dedicated market tab(s) on one shared WMC/CDP context.`);
    console.log(`[preqa2-lanes] Discovery written to ${output}. Chrome and market tabs remain open.`);
  } finally {
    // For CDP attachment this disconnects this Playwright client only; it does
    // not terminate the externally launched Chrome or its existing pages.
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`[preqa2-lanes] FAILED · ${String(error.message || error).split('\n')[0]}`);
  process.exitCode = 1;
});
