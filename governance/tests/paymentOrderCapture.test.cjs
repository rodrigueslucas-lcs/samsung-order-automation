const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function paymentWithResponses({
  submitBody,
  submitPath = '/tokocommercewebservices/v2/pe/users/current/carts/current/paymentmodes/pe-mercadoCC/submitOrder',
  includeOrder = true,
} = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../pages/PaymentPage.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default class PaymentPage', 'class PaymentPage');
  const PaymentPage = vm.runInNewContext(`${source}\nPaymentPage;`, {
    BasePage: class {}, destructiveGuards: { requirePaymentSubmitOptIn() {} }, URL,
  });
  const payment = Object.create(PaymentPage.prototype);
  const listeners = new Map();
  const pending = () => new Promise(() => {});
  const response = (pathname, body, status = 200, method = 'GET') => ({
    url: () => `https://stg.example.test${pathname}`,
    ok: () => status >= 200 && status < 300,
    status: () => status,
    request: () => ({ method: () => method }),
    text: async () => JSON.stringify(typeof body === 'object' ? body : { code: body }),
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
      if (submitBody) record(response(submitPath, submitBody, 200, 'POST'));
      if (!includeOrder) return;
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

const peCaptureOptions = {
  orderCodePattern: /\bPE\d{6}-\d{8}(?=_|\b)/i,
  orderResponsePathPattern: /\/users\/[^/]+\/orders(?:\/|$)/i,
  submitResponsePathPattern: /\/users\/[^/]+\/carts\/[^/]+\/paymentmodes\/pe-mercadoCC\/submitOrder$/i,
};

test('PE HTTP 200 with the observed submitOrder rejection fails immediately without exposing its body', async () => {
  const payment = paymentWithResponses({
    submitBody: { type: 'submitOrderDataWsDto', code: 601, details: 'sensitive fixture must not be logged' },
    includeOrder: false,
  });
  await assert.rejects(payment.placeOrderAndCapture(peCaptureOptions), (error) => {
    assert.match(error.message, /business code 601 despite HTTP success/);
    assert.match(error.message, /Do not retry blindly/);
    assert.doesNotMatch(error.message, /sensitive fixture|TIMEOUT/);
    return true;
  });
});

test('PE rejection recognition is scoped to the submit endpoint and exact response type', async () => {
  for (const options of [
    { submitPath: '/tokocommercewebservices/v2/pe/other/payment', submitBody: { type: 'submitOrderDataWsDto', code: 601 } },
    { submitBody: { type: 'cartWsDTO', code: 601 } },
  ]) {
    const result = await paymentWithResponses(options).placeOrderAndCapture(peCaptureOptions);
    assert.equal(result.orderCode, 'PE261013-64011210');
  }
});
