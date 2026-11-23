const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {chromium,expect}=require('@playwright/test');
const {watchEppProductRead}=require('../../utils/eppPendingProductRead.cjs');
const cfg={environment:'S2',program:'pymesmx',sku:'QA-SKU',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/'),pdpUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/p/QA-SKU')};
const api='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/pymesmx/products/QA-SKU';
const source=fs.readFileSync('flows/eppStorefront.js','utf8');
function recovery(assertions=expect){const part=source.slice(source.indexOf('export async function recoverEppPdpContent'),source.indexOf('export async function openEppStore')).replace('export ','');return vm.runInNewContext(part+'\nrecoverEppPdpContent;',{expect:assertions,URL});}

test('only the exact S2 programme/SKU GET can extend readiness; listeners always detach',()=>{
 const page=new EventEmitter(),watch=watchEppProductRead(page,cfg);
 const request=(url,method='GET')=>({url:()=>url,method:()=>method});
 for(const r of [request(api,'POST'),request(api.replace('pymesmx','other')),request(api.replace('QA-SKU','OTHER')),request(api.replace('s2-smb','s1-smb')),request(api.replace('s2-smb-api-cdn.ecom-stg.samsung.com','foreign.example'))])page.emit('request',r);
 assert.equal(watch.hasPending(),false);
 const actual=request(api);page.emit('request',actual);assert.equal(watch.hasPending(),true);
 page.emit('requestfinished',request(api));assert.equal(watch.hasPending(),true,'An unrelated response must not settle the owned request');
 page.emit('requestfailed',actual);assert.equal(watch.hasPending(),false);
 watch.stop();for(const event of ['request','requestfinished','requestfailed'])assert.equal(page.listenerCount(event),0);
 const s1=watchEppProductRead(page,{...cfg,environment:'S1'});page.emit('request',actual);assert.equal(s1.hasPending(),false);s1.stop();
});

test('a pending product response may render normally without a reload',async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 let watch;
 try{
  const page=await browser.newPage();let release;
  const responseReady=new Promise(resolve=>{release=resolve;});
  await page.route(cfg.pdpUrl.href,route=>route.fulfill({contentType:'text/html',body:'<div id="result"></div>'}));
  await page.route(api,async route=>{await responseReady;await route.fulfill({contentType:'text/plain',body:'QA-SKU'});});
  watch=watchEppProductRead(page,cfg);await page.goto(cfg.pdpUrl.href);
  await page.evaluate(api=>{fetch(api).then(r=>r.text()).then(text=>{document.querySelector('#result').innerHTML='<div data-product>'+text+'</div>';});},api);
  await expect.poll(watch.hasPending).toBeTruthy();
  let reloads=0;page.reload=async()=>{reloads++;throw Error('Unexpected reload of the pending product');};
  const inspect=async()=>await page.locator('[data-product]').isVisible()?{status:'READY',reason:'MULTISTORE_CONTENT_PROVEN'}:{status:'BLOCKED',reason:'COMMERCE_CONTENT_NOT_RENDERED'};
  setTimeout(release,200);
  const result=await recovery()(page,cfg,await inspect(),inspect,{pendingProduct:watch});
  assert.equal(result.status,'READY');assert.equal(reloads,0);
 }finally{watch?.stop();await browser.close();}
});

test('an exhausted pending-read deadline stays failed and never reloads the request',async()=>{
 let reloads=0;
 const state={status:'BLOCKED',reason:'COMMERCE_CONTENT_NOT_RENDERED'};
 const result=await recovery({poll:fn=>({toBeTruthy:async()=>{assert.equal(await fn(),false);throw Error('bounded deadline');}})})
  ({url:()=>cfg.pdpUrl.href,reload:async()=>{reloads++;}},cfg,state,async()=>state,{pendingProduct:{hasPending:()=>true}});
 assert.equal(result.status,'BLOCKED');assert.equal(reloads,0);
});

for(const failing of [false,true])test(`storefront detaches its product observer on ${failing?'failure':'success'}`,async()=>{
 let stopped=0;
 const wrapper=source.slice(source.indexOf('export async function openEppStore'),source.indexOf('async function openEppStoreContent')).replace('export ','');
 const open=vm.runInNewContext(wrapper+'\nopenEppStore;',{eppProductReads:{watchEppProductRead:()=>({stop:()=>stopped++})},openEppStoreContent:async()=>{if(failing)throw Error('fixture failure');return 'READY';}});
 if(failing)await assert.rejects(open({},cfg),/fixture failure/);else assert.equal(await open({},cfg),'READY');
 assert.equal(stopped,1);
});
