const test=require('node:test'),assert=require('node:assert/strict');
const {createEppCausalOrderReadback}=require('../../utils/eppCausalOrderReadback.cjs');
const cfg={market:'PE',rootUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/')};
const mx={market:'MX',environment:'S2',program:'pymesmx',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/')};
test('rejection reconciliation reads all pages and refuses partial or changing history',async()=>{
 const at='2026-11-24T12:00:00Z';let mode='complete',calls=0;
 const reader=createEppCausalOrderReadback(mx,{sku:'QA',read:async path=>{
  calls++;
  if(!path.includes('pageSize'))return{code:path.includes('12345678')?'MX261123-12345678':'MX261123-87654321',created:mode==='new'?'2026-11-24T12:01:00Z':'2026-11-23T12:00:00Z'};
  const index=Number(new URL('https://synthetic.test'+path).searchParams.get('currentPage'));
  return{orders:[{code:index===0?'MX261123-12345678':'MX261123-87654321'}],pagination:mode==='missing'?undefined:{currentPage:index,numberOfPages:2,totalNumberOfResults:mode==='changing'&&index===1?3:2}};
 }});
 const proof=await reader.proveNoOrderSince(at);assert.equal(proof.historyComplete,true);assert.equal(calls,5);assert.deepEqual(proof.candidates,[]);
 mode='new';assert.equal(await reader.proveNoOrderSince(at),null);
 for(mode of ['missing','changing'])await assert.rejects(reader.proveNoOrderSince(at),/history not proven/);
 assert.equal(createEppCausalOrderReadback(cfg,{read:async()=>{},sku:'QA'}).proveNoOrderSince,undefined);
});
test('an order arriving while old order details are read cannot release a rejected attempt',async()=>{
 let scanned=false;
 const reader=createEppCausalOrderReadback(mx,{sku:'QA',read:async path=>{
  if(!path.includes('pageSize')){scanned=true;return{code:'MX261123-12345678',created:'2026-11-23T12:00:00Z'};}
  return{orders:scanned?[{code:'MX261124-87654321'},{code:'MX261123-12345678'}]:[{code:'MX261123-12345678'}],pagination:{currentPage:0,numberOfPages:1,totalNumberOfResults:scanned?2:1}};
 }});
 await assert.rejects(reader.proveNoOrderSince('2026-11-24T12:00:00Z'),/changed during reconciliation/);
});
test('causal readback excludes old and foreign-program orders and requires exact controlled entries',async()=>{
 let orders=[{code:'PE261029-12345678',site:'pe_membership_vip'}],quantity=1;
 const read=async path=>path.includes('?fields=FULL&pageSize')?{orders}:{code:'PE261029-12345679',created:new Date().toISOString(),entries:[{product:{code:'QA'},quantity}],totalPrice:{value:100}};
 const reader=createEppCausalOrderReadback(cfg,{read,sku:'QA'}),baseline=await reader.beforeSubmit();
 assert.equal(await reader.afterSubmit(baseline),null);
 orders.push({code:'PE261029-12345679',site:'base-store'});assert.equal(await reader.afterSubmit(baseline),null);
 orders[1].site='pe_membership_vip';assert.deepEqual(await reader.afterSubmit(baseline),{orderCode:'PE261029-12345679'});
 quantity=2;assert.equal(await reader.afterSubmit(baseline),null);
 quantity=1;orders.push({code:'PE261029-12345680',site:'pe_membership_vip'});assert.equal(await reader.afterSubmit(baseline),null);
});

test('programme readback binds authorization to the observed own-cart endpoint and GET-only requests',async()=>{const {createEppReadbackFromCartResponse}=require('../../utils/eppCausalOrderReadback.cjs');const cfg={market:'CL',environment:'S2',sku:'QA',rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')};const calls=[];const page={context:()=>({request:{get:async(url,options)=>{calls.push(url);assert.equal(options.maxRedirects,0);return{ok:()=>true,json:async()=>({orders:[]})};}}})};const response={ok:()=>true,url:()=> 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/alianzas/users/current/carts/current',request:()=>({method:()=> 'GET',headerValue:async()=> 'synthetic'})};const reader=await createEppReadbackFromCartResponse(page,cfg,response);assert.equal((await reader.beforeSubmit()).size,0);assert.equal(calls.length,1);assert.ok(calls[0].includes('/v2/alianzas/users/current/orders?'));await assert.rejects(createEppReadbackFromCartResponse(page,cfg,{...response,url:()=>response.url().replace('/alianzas/','/cl/')}),/own observed/);});

for(const created of [undefined,'invalid',new Date(Date.now()-86400000).toISOString(),new Date(Date.now()+86400000).toISOString()])test('history appearance alone cannot prove a newly created order: '+String(created),async()=>{let submitted=false;const read=async path=>path.includes('pageSize')?{orders:submitted?[{code:'PE261029-12345679',site:'pe_membership_vip'}]:[]}:{code:'PE261029-12345679',created,entries:[{product:{code:'QA'},quantity:1}],totalPrice:{value:100}};const reader=createEppCausalOrderReadback(cfg,{read,sku:'QA'}),baseline=await reader.beforeSubmit();submitted=true;assert.equal(await reader.afterSubmit(baseline),null);});
