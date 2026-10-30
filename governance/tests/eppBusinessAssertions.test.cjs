const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { assertStoreRoute, proveCheckout, proveFilterEffect, provePdpVariantSelection, chooseConfiguredPdpFromPlp, proveTooltipAboveBackToTop, completeContact } = require('../../utils/eppBusinessAssertions.cjs');
const { getEppContact } = require('../../utils/eppRuntimeData.cjs');
const { getEppCartTextPatterns } = require('../../utils/eppBusinessAssertions.cjs');
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
test('CL EPP cart text accepts actual template padding and nonbreaking spaces',async()=>{
  await fixture('<p> Tienes&nbsp;4 productos en tu carro </p><h2>Resumen</h2>',async page=>{
    const patterns=getEppCartTextPatterns('CL');
    assert.equal(await page.getByText(patterns.cartPageTitlePattern).isVisible(),true);
    assert.equal(await page.getByRole('heading',{name:patterns.orderSummaryPattern}).isVisible(),true);
  });
});
test('CL cart labels do not change other EPP market contracts',()=>{
  for(const market of ['MX','PE','CO']){
    const patterns=getEppCartTextPatterns(market);
    assert.equal(patterns.cartPageTitlePattern.test('Tienes 1 producto en tu carrito'),true);
    assert.equal(patterns.orderSummaryPattern.test('Resumen de la orden'),true);
    assert.equal(patterns.orderSummaryPattern.test('Resumen'),false);
  }
});
test('EPP rejects Production, Base Store, other programme and account as checkout proof', () => {
  for (const url of ['https://www.samsung.com/shop/', 'https://stg2.shop.samsung.com/mx/checkout/one', 'https://stg2.shop.samsung.com/mx/multistore/other/other/checkout/one', 'https://account.samsung.com/']) assert.throws(() => assertStoreRoute(url, config, /^checkout\//));
  assert.doesNotThrow(() => assertStoreRoute(new URL('checkout/one', config.rootUrl), config, /^checkout\//));
});
test('PLP filter proves selection AND changed product results', async () => {
  await fixture(`<cx-facet><label><input type="checkbox" onchange="document.querySelectorAll('.product-card')[1].remove()">Phone</label></cx-facet><div class="product-card"><a href="p/A">A</a></div><div class="product-card"><a href="p/B">B</a></div>`, page => proveFilterEffect(page, config), 'c/phones');
});

test('PDP variant proves a changed SKU and selected control together',async()=>{
 await fixture(`<main><p id="sku">QA-A</p><button class="bttn selected">Blue</button><button class="bttn" onclick="history.pushState({},'', 'QA-B');document.querySelector('#sku').textContent='QA-B';document.querySelector('.selected').classList.remove('selected');this.classList.add('selected')">Black</button></main>`,async page=>{
  const result=await provePdpVariantSelection(page,config);assert.equal(result.beforeSku,'QA-A');assert.equal(result.sku,'QA-B');assert.equal(result.label,'Black');
 },'p/QA-A');
});
test('cosmetic-only variant selection is not a PDP PASS',async()=>{
 await fixture(`<main><p>QA-A</p><button class="bttn selected">Blue</button><button class="bttn" onclick="this.classList.add('selected')">Black</button></main>`,page=>assert.rejects(provePdpVariantSelection(page,config,{timeout:100})),'p/QA-A');
});
test('variant navigation cannot substitute a Base Store product for EPP proof',async()=>{
 await fixture(`<main><p id="sku">QA-A</p><button class="bttn selected">Blue</button><button class="bttn" onclick="history.pushState({},'', '/mx/p/QA-B');document.querySelector('#sku').textContent='QA-B';this.classList.add('selected')">Black</button></main>`,page=>assert.rejects(provePdpVariantSelection(page,config,{timeout:100}),/staging multistore/),'p/QA-A');
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
test('tooltip above normal-flow control does not require an explicit control stacking context', async () => {
  await fixture('<button>Back to top</button><div role="tooltip" style="position:fixed;bottom:10px;right:10px;z-index:1060">Help</div>', proveTooltipAboveBackToTop);
});
test('negative tooltip stacking does not pass against a normal-flow control', async () => {
  await fixture('<button>Back to top</button><div role="tooltip" style="position:fixed;bottom:10px;right:10px;z-index:-1">Help</div>', page => assert.rejects(() => proveTooltipAboveBackToTop(page)));
});
test('registered contact proves prefilled email, filled fields and delivery transition', async () => {
  await fixture(`<input name="email" value="synthetic@example.invalid"><input name="firstName"><input name="lastName"><input name="phone"><button onclick="history.pushState({},'', '?step=CHECKOUT_STEP_DELIVERY')">Continuar</button>`, page => completeContact(page, config, { firstName:'QA',lastName:'Fixture',phone:'5555555555' }), 'checkout/one?step=CHECKOUT_STEP_CONTACT_INFO');
});
test('missing contact data is scoped to exact environment and market', () => {
  const io = { existsSync: () => true, readFileSync: () => JSON.stringify({ S1:{ MX:{ contact:{ firstName:'QA',lastName:'Fixture',phone:'5555555555' } } } }) };
  assert.equal(getEppContact(config, io), null);
  assert.ok(getEppContact({ ...config, environment:'S1' }, io));
});
