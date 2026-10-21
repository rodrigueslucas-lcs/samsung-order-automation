const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getClQstConfig } = require('../../config/markets/cl');
const { clCareEvidence, openClCareServices } = require('../../flows/cl/careFlows.cjs');
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

test('CL Care+ cart preparation waits for the exact product services response body', async () => {
  const events = [];
  const config = { environment: 'S2', sku: 'phone', cartUrl: new URL('https://stg2.shop.samsung.com/cl/cart') };
  const response = path => ({ url: () => `https://s2-smb-api-cdn.ecom-stg.samsung.com${path}`,
    request: () => ({ method: () => 'GET' }), ok: () => true,
    finished: async () => events.push('services-body'), json: async () => ({ entries: [] }) });
  const page = {
    waitForResponse: async predicate => {
      const service = response('/tokocommercewebservices/v2/cl/servicesv2/externalService/phone');
      if (predicate(service)) {
        assert.equal(predicate(response('/tokocommercewebservices/v2/cl/servicesv2/externalService/other')), false);
        return service;
      }
      const cart = response('/tokocommercewebservices/v2/cl/users/current/carts/current');
      assert.equal(predicate(cart), true);
      return cart;
    },
    getByRole: () => ({ locator: () => ({ press: async key => { assert.equal(key, 'Enter'); events.push('activate'); } }) }),
  };
  await openClCareServices(page, config);
  events.push('ready-to-open');
  assert.deepEqual(events, ['activate', 'services-body', 'ready-to-open']);
});
