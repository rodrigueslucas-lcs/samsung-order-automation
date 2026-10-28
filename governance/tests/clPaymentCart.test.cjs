const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareClPaymentCart, validateClPaymentCartTarget } = require('../../flows/cl/paymentCart.cjs');
const cfg = { environment: 'S2', cartUrl: 'https://stg2.shop.samsung.com/cl/cart', sku: 'TARGET' };
test('CL EPP cleanup requires explicit exact programme and environment, without changing Base Store defaults',()=>{
  for(const [environment,host] of [['S1','stg.shop.samsung.com'],['S2','stg2.shop.samsung.com']]){
    const rootUrl=new URL('https://'+host+'/cl/multistore/alianzas/alianzas/');
    const config={environment,cartUrl:new URL('cart',rootUrl).href,storefront:{market:'CL',environment,rootUrl}};
    assert.match(validateClPaymentCartTarget(config),/\/v2\/alianzas\/users\/current\/carts\/current$/);
    assert.throws(()=>validateClPaymentCartTarget({...config,cartUrl:'https://'+host+'/cl/cart'}),/canonical staging programme/);
    assert.throws(()=>validateClPaymentCartTarget({...config,storefront:{...config.storefront,market:'MX'}}),/canonical staging programme/);
    assert.throws(()=>validateClPaymentCartTarget({...config,storefront:{...config.storefront,rootUrl:new URL('https://www.samsung.com/cl/multistore/alianzas/alianzas/')}}),/canonical staging programme/);
  }
  assert.match(validateClPaymentCartTarget(cfg),/\/v2\/cl\/users\/current\/carts\/current$/);
});

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
