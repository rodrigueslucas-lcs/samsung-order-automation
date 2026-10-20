const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getClQstConfig } = require('../../config/markets/cl');
const { clCareEvidence } = require('../../flows/cl/careFlows.cjs');
const plan = require('../cl-qst-plan.json');

test('CL Care+ uses verified S2 data and requires explicit S1 data', () => {
  const s2 = getClQstConfig({ CL_QST_ENVIRONMENT: 'S2' });
  assert.equal(s2.scPlusSku, 'SM-S918BZKILTL');
  assert.equal(s2.scPlusPlanSku, 'P-GT-HKXXHP2C');
  assert.equal(getClQstConfig({ CL_QST_ENVIRONMENT: 'S1' }).scPlusSku, '');
  assert.equal(getClQstConfig({ CL_QST_ENVIRONMENT: 'S1', CL_QST_SC_PLUS_SKU: 'custom', CL_QST_SC_PLUS_PLAN_SKU: 'plan' }).scPlusPlanSku, 'plan');
});

test('CL Trade-in and Care+ enter through PDP while retaining official cart objectives', () => {
  for (const id of ['SAM-24803', 'SAM-24804']) {
    assert.equal(plan.cases[id].entryPoint, 'PDP');
    assert.match(plan.cases[id].title, /cart page/);
  }
});

function cart() {
  return { totalPrice: { value: 1481980 }, entries: [
    { product: { code: 'phone' }, quantity: 1, selectedAddedServices: [{ serviceProduct: { code: 'care' }, quantity: 1 }] },
    { product: { code: 'care' }, quantity: 1, isServiceEntry: true, totalPrice: { value: 36990 } },
  ] };
}

test('Care+ proof requires both source linkage and a persisted priced service entry', () => {
  assert.equal(clCareEvidence(cart(), { sku: 'phone', planSku: 'care' }).servicePrice, 36990);
  for (const mutate of [c => c.entries.pop(), c => c.entries[0].selectedAddedServices = [],
    c => c.entries[1].quantity = 2, c => c.entries[1].totalPrice.value = 0,
    c => c.entries[0].quantity = 2, c => c.entries[1].product.code = 'wrong']) {
    const value = cart(); mutate(value);
    assert.throws(() => clCareEvidence(value, { sku: 'phone', planSku: 'care' }), /did not persist/);
  }
});
