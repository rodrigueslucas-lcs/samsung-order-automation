const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppStorefront.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
const recover=vm.runInNewContext(source+'\nrecoverEppPdpContent;',{URL,expect:{poll:fn=>({toBeTruthy:async()=>{assert.equal(await fn(),true);}})}});
for(const market of ['MX','PE','CO','CL'])test(market+' S2 recovers only its configured empty PDP GET once',async()=>{
 const pdpUrl=new URL('https://stg2.shop.samsung.com/'+market.toLowerCase()+'/multistore/qa/qa/p/QA');let reloads=0;
 const state=await recover({url:()=>pdpUrl.href,reload:async()=>{reloads++;}},{market,environment:'S2',pdpUrl},{status:'BLOCKED',reason:'COMMERCE_CONTENT_NOT_RENDERED'},async()=>({status:'READY',reason:'MULTISTORE_CONTENT_PROVEN'}));
 assert.equal(state.status,'READY');assert.equal(reloads,1);
});
test('PDP recovery never replays auth/code gates, S1, foreign routes or another SKU',async()=>{
 const pdpUrl=new URL('https://stg2.shop.samsung.com/mx/multistore/qa/qa/p/QA');
 for(const [environment,url,reason]of [['S1',pdpUrl.href,'COMMERCE_CONTENT_NOT_RENDERED'],['S2',pdpUrl.href,'CORPORATE_ACTIVATION_REQUIRED'],['S2',pdpUrl.href,'VERIFICATION_CODE_REJECTED'],['S2',pdpUrl.href+'-OTHER','COMMERCE_CONTENT_NOT_RENDERED'],['S2','https://www.samsung.com/','COMMERCE_CONTENT_NOT_RENDERED']]){
  const state={status:'BLOCKED',reason};assert.equal(await recover({url:()=>url,reload:async()=>assert.fail('unexpected GET replay')},{environment,pdpUrl},state,async()=>assert.fail('unexpected proof substitute')),state);
 }
});
test('repeated MX setup starts with five old units and proves one fresh Add per case without accumulating quantity',async()=>{
 let quantity=5;const calls=[],page={url:()=> 'https://stg2.shop.samsung.com/mx/multistore/qa/qa/cart'};
 class CartPage{constructor(page,options){this.page=page;this.sku=options.sku;}async clearMxCartAndConfirmEmpty(){calls.push('clear');quantity=0;}}
 class ProductPage{async addConfiguredPdpToCart(){calls.push('add');quantity++;}}
 const add=vm.runInNewContext(source+'\nopenEppStore=async()=>{};addConfiguredEppProduct;',{URL,calls,CartPage,ProductPage,business:{assertStoreRoute(){},getEppCartTextPatterns:()=>({})},mxReadback:{}});
 const cfg={market:'MX',environment:'S2',sku:'QA',pdpUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/qa/qa/p/QA'),cartUrl:new URL(page.url())};
 await add(page,cfg);assert.equal(quantity,1);await add(page,cfg);assert.equal(quantity,1);assert.deepEqual(calls,['clear','add','clear','add']);
 await assert.rejects(add(page,{...cfg,market:'PE'},{resetMxCart:true}),/cannot target another market/);
});

test('PE payment can delegate normalization while safe cart setup keeps its default behavior',async()=>{
 const calls=[],page={url:()=> 'https://stg2.shop.samsung.com/pe/multistore/qa/qa/cart'};
 class CartPage{constructor(page){this.page=page;}}
 class ProductPage{async addConfiguredPdpToCart(){calls.push('add');}}
 const add=vm.runInNewContext(source+'\nopenEppStore=async()=>{};normalizeEppCartQuantity=async()=>calls.push("optimistic-normalize");addConfiguredEppProduct;',{URL,calls,CartPage,ProductPage,business:{assertStoreRoute(){},getEppCartTextPatterns:()=>({})}});
 const cfg={market:'PE',environment:'S2',sku:'QA',pdpUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/qa/qa/p/QA'),cartUrl:new URL(page.url())};
 await add(page,cfg,{normalizeQuantity:false});assert.deepEqual(calls,['add']);
 await add(page,cfg);assert.deepEqual(calls,['add','add','optimistic-normalize']);
});

for(const market of ['PE','CO','CL'])test(market+' repeated cart setup retains one controlled quantity instead of accumulating to the Add limit',async()=>{
 let quantity=5,decreases=0;const input={inputValue:async()=>String(quantity)};
 const page={url:()=> 'https://stg2.shop.samsung.com/'+market.toLowerCase()+'/multistore/qa/qa/cart',getByRole:role=>role==='textbox'?input:{click:async()=>{quantity--;decreases++;}}};
 const normalize=vm.runInNewContext(source+'\nnormalizeEppCartQuantity;',{business:{assertStoreRoute(){}},expect:target=>({toHaveCount:async n=>assert.equal(n,1),toHaveValue:async n=>assert.equal(await target.inputValue(),n)})});
 await normalize({page},{market});assert.equal(quantity,1);assert.equal(decreases,4);
 quantity++;await normalize({page},{market});assert.equal(quantity,1);assert.equal(decreases,5);
});
