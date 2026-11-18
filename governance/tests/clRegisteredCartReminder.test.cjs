const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {chromium,expect}=require('@playwright/test');
const source=fs.readFileSync('pages/CartPage.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class CartPage','class CartPage');
const Cart=vm.runInNewContext(source+'\nCartPage;',{BasePage:class{},URL,Date,console,expect});
let browser;before(async()=>{browser=await chromium.launch({headless:true})});after(async()=>{await browser?.close()});
for(const environment of ['S1','S2'])test(`CL ${environment} late registered reminder resumes native checkout once without its campaign link or reload`,async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 const origin=environment==='S2'?'https://stg2.shop.samsung.com':'https://stg.shop.samsung.com';
 try{
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<button onclick="go()">Continuar</button><div class="ins-custom-cart-reminder-container" style="display:none"><span onclick="this.parentNode.style.display='none'">x</span><span onclick="window.campaignClicks=(window.campaignClicks||0)+1">Finalizar compra</span></div><script>window.nativeClicks=0;function go(){window.nativeClicks++;if(window.nativeClicks===1){setTimeout(()=>document.querySelector('div').style.display='block',100)}else{history.pushState({},'', '/cl/checkout/one?step=CHECKOUT_STEP_CONTACT_INFO')}}</script>`}));
  await page.goto(origin+'/cl/cart');
  page.reload=()=>assert.fail('late reminder must not trigger a cart reload');
  const cart=Object.create(Cart.prototype);Object.assign(cart,{page,cartUrl:origin+'/cl/cart',guestEmailPattern:/Ingresa tu correo/i,continueButton:page.getByRole('button',{name:'Continuar',exact:true}),screenshot:async()=>{}});
  await cart.proceedToAuthenticatedCheckout();
  assert.equal(new URL(page.url()).pathname,'/cl/checkout/one');
  assert.equal(await page.evaluate(()=>window.nativeClicks),2);
  assert.equal(await page.evaluate(()=>window.campaignClicks||0),0);
 }finally{await context.close()}
});
