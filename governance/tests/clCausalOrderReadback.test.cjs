const {test}=require('node:test'),assert=require('node:assert/strict');
const {createClReadbackFromCartResponse,confirmClCreatedOrder}=require('../../flows/cl/causalOrderReadback.cjs');
const api='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/cl';
const code='CL261119-12345678_261119120000';
function fixture({route='https://stg2.shop.samsung.com/cl/checkout/one',order={},site='cl',multiple=false,old=false,uiFails=false}={}){
 let submitted=false;const calls=[];let current=route;
 const detail={code,placed:Date.now(),status:{code:'TEMPORARY'},entries:[{product:{code:'QA'},quantity:1}],totalPrice:{value:100},...order};
 const response={url:()=>api+'/users/current/carts/current',ok:()=>true,request:()=>({method:()=> 'GET',headerValue:async()=> 'synthetic'}),json:async()=>({entries:[{product:{code:'QA'},quantity:1}],totalPrice:{value:100}})};
 const page={url:()=>current,context:()=>({request:{get:async(url,options)=>{calls.push(url);assert.equal(options.maxRedirects,0);assert.equal(options.headers.authorization,'synthetic');return{ok:()=>true,json:async()=>url.includes('pageSize')?{currentOrders:submitted||old?[{code,site},...(multiple?[{code:'CL261119-12345679',site}]:[])]:[]}:detail};}}}),waitForTimeout:async()=>{},goto:async url=>{calls.push('UI');current=url},waitForURL:async match=>{assert.equal(match(new URL(current)),true)},getByText:()=>({filter(){return this},first(){return this},waitFor:async()=>{if(uiFails)throw Error('confirmation UI missing')}})};
 return {page,response,calls,submit:()=>{submitted=true}};
}
test('CL 601 requires a newly created exact own-site order and total, then genuine confirmation UI',async()=>{
 const f=fixture(),reader=await createClReadbackFromCartResponse(f.page,f.response),baseline=await reader.beforeSubmit();f.submit();
 const result=await confirmClCreatedOrder(f.page,reader,baseline);assert.equal(result.orderCode,code);assert.equal(result.outcome,'CAUSAL_ORDER_CONFIRMED_AFTER_601');assert.equal(f.calls.filter(c=>c==='UI').length,1);assert.ok(f.calls.every(c=>c==='UI'||c.startsWith(api+'/users/current/orders')));
});
for(const bad of [{old:true},{site:'alianzas'},{multiple:true},{order:{placed:Date.now()-86400000}},{order:{entries:[{product:{code:'OTHER'},quantity:1}]}},{order:{entries:[{product:{code:'QA'},quantity:2}]}},{order:{totalPrice:{value:99}}},{order:{status:'CANCELLED'}}])test('CL does not accept unrelated/reused/incorrect order '+JSON.stringify(bad),async()=>{
 const f=fixture(bad),reader=await createClReadbackFromCartResponse(f.page,f.response),baseline=await reader.beforeSubmit();f.submit();await assert.rejects(confirmClCreatedOrder(f.page,reader,baseline),/no unique causal/);assert.ok(!f.calls.includes('UI'));
});
test('CL an order without success UI cannot become confirmation PASS',async()=>{
 const f=fixture({uiFails:true}),reader=await createClReadbackFromCartResponse(f.page,f.response),baseline=await reader.beforeSubmit();f.submit();await assert.rejects(confirmClCreatedOrder(f.page,reader,baseline),/UI missing/);assert.equal(f.calls.filter(c=>c==='UI').length,1);
});
for(const route of ['https://shop.samsung.com/cl/checkout/one','https://stg.shop.samsung.com/cl/checkout/one','https://stg2.shop.samsung.com/pe/checkout/one','https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/checkout/one'])test('CL causal readback rejects scope '+route,async()=>{
 const f=fixture({route});await assert.rejects(createClReadbackFromCartResponse(f.page,f.response),/S2 Base Store/);assert.equal(f.calls.length,0);
});
test('CL observed cart must be its exact accepted GET before capturing authorization',async()=>{
 const f=fixture();for(const response of [{...f.response,url:()=>f.response.url().replace('/cl/','/alianzas/')},{...f.response,request:()=>({method:()=> 'POST'})},{...f.response,ok:()=>false}])await assert.rejects(createClReadbackFromCartResponse(f.page,response),/observed current-cart GET/);assert.equal(f.calls.length,0);
});

test('CL flow submits once and uses causal confirmation only for its S2 card 601',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const source=fs.readFileSync('flows/cl/paymentFlows.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const calls=[];let onResponse;
 const page={on:(_event,fn)=>{onResponse=fn},off:()=>calls.push('detach'),url:()=> 'https://stg2.shop.samsung.com/cl/orderConfirmation;orderCode='+code,getByText:()=>({first:()=>({})})};
 const reader={beforeSubmit:async()=>{calls.push('baseline');return new Set()}};
 const run=vm.runInNewContext(source+'\ncontinueClRegisteredDeliveryToPayment=async()=>{emitCart();};executeClPaymentOrder;',{URL,Buffer,emitCart:()=>onResponse({}),process:{env:{CL_QST_ENVIRONMENT:'S2',ALLOW_PAYMENT_SUBMIT:'1'}},test:{skip:condition=>{assert.equal(condition,false)},step:async(_name,fn)=>fn()},expect:()=>({toMatch:()=>{},toHaveURL:async()=>{},toBeVisible:async()=>{}}),evidenceContext:{recordBusinessEvidence(){}},installBusinessNetworkEvidence(){},clTestCard:{getClTestCard:()=>({})},MarketPaymentPage:class{async selectCreditCard(){}async fillCardData(){}async validateCreditCardReady(){}async placeOrderAndCapture(){calls.push('submit');throw Error('Payment submit returned submitOrderDataWsDto business code 601 despite HTTP success.')}},clCausalReadback:{isClCartResponse:()=>true,createClReadbackFromCartResponse:async()=>reader,confirmClCreatedOrder:async(_page,actualReader,baseline)=>{assert.equal(actualReader,reader);assert.equal(baseline.size,0);calls.push('causal-confirmation');return{orderCode:code,outcome:'CAUSAL_ORDER_CONFIRMED_AFTER_601'}}}});
 await run({}, {title:'SAM-24826',annotations:[],attach:async()=>{}},{reachDelivery:async()=>({page,context:{close:async()=>calls.push('close')}})});
 assert.equal(calls.filter(c=>c==='submit').length,1);assert.deepEqual(calls,['baseline','submit','causal-confirmation','detach','close']);
});
