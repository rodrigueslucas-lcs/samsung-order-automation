const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function scenario({ visible = false, status = 200, route = 'https://stg2.shop.samsung.com/pe/checkout/one' } = {}) {
  const source = fs.readFileSync('pages/CheckoutPage.js', 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace('export default class CheckoutPage', 'class CheckoutPage');
  const Page = vm.runInNewContext(`${source}\nCheckoutPage;`, { BasePage: class {}, URL });
  const checkout = Object.create(Page.prototype);
  let bodyRead = false, requests = 0, reveal;
  const rendered = new Promise(resolve => { reveal = resolve; });
  checkout.firstNameInput = { isVisible: async () => visible, waitFor: () => rendered };
  const endpoint = 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/dynamicforms/CHECKOUT_CUSTOMER_INFO';
  const response = (url = endpoint, method = 'GET') => ({ url: () => url, request: () => ({ method: () => method }),
    ok: () => status === 200, status: () => status, body: async () => { await Promise.resolve(); bodyRead = true; reveal(); } });
  checkout.page = { url: () => route, waitForResponse: async predicate => {
    requests++;
    assert.equal(predicate(response(endpoint.replace('/pe/', '/mx/'))), false);
    assert.equal(predicate(response(endpoint.replace('s2-', 's1-'))), false);
    assert.equal(predicate(response(endpoint, 'POST')), false);
    assert.equal(predicate(response()), true);
    return response();
  } };
  return { checkout, bodyRead: () => bodyRead, requests: () => requests };
}

test('PE contact waits for the exact pending form body and rendered field without a new request or submit', async () => {
  const state = scenario();
  await state.checkout.waitForPeCustomerForm();
  assert.ok(state.bodyRead());
  assert.equal(state.requests(), 1);
});

test('PE cached visible contact form needs no network event', async () => {
  const state = scenario({ visible: true });
  await state.checkout.waitForPeCustomerForm();
  assert.equal(state.requests(), 0);
});

test('PE contact reports the service failure before any data entry', async () => {
  const state = scenario({ status: 503 });
  await assert.rejects(state.checkout.waitForPeCustomerForm(), /contact form service returned HTTP 503/);
  assert.equal(state.bodyRead(), false);
});

test('PE contact readiness leaves other markets and Production outside this staging adaptation', async () => {
  for (const route of ['https://stg2.shop.samsung.com/mx/checkout/one', 'https://www.samsung.com/pe/checkout/one']) {
    const state = scenario({ route });
    await state.checkout.waitForPeCustomerForm();
    assert.equal(state.requests(), 0);
  }
});
