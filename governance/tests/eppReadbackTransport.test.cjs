const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEppReadbackFromCartResponse}=require('../../utils/eppCausalOrderReadback.cjs');
const cfg={market:'MX',environment:'S2',program:'pymesmx',sku:'QA',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/')};
const cart=(site='pymesmx',identity='synthetic')=>({url:()=>`https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${site}/users/current/carts/current`,ok:()=>true,request:()=>({method:()=> 'GET',headerValue:async()=>identity})});
const response=status=>({ok:()=>status===200,status:()=>status,json:async()=>({orders:[]})});
test('MX readback retries only a gateway GET and uses the latest own cart identity',async()=>{
 const calls=[];let current=cart();
 const page={context:()=>({request:{get:async(url,options)=>{calls.push({url,options});current=cart('pymesmx','fresh-synthetic');return response(calls.length===1?502:200);}}})};
 const reader=await createEppReadbackFromCartResponse(page,cfg,current,{latestCartResponse:()=>current});
 assert.equal((await reader.beforeSubmit()).size,0);assert.equal(calls.length,2);
 assert.equal(calls[1].options.headers.authorization,'fresh-synthetic');
 assert.equal(calls[0].options.timeout,75000);
 assert.ok(calls.every(c=>c.url.includes('/users/current/orders?')));
});
for(const status of [400,401,403])test(`MX readback never retries HTTP ${status}`,async()=>{
 let calls=0;const page={context:()=>({request:{get:async()=>{calls++;return response(status);}}})};
 const reader=await createEppReadbackFromCartResponse(page,cfg,cart());
 await assert.rejects(reader.beforeSubmit(),new RegExp(`HTTP ${status}`));assert.equal(calls,1);
});
test('MX readback rejects a foreign latest cart before sending any request',async()=>{
 let calls=0;const page={context:()=>({request:{get:async()=>{calls++;return response(200);}}})};
 const reader=await createEppReadbackFromCartResponse(page,cfg,cart(),{latestCartResponse:()=>cart('foreign')});
 await assert.rejects(reader.beforeSubmit(),/own observed programme cart/);assert.equal(calls,0);
});
test('transport failure is bounded to two GETs and suppresses raw details',async()=>{
 let calls=0;const page={context:()=>({request:{get:async()=>{calls++;throw new Error('private transport detail');}}})};
 const reader=await createEppReadbackFromCartResponse(page,cfg,cart());
 await assert.rejects(reader.beforeSubmit(),error=>error.message.includes('EPP_ORDER_READBACK_UNAVAILABLE')&&!error.message.includes('private'));
 assert.equal(calls,2);
});
test('other markets preserve one GET and their existing 30-second bound',async()=>{
 const pe={...cfg,market:'PE',program:'pe_membership_vip',rootUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/')};
 let calls=0;
 const page={context:()=>({request:{get:async(url,options)=>{calls++;assert.equal(options.timeout,30000);assert.ok(url.includes('/pe_membership_vip/users/current/orders?'));return response(502);}}})};
 const reader=await createEppReadbackFromCartResponse(page,pe,cart('pe_membership_vip'));
 await assert.rejects(reader.beforeSubmit(),/HTTP 502/);assert.equal(calls,1);
});
