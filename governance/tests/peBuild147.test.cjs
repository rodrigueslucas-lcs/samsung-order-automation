const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { assertAuthStorefrontHealth } = require('../../utils/authStorefrontHealth.cjs');

function api(status, text = '') {
  let disposed = 0;
  const request = { get: async (url, options) => {
    assert.equal(url, 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pe/currentConfig');
    assert.equal(options.maxRedirects, 0);
    return { status: () => status, text: async () => text, dispose: async () => { disposed++; } };
  } };
  return { request, disposed: () => disposed };
}

test('auth preflight reports observed SAP maintenance instead of a missing profile timeout', async () => {
  const state = api(503, '<title>SAP Commerce Cloud - Maintenance</title>');
  await assert.rejects(assertAuthStorefrontHealth(state.request, { market: 'PE', environment: 'S2' }), error =>
    error.code === 'AUTH_STOREFRONT_UNAVAILABLE' && /HTTP 503.*maintenance/.test(error.message));
  assert.equal(state.disposed(), 1);
});

test('auth health preserves non-maintenance login paths and reports transport failure without secrets', async () => {
  for (const status of [200, 401, 403]) {
    const state = api(status);
    await assertAuthStorefrontHealth(state.request, { market: 'PE', environment: 'S2' });
    assert.equal(state.disposed(), 1);
  }
  await assert.rejects(assertAuthStorefrontHealth({ get: async () => { throw Error('private transport detail'); } },
    { market: 'PE', environment: 'S2' }), error => error.code === 'AUTH_STOREFRONT_UNREACHABLE' && !/private/.test(error.message));
});

test('auth health accepts only known staging targets before making a request', async () => {
  for (const scope of [{ market: 'XX', environment: 'S2' }, { market: 'PE', environment: 'PROD' }]) {
    await assert.rejects(assertAuthStorefrontHealth({ get: () => assert.fail('unexpected network request') }, scope), /known market/);
  }
});

function unavailableProduct(text, { preorder = false } = {}) {
  const source = fs.readFileSync('pages/ProductPage.js', 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace('export default class ProductPage', 'class ProductPage');
  const Page = vm.runInNewContext(`${source}\nProductPage;`, { BasePage: class { constructor(page) { this.page = page; } } });
  let navigations = 0;
  const button = { filter() { return this; }, first() { return this; }, waitFor: async () => { throw Error('not rendered'); },
    isVisible: async () => preorder, isEnabled: async () => preorder };
  const page = { getByRole: () => ({ getByRole: () => button, innerText: async () => text }),
    reload: async () => {}, title: async () => 'Galaxy S25', url: () => 'https://stg2.shop.samsung.com/pe/p/SM-S931BDBLLTP' };
  const product = new Page(page, { sku: 'SM-S931BDBLLTP', pdpUrl: page.url() });
  product.safeGoto = async () => { navigations++; };
  return { product, navigations: () => navigations };
}

test('explicit sold-out evidence is typed for the exact configured SKU without repeated navigation', async () => {
  const state = unavailableProduct('SM-S931BDBLLTP Sold out. Get stock alert to receive notification');
  await assert.rejects(state.product.addConfiguredPdpToCart(), error => error.code === 'PRODUCT_OUT_OF_STOCK' && error.sku === 'SM-S931BDBLLTP');
  assert.equal(state.navigations(), 1);
});

test('enabled Preventa overrides sold-out text and must never be classified as missing product mass', async () => {
  const state = unavailableProduct('SM-S931BDBLLTP Sold out. Get stock alert', { preorder: true });
  await assert.rejects(state.product.addConfiguredPdpToCart(), error => error.code === 'PRODUCT_PREORDER_AVAILABLE');
  assert.equal(state.navigations(), 1);
});

test('blank PDP, another SKU or unrelated text remain failures, never missing-mass classification', async () => {
  for (const text of ['', 'OTHER-SKU Sold out. Get stock alert', 'SM-S931BDBLLTP unexpected loading problem']) {
    const state = unavailableProduct(text);
    await assert.rejects(state.product.addConfiguredPdpToCart(), error => !error.code && /button was not rendered/.test(error.message));
    assert.equal(state.navigations(), 3);
  }
});

test('PE refresh stops after a non-retryable login failure and reports the actual attempts without READY', () => {
  const source = fs.readFileSync('scripts/auth-refresh-pe.cjs', 'utf8');
  const calls = [], messages = [], runtime = { env: { PE_QST_ENVIRONMENT: 'S2' }, execPath: 'node' };
  vm.runInNewContext(source, {
    require: name => { assert.equal(name, 'node:child_process'); return { spawnSync: (_, args) => { calls.push(args[0]); return { status: 1 }; } }; },
    process: runtime, console: { log: text => messages.push(text), error: text => messages.push(text) },
  });
  assert.deepEqual(calls, ['scripts/auth-login-pe.cjs']);
  assert.equal(runtime.exitCode, 1);
  assert.ok(messages.some(text => /failed after 1 attempt/.test(text)));
  assert.ok(!messages.some(text => /READY/.test(text)));
});
