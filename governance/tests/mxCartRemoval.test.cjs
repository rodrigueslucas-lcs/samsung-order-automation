const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('pages/CartPage.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class CartPage', 'class CartPage');
const Cart = vm.runInNewContext(`${source}\nCartPage;`, { BasePage: class {}, URL, require:name=>{assert.equal(name,'../utils/mxStorefrontScope.cjs');return require('../../utils/mxStorefrontScope.cjs');} });
test('MX EPP cart readback stays in place and refuses an observed request from another site',async()=>{
 const cfg=require('../../config/markets/epp').getEppConfig('MX',{ENVIRONMENT:'S1'}),cart=Object.create(Cart.prototype),api='https://s1-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/mxtotalplay/users/current/carts/current';
 cart.storefront=cfg;cart.cartUrl=cfg.cartUrl.href;
 cart.observedCartResponse={url:()=>api,request:()=>({method:()=> 'GET',headerValue:async()=> 'synthetic'})};
 let gets=0;cart.page={goto:async()=>{throw Error('must not reload');},context:()=>({request:{get:async(url,options)=>{assert.equal(url,api);assert.equal(options.maxRedirects,0);gets++;return{ok:()=>true,json:async()=>({entries:[{product:{code:'TARGET'},quantity:1}]})};}}})};
 assert.equal((await cart.loadMxCartState()).productEntries[0].product.code,'TARGET');assert.equal(gets,1);
 cart.observedCartResponse={...cart.observedCartResponse,url:()=>api.replace('mxtotalplay','mx')};await assert.rejects(cart.loadMxCartState(),/another endpoint/);assert.equal(gets,1);
});

function removal({ environment = 'S2', status = 200, interrupted = false, bodyGate } = {}) {
  const events = [];
  const cart = Object.create(Cart.prototype);
  cart.cartUrl = `https://${environment === 'S1' ? 'stg' : 'stg2'}.shop.samsung.com/mx/cart`;
  const api = `https://${environment === 'S1' ? 's1' : 's2'}-smb-api-cdn.ecom-stg.samsung.com`;
  const endpoint = '/tokocommercewebservices/v2/mx/users/current/carts/current/entries/0';
  const response = (origin, path, method) => ({ url: () => origin + path, request: () => ({ method: () => method }) });
  cart.page = { waitForResponse: async predicate => {
    events.push('listen');
    assert.equal(predicate(response(api, endpoint, 'DELETE')), true);
    assert.equal(predicate(response('https://foreign.example', endpoint, 'DELETE')), false);
    assert.equal(predicate(response(api, endpoint.replace('/0', '/1'), 'DELETE')), false);
    assert.equal(predicate(response(api, endpoint, 'GET')), false);
    return { ok: () => status === 200, status: () => status,
      finished: async () => { events.push('body'); await bodyGate; return interrupted ? new Error('aborted') : null; } };
  } };
  return { cart, events, run: entry => cart.confirmMxCartRemoval(
    { click: async () => events.push('confirm') },
    { waitFor: async () => events.push('hidden') }, entry) };
}

test('MX S1/S2 removal waits for the exact DELETE body before allowing navigation', async () => {
  for (const environment of ['S1', 'S2']) {
    const scenario = removal({ environment });
    await scenario.run(0);
    assert.deepEqual(scenario.events, ['listen', 'confirm', 'body', 'hidden']);
  }
});

test('MX removal stays pending while the DELETE response body is still in flight', async () => {
  let release;
  const bodyGate = new Promise(resolve => { release = resolve; });
  const scenario = removal({ bodyGate });
  let done = false;
  const pending = scenario.run(0).then(() => { done = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(done, false);
  assert.ok(!scenario.events.includes('hidden'));
  release();
  await pending;
  assert.equal(done, true);
});

test('MX failed or interrupted removal stops after one confirmation', async () => {
  for (const options of [{ status: 400 }, { interrupted: true }]) {
    const scenario = removal(options);
    await assert.rejects(scenario.run(0), /no mutation was retried/);
    assert.equal(scenario.events.filter(event => event === 'confirm').length, 1);
    assert.ok(!scenario.events.includes('hidden'));
  }
});

test('MX removal refuses an unproven entry identity before any mutation', async () => {
  const scenario = removal();
  await assert.rejects(scenario.run(undefined), /valid observed entry number/);
  assert.deepEqual(scenario.events, []);
});

test('MX cleanup never deletes the same SKU twice when readback stays stale', async () => {
  const cart = Object.create(Cart.prototype);
  let confirms = 0;
  const locator = { or() { return this; }, filter() { return this; }, first() { return this; },
    locator() { return this; }, getByRole() { return this; }, getByText() { return this; },
    waitFor: async () => {}, count: async () => 1, click: async () => {} };
  cart.page = { getByRole: () => locator, getByText: () => locator };
  cart.loadMxCartState = async () => ({ productEntries: [{ product: { code: 'PHONE' }, entryNumber: 0 }] });
  cart.confirmMxCartRemoval = async () => { confirms++; };
  await assert.rejects(cart.clearMxCartAndConfirmEmpty(), /did not persist.*no mutation was retried/);
  assert.equal(confirms, 1);
});
