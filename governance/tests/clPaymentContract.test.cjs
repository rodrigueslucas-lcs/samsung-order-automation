const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { getClTestCard } = require('../../utils/clTestCard.cjs');
const { getClQstConfig } = require('../../config/markets/cl.js');

test('CL S2 order fixture uses the verified card product without changing Care/base fixtures', () => {
  const cfg = getClQstConfig({ CL_QST_ENVIRONMENT: 'S2' });
  assert.equal(cfg.paymentSku, 'SM-S928BZKKLTL');
  assert.equal(cfg.paymentPdpUrl.href, 'https://stg2.shop.samsung.com/cl/p/SM-S928BZKKLTL');
  assert.equal(cfg.scPlusSku, 'SM-S918BZKILTL');
  assert.equal(cfg.sku, 'SM-S918BZKILTL');
  const s1 = getClQstConfig({ CL_QST_ENVIRONMENT: 'S1', CL_QST_SKU: 'CL-S1-QA' });
  assert.equal(s1.paymentSku, s1.sku);
  assert.throws(() => getClQstConfig({ CL_QST_PAYMENT_SKU: '../mx/p/OTHER' }), /CL product code/);
});

test('CL capture scopes rejection and order identity to CL commerce endpoints', async () => {
  const source = fs.readFileSync('pages/MarketPaymentPage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default class MarketPaymentPage', 'class MarketPaymentPage');
  const Page = vm.runInNewContext(`${source}\nMarketPaymentPage;`, {
    PaymentPage: class { async placeOrderAndCapture(options) { return options; } },
    paymentMarketProfile: {}, destructiveGuards: {},
  });
  const payment = Object.create(Page.prototype);
  payment.marketProfile = { code: 'CL', orderCodePattern: /CL\d{6}-\d{8}/ };
  const options = await payment.placeOrderAndCapture();
  const submit = '/tokocommercewebservices/v2/cl/users/current/carts/current/paymentmodes/cl-mercadoCC/submitOrder';
  assert.ok(options.submitResponsePathPattern.test(submit));
  assert.ok(!options.submitResponsePathPattern.test(submit.replace('/cl/', '/pe/')));
  assert.ok(!options.orderResponsePathPattern.test('/tokocommercewebservices/v2/cl/users/current/carts/current'));
  assert.ok(options.orderResponsePathPattern.test('/tokocommercewebservices/v2/cl/users/current/orders/CL261019-12345678'));
  payment.marketProfile = { code: 'MX' };
  assert.equal((await payment.placeOrderAndCapture()).submitResponsePathPattern, undefined);
});

test('CL sandbox card loader rejects missing CL mass instead of borrowing MX credentials', () => {
  assert.throws(() => getClTestCard({ CL_TEST_CARD_FILE: 'test-results/nonexistent-cl-card-fixture.json', MX_TEST_CARD_NUMBER: 'ignored' }), /CL sandbox test card is required/);
  assert.throws(() => getClTestCard({ CL_TEST_CARD_BRAND: 'unknown' }), /must be mastercard or amex/);
});

test('CL sandbox card loader supports explicit brand selection without exposing values', () => {
  const env = { CL_TEST_CARD_FILE: 'test-results/nonexistent-cl-card-fixture.json',
    CL_TEST_CARD_HOLDER: 'APRO', CL_TEST_CARD_EXPIRY: '11/30', CL_TEST_CARD_CVV: 'fixture', CL_TEST_CARD_DOCUMENT: 'fixture' };
  const mastercard = getClTestCard({ ...env, CL_TEST_CARD_NUMBER: '5'.repeat(16) });
  assert.ok(mastercard.number.length === 16);
  assert.throws(() => getClTestCard({ ...env, CL_TEST_CARD_BRAND: 'amex', CL_TEST_CARD_NUMBER: '5'.repeat(16) }), /does not match/);
  const amex = getClTestCard({ ...env, CL_TEST_CARD_BRAND: 'amex', CL_TEST_CARD_NUMBER: '37' + '1'.repeat(13) });
  assert.ok(amex.number.length === 15);
});

