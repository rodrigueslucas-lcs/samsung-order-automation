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
async function fixture(html, action, suffix = 'cart', root = config.rootUrl) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto(new URL(suffix, root).href);
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
test('CL and CO cart labels do not change MX/PE contracts',()=>{
  for(const market of ['MX','PE']){
    const patterns=getEppCartTextPatterns(market);
    assert.equal(patterns.cartPageTitlePattern.test('Tienes 1 producto en tu carrito'),true);
    assert.equal(patterns.orderSummaryPattern.test('Resumen de la orden'),true);
    assert.equal(patterns.orderSummaryPattern.test('Resumen'),false);
  }
});

test('CO EPP uses its observed cart count and summary without changing CL labels',async()=>{
  await fixture('<p>Tienes 1 Producto(s) en tu carrito</p><h2>Resumen</h2>',async page=>{
    const patterns=getEppCartTextPatterns('CO');
    assert.equal(await page.getByText(patterns.cartPageTitlePattern).isVisible(),true);
    assert.equal(await page.getByRole('heading',{name:patterns.orderSummaryPattern}).isVisible(),true);
    assert.equal(patterns.cartPageTitlePattern.test('Tienes 1 producto en tu carrito'),true);
    assert.equal(patterns.cartPageTitlePattern.test('Tienes 1 producto en tu carro'),false);
  });
});

test('CO contact accepts the rendered shipping CTA and natural person without company opt-in',async()=>{
  const co={market:'CO',rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/')};
  const context=await browser.newContext();
  try{
    const page=await context.newPage();
    const html='<input name="email"><input name="firstName"><input name="lastName"><input name="phone"><button role="combobox" aria-label="Tipo de documento" onclick="document.querySelector(\'#passport\').hidden=false">Documento</button><button id="passport" role="option" hidden>Número de pasaporte</button><input name="vatNumber"><label><input type="checkbox">Persona Natural</label><label><input type="checkbox">Compra (Empresa)</label><button onclick="if(document.querySelector(\'input[type=checkbox]\').checked&&!document.querySelectorAll(\'input[type=checkbox]\')[1].checked)location.search=\'?step=CHECKOUT_STEP_DELIVERY\'">Continuar con el método de envío</button>';
    await page.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));
    await page.goto(new URL('checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',co.rootUrl).href);
    await completeContact(page,co,{email:'fixture@example.test',firstName:'Cliente',lastName:'Prueba',phone:'3001234567',documentType:'Número de pasaporte',documentNumber:'AB1234567'});
    assert.equal(new URL(page.url()).searchParams.get('step'),'CHECKOUT_STEP_DELIVERY');
  }finally{await context.close();}
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

test('CL registered checkout accepts its rendered Delivery heading without blank Contact inputs',async()=>{
 const cl={market:'CL',environment:'S2',rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')};
 await fixture('<h2>2. Información de despacho</h2>',async page=>{
  await page.goto(new URL('checkout/one?step=CHECKOUT_STEP_DELIVERY',cl.rootUrl).href);
  await proveCheckout(page,cl);
 });
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

test('CO cart summary uses rendered product-count subtotal while other markets retain Subtotal',()=>{
 const co=getEppCartTextPatterns('CO');assert.equal(co.summaryProductPattern.test('Resumen 2 Productos $25.999.800'),true);assert.equal(co.summaryProductPattern.test('Resumen Total $25.999.800'),false);
 for(const market of ['MX','PE','CL'])assert.equal(getEppCartTextPatterns(market).summaryProductPattern,undefined);
});

test('missing tooltip mass is distinct from a missing or incorrectly stacked Back to Top',async()=>{
 await fixture('<button style="position:fixed;bottom:10px">Back to top</button>',page=>assert.rejects(proveTooltipAboveBackToTop(page),e=>e.code==='EPP_TOOLTIP_TRIGGER_NOT_AVAILABLE'));
});

test('variant selection never clicks a purchase action sharing the variant CSS class',async()=>{await fixture(`<main><p id="sku">QA-A</p><button class="bttn" onclick="window.cartTouched=true">Agregar al carrito</button><button class="bttn selected">Blue</button><button class="bttn" onclick="history.pushState({},'', 'QA-B');document.querySelector('#sku').textContent='QA-B';document.querySelector('.selected').classList.remove('selected');this.classList.add('selected')">Black</button></main>`,async page=>{const result=await provePdpVariantSelection(page,config);assert.equal(result.sku,'QA-B');assert.equal(await page.evaluate(()=>Boolean(window.cartTouched)),false);},'p/QA-A');});

test('CO empty contact skeleton gets one GET recovery before any field submission',async()=>{const cfg={market:'CO',environment:'S2',program:'co_epp_agre',rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/')};await fixture(`<main><section role="region" aria-label="1. Detalles del cliente"><input name="email"></section></main><script>const n=Number(sessionStorage.count||0)+1;sessionStorage.count=n;if(n===1)document.querySelector('section').replaceChildren();</script>`,async page=>{const email=await require('../../utils/eppBusinessAssertions.cjs').waitForEppContactEmail(page,cfg,{timeout:100});assert.equal(await email.count(),1);assert.equal(await page.evaluate(()=>sessionStorage.count),'2');},'checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',cfg.rootUrl);});

test('PE waits for delayed login choices and never clicks guest checkout as a registered substitute',async()=>{await fixture('<div id="choices"></div><script>setTimeout(()=>{document.querySelector("#choices").innerHTML="<button>Samsung Checkout Express</button><button>Checkout como invitado</button>"},300)</script>',async page=>{assert.equal(await require('../../utils/eppBusinessAssertions.cjs').waitForPeRegisteredCheckout(page,page.getByRole('button',{name:'Continuar',exact:true})),false);});});
test('PE registered Continue is available without requiring guest choices',async()=>{await fixture('<button>Continuar</button>',async page=>{assert.equal(await require('../../utils/eppBusinessAssertions.cjs').waitForPeRegisteredCheckout(page,page.getByRole('button',{name:'Continuar',exact:true})),true);});});

test('MX exact empty contact skeleton recovers its GET once without bypassing Contact',async()=>{
 const cfg={market:'MX',environment:'S2',program:'pymesmx',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/')};
 await fixture('<section role="region" aria-label="1. Información de contacto"><input name="email"></section><script>sessionStorage.n=Number(sessionStorage.n||0)+1;if(sessionStorage.n==="1")document.querySelector("section").replaceChildren();</script>',async page=>{
  const email=await require('../../utils/eppBusinessAssertions.cjs').waitForEppContactEmail(page,cfg,{timeout:100});assert.equal(await email.count(),1);assert.equal(await page.evaluate(()=>sessionStorage.n),'2');
 },'checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',cfg.rootUrl);
});
test('PE incomplete or hidden login choices do not invent an authentication block',async()=>{await fixture('<button>Samsung Checkout Express</button><button hidden>Checkout como invitado</button>',async page=>{await assert.rejects(require('../../utils/eppBusinessAssertions.cjs').waitForPeRegisteredCheckout(page,page.getByRole('button',{name:'Continuar',exact:true}),{timeout:300}));});});
