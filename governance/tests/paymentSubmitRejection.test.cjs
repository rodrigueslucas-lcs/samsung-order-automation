const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paymentSubmitRejection } = require('../../utils/paymentSubmitRejection.cjs');

test('HTTP 200 submit DTO with checksum business rejection is not an order success', () => {
  assert.deepEqual(paymentSubmitRejection({ type: 'submitOrderDataWsDto', code: 301, details: 'checksum error' }),
    { code: 301, reason: 'checksum error' });
});

test('an order code or unrelated response never matches the checksum rejection', () => {
  for (const value of [null, { code: 'PE261021-12345678' },
    { type: 'submitOrderDataWsDto', code: 200, details: 'checksum error' },
    { type: 'other', code: 301, details: 'checksum error' }]) assert.equal(paymentSubmitRejection(value), null);
});

test('the payment flow stops on checksum rejection before confirmation waits and never resubmits', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../../pages/PaymentPage.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace('export default class PaymentPage', 'class PaymentPage');
  const sandbox = { BasePage: class {}, expect: () => {}, URL,
    destructiveGuards: { requirePaymentSubmitOptIn: () => {} },
    paymentSubmitRejectionModule: { paymentSubmitRejection }, module: { exports: {} } };
  vm.runInNewContext(source + '\nmodule.exports = PaymentPage;', sandbox);
  const PaymentPage = sandbox.module.exports;
  let handler, submits = 0, detached = false;
  const never = () => new Promise(() => {});
  const action = { waitFor: async () => {}, isDisabled: async () => false, click: async () => {
    submits++;
    handler({ url: () => 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/users/current/carts/current/paymentmodes/pe-mercadoCC/submitOrder',
      request: () => ({ method: () => 'POST' }), status: () => 200,
      text: async () => '{"type":"submitOrderDataWsDto","code":301,"details":"checksum error"}' });
  } };
  const page = { getByRole: () => action, url: () => 'https://stg2.shop.samsung.com/pe/checkout/one?step=CHECKOUT_STEP_PAYMENT',
    on: (_, callback) => { handler = callback; }, off: () => { detached = true; },
    context: () => ({ waitForEvent: never }), waitForURL: never, waitForTimeout: never,
    getByText: () => ({ first: () => ({ waitFor: never }) }) };
  let timer;
  try {
    await assert.rejects(Promise.race([
      PaymentPage.prototype.submitSelectedPaymentMode.call({ page, selectedPaymentPanel: {}, screenshot: async () => {} }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('still waiting for confirmation')), 1000); }),
    ]), /PAYMENT_BACKEND_REJECTED.*301.*checksum error/);
  } finally { clearTimeout(timer); }
  assert.equal(submits, 1);
  assert.equal(detached, true);
});
