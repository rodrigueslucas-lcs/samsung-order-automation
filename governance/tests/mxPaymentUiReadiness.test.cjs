const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {chromium}=require('@playwright/test');
const {continueToReadyMxBasePayment,isMxS2BaseCheckout,continueToMxBaseDeliverySummary}=require('../../utils/mxPaymentUiReadiness.cjs');
const delivery='https://stg2.shop.samsung.com/mx/checkout/one?step=CHECKOUT_STEP_DELIVERY';
const payment=delivery.replace('DELIVERY','PAYMENT');
const api='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/mx/users/current/carts/current/paymentmodes';
for(const url of ['https://shop.samsung.com/mx/checkout/one?step=CHECKOUT_STEP_PAYMENT',payment.replace('/mx/','/co/'),payment.replace('/mx/','/mx/multistore/pymesmx/pymesmx/'),payment.replace('stg2.','stg.')])test('S2 Base payment recovery refuses another scope '+url,async()=>{
 assert.equal(isMxS2BaseCheckout(url),false);await assert.rejects(continueToReadyMxBasePayment({url:()=>url},()=>assert.fail(),()=>assert.fail()),/MX_PAYMENT_SCOPE_INVALID/);
});
async function browserScenario({failFirst=false}={}){
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();let reads=0,reloads=0,validated=0;const methods=[];
  await page.route('**/*',async route=>{
   methods.push(route.request().method());
   if(route.request().url().startsWith(api)){
    reads++;if(failFirst&&reads===1)return route.abort();
    await new Promise(resolve=>setTimeout(resolve,250));
    return route.fulfill({contentType:'application/json',body:'{}'});
   }
   return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><section role="region" aria-label="3. Métodos de Pago"><div>Loading</div></section><script>if(location.href.includes('PAYMENT'))fetch('${api}').then(r=>{if(r.ok)document.querySelector('section').innerHTML='<button>Tarjeta de Crédito</button>'}).catch(()=>{});</script>`});
  });
  await page.goto(delivery);const reload=page.reload.bind(page);page.reload=async options=>{reloads++;return reload(options);};
  await continueToReadyMxBasePayment(page,()=>page.goto(payment),async()=>{
   assert.equal(await page.getByRole('button',{name:'Tarjeta de Crédito'}).isVisible(),true);validated++;
  },{uiTimeoutMs:failFirst?100:2000,settleTimeoutMs:2000});
  assert.equal(validated,1);assert.equal(reloads,failFirst?1:0);assert.equal(reads,failFirst?2:1);assert.ok(methods.every(m=>m==='GET'));
 }finally{await browser.close();}
}
test('a visible Payment shell cannot pass while provider controls are still loading',()=>browserScenario());
test('one completed failed read permits one native GET reload without repeating Delivery',()=>browserScenario({failFirst:true}));
function fake({pending=false,status=200}={}){
 const page=new EventEmitter();let url=delivery,reloads=0,validations=0;
 page.url=()=>url;page.getByRole=()=>({getByRole:()=>({filter(){return this;},first(){return this;},waitFor:async()=>{throw Error('Loading');}})});
 const emit=()=>{const r={url:()=>api,method:()=> 'GET'};page.emit('request',r);if(!pending){page.emit('response',{request:()=>r,status:()=>status});page.emit('requestfinished',r);}};
 page.reload=async()=>{reloads++;emit();};
 return{page,transition:async()=>{url=payment;emit();},validate:()=>validations++,counts:()=>({reloads,validations})};
}
test('an in-flight payment read fails boundedly without a reload or a false address assertion',async()=>{
 const f=fake({pending:true});await assert.rejects(continueToReadyMxBasePayment(f.page,f.transition,f.validate,{uiTimeoutMs:10,settleTimeoutMs:10}),/MX_PAYMENT_READ_PENDING/);assert.deepEqual(f.counts(),{reloads:0,validations:0});assert.equal(f.page.eventNames().length,0);
});
for(const status of [401,403])test('HTTP '+status+' cannot become a recovery or authenticated checkout PASS',async()=>{
 const f=fake({status});await assert.rejects(continueToReadyMxBasePayment(f.page,f.transition,f.validate,{uiTimeoutMs:10,settleTimeoutMs:10}),/MX_PAYMENT_AUTH_REJECTED/);assert.deepEqual(f.counts(),{reloads:0,validations:0});
});
test('a permanently empty provider UI still fails after exactly one completed-read recovery',async()=>{
 const f=fake();await assert.rejects(continueToReadyMxBasePayment(f.page,f.transition,f.validate,{uiTimeoutMs:10,settleTimeoutMs:10}),/MX_PAYMENT_UI_NOT_READY/);assert.deepEqual(f.counts(),{reloads:1,validations:0});assert.equal(f.page.eventNames().length,0);
});

test('address summary validation does not wait for an unrelated pending payment-method read',async()=>{
 const f=fake({pending:true});await continueToMxBaseDeliverySummary(f.page,f.transition,f.validate);
 assert.deepEqual(f.counts(),{reloads:0,validations:1});assert.equal(f.page.eventNames().length,0);
});
test('address summary remains mandatory and route/transition failures cannot be accepted',async()=>{
 const f=fake();await assert.rejects(continueToMxBaseDeliverySummary(f.page,f.transition,async()=>{throw Error('address summary absent');}),/summary absent/);
 await assert.rejects(continueToMxBaseDeliverySummary({url:()=>delivery},async()=>{throw Error('delivery rejected');},()=>assert.fail()),/delivery rejected/);
 await assert.rejects(continueToMxBaseDeliverySummary({url:()=>delivery},async()=>{},()=>assert.fail()),/ROUTE_NOT_REACHED/);
 await assert.rejects(continueToMxBaseDeliverySummary({url:()=>delivery.replace('stg2.','')},()=>assert.fail(),()=>assert.fail()),/SCOPE_INVALID/);
});
