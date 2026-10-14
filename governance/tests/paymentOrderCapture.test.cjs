const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function paymentWithResponses() {
  const source = fs.readFileSync(path.join(__dirname, '../../pages/PaymentPage.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default class PaymentPage', 'class PaymentPage');
  const PaymentPage = vm.runInNewContext(`${source}\nPaymentPage;`, {
    BasePage: class {}, destructiveGuards: { requirePaymentSubmitOptIn() {} }, URL,
  });
  const payment = Object.create(PaymentPage.prototype);
  const listeners = new Map();
  const pending = () => new Promise(() => {});
  const response = (pathname, code, status = 200) => ({
    url: () => `https://stg.example.test${pathname}`,
    ok: () => status >= 200 && status < 300,
    status: () => status,
    request: () => ({ method: () => 'GET' }),
    text: async () => JSON.stringify({ code }),
  });
  payment.screenshot = async () => {};
  payment.page = {
    on: (name, fn) => listeners.set(name, fn),
    off: (name) => listeners.delete(name),
    url: () => 'https://stg.example.test/pe/orderConfirmation',
    waitForURL: pending, waitForFunction: pending, waitForTimeout: pending,
    locator: () => ({ innerText: async () => '' }),
    getByRole: () => ({ filter: () => ({ first: () => ({ waitFor: pending }) }) }),
  };
  payment.placeOrderButton = {
    scrollIntoViewIfNeeded: async () => {}, waitFor: async () => {}, isEnabled: async () => true,
    click: async () => {
      const record = listeners.get('response');
      record(response('/tokocommercewebservices/v2/pe/users/current/carts/current?fields=code,orderEntries', 'PE261013-64011211'));
      record(response('/tokocommercewebservices/v2/pe/users/current/orders/failed', 'PE261013-99999999', 500));
      record(response('/tokocommercewebservices/v2/pe/users/current/orders/PE261013-64011210_123', 'PE261013-64011210_123'));
    },
  };
  return payment;
}

test('PE order capture ignores replacement carts and failed responses, preserving the confirmed order identity', async () => {
  const payment = paymentWithResponses();
  const result = await payment.placeOrderAndCapture({
    orderCodePattern: /\bPE\d{6}-\d{8}(?=_|\b)/i,
    orderResponsePathPattern: /\/users\/[^/]+\/orders(?:\/|$)/i,
  });
  assert.equal(result.orderCode, 'PE261013-64011210');
  assert.equal(result.outcome, 'ORDER_CODE_RESPONSE');
  assert.equal(result.responses.length, 3, 'filtered responses remain available as network diagnostics');
});
