const { getPreqa2Config, normalizePreqa2Market } = require('./preqa2Config');
const { bootstrapPreqa2Market } = require('./preqa2Bootstrap');

function normalizeMarketList(value = 'mx') {
  const markets = String(value || 'mx')
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(normalizePreqa2Market);
  return [...new Set(markets)];
}

function laneName(market) {
  return `SAMSUNG_QA_PREQA2_${normalizePreqa2Market(market).toUpperCase()}`;
}

function isMarketRoute(url, market) {
  try {
    const config = getPreqa2Config({ PREQA2_MARKET: market });
    const current = new URL(url);
    return current.protocol === 'https:' &&
      current.hostname === config.hostname &&
      current.pathname.toLowerCase().startsWith(`/${config.market.toLowerCase()}/`);
  } catch {
    return false;
  }
}

async function pageLaneName(page) {
  if (!page || page.isClosed?.()) return '';
  return page.evaluate(() => window.name || '').catch(() => '');
}

async function findMarketLane(context, market) {
  const expected = laneName(market);
  const pages = context.pages().filter((page) => !page.isClosed());

  for (const page of pages) {
    if ((await pageLaneName(page)) === expected) return page;
  }
  for (const page of pages) {
    if (isMarketRoute(page.url(), market)) return page;
  }
  return null;
}

async function tagMarketLane(page, market) {
  const name = laneName(market);
  await page.addInitScript((lane) => { window.name = lane; }, name);
  await page.evaluate((lane) => { window.name = lane; }, name).catch(() => {});
  return name;
}

async function openMarketLane(context, market, options = {}) {
  if (!context) throw new Error('PreQA2 market lane requires a browser context.');
  const normalized = normalizePreqa2Market(market);
  let page = options.reuse === false ? null : await findMarketLane(context, normalized);
  const reused = Boolean(page);
  if (!page) page = await context.newPage();

  await tagMarketLane(page, normalized);
  const config = await bootstrapPreqa2Market(page, {
    environment: { PREQA2_MARKET: normalized },
  });
  await tagMarketLane(page, normalized);

  if (!isMarketRoute(page.url(), normalized)) {
    throw new Error(`PreQA2 ${config.market} lane did not remain on its market route.`);
  }

  return { page, config, reused, lane: laneName(normalized) };
}

async function openMarketLanes(context, markets, options = {}) {
  const normalized = normalizeMarketList(markets);
  const results = [];
  for (const market of normalized) {
    results.push(await openMarketLane(context, market, options));
  }
  return results;
}

module.exports = {
  findMarketLane,
  isMarketRoute,
  laneName,
  normalizeMarketList,
  openMarketLane,
  openMarketLanes,
  pageLaneName,
  tagMarketLane,
};
