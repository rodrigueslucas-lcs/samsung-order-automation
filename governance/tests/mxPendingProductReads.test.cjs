const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('@playwright/test');
const readiness=require('../../utils/productPdpReadiness.cjs');
const pdp='https://stg2.shop.samsung.com/mx/p/TEST';
const productApi='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/mx/products/TEST';
const request=(url=productApi,method='GET')=>({url:()=>url,method:()=>method});

test('only exact staging MX SKU reads can delay recovery',()=>{
 const page=new EventEmitter(),watch=readiness.watchProductPdpReads(page,pdp);
 try{
  for(const other of [request(productApi.replace('/TEST','/OTHER')),request(productApi.replace('/v2/mx/','/v2/pymesmx/')),request(productApi.replace('s2-smb','s1-smb')),request(productApi,'POST'),request('https://analytics.invalid/event')])page.emit('request',other);
  assert.equal(watch.pending(),false);
  const own=request(productApi+'?fields=DEFAULT');page.emit('request',own);assert.equal(watch.pending(),true);
  page.emit('requestfailed',own);assert.equal(watch.pending(),false);
 }finally{watch.dispose()}
 for(const event of ['request','requestfinished','requestfailed'])assert.equal(page.listenerCount(event),0);
});
test('a partial response cannot release another pending product read',async()=>{
 const page=new EventEmitter(),watch=readiness.watchProductPdpReads(page,pdp),a=request(),b=request(productApi+'?fields=price');
 page.emit('request',a);page.emit('request',b);let settled=false;
 const waiting=watch.settle(2000).then(()=>{settled=true});
 page.emit('requestfinished',a);await Promise.resolve();assert.equal(settled,false);
 page.emit('requestfinished',b);await waiting;assert.equal(settled,true);watch.dispose();
});
test('an unresolved product read remains bounded and observation is disposable',async()=>{
 const page=new EventEmitter(),watch=readiness.watchProductPdpReads(page,pdp);page.emit('request',request());
 await watch.settle(5);assert.equal(watch.pending(),true);
 const waiting=watch.settle(2000);watch.dispose();await waiting;
 assert.equal(watch.pending(),false);assert.equal(page.listenerCount('request'),0);
});
test('Production and another market are rejected before observing anything',()=>{
 const page=new EventEmitter();
 for(const url of ['https://shop.samsung.com/mx/p/TEST','https://stg2.shop.samsung.com/co/p/TEST'])assert.throws(()=>readiness.watchProductPdpReads(page,url),/exact staging route/);
 assert.equal(page.listenerCount('request'),0);
});

let browser;before(async()=>{browser=await chromium.launch({headless:true})});after(async()=>{await browser?.close()});
for(const market of ['mx','pe'])test(`${market.toUpperCase()} slow product API beyond 20 seconds renders without a reload or repeated Add`,{timeout:40000},async()=>{
 const selectedPdp=pdp.replace('/mx/',`/${market}/`),selectedApi=productApi.replace('/mx/',`/${market}/`);
 const source=fs.readFileSync('pages/ProductPage.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class ProductPage','class ProductPage');
 const Product=vm.runInNewContext(source+'\nProductPage;',{URL,productPdpReadiness:readiness,BasePage:class{constructor(page){this.page=page}}});
 const context=await browser.newContext(),page=await context.newPage();let documents=0,apiReads=0;
 try{
  await page.route('**/*',async route=>{
   if(route.request().url()===selectedApi){apiReads++;await new Promise(resolve=>setTimeout(resolve,22500));return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({code:'TEST'})});}
   documents++;
   await route.fulfill({contentType:'text/html',body:`<main><app-product-add-to-cart id="purchase"></app-product-add-to-cart></main><script>fetch('${selectedApi}').then(r=>r.json()).then(()=>{document.querySelector('#purchase').innerHTML='<button onclick="window.adds=(window.adds||0)+1">Add to basket</button>'})</script>`});
  });
  const product=new Product(page,{pdpUrl:selectedPdp,sku:'TEST',cartUrl:`https://stg2.shop.samsung.com/${market}/cart`,cartReadback:async()=>true});
  product.safeGoto=url=>page.goto(url,{waitUntil:'domcontentloaded'});
  page.reload=()=>assert.fail('a pending configured product read must not be cancelled by reload');
  const listeners=['request','requestfinished','requestfailed'].map(e=>page.listenerCount(e));
  await product.addConfiguredPdpToCart();
  assert.equal(documents,1);assert.equal(apiReads,1);assert.equal(await page.evaluate(()=>window.adds),1);
  assert.deepEqual(['request','requestfinished','requestfailed'].map(e=>page.listenerCount(e)),listeners);
 }finally{await context.close()}
});
