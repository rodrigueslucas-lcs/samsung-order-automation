const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function pageObject(name, expect) {
  const source = fs.readFileSync(path.join(__dirname, '../../pages', `${name}.js`), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(`export default class ${name}`, `class ${name}`);
  return vm.runInNewContext(`${source}\n${name};`, { BasePage: class {}, expect, URL,
    destructiveGuards: { requirePaymentSubmitOptIn() { throw new Error('No submit allowed'); } } });
}
function paymentScenario(initial) {
  let expanded = initial, clicks = 0, pending = false;
  const mode = { getAttribute: async () => String(expanded), waitFor: async () => {},
    scrollIntoViewIfNeeded: async () => {}, click: async () => { clicks++; pending = true; } };
  const PaymentPage = pageObject('PaymentPage', locator => ({ toHaveAttribute: async (name, expected) => {
    assert.equal(locator, mode); assert.equal(name, 'aria-expanded');
    // The SPA updates selection after the click promise resolves.
    await Promise.resolve();
    if (pending) { expanded = !expanded; pending = false; }
    assert.equal(String(expanded), expected);
  } }));
  const field = { waitFor: async () => assert.equal(expanded, true) };
  const payment = Object.create(PaymentPage.prototype);
  payment.page = { getByRole: role => role === 'button' ? mode : { waitFor: () => new Promise(() => {}) },
    frameLocator: () => ({ locator: () => field }) };
  payment.creditCardOption = mode; payment.cardHolderInput = field;
  payment.screenshot = async () => assert.equal(expanded, true);
  return { payment, clicks: () => clicks };
}
for (const initial of [true, false]) {
  test(`card mode preserves open state and awaits asynchronous selection (initial=${initial})`, async () => {
    const s = paymentScenario(initial); await s.payment.selectCreditCard(); assert.equal(s.clicks(), initial ? 0 : 1);
  });
  test(`alternative mode preserves open state and awaits asynchronous selection (initial=${initial})`, async () => {
    const s = paymentScenario(initial); await s.payment.selectPaymentMode(/^Pago Efectivo$/, 'fixture');
    assert.equal(s.clicks(), initial ? 0 : 1);
  });
}
function footerScenario(level, missing) {
  const validated = [];
  const footer = { scrollIntoViewIfNeeded: async () => {}, waitFor: async () => {},
    getByRole: (role, options) => ({ waitFor: async () => {
      assert.equal(role, 'heading');
      assert.ok(['Tienda', 'Productos', 'Soporte', 'Cuenta'].includes(options.name));
      assert.notEqual(options.name, missing, 'required footer section is missing');
      if (options.level) assert.equal(options.level, level);
      validated.push(options.name);
    } }),
    getByText: text => ({ waitFor: async () => { assert.equal(text, 'Privacidad'); validated.push(text); } }) };
  const cart = Object.create(pageObject('CartPage').prototype);
  cart.page = { getByRole: () => footer }; cart.footerAccountPattern = 'Cuenta'; cart.screenshot = async () => {};
  return { cart, validated };
}
for (const level of [2, 3]) {
  test(`cart footer validates every required section with h${level} headings`, async () => {
    const { cart, validated } = footerScenario(level); await cart.validateCartFooter();
    assert.deepEqual(validated, ['Tienda', 'Productos', 'Soporte', 'Cuenta', 'Privacidad']);
  });
}
test('cart footer still rejects a missing business section', async () => {
  const { cart } = footerScenario(3, 'Soporte');
  await assert.rejects(cart.validateCartFooter(), /required footer section is missing/);
});
