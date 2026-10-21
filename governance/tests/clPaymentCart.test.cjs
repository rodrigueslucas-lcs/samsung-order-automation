const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareClPaymentCart, validateClPaymentCartTarget } = require('../../flows/cl/paymentCart.cjs');
const cfg = { environment: 'S2', cartUrl: 'https://stg2.shop.samsung.com/cl/cart', sku: 'TARGET' };

test('CL payment cleanup refuses production, foreign paths and mismatched environments', () => {
  for (const config of [{ ...cfg, environment: 'S3' }, { ...cfg, environment: 'S1' },
    { ...cfg, cartUrl: 'https://shop.samsung.com/cl/cart' }, { ...cfg, cartUrl: 'https://stg2.shop.samsung.com/pe/cart' }]) {
    assert.throws(() => validateClPaymentCartTarget(config), /S1\/S2 staging cart/);
  }
});

for (const persist of [true, false]) {
  test(`CL payment setup preserves target and never retries an unconfirmed removal (persist=${persist})`, async () => {
    let entries = [{ entryNumber: 0, product: { code: 'OLD' } }, { entryNumber: 1, product: { code: 'TARGET' } }];
    let deletes = 0;
    const page = { goto: async () => {}, waitForResponse: async predicate => {
      const request = { method: () => 'GET', headerValue: async () => 'test-only' };
      const response = { ok: () => true, request: () => request,
        url: () => `${validateClPaymentCartTarget(cfg)}?fields=FULL&lang=es_CL`, json: async () => ({ entries }) };
      assert.equal(predicate(response), true); return response;
    }, context: () => ({ request: { delete: async url => {
      assert.equal(url, `${validateClPaymentCartTarget(cfg)}/entries/0`); deletes++;
      if (persist) entries = entries.filter(e => e.product.code !== 'OLD');
      return { ok: () => true };
    } } }) };
    if (persist) { await prepareClPaymentCart(page, cfg); assert.equal(entries[0].product.code, 'TARGET'); }
    else await assert.rejects(prepareClPaymentCart(page, cfg), /no deletion will be retried/);
    assert.equal(deletes, 1);
  });
}
