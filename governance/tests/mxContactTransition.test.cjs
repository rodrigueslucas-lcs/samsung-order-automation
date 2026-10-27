const { test } = require('node:test');
const assert = require('node:assert/strict');
const { continueMxContactToDelivery, continueMxDeliveryToPayment } = require('../../utils/mxContactTransition.cjs');

function fixture({ environment = 'S2', status = 200, failure = null, body = Promise.resolve(null), epp = false, targetStep='CHECKOUT_STEP_DELIVERY' } = {}) {
  const origin = environment === 'S2' ? 'https://stg2.shop.samsung.com' : 'https://stg.shop.samsung.com';
  const api = `https://${environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
  const calls = [];
  const storefront=epp?require('../../config/markets/epp').getEppConfig('MX',{ENVIRONMENT:environment}):null;
  const checkoutPath=storefront?new URL('checkout/one',storefront.rootUrl).pathname:'/mx/checkout/one';
  const site=storefront?storefront.rootUrl.pathname.split('/').filter(Boolean)[2]:'mx';
  let clock = 0;
  const response = { url: () => api + `/tokocommercewebservices/v2/${site}/users/current/carts/current/checkout/update`,
    request: () => ({ method: () => 'POST' }), ok: () => status === 200, status: () => status,
    finished: async () => { calls.push('body'); const result = await body; clock = 58000; return failure || result; } };
  const page = { url: () => origin + checkoutPath+'?step=CHECKOUT_STEP_CONTACT_INFO',
    waitForResponse: async (predicate, options) => { calls.push('listen'); assert.equal(options.timeout, 120000); assert.ok(predicate(response));
      assert.equal(predicate({ ...response, request: () => ({ method: () => 'GET' }) }), false);
      assert.equal(predicate({ ...response, url: () => 'https://foreign.example/tokocommercewebservices/v2/mx/users/current/carts/current/checkout/update' }), false);
      return response; },
    waitForURL: async (predicate, options) => { calls.push('route'); assert.equal(options.waitUntil, 'commit'); assert.equal(options.timeout, 62000);
      assert.ok(predicate(new URL(origin + checkoutPath+'?step='+targetStep)));
      assert.equal(predicate(new URL(origin + '/pe/checkout/one?step=CHECKOUT_STEP_DELIVERY')), false); },
    getByRole: () => ({ waitFor: async () => { calls.push('delivery'); } }),
  };
  const button = { click: async () => { calls.push('submit'); } };
  return { page, button, calls, options: { now: () => clock,storefront } };
}

for(const environment of ['S1','S2']) test(`${environment} EPP reuses contact transition bound to its own programme API`,async()=>{
 const f=fixture({environment,epp:true});await continueMxContactToDelivery(f.page,f.button,f.options);assert.deepEqual(f.calls,['listen','submit','body','route','delivery']);
});
for(const environment of ['S1','S2'])test(`${environment} EPP delivery commits once and proves Payment after the acknowledged body`,async()=>{
 const f=fixture({environment,epp:true,targetStep:'CHECKOUT_STEP_PAYMENT'});await continueMxDeliveryToPayment(f.page,f.button,f.options);assert.deepEqual(f.calls,['listen','submit','body','route','delivery']);
});
test('EPP delivery cannot silently reuse an unscoped Base Store transition',()=>{
 const f=fixture();assert.throws(()=>continueMxDeliveryToPayment(f.page,f.button),/programme scope/);assert.deepEqual(f.calls,[]);
});
test('EPP opt-in cannot target a foreign programme, environment or Base Store route',async()=>{
 for(const mutate of [f=>f.options.storefront={...f.options.storefront,market:'CO'},f=>f.page.url=()=> 'https://stg.shop.samsung.com/mx/checkout/one',f=>f.page.url=()=> 'https://stg2.shop.samsung.com/mx/checkout/one']){
  const f=fixture({epp:true});mutate(f);await assert.rejects(continueMxContactToDelivery(f.page,f.button,f.options),/staging programme|staging MX checkout/);assert.deepEqual(f.calls,[]);
 }
});

for (const environment of ['S1', 'S2']) test(`${environment} waits for the 58s contact response body then proves Delivery without a second submit`, async () => {
  const f = fixture({ environment }); await continueMxContactToDelivery(f.page, f.button, f.options);
  assert.deepEqual(f.calls, ['listen', 'submit', 'body', 'route', 'delivery']);
});

test('a pending acknowledged body does not authorize route readiness or another click', async () => {
  let finish;
  const f = fixture({ body: new Promise(resolve => { finish = resolve; }) });
  const running = continueMxContactToDelivery(f.page, f.button, f.options);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls, ['listen', 'submit', 'body']); finish(null); await running;
  assert.equal(f.calls.filter(x => x === 'submit').length, 1);
});

test('HTTP errors and interrupted updates fail without resubmitting or claiming Delivery', async () => {
  for (const options of [{ status: 500 }, { failure: Error('interrupted') }]) {
    const f = fixture(options); await assert.rejects(continueMxContactToDelivery(f.page, f.button, f.options), /HTTP 500|interrupted/);
    assert.equal(f.calls.filter(x => x === 'submit').length, 1); assert.ok(!f.calls.includes('delivery'));
  }
});

test('contact transition refuses Production and foreign market checkouts before a mutation', async () => {
  const f = fixture();
  for (const url of ['https://www.samsung.com/mx/checkout/one', 'https://stg2.shop.samsung.com/pe/checkout/one']) {
    f.page.url = () => url; await assert.rejects(continueMxContactToDelivery(f.page, f.button, f.options), /staging MX checkout/);
  }
  assert.deepEqual(f.calls, []);
});
