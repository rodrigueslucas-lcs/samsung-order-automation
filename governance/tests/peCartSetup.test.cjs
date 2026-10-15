const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setupCart({ base = 'https://stg.shop.samsung.com/pe/cart', persist = true, status = 204 } = {}) {
  const source = fs.readFileSync('pages/CartPage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default class CartPage', 'class CartPage');
  const CartPage = vm.runInNewContext(`${source}\nCartPage;`, {
    BasePage: class {}, URL,
    expect: () => ({ toHaveCount: async count => assert.equal(count, 0) }),
  });
  const cart = Object.create(CartPage.prototype);
  let entries = [{ entryNumber: 0 }, { entryNumber: 1 }];
  const deletes = [];
  const api = 'https://s1-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/users/current/carts/current';
  const request = {
    get: async url => {
      assert.equal(url, api);
      return { ok: () => true, json: async () => ({ type: 'cartWsDTO', entries: [...entries] }) };
    },
    delete: async url => {
      const index = Number(url.split('/').at(-1));
      deletes.push(index);
      assert.equal(url, `${api}/entries/${index}`);
      if (persist && status === 204) entries = entries.filter(e => e.entryNumber !== index);
      return { ok: () => status === 204, status: () => status };
    },
  };
  const locator = { waitFor: async () => {}, first() { return this; }, filter() { return this; }, getByText() { return this; }, getByRole() { return this; } };
  cart.cartUrl = base;
  cart.openCart = async () => {};
  cart.page = {
    context: () => ({ request }), reload: async () => {}, waitForTimeout: async () => {},
    getByRole: () => locator,
    waitForResponse: async predicate => {
      assert.equal(predicate({ url: () => api.replace('/pe/', '/mx/'), request: () => ({ method: () => 'GET' }) }), false);
      const observed = { url: () => api, status: () => 200, request: () => ({ method: () => 'GET' }) };
      assert.equal(predicate(observed), true);
      return observed;
    },
  };
  return { cart, deletes };
}

test('PE registered-cart setup deletes observed entries in reverse index order and verifies empty readback', async () => {
  const { cart, deletes } = setupCart();
  await cart.clearPeCartAndConfirmEmpty();
  assert.deepEqual(deletes, [1, 0]);
});

test('PE setup fails closed on acknowledged no-op removal without retrying the mutation', async () => {
  const { cart, deletes } = setupCart({ persist: false });
  await assert.rejects(cart.clearPeCartAndConfirmEmpty(), /did not persist; no mutation was retried/);
  assert.deepEqual(deletes, [1]);
});

test('PE setup stops on rejected API removal and refuses other markets or production', async () => {
  const { cart, deletes } = setupCart({ status: 403 });
  await assert.rejects(cart.clearPeCartAndConfirmEmpty(), /HTTP 403/);
  assert.deepEqual(deletes, [1]);
  for (const base of ['https://www.samsung.com/pe/cart', 'https://stg.shop.samsung.com/mx/cart']) {
    const state = setupCart({ base });
    await assert.rejects(state.cart.clearPeCartAndConfirmEmpty(), /restricted to the PE S1\/S2 staging cart/);
    assert.deepEqual(state.deletes, []);
  }
});
