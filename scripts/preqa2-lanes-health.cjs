const { chromium } = require('playwright');
const { normalizeMarketList, laneName, pageLaneName, isMarketRoute } = require('../utils/preqa2MarketLanes.cjs');
const { safePageIdentity } = require('../utils/wmcSessionState');

const endpoint = process.env.PREQA2_CDP_URL || 'http://127.0.0.1:9223';
const markets = normalizeMarketList(process.env.PREQA2_MARKETS || 'mx,pe,co,cl');

async function main() {
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 7000 });
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No browser context is available at ${endpoint}.`);

    const pages = context.pages().filter((page) => !page.isClosed());
    const results = [];

    for (const market of markets) {
      const expectedLane = laneName(market);
      let lanePage = null;
      for (const page of pages) {
        if ((await pageLaneName(page)) === expectedLane) {
          lanePage = page;
          break;
        }
      }

      const healthy = Boolean(lanePage && isMarketRoute(lanePage.url(), market));
      results.push({ market: market.toUpperCase(), lane: expectedLane, healthy, url: lanePage ? safePageIdentity(lanePage.url()) : 'missing' });
    }

    for (const result of results) {
      console.log(`[preqa2-health] ${result.healthy ? 'PASS' : 'FAIL'} · ${result.market} · ${result.lane} · ${result.url}`);
    }

    const failed = results.filter((result) => !result.healthy);
    if (failed.length) {
      throw new Error(`${failed.length} PreQA2 market lane(s) are missing or on the wrong route: ${failed.map((item) => item.market).join(', ')}.`);
    }

    console.log(`[preqa2-health] READY · ${results.length}/${results.length} market lanes healthy on one shared WMC/CDP context.`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`[preqa2-health] FAILED · ${String(error.message || error).split('\n')[0]}`);
  process.exitCode = 1;
});
