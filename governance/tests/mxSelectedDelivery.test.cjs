const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{chromium}=require('@playwright/test');
const source=fs.readFileSync('pages/MxCheckoutPage.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class MxCheckoutPage','class MxCheckoutPage');
const Checkout=vm.runInNewContext(source+'\nMxCheckoutPage;',{BasePage:class{},URL,contactTransition:{}});
let browser;before(async()=>{browser=await chromium.launch({headless:true})});after(async()=>{await browser?.close()});
async function scenario({selected=true,status=200,environment='S1'}={}){
 const context=await browser.newContext(),page=await context.newPage(),updates=[];const origin=environment==='S2'?'https://stg2.shop.samsung.com':'https://stg.shop.samsung.com';
 await page.route('**/*',async route=>{if(route.request().method()==='POST'){updates.push(route.request().url());return route.fulfill({status,contentType:'application/json',body:'{}'});}return route.fulfill({contentType:'text/html; charset=utf-8',body:`<p>Recibirás tu producto mañana</p><label><input type="radio" name="delivery" ${selected?'checked':''} onchange="fetch('/users/current/carts/current/deliverymodes/update',{method:'POST'})">Entrega Estándar</label><button onclick="sessionStorage.continues=Number(sessionStorage.continues||0)+1;history.pushState({},'', '?step=CHECKOUT_STEP_PAYMENT')">Continuar</button>`});});
 await page.goto(origin+'/mx/checkout/one?step=CHECKOUT_STEP_DELIVERY');
 const checkout=Object.create(Checkout.prototype);Object.assign(checkout,{page,storefront:null});return{page,context,updates,checkout};
}
for(const environment of ['S1','S2'])test(`${environment} already selected Standard does not wait for a nonexistent mode-update POST`,async()=>{const f=await scenario({environment});try{await f.checkout.selectDeliveryAndContinue();assert.equal(f.updates.length,0);assert.equal(await f.page.evaluate(()=>sessionStorage.continues),'1');assert.equal(new URL(f.page.url()).searchParams.get('step'),'CHECKOUT_STEP_PAYMENT');}finally{await f.context.close()}});
test('a changed delivery mode still requires its real acknowledged POST',async()=>{const f=await scenario({selected:false});try{await f.checkout.selectDeliveryAndContinue();assert.equal(f.updates.length,1);assert.equal(await f.page.evaluate(()=>sessionStorage.continues),'1');}finally{await f.context.close()}});
test('a rejected delivery change stops before Continue',async()=>{const f=await scenario({selected:false,status:500});try{await assert.rejects(f.checkout.selectDeliveryAndContinue(),/HTTP 500/);assert.equal(f.updates.length,1);assert.equal(await f.page.evaluate(()=>sessionStorage.getItem('continues')),null);}finally{await f.context.close()}});

for(const checked of [false,true])test(`Base Delivery accepts required product conditions before Continue (initially checked=${checked})`,async()=>{
 const f=await scenario({environment:'S2'});
 try{
  await f.page.evaluate(checked=>{
   const form=document.createElement('div');
   form.innerHTML=`<label><input id="condition" type="checkbox" ${checked?'checked':''}>Reconozco y acepto que el producto puede incluir detalles estéticos</label><label><input id="marketing" type="checkbox">Deseo recibir ofertas</label>`;
   document.body.prepend(form);
   document.querySelector('button').onclick=()=>{
    if(!document.querySelector('#condition').checked)return;
    sessionStorage.continues=Number(sessionStorage.continues||0)+1;
    history.pushState({},'', '?step=CHECKOUT_STEP_PAYMENT');
   };
  },checked);
  await f.checkout.selectDeliveryAndContinue();
  assert.equal(await f.page.locator('#condition').isChecked(),true);
  assert.equal(await f.page.locator('#marketing').isChecked(),false);
  assert.equal(await f.page.evaluate(()=>sessionStorage.continues),'1');
  assert.equal(new URL(f.page.url()).searchParams.get('step'),'CHECKOUT_STEP_PAYMENT');
 }finally{await f.context.close()}
});

