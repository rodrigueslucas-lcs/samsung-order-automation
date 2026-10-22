const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { readMxCartSku } = require('../../utils/mxCartReadback.cjs');
const cartUrl = 'https://stg2.shop.samsung.com/mx/cart';
const pdpUrl = 'https://stg2.shop.samsung.com/mx/p/TEST';

function state({ failures = 1, empty = false, unresolved = false, httpError = false } = {}) {
  let current = pdpUrl, gets = [], clicks = 0, bodyFinished = false, resolveAdd;
  const sku = { first() { return this; }, filter() { return this; },
    isVisible: async () => current === pdpUrl || (!empty && !unresolved),
    waitFor: async () => { if (empty || unresolved) throw Error('not visible'); } };
  const button = { first() { return this; }, filter() { return this; }, waitFor: async () => {},
    evaluate: async () => ({}), scrollIntoViewIfNeeded: async () => {},
    click: async () => { clicks++; resolveAdd({ ok: () => true,
      finished: async () => { bodyFinished = true; return null; },
      json: async () => ({ statusCode: 'success', entry: { product: { code: 'TEST' } } }) }); } };
  const page = { url: () => current, getByText: () => sku,
    getByRole: () => ({ getByRole: () => button, getByText: () => ({ filter() { return this; }, first() { return this; }, isVisible: async () => empty }) }),
    waitForResponse: () => new Promise(resolve => { resolveAdd = resolve; }),
    waitForEvent: () => new Promise(() => {}), waitForTimeout: () => new Promise(() => {}),
    goto: async url => {
      assert.equal(bodyFinished, true, 'read Add body before any cart navigation');
      gets.push(url);
      if (gets.length <= failures) throw Error('net::ERR_ABORTED');
      current = url;
      return { ok: () => !httpError, status: () => httpError ? 500 : 200 };
    },
  };
  const source = fs.readFileSync('pages/ProductPage.js', 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace('export default class ProductPage', 'class ProductPage');
  const Product = vm.runInNewContext(`${source}\nProductPage;`, { URL,
    BasePage: class { constructor(page) { this.page = page; } } });
  const product = new Product(page, { sku: 'TEST', pdpUrl, cartUrl, reuseLoadedPdp: true, cartReadback: readMxCartSku });
  product.safeGoto = () => assert.fail('already validated PDP must not be loaded twice');
  return { run: () => product.addConfiguredPdpToCart({ waitForCartMutation: true }),
    gets, clicks: () => clicks };
}

test('MX acknowledged Add survives interrupted cart document with two GETs and one Add', async () => {
  const s = state(); await s.run();
  assert.equal(s.clicks(), 1);
  assert.equal(s.gets.length, 2);
  assert.ok(new URL(s.gets[1]).searchParams.has('_qa_cart_readback'));
});

for (const [name, options, pattern] of [
  ['repeated interruption', { failures: 2 }, /ERR_ABORTED/],
  ['empty cart after success', { failures: 0, empty: true }, /after acknowledged Add/],
  ['unresolved cart', { failures: 0, unresolved: true }, /absence was not proven/],
  ['server error', { failures: 0, httpError: true }, /HTTP 500/],
]) test(`MX does not repeat Add after ${name}`, async () => {
  const s = state(options); await assert.rejects(s.run(), pattern);
  assert.equal(s.clicks(), 1);
  assert.ok(s.gets.length <= 2);
});

test('MX readback refuses Production and other markets before any navigation', async () => {
  for (const url of ['https://shop.samsung.com/mx/cart', 'https://stg2.shop.samsung.com/pe/cart']) {
    await assert.rejects(readMxCartSku({}, { cartUrl: url, sku: 'TEST' }), /staging cart/);
  }
});
