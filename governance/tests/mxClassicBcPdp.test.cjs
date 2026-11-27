const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('@playwright/test');
const {prepareMxClassicBcPdp}=require('../../utils/mxClassicBcPdp.cjs');
const sku='SM-QATEST';
async function fixture(price,run){const browser=await chromium.launch({headless:true,channel:'chrome'});try{const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:`<input type="radio" name="pd-color" id="color" data-modelcode="${sku}"><label for="color">Azul QA</label><input type="radio" name="pd-device-memory" id="memory" data-modelcode="${sku}" data-modelprice="2599"><label for="memory">64 GB $${price}</label><input type="radio" name="pd-trade-in" id="trade" data-modelcode="${sku}"><label for="trade">NO</label><a role="button" an-ac="addToCart" data-modelcode="${sku}" data-modelprice="2599" canaddtocart="true" onclick="document.body.dataset.add='clicked'">Agregar al carrito</a>`}));await page.goto('https://p6-pre-qa2.samsung.com/mx/smartphones/galaxy-a/qa-sm-qatest/buy/');await run(page);}finally{await browser.close();}}
test('classic BC requires selected native exact-SKU colour/storage, matching price and trade-in opt-out without submitting',async()=>{
 await fixture('2,599.00',async page=>{const {add,evidence}=await prepareMxClassicBcPdp(page,sku);assert.equal(evidence.colorText,'Azul QA');assert.equal(evidence.price,2599);assert.equal(evidence.modelCode,sku);assert.equal(await add.getAttribute('data-modelcode'),sku);assert.equal(await page.locator('body').getAttribute('data-add'),null);assert.equal(await page.locator('#trade').isChecked(),true);});
});
test('mismatched displayed price cannot reach Add or pass from a selected colour alone',async()=>{
 await fixture('2,600.00',async page=>{await assert.rejects(prepareMxClassicBcPdp(page,sku),/PRICE_OR_COLOUR_UNPROVEN/);assert.equal(await page.locator('body').getAttribute('data-add'),null);});
});
test('classic PDP rejects foreign scope or a different product route before inspecting controls',async()=>{
 for(const url of ['https://www.samsung.com/mx/smartphones/qa-sm-qatest/buy/','https://p6-pre-qa2.samsung.com/co/smartphones/qa-sm-qatest/buy/','https://p6-pre-qa2.samsung.com/mx/smartphones/qa-sm-other/buy/'])await assert.rejects(prepareMxClassicBcPdp({url:()=>url},sku),/SCOPE_INVALID/);
});
