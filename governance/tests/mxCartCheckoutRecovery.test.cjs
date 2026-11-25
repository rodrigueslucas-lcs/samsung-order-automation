const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { reloadMxCartForCheckout } = require('../../utils/mxCartCheckoutRecovery.cjs');

test('cart recovery refuses foreign routes and Production before any request', async () => {
  for (const [target, current] of [
    ['https://www.samsung.com/mx/cart', 'https://www.samsung.com/mx/cart'],
    ['https://stg2.shop.samsung.com/pe/cart', 'https://stg2.shop.samsung.com/pe/cart'],
    ['https://stg2.shop.samsung.com/mx/cart', 'https://stg2.shop.samsung.com/mx/checkout/one'],
    ['https://stg2.shop.samsung.com/mx/cart', 'https://stg.shop.samsung.com/mx/cart'],
    ['https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/cart', 'https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/cart'],
  ]) await assert.rejects(() => reloadMxCartForCheckout({ url: () => current, reload: () => assert.fail('foreign navigation') }, target), /MX_CART_RECOVERY_SCOPE/);
});

test('the observed 105.7s document fits S2 recovery, with no retry or S1 budget change', async () => {
  for (const host of ['stg.shop.samsung.com', 'stg2.shop.samsung.com']) {
    let requests = 0;
    const page = { url: () => `https://${host}/mx/cart`, reload: async options => {
      requests++;
      if (105679 > options.timeout) throw new Error('document deadline');
      assert.equal(options.waitUntil, 'domcontentloaded');
      return 'rendered document';
    } };
    if (host.startsWith('stg2')) assert.equal(await reloadMxCartForCheckout(page, page.url()), 'rendered document');
    else await assert.rejects(() => reloadMxCartForCheckout(page, page.url()), /document deadline/);
    assert.equal(requests, 1);
  }
});

for (const registered of [false, true]) test(`native ${registered ? 'registered' : 'guest'} checkout waits for the document before one recovery click`, async () => {
  const source = fs.readFileSync('pages/CartPage.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default class CartPage', 'class CartPage');
  let clock = 0, clicks = 0, reloads = 0, guestVisible = false;
  let current = 'https://stg2.shop.samsung.com/mx/cart?_qa_cart_readback=123';
  let releaseDocument, started;
  const documentReady = new Promise(resolve => { releaseDocument = resolve; });
  const requestStarted = new Promise(resolve => { started = resolve; });
  const absent = { filter() { return this; }, first() { return this; }, last() { return this; }, getByText() { return this; }, isVisible: async () => false };
  const email = { filter() { return this; }, first() { return this; }, isVisible: async () => guestVisible, waitFor: async () => assert.equal(guestVisible, true) };
  const page = {
    url: () => current, locator: () => absent, getByPlaceholder: () => email,
    waitForTimeout: async ms => { clock += ms; },
    reload: async options => { reloads++; started(); await documentReady; clock += 105679; if (options.timeout < 105679) throw new Error('document deadline'); },
  };
  const Cart = vm.runInNewContext(`${source}\nCartPage;`, {
    BasePage: class {}, URL, Date: { now: () => clock }, console: { log() {} },
    require: dependency => require(path.resolve('pages', dependency)),
  });
  const cart = Object.create(Cart.prototype);
  Object.assign(cart, { page, cartUrl: 'https://stg2.shop.samsung.com/mx/cart', guestEmailPattern: /correo/i, screenshot: async () => {},
    continueButton: { waitFor: async () => {}, scrollIntoViewIfNeeded: async () => {}, click: async () => {
      if (++clicks === 2) {
        guestVisible = !registered;
        current = registered ? 'https://stg2.shop.samsung.com/mx/checkout/one?step=CHECKOUT_STEP_CONTACT_INFO' : 'https://stg2.shop.samsung.com/mx/guestlogin/checkout';
      }
    } },
  });
  const result = cart.clickCheckoutAndResolveInterceptors({ registered });
  await requestStarted;
  assert.equal(clicks, 1, 'incomplete document must not cause a click');
  releaseDocument();
  await result;
  assert.equal(clicks, 2);
  assert.equal(reloads, 1);
  assert.equal(guestVisible, !registered);
});
