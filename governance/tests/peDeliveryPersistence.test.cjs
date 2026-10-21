const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('pages/CheckoutPage.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default ', '');
const Checkout = vm.runInNewContext(`${source}\nCheckoutPage`, { BasePage: class {}, URL });

function fixture({ status = 200, failedBody = false } = {}) {
  let resolve, check, clicked = 0, bodyFinished = false;
  const checkout = Object.create(Checkout.prototype);
  checkout.page = { waitForResponse: (predicate, options) => {
    check = predicate; assert.equal(options.timeout, 90000);
    return new Promise(r => { resolve = r; });
  } };
  const response = (host, method = 'POST') => ({
    url: () => `https://${host}/tokocommercewebservices/v2/pe/users/current/carts/current/deliverymodes/update`,
    request: () => ({ method: () => method }), ok: () => status === 200, status: () => status,
    finished: async () => { bodyFinished = true; return failedBody ? new Error('closed') : null; },
  });
  const label = { click: async () => {
    clicked++;
    assert.equal(check(response('production.example')), false);
    assert.equal(check(response('s2-smb-api-cdn.ecom-stg.samsung.com', 'GET')), false);
  } };
  return { run: () => checkout.persistShippingSelection(label),
    complete: () => { const actual = response('s2-smb-api-cdn.ecom-stg.samsung.com'); assert.equal(check(actual), true); resolve(actual); },
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
for (const [options, pattern] of [[{ status: 500 }, /HTTP 500/], [{ failedBody: true }, /did not complete/]]) {
  test(`PE shipping fails closed without another click: ${pattern}`, async () => {
    const s = fixture(options); const pending = s.run(); s.complete();
    await assert.rejects(pending, pattern);
    assert.equal(s.state().clicked, 1);
  });
}

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
