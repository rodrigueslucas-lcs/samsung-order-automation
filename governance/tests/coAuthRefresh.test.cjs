const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runRefreshFixture } = require('../fixtures/authRefreshHarness.cjs');
test('CO refresh resolves MX second-slot alias consistently across login, verify and package', async () => {
  const { calls } = await runRefreshFixture('co', { CO_QST_ENVIRONMENT: 'S1', MX_AUTH_SLOT: 'second' });
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.env.CO_AUTH_SLOT, 'second');
    assert.equal(call.env.CO_AUTH_MANUAL, '1');
    assert.equal(call.env.CO_QST_ENVIRONMENT, 'S1');
  }
});
test('CO refresh rejects conflicting account slots before any auth operation', async () => {
  await assert.rejects(runRefreshFixture('co', { CO_AUTH_SLOT: 'primary', MX_AUTH_SLOT: 'second' }), /Conflicting auth slots/);
});
