const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('pages/CartPage.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class CartPage', 'class CartPage');
const CartPage = vm.runInNewContext(`${source}\nCartPage;`, { BasePage: class {} });
const mainProduct = { product: { code: 'PHONE' }, quantity: 1 };
const gift = { product: { code: 'BUDS' }, quantity: 1, giveAway: true, basePrice: { value: 0 }, totalPrice: { value: 0 } };

function cart(entries) {
  const item = { getByRole: () => ({ waitFor: async () => {}, inputValue: async () => '1', count: async () => 1 }) };
  const sku = { waitFor: async () => {}, count: async () => 1, locator: () => item };
  const main = { getByText: () => sku, getByRole: () => ({ count: async () => 1 }) };
  const instance = Object.create(CartPage.prototype);
  instance.page = { getByRole: () => main };
  instance.loadMxCartState = async () => ({ productEntries: entries });
  return instance;
}

test('default payment/cart guard still rejects additional promotional entries', async () => {
  await assert.rejects(cart([mainProduct, gift]).validateControlledSingleSku('PHONE'), /Controlled MX cart/);
});

test('isolation opt-in accepts an explicitly flagged zero-price quantity-one gift', async () => {
  await cart([mainProduct, gift]).validateControlledSingleSku('PHONE', { allowPromotionalGifts: true });
});

test('safe QST cart opt-in accepts gifts without changing an explicit strict guard', async () => {
  const safe = cart([mainProduct, gift]);
  safe.allowPromotionalGifts = true;
  await safe.validateControlledSingleSku('PHONE');
  await assert.rejects(safe.validateControlledSingleSku('PHONE', { allowPromotionalGifts: false }), /Controlled MX cart/);
});

test('gift opt-in still rejects extra paid products, unflagged freebies, quantity changes and missing main SKU', async () => {
  for (const extra of [
    { ...gift, giveAway: false },
    { ...gift, basePrice: { value: 10 } },
    { ...gift, totalPrice: { value: 10 } },
    { ...gift, quantity: 2 },
  ]) {
    await assert.rejects(cart([mainProduct, extra]).validateControlledSingleSku('PHONE', { allowPromotionalGifts: true }), /Controlled MX cart/);
  }
  for (const entries of [[gift], [{ ...mainProduct, quantity: 2 }, gift]]) {
    await assert.rejects(cart(entries).validateControlledSingleSku('PHONE', { allowPromotionalGifts: true }), /Controlled MX cart/);
  }
});