function installments(options) {
  const source = fs.readFileSync('flows/cl/paymentFlows.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const selected = [];
  const control = { locator: () => ({ evaluateAll: async () => options }), selectOption: async value => selected.push(value) };
  const choose = vm.runInNewContext(`${source}\nselectClInterestFreeInstallments;`, {
    evidenceContext: { recordBusinessEvidence() {} }, test: { skip(condition, reason) { if (condition) throw new Error(reason); } },
    expect: () => ({ toBeVisible: async () => {}, toHaveValue: async value => assert.equal(selected.at(-1), value) }),
  });
  return { selected, run: () => choose({ installmentsCombobox: control }, { attach: async () => {} }) };
}

test('CL installment scenario never accepts one installment or interest-bearing mass', async () => {
  for (const choices of [[], [{ value: '1', text: '1 cuota de $16.480' }], [{ value: '3', text: '3 cuotas con interés' }]]) {
    const s = installments(choices);
    await assert.rejects(s.run(), /Missing CL interest-free installments test data/);
    assert.equal(s.selected.length, 0);
  }
});

test('CL installment scenario selects and reads back an offered interest-free multi-installment option', async () => {
  const s = installments([{ value: '1', text: '1 cuota' }, { value: '3', text: '3 cuotas sin interés' }]);
  const choice = await s.run();
  assert.equal(choice.value, '3');
  assert.deepEqual(s.selected, ['3']);
});

test('CL Flow simulator refuses Production, foreign storefronts and an unrelated order before any action', async () => {
  const source = fs.readFileSync('flows/cl/paymentFlows.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const complete = vm.runInNewContext(`${source}\ncompleteClFlowSandbox;`, {
    evidenceContext: { recordBusinessEvidence() {} }, destructiveGuards: { requirePaymentSubmitOptIn() {} }, URL,
  });
  for (const [url, storefrontOrigin, orderCode] of [
    ['https://www.flow.cl/app/web/pay.php', 'https://stg2.shop.samsung.com', 'CL261019-12345678'],
    ['http://sandbox.flow.cl/app/web/pay.php', 'https://stg2.shop.samsung.com', 'CL261019-12345678'],
    ['https://sandbox.flow.cl/app/web/pay.php', 'https://shop.samsung.com', 'CL261019-12345678'],
    ['https://sandbox.flow.cl/app/web/pay.php', 'https://stg2.shop.samsung.com', 'PE261019-12345678'],
  ]) {
    await assert.rejects(complete({ url: () => url }, { storefrontOrigin, orderCode }), /genuine sandbox/);
  }
});

test('CL Flow confirms an existing sandbox attempt once and never retries an ambiguous return', async () => {
  const source = fs.readFileSync('flows/cl/paymentFlows.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  for (const interrupted of [false, true]) {
    let clicks = 0;
    let ready = false;
    const action = { selectOption: async choice => assert.equal(choice.label, 'Quiero pagar la orden'), locator: () => ({}) };
    const page = {
      url: () => 'https://sandbox.flow.cl/app/web/sendMedio.php',
      getByText: () => ({}), locator: () => ({}),
      getByRole: role => role === 'combobox' ? action : { click: async () => { assert.ok(ready); clicks++; } },
      waitForFunction: async () => { ready = true; },
      waitForURL: async predicate => {
        assert.ok(predicate(new URL('https://stg2.shop.samsung.com/cl/order-confirmation')));
        assert.ok(!predicate(new URL('https://shop.samsung.com/cl/order-confirmation')));
        if (interrupted) throw new Error('ambiguous callback');
      },
    };
    const complete = vm.runInNewContext(`${source}\ncompleteClFlowSandbox;`, {
      evidenceContext: { recordBusinessEvidence() {} }, destructiveGuards: { requirePaymentSubmitOptIn() {} }, URL,
      expect: () => ({ toBeVisible: async () => {}, toContainText: async code => assert.equal(code, 'CL261019-12345678'),
        toHaveText: async text => assert.equal(text, 'Quiero pagar la orden') }),
    });
    const result = complete(page, { orderCode: 'CL261019-12345678', storefrontOrigin: 'https://stg2.shop.samsung.com' });
    if (interrupted) await assert.rejects(result, /ambiguous callback/);
    else await result;
    assert.equal(clicks, 1);
  }
});

test('CL native submit waits for and returns only the chosen panel button', async () => {
  const source = fs.readFileSync('flows/cl/paymentFlows.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  let opened = false;
  let ready = false;
  const button = { filter() { return this; } };
  const panel = { getByRole(role) { assert.equal(role, 'button'); return button; } };
  const method = { filter() { return this; }, first() { return this; },
    getAttribute: async () => 'false', click: async () => { opened = true; },
    locator(selector) { assert.equal(selector, 'xpath=ancestor::mat-expansion-panel[1]'); return panel; } };
  const page = { getByRole(role, options) {
    if (role === 'heading') { assert.ok(options.name.test('Transferencia Bancaria')); return {}; }
    assert.equal(options, undefined, 'a global submit selector must never be used');
    return method;
  } };
  const choose = vm.runInNewContext(`${source}\nselectClNativePaymentButton;`, {
    evidenceContext: { recordBusinessEvidence() {} }, expect: target => ({ toBeVisible: async () => { if (target === button) { assert.ok(opened); ready = true; } },
      toHaveAttribute: async () => assert.ok(opened), toBeEnabled: async () => assert.ok(ready) }),
  });
  assert.equal(await choose(page, /^Transferencia Bancaria$/), button);
  assert.ok(ready);
});
