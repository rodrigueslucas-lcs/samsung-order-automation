const test=require('node:test'),assert=require('node:assert/strict');
const {continueCoEppContactToDelivery}=require('../../utils/eppBusinessAssertions.cjs');
const cfg={market:'CO',environment:'S2',program:'co_epp_agre',rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/')};
function fixture({status=200,body=Promise.resolve(null)}={}){
 let clock=0;const calls=[];
 const response={url:()=> 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/co_epp_agre/users/current/carts/current/checkout/update',request:()=>({method:()=> 'POST'}),ok:()=>status===200,status:()=>status,finished:async()=>{calls.push('body');const failure=await body;clock=58000;return failure;}};
 const contact=new URL('checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',cfg.rootUrl);
 const page={url:()=>contact.href,waitForResponse:async predicate=>{
  calls.push('listen');assert.equal(predicate(response),true);
  for(const change of [{url:()=>response.url().replace('/co_epp_agre/','/co/')},{url:()=>response.url().replace('s2-smb','s1-smb')},{url:()=>response.url().replace('https:','http:')},{request:()=>({method:()=> 'GET'})}])assert.equal(predicate({...response,...change}),false);
  return response;
 },waitForURL:async(predicate,options)=>{calls.push('route');assert.equal(options.waitUntil,'commit');assert.equal(options.timeout,62000);const target=new URL(contact);target.searchParams.set('step','CHECKOUT_STEP_DELIVERY');assert.equal(predicate(target),true);assert.equal(predicate(new URL('https://stg2.shop.samsung.com/co/checkout/one?step=CHECKOUT_STEP_DELIVERY')),false);},getByRole:(role,{name})=>{assert.equal(role,'tab');assert.ok(name.test('Recoge'));return{first:()=>({waitFor:async()=>calls.push('delivery-controls')})};}};
 return{calls,page,button:{click:async()=>calls.push('click')},options:{now:()=>clock}};
}
test('CO waits for a 58s acknowledged body, then proves Delivery without another click',async()=>{const f=fixture();await continueCoEppContactToDelivery(f.page,f.button,cfg,f.options);assert.deepEqual(f.calls,['listen','click','body','route','delivery-controls']);});
test('pending response body cannot release Delivery or cause a second submit',async()=>{let finish;const f=fixture({body:new Promise(resolve=>{finish=resolve;})});const running=continueCoEppContactToDelivery(f.page,f.button,cfg,f.options);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,['listen','click','body']);finish(null);await running;assert.equal(f.calls.filter(x=>x==='click').length,1);});
for(const status of [401,403,503])test('CO HTTP'+status+' fails without retry or false Delivery',async()=>{const f=fixture({status});await assert.rejects(continueCoEppContactToDelivery(f.page,f.button,cfg,f.options),new RegExp('HTTP '+status));assert.deepEqual(f.calls,['listen','click']);});
test('interrupted body fails without repeating contact',async()=>{const f=fixture({body:Promise.resolve(Error('interrupted'))});await assert.rejects(continueCoEppContactToDelivery(f.page,f.button,cfg,f.options),/interrupted/);assert.deepEqual(f.calls,['listen','click','body']);});
test('a body that never finishes reaches its bounded deadline without another click',async()=>{const f=fixture({body:new Promise(()=>{})});await assert.rejects(continueCoEppContactToDelivery(f.page,f.button,cfg,{timeout:20}),/body deadline exceeded/);assert.deepEqual(f.calls,['listen','click','body']);});
test('foreign programme/environment/route is refused before listening or clicking',async()=>{for(const change of [{market:'MX'},{environment:'S1'},{program:'alianzas_co'},{rootUrl:new URL('https://www.samsung.com/co/')}]){const f=fixture();await assert.rejects(continueCoEppContactToDelivery(f.page,f.button,{...cfg,...change},f.options));assert.deepEqual(f.calls,[]);}});
