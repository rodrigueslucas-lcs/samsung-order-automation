const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getCoTrackingPrerequisite } = require('../../utils/coTrackingPrerequisite.cjs');
const fixture = { market: 'CO', environment: 'S1', confirmed: true, sku: 'CO-SKU',
  orderNumber: 'CO261014-12345678_123', email: 'co-qa@mailinator.com', inbox: 'co-qa' };
test('CO tracking accepts a confirmed same-environment order and normalizes its public number', () => {
  assert.deepEqual(getCoTrackingPrerequisite(fixture, 'S1', 'CO-SKU'), {
    orderNumber: 'CO261014-12345678', email: 'co-qa@mailinator.com', inbox: 'co-qa',
  });
});
test('CO tracking rejects foreign environments, markets, products and unconfirmed orders', () => {
  for (const change of [{environment:'S2'}, {market:'PE'}, {sku:'OTHER'}, {confirmed:false}, {orderNumber:'MX261014-12345678'}]) {
    assert.equal(getCoTrackingPrerequisite({...fixture,...change}, 'S1', 'CO-SKU'), null);
  }
});
test('CO tracking requires the matching test mailbox and rejects malformed identities', () => {
  for (const change of [{email:'other@mailinator.com'}, {email:'co-qa@example.test'}, {inbox:''}, {orderNumber:'invalid'}]) {
    assert.equal(getCoTrackingPrerequisite({...fixture,...change}, 'S1', 'CO-SKU'), null);
  }
});
