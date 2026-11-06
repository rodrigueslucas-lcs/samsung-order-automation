const test=require('node:test'),assert=require('node:assert/strict');
const {assertCoEppCheckout,acceptCoEppCheckoutTerms}=require('../../flows/co/eppCheckout.cjs');
const cfg={market:'CO',environment:'S2',program:'co_epp_agre',rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/')};
test('CO checkout rejects Production, Base Store, other programmes and S1 before actions',()=>{
 const page=url=>({url:()=>url});
 assert.doesNotThrow(()=>assertCoEppCheckout(page(new URL('checkout/one',cfg.rootUrl).href),cfg));
 for(const url of ['https://www.samsung.com/co/checkout/one','https://stg2.shop.samsung.com/co/checkout/one','https://stg2.shop.samsung.com/co/multistore/alianzas_co/alianzas_co/checkout/one'])assert.throws(()=>assertCoEppCheckout(page(url),cfg),/left/);
 assert.throws(()=>assertCoEppCheckout({}, {...cfg,environment:'S1'}),/proven/);
});
function consentFixture(){const checked=new Set(),calls=[];return{calls,checked,page:{locator:selector=>{const name=selector.match(/name="([^"]+)"/)[1];return{count:async()=>1,getAttribute:async()=>name==='marketingOptIn'?'':null,isVisible:async()=>true,isEnabled:async()=>true,isChecked:async()=>checked.has(name),check:async()=>{checked.add(name);calls.push(name);}};}}};}

test('CO pickup validates its saved billing address without clicking the disabled shipping-copy field',async()=>{
 const {chromium}=require('@playwright/test'),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.setContent('<input name="sameAsShipping" type="checkbox" disabled hidden><app-billing-address-v2><input type="radio" aria-label="Dirección guardada" checked><input type="radio" aria-label="QA street, QA city" checked id="saved"></app-billing-address-v2>');
  await require('../../flows/co/eppCheckout.cjs').ensureCoEppBilling(page);assert.equal(await page.locator('[name=sameAsShipping]').isChecked(),false);
  await page.locator('#saved').uncheck().catch(()=>{});await page.evaluate(()=>document.querySelector('#saved').checked=false);
  await assert.rejects(require('../../flows/co/eppCheckout.cjs').ensureCoEppBilling(page));
 }finally{await browser.close();}
});
test('approval for disposable email does not silently subscribe FIRST',async()=>{
 const f=consentFixture();const result=await acceptCoEppCheckoutTerms(f.page,{qaRecipient:false,env:{}});
 assert.equal(result.reason,'HUMAN_REQUIRED');assert.deepEqual(f.calls,[]);
});
for(const options of [{qaRecipient:true,env:{}},{qaRecipient:false,env:{CO_EPP_ALLOW_PRIMARY_MARKETING:'1'}}])test('authorized staging consent never enrolls Rewards '+JSON.stringify(options),async()=>{
 const f=consentFixture();assert.equal(await acceptCoEppCheckoutTerms(f.page,options),null);
 assert.ok(f.checked.has('marketingOptIn'));assert.ok(f.checked.has('termsAndCondition'));assert.ok(!f.checked.has('rewardsProgramOptIn'));
 const count=f.calls.length;await acceptCoEppCheckoutTerms(f.page,options);assert.equal(f.calls.length,count);
});

test('CO pickup uses the rendered Bogota store and enabled slot without payment',async()=>{const{chromium}=require('@playwright/test'),browser=await chromium.launch({headless:true});try{const context=await browser.newContext(),page=await context.newPage(),calls=[];await page.route('**/*',async route=>{if(route.request().method()==='POST'){calls.push(new URL(route.request().url()).pathname);return route.fulfill({contentType:'application/json',body:'{}'});}return route.fulfill({contentType:'text/html',body: `<button role="tab" aria-selected="false" onclick="this.setAttribute('aria-selected','true')">Recoge</button><mat-select name="pickupStoreSelect" role="combobox" onclick="document.querySelector('[role=option]').hidden=false">Elegir</mat-select><div role="option" hidden onclick="document.querySelector('mat-select').textContent=this.textContent;this.hidden=true">Bogota, D.C.</div><div onclick="document.querySelector('[name=store_option]').checked=true;fetch('https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/co_epp_agre/users/current/carts/current/deliverymodes/updateDeliveryEntriesStorePickup',{method:'POST'})">Casa Samsung</div><input type="radio" name="store_option"><label for="slot">Recoge entre 8:30 AM y 9:30 AM</label><input id="slot" type="radio" name="delivery_date_option">`});});await page.goto(new URL('checkout/one?step=CHECKOUT_STEP_DELIVERY',cfg.rootUrl).href);await require('../../flows/co/eppCheckout.cjs').selectCoEppPickupDelivery(page,cfg);assert.equal(await page.locator('[name=store_option]').isChecked(),true);assert.equal(await page.locator('[name=delivery_date_option]').isChecked(),true);assert.equal(calls.length,1);assert.ok(!calls[0].includes('submitOrder'));await context.close();}finally{await browser.close();}});
