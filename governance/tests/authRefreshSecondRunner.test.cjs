const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMarkets,
  normalizeSlot,
  refreshAll,
} = require('../../utils/authRefreshAllRunner.cjs');

test('second regional refresh is supported only for MX and CO', () => {
  assert.equal(normalizeSlot('SECOND'), 'second');
  assert.deepEqual(normalizeMarkets('', 'second'), ['mx', 'co']);
  assert.deepEqual(normalizeMarkets('mx,co,mx', 'second'), ['mx', 'co']);
  assert.throws(() => normalizeMarkets('pe', 'second'), /does not support regional second auth refresh/);
  assert.throws(() => normalizeMarkets('cl', 'second'), /does not support regional second auth refresh/);
});

test('second refresh starts MX and CO in parallel with explicit second slot', async () => {
  const calls = [];
  const releases = new Map();
  const runMarket = (market, environment, slot) => new Promise((resolve) => {
    calls.push({ market, environment, slot });
    releases.set(market, () => resolve({ market, environment, slot, code: 0, signal: null, elapsedMs: 5, status: 'READY' }));
  });
  const work = refreshAll({ environment: 'S2', slot: 'second', env: {} }, { runMarket, log() {}, error() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    { market: 'mx', environment: 'S2', slot: 'second' },
    { market: 'co', environment: 'S2', slot: 'second' },
  ]);
  for (const release of releases.values()) release();
  const summary = await work;
  assert.equal(summary.slot, 'second');
  assert.equal(summary.ready, 2);
  assert.equal(summary.ok, true);
});

test('primary regional refresh still defaults to all four markets', () => {
  assert.deepEqual(normalizeMarkets('', 'primary'), ['mx', 'pe', 'co', 'cl']);
});
