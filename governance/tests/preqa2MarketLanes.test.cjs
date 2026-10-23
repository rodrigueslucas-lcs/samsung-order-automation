const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isMarketRoute,
  laneName,
  normalizeMarketList,
} = require('../../utils/preqa2MarketLanes.cjs');

test('normalizes and deduplicates requested PreQA2 market lanes', () => {
  assert.deepEqual(normalizeMarketList('MX, pe;CO mx CL'), ['mx', 'pe', 'co', 'cl']);
});

test('assigns deterministic isolated lane names for every SMB market', () => {
  assert.equal(laneName('mx'), 'SAMSUNG_QA_PREQA2_MX');
  assert.equal(laneName('pe'), 'SAMSUNG_QA_PREQA2_PE');
  assert.equal(laneName('co'), 'SAMSUNG_QA_PREQA2_CO');
  assert.equal(laneName('cl'), 'SAMSUNG_QA_PREQA2_CL');
});

test('matches only the requested market route on the approved PreQA2 host', () => {
  assert.equal(isMarketRoute('https://p6-pre-qa2.samsung.com/mx/', 'mx'), true);
  assert.equal(isMarketRoute('https://p6-pre-qa2.samsung.com/mx/cart', 'mx'), true);
  assert.equal(isMarketRoute('https://p6-pre-qa2.samsung.com/pe/', 'mx'), false);
  assert.equal(isMarketRoute('https://example.com/mx/', 'mx'), false);
});

test('rejects unsupported market identities before a lane can be created', () => {
  assert.throws(() => laneName('us'), /must be one of/);
  assert.throws(() => normalizeMarketList('mx,us'), /must be one of/);
});
