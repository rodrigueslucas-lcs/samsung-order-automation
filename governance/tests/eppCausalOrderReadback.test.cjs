const test=require('node:test'),assert=require('node:assert/strict');
const {createEppCausalOrderReadback}=require('../../utils/eppCausalOrderReadback.cjs');
const cfg={market:'PE',rootUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/')};
test('causal readback excludes old and foreign-program orders and requires exact controlled entries',async()=>{
 let orders=[{code:'PE261029-12345678',site:'pe_membership_vip'}],quantity=1;
 const read=async path=>path.includes('?fields=FULL&pageSize')?{orders}:{code:'PE261029-12345679',entries:[{product:{code:'QA'},quantity}],totalPrice:{value:100}};
 const reader=createEppCausalOrderReadback(cfg,{read,sku:'QA'}),baseline=await reader.beforeSubmit();
 assert.equal(await reader.afterSubmit(baseline),null);
 orders.push({code:'PE261029-12345679',site:'base-store'});assert.equal(await reader.afterSubmit(baseline),null);
 orders[1].site='pe_membership_vip';assert.deepEqual(await reader.afterSubmit(baseline),{orderCode:'PE261029-12345679'});
 quantity=2;assert.equal(await reader.afterSubmit(baseline),null);
 quantity=1;orders.push({code:'PE261029-12345680',site:'pe_membership_vip'});assert.equal(await reader.afterSubmit(baseline),null);
});

test('programme readback binds authorization to the observed own-cart endpoint and GET-only requests',async()=>{const {createEppReadbackFromCartResponse}=require('../../utils/eppCausalOrderReadback.cjs');const cfg={market:'CL',environment:'S2',sku:'QA',rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')};const calls=[];const page={context:()=>({request:{get:async(url,options)=>{calls.push(url);assert.equal(options.maxRedirects,0);return{ok:()=>true,json:async()=>({orders:[]})};}}})};const response={ok:()=>true,url:()=> 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/alianzas/users/current/carts/current',request:()=>({method:()=> 'GET',headerValue:async()=> 'synthetic'})};const reader=await createEppReadbackFromCartResponse(page,cfg,response);assert.equal((await reader.beforeSubmit()).size,0);assert.equal(calls.length,1);assert.ok(calls[0].includes('/v2/alianzas/users/current/orders?'));await assert.rejects(createEppReadbackFromCartResponse(page,cfg,{...response,url:()=>response.url().replace('/alianzas/','/cl/')}),/own observed/);});
