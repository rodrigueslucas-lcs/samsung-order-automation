const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('pages/CheckoutPage.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class CheckoutPage','class CheckoutPage');
const Checkout=vm.runInNewContext(source+'\nCheckoutPage;',{URL,BasePage:class{}});
function scenario({site='pe',status=200,interrupted=false,url='https://stg2.shop.samsung.com/pe/checkout/one'}={}){
 let predicate,resolveResponse,clicks=0;
 const response={url:()=>`https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${site}/users/current/carts/current/checkout/update`,request:()=>({method:()=> 'POST'}),ok:()=>status===200,status:()=>status,finished:async()=>interrupted?Error('interrupted'):null};
 const checkout=Object.create(Checkout.prototype);
 checkout.page={url:()=>url,waitForResponse:(match,options)=>{predicate=match;assert.equal(options.timeout,120000);return new Promise(resolve=>{resolveResponse=resolve})}};
 checkout.customerContinueButton={click:async()=>{assert.equal(typeof predicate,'function','observer must precede submit');clicks++}};
 if(site!=='pe'){checkout.peApiSite=site;checkout.peApiOrigin='https://s2-smb-api-cdn.ecom-stg.samsung.com'}
 return {checkout,response,clicks:()=>clicks,predicate:()=>predicate,ack:()=>resolveResponse(response)};
}
test('PE Contact waits for its pending write even though the Delivery header already exists',async()=>{
 const s=scenario();let done=false;
 const pending=s.checkout.submitPeContact().then(()=>{done=true});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);assert.equal(s.clicks(),1);
 const match=s.predicate();assert.equal(match(s.response),true);
 assert.equal(match({...s.response,request:()=>({method:()=> 'GET'})}),false);
 assert.equal(match({...s.response,url:()=>s.response.url().replace('/v2/pe/','/v2/other/')}),false);
 s.ack();await pending;assert.equal(done,true);assert.equal(s.clicks(),1);
});
test('PE EPP Contact uses only its configured program endpoint',async()=>{
 const s=scenario({site:'pe_membership_vip'}),pending=s.checkout.submitPeContact();
 assert.equal(s.predicate()(s.response),true);
 assert.equal(s.predicate()({...s.response,url:()=>s.response.url().replace('/v2/pe_membership_vip/','/v2/pe/')}),false);
 s.ack();await pending;assert.equal(s.clicks(),1);
});
for(const options of [{status:503},{interrupted:true}])test(`PE Contact failure does not repeat the write ${JSON.stringify(options)}`,async()=>{
 const s=scenario(options),pending=s.checkout.submitPeContact();s.ack();
 await assert.rejects(pending,/Contact.*(?:HTTP 503|interrupted)/);assert.equal(s.clicks(),1);
});
for(const site of ['pe','pe_membership_vip'])test(`PE Contact refuses Production before any submit (${site})`,async()=>{
 const s=scenario({site,url:'https://shop.samsung.com/pe/checkout/one'});
 await assert.rejects(s.checkout.submitPeContact(),/configured staging/);assert.equal(s.clicks(),0);
});

test('PE Contact reaches the exact Delivery heading when the address form has its own heading',async()=>{
 const {chromium}=require('@playwright/test');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://stg2.shop.samsung.com/pe/checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',route=>route.fulfill({contentType:'text/html',body:'<div role="option">QA DOCUMENT</div>'}));
  await page.goto('https://stg2.shop.samsung.com/pe/checkout/one?step=CHECKOUT_STEP_CONTACT_INFO');
  const checkout=Object.create(Checkout.prototype);checkout.page=page;
  checkout.firstNameInput={fill:async()=>{},isVisible:async()=>true};
  checkout.lastNameInput=checkout.phoneInput=checkout.firstNameInput;
  checkout.documentTypeSelect={click:async()=>{}};
  checkout.documentNumberInput={fill:async()=>{},inputValue:async()=> 'QA'};
  checkout.customerContinueButton={isEnabled:async()=>true};
  checkout.screenshot=async()=>{};
  checkout.submitPeContact=async()=>page.setContent('<main><h2>2. Direcci\u00f3n de entrega</h2><h3>Completa tu direcci\u00f3n de entrega</h3><div role="tabpanel" aria-label="Env\u00edo">Ready</div></main>');
  await checkout.fillCustomerData({firstName:'QA',lastName:'QA',phone:'QA',documentType:'QA DOCUMENT',documentNumber:'QA'});
 }finally{await browser.close()}
});
