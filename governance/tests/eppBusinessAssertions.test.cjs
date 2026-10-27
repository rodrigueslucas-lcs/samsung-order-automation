const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { assertStoreRoute, proveCheckout, proveFilterEffect, chooseConfiguredPdpFromPlp, proveTooltipAboveBackToTop, completeContact } = require('../../utils/eppBusinessAssertions.cjs');
const { getEppContact } = require('../../utils/eppRuntimeData.cjs');
const config = { market: 'MX', environment: 'S2', rootUrl: new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/') };
let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });
async function fixture(html, action, suffix = 'cart') {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto(new URL(suffix, config.rootUrl).href);
    return await action(page);
  } finally { await context.close(); }
}
test('EPP rejects Production, Base Store, other programme and account as checkout proof', () => {
  for (const url of ['https://www.samsung.com/shop/', 'https://stg2.shop.samsung.com/mx/checkout/one', 'https://stg2.shop.samsung.com/mx/multistore/other/other/checkout/one', 'https://account.samsung.com/']) assert.throws(() => assertStoreRoute(url, config, /^checkout\//));
  assert.doesNotThrow(() => assertStoreRoute(new URL('checkout/one', config.rootUrl), config, /^checkout\//));
});
test('PLP filter proves selection AND changed product results', async () => {
  await fixture(`<cx-facet><label><input type="checkbox" onchange="document.querySelectorAll('.product-card')[1].remove()">Phone</label></cx-facet><div class="product-card"><a href="p/A">A</a></div><div class="product-card"><a href="p/B">B</a></div>`, page => proveFilterEffect(page, config), 'c/phones');
});
test('checkout proof requires actual multistore checkout content', async () => {
  await fixture('<input name="firstName" aria-label="firstName">', page => proveCheckout(page, config), 'checkout/one?step=CHECKOUT_STEP_CONTACT_INFO');
});
test('PLP-to-PDP selects the exact configured product variant before Add', async () => {
  const current = { ...config, sku: 'QA-SKU', pdpUrl: new URL('p/QA-SKU',config.rootUrl) };
  await fixture(`<a href="${current.pdpUrl.href}">Configured variant</a>`, async page => {
    await page.route('**/p/QA-SKU', route => route.fulfill({ contentType:'text/html', body:'<p>QA-SKU</p>' }));
    await chooseConfiguredPdpFromPlp(page,current);
  }, 'c/phones');
});
test('official Back to Top assertion proves tooltip visually covers control', async () => {
  await fixture('<button style="position:fixed;bottom:10px;right:10px;width:120px;height:50px;z-index:1">Back to top</button><div role="tooltip" style="position:fixed;bottom:10px;right:10px;width:120px;height:50px;z-index:2;background:white">Help</div>', proveTooltipAboveBackToTop);
});
test('official tooltip assertion rejects control above popup', async () => {
  await fixture('<button style="position:fixed;bottom:10px;right:10px;width:120px;height:50px;z-index:3">Back to top</button><div role="tooltip" style="position:fixed;bottom:10px;right:10px;width:120px;height:50px;z-index:2;background:white">Help</div>', page => assert.rejects(() => proveTooltipAboveBackToTop(page)));
});
test('tooltip stacking is proven without requiring rectangle overlap', async () => {
  await fixture('<button style="position:fixed;bottom:10px;right:10px;z-index:1">Back to top</button><div role="tooltip" style="position:fixed;top:10px;left:10px;z-index:2">Help</div>', proveTooltipAboveBackToTop);
});
test('registered contact proves prefilled email, filled fields and delivery transition', async () => {
  await fixture(`<input name="email" value="synthetic@example.invalid"><input name="firstName"><input name="lastName"><input name="phone"><button onclick="history.pushState({},'', '?step=CHECKOUT_STEP_DELIVERY')">Continuar</button>`, page => completeContact(page, config, { firstName:'QA',lastName:'Fixture',phone:'5555555555' }), 'checkout/one?step=CHECKOUT_STEP_CONTACT_INFO');
});
test('missing contact data is scoped to exact environment and market', () => {
  const io = { existsSync: () => true, readFileSync: () => JSON.stringify({ S1:{ MX:{ contact:{ firstName:'QA',lastName:'Fixture',phone:'5555555555' } } } }) };
  assert.equal(getEppContact(config, io), null);
  assert.ok(getEppContact({ ...config, environment:'S1' }, io));
});
