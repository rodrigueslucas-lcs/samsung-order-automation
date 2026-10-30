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
