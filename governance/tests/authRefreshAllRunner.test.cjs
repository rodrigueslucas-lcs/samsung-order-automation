const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEnvironment,
  normalizeMarkets,
  refreshAll,
} = require('../../utils/authRefreshAllRunner.cjs');

test('regional refresh defaults to all four SMB markets and S2', () => {
  assert.deepEqual(normalizeMarkets(''), ['mx', 'pe', 'co', 'cl']);
  assert.equal(normalizeEnvironment(''), 'S2');
});

test('regional refresh accepts subsets, deduplicates and rejects unsupported identities', () => {
  assert.deepEqual(normalizeMarkets(['MX', 'pe', 'mx', 'CO']), ['mx', 'pe', 'co']);
  assert.throws(() => normalizeMarkets('mx,us'), /Unsupported regional auth market/);
  assert.throws(() => normalizeEnvironment('prod'), /Use S1 or S2/);
});

test('all selected markets start before the slowest one is released', async () => {
  const started = [];
  const releases = new Map();
  const runMarket = (market, environment) => new Promise((resolve) => {
    started.push({ market, environment });
    releases.set(market, () => resolve({ market, environment, code: 0, signal: null, elapsedMs: 10, status: 'READY' }));
  });
  const work = refreshAll({ markets: ['mx', 'pe', 'co', 'cl'], environment: 'S2', env: {} }, { runMarket, log() {}, error() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started.map((entry) => entry.market), ['mx', 'pe', 'co', 'cl']);
  for (const release of releases.values()) release();
  const summary = await work;
  assert.equal(summary.ready, 4);
  assert.equal(summary.ok, true);
});

test('one market failure does not cancel successful sibling refreshes', async () => {
  const completed = [];
  const runMarket = async (market, environment) => {
    completed.push(market);
    if (market === 'co') return { market, environment, code: 1, signal: null, elapsedMs: 5, status: 'FAILED' };
    return { market, environment, code: 0, signal: null, elapsedMs: 5, status: 'READY' };
  };
  const summary = await refreshAll({ markets: ['mx', 'pe', 'co', 'cl'], environment: 'S2', env: {} }, { runMarket, log() {}, error() {} });
  assert.deepEqual(completed, ['mx', 'pe', 'co', 'cl']);
  assert.equal(summary.ready, 3);
  assert.equal(summary.failed, 1);
  assert.equal(summary.ok, false);
});

test('human CAPTCHA/MFA requirement is reported separately and siblings may finish READY', async () => {
  const runMarket = async (market, environment) => ({
    market,
    environment,
    code: market === 'pe' ? 2 : 0,
    signal: null,
    elapsedMs: 5,
    status: market === 'pe' ? 'HUMAN_REQUIRED' : 'READY',
  });
  const summary = await refreshAll({ markets: ['mx', 'pe', 'co', 'cl'], environment: 'S1', env: {} }, { runMarket, log() {}, error() {} });
  assert.equal(summary.environment, 'S1');
  assert.equal(summary.ready, 3);
  assert.equal(summary.human, 1);
  assert.equal(summary.failed, 0);
  assert.equal(summary.ok, false);
});

test('a thrown market startup error is isolated into that market result', async () => {
  const runMarket = async (market, environment) => {
    if (market === 'mx') throw new Error('fixture startup error');
    return { market, environment, code: 0, signal: null, elapsedMs: 5, status: 'READY' };
  };
  const summary = await refreshAll({ markets: ['mx', 'pe'], environment: 'S2', env: {} }, { runMarket, log() {}, error() {} });
  assert.equal(summary.ready, 1);
  assert.equal(summary.failed, 1);
  assert.match(summary.results.find((result) => result.market === 'mx').error, /fixture startup error/);
});
