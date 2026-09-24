const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MX_BASE_P1_SOURCE_IDS,
  MX_BASE_P1_EXCLUSIONS,
  MX_BASE_P1_IDS,
  mxScopeExclusion,
} = require('../utils/mxQstScope.cjs');

test('MX active Base Store P1 scope is 29 after the documented SAM-25006 exclusion', () => {
  assert.equal(MX_BASE_P1_SOURCE_IDS.length, 30);
  assert.equal(MX_BASE_P1_IDS.length, 29);
  assert.equal(Object.keys(MX_BASE_P1_EXCLUSIONS).length, 1);
  assert.ok(MX_BASE_P1_SOURCE_IDS.includes('SAM-25006'));
  assert.ok(!MX_BASE_P1_IDS.includes('SAM-25006'));
  assert.equal(mxScopeExclusion('SAM-25006')?.preserveHistoricalTraceability, true);
  assert.match(mxScopeExclusion('SAM-25006')?.reason || '', /Colombia/i);
});

test('all active MX Base Store P1 IDs are unique', () => {
  assert.equal(new Set(MX_BASE_P1_IDS).size, MX_BASE_P1_IDS.length);
});
