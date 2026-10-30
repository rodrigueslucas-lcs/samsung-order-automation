const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareClPaymentCart, validateClPaymentCartTarget } = require('../../flows/cl/paymentCart.cjs');
const cfg = { environment: 'S2', cartUrl: 'https://stg2.shop.samsung.com/cl/cart', sku: 'TARGET' };

test('documented CL programmes use their own OCC cart endpoint and reject unknown or mismatched programme IDs',()=>{
 for(const environment of ['S1','S2'])for(const program of ['alianzas','colaboradores','ventab2b_cl']){
  const storefront=require('../../config/markets/epp').getEppConfig('CL',{ENVIRONMENT:environment,EPP_PROGRAM:program});
  const config={environment,cartUrl:storefront.cartUrl,storefront};
  assert.equal(validateClPaymentCartTarget(config),`https://${environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${program}/users/current/carts/current`);
  assert.throws(()=>validateClPaymentCartTarget({...config,storefront:{...storefront,program:'other'}}),/canonical staging programme/);
  const rootUrl=new URL('/cl/multistore/unknown/unknown/',storefront.rootUrl);
  assert.throws(()=>validateClPaymentCartTarget({...config,cartUrl:new URL('cart',rootUrl),storefront:{...storefront,rootUrl}}),/canonical staging programme/);
 }
});
test('EPP cart preparation reuses exact observed authorization and GET readback without reloading the rendered cart',async()=>{
 const rootUrl=new URL('https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/'),config={environment:'S1',cartUrl:new URL('cart',rootUrl),sku:'TARGET',storefront:{market:'CL',environment:'S1',rootUrl}};
 const api=validateClPaymentCartTarget(config);let reads=0;
 const observedResponse={url:()=>api,request:()=>({method:()=> 'GET',headerValue:async()=> 'synthetic'})};
 const page={goto:async()=>{throw Error('must not reload');},context:()=>({request:{get:async(url,options)=>{assert.equal(url,api);assert.equal(options.maxRedirects,0);reads++;return{ok:()=>true,json:async()=>({entries:[{entryNumber:0,product:{code:'TARGET'},quantity:1}]})};}}})};
 const prepared=await prepareClPaymentCart(page,config,{observedResponse});assert.equal((await prepared.readCart()).entries[0].quantity,1);assert.equal(reads,2);
 await assert.rejects(prepareClPaymentCart(page,config,{observedResponse:{...observedResponse,url:()=> 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/cl/users/current/carts/current'}}),/another endpoint/);
});
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
