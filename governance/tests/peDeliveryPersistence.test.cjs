const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('pages/CheckoutPage.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default ', '');
const Checkout = vm.runInNewContext(`${source}\nCheckoutPage`, { BasePage: class {}, URL });

function fixture({ status = 200, failedBody = false, site = 'pe', origin = null } = {}) {
  let resolve, reject, check, clicked = 0, bodyFinished = false;
  const checkout = Object.create(Checkout.prototype);
  if(site!=='pe')checkout.peApiSite=site;
  if(origin)checkout.peApiOrigin=origin;
  checkout.page = { waitForResponse: (predicate, options) => {
    check = predicate; assert.equal(options.timeout, 90000);
    return new Promise((r, j) => { resolve = r; reject = j; });
  } };
  const response = (host, method = 'POST', actualStatus = status) => ({
    url: () => `https://${host}/tokocommercewebservices/v2/${site}/users/current/carts/current/deliverymodes/update`,
    request: () => ({ method: () => method }), ok: () => actualStatus === 200, status: () => actualStatus,
    finished: async () => { bodyFinished = true; return failedBody ? new Error('closed') : null; },
  });
  const label = { click: async () => {
    clicked++;
    assert.equal(check(response('production.example')), false);
    assert.equal(check(response('s2-smb-api-cdn.ecom-stg.samsung.com', 'GET')), false);
  } };
  return { run: () => checkout.persistShippingSelection(label),
    complete: (actualStatus = status) => { const actual = response('s2-smb-api-cdn.ecom-stg.samsung.com', 'POST', actualStatus); if (check(actual)) resolve(actual); },
    timeout: () => reject(new Error('Timeout')),
    state: () => ({ clicked, bodyFinished }) };
}

test('PE shipping does not complete on optimistic radio click before persisted update', async () => {
  const s = fixture(); let done = false;
  const pending = s.run().then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false);
  assert.deepEqual(s.state(), { clicked: 1, bodyFinished: false });
  s.complete(); await pending;
  assert.deepEqual(s.state(), { clicked: 1, bodyFinished: true });
});

test('PE EPP shipping waits for its programme update rather than the Base Store endpoint',async()=>{
  const s=fixture({site:'pe_membership_vip',origin:'https://s2-smb-api-cdn.ecom-stg.samsung.com'});
  const pending=s.run();s.complete();await pending;
  assert.deepEqual(s.state(),{clicked:1,bodyFinished:true});
});
for (const [options, pattern] of [[{ status: 400 }, /HTTP 400/], [{ failedBody: true }, /did not complete/]]) {
  test(`PE shipping fails closed without another click: ${pattern}`, async () => {
    const s = fixture(options); const pending = s.run(); s.complete();
    await assert.rejects(pending, pattern);
    assert.equal(s.state().clicked, 1);
  });
}

test('PE waits for native recovery after a transient 500 without replaying selection', async () => {
  const s = fixture(); let done = false;
  const pending = s.run().then(() => { done = true; });
  s.complete(500); await Promise.resolve();
  assert.equal(done, false);
  assert.deepEqual(s.state(), { clicked: 1, bodyFinished: false });
  s.complete(200); await pending;
  assert.deepEqual(s.state(), { clicked: 1, bodyFinished: true });
});

test('PE native recovery has a deadline and does not manufacture another update', async () => {
  const s = fixture(); const pending = s.run();
  s.complete(503); s.timeout();
  await assert.rejects(pending, /did not recover after 1 transient/);
  assert.equal(s.state().clicked, 1);
});

test('PE repeated server errors fail instead of waiting indefinitely', async () => {
  const s = fixture(); const pending = s.run();
  s.complete(500); s.complete(502); s.complete(504);
  await assert.rejects(pending, /HTTP 504/);
  assert.equal(s.state().clicked, 1);
});

test('delivery alert recovery reselects even an optimistically checked radio', async () => {
  const checkout = Object.create(Checkout.prototype);
  let selections = 0;
  const label = { waitFor: async () => {} };
  const options = { first() { return this; }, waitFor: async () => {},
    evaluateAll: async () => ['group0delivery_mode_option'], locator: () => label };
  checkout.page = { locator: selector => selector.endsWith(':checked') ? { count: async () => 1 } : options,
    waitForFunction: async () => {}, waitForTimeout: async () => {} };
  checkout.screenshot = async () => {};
  checkout.persistShippingSelection = async () => { selections++; };
  await checkout.selectShippingMethod();
  assert.equal(selections, 0);
  await checkout.selectShippingMethod({ reselect: true });
  assert.equal(selections, 1);
});
